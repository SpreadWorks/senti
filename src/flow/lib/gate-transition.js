/** Read-only typed facts for the definition-owned Gate transition boundary. */

const GATE_PHASES = new Set(["draft", "spec", "task-spec", "task-impl", "integration"]);
const GATE_SCOPES = new Set(["flow", "task"]);
const GATE_RESULTS = new Set(["pass", "fail", "recovered"]);
const FAILURE_CATEGORIES = new Set(["semantic", "tooling"]);
const RECOVERY_KINDS = new Set(["none", "repair", "defer", "recovered"]);

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function optionalText(value, field) {
  return value == null ? null : requiredText(value, field);
}

function nonNegativeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  return value;
}

function positiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${field} must be a positive integer`);
  return value;
}

function requireObject(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

/** The identity assigned by the canonical store to a producer Attempt. */
export class GateAttemptIdentity {
  constructor({ id, sequence } = {}) {
    this.id = requiredText(id, "gate Attempt id");
    this.sequence = positiveInteger(sequence, "gate Attempt sequence");
    Object.freeze(this);
  }

  matches(other) {
    return other instanceof GateAttemptIdentity
      && this.id === other.id
      && this.sequence === other.sequence;
  }

  toJSON() { return { id: this.id, sequence: this.sequence }; }
}

/** Immutable catalog publication tied to the producer Attempt that created it. */
export class GateCatalogPublication {
  constructor({ attemptId, sequence, producerActivityId, artifactId, fingerprint } = {}) {
    this.attempt = new GateAttemptIdentity({ id: attemptId, sequence });
    this.producerActivityId = requiredText(producerActivityId, "gate catalog producer activityId");
    this.artifactId = requiredText(artifactId, "gate catalog artifactId");
    this.fingerprint = requiredText(fingerprint, "gate catalog fingerprint");
    Object.freeze(this);
  }

  toJSON() {
    return {
      attemptId: this.attempt.id,
      sequence: this.attempt.sequence,
      producerActivityId: this.producerActivityId,
      artifactId: this.artifactId,
      fingerprint: this.fingerprint,
    };
  }
}

/** A category intentionally separates semantic gate rejection from tooling failure. */
export class GateFailureCategory {
  constructor({ category, code = null } = {}) {
    this.category = requiredText(category, "gate failure category");
    if (!FAILURE_CATEGORIES.has(this.category)) throw new Error("gate failure category is invalid");
    this.code = optionalText(code, "gate failure code");
    Object.freeze(this);
  }

  toJSON() { return { category: this.category, code: this.code }; }
}

/**
 * Links source evidence, the canonical result, and repair evidence to one
 * stable producer revision. Both identities and fingerprints are mandatory
 * so unavailable lineage fails at the boundary instead of becoming current.
 */
export class GateLineage {
  constructor({ sourceAttempt, canonicalAttempt, sourceFingerprint, canonicalFingerprint } = {}) {
    this.sourceAttempt = sourceAttempt instanceof GateAttemptIdentity ? sourceAttempt : new GateAttemptIdentity(sourceAttempt);
    this.canonicalAttempt = canonicalAttempt instanceof GateAttemptIdentity
      ? canonicalAttempt
      : new GateAttemptIdentity(canonicalAttempt);
    this.sourceFingerprint = requiredText(sourceFingerprint, "gate source fingerprint");
    this.canonicalFingerprint = requiredText(canonicalFingerprint, "gate canonical fingerprint");
    Object.freeze(this);
  }

  get isCurrent() {
    return this.sourceAttempt.matches(this.canonicalAttempt)
      && this.sourceFingerprint === this.canonicalFingerprint;
  }

  toJSON() {
    return {
      sourceAttempt: this.sourceAttempt.toJSON(),
      canonicalAttempt: this.canonicalAttempt.toJSON(),
      sourceFingerprint: this.sourceFingerprint,
      canonicalFingerprint: this.canonicalFingerprint,
    };
  }
}

/** Evidence already persisted by a recovery producer; it never authorizes an ad-hoc route. */
export class GateRecoveryEvidence {
  constructor({ kind = "none", attempt = null, fingerprint = null } = {}) {
    this.kind = requiredText(kind, "gate recovery evidence kind");
    if (!RECOVERY_KINDS.has(this.kind)) throw new Error("gate recovery evidence kind is invalid");
    this.attempt = attempt == null ? null : (attempt instanceof GateAttemptIdentity ? attempt : new GateAttemptIdentity(attempt));
    this.fingerprint = optionalText(fingerprint, "gate recovery evidence fingerprint");
    if (this.kind === "none" && (this.attempt !== null || this.fingerprint !== null)) {
      throw new Error("empty gate recovery evidence must not carry a binding");
    }
    if (this.kind !== "none" && (this.attempt === null || this.fingerprint === null)) {
      throw new Error("gate recovery evidence requires Attempt and fingerprint binding");
    }
    Object.freeze(this);
  }

  isBoundTo(lineage) {
    if (!(lineage instanceof GateLineage)) throw new Error("gate recovery lineage must be typed");
    return this.attempt === null || (this.attempt.matches(lineage.canonicalAttempt)
      && this.fingerprint === lineage.canonicalFingerprint);
  }

  toJSON() { return { kind: this.kind, attempt: this.attempt?.toJSON() ?? null, fingerprint: this.fingerprint }; }
}

/** Reset-aware retry facts are computed by the state reader, never by commands. */
export class GateRetryMetrics {
  constructor({ used = 0, maximum } = {}) {
    this.used = nonNegativeInteger(used, "gate retry metrics used");
    this.maximum = positiveInteger(maximum, "gate retry metrics maximum");
    Object.freeze(this);
  }

  get remaining() { return Math.max(0, this.maximum - this.used); }
  get exhausted() { return this.used >= this.maximum; }
  toJSON() { return { used: this.used, maximum: this.maximum, remaining: this.remaining }; }
}

/** Persisted producer ownership prevents a consumer from claiming another gate's result. */
export class GateProducerOwnership {
  constructor({ runId, specId, activityId, phase, scope, taskId = null, stepId } = {}) {
    this.runId = requiredText(runId, "gate producer runId");
    this.specId = requiredText(specId, "gate producer specId");
    this.activityId = requiredText(activityId, "gate producer activityId");
    this.phase = requiredText(phase, "gate producer phase");
    if (!GATE_PHASES.has(this.phase)) throw new Error("gate producer phase is invalid");
    this.scope = requiredText(scope, "gate producer scope");
    if (!GATE_SCOPES.has(this.scope)) throw new Error("gate producer scope is invalid");
    this.taskId = optionalText(taskId, "gate producer taskId");
    if ((this.scope === "task") !== (this.taskId !== null)) {
      throw new Error("gate producer task scope requires exactly one taskId binding");
    }
    this.stepId = requiredText(stepId, "gate producer stepId");
    Object.freeze(this);
  }
  toJSON() {
    return {
      runId: this.runId,
      specId: this.specId,
      activityId: this.activityId,
      phase: this.phase,
      scope: this.scope,
      taskId: this.taskId,
      stepId: this.stepId,
    };
  }
}

/** Target binding is durable evidence that this exact Attempt owned the selected leaf. */
export class GateTargetBinding {
  constructor({ runId, specId, taskId = null, stepId, attempt } = {}) {
    this.runId = requiredText(runId, "gate target runId");
    this.specId = requiredText(specId, "gate target specId");
    this.taskId = optionalText(taskId, "gate target taskId");
    this.stepId = requiredText(stepId, "gate target stepId");
    this.attempt = attempt instanceof GateAttemptIdentity ? attempt : new GateAttemptIdentity(attempt);
    Object.freeze(this);
  }
  toJSON() {
    return {
      runId: this.runId,
      specId: this.specId,
      taskId: this.taskId,
      stepId: this.stepId,
      attempt: this.attempt.toJSON(),
    };
  }
}

/** Complete input contract for a definition-owned Gate decision. */
export class GateTransitionFacts {
  constructor({
    phase,
    scope = "flow",
    producer,
    target,
    currentAttempt,
    catalogPublication,
    result,
    failure = null,
    retry,
    lineage,
    recoveryEvidence = {},
  } = {}) {
    this.phase = requiredText(phase, "gate phase");
    if (!GATE_PHASES.has(this.phase)) throw new Error("gate phase is invalid");
    this.scope = requiredText(scope, "gate scope");
    if (!GATE_SCOPES.has(this.scope)) throw new Error("gate scope is invalid");
    this.producer = producer instanceof GateProducerOwnership ? producer : new GateProducerOwnership(producer);
    this.currentAttempt = currentAttempt instanceof GateAttemptIdentity ? currentAttempt : new GateAttemptIdentity(currentAttempt);
    this.target = target instanceof GateTargetBinding ? target : new GateTargetBinding(target);
    this.catalogPublication = catalogPublication instanceof GateCatalogPublication
      ? catalogPublication
      : new GateCatalogPublication(catalogPublication);
    this.result = requiredText(result, "gate result");
    if (!GATE_RESULTS.has(this.result)) throw new Error("gate result is invalid");
    this.failure = failure == null ? null : (failure instanceof GateFailureCategory ? failure : new GateFailureCategory(failure));
    if ((this.result === "fail") !== (this.failure !== null)) {
      throw new Error("gate failure facts must accompany exactly a failed result");
    }
    this.retry = retry instanceof GateRetryMetrics ? retry : new GateRetryMetrics(retry);
    this.lineage = lineage instanceof GateLineage ? lineage : new GateLineage(lineage);
    this.recoveryEvidence = recoveryEvidence instanceof GateRecoveryEvidence
      ? recoveryEvidence
      : new GateRecoveryEvidence(recoveryEvidence);
    if ((this.result === "recovered") !== (this.recoveryEvidence.kind === "recovered")) {
      throw new Error("recovered gate result requires matching recovery evidence");
    }
    if (["repair", "defer"].includes(this.recoveryEvidence.kind) && this.failure?.category !== "semantic") {
      throw new Error("gate repair or defer evidence requires a semantic failure");
    }
    Object.freeze(this);
  }

  get integrityFailure() {
    if (this.producer.phase !== this.phase || this.producer.scope !== this.scope) return "producer_ownership_mismatch";
    if (this.producer.runId !== this.target.runId || this.producer.specId !== this.target.specId) {
      return "target_binding_mismatch";
    }
    if (this.producer.taskId !== this.target.taskId) return "target_task_mismatch";
    if (!this.currentAttempt.matches(this.target.attempt)) return "target_attempt_mismatch";
    if (this.producer.stepId !== this.target.stepId) return "producer_target_mismatch";
    if (this.producer.activityId !== this.catalogPublication.producerActivityId) {
      return "catalog_producer_mismatch";
    }
    if (!this.currentAttempt.matches(this.catalogPublication.attempt)) return "attempt_catalog_mismatch";
    if (this.catalogPublication.fingerprint !== this.lineage.canonicalFingerprint) {
      return "catalog_lineage_mismatch";
    }
    if (!this.currentAttempt.matches(this.lineage.canonicalAttempt)) return "attempt_lineage_mismatch";
    if (!this.lineage.isCurrent) return "source_canonical_lineage_mismatch";
    if (!this.recoveryEvidence.isBoundTo(this.lineage)) return "recovery_lineage_mismatch";
    return null;
  }

  /** Read a JSON-safe canonical-store fixture; no singleton or caller cache is trusted. */
  static fromPersisted(value) {
    requireObject(value, "persisted gate transition facts");
    return new GateTransitionFacts(value);
  }

  toJSON() {
    return {
      phase: this.phase, scope: this.scope, producer: this.producer.toJSON(), target: this.target.toJSON(),
      currentAttempt: this.currentAttempt.toJSON(), catalogPublication: this.catalogPublication.toJSON(),
      result: this.result, failure: this.failure?.toJSON() ?? null, retry: this.retry.toJSON(),
      lineage: this.lineage.toJSON(), recoveryEvidence: this.recoveryEvidence.toJSON(),
    };
  }
}
