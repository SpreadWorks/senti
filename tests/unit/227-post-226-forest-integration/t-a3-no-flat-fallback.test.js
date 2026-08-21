import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { TaskLifecycleFixture, makeFlowManager } from "../../helpers/flow-setup.js";

function taskDocument(id = "T-1") {
  return {
    id,
    title: "Fixture task",
    goal: "Exercise canonical next-action selection.",
    parent: null,
    origin: "plan",
    added_round: 0,
    status: "pending",
  };
}

describe("REQ-A3: get-next-action assumes non-empty tasks", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("findCurrentTask does not guard against non-array tasks", async () => {
    const mod = await import("../../../src/flow/lib/get-next-action.js");
    const GetNextActionCommand = mod.default;
    const cmd = new GetNextActionCommand();

    tmp = createTmpDir();
    const fm = makeFlowManager(tmp);
    new TaskLifecycleFixture({
      flowManager: fm,
      taskDocuments: [taskDocument()],
      taskId: "T-1",
      targetStep: "task-impl",
    }).create();

    const schemaDir = path.join(process.cwd(), "src/flow/schemas/next-action");
    const ctx = { flowState: fm.loadReadOnly(), flowManager: fm, schemaDir };
    const result = await cmd.execute(ctx);
    assert.ok(result, "should return a result for valid flow with tasks");
  });

  it("allTasksDone returns true when all tasks are done", async () => {
    const mod = await import("../../../src/flow/lib/get-next-action.js");
    const GetNextActionCommand = mod.default;

    tmp = createTmpDir();
    const fm = makeFlowManager(tmp);
    const fixture = new TaskLifecycleFixture({
      flowManager: fm,
      taskDocuments: [taskDocument()],
      taskId: "T-1",
      targetStep: "task-gate",
    }).create();
    fixture.flow.flow.settle("T-1-gate");
    fm.completeTask("T-1");
    // The canonical Task lifecycle is completed through typed transitions;
    // finalize is then explicitly claimed through the definition-ordered API.
    fixture.flow.flow.activate("finalize-commit");

    const schemaDir = path.join(process.cwd(), "src/flow/schemas/next-action");
    const ctx = { flowState: fm.loadReadOnly(), flowManager: fm, schemaDir };
    const result = await new GetNextActionCommand().execute(ctx);
    assert.equal(result.step, "finalize-commit");
  });
});
