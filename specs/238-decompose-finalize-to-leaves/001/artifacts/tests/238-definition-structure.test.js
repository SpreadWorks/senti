import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FLOW_DEFINITION,
  collectLeafIds,
  derivePhaseMap,
  buildInitialNestedSteps,
  resolveNodeFor,
  findBranchForLeaf,
} from "../../../src/flow/definition.js";

describe("spec 238: finalize decomposition in definition.js", () => {

  it("R1: finalize node is a branch with 4 children", () => {
    const implBranch = FLOW_DEFINITION.find((n) => n.id === "impl");
    assert.ok(implBranch, "impl branch exists");
    const finalize = implBranch.children.find((n) => n.id === "finalize");
    assert.ok(finalize, "finalize node exists under impl");
    assert.ok(finalize.isBranch, "finalize is a branch (has children)");
    assert.equal(finalize.children.length, 4, "finalize has exactly 4 children");

    const childIds = finalize.children.map((c) => c.id);
    assert.deepEqual(childIds, [
      "finalize-commit",
      "finalize-merge",
      "finalize-sync",
      "finalize-cleanup",
    ]);
  });

  it("R1: each finalize leaf has action and instructionsKey", () => {
    const implBranch = FLOW_DEFINITION.find((n) => n.id === "impl");
    const finalize = implBranch.children.find((n) => n.id === "finalize");
    for (const leaf of finalize.children) {
      assert.ok(leaf.isLeaf, `${leaf.id} is a leaf`);
      assert.ok(leaf.action, `${leaf.id} has action`);
      assert.ok(leaf.instructionsKey, `${leaf.id} has instructionsKey`);
      assert.ok(Array.isArray(leaf.contextKinds), `${leaf.id} has contextKinds`);
    }
  });

  it("R6: only finalize-commit has requiresApproval", () => {
    const implBranch = FLOW_DEFINITION.find((n) => n.id === "impl");
    const finalize = implBranch.children.find((n) => n.id === "finalize");
    const commit = finalize.children.find((c) => c.id === "finalize-commit");
    assert.equal(commit.requiresApproval, true, "finalize-commit requires approval");
    for (const leaf of finalize.children) {
      if (leaf.id !== "finalize-commit") {
        assert.equal(leaf.requiresApproval, false, `${leaf.id} does not require approval`);
      }
    }
  });

  it("R8: collectLeafIds includes finalize sub-leaves", () => {
    const leafIds = collectLeafIds(FLOW_DEFINITION);
    assert.ok(leafIds.includes("finalize-commit"), "finalize-commit in leaf ids");
    assert.ok(leafIds.includes("finalize-merge"), "finalize-merge in leaf ids");
    assert.ok(leafIds.includes("finalize-sync"), "finalize-sync in leaf ids");
    assert.ok(leafIds.includes("finalize-cleanup"), "finalize-cleanup in leaf ids");
    assert.ok(!leafIds.includes("finalize"), "finalize (branch) not in leaf ids");
  });

  it("R8: derivePhaseMap maps finalize leaves to finalize branch", () => {
    const map = derivePhaseMap(FLOW_DEFINITION);
    assert.equal(map["finalize-commit"], "finalize");
    assert.equal(map["finalize-merge"], "finalize");
    assert.equal(map["finalize-sync"], "finalize");
    assert.equal(map["finalize-cleanup"], "finalize");
  });

  it("R8: buildInitialNestedSteps generates finalize branch with children", () => {
    const steps = buildInitialNestedSteps(FLOW_DEFINITION);
    const implStep = steps.find((s) => s.id === "impl");
    assert.ok(implStep, "impl step exists");
    const finalizeStep = implStep.children.find((s) => s.id === "finalize");
    assert.ok(finalizeStep, "finalize step exists");
    assert.ok(Array.isArray(finalizeStep.children), "finalize has children in steps");
    assert.equal(finalizeStep.children.length, 4);
    const childIds = finalizeStep.children.map((c) => c.id);
    assert.deepEqual(childIds, [
      "finalize-commit",
      "finalize-merge",
      "finalize-sync",
      "finalize-cleanup",
    ]);
  });

  it("resolveNodeFor finds finalize sub-leaves", () => {
    const commit = resolveNodeFor(FLOW_DEFINITION, "finalize-commit");
    assert.ok(commit, "finalize-commit found");
    assert.equal(commit.isLeaf, true);
  });

  it("findBranchForLeaf returns finalize branch for sub-leaves", () => {
    const branch = findBranchForLeaf(FLOW_DEFINITION, "finalize-commit");
    assert.ok(branch, "branch found for finalize-commit");
    assert.equal(branch.id, "impl");
  });

  it("R10: no leaf named 'finalize' exists (old monolithic leaf removed)", () => {
    const leafIds = collectLeafIds(FLOW_DEFINITION);
    assert.ok(!leafIds.includes("finalize"), "no 'finalize' leaf exists");
  });
});
