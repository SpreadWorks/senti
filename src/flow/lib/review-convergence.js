import crypto from "node:crypto";
import { resolveMaxAttempts, resolveToolingMaxAttempts } from "../definition.js";

export const REVIEW_EVIDENCE_VERSION = 1;
export const MAX_REVIEW_EVIDENCE_BYTES = 1024 * 1024;
export const MAX_REVIEW_FINDINGS = 100;
export const MAX_REVIEW_AUTHORED_STRING_CHARS = 4000;

const REVIEW_DISPOSITIONS = new Set(["PASS", "ADVISORY", "REJECTED"]);
const REVIEW_TOOLING_STAGES = new Set([
  "startup",
  "communication",
  "parse",
  "post_hook",
  "canonical_write",
  "projection",
  "result_recording",
]);
const REVIEW_NODE_ID_BY_PHASE = Object.freeze({
  "draft-questions": "draft-questions-review",
  "draft-coverage": "draft-coverage-review",
  spec: "spec-review",
  test: "test-review",
  impl: "impl-review",
});
const REVIEW_TOOLING_MAX_ATTEMPTS = 1;

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function requireString(value, field, { max = MAX_REVIEW_AUTHORED_STRING_CHARS } = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (value.length > max) throw new Error(`${field} exceeds ${max} characters`);
  return value.trim();
}

function requireNullableTaskId(value) {
  return value == null ? null : requireString(value, "taskId");
}

function requireTreeSha(value) {
  const treeSha = requireString(value, "treeSha").toLowerCase();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(treeSha)) {
    throw new Error("treeSha must be a lowercase SHA-1 or SHA-256 Git object id");
  }
  return treeSha;
}

function requireSha256(value, field) {
  const digest = requireString(value, field).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error(`${field} must be a lowercase SHA-256 string`);
  return digest;
}

function requireInteger(value, field, { min = 0 } = {}) {
  if (!Number.isSafeInteger(value) || value < min) {
    throw new Error(`${field} must be an integer greater than or equal to ${min}`);
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") throw new Error(`${field} must be a boolean`);
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function freezeArray(values) {
  return Object.freeze([...values]);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

function normalizeFindings(value, field) {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`);
  return freezeArray(value.map((entry) => (
    entry instanceof ReviewFinding ? entry : new ReviewFinding(entry)
  )));
}

function assertFindingBudget(blockingFindings, advisoryFindings) {
  if (blockingFindings.length + advisoryFindings.length > MAX_REVIEW_FINDINGS) {
    throw new Error(`review finding count exceeds ${MAX_REVIEW_FINDINGS}`);
  }
  const findings = [...blockingFindings, ...advisoryFindings];
  for (const field of ["findingId", "fingerprint"]) {
    const values = findings.map((finding) => finding[field]);
    if (new Set(values).size !== values.length) {
      throw new Error(`review findings contain duplicate ${field} values`);
    }
  }
}

export class ReviewFinding {
  constructor(input = {}) {
    requireObject(input, "review finding");
    this.findingId = requireString(input.findingId, "findingId");
    this.summary = requireString(input.summary, "summary");
    this.fingerprint = requireSha256(input.fingerprint, "fingerprint");
    if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length === 0) {
      throw new Error("evidenceRefs must be a non-empty array");
    }
    if (input.evidenceRefs.length > MAX_REVIEW_FINDINGS) {
      throw new Error(`evidenceRefs count exceeds ${MAX_REVIEW_FINDINGS}`);
    }
    this.evidenceRefs = freezeArray(input.evidenceRefs.map((value, index) => (
      requireString(value, `evidenceRefs[${index}]`)
    )));
    Object.freeze(this);
  }

  toJSON() {
    return {
      findingId: this.findingId,
      summary: this.summary,
      fingerprint: this.fingerprint,
      evidenceRefs: [...this.evidenceRefs],
    };
  }
}

export class ReviewDisposition {
  constructor({ value, blockingFindings = [], advisoryFindings = [] } = {}) {
    if (!REVIEW_DISPOSITIONS.has(value)) {
      throw new Error(`invalid review disposition: ${value}`);
    }
    this.value = value;
    this.blockingFindings = normalizeFindings(blockingFindings, "blockingFindings");
    this.advisoryFindings = normalizeFindings(advisoryFindings, "advisoryFindings");
    assertFindingBudget(this.blockingFindings, this.advisoryFindings);

    if (value === "PASS" && (this.blockingFindings.length > 0 || this.advisoryFindings.length > 0)) {
      throw new Error("PASS disposition cannot contain findings");
    }
    if (value === "ADVISORY" && (
      this.blockingFindings.length > 0 || this.advisoryFindings.length === 0
    )) {
      throw new Error("ADVISORY disposition requires advisory findings and no blocking findings");
    }
    if (value === "REJECTED" && this.blockingFindings.length === 0) {
      throw new Error("REJECTED disposition requires at least one blocking finding");
    }
    Object.freeze(this);
  }

  get findings() {
    return [...this.blockingFindings, ...this.advisoryFindings];
  }

  toJSON() {
    return {
      value: this.value,
      blockingFindings: this.blockingFindings.map((finding) => finding.toJSON()),
      advisoryFindings: this.advisoryFindings.map((finding) => finding.toJSON()),
    };
  }
}

export class ReviewProvenance {
  constructor(input = {}) {
    requireObject(input, "review provenance");
    this.provider = requireString(input.provider, "provenance.provider");
    this.invocationId = requireString(input.invocationId, "provenance.invocationId");
    this.capturedAt = requireString(input.capturedAt, "provenance.capturedAt");
    const capturedAtMs = Date.parse(this.capturedAt);
    if (!Number.isFinite(capturedAtMs)) throw new Error("provenance.capturedAt must be an ISO date-time");
    this.capturedAt = new Date(capturedAtMs).toISOString();
    Object.freeze(this);
  }

  toJSON() {
    return {
      provider: this.provider,
      invocationId: this.invocationId,
      capturedAt: this.capturedAt,
    };
  }
}

export class ReviewEvidenceIdentity {
  constructor({ phase, taskId = null, treeSha, provenance, evidenceDigest } = {}) {
    this.phase = requireString(phase, "phase");
    this.taskId = requireNullableTaskId(taskId);
    this.treeSha = requireTreeSha(treeSha);
    this.provenance = provenance instanceof ReviewProvenance
      ? provenance
      : new ReviewProvenance(provenance);
    this.evidenceDigest = requireSha256(evidenceDigest, "evidenceDigest");
    Object.freeze(this);
  }

  get duplicateKey() {
    return [this.phase, this.taskId ?? "", this.treeSha, this.evidenceDigest].join(":");
  }

  toJSON() {
    return {
      phase: this.phase,
      taskId: this.taskId,
      treeSha: this.treeSha,
      provenance: this.provenance.toJSON(),
      evidenceDigest: this.evidenceDigest,
    };
  }
}

export class ReviewRecoveryIdentity {
  constructor({ treeSha, targetStateDigest = null } = {}) {
    this.treeSha = requireTreeSha(treeSha);
    this.targetStateDigest = targetStateDigest == null
      ? null
      : requireSha256(targetStateDigest, "targetStateDigest");
    Object.freeze(this);
  }

  changedFrom(previous) {
    if (!(previous instanceof ReviewRecoveryIdentity)) {
      throw new Error("previous review recovery identity must be a ReviewRecoveryIdentity");
    }
    return this.treeSha !== previous.treeSha
      || (
        this.targetStateDigest != null
        && previous.targetStateDigest != null
        && this.targetStateDigest !== previous.targetStateDigest
      );
  }
}

export class ReviewTargetState {
  constructor({ digest, entries } = {}) {
    this.digest = requireSha256(digest, "review target state digest");
    if (!Array.isArray(entries)) throw new Error("review target state entries must be an array");
    const paths = new Set();
    this.entries = freezeArray(entries.map((entry, index) => {
      const path = requireString(entry?.path, `review target state entries[${index}].path`);
      if (paths.has(path)) throw new Error(`review target state entries contain duplicate path: ${path}`);
      paths.add(path);
      return Object.freeze({
        path,
        contentHash: requireSha256(entry?.contentHash, `review target state entries[${index}].contentHash`),
        mode: requireString(entry?.mode, `review target state entries[${index}].mode`),
      });
    }).sort((left, right) => left.path.localeCompare(right.path)));
    Object.freeze(this);
  }

  static fromRepairFingerprint(fingerprint) {
    return new ReviewTargetState({
      digest: fingerprint?.hash,
      entries: fingerprint?.entries,
    });
  }

  hasChangedEntryWithin(next, matchesPath) {
    if (!(next instanceof ReviewTargetState)) throw new Error("next review target state must be a ReviewTargetState");
    if (typeof matchesPath !== "function") throw new Error("review target-state path matcher is required");
    const nextByPath = new Map(next.entries.map((entry) => [entry.path, entry]));
    const previousByPath = new Map(this.entries.map((entry) => [entry.path, entry]));
    return this.entries.some((entry) => {
      const nextEntry = nextByPath.get(entry.path);
      return matchesPath(entry.path) && (
        nextEntry == null
        || nextEntry.contentHash !== entry.contentHash
        || nextEntry.mode !== entry.mode
      );
    }) || next.entries.some((entry) => matchesPath(entry.path) && !previousByPath.has(entry.path));
  }

  toJSON() {
    return {
      digest: this.digest,
      entries: this.entries.map((entry) => ({ ...entry })),
    };
  }
}

function canonicalEvidenceDocument({ phase, taskId, treeSha, provenance, disposition }) {
  return {
    version: REVIEW_EVIDENCE_VERSION,
    phase,
    taskId,
    treeSha,
    provenance: provenance.toJSON(),
    disposition: disposition.value,
    blockingFindings: disposition.blockingFindings.map((finding) => finding.toJSON()),
    advisoryFindings: disposition.advisoryFindings.map((finding) => finding.toJSON()),
  };
}

export class ReviewEvidence {
  constructor(input = {}) {
    requireObject(input, "review evidence");
    for (const callerOwnedField of ["identity", "evidenceDigest"]) {
      if (Object.hasOwn(input, callerOwnedField)) {
        throw new Error(`${callerOwnedField} is computed by the CLI and cannot be supplied by a caller`);
      }
    }
    if (input.version != null && input.version !== REVIEW_EVIDENCE_VERSION) {
      throw new Error(`review evidence version must be ${REVIEW_EVIDENCE_VERSION}`);
    }
    this.phase = requireString(input.phase, "phase");
    this.taskId = requireNullableTaskId(input.taskId);
    this.treeSha = requireTreeSha(input.treeSha);
    this.provenance = input.provenance instanceof ReviewProvenance
      ? input.provenance
      : new ReviewProvenance(input.provenance);
    if (!(input.disposition instanceof ReviewDisposition)) {
      throw new Error("disposition must be a ReviewDisposition");
    }
    this.disposition = input.disposition;
    this.canonicalDocument = deepFreeze(canonicalEvidenceDocument(this));
    this.canonicalText = stableStringify(this.canonicalDocument);
    if (Buffer.byteLength(this.canonicalText, "utf8") > MAX_REVIEW_EVIDENCE_BYTES) {
      throw new Error(`canonical review evidence exceeds ${MAX_REVIEW_EVIDENCE_BYTES} bytes`);
    }
    this.identity = new ReviewEvidenceIdentity({
      phase: this.phase,
      taskId: this.taskId,
      treeSha: this.treeSha,
      provenance: this.provenance,
      evidenceDigest: sha256(this.canonicalText),
    });
    Object.freeze(this);
  }

  get findings() {
    return this.disposition.findings;
  }

  toCanonicalJSON() {
    return structuredClone(this.canonicalDocument);
  }

  toJSON() {
    return {
      ...this.toCanonicalJSON(),
      identity: this.identity.toJSON(),
    };
  }
}

export class ReviewToolingOutcome {
  constructor({ stage, attempt, maxAttempts, reason, permissionRelated = false } = {}) {
    if (!REVIEW_TOOLING_STAGES.has(stage)) throw new Error(`invalid review tooling stage: ${stage}`);
    this.kind = "TOOLING_ERROR";
    this.stage = stage;
    this.attempt = requireInteger(attempt, "attempt", { min: 1 });
    this.maxAttempts = requireInteger(maxAttempts, "maxAttempts", { min: 1 });
    if (this.attempt > this.maxAttempts) throw new Error("tooling attempt exceeds maxAttempts");
    const normalizedReason = requireString(reason, "reason", { max: Number.MAX_SAFE_INTEGER });
    this.reason = normalizedReason.slice(0, MAX_REVIEW_AUTHORED_STRING_CHARS);
    this.permissionRelated = requireBoolean(permissionRelated, "permissionRelated");
    this.remainingAttempts = this.maxAttempts - this.attempt;
    Object.freeze(this);
  }

  toJSON() {
    return {
      kind: this.kind,
      stage: this.stage,
      attempt: this.attempt,
      maxAttempts: this.maxAttempts,
      remainingAttempts: this.remainingAttempts,
      reason: this.reason,
      permissionRelated: this.permissionRelated,
    };
  }
}

export class ReviewEvidenceReference {
  constructor(input = {}) {
    requireObject(input, "review evidence reference");
    this.evidenceId = requireString(
      input.evidenceId || input.evidenceRef || input.identity?.evidenceDigest,
      "evidenceId",
    );
    const disposition = input.disposition instanceof ReviewDisposition
      ? input.disposition.value
      : input.disposition;
    if (!REVIEW_DISPOSITIONS.has(disposition)) {
      throw new Error(`invalid referenced review disposition: ${disposition}`);
    }
    this.disposition = disposition;
    Object.freeze(this);
  }

  toJSON() {
    return { evidenceId: this.evidenceId, disposition: this.disposition };
  }
}

export class ReviewHandoffFinding {
  constructor(input = {}) {
    const value = input instanceof ReviewFinding
      ? input.toJSON()
      : structuredClone(requireObject(input, "handoff finding"));
    value.findingId = requireString(value.findingId, "handoff finding.findingId");
    deepFreeze(value);
    for (const [key, entry] of Object.entries(value)) this[key] = entry;
    Object.freeze(this);
  }

  toJSON() {
    return structuredClone(Object.fromEntries(Object.entries(this)));
  }
}

function normalizeHandoffFindings(value) {
  if (!Array.isArray(value)) throw new Error("handoffFindings must be an array");
  if (value.length > MAX_REVIEW_FINDINGS) {
    throw new Error(`handoff finding count exceeds ${MAX_REVIEW_FINDINGS}`);
  }
  return freezeArray(value.map((entry) => (
    entry instanceof ReviewHandoffFinding ? entry : new ReviewHandoffFinding(entry)
  )));
}

export class ReviewBlocker {
  constructor(input = {}) {
    requireObject(input, "review blocker");
    this.kind = requireString(input.kind, "blocker.kind");
    this.reason = requireString(input.reason, "blocker.reason");
    Object.freeze(this);
  }

  toJSON() {
    return { kind: this.kind, reason: this.reason };
  }
}

function normalizeEvidenceReference(value) {
  if (value == null) return null;
  if (value instanceof ReviewEvidence || value instanceof ReviewEvidenceReference) return value;
  return new ReviewEvidenceReference(value);
}

function dispositionValue(evidence) {
  if (evidence instanceof ReviewEvidence) return evidence.disposition.value;
  return evidence?.disposition ?? null;
}

export class ReviewConvergenceState {
  constructor(input = {}) {
    requireObject(input, "review convergence state");
    this.phase = requireString(input.phase, "phase");
    this.taskId = requireNullableTaskId(input.taskId);
    this.treeSha = requireTreeSha(input.treeSha);
    this.semanticAttempts = requireInteger(input.semanticAttempts, "semanticAttempts");
    this.semanticMaxAttempts = requireInteger(input.semanticMaxAttempts, "semanticMaxAttempts", { min: 1 });
    if (this.semanticAttempts > this.semanticMaxAttempts) {
      throw new Error("semanticAttempts exceeds semanticMaxAttempts");
    }
    this.toolingAttempts = requireInteger(input.toolingAttempts, "toolingAttempts");
    this.toolingMaxAttempts = requireInteger(input.toolingMaxAttempts, "toolingMaxAttempts", { min: 1 });
    if (this.toolingAttempts > this.toolingMaxAttempts) {
      throw new Error("toolingAttempts exceeds toolingMaxAttempts");
    }
    this.evidence = normalizeEvidenceReference(input.evidence);
    this.finalizedEvidenceAvailable = requireBoolean(
      input.finalizedEvidenceAvailable,
      "finalizedEvidenceAvailable",
    );
    this.handoffFindings = normalizeHandoffFindings(input.handoffFindings || []);
    this.blocker = input.blocker == null
      ? null
      : input.blocker instanceof ReviewBlocker ? input.blocker : new ReviewBlocker(input.blocker);
    this.toolingOutcome = input.toolingOutcome == null
      ? null
      : input.toolingOutcome instanceof ReviewToolingOutcome
        ? input.toolingOutcome
        : new ReviewToolingOutcome(input.toolingOutcome);
    Object.freeze(this);
  }

  get disposition() {
    return dispositionValue(this.evidence);
  }

  get remainingSemanticAttempts() {
    return this.semanticMaxAttempts - this.semanticAttempts;
  }

  get remainingToolingAttempts() {
    return this.toolingMaxAttempts - this.toolingAttempts;
  }

  toJSON() {
    return {
      phase: this.phase,
      taskId: this.taskId,
      treeSha: this.treeSha,
      semanticAttempts: this.semanticAttempts,
      semanticMaxAttempts: this.semanticMaxAttempts,
      toolingAttempts: this.toolingAttempts,
      toolingMaxAttempts: this.toolingMaxAttempts,
      evidence: this.evidence?.toJSON() ?? null,
      finalizedEvidenceAvailable: this.finalizedEvidenceAvailable,
      handoffFindings: this.handoffFindings.map((finding) => finding.toJSON()),
      blocker: this.blocker?.toJSON() ?? null,
      toolingOutcome: this.toolingOutcome?.toJSON() ?? null,
    };
  }
}

export class ReviewPermittedOperation {
  constructor({ state, handoffFindings = null, blocker = null } = {}) {
    if (new.target === ReviewPermittedOperation) throw new Error("ReviewPermittedOperation is abstract");
    if (!(state instanceof ReviewConvergenceState)) {
      throw new Error("state must be a ReviewConvergenceState");
    }
    if ((handoffFindings == null) === (blocker == null)) {
      throw new Error("review operation must expose exactly one of handoffFindings or blocker");
    }
    this.remainingSemanticAttempts = state.remainingSemanticAttempts;
    this.remainingToolingAttempts = state.remainingToolingAttempts;
    this.handoffFindings = handoffFindings == null ? null : normalizeHandoffFindings(handoffFindings);
    this.blocker = blocker == null
      ? null
      : blocker instanceof ReviewBlocker ? blocker : new ReviewBlocker(blocker);
    this.requiresApproval = false;
  }

  toJSON() {
    return {
      kind: this.kind,
      remainingSemanticAttempts: this.remainingSemanticAttempts,
      remainingToolingAttempts: this.remainingToolingAttempts,
      ...(this.handoffFindings == null
        ? { blocker: this.blocker.toJSON() }
        : { handoffFindings: this.handoffFindings.map((finding) => finding.toJSON()) }),
      requiresApproval: this.requiresApproval,
    };
  }
}

export class RetryReview extends ReviewPermittedOperation {
  constructor({ state, budgetKind, requiresChangedEvidence, blocker } = {}) {
    super({ state, blocker });
    if (budgetKind !== "semantic" && budgetKind !== "tooling") {
      throw new Error("retry review budgetKind must be semantic or tooling");
    }
    this.kind = "retry_review";
    this.budgetKind = budgetKind;
    this.requiresChangedEvidence = requireBoolean(requiresChangedEvidence, "requiresChangedEvidence");
    Object.freeze(this);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      budgetKind: this.budgetKind,
      requiresChangedEvidence: this.requiresChangedEvidence,
    };
  }
}

export class RegisterAlternativeEvidence extends ReviewPermittedOperation {
  constructor({ state, blocker } = {}) {
    super({ state, blocker });
    this.kind = "register_alternative_evidence";
    Object.freeze(this);
  }
}

export class MoveToAcceptance extends ReviewPermittedOperation {
  constructor({ state, handoffFindings = [] } = {}) {
    super({ state, handoffFindings });
    this.kind = "move_to_acceptance";
    Object.freeze(this);
  }
}

export class StopAsBlocker extends ReviewPermittedOperation {
  constructor({ state, blocker } = {}) {
    super({ state, blocker });
    if (!this.blocker) throw new Error("stop_as_blocker requires a blocker");
    this.kind = "stop_as_blocker";
    Object.freeze(this);
  }
}

function retryBlocker(state, budgetKind) {
  if (state.blocker) return state.blocker;
  if (budgetKind === "semantic") {
    return new ReviewBlocker({
      kind: "semantic_remediation_required",
      reason: "Blocking review findings require changed evidence before review can continue.",
    });
  }
  return new ReviewBlocker({
    kind: "tooling_retry_required",
    reason: "Review tooling failed and the bounded retry remains available.",
  });
}

function alternativeEvidenceBlocker(state) {
  return state.blocker || new ReviewBlocker({
    kind: "alternative_evidence_required",
    reason: "Finalized review evidence is available and its failed projection must be recovered without rerunning the reviewer.",
  });
}

export function resolveReviewPermittedOperation(state) {
  if (!(state instanceof ReviewConvergenceState)) {
    throw new Error("state must be a ReviewConvergenceState");
  }
  if (state.toolingOutcome) {
    if (state.finalizedEvidenceAvailable) {
      return new RegisterAlternativeEvidence({ state, blocker: alternativeEvidenceBlocker(state) });
    }
    if (state.remainingToolingAttempts > 0) {
      return new RetryReview({
        state,
        budgetKind: "tooling",
        requiresChangedEvidence: false,
        blocker: retryBlocker(state, "tooling"),
      });
    }
    return new StopAsBlocker({
      state,
      blocker: state.blocker || new ReviewBlocker({
        kind: "tooling_attempts_exhausted",
        reason: "Review tooling attempts are exhausted and no finalized evidence is available.",
      }),
    });
  }
  if (state.disposition === "PASS" || state.disposition === "ADVISORY") {
    return new MoveToAcceptance({ state, handoffFindings: state.handoffFindings });
  }
  if (state.disposition === "REJECTED") {
    if (state.remainingSemanticAttempts > 0) {
      return new RetryReview({
        state,
        budgetKind: "semantic",
        requiresChangedEvidence: true,
        blocker: retryBlocker(state, "semantic"),
      });
    }
    return new MoveToAcceptance({ state, handoffFindings: state.handoffFindings });
  }
  if (state.finalizedEvidenceAvailable) {
    return new RegisterAlternativeEvidence({ state, blocker: alternativeEvidenceBlocker(state) });
  }
  if (state.remainingToolingAttempts > 0) {
    return new RetryReview({
      state,
      budgetKind: "tooling",
      requiresChangedEvidence: false,
      blocker: retryBlocker(state, "tooling"),
    });
  }
  return new StopAsBlocker({
    state,
    blocker: state.blocker || new ReviewBlocker({
      kind: "tooling_attempts_exhausted",
      reason: "Review tooling attempts are exhausted and no finalized evidence is available.",
    }),
  });
}

export function nextReviewToolingOutcome(state, input = {}) {
  if (!(state instanceof ReviewConvergenceState)) {
    throw new Error("state must be a ReviewConvergenceState");
  }
  return new ReviewToolingOutcome({
    ...input,
    attempt: state.toolingOutcome == null ? 1 : state.toolingAttempts + 2,
    maxAttempts: state.toolingMaxAttempts + 1,
  });
}

export function canonicalizeReviewEvidence(evidence) {
  if (!(evidence instanceof ReviewEvidence)) throw new Error("ReviewEvidence is required");
  return evidence.canonicalText;
}

function targetMatches(record, { phase, taskId, treeSha = null }) {
  return record?.phase === phase
    && (record.taskId ?? null) === (taskId ?? null)
    && (treeSha == null || record.treeSha === treeSha);
}

function convergenceRecords(flowState) {
  const records = flowState?.reviewConvergence?.records;
  return Array.isArray(records) ? records : [];
}

function semanticMaxAttempts(flowState, phase, taskId) {
  const scope = taskId == null ? "flow" : "task";
  const stepId = taskId == null ? REVIEW_NODE_ID_BY_PHASE[phase] : "task-review";
  if (!stepId) throw new Error(`unknown review phase: ${phase}`);
  return resolveMaxAttempts({ scope, stepId, context: flowState }) ?? 1;
}

function toolingMaxAttempts(flowState, phase, taskId) {
  const scope = taskId == null ? "flow" : "task";
  const stepId = taskId == null ? REVIEW_NODE_ID_BY_PHASE[phase] : "task-review";
  if (!stepId) throw new Error(`unknown review phase: ${phase}`);
  return resolveToolingMaxAttempts({ scope, stepId, context: flowState })
    ?? REVIEW_TOOLING_MAX_ATTEMPTS;
}

function emptyConvergenceState(flowState, target) {
  return new ReviewConvergenceState({
    phase: target.phase,
    taskId: target.taskId ?? null,
    treeSha: target.treeSha,
    semanticAttempts: 0,
    semanticMaxAttempts: semanticMaxAttempts(flowState, target.phase, target.taskId ?? null),
    toolingAttempts: 0,
    toolingMaxAttempts: toolingMaxAttempts(flowState, target.phase, target.taskId ?? null),
    evidence: null,
    finalizedEvidenceAvailable: false,
    handoffFindings: [],
    blocker: null,
    toolingOutcome: null,
  });
}

function storedConvergenceState(record) {
  return new ReviewConvergenceState(record);
}

function convergenceStateForTargetDigest(record, targetStateDigest) {
  const stored = storedConvergenceState(record);
  if (targetStateDigest == null || record.targetStateDigest === targetStateDigest) return stored;
  return new ReviewConvergenceState({
    ...stored.toJSON(),
    evidence: null,
    finalizedEvidenceAvailable: false,
    handoffFindings: [],
    blocker: stored.toolingOutcome ? stored.blocker : null,
  });
}

function replaceTargetRecord(flowState, target, record) {
  const records = convergenceRecords(flowState);
  const index = records.findIndex((entry) => targetMatches(entry, target));
  const nextRecords = records.map((entry) => structuredClone(entry));
  if (index === -1) nextRecords.push(record);
  else nextRecords[index] = record;
  flowState.reviewConvergence = { version: 1, records: nextRecords };
}

class ReviewRecoveryMutation {
  constructor(input = {}) {
    this.phase = requireString(input.phase, "phase");
    this.taskId = requireNullableTaskId(input.taskId);
    this.previousIdentity = new ReviewRecoveryIdentity({
      treeSha: input.previousTreeSha,
      targetStateDigest: input.previousTargetStateDigest,
    });
    this.nextIdentity = new ReviewRecoveryIdentity({
      treeSha: input.nextTreeSha,
      targetStateDigest: input.nextTargetStateDigest,
    });
    this.nextTargetState = input.nextTargetState == null
      ? null
      : new ReviewTargetState(input.nextTargetState);
    if (
      this.nextTargetState != null
      && this.nextIdentity.targetStateDigest !== this.nextTargetState.digest
    ) {
      throw new Error("review recovery next target state does not match its identity");
    }
    this.previousTreeSha = this.previousIdentity.treeSha;
    this.nextTreeSha = this.nextIdentity.treeSha;
    this.expectedRunId = requireString(input.expectedRunId, "expectedRunId");
    this.expectedSpec = requireString(input.expectedSpec, "expectedSpec");
    this.expectedHasIssue = Object.hasOwn(input, "expectedIssue");
    this.expectedIssue = input.expectedIssue;
  }

  readCurrent(flowState) {
    requireObject(flowState, "flow state");
    if (
      flowState.runId !== this.expectedRunId
      || flowState.spec !== this.expectedSpec
      || Object.hasOwn(flowState, "issue") !== this.expectedHasIssue
      || (this.expectedHasIssue && flowState.issue !== this.expectedIssue)
    ) {
      throw new Error("review tooling recovery target guard mismatch");
    }
    if (!this.nextIdentity.changedFrom(this.previousIdentity)) {
      throw new Error("review recovery requires a changed tree or target-state identity");
    }

    const target = {
      phase: this.phase,
      taskId: this.taskId,
      treeSha: this.previousTreeSha,
    };
    const records = convergenceRecords(flowState);
    const index = records.findIndex((record) => targetMatches(record, target));
    if (index === -1) {
      throw new Error("review recovery previous target no longer exists");
    }
    if (
      this.previousIdentity.targetStateDigest != null
      && records[index].targetStateDigest !== this.previousIdentity.targetStateDigest
    ) {
      throw new Error("review recovery target-state identity no longer matches");
    }
    const current = storedConvergenceState(records[index]);
    return { records, index, current };
  }

  replace(flowState, records, index, recovered) {
    const nextRecords = records.map((record) => structuredClone(record));
    nextRecords[index] = {
      ...structuredClone(records[index]),
      ...recovered.toJSON(),
      ...(this.nextIdentity.targetStateDigest != null && {
        targetStateDigest: this.nextIdentity.targetStateDigest,
      }),
      ...(this.nextTargetState != null && { targetState: this.nextTargetState.toJSON() }),
    };
    flowState.reviewConvergence = {
      ...structuredClone(flowState.reviewConvergence),
      version: 1,
      records: nextRecords,
    };
    return recovered;
  }
}

export class ReviewToolingRecoveryMutation extends ReviewRecoveryMutation {
  constructor(input = {}) {
    super(input);
    Object.freeze(this);
  }

  apply(flowState) {
    const { records, index, current } = this.readCurrent(flowState);
    if (current.toolingMaxAttempts !== REVIEW_TOOLING_MAX_ATTEMPTS) {
      throw new Error(`review tooling recovery requires toolingMaxAttempts=${REVIEW_TOOLING_MAX_ATTEMPTS}`);
    }
    if (current.toolingAttempts !== current.toolingMaxAttempts) {
      throw new Error("review tooling recovery requires an exhausted tooling attempt");
    }

    const recovered = new ReviewConvergenceState({
      ...current.toJSON(),
      treeSha: this.nextTreeSha,
      toolingAttempts: 0,
    });
    return this.replace(flowState, records, index, recovered);
  }
}

export class ReviewSemanticRecoveryMutation extends ReviewRecoveryMutation {
  constructor(input = {}) {
    super(input);
    Object.freeze(this);
  }

  apply(flowState) {
    const { records, index, current } = this.readCurrent(flowState);
    if (current.disposition !== "REJECTED") {
      throw new Error("review semantic recovery requires rejected evidence");
    }
    if (current.semanticAttempts !== current.semanticMaxAttempts) {
      throw new Error("review semantic recovery requires exhausted semantic attempts");
    }
    const recovered = new ReviewConvergenceState({
      ...current.toJSON(),
      treeSha: this.nextTreeSha,
      semanticAttempts: current.semanticMaxAttempts - 1,
      toolingAttempts: 0,
      evidence: null,
      finalizedEvidenceAvailable: false,
      handoffFindings: [],
      blocker: null,
      toolingOutcome: null,
    });
    return this.replace(flowState, records, index, recovered);
  }
}

export function buildReviewHandoffFindings(evidence, { sourceStep = null } = {}) {
  if (!(evidence instanceof ReviewEvidence)) throw new Error("ReviewEvidence is required");
  if (evidence.disposition.value === "PASS") return [];
  const resolvedSourceStep = sourceStep || sourceStepForTarget(evidence);
  return evidence.findings.map((finding) => new ReviewHandoffFinding({
    ...finding.toJSON(),
    sourceStep: resolvedSourceStep,
    phase: evidence.phase,
    taskId: evidence.taskId,
    treeSha: evidence.treeSha,
    provenance: evidence.provenance.toJSON(),
    canonicalEvidenceRef: `review-evidence/${evidence.identity.evidenceDigest}.json`,
    evidenceDigest: evidence.identity.evidenceDigest,
    reviewDisposition: evidence.disposition.value,
    finalDispositionOwner: "acceptance-review",
  }));
}

function sourceStepForTarget({ phase, taskId }) {
  if (taskId != null) return "task-review";
  return REVIEW_NODE_ID_BY_PHASE[phase] || `${phase}-review`;
}

function evidenceDigests(record) {
  return new Set([
    record?.evidence?.evidenceId,
    record?.evidenceIdentity?.evidenceDigest,
    ...(Array.isArray(record?.evidenceHistory)
      ? record.evidenceHistory.map((entry) => entry?.evidenceDigest || entry)
      : []),
  ].filter(Boolean));
}

function nextEvidenceHistory(record, evidence) {
  const history = Array.isArray(record?.evidenceHistory)
    ? record.evidenceHistory.map((entry) => structuredClone(entry))
    : [];
  if (record?.evidenceIdentity && !history.some((entry) => (
    entry.evidenceDigest === record.evidenceIdentity.evidenceDigest
  ))) {
    history.push(structuredClone(record.evidenceIdentity));
  }
  if (!history.some((entry) => entry.evidenceDigest === evidence.identity.evidenceDigest)) {
    history.push(evidence.identity.toJSON());
  }
  return history;
}

export function applyReviewEvidenceTransition(
  flowState,
  evidence,
  { configuredSemanticMaxAttempts = null, provider = null, targetStateDigest = null, targetState = null } = {},
) {
  if (!(evidence instanceof ReviewEvidence)) throw new Error("evidence must be ReviewEvidence");
  const target = {
    phase: evidence.phase,
    taskId: evidence.taskId,
    treeSha: evidence.treeSha,
  };
  const records = convergenceRecords(flowState);
  const normalizedTargetStateDigest = targetStateDigest == null
    ? null
    : requireSha256(targetStateDigest, "targetStateDigest");
  const normalizedTargetState = targetState == null ? null : new ReviewTargetState(targetState);
  if (normalizedTargetState && normalizedTargetState.digest !== normalizedTargetStateDigest) {
    throw new Error("review target state digest does not match targetStateDigest");
  }
  if (records.some((entry) => evidenceDigests(entry).has(evidence.identity.evidenceDigest))) {
    const error = new Error("duplicate review evidence identity");
    error.code = "REVIEW_DUPLICATE_IDENTITY";
    throw error;
  }
  const existingRecord = records.find((entry) => targetMatches(entry, target));
  const existingMatchesTargetState = existingRecord && (
    normalizedTargetStateDigest == null
    || existingRecord.targetStateDigest === normalizedTargetStateDigest
  );
  const current = existingRecord
    ? storedConvergenceState(existingRecord)
    : configuredSemanticMaxAttempts == null
      ? emptyConvergenceState(flowState, target)
      : new ReviewConvergenceState({
          phase: target.phase,
          taskId: target.taskId,
          treeSha: target.treeSha,
          semanticAttempts: 0,
          semanticMaxAttempts: configuredSemanticMaxAttempts,
          toolingAttempts: 0,
          toolingMaxAttempts: REVIEW_TOOLING_MAX_ATTEMPTS,
          evidence: null,
          finalizedEvidenceAvailable: false,
          handoffFindings: [],
          blocker: null,
          toolingOutcome: null,
        });
  if (
    existingMatchesTargetState
    && (current.disposition === "PASS" || current.disposition === "ADVISORY")
  ) {
    const error = new Error("review is already completed for this target");
    error.code = "REVIEW_ALREADY_COMPLETED";
    throw error;
  }
  const semanticAttempts = current.semanticAttempts
    + (evidence.disposition.value === "REJECTED" ? 1 : 0);
  if (semanticAttempts > current.semanticMaxAttempts) {
    const error = new Error("review semantic attempt budget is exhausted for this target");
    error.code = "REVIEW_SEMANTIC_ATTEMPTS_EXHAUSTED";
    throw error;
  }
  const persisted = new ReviewConvergenceState({
    ...current.toJSON(),
    semanticAttempts,
    evidence: new ReviewEvidenceReference({
      evidenceId: evidence.identity.evidenceDigest,
      disposition: evidence.disposition,
    }),
    finalizedEvidenceAvailable: true,
    handoffFindings: buildReviewHandoffFindings(evidence),
    blocker: null,
    toolingOutcome: null,
  });
  replaceTargetRecord(flowState, target, {
    ...persisted.toJSON(),
    provider: provider == null ? evidence.provenance.provider : requireString(provider, "provider"),
    evidenceIdentity: evidence.identity.toJSON(),
    evidenceHistory: nextEvidenceHistory(existingRecord, evidence),
    canonicalEvidenceRef: `review-evidence/${evidence.identity.evidenceDigest}.json`,
    ...(normalizedTargetStateDigest && { targetStateDigest: normalizedTargetStateDigest }),
    ...(normalizedTargetState && { targetState: normalizedTargetState.toJSON() }),
  });
  return persisted;
}

export class ReviewConvergenceStore {
  constructor({ flowManager } = {}) {
    if (!flowManager || typeof flowManager.load !== "function" || typeof flowManager.mutate !== "function") {
      throw new Error("flowManager with load and mutate is required");
    }
    this.flowManager = flowManager;
    Object.freeze(this);
  }

  read({ phase, taskId = null, treeSha, targetStateDigest = null } = {}) {
    const target = {
      phase: requireString(phase, "phase"),
      taskId: requireNullableTaskId(taskId),
      treeSha: requireTreeSha(treeSha),
    };
    const flowState = typeof this.flowManager.loadReadOnly === "function"
      ? this.flowManager.loadReadOnly()
      : this.flowManager.load();
    const normalizedTargetStateDigest = targetStateDigest == null
      ? null
      : requireSha256(targetStateDigest, "targetStateDigest");
    const record = convergenceRecords(flowState).find((entry) => targetMatches(entry, target));
    return record
      ? convergenceStateForTargetDigest(record, normalizedTargetStateDigest)
      : emptyConvergenceState(flowState, target);
  }

  recordToolingOutcome({
    phase,
    taskId = null,
    treeSha,
    provider,
    outcome,
    evidence = null,
    canonicalEvidencePersisted = false,
    finalizedEvidenceAvailable = false,
    targetStateDigest = null,
    expectedOriginal = null,
  } = {}) {
    if (!(outcome instanceof ReviewToolingOutcome)) {
      throw new Error("outcome must be a ReviewToolingOutcome");
    }
    const target = {
      phase: requireString(phase, "phase"),
      taskId: requireNullableTaskId(taskId),
      treeSha: requireTreeSha(treeSha),
    };
    const normalizedProvider = requireString(provider, "provider");
    const normalizedTargetStateDigest = targetStateDigest == null
      ? null
      : requireSha256(targetStateDigest, "targetStateDigest");
    if (evidence != null && !(evidence instanceof ReviewEvidence)) {
      throw new Error("evidence must be a ReviewEvidence");
    }
    if (evidence && !targetMatches(evidence.identity, target)) {
      throw new Error("review tooling evidence does not match the tooling target");
    }
    if (canonicalEvidencePersisted && !evidence) {
      throw new Error("canonicalEvidencePersisted requires review evidence");
    }
    if (typeof finalizedEvidenceAvailable !== "boolean") {
      throw new Error("finalizedEvidenceAvailable must be a boolean");
    }
    let persisted;
    this.flowManager.mutate((flowState) => {
      const existingRecord = convergenceRecords(flowState).find((entry) => targetMatches(entry, target));
      const existingMatchesTargetState = existingRecord && (
        normalizedTargetStateDigest == null
        || existingRecord.targetStateDigest === normalizedTargetStateDigest
      );
      const current = existingRecord
        ? convergenceStateForTargetDigest(existingRecord, normalizedTargetStateDigest)
        : emptyConvergenceState(flowState, target);
      if (current.toolingOutcome && current.toolingAttempts >= current.toolingMaxAttempts) {
        throw new Error("review tooling attempt budget is exhausted for this target");
      }
      const expectedOutcome = nextReviewToolingOutcome(current, outcome);
      if (
        outcome.attempt !== expectedOutcome.attempt
        || outcome.maxAttempts !== expectedOutcome.maxAttempts
      ) {
        throw new Error(
          `review tooling attempt must be ${expectedOutcome.attempt}/${expectedOutcome.maxAttempts}`,
        );
      }
      if (canonicalEvidencePersisted && convergenceRecords(flowState).some((entry) => (
        evidenceDigests(entry).has(evidence.identity.evidenceDigest)
      ))) {
        throw new Error("duplicate review evidence identity");
      }
      persisted = new ReviewConvergenceState({
        ...current.toJSON(),
        semanticAttempts: current.semanticAttempts,
        toolingAttempts: Math.max(0, outcome.attempt - 1),
        evidence: canonicalEvidencePersisted
          ? new ReviewEvidenceReference({
              evidenceId: evidence.identity.evidenceDigest,
              disposition: evidence.disposition,
            })
          : current.evidence,
        finalizedEvidenceAvailable: Boolean(evidence) || finalizedEvidenceAvailable,
        handoffFindings: canonicalEvidencePersisted
          ? buildReviewHandoffFindings(evidence)
          : current.handoffFindings,
        toolingOutcome: outcome,
        blocker: evidence ? null : {
          kind: outcome.permissionRelated ? "provider_permission" : "tooling_attempts_exhausted",
          reason: outcome.reason,
        },
      });
      replaceTargetRecord(flowState, target, {
        ...(existingRecord ? structuredClone(existingRecord) : {}),
        ...persisted.toJSON(),
        provider: normalizedProvider,
        ...(canonicalEvidencePersisted ? {
          evidenceIdentity: evidence.identity.toJSON(),
          evidenceHistory: nextEvidenceHistory(existingRecord, evidence),
          canonicalEvidenceRef: `review-evidence/${evidence.identity.evidenceDigest}.json`,
        } : {}),
        updatedAt: new Date().toISOString(),
        ...(normalizedTargetStateDigest && { targetStateDigest: normalizedTargetStateDigest }),
      });
    }, expectedOriginal == null ? {} : { expectedOriginal });
    return persisted;
  }

  recordEvidence({
    evidence,
    provider = null,
    targetStateDigest = null,
    targetState = null,
    expectedOriginal = null,
  } = {}) {
    if (!(evidence instanceof ReviewEvidence)) throw new Error("evidence must be ReviewEvidence");
    let persisted;
    this.flowManager.mutate((flowState) => {
      persisted = applyReviewEvidenceTransition(flowState, evidence, {
        provider,
        targetStateDigest,
        targetState,
      });
    }, expectedOriginal == null ? {} : { expectedOriginal });
    return persisted;
  }
}

export function resolveReviewActionForFlowState(
  flowState,
  { phase, taskId = null, resolveTreeSha } = {},
) {
  const scopedRecords = convergenceRecords(flowState).filter((entry) => (
    entry.phase === phase && (entry.taskId ?? null) === (taskId ?? null)
  ));
  if (scopedRecords.length === 0) return null;
  if (resolveTreeSha == null) {
    const state = storedConvergenceState(scopedRecords[scopedRecords.length - 1]);
    return resolveReviewPermittedOperation(state).toJSON();
  }
  if (typeof resolveTreeSha !== "function") {
    throw new Error("resolveTreeSha is required for a persisted review target");
  }
  const treeSha = requireTreeSha(resolveTreeSha());
  const matches = scopedRecords.filter((entry) => targetMatches(entry, {
    phase,
    taskId,
    treeSha,
  }));
  if (matches.length === 0) return null;
  const state = storedConvergenceState(matches[matches.length - 1]);
  return resolveReviewPermittedOperation(state).toJSON();
}
