/**
 * Typed flow step outcomes and durable attempt records.
 *
 * Command/process output is interpreted once at the boundary. Flow control
 * after that boundary discriminates with `instanceof`, while `kind` exists
 * only in the persisted JSON representation.
 */

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function requireAttempt(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("step attempt must be a positive integer");
  }
  return value;
}

export class StepOutcome {
  constructor({ terminal, nextAction = null, resumeInstruction = null }) {
    if (new.target === StepOutcome) throw new Error("StepOutcome is abstract");
    if (typeof terminal !== "boolean") throw new Error("step outcome terminal must be boolean");
    if (nextAction != null) requireString(nextAction, "nextAction");
    if (resumeInstruction != null) requireString(resumeInstruction, "resumeInstruction");
    if ((nextAction == null) === (resumeInstruction == null)) {
      throw new Error("step outcome requires exactly one nextAction or resumeInstruction");
    }
    this.terminal = terminal;
    this.nextAction = nextAction;
    this.resumeInstruction = resumeInstruction;
  }

  toJSON() {
    return {
      kind: this.kind,
      terminal: this.terminal,
      ...(this.nextAction ? { nextAction: this.nextAction } : {}),
      ...(this.resumeInstruction ? { resumeInstruction: this.resumeInstruction } : {}),
    };
  }

  static fromStored(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("stored step outcome must be an object");
    }
    const common = {
      nextAction: value.nextAction,
      resumeInstruction: value.resumeInstruction,
    };
    if (value.kind === "retry") return new RetryOutcome({ nextAction: value.nextAction });
    if (value.kind === "decision") {
      return new DecisionOutcome({ decision: value.decision, nextAction: value.nextAction });
    }
    if (value.kind === "defer") {
      return new DeferOutcome({ nextAction: value.nextAction, findingCount: value.findingCount });
    }
    if (value.kind === "external-blocked") {
      return new ExternalBlockedOutcome({ reason: value.reason, ...common });
    }
    if (value.kind === "awaiting-decision") {
      return new AwaitingDecisionOutcome({ reason: value.reason, ...common });
    }
    throw new Error(`unknown stored step outcome: ${value.kind}`);
  }
}

export class RetryOutcome extends StepOutcome {
  constructor({ nextAction }) {
    super({ terminal: false, nextAction });
    this.kind = "retry";
    Object.freeze(this);
  }
}

export class DecisionOutcome extends StepOutcome {
  constructor({ decision, nextAction }) {
    super({ terminal: true, nextAction });
    this.kind = "decision";
    this.decision = requireString(decision, "decision");
    Object.freeze(this);
  }

  toJSON() {
    return { ...super.toJSON(), decision: this.decision };
  }
}

export class DeferOutcome extends StepOutcome {
  constructor({ nextAction, findingCount = 0 }) {
    super({ terminal: true, nextAction });
    if (!Number.isSafeInteger(findingCount) || findingCount < 0) {
      throw new Error("defer findingCount must be a non-negative integer");
    }
    this.kind = "defer";
    this.findingCount = findingCount;
    Object.freeze(this);
  }

  toJSON() {
    return { ...super.toJSON(), findingCount: this.findingCount };
  }
}

class StoppedOutcome extends StepOutcome {
  constructor({ reason, resumeInstruction }) {
    super({ terminal: true, resumeInstruction });
    this.reason = requireString(reason, "reason");
  }

  toJSON() {
    return { ...super.toJSON(), reason: this.reason };
  }
}

export class ExternalBlockedOutcome extends StoppedOutcome {
  constructor(input) {
    super(input);
    this.kind = "external-blocked";
    Object.freeze(this);
  }
}

export class AwaitingDecisionOutcome extends StoppedOutcome {
  constructor(input) {
    super(input);
    this.kind = "awaiting-decision";
    Object.freeze(this);
  }
}

export class StepAttempt {
  constructor({ runId, taskId = null, stepId, attempt, outcome, recordedAt = new Date().toISOString() }) {
    this.runId = requireString(runId, "runId");
    if (taskId != null) requireString(taskId, "taskId");
    this.taskId = taskId;
    this.stepId = requireString(stepId, "stepId");
    this.attempt = requireAttempt(attempt);
    if (!(outcome instanceof StepOutcome)) throw new Error("StepAttempt outcome must be a StepOutcome");
    this.outcome = outcome;
    this.recordedAt = requireString(recordedAt, "recordedAt");
    Object.freeze(this);
  }

  sameIdentity(other) {
    return other instanceof StepAttempt
      && this.runId === other.runId
      && this.taskId === other.taskId
      && this.stepId === other.stepId
      && this.attempt === other.attempt;
  }

  toJSON() {
    return {
      runId: this.runId,
      taskId: this.taskId,
      stepId: this.stepId,
      attempt: this.attempt,
      outcome: this.outcome.toJSON(),
      recordedAt: this.recordedAt,
    };
  }

  static fromStored(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("stored StepAttempt must be an object");
    }
    return new StepAttempt({
      ...value,
      outcome: StepOutcome.fromStored(value.outcome),
    });
  }
}

export class StepAttemptLog {
  constructor(entries = []) {
    if (!Array.isArray(entries)) throw new Error("stepAttempts must be an array");
    this.entries = entries.map((entry) => entry instanceof StepAttempt ? entry : StepAttempt.fromStored(entry));
  }

  record(attempt) {
    if (!(attempt instanceof StepAttempt)) throw new Error("StepAttempt is required");
    const index = this.entries.findIndex((entry) => entry.sameIdentity(attempt));
    if (index >= 0) this.entries.splice(index, 1);
    this.entries.push(attempt);
    return attempt;
  }

  latestForRun(runId) {
    return this.entries.findLast((entry) => entry.runId === runId) || null;
  }

  latest({ runId, taskId = null, stepId }) {
    return this.entries.findLast((entry) => (
      entry.runId === runId && entry.taskId === taskId && entry.stepId === stepId
    )) || null;
  }

  toJSON() {
    return this.entries.map((entry) => entry.toJSON());
  }
}

export function persistStepAttempt(ctx, attempt, routeOptions) {
  if (!(attempt instanceof StepAttempt)) throw new Error("StepAttempt is required");
  if (typeof ctx?.flowManager?.mutate !== "function") {
    throw new Error("flowManager.mutate is required to persist StepAttempt");
  }
  ctx.flowManager.mutate((state) => {
    const log = new StepAttemptLog(state.stepAttempts || []);
    log.record(attempt);
    state.stepAttempts = log.toJSON();
  }, routeOptions);
  return attempt;
}

export function recordStepAttempt(ctx, { stepId, attempt, outcome, result = null, routeOptions = undefined }) {
  if (!ctx?.flowState?.runId || typeof ctx?.flowManager?.mutate !== "function") return null;
  const record = new StepAttempt({
    runId: ctx.flowState.runId,
    taskId: ctx.flowState.currentTaskId ?? null,
    stepId,
    attempt,
    outcome,
  });
  persistStepAttempt(ctx, record, routeOptions);
  if (result && typeof result === "object") {
    result.stepAttempt = record.toJSON();
    result.artifacts = {
      ...(result.artifacts || {}),
      stepOutcome: outcome.toJSON(),
    };
  }
  return record;
}

const RETRY_RESET_METRIC_BY_STEP = Object.freeze({
  "task-review": { phase: "impl", counter: "reviewRetry" },
  "task-gate": { phase: "task-impl", counter: "gateRetry" },
  "impl-review": { phase: "impl", counter: "reviewRetry" },
  "impl-gate": { phase: "integration", counter: "gateRetry" },
});

export function retryResetTimestampForStep(flowState, stepId) {
  const metric = RETRY_RESET_METRIC_BY_STEP[stepId];
  if (!metric) return -Infinity;
  return (flowState.metrics || [])
    .filter((entry) => (
      entry?.phase === metric.phase
      && entry?.counter === metric.counter
      && entry?.reset === true
    ))
    .map((entry) => Date.parse(entry.ts))
    .filter(Number.isFinite)
    .reduce((latest, timestamp) => Math.max(latest, timestamp), -Infinity);
}

export function nextStepAttemptNumber(flowState, stepId) {
  if (!flowState?.runId) return 1;
  const log = new StepAttemptLog(flowState.stepAttempts || []);
  const resetAt = retryResetTimestampForStep(flowState, stepId);
  const matching = log.entries.filter((entry) => (
    entry.runId === flowState.runId
    && entry.taskId === (flowState.currentTaskId ?? null)
    && entry.stepId === stepId
    && Date.parse(entry.recordedAt) >= resetAt
  ));
  return matching.reduce((max, entry) => Math.max(max, entry.attempt), 0) + 1;
}
