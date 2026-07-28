import fs from "node:fs";
import path from "node:path";

import { Envelope } from "../../lib/flow-envelope.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { WorktreeFlowProvenance } from "../../lib/worktree-flow-binding.js";
import { getFlowBranchLeafIds } from "../definition.js";
import { FinalizeFlowStateOwner } from "./finalize-flow-state-owner.js";
import { findStepById } from "./step-tree.js";

class FinalizeFlowIdentity {
  constructor(state, label) {
    if (!state || typeof state !== "object") throw new Error(`${label} flow state is required`);
    if (typeof state.runId !== "string" || state.runId.trim() === "") {
      throw new Error(`${label} flow state requires runId`);
    }
    if (typeof state.spec !== "string" || state.spec.trim() === "") {
      throw new Error(`${label} flow state requires spec`);
    }
    this.runId = state.runId;
    this.spec = state.spec;
    this.issue = state.issue ?? null;
    this.featureBranch = state.featureBranch ?? null;
    this.baseBranch = state.baseBranch ?? null;
    this.worktree = state.worktree === true;
    Object.freeze(this);
  }

  equals(other) {
    return other instanceof FinalizeFlowIdentity
      && this.runId === other.runId
      && this.spec === other.spec
      && String(this.issue ?? "") === String(other.issue ?? "")
      && this.featureBranch === other.featureBranch
      && this.baseBranch === other.baseBranch
      && this.worktree === other.worktree;
  }

  toJSON() {
    return {
      runId: this.runId,
      spec: this.spec,
      issue: this.issue,
      featureBranch: this.featureBranch,
      baseBranch: this.baseBranch,
      worktree: this.worktree,
    };
  }
}

class FinalizeCleanupStepSnapshot {
  constructor(step) {
    if (!step || step.id !== "finalize-cleanup") {
      throw new Error("finalize-cleanup step snapshot is invalid");
    }
    this.value = structuredClone(step);
    Object.freeze(this.value);
    Object.freeze(this);
  }

  insertInto(state) {
    if (findStepById(state.steps || [], "finalize-cleanup")) return false;
    const finalize = findStepById(state.steps || [], "finalize");
    if (!finalize || !Array.isArray(finalize.children)) {
      throw new Error("finalize step group is missing from main flow state");
    }
    const order = getFlowBranchLeafIds("finalize");
    const cleanupIndex = order.indexOf("finalize-cleanup");
    if (cleanupIndex < 0) throw new Error("finalize-cleanup is not registered in the flow definition");
    const nextExistingId = order.slice(cleanupIndex + 1)
      .find((id) => finalize.children.some((step) => step.id === id));
    const insertAt = nextExistingId == null
      ? finalize.children.length
      : finalize.children.findIndex((step) => step.id === nextExistingId);
    finalize.children.splice(insertAt, 0, structuredClone(this.value));
    return true;
  }
}

export class FinalizeCleanupStateResolution {
  constructor({
    state,
    stateOwner,
    worktreePath,
    mainRepoPath,
    cleanupStepSnapshot,
  }) {
    this.state = state;
    this.stateOwner = stateOwner;
    this.worktreePath = worktreePath;
    this.mainRepoPath = mainRepoPath;
    this.cleanupStepSnapshot = cleanupStepSnapshot;
    Object.freeze(this);
  }

  static resolve(ctx) {
    const selectedState = ctx.flowState;
    const specId = specIdFromPath(selectedState?.spec);
    if (!specId) {
      return Envelope.fail(
        "run",
        "finalize-cleanup",
        "FINALIZE_FLOW_STATE_MISMATCH",
        "The selected flow does not have a canonical spec path.",
      );
    }
    const stateOwner = FinalizeFlowStateOwner.forMainContext({ ...ctx, specId });
    const { mainRepoPath } = stateOwner;
    const mainState = stateOwner.loadReadOnly();
    if (!mainState) {
      return Envelope.fail(
        "run",
        "finalize-cleanup",
        "FINALIZE_MAIN_FLOW_MISSING",
        [
          `Main repository flow state is missing for ${specId}.`,
          "No finalize step, commit, active-flow, worktree, branch, or Git history cleanup was attempted.",
        ],
        { specId, mainRepoPath },
      );
    }

    const selectedIdentity = new FinalizeFlowIdentity(selectedState, "selected");
    const mainIdentity = new FinalizeFlowIdentity(mainState, "main");
    const selectedPaths = ctx.flowManager.resolveWorktreePaths(selectedState);
    const worktreePath = ctx.worktreeFlowProvenance instanceof WorktreeFlowProvenance
      ? ctx.worktreeFlowProvenance.identity.worktreePath
      : selectedPaths.worktreePath;
    let worktreeState = null;
    const missingDirectWorktreeBinding = ctx.directFinalizeAdapter != null
      && worktreePath != null
      && !fs.existsSync(path.join(worktreePath, ".senti", "flow-identity.json"));
    if (worktreePath && fs.existsSync(worktreePath) && !missingDirectWorktreeBinding) {
      worktreeState = ctx.flowManager
        .forRoot(worktreePath, { specId })
        .loadReadOnly(specId);
    }
    const worktreeIdentity = worktreeState
      ? new FinalizeFlowIdentity(worktreeState, "worktree")
      : null;
    const activeState = worktreeState || selectedState;
    const activeIdentity = worktreeIdentity || selectedIdentity;

    if (!mainIdentity.equals(activeIdentity)) {
      return Envelope.fail(
        "run",
        "finalize-cleanup",
        "FINALIZE_FLOW_STATE_MISMATCH",
        [
          "Main repository and active-flow state do not identify the same finalize run.",
          "No finalize step, commit, active-flow, worktree, branch, or Git history cleanup was attempted.",
        ],
        {
          selected: selectedIdentity.toJSON(),
          main: mainIdentity.toJSON(),
          active: activeIdentity.toJSON(),
        },
      );
    }

    const mainCleanup = findStepById(mainState.steps || [], "finalize-cleanup");
    const activeCleanup = findStepById(activeState.steps || [], "finalize-cleanup");
    const cleanupStep = mainCleanup || activeCleanup;
    if (!cleanupStep) {
      return Envelope.fail(
        "run",
        "finalize-cleanup",
        "FINALIZE_CLEANUP_STEP_MISSING",
        [
          "finalize-cleanup is registered in the current flow definition but is absent from both main and active flow state.",
          "No finalize step, commit, active-flow, worktree, branch, or Git history cleanup was attempted.",
        ],
        { specId, runId: mainIdentity.runId },
      );
    }

    const operationalState = structuredClone(activeState);
    operationalState.state = {
      ...(activeState.state || {}),
      ...(mainState.state || {}),
    };
    if (mainState.directFlowSession) {
      operationalState.plugins = structuredClone(mainState.plugins);
    }
    for (const key of [
      "directFlowSession",
      "directResolutionPlan",
      "directIntegrationReceipt",
      "directCompletionReceipt",
      "directAbortReceipt",
      "directAbortHistory",
      "directReconcileEvidence",
    ]) {
      if (mainState[key] !== undefined) operationalState[key] = structuredClone(mainState[key]);
    }
    return new FinalizeCleanupStateResolution({
      state: operationalState,
      stateOwner,
      worktreePath,
      mainRepoPath,
      cleanupStepSnapshot: mainCleanup ? null : new FinalizeCleanupStepSnapshot(cleanupStep),
    });
  }

  ensureCleanupStep(operationOwnerToken) {
    if (!this.cleanupStepSnapshot) return;
    this.stateOwner.mutate((state) => {
      this.cleanupStepSnapshot.insertInto(state);
    }, { operationOwnerToken });
  }
}
