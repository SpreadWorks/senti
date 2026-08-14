/**
 * Version-1 retry recovery.
 *
 * Retry authority is the active failed Attempt.  Retrying it is one typed
 * Activity transition; it never resets a mutable counter or writes a sibling
 * recovery document.
 */

import { RetryTargetRoute } from "./retry-target-route.js";
import { TaskNode } from "./current-flow-state.js";

export const RECOVERY_REASON_MIN_LENGTH = 20;
export const RECOVERY_REASON_MAX_LENGTH = 500;

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} is required`);
  }
  return value.trim();
}

function requiredPositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive safe integer`);
  }
  return value;
}

function canonicalState(state) {
  if (state?.schemaRevision !== 3) {
    throw new Error("retry recovery requires a Version-1 Flow");
  }
  return state;
}

function routeFor(request, state) {
  const nodeId = state.attempt?.nodeId ?? null;
  const currentTask = Array.isArray(state.current)
    ? state.current
      .slice(0, -1)
      .map((id) => state.findNode(id))
      .find((node) => node instanceof TaskNode) ?? null
    : null;
  const taskScoped = typeof nodeId === "string"
    && currentTask !== null
    && ((request.kind === "review" && request.phase === "impl" && nodeId === `${currentTask.id}-review`)
      || (request.kind === "gate" && request.phase === "task-impl" && nodeId === `${currentTask.id}-gate`));
  const route = RetryTargetRoute.forRecovery(request.kind, request.phase, {
    currentTaskId: taskScoped ? "active-task" : null,
  });
  if (route === null) {
    throw new Error(`retry recovery target is not defined: ${request.kind}/${request.phase}`);
  }
  return route;
}

function matchesRoute(route, nodeId) {
  if (route.stepId === nodeId) return true;
  if (typeof nodeId !== "string") return false;
  if (route.stepId === "task-review") return nodeId.endsWith("-review");
  return route.stepId === "task-gate" && nodeId.endsWith("-gate");
}

/** Exact command input accepted by the retired-named retry CLI. */
export class RetryRecoveryInput {
  constructor(input = {}) {
    this.action = requiredText(input.action, "retry action");
    if (this.action !== "reset") throw new Error("retry action must be reset");
    this.kind = requiredText(input.kind, "retry kind");
    if (!["gate", "review"].includes(this.kind)) throw new Error("retry kind must be gate or review");
    this.phase = requiredText(input.phase, "retry phase");
    this.reason = requiredText(input.reason, "retry reason");
    if (this.reason.length < RECOVERY_REASON_MIN_LENGTH || this.reason.length > RECOVERY_REASON_MAX_LENGTH) {
      throw new Error(`retry reason must be ${RECOVERY_REASON_MIN_LENGTH}-${RECOVERY_REASON_MAX_LENGTH} characters`);
    }
    if (input.yes !== true) throw new Error("retry reset requires --yes");
    Object.freeze(this);
  }
}

/** Durable result projected from the just-appended retry Activity. */
export class CanonicalRetryRecoveryGrant {
  constructor({ request, previousAttempt, nextAttempt, activity }) {
    if (!(request instanceof RetryRecoveryInput)) throw new Error("retry grant requires RetryRecoveryInput");
    if (previousAttempt?.id == null || nextAttempt?.id == null) throw new Error("retry grant requires Attempt identities");
    if (activity?.transition?.operation !== "retry_attempt") {
      throw new Error("retry grant requires a retry_attempt Activity");
    }
    this.kind = request.kind;
    this.phase = request.phase;
    this.previousAttemptId = previousAttempt.id;
    this.attemptId = nextAttempt.id;
    this.sequence = nextAttempt.sequence;
    this.operation = activity.transition.operation;
    this.activityId = activity.id;
    Object.freeze(this);
  }

  toJSON() {
    return {
      kind: this.kind,
      phase: this.phase,
      previousAttemptId: this.previousAttemptId,
      attemptId: this.attemptId,
      sequence: this.sequence,
      operation: this.operation,
      activityId: this.activityId,
    };
  }
}

/**
 * Deep Store operation for manual retry invocation.  The Version Store owns
 * both target validation and the Activity append; callers receive no mutable
 * state callback or filesystem authority.
 */
export class CanonicalRetryRecovery {
  constructor({ flowManager, state, request }) {
    if (!flowManager || typeof flowManager.retryCurrentAttempt !== "function") {
      throw new Error("canonical retry recovery requires FlowManager.retryCurrentAttempt");
    }
    this.flowManager = flowManager;
    this.state = canonicalState(state);
    this.request = request instanceof RetryRecoveryInput ? request : new RetryRecoveryInput(request);
    Object.freeze(this);
  }

  apply() {
    const before = this.flowManager.canonicalState(this.state.specId);
    const route = routeFor(this.request, before);
    if (!matchesRoute(route, before.attempt?.nodeId)) {
      throw new Error(`retry recovery target is not active: ${this.request.kind}/${this.request.phase}`);
    }
    const previousAttempt = before.attempt;
    const start = this.flowManager.activityLedger(this.state.specId).length;
    this.flowManager.retryCurrentAttempt({ specId: this.state.specId });
    const after = this.flowManager.canonicalState(this.state.specId);
    const activity = this.flowManager.activityLedger(this.state.specId)[start];
    return new CanonicalRetryRecoveryGrant({
      request: this.request,
      previousAttempt,
      nextAttempt: after.attempt,
      activity,
    });
  }
}

/** The definition is the only retry-budget authority in Version 1. */
export function resolveRecoveryMaxAttempts({ resolvedMax } = {}) {
  return requiredPositiveInteger(resolvedMax, "resolved retry maximum");
}

export class RetryRecoveryView {
  constructor({ kind, phase, attempts, max, recoveryReason }) {
    this.kind = requiredText(kind, "retry view kind");
    this.phase = requiredText(phase, "retry view phase");
    this.canonicalPhase = this.phase;
    this.attempts = Number.isSafeInteger(attempts) && attempts >= 0 ? attempts : 0;
    this.max = Number.isSafeInteger(max) && max >= 0 ? max : 0;
    this.recoveryPossible = false;
    this.recoveryReason = requiredText(recoveryReason, "retry view reason");
    this.changedEvidence = null;
    this.recoveryCommand = null;
    Object.freeze(this);
  }

  toJSON() {
    return {
      kind: this.kind,
      phase: this.phase,
      canonicalPhase: this.canonicalPhase,
      attempts: this.attempts,
      max: this.max,
      recoveryPossible: this.recoveryPossible,
      recoveryReason: this.recoveryReason,
      changedEvidence: this.changedEvidence,
      recoveryCommand: this.recoveryCommand,
    };
  }
}

/**
 * V1 exposes exhausted retries as definition-owned terminal decisions.  It
 * deliberately does not inspect project files for a side-channel reset.
 */
export function buildStateRetryRecoveryView({ flowState, kind, phase, attempts, max } = {}) {
  canonicalState(flowState);
  if (attempts < max) return null;
  return new RetryRecoveryView({
    kind,
    phase,
    attempts,
    max,
    recoveryReason: "definition-owned-retry-budget-exhausted",
  }).toJSON();
}
