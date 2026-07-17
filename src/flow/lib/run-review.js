/**
 * src/flow/lib/run-review.js
 *
 * FlowCommand: review — wraps `flow commands/review.js` for AI code quality review.
 * Runs review as a subprocess and parses its output.
 */

import { PKG_DIR } from "../../lib/cli.js";
import { runCmd } from "../../lib/process.js";
import { VALID_REVIEW_PHASES } from "../../lib/constants.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import {
  getFlowBranchLeafIds,
  resolveMaxAttempts,
  resetImplEvidenceAfterReviewProposals as resetImplEvidenceStateAfterReviewProposals,
} from "../definition.js";
import { flattenSteps } from "./step-tree.js";
import path from "path";
import fs from "fs";
import {
  ReviewFailure,
  clearReviewStopState,
  writeReviewStopState,
} from "./review-failure.js";
import { appendIssueLogEntry } from "./set-issue-log.js";
import { persistCurrentRecoveryBaseline, resolveRecoveryMaxAttempts } from "./retry-recovery.js";
import {
  assertAuditedBroadMode,
  evaluateTaskScope,
  resolveCurrentTaskSpec,
  taskScopeViolationMessages,
} from "./task-scope.js";
import { draftReviewRouteForRetryPhase } from "./draft-review-routes.js";
import {
  deferExhaustedSemanticFindings,
  readBoundedSourceArtifact,
  specDirFromFlowState,
} from "./flow-findings.js";
import {
  DecisionOutcome,
  DeferOutcome,
  ExternalBlockedOutcome,
  RetryOutcome,
  nextStepAttemptNumber,
  recordStepAttempt,
} from "./step-outcome.js";

const DEFAULT_AGENT_TIMEOUT_MS = 300_000;
const IMPL_REVIEW_PHASE = "impl";
const DEFAULT_DRAFT_REVIEW_ROUTE_RETRY_PHASE = "draft-questions";
const REVIEW_VERDICT_VALUES = Object.freeze(["PASS", "ADVISORY", "FAIL", "TOOLING_FAILURE"]);
const REVIEW_VERDICTS = new Set(REVIEW_VERDICT_VALUES);
const REVIEW_VERDICT_PATTERN = new RegExp(`verdict=(${REVIEW_VERDICT_VALUES.join("|")})`);
const REVIEW_RECOVERY_TRIGGER_RETRY_EXHAUSTED = "review-retry-exhausted";
const REVIEW_RECOVERY_TRIGGER_STOP = "review-stop";
const REVIEW_RECOVERY_TRIGGER_VERDICT_FAIL = "review-verdict-fail";
const MAX_IMPL_DOWNSTREAM_RESET_STEPS = 20;
// Review proposals invalidate all implementation leaves from fresh test
// execution through finalize cleanup; both endpoints are intentionally reset.
const IMPL_REVIEW_DOWNSTREAM_STEP_IDS = inclusiveFlowLeafStepIdsBetween("test-execute", "finalize-cleanup");

// ---------------------------------------------------------------------------
// Review retry counter (spec 253: enforce review maxAttempts on the CLI side)
// ---------------------------------------------------------------------------

const REVIEW_NODE_ID_BY_PHASE = Object.freeze({
  "draft-questions": "draft-questions-review",
  "draft-coverage": "draft-coverage-review",
  spec: "spec-review",
  test: "test-review",
  impl: "impl-review",
});

const REVIEW_PHASE_KEYS = Object.freeze(Object.keys(REVIEW_NODE_ID_BY_PHASE));
const REVIEW_SOURCE_ARTIFACT_BY_PHASE = Object.freeze({
  "draft-questions": "draft-review-questions.json",
  "draft-coverage": "draft-review-coverage.json",
  spec: "spec-review.json",
  test: "test-review.json",
  impl: "impl-review.json",
});

function persistedPhaseKey(ctxPhase) {
  return ctxPhase == null ? IMPL_REVIEW_PHASE : ctxPhase;
}

function isImplementationReviewPhase(phase) {
  return phase == null || phase === IMPL_REVIEW_PHASE;
}

function inclusiveFlowLeafStepIdsBetween(startId, endId) {
  const ids = getFlowBranchLeafIds("impl");
  if (ids.length > MAX_IMPL_DOWNSTREAM_RESET_STEPS) {
    throw new Error(`impl downstream reset leaf count exceeds max ${MAX_IMPL_DOWNSTREAM_RESET_STEPS}`);
  }
  const start = ids.indexOf(startId);
  const end = ids.indexOf(endId);
  if (start < 0 || end < start) {
    throw new Error(`flow definition range not found: ${startId}..${endId}`);
  }
  return Object.freeze(ids.slice(start, end + 1));
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

function mutateReviewRecoveryState(ctx, phase, trigger, afterPersist) {
  if (!ctx?.root || typeof ctx?.flowManager?.mutate !== "function") return false;
  let persisted = false;
  ctx.flowManager.mutate((state) => {
    if (!state?.spec) return;
    persistCurrentRecoveryBaseline({
      root: ctx.root,
      flowState: state,
      kind: "review",
      phase,
      trigger,
    });
    persisted = true;
    if (afterPersist) afterPersist(state);
  });
  return persisted;
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

function reviewArtifactHasStructuredCoverageFailure(specDir) {
  const coverage = readBoundedSourceArtifact(specDir, "test-coverage.json");
  return coverage?.validation?.ok === false;
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

function persistReviewSourceFindingIds(specDir, sourceArtifact, artifact) {
  const normalized = JSON.parse(JSON.stringify(artifact));
  const findings = reviewFindingsFromArtifact(normalized);
  findings.forEach((finding, index) => {
    if (!finding.findingId && !finding.id && !finding.proposalId) {
      finding.findingId = reviewFindingId(finding, index);
    }
  });
  fs.writeFileSync(path.join(specDir, sourceArtifact), JSON.stringify(normalized, null, 2) + "\n");
  return { artifact: normalized, findings };
}

function reviewDeferredResult(phase, attempts, findingCount) {
  return {
    result: "deferred",
    changed: ["flow-findings.json"],
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
  if (ctx?.flowState?.currentTaskId != null) return "task-review";
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
  });
}

function tryDeferReviewRetryExhaustion(ctx, phase, attempts) {
  if (!ctx?.root || !ctx?.flowState?.spec || typeof ctx?.flowManager?.updateStepStatus !== "function") return null;
  const sourceArtifact = REVIEW_SOURCE_ARTIFACT_BY_PHASE[phase];
  if (!sourceArtifact) return null;
  const specDir = specDirFromFlowState(ctx.root, ctx.flowState);
  let artifact = readBoundedSourceArtifact(specDir, sourceArtifact);
  if (!artifact) return null;
  if (artifact.verdict === "TOOLING_FAILURE" || artifact.toolingFailure) return null;
  if (phase === "test" && reviewArtifactHasStructuredCoverageFailure(specDir)) return null;
  let findings = reviewFindingsFromArtifact(artifact);
  if (findings.length === 0 || !findings.every(isReviewSemanticFinding)) return null;
  ({ artifact, findings } = persistReviewSourceFindingIds(specDir, sourceArtifact, artifact));
  deferExhaustedSemanticFindings({
    root: ctx.root,
    flowState: ctx.flowState,
    sourceStep: REVIEW_NODE_ID_BY_PHASE[phase],
    sourceArtifact,
    attempts,
  });
  ctx.flowManager.updateStepStatus(REVIEW_NODE_ID_BY_PHASE[phase], "done");
  return reviewDeferredResult(phase, attempts, findings.length);
}

/**
 * Pre-check called from RunReviewCommand.execute. Returns:
 *  - null when count < max (proceed) OR currentTaskId is non-null (R15: task scope skip)
 *  - Envelope.fail(REVIEW_MAX_ATTEMPTS_EXCEEDED) when count >= max
 *  - Envelope.fail(UNKNOWN_REVIEW_PHASE) when phase is not mapped
 */
export function checkReviewRetryBelowMax(ctx, phase) {
  const flowState = ctx?.flowState || {};
  if (flowState.currentTaskId != null) return null; // R15
  const persistedPhase = reviewPhaseKeyForCtx(ctx, phase);
  const count = countReviewRetry(flowState.metrics, persistedPhase);
  let resolvedMax;
  try {
    resolvedMax = resolveReviewRetryMax({ flowState }, persistedPhase);
  } catch (err) {
    if (err.code === "UNKNOWN_REVIEW_PHASE") {
      return Envelope.fail("run", "review", "UNKNOWN_REVIEW_PHASE",
        [`unknown review phase: ${persistedPhase}`],
        { phase: persistedPhase });
    }
    throw err;
  }
  const max = resolveRecoveryMaxAttempts({
    root: ctx.root,
    flowState,
    kind: "review",
    phase: persistedPhase,
    attempts: count,
    resolvedMax,
  });
  if (count < max) return null;
  const deferred = tryDeferReviewRetryExhaustion(ctx, persistedPhase, count);
  if (deferred) return recordReviewDeferral(ctx, deferred, persistedPhase, count);
  mutateReviewRecoveryState(ctx, persistedPhase, REVIEW_RECOVERY_TRIGGER_RETRY_EXHAUSTED);
  const failure = ReviewFailure.maxAttemptsExceeded({ phase: persistedPhase, attempts: count, max });
  const envelope = Envelope.fail("run", "review", "REVIEW_MAX_ATTEMPTS_EXCEEDED",
    [
      `review retry limit exhausted: ${count}/${max} FAIL attempts recorded for phase "${persistedPhase}".`,
      "Resume after changed evidence with `senti flow set retry reset review <phase> --reason <text> --yes`.",
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
 * No-op when phase is task-scope (R15) or unmapped phase.
 * Errors propagate to the dispatcher (R22 — do NOT swallow internally).
 */
export function updateReviewRetryCounter(ctx, result) {
  const flowState = ctx?.flowState || {};
  if (flowState.currentTaskId != null) {
    const stepId = reviewStepId(ctx, "impl");
    const pass = isImplPass(result);
    const outcome = pass
      ? new DecisionOutcome({ decision: "PASS", nextAction: result?.next || "refresh-next-action" })
      : new RetryOutcome({ nextAction: "run-review-task" });
    recordReviewOutcome(ctx, result, "impl", nextStepAttemptNumber(flowState, stepId), outcome);
    return;
  }
  const persistedPhase = result?.artifacts?.retryPhase || reviewPhaseKeyForCtx(ctx, ctx?.phase);
  if (!REVIEW_NODE_ID_BY_PHASE[persistedPhase]) return; // unmapped phase: no-op (post-hook should not crash)
  const mgr = ctx.flowManager;
  if (!mgr) return;
  const attemptsBefore = countReviewRetry(flowState.metrics, persistedPhase);
  let isPass;
  if (persistedPhase === "impl") {
    isPass = isImplPass(result);
  } else {
    if (result?.artifacts?.verdict === "TOOLING_FAILURE") {
      const failure = ReviewFailure.subprocessFailure({
        phase: persistedPhase,
        stderr: result?.artifacts?.toolingFailure || "review tooling failure",
      });
      recordReviewOutcome(ctx, result, persistedPhase, attemptsBefore + 1, reviewExternalBlock(failure));
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
    const deferred = tryDeferReviewRetryExhaustion(ctx, persistedPhase, attemptsBefore + 1);
    if (deferred) {
      Object.assign(result, deferred);
      recordReviewDeferral(ctx, result, persistedPhase, attemptsBefore + 1);
    } else {
      mutateReviewRecoveryState(ctx, persistedPhase, REVIEW_RECOVERY_TRIGGER_VERDICT_FAIL);
      const failure = ReviewFailure.maxAttemptsExceeded({
        phase: persistedPhase,
        attempts: attemptsBefore + 1,
        max: maxAttempts,
      });
      recordReviewOutcome(ctx, result, persistedPhase, attemptsBefore + 1, reviewExternalBlock(failure));
    }
    return;
  }
  if (isPass && typeof mgr.mutate === "function") {
    mgr.mutate((state) => clearReviewStopState(state, persistedPhase));
  }
  const outcome = isPass || result?.next
    ? new DecisionOutcome({
        decision: result?.artifacts?.verdict || (isPass ? "PASS" : "FAIL"),
        nextAction: result?.next || "refresh-next-action",
      })
    : new RetryOutcome({ nextAction: reviewRetryAction(persistedPhase) });
  recordReviewOutcome(ctx, result, persistedPhase, attemptsBefore + 1, outcome);
}

export { REVIEW_PHASE_KEYS };

export function resetImplEvidenceAfterReviewProposals(ctx, result) {
  if (ctx?.phase) return false;
  if ((result?.artifacts?.proposalCount ?? 0) <= 0) return false;
  const specDir = path.dirname(path.resolve(ctx.root, ctx.flowState.spec));
  ctx.flowManager.mutate((state) => {
    resetImplEvidenceStateAfterReviewProposals({ specDir, flowState: state });
  });
  return true;
}

const PHASE_REVIEW_PARSERS = {
  test:  { countPattern: /blocking=(\d+)/,   countKey: "blockingCount",   countWord: "blocking finding(s)",   label: "Test review",  next: "implement",  commandId: "flow.test.review" },
  spec:  { countPattern: /proposalCount=(\d+)/, countKey: "proposalCount", countWord: "proposal(s)", label: "Spec review",  next: "spec-gate", failNext: "spec-triage", commandId: "flow.spec.review.propose" },
  draft: { countPattern: /(questions|findings|issues)=(\d+)/, countKey: "issueCount", countWord: "issue(s)", label: "Draft review", next: "draft-gate", commandId: "flow.draft.review" },
};

function resolvePhaseReviewNextStep({ phase, verdict, retryPhase, next, failNext }) {
  if (phase !== "draft") {
    if (verdict === "PASS" || verdict === "ADVISORY") return next;
    if (verdict === "FAIL") return failNext;
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

function parsePhaseReviewOutput(res, stdout, stderr, { phase, countPattern, countKey, countWord, label, next, failNext = null }) {
  const verdictMatch = stderr.match(REVIEW_VERDICT_PATTERN);
  const countMatch = stderr.match(countPattern);
  const reviewPathMatch = stderr.match(/Results saved to (\S+)/);
  const retryPhaseMatch = stderr.match(/retryPhase=([a-z-]+)/);
  const retryPhase = retryPhaseMatch ? retryPhaseMatch[1] : null;

  const verdict = verdictMatch ? verdictMatch[1] : (res.ok ? "PASS" : "FAIL");
  const count = countMatch ? parseInt(countMatch[countMatch.length - 1], 10) : null;

  const changed = [];
  if (reviewPathMatch) changed.push(reviewPathMatch[1]);

  if (!res.ok) {
    if (verdict === "TOOLING_FAILURE") {
      const artifacts = { phase, verdict, [countKey]: count ?? 0 };
      if (retryPhase) artifacts.retryPhase = retryPhase;
      return {
        result: "tooling-failure",
        changed,
        artifacts,
        next: null,
        output: stdout,
      };
    }
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
    result: verdict === "TOOLING_FAILURE" ? "tooling-failure" : "ok",
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
  const toolingFailureMatch = stderr.match(/toolingFailure=([a-z_]+)/);
  if (toolingFailureMatch) parsed.artifacts.toolingFailure = toolingFailureMatch[1];
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
  const blockingMatch = stderr.match(/blocking=(\d+)/);
  const nonBlockingMatch = stderr.match(/nonBlocking=(\d+)/);
  const reviewPathMatch = stderr.match(/Results saved to (\S+)/);
  const jsonPathMatch = stderr.match(/JSON saved to (\S+)/);
  const taskIdMatch = stderr.match(/taskId=(\S+)/);
  const targetMatch = stderr.match(/target=(\S+)/);

  const changed = [];
  if (reviewPathMatch) changed.push(reviewPathMatch[1]);
  if (jsonPathMatch) changed.push(jsonPathMatch[1]);

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
    next: verdict === "FAIL" ? null : "impl-gate",
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
  if (ctx?.phase !== "test") return;
  if (result?.artifacts?.verdict !== "TOOLING_FAILURE") return;
  const artifactPath = result?.changed?.find((p) => /test-review\.(json|md)$/.test(p));
  appendIssueLogEntry(ctx.root, ctx.flowState?.spec, {
    step: "test-review",
    phase: "test",
    failureKind: "tooling_failure",
    reason: `test-review tooling failure: ${result.artifacts.toolingFailure || "see test-review artifacts"}`,
    trigger: "test-review post hook (auto)",
    resolution: "Recover the tooling failure or record an explicit evidence-based override before proceeding.",
    ...(artifactPath && { artifact: artifactPath }),
    timestamp: new Date().toISOString(),
  });
}

const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 3000;
const MAX_REVIEW_SUBPROCESS_RETRIES = 2;
const MAX_REVIEW_SUBPROCESS_RETRY_DELAY_MS = 30_000;

function normalizeReviewSubprocessRetryCount(value) {
  const parsed = Number(value ?? DEFAULT_RETRY_COUNT);
  if (!Number.isFinite(parsed)) return DEFAULT_RETRY_COUNT;
  return Math.min(MAX_REVIEW_SUBPROCESS_RETRIES, Math.max(0, Math.trunc(parsed)));
}

function normalizeReviewSubprocessRetryDelayMs(value) {
  const parsed = Number(value ?? DEFAULT_RETRY_DELAY_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_RETRY_DELAY_MS;
  return Math.min(MAX_REVIEW_SUBPROCESS_RETRY_DELAY_MS, Math.max(0, Math.trunc(parsed)));
}

/**
 * Run a command function with mechanical subprocess retry logic.
 * This does not consume the step retry budget; review verdict FAIL is handled separately.
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

    if (attempt < retryCount) {
      if (!failure.shouldRetrySubprocess({ attempt: attempt + 1, maxAttempts: retryCount + 1 })) {
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

export class RunReviewCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const phase = ctx.phase || null;

    if (phase && !VALID_REVIEW_PHASES.includes(phase)) {
      // spec 253 R8: return Envelope.fail with UNKNOWN_REVIEW_PHASE for unknown
      // CLI phase values (uniform fail-closed contract — no throw, no max-attempts
      // bypass via unknown phase).
      return Envelope.fail("run", "review", "UNKNOWN_REVIEW_PHASE",
        [`invalid phase: ${phase} (valid: ${VALID_REVIEW_PHASES.join(", ")})`],
        { phase });
    }

    // spec 253: enforce review maxAttempts (R2 R3) before any subprocess work
    const preCheck = checkReviewRetryBelowMax(ctx, phase);
    if (preCheck) return preCheck;
    const persistedPhase = reviewPhaseKeyForCtx(ctx, phase);
    if (ctx.flowManager) {
      ctx.flowManager.mutate((state) => clearReviewStopState(state, persistedPhase));
    }

    const dryRun = ctx.dryRun || false;
    const skipConfirm = ctx.skipConfirm || false;
    let taskReviewSpec = null;
    let broadMode = null;

    if (isImplementationReviewPhase(phase)) {
      const decision = evaluateTaskScope(ctx.flowState, "impl-review");
      if (decision.kind === "invalid-current-task" || decision.kind === "blocked" || decision.promotable) {
        return taskCursorRequiredReviewFailure(decision, ctx.flowState);
      }
      if (decision.kind === "task") {
        const taskSpec = resolveCurrentTaskSpec({ root, state: ctx.flowState });
        taskReviewSpec = taskSpec;
      } else if (decision.kind === "broad") {
        broadMode = assertAuditedBroadMode(decision, "impl-review");
      }
    }

    const scriptPath = path.join(PKG_DIR, "flow", "commands", "review.js");
    const args = [];
    if (phase && phase !== IMPL_REVIEW_PHASE) args.push("--phase", phase);
    if (taskReviewSpec) args.push("--task-spec", taskReviewSpec.relPath);
    if (dryRun) args.push("--dry-run");
    if (skipConfirm) args.push("--skip-confirm");

    const agentTimeout = ctx.config?.agent?.timeout;
    const timeoutMs = agentTimeout != null ? Number(agentTimeout) * 1000 : DEFAULT_AGENT_TIMEOUT_MS;
    const res = await runCmdWithRetry(
      () => runCmd("node", [scriptPath, ...args], { cwd: root, timeout: timeoutMs }),
      { phase: persistedPhase },
    );

    const stdout = (res.stdout || "").trim();
    const stderr = (res.stderr || "").trim();
    if (!res.ok) {
      const failure = ReviewFailure.fromSubprocessResult({ phase: persistedPhase, result: res });
      if (failure.shouldPersistStopState()) {
        const persisted = mutateReviewRecoveryState(
          ctx,
          persistedPhase,
          REVIEW_RECOVERY_TRIGGER_STOP,
          (state) => writeReviewStopState(state, failure),
        );
        if (!persisted) writeReviewStopState(ctx.flowState, failure);
        const envelope = Envelope.fail("run", "review", failure.toEnvelopeCode(),
          [`review stopped: ${failure.reason}`],
          failure.toEnvelopeData());
        const attempt = recordReviewOutcome(
          ctx,
          null,
          persistedPhase,
          countReviewRetry(ctx.flowState.metrics, persistedPhase) + 1,
          reviewExternalBlock(failure),
        );
        if (attempt) envelope.data = { ...envelope.data, stepAttempt: attempt.toJSON() };
        return envelope;
      }
      recordReviewOutcome(
        ctx,
        null,
        persistedPhase,
        countReviewRetry(ctx.flowState.metrics, persistedPhase) + 1,
        reviewExternalBlock(failure),
      );
    }

    // Route to draft review parser
    if (phase === "draft") {
      return parseProposalReviewOutput(res, stdout, stderr);
    }

    // Route to test review parser
    if (phase === "test") {
      return parseTestReviewOutput(res, stdout, stderr);
    }

    // Route to spec review parser
    if (phase === "spec") {
      return parseSpecReviewOutput(res, stdout, stderr);
    }

    if (!res.ok) {
      throw new Error(
        ["review command failed", ...(stderr ? [stderr] : []), ...(stdout ? [stdout] : [])].join("\n"),
      );
    }

    const parsed = parseImplReviewOutput(res, stdout, stderr, { root });
    parsed.artifacts.dryRun = dryRun;
    if (broadMode) parsed.artifacts.broadMode = broadMode;
    return parsed;
  }
}

export default RunReviewCommand;
export {
  resolveDraftReviewNextStep,
};
