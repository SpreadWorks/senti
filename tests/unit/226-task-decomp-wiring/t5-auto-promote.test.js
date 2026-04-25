/**
 * tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js
 *
 * Spec 226 / T-5: タスク遷移の自動化と auto-promote。
 * auto-promote 関数の単一性、sync 末尾と gate-impl post-hook の 2 箇所のみ
 * から呼ばれること、completeTask が auto-promote を呼ばないこと、全 task
 * done 時の flow-scope 遷移を検証する。
 *
 * REQ-4 / REQ-5 / REQ-7 に対応。
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager } from "../../helpers/flow-setup.js";
import {
  promoteNextPending,
  findNextPendingTask,
  buildInitialSteps,
  buildInitialTaskSteps,
} from "../../../src/lib/flow-helpers.js";
import { syncSpecTasksToFlow } from "../../../src/flow/lib/sync-spec-tasks.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function writeSpecJson(tmp, specRel, specObj) {
  const specPath = path.join(tmp, specRel);
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(specPath, JSON.stringify(specObj, null, 2));
}

function baseSpec(tasks) {
  return {
    goal: "",
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

function makePendingTask(id, parent = null) {
  return {
    id,
    title: `Task ${id}`,
    goal: `Goal of ${id}`,
    parent,
    origin: "plan",
    added_round: 0,
    status: "pending",
    steps: [
      { id: "write-tests", status: "pending" },
      { id: "impl", status: "pending" },
      { id: "gate-impl", status: "pending" },
    ],
    requirements: [],
    summary: null,
  };
}

function makeDoneTask(id, parent = null) {
  return { ...makePendingTask(id, parent), status: "done" };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("T-5: auto-promote function and callers", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("promoteNextPending is no-op when currentTaskId is non-null", () => {
    const state = {
      currentTaskId: "T-1",
      tasks: [
        makePendingTask("T-1"),
        makePendingTask("T-2"),
      ],
    };
    const result = promoteNextPending(state);
    assert.equal(result, null);
    // currentTaskId unchanged
    assert.equal(state.currentTaskId, "T-1");
  });

  it("promoteNextPending selects first pending (forest leaf priority)", () => {
    // Forest: root T-R has children T-C1 (done) and T-C2 (pending).
    // T-C2 should be promoted because T-C1 is already done.
    const state = {
      currentTaskId: null,
      tasks: [
        makePendingTask("T-R"),       // root, pending
        makeDoneTask("T-C1", "T-R"),  // child 1, done
        makePendingTask("T-C2", "T-R"), // child 2, pending (leaf)
      ],
    };
    const result = promoteNextPending(state);
    assert.equal(result, "T-C2");
    assert.equal(state.currentTaskId, "T-C2");
    // The promoted task's status should change to in_progress
    const promoted = state.tasks.find((t) => t.id === "T-C2");
    assert.equal(promoted.status, "in_progress");
  });

  it("promoteNextPending is no-op when tasks[] is empty (flat compatibility)", () => {
    // Empty tasks array — should return null without error.
    const state = {
      currentTaskId: null,
      tasks: [],
    };
    const result = promoteNextPending(state);
    assert.equal(result, null);
    assert.equal(state.currentTaskId, null);
  });

  it("promoteNextPending is no-op when all tasks are done", () => {
    const state = {
      currentTaskId: null,
      tasks: [
        makeDoneTask("T-1"),
        makeDoneTask("T-2"),
      ],
    };
    const result = promoteNextPending(state);
    assert.equal(result, null);
    assert.equal(state.currentTaskId, null);
  });

  it("sync-spec-tasks calls promoteNextPending at the end", () => {
    tmp = createTmpDir();
    // Set up a flow with no tasks synced yet (just a seed task).
    setupFlow(tmp, {
      spec: "specs/226-test-sync/spec.json",
      tasks: [makeDoneTask("T-seed")],
      currentTaskId: null,
    });
    // Write a spec.json with new tasks.
    writeSpecJson(tmp, "specs/226-test-sync/spec.json", baseSpec([
      { id: "T-1", title: "A", goal: "g", origin: "plan", added_round: 0, status: "pending" },
      { id: "T-2", title: "B", goal: "g", origin: "plan", added_round: 0, status: "pending" },
    ]));
    syncSpecTasksToFlow({ root: tmp });

    // After sync, the first new pending task should be auto-promoted
    // into currentTaskId (promoteNextPending called at end of sync).
    const flow = JSON.parse(
      fs.readFileSync(path.join(tmp, "specs/226-test-sync/flow.json"), "utf8"),
    );
    assert.equal(flow.currentTaskId, "T-1");
    const t1 = flow.tasks.find((t) => t.id === "T-1");
    assert.equal(t1.status, "in_progress");
  });

  it("gate-impl PASS post-hook calls completeTask then promoteNextPending", () => {
    tmp = createTmpDir();
    // Set up flow with two tasks: T-1 in_progress, T-2 pending.
    const tasks = [
      { ...makePendingTask("T-1"), status: "in_progress" },
      makePendingTask("T-2"),
    ];
    setupFlow(tmp, {
      spec: "specs/226-gate-impl/spec.md",
      tasks,
      currentTaskId: "T-1",
    });
    const fm = makeFlowManager(tmp);

    // Simulate what the gate-impl PASS post-hook does (registry.js):
    //   1. fm.completeTask(state.currentTaskId)
    //   2. fm.mutate((s) => { promoteNextPending(s); })
    const state = fm.load();
    fm.completeTask(state.currentTaskId);
    fm.mutate((s) => { promoteNextPending(s); });

    const after = fm.load();
    // T-1 completed, T-2 auto-promoted
    const t1 = after.tasks.find((t) => t.id === "T-1");
    assert.equal(t1.status, "done");
    assert.equal(after.currentTaskId, "T-2");
    const t2 = after.tasks.find((t) => t.id === "T-2");
    assert.equal(t2.status, "in_progress");
  });

  it("auto-promote is called from exactly 2 production sites (grep verification)", () => {
    // Grep src/ for actual invocations of promoteNextPending(
    // excluding: definition, imports, comments, test files.
    const srcRoot = path.join(process.cwd(), "src");
    const result = execFileSync("grep", [
      "-rn",
      "promoteNextPending(",
      srcRoot,
      "--include=*.js",
    ], { encoding: "utf8" });

    const lines = result.trim().split("\n").filter((line) => {
      // Exclude: the function definition, imports, and comment-only lines
      if (line.includes("export function promoteNextPending")) return false;
      if (line.includes("import")) return false;
      if (/^\s*\/\//.test(line.split(":").slice(2).join(":"))) return false;
      if (/^\s*\*/.test(line.split(":").slice(2).join(":"))) return false;
      return true;
    });

    // There should be exactly 3 invocation lines across 2 logical sites:
    //   Site 1: sync-spec-tasks.js (1 line)
    //   Site 2: registry.js + run-complete-task.js (2 lines, both gate-impl PASS)
    assert.equal(lines.length, 3, `expected 3 invocation lines, got:\n${lines.join("\n")}`);

    // Verify the files match the expected call sites.
    const files = lines.map((l) => path.basename(l.split(":")[0]));
    assert.ok(files.includes("sync-spec-tasks.js"), "site 1: sync-spec-tasks");
    assert.ok(files.includes("registry.js"), "site 2a: registry gate-impl post-hook");
    assert.ok(files.includes("run-complete-task.js"), "site 2b: run-complete-task CLI");
  });

  it("completeTask does NOT call promoteNextPending (separation of concerns)", () => {
    tmp = createTmpDir();
    const tasks = [
      { ...makePendingTask("T-1"), status: "in_progress" },
      makePendingTask("T-2"),
    ];
    setupFlow(tmp, {
      spec: "specs/226-complete-sep/spec.md",
      tasks,
      currentTaskId: "T-1",
    });
    const fm = makeFlowManager(tmp);

    // Call completeTask only (no explicit promoteNextPending).
    fm.completeTask("T-1");

    // After completeTask, currentTaskId should be null — not auto-promoted.
    const after = fm.load();
    assert.equal(after.currentTaskId, null, "completeTask must NOT auto-promote");
    // T-2 remains pending (not promoted to in_progress).
    const t2 = after.tasks.find((t) => t.id === "T-2");
    assert.equal(t2.status, "pending");
  });

  it("get-next-action returns flow-scope finalize when all tasks done", () => {
    tmp = createTmpDir();
    // All tasks done, no currentTaskId. Flow-level finalize step in_progress.
    const tasks = [
      makeDoneTask("T-1"),
      makeDoneTask("T-2"),
    ];
    const steps = buildInitialSteps();
    // Mark flow steps up through review as done, finalize as in_progress.
    const doneStepIds = [
      "branch", "prepare-spec", "draft", "gate-draft", "spec",
      "gate", "approval", "test", "implement", "gate-impl",
      "integration-write-tests", "integration-run-tests",
      "integration-run-all-tests", "integration-evaluate",
      "review",
    ];
    for (const s of steps) {
      if (doneStepIds.includes(s.id)) s.status = "done";
      else if (s.id === "finalize") s.status = "in_progress";
    }
    setupFlow(tmp, { tasks, currentTaskId: null, steps });
    const fm = makeFlowManager(tmp);
    fm.save(fm.load()); // persist through load/save to validate schema

    const CLI = path.join(process.cwd(), "src/sdd-forge.js");
    const out = execFileSync("node", [CLI, "flow", "get", "next-action"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(out);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.taskId, null, "flow-scope (not task-scope)");
    assert.equal(envelope.data.step, "finalize");
  });

  it("get-next-action keeps task-scope while pending tasks exist", () => {
    tmp = createTmpDir();
    // T-1 is current with impl step in_progress, T-2 still pending.
    const t1 = {
      ...makePendingTask("T-1"),
      status: "in_progress",
      steps: buildInitialTaskSteps("plan"),
    };
    // Set impl step to in_progress
    for (const s of t1.steps) {
      if (s.id === "impl") s.status = "in_progress";
    }
    const tasks = [t1, makePendingTask("T-2")];
    const steps = buildInitialSteps();
    // implement step at flow level must be in_progress for context
    for (const s of steps) {
      if (s.id === "implement") s.status = "in_progress";
    }
    setupFlow(tmp, {
      tasks,
      currentTaskId: "T-1",
      steps,
    });

    const CLI = path.join(process.cwd(), "src/sdd-forge.js");
    const out = execFileSync("node", [CLI, "flow", "get", "next-action"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(out);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.taskId, "T-1", "task-scope target");
    assert.equal(envelope.data.step, "impl");
  });
});
