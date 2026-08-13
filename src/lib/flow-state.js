import { buildInitialNestedSteps } from "../flow/definition.js";
import { FlowOutbox } from "../flow/lib/flow-outbox.js";
import { FlowStateRevision } from "./flow-state-atomic-writer.js";
import { FlowSpecId } from "./flow-spec-id.js";
import { isLocatedFlowState } from "./flow-workspace.js";
import {
  DraftArtifactPromotion,
  DraftArtifactRevision,
} from "../flow/lib/draft-artifact-promotion.js";
import { DraftReviewRevisionBinding } from "../flow/lib/draft-review-revision.js";
import { WorkerArtifactRevision } from "../flow/lib/worker-artifact-revision.js";
import {
  validateWorkerArtifactPublicationState,
  validateWorkerArtifactReceiptsState,
} from "../flow/lib/worker-artifact-handoff.js";
import { PlanGateRepairRecord } from "../flow/lib/plan-gate-repair.js";
import {
  TestReviewRepairCompletion,
  TestReviewRepairRecord,
} from "../flow/lib/test-review-repair.js";

const STEP_STATUSES = new Set(["pending", "in_progress", "done", "skipped"]);

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || isLocatedFlowState(value));
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
    if (value.lifecycle === "preparing") {
      invariant(value.specId === null, "preparing flow state specId must be null");
    } else {
      try {
        FlowSpecId.from(value.specId);
      } catch {
        throw new FlowStateInvariantError("flow state specId must identify a spec");
      }
    }
    invariant(!Object.hasOwn(value, "spec"), "flow state must not contain the removed spec field");
    invariant(!Object.hasOwn(value, "specPath"), "flow state must not persist a derived specPath");
    invariant(!Object.hasOwn(value, "specRoot"), "flow state must not persist the configured spec root");
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
    new FlowOutbox(value.outbox || []);
    if (value.draftArtifactRevision != null) {
      // A finalized revision is historical state. Commands that use it as an
      // authority assert its Flow binding at the promotion/review boundary.
      DraftArtifactRevision.from(value.draftArtifactRevision);
    }
    if (value.draftArtifactPromotion != null) {
      DraftArtifactPromotion.from(value.draftArtifactPromotion).assertFlow(value);
    }
    if (value.draftReviewRevisions != null) {
      invariant(isPlainObject(value.draftReviewRevisions), "draftReviewRevisions must be an object");
      for (const [phase, stored] of Object.entries(value.draftReviewRevisions)) {
        const binding = DraftReviewRevisionBinding.from(stored);
        invariant(binding.phase === phase, `draftReviewRevisions.${phase} phase does not match its key`);
        binding.revision.assertFlow(value);
      }
    }
    if (value.specArtifactRevision != null) {
      WorkerArtifactRevision.from(value.specArtifactRevision).assertFlow(value);
    }
    if (value.specTestArtifactRevision != null) {
      WorkerArtifactRevision.from(value.specTestArtifactRevision).assertFlow(value);
    }
    if (value.workerArtifactPublication != null) {
      validateWorkerArtifactPublicationState(value.workerArtifactPublication, value);
    }
    if (value.workerArtifactReceipts != null) {
      validateWorkerArtifactReceiptsState(value.workerArtifactReceipts, value);
    }
    if (value.planGateRepair != null) {
      PlanGateRepairRecord.from(value.planGateRepair).assertFlow(value);
    }
    if (value.testReviewRepair != null) {
      TestReviewRepairRecord.from(value.testReviewRepair).assertActiveState(value);
    }
    if (value.testReviewRepairHistory != null) {
      invariant(
        Array.isArray(value.testReviewRepairHistory) && value.testReviewRepairHistory.length <= 64,
        "testReviewRepairHistory must be an array with at most 64 entries",
      );
      for (const stored of value.testReviewRepairHistory) {
        TestReviewRepairCompletion.from(stored).repair.assertFlow(value);
      }
    }
    if (revision) {
      const identity = revision.identity;
      const hasIssue = Object.hasOwn(value, "issue") && value.issue != null;
      invariant(revision.matchesState(value), "flow state revision does not match state content");
      invariant(identity.runId === value.runId, "flow state revision runId does not match state");
      invariant(identity.specId === value.specId, "flow state revision specId does not match state");
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
