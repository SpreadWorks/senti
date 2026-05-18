// spec: R1 R2 R3 R4 R5 R6
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { buildInitialSteps, buildInitialTaskSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/definition.js";
import { generateReport } from "../../../src/flow/commands/report.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const CMD = path.join(ROOT, "src/sdd-forge.js");
const SPEC_ID = "001-task-scoped-flow";

function run(tmp, args) {
  return spawnSync("node", [CMD, ...args], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
  });
}

function parseEnvelope(res) {
  return JSON.parse((res.stdout || "").trim());
}

function expectEnvelopeFailure(res, pattern) {
  assert.notEqual(res.status, 0, "command must fail");
  const env = parseEnvelope(res);
  assert.equal(env.ok, false);
  assert.match(JSON.stringify(env.errors), pattern);
  return env;
}

function writeFixtureSpec(tmp) {
  writeJson(tmp, `specs/${SPEC_ID}/spec.json`, {
    goal: "Task scoped flow fixture.",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [
      { id: "R1", desc: "cursor promotion", priority: "must" },
      { id: "R2", desc: "null cursor failure", priority: "must" },
    ],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks: [
      { id: "T-1", title: "First task", goal: "Do first task.", parent: null, origin: "plan", added_round: 0, status: "pending" },
      { id: "T-2", title: "Second task", goal: "Do second task.", parent: null, origin: "plan", added_round: 0, status: "pending" },
    ],
  });
  writeFile(tmp, `specs/${SPEC_ID}/tasks/T-1.md`, "# T-1\n\nTask spec for T-1.\n");
  writeFile(tmp, `specs/${SPEC_ID}/tasks/T-2.md`, "# T-2\n\nTask spec for T-2.\n");
}

function makeTask(id, overrides = {}) {
  return {
    id,
    spec: `specs/${SPEC_ID}/tasks/${id}.md`,
    origin: "plan",
    parent: null,
    status: "pending",
    steps: buildInitialTaskSteps("plan"),
    requirements: [],
    summary: null,
    added_round: 0,
    ...overrides,
  };
}

function inProgressTask(id, stepId = "impl") {
  return makeTask(id, {
    status: "in_progress",
    steps: buildInitialTaskSteps("plan").map((step) => ({
      ...step,
      status: step.id === stepId ? "in_progress" : "pending",
    })),
  });
}

function writeFlow(tmp, overrides = {}) {
  const steps = buildInitialSteps();
  for (const id of ["branch", "prepare-spec", "draft", "review-draft-questions", "draft-refine", "review-draft-coverage", "gate-draft", "spec", "review-spec", "spec-review-triage", "spec-repair", "gate", "approval", "test", "review-test"]) {
    const step = findStepById(steps, id);
    if (step) step.status = "done";
  }
  const implement = findStepById(steps, "implement");
  implement.status = "in_progress";

  const state = {
    spec: `specs/${SPEC_ID}/spec.json`,
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    steps,
    requirements: [],
    tasks: [makeTask("T-1"), makeTask("T-2")],
    currentTaskId: null,
    metrics: [],
    notes: [],
    issueLog: [],
    ...overrides,
  };
  writeJson(tmp, `specs/${SPEC_ID}/flow.json`, state);
  writeJson(tmp, ".sdd-forge/.active-flow", [{ spec: SPEC_ID, mode: "local" }]);
  return state;
}

function setup(overrides = {}) {
  const tmp = createTmpDir();
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0", type: "module" });
  writeFixtureSpec(tmp);
  writeFlow(tmp, overrides);
  return tmp;
}

function readFlow(tmp) {
  return JSON.parse(fs.readFileSync(path.join(tmp, `specs/${SPEC_ID}/flow.json`), "utf8"));
}

describe("spec 258 task-scoped implementation flow", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: promotes a pending leaf before returning flow-level implementation", () => {
    tmp = setup();

    const res = run(tmp, ["flow", "get", "next-action"]);
    assert.equal(res.status, 0, res.stderr);
    const env = parseEnvelope(res);

    assert.equal(env.data.taskId, "T-1");
    assert.equal(env.data.step, "impl");
    assert.equal(readFlow(tmp).currentTaskId, "T-1");
  });

  it("R1: promotes a child leaf before its pending parent", () => {
    tmp = setup({
      tasks: [
        makeTask("T-parent"),
        makeTask("T-child", { parent: "T-parent" }),
      ],
    });

    const res = run(tmp, ["flow", "get", "next-action"]);
    assert.equal(res.status, 0, res.stderr);
    const env = parseEnvelope(res);

    assert.equal(env.data.taskId, "T-child");
    assert.equal(readFlow(tmp).currentTaskId, "T-child");
  });

  it("R1: preserves an existing currentTaskId and does not promote another task", () => {
    tmp = setup({ tasks: [inProgressTask("T-1"), makeTask("T-2")], currentTaskId: "T-1" });

    const res = run(tmp, ["flow", "get", "next-action"]);
    assert.equal(res.status, 0, res.stderr);
    const env = parseEnvelope(res);

    assert.equal(env.data.taskId, "T-1");
    assert.equal(readFlow(tmp).currentTaskId, "T-1");
  });

  it("R1: does not promote when no task exists", () => {
    tmp = setup({ tasks: [] });

    const res = run(tmp, ["flow", "get", "next-action"]);
    assert.equal(res.status, 0, res.stderr);
    const env = parseEnvelope(res);

    assert.equal(env.data.taskId, null);
    assert.equal(readFlow(tmp).currentTaskId, null);
  });

  it("R2: ignores legacy task entries without rendered task specs", () => {
    tmp = setup({
      tasks: [
        {
          id: "T-legacy",
          title: "legacy",
          goal: "legacy",
          parent: null,
          origin: "plan",
          added_round: 0,
          status: "pending",
          steps: [],
        },
      ],
    });

    const res = run(tmp, ["flow", "get", "next-action"]);
    assert.equal(res.status, 0, res.stderr);
    const env = parseEnvelope(res);

    assert.equal(env.data.taskId, null);
    assert.equal(readFlow(tmp).currentTaskId, null);
  });

  it("R2: rejects orphaned null cursor state instead of running broad implementation", () => {
    tmp = setup({
      tasks: [
        makeTask("T-1", {
          status: "in_progress",
          steps: [
            { id: "impl", status: "in_progress" },
            { id: "review", status: "pending" },
            { id: "gate-impl", status: "pending" },
          ],
        }),
        makeTask("T-2"),
      ],
    });

    expectEnvelopeFailure(run(tmp, ["flow", "get", "next-action"]), /currentTaskId|task cursor|broad/i);
  });

  it("R2: rejects flow-level review when task work remains without broad mode", () => {
    tmp = setup({ tasks: [inProgressTask("T-1", "review"), makeTask("T-2")] });

    expectEnvelopeFailure(run(tmp, ["flow", "run", "review"]), /currentTaskId|task cursor|broad/i);
  });

  it("R2: rejects flow-level gate when task work remains without broad mode", () => {
    tmp = setup({ tasks: [inProgressTask("T-1", "gate-impl"), makeTask("T-2")] });

    expectEnvelopeFailure(run(tmp, ["flow", "run", "gate", "--phase", "integration"]), /currentTaskId|task cursor|broad/i);
  });

  it("R2: failed unsafe flow-level step does not mutate task cursor state", () => {
    const tasks = [inProgressTask("T-1", "impl"), makeTask("T-2")];
    tmp = setup({ tasks });
    const before = readFlow(tmp);

    expectEnvelopeFailure(run(tmp, ["flow", "get", "next-action"]), /currentTaskId|task cursor|broad/i);
    const after = readFlow(tmp);

    assert.equal(after.currentTaskId, before.currentTaskId);
    assert.deepEqual(after.tasks.map((t) => [t.id, t.status]), before.tasks.map((t) => [t.id, t.status]));
  });

  it("R2: rejects currentTaskId that references a missing task", () => {
    tmp = setup({ currentTaskId: "T-missing" });

    expectEnvelopeFailure(run(tmp, ["flow", "get", "next-action"]), /T-missing|currentTaskId|task cursor/i);
  });

  it("R2: rejects task review when currentTaskId is missing", () => {
    tmp = setup({ tasks: [inProgressTask("T-1", "review")] });

    expectEnvelopeFailure(run(tmp, ["flow", "run", "review", "--phase", "impl"]), /currentTaskId|task cursor|broad/i);
  });

  it("R3: task gate uses the rendered current task spec as context", () => {
    const t1 = makeTask("T-1", {
      status: "in_progress",
      steps: [
        { id: "impl", status: "done" },
        { id: "review", status: "done" },
        { id: "gate-impl", status: "in_progress" },
      ],
    });
    tmp = setup({ tasks: [t1, makeTask("T-2")], currentTaskId: "T-1" });

    const res = run(tmp, ["flow", "get", "next-action"]);
    assert.equal(res.status, 0, res.stderr);
    const env = parseEnvelope(res);

    assert.equal(env.data.taskId, "T-1");
    assert.equal(env.data.step, "gate-impl");
    assert.equal(env.data.context.paths.task_spec, `specs/${SPEC_ID}/tasks/T-1.md`);
    assert.equal(env.data.context.paths.spec, undefined);
  });

  it("R3: task gate fails when the rendered current task spec is missing", () => {
    const t1 = inProgressTask("T-1", "gate-impl");
    tmp = setup({ tasks: [t1], currentTaskId: "T-1" });
    fs.rmSync(path.join(tmp, `specs/${SPEC_ID}/tasks/T-1.md`));

    expectEnvelopeFailure(run(tmp, ["flow", "run", "gate", "--phase", "task-impl"]), /task spec|T-1|missing/i);
  });

  it("R4: broad implementation requires an audited non-empty reason", () => {
    tmp = setup({
      tasks: [
        makeTask("T-1", {
          status: "in_progress",
          steps: [{ id: "impl", status: "in_progress" }],
        }),
      ],
    });

    const empty = run(tmp, ["flow", "set", "broad", "on", "--step", "implement", "--reason", ""]);
    assert.notEqual(empty.status, 0, "empty broad reason must fail");

    const enabled = run(tmp, ["flow", "set", "broad", "on", "--step", "implement", "--reason", "bulk fixture"]);
    assert.equal(enabled.status, 0, enabled.stderr);
    const env = parseEnvelope(enabled);
    assert.equal(env.ok, true);
    assert.equal(env.data.broadMode.step, "implement");
    assert.equal(env.data.broadMode.reason, "bulk fixture");
  });

  it("R4: broad mode rejects whitespace-only reason", () => {
    tmp = setup({ tasks: [inProgressTask("T-1")] });

    expectEnvelopeFailure(
      run(tmp, ["flow", "set", "broad", "on", "--step", "implement", "--reason", "   "]),
      /reason/i,
    );
  });

  it("R4: status output includes broad-mode audit metadata", () => {
    tmp = setup({ tasks: [inProgressTask("T-1")] });

    const enabled = run(tmp, ["flow", "set", "broad", "on", "--step", "implement", "--reason", "bulk fixture"]);
    assert.equal(enabled.status, 0, enabled.stderr);
    const status = run(tmp, ["flow", "get", "status"]);
    assert.equal(status.status, 0, status.stderr);
    const env = parseEnvelope(status);

    assert.match(JSON.stringify(env.data), /bulk fixture/);
    assert.match(JSON.stringify(env.data), /implement/);
  });

  it("R4: broad review and gate require matching audited steps", () => {
    tmp = setup({ tasks: [inProgressTask("T-1", "review")] });

    const review = run(tmp, ["flow", "set", "broad", "on", "--step", "review", "--reason", "bulk review"]);
    assert.equal(review.status, 0, review.stderr);
    const gate = run(tmp, ["flow", "set", "broad", "on", "--step", "gate-impl", "--reason", "bulk gate"]);
    assert.equal(gate.status, 0, gate.stderr);
    const flow = readFlow(tmp);

    assert.match(JSON.stringify(flow), /bulk review/);
    assert.match(JSON.stringify(flow), /bulk gate/);
  });

  it("R5: task completion output includes next task guidance", () => {
    const t1 = makeTask("T-1", {
      status: "in_progress",
      steps: [
        { id: "impl", status: "done" },
        { id: "review", status: "done" },
        { id: "gate-impl", status: "done" },
      ],
    });
    tmp = setup({ tasks: [t1, makeTask("T-2")], currentTaskId: "T-1" });

    const res = run(tmp, ["flow", "run", "complete-task", "--task-id", "T-1"]);
    assert.equal(res.status, 0, res.stderr);
    const env = parseEnvelope(res);

    assert.equal(env.data.completedTaskId, "T-1");
    assert.equal(env.data.nextTaskId, "T-2");
    assert.match(env.data.nextAction, /T-2|next task/i);
  });

  it("R6: report output includes task result rows and broad audit records", () => {
    const report = generateReport({
      state: {
        metrics: [],
        tasks: [
          makeTask("T-1", { status: "done", summary: "implemented" }),
          makeTask("T-2", { status: "pending" }),
        ],
        broadModeHistory: [
          { step: "implement", reason: "bulk fixture", currentTaskId: null, ts: "2026-01-01T00:00:00.000Z" },
        ],
      },
      results: {
        testExecute: {
          summary: [{ requirementId: "R1", result: "pass" }],
          rawOutputPath: "specs/258-task-scoped-impl-flow/tests/.raw/test-execution.log",
        },
        testResultReview: { verdict: "pass" },
      },
      issueLog: { entries: [] },
      implDiffStat: "",
      commitMessages: [],
    });

    const text = report.text;
    const data = JSON.stringify(report.data);

    assert.match(text + data, /T-1/);
    assert.match(text + data, /T-2/);
    assert.match(text + data, /bulk fixture/);
    assert.match(text + data, /missing|unavailable|pending/i);
  });

  it("R6: report output preserves mixed task statuses without artifacts", () => {
    const report = generateReport({
      state: {
        metrics: [],
        tasks: [
          makeTask("T-pass", { status: "done" }),
          makeTask("T-fail", { status: "in_progress" }),
          makeTask("T-skip", { status: "skipped" }),
        ],
      },
      results: {},
      issueLog: { entries: [] },
      implDiffStat: "",
      commitMessages: [],
    });

    const rendered = report.text + JSON.stringify(report.data);
    assert.match(rendered, /T-pass/);
    assert.match(rendered, /T-fail/);
    assert.match(rendered, /T-skip/);
    assert.match(rendered, /missing|unavailable|No test data/i);
  });
});
