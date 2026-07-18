/**
 * src/flow/lib/review-failure.js
 *
 * Review failure taxonomy and recovery state helpers.
 */

export const REVIEW_FAILURE_MARKER_PREFIX = "SENTI_REVIEW_FAILURE ";

const CLASSIFICATIONS = Object.freeze([
  "review_verdict_failure",
  "subprocess_failure",
  "provider_failure",
  "input_size_failure",
  "schema_failure",
  "max_attempts_exceeded",
]);

const MARKER_CLASSIFICATIONS = Object.freeze([
  "provider_failure",
  "input_size_failure",
  "schema_failure",
]);

const REVIEW_PHASE_BY_STEP_ID = Object.freeze({
  "draft-questions-review": "draft-questions",
  "draft-coverage-review": "draft-coverage",
  "spec-review": "spec",
  "test-review": "test",
  "impl-review": "impl",
  "task-review": "impl",
});

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value;
}

function cleanReason(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function retryResetCommand(phase) {
  return `senti flow set retry reset review ${phase} --reason <text> --yes`;
}

function retryReviewCommand(phase) {
  return phase === "impl"
    ? "senti flow run review"
    : `senti flow run review --phase ${phase}`;
}

export function reviewPhaseForStepId(stepId) {
  return REVIEW_PHASE_BY_STEP_ID[stepId] || null;
}

function countReviewRetry(entries, phase) {
  if (!Array.isArray(entries)) return 0;
  let count = 0;
  for (const entry of entries) {
    if (entry?.phase !== phase || entry?.counter !== "reviewRetry") continue;
    if (entry.taskId != null) continue;
    if (entry.reset) count = 0;
    else count += entry.delta ?? 1;
  }
  return count;
}

function fallbackRecoveryCommand(stop) {
  if (stop?.classification === "max_attempts_exceeded") {
    return retryResetCommand(stop.phase);
  }
  return retryReviewCommand(stop?.phase || "impl");
}

function matchesInputSizeFailure(text) {
  return /TEST_REVIEW_PROMPT_TOO_LARGE|prompt.*too large|input.*too large|context.*length|maximum context|token limit/i.test(text);
}

function matchesProviderFailure(text) {
  return /rate limit|quota|429|provider|api error|overloaded|temporarily unavailable/i.test(text);
}

export class ReviewFailure {
  constructor(input = {}) {
    const classification = requireString(input.classification, "classification");
    if (!CLASSIFICATIONS.includes(classification)) {
      throw new Error(`unknown review failure classification: ${classification}`);
    }
    this.phase = requireString(input.phase || "impl", "phase");
    this.classification = classification;
    this.reason = input.reason ? String(input.reason) : null;
    this.retryBudgetConsumed = input.retryBudgetConsumed === true;
    this.recoveryHint = input.recoveryHint ? String(input.recoveryHint) : null;
    this.recoveryCommand = input.recoveryCommand ? String(input.recoveryCommand) : null;
    this.exitCode = input.exitCode ?? null;
    this.signal = input.signal ?? null;
    this.killed = input.killed === true;
    this.attempts = input.attempts ?? null;
    this.max = input.max ?? null;
    this.targetReview = input.targetReview ? String(input.targetReview) : null;
    this.validationError = input.validationError ? String(input.validationError) : null;
    this.currentAttempt = input.currentAttempt ?? null;
    this.maximumAttempts = input.maximumAttempts ?? null;
    if (classification === "schema_failure") {
      requireString(this.targetReview, "targetReview");
      requireString(this.validationError, "validationError");
      if (!Number.isInteger(this.currentAttempt) || this.currentAttempt < 1) {
        throw new Error("currentAttempt must be a positive integer");
      }
      if (!Number.isInteger(this.maximumAttempts) || this.maximumAttempts < this.currentAttempt) {
        throw new Error("maximumAttempts must be an integer greater than or equal to currentAttempt");
      }
    }
  }

  static classifications() {
    return [...CLASSIFICATIONS];
  }

  static reviewVerdictFailure({ phase, reason = "review verdict failed" } = {}) {
    return new ReviewFailure({
      phase,
      classification: "review_verdict_failure",
      reason,
      retryBudgetConsumed: true,
    });
  }

  static subprocessFailure({ phase, exitCode = null, signal = null, killed = false, stderr = "" } = {}) {
    const reason = signal
      ? `subprocess signal: ${signal}`
      : killed
        ? "subprocess killed"
        : cleanReason(stderr, "subprocess failed");
    return new ReviewFailure({
      phase,
      classification: "subprocess_failure",
      reason,
      retryBudgetConsumed: false,
      exitCode,
      signal,
      killed,
    });
  }

  static providerFailure({ phase, reason, recoveryHint, recoveryCommand } = {}) {
    return new ReviewFailure({
      phase,
      classification: "provider_failure",
      reason: requireString(reason, "reason"),
      retryBudgetConsumed: false,
      recoveryHint: requireString(recoveryHint, "recoveryHint"),
      recoveryCommand: requireString(recoveryCommand, "recoveryCommand"),
    });
  }

  static inputSizeFailure({ phase, reason, recoveryHint, recoveryCommand } = {}) {
    return new ReviewFailure({
      phase,
      classification: "input_size_failure",
      reason: requireString(reason, "reason"),
      retryBudgetConsumed: false,
      recoveryHint: requireString(recoveryHint, "recoveryHint"),
      recoveryCommand: requireString(recoveryCommand, "recoveryCommand"),
    });
  }

  static schemaFailure({
    phase = "impl",
    targetReview,
    validationError,
    currentAttempt = 1,
    maximumAttempts = 1,
  } = {}) {
    return new ReviewFailure({
      phase,
      classification: "schema_failure",
      reason: `${requireString(targetReview, "targetReview")} output schema validation failed`,
      retryBudgetConsumed: false,
      targetReview,
      validationError: requireString(validationError, "validationError"),
      currentAttempt,
      maximumAttempts,
    });
  }

  static maxAttemptsExceeded({ phase, attempts, max } = {}) {
    const safePhase = requireString(phase, "phase");
    return new ReviewFailure({
      phase: safePhase,
      classification: "max_attempts_exceeded",
      attempts,
      max,
      retryBudgetConsumed: false,
      recoveryHint: "Reset the review retry counter before retrying this phase.",
      recoveryCommand: retryResetCommand(safePhase),
    });
  }

  static fromMarkerLine(line) {
    if (typeof line !== "string" || !line.startsWith(REVIEW_FAILURE_MARKER_PREFIX)) return null;
    try {
      const data = JSON.parse(line.slice(REVIEW_FAILURE_MARKER_PREFIX.length));
      if (!MARKER_CLASSIFICATIONS.includes(data?.classification)) return null;
      if (data.classification === "schema_failure") {
        return ReviewFailure.schemaFailure({
          phase: data.phase,
          targetReview: data.targetReview,
          validationError: data.validationError,
          currentAttempt: data.currentAttempt,
          maximumAttempts: data.maximumAttempts,
        });
      }
      if (!data.phase || !data.reason || !data.recoveryHint || !data.recoveryCommand) return null;
      return new ReviewFailure({
        phase: data.phase,
        classification: data.classification,
        reason: data.reason,
        retryBudgetConsumed: false,
        recoveryHint: data.recoveryHint,
        recoveryCommand: data.recoveryCommand,
      });
    } catch (_) {
      return null;
    }
  }

  static fromMessage({ phase = "impl", message = "", recoveryCommand = null } = {}) {
    const text = String(message || "");
    const command = recoveryCommand || retryReviewCommand(phase);
    if (matchesInputSizeFailure(text)) {
      return ReviewFailure.inputSizeFailure({
        phase,
        reason: text.includes("TEST_REVIEW_PROMPT_TOO_LARGE") ? "input-length" : cleanReason(text.split(/\r?\n/)[0], "review input is too large"),
        recoveryHint: "Reduce review input before retrying.",
        recoveryCommand: command,
      });
    }
    if (matchesProviderFailure(text)) {
      return ReviewFailure.providerFailure({
        phase,
        reason: "provider-error",
        recoveryHint: "Retry after the provider error is resolved.",
        recoveryCommand: command,
      });
    }
    return null;
  }

  static fromSubprocessResult({ phase, result } = {}) {
    const stderr = String(result?.stderr || "");
    let sawMarker = false;
    for (const line of stderr.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith(REVIEW_FAILURE_MARKER_PREFIX)) sawMarker = true;
      const marker = ReviewFailure.fromMarkerLine(trimmed);
      if (marker) return marker;
    }
    if (sawMarker) {
      return ReviewFailure.subprocessFailure({
        phase,
        exitCode: result?.status ?? null,
        signal: result?.signal ?? null,
        killed: result?.killed === true,
        stderr,
      });
    }
    const classified = ReviewFailure.fromMessage({ phase: phase || "impl", message: stderr });
    if (classified) return classified;
    return ReviewFailure.subprocessFailure({
      phase,
      exitCode: result?.status ?? null,
      signal: result?.signal ?? null,
      killed: result?.killed === true,
      stderr,
    });
  }

  shouldRetrySubprocess({ attempt, maxAttempts } = {}) {
    if (this.classification !== "subprocess_failure" && this.classification !== "schema_failure") return false;
    if (this.classification === "subprocess_failure" && (this.signal || this.killed)) return false;
    return Number(attempt) < Number(maxAttempts);
  }

  withAttempts({ currentAttempt, maximumAttempts } = {}) {
    if (this.classification !== "schema_failure") return this;
    return ReviewFailure.schemaFailure({
      phase: this.phase,
      targetReview: this.targetReview,
      validationError: this.validationError,
      currentAttempt,
      maximumAttempts,
    });
  }

  shouldPersistStopState() {
    return this.classification === "provider_failure" || this.classification === "input_size_failure";
  }

  toEnvelopeCode() {
    return this.classification.toUpperCase();
  }

  toEnvelopeData() {
    const data = {
      phase: this.phase,
      classification: this.classification,
      ...(this.reason && { reason: this.reason }),
      retryBudgetConsumed: this.retryBudgetConsumed,
      ...(this.recoveryHint && { recoveryHint: this.recoveryHint }),
      ...(this.recoveryCommand && { recoveryCommand: this.recoveryCommand }),
    };
    if (this.classification === "max_attempts_exceeded") {
      data.attempts = this.attempts;
      data.max = this.max;
    }
    if (this.classification === "schema_failure") {
      data.targetReview = this.targetReview;
      data.validationError = this.validationError;
      data.currentAttempt = this.currentAttempt;
      data.maximumAttempts = this.maximumAttempts;
    }
    return data;
  }

  toReviewStop() {
    return {
      ...this.toEnvelopeData(),
      stopReason: this.classification,
      recoveryCommand: this.recoveryCommand || fallbackRecoveryCommand(this),
      updatedAt: new Date().toISOString(),
    };
  }

  toMarkerLine() {
    if (!MARKER_CLASSIFICATIONS.includes(this.classification)) {
      throw new Error(`classification cannot be emitted as review marker: ${this.classification}`);
    }
    return REVIEW_FAILURE_MARKER_PREFIX + JSON.stringify({
      phase: this.phase,
      classification: this.classification,
      reason: this.reason,
      ...(this.classification === "schema_failure" ? {
        targetReview: this.targetReview,
        validationError: this.validationError,
        currentAttempt: this.currentAttempt,
        maximumAttempts: this.maximumAttempts,
      } : {
        recoveryHint: this.recoveryHint,
        recoveryCommand: this.recoveryCommand,
      }),
    });
  }

  requiresIssueLog(options = {}) {
    return options.workaroundApplied === true
      || options.manualRecoveryRequired === true
      || options.specDecisionChanged === true;
  }
}

export function writeReviewStopState(state, failure) {
  state.reviewStop = failure.toReviewStop();
}

export function clearReviewStopState(state, phase) {
  if (!state?.reviewStop) return;
  if (!phase || state.reviewStop.phase === phase) state.reviewStop = null;
}

export function buildReviewStopView(state, { surface = "next-action", phase = null, maxAttempts = null } = {}) {
  const stopped = state?.reviewStop;
  if (stopped && (!phase || stopped.phase === phase)) {
    const recoveryCommand = stopped.recoveryCommand || fallbackRecoveryCommand(stopped);
    return {
      stopReason: stopped.stopReason || stopped.classification,
      classification: stopped.classification,
      phase: stopped.phase,
      ...(stopped.reason && { reason: stopped.reason }),
      retryBudgetConsumed: stopped.retryBudgetConsumed === true,
      ...(stopped.recoveryHint && { recoveryHint: stopped.recoveryHint }),
      recoveryCommand,
      ...(surface === "status" && {
        summary: `${stopped.classification}: ${stopped.reason || "review stopped"}; recovery: ${recoveryCommand}`,
      }),
    };
  }

  if (!phase || !Number.isSafeInteger(maxAttempts)) return null;
  const attempts = countReviewRetry(state?.metrics, phase);
  if (attempts < maxAttempts) return null;
  const failure = ReviewFailure.maxAttemptsExceeded({ phase, attempts, max: maxAttempts });
  const view = failure.toEnvelopeData();
  return {
    stopReason: failure.classification,
    ...view,
    ...(surface === "status" && {
      summary: `${failure.classification}: ${attempts}/${maxAttempts}; recovery: ${view.recoveryCommand}`,
    }),
  };
}
