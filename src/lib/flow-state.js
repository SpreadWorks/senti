import { buildInitialNestedSteps } from "../flow/definition.js";
import { FlowOutbox } from "../flow/lib/flow-outbox.js";
import { FlowStateRevision } from "./flow-state-atomic-writer.js";
import { RecoveryFailureLedger } from "../flow/lib/recovery-contract.js";
import { RecoveryDecisionLedger } from "../flow/lib/recovery-decision.js";
import { UserResolutionLedger } from "../flow/lib/recovery-composition.js";

const STEP_STATUSES = new Set(["pending", "in_progress", "done", "skipped"]);

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function invariant(condition, message) {
  if (!condition) throw new FlowStateInvariantError(message);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function validateStepList(actual, expected, label, ids, activeLeaves) {
  invariant(Array.isArray(actual), `${label} must be an array`);
  invariant(actual.length === expected.length, `${label} does not match the flow definition`);
  for (let index = 0; index < expected.length; index += 1) {
    const step = actual[index];
    const definition = expected[index];
    const stepLabel = `${label}[${index}]`;
    invariant(isPlainObject(step), `${stepLabel} must be an object`);
    invariant(step.id === definition.id, `${stepLabel} does not match the flow definition`);
    invariant(!ids.has(step.id), `${stepLabel} duplicates step '${step.id}'`);
    ids.add(step.id);
    invariant(STEP_STATUSES.has(step.status), `${stepLabel}.status is invalid`);
    const expectedChildren = definition.children ?? [];
    const actualChildren = step.children ?? [];
    if (expectedChildren.length > 0) {
      validateStepList(actualChildren, expectedChildren, `${stepLabel}.children`, ids, activeLeaves);
    } else {
      invariant(actualChildren.length === 0, `${stepLabel} does not match the flow definition`);
      if (step.status === "in_progress") activeLeaves.push(step.id);
    }
  }
}

export class FlowStateInvariantError extends Error {
  constructor(message) {
    super(message);
    this.name = "FlowStateInvariantError";
    this.code = "FLOW_STATE_INVARIANT_INVALID";
  }
}

export class FlowStepLedger {
  constructor(steps) {
    const value = structuredClone(steps);
    const activeLeaves = [];
    validateStepList(value, buildInitialNestedSteps(), "steps", new Set(), activeLeaves);
    invariant(
      activeLeaves.length <= 1,
      `multiple active flow leaves are not allowed: ${activeLeaves.join(", ")}`,
    );
    this.value = deepFreeze(value);
    this.activeLeafId = activeLeaves[0] ?? null;
    Object.freeze(this);
  }

  toJSON() {
    return structuredClone(this.value);
  }
}

export class FlowState {
  constructor(value, { revision = null } = {}) {
    invariant(isPlainObject(value), "flow state must be an object");
    invariant(typeof value.runId === "string" && value.runId.trim() !== "", "flow state runId is required");
    invariant(
      (typeof value.spec === "string" && value.spec.trim() !== "")
        || (value.lifecycle === "preparing" && value.spec === null),
      "flow state spec must identify a spec or an unprepared flow",
    );
    invariant(Array.isArray(value.tasks), "flow state tasks must be an array");
    invariant(Object.hasOwn(value, "currentTaskId"), "flow state currentTaskId is required");
    invariant(
      value.currentTaskId === null || (typeof value.currentTaskId === "string" && value.currentTaskId !== ""),
      "flow state currentTaskId must be a non-empty string or null",
    );
    const taskIds = new Set();
    const activeTaskSteps = [];
    for (const [index, task] of value.tasks.entries()) {
      invariant(isPlainObject(task), `tasks[${index}] must be an object`);
      invariant(typeof task.id === "string" && task.id !== "", `tasks[${index}].id is required`);
      invariant(!taskIds.has(task.id), `tasks[${index}].id duplicates '${task.id}'`);
      taskIds.add(task.id);
      invariant(Array.isArray(task.steps), `tasks[${index}].steps must be an array`);
      const stepIds = new Set();
      for (const [stepIndex, step] of task.steps.entries()) {
        const label = `tasks[${index}].steps[${stepIndex}]`;
        invariant(isPlainObject(step), `${label} must be an object`);
        invariant(typeof step.id === "string" && step.id !== "", `${label}.id is required`);
        invariant(!stepIds.has(step.id), `${label}.id duplicates '${step.id}'`);
        stepIds.add(step.id);
        invariant(STEP_STATUSES.has(step.status), `${label}.status is invalid`);
        if (step.status === "in_progress") activeTaskSteps.push({ taskId: task.id, stepId: step.id });
      }
    }
    invariant(
      value.currentTaskId === null || taskIds.has(value.currentTaskId),
      "flow state currentTaskId must reference an existing task",
    );
    invariant(
      activeTaskSteps.length <= 1,
      `multiple active task steps are not allowed: ${activeTaskSteps.map((entry) => `${entry.taskId}/${entry.stepId}`).join(", ")}`,
    );
    invariant(
      activeTaskSteps.length === 0 || activeTaskSteps[0].taskId === value.currentTaskId,
      "active task step must belong to currentTaskId",
    );
    invariant(
      revision === null || revision instanceof FlowStateRevision,
      "flow state revision must be a FlowStateRevision or null",
    );
    const outbox = new FlowOutbox(value.outbox || []);
    const recoveryFailures = new RecoveryFailureLedger(value.recoveryFailureRecords || []);
    const recoveryDecisions = new RecoveryDecisionLedger({
      failureLedger: recoveryFailures,
      decisions: value.recoveryDecisions || [],
    });
    new UserResolutionLedger({
      failureLedger: recoveryFailures,
      resolutions: value.recoveryUserResolutions || [],
    });
    recoveryDecisions.assertConsistent({
      failureLedger: recoveryFailures,
      outboxIdempotencyKeys: new Set(outbox.entries.map((entry) => entry.idempotencyKey)),
    });
    if (revision) {
      const identity = revision.identity;
      const hasIssue = Object.hasOwn(value, "issue") && value.issue != null;
      invariant(revision.matchesState(value), "flow state revision does not match state content");
      invariant(identity.runId === value.runId, "flow state revision runId does not match state");
      invariant(identity.spec === value.spec, "flow state revision spec does not match state");
      invariant(identity.hasIssue === hasIssue, "flow state revision Issue presence does not match state");
      invariant(!hasIssue || identity.issue === Number(value.issue), "flow state revision Issue does not match state");
    }

    const stored = structuredClone(value);
    this.steps = new FlowStepLedger(stored.steps);
    this.revision = revision;
    this.value = deepFreeze(stored);
    Object.freeze(this);
  }

  toJSON() {
    return structuredClone(this.value);
  }
}
