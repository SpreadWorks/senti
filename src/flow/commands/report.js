/**
 * src/flow/run/report.js
 *
 * Generate a work report from finalize pipeline data.
 * Called by finalize.js Step 6 (report).
 */

import fs from "fs";
import path from "path";
import { loadIssueLog } from "../lib/set-issue-log.js";
import { buildMetricsSummary, buildReportTotals } from "../lib/get-status.js";
import { pushSection, DIVIDER, formatDurationSeconds } from "../../lib/formatter.js";

/**
 * Build the structured report data object.
 * @param {Object} input
 * @param {Object} input.state - flow.json state
 * @param {Object} input.results - finalize step results
 * @param {Object} input.issueLog - issue-log data { entries: [] }
 * @param {string} input.implDiffStat - git diff --stat output for implementation
 * @param {string[]} input.commitMessages - commit messages from feature branch
 * @returns {{ data: Object, text: string }}
 */
export function generateReport(input) {
  const { state, results, issueLog, implDiffStat, commitMessages } = input;

  // Implementation
  const implementation = {
    diffStat: implDiffStat || null,
    commits: commitMessages || [],
  };

  // Retro
  const retroResult = results.retro;
  let retro = null;
  if (retroResult && retroResult.status === "done" && retroResult.summary) {
    retro = { ...retroResult.summary };
    if (retroResult.requirements) {
      retro.requirements = retroResult.requirements;
    }
  }

  // Redolog
  const entries = issueLog?.entries || [];
  const issueLogData = {
    count: entries.length,
    entries: entries.map(e => ({
      step: e.step,
      reason: e.reason,
      resolution: e.resolution || null,
    })),
  };

  // Metrics (derive from the single source of truth: buildMetricsSummary)
  const summary = buildMetricsSummary(state.metrics || []);
  const { activity: metrics, tokens: tokenMetrics } = buildReportTotals(summary.total);

  // Sync
  let sync;
  const syncResult = results.sync;
  if (!syncResult || syncResult.status === "skipped") {
    sync = {
      status: "skipped",
      reason: syncResult?.message || "sync was skipped",
    };
  } else if (syncResult.status === "done") {
    sync = {
      status: "done",
      diffStat: syncResult.diffStat || null,
      diffSummary: syncResult.diffSummary || null,
    };
  } else {
    sync = {
      status: syncResult.status || "unknown",
      reason: syncResult.message || null,
    };
  }

  // Tests (spec 251): consume test-execute-result.json + test-result-review.json
  // via results.testExecute / results.testResultReview, populated by
  // run-report.js. Legacy state.test.summary is no longer the source of truth.
  let tests = null;
  const testExecute = results.testExecute;
  const testResultReview = results.testResultReview;
  if (testExecute || testResultReview) {
    const summary = Array.isArray(testExecute?.summary) ? testExecute.summary : [];
    const passed = summary.filter((s) => s.result === "pass").length;
    const failed = summary.filter((s) => s.result === "fail").length;
    tests = {
      total: summary.length,
      passed,
      failed,
      verdict: testResultReview?.verdict || null,
      invalidReason: testResultReview?.invalidReason || null,
      rawOutputPath: testExecute?.rawOutputPath || null,
    };
  }

  const data = { implementation, retro, issueLog: issueLogData, metrics, tokenMetrics, tests, sync };
  const text = formatText(data);

  return { data, text };
}

/**
 * Push a section header (blank line + title + divider) onto lines.
 * @param {string[]} lines
 * @param {string} title
 * @param {string} thin - divider string
 */
/**
 * Format report data as human-readable plain text.
 * @param {Object} data - structured report data
 * @returns {string}
 */
function formatText(data) {
  const lines = [];
  const thin = DIVIDER;

  lines.push("  Report");

  // Implementation
  pushSection(lines, "Implementation", thin);
  if (data.implementation.commits.length > 0) {
    for (const msg of data.implementation.commits) {
      lines.push(`    ${msg}`);
    }
  }
  if (data.implementation.diffStat) {
    const last = data.implementation.diffStat.split("\n").pop()?.trim();
    if (last) lines.push(`    ${last}`);
  }
  if (!data.implementation.commits.length && !data.implementation.diffStat) {
    lines.push("    -");
  }

  // Retro
  pushSection(lines, "Retro", thin);
  if (data.retro) {
    const r = data.retro;
    const pct = (r.rate * 100).toFixed(0);
    const bar8 = Math.round(r.rate * 8);
    const filled = "\u2588".repeat(bar8);
    const empty = "\u2591".repeat(8 - bar8);
    lines.push(`    ${filled}${empty} ${pct}%  (${r.done} done / ${r.partial} partial / ${r.not_done} miss)`);
    if (r.rate < 1.0 && r.requirements) {
      for (const req of r.requirements) {
        if (req.status === "partial" || req.status === "not_done") {
          lines.push(`    [${req.status}] ${req.desc}`);
          if (req.note) lines.push(`               ${req.note}`);
        }
      }
    }
  } else {
    lines.push("    -");
  }

  const formatInt = (value) => Number(value || 0).toLocaleString("en-US");
  const metricLine = (label, value) => {
    const dots = ".".repeat(Math.max(1, 28 - label.length));
    return `    ${label} ${dots} ${value}`;
  };

  // Metrics
  pushSection(lines, "Metrics", thin);
  const m = data.metrics;
  lines.push(metricLine("docs read", formatInt(m.docsRead)));
  lines.push(metricLine("src read", formatInt(m.srcRead)));
  lines.push(metricLine("Q&A", formatInt(m.question)));
  lines.push(metricLine("issue-log", formatInt(m.issueLog)));

  // Agent metrics (token/cost) — R3-1, R3-2
  if (data.tokenMetrics && data.tokenMetrics.callCount > 0) {
    const t = data.tokenMetrics;
    const costStr = t.cost != null && t.cost !== 0 ? `$${t.cost.toFixed(4)}` : "N/A+";
    lines.push(metricLine("agent calls", formatInt(t.callCount)));
    lines.push(metricLine("input tokens", formatInt(t.input)));
    lines.push(metricLine("output tokens", formatInt(t.output)));
    lines.push(metricLine("cache-read tokens", formatInt(t.cacheRead)));
    lines.push(metricLine("cache-create tokens", formatInt(t.cacheCreation)));
    lines.push(metricLine("cost", costStr));
    if (t.durationMs > 0) {
      lines.push(metricLine("duration (total)", formatDurationSeconds(t.durationMs)));
      for (const { phase, durationMs } of t.phaseDurations) {
        lines.push(metricLine(`  ${phase}`, formatDurationSeconds(durationMs)));
      }
    }
  }

  // Tests (always shown) — spec 251: per-requirement test-execute summary +
  // test-result-review verdict. Categorical unit/integration/acceptance counts
  // are no longer surfaced (the runner is language-agnostic).
  pushSection(lines, "Tests", thin);
  if (data.tests) {
    const t = data.tests;
    const verdict = t.verdict ? ` verdict=${t.verdict}` : "";
    lines.push(`    total ${t.total}  passed ${t.passed}  failed ${t.failed}${verdict}`);
    if (t.invalidReason) {
      lines.push(`    invalid_reason: ${t.invalidReason}`);
    }
    if (t.rawOutputPath) {
      lines.push(`    raw_output: ${t.rawOutputPath}`);
    }
  } else {
    lines.push("    No test data");
  }

  // Redo (only if entries exist)
  if (data.issueLog.count > 0) {
    pushSection(lines, `Issue Log (${data.issueLog.count})`, thin);
    for (const e of data.issueLog.entries) {
      lines.push(`    [${e.step}] ${e.reason}`);
    }
  }

  return lines.join("\n");
}

/**
 * Save report.json to the spec directory.
 * @param {string} root - project root
 * @param {string} specPath - relative spec path
 * @param {Object} reportData - { data, text }
 */
export function saveReport(root, specPath, reportData) {
  const specDir = path.dirname(path.resolve(root, specPath));
  const reportPath = path.join(specDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2) + "\n");
}
