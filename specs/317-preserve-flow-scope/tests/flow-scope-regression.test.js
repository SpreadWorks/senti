// spec: R1 R2 R3 R4 R5
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Container } from "../../../src/lib/container.js";
import { Command } from "../../../src/lib/command.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";

const ROOT = process.cwd();
const FLOW_CMD = path.join(ROOT, "src/flow.js");
const PLAN_BEFORE_TEST = [
  "branch",
  "prepare-spec",
  "draft",
  "draft-questions-review",
  "draft-questions-triage",
  "draft-questions-repair",
  "draft-refine",
  "draft-coverage-review",
  "draft-coverage-triage",
  "draft-coverage-repair",
  "draft-gate",
  "spec",
  "spec-review",
  "spec-triage",
  "spec-repair",
  "spec-gate",
  "approval",
];
const PLAN_THROUGH_TEST_REVIEW = [
  ...PLAN_BEFORE_TEST,
  "test",
  "scenario-validity",
  "test-review",
];

function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-flow-scope-"));
  return Promise.resolve()
    .then(() => fn(dir))
    .finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

function activeTask() {
  return {
    id: "T-1",
    title: "Active task",
    goal: "Exercise explicit task routing.",
    parent: null,
    origin: "plan",
    added_round: 0,
    status: "in_progress",
    steps: [
      { id: "task-impl", status: "pending" },
      { id: "task-review", status: "pending" },
      { id: "task-gate", status: "pending" },
    ],
  };
}

function setupTestStepFixture(root, testSource) {
  const specId = "001-flow-scope";
  const spec = `specs/${specId}/spec.json`;
  const specDir = path.join(root, "specs", specId);
  fs.mkdirSync(path.join(specDir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    requirements: [{ id: "R1", desc: "Top-level test completion remains flow-scoped." }],
  }), "utf8");
  fs.writeFileSync(path.join(specDir, "tests", "fixture.test.js"), testSource, "utf8");

  const steps = buildInitialSteps();
  for (const id of PLAN_BEFORE_TEST) findStepById(steps, id).status = "done";
  findStepById(steps, "test").status = "in_progress";
  const state = {
    runId: "run-430",
    issue: 430,
    spec,
    baseBranch: "main",
    featureBranch: "feature/001-flow-scope",
    steps,
    requirements: [{ id: "R1", status: "pending" }],
    tasks: [activeTask()],
    currentTaskId: "T-1",
  };
  const flowManager = makeFlowManager(root);
  flowManager.create(state);
  flowManager.addActiveFlow(specId, "branch");
  return { flowManager, spec };
}

function setupTaskImplFixture(root) {
  const specId = "001-task-scope";
  const spec = `specs/${specId}/spec.json`;
  fs.mkdirSync(path.join(root, "specs", specId), { recursive: true });
  fs.writeFileSync(path.join(root, spec), JSON.stringify({ requirements: [] }), "utf8");

  const steps = buildInitialSteps();
  for (const id of PLAN_THROUGH_TEST_REVIEW) findStepById(steps, id).status = "done";
  findStepById(steps, "implement").status = "in_progress";
  const task = activeTask();
  task.steps.find((step) => step.id === "task-impl").status = "in_progress";
  const state = {
    runId: "run-430",
    issue: 430,
    spec,
    baseBranch: "main",
    featureBranch: "feature/001-task-scope",
    steps,
    requirements: [],
    tasks: [task],
    currentTaskId: "T-1",
  };
  const flowManager = makeFlowManager(root);
  flowManager.create(state);
  flowManager.addActiveFlow(specId, "branch");
  return flowManager;
}

function runSetTestDone(root) {
  return execFileSync("node", [FLOW_CMD, "set", "step", "test", "done"], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
}

function validFixtureSource() {
  return "// spec: R1\nimport { test } from 'node:test';\ntest('R1: valid fixture', () => {});\n";
}

function lifecycleState(taskStep = null) {
  const task = activeTask();
  if (taskStep) task.steps.find((step) => step.id === taskStep).status = "in_progress";
  return {
    runId: "run-430",
    issue: 430,
    spec: "specs/demo/spec.json",
    currentTaskId: "T-1",
    steps: [],
    tasks: [task],
  };
}

async function dispatchRuntimeStep({ stepId, flowState = lifecycleState(), argv = [] }) {
  return withTmpDir(async (root) => {
    const calls = [];
    let executed = 0;
    const out = [];
    const exitCodes = [];
    const flowManager = {
      setStepRuntimeLog(id, metadata, opts) {
        calls.push({ id, metadata, opts });
      },
    };
    const container = new Container();
    container.register("config", {});
    container.register("paths", { root, agentWorkDir: path.join(root, ".agent-work") });

    class RuntimeCommand extends Command {
      static outputMode = "envelope";
      execute() {
        executed += 1;
        return { result: "ok" };
      }
    }

    await dispatch({
      container,
      entry: {
        command: async () => ({ default: RuntimeCommand }),
        args: { options: ["--expect-run-id", "--expect-issue", "--expect-spec"] },
        runtimeLog: { stepId },
      },
      argv,
      envelopeType: "run",
      envelopeKey: "review",
      runtimeLog: true,
      stdout: (chunk) => out.push(chunk),
      setExitCode: (code) => exitCodes.push(code),
      buildHookCtx: () => ({ root, specId: flowState.spec, flowState, flowManager }),
    });

    return {
      calls,
      executed,
      envelope: JSON.parse(out.join("")),
      exitCodes,
    };
  });
}

async function dispatchGuardedLifecycle(argv) {
  return withTmpDir(async (root) => {
    const flowState = lifecycleState("task-review");
    flowState.steps = [{ id: "test-review", status: "in_progress" }];
    const mutations = [];
    const metadata = [];
    let executed = 0;
    let validated = 0;
    const out = [];
    const flowManager = {
      updateStepStatus(stepId, status, opts) {
        mutations.push({ stepId, status, opts });
        if (opts.taskId === null) flowState.steps[0].status = status;
        else flowState.tasks[0].steps.find((step) => step.id === stepId).status = status;
      },
      setStepRuntimeLog(stepId, value, opts) {
        metadata.push({ stepId, value, opts });
      },
    };
    const container = new Container();
    container.register("config", {});
    container.register("paths", { root, agentWorkDir: path.join(root, ".agent-work") });

    class LifecycleCommand extends Command {
      static outputMode = "envelope";
      execute() {
        executed += 1;
        return { result: "ok" };
      }
    }

    await dispatch({
      container,
      entry: {
        command: async () => ({ default: LifecycleCommand }),
        args: { options: ["--expect-run-id", "--expect-issue", "--expect-spec"] },
        runtimeLog: { stepId: "test-review" },
        pre() {
          validated += 1;
        },
        post(ctx) {
          ctx.flowManager.updateStepStatus("test-review", "done", { taskId: null });
        },
      },
      argv,
      envelopeType: "run",
      envelopeKey: "review",
      runtimeLog: true,
      stdout: (chunk) => out.push(chunk),
      setExitCode() {},
      buildHookCtx: () => ({ root, specId: flowState.spec, flowState, flowManager }),
    });

    return {
      envelope: JSON.parse(out.join("")),
      executed,
      validated,
      mutations,
      metadata,
      flowStatus: flowState.steps[0].status,
      taskStatus: flowState.tasks[0].steps.find((step) => step.id === "task-review").status,
    };
  });
}

test("R1: top-level test completion stays flow-scoped and preserves header rejection", async () => {
  await withTmpDir(async (root) => {
    const { flowManager } = setupTestStepFixture(root, validFixtureSource());
    const envelope = JSON.parse(runSetTestDone(root));
    assert.equal(envelope.ok, true);
    const state = flowManager.load();
    assert.equal(findStepById(state.steps, "test").status, "done");
    assert.equal(state.tasks[0].steps.every((step) => step.status === "pending"), true);
  });

  for (const source of [
    "import { test } from 'node:test';\ntest('R1: missing header', () => {});\n",
    "// spec: r1\nimport { test } from 'node:test';\ntest('R1: invalid header', () => {});\n",
  ]) {
    await withTmpDir(async (root) => {
      const { flowManager } = setupTestStepFixture(root, source);
      let failure;
      try {
        runSetTestDone(root);
      } catch (error) {
        failure = JSON.parse(error.stdout);
      }
      assert.equal(failure?.errors?.[0]?.code, "TEST_HEADER_VALIDATION_FAILED");
      assert.equal(findStepById(flowManager.load().steps, "test").status, "in_progress");
    });
  }
});

test("R2: runtime metadata scope follows the resolved flow or task step", async () => {
  const flowResult = await dispatchRuntimeStep({ stepId: "test-review" });
  assert.deepEqual(flowResult.calls[0].opts, {
    specId: "specs/demo/spec.json",
    taskId: null,
  });

  for (const stepId of ["task-impl", "task-review", "task-gate"]) {
    const taskResult = await dispatchRuntimeStep({
      stepId,
      flowState: lifecycleState(stepId),
    });
    assert.deepEqual(taskResult.calls[0].opts, {
      specId: "specs/demo/spec.json",
      taskId: "T-1",
    });
  }
});

test("R3: scenario-validity and test-review completion use top-level scope", async () => {
  const updates = [];
  const ctx = {
    phase: "test",
    flowState: lifecycleState(),
    flowManager: {
      appendMetric() {},
      updateStepStatus(stepId, status, opts) {
        updates.push({ stepId, status, opts });
      },
    },
  };

  FLOW_COMMANDS.run["scenario-validity"].post(ctx, { result: "pass" });
  await FLOW_COMMANDS.run.review.post(ctx, {
    artifacts: { phase: "test", verdict: "PASS", blockingCount: 0, advisoryCount: 0 },
  });
  await FLOW_COMMANDS.run.review.post(ctx, {
    artifacts: { phase: "test", verdict: "ADVISORY", blockingCount: 0, advisoryCount: 1 },
  });

  assert.deepEqual(updates, [
    { stepId: "scenario-validity", status: "done", opts: { taskId: null } },
    { stepId: "test-review", status: "done", opts: { taskId: null } },
    { stepId: "test-review", status: "done", opts: { taskId: null } },
  ]);
});

test("R4: task review and gate lifecycle mutations retain explicit task scope", async () => {
  await withTmpDir(async (root) => {
    const flowManager = setupTaskImplFixture(root);
    const envelope = JSON.parse(execFileSync(
      "node",
      [FLOW_CMD, "set", "step", "task-impl", "done"],
      { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: root } },
    ));
    assert.equal(envelope.ok, true);
    const state = flowManager.load();
    assert.equal(state.tasks[0].steps.find((step) => step.id === "task-impl").status, "done");
    assert.equal(findStepById(state.steps, "implement").status, "in_progress");
  });

  const updates = [];
  const flowManager = {
    appendMetric() {},
    updateStepStatus(stepId, status, opts) {
      updates.push({ stepId, status, opts });
    },
  };

  await FLOW_COMMANDS.run.review.post({
    phase: null,
    flowState: lifecycleState("task-review"),
    flowManager,
  }, {
    artifacts: { phase: "impl", verdict: "PASS", blockingCount: 0, nonBlockingCount: 0 },
  });

  await FLOW_COMMANDS.run.gate.pre({
    phase: "task-impl",
    flowState: lifecycleState("task-gate"),
    flowManager,
  });

  assert.deepEqual(updates, [
    { stepId: "task-review", status: "done", opts: { taskId: "T-1" } },
    { stepId: "task-gate", status: "in_progress", opts: { taskId: "T-1" } },
  ]);
});

test("R5: target guards reject mismatches before runtime execution or metadata mutation", async () => {
  const matching = [
    "--expect-run-id", "run-430",
    "--expect-issue", "430",
    "--expect-spec", "specs/demo/spec.json",
  ];
  const mismatches = [
    ["--expect-run-id", "wrong", "--expect-issue", "430", "--expect-spec", "specs/demo/spec.json"],
    ["--expect-run-id", "run-430", "--expect-issue", "999", "--expect-spec", "specs/demo/spec.json"],
    ["--expect-run-id", "run-430", "--expect-issue", "430", "--expect-spec", "specs/other/spec.json"],
  ];

  for (const argv of mismatches) {
    const result = await dispatchGuardedLifecycle(argv);
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(result.validated, 0);
    assert.equal(result.executed, 0);
    assert.deepEqual(result.mutations, []);
    assert.deepEqual(result.metadata, []);
    assert.equal(result.flowStatus, "in_progress");
    assert.equal(result.taskStatus, "in_progress");
  }

  const matched = await dispatchGuardedLifecycle(matching);
  assert.equal(matched.envelope.ok, true);
  assert.equal(matched.validated, 1);
  assert.equal(matched.executed, 1);
  assert.equal(matched.flowStatus, "done");
  assert.equal(matched.taskStatus, "in_progress");
  assert.deepEqual(matched.metadata[0].opts, {
    specId: "specs/demo/spec.json",
    taskId: null,
  });
});
