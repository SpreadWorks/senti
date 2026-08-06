import crypto from "node:crypto";

const SHA256 = /^[a-f0-9]{64}$/;
const MAX_TEXT_LENGTH = 4000;
const MAX_OBSERVATIONS = 64;

function requiredString(value, field, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${field} exceeds ${maxLength} characters`);
  return normalized;
}

function requiredDigest(value, field) {
  const digest = requiredString(value, field, 64);
  if (!SHA256.test(digest)) throw new Error(`${field} must be a SHA-256 digest`);
  return digest;
}

function requiredTimestamp(value, field) {
  const timestamp = requiredString(value, field, 100);
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error(`${field} must be an ISO timestamp`);
  return timestamp;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

export class PlanGateRepairLocation {
  constructor(input = {}) {
    this.file = requiredString(input.file, "plan gate repair location file", 1000);
    this.locator = input.locator == null
      ? null
      : requiredString(input.locator, "plan gate repair location locator", 1000);
    Object.freeze(this);
  }

  toJSON() {
    const location = { file: this.file };
    if (this.locator != null) location.locator = this.locator;
    return location;
  }
}

export class PlanGateRepairObservation {
  constructor(input = {}) {
    this.kind = requiredString(input.kind || "violation", "plan gate repair observation kind", 100);
    this.failureMode = requiredString(
      input.failureMode || "gate-failure",
      "plan gate repair observation failureMode",
      200,
    );
    this.requirementRef = requiredString(
      input.requirementRef,
      "plan gate repair observation requirementRef",
      500,
    );
    this.where = new PlanGateRepairLocation(input.where);
    this.observed = requiredString(input.observed, "plan gate repair observation observed");
    this.severity = requiredString(input.severity, "plan gate repair observation severity", 100);
    if (this.severity !== "blocking") {
      throw new Error("plan gate repair observations must be blocking");
    }
    const refs = Array.isArray(input.refs) ? input.refs : [];
    this.refs = Object.freeze(refs.map((ref, index) => (
      requiredString(ref, `plan gate repair observation refs[${index}]`, 500)
    )));
    Object.freeze(this);
  }

  toJSON() {
    return {
      kind: this.kind,
      failureMode: this.failureMode,
      requirementRef: this.requirementRef,
      where: this.where.toJSON(),
      observed: this.observed,
      severity: this.severity,
      refs: [...this.refs],
    };
  }
}

export class PlanGateRepairRoute {
  constructor({ phase, gateStepId, targetStepId, resetStepIds }) {
    this.phase = requiredString(phase, "plan gate repair phase", 100);
    this.gateStepId = requiredString(gateStepId, "plan gate repair gateStepId", 100);
    this.targetStepId = requiredString(targetStepId, "plan gate repair targetStepId", 100);
    if (!Array.isArray(resetStepIds) || resetStepIds.length === 0) {
      throw new Error("plan gate repair resetStepIds must be a non-empty array");
    }
    this.resetStepIds = Object.freeze(resetStepIds.map((stepId, index) => (
      requiredString(stepId, `plan gate repair resetStepIds[${index}]`, 100)
    )));
    if (this.resetStepIds[0] !== this.targetStepId || !this.resetStepIds.includes(this.gateStepId)) {
      throw new Error(`plan gate repair route is inconsistent for ${this.phase}`);
    }
    Object.freeze(this);
  }

  requestedStatus(stepId) {
    if (!this.resetStepIds.includes(stepId)) throw new Error(`step is outside plan gate repair route: ${stepId}`);
    return stepId === this.targetStepId ? "in_progress" : "pending";
  }
}

const ROUTES = Object.freeze([
  new PlanGateRepairRoute({
    phase: "draft",
    gateStepId: "draft-gate",
    targetStepId: "draft-refine",
    resetStepIds: [
      "draft-refine",
      "draft-coverage-review",
      "draft-coverage-triage",
      "draft-coverage-repair",
      "draft-gate",
    ],
  }),
  new PlanGateRepairRoute({
    phase: "spec",
    gateStepId: "spec-gate",
    targetStepId: "spec",
    resetStepIds: ["spec", "spec-review", "spec-triage", "spec-repair", "spec-gate"],
  }),
  new PlanGateRepairRoute({
    phase: "test",
    gateStepId: "scenario-validity",
    targetStepId: "test",
    resetStepIds: ["test", "scenario-validity"],
  }),
]);

const ROUTE_BY_PHASE = new Map(ROUTES.map((route) => [route.phase, route]));
const ROUTE_BY_TARGET = new Map(ROUTES.map((route) => [route.targetStepId, route]));

export function planGateRepairRouteForPhase(phase) {
  return ROUTE_BY_PHASE.get(phase) || null;
}

export function planGateRepairRouteForTargetStep(stepId) {
  return ROUTE_BY_TARGET.get(stepId) || null;
}

export class PlanGateRepairRecord {
  constructor(input = {}) {
    if (input.version !== 1) throw new Error("plan gate repair version must be 1");
    this.version = 1;
    this.runId = requiredString(input.runId, "plan gate repair runId", 500);
    this.specId = requiredString(input.specId, "plan gate repair specId", 500);
    this.issue = input.issue == null ? null : Number(input.issue);
    if (this.issue != null && (!Number.isSafeInteger(this.issue) || this.issue <= 0)) {
      throw new Error("plan gate repair issue must be a positive integer or null");
    }
    this.phase = requiredString(input.phase, "plan gate repair phase", 100);
    this.route = planGateRepairRouteForPhase(this.phase);
    if (!this.route) throw new Error(`unsupported plan gate repair phase: ${this.phase}`);
    this.targetStepId = requiredString(input.targetStepId, "plan gate repair targetStepId", 100);
    if (this.targetStepId !== this.route.targetStepId) {
      throw new Error("plan gate repair target does not match its phase");
    }
    this.sourceIssueLogId = requiredString(
      input.sourceIssueLogId,
      "plan gate repair sourceIssueLogId",
      500,
    );
    this.sourceEntryDigest = requiredDigest(
      input.sourceEntryDigest,
      "plan gate repair sourceEntryDigest",
    );
    if (!Array.isArray(input.observations) || input.observations.length === 0) {
      throw new Error("plan gate repair requires blocking observations");
    }
    if (input.observations.length > MAX_OBSERVATIONS) {
      throw new Error(`plan gate repair observations exceed ${MAX_OBSERVATIONS}`);
    }
    this.observations = Object.freeze(input.observations.map((observation) => (
      observation instanceof PlanGateRepairObservation
        ? observation
        : new PlanGateRepairObservation(observation)
    )));
    this.requestedAt = requiredTimestamp(input.requestedAt, "plan gate repair requestedAt");
    Object.freeze(this);
  }

  static create({ state, phase, issueLogEntry, requestedAt = new Date().toISOString() }) {
    const route = planGateRepairRouteForPhase(phase);
    if (!route) throw new Error(`unsupported plan gate repair phase: ${phase}`);
    const observations = (issueLogEntry?.observations || [])
      .filter((observation) => observation?.severity === "blocking");
    return new PlanGateRepairRecord({
      version: 1,
      runId: state?.runId,
      specId: state?.specId,
      issue: state?.issue ?? null,
      phase,
      targetStepId: route.targetStepId,
      sourceIssueLogId: issueLogEntry?.issueLogId,
      sourceEntryDigest: digest(issueLogEntry),
      observations,
      requestedAt,
    });
  }

  static from(value) {
    return value instanceof PlanGateRepairRecord ? value : new PlanGateRepairRecord(value);
  }

  static forTarget(state, stepId) {
    if (state?.planGateRepair == null || !ROUTE_BY_TARGET.has(stepId)) return null;
    const record = PlanGateRepairRecord.from(state.planGateRepair);
    record.assertFlow(state);
    return record.targetStepId === stepId ? record : null;
  }

  assertFlow(state) {
    if (
      state?.runId !== this.runId
      || state?.specId !== this.specId
      || (state?.issue ?? null) !== this.issue
    ) {
      throw new Error("plan gate repair does not match Flow identity");
    }
  }

  matchesIssueLogEntry(entry) {
    return entry?.issueLogId === this.sourceIssueLogId
      && digest(entry) === this.sourceEntryDigest;
  }

  toJSON() {
    return {
      version: this.version,
      runId: this.runId,
      specId: this.specId,
      issue: this.issue,
      phase: this.phase,
      targetStepId: this.targetStepId,
      sourceIssueLogId: this.sourceIssueLogId,
      sourceEntryDigest: this.sourceEntryDigest,
      observations: this.observations.map((observation) => observation.toJSON()),
      requestedAt: this.requestedAt,
    };
  }

  toWorkerJSON() {
    return {
      phase: this.phase,
      targetStepId: this.targetStepId,
      sourceIssueLogId: this.sourceIssueLogId,
      sourceEntryDigest: this.sourceEntryDigest,
      observations: this.observations.map((observation) => observation.toJSON()),
    };
  }
}
