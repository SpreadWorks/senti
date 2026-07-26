import crypto from "node:crypto";

const GIT_OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SHA256 = /^[a-f0-9]{64}$/;
const PHASES = Object.freeze([
  "DIRECT_SELECTED",
  "DIRECT_HANDOFF_PREFLIGHT",
  "DIRECT_FIX",
  "DIRECT_VERIFY",
  "MERGE_ONLY_FINALIZE",
  "DIRECT_RECONCILE",
  "COMPLETED_DIRECT",
  "SUSPENDED",
  "ABORTED",
]);
const TERMINAL_PHASES = new Set(["COMPLETED_DIRECT", "ABORTED"]);
const TRANSITIONS = Object.freeze({
  DIRECT_SELECTED: new Set(["DIRECT_HANDOFF_PREFLIGHT", "DIRECT_RECONCILE", "SUSPENDED", "ABORTED"]),
  DIRECT_HANDOFF_PREFLIGHT: new Set(["DIRECT_FIX", "DIRECT_RECONCILE", "SUSPENDED", "ABORTED"]),
  DIRECT_FIX: new Set(["DIRECT_VERIFY", "SUSPENDED", "ABORTED"]),
  DIRECT_VERIFY: new Set(["DIRECT_FIX", "MERGE_ONLY_FINALIZE", "SUSPENDED", "ABORTED"]),
  MERGE_ONLY_FINALIZE: new Set(["COMPLETED_DIRECT", "SUSPENDED", "ABORTED"]),
  DIRECT_RECONCILE: new Set(["COMPLETED_DIRECT", "SUSPENDED", "ABORTED"]),
  SUSPENDED: new Set([
    "DIRECT_HANDOFF_PREFLIGHT",
    "DIRECT_FIX",
    "DIRECT_VERIFY",
    "MERGE_ONLY_FINALIZE",
    "DIRECT_RECONCILE",
    "ABORTED",
  ]),
  COMPLETED_DIRECT: new Set(),
  ABORTED: new Set(),
});

function requireString(value, field, max = 2000) {
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

function nullableIssue(value) {
  if (value == null) return null;
  const issue = Number(value);
  if (!Number.isSafeInteger(issue) || issue < 1) throw new Error("direct target issue must be a positive integer or null");
  return issue;
}

function requireStringList(value, field, maxEntries = 200) {
  if (!Array.isArray(value) || value.length > maxEntries) {
    throw new Error(`${field} must be an array of at most ${maxEntries} entries`);
  }
  const entries = value.map((entry, index) => requireString(entry, `${field}[${index}]`, 1000));
  if (new Set(entries).size !== entries.length) throw new Error(`${field} must not contain duplicates`);
  return entries;
}

export function flowStateRevisionDigest(state) {
  return crypto
    .createHash("sha256")
    .update(`${JSON.stringify(state, null, 2)}\n`)
    .digest("hex");
}

export class DirectFlowTarget {
  constructor({
    runId,
    issue = null,
    spec,
    worktreePath,
    bindingRevision,
    featureBranch,
    baseBranch,
    featureHead,
    flowStateRevision,
    activeRegistryRevision,
  }) {
    this.runId = requireString(runId, "direct target runId", 300);
    this.issue = nullableIssue(issue);
    this.spec = requireString(spec, "direct target spec", 500);
    this.worktreePath = requireString(worktreePath, "direct target worktreePath", 1000);
    this.bindingRevision = requireString(bindingRevision, "direct target bindingRevision", 500);
    this.featureBranch = requireString(featureBranch, "direct target featureBranch", 500);
    this.baseBranch = requireString(baseBranch, "direct target baseBranch", 500);
    this.featureHead = requireString(featureHead, "direct target featureHead", 128);
    if (!GIT_OBJECT_ID.test(this.featureHead)) throw new Error("direct target featureHead is invalid");
    this.flowStateRevision = requireString(flowStateRevision, "direct target flowStateRevision", 64);
    if (!SHA256.test(this.flowStateRevision)) throw new Error("direct target flowStateRevision must be SHA-256");
    this.activeRegistryRevision = requireString(
      activeRegistryRevision,
      "direct target activeRegistryRevision",
      200000,
    );
    Object.freeze(this);
  }

  sameIdentity(state) {
    return state?.runId === this.runId
      && (state.issue ?? null) === this.issue
      && state.spec === this.spec
      && state.worktree === true
      && state.featureBranch === this.featureBranch
      && state.baseBranch === this.baseBranch;
  }

  toJSON() {
    return {
      runId: this.runId,
      issue: this.issue,
      spec: this.spec,
      worktreePath: this.worktreePath,
      bindingRevision: this.bindingRevision,
      featureBranch: this.featureBranch,
      baseBranch: this.baseBranch,
      featureHead: this.featureHead,
      flowStateRevision: this.flowStateRevision,
      activeRegistryRevision: this.activeRegistryRevision,
    };
  }

  static fromStored(value) {
    return value instanceof DirectFlowTarget ? value : new DirectFlowTarget(value);
  }
}

export class DirectChangedPathFingerprint {
  constructor({ path, kind, digest }) {
    this.path = requireString(path, "direct changed path fingerprint path", 1000);
    this.kind = requireString(kind, "direct changed path fingerprint kind", 30);
    if (!["file", "symlink", "missing"].includes(this.kind)) {
      throw new Error(`invalid direct changed path fingerprint kind: ${this.kind}`);
    }
    this.digest = requireString(digest, "direct changed path fingerprint digest", 64);
    if (!SHA256.test(this.digest)) {
      throw new Error("direct changed path fingerprint digest must be SHA-256");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      path: this.path,
      kind: this.kind,
      digest: this.digest,
    };
  }

  static fromStored(value) {
    return value instanceof DirectChangedPathFingerprint
      ? value
      : new DirectChangedPathFingerprint(value);
  }
}

export class DirectVerificationResult {
  constructor({
    status,
    testStatus,
    testCommand = null,
    checks,
    changedPaths = [],
    pathFingerprints = [],
    featureHead = null,
    riskAccepted = false,
    riskReason = null,
    verifiedAt = new Date().toISOString(),
  }) {
    const statuses = new Set(["passed", "failed", "not-configured", "not-run", "tooling-error"]);
    this.status = requireString(status, "direct verification status", 50);
    this.testStatus = requireString(testStatus, "direct verification testStatus", 50);
    if (!statuses.has(this.status) || !statuses.has(this.testStatus)) {
      throw new Error("direct verification status is invalid");
    }
    this.testCommand = testCommand == null ? null : requireString(testCommand, "direct verification testCommand");
    if (!Array.isArray(checks) || checks.length === 0) {
      throw new Error("direct verification checks must be a non-empty array");
    }
    this.checks = Object.freeze(checks.map((check) => DirectVerificationCheck.fromStored(check)));
    if (!Array.isArray(changedPaths)) throw new Error("direct verification changedPaths must be an array");
    this.changedPaths = Object.freeze(changedPaths.map((entry, index) => (
      requireString(entry, `direct verification changedPaths[${index}]`, 1000)
    )));
    if (!Array.isArray(pathFingerprints)) {
      throw new Error("direct verification pathFingerprints must be an array");
    }
    this.pathFingerprints = Object.freeze(pathFingerprints.map((entry) => (
      DirectChangedPathFingerprint.fromStored(entry)
    )));
    const fingerprintPaths = this.pathFingerprints.map((entry) => entry.path);
    if (new Set(fingerprintPaths).size !== fingerprintPaths.length) {
      throw new Error("direct verification pathFingerprints must not contain duplicate paths");
    }
    this.featureHead = featureHead == null
      ? null
      : requireString(featureHead, "direct verification featureHead", 128);
    if (this.featureHead != null && !GIT_OBJECT_ID.test(this.featureHead)) {
      throw new Error("direct verification featureHead is invalid");
    }
    if (typeof riskAccepted !== "boolean") throw new Error("direct verification riskAccepted must be boolean");
    this.riskAccepted = riskAccepted;
    this.riskReason = riskReason == null ? null : requireString(riskReason, "direct verification riskReason");
    if (this.riskAccepted !== (this.riskReason != null)) {
      throw new Error("direct verification risk acceptance requires exactly one reason");
    }
    this.verifiedAt = requireIso(verifiedAt, "direct verification verifiedAt");
    Object.freeze(this);
  }

  toJSON() {
    return {
      status: this.status,
      testStatus: this.testStatus,
      testCommand: this.testCommand,
      checks: this.checks.map((check) => check.toJSON()),
      changedPaths: [...this.changedPaths],
      pathFingerprints: this.pathFingerprints.map((entry) => entry.toJSON()),
      featureHead: this.featureHead,
      riskAccepted: this.riskAccepted,
      riskReason: this.riskReason,
      verifiedAt: this.verifiedAt,
    };
  }

  static fromStored(value) {
    return value instanceof DirectVerificationResult ? value : new DirectVerificationResult(value);
  }
}

export class DirectImplementationProof {
  constructor({
    runId,
    issue = null,
    spec,
    planId,
    planRevision,
    sourceStep,
    summary,
    requirementIds = [],
    taskIds = [],
    changedPaths = [],
    pathFingerprints = [],
    featureHead,
    recordedAt = new Date().toISOString(),
  }) {
    this.runId = requireString(runId, "direct implementation proof runId", 300);
    this.issue = nullableIssue(issue);
    this.spec = requireString(spec, "direct implementation proof spec", 500);
    this.planId = requireString(planId, "direct implementation proof planId", 100);
    if (!Number.isSafeInteger(planRevision) || planRevision < 1) {
      throw new Error("direct implementation proof planRevision must be positive");
    }
    this.planRevision = planRevision;
    this.sourceStep = requireString(sourceStep, "direct implementation proof sourceStep", 200);
    this.summary = requireString(summary, "direct implementation proof summary", 8000);
    if (this.summary.length < 20) {
      throw new Error("direct implementation proof summary must contain concrete implementation evidence");
    }
    this.requirementIds = Object.freeze(requireStringList(
      requirementIds,
      "direct implementation proof requirementIds",
    ));
    this.taskIds = Object.freeze(requireStringList(
      taskIds,
      "direct implementation proof taskIds",
    ));
    this.changedPaths = Object.freeze(requireStringList(
      changedPaths,
      "direct implementation proof changedPaths",
    ));
    if (this.changedPaths.length === 0) {
      throw new Error("direct implementation proof requires at least one changed path");
    }
    if (!Array.isArray(pathFingerprints)) {
      throw new Error("direct implementation proof pathFingerprints must be an array");
    }
    this.pathFingerprints = Object.freeze(pathFingerprints.map((entry) => (
      DirectChangedPathFingerprint.fromStored(entry)
    )));
    const fingerprintPaths = this.pathFingerprints.map((entry) => entry.path);
    if (new Set(fingerprintPaths).size !== fingerprintPaths.length) {
      throw new Error("direct implementation proof pathFingerprints must not contain duplicates");
    }
    this.featureHead = requireString(featureHead, "direct implementation proof featureHead", 128);
    if (!GIT_OBJECT_ID.test(this.featureHead)) {
      throw new Error("direct implementation proof featureHead is invalid");
    }
    this.recordedAt = requireIso(recordedAt, "direct implementation proof recordedAt");
    Object.freeze(this);
  }

  matchesIdentity(state, plan) {
    return state?.runId === this.runId
      && (state.issue ?? null) === this.issue
      && state.spec === this.spec
      && plan?.planId === this.planId
      && plan?.revision === this.planRevision
      && plan?.sourceStep === this.sourceStep;
  }

  matchesSnapshot(snapshot) {
    return snapshot?.currentHead === this.featureHead
      && JSON.stringify(snapshot.changedPaths) === JSON.stringify([...this.changedPaths])
      && JSON.stringify(snapshot.pathFingerprints.map((entry) => entry.toJSON()))
        === JSON.stringify(this.pathFingerprints.map((entry) => entry.toJSON()));
  }

  matchesVerification(verification) {
    const result = verification == null ? null : DirectVerificationResult.fromStored(verification);
    return result != null
      && result.featureHead === this.featureHead
      && JSON.stringify([...result.changedPaths]) === JSON.stringify([...this.changedPaths])
      && JSON.stringify(result.pathFingerprints.map((entry) => entry.toJSON()))
        === JSON.stringify(this.pathFingerprints.map((entry) => entry.toJSON()));
  }

  withPlan(plan) {
    if (
      plan?.planId !== this.planId
      || plan?.sourceStep !== this.sourceStep
      || plan?.target?.runId !== this.runId
      || (plan?.target?.issue ?? null) !== this.issue
      || plan?.target?.spec !== this.spec
    ) {
      throw new Error("direct implementation proof cannot move to a different repair plan");
    }
    return new DirectImplementationProof({
      ...this.toJSON(),
      planRevision: plan.revision,
      recordedAt: new Date().toISOString(),
    });
  }

  toJSON() {
    return {
      runId: this.runId,
      issue: this.issue,
      spec: this.spec,
      planId: this.planId,
      planRevision: this.planRevision,
      sourceStep: this.sourceStep,
      summary: this.summary,
      requirementIds: [...this.requirementIds],
      taskIds: [...this.taskIds],
      changedPaths: [...this.changedPaths],
      pathFingerprints: this.pathFingerprints.map((entry) => entry.toJSON()),
      featureHead: this.featureHead,
      recordedAt: this.recordedAt,
    };
  }

  static fromStored(value) {
    return value instanceof DirectImplementationProof
      ? value
      : new DirectImplementationProof(value);
  }
}

export class DirectVerificationCheck {
  constructor({ id, passed, detail, overrideable = false }) {
    this.id = requireString(id, "direct verification check id", 100);
    if (typeof passed !== "boolean") throw new Error("direct verification check passed must be boolean");
    this.passed = passed;
    this.detail = requireString(detail, "direct verification check detail");
    if (typeof overrideable !== "boolean") {
      throw new Error("direct verification check overrideable must be boolean");
    }
    this.overrideable = overrideable;
    Object.freeze(this);
  }

  toJSON() {
    return {
      id: this.id,
      passed: this.passed,
      detail: this.detail,
      overrideable: this.overrideable,
    };
  }

  static fromStored(value) {
    return value instanceof DirectVerificationCheck ? value : new DirectVerificationCheck(value);
  }
}

export class DirectSessionCompletion {
  constructor({
    status = null,
    completionMode,
    success,
    mergeDisposition = null,
    receiptId = null,
    integrationReceiptId = null,
    reason = null,
    recordedAt = null,
    completedAt = null,
  }) {
    this.completionMode = requireString(
      completionMode,
      "direct session completionMode",
      30,
    );
    if (!["direct", "aborted"].includes(this.completionMode)) {
      throw new Error("direct session completionMode must be direct or aborted");
    }
    if (![true, false, null].includes(success)) {
      throw new Error("direct session completion success must be true, false, or null");
    }
    this.success = success;
    this.status = status == null
      ? (
          this.completionMode === "aborted"
            ? "aborted"
            : this.success === true
              ? "completed"
              : integrationReceiptId == null
                ? "prepared"
                : "pending-merge"
        )
      : requireString(status, "direct session completion status", 30);
    this.mergeDisposition = mergeDisposition == null
      ? null
      : requireString(mergeDisposition, "direct session mergeDisposition", 30);
    this.receiptId = receiptId == null
      ? null
      : requireString(receiptId, "direct session completion receiptId", 100);
    this.integrationReceiptId = integrationReceiptId == null
      ? null
      : requireString(
          integrationReceiptId,
          "direct session completion integrationReceiptId",
          100,
        );
    this.reason = reason == null
      ? null
      : requireString(reason, "direct session completion reason");
    this.recordedAt = recordedAt == null
      ? null
      : requireIso(recordedAt, "direct session completion recordedAt");
    this.completedAt = completedAt == null
      ? null
      : requireIso(completedAt, "direct session completion completedAt");

    if (this.completionMode === "aborted") {
      if (
        this.status !== "aborted"
        || this.success !== false
        || this.receiptId == null
        || this.reason == null
        || this.recordedAt == null
        || this.mergeDisposition != null
        || this.integrationReceiptId != null
        || this.completedAt != null
      ) {
        throw new Error("aborted direct session completion is inconsistent");
      }
    } else {
      if (!["merged", "already-merged"].includes(this.mergeDisposition)) {
        throw new Error("direct session mergeDisposition must be merged or already-merged");
      }
      const pending = this.status === "pending-merge"
        && this.success === null
        && this.integrationReceiptId != null
        && this.receiptId == null
        && this.completedAt == null;
      const prepared = this.status === "prepared"
        && this.success === null
        && this.receiptId != null
        && this.integrationReceiptId == null
        && this.completedAt == null;
      const completed = this.status === "completed"
        && this.success === true
        && this.receiptId != null
        && this.integrationReceiptId == null
        && this.completedAt != null;
      if (!pending && !prepared && !completed) {
        throw new Error("direct session completion state is inconsistent");
      }
      if (this.reason != null || this.recordedAt != null) {
        throw new Error("direct session completion cannot carry abort details");
      }
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      status: this.status,
      completionMode: this.completionMode,
      success: this.success,
      mergeDisposition: this.mergeDisposition,
      receiptId: this.receiptId,
      integrationReceiptId: this.integrationReceiptId,
      reason: this.reason,
      recordedAt: this.recordedAt,
      completedAt: this.completedAt,
    };
  }

  static fromStored(value) {
    return value instanceof DirectSessionCompletion
      ? value
      : new DirectSessionCompletion(value);
  }
}

export class DirectFlowSession {
  constructor({
    phase,
    revision = 1,
    target,
    sourceStep,
    transitionReason,
    selectionSource,
    adoptedActionId,
    requestedScopePaths = [],
    selectedAt = new Date().toISOString(),
    updatedAt = selectedAt,
    planId = null,
    planRevision = null,
    implementationProof = null,
    verification = null,
    verificationAttempts = 0,
    suspendedFrom = null,
    completion = null,
  }) {
    this.phase = requireString(phase, "direct session phase", 80);
    if (!PHASES.includes(this.phase)) throw new Error(`invalid direct session phase: ${this.phase}`);
    if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("direct session revision must be positive");
    this.revision = revision;
    this.target = DirectFlowTarget.fromStored(target);
    this.sourceStep = requireString(sourceStep, "direct session sourceStep", 200);
    this.transitionReason = requireString(transitionReason, "direct session transitionReason");
    this.selectionSource = requireString(selectionSource, "direct session selectionSource", 100);
    if (!["manual", "auto"].includes(this.selectionSource)) {
      throw new Error("direct session selectionSource must be manual or auto");
    }
    this.adoptedActionId = requireString(adoptedActionId, "direct session adoptedActionId", 80);
    this.requestedScopePaths = Object.freeze(requireStringList(
      requestedScopePaths,
      "direct session requestedScopePaths",
    ));
    this.selectedAt = requireIso(selectedAt, "direct session selectedAt");
    this.updatedAt = requireIso(updatedAt, "direct session updatedAt");
    this.planId = planId == null ? null : requireString(planId, "direct session planId", 100);
    this.planRevision = planRevision == null ? null : Number(planRevision);
    if (this.planRevision != null && (!Number.isSafeInteger(this.planRevision) || this.planRevision < 1)) {
      throw new Error("direct session planRevision must be positive or null");
    }
    if ((this.planId == null) !== (this.planRevision == null)) {
      throw new Error("direct session plan identity must be complete");
    }
    this.implementationProof = implementationProof == null
      ? null
      : DirectImplementationProof.fromStored(implementationProof);
    if (
      this.implementationProof != null
      && (
        this.implementationProof.planId !== this.planId
        || this.implementationProof.planRevision !== this.planRevision
      )
    ) {
      throw new Error("direct implementation proof must match the session plan");
    }
    this.verification = verification == null ? null : DirectVerificationResult.fromStored(verification);
    if (!Number.isSafeInteger(verificationAttempts) || verificationAttempts < 0) {
      throw new Error("direct session verificationAttempts must be a non-negative integer");
    }
    this.verificationAttempts = verificationAttempts;
    this.suspendedFrom = suspendedFrom == null
      ? null
      : requireString(suspendedFrom, "direct session suspendedFrom", 80);
    if (this.phase === "SUSPENDED") {
      if (![
        "DIRECT_HANDOFF_PREFLIGHT",
        "DIRECT_FIX",
        "DIRECT_VERIFY",
        "MERGE_ONLY_FINALIZE",
        "DIRECT_RECONCILE",
      ].includes(this.suspendedFrom)) {
        throw new Error("suspended direct session requires a resumable suspendedFrom phase");
      }
    } else if (this.suspendedFrom != null) {
      throw new Error("only a suspended direct session may retain suspendedFrom");
    }
    this.completion = completion == null
      ? null
      : DirectSessionCompletion.fromStored(completion);
    Object.freeze(this);
  }

  get terminal() {
    return TERMINAL_PHASES.has(this.phase);
  }

  transition(phase, changes = {}) {
    if (!TRANSITIONS[this.phase].has(phase)) {
      throw new Error(`invalid direct session transition: ${this.phase} -> ${phase}`);
    }
    return new DirectFlowSession({
      ...this.toJSON(),
      ...changes,
      phase,
      suspendedFrom: phase === "SUSPENDED"
        ? (changes.suspendedFrom || this.phase)
        : null,
      revision: this.revision + 1,
      updatedAt: changes.updatedAt || new Date().toISOString(),
    });
  }

  withPlan(plan) {
    if (!plan?.planId || !plan?.revision) throw new Error("direct resolution plan identity is required");
    return new DirectFlowSession({
      ...this.toJSON(),
      planId: plan.planId,
      planRevision: plan.revision,
      implementationProof: null,
      revision: this.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  withImplementationProof(proof) {
    const readiness = DirectImplementationProof.fromStored(proof);
    if (
      readiness.planId !== this.planId
      || readiness.planRevision !== this.planRevision
    ) {
      throw new Error("direct implementation proof does not match the active plan");
    }
    return new DirectFlowSession({
      ...this.toJSON(),
      implementationProof: readiness.toJSON(),
      revision: this.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  withVerification(verification) {
    const result = DirectVerificationResult.fromStored(verification);
    return new DirectFlowSession({
      ...this.toJSON(),
      verification: result.toJSON(),
      verificationAttempts: this.verificationAttempts + 1,
      revision: this.revision + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  reopenAfterAbort(plan, reason) {
    if (this.phase !== "ABORTED" || this.completion?.completionMode !== "aborted") {
      throw new Error("only an aborted direct session can be reopened");
    }
    if (!plan?.planId || !plan?.revision) throw new Error("reopened direct session requires a plan");
    return new DirectFlowSession({
      ...this.toJSON(),
      phase: "DIRECT_FIX",
      revision: this.revision + 1,
      target: plan.target.toJSON(),
      transitionReason: requireString(reason, "direct reopen reason"),
      selectionSource: "manual",
      adoptedActionId: "REOPEN_ABORTED_DIRECT",
      updatedAt: new Date().toISOString(),
      planId: plan.planId,
      planRevision: plan.revision,
      implementationProof: null,
      verificationAttempts: 0,
      suspendedFrom: null,
      completion: null,
    });
  }

  toJSON() {
    return {
      phase: this.phase,
      revision: this.revision,
      target: this.target.toJSON(),
      sourceStep: this.sourceStep,
      transitionReason: this.transitionReason,
      selectionSource: this.selectionSource,
      adoptedActionId: this.adoptedActionId,
      requestedScopePaths: [...this.requestedScopePaths],
      selectedAt: this.selectedAt,
      updatedAt: this.updatedAt,
      planId: this.planId,
      planRevision: this.planRevision,
      implementationProof: this.implementationProof?.toJSON() ?? null,
      verification: this.verification?.toJSON() ?? null,
      verificationAttempts: this.verificationAttempts,
      suspendedFrom: this.suspendedFrom,
      completion: this.completion?.toJSON() ?? null,
    };
  }

  static fromStored(value) {
    return value instanceof DirectFlowSession ? value : new DirectFlowSession(value);
  }

  static phases() {
    return [...PHASES];
  }
}
