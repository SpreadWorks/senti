// spec: R5
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runImplReview } from "../../../src/flow/commands/review.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { targetMismatchEnvelopeForInput } from "../../../src/lib/flow-target-guard.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { reviewMetricPayload } from "./fixture-assertions.js";

function finding(kind) {
  return {
    title: `${kind} finding`,
    failureMode: kind === "blocking" ? "spec_behavior_contradiction" : "refactor",
    file: "src/example.js",
    requirementId: "R5",
    issue: "Observable requirement-scoped issue.",
    suggestion: "Replace the affected branch.",
    rationale: "Valid known-ID finding.",
  };
}

function reviewOutput(verdict) {
  return JSON.stringify({
    blockingFindings: verdict === "FAIL" ? [finding("blocking")] : [],
    nonBlockingImprovements: verdict === "ADVISORY" ? [finding("advisory")] : [],
  });
}

function stateAtImplReview(specId, runId) {
  const steps = buildInitialSteps();
  let beforeReview = true;
  for (const step of flattenSteps(steps)) {
    if (Array.isArray(step.children)) {
      step.status = "pending";
      continue;
    }
    if (step.id === "impl-review") {
      step.status = "in_progress";
      beforeReview = false;
    } else {
      step.status = beforeReview ? "done" : "pending";
    }
  }
  findStepById(steps, "plan").status = "done";
  return {
    spec: `specs/${specId}/spec.json`,
    runId,
    issue: 437,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    steps,
    metrics: [],
    requirements: [],
    tasks: [],
    currentTaskId: null,
  };
}

function guardedNextAction(root, runId, specId) {
  const flowManager = makeFlowManager(root).forRoot(root, { specId });
  const flowState = flowManager.load(specId);
  const input = {
    expectRunId: runId,
    expectIssue: 437,
    expectSpec: specId,
  };
  assert.equal(targetMismatchEnvelopeForInput({
    type: "get",
    key: "next-action",
    input,
    flowState,
  }), null);
  return new GetNextActionCommand().execute({ root, flowState, flowManager });
}

async function executeLifecycle(verdict) {
  const root = createTmpDir();
  const specId = `001-${verdict.toLowerCase()}`;
  const runId = `${verdict.toLowerCase()}-run`;
  const specDir = path.join(root, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    requirements: [{ id: "R5", desc: "Lifecycle", priority: "must", status: "pending" }],
  }));
  const state = stateAtImplReview(specId, runId);
  const manager = makeFlowManager(root);
  manager.create(state);
  manager.addActiveFlow(specId, "local");

  const result = await runImplReview({
    root,
    flow: state,
    reviewOutput: reviewOutput(verdict),
    touchedFiles: new Set(["src/example.js"]),
  });
  await FLOW_COMMANDS.run.review.post({
    phase: null,
    root,
    flowState: state,
    flowManager: manager,
  }, result);
  return { root, specId, runId, specDir, result, state: manager.load() };
}

describe("valid impl-review lifecycle", () => {
  it("R5: preserves FAIL, ADVISORY, and PASS artifacts, counters, and routing", async () => {
    const executions = [];
    try {
      for (const verdict of ["FAIL", "ADVISORY", "PASS"]) {
        const execution = await executeLifecycle(verdict);
        executions.push(execution);
        const metric = execution.state.metrics.at(-1);
        assert.equal(metric.taskId, null);
        assert.equal(typeof metric.ts, "string");
        assert.equal(execution.result.artifacts.verdict, verdict);
        assert.equal(fs.existsSync(path.join(execution.specDir, "review.md")), true);
        assert.equal(fs.existsSync(path.join(execution.specDir, "impl-review.json")), true);

        if (verdict === "FAIL") {
          assert.equal(findStepById(execution.state.steps, "impl-review").status, "in_progress");
          assert.deepEqual(reviewMetricPayload(metric), { phase: "impl", counter: "reviewRetry", delta: 1 });
          assert.equal((await guardedNextAction(execution.root, execution.runId, execution.specId)).step, "impl-review");
        } else {
          assert.equal(findStepById(execution.state.steps, "impl-review").status, "done");
          assert.deepEqual(reviewMetricPayload(metric), { phase: "impl", counter: "reviewRetry", delta: 0, reset: true });
          assert.equal((await guardedNextAction(execution.root, execution.runId, execution.specId)).step, "impl-gate");
        }
      }
    } finally {
      for (const execution of executions) removeTmpDir(execution.root);
    }
  });
});
