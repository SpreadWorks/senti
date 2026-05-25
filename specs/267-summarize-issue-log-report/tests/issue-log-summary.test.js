// spec: R1 R2 R3 R4 R5 R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { generateReport } from "../../../src/flow/commands/report.js";
import { loadIssueLog, saveIssueLog } from "../../../src/flow/lib/set-issue-log.js";
import { readReportText } from "../../../src/flow/lib/run-report-show.js";

function entry(step, reason, extra = {}) {
  return { step, reason, ...extra };
}

function buildReport(entries) {
  return generateReport({
    state: {
      spec: "specs/267-summarize-issue-log-report/spec.json",
      metrics: [],
      tasks: [],
    },
    results: {},
    issueLog: { entries },
    implDiffStat: "",
    commitMessages: [],
  });
}

function issueLogRelatedLines(text) {
  return text
    .split("\n")
    .filter((line) => /Issue Log|Full issue log|Important|Recent Other|omitted|more/.test(line))
    .join("\n");
}

describe("issue-log summary report", () => {
  it("R1: records total count and full issue-log artifact path", () => {
    const { data, text } = buildReport([
      entry("implement", "first ordinary note"),
      entry("review", "blocked on review detail"),
    ]);

    assert.equal(data.issueLog.count, 2);
    assert.equal(data.issueLog.fullLogPath, "specs/267-summarize-issue-log-report/issue-log.json");
    assert.match(text, /Full issue log: specs\/267-summarize-issue-log-report\/issue-log\.json/);
  });

  it("R2: classifies important entries by field keywords and failure-origin rules", () => {
    const fieldMatchReport = buildReport([
      entry("FORCED-cleanup", "ordinary context"),
      entry("implement", "ordinary level", { level: "child-error" }),
      entry("draft", "used workaround for invalid metric phase"),
      entry("review", "needs another look", { status: "blocked" }),
      entry("implement", "ordinary trigger", { trigger: "ERROR from hook" }),
      entry("implement", "ordinary resolution", { resolution: "Recovered after retry" }),
      entry("implement", "ordinary guardrail", { guardrailCandidate: "Blocked retry must be recorded" }),
      entry("implement", "ordinary result", { result: "ERROR" }),
      entry("implement", "ordinary failure kind", { failureKind: "failed_by_tool" }),
    ]);

    const fieldImportantReasons = fieldMatchReport.data.issueLog.entries
      .filter((item) => item.classification === "important")
      .map((item) => item.reason);
    assert.deepEqual(fieldImportantReasons, [
      "ordinary context",
      "ordinary level",
      "used workaround for invalid metric phase",
      "needs another look",
      "ordinary trigger",
      "ordinary resolution",
      "ordinary guardrail",
      "ordinary result",
      "ordinary failure kind",
    ]);

    const failureOriginReport = buildReport([
      entry("gate", "guardrail detail without failure word", { level: "parent-fail", phase: "spec" }),
      entry("final-regression", "final-regression failed: caused_by_current_change", { failureKind: "caused_by_current_change" }),
    ]);
    assert.deepEqual(
      failureOriginReport.data.issueLog.entries.map((item) => item.reason),
      ["guardrail detail without failure word", "final-regression failed: caused_by_current_change"],
    );
  });

  it("R3: stores only important entries up to 10 and recent other entries up to 5", () => {
    const entries = [];
    for (let i = 0; i < 12; i += 1) {
      entries.push(entry("gate", `gate detail ${i}`, { level: "parent-fail" }));
    }
    for (let i = 0; i < 8; i += 1) {
      entries.push(entry("implement", `ordinary ${i}`));
    }

    const { data } = buildReport(entries);

    assert.equal(data.issueLog.count, 20);
    assert.equal(data.issueLog.importantTotal, 12);
    assert.equal(data.issueLog.importantOmitted, 2);
    assert.equal(data.issueLog.recentOtherTotal, 8);
    assert.equal(data.issueLog.recentOtherOmitted, 3);
    assert.equal(data.issueLog.entries.length, 15);
    assert.deepEqual(
      data.issueLog.entries.filter((item) => item.classification === "recent-other").map((item) => item.reason),
      ["ordinary 3", "ordinary 4", "ordinary 5", "ordinary 6", "ordinary 7"],
    );
  });

  it("R4: renders summary sections and omitted counts", () => {
    const entries = [];
    for (let i = 0; i < 11; i += 1) {
      entries.push(entry("review", `review fail ${i}`));
    }
    for (let i = 0; i < 7; i += 1) {
      entries.push(entry("implement", `ordinary note ${i}`));
    }

    const { text } = buildReport(entries);

    assert.match(text, /Issue Log Summary \(18 total\)/);
    assert.match(text, /Important \(10 of 11\)/);
    assert.match(text, /\.\.\. 1 important issue-log entry omitted/);
    assert.match(text, /Recent Other \(5 of 7\)/);
    assert.match(text, /\.\.\. 2 other issue-log entries omitted/);
  });

  it("R5: handles zero, one, and two entries without omitted-count text", () => {
    const empty = buildReport([]);
    assert.doesNotMatch(empty.text, /Issue Log Summary/);

    const one = buildReport([entry("implement", "ordinary one")]);
    assert.match(one.text, /Issue Log Summary \(1 total\)/);
    assert.doesNotMatch(issueLogRelatedLines(one.text), /omitted|more/);

    const two = buildReport([
      entry("implement", "ordinary one"),
      entry("review", "review failed", { result: "fail" }),
    ]);
    assert.match(two.text, /Issue Log Summary \(2 total\)/);
    assert.doesNotMatch(issueLogRelatedLines(two.text), /omitted|more/);
  });

  it("R6: preserves issue-log load and save format", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "issue-log-storage-"));
    try {
      const specPath = "specs/demo/spec.json";
      const issueLog = {
        entries: [
          entry("implement", "ordinary one"),
          entry("gate", "gate detail", { level: "parent-fail", observations: [{ observed: "detail" }] }),
        ],
      };

      saveIssueLog(root, specPath, issueLog);
      const stored = JSON.parse(fs.readFileSync(path.join(root, "specs/demo/issue-log.json"), "utf8"));
      assert.deepEqual(stored, issueLog);
      assert.deepEqual(loadIssueLog(root, specPath), issueLog);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("R6: leaves full issue-log input untouched and keeps cleanup display on report text", () => {
    const issueLog = {
      entries: [
        entry("implement", "ordinary one"),
        entry("gate", "gate detail", { level: "parent-fail", observations: [{ observed: "detail" }] }),
      ],
    };

    const { data } = generateReport({
      state: {
        spec: "specs/267-summarize-issue-log-report/spec.json",
        metrics: [],
        tasks: [],
      },
      results: {},
      issueLog,
      implDiffStat: "",
      commitMessages: [],
    });

    assert.equal(issueLog.entries.length, 2);
    assert.equal(issueLog.entries[1].observations.length, 1);
    assert.equal(data.issueLog.entries.some((item) => Array.isArray(item.observations)), false);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-display-"));
    try {
      const reportPath = path.join(root, "report.json");
      fs.writeFileSync(reportPath, JSON.stringify({ text: "  Report\n\n  Issue Log Summary (1 total)\n" }));
      assert.equal(readReportText(reportPath), "  Report\n\n  Issue Log Summary (1 total)\n");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
