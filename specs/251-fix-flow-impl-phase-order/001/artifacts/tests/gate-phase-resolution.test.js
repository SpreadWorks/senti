// spec: R9
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { STEP_TO_PHASE, resolveGateStepId } from "../../../src/flow/lib/gate-step.js";

describe("spec 251: gate-impl phase resolution", () => {
  it("R9: STEP_TO_PHASE['gate-impl'] resolves to 'integration' for flow scope", () => {
    assert.equal(STEP_TO_PHASE["gate-impl"], "integration");
  });

  it("R9: PHASE_TO_STEP['integration'] resolves to 'gate-impl'", () => {
    assert.equal(resolveGateStepId("integration"), "gate-impl");
  });

  it("R9: PHASE_TO_STEP['task-impl'] still resolves to 'gate-impl'", () => {
    assert.equal(resolveGateStepId("task-impl"), "gate-impl");
  });
});
