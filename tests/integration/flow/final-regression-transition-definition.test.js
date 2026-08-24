import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  FINAL_REGRESSION_STEP_DEFINITION,
  FinalRegressionStepFacts,
  NonGateAttemptIdentity,
  NonGateCatalogPublication,
  NonGateCompletionFacts,
  NonGateLineage,
  NonGateProducerOwnership,
  NonGateRecoveryEvidence,
  NonGateRetryMetrics,
  NonGateSourcePublication,
  NonGateTargetBinding,
  NonGateTransitionFacts,
  resolveNonGateTransition,
} from "../../../src/flow/definition.js";
import { applyFinalRegressionTransition } from "../../../src/flow/lib/final-regression-transition-application.js";

const digest = "f".repeat(64);
function facts({
  result = "fail",
  category = "caused_by_current_change",
  retry = { used: 0, maximum: 1 },
  commonRetry = retry,
  current = true,
  accepted = false,
  nonblocking = false,
} = {}) {
  const attempt = new NonGateAttemptIdentity({ id: "final-attempt-1", sequence: 1 });
  const stepFacts = new FinalRegressionStepFacts({
    result,
    artifactDigest: { value: digest },
    failure: { kind: category === "caused_by_current_change" ? "caused_by_current_change" : "infra_failure", category },
    retry,
    changedFileSnapshot: { digest, current },
    recordAndProceed: { accepted, digest: accepted ? digest : null },
    nonblocking: { enabled: nonblocking },
  });
  return new NonGateTransitionFacts({
    runId: "run-final", specId: "001-final", stepId: "final-regression", snapshotRevision: "revision-final",
    producer: new NonGateProducerOwnership({ runId: "run-final", specId: "001-final", activityId: "activity-final", stepId: "final-regression", attempt }),
    target: new NonGateTargetBinding({ runId: "run-final", specId: "001-final", stepId: "final-regression", attempt }), currentAttempt: attempt,
    catalogPublication: new NonGateCatalogPublication({ runId: "run-final", specId: "001-final", stepId: "final-regression", attemptId: attempt.id, sequence: attempt.sequence, producerActivityId: "activity-final", artifactId: "final.result", fingerprint: digest }),
    sourcePublication: new NonGateSourcePublication({ runId: "run-final", specId: "001-final", stepId: "final-regression", attemptId: attempt.id, sequence: attempt.sequence, producerActivityId: "activity-final", artifactId: "final.result", fingerprint: digest }),
    lineage: new NonGateLineage({ sourceAttempt: attempt, canonicalAttempt: attempt, sourceFingerprint: digest, canonicalFingerprint: digest }),
    retry: new NonGateRetryMetrics(commonRetry), completion: new NonGateCompletionFacts({ completed: result !== "fail" || accepted }), recoveryEvidence: new NonGateRecoveryEvidence(), nonblocking, stepFacts,
  });
}

describe("final-regression Definition transition policy", () => {
  it("selects every final-regression disposition from typed canonical facts", () => {
    const cases = [
      [{ result: "pass" }, "advance"], [{ result: "skipped" }, "advance"],
      [{ category: "caused_by_current_change" }, "repair"], [{ category: "existing_failure" }, "await-user-input"],
      [{ category: "environment" }, "external-blocked"], [{ accepted: true }, "record-and-proceed"],
      [{ current: false }, "blocked"], [{ retry: { used: 1, maximum: 1 } }, "blocked"],
    ];
    for (const [input, operation] of cases) assert.equal(resolveNonGateTransition(facts(input), FINAL_REGRESSION_STEP_DEFINITION).disposition.operation, operation);
  });

  it("is deterministic after serializing the typed observations", () => {
    const source = facts({ category: "existing_failure" });
    const first = resolveNonGateTransition(source, FINAL_REGRESSION_STEP_DEFINITION);
    const restored = NonGateTransitionFacts.fromPersisted(source.toJSON(), {
      stepFacts: FinalRegressionStepFacts.fromPersisted,
    });
    const second = resolveNonGateTransition(restored, FINAL_REGRESSION_STEP_DEFINITION);
    assert.deepEqual(first.toJSON(), second.toJSON());
  });

  it("keeps nonblocking advisory and retry accounting inside the same strict decision", () => {
    const strict = resolveNonGateTransition(facts({
      category: "existing_failure",
      nonblocking: true,
    }), FINAL_REGRESSION_STEP_DEFINITION);
    assert.equal(strict.facts.stepFacts.nonblockingPolicy.enabled, true);
    assert.equal(strict.disposition.operation, "await-user-input");

    const mismatched = resolveNonGateTransition(facts({
      retry: { used: 0, maximum: 1 },
      commonRetry: { used: 1, maximum: 1 },
    }), FINAL_REGRESSION_STEP_DEFINITION);
    assert.equal(mismatched.disposition.operation, "blocked");
    assert.equal(mismatched.disposition.reason, "retry_history_mismatch");
  });

  it("does not persist repair or blocked effects while applying sealed advancement", () => {
    const applied = [];
    const flowManager = {
      updateStepStatus(transition, options) { applied.push(["advance", transition, options]); },
    };
    const apply = (input, commandResult = { result: "fixture" }) => applyFinalRegressionTransition({
      flowManager,
      specId: "001-final",
      commandResult,
      decision: resolveNonGateTransition(facts(input), FINAL_REGRESSION_STEP_DEFINITION),
    });

    apply({ result: "pass" });
    apply({ category: "caused_by_current_change" });
    apply({ category: "existing_failure" });
    apply({ category: "environment" });

    assert.equal(applied.length, 1);
    assert.deepEqual(applied[0], [
      "advance",
      { stepId: "final-regression", requestedStatus: "done" },
      { specId: "001-final" },
    ]);
  });
});
