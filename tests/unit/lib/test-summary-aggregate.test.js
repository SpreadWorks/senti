/**
 * tests/unit/lib/test-summary-aggregate.test.js
 *
 * Tests for spec 197 (cac6/T4): test-summary aggregation from task to parent.
 *
 * Covers:
 * - completeTask aggregates task.test.summary into state.test.summary
 * - null task.test.summary is a no-op (parent unchanged)
 * - aggregation sums unit / integration / acceptance counts
 * - integration phase results go directly to parent scope
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps, buildInitialTaskSteps } from "../../../src/lib/flow-helpers.js";

function makeState(overrides = {}) {
  return {
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    worktree: false,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
    ...overrides,
  };
}

function makeTask(overrides = {}) {
  return {
    id: "001",
    spec: "specs/001-test/tasks/001-first.md",
    origin: "plan",
    parent: null,
    status: "pending",
    steps: buildInitialTaskSteps("plan"),
    requirements: [],
    summary: null,
    ...overrides,
  };
}

function setupFlow(tmp, stateOverrides = {}) {
  const state = makeState(stateOverrides);
  const fm = makeFlowManager(tmp);
  fm.save(state);
  fm.addActiveFlow("001-test", "local");
  return fm;
}

describe("completeTask aggregates test.summary into parent", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("aggregates unit/integration/acceptance counts into parent", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp);
    fm.addTask(makeTask({ id: "001" }));
    fm.setTestSummary({ unit: 3, integration: 1, acceptance: 0 }, { taskId: "001" });
    fm.completeTask("001");
    const loaded = fm.load("001-test");
    assert.equal(loaded.test?.summary?.unit, 3);
    assert.equal(loaded.test?.summary?.integration, 1);
    assert.equal(loaded.test?.summary?.acceptance, 0);
  });

  it("sums counts from multiple completed tasks", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp);
    fm.addTask(makeTask({ id: "001" }));
    fm.setTestSummary({ unit: 2, integration: 1, acceptance: 0 }, { taskId: "001" });
    fm.completeTask("001");
    fm.addTask(makeTask({ id: "002" }));
    fm.setTestSummary({ unit: 3, integration: 0, acceptance: 1 }, { taskId: "002" });
    fm.completeTask("002");
    const loaded = fm.load("001-test");
    assert.equal(loaded.test?.summary?.unit, 5);
    assert.equal(loaded.test?.summary?.integration, 1);
    assert.equal(loaded.test?.summary?.acceptance, 1);
  });

  it("no-op when task.test.summary is null", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp);
    fm.addTask(makeTask({ id: "001" }));
    // no setTestSummary call → task.test is null
    fm.completeTask("001");
    const loaded = fm.load("001-test");
    // parent summary should be absent or zeroed; either way, no error
    const s = loaded.test?.summary;
    if (s) {
      assert.equal(s.unit ?? 0, 0);
      assert.equal(s.integration ?? 0, 0);
      assert.equal(s.acceptance ?? 0, 0);
    }
  });
});

describe("setTestSummary without current task writes to parent scope", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("writes directly to state.test.summary when no current task", () => {
    tmp = createTmpDir();
    const fm = setupFlow(tmp);
    // No task present → scope resolves to parent
    fm.setTestSummary({ unit: 2, integration: 3, acceptance: 1 });
    const loaded = fm.load("001-test");
    assert.equal(loaded.test?.summary?.unit, 2);
    assert.equal(loaded.test?.summary?.integration, 3);
    assert.equal(loaded.test?.summary?.acceptance, 1);
  });
});
