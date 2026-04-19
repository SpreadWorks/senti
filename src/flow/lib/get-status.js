/**
 * src/flow/lib/get-status.js
 *
 * Return current flow state summary.
 * Supports optional runId argument for runId-based resolution.
 */

import { derivePhase } from "../../lib/flow-helpers.js";
import { FlowCommand } from "./base-command.js";

function buildStatusOutput(state) {
  const phase = state.steps ? derivePhase(state) : null;
  const doneSteps = state.steps ? state.steps.filter((s) => s.status === "done").length : 0;
  const totalSteps = state.steps ? state.steps.length : 0;
  const doneReqs = state.requirements ? state.requirements.filter((r) => r.status === "done").length : 0;
  const totalReqs = state.requirements ? state.requirements.length : 0;

  // autoApprove is always false in preparing state
  const autoApprove = state.lifecycle === "preparing" ? false : (state.autoApprove || false);

  return {
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
    metrics: state.metrics || null,
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

    // Default: context-based resolution (backward compatible)
    if (!ctx.flowState) {
      throw new Error("no active flow (flow.json not found)");
    }
    return buildStatusOutput(ctx.flowState);
  }
}
