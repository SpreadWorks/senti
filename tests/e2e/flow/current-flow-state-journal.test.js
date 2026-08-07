import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { buildCurrentFlowDefinition } from "../../../src/flow/definition.js";
import {
  ActivityTransition,
  CurrentAttempt,
  CurrentFlowState,
  CurrentFlowStateInvariantError,
  CurrentFlowStateStore,
  FlowActivity,
} from "../../../src/flow/lib/current-flow-state.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const NOW = "2026-08-07T00:00:00.000Z";
const LATER = "2026-08-07T00:02:00.000Z";

function result(summary) {
  return { outcome: "passed", summary, confirmedAt: LATER, artifactRefs: [{ kind: "artifact", id: `${summary}-artifact` }] };
}

function attemptFor(state, currentPath, id, sequence = null, tooling = 0) {
  const contract = state.definition.contractFor(currentPath.at(-1), state.root);
  const leaf = state.findNode(currentPath.at(-1));
  const nextSequence = sequence ?? leaf.attemptSequence + 1;
  const previous = state.current?.at(-1) === leaf.id ? state.attempt : null;
  return new CurrentAttempt({
    id,
    sequence: nextSequence,
    startedAt: NOW,
    consumption: {
      semantic: previous === null ? 0 : previous.consumption.semantic + (tooling === previous.consumption.tooling ? 1 : 0),
      tooling,
    },
    failure: null,
    blocker: null,
    incomplete: [],
    operationClaims: [{ operation: "execute", resources: [...contract.resourceContract.required] }],
  });
}

function activity({
  id,
  state,
  currentPath,
  task = null,
  activityAttempt = null,
  order,
  operation,
  status = null,
  activityResult = null,
  failure = null,
}) {
  const node = state.findNode(currentPath.at(-1));
  const effectiveAttempt = operation === "retry_attempt" ? state.attempt : activityAttempt ?? state.attempt;
  const type = {
    add_task: "task_added",
    start_attempt: "attempt_started",
    retry_attempt: "attempt_retried",
    update_attempt: "attempt_updated",
    fail_attempt: "attempt_failed",
    confirm_attempt: "result_confirmed",
    rewind: "recovery",
    recover_attempt: "recovery",
  }[operation];
  return new FlowActivity({
    id,
    nodeId: node.id,
    nodeKey: node.key,
    attemptId: effectiveAttempt?.id ?? null,
    sequence: effectiveAttempt?.sequence ?? null,
    confirmationOrder: order,
    type,
    transition: new ActivityTransition({
      operation,
      path: currentPath,
      task,
      attempt: activityAttempt,
      status,
    }),
    result: activityResult,
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

describe("Current Flow state filesystem lifecycle", () => {
  let tmp = null;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("persists production flow/task order, review retry, gate recovery, and append-only Activity facts across reload", () => {
    tmp = createTmpDir("current-flow-e2e-");
    const definition = buildCurrentFlowDefinition();
    const directory = path.join(tmp, "specs", "900-current-state");
    let state = CurrentFlowState.create({ definition, execution: { mode: "branch" } });
    const store = new CurrentFlowStateStore({ directory, definition });
    store.create(state);
    let order = 1;

    const apply = (entry) => {
      state = new CurrentFlowStateStore({ directory, definition }).apply({ activity: entry });
      state = new CurrentFlowStateStore({ directory, definition }).load();
      order += 1;
    };
    const completeDescriptor = (label) => {
      const descriptor = state.nextAction();
      assert.equal(descriptor.operation, "start", `expected normal start for ${descriptor.nodeId}`);
      const currentPath = descriptor.path;
      apply(activity({
        id: `${label}-start`,
        state,
        currentPath,
        activityAttempt: attemptFor(state, currentPath, `${label}-attempt`),
        order,
        operation: "start_attempt",
      }));
      apply(activity({
        id: `${label}-confirm`,
        state,
        currentPath,
        order,
        operation: "confirm_attempt",
        status: "done",
        activityResult: result(label),
      }));
    };
    const advanceUntil = (nodeId, label) => {
      let count = 0;
      while (state.nextAction()?.nodeId !== nodeId) {
        completeDescriptor(`${label}-${count}`);
        count += 1;
        if (count > 100) throw new Error("production Flow order did not converge");
      }
    };

    const implPath = ["flow", "impl"];
    apply(activity({
      id: "task-a-added",
      state,
      currentPath: implPath,
      task: { id: "task-a", key: "first" },
      order,
      operation: "add_task",
    }));
    apply(activity({
      id: "task-b-added",
      state,
      currentPath: implPath,
      task: { id: "task-b", key: "second" },
      order,
      operation: "add_task",
    }));
    assert.deepEqual(state.findNode("impl").steps.slice(0, 5).map((node) => node.id), [
      "implement", "task-a", "task-b", "test-execute", "test-result-review",
    ]);

    advanceUntil("task-a/task-impl", "prelude");
    const taskAImpl = state.nextAction().path;
    completeDescriptor("task-a-impl");
    assert.equal(taskAImpl.at(-1), "task-a/task-impl");
    assert.equal(state.nextAction().nodeId, "task-a/task-review");
    const reviewPath = state.nextAction().path;
    apply(activity({
      id: "task-a-review-start",
      state,
      currentPath: reviewPath,
      activityAttempt: attemptFor(state, reviewPath, "review-1"),
      order,
      operation: "start_attempt",
    }));
    apply(activity({
      id: "task-a-review-failed",
      state,
      currentPath: reviewPath,
      order,
      operation: "fail_attempt",
      activityResult: {
        outcome: "failed",
        summary: "Review needs retry.",
        confirmedAt: LATER,
        artifactRefs: [],
      },
      failure: {
        category: "review",
        code: "review_failed",
        message: "Review needs retry.",
        retryable: true,
        retryKind: "semantic",
      },
    }));
    apply(activity({
      id: "task-a-review-retry",
      state,
      currentPath: reviewPath,
      activityAttempt: attemptFor(state, reviewPath, "review-2", 2),
      order,
      operation: "retry_attempt",
    }));
    apply(activity({
      id: "task-a-review-confirm",
      state,
      currentPath: reviewPath,
      order,
      operation: "confirm_attempt",
      status: "done",
      activityResult: result("task-a-review"),
    }));
    assert.equal(state.nextAction().nodeId, "task-a/task-gate");
    const gatePath = state.nextAction().path;
    completeDescriptor("task-a-gate");
    assert.equal(state.findNode("task-a").status, "done");
    assert.equal(state.nextAction().nodeId, "task-b/task-impl");

    apply(activity({
      id: "task-a-review-rewind",
      state,
      currentPath: reviewPath,
      activityAttempt: attemptFor(state, reviewPath, "review-rewind"),
      order,
      operation: "rewind",
    }));
    assert.equal(state.current.at(-1), "task-a/task-review");
    assert.equal(state.attempt.sequence, 3);
    assert.equal(state.findNode("task-a/task-review").attemptSequence, 3);
    assert.equal(state.findNode("task-a/task-gate").status, "invalidated");
    assert.equal(state.findNode("task-b").status, "invalidated");
    apply(activity({
      id: "task-a-review-reconfirm",
      state,
      currentPath: reviewPath,
      order,
      operation: "confirm_attempt",
      status: "done",
      activityResult: result("task-a-review-reconfirmed"),
    }));
    assert.equal(state.nextAction().operation, "recover");
    assert.equal(state.nextAction().nodeId, "task-a/task-gate");
    assert.throws(
      () => new CurrentFlowStateStore({ directory, definition }).apply({ activity: activity({
        id: "illegal-gate-start",
        state,
        currentPath: gatePath,
        activityAttempt: attemptFor(state, gatePath, "illegal-gate"),
        order,
        operation: "start_attempt",
      }) }),
      (error) => error instanceof CurrentFlowStateInvariantError && /next executable leaf/.test(error.message),
    );
    apply(activity({
      id: "task-a-gate-recover",
      state,
      currentPath: gatePath,
      activityAttempt: attemptFor(state, gatePath, "gate-recovery"),
      order,
      operation: "recover_attempt",
    }));
    assert.equal(state.attempt.sequence, 2);
    assert.equal(state.findNode("task-a/task-gate").attemptSequence, 2);
    apply(activity({
      id: "task-a-gate-recovered",
      state,
      currentPath: gatePath,
      order,
      operation: "confirm_attempt",
      status: "done",
      activityResult: result("task-a-gate-recovered"),
    }));
    assert.equal(state.nextAction().operation, "recover");
    assert.equal(state.nextAction().nodeId, "task-b/task-impl");

    const taskBImplPath = state.nextAction().path;
    apply(activity({
      id: "task-b-impl-recover",
      state,
      currentPath: taskBImplPath,
      activityAttempt: attemptFor(state, taskBImplPath, "task-b-impl-recovery"),
      order,
      operation: "recover_attempt",
    }));
    apply(activity({
      id: "task-b-impl-confirm",
      state,
      currentPath: taskBImplPath,
      order,
      operation: "confirm_attempt",
      status: "done",
      activityResult: result("task-b-impl"),
    }));
    const taskBReviewPath = state.nextAction().path;
    apply(activity({
      id: "task-b-review-recover",
      state,
      currentPath: taskBReviewPath,
      activityAttempt: attemptFor(state, taskBReviewPath, "task-b-review-recovery"),
      order,
      operation: "recover_attempt",
    }));
    apply(activity({
      id: "task-b-review-confirm",
      state,
      currentPath: taskBReviewPath,
      order,
      operation: "confirm_attempt",
      status: "done",
      activityResult: result("task-b-review"),
    }));
    const taskBGatePath = state.nextAction().path;
    apply(activity({
      id: "task-b-gate-recover",
      state,
      currentPath: taskBGatePath,
      activityAttempt: attemptFor(state, taskBGatePath, "task-b-gate-recovery"),
      order,
      operation: "recover_attempt",
    }));
    apply(activity({
      id: "task-b-gate-confirm",
      state,
      currentPath: taskBGatePath,
      order,
      operation: "confirm_attempt",
      status: "done",
      activityResult: result("task-b-gate"),
    }));
    assert.equal(state.nextAction().nodeId, "test-execute");

    const journal = store.journal.read();
    assert.equal(journal.length, order - 1);
    assert.deepEqual(journal.map((entry) => entry.confirmationOrder), Array.from({ length: journal.length }, (_, index) => index + 1));
    assert.deepEqual(
      journal.filter((entry) => entry.attemptId === "review-1").map((entry) => [entry.sequence, entry.confirmationOrder]),
      [[1, journal.find((entry) => entry.id === "task-a-review-start").confirmationOrder], [1, journal.find((entry) => entry.id === "task-a-review-failed").confirmationOrder], [1, journal.find((entry) => entry.id === "task-a-review-retry").confirmationOrder]],
    );
    assert.equal(journal.find((entry) => entry.id === "task-a-review-failed").failure.code, "review_failed");
    assert.equal(journal.find((entry) => entry.id === "task-a-review-retry").transition.attempt.sequence, 2);
    assert.equal(journal.find((entry) => entry.id === "task-a-review-rewind").sequence, 3);
    assert.equal(journal.find((entry) => entry.id === "task-a-gate-recover").sequence, 2);
    assert.equal(journal.find((entry) => entry.id === "task-a-gate-recovered").result.summary, "task-a-gate-recovered");
    store.writeActivitiesView();
    assert.match(fs.readFileSync(path.join(directory, "activities.md"), "utf8"), /attempt_retried/);
  });
});
