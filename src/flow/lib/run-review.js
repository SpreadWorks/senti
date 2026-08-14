/**
 * src/flow/lib/run-review.js
 *
 * FlowCommand: review — wraps `flow commands/review.js` for AI code quality review.
 * Runs review as a subprocess and parses its output.
 */

import { PKG_DIR } from "../../lib/cli.js";
import { runCmd } from "../../lib/process.js";
import { VALID_REVIEW_PHASES } from "../../lib/constants.js";
import { AgentTimeout } from "../../lib/agent-timeout.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import {
  flowLeafIdsBetween,
  resolveMaxAttempts,
  resetImplEvidenceAfterReviewProposals as resetImplEvidenceStateAfterReviewProposals,
} from "../definition.js";
import { flattenSteps } from "./step-tree.js";
import path from "path";
import fs from "fs";
import crypto from "node:crypto";
import { runGit } from "../../lib/git-helpers.js";
import { PRODUCT } from "../../lib/product.js";
import {
  REVIEW_FAILURE_MARKER_PREFIX,
  ReviewFailure,
} from "./review-failure.js";
import { resolveRecoveryMaxAttempts } from "./retry-recovery.js";
import {
  assertAuditedBroadMode,
  resolveImplReviewScope,
  resolveCurrentTaskSpec,
  taskScopeViolationMessages,
} from "./task-scope.js";
import { draftReviewRouteForRetryPhase } from "./draft-review-routes.js";
import { normalizeDraftReviewArtifactDocument } from "./draft-review-artifacts.js";
import {
  deferExhaustedSemanticFindings,
  readBoundedSourceArtifact,
  FLOW_FINDINGS_LOGICAL_KEY,
} from "./flow-findings.js";
import {
  DecisionOutcome,
  DeferOutcome,
  ExternalBlockedOutcome,
  RetryOutcome,
  nextStepAttemptNumber,
  recordStepAttempt,
} from "./step-outcome.js";
import { createLifecycleStepTransition } from "./lifecycle-step-transition.js";
import {
  ReviewConvergenceState,
  ReviewConvergenceStore,
  ReviewDisposition,
  ReviewEvidence,
  ReviewEvidenceReference,
  ReviewToolingOutcome,
  artifactPhaseMatchesReviewTarget,
  buildReviewHandoffFindings,
  nextReviewToolingOutcome,
  resolveReviewPermittedOperation,
} from "./review-convergence.js";
import { resolveCurrentReviewTreeSha as resolveReviewTargetTreeSha } from "./review-evidence-store.js";
import { FLOW_REVIEW_ROUTES } from "./review-route.js";
import { ReviewTargetAuthority } from "./review-target-authority.js";
import {
  DRAFT_ARTIFACT_FAILURE_MARKER_PREFIX,
  DraftArtifactRecoveryError,
} from "./draft-artifact-promotion.js";
import {
  CanonicalReviewPromotion,
  CanonicalReviewWorkUnit,
  canonicalReviewNodeId,
} from "./canonical-review-artifacts.js";
import { isCanonicalFlowState } from "./canonical-test-artifacts.js";

const IMPL_REVIEW_PHASE = "impl";
const DEFAULT_DRAFT_REVIEW_ROUTE_RETRY_PHASE = "draft-questions";
const REVIEW_VERDICT_VALUES = Object.freeze(["PASS", "ADVISORY", "REJECTED"]);
const REVIEW_VERDICTS = new Set(REVIEW_VERDICT_VALUES);
const REVIEW_VERDICT_PATTERN = new RegExp(`verdict=(${REVIEW_VERDICT_VALUES.join("|")})`);
const REVIEW_TOOLING_OUTCOME_PATTERN = /outcome=TOOLING_ERROR/;
const REVIEW_RECOVERY_TRIGGER_RETRY_EXHAUSTED = "review-retry-exhausted";
const REVIEW_RECOVERY_TRIGGER_VERDICT_REJECTED = "review-verdict-rejected";
const REVIEW_FINDING_DISPOSITIONS = new Set(["must-fix", "informational", "deferred"]);
const MAX_IMPL_DOWNSTREAM_RESET_STEPS = 20;
// Review proposals invalidate all implementation leaves from fresh test
// execution through finalize cleanup; both endpoints are intentionally reset.
const IMPL_REVIEW_DOWNSTREAM_STEP_IDS = flowLeafIdsBetween("test-execute", "finalize-cleanup");
if (IMPL_REVIEW_DOWNSTREAM_STEP_IDS.length > MAX_IMPL_DOWNSTREAM_RESET_STEPS) {
  throw new Error(`impl downstream reset leaf count exceeds max ${MAX_IMPL_DOWNSTREAM_RESET_STEPS}`);
}

// ---------------------------------------------------------------------------
// Review retry counter (spec 253: enforce review maxAttempts on the CLI side)
// ---------------------------------------------------------------------------

const REVIEW_NODE_ID_BY_PHASE = Object.freeze(Object.fromEntries(
  FLOW_REVIEW_ROUTES.map((route) => [route.phase, route.reviewStepId]),
));

const REVIEW_PHASE_KEYS = Object.freeze(Object.keys(REVIEW_NODE_ID_BY_PHASE));
const REVIEW_SOURCE_ARTIFACT_BY_PHASE = Object.freeze(Object.fromEntries(
  FLOW_REVIEW_ROUTES.map((route) => [route.phase, {
    "draft-questions-review": "draft.questions.review",
    "draft-coverage-review": "draft.coverage.review",
    "spec-review": "spec.review",
    "test-review": "test.review",
    "impl-review": "impl.review",
  }[route.reviewStepId]]),
));

function persistedPhaseKey(ctxPhase) {
  return ctxPhase == null ? IMPL_REVIEW_PHASE : ctxPhase;
}

function isImplementationReviewPhase(phase) {
  return phase == null || phase === IMPL_REVIEW_PHASE;
}

function taskCursorRequiredReviewFailure(decision, state) {
  return Envelope.fail(
    "run",
    "review",
    "TASK_CURSOR_REQUIRED",
    taskScopeViolationMessages(decision, "impl-review"),
    { currentTaskId: state?.currentTaskId ?? null },
  );
}

function invalidReviewScopeFailure(decision, state) {
  return Envelope.fail(
    "run",
    "review",
    "REVIEW_SCOPE_INVALID",
    [`implementation review scope is invalid: ${decision.reason}`],
    {
      currentTaskId: state?.currentTaskId ?? null,
      reason: decision.reason,
    },
  );
}

function reviewContextForTaskId(ctx, taskId) {
  return {
    ...ctx,
    flowState: {
      ...(ctx?.flowState || {}),
      currentTaskId: taskId,
    },
  };
}

function mutateReviewRecoveryState(ctx, phase, trigger, afterPersist) {
  void ctx;
  void phase;
  void trigger;
  void afterPersist;
  return false;
}

function resolveDraftReviewPhaseKey(flowState = {}) {
  const steps = Array.isArray(flowState.steps) ? flattenSteps(flowState.steps) : [];
  const byId = new Map(steps.map((step) => [step.id, step]));
  if (byId.get("draft-coverage-review")?.status === "in_progress") return "draft-coverage";
  if (byId.get("draft-questions-review")?.status === "in_progress") return "draft-questions";
  return "draft-questions";
}

function reviewPhaseKeyForCtx(ctx, phase) {
  if (phase !== "draft") return persistedPhaseKey(phase);
  return resolveDraftReviewPhaseKey(ctx?.flowState || {});
}

class ReviewCompletionScope {
  constructor({ phase, taskId = null } = {}) {
    if (!REVIEW_PHASE_KEYS.includes(phase)) {
      throw new Error(`invalid review completion phase: ${phase}`);
    }
    if (taskId != null && (typeof taskId !== "string" || taskId.trim() === "")) {
      throw new Error("review completion taskId must be null or a non-empty string");
    }
    this.phase = phase;
    this.taskId = taskId == null ? null : taskId.trim();
    Object.freeze(this);
  }

  static forExecution({ phase, scopeDecision = null } = {}) {
    return new ReviewCompletionScope({
      phase,
      taskId: phase === IMPL_REVIEW_PHASE && scopeDecision?.kind === "task"
        ? scopeDecision.task.id
        : null,
    });
  }

  static forPostHook({ result, phase } = {}) {
    const artifacts = result?.artifacts;
    if (
      phase === IMPL_REVIEW_PHASE
      && artifacts
      && Object.hasOwn(artifacts, "taskId")
    ) {
      return new ReviewCompletionScope({ phase, taskId: artifacts.taskId });
    }
    return new ReviewCompletionScope({ phase, taskId: null });
  }

  context(ctx) {
    return reviewContextForTaskId(ctx, this.taskId);
  }
}

/**
 * Replay a reset-aware reviewRetry counter for the given phase.
 * Only counts flow-scope entries (taskId == null) per R19.
 */
export function countReviewRetry(entries, phase) {
  if (!Array.isArray(entries)) return 0;
  let count = 0;
  for (const e of entries) {
    if (e.phase !== phase || e.counter !== "reviewRetry") continue;
    if (e.taskId != null) continue; // R19: task-scope leakage guard
    if (e.reset) count = 0;
    else count += e.delta ?? 1;
  }
  return count;
}

/**
 * Resolve review max attempts from FLOW_DEFINITION (flow scope only).
 * Throws on unknown phase — callers should catch via checkReviewRetryBelowMax.
 */
export function resolveReviewRetryMax(retryContext = {}, phase) {
  const nodeId = REVIEW_NODE_ID_BY_PHASE[phase];
  if (!nodeId) {
    const err = new Error(`unknown review phase: ${phase}`);
    err.code = "UNKNOWN_REVIEW_PHASE";
    throw err;
  }
  const flowState = retryContext.flowState || retryContext;
  return resolveMaxAttempts({ scope: "flow", stepId: nodeId, context: flowState }) ?? 5;
}

const REVIEW_STRUCTURED_MECHANICAL_FAILURE_MODES = new Set([
  "tooling_failure",
  "parser_error",
  "coverage_error",
  "schema_error",
  "invalid_schema",
  "command_failure",
  "failed_command",
  "failed_test_evidence",
  "coverage_header_failure",
  "missing_header",
  "uncovered_requirement",
  "unknown_requirement_id",
  "malformed_header",
  "duplicate_requirement_id",
  "duplicate_header",
  "not_testable_in_header",
  "wrong_header_marker",
  "header_without_test_name",
  "test_name_without_header",
  "no_progress_guard",
  "flow_corruption",
  "malformed_artifact",
]);

function normalizeFindingMode(value) {
  return String(value || "").toLowerCase().replace(/[-\s]+/g, "_");
}

function isStructuredReviewMechanicalFinding(finding) {
  const origin = normalizeFindingMode(finding?.origin);
  const failureKind = normalizeFindingMode(finding?.failureKind);
  const failureMode = normalizeFindingMode(finding?.failureMode);
  return origin === "test_coverage"
    || REVIEW_STRUCTURED_MECHANICAL_FAILURE_MODES.has(failureKind)
    || REVIEW_STRUCTURED_MECHANICAL_FAILURE_MODES.has(failureMode);
}

function isReviewSemanticFinding(finding) {
  return !isStructuredReviewMechanicalFinding(finding);
}

function reviewFindingsFromArtifact(artifact) {
  const candidates = [
    artifact?.blocking,
    artifact?.blockingFindings,
    artifact?.findings,
    artifact?.comments,
    artifact?.proposals,
    artifact?.advisoryFindings,
  ];
  return candidates.find(Array.isArray) || [];
}

function reviewFindingId(finding, index) {
  return finding?.findingId || finding?.id || finding?.proposalId || `review-finding-${index + 1}`;
}

function assertDispositionedReviewFinding(finding, index) {
  const label = `finding[${index}]`;
  const disposition = String(finding?.disposition || "").trim();
  if (!REVIEW_FINDING_DISPOSITIONS.has(disposition)) {
    throw new Error(`${label}.disposition is required and must be must-fix, informational, or deferred`);
  }
  if (typeof finding?.rationale !== "string" || finding.rationale.trim() === "") {
    throw new Error(`${label}.rationale must be a non-empty string`);
  }
  if (typeof finding?.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(finding.fingerprint)) {
    throw new Error(`${label}.fingerprint must be a lowercase SHA-256 string`);
  }
  return finding;
}

function reviewDeferredResult(phase, attempts, findingCount) {
  return {
    result: "deferred",
    changed: [FLOW_FINDINGS_LOGICAL_KEY],
    artifacts: {
      phase,
      verdict: "DEFERRED",
      deferred: true,
      retryExhausted: true,
      attempts,
      findingCount,
      completionKind: "deferred",
    },
    next: null,
  };
}

function reviewStepId(ctx, phase) {
  if (phase === IMPL_REVIEW_PHASE && ctx?.flowState?.currentTaskId != null) return "task-review";
  return REVIEW_NODE_ID_BY_PHASE[phase] || "impl-review";
}

function reviewRetryAction(phase) {
  return phase === "impl" ? "run-review" : `run-review-${phase}`;
}

function recordReviewOutcome(ctx, result, phase, attempt, outcome) {
  return recordStepAttempt(ctx, {
    stepId: reviewStepId(ctx, phase),
    attempt: Math.max(1, attempt),
    outcome,
    result,
  });
}

function nextReviewAttemptNumber(ctx, phase) {
  const flowState = ctx?.flowState || {};
  if (phase === IMPL_REVIEW_PHASE && flowState.currentTaskId != null) {
    return nextStepAttemptNumber(flowState, "task-review");
  }
  return countReviewRetry(flowState.metrics, phase) + 1;
}

function recordReviewDeferral(ctx, result, phase, attempts) {
  const outcome = new DeferOutcome({
    nextAction: "refresh-next-action",
    findingCount: result.artifacts.findingCount,
  });
  recordReviewOutcome(ctx, result, phase, attempts, outcome);
  return result;
}

function reviewExternalBlock(failure) {
  const instruction = [failure.recoveryHint, failure.recoveryCommand].filter(Boolean).join(" ")
    || "Resolve the external review failure, then retry the guarded next action.";
  return new ExternalBlockedOutcome({
    reason: failure.classification,
    resumeInstruction: instruction,
    failureCode: failure.toEnvelopeCode(),
    retryable: failure.retryable,
    recoveryHint: failure.recoveryHint || instruction,
  });
}

function reviewArtifactMatchesCanonicalTarget({
  artifact,
  flowState,
  phase,
  treeSha,
  targetStateDigest,
}) {
  if (
    artifact.treeSha === treeSha
    && artifact.targetStateDigest === targetStateDigest
  ) return true;
  if (
    Object.hasOwn(artifact, "treeSha")
    || Object.hasOwn(artifact, "targetStateDigest")
  ) return false;

  void flowState;
  void phase;
  return false;
}

function reviewRetryExhaustionDeferralPlan({
  flowManager,
  flowState,
  phase,
  treeSha = null,
  targetStateDigest = null,
}) {
  if (!flowManager || !flowState?.specId || flowState.schemaRevision !== 3) return null;
  const sourceArtifact = REVIEW_SOURCE_ARTIFACT_BY_PHASE[phase];
  if (!sourceArtifact) return null;
  const nodeId = REVIEW_NODE_ID_BY_PHASE[phase];
  const artifact = readBoundedSourceArtifact({
    flowManager,
    flowState,
    nodeId,
    sourceArtifact,
  });
  if (!artifact) return null;
  if (treeSha != null || targetStateDigest != null) {
    const currentTreeSha = treeSha;
    const currentTargetStateDigest = targetStateDigest;
    if (!reviewArtifactMatchesCanonicalTarget({
      artifact,
      flowState,
      phase,
      treeSha: currentTreeSha,
      targetStateDigest: currentTargetStateDigest,
    })) return null;
  }
  if (artifact.toolingOutcome) return null;
  if (phase === "test" && artifact.verdict !== "REJECTED") return null;
  if (phase === "test" && artifact.validation?.ok === false) return null;
  const findings = reviewFindingsFromArtifact(artifact);
  if (findings.length === 0 || !findings.every(isReviewSemanticFinding)) return null;
  const requireDisposition = phase === "test" || phase === "impl";
  if (requireDisposition) findings.forEach(assertDispositionedReviewFinding);
  const repairFindings = requireDisposition
    ? findings.filter((finding) => finding.disposition === "must-fix" || finding.disposition === "deferred")
    : findings;
  if (repairFindings.length === 0) return null;
  return {
    nodeId,
    sourceArtifact,
    artifact,
    findings,
    requireDisposition,
    repairFingerprints: requireDisposition
    ? new Set(repairFindings.map((finding) => finding.fingerprint))
    : null,
  };
}

export function canMaterializeReviewRetryExhaustionDeferral({ flowManager, flowState, phase } = {}) {
  try {
    return reviewRetryExhaustionDeferralPlan({ flowManager, flowState, phase }) !== null;
  } catch {
    return false;
  }
}

export function materializeReviewRetryExhaustionDeferral({
  flowManager,
  flowState,
  phase,
  attempts,
  sourceStep = null,
  treeSha = null,
  targetStateDigest = null,
} = {}) {
  const plan = reviewRetryExhaustionDeferralPlan({
    flowManager,
    flowState,
    phase,
    treeSha,
    targetStateDigest,
  });
  if (!plan) return null;
  const { sourceArtifact, artifact, repairFingerprints } = plan;
  deferExhaustedSemanticFindings({
    flowManager,
    flowState,
    nodeId: plan.nodeId,
    sourceStep: sourceStep || REVIEW_NODE_ID_BY_PHASE[phase] || "impl-review",
    sourceArtifact,
    attempts,
    ...(repairFingerprints && { fingerprints: repairFingerprints }),
  });
  return {
    findingCount: repairFingerprints ? repairFingerprints.size : reviewFindingsFromArtifact(artifact).length,
  };
}

function tryDeferReviewRetryExhaustion(
  ctx,
  phase,
  attempts,
  { treeSha = null, targetStateDigest = null } = {},
) {
  if (!ctx?.root || !ctx?.flowState?.specId || typeof ctx?.flowManager?.updateStepStatus !== "function") return null;
  const stepId = reviewStepId(ctx, phase);
  const taskId = phase === IMPL_REVIEW_PHASE
    ? ctx.flowState.currentTaskId ?? null
    : null;
  const deferred = materializeReviewRetryExhaustionDeferral({
    flowManager: ctx.flowManager,
    flowState: ctx.flowState,
    phase,
    attempts,
    sourceStep: stepId,
    treeSha,
    targetStateDigest,
  });
  if (!deferred) return null;
  const transition = createLifecycleStepTransition({
    flowState: ctx.flowState,
    stepId,
    status: "done",
    event: "review:defer",
    taskId,
  });
  if (transition) ctx.flowManager.updateStepStatus(transition, { taskId });
  return reviewDeferredResult(phase, attempts, deferred.findingCount);
}

/**
 * Pre-check called from RunReviewCommand.execute. Returns:
 *  - null when count < max (proceed)
 *  - Envelope.fail(REVIEW_MAX_ATTEMPTS_EXCEEDED) when count >= max
 *  - Envelope.fail(UNKNOWN_REVIEW_PHASE) when phase is not mapped
 */
export function checkReviewRetryBelowMax(
  ctx,
  phase,
  { treeSha = null, targetStateDigest = null, readOnly = false } = {},
) {
  const flowState = ctx?.flowState || {};
  const persistedPhase = reviewPhaseKeyForCtx(ctx, phase);
  const taskScoped = persistedPhase === IMPL_REVIEW_PHASE && flowState.currentTaskId != null;
  const stepId = taskScoped ? "task-review" : REVIEW_NODE_ID_BY_PHASE[persistedPhase];
  const legacyCount = taskScoped
    ? nextStepAttemptNumber(flowState, stepId) - 1
    : countReviewRetry(flowState.metrics, persistedPhase);
  void treeSha;
  void targetStateDigest;
  const count = legacyCount;
  let resolvedMax;
  try {
    resolvedMax = taskScoped
      ? resolveMaxAttempts({ scope: "task", stepId, context: flowState }) ?? 1
      : resolveReviewRetryMax({ flowState }, persistedPhase);
  } catch (err) {
    if (err.code === "UNKNOWN_REVIEW_PHASE") {
      return Envelope.fail("run", "review", "UNKNOWN_REVIEW_PHASE",
        [`unknown review phase: ${persistedPhase}`],
        { phase: persistedPhase });
    }
    throw err;
  }
  const max = taskScoped
    ? resolvedMax
    : resolveRecoveryMaxAttempts({
        root: ctx.root,
        flowState,
        kind: "review",
        phase: persistedPhase,
        attempts: count,
        resolvedMax,
      });
  if (count < max) return null;
  if (readOnly) {
    const failure = ReviewFailure.maxAttemptsExceeded({
      phase: persistedPhase,
      attempts: count,
      max,
    });
    return Envelope.fail(
      "run",
      "review",
      "REVIEW_MAX_ATTEMPTS_EXCEEDED",
      `review dry-run cannot mutate the exhausted ${persistedPhase} retry state`,
      { ...failure.toEnvelopeData(), dryRun: true },
    );
  }
  const deferred = tryDeferReviewRetryExhaustion(ctx, persistedPhase, count, {
    treeSha,
    targetStateDigest,
  });
  if (deferred) return recordReviewDeferral(ctx, deferred, persistedPhase, count);
  mutateReviewRecoveryState(ctx, persistedPhase, REVIEW_RECOVERY_TRIGGER_RETRY_EXHAUSTED);
  const failure = ReviewFailure.maxAttemptsExceeded({ phase: persistedPhase, attempts: count, max });
  const envelope = Envelope.fail("run", "review", "REVIEW_MAX_ATTEMPTS_EXCEEDED",
    [
      `review retry limit exhausted: ${count}/${max} REJECTED attempts recorded for phase "${persistedPhase}".`,
      "Resume after changed evidence with `sennel flow set retry reset review <phase> --reason <text> --yes`.",
    ],
    failure.toEnvelopeData());
  const attempt = recordReviewOutcome(ctx, null, persistedPhase, count, reviewExternalBlock(failure));
  if (attempt) envelope.data = { ...envelope.data, stepAttempt: attempt.toJSON() };
  return envelope;
}

function isImplPass(result) {
  if (!result) return false;
  if (result.result === "no-changes" || result.result === "no-proposals") return true;
  if (result.artifacts?.phase === "impl") {
    return result.artifacts.verdict === "PASS" || result.artifacts.verdict === "ADVISORY";
  }
  if ((result.artifacts?.proposalCount ?? -1) === 0) return true;
  return false;
}

/**
 * Post-hook helper: append a reviewRetry metric based on the result verdict.
 * Task- and flow-scoped attempts are recorded through the canonical Activity ledger.
 * Errors propagate to the dispatcher (R22 — do NOT swallow internally).
 */
export function updateReviewRetryCounter(ctx, result) {
  if (result?.result === "deferred" && result?.artifacts?.completionKind === "deferred") {
    return;
  }
  const persistedPhase = result?.artifacts?.retryPhase || reviewPhaseKeyForCtx(ctx, ctx?.phase);
  const completionScope = ReviewCompletionScope.forPostHook({
    result,
    phase: persistedPhase,
  });
  const resultTaskId = completionScope.taskId;
  const reviewCtx = completionScope.context(ctx);
  const flowState = reviewCtx.flowState;
  const targetIdentity = {
    treeSha: result?.artifacts?.treeSha ?? null,
    targetStateDigest: result?.artifacts?.targetStateDigest ?? null,
  };
  if (resultTaskId != null) {
    const stepId = reviewStepId(reviewCtx, IMPL_REVIEW_PHASE);
    const pass = isImplPass(result);
    const attempt = nextStepAttemptNumber(flowState, stepId);
    const maxAttempts = resolveMaxAttempts({ scope: "task", stepId, context: flowState }) ?? 1;
    if (!pass && attempt >= maxAttempts) {
      const deferred = tryDeferReviewRetryExhaustion(
        reviewCtx,
        IMPL_REVIEW_PHASE,
        attempt,
        targetIdentity,
      );
      if (deferred) {
        Object.assign(result, deferred);
        recordReviewDeferral(reviewCtx, result, IMPL_REVIEW_PHASE, attempt);
        return;
      }
    }
    const outcome = pass
      ? new DecisionOutcome({ decision: "PASS", nextAction: result?.next || "refresh-next-action" })
      : new RetryOutcome({ nextAction: "run-review-task" });
    recordReviewOutcome(reviewCtx, result, IMPL_REVIEW_PHASE, attempt, outcome);
    return;
  }
  if (!REVIEW_NODE_ID_BY_PHASE[persistedPhase]) return; // unmapped phase: no-op (post-hook should not crash)
  const mgr = reviewCtx.flowManager;
  if (!mgr) return;
  const attemptsBefore = countReviewRetry(flowState.metrics, persistedPhase);
  let isPass;
  if (persistedPhase === "impl") {
    if (result?.artifacts?.toolingOutcome || result?.result === "tooling-error") return;
    isPass = isImplPass(result);
  } else {
    if (result?.artifacts?.toolingOutcome) {
      const failure = ReviewFailure.subprocessFailure({
        phase: persistedPhase,
        stderr: result.artifacts.toolingOutcome.reason || "review tooling error",
      });
      recordReviewOutcome(reviewCtx, result, persistedPhase, attemptsBefore + 1, reviewExternalBlock(failure));
      return;
    }
    isPass = result?.artifacts?.verdict === "PASS"
      || result?.artifacts?.verdict === "ADVISORY";
  }
  const maxAttempts = resolveReviewRetryMax({ flowState }, persistedPhase);
  const payload = isPass
    ? { phase: persistedPhase, counter: "reviewRetry", delta: 0, reset: true }
    : { phase: persistedPhase, counter: "reviewRetry", delta: 1 };
  mgr.appendMetric(payload, { taskId: null }); // R19: explicit flow-scope
  if (!isPass && attemptsBefore + 1 >= maxAttempts) {
    const deferred = tryDeferReviewRetryExhaustion(
      reviewCtx,
      persistedPhase,
      attemptsBefore + 1,
      targetIdentity,
    );
    if (deferred) {
      Object.assign(result, deferred);
      recordReviewDeferral(reviewCtx, result, persistedPhase, attemptsBefore + 1);
    } else {
      mutateReviewRecoveryState(reviewCtx, persistedPhase, REVIEW_RECOVERY_TRIGGER_VERDICT_REJECTED);
      const failure = ReviewFailure.maxAttemptsExceeded({
        phase: persistedPhase,
        attempts: attemptsBefore + 1,
        max: maxAttempts,
      });
      recordReviewOutcome(reviewCtx, result, persistedPhase, attemptsBefore + 1, reviewExternalBlock(failure));
    }
    return;
  }
  const outcome = isPass || result?.next
    ? new DecisionOutcome({
        decision: result?.artifacts?.verdict || (isPass ? "PASS" : "REJECTED"),
        nextAction: result?.next || "refresh-next-action",
      })
    : new RetryOutcome({ nextAction: reviewRetryAction(persistedPhase) });
  recordReviewOutcome(reviewCtx, result, persistedPhase, attemptsBefore + 1, outcome);
}

export { REVIEW_PHASE_KEYS };

export function resetImplEvidenceAfterReviewProposals(ctx, result) {
  void ctx;
  void result;
  return false;
}

const PHASE_REVIEW_PARSERS = {
  test:  { countPattern: /blocking=(\d+)/,   countKey: "blockingCount",   countWord: "blocking finding(s)",   label: "Test review",  next: "implement",  commandId: "flow.test.review" },
  spec:  { countPattern: /proposalCount=(\d+)/, countKey: "proposalCount", countWord: "proposal(s)", label: "Spec review",  next: "spec-gate", failNext: "spec-triage", commandId: "flow.spec.review.propose" },
  draft: { countPattern: /(questions|findings|issues)=(\d+)/, countKey: "issueCount", countWord: "issue(s)", label: "Draft review", next: "draft-gate", commandId: "flow.draft.review" },
};

function resolvePhaseReviewNextStep({ phase, verdict, retryPhase, next, failNext }) {
  if (phase !== "draft") {
    if (verdict === "PASS" || verdict === "ADVISORY") return next;
    if (verdict === "REJECTED") return failNext;
    return null;
  }
  return resolveDraftReviewNextStep({ verdict, retryPhase });
}

function resolveDraftReviewRoute(retryPhase) {
  const resolvedRetryPhase = retryPhase || DEFAULT_DRAFT_REVIEW_ROUTE_RETRY_PHASE;
  const resolvedRoute = draftReviewRouteForRetryPhase(resolvedRetryPhase);
  if (!resolvedRoute) {
    throw new Error(`unknown draft review retry phase: ${resolvedRetryPhase}`);
  }
  return resolvedRoute;
}

function resolveDraftReviewNextStep({ verdict, retryPhase }) {
  if (!REVIEW_VERDICTS.has(verdict)) {
    throw new Error(`unknown draft review verdict: ${verdict}`);
  }
  const route = resolveDraftReviewRoute(retryPhase);
  return verdict === "PASS" ? route.passNextStepId : route.triageStepId;
}

function parseToolingOutcome(stderr) {
  if (!REVIEW_TOOLING_OUTCOME_PATTERN.test(stderr)) return null;
  const stage = stderr.match(/stage=([a-z_]+)/)?.[1] || "communication";
  const attempt = Number(stderr.match(/attempt=(\d+)/)?.[1] || 1);
  const maxAttempts = Number(stderr.match(/maxAttempts=(\d+)/)?.[1] || 1);
  const toolingKind = stderr.match(/toolingKind=([a-z_]+)/)?.[1] || `${stage}_error`;
  return new ReviewToolingOutcome({
    stage,
    attempt,
    maxAttempts,
    reason: toolingKind,
    permissionRelated: /permission|EACCES|EPERM|sandbox/i.test(stderr),
  });
}

function parsePhaseReviewOutput(res, stdout, stderr, { phase, countPattern, countKey, countWord, label, next, failNext = null }) {
  const verdictMatch = stderr.match(REVIEW_VERDICT_PATTERN);
  const toolingOutcome = parseToolingOutcome(stderr);
  const countMatch = stderr.match(countPattern);
  const reviewPathMatch = stderr.match(/Results saved to (\S+)/);
  const jsonPathMatch = stderr.match(/JSON saved to (\S+)/);
  const retryPhaseMatch = stderr.match(/retryPhase=([a-z-]+)/);
  const retryPhase = retryPhaseMatch ? retryPhaseMatch[1] : null;

  const verdict = verdictMatch ? verdictMatch[1] : (res.ok ? "PASS" : "REJECTED");
  const count = countMatch ? parseInt(countMatch[countMatch.length - 1], 10) : null;

  const changed = [];
  if (reviewPathMatch) changed.push(reviewPathMatch[1]);
  if (jsonPathMatch) changed.push(jsonPathMatch[1]);

  if (toolingOutcome) {
    const artifacts = { phase, toolingOutcome: toolingOutcome.toJSON(), [countKey]: count ?? 0 };
    if (retryPhase) artifacts.retryPhase = retryPhase;
    return {
      result: "tooling-error",
      changed,
      artifacts,
      next: null,
      output: stdout,
    };
  }

  if (!res.ok) {
    const detail = count === 0
      ? `${label} subprocess error (0 ${countWord} reported but process exited with error)`
      : count !== null
        ? `${label} FAIL: ${count} ${countWord} remaining`
        : `${label} failed (subprocess error)`;
    throw new Error(
      [detail, ...(stderr ? [stderr] : []), ...(stdout ? [stdout] : [])].join("\n"),
    );
  }

  const resolvedNext = resolvePhaseReviewNextStep({ phase, verdict, retryPhase, next, failNext });
  const artifacts = { phase, verdict, [countKey]: count ?? 0 };
  if (retryPhase) artifacts.retryPhase = retryPhase;

  return {
    result: "ok",
    changed,
    artifacts,
    next: resolvedNext,
    output: stdout,
  };
}

function parseTestReviewOutput(res, stdout, stderr) {
  const parsed = parsePhaseReviewOutput(res, stdout, stderr, { phase: "test", ...PHASE_REVIEW_PARSERS.test });
  const advisoryMatch = stderr.match(/advisory=(\d+)/);
  if (advisoryMatch) parsed.artifacts.advisoryCount = parseInt(advisoryMatch[1], 10);
  return parsed;
}

function parseSpecReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "spec", ...PHASE_REVIEW_PARSERS.spec });
}

function parseProposalReviewOutput(res, stdout, stderr) {
  return parsePhaseReviewOutput(res, stdout, stderr, { phase: "draft", ...PHASE_REVIEW_PARSERS.draft });
}

function parseImplReviewOutput(res, stdout, stderr, opts = {}) {
  const verdictMatch = stderr.match(REVIEW_VERDICT_PATTERN);
  const toolingOutcome = parseToolingOutcome(stderr);
  const blockingMatch = stderr.match(/blocking=(\d+)/);
  const nonBlockingMatch = stderr.match(/nonBlocking=(\d+)/);
  const reviewPathMatch = stderr.match(/Results saved to (\S+)/);
  const jsonPathMatch = stderr.match(/JSON saved to (\S+)/);
  const taskIdMatch = stderr.match(/taskId=(\S+)/);
  const targetMatch = stderr.match(/target=(\S+)/);

  const changed = [];
  if (reviewPathMatch) changed.push(reviewPathMatch[1]);
  if (jsonPathMatch) changed.push(jsonPathMatch[1]);

  if (toolingOutcome) {
    return {
      result: "tooling-error",
      changed,
      artifacts: {
        phase: "impl",
        toolingOutcome: toolingOutcome.toJSON(),
        blockingCount: 0,
        nonBlockingCount: 0,
      },
      next: null,
      output: stdout,
    };
  }

  if (!res.ok) {
    throw new Error(
      ["Impl review failed", ...(stderr ? [stderr] : []), ...(stdout ? [stdout] : [])].join("\n"),
    );
  }

  let artifactData = null;
  if (opts.root && jsonPathMatch) {
    const artifactPath = path.resolve(opts.root, jsonPathMatch[1]);
    try {
      artifactData = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    } catch (err) {
      throw new Error(`failed to read impl-review.json artifact: ${err.message}`);
    }
  }

  const verdict = artifactData?.verdict || (verdictMatch ? verdictMatch[1] : "PASS");
  const blockingCount = artifactData?.summary?.blocking ?? (blockingMatch ? parseInt(blockingMatch[1], 10) : 0);
  const nonBlockingCount = artifactData?.summary?.nonBlocking ?? (nonBlockingMatch ? parseInt(nonBlockingMatch[1], 10) : 0);

  const artifacts = {
    phase: "impl",
    verdict,
    blockingCount,
    nonBlockingCount,
  };
  if (taskIdMatch) artifacts.taskId = taskIdMatch[1];
  if (targetMatch) artifacts.target = targetMatch[1];

  return {
    result: "ok",
    changed,
    artifacts,
    next: verdict === "REJECTED" ? null : "impl-gate",
    output: stdout,
  };
}

function normalizeImplReviewSubprocessResult(result = {}) {
  const verdict = result.verdict || "PASS";
  return {
    verdict,
    failureKind: result.failureKind || null,
    retryable: result.retryable ?? null,
    reviewRetryConsumed: false,
    artifacts: result.artifacts || [],
    message: result.message || "",
  };
}

export { PHASE_REVIEW_PARSERS, parseTestReviewOutput, parseSpecReviewOutput, parseProposalReviewOutput, parseImplReviewOutput, normalizeImplReviewSubprocessResult };

export function appendIssueLogFromTestReviewToolingFailure(ctx, result) {
  void ctx;
  void result;
}

const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 3000;
const MAX_REVIEW_SUBPROCESS_RETRIES = 2;
const MAX_REVIEW_SUBPROCESS_RETRY_DELAY_MS = 30_000;

export function normalizeReviewSubprocessRetryCount(value) {
  const parsed = Number(value ?? DEFAULT_RETRY_COUNT);
  if (!Number.isFinite(parsed)) return DEFAULT_RETRY_COUNT;
  return Math.min(MAX_REVIEW_SUBPROCESS_RETRIES, Math.max(0, Math.trunc(parsed)));
}

export function normalizeReviewSubprocessRetryDelayMs(value) {
  const parsed = Number(value ?? DEFAULT_RETRY_DELAY_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_RETRY_DELAY_MS;
  return Math.min(MAX_REVIEW_SUBPROCESS_RETRY_DELAY_MS, Math.max(0, Math.trunc(parsed)));
}

/**
 * Run a command function with mechanical subprocess retry logic.
 * This does not consume the step retry budget; review verdict REJECTED is handled separately.
 *
 * @param {function} cmdFn - Function that returns { ok, status, stdout, stderr, signal, killed }
 * @param {Object} [opts]
 * @param {number} [opts.retryCount=2] - Number of retries (total attempts = retryCount + 1)
 * @param {number} [opts.retryDelayMs=3000] - Delay between retries in milliseconds
 * @returns {Promise<{ ok: boolean, status: number, stdout: string, stderr: string, signal: string|null, killed: boolean }>}
 */
export async function runCmdWithRetry(cmdFn, opts = {}) {
  const retryCount = normalizeReviewSubprocessRetryCount(opts.retryCount);
  const retryDelayMs = normalizeReviewSubprocessRetryDelayMs(opts.retryDelayMs);

  let lastRes;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    lastRes = cmdFn();
    if (lastRes.ok) return lastRes;
    const failure = ReviewFailure.fromSubprocessResult({
      phase: opts.phase || "impl",
      result: lastRes,
    });
    const failureForAttempt = failure.withAttempts({
      currentAttempt: attempt + 1,
      maximumAttempts: retryCount + 1,
    });
    if (failureForAttempt !== failure) {
      const marker = failureForAttempt.toMarkerLine();
      const lines = String(lastRes.stderr || "").split(/\r?\n/);
      const markerIndex = lines.findIndex((line) => line.trim().startsWith(REVIEW_FAILURE_MARKER_PREFIX));
      if (markerIndex >= 0) lines[markerIndex] = marker;
      else lines.unshift(marker);
      lastRes = { ...lastRes, stderr: lines.join("\n") };
    }

    if (attempt < retryCount) {
      if (!failureForAttempt.shouldRetrySubprocess({ attempt: attempt + 1, maxAttempts: retryCount + 1 })) {
        return lastRes;
      }
      const next = attempt + 2;
      const total = retryCount + 1;
      process.stderr.write(`[review] retry ${next}/${total} after ${retryDelayMs}ms...\n`);
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  return lastRes;
}

function canonicalProviderVerdict(value) {
  if (value === "TOOLING_ERROR") {
    throw new Error("TOOLING_ERROR is not a reviewer disposition");
  }
  return value;
}

const DRAFT_REPAIR_TARGET_PHASES = new Set(["draft-questions", "draft-coverage"]);

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function canonicalFindingFallbackId(phase, bucket, index) {
  return `${phase}-${bucket}-${String(index + 1).padStart(3, "0")}`;
}

class CanonicalReviewFindingRegistry {
  constructor() {
    this.findingIds = new Map();
    this.fingerprints = new Map();
  }

  uniqueFindingId(candidate, fallback, identity) {
    if (!this.findingIds.has(candidate) || this.findingIds.get(candidate) === identity) {
      return candidate;
    }
    let suffix = 1;
    let normalized = fallback;
    while (this.findingIds.has(normalized)) {
      suffix += 1;
      normalized = `${fallback}-${suffix}`;
    }
    return normalized;
  }

  uniqueFingerprint(candidate, identity) {
    if (!this.fingerprints.has(candidate) || this.fingerprints.get(candidate) === identity) {
      return candidate;
    }
    let suffix = 1;
    let normalized = sha256Hex(`${identity}:${suffix}`);
    while (this.fingerprints.has(normalized)) {
      suffix += 1;
      normalized = sha256Hex(`${identity}:${suffix}`);
    }
    return normalized;
  }

  register(input, { phase, bucket, index }) {
    const identity = stableStringify(input);
    const fallbackFindingId = canonicalFindingFallbackId(phase, bucket, index);
    const requestedFindingId = String(
      input.findingId || input.id || input.proposalId || input.findingKey || fallbackFindingId,
    ).trim();
    const requestedFingerprint = typeof input.fingerprint === "string" && /^[a-f0-9]{64}$/.test(input.fingerprint)
      ? input.fingerprint
      : sha256Hex(identity);
    const findingId = this.uniqueFindingId(requestedFindingId, fallbackFindingId, identity);
    const fingerprint = this.uniqueFingerprint(requestedFingerprint, identity);
    this.findingIds.set(findingId, identity);
    this.fingerprints.set(fingerprint, identity);
    return { findingId, fingerprint };
  }
}

function canonicalFinding(input, artifactName, { findingId, fingerprint }) {
  const summary = String(
    input.summary || input.title || input.issue || input.improvement || input.rationale || "Review finding.",
  ).trim();
  return {
    findingId,
    summary,
    fingerprint,
    evidenceRefs: [`${artifactName}#${findingId}`],
    ...(input.disposition == null ? {} : { disposition: input.disposition }),
  };
}

export function reviewArtifactFindingLists(artifact, phase) {
  const blocking = [
    artifact.blockingFindings,
    artifact.blocking,
    artifact.findings,
    artifact.comments,
    artifact.proposals,
    artifact.questions,
    artifact.issues,
  ].find(Array.isArray) || [];
  const advisory = [
    artifact.advisoryFindings,
    artifact.nonBlockingImprovements,
    artifact.improvements,
  ].find(Array.isArray) || [];
  const repairTargets = DRAFT_REPAIR_TARGET_PHASES.has(phase) && Array.isArray(artifact.repairTargets)
    ? artifact.repairTargets
    : [];
  return { blocking, advisory: [...advisory, ...repairTargets] };
}

function canonicalFindingList(findings, { phase, bucket, artifactName, registry }) {
  return findings.map((finding, index) => canonicalFinding(
    finding,
    artifactName,
    registry.register(finding, { phase, bucket, index }),
  ));
}

export function canonicalReviewArtifactFindings(artifact, phase, artifactName) {
  const { blocking, advisory } = reviewArtifactFindingLists(artifact, phase);
  const registry = new CanonicalReviewFindingRegistry();
  return {
    blockingFindings: canonicalFindingList(blocking, {
      phase,
      bucket: "blocking",
      artifactName,
      registry,
    }),
    advisoryFindings: canonicalFindingList(advisory, {
      phase,
      bucket: "advisory",
      artifactName,
      registry,
    }),
  };
}

function canonicalArtifactName(phase) {
  return REVIEW_SOURCE_ARTIFACT_BY_PHASE[phase] || `${phase}.review`;
}

function sourceArtifactPhase(phase) {
  if (phase === "draft-questions") return "draft-questions-review";
  if (phase === "draft-coverage") return "draft-coverage-review";
  return phase;
}

function resolveCurrentReviewTreeSha(ctx) {
  return ReviewTargetAuthority.fromContext(ctx).resolveTreeSha();
}

function resolveCurrentReviewTargetState(ctx, phase = reviewPhaseKeyForCtx(ctx, ctx?.phase || null)) {
  return ReviewTargetAuthority.fromContext(ctx).captureTargetStateForPhase(phase);
}

function resolveCurrentReviewRepairFingerprint(
  ctx,
  phase = reviewPhaseKeyForCtx(ctx, ctx?.phase || null),
) {
  return resolveCurrentReviewTargetState(ctx, phase).digest;
}

function assertCurrentReviewTarget(ctx, expectedTreeSha, expectedRepairFingerprint, phase = null) {
  const currentTreeSha = resolveCurrentReviewTreeSha(ctx);
  const currentRepairFingerprint = resolveCurrentReviewRepairFingerprint(
    ctx,
    phase || reviewPhaseKeyForCtx(ctx, ctx?.phase || null),
  );
  if (
    currentTreeSha === expectedTreeSha
    && currentRepairFingerprint === expectedRepairFingerprint
  ) return;
  const error = new Error(
    "review target changed before evidence promotion",
  );
  error.code = "STALE_REVIEW_TARGET";
  throw error;
}

function staleReviewTargetFailure({
  expectedTreeSha,
  currentTreeSha,
  expectedRepairFingerprint,
  currentRepairFingerprint,
}) {
  return Envelope.fail(
    "run",
    "review",
    "STALE_REVIEW_TARGET",
    "the review target tree changed before evidence promotion",
    {
      expectedTreeSha,
      currentTreeSha,
      expectedRepairFingerprint,
      currentRepairFingerprint,
    },
  );
}

function parseDraftArtifactFailure(stderr) {
  for (const line of String(stderr || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(DRAFT_ARTIFACT_FAILURE_MARKER_PREFIX)) continue;
    const failure = DraftArtifactRecoveryError.fromMarkerLine(trimmed);
    if (failure) return failure;
  }
  return null;
}

function draftArtifactFailureEnvelope(error, phase) {
  return Envelope.fail(
    "run",
    "review",
    error.code,
    error.message,
    {
      ...error.data,
      phase,
      recoveryCommand: error.recoveryCommand,
      retryBudgetConsumed: false,
    },
  );
}

function persistCanonicalToolingOutcome(ctx, {
  phase,
  taskId = null,
  treeSha,
  repairFingerprint,
  stage,
  reason,
  outcome = null,
  provider = PRODUCT.provider("review"),
  evidence = null,
  canonicalEvidencePersisted = false,
  finalizedEvidenceAvailable = false,
  targetState = null,
  expectedOriginal = null,
}) {
  if (!ctx?.flowManager) return null;
  const store = new ReviewConvergenceStore({ flowManager: ctx.flowManager });
  const current = store.read({
    phase,
    taskId,
    treeSha,
    targetStateDigest: repairFingerprint,
  });
  const normalizedOutcome = nextReviewToolingOutcome(current, {
    stage: outcome?.stage || stage,
    reason: outcome?.reason || reason,
    permissionRelated: outcome?.permissionRelated
      ?? /permission|EACCES|EPERM|sandbox/i.test(reason),
  });
  assertCurrentReviewTarget(ctx, treeSha, repairFingerprint, phase);
  const state = store.recordToolingOutcome({
    phase,
    taskId,
    treeSha,
    provider,
    outcome: normalizedOutcome,
    evidence,
    canonicalEvidencePersisted,
    finalizedEvidenceAvailable,
    targetStateDigest: repairFingerprint,
    targetState,
    expectedOriginal,
  });
  return { outcome: normalizedOutcome, state };
}

export function persistReviewPostHookToolingFailure(ctx, result, error) {
  if (!ctx?.flowManager) return null;
  const phase = reviewPhaseKeyForCtx(ctx, result?.artifacts?.phase || ctx.phase);
  const completionScope = ReviewCompletionScope.forPostHook({ result, phase });
  const taskId = completionScope.taskId;
  const treeSha = resolveCurrentReviewTreeSha(ctx);
  const targetStateDigest = resolveCurrentReviewRepairFingerprint(ctx, phase);
  const expectedOriginal = ctx.flowManager.load();
  const store = new ReviewConvergenceStore({ flowManager: ctx.flowManager });
  const current = store.read({ phase, taskId, treeSha, targetStateDigest });
  const outcome = nextReviewToolingOutcome(current, {
    stage: "post_hook",
    reason: String(error?.message || error),
    permissionRelated: /permission|EACCES|EPERM|sandbox/i.test(String(error?.message || error)),
  });
  assertCurrentReviewTarget(ctx, treeSha, targetStateDigest, phase);
  const state = store.recordToolingOutcome({
    phase,
    taskId,
    treeSha,
    provider: PRODUCT.provider("review"),
    outcome,
    finalizedEvidenceAvailable: Boolean(current.evidence || current.finalizedEvidenceAvailable),
    targetStateDigest,
    expectedOriginal,
  });
  result.artifacts ||= {};
  result.artifacts.toolingOutcome = outcome.toJSON();
  result.reviewAction = resolveReviewPermittedOperation(state).toJSON();
  return { outcome, state };
}

/**
 * Reuse a finalized flow-level PASS artifact after a post-hook lock conflict.
 * The review provider has already completed, so recovery must register that
 * immutable artifact rather than invoke the provider a second time.
 */

export class ReviewExecutionGuard {
  constructor({ flowManager, boundaries } = {}) {
    if (!flowManager) throw new Error("flowManager is required");
    if (!boundaries || typeof boundaries !== "object") {
      throw new Error("review execution guard boundaries are required");
    }
    if (typeof boundaries.resolveCurrentTreeSha !== "function") {
      throw new Error("review execution guard must resolve the current tree SHA");
    }
    if (typeof boundaries.resolveCurrentTargetStateDigest !== "function") {
      throw new Error("review execution guard must resolve the current target state digest");
    }
    this.boundaries = boundaries;
    this.store = new ReviewConvergenceStore({ flowManager });
    Object.freeze(this);
  }

  inspect({ phase, taskId = null, treeSha } = {}) {
    const targetStateDigest = this.boundaries.resolveCurrentTargetStateDigest();
    if (this.boundaries.resolveCurrentTreeSha() !== treeSha) {
      return Object.freeze({
        allowed: false,
        targetStateDigest,
        convergenceState: null,
        nextOperation: null,
        rejection: pipelineRejection(
          "STALE_REVIEW_TARGET",
          "the requested review tree is no longer current",
        ),
      });
    }
    const convergenceState = this.store.read({ phase, taskId, treeSha, targetStateDigest });
    const nextOperation = resolveReviewPermittedOperation(convergenceState);
    let rejection = null;
    if (convergenceState.disposition === "PASS" || convergenceState.disposition === "ADVISORY") {
      rejection = pipelineRejection(
        "REVIEW_ALREADY_COMPLETED",
        "review evidence is already completed for this target",
      );
    } else if (nextOperation.kind === "retry_review" && nextOperation.requiresChangedEvidence) {
      rejection = pipelineRejection(
        "REVIEW_EVIDENCE_CHANGE_REQUIRED",
        "review remediation requires a changed target tree",
      );
    } else if (nextOperation.kind === "register_alternative_evidence") {
      rejection = pipelineRejection(
        "FINALIZED_REVIEW_EVIDENCE_REGISTRATION_REQUIRED",
        "finalized review evidence must be registered instead of rerunning the provider",
      );
    } else if (nextOperation.kind === "stop_as_blocker") {
      rejection = pipelineRejection(
        "REVIEW_TOOLING_ATTEMPTS_EXHAUSTED",
        "review tooling attempts are exhausted for this target",
      );
    }
    return Object.freeze({
      allowed: rejection == null,
      targetStateDigest,
      convergenceState,
      nextOperation,
      rejection,
    });
  }
}

function canonicalReviewExecutionBlock(
  ctx,
  phase,
  taskId,
  {
    treeSha = resolveCurrentReviewTreeSha(ctx),
    targetStateDigest = resolveCurrentReviewRepairFingerprint(ctx, phase),
    resolveTreeSha = () => resolveCurrentReviewTreeSha(ctx),
    resolveTargetStateDigest = () => resolveCurrentReviewRepairFingerprint(ctx, phase),
  } = {},
) {
  if (!ctx?.flowManager) return null;
  const guard = new ReviewExecutionGuard({
    flowManager: ctx.flowManager,
    boundaries: {
      resolveCurrentTreeSha: resolveTreeSha,
      resolveCurrentTargetStateDigest: resolveTargetStateDigest,
    },
  });
  if (resolveTargetStateDigest() !== targetStateDigest) {
    return Envelope.fail(
      "run",
      "review",
      "STALE_REVIEW_TARGET",
      "the requested review target state is no longer current",
    );
  }
  const inspection = guard.inspect({ phase, taskId, treeSha });
  if (inspection.allowed) return null;
  return Envelope.fail(
    "run",
    "review",
    inspection.rejection.code,
    inspection.rejection.message,
    { reviewAction: inspection.nextOperation?.toJSON() ?? null },
  );
}

const REVIEW_PROMOTION_REJECTION_CODES = new Set([
  "REVIEW_ALREADY_COMPLETED",
  "REVIEW_CONVERGENCE_CONTEXT_REQUIRED",
  "REVIEW_DUPLICATE_IDENTITY",
  "REVIEW_EVIDENCE_ARTIFACT_MISSING",
  "REVIEW_EVIDENCE_ARTIFACT_REQUIRED",
  "REVIEW_EVIDENCE_CHANGE_REQUIRED",
  "REVIEW_SEMANTIC_ATTEMPTS_EXHAUSTED",
  "REVIEW_STATE_REVISION_MISMATCH",
  "STALE_REVIEW_TARGET",
]);

class FinalizedReviewPromotionError extends Error {
  constructor({ cause, evidence, targetState }) {
    super(String(cause?.message || cause), { cause });
    this.name = "FinalizedReviewPromotionError";
    this.stage = "result_recording";
    this.evidence = evidence;
    this.targetState = targetState;
    Object.freeze(this);
  }
}

function reviewPromotionFailureStage(error) {
  if (error instanceof FinalizedReviewPromotionError) return error.stage;
  if (error instanceof SyntaxError) return "parse";
  if (/review-evidence|immutable|canonical|evidence (path|file|write)|EACCES|ENOTDIR/i.test(
    String(error?.message || error),
  )) {
    return "canonical_write";
  }
  return "result_recording";
}

function reviewExecutionFailureEnvelope(ctx, {
  phase,
  taskId = null,
  treeSha,
  repairFingerprint,
  stage,
  error,
  expectedOriginal = null,
}) {
  if (REVIEW_PROMOTION_REJECTION_CODES.has(error?.code)) {
    return Envelope.fail(
      "run",
      "review",
      error.code,
      String(error.message || error),
    );
  }
  const reason = String(error?.message || error);
  const finalizedPromotion = error instanceof FinalizedReviewPromotionError
    ? error
    : null;
  let recorded = null;
  try {
    recorded = persistCanonicalToolingOutcome(ctx, {
      phase,
      taskId,
      treeSha,
      repairFingerprint,
      stage,
      reason,
      evidence: finalizedPromotion?.evidence ?? null,
      canonicalEvidencePersisted: finalizedPromotion != null,
      finalizedEvidenceAvailable: finalizedPromotion != null,
      targetState: finalizedPromotion?.targetState ?? null,
      expectedOriginal,
    });
  } catch (persistenceError) {
    if (REVIEW_PROMOTION_REJECTION_CODES.has(persistenceError?.code)) {
      return Envelope.fail(
        "run",
        "review",
        persistenceError.code,
        String(persistenceError.message || persistenceError),
      );
    }
    throw persistenceError;
  }
  const toolingOutcome = recorded?.outcome ?? new ReviewToolingOutcome({
    stage,
    attempt: 1,
    maxAttempts: 2,
    reason,
    permissionRelated: /permission|EACCES|EPERM|sandbox/i.test(reason),
  });
  return Envelope.fail(
    "run",
    "review",
    "REVIEW_TOOLING_ERROR",
    `review tooling error at ${stage}: ${reason}`,
    {
      toolingOutcome: toolingOutcome.toJSON(),
      ...(recorded && {
        reviewAction: resolveReviewPermittedOperation(recorded.state).toJSON(),
      }),
    },
  );
}

function finalizeReviewCommandResult({
  ctx,
  phase,
  taskId,
  treeSha,
  repairFingerprint,
  expectedOriginal,
  parse,
}) {
  let result;
  try {
    result = parse();
  } catch (error) {
    return reviewExecutionFailureEnvelope(ctx, {
      phase,
      taskId,
      treeSha,
      repairFingerprint,
      stage: "parse",
      error,
      expectedOriginal,
    });
  }
  try {
    persistCanonicalReviewResult(
      ctx,
      result,
      phase,
      treeSha,
      repairFingerprint,
      expectedOriginal,
    );
    result.artifacts ||= {};
    result.artifacts.treeSha = treeSha;
    result.artifacts.targetStateDigest = repairFingerprint;
  } catch (error) {
    return reviewExecutionFailureEnvelope(ctx, {
      phase,
      taskId,
      treeSha,
      repairFingerprint,
      stage: reviewPromotionFailureStage(error),
      error,
      expectedOriginal: ctx.flowManager?.load() ?? expectedOriginal,
    });
  }
  return result;
}

function evidenceFromProviderResult({ phase, taskId, treeSha, providerResult }) {
  if (!providerResult) return null;
  const disposition = new ReviewDisposition({
    value: canonicalProviderVerdict(providerResult.verdict),
    blockingFindings: providerResult.blockingFindings || [],
    advisoryFindings: providerResult.advisoryFindings || [],
  });
  return new ReviewEvidence({
    phase,
    taskId,
    treeSha,
    provenance: providerResult.provenance,
    disposition,
  });
}

function canonicalEvidenceWasPersisted(evidence, toolingOutcome) {
  if (!evidence) return false;
  if (!toolingOutcome) return true;
  return !["startup", "communication", "parse", "post_hook", "canonical_write"]
    .includes(toolingOutcome.stage);
}

export class NormalizedReviewExecution {
  constructor({
    phase,
    taskId,
    treeSha,
    evidence,
    toolingOutcome,
    semanticMaxAttempts,
  }) {
    this.evidence = evidence;
    this.toolingOutcome = toolingOutcome;
    this.semanticMaxAttempts = semanticMaxAttempts;
    this.findings = toolingOutcome ? [] : evidence?.findings || [];
    this.handoffFindings = toolingOutcome || !evidence ? [] : buildReviewHandoffFindings(evidence);
    this.finalizedEvidenceAvailable = evidence != null;
    this.canonicalEvidencePersisted = canonicalEvidenceWasPersisted(evidence, toolingOutcome);
    this.semanticRetryConsumed = Boolean(
      evidence?.disposition.value === "REJECTED"
      && this.canonicalEvidencePersisted
      && !toolingOutcome,
    );
    const evidenceReference = this.canonicalEvidencePersisted && evidence
      ? new ReviewEvidenceReference({
          evidenceId: evidence.identity.evidenceDigest,
          disposition: evidence.disposition,
        })
      : null;
    const convergence = new ReviewConvergenceState({
      phase,
      taskId,
      treeSha,
      semanticAttempts: this.semanticRetryConsumed ? 1 : 0,
      semanticMaxAttempts,
      toolingAttempts: toolingOutcome ? Math.max(0, toolingOutcome.attempt - 1) : 0,
      toolingMaxAttempts: toolingOutcome ? Math.max(1, toolingOutcome.maxAttempts - 1) : 1,
      evidence: evidenceReference,
      finalizedEvidenceAvailable: this.finalizedEvidenceAvailable,
      handoffFindings: this.handoffFindings,
      blocker: toolingOutcome && !evidence
        ? { kind: "tooling_attempts_exhausted", reason: toolingOutcome.reason }
        : null,
      toolingOutcome,
    });
    this.nextOperation = resolveReviewPermittedOperation(convergence);
    this.reviewCompleted = Boolean(
      evidence
      && ["PASS", "ADVISORY"].includes(evidence.disposition.value)
      && this.canonicalEvidencePersisted,
    );
    this.rerunAllowed = this.nextOperation.kind === "retry_review";
    this.requiresApproval = false;
    this.privilegeEscalationAllowed = false;
    Object.freeze(this.findings);
    Object.freeze(this.handoffFindings);
    Object.freeze(this);
  }
}

export function normalizeReviewExecution({
  phase,
  taskId = null,
  treeSha,
  providerResult = null,
  toolingFailure = null,
  semanticMaxAttempts = 3,
} = {}) {
  const evidence = evidenceFromProviderResult({ phase, taskId, treeSha, providerResult });
  const toolingOutcome = toolingFailure == null
    ? null
    : toolingFailure instanceof ReviewToolingOutcome
      ? toolingFailure
      : new ReviewToolingOutcome({
          ...toolingFailure,
          permissionRelated: toolingFailure.permissionRelated === true,
        });
  return new NormalizedReviewExecution({
    phase,
    taskId,
    treeSha,
    evidence,
    toolingOutcome,
    semanticMaxAttempts,
  });
}

function pipelineRejection(code, message) {
  return Object.freeze({ code, message });
}

function permissionRelatedFailure(error) {
  return /permission|EACCES|EPERM|sandbox/i.test(String(error?.message || error));
}

export class ReviewExecutionPipeline {
  constructor({ flowManager, boundaries } = {}) {
    if (!flowManager) throw new Error("flowManager is required");
    if (!boundaries || typeof boundaries !== "object") throw new Error("review execution boundaries are required");
    if (typeof boundaries.resolveCurrentTargetStateDigest !== "function") {
      throw new Error("review execution boundaries must resolve the current target state digest");
    }
    this.flowManager = flowManager;
    this.boundaries = boundaries;
    this.store = new ReviewConvergenceStore({ flowManager });
    this.guard = new ReviewExecutionGuard({ flowManager, boundaries });
    Object.freeze(this);
  }

  async execute({ phase, taskId = null, treeSha, provider } = {}) {
    const inspection = this.guard.inspect({ phase, taskId, treeSha });
    const targetStateDigest = inspection.targetStateDigest;
    if (!inspection.allowed) {
      return {
        executionStarted: false,
        convergenceState: inspection.convergenceState,
        nextOperation: inspection.nextOperation,
        rejection: inspection.rejection,
      };
    }

    let providerResult = null;
    let providerSession;
    try {
      providerSession = await this.boundaries.startProvider({ phase, taskId, treeSha, provider });
    } catch (error) {
      return this.#persistToolingFailure({
        phase, taskId, treeSha, targetStateDigest, provider, stage: "startup", error, providerResult,
      });
    }
    let payload;
    try {
      payload = await this.boundaries.communicate(providerSession, { phase, taskId, treeSha, provider });
    } catch (error) {
      return this.#persistToolingFailure({
        phase, taskId, treeSha, targetStateDigest, provider, stage: "communication", error, providerResult,
      });
    }
    try {
      providerResult = this.boundaries.parseProviderResult(payload, { phase, taskId, treeSha, provider });
    } catch (error) {
      return this.#persistToolingFailure({
        phase, taskId, treeSha, targetStateDigest, provider, stage: "parse", error, providerResult,
      });
    }
    try {
      await this.boundaries.runPostHook(providerResult, { phase, taskId, treeSha, provider });
    } catch (error) {
      return this.#persistToolingFailure({
        phase, taskId, treeSha, targetStateDigest, provider, stage: "post_hook", error, providerResult,
      });
    }

    const effectTreeSha = this.boundaries.resolveCurrentTreeSha();
    const effectTargetStateDigest = this.boundaries.resolveCurrentTargetStateDigest();
    if (effectTreeSha !== treeSha || effectTargetStateDigest !== targetStateDigest) {
      return {
        executionStarted: true,
        rejection: pipelineRejection(
          "STALE_REVIEW_TARGET",
          "the review target changed before canonical evidence effects",
        ),
      };
    }

    const normalized = normalizeReviewExecution({ phase, taskId, treeSha, providerResult });
    try {
      await this.boundaries.writeCanonicalEvidence(normalized.evidence);
    } catch (error) {
      return this.#persistToolingFailure({
        phase, taskId, treeSha, targetStateDigest, provider, stage: "canonical_write", error, providerResult,
      });
    }
    try {
      await this.boundaries.writeProjection(normalized, { phase, taskId, treeSha, provider });
    } catch (error) {
      return this.#persistToolingFailure({
        phase, taskId, treeSha, targetStateDigest, provider, stage: "projection", error, providerResult,
      });
    }
    try {
      await this.boundaries.recordResult(normalized, { phase, taskId, treeSha, provider });
    } catch (error) {
      return this.#persistToolingFailure({
        phase, taskId, treeSha, targetStateDigest, provider, stage: "result_recording", error, providerResult,
      });
    }
    const expectedOriginal = this.flowManager.load();
    const convergenceState = this.store.recordEvidence({
      evidence: normalized.evidence,
      provider,
      targetStateDigest,
      expectedOriginal,
    });
    return {
      ...normalized,
      executionStarted: true,
      convergenceState,
      nextOperation: resolveReviewPermittedOperation(convergenceState),
    };
  }

  #persistToolingFailure({
    phase,
    taskId,
    treeSha,
    targetStateDigest,
    provider,
    stage,
    error,
    providerResult,
  }) {
    const current = this.store.read({ phase, taskId, treeSha, targetStateDigest });
    const toolingOutcome = nextReviewToolingOutcome(current, {
      stage,
      reason: String(error?.message || error),
      permissionRelated: permissionRelatedFailure(error),
    });
    const normalized = normalizeReviewExecution({
      phase,
      taskId,
      treeSha,
      providerResult,
      toolingFailure: toolingOutcome,
    });
    const currentTreeSha = this.boundaries.resolveCurrentTreeSha();
    const currentTargetStateDigest = this.boundaries.resolveCurrentTargetStateDigest();
    if (currentTreeSha !== treeSha || currentTargetStateDigest !== targetStateDigest) {
      return {
        ...normalized,
        findings: [],
        executionStarted: true,
        rejection: pipelineRejection(
          "STALE_REVIEW_TARGET",
          "the review tree changed before tooling outcome promotion",
        ),
      };
    }
    const expectedOriginal = this.flowManager.load();
    const convergenceState = this.store.recordToolingOutcome({
      phase,
      taskId,
      treeSha,
      provider,
      outcome: toolingOutcome,
      evidence: normalized.evidence,
      canonicalEvidencePersisted: normalized.canonicalEvidencePersisted,
      targetStateDigest,
      expectedOriginal,
    });
    return {
      ...normalized,
      // TOOLING_ERROR never becomes a review finding on the execution
      // surface. Finalized evidence remains available through evidence and
      // handoffFindings for canonical-write/projection recovery.
      findings: [],
      executionStarted: true,
      convergenceState,
      nextOperation: resolveReviewPermittedOperation(convergenceState),
    };
  }
}

export class RunReviewCommand extends FlowCommand {
  constructor({
    resolveScope = resolveImplReviewScope,
    resolveTreeSha = resolveCurrentReviewTreeSha,
    resolveTargetStateDigest = resolveCurrentReviewRepairFingerprint,
    runCommand = runCmd,
  } = {}) {
    super();
    this.resolveScope = resolveScope;
    this.resolveTreeSha = resolveTreeSha;
    this.resolveTargetStateDigest = resolveTargetStateDigest;
    this.runCommand = runCommand;
  }

  /**
   * Version-1 review execution has a deliberately narrow boundary: the
   * established child command writes only a transient work unit, then this
   * parent returns a Store-attached result.  Registry lifecycle confirmation
   * commits the result history, immutable evidence, Activity, and state in
   * one journaled operation.
   */
  async executeCanonical(ctx, { phase, dryRun, executionRoot }) {
    const persistedPhase = reviewPhaseKeyForCtx(ctx, phase);
    const state = ctx.flowManager.canonicalState(ctx.specId ?? ctx.flowState.specId);
    if (state === null) {
      throw new Error("canonical review requires a loaded Version-1 Flow");
    }
    const currentNodeId = state.current?.at(-1) ?? null;
    const taskId = persistedPhase === IMPL_REVIEW_PHASE
      ? ctx.flowState.currentTaskId ?? null
      : null;
    const expectedNodeId = canonicalReviewNodeId({ phase: persistedPhase, taskId });
    if (currentNodeId !== expectedNodeId) {
      throw new Error(`canonical review requires active ${expectedNodeId}, found ${currentNodeId ?? "none"}`);
    }
    if (dryRun) {
      return Envelope.fail(
        "run",
        "review",
        "CANONICAL_REVIEW_DRY_RUN_REQUIRES_PREVIEW_BOUNDARY",
        "Version-1 review dry-run does not create a durable Attempt or worker work unit.",
      );
    }

    const treeSha = this.resolveTreeSha(ctx);
    const targetStateDigest = this.resolveTargetStateDigest(ctx, persistedPhase);
    const workUnit = new CanonicalReviewWorkUnit({
      flowManager: ctx.flowManager,
      state: ctx.flowState,
      phase: persistedPhase,
      taskId,
    });
    const surface = workUnit.prepare();
    const draftSource = workUnit.materializeDraft();
    const testSources = workUnit.materializeTestSources(surface.directory);
    const taskSpec = workUnit.materializeTaskSpec();
    const scriptPath = path.join(PKG_DIR, "flow", "commands", "review.js");
    const args = [];
    if (phase && phase !== IMPL_REVIEW_PHASE) args.push("--phase", phase);
    if (taskSpec !== null) args.push("--task-spec", taskSpec.logicalPath);
    if (ctx.skipConfirm) args.push("--skip-confirm");
    const timeoutMs = AgentTimeout.fromConfig(ctx.config?.agent).toMilliseconds();
    const env = {
      ...process.env,
      [PRODUCT.env("REVIEW_OUTPUT_DIR")]: surface.directory,
      ...(draftSource === null ? {} : {
        [PRODUCT.env("REVIEW_DRAFT_SOURCE")]: JSON.stringify(draftSource),
      }),
      ...(testSources === null ? {} : {
        [PRODUCT.env("REVIEW_TEST_SOURCE_DIR")]: testSources.directory,
        [PRODUCT.env("REVIEW_TEST_ARTIFACT_REVISION")]: JSON.stringify(testSources.revision),
      }),
      ...(taskSpec === null ? {} : {
        [PRODUCT.env("REVIEW_TASK_SPEC_SOURCE")]: JSON.stringify({
          logicalPath: taskSpec.logicalPath,
          sourcePath: taskSpec.sourcePath,
        }),
      }),
    };

    let res;
    try {
      res = await runCmdWithRetry(
        () => this.runCommand("node", [scriptPath, ...args], { cwd: executionRoot, timeout: timeoutMs, env }),
        { phase: persistedPhase, retryCount: 0 },
      );
    } catch (error) {
      return this.#canonicalFailure(ctx, persistedPhase, error);
    }
    if (!res.ok) {
      const reason = [res.stderr, res.stdout].filter(Boolean).join("\n") || "review subprocess failed";
      return this.#canonicalFailure(ctx, persistedPhase, new Error(reason));
    }
    const currentTreeSha = this.resolveTreeSha(ctx);
    const currentTargetStateDigest = this.resolveTargetStateDigest(ctx, persistedPhase);
    if (currentTreeSha !== treeSha || currentTargetStateDigest !== targetStateDigest) {
      return Envelope.fail(
        "run",
        "review",
        "STALE_REVIEW_TARGET",
        "the review target tree changed before canonical evidence promotion",
        { expectedTreeSha: treeSha, currentTreeSha, expectedTargetStateDigest: targetStateDigest, currentTargetStateDigest },
      );
    }

    const stdout = String(res.stdout || "").trim();
    const stderr = String(res.stderr || "").trim();
    let result;
    try {
      if (phase === "draft") result = parseProposalReviewOutput(res, stdout, stderr);
      else if (persistedPhase === "test") result = parseTestReviewOutput(res, stdout, stderr);
      else if (persistedPhase === "spec") result = parseSpecReviewOutput(res, stdout, stderr);
      else result = parseImplReviewOutput(res, stdout, stderr);
    } catch (error) {
      return this.#canonicalFailure(ctx, persistedPhase, error);
    }
    if (result?.artifacts?.toolingOutcome) {
      return this.#canonicalFailure(
        ctx,
        persistedPhase,
        new Error(result.artifacts.toolingOutcome.reason || "review tooling failed"),
      );
    }
    try {
      result.changed = [];
      result.artifacts ||= {};
      result.artifacts.phase = persistedPhase;
      if (taskId !== null) result.artifacts.taskId = taskId;
      new CanonicalReviewPromotion({
        workUnitDirectory: surface.directory,
        phase: persistedPhase,
        taskId,
        treeSha,
        targetStateDigest,
      }).promote(result);
      return result;
    } catch (error) {
      return this.#canonicalFailure(ctx, persistedPhase, error);
    }
  }

  #canonicalFailure(ctx, phase, error) {
    const message = String(error?.message || error);
    try {
      ctx.flowManager.failCurrentAttempt({
        specId: ctx.specId ?? ctx.flowState.specId,
        failure: {
          category: "tooling",
          code: "REVIEW_EXECUTION_FAILED",
          message,
          retryable: true,
          retryKind: "tooling",
        },
        result: {
          outcome: "failed",
          summary: message,
          confirmedAt: new Date().toISOString(),
          artifactRefs: [],
        },
      });
    } catch (failureError) {
      return Envelope.fail(
        "run",
        "review",
        "REVIEW_FAILURE_RECORDING_FAILED",
        `${message}; unable to record the canonical Attempt failure: ${failureError.message}`,
      );
    }
    return Envelope.fail(
      "run",
      "review",
      "REVIEW_TOOLING_ERROR",
      `review tooling error for ${phase}: ${message}`,
    );
  }

  async execute(ctx) {
    const { root } = ctx;
    const executionRoot = ctx.executionRoot || root;
    const phase = ctx.phase || null;
    const dryRun = ctx.dryRun === true;

    if (phase && !VALID_REVIEW_PHASES.includes(phase)) {
      // spec 253 R8: return Envelope.fail with UNKNOWN_REVIEW_PHASE for unknown
      // CLI phase values (uniform fail-closed contract — no throw, no max-attempts
      // bypass via unknown phase).
      return Envelope.fail("run", "review", "UNKNOWN_REVIEW_PHASE",
        [`invalid phase: ${phase} (valid: ${VALID_REVIEW_PHASES.join(", ")})`],
        { phase });
    }

    if (!isCanonicalFlowState(ctx.flowState)) {
      return Envelope.fail(
        "run",
        "review",
        "CANONICAL_REVIEW_REQUIRED",
        "review execution requires a Version-1 Flow Activity and catalog authority.",
      );
    }
    return this.executeCanonical(ctx, { phase, dryRun, executionRoot });

  }
}

export default RunReviewCommand;
export {
  resolveDraftReviewNextStep,
};
