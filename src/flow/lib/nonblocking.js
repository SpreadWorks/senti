/**
 * Advisory post-implementation Flow policy.
 *
 * This module deliberately owns the complete nonblocking vocabulary.  It
 * reads existing artifacts, never copies their raw contents into flow.json,
 * and has no dependency on the direct-flow implementation.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { flattenSteps } from "./step-tree.js";
import {
  NonBlockingDecisionOutcome,
  ObservedNonPassOutcome,
  StepAttempt,
  StepAttemptLog,
  nextStepAttemptNumber,
  recordStepAttempt,
} from "./step-outcome.js";
import { appendIssueLogEntry } from "./set-issue-log.js";
import { FlowContinuation, guardFlagsForState } from "./user-action-prompt.js";
import {
  fromAcceptanceResult,
  fromFinalRegressionResult,
  fromGateResult,
  fromReviewResult,
} from "./nonblocking-evidence.js";

const SUPPORTED_STEPS = Object.freeze(["impl-review", "impl-gate", "acceptance-review", "final-regression"]);
const CONTINUE_TARGET = Object.freeze({
  "impl-review": "impl-gate",
  "impl-gate": "retro",
  "acceptance-review": "final-regression",
  "final-regression": "report",
});
const MAX_TEXT = 2_000;

function text(value, field) {
  if (typeof value !== "string" || value.trim() === "" || value.trim().length > MAX_TEXT) {
    throw new Error(`${field} must be a non-empty string no longer than ${MAX_TEXT} characters`);
  }
  return value.trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function specDir(root, state) {
  if (!state?.spec) throw new Error("active flow spec is required");
  return path.dirname(path.resolve(root, state.spec));
}

function artifact(root, state, name) {
  const absolute = path.join(specDir(root, state), name);
  const source = fs.readFileSync(absolute, "utf8");
  return { ref: path.relative(root, absolute).replaceAll("\\", "/"), source, value: JSON.parse(source) };
}

function assertSupportedStep(step) {
  if (!SUPPORTED_STEPS.includes(step)) throw new Error(`nonblocking is not supported for step: ${step}`);
  return step;
}

function activeStep(state) {
  return flattenSteps(state.steps || []).find((step) => step.status === "in_progress")?.id || null;
}

export class NonBlockingPolicy {
  constructor({ enabled = true, activatedAt = new Date().toISOString(), activatedStep, reason }) {
    if (enabled !== true) throw new Error("nonblocking policy is one-way and must be enabled");
    this.enabled = true;
    this.activatedAt = text(activatedAt, "nonblocking activatedAt");
    this.activatedStep = assertSupportedStep(text(activatedStep, "nonblocking activatedStep"));
    this.reason = text(reason, "nonblocking reason");
    Object.freeze(this);
  }

  static fromStored(value) {
    return value instanceof NonBlockingPolicy ? value : new NonBlockingPolicy(value);
  }

  toJSON() {
    return { enabled: true, activatedAt: this.activatedAt, activatedStep: this.activatedStep, reason: this.reason };
  }
}

export class NonBlockingDecisionContext {
  constructor({ sourceStep, sourceAttempt, evidenceRef, evidenceDigest, resultKind, allowedActions }) {
    this.sourceStep = assertSupportedStep(text(sourceStep, "sourceStep"));
    if (!Number.isSafeInteger(sourceAttempt) || sourceAttempt < 1) throw new Error("sourceAttempt must be a positive integer");
    this.sourceAttempt = sourceAttempt;
    this.evidenceRef = text(evidenceRef, "evidenceRef");
    if (!/^[a-f0-9]{64}$/.test(evidenceDigest)) throw new Error("evidenceDigest must be SHA-256");
    this.evidenceDigest = evidenceDigest;
    if (!["quality", "tooling", "unavailable"].includes(resultKind)) throw new Error("invalid nonblocking resultKind");
    if (!Array.isArray(allowedActions) || allowedActions.length === 0) throw new Error("allowedActions are required");
    this.resultKind = resultKind;
    this.allowedActions = Object.freeze([...allowedActions]);
    Object.freeze(this);
  }

  identity() {
    return `${this.sourceStep}:${this.sourceAttempt}:${this.evidenceRef}:${this.evidenceDigest}`;
  }

  toJSON() {
    return { sourceStep: this.sourceStep, sourceAttempt: this.sourceAttempt, evidenceRef: this.evidenceRef, evidenceDigest: this.evidenceDigest, resultKind: this.resultKind, allowedActions: this.allowedActions };
  }
}

function resultForStep(root, state, step) {
  if (step === "impl-review") {
    const found = artifact(root, state, "impl-review.json");
    return fromReviewResult(found);
  }
  if (step === "impl-gate") {
    const found = artifact(root, state, "impl-gate-result.json");
    return fromGateResult(found);
  }
  if (step === "acceptance-review") {
    const found = artifact(root, state, "acceptance-review.json");
    return fromAcceptanceResult(found);
  }
  if (step === "final-regression") {
    const found = artifact(root, state, "final-regression-result.json");
    return fromFinalRegressionResult(found);
  }
  return null;
}

export function decisionContextForActiveFlow(root, state) {
  const step = activeStep(state);
  assertSupportedStep(step);
  const found = resultForStep(root, state, step);
  if (!found) throw new Error(`no eligible non-pass evidence is available for ${step}`);
  const digest = sha256(found.source);
  const log = new StepAttemptLog(state.stepAttempts || []);
  const prior = log.latest({ runId: state.runId, taskId: null, stepId: step });
  const previous = log.entries.findLast((entry) => (
    entry.stepId === step && entry.outcome?.kind === "nonblocking-decision"
  ))?.outcome || prior?.outcome;
  if (previous?.kind === "nonblocking-decision" && ["repair", "retry"].includes(previous.action)) {
    const observed = log.entries.findLast((entry) => (
      entry.stepId === step
      && entry.outcome?.kind === "observed-nonpass"
      && entry.attempt > previous.sourceAttempt
      && entry.outcome.evidenceDigest === digest
    ));
    if (!observed) {
      throw new Error("nonblocking recovery must save a subsequent check result before another decision");
    }
    return new NonBlockingDecisionContext({
      sourceStep: step,
      sourceAttempt: observed.attempt,
      evidenceRef: found.ref,
      evidenceDigest: digest,
      resultKind: found.resultKind,
      allowedActions: ["continue"],
    });
  }
  const sourceAttempt = prior?.attempt || 1;
  const exhaustedRecovery = false;
  const allowedActions = found.resultKind === "quality" ? ["repair", "continue"] : ["retry", "continue"];
  return new NonBlockingDecisionContext({ sourceStep: step, sourceAttempt, evidenceRef: found.ref, evidenceDigest: digest, resultKind: found.resultKind, allowedActions });
}

/** Persist only the identity of a non-pass already saved by its normal check. */
export function recordEligibleNonblockingAttempt(ctx, stepId, result = null) {
  if (!ctx?.flowState?.nonblocking?.enabled || !ctx?.flowState?.runId) return null;
  const found = resultForStep(ctx.root, ctx.flowState, stepId);
  if (!found) return null;
  return recordStepAttempt(ctx, {
    stepId,
    attempt: nextStepAttemptNumber(ctx.flowState, stepId),
    outcome: new ObservedNonPassOutcome({
      sourceStep: stepId,
      evidenceRef: found.ref,
      evidenceDigest: sha256(found.source),
      resultKind: found.resultKind,
    }),
    result,
  });
}

export function activateNonBlockingPolicy({ root, flowManager, reason }) {
  const state = flowManager.load();
  if (!state?.runId) throw new Error("an active normal flow is required");
  if (state.directFlowSession) throw new Error("nonblocking cannot be enabled while a direct session is active");
  const step = activeStep(state);
  assertSupportedStep(step);
  const approval = flattenSteps(state.steps || []).find((entry) => entry.id === "approval");
  if (approval?.status !== "done") throw new Error("nonblocking requires an approved spec");
  const implement = flattenSteps(state.steps || []).find((entry) => entry.id === "implement");
  if (!implement || implement.status === "pending") throw new Error("nonblocking requires implementation to have started");
  const policy = state.nonblocking ? NonBlockingPolicy.fromStored(state.nonblocking) : new NonBlockingPolicy({ activatedStep: step, reason });
  flowManager.mutate((current) => {
    if (current.directFlowSession) throw new Error("nonblocking cannot be enabled while a direct session is active");
    if (current.nonblocking) {
      NonBlockingPolicy.fromStored(current.nonblocking);
      return;
    }
    current.nonblocking = policy.toJSON();
  });
  return policy.toJSON();
}

function mark(state, id, status) {
  const step = flattenSteps(state.steps || []).find((entry) => entry.id === id);
  if (!step) throw new Error(`flow step is missing: ${id}`);
  step.status = status;
}

export function recordNonBlockingDecision({ root, flowManager, choice, reason, expectEvidenceDigest, remainingRisk = null }) {
  const state = flowManager.load();
  if (!state?.nonblocking) throw new Error("nonblocking policy is not enabled");
  const priorDecision = new StepAttemptLog(state.stepAttempts || []).entries.findLast((entry) => (
    entry.outcome?.kind === "nonblocking-decision" && entry.outcome.evidenceDigest === expectEvidenceDigest
  ));
  if (priorDecision) {
    if (priorDecision.outcome.action !== choice) throw new Error("a different nonblocking decision already exists for this evidence");
    return priorDecision.outcome.toJSON();
  }
  const context = decisionContextForActiveFlow(root, state);
  if (expectEvidenceDigest !== context.evidenceDigest) {
    const error = new Error("nonblocking evidence changed; refresh the guarded next action");
    error.code = "NONBLOCKING_STALE_EVIDENCE";
    error.context = context.toJSON();
    error.continuation = new FlowContinuation({
      actionId: "REFRESH_NONBLOCKING_EVIDENCE",
      nextAction: `senti flow get next-action ${guardFlagsForState(state)}`.trim(),
      instruction: "Refresh the guarded next action and use its latest evidence digest.",
      reason: "The evidence digest changed before the advisory decision could be recorded.",
    }).toJSON();
    throw error;
  }
  if (!context.allowedActions.includes(choice)) throw new Error(`nonblocking choice ${choice} is not allowed for ${context.resultKind} evidence`);
  const existing = new StepAttemptLog(state.stepAttempts || []).entries.findLast((entry) => (
    entry.outcome?.kind === "nonblocking-decision" && entry.outcome.sourceStep === context.sourceStep
      && entry.outcome.sourceAttempt === context.sourceAttempt && entry.outcome.evidenceRef === context.evidenceRef
      && entry.outcome.evidenceDigest === context.evidenceDigest
  ));
  if (existing) {
    if (existing.outcome.action !== choice) throw new Error("a different nonblocking decision already exists for this evidence");
    return existing.outcome.toJSON();
  }
  const nextAction = choice === "continue" ? `run-${CONTINUE_TARGET[context.sourceStep]}` : `run-${context.sourceStep}`;
  const outcome = new NonBlockingDecisionOutcome({ action: choice, ...context.toJSON(), rationale: reason, remainingRisk, nextAction });
  flowManager.mutate((current) => {
    const log = new StepAttemptLog(current.stepAttempts || []);
    log.record(new StepAttempt({
      runId: current.runId, taskId: null, stepId: context.sourceStep, attempt: context.sourceAttempt,
      outcome, recordedAt: new Date().toISOString(),
    }));
    current.stepAttempts = log.toJSON();
    if (choice === "continue") {
      mark(current, context.sourceStep, "done");
      mark(current, CONTINUE_TARGET[context.sourceStep], "in_progress");
    }
  });
  appendIssueLogEntry(root, state.spec, {
    step: context.sourceStep,
    reason: `Nonblocking ${choice} decision: ${text(reason, "reason")}`,
    trigger: "flow set nonblocking-decision",
    resolution: choice === "continue" ? `continue to ${CONTINUE_TARGET[context.sourceStep]}` : `${choice} and rerun ${context.sourceStep}`,
    evidenceRef: context.evidenceRef,
    evidenceDigest: context.evidenceDigest,
    ...(remainingRisk != null && { remainingRisk: text(remainingRisk, "remainingRisk") }),
    timestamp: new Date().toISOString(),
  });
  return outcome.toJSON();
}

export function advisorySummary(state) {
  const log = new StepAttemptLog(state?.stepAttempts || []);
  return log.entries.filter((entry) => entry.outcome?.kind === "nonblocking-decision" && entry.outcome.action === "continue")
    .map((entry) => ({ stepId: entry.outcome.sourceStep, evidenceRef: entry.outcome.evidenceRef, rationale: entry.outcome.rationale, remainingRisk: entry.outcome.remainingRisk }));
}
