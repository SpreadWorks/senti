import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { executeGateSideEffects } from "../../../src/flow/lib/run-gate.js";

describe("R4/R5: gate PASS side effects driven by definition", () => {
  it("executeGateSideEffects is exported from run-gate.js", () => {
    assert.strictEqual(typeof executeGateSideEffects, "function");
  });

  it("does nothing for phases with no sideEffects (e.g. draft)", async () => {
    let called = false;
    const ctx = {
      flowManager: {
        load: () => ({ currentTaskId: null }),
        completeTask: () => { called = true; },
        mutate: () => { called = true; },
      },
    };
    await executeGateSideEffects(ctx, "draft");
    assert.strictEqual(called, false);
  });

  it("does nothing for spec phase (no sideEffects)", async () => {
    let called = false;
    const ctx = {
      flowManager: {
        load: () => ({ currentTaskId: null }),
        completeTask: () => { called = true; },
        mutate: () => { called = true; },
      },
    };
    await executeGateSideEffects(ctx, "spec");
    assert.strictEqual(called, false);
  });

  it("executes completeTask for task-impl phase when currentTaskId exists", async () => {
    let completedTaskId = null;
    let mutated = false;
    const ctx = {
      flowManager: {
        load: () => ({ currentTaskId: "T-1" }),
        completeTask: (id) => { completedTaskId = id; },
        mutate: (fn) => { mutated = true; fn({}); },
      },
    };
    await executeGateSideEffects(ctx, "task-impl");
    assert.strictEqual(completedTaskId, "T-1");
    assert.strictEqual(mutated, true);
  });
});
