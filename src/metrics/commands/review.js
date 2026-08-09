#!/usr/bin/env node
/**
 * src/metrics/commands/review.js
 *
 * Aggregate review, guardrail, and repair-effectiveness artifacts across specs.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "../../lib/cli.js";
import { Command } from "../../lib/command.js";
import { EXIT_ERROR, EXIT_SUCCESS } from "../../lib/constants.js";
import { DEFAULT_FLOW_SPEC_DIR } from "../../lib/flow-workspace.js";

const DEFAULT_FORMAT = "text";
const SUPPORTED_FORMATS = new Set(["text", "json", "csv"]);
const REVIEW_PHASES = ["impl", "spec", "test", "draft-questions", "draft-coverage"];
const LATEST_ARTIFACTS = new Map([
  ["impl-review.json", "impl"],
  ["spec-review.json", "spec"],
  ["test-review.json", "test"],
  ["draft-review-questions.json", "draft-questions"],
  ["draft-review-coverage.json", "draft-coverage"],
]);
const ATTEMPT_LIMIT_THRESHOLD = 5;

function formatUsage() {
  return [
    "Usage: senrail metrics review [options]",
    "",
    "Options:",
    "  --format <text|json|csv>   Output format (default: text)",
    "  --search <text>            Filter findings by keyword or category",
    "  -h, --help                 Show this help",
  ].join("\n");
}

function usageError(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write(`${formatUsage()}\n`);
  process.exit(EXIT_ERROR);
}

function assertText(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

export class ReviewMetricsSpec {
  constructor({ name, dir }) {
    this.name = assertText(name, "spec name");
    this.dir = assertText(dir, "spec dir");
  }

  toJSON() {
    return { name: this.name };
  }
}

export class ReviewFinding {
  constructor({ id, spec, phase, sourceArtifact, attempt = null, severity, title, body = "", category = "unknown" }) {
    this.id = assertText(id, "finding id");
    this.spec = assertText(spec, "finding spec");
    this.phase = assertText(phase, "finding phase");
    this.sourceArtifact = assertText(sourceArtifact, "source artifact");
    this.attempt = attempt == null ? null : Number(attempt);
    this.severity = assertText(severity, "finding severity");
    this.title = assertText(title, "finding title");
    this.body = String(body || "");
    this.category = String(category || "unknown").trim() || "unknown";
  }

  matches(query) {
    if (!query) return true;
    const needle = query.toLowerCase();
    return this.category.toLowerCase().includes(needle)
      || this.title.toLowerCase().includes(needle)
      || this.body.toLowerCase().includes(needle);
  }

  toJSON() {
    return {
      id: this.id,
      spec: this.spec,
      phase: this.phase,
      sourceArtifact: this.sourceArtifact,
      attempt: this.attempt,
      severity: this.severity,
      title: this.title,
      body: this.body,
      category: this.category,
    };
  }
}

export class RepairOutcome {
  constructor({ spec, findingId = null, repairRef = null }) {
    this.spec = assertText(spec, "repair spec");
    this.findingId = findingId ? String(findingId).trim() : null;
    this.repairRef = repairRef && typeof repairRef === "object" ? repairRef : null;
  }

  get complete() {
    return Boolean(this.findingId && this.repairRef);
  }

  detail() {
    if (!this.repairRef) return "missing repair reference";
    if (this.repairRef.commit) return String(this.repairRef.commit);
    if (Array.isArray(this.repairRef.files)) return this.repairRef.files.join(" ");
    return "unknown repair reference";
  }

  toCorrespondenceRow() {
    return {
      spec: this.spec,
      findingId: this.findingId,
      status: this.complete ? "recorded" : "unknown",
      detail: this.detail(),
    };
  }
}

export class AggregateRow {
  constructor({ section, spec = "", phase = "", category = "", count = null, rate = null, status = "", detail = "", guardrailId = null }) {
    this.section = assertText(section, "aggregate section");
    this.spec = String(spec || "");
    this.phase = String(phase || "");
    this.category = String(category || "");
    this.count = count == null ? null : Number(count);
    this.rate = rate == null ? null : Number(rate);
    this.status = String(status || "");
    this.detail = String(detail || "");
    this.guardrailId = guardrailId == null ? null : String(guardrailId);
  }

  toJSON() {
    return {
      section: this.section,
      spec: this.spec,
      phase: this.phase,
      category: this.category,
      count: this.count,
      rate: this.rate,
      status: this.status,
      detail: this.detail,
      ...(this.guardrailId ? { guardrailId: this.guardrailId } : {}),
    };
  }
}

class MissingDataEntry {
  constructor({ spec, status, detail }) {
    this.spec = spec;
    this.status = status;
    this.detail = detail;
    this.value = null;
  }

  toJSON() {
    return {
      spec: this.spec,
      value: this.value,
      status: this.status,
      detail: this.detail,
    };
  }
}

function rateRow(numerator, denominator) {
  if (denominator === 0) {
    return { numerator: null, denominator: null, percentage: null, status: "unknown" };
  }
  return {
    numerator,
    denominator,
    percentage: Math.round((numerator / denominator) * 100),
    status: "recorded",
  };
}

function rowKey(...parts) {
  return parts.join("\u0000");
}

function increment(map, key, factory) {
  if (!map.has(key)) map.set(key, factory());
  map.get(key).count += 1;
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`invalid JSON in ${filePath}: ${err.message}`);
  }
}

async function maybeReadJson(filePath) {
  try {
    return await readJson(filePath);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function listSpecDirs(root) {
  const specsDir = root;
  let stat;
  try {
    stat = await fs.stat(specsDir);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  if (!stat.isDirectory()) throw new Error(`specs path is not a directory: ${specsDir}`);
  const entries = await fs.readdir(specsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => new ReviewMetricsSpec({ name: entry.name, dir: path.join(specsDir, entry.name) }));
}

function repairRefFromEntry(entry) {
  if (entry.repairRef && typeof entry.repairRef === "object") return entry.repairRef;
  return null;
}

function guardrailIdsFromRecord(record) {
  const ids = [];
  if (record.guardrailId) ids.push(record.guardrailId);
  if (record.guardrail_id) ids.push(record.guardrail_id);
  if (record.requirementRef) ids.push(record.requirementRef);
  if (Array.isArray(record.refs)) ids.push(...record.refs);
  return ids.filter(Boolean);
}

function guardrailIdsFromEntry(entry) {
  const observations = Array.isArray(entry.observations) ? entry.observations : [];
  if (observations.length > 0) {
    return observations.flatMap((observation) => guardrailIdsFromRecord(observation));
  }
  const evaluations = Array.isArray(entry.failedEvaluations) ? entry.failedEvaluations : [];
  if (evaluations.length > 0) {
    return evaluations.flatMap((evaluation) => guardrailIdsFromRecord(evaluation));
  }
  return guardrailIdsFromRecord(entry);
}

function entryShowsAttemptLimit(entry) {
  const text = [
    entry.reason,
    entry.trigger,
    entry.resolution,
    entry.result,
    entry.failureKind,
  ].filter(Boolean).join(" ").toLowerCase();
  return /max[_ -]?attempt|attempt[_ -]?limit|retry exhaustion|retry budget|review_max_attempts_exceeded/.test(text);
}

function retryLimitRowsFromFlow(spec, flow) {
  const rows = [];
  const seen = new Set();
  const push = (phase, source, count) => {
    const key = `${phase}:${source}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ spec: spec.name, phase, source, count });
  };
  const summary = flow?.metricsSummary?.flow || {};
  for (const [phase, data] of Object.entries(summary)) {
    if (!data || typeof data !== "object") continue;
    for (const field of ["gateRetry", "reviewRetry"]) {
      const value = Number(data[field] || 0);
      if (value >= ATTEMPT_LIMIT_THRESHOLD) {
        push(phase, "flow.json", value);
      }
    }
  }
  const counters = new Map();
  for (const entry of Array.isArray(flow?.metrics) ? flow.metrics : []) {
    if (!entry || !["gateRetry", "reviewRetry"].includes(entry.counter)) continue;
    const phase = entry.phase || "unknown";
    const key = rowKey(phase, entry.counter);
    if (entry.reset) counters.set(key, 0);
    counters.set(key, (counters.get(key) || 0) + Number(entry.delta || 0));
  }
  for (const [key, value] of counters.entries()) {
    if (value < ATTEMPT_LIMIT_THRESHOLD) continue;
    const [phase] = key.split("\u0000");
    push(phase, "flow.json", value);
  }
  return rows;
}

function bodyFromFinding(item) {
  return String(item.body || item.issue || item.rationale || item.evidence || item.suggestion || item.title || "");
}

function categoryForLatest(phase, item) {
  if (phase === "impl") return item.failureMode || "unknown";
  if (phase.startsWith("draft-")) return item.classification || "unknown";
  return item.category || item.failureMode || item.classification || "unknown";
}

function latestBuckets(artifact) {
  return [
    ["blocking", artifact.blockingFindings || []],
    ["non-blocking", artifact.nonBlockingImprovements || []],
    ["non-blocking", artifact.advisoryFindings || []],
    ["blocking", artifact.repairTargets || []],
  ];
}

function findingsFromLatest(spec, basename, artifact) {
  const phase = LATEST_ARTIFACTS.get(basename);
  const findings = [];
  for (const [severity, items] of latestBuckets(artifact)) {
    for (const item of items) {
      const idx = findings.length + 1;
      findings.push(new ReviewFinding({
        id: `${phase}-latest-${severity}-${String(idx).padStart(3, "0")}`,
        spec: spec.name,
        phase,
        sourceArtifact: basename,
        severity,
        title: item.title || "Untitled finding",
        body: bodyFromFinding(item),
        category: categoryForLatest(phase, item),
      }));
    }
  }
  return findings;
}

function findingsFromHistory(spec, artifact) {
  const rawFindings = Array.isArray(artifact?.findings) ? artifact.findings : [];
  return rawFindings.map((item, index) => new ReviewFinding({
    id: item.id || `${artifact.phase}-${String(artifact.attempt || 0).padStart(3, "0")}-${String(index + 1).padStart(3, "0")}`,
    spec: spec.name,
    phase: item.phase || artifact.phase,
    sourceArtifact: item.sourceArtifact || artifact.sourceArtifact,
    attempt: item.attempt ?? artifact.attempt,
    severity: item.severity || "blocking",
    title: item.title || "Untitled finding",
    body: item.body || "",
    category: item.category || "unknown",
  }));
}

async function loadReviewHistory(spec) {
  const historyDir = path.join(spec.dir, "review-history");
  let entries;
  try {
    entries = await fs.readdir(historyDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  const findings = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const artifact = await readJson(path.join(historyDir, entry.name));
    findings.push(...findingsFromHistory(spec, artifact));
  }
  return findings;
}

async function loadLatestFindings(spec, historyFindings) {
  const findings = [];
  const historyKeys = new Set(historyFindings.map((finding) =>
    rowKey(finding.phase, finding.sourceArtifact, finding.title, finding.body, finding.category, finding.severity),
  ));
  for (const basename of LATEST_ARTIFACTS.keys()) {
    const artifact = await maybeReadJson(path.join(spec.dir, basename));
    if (!artifact) continue;
    for (const finding of findingsFromLatest(spec, basename, artifact)) {
      const key = rowKey(finding.phase, finding.sourceArtifact, finding.title, finding.body, finding.category, finding.severity);
      if (!historyKeys.has(key)) findings.push(finding);
    }
  }
  return findings;
}

export async function loadReviewMetricsArtifacts(root, specRoot = DEFAULT_FLOW_SPEC_DIR) {
  const specs = await listSpecDirs(path.join(root, specRoot));
  const findings = [];
  const repairs = [];
  const guardrails = [];
  const phaseEntries = [];
  const attemptLimitSpecs = [];
  const missingData = [];

  for (const spec of specs) {
    const issueLog = await maybeReadJson(path.join(spec.dir, "issue-log.json"));
    if (issueLog?.entries && !Array.isArray(issueLog.entries)) {
      throw new Error(`invalid issue-log entries in ${path.join(spec.dir, "issue-log.json")}`);
    }
    for (const entry of issueLog?.entries || []) {
      const phase = entry.step || entry.phase || "unknown";
      const guardrailIds = guardrailIdsFromEntry(entry);
      if (guardrailIds.length === 0) {
        phaseEntries.push({ spec: spec.name, phase });
      }
      for (const guardrailId of guardrailIds) {
        phaseEntries.push({ spec: spec.name, phase });
        guardrails.push({ spec: spec.name, guardrailId });
      }
      if (entry.normalizedFindingId || entry.repairRef) {
        repairs.push(new RepairOutcome({
          spec: spec.name,
          findingId: entry.normalizedFindingId,
          repairRef: repairRefFromEntry(entry),
        }));
      }
      if (entryShowsAttemptLimit(entry)) {
        attemptLimitSpecs.push({ spec: spec.name, phase, source: "issue-log.json", count: 1 });
      }
    }

    const flow = await maybeReadJson(path.join(spec.dir, "flow.json"));
    if (flow) attemptLimitSpecs.push(...retryLimitRowsFromFlow(spec, flow));

    const historyFindings = await loadReviewHistory(spec);
    findings.push(...historyFindings);
    findings.push(...await loadLatestFindings(spec, historyFindings));
    if (historyFindings.length === 0) {
      missingData.push(new MissingDataEntry({
        spec: spec.name,
        status: "not recorded",
        detail: "review-history artifacts not recorded",
      }));
    }
  }

  return { specs, findings, repairs, guardrails, phaseEntries, attemptLimitSpecs, missingData };
}

function aggregateRows(items, keyFn, rowFn) {
  const rows = new Map();
  for (const item of items) {
    increment(rows, keyFn(item), () => rowFn(item));
  }
  return [...rows.values()].sort((a, b) =>
    (b.count || 0) - (a.count || 0) || a.detail.localeCompare(b.detail),
  );
}

function historyGroups(findings) {
  const groups = new Map();
  for (const finding of findings) {
    if (finding.attempt == null) continue;
    const key = rowKey(finding.spec, finding.phase);
    if (!groups.has(key)) groups.set(key, new Map());
    const attempts = groups.get(key);
    if (!attempts.has(finding.attempt)) attempts.set(finding.attempt, []);
    attempts.get(finding.attempt).push(finding);
  }
  return groups;
}

function computeRepairRates(findings) {
  let disappeared = 0;
  let compared = 0;
  let reappeared = 0;
  let categoryCompared = 0;
  for (const attempts of historyGroups(findings).values()) {
    const ordered = [...attempts.keys()].sort((a, b) => a - b);
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const current = attempts.get(ordered[i]).filter((finding) => finding.severity === "blocking");
      const next = attempts.get(ordered[i + 1]).filter((finding) => finding.severity === "blocking");
      const nextIds = new Set(next.map((finding) => finding.id));
      const nextCategories = new Set(next.map((finding) => finding.category));
      for (const finding of current) {
        compared += 1;
        if (!nextIds.has(finding.id)) {
          disappeared += 1;
          categoryCompared += 1;
          if (nextCategories.has(finding.category)) reappeared += 1;
        }
      }
    }
  }
  return {
    disappearanceRate: rateRow(disappeared, compared),
    sameCategoryReappearanceRate: rateRow(reappeared, categoryCompared),
  };
}

export function aggregateReviewMetrics(loaded, { search = null } = {}) {
  const guardrails = aggregateRows(
    loaded.guardrails,
    (item) => item.guardrailId,
    (item) => new AggregateRow({
      section: "guardrails",
      guardrailId: item.guardrailId,
      category: item.guardrailId,
      detail: item.guardrailId,
      count: 0,
    }),
  ).map((row) => ({ guardrailId: row.guardrailId, count: row.count }));

  const phaseDistribution = aggregateRows(
    loaded.phaseEntries,
    (item) => item.phase,
    (item) => new AggregateRow({ section: "phase-distribution", phase: item.phase, detail: item.phase, count: 0 }),
  ).map((row) => ({ phase: row.phase, count: row.count }));

  const findingTrends = aggregateRows(
    loaded.findings,
    (finding) => rowKey(finding.spec, finding.phase, finding.category),
    (finding) => new AggregateRow({
      section: "findings",
      spec: finding.spec,
      phase: finding.phase,
      category: finding.category,
      detail: `${finding.spec}:${finding.phase}:${finding.category}`,
      count: 0,
    }),
  );

  const repairRates = computeRepairRates(loaded.findings);
  const diffCorrespondence = loaded.repairs.map((repair) => repair.toCorrespondenceRow());
  const searchResults = search ? loaded.findings.filter((finding) => finding.matches(search)) : [];

  return {
    specs: loaded.specs,
    findings: loaded.findings,
    findingTrends,
    guardrails,
    phaseDistribution,
    missingData: {
      count: loaded.missingData.length,
      totalSpecs: loaded.specs.length,
      recordedSpecs: loaded.specs.length - loaded.missingData.length,
      entries: loaded.missingData,
    },
    repairMetrics: {
      ...repairRates,
      attemptLimitSpecs: loaded.attemptLimitSpecs,
      diffCorrespondence,
    },
    search,
    searchResults,
  };
}

function sectionLine(title) {
  return `${title}\n${"-".repeat(title.length)}`;
}

function formatRate(rate) {
  if (rate.status !== "recorded") return "unknown";
  return `${rate.numerator}/${rate.denominator} ${rate.percentage}% ${rate.status}`;
}

export class ReviewMetricsTextFormatter {
  constructor(report) {
    this.report = report;
  }

  format() {
    const lines = [sectionLine("Guardrail Violations")];
    for (const row of this.report.guardrails) lines.push(`${row.guardrailId}: ${row.count}`);
    if (this.report.guardrails.length === 0) lines.push("not recorded");

    lines.push("", sectionLine("Review Finding Trends"));
    for (const row of this.report.findingTrends) lines.push(`${row.spec} ${row.phase} ${row.category}: ${row.count}`);
    if (this.report.findingTrends.length === 0) lines.push("not recorded");

    lines.push("", sectionLine("Repair Effectiveness"));
    lines.push(`disappearance: ${formatRate(this.report.repairMetrics.disappearanceRate)}`);
    lines.push(`same-category reappearance: ${formatRate(this.report.repairMetrics.sameCategoryReappearanceRate)}`);
    for (const row of this.report.repairMetrics.attemptLimitSpecs) lines.push(`attempt-limit: ${row.spec} ${row.source}`);

    lines.push("", sectionLine("Missing Data"));
    for (const entry of this.report.missingData.entries) lines.push(`${entry.spec}: ${entry.status}`);
    if (this.report.missingData.entries.length === 0) lines.push("not recorded");

    if (this.report.search) {
      lines.push("", sectionLine("Search Results"));
      for (const finding of this.report.searchResults) lines.push(`${finding.id} ${finding.category} ${finding.title}`);
      if (this.report.searchResults.length === 0) lines.push("not recorded");
    }
    return lines.join("\n");
  }
}

export class ReviewMetricsJsonFormatter {
  constructor(report) {
    this.report = report;
  }

  format() {
    return JSON.stringify({
      specs: this.report.specs.map((spec) => spec.toJSON()),
      guardrails: this.report.guardrails,
      phaseDistribution: this.report.phaseDistribution,
      findings: this.report.findings.map((finding) => finding.toJSON()),
      findingTrends: this.report.findingTrends.map((row) => ({
        spec: row.spec,
        phase: row.phase,
        category: row.category,
        count: row.count,
      })),
      repairMetrics: this.report.repairMetrics,
      missingData: {
        count: this.report.missingData.count,
        totalSpecs: this.report.missingData.totalSpecs,
        recordedSpecs: this.report.missingData.recordedSpecs,
        entries: this.report.missingData.entries.map((entry) => entry.toJSON()),
      },
      searchResults: this.report.searchResults.map((finding) => finding.toJSON()),
    }, null, 2);
  }
}

function csvValue(value) {
  const text = value == null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

export class ReviewMetricsCsvFormatter {
  constructor(report) {
    this.report = report;
  }

  format() {
    const lines = ["section,spec,phase,category,count,rate,status,detail"];
    const push = (values) => lines.push(values.map(csvValue).join(","));
    const pushRate = (name, rate) => {
      push([
        "repair-effectiveness",
        "",
        "",
        "",
        rate.numerator ?? "",
        rate.percentage ?? "",
        rate.status,
        name,
      ]);
    };
    for (const row of this.report.guardrails) {
      push(["guardrails", "", "", row.guardrailId, row.count, "", "recorded", row.guardrailId]);
    }
    for (const row of this.report.findingTrends) {
      push(["findings", row.spec, row.phase, row.category, row.count, "", "recorded", row.detail]);
    }
    for (const entry of this.report.missingData.entries) {
      push(["missing-data", entry.spec, "", "", "", "", entry.status, entry.detail]);
    }
    pushRate("disappearance rate", this.report.repairMetrics.disappearanceRate);
    pushRate("same-category reappearance rate", this.report.repairMetrics.sameCategoryReappearanceRate);
    for (const row of this.report.repairMetrics.attemptLimitSpecs) {
      const retryCount = row.count == null ? "" : ` (${row.count})`;
      push(["repair-effectiveness", row.spec, row.phase, "", 1, 100, "recorded", `attempt limit from ${row.source}${retryCount}`]);
    }
    for (const row of this.report.repairMetrics.diffCorrespondence) {
      push(["repair-correspondence", row.spec, "", "", "", "", row.status, row.detail]);
    }
    if (this.report.search) {
      for (const finding of this.report.searchResults) {
        push(["search-results", finding.spec, finding.phase, finding.category, 1, "", "recorded", finding.title]);
      }
      if (this.report.searchResults.length === 0) {
        push(["search-results", "", "", "", "", "", "not recorded", "no matching findings"]);
      }
    }
    return lines.join("\n");
  }
}

function render(report, format) {
  if (format === "json") return new ReviewMetricsJsonFormatter(report).format();
  if (format === "csv") return new ReviewMetricsCsvFormatter(report).format();
  return new ReviewMetricsTextFormatter(report).format();
}

async function runReviewMetrics(rawArgs, container) {
  let opts;
  try {
    opts = parseArgs(rawArgs, {
      options: ["--format", "--search"],
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
  if (!SUPPORTED_FORMATS.has(format)) usageError(`Unknown format: ${format}`);
  const search = opts.search == null ? null : String(opts.search).trim();
  if (opts.search != null && (search.length < 1 || search.length > 256)) {
    usageError("--search must be a trimmed string from 1 to 256 characters");
  }
  const loaded = await loadReviewMetricsArtifacts(
    container.get("mainRoot"),
    container.get("flowSpecRoot").toString(),
  );
  process.stdout.write(`${render(aggregateReviewMetrics(loaded, { search }), format)}\n`);
}

export default class ReviewMetricsCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runReviewMetrics(ctx._rawArgs || [], ctx.container);
  }
}
