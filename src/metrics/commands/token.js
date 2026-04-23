#!/usr/bin/env node
/**
 * src/metrics/commands/token.js
 *
 * Aggregate token/cache/cost metrics from spec flow.json files and output
 * text/json/csv reports.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "../../lib/cli.js";
import { Command } from "../../lib/command.js";
import { EXIT_ERROR, EXIT_SUCCESS } from "../../lib/constants.js";
import { formatDurationSeconds } from "../../lib/formatter.js";

const DEFAULT_FORMAT = "text";
const SUPPORTED_FORMATS = new Set(["text", "json", "csv"]);
const MAX_FLOW_FILES = 5000;
const DIFFICULTY_BASELINES = {
  specMdChars: 10000,
  requirementCount: 20,
  testCount: 30,
  reviewCount: 30,
  issueLogEntries: 10,
};
const PRECISION_NORMALIZER = 100;
const PRECISION_MIN = 0.3;
const PRECISION_MAX = 3.0;

function formatUsage() {
  return [
    "Usage: sdd-forge metrics token [options]",
    "",
    "Options:",
    "  --format <text|json|csv>   Output format (default: text)",
    "  -h, --help                 Show this help",
  ].join("\n");
}

function usageError(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write(`${formatUsage()}\n`);
  process.exit(EXIT_ERROR);
}

function isoDateFromFinalizedAt(iso) {
  if (typeof iso !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) return null;
  return iso.slice(0, 10);
}

function toNumberOrNull(value) {
  return Number.isFinite(value) ? Number(value) : null;
}

function addMetric(acc, field, value) {
  const n = toNumberOrNull(value);
  if (n == null) return;
  acc[field] = acc[field] == null ? n : acc[field] + n;
}

function asDisplayValue(value, kind = "number") {
  if (value == null) return "N/A";
  if (kind === "cost") return Number(value).toFixed(6);
  if (kind === "difficulty") return Number(value).toFixed(2);
  if (kind === "duration") return formatDurationSeconds(value);
  return String(value);
}

function asCsvValue(value, kind = "number") {
  if (value == null) return "N/A";
  if (kind === "cost") return Number(value).toFixed(6);
  if (kind === "difficulty") return Number(value).toFixed(2);
  return String(value);
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.phase !== b.phase) return a.phase.localeCompare(b.phase);
    return a.date.localeCompare(b.date);
  });
}

function groupRowsByPhase(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.phase)) groups.set(row.phase, []);
    groups.get(row.phase).push(row);
  }
  return groups;
}

export function formatText(rows) {
  if (!rows.length) return "No metrics data found.";

  const lines = [];
  const groups = groupRowsByPhase(sortRows(rows));

  for (const [phase, phaseRows] of groups.entries()) {
    lines.push(`PHASE ${phase}`);
    lines.push("");
    lines.push("             |             | token          | cache          |            |          |          |");
    lines.push("             | difficulty  | in      out    | read   create  | call count | cost     | duration |");
    lines.push("-------------------------------------------------------------------------------------------------");
    for (const row of phaseRows) {
      const date = row.date.padEnd(11, " ");
      const diff = asDisplayValue(row.difficulty, "difficulty").padEnd(11, " ");
      const inTok = asDisplayValue(row.tokenInput).padEnd(7, " ");
      const outTok = asDisplayValue(row.tokenOutput).padEnd(7, " ");
      const read = asDisplayValue(row.cacheRead).padEnd(6, " ");
      const create = asDisplayValue(row.cacheCreate).padEnd(7, " ");
      const calls = asDisplayValue(row.callCount).padEnd(10, " ");
      const cost = asDisplayValue(row.cost, "cost").padEnd(8, " ");
      const duration = asDisplayValue(row.durationMs, "duration");
      lines.push(`${date} | ${diff} | ${inTok} ${outTok} | ${read} ${create} | ${calls} | ${cost} | ${duration}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function formatJson(rows) {
  return JSON.stringify({ rows: sortRows(rows) }, null, 2);
}

export function formatCsv(rows) {
  const header = "date,phase,difficulty,tokenInput,tokenOutput,cacheRead,cacheCreate,callCount,cost,durationMs";
  const lines = [header];
  for (const row of sortRows(rows)) {
    lines.push([
      row.date,
      row.phase,
      asCsvValue(row.difficulty, "difficulty"),
      asCsvValue(row.tokenInput),
      asCsvValue(row.tokenOutput),
      asCsvValue(row.cacheRead),
      asCsvValue(row.cacheCreate),
      asCsvValue(row.callCount),
      asCsvValue(row.cost, "cost"),
      asCsvValue(row.durationMs),
    ].join(","));
  }
  return lines.join("\n");
}

async function listFlowFiles(specsDir) {
  const files = [];
  const stack = [specsDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== "flow.json") continue;
      files.push({ path: fullPath });
      if (files.length > MAX_FLOW_FILES) {
        throw new Error(`flow.json count exceeds limit (${MAX_FLOW_FILES})`);
      }
    }
  }

  return files;
}

function computeMaxFinalizedAt(flowEntries) {
  let max = null;
  for (const entry of flowEntries) {
    const iso = entry?.parsed?.state?.finalizedAt;
    if (typeof iso !== "string") continue;
    if (max == null || iso > max) max = iso;
  }
  return max;
}

async function isCacheFresh(cachePath, maxFinalizedAt) {
  if (!maxFinalizedAt) return false;
  let text;
  try {
    text = await fs.readFile(cachePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      // Cache miss on first run is expected; rebuild silently-but-visibly.
      process.stderr.write(`sdd-forge metrics token: cache miss (first run), rebuilding\n`);
    } else {
      process.stderr.write(`sdd-forge metrics token: cache read failed (${err.code || err.message}), rebuilding\n`);
    }
    return false;
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    process.stderr.write(`sdd-forge metrics token: cache parse failed (${err.message}), rebuilding\n`);
    return false;
  }
  if (typeof parsed?.maxFinalizedAt !== "string") return false;
  return parsed.maxFinalizedAt >= maxFinalizedAt;
}

function toRowKey(date, phase) {
  return `${phase}::${date}`;
}

function createEmptyRow(date, phase) {
  return {
    date,
    phase,
    difficulty: null,
    tokenInput: null,
    tokenOutput: null,
    cacheRead: null,
    cacheCreate: null,
    callCount: null,
    cost: null,
    durationMs: null,
    _difficultySum: 0,
    _difficultyCount: 0,
  };
}

/**
 * Extract per-phase rows from a single flow's metrics object.
 * Used by both `buildRows` (file-driven) and unit tests.
 */
export function buildRowsFromMetrics(date, metrics, specDifficulty = null) {
  const rows = [];
  if (!metrics || typeof metrics !== "object") return rows;
  for (const [phase, phaseData] of Object.entries(metrics)) {
    if (!phaseData || typeof phaseData !== "object") continue;
    const row = createEmptyRow(date, phase);
    const tokens = phaseData.tokens && typeof phaseData.tokens === "object" ? phaseData.tokens : {};
    addMetric(row, "tokenInput", tokens.input);
    addMetric(row, "tokenOutput", tokens.output);
    addMetric(row, "cacheRead", tokens.cacheRead);
    addMetric(row, "cacheCreate", tokens.cacheCreation);
    addMetric(row, "callCount", phaseData.callCount);
    addMetric(row, "cost", phaseData.cost);
    addMetric(row, "durationMs", phaseData.durationMs);
    if (specDifficulty != null) {
      row._difficultySum += specDifficulty;
      row._difficultyCount += 1;
    }
    rows.push(finalizeRow(row));
  }
  return rows;
}

function finalizeRow(row) {
  return {
    date: row.date,
    phase: row.phase,
    difficulty: row._difficultyCount > 0 ? row._difficultySum / row._difficultyCount : null,
    tokenInput: row.tokenInput,
    tokenOutput: row.tokenOutput,
    cacheRead: row.cacheRead,
    cacheCreate: row.cacheCreate,
    callCount: row.callCount,
    cost: row.cost,
    durationMs: row.durationMs,
  };
}

async function safeReadJson(filePath) {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function countFilesRecursive(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const nestedCount = await countFilesRecursive(fullPath);
        if (nestedCount == null) return null;
        count += nestedCount;
      } else if (entry.isFile()) {
        count += 1;
      }
    }
    return count;
  } catch {
    return null;
  }
}

function sumReviewCount(reviewCount) {
  if (!reviewCount || typeof reviewCount !== "object") return null;
  const values = ["spec", "test", "impl"].map((k) => toNumberOrNull(reviewCount[k]));
  if (values.some((v) => v == null)) return null;
  return values[0] + values[1] + values[2];
}

function computeRequirementCount(spec) {
  if (Array.isArray(spec?.requirements)) return spec.requirements.length;
  return null;
}

function computeRequestChars(flowState) {
  const explicit = toNumberOrNull(flowState.requestChars);
  if (explicit != null) return explicit;
  if (typeof flowState.request === "string") return flowState.request.length;
  return null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeToHundred(value, baseline) {
  return clamp(value / baseline, 0, 1) * 100;
}

function average(values) {
  return values.reduce((acc, n) => acc + n, 0) / values.length;
}

async function computeSpecDifficulty(flowState, specDir) {
  // Post-T8: measure spec volume from spec.json via the shared validated load
  // path. The metric name specMdChars is retained for historical series
  // continuity. Historic specs without spec.json (pre-T11) are skipped via
  // returning null — metrics.token iterates many past flows and must tolerate
  // absent artifacts (spec 207 R2 carve-out for multi-spec iteration).
  //   Malformed spec.json still throws via JSON.parse.
  const specJsonPath = path.join(specDir, "spec.json");
  let stat;
  try {
    stat = await fs.stat(specJsonPath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
    // Historical spec without spec.json — skip this entry rather than failing
    // the whole metrics run. Spec 207 R2 carve-out for multi-spec iteration.
    return null;
  }
  if (!stat.isFile()) return null;
  const jsonText = await fs.readFile(specJsonPath, "utf8");
  const spec = JSON.parse(jsonText);
  const specMdChars = jsonText.length;

  const requirementCount = computeRequirementCount(spec);
  const testCountRaw = await countFilesRecursive(path.join(specDir, "tests"));
  const testCount = testCountRaw == null ? 0 : testCountRaw;
  const reviewCount = sumReviewCount(flowState.reviewCount);
  const issueLog = await safeReadJson(path.join(specDir, "issue-log.json"));
  const issueLogEntries = Array.isArray(issueLog?.entries) ? issueLog.entries.length : 0;
  const qaCountRaw = toNumberOrNull(flowState?.metrics?.draft?.question);
  const qaCount = qaCountRaw == null ? 0 : qaCountRaw;
  const requestChars = computeRequestChars(flowState);

  const required = [specMdChars, requirementCount, reviewCount, requestChars];
  if (required.some((v) => v == null)) return null;
  if (requestChars <= 0) return null;

  const baseDifficulty = average([
    normalizeToHundred(specMdChars, DIFFICULTY_BASELINES.specMdChars),
    normalizeToHundred(requirementCount, DIFFICULTY_BASELINES.requirementCount),
    normalizeToHundred(testCount, DIFFICULTY_BASELINES.testCount),
    normalizeToHundred(reviewCount, DIFFICULTY_BASELINES.reviewCount),
    normalizeToHundred(issueLogEntries, DIFFICULTY_BASELINES.issueLogEntries),
  ]);
  const precision = clamp((qaCount / requestChars) * PRECISION_NORMALIZER, PRECISION_MIN, PRECISION_MAX);
  return baseDifficulty * precision;
}

async function buildRows(flowEntries) {
  const rows = new Map();
  for (const entry of flowEntries) {
    const { path: filePath, parsed } = entry;
    const date = isoDateFromFinalizedAt(parsed?.state?.finalizedAt);
    if (!date) {
      process.stderr.write(`sdd-forge metrics token: skipping ${filePath} — missing state.finalizedAt\n`);
      continue;
    }
    const specDir = path.dirname(filePath);
    const specDifficulty = await computeSpecDifficulty(parsed, specDir);
    const metrics = parsed?.metrics;
    if (!metrics || typeof metrics !== "object") continue;

    for (const [phase, phaseData] of Object.entries(metrics)) {
      if (!phaseData || typeof phaseData !== "object") continue;
      const key = toRowKey(date, phase);
      if (!rows.has(key)) rows.set(key, createEmptyRow(date, phase));
      const row = rows.get(key);
      const tokens = phaseData.tokens && typeof phaseData.tokens === "object" ? phaseData.tokens : {};
      addMetric(row, "tokenInput", tokens.input);
      addMetric(row, "tokenOutput", tokens.output);
      addMetric(row, "cacheRead", tokens.cacheRead);
      addMetric(row, "cacheCreate", tokens.cacheCreation);
      addMetric(row, "callCount", phaseData.callCount);
      addMetric(row, "cost", phaseData.cost);
      addMetric(row, "durationMs", phaseData.durationMs);
      if (specDifficulty != null) {
        row._difficultySum += specDifficulty;
        row._difficultyCount += 1;
      }
    }
  }
  return sortRows([...rows.values()].map(finalizeRow));
}

async function readCacheRows(cachePath) {
  const text = await fs.readFile(cachePath, "utf8");
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error(`invalid cache format: ${cachePath}`);
  }
  return sortRows(parsed.rows);
}

async function writeCache(cachePath, rows, maxFinalizedAt) {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const payload = {
    generatedAt: new Date().toISOString(),
    maxFinalizedAt,
    rows: sortRows(rows),
  };
  await fs.writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function render(rows, format) {
  if (format === "json") return formatJson(rows);
  if (format === "csv") return formatCsv(rows);
  return formatText(rows);
}

async function runToken(rawArgs, container) {
  let opts;
  try {
    opts = parseArgs(rawArgs, {
      options: ["--format"],
      defaults: { format: DEFAULT_FORMAT },
    });
  } catch (err) {
    usageError(err.message);
  }

  if (opts.help) {
    process.stdout.write(`${formatUsage()}\n`);
    process.exit(EXIT_SUCCESS);
  }
  const format = String(opts.format || DEFAULT_FORMAT).toLowerCase();
  if (!SUPPORTED_FORMATS.has(format)) {
    usageError(`Unknown format: ${format}`);
  }

  const root = container.get("root");
  const specsDir = path.join(root, "specs");
  const cachePath = path.join(root, ".sdd-forge", "output", "metrics.json");

  let specsStat;
  try {
    specsStat = await fs.stat(specsDir);
  } catch (err) {
    throw new Error(`specs directory not found: ${specsDir}`);
  }
  if (!specsStat.isDirectory()) throw new Error(`specs path is not a directory: ${specsDir}`);

  const flowFiles = await listFlowFiles(specsDir);
  const flowEntries = [];
  for (const file of flowFiles) {
    const text = await fs.readFile(file.path, "utf8");
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(`invalid JSON in ${file.path}: ${err.message}`);
    }
    flowEntries.push({ path: file.path, parsed });
  }
  const maxFinalizedAt = computeMaxFinalizedAt(flowEntries);
  let rows;
  const canReuseCache = await isCacheFresh(cachePath, maxFinalizedAt);
  if (canReuseCache) {
    rows = await readCacheRows(cachePath);
  } else {
    rows = await buildRows(flowEntries);
    await writeCache(cachePath, rows, maxFinalizedAt);
  }

  process.stdout.write(`${render(rows, format)}\n`);
}

export default class TokenCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runToken(ctx._rawArgs || [], ctx.container);
  }
}
