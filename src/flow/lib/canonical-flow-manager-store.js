/**
 * Canonical persistence boundary used by FlowManager.
 *
 * This module deliberately does not know how to read, write, or infer the
 * retired root-level flow.json layout.  It turns the small manager-facing
 * surface into operations on the one Version-1 Store, and exposes a read-only
 * command view only at the process boundary.  Persistent mutations must be
 * represented by typed Activities rather than by mutating that view.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildCurrentFlowDefinition } from "../definition.js";
import { AtomicFile } from "../../lib/atomic-file.js";
import { normalizeAgentMetricDimension } from "../../lib/agent-metrics.js";
import { managedDir } from "../../lib/config.js";
import { VALID_REQ_STATUSES } from "../../lib/constants.js";
import {
  FLOW_ARTIFACT_CONTRACTS,
  FlowArtifactAttemptHistory,
  FlowArtifactAttemptRecord,
  FlowArtifactUpdater,
} from "../../lib/flow-artifact-contract.js";
import { FlowSpecId } from "../../lib/flow-spec-id.js";
import { FlowVersion } from "../../lib/flow-version.js";
import {
  ActivityMetric,
  ActivityNote,
  ActivityNonBlockingRecord,
  ActivityDispatchApproval,
  CurrentAttempt,
  CurrentAttemptIdentity,
  ActivityReferences,
  CanonicalFlowArtifactBaseline,
  CanonicalFlowRuntimeArtifactWrite,
  FlowExecution,
  CurrentFlowSpecRecord,
  CanonicalSourceWorkerSpecCompletion,
  CanonicalSourceWorkerUpgradeResult,
  CurrentFlowNonBlockingPolicy,
  CurrentFlowState,
  CurrentFlowStateConflictError,
  CurrentFlowStateInvariantError,
  ApprovalTaskAdmission,
  FlowActivity,
  TaskNode,
} from "./current-flow-state.js";
import { CanonicalFlowRuntime } from "./canonical-flow-runtime.js";
import {
  attachedCanonicalCommandResultArtifact,
  attachedCanonicalCommandResultPublications,
} from "./canonical-command-result.js";
import { PlanGateRepairRecord } from "./plan-gate-repair.js";
import { IssueLogDocument } from "./issue-log-store.js";
import { CanonicalOverviewUpdate } from "./canonical-overview-update.js";
import { CanonicalSpecApproval } from "./canonical-spec-approval.js";
import { CanonicalFileMapUpdate } from "./canonical-file-map.js";
import { nonblockingRouteFor } from "./nonblocking-route.js";
import { DraftLifecycle } from "./draft-lifecycle.js";
import { TaskCollection } from "../../spec/lib/render-contract.js";
import { SourceWorkerEffect } from "./worker-artifact-handoff.js";
import {
  captureRetryRecoveryBaseline,
  containsRetryRecoveryArtifactWrite,
  retryEvidenceRouteForNode,
  RetryRecoveryArtifactPublication,
  RetryRecoveryReceipt,
} from "./retry-recovery.js";
import { validateUpgradeResultArtifact } from "./upgrade-result-artifact.js";
import {
  MissingProducerArtifactRecoveryAdmission,
  MissingProducerArtifactRoute,
  ProducerArtifactPublicationAdmission,
  ProducerArtifactReadinessAdmission,
  AcceptanceDecisionNoOpAdmission,
  attemptHistoryTargetForNode,
  producerArtifactReadinessesForConsumer,
  producerArtifactReadinessesForProducer,
} from "./producer-artifact-readiness.js";

const EXECUTION_MODES = new Set(["direct", "branch", "worktree"]);
const TERMINAL_STATUSES = new Set(["done", "skipped"]);
const TASK_RUNTIME_STEP_ALIASES = new Set(["task-impl", "task-review", "task-gate"]);
const RAW_ACTIVITY_MUTATION_OPTION_FIELDS = Object.freeze([
  "taskSpec",
  "specRecord",
  "artifactWrites",
  "artifactRemovals",
  "artifactBaselines",
  "testSourceBaseline",
  "sourceWorkerUpgrade",
  "admission",
]);

/**
 * The public manager never accepts a caller-authored Activity as new state.
 * Typed Store methods derive the Activity and its admission together.  This
 * error keeps the remaining raw method intentionally narrow: it is only a
 * crash-replay bridge for an Activity that is already in the immutable ledger.
 */
export class CanonicalRawActivityReplayOnlyError extends CurrentFlowStateInvariantError {
  constructor(message = "canonical raw Activity mutation is forbidden; use a typed FlowManager operation") {
    super(message);
    this.name = "CanonicalRawActivityReplayOnlyError";
    this.code = "CANONICAL_RAW_ACTIVITY_MUTATION_FORBIDDEN";
  }
}

function rawActivityReplayMatches(existing, proposed) {
  return JSON.stringify(existing.toJSON()) === JSON.stringify(proposed.toJSON());
}

function rawActivityHasMutationOptions(options) {
  return RAW_ACTIVITY_MUTATION_OPTION_FIELDS.some((field) => Object.hasOwn(options, field));
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CurrentFlowStateInvariantError(`${field} must be a non-empty string`);
  }
  return value;
}

function canonicalTaskAddition(task) {
  if (task === null || typeof task !== "object" || Array.isArray(task)) {
    throw new CurrentFlowStateInvariantError("canonical Task must be an object");
  }
  const id = requiredText(task.id, "canonical Task.id");
  const key = requiredText(task.key ?? task.id, "canonical Task.key");
  const taskSpec = structuredClone(task);
  delete taskSpec.key;
  return Object.freeze({ id, key, taskSpec: { ...taskSpec, id } });
}

function canonicalSpecId(value) {
  return FlowSpecId.from(requiredText(value, "specId")).toString();
}

function catalogRelativePath(value) {
  const relativePath = requiredText(value, "canonical catalog relativePath").replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(relativePath)
    || path.posix.normalize(relativePath) !== relativePath
    || relativePath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new CurrentFlowStateInvariantError("canonical catalog relativePath must be a normalized relative path");
  }
  return relativePath;
}

function executionMode(value) {
  if (!EXECUTION_MODES.has(value)) {
    throw new CurrentFlowStateInvariantError(`execution.mode is invalid: ${value}`);
  }
  return value;
}

function activityId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function canonicalOutboxInput(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CurrentFlowStateInvariantError("canonical outbox input must be an object");
  }
  return Object.freeze({
    id: requiredText(value.id, "canonical outbox id"),
    operation: requiredText(value.operation, "canonical outbox operation"),
  });
}

function canonicalIssueLogEntry(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CurrentFlowStateInvariantError("canonical issue-log entry must be an object");
  }
  return structuredClone(value);
}

/** A requirement status change is a typed replacement of the cataloged Spec. */
class CanonicalRequirementStatusUpdate {
  constructor({ reference, status } = {}) {
    this.reference = requiredText(String(reference ?? ""), "canonical requirement reference");
    this.status = requiredText(status, "canonical requirement status");
    if (!VALID_REQ_STATUSES.includes(this.status)) {
      throw new CurrentFlowStateInvariantError(`invalid requirement status: ${this.status}`);
    }
    Object.freeze(this);
  }

  apply(document) {
    const requirements = Array.isArray(document?.requirements) ? document.requirements : [];
    const index = /^\d+$/.test(this.reference)
      ? Number.parseInt(this.reference, 10)
      : requirements.findIndex((entry) => entry?.id === this.reference);
    if (index < 0 || index >= requirements.length) {
      throw new CurrentFlowStateInvariantError(`requirement id not found: ${this.reference}`);
    }
    const next = structuredClone(document);
    next.requirements[index] = { ...next.requirements[index], status: this.status };
    return Object.freeze({ document: next, index, requirement: Object.freeze(structuredClone(next.requirements[index])) });
  }
}

function canonicalOutboxActivity({ outbox, attempt, result = null, failure = null, failureCode = null, recovery = null, exactRecoveryReceipt = null } = {}) {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new CurrentFlowStateInvariantError("canonical outbox attempt must be a positive integer");
  }
  return Object.freeze({
    ...canonicalOutboxInput(outbox),
    attempt,
    result,
    failure,
    failureCode,
    recovery,
    exactRecoveryReceipt,
  });
}

function projectNode(node) {
  const children = node.steps.map((step) => projectNode(step));
  return {
    id: node.id,
    key: node.key,
    status: node.status,
    result: node.result?.toJSON() ?? null,
    attemptSequence: node.attemptSequence,
    // Command consumers use the established tree convention: a missing
    // `children` property is a leaf.  An empty array would be interpreted as
    // another branch level and corrupt depth-first lifecycle resolution.
    ...(children.length > 0 && { children }),
  };
}

function taskNode(state, taskId) {
  const node = state.findNode(taskId);
  return node instanceof TaskNode ? node : null;
}

function projectTask(state, entry) {
  const node = taskNode(state, entry.id);
  if (node === null) {
    throw new CurrentFlowStateInvariantError(`canonical spec Task is absent from Flow state: ${entry.id}`);
  }
  return {
    ...structuredClone(entry.document),
    id: entry.id,
    key: entry.key,
    status: node.status,
    steps: node.steps.map((step) => projectNode(step)),
  };
}

function currentTaskId(state) {
  if (state.current === null) return null;
  return state.current
    .map((nodeId) => state.findNode(nodeId))
    .find((node) => node instanceof TaskNode)?.id ?? null;
}

function taskIdForNode(state, nodeId) {
  const nodePath = state.definition.pathFor(state.root, nodeId);
  if (nodePath === null) return null;
  return nodePath
    .map((id) => state.findNode(id))
    .find((node) => node instanceof TaskNode)?.id ?? null;
}

function runtimeMetadataNode(state, stepId, location) {
  const requested = requiredText(stepId, "step runtime metadata stepId");
  const explicit = state.findNode(requested);
  if (explicit !== null) {
    const taskId = taskIdForNode(state, explicit.id);
    if (taskId !== null) location.taskArtifactLocation(taskId);
    return explicit;
  }
  if (!TASK_RUNTIME_STEP_ALIASES.has(requested)) {
    throw new CurrentFlowStateInvariantError(`canonical runtime Step is absent: ${requested}`);
  }
  const activeId = state.current?.at(-1) ?? null;
  const active = activeId === null ? null : state.findNode(activeId);
  const taskId = active === null ? null : taskIdForNode(state, active.id);
  if (active === null || taskId === null || active.id !== `${taskId}-${requested.slice("task-".length)}`) {
    throw new CurrentFlowStateInvariantError(`canonical runtime Task Step is not active: ${requested}`);
  }
  location.taskArtifactLocation(taskId);
  return active;
}

function observationTimestamp(activity) {
  return activity.timing?.finishedAt ?? null;
}

function projectObservations(state, activities) {
  if (!Array.isArray(activities)) {
    throw new CurrentFlowStateInvariantError("canonical runtime observations require an Activity list");
  }
  const metrics = [];
  const notes = [];
  for (const activity of activities) {
    const taskId = taskIdForNode(state, activity.nodeId);
    const timestamp = observationTimestamp(activity);
    if (activity.metric !== null) metrics.push(activity.metric.toMetricEntry({ taskId, timestamp }));
    if (activity.note !== null) notes.push(activity.note.toNoteEntry({ taskId, timestamp }));
  }
  return Object.freeze({ metrics: Object.freeze(metrics), notes: Object.freeze(notes) });
}

/** Dispatch code reads this established convenience field, but V1 derives it
 * from typed approval Activities instead of storing a mutable receipt array. */
function projectDispatchApprovals(activities) {
  if (!Array.isArray(activities)) {
    throw new CurrentFlowStateInvariantError("canonical runtime dispatch approvals require an Activity list");
  }
  const receipts = new Map();
  for (const activity of activities) {
    const approval = activity.transition.approval;
    if (approval === null) continue;
    const receipt = approval.toJSON();
    const previous = receipts.get(receipt.actionDigest);
    if (previous && JSON.stringify(previous) !== JSON.stringify(receipt)) {
      throw new CurrentFlowStateInvariantError("canonical Flow has conflicting dispatch approval receipts");
    }
    receipts.set(receipt.actionDigest, receipt);
  }
  return Object.freeze([...receipts.values()]);
}

function projectedState(state, specRecord, activities = []) {
  if (!(state instanceof CurrentFlowState)) {
    throw new CurrentFlowStateInvariantError("canonical runtime view requires CurrentFlowState");
  }
  if (!(specRecord instanceof CurrentFlowSpecRecord)) {
    throw new CurrentFlowStateInvariantError("canonical runtime view requires CurrentFlowSpecRecord");
  }
  const mode = state.execution.mode;
  const observations = projectObservations(state, activities);
  const flowDispatchApprovals = projectDispatchApprovals(activities);
  const advisorySummary = activities
    .map((activity) => activity.transition.nonblocking)
    .filter((record) => record?.kind === "decision" && record.action === "continue")
    .map((record) => Object.freeze({
      stepId: record.sourceStep,
      evidenceRef: record.evidenceRef,
      rationale: record.rationale,
      remainingRisk: record.remainingRisk,
    }));
  return {
    schemaRevision: state.schemaRevision,
    flowId: state.flowId,
    flowVersionId: state.flowVersionId,
    runId: state.runId,
    specId: state.specId,
    request: state.request,
    version: state.version,
    lifecycle: state.lifecycle.state,
    execution: state.execution.toJSON(),
    policy: state.policy.toJSON(),
    // Kept only as a process-boundary convenience for the established agent
    // input assembler.  Persistence remains the nested policy record above.
    autoApprove: state.policy.autoApprove,
    issue: state.issue,
    baseBranch: state.execution.baseBranch,
    featureBranch: state.execution.featureBranch,
    // These are command-view conveniences, never a second persisted schema.
    worktree: mode === "worktree",
    currentTaskId: currentTaskId(state),
    currentNodeId: state.current?.at(-1) ?? null,
    // Compatibility views for existing command input/report assemblers.  They
    // are derived from activities on every read and are never written back to
    // flow.json.
    metrics: observations.metrics,
    notes: observations.notes,
    // Read-model projection from immutable Activity facts. This is never a
    // flow.json field and is deliberately not accepted by state constructors.
    ...(advisorySummary.length > 0 && { advisorySummary: Object.freeze(advisorySummary) }),
    // Compatibility view for the dispatcher. This array is Activity-derived
    // and is intentionally absent from the exact flow.json schema. Preserve
    // the historical omission until an explicit approval actually exists.
    ...(flowDispatchApprovals.length > 0 && { flowDispatchApprovals }),
    steps: state.root.steps.map((step) => projectNode(step)),
    // A freshly written Spec may declare Tasks before the explicit
    // `add_task` Activities materialize their lifecycle nodes.  The Spec is
    // authoritative for their instructions; this runtime view exposes only
    // Task nodes that the Activity ledger has actually admitted.
    tasks: specRecord.tasks
      .filter((entry) => taskNode(state, entry.id) !== null)
      .map((entry) => projectTask(state, entry)),
  };
}

function resultFor(status, nodeId) {
  return {
    outcome: status === "done" ? "passed" : "skipped",
    summary: `canonical runtime transition for ${nodeId}`,
    confirmedAt: new Date().toISOString(),
    artifactRefs: [],
  };
}

function commandResultPayload(value, nodeId, artifactLogicalKey) {
  const fallback = Object.freeze({ nodeId, outcome: "completed" });
  if (value == null) return fallback;
  if (typeof value !== "object" || Array.isArray(value)) {
    return Object.freeze({ nodeId, outcome: "completed", value: String(value) });
  }
  // Flow command envelopes are JSON values.  A clone through JSON prevents a
  // command-local class instance, function, or undefined field from leaking
  // into the permanent artifact contract.
  let result;
  try {
    result = JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new CurrentFlowStateInvariantError(`canonical command result must be JSON-serializable: ${error.message}`);
  }
  const attached = attachedCanonicalCommandResultArtifact(value);
  if (attached !== null && attached.logicalKey !== artifactLogicalKey) {
    throw new CurrentFlowStateInvariantError(
      `canonical command result artifact does not belong to ${artifactLogicalKey}: ${attached.logicalKey}`,
    );
  }
  return Object.freeze({
    nodeId,
    outcome: "completed",
    result,
    ...(attached !== null && { artifact: attached.toJSON() }),
  });
}

function emptyAttempt(state, nodeId) {
  const node = state.findNode(nodeId);
  if (node === null || node.steps.length !== 0) {
    throw new CurrentFlowStateInvariantError(`Attempt target must be a leaf: ${nodeId}`);
  }
  const requiredResources = state.definition.contractForNode(node).resourceContract.required;
  if (requiredResources.length > 0) {
    throw new CurrentFlowStateInvariantError(
      `canonical runtime requires a typed Attempt with resource claims for ${nodeId}`,
    );
  }
  return new CurrentAttempt({
    id: activityId(`attempt-${nodeId}`),
    nodeId,
    sequence: node.attemptSequence + 1,
    startedAt: new Date().toISOString(),
    consumption: { semantic: 0, tooling: 0 },
    failure: null,
    blocker: null,
    incomplete: [],
    operationClaims: [],
  }).toJSON();
}

/**
 * Starting a worker is itself the command-context resolution operation.  The
 * Attempt records that operation once, with the definition-owned resource
 * kinds it resolved; it never copies those requirements into flow.json.
 */
function commandContextAttempt(state, nodeId) {
  const node = state.findNode(nodeId);
  if (node === null || node.steps.length !== 0) {
    throw new CurrentFlowStateInvariantError(`Attempt target must be a leaf: ${nodeId}`);
  }
  const requiredResources = state.definition.contractForNode(node).resourceContract.required;
  return new CurrentAttempt({
    id: activityId(`attempt-${nodeId}`),
    nodeId,
    sequence: node.attemptSequence + 1,
    startedAt: new Date().toISOString(),
    consumption: { semantic: 0, tooling: 0 },
    failure: null,
    blocker: null,
    incomplete: [],
    operationClaims: requiredResources.length === 0
      ? []
      : [{ operation: "resolve-command-context", resources: requiredResources }],
  }).toJSON();
}

function leafNodes(node, values = []) {
  if (node.steps.length === 0) {
    values.push(node);
    return values;
  }
  for (const child of node.steps) leafNodes(child, values);
  return values;
}

function retryAttempt(state) {
  if (state.attempt === null || state.attempt.failure === null) {
    throw new CurrentFlowStateInvariantError("canonical retry requires a failed active Attempt");
  }
  const previous = state.attempt;
  const kind = previous.failure.retryKind;
  if (kind === null) {
    throw new CurrentFlowStateInvariantError("canonical retry requires a retryable Attempt failure kind");
  }
  return new CurrentAttempt({
    id: activityId(`attempt-${previous.nodeId}`),
    nodeId: previous.nodeId,
    sequence: previous.sequence + 1,
    startedAt: new Date().toISOString(),
    consumption: {
      semantic: previous.consumption.semantic + (kind === "semantic" ? 1 : 0),
      tooling: previous.consumption.tooling + (kind === "tooling" ? 1 : 0),
    },
    failure: null,
    blocker: null,
    incomplete: [],
    operationClaims: previous.operationClaims.map((claim) => claim.toJSON()),
  }).toJSON();
}

function exhaustedRecoveryAttempt(state, id = null) {
  if (state.attempt === null || state.attempt.failure === null) {
    throw new CurrentFlowStateInvariantError("canonical exhausted recovery requires a failed active Attempt");
  }
  const contract = state.definition.contractForNode(state.findNode(state.current.at(-1)));
  return new CurrentAttempt({
    id: id ?? activityId(`attempt-${state.attempt.nodeId}`),
    nodeId: state.attempt.nodeId,
    sequence: state.attempt.sequence + 1,
    startedAt: new Date().toISOString(),
    consumption: {
      semantic: state.attempt.consumption.semantic,
      tooling: contract.toolingRetryLimit ?? 0,
    },
    failure: null,
    blocker: null,
    incomplete: [],
    operationClaims: state.attempt.operationClaims.map((claim) => claim.toJSON()),
  }).toJSON();
}

function nullableString(value, field) {
  if (value == null) return null;
  return requiredText(value, field);
}

function nullableNonNegativeInteger(value, field) {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CurrentFlowStateInvariantError(`${field} must be a non-negative safe integer or null`);
  }
  return value;
}

function nullableCost(value) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new CurrentFlowStateInvariantError("metric.cost must be a non-negative number or null");
  }
  return value;
}

/** Normalizes public metric payloads into the typed Activity ledger value. */
function canonicalMetric(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new CurrentFlowStateInvariantError("canonical metric payload must be an object");
  }
  const tokens = payload.tokens == null
    ? null
    : {
        input: nullableNonNegativeInteger(payload.tokens.input ?? 0, "metric.tokens.input"),
        output: nullableNonNegativeInteger(payload.tokens.output ?? 0, "metric.tokens.output"),
        cacheRead: nullableNonNegativeInteger(payload.tokens.cacheRead ?? 0, "metric.tokens.cacheRead"),
        cacheCreation: nullableNonNegativeInteger(payload.tokens.cacheCreation ?? 0, "metric.tokens.cacheCreation"),
      };
  const counter = nullableString(payload.counter, "metric.counter");
  return new ActivityMetric({
    phase: requiredText(payload.phase, "metric.phase"),
    counter,
    delta: counter === null ? null : nullableNonNegativeInteger(payload.delta ?? 1, "metric.delta"),
    reset: payload.reset === true,
    kind: nullableString(payload.kind, "metric.kind"),
    provider: nullableString(payload.provider, "metric.provider"),
    profileKey: nullableString(payload.profileKey, "metric.profileKey"),
    callCount: nullableNonNegativeInteger(payload.callCount, "metric.callCount"),
    responseChars: nullableNonNegativeInteger(payload.responseChars, "metric.responseChars"),
    durationMs: nullableNonNegativeInteger(payload.durationMs, "metric.durationMs"),
    model: nullableString(payload.model, "metric.model"),
    tokens,
    cost: nullableCost(payload.cost),
    cachedResponse: payload.cachedResponse === true,
    costIncomplete: payload.costIncomplete === true,
  });
}

function observationNodeId(state, options = {}) {
  if (Object.hasOwn(options, "taskId")) {
    if (options.taskId === null) return state.root.id;
    const task = taskNode(state, options.taskId);
    if (task === null) throw new CurrentFlowStateInvariantError(`canonical observation Task is absent: ${options.taskId}`);
    return task.id;
  }
  return currentTaskId(state) ?? state.root.id;
}

/** Transient dispatcher metadata; it never becomes a flow.json authority. */
class CanonicalStepRuntimeLog {
  constructor(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new CurrentFlowStateInvariantError("step runtime metadata must be an object");
    }
    const fields = ["nodeId", "runId", "sequence", "attempt", "command", "startedAt", "endedAt", "exitCode"];
    for (const field of fields) {
      if (!Object.hasOwn(value, field)) throw new CurrentFlowStateInvariantError(`step runtime metadata.${field} is required`);
    }
    for (const field of Object.keys(value)) {
      if (!fields.includes(field)) throw new CurrentFlowStateInvariantError(`step runtime metadata contains unsupported field: ${field}`);
    }
    this.nodeId = requiredText(value.nodeId, "step runtime metadata.nodeId");
    this.runId = requiredText(value.runId, "step runtime metadata.runId");
    this.sequence = nullableNonNegativeInteger(value.sequence, "step runtime metadata.sequence");
    this.attempt = nullableNonNegativeInteger(value.attempt, "step runtime metadata.attempt");
    this.command = requiredText(value.command, "step runtime metadata.command");
    for (const field of ["startedAt", "endedAt"]) {
      if (value[field] !== null && Number.isNaN(Date.parse(value[field]))) {
        throw new CurrentFlowStateInvariantError(`step runtime metadata.${field} must be an ISO timestamp or null`);
      }
      this[field] = value[field];
    }
    if (value.exitCode !== null && !Number.isSafeInteger(value.exitCode)) {
      throw new CurrentFlowStateInvariantError("step runtime metadata.exitCode must be an integer or null");
    }
    this.exitCode = value.exitCode;
    Object.freeze(this);
  }

  toJSON() {
    return {
      nodeId: this.nodeId,
      runId: this.runId,
      sequence: this.sequence,
      attempt: this.attempt,
      command: this.command,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      exitCode: this.exitCode,
    };
  }
}

function specRecordAt(location) {
  try {
    return new CurrentFlowSpecRecord(
      JSON.parse(fs.readFileSync(location.specFile, "utf8")),
      { specId: location.specId.toString() },
    );
  } catch (cause) {
    throw new CurrentFlowStateInvariantError(`canonical spec.json is invalid: ${cause.message}`);
  }
}

/**
 * A fully validated fresh-flow request.  Creation intentionally takes a
 * Spec record rather than a loose object so the same serializer is used by
 * normal runtime creation and by the migration API.
 */
export class CanonicalFlowCreateRequest {
  constructor({
    specId,
    runId,
    request,
    execution = { mode: "direct" },
    policy = { autoApprove: false, nonblocking: null },
    issue = null,
    flowId = null,
    flowVersionId = null,
    specRecord,
    issueSnapshot = null,
    tasks = [],
  } = {}) {
    this.specId = canonicalSpecId(specId);
    this.runId = requiredText(runId, "runId");
    if (typeof request !== "string") {
      throw new CurrentFlowStateInvariantError("request must be a string");
    }
    this.request = request;
    if (execution === null || typeof execution !== "object" || Array.isArray(execution)) {
      throw new CurrentFlowStateInvariantError("execution is required");
    }
    this.execution = Object.freeze(new FlowExecution({
      ...execution,
      mode: executionMode(execution.mode),
    }).toJSON());
    if (policy === null || typeof policy !== "object" || typeof policy.autoApprove !== "boolean" || !Object.hasOwn(policy, "nonblocking")) {
      throw new CurrentFlowStateInvariantError("policy must include autoApprove and nonblocking");
    }
    this.policy = Object.freeze({ autoApprove: policy.autoApprove, nonblocking: policy.nonblocking });
    this.flowId = flowId ?? `flow-${this.runId}`;
    this.flowVersionId = flowVersionId ?? `flow-v1-${this.runId}`;
    if (issue !== null && (!Number.isSafeInteger(issue) || issue < 1)) {
      throw new CurrentFlowStateInvariantError("issue must be a positive integer or null");
    }
    this.issue = issue;
    // A Spec document need not duplicate its identity.  Creation already
    // owns the location-bound specId, so pass it through the same typed
    // parser used by normal prepare and migration callers rather than making
    // an otherwise valid `spec.json` invent a legacy id field.
    this.specRecord = CurrentFlowSpecRecord.from(specRecord, { specId: this.specId });
    if (this.specRecord.specId.toString() !== this.specId) {
      throw new CurrentFlowStateInvariantError("canonical create Spec record must match specId");
    }
    if (this.specRecord.tasks.length !== 0) {
      throw new CurrentFlowStateInvariantError(
        "fresh canonical spec.json.tasks must be empty; Tasks are added through typed Activities",
      );
    }
    if (issueSnapshot !== null && typeof issueSnapshot !== "string") {
      throw new CurrentFlowStateInvariantError("issueSnapshot must be a string or null");
    }
    if ((this.issue === null) !== (issueSnapshot === null)) {
      throw new CurrentFlowStateInvariantError(
        "canonical fresh Flow Issue identity and immutable issue.md snapshot must be present together",
      );
    }
    this.issueSnapshot = issueSnapshot;
    if (!Array.isArray(tasks)) throw new CurrentFlowStateInvariantError("fresh Tasks must be an array");
    const ids = new Set();
    this.tasks = Object.freeze(tasks.map((task, index) => {
      if (task === null || typeof task !== "object" || Array.isArray(task)) {
        throw new CurrentFlowStateInvariantError(`fresh Tasks[${index}] must be an object`);
      }
      const id = requiredText(task.id, `fresh Tasks[${index}].id`);
      const key = requiredText(task.key ?? task.id, `fresh Tasks[${index}].key`);
      if (ids.has(id)) throw new CurrentFlowStateInvariantError(`fresh Tasks duplicate id: ${id}`);
      ids.add(id);
      const document = structuredClone(task);
      delete document.key;
      return Object.freeze({ id, key, document: Object.freeze({ ...document, id }) });
    }));
    Object.freeze(this);
  }
}

/**
 * The manager's only persisted-state gateway.  No root-level flow.json
 * fallback exists here: an absent Version root is simply an absent Flow.
 */
export class CanonicalFlowManagerStore {
  constructor({ root, mainRoot, specRoot, activeFlowsProvider = () => [], versionStoreFaultInjector = null } = {}) {
    this.mainRoot = requiredText(mainRoot, "mainRoot");
    this.root = requiredText(root, "root");
    this.definition = buildCurrentFlowDefinition();
    this.runtime = new CanonicalFlowRuntime({
      repositoryRoot: this.mainRoot,
      executionRoot: this.root,
      specRoot,
      definition: this.definition,
      versionStoreFaultInjector,
    });
    this.activeFlowsProvider = activeFlowsProvider;
    Object.freeze(this);
  }

  location(specId) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    return this.runtime.location(resolved);
  }

  pathFor(specId) {
    const resolved = this.#resolveSpecId(specId);
    return resolved === null ? null : this.location(resolved).flowStateFile;
  }

  pathForCurrent() {
    const flows = this.activeFlowsProvider().load?.() ?? this.activeFlowsProvider();
    if (!Array.isArray(flows) || flows.length !== 1) return null;
    return this.pathFor(flows[0].specId);
  }

  load(specId) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) return null;
    const location = this.location(resolved);
    if (!fs.existsSync(location.directory)) return null;
    const snapshot = this.runtime.loadSnapshot(resolved);
    if (snapshot === null) return null;
    return projectedState(snapshot.state, specRecordAt(location), snapshot.activities);
  }

  loadReadOnly(specId) {
    return this.load(specId);
  }

  /** Return the typed state for a command that needs definition-owned facts. */
  canonicalState(specId) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) return null;
    return this.runtime.load(resolved);
  }

  /**
   * Read the typed Activity ledger for a command that must derive a durable
   * input revision from catalog publications.  This is deliberately read-only:
   * command code receives historical facts, never a mutable Activity array.
   */
  activityLedger(specId) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) return Object.freeze([]);
    const snapshot = this.runtime.loadSnapshot(resolved);
    if (snapshot === null) return Object.freeze([]);
    return Object.freeze(snapshot.activities.map((activity) => Object.freeze(activity.toJSON())));
  }

  /** Store-owned atomic source for Definition transition facts. */
  transitionSnapshot(specId) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) return null;
    const snapshot = this.runtime.loadTransitionSnapshot(resolved);
    if (snapshot === null) return null;
    return Object.freeze({
      state: snapshot.state,
      revision: snapshot.revision,
      activities: Object.freeze(snapshot.activities.map((activity) => Object.freeze(activity.toJSON()))),
      catalog: Object.freeze(snapshot.catalog.map((descriptor) => Object.freeze(structuredClone(descriptor)))),
    });
  }

  /**
   * Atomically claim the next definition-owned action through an Attempt.
   * Querying `get next-action` is the command-context operation, so this is
   * the only normal entrypoint that may begin a fresh worker Attempt.
   */
  beginNextAction(specId) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.lifecycle.state !== "active") {
      throw new CurrentFlowStateInvariantError(`cannot begin an action for a ${state.lifecycle.state} Flow`);
    }
    const next = state.nextAction();
    if (next === null) return state;
    if (next.operation === "resume") return state;
    if (next.operation === "start") {
      const attempt = commandContextAttempt(state, next.nodeId);
      this.runtime.startAttempt({
        specId: resolved,
        activityId: activityId("attempt-started"),
        nodeId: next.nodeId,
        attempt,
        retryRecoveryPublication: this.#retryBaselinePublication(state, next.nodeId, attempt),
        admission: this.#consumerAdmission(state, next.nodeId),
      });
      return this.runtime.load(resolved);
    }
    if (next.operation === "recover") {
      const attempt = commandContextAttempt(state, next.nodeId);
      this.runtime.recover({
        specId: resolved,
        activityId: activityId("attempt-recovered"),
        nodeId: next.nodeId,
        attempt,
        retryRecoveryPublication: this.#retryBaselinePublication(state, next.nodeId, attempt),
        admission: this.#consumerAdmission(state, next.nodeId),
      });
      return this.runtime.load(resolved);
    }
    if (next.operation === "retry") {
      const attempt = retryAttempt(state);
      this.runtime.retryAttempt({
        specId: resolved,
        activityId: activityId("attempt-retried"),
        attempt,
        retryRecoveryPublication: this.#retryBaselinePublication(state, next.nodeId, attempt),
      });
      return this.runtime.load(resolved);
    }
    // Rewind and terminal failure decisions need an explicit command with
    // their evidence. A within-budget retry is already fully authorized by
    // the failed Attempt and its definition-owned failure policy.
    return state;
  }

  /**
   * Claim finalize-cleanup and publish its interrupted-sync audit in one
   * Activity transaction.  The cleanup Attempt is the sole issue-log
   * producer, so the evidence cannot be orphaned between recovery commands.
   */
  beginInterruptedFinalizeSyncCleanup({ specId = null, entry, idempotencyKey } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const next = state.nextAction();
    if (next?.operation !== "start" || next.nodeId !== "finalize-cleanup") {
      throw new CurrentFlowStateInvariantError("interrupted finalize-sync recovery requires finalize-cleanup to be next");
    }
    const existing = this.readArtifact({
      specId: resolved,
      logicalKey: "issue.log",
      consumerNodeId: next.nodeId,
      optional: true,
    });
    let document;
    try {
      document = new IssueLogDocument(existing === null
        ? { entries: [] }
        : JSON.parse(existing.bytes.toString("utf8")));
    } catch (error) {
      throw new CurrentFlowStateInvariantError(`canonical issue-log is invalid: ${error.message}`);
    }
    const appended = document.append(canonicalIssueLogEntry(entry), requiredText(
      idempotencyKey,
      "interrupted finalize-sync issue-log idempotencyKey",
    ));
    this.runtime.startAttempt({
      specId: resolved,
      activityId: activityId("interrupted-finalize-sync-cleanup-started"),
      nodeId: next.nodeId,
      attempt: commandContextAttempt(state, next.nodeId),
      artifactWrites: appended.appended ? [{
        logicalKey: "issue.log",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(document.toJSON(), null, 2)}\n`, "utf8"),
      }] : [],
      admission: this.#consumerAdmission(state, next.nodeId),
    });
    return this.runtime.load(resolved);
  }

  createFresh(request) {
    const input = request instanceof CanonicalFlowCreateRequest
      ? request
      : new CanonicalFlowCreateRequest(request);
    this.runtime.createFresh({
      specId: input.specId,
      flowId: input.flowId,
      flowVersionId: input.flowVersionId,
      runId: input.runId,
      request: input.request,
      issue: input.issue,
      execution: input.execution,
      policy: input.policy,
      specRecord: input.specRecord,
      issueSnapshot: input.issueSnapshot,
    });
    for (const task of input.tasks) {
      this.runtime.addTask({
        specId: input.specId,
        activityId: activityId("task-added"),
        taskId: task.id,
        key: task.key,
        taskSpec: task.document,
      });
    }
    const location = this.location(input.specId);
    const snapshot = this.runtime.loadSnapshot(input.specId);
    return projectedState(snapshot.state, specRecordAt(location), snapshot.activities);
  }

  assertWritable(specId) {
    const location = this.location(specId);
    location.assertAuthority(null, { mustExist: true });
    return this.runtime.assertWritable(specId);
  }

  resolveWorktreePaths(state) {
    if (state?.execution?.mode !== "worktree" && state?.worktree !== true) {
      return { worktreePath: null, mainRepoPath: null };
    }
    const worktreePath = this.root === this.mainRoot
      ? path.join(
          managedDir(this.mainRoot),
          "worktree",
          state.execution.featureBranch.replace(/\//g, "-"),
        )
      : this.root;
    return { worktreePath, mainRepoPath: this.mainRoot };
  }

  updateStepStatus(transition, opts = {}) {
    const specId = this.#resolveSpecId(opts.specId ?? transition?.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(specId);
    const nodeId = requiredText(transition?.stepId, "canonical transition.stepId");
    const requestedStatus = requiredText(transition?.requestedStatus, "canonical transition.requestedStatus");
    if (requestedStatus === "in_progress") {
      if (state.current !== null) {
        throw new CurrentFlowStateInvariantError("canonical transition cannot replace an active Attempt");
      }
      return this.#beginExecutableNode(state, specId, nodeId);
    }
    if (requestedStatus === "pending") {
      // A definition lifecycle may reset a terminal leaf after a rejected
      // review.  In Version 1 that is never a mutable status patch: rewinding
      // creates the replacement Attempt and invalidates its definition-owned
      // downstream leaves through one typed recovery transition.
      if (state.current !== null) {
        throw new CurrentFlowStateInvariantError("canonical reset cannot replace an active Attempt");
      }
      return this.rewindTo(nodeId, { specId });
    }
    if (!TERMINAL_STATUSES.has(requestedStatus)) {
      throw new CurrentFlowStateInvariantError(
        `canonical transition status requires an explicit recovery Activity: ${requestedStatus}`,
      );
    }
    let confirmingState = state;
    if (confirmingState.current === null) {
      // Lifecycle plans often settle definition-owned no-op leaves (for
      // example a passed review's triage/repair leaves).  Materialize the
      // same short Attempt a normal command would own, then confirm it.  This
      // keeps Activity order, Attempt sequence, crash recovery, and state
      // transition in the one Store rather than restoring a callback patch.
      this.#beginExecutableNode(state, specId, nodeId);
      confirmingState = this.runtime.load(specId);
    } else if (confirmingState.current.at(-1) !== nodeId) {
      throw new CurrentFlowStateInvariantError(`canonical transition does not own current node: ${nodeId}`);
    }
    const artifactWrites = opts.canonicalCommandResult === undefined
      ? []
      : [
          ...this.#attemptHistoryWrites({
          specId,
          state: confirmingState,
          nodeId,
          commandResult: opts.canonicalCommandResult,
          }),
          ...this.#commandPublicationWrites(opts.canonicalCommandResult),
        ];
    return this.runtime.confirmAttempt({
      specId,
      activityId: activityId("attempt-confirmed"),
      status: requestedStatus,
      result: resultFor(requestedStatus, nodeId),
      artifactWrites,
      ...(requestedStatus === "done" && { admission: this.#producerCompletionAdmission(nodeId, artifactWrites) }),
    });
  }

  updateStepStatuses(transitions, opts = {}) {
    if (!Array.isArray(transitions) || transitions.length === 0) {
      throw new CurrentFlowStateInvariantError("canonical transitions must be a non-empty array");
    }
    let result = null;
    for (const transition of transitions) result = this.updateStepStatus(transition, opts);
    return result;
  }

  finalizeDownstream({ specId = null, action, stepIds } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const operation = action === "skip" ? "skip_finalize_downstream"
      : action === "reset" ? "reset_finalize_downstream"
        : null;
    if (operation === null) throw new CurrentFlowStateInvariantError("finalization downstream action is invalid");
    return this.runtime.finalizeDownstream({
      specId: resolved,
      activityId: activityId(operation),
      operation,
      stepIds,
    });
  }

  /**
   * Start the first definition-owned leaf of a Task.  A Task is not a second
   * mutable status machine: its status is derived from those child Steps.
   */
  startTask(taskId, opts = {}) {
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(specId);
    const task = taskNode(state, requiredText(taskId, "canonical Task id"));
    if (task === null) throw new CurrentFlowStateInvariantError(`canonical Task is absent: ${taskId}`);
    if (task.status === "done" || task.status === "skipped") {
      throw new CurrentFlowStateInvariantError(`canonical Task is already terminal: ${taskId}`);
    }
    if (state.current !== null) {
      if (currentTaskId(state) === task.id) return state;
      throw new CurrentFlowStateInvariantError("canonical Task start cannot replace an active Attempt");
    }
    const first = leafNodes(task)[0] ?? null;
    const next = state.nextAction();
    if (first === null || next?.nodeId !== first.id) {
      throw new CurrentFlowStateInvariantError(`canonical Task is not the next executable Task: ${taskId}`);
    }
    return this.runtime.startAttempt({
      specId,
      activityId: activityId("task-attempt-started"),
      nodeId: first.id,
      attempt: commandContextAttempt(state, first.id),
      admission: this.#consumerAdmission(state, first.id),
    });
  }

  /**
   * Task completion is verified from its canonical child Steps.  There is no
   * independent `currentTaskId` or writable Task status to drift from them.
   */
  completeTask(taskId, opts = {}) {
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(specId);
    const task = taskNode(state, requiredText(taskId, "canonical Task id"));
    if (task === null) throw new CurrentFlowStateInvariantError(`canonical Task is absent: ${taskId}`);
    if (task.status !== "done") {
      throw new CurrentFlowStateInvariantError(`canonical Task cannot complete before all child Steps are done: ${taskId}`);
    }
    const location = this.location(specId);
    const snapshot = this.runtime.loadSnapshot(specId);
    return projectedState(snapshot.state, specRecordAt(location), snapshot.activities);
  }

  /**
   * Perform the guarded plan-gate rewind as one Version Store transaction.
   * The frozen source observations are appended to cataloged issue-log.json
   * and referenced by the replacement Attempt Activity; flow.json carries no
   * mutable repair marker or copied history.
   */
  repairPlanGate({ specId = null, record, issueLog } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const repair = PlanGateRepairRecord.from(record);
    const state = this.runtime.load(resolved);
    repair.assertFlow(state);
    if (state.current?.at(-1) !== repair.route.gateStepId) {
      throw new CurrentFlowStateInvariantError("canonical plan gate repair source gate is not active");
    }
    const source = issueLog?.entries?.find((entry) => entry?.issueLogId === repair.sourceIssueLogId) ?? null;
    if (!repair.matchesIssueLogEntry(source)) {
      throw new CurrentFlowStateInvariantError("canonical plan gate repair source evidence changed before rewind");
    }
    const target = repair.targetStepId;
    const nextIssueLog = repair.appendToIssueLog(issueLog);
    return this.runtime.planGateRepair({
      specId: resolved,
      activityId: activityId("plan-gate-repaired"),
      nodeId: target,
      attempt: commandContextAttempt(state, target),
      references: {
        evaluations: [],
        findings: [],
        repairs: [repair.activityReference()],
        artifacts: [],
      },
      artifactWrites: [{
        logicalKey: "issue.log",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(nextIssueLog, null, 2)}\n`, "utf8"),
      }],
      admission: this.#replacementConsumerAdmission(state, {
        route: "repair-plan-gate",
        targetNodeId: target,
      }),
    });
  }

  /** Re-open a definition-authorized terminal/invalidated node as an Attempt. */
  rewindTo(nodeId, opts = {}) {
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(specId);
    const expected = opts.expectedFailedAttempt == null
      ? null
      : CurrentAttemptIdentity.from(opts.expectedFailedAttempt);
    if (expected !== null && !expected.matchesFailed(state)) {
      throw new CurrentFlowStateInvariantError("canonical failed Attempt changed before rewind");
    }
    const target = requiredText(nodeId, "canonical recovery nodeId");
    const recovery = state.recoveryTarget(state.definition.pathFor(state.root, target)).assertLegal();
    if (expected !== null && recovery.operation !== "rewind") {
      throw new CurrentFlowStateInvariantError("canonical failed Attempt has no definition-owned rewind target");
    }
    const attempt = commandContextAttempt(state, target);
    if (recovery.operation === "rewind") {
      const rewound = this.runtime.rewind({
        specId,
        activityId: activityId("attempt-rewound"),
        nodeId: target,
        attempt,
        expectedAttempt: expected,
        admission: this.#consumerAdmission(state, target),
      });
      if (rewound === null) {
        throw new CurrentFlowStateInvariantError("canonical failed Attempt changed before rewind");
      }
      return rewound;
    }
    if (recovery.operation === "recover") {
      return this.runtime.recover({
        specId,
        activityId: activityId("attempt-recovered"),
        nodeId: target,
        attempt,
        admission: this.#consumerAdmission(state, target),
      });
    }
    throw new CurrentFlowStateInvariantError(`canonical recovery is unavailable for ${target}`);
  }

  /** Atomically publish repair-required acceptance evidence and reopen impl triage. */
  repairAcceptanceReview({ specId = null, commandResult } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.current?.at(-1) !== "acceptance-review") {
      throw new CurrentFlowStateInvariantError("acceptance repair requires active acceptance-review Attempt");
    }
    const attached = attachedCanonicalCommandResultArtifact(commandResult);
    if (attached?.logicalKey !== "acceptance.review") {
      throw new CurrentFlowStateInvariantError("acceptance repair requires its canonical acceptance.review result");
    }
    const artifactWrites = [
      ...this.#attemptHistoryWrites({ specId: resolved, state, nodeId: "acceptance-review", commandResult }),
      ...this.#commandPublicationWrites(commandResult),
    ];
    const acceptanceWrite = artifactWrites.find((write) => write.logicalKey === "acceptance.review") ?? null;
    if (acceptanceWrite === null) {
      throw new CurrentFlowStateInvariantError("acceptance repair requires a cataloged acceptance.review publication");
    }
    // The reference names the exact cataloged bytes, not an unwrapped command
    // payload.  The worker route later resolves this digest through the
    // catalog, making the Activity's input binding durable and unforgeable.
    const acceptanceDigest = crypto.createHash("sha256").update(acceptanceWrite.bytes).digest("hex");
    return this.runtime.repairAcceptanceReview({
      specId: resolved,
      activityId: activityId("acceptance-review-repaired"),
      attempt: commandContextAttempt(state, "impl-triage"),
      result: {
        outcome: "passed",
        summary: "acceptance review requires implementation repair",
        confirmedAt: new Date().toISOString(),
        artifactRefs: [{ kind: "acceptance-review", id: acceptanceDigest }],
      },
      references: { evaluations: [], findings: [], repairs: [], artifacts: [{ id: acceptanceDigest, label: "acceptance.review" }] },
      artifactWrites,
      admission: this.#replacementConsumerAdmission(state, {
        route: "repair-acceptance-review",
        targetNodeId: "impl-triage",
      }),
    });
  }

  /**
   * Canonical stale-test-evidence recovery.  The source and target are fixed
   * by the Flow definition, so this is not a generic lifecycle mutation API.
   */
  rewindTestEvidence({ specId = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (!new Set(["impl-gate", "retro"]).has(state.current?.at(-1))) {
      throw new CurrentFlowStateInvariantError("canonical test evidence rewind requires active impl-gate or retro");
    }
    return this.runtime.rewindTestEvidence({
      specId: resolved,
      activityId: activityId("test-evidence-rewound"),
      attempt: commandContextAttempt(state, "test-execute"),
    });
  }

  /** Replace a rejected test-review with a catalog-evidence-bound test Attempt. */
  repairTestReview({ specId = null, references } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.current?.at(-1) !== "test-review") {
      throw new CurrentFlowStateInvariantError("canonical test-review repair requires active test-review");
    }
    return this.runtime.repairTestReview({
      specId: resolved,
      activityId: activityId("test-review-repaired"),
      attempt: commandContextAttempt(state, "test"),
      references,
    });
  }

  /** Enter the fixed scenario-validity → implementation bootstrap route. */
  preimplementationBootstrap({ specId = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.current?.at(-1) !== "scenario-validity") {
      throw new CurrentFlowStateInvariantError("canonical preimplementation bootstrap requires active scenario-validity");
    }
    return this.runtime.preimplementationBootstrap({
      specId: resolved,
      activityId: activityId("preimplementation-bootstrapped"),
      attempt: commandContextAttempt(state, "implement"),
    });
  }

  /** Revalidate the fixed existing-implementation route after scenario validity. */
  recoverExistingImplementation({ specId = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.current?.at(-1) !== "scenario-validity") {
      throw new CurrentFlowStateInvariantError("canonical existing implementation recovery requires active scenario-validity");
    }
    return this.runtime.recoverExistingImplementation({
      specId: resolved,
      activityId: activityId("existing-implementation-recovered"),
      attempt: commandContextAttempt(state, "test-execute"),
    });
  }

  /** Reopen draft through one of the three definition-owned recovery routes. */
  reopenDraft({ specId = null, route } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    if (!new Set(["preimplementation", "task-addition", "spec-correction"]).has(route)) {
      throw new CurrentFlowStateInvariantError("canonical draft reopen route is invalid");
    }
    const state = this.runtime.load(resolved);
    if (state.current === null || state.current.at(-1) === "draft") {
      throw new CurrentFlowStateInvariantError("canonical draft reopen requires an active post-draft Attempt");
    }
    const taskNodes = state.findNode(state.definition.dynamicTaskContainerId)?.steps ?? [];
    const hasDoneTask = taskNodes.some((task) => task.status === "done");
    if (route === "task-addition" && !hasDoneTask) {
      throw new CurrentFlowStateInvariantError("canonical task-addition reopen requires a completed Task");
    }
    if (route === "preimplementation" && hasDoneTask) {
      throw new CurrentFlowStateInvariantError("canonical preimplementation reopen cannot follow a completed Task");
    }
    return this.runtime.reopenDraft({
      specId: resolved,
      activityId: activityId(`draft-reopened-${route}`),
      route,
      attempt: commandContextAttempt(state, "draft"),
    });
  }

  retryCurrentAttempt(opts = {}) {
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(specId);
    const attempt = retryAttempt(state);
    return this.runtime.retryAttempt({
      specId,
      activityId: activityId("attempt-retried"),
      attempt,
      retryRecoveryPublication: this.#retryBaselinePublication(state, state.current?.at(-1), attempt),
    });
  }

  retryExhaustedAttempt({ specId = null, receipt } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const typed = receipt instanceof RetryRecoveryReceipt ? receipt : new RetryRecoveryReceipt(receipt);
    const state = this.runtime.load(resolved);
    if (state.current === null || state.attempt?.failure === null) {
      throw new CurrentFlowStateInvariantError("canonical exhausted recovery requires a failed active Attempt");
    }
    const nodeId = state.current.at(-1);
    const route = retryEvidenceRouteForNode(state, nodeId);
    if (route === null || !typed.previous.route.equals(route)) {
      throw new CurrentFlowStateInvariantError("exhausted recovery receipt route does not match the active leaf");
    }
    if (
      typed.previous.attemptId !== state.attempt.id
      || typed.previous.attempt !== state.attempt.sequence
      || typed.previous.runId !== state.runId
      || typed.previous.specId !== state.specId
      || typed.previous.issue !== (state.issue ?? null)
      || typed.current.runId !== state.runId
      || typed.current.specId !== state.specId
      || typed.current.issue !== (state.issue ?? null)
      || typed.current.attempt !== state.attempt.sequence + 1
    ) {
      throw new CurrentFlowStateInvariantError("exhausted recovery receipt identity does not match the active Attempt and Flow");
    }
    const nextAttempt = exhaustedRecoveryAttempt(state, typed.current.attemptId);
    return this.runtime.retryRecoveryAttempt({
      specId: resolved,
      activityId: activityId("attempt-recovered-after-exhaustion"),
      attempt: nextAttempt,
      retryRecoveryPublication: RetryRecoveryArtifactPublication.receipt(typed),
      references: { evaluations: [], findings: [], repairs: [], artifacts: [] },
    });
  }

  addTask(task, opts = {}) {
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const addition = canonicalTaskAddition(task);
    return this.runtime.addTask({
      specId,
      activityId: activityId("task-added"),
      taskId: addition.id,
      key: addition.key,
      taskSpec: addition.taskSpec,
    });
  }

  /**
   * Parent-only Task admission used by approval continuation.  The runtime
   * persists a distinct Activity and checks the typed recovery authority
   * under the catalog lock before adding the Task or updating spec.json.
   */
  #addApprovalTask(task, { specId, sourceDescriptor, sourceTask }) {
    const addition = canonicalTaskAddition(task);
    return this.runtime.addApprovalTask({
      specId,
      activityId: activityId("approval-task-added"),
      taskId: addition.id,
      key: addition.key,
      taskSpec: addition.taskSpec,
      admission: new ApprovalTaskAdmission({ sourceDescriptor, sourceTask }),
    });
  }

  applyActivity(activity, opts = {}) {
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    if (rawActivityHasMutationOptions(opts)) {
      throw new CanonicalRawActivityReplayOnlyError(
        "canonical raw Activity replay cannot carry mutation options",
      );
    }
    const proposed = FlowActivity.canonical(activity);
    const existing = this.runtime.activities(specId).find((entry) => entry.id === proposed.id) ?? null;
    if (existing !== null) {
      if (!rawActivityReplayMatches(existing, proposed)) {
        throw new CanonicalRawActivityReplayOnlyError(
          "canonical raw Activity replay must exactly match the immutable ledger Activity",
        );
      }
      return this.runtime.apply(specId, proposed);
    }
    // Preserve the stronger finalized-state diagnostic for the historical
    // public call.  The Runtime still rejects it without an append; active
    // Flows receive the explicit replay-only boundary error below.
    if (this.runtime.load(specId)?.lifecycle.state === "finalized") {
      return this.runtime.apply(specId, proposed);
    }
    throw new CanonicalRawActivityReplayOnlyError();
  }

  /**
   * Shared producer boundary for durable non-result artifacts.  Callers name
   * a definition leaf; the Store derives the catalog claim and Activity
   * identity from that leaf instead of accepting a path or an authority.
   */
  publishArtifacts({ specId = null, nodeId, artifactWrites, artifactRemovals = undefined, artifactBaselines = undefined, testSourceBaseline = undefined } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (containsRetryRecoveryArtifactWrite(artifactWrites)) {
      throw new CurrentFlowStateInvariantError(
        "retry recovery artifacts require the dedicated canonical retry transition",
      );
    }
    const producerNodeId = requiredText(nodeId, "canonical artifact publication nodeId");
    const expectedAttempt = state.current?.at(-1) === producerNodeId && state.attempt !== null
      ? CurrentAttemptIdentity.from(state.attempt)
      : null;
    return this.runtime.publishArtifacts({
      specId: resolved,
      activityId: activityId("artifacts-published"),
      nodeId: producerNodeId,
      artifactWrites,
      artifactRemovals,
      artifactBaselines,
      testSourceBaseline,
      ...(expectedAttempt === null ? {} : { expectedAttempt }),
    });
  }

  promoteDraftQuestionAndKeepRefineActive({
    specId = null,
    questionId,
    questionRevision,
    digest,
    byteLength,
    sourceBytes,
    sourcePayloadDigest,
    handoffDigest,
    handoffRequestDigest,
  } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    if (typeof questionId !== "string" || questionId.trim() === "") throw new CurrentFlowStateInvariantError("draft promotion questionId is required");
    if (!Number.isSafeInteger(questionRevision) || questionRevision < 0) throw new CurrentFlowStateInvariantError("draft promotion questionRevision is invalid");
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest) || !Number.isSafeInteger(byteLength) || byteLength < 0) throw new CurrentFlowStateInvariantError("draft promotion baseline is invalid");
    if (!Buffer.isBuffer(sourceBytes)) throw new CurrentFlowStateInvariantError("draft promotion sourceBytes are required");
    if (typeof sourcePayloadDigest !== "string" || !/^[a-f0-9]{64}$/.test(sourcePayloadDigest)) {
      throw new CurrentFlowStateInvariantError("draft promotion sourcePayloadDigest is invalid");
    }
    if (typeof handoffDigest !== "string" || !/^[a-f0-9]{64}$/.test(handoffDigest)) {
      throw new CurrentFlowStateInvariantError("draft promotion handoffDigest is invalid");
    }
    if (typeof handoffRequestDigest !== "string" || !/^[a-f0-9]{64}$/.test(handoffRequestDigest)) {
      throw new CurrentFlowStateInvariantError("draft promotion handoffRequestDigest is invalid");
    }
    const actualSourceDigest = crypto.createHash("sha256").update(sourceBytes).digest("hex");
    if (actualSourceDigest !== sourcePayloadDigest) {
      throw new CurrentFlowStateInvariantError("draft promotion sourceBytes do not match sourcePayloadDigest");
    }
    let sourceDraft;
    try {
      sourceDraft = new DraftLifecycle(JSON.parse(sourceBytes.toString("utf8")));
    } catch (cause) {
      throw new CurrentFlowStateInvariantError(`draft promotion source draft is invalid: ${cause.message}`);
    }
    let promotedDraft;
    try {
      promotedDraft = sourceDraft.withQuestionLedger(
        sourceDraft.questionLedger.transitionCandidate(questionId, questionRevision),
      );
    } catch (cause) {
      throw new CurrentFlowStateInvariantError(`draft promotion does not match source ledger: ${cause.message}`);
    }
    const promotedBytes = Buffer.from(`${JSON.stringify(promotedDraft, null, 2)}\n`, "utf8");
    const promotedDigest = crypto.createHash("sha256").update(promotedBytes).digest("hex");
    const state = this.runtime.load(resolved);
    if (state.current?.at(-1) !== "draft-refine" || state.attempt === null) throw new CurrentFlowStateInvariantError("draft promotion requires active draft-refine");
    return this.runtime.publishArtifacts({
      specId: resolved, activityId: activityId("draft-question-promoted"), nodeId: "draft-refine",
      expectedAttempt: CurrentAttemptIdentity.from(state.attempt),
      artifactBaselines: [new CanonicalFlowArtifactBaseline({ logicalKey: "draft", digest, byteLength })],
      artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: promotedBytes }],
      references: new ActivityReferences({
        evaluations: [],
        findings: [],
        repairs: [],
        artifacts: [
          { id: handoffDigest, label: "draft-refine handoff" },
          { id: handoffRequestDigest, label: "draft-refine handoff request" },
          { id: sourcePayloadDigest, label: "draft-refine sealed draft payload" },
          { id: promotedDigest, label: `draft question ${questionId}@${questionRevision} promoted artifact` },
        ],
      }),
    });
  }

  /** System-only writer for the upgrade command's sole durable evidence. */
  publishUpgradeResult({ specId = null, artifact } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    if (artifact?.logicalKey !== "upgrade.result") {
      throw new CurrentFlowStateInvariantError("canonical upgrade publication requires upgrade.result");
    }
    if (artifact.mediaType !== "application/json" || !Buffer.isBuffer(artifact.bytes)) {
      throw new CurrentFlowStateInvariantError("canonical upgrade publication requires JSON Buffer bytes");
    }
    let document;
    try {
      document = JSON.parse(artifact.bytes.toString("utf8"));
    } catch (cause) {
      throw new CurrentFlowStateInvariantError(`canonical upgrade result must be JSON: ${cause.message}`);
    }
    const validation = validateUpgradeResultArtifact(document);
    if (!validation.ok) {
      throw new CurrentFlowStateInvariantError(`canonical upgrade result is invalid: ${validation.reason}`);
    }
    if (document.dryRun === true) {
      throw new CurrentFlowStateInvariantError("canonical upgrade result must record a materialized upgrade");
    }
    return this.runtime.publishUpgradeResult({
      specId: resolved,
      activityId: activityId("upgrade-result-published"),
      artifactWrite: artifact,
    });
  }

  publishPluginArtifacts({ specId = null, artifactWrites } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    return this.runtime.publishPluginArtifacts({
      specId: resolved,
      activityId: activityId("plugin-artifacts-published"),
      artifactWrites,
    });
  }

  /**
   * Atomically apply one Task implementation's additions-only overview
   * contribution. The catalog remains the reader/writer authority for
   * spec.json; no command gets a Version path or a mutable state callback.
   */
  updateTaskOverview({ specId = null, taskId, additions } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const update = new CanonicalOverviewUpdate({ taskId, additions });
    const state = this.runtime.load(resolved);
    const nodeId = state.current?.at(-1) ?? null;
    update.assertActiveNode(nodeId);
    const current = this.readArtifact({
      specId: resolved,
      logicalKey: "spec.record",
      consumerNodeId: nodeId,
    });
    let document;
    try {
      document = JSON.parse(current.bytes.toString("utf8"));
    } catch (error) {
      throw new CurrentFlowStateInvariantError(`canonical spec.json is invalid: ${error.message}`);
    }
    const outcome = update.applyTo(document);
    if (!outcome.applied) return outcome.toJSON();
    this.runtime.updateSpecRecord({
      specId: resolved,
      activityId: activityId("spec-record-updated"),
      nodeId,
      specRecord: new CurrentFlowSpecRecord(outcome.document, { specId: resolved }),
    });
    return outcome.toJSON();
  }

  /** Apply user confirmation to the sole cataloged Spec record. */
  updateSpecApproval({ specId = null, approval } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const nodeId = state.current?.at(-1) ?? null;
    if (nodeId !== "approval") {
      throw new CurrentFlowStateInvariantError("canonical Spec approval requires the active approval Attempt");
    }
    const update = approval instanceof CanonicalSpecApproval
      ? approval
      : new CanonicalSpecApproval(approval);
    const source = this.readArtifact({
      specId: resolved,
      logicalKey: "spec.record",
      consumerNodeId: nodeId,
    });
    const next = update.apply(JSON.parse(source.bytes.toString("utf8")));
    this.runtime.updateSpecRecord({
      specId: resolved,
      activityId: activityId("spec-approval-recorded"),
      nodeId,
      specRecord: new CurrentFlowSpecRecord(next, { specId: resolved }),
    });
    return update.toJSON();
  }

  /**
   * Parent-owned approval continuation. Task admission happens while the
   * approval Attempt remains active; a crash can therefore only replay the
   * missing additions before the one confirmation that writes approval.
   */
  approveSpecContinuation({ specId = null, approval } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const update = approval instanceof CanonicalSpecApproval
      ? approval
      : new CanonicalSpecApproval(approval);
    let state = this.runtime.load(resolved);
    if (state.current?.at(-1) !== "approval") {
      throw new CurrentFlowStateInvariantError("canonical Spec approval requires the active approval Attempt");
    }
    const source = this.readArtifact({
      specId: resolved,
      logicalKey: "spec.record",
      consumerNodeId: "approval",
    });
    const document = JSON.parse(source.bytes.toString("utf8"));
    const sourceHash = source.descriptor.hash;
    const taskContainer = state.findNode(state.definition.dynamicTaskContainerId);
    const existing = new Set((taskContainer?.steps || []).map((task) => task.id));
    const added = [];
    for (const task of new TaskCollection(document.tasks ?? []).admissionOrder()) {
      if (existing.has(task.id.value)) continue;
      const currentSource = this.readArtifact({
        specId: resolved,
        logicalKey: "spec.record",
        consumerNodeId: "approval",
      });
      if (currentSource.descriptor.hash !== sourceHash) {
        throw new CurrentFlowStateConflictError("canonical spec.record changed during approval Task admission");
      }
      const currentDocument = JSON.parse(currentSource.bytes.toString("utf8"));
      const sourceTask = (currentDocument.tasks ?? []).find((candidate) => candidate.id === task.id.value) ?? null;
      if (sourceTask === null) {
        throw new CurrentFlowStateConflictError(`canonical spec.record lost approval Task: ${task.id.value}`);
      }
      const { id, parent, ...taskDocument } = task;
      this.#addApprovalTask({
        id: id.value,
        parent: parent === null ? null : parent.value,
        ...structuredClone(taskDocument),
      }, {
        specId: resolved,
        sourceDescriptor: currentSource.descriptor,
        sourceTask,
      });
      existing.add(id.value);
      added.push(id.value);
      state = this.runtime.load(resolved);
    }
    const approvedDocument = update.apply(document);
    this.runtime.confirmAttempt({
      specId: resolved,
      activityId: activityId("spec-approval-confirmed"),
      result: {
        outcome: "passed",
        summary: "explicit Spec approval confirmed",
        confirmedAt: update.confirmedAt,
        artifactRefs: [],
      },
      specRecord: new CurrentFlowSpecRecord(approvedDocument, { specId: resolved }),
    });
    return Object.freeze({ user_approval: update.toJSON(), added: Object.freeze(added) });
  }

  /**
   * Append one durable issue fact through the current producer's Activity.
   *
   * This replaces the former independent issue-log file writer for normal
   * runtime paths: the catalog descriptor and its append-only publication
   * Activity are now committed by this same Version Store boundary.
   */
  appendIssueLog({ specId = null, entry, idempotencyKey } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const nodeId = state.current?.at(-1) ?? null;
    if (nodeId === null) throw new CurrentFlowStateInvariantError("canonical issue-log append requires an active Attempt");
    const key = requiredText(idempotencyKey, "canonical issue-log idempotencyKey");
    const existing = this.readArtifact({
      specId: resolved,
      logicalKey: "issue.log",
      consumerNodeId: nodeId,
      optional: true,
    });
    let document;
    try {
      document = new IssueLogDocument(existing === null
        ? { entries: [] }
        : JSON.parse(existing.bytes.toString("utf8")));
    } catch (error) {
      throw new CurrentFlowStateInvariantError(`canonical issue-log is invalid: ${error.message}`);
    }
    const appended = document.append(canonicalIssueLogEntry(entry), key);
    if (!appended.appended) {
      return Object.freeze({ ...appended, total: document.entries.length });
    }
    this.publishArtifacts({
      specId: resolved,
      nodeId,
      artifactWrites: [{
        logicalKey: "issue.log",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(document.toJSON(), null, 2)}\n`, "utf8"),
      }],
    });
    return Object.freeze({ ...appended, total: document.entries.length });
  }

  /** Atomically merge a requirement's file-map paths through its catalog contract. */
  updateFileMap({ specId = null, requirementId, paths } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const nodeId = state.current?.at(-1) ?? null;
    const updater = nodeId === null ? null : FlowArtifactUpdater.fromActivityNodeId(nodeId).toString();
    if (updater !== "implement" && updater !== "task-impl") {
      throw new CurrentFlowStateInvariantError("canonical file-map updates require an active implementation Attempt");
    }
    const update = new CanonicalFileMapUpdate({ requirementId, paths });
    const spec = JSON.parse(this.readArtifact({
      specId: resolved, logicalKey: "spec.record", consumerNodeId: nodeId,
    }).bytes.toString("utf8"));
    const current = this.readArtifact({
      specId: resolved, logicalKey: "file.map", consumerNodeId: nodeId, optional: true,
    });
    const fileMap = current === null ? {} : JSON.parse(current.bytes.toString("utf8"));
    const next = update.apply({ spec, fileMap });
    this.publishArtifacts({
      specId: resolved,
      nodeId,
      artifactWrites: [{
        logicalKey: "file.map",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(next, null, 2)}\n`, "utf8"),
      }],
    });
    return next;
  }

  updateRequirementStatus({ specId = null, reference, status } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const nodeId = state.current?.at(-1) ?? null;
    if (nodeId === null || FlowArtifactUpdater.fromActivityNodeId(nodeId).toString() !== "task-impl") {
      throw new CurrentFlowStateInvariantError("canonical requirement status updates require an active Task implementation Attempt");
    }
    const update = new CanonicalRequirementStatusUpdate({ reference, status });
    const source = this.readArtifact({
      specId: resolved, logicalKey: "spec.record", consumerNodeId: nodeId,
    });
    const outcome = update.apply(JSON.parse(source.bytes.toString("utf8")));
    this.runtime.updateSpecRecord({
      specId: resolved,
      activityId: activityId("spec-record-updated"),
      nodeId,
      specRecord: new CurrentFlowSpecRecord(outcome.document, { specId: resolved }),
    });
    return outcome;
  }

  recordDispatchApproval({ specId = null, receipt } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const normalized = new ActivityDispatchApproval(receipt).toJSON();
    const snapshot = this.runtime.loadSnapshot(resolved);
    if (normalized.runId !== snapshot.state.runId) {
      throw new CurrentFlowStateInvariantError("canonical dispatch approval receipt runId does not match the Flow");
    }
    const existing = projectDispatchApprovals(snapshot.activities)
      .find((candidate) => candidate.actionDigest === normalized.actionDigest) ?? null;
    if (existing !== null) {
      if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
        throw new CurrentFlowStateInvariantError("canonical dispatch approval cannot replace its exact receipt");
      }
      return existing;
    }
    this.runtime.recordDispatchApproval({
      specId: resolved,
      activityId: `dispatch-approval-${normalized.approvalToken}`,
      approval: normalized,
    });
    return normalized;
  }

  /**
   * The persisted outbox is deliberately just the active work set.  Begin,
   * completion, and failure are typed Activities, so recovery derives prior
   * outcomes from the journal instead of reviving an old mutable outbox blob.
   */
  beginOutbox({ specId = null, id, operation } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const outbox = canonicalOutboxInput({ id, operation });
    const existing = this.outboxStatus({ specId: resolved, ...outbox });
    if (["pending", "done"].includes(existing.status)) return existing;
    this.runtime.beginOutbox({
      specId: resolved,
      activityId: activityId("outbox-started"),
      outbox: canonicalOutboxActivity({
        outbox,
        attempt: existing.status === "failed" ? existing.attempt + 1 : 1,
      }),
    });
    return this.outboxStatus({ specId: resolved, ...outbox });
  }

  completeOutbox({ specId = null, id, operation, result = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const outbox = canonicalOutboxInput({ id, operation });
    const existing = this.outboxStatus({ specId: resolved, ...outbox });
    if (existing.status === "done") return existing;
    if (existing.status !== "pending") {
      throw new CurrentFlowStateInvariantError("canonical outbox completion requires an outstanding operation");
    }
    this.runtime.completeOutbox({
      specId: resolved,
      activityId: activityId("outbox-completed"),
      outbox: canonicalOutboxActivity({
        outbox,
        attempt: existing.attempt,
        result,
        exactRecoveryReceipt: existing.exactRecoveryReceipt,
      }),
    });
    return Object.freeze({ ...this.outboxStatus({ specId: resolved, ...outbox }), result });
  }

  failOutbox({ specId = null, id, operation, failure, failureCode = null, recovery = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const outbox = canonicalOutboxInput({ id, operation });
    const existing = this.outboxStatus({ specId: resolved, ...outbox });
    if (existing.status !== "pending") {
      throw new CurrentFlowStateInvariantError("canonical outbox failure requires an outstanding operation");
    }
    this.runtime.failOutbox({
      specId: resolved,
      activityId: activityId("outbox-failed"),
      outbox: canonicalOutboxActivity({
        outbox,
        attempt: existing.attempt,
        failure: requiredText(failure, "canonical outbox failure"),
        failureCode,
        recovery,
        exactRecoveryReceipt: existing.exactRecoveryReceipt,
      }),
    });
    return this.outboxStatus({ specId: resolved, ...outbox });
  }

  reopenOutboxExact({ specId = null, id, operation, attempt, failure, recoveryKey = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const outbox = canonicalOutboxInput({ id, operation });
    const existing = this.outboxStatus({ specId: resolved, ...outbox });
    if (existing.status !== "failed") {
      throw new CurrentFlowStateInvariantError("exact recovery requires a failed canonical outbox entry");
    }
    if (existing.attempt !== attempt) {
      throw new CurrentFlowStateInvariantError("exact recovery attempt does not match the canonical outbox entry");
    }
    if (existing.failure !== failure) {
      throw new CurrentFlowStateInvariantError("exact recovery failure does not match the canonical outbox entry");
    }
    if (
      existing.exactRecoveryReceipt !== null
      && (
        recoveryKey === null
        || existing.exactRecoveryReceipt.recoveryKey === recoveryKey
      )
    ) {
      throw new CurrentFlowStateInvariantError("exact recovery was already consumed for this canonical outbox entry");
    }
    this.runtime.reopenOutbox({
      specId: resolved,
      activityId: activityId("outbox-reopened"),
      outbox: canonicalOutboxActivity({
        outbox,
        attempt,
        exactRecoveryReceipt: {
          idempotencyKey: outbox.id,
          attempt,
          failure,
          recoveryKey,
        },
      }),
    });
    return this.outboxStatus({ specId: resolved, ...outbox });
  }

  outboxStatus({ specId = null, id, operation } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const outbox = canonicalOutboxInput({ id, operation });
    const snapshot = this.runtime.loadSnapshot(resolved);
    const matching = snapshot.activities.filter((activity) => (
      activity.transition.outbox !== null && activity.transition.outbox.id === outbox.id
    ));
    for (const activity of matching) {
      if (activity.transition.outbox.operation !== outbox.operation) {
        throw new CurrentFlowStateInvariantError("canonical outbox id cannot change its operation");
      }
    }
    const latest = matching.at(-1) ?? null;
    const active = snapshot.state.outbox.find(outbox.id);
    if (active !== null && active.operation !== outbox.operation) {
      throw new CurrentFlowStateInvariantError("canonical outbox id cannot change its operation");
    }
    const attempts = matching.map((activity) => activity.transition.outbox.attempt);
    const timing = latest?.timing?.toJSON() ?? null;
    const status = active !== null
      ? "pending"
      : latest?.transition.operation === "complete_outbox"
        ? "done"
        : latest?.transition.operation === "fail_outbox"
          ? "failed"
          : "missing";
    return Object.freeze({
      ...outbox,
      status,
      attempt: attempts.at(-1) ?? 0,
      startedAt: matching.findLast((activity) => (
        activity.transition.outbox.attempt === attempts.at(-1)
        && ["begin_outbox", "reopen_outbox"].includes(activity.transition.operation)
      ))?.timing?.startedAt ?? null,
      updatedAt: timing?.finishedAt ?? null,
      failure: latest?.transition.outbox?.failure ?? null,
      failureHistory: Object.freeze(matching
        .filter((activity) => activity.transition.operation === "fail_outbox")
        .map((activity) => Object.freeze({
          attempt: activity.transition.outbox.attempt,
          failure: activity.transition.outbox.failure,
          recordedAt: activity.timing?.finishedAt ?? null,
          code: activity.transition.outbox.failureCode,
          recovery: activity.transition.outbox.recovery?.toJSON() ?? null,
        }))),
      exactRecoveryReceipt: latest?.transition.outbox?.exactRecoveryReceipt?.toJSON() ?? null,
      result: latest?.transition.outbox?.result?.toJSON() ?? null,
      activityId: latest?.id ?? null,
    });
  }

  /**
   * The normal worker completion boundary.  One Store operation appends the
   * confirmation Activity, advances flow.json, writes producer-owned bytes,
   * and replaces the catalog descriptors.  It deliberately accepts no
   * mutable flow-state callback.
   */
  confirmCurrentAttempt({ specId = null, status = "done", result = null, references = undefined, specRecord = undefined, artifactWrites = [], artifactRemovals = undefined, artifactBaselines = undefined, testSourceBaseline = undefined } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.current === null) throw new CurrentFlowStateInvariantError("canonical completion requires an active Attempt");
    const nodeId = state.current.at(-1);
    const confirmation = result ?? resultFor(status, nodeId);
    return this.runtime.confirmAttempt({
      specId: resolved,
      activityId: activityId("attempt-confirmed"),
      status,
      result: confirmation,
      references,
      specRecord,
      artifactWrites,
      artifactRemovals,
      artifactBaselines,
      testSourceBaseline,
      ...(status === "done" && { admission: this.#producerCompletionAdmission(nodeId, artifactWrites) }),
    });
  }

  /** Settle only the acceptance-review-owned, artifactless no-op decision. */
  completeAcceptanceDecisionNoOp({ specId = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    let state = this.runtime.load(resolved);
    if (state.current === null) {
      this.#beginExecutableNode(state, resolved, "acceptance-decision");
      state = this.runtime.load(resolved);
    }
    if (state.current?.at(-1) !== "acceptance-decision" || state.attempt?.failure !== null) {
      throw new CurrentFlowStateInvariantError("acceptance decision no-op requires its active unfailed Attempt");
    }
    return this.runtime.completeAcceptanceDecisionNoOp({
      specId: resolved,
      activityId: activityId("acceptance-decision-noop-completed"),
      result: resultFor("done", "acceptance-decision"),
      references: { evaluations: [], findings: [], repairs: [], artifacts: [] },
      admission: new AcceptanceDecisionNoOpAdmission(),
    });
  }

  /**
   * Commit a sealed source-worker effect and its Attempt confirmation in one
   * Version Store transaction. Workers never receive this surface.
   */
  confirmSourceWorkerHandoff({ specId = null, effect, handoffDigest, result, upgradeResult = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    if (!(effect instanceof SourceWorkerEffect)) {
      throw new CurrentFlowStateInvariantError("canonical source worker effect must be a sealed SourceWorkerEffect");
    }
    const state = this.runtime.load(resolved);
    const nodeId = state.current?.at(-1) ?? null;
    const effectTargetsActiveNode = nodeId === effect.stepId
      || (effect.stepId === "task-impl" && taskIdForNode(state, nodeId) !== null && nodeId.endsWith("-impl"));
    if (!effectTargetsActiveNode) throw new CurrentFlowStateInvariantError("source worker effect does not target the active Attempt");
    const specSource = this.readArtifact({ specId: resolved, logicalKey: "spec.record", consumerNodeId: nodeId });
    let spec = JSON.parse(specSource.bytes.toString("utf8"));
    for (const change of effect.requirements) {
      spec = new CanonicalRequirementStatusUpdate(change).apply(spec).document;
    }
    if (effect.overview !== null) {
      const taskId = taskIdForNode(state, nodeId);
      if (taskId === null) throw new CurrentFlowStateInvariantError("source overview effect requires an active Task implementation");
      spec = new CanonicalOverviewUpdate({ taskId, additions: effect.overview.additions }).applyTo(spec).document;
    }
    const artifactWrites = [];
    const sourceWorkerUpgrade = upgradeResult === null
      ? null
      : new CanonicalSourceWorkerUpgradeResult({ bytes: upgradeResult });
    if (sourceWorkerUpgrade !== null) artifactWrites.push(sourceWorkerUpgrade);
    if (effect.triage !== null) {
      artifactWrites.push({
        logicalKey: "impl.triage",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(effect.triage.toJSON(), null, 2)}\n`, "utf8"),
      });
    }
    if (effect.files.length > 0) {
      const existing = this.readArtifact({ specId: resolved, logicalKey: "file.map", consumerNodeId: nodeId, optional: true });
      let fileMap = existing === null ? {} : JSON.parse(existing.bytes.toString("utf8"));
      for (const change of effect.files) {
        fileMap = new CanonicalFileMapUpdate({ requirementId: change.requirementId, paths: change.paths })
          .apply({ spec, fileMap });
      }
      artifactWrites.push({ logicalKey: "file.map", mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(fileMap, null, 2)}\n`, "utf8") });
    }
    if (effect.issues.length > 0) {
      const existing = this.readArtifact({ specId: resolved, logicalKey: "issue.log", consumerNodeId: nodeId, optional: true });
      const issues = new IssueLogDocument(existing === null ? { entries: [] } : JSON.parse(existing.bytes.toString("utf8")));
      effect.issues.forEach((entry, index) => {
        issues.append({
          step: nodeId,
          reason: entry.reason,
          ...(entry.trigger === null ? {} : { trigger: entry.trigger }),
          ...(entry.resolution === null ? {} : { resolution: entry.resolution }),
          taskId: taskIdForNode(state, nodeId),
          timestamp: result.confirmedAt,
        }, `source-handoff:${handoffDigest}:${index}`);
      });
      artifactWrites.push({ logicalKey: "issue.log", mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(issues.toJSON(), null, 2)}\n`, "utf8") });
    }
    if (effect.repair !== null) {
      artifactWrites.push({
        logicalKey: "impl.repair",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(effect.repair.toJSON(), null, 2)}\n`, "utf8"),
      });
      return this.runtime.repairImplementation({
        specId: resolved,
        activityId: activityId("impl-repair-invalidated"),
        attempt: commandContextAttempt(state, "test-execute"),
        result,
        references: {
          evaluations: [],
          findings: effect.repair.appliedFindingKeys.map((id) => ({ id, label: "impl-repair applied finding" })),
          repairs: [{ id: handoffDigest, label: "source worker repair handoff" }],
          artifacts: [{ id: handoffDigest, label: "worker-handoff" }],
        },
        artifactWrites,
        ...(sourceWorkerUpgrade === null ? {} : { sourceWorkerUpgrade: true }),
      });
    }
    if (effect.triage !== null && effect.triage.dispositions.every((entry) => entry.disposition === "reject")) {
      return this.runtime.triageImplementationNoRepair({
        specId: resolved,
        activityId: activityId("impl-triage-no-repair"),
        attempt: commandContextAttempt(state, "impl-gate"),
        result,
        references: {
          evaluations: [],
          findings: effect.triage.dispositions.map((entry) => ({ id: entry.findingKey, label: "impl-triage rejected finding" })),
          repairs: [],
          artifacts: [{ id: handoffDigest, label: "worker-handoff" }],
        },
        artifactWrites,
        ...(sourceWorkerUpgrade === null ? {} : { sourceWorkerUpgrade: true }),
      });
    }
    if (effect.triage !== null) {
      return this.runtime.triageImplementationForRepair({
        specId: resolved,
        activityId: activityId("impl-triage-repair"),
        attempt: commandContextAttempt(state, "impl-repair"),
        result,
        references: {
          evaluations: [],
          findings: effect.triage.dispositions.map((entry) => ({ id: entry.findingKey, label: "impl-triage applying finding" })),
          repairs: [{ id: handoffDigest, label: "source worker triage handoff" }],
          artifacts: [{ id: handoffDigest, label: "worker-handoff" }],
        },
        artifactWrites,
        ...(sourceWorkerUpgrade === null ? {} : { sourceWorkerUpgrade: true }),
      });
    }
    const sourceSpecChanged = effect.requirements.length > 0 || effect.overview !== null;
    this.runtime.confirmAttempt({
      specId: resolved,
      activityId: activityId(nodeId === "impl-repair" ? "impl-repair-invalidation-confirmed" : "source-handoff-confirmed"),
      result,
      status: effect.completionStatus,
      ...(sourceSpecChanged ? { specRecord: new CanonicalSourceWorkerSpecCompletion(spec) } : {}),
      artifactWrites,
      ...(effect.completionStatus === "done" && { admission: this.#producerCompletionAdmission(nodeId, artifactWrites) }),
      ...(sourceWorkerUpgrade === null ? {} : { sourceWorkerUpgrade: true }),
    });
  }

  /**
   * Record a typed terminal failure for the active Attempt while preserving
   * its producer result in the same journal-first transaction.  This is the
   * error counterpart to `confirmCurrentAttempt`; callers never mutate a
   * status blob or write a retry artifact beside flow.json.
   */
  failCurrentAttempt({ specId = null, failure, result, commandResult = undefined } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.current === null || state.attempt === null) {
      throw new CurrentFlowStateInvariantError("canonical failure requires an active Attempt");
    }
    if (failure === null || typeof failure !== "object" || Array.isArray(failure)) {
      throw new CurrentFlowStateInvariantError("canonical failure facts are required");
    }
    const nodeId = state.current.at(-1);
    const now = new Date().toISOString();
    const failureResult = result ?? {
      outcome: "failed",
      summary: requiredText(failure.message, "canonical failure.message"),
      confirmedAt: now,
      artifactRefs: [],
    };
    const artifactWrites = commandResult === undefined
      ? []
      : [
          ...this.#attemptHistoryWrites({
            specId: resolved,
            state,
            nodeId,
            commandResult,
          }),
          ...this.#commandPublicationWrites(commandResult),
        ];
    return this.runtime.failAttempt({
      specId: resolved,
      activityId: activityId("attempt-failed"),
      failure,
      result: failureResult,
      artifactWrites,
    });
  }

  /**
   * Settle the exact definition-owned terminal disposition of the active
   * failed Attempt.  The caller supplies neither a result nor a target: both
   * are derived from the failed Activity and typed failure policy, so a CLI
   * continuation cannot turn a stale display decision into another route.
   */
  settleCurrentFailure({ specId = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const descriptor = state.nextAction();
    const expected = state.attempt === null ? null : CurrentAttemptIdentity.from(state.attempt);
    if (descriptor?.operation === "record") {
      const failedAttempt = state.attempt.failure;
      const expectedOutcome = descriptor.failureDisposition.outcome;
      const failure = [...this.activityLedger(resolved)].reverse().find((activity) => (
        activity.transition.operation === "fail_attempt"
        && activity.nodeId === state.current.at(-1)
        && activity.attemptId === state.attempt.id
        && activity.sequence === state.attempt.sequence
        && activity.failure?.category === failedAttempt.category
        && activity.failure?.code === failedAttempt.code
        && activity.failure?.message === failedAttempt.message
        && activity.failure?.retryable === failedAttempt.retryable
        && activity.failure?.retryKind === failedAttempt.retryKind
        && activity.result?.outcome === expectedOutcome
      )) ?? null;
      if (failure?.result == null) {
        throw new CurrentFlowStateInvariantError("canonical failed Attempt result is unavailable for recording");
      }
      const recorded = this.runtime.recordFailure({
        specId: resolved,
        activityId: activityId("attempt-failure-recorded"),
        result: failure.result,
        expectedAttempt: expected,
        admission: this.#settlementAdmission(state, failure.result),
      });
      if (recorded === null) {
        throw new CurrentFlowStateInvariantError("canonical failed Attempt changed before failure recording");
      }
      return recorded;
    }
    if (descriptor?.operation === "rewind") {
      const target = descriptor.failureDisposition.targetPath.at(-1);
      return this.rewindTo(target, { specId: resolved, expectedFailedAttempt: expected });
    }
    throw new CurrentFlowStateInvariantError("canonical failure disposition has no settle transition");
  }

  /**
   * Repair a Version-1 run created by the historical settlement bug.  It is
   * deliberately a narrow reconciliation, not a state editor: only the
   * catalog's missing primary producer output and the immutable ledger's
   * immediately recorded failure authorize restoring the old failed cursor.
   */
  recoverMissingProducerArtifact({ specId = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const candidate = this.#historicalMissingProducerArtifactCandidate(state, resolved);
    if (candidate === null) {
      throw new CurrentFlowStateInvariantError("missing producer artifact recovery cannot reconstruct the recorded producer Attempt");
    }
    return this.runtime.recoverMissingProducerArtifact({
      specId: resolved,
      activityId: activityId("missing-producer-artifact-recovered"),
      producerNodeId: candidate.producerNodeId,
      attempt: candidate.producerAttempt.toJSON(),
      references: { evaluations: [], findings: [], repairs: [], artifacts: [] },
      admission: new MissingProducerArtifactRecoveryAdmission({
        runId: state.runId,
        consumerAttempt: candidate.consumerAttempt,
        producerAttempt: candidate.producerAttempt,
        readiness: candidate.readiness,
      }),
    });
  }

  /** The single typed route consumed by next-action and the dispatcher. */
  missingProducerArtifactRoute({ specId = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) return null;
    const state = this.runtime.load(resolved);
    const catalog = this.runtime.catalog(resolved);
    const activities = this.activityLedger(resolved);
    const historical = this.#historicalMissingProducerArtifactCandidate(state, resolved);
    if (historical !== null && !historical.readiness.isReady({ state, catalog, activities })) {
      return new MissingProducerArtifactRoute({
        kind: historical.consumerAttempt === null ? "historical-gap" : "historical-consumer",
        producerNodeId: historical.producerNodeId,
        consumerNodeId: historical.consumerNodeId,
        readiness: historical.readiness,
      });
    }
    const producerNodeId = state.current?.at(-1) ?? null;
    const failed = state.attempt?.failure == null ? null : state.attempt;
    if (producerNodeId === null || failed === null) return null;
    const failureDisposition = state.nextAction();
    if (failureDisposition?.operation !== "record") return null;
    const failure = [...activities].reverse().find((activity) => (
      activity.nodeId === producerNodeId
      && activity.attemptId === failed.id
      && activity.sequence === failed.sequence
      && activity.transition.operation === "fail_attempt"
    )) ?? null;
    if (failure?.result === undefined) return null;
    const readiness = producerArtifactReadinessesForProducer({ producerNodeId })
      .find((candidate) => !candidate.isReady({ state, catalog, activities })) ?? null;
    if (readiness === null) return null;
    return new MissingProducerArtifactRoute({
      kind: "active-producer",
      producerNodeId,
      consumerNodeId: readiness.consumerNodeId,
      readiness,
    });
  }

  /**
   * Record a command-bound tooling failure only when the exact Attempt that
   * started that command is still active.  A producer may have already
   * confirmed, failed, retried, or replaced that Attempt while lifecycle
   * hooks were running; in all of those cases this is deliberately a no-op.
   */
  failCurrentAttemptIfCurrent({ specId = null, expectedRunId, expectedAttempt, failure, result, commandResult = undefined } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const expected = CurrentAttemptIdentity.from(expectedAttempt);
    const state = this.runtime.load(resolved);
    if (expectedRunId !== state.identity.runId.toString()) return false;
    if (!expected.matches(state)) return false;
    const nodeId = state.current.at(-1);
    const now = new Date().toISOString();
    const failureResult = result ?? {
      outcome: "failed",
      summary: requiredText(failure?.message, "canonical failure.message"),
      confirmedAt: now,
      artifactRefs: [],
    };
    const artifactWrites = commandResult === undefined
      ? []
      : [
          ...this.#attemptHistoryWrites({
            specId: resolved,
            state,
            nodeId,
            commandResult,
          }),
          ...this.#commandPublicationWrites(commandResult),
        ];
    const recorded = this.runtime.failAttempt({
      specId: resolved,
      activityId: activityId("attempt-tooling-failed"),
      failure,
      result: failureResult,
      artifactWrites,
      expectedAttempt: expected,
    });
    return recorded !== null;
  }

  acceptFinalRegressionFailure({ specId = null, commandResult } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.current?.at(-1) !== "final-regression" || state.attempt?.failure === null) {
      throw new CurrentFlowStateInvariantError(
        "canonical final-regression acceptance requires its failed active Attempt",
      );
    }
    const attempt = commandContextAttempt(state, "final-regression");
    const artifactWrites = [
      ...this.#attemptHistoryWrites({
        specId: resolved,
        state,
        nodeId: "final-regression",
        commandResult,
        attemptSequence: attempt.sequence,
      }),
      ...this.#commandPublicationWrites(commandResult),
    ];
    return this.runtime.acceptFinalRegressionFailure({
      specId: resolved,
      activityId: activityId("final-regression-failure-accepted"),
      attempt,
      result: {
        outcome: "passed",
        summary: "explicitly accepted final-regression failure",
        confirmedAt: new Date().toISOString(),
        artifactRefs: [],
      },
      artifactWrites,
    });
  }

  deferFailedReview({ specId = null } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const nodeId = state.current?.at(-1) ?? null;
    if (nodeId === null || !nodeId.endsWith("-review") || state.attempt?.failure === null) {
      throw new CurrentFlowStateInvariantError("canonical Review deferral requires its failed active Attempt");
    }
    const attempt = commandContextAttempt(state, nodeId);
    return this.runtime.deferFailedReview({
      specId: resolved,
      activityId: activityId("review-failure-deferred"),
      nodeId,
      attempt,
      result: {
        outcome: "passed",
        summary: "Review findings deferred to acceptance",
        confirmedAt: new Date().toISOString(),
        artifactRefs: [],
      },
    });
  }

  /**
   * Persist a current Attempt's typed result before a non-terminal command
   * outcome (for example a rejected review) returns control to the planner.
   * The same history writer is reused by confirmation, so a later retry or
   * confirmation cannot duplicate or replace this attempt's bytes.
   */
  publishCurrentAttemptResult({ specId = null, commandResult } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.current === null) throw new CurrentFlowStateInvariantError("canonical result publication requires an active Attempt");
    const nodeId = state.current.at(-1);
    const artifactWrites = [
      ...this.#attemptHistoryWrites({
      specId: resolved,
      state,
      nodeId,
      commandResult,
      }),
      ...this.#commandPublicationWrites(commandResult),
    ];
    if (artifactWrites.length === 0) return state;
    return this.runtime.publishArtifacts({
      specId: resolved,
      activityId: activityId("attempt-result-published"),
      nodeId,
      artifactWrites,
      expectedAttempt: CurrentAttemptIdentity.from(state.attempt),
    });
  }

  /**
   * Dispatcher command metadata is intentionally transient.  It is stored
   * beneath this Version's `.runtime` root and is resolved from a real node
   * id, never from a guessed legacy spec sibling path.
   */
  setStepRuntimeLog(stepId, runtimeLog, opts = {}) {
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(specId);
    const location = this.location(specId);
    const node = runtimeMetadataNode(state, stepId, location);
    if (/[/\\]/.test(node.id)) {
      throw new CurrentFlowStateInvariantError("canonical runtime Step id cannot escape the runtime directory");
    }
    const metadata = new CanonicalStepRuntimeLog({ ...runtimeLog, nodeId: node.id });
    const artifact = FLOW_ARTIFACT_CONTRACTS.resolve("runtime.step-metadata", { stepId: node.id });
    const target = location.resolve(artifact.relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o755 });
    return new AtomicFile(target, { phaseNamespace: "canonical-step-runtime-metadata" })
      .write(Buffer.from(`${JSON.stringify(metadata.toJSON(), null, 2)}\n`, "utf8"));
  }

  /**
   * Write one classified `.runtime` payload.  Runtime bytes remain outside
   * the catalog and may be discarded without affecting resume/recovery, but
   * the contract still checks that their producer owns the typed path.
   */
  writeRuntimeArtifact({ specId = null, nodeId, artifact } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const target = requiredText(nodeId, "canonical runtime artifact nodeId");
    if (state.findNode(target) === null) {
      throw new CurrentFlowStateInvariantError(`canonical runtime artifact node is absent: ${target}`);
    }
    return CanonicalFlowRuntimeArtifactWrite.from(artifact).write(this.location(resolved), target);
  }

  /**
   * Resolve a transient diagnostic through the same typed contract as its
   * writer.  It intentionally has no catalog descriptor, while callers still
   * cannot reconstruct a Version path or read a foreign producer's output.
   */
  readRuntimeArtifact({ specId = null, logicalKey, parameters = {}, consumerNodeId, optional = false } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    if (optional !== true && optional !== false) {
      throw new CurrentFlowStateInvariantError("canonical runtime artifact optional must be boolean");
    }
    const artifact = FLOW_ARTIFACT_CONTRACTS.resolve(requiredText(logicalKey, "canonical runtime artifact logicalKey"), parameters);
    if (artifact.contract.cataloged || artifact.contract.retention.toString() !== "transient") {
      throw new CurrentFlowStateInvariantError("canonical runtime artifact read requires a transient non-catalog contract");
    }
    const consumer = FlowArtifactUpdater.fromActivityNodeId(
      requiredText(consumerNodeId, "canonical runtime artifact consumer nodeId"),
    ).toString();
    if (!artifact.contract.ownership.consumers.includes(consumer)) {
      throw new CurrentFlowStateInvariantError(
        `canonical runtime artifact consumer is not authorized: ${consumer}/${artifact.logicalKey}`,
      );
    }
    const location = this.location(resolved);
    const target = location.resolve(artifact.relativePath);
    if (!fs.existsSync(target)) {
      if (optional) return null;
      throw new CurrentFlowStateInvariantError(`canonical runtime artifact is absent: ${artifact.relativePath}`);
    }
    location.assertAuthority(artifact.relativePath, { mustExist: true });
    return Object.freeze({
      relativePath: artifact.relativePath,
      mediaType: artifact.contract.authoritySlot.kind === "test-execute-log" ? "text/plain" : "application/octet-stream",
      bytes: Buffer.from(fs.readFileSync(target)),
    });
  }

  /**
   * Keep metric history in activities.jsonl.  The public `state.metrics`
   * convenience view is reconstructed by `load()` from these observations.
   */
  appendMetric(payload, opts = {}) {
    if (payload == null) return null;
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) return null;
    const state = this.runtime.load(specId);
    return this.runtime.recordMetric({
      specId,
      activityId: activityId("metric-recorded"),
      nodeId: observationNodeId(state, opts),
      metric: canonicalMetric(payload),
    });
  }

  incrementMetric(phase, counter, opts = {}) {
    if (!phase) return null;
    return this.appendMetric({ phase, counter, delta: 1 }, opts);
  }

  accumulateAgentMetrics(phase, options = {}) {
    if (!phase) return null;
    const { usage, responseChars, model, durationMs, provider, profileKey } = options;
    return this.appendMetric({
      phase,
      kind: "agent",
      provider: normalizeAgentMetricDimension(provider),
      profileKey: normalizeAgentMetricDimension(profileKey),
      callCount: 1,
      responseChars: responseChars || 0,
      ...(durationMs != null && { durationMs }),
      ...(model && { model }),
      ...(usage && {
        tokens: {
          input: usage.input_tokens || 0,
          output: usage.output_tokens || 0,
          cacheRead: usage.cache_read_tokens || 0,
          cacheCreation: usage.cache_creation_tokens || 0,
        },
        ...(usage.cost_usd != null && { cost: usage.cost_usd }),
      }),
    }, options);
  }

  addNote(text, opts = {}) {
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(specId);
    return this.runtime.recordNote({
      specId,
      activityId: activityId("note-recorded"),
      nodeId: observationNodeId(state, opts),
      note: new ActivityNote({ text }),
    });
  }

  setAutoApprove(autoApprove, opts = {}) {
    if (typeof autoApprove !== "boolean") {
      throw new CurrentFlowStateInvariantError("canonical policy.autoApprove must be boolean");
    }
    const specId = this.#resolveSpecId(opts.specId);
    if (specId === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(specId);
    if (state.policy.autoApprove === autoApprove) return state;
    return this.runtime.setPolicy({
      specId,
      activityId: activityId("policy-updated"),
      policy: { autoApprove, nonblocking: state.policy.nonblocking?.toJSON() ?? null },
    });
  }

  /** One-way advisory policy activation through the typed policy Activity. */
  activateNonblockingPolicy({ specId = null, policy } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    if (state.policy.nonblocking !== null) return state.policy.nonblocking.toJSON();
    const next = policy instanceof CurrentFlowNonBlockingPolicy
      ? policy
      : new CurrentFlowNonBlockingPolicy(policy);
    this.runtime.setPolicy({
      specId: resolved,
      activityId: activityId("policy-nonblocking-enabled"),
      policy: { autoApprove: state.policy.autoApprove, nonblocking: next.toJSON() },
    });
    return next.toJSON();
  }

  /** Record one exact observation or decision in the canonical Activity ledger. */
  recordNonblocking({ specId = null, nodeId, record, artifactWrites = undefined } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const target = requiredText(nodeId, "canonical nonblocking nodeId");
    if (state.current?.at(-1) !== target) {
      throw new CurrentFlowStateInvariantError("canonical nonblocking record requires the active current Attempt");
    }
    const fact = record instanceof ActivityNonBlockingRecord ? record : new ActivityNonBlockingRecord(record);
    const identity = JSON.stringify(fact.toJSON());
    const stableId = `nonblocking-${crypto.createHash("sha256").update(identity).digest("hex")}`;
    const existing = this.runtime.activities(resolved).find((activity) => activity.id === stableId) ?? null;
    if (existing !== null) {
      if (JSON.stringify(existing.transition.nonblocking?.toJSON?.() ?? null) !== identity) {
        throw new CurrentFlowStateInvariantError("canonical nonblocking activity identity conflict");
      }
      return existing;
    }
    return this.runtime.recordNonblocking({
      specId: resolved,
      activityId: stableId,
      nodeId: target,
      nonblocking: fact.toJSON(),
      artifactWrites,
    });
  }

  /**
   * Apply an evidence-bound advisory decision and its definition-owned
   * continuation through Activities only.  The decision fact is written
   * first; an interrupted continuation is therefore recoverable by replaying
   * this operation with the same immutable identity.
   */
  applyNonblockingDecision({ specId = null, nodeId, sourceStep, record } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const target = requiredText(nodeId, "canonical nonblocking decision nodeId");
    const route = nonblockingRouteFor(requiredText(sourceStep, "canonical nonblocking decision sourceStep"));
    if (route === null) throw new CurrentFlowStateInvariantError("canonical nonblocking decision route is unavailable");
    const fact = record instanceof ActivityNonBlockingRecord ? record : new ActivityNonBlockingRecord(record);
    if (fact.kind !== "decision") throw new CurrentFlowStateInvariantError("canonical nonblocking continuation requires a decision fact");
    const identity = JSON.stringify(fact.toJSON());
    const stableId = `nonblocking-${crypto.createHash("sha256").update(identity).digest("hex")}`;
    const existing = this.runtime.activities(resolved).find((activity) => activity.id === stableId) ?? null;
    if (existing !== null) return fact.toJSON();
    if (fact.action === "continue") {
      this.runtime.continueNonblocking({
        specId: resolved,
        activityId: stableId,
        nodeId: target,
        nonblocking: fact.toJSON(),
        skippedNodeIds: route.skippedSteps,
      });
      return fact.toJSON();
    }
    this.recordNonblocking({ specId: resolved, nodeId: target, record: fact });
    let state = this.runtime.load(resolved);
    // An identical replay after the typed continuation has completed is a
    // no-op; a crash between Activities resumes from the exact current leaf.
    if (state.current?.at(-1) !== target) return fact.toJSON();
    // A repair/retry always creates a new current Attempt episode. The
    // immutable decision remains tied to the prior artifact digest; a fresh
    // producer publication is required before another decision can be made.
    this.updateStepStatus({ stepId: target, requestedStatus: "done" }, { specId: resolved });
    this.rewindTo(target, { specId: resolved });
    return fact.toJSON();
  }

  park(specId) { return this.runtime.park({ specId: canonicalSpecId(specId), activityId: activityId("flow-parked") }); }
  resume(specId) { return this.runtime.resume({ specId: canonicalSpecId(specId), activityId: activityId("flow-resumed") }); }
  finalize(specId) { return this.runtime.finalize({ specId: canonicalSpecId(specId), activityId: activityId("flow-finalized") }); }

  catalog(specId) { return this.runtime.catalog(canonicalSpecId(specId)); }
  restart(specId) { return this.runtime.restart(canonicalSpecId(specId)); }

  /**
   * Resolve one cataloged input through the same Version Store that wrote it.
   * Command code never infers a Version directory or trusts a raw path.
   */
  readArtifact({ specId = null, logicalKey, parameters = {}, consumerNodeId, optional = false } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    if (optional !== true && optional !== false) {
      throw new CurrentFlowStateInvariantError("canonical artifact optional must be boolean");
    }
    const artifact = FLOW_ARTIFACT_CONTRACTS.resolve(requiredText(logicalKey, "canonical artifact logicalKey"), parameters);
    const consumer = FlowArtifactUpdater.fromActivityNodeId(
      requiredText(consumerNodeId, "canonical artifact consumer nodeId"),
    ).toString();
    if (!artifact.contract.ownership.consumers.includes(consumer)) {
      throw new CurrentFlowStateInvariantError(
        `canonical artifact consumer is not authorized: ${consumer}/${artifact.logicalKey}`,
      );
    }
    const catalog = this.runtime.catalog(resolved);
    const descriptor = catalog.artifacts.find((entry) => entry.relativePath === artifact.relativePath) ?? null;
    if (descriptor === null) {
      if (optional) return null;
      throw new CurrentFlowStateInvariantError(`canonical artifact is absent from catalog: ${artifact.relativePath}`);
    }
    if (descriptor.logicalKey !== artifact.logicalKey) {
      throw new CurrentFlowStateInvariantError("canonical artifact catalog logical key conflicts with its resolved contract");
    }
    const location = this.location(resolved);
    location.assertAuthority(artifact.relativePath, { mustExist: true });
    return Object.freeze({
      descriptor: Object.freeze(descriptor.toJSON()),
      relativePath: artifact.relativePath,
      bytes: Buffer.from(fs.readFileSync(location.resolve(artifact.relativePath))),
    });
  }

  /** Read one active producer-owned attempt artifact for an advisory observation. */
  readActiveProducerArtifact({ specId = null, nodeId, logicalKey, parameters = {} } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const target = requiredText(nodeId, "canonical producer nodeId");
    if (state.current?.at(-1) !== target) {
      throw new CurrentFlowStateInvariantError("canonical producer artifact requires the active current Attempt");
    }
    if (parameters === null || typeof parameters !== "object" || Array.isArray(parameters)) {
      throw new CurrentFlowStateInvariantError("canonical producer artifact parameters must be an object");
    }
    const artifact = FLOW_ARTIFACT_CONTRACTS.resolve(
      requiredText(logicalKey, "canonical producer artifact logicalKey"),
      parameters,
    );
    const producer = FlowArtifactUpdater.fromActivityNodeId(target).toString();
    if (artifact.contract.authoritySlot.publicationStep !== producer) {
      throw new CurrentFlowStateInvariantError(`canonical producer does not own artifact: ${producer}/${artifact.logicalKey}`);
    }
    const catalog = this.runtime.catalog(resolved);
    const descriptor = catalog.artifacts.find((entry) => entry.relativePath === artifact.relativePath) ?? null;
    if (descriptor === null || descriptor.logicalKey !== artifact.logicalKey) {
      throw new CurrentFlowStateInvariantError(`canonical producer artifact is absent from catalog: ${artifact.relativePath}`);
    }
    const location = this.location(resolved);
    location.assertAuthority(artifact.relativePath, { mustExist: true });
    return Object.freeze({
      descriptor: Object.freeze(descriptor.toJSON()),
      relativePath: artifact.relativePath,
      bytes: Buffer.from(fs.readFileSync(location.resolve(artifact.relativePath))),
    });
  }

  /**
   * Read an artifact owned by the active producer role.  Unlike the older
   * single-slot helper this also supports intentionally shared producer
   * contracts (for example flow findings), while retaining the same current
   * Activity and catalog authority checks.
   */
  readProducerArtifact({ specId = null, nodeId, logicalKey, parameters = {}, optional = false } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    const state = this.runtime.load(resolved);
    const target = requiredText(nodeId, "canonical producer nodeId");
    if (state.current?.at(-1) !== target) {
      throw new CurrentFlowStateInvariantError("canonical producer artifact requires the active current Attempt");
    }
    if (parameters === null || typeof parameters !== "object" || Array.isArray(parameters)) {
      throw new CurrentFlowStateInvariantError("canonical producer artifact parameters must be an object");
    }
    if (optional !== true && optional !== false) {
      throw new CurrentFlowStateInvariantError("canonical producer artifact optional must be boolean");
    }
    const artifact = FLOW_ARTIFACT_CONTRACTS.resolve(
      requiredText(logicalKey, "canonical producer artifact logicalKey"),
      parameters,
    );
    const producer = FlowArtifactUpdater.fromActivityNodeId(target).toString();
    if (!artifact.contract.ownership.producers.includes(producer)) {
      throw new CurrentFlowStateInvariantError(`canonical producer does not own artifact: ${producer}/${artifact.logicalKey}`);
    }
    const catalog = this.runtime.catalog(resolved);
    const descriptor = catalog.artifacts.find((entry) => entry.relativePath === artifact.relativePath) ?? null;
    if (descriptor === null) {
      if (optional) return null;
      throw new CurrentFlowStateInvariantError(`canonical producer artifact is absent from catalog: ${artifact.relativePath}`);
    }
    if (descriptor.logicalKey !== artifact.logicalKey) {
      throw new CurrentFlowStateInvariantError(`canonical producer artifact is absent from catalog: ${artifact.relativePath}`);
    }
    const location = this.location(resolved);
    location.assertAuthority(artifact.relativePath, { mustExist: true });
    return Object.freeze({
      descriptor: Object.freeze(descriptor.toJSON()),
      relativePath: artifact.relativePath,
      bytes: Buffer.from(fs.readFileSync(location.resolve(artifact.relativePath))),
    });
  }

  /**
   * Resolve a cataloged artifact whose exact path came from an already
   * cataloged producer reference (for example a deferred-finding source).
   * This intentionally does not accept an arbitrary filesystem path: the
   * catalog descriptor, contract classification, and consumer ownership must
   * all agree before bytes are returned.
   */
  readCatalogArtifact({ specId = null, relativePath, consumerNodeId, optional = false } = {}) {
    const resolved = this.#resolveSpecId(specId);
    if (resolved === null) throw new CurrentFlowStateInvariantError("no canonical active Flow");
    if (optional !== true && optional !== false) {
      throw new CurrentFlowStateInvariantError("canonical catalog artifact optional must be boolean");
    }
    const requestedPath = catalogRelativePath(relativePath);
    const catalog = this.runtime.catalog(resolved);
    const descriptor = catalog.artifacts.find((entry) => entry.relativePath === requestedPath) ?? null;
    if (descriptor === null) {
      if (optional) return null;
      throw new CurrentFlowStateInvariantError(`canonical artifact is absent from catalog: ${requestedPath}`);
    }
    const classified = FLOW_ARTIFACT_CONTRACTS.classify(requestedPath);
    if (descriptor.logicalKey !== classified.logicalKey.toString()) {
      throw new CurrentFlowStateInvariantError("canonical artifact catalog logical key conflicts with its classified path");
    }
    const consumer = FlowArtifactUpdater.fromActivityNodeId(
      requiredText(consumerNodeId, "canonical catalog artifact consumer nodeId"),
    ).toString();
    if (!classified.ownership.consumers.includes(consumer)) {
      throw new CurrentFlowStateInvariantError(
        `canonical catalog artifact consumer is not authorized: ${consumer}/${classified.logicalKey}`,
      );
    }
    const location = this.location(resolved);
    location.assertAuthority(requestedPath, { mustExist: true });
    return Object.freeze({
      descriptor: Object.freeze(descriptor.toJSON()),
      relativePath: requestedPath,
      bytes: Buffer.from(fs.readFileSync(location.resolve(requestedPath))),
    });
  }

  #resolveSpecId(specId) {
    if (specId != null) return canonicalSpecId(specId);
    const provider = this.activeFlowsProvider();
    const entries = typeof provider?.load === "function" ? provider.load() : provider;
    if (!Array.isArray(entries) || entries.length === 0) return null;
    if (entries.length !== 1) {
      throw new CurrentFlowStateInvariantError("multiple active flows require an explicit --spec <specId>");
    }
    return canonicalSpecId(entries[0].specId);
  }

  #retryBaselinePublication(state, nodeId, attempt) {
    const baseline = captureRetryRecoveryBaseline({
      flowState: this.load(state.specId),
      flowManager: this,
      executionRoot: this.root,
      artifactRoot: this.mainRoot,
      nodeId,
      attempt,
      specPath: this.runtime.location(state.specId).relativeSpecFile,
    });
    if (baseline === null) return null;
    return RetryRecoveryArtifactPublication.baseline(baseline);
  }

  #beginExecutableNode(state, specId, nodeId) {
    const next = state.nextAction();
    if (next?.nodeId !== nodeId || !["start", "recover"].includes(next.operation)) {
      throw new CurrentFlowStateInvariantError(
        `canonical transition is not definition-authorized for next node: ${nodeId}`,
      );
    }
    const input = {
      specId,
      activityId: activityId(next.operation === "recover" ? "attempt-recovered" : "attempt-started"),
      nodeId,
      // A lifecycle/direct transition begins the same definition-owned
      // command-context operation as `get next-action`. The Activity kind
      // preserves whether this is a fresh pending leaf or an invalidated
      // recovery leaf.
      attempt: commandContextAttempt(state, nodeId),
      admission: this.#consumerAdmission(state, nodeId),
    };
    input.retryRecoveryPublication = this.#retryBaselinePublication(state, nodeId, input.attempt);
    return next.operation === "recover"
      ? this.runtime.recover(input)
      : this.runtime.startAttempt(input);
  }

  #historicalMissingProducerArtifactCandidate(state, specId) {
    const consumerAttempt = state.attempt;
    const consumerNodeId = state.current?.at(-1) ?? null;
    const leaves = state.definition.orderedLeaves(state.root);
    const activities = this.activityLedger(specId);
    const candidateFor = ({ readiness, consumer = null }) => {
      const producerNodeId = readiness.producerNodeId;
      const producer = state.findNode(producerNodeId);
      if (producer?.status !== "failed") return null;
      const record = [...activities].reverse().find((activity) => (
        activity.nodeId === producerNodeId
        && activity.transition.operation === "record_failure"
        && activity.sequence === producer.attemptSequence
      )) ?? null;
      const failed = record === null ? null : [...activities].slice(0, activities.indexOf(record)).reverse().find((activity) => (
        activity.nodeId === producerNodeId
        && activity.attemptId === record.attemptId
        && activity.sequence === record.sequence
        && activity.transition.operation === "fail_attempt"
      )) ?? null;
      const introduced = failed === null ? null : [...activities].slice(0, activities.indexOf(failed)).reverse().find((activity) => (
        activity.nodeId === producerNodeId
        && activity.transition.attempt?.id === failed.attemptId
        && activity.transition.attempt?.sequence === failed.sequence
      )) ?? null;
      if (
        record === null || failed === null || introduced === null || failed.failure === null
        || JSON.stringify(record.result) !== JSON.stringify(producer.result)
      ) return null;
      return Object.freeze({
        consumerAttempt,
        consumerNodeId: consumer,
        producerNodeId,
        producerAttempt: new CurrentAttempt({ ...introduced.transition.attempt, failure: failed.failure }),
        readiness,
      });
    };
    if ((consumerAttempt === null) !== (consumerNodeId === null)) return null;
    if (consumerAttempt !== null) {
      const consumerIndex = leaves.findIndex((node) => node.id === consumerNodeId);
      if (consumerIndex < 1) return null;
      const readinesses = producerArtifactReadinessesForConsumer({
        producerNodeIds: leaves.slice(0, consumerIndex).map((node) => node.id),
        consumerNodeId,
      });
      for (const readiness of [...readinesses].reverse()) {
        const candidate = candidateFor({ readiness, consumer: consumerNodeId });
        if (candidate !== null) return candidate;
      }
      return null;
    }
    for (let producerIndex = leaves.length - 1; producerIndex >= 0; producerIndex -= 1) {
      const producer = leaves[producerIndex];
      if (producer.status !== "failed"
        || leaves.slice(producerIndex + 1).some((node) => !["pending", "invalidated"].includes(node.status))) continue;
      const readinesses = producerArtifactReadinessesForProducer({ producerNodeId: producer.id });
      for (const readiness of readinesses) {
        const consumerIndex = leaves.findIndex((node) => node.id === readiness.consumerNodeId);
        if (consumerIndex <= producerIndex || leaves[consumerIndex]?.status !== "pending") continue;
        const candidate = candidateFor({ readiness, consumer: null });
        if (candidate !== null) return candidate;
      }
    }
    return null;
  }

  #consumerAdmission(state, consumerNodeId) {
    const leaves = state.definition.orderedLeaves(state.root);
    const index = leaves.findIndex((node) => node.id === consumerNodeId);
    if (index < 1) return null;
    const readinesses = producerArtifactReadinessesForConsumer({
      producerNodeIds: leaves.slice(0, index).map((node) => node.id),
      consumerNodeId,
    });
    return readinesses.length === 0 ? null : new ProducerArtifactReadinessAdmission({ readinesses });
  }

  // Replacement transitions may skip producers that a normal linear claim
  // would consume.  Only the two routes with an intact primary handoff are
  // admitted here; applying the generic predecessor scan to every recovery
  // would incorrectly require artifacts from explicitly skipped work.
  #replacementConsumerAdmission(state, { route, targetNodeId }) {
    const sourceNodeId = state.current?.at(-1) ?? null;
    const requiresAdmission = (
      route === "repair-plan-gate"
      && sourceNodeId === "spec-gate"
      && targetNodeId === "spec"
    ) || (
      route === "repair-acceptance-review"
      && sourceNodeId === "acceptance-review"
      && targetNodeId === "impl-triage"
    );
    return requiresAdmission ? this.#consumerAdmission(state, targetNodeId) : null;
  }

  #producerCompletionAdmission(producerNodeId, artifactWrites) {
    const readinesses = producerArtifactReadinessesForProducer({ producerNodeId });
    return readinesses.length === 0
      ? null
      : new ProducerArtifactPublicationAdmission({ readinesses, artifactWrites });
  }

  #settlementAdmission(state, result) {
    const after = state.recordCurrentFailure({ result });
    const consumerNodeId = after.nextAction()?.nodeId ?? null;
    if (consumerNodeId === null) return null;
    return this.#consumerAdmission(after, consumerNodeId);
  }

  #attemptHistoryWrites({ specId, state, nodeId, commandResult, attemptSequence = state.attempt?.sequence }) {
    if (state.current?.at(-1) !== nodeId || state.attempt === null) {
      throw new CurrentFlowStateInvariantError("canonical command attempt history requires the active current Attempt");
    }
    const target = attemptHistoryTargetForNode(nodeId);
    if (target === null) return [];
    const artifact = FLOW_ARTIFACT_CONTRACTS.resolve(target.logicalKey, target.parameters);
    const contract = artifact.contract;
    if (contract.contentContract === null) {
      throw new CurrentFlowStateInvariantError(`canonical attempt history contract is missing for ${target.logicalKey}`);
    }
    const updater = FlowArtifactUpdater.fromActivityNodeId(nodeId).toString();
    if (!contract.ownership.producers.includes(updater) && !contract.ownership.updaters.includes(updater)) {
      throw new CurrentFlowStateInvariantError(
        `canonical command Attempt producer is not authorized: ${updater}/${target.logicalKey}`,
      );
    }
    const previousBytes = this.#ownedArtifactBytes(specId, artifact);
    const previous = previousBytes === null
      ? new FlowArtifactAttemptHistory()
      : contract.contentContract.parse(previousBytes);
    if (!(previous instanceof FlowArtifactAttemptHistory)) {
      throw new CurrentFlowStateInvariantError(`canonical attempt history contract is invalid for ${target.logicalKey}`);
    }
    const payload = commandResultPayload(commandResult, nodeId, target.logicalKey);
    const attempt = attemptSequence;
    if (!Number.isSafeInteger(attempt) || attempt < 1) {
      throw new CurrentFlowStateInvariantError("canonical command Attempt sequence is invalid");
    }
    const existing = previous.attempts.find((entry) => entry.attempt.value === attempt) ?? null;
    if (existing !== null) {
      if (JSON.stringify(existing.payload) !== JSON.stringify(payload)) {
        throw new CurrentFlowStateInvariantError(
          `canonical attempt result already exists with different bytes: ${nodeId}/${attempt}`,
        );
      }
      return [];
    }
    const next = previous.append(new FlowArtifactAttemptRecord({ attempt, payload }));
    return [{
      logicalKey: target.logicalKey,
      parameters: target.parameters,
      mediaType: "application/json",
      bytes: Buffer.from(`${JSON.stringify(next.toJSON(), null, 2)}\n`, "utf8"),
    }];
  }

  #ownedArtifactBytes(specId, artifact) {
    const catalog = this.runtime.catalog(specId);
    const descriptor = catalog.artifacts.find((entry) => entry.relativePath === artifact.relativePath) ?? null;
    if (descriptor === null) return null;
    if (descriptor.logicalKey !== artifact.logicalKey) {
      throw new CurrentFlowStateInvariantError("canonical artifact catalog logical key conflicts with its resolved contract");
    }
    const location = this.location(specId);
    location.assertAuthority(artifact.relativePath, { mustExist: true });
    return Buffer.from(fs.readFileSync(location.resolve(artifact.relativePath)));
  }

  #commandPublicationWrites(commandResult) {
    return attachedCanonicalCommandResultPublications(commandResult)
      .map((publication) => publication.toArtifactWrite());
  }
}

export function canonicalFlowVersionLocation(store, specId) {
  if (!(store instanceof CanonicalFlowManagerStore)) {
    throw new CurrentFlowStateInvariantError("CanonicalFlowManagerStore is required");
  }
  const location = store.location(specId);
  if (location.version.value !== new FlowVersion(1).value) {
    throw new CurrentFlowStateInvariantError("canonical manager must resolve Flow Version 1");
  }
  return location;
}
