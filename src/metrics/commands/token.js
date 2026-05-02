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
import { EXIT_ERROR, EXIT_SUCCESS, VALID_PHASES } from "../../lib/constants.js";
import { formatDurationSeconds } from "../../lib/formatter.js";

const CACHE_VERSION = 2;
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

function formatScalar(value, kind = "number") {
  if (value == null) return (kind === "cost" || kind === "difficulty") ? "—" : "N/A";
  if (kind === "cost") return Number(value).toFixed(6);
  if (kind === "difficulty") return Number(value).toFixed(2);
  return String(value);
}

function asDisplayValue(value, kind = "number") {
  if (kind === "duration") return value == null ? "N/A" : formatDurationSeconds(value);
  return formatScalar(value, kind);
}

function phaseLabel(phase) {
  const idx = parseInt(phase, 10);
  if (Number.isFinite(idx) && idx >= 0 && idx < VALID_PHASES.length) return VALID_PHASES[idx];
  return phase;
}

function asCsvValue(value, kind = "number") {
  return formatScalar(value, kind);
}

function phaseOrder(phase) {
  const idx = VALID_PHASES.indexOf(phase);
  return idx === -1 ? Infinity : idx;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const pa = phaseOrder(a.phase);
    const pb = phaseOrder(b.phase);
    if (pa !== pb) return pa - pb;
    return a.date.localeCompare(b.date);
  });
}

function groupRowsByPhase(rows, { dateDesc = false } = {}) {
  const sorted = sortRows(rows);
  const groups = new Map();
  for (const row of sorted) {
    if (!groups.has(row.phase)) groups.set(row.phase, []);
    groups.get(row.phase).push(row);
  }
  if (dateDesc) {
    for (const phaseRows of groups.values()) {
      phaseRows.reverse();
    }
  }
  return groups;
}

export function computePhaseSummary(phaseRows) {
  if (!phaseRows || phaseRows.length === 0) return null;
  const n = phaseRows.length;
  let totalCalls = 0;
  let totalDuration = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheCreate = 0;
  let totalSpecCount = 0;
  let costSum = 0;
  let costCount = 0;
  let durationCount = 0;
  let difficultySum = 0;
  let difficultyCount = 0;

  for (const row of phaseRows) {
    totalCalls += row.callCount || 0;
    if (row.durationMs != null) { totalDuration += row.durationMs; durationCount += 1; }
    totalInput += row.tokenInput || 0;
    totalOutput += row.tokenOutput || 0;
    totalCacheRead += row.cacheRead || 0;
    totalCacheCreate += row.cacheCreate || 0;
    totalSpecCount += row.specCount || 0;
    if (row.cost != null) { costSum += row.cost; costCount += 1; }
    if (row.difficulty != null) { difficultySum += row.difficulty; difficultyCount += 1; }
  }

  const cacheHitRate = (totalInput + totalCacheRead) > 0
    ? totalCacheRead / (totalInput + totalCacheRead)
    : null;

  return {
    totalCalls,
    avgCallCount: n > 0 ? totalCalls / n : null,
    avgCost: costCount > 0 ? costSum / costCount : null,
    avgDuration: durationCount > 0 ? totalDuration / durationCount : null,
    avgTokenInput: n > 0 ? totalInput / n : null,
    avgTokenOutput: n > 0 ? totalOutput / n : null,
    avgCacheRead: n > 0 ? totalCacheRead / n : null,
    avgCacheCreate: n > 0 ? totalCacheCreate / n : null,
    cacheHitRate,
    avgSpecCount: n > 0 ? totalSpecCount / n : null,
    avgDifficulty: difficultyCount > 0 ? difficultySum / difficultyCount : null,
  };
}

const TEXT_MAX_ROWS = 7;
const TABLE_WIDTH = 107;

function formatCacheHitPercent(rate) {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function formatTextCost(value) {
  if (value == null) return "—";
  return `$${Number(value).toFixed(1)}`;
}

function textDataLine(label, specs, diff, inTok, outTok, read, create, hit, calls, cost, duration) {
  return `${label.padEnd(13)}| ${specs.padEnd(6)}| ${diff.padEnd(12)}| ${inTok.padEnd(8)}${outTok.padEnd(7)}| ${read.padEnd(7)}${create.padEnd(7)}${hit.padEnd(6)}| ${calls.padEnd(11)}| ${cost.padEnd(9)}| ${duration}`;
}

export function formatText(rows) {
  if (!rows.length) return "No metrics data found.";

  const lines = [];
  const groups = groupRowsByPhase(rows, { dateDesc: true });

  lines.push(textDataLine("", "", "", "token", "", "cache", "", "", "", "", ""));
  lines.push(textDataLine("", "specs", "difficulty", "in", "out", "read", "create", "hit", "call count", "cost", "duration"));

  for (const [phase, allPhaseRows] of groups.entries()) {
    const sep = `-- ${phaseLabel(phase)} `;
    lines.push(sep + "-".repeat(Math.max(3, TABLE_WIDTH - sep.length)));

    const displayed = allPhaseRows.slice(0, TEXT_MAX_ROWS);
    const elided = allPhaseRows.length - displayed.length;

    for (const row of displayed) {
      const incomplete = row.costIncomplete && row.cost != null;
      const costStr = formatTextCost(row.cost) + (incomplete ? " +" : "");
      lines.push(textDataLine(
        row.date,
        String(row.specCount),
        asDisplayValue(row.difficulty, "difficulty"),
        asDisplayValue(row.tokenInput),
        asDisplayValue(row.tokenOutput),
        asDisplayValue(row.cacheRead),
        asDisplayValue(row.cacheCreate),
        formatCacheHitPercent(row.cacheHitRate),
        asDisplayValue(row.callCount),
        costStr,
        asDisplayValue(row.durationMs, "duration"),
      ));
    }
    if (elided > 0) {
      lines.push(`... and ${elided} more`);
    }

    const summary = computePhaseSummary(allPhaseRows);
    if (summary) {
      lines.push("-".repeat(TABLE_WIDTH));
      lines.push(textDataLine(
        "AVG.",
        summary.avgSpecCount != null ? summary.avgSpecCount.toFixed(1) : "—",
        summary.avgDifficulty != null ? summary.avgDifficulty.toFixed(2) : "—",
        summary.avgTokenInput != null ? String(Math.round(summary.avgTokenInput)) : "—",
        summary.avgTokenOutput != null ? String(Math.round(summary.avgTokenOutput)) : "—",
        summary.avgCacheRead != null ? String(Math.round(summary.avgCacheRead)) : "—",
        summary.avgCacheCreate != null ? String(Math.round(summary.avgCacheCreate)) : "—",
        formatCacheHitPercent(summary.cacheHitRate),
        summary.avgCallCount != null ? summary.avgCallCount.toFixed(1) : "—",
        summary.avgCost != null ? formatTextCost(summary.avgCost) : "—",
        summary.avgDuration != null ? formatDurationSeconds(summary.avgDuration) : "—",
      ));
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function formatJson(rows) {
  const groups = groupRowsByPhase(rows);
  const phaseSummary = {};
  for (const [phase, phaseRows] of groups.entries()) {
    phaseSummary[phase] = computePhaseSummary(phaseRows);
  }
  const sorted = sortRows(rows);
  return JSON.stringify({ rows: sorted, phaseSummary }, null, 2);
}

function csvCostValue(value) {
  if (value == null) return "—";
  return Number(value).toFixed(1);
}

export function formatCsv(rows) {
  const header = "date,phase,specCount,difficulty,tokenInput,tokenOutput,cacheRead,cacheCreate,cacheHitRate,callCount,cost,durationMs,incomplete";
  const lines = [header];
  const groups = groupRowsByPhase(rows);

  for (const [phase, phaseRows] of groups.entries()) {
    for (const row of phaseRows) {
      lines.push([
        row.date,
        phaseLabel(row.phase),
        row.specCount,
        asCsvValue(row.difficulty, "difficulty"),
        asCsvValue(row.tokenInput),
        asCsvValue(row.tokenOutput),
        asCsvValue(row.cacheRead),
        asCsvValue(row.cacheCreate),
        row.cacheHitRate != null ? row.cacheHitRate.toFixed(4) : "N/A",
        asCsvValue(row.callCount),
        csvCostValue(row.cost),
        asCsvValue(row.durationMs),
        row.costIncomplete && row.cost != null ? "+" : "",
      ].join(","));
    }
    const summary = computePhaseSummary(phaseRows);
    if (summary) {
      lines.push([
        "SUMMARY",
        phaseLabel(phase),
        summary.avgSpecCount != null ? summary.avgSpecCount.toFixed(1) : "",
        summary.avgDifficulty != null ? summary.avgDifficulty.toFixed(2) : "",
        summary.avgTokenInput != null ? Math.round(summary.avgTokenInput) : "",
        summary.avgTokenOutput != null ? Math.round(summary.avgTokenOutput) : "",
        summary.avgCacheRead != null ? Math.round(summary.avgCacheRead) : "",
        summary.avgCacheCreate != null ? Math.round(summary.avgCacheCreate) : "",
        summary.cacheHitRate != null ? summary.cacheHitRate.toFixed(4) : "",
        summary.avgCallCount != null ? summary.avgCallCount.toFixed(1) : "",
        summary.avgCost != null ? csvCostValue(summary.avgCost) : "—",
        summary.avgDuration != null ? Math.round(summary.avgDuration) : "",
        "",
      ].join(","));
    }
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

async function isCacheFresh(metricsOutputPath, maxFinalizedAt) {
  if (!maxFinalizedAt) return false;
  let text;
  try {
    text = await fs.readFile(metricsOutputPath, "utf8");
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
  if (parsed.version !== CACHE_VERSION) {
    process.stderr.write(`sdd-forge metrics token: cache version mismatch (got ${parsed.version}, expected ${CACHE_VERSION}), rebuilding\n`);
    return false;
  }
  return parsed.maxFinalizedAt >= maxFinalizedAt;
}

function toRowKey(date, phase) {
  return `${phase}::${date}`;
}

function createEmptyRow(date, phase) {
  return {
    date,
    phase,
    specCount: 0,
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

function applyPhaseMetrics(row, phaseData, specDifficulty) {
  row.specCount += 1;
  const tokens = phaseData.tokens && typeof phaseData.tokens === "object" ? phaseData.tokens : {};
  addMetric(row, "tokenInput", tokens.input);
  addMetric(row, "tokenOutput", tokens.output);
  addMetric(row, "cacheRead", tokens.cacheRead);
  addMetric(row, "cacheCreate", tokens.cacheCreation);
  addMetric(row, "callCount", phaseData.callCount);
  addMetric(row, "cost", phaseData.cost);
  if (phaseData.costIncomplete) row.costIncomplete = true;
  addMetric(row, "durationMs", phaseData.durationMs);
  if (specDifficulty != null) {
    row._difficultySum += specDifficulty;
    row._difficultyCount += 1;
  }
}

/**
 * Extract per-phase rows from a single flow's metrics object.
 * Used by both `buildRows` (file-driven) and unit tests.
 */
export function buildRowsFromMetrics(date, metrics, specDifficulty = null) {
  const rows = [];
  if (!metrics || typeof metrics !== "object") return rows;
  const normalized = normalizeMetrics(metrics);
  for (const [phase, phaseData] of Object.entries(normalized)) {
    if (!phaseData || typeof phaseData !== "object") continue;
    const row = createEmptyRow(date, phase);
    applyPhaseMetrics(row, phaseData, specDifficulty);
    rows.push(finalizeRow(row));
  }
  return rows;
}

function finalizeRow(row) {
  const tokenInput = row.tokenInput || 0;
  const cacheRead = row.cacheRead || 0;
  const cacheHitDenom = tokenInput + cacheRead;
  return {
    date: row.date,
    phase: row.phase,
    specCount: row.specCount,
    difficulty: row._difficultyCount > 0 ? row._difficultySum / row._difficultyCount : null,
    tokenInput: row.tokenInput,
    tokenOutput: row.tokenOutput,
    cacheRead: row.cacheRead,
    cacheCreate: row.cacheCreate,
    cacheHitRate: cacheHitDenom > 0 ? cacheRead / cacheHitDenom : null,
    callCount: row.callCount,
    cost: row.cost,
    costIncomplete: row.costIncomplete || false,
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

function normalizeMetrics(metrics) {
  if (!Array.isArray(metrics)) return metrics;
  const byPhase = {};
  for (const entry of metrics) {
    if (!entry || !entry.phase || entry.kind !== "agent") continue;
    const p = byPhase[entry.phase] = byPhase[entry.phase] || {};
    p.callCount = (p.callCount || 0) + (entry.callCount || 0);
    if (entry.durationMs != null) p.durationMs = (p.durationMs || 0) + entry.durationMs;
    if (entry.tokens) {
      p.tokens = p.tokens || { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
      for (const k of ["input", "output", "cacheRead", "cacheCreation"]) {
        p.tokens[k] += entry.tokens[k] || 0;
      }
    }
    if (entry.cost != null) p.cost = (p.cost || 0) + entry.cost;
    if (entry.cost == null || entry.cost === 0) p.costIncomplete = true;
  }
  return byPhase;
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

    const phaseMap = normalizeMetrics(metrics);
    for (const [phase, phaseData] of Object.entries(phaseMap)) {
      if (!phaseData || typeof phaseData !== "object") continue;
      const key = toRowKey(date, phase);
      if (!rows.has(key)) rows.set(key, createEmptyRow(date, phase));
      applyPhaseMetrics(rows.get(key), phaseData, specDifficulty);
    }
  }
  return sortRows([...rows.values()].map(finalizeRow));
}

async function readCacheRows(metricsOutputPath) {
  const text = await fs.readFile(metricsOutputPath, "utf8");
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.rows)) {
    throw new Error(`invalid cache format: ${metricsOutputPath}`);
  }
  return sortRows(parsed.rows);
}

async function writeCache(metricsOutputPath, rows, maxFinalizedAt) {
  await fs.mkdir(path.dirname(metricsOutputPath), { recursive: true });
  const payload = {
    version: CACHE_VERSION,
    generatedAt: new Date().toISOString(),
    maxFinalizedAt,
    rows: sortRows(rows),
  };
  await fs.writeFile(metricsOutputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
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
  const metricsOutputPath = path.join(root, ".sdd-forge", "output", "metrics.json");

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
  const canReuseCache = await isCacheFresh(metricsOutputPath, maxFinalizedAt);
  if (canReuseCache) {
    rows = await readCacheRows(metricsOutputPath);
  } else {
    rows = await buildRows(flowEntries);
    await writeCache(metricsOutputPath, rows, maxFinalizedAt);
  }

  process.stdout.write(`${render(rows, format)}\n`);
}

export default class TokenCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runToken(ctx._rawArgs || [], ctx.container);
  }
}
