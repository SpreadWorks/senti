import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager, setStepDone, makeFlowState } from "../../helpers/flow-setup.js";

describe("REQ-A3: get-next-action assumes non-empty tasks", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("findCurrentTask does not guard against non-array tasks", async () => {
    const mod = await import("../../../src/flow/lib/get-next-action.js");
    const GetNextActionCommand = mod.default;
    const cmd = new GetNextActionCommand();

    tmp = createTmpDir();
    const task = { id: "T-1", title: "x", goal: "x", status: "in_progress", parent: null, origin: "plan", added_round: 0, steps: [{ id: "impl", status: "in_progress" }] };
    const state = setupFlow(tmp, {
      tasks: [task],
      currentTaskId: "T-1",
    });
    setStepDone(state, "branch", "prepare-spec", "draft", "gate-draft", "spec", "gate", "approval", "test");
    const fm = makeFlowManager(tmp);
    fm.save(state);

    const schemaDir = path.join(process.cwd(), "src/flow/schemas/next-action");
    const ctx = { flowState: fm.load(), flowManager: fm, schemaDir };
    const result = cmd.execute(ctx);
    assert.ok(result, "should return a result for valid flow with tasks");
  });

  it("allTasksDone returns true when all tasks are done", async () => {
    const mod = await import("../../../src/flow/lib/get-next-action.js");
    const GetNextActionCommand = mod.default;

    tmp = createTmpDir();
    const task = { id: "T-1", title: "x", goal: "x", status: "done", parent: null, origin: "plan", added_round: 0, steps: [{ id: "impl", status: "done" }, { id: "review", status: "done" }, { id: "gate-impl", status: "done" }] };
    const state = setupFlow(tmp, {
      tasks: [task],
      currentTaskId: "T-1",
    });
    setStepDone(state, "branch", "prepare-spec", "draft", "gate-draft", "spec", "gate", "approval", "test", "implement", "gate-impl", "review");
    const step = state.steps.find((s) => s.id === "finalize");
    if (step) step.status = "in_progress";
    const fm = makeFlowManager(tmp);
    fm.save(state);

    const schemaDir = path.join(process.cwd(), "src/flow/schemas/next-action");
    const ctx = { flowState: fm.load(), flowManager: fm, schemaDir };
    const result = new GetNextActionCommand().execute(ctx);
    assert.equal(result.step, "finalize");
  });
});
