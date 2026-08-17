// spec: R4 R15 R20
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";

const repoRoot = path.resolve(import.meta.dirname, "../../../");
const cleanupPath = path.join(repoRoot, "src/flow/lib/run-finalize-cleanup.js");
const reportShowPath = path.join(repoRoot, "src/flow/lib/run-report-show.js");

function readFileText(p) {
  return fs.readFileSync(p, "utf8");
}

test("R4: cleanup return value contains data.report.path and data.report.text", () => {
  const text = readFileText(cleanupPath);
  // Returns object with report.path / report.text fields
  assert.match(
    text,
    /report\s*:\s*\{[\s\S]*path[\s\S]*text|report\.path[\s\S]*report\.text|\{\s*path[\s\S]*text\s*:/s,
    "cleanup must return data.report = { path, text }",
  );
});

test("R4: cleanup uses Envelope.addWarning('REPORT_MISSING', ...) on report missing", () => {
  const text = readFileText(cleanupPath);
  assert.match(
    text,
    /addWarning.*REPORT_MISSING|REPORT_MISSING.*addWarning|Envelope\.warn.*REPORT_MISSING/s,
    "cleanup must use Envelope.addWarning('REPORT_MISSING', ...) when report is unavailable",
  );
});

test("R4: cleanup data.nextCommand field is removed (envelope no longer guides AI to run report show)", () => {
  const text = readFileText(cleanupPath);
  // The legacy nextCommand field must no longer be returned from cleanup
  assert.doesNotMatch(
    text,
    /nextCommand\s*:\s*REPORT_SHOW_COMMAND|"nextCommand"\s*:\s*REPORT_SHOW_COMMAND/,
    "cleanup must no longer return nextCommand: REPORT_SHOW_COMMAND",
  );
});

test("R15: run-report-show.js exposes shared helper that cleanup imports", () => {
  const reportShowText = readFileText(reportShowPath);
  const cleanupText = readFileText(cleanupPath);
  // Some helper (resolveLatestReportPath or similar) is exported
  assert.match(
    reportShowText,
    /export\s+(function|const|async)\s+(resolveLatestReportPath|readReportText|resolveReport|loadReport|renderReport)/,
    "run-report-show.js must export at least one report resolution helper",
  );
  // cleanup imports from run-report-show.js
  assert.match(
    cleanupText,
    /from\s+["'].*run-report-show(\.js)?["']|require\(.*run-report-show/,
    "cleanup must import the shared helper from run-report-show.js",
  );
});

test("R20: cleanup envelope warning path returns Envelope or dispatcher injects warning", () => {
  const text = readFileText(cleanupPath);
  // Either return Envelope directly, or dispatcher contract handles warning
  const returnsEnvelope = /Envelope\.(ok|warn)|new\s+Envelope\(|return\s+envelope/i.test(text);
  const usesAddWarning = /addWarning/i.test(text);
  assert.ok(
    returnsEnvelope || usesAddWarning,
    "cleanup must support warning injection either by returning Envelope or via addWarning",
  );
});
