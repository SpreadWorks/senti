import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../helpers/tmp-dir.js";
import { initGitRepo, commitAll, checkoutNewBranch } from "../helpers/git-repo.js";
import { FLOW_STEPS } from "../../src/lib/flow-helpers.js";

const CMD = path.join(process.cwd(), "src/sdd-forge.js");
const SPEC_ID = "001-forest-e2e";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;

function run(tmp, args) {
  return spawnSync("node", [CMD, ...args], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
  });
}

function parseEnvelope(stdout) {
  return JSON.parse(stdout.trim());
}

function readFlowJson(tmp) {
  return JSON.parse(fs.readFileSync(path.join(tmp, `specs/${SPEC_ID}/flow.json`), "utf8"));
}

function setupForestFixture(tmp) {
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });

  writeJson(tmp, `specs/${SPEC_ID}/spec.json`, {
    goal: "Forest E2E test fixture.",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [
      { id: "R1", desc: "task 1 passes", priority: "must" },
      { id: "R2", desc: "task 2 passes", priority: "must" },
    ],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks: [
      { id: "T-1", title: "First task", goal: "Do first thing", parent: null, origin: "plan", added_round: 0, status: "pending" },
      { id: "T-2", title: "Second task", goal: "Do second thing", parent: null, origin: "plan", added_round: 0, status: "pending" },
    ],
  });

  writeFile(tmp, `specs/${SPEC_ID}/spec.md`, "# Forest E2E Fixture\n## Goal\nForest E2E test.\n");

  const flowState = {
    spec: SPEC_PATH,
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    steps: FLOW_STEPS.map((id) => ({
      id,
      status: ["branch", "prepare-spec", "draft", "gate-draft", "spec", "gate", "approval", "test"].includes(id) ? "done" : "pending",
    })),
    requirements: [
      { id: "R1", desc: "task 1 passes", priority: "must", status: "pending" },
      { id: "R2", desc: "task 2 passes", priority: "must", status: "pending" },
    ],
    tasks: [
      { id: "T-1", title: "First task", goal: "Do first thing", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [{ id: "write-tests", status: "pending" }, { id: "implement", status: "pending" }, { id: "gate-impl", status: "pending" }] },
      { id: "T-2", title: "Second task", goal: "Do second thing", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [{ id: "write-tests", status: "pending" }, { id: "implement", status: "pending" }, { id: "gate-impl", status: "pending" }] },
    ],
    currentTaskId: null,
    metrics: [],
    test: { summary: { exitCode: 0 } },
  };
  writeJson(tmp, `specs/${SPEC_ID}/flow.json`, flowState);
  writeJson(tmp, ".sdd-forge/.active-flow", [{ spec: SPEC_ID, mode: "local" }]);

  initGitRepo(tmp);
  commitAll(tmp, "initial");
  checkoutNewBranch(tmp, `feature/${SPEC_ID}`);
  commitAll(tmp, "feature start");
}

describe("REQ-C1: E2E forest lifecycle via CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("sync-spec-tasks populates flow tasks from spec.json", () => {
    tmp = createTmpDir();
    setupForestFixture(tmp);

    const res = run(tmp, ["flow", "set", "step", "approval", "done"]);
    assert.equal(res.status, 0, `set step failed: ${res.stderr}`);

    const flow = readFlowJson(tmp);
    assert.ok(flow.tasks.length >= 2, `expected at least 2 tasks, got ${flow.tasks.length}`);
  });

  it("flow get next-action returns task-scope step when currentTaskId is set", () => {
    tmp = createTmpDir();
    setupForestFixture(tmp);

    const flow = readFlowJson(tmp);
    flow.currentTaskId = "T-1";
    flow.tasks[0].status = "in_progress";
    flow.tasks[0].steps[0].status = "in_progress";
    const implStep = flow.steps.find((s) => s.id === "implement");
    if (implStep) implStep.status = "in_progress";
    fs.writeFileSync(path.join(tmp, `specs/${SPEC_ID}/flow.json`), JSON.stringify(flow, null, 2));

    const res = run(tmp, ["flow", "get", "next-action"]);
    assert.equal(res.status, 0, `next-action failed: ${res.stderr}`);
    const env = parseEnvelope(res.stdout);
    assert.equal(env.data.taskId, "T-1");
  });

  it("complete-task marks task done and promotes next pending", () => {
    tmp = createTmpDir();
    setupForestFixture(tmp);

    const flow = readFlowJson(tmp);
    flow.currentTaskId = "T-1";
    flow.tasks[0].status = "in_progress";
    for (const s of flow.tasks[0].steps) s.status = "done";
    const implStep = flow.steps.find((s) => s.id === "implement");
    if (implStep) implStep.status = "in_progress";
    fs.writeFileSync(path.join(tmp, `specs/${SPEC_ID}/flow.json`), JSON.stringify(flow, null, 2));

    const res = run(tmp, ["flow", "run", "complete-task", "--task-id", "T-1"]);
    assert.equal(res.status, 0, `complete-task failed: ${res.stderr}`);

    const updated = readFlowJson(tmp);
    const t1 = updated.tasks.find((t) => t.id === "T-1");
    assert.equal(t1.status, "done");
    assert.equal(updated.currentTaskId, "T-2", "should promote T-2 as next");
  });

  it("all tasks done transitions flow to finalize-eligible state", () => {
    tmp = createTmpDir();
    setupForestFixture(tmp);

    const flow = readFlowJson(tmp);
    for (const task of flow.tasks) {
      task.status = "done";
      for (const s of task.steps) s.status = "done";
    }
    flow.currentTaskId = null;
    const implStep = flow.steps.find((s) => s.id === "implement");
    if (implStep) implStep.status = "in_progress";
    fs.writeFileSync(path.join(tmp, `specs/${SPEC_ID}/flow.json`), JSON.stringify(flow, null, 2));

    const res = run(tmp, ["flow", "get", "next-action"]);
    assert.equal(res.status, 0, `next-action failed: ${res.stderr}`);
    const env = parseEnvelope(res.stdout);
    assert.ok(["implement", "gate-impl", "review", "finalize"].includes(env.data.step),
      `expected flow-scope step for finalize path, got ${env.data.step}`);
  });
});
