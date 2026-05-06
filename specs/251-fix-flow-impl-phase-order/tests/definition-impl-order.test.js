// spec: R1
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FLOW_DEFINITION, resolveNodeFor } from "../../../src/flow/definition.js";

describe("spec 251: FLOW_DEFINITION impl children order", () => {
  it("R1: impl branch children are ordered [implement, review, gate-impl, finalize]", () => {
    const impl = resolveNodeFor(FLOW_DEFINITION, "impl");
    assert.ok(impl, "impl branch exists");
    assert.ok(impl.children, "impl is a branch");
    const ids = impl.children.map((c) => c.id);
    assert.deepEqual(ids, ["implement", "review", "gate-impl", "finalize"]);
  });

  it("R1: gate-impl node attributes are unchanged after swap", () => {
    const gateImpl = resolveNodeFor(FLOW_DEFINITION, "gate-impl");
    assert.equal(gateImpl.action, "run-gate");
    assert.equal(gateImpl.instructionsKey, "impl.gate-impl");
    assert.deepEqual([...gateImpl.sideEffects], ["completeTask", "promoteNextTask", "mergeOverview"]);
  });

  it("R1: review node attributes are unchanged after swap", () => {
    const review = resolveNodeFor(FLOW_DEFINITION, "review");
    assert.equal(review.action, "run-review");
    assert.equal(review.instructionsKey, "impl.review");
  });
});
