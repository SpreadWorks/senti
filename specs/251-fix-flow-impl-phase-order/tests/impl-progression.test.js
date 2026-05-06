// spec: R1
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FLOW_DEFINITION,
  buildInitialNestedSteps,
  findStepById,
  flattenSteps,
  promoteNextPendingLeaf,
  findFirstPendingLeaf,
} from "../../../src/flow/definition.js";

function markDoneAndPromote(steps, stepId) {
  const step = findStepById(steps, stepId);
  assert.ok(step, `step ${stepId} exists`);
  step.status = "done";
  const next = promoteNextPendingLeaf(steps) || findFirstPendingLeaf(steps);
  if (next) next.status = "in_progress";
  return next;
}

describe("spec 251: impl phase state progression", () => {
  it("R1: implement done → next leaf is review", () => {
    const steps = buildInitialNestedSteps(FLOW_DEFINITION);
    for (const s of flattenSteps(steps)) s.status = "done";
    const implement = findStepById(steps, "implement");
    implement.status = "in_progress";
    for (const s of flattenSteps(steps)) {
      if (s.id !== "implement" && ["review", "gate-impl", "finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup"].includes(s.id)) {
        s.status = "pending";
      }
    }
    const next = markDoneAndPromote(steps, "implement");
    assert.equal(next?.id, "review");
  });

  it("R1: review done → next leaf is gate-impl", () => {
    const steps = buildInitialNestedSteps(FLOW_DEFINITION);
    for (const s of flattenSteps(steps)) s.status = "done";
    const review = findStepById(steps, "review");
    review.status = "in_progress";
    for (const s of flattenSteps(steps)) {
      if (["gate-impl", "finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup"].includes(s.id)) {
        s.status = "pending";
      }
    }
    const next = markDoneAndPromote(steps, "review");
    assert.equal(next?.id, "gate-impl");
  });

  it("R1: gate-impl done → next leaf is finalize-commit", () => {
    const steps = buildInitialNestedSteps(FLOW_DEFINITION);
    for (const s of flattenSteps(steps)) s.status = "done";
    const gateImpl = findStepById(steps, "gate-impl");
    gateImpl.status = "in_progress";
    for (const s of flattenSteps(steps)) {
      if (["finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup"].includes(s.id)) {
        s.status = "pending";
      }
    }
    const next = markDoneAndPromote(steps, "gate-impl");
    assert.equal(next?.id, "finalize-commit");
  });
});
