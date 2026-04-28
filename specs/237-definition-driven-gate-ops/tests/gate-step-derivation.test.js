import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveGateStepId,
  STEP_TO_PHASE,
  resolveGatePhaseFromState,
} from "../../../src/flow/lib/gate-step.js";
import { collectGatePhaseEntries } from "../../../src/flow/definition.js";

describe("R3: PHASE_TO_STEP derived from definition", () => {
  it("resolveGateStepId returns correct step for each phase", () => {
    assert.strictEqual(resolveGateStepId("draft"), "gate-draft");
    assert.strictEqual(resolveGateStepId("spec"), "gate");
    assert.strictEqual(resolveGateStepId("task-spec"), "gate");
    assert.strictEqual(resolveGateStepId("task-impl"), "gate-impl");
    assert.strictEqual(resolveGateStepId("integration"), "gate-impl");
  });

  it("STEP_TO_PHASE maps step ids to phases", () => {
    assert.strictEqual(STEP_TO_PHASE["gate-draft"], "draft");
    assert.strictEqual(STEP_TO_PHASE["gate"], "spec");
    assert.strictEqual(STEP_TO_PHASE["gate-impl"], "task-impl");
  });

  it("resolveGateStepId fallback returns 'gate' for unknown phase", () => {
    assert.strictEqual(resolveGateStepId("unknown"), "gate");
  });

  it("PHASE_TO_STEP entries match collectGatePhaseEntries output", () => {
    const definitionEntries = collectGatePhaseEntries();
    for (const [phase, stepId] of definitionEntries) {
      assert.strictEqual(
        resolveGateStepId(phase),
        stepId,
        `phase '${phase}' should map to step '${stepId}'`,
      );
    }
  });
});

describe("R3: resolveGatePhaseFromState unchanged behavior", () => {
  it("returns null for empty state", () => {
    assert.strictEqual(resolveGatePhaseFromState(null), null);
    assert.strictEqual(resolveGatePhaseFromState({}), null);
  });

  it("resolves flow-level gate step in_progress", () => {
    const state = {
      steps: [
        {
          id: "plan",
          status: "pending",
          children: [
            { id: "gate-draft", status: "in_progress" },
          ],
        },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const result = resolveGatePhaseFromState(state);
    assert.strictEqual(result.phase, "draft");
  });
});
