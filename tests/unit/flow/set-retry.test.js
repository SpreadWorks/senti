import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import SetRetryCommand from "../../../src/flow/lib/set-retry.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const roots = [];

afterEach(() => {
  while (roots.length > 0) removeTmpDir(roots.pop());
});

function retryFixture({ nodeId = "test-review", failureKind = "semantic" } = {}) {
  const root = createTmpDir("set-retry-v1-");
  roots.push(root);
  const manager = makeFlowManager(root);
  const flow = new CanonicalFlowFixture({
    flowManager: manager,
    specId: "001-retry",
    runId: `retry-${nodeId}-${failureKind}`,
  }).create().registerActive().activate(nodeId);
  manager.failCurrentAttempt({
    specId: flow.specId,
    failure: {
      category: failureKind === "semantic" ? "semantic" : "provider",
      code: failureKind === "semantic" ? "REVIEW_REJECTED" : "REVIEW_PROVIDER_UNAVAILABLE",
      message: "The retryable command result is represented by the active typed Attempt.",
      retryable: true,
      retryKind: failureKind,
    },
  });
  return { manager, flow };
}

function commandInput(flow, values = {}) {
  return {
    action: "reset",
    kind: "review",
    phase: "test",
    reason: "The failed Attempt is retried through the Version-1 lifecycle.",
    yes: true,
    flowState: flow.manager.load(flow.flow.specId),
    flowManager: flow.manager,
    ...values,
  };
}

test("retry reset appends exactly one canonical semantic retry Activity", () => {
  const flow = retryFixture();
  const command = new SetRetryCommand();
  const before = flow.manager.activityLedger(flow.flow.specId).length;

  const result = command.execute(commandInput(flow));

  assert.equal(result.reset, true, JSON.stringify(result));
  assert.equal(result.grants.length, 1);
  assert.equal(result.grants[0].operation, "retry_attempt");
  assert.equal(flow.manager.activityLedger(flow.flow.specId).length, before + 1);
  const state = flow.manager.canonicalState(flow.flow.specId);
  assert.equal(state.attempt.sequence, 2);
  assert.equal(state.attempt.consumption.semantic, 1);
  assert.equal(state.attempt.failure, null);
  assert.equal(Object.hasOwn(flow.manager.load(flow.flow.specId), "retryRecovery"), false);
});

test("retry reset preserves tooling retry accounting in the replacement Attempt", () => {
  const flow = retryFixture({ failureKind: "tooling" });

  const result = new SetRetryCommand().execute(commandInput(flow));

  assert.equal(result.grants[0].sequence, 2);
  const state = flow.manager.canonicalState(flow.flow.specId);
  assert.equal(state.attempt.consumption.semantic, 0);
  assert.equal(state.attempt.consumption.tooling, 1);
  assert.equal(flow.manager.activityLedger(flow.flow.specId).at(-1).transition.operation, "retry_attempt");
});

test("retry reset rejects a route that does not identify the active Attempt", () => {
  const flow = retryFixture();
  const before = flow.manager.activityLedger(flow.flow.specId);

  const result = new SetRetryCommand().execute(commandInput(flow, { phase: "impl" }));

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "RETRY_NOT_AVAILABLE");
  assert.match(result.errors[0].messages.join(" "), /target is not active/);
  assert.deepEqual(flow.manager.activityLedger(flow.flow.specId), before);
});

test("retry reset fails closed after the definition-owned retry budget is exhausted", () => {
  const flow = retryFixture();
  const command = new SetRetryCommand();
  let result = null;
  for (let retry = 0; retry < 10; retry += 1) {
    result = command.execute(commandInput(flow));
    if (result.ok === false) break;
    flow.manager.failCurrentAttempt({
      specId: flow.flow.specId,
      failure: {
        category: "semantic",
        code: "REVIEW_REJECTED",
        message: "The retry budget was consumed by the previous canonical Attempt.",
        retryable: true,
        retryKind: "semantic",
      },
    });
  }
  const before = flow.manager.activityLedger(flow.flow.specId);

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "RETRY_NOT_AVAILABLE");
  assert.match(result.errors[0].messages.join(" "), /does not authorize retry/);
  assert.deepEqual(flow.manager.activityLedger(flow.flow.specId), before);
});
