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
const NODE_STATUSES = new Set(["pending", "in_progress", "done", "skipped", "invalidated"]);
const EXECUTION_MODES = new Set(["direct", "branch", "worktree"]);
const RESULT_OUTCOMES = new Set(["passed", "failed", "skipped", "incomplete"]);
const RETRY_KINDS = new Set(["semantic", "tooling"]);
const ATTEMPT_TYPES = new Set([
  "task_added",
  "attempt_started",
  "attempt_retried",
  "attempt_updated",
  "attempt_failed",
  "result_confirmed",
  "recovery",
]);
const TERMINAL_NODE_STATUSES = new Set(["done", "skipped"]);
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

function reconcileInvalidatedParents(node, definition) {
  if (node.steps.length === 0) return node;
  const steps = node.steps.map((step) => reconcileInvalidatedParents(step, definition));
  const hasInvalidatedChild = steps.some((step) => step.status === "invalidated");
  if (hasInvalidatedChild) {
    if (node.status !== "invalidated" && !definition.contractForNode(node).permits(node.status, "invalidated")) {
      throw new CurrentFlowStateInvariantError(`definition forbids transition ${node.status}:invalidated for ${node.id}`);
    }
    return node.with({ status: "invalidated", result: null, steps });
  }
  return node.withSteps(steps);
}

function reconcileCompletedParents(node, definition) {
  if (node.steps.length === 0) return node;
  const steps = node.steps.map((step) => reconcileCompletedParents(step, definition));
  if (
    definition.contractForNode(node).completion === "all_children_terminal"
    && steps.every((step) => step.status === "done" || step.status === "skipped")
  ) {
    const result = [...steps].reverse().find((step) => step.result != null)?.result ?? null;
    if (node.status !== "done" && !definition.contractForNode(node).permits(node.status, "done")) {
      throw new CurrentFlowStateInvariantError(`definition forbids transition ${node.status}:done for ${node.id}`);
    }
    return node.with({ status: "done", result, steps });
  }
  if (steps.some((step) => step.status === "in_progress")) {
    return node.with({ status: "in_progress", steps });
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
    if (failurePolicy !== null) requireString(failurePolicy, "definition.action.failurePolicy");
    this.failurePolicy = failurePolicy;
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
      failurePolicy: this.failurePolicy,
      executionCommand: this.executionCommand,
      artifactAuthority: this.artifactAuthority.toJSON(),
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
    if (this.steps.length > 0 && this.action !== null) {
      throw new CurrentFlowStateInvariantError(`definition branch must not carry action metadata: ${this.id}`);
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
    const dynamicContainer = collectDefinitionNodes(this.root).find((node) => node.id === this.dynamicTaskContainerId);
    if (!dynamicContainer) {
      throw new CurrentFlowStateInvariantError("definition.dynamicTaskContainerId must identify a static node");
    }
    if (!dynamicContainer.steps.some((node) => node.id === this.dynamicTaskInsertionAfterId)) {
      throw new CurrentFlowStateInvariantError("definition.dynamicTaskInsertionAfterId must identify a direct dynamic-container child");
    }
    Object.freeze(this);
  }

  materializeRoot() {
    return this.root.materialize();
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
      steps: this.taskTemplate.steps.map((step) => new StepNode({
        // A task-step semantic key is repeatable; its stable identity is not.
        // This makes paths unambiguous even when an arbitrary number of Tasks
        // are materialized from the same template.
        kind: "step",
        id: `${taskId}/${step.id}`,
        key: step.key,
        status: "pending",
        result: null,
        attemptSequence: 0,
        steps: [],
      })),
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
    const template = this.taskTemplate.steps.find((step) => step.key === node.key);
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
        const expected = taskTemplate.steps[index];
        if (
          !(step instanceof StepNode)
          || step.id !== `${task.id}/${expected.id}`
          || step.key !== expected.key
        ) {
          throw new CurrentFlowStateInvariantError("Task.steps does not match task template");
        }
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

export class CurrentNextActionDescriptor {
  constructor({ path: currentPath, node, operation, action }) {
    if (!Array.isArray(currentPath) || currentPath.length === 0) {
      throw new CurrentFlowStateInvariantError("next action path must be a non-empty stable-id array");
    }
    if (!(node instanceof CurrentFlowNode)) {
      throw new CurrentFlowStateInvariantError("next action requires a current-state node");
    }
    if (!["start", "recover", "resume"].includes(operation)) {
      throw new CurrentFlowStateInvariantError("next action operation is invalid");
    }
    if (!(action instanceof DefinitionAction)) {
      throw new CurrentFlowStateInvariantError("next action requires definition-owned action metadata");
    }
    this.path = Object.freeze([...currentPath]);
    this.nodeId = node.id;
    this.nodeKey = node.key;
    this.status = node.status;
    this.operation = operation;
    this.action = action;
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
    if (kind !== this.attempt.failure.retryKind) {
      throw new CurrentFlowStateInvariantError("retry kind must match the active Attempt failure decision");
    }
    this.#assertAttemptForLeaf(leaf, next, { previous: this.attempt, kind });
    const root = replaceNode(this.root, leaf.id, leaf.with({ attemptSequence: next.sequence }));
    return this.#replaceRoot(root, this.current, next);
  }

  failCurrentAttempt({ failure }) {
    if (this.current == null || this.attempt == null) {
      throw new CurrentFlowStateInvariantError("failCurrentAttempt requires an active Attempt");
    }
    if (this.attempt.failure !== null) {
      throw new CurrentFlowStateInvariantError("active Attempt failure is already recorded");
    }
    const recorded = failure instanceof ActivityFailure ? failure : new ActivityFailure(failure);
    if (recorded.retryable) {
      const leaf = nodeAtPath(this.root, this.current);
      const contract = this.definition.contractFor(leaf.id, this.root);
      const remaining = recorded.retryKind === "semantic"
        ? contract.semanticRetryLimit - this.attempt.consumption.semantic
        : (contract.toolingRetryLimit ?? 0) - this.attempt.consumption.tooling;
      if (remaining <= 0) {
        throw new CurrentFlowStateInvariantError("retryable failure exceeds the definition retry budget");
      }
    }
    const leaf = nodeAtPath(this.root, this.current);
    const replacement = this.attempt.replaceFacts({ failure: recorded });
    this.#assertAttemptContractForLeaf(leaf, replacement);
    return this.#replaceRoot(this.root, this.current, replacement);
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
    if (!this.definition.contractFor(leafId, this.root).permits(leaf.status, status)) {
      throw new CurrentFlowStateInvariantError(`definition forbids transition ${leaf.status}:${status} for ${leafId}`);
    }
    const root = reconcileCompletedParents(
      replaceNode(this.root, leafId, leaf.with({ status, result: confirmed })),
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
      root = replaceNode(root, id, node.with({ status: "invalidated", result: null }));
    }
    root = reconcileInvalidatedParents(root, this.definition);
    const state = this.#replaceRoot(root, null, null);
    return state.#activateAttempt({
      path: currentPath,
      attempt,
      allowedLeafStatuses: ["done", "skipped", "invalidated"],
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
      const node = nodeAtPath(this.root, this.current);
      return new CurrentNextActionDescriptor({
        path: this.current,
        node,
        operation: "resume",
        action: this.definition.actionFor(node.id, this.root),
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
    return new CurrentRetryEligibility({
      path: this.current,
      attempt: this.attempt,
      semanticRemaining: failure?.retryable === true && failure.retryKind === "semantic"
        ? contract.semanticRetryLimit - this.attempt.consumption.semantic
        : 0,
      toolingRemaining: failure?.retryable === true && failure.retryKind === "tooling"
        ? (contract.toolingRetryLimit ?? 0) - this.attempt.consumption.tooling
        : 0,
    });
  }

  recoveryTarget(currentPath) {
    if (this.current !== null) {
      const active = nodeAtPath(this.root, this.current);
      return new CurrentRecoveryTarget({
        path: this.current,
        node: active,
        operation: "unavailable",
        legal: false,
        reason: "an active Attempt must be confirmed before rewind",
      });
    }
    const target = nodeAtPath(this.root, currentPath);
    const contract = this.definition.contractFor(target.id, this.root);
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
      .filter((leaf) => TERMINAL_NODE_STATUSES.has(leaf.status) && leaf.result !== null)
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
        if (!this.definition.contractFor(node.id, root).permits(node.status, "in_progress")) {
          throw new CurrentFlowStateInvariantError(`definition forbids transition ${node.status}:in_progress for ${node.id}`);
        }
        root = replaceNode(root, id, node.with({
          status: "in_progress",
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
    requireExactFields(value, new Set(["id", "label"]), "activity reference");
    const { id, label } = value;
    this.id = requireString(id, "activity reference.id");
    if (label !== null) requireString(label, "activity reference.label");
    this.label = label;
    Object.freeze(this);
  }

  toJSON() { return { id: this.id, label: this.label }; }
}

export class ActivityReferences {
  constructor(value) {
    requireExactFields(value, new Set(["evaluations", "findings", "repairs", "artifacts"]), "activity.references");
    const { evaluations, findings, repairs, artifacts } = value;
    for (const [field, values] of Object.entries({ evaluations, findings, repairs, artifacts })) {
      if (!Array.isArray(values)) throw new CurrentFlowStateInvariantError(`activity.references.${field} must be an array`);
      this[field] = Object.freeze(values.map((value) => value instanceof ActivityReference ? value : new ActivityReference(value)));
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
    if (!["add_task", "start_attempt", "retry_attempt", "update_attempt", "fail_attempt", "confirm_attempt", "rewind", "recover_attempt"].includes(operation)) {
      throw new CurrentFlowStateInvariantError(`activity.transition.operation is invalid: ${operation}`);
    }
    if (!Array.isArray(currentPath) || currentPath.length === 0) {
      throw new CurrentFlowStateInvariantError("activity.transition.path must be a non-empty stable-id array");
    }
    this.operation = operation;
    this.path = Object.freeze(currentPath.map((id) => requireString(id, "activity.transition.path id")));
    this.task = task == null ? null : task instanceof ActivityTask ? task : new ActivityTask(task);
    this.attempt = attempt == null ? null : attempt instanceof CurrentAttempt ? attempt : new CurrentAttempt(attempt);
    if (operation === "add_task") {
      if (this.task == null || this.attempt !== null || status !== null) {
        throw new CurrentFlowStateInvariantError("add_task transition requires only a Task payload");
      }
    } else if (this.task !== null) {
      throw new CurrentFlowStateInvariantError("only add_task transition may carry a Task payload");
    }
    if (["start_attempt", "retry_attempt", "update_attempt", "rewind", "recover_attempt"].includes(operation) && this.attempt == null) {
      throw new CurrentFlowStateInvariantError(`activity.transition ${operation} requires an Attempt`);
    }
    if (operation === "confirm_attempt" && this.attempt !== null) {
      throw new CurrentFlowStateInvariantError("confirm_attempt transition derives its Attempt from current state");
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
      return state.failCurrentAttempt({ failure: activity.failure });
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
      confirm_attempt: "result_confirmed",
      rewind: "recovery",
      recover_attempt: "recovery",
    };
    if (typeForOperation[this.transition.operation] !== this.type) {
      throw new CurrentFlowStateInvariantError("activity.type must match its deterministic transition operation");
    }
    this.result = result == null ? null : result instanceof NodeResult ? result : new NodeResult(result);
    if (["confirm_attempt", "fail_attempt"].includes(this.transition.operation) && this.result == null) {
      throw new CurrentFlowStateInvariantError("completed Attempt Activity requires a result");
    }
    if (!["confirm_attempt", "fail_attempt"].includes(this.transition.operation) && this.result !== null) {
      throw new CurrentFlowStateInvariantError("only completed Attempt Activity may carry a result");
    }
    if (this.transition.operation === "fail_attempt" && !["failed", "incomplete"].includes(this.result.outcome)) {
      throw new CurrentFlowStateInvariantError("fail_attempt Activity result must be failed or incomplete");
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
  const registerIdentity = (attemptId, sequence, nodeId) => {
    const previous = identities.get(attemptId);
    if (previous && (previous.sequence !== sequence || previous.nodeId !== nodeId)) {
      throw new CurrentFlowStateInvariantError(`Attempt id ${attemptId} is reused for a different node or sequence`);
    }
    identities.set(attemptId, { sequence, nodeId });
  };
  const introductions = new Set(["start_attempt", "retry_attempt", "rewind", "recover_attempt"]);
  for (const entry of entries) {
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
  }
}

export class FlowActivityJournal {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    Object.freeze(this);
  }

  read() {
    if (!fs.existsSync(this.filePath)) return [];
    const content = fs.readFileSync(this.filePath, "utf8");
    if (content === "") return [];
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
    return entries;
  }

  append(activity, writerAuthority) {
    if (writerAuthority !== JOURNAL_WRITER_AUTHORITY) {
      throw new CurrentFlowStateInvariantError("activities.jsonl may be appended only by CurrentFlowStateStore");
    }
    const entries = this.read();
    const next = activity instanceof FlowActivity ? activity : new FlowActivity(activity);
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
    const created = !fs.existsSync(this.filePath);
    const descriptor = fs.openSync(this.filePath, "a", 0o644);
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(next.toJSON())}\n`, "utf8");
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    if (created) fsyncDirectory(path.dirname(this.filePath));
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
    const next = state instanceof CurrentFlowState ? state : new CurrentFlowState(state, { definition: this.definition });
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
    if (!fs.existsSync(this.statePath)) return null;
    const state = this.#parse(fs.readFileSync(this.statePath));
    this.#assertJournalPosition(state, this.journal.read());
    return state;
  }

  writeActivitiesView(viewPath = path.join(this.directory, "activities.md")) {
    const resolvedViewPath = path.resolve(requireString(viewPath, "store activity viewPath"));
    if (resolvedViewPath === this.statePath || resolvedViewPath === this.journal.filePath) {
      throw new CurrentFlowStateInvariantError("activity markdown view must not replace flow.json or activities.jsonl");
    }
    return this.#withLock(() => this.journal.writeMarkdown(resolvedViewPath));
  }

  apply({ activity, expectedRevision = null }) {
    const proposed = activity instanceof FlowActivity ? activity : new FlowActivity(activity);
    return this.#withLock(() => {
      const originalBytes = fs.readFileSync(this.statePath);
      const original = this.#parse(originalBytes);
      if (expectedRevision !== null && expectedRevision !== digest(originalBytes)) {
        throw new CurrentFlowStateConflictError("flow state changed before update");
      }
      const entries = this.journal.read();
      this.#assertJournalPosition(original, entries);
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
      const activityNode = original.findNode(proposed.nodeId);
      if (!activityNode || activityNode.key !== proposed.nodeKey) {
        throw new CurrentFlowStateInvariantError("Activity must reference a current-state node by stable id and semantic key");
      }
      // The update is carried by the Activity itself.  This is important for
      // journal-first crash recovery: a replay cannot silently substitute a
      // different callback for a persisted Activity id/order.
      const transitioned = proposed.transition.apply(original, proposed);
      this.journal.append(proposed, JOURNAL_WRITER_AUTHORITY);
      this.faultInjector({ phase: "activity-appended", activity: proposed, state: original });
      const next = transitioned.withConfirmationOrder(proposed.confirmationOrder);
      this.#write(next, originalBytes);
      this.faultInjector({ phase: "state-written", activity: proposed, state: next });
      return next;
    });
  }

  #parse(bytes) {
    try { return new CurrentFlowState(JSON.parse(bytes.toString("utf8")), { definition: this.definition }); } catch (error) {
      if (error instanceof CurrentFlowStateInvariantError) throw error;
      throw new CurrentFlowStateInvariantError(`invalid flow.json: ${error.message}`);
    }
  }

  #assertJournalPosition(state, entries) {
    const journalOrder = entries.at(-1)?.confirmationOrder ?? 0;
    if (journalOrder < state.confirmationOrder) {
      throw new CurrentFlowStateConflictError("flow state confirmation order is ahead of its Activity journal");
    }
    if (journalOrder > state.confirmationOrder + 1) {
      throw new CurrentFlowStateConflictError("Activity journal is more than one transition ahead of flow state");
    }
  }

  #write(state, expectedBytes) {
    const content = Buffer.from(`${JSON.stringify(state.toJSON(), null, 2)}\n`);
    const file = new AtomicFile(this.statePath, {
      phaseNamespace: "current-flow-state",
      faultInjector: this.faultInjector,
      commitGuard: () => {
        if (expectedBytes === null) {
          if (fs.existsSync(this.statePath)) throw new CurrentFlowStateConflictError("current flow state already exists");
          return;
        }
        const visible = fs.readFileSync(this.statePath);
        if (!visible.equals(expectedBytes)) throw new CurrentFlowStateConflictError("flow state changed during update");
      },
    });
    file.write(content);
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
    const fresh = CurrentFlowState.create({
      definition: this.definition,
      execution: value.execution.toJSON(),
      version: value.version,
    });
    if (!jsonEqual(value.toJSON(), fresh.toJSON())) {
      throw new CurrentFlowStateInvariantError("freshStateOnly rejects progressed current state");
    }
    return value;
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
