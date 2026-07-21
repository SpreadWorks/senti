import test from "node:test";
import assert from "node:assert/strict";

import {
  PLAN_REWIND_LIMITS,
  PLAN_REWIND_SUPPORTED_STAGES,
  PlanRewindEvidence,
  PlanRewindRequest,
} from "../../../src/flow/lib/plan-rewind.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { ExplicitRecoveryTransition } from "../../../src/flow/lib/step-transition-policy.js";

test("plan rewind public values enforce supported stages and bounds", () => {
  assert.deepEqual(PLAN_REWIND_SUPPORTED_STAGES, [
    "impl-review",
    "impl-gate",
    "retro",
    "acceptance-review",
    "final-regression",
  ]);
  assert.equal(PLAN_REWIND_LIMITS.maxReasonChars, 500);
  const request = new PlanRewindRequest({
    runId: "run-434",
    issue: 434,
    spec: "specs/319-guarded-plan-rewind/spec.json",
    sourceStage: "impl-gate",
    destinationStep: "draft",
    reason: "Clarify approved wording",
    rewoundAt: "2026-07-12T20:00:00.000Z",
  });
  assert.equal(request.sourceStage, "impl-gate");
  const evidence = new PlanRewindEvidence({
    path: "impl-gate-result.json",
    size: 2,
    mtime: "2026-07-12T19:00:00.000Z",
    sha256: "a".repeat(64),
  });
  assert.equal(evidence.path, "impl-gate-result.json");
  assert.equal(new PlanRewindEvidence({
    path: "x".repeat(1000),
    size: 0,
    mtime: "2026-07-12T19:00:00.000Z",
    sha256: "a".repeat(64),
  }).path.length, 1000);
  assert.throws(
    () => new PlanRewindEvidence({
      path: `${"segment/../".repeat(100)}evidence.json`,
      size: 0,
      mtime: "2026-07-12T19:00:00.000Z",
      sha256: "a".repeat(64),
    }),
    (error) => error.code === "PLAN_REWIND_INVALID_EVIDENCE",
  );
  assert.throws(
    () => new PlanRewindEvidence({
      path: "..\\escape",
      size: 0,
      mtime: "2026-07-12T19:00:00.000Z",
      sha256: "a".repeat(64),
    }),
    (error) => error.code === "PLAN_REWIND_INVALID_EVIDENCE",
  );
});

test("FlowManager delegates plan rewind to the FlowStore save boundary", () => {
  const expected = { destinationStep: "draft" };
  const calls = [];
  const manager = {
    _boundSpecId: "319-guarded-plan-rewind",
    _store: {
      rewindPlan(...args) {
        calls.push(args);
        return expected;
      },
    },
  };
  const request = { reason: "Clarify approved wording" };
  const evidence = [];
  const transition = new ExplicitRecoveryTransition({
    stepId: "draft",
    currentStatus: "done",
    requestedStatus: "in_progress",
    entrypoint: "reopen-draft",
    request,
    evidence,
  });

  assert.equal(
    FlowManager.prototype.rewindPlan.call(manager, transition),
    expected,
  );
  assert.deepEqual(calls, [[
    transition,
    { specId: "319-guarded-plan-rewind" },
  ]]);
});
