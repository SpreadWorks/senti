import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager } from "../../helpers/flow-setup.js";

describe("REQ-A2: FlowStore.load rejects empty tasks", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("throws when tasks is an empty array", () => {
    tmp = createTmpDir();
    setupFlow(tmp, { tasks: [{ id: "T-1", title: "x", goal: "x", status: "pending", parent: null, origin: "plan", added_round: 0, steps: [] }] });
    const fm = makeFlowManager(tmp);
    const state = fm.load();
    state.tasks = [];
    fm.save(state);
    assert.throws(() => fm.load(), /tasks/i);
  });

  it("accepts non-empty tasks array", () => {
    tmp = createTmpDir();
    const task = { id: "T-1", title: "x", goal: "x", status: "pending", parent: null, origin: "plan", added_round: 0, steps: [] };
    setupFlow(tmp, { tasks: [task], currentTaskId: null });
    const fm = makeFlowManager(tmp);
    const state = fm.load();
    assert.ok(Array.isArray(state.tasks));
    assert.ok(state.tasks.length > 0);
  });
});
