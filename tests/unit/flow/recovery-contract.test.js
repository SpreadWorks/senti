import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  AuthorityUnavailableFailure,
  CurrentRecoveryValidatorRerun,
  EvidenceProcessingFailure,
  RecoveryFailureRecordStore,
  RecoveryInputFingerprint,
  RecoveryPolicy,
  RecoveryPolicyCurrent,
  RecoveryUnavailable,
  RecoveryValidationInput,
  RecoveryValidator,
  RecoveryValidatorFailure,
  RecoveryValidatorPassed,
  RecoveryValidatorRegistry,
  RecoveryValidatorRerunRequired,
  ReplacementProofObligation,
  SemanticDecisionFailure,
  StaticRecoveryValidationInputCollector,
  resolveCurrentRecoveryPolicy,
} from "../../../src/flow/lib/recovery-contract.js";
import { makeFlowManager, setupFlow } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let tmp = null;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function target() {
  return {
    runId: "run-recovery-contract",
    issue: 656,
    spec: "specs/recovery-contract/spec.json",
    stepId: "impl-gate",
    attemptId: "attempt-001",
  };
}

function input(contentDigest = "a".repeat(64)) {
  return new RecoveryValidationInput({
    target: target(),
    inputFingerprint: new RecoveryInputFingerprint({
      artifacts: [{
        artifactPath: "specs/recovery-contract/impl-gate-result.json",
        digest: contentDigest,
        authority: "flow-revision-001",
      }],
    }),
  });
}

function evidencePolicy(validationInput, version = "1") {
  return new RecoveryPolicy({
    policyId: "evidence-processing",
    policyVersion: version,
    failureClass: new EvidenceProcessingFailure(),
    waivable: true,
    replacementProofObligation: new ReplacementProofObligation({
      normalStepId: "test-execute",
      checkId: "test-evidence",
      canonicalArtifactPath: "specs/recovery-contract/test-execute-result.json",
      inputFingerprint: validationInput.inputFingerprint.fingerprint,
      authority: "flow-revision-001",
      repairStepId: "impl-repair",
    }),
  });
}

class FixtureValidator extends RecoveryValidator {
  constructor({ policy, result = new RecoveryValidatorFailure({
    checkId: "test-evidence",
    failureClass: new EvidenceProcessingFailure(),
  }) }) {
    super({ validatorId: "test-evidence" });
    this.policy = policy;
    this.result = result;
  }

  currentPolicy() { return this.policy; }

  validate() { return this.result; }
}

function recordFor(validator, validationInput, recordedAt = "2026-07-30T00:00:00.000Z") {
  return validator.recordFailure(
    validationInput,
    new RecoveryValidatorFailure({
      checkId: "test-evidence",
      failureClass: new EvidenceProcessingFailure(),
    }),
    recordedAt,
  );
}

describe("validator-owned recovery contract", () => {
  it("persists only policy identity with exact validator input and no executable policy body", () => {
    const validationInput = input();
    const validator = new FixtureValidator({ policy: evidencePolicy(validationInput) });
    const record = recordFor(validator, validationInput);
    const stored = record.toJSON();

    assert.deepEqual(
      Object.keys(stored).filter((key) => key.startsWith("policy")),
      ["policyId", "policyVersion", "policyDigest"],
    );
    assert.equal(stored.policy, undefined);
    assert.equal(stored.allowedActions, undefined);
    assert.equal(stored.replacementProofObligation, undefined);
    assert.equal(stored.stepIds, undefined);
    assert.equal(stored.inputArtifacts[0].authority, "flow-revision-001");
  });

  it("allows only mechanical evidence waivers with a replacement proof obligation", () => {
    const validationInput = input();
    assert.throws(() => new RecoveryPolicy({
      policyId: "missing-proof",
      policyVersion: "1",
      failureClass: new EvidenceProcessingFailure(),
      waivable: true,
    }), /replacement proof obligation/);
    assert.throws(() => new RecoveryPolicy({
      policyId: "semantic-waiver",
      policyVersion: "1",
      failureClass: new SemanticDecisionFailure(),
      waivable: true,
      replacementProofObligation: new ReplacementProofObligation({
        normalStepId: "test-execute",
        checkId: "test-evidence",
        canonicalArtifactPath: "specs/recovery-contract/test-execute-result.json",
        inputFingerprint: validationInput.inputFingerprint.fingerprint,
        authority: "flow-revision-001",
        repairStepId: "impl-repair",
      }),
    }), /only evidence-processing/);
    assert.ok(evidencePolicy(validationInput).replacementProofObligation instanceof ReplacementProofObligation);
  });

  it("returns the current policy only when target, validator input, class, and policy identity all match", () => {
    const validationInput = input();
    const validator = new FixtureValidator({ policy: evidencePolicy(validationInput) });
    const record = recordFor(validator, validationInput);

    const resolved = resolveCurrentRecoveryPolicy({
      record,
      input: validationInput,
      registry: new RecoveryValidatorRegistry([validator]),
    });

    assert.ok(resolved instanceof RecoveryPolicyCurrent);
    assert.equal(resolved.policy, validator.policy);
    assert.equal(resolved.record.recordId, record.recordId);
  });

  it("never executes a stale policy identity and requires the validator to rerun", () => {
    const validationInput = input();
    const original = new FixtureValidator({ policy: evidencePolicy(validationInput, "1") });
    const record = recordFor(original, validationInput);
    const current = new FixtureValidator({ policy: evidencePolicy(validationInput, "2") });

    const resolved = resolveCurrentRecoveryPolicy({
      record,
      input: validationInput,
      registry: new RecoveryValidatorRegistry([current]),
    });

    assert.ok(resolved instanceof RecoveryValidatorRerunRequired);
    assert.equal(resolved.reason, "policy-mismatch");
    assert.equal(resolved.policy, undefined);
    const rerun = resolved.rerun("2026-07-30T00:01:00.000Z");
    assert.equal(rerun.unavailable, null);
    assert.equal(rerun.record.policyIdentity.policyVersion, "2");
    assert.notEqual(rerun.record.recordId, record.recordId);
  });

  it("requires a rerun for changed validator input and fails closed when the failure no longer reproduces", () => {
    const originalInput = input();
    const validator = new FixtureValidator({ policy: evidencePolicy(originalInput) });
    const record = recordFor(validator, originalInput);
    const currentInput = input("b".repeat(64));
    validator.policy = evidencePolicy(currentInput);
    validator.result = new RecoveryValidatorPassed();

    const resolved = resolveCurrentRecoveryPolicy({
      record,
      input: currentInput,
      registry: new RecoveryValidatorRegistry([validator]),
    });

    assert.ok(resolved instanceof RecoveryValidatorRerunRequired);
    assert.equal(resolved.reason, "input-mismatch");
    const rerun = resolved.rerun("2026-07-30T00:01:00.000Z");
    assert.equal(rerun.record, null);
    assert.ok(rerun.unavailable instanceof RecoveryUnavailable);
    assert.equal(rerun.unavailable.reason, "failure-not-reproduced");
  });

  it("stops with an executable descriptor when target or validator authority is unavailable", () => {
    const validationInput = input();
    const validator = new FixtureValidator({ policy: evidencePolicy(validationInput) });
    const record = recordFor(validator, validationInput);

    const missingValidator = resolveCurrentRecoveryPolicy({
      record,
      input: validationInput,
      registry: new RecoveryValidatorRegistry(),
    });
    assert.ok(missingValidator instanceof RecoveryUnavailable);
    assert.equal(missingValidator.nextAction.actionId, "inspect-validator-registry");

    const wrongTarget = new RecoveryValidationInput({
      target: { ...target(), runId: "other-run" },
      inputFingerprint: validationInput.inputFingerprint,
    });
    const mismatch = resolveCurrentRecoveryPolicy({
      record,
      input: wrongTarget,
      registry: new RecoveryValidatorRegistry([validator]),
    });
    assert.ok(mismatch instanceof RecoveryUnavailable);
    assert.equal(mismatch.reason, "target-mismatch");
  });

  it("persists records in flow.json without introducing a policy snapshot", () => {
    tmp = createTmpDir("recovery-contract-");
    const state = setupFlow(tmp, {
      spec: "specs/recovery-contract/spec.json",
      runId: target().runId,
      issue: target().issue,
    });
    const validationInput = input();
    const validator = new FixtureValidator({ policy: evidencePolicy(validationInput) });
    const record = recordFor(validator, validationInput);

    const saved = new RecoveryFailureRecordStore(makeFlowManager(tmp)).record(record);
    const persisted = JSON.parse(fs.readFileSync(
      path.join(tmp, "specs", "recovery-contract", "flow.json"),
      "utf8",
    ));

    assert.equal(saved.recordId, record.recordId);
    assert.equal(persisted.runId, state.runId);
    assert.equal(persisted.recoveryFailureRecords.length, 1);
    assert.equal(persisted.recoveryFailureRecords[0].policy, undefined);
    assert.equal(persisted.recoveryFailureRecords[0].policyDigest, record.policyIdentity.policyDigest);
  });

  it("records only a freshly reproduced failure under the exact active target", () => {
    tmp = createTmpDir("recovery-contract-rerun-");
    setupFlow(tmp, {
      spec: "specs/recovery-contract/spec.json",
      runId: target().runId,
      issue: target().issue,
    });
    const originalInput = input();
    const originalValidator = new FixtureValidator({ policy: evidencePolicy(originalInput, "1") });
    const original = recordFor(originalValidator, originalInput);
    const manager = makeFlowManager(tmp);
    const store = new RecoveryFailureRecordStore(manager);
    store.record(original);

    const currentInput = input("b".repeat(64));
    const currentValidator = new FixtureValidator({ policy: evidencePolicy(currentInput, "2") });
    const rerun = new CurrentRecoveryValidatorRerun({
      record: original,
      registry: new RecoveryValidatorRegistry([currentValidator]),
      inputCollector: new StaticRecoveryValidationInputCollector(currentInput),
      recordStore: store,
    }).rerun({ recordedAt: "2026-07-30T00:01:00.000Z" });
    const persisted = JSON.parse(fs.readFileSync(
      path.join(tmp, "specs", "recovery-contract", "flow.json"),
      "utf8",
    ));

    assert.equal(rerun.unavailable, null);
    assert.notEqual(rerun.record.recordId, original.recordId);
    assert.equal(rerun.record.policyIdentity.policyVersion, "2");
    assert.equal(persisted.recoveryFailureRecords.length, 2);
    assert.equal(persisted.recoveryFailureRecords[0].recordId, original.recordId);
    assert.equal(persisted.recoveryFailureRecords[0].consumption.state, "available");
    assert.equal(persisted.recoveryFailureRecords[1].recordId, rerun.record.recordId);
  });

  it("does not mutate normal Flow state when recollected validator input now passes", () => {
    tmp = createTmpDir("recovery-contract-rerun-pass-");
    setupFlow(tmp, {
      spec: "specs/recovery-contract/spec.json",
      runId: target().runId,
      issue: target().issue,
    });
    const originalInput = input();
    const originalValidator = new FixtureValidator({ policy: evidencePolicy(originalInput) });
    const original = recordFor(originalValidator, originalInput);
    const currentInput = input("b".repeat(64));
    const currentValidator = new FixtureValidator({
      policy: evidencePolicy(currentInput, "2"),
      result: new RecoveryValidatorPassed(),
    });
    const flowPath = path.join(tmp, "specs", "recovery-contract", "flow.json");
    const store = new RecoveryFailureRecordStore(makeFlowManager(tmp));
    store.record(original);
    const before = fs.readFileSync(flowPath, "utf8");

    const rerun = new CurrentRecoveryValidatorRerun({
      record: original,
      registry: new RecoveryValidatorRegistry([currentValidator]),
      inputCollector: new StaticRecoveryValidationInputCollector(currentInput),
      recordStore: store,
    }).rerun({ recordedAt: "2026-07-30T00:01:00.000Z" });

    assert.equal(rerun.record, null);
    assert.ok(rerun.unavailable instanceof RecoveryUnavailable);
    assert.equal(rerun.unavailable.reason, "failure-not-reproduced");
    assert.equal(fs.readFileSync(flowPath, "utf8"), before);
  });

  it("does not adopt a rerun result when the exact Flow target changed", () => {
    tmp = createTmpDir("recovery-contract-rerun-target-");
    setupFlow(tmp, {
      spec: "specs/recovery-contract/spec.json",
      runId: target().runId,
      issue: target().issue,
    });
    const originalInput = input();
    const validator = new FixtureValidator({ policy: evidencePolicy(originalInput) });
    const original = recordFor(validator, originalInput);
    const store = new RecoveryFailureRecordStore(makeFlowManager(tmp));
    store.record(original);
    const flowPath = path.join(tmp, "specs", "recovery-contract", "flow.json");
    const before = fs.readFileSync(flowPath, "utf8");
    const mismatched = new RecoveryValidationInput({
      target: { ...target(), runId: "another-run" },
      inputFingerprint: originalInput.inputFingerprint,
    });

    const rerun = new CurrentRecoveryValidatorRerun({
      record: original,
      registry: new RecoveryValidatorRegistry([validator]),
      inputCollector: new StaticRecoveryValidationInputCollector(mismatched),
      recordStore: store,
    }).rerun({ recordedAt: "2026-07-30T00:01:00.000Z" });

    assert.equal(rerun.record, null);
    assert.equal(rerun.unavailable.reason, "target-mismatch");
    assert.equal(fs.readFileSync(flowPath, "utf8"), before);
  });

  it("does not allow authority failures to become waiver policies", () => {
    assert.throws(() => new RecoveryPolicy({
      policyId: "authority-waiver",
      policyVersion: "1",
      failureClass: new AuthorityUnavailableFailure(),
      waivable: true,
      replacementProofObligation: new ReplacementProofObligation({
        normalStepId: "test-execute",
        checkId: "test-evidence",
        canonicalArtifactPath: "specs/recovery-contract/test-execute-result.json",
        inputFingerprint: "a".repeat(64),
        authority: "flow-revision-001",
        repairStepId: "impl-repair",
      }),
    }), /only evidence-processing/);
  });
});
