import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { FreshFlowFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";

function taskDocument(id = "T-1") {
  return {
    id,
    title: "Fixture task",
    goal: "Exercise canonical Task admission.",
    parent: null,
    origin: "plan",
    added_round: 0,
    status: "pending",
  };
}

describe("REQ-A2: canonical Flow read model validates tasks field", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("accepts empty tasks array", () => {
    tmp = createTmpDir();
    const fm = makeFlowManager(tmp);
    new FreshFlowFixture({ flowManager: fm }).create().registerActive();
    const state = fm.loadReadOnly();
    assert.ok(Array.isArray(state.tasks));
    assert.equal(state.tasks.length, 0);
  });

  it("accepts non-empty tasks array", () => {
    tmp = createTmpDir();
    const fm = makeFlowManager(tmp);
    new FreshFlowFixture({
      flowManager: fm,
      specRecord: { requirements: [{ id: "R-T-1", desc: "Admit the canonical Task.", task_ids: ["T-1"] }] },
    }).create().addTask(taskDocument()).registerActive();
    const state = fm.loadReadOnly();
    assert.ok(Array.isArray(state.tasks));
    assert.ok(state.tasks.length > 0);
  });
});
