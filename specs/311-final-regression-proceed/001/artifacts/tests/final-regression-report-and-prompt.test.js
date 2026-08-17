// spec: R4 R7 R8 R10
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateReport } from "../../../src/flow/commands/report.js";
import GetStatusCommand from "../../../src/flow/lib/get-status.js";
import RunReportCommand from "../../../src/flow/lib/run-report.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";

function reportInput() {
  return {
    state: {
      spec: "specs/001-record-proceed/spec.md",
      steps: [],
      metrics: [],
      tasks: [],
    },
    results: {
      finalRegression: {
        result: "fail",
        completed: true,
        failureKind: "unattributed_existing_failure",
        failureCategory: "existing_failure",
        rawOutputPath: "specs/001-record-proceed/tests/.raw/final-regression-attempt-002.log",
        fixAttempts: 1,
        selectedAction: "record-and-proceed",
        remainingRisk: "full regression remains red for an existing failure",
        nextAction: "report",
        nextRecommendedAction: "record-and-proceed",
      },
    },
    issueLog: { entries: [] },
    implDiffStat: null,
    commitMessages: [],
  };
}

function failedRecordedArtifact() {
  return {
    version: "1",
    completed: true,
    result: "fail",
    failureKind: "unattributed_existing_failure",
    failureCategory: "existing_failure",
    failureNature: "assertion",
    command: "npm test --",
    commandSource: "package.json",
    rawOutputPath: "specs/001-record-proceed/tests/.raw/final-regression-attempt-002.log",
    rawOutputLines: { start_line: 1, end_line: 4 },
    process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
    changedFiles: [],
    changedFileFingerprints: [],
    commandIdentity: {
      command: "npm test --",
      commandSource: "package.json",
      argv: ["npm", "test", "--"],
      env: {},
      source: "config",
      metadata: {},
      resolvedScriptDigest: null,
      resolvedConfigDigest: null,
    },
    recordAndProceed: {
      eligible: true,
      validated: true,
      evidence: "existing failure remained after an attempted repair",
    },
    selectedAction: "record-and-proceed",
    remainingRisk: "full regression remains red for an existing failure",
    fixAttempts: 1,
    retryable: false,
    nextAction: "report",
    nextRecommendedAction: "record-and-proceed",
    failureSummary: "existing failure",
    humanSummary: "result=fail failureCategory=existing_failure selectedAction=record-and-proceed",
  };
}

describe("Issue 403 final-regression report and prompt behavior", () => {
  test("R4: report JSON preserves selected action, remaining risk, and next recommended action", () => {
    const { data } = generateReport(reportInput());
    const finalRegression = data.tests.finalRegression;

    assert.equal(finalRegression.result, "fail");
    assert.equal(finalRegression.selectedAction, "record-and-proceed");
    assert.equal(finalRegression.remainingRisk, "full regression remains red for an existing failure");
    assert.equal(finalRegression.nextAction, "report");
    assert.equal(finalRegression.nextRecommendedAction, "record-and-proceed");
  });

  test("R4: final report data is assembled from the persisted failed-recorded artifact", async () => {
    const tmp = createTmpDir("spec-311-r4-report-artifact-");
    try {
      writeFile(tmp, "specs/001-record-proceed/spec.json", JSON.stringify({ requirements: [] }, null, 2));
      writeFile(tmp, "specs/001-record-proceed/final-regression-result.json", JSON.stringify(failedRecordedArtifact(), null, 2));
      initGitRepo(tmp);
      commitAll(tmp, "initial");

      const result = await new RunReportCommand().execute({
        root: tmp,
        dryRun: true,
        flowState: {
          spec: "specs/001-record-proceed/spec.json",
          baseBranch: "main",
          featureBranch: "feature/001-record-proceed",
          steps: [],
          metrics: [],
          tasks: [],
        },
      });
      const finalRegression = result.artifacts.report.data.tests.finalRegression;

      assert.equal(finalRegression.result, "fail");
      assert.equal(finalRegression.selectedAction, "record-and-proceed");
      assert.equal(finalRegression.remainingRisk, "full regression remains red for an existing failure");
      assert.equal(finalRegression.nextAction, "report");
      assert.equal(finalRegression.nextRecommendedAction, "record-and-proceed");
    } finally {
      removeTmpDir(tmp);
    }
  });

  test("R7: final-regression prompt documents fixAttempts recommendations and auto selection", () => {
    const prompt = fs.readFileSync("src/flow/prompts/impl/final-regression.md", "utf8");

    assert.match(prompt, /fixAttempts/);
    assert.match(prompt, /fix-and-rerun/);
    assert.match(prompt, /record-and-proceed/);
    assert.match(prompt, /auto(?:Approve| mode).*recommended action/i);
  });

  test("R8: report text displays failed-recorded as non-pass with category, raw log, risk, selected action, and recommendation", () => {
    const { data, text } = generateReport(reportInput());
    const finalRegression = data.tests.finalRegression;

    assert.equal(finalRegression.result, "fail");
    assert.equal(finalRegression.failureCategory, "existing_failure");
    assert.equal(finalRegression.rawOutputPath, "specs/001-record-proceed/tests/.raw/final-regression-attempt-002.log");
    assert.equal(finalRegression.fixAttempts, 1);
    assert.equal(finalRegression.selectedAction, "record-and-proceed");
    assert.equal(finalRegression.nextRecommendedAction, "record-and-proceed");
    assert.equal(finalRegression.remainingRisk, "full regression remains red for an existing failure");
    assert.match(finalRegression.humanSummary, /result=fail/);
    assert.match(finalRegression.humanSummary, /failureCategory=existing_failure/);
    assert.match(finalRegression.humanSummary, /selectedAction=record-and-proceed/);

    assert.match(text, /Final regression: result=fail/);
    assert.match(text, /failureCategory=existing_failure/);
    assert.match(text, /raw_output=.*final-regression-attempt-002\.log/);
    assert.match(text, /fixAttempts=1/);
    assert.match(text, /selectedAction=record-and-proceed/);
    assert.match(text, /nextRecommendedAction=record-and-proceed/);
    assert.match(text, /remainingRisk=full regression remains red/);
    assert.doesNotMatch(text, /Final regression: result=pass/);
    assert.doesNotMatch(text, /Final regression: result=skipped/);
  });

  test("R8: status data displays failed-recorded as non-pass with required details", () => {
    const tmp = createTmpDir("spec-311-r8-status-");
    try {
      writeFile(tmp, "specs/001-record-proceed/spec.json", JSON.stringify({
        requirements: [],
      }, null, 2));
      writeFile(tmp, "specs/001-record-proceed/final-regression-result.json", JSON.stringify({
        ...failedRecordedArtifact(),
        rawOutputPath: "specs/001-record-proceed/tests/.raw/final-regression-attempt-002.log",
        fixAttempts: 1,
        selectedAction: "record-and-proceed",
        remainingRisk: "full regression remains red for an existing failure",
        nextAction: "report",
        nextRecommendedAction: "record-and-proceed",
      }, null, 2));

      const status = new GetStatusCommand().execute({
        root: tmp,
        details: true,
        flowState: {
          spec: "specs/001-record-proceed/spec.json",
          baseBranch: "main",
          featureBranch: "feature/001-record-proceed",
          steps: [],
          metrics: [],
        },
      });

      assert.equal(status.finalRegression.result, "fail");
      assert.equal(status.finalRegression.failureCategory, "existing_failure");
      assert.equal(status.finalRegression.rawOutputPath, "specs/001-record-proceed/tests/.raw/final-regression-attempt-002.log");
      assert.equal(status.finalRegression.fixAttempts, 1);
      assert.equal(status.finalRegression.selectedAction, "record-and-proceed");
      assert.equal(status.finalRegression.nextRecommendedAction, "record-and-proceed");
      assert.equal(status.finalRegression.remainingRisk, "full regression remains red for an existing failure");
      assert.notEqual(status.finalRegression.result, "pass");
      assert.notEqual(status.finalRegression.result, "skipped");
    } finally {
      removeTmpDir(tmp);
    }
  });

  test("R8: report command loads failed-recorded artifact into report JSON and human text", async () => {
    const tmp = createTmpDir("spec-311-r8-report-artifact-");
    try {
      writeFile(tmp, "specs/001-record-proceed/spec.json", JSON.stringify({ requirements: [] }, null, 2));
      writeFile(tmp, "specs/001-record-proceed/final-regression-result.json", JSON.stringify(failedRecordedArtifact(), null, 2));
      initGitRepo(tmp);
      commitAll(tmp, "initial");

      const result = await new RunReportCommand().execute({
        root: tmp,
        dryRun: true,
        flowState: {
          spec: "specs/001-record-proceed/spec.json",
          baseBranch: "main",
          featureBranch: "feature/001-record-proceed",
          steps: [],
          metrics: [],
          tasks: [],
        },
      });
      const report = result.artifacts.report;
      const finalRegression = report.data.tests.finalRegression;

      assert.equal(finalRegression.result, "fail");
      assert.equal(finalRegression.failureCategory, "existing_failure");
      assert.equal(finalRegression.rawOutputPath, "specs/001-record-proceed/tests/.raw/final-regression-attempt-002.log");
      assert.equal(finalRegression.fixAttempts, 1);
      assert.equal(finalRegression.remainingRisk, "full regression remains red for an existing failure");
      assert.equal(finalRegression.selectedAction, "record-and-proceed");
      assert.equal(finalRegression.nextRecommendedAction, "record-and-proceed");
      assert.match(report.text, /Final regression: result=fail/);
      assert.match(report.text, /failureCategory=existing_failure/);
      assert.match(report.text, /selectedAction=record-and-proceed/);
      assert.doesNotMatch(report.text, /Final regression: result=pass/);
    } finally {
      removeTmpDir(tmp);
    }
  });

  test("R10: this spec-local file declares coverage headers and R-prefixed tests for display and prompt behavior", () => {
    const source = fs.readFileSync(new URL(import.meta.url), "utf8");

    for (const id of ["R4", "R7", "R8", "R10"]) {
      assert.match(source, new RegExp(`^// spec: .*\\b${id}\\b`, "m"));
      assert.match(source, new RegExp(`test\\("${id}:`));
    }
  });
});
