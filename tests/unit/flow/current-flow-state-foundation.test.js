import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { ProcessIdentitySource } from "../../../src/lib/process-identity.js";
import { buildCurrentFlowDefinition, collectFlowLeafIds, getFlowNode } from "../../../src/flow/definition.js";
import {
  ActivityTransition,
  CurrentAttempt,
  CurrentFlowState,
  CurrentFlowStateConflictError,
  CurrentFlowStateInvariantError,
  CurrentFlowStateStore,
  FlowActivity,
  FlowActivityJournal,
  TaskNode,
} from "../../../src/flow/lib/current-flow-state.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const NOW = "2026-08-07T00:00:00.000Z";
const LATER = "2026-08-07T00:01:00.000Z";

function definition() {
  return buildCurrentFlowDefinition();
}

function taskAttempt(id, number = 1, { tooling = 0, semantic = number - 1 - tooling, resources = [] } = {}) {
  return new CurrentAttempt({
    id,
    number,
    startedAt: NOW,
    consumption: { semantic, tooling },
    blocker: { code: "waiting", message: "Waiting for the current review." },
    incomplete: [{ code: "validation_pending", message: "The current validation is not complete." }],
    operationClaims: [{ operation: "review", resources }],
  });
}

function activityFor({ id, state, path: currentPath, attempt, confirmationOrder, operation = "start_attempt", result = null, status = null, failure = null }) {
  const node = state.findNode(currentPath.at(-1));
  const effectiveAttempt = operation === "retry_attempt" ? state.attempt : attempt ?? state.attempt;
  return new FlowActivity({
    id,
    nodeId: node.id,
    nodeKey: node.key,
    attemptId: effectiveAttempt?.id ?? null,
    // sequence is the Attempt sequence, not a journal-wide counter.
    sequence: effectiveAttempt?.number ?? null,
    confirmationOrder,
    type: operation === "confirm_attempt"
      ? "result_confirmed"
      : operation === "retry_attempt"
        ? "attempt_retried"
        : operation === "rewind"
          ? "recovery"
          : "attempt_started",
    transition: new ActivityTransition({ operation, path: currentPath, task: null, attempt, status }),
    result,
    timing: { startedAt: NOW, finishedAt: LATER, durationMs: 60000 },
    failure,
    provider: "provider",
    model: "model",
    effort: "standard",
    usage: { inputTokens: 11, outputTokens: 7, cacheReadTokens: 2, cost: 0 },
    references: {
      evaluations: [{ id: "evaluation-1", label: null }],
      findings: [{ id: "finding-1", label: null }],
      repairs: [{ id: "repair-1", label: null }],
      artifacts: [{ id: "artifact-1", label: null }],
    },
  });
}

function passedResult() {
  return { outcome: "passed", summary: "Confirmed.", confirmedAt: LATER, artifactRefs: ["artifact-1"] };
}

function identitySource(bootIdentity) {
  return new ProcessIdentitySource({
    platform: "linux",
    pid: process.pid,
    readBootIdentity: () => bootIdentity,
    readProcessStartFingerprint: () => "100",
  });
}

function leafIds(node, result = []) {
  if (node.steps.length === 0) result.push(node.id);
  else node.steps.forEach((child) => leafIds(child, result));
  return result;
}

describe("Current Flow state foundation", () => {
  let tmp = null;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("adapts the production definition, preserves all current step order, and materializes arbitrary Tasks in impl.steps", () => {
    const state = CurrentFlowState.create({ definition: definition(), execution: { mode: "worktree" } });
    assert.equal(state.toJSON().schemaRevision, 1);
    assert.equal(state.toJSON().version, 1);
    assert.equal(state.toJSON().current, null);
    assert.equal(state.toJSON().attempt, null);
    assert.equal(Object.hasOwn(state.toJSON(), "root"), false);
    assert.equal(state.execution.mode, "worktree");
    assert.deepEqual(
      state.findNode("impl").steps.map((node) => node.id),
      getFlowNode("impl").children.map((node) => node.id),
    );
    assert.deepEqual(leafIds(state.root), collectFlowLeafIds());

    const withFirst = state.addTask({ id: "task-1", key: "first-task" });
    const withBoth = withFirst.addTask({ id: "task-2", key: "second-task" });
    const first = withBoth.findNode("task-1");
    const second = withBoth.findNode("task-2");
    assert.ok(first instanceof TaskNode);
    assert.ok(second instanceof TaskNode);
    assert.deepEqual(first.steps.map((step) => step.id), ["task-1/task-impl", "task-1/task-review", "task-1/task-gate"]);
    assert.deepEqual(second.steps.map((step) => step.id), ["task-2/task-impl", "task-2/task-review", "task-2/task-gate"]);
    assert.equal(withBoth.findNode("task-1/task-review").key, "task.task-review");
    assert.equal(definition().contractFor(withBoth.findNode("task-1/task-review").id, withBoth.root).semanticRetryLimit, 3);
    assert.equal(definition().contractFor(withBoth.findNode("task-1/task-review").id, withBoth.root).toolingRetryLimit, 1);
    assert.equal(definition().contractFor(withBoth.findNode("task-1/task-impl").id, withBoth.root).toolingRetryLimit, null);
  });

  it("keeps retry, blocker, incomplete, and resource claims only in the active Attempt and validates a real root-to-leaf path", () => {
    let state = CurrentFlowState.create({ definition: definition() }).addTask({ id: "task-1", key: "first-task" });
    const pathToImpl = ["flow", "impl", "task-1", "task-1/task-impl"];
    state = state.startAttempt({ path: pathToImpl, attempt: taskAttempt("attempt-1", 1, { resources: ["task_spec"] }) });
    assert.deepEqual(state.current, pathToImpl);
    assert.deepEqual(state.toJSON().current, pathToImpl);
    assert.equal(state.toJSON().attempt.id, "attempt-1");
    assert.equal(state.attempt.consumption.semantic, 0);
    assert.equal(state.attempt.blocker.code, "waiting");
    assert.equal(state.attempt.incomplete[0].code, "validation_pending");
    assert.deepEqual(state.attempt.operationClaims[0].resources, ["task_spec"]);
    state = state.confirmCurrentAttempt({ result: passedResult() });
    assert.equal(state.current, null);
    assert.equal(Object.hasOwn(state.toJSON(), "stepAttempts"), false);
    assert.equal(state.findNode("task-1/task-impl").result.outcome, "passed");

    assert.throws(
      () => new CurrentFlowState({
        ...state.toJSON(),
        current: ["flow", "impl", "task-1/task-review"],
        attempt: taskAttempt("attempt-2"),
      }, { definition: definition() }),
      /parent-child path/,
    );
    assert.throws(
      () => new CurrentFlowState({ ...state.toJSON(), current: null, attempt: taskAttempt("orphan") }, { definition: definition() }),
      /attempt requires a current path/,
    );
    assert.throws(
      () => new CurrentFlowState({ ...state.toJSON(), current: pathToImpl, attempt: null }, { definition: definition() }),
      /current path requires an active Attempt/,
    );
  });

  it("replaces an active Attempt deterministically and prevents retry-limit, sequence, consumption, and start bypasses", () => {
    let state = CurrentFlowState.create({ definition: definition() }).addTask({ id: "task-1", key: "first-task" });
    const reviewPath = ["flow", "impl", "task-1", "task-1/task-review"];
    const resourceState = CurrentFlowState.create({ definition: definition() }).addTask({ id: "task-resource", key: "resource-task" });
    const resourcePath = ["flow", "impl", "task-resource", "task-resource/task-review"];
    assert.throws(
      () => resourceState.startAttempt({ path: resourcePath, attempt: taskAttempt("resource-1", 1, { resources: ["uncontracted"] }) }),
      /resource claim exceeds definition contract/,
    );
    state = state.startAttempt({ path: reviewPath, attempt: taskAttempt("review-1") });
    const retry = taskAttempt("review-2", 2, { semantic: 1, tooling: 0 });
    state = state.retryCurrentAttempt({ attempt: retry, kind: "semantic" });
    assert.deepEqual(state.current, reviewPath);
    assert.equal(state.attempt.id, "review-2");
    assert.equal(state.attempt.number, 2);
    assert.equal(state.attempt.consumption.semantic, 1);
    assert.equal(state.attempt.consumption.tooling, 0);
    assert.equal(Object.hasOwn(state.toJSON(), "retryClaims"), false);

    assert.throws(
      () => state.retryCurrentAttempt({ attempt: taskAttempt("review-gap", 4, { semantic: 3, tooling: 0 }), kind: "semantic" }),
      /immediately follow/,
    );
    assert.throws(
      () => state.retryCurrentAttempt({ attempt: taskAttempt("review-wrong-kind", 3, { semantic: 2, tooling: 0 }), kind: "tooling" }),
      /tooling retry must increment only tooling/,
    );
    assert.throws(
      () => state.retryCurrentAttempt({ attempt: taskAttempt("review-wrong-consumption", 3, { semantic: 1, tooling: 1 }), kind: "semantic" }),
      /semantic retry must increment only semantic/,
    );
    assert.throws(
      () => taskAttempt("review-double-consumption", 2, { semantic: 1, tooling: 1 }),
      /attempt.number must equal/,
    );
    assert.throws(
      () => taskAttempt("review-zero-consumption", 2, { semantic: 0, tooling: 0 }),
      /attempt.number must equal/,
    );

    state = state.retryCurrentAttempt({ attempt: taskAttempt("review-3", 3, { semantic: 2, tooling: 0 }), kind: "semantic" });
    state = state.retryCurrentAttempt({ attempt: taskAttempt("review-4", 4, { semantic: 3, tooling: 0 }), kind: "semantic" });
    assert.throws(
      () => state.retryCurrentAttempt({ attempt: taskAttempt("review-semantic-over", 5, { semantic: 4, tooling: 0 }), kind: "semantic" }),
      /semanticRetryLimit/,
    );

    let toolingState = CurrentFlowState.create({ definition: definition() }).addTask({ id: "task-2", key: "second-task" });
    const toolingPath = ["flow", "impl", "task-2", "task-2/task-review"];
    toolingState = toolingState.startAttempt({ path: toolingPath, attempt: taskAttempt("tooling-1") });
    toolingState = toolingState.retryCurrentAttempt({ attempt: taskAttempt("tooling-2", 2, { semantic: 0, tooling: 1 }), kind: "tooling" });
    assert.equal(toolingState.attempt.consumption.tooling, 1);
    assert.throws(
      () => toolingState.retryCurrentAttempt({ attempt: taskAttempt("tooling-over", 3, { semantic: 0, tooling: 2 }), kind: "tooling" }),
      /toolingRetryLimit/,
    );

    state = state.confirmCurrentAttempt({ result: passedResult() });
    assert.throws(
      () => state.startAttempt({ path: reviewPath, attempt: taskAttempt("review-bypass", 3, { semantic: 2, tooling: 0 }) }),
      /startAttempt may target only a pending leaf/,
    );
    state = state.rewind({ path: reviewPath, attempt: taskAttempt("review-rewind-1") });
    state = state.confirmCurrentAttempt({ result: passedResult() });
    const gatePath = ["flow", "impl", "task-1", "task-1/task-gate"];
    assert.equal(state.findNode("task-1/task-gate").status, "invalidated");
    assert.throws(
      () => state.startAttempt({ path: gatePath, attempt: taskAttempt("gate-bypass") }),
      /startAttempt may target only a pending leaf/,
    );
  });

  it("records retry failure against the replaced Attempt while keeping its next Attempt state-only", () => {
    tmp = createTmpDir("current-flow-retry-activity-");
    const initial = CurrentFlowState.create({ definition: definition() }).addTask({ id: "task-1", key: "first-task" });
    const store = new CurrentFlowStateStore({ directory: tmp, definition: definition() });
    store.create(initial);
    const reviewPath = ["flow", "impl", "task-1", "task-1/task-review"];
    const start = activityFor({
      id: "review-start",
      state: initial,
      path: reviewPath,
      attempt: taskAttempt("review-1"),
      confirmationOrder: 1,
    });
    const active = store.apply({ activity: start });
    const retried = activityFor({
      id: "review-retry",
      state: active,
      path: reviewPath,
      attempt: taskAttempt("review-2", 2, { semantic: 1, tooling: 0 }),
      confirmationOrder: 2,
      operation: "retry_attempt",
      failure: { kind: "semantic", code: "review_failed", message: "Review needs retry.", retryable: true },
    });
    const next = store.apply({ activity: retried });
    assert.equal(next.attempt.id, "review-2");
    assert.deepEqual(store.journal.read().map((entry) => [entry.attemptId, entry.sequence, entry.confirmationOrder]), [
      ["review-1", 1, 1],
      ["review-1", 1, 2],
    ]);
    assert.equal(store.journal.read()[1].failure.code, "review_failed");
    assert.throws(
      () => new FlowActivity({ ...retried.toJSON(), failure: null }),
      /requires a retryable failure/,
    );
    assert.throws(
      () => new FlowActivity({
        ...retried.toJSON(),
        failure: { code: "review_failed", message: "Review needs retry.", retryable: true },
      }),
      /activity.failure.kind is required/,
    );
  });

  it("invalidates every downstream node and its completed ancestors before a rewind becomes current", () => {
    let state = CurrentFlowState.create({ definition: definition() }).addTask({ id: "task-1", key: "first-task" });
    const implPath = ["flow", "impl", "task-1", "task-1/task-impl"];
    const reviewPath = ["flow", "impl", "task-1", "task-1/task-review"];
    const gatePath = ["flow", "impl", "task-1", "task-1/task-gate"];
    state = state.startAttempt({ path: implPath, attempt: taskAttempt("attempt-impl") }).confirmCurrentAttempt({ result: passedResult() });
    state = state.startAttempt({ path: reviewPath, attempt: taskAttempt("attempt-review") }).confirmCurrentAttempt({ result: passedResult() });
    state = state.startAttempt({ path: gatePath, attempt: taskAttempt("attempt-gate") }).confirmCurrentAttempt({ result: passedResult() });
    assert.equal(state.findNode("task-1").status, "done");
    assert.equal(state.findNode("task-1").result.summary, "Confirmed.");
    state = state.rewind({ path: reviewPath, attempt: taskAttempt("attempt-review-retry") });

    assert.equal(state.current.at(-1), "task-1/task-review");
    assert.equal(state.findNode("task-1/task-gate").status, "invalidated");
    assert.equal(state.findNode("task-1/task-gate").result, null);
    assert.equal(state.findNode("task-1").status, "in_progress");
    assert.equal(state.findNode("impl").status, "in_progress");
  });

  it("rejects forbidden current-runtime fields and invalid execution modes without a compatibility fallback", () => {
    const clean = CurrentFlowState.create({ definition: definition() }).toJSON();
    for (const field of ["currentTaskId", "childId", "runtimeLog", "metrics", "notes", "stepAttempts", "workerArtifactReceipts", "reviewConvergence", "reviewRecoveryBaselines", "testReviewRepairHistory", "expandedPluginHooks"]) {
      assert.throws(
        () => new CurrentFlowState({ ...clean, [field]: [] }, { definition: definition() }),
        (error) => error instanceof CurrentFlowStateInvariantError && error.message.includes(field),
      );
    }
    assert.throws(
      () => new CurrentFlowState({ ...clean, execution: { mode: "local" } }, { definition: definition() }),
      /execution.mode/,
    );
    assert.throws(
      () => new CurrentFlowState({ ...clean, version: 0 }, { definition: definition() }),
      /version/,
    );
    const missingCurrent = structuredClone(clean);
    delete missingCurrent.current;
    assert.throws(
      () => new CurrentFlowState(missingCurrent, { definition: definition() }),
      /flow state.current is required/,
    );
    const missingAttempt = structuredClone(clean);
    delete missingAttempt.attempt;
    assert.throws(
      () => new CurrentFlowState(missingAttempt, { definition: definition() }),
      /flow state.attempt is required/,
    );
    assert.throws(
      () => new CurrentFlowState({ ...clean, kind: "unknown" }, { definition: definition() }),
      /FlowRootNode.kind/,
    );
    const missingNodeStatus = structuredClone(clean);
    delete missingNodeStatus.steps[0].status;
    assert.throws(
      () => new CurrentFlowState(missingNodeStatus, { definition: definition() }),
      /node.status is required/,
    );
    const active = CurrentFlowState.create({ definition: definition() })
      .addTask({ id: "task-1", key: "first-task" })
      .startAttempt({
        path: ["flow", "impl", "task-1", "task-1/task-review"],
        attempt: taskAttempt("review-1"),
      });
    const inconsistentAttempt = active.toJSON();
    inconsistentAttempt.attempt.number = 2;
    assert.throws(
      () => new CurrentFlowState(inconsistentAttempt, { definition: definition() }),
      /attempt.number must equal/,
    );
    const overLimitAttempt = active.toJSON();
    overLimitAttempt.attempt = {
      ...overLimitAttempt.attempt,
      number: 5,
      consumption: { semantic: 4, tooling: 0 },
    };
    assert.throws(
      () => new CurrentFlowState(overLimitAttempt, { definition: definition() }),
      /semanticRetryLimit/,
    );
  });

  it("recovers idempotently from the journal-first crash window and rejects conflicting duplicate activities", () => {
    tmp = createTmpDir("current-flow-journal-");
    const initial = CurrentFlowState.create({ definition: definition() }).addTask({ id: "task-1", key: "first-task" });
    const store = new CurrentFlowStateStore({ directory: tmp, definition: definition() });
    store.create(initial);
    const pathToImpl = ["flow", "impl", "task-1", "task-1/task-impl"];
    const activity = activityFor({ id: "activity-start", state: initial, path: pathToImpl, attempt: taskAttempt("attempt-1"), confirmationOrder: 1 });
    const crashing = new CurrentFlowStateStore({
      directory: tmp,
      definition: definition(),
      faultInjector({ phase }) { if (phase === "activity-appended") throw new Error("crash after durable journal append"); },
    });
    assert.throws(() => crashing.apply({ activity }), /crash after durable/);
    assert.equal(store.load().confirmationOrder, 0);
    assert.equal(store.journal.read().length, 1);

    const recovered = store.apply({ activity });
    assert.equal(recovered.confirmationOrder, 1);
    assert.equal(recovered.attempt.id, "attempt-1");
    assert.equal(store.apply({ activity }).confirmationOrder, 1);
    assert.equal(store.journal.read().length, 1);

    const confirmed = activityFor({
      id: "activity-confirm",
      state: recovered,
      path: pathToImpl,
      confirmationOrder: 2,
      operation: "confirm_attempt",
      status: "done",
      result: passedResult(),
    });
    const afterStateWrite = new CurrentFlowStateStore({
      directory: tmp,
      definition: definition(),
      faultInjector({ phase }) { if (phase === "state-written") throw new Error("crash after state CAS"); },
    });
    assert.throws(() => afterStateWrite.apply({ activity: confirmed }), /crash after state CAS/);
    assert.equal(store.load().confirmationOrder, 2);
    assert.equal(store.apply({ activity: confirmed }).confirmationOrder, 2);
    assert.equal(store.journal.read().length, 2);
    assert.throws(
      () => store.apply({ activity: new FlowActivity({ ...confirmed.toJSON(), provider: "different-provider" }) }),
      (error) => error instanceof CurrentFlowStateConflictError,
    );
  });

  it("rejects a partial journal tail rather than treating it as historical control input", () => {
    tmp = createTmpDir("current-flow-partial-journal-");
    const journalPath = path.join(tmp, "activities.jsonl");
    fs.writeFileSync(journalPath, "{\"id\":\"partial\"");
    assert.throws(() => new FlowActivityJournal(journalPath).read(), /partial line/);
  });

  it("reclaims a process-identified stale lock before replaying the same Activity", () => {
    tmp = createTmpDir("current-flow-stale-lock-");
    const initial = CurrentFlowState.create({ definition: definition() }).addTask({ id: "task-1", key: "first-task" });
    const store = new CurrentFlowStateStore({ directory: tmp, definition: definition() });
    store.create(initial);
    const pathToImpl = ["flow", "impl", "task-1", "task-1/task-impl"];
    const entry = activityFor({ id: "activity-after-stale-lock", state: initial, path: pathToImpl, attempt: taskAttempt("attempt-1"), confirmationOrder: 1 });
    const stranded = new CurrentFlowStateStore({
      directory: tmp,
      definition: definition(),
      processIdentitySource: identitySource("owner-boot"),
    });
    stranded.lock.acquire();

    const recovering = new CurrentFlowStateStore({
      directory: tmp,
      definition: definition(),
      processIdentitySource: identitySource("recovery-boot"),
    });
    assert.equal(recovering.apply({ activity: entry }).confirmationOrder, 1);
    assert.equal(recovering.load().attempt.id, "attempt-1");
  });
});
