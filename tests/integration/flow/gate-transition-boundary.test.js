import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GateTransitionFacts,
  GateAttemptIdentity,
  GateCatalogPublication,
  GateLineage,
  GateRecoveryEvidence,
  GateRetryMetrics,
  GateFailureCategory,
  GateProducerOwnership,
  GateTargetBinding,
  GateTransitionDecision,
  GateStepUpdate,
  resolveGateTransition,
} from "../../../src/flow/definition.js";
import {
  GateTransitionActionProjection,
  admitGateTransition,
  applyGateTransitionDecision,
  projectGateTransitionDecision,
} from "../../../src/flow/lib/gate-transition-application.js";

const phases = ["draft", "spec", "task-spec", "task-impl", "integration"];

function facts(overrides = {}) {
  const phase = overrides.phase ?? "spec";
  const scope = overrides.scope ?? (phase === "task-impl" ? "task" : "flow");
  const taskId = scope === "task" ? "T-1" : null;
  const stepId = {
    draft: "draft-gate",
    spec: "spec-gate",
    "task-spec": "spec-gate",
    "task-impl": "T-1-gate",
    integration: "impl-gate",
  }[phase];
  const attempt = overrides.currentAttempt ?? new GateAttemptIdentity({ id: "attempt-7", sequence: 7 });
  const publication = overrides.catalogPublication ?? new GateCatalogPublication({
    attemptId: attempt.id,
    sequence: attempt.sequence,
    producerActivityId: "activity-spec-gate",
    artifactId: "gate.result.7",
    fingerprint: "revision-7",
  });
  return new GateTransitionFacts({
    phase,
    scope,
    currentAttempt: attempt,
    producer: {
      runId: "run-7",
      specId: "007-gate-transition",
      activityId: "activity-spec-gate",
      phase,
      scope,
      taskId,
      stepId,
    },
    target: {
      runId: "run-7",
      specId: "007-gate-transition",
      taskId,
      stepId,
      attempt,
    },
    catalogPublication: publication,
    result: "pass",
    retry: new GateRetryMetrics({ used: 0, maximum: 2 }),
    lineage: new GateLineage({
      sourceAttempt: attempt,
      canonicalAttempt: attempt,
      sourceFingerprint: "revision-7",
      canonicalFingerprint: "revision-7",
    }),
    recoveryEvidence: new GateRecoveryEvidence(),
    ...overrides,
  });
}

function reload(value) {
  return GateTransitionFacts.fromPersisted(value);
}

describe("definition-owned Gate transition boundary", () => {
  it("represents every Gate phase with persisted typed facts", () => {
    for (const phase of phases) {
      const decision = resolveGateTransition(facts({ phase }));
      assert.equal(decision.facts.phase, phase);
      assert.equal(decision.disposition.operation, "pass");
      assert.equal(decision.advance.operation, "advance");
      assert.equal(decision.facts.producer instanceof GateProducerOwnership, true);
      assert.equal(decision.facts.target instanceof GateTargetBinding, true);
    }
  });

  it("is deterministic after persisted fact reload", () => {
    const original = facts({
      result: "fail",
      failure: new GateFailureCategory({ category: "semantic", code: "REJECTED" }),
      retry: new GateRetryMetrics({ used: 1, maximum: 2 }),
    });
    const stored = JSON.parse(JSON.stringify(original.toJSON()));
    assert.deepEqual(resolveGateTransition(reload(stored)).toJSON(), resolveGateTransition(original).toJSON());
  });

  it("separates semantic retry from tooling failure", () => {
    const semantic = resolveGateTransition(facts({
      result: "fail",
      failure: new GateFailureCategory({ category: "semantic" }),
      retry: new GateRetryMetrics({ used: 0, maximum: 1 }),
    }));
    const tooling = resolveGateTransition(facts({
      result: "fail",
      failure: new GateFailureCategory({ category: "tooling", code: "PROTOCOL" }),
      retry: new GateRetryMetrics({ used: 0, maximum: 1 }),
    }));
    assert.equal(semantic.disposition.operation, "retry");
    assert.equal(semantic.plan.incrementRetry, true);
    assert.equal(tooling.disposition.operation, "external-blocked");
    assert.equal(tooling.plan.incrementRetry, false);
  });

  it("selects repair, defer, and blocked only after retry exhaustion", () => {
    const exhausted = { result: "fail", failure: new GateFailureCategory({ category: "semantic" }), retry: new GateRetryMetrics({ used: 2, maximum: 2 }) };
    const binding = { attempt: { id: "attempt-7", sequence: 7 }, fingerprint: "revision-7" };
    assert.equal(resolveGateTransition(facts({ ...exhausted, recoveryEvidence: new GateRecoveryEvidence({ kind: "repair", ...binding }) })).disposition.operation, "repair");
    assert.equal(resolveGateTransition(facts({ ...exhausted, recoveryEvidence: new GateRecoveryEvidence({ kind: "defer", ...binding }) })).disposition.operation, "defer");
    assert.equal(resolveGateTransition(facts(exhausted)).disposition.operation, "blocked");
  });

  it("represents recovery separately from pass and advance", () => {
    const binding = { attempt: { id: "attempt-7", sequence: 7 }, fingerprint: "revision-7" };
    const decision = resolveGateTransition(facts({
      result: "recovered",
      recoveryEvidence: new GateRecoveryEvidence({ kind: "recovered", ...binding }),
    }));
    assert.equal(decision.disposition.operation, "recovery");
    assert.equal(decision.advance, null);
  });

  it("fails closed for stale attempt and lineage evidence", () => {
    const current = new GateAttemptIdentity({ id: "attempt-8", sequence: 8 });
    const stalePublication = new GateCatalogPublication({
      attemptId: "attempt-7",
      sequence: 7,
      producerActivityId: "activity-spec-gate",
      artifactId: "gate.result.7",
      fingerprint: "revision-7",
    });
    const catalogMismatch = resolveGateTransition(facts({ currentAttempt: current, catalogPublication: stalePublication }));
    assert.equal(catalogMismatch.disposition.operation, "blocked");
    assert.equal(catalogMismatch.disposition.reason, "attempt_catalog_mismatch");

    const staleLineage = resolveGateTransition(facts({
      lineage: new GateLineage({
        sourceAttempt: new GateAttemptIdentity({ id: "attempt-6", sequence: 6 }),
        canonicalAttempt: new GateAttemptIdentity({ id: "attempt-7", sequence: 7 }),
        sourceFingerprint: "revision-6", canonicalFingerprint: "revision-7",
      }),
    }));
    assert.equal(staleLineage.disposition.operation, "blocked");
    assert.equal(staleLineage.disposition.reason, "source_canonical_lineage_mismatch");

    const staleRevisionBinding = resolveGateTransition(facts({
      lineage: new GateLineage({
        sourceAttempt: new GateAttemptIdentity({ id: "attempt-7", sequence: 7 }),
        canonicalAttempt: new GateAttemptIdentity({ id: "attempt-7", sequence: 7 }),
        sourceFingerprint: "source-hash",
        canonicalFingerprint: "revision-7",
        sourceRevisionFingerprint: "revision-7",
        canonicalRevisionFingerprint: "revision-6",
      }),
    }));
    assert.equal(staleRevisionBinding.disposition.reason, "source_canonical_lineage_mismatch");

    const staleTarget = resolveGateTransition(facts({
      target: {
        runId: "old-run",
        specId: "007-gate-transition",
        stepId: "spec-gate",
        attempt: { id: "attempt-7", sequence: 7 },
      },
    }));
    assert.equal(staleTarget.disposition.reason, "target_binding_mismatch");

    const staleCatalogFingerprint = resolveGateTransition(facts({
      catalogPublication: {
        attemptId: "attempt-7",
        sequence: 7,
        producerActivityId: "activity-spec-gate",
        artifactId: "gate.result.7",
        fingerprint: "old-revision",
      },
    }));
    assert.equal(staleCatalogFingerprint.disposition.reason, "catalog_lineage_mismatch");
  });

  it("rejects incomplete retry, recovery, ownership, and target facts at the boundary", () => {
    assert.throws(() => new GateRetryMetrics({ used: 0 }), /positive integer/);
    assert.throws(() => facts({ result: "recovered" }), /matching recovery evidence/);
    assert.throws(() => facts({
      producer: {
        runId: "run-7",
        specId: "007-gate-transition",
        activityId: "activity-spec-gate",
        phase: "task-impl",
        scope: "task",
        stepId: "T-1-gate",
      },
      phase: "task-impl",
      scope: "task",
    }), /taskId binding/);
    assert.equal(resolveGateTransition(facts({ phase: "task-impl", scope: "flow" })).disposition.reason, "phase_scope_mismatch");
    assert.equal(resolveGateTransition(facts({ phase: "integration", scope: "task" })).disposition.reason, "phase_scope_mismatch");
  });

  it("applies only the decision plan and rejects a bypassed or stale decision", () => {
    const decision = resolveGateTransition(facts({
      result: "fail", failure: new GateFailureCategory({ category: "semantic" }),
      retry: new GateRetryMetrics({ used: 0, maximum: 1 }),
    }));
    const calls = [];
    applyGateTransitionDecision({
      applyStepUpdate(update, selected) { calls.push([update, selected]); },
      incrementRetry(phase, selected) { calls.push([phase, selected]); },
    }, decision);
    assert.equal(calls[0][0] instanceof GateStepUpdate, true);
    assert.equal(calls[0][0].status, "in_progress");
    assert.equal(calls[1][0], "spec");
    assert.equal(admitGateTransition({ facts: decision.facts, decision }).disposition.operation, "retry");
    const projection = projectGateTransitionDecision(decision);
    assert.equal(projection instanceof GateTransitionActionProjection, true);
    assert.deepEqual(projection.toJSON(), {
      phase: "spec",
      scope: "flow",
      stepId: "spec-gate",
      operation: "retry",
      reason: null,
      advance: false,
    });

    const changed = facts({
      result: "fail", failure: new GateFailureCategory({ category: "semantic" }),
      retry: new GateRetryMetrics({ used: 1, maximum: 1 }),
    });
    assert.throws(() => admitGateTransition({ facts: changed, decision }), /admission rejected/);
    assert.throws(() => applyGateTransitionDecision({}, decision), /applyStepUpdate/);
    assert.throws(() => new GateTransitionDecision({}), /created only by definition/);
  });

  it("keeps decision construction and policy branches out of consumers", () => {
    const definition = readFileSync(new URL("../../../src/flow/definition.js", import.meta.url), "utf8");
    const factsBoundary = readFileSync(new URL("../../../src/flow/lib/gate-transition.js", import.meta.url), "utf8");
    const application = readFileSync(new URL("../../../src/flow/lib/gate-transition-application.js", import.meta.url), "utf8");
    const legacyConsumers = [
      "../../../src/flow/lib/run-gate.js",
      "../../../src/flow/registry.js",
      "../../../src/flow/lib/get-next-action.js",
    ].map((relative) => readFileSync(new URL(relative, import.meta.url), "utf8"));

    assert.match(definition, /export function resolveGateTransition\(facts\)/);
    assert.doesNotMatch(factsBoundary, /resolveGateTransition|GateTransitionDecision|GateStepUpdatePlan/);
    assert.doesNotMatch(application, /facts\.(?:result|failure|retry|recoveryEvidence)/);
    for (const source of legacyConsumers) {
      assert.doesNotMatch(source, /new Gate(?:TransitionDecision|StepUpdatePlan|TransitionDisposition)/);
    }
  });
});
