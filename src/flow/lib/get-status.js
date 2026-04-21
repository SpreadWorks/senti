/**
 * src/flow/lib/get-status.js
 *
 * Return current flow state summary.
 * Supports optional runId argument for runId-based resolution.
 */

import { derivePhase } from "../../lib/flow-helpers.js";
import { FlowCommand } from "./base-command.js";

/** Token sub-fields that the Logger / flow-store emit per agent entry. */
export const TOKEN_KEYS = ["input", "output", "cacheRead", "cacheCreation"];

/** Activity counter names consumed by the Report view (flat aggregates). */
export const ACTIVITY_COUNTERS = ["docsRead", "srcRead", "question", "issueLog"];

/** Fresh zero-filled token accumulator (never share the literal — callers mutate). */
function zeroTokens() {
  return Object.fromEntries(TOKEN_KEYS.map((k) => [k, 0]));
}

/**
 * Build an aggregated metricsSummary view over the flat append-only
 * `state.metrics` entry array. Returns `{ flow, tasks: { <id>: {...} }, total }`,
 * where each leaf is `{ <phase>: { <counter>: N, ... } }` with agent-call
 * aggregates (callCount, responseChars, durationMs, tokens, cost, models)
 * summed when present.
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
  if (entry.model) {
    p.models = p.models || {};
    p.models[entry.model] = (p.models[entry.model] || 0) + 1;
  }
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

function buildStatusOutput(state) {
  const phase = state.steps ? derivePhase(state) : null;
  const doneSteps = state.steps ? state.steps.filter((s) => s.status === "done").length : 0;
  const totalSteps = state.steps ? state.steps.length : 0;
  const doneReqs = state.requirements ? state.requirements.filter((r) => r.status === "done").length : 0;
  const totalReqs = state.requirements ? state.requirements.length : 0;

  // autoApprove is always false in preparing state
  const autoApprove = state.lifecycle === "preparing" ? false : (state.autoApprove || false);

  return {
    active: true,
    spec: state.spec,
    baseBranch: state.baseBranch,
    featureBranch: state.featureBranch,
    worktree: state.worktree || false,
    issue: state.issue || null,
    runId: state.runId || null,
    lifecycle: state.lifecycle || null,
    phase,
    steps: state.steps || [],
    stepsProgress: { done: doneSteps, total: totalSteps },
    requirements: state.requirements || [],
    requirementsProgress: { done: doneReqs, total: totalReqs },
    request: state.request || null,
    notes: state.notes || [],
    metrics: state.metrics || [],
    metricsSummary: buildMetricsSummary(state.metrics || []),
    mergeStrategy: state.mergeStrategy || null,
    autoApprove,
  };
}

export default class GetStatusCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  execute(ctx) {
    const runId = ctx.runId;

    if (runId) {
      // runId-based resolution
      const state = ctx.flowManager.resolveByRunId(runId);
      if (!state) {
        throw new Error(`RUN_ID_NOT_FOUND: ${runId}`);
      }
      return buildStatusOutput(state);
    }

    // Default: context-based resolution. No active flow is a normal state,
    // not an error — consumers discriminate via the `active` field.
    if (!ctx.flowState) {
      return { active: false };
    }
    return buildStatusOutput(ctx.flowState);
  }
}
