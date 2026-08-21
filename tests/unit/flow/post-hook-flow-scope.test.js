import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  FlowAtStepFixture,
  TaskLifecycleFixture,
  makeFlowManager,
} from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const TASK = {
  id: "T-1",
  title: "task",
  goal: "task",
  parent: null,
  origin: "plan",
  added_round: 0,
  status: "pending",
};

describe("canonical Flow and Task Attempt scope", () => {
  let root = null;
  afterEach(() => {
    if (root !== null) removeTmpDir(root);
    root = null;
  });

  it("prevents a flow-level Attempt from replacing an active Task Attempt", () => {
    root = createTmpDir("canonical-task-flow-scope-");
    const flowManager = makeFlowManager(root);
    new TaskLifecycleFixture({
      flowManager,
      specId: "001-test",
      runId: "run-task-scope",
      request: "Keep Task and Flow scopes isolated.",
      taskDocuments: [TASK],
      taskId: TASK.id,
      targetStep: "task-impl",
    }).create();

    assert.throws(() => flowManager.updateStepStatus({
      stepId: "test-execute",
      requestedStatus: "in_progress",
    }, { specId: "001-test" }), /cannot replace an active Attempt/);
    const state = flowManager.loadReadOnly("001-test");
    assert.equal(state.currentNodeId, "T-1-impl");
    assert.equal(state.currentTaskId, "T-1");
  });

  it("completes a flow-level leaf without reopening a terminal Task", () => {
    root = createTmpDir("canonical-flow-post-scope-");
    const flowManager = makeFlowManager(root);
    const fixture = new FlowAtStepFixture({
      flowManager,
      specId: "001-test",
      runId: "run-flow-scope",
      request: "Complete a flow-level producer.",
      taskDocuments: [TASK],
      targetStep: "test-execute",
    }).create();

    const before = flowManager.loadReadOnly("001-test");
    assert.equal(before.tasks[0].status, "done");
    assert.equal(before.currentTaskId, null);
    fixture.flow.flow.settle("test-execute");

    const after = flowManager.loadReadOnly("001-test");
    assert.equal(findStepById(after.steps, "test-execute").status, "done");
    assert.equal(after.tasks[0].status, "done");
    assert.equal(after.currentTaskId, null);
  });
});
