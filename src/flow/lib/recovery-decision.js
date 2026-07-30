import crypto from "node:crypto";

import {
  EvidenceProcessingFailure,
  RecoveryFailureLedger,
  RecoveryFailureRecord,
  RecoveryPolicy,
  ReplacementProofObligation,
} from "./recovery-contract.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const STEP_ID = /^[a-z][a-z0-9-]{0,127}$/;
const MAX_RECOVERY_DECISIONS = 1_000;

function requireString(value, field, { pattern = null, max = 4_096 } = {}) {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (pattern && !pattern.test(value)) throw new Error(`${field} is invalid`);
  return value;
}

function requireTimestamp(value, field) {
  requireString(value, field, { max: 80 });
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
  return value;
}

function equalJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export class RecoveryDecisionStepChange {
  constructor({ stepId, currentStatus, requestedStatus }) {
    this.stepId = requireString(stepId, "recovery decision stepId", { pattern: STEP_ID, max: 128 });
    if (currentStatus !== "in_progress" || requestedStatus !== "pending") {
      throw new Error("recovery decision must reset its active validator step to pending");
    }
    this.currentStatus = currentStatus;
    this.requestedStatus = requestedStatus;
    Object.freeze(this);
  }

  toJSON() {
    return {
      stepId: this.stepId,
      currentStatus: this.currentStatus,
      requestedStatus: this.requestedStatus,
    };
  }
}

/**
 * Durable proof that an automatic recovery only re-entered an ordinary
 * validation step. It deliberately stores an obligation, not a pass result.
 */
export class RecoveryDecision {
  constructor({
    transitionId = crypto.randomUUID(),
    record,
    policy,
    stepChange,
    outboxIdempotencyKey,
    decidedAt = new Date().toISOString(),
    allowConsumedRecord = false,
  }) {
    if (!UUID_V4.test(transitionId)) throw new Error("recovery decision transitionId must be a UUID v4");
    this.transitionId = transitionId;
    this.record = record instanceof RecoveryFailureRecord ? record : new RecoveryFailureRecord(record);
    if (this.record.consumption.state !== "available" && allowConsumedRecord !== true) {
      throw new Error("recovery decision requires an available failure record");
    }
    if (!(policy instanceof RecoveryPolicy)) throw new Error("recovery decision requires a current policy");
    if (!this.record.policyIdentity.equals(policy.identity)) {
      throw new Error("recovery decision policy must match the recorded current policy identity");
    }
    if (!(policy.failureClass instanceof EvidenceProcessingFailure) || policy.waivable !== true) {
      throw new Error("automatic recovery decisions are limited to mechanical evidence processing failures");
    }
    if (!(policy.replacementProofObligation instanceof ReplacementProofObligation)) {
      throw new Error("automatic recovery decision requires a replacement proof obligation");
    }
    if (policy.replacementProofObligation.inputFingerprint !== this.record.inputFingerprint.fingerprint) {
      throw new Error("recovery decision proof must bind the recorded validator input");
    }
    this.replacementProofObligation = policy.replacementProofObligation;
    this.stepChange = stepChange instanceof RecoveryDecisionStepChange
      ? stepChange
      : new RecoveryDecisionStepChange(stepChange);
    if (this.stepChange.stepId !== this.record.target.stepId) {
      throw new Error("recovery decision may reset only its recorded validator step");
    }
    this.outboxIdempotencyKey = requireString(
      outboxIdempotencyKey,
      "recovery decision outbox idempotencyKey",
      { max: 1_000 },
    );
    this.decidedAt = requireTimestamp(decidedAt, "recovery decision decidedAt");
    Object.freeze(this);
  }

  consumedRecord() {
    return this.record.consume({ transitionId: this.transitionId, consumedAt: this.decidedAt });
  }

  toJSON() {
    return {
      version: 1,
      transitionId: this.transitionId,
      recordId: this.record.recordId,
      target: this.record.target.toJSON(),
      validatorId: this.record.validatorId,
      checkId: this.record.checkId,
      policyIdentity: this.record.policyIdentity.toJSON(),
      replacementProofObligation: this.replacementProofObligation.toJSON(),
      stepChange: this.stepChange.toJSON(),
      outboxIdempotencyKey: this.outboxIdempotencyKey,
      decidedAt: this.decidedAt,
    };
  }

  toIssueLogEntry() {
    return {
      step: "recovery-transition",
      reason: "A mechanical evidence failure was recorded and the normal validator step was reset for authoritative revalidation.",
      trigger: "RECOVERY_REVALIDATE",
      resolution: "The persisted proof obligation remains required; no validation result was waived.",
      runId: this.record.target.runId,
      recoveryRecordId: this.record.recordId,
      recoveryTransitionId: this.transitionId,
      validatorId: this.record.validatorId,
      checkId: this.record.checkId,
      replacementProofObligation: this.replacementProofObligation.toJSON(),
      timestamp: this.decidedAt,
      taskId: null,
    };
  }

  static fromStored(value, ledger) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1) {
      throw new Error("stored recovery decision is invalid");
    }
    if (!(ledger instanceof RecoveryFailureLedger)) {
      throw new Error("stored recovery decision requires its failure ledger");
    }
    const recordId = requireString(value.recordId, "stored recovery decision recordId", { pattern: DIGEST, max: 64 });
    const record = ledger.find(recordId);
    if (!record) throw new Error("stored recovery decision references an unknown failure record");
    const policy = new RecoveryPolicy({
      policyId: value.policyIdentity?.policyId,
      policyVersion: value.policyIdentity?.policyVersion,
      failureClass: record.failureClass,
      waivable: true,
      replacementProofObligation: value.replacementProofObligation,
    });
    if (!record.policyIdentity.equals(policy.identity)) {
      throw new Error("stored recovery decision policy definition does not match its recorded policy identity");
    }
    const decision = new RecoveryDecision({
      transitionId: value.transitionId,
      record,
      policy,
      stepChange: value.stepChange,
      outboxIdempotencyKey: value.outboxIdempotencyKey,
      decidedAt: value.decidedAt,
      allowConsumedRecord: true,
    });
    if (!equalJson(decision.record.target.toJSON(), value.target)) {
      throw new Error("stored recovery decision target does not match its failure record");
    }
    if (decision.record.validatorId !== value.validatorId || decision.record.checkId !== value.checkId) {
      throw new Error("stored recovery decision validator does not match its failure record");
    }
    return decision;
  }
}

export class RecoveryDecisionLedger {
  constructor({ decisions = [], failureLedger = new RecoveryFailureLedger() } = {}) {
    this.failureLedger = failureLedger instanceof RecoveryFailureLedger
      ? failureLedger
      : new RecoveryFailureLedger(failureLedger);
    if (!Array.isArray(decisions) || decisions.length > MAX_RECOVERY_DECISIONS) {
      throw new Error("recovery decision ledger count is invalid");
    }
    this.decisions = Object.freeze(decisions.map((decision) => (
      decision instanceof RecoveryDecision
        ? decision
        : RecoveryDecision.fromStored(decision, this.failureLedger)
    )));
    if (new Set(this.decisions.map((decision) => decision.transitionId)).size !== this.decisions.length) {
      throw new Error("recovery decision ledger contains duplicate transition IDs");
    }
    if (new Set(this.decisions.map((decision) => decision.record.recordId)).size !== this.decisions.length) {
      throw new Error("recovery decision ledger contains duplicate failure records");
    }
    for (const decision of this.decisions) this.#assertDecisionConsumption(decision);
    Object.freeze(this);
  }

  record(decision) {
    const next = decision instanceof RecoveryDecision ? decision : new RecoveryDecision(decision);
    const existing = this.decisions.find((candidate) => candidate.transitionId === next.transitionId);
    if (existing) {
      if (!equalJson(existing.toJSON(), next.toJSON())) {
        throw new Error("recovery decision transition ID was reused with different data");
      }
      return this;
    }
    if (this.decisions.some((candidate) => candidate.record.recordId === next.record.recordId)) {
      throw new Error("recovery failure record already has a decision");
    }
    return new RecoveryDecisionLedger({
      failureLedger: this.failureLedger,
      decisions: [...this.decisions, next],
    });
  }

  assertConsistent({ failureLedger, outboxIdempotencyKeys }) {
    const ledger = failureLedger instanceof RecoveryFailureLedger
      ? failureLedger
      : new RecoveryFailureLedger(failureLedger);
    if (!(outboxIdempotencyKeys instanceof Set)) {
      throw new Error("recovery decision consistency requires outbox idempotency keys");
    }
    for (const decision of this.decisions) {
      const record = ledger.find(decision.record.recordId);
      if (!record) throw new Error("recovery decision record is absent from the current failure ledger");
      if (record.consumption.state !== "consumed" || record.consumption.transitionId !== decision.transitionId) {
        throw new Error("recovery decision and failure record consumption do not match");
      }
      if (!outboxIdempotencyKeys.has(decision.outboxIdempotencyKey)) {
        throw new Error("recovery decision is missing its durable outbox entry");
      }
    }
  }

  toJSON() { return this.decisions.map((decision) => decision.toJSON()); }

  #assertDecisionConsumption(decision) {
    const record = this.failureLedger.find(decision.record.recordId);
    if (!record || record.consumption.state !== "consumed" || record.consumption.transitionId !== decision.transitionId) {
      throw new Error("stored recovery decision requires a matching consumed failure record");
    }
  }
}
