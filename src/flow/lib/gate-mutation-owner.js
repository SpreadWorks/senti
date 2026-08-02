import { resolveScopedGateStepId } from "./gate-step.js";
import { createLifecycleStepTransition } from "./lifecycle-step-transition.js";
import { flattenSteps } from "./step-tree.js";

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function transitionStepMap(flowState, taskId) {
  const steps = new Map(flattenSteps(flowState.steps || []).map((step) => [step.id, step]));
  if (taskId == null) return steps;
  const task = (flowState.tasks || []).find((candidate) => candidate.id === taskId);
  if (!task) throw new Error(`selected gate owner task is missing: ${taskId}`);
  for (const step of flattenSteps(task.steps || [])) steps.set(step.id, step);
  return steps;
}

/**
 * Owns the persisted step identity and task route for one gate invocation.
 * Artifact/source identities remain phase-level contracts and intentionally
 * do not use this owner.
 */
export class GateMutationOwner {
  constructor({ flowState, phase }) {
    this.flowState = requireObject(flowState, "flowState");
    this.phase = requireString(phase, "phase");
    this.stepId = resolveScopedGateStepId(this.flowState, this.phase);
    this.specId = this.flowState.specId || null;
    const currentTask = this.flowState.currentTaskId == null
      ? null
      : this.flowState.tasks?.find((task) => task.id === this.flowState.currentTaskId) || null;
    this.taskId = currentTask?.steps?.some((step) => step.id === this.stepId)
      ? currentTask.id
      : null;
    Object.freeze(this);
  }

  routeOptions(extras = {}) {
    return {
      ...extras,
      ...(this.specId && { specId: this.specId }),
      taskId: this.taskId,
    };
  }

  captureTransitionStatuses({ flowState = this.flowState, staleStepIds = [] } = {}) {
    const state = requireObject(flowState, "flowState");
    if (!Array.isArray(staleStepIds)) {
      throw new Error("staleStepIds must be an array");
    }
    if (staleStepIds.includes(this.stepId)) {
      throw new Error("selected gate owner must not be included in stale step ids");
    }
    const steps = transitionStepMap(state, this.taskId);
    for (const stepId of staleStepIds) {
      if (steps.get(stepId)?.status !== "in_progress") {
        throw new Error(`stale step must be in_progress: ${stepId}`);
      }
    }
    if (steps.get(this.stepId)?.status !== "in_progress") {
      throw new Error(`selected gate owner must be in_progress: ${this.stepId}`);
    }
    return new Map(
      [...staleStepIds, this.stepId].map((stepId) => [stepId, steps.get(stepId).status]),
    );
  }

  assertTransitionStatuses({ flowState, expectedStatuses } = {}) {
    const state = requireObject(flowState, "flowState");
    if (!(expectedStatuses instanceof Map)) {
      throw new Error("expectedStatuses must be a Map");
    }
    const steps = transitionStepMap(state, this.taskId);
    for (const [stepId, expectedStatus] of expectedStatuses) {
      if (steps.get(stepId)?.status !== expectedStatus) {
        throw new Error(`pre-transition step state changed before commit: ${stepId}`);
      }
    }
  }

  createTransition({ status, event, currentStepId = null }) {
    return createLifecycleStepTransition({
      flowState: this.flowState,
      stepId: this.stepId,
      status,
      event,
      taskId: this.taskId,
      currentStepId,
    });
  }

  updateStepStatus(flowManager, { status, event, currentStepId = null }) {
    if (typeof flowManager?.updateStepStatus !== "function") {
      throw new Error("flowManager.updateStepStatus is required");
    }
    const transition = this.createTransition({ status, event, currentStepId });
    if (transition) flowManager.updateStepStatus(transition, this.routeOptions());
    return transition;
  }

}
