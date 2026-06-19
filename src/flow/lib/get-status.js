/**
 * src/flow/lib/get-status.js
 *
 * Return current flow state summary.
 * Supports optional runId argument for runId-based resolution.
 */

import { derivePhase } from "../../lib/flow-helpers.js";
import fs from "node:fs";
import path from "node:path";
import { normalizeAgentMetricDimension } from "../../lib/agent-metrics.js";
import { BROAD_MODE_HISTORY_MAX_ENTRIES } from "../../lib/constants.js";
import { loadSpecRequirements } from "../../lib/spec-json.js";
import { findLatestInProgressLeaf, resolveMaxAttempts } from "../definition.js";
import { flattenSteps } from "./step-tree.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import {
  FlowTargetExpectation,
  buildTargetMismatchEnvelope,
  targetMismatchEnvelopeForInput,
} from "../../lib/flow-target-guard.js";
import { buildReviewStopView, reviewPhaseForStepId } from "./review-failure.js";
import { resolveGateRecoveryDisplayPhase } from "./gate-recovery-display.js";
import { countReviewRetry } from "./run-review.js";
import { buildStateRetryRecoveryView, resolveRecoveryMaxAttempts } from "./retry-recovery.js";
import { buildBoundedBroadModeHistory } from "./task-scope.js";
import { buildDeferredFindingsSummary, specDirFromFlowState } from "./flow-findings.js";
import { validateFinalRegressionResult } from "./test-artifacts.js";

/** Token sub-fields that the Logger / flow-store emit per agent entry. */
export const TOKEN_KEYS = ["input", "output", "cacheRead", "cacheCreation"];

/** Activity counter names consumed by the Report view (flat aggregates). */
export const ACTIVITY_COUNTERS = ["docsRead", "srcRead", "question", "issueLog"];

/** Fresh zero-filled token accumulator (never share the literal — callers mutate). */
function zeroTokens() {
  return Object.fromEntries(TOKEN_KEYS.map((k) => [k, 0]));
}

function zeroProviderBucket() {
  return {
    callCount: 0,
    responseChars: 0,
    durationMs: 0,
    tokens: zeroTokens(),
    cost: 0,
    costIncomplete: false,
    models: {},
  };
}

/**
 * Build an aggregated metricsSummary view over the flat append-only
 * `state.metrics` entry array. Returns `{ flow, tasks: { <id>: {...} }, total }`,
 * where each leaf is `{ <phase>: { <counter>: N, ... } }` with agent-call
 * aggregates (callCount, responseChars, durationMs, tokens, cost, models)
 * summed when present.
 *
 * spec 253 R28: This summary is **audit-only raw totals**. Reset entries
 * (e.g. `{ counter: "gateRetry"|"reviewRetry", reset: true }` from
 * `flow set retry reset ...`) are NOT interpreted here — the raw FAIL
 * count accumulates across resets so the audit trail is preserved.
 * Consumers needing the *current* retry count (post-reset) must call
 * `countGateRetry` / `countReviewRetry` instead.
 */
export function buildMetricsSummary(entries) {
  const summary = { flow: {}, tasks: {}, total: {} };
  if (!Array.isArray(entries) || entries.length === 0) return summary;

  for (const entry of entries) {
    if (!entry || !entry.phase) continue;
    const taskId = entry.taskId ?? null;
    const bucket = taskId == null
      ? summary.flow
      : (summary.tasks[taskId] = summary.tasks[taskId] || {});
    applyEntry(bucket, entry);
    applyEntry(summary.total, entry);
  }
  return summary;
}

function applyEntry(bucket, entry) {
  const p = bucket[entry.phase] = bucket[entry.phase] || {};
  if (entry.counter) {
    p[entry.counter] = (p[entry.counter] || 0) + (entry.delta ?? 1);
  }
  if (entry.kind !== "agent") return;
  p.callCount = (p.callCount || 0) + (entry.callCount || 0);
  p.responseChars = (p.responseChars || 0) + (entry.responseChars || 0);
  if (entry.durationMs != null) p.durationMs = (p.durationMs || 0) + entry.durationMs;
  if (entry.tokens) {
    p.tokens = p.tokens || zeroTokens();
    for (const k of TOKEN_KEYS) p.tokens[k] += entry.tokens[k] || 0;
  }
  if (entry.cost != null) p.cost = (p.cost || 0) + entry.cost;
  if (entry.costIncomplete) p.costIncomplete = true;
  if (entry.model) {
    p.models = p.models || {};
    p.models[entry.model] = (p.models[entry.model] || 0) + 1;
  }
  applyProviderEntry(p, entry);
}

function applyProviderEntry(phaseBucket, entry) {
  const provider = normalizeAgentMetricDimension(entry.provider);
  const profileKey = normalizeAgentMetricDimension(entry.profileKey);
  phaseBucket.providers = phaseBucket.providers || {};
  const providerBucket = phaseBucket.providers[provider] = phaseBucket.providers[provider] || {};
  const bucket = providerBucket[profileKey] = providerBucket[profileKey] || zeroProviderBucket();

  bucket.callCount += entry.callCount || 0;
  bucket.responseChars += entry.responseChars || 0;
  if (entry.durationMs != null) bucket.durationMs += entry.durationMs;
  if (entry.tokens) {
    for (const k of TOKEN_KEYS) bucket.tokens[k] += entry.tokens[k] || 0;
  }
  if (entry.cost != null) bucket.cost += entry.cost;
  if (entry.costIncomplete) bucket.costIncomplete = true;
  if (entry.model) bucket.models[entry.model] = (bucket.models[entry.model] || 0) + 1;
}

/**
 * Extract report-shape totals (activity counters + agent runtime metrics) from
 * a `metricsSummary.total` view. The report uses a flattened token shape
 * (`input`/`output`/… on the root of `tokens`), so this path cannot share the
 * `mergeAgentAggregates` routine directly; it iterates per-phase and pulls
 * duration into a list.
 */
export function buildReportTotals(summaryTotal) {
  const activity = Object.fromEntries(ACTIVITY_COUNTERS.map((k) => [k, 0]));
  const tokens = { ...zeroTokens(), cost: null, callCount: 0, durationMs: 0, phaseDurations: [] };
  for (const [phase, data] of Object.entries(summaryTotal || {})) {
    for (const k of ACTIVITY_COUNTERS) activity[k] += data[k] || 0;
    if (data.tokens) for (const k of TOKEN_KEYS) tokens[k] += data.tokens[k] || 0;
    if (data.cost != null) tokens.cost = (tokens.cost || 0) + data.cost;
    tokens.callCount += data.callCount || 0;
    if (data.durationMs) {
      tokens.durationMs += data.durationMs;
      tokens.phaseDurations.push({ phase, durationMs: data.durationMs });
    }
  }
  return { activity, tokens };
}

function resolveActiveStepMaxAttempts(state, active) {
  if (!active?.id) return null;
  const maxAttempts = resolveMaxAttempts({ scope: "flow", stepId: active.id, context: state });
  return Number.isSafeInteger(maxAttempts) && maxAttempts >= 1 ? maxAttempts : null;
}

function buildStatusReviewViews(state, active, root) {
  const reviewPhase = reviewPhaseForStepId(active?.id);
  if (!reviewPhase) return null;
  const resolvedMaxAttempts = resolveActiveStepMaxAttempts(state, active);
  if (resolvedMaxAttempts == null) return null;
  const attempts = countReviewRetry(state.metrics, reviewPhase);
  const recoveryMaxAttempts = resolveRecoveryMaxAttempts({
    flowState: state,
    kind: "review",
    phase: reviewPhase,
    attempts,
    resolvedMax: resolvedMaxAttempts,
  });
  const reviewStop = buildReviewStopView(state, {
    surface: "status",
    phase: reviewPhase,
    maxAttempts: recoveryMaxAttempts,
  });
  const retryRecovery = buildStatusRetryRecoveryView(root, state, {
    kind: "review",
    phase: reviewPhase,
    attempts,
    max: recoveryMaxAttempts,
  });
  return { reviewStop, retryRecovery };
}

function buildStatusRetryRecoveryView(root, flowState, input) {
  return buildStateRetryRecoveryView({
    root,
    flowState,
    ...input,
  });
}

function buildFinalRegressionStatus(root, state) {
  if (!state?.spec) return null;
  const resultPath = path.join(path.dirname(path.resolve(root, state.spec)), "final-regression-result.json");
  if (!fs.existsSync(resultPath)) return null;
  const artifact = validateFinalRegressionResult(JSON.parse(fs.readFileSync(resultPath, "utf8")));
  return {
    result: artifact.result,
    completed: artifact.completed,
    failureKind: artifact.failureKind,
    failureCategory: artifact.failureCategory || null,
    rawOutputPath: artifact.rawOutputPath,
    fixAttempts: artifact.fixAttempts ?? null,
    selectedAction: artifact.selectedAction || null,
    remainingRisk: artifact.remainingRisk || null,
    nextAction: artifact.nextAction,
    nextRecommendedAction: artifact.nextRecommendedAction || null,
  };
}

function buildStatusGateViews(state, active, root) {
  if (!active || !active.id.endsWith("-gate")) return null;
  const resolvedMaxAttempts = resolveActiveStepMaxAttempts(state, active);
  if (resolvedMaxAttempts == null) return null;
  const gateRecoveryDisplay = resolveGateRecoveryDisplayPhase({
    flowState: state,
    stepId: active.id,
    maxAttempts: resolvedMaxAttempts,
  });
  if (!gateRecoveryDisplay) return null;
  const retryRecovery = buildStatusRetryRecoveryView(root, state, {
    kind: "gate",
    phase: gateRecoveryDisplay.phase,
    attempts: gateRecoveryDisplay.attempts,
    max: gateRecoveryDisplay.max,
  });
  const gateStop = retryRecovery?.attempts >= retryRecovery?.max ? retryRecovery : null;
  return { gateStop, retryRecovery };
}

function validateRunId(runId) {
  if (runId == null) return null;
  if (typeof runId !== "string" || runId.length < 1 || runId.length > 200) {
    throw new Error("invalid runId: expected a non-empty string token from 1 to 200 characters");
  }
  return runId;
}

function buildStatusOutput(state, root, options = {}) {
  const details = options.details === true;
  const phase = state.steps ? derivePhase(state) : null;
  // spec 251 R42: count leaf steps via flattenSteps so nested impl-phase
  // children (test-execute, test-result-review, retro, finalize-*) are
  // reflected accurately in stepsProgress.
  const leafSteps = state.steps ? flattenSteps(state.steps) : [];
  const active = findLatestInProgressLeaf(leafSteps);
  const doneSteps = leafSteps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const totalSteps = leafSteps.length;
  const requirements = loadSpecRequirements(root, state.spec);
  const doneReqs = requirements.filter((r) => r.status === "done").length;
  const totalReqs = requirements.length;
  const reviewViews = buildStatusReviewViews(state, active, root);
  const reviewStop = reviewViews?.reviewStop || null;
  const gateViews = buildStatusGateViews(state, active, root);
  const retryRecovery = reviewViews?.retryRecovery || gateViews?.retryRecovery || null;

  // autoApprove is always false in preparing state
  const autoApprove = state.lifecycle === "preparing" ? false : (state.autoApprove || false);
  const deferredFindings = state.spec
    ? buildDeferredFindingsSummary({ specDir: specDirFromFlowState(root, state) })
    : { count: 0, sourceSteps: [], artifactPath: "flow-findings.json" };
  const finalRegression = buildFinalRegressionStatus(root, state);

  const output = {
    active: true,
    spec: state.spec,
    baseBranch: state.baseBranch,
    featureBranch: state.featureBranch,
    worktree: state.worktree || false,
    issue: state.issue || null,
    runId: state.runId || null,
    phase,
    steps: state.steps || [],
    stepsProgress: { done: doneSteps, total: totalSteps },
    requirements,
    requirementsProgress: { done: doneReqs, total: totalReqs },
    ...(deferredFindings.count > 0 && { deferredFindings }),
    ...(finalRegression && { finalRegression }),
    ...(retryRecovery && { retryRecovery }),
    mergeStrategy: state.mergeStrategy || null,
    autoApprove,
  };

  if (!details) return output;

  const broadMode = buildBoundedBroadModeHistory(state, BROAD_MODE_HISTORY_MAX_ENTRIES);
  return {
    ...output,
    request: state.request || null,
    notes: state.notes || [],
    metrics: state.metrics || [],
    metricsSummary: buildMetricsSummary(state.metrics || []),
    ...(reviewStop && { reviewStop }),
    ...(gateViews?.gateStop && { gateStop: gateViews.gateStop }),
    broadModeHistory: broadMode.entries,
    broadModeHistoryTotal: broadMode.total,
    broadModeHistoryTruncated: broadMode.truncated,
  };
}

export default class GetStatusCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false, targetGuard: false });
  }

  execute(ctx) {
    const runId = validateRunId(ctx.runId);
    const currentContextMismatch = targetMismatchEnvelopeForInput({
      type: "get",
      key: "status",
      input: { expectSpec: ctx.expectSpec, expectRunId: ctx.expectRunId },
      flowState: ctx.flowState,
    });
    if (currentContextMismatch) return currentContextMismatch;
    const options = { details: ctx.details === true };

    if (runId) {
      // runId-based resolution
      const state = ctx.flowManager.resolveByRunId(runId);
      if (!state) {
        throw new Error(`RUN_ID_NOT_FOUND: ${runId}`);
      }
      const status = buildStatusOutput(state, ctx.root, options);
      try {
        const expectation = new FlowTargetExpectation({ expectIssue: ctx.expectIssue });
        const mismatch = expectation.mismatchAgainst(state);
        return mismatch ? buildTargetMismatchEnvelope({ type: "get", key: "status", data: mismatch }) : status;
      } catch (err) {
        return Envelope.fail("get", "status", "ARGS_ERROR", err.message);
      }
    }

    // Default: context-based resolution. No active flow is a normal state,
    // not an error — consumers discriminate via the `active` field.
    if (!ctx.flowState) {
      return { active: false };
    }
    const status = buildStatusOutput(ctx.flowState, ctx.root, options);
    return targetMismatchEnvelopeForInput({
      type: "get",
      key: "status",
      input: ctx,
      flowState: ctx.flowState,
    }) || status;
  }
}
