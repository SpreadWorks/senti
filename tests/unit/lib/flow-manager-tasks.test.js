import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";

function makeState(overrides = {}) {
  return {
    specId: "001-test",
    runId: "run-test",
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
    steps: [
      { id: "spec-gate", status: "pending" },
      { id: "approval", status: "pending" },
      { id: "task-impl", status: "pending" },
      { id: "test", status: "pending" },
      { id: "task-review", status: "pending" },
      { id: "update-overview", status: "pending" },
    ],
    requirements: [],
    summary: null,
    ...overrides,
  };
}

function setupFlow(tmp, stateOverrides = {}) {
  const state = makeState(stateOverrides);
  const fm = makeFlowManager(tmp);
  fm.create(state);
  fm.addActiveFlow("001-test", "local");
  return fm;
}

describe("FlowManager task API", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  describe("addTask", () => {
    it("adds task to state.tasks and sets currentTaskId", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      const before = fm.load("001-test").tasks.length;
      fm.addTask(makeTask());
      const loaded = fm.load("001-test");
      assert.equal(loaded.tasks.length, before + 1);
      assert.equal(loaded.tasks[loaded.tasks.length - 1].id, "001");
      assert.equal(loaded.currentTaskId, "001");
    });

    it("throws on duplicate task id", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addTask(makeTask({ id: "001" }));
      assert.throws(() => fm.addTask(makeTask({ id: "001" })), /duplicate|exist/i);
    });

    it("throws when task misses required fields", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      assert.throws(() => fm.addTask({ id: "001" }), /invalid|required|missing/i);
    });
  });

  describe("completeTask", () => {
    it("marks task done and clears currentTaskId when it matches", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addTask(makeTask({ id: "001" }));
      fm.completeTask("001");
      const loaded = fm.load("001-test");
      assert.equal(loaded.tasks.find((t) => t.id === "001").status, "done");
      assert.equal(loaded.currentTaskId, null);
    });

    it("does not touch currentTaskId if it points elsewhere", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addTask(makeTask({ id: "001" }));
      fm.addTask(makeTask({ id: "002" }));
      // currentTaskId now points to "002"
      fm.completeTask("001");
      const loaded = fm.load("001-test");
      assert.equal(loaded.currentTaskId, "002");
      assert.equal(loaded.tasks.find((t) => t.id === "001").status, "done");
    });

    it("throws on unknown task id", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      assert.throws(() => fm.completeTask("999"), /unknown|not found/i);
    });
  });

  describe("getCurrentTask / getCurrentTaskStep / setCurrentTaskStep", () => {
    it("getCurrentTask returns null when currentTaskId is null", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      assert.equal(fm.getCurrentTask(), null);
    });

    it("getCurrentTask returns the task pointed by currentTaskId", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addTask(makeTask({ id: "001" }));
      const t = fm.getCurrentTask();
      assert.ok(t);
      assert.equal(t.id, "001");
    });

    it("getCurrentTaskStep returns null when no current task", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      assert.equal(fm.getCurrentTaskStep(), null);
    });

    it("getCurrentTaskStep returns the in_progress step of current task", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addTask(makeTask({ id: "001" }));
      fm.setCurrentTaskStep("task-impl", "in_progress");
      const s = fm.getCurrentTaskStep();
      assert.ok(s);
      assert.equal(s.id, "task-impl");
      assert.equal(s.status, "in_progress");
    });

    it("setCurrentTaskStep throws when no current task", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      assert.throws(() => fm.setCurrentTaskStep("task-impl", "in_progress"), /no current task|no task/i);
    });

    it("setCurrentTaskStep throws on unknown step id", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addTask(makeTask({ id: "001" }));
      assert.throws(() => fm.setCurrentTaskStep("unknown-step", "in_progress"), /unknown step/i);
    });
  });

  describe("flat append: addNote with taskId (cac6/T10)", () => {
    it("addNote appends {taskId, text, ts} with taskId from current task", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addTask(makeTask({ id: "001" }));
      fm.addNote("task-note");
      const loaded = fm.load("001-test");
      assert.ok(Array.isArray(loaded.notes));
      assert.equal(loaded.notes.length, 1);
      assert.equal(loaded.notes[0].text, "task-note");
      assert.equal(loaded.notes[0].taskId, "001");
      assert.ok(!loaded.tasks[0].notes, "task.notes must not exist (flat format)");
    });

    it("addNote writes taskId=null when no current task", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addNote("parent-note");
      const loaded = fm.load("001-test");
      assert.equal(loaded.notes.length, 1);
      assert.equal(loaded.notes[0].text, "parent-note");
      assert.equal(loaded.notes[0].taskId, null);
    });
  });

  describe("explicit scope argument", () => {
    it("addNote({ taskId: null }) writes taskId=null even when current task exists", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addTask(makeTask({ id: "001" }));
      fm.addNote("parent-explicit", { taskId: null });
      const loaded = fm.load("001-test");
      assert.equal(loaded.notes.length, 1);
      assert.equal(loaded.notes[0].taskId, null);
      assert.ok(!loaded.tasks[0].notes);
    });

    it("addNote({ taskId: '001' }) overrides active task", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      fm.addTask(makeTask({ id: "001" }));
      fm.addTask(makeTask({ id: "002" }));
      // currentTaskId is now "002"
      fm.addNote("for-001", { taskId: "001" });
      const loaded = fm.load("001-test");
      assert.equal(loaded.notes[0].taskId, "001");
    });

    it("addNote({ taskId: 'unknown' }) throws", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      assert.throws(() => fm.addNote("x", { taskId: "unknown" }), /unknown|not found/i);
    });
  });

  describe("strict load: legacy format rejected", () => {
    it("load throws when tasks field is missing", () => {
      tmp = createTmpDir();
      const fm = setupFlow(tmp);
      // Manually write a legacy flow.json without tasks field.
      const p = path.join(tmp, "specs/001-test/flow.json");
      const legacy = {
        specId: "001-test",
        baseBranch: "main",
        featureBranch: "feature/001-test",
        worktree: false,
        steps: buildInitialSteps(),
        requirements: [],
      };
      fs.writeFileSync(p, JSON.stringify(legacy, null, 2));
      assert.throws(() => fm.load("001-test"), /tasks|schema|legacy/i);
    });
  });
});
