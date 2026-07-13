/**
 * Closed schema and transaction-integrity boundary for spec-correction rewind
 * history. Historical entries retain their evidence; only the latest entry's
 * digest is compared with the current flow authority for exact retry proof.
 */

import { createHash } from "node:crypto";
import { FLOW_STEPS, PHASE_MAP } from "../../lib/flow-helpers.js";

const CATEGORY = "spec-correction";
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
const FLOW_STATUSES = new Set(["pending", "in_progress", "done", "skipped", "failed"]);
const TASK_STATUSES = new Set(["pending", "in_progress", "done", "skipped"]);
const TASK_REQUIREMENT_STATUSES = new Set(["pending", "done"]);
const AUDIT_KEYS = Object.freeze([
  "category",
  "invalidatedPhases",
  "invalidatedResults",
  "previousState",
  "reason",
  "resultingState",
  "stateDigest",
  "target",
  "timestamp",
]);
const PREVIOUS_STATE_KEYS = Object.freeze(["activeStep", "currentTaskId", "stepStatuses", "taskStatuses"]);
const RESULTING_STATE_KEYS = Object.freeze(["activeStep", "currentTaskId", "stepStatuses", "tasks"]);
const INVALIDATED_RESULT_KEYS = Object.freeze(["approvals", "flowSteps", "tasks"]);
const TARGET_KEYS = Object.freeze(["issue", "runId", "spec"]);
const FLOW_STEP_RESULT_REQUIRED_KEYS = Object.freeze(["id", "status"]);
const FLOW_STEP_RESULT_OPTIONAL_KEYS = Object.freeze(["finishedAt", "runtimeLog", "startedAt"]);
const TASK_RESULT_REQUIRED_KEYS = Object.freeze([
  "id",
  "origin",
  "parent",
  "requirements",
  "spec",
  "status",
  "steps",
  "summary",
]);
const TASK_RESULT_OPTIONAL_KEYS = Object.freeze([
  "added_round",
  "finishedAt",
  "goal",
  "runtimeLog",
  "startedAt",
  "title",
]);
const RESULTING_TASK_KEYS = Object.freeze([
  "id",
  "requirementStatuses",
  "status",
  "stepStatuses",
  "summary",
]);
const REQUIREMENT_STATE_KEYS = Object.freeze(["id", "index", "status"]);
const APPROVAL_KEYS = Object.freeze(["status", "stepId", "userApproval"]);
const USER_APPROVAL_REQUIRED_KEYS = Object.freeze(["approved", "confirmed_at"]);
const USER_APPROVAL_OPTIONAL_KEYS = Object.freeze(["notes"]);
const TASK_STEP_REQUIRED_KEYS = Object.freeze(["id", "status"]);
const TASK_STEP_OPTIONAL_KEYS = Object.freeze(["finishedAt", "runtimeLog", "startedAt"]);
const TASK_REQUIREMENT_REQUIRED_KEYS = Object.freeze(["desc", "status"]);
const TASK_REQUIREMENT_OPTIONAL_KEYS = Object.freeze(["id", "priority"]);
const RESET_STEP_IDS = Object.freeze(FLOW_STEPS.slice(FLOW_STEPS.indexOf("draft")));

export class PlanRewindAuditValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlanRewindAuditValidationError";
    this.code = "REOPEN_AUDIT_INVALID";
  }
}

function invalid(path, message) {
  throw new PlanRewindAuditValidationError(`${path}: ${message}`);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, path) {
  if (!isPlainObject(value)) invalid(path, "must be an object");
}

function assertExactKeys(value, required, optional, path) {
  assertPlainObject(value, path);
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) invalid(path, `missing required field '${key}'`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) invalid(path, `unknown field '${key}'`);
  }
}

function assertString(value, path, { nonempty = true } = {}) {
  if (typeof value !== "string" || (nonempty && value.length === 0)) {
    invalid(path, nonempty ? "must be a non-empty string" : "must be a string");
  }
}

function assertNullableString(value, path) {
  if (value !== null) assertString(value, path);
}

function assertStatus(value, allowed, path) {
  if (!allowed.has(value)) invalid(path, `invalid status '${value}'`);
}

function assertIsoTimestamp(value, path, { utc = true } = {}) {
  assertString(value, path);
  if (!ISO_8601_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    invalid(path, "must be an ISO 8601 timestamp");
  }
  if (utc && !value.endsWith("Z")) invalid(path, "must be an ISO 8601 UTC timestamp");
}

function assertExactStringSet(value, expected, path) {
  assertPlainObject(value, path);
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...expected].sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    invalid(path, `keys must be exactly: ${expectedKeys.join(", ")}`);
  }
}

function sameArray(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function assertRuntimeLog(value, path) {
  if (value != null && !isPlainObject(value)) invalid(path, "must be an object when present");
}

function assertExecutionMetadata(value, path) {
  if (Object.hasOwn(value, "startedAt")) assertIsoTimestamp(value.startedAt, `${path}.startedAt`);
  if (Object.hasOwn(value, "finishedAt")) assertIsoTimestamp(value.finishedAt, `${path}.finishedAt`);
  if (Object.hasOwn(value, "runtimeLog")) assertRuntimeLog(value.runtimeLog, `${path}.runtimeLog`);
}

function validateTarget(target, state, path) {
  assertExactKeys(target, TARGET_KEYS, [], path);
  assertString(target.runId, `${path}.runId`);
  assertString(target.spec, `${path}.spec`);
  if (target.issue !== null && (!Number.isSafeInteger(target.issue) || target.issue < 1)) {
    invalid(`${path}.issue`, "must be a positive integer or null");
  }
  const issue = state.issue == null ? null : Number(state.issue);
  if (target.runId !== state.runId || target.spec !== state.spec || target.issue !== issue) {
    invalid(path, "does not match the active flow identity");
  }
}

function validateStepStatusMap(stepStatuses, path) {
  assertExactStringSet(stepStatuses, RESET_STEP_IDS, path);
  for (const id of RESET_STEP_IDS) assertStatus(stepStatuses[id], FLOW_STATUSES, `${path}.${id}`);
}

function validateTaskStatusMap(taskStatuses, path) {
  assertPlainObject(taskStatuses, path);
  for (const [id, status] of Object.entries(taskStatuses)) {
    assertString(id, `${path} key`);
    assertStatus(status, TASK_STATUSES, `${path}.${id}`);
  }
}

function validatePreviousState(previousState, path) {
  assertExactKeys(previousState, PREVIOUS_STATE_KEYS, [], path);
  if (previousState.activeStep !== "implement") invalid(`${path}.activeStep`, "must be 'implement'");
  assertNullableString(previousState.currentTaskId, `${path}.currentTaskId`);
  validateStepStatusMap(previousState.stepStatuses, `${path}.stepStatuses`);
  if (previousState.stepStatuses.implement !== "in_progress") {
    invalid(`${path}.stepStatuses.implement`, "must be 'in_progress'");
  }
  for (const [id, status] of Object.entries(previousState.stepStatuses)) {
    if (id !== "implement" && status === "in_progress") {
      invalid(`${path}.stepStatuses.${id}`, "cannot be in_progress with activeStep implement");
    }
  }
  validateTaskStatusMap(previousState.taskStatuses, `${path}.taskStatuses`);
  if (
    previousState.currentTaskId !== null
    && !Object.hasOwn(previousState.taskStatuses, previousState.currentTaskId)
  ) {
    invalid(`${path}.currentTaskId`, "must reference previousState.taskStatuses");
  }
}

function validateFlowStepResults(flowSteps, previousState, path) {
  if (!Array.isArray(flowSteps)) invalid(path, "must be an array");
  const byId = new Map();
  for (const [index, step] of flowSteps.entries()) {
    const itemPath = `${path}[${index}]`;
    assertExactKeys(step, FLOW_STEP_RESULT_REQUIRED_KEYS, FLOW_STEP_RESULT_OPTIONAL_KEYS, itemPath);
    assertString(step.id, `${itemPath}.id`);
    if (!RESET_STEP_IDS.includes(step.id)) invalid(`${itemPath}.id`, "is outside the correction rewind range");
    if (byId.has(step.id)) invalid(`${itemPath}.id`, "is duplicated");
    assertStatus(step.status, FLOW_STATUSES, `${itemPath}.status`);
    if (step.status !== previousState.stepStatuses[step.id]) {
      invalid(`${itemPath}.status`, "does not match previousState.stepStatuses");
    }
    assertExecutionMetadata(step, itemPath);
    if (
      step.status === "pending"
      && !Object.hasOwn(step, "startedAt")
      && !Object.hasOwn(step, "finishedAt")
      && !Object.hasOwn(step, "runtimeLog")
    ) {
      invalid(itemPath, "pending step has no result evidence");
    }
    byId.set(step.id, step);
  }
  for (const id of RESET_STEP_IDS) {
    if (previousState.stepStatuses[id] !== "pending" && !byId.has(id)) {
      invalid(path, `missing invalidated result for non-pending flow step '${id}'`);
    }
  }
  return byId;
}

function validateTaskStep(step, path) {
  assertExactKeys(step, TASK_STEP_REQUIRED_KEYS, TASK_STEP_OPTIONAL_KEYS, path);
  assertString(step.id, `${path}.id`);
  assertStatus(step.status, TASK_STATUSES, `${path}.status`);
  assertExecutionMetadata(step, path);
}

function validateTaskRequirement(requirement, path) {
  assertExactKeys(requirement, TASK_REQUIREMENT_REQUIRED_KEYS, TASK_REQUIREMENT_OPTIONAL_KEYS, path);
  assertString(requirement.desc, `${path}.desc`, { nonempty: false });
  assertStatus(requirement.status, TASK_REQUIREMENT_STATUSES, `${path}.status`);
  if (Object.hasOwn(requirement, "id")) assertString(requirement.id, `${path}.id`);
  if (Object.hasOwn(requirement, "priority")) assertString(requirement.priority, `${path}.priority`);
}

function validateTaskResult(task, previousState, path) {
  assertExactKeys(task, TASK_RESULT_REQUIRED_KEYS, TASK_RESULT_OPTIONAL_KEYS, path);
  assertString(task.id, `${path}.id`);
  assertString(task.spec, `${path}.spec`);
  assertString(task.origin, `${path}.origin`);
  if (task.origin !== "plan" && task.origin !== "integration") {
    invalid(`${path}.origin`, "must be 'plan' or 'integration'");
  }
  assertNullableString(task.parent, `${path}.parent`);
  assertStatus(task.status, TASK_STATUSES, `${path}.status`);
  if (!Object.hasOwn(previousState.taskStatuses, task.id)) invalid(`${path}.id`, "is absent from previousState");
  if (task.status !== previousState.taskStatuses[task.id]) {
    invalid(`${path}.status`, "does not match previousState.taskStatuses");
  }
  if (!Array.isArray(task.steps)) invalid(`${path}.steps`, "must be an array");
  const stepIds = new Set();
  for (const [index, step] of task.steps.entries()) {
    validateTaskStep(step, `${path}.steps[${index}]`);
    if (stepIds.has(step.id)) invalid(`${path}.steps[${index}].id`, "is duplicated");
    stepIds.add(step.id);
  }
  if (!Array.isArray(task.requirements)) invalid(`${path}.requirements`, "must be an array");
  task.requirements.forEach((requirement, index) => (
    validateTaskRequirement(requirement, `${path}.requirements[${index}]`)
  ));
  if (task.summary !== null) assertString(task.summary, `${path}.summary`, { nonempty: false });
  if (Object.hasOwn(task, "added_round") && (!Number.isSafeInteger(task.added_round) || task.added_round < 0)) {
    invalid(`${path}.added_round`, "must be a non-negative integer");
  }
  for (const key of ["title", "goal"]) {
    if (Object.hasOwn(task, key)) assertString(task[key], `${path}.${key}`, { nonempty: false });
  }
  assertExecutionMetadata(task, path);
}

function validateTaskResults(tasks, previousState, path) {
  if (!Array.isArray(tasks)) invalid(path, "must be an array");
  const byId = new Map();
  for (const [index, task] of tasks.entries()) {
    validateTaskResult(task, previousState, `${path}[${index}]`);
    if (byId.has(task.id)) invalid(`${path}[${index}].id`, "is duplicated");
    byId.set(task.id, task);
  }
  for (const [id, status] of Object.entries(previousState.taskStatuses)) {
    if (status !== "pending" && !byId.has(id)) {
      invalid(path, `missing invalidated result for non-pending task '${id}'`);
    }
  }
  return byId;
}

function validateUserApproval(userApproval, path) {
  if (userApproval === null) return;
  assertExactKeys(userApproval, USER_APPROVAL_REQUIRED_KEYS, USER_APPROVAL_OPTIONAL_KEYS, path);
  if (userApproval.approved !== true) invalid(`${path}.approved`, "must be true");
  assertIsoTimestamp(userApproval.confirmed_at, `${path}.confirmed_at`, { utc: false });
  if (Object.hasOwn(userApproval, "notes")) assertString(userApproval.notes, `${path}.notes`, { nonempty: false });
}

function validateApprovals(approvals, previousState, flowStepResults, path) {
  if (!Array.isArray(approvals) || approvals.length !== 1) invalid(path, "must contain exactly one approval snapshot");
  const approval = approvals[0];
  assertExactKeys(approval, APPROVAL_KEYS, [], `${path}[0]`);
  if (approval.stepId !== "approval") invalid(`${path}[0].stepId`, "must be 'approval'");
  assertStatus(approval.status, FLOW_STATUSES, `${path}[0].status`);
  if (approval.status !== previousState.stepStatuses.approval) {
    invalid(`${path}[0].status`, "does not match previousState.stepStatuses.approval");
  }
  if (!flowStepResults.has("approval")) invalid(path, "approval flow result is missing");
  validateUserApproval(approval.userApproval, `${path}[0].userApproval`);
}

function validateInvalidatedResults(results, previousState, path) {
  assertExactKeys(results, INVALIDATED_RESULT_KEYS, [], path);
  const flowSteps = validateFlowStepResults(results.flowSteps, previousState, `${path}.flowSteps`);
  const tasks = validateTaskResults(results.tasks, previousState, `${path}.tasks`);
  validateApprovals(results.approvals, previousState, flowSteps, `${path}.approvals`);
  return tasks;
}

function validateRequirementState(requirement, index, path) {
  assertExactKeys(requirement, REQUIREMENT_STATE_KEYS, [], path);
  if (requirement.id !== null) assertString(requirement.id, `${path}.id`);
  if (requirement.index !== index) invalid(`${path}.index`, `must equal ${index}`);
  if (requirement.status !== "pending") invalid(`${path}.status`, "must be 'pending'");
}

function validateResultingTask(task, path) {
  assertExactKeys(task, RESULTING_TASK_KEYS, [], path);
  assertString(task.id, `${path}.id`);
  if (task.status !== "pending") invalid(`${path}.status`, "must be 'pending'");
  assertPlainObject(task.stepStatuses, `${path}.stepStatuses`);
  if (Object.keys(task.stepStatuses).length === 0) invalid(`${path}.stepStatuses`, "must not be empty");
  for (const [id, status] of Object.entries(task.stepStatuses)) {
    assertString(id, `${path}.stepStatuses key`);
    if (status !== "pending") invalid(`${path}.stepStatuses.${id}`, "must be 'pending'");
  }
  if (!Array.isArray(task.requirementStatuses)) invalid(`${path}.requirementStatuses`, "must be an array");
  task.requirementStatuses.forEach((requirement, index) => (
    validateRequirementState(requirement, index, `${path}.requirementStatuses[${index}]`)
  ));
  if (task.summary !== null) invalid(`${path}.summary`, "must be null");
}

function validateResultingState(resultingState, previousState, invalidatedTasks, path) {
  assertExactKeys(resultingState, RESULTING_STATE_KEYS, [], path);
  if (resultingState.activeStep !== "draft") invalid(`${path}.activeStep`, "must be 'draft'");
  if (resultingState.currentTaskId !== null) invalid(`${path}.currentTaskId`, "must be null");
  validateStepStatusMap(resultingState.stepStatuses, `${path}.stepStatuses`);
  for (const id of RESET_STEP_IDS) {
    const expected = id === "draft" ? "in_progress" : "pending";
    if (resultingState.stepStatuses[id] !== expected) {
      invalid(`${path}.stepStatuses.${id}`, `must be '${expected}'`);
    }
  }
  if (!Array.isArray(resultingState.tasks)) invalid(`${path}.tasks`, "must be an array");
  const taskIds = new Set();
  for (const [index, task] of resultingState.tasks.entries()) {
    validateResultingTask(task, `${path}.tasks[${index}]`);
    if (taskIds.has(task.id)) invalid(`${path}.tasks[${index}].id`, "is duplicated");
    taskIds.add(task.id);
    const invalidated = invalidatedTasks.get(task.id);
    if (invalidated) {
      const invalidatedStepIds = invalidated.steps.map((step) => step.id).sort();
      const resultingStepIds = Object.keys(task.stepStatuses).sort();
      if (!sameArray(resultingStepIds, invalidatedStepIds)) {
        invalid(`${path}.tasks[${index}].stepStatuses`, "does not match invalidated task steps");
      }
      if (task.requirementStatuses.length !== invalidated.requirements.length) {
        invalid(`${path}.tasks[${index}].requirementStatuses`, "does not match invalidated task requirements");
      }
    }
  }
  const previousTaskIds = Object.keys(previousState.taskStatuses).sort();
  const resultingTaskIds = [...taskIds].sort();
  if (!sameArray(resultingTaskIds, previousTaskIds)) {
    invalid(`${path}.tasks`, "task ids do not match previousState.taskStatuses");
  }
}

function validateInvalidatedPhases(phases, previousState, path) {
  if (!Array.isArray(phases) || phases.some((phase) => typeof phase !== "string")) {
    invalid(path, "must be a string array");
  }
  const expected = [...new Set(RESET_STEP_IDS
    .filter((id) => previousState.stepStatuses[id] !== "pending")
    .map((id) => PHASE_MAP[id])
    .filter(Boolean))];
  if (!sameArray(phases, expected)) invalid(path, `must equal derived phases: ${expected.join(", ")}`);
}

class PlanRewindAuditEntrySchema {
  constructor(value, state, index, { sealed = true } = {}) {
    const path = `planRewinds[${index}]`;
    assertExactKeys(value, sealed ? AUDIT_KEYS : AUDIT_KEYS.filter((key) => key !== "stateDigest"), [], path);
    if (value.category !== CATEGORY) invalid(`${path}.category`, `must be '${CATEGORY}'`);
    assertString(value.reason, `${path}.reason`);
    if (value.reason !== value.reason.trim() || value.reason.length > 500 || value.reason.includes("\0")) {
      invalid(`${path}.reason`, "must be trimmed, NUL-free, and at most 500 characters");
    }
    validateTarget(value.target, state, `${path}.target`);
    validatePreviousState(value.previousState, `${path}.previousState`);
    const invalidatedTasks = validateInvalidatedResults(
      value.invalidatedResults,
      value.previousState,
      `${path}.invalidatedResults`,
    );
    validateInvalidatedPhases(value.invalidatedPhases, value.previousState, `${path}.invalidatedPhases`);
    validateResultingState(
      value.resultingState,
      value.previousState,
      invalidatedTasks,
      `${path}.resultingState`,
    );
    assertIsoTimestamp(value.timestamp, `${path}.timestamp`);
    if (sealed && (typeof value.stateDigest !== "string" || !DIGEST_PATTERN.test(value.stateDigest))) {
      invalid(`${path}.stateDigest`, "must be a 64-character lowercase SHA-256 digest");
    }
    this.value = value;
    Object.freeze(this);
  }
}

function digestLatestTransaction(state) {
  const clone = structuredClone(state);
  const latest = clone.planRewinds.at(-1);
  delete latest.stateDigest;
  return createHash("sha256").update(JSON.stringify(clone)).digest("hex");
}

export class PlanRewindAuditHistory {
  constructor(state, { latestUnsealed = false } = {}) {
    if (!Object.hasOwn(state, "planRewinds")) {
      this.entries = Object.freeze([]);
      Object.freeze(this);
      return;
    }
    if (!Array.isArray(state.planRewinds)) invalid("planRewinds", "must be an array when present");
    const timestamps = new Set();
    const digests = new Set();
    this.entries = Object.freeze(state.planRewinds.map((entry, index) => {
      const sealed = !(latestUnsealed && index === state.planRewinds.length - 1);
      const validated = new PlanRewindAuditEntrySchema(entry, state, index, { sealed });
      if (timestamps.has(entry.timestamp)) invalid(`planRewinds[${index}].timestamp`, "duplicates an existing audit");
      timestamps.add(entry.timestamp);
      if (sealed) {
        if (digests.has(entry.stateDigest)) invalid(`planRewinds[${index}].stateDigest`, "duplicates an existing audit");
        digests.add(entry.stateDigest);
      }
      return validated;
    }));
    Object.freeze(this);
  }

  get latest() {
    return this.entries.at(-1)?.value ?? null;
  }

  exactRetry(state, { reason }) {
    const audit = this.latest;
    if (!audit) return null;
    if (
      audit.category !== CATEGORY
      || audit.reason !== reason
      || audit.target.runId !== state.runId
      || audit.target.spec !== state.spec
      || audit.target.issue !== (state.issue == null ? null : Number(state.issue))
    ) {
      return null;
    }
    const digest = digestLatestTransaction(state);
    if (digest !== audit.stateDigest) invalid("planRewinds latest stateDigest", "does not match current flow authority");
    return audit;
  }
}

export function sealLatestPlanRewind(state) {
  const history = new PlanRewindAuditHistory(state, { latestUnsealed: true });
  const latest = history.latest;
  if (!latest) invalid("planRewinds", "cannot seal an empty history");
  latest.stateDigest = digestLatestTransaction(state);
  new PlanRewindAuditHistory(state);
  return latest.stateDigest;
}
