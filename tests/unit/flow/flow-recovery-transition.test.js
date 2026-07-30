import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { RepositoryFlowOperationLock } from "../../../src/lib/repository-maintenance-lock.js";
import {
  FlowRecoveryTransition,
  RecoveryDeliveryDeferred,
  RecoveryDeliveryDone,
  RecoveryInputVerifier,
  RecoveryIssueLogDelivery,
  RecoveryTransitionError,
  RecoveryTransitionPlan,
} from "../../../src/flow/lib/flow-recovery-transition.js";
import {
  RecoveryFailureLedger,
  RecoveryFailureRecordStore,
  RecoveryInputArtifact,
  RecoveryInputFingerprint,
  RecoveryValidationInput,
  RecoveryValidatorFailure,
  RecoveryValidatorRegistry,
  resolveCurrentRecoveryPolicy,
} from "../../../src/flow/lib/recovery-contract.js";
import { UpgradeEvidenceRecoveryValidator } from "../../../src/flow/lib/upgrade-evidence-recovery-validator.js";
import { FlowOutbox } from "../../../src/flow/lib/flow-outbox.js";
import { IssueLogStore } from "../../../src/flow/lib/issue-log-store.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { makeFlowManager, setupFlowAtStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let tmp = null;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function digestFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function readState(fixture) {
  return fixture.manager.loadReadOnly(fixture.specId);
}

function persistedState(fixture) {
  return fs.readFileSync(path.join(tmp, "specs", fixture.specId, "flow.json"), "utf8");
}

class MutableInputVerifier extends RecoveryInputVerifier {
  constructor(input) {
    super();
    this.input = input;
  }

  readCurrent() { return this.input; }
}

function createInput({ specId, runId, issue, digest = null }) {
  const flowPath = path.join(tmp, "specs", specId, "flow.json");
  return new RecoveryValidationInput({
    target: {
      runId,
      issue,
      spec: `specs/${specId}/spec.json`,
      stepId: "impl-gate",
      attemptId: "impl-gate-attempt-001",
    },
    inputFingerprint: new RecoveryInputFingerprint({
      artifacts: [new RecoveryInputArtifact({
        artifactPath: `specs/${specId}/flow.json`,
        digest: digest || digestFile(flowPath),
        authority: "flow.json/current-revision",
      })],
    }),
  });
}

function buildFixture({ verifier = null, expectedRegistryRevision = undefined } = {}) {
  tmp = createTmpDir("flow-recovery-transition-");
  const specId = "recovery-transition";
  const runId = "run-recovery-transition";
  const issue = 656;
  setupFlowAtStep(tmp, "impl-gate", {
    spec: `specs/${specId}/spec.json`,
    runId,
    issue,
  });
  const manager = makeFlowManager(tmp);
  const input = createInput({ specId, runId, issue });
  const validator = new UpgradeEvidenceRecoveryValidator({
    root: tmp,
    specDir: `specs/${specId}`,
    baseBranch: "main",
    currentRequiredPaths: ["src/skills/recovery/SKILL.md"],
    currentFingerprint: null,
    target: null,
    authority: "upgrade-evidence/current-authority",
  });
  const validation = validator.validate(input);
  assert.ok(validation instanceof RecoveryValidatorFailure);
  const record = validator.recordFailure(input, validation, "2026-07-30T03:00:00.000Z");
  new RecoveryFailureRecordStore(manager).record(record);
  const state = manager.loadReadOnly(specId);
  const resolution = resolveCurrentRecoveryPolicy({
    record,
    input,
    registry: new RecoveryValidatorRegistry([validator]),
  });
  const validatorRegistry = new RecoveryValidatorRegistry([validator]);
  const inputVerifier = verifier || new MutableInputVerifier(input);
  const registryRevision = expectedRegistryRevision === undefined
    ? manager.snapshotActiveFlows().revision
    : expectedRegistryRevision;
  const plan = new RecoveryTransitionPlan({
    resolution,
    expectedFlowState: state,
    expectedRegistryRevision: registryRevision,
    inputVerifier,
    validatorRegistry,
    transitionId: "2a9ad7c7-95e5-49fa-aaca-642ef71c239c",
    decidedAt: "2026-07-30T03:01:00.000Z",
  });
  return { manager, specId, runId, issue, input, inputVerifier, record, validator, validatorRegistry, plan };
}

function assertNoRecoveryTransition(before, fixture) {
  assert.equal(persistedState(fixture), before);
  const state = readState(fixture);
  assert.equal(state.recoveryDecisions, undefined);
  const stored = new RecoveryFailureLedger(state.recoveryFailureRecords).find(fixture.record.recordId);
  assert.equal(stored.consumption.state, "available");
}

describe("flow recovery transition", () => {
  it("records the #481 upgrade-evidence failure then atomically consumes it, resets impl-gate, and starts its outbox", () => {
    const fixture = buildFixture();
    const result = new FlowRecoveryTransition({ flowManager: fixture.manager, mainRoot: tmp }).apply(fixture.plan);
    const state = readState(fixture);
    const stored = new RecoveryFailureLedger(state.recoveryFailureRecords).find(fixture.record.recordId);
    const entry = new FlowOutbox(state.outbox).find(fixture.plan.outboxIdentity);

    assert.equal(result.decision.record.recordId, fixture.record.recordId);
    assert.equal(stored.consumption.transitionId, fixture.plan.decision.transitionId);
    assert.equal(state.recoveryDecisions.length, 1);
    assert.equal(state.recoveryDecisions[0].replacementProofObligation.inputFingerprint, fixture.input.inputFingerprint.fingerprint);
    assert.equal(findStepById(state.steps, "impl-gate").status, "pending");
    assert.equal(entry.status, "pending");
    assert.equal(entry.idempotencyKey, fixture.plan.decision.outboxIdempotencyKey);
  });

  it("delivers the persisted recovery audit after CAS and completes the same outbox entry", () => {
    const fixture = buildFixture();
    new FlowRecoveryTransition({ flowManager: fixture.manager, mainRoot: tmp }).apply(fixture.plan);
    const delivered = new RecoveryIssueLogDelivery({ flowManager: fixture.manager, root: tmp }).deliver(fixture.plan);
    const state = readState(fixture);
    const issueLog = new IssueLogStore({ root: tmp, spec: state.spec }).read().toJSON();

    assert.ok(delivered instanceof RecoveryDeliveryDone);
    assert.equal(delivered.appended, true);
    assert.equal(new FlowOutbox(state.outbox).find(fixture.plan.outboxIdentity).status, "done");
    assert.equal(issueLog.entries.filter((entry) => entry.issueLogId === fixture.plan.outboxIdentity.idempotencyKey).length, 1);
  });

  it("does not roll back the decision when delivery fails and retries with the identical idempotency key", () => {
    const fixture = buildFixture();
    new FlowRecoveryTransition({ flowManager: fixture.manager, mainRoot: tmp }).apply(fixture.plan);
    const failing = new RecoveryIssueLogDelivery({
      flowManager: fixture.manager,
      root: tmp,
      issueLogStoreFactory: () => ({ append() { throw new Error("issue-log unavailable"); } }),
    }).deliver(fixture.plan);
    let state = readState(fixture);

    assert.ok(failing instanceof RecoveryDeliveryDeferred);
    assert.equal(state.recoveryDecisions.length, 1);
    assert.equal(new FlowOutbox(state.outbox).find(fixture.plan.outboxIdentity).status, "failed");
    const retried = new RecoveryIssueLogDelivery({ flowManager: fixture.manager, root: tmp }).deliver(fixture.plan);
    state = readState(fixture);
    const issueLog = new IssueLogStore({ root: tmp, spec: state.spec }).read().toJSON();

    assert.ok(retried instanceof RecoveryDeliveryDone);
    assert.equal(new FlowOutbox(state.outbox).find(fixture.plan.outboxIdentity).status, "done");
    assert.equal(issueLog.entries.filter((entry) => entry.issueLogId === fixture.plan.outboxIdentity.idempotencyKey).length, 1);
  });

  it("does not mutate flow.json when the active-flow registry revision changed", () => {
    const fixture = buildFixture({ expectedRegistryRevision: "stale-registry-revision" });
    const before = persistedState(fixture);

    assert.throws(
      () => new FlowRecoveryTransition({ flowManager: fixture.manager, mainRoot: tmp }).apply(fixture.plan),
      (error) => error instanceof RecoveryTransitionError && error.code === "RECOVERY_REGISTRY_REVISION_CONFLICT",
    );
    assertNoRecoveryTransition(before, fixture);
  });

  it("does not mutate flow.json when validator input changed before the CAS", () => {
    const fixture = buildFixture();
    const before = persistedState(fixture);
    fixture.inputVerifier.input = createInput({
      specId: fixture.specId,
      runId: fixture.runId,
      issue: fixture.issue,
      digest: "b".repeat(64),
    });

    assert.throws(
      () => new FlowRecoveryTransition({ flowManager: fixture.manager, mainRoot: tmp }).apply(fixture.plan),
      (error) => error instanceof RecoveryTransitionError && error.code === "RECOVERY_INPUT_CHANGED",
    );
    assertNoRecoveryTransition(before, fixture);
  });

  it("does not add a partial decision when the exact flow revision changed", () => {
    const fixture = buildFixture();
    fixture.manager.mutate((state) => { state.recoveryTestRevisionProbe = "changed"; });
    const before = persistedState(fixture);

    assert.throws(
      () => new FlowRecoveryTransition({ flowManager: fixture.manager, mainRoot: tmp }).apply(fixture.plan),
      (error) => error.code === "FLOW_STATE_ATOMIC_STALE",
    );
    assertNoRecoveryTransition(before, fixture);
  });

  it("does not mutate the new flow when the exact target changed", () => {
    const fixture = buildFixture();
    fixture.manager.mutate((state) => { state.issue = 657; }, { allowIssueTransition: true });
    const before = persistedState(fixture);

    assert.throws(() => new FlowRecoveryTransition({ flowManager: fixture.manager, mainRoot: tmp }).apply(fixture.plan));
    assertNoRecoveryTransition(before, fixture);
  });

  it("requires an unborrowed repository operation lock before the transition", () => {
    const fixture = buildFixture();
    const before = persistedState(fixture);
    const lock = new RepositoryFlowOperationLock({ mainRoot: tmp });
    lock.acquire();
    try {
      assert.throws(
        () => new FlowRecoveryTransition({ flowManager: fixture.manager, mainRoot: tmp }).apply(fixture.plan),
        (error) => error.code === "REPOSITORY_FLOW_OPERATION_BUSY",
      );
    } finally {
      lock.release();
    }
    assertNoRecoveryTransition(before, fixture);
  });
});
