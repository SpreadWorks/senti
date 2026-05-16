// spec: R17 R18 R25 R37
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertContains, read } from "./helpers.js";

describe("spec 257: report, finalize, retro, and legacy summary behavior", () => {
  it("R17: all report consumers expose projectRegression and fail on invalid present artifacts", () => {
    for (const relPath of [
      "src/flow/lib/run-report.js",
      "src/flow/commands/report.js",
      "src/flow/lib/run-report-show.js",
      "src/flow/lib/run-finalize.js",
      "src/flow/lib/run-finalize-cleanup.js",
    ]) {
      assertContains(relPath, /projectRegression|Project regression|regression/i, "must render or preserve project regression report data");
      assertContains(relPath, /test-execute-result\.json|test-result-review\.json|v2|version/i, "must consume v2 test artifacts");
      assertContains(relPath, /throw|Envelope\.fail|ok:\s*false|fail/i, "invalid present artifacts must not be silently ignored");
    }
  });

  it("R18: retro consumes v2 summary ranges and excludes project regression from requirement totals", () => {
    const src = read("src/flow/lib/run-retro.js");
    assert.match(src, /summary/i, "retro must still aggregate summary[]");
    assert.match(src, /start_line|end_line|raw_output_lines/i, "retro must accept v2 raw_output_lines range objects");
    assert.doesNotMatch(src, /projectRegression[\s\S]{0,160}totals|regression[\s\S]{0,160}requirement/i, "project regression must not be mixed into requirement totals");
  });

  it("R25: finalize stages durable evidence only and does not downgrade invalid v2 report failures", () => {
    const finalize = read("src/flow/lib/run-finalize.js");
    const commit = read("src/flow/lib/run-finalize-commit.js");
    const cleanup = read("src/flow/lib/run-finalize-cleanup.js");
    assert.match(finalize, /executeCommitPost|report/i, "finalize must run report/commit post flow");
    assert.match(commit, /test-execution\.log|tests\/\.raw/i, "finalize commit must include durable raw evidence");
    assert.match(commit, /exclude|pathspec|summary/i, "finalize commit must exclude temporary summary artifacts");
    assert.match(`${finalize}\n${cleanup}`, /throw|Envelope\.fail|ok:\s*false|fail/i, "invalid v2 artifact/report failures must remain blocking");
    assert.match(cleanup, /report-show|run-report-show|report/i, "cleanup envelope must use the same report-show/report data path");
  });

  it("R37: legacy state.test.summary cannot remain authoritative for v2 results", () => {
    const src = read("src/lib/flow-store.js");
    assert.doesNotMatch(src, /setTestSummary\s*\(/, "legacy setTestSummary must be removed or quarantined away from v2 authority");
    assert.doesNotMatch(src, /aggregateTaskSummaryIntoParent\s*\(/, "legacy task summary aggregation must not remain authoritative");
    assert.doesNotMatch(src, /state\.test\.summary[\s\S]{0,160}=|summary[\s\S]{0,80}state\.test/i, "flow state summary must not overwrite v2 artifact results");
  });
});
