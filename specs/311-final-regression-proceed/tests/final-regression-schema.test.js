// spec: R2 R5 R6 R10
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";

function baseFailedRecorded(overrides = {}) {
  return {
    version: "1",
    completed: true,
    result: "fail",
    failureKind: "unattributed_existing_failure",
    failureCategory: "existing_failure",
    failureNature: "assertion",
    command: "npm test --",
    commandSource: "package.json",
    rawOutputPath: "specs/001/tests/.raw/final-regression-attempt-002.log",
    rawOutputLines: { start_line: 1, end_line: 4 },
    process: {
      started: true,
      exitCode: 1,
      signal: null,
      timedOut: false,
      spawnError: null,
    },
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
    nextAction: "finalize-commit",
    nextRecommendedAction: "record-and-proceed",
    failureSummary: "existing failure",
    ...overrides,
  };
}

describe("Issue 403 final-regression artifact schema", () => {
  test("R2: schema rejects ordinary failed artifacts marked complete without validated record-and-proceed evidence", () => {
    assert.throws(() => validateFinalRegressionResult(baseFailedRecorded({
      recordAndProceed: { eligible: true, validated: false, evidence: "" },
    })), /record-and-proceed evidence/i);
  });

  test("R5: schema accepts failed-recorded artifacts while preserving result fail", () => {
    const artifact = validateFinalRegressionResult(baseFailedRecorded());

    assert.equal(artifact.result, "fail");
    assert.equal(artifact.completed, true);
    assert.equal(artifact.selectedAction, "record-and-proceed");
  });

  test("R6: schema rejects invalid failed-recorded action combinations", () => {
    assert.throws(() => validateFinalRegressionResult(baseFailedRecorded({
      nextRecommendedAction: "finalize-commit",
    })), /nextRecommendedAction/i);
    assert.throws(() => validateFinalRegressionResult(baseFailedRecorded({
      nextAction: "user-confirmation",
    })), /nextAction/i);
  });

  test("R10: schema rejects missing evidence, invalid recommendations, and ordinary fail completion", () => {
    assert.throws(() => validateFinalRegressionResult(baseFailedRecorded({
      recordAndProceed: { eligible: true, validated: true, evidence: "" },
    })), /evidence/i);
    assert.throws(() => validateFinalRegressionResult(baseFailedRecorded({
      nextRecommendedAction: "retry-later",
    })), /nextRecommendedAction/i);
    assert.throws(() => validateFinalRegressionResult(baseFailedRecorded({
      completed: true,
      selectedAction: "fix-and-rerun",
      nextAction: "regression-repair",
    })), /completed/i);
  });
});
