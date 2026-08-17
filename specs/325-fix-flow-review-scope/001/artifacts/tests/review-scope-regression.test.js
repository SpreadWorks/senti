// spec: R1 R2 R3 R4 R5 R6

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import RunReviewCommand, {
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";
import * as runReview from "../../../src/flow/lib/run-review.js";
import * as taskScope from "../../../src/flow/lib/task-scope.js";
import { TaskScopeDecision } from "../../../src/flow/lib/task-scope.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  RetryOutcome,
  StepAttempt,
} from "../../../src/flow/lib/step-outcome.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import {
  makeContainer,
  setupFlowAtStep,
} from "../../../tests/helpers/flow-setup.js";

function task(id, {
  status = "pending",
  reviewStatus = "pending",
  spec = `specs/demo/tasks/${id}.md`,
} = {}) {
  return {
    id,
    title: id,
    goal: `Implement ${id}`,
    parent: null,
    origin: "plan",
    added_round: 0,
    spec,
    status,
    steps: [
      { id: "task-impl", status: "done" },
      { id: "task-review", status: reviewStatus },
      { id: "task-gate", status: "pending" },
    ],
  };
}

function flowState({
  flowReviewStatus = "in_progress",
  currentTaskId = "T-1",
  tasks = [task("T-1")],
  broadModeHistory = [],
} = {}) {
  return {
    runId: "run-review-scope",
    issue: 448,
    spec: "specs/demo/spec.json",
    currentTaskId,
    steps: [{
      id: "impl",
      status: "pending",
      children: [
        { id: "impl-review", status: flowReviewStatus },
        { id: "impl-triage", status: "pending" },
        { id: "impl-repair", status: "pending" },
        { id: "impl-gate", status: "pending" },
      ],
    }],
    tasks,
    metrics: [],
    stepAttempts: [],
    broadModeHistory,
  };
}

function resolveImplReviewScope(state) {
  const decision = taskScope.resolveImplReviewScope(state);
  assert.ok(decision instanceof TaskScopeDecision);
  return decision;
}

function findStep(steps, id) {
  for (const step of steps || []) {
    if (step.id === id) return step;
    const nested = findStep(step.children, id);
    if (nested) return nested;
  }
  return null;
}

function flowManagerFor(state, calls = {}) {
  calls.metrics ||= [];
  calls.updates ||= [];
  calls.mutations ||= [];
  return {
    appendMetric(payload, opts = {}) {
      const taskId = Object.hasOwn(opts, "taskId")
        ? opts.taskId
        : state.currentTaskId ?? null;
      const stored = { ...payload, taskId };
      state.metrics.push(stored);
      calls.metrics.push({ payload, opts });
    },
    mutate(callback) {
      calls.mutations.push("mutate");
      calls.events?.push("mutate");
      callback(state);
    },
    updateStepStatus(stepId, status, opts = {}) {
      calls.updates.push({ stepId, status, opts });
      const target = opts.taskId == null
        ? findStep(state.steps, stepId)
        : findStep(state.tasks.find((entry) => entry.id === opts.taskId)?.steps, stepId);
      assert.ok(target, `missing ${stepId} in requested scope`);
      target.status = status;
    },
  };
}

function implResult(verdict, {
  taskId = null,
  blockingCount = verdict === "FAIL" ? 1 : 0,
  nonBlockingCount = verdict === "ADVISORY" ? 1 : 0,
} = {}) {
  return {
    result: "ok",
    artifacts: {
      phase: "impl",
      verdict,
      taskId,
      blockingCount,
      nonBlockingCount,
    },
    next: verdict === "FAIL" ? null : "impl-gate",
  };
}

function writeJson(root, relativePath, value) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function prepareFlowReviewEvidence(root, state) {
  writeJson(root, state.spec, { requirements: [] });
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec });
  for (const file of ["test-execute-result.json", "test-result-review.json"]) {
    writeJson(root, path.join(path.dirname(state.spec), file), {
      repairFingerprint: fingerprint.hash,
    });
  }
}

function prepareImplReviewArtifact(root, state, verdict) {
  prepareFlowReviewEvidence(root, state);
  const fingerprint = buildRepairFingerprint({ root, specPath: state.spec });
  writeJson(root, path.join(path.dirname(state.spec), "impl-review.json"), {
    verdict,
    blockingFindings: [],
    nonBlockingImprovements: verdict === "ADVISORY"
      ? [{ findingKey: "fixture-advisory", rationale: "Lifecycle fixture advisory." }]
      : [],
    repairFingerprint: fingerprint.hash,
  });
}

function successfulReviewProcess() {
  return {
    ok: true,
    status: 0,
    stdout: "Impl review completed.",
    stderr: "[impl-review] verdict=PASS blocking=0 nonBlocking=0",
    signal: null,
    killed: false,
  };
}

function retryAttempts({ taskId, stepId, count }) {
  return Array.from({ length: count }, (_, index) => new StepAttempt({
    runId: "run-review-scope",
    taskId,
    stepId,
    attempt: index + 1,
    outcome: new RetryOutcome({
      nextAction: taskId == null ? "run-review" : "run-review-task",
    }),
  }).toJSON());
}

function recordingCommand(events, processCalls) {
  return new RunReviewCommand({
    resolveScope(state) {
      events.push("resolve-scope");
      return taskScope.resolveImplReviewScope(state);
    },
    runCommand(command, args, opts) {
      events.push("subprocess");
      processCalls.push({ command, args, opts });
      return successfulReviewProcess();
    },
  });
}

test("R1: active review leaves resolve the complete flow, task, broad, and invalid matrix", () => {
  assert.equal(resolveImplReviewScope(flowState()).kind, "flow");

  const noActionableTaskSets = [
    [task("T-1", { status: "done" })],
    [task("T-1", { status: "skipped" })],
    [task("T-1", { status: "pending", spec: "" })],
  ];
  for (const tasks of noActionableTaskSets) {
    const noActionableWork = flowState({ currentTaskId: null, tasks });
    assert.equal(resolveImplReviewScope(noActionableWork).kind, "flow");
  }

  const actionableWithoutBroad = resolveImplReviewScope(flowState({ currentTaskId: null }));
  assert.equal(actionableWithoutBroad.blocked, true);
  assert.ok(actionableWithoutBroad.reason.trim());

  const broadReason = "Review the explicitly approved broad implementation diff.";
  const broad = resolveImplReviewScope(flowState({
    currentTaskId: null,
    broadModeHistory: [{
      step: "impl-review",
      reason: broadReason,
      ts: "2026-07-21T00:00:00.000Z",
      currentTaskId: null,
    }],
  }));
  assert.equal(broad.kind, "broad");
  assert.equal(broad.record.reason, broadReason);

  const taskOnly = flowState({
    flowReviewStatus: "pending",
    tasks: [task("T-1", { status: "in_progress", reviewStatus: "in_progress" })],
  });
  const taskDecision = resolveImplReviewScope(taskOnly);
  assert.equal(taskDecision.kind, "task");
  assert.equal(taskDecision.task.id, "T-1");

  const invalidStates = [
    flowState({
      tasks: [task("T-1", { status: "in_progress", reviewStatus: "in_progress" })],
    }),
    flowState({
      tasks: [
        task("T-1", { status: "in_progress", reviewStatus: "in_progress" }),
        task("T-2", { status: "in_progress", reviewStatus: "in_progress" }),
      ],
    }),
    flowState({ flowReviewStatus: "pending" }),
    flowState({ currentTaskId: "missing" }),
    flowState({
      flowReviewStatus: "pending",
      currentTaskId: "T-1",
      tasks: [
        task("T-1", { status: "in_progress" }),
        task("T-2", { status: "in_progress", reviewStatus: "in_progress" }),
      ],
    }),
  ];
  for (const state of invalidStates) {
    const decision = resolveImplReviewScope(state);
    assert.equal(decision.blocked, true);
    assert.ok(decision.reason.trim());
  }
});

test("R2: RunReviewCommand uses one scope decision for flow and task execution", async () => {
  const root = createTmpDir("issue-448-command-scope-");
  try {
    const state = flowState();
    state.reviewStop = { phase: "impl", classification: "provider_failure" };
    prepareFlowReviewEvidence(root, state);
    const events = [];
    const processCalls = [];
    const calls = { events };
    const ctx = {
      root,
      phase: null,
      flowState: state,
      flowManager: flowManagerFor(state, calls),
      config: {},
    };
    const result = await recordingCommand(events, processCalls).execute(ctx);

    assert.deepEqual(events.slice(0, 3), ["resolve-scope", "mutate", "subprocess"]);
    assert.equal(events.filter((entry) => entry === "resolve-scope").length, 1);
    assert.equal(processCalls.length, 1);
    assert.equal(processCalls[0].args.includes("--task-spec"), false);
    assert.equal(result.artifacts.taskId, null);

    updateReviewRetryCounter(ctx, result);
    assert.deepEqual(calls.metrics, [{
      payload: { phase: "impl", counter: "reviewRetry", delta: 0, reset: true },
      opts: { taskId: null },
    }]);
    assert.equal(result.stepAttempt.taskId, null);
    assert.equal(result.stepAttempt.stepId, "impl-review");

    const scoped = flowState({
      flowReviewStatus: "pending",
      tasks: [task("T-1", { status: "in_progress", reviewStatus: "in_progress" })],
    });
    writeJson(root, scoped.tasks[0].spec, "task spec");
    const scopedEvents = [];
    const scopedProcesses = [];
    const scopedResult = await recordingCommand(scopedEvents, scopedProcesses).execute({
      root,
      phase: null,
      flowState: scoped,
      flowManager: flowManagerFor(scoped),
      config: {},
    });
    const taskSpecIndex = scopedProcesses[0].args.indexOf("--task-spec");
    assert.notEqual(taskSpecIndex, -1);
    assert.equal(scopedProcesses[0].args[taskSpecIndex + 1], scoped.tasks[0].spec);
    assert.equal(scopedResult.artifacts.taskId, "T-1");

    assert.equal(runReview.normalizeReviewSubprocessRetryCount(99), 2);
    assert.equal(runReview.normalizeReviewSubprocessRetryDelayMs(99_999), 30_000);
    let attempts = 0;
    await runReview.runCmdWithRetry(() => {
      attempts += 1;
      return { ...successfulReviewProcess(), ok: false, status: 1 };
    }, { retryCount: 99, retryDelayMs: 0 });
    assert.equal(attempts, 3);

    const exhaustedFlow = flowState();
    exhaustedFlow.reviewStop = { phase: "impl", classification: "provider_failure" };
    exhaustedFlow.runtimeReview = { status: "stopped" };
    exhaustedFlow.metrics = Array.from({ length: 4 }, () => ({
      phase: "impl",
      counter: "reviewRetry",
      delta: 1,
      taskId: null,
    }));
    exhaustedFlow.stepAttempts = retryAttempts({
      taskId: null,
      stepId: "impl-review",
      count: 4,
    });
    const exhaustedFlowBefore = structuredClone(exhaustedFlow);
    const exhaustedFlowEvents = [];
    const exhaustedFlowProcesses = [];
    const exhaustedFlowResult = await recordingCommand(
      exhaustedFlowEvents,
      exhaustedFlowProcesses,
    ).execute({ root, phase: null, flowState: exhaustedFlow, config: {} });
    assert.equal(exhaustedFlowResult.ok, false);
    assert.equal(exhaustedFlowResult.errors[0].code, "REVIEW_MAX_ATTEMPTS_EXCEEDED");
    assert.deepEqual(exhaustedFlowEvents, ["resolve-scope"]);
    assert.deepEqual(exhaustedFlowProcesses, []);
    assert.deepEqual(exhaustedFlow, exhaustedFlowBefore);

    const exhaustedTask = flowState({
      flowReviewStatus: "pending",
      tasks: [task("T-1", { status: "in_progress", reviewStatus: "in_progress" })],
    });
    exhaustedTask.reviewStop = { phase: "impl", classification: "provider_failure" };
    exhaustedTask.runtimeReview = { status: "stopped" };
    exhaustedTask.stepAttempts = retryAttempts({
      taskId: "T-1",
      stepId: "task-review",
      count: 4,
    });
    const exhaustedTaskBefore = structuredClone(exhaustedTask);
    const exhaustedTaskEvents = [];
    const exhaustedTaskProcesses = [];
    const exhaustedTaskResult = await recordingCommand(
      exhaustedTaskEvents,
      exhaustedTaskProcesses,
    ).execute({ root, phase: null, flowState: exhaustedTask, config: {} });
    assert.equal(exhaustedTaskResult.ok, false);
    assert.equal(exhaustedTaskResult.errors[0].code, "REVIEW_MAX_ATTEMPTS_EXCEEDED");
    assert.deepEqual(exhaustedTaskEvents, ["resolve-scope"]);
    assert.deepEqual(exhaustedTaskProcesses, []);
    assert.deepEqual(exhaustedTask, exhaustedTaskBefore);
  } finally {
    removeTmpDir(root);
  }
});

test("R3: flow PASS and ADVISORY close flow review leaves without task mutation", async () => {
  for (const verdict of ["PASS", "ADVISORY"]) {
    const root = createTmpDir(`issue-448-flow-${verdict.toLowerCase()}-`);
    try {
      const state = setupFlowAtStep(root, "impl-review", {
        runId: "run-review-scope",
        issue: 448,
        spec: "specs/demo/spec.json",
        currentTaskId: "T-1",
        tasks: [task("T-1")],
        metrics: [],
        stepAttempts: [],
      });
      const flowManager = makeContainer(root).get("flowManager");
      const result = implResult(verdict);
      const taskStepsBefore = structuredClone(state.tasks[0].steps);
      prepareImplReviewArtifact(root, state, verdict);

      assert.equal(resolveImplReviewScope(state).kind, "flow");
      await FLOW_COMMANDS.run.review.post({
        root,
        phase: null,
        flowState: state,
        flowManager,
      }, result);

      const stored = flowManager.load();
      assert.equal(findStep(stored.steps, "impl-review").status, "done");
      assert.equal(findStep(stored.steps, "impl-triage").status, "done");
      assert.equal(findStep(stored.steps, "impl-repair").status, "done");
      assert.equal(findStep(stored.steps, "impl-gate").status, "in_progress");
      assert.deepEqual(stored.tasks[0].steps, taskStepsBefore);
      assert.equal(result.stepAttempt.taskId, null);
      assert.equal(result.stepAttempt.stepId, "impl-review");
    } finally {
      removeTmpDir(root);
    }
  }
});

test("R4: flow FAIL and every task verdict retain their selected lifecycle scope", async () => {
  const flow = flowState();
  const flowResult = implResult("FAIL");
  await FLOW_COMMANDS.run.review.post({
    phase: null,
    flowState: flow,
    flowManager: flowManagerFor(flow),
  }, flowResult);

  assert.equal(findStep(flow.steps, "impl-review").status, "done");
  assert.equal(findStep(flow.steps, "impl-triage").status, "in_progress");
  assert.equal(findStep(flow.steps, "impl-repair").status, "pending");
  assert.equal(findStep(flow.steps, "impl-gate").status, "pending");
  assert.equal(flowResult.stepAttempt.taskId, null);
  assert.equal(flowResult.stepAttempt.stepId, "impl-review");

  for (const verdict of ["PASS", "ADVISORY", "FAIL"]) {
    const scoped = flowState({
      flowReviewStatus: "pending",
      tasks: [task("T-1", { status: "in_progress", reviewStatus: "in_progress" })],
    });
    const taskResult = implResult(verdict, { taskId: "T-1" });
    assert.equal(resolveImplReviewScope(scoped).kind, "task");
    await FLOW_COMMANDS.run.review.post({
      phase: null,
      flowState: scoped,
      flowManager: flowManagerFor(scoped),
    }, taskResult);

    assert.equal(
      findStep(scoped.tasks[0].steps, "task-review").status,
      verdict === "FAIL" ? "in_progress" : "done",
    );
    assert.equal(findStep(scoped.steps, "impl-review").status, "pending");
    assert.equal(findStep(scoped.steps, "impl-triage").status, "pending");
    assert.equal(findStep(scoped.steps, "impl-repair").status, "pending");
    assert.deepEqual(scoped.metrics, []);
    assert.equal(taskResult.artifacts.taskId, "T-1");
    assert.equal(taskResult.stepAttempt.taskId, "T-1");
    assert.equal(taskResult.stepAttempt.stepId, "task-review");
    assert.equal(scoped.stepAttempts.at(-1).taskId, "T-1");
  }
});

test("R5: ambiguous review scope returns REVIEW_SCOPE_INVALID before every side effect", async () => {
  const root = createTmpDir("issue-448-no-side-effects-");
  try {
    const state = flowState({
      tasks: [task("T-1", { status: "in_progress", reviewStatus: "in_progress" })],
    });
    state.reviewStop = { phase: "impl", classification: "provider_failure" };
    state.runtimeReview = { status: "stopped" };
    const before = structuredClone(state);
    const effects = [];
    const command = new RunReviewCommand({
      resolveScope(candidate) {
        effects.push("resolve-scope");
        return taskScope.resolveImplReviewScope(candidate);
      },
      runCommand() {
        effects.push("subprocess");
        return successfulReviewProcess();
      },
    });
    const result = await command.execute({
      root,
      phase: null,
      flowState: state,
      flowManager: {
        mutate() { effects.push("mutate"); },
        appendMetric() { effects.push("metric"); },
        updateStepStatus() { effects.push("step-status"); },
      },
      config: {},
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REVIEW_SCOPE_INVALID");
    assert.equal(result.data.currentTaskId, "T-1");
    assert.ok(result.data.reason.trim());
    assert.deepEqual(effects, ["resolve-scope"]);
    assert.deepEqual(state, before);
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    removeTmpDir(root);
  }
});

test("R6: RunReviewCommand enforces broad-mode audit and target guards before scope effects", async () => {
  const noBroadRoot = createTmpDir("issue-448-no-broad-");
  try {
    const withoutBroad = flowState({ currentTaskId: null });
    const withoutBroadBefore = structuredClone(withoutBroad);
    const processCalls = [];
    const command = recordingCommand([], processCalls);
    const result = await command.execute({
      root: noBroadRoot,
      phase: null,
      flowState: withoutBroad,
      flowManager: flowManagerFor(withoutBroad),
      config: {},
    });
    assert.equal(result.ok, false);
    assert.equal(processCalls.length, 0);
    assert.deepEqual(withoutBroad, withoutBroadBefore);
    assert.deepEqual(withoutBroad.broadModeHistory, []);

    const emptyReason = flowState({
      currentTaskId: null,
      broadModeHistory: [{
        step: "impl-review",
        reason: "",
        ts: "2026-07-21T00:00:00.000Z",
        currentTaskId: null,
      }],
    });
    const emptyReasonBefore = structuredClone(emptyReason);
    const emptyReasonProcesses = [];
    const emptyReasonResult = await recordingCommand([], emptyReasonProcesses).execute({
      root: noBroadRoot,
      phase: null,
      flowState: emptyReason,
      flowManager: flowManagerFor(emptyReason),
      config: {},
    });
    assert.equal(emptyReasonResult.ok, false);
    assert.deepEqual(emptyReasonProcesses, []);
    assert.deepEqual(emptyReason, emptyReasonBefore);
  } finally {
    removeTmpDir(noBroadRoot);
  }

  const root = createTmpDir("issue-448-target-guards-");
  try {
    const broadReason = "Review the explicitly approved broad implementation diff.";
    const state = setupFlowAtStep(root, "impl-review", {
      runId: "run-review-scope",
      issue: 448,
      spec: "specs/demo/spec.json",
      currentTaskId: null,
      tasks: [task("T-1")],
      broadModeHistory: [{
        step: "impl-review",
        reason: broadReason,
        ts: "2026-07-21T00:00:00.000Z",
        currentTaskId: null,
      }],
      metrics: [],
      stepAttempts: [],
    });
    prepareFlowReviewEvidence(root, state);
    const events = [];
    const processCalls = [];
    const command = recordingCommand(events, processCalls);
    const container = makeContainer(root);
    container.register("paths", { root, agentWorkDir: path.join(root, ".tmp") });
    container.register("mainRoot", root);
    container.register("config", {});
    container.register("inWorktree", false);

    const flowPath = path.join(root, path.dirname(state.spec), "flow.json");
    const beforeGuards = fs.readFileSync(flowPath, "utf8");
    const mismatches = [
      { expectRunId: "wrong-run", expectIssue: 448, expectSpec: state.spec },
      { expectRunId: state.runId, expectIssue: 999, expectSpec: state.spec },
      { expectRunId: state.runId, expectIssue: 448, expectSpec: "specs/999-wrong/spec.json" },
    ];
    for (const mismatchInput of mismatches) {
      const mismatch = await command.run(container, {
        ...mismatchInput,
        _envelopeType: "run",
        _envelopeKey: "review",
      });
      assert.equal(mismatch.ok, false);
      assert.equal(mismatch.errors[0].code, "ACTIVE_FLOW_MISMATCH");
      assert.deepEqual(events, []);
      assert.deepEqual(processCalls, []);
      assert.equal(fs.readFileSync(flowPath, "utf8"), beforeGuards);
    }

    const matching = await command.run(container, {
      expectRunId: state.runId,
      expectIssue: state.issue,
      expectSpec: state.spec,
      _envelopeType: "run",
      _envelopeKey: "review",
    });
    assert.equal(matching.result, "ok");
    assert.equal(matching.artifacts.taskId, null);
    assert.equal(matching.artifacts.broadMode.reason, broadReason);
    assert.equal(events.filter((entry) => entry === "resolve-scope").length, 1);
    assert.equal(processCalls.length, 1);
  } finally {
    removeTmpDir(root);
  }
});
