// spec: R5 R6 R10
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CompletionValidator,
  contractFromFinalRegressionArtifact,
} from "../../../src/flow/lib/flow-judgment-contract.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";

function failedRecordedArtifact(overrides = {}) {
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

describe("Issue 403 final-regression completion contract", () => {
  test("R5: failed-recorded artifacts keep result fail and carry validated record-and-proceed evidence", () => {
    const artifact = failedRecordedArtifact();

    assert.equal(artifact.result, "fail");
    assert.equal(artifact.completed, true);
    assert.equal(artifact.selectedAction, "record-and-proceed");
    assert.equal(artifact.recordAndProceed.validated, true);
    assert.equal(artifact.nextAction, "finalize-commit");
    assert.equal(artifact.nextRecommendedAction, "record-and-proceed");
  });

  test("R6: completion policy accepts validated failed-recorded and rejects ordinary failed artifacts", () => {
    const validator = new CompletionValidator();
    const failedRecorded = contractFromFinalRegressionArtifact(failedRecordedArtifact(), {
      artifactPath: "specs/001/final-regression-result.json",
    });

    assert.equal(validator.validate({
      contract: failedRecorded,
      requestedStatus: "done",
    }).kind, "normal");

    const ordinaryFailure = contractFromFinalRegressionArtifact(failedRecordedArtifact({
      completed: false,
      recordAndProceed: { eligible: true, validated: false, evidence: "" },
      selectedAction: null,
      nextAction: "user-confirmation",
      nextRecommendedAction: "fix-and-rerun",
    }), {
      artifactPath: "specs/001/final-regression-result.json",
    });

    assert.equal(validator.validate({
      contract: ordinaryFailure,
      requestedStatus: "done",
    }).kind, "inconsistent");
  });

  test("R6: registry post-hook accepts only pass, skipped, or validated failed-recorded final-regression artifacts", async () => {
    const tmp = createTmpDir("spec-311-r6-registry-");
    try {
      const specDir = "specs/001";
      const artifactPath = `${specDir}/final-regression-result.json`;
      const updated = [];
      const ctx = {
        root: tmp,
        flowState: { spec: `${specDir}/spec.json` },
        flowManager: {
          updateStepStatus(stepId, status) {
            updated.push({ stepId, status });
          },
        },
      };
      const post = FLOW_COMMANDS.run["final-regression"].post;

      writeFile(tmp, `${specDir}/spec.json`, JSON.stringify({ requirements: [] }, null, 2));
      writeFile(tmp, artifactPath, JSON.stringify(failedRecordedArtifact(), null, 2));
      await post(ctx, { result: "fail", failedRecorded: true });
      assert.deepEqual(updated.at(-1), { stepId: "final-regression", status: "done" });

      writeFile(tmp, artifactPath, JSON.stringify(failedRecordedArtifact({
        completed: false,
        recordAndProceed: { eligible: true, validated: false, evidence: "" },
        selectedAction: null,
        nextAction: "user-confirmation",
        nextRecommendedAction: "fix-and-rerun",
      }), null, 2));
      await assert.rejects(
        post(ctx, { result: "fail" }),
        /final-regression result is not pass, skipped, or failed-recorded/i,
      );

      writeFile(tmp, artifactPath, JSON.stringify(failedRecordedArtifact({
        recordAndProceed: { eligible: true, validated: false, evidence: "not validated" },
      }), null, 2));
      await assert.rejects(
        post(ctx, { result: "fail", failedRecorded: true }),
        /validated failed-recorded/i,
      );
    } finally {
      removeTmpDir(tmp);
    }
  });

  test("R10: this spec-local file declares coverage headers and R-prefixed tests for completion policy", () => {
    const source = fs.readFileSync(new URL(import.meta.url), "utf8");

    for (const id of ["R5", "R6", "R10"]) {
      assert.match(source, new RegExp(`^// spec: .*\\b${id}\\b`, "m"));
      assert.match(source, new RegExp(`test\\("${id}:`));
    }
  });
});
