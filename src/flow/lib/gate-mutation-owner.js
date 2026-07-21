import { resolveScopedGateStepId } from "./gate-step.js";
import { createLifecycleStepTransition } from "./lifecycle-step-transition.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";

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
    this.specId = this.flowState.spec ? specIdFromPath(this.flowState.spec) : null;
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
