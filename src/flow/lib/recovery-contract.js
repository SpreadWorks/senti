import crypto from "node:crypto";
import path from "node:path";

import { FlowTargetExpectation } from "../../lib/flow-target-guard.js";
import { findStepById } from "./step-tree.js";

const DIGEST = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[a-z][a-z0-9-]{0,127}$/;
const ATTEMPT_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const MAX_RECOVERY_FAILURE_RECORDS = 1_000;

function requireString(value, field, { pattern = null, max = 4_096 } = {}) {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (pattern && !pattern.test(value)) throw new Error(`${field} is invalid`);
  return value;
}

function requireDigest(value, field) {
  return requireString(value, field, { pattern: DIGEST, max: 64 });
}

function requireTimestamp(value, field) {
  requireString(value, field, { max: 80 });
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
  return value;
}

function requireIssue(value) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("recovery target issue must be a positive integer or null");
  return value;
}

function normalizeRepositoryPath(value, field) {
  const candidate = requireString(value, field);
  if (path.posix.isAbsolute(candidate) || path.win32.isAbsolute(candidate)) {
    throw new Error(`${field} must be repository-relative`);
  }
  const normalized = path.posix.normalize(candidate.replaceAll("\\", "/"));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${field} must stay inside the repository`);
  }
  return normalized;
}

function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical recovery JSON does not allow non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new Error("canonical recovery JSON supports only JSON values");
}

function canonicalDigest(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function clonedJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export class RecoveryTarget {
  constructor({ runId, issue = null, spec, stepId, attemptId }) {
    this.runId = requireString(runId, "recovery target runId", { max: 300 });
    this.issue = requireIssue(issue);
    this.spec = normalizeRepositoryPath(spec, "recovery target spec");
    if (!this.spec.startsWith("specs/")) throw new Error("recovery target spec must be inside specs/");
    this.stepId = requireString(stepId, "recovery target stepId", { pattern: IDENTIFIER, max: 128 });
    this.attemptId = requireString(attemptId, "recovery target attemptId", {
      pattern: ATTEMPT_IDENTIFIER,
      max: 256,
    });
    Object.freeze(this);
  }

  equals(other) {
    return other instanceof RecoveryTarget
      && this.runId === other.runId
      && this.issue === other.issue
      && this.spec === other.spec
      && this.stepId === other.stepId
      && this.attemptId === other.attemptId;
  }

  toJSON() {
    return {
      runId: this.runId,
      issue: this.issue,
      spec: this.spec,
      stepId: this.stepId,
      attemptId: this.attemptId,
    };
  }
}

export class RecoveryInputArtifact {
  constructor({ artifactPath, digest, authority }) {
    this.artifactPath = normalizeRepositoryPath(artifactPath, "recovery input artifactPath");
    this.digest = requireDigest(digest, "recovery input artifact digest");
    this.authority = requireString(authority, "recovery input artifact authority", { max: 1_000 });
    Object.freeze(this);
  }

  toJSON() {
    return {
      artifactPath: this.artifactPath,
      digest: this.digest,
      authority: this.authority,
    };
  }
}

export class RecoveryInputFingerprint {
  constructor({ artifacts, fingerprint = null }) {
    if (!Array.isArray(artifacts) || artifacts.length === 0) {
      throw new Error("recovery input fingerprint requires at least one artifact");
    }
    this.artifacts = Object.freeze(artifacts
      .map((artifact) => artifact instanceof RecoveryInputArtifact
        ? artifact
        : new RecoveryInputArtifact(artifact))
      .sort((left, right) => left.artifactPath.localeCompare(right.artifactPath)));
    if (new Set(this.artifacts.map((artifact) => artifact.artifactPath)).size !== this.artifacts.length) {
      throw new Error("recovery input fingerprint artifacts must not contain duplicate paths");
    }
    const expected = canonicalDigest({ version: 1, artifacts: this.artifacts.map((artifact) => artifact.toJSON()) });
    if (fingerprint != null && requireDigest(fingerprint, "recovery input fingerprint") !== expected) {
      throw new Error("recovery input fingerprint does not match its artifact authority");
    }
    this.fingerprint = expected;
    Object.freeze(this);
  }

  equals(other) {
    return other instanceof RecoveryInputFingerprint && this.fingerprint === other.fingerprint;
  }

  toJSON() {
    return {
      fingerprint: this.fingerprint,
      artifacts: this.artifacts.map((artifact) => artifact.toJSON()),
    };
  }
}

export class RecoveryValidationInput {
  constructor({ target, inputFingerprint }) {
    this.target = target instanceof RecoveryTarget ? target : new RecoveryTarget(target);
    this.inputFingerprint = inputFingerprint instanceof RecoveryInputFingerprint
      ? inputFingerprint
      : new RecoveryInputFingerprint(inputFingerprint);
    Object.freeze(this);
  }
}

export class RecoveryFailureClass {
  constructor(kind) {
    this.kind = requireString(kind, "recovery failure class", { pattern: IDENTIFIER, max: 128 });
    Object.freeze(this);
  }

  equals(other) {
    return other instanceof RecoveryFailureClass && this.kind === other.kind;
  }

  toJSON() { return { kind: this.kind }; }

  static fromStored(value) {
    const kind = value?.kind;
    if (kind === "evidence-processing") return new EvidenceProcessingFailure();
    if (kind === "semantic-decision") return new SemanticDecisionFailure();
    if (kind === "implementation-revalidation") return new ImplementationRevalidationFailure();
    if (kind === "authority-unavailable") return new AuthorityUnavailableFailure();
    throw new Error("unknown recovery failure class");
  }
}

export class EvidenceProcessingFailure extends RecoveryFailureClass {
  constructor() { super("evidence-processing"); }
}

export class SemanticDecisionFailure extends RecoveryFailureClass {
  constructor() { super("semantic-decision"); }
}

export class ImplementationRevalidationFailure extends RecoveryFailureClass {
  constructor() { super("implementation-revalidation"); }
}

export class AuthorityUnavailableFailure extends RecoveryFailureClass {
  constructor() { super("authority-unavailable"); }
}

export class ReplacementProofObligation {
  constructor({ normalStepId, checkId, canonicalArtifactPath, inputFingerprint, authority, repairStepId }) {
    this.normalStepId = requireString(normalStepId, "replacement proof normalStepId", {
      pattern: IDENTIFIER,
      max: 128,
    });
    this.checkId = requireString(checkId, "replacement proof checkId", { pattern: IDENTIFIER, max: 128 });
    this.canonicalArtifactPath = normalizeRepositoryPath(
      canonicalArtifactPath,
      "replacement proof canonicalArtifactPath",
    );
    this.inputFingerprint = requireDigest(inputFingerprint, "replacement proof inputFingerprint");
    this.authority = requireString(authority, "replacement proof authority", { max: 1_000 });
    this.repairStepId = requireString(repairStepId, "replacement proof repairStepId", {
      pattern: IDENTIFIER,
      max: 128,
    });
    Object.freeze(this);
  }

  toJSON() {
    return {
      normalStepId: this.normalStepId,
      checkId: this.checkId,
      canonicalArtifactPath: this.canonicalArtifactPath,
      inputFingerprint: this.inputFingerprint,
      authority: this.authority,
      repairStepId: this.repairStepId,
    };
  }
}

export class RecoveryPolicyIdentity {
  constructor({ policyId, policyVersion, policyDigest }) {
    this.policyId = requireString(policyId, "recovery policyId", { pattern: IDENTIFIER, max: 128 });
    this.policyVersion = requireString(policyVersion, "recovery policyVersion", {
      pattern: ATTEMPT_IDENTIFIER,
      max: 256,
    });
    this.policyDigest = requireDigest(policyDigest, "recovery policyDigest");
    Object.freeze(this);
  }

  equals(other) {
    return other instanceof RecoveryPolicyIdentity
      && this.policyId === other.policyId
      && this.policyVersion === other.policyVersion
      && this.policyDigest === other.policyDigest;
  }

  toJSON() {
    return {
      policyId: this.policyId,
      policyVersion: this.policyVersion,
      policyDigest: this.policyDigest,
    };
  }
}

export class RecoveryPolicy {
  constructor({
    policyId,
    policyVersion,
    failureClass,
    waivable = false,
    replacementProofObligation = null,
  }) {
    this.policyId = requireString(policyId, "recovery policyId", { pattern: IDENTIFIER, max: 128 });
    this.policyVersion = requireString(policyVersion, "recovery policyVersion", {
      pattern: ATTEMPT_IDENTIFIER,
      max: 256,
    });
    this.failureClass = failureClass instanceof RecoveryFailureClass
      ? failureClass
      : RecoveryFailureClass.fromStored(failureClass);
    if (typeof waivable !== "boolean") throw new Error("recovery policy waivable must be a boolean");
    this.waivable = waivable;
    this.replacementProofObligation = replacementProofObligation == null
      ? null
      : replacementProofObligation instanceof ReplacementProofObligation
        ? replacementProofObligation
        : new ReplacementProofObligation(replacementProofObligation);
    if (this.waivable && !(this.failureClass instanceof EvidenceProcessingFailure)) {
      throw new Error("only evidence-processing failures may be waived");
    }
    if (this.waivable && !this.replacementProofObligation) {
      throw new Error("waivable recovery policy requires a replacement proof obligation");
    }
    if (!this.waivable && this.replacementProofObligation) {
      throw new Error("non-waivable recovery policy cannot define a replacement proof obligation");
    }
    const definition = this.toDefinitionJSON();
    this.identity = new RecoveryPolicyIdentity({
      policyId: this.policyId,
      policyVersion: this.policyVersion,
      policyDigest: canonicalDigest(definition),
    });
    Object.freeze(this);
  }

  toDefinitionJSON() {
    return {
      version: 1,
      policyId: this.policyId,
      policyVersion: this.policyVersion,
      failureClass: this.failureClass.toJSON(),
      waivable: this.waivable,
      replacementProofObligation: this.replacementProofObligation?.toJSON() || null,
    };
  }
}

export class RecoveryRecordConsumption {
  constructor({ state = "available", transitionId = null, consumedAt = null } = {}) {
    if (!["available", "consumed"].includes(state)) throw new Error("recovery record consumption state is invalid");
    if (state === "available" && (transitionId != null || consumedAt != null)) {
      throw new Error("available recovery record cannot retain consumption metadata");
    }
    if (state === "consumed") {
      requireString(transitionId, "recovery record transitionId", { pattern: ATTEMPT_IDENTIFIER, max: 256 });
      requireTimestamp(consumedAt, "recovery record consumedAt");
    }
    this.state = state;
    this.transitionId = transitionId;
    this.consumedAt = consumedAt;
    Object.freeze(this);
  }

  consume({ transitionId, consumedAt }) {
    if (this.state === "consumed") {
      if (this.transitionId === transitionId) return this;
      throw new Error("recovery failure record is already consumed by another transition");
    }
    return new RecoveryRecordConsumption({ state: "consumed", transitionId, consumedAt });
  }

  toJSON() {
    return this.state === "available"
      ? { state: this.state }
      : { state: this.state, transitionId: this.transitionId, consumedAt: this.consumedAt };
  }
}

export class RecoveryFailureRecord {
  constructor({
    recordId = null,
    target,
    validatorId,
    checkId,
    failureClass,
    inputFingerprint,
    policyIdentity,
    recordedAt = new Date().toISOString(),
    consumption = new RecoveryRecordConsumption(),
  }) {
    this.version = 1;
    this.target = target instanceof RecoveryTarget ? target : new RecoveryTarget(target);
    this.validatorId = requireString(validatorId, "recovery validatorId", { pattern: IDENTIFIER, max: 128 });
    this.checkId = requireString(checkId, "recovery checkId", { pattern: IDENTIFIER, max: 128 });
    this.failureClass = failureClass instanceof RecoveryFailureClass
      ? failureClass
      : RecoveryFailureClass.fromStored(failureClass);
    this.inputFingerprint = inputFingerprint instanceof RecoveryInputFingerprint
      ? inputFingerprint
      : new RecoveryInputFingerprint(inputFingerprint);
    this.policyIdentity = policyIdentity instanceof RecoveryPolicyIdentity
      ? policyIdentity
      : new RecoveryPolicyIdentity(policyIdentity);
    this.recordedAt = requireTimestamp(recordedAt, "recovery failure recordedAt");
    this.consumption = consumption instanceof RecoveryRecordConsumption
      ? consumption
      : new RecoveryRecordConsumption(consumption);
    const expectedId = canonicalDigest({
      version: this.version,
      target: this.target.toJSON(),
      validatorId: this.validatorId,
      checkId: this.checkId,
      failureClass: this.failureClass.toJSON(),
      inputFingerprint: this.inputFingerprint.toJSON(),
      policyIdentity: this.policyIdentity.toJSON(),
      recordedAt: this.recordedAt,
    });
    if (recordId != null && requireDigest(recordId, "recovery failure recordId") !== expectedId) {
      throw new Error("recovery failure recordId does not match its immutable evidence");
    }
    this.recordId = expectedId;
    Object.freeze(this);
  }

  consume({ transitionId, consumedAt }) {
    return new RecoveryFailureRecord({
      ...this.toConstructorJSON(),
      consumption: this.consumption.consume({ transitionId, consumedAt }),
    });
  }

  toConstructorJSON() {
    return {
      recordId: this.recordId,
      target: this.target,
      validatorId: this.validatorId,
      checkId: this.checkId,
      failureClass: this.failureClass,
      inputFingerprint: this.inputFingerprint,
      policyIdentity: this.policyIdentity,
      recordedAt: this.recordedAt,
    };
  }

  toJSON() {
    return {
      version: this.version,
      recordId: this.recordId,
      ...this.target.toJSON(),
      validatorId: this.validatorId,
      checkId: this.checkId,
      failureClass: this.failureClass.toJSON(),
      inputFingerprint: this.inputFingerprint.fingerprint,
      inputArtifacts: this.inputFingerprint.artifacts.map((artifact) => artifact.toJSON()),
      ...this.policyIdentity.toJSON(),
      recordedAt: this.recordedAt,
      consumption: this.consumption.toJSON(),
    };
  }

  static fromStored(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1) {
      throw new Error("stored recovery failure record is invalid");
    }
    return new RecoveryFailureRecord({
      recordId: value.recordId,
      target: value,
      validatorId: value.validatorId,
      checkId: value.checkId,
      failureClass: value.failureClass,
      inputFingerprint: {
        fingerprint: value.inputFingerprint,
        artifacts: value.inputArtifacts,
      },
      policyIdentity: value,
      recordedAt: value.recordedAt,
      consumption: value.consumption,
    });
  }
}

export class RecoveryFailureLedger {
  constructor(records = []) {
    if (!Array.isArray(records) || records.length > MAX_RECOVERY_FAILURE_RECORDS) {
      throw new Error("recovery failure ledger record count is invalid");
    }
    this.records = Object.freeze(records.map((record) => record instanceof RecoveryFailureRecord
      ? record
      : RecoveryFailureRecord.fromStored(record)));
    if (new Set(this.records.map((record) => record.recordId)).size !== this.records.length) {
      throw new Error("recovery failure ledger contains duplicate record IDs");
    }
    Object.freeze(this);
  }

  find(recordId) {
    return this.records.find((record) => record.recordId === recordId) || null;
  }

  record(record) {
    const next = record instanceof RecoveryFailureRecord ? record : new RecoveryFailureRecord(record);
    const existing = this.find(next.recordId);
    if (existing) return this;
    return new RecoveryFailureLedger([...this.records, next]);
  }

  replace(record) {
    const next = record instanceof RecoveryFailureRecord ? record : new RecoveryFailureRecord(record);
    if (!this.find(next.recordId)) throw new Error("recovery failure ledger cannot replace an unknown record");
    return new RecoveryFailureLedger(this.records.map((current) => (
      current.recordId === next.recordId ? next : current
    )));
  }

  toJSON() { return this.records.map((record) => record.toJSON()); }
}

export class RecoveryFailureRecordStore {
  constructor(flowManager) {
    if (!flowManager || typeof flowManager.mutate !== "function") {
      throw new Error("recovery failure record store requires a flow manager");
    }
    this.flowManager = flowManager;
    Object.freeze(this);
  }

  record(record, options = {}) {
    const next = record instanceof RecoveryFailureRecord ? record : new RecoveryFailureRecord(record);
    let persisted = null;
    this.flowManager.mutate((state) => {
      const ledger = new RecoveryFailureLedger(state.recoveryFailureRecords || []);
      const updated = ledger.record(next);
      state.recoveryFailureRecords = updated.toJSON();
      persisted = updated.find(next.recordId);
    }, options);
    return persisted;
  }

  /**
   * Persists a newly observed failure only after resolving the exact active
   * Flow target. Recovery callers use this instead of the unscoped writer so
   * a revalidation can never adopt its result into a different active Flow.
   */
  recordForExactTarget(record, options = {}) {
    const next = record instanceof RecoveryFailureRecord ? record : new RecoveryFailureRecord(record);
    if (typeof this.flowManager.captureExactTarget !== "function") {
      throw new Error("exact recovery failure recording requires a target-aware flow manager");
    }
    const target = new FlowTargetExpectation({
      expectRunId: next.target.runId,
      expectSpec: next.target.spec,
      ...(next.target.issue == null
        ? { expectNoIssue: true }
        : { expectIssue: next.target.issue }),
    });
    const captured = this.flowManager.captureExactTarget(target);
    let persisted = null;
    captured.mutate((state) => {
      if (!findStepById(state.steps || [], next.target.stepId)) {
        throw new Error("recovery validator step is absent from the exact active flow");
      }
      const ledger = new RecoveryFailureLedger(state.recoveryFailureRecords || []);
      const updated = ledger.record(next);
      state.recoveryFailureRecords = updated.toJSON();
      persisted = updated.find(next.recordId);
    }, options);
    return persisted;
  }
}

export class RecoveryValidatorFailure {
  constructor({ checkId, failureClass }) {
    this.checkId = requireString(checkId, "recovery validator failure checkId", {
      pattern: IDENTIFIER,
      max: 128,
    });
    this.failureClass = failureClass instanceof RecoveryFailureClass
      ? failureClass
      : RecoveryFailureClass.fromStored(failureClass);
    Object.freeze(this);
  }
}

export class RecoveryValidatorPassed {
  constructor() { Object.freeze(this); }
}

export class RecoveryValidator {
  constructor({ validatorId }) {
    this.validatorId = requireString(validatorId, "recovery validatorId", { pattern: IDENTIFIER, max: 128 });
  }

  currentPolicy(_input) { throw new Error("recovery validator must implement currentPolicy"); }

  validate(_input) { throw new Error("recovery validator must implement validate"); }

  recordFailure(input, result, recordedAt = new Date().toISOString()) {
    if (!(input instanceof RecoveryValidationInput)) throw new Error("recovery validator input is required");
    if (!(result instanceof RecoveryValidatorFailure)) {
      throw new Error("recovery validator can record only a failed validation result");
    }
    const policy = this.currentPolicy(input);
    if (!(policy instanceof RecoveryPolicy)) throw new Error("recovery validator currentPolicy must return a RecoveryPolicy");
    if (!policy.failureClass.equals(result.failureClass)) {
      throw new Error("recovery validator policy and failed validation class must match");
    }
    return new RecoveryFailureRecord({
      target: input.target,
      validatorId: this.validatorId,
      checkId: result.checkId,
      failureClass: result.failureClass,
      inputFingerprint: input.inputFingerprint,
      policyIdentity: policy.identity,
      recordedAt,
    });
  }
}

export class RecoveryValidatorRegistry {
  constructor(validators = []) {
    this.validators = new Map();
    for (const validator of validators) this.register(validator);
  }

  register(validator) {
    if (!(validator instanceof RecoveryValidator)) throw new Error("recovery validator registry requires RecoveryValidator instances");
    if (this.validators.has(validator.validatorId)) throw new Error(`duplicate recovery validator: ${validator.validatorId}`);
    this.validators.set(validator.validatorId, validator);
    return this;
  }

  resolve(validatorId) { return this.validators.get(validatorId) || null; }
}

export class RecoveryActionDescriptor {
  constructor({ actionId, description }) {
    this.actionId = requireString(actionId, "recovery actionId", { pattern: IDENTIFIER, max: 128 });
    this.description = requireString(description, "recovery action description", { max: 1_000 });
    Object.freeze(this);
  }

  toJSON() { return { actionId: this.actionId, description: this.description }; }
}

export class RecoveryUnavailable {
  constructor({ reason, message = null, nextAction }) {
    this.reason = requireString(reason, "recovery unavailable reason", { pattern: IDENTIFIER, max: 128 });
    this.message = message == null
      ? "Recovery did not change the Flow. Follow the next action to collect current authority or evidence."
      : requireString(message, "recovery unavailable message", { max: 1_000 });
    this.nextAction = nextAction instanceof RecoveryActionDescriptor
      ? nextAction
      : new RecoveryActionDescriptor(nextAction);
    Object.freeze(this);
  }

  toJSON() {
    return {
      available: false,
      reason: this.reason,
      message: this.message,
      nextAction: this.nextAction.toJSON(),
    };
  }
}

export class RecoveryPolicyCurrent {
  constructor({ record, policy }) {
    this.record = record instanceof RecoveryFailureRecord ? record : new RecoveryFailureRecord(record);
    if (!(policy instanceof RecoveryPolicy)) throw new Error("current recovery policy is required");
    this.policy = policy;
    Object.freeze(this);
  }
}

export class RecoveryFailureRerunResult {
  constructor({ record = null, unavailable = null }) {
    if ((record == null) === (unavailable == null)) {
      throw new Error("recovery validator rerun must produce exactly one result");
    }
    this.record = record == null ? null : (record instanceof RecoveryFailureRecord
      ? record
      : new RecoveryFailureRecord(record));
    this.unavailable = unavailable == null ? null : (unavailable instanceof RecoveryUnavailable
      ? unavailable
      : new RecoveryUnavailable(unavailable));
    Object.freeze(this);
  }
}

export class RecoveryValidatorRerunRequired {
  constructor({ record, input, validator, reason }) {
    this.record = record instanceof RecoveryFailureRecord ? record : new RecoveryFailureRecord(record);
    if (!(input instanceof RecoveryValidationInput)) throw new Error("recovery validator rerun input is required");
    if (!(validator instanceof RecoveryValidator)) throw new Error("recovery validator rerun validator is required");
    this.input = input;
    this.validator = validator;
    this.reason = requireString(reason, "recovery validator rerun reason", { pattern: IDENTIFIER, max: 128 });
    this.nextAction = new RecoveryActionDescriptor({
      actionId: "rerun-validator",
      description: "Re-run the current validator and record only a current failure.",
    });
    Object.freeze(this);
  }

  rerun(recordedAt = new Date().toISOString()) {
    const result = this.validator.validate(this.input);
    if (result instanceof RecoveryValidatorFailure) {
      return new RecoveryFailureRerunResult({
        record: this.validator.recordFailure(this.input, result, recordedAt),
      });
    }
    if (result instanceof RecoveryValidatorPassed) {
      return new RecoveryFailureRerunResult({
        unavailable: new RecoveryUnavailable({
          reason: "failure-not-reproduced",
          nextAction: {
            actionId: "inspect-normal-flow",
            description: "Inspect the current normal Flow state before attempting another recovery.",
          },
        }),
      });
    }
    throw new Error("recovery validator validate must return a typed result");
  }
}

/** A behavioral boundary for collecting validator input immediately before a rerun. */
export class RecoveryValidationInputCollector {
  collect() {
    throw new Error("recovery validation input collector must implement collect()");
  }
}

export class StaticRecoveryValidationInputCollector extends RecoveryValidationInputCollector {
  constructor(input) {
    super();
    this.input = input instanceof RecoveryValidationInput ? input : new RecoveryValidationInput(input);
    Object.freeze(this);
  }

  collect() { return this.input; }
}

/**
 * Recollects input and re-runs the live validator. A reproduced failure is
 * written as a fresh record under an exact Flow target; a pass leaves normal
 * Flow state untouched and explicitly stops recovery.
 */
export class CurrentRecoveryValidatorRerun {
  constructor({ record, registry, inputCollector, recordStore }) {
    this.record = record instanceof RecoveryFailureRecord ? record : new RecoveryFailureRecord(record);
    if (!(registry instanceof RecoveryValidatorRegistry)) {
      throw new Error("current recovery validator rerun requires a validator registry");
    }
    if (!(inputCollector instanceof RecoveryValidationInputCollector)) {
      throw new Error("current recovery validator rerun requires an input collector");
    }
    if (!(recordStore instanceof RecoveryFailureRecordStore)) {
      throw new Error("current recovery validator rerun requires a failure record store");
    }
    this.registry = registry;
    this.inputCollector = inputCollector;
    this.recordStore = recordStore;
    Object.freeze(this);
  }

  rerun({ recordedAt = new Date().toISOString(), recordOptions = {} } = {}) {
    const input = this.inputCollector.collect();
    if (!(input instanceof RecoveryValidationInput)) {
      throw new Error("recovery validation input collector did not return validation input");
    }
    if (!this.record.target.equals(input.target)) {
      return new RecoveryFailureRerunResult({
        unavailable: unavailable(
          "target-mismatch",
          "inspect-recovery-target",
          "Read the active Flow target and record a new failure only for that exact target.",
        ),
      });
    }
    const validator = this.registry.resolve(this.record.validatorId);
    if (!validator) {
      return new RecoveryFailureRerunResult({
        unavailable: unavailable(
          "validator-unavailable",
          "inspect-validator-registry",
          "Restore the exact validator before attempting recovery.",
        ),
      });
    }
    const result = validator.validate(input);
    if (result instanceof RecoveryValidatorPassed) {
      return new RecoveryFailureRerunResult({
        unavailable: unavailable(
          "failure-not-reproduced",
          "inspect-normal-flow",
          "Inspect the current normal Flow state before attempting another recovery.",
        ),
      });
    }
    if (!(result instanceof RecoveryValidatorFailure)) {
      throw new Error("recovery validator validate must return a typed result");
    }
    const fresh = validator.recordFailure(input, result, recordedAt);
    return new RecoveryFailureRerunResult({
      record: this.recordStore.recordForExactTarget(fresh, recordOptions),
    });
  }
}

function unavailable(reason, actionId, description) {
  return new RecoveryUnavailable({
    reason,
    nextAction: { actionId, description },
  });
}

export function resolveCurrentRecoveryPolicy({ record, input, registry }) {
  const failureRecord = record instanceof RecoveryFailureRecord
    ? record
    : new RecoveryFailureRecord(record);
  if (!(input instanceof RecoveryValidationInput)) throw new Error("recovery policy resolution input is required");
  if (!(registry instanceof RecoveryValidatorRegistry)) throw new Error("recovery policy resolution registry is required");
  if (!failureRecord.target.equals(input.target)) {
    return unavailable(
      "target-mismatch",
      "inspect-recovery-target",
      "Read the active Flow target and record a new failure only for that exact target.",
    );
  }
  const validator = registry.resolve(failureRecord.validatorId);
  if (!validator) {
    return unavailable(
      "validator-unavailable",
      "inspect-validator-registry",
      "Restore the exact validator before attempting recovery.",
    );
  }
  if (!failureRecord.inputFingerprint.equals(input.inputFingerprint)) {
    return new RecoveryValidatorRerunRequired({
      record: failureRecord,
      input,
      validator,
      reason: "input-mismatch",
    });
  }
  let policy;
  try {
    policy = validator.currentPolicy(input);
  } catch (_error) {
    return unavailable(
      "policy-unavailable",
      "rerun-validator",
      "Re-run the current validator after its policy is available.",
    );
  }
  if (!(policy instanceof RecoveryPolicy)) {
    throw new Error("recovery validator currentPolicy must return a RecoveryPolicy");
  }
  if (!policy.failureClass.equals(failureRecord.failureClass)) {
    return new RecoveryValidatorRerunRequired({
      record: failureRecord,
      input,
      validator,
      reason: "failure-class-mismatch",
    });
  }
  if (!failureRecord.policyIdentity.equals(policy.identity)) {
    return new RecoveryValidatorRerunRequired({
      record: failureRecord,
      input,
      validator,
      reason: "policy-mismatch",
    });
  }
  return new RecoveryPolicyCurrent({ record: failureRecord, policy });
}

export function cloneRecoveryPolicyDefinition(policy) {
  if (!(policy instanceof RecoveryPolicy)) throw new Error("recovery policy is required");
  return clonedJson(policy.toDefinitionJSON());
}
