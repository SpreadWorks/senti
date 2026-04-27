/**
 * tests/unit/226-task-decomp-wiring/t4-forest-wiring.test.js
 *
 * Spec 226 / T-4: forest 構造の運用配線。
 * sync-spec-tasks の parent 転写、get-next-action の forest traversal
 * (DFS pre-order, 配列順)、completeTask の親子 propagation を検証する。
 *
 * REQ-6 / REQ-9 に対応。
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager } from "../../helpers/flow-setup.js";
import { syncSpecTasksToFlow } from "../../../src/flow/lib/sync-spec-tasks.js";
import {
  findNextPendingTask,
  promoteNextPending,
} from "../../../src/lib/flow-helpers.js";
import { checkSpecJson } from "../../../src/flow/lib/run-gate.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function writeSpecJson(tmp, specRel, specObj) {
  const specPath = path.join(tmp, specRel);
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(specPath, JSON.stringify(specObj, null, 2));
}

function baseSpec(tasks) {
  return {
    goal: "test",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks,
  };
}

/** Shorthand for a minimal task entry used in findNextPendingTask tests. */
function task(id, status = "pending", parent = null) {
  return { id, parent, status };
}

/** Build a flow task with required fields for FlowStore.completeTask tests. */
function flowTask(id, status = "pending", parent = null, extras = {}) {
  return {
    id,
    spec: `specs/226-test/tasks/${id}.md`,
    origin: "plan",
    parent,
    status,
    steps: [
      { id: "impl", status: "pending" },
      { id: "review", status: "pending" },
      { id: "gate-impl", status: "pending" },
    ],
    requirements: [],
    summary: null,
    added_round: 0,
    ...extras,
  };
}

describe("T-4: forest wiring (sync parent transcription + traversal + propagation)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  // ── sync-spec-tasks: parent transcription ──────────────────────────────────

  it("sync-spec-tasks transcribes spec.json task.parent to flow.json task.parent", () => {
    tmp = createTmpDir();
    setupFlow(tmp, {
      spec: "specs/226-forest/spec.json",
      tasks: [flowTask("T-seed")],
    });
    writeSpecJson(tmp, "specs/226-forest/spec.json", baseSpec([
      { id: "T-root", title: "Root", goal: "g", origin: "plan", added_round: 0, status: "pending", parent: null },
      { id: "T-child", title: "Child", goal: "g", origin: "plan", added_round: 0, status: "pending", parent: "T-root" },
    ]));
    syncSpecTasksToFlow({ root: tmp });
    const flow = JSON.parse(fs.readFileSync(path.join(tmp, "specs/226-forest/flow.json"), "utf8"));
    const tRoot = flow.tasks.find((t) => t.id === "T-root");
    const tChild = flow.tasks.find((t) => t.id === "T-child");
    assert.equal(tRoot.parent, null);
    assert.equal(tChild.parent, "T-root");
  });

  it("flat (parent=null) tasks are preserved as-is", () => {
    tmp = createTmpDir();
    setupFlow(tmp, {
      spec: "specs/226-flat/spec.json",
      tasks: [flowTask("T-seed")],
    });
    writeSpecJson(tmp, "specs/226-flat/spec.json", baseSpec([
      { id: "T-a", title: "A", goal: "g", origin: "plan", added_round: 0, status: "pending" },
      { id: "T-b", title: "B", goal: "g", origin: "plan", added_round: 0, status: "pending" },
    ]));
    syncSpecTasksToFlow({ root: tmp });
    const flow = JSON.parse(fs.readFileSync(path.join(tmp, "specs/226-flat/flow.json"), "utf8"));
    const tA = flow.tasks.find((t) => t.id === "T-a");
    const tB = flow.tasks.find((t) => t.id === "T-b");
    assert.equal(tA.parent, null);
    assert.equal(tB.parent, null);
  });

  // ── forest traversal: findNextPendingTask ──────────────────────────────────

  it("forest traversal is DFS pre-order", () => {
    // Tree:  R1 -> C1 -> GC1
    //           -> C2
    //        R2
    // DFS pre-order visits: R1, C1, GC1, C2, R2
    // GC1 is the deepest leaf and first pending leaf in DFS order.
    const tasks = [
      task("R1", "pending", null),
      task("C1", "pending", "R1"),
      task("GC1", "pending", "C1"),
      task("C2", "pending", "R1"),
      task("R2", "pending", null),
    ];
    const result = findNextPendingTask(tasks);
    assert.equal(result.id, "GC1");
  });

  it("forest traversal respects spec.json.tasks[] array order for siblings", () => {
    // Two roots, both pending with no children. Array order determines priority.
    const tasks = [
      task("first", "pending", null),
      task("second", "pending", null),
    ];
    const result = findNextPendingTask(tasks);
    assert.equal(result.id, "first");

    // Swap order: "second" comes first in array.
    const swapped = [
      task("second", "pending", null),
      task("first", "pending", null),
    ];
    const result2 = findNextPendingTask(swapped);
    assert.equal(result2.id, "second");
  });

  it("forest traversal prioritizes leaf (no children or all children done)", () => {
    // P has two children: C1 (done) and C2 (pending).
    // P itself is pending but C2 is not done, so P cannot be selected.
    // C2 is a leaf and pending => selected.
    const tasks = [
      task("P", "pending", null),
      task("C1", "done", "P"),
      task("C2", "pending", "P"),
    ];
    const result = findNextPendingTask(tasks);
    assert.equal(result.id, "C2");
  });

  it("forest traversal returns same result for same input (deterministic)", () => {
    const tasks = [
      task("R", "pending", null),
      task("A", "pending", "R"),
      task("B", "pending", "R"),
    ];
    const r1 = findNextPendingTask(tasks);
    const r2 = findNextPendingTask(tasks);
    const r3 = findNextPendingTask(tasks);
    assert.equal(r1.id, r2.id);
    assert.equal(r2.id, r3.id);
  });

  it("forest traversal handles 3+ level depth", () => {
    // L0 -> L1 -> L2 -> L3 (4 levels, 0-indexed depth 3)
    const tasks = [
      task("L0", "pending", null),
      task("L1", "pending", "L0"),
      task("L2", "pending", "L1"),
      task("L3", "pending", "L2"),
    ];
    const result = findNextPendingTask(tasks);
    // Deepest leaf in DFS
    assert.equal(result.id, "L3");

    // After L3 is done, L2 becomes the next leaf (all children done).
    tasks.find((t) => t.id === "L3").status = "done";
    const r2 = findNextPendingTask(tasks);
    assert.equal(r2.id, "L2");

    // After L2 is done, L1 becomes the next leaf.
    tasks.find((t) => t.id === "L2").status = "done";
    const r3 = findNextPendingTask(tasks);
    assert.equal(r3.id, "L1");
  });

  it("forest traversal handles flat (parent=null only) compatibility", () => {
    // All tasks are roots — equivalent to pre-forest flat list.
    const tasks = [
      task("A", "pending", null),
      task("B", "pending", null),
      task("C", "pending", null),
    ];
    const result = findNextPendingTask(tasks);
    assert.equal(result.id, "A");

    // If first is done, selects second.
    tasks[0].status = "done";
    const r2 = findNextPendingTask(tasks);
    assert.equal(r2.id, "B");

    // All done => null.
    tasks[1].status = "done";
    tasks[2].status = "done";
    assert.equal(findNextPendingTask(tasks), null);
  });

  // ── completeTask: parent propagation ───────────────────────────────────────

  it("completeTask propagates to parent when all children are done", () => {
    tmp = createTmpDir();
    const tasks = [
      flowTask("P", "in_progress", null),
      flowTask("C1", "done", "P"),
      flowTask("C2", "in_progress", "P"),
    ];
    setupFlow(tmp, {
      spec: "specs/226-propagation/spec.json",
      tasks,
      currentTaskId: "C2",
    });
    const fm = makeFlowManager(tmp);
    fm.completeTask("C2");

    const state = fm.load("226-propagation");
    const parent = state.tasks.find((t) => t.id === "P");
    assert.equal(parent.status, "done", "parent should be auto-completed");
  });

  it("completeTask propagation is recursive up to root", () => {
    tmp = createTmpDir();
    // Three-level: Root -> Mid -> Leaf
    // Root has one child (Mid), Mid has one child (Leaf).
    const tasks = [
      flowTask("Root", "pending", null),
      flowTask("Mid", "pending", "Root"),
      flowTask("Leaf", "in_progress", "Mid"),
    ];
    setupFlow(tmp, {
      spec: "specs/226-recursive/spec.json",
      tasks,
      currentTaskId: "Leaf",
    });
    const fm = makeFlowManager(tmp);
    fm.completeTask("Leaf");

    const state = fm.load("226-recursive");
    assert.equal(state.tasks.find((t) => t.id === "Leaf").status, "done");
    assert.equal(state.tasks.find((t) => t.id === "Mid").status, "done");
    assert.equal(state.tasks.find((t) => t.id === "Root").status, "done");
  });

  it("completeTask does NOT auto-promote (responsibility separation)", () => {
    tmp = createTmpDir();
    const tasks = [
      flowTask("T-1", "in_progress", null),
      flowTask("T-2", "pending", null),
    ];
    setupFlow(tmp, {
      spec: "specs/226-no-promote/spec.json",
      tasks,
      currentTaskId: "T-1",
    });
    const fm = makeFlowManager(tmp);
    fm.completeTask("T-1");

    const state = fm.load("226-no-promote");
    // currentTaskId should be null — completeTask clears it but does NOT
    // promote the next pending task.
    assert.equal(state.currentTaskId, null);
    assert.equal(state.tasks.find((t) => t.id === "T-2").status, "pending");
  });

  it("completeTask handles flat tasks (parent=null) without propagation", () => {
    tmp = createTmpDir();
    const tasks = [
      flowTask("A", "done", null),
      flowTask("B", "in_progress", null),
      flowTask("C", "pending", null),
    ];
    setupFlow(tmp, {
      spec: "specs/226-flat-complete/spec.json",
      tasks,
      currentTaskId: "B",
    });
    const fm = makeFlowManager(tmp);
    fm.completeTask("B");

    const state = fm.load("226-flat-complete");
    assert.equal(state.tasks.find((t) => t.id === "B").status, "done");
    // No propagation expected — parent is null for all tasks.
    assert.equal(state.tasks.find((t) => t.id === "A").status, "done");
    assert.equal(state.tasks.find((t) => t.id === "C").status, "pending");
    assert.equal(state.currentTaskId, null);
  });

  // ── forest depth boundary ──────────────────────────────────────────────────

  it("forest depth 10 boundary is enforced (depth 11+ fails spec gate)", () => {
    // Build a chain of 11 levels (depth=11 from leaf to root).
    // depth is measured as the longest parent-chain length.
    // 12 tasks forming a chain: T-0 -> T-1 -> ... -> T-11
    // Depth of T-11 = 11 hops up to T-0 => exceeds the max of 10.
    const deepTasks = [];
    for (let i = 0; i <= 11; i++) {
      deepTasks.push({
        id: `T-${i}`,
        title: `Task ${i}`,
        goal: `goal-${i}`,
        origin: "plan",
        added_round: 0,
        status: "pending",
        parent: i === 0 ? null : `T-${i - 1}`,
      });
    }
    const spec = baseSpec(deepTasks);
    const issues = checkSpecJson(spec);
    assert.ok(
      issues.some((i) => /forest depth/.test(i) && /exceeds/.test(i)),
      `expected depth violation issue, got: ${JSON.stringify(issues)}`,
    );

    // Depth 10 (11 tasks, 0..10) should pass.
    const okTasks = [];
    for (let i = 0; i <= 10; i++) {
      okTasks.push({
        id: `T-${i}`,
        title: `Task ${i}`,
        goal: `goal-${i}`,
        origin: "plan",
        added_round: 0,
        status: "pending",
        parent: i === 0 ? null : `T-${i - 1}`,
      });
    }
    const okSpec = baseSpec(okTasks);
    const okIssues = checkSpecJson(okSpec);
    const depthIssues = okIssues.filter((i) => /forest depth/.test(i));
    assert.equal(depthIssues.length, 0, `depth 10 should pass, got: ${JSON.stringify(depthIssues)}`);
  });
});
