// spec: R3 R4 R5 R8 R9
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { resolveLifecyclePlan, SetStepStatus } from "../../../src/flow/definition.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";
import { container as globalContainer } from "../../../src/lib/container.js";
import { AtomicFlowStateWriter } from "../../../src/lib/flow-state-atomic-writer.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import {
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
} from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

let tmp;
afterEach(() => {
  globalContainer.reset();
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

async function loadTransitionPolicy() {
  try {
    return await import("../../../src/flow/lib/step-transition-policy.js");
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") return Object.freeze({});
    throw error;
  }
}

function stepState() {
  return {
    spec: "specs/demo/spec.json",
    runId: "run-demo",
    currentTaskId: null,
    steps: [
      { id: "draft", status: "in_progress" },
      { id: "spec", status: "pending" },
    ],
    tasks: [],
  };
}

function commandContext(state, updates) {
  return {
    root: "/repo",
    specId: "demo",
    flowManager: {
      load: () => state,
      updateStepStatus(...args) { updates.push(args); },
    },
  };
}

function snapshotTree(root) {
  const entries = {};
  const visit = (directory) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name);
      if (fs.lstatSync(absolute).isDirectory()) visit(absolute);
      else entries[path.relative(root, absolute)] = fs.readFileSync(absolute);
    }
  };
  visit(root);
  return entries;
}

test("R3: normal set accepts only current in_progress to done or skipped", async () => {
  for (const [id, status] of [
    ["draft", "pending"],
    ["draft", "in_progress"],
    ["draft", "failed"],
    ["spec", "done"],
    ["spec", "skipped"],
  ]) {
    const state = stepState();
    const before = structuredClone(state);
    const updates = [];
    const result = await new SetStepCommand().execute({
      ...commandContext(state, updates),
      id,
      status,
    });
    assert.equal(result?.ok, false, `${id}=${status} is rejected`);
    assert.match(result.errors?.[0]?.code || "", /INVALID|TRANSITION|TERMINAL/);
    assert.equal(updates.length, 0);
    assert.deepEqual(state, before, `${id}=${status} leaves state unchanged`);
  }

  for (const storedStatus of ["done", "skipped"]) {
    for (const requestedStatus of ["done", "skipped"]) {
      const state = stepState();
      state.steps[0].status = storedStatus;
      state.steps[1].status = "in_progress";
      const before = structuredClone(state);
      const updates = [];
      const result = await new SetStepCommand().execute({
        ...commandContext(state, updates),
        id: "draft",
        status: requestedStatus,
      });
      assert.equal(result?.ok, false, `${storedStatus} to ${requestedStatus} is rejected`);
      assert.match(result.errors?.[0]?.code || "", /TRANSITION|TERMINAL/);
      assert.equal(updates.length, 0);
      assert.deepEqual(state, before);
    }
  }

  for (const status of ["done", "skipped"]) {
    const state = stepState();
    const updates = [];
    const result = await new SetStepCommand().execute({
      ...commandContext(state, updates),
      id: "draft",
      status,
    });
    assert.equal(result.id, "draft");
    assert.equal(result.status, status);
    assert.equal(updates.length, 1);
  }
});

test("R3: normal set rejects every mapped lifecycle-owned current step", async () => {
  for (const id of [
    "draft-gate",
    "spec-review",
    "spec-gate",
    "scenario-validity",
    "test-review",
    "test-execute",
    "test-result-review",
    "impl-review",
    "impl-gate",
    "retro",
    "acceptance-review",
    "final-regression",
    "report",
    "finalize-cleanup",
  ]) {
    const state = {
      spec: "specs/demo/spec.json",
      runId: "run-demo",
      currentTaskId: null,
      steps: [{ id, status: "in_progress" }],
      tasks: [],
    };
    const before = structuredClone(state);
    const updates = [];
    const result = await new SetStepCommand().execute({
      ...commandContext(state, updates),
      id,
      status: "skipped",
    });
    assert.equal(result?.ok, false, id);
    assert.match(result.errors?.[0]?.code || "", /TRANSITION|DEFINITION/, id);
    assert.equal(updates.length, 0, id);
    assert.deepEqual(state, before, id);
  }
});

test("R4: dedicated transition classes enforce source-specific constructor invariants", async () => {
  const {
    NormalStepTransition,
    DefinitionLifecycleTransition,
    ExplicitRecoveryTransition,
  } = await loadTransitionPolicy();
  assert.deepEqual(
    {
      NormalStepTransition: typeof NormalStepTransition,
      DefinitionLifecycleTransition: typeof DefinitionLifecycleTransition,
      ExplicitRecoveryTransition: typeof ExplicitRecoveryTransition,
    },
    {
      NormalStepTransition: "function",
      DefinitionLifecycleTransition: "function",
      ExplicitRecoveryTransition: "function",
    },
  );

  const normal = new NormalStepTransition({
    stepId: "draft",
    currentStepId: "draft",
    currentStatus: "in_progress",
    requestedStatus: "done",
  });
  assert.ok(Object.isFrozen(normal));
  assert.throws(() => new NormalStepTransition({
    stepId: "spec",
    currentStepId: "draft",
    currentStatus: "pending",
    requestedStatus: "done",
  }));

  const lifecycleCases = [
    {
      status: "in_progress",
      input: { event: "gate:pre", command: "run-gate", phase: "spec", currentStepId: "spec-gate" },
    },
    {
      status: "done",
      input: {
        event: "gate:post",
        command: "run-gate",
        phase: "spec",
        currentStepId: "spec-gate",
        result: { result: "pass", artifacts: { phase: "spec" } },
      },
    },
    {
      status: "skipped",
      input: {
        event: "definition:skip-steps",
        currentStepId: "spec-gate",
        targetStepId: "spec-gate",
        status: "skipped",
      },
    },
  ];
  for (const { status, input } of lifecycleCases) {
    const plan = resolveLifecyclePlan(input);
    const action = plan.actions.find((candidate) => (
      candidate instanceof SetStepStatus && candidate.step === "spec-gate" && candidate.status === status
    ));
    const lifecycle = new DefinitionLifecycleTransition({
      action,
      plan,
      currentStatus: "pending",
    });
    assert.ok(Object.isFrozen(lifecycle));
    assert.equal(lifecycle.action, action);
    assert.equal(lifecycle.action.status, status);
    assert.equal(lifecycle.currentStepId, plan.currentStepId);
    assert.equal(lifecycle.event, plan.event);
  }

  const selfSuppliedAction = new SetStepStatus({ step: "spec-gate", status: "in_progress" });
  assert.throws(
    () => new DefinitionLifecycleTransition({
      action: selfSuppliedAction,
      allowedActions: [selfSuppliedAction],
      currentStepId: "spec-gate",
      currentStatus: "pending",
      event: "gate:pre",
    }),
    (error) => error?.code === "FLOW_STEP_TRANSITION_INVALID",
  );

  const genuinePlan = resolveLifecyclePlan({
    event: "gate:pre",
    command: "run-gate",
    phase: "spec",
    currentStepId: "spec-gate",
  });
  const forgedAction = new SetStepStatus({ step: "spec-gate", status: "in_progress" });
  assert.throws(
    () => new DefinitionLifecycleTransition({
      action: forgedAction,
      plan: genuinePlan,
      currentStatus: "pending",
    }),
    (error) => error?.code === "FLOW_STEP_TRANSITION_INVALID",
  );

  const recovery = new ExplicitRecoveryTransition({
    stepId: "draft",
    currentStatus: "done",
    requestedStatus: "in_progress",
    entrypoint: "reopen-draft",
  });
  assert.ok(Object.isFrozen(recovery));
  assert.throws(() => new ExplicitRecoveryTransition({
    stepId: "draft",
    currentStatus: "done",
    requestedStatus: "in_progress",
    entrypoint: "normal-set-step",
  }));
  assert.throws(() => new ExplicitRecoveryTransition({
    stepId: "draft",
    currentStatus: "done",
    requestedStatus: "in_progress",
    entrypoint: "reopen-draft",
    changes: [
      { stepId: "draft", currentStatus: "done", requestedStatus: "in_progress" },
      { stepId: "foreign-step", currentStatus: "done", requestedStatus: "pending" },
    ],
  }), /cannot change foreign-step/);
  assert.throws(() => new ExplicitRecoveryTransition({
    stepId: "draft",
    currentStatus: "done",
    requestedStatus: "in_progress",
    entrypoint: "reopen-draft",
    changes: [
      { stepId: "draft", currentStatus: "done", requestedStatus: "in_progress" },
      { stepId: "spec", currentStatus: "done", requestedStatus: "done" },
    ],
  }), /downstream steps to pending/);
  assert.throws(() => new ExplicitRecoveryTransition({
    stepId: "draft",
    currentStatus: "done",
    requestedStatus: "in_progress",
    entrypoint: "reopen-spec-correction",
    expectedOriginal: {},
    replacementState: {},
    changes: [
      { stepId: "draft", currentStatus: "done", requestedStatus: "in_progress" },
      { stepId: "spec", currentStatus: "done", requestedStatus: "pending" },
    ],
  }), /replacement flow state/);
});

test("R4: registry gate lifecycle passes only a definition-produced transition", async () => {
  const { DefinitionLifecycleTransition } = await loadTransitionPolicy();
  assert.equal(typeof DefinitionLifecycleTransition, "function");
  const updates = [];
  const flowState = {
    currentTaskId: null,
    steps: [{ id: "spec-gate", status: "pending" }],
    tasks: [],
  };

  await FLOW_COMMANDS.run.gate.pre({
    phase: "spec",
    flowState,
    flowManager: {
      updateStepStatus(transition) { updates.push(transition); },
    },
  });

  assert.equal(updates.length, 1);
  assert.ok(updates[0] instanceof DefinitionLifecycleTransition);
  assert.ok(updates[0].action instanceof SetStepStatus);
  assert.equal(updates[0].action.step, "spec-gate");

  const plan = resolveLifecyclePlan({
    event: "gate:pre",
    command: "run-gate",
    phase: "spec",
    currentStepId: "spec-gate",
  });
  const forged = new SetStepStatus({ step: "impl-gate", status: "done" });
  assert.throws(
    () => new DefinitionLifecycleTransition({
      action: forged,
      plan,
      currentStatus: "pending",
    }),
    (error) => error?.code === "FLOW_STEP_TRANSITION_INVALID",
  );
});

// spec: R8 R9
test("R8/R9: task gate pre-hook persists a fully scoped definition transition", async () => {
  const { DefinitionLifecycleTransition } = await loadTransitionPolicy();
  tmp = createTmpDir("spec-322-task-gate-transition-");
  const specId = "006-task-gate-transition";
  const storedState = makeFlowState({
    spec: `specs/${specId}/spec.json`,
    runId: "run-task-gate-transition",
    currentTaskId: "T-1",
    tasks: [{
      id: "T-1",
      title: "task gate transition",
      goal: "persist the task-scoped gate transition",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "in_progress",
      steps: [
        { id: "task-impl", status: "done" },
        { id: "task-review", status: "done" },
        { id: "task-gate", status: "pending" },
      ],
    }],
  });
  const flowState = structuredClone(storedState);
  flowState.tasks[0].steps[2].status = "in_progress";
  const unboundManager = makeFlowManager(tmp);
  unboundManager.create(storedState);
  unboundManager.addActiveFlow(specId, "branch");
  const manager = unboundManager.forRoot(tmp, { specId });

  const transitions = [];
  const originalUpdateStepStatus = manager._store.updateStepStatus.bind(manager._store);
  manager._store.updateStepStatus = (transition, opts) => {
    transitions.push(transition);
    return originalUpdateStepStatus(transition, opts);
  };

  await FLOW_COMMANDS.run.gate.pre({
    phase: "task-impl",
    flowState,
    flowManager: manager,
  });

  assert.equal(transitions.length, 1);
  const [transition] = transitions;
  assert.ok(transition instanceof DefinitionLifecycleTransition);
  assert.ok(transition.action instanceof SetStepStatus);
  assert.equal(transition.stepId, "task-gate");
  assert.equal(transition.action.step, "task-gate");
  assert.equal(transition.currentStepId, "task-gate");
  assert.equal(transition.requestedStatus, "in_progress");
  const persisted = manager.load(specId);
  assert.equal(persisted.tasks[0].steps.find((step) => step.id === "task-gate").status, "in_progress");
  assert.equal(findStepById(persisted.steps, "impl-gate").status, "pending");
});

test("R4: reopen-draft uses the explicit recovery transition and dedicated rewind path", async () => {
  const { ExplicitRecoveryTransition } = await loadTransitionPolicy();
  assert.equal(typeof ExplicitRecoveryTransition, "function");
  tmp = createTmpDir("spec-322-recovery-");
  const state = moveFlowToStep(makeFlowState({
    spec: "specs/recovery/spec.json",
    runId: "run-recovery",
    featureBranch: "feature/recovery",
  }), "approval");
  fs.mkdirSync(path.join(tmp, "specs", "recovery"), { recursive: true });
  fs.writeFileSync(path.join(tmp, "specs", "recovery", "spec.json"), "{}\n");
  let dedicatedRewinds = 0;
  let normalMutations = 0;
  const flowManager = {
    load: () => state,
    rewindPlan(transition) {
      assert.ok(transition instanceof ExplicitRecoveryTransition);
      dedicatedRewinds += 1;
      return {
        destinationStep: "draft",
        rewoundAt: "2026-07-20T00:00:00.000Z",
        invalidatedStepIds: [],
        invalidatedEvidence: [],
      };
    },
    mutate(mutator) {
      normalMutations += 1;
      mutator(state);
    },
  };

  const result = await new RunReopenDraftCommand().execute({
    root: tmp,
    specId: "recovery",
    flowManager,
    flowState: state,
    category: "task-addition",
    reason: "Explicit recovery path verification.",
  });
  assert.equal(result.ok, true);
  assert.equal(dedicatedRewinds, 1);
  assert.equal(normalMutations, 0);
});

test("R5: real FlowStore commits once before logging and rejects a terminal retry", async (t) => {
  const { NormalStepTransition } = await loadTransitionPolicy();
  assert.equal(typeof NormalStepTransition, "function");
  tmp = createTmpDir("spec-322-step-store-");
  const specId = "005-step-store";
  const state = moveFlowToStep(makeFlowState({
    spec: `specs/${specId}/spec.json`,
    runId: "run-step-store",
    issue: 447,
    featureBranch: `feature/${specId}`,
    metrics: [{ phase: "test", counter: "reviewRetry", delta: 1, taskId: null, ts: "2026-07-20T00:00:00.000Z" }],
    retryLimits: { gate: 5, review: 4 },
  }), "draft");
  findStepById(state.steps, "draft").runtimeLog = { runId: "sentinel", sequence: 3 };
  const manager = makeFlowManager(tmp);
  manager.create(state);
  manager.addActiveFlow(specId, "local");
  fs.writeFileSync(path.join(tmp, "specs", specId, "sentinel-artifact.json"), "artifact-before\n");
  fs.mkdirSync(path.join(tmp, ".tmp", "logs"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".tmp", "logs", `${specId}.log`), "runtime-before\n");
  const preserved = {
    artifact: fs.readFileSync(path.join(tmp, "specs", specId, "sentinel-artifact.json")),
    runtime: fs.readFileSync(path.join(tmp, ".tmp", "logs", `${specId}.log`)),
    metrics: structuredClone(state.metrics),
    retryLimits: structuredClone(state.retryLimits),
  };

  let writerMutations = 0;
  let completedWriterMutations = 0;
  const originalWriterMutate = AtomicFlowStateWriter.prototype.mutate;
  AtomicFlowStateWriter.prototype.mutate = function instrumentedWriterMutate(...args) {
    writerMutations += 1;
    const result = originalWriterMutate.apply(this, args);
    completedWriterMutations += 1;
    return result;
  };
  t.after(() => {
    AtomicFlowStateWriter.prototype.mutate = originalWriterMutate;
  });
  const originalUpdateStepStatus = manager._store.updateStepStatus.bind(manager._store);
  let transitionCalls = 0;
  manager._store.updateStepStatus = (transition, ...args) => {
    assert.ok(transition instanceof NormalStepTransition);
    transitionCalls += 1;
    return originalUpdateStepStatus(transition, ...args);
  };
  let loggerEvents = 0;
  globalContainer.register("logger", {
    event(name, payload) {
      assert.equal(name, "flow-step-change");
      assert.deepEqual(payload, { step: "draft", status: "done" });
      assert.equal(completedWriterMutations, 1, "logger runs only after the concrete writer returns");
      assert.equal(findStepById(manager.load(specId).steps, "draft").status, "done");
      loggerEvents += 1;
    },
  });

  const command = new SetStepCommand();
  const first = await command.execute({ root: tmp, specId, flowManager: manager, id: "draft", status: "done" });
  assert.equal(first.status, "done");
  assert.equal(writerMutations, 1);
  assert.equal(completedWriterMutations, 1);
  assert.equal(transitionCalls, 1);
  assert.equal(loggerEvents, 1);
  const committed = manager.load(specId);
  const completedDraft = findStepById(committed.steps, "draft");
  const promotedLeaves = flattenSteps(committed.steps).filter((step) => step.status === "in_progress");
  assert.equal(completedDraft.status, "done");
  assert.equal(promotedLeaves.length, 1);
  assert.match(completedDraft.finishedAt || "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
  assert.match(promotedLeaves[0].startedAt || "", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
  assert.equal(completedDraft.finishedAt, promotedLeaves[0].startedAt);
  assert.deepEqual(committed.metrics, preserved.metrics);
  assert.deepEqual(committed.retryLimits, preserved.retryLimits);
  assert.deepEqual(fs.readFileSync(path.join(tmp, "specs", specId, "sentinel-artifact.json")), preserved.artifact);
  assert.deepEqual(fs.readFileSync(path.join(tmp, ".tmp", "logs", `${specId}.log`)), preserved.runtime);

  manager._store.updateStepStatus = originalUpdateStepStatus;
  const beforeRawPositional = snapshotTree(tmp);
  let rawPositionalError;
  try {
    manager._store.updateStepStatus("draft", "done", { specId });
  } catch (error) {
    rawPositionalError = error;
  }
  assert.ok(rawPositionalError, "raw positional update must fail");
  assert.match(`${rawPositionalError.code || ""} ${rawPositionalError.message || ""}`, /TRANSITION/);
  assert.equal(writerMutations, 1);
  assert.equal(completedWriterMutations, 1);
  assert.equal(transitionCalls, 1);
  assert.deepEqual(snapshotTree(tmp), beforeRawPositional);

  const afterFirst = snapshotTree(tmp);
  const retry = await command.execute({ root: tmp, specId, flowManager: manager, id: "draft", status: "done" });
  assert.equal(retry?.ok, false);
  assert.match(retry.errors?.[0]?.code || "", /TRANSITION|TERMINAL/);
  assert.equal(writerMutations, 1);
  assert.equal(completedWriterMutations, 1);
  assert.equal(loggerEvents, 1);
  assert.deepEqual(snapshotTree(tmp), afterFirst);
});

test("R8: normal set-step cannot perform an implicit rewind", async () => {
  const state = stepState();
  state.steps[0].status = "done";
  state.steps[1].status = "in_progress";
  const before = structuredClone(state);
  const updates = [];
  const result = await new SetStepCommand().execute({
    ...commandContext(state, updates),
    id: "draft",
    status: "in_progress",
  });
  assert.equal(result?.ok, false);
  assert.equal(updates.length, 0);
  assert.deepEqual(state, before);
});

// spec: R8
test("R8: task-scoped impl PASS and ADVISORY isolate lifecycle updates to the current review", () => {
  for (const verdict of ["PASS", "ADVISORY"]) {
    const plan = resolveLifecyclePlan({
      event: "review:post",
      command: "run-review",
      phase: "impl",
      currentStepId: "impl-review",
      result: {
        artifacts: { phase: "impl", verdict, taskId: "T-1" },
        next: "task-gate",
      },
    });
    assert.deepEqual(
      plan.actions
        .filter((action) => action instanceof SetStepStatus)
        .map((action) => [action.step, action.status]),
      [
        ["impl-review", "done"],
      ],
      verdict,
    );
  }

  const failPlan = resolveLifecyclePlan({
    event: "review:post",
    command: "run-review",
    phase: "impl",
    currentStepId: "impl-review",
    result: {
      artifacts: { phase: "impl", verdict: "FAIL", taskId: "T-1" },
      next: null,
    },
  });
  assert.deepEqual(
    failPlan.actions.filter((action) => action instanceof SetStepStatus),
    [],
    "task FAIL remains on the retry/recovery path",
  );
});

test("R9: normal, definition lifecycle, and recovery transitions remain distinct", async () => {
  const {
    NormalStepTransition,
    DefinitionLifecycleTransition,
    ExplicitRecoveryTransition,
  } = await loadTransitionPolicy();
  assert.deepEqual(
    new Set([NormalStepTransition, DefinitionLifecycleTransition, ExplicitRecoveryTransition]).size,
    3,
  );
  const normal = new NormalStepTransition({
    stepId: "draft",
    currentStepId: "draft",
    currentStatus: "in_progress",
    requestedStatus: "skipped",
  });
  assert.equal(normal instanceof DefinitionLifecycleTransition, false);
  assert.equal(normal instanceof ExplicitRecoveryTransition, false);
});
