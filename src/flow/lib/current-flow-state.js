/**
 * The next-generation Flow state foundation.
 *
 * This module deliberately has no dependency on FlowStore or FlowManager.  The
 * currently shipped runtime has a different persisted contract; converting or
 * switching that runtime belongs to the later migration work.  Consumers of
 * this module must supply a definition and construct a fresh CurrentFlowState.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AtomicFile } from "../../lib/atomic-file.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "../../lib/process-owned-lock.js";

export const CURRENT_FLOW_SCHEMA_REVISION = 2;
// `version` is the result-generation version persisted in flow.json.  It is
// intentionally independent from the structural schemaRevision above.
export const CURRENT_FLOW_RESULT_VERSION = 1;

const NODE_KINDS = new Set(["flow", "step", "task"]);
const NODE_STATUSES = new Set(["pending", "in_progress", "done", "skipped", "failed", "invalidated"]);
const EXECUTION_MODES = new Set(["direct", "branch", "worktree"]);
const RESULT_OUTCOMES = new Set(["passed", "failed", "skipped", "incomplete"]);
const RETRY_KINDS = new Set(["semantic", "tooling"]);
const FAILURE_POLICIES = new Set(["retry", "record", "amend-spec", "block"]);
const ATTEMPT_TYPES = new Set([
  "task_added",
  "attempt_started",
  "attempt_retried",
  "attempt_updated",
  "attempt_failed",
  "failure_recorded",
  "result_confirmed",
  "recovery",
]);
const TRANSITION_ATTEMPT_OPERATIONS = new Set([
  "start_attempt",
  "retry_attempt",
  "update_attempt",
  "rewind",
  "recover_attempt",
]);
const TERMINAL_NODE_STATUSES = new Set(["done", "skipped", "failed"]);
const AUTHORITATIVE_NODE_STATUSES = new Set(["done", "skipped"]);
const EXECUTABLE_NODE_STATUSES = new Set(["pending", "invalidated"]);
const FORBIDDEN_TOP_LEVEL_FIELDS = new Set([
  "currentTaskId",
  "childId",
  "runtimeLog",
  "metrics",
  "notes",
  "stepAttempts",
  "workerArtifactReceipts",
  "reviewConvergence",
  "reviewRecoveryBaselines",
  "testReviewRepairHistory",
  "expandedPluginHooks",
  "hooks",
]);
const STATE_FIELDS = new Set([
  "schemaRevision",
  "version",
  "execution",
  "kind",
  "id",
  "key",
  "status",
  "result",
  "attemptSequence",
  "steps",
  "current",
  "attempt",
  "confirmationOrder",
]);
const NODE_FIELDS = new Set(["kind", "id", "key", "status", "result", "attemptSequence", "steps"]);
const JOURNAL_WRITER_AUTHORITY = Symbol("current-flow-state-store-writer");

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new CurrentFlowStateInvariantError(`${field} must be a non-empty string`);
  }
  return value;
}

function requirePositiveInteger(value, field, { allowZero = false } = {}) {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new CurrentFlowStateInvariantError(`${field} must be a ${allowZero ? "non-negative" : "positive"} integer`);
  }
  return value;
}

function requireIso(value, field) {
  requireString(value, field);
  if (Number.isNaN(Date.parse(value))) {
    throw new CurrentFlowStateInvariantError(`${field} must be an ISO timestamp`);
  }
  return value;
}

function requireExactFields(value, fields, label) {
  if (!isPlainObject(value)) throw new CurrentFlowStateInvariantError(`${label} must be an object`);
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) throw new CurrentFlowStateInvariantError(`${label}.${field} is required`);
  }
  for (const field of Object.keys(value)) {
    if (!fields.has(field)) throw new CurrentFlowStateInvariantError(`${label} contains unsupported field: ${field}`);
  }
}

function rootNodeValue(value) {
  return Object.fromEntries([...NODE_FIELDS].map((field) => [field, value[field]]));
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requireStringList(value, field) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new CurrentFlowStateInvariantError(`${field} must be an array of non-empty strings`);
  }
  if (new Set(value).size !== value.length) {
    throw new CurrentFlowStateInvariantError(`${field} must not contain duplicates`);
  }
  return Object.freeze([...value]);
}

function digest(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function sameFileIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function fsyncDirectory(directory) {
  const descriptor = fs.openSync(directory, "r");
  try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
}

function nodeFromJSON(value) {
  requireExactFields(value, NODE_FIELDS, "node");
  if (!NODE_KINDS.has(value.kind)) throw new CurrentFlowStateInvariantError(`node.kind is invalid: ${value.kind}`);
  const Node = value.kind === "task" ? TaskNode : value.kind === "flow" ? FlowRootNode : StepNode;
  return new Node(value);
}

function replaceNode(root, nodeId, replacement) {
  if (root.id === nodeId) return replacement;
  const nextSteps = root.steps.map((step) => replaceNode(step, nodeId, replacement));
  if (nextSteps.every((step, index) => step === root.steps[index])) return root;
  return root.withSteps(nextSteps);
}

function transitionNode(node, status, definition, changes = {}) {
  if (node.status !== status && !definition.contractForNode(node).permits(node.status, status)) {
    throw new CurrentFlowStateInvariantError(
      `definition forbids transition ${node.status}:${status} for ${node.id}`,
    );
  }
  return node.with({ ...changes, status });
}

function reconcileInvalidatedParents(node, definition) {
  if (node.steps.length === 0) return node;
  const steps = node.steps.map((step) => reconcileInvalidatedParents(step, definition));
  const hasInvalidatedChild = steps.some((step) => step.status === "invalidated");
  if (hasInvalidatedChild) {
    return transitionNode(node, "invalidated", definition, { result: null, steps });
  }
  return node.withSteps(steps);
}

function reconcileCompletedParents(node, definition) {
  if (node.steps.length === 0) return node;
  const steps = node.steps.map((step) => reconcileCompletedParents(step, definition));
  if (
    definition.contractForNode(node).completion === "all_children_terminal"
    && steps.every((step) => TERMINAL_NODE_STATUSES.has(step.status))
  ) {
    const result = [...steps].reverse().find((step) => step.result != null)?.result ?? null;
    return transitionNode(node, "done", definition, { result, steps });
  }
  if (steps.some((step) => step.status === "in_progress")) {
    return transitionNode(node, "in_progress", definition, { steps });
  }
  return node.withSteps(steps);
}

function collectNodes(root, result = []) {
  result.push(root);
  for (const step of root.steps) collectNodes(step, result);
  return result;
}

function nodeAtPath(root, pathIds) {
  let current = root;
  if (pathIds[0] !== root.id) throw new CurrentFlowStateInvariantError("current.path must begin with root stable id");
  for (const id of pathIds.slice(1)) {
    current = current.steps.find((candidate) => candidate.id === id);
    if (!current) throw new CurrentFlowStateInvariantError("current.path must be a root-to-leaf parent-child path");
  }
  return current;
}

export class CurrentFlowStateInvariantError extends Error {
  constructor(message) {
    super(message);
    this.name = "CurrentFlowStateInvariantError";
    this.code = "CURRENT_FLOW_STATE_INVARIANT_INVALID";
  }
}

export class CurrentFlowStateConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "CurrentFlowStateConflictError";
    this.code = "CURRENT_FLOW_STATE_CONFLICT";
  }
}

export class ArtifactReference {
  constructor(value) {
    requireExactFields(value, new Set(["kind", "id"]), "artifact reference");
    this.kind = requireString(value.kind, "artifact reference.kind");
    this.id = requireString(value.id, "artifact reference.id");
    Object.freeze(this);
  }

  toJSON() { return { kind: this.kind, id: this.id }; }
}

export class NodeResult {
  constructor(value) {
    requireExactFields(value, new Set(["outcome", "summary", "confirmedAt", "artifactRefs"]), "result");
    const { outcome, summary, confirmedAt, artifactRefs } = value;
    if (!RESULT_OUTCOMES.has(outcome)) {
      throw new CurrentFlowStateInvariantError(`result.outcome is invalid: ${outcome}`);
    }
    this.outcome = outcome;
    this.summary = requireString(summary, "result.summary");
    this.confirmedAt = requireIso(confirmedAt, "result.confirmedAt");
    if (!Array.isArray(artifactRefs)) throw new CurrentFlowStateInvariantError("result.artifactRefs must be an array");
    this.artifactRefs = Object.freeze(artifactRefs.map((ref) => ref instanceof ArtifactReference ? ref : new ArtifactReference(ref)));
    if (new Set(this.artifactRefs.map((ref) => ref.kind)).size !== this.artifactRefs.length) {
      throw new CurrentFlowStateInvariantError("result.artifactRefs must contain at most one artifact per resource kind");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      outcome: this.outcome,
      summary: this.summary,
      confirmedAt: this.confirmedAt,
      artifactRefs: this.artifactRefs.map((ref) => ref.toJSON()),
    };
  }
}

export class AttemptConsumption {
  constructor(value) {
    requireExactFields(value, new Set(["semantic", "tooling"]), "attempt.consumption");
    const { semantic, tooling } = value;
    this.semantic = requirePositiveInteger(semantic, "attempt.consumption.semantic", { allowZero: true });
    this.tooling = requirePositiveInteger(tooling, "attempt.consumption.tooling", { allowZero: true });
    Object.freeze(this);
  }

  toJSON() { return { semantic: this.semantic, tooling: this.tooling }; }
}

export class AttemptBlocker {
  constructor(value) {
    requireExactFields(value, new Set(["code", "message"]), "attempt.blocker");
    const { code, message } = value;
    this.code = requireString(code, "attempt.blocker.code");
    this.message = requireString(message, "attempt.blocker.message");
    Object.freeze(this);
  }

  toJSON() { return { code: this.code, message: this.message }; }
}

export class AttemptIncompleteClaim {
  constructor(value) {
    requireExactFields(value, new Set(["code", "message", "operation", "resources"]), "attempt.incompleteClaim");
    const { code, message, operation, resources } = value;
    this.code = requireString(code, "attempt.incompleteClaim.code");
    this.message = requireString(message, "attempt.incompleteClaim.message");
    if (operation !== null) requireString(operation, "attempt.incompleteClaim.operation");
    this.operation = operation;
    this.resources = requireStringList(resources, "attempt.incompleteClaim.resources");
    if (this.resources.length > 0 && this.operation === null) {
      throw new CurrentFlowStateInvariantError("attempt.incompleteClaim.resources requires an operation");
    }
    Object.freeze(this);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      operation: this.operation,
      resources: [...this.resources],
    };
  }
}

export class AttemptOperationClaim {
  constructor(value) {
    requireExactFields(value, new Set(["operation", "resources"]), "attempt.operationClaim");
    const { operation, resources } = value;
    this.operation = requireString(operation, "attempt.operationClaim.operation");
    this.resources = requireStringList(resources, "attempt.operationClaim.resources");
    Object.freeze(this);
  }

  toJSON() { return { operation: this.operation, resources: [...this.resources] }; }
}

export class ActivityFailure {
  constructor(value) {
    requireExactFields(value, new Set(["category", "code", "message", "retryable", "retryKind"]), "activity.failure");
    const { category, code, message, retryable, retryKind } = value;
    this.category = requireString(category, "activity.failure.category");
    this.code = requireString(code, "activity.failure.code");
    this.message = requireString(message, "activity.failure.message");
    if (typeof retryable !== "boolean") throw new CurrentFlowStateInvariantError("activity.failure.retryable must be boolean");
    if (retryKind !== null && !RETRY_KINDS.has(retryKind)) {
      throw new CurrentFlowStateInvariantError("activity.failure.retryKind is invalid");
    }
    if (retryable && retryKind === null) {
      throw new CurrentFlowStateInvariantError("retryable failure requires a retry accounting kind");
    }
    this.retryable = retryable;
    this.retryKind = retryKind;
    Object.freeze(this);
  }

  toJSON() {
    return {
      category: this.category,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      retryKind: this.retryKind,
    };
  }
}

export class CurrentAttempt {
  constructor(value) {
    requireExactFields(value, new Set(["id", "sequence", "startedAt", "consumption", "failure", "blocker", "incomplete", "operationClaims"]), "attempt");
    const { id, sequence, startedAt, consumption, failure, blocker, incomplete, operationClaims } = value;
    this.id = requireString(id, "attempt.id");
    this.sequence = requirePositiveInteger(sequence, "attempt.sequence");
    this.startedAt = requireIso(startedAt, "attempt.startedAt");
    this.consumption = consumption instanceof AttemptConsumption ? consumption : new AttemptConsumption(consumption);
    if (this.consumption.semantic + this.consumption.tooling >= this.sequence) {
      throw new CurrentFlowStateInvariantError("attempt retry consumption must be lower than its per-node sequence");
    }
    this.failure = failure == null ? null : failure instanceof ActivityFailure ? failure : new ActivityFailure(failure);
    this.blocker = blocker == null ? null : blocker instanceof AttemptBlocker ? blocker : new AttemptBlocker(blocker);
    if (!Array.isArray(incomplete)) throw new CurrentFlowStateInvariantError("attempt.incomplete must be an array");
    this.incomplete = Object.freeze(incomplete.map((claim) => claim instanceof AttemptIncompleteClaim ? claim : new AttemptIncompleteClaim(claim)));
    if (!Array.isArray(operationClaims)) throw new CurrentFlowStateInvariantError("attempt.operationClaims must be an array");
    this.operationClaims = Object.freeze(operationClaims.map((claim) => claim instanceof AttemptOperationClaim ? claim : new AttemptOperationClaim(claim)));
    Object.freeze(this);
  }

  toJSON() {
    return {
      id: this.id,
      sequence: this.sequence,
      startedAt: this.startedAt,
      consumption: this.consumption.toJSON(),
      failure: this.failure?.toJSON() ?? null,
      blocker: this.blocker?.toJSON() ?? null,
      incomplete: this.incomplete.map((claim) => claim.toJSON()),
      operationClaims: this.operationClaims.map((claim) => claim.toJSON()),
    };
  }

  replaceFacts({ failure = this.failure, blocker = this.blocker, incomplete = this.incomplete, operationClaims = this.operationClaims } = {}) {
    return new CurrentAttempt({
      id: this.id,
      sequence: this.sequence,
      startedAt: this.startedAt,
      consumption: this.consumption,
      failure,
      blocker,
      incomplete,
      operationClaims,
    });
  }
}

export class CurrentFlowNode {
  constructor(value) {
    requireExactFields(value, NODE_FIELDS, "node");
    const { kind, id, key, status, result, attemptSequence, steps } = value;
    if (!NODE_KINDS.has(kind)) throw new CurrentFlowStateInvariantError(`node.kind is invalid: ${kind}`);
    this.kind = kind;
    this.id = requireString(id, "node.id");
    this.key = requireString(key, "node.key");
    if (!NODE_STATUSES.has(status)) throw new CurrentFlowStateInvariantError(`node.status is invalid: ${status}`);
    this.status = status;
    this.result = result == null ? null : result instanceof NodeResult ? result : new NodeResult(result);
    this.attemptSequence = requirePositiveInteger(attemptSequence, "node.attemptSequence", { allowZero: true });
    if (!Array.isArray(steps)) throw new CurrentFlowStateInvariantError("node.steps must be an array");
    this.steps = Object.freeze(steps.map((step) => step instanceof CurrentFlowNode ? step : nodeFromJSON(step)));
    Object.freeze(this);
  }

  with({ status = this.status, result = this.result, attemptSequence = this.attemptSequence, steps = this.steps } = {}) {
    return new this.constructor({
      kind: this.kind,
      id: this.id,
      key: this.key,
      status,
      result,
      attemptSequence,
      steps,
    });
  }

  withSteps(steps) {
    return this.with({ steps });
  }

  toJSON() {
    return {
      kind: this.kind,
      id: this.id,
      key: this.key,
      status: this.status,
      result: this.result?.toJSON() ?? null,
      attemptSequence: this.attemptSequence,
      steps: this.steps.map((step) => step.toJSON()),
    };
  }
}

export class FlowRootNode extends CurrentFlowNode {
  constructor(value) {
    if (value?.kind !== "flow") throw new CurrentFlowStateInvariantError("FlowRootNode.kind must be flow");
    super(value);
  }
}

export class StepNode extends CurrentFlowNode {
  constructor(value) {
    if (value?.kind !== "step") throw new CurrentFlowStateInvariantError("StepNode.kind must be step");
    super(value);
  }
}

export class TaskNode extends CurrentFlowNode {
  constructor(value) {
    if (value?.kind !== "task") throw new CurrentFlowStateInvariantError("TaskNode.kind must be task");
    super(value);
  }
}

export class ResourceContract {
  constructor({ required = [], authority = "definition" } = {}) {
    this.required = requireStringList(required, "resourceContract.required");
    if (authority !== "definition") {
      throw new CurrentFlowStateInvariantError("resourceContract.authority must be definition");
    }
    this.authority = authority;
    Object.freeze(this);
  }

  assertClaims(operationClaims, incompleteClaims, nodeId) {
    const coverage = new Map();
    const record = (resource, source) => {
      if (!this.required.includes(resource)) {
        throw new CurrentFlowStateInvariantError(`attempt resource claim exceeds definition contract for ${nodeId}`);
      }
      if (coverage.has(resource)) {
        throw new CurrentFlowStateInvariantError(`attempt resource claim duplicates or conflicts for ${nodeId}: ${resource}`);
      }
      coverage.set(resource, source);
    };
    for (const claim of operationClaims) {
      for (const resource of claim.resources) {
        record(resource, "claimed");
      }
    }
    for (const incomplete of incompleteClaims) {
      for (const resource of incomplete.resources) {
        record(resource, "incomplete");
      }
    }
    const missing = this.required.filter((resource) => !coverage.has(resource));
    if (missing.length > 0) {
      throw new CurrentFlowStateInvariantError(`Attempt does not cover required definition resources for ${nodeId}: ${missing.join(", ")}`);
    }
  }
}

export class DefinitionAction {
  constructor({
    action,
    instructionsKey,
    contextKinds = [],
    outputSchemaRef = null,
    requiresApproval = false,
    autoApproveChoiceId = null,
    maxAttempts = 1,
    sideEffects = null,
    failurePolicy = null,
    executionCommand = null,
    artifactAuthority = {},
  }) {
    if (action !== null) requireString(action, "definition.action.action");
    this.action = action;
    if (instructionsKey !== null) requireString(instructionsKey, "definition.action.instructionsKey");
    this.instructionsKey = instructionsKey;
    this.contextKinds = requireStringList(contextKinds, "definition.action.contextKinds");
    if (outputSchemaRef !== null) requireString(outputSchemaRef, "definition.action.outputSchemaRef");
    this.outputSchemaRef = outputSchemaRef;
    if (typeof requiresApproval !== "boolean") {
      throw new CurrentFlowStateInvariantError("definition.action.requiresApproval must be boolean");
    }
    this.requiresApproval = requiresApproval;
    if (autoApproveChoiceId !== null) requireString(autoApproveChoiceId, "definition.action.autoApproveChoiceId");
    if (autoApproveChoiceId !== null && requiresApproval !== true) {
      throw new CurrentFlowStateInvariantError("definition.action.autoApproveChoiceId requires approval");
    }
    this.autoApproveChoiceId = autoApproveChoiceId;
    this.maxAttempts = requirePositiveInteger(maxAttempts, "definition.action.maxAttempts");
    if (sideEffects !== null) requireStringList(sideEffects, "definition.action.sideEffects");
    this.sideEffects = sideEffects === null ? null : Object.freeze([...sideEffects]);
    this.failurePolicy = failurePolicy === null
      ? null
      : DefinitionFailurePolicy.from(failurePolicy);
    if (executionCommand !== null) requireString(executionCommand, "definition.action.executionCommand");
    this.executionCommand = executionCommand;
    this.artifactAuthority = artifactAuthority instanceof ArtifactAuthorityPolicy
      ? artifactAuthority
      : new ArtifactAuthorityPolicy(artifactAuthority);
    Object.freeze(this);
  }

  toJSON() {
    return {
      action: this.action,
      instructionsKey: this.instructionsKey,
      contextKinds: [...this.contextKinds],
      outputSchemaRef: this.outputSchemaRef,
      requiresApproval: this.requiresApproval,
      autoApproveChoiceId: this.autoApproveChoiceId,
      maxAttempts: this.maxAttempts,
      sideEffects: this.sideEffects === null ? null : [...this.sideEffects],
      failurePolicy: this.failurePolicy?.toJSON() ?? null,
      executionCommand: this.executionCommand,
      artifactAuthority: this.artifactAuthority.toJSON(),
    };
  }
}

export class DefinitionFailurePolicy {
  constructor(value, { targetNodeId = null } = {}) {
    if (!FAILURE_POLICIES.has(value)) {
      throw new CurrentFlowStateInvariantError(`definition.action.failurePolicy is invalid: ${value}`);
    }
    if (targetNodeId !== null) requireString(targetNodeId, "definition.action.failurePolicy.targetNodeId");
    if ((value === "amend-spec") !== (targetNodeId !== null)) {
      throw new CurrentFlowStateInvariantError(
        "amend-spec failure policy requires exactly one definition-owned target node",
      );
    }
    this.value = value;
    this.targetNodeId = targetNodeId;
    Object.freeze(this);
  }

  decide({ failure, consumption, contract }) {
    if (!(failure instanceof ActivityFailure)) {
      throw new CurrentFlowStateInvariantError("failure policy decision requires a typed failure");
    }
    if (!(consumption instanceof AttemptConsumption) || !(contract instanceof NodeContract)) {
      throw new CurrentFlowStateInvariantError("failure policy decision requires typed retry accounting");
    }
    const remaining = failure.retryKind === null
      ? 0
      : Math.max(0, contract.remainingRetries(consumption, failure.retryKind));
    if (this.value === "retry" && failure.retryable && remaining > 0) {
      return new DefinitionFailureDecision({
        policy: this,
        operation: "retry",
        retryKind: failure.retryKind,
        remaining,
        targetNodeId: null,
        reason: `the definition authorizes a ${failure.retryKind} retry with ${remaining} remaining`,
      });
    }
    if (this.value === "retry" || this.value === "record") {
      return new DefinitionFailureDecision({
        policy: this,
        operation: "record",
        retryKind: null,
        remaining: 0,
        targetNodeId: null,
        reason: this.value === "retry"
          ? "the definition records the exhausted or non-retryable failure before continuing"
          : "the definition records this terminal failure before continuing",
      });
    }
    if (this.value === "amend-spec") {
      return new DefinitionFailureDecision({
        policy: this,
        operation: "rewind",
        retryKind: null,
        remaining: 0,
        targetNodeId: this.targetNodeId,
        reason: "the definition rewinds to its specification amendment target",
      });
    }
    return new DefinitionFailureDecision({
      policy: this,
      operation: "blocked",
      retryKind: null,
      remaining: 0,
      targetNodeId: null,
      reason: "the definition blocks after this terminal failure",
    });
  }

  static from(value) {
    if (value instanceof DefinitionFailurePolicy) return value;
    if (typeof value === "string") return new DefinitionFailurePolicy(value);
    requireExactFields(value, new Set(["kind", "targetNodeId"]), "definition.action.failurePolicy");
    return new DefinitionFailurePolicy(value.kind, { targetNodeId: value.targetNodeId });
  }

  toJSON() { return { kind: this.value, targetNodeId: this.targetNodeId }; }
}

export class DefinitionFailureDecision {
  constructor({ policy, operation, retryKind, remaining, targetNodeId, reason }) {
    if (!(policy instanceof DefinitionFailurePolicy)) {
      throw new CurrentFlowStateInvariantError("failure decision requires a definition-owned policy");
    }
    if (!["retry", "record", "rewind", "blocked"].includes(operation)) {
      throw new CurrentFlowStateInvariantError("failure decision operation is invalid");
    }
    if (retryKind !== null && !RETRY_KINDS.has(retryKind)) {
      throw new CurrentFlowStateInvariantError("failure decision retryKind is invalid");
    }
    requirePositiveInteger(remaining, "failure decision remaining", { allowZero: true });
    if ((operation === "retry") !== (retryKind !== null && remaining > 0)) {
      throw new CurrentFlowStateInvariantError("only a retry decision may expose retry accounting");
    }
    if ((operation === "rewind") !== (targetNodeId !== null)) {
      throw new CurrentFlowStateInvariantError("only a rewind decision may identify a target node");
    }
    this.policy = policy;
    this.operation = operation;
    this.retryKind = retryKind;
    this.remaining = remaining;
    this.targetNodeId = targetNodeId;
    this.reason = requireString(reason, "failure decision reason");
    Object.freeze(this);
  }

  toJSON() {
    return {
      policy: this.policy.toJSON(),
      operation: this.operation,
      retryKind: this.retryKind,
      remaining: this.remaining,
      targetNodeId: this.targetNodeId,
      reason: this.reason,
    };
  }
}

export class ArtifactAuthorityPolicy {
  constructor({ sourceScopes = ["same_task", "flow"], selection = "latest_upstream" } = {}) {
    this.sourceScopes = requireStringList(sourceScopes, "definition.action.artifactAuthority.sourceScopes");
    if (this.sourceScopes.some((scope) => !["same_task", "flow", "all_tasks"].includes(scope))) {
      throw new CurrentFlowStateInvariantError("definition action artifact authority contains an invalid source scope");
    }
    if (selection !== "latest_upstream") {
      throw new CurrentFlowStateInvariantError("definition action artifact authority selection is invalid");
    }
    this.selection = selection;
    Object.freeze(this);
  }

  toJSON() { return { sourceScopes: [...this.sourceScopes], selection: this.selection }; }
}

export class NodeContract {
  constructor({ semanticRetryLimit = 0, toolingRetryLimit = null, transitions = ["pending:in_progress", "in_progress:done", "done:in_progress", "skipped:in_progress", "invalidated:in_progress", "pending:invalidated", "in_progress:invalidated", "done:invalidated", "skipped:invalidated"], resourceContract = {}, completion = "all_children_terminal" } = {}) {
    // These are retry budgets, not total-attempt limits.  `null` means no
    // tooling retries are defined (equivalent to a fixed budget of zero), not
    // an unbounded fallback. Attempt sequence is a separate per-node cursor;
    // these counters describe only retry budget consumption in this episode.
    this.semanticRetryLimit = requirePositiveInteger(semanticRetryLimit, "contract.semanticRetryLimit", { allowZero: true });
    if (toolingRetryLimit !== null) requirePositiveInteger(toolingRetryLimit, "contract.toolingRetryLimit", { allowZero: true });
    this.toolingRetryLimit = toolingRetryLimit;
    if (!Array.isArray(transitions) || transitions.some((value) => typeof value !== "string" || !/^[a-z_]+:[a-z_]+$/.test(value))) {
      throw new CurrentFlowStateInvariantError("contract.transitions must be transition strings");
    }
    if (new Set(transitions).size !== transitions.length) {
      throw new CurrentFlowStateInvariantError("contract.transitions must not contain duplicates");
    }
    if (transitions.some((transition) => transition.split(":").some((status) => !NODE_STATUSES.has(status)))) {
      throw new CurrentFlowStateInvariantError("contract.transitions must use known node statuses");
    }
    this.transitions = Object.freeze([...transitions]);
    this.resourceContract = resourceContract instanceof ResourceContract
      ? resourceContract
      : new ResourceContract(resourceContract);
    if (completion !== "all_children_terminal") {
      throw new CurrentFlowStateInvariantError("contract.completion is invalid");
    }
    this.completion = completion;
    Object.freeze(this);
  }

  permits(from, to) {
    return this.transitions.includes(`${from}:${to}`);
  }

  permitsStatus(status) {
    if (!NODE_STATUSES.has(status)) return false;
    if (status === "pending") return true;
    return this.transitions.some((transition) => transition.endsWith(`:${status}`));
  }

  remainingRetries(consumption, kind) {
    if (!(consumption instanceof AttemptConsumption) || !RETRY_KINDS.has(kind)) {
      throw new CurrentFlowStateInvariantError("retry budget lookup requires typed consumption and retry kind");
    }
    const limit = kind === "semantic" ? this.semanticRetryLimit : this.toolingRetryLimit ?? 0;
    return limit - consumption[kind];
  }

}

export class FlowDefinitionNode {
  constructor({ kind = "step", id, key, steps = [], contract = {}, action = null }) {
    if (!NODE_KINDS.has(kind)) throw new CurrentFlowStateInvariantError(`definition.kind is invalid: ${kind}`);
    this.kind = kind;
    this.id = requireString(id, "definition.id");
    this.key = requireString(key, "definition.key");
    if (!Array.isArray(steps)) throw new CurrentFlowStateInvariantError("definition.steps must be an array");
    this.steps = Object.freeze(steps.map((step) => step instanceof FlowDefinitionNode ? step : new FlowDefinitionNode(step)));
    this.contract = contract instanceof NodeContract ? contract : new NodeContract(contract);
    this.action = action == null ? null : action instanceof DefinitionAction ? action : new DefinitionAction(action);
    if (this.steps.length === 0 && this.action === null) {
      throw new CurrentFlowStateInvariantError(`definition leaf requires action metadata: ${this.id}`);
    }
    if (this.steps.length === 0 && this.action.failurePolicy === null) {
      throw new CurrentFlowStateInvariantError(`definition leaf requires an explicit failure policy: ${this.id}`);
    }
    if (this.steps.length > 0 && this.action !== null) {
      throw new CurrentFlowStateInvariantError(`definition branch must not carry action metadata: ${this.id}`);
    }
    if (this.steps.length > 0 && this.contract.transitions.some((transition) => transition.endsWith(":failed"))) {
      throw new CurrentFlowStateInvariantError(`definition branch cannot transition to failed: ${this.id}`);
    }
    if (
      this.steps.length === 0
      && ["retry", "record"].includes(this.action.failurePolicy.value)
      && !this.contract.permits("in_progress", "failed")
    ) {
      throw new CurrentFlowStateInvariantError(
        `recording failure policy requires an in_progress:failed transition: ${this.id}`,
      );
    }
    if (
      this.steps.length === 0
      && !["retry", "record"].includes(this.action.failurePolicy.value)
      && this.contract.permits("in_progress", "failed")
    ) {
      throw new CurrentFlowStateInvariantError(
        `non-recording failure policy forbids an in_progress:failed transition: ${this.id}`,
      );
    }
    if (this.steps.length === 0 && this.action.maxAttempts !== this.contract.semanticRetryLimit + 1) {
      throw new CurrentFlowStateInvariantError(
        `definition action maxAttempts must equal semanticRetryLimit + 1: ${this.id}`,
      );
    }
    if (
      this.steps.length === 0
      && !jsonEqual([...this.action.contextKinds], [...this.contract.resourceContract.required])
    ) {
      throw new CurrentFlowStateInvariantError(
        `definition action contextKinds must equal required resource contract: ${this.id}`,
      );
    }
    Object.freeze(this);
  }

  materialize() {
    const Node = this.kind === "flow" ? FlowRootNode : this.kind === "task" ? TaskNode : StepNode;
    return new Node({
      kind: this.kind,
      id: this.id,
      key: this.key,
      status: "pending",
      result: null,
      attemptSequence: 0,
      steps: this.steps.map((step) => step.materialize()),
    });
  }
}

/**
 * Defines static flow nodes and the repeatable Task template.  `impl` is the
 * sole dynamic container. Tasks are inserted at the definition-owned point
 * after `dynamicTaskInsertionAfterId`, and each Task receives a materialized
 * `Task.steps[]` template.
 */
export class CurrentFlowDefinition {
  constructor({ root, taskTemplate, dynamicTaskContainerId = "impl", dynamicTaskInsertionAfterId = "implement" }) {
    this.root = root instanceof FlowDefinitionNode ? root : new FlowDefinitionNode(root);
    if (this.root.kind !== "flow") throw new CurrentFlowStateInvariantError("definition.root.kind must be flow");
    this.taskTemplate = taskTemplate instanceof FlowDefinitionNode ? taskTemplate : new FlowDefinitionNode(taskTemplate);
    if (this.taskTemplate.kind !== "task") throw new CurrentFlowStateInvariantError("definition.taskTemplate.kind must be task");
    this.dynamicTaskContainerId = requireString(dynamicTaskContainerId, "definition.dynamicTaskContainerId");
    this.dynamicTaskInsertionAfterId = requireString(dynamicTaskInsertionAfterId, "definition.dynamicTaskInsertionAfterId");
    const ids = new Set();
    for (const node of collectDefinitionNodes(this.root)) {
      if (ids.has(node.id)) throw new CurrentFlowStateInvariantError(`definition duplicates stable id: ${node.id}`);
      ids.add(node.id);
    }
    const taskTemplateNodes = collectDefinitionNodes(this.taskTemplate);
    const taskTemplateIds = new Set();
    const taskTemplateKeys = new Set();
    for (const node of taskTemplateNodes) {
      if (taskTemplateIds.has(node.id)) {
        throw new CurrentFlowStateInvariantError(`definition task template duplicates relative id: ${node.id}`);
      }
      if (taskTemplateKeys.has(node.key)) {
        throw new CurrentFlowStateInvariantError(`definition task template duplicates semantic key: ${node.key}`);
      }
      if (node !== this.taskTemplate && node.kind !== "step") {
        throw new CurrentFlowStateInvariantError("definition Task descendants must be Step nodes");
      }
      taskTemplateIds.add(node.id);
      taskTemplateKeys.add(node.key);
    }
    const dynamicContainer = collectDefinitionNodes(this.root).find((node) => node.id === this.dynamicTaskContainerId);
    if (!dynamicContainer) {
      throw new CurrentFlowStateInvariantError("definition.dynamicTaskContainerId must identify a static node");
    }
    if (!dynamicContainer.steps.some((node) => node.id === this.dynamicTaskInsertionAfterId)) {
      throw new CurrentFlowStateInvariantError("definition.dynamicTaskInsertionAfterId must identify a direct dynamic-container child");
    }
    const staticNodes = collectDefinitionNodes(this.root);
    const staticLeaves = staticNodes.filter((node) => node.steps.length === 0);
    const insertionAnchor = dynamicContainer.steps.find((node) => node.id === this.dynamicTaskInsertionAfterId);
    const insertionAnchorLeaves = collectDefinitionNodes(insertionAnchor).filter((node) => node.steps.length === 0);
    const insertionPosition = staticLeaves.indexOf(insertionAnchorLeaves.at(-1)) + 0.5;
    for (const source of [...staticNodes, ...taskTemplateNodes]) {
      const targetId = source.action?.failurePolicy?.targetNodeId ?? null;
      if (targetId === null) continue;
      const target = staticLeaves.find((candidate) => candidate.id === targetId);
      if (!target || target.steps.length !== 0) {
        throw new CurrentFlowStateInvariantError(
          `definition failure policy target must identify a static leaf: ${targetId}`,
        );
      }
      const sourcePosition = staticNodes.includes(source)
        ? staticLeaves.indexOf(source)
        : insertionPosition;
      const targetPosition = staticLeaves.indexOf(target);
      if (targetPosition >= sourcePosition || !target.contract.permits("done", "in_progress")) {
        throw new CurrentFlowStateInvariantError(
          `definition failure policy target must be an earlier rewindable leaf: ${targetId}`,
        );
      }
    }
    Object.freeze(this);
  }

  materializeRoot() {
    return this.root.materialize();
  }

  // A persisted state does not carry definition semantics. Every authority
  // boundary therefore discards the caller's binding and reconstructs the
  // value under the definition that owns that boundary.
  bindState(value) {
    const serialized = value instanceof CurrentFlowState
      ? CurrentFlowState.prototype.toJSON.call(value)
      : value;
    return new CurrentFlowState(serialized, { definition: this });
  }

  taskFrom({ id, key }) {
    const taskId = requireString(id, "task.id");
    return new TaskNode({
      kind: "task",
      id: taskId,
      key,
      status: "pending",
      result: null,
      attemptSequence: 0,
      steps: this.taskTemplate.steps.map((step) => materializeTaskStep(step, taskId)),
    });
  }

  contractFor(nodeId, root) {
    return this.contractForNode(findNodeInRoot(root, nodeId));
  }

  contractForNode(node) {
    return this.definitionNodeFor(node).contract;
  }

  actionFor(nodeId, root) {
    const node = findNodeInRoot(root, nodeId);
    if (!node) throw new CurrentFlowStateInvariantError(`definition action lookup requires a current-state node: ${nodeId}`);
    const action = this.definitionNodeFor(node).action;
    if (action === null) throw new CurrentFlowStateInvariantError(`definition action lookup requires a leaf node: ${nodeId}`);
    return action;
  }

  definitionNodeFor(node) {
    if (!node) throw new CurrentFlowStateInvariantError("definition lookup requires a current-state node");
    const staticNode = collectDefinitionNodes(this.root).find((candidate) => candidate.id === node.id);
    if (staticNode) return staticNode;
    if (node instanceof TaskNode) return this.taskTemplate;
    const template = collectDefinitionNodes(this.taskTemplate).find((step) => step.key === node.key);
    if (template) return template;
    throw new CurrentFlowStateInvariantError(`definition has no node for current state: ${node.id}`);
  }

  pathFor(root, nodeId) {
    const pathIds = findPathInRoot(root, nodeId);
    if (pathIds === null) throw new CurrentFlowStateInvariantError(`definition path lookup requires a current-state node: ${nodeId}`);
    return Object.freeze(pathIds);
  }

  orderedLeaves(root) {
    this.assertStateShape(root);
    return Object.freeze(collectNodes(root).filter((node) => node.steps.length === 0));
  }

  nextExecutableLeaf(root) {
    return this.orderedLeaves(root).find((node) => EXECUTABLE_NODE_STATUSES.has(node.status)) ?? null;
  }

  taskInsertionIndex(container) {
    const staticContainer = collectDefinitionNodes(this.root)
      .find((node) => node.id === this.dynamicTaskContainerId);
    const anchor = staticContainer.steps.findIndex((node) => node.id === this.dynamicTaskInsertionAfterId);
    let index = anchor + 1;
    while (container.steps[index] instanceof TaskNode) index += 1;
    return index;
  }

  canAddTask(root) {
    const container = findNodeInRoot(root, this.dynamicTaskContainerId);
    const insertionIndex = this.taskInsertionIndex(container);
    return container.steps.slice(insertionIndex).every((node) => (
      collectNodes(node).filter((candidate) => candidate.steps.length === 0)
        .every((leaf) => leaf.status === "pending")
    ));
  }

  assertStateShape(root) {
    if (!(root instanceof FlowRootNode)) throw new CurrentFlowStateInvariantError("state.root must be a FlowRootNode");
    assertStaticShape(
      this.root,
      root,
      this.dynamicTaskContainerId,
      this.taskTemplate,
      this.dynamicTaskInsertionAfterId,
    );
  }
}

function collectDefinitionNodes(root, result = []) {
  result.push(root);
  for (const step of root.steps) collectDefinitionNodes(step, result);
  return result;
}

function assertStaticShape(definition, state, dynamicContainerId, taskTemplate, insertionAfterId) {
  if (definition.kind !== state.kind || definition.id !== state.id || definition.key !== state.key) {
    throw new CurrentFlowStateInvariantError(`state node does not match definition: ${definition.id}`);
  }
  if (definition.id === dynamicContainerId) {
    if (state.steps.length < definition.steps.length) {
      throw new CurrentFlowStateInvariantError("dynamic container is missing static definition nodes");
    }
    const anchorIndex = definition.steps.findIndex((node) => node.id === insertionAfterId);
    const taskStart = anchorIndex + 1;
    const taskCount = state.steps.length - definition.steps.length;
    for (const [index, staticNode] of definition.steps.slice(0, taskStart).entries()) {
      assertStaticShape(staticNode, state.steps[index], dynamicContainerId, taskTemplate, insertionAfterId);
    }
    for (const task of state.steps.slice(taskStart, taskStart + taskCount)) {
      if (!(task instanceof TaskNode)) throw new CurrentFlowStateInvariantError("dynamic container may contain Task nodes only");
      if (task.steps.length !== taskTemplate.steps.length) throw new CurrentFlowStateInvariantError("Task.steps does not match task template");
      for (const [index, step] of task.steps.entries()) {
        assertTaskStepShape(taskTemplate.steps[index], step, task.id);
      }
    }
    for (const [offset, staticNode] of definition.steps.slice(taskStart).entries()) {
      assertStaticShape(
        staticNode,
        state.steps[taskStart + taskCount + offset],
        dynamicContainerId,
        taskTemplate,
        insertionAfterId,
      );
    }
    return;
  }
  if (definition.steps.length !== state.steps.length) throw new CurrentFlowStateInvariantError(`state children do not match definition: ${definition.id}`);
  for (const [index, child] of state.steps.entries()) {
    assertStaticShape(definition.steps[index], child, dynamicContainerId, taskTemplate, insertionAfterId);
  }
}

function materializeTaskStep(definition, parentId) {
  return new StepNode({
    kind: "step",
    id: `${parentId}/${definition.id}`,
    key: definition.key,
    status: "pending",
    result: null,
    attemptSequence: 0,
    steps: definition.steps.map((child) => materializeTaskStep(child, `${parentId}/${definition.id}`)),
  });
}

function assertTaskStepShape(definition, state, parentId) {
  if (
    !(state instanceof StepNode)
    || state.id !== `${parentId}/${definition.id}`
    || state.key !== definition.key
    || state.steps.length !== definition.steps.length
  ) {
    throw new CurrentFlowStateInvariantError("Task.steps does not match task template");
  }
  for (const [index, child] of state.steps.entries()) {
    assertTaskStepShape(definition.steps[index], child, state.id);
  }
}

function findNodeInRoot(root, nodeId) {
  return collectNodes(root).find((node) => node.id === nodeId) ?? null;
}

function findPathInRoot(root, nodeId, trail = []) {
  const pathIds = [...trail, root.id];
  if (root.id === nodeId) return pathIds;
  for (const step of root.steps) {
    const found = findPathInRoot(step, nodeId, pathIds);
    if (found !== null) return found;
  }
  return null;
}

export class FlowExecution {
  constructor(value) {
    requireExactFields(value, new Set(["mode"]), "execution");
    const { mode } = value;
    if (!EXECUTION_MODES.has(mode)) {
      throw new CurrentFlowStateInvariantError(`execution.mode is invalid: ${mode}`);
    }
    this.mode = mode;
    Object.freeze(this);
  }

  toJSON() { return { mode: this.mode }; }
}

export class CurrentCursor {
  constructor({ path: currentPath, attempt }) {
    if (!Array.isArray(currentPath) || currentPath.length === 0) {
      throw new CurrentFlowStateInvariantError("current.path must be a non-empty stable-id array");
    }
    this.path = Object.freeze(currentPath.map((id) => requireString(id, "current.path id")));
    this.attempt = attempt instanceof CurrentAttempt ? attempt : new CurrentAttempt(attempt);
    Object.freeze(this);
  }

  toJSON() { return { path: [...this.path], attempt: this.attempt.toJSON() }; }
}

export class CurrentFailureDisposition {
  constructor({ attempt, decision, outcome, targetPath = null }) {
    if (!(attempt instanceof CurrentAttempt) || attempt.failure === null) {
      throw new CurrentFlowStateInvariantError("failure disposition requires a failed current Attempt");
    }
    if (!(decision instanceof DefinitionFailureDecision)) {
      throw new CurrentFlowStateInvariantError("failure disposition requires a definition-owned decision");
    }
    if (!["failed", "incomplete"].includes(outcome)) {
      throw new CurrentFlowStateInvariantError("failure disposition outcome must be failed or incomplete");
    }
    if (targetPath !== null && (!Array.isArray(targetPath) || targetPath.length === 0)) {
      throw new CurrentFlowStateInvariantError("failure disposition target path must be null or a stable-id path");
    }
    if ((decision.operation === "rewind") !== (targetPath !== null)) {
      throw new CurrentFlowStateInvariantError("rewind failure disposition requires exactly one target path");
    }
    if (targetPath !== null && targetPath.at(-1) !== decision.targetNodeId) {
      throw new CurrentFlowStateInvariantError("failure disposition path must end at the definition target node");
    }
    this.attemptId = attempt.id;
    this.sequence = attempt.sequence;
    this.policy = decision.policy;
    this.operation = decision.operation;
    this.outcome = outcome;
    this.retryKind = decision.retryKind;
    this.remaining = decision.remaining;
    this.targetPath = targetPath === null ? null : Object.freeze([...targetPath]);
    this.reason = decision.reason;
    Object.freeze(this);
  }

  toJSON() {
    return {
      attemptId: this.attemptId,
      sequence: this.sequence,
      policy: this.policy.toJSON(),
      operation: this.operation,
      outcome: this.outcome,
      retryKind: this.retryKind,
      remaining: this.remaining,
      targetPath: this.targetPath === null ? null : [...this.targetPath],
      reason: this.reason,
    };
  }
}

export class CurrentNextActionDescriptor {
  constructor({ path: currentPath, node, operation, action, failureDisposition = null }) {
    if (!Array.isArray(currentPath) || currentPath.length === 0) {
      throw new CurrentFlowStateInvariantError("next action path must be a non-empty stable-id array");
    }
    if (!(node instanceof CurrentFlowNode)) {
      throw new CurrentFlowStateInvariantError("next action requires a current-state node");
    }
    if (!["start", "recover", "resume", "retry", "record", "rewind", "blocked"].includes(operation)) {
      throw new CurrentFlowStateInvariantError("next action operation is invalid");
    }
    if (!(action instanceof DefinitionAction)) {
      throw new CurrentFlowStateInvariantError("next action requires definition-owned action metadata");
    }
    if (failureDisposition !== null && !(failureDisposition instanceof CurrentFailureDisposition)) {
      throw new CurrentFlowStateInvariantError("next action failure disposition is invalid");
    }
    if (["retry", "record", "rewind", "blocked"].includes(operation) !== (failureDisposition !== null)) {
      throw new CurrentFlowStateInvariantError("failed next action requires exactly one typed failure disposition");
    }
    this.path = Object.freeze([...currentPath]);
    this.nodeId = node.id;
    this.nodeKey = node.key;
    this.status = node.status;
    this.operation = operation;
    this.action = action;
    this.failureDisposition = failureDisposition;
    Object.freeze(this);
  }

  toJSON() {
    return {
      path: [...this.path],
      nodeId: this.nodeId,
      nodeKey: this.nodeKey,
      status: this.status,
      operation: this.operation,
      action: this.action.toJSON(),
      failureDisposition: this.failureDisposition?.toJSON() ?? null,
    };
  }
}

export class CurrentRetryEligibility {
  constructor({ path, attempt, semanticRemaining, toolingRemaining }) {
    if (path !== null && (!Array.isArray(path) || path.length === 0)) {
      throw new CurrentFlowStateInvariantError("retry eligibility path must be null or a non-empty stable-id array");
    }
    if (attempt !== null && !(attempt instanceof CurrentAttempt)) {
      throw new CurrentFlowStateInvariantError("retry eligibility Attempt is invalid");
    }
    if (semanticRemaining !== null) requirePositiveInteger(semanticRemaining, "retry eligibility semanticRemaining", { allowZero: true });
    if (toolingRemaining !== null) requirePositiveInteger(toolingRemaining, "retry eligibility toolingRemaining", { allowZero: true });
    this.path = path === null ? null : Object.freeze([...path]);
    this.attempt = attempt;
    this.semanticRemaining = semanticRemaining;
    this.toolingRemaining = toolingRemaining;
    Object.freeze(this);
  }

  get active() { return this.attempt !== null; }
  get semantic() { return this.semanticRemaining !== null && this.semanticRemaining > 0; }
  get tooling() { return this.toolingRemaining !== null && this.toolingRemaining > 0; }

  toJSON() {
    return {
      path: this.path === null ? null : [...this.path],
      attemptId: this.attempt?.id ?? null,
      semantic: this.semantic,
      tooling: this.tooling,
      semanticRemaining: this.semanticRemaining,
      toolingRemaining: this.toolingRemaining,
    };
  }
}

export class CurrentRecoveryTarget {
  constructor({ path: currentPath, node, operation, legal, reason }) {
    if (!Array.isArray(currentPath) || currentPath.length === 0) {
      throw new CurrentFlowStateInvariantError("recovery target path must be a non-empty stable-id array");
    }
    if (!(node instanceof CurrentFlowNode)) {
      throw new CurrentFlowStateInvariantError("recovery target requires a current-state node");
    }
    if (!["rewind", "recover", "unavailable"].includes(operation)) {
      throw new CurrentFlowStateInvariantError("recovery target operation is invalid");
    }
    if (typeof legal !== "boolean") throw new CurrentFlowStateInvariantError("recovery target legality must be boolean");
    this.path = Object.freeze([...currentPath]);
    this.nodeId = node.id;
    this.nodeKey = node.key;
    this.status = node.status;
    this.operation = operation;
    this.legal = legal;
    this.reason = requireString(reason, "recovery target reason");
    Object.freeze(this);
  }

  assertLegal() {
    if (!this.legal) throw new CurrentFlowStateInvariantError(`recovery target is not legal: ${this.reason}`);
    return this;
  }

  toJSON() {
    return {
      path: [...this.path],
      nodeId: this.nodeId,
      nodeKey: this.nodeKey,
      status: this.status,
      operation: this.operation,
      legal: this.legal,
      reason: this.reason,
    };
  }
}

export class CurrentArtifactSource {
  constructor({ path: currentPath, node, artifact }) {
    if (!Array.isArray(currentPath) || currentPath.length === 0) {
      throw new CurrentFlowStateInvariantError("artifact source path must be a non-empty stable-id array");
    }
    if (!(node instanceof CurrentFlowNode)) throw new CurrentFlowStateInvariantError("artifact source requires a current-state node");
    if (!(artifact instanceof ArtifactReference)) throw new CurrentFlowStateInvariantError("artifact source requires a typed artifact reference");
    this.path = Object.freeze([...currentPath]);
    this.nodeId = node.id;
    this.nodeKey = node.key;
    this.artifact = artifact;
    Object.freeze(this);
  }

  toJSON() {
    return {
      path: [...this.path],
      nodeId: this.nodeId,
      nodeKey: this.nodeKey,
      artifact: this.artifact.toJSON(),
    };
  }
}

export class CurrentArtifactResolution {
  constructor({ resourceKind, source = null }) {
    this.resourceKind = requireString(resourceKind, "artifact resolution resourceKind");
    if (source !== null && !(source instanceof CurrentArtifactSource)) {
      throw new CurrentFlowStateInvariantError("artifact resolution source must be typed or null");
    }
    this.source = source;
    Object.freeze(this);
  }

  get missing() { return this.source === null; }

  toJSON() {
    return {
      resourceKind: this.resourceKind,
      missing: this.missing,
      source: this.source?.toJSON() ?? null,
    };
  }
}

export class CurrentArtifactAuthority {
  constructor({ path: currentPath, node, execution, action, resolutions }) {
    if (!Array.isArray(currentPath) || currentPath.length === 0) {
      throw new CurrentFlowStateInvariantError("artifact authority path must be a non-empty stable-id array");
    }
    if (!(node instanceof CurrentFlowNode)) throw new CurrentFlowStateInvariantError("artifact authority requires a current-state node");
    if (!(execution instanceof FlowExecution)) throw new CurrentFlowStateInvariantError("artifact authority requires execution mode");
    if (!(action instanceof DefinitionAction)) throw new CurrentFlowStateInvariantError("artifact authority requires definition action metadata");
    if (!Array.isArray(resolutions) || resolutions.some((resolution) => !(resolution instanceof CurrentArtifactResolution))) {
      throw new CurrentFlowStateInvariantError("artifact authority requires typed resource resolutions");
    }
    this.path = Object.freeze([...currentPath]);
    this.nodeId = node.id;
    this.nodeKey = node.key;
    this.executionMode = execution.mode;
    this.requiredResources = Object.freeze([...action.contextKinds]);
    this.resolutions = Object.freeze([...resolutions]);
    Object.freeze(this);
  }

  toJSON() {
    return {
      path: [...this.path],
      nodeId: this.nodeId,
      nodeKey: this.nodeKey,
      executionMode: this.executionMode,
      requiredResources: [...this.requiredResources],
      resolutions: this.resolutions.map((resolution) => resolution.toJSON()),
    };
  }
}

function assertLeafLifecycle(node) {
  if (node.status === "pending" && node.attemptSequence !== 0) {
    throw new CurrentFlowStateInvariantError(`pending leaf must have a zero Attempt sequence cursor: ${node.id}`);
  }
  if (TERMINAL_NODE_STATUSES.has(node.status) && node.attemptSequence === 0) {
    throw new CurrentFlowStateInvariantError(`terminal leaf requires an Attempt sequence cursor: ${node.id}`);
  }
  if (node.status === "done" && node.result?.outcome !== "passed") {
    throw new CurrentFlowStateInvariantError(`done leaf requires a passed result: ${node.id}`);
  }
  if (node.status === "skipped" && node.result?.outcome !== "skipped") {
    throw new CurrentFlowStateInvariantError(`skipped leaf requires a skipped result: ${node.id}`);
  }
  if (node.status === "failed" && !["failed", "incomplete"].includes(node.result?.outcome)) {
    throw new CurrentFlowStateInvariantError(`failed leaf requires a failed or incomplete result: ${node.id}`);
  }
  if (["pending", "in_progress", "invalidated"].includes(node.status) && node.result !== null) {
    throw new CurrentFlowStateInvariantError(`${node.status} leaf must not retain a result: ${node.id}`);
  }
}

function assertBranchLifecycle(node) {
  if (node.attemptSequence !== 0) {
    throw new CurrentFlowStateInvariantError(`branch node must not carry an Attempt sequence cursor: ${node.id}`);
  }
  for (const child of node.steps) assertNodeLifecycle(child);
  const childStatuses = node.steps.map((child) => child.status);
  const allTerminal = childStatuses.every((status) => TERMINAL_NODE_STATUSES.has(status));
  const allSkipped = childStatuses.every((status) => status === "skipped");
  const completionResult = [...node.steps].reverse().find((child) => child.result !== null)?.result ?? null;
  if (node.status === "pending") {
    if (node.result !== null || !childStatuses.every((status) => status === "pending")) {
      throw new CurrentFlowStateInvariantError(`pending branch must contain only pending children: ${node.id}`);
    }
    return;
  }
  if (node.status === "done") {
    if (!allTerminal || completionResult === null || !jsonEqual(node.result?.toJSON(), completionResult.toJSON())) {
      throw new CurrentFlowStateInvariantError(`done branch requires terminal children and the definition completion result: ${node.id}`);
    }
    return;
  }
  if (node.status === "skipped") {
    if (!allSkipped || completionResult === null || !jsonEqual(node.result?.toJSON(), completionResult.toJSON())) {
      throw new CurrentFlowStateInvariantError(`skipped branch requires skipped children and the definition completion result: ${node.id}`);
    }
    return;
  }
  if (node.status === "invalidated") {
    if (node.result !== null || !childStatuses.includes("invalidated")) {
      throw new CurrentFlowStateInvariantError(`invalidated branch requires an invalidated child and no result: ${node.id}`);
    }
    return;
  }
  if (node.status !== "in_progress") {
    throw new CurrentFlowStateInvariantError(`branch status is incompatible with completion lifecycle: ${node.id}`);
  }
  if (allTerminal) {
    throw new CurrentFlowStateInvariantError(`in_progress branch cannot retain an all-terminal child set: ${node.id}`);
  }
  if (!childStatuses.some((status) => status !== "pending")) {
    throw new CurrentFlowStateInvariantError(`in_progress branch requires progressed child state: ${node.id}`);
  }
}

function assertNodeLifecycle(node) {
  if (node.steps.length === 0) {
    assertLeafLifecycle(node);
  } else {
    assertBranchLifecycle(node);
  }
}

function assertExecutionFrontier(definition, root, currentPath) {
  const leaves = definition.orderedLeaves(root);
  let frontier = null;
  let suffixStatus = null;
  for (const [index, leaf] of leaves.entries()) {
    if (TERMINAL_NODE_STATUSES.has(leaf.status)) {
      if (frontier !== null) {
        throw new CurrentFlowStateInvariantError("execution frontier cannot contain a terminal leaf after unfinished work");
      }
      continue;
    }
    if (frontier === null) {
      frontier = { index, status: leaf.status };
      if (leaf.status !== "in_progress") suffixStatus = leaf.status;
      continue;
    }
    if (frontier.status === "in_progress" && index === frontier.index) continue;
    if (suffixStatus === null) suffixStatus = leaf.status;
    if (!EXECUTABLE_NODE_STATUSES.has(suffixStatus) || leaf.status !== suffixStatus) {
      throw new CurrentFlowStateInvariantError("execution frontier must have one active leaf and a uniform pending or invalidated suffix");
    }
  }
  if (frontier?.status === "in_progress") {
    if (currentPath === null || leaves[frontier.index].id !== currentPath.at(-1)) {
      throw new CurrentFlowStateInvariantError("execution frontier active leaf must match current path");
    }
  } else if (currentPath !== null) {
    throw new CurrentFlowStateInvariantError("current path requires the execution frontier active leaf");
  }
}

export class CurrentFlowState {
  constructor(value, { definition }) {
    if (!(definition instanceof CurrentFlowDefinition)) {
      throw new CurrentFlowStateInvariantError("CurrentFlowState requires a CurrentFlowDefinition");
    }
    if (!isPlainObject(value)) throw new CurrentFlowStateInvariantError("flow state must be an object");
    for (const field of FORBIDDEN_TOP_LEVEL_FIELDS) {
      if (Object.hasOwn(value, field)) throw new CurrentFlowStateInvariantError(`flow state must not contain ${field}`);
    }
    requireExactFields(value, STATE_FIELDS, "flow state");
    if (value.schemaRevision !== CURRENT_FLOW_SCHEMA_REVISION) {
      throw new CurrentFlowStateInvariantError(`unsupported schemaRevision: ${value.schemaRevision}`);
    }
    requirePositiveInteger(value.version, "version");
    this.schemaRevision = value.schemaRevision;
    this.version = value.version;
    this.execution = value.execution instanceof FlowExecution ? value.execution : new FlowExecution(value.execution);
    this.root = new FlowRootNode(rootNodeValue(value));
    definition.assertStateShape(this.root);
    if (value.current !== null && (!Array.isArray(value.current) || value.current.length === 0)) {
      throw new CurrentFlowStateInvariantError("current must be a non-empty stable-id array or null");
    }
    this.current = value.current == null ? null : Object.freeze(value.current.map((id) => requireString(id, "current id")));
    this.attempt = value.attempt == null ? null : value.attempt instanceof CurrentAttempt ? value.attempt : new CurrentAttempt(value.attempt);
    this.confirmationOrder = requirePositiveInteger(value.confirmationOrder, "confirmationOrder", { allowZero: true });
    this.definition = definition;
    this.#assertCurrent();
    Object.freeze(this);
  }

  static create({ definition, execution = { mode: "direct" }, version = CURRENT_FLOW_RESULT_VERSION }) {
    if (!(definition instanceof CurrentFlowDefinition)) {
      throw new CurrentFlowStateInvariantError("CurrentFlowState.create requires a CurrentFlowDefinition");
    }
    const root = definition.materializeRoot();
    return new CurrentFlowState({
      schemaRevision: CURRENT_FLOW_SCHEMA_REVISION,
      version,
      execution,
      ...root.toJSON(),
      current: null,
      attempt: null,
      confirmationOrder: 0,
    }, { definition });
  }

  #assertCurrent() {
    const all = collectNodes(this.root);
    const ids = new Set();
    for (const node of all) {
      if (ids.has(node.id)) throw new CurrentFlowStateInvariantError(`state duplicates stable id: ${node.id}`);
      ids.add(node.id);
      if (!this.definition.contractForNode(node).permitsStatus(node.status)) {
        throw new CurrentFlowStateInvariantError(
          `state status is unreachable in the definition transition graph for ${node.id}: ${node.status}`,
        );
      }
    }
    assertNodeLifecycle(this.root);
    assertExecutionFrontier(this.definition, this.root, this.current);
    const activeLeaves = all.filter((node) => node.steps.length === 0 && node.status === "in_progress");
    if (this.current == null) {
      if (this.attempt !== null) throw new CurrentFlowStateInvariantError("attempt requires a current path");
      if (activeLeaves.length !== 0) throw new CurrentFlowStateInvariantError("an in-progress leaf requires current path and attempt");
      return;
    }
    if (this.attempt == null) throw new CurrentFlowStateInvariantError("current path requires an active Attempt");
    const leaf = nodeAtPath(this.root, this.current);
    if (leaf.steps.length !== 0) throw new CurrentFlowStateInvariantError("current.path must end at a leaf");
    if (leaf.status !== "in_progress") throw new CurrentFlowStateInvariantError("current leaf must be in_progress");
    if (leaf.attemptSequence !== this.attempt.sequence) {
      throw new CurrentFlowStateInvariantError("current Attempt sequence must match the active leaf cursor");
    }
    this.#assertAttemptContractForLeaf(leaf, this.attempt);
    if (activeLeaves.length !== 1 || activeLeaves[0].id !== leaf.id) {
      throw new CurrentFlowStateInvariantError("current path must identify the sole active leaf");
    }
    for (const id of this.current.slice(0, -1)) {
      if (findNodeInRoot(this.root, id).status !== "in_progress") {
        throw new CurrentFlowStateInvariantError("every current path ancestor must be in_progress");
      }
    }
  }

  findNode(id) {
    return findNodeInRoot(this.root, id);
  }

  addTask({ id, key }) {
    const container = this.findNode(this.definition.dynamicTaskContainerId);
    if (!container) throw new CurrentFlowStateInvariantError("dynamic Task container is missing");
    if (this.findNode(id)) throw new CurrentFlowStateInvariantError(`dynamic Task duplicates stable id: ${id}`);
    if (!this.definition.canAddTask(this.root)) {
      throw new CurrentFlowStateInvariantError("dynamic Task insertion is closed after the definition-owned flow suffix begins");
    }
    if (this.current !== null) {
      throw new CurrentFlowStateInvariantError("dynamic Task insertion requires no active Attempt");
    }
    const task = this.definition.taskFrom({ id, key });
    const insertionIndex = this.definition.taskInsertionIndex(container);
    return this.#replaceRoot(replaceNode(this.root, container.id, container.withSteps([
      ...container.steps.slice(0, insertionIndex),
      task,
      ...container.steps.slice(insertionIndex),
    ])));
  }

  startAttempt({ path: currentPath, attempt }) {
    const expected = this.definition.nextExecutableLeaf(this.root);
    if (!expected || expected.id !== currentPath?.at(-1) || expected.status !== "pending") {
      throw new CurrentFlowStateInvariantError("startAttempt must target the definition-owned next executable leaf");
    }
    return this.#activateAttempt({
      path: currentPath,
      attempt,
      allowedLeafStatuses: ["pending"],
      initial: true,
      operation: "startAttempt",
    });
  }

  retryCurrentAttempt({ attempt, kind }) {
    if (this.current == null || this.attempt == null) {
      throw new CurrentFlowStateInvariantError("retryCurrentAttempt requires an active Attempt");
    }
    const leaf = nodeAtPath(this.root, this.current);
    const next = attempt instanceof CurrentAttempt ? attempt : new CurrentAttempt(attempt);
    if (this.attempt.failure === null || !this.attempt.failure.retryable) {
      throw new CurrentFlowStateInvariantError("retryCurrentAttempt requires a retryable failed active Attempt");
    }
    if (this.failureDisposition().operation !== "retry") {
      throw new CurrentFlowStateInvariantError("the definition failure policy does not authorize retry");
    }
    if (kind !== this.attempt.failure.retryKind) {
      throw new CurrentFlowStateInvariantError("retry kind must match the active Attempt failure decision");
    }
    this.#assertAttemptForLeaf(leaf, next, { previous: this.attempt, kind });
    const root = replaceNode(this.root, leaf.id, leaf.with({ attemptSequence: next.sequence }));
    return this.#replaceRoot(root, this.current, next);
  }

  failCurrentAttempt({ failure, result }) {
    if (this.current == null || this.attempt == null) {
      throw new CurrentFlowStateInvariantError("failCurrentAttempt requires an active Attempt");
    }
    if (this.attempt.failure !== null) {
      throw new CurrentFlowStateInvariantError("active Attempt failure is already recorded");
    }
    const recorded = failure instanceof ActivityFailure ? failure : new ActivityFailure(failure);
    const completed = result instanceof NodeResult ? result : new NodeResult(result);
    if (!["failed", "incomplete"].includes(completed.outcome)) {
      throw new CurrentFlowStateInvariantError("failed Attempt result must be failed or incomplete");
    }
    const hasIncompleteWork = this.attempt.incomplete.length > 0;
    if ((completed.outcome === "incomplete") !== hasIncompleteWork) {
      throw new CurrentFlowStateInvariantError(
        "incomplete Attempt result and typed incomplete operation/resource claims must agree",
      );
    }
    const leaf = nodeAtPath(this.root, this.current);
    const replacement = this.attempt.replaceFacts({ failure: recorded });
    this.#assertAttemptContractForLeaf(leaf, replacement);
    return this.#replaceRoot(this.root, this.current, replacement);
  }

  recordCurrentFailure({ result }) {
    if (this.current === null || this.attempt === null || this.attempt.failure === null) {
      throw new CurrentFlowStateInvariantError("recordCurrentFailure requires a failed active Attempt");
    }
    const disposition = this.failureDisposition();
    if (disposition.operation !== "record") {
      throw new CurrentFlowStateInvariantError("the definition failure policy does not authorize recording this failure");
    }
    const recorded = result instanceof NodeResult ? result : new NodeResult(result);
    if (recorded.outcome !== disposition.outcome) {
      throw new CurrentFlowStateInvariantError("recorded failure result must match the active failure outcome");
    }
    const leafId = this.current.at(-1);
    const leaf = this.findNode(leafId);
    const root = reconcileCompletedParents(
      replaceNode(this.root, leafId, transitionNode(leaf, "failed", this.definition, { result: recorded })),
      this.definition,
    );
    return this.#replaceRoot(root, null, null);
  }

  replaceCurrentAttempt({ attempt }) {
    if (this.current == null || this.attempt == null) {
      throw new CurrentFlowStateInvariantError("replaceCurrentAttempt requires an active Attempt");
    }
    const leaf = nodeAtPath(this.root, this.current);
    const replacement = attempt instanceof CurrentAttempt ? attempt : new CurrentAttempt(attempt);
    if (this.attempt.failure !== null) {
      throw new CurrentFlowStateInvariantError("failed Attempt facts are immutable; retry or recovery is required");
    }
    if (
      replacement.id !== this.attempt.id
      || replacement.sequence !== this.attempt.sequence
      || replacement.startedAt !== this.attempt.startedAt
      || replacement.consumption.semantic !== this.attempt.consumption.semantic
      || replacement.consumption.tooling !== this.attempt.consumption.tooling
      || !jsonEqual(replacement.failure?.toJSON() ?? null, this.attempt.failure?.toJSON() ?? null)
    ) {
      throw new CurrentFlowStateInvariantError("active Attempt replacement must preserve attempt identity and retry consumption");
    }
    this.#assertAttemptContractForLeaf(leaf, replacement);
    return this.#replaceRoot(this.root, this.current, replacement);
  }

  confirmCurrentAttempt({ result, status = "done" }) {
    if (this.current == null) throw new CurrentFlowStateInvariantError("confirmCurrentAttempt requires an active Attempt");
    if (this.attempt.failure !== null) {
      throw new CurrentFlowStateInvariantError("a failed Attempt cannot be confirmed without a new retry Attempt");
    }
    if (this.attempt.blocker !== null || this.attempt.incomplete.length > 0) {
      throw new CurrentFlowStateInvariantError("a blocked or incomplete Attempt cannot be confirmed");
    }
    if (!NODE_STATUSES.has(status) || !["done", "skipped"].includes(status)) {
      throw new CurrentFlowStateInvariantError("confirmed current Attempt status must be done or skipped");
    }
    const confirmed = result instanceof NodeResult ? result : new NodeResult(result);
    if (status === "done" && confirmed.outcome !== "passed") {
      throw new CurrentFlowStateInvariantError("done confirmation requires a passed result");
    }
    if (status === "skipped" && confirmed.outcome !== "skipped") {
      throw new CurrentFlowStateInvariantError("skipped confirmation requires a skipped result");
    }
    const leafId = this.current.at(-1);
    const leaf = this.findNode(leafId);
    const root = reconcileCompletedParents(
      replaceNode(this.root, leafId, transitionNode(leaf, status, this.definition, { result: confirmed })),
      this.definition,
    );
    return this.#replaceRoot(root, null, null);
  }

  rewind({ path: currentPath, attempt }) {
    const recovery = this.recoveryTarget(currentPath).assertLegal();
    if (recovery.operation !== "rewind") {
      throw new CurrentFlowStateInvariantError("rewind requires a terminal recovery target");
    }
    const target = nodeAtPath(this.root, currentPath);
    const leaves = this.definition.orderedLeaves(this.root);
    const targetIndex = leaves.findIndex((node) => node.id === target.id);
    const downstreamIds = new Set(leaves.slice(targetIndex + 1).map((node) => node.id));
    let root = this.root;
    for (const id of downstreamIds) {
      const node = findNodeInRoot(root, id);
      root = replaceNode(root, id, transitionNode(node, "invalidated", this.definition, { result: null }));
    }
    root = reconcileInvalidatedParents(root, this.definition);
    const state = this.#replaceRoot(root, null, null);
    return state.#activateAttempt({
      path: currentPath,
      attempt,
      allowedLeafStatuses: ["done", "skipped", "failed", "invalidated"],
      initial: true,
      operation: "rewind",
    });
  }

  recover({ path: currentPath, attempt }) {
    const recovery = this.recoveryTarget(currentPath).assertLegal();
    if (recovery.operation !== "recover") {
      throw new CurrentFlowStateInvariantError("recover requires the next invalidated recovery target");
    }
    return this.#activateAttempt({
      path: currentPath,
      attempt,
      allowedLeafStatuses: ["invalidated"],
      initial: true,
      operation: "recover",
    });
  }

  withConfirmationOrder(confirmationOrder) {
    return new CurrentFlowState({ ...this.toJSON(), confirmationOrder }, { definition: this.definition });
  }

  get cursor() {
    return this.current == null ? null : new CurrentCursor({ path: this.current, attempt: this.attempt });
  }

  nextAction() {
    if (this.current !== null) {
      const failureDisposition = this.failureDisposition();
      const descriptorPath = failureDisposition?.targetPath ?? this.current;
      const node = nodeAtPath(this.root, descriptorPath);
      return new CurrentNextActionDescriptor({
        path: descriptorPath,
        node,
        operation: failureDisposition?.operation ?? "resume",
        action: this.definition.actionFor(node.id, this.root),
        failureDisposition,
      });
    }
    const node = this.definition.nextExecutableLeaf(this.root);
    if (node === null) return null;
    return new CurrentNextActionDescriptor({
      path: this.definition.pathFor(this.root, node.id),
      node,
      operation: node.status === "invalidated" ? "recover" : "start",
      action: this.definition.actionFor(node.id, this.root),
    });
  }

  resumeDescriptor() {
    return this.nextAction();
  }

  failureDisposition() {
    if (this.current === null || this.attempt === null || this.attempt.failure === null) return null;
    const leaf = nodeAtPath(this.root, this.current);
    const action = this.definition.actionFor(leaf.id, this.root);
    const failure = this.attempt.failure;
    const policy = action.failurePolicy;
    const decision = policy.decide({
      failure,
      consumption: this.attempt.consumption,
      contract: this.definition.contractForNode(leaf),
    });
    const targetPath = decision.targetNodeId === null
      ? null
      : this.definition.pathFor(this.root, decision.targetNodeId);
    return new CurrentFailureDisposition({
      attempt: this.attempt,
      decision,
      outcome: this.attempt.incomplete.length > 0 ? "incomplete" : "failed",
      targetPath,
    });
  }

  retryEligibility() {
    if (this.current === null || this.attempt === null) {
      return new CurrentRetryEligibility({
        path: null,
        attempt: null,
        semanticRemaining: null,
        toolingRemaining: null,
      });
    }
    const leaf = nodeAtPath(this.root, this.current);
    const contract = this.definition.contractFor(leaf.id, this.root);
    const failure = this.attempt.failure;
    const decision = failure === null
      ? null
      : this.definition.actionFor(leaf.id, this.root).failurePolicy.decide({
        failure,
        consumption: this.attempt.consumption,
        contract,
      });
    return new CurrentRetryEligibility({
      path: this.current,
      attempt: this.attempt,
      semanticRemaining: decision?.operation === "retry" && decision.retryKind === "semantic"
        ? decision.remaining
        : 0,
      toolingRemaining: decision?.operation === "retry" && decision.retryKind === "tooling"
        ? decision.remaining
        : 0,
    });
  }

  recoveryTarget(currentPath) {
    const target = nodeAtPath(this.root, currentPath);
    const contract = this.definition.contractFor(target.id, this.root);
    if (this.current !== null) {
      const disposition = this.failureDisposition();
      const policyRewind = disposition?.operation === "rewind"
        && jsonEqual(disposition.targetPath, currentPath);
      const legal = policyRewind
        && target.steps.length === 0
        && TERMINAL_NODE_STATUSES.has(target.status)
        && contract.permits(target.status, "in_progress");
      return new CurrentRecoveryTarget({
        path: currentPath,
        node: target,
        operation: legal ? "rewind" : "unavailable",
        legal,
        reason: legal
          ? "the active failure policy authorizes rewind to this definition target"
          : "an active Attempt permits only its definition-owned failure recovery target",
      });
    }
    const next = this.definition.nextExecutableLeaf(this.root);
    const terminal = target.steps.length === 0 && TERMINAL_NODE_STATUSES.has(target.status);
    const invalidated = target.steps.length === 0
      && target.status === "invalidated"
      && next?.id === target.id;
    const legal = (terminal || invalidated) && contract.permits(target.status, "in_progress");
    return new CurrentRecoveryTarget({
      path: currentPath,
      node: target,
      operation: terminal ? "rewind" : invalidated ? "recover" : "unavailable",
      legal,
      reason: legal
        ? terminal ? "terminal leaf may be rewound" : "next invalidated leaf may be recovered"
        : "recovery requires a transition-authorized terminal leaf or next invalidated leaf",
    });
  }

  artifactAuthority() {
    const descriptor = this.nextAction();
    if (descriptor === null) return null;
    const node = this.findNode(descriptor.nodeId);
    const leaves = this.definition.orderedLeaves(this.root);
    const targetIndex = leaves.findIndex((leaf) => leaf.id === node.id);
    const targetTask = descriptor.path
      .map((id) => this.findNode(id))
      .find((candidate) => candidate instanceof TaskNode) ?? null;
    const candidates = leaves.slice(0, targetIndex)
      .filter((leaf) => AUTHORITATIVE_NODE_STATUSES.has(leaf.status) && leaf.result !== null)
      .map((leaf) => {
        const sourcePath = this.definition.pathFor(this.root, leaf.id);
        const sourceTask = sourcePath.map((id) => this.findNode(id)).find((candidate) => candidate instanceof TaskNode) ?? null;
        const scope = sourceTask === null
          ? "flow"
          : targetTask !== null && sourceTask.id === targetTask.id ? "same_task" : "all_tasks";
        return { leaf, sourcePath, scope };
      });
    const resolutions = descriptor.action.contextKinds.map((resourceKind) => {
      let source = null;
      for (const scope of descriptor.action.artifactAuthority.sourceScopes) {
        const matching = candidates.filter((candidate) => (
          candidate.scope === scope
          && candidate.leaf.result.artifactRefs.some((artifact) => artifact.kind === resourceKind)
        ));
        if (matching.length === 0) continue;
        const selected = matching.at(-1);
        const artifact = [...selected.leaf.result.artifactRefs].reverse()
          .find((reference) => reference.kind === resourceKind);
        source = new CurrentArtifactSource({
          path: selected.sourcePath,
          node: selected.leaf,
          artifact,
        });
        break;
      }
      return new CurrentArtifactResolution({ resourceKind, source });
    });
    return new CurrentArtifactAuthority({
      path: descriptor.path,
      node,
      execution: this.execution,
      action: descriptor.action,
      resolutions,
    });
  }

  #activateAttempt({ path: currentPath, attempt, allowedLeafStatuses, initial, operation }) {
    if (this.current != null) throw new CurrentFlowStateInvariantError("a current Attempt is already active");
    const leaf = nodeAtPath(this.root, currentPath);
    if (leaf.steps.length !== 0) throw new CurrentFlowStateInvariantError("Attempt target must be a leaf");
    if (!allowedLeafStatuses.includes(leaf.status)) {
      throw new CurrentFlowStateInvariantError(`${operation} may target only a ${allowedLeafStatuses.join(" or ")} leaf`);
    }
    const parsedAttempt = attempt instanceof CurrentAttempt ? attempt : new CurrentAttempt(attempt);
    this.#assertAttemptForLeaf(leaf, parsedAttempt, { initial });
    let root = this.root;
    for (const id of currentPath) {
      const node = findNodeInRoot(root, id);
      if (node.status !== "in_progress") {
        root = replaceNode(root, id, transitionNode(node, "in_progress", this.definition, {
          result: id === leaf.id ? null : node.result,
          attemptSequence: id === leaf.id ? parsedAttempt.sequence : node.attemptSequence,
        }));
      }
    }
    return this.#replaceRoot(root, currentPath, parsedAttempt);
  }

  #assertAttemptForLeaf(leaf, next, { initial = false, previous = null, kind = null } = {}) {
    this.#assertAttemptContractForLeaf(leaf, next);
    if (initial) {
      if (next.sequence !== leaf.attemptSequence + 1 || next.consumption.semantic !== 0 || next.consumption.tooling !== 0) {
        throw new CurrentFlowStateInvariantError("a new Attempt episode must advance the node sequence and reset retry consumption");
      }
      if (next.failure !== null) throw new CurrentFlowStateInvariantError("a new Attempt must not begin failed");
      return;
    }
    if (!(previous instanceof CurrentAttempt)) {
      throw new CurrentFlowStateInvariantError("retry Attempt requires the previous active Attempt");
    }
    if (!RETRY_KINDS.has(kind)) {
      throw new CurrentFlowStateInvariantError("retry Attempt kind must be semantic or tooling");
    }
    if (next.sequence !== previous.sequence + 1 || next.sequence !== leaf.attemptSequence + 1) {
      throw new CurrentFlowStateInvariantError("retry Attempt sequence must immediately follow the active Attempt and node cursor");
    }
    if (next.id === previous.id) {
      throw new CurrentFlowStateInvariantError("retry Attempt must have a new stable id");
    }
    if (next.failure !== null) throw new CurrentFlowStateInvariantError("a retry Attempt must not begin failed");
    if (kind === "semantic") {
      if (
        next.consumption.semantic !== previous.consumption.semantic + 1
        || next.consumption.tooling !== previous.consumption.tooling
      ) {
        throw new CurrentFlowStateInvariantError("semantic retry must increment only semantic consumption by one");
      }
    } else if (
      next.consumption.semantic !== previous.consumption.semantic
      || next.consumption.tooling !== previous.consumption.tooling + 1
    ) {
      throw new CurrentFlowStateInvariantError("tooling retry must increment only tooling consumption by one");
    }
  }

  #assertAttemptContractForLeaf(leaf, next) {
    const contract = this.definition.contractFor(leaf.id, this.root);
    if (next.consumption.semantic > contract.semanticRetryLimit) {
      throw new CurrentFlowStateInvariantError(`attempt semantic consumption exceeds definition semanticRetryLimit for ${leaf.id}`);
    }
    if (contract.toolingRetryLimit === null && next.consumption.tooling !== 0) {
      throw new CurrentFlowStateInvariantError(`attempt tooling consumption is not authorized for ${leaf.id}`);
    }
    if (contract.toolingRetryLimit !== null && next.consumption.tooling > contract.toolingRetryLimit) {
      throw new CurrentFlowStateInvariantError(`attempt tooling consumption exceeds definition toolingRetryLimit for ${leaf.id}`);
    }
    contract.resourceContract.assertClaims(next.operationClaims, next.incomplete, leaf.id);
  }

  #replaceRoot(root, current = this.current, attempt = this.attempt) {
    return new CurrentFlowState({
      ...this.toJSON(),
      ...root.toJSON(),
      current: current == null ? null : [...current],
      attempt: attempt?.toJSON?.() ?? attempt,
    }, { definition: this.definition });
  }

  toJSON() {
    return {
      schemaRevision: this.schemaRevision,
      version: this.version,
      execution: this.execution.toJSON(),
      ...this.root.toJSON(),
      current: this.current == null ? null : [...this.current],
      attempt: this.attempt?.toJSON() ?? null,
      confirmationOrder: this.confirmationOrder,
    };
  }
}

export class ActivityReference {
  constructor(value) {
    if (new.target === ActivityReference) {
      throw new CurrentFlowStateInvariantError("activity reference requires a concrete reference type");
    }
    requireExactFields(value, new Set(["id", "label"]), "activity reference");
    const { id, label } = value;
    this.id = requireString(id, "activity reference.id");
    if (label !== null) requireString(label, "activity reference.label");
    this.label = label;
    Object.freeze(this);
  }

  toJSON() { return { id: this.id, label: this.label }; }
}

export class ActivityEvaluationReference extends ActivityReference {}
export class ActivityFindingReference extends ActivityReference {}
export class ActivityRepairReference extends ActivityReference {}
export class ActivityArtifactReference extends ActivityReference {}

export class ActivityReferences {
  constructor(value) {
    requireExactFields(value, new Set(["evaluations", "findings", "repairs", "artifacts"]), "activity.references");
    const { evaluations, findings, repairs, artifacts } = value;
    const referenceTypes = {
      evaluations: ActivityEvaluationReference,
      findings: ActivityFindingReference,
      repairs: ActivityRepairReference,
      artifacts: ActivityArtifactReference,
    };
    for (const [field, values] of Object.entries({ evaluations, findings, repairs, artifacts })) {
      if (!Array.isArray(values)) throw new CurrentFlowStateInvariantError(`activity.references.${field} must be an array`);
      const Reference = referenceTypes[field];
      this[field] = Object.freeze(values.map((value) => value instanceof Reference ? value : new Reference(value)));
    }
    Object.freeze(this);
  }

  toJSON() {
    return Object.fromEntries(
      ["evaluations", "findings", "repairs", "artifacts"].map((field) => [field, this[field].map((entry) => entry.toJSON())]),
    );
  }
}

export class ActivityTask {
  constructor(value) {
    requireExactFields(value, new Set(["id", "key"]), "activity.task");
    const { id, key } = value;
    this.id = requireString(id, "activity.task.id");
    this.key = requireString(key, "activity.task.key");
    Object.freeze(this);
  }

  toJSON() { return { id: this.id, key: this.key }; }
}

export class ActivityTransition {
  constructor(value) {
    requireExactFields(value, new Set(["operation", "path", "task", "attempt", "status"]), "activity.transition");
    const { operation, path: currentPath, task, attempt, status } = value;
    if (!["add_task", "start_attempt", "retry_attempt", "update_attempt", "fail_attempt", "record_failure", "confirm_attempt", "rewind", "recover_attempt"].includes(operation)) {
      throw new CurrentFlowStateInvariantError(`activity.transition.operation is invalid: ${operation}`);
    }
    if (!Array.isArray(currentPath) || currentPath.length === 0) {
      throw new CurrentFlowStateInvariantError("activity.transition.path must be a non-empty stable-id array");
    }
    this.operation = operation;
    this.path = Object.freeze(currentPath.map((id) => requireString(id, "activity.transition.path id")));
    this.task = task == null ? null : task instanceof ActivityTask ? task : new ActivityTask(task);
    this.attempt = attempt == null ? null : attempt instanceof CurrentAttempt ? attempt : new CurrentAttempt(attempt);
    const taskRequired = operation === "add_task";
    if (taskRequired !== (this.task !== null)) {
      throw new CurrentFlowStateInvariantError("add_task is the only transition that requires a Task payload");
    }
    const attemptRequired = TRANSITION_ATTEMPT_OPERATIONS.has(operation);
    if (attemptRequired !== (this.attempt !== null)) {
      throw new CurrentFlowStateInvariantError(
        attemptRequired
          ? `activity.transition ${operation} requires an Attempt payload`
          : `activity.transition ${operation} forbids an Attempt payload`,
      );
    }
    if (operation === "confirm_attempt") {
      if (!["done", "skipped"].includes(status)) {
        throw new CurrentFlowStateInvariantError("confirm_attempt transition requires done or skipped status");
      }
    } else if (status !== null) {
      throw new CurrentFlowStateInvariantError("only confirm_attempt transition may specify status");
    }
    this.status = status;
    Object.freeze(this);
  }

  apply(state, activity) {
    const targetId = this.path.at(-1);
    if (activity.nodeId !== targetId) throw new CurrentFlowStateInvariantError("Activity nodeId must match transition path leaf");
    const target = nodeAtPath(state.root, this.path);
    if (this.operation === "add_task") {
      if (target.id !== state.definition.dynamicTaskContainerId) {
        throw new CurrentFlowStateInvariantError("add_task Activity must target the definition dynamic Task container");
      }
      return state.addTask(this.task);
    }
    if (["start_attempt", "rewind", "recover_attempt"].includes(this.operation)) {
      if (activity.attemptId !== this.attempt.id || activity.sequence !== this.attempt.sequence) {
        throw new CurrentFlowStateInvariantError("Activity attemptId/sequence must match its transition Attempt");
      }
      if (this.operation === "start_attempt") {
        return state.startAttempt({ path: this.path, attempt: this.attempt });
      }
      return this.operation === "rewind"
        ? state.rewind({ path: this.path, attempt: this.attempt })
        : state.recover({ path: this.path, attempt: this.attempt });
    }
    if (this.operation === "retry_attempt") {
      if (state.current == null || state.current.at(-1) !== targetId) {
        throw new CurrentFlowStateInvariantError("retry_attempt Activity must target the active current leaf");
      }
      if (activity.attemptId !== state.attempt.id || activity.sequence !== state.attempt.sequence) {
        throw new CurrentFlowStateInvariantError("retry_attempt Activity must identify the active Attempt being replaced");
      }
      return state.retryCurrentAttempt({ attempt: this.attempt, kind: state.attempt.failure.retryKind });
    }
    if (this.operation === "update_attempt") {
      if (state.current == null || state.current.at(-1) !== targetId) {
        throw new CurrentFlowStateInvariantError("update_attempt Activity must target the active current leaf");
      }
      if (activity.attemptId !== state.attempt.id || activity.sequence !== state.attempt.sequence) {
        throw new CurrentFlowStateInvariantError("update_attempt Activity must identify the active Attempt being replaced");
      }
      return state.replaceCurrentAttempt({ attempt: this.attempt });
    }
    if (this.operation === "fail_attempt") {
      if (state.current == null || state.current.at(-1) !== targetId) {
        throw new CurrentFlowStateInvariantError("fail_attempt Activity must target the active current leaf");
      }
      if (activity.attemptId !== state.attempt.id || activity.sequence !== state.attempt.sequence) {
        throw new CurrentFlowStateInvariantError("fail_attempt Activity must identify the active Attempt");
      }
      return state.failCurrentAttempt({ failure: activity.failure, result: activity.result });
    }
    if (this.operation === "record_failure") {
      if (state.current == null || state.current.at(-1) !== targetId) {
        throw new CurrentFlowStateInvariantError("record_failure Activity must target the active current leaf");
      }
      if (activity.attemptId !== state.attempt.id || activity.sequence !== state.attempt.sequence) {
        throw new CurrentFlowStateInvariantError("record_failure Activity must identify the active failed Attempt");
      }
      if (activity.result == null) throw new CurrentFlowStateInvariantError("record_failure Activity requires a result");
      return state.recordCurrentFailure({ result: activity.result });
    }
    if (state.current == null || state.current.at(-1) !== targetId) {
      throw new CurrentFlowStateInvariantError("confirm_attempt Activity must target the active current leaf");
    }
    if (activity.attemptId !== state.attempt.id) {
      throw new CurrentFlowStateInvariantError("confirm_attempt Activity attemptId must match the current Attempt");
    }
    if (activity.sequence !== state.attempt.sequence) {
      throw new CurrentFlowStateInvariantError("confirm_attempt Activity sequence must match the current Attempt sequence");
    }
    if (activity.result == null) throw new CurrentFlowStateInvariantError("confirm_attempt Activity requires a result");
    return state.confirmCurrentAttempt({ result: activity.result, status: this.status });
  }

  toJSON() {
    return {
      operation: this.operation,
      path: [...this.path],
      task: this.task?.toJSON() ?? null,
      attempt: this.attempt?.toJSON() ?? null,
      status: this.status,
    };
  }
}

export class FlowActivity {
  constructor(value) {
    requireExactFields(value, new Set([
      "id", "nodeId", "nodeKey", "attemptId", "sequence", "confirmationOrder", "type", "transition",
      "result", "timing", "failure", "provider", "model", "effort", "usage", "references",
    ]), "activity");
    const {
      id, nodeId, nodeKey, attemptId, sequence, confirmationOrder, type, transition,
      result, timing, failure, provider, model, effort, usage, references,
    } = value;
    this.id = requireString(id, "activity.id");
    this.nodeId = requireString(nodeId, "activity.nodeId");
    this.nodeKey = requireString(nodeKey, "activity.nodeKey");
    if (attemptId !== null) requireString(attemptId, "activity.attemptId");
    this.attemptId = attemptId;
    if (sequence !== null) requirePositiveInteger(sequence, "activity.sequence");
    this.sequence = sequence;
    this.confirmationOrder = requirePositiveInteger(confirmationOrder, "activity.confirmationOrder");
    if (!ATTEMPT_TYPES.has(type)) throw new CurrentFlowStateInvariantError(`activity.type is invalid: ${type}`);
    this.type = type;
    this.transition = transition instanceof ActivityTransition ? transition : new ActivityTransition(transition);
    const typeForOperation = {
      add_task: "task_added",
      start_attempt: "attempt_started",
      retry_attempt: "attempt_retried",
      update_attempt: "attempt_updated",
      fail_attempt: "attempt_failed",
      record_failure: "failure_recorded",
      confirm_attempt: "result_confirmed",
      rewind: "recovery",
      recover_attempt: "recovery",
    };
    if (typeForOperation[this.transition.operation] !== this.type) {
      throw new CurrentFlowStateInvariantError("activity.type must match its deterministic transition operation");
    }
    this.result = result == null ? null : result instanceof NodeResult ? result : new NodeResult(result);
    if (["confirm_attempt", "fail_attempt", "record_failure"].includes(this.transition.operation) && this.result == null) {
      throw new CurrentFlowStateInvariantError("completed Attempt Activity requires a result");
    }
    if (!["confirm_attempt", "fail_attempt", "record_failure"].includes(this.transition.operation) && this.result !== null) {
      throw new CurrentFlowStateInvariantError("only completed Attempt Activity may carry a result");
    }
    if (["fail_attempt", "record_failure"].includes(this.transition.operation) && !["failed", "incomplete"].includes(this.result.outcome)) {
      throw new CurrentFlowStateInvariantError(`${this.transition.operation} Activity result must be failed or incomplete`);
    }
    if (this.transition.operation === "add_task") {
      if (this.attemptId !== null || this.sequence !== null) {
        throw new CurrentFlowStateInvariantError("add_task Activity must not carry Attempt identity or sequence");
      }
    } else if (this.attemptId === null || this.sequence === null) {
      throw new CurrentFlowStateInvariantError("Attempt Activity requires Attempt identity and sequence");
    }
    if (["start_attempt", "rewind", "recover_attempt"].includes(this.transition.operation)) {
      if (this.attemptId !== this.transition.attempt.id || this.sequence !== this.transition.attempt.sequence) {
        throw new CurrentFlowStateInvariantError("Activity attemptId/sequence must match its transition Attempt");
      }
    }
    if (this.transition.operation === "update_attempt") {
      if (this.attemptId !== this.transition.attempt.id || this.sequence !== this.transition.attempt.sequence) {
        throw new CurrentFlowStateInvariantError("update_attempt Activity attemptId/sequence must match its replacement Attempt");
      }
    }
    this.timing = timing == null ? null : new ActivityTiming(timing);
    this.failure = failure == null ? null : new ActivityFailure(failure);
    if (this.transition.operation === "fail_attempt") {
      if (this.failure == null) throw new CurrentFlowStateInvariantError("fail_attempt Activity requires failure facts");
    } else if (this.failure !== null) {
      throw new CurrentFlowStateInvariantError("only fail_attempt Activity may carry failure facts");
    }
    for (const [field, value] of Object.entries({ provider, model, effort })) {
      if (value !== null) requireString(value, `activity.${field}`);
    }
    this.provider = provider;
    this.model = model;
    this.effort = effort;
    this.usage = usage == null ? null : new ActivityUsage(usage);
    this.references = references instanceof ActivityReferences ? references : new ActivityReferences(references);
    Object.freeze(this);
  }

  static canonical(value) {
    const serialized = value instanceof FlowActivity
      ? FlowActivity.prototype.toJSON.call(value)
      : value;
    return new FlowActivity(serialized);
  }

  toJSON() {
    return {
      id: this.id,
      nodeId: this.nodeId,
      nodeKey: this.nodeKey,
      attemptId: this.attemptId,
      sequence: this.sequence,
      confirmationOrder: this.confirmationOrder,
      type: this.type,
      transition: this.transition.toJSON(),
      result: this.result?.toJSON() ?? null,
      timing: this.timing?.toJSON() ?? null,
      failure: this.failure?.toJSON() ?? null,
      provider: this.provider,
      model: this.model,
      effort: this.effort,
      usage: this.usage?.toJSON() ?? null,
      references: this.references.toJSON(),
    };
  }
}

export class ActivityTiming {
  constructor(value) {
    requireExactFields(value, new Set(["startedAt", "finishedAt", "durationMs"]), "activity.timing");
    const { startedAt, finishedAt, durationMs } = value;
    this.startedAt = requireIso(startedAt, "activity.timing.startedAt");
    this.finishedAt = requireIso(finishedAt, "activity.timing.finishedAt");
    if (Date.parse(this.finishedAt) < Date.parse(this.startedAt)) throw new CurrentFlowStateInvariantError("activity.timing cannot finish before it starts");
    if (durationMs !== null) requirePositiveInteger(durationMs, "activity.timing.durationMs", { allowZero: true });
    this.durationMs = durationMs;
    Object.freeze(this);
  }

  toJSON() { return { startedAt: this.startedAt, finishedAt: this.finishedAt, durationMs: this.durationMs }; }
}

export class ActivityUsage {
  constructor(value) {
    requireExactFields(value, new Set(["inputTokens", "outputTokens", "cacheReadTokens", "cost"]), "activity.usage");
    const { inputTokens, outputTokens, cacheReadTokens, cost } = value;
    this.inputTokens = requirePositiveInteger(inputTokens, "activity.usage.inputTokens", { allowZero: true });
    this.outputTokens = requirePositiveInteger(outputTokens, "activity.usage.outputTokens", { allowZero: true });
    this.cacheReadTokens = requirePositiveInteger(cacheReadTokens, "activity.usage.cacheReadTokens", { allowZero: true });
    if (cost !== null && (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0)) {
      throw new CurrentFlowStateInvariantError("activity.usage.cost must be a non-negative number or null");
    }
    this.cost = cost;
    Object.freeze(this);
  }

  toJSON() { return { inputTokens: this.inputTokens, outputTokens: this.outputTokens, cacheReadTokens: this.cacheReadTokens, cost: this.cost }; }
}

function assertJournalAttemptIdentities(entries) {
  const identities = new Map();
  const lastSequenceByNode = new Map();
  const lastActivityByAttempt = new Map();
  const registerIdentity = (attemptId, sequence, nodeId) => {
    const previous = identities.get(attemptId);
    if (previous && (previous.sequence !== sequence || previous.nodeId !== nodeId)) {
      throw new CurrentFlowStateInvariantError(`Attempt id ${attemptId} is reused for a different node or sequence`);
    }
    identities.set(attemptId, { sequence, nodeId });
  };
  const introductions = new Set(["start_attempt", "retry_attempt", "rewind", "recover_attempt"]);
  for (const entry of entries) {
    if (entry.transition.operation === "record_failure") {
      const failureActivity = lastActivityByAttempt.get(entry.attemptId);
      if (
        failureActivity?.transition.operation !== "fail_attempt"
        || !jsonEqual(failureActivity.result.toJSON(), entry.result.toJSON())
      ) {
        throw new CurrentFlowStateInvariantError(
          "record_failure Activity must immediately preserve the failed Attempt result",
        );
      }
    }
    if (introductions.has(entry.transition.operation)) {
      const introduced = entry.transition.attempt;
      const previousSequence = lastSequenceByNode.get(entry.nodeId) ?? 0;
      if (introduced.sequence !== previousSequence + 1) {
        throw new CurrentFlowStateInvariantError(`Attempt sequence must be contiguous for node ${entry.nodeId}`);
      }
      registerIdentity(introduced.id, introduced.sequence, entry.nodeId);
      lastSequenceByNode.set(entry.nodeId, introduced.sequence);
    }
    if (entry.attemptId !== null) {
      const known = identities.get(entry.attemptId);
      if (!known) {
        throw new CurrentFlowStateInvariantError(`Activity references an unknown Attempt id: ${entry.attemptId}`);
      }
      registerIdentity(entry.attemptId, entry.sequence, entry.nodeId);
    }
    if (entry.transition.operation === "update_attempt") {
      registerIdentity(entry.transition.attempt.id, entry.transition.attempt.sequence, entry.nodeId);
    }
    if (entry.attemptId !== null) lastActivityByAttempt.set(entry.attemptId, entry);
  }
}

export class FlowActivityJournal {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.directoryAuthority = new RealDirectoryAuthority(path.dirname(this.filePath));
    Object.freeze(this);
  }

  read() {
    return this.#readSnapshot().entries;
  }

  #readSnapshot() {
    const opened = this.#openExisting(fs.constants.O_RDONLY);
    if (opened === null) return { entries: [], identity: null };
    let content;
    try {
      content = fs.readFileSync(opened.descriptor, "utf8");
    } finally {
      fs.closeSync(opened.descriptor);
    }
    this.#assertVisibleIdentity(opened.identity);
    if (content === "") return { entries: [], identity: opened.identity };
    if (!content.endsWith("\n")) {
      throw new CurrentFlowStateInvariantError("activities.jsonl ends with a partial line");
    }
    const entries = content.trimEnd().split("\n").map((line, index) => {
      try { return new FlowActivity(JSON.parse(line)); } catch (error) {
        throw new CurrentFlowStateInvariantError(`invalid activities.jsonl line ${index + 1}: ${error.message}`);
      }
    });
    const ids = new Set();
    let order = 0;
    for (const entry of entries) {
      if (ids.has(entry.id)) throw new CurrentFlowStateInvariantError(`activities duplicate id: ${entry.id}`);
      if (entry.confirmationOrder !== order + 1) throw new CurrentFlowStateInvariantError("activities confirmationOrder must be contiguous");
      ids.add(entry.id);
      order = entry.confirmationOrder;
    }
    assertJournalAttemptIdentities(entries);
    return { entries, identity: opened.identity };
  }

  append(activity, writerAuthority) {
    if (writerAuthority !== JOURNAL_WRITER_AUTHORITY) {
      throw new CurrentFlowStateInvariantError("activities.jsonl may be appended only by CurrentFlowStateStore");
    }
    const snapshot = this.#readSnapshot();
    const { entries } = snapshot;
    const next = FlowActivity.canonical(activity);
    const existing = entries.find((entry) => entry.id === next.id);
    if (existing) {
      if (!jsonEqual(existing.toJSON(), next.toJSON())) {
        throw new CurrentFlowStateConflictError(`activity id ${next.id} was already appended with a different payload`);
      }
      return { appended: false, activity: existing };
    }
    const expectedOrder = entries.length + 1;
    if (next.confirmationOrder !== expectedOrder) {
      throw new CurrentFlowStateConflictError("new Activity confirmationOrder must follow the append-only journal");
    }
    assertJournalAttemptIdentities([...entries, next]);
    const opened = this.#openAppend(snapshot.identity);
    try {
      fs.writeFileSync(opened.descriptor, `${JSON.stringify(next.toJSON())}\n`, "utf8");
      fs.fsyncSync(opened.descriptor);
    } finally {
      fs.closeSync(opened.descriptor);
    }
    this.#assertVisibleIdentity(opened.identity);
    if (opened.created) fsyncDirectory(path.dirname(this.filePath));
    return { appended: true, activity: next };
  }

  writeMarkdown(viewPath = path.join(path.dirname(this.filePath), "activities.md")) {
    const resolvedViewPath = path.resolve(requireString(viewPath, "activity markdown viewPath"));
    if (resolvedViewPath === this.filePath || resolvedViewPath === path.join(path.dirname(this.filePath), "flow.json")) {
      throw new CurrentFlowStateInvariantError("activity markdown view must not replace flow.json or activities.jsonl");
    }
    const view = new ActivityMarkdownView(this.read());
    new AtomicFile(resolvedViewPath, { phaseNamespace: "current-flow-activity-view" })
      .write(Buffer.from(view.toMarkdown()));
    return view;
  }

  #openExisting(flags) {
    this.directoryAuthority.assertStable();
    let visible;
    try {
      visible = fs.lstatSync(this.filePath);
    } catch (cause) {
      if (cause.code === "ENOENT") return null;
      throw cause;
    }
    this.#assertRegularRealFile(visible);
    const descriptor = fs.openSync(this.filePath, flags | (fs.constants.O_NOFOLLOW || 0));
    return { descriptor, identity: this.#openedIdentity(descriptor, visible) };
  }

  #openAppend(expectedIdentity) {
    const existing = this.#openExisting(fs.constants.O_WRONLY | fs.constants.O_APPEND);
    if (expectedIdentity !== null) {
      if (existing === null || !sameFileIdentity(existing.identity, expectedIdentity)) {
        if (existing !== null) fs.closeSync(existing.descriptor);
        throw new CurrentFlowStateInvariantError("Activity journal authority changed between read and append");
      }
      return { ...existing, created: false };
    }
    if (existing !== null) {
      fs.closeSync(existing.descriptor);
      throw new CurrentFlowStateInvariantError("Activity journal authority appeared between read and append");
    }
    this.directoryAuthority.assertStable();
    const descriptor = fs.openSync(
      this.filePath,
      fs.constants.O_WRONLY
        | fs.constants.O_APPEND
        | fs.constants.O_CREAT
        | fs.constants.O_EXCL
        | (fs.constants.O_NOFOLLOW || 0),
      0o644,
    );
    return { descriptor, identity: this.#openedIdentity(descriptor), created: true };
  }

  #openedIdentity(descriptor, expected = null) {
    try {
      const opened = fs.fstatSync(descriptor);
      if (
        !opened.isFile()
        || opened.nlink !== 1
        || (expected !== null && !sameFileIdentity(expected, opened))
      ) {
        throw new CurrentFlowStateInvariantError("Activity journal authority changed while opening");
      }
      return { dev: opened.dev, ino: opened.ino };
    } catch (cause) {
      fs.closeSync(descriptor);
      throw cause;
    }
  }

  #assertVisibleIdentity(identity) {
    this.directoryAuthority.assertStable();
    let visible;
    try {
      visible = fs.lstatSync(this.filePath);
    } catch (cause) {
      throw new CurrentFlowStateInvariantError("Activity journal authority disappeared", { cause });
    }
    this.#assertRegularRealFile(visible);
    if (!sameFileIdentity(visible, identity)) {
      throw new CurrentFlowStateInvariantError("Activity journal authority changed during access");
    }
  }

  #assertRegularRealFile(stat) {
    if (
      !stat.isFile()
      || stat.isSymbolicLink()
      || stat.nlink !== 1
      || fs.realpathSync(this.filePath) !== this.filePath
    ) {
      throw new CurrentFlowStateInvariantError("Activity journal authority must be a regular real file");
    }
  }
}

export class ActivityMarkdownView {
  constructor(entries) {
    if (!Array.isArray(entries) || entries.some((entry) => !(entry instanceof FlowActivity))) {
      throw new CurrentFlowStateInvariantError("activity markdown view requires typed Activity entries");
    }
    this.entries = Object.freeze([...entries]);
    Object.freeze(this);
  }

  toMarkdown() {
    const escape = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
    const lines = [
      "# Flow activities",
      "",
      "This view is generated from `activities.jsonl`; it is not Flow control input.",
      "",
      "| Order | Type | Node | Attempt | Result | Failure | Artifacts |",
      "| ---: | --- | --- | --- | --- | --- | --- |",
    ];
    for (const entry of this.entries) {
      lines.push([
        `| ${entry.confirmationOrder}`,
        escape(entry.type),
        escape(`${entry.nodeKey} (${entry.nodeId})`),
        escape(entry.attemptId === null ? "—" : `${entry.attemptId} #${entry.sequence}`),
        escape(entry.result?.outcome ?? "—"),
        escape(entry.failure?.code ?? "—"),
        escape(entry.references.artifacts.map((artifact) => artifact.id).join(", ") || "—"),
      ].join(" | ") + " |");
    }
    return `${lines.join("\n")}\n`;
  }
}

export class CurrentFlowStateSnapshot {
  constructor({ state, revision }) {
    if (!(state instanceof CurrentFlowState)) {
      throw new CurrentFlowStateInvariantError("flow state snapshot requires a typed current state");
    }
    if (typeof revision !== "string" || !/^[a-f0-9]{64}$/.test(revision)) {
      throw new CurrentFlowStateInvariantError("flow state snapshot revision must be a SHA-256 digest");
    }
    this.state = state;
    this.revision = revision;
    Object.freeze(this);
  }
}

/**
 * The only persistence API for the new flow.json contract.  The journal is
 * appended before the state CAS.  A crash in that window is resolved by
 * reapplying the same Activity id/order; a conflicting duplicate is rejected.
 */
export class CurrentFlowStateStore {
  constructor({ directory, definition, faultInjector = () => {}, processIdentitySource } = {}) {
    this.directory = path.resolve(requireString(directory, "store.directory"));
    if (!(definition instanceof CurrentFlowDefinition)) throw new CurrentFlowStateInvariantError("store requires a CurrentFlowDefinition");
    if (typeof faultInjector !== "function") throw new CurrentFlowStateInvariantError("store.faultInjector must be a function");
    fs.mkdirSync(this.directory, { recursive: true, mode: 0o755 });
    const lockErrorFactory = (status, message, { lockPath, cause } = {}) => {
      const error = new CurrentFlowStateConflictError(message);
      error.code = `CURRENT_FLOW_STATE_LOCK_${status.replace(/-/g, "_").toUpperCase()}`;
      error.lockPath = lockPath;
      if (cause) error.cause = cause;
      return error;
    };
    this.definition = definition;
    this.faultInjector = faultInjector;
    this.statePath = path.join(this.directory, "flow.json");
    this.journal = new FlowActivityJournal(path.join(this.directory, "activities.jsonl"));
    this.directoryAuthority = new RealDirectoryAuthority(this.directory, { errorFactory: lockErrorFactory });
    this.lock = new ProcessOwnedLock({
      directoryAuthority: this.directoryAuthority,
      fileName: ".current-flow-state.lock",
      kind: "current-flow-state",
      authority: {
        directory: this.directory,
        statePath: this.statePath,
        activityPath: this.journal.filePath,
      },
      ...(processIdentitySource && { processIdentitySource }),
      errorFactory: lockErrorFactory,
    });
    Object.freeze(this);
  }

  create(state) {
    const next = this.definition.bindState(state);
    return this.#withLock(() => {
      if (fs.existsSync(this.statePath)) throw new CurrentFlowStateConflictError("current flow state already exists");
      if (next.confirmationOrder !== 0 || next.current !== null || next.attempt !== null) {
        throw new CurrentFlowStateInvariantError("current flow store creation requires a fresh state without Activity progress");
      }
      const fresh = CurrentFlowState.create({
        definition: this.definition,
        execution: next.execution.toJSON(),
        version: next.version,
      });
      if (!jsonEqual(next.toJSON(), fresh.toJSON())) {
        throw new CurrentFlowStateInvariantError("current flow store creation requires the definition's fresh materialized state");
      }
      if (this.journal.read().length !== 0) {
        throw new CurrentFlowStateConflictError("current flow store creation requires an absent or empty Activity journal");
      }
      fs.mkdirSync(this.directory, { recursive: true, mode: 0o755 });
      this.#write(next, null);
      return next;
    });
  }

  load() {
    return this.loadSnapshot()?.state ?? null;
  }

  loadSnapshot() {
    return this.#withLock(() => {
      const bytes = this.#readStateBytes();
      if (bytes === null) {
        const entries = this.journal.read();
        if (entries.length !== 0) {
          throw new CurrentFlowStateConflictError("Activity journal exists without flow state");
        }
        return null;
      }
      const state = this.#parse(bytes);
      this.#assertJournalConsistency(state, this.journal.read());
      return new CurrentFlowStateSnapshot({ state, revision: digest(bytes) });
    });
  }

  writeActivitiesView(viewPath = path.join(this.directory, "activities.md")) {
    const resolvedViewPath = path.resolve(requireString(viewPath, "store activity viewPath"));
    if (resolvedViewPath === this.statePath || resolvedViewPath === this.journal.filePath) {
      throw new CurrentFlowStateInvariantError("activity markdown view must not replace flow.json or activities.jsonl");
    }
    return this.#withLock(() => this.journal.writeMarkdown(resolvedViewPath));
  }

  apply({ activity, expectedRevision = null }) {
    const proposed = FlowActivity.canonical(activity);
    return this.#withLock(() => {
      const originalBytes = this.#readStateBytes();
      if (originalBytes === null) {
        throw new CurrentFlowStateConflictError("current flow state does not exist");
      }
      const original = this.#parse(originalBytes);
      if (expectedRevision !== null && expectedRevision !== digest(originalBytes)) {
        throw new CurrentFlowStateConflictError("flow state changed before update");
      }
      const entries = this.journal.read();
      this.#assertJournalConsistency(original, entries);
      const existing = entries.find((entry) => entry.id === proposed.id);
      if (existing && !jsonEqual(existing.toJSON(), proposed.toJSON())) {
        throw new CurrentFlowStateConflictError(`activity id ${proposed.id} was already appended with a different payload`);
      }
      if (original.confirmationOrder >= proposed.confirmationOrder) {
        if (!existing) throw new CurrentFlowStateConflictError("state confirmation order is ahead of its Activity journal");
        return original;
      }
      if (proposed.confirmationOrder !== original.confirmationOrder + 1) {
        throw new CurrentFlowStateConflictError("Activity confirmationOrder must immediately follow current state");
      }
      // The update is carried by the Activity itself.  This is important for
      // journal-first crash recovery: a replay cannot silently substitute a
      // different callback for a persisted Activity id/order.
      const next = this.#applyActivity(original, proposed);
      this.journal.append(proposed, JOURNAL_WRITER_AUTHORITY);
      this.faultInjector({ phase: "activity-appended", activity: proposed, state: original });
      this.#write(next, originalBytes);
      this.faultInjector({ phase: "state-written", activity: proposed, state: next });
      return next;
    });
  }

  #parse(bytes) {
    try { return this.definition.bindState(JSON.parse(bytes.toString("utf8"))); } catch (error) {
      if (error instanceof CurrentFlowStateInvariantError) throw error;
      throw new CurrentFlowStateInvariantError(`invalid flow.json: ${error.message}`);
    }
  }

  #assertJournalConsistency(state, entries) {
    const journalOrder = entries.at(-1)?.confirmationOrder ?? 0;
    if (journalOrder < state.confirmationOrder) {
      throw new CurrentFlowStateConflictError("flow state confirmation order is ahead of its Activity journal");
    }
    if (journalOrder > state.confirmationOrder + 1) {
      throw new CurrentFlowStateConflictError("Activity journal is more than one transition ahead of flow state");
    }
    let replayed = CurrentFlowState.create({
      definition: this.definition,
      execution: state.execution.toJSON(),
      version: state.version,
    });
    try {
      for (const entry of entries.slice(0, state.confirmationOrder)) {
        replayed = this.#applyActivity(replayed, entry);
      }
    } catch (error) {
      throw new CurrentFlowStateConflictError(`Activity journal cannot reproduce flow state: ${error.message}`);
    }
    if (!jsonEqual(replayed.toJSON(), state.toJSON())) {
      throw new CurrentFlowStateConflictError("flow state content conflicts with its Activity journal");
    }
    if (journalOrder === state.confirmationOrder + 1) {
      try {
        this.#applyActivity(replayed, entries.at(-1));
      } catch (error) {
        throw new CurrentFlowStateConflictError(`pending Activity cannot advance flow state: ${error.message}`);
      }
    }
  }

  #applyActivity(state, activity) {
    const activityNode = state.findNode(activity.nodeId);
    if (!activityNode || activityNode.key !== activity.nodeKey) {
      throw new CurrentFlowStateInvariantError("Activity must reference a current-state node by stable id and semantic key");
    }
    return activity.transition.apply(state, activity).withConfirmationOrder(activity.confirmationOrder);
  }

  #write(state, expectedBytes) {
    const content = Buffer.from(`${JSON.stringify(state.toJSON(), null, 2)}\n`);
    const file = new AtomicFile(this.statePath, {
      phaseNamespace: "current-flow-state",
      faultInjector: this.faultInjector,
      commitGuard: () => {
        if (expectedBytes === null) {
          if (this.#readStateBytes() !== null) throw new CurrentFlowStateConflictError("current flow state already exists");
          return;
        }
        const visible = this.#readStateBytes();
        if (visible === null) throw new CurrentFlowStateConflictError("current flow state disappeared during update");
        if (!visible.equals(expectedBytes)) throw new CurrentFlowStateConflictError("flow state changed during update");
      },
    });
    file.write(content);
  }

  #readStateBytes() {
    const bytes = new AtomicFile(this.statePath, { phaseNamespace: "current-flow-state-read" }).read(null);
    if (bytes === null) return null;
    const visible = fs.lstatSync(this.statePath);
    if (
      !visible.isFile()
      || visible.isSymbolicLink()
      || visible.nlink !== 1
      || fs.realpathSync(this.statePath) !== this.statePath
    ) {
      throw new CurrentFlowStateInvariantError("flow state authority must be a single-link regular real file");
    }
    return bytes;
  }

  #withLock(operation) {
    this.lock.acquire({ claimStale: true });
    let result;
    let primaryError = null;
    try {
      result = operation();
    } catch (error) {
      primaryError = error;
    } finally {
      try {
        this.lock.release();
      } catch (cleanupError) {
        if (primaryError) {
          throw new AggregateError(
            [primaryError, cleanupError],
            "current flow state update and lock release both failed",
            { cause: primaryError },
          );
        }
        throw cleanupError;
      }
    }
    if (primaryError) throw primaryError;
    return result;
  }
}

export class CurrentFlowStateConversionPlan {
  constructor({ definition, sourceFormat, targetDirectory }) {
    if (!(definition instanceof CurrentFlowDefinition)) {
      throw new CurrentFlowStateInvariantError("conversion plan requires a fixed CurrentFlowDefinition");
    }
    this.definition = definition;
    this.sourceFormat = requireString(sourceFormat, "conversion plan sourceFormat");
    this.targetDirectory = path.resolve(requireString(targetDirectory, "conversion plan targetDirectory"));
    this.targetSchemaRevision = CURRENT_FLOW_SCHEMA_REVISION;
    this.legacyRead = "deferred";
    this.runtimeSwitch = "deferred";
    this.doubleWrite = "forbidden";
    Object.freeze(this);
  }

  get freshStateOnly() { return true; }
  get conversionImplemented() { return false; }

  assertCurrentStateOnly(value) {
    if (!(value instanceof CurrentFlowState)) {
      throw new CurrentFlowStateInvariantError("conversion is deferred; only a freshly constructed CurrentFlowState may enter this boundary");
    }
    const bound = this.definition.bindState(value);
    const fresh = CurrentFlowState.create({
      definition: this.definition,
      execution: bound.execution.toJSON(),
      version: bound.version,
    });
    if (!jsonEqual(bound.toJSON(), fresh.toJSON())) {
      throw new CurrentFlowStateInvariantError("freshStateOnly rejects progressed current state");
    }
    return bound;
  }

  toJSON() {
    return {
      sourceFormat: this.sourceFormat,
      targetDirectory: this.targetDirectory,
      targetSchemaRevision: this.targetSchemaRevision,
      freshStateOnly: this.freshStateOnly,
      conversionImplemented: this.conversionImplemented,
      legacyRead: this.legacyRead,
      runtimeSwitch: this.runtimeSwitch,
      doubleWrite: this.doubleWrite,
    };
  }
}

export class CurrentFlowStateAdoptionBoundary {
  constructor({ definition }) {
    if (!(definition instanceof CurrentFlowDefinition)) {
      throw new CurrentFlowStateInvariantError("adoption boundary requires a fixed CurrentFlowDefinition");
    }
    this.definition = definition;
    Object.freeze(this);
  }

  createFresh({ execution = { mode: "direct" }, version = CURRENT_FLOW_RESULT_VERSION } = {}) {
    return CurrentFlowState.create({ definition: this.definition, execution, version });
  }

  openStore({ directory, faultInjector, processIdentitySource } = {}) {
    return new CurrentFlowStateStore({
      directory,
      definition: this.definition,
      ...(faultInjector && { faultInjector }),
      ...(processIdentitySource && { processIdentitySource }),
    });
  }

  conversionPlan({ sourceFormat, targetDirectory }) {
    return new CurrentFlowStateConversionPlan({
      definition: this.definition,
      sourceFormat,
      targetDirectory,
    });
  }
}
