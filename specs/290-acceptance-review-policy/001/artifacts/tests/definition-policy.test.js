// spec: R1 R2 R3 R13 R14 R16
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FlowNode,
  collectGatePhaseEntries,
  deriveNextAction,
  getFlowBranchLeafIds,
  getFlowNode,
  getTaskNode,
  resolveLifecycle,
  resolveMaxAttempts,
  resolveSideEffects,
} from "../../../src/flow/definition.js";

const SPEC_TEST_DIR = path.dirname(fileURLToPath(import.meta.url));

function baseNode(overrides = {}) {
  return new FlowNode({
    id: "policy-test",
    label: "Policy Test",
    action: "noop",
    instructionsKey: "impl.policy-test",
    ...overrides,
  });
}

describe("acceptance-review flow definition policy", () => {
  it("R1: FlowNode accepts only declared failurePolicy values", () => {
    for (const policy of ["retry", "record", "amend-spec", "block"]) {
      assert.equal(baseNode({ failurePolicy: policy }).failurePolicy, policy);
    }

    assert.throws(
      () => baseNode({ failurePolicy: "unknown-policy" }),
      /failurePolicy/,
    );
  });

  it("R2: flow nodes expose initial failurePolicy assignments", () => {
    for (const id of [
      "draft-questions-review",
      "draft-coverage-review",
      "spec-review",
      "test-review",
      "impl-review",
    ]) {
      assert.equal(getFlowNode(id).failurePolicy, "retry", `${id} uses retry policy`);
    }

    for (const [, stepId] of collectGatePhaseEntries()) {
      const node = getFlowNode(stepId) || getTaskNode(stepId);
      assert.equal(node.failurePolicy, "block", `${stepId} uses block policy`);
    }

    assert.equal(getFlowNode("acceptance-review").failurePolicy, "amend-spec");
    assert.equal(getTaskNode("task-review").failurePolicy, "retry");

    const preservedNormalAttempts = new Map([
      ["draft", 1],
      ["spec", 1],
      ["test", 1],
      ["scenario-validity", 3],
      ["implement", 3],
      ["test-execute", 3],
      ["test-result-review", 3],
      ["retro", 2],
      ["final-regression", 2],
      ["finalize-merge", 1],
      ["finalize-sync", 1],
      ["finalize-cleanup", 1],
    ]);
    for (const [id, attempts] of preservedNormalAttempts) {
      assert.equal(resolveMaxAttempts({ stepId: id, context: { autoApprove: false } }), attempts);
      assert.equal(resolveMaxAttempts({ stepId: id, context: { autoApprove: true } }), attempts);
    }
  });

  it("R3: implementation flow places acceptance-review between retro and final-regression", () => {
    const implLeaves = getFlowBranchLeafIds("impl");
    const retroIndex = implLeaves.indexOf("retro");
    const acceptanceIndex = implLeaves.indexOf("acceptance-review");
    const finalRegressionIndex = implLeaves.indexOf("final-regression");

    assert.notEqual(acceptanceIndex, -1, "acceptance-review must be an impl leaf");
    assert.equal(acceptanceIndex, retroIndex + 1);
    assert.equal(finalRegressionIndex, acceptanceIndex + 1);
    assert.equal(resolveMaxAttempts({ stepId: "acceptance-review", context: { autoApprove: false } }), 1);
    assert.equal(resolveMaxAttempts({ stepId: "acceptance-review", context: { autoApprove: true } }), 1);
  });

  it("R13: normal impl-review remains retry-compatible", () => {
    const implReview = getFlowNode("impl-review");

    assert.equal(implReview.action, "run-review");
    assert.equal(implReview.failurePolicy, "retry");
    assert.equal(implReview.resolveMaxAttempts({ autoApprove: false }), 4);
    assert.equal(implReview.resolveMaxAttempts({ autoApprove: true }), 4);
  });

  it("R14: final-regression and finalize behavior remain after acceptance-review", () => {
    const implLeaves = getFlowBranchLeafIds("impl");
    const acceptanceIndex = implLeaves.indexOf("acceptance-review");

    assert.deepEqual(implLeaves.slice(acceptanceIndex, acceptanceIndex + 6), [
      "acceptance-review",
      "final-regression",
      "finalize-commit",
      "finalize-merge",
      "finalize-sync",
      "finalize-cleanup",
    ]);
    assert.equal(getFlowNode("final-regression").action, "run-final-regression");
    assert.equal(getFlowNode("finalize-commit").requiresApproval, true);
    assert.deepEqual(resolveSideEffects({ stepId: "impl-gate" }), [
      "completeTask",
      "promoteNextTask",
      "mergeOverview",
    ]);
    assert.equal(deriveNextAction({ stepId: "retro" }).outputSchemaRef, "next-action/retro.schema.json");
    assert.equal(deriveNextAction({ stepId: "impl-gate" }).outputSchemaRef, "next-action/gate.schema.json");
    assert.equal(deriveNextAction({ stepId: "impl-review" }).outputSchemaRef, "next-action/review.schema.json");

    const implReviewLifecycle = resolveLifecycle({
      currentStepId: "impl-review",
      phase: "impl",
      event: "review:post",
      result: { artifacts: { phase: "impl", verdict: "PASS" } },
    });
    assert.equal(
      implReviewLifecycle.some((action) => action.constructor.name === "IncrementMetric"),
      true,
      "impl-review still records review retry metrics",
    );

    const implGateLifecycle = resolveLifecycle({
      currentStepId: "impl-gate",
      phase: "integration",
      event: "gate:post",
      result: { result: "pass", artifacts: { phase: "integration" } },
    });
    assert.equal(
      implGateLifecycle.some((action) => action.constructor.name === "ExecuteSideEffects"),
      true,
      "impl-gate pass still executes plugin/task side effects",
    );
  });

  it("R16: spec-local tests remain header-covered while acceptance-review is present", () => {
    const files = fs.readdirSync(SPEC_TEST_DIR).filter((name) => name.endsWith(".test.js"));
    const covered = new Set();
    for (const file of files) {
      const firstLine = fs.readFileSync(path.join(SPEC_TEST_DIR, file), "utf8").split("\n")[0];
      assert.match(firstLine, /^\/\/ spec: R\d+(?: R\d+)*$/);
      for (const id of firstLine.replace("// spec:", "").trim().split(/\s+/)) covered.add(id);
    }

    for (let index = 1; index <= 16; index += 1) {
      assert.equal(covered.has(`R${index}`), true, `R${index} must be covered`);
    }
    assert.ok(getFlowNode("acceptance-review"), "coverage applies to the implemented acceptance-review step");
  });
});
