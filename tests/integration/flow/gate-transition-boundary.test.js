import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GateTransitionFacts,
  GateAttemptIdentity,
  GateCatalogPublication,
  GateLineage,
  GateRecoveryEvidence,
  GateReviewFindingReadiness,
  GateRetryMetrics,
  GateFailureCategory,
  GateProducerOwnership,
  GateTargetBinding,
  GateTransitionDecision,
  GateStepUpdate,
  buildCurrentFlowDefinition,
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
    reviewReadiness: phase === "integration"
      ? new GateReviewFindingReadiness({
        status: "ready", findingFingerprints: [], reviewFingerprints: ["impl-review-7"],
        decisionFingerprint: "review-decision-7",
      })
      : null,
    taskLifecycle: scope === "task"
      ? { taskId, nextTaskId: null, integrationStepId: "test-execute" }
      : null,
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
    assert.equal(GateFailureCategory.fromObservedGateResult({
      result: "fail",
      artifacts: { failureKind: "mechanical" },
    }).category, "tooling");
  });

  it("makes every integration outcome and handoff a Definition plan", () => {
    const semantic = resolveGateTransition(facts({
      phase: "integration", result: "fail",
      failure: new GateFailureCategory({ category: "semantic", code: "GATE_REJECTED" }),
      retry: new GateRetryMetrics({ used: 0, maximum: 2 }),
    }));
    const tooling = resolveGateTransition(facts({
      phase: "integration", result: "fail",
      failure: new GateFailureCategory({ category: "tooling", code: "PROTOCOL" }),
      retry: new GateRetryMetrics({ used: 0, maximum: 2 }),
    }));
    const exhausted = resolveGateTransition(facts({
      phase: "integration", result: "fail",
      failure: new GateFailureCategory({ category: "semantic", code: "GATE_REJECTED" }),
      retry: new GateRetryMetrics({ used: 2, maximum: 2 }),
    }));
    const nonblocking = resolveGateTransition(facts({
      phase: "integration", result: "fail", nonblocking: true,
      failure: new GateFailureCategory({ category: "semantic", code: "GATE_REJECTED" }),
      retry: new GateRetryMetrics({ used: 0, maximum: 2 }),
    }));
    const recovered = resolveGateTransition(facts({
      phase: "integration", result: "recovered",
      recoveryEvidence: new GateRecoveryEvidence({
        kind: "recovered", attempt: { id: "attempt-7", sequence: 7 }, fingerprint: "revision-7",
      }),
    }));

    assert.equal(resolveGateTransition(facts({ phase: "integration" })).plan.phaseDefinition.nextStepId, "retro");
    assert.equal(semantic.disposition.operation, "retry");
    assert.equal(semantic.plan.incrementRetry, true);
    assert.equal(tooling.disposition.operation, "external-blocked");
    assert.equal(tooling.plan.incrementRetry, false);
    assert.equal(exhausted.disposition.operation, "defer");
    assert.equal(nonblocking.disposition.operation, "nonblocking");
    assert.deepEqual(nonblocking.plan.nonblockingHandoff.toJSON(), {
      sourceStepId: "impl-gate", targetStepId: "retro",
    });
    assert.equal(recovered.disposition.operation, "recovery");
    assert.deepEqual(recovered.plan.recoveryEffect.toJSON(), {
      operation: "rewind-test-evidence", sourceStepId: "impl-gate", targetStepId: "test-execute",
    });
    for (const decision of [semantic, tooling, exhausted, nonblocking, recovered]) {
      const reloaded = resolveGateTransition(reload(JSON.parse(JSON.stringify(decision.facts.toJSON()))));
      assert.deepEqual(reloaded.plan.toJSON(), decision.plan.toJSON());
      assert.equal(reloaded.plan.action.identity.matches(decision.plan.action.identity), true);
    }
  });

  it("blocks a nominal integration PASS when typed review readiness retains a finding", () => {
    const blocked = resolveGateTransition(facts({
      phase: "integration",
      reviewReadiness: new GateReviewFindingReadiness({
        status: "blocking", findingFingerprints: ["finding-7"], reviewFingerprints: ["impl-review-7"],
        triageFingerprint: "triage-7", repairFingerprint: "repair-7", decisionFingerprint: "review-decision-7",
      }),
    }));
    assert.equal(blocked.disposition.operation, "blocked");
    assert.equal(blocked.disposition.reason, "unresolved_review_findings");
    const reloaded = resolveGateTransition(reload(JSON.parse(JSON.stringify(blocked.facts.toJSON()))));
    assert.deepEqual(reloaded.plan.toJSON(), blocked.plan.toJSON());
    assert.equal(reloaded.plan.action.identity.matches(blocked.plan.action.identity), true);
  });

  it("settles retry exhaustion before another repair or evaluation", () => {
    const exhausted = { result: "fail", failure: new GateFailureCategory({ category: "semantic" }), retry: new GateRetryMetrics({ used: 4, maximum: 4 }) };
    const binding = { attempt: { id: "attempt-7", sequence: 7 }, fingerprint: "revision-7" };
    const repairedExhausted = resolveGateTransition(facts({ ...exhausted, recoveryEvidence: new GateRecoveryEvidence({ kind: "repair", ...binding }) }));
    assert.equal(repairedExhausted.disposition.operation, "defer");
    assert.equal(resolveGateTransition(facts({ ...exhausted, recoveryEvidence: new GateRecoveryEvidence({ kind: "defer", ...binding }) })).disposition.operation, "defer");
    const deferred = resolveGateTransition(facts(exhausted));
    assert.equal(deferred.disposition.operation, "defer");
    assert.equal(deferred.plan.incrementRetry, false);
    assert.equal(deferred.plan.updates[0].status, "in_progress");
    assert.equal(resolveGateTransition(facts({
      result: "fail",
      failure: new GateFailureCategory({ category: "semantic" }),
      retry: new GateRetryMetrics({ used: 3, maximum: 4 }),
      recoveryEvidence: new GateRecoveryEvidence({ kind: "repair", ...binding }),
    })).disposition.operation, "repair");
  });

  it("uses persisted Attempt consumption: four retries permit a fifth failed evaluation, never a sixth", () => {
    const operations = [];
    for (let consumption = 0; consumption <= 4; consumption += 1) {
      const attempt = new GateAttemptIdentity({ id: `attempt-${consumption + 1}`, sequence: consumption + 1 });
      const decision = resolveGateTransition(facts({
        currentAttempt: attempt,
        catalogPublication: new GateCatalogPublication({
          attemptId: attempt.id, sequence: attempt.sequence, producerActivityId: "activity-spec-gate",
          artifactId: `gate.result.${attempt.sequence}`, fingerprint: `revision-${attempt.sequence}`,
        }),
        result: "fail", failure: new GateFailureCategory({ category: "semantic" }),
        retry: new GateRetryMetrics({ used: consumption, maximum: 4 }),
        lineage: new GateLineage({
          sourceAttempt: attempt, canonicalAttempt: attempt,
          sourceFingerprint: `revision-${attempt.sequence}`, canonicalFingerprint: `revision-${attempt.sequence}`,
        }),
      }));
      operations.push(decision.disposition.operation);
    }
    assert.deepEqual(operations, ["retry", "retry", "retry", "retry", "defer"]);
  });

  it("keeps PASS next steps in the phase definition and never grants approval to Draft", () => {
    const draft = resolveGateTransition(facts({ phase: "draft" }));
    const spec = resolveGateTransition(facts({ phase: "spec" }));
    assert.equal(draft.plan.phaseDefinition.nextStepId, "spec");
    assert.equal(spec.plan.phaseDefinition.nextStepId, "approval");
    for (const operation of ["retry", "repair", "defer", "external-blocked", "blocked"]) {
      const decision = resolveGateTransition(facts({
        phase: "draft", result: "fail", failure: new GateFailureCategory({ category: "semantic" }),
        retry: new GateRetryMetrics({ used: operation === "defer" ? 4 : 0, maximum: 4 }),
      }));
      if (decision.disposition.operation !== "pass") assert.notEqual(decision.advance?.operation, "advance");
    }
  });

  it("seals materialized Task lifecycle successors and repair resets into the Action plan", () => {
    const task = facts({
      phase: "task-impl",
      scope: "task",
      producer: {
        runId: "run-7", specId: "007-gate-transition", activityId: "activity-spec-gate",
        phase: "task-impl", scope: "task", taskId: "T-1", stepId: "T-1-gate",
      },
      target: { runId: "run-7", specId: "007-gate-transition", taskId: "T-1", stepId: "T-1-gate", attempt: { id: "attempt-7", sequence: 7 } },
      taskLifecycle: { taskId: "T-1", nextTaskId: "T-2", integrationStepId: "test-execute" },
    });
    const passed = resolveGateTransition(task);
    assert.equal(passed.plan.action.identity.taskId, "T-1");
    assert.deepEqual(passed.plan.taskLifecycle.toJSON(), {
      operation: "complete-and-advance", taskId: "T-1", successorStepId: "T-2-impl", resetStepIds: [],
    });
    const repair = resolveGateTransition(facts({
      ...task.toJSON(), result: "fail", failure: { category: "semantic", code: "GATE_REJECTED" },
      retry: { used: 0, maximum: 4 },
      recoveryEvidence: { kind: "repair", attempt: { id: "attempt-7", sequence: 7 }, fingerprint: "revision-7" },
    }));
    assert.deepEqual(repair.plan.taskLifecycle.toJSON(), {
      operation: "repair-task-impl", taskId: "T-1", successorStepId: "T-1-impl",
      resetStepIds: ["T-1-impl", "T-1-review", "T-1-gate"],
    });
    const finalTask = resolveGateTransition(facts({
      ...task.toJSON(), result: "fail", failure: { category: "semantic", code: "GATE_REJECTED" },
      retry: { used: 4, maximum: 4 },
      taskLifecycle: { taskId: "T-1", nextTaskId: null, integrationStepId: "test-execute" },
    }));
    assert.deepEqual(finalTask.plan.taskLifecycle.toJSON(), {
      operation: "defer-and-advance", taskId: "T-1", successorStepId: "test-execute", resetStepIds: [],
    });
  });

  it("keeps task-spec on the approval route and out of materialized Task Steps", () => {
    const decision = resolveGateTransition(facts({ phase: "task-spec", result: "pass" }));
    assert.equal(decision.plan.phaseDefinition.nextStepId, "approval");
    const definition = buildCurrentFlowDefinition();
    assert.deepEqual(definition.taskTemplate.steps.map((step) => step.id), ["task-impl", "task-review", "task-gate"]);
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

    const taskStepMismatch = resolveGateTransition(facts({
      phase: "task-impl",
      scope: "task",
      producer: {
        runId: "run-7", specId: "007-gate-transition", activityId: "activity-task-gate",
        phase: "task-impl", scope: "task", taskId: "T-1", stepId: "T-2-gate",
      },
      target: {
        runId: "run-7", specId: "007-gate-transition", taskId: "T-1", stepId: "T-2-gate",
        attempt: { id: "attempt-7", sequence: 7 },
      },
      taskLifecycle: { taskId: "T-1", nextTaskId: "T-2", integrationStepId: "test-execute" },
    }));
    assert.equal(taskStepMismatch.disposition.operation, "blocked");
    assert.equal(taskStepMismatch.disposition.reason, "task_step_identity_mismatch");
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
      actionId: decision.plan.action.identity.toJSON(),
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
    const gateRunner = legacyConsumers[0];
    assert.doesNotMatch(gateRunner, /"task-spec": "task-impl"/);
    assert.doesNotMatch(gateRunner, /"task-impl": "complete-task"|"task-impl": "implement"/);
    assert.doesNotMatch(gateRunner, /(?:PASS|FAIL)_(?:NEXT|PRESCRIPTION)/);
    assert.doesNotMatch(gateRunner, /"integration": "(?:retro|implement)"/);
    assert.doesNotMatch(gateRunner, /recoverFromCurrentAuthority/);
  });

  it("keeps Action identity deterministic across reload and all dispositions", () => {
    const cases = [
      facts(),
      facts({ result: "fail", failure: new GateFailureCategory({ category: "semantic" }), retry: new GateRetryMetrics({ used: 3, maximum: 4 }) }),
      facts({ result: "fail", failure: new GateFailureCategory({ category: "semantic" }), retry: new GateRetryMetrics({ used: 4, maximum: 4 }) }),
      facts({ result: "fail", failure: new GateFailureCategory({ category: "tooling", code: "PROTOCOL" }), retry: new GateRetryMetrics({ used: 0, maximum: 4 }) }),
      facts({ result: "recovered", recoveryEvidence: new GateRecoveryEvidence({ kind: "recovered", attempt: { id: "attempt-7", sequence: 7 }, fingerprint: "revision-7" }) }),
    ];
    for (const input of cases) {
      const original = resolveGateTransition(input);
      const reloaded = resolveGateTransition(reload(JSON.parse(JSON.stringify(input.toJSON()))));
      assert.equal(original.plan.action.identity.matches(reloaded.plan.action.identity), true);
      assert.equal(original.plan.action.identity.operation, original.disposition.operation);
    }
  });
});
