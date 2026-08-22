import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  CanonicalRetryRecovery,
  RetryRecoveryInput,
} from "../../../src/flow/lib/retry-recovery.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

const roots = [];

afterEach(() => {
  while (roots.length > 0) removeTmpDir(roots.pop());
});

test("canonical retry recovery validates the route before it appends the Version Store Activity", () => {
  const root = createTmpDir("retry-recovery-runtime-v1-");
  roots.push(root);
  const manager = makeFlowManager(root);
  const flow = new CanonicalFlowFixture({ flowManager: manager, specId: "001-retry", runId: "retry-runtime" })
    .create().registerActive().activate("spec-review");
  manager.failCurrentAttempt({
    specId: flow.specId,
    failure: {
      category: "semantic",
      code: "REVIEW_REJECTED",
      message: "The provider result is a retryable canonical review Attempt failure.",
      retryable: true,
      retryKind: "semantic",
    },
  });
  const grant = new CanonicalRetryRecovery({
    flowManager: manager,
    state: manager.load(flow.specId),
    request: new RetryRecoveryInput({
      action: "reset",
      kind: "review",
      phase: "spec",
      reason: "The Version-1 definition authorizes this semantic retry attempt.",
      yes: true,
    }),
  }).apply();

  assert.equal(grant.operation, "retry_attempt");
  assert.equal(grant.sequence, 2);
  assert.equal(manager.activityLedger(flow.specId).at(-1).transition.operation, "retry_attempt");
  assert.equal(Object.hasOwn(manager.load(flow.specId), "retryRecovery"), false);
});
