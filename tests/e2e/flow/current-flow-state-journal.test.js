import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { buildCurrentFlowDefinition } from "../../../src/flow/definition.js";
import {
  ActivityTransition,
  CurrentAttempt,
  CurrentFlowState,
  CurrentFlowStateStore,
  FlowActivity,
} from "../../../src/flow/lib/current-flow-state.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const NOW = "2026-08-07T00:00:00.000Z";
const LATER = "2026-08-07T00:02:00.000Z";

function attempt(id, number, tooling = 0) {
  return new CurrentAttempt({
    id,
    number,
    startedAt: NOW,
    consumption: { semantic: number - 1 - tooling, tooling },
    blocker: null,
    incomplete: [],
    operationClaims: [{ operation: "flow-operation", resources: [] }],
  });
}

function activity({ id, state, currentPath, task = null, activityAttempt = null, order, operation, status = null, result = null, failure = null }) {
  const node = state.findNode(currentPath.at(-1));
  // A retry records the active Attempt it replaces.  Its deterministic
  // transition separately carries the next Attempt.
  const effectiveAttempt = operation === "retry_attempt" ? state.attempt : activityAttempt ?? state.attempt;
  return new FlowActivity({
    id,
    nodeId: node.id,
    nodeKey: node.key,
    attemptId: effectiveAttempt?.id ?? null,
    sequence: effectiveAttempt?.number ?? null,
    confirmationOrder: order,
    type: operation === "add_task"
      ? "task_added"
      : operation === "confirm_attempt"
        ? "result_confirmed"
        : operation === "retry_attempt"
          ? "attempt_retried"
        : operation === "rewind"
          ? "recovery"
          : "attempt_started",
    transition: new ActivityTransition({
      operation,
      path: currentPath,
      task,
      attempt: activityAttempt,
      status,
    }),
    result,
    timing: null,
    failure,
    provider: null,
    model: null,
    effort: null,
    usage: null,
    references: {
      evaluations: [],
      findings: [],
      repairs: [],
      artifacts: [{ id: `${id}-artifact`, label: null }],
    },
  });
}

function result(summary, outcome = "passed") {
  return { outcome, summary, confirmedAt: LATER, artifactRefs: ["result-artifact"] };
}

describe("Current Flow state filesystem lifecycle", () => {
  let tmp = null;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("persists Task lifecycle, review retry, rewind invalidation, and append-only Activity facts across reload", () => {
    tmp = createTmpDir("current-flow-e2e-");
    const def = buildCurrentFlowDefinition();
    const directory = path.join(tmp, "specs", "900-current-state");
    let state = CurrentFlowState.create({ definition: def, execution: { mode: "branch" } });
    const store = new CurrentFlowStateStore({ directory, definition: def });
    store.create(state);

    const implPath = ["flow", "impl", "task-a", "task-a/task-impl"];
    const reviewPath = ["flow", "impl", "task-a", "task-a/task-review"];
    const gatePath = ["flow", "impl", "task-a", "task-a/task-gate"];
    const apply = (entry) => {
      state = new CurrentFlowStateStore({ directory, definition: def }).apply({ activity: entry });
      state = new CurrentFlowStateStore({ directory, definition: def }).load();
    };

    const implContainerPath = ["flow", "impl"];
    apply(activity({ id: "a1", state, currentPath: implContainerPath, task: { id: "task-a", key: "first" }, order: 1, operation: "add_task" }));
    apply(activity({ id: "a2", state, currentPath: implContainerPath, task: { id: "task-b", key: "second" }, order: 2, operation: "add_task" }));
    apply(activity({ id: "a3", state, currentPath: implPath, activityAttempt: attempt("impl-1", 1), order: 3, operation: "start_attempt" }));
    apply(activity({ id: "a4", state, currentPath: implPath, order: 4, operation: "confirm_attempt", status: "done", result: result("implementation complete") }));
    apply(activity({ id: "a5", state, currentPath: reviewPath, activityAttempt: attempt("review-1", 1), order: 5, operation: "start_attempt" }));
    apply(activity({
      id: "a6",
      state,
      currentPath: reviewPath,
      activityAttempt: attempt("review-2", 2),
      order: 6,
      operation: "retry_attempt",
      failure: { kind: "semantic", code: "review_failed", message: "Review needs retry.", retryable: true },
    }));
    apply(activity({ id: "a7", state, currentPath: reviewPath, order: 7, operation: "confirm_attempt", status: "done", result: result("review passed") }));
    apply(activity({ id: "a8", state, currentPath: gatePath, activityAttempt: attempt("gate-1", 1), order: 8, operation: "start_attempt" }));
    apply(activity({ id: "a9", state, currentPath: gatePath, order: 9, operation: "confirm_attempt", status: "done", result: result("gate passed") }));
    assert.equal(state.findNode("task-a").status, "done");
    apply(activity({ id: "a10", state, currentPath: reviewPath, activityAttempt: attempt("review-rewind-1", 1), order: 10, operation: "rewind" }));

    assert.equal(state.current.at(-1), "task-a/task-review");
    assert.equal(state.attempt.number, 1);
    assert.deepEqual(state.toJSON().current, reviewPath);
    assert.equal(state.toJSON().attempt.number, 1);
    assert.equal(state.findNode("task-a/task-gate").status, "invalidated");
    assert.equal(state.findNode("task-a/task-gate").result, null);
    assert.equal(state.findNode("task-b").status, "invalidated");
    assert.equal(state.confirmationOrder, 10);

    const journal = store.journal.read();
    assert.equal(journal.length, 10);
    assert.deepEqual(journal.map((entry) => entry.confirmationOrder), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.deepEqual(journal.filter((entry) => entry.attemptId?.startsWith("review-")).map((entry) => entry.sequence), [1, 1, 2, 1]);
    assert.deepEqual(
      journal.filter((entry) => entry.attemptId === "review-1").map((entry) => [entry.sequence, entry.confirmationOrder]),
      [[1, 5], [1, 6]],
    );
    assert.deepEqual(journal.slice(0, 2).map((entry) => [entry.type, entry.attemptId, entry.sequence]), [["task_added", null, null], ["task_added", null, null]]);
    assert.equal(journal.find((entry) => entry.id === "a6").failure.code, "review_failed");
    assert.equal(journal.find((entry) => entry.id === "a9").result.summary, "gate passed");
  });
});
