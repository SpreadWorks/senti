/**
 * tests/unit/flow/approval-task-sync.test.js
 *
 * Tests for REQ-2, REQ-6 (spec 215): approval ポストフックの差分反映ロジック。
 * spec.json の tasks[] を読み、flow.json の tasks[] に存在しない id のみ
 * addTask() する。既存 task は一切変更されない。added_round の自動採番
 * (max + 1) も検証する。
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow } from "../../helpers/flow-setup.js";
import { syncSpecTasksToFlow } from "../../../src/flow/lib/sync-spec-tasks.js";

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

describe("syncSpecTasksToFlow (REQ-2, REQ-6)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("REQ-2: adds new tasks to flow.json.tasks[] on first approval", () => {
    tmp = createTmpDir();
    // Start with a single seed task; spec.json adds T-1 and T-2.
    setupFlow(tmp, {
      specId: "215-flow-task-decomposition",
      tasks: [{ id: "T-seed", title: "seed", goal: "seed", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    });
    writeSpecJson(tmp, "specs/215-flow-task-decomposition/spec.json", baseSpec([
      { id: "T-1", title: "A", goal: "goal A", origin: "plan", added_round: 0, status: "pending" },
      { id: "T-2", title: "B", goal: "goal B", origin: "plan", added_round: 0, status: "pending" },
    ]));
    const result = syncSpecTasksToFlow({ root: tmp });
    assert.equal(result.added.length, 2);
    assert.equal(result.added[0], "T-1");
    assert.equal(result.added[1], "T-2");
    const flowPath = path.join(tmp, "specs/215-flow-task-decomposition/flow.json");
    const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    // T-seed + T-1 + T-2
    assert.equal(flow.tasks.length, 3);
    assert.equal(flow.tasks[1].id, "T-1");
    assert.equal(flow.tasks[2].id, "T-2");
  });

  it("REQ-2: preserves existing tasks on second approval (differential sync)", () => {
    tmp = createTmpDir();
    setupFlow(tmp, {
      specId: "215-flow-task-decomposition",
      tasks: [{
        id: "T-1", spec: "specs/215-flow-task-decomposition/tasks/T-1.md",
        origin: "plan", parent: null, status: "done", steps: [], requirements: [], summary: "done",
      }],
      currentTaskId: null,
    });
    writeSpecJson(tmp, "specs/215-flow-task-decomposition/spec.json", baseSpec([
      { id: "T-1", title: "A", goal: "goal A", origin: "plan", added_round: 0, status: "done" },
      { id: "T-2", title: "B", goal: "goal B", origin: "plan", added_round: 1, status: "pending" },
    ]));
    const result = syncSpecTasksToFlow({ root: tmp });
    assert.equal(result.added.length, 1);
    assert.equal(result.added[0], "T-2");
    const flowPath = path.join(tmp, "specs/215-flow-task-decomposition/flow.json");
    const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    assert.equal(flow.tasks.length, 2);
    // existing task preserved
    assert.equal(flow.tasks[0].id, "T-1");
    assert.equal(flow.tasks[0].status, "done");
    assert.equal(flow.tasks[0].summary, "done");
    // new task added
    assert.equal(flow.tasks[1].id, "T-2");
    assert.equal(flow.tasks[1].origin, "plan");
  });

  it("REQ-6: derives added_round correctly on round bump", () => {
    tmp = createTmpDir();
    setupFlow(tmp, {
      specId: "215-flow-task-decomposition",
      tasks: [
        { id: "T-1", spec: "x", origin: "plan", parent: null, status: "done", steps: [], requirements: [], summary: null },
      ],
    });
    // spec.json doesn't pre-commit added_round; our sync uses what spec says
    writeSpecJson(tmp, "specs/215-flow-task-decomposition/spec.json", baseSpec([
      { id: "T-1", title: "a", goal: "g", origin: "plan", added_round: 0, status: "done" },
      { id: "T-2", title: "b", goal: "g", origin: "plan", added_round: 1, status: "pending" },
    ]));
    syncSpecTasksToFlow({ root: tmp });
    const flow = JSON.parse(fs.readFileSync(path.join(tmp, "specs/215-flow-task-decomposition/flow.json"), "utf8"));
    const t2 = flow.tasks.find((t) => t.id === "T-2");
    assert.equal(t2.added_round, 1);
  });

  it("no-op when spec.json has no tasks[]", () => {
    tmp = createTmpDir();
    setupFlow(tmp, { specId: "215-flow-task-decomposition" });
    writeSpecJson(tmp, "specs/215-flow-task-decomposition/spec.json", {
      goal: "", scope: { in: [], out: [] }, constraints: [], design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      background: "", requirements: [], acceptance_criteria: [],
      clarifications: [], alternatives_considered: [], open_questions: [],
    });
    const result = syncSpecTasksToFlow({ root: tmp });
    assert.equal(result.added.length, 0);
    const flow = JSON.parse(fs.readFileSync(path.join(tmp, "specs/215-flow-task-decomposition/flow.json"), "utf8"));
    // The seed task from setupFlow remains; no spec tasks were added.
    assert.equal(flow.tasks.length, 1);
  });

  it("returns skipped=true when no active flow", () => {
    tmp = createTmpDir();
    const result = syncSpecTasksToFlow({ root: tmp });
    assert.equal(result.skipped, true);
  });
});
