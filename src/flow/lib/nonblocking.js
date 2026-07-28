/**
 * Advisory Flow policy for eligible acceptance-backed checks.
 *
 * This closed module owns the nonblocking vocabulary. It reads authoritative
 * result artifacts, stores only their identity in flow.json, and deliberately
 * has no dependency on the direct-flow implementation.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  RepositoryFlowOperationLock,
  resolveRepositoryLockRoot,
} from "../../lib/repository-maintenance-lock.js";
import { findStepById } from "./step-tree.js";
import { findActiveNode } from "../definition.js";
import { completeTaskInState } from "../../lib/flow-helpers.js";
import {
  NonBlockingDecisionOutcome,
  NONBLOCKING_SOURCE_STEPS,
  ObservedNonPassOutcome,
  StepAttempt,
  StepAttemptLog,
  nextStepAttemptNumber,
} from "./step-outcome.js";
import { IssueLogStore } from "./issue-log-store.js";
import {
  FlowContinuation,
  UserActionChoice,
  UserActionImpact,
  UserActionPrompt,
  guardFlagsForState,
} from "./user-action-prompt.js";
import {
  fromAcceptanceResult,
  fromFinalRegressionResult,
  fromGateResult,
  fromReviewResult,
  fromVerificationResult,
} from "./nonblocking-evidence.js";
import {
  materializeReviewRetryExhaustionDeferral,
} from "./run-review.js";
import {
  materializeGateRetryExhaustionDeferral,
  promoteNextTaskInState,
} from "./run-gate.js";
import { materializeNonblockingAcceptanceHandoff } from "./nonblocking-handoff.js";
import { nonblockingRouteFor } from "./nonblocking-route.js";

const SUPPORTED_STEPS = NONBLOCKING_SOURCE_STEPS;
const MAX_TEXT = 2_000;
const ACTIONS = Object.freeze(["repair", "retry", "continue"]);
const RESULT_KINDS = Object.freeze(["quality", "tooling", "unavailable"]);

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
  const directory = specDir(root, state);
  const absolute = path.resolve(directory, name);
  if (path.dirname(absolute) !== directory) throw new Error(`nonblocking artifact is outside the active spec: ${name}`);
  const stat = fs.lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`nonblocking artifact must be a regular file: ${name}`);
  const source = fs.readFileSync(absolute, "utf8");
  return { ref: path.relative(root, absolute).replaceAll("\\", "/"), source };
}

function assertSupportedStep(step) {
  if (!SUPPORTED_STEPS.includes(step)) throw new Error(`nonblocking is not supported for step: ${step}`);
  return step;
}

function activeNode(state) {
  return findActiveNode(state);
}

function activeStep(state) {
  return activeNode(state)?.stepId || null;
}

function activationStep(root, state) {
  if (!state?.runId) throw new Error("an active normal flow is required");
  if (state.directFlowSession) throw new NonBlockingRouteOwnershipError("a direct session already owns this Flow route", state);
  const step = assertSupportedStep(activeStep(state));
  let evidence;
  try {
    evidence = evidenceForStep(root, state, step);
  } catch (error) {
    throw new Error(`nonblocking requires a durable non-pass artifact for ${step}: ${error.message}`);
  }
  if (!evidence) throw new Error(`nonblocking requires eligible non-pass evidence for ${step}`);
  return step;
}

function guardCommand(state) {
  return `senti flow get next-action ${guardFlagsForState(state)}`.trim();
}

function continuationFor(state, actionId, instruction, reason) {
  return new FlowContinuation({
    actionId,
    nextAction: guardCommand(state),
    instruction,
    reason,
  });
}

function resultForStep(root, state, step) {
  const route = nonblockingRouteFor(step);
  if (!route) return null;
  const source = artifact(root, state, route.artifact);
  if (route.kind === "review") return fromReviewResult(source);
  if (route.kind === "gate") return fromGateResult(source);
  if (route.kind === "verification") return fromVerificationResult(source, step);
  if (route.kind === "acceptance") return fromAcceptanceResult(source);
  if (route.kind === "regression") return fromFinalRegressionResult(source);
  return null;
}

function evidenceForStep(root, state, step) {
  const found = resultForStep(root, state, step);
  if (!found) return null;
  return { ...found, evidenceDigest: sha256(found.source) };
}

function hasSameEvidence(outcome, identity) {
  return outcome?.sourceStep === identity.sourceStep
    && outcome?.evidenceRef === identity.evidenceRef
    && outcome?.evidenceDigest === identity.evidenceDigest;
}

function latestObservedEvidence(log, state, identity, taskId = null) {
  return log.entries.findLast((entry) => (
    entry.runId === state.runId
    && entry.taskId === taskId
    && entry.stepId === identity.sourceStep
    && entry.outcome instanceof ObservedNonPassOutcome
    && hasSameEvidence(entry.outcome, identity)
  )) || null;
}

function sourceAttemptFromResult(result, state, stepId, taskId = null) {
  const stored = result?.stepAttempt || result?.data?.stepAttempt;
  if (!stored) return null;
  let attempt;
  try {
    attempt = stored instanceof StepAttempt ? stored : StepAttempt.fromStored(stored);
  } catch {
    return null;
  }
  return attempt.runId === state.runId
    && attempt.taskId === taskId
    && attempt.stepId === stepId
    ? attempt.attempt
    : null;
}

function latestSourceAttempt(log, state, stepId, taskId = null) {
  return log.entries.findLast((entry) => (
    entry.runId === state.runId
    && entry.taskId === taskId
    && entry.stepId === stepId
  ))?.attempt || null;
}

function resultPayload(result) {
  if (!result || typeof result !== "object") return null;
  return result.data && typeof result.data === "object" ? result.data : result;
}

function isExplicitEvidenceReference(value, evidence) {
  if (typeof value !== "string") return false;
  const reference = value.replaceAll("\\", "/");
  return reference === evidence.ref
    // The review and gate commands report their canonical artifact as a
    // spec-relative basename. It remains an explicit declaration of this
    // active check's artifact, unlike a generic StepAttempt.
    || reference === path.posix.basename(evidence.ref);
}

function resultReferencesEvidence(result, evidence) {
  const payload = resultPayload(result);
  if (!payload) return false;
  const artifacts = payload.artifacts && typeof payload.artifacts === "object"
    ? payload.artifacts
    : {};
  return [
    payload.artifact_path,
    payload.artifactPath,
    payload.result_path,
    payload.resultPath,
    artifacts.artifactPath,
    artifacts.result_path,
    artifacts.resultPath,
  ].some((reference) => isExplicitEvidenceReference(reference, evidence)) || (
    Array.isArray(payload.changed)
    && payload.changed.some((reference) => isExplicitEvidenceReference(reference, evidence))
  );
}

function decisionForIdentity(log, identity, taskId = null) {
  return log.entries.findLast((entry) => (
    entry.taskId === taskId
    &&
    entry.outcome instanceof NonBlockingDecisionOutcome
    && NonBlockingDecisionIdentity.fromOutcome(entry.outcome).equals(identity)
  )) || null;
}

function uniquelyAddressableDecision(log, state, evidenceDigest) {
  const candidates = log.entries.filter((entry) => (
    entry.runId === state.runId
    && entry.outcome instanceof NonBlockingDecisionOutcome
    && entry.outcome.evidenceDigest === evidenceDigest
  ));
  if (candidates.length !== 1) return null;
  return candidates[0];
}

function latestRecoveryDecision(log, state, step, taskId = null) {
  return log.entries.findLast((entry) => (
    entry.runId === state.runId
    && entry.taskId === taskId
    && entry.stepId === step
    && entry.outcome instanceof NonBlockingDecisionOutcome
    && ["repair", "retry"].includes(entry.outcome.action)
  )) || null;
}

function allowedActionsFor(resultKind) {
  return resultKind === "quality" ? ["repair", "continue"] : ["retry", "continue"];
}

function mark(state, id, status, taskId = null) {
  const scope = taskId == null
    ? state
    : state.tasks?.find((task) => task.id === taskId);
  const step = findStepById(scope?.steps || [], id);
  if (!step) throw new Error(`flow step is missing: ${id}`);
  step.status = status;
}

/**
 * Normalize a state written before the acceptance route consumed its explicit
 * user-decision leaf. The matching durable nonblocking decision is the only
 * authority that may close this leaf; no acceptance artifact is rewritten.
 */
export function reconcileNonblockingAcceptanceContinuation(root, state) {
  if (!root || state?.nonblocking?.enabled !== true || state.directFlowSession) return false;
  const acceptanceReview = findStepById(state.steps || [], "acceptance-review");
  const acceptanceDecision = findStepById(state.steps || [], "acceptance-decision");
  if (
    acceptanceReview?.status !== "done"
    || !["pending", "in_progress"].includes(acceptanceDecision?.status)
  ) return false;
  let evidence;
  try {
    evidence = evidenceForStep(root, state, "acceptance-review");
  } catch {
    return false;
  }
  if (!evidence) return false;
  const log = new StepAttemptLog(state.stepAttempts || []);
  const continuation = log.entries.findLast((entry) => (
    entry.runId === state.runId
    && entry.taskId === null
    && entry.stepId === "acceptance-review"
    && entry.outcome instanceof NonBlockingDecisionOutcome
    && entry.outcome.action === "continue"
    && hasSameEvidence(entry.outcome, {
      sourceStep: "acceptance-review",
      evidenceRef: evidence.ref,
      evidenceDigest: evidence.evidenceDigest,
    })
  ));
  if (!continuation) return false;
  mark(state, "acceptance-decision", "done");
  return true;
}

function decisionIssueLogId(identity, taskId = null) {
  // Task steps reuse the same step IDs and may even produce identical
  // artifact bytes. Scope the immutable decision key so a completed task
  // cannot suppress an independently required decision for another task.
  return `nonblocking-decision-${sha256(JSON.stringify({ taskId, identity: identity.toJSON() }))}`;
}

function issueLogEntry(outcome, taskId = null) {
  return {
    step: outcome.sourceStep,
    taskId,
    reason: `Nonblocking ${outcome.action} decision: ${outcome.rationale}`,
    trigger: "flow set nonblocking-decision",
    resolution: outcome.action === "continue"
      ? `continue from ${outcome.sourceStep} through the acceptance-backed route`
      : `${outcome.action} and rerun ${outcome.sourceStep}`,
    evidenceRef: outcome.evidenceRef,
    evidenceDigest: outcome.evidenceDigest,
    ...(outcome.remainingRisk != null && { remainingRisk: outcome.remainingRisk }),
    timestamp: new Date().toISOString(),
  };
}

function withOperationLock(root, callback) {
  const operation = new RepositoryFlowOperationLock({
    mainRoot: resolveRepositoryLockRoot(root),
  });
  const token = operation.acquire();
  let primary = null;
  let result;
  try {
    result = callback(token);
  } catch (error) {
    primary = error;
  }
  let releaseError = null;
  try {
    operation.release();
  } catch (error) {
    releaseError = error;
  }
  if (primary && releaseError) {
    throw new AggregateError([primary, releaseError], "nonblocking operation and lock release both failed", { cause: primary });
  }
  if (primary) throw primary;
  if (releaseError) throw releaseError;
  return result;
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

export class NonBlockingDecisionIdentity {
  constructor({ sourceStep, sourceAttempt, evidenceRef, evidenceDigest }) {
    this.sourceStep = assertSupportedStep(text(sourceStep, "sourceStep"));
    if (!Number.isSafeInteger(sourceAttempt) || sourceAttempt < 1) throw new Error("sourceAttempt must be a positive integer");
    this.sourceAttempt = sourceAttempt;
    this.evidenceRef = text(evidenceRef, "evidenceRef");
    if (!/^[a-f0-9]{64}$/.test(evidenceDigest)) throw new Error("evidenceDigest must be SHA-256");
    this.evidenceDigest = evidenceDigest;
    Object.freeze(this);
  }

  static fromOutcome(outcome) {
    return new NonBlockingDecisionIdentity(outcome);
  }

  equals(other) {
    const value = other instanceof NonBlockingDecisionIdentity
      ? other
      : new NonBlockingDecisionIdentity(other);
    return this.sourceStep === value.sourceStep
      && this.sourceAttempt === value.sourceAttempt
      && this.evidenceRef === value.evidenceRef
      && this.evidenceDigest === value.evidenceDigest;
  }

  key() {
    return JSON.stringify(this.toJSON());
  }

  toJSON() {
    return {
      sourceStep: this.sourceStep,
      sourceAttempt: this.sourceAttempt,
      evidenceRef: this.evidenceRef,
      evidenceDigest: this.evidenceDigest,
    };
  }
}

export class NonBlockingRecoveryState {
  constructor({ status = "fresh", decision = null } = {}) {
    if (!["fresh", "awaiting-result", "consumed"].includes(status)) {
      throw new Error("invalid nonblocking recovery status");
    }
    if (decision != null && !(decision instanceof NonBlockingDecisionOutcome)) {
      throw new Error("nonblocking recovery decision must be a NonBlockingDecisionOutcome");
    }
    if ((status === "fresh") !== (decision == null)) {
      throw new Error("fresh nonblocking recovery state cannot include a decision");
    }
    if (decision && !["repair", "retry"].includes(decision.action)) {
      throw new Error("nonblocking recovery state requires repair or retry decision");
    }
    this.status = status;
    this.decision = decision;
    Object.freeze(this);
  }

  toJSON() {
    return {
      status: this.status,
      ...(this.decision && { decision: this.decision.toJSON() }),
    };
  }
}

export class NonBlockingDecisionContext {
  constructor({ sourceStep, sourceAttempt, evidenceRef, evidenceDigest, taskId = null, resultKind, recoveryState = new NonBlockingRecoveryState(), allowedActions }) {
    const identity = new NonBlockingDecisionIdentity({ sourceStep, sourceAttempt, evidenceRef, evidenceDigest });
    this.sourceStep = identity.sourceStep;
    this.sourceAttempt = identity.sourceAttempt;
    this.evidenceRef = identity.evidenceRef;
    this.evidenceDigest = identity.evidenceDigest;
    if (taskId != null) text(taskId, "taskId");
    this.taskId = taskId;
    if (!RESULT_KINDS.includes(resultKind)) throw new Error("invalid nonblocking resultKind");
    if (!Array.isArray(allowedActions) || allowedActions.some((action) => !ACTIONS.includes(action))) {
      throw new Error("invalid nonblocking allowedActions");
    }
    if (new Set(allowedActions).size !== allowedActions.length) throw new Error("nonblocking allowedActions must not contain duplicates");
    this.resultKind = resultKind;
    this.recoveryState = recoveryState instanceof NonBlockingRecoveryState
      ? recoveryState
      : new NonBlockingRecoveryState(recoveryState);
    this.allowedActions = Object.freeze([...allowedActions]);
    Object.freeze(this);
  }

  identity() {
    return new NonBlockingDecisionIdentity(this);
  }

  toJSON() {
    return {
      ...this.identity().toJSON(),
      taskId: this.taskId,
      resultKind: this.resultKind,
      recoveryState: this.recoveryState.toJSON(),
      allowedActions: this.allowedActions,
    };
  }
}

export class NonBlockingActivationOffer {
  constructor({ sourceStep, resultKind, blocker }) {
    this.sourceStep = assertSupportedStep(sourceStep);
    if (!RESULT_KINDS.includes(resultKind)) throw new Error("invalid nonblocking activation resultKind");
    this.resultKind = resultKind;
    this.blocker = text(blocker, "nonblocking activation blocker");
    this.prompt = new UserActionPrompt({
      question: "Strict recovery is exhausted for an eligible acceptance-backed check. Continue with advisory handling?",
      choices: [
        new UserActionChoice({
          actionId: "KEEP_STRICT_FLOW",
          label: "Keep strict recovery",
          stateTransition: "retain-strict-flow-block",
          impact: new UserActionImpact({ retains: ["strict quality gate"] }),
          reason: this.blocker,
        }),
        new UserActionChoice({
          actionId: "ENABLE_NONBLOCKING",
          label: "Enable advisory continuation",
          stateTransition: "activate-nonblocking-policy",
          impact: new UserActionImpact({ changes: ["eligible non-pass handling with acceptance disposition"] }),
          reason: "Normal Flow ownership and finalization remain unchanged.",
        }),
      ],
      recommendedActionId: "KEEP_STRICT_FLOW",
      recommendationReason: "Keeping strict recovery preserves the original quality gate unless advisory continuation is explicitly needed.",
    });
    Object.freeze(this);
  }

  toJSON() {
    return {
      sourceStep: this.sourceStep,
      resultKind: this.resultKind,
      blocker: this.blocker,
      actionPrompt: this.prompt.toJSON(),
    };
  }
}

export class NonBlockingRouteOwnershipError extends Error {
  constructor(message, state) {
    super(message);
    this.code = "NONBLOCKING_ROUTE_OWNED";
    this.continuation = continuationFor(
      state,
      "CONTINUE_CURRENT_FLOW_OWNER",
      "Refresh the guarded next action for the Flow route that is already durable.",
      message,
    ).toJSON();
  }
}

export class NonBlockingDecisionConflictError extends Error {
  constructor(existing, state) {
    super("a different nonblocking decision already exists for this evidence");
    this.code = "NONBLOCKING_DECISION_CONFLICT";
    this.existingDecision = existing.toJSON();
    this.continuation = continuationFor(
      state,
      "REFRESH_NONBLOCKING_DECISION",
      "Refresh the guarded next action before making another advisory decision.",
      "The evidence already has a durable advisory decision.",
    ).toJSON();
  }
}

export class NonBlockingEvidenceError extends Error {
  constructor({ code, message, state, cause = undefined, continuation = true }) {
    super(message, cause === undefined ? undefined : { cause });
    this.code = code;
    if (continuation) {
      this.continuation = continuationFor(
        state,
        "RECOVER_NONBLOCKING_EVIDENCE",
        "Recover or regenerate the authoritative check evidence, then refresh the guarded next action.",
        message,
      ).toJSON();
    }
  }
}

function staleEvidenceError(state, context = null) {
  const error = new Error("nonblocking evidence changed; refresh the guarded next action");
  error.code = "NONBLOCKING_STALE_EVIDENCE";
  error.context = context?.toJSON?.() || null;
  error.continuation = continuationFor(
    state,
    "REFRESH_NONBLOCKING_EVIDENCE",
    "Refresh the guarded next action and use its latest evidence digest.",
    "The evidence digest changed before the advisory decision could be recorded.",
  ).toJSON();
  return error;
}

function contextForState(root, state) {
  const node = activeNode(state);
  const step = assertSupportedStep(node?.stepId);
  const taskId = node?.taskId ?? null;
  let evidence;
  try {
    evidence = evidenceForStep(root, state, step);
  } catch (error) {
    throw new NonBlockingEvidenceError({
      code: "NONBLOCKING_EVIDENCE_UNAVAILABLE",
      message: `authoritative nonblocking evidence for ${step} cannot be read: ${error.message}`,
      state,
      cause: error,
    });
  }
  if (!evidence) {
    throw new NonBlockingEvidenceError({
      code: "NONBLOCKING_NO_ELIGIBLE_EVIDENCE",
      message: `no eligible non-pass evidence is available for ${step}`,
      state,
      continuation: false,
    });
  }
  const log = new StepAttemptLog(state.stepAttempts || []);
  const observed = latestObservedEvidence(log, state, {
    sourceStep: step,
    evidenceRef: evidence.ref,
    evidenceDigest: evidence.evidenceDigest,
  }, taskId);
  if (!observed) {
    throw new NonBlockingEvidenceError({
      code: "NONBLOCKING_EVIDENCE_NOT_RECORDED",
      message: `eligible evidence for ${step} has not been durably recorded`,
      state,
    });
  }
  const identity = new NonBlockingDecisionIdentity({
    sourceStep: step,
    sourceAttempt: observed.attempt,
    evidenceRef: evidence.ref,
    evidenceDigest: evidence.evidenceDigest,
  });
  const recovery = latestRecoveryDecision(log, state, step, taskId);
  if (!recovery) {
    return new NonBlockingDecisionContext({
      ...identity.toJSON(),
      taskId,
      resultKind: evidence.resultKind,
      recoveryState: new NonBlockingRecoveryState(),
      allowedActions: allowedActionsFor(evidence.resultKind),
    });
  }
  const recoveryOutcome = recovery.outcome;
  if (recoveryOutcome.sourceAttempt > identity.sourceAttempt) {
    throw new Error("nonblocking recovery evidence is older than its durable decision");
  }
  if (recoveryOutcome.sourceAttempt === identity.sourceAttempt) {
    return new NonBlockingDecisionContext({
      ...identity.toJSON(),
      taskId,
      resultKind: evidence.resultKind,
      recoveryState: new NonBlockingRecoveryState({ status: "awaiting-result", decision: recoveryOutcome }),
      allowedActions: [],
    });
  }
  return new NonBlockingDecisionContext({
    ...identity.toJSON(),
    taskId,
    resultKind: evidence.resultKind,
    recoveryState: new NonBlockingRecoveryState({ status: "consumed", decision: recoveryOutcome }),
    allowedActions: ["continue"],
  });
}

export function decisionContextForActiveFlow(root, state) {
  return contextForState(root, state);
}

/**
 * Returns an explicit opt-in only after the normal directive has reached a
 * strict stop. This keeps advisory handling out of ordinary retry and repair
 * paths, and prevents it from becoming another automatic recovery route.
 */
export function nonblockingActivationOfferForStrictStop(root, state, directive) {
  if (state?.nonblocking?.enabled === true || directive?.kind !== "blocked") return null;
  let step;
  try {
    step = activationStep(root, state);
  } catch {
    return null;
  }
  let evidence;
  try {
    evidence = evidenceForStep(root, state, step);
  } catch {
    return null;
  }
  if (!evidence) return null;
  return new NonBlockingActivationOffer({
    sourceStep: step,
    resultKind: evidence.resultKind,
    blocker: directive.reason,
  });
}

/**
 * Persist a newly completed eligible check without changing its artifact.
 * `hydrate` is used only when policy is first enabled for an already-written
 * strict result; repeated activation must not invent another check attempt.
 */
export function recordEligibleNonblockingAttempt(ctx, stepId, result = null, { hydrate = false } = {}) {
  if (!ctx?.root || typeof ctx?.flowManager?.mutate !== "function") return null;
  assertSupportedStep(stepId);
  let record = null;
  ctx.flowManager.mutate((current) => {
    const node = activeNode(current);
    if (!current.nonblocking?.enabled || !current.runId || node?.stepId !== stepId) return;
    const taskId = node.taskId ?? null;
    const evidence = evidenceForStep(ctx.root, current, stepId);
    if (!evidence) return;
    const log = new StepAttemptLog(current.stepAttempts || []);
    if (hydrate) {
      const existing = latestObservedEvidence(log, current, {
        sourceStep: stepId,
        evidenceRef: evidence.ref,
        evidenceDigest: evidence.evidenceDigest,
      }, taskId);
      if (existing) {
        record = existing;
        return;
      }
    }
    const recordedAttempt = sourceAttemptFromResult(result, current, stepId, taskId);
    // A StepAttempt proves only that a command reached a flow boundary. It
    // does not prove which artifact the command wrote.  A new observation is
    // therefore valid only when the command explicitly names the current
    // authoritative artifact. Hydration is the sole exception: it indexes
    // the strict result present at the moment policy is first activated.
    if (!hydrate && !resultReferencesEvidence(result, evidence)) return;
    const sourceAttempt = recordedAttempt
      || (hydrate && latestSourceAttempt(log, current, stepId, taskId))
      || nextStepAttemptNumber(current, stepId);
    record = new StepAttempt({
      runId: current.runId,
      taskId,
      stepId,
      attempt: sourceAttempt,
      outcome: new ObservedNonPassOutcome({
        sourceStep: stepId,
        evidenceRef: evidence.ref,
        evidenceDigest: evidence.evidenceDigest,
        resultKind: evidence.resultKind,
      }),
    });
    log.record(record);
    current.stepAttempts = log.toJSON();
  });
  if (record && result && typeof result === "object") {
    result.stepAttempt = record.toJSON();
    result.artifacts = {
      ...(result.artifacts || {}),
      stepOutcome: record.outcome.toJSON(),
    };
  }
  return record;
}

export function activateNonBlockingPolicy({ root, flowManager, reason }) {
  const state = flowManager.load();
  if (state?.nonblocking) {
    if (state.directFlowSession) {
      throw new NonBlockingRouteOwnershipError("a direct session already owns this Flow route", state);
    }
    return NonBlockingPolicy.fromStored(state.nonblocking).toJSON();
  }
  const step = activationStep(root, state);
  const policy = new NonBlockingPolicy({ activatedStep: step, reason });
  let activated = false;
  let durablePolicy = policy;
  withOperationLock(root, (operationOwnerToken) => {
    flowManager.mutate((current) => {
      if (current.directFlowSession) {
        throw new NonBlockingRouteOwnershipError("a direct session became durable before nonblocking activation", current);
      }
      if (current.nonblocking) {
        durablePolicy = NonBlockingPolicy.fromStored(current.nonblocking);
        return;
      }
      if (activeStep(current) !== step) throw staleEvidenceError(current);
      current.nonblocking = policy.toJSON();
      durablePolicy = policy;
      activated = true;
    }, { operationOwnerToken });
  });
  // This merely indexes an already-authoritative artifact in StepAttemptLog.
  // It is intentionally outside the policy write so a failed artifact/state
  // write cannot be mistaken for a successful advisory decision.
  if (activated) {
    try {
      recordEligibleNonblockingAttempt({ root, flowManager, flowState: flowManager.load() }, step, null, { hydrate: true });
    } catch (error) {
      // Activation already verified the artifact. Only a concurrent removal
      // between the policy write and this indexing pass is recoverable; all
      // other evidence failures remain strict-flow blockers.
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return durablePolicy.toJSON();
}

function assertDecisionChoice(context, choice) {
  if (!ACTIONS.includes(choice)) throw new Error("invalid nonblocking choice");
  if (!context.allowedActions.includes(choice)) {
    if (context.recoveryState.status === "awaiting-result") {
      throw new Error("nonblocking recovery must save a subsequent check result before another decision");
    }
    throw new Error(`nonblocking choice ${choice} is not allowed for ${context.resultKind} evidence`);
  }
}

function outcomeFor({ context, choice, reason, remainingRisk }) {
  const route = nonblockingRouteFor(context.sourceStep);
  const nextAction = choice === "continue"
    ? route.continueAction
    : `run-${context.sourceStep}`;
  return new NonBlockingDecisionOutcome({
    action: choice,
    ...context.identity().toJSON(),
    rationale: text(reason, "reason"),
    remainingRisk: remainingRisk == null ? null : text(remainingRisk, "remainingRisk"),
    nextAction,
  });
}

function materializeAcceptanceHandoff({ root, flowState, context }) {
  const route = nonblockingRouteFor(context.sourceStep);
  if (route.kind === "review") {
    const deferred = materializeReviewRetryExhaustionDeferral({
      root,
      flowState,
      phase: route.phase,
      attempts: context.sourceAttempt,
      sourceStep: context.sourceStep,
    });
    if (deferred) return deferred;
  }
  if (route.kind === "gate") {
    const deferred = materializeGateRetryExhaustionDeferral({
      root,
      flowState,
      phase: route.phase,
      attempts: context.sourceAttempt,
      sourceStep: context.sourceStep,
    });
    if (deferred) return deferred;
  }
  if (route.kind === "acceptance" || route.kind === "regression") return null;
  return materializeNonblockingAcceptanceHandoff({
    root,
    flowState,
    sourceStep: context.sourceStep,
    evidenceRef: context.evidenceRef,
    evidenceDigest: context.evidenceDigest,
    resultKind: context.resultKind,
    attempts: context.sourceAttempt,
  });
}

function advanceContinuation(state, context) {
  const route = nonblockingRouteFor(context.sourceStep);
  const node = activeNode(state);
  if (!node || node.stepId !== route.sourceStep || node.taskId !== context.taskId) {
    throw staleEvidenceError(state, context);
  }
  if (route.sourceStep === "task-gate") {
    completeTaskInState(state, context.taskId);
    promoteNextTaskInState(state);
    return;
  }
  mark(state, route.sourceStep, "done", context.taskId);
  for (const stepId of route.skippedSteps) mark(state, stepId, "done", context.taskId);
  if (route.targetStep) mark(state, route.targetStep, "in_progress", context.taskId);
}

export function recordNonBlockingDecision({
  root,
  flowManager,
  choice,
  reason,
  expectEvidenceDigest,
  remainingRisk = null,
  issueLogStoreFactory = (options) => new IssueLogStore(options),
}) {
  const initial = flowManager.load();
  if (!initial?.nonblocking?.enabled) throw new Error("nonblocking policy is not enabled");
  let context;
  try {
    context = contextForState(root, initial);
  } catch (error) {
    // A successful `continue` advances the active step, so the original
    // artifact is no longer current.  The command still has to be safely
    // idempotent.  Only a single durable decision for the supplied digest is
    // addressable here; ambiguity remains a blocking refresh, never a
    // digest-only choice between different identities.
    const existing = uniquelyAddressableDecision(
      new StepAttemptLog(initial.stepAttempts || []),
      initial,
      expectEvidenceDigest,
    );
    if (!existing) throw error;
    if (existing.outcome.action !== choice) throw new NonBlockingDecisionConflictError(existing.outcome, initial);
    return existing.outcome.toJSON();
  }
  if (expectEvidenceDigest !== context.evidenceDigest) throw staleEvidenceError(initial, context);
  const identity = context.identity();
  const initialLog = new StepAttemptLog(initial.stepAttempts || []);
  const existing = decisionForIdentity(initialLog, identity, context.taskId);
  if (existing) {
    if (existing.outcome.action !== choice) throw new NonBlockingDecisionConflictError(existing.outcome, initial);
    return existing.outcome.toJSON();
  }
  assertDecisionChoice(context, choice);
  const outcome = outcomeFor({ context, choice, reason, remainingRisk });
  const issueLogId = decisionIssueLogId(identity, context.taskId);

  return withOperationLock(root, (operationOwnerToken) => {
    const issueLog = issueLogStoreFactory({
      root,
      spec: initial.spec,
      mainRoot: resolveRepositoryLockRoot(root),
      operationOwnerToken,
    });
    const appended = issueLog.append(issueLogEntry(outcome, context.taskId), issueLogId);
    let durableOutcome = null;
    try {
      flowManager.mutate((current) => {
        if (!current.nonblocking?.enabled) throw new NonBlockingRouteOwnershipError("nonblocking policy is no longer the Flow owner", current);
        if (current.directFlowSession) throw new NonBlockingRouteOwnershipError("a direct session owns this Flow route", current);
        const currentContext = contextForState(root, current);
        if (expectEvidenceDigest !== currentContext.evidenceDigest || !currentContext.identity().equals(identity)) {
          throw staleEvidenceError(current, currentContext);
        }
        const log = new StepAttemptLog(current.stepAttempts || []);
        const currentExisting = decisionForIdentity(log, identity, currentContext.taskId);
        if (currentExisting) {
          if (currentExisting.outcome.action !== choice) {
            throw new NonBlockingDecisionConflictError(currentExisting.outcome, current);
          }
          durableOutcome = currentExisting.outcome;
          return;
        }
        assertDecisionChoice(currentContext, choice);
        log.record(new StepAttempt({
          runId: current.runId,
          taskId: currentContext.taskId,
          stepId: currentContext.sourceStep,
          attempt: currentContext.sourceAttempt,
          outcome,
        }));
        current.stepAttempts = log.toJSON();
        if (choice === "continue") {
          materializeAcceptanceHandoff({ root, flowState: current, context: currentContext });
          advanceContinuation(current, currentContext);
        }
        durableOutcome = outcome;
      }, { operationOwnerToken });
    } catch (error) {
      if (appended.appended) {
        try {
          issueLog.compensate(issueLogId);
        } catch (compensationError) {
          throw new AggregateError(
            [error, compensationError],
            "nonblocking decision state write and issue-log compensation both failed",
            { cause: error },
          );
        }
      }
      throw error;
    }
    return durableOutcome.toJSON();
  });
}

export function advisorySummary(state) {
  const log = new StepAttemptLog(state?.stepAttempts || []);
  return log.entries
    .filter((entry) => entry.outcome instanceof NonBlockingDecisionOutcome && entry.outcome.action === "continue")
    .map((entry) => ({
      stepId: entry.outcome.sourceStep,
      evidenceRef: entry.outcome.evidenceRef,
      rationale: entry.outcome.rationale,
      remainingRisk: entry.outcome.remainingRisk,
    }));
}
