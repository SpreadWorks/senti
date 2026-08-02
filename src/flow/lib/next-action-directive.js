/**
 * Single orchestration contract returned by `flow get next-action`.
 *
 * Domain subsystems may expose diagnostics, but only a NextActionDirective is
 * allowed to tell an agent what to do next. This prevents step outcomes,
 * reviews, gates, recovery, and the dispatcher from competing as
 * independent routing authorities.
 */

import {
  MoveToAcceptance,
  RegisterAlternativeEvidence,
  RetryReview,
  StopAsBlocker,
} from "./review-convergence.js";
import {
  AwaitingDecisionOutcome,
  ExternalBlockedOutcome,
} from "./step-outcome.js";
import {
  FlowContinuation,
  UserActionPrompt,
} from "./user-action-prompt.js";
import { guardedCommand } from "./guarded-command.js";

const ACTION_ID = /^[A-Z][A-Z0-9_]{2,79}$/;
const MAX_TEXT_LENGTH = 4000;
const DIRECTIVE_KINDS = new Set([
  "execute_step",
  "execute_command",
  "repair_evidence",
  "await_user_decision",
  "blocked",
  "completed",
  "aborted",
  "idle",
]);

function requireString(value, field, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${field} exceeds ${maxLength} characters`);
  }
  return normalized;
}

function requireActionId(value, field = "actionId") {
  const actionId = requireString(value, field, 80);
  if (!ACTION_ID.test(actionId)) {
    throw new Error(`${field} must be a stable uppercase action token`);
  }
  return actionId;
}

function refreshCommand(state, binding) {
  return guardedCommand("senti flow get next-action", state, binding);
}

export class NextActionDirective {
  constructor({ kind, terminal, requiresUserAction }) {
    if (new.target === NextActionDirective) {
      throw new Error("NextActionDirective is abstract");
    }
    if (!DIRECTIVE_KINDS.has(kind)) {
      throw new Error(`unknown next-action directive kind: ${kind}`);
    }
    if (typeof terminal !== "boolean") {
      throw new Error("next-action directive terminal must be boolean");
    }
    if (typeof requiresUserAction !== "boolean") {
      throw new Error("next-action directive requiresUserAction must be boolean");
    }
    this.kind = kind;
    this.terminal = terminal;
    this.requiresUserAction = requiresUserAction;
  }

  toJSON() {
    return {
      kind: this.kind,
      terminal: this.terminal,
      requiresUserAction: this.requiresUserAction,
    };
  }

  static fromStored(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("stored next-action directive must be an object");
    }
    if (value.kind === "execute_step") return new ExecuteStepDirective(value);
    if (value.kind === "execute_command") return new ExecuteCommandDirective(value);
    if (value.kind === "repair_evidence") return new RepairEvidenceDirective(value);
    if (value.kind === "await_user_decision") return new AwaitUserDecisionDirective(value);
    if (value.kind === "blocked") return new BlockedDirective(value);
    if (value.kind === "completed") return new CompletedDirective();
    if (value.kind === "aborted") return new AbortedDirective(value);
    if (value.kind === "idle") return new IdleDirective();
    throw new Error(`unknown stored next-action directive: ${value.kind}`);
  }
}

export class ExecuteStepDirective extends NextActionDirective {
  constructor({ action, nextAction = null } = {}) {
    super({ kind: "execute_step", terminal: false, requiresUserAction: false });
    this.action = requireString(action, "directive.action", 200);
    this.nextAction = nextAction == null
      ? null
      : requireString(nextAction, "directive.nextAction");
    Object.freeze(this);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      action: this.action,
      ...(this.nextAction && { nextAction: this.nextAction }),
    };
  }
}

export class ExecuteCommandDirective extends NextActionDirective {
  constructor({ actionId, nextAction, instruction, reason } = {}) {
    super({ kind: "execute_command", terminal: false, requiresUserAction: false });
    this.continuation = new FlowContinuation({
      actionId: requireActionId(actionId, "directive.actionId"),
      nextAction,
      instruction,
      reason,
    });
    Object.freeze(this);
  }

  toJSON() {
    return { ...super.toJSON(), ...this.continuation.toJSON() };
  }
}

export class RepairEvidenceDirective extends NextActionDirective {
  constructor({
    actionId,
    evidenceKind,
    phase,
    instruction,
    reason,
    nextAction,
  } = {}) {
    super({ kind: "repair_evidence", terminal: false, requiresUserAction: false });
    this.actionId = requireActionId(actionId, "directive.actionId");
    this.evidenceKind = requireString(evidenceKind, "directive.evidenceKind", 100);
    this.phase = requireString(phase, "directive.phase", 100);
    this.instruction = requireString(instruction, "directive.instruction");
    this.reason = requireString(reason, "directive.reason");
    this.nextAction = requireString(nextAction, "directive.nextAction");
    Object.freeze(this);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      actionId: this.actionId,
      evidenceKind: this.evidenceKind,
      phase: this.phase,
      instruction: this.instruction,
      reason: this.reason,
      nextAction: this.nextAction,
    };
  }
}

export class AwaitUserDecisionDirective extends NextActionDirective {
  constructor({ prompt = null, actionPrompt = null, reason = null } = {}) {
    super({ kind: "await_user_decision", terminal: false, requiresUserAction: true });
    this.prompt = UserActionPrompt.fromStored(prompt || actionPrompt);
    this.reason = reason == null
      ? this.prompt.recommendationReason
      : requireString(reason, "directive.reason");
    Object.freeze(this);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      actionPrompt: this.prompt.toJSON(),
      reason: this.reason,
    };
  }
}

export class BlockedDirective extends NextActionDirective {
  constructor({ code, reason, resumeInstruction } = {}) {
    super({ kind: "blocked", terminal: true, requiresUserAction: false });
    this.code = requireString(code, "directive.code", 200);
    this.reason = requireString(reason, "directive.reason");
    this.resumeInstruction = requireString(
      resumeInstruction || reason,
      "directive.resumeInstruction",
    );
    Object.freeze(this);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      code: this.code,
      reason: this.reason,
      resumeInstruction: this.resumeInstruction,
    };
  }
}

export class CompletedDirective extends NextActionDirective {
  constructor() {
    super({ kind: "completed", terminal: true, requiresUserAction: false });
    Object.freeze(this);
  }
}

export class AbortedDirective extends NextActionDirective {
  constructor({ reason = "The Flow was aborted." } = {}) {
    super({ kind: "aborted", terminal: true, requiresUserAction: false });
    this.reason = requireString(reason, "directive.reason");
    Object.freeze(this);
  }

  toJSON() {
    return { ...super.toJSON(), reason: this.reason };
  }
}

export class IdleDirective extends NextActionDirective {
  constructor() {
    super({ kind: "idle", terminal: true, requiresUserAction: false });
    Object.freeze(this);
  }
}

function reviewDirective({ state, binding, phase, operation, nextAction }) {
  if (operation instanceof MoveToAcceptance) {
    return new ExecuteCommandDirective({
      actionId: "COMPLETE_REVIEW_LIFECYCLE",
      nextAction,
      instruction: "Complete the current canonical review outcome without invoking the reviewer again, persist any exhausted semantic findings for acceptance disposition, then refresh next-action.",
      reason: "The canonical review outcome is ready for its normal lifecycle transition.",
    });
  }
  if (operation instanceof RetryReview) {
    if (!operation.requiresChangedEvidence) {
      return new ExecuteCommandDirective({
        actionId: "RETRY_REVIEW",
        nextAction,
        instruction: "Retry the current review with its remaining tooling budget.",
        reason: operation.blocker.reason,
      });
    }
    return new RepairEvidenceDirective({
      actionId: "REPAIR_REVIEW_EVIDENCE",
      evidenceKind: "review",
      phase,
      instruction: "Repair the persisted blocking review findings in the current review target, then refresh next-action. Do not reset or spend another review attempt until the target identity changes.",
      reason: operation.blocker.reason,
      nextAction: refreshCommand(state, binding),
    });
  }
  if (operation instanceof RegisterAlternativeEvidence) {
    return new RepairEvidenceDirective({
      actionId: "REGISTER_REVIEW_EVIDENCE",
      evidenceKind: "review",
      phase,
      instruction: "Recover the finalized canonical review evidence for this target and register it through the guarded review-evidence command, then refresh next-action.",
      reason: operation.blocker.reason,
      nextAction: refreshCommand(state, binding),
    });
  }
  if (operation instanceof StopAsBlocker) {
    return new BlockedDirective({
      code: "REVIEW_RECOVERY_UNAVAILABLE",
      reason: operation.blocker.reason,
      resumeInstruction: operation.blocker.reason,
    });
  }
  throw new Error("unknown review permitted operation");
}

function gateDirective({ state, binding, phase, recovery }) {
  if (!recovery) return null;
  if (recovery.recoveryPossible === true && recovery.recoveryCommand) {
    return new ExecuteCommandDirective({
      actionId: "RECOVER_GATE_RETRY",
      nextAction: guardedCommand(recovery.recoveryCommand, state, binding),
      instruction: "Apply the persisted one-attempt gate recovery and continue the normal Flow.",
      reason: recovery.recoveryReason,
    });
  }
  if (recovery.recoveryReason === "unchanged-evidence") {
    return new RepairEvidenceDirective({
      actionId: "REPAIR_GATE_EVIDENCE",
      evidenceKind: "gate",
      phase,
      instruction: "Repair the persisted gate findings in the mapped source evidence, then refresh next-action. Do not spend another gate attempt until the evidence fingerprint changes.",
      reason: recovery.recoveryReason,
      nextAction: refreshCommand(state, binding),
    });
  }
  return new BlockedDirective({
    code: "GATE_RECOVERY_UNAVAILABLE",
    reason: recovery.recoveryReason,
    resumeInstruction: recovery.reason || recovery.recoveryReason,
  });
}

export class NextActionDirectiveResolver {
  constructor({
    state,
    binding = null,
    action = null,
    nextAction = null,
    reviewPhase = null,
    reviewTargetChanged = false,
    gatePhase = null,
    stepAttempt = null,
    reviewOperation = null,
    gateRecovery = null,
  } = {}) {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error("directive resolver state is required");
    }
    this.state = state;
    if (binding != null && typeof binding.guardCommand !== "function") {
      throw new Error("directive resolver binding.guardCommand is required");
    }
    this.binding = binding;
    this.action = action;
    this.nextAction = nextAction;
    this.reviewPhase = reviewPhase;
    this.reviewTargetChanged = reviewTargetChanged === true;
    this.gatePhase = gatePhase;
    this.stepAttempt = stepAttempt;
    this.reviewOperation = reviewOperation;
    this.gateRecovery = gateRecovery;
  }

  resolve() {
    const review = this.reviewOperation
      ? reviewDirective({
          state: this.state,
          binding: this.binding,
          phase: this.reviewPhase,
          operation: this.reviewOperation,
          nextAction: this.nextAction,
        })
      : null;
    if (review) return review;

    if (this.stepAttempt?.outcome instanceof AwaitingDecisionOutcome) {
      return new AwaitUserDecisionDirective({
        prompt: this.stepAttempt.outcome.prompt,
        reason: this.stepAttempt.outcome.reason,
      });
    }

    if (this.stepAttempt?.outcome instanceof ExternalBlockedOutcome) {
      const gate = gateDirective({
        state: this.state,
        binding: this.binding,
        phase: this.gatePhase,
        recovery: this.gateRecovery,
      });
      if (gate) return gate;
      if (
        this.reviewOperation instanceof MoveToAcceptance
        || this.reviewTargetChanged
      ) {
        return new ExecuteStepDirective({
          action: this.action,
          nextAction: this.nextAction,
        });
      }
      return new BlockedDirective({
        code: "STEP_EXTERNAL_BLOCKED",
        reason: this.stepAttempt.outcome.reason,
        resumeInstruction: this.stepAttempt.outcome.resumeInstruction,
      });
    }

    return new ExecuteStepDirective({
      action: this.action,
      nextAction: this.nextAction,
    });
  }
}

export function assertNextActionDirective(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return;
  if (data.directive == null) return;
  NextActionDirective.fromStored(data.directive);
  const competingFields = [
    "continuation",
    "actionPrompt",
    "reviewAction",
    "retryRecovery",
    "gateStop",
    "halt",
    "yieldsControl",
    "requiresUserAction",
  ].filter((field) => Object.hasOwn(data, field));
  if (competingFields.length > 0) {
    throw new Error(
      `NEXT_ACTION_DIRECTIVE_CONFLICT: directive cannot coexist with ${competingFields.join(", ")}`,
    );
  }
}
