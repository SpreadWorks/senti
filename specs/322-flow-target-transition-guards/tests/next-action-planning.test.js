// spec: R6 R7 R8 R9
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import { flattenSteps, findStepById } from "../../../src/flow/lib/step-tree.js";
import { makeDefaultTask, makeFlowManager, makeFlowState, moveFlowToStep } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

let tmp;
afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function planCandidate(overrides = {}) {
  return {
    definition: { id: "flow" },
    rule: { action: "write-spec" },
    outputSchema: { type: "object" },
    instruction: { key: "plan.spec", content: "write the spec" },
    target: { scope: "flow", stepId: "spec", taskId: null, runId: "run-plan" },
    taskScope: { taskId: null },
    expectedRevision: { token: "revision-1" },
    maxAttempts: 1,
    ...overrides,
  };
}

function commandHarness(candidate, { stale = false, initialState = null } = {}) {
  let state = initialState || makeFlowState({
    spec: "specs/plan/spec.json",
    runId: "run-plan",
    featureBranch: "feature/plan",
    steps: [{ id: "spec", status: "pending" }],
    tasks: [],
  });
  const calls = {
    planner: 0,
    mutate: 0,
    save: 0,
    resolve: 0,
    runtime: 0,
    artifact: 0,
    retry: 0,
  };
  const planner = {
    build() {
      calls.planner += 1;
      return candidate;
    },
  };
  const effects = {
    writeRuntimeLog() { calls.runtime += 1; },
    writeArtifact() { calls.artifact += 1; },
    recordRetry() { calls.retry += 1; },
  };
  const flowManager = {
    load: () => state,
    mutate(mutator) {
      calls.mutate += 1;
      mutator(state);
    },
    saveAtomic(next) {
      calls.save += 1;
      if (stale) {
        const error = new Error("stale promotion plan");
        error.code = "FLOW_STATE_ATOMIC_STALE";
        throw error;
      }
      state = structuredClone(next);
    },
    resolveExplicitFlowTarget() {
      calls.resolve += 1;
      throw new Error("command must not re-resolve during commit");
    },
  };
  const command = new GetNextActionCommand({ planner, effects });
  return {
    calls,
    state: () => state,
    execute: () => command.execute({ flowState: state, flowManager }),
  };
}

async function expectTypedPlanFailure(operation, label) {
  let failure;
  try {
    const result = await operation();
    if (result?.ok === false) {
      failure = {
        code: result.errors?.[0]?.code,
        message: result.errors?.[0]?.messages?.join(" ") || "",
      };
    }
  } catch (error) {
    failure = { code: error?.code, message: error?.message || "" };
  }
  assert.ok(failure, `${label} must fail`);
  assert.match(failure.code || "", /INVALID|MISMATCH/);
  assert.match(failure.message, new RegExp(label, "i"));
}

test("R6: an invalid rule fails before the command mutates promotion state", async () => {
  const state = makeFlowState({
    steps: [{ id: "__missing_rule__", status: "pending" }],
    tasks: [],
  });
  const before = JSON.stringify(state);
  let mutateCalls = 0;
  const flowManager = {
    load: () => state,
    mutate(mutator) {
      mutateCalls += 1;
      mutator(state);
    },
  };

  await assert.rejects(
    () => new GetNextActionCommand().execute({ flowState: state, flowManager }),
    /NO_RULE_FOR_STEP/,
  );
  assert.equal(mutateCalls, 0);
  assert.equal(JSON.stringify(state), before);
});

test("R6: promotion plan rejects every missing executable input and bounds maxAttempts", async () => {
  const { NextActionPromotionPlan } = await import("../../../src/flow/lib/get-next-action.js");
  assert.equal(typeof NextActionPromotionPlan, "function");
  const valid = {
    definition: { id: "flow" },
    rule: { action: "write-spec" },
    outputSchema: { type: "object" },
    instruction: { key: "plan.spec", content: "write the spec" },
    target: { scope: "flow", stepId: "spec" },
    taskScope: { taskId: null },
    expectedRevision: { token: "revision-1" },
    maxAttempts: 1,
  };

  for (const field of [
    "definition", "rule", "outputSchema", "instruction", "target", "taskScope", "expectedRevision",
  ]) {
    assert.throws(() => new NextActionPromotionPlan({ ...valid, [field]: null }), field);
  }
  for (const maxAttempts of [0, -1, 1.5, 10_001]) {
    assert.throws(() => new NextActionPromotionPlan({ ...valid, maxAttempts }), /maxAttempts/);
  }
  for (const maxAttempts of [1, 10_000]) {
    const plan = new NextActionPromotionPlan({ ...valid, maxAttempts });
    assert.equal(plan.maxAttempts, maxAttempts);
    assert.ok(Object.isFrozen(plan));
  }
});

test("R6: GetNextActionCommand rejects every invalid executable input before side effects", async () => {
  const cases = [
    ["definition", { definition: null }],
    ["rule", { rule: null }],
    ["output schema", { outputSchema: null }],
    ["instruction", { instruction: null }],
    ["target", { target: { scope: "flow", stepId: "spec", taskId: null, runId: "foreign-run" } }],
    ["task scope", { taskScope: { taskId: "T-foreign" } }],
    ["maxAttempts", { maxAttempts: 10_001 }],
  ];

  for (const [label, overrides] of cases) {
    const harness = commandHarness(planCandidate(overrides));
    const before = structuredClone(harness.state());
    await expectTypedPlanFailure(harness.execute, label);
    assert.deepEqual(harness.state(), before, `${label} preserves flow state`);
    assert.deepEqual(harness.calls, {
      planner: 1,
      mutate: 0,
      save: 0,
      resolve: 0,
      runtime: 0,
      artifact: 0,
      retry: 0,
    });
  }
});

test("R6: a foreign task target is rejected before every write and effect", async () => {
  const state = makeFlowState({
    spec: "specs/plan/spec.json",
    runId: "run-plan",
    featureBranch: "feature/plan",
    currentTaskId: "T-1",
    tasks: [
      makeDefaultTask({ id: "T-1", status: "in_progress" }),
      makeDefaultTask({ id: "T-2", status: "pending" }),
    ],
  });
  const harness = commandHarness(planCandidate({
    target: { scope: "task", stepId: "task-impl", taskId: "T-2", runId: "run-plan" },
    taskScope: { taskId: "T-1" },
  }), { initialState: state });
  const before = JSON.stringify(harness.state());

  await assert.rejects(
    harness.execute,
    (error) => error?.code === "NEXT_ACTION_TASK_SCOPE_MISMATCH",
  );

  assert.equal(JSON.stringify(harness.state()), before);
  assert.deepEqual(harness.calls, {
    planner: 1,
    mutate: 0,
    save: 0,
    resolve: 0,
    runtime: 0,
    artifact: 0,
    retry: 0,
  });
});

test("R6: a forged next state cannot switch an existing current task", async () => {
  const state = makeFlowState({
    spec: "specs/plan/spec.json",
    runId: "run-plan",
    featureBranch: "feature/plan",
    currentTaskId: "T-1",
    tasks: [
      makeDefaultTask({ id: "T-1", status: "in_progress" }),
      makeDefaultTask({ id: "T-2", status: "pending" }),
    ],
  });
  const nextState = structuredClone(state);
  nextState.currentTaskId = "T-2";
  const harness = commandHarness(planCandidate({
    target: { scope: "task", stepId: "task-impl", taskId: "T-2", runId: "run-plan" },
    taskScope: { taskId: "T-1" },
    expectedRevision: state,
    nextState,
    commitRequired: true,
  }), { initialState: state });
  const before = JSON.stringify(harness.state());

  await assert.rejects(
    harness.execute,
    (error) => error?.code === "NEXT_ACTION_TASK_SCOPE_MISMATCH",
  );

  assert.equal(JSON.stringify(harness.state()), before);
  assert.deepEqual(harness.calls, {
    planner: 1,
    mutate: 0,
    save: 0,
    resolve: 0,
    runtime: 0,
    artifact: 0,
    retry: 0,
  });
});

test("R6: GetNextActionCommand accepts maxAttempts boundaries 1 and 10000", async () => {
  for (const maxAttempts of [1, 10_000]) {
    const harness = commandHarness(planCandidate({ maxAttempts }));
    const result = await harness.execute();
    assert.equal(result.maxAttempts, maxAttempts);
    assert.equal(harness.calls.save, 1);
    assert.equal(harness.calls.mutate, 0);
    assert.equal(findStepById(harness.state().steps, "spec").status, "in_progress");
    assert.deepEqual(
      { runtime: harness.calls.runtime, artifact: harness.calls.artifact, retry: harness.calls.retry },
      { runtime: 1, artifact: 1, retry: 1 },
    );
  }
});

test("R7: stale FlowStore revision fails once without retry or byte changes", () => {
  tmp = createTmpDir("spec-322-stale-");
  const specId = "001-stale";
  const manager = makeFlowManager(tmp).forRoot(tmp, { specId });
  manager.create(makeFlowState({
    spec: `specs/${specId}/spec.json`,
    runId: "run-stale",
    featureBranch: `feature/${specId}`,
  }));
  const expectedOriginal = manager.load(specId);
  manager.mutate((state) => { state.request = "concurrent writer"; }, { specId });
  const statePath = path.join(tmp, "specs", specId, "flow.json");
  const before = fs.readFileSync(statePath);
  let attempts = 0;

  const error = (() => {
    try {
      attempts += 1;
      manager.saveAtomic(
        { ...expectedOriginal, request: "stale promotion" },
        { expectedOriginal, boundSpecId: specId },
      );
    } catch (caught) {
      return caught;
    }
    assert.fail("stale commit must fail");
  })();

  assert.equal(error.code, "FLOW_STATE_ATOMIC_STALE");
  assert.equal(attempts, 1);
  assert.deepEqual(fs.readFileSync(statePath), before);
});

test("R7: unchanged revision promotes one pending leaf exactly once", async () => {
  tmp = createTmpDir("spec-322-promotion-");
  const specId = "001-promotion";
  const state = moveFlowToStep(makeFlowState({
    spec: `specs/${specId}/spec.json`,
    runId: "run-promotion",
    featureBranch: `feature/${specId}`,
  }), "spec");
  findStepById(state.steps, "spec").status = "pending";
  const manager = makeFlowManager(tmp).forRoot(tmp, { specId });
  manager.create(state);
  const originalMutate = manager.mutate.bind(manager);
  let mutateCalls = 0;
  manager.mutate = (...args) => {
    mutateCalls += 1;
    return originalMutate(...args);
  };

  const command = new GetNextActionCommand();
  const first = await command.execute({ flowState: manager.load(specId), flowManager: manager });
  const second = await command.execute({ flowState: manager.load(specId), flowManager: manager });
  assert.equal(first.step, "spec");
  assert.equal(second.step, "spec");
  assert.equal(mutateCalls, 1);
  assert.equal(flattenSteps(manager.load(specId).steps).filter((step) => step.status === "in_progress").length, 1);
});

test("R7: command-level stale CAS does not retry, re-resolve, or emit effects", async () => {
  const harness = commandHarness(planCandidate(), { stale: true });
  const before = structuredClone(harness.state());
  await assert.rejects(
    harness.execute,
    (error) => error?.code === "FLOW_STATE_ATOMIC_STALE",
  );
  assert.deepEqual(harness.state(), before);
  assert.deepEqual(harness.calls, {
    planner: 1,
    mutate: 0,
    save: 1,
    resolve: 0,
    runtime: 0,
    artifact: 0,
    retry: 0,
  });
});

test("R7: command-level unchanged revision commits and emits effects only once", async () => {
  const harness = commandHarness(planCandidate());
  const first = await harness.execute();
  const second = await harness.execute();
  assert.equal(first.step, "spec");
  assert.equal(second.step, "spec");
  assert.deepEqual(harness.calls, {
    planner: 2,
    mutate: 0,
    save: 1,
    resolve: 0,
    runtime: 1,
    artifact: 1,
    retry: 1,
  });
});

test("R8: invalid plans have no legacy promotion or selector fallback", async () => {
  const harness = commandHarness(planCandidate({ rule: null }));
  const before = structuredClone(harness.state());
  await expectTypedPlanFailure(harness.execute, "rule");
  assert.deepEqual(harness.state(), before);
  assert.equal(harness.calls.mutate, 0);
  assert.equal(harness.calls.save, 0);
  assert.equal(harness.calls.resolve, 0);
});

test("R9: direct command matrix distinguishes invalid, exact, and stale outcomes", async () => {
  const invalid = commandHarness(planCandidate({ maxAttempts: 10_001 }));
  await expectTypedPlanFailure(invalid.execute, "maxAttempts");
  assert.equal(invalid.calls.save, 0);

  const exact = commandHarness(planCandidate({ maxAttempts: 10_000 }));
  const result = await exact.execute();
  assert.equal(result.maxAttempts, 10_000);
  assert.equal(exact.calls.save, 1);

  const stale = commandHarness(planCandidate(), { stale: true });
  await assert.rejects(stale.execute, (error) => error?.code === "FLOW_STATE_ATOMIC_STALE");
  assert.equal(stale.calls.save, 1);
  assert.equal(stale.calls.planner, 1);
  assert.equal(stale.calls.resolve, 0);
});
