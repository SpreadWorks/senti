/**
 * src/flow/lib/get-status.js
 *
 * Return current flow state summary.
 * Supports optional runId argument for runId-based resolution.
 */

import { derivePhase } from "../../lib/flow-helpers.js";
import { normalizeAgentMetricDimension } from "../../lib/agent-metrics.js";
import { BROAD_MODE_HISTORY_MAX_ENTRIES } from "../../lib/constants.js";
import { findLatestInProgressLeaf, resolveMaxAttempts } from "../definition.js";
import { flattenSteps } from "./step-tree.js";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import {
  FlowTargetExpectation,
  buildTargetMismatchEnvelope,
  targetMismatchEnvelopeForInput,
} from "../../lib/flow-target-guard.js";
import { resolveGateRecoveryDisplayPhase } from "./gate-recovery-display.js";
import { buildStateRetryRecoveryView, captureRetryRecoveryBaseline, readRetryBaseline, retryEvidenceRouteForNode } from "./retry-recovery.js";
import { buildBoundedBroadModeHistory } from "./task-scope.js";
import { FlowFindingsArtifact } from "./flow-findings.js";
import { validateFinalRegressionResult } from "./test-artifacts.js";
import { CanonicalCommandAttemptArtifactHistory } from "./canonical-command-result.js";
import { FlowCompletion } from "./flow-completion.js";
import { advisorySummary } from "./nonblocking.js";
import { CanonicalSpecRecord } from "./canonical-spec-record.js";
import { FLOW_ARTIFACT_CONTRACTS } from "../../lib/flow-artifact-contract.js";

/** Token sub-fields that the Logger / canonical command view emit per agent entry. */
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
  const maxAttempts = resolveMaxAttempts({
    scope: active.id === "task-review" ? "task" : "flow",
    stepId: active.id,
    context: state,
  });
  return Number.isSafeInteger(maxAttempts) && maxAttempts >= 1 ? maxAttempts : null;
}

function buildStatusRetryRecoveryView(root, flowState, input, options = {}) {
  let baselineAvailable = false;
  let currentChanged = false;
  const nodeId = flowState?.attempt?.nodeId ?? null;
  const route = nodeId === null ? null : retryEvidenceRouteForNode(flowState, nodeId);
  if (route !== null && options.flowManager) {
    try {
      const baseline = readRetryBaseline(options.flowManager, flowState, route);
      const current = baseline === null ? null : captureRetryRecoveryBaseline({
        flowState,
        flowManager: options.flowManager,
        executionRoot: options.executionRoot || root,
        artifactRoot: options.artifactRoot || options.flowManager.mainRoot || root,
        nodeId,
      });
      baselineAvailable = baseline !== null;
      currentChanged = current !== null
        && ["projectDigest", "runtimeDigest", "targetDigest"].some((field) => current[field] !== baseline[field]);
    } catch {
      baselineAvailable = false;
      currentChanged = false;
    }
  }
  return buildStateRetryRecoveryView({
    root,
    flowState,
    baselineAvailable,
    currentChanged,
    ...input,
  });
}

function finalRegressionStatus(artifact) {
  if (artifact === null) return null;
  validateFinalRegressionResult(artifact);
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
  };
}

class CanonicalStatusArtifacts {
  constructor({ flowManager, state } = {}) {
    if (!flowManager || typeof flowManager.readArtifact !== "function") {
      throw new Error("canonical status requires FlowManager.readArtifact");
    }
    if (state?.schemaRevision !== 3 || typeof state.specId !== "string" || state.specId === "") {
      throw new Error("canonical status requires a Version-1 Flow state");
    }
    this.flowManager = flowManager;
    this.specId = state.specId;
    this.runId = state.runId;
    Object.freeze(this);
  }

  #read(logicalKey, { optional = false } = {}) {
    return this.flowManager.readArtifact({
      specId: this.specId,
      logicalKey,
      consumerNodeId: "flow",
      optional,
    });
  }

  requirements() {
    return new CanonicalSpecRecord({
      flowManager: this.flowManager,
      state: { schemaRevision: 3, specId: this.specId },
      consumerNodeId: "system",
    }).requirements();
  }

  finalRegression() {
    const resolved = this.#read("final.regression", { optional: true });
    if (resolved === null) return null;
    return CanonicalCommandAttemptArtifactHistory.fromBytes({
      logicalKey: "final.regression",
      bytes: resolved.bytes,
    }).current.payload;
  }

  deferredFindings() {
    const resolved = this.#read("flow.findings", { optional: true });
    if (resolved === null) return {
      count: 0,
      sourceSteps: [],
      artifactPath: FLOW_ARTIFACT_CONTRACTS.resolve("flow.findings").relativePath,
    };
    const stored = new FlowFindingsArtifact(JSON.parse(resolved.bytes.toString("utf8")));
    const entries = stored.entries.filter((entry) => entry.runId === this.runId);
    return {
      count: entries.length,
      sourceSteps: [...new Set(entries.map((entry) => entry.sourceStep))],
      artifactPath: resolved.relativePath,
    };
  }
}

function buildStatusGateViews(state, active, root, options = {}) {
  if (!active || !active.id.endsWith("-gate")) return null;
  const resolvedMaxAttempts = resolveActiveStepMaxAttempts(state, active);
  if (resolvedMaxAttempts == null) return null;
  const gateRecoveryDisplay = resolveGateRecoveryDisplayPhase({
    root,
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
  }, options);
  const gateStop = retryRecovery?.attempts >= retryRecovery?.max ? retryRecovery : null;
  return { gateStop, retryRecovery };
}

function buildStatusReviewViews(state, active, root, options = {}) {
  if (!active || !active.id.endsWith("-review") || state.attempt?.failure == null) return null;
  const route = retryEvidenceRouteForNode(state, active.id);
  const resolvedMaxAttempts = resolveActiveStepMaxAttempts(state, active);
  if (route === null || resolvedMaxAttempts == null) return null;
  const retryRecovery = buildStatusRetryRecoveryView(root, state, {
    kind: "review",
    phase: route.phase,
    attempts: state.attempt?.sequence ?? 0,
    max: resolvedMaxAttempts,
  }, options);
  return retryRecovery === null ? null : { retryRecovery };
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
  const artifacts = state?.schemaRevision === 3
    ? new CanonicalStatusArtifacts({ flowManager: options.flowManager, state })
    : null;
  const phase = state.steps ? derivePhase(state) : null;
  // spec 251 R42: count leaf steps via flattenSteps so nested impl-phase
  // children (test-execute, test-result-review, retro, finalize-*) are
  // reflected accurately in stepsProgress.
  const leafSteps = state.steps ? flattenSteps(state.steps) : [];
  const active = findLatestInProgressLeaf(leafSteps);
  const doneSteps = leafSteps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const totalSteps = leafSteps.length;
  const requirements = artifacts ? artifacts.requirements() : [];
  const doneReqs = requirements.filter((r) => r.status === "done").length;
  const totalReqs = requirements.length;
  const reviewAction = null;
  const gateViews = state.specId ? buildStatusGateViews(state, active, root, options) : null;
  const reviewViews = state.specId ? buildStatusReviewViews(state, active, root, options) : null;
  const retryRecovery = reviewViews?.retryRecovery || gateViews?.retryRecovery || null;
  const recoveryDiagnostics = (
    reviewAction
    || retryRecovery
    || gateViews?.gateStop
  ) ? {
      ...(reviewAction && { review: reviewAction }),
      ...(reviewViews?.retryRecovery && { review: reviewViews.retryRecovery }),
      ...(gateViews?.retryRecovery && { gate: gateViews.retryRecovery }),
      ...(gateViews?.gateStop && { gateStopped: true }),
    } : null;

  // autoApprove is always false in preparing state
  const autoApprove = state.lifecycle === "preparing" ? false : (state.autoApprove || false);
  const deferredFindings = artifacts
    ? artifacts.deferredFindings()
    : {
      count: 0,
      sourceSteps: [],
      artifactPath: FLOW_ARTIFACT_CONTRACTS.resolve("flow.findings").relativePath,
    };
  const finalRegression = finalRegressionStatus(artifacts?.finalRegression() ?? null);
  const completion = new FlowCompletion(state);
  const advisory = advisorySummary(state);

  const output = {
    active: completion.active,
    specId: state.specId,
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
    ...(recoveryDiagnostics && { recoveryDiagnostics }),
    mergeStrategy: state.mergeStrategy || null,
    autoApprove,
    completion: completion.toJSON(),
    assurance: advisory.length > 0 ? "advisory" : "strict",
    ...(state.policy?.nonblocking?.enabled === true && { nonblocking: state.policy.nonblocking }),
    ...(advisory.length > 0 && { advisorySummary: advisory }),
  };

  if (!details) return output;

  const broadMode = buildBoundedBroadModeHistory(state, BROAD_MODE_HISTORY_MAX_ENTRIES);
  return {
    ...output,
    request: state.request || null,
    notes: state.notes || [],
    metrics: state.metrics || [],
    metricsSummary: buildMetricsSummary(state.metrics || []),
    broadModeHistory: broadMode.entries,
    broadModeHistoryTotal: broadMode.total,
    broadModeHistoryTruncated: broadMode.truncated,
  };
}

export default class GetStatusCommand extends FlowCommand {
  constructor() {
    super({
      requiresFlow: false,
      targetGuard: false,
      explicitTargetResolution: true,
      positionalRunIdTarget: true,
    });
  }

  execute(ctx) {
    const runId = validateRunId(ctx.runId);
    const options = { details: ctx.details === true };

    if (ctx.flowResolutionError) {
      return Envelope.fail(
        "get",
        "status",
        ctx.flowResolutionError.code || "FLOW_TARGET_NOT_FOUND",
        ctx.flowResolutionError.message,
        ctx.flowResolutionError.data,
      );
    }

    if (runId) {
      // The binding already selected the only permissible worktree target.
      // A positional runId validates that state instead of redirecting it.
      const resolvedState = ctx.preparingFlowState ?? ctx.flowState;
      const state = resolvedState || ctx.flowManager.resolveByRunId(runId);
      if (!state) {
        throw new Error(`RUN_ID_NOT_FOUND: ${runId}`);
      }
      const status = buildStatusOutput(state, ctx.root, {
        ...options,
        executionRoot: ctx.executionRoot || ctx.root,
        flowManager: ctx.flowManager,
      });
      try {
        const positionalExpectation = new FlowTargetExpectation({ expectRunId: runId });
        const positionalMismatch = positionalExpectation.mismatchAgainst(state);
        if (positionalMismatch) {
          return buildTargetMismatchEnvelope({ type: "get", key: "status", data: positionalMismatch });
        }
        const expectation = new FlowTargetExpectation({
          expectIssue: ctx.expectIssue,
          expectNoIssue: ctx.expectNoIssue,
          expectSpec: ctx.expectSpec,
          expectRunId: ctx.expectRunId,
        });
        const mismatch = expectation.mismatchAgainst(state);
        return mismatch ? buildTargetMismatchEnvelope({
          type: "get",
          key: "status",
          data: {
            ...mismatch,
            ...(!("expectedRunId" in mismatch) && {
              expectedRunId: runId,
              activeRunId: state.runId || null,
            }),
          },
        }) : status;
      } catch (err) {
        return Envelope.fail("get", "status", "ARGS_ERROR", err.message);
      }
    }

    const currentContextMismatch = targetMismatchEnvelopeForInput({
      type: "get",
      key: "status",
      input: { expectSpec: ctx.expectSpec, expectRunId: ctx.expectRunId },
      flowState: ctx.flowState,
    });
    if (currentContextMismatch) return currentContextMismatch;

    // Default: context-based resolution. No active flow is a normal state,
    // not an error — consumers discriminate via the `active` field.
    if (!ctx.flowState) {
      return { active: false };
    }
    const status = buildStatusOutput(ctx.flowState, ctx.root, {
      ...options,
      executionRoot: ctx.executionRoot || ctx.root,
      flowManager: ctx.flowManager,
    });
    return targetMismatchEnvelopeForInput({
      type: "get",
      key: "status",
      input: ctx,
      flowState: ctx.flowState,
    }) || status;
  }
}
