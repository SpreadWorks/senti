import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FLOW_DEFINITION,
  TASK_DEFINITION,
  resolveNodeFor,
  collectGatePhaseEntries,
} from "../../../src/flow/definition.js";

describe("R1: FlowNode gatePhase attribute", () => {
  it("gate-draft has gatePhase=['draft']", () => {
    const node = resolveNodeFor(FLOW_DEFINITION, "gate-draft");
    assert.deepStrictEqual(node.gatePhase, ["draft"]);
  });

  it("gate (spec) has gatePhase=['spec','task-spec']", () => {
    const node = resolveNodeFor(FLOW_DEFINITION, "gate");
    assert.deepStrictEqual(node.gatePhase, ["spec", "task-spec"]);
  });

  it("gate-impl (FLOW) has gatePhase=['task-impl','integration']", () => {
    const node = resolveNodeFor(FLOW_DEFINITION, "gate-impl");
    assert.deepStrictEqual(node.gatePhase, ["task-impl", "integration"]);
  });

  it("gate-impl (TASK) has gatePhase=null (task-spec is handled by flow gate)", () => {
    const node = resolveNodeFor(TASK_DEFINITION, "gate-impl");
    assert.strictEqual(node.gatePhase, null);
  });

  it("non-gate nodes have gatePhase=null", () => {
    const draft = resolveNodeFor(FLOW_DEFINITION, "draft");
    assert.strictEqual(draft.gatePhase, null);

    const implement = resolveNodeFor(FLOW_DEFINITION, "implement");
    assert.strictEqual(implement.gatePhase, null);

    const approval = resolveNodeFor(FLOW_DEFINITION, "approval");
    assert.strictEqual(approval.gatePhase, null);
  });
});

describe("R2: collectGatePhaseEntries", () => {
  it("returns [phase, stepId] pairs from FLOW + TASK definitions", () => {
    const entries = collectGatePhaseEntries();
    const expected = [
      ["draft", "gate-draft"],
      ["spec", "gate"],
      ["task-spec", "gate"],
      ["task-impl", "gate-impl"],
      ["integration", "gate-impl"],
    ];
    assert.deepStrictEqual(entries, expected);
  });

  it("returns entries in definition order", () => {
    const entries = collectGatePhaseEntries();
    const draftIdx = entries.findIndex(([p]) => p === "draft");
    const specIdx = entries.findIndex(([p]) => p === "spec");
    const taskImplIdx = entries.findIndex(([p]) => p === "task-impl");
    assert.ok(draftIdx < specIdx);
    assert.ok(specIdx < taskImplIdx);
  });
});
