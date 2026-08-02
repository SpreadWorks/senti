import crypto from "node:crypto";
import path from "node:path";

import { FlowTargetExpectation } from "../../lib/flow-target-guard.js";
import {
  RecoveryFailureLedger,
  RecoveryFailureRecord,
  RecoveryTarget,
  RecoveryUnavailable,
  SemanticDecisionFailure,
} from "./recovery-contract.js";
import { ImplementationRevalidationPlan } from "./implementation-revalidation.js";
import { RecoveryDecision } from "./recovery-decision.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STEP_ID = /^[a-z][a-z0-9-]{0,127}$/;
const MAX_RESOLUTIONS = 1_000;
const SUBJECT_KINDS = new Set(["requirement", "finding", "product-behavior", "scope"]);

function requireString(value, field, { pattern = null, max = 4_096 } = {}) {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw new Error(`${field} must be a non-empty string`);
  }
  if (pattern && !pattern.test(value)) throw new Error(`${field} is invalid`);
  return value.trim();
}

function requireTimestamp(value, field) {
  const timestamp = requireString(value, field, { max: 80 });
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error(`${field} must be an ISO timestamp`);
  return timestamp;
}

function normalizeRepositoryPath(value, field) {
  const source = requireString(value, field);
  if (path.posix.isAbsolute(source) || path.win32.isAbsolute(source)) {
    throw new Error(`${field} must be repository-relative`);
  }
  const normalized = path.posix.normalize(source.replaceAll("\\", "/"));
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${field} must stay inside the repository`);
  }
  return normalized;
}

function targetExpectation(target) {
  return new FlowTargetExpectation({
    expectRunId: target.runId,
    expectSpec: target.specId,
    ...(target.issue == null ? { expectNoIssue: true } : { expectIssue: target.issue }),
  });
}

export class RecoveryResolutionSubject {
  constructor({ kind, reference }) {
    this.kind = requireString(kind, "user resolution subject kind", { max: 128 });
    if (!SUBJECT_KINDS.has(this.kind)) throw new Error("user resolution subject kind is invalid");
    this.reference = requireString(reference, "user resolution subject reference", { max: 1_000 });
    Object.freeze(this);
  }

  toJSON() { return { kind: this.kind, reference: this.reference }; }
}

export class RecoveryChangedPath {
  constructor({ path: changedPath }) {
    this.path = normalizeRepositoryPath(changedPath, "recovery changed path");
    Object.freeze(this);
  }

  toJSON() { return { path: this.path }; }
}

/**
 * A human product decision bound to one persisted semantic failure. It is a
 * record of what the user decided, never an automatically selected policy.
 */
export class UserResolution {
  constructor({
    resolutionId = crypto.randomUUID(),
    record,
    subject,
    decision,
    rationale,
    normalRepairStepId,
    changedPaths = [],
    resolvedAt = new Date().toISOString(),
    autoApproved = false,
  }) {
    if (!UUID_V4.test(resolutionId)) throw new Error("user resolution ID must be a UUID v4");
    this.resolutionId = resolutionId;
    this.record = record instanceof RecoveryFailureRecord ? record : new RecoveryFailureRecord(record);
    if (!(this.record.failureClass instanceof SemanticDecisionFailure)) {
      throw new Error("user resolution requires a semantic-decision failure record");
    }
    if (autoApproved !== false) throw new Error("user resolution must never be auto-approved");
    this.subject = subject instanceof RecoveryResolutionSubject
      ? subject
      : new RecoveryResolutionSubject(subject);
    this.decision = requireString(decision, "user resolution decision", { max: 4_000 });
    this.rationale = requireString(rationale, "user resolution rationale", { max: 4_000 });
    this.normalRepairStepId = requireString(normalRepairStepId, "user resolution normalRepairStepId", {
      pattern: STEP_ID,
      max: 128,
    });
    if (!Array.isArray(changedPaths)) throw new Error("user resolution changedPaths must be an array");
    this.changedPaths = Object.freeze(changedPaths.map((entry) => (
      entry instanceof RecoveryChangedPath ? entry : new RecoveryChangedPath(entry)
    )));
    if (new Set(this.changedPaths.map((entry) => entry.path)).size !== this.changedPaths.length) {
      throw new Error("user resolution changedPaths must not contain duplicates");
    }
    this.resolvedAt = requireTimestamp(resolvedAt, "user resolution resolvedAt");
    Object.freeze(this);
  }

  get requiresImplementationRevalidation() { return this.changedPaths.length > 0; }

  toJSON() {
    return {
      version: 1,
      resolutionId: this.resolutionId,
      recordId: this.record.recordId,
      target: this.record.target.toJSON(),
      subject: this.subject.toJSON(),
      decision: this.decision,
      rationale: this.rationale,
      normalRepairStepId: this.normalRepairStepId,
      changedPaths: this.changedPaths.map((entry) => entry.toJSON()),
      resolvedAt: this.resolvedAt,
    };
  }

  static fromStored(value, failureLedger) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1) {
      throw new Error("stored user resolution is invalid");
    }
    if (!(failureLedger instanceof RecoveryFailureLedger)) {
      throw new Error("stored user resolution requires a recovery failure ledger");
    }
    const record = failureLedger.find(requireString(value.recordId, "stored user resolution recordId", { max: 64 }));
    if (!record) throw new Error("stored user resolution references an unknown recovery failure record");
    const resolution = new UserResolution({
      resolutionId: value.resolutionId,
      record,
      subject: value.subject,
      decision: value.decision,
      rationale: value.rationale,
      normalRepairStepId: value.normalRepairStepId,
      changedPaths: value.changedPaths,
      resolvedAt: value.resolvedAt,
    });
    if (JSON.stringify(resolution.record.target.toJSON()) !== JSON.stringify(value.target)) {
      throw new Error("stored user resolution target does not match its failure record");
    }
    return resolution;
  }
}

export class UserResolutionLedger {
  constructor({ resolutions = [], failureLedger = new RecoveryFailureLedger() } = {}) {
    this.failureLedger = failureLedger instanceof RecoveryFailureLedger
      ? failureLedger
      : new RecoveryFailureLedger(failureLedger);
    if (!Array.isArray(resolutions) || resolutions.length > MAX_RESOLUTIONS) {
      throw new Error("user resolution ledger count is invalid");
    }
    this.resolutions = Object.freeze(resolutions.map((resolution) => (
      resolution instanceof UserResolution
        ? resolution
        : UserResolution.fromStored(resolution, this.failureLedger)
    )));
    if (new Set(this.resolutions.map((entry) => entry.resolutionId)).size !== this.resolutions.length) {
      throw new Error("user resolution ledger contains duplicate resolution IDs");
    }
    if (new Set(this.resolutions.map((entry) => entry.record.recordId)).size !== this.resolutions.length) {
      throw new Error("user resolution ledger contains duplicate failure records");
    }
    Object.freeze(this);
  }

  findByRecord(recordId) {
    return this.resolutions.find((entry) => entry.record.recordId === recordId) || null;
  }

  record(resolution) {
    const next = resolution instanceof UserResolution ? resolution : new UserResolution(resolution);
    const existing = this.findByRecord(next.record.recordId);
    if (existing) {
      if (JSON.stringify(existing.toJSON()) !== JSON.stringify(next.toJSON())) {
        throw new Error("semantic recovery failure already has a different user resolution");
      }
      return this;
    }
    return new UserResolutionLedger({
      failureLedger: this.failureLedger,
      resolutions: [...this.resolutions, next],
    });
  }

  toJSON() { return this.resolutions.map((entry) => entry.toJSON()); }
}

/** Persists a user-selected semantic resolution under the exact active Flow target. */
export class UserResolutionStore {
  constructor(flowManager) {
    if (!flowManager || typeof flowManager.captureExactTarget !== "function") {
      throw new Error("user resolution store requires an exact-target flow manager");
    }
    this.flowManager = flowManager;
    Object.freeze(this);
  }

  record(resolution, options = {}) {
    const next = resolution instanceof UserResolution ? resolution : new UserResolution(resolution);
    const captured = this.flowManager.captureExactTarget(targetExpectation(next.record.target));
    let persisted = null;
    captured.mutate((state) => {
      const failures = new RecoveryFailureLedger(state.recoveryFailureRecords || []);
      const stored = failures.find(next.record.recordId);
      if (!stored || stored.consumption.state !== "available") {
        throw new Error("user resolution failure record is no longer available");
      }
      const ledger = new UserResolutionLedger({
        failureLedger: failures,
        resolutions: state.recoveryUserResolutions || [],
      }).record(new UserResolution({
        ...next.toJSON(),
        record: stored,
      }));
      state.recoveryUserResolutions = ledger.toJSON();
      persisted = ledger.findByRecord(next.record.recordId);
    }, options);
    return persisted;
  }
}

/** A deterministic revalidation that must follow a resolution with code changes. */
export class ImplementationRevalidationIntent {
  constructor({ plan, changedPaths }) {
    if (!(plan instanceof ImplementationRevalidationPlan)) {
      throw new Error("implementation revalidation intent requires a normal Flow revalidation plan");
    }
    if (!Array.isArray(changedPaths) || changedPaths.length === 0) {
      throw new Error("implementation revalidation intent requires changed paths");
    }
    this.plan = plan;
    this.changedPaths = Object.freeze(changedPaths.map((entry) => (
      entry instanceof RecoveryChangedPath ? entry : new RecoveryChangedPath(entry)
    )));
    if (new Set(this.changedPaths.map((entry) => entry.path)).size !== this.changedPaths.length) {
      throw new Error("implementation revalidation intent changed paths must not contain duplicates");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      type: "implementation-revalidation",
      target: this.plan.target.toJSON(),
      restartStepId: this.plan.restartStepId,
      previousFingerprint: this.plan.previousFingerprint,
      currentFingerprint: this.plan.currentFingerprint,
      changedPaths: this.changedPaths.map((entry) => entry.toJSON()),
    };
  }
}

/** User-facing semantic prompt with labels and outcomes, not internal action tokens. */
export class UserResolutionChoice {
  constructor({ label, outcome, impact }) {
    this.label = requireString(label, "user resolution choice label", { max: 300 });
    this.outcome = requireString(outcome, "user resolution choice outcome", { max: 1_000 });
    this.impact = requireString(impact, "user resolution choice impact", { max: 1_000 });
    Object.freeze(this);
  }

  toJSON() { return { label: this.label, outcome: this.outcome, impact: this.impact }; }
}

export class UserResolutionRequest {
  constructor({ target, subject, question, choices }) {
    this.target = target instanceof RecoveryTarget ? target : new RecoveryTarget(target);
    this.subject = subject instanceof RecoveryResolutionSubject
      ? subject
      : new RecoveryResolutionSubject(subject);
    this.question = requireString(question, "user resolution question", { max: 2_000 });
    if (!Array.isArray(choices) || choices.length < 2 || choices.length > 12) {
      throw new Error("user resolution request requires 2 through 12 choices");
    }
    this.choices = Object.freeze(choices.map((choice) => (
      choice instanceof UserResolutionChoice ? choice : new UserResolutionChoice(choice)
    )));
    Object.freeze(this);
  }

  toJSON() {
    return {
      requiresUserAction: true,
      message: this.question,
      subject: this.subject.toJSON(),
      choices: this.choices.map((choice) => choice.toJSON()),
    };
  }
}

/** Plain-language presentation of a fail-closed recovery outcome. */
export class RecoveryUnavailableNotice {
  constructor(unavailable) {
    this.unavailable = unavailable instanceof RecoveryUnavailable
      ? unavailable
      : new RecoveryUnavailable(unavailable);
    Object.freeze(this);
  }

  toJSON() { return this.unavailable.toJSON(); }
}

/**
 * Ordered recovery composition. It intentionally cannot auto-select a user
 * resolution and cannot leave code changes accepted without revalidation.
 */
export class RecoveryComposition {
  constructor({ entries, autoMode = false }) {
    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("recovery composition requires at least one entry");
    }
    if (typeof autoMode !== "boolean") throw new Error("recovery composition autoMode must be boolean");
    this.entries = Object.freeze(entries.map((entry) => {
      if (
        entry instanceof UserResolution
        || entry instanceof ImplementationRevalidationIntent
        || entry instanceof RecoveryUnavailableNotice
        || entry instanceof RecoveryDecision
      ) return entry;
      throw new Error("recovery composition entry is invalid");
    }));
    this.autoMode = autoMode;
    this.#assertOrdering();
    Object.freeze(this);
  }

  get requiresUserAction() {
    return this.entries.some((entry) => entry instanceof UserResolution);
  }

  toJSON() {
    return {
      autoMode: this.autoMode,
      requiresUserAction: this.requiresUserAction,
      entries: this.entries.map((entry) => (
        entry instanceof UserResolution
          ? { type: "user-resolution", ...entry.toJSON() }
          : entry instanceof RecoveryDecision
            ? { type: "evidence-processing-waiver", ...entry.toJSON() }
          : entry.toJSON()
      )),
    };
  }

  #assertOrdering() {
    const unavailable = this.entries.filter((entry) => entry instanceof RecoveryUnavailableNotice);
    if (unavailable.length > 0 && this.entries.length !== 1) {
      throw new Error("recovery unavailable cannot be combined with a state-changing recovery composition");
    }
    if (this.autoMode && this.requiresUserAction) {
      throw new Error("auto mode must not approve a user resolution");
    }
    const firstUserResolution = this.entries.findIndex((entry) => entry instanceof UserResolution);
    if (this.entries.some((entry, index) => (
      entry instanceof RecoveryDecision && firstUserResolution >= 0 && index > firstUserResolution
    ))) {
      throw new Error("evidence-processing waiver must precede a user resolution in one recovery composition");
    }
    for (const [index, entry] of this.entries.entries()) {
      if (!(entry instanceof UserResolution) || !entry.requiresImplementationRevalidation) continue;
      const next = this.entries[index + 1];
      if (!(next instanceof ImplementationRevalidationIntent)) {
        throw new Error("a user resolution with changed paths must be followed by implementation revalidation");
      }
      if (!entry.record.target.equals(next.plan.target)) {
        throw new Error("user resolution and implementation revalidation must target the same Flow");
      }
      const resolutionPaths = new Set(entry.changedPaths.map((changedPath) => changedPath.path));
      if (next.changedPaths.some((changedPath) => !resolutionPaths.has(changedPath.path))) {
        throw new Error("implementation revalidation cannot accept changed paths outside the user resolution impact");
      }
    }
  }
}
