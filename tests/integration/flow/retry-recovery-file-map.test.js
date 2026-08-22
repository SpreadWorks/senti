import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildStateRetryRecoveryView,
  resolveRecoveryMaxAttempts,
} from "../../../src/flow/lib/retry-recovery.js";

const canonicalState = Object.freeze({ schemaRevision: 3, specId: "001-retry" });

describe("Version-1 retry recovery view", () => {
  it("does not offer a recovery command while the definition still owns retry budget", () => {
    const view = buildStateRetryRecoveryView({
      flowState: canonicalState,
      kind: "gate",
      phase: "spec",
      attempts: 1,
      max: 2,
    });
    assert.equal(view, null);
  });

  it("projects exhausted retry state as a fail-closed definition decision", () => {
    const view = buildStateRetryRecoveryView({
      flowState: canonicalState,
      kind: "review",
      phase: "impl",
      attempts: 2,
      max: 2,
    });
    assert.deepEqual(view, {
      kind: "review",
      phase: "impl",
      canonicalPhase: "impl",
      attempts: 2,
      max: 2,
      recoveryPossible: false,
      recoveryReason: "definition-owned-retry-budget-exhausted",
      changedEvidence: null,
      recoveryCommand: null,
    });
  });

  it("rejects legacy state replay instead of inspecting a root-side evidence map", () => {
    assert.throws(
      () => buildStateRetryRecoveryView({
        flowState: { specId: "001-retry", reviewRecoveryBaselines: [] },
        kind: "gate",
        phase: "integration",
        attempts: 5,
        max: 5,
      }),
      /Version-1 Flow/,
    );
    assert.equal(resolveRecoveryMaxAttempts({ resolvedMax: 3 }), 3);
    assert.throws(() => resolveRecoveryMaxAttempts({}), /resolved retry maximum/);
  });
});
