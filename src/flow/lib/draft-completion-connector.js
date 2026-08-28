import { createHash } from "node:crypto";

import { validateDraftLifecycle } from "./draft-lifecycle.js";
import { CanonicalCommandAttemptArtifactHistory } from "./canonical-command-result.js";

const SHA256 = /^[a-f0-9]{64}$/;
const SOURCES = new Set(["coverage-pass", "coverage-repair"]);
const CONNECTOR_TOKEN = Symbol("draft-completion-connector");

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function digest(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalDigest(value, field) {
  const resolved = requiredText(value, field);
  if (!SHA256.test(resolved)) throw new Error(`${field} must be a SHA-256 digest`);
  return resolved;
}

function canonicalByteLength(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

function freezeJson(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

function jsonObject(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return freezeJson(structuredClone(value));
}

function nonApprovalLifecycleIssues(issues) {
  return issues.filter((issue) => issue !== "draft approval is required: set approval.approved = true");
}

function triageRequiresUserDecision(triage) {
  return Array.isArray(triage?.items)
    && triage.items.some((item) => item?.decision === "requires_user_decision");
}

function repairEligibilityIssues(repair) {
  if (repair === null) return ["coverage repair audit is required"];
  const audit = repair.audit;
  if (audit === null || typeof audit !== "object" || Array.isArray(audit)) {
    return ["coverage repair audit is invalid"];
  }
  const issues = [];
  if (!Array.isArray(audit.envelopeErrors) || audit.envelopeErrors.length > 0) {
    issues.push("coverage repair envelope is incomplete");
  }
  if (audit.baseRevisionMatches !== true) issues.push("coverage repair base revision is stale");
  if (!Array.isArray(audit.missingRequiredTargets) || audit.missingRequiredTargets.length > 0) {
    issues.push("coverage repair has missing required targets");
  }
  if (!Array.isArray(audit.lifecycleIssues) || nonApprovalLifecycleIssues(audit.lifecycleIssues).length > 0) {
    issues.push("coverage repair retains non-approval lifecycle issues");
  }
  return issues;
}

/**
 * Immutable canonical facts at the one draft-coverage-repair to draft-gate
 * connection. Facts describe the already observed review or repair outcome;
 * they do not select a route or mutate a draft.
 */
export class DraftCompletionFacts {
  constructor({
    source,
    sourceStepId,
    targetStepId,
    draft,
    draftDigest,
    draftByteLength,
    reviewDraftDigest = null,
    reviewVerdict,
    triage = null,
    repair = null,
  } = {}) {
    this.source = requiredText(source, "draft completion source");
    if (!SOURCES.has(this.source)) throw new Error("draft completion source is invalid");
    this.sourceStepId = requiredText(sourceStepId, "draft completion source step");
    this.targetStepId = requiredText(targetStepId, "draft completion target step");
    if (this.sourceStepId !== "draft-coverage-repair" || this.targetStepId !== "draft-gate") {
      throw new Error("draft completion connector must bridge draft-coverage-repair to draft-gate");
    }
    this.draft = jsonObject(draft, "draft completion draft");
    this.draftDigest = canonicalDigest(draftDigest, "draft completion draft digest");
    this.draftByteLength = canonicalByteLength(draftByteLength, "draft completion draft byteLength");
    this.draftDocumentDigest = digest(this.draft);
    this.reviewVerdict = requiredText(reviewVerdict, "draft completion review verdict");
    this.reviewDraftDigest = typeof reviewDraftDigest === "string" && SHA256.test(reviewDraftDigest)
      ? reviewDraftDigest
      : null;
    this.triage = triage === null ? null : jsonObject(triage, "draft completion triage");
    this.repair = repair === null ? null : jsonObject(repair, "draft completion repair");
    this.eligibilityIssues = Object.freeze(this.#eligibilityIssues());
    Object.freeze(this);
  }

  #eligibilityIssues() {
    const issues = [];
    if (this.draft.approval?.approved !== false) {
      issues.push("draft approval marker is not pending");
    }
    issues.push(...nonApprovalLifecycleIssues(validateDraftLifecycle(this.draft)));
    if (this.reviewDraftDigest === null || this.reviewDraftDigest !== this.draftDigest) {
      issues.push("coverage review is stale for the canonical draft revision");
    }
    if (this.source === "coverage-pass") {
      if (this.reviewVerdict !== "PASS") issues.push("coverage review did not pass");
      if (this.triage !== null || this.repair !== null) issues.push("coverage pass must not carry repair evidence");
      return issues;
    }
    if (!new Set(["ADVISORY", "REJECTED"]).has(this.reviewVerdict)) {
      issues.push("coverage repair requires a non-pass coverage review");
    }
    if (this.triage === null) issues.push("coverage repair triage is required");
    if (triageRequiresUserDecision(this.triage)) issues.push("coverage repair requires user decision");
    issues.push(...repairEligibilityIssues(this.repair));
    return issues;
  }

  get eligible() { return this.eligibilityIssues.length === 0; }

  toJSON() {
    return {
      source: this.source,
      sourceStepId: this.sourceStepId,
      targetStepId: this.targetStepId,
      draftDigest: this.draftDigest,
      draftByteLength: this.draftByteLength,
      draftDocumentDigest: this.draftDocumentDigest,
      reviewVerdict: this.reviewVerdict,
      reviewDraftDigest: this.reviewDraftDigest,
      eligibilityIssues: [...this.eligibilityIssues],
    };
  }
}

/** A sealed Definition-selected connector. It can only derive approval=true. */
export class DraftCompletionConnector {
  constructor(token, facts) {
    if (token !== CONNECTOR_TOKEN || !(facts instanceof DraftCompletionFacts)) {
      throw new Error("DraftCompletionConnector is created only by the definition resolver");
    }
    if (!facts.eligible) throw new Error("DraftCompletionConnector requires eligible canonical facts");
    this.source = facts.source;
    this.sourceStepId = facts.sourceStepId;
    this.targetStepId = facts.targetStepId;
    this.expectedDraftDigest = facts.draftDigest;
    this.expectedDraftByteLength = facts.draftByteLength;
    this.expectedDraftDocumentDigest = facts.draftDocumentDigest;
    this.reviewVerdict = facts.reviewVerdict;
    this.reviewDraftDigest = facts.reviewDraftDigest;
    this.receiptId = createHash("sha256").update(stableJson({
      source: this.source,
      sourceStepId: this.sourceStepId,
      targetStepId: this.targetStepId,
      expectedDraftDigest: this.expectedDraftDigest,
      expectedDraftByteLength: this.expectedDraftByteLength,
      expectedDraftDocumentDigest: this.expectedDraftDocumentDigest,
      reviewVerdict: this.reviewVerdict,
      reviewDraftDigest: this.reviewDraftDigest,
    })).digest("hex");
    Object.freeze(this);
  }

  applyTo(draft) {
    if (draftCompletionDocumentDigest(draft) !== this.expectedDraftDocumentDigest) {
      throw new Error("draft completion connector rejected a stale draft revision");
    }
    return {
      ...structuredClone(draft),
      approval: {
        ...structuredClone(draft.approval),
        approved: true,
      },
    };
  }

  toJSON() {
    return {
      connector: "draft-completion",
      source: this.source,
      sourceStepId: this.sourceStepId,
      targetStepId: this.targetStepId,
      expectedDraftDigest: this.expectedDraftDigest,
      expectedDraftByteLength: this.expectedDraftByteLength,
      expectedDraftDocumentDigest: this.expectedDraftDocumentDigest,
      reviewVerdict: this.reviewVerdict,
      reviewDraftDigest: this.reviewDraftDigest,
      receiptId: this.receiptId,
    };
  }
}

export function createDraftCompletionConnector(facts) {
  return new DraftCompletionConnector(CONNECTOR_TOKEN, facts);
}

export function isDraftCompletionConnector(value) {
  return value instanceof DraftCompletionConnector;
}

/** Read only the cataloged coverage PASS evidence and its exact draft input. */
export function readCoveragePassDraftCompletionFacts({ flowManager, specId } = {}) {
  const draft = flowManager.readArtifact({
    specId, logicalKey: "draft", consumerNodeId: "draft-coverage-repair",
  });
  const review = flowManager.readArtifact({
    specId, logicalKey: "draft.coverage.review", consumerNodeId: "draft-coverage-repair",
  });
  const history = CanonicalCommandAttemptArtifactHistory.fromBytes({
    logicalKey: "draft.coverage.review", bytes: review.bytes,
  });
  const document = history.attempts.at(-1)?.payload ?? null;
  if (document === null) throw new Error("coverage review history has no current document");
  return new DraftCompletionFacts({
    source: "coverage-pass",
    sourceStepId: "draft-coverage-repair",
    targetStepId: "draft-gate",
    draft: JSON.parse(draft.bytes.toString("utf8")),
    draftDigest: draft.descriptor.hash,
    draftByteLength: draft.descriptor.size,
    reviewVerdict: document.verdict,
    reviewDraftDigest: document.sourceDraftRevision?.digest ?? null,
  });
}

export function draftCompletionDocumentDigest(draft) {
  return digest(jsonObject(draft, "draft completion document"));
}
