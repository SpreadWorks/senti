// spec: R2 R3 R4 R7
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  classifyReviewCommandError,
  parseImplReviewFindings,
  runImplReview,
} from "../../../src/flow/commands/review.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { ReviewFailure } from "../../../src/flow/lib/review-failure.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import {
  runCmdWithRetry,
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";

function invalidOutput(requirementId = "R404") {
  return JSON.stringify({
    blockingFindings: [],
    nonBlockingImprovements: [{
      title: "Unknown requirement",
      failureMode: "refactor",
      file: "src/example.js",
      requirementId,
      issue: "The finding references an unknown requirement.",
      suggestion: "Use a target-spec requirement ID.",
      rationale: "The output contract requires a known ID.",
    }],
  });
}

async function executeSchemaFailureRetries() {
  let calls = 0;
  let validationError = null;
  const maximumAttempts = 3;
  const result = await runCmdWithRetry(() => {
    calls += 1;
    let failure;
    try {
      parseImplReviewFindings(invalidOutput(), { requirementIds: new Set(["R3"]) });
      throw new Error("invalid impl-review output unexpectedly passed validation");
    } catch (err) {
      failure = classifyReviewCommandError(err, null);
    }
    assert.equal(failure?.classification, "schema_failure");
    validationError ||= failure.validationError;
    return {
      ok: false,
      status: 1,
      stdout: "",
      stderr: failure.toMarkerLine(),
      signal: null,
      killed: false,
    };
  }, { phase: "impl", retryCount: 2, retryDelayMs: 0 });
  return {
    calls,
    maximumAttempts,
    validationError,
    failure: ReviewFailure.fromSubprocessResult({ phase: "impl", result }),
  };
}

describe("impl-review schema tooling failure", () => {
  it("R2: rejects an unknown ID before out-of-scope filtering or artifact writes", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-impl-ordering-"));
    const specDir = path.join(root, "specs/demo");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
      requirements: [{ id: "R2", desc: "Known requirement", priority: "must", status: "pending" }],
    }));
    try {
      await assert.rejects(
        runImplReview({
          root,
          flow: { spec: "specs/demo/spec.json" },
          reviewOutput: invalidOutput(),
          touchedFiles: new Set(),
        }),
        /requirementId|schema/i,
      );
      assert.equal(fs.existsSync(path.join(specDir, "review.md")), false);
      assert.equal(fs.existsSync(path.join(specDir, "impl-review.json")), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("R3: retries schema failure within bounds and preserves five diagnostics", async () => {
    const { calls, maximumAttempts, validationError, failure } = await executeSchemaFailureRetries();
    assert.equal(calls, maximumAttempts);
    assert.deepEqual(failure.toEnvelopeData(), {
      phase: "impl",
      classification: "schema_failure",
      reason: "impl-review output schema validation failed",
      retryBudgetConsumed: false,
      targetReview: "impl-review",
      validationError,
      currentAttempt: 3,
      maximumAttempts: 3,
    });
  });

  it("R7: bounds repeated schema failure at exactly three flow-side attempts", async () => {
    const { calls, maximumAttempts, failure } = await executeSchemaFailureRetries();
    assert.equal(calls, 3);
    assert.equal(maximumAttempts, 3);
    assert.equal(failure.classification, "schema_failure");
    assert.equal(failure.currentAttempt, failure.maximumAttempts);
  });

  it("R4: leaves artifacts and semantic retry state unchanged", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-impl-schema-"));
    const specDir = path.join(root, "specs/demo");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
      requirements: [{ id: "R4", desc: "Known requirement", priority: "must", status: "pending" }],
    }));
    fs.writeFileSync(path.join(specDir, "review.md"), "previous review\n");
    fs.writeFileSync(path.join(specDir, "impl-review.json"), "{\"previous\":true}\n");

    try {
      await assert.rejects(
        runImplReview({
          root,
          flow: { spec: "specs/demo/spec.json" },
          reviewOutput: invalidOutput(),
          touchedFiles: new Set(["src/example.js"]),
        }),
        /requirementId|schema/i,
      );
      assert.equal(fs.readFileSync(path.join(specDir, "review.md"), "utf8"), "previous review\n");
      assert.equal(fs.readFileSync(path.join(specDir, "impl-review.json"), "utf8"), "{\"previous\":true}\n");

      const metrics = [];
      updateReviewRetryCounter({
        phase: null,
        flowState: {},
        flowManager: { appendMetric(payload) { metrics.push(payload); } },
      }, {
        result: "tooling-failure",
        artifacts: { phase: "impl", verdict: "TOOLING_FAILURE", failureKind: "schema_failure" },
      });
      assert.deepEqual(metrics, []);

      const steps = buildInitialSteps();
      for (const step of flattenSteps(steps)) step.status = "pending";
      findStepById(steps, "impl-review").status = "in_progress";
      const state = {
        spec: "specs/demo/spec.json",
        runId: "schema-failure-run",
        issue: 437,
        baseBranch: "main",
        featureBranch: "feature/schema-failure",
        steps,
        metrics: [],
        requirements: [],
        tasks: [],
        currentTaskId: null,
      };
      const manager = makeFlowManager(root);
      manager.create(state);
      manager.addActiveFlow("demo", "local");
      const toolingResult = {
        result: "tooling-failure",
        changed: [],
        artifacts: {
          phase: "impl",
          verdict: "TOOLING_FAILURE",
          failureKind: "schema_failure",
        },
        next: null,
      };
      await FLOW_COMMANDS.run.review.post({
        phase: null,
        root,
        flowState: state,
        flowManager: manager,
      }, toolingResult);

      const afterPost = manager.load();
      assert.equal(findStepById(afterPost.steps, "impl-review").status, "in_progress");
      assert.equal(findStepById(afterPost.steps, "impl-gate").status, "pending");
      assert.deepEqual(afterPost.metrics, []);
      assert.equal(fs.existsSync(path.join(specDir, "flow-findings.json")), false);
      assert.equal(["PASS", "ADVISORY", "FAIL"].includes(toolingResult.artifacts.verdict), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
