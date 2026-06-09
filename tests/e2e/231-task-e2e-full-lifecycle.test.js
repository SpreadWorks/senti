import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../helpers/tmp-dir.js";
import { initGitRepo, commitAll, checkoutNewBranch } from "../helpers/git-repo.js";
import { FLOW_STEPS, buildInitialTaskSteps } from "../../src/lib/flow-helpers.js";

const CMD = path.join(process.cwd(), "src/senti.js");

function run(tmp, args) {
  return spawnSync("node", [CMD, ...args], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
  });
}

function parseEnvelope(stdout) {
  return JSON.parse(stdout.trim());
}

function readFlowJson(tmp, specId) {
  return JSON.parse(fs.readFileSync(path.join(tmp, `specs/${specId}/flow.json`), "utf8"));
}

function writeFlowJson(tmp, specId, flow) {
  fs.writeFileSync(path.join(tmp, `specs/${specId}/flow.json`), JSON.stringify(flow, null, 2));
}

function buildFlowTasks(specTasks) {
  return specTasks.map((t) => ({
    id: t.id,
    spec: `specs/test/tasks/${t.id}.md`,
    origin: t.origin,
    parent: t.parent ?? null,
    status: "pending",
    steps: buildInitialTaskSteps(t.origin),
    requirements: [],
    summary: null,
    added_round: t.added_round ?? 0,
  }));
}

function setupBaseFixture(tmp, specId, specTasks) {
  writeJson(tmp, ".senti/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });

  writeJson(tmp, `specs/${specId}/spec.json`, {
    goal: "E2E lifecycle test fixture.",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [
      { id: "R1", desc: "all tasks pass", priority: "must" },
    ],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks: specTasks,
  });

  writeFile(tmp, `specs/${specId}/spec.md`, `# E2E Fixture\n## Goal\nLifecycle test.\n`);

  const flowTasks = buildFlowTasks(specTasks);

  const flowState = {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    steps: FLOW_STEPS.map((id) => ({
      id,
      status: [
        "branch", "prepare-spec", "draft", "draft-gate", "spec", "spec-gate",
        "approval", "test",
      ].includes(id) ? "done" : id === "implement" ? "in_progress" : "pending",
    })),
    requirements: [
      { id: "R1", desc: "all tasks pass", priority: "must", status: "pending" },
    ],
    tasks: flowTasks,
    currentTaskId: null,
    metrics: [],
  };
  writeJson(tmp, `specs/${specId}/flow.json`, flowState);
  writeJson(tmp, ".senti/.active-flow", [{ spec: specId, mode: "local" }]);

  initGitRepo(tmp);
  commitAll(tmp, "initial");
  checkoutNewBranch(tmp, `feature/${specId}`);
  commitAll(tmp, "feature start");
}

function getNextAction(tmp) {
  const res = run(tmp, ["flow", "get", "next-action"]);
  assert.equal(res.status, 0, `next-action failed: stderr=${res.stderr}`);
  return parseEnvelope(res.stdout);
}

function completeTask(tmp, taskId) {
  const res = run(tmp, ["flow", "run", "complete-task", "--task-id", taskId]);
  assert.equal(res.status, 0, `complete-task ${taskId} failed: stderr=${res.stderr}`);
  return parseEnvelope(res.stdout);
}

function activateTask(tmp, specId, taskId) {
  const flow = readFlowJson(tmp, specId);
  flow.currentTaskId = taskId;
  const task = flow.tasks.find((t) => t.id === taskId);
  task.status = "in_progress";
  task.steps[0].status = "in_progress";
  writeFlowJson(tmp, specId, flow);
}

function markTaskStepsDone(tmp, specId, taskId) {
  const flow = readFlowJson(tmp, specId);
  const task = flow.tasks.find((t) => t.id === taskId);
  for (const s of task.steps) s.status = "done";
  writeFlowJson(tmp, specId, flow);
}

describe("231: E2E full lifecycle — flat tasks", () => {
  const SPEC_ID = "001-flat-lifecycle";
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1/R3/R4/R5: task cycling via CLI → all done → finalize-eligible", () => {
    tmp = createTmpDir();
    const specTasks = [
      { id: "T-1", title: "First task", goal: "Do first", parent: null, origin: "plan", added_round: 0, status: "pending" },
      { id: "T-2", title: "Second task", goal: "Do second", parent: null, origin: "plan", added_round: 0, status: "pending" },
    ];
    setupBaseFixture(tmp, SPEC_ID, specTasks);

    // R4: verify tasks are in flow
    const flowInit = readFlowJson(tmp, SPEC_ID);
    assert.equal(flowInit.tasks.length, 2);

    // Activate T-1 (simulate AI choosing T-1)
    activateTask(tmp, SPEC_ID, "T-1");

    // R3: next-action returns task-scope impl for T-1
    let na = getNextAction(tmp);
    assert.equal(na.data.taskId, "T-1");
    assert.equal(na.data.step, "task-impl");

    // Complete all steps of T-1
    markTaskStepsDone(tmp, SPEC_ID, "T-1");

    // R5: complete-task T-1 → should promote T-2
    const ct1 = completeTask(tmp, "T-1");
    assert.equal(ct1.data.completed, true);
    assert.equal(ct1.data.promoted, "T-2");
    const flowAfterT1 = readFlowJson(tmp, SPEC_ID);
    assert.equal(flowAfterT1.tasks[0].status, "done");
    assert.equal(flowAfterT1.currentTaskId, "T-2");

    // Activate T-2's first step (simulate next-action safety-net promotion)
    activateTask(tmp, SPEC_ID, "T-2");

    // R3: next-action returns task-scope for T-2
    na = getNextAction(tmp);
    assert.equal(na.data.taskId, "T-2");

    // Complete T-2
    markTaskStepsDone(tmp, SPEC_ID, "T-2");
    const ct2 = completeTask(tmp, "T-2");
    assert.equal(ct2.data.completed, true);

    // R5: currentTaskId should be null (last task)
    const flowAfterT2 = readFlowJson(tmp, SPEC_ID);
    assert.equal(flowAfterT2.tasks.find((t) => t.id === "T-2").status, "done");
    assert.equal(flowAfterT2.currentTaskId, null);

    // R1: flow should be finalize-eligible (flow-scope step)
    na = getNextAction(tmp);
    assert.ok(
      ["implement", "impl-review", "impl-gate", "finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup"].includes(na.data.step),
      `expected flow-scope step, got ${na.data.step}`,
    );
    assert.equal(na.data.taskId, null);
  });
});

describe("231: E2E full lifecycle — parent-child tasks", () => {
  const SPEC_ID = "002-tree-lifecycle";
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R2/R3/R5: child completion → parent auto-done → finalize-eligible", () => {
    tmp = createTmpDir();
    const specTasks = [
      { id: "T-A", title: "Parent task", goal: "Parent", parent: null, origin: "plan", added_round: 0, status: "pending" },
      { id: "T-A1", title: "Child one", goal: "First child", parent: "T-A", origin: "plan", added_round: 0, status: "pending" },
      { id: "T-A2", title: "Child two", goal: "Second child", parent: "T-A", origin: "plan", added_round: 0, status: "pending" },
    ];
    setupBaseFixture(tmp, SPEC_ID, specTasks);

    assert.equal(readFlowJson(tmp, SPEC_ID).tasks.length, 3);

    // Activate T-A1 (first leaf)
    activateTask(tmp, SPEC_ID, "T-A1");

    // R3: next-action targets T-A1
    let na = getNextAction(tmp);
    assert.equal(na.data.taskId, "T-A1");

    // Complete T-A1
    markTaskStepsDone(tmp, SPEC_ID, "T-A1");
    const ctA1 = completeTask(tmp, "T-A1");
    assert.equal(ctA1.data.promoted, "T-A2");

    // R5: currentTaskId should promote to T-A2
    const flowAfterA1 = readFlowJson(tmp, SPEC_ID);
    assert.equal(flowAfterA1.currentTaskId, "T-A2");

    // Activate T-A2
    activateTask(tmp, SPEC_ID, "T-A2");

    // Complete T-A2
    markTaskStepsDone(tmp, SPEC_ID, "T-A2");
    completeTask(tmp, "T-A2");

    // R2/R5: parent T-A auto-completed, currentTaskId null
    const flowAfterA2 = readFlowJson(tmp, SPEC_ID);
    assert.equal(flowAfterA2.tasks.find((t) => t.id === "T-A").status, "done");
    assert.equal(flowAfterA2.currentTaskId, null);

    // R2: finalize-eligible
    na = getNextAction(tmp);
    assert.ok(
      ["implement", "impl-review", "impl-gate", "finalize-commit", "finalize-merge", "finalize-sync", "finalize-cleanup"].includes(na.data.step),
      `expected flow-scope step, got ${na.data.step}`,
    );
  });
});
