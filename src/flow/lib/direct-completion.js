import crypto from "node:crypto";
import { DirectVerificationResult } from "./direct-flow-session.js";

const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const MERGE_DISPOSITIONS = new Set(["merged", "already-merged"]);
const INTEGRATION_STATUSES = new Set(["pending", "merged"]);
const COMPLETION_STATUSES = new Set(["prepared", "completed"]);
const EVIDENCE_KINDS = new Set(["integration-receipt", "exact-ancestry"]);

function requireString(value, field, max = 4000) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(`${field} exceeds ${max} characters`);
  return normalized;
}

function requireIso(value, field) {
  const normalized = requireString(value, field, 100);
  if (!Number.isFinite(Date.parse(normalized))) throw new Error(`${field} must be an ISO timestamp`);
  return normalized;
}

function requireGitObject(value, field, { nullable = false } = {}) {
  if (nullable && value == null) return null;
  const normalized = requireString(value, field, 128);
  if (!GIT_OBJECT_ID.test(normalized)) throw new Error(`${field} must be a Git object ID`);
  return normalized;
}

function requirePlanRevision(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("completion planRevision must be a positive integer");
  }
  return value;
}

function requireIssue(value) {
  if (value == null) return null;
  if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new Error("completion issue must be a positive integer or null");
  }
  return Number(value);
}

function stableId(prefix, input) {
  return `${prefix}-${crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32)}`;
}

export class DirectAbortReceipt {
  constructor({
    receiptId = null,
    runId,
    issue = null,
    spec,
    planId,
    planRevision,
    reason,
    recordedAt = new Date().toISOString(),
  }) {
    this.version = 1;
    this.status = "aborted";
    this.completionMode = "aborted";
    this.runId = requireString(runId, "direct abort runId", 300);
    this.issue = requireIssue(issue);
    this.spec = requireString(spec, "direct abort spec", 500);
    this.planId = requireString(planId, "direct abort planId", 100);
    this.planRevision = requirePlanRevision(planRevision);
    this.reason = requireString(reason, "direct abort reason");
    this.recordedAt = requireIso(recordedAt, "direct abort recordedAt");
    const identity = {
      runId: this.runId,
      planId: this.planId,
      planRevision: this.planRevision,
    };
    this.receiptId = receiptId == null
      ? stableId("direct-abort", identity)
      : requireString(receiptId, "direct abort receiptId", 100);
    if (this.receiptId !== stableId("direct-abort", identity)) {
      throw new Error("direct abort receiptId does not match its plan identity");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      version: this.version,
      receiptId: this.receiptId,
      status: this.status,
      completionMode: this.completionMode,
      runId: this.runId,
      issue: this.issue,
      spec: this.spec,
      planId: this.planId,
      planRevision: this.planRevision,
      reason: this.reason,
      recordedAt: this.recordedAt,
    };
  }

  static fromStored(value) {
    if (value instanceof DirectAbortReceipt) return value;
    const { version, status, completionMode, ...stored } = value || {};
    if (version !== 1 || status !== "aborted" || completionMode !== "aborted") {
      throw new Error("direct abort receipt metadata is invalid");
    }
    return new DirectAbortReceipt(stored);
  }
}

export class DirectGitEvidence {
  constructor({
    kind,
    featureHead,
    mainHead,
    receiptKey = null,
    receiptCommit = null,
    observedAt = new Date().toISOString(),
  }) {
    this.kind = requireString(kind, "direct Git evidence kind", 100);
    if (!EVIDENCE_KINDS.has(this.kind)) throw new Error(`invalid direct Git evidence kind: ${this.kind}`);
    this.featureHead = requireGitObject(featureHead, "direct Git evidence featureHead");
    this.mainHead = requireGitObject(mainHead, "direct Git evidence mainHead");
    this.receiptKey = receiptKey == null
      ? null
      : requireString(receiptKey, "direct Git evidence receiptKey", 1000);
    this.receiptCommit = requireGitObject(
      receiptCommit,
      "direct Git evidence receiptCommit",
      { nullable: true },
    );
    if (
      (this.kind === "integration-receipt")
      !== (this.receiptKey != null && this.receiptCommit != null)
    ) {
      throw new Error(
        "integration-receipt evidence requires a receipt key and commit; exact ancestry forbids them",
      );
    }
    this.observedAt = requireIso(observedAt, "direct Git evidence observedAt");
    Object.freeze(this);
  }

  toJSON() {
    return {
      kind: this.kind,
      featureHead: this.featureHead,
      mainHead: this.mainHead,
      receiptKey: this.receiptKey,
      receiptCommit: this.receiptCommit,
      observedAt: this.observedAt,
    };
  }

  static fromStored(value) {
    return value instanceof DirectGitEvidence ? value : new DirectGitEvidence(value);
  }
}

export class DirectIntegrationReceipt {
  constructor({
    receiptId = null,
    status,
    runId,
    issue = null,
    spec,
    planId,
    planRevision,
    strategy,
    mergeDisposition,
    featureHead,
    mainHead = null,
    idempotencyKey = null,
    createdAt = new Date().toISOString(),
    integratedAt = null,
  }) {
    this.version = 1;
    this.status = requireString(status, "integration receipt status", 50);
    if (!INTEGRATION_STATUSES.has(this.status)) throw new Error("invalid integration receipt status");
    this.runId = requireString(runId, "integration receipt runId", 300);
    this.issue = requireIssue(issue);
    this.spec = requireString(spec, "integration receipt spec", 500);
    this.planId = requireString(planId, "integration receipt planId", 100);
    this.planRevision = requirePlanRevision(planRevision);
    this.strategy = requireString(strategy, "integration receipt strategy", 50);
    if (!["squash", "already-merged"].includes(this.strategy)) {
      throw new Error("integration receipt strategy must be squash or already-merged");
    }
    this.mergeDisposition = requireString(
      mergeDisposition,
      "integration receipt mergeDisposition",
      50,
    );
    if (!MERGE_DISPOSITIONS.has(this.mergeDisposition)) {
      throw new Error("invalid integration receipt mergeDisposition");
    }
    this.featureHead = requireGitObject(featureHead, "integration receipt featureHead");
    this.mainHead = requireGitObject(mainHead, "integration receipt mainHead", { nullable: true });
    if ((this.status === "merged") !== (this.mainHead != null)) {
      throw new Error("merged integration receipt requires mainHead; pending receipt forbids it");
    }
    this.createdAt = requireIso(createdAt, "integration receipt createdAt");
    this.integratedAt = integratedAt == null ? null : requireIso(integratedAt, "integration receipt integratedAt");
    if ((this.status === "merged") !== (this.integratedAt != null)) {
      throw new Error("merged integration receipt requires integratedAt; pending receipt forbids it");
    }
    const identity = {
      runId: this.runId,
      planId: this.planId,
      planRevision: this.planRevision,
    };
    this.receiptId = receiptId == null
      ? stableId("direct-integration", identity)
      : requireString(receiptId, "integration receipt receiptId", 100);
    if (this.receiptId !== stableId("direct-integration", identity)) {
      throw new Error("integration receipt ID does not match its plan identity");
    }
    this.idempotencyKey = idempotencyKey == null
      ? stableId("direct-merge", identity)
      : requireString(idempotencyKey, "integration receipt idempotencyKey", 100);
    if (this.idempotencyKey !== stableId("direct-merge", identity)) {
      throw new Error("integration receipt idempotencyKey does not match its plan identity");
    }
    Object.freeze(this);
  }

  integrated({ mainHead, integratedAt = new Date().toISOString() }) {
    return new DirectIntegrationReceipt({
      ...this.toJSON(),
      status: "merged",
      mainHead,
      integratedAt,
    });
  }

  toJSON() {
    return {
      version: this.version,
      receiptId: this.receiptId,
      status: this.status,
      runId: this.runId,
      issue: this.issue,
      spec: this.spec,
      planId: this.planId,
      planRevision: this.planRevision,
      strategy: this.strategy,
      mergeDisposition: this.mergeDisposition,
      featureHead: this.featureHead,
      mainHead: this.mainHead,
      idempotencyKey: this.idempotencyKey,
      createdAt: this.createdAt,
      integratedAt: this.integratedAt,
    };
  }

  static fromStored(value) {
    return value instanceof DirectIntegrationReceipt ? value : new DirectIntegrationReceipt(value);
  }
}

export class DirectSkippedStep {
  constructor({ stepId, reason }) {
    this.stepId = requireString(stepId, "direct skipped stepId", 200);
    this.reason = requireString(reason, "direct skipped reason");
    Object.freeze(this);
  }

  toJSON() {
    return { stepId: this.stepId, reason: this.reason };
  }

  static fromStored(value) {
    return value instanceof DirectSkippedStep ? value : new DirectSkippedStep(value);
  }
}

export class DirectCompletionReceipt {
  constructor({
    receiptId = null,
    status,
    runId,
    issue = null,
    spec,
    planId,
    planRevision,
    mergeDisposition,
    sourceStep,
    gitEvidence,
    skippedSteps,
    minimalValidation,
    preparedAt = new Date().toISOString(),
    reconciledAt = null,
    completedAt = null,
    externalUpdateKey = null,
  }) {
    this.version = 1;
    this.completionMode = "direct";
    this.status = requireString(status, "direct completion status", 50);
    if (!COMPLETION_STATUSES.has(this.status)) throw new Error("invalid direct completion status");
    this.runId = requireString(runId, "direct completion runId", 300);
    this.issue = requireIssue(issue);
    this.spec = requireString(spec, "direct completion spec", 500);
    this.planId = requireString(planId, "direct completion planId", 100);
    this.planRevision = requirePlanRevision(planRevision);
    this.mergeDisposition = requireString(
      mergeDisposition,
      "direct completion mergeDisposition",
      50,
    );
    if (!MERGE_DISPOSITIONS.has(this.mergeDisposition)) {
      throw new Error("invalid direct completion mergeDisposition");
    }
    this.sourceStep = requireString(sourceStep, "direct completion sourceStep", 200);
    this.gitEvidence = DirectGitEvidence.fromStored(gitEvidence);
    if (!Array.isArray(skippedSteps) || skippedSteps.length === 0) {
      throw new Error("direct completion skippedSteps must be non-empty");
    }
    this.skippedSteps = Object.freeze(skippedSteps.map((step) => DirectSkippedStep.fromStored(step)));
    this.minimalValidation = DirectVerificationResult.fromStored(minimalValidation);
    if (this.minimalValidation.status !== "passed") {
      throw new Error("direct completion requires passed minimal validation");
    }
    this.preparedAt = requireIso(preparedAt, "direct completion preparedAt");
    this.reconciledAt = reconciledAt == null
      ? (this.mergeDisposition === "already-merged" ? this.preparedAt : null)
      : requireIso(reconciledAt, "direct completion reconciledAt");
    if ((this.mergeDisposition === "already-merged") !== (this.reconciledAt != null)) {
      throw new Error("only already-merged direct completion requires reconciledAt");
    }
    this.completedAt = completedAt == null ? null : requireIso(completedAt, "direct completion completedAt");
    if ((this.status === "completed") !== (this.completedAt != null)) {
      throw new Error("completed direct receipt requires completedAt; prepared receipt forbids it");
    }
    const identity = {
      runId: this.runId,
      planId: this.planId,
      planRevision: this.planRevision,
      mergeDisposition: this.mergeDisposition,
    };
    this.receiptId = receiptId == null
      ? stableId("direct-completion", identity)
      : requireString(receiptId, "direct completion receiptId", 100);
    if (this.receiptId !== stableId("direct-completion", identity)) {
      throw new Error("direct completion receiptId does not match its identity");
    }
    this.externalUpdateKey = externalUpdateKey == null
      ? stableId("direct-external-update", identity)
      : requireString(externalUpdateKey, "direct completion externalUpdateKey", 100);
    if (this.externalUpdateKey !== stableId("direct-external-update", identity)) {
      throw new Error("direct completion externalUpdateKey does not match its identity");
    }
    Object.freeze(this);
  }

  complete(completedAt = new Date().toISOString()) {
    return new DirectCompletionReceipt({
      ...this.toJSON(),
      status: "completed",
      completedAt,
    });
  }

  deterministicSummary() {
    return [
      `Direct completion ${this.receiptId}`,
      `mode=${this.completionMode}`,
      `merge=${this.mergeDisposition}`,
      `sourceStep=${this.sourceStep}`,
      `verification=${this.minimalValidation.status}`,
      `skipped=${this.skippedSteps.map((step) => step.stepId).join(",")}`,
    ].join("; ");
  }

  toJSON() {
    return {
      version: this.version,
      receiptId: this.receiptId,
      status: this.status,
      completionMode: this.completionMode,
      runId: this.runId,
      issue: this.issue,
      spec: this.spec,
      planId: this.planId,
      planRevision: this.planRevision,
      mergeDisposition: this.mergeDisposition,
      sourceStep: this.sourceStep,
      gitEvidence: this.gitEvidence.toJSON(),
      skippedSteps: this.skippedSteps.map((step) => step.toJSON()),
      minimalValidation: this.minimalValidation.toJSON(),
      preparedAt: this.preparedAt,
      reconciledAt: this.reconciledAt,
      completedAt: this.completedAt,
      externalUpdateKey: this.externalUpdateKey,
      summary: this.deterministicSummary(),
    };
  }

  static fromStored(value) {
    if (value instanceof DirectCompletionReceipt) return value;
    const { completionMode, summary, ...stored } = value || {};
    if (completionMode !== "direct") throw new Error("direct completionMode must be direct");
    const receipt = new DirectCompletionReceipt(stored);
    if (summary != null && summary !== receipt.deterministicSummary()) {
      throw new Error("direct completion summary does not match receipt content");
    }
    return receipt;
  }
}
