/**
 * specs/229-forest-aware-safety-net/tests/safety-net-forest-aware.test.js
 *
 * Verifies that the safety-net fallback in get-next-action promotes tasks
 * in forest DFS order (spec 229, REQ-1/REQ-2/REQ-3).
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { makeFlowManager, replaceFlowState } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import {
  FLOW_STEPS,
  buildInitialSteps,
  buildInitialTaskSteps,
} from "../../../src/lib/flow-helpers.js";
import { flattenSteps } from "../../../src/flow/lib/step-tree.js";

const CLI = join(process.cwd(), "src/senti.js");

function runCli(tmp, args) {
  try {
    const out = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });
    return { envelope: JSON.parse(out), exitCode: 0 };
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    return { envelope: stdout ? JSON.parse(stdout) : null, exitCode: err.status || 1 };
  }
}

function setupActiveFlow(tmp, overrides = {}) {
  const specId = "229-test";
  const state = {
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    baseBranch: "main",
    featureBranch: "feature/229-test",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    ...overrides,
  };
  const fm = makeFlowManager(tmp);
  fm.create(state);
  fm.addActiveFlow(specId, "local");
  return state;
}

function makeTask(id, { parent = null, status = "pending", steps = null } = {}) {
  return {
    id,
    title: `Task ${id}`,
    goal: `Goal for ${id}`,
    parent,
    origin: "plan",
    added_round: 0,
    status,
    steps: steps ?? buildInitialTaskSteps("plan"),
  };
}

function setAllFlowStepsDone(state) {
  for (const s of flattenSteps(state.steps)) s.status = "done";
}

function setAllTaskStepsPending(task) {
  for (const s of task.steps) s.status = "pending";
}

describe("spec 229: forest-aware safety-net fallback", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  describe("REQ-1: task promotion uses forest DFS order", () => {
    it("promotes the DFS-first pending task in a forest structure, not the array-first", () => {
      tmp = createTmpDir();
      // Array order: [T-root (done), T-other (pending), T-child (pending, parent=T-root)]
      // Roots in array order: [T-root, T-other]
      // DFS: visit(T-root) → visit(T-child) → T-child is pending leaf → return T-child
      //      (never reaches T-other)
      // Array-first pending: T-other (index 1)
      // DFS-first pending: T-child
      const tasks = [
        makeTask("T-root", { parent: null, status: "done" }),
        makeTask("T-other", { parent: null, status: "pending" }),
        makeTask("T-child", { parent: "T-root", status: "pending" }),
      ];
      for (const s of tasks[0].steps) s.status = "done";

      const state = setupActiveFlow(tmp, {
        tasks,
        currentTaskId: null,
      });
      setAllFlowStepsDone(state);
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0, "exits cleanly via forest-aware fallback");
      assert.equal(envelope.ok, true);
      const reloaded = makeFlowManager(tmp).load();
      assert.equal(reloaded.currentTaskId, "T-child",
        "forest DFS picks T-child (child of done parent) before T-other (array-first pending root)");
    });

    it("promotes the first pending task in array order for flat task list (no parent)", () => {
      tmp = createTmpDir();
      const tasks = [
        makeTask("T-1", { status: "done" }),
        makeTask("T-2", { status: "pending" }),
        makeTask("T-3", { status: "pending" }),
      ];
      for (const s of tasks[0].steps) s.status = "done";

      const state = setupActiveFlow(tmp, {
        tasks,
        currentTaskId: null,
      });
      setAllFlowStepsDone(state);
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0);
      assert.equal(envelope.ok, true);
      const reloaded = makeFlowManager(tmp).load();
      assert.equal(reloaded.currentTaskId, "T-2",
        "flat list: array-first pending task is promoted (DFS degenerates to array order)");
    });
  });

  describe("REQ-2: step promotion within promoted task", () => {
    it("promotes the first pending step in the promoted task", () => {
      tmp = createTmpDir();
      const tasks = [
        makeTask("T-1", { status: "pending" }),
      ];

      const state = setupActiveFlow(tmp, {
        tasks,
        currentTaskId: null,
      });
      setAllFlowStepsDone(state);
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.taskId, "T-1");
      // First current task step is task-impl.
      assert.equal(envelope.data.step, "task-impl",
        "first pending step in task is promoted to in_progress");
    });
  });

  describe("REQ-3: normal path unchanged", () => {
    it("does not trigger fallback when an in_progress step exists", () => {
      tmp = createTmpDir();
      const tasks = [
        makeTask("T-1", { status: "in_progress" }),
      ];
      // Set first step to in_progress
      tasks[0].steps[0].status = "in_progress";

      const state = setupActiveFlow(tmp, {
        tasks,
        currentTaskId: "T-1",
      });
      setAllFlowStepsDone(state);
      replaceFlowState(tmp, state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.taskId, "T-1");
      assert.equal(envelope.data.step, "task-impl",
        "normal path: existing in_progress step is used without fallback");
    });
  });
});
