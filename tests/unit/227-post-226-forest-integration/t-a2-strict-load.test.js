import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager, makeDefaultTask } from "../../helpers/flow-setup.js";

describe("REQ-A2: FlowStore.load validates tasks field", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("accepts empty tasks array", () => {
    tmp = createTmpDir();
    setupFlow(tmp, { tasks: [], currentTaskId: null });
    const fm = makeFlowManager(tmp);
    const state = fm.load();
    assert.ok(Array.isArray(state.tasks));
    assert.equal(state.tasks.length, 0);
  });

  it("accepts non-empty tasks array", () => {
    tmp = createTmpDir();
    setupFlow(tmp, { tasks: [makeDefaultTask()], currentTaskId: null });
    const fm = makeFlowManager(tmp);
    const state = fm.load();
    assert.ok(Array.isArray(state.tasks));
    assert.ok(state.tasks.length > 0);
  });
});
