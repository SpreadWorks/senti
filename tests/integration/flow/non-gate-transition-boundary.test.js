import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { FlowManager } from "../../../src/lib/flow-manager.js";
import { CanonicalFlowCreateRequest } from "../../../src/flow/lib/canonical-flow-manager-store.js";
import { CurrentFlowSpecRecord, CurrentFlowState } from "../../../src/flow/lib/current-flow-state.js";
import { emptySpecStub } from "../../../src/lib/spec-json.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

import {
  NonGateAttemptIdentity,
  NonGateCatalogPublication,
  NonGateCompletionFacts,
  NonGateLineage,
  NonGateProducerOwnership,
  NonGateRecoveryEvidence,
  NonGateRetryMetrics,
  NonGateRepairPublication,
  NonGateSourcePublication,
  NonGateStepAction,
  NonGateStepDefinition,
  NonGateStepFacts,
  NonGateTargetBinding,
  NonGateTransitionFacts,
  NonGateTransitionSelection,
  resolveNonGateTransition,
} from "../../../src/flow/definition.js";
import {
  admitNonGateDirectCommand,
  executeAdmittedNonGateCommand,
  applyNonGateTransitionDecision,
  projectNonGateTransitionDecision,
  resolveNonGateNextAction,
} from "../../../src/flow/lib/non-gate-transition-application.js";
import { readCurrentNonGateTransitionFacts } from "../../../src/flow/lib/non-gate-transition-facts.js";

const fixtureRoots = [];

afterEach(() => {
  for (const directory of fixtureRoots.splice(0)) removeTmpDir(directory);
});

class FixtureStepFacts extends NonGateStepFacts {
  constructor({ state } = {}) {
    super({ kind: "fixture-step", values: { state } });
  }

  get state() { return this.value("state"); }

  toJSON() { return { kind: this.kind, values: { state: this.state } }; }
}

class FixtureIssueLogAction extends NonGateStepAction {
  constructor({ summary } = {}) {
    super();
    this.summary = summary;
    Object.freeze(this);
  }

  apply(adapter, plan) { return adapter.appendIssueLog(this.summary, plan); }
  toJSON() { return { summary: this.summary }; }
}

const selections = Object.freeze({
  passed: "advance",
  pending: "keep-in-progress",
  question: "await-user-input",
  retryable: "retry",
  repairable: "repair",
  recorded: "record-and-proceed",
  external: "external-blocked",
  blocked: "blocked",
  parked: "park",
  recovered: "repair",
});

const definition = new NonGateStepDefinition({
  stepId: "fixture-step",
  factsType: FixtureStepFacts,
  select(stepFacts, facts) {
    const operation = facts.nonblocking && stepFacts.state === "external"
      ? "record-and-proceed"
      : selections[stepFacts.state];
    if (operation === undefined) throw new Error("unknown fixture state");
    if (stepFacts.state === "recovered" && facts.recoveryEvidence.kind !== "repair") {
      throw new Error("fixture recovery needs canonical recovery evidence");
    }
    return new NonGateTransitionSelection({
      operation,
      reason: stepFacts.state === "external" ? "provider_unavailable" : null,
      actions: stepFacts.state === "repairable"
        ? [new FixtureIssueLogAction({ summary: "repair selected" })]
        : [],
    });
  },
});

function facts(overrides = {}) {
  const attempt = overrides.currentAttempt ?? new NonGateAttemptIdentity({ id: "attempt-9", sequence: 9 });
  const fingerprint = "f".repeat(64);
  return new NonGateTransitionFacts({
    runId: "run-9",
    specId: "009-non-gate-transition",
    stepId: "fixture-step",
    snapshotRevision: "state-revision-9",
    producer: new NonGateProducerOwnership({
      runId: "run-9", specId: "009-non-gate-transition", activityId: "activity-9", stepId: "fixture-step", attempt,
    }),
    target: new NonGateTargetBinding({
      runId: "run-9", specId: "009-non-gate-transition", stepId: "fixture-step", attempt,
    }),
    currentAttempt: attempt,
    catalogPublication: new NonGateCatalogPublication({
      runId: "run-9", specId: "009-non-gate-transition", stepId: "fixture-step",
      attemptId: attempt.id,
      sequence: attempt.sequence,
      producerActivityId: "activity-9",
      artifactId: "fixture.result.9",
      fingerprint,
    }),
    sourcePublication: new NonGateSourcePublication({
      runId: "run-9", specId: "009-non-gate-transition", stepId: "fixture-step",
      attemptId: attempt.id, sequence: attempt.sequence, producerActivityId: "activity-9", artifactId: "fixture.result.9", fingerprint,
    }),
    lineage: new NonGateLineage({
      sourceAttempt: attempt,
      canonicalAttempt: attempt,
      sourceFingerprint: fingerprint,
      canonicalFingerprint: fingerprint,
    }),
    retry: new NonGateRetryMetrics({ used: 0, maximum: 2 }),
    completion: new NonGateCompletionFacts({ completed: overrides.completed ?? false }),
    recoveryEvidence: new NonGateRecoveryEvidence(overrides.recoveryEvidence),
    nonblocking: overrides.nonblocking ?? false,
    stepFacts: overrides.stepFacts ?? new FixtureStepFacts({ state: "pending" }),
    ...overrides,
  });
}

function reloaded(value) {
  return NonGateTransitionFacts.fromPersisted(value, {
    stepFacts: (stored) => new FixtureStepFacts({ state: stored.values.state }),
  });
}

function flowManagerFor(source) {
  return {
    readCanonicalTransitionSnapshot() {
      return Object.freeze({
        runId: source.runId, specId: source.specId, stepId: source.stepId, revision: source.snapshotRevision,
        state: Object.freeze({ runId: source.runId, specId: source.specId }),
        attempt: { id: source.currentAttempt.id, sequence: source.currentAttempt.sequence },
        activities: [{ id: "activity-9", attemptId: "attempt-9", sequence: 9, nodeId: "fixture-step" }],
        catalog: [{ relativePath: "fixture.result.9", hash: "f".repeat(64), activityId: "activity-9" }],
      });
    },
  };
}

describe("definition-owned non-Gate transition boundary", () => {
  it("reloads typed state, revision, Activity prefix, and catalog from one persisted Version snapshot", () => {
    const repository = createTmpDir("non-gate-transition-snapshot-");
    fixtureRoots.push(repository);
    const specId = "009-non-gate-transition-snapshot";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    manager.createFresh(new CanonicalFlowCreateRequest({
      specId,
      runId: "run-non-gate-transition-snapshot",
      request: "Build a persisted transition snapshot fixture.",
      execution: { mode: "direct" },
      policy: { autoApprove: false, nonblocking: null },
      flowId: "flow-non-gate-transition-snapshot",
      flowVersionId: "flow-non-gate-transition-snapshot-v1",
      specRecord: new CurrentFlowSpecRecord({ ...emptySpecStub(), tasks: [] }, { specId }),
    }));
    const first = manager.canonicalState(specId).nextAction();
    manager.updateStepStatus({ stepId: first.nodeId, requestedStatus: "in_progress" }, { specId });

    const reloaded = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const snapshot = reloaded.readCanonicalTransitionSnapshot(specId);
    assert.ok(snapshot.state instanceof CurrentFlowState);
    assert.equal(snapshot.stepId, first.nodeId);
    assert.equal(snapshot.attempt.id, snapshot.state.attempt.id);
    assert.equal(snapshot.revision.length, 64);
    assert.ok(snapshot.activities.length >= 2);
    assert.ok(snapshot.catalog.some((entry) => entry.relativePath === "flow.json"));
    assert.deepEqual(snapshot.toJSON().state, snapshot.state.toJSON());
  });

  it("lets a Step-specific Definition select every supported disposition", () => {
    const expected = [
      ["passed", "advance", { completed: true }],
      ["pending", "keep-in-progress"],
      ["question", "await-user-input"],
      ["retryable", "retry"],
      ["repairable", "repair"],
      ["recorded", "record-and-proceed"],
      ["external", "external-blocked"],
      ["blocked", "blocked"],
      ["parked", "park"],
    ];
    for (const [state, operation, options = {}] of expected) {
      const decision = resolveNonGateTransition(facts({
        ...options,
        stepFacts: new FixtureStepFacts({ state }),
      }), definition);
      assert.equal(decision.disposition.operation, operation);
      assert.equal(decision.plan.action.identity.operation, operation);
    }
  });

  it("fails closed for stale Attempts, catalog publication, lineage, and partial completion", () => {
    const current = new NonGateAttemptIdentity({ id: "attempt-9", sequence: 9 });
    const stale = new NonGateAttemptIdentity({ id: "attempt-8", sequence: 8 });
    assert.equal(resolveNonGateTransition(facts({ currentAttempt: current, catalogPublication: new NonGateCatalogPublication({
      runId: "run-9", specId: "009-non-gate-transition", stepId: "fixture-step",
      attemptId: stale.id, sequence: stale.sequence, producerActivityId: "activity-9", artifactId: "fixture.result.9", fingerprint: "f".repeat(64),
    }) }), definition).disposition.reason, "attempt_catalog_mismatch");
    assert.equal(resolveNonGateTransition(facts({ lineage: new NonGateLineage({
      sourceAttempt: stale, canonicalAttempt: current, sourceFingerprint: "f".repeat(64), canonicalFingerprint: "f".repeat(64),
    }) }), definition).disposition.reason, "source_attempt_lineage_mismatch");
    assert.equal(resolveNonGateTransition(facts({
      completion: new NonGateCompletionFacts({ partial: true }),
    }), definition).disposition.reason, "partial_completion");
    const pairedRevision = resolveNonGateTransition(facts({ lineage: new NonGateLineage({
      sourceAttempt: current,
      canonicalAttempt: current,
      sourceFingerprint: "a".repeat(64),
      canonicalFingerprint: "f".repeat(64),
      sourceRevisionFingerprint: "revision-9",
      canonicalRevisionFingerprint: "revision-9",
      repairAttempt: current,
      repairFingerprint: "b".repeat(64),
      repairRevisionFingerprint: "revision-9",
    }), sourcePublication: new NonGateSourcePublication({
      runId: "run-9", specId: "009-non-gate-transition", stepId: "fixture-step",
      attemptId: current.id, sequence: current.sequence, producerActivityId: "activity-9", artifactId: "fixture.source.9", fingerprint: "a".repeat(64),
    }), repairPublication: new NonGateRepairPublication({
      runId: "run-9", specId: "009-non-gate-transition", stepId: "fixture-step",
      attemptId: current.id, sequence: current.sequence, producerActivityId: "activity-9", artifactId: "fixture.repair.9", fingerprint: "b".repeat(64),
    }) }), definition);
    assert.equal(pairedRevision.disposition.operation, "keep-in-progress");
  });

  it("makes nonblocking and recovery facts available only to the Step Definition", () => {
    const nonblocking = resolveNonGateTransition(facts({
      nonblocking: true,
      stepFacts: new FixtureStepFacts({ state: "external" }),
    }), definition);
    assert.equal(nonblocking.disposition.operation, "record-and-proceed");
    const recovery = resolveNonGateTransition(facts({
      stepFacts: new FixtureStepFacts({ state: "recovered" }),
      recoveryEvidence: { kind: "repair", attempt: { id: "attempt-9", sequence: 9 }, fingerprint: "f".repeat(64) },
    }), definition);
    assert.equal(recovery.disposition.operation, "repair");
  });

  it("is deterministic after the same persisted fixture is reloaded, including Action identity", () => {
    const original = facts({
      completed: true,
      stepFacts: new FixtureStepFacts({ state: "passed" }),
    });
    const stored = JSON.parse(JSON.stringify(original.toJSON()));
    const first = resolveNonGateTransition(original, definition);
    const second = resolveNonGateTransition(reloaded(stored), definition);
    assert.deepEqual(second.toJSON(), first.toJSON());
    assert.deepEqual(projectNonGateTransitionDecision(second).toJSON(), projectNonGateTransitionDecision(first).toJSON());
  });

  it("binds Action identity to all persisted common and Step facts", () => {
    const base = resolveNonGateTransition(facts(), definition).plan.action.identity;
    const changed = [
      facts({ nonblocking: true }),
      facts({ retry: new NonGateRetryMetrics({ used: 1, maximum: 2 }) }),
      facts({ completion: new NonGateCompletionFacts({ completed: true }) }),
      facts({ stepFacts: new FixtureStepFacts({ state: "question" }) }),
    ];
    for (const changedFacts of changed) {
      const identity = resolveNonGateTransition(changedFacts, definition).plan.action.identity;
      assert.equal(base.matches(identity), false);
    }
  });

  it("binds Action identity to Definition reason and every typed Step action", () => {
    const definitionFor = ({ reason, summary }) => new NonGateStepDefinition({
      stepId: "fixture-step",
      factsType: FixtureStepFacts,
      select: () => new NonGateTransitionSelection({
        operation: "blocked",
        reason,
        actions: [new FixtureIssueLogAction({ summary })],
      }),
    });
    const input = facts({ stepFacts: new FixtureStepFacts({ state: "blocked" }) });
    const first = resolveNonGateTransition(input, definitionFor({ reason: "first", summary: "same" })).plan.action.identity;
    const changedReason = resolveNonGateTransition(input, definitionFor({ reason: "second", summary: "same" })).plan.action.identity;
    const changedAction = resolveNonGateTransition(input, definitionFor({ reason: "first", summary: "changed" })).plan.action.identity;
    assert.equal(first.matches(changedReason), false);
    assert.equal(first.matches(changedAction), false);
  });

  it("rejects a direct run/set command before any side effect when the current Action changed", () => {
    const selected = projectNonGateTransitionDecision(resolveNonGateTransition(facts({
      stepFacts: new FixtureStepFacts({ state: "pending" }),
    }), definition));
    let reads = 0;
    let workerStarts = 0;
    assert.throws(() => admitNonGateDirectCommand({
      selectedAction: selected,
      stepDefinition: definition,
      flowManager: flowManagerFor(facts()),
      specId: "009-non-gate-transition",
      readStepFacts() {
        reads += 1;
        return facts({ completed: true, stepFacts: new FixtureStepFacts({ state: "passed" }) });
      },
    }), /admission rejected/);
    assert.equal(reads, 1);
    assert.equal(workerStarts, 0);
    assert.throws(() => executeAdmittedNonGateCommand({
      selectedAction: selected, stepDefinition: definition, flowManager: flowManagerFor(facts()), specId: "009-non-gate-transition",
      readStepFacts: () => facts({ completed: true, stepFacts: new FixtureStepFacts({ state: "passed" }) }),
      execute() { workerStarts += 1; },
    }), /admission rejected/);
    assert.equal(workerStarts, 0);
    assert.throws(() => applyNonGateTransitionDecision({ applyStepUpdate() {} }, {}), /definition decision/);
  });

  it("applies only the typed actions contained in the Definition plan", () => {
    const decision = resolveNonGateTransition(facts({
      stepFacts: new FixtureStepFacts({ state: "retryable" }),
    }), definition);
    const applied = [];
    applyNonGateTransitionDecision({
      setStepStatus(update, plan) { applied.push(["set-step-status", update.status, plan.action.identity.operation]); },
      incrementRetry(stepId, plan) { applied.push(["increment-retry", stepId, plan.action.identity.operation]); },
    }, decision);
    assert.deepEqual(applied, [
      ["set-step-status", "in_progress", "retry"],
      ["increment-retry", "fixture-step", "retry"],
    ]);
    assert.throws(() => applyNonGateTransitionDecision({ applyEffect() {} }, { plan: decision.plan }), /definition decision/);

    const repair = resolveNonGateTransition(facts({
      stepFacts: new FixtureStepFacts({ state: "repairable" }),
    }), definition);
    applyNonGateTransitionDecision({
      setStepStatus() {},
      appendIssueLog(summary) { applied.push(["append-issue-log", summary, repair.plan.action.identity.operation]); },
    }, repair);
    assert.deepEqual(applied.at(-1), ["append-issue-log", "repair selected", "repair"]);
  });

  it("validates source and repair publications against their own persisted Activity and catalog entries", () => {
    const current = new NonGateAttemptIdentity({ id: "attempt-9", sequence: 9 });
    const upstream = new NonGateAttemptIdentity({ id: "attempt-4", sequence: 4 });
    const repair = new NonGateAttemptIdentity({ id: "attempt-6", sequence: 6 });
    const source = facts({
      currentAttempt: current,
      sourcePublication: new NonGateSourcePublication({
        runId: "run-9", specId: "009-non-gate-transition", stepId: "test-execute",
        attemptId: upstream.id, sequence: upstream.sequence, producerActivityId: "activity-source",
        artifactId: "test.execute.json", fingerprint: "a".repeat(64),
      }),
      repairPublication: new NonGateRepairPublication({
        runId: "run-9", specId: "009-non-gate-transition", stepId: "test-repair",
        attemptId: repair.id, sequence: repair.sequence, producerActivityId: "activity-repair",
        artifactId: "test.repair.json", fingerprint: "b".repeat(64),
      }),
      lineage: new NonGateLineage({
        sourceAttempt: upstream,
        canonicalAttempt: current,
        sourceFingerprint: "a".repeat(64),
        canonicalFingerprint: "f".repeat(64),
        sourceRevisionFingerprint: "revision-9",
        canonicalRevisionFingerprint: "revision-9",
        repairAttempt: repair,
        repairFingerprint: "b".repeat(64),
        repairRevisionFingerprint: "revision-9",
      }),
    });
    const snapshot = {
      runId: source.runId, specId: source.specId, stepId: source.stepId, revision: source.snapshotRevision,
      state: Object.freeze({ runId: source.runId, specId: source.specId }),
      attempt: { id: current.id, sequence: current.sequence },
      activities: [
        { id: "activity-9", attemptId: current.id, sequence: current.sequence, nodeId: "fixture-step" },
        { id: "activity-source", attemptId: upstream.id, sequence: upstream.sequence, nodeId: "test-execute" },
        { id: "activity-repair", attemptId: repair.id, sequence: repair.sequence, nodeId: "test-repair" },
      ],
      catalog: [
        { relativePath: "fixture.result.9", hash: "f".repeat(64), activityId: "activity-9" },
        { relativePath: "test.execute.json", hash: "a".repeat(64), activityId: "activity-source" },
        { relativePath: "test.repair.json", hash: "b".repeat(64), activityId: "activity-repair" },
      ],
    };
    const manager = { readCanonicalTransitionSnapshot: () => Object.freeze(snapshot) };
    assert.equal(readCurrentNonGateTransitionFacts({
      flowManager: manager, specId: source.specId, readFacts: () => source,
    }), source);
    const withoutSource = {
      ...snapshot,
      catalog: snapshot.catalog.filter((entry) => entry.relativePath !== "test.execute.json"),
    };
    assert.throws(() => readCurrentNonGateTransitionFacts({
      flowManager: { readCanonicalTransitionSnapshot: () => Object.freeze(withoutSource) },
      specId: source.specId,
      readFacts: () => source,
    }), /source publication does not match/);
    const wrongRepairActivity = {
      ...snapshot,
      activities: snapshot.activities.map((entry) => entry.id === "activity-repair"
        ? { ...entry, attemptId: "wrong-attempt" }
        : entry),
    };
    assert.throws(() => readCurrentNonGateTransitionFacts({
      flowManager: { readCanonicalTransitionSnapshot: () => Object.freeze(wrongRepairActivity) },
      specId: source.specId,
      readFacts: () => source,
    }), /repair publication is not owned/);
  });

  it("uses a freshly reloaded canonical snapshot before Step facts reach Definition", () => {
    const source = facts();
    const flowManager = flowManagerFor(source);
    const read = readCurrentNonGateTransitionFacts({ flowManager, specId: source.specId, readFacts: () => source });
    const projected = resolveNonGateNextAction({
      flowManager, specId: source.specId, readStepFacts: () => read, stepDefinition: definition,
    });
    assert.equal(projected.action.operation, "keep-in-progress");
    assert.throws(() => readCurrentNonGateTransitionFacts({
      flowManager,
      specId: source.specId,
      readFacts: () => facts({ currentAttempt: new NonGateAttemptIdentity({ id: "old-attempt", sequence: 8 }) }),
    }), /stale Attempt/);
  });
});
