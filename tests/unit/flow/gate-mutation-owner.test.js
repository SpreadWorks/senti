import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { GateMutationOwner } from "../../../src/flow/lib/gate-mutation-owner.js";
import {
  resolveRetryMax,
  updateGateRetryCounter,
} from "../../../src/flow/lib/run-gate.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import SetIssueLogCommand from "../../../src/flow/lib/set-issue-log.js";
import {
  makeDefaultTask,
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
} from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let tmp;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function semanticFailure(id = "task-semantic") {
  return {
    guardrail_id: id,
    result: "fail",
    category: "semantic",
    reason: "A bounded semantic observation remains open.",
    rationale: "The observation has no mechanical or must-fix authority.",
    disposition: "must-fix",
  };
}

function taskGateState(specId, metrics = []) {
  return makeFlowState({
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    currentTaskId: "T-1",
    metrics,
    stepAttempts: [],
    tasks: [makeDefaultTask({
      id: "T-1",
      status: "in_progress",
      steps: [
        { id: "task-impl", status: "done" },
        { id: "task-review", status: "done" },
        { id: "task-gate", status: "in_progress" },
      ],
    })],
  });
}

function validSpec() {
  return {
    goal: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "",
    requirements: [{ id: "R1", desc: "task gate scope", priority: "must" }],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks: [],
  };
}

function persistState(root, specId, state) {
  fs.mkdirSync(path.join(root, "specs", specId), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", specId, "spec.json"), JSON.stringify(validSpec()));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "example.js"), "export const example = true;\n");
  const unbound = makeFlowManager(root);
  unbound.create(state);
  unbound.addActiveFlow(specId, "branch");
  return unbound.forRoot(root, { specId });
}

function gateFailureResult(phase, id) {
  return {
    result: "fail",
    artifacts: {
      phase,
      failureKind: "ai_semantic_fail",
      evaluations: [semanticFailure(id)],
    },
    next: null,
  };
}

test("task gate initial and repeated retry mutations stay owned by task-gate", () => {
  tmp = createTmpDir("task-gate-mutation-owner-");
  const specId = "001-task-gate-owner";
  const manager = persistState(tmp, specId, taskGateState(specId));
  const initial = manager.load();
  const owner = new GateMutationOwner({ flowState: initial, phase: "task-impl" });

  assert.equal(owner.stepId, "task-gate");
  assert.equal(owner.taskId, "T-1");
  assert.equal(owner.updateStepStatus(manager, {
    status: "in_progress",
    event: "gate:phase-inference",
  }), null, "an already-active initial gate is a scoped no-op");

  for (const id of ["retry-one", "retry-two"]) {
    const flowState = manager.load();
    updateGateRetryCounter({
      root: tmp,
      phase: "task-impl",
      flowState,
      flowManager: manager,
    }, gateFailureResult("task-impl", id));
  }

  const persisted = manager.load();
  assert.equal(persisted.tasks[0].steps.find((step) => step.id === "task-gate").status, "in_progress");
  assert.equal(findStepById(persisted.steps, "impl-gate").status, "pending");
  assert.deepEqual(persisted.stepAttempts.map(({ stepId, taskId, attempt }) => ({ stepId, taskId, attempt })), [
    { stepId: "task-gate", taskId: "T-1", attempt: 1 },
    { stepId: "task-gate", taskId: "T-1", attempt: 2 },
  ]);
  assert.deepEqual(
    persisted.metrics.filter((entry) => entry.phase === "task-impl").map((entry) => entry.taskId),
    ["T-1", "T-1"],
  );
});

test("task gate lifecycle pre and PASS post never mutate the parent impl-gate", async () => {
  tmp = createTmpDir("task-gate-lifecycle-owner-");
  const specId = "004-task-gate-lifecycle";
  const manager = persistState(tmp, specId, taskGateState(specId));
  const preContext = {
    root: tmp,
    phase: "task-impl",
    flowState: manager.load(),
    flowManager: manager,
    specId,
  };

  await FLOW_COMMANDS.run.gate.pre(preContext);

  let persisted = manager.load();
  assert.equal(persisted.tasks[0].steps.find((step) => step.id === "task-gate").status, "in_progress");
  assert.equal(findStepById(persisted.steps, "impl-gate").status, "pending");

  await FLOW_COMMANDS.run.gate.post({
    ...preContext,
    flowState: persisted,
  }, {
    result: "pass",
    artifacts: { phase: "task-impl", evaluations: [] },
    next: "refresh-next-action",
  });

  persisted = manager.load();
  assert.equal(persisted.tasks[0].steps.find((step) => step.id === "task-gate").status, "done");
  assert.equal(findStepById(persisted.steps, "impl-gate").status, "pending");
});

test("task retry exhaustion defers and completes only task-gate with an explicit task route", () => {
  tmp = createTmpDir("task-gate-defer-owner-");
  const specId = "002-task-gate-defer";
  const initial = taskGateState(specId);
  const max = resolveRetryMax({ flowState: initial, scope: "task" }, "task-impl");
  const manager = persistState(tmp, specId, initial);
  const firstResult = gateFailureResult("task-impl", "deferred-task-observation");
  updateGateRetryCounter({
    root: tmp,
    phase: "task-impl",
    flowState: manager.load(),
    flowManager: manager,
  }, firstResult);
  const taskGateSource = JSON.parse(fs.readFileSync(
    path.join(tmp, "specs", specId, "task-impl-gate-source.json"),
    "utf8",
  ));
  const findingId = taskGateSource.evaluations[0].findingId;
  const repairPath = path.join(tmp, "src", "task-gate-repair.js");
  fs.writeFileSync(repairPath, "export const repaired = true;\n");
  const future = new Date(Date.now() + 2_000);
  fs.utimesSync(repairPath, future, future);
  new SetIssueLogCommand().execute({
    root: tmp,
    flowState: manager.load(),
    step: "task-gate",
    taskId: "T-1",
    reason: "Repaired the bounded task-gate finding before retry.",
    normalizedFindingId: findingId,
    repairRefFile: "src/task-gate-repair.js",
  });
  manager.mutate((state) => {
    state.metrics = Array.from({ length: max - 1 }, () => ({
      phase: "task-impl",
      counter: "gateRetry",
      delta: 1,
      taskId: "T-1",
      ts: "2026-07-20T00:00:00.000Z",
    }));
  }, { taskId: "T-1" });
  const routes = [];
  const originalUpdateStepStatus = manager.updateStepStatus.bind(manager);
  manager.updateStepStatus = (transition, opts) => {
    routes.push({ stepId: transition.stepId, taskId: opts?.taskId ?? null });
    return originalUpdateStepStatus(transition, opts);
  };
  const result = gateFailureResult("task-impl", "deferred-task-observation");

  updateGateRetryCounter({
    root: tmp,
    phase: "task-impl",
    flowState: manager.load(),
    flowManager: manager,
  }, result);

  assert.equal(result.result, "deferred");
  assert.deepEqual(routes, [{ stepId: "task-gate", taskId: "T-1" }]);
  const persisted = manager.load();
  assert.equal(persisted.tasks[0].steps.find((step) => step.id === "task-gate").status, "done");
  assert.equal(findStepById(persisted.steps, "impl-gate").status, "pending");
  assert.equal(persisted.stepAttempts.at(-1).stepId, "task-gate");
  assert.equal(persisted.stepAttempts.at(-1).taskId, "T-1");
});

test("integration retry mutations retain flow-level impl-gate ownership", () => {
  tmp = createTmpDir("integration-gate-mutation-owner-");
  const specId = "003-integration-gate-owner";
  const state = moveFlowToStep(makeFlowState({
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    currentTaskId: null,
    tasks: [],
    metrics: [],
    stepAttempts: [],
  }), "impl-gate");
  const manager = persistState(tmp, specId, state);

  updateGateRetryCounter({
    root: tmp,
    phase: "integration",
    flowState: manager.load(),
    flowManager: manager,
  }, gateFailureResult("integration", "integration-retry"));

  const persisted = manager.load();
  assert.equal(findStepById(persisted.steps, "impl-gate").status, "in_progress");
  assert.equal(persisted.metrics.at(-1).taskId, null);
  assert.equal(persisted.stepAttempts.at(-1).stepId, "impl-gate");
  assert.equal(persisted.stepAttempts.at(-1).taskId, null);
});
