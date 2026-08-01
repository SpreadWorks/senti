/**
 * src/flow/registry.js
 *
 * Single source of truth for flow subcommand metadata.
 * Each command is defined declaratively with help, command (lazy import),
 * args definition, and optional pre/post/onError/finally hooks.
 *
 * Used by flow.js dispatcher and help.js.
 */

import { derivePhase } from "../lib/flow-helpers.js";
import { hasExplicitOption } from "../lib/flow-options.js";
import fs from "fs";
import path from "path";
import {
  VALID_PHASES,
  VALID_METRIC_COUNTERS,
  VALID_GATE_PHASES,
  VALID_REVIEW_PHASES,
  VALID_GUARDRAIL_PHASES,
} from "../lib/constants.js";
import { resolveGatePhaseFromState, resolveScopedGateStepId } from "./lib/gate-step.js";
import {
  findActiveNode,
  resolveLifecyclePlan,
  resolveRuntimeStep,
  SetStepStatus,
  taskIdForResolvedStep,
  writeEmptyDraftReviewRouteArtifacts,
} from "./definition.js";
import { findStepById, flattenSteps } from "./lib/step-tree.js";
import { DRAFT_REVIEW_ROUTES, draftReviewRouteForRetryPhase } from "./lib/draft-review-routes.js";
import { assertStepCompletionTransitionAllowed } from "./lib/flow-judgment-contract.js";
import { runFlowCommandHooks } from "../lib/plugin-registry.js";
import { appendIssueLogEntry } from "./lib/set-issue-log.js";
import {
  DecisionOutcome,
  DeferOutcome,
  StepAttempt,
} from "./lib/step-outcome.js";
import {
  finalizationOutboxIdentity,
} from "./lib/flow-outbox.js";
import {
  DefinitionLifecycleTransition,
  ExplicitRecoveryTransition,
} from "./lib/step-transition-policy.js";
import { nonblockingRouteFor } from "./lib/nonblocking-route.js";
import { FinalizeFlowStateOwner } from "./lib/finalize-flow-state-owner.js";

/**
 * Successful command-result statuses that map to a flow step status of 'done'.
 * 'skipped' is normalized to 'done' so the step ledger does not mix done/skipped
 * for finalize leaves (per spec 251 design principle).
 */
const FLOW_RUN_RUNTIME_OPTIONS = ["--agent-work-dir"];
const FLOW_TARGET_GUARD_FLAGS = ["--expect-no-issue"];
const FLOW_TARGET_GUARD_OPTIONS = ["--expect-issue", "--expect-spec", "--expect-run-id", "--expect-binding"];
const FLOW_TARGET_GUARD_USAGE = "[--expect-binding <token> | [--expect-issue <number> | --expect-no-issue] [--expect-spec <spec>] [--expect-run-id <runId>]]";
const FLOW_TARGET_GUARD_HELP_LINES = [
  "  --expect-binding <token>  Require the selected flow and execution authority to match this CLI-generated binding.",
  "  --expect-issue <number>  Require the selected flow to belong to this Issue.",
  "  --expect-no-issue        Require the selected flow to have no Issue.",
  "  --expect-spec <spec>     Require the selected flow to match this spec.",
  "  --expect-run-id <runId>  Require the selected flow to match this runId.",
];
const FLOW_RUN_OPTIONS = [...FLOW_RUN_RUNTIME_OPTIONS, ...FLOW_TARGET_GUARD_OPTIONS];
function withTargetGuardOptions(options = []) {
  return [...options, ...FLOW_TARGET_GUARD_OPTIONS];
}
function withTargetGuardFlags(flags = []) {
  return [...flags, ...FLOW_TARGET_GUARD_FLAGS];
}
const RETRY_HELP_GATE_PHASES = Object.freeze(["task-impl", "integration"]);
const RETRY_HELP_REVIEW_PHASES = Object.freeze(["draft", "draft-questions", "draft-coverage", "spec", "test", "impl"]);
export const DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY = Object.freeze({
  review: "detection",
  triage: "disposition",
  repair: "mutation/audit",
  gate: "mechanical validation",
  summary: "review as detection, triage as disposition, repair as mutation/audit, gate as mechanical validation",
});

const DRAFT_REVIEW_REVIEW_RESPONSIBILITIES = Object.freeze([
  "record detection artifacts only",
  "delegate accept/reject disposition to triage steps",
  "delegate mutation/audit output to repair steps",
  "leave mechanical validation to gate steps",
]);

const DRAFT_REVIEW_GATE_RESPONSIBILITIES = Object.freeze([
  "mechanically validate readiness artifacts, schemas, links, unresolved decisions, approval, tests, and guardrail compliance as mechanical validation",
  "do not perform review detection, triage disposition, or repair mutation/audit",
]);

export function assertDraftReviewRegistryHookBoundary() {
  const expected = "review as detection, triage as disposition, repair as mutation/audit, gate as mechanical validation";
  if (DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY.summary !== expected) {
    throw new Error(`invalid draft review registry hook boundary: ${DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY.summary}`);
  }
}

/**
 * Resolve the FlowManager scoped to the main repo for merge-onward post hooks.
 * After finalize-merge runs, the main repo gains its own specs/<id>/flow.json
 * (squash-merged from the worktree). Post hooks must update that file — not
 * the now-stale worktree copy — so authority is switched via forRoot().
 */
function switchToMainRepoFlowAuthority(ctx) {
  FinalizeFlowStateOwner.forMainContext(ctx).bindContext(ctx);
}

/**
 * Reset finalize-sync / finalize-cleanup status back to 'pending' on the given
 * flow manager when they are currently 'skipped'. The skipped status is set by
 * the finalize-merge onError hook on a prior failed merge; on retry success we
 * need promoteNextPendingLeaf to advance to finalize-sync, which it cannot do
 * while those steps are skipped.
 */
/**
 * @returns {boolean} true when at least one leaf was reset, false when no-op.
 */
function resetSkippedDownstreamSteps(stateOwner, stepIds = []) {
  const state = stateOwner.loadReadOnly();
  if (!state) return false;
  const flat = flattenSteps(state.steps || []);
  const resetIds = stepIds.filter((id) => flat.find((step) => step.id === id)?.status === "skipped");
  if (resetIds.length === 0) return false;
  stateOwner.updateStepStatus(new ExplicitRecoveryTransition({
    stepId: resetIds[0],
    currentStatus: "skipped",
    requestedStatus: "pending",
    entrypoint: "reset-skipped-downstream",
    changes: resetIds.map((stepId) => ({
      stepId,
      currentStatus: "skipped",
      requestedStatus: "pending",
    })),
  }));
  return true;
}

/**
 * Load flow state and derive the current phase.
 */
function deriveActivePhase(ctx) {
  const state = ctx.flowManager.load();
  return derivePhase(state);
}

/**
 * Best-effort step status update. Hooks may fire after `cleanup` removes
 * flow.json (and during early init before it exists), so a missing-file
 * error is the expected non-failure mode. Any other error is operationally
 * meaningful and is re-thrown so the dispatcher can surface it as a
 * post-hook warning in the envelope.
 *
 * The first argument may be a hook ctx (uses ctx.flowManager) or a
 * FlowManager directly — the latter form is used by merge-onward finalize
 * hooks which target the main repo flow.json via forRoot().
 */
function tryUpdateStepStatus(target, stepId, status, opts, provenance = {}) {
  const isFinalizeStateOwner = target instanceof FinalizeFlowStateOwner;
  const isHookContext = !isFinalizeStateOwner
    && Boolean(target && typeof target === "object" && target.flowManager);
  const fm = isHookContext
    ? target.flowManager
    : (isFinalizeStateOwner ? target.flowManager : target);
  let mutationOpts = opts;
  if (isHookContext) {
    mutationOpts = { ...(opts || {}) };
    if (!hasExplicitOption(mutationOpts, "specId") && target.specId) {
      mutationOpts.specId = target.specId;
    }
    if (!hasExplicitOption(mutationOpts, "taskId")) {
      const activeNode = target.flowState ? findActiveNode(target.flowState) : null;
      mutationOpts.taskId = taskIdForResolvedStep(activeNode, stepId);
    }
  }
  try {
    const skipTaskImplGateContract = stepId === "impl-gate" && target?.phase === "task-impl";
    if (status === "done" && target?.root && !skipTaskImplGateContract) {
      assertStepCompletionTransitionAllowed(target, stepId);
    }
    let state;
    if (typeof fm.loadReadOnly === "function") {
      state = mutationOpts?.specId ? fm.loadReadOnly(mutationOpts.specId) : fm.loadReadOnly();
    } else if (typeof fm.load === "function") {
      state = mutationOpts?.specId ? fm.load(mutationOpts.specId) : fm.load();
    } else if (isHookContext) {
      state = target.flowState;
    }
    const scope = mutationOpts?.taskId == null
      ? state
      : state?.tasks?.find((task) => task.id === mutationOpts.taskId);
    const targetStep = findStepById(scope?.steps || [], stepId);
    if (!targetStep) throw new Error(`unknown step: ${stepId}`);
    if (targetStep.status === status) return;
    const currentStepId = provenance.currentStepId
      || findActiveNode(state)?.stepId
      || stepId;
    if (!provenance.plan && !provenance.event) {
      throw new Error(`definition lifecycle event is required for ${stepId}=${status}`);
    }
    const plan = provenance.plan || resolveLifecyclePlan({
      event: provenance.event,
      currentStepId,
      targetStepId: stepId,
      status,
    });
    const action = provenance.action
      || plan.actions.find((candidate) => candidate.step === stepId && candidate.status === status);
    if (!action) throw new Error(`definition lifecycle did not emit ${stepId}=${status}`);
    const transition = new DefinitionLifecycleTransition({
      action,
      plan,
      currentStatus: targetStep.status,
    });
    if (isFinalizeStateOwner) {
      target.updateStepStatus(transition, {
        taskId: mutationOpts?.taskId ?? null,
        operationOwnerToken: mutationOpts?.operationOwnerToken ?? null,
      });
    } else {
      fm.updateStepStatus(transition, mutationOpts);
    }
  } catch (err) {
    if (err?.code === "ERR_MISSING_FILE") {
      process.stderr.write(`[senti] step-status update skipped (${stepId}=${status}): ${err.message}\n`);
      return;
    }
    if (err.message === "no active flow (flow.json not found)") {
      process.stderr.write(`[senti] step-status update skipped (${stepId}=${status}): no active flow\n`);
      return;
    }
    throw err;
  }
}

/**
 * Wrap an issue-log append. Same expected-error contract as
 * tryUpdateStepStatus: only swallow `ERR_MISSING_FILE` (no flow.json yet
 * or post-cleanup), re-throw the rest so the dispatcher can warn.
 */
function tryAppendIssueLog(fn) {
  try {
    fn();
  } catch (err) {
    if (err?.code === "ERR_MISSING_FILE") {
      process.stderr.write(`[senti] issue-log append skipped: ${err.message}\n`);
      return;
    }
    throw err;
  }
}

function gateRuntimeLogStepId(ctx) {
  if (!ctx.flowState) return null;
  const phase = ctx.phase || resolveGatePhaseFromState(ctx.flowState)?.phase;
  return resolveScopedGateStepId(ctx.flowState, phase);
}

function terminalGateRevalidation(ctx) {
  if (ctx.phase == null || !ctx.flowState) return false;
  const stepId = resolveScopedGateStepId(ctx.flowState, ctx.phase);
  const step = findStepById(ctx.flowState.steps || [], stepId)
    || ctx.flowState.tasks?.flatMap((task) => task.steps || []).find((entry) => entry.id === stepId);
  const activeNode = findActiveNode(ctx.flowState);
  return ["done", "skipped"].includes(step?.status) && activeNode?.stepId !== stepId;
}

function activeStepId(flowState, stepIds) {
  const steps = Array.isArray(flowState?.steps) ? flattenSteps(flowState.steps) : [];
  const allowed = new Set(stepIds);
  return steps.find((step) => allowed.has(step.id) && step.status === "in_progress")?.id || null;
}

// Resolve which review step the impl-phase post-hook should complete: flow scope
// uses impl-review, task scope uses task-review. Defaults to impl-review (flow).
function activeImplReviewStepId(flowState) {
  if (activeStepId(flowState, ["impl-review"]) === "impl-review") return "impl-review";
  const taskId = flowState?.currentTaskId;
  if (taskId && Array.isArray(flowState?.tasks)) {
    const task = flowState.tasks.find((t) => t.id === taskId);
    if (Array.isArray(task?.steps)
      && task.steps.some((s) => s.id === "task-review" && s.status === "in_progress")) {
      return "task-review";
    }
  }
  return "impl-review";
}

function draftReviewRuntimeLogStepId(ctx, result) {
  const retryPhase = result?.artifacts?.retryPhase || (String(ctx.phase || "").startsWith("draft-") ? ctx.phase : null);
  const route = draftReviewRouteForRetryPhase(retryPhase);
  if (route) return route.reviewStepId;
  return activeStepId(ctx.flowState, DRAFT_REVIEW_ROUTES.map((candidate) => candidate.reviewStepId))
    || draftReviewRouteForRetryPhase("draft-questions").reviewStepId;
}

function reviewRuntimeLogStepId(ctx, result) {
  return resolveRuntimeStep({
    command: "run-review",
    phase: ctx.phase,
    result,
    flowState: ctx.flowState,
    currentStepId: activeStepId(ctx.flowState, DRAFT_REVIEW_ROUTES.map((candidate) => candidate.reviewStepId)),
  });
}

function finalizeCommand(suffix) {
  return `finalize-${suffix}`;
}

class RegistryLifecycleAdapter {
  constructor(ctx, result, err, { plan, input }) {
    this.ctx = ctx;
    this.result = result;
    this.err = err;
    this.phase = result?.artifacts?.phase || ctx.phase;
    const activeNode = this.ctx.flowState ? findActiveNode(this.ctx.flowState) : null;
    this.gateStepId = this.phase === "task-impl"
      ? resolveScopedGateStepId(this.ctx.flowState, this.phase)
      : "impl-gate";
    this.gateTaskId = this.gateStepId === "task-gate"
      ? activeNode?.taskId || null
      : null;
    this.plan = this.phase === "task-impl"
      ? plan.forStepAlias({ sourceStep: "impl-gate", targetStep: this.gateStepId })
      : plan;
    this.actions = this.plan.actions;
    this.input = input;
  }

  mutationOpts(step, extras = {}) {
    const activeNode = this.ctx.flowState ? findActiveNode(this.ctx.flowState) : null;
    return {
      ...extras,
      taskId: step === this.gateStepId
        ? this.gateTaskId
        : taskIdForResolvedStep(activeNode, step),
    };
  }

  finalizeStateOwner() {
    if (!this.ctx.finalizeFlowStateOwner) {
      FinalizeFlowStateOwner.fromContext(this.ctx).bindContext(this.ctx);
    }
    return this.ctx.finalizeFlowStateOwner;
  }

  setStepStatus(step, status, action) {
    const attempt = this.result?.stepAttempt
      ? StepAttempt.fromStored(this.result.stepAttempt)
      : null;
    if (status === "in_progress" && attempt?.outcome instanceof DeferOutcome) return;
    const settledStatus = status;
    if (step.startsWith("finalize-")) {
      const stateOwner = this.finalizeStateOwner();
      const current = stateOwner.loadReadOnly();
      const currentStep = findStepById(current?.steps || [], step);
      if (currentStep?.status === settledStatus) return;
      tryUpdateStepStatus(
        stateOwner,
        step,
        settledStatus,
        this.mutationOpts(step, { specId: this.ctx.specId }),
        {
          action,
          plan: this.plan,
          currentStepId: this.input.currentStepId || resolveRuntimeStep(this.input),
          event: this.input.event,
        },
      );
      return;
    }
    tryUpdateStepStatus(
      { ...this.ctx, phase: this.phase },
      step,
      settledStatus,
      this.mutationOpts(step),
      {
        action,
        plan: this.plan,
        currentStepId: this.input.currentStepId || resolveRuntimeStep(this.input),
        event: this.input.event,
      },
    );
  }

  refreshFlowState() {
    let state = null;
    if (typeof this.ctx.flowManager.loadReadOnly === "function") {
      state = this.ctx.specId
        ? this.ctx.flowManager.loadReadOnly(this.ctx.specId)
        : this.ctx.flowManager.loadReadOnly();
    } else if (typeof this.ctx.flowManager.load === "function") {
      state = this.ctx.specId
        ? this.ctx.flowManager.load(this.ctx.specId)
        : this.ctx.flowManager.load();
    }
    if (state) this.ctx.flowState = state;
  }

  keepInProgress(step) {
    tryUpdateStepStatus(
      this.ctx,
      step,
      "in_progress",
      this.mutationOpts(step),
      { event: "definition:keep-in-progress" },
    );
  }

  async incrementMetric(phase, counter) {
    if (counter === "reviewRetry") {
      const reviewMod = await import("./lib/run-review.js");
      reviewMod.updateReviewRetryCounter(this.ctx, this.result);
      return;
    }
    if (counter === "gateRetry") {
      const gateMod = await import("./lib/run-gate.js");
      gateMod.updateGateRetryCounter(this.ctx, this.result);
    }
  }

  async appendIssueLog(source) {
    if (source === "gate-result") {
      if (this.result?.artifacts?.deferred === true) return;
      const gateMod = await import("./lib/run-gate.js");
      tryAppendIssueLog(() => gateMod.appendIssueLogFromGateResult(this.ctx, this.result));
      return;
    }
    if (source === "test-review-tooling-failure") {
      const reviewMod = await import("./lib/run-review.js");
      tryAppendIssueLog(() => reviewMod.appendIssueLogFromTestReviewToolingFailure(this.ctx, this.result));
    }
  }

  async executeSideEffects() {
    const gateMod = await import("./lib/run-gate.js");
    const phase = this.result?.artifacts?.phase || this.ctx.phase;
    await gateMod.executeGateSideEffects(this.ctx, phase);
  }

  outboxStore() {
    return this.finalizeStateOwner().outbox();
  }

  outboxIdentity(step) {
    return finalizationOutboxIdentity(this.ctx.flowState, step);
  }

  beginOutboxEffect(step) {
    if (this.ctx.dryRun) return null;
    this.ctx.flowOutboxEntry = this.outboxStore().begin(this.outboxIdentity(step));
    return this.ctx.flowOutboxEntry;
  }

  completeOutboxEffect(step) {
    if (this.ctx.dryRun) return null;
    this.ctx.flowOutboxEntry = this.outboxStore().complete(this.outboxIdentity(step), this.result);
    return this.ctx.flowOutboxEntry;
  }

  failOutboxEffect(step) {
    if (this.ctx.dryRun) return null;
    const reason = this.err
      || new Error(this.result?.reason || this.result?.message || `${step} side effect failed`);
    const identity = this.outboxIdentity(step);
    const outbox = this.outboxStore();
    try {
      this.ctx.flowOutboxEntry = outbox.fail(identity, reason);
    } catch (error) {
      if (!String(error.message).startsWith("outbox entry not found:")) throw error;
      outbox.begin(identity);
      this.ctx.flowOutboxEntry = outbox.fail(identity, reason);
    }
    return this.ctx.flowOutboxEntry;
  }

  skipSteps(steps) {
    const stateOwner = this.finalizeStateOwner();
    for (const id of steps) {
      try {
        tryUpdateStepStatus(
          stateOwner,
          id,
          "skipped",
          { specId: stateOwner.specId },
          { event: "definition:skip-steps" },
        );
      } catch (e) {
        process.stderr.write(`[senti] finalize-merge onError: step-status update failed (${id}): ${e.message}\n`);
      }
    }
  }

  resetSteps(steps) {
    this.ctx.flowManager.mutate((state) => {
      const flat = flattenSteps(state.steps || []);
      for (const id of steps) {
        const step = flat.find((candidate) => candidate.id === id);
        if (!step) continue;
        step.status = "pending";
        delete step.finishedAt;
        delete step.startedAt;
      }
    });
  }

  async runLifecycleHook(module, handler, args) {
    if (module === "review") {
      await this.runReviewHook(handler, args);
      return;
    }
    if (module === "finalize") {
      await this.runFinalizeHook(handler, args);
    }
  }

  async runReviewHook(handler, args) {
    if (handler === "writeEmptyDraftReviewRouteArtifacts") {
      const route = draftReviewRouteForRetryPhase(args?.retryPhase);
      if (!route) return;
      const specDir = path.dirname(path.resolve(this.ctx.root, this.ctx.flowState.spec));
      writeEmptyDraftReviewRouteArtifacts({ specDir, route });
      return;
    }
    if (handler === "resetImplEvidenceAfterReviewProposals") {
      const reviewMod = await import("./lib/run-review.js");
      reviewMod.resetImplEvidenceAfterReviewProposals(this.ctx, this.result);
    }
  }

  async runFinalizeHook(handler, args) {
    const finalize = await import("./lib/run-finalize.js");
    if (handler === "assertFinalizeMergeMetadataMutationSafe") {
      this.ctx.finalizeMergeMetadataPreflight = finalize.assertFinalizeMergeMetadataMutationSafe({
        root: this.ctx.root,
        specId: this.ctx.specId,
      });
      return;
    }
    if (handler === "prepareFinalizeMerge") {
      const metadataPreflight = finalize.readFinalizeMergeMetadataPreflight({
        root: this.ctx.root,
        specId: this.ctx.specId,
      });
      if (finalize.hasFinalizeMergeTargetExternalDirty({
        root: this.ctx.root,
        specId: this.ctx.specId,
        preflight: metadataPreflight,
      })) {
        return;
      }
      const mutated = resetSkippedDownstreamSteps(
        this.finalizeStateOwner(),
        args?.steps || [],
      );
      if (mutated) {
        finalize.commitFinalizeMergeMetadataIfSafe({
          root: this.ctx.root,
          specId: this.ctx.specId,
          preflight: metadataPreflight,
          includeFlowJson: true,
          message: "chore: reset downstream finalize steps for retry",
        });
      }
      return;
    }
    if (handler === "resolveMainRepoFlowManager") {
      if (args?.unlessPr && this.result?.strategy === "pr") return;
      switchToMainRepoFlowAuthority(this.ctx);
      return;
    }
    if (handler === "resolveCleanupOutboxFlowManager") {
      const { worktreePath } = this.ctx.flowManager.resolveWorktreePaths(this.ctx.flowState);
      if (!worktreePath || !fs.existsSync(worktreePath)) switchToMainRepoFlowAuthority(this.ctx);
      return;
    }
    if (handler === "commitDurableArtifacts") {
      await finalize.commitDurableFinalizeArtifacts(this.ctx);
      return;
    }
    if (handler === "commitFinalizeCompletion") {
      finalize.commitFinalizeCompletion({
        root: this.ctx.root,
        specId: this.ctx.specId,
        idempotencyKey: this.ctx.flowOutboxEntry?.idempotencyKey,
      });
      return;
    }
    if (handler === "recordMergeOutcome") {
      const strategy = this.result?.strategy === "skip" ? null : (this.result?.strategy ?? null);
      const baseline = strategy === "squash" ? (this.result?.mergedFromSha ?? null) : null;
      try {
        const outcome = { mergeStrategy: strategy, featureBranchSquashedSha: baseline };
        this.finalizeStateOwner().setMergeOutcome(outcome);
      } catch (err) {
        process.stderr.write(`[senti] finalize-merge: setMergeOutcome failed: ${err.message}\n`);
      }
      return;
    }
    if (handler === "ensureFinalizeMergeInProgress") {
      const stateOwner = this.finalizeStateOwner();
      const current = stateOwner.loadReadOnly();
      if (findStepById(current?.steps || [], "finalize-merge")?.status !== "pending") return;
      // The base-side snapshot predates the in-memory merge execution. This
      // is a constrained rehydration, not a user-initiated step transition.
      // Its formerly active leaf must not coexist with finalize-merge as
      // another in-progress leaf in the restored main-side state.
      stateOwner.mutate((state) => {
        const active = findActiveNode(state);
        if (active?.stepId && active.stepId !== "finalize-merge") {
          findStepById(state.steps || [], active.stepId).status = "done";
        }
        const commit = findStepById(state.steps || [], "finalize-commit");
        if (commit?.status === "in_progress") commit.status = "done";
        findStepById(state.steps || [], "finalize-merge").status = "in_progress";
      });
      return;
    }
    if (handler === "resetSkippedDownstreamSteps") {
      resetSkippedDownstreamSteps(this.finalizeStateOwner(), args?.steps || []);
      return;
    }
    if (handler === "commitFinalizeMergeConflictMetadata") {
      finalize.commitFinalizeMergeConflictMetadata({
        root: this.ctx.root,
        specId: this.ctx.specId,
        preflight: this.ctx.finalizeMergeMetadataPreflight,
      });
      return;
    }
    if (handler === "finalizeOnError") {
      finalize.finalizeOnError(args?.command)(this.ctx, this.err);
    }
  }
}

async function applyLifecycleActionsFromRegistry(ctx, input, result = null, err = null) {
  const attempt = result?.stepAttempt ? StepAttempt.fromStored(result.stepAttempt) : null;
  const plan = resolveLifecyclePlan({
    ...input,
    result,
    error: err,
    flowState: ctx.flowState,
    settleInProgressAsDone: attempt?.outcome instanceof DecisionOutcome,
  });
  const adapter = new RegistryLifecycleAdapter(ctx, result, err, { plan, input });
  for (const action of adapter.actions) {
    await action.apply(adapter);
    if (action instanceof SetStepStatus) adapter.refreshFlowState();
  }
  const command = input?.command || input?.runtimeCommand || input?.key || result?.artifacts?.command;
  const snapshot = Array.isArray(ctx.flowState?.plugins?.flowCommandHooks) ? ctx.flowState.plugins.flowCommandHooks : [];
  if (!command || snapshot.length === 0) return;
  const hook = pluginHookForLifecycle(input?.event, err);
  const hookResult = await runFlowCommandHooks(ctx.root, snapshot, {
    command: pluginCommandName(command),
    hook,
    flow: { spec: ctx.flowState?.spec, issue: ctx.flowState?.issue, runId: ctx.flowState?.runId },
    result: result || { ok: false, error: err?.message },
  });
  if (hookResult.issueLogEntries.length && ctx.flowState?.spec) {
    for (const entry of hookResult.issueLogEntries) {
      tryAppendIssueLog(() => {
        appendIssueLogEntry(ctx.root, ctx.flowState.spec, {
          step: "plugin-hook",
          reason: entry.reason,
          trigger: `${command}.${hook}`,
          resolution: "non-blocking plugin hook warning recorded",
          guardrailCandidate: "plugin hook run failures should be warning envelopes and issue-log candidates",
          pluginId: entry.pluginId,
          timestamp: new Date().toISOString(),
        });
      });
    }
  }
}

function pluginHookForLifecycle(event, err) {
  if (err) return "onError";
  if (typeof event === "string") {
    const suffix = event.split(":").pop();
    if (suffix === "pre" || suffix === "post" || suffix === "finally") return suffix;
  }
  return "post";
}

function pluginCommandName(command) {
  return String(command || "").startsWith("run-") ? String(command).slice(4) : command;
}


export const FLOW_COMMANDS = {
  park: {
    helpKey: "flow.park",
    helpPath: "senti flow park --help",
    requiresFlow: false,
    targetGuard: false,
    directParkedAuthority: true,
    command: () => import("./lib/run-park.js"),
    args: { flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
    help: [
      `Usage: senti flow park ${FLOW_TARGET_GUARD_USAGE}`,
      "",
      "Remove one exact managed-worktree flow pointer from the active authority.",
      "The target runId, spec, and Issue identity guards are all required.",
      "Flow state, artifacts, worktree, branch, and Git refs are not changed.",
      "",
      "Options:",
      ...FLOW_TARGET_GUARD_HELP_LINES,
    ].join("\n"),
  },
  resume: {
    helpKey: "flow.resume",
    helpPath: "senti flow resume --help",
    requiresFlow: false,
    directParkedAuthority: "when-parked",
    command: () => import("./lib/run-resume.js"),
    args: {
      flags: withTargetGuardFlags(["--parked"]),
      options: withTargetGuardOptions(["--spec"]),
    },
    help: [
      `Usage: senti flow resume [--spec <specId>] [--parked] ${FLOW_TARGET_GUARD_USAGE}`,
      "",
      "Show active flow context; --parked restores one exact inactive managed-worktree pointer with no discovery.",
      "When multiple flows are active concurrently, pass --spec to select one.",
      "With --parked, restore one exact managed-worktree pointer from its saved execution root.",
      "Parked resume requires runId, spec, and Issue identity guards and performs no discovery.",
      "Use `senti flow get status` for current-context status display.",
      "",
      "Options:",
      "  --spec <specId>          Select a registered active flow.",
      "  --parked                Restore the exact parked managed-worktree pointer.",
      ...FLOW_TARGET_GUARD_HELP_LINES,
    ].join("\n"),
  },
  prepare: {
    helpKey: "flow.prepare",
    helpPath: "senti flow prepare --help",
    requiresFlow: false,
    requiresConfig: true,
    runtimeLog: { stepId: "prepare-spec" },
    command: () => import("./lib/run-prepare-spec.js"),
    args: {
      flags: withTargetGuardFlags(["--no-branch", "--worktree", "--dry-run"]),
      options: withTargetGuardOptions(["--title", "--base", "--issue", "--request", "--run-id"]),
    },
    help: [
      `Usage: senti flow prepare [options] ${FLOW_TARGET_GUARD_USAGE}`,
      "",
      "Create branch/worktree and initialize spec directory.",
      "",
      "Options:",
      "  --title <name>     Feature title (required)",
      "  --base <branch>    Base branch (default: current HEAD)",
      "  --worktree         Use git worktree mode",
      "  --no-branch        Spec-only mode (no branch creation)",
      "  --issue <number>   GitHub Issue number to link",
      "  --request <text>   User request text to save in flow.json",
      "  --run-id <runId>   Use preparing runId from flow set init (isolated from unrelated active flows)",
      ...FLOW_TARGET_GUARD_HELP_LINES,
      "  --dry-run          Show what would happen without executing",
    ].join("\n"),
    async post(ctx, result) {
      await applyLifecycleActionsFromRegistry(ctx, {
        event: "prepare:post",
        command: "prepare",
      }, result);
    },
  },
  get: {
    status: {
      helpKey: "flow.get.status",
      requiresFlow: false,
      targetGuard: false,
      command: () => import("./lib/get-status.js"),
      args: { positional: ["runId"], flags: withTargetGuardFlags(["--details"]), options: FLOW_TARGET_GUARD_OPTIONS },
      help: [
        "Usage: senti flow get status [runId] [--details] [--expect-issue <number> | --expect-no-issue] [--expect-spec <spec>] [--expect-run-id <runId>]",
        "",
        "Return active flow state for the current execution context.",
        "If no active flow exists, returns { active: false }.",
        "If runId is provided, resolve by runId instead of context.",
        "  --details  Include audit fields such as request, notes, metrics, and history.",
        "  --expect-issue <number>  Fail with ACTIVE_FLOW_MISMATCH when the resolved flow belongs to another Issue.",
        "  --expect-no-issue        Fail with ACTIVE_FLOW_MISMATCH when the resolved flow belongs to an Issue.",
        "  --expect-spec <spec>     Fail with ACTIVE_FLOW_MISMATCH when the current context is another spec.",
        "  --expect-run-id <runId>  Fail with ACTIVE_FLOW_MISMATCH when the current context is another runId.",
        "Use `senti flow resume` to discover or recover active flows.",
      ].join("\n"),
    },
    "resolve-context": {
      helpKey: "flow.get.resolve-context",
      command: () => import("./lib/get-resolve-context.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
      help: [
        `Usage: senti flow get resolve-context ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Resolve worktree/repo paths and active flow for context recovery.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    check: {
      helpKey: "flow.get.check",
      requiresFlow: false,
      command: () => import("./lib/get-check.js"),
      args: { positional: ["target"] },
      help: "Usage: senti flow get check <target>\n\nCheck a condition. Targets: dirty, gh, impl, finalize.",
    },
    prompt: {
      helpKey: "flow.get.prompt",
      requiresFlow: false,
      command: () => import("./lib/get-prompt.js"),
      args: { positional: ["kind"], flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
      help: [
        "Usage: senti flow get prompt <kind> [--expect-issue <number> | --expect-no-issue] [--expect-spec <spec>] [--expect-run-id <runId>]",
        "",
        "Return a prompt template by kind.",
        "Target-sensitive prompts such as plan.approval validate that the resolved active flow matches the expected target.",
      ].join("\n"),
    },
    "qa-count": {
      helpKey: "flow.get.qa-count",
      command: () => import("./lib/get-qa-count.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
      help: "Usage: senti flow get qa-count\n\nReturn the number of answered questions in draft phase.",
    },
    guardrail: {
      helpKey: "flow.get.guardrail",
      requiresFlow: false,
      command: () => import("./lib/get-guardrail.js"),
      args: { positional: ["phase"], options: ["--format"] },
      help: `Usage: senti flow get guardrail <phase> [--format json]\n\nReturn guardrails filtered by phase. Phases: ${VALID_GUARDRAIL_PHASES.join(", ")}. Alias: impl -> task-impl.`,
    },
    issue: {
      helpKey: "flow.get.issue",
      requiresFlow: false,
      command: () => import("./lib/get-issue.js"),
      args: { positional: ["number"] },
      help: "Usage: senti flow get issue <number>\n\nGet GitHub issue content as JSON.",
    },
    "next-action": {
      helpKey: "flow.get.next-action",
      requiresFlow: false,
      explicitTargetResolution: true,
      command: () => import("./lib/get-next-action.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
      help: [
        "Usage: senti flow get next-action [--expect-issue <number> | --expect-no-issue] [--expect-spec <spec>] [--expect-run-id <runId>]",
        "",
        "Return the next AI/skill action for the current in_progress step.",
        "Dispatches from static context rules; the response carries an inline",
        "output_schema usable with validateSchema. The exact response shape",
        "is defined by the command itself and verified by its unit tests.",
      ].join("\n"),
    },
    context: {
      helpKey: "flow.get.context",
      command: () => import("./lib/get-context.js"),
      args: { positional: ["path"], flags: withTargetGuardFlags(["--raw"]), options: withTargetGuardOptions(["--search"]) },
      help: [
        "Usage: senti flow get context [path] [--raw] [--search <query>]",
        "",
        "List mode (no path): filtered analysis entries.",
        "File mode (with path): file content + metric increment.",
        "Search mode (--search): keyword search in analysis entries.",
        "",
        "Options:",
        "  --raw              Output content without JSON envelope",
        "  --search <query>   Search entries by keyword (matches against keywords array)",
      ].join("\n"),
      post(ctx, result) {
        const phase = deriveActivePhase(ctx);
        if (!phase) return;

        if (result?.type) {
          // File mode: result.type is "docs" or "src"
          ctx.flowManager.incrementMetric(phase, result.type === "docs" ? "docsRead" : "srcRead");
        } else if (result?.entries || result?.total != null) {
          // List mode or search mode: reads analysis.json → docsRead
          ctx.flowManager.incrementMetric(phase, "docsRead");
        }
      },
    },
    "runtime-log": {
      helpKey: "flow.get.runtime-log",
      requiresFlow: false,
      explicitTargetResolution: true,
      mismatchTargetResolution: true,
      preparingRunIdSelection: false,
      parseErrorsAsEnvelope: true,
      command: () => import("./lib/get-runtime-log.js"),
      args: {
        flags: FLOW_TARGET_GUARD_FLAGS,
        options: withTargetGuardOptions(["--format", "--sequence", "--run-id"]),
      },
      help: [
        `Usage: senti flow get runtime-log [--format json] [--sequence <n>] [--run-id <runId[#sequence]>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Return the selected runtime log block. Raw block text is printed by default.",
        "With --format json, prints an envelope containing the block text and metadata.",
        "At least one target expectation is required; every supplied expectation must match.",
        "",
        "Options:",
        "  --format <json>     Return a JSON envelope instead of raw block text.",
        "  --sequence <n>      Select a positive runtime-log sequence.",
        "  --run-id <runId[#sequence]>  Select a runtime-log runId and optional sequence.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
  },
  set: {
    step: {
      helpKey: "flow.set.step",
      explicitTargetResolution: true,
      runtimeLog: { stepId: (ctx) => ctx.id },
      command: () => import("./lib/set-step.js"),
      args: { positional: ["id", "status"], flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
      help: "Usage: senti flow set step <id> <status>\n\nUpdate a workflow step's status.",
    },
    request: {
      helpKey: "flow.set.request",
      requiresFlow: false,
      command: () => import("./lib/set-request.js"),
      args: { positional: ["text"], flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--run-id"]) },
      help: [
        `Usage: senti flow set request \"<text>\" [--run-id <id>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Set the user request field. Works in both active and preparing mode.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    issue: {
      helpKey: "flow.set.issue",
      command: () => import("./lib/set-issue.js"),
      args: { positional: ["number"], flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
      help: "Usage: senti flow set issue <number>\n\nSet the GitHub issue number in flow.json.",
    },
    note: {
      helpKey: "flow.set.note",
      requiresFlow: false,
      command: () => import("./lib/set-note.js"),
      args: { positional: ["text"], flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--task-id", "--run-id"]) },
      help: [
        `Usage: senti flow set note \"<text>\" [--task-id <id>] [--run-id <id>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Append a note entry to state.notes. Works in both active and preparing mode.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    summary: {
      helpKey: "flow.set.summary",
      command: () => import("./lib/set-summary.js"),
      args: { positional: ["json"], flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
      help: "Usage: senti flow set summary '<json-array>'\n\nSet requirements list from a JSON string array.",
    },
    req: {
      helpKey: "flow.set.req",
      command: () => import("./lib/set-req.js"),
      args: { positional: ["reqRef", "status"], flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
      help: "Usage: senti flow set req <reqId|zeroBasedIndex> <status>\n\nUpdate a single requirement's status. Prefer requirement ids like R1; numeric values are 0-based indexes.",
    },
    files: {
      helpKey: "flow.set.files",
      command: () => import("./lib/set-files.js"),
      args: { positional: ["reqId"], rest: "paths", flags: FLOW_TARGET_GUARD_FLAGS, options: FLOW_TARGET_GUARD_OPTIONS },
      help: "Usage: senti flow set files <reqId> <path...>\n\nAppend file paths to file-map.json for a requirement. Deduplicates.",
    },
    "review-evidence": {
      helpKey: "flow.set.review-evidence",
      command: () => import("./lib/set-review-evidence.js"),
      args: {
        flags: FLOW_TARGET_GUARD_FLAGS,
        options: withTargetGuardOptions(["--file"]),
      },
      help: [
        `Usage: senti flow set review-evidence --file <path> ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Register one finalized independent review document for the active review target.",
        "The file must be a bounded regular JSON file inside the active spec directory.",
        "The command validates phase, task, current tree, provenance, findings, and target guards.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    broad: {
      helpKey: "flow.set.broad",
      command: () => import("./lib/set-broad.js"),
      args: { positional: ["action"], flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--step", "--reason"]) },
      help: [
        "Usage: senti flow set broad on --step <implement|impl-review|impl-gate> --reason <text>",
        "",
        "Record an audited broad-mode exception for task-decomposed implementation.",
        "The reason must be non-empty. The record stores step, reason, timestamp,",
        "and currentTaskId at the time of opt-in.",
      ].join("\n"),
    },
    policy: {
      helpKey: "flow.set.policy",
      command: () => import("./lib/set-policy.js"),
      args: { positional: ["value"], flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--reason"]) },
      help: "Usage: senti flow set policy nonblocking --reason <text>\n\nOne-way opt-in that keeps eligible quality results advisory while preserving acceptance disposition.",
    },
    "nonblocking-decision": {
      helpKey: "flow.set.nonblocking-decision",
      command: () => import("./lib/set-nonblocking-decision.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--choice", "--reason", "--expect-evidence-digest", "--remaining-risk"]) },
      help: "Usage: senti flow set nonblocking-decision --choice <repair|retry|continue> --reason <text> --expect-evidence-digest <sha256> [--remaining-risk <text>]\n\nBind an agent-owned advisory decision to the active step's latest evidence.",
    },
    metric: {
      helpKey: "flow.set.metric",
      command: () => import("./lib/set-metric.js"),
      args: { positional: ["phase", "counter"], flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--task-id"]) },
      help: `Usage: senti flow set metric <phase> <counter> [--task-id <id>]\n\nAppend a metric entry. Phases: ${VALID_PHASES.join(", ")}. Counters: ${VALID_METRIC_COUNTERS.join(", ")}.`,
    },
    approval: {
      helpKey: "flow.set.approval",
      command: () => import("./lib/set-approval.js"),
      args: { flags: withTargetGuardFlags(["--approved"]), options: withTargetGuardOptions(["--notes", "--confirmed-at"]) },
      help: [
        "Usage: senti flow set approval --approved [--notes <text>] [--confirmed-at <iso>]",
        "",
        "Persist user approval into the active flow's spec.json `user_approval`",
        "field. The renderer reads this field to produce spec.md's",
        "`## User Confirmation` section, so the approval state survives subsequent",
        "`spec render` runs.",
        "",
        "Options:",
        "  --approved             Required. Marks the spec as approved.",
        "  --notes <text>         Optional confirmation note.",
        "  --confirmed-at <iso>   Optional ISO 8601 timestamp; defaults to now.",
      ].join("\n"),
    },
    "issue-log": {
      helpKey: "flow.set.issue-log",
      explicitTargetResolution: true,
      targetNotFoundAsMismatch: true,
      command: () => import("./lib/set-issue-log.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--step", "--reason", "--trigger", "--resolution", "--guardrail-candidate", "--normalized-finding-id", "--repair-ref-commit", "--repair-ref-file", "--task-id"]) },
      help: "Usage: senti flow set issue-log --step <id> --reason <text> [--trigger <text>] [--resolution <text>] [--guardrail-candidate <text>] [--normalized-finding-id <id>] [--repair-ref-commit <sha>] [--repair-ref-file <path>] [--task-id <id>] [--expect-issue <number> | --expect-no-issue] [--expect-spec <spec>] [--expect-run-id <runId>]\n\nRecord an issue-log entry in issue-log.json. When target guards are supplied, append only to the matching flow. Infers taskId from active task unless --task-id is given.",
      post(ctx) {
        const phase = deriveActivePhase(ctx);
        if (phase) ctx.flowManager.incrementMetric(phase, "issueLog");
      },
    },
    init: {
      helpKey: "flow.set.init",
      requiresFlow: false,
      command: () => import("./lib/set-init.js"),
      args: { options: ["--issue", "--request"] },
      help: [
        "Usage: senti flow set init [--issue N] [--request \"<text>\"]",
        "",
        "Initialize a preparing flow state. Creates .active-flow.<runId>",
        "and returns the runId.",
        "",
        "Options:",
        "  --issue <number>   GitHub Issue number to seed into preparing state",
        "  --request <text>   User request text to seed into preparing state",
      ].join("\n"),
    },
    retry: {
      helpKey: "flow.set.retry",
      command: () => import("./lib/set-retry.js"),
      args: { positional: ["action", "kind", "phase"], flags: withTargetGuardFlags(["--yes"]), options: withTargetGuardOptions(["--reason"]) },
      help: [
        "Usage: senti flow set retry reset <gate|review> <phase> --reason <text> --yes",
        "",
        "Reset an exhausted retry counter as an audited recovery for <phase>.",
        `  gate   phases: ${RETRY_HELP_GATE_PHASES.join(" | ")}`,
        `  review phases: ${RETRY_HELP_REVIEW_PHASES.join(" | ")}`,
        "Audited exhausted recovery requires changed evidence and grants one re-evaluation.",
        "Unchanged evidence is rejected. --reason and --yes are required.",
      ].join("\n"),
    },
    "acceptance-decision": {
      helpKey: "flow.set.acceptance-decision",
      command: () => import("./lib/set-acceptance-decision.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--choice"]) },
      help: [
        "Usage: senti flow set acceptance-decision --choice <choice>",
        "",
        "Resolve a notVerifiable requirement or unresolved deferred-finding risk with an explicit user choice.",
        "Choices: accept_risk_and_continue, abort",
        "No choice is inferred from autoApprove or an omitted --choice option.",
      ].join("\n"),
    },
    auto: {
      helpKey: "flow.set.auto",
      requiresFlow: false,
      command: () => import("./lib/set-auto.js"),
      args: { positional: ["value"], flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--run-id"]) },
      help: [
        `Usage: senti flow set auto on|off [--run-id <id>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Enable or disable autoApprove mode. Writes to flow.json when an",
        "active flow exists; otherwise writes to the matching preparing",
        "flow (.active-flow.<runId>). --run-id selects a preparing flow",
        "when multiple exist; auto-detected when exactly one is present.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
  },
  run: {
    dispatch: {
      helpKey: "flow.run.dispatch",
      requiresFlow: true,
      explicitTargetResolution: true,
      targetNotFoundAsMismatch: true,
      command: () => import("./lib/run-dispatch.js"),
      args: {
        flags: FLOW_TARGET_GUARD_FLAGS,
        options: withTargetGuardOptions(["--approve", "--agent-work-dir"]),
      },
      help: [
        "Usage: senti flow run dispatch --expect-run-id <runId> [--approve <token>] [--agent-work-dir <path>] [--expect-issue <number> | --expect-no-issue] [--expect-spec <spec>]",
        "",
        "Own the active Flow continuation inside one CLI process. Non-terminal",
        "directives are executed serially through the configured Agent service;",
        "the command returns only for approval, a user decision, a terminal",
        "directive, a concrete blocker, or a true target mismatch.",
        "",
        "Options:",
        "  --approve <token>  Resume the exact approval boundary returned by a prior dispatch.",
        "  --agent-work-dir <path>  Set the agent/tmp/log base directory for this invocation.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    direct: {
      helpKey: "flow.run.direct",
      requiresFlow: true,
      explicitTargetResolution: true,
      command: () => import("./lib/run-direct.js"),
      args: {
        flags: FLOW_TARGET_GUARD_FLAGS,
        options: withTargetGuardOptions(["--record-id", ...FLOW_RUN_RUNTIME_OPTIONS]),
      },
      help: [
        `Usage: senti flow run direct [--record-id <id>] [--agent-work-dir <path>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Apply one validator-owned recovery record through the normal Flow transition.",
        "The command owns no separate session, plan, verification, or finalize state.",
        "When one record is available it is selected deterministically; otherwise inspect",
        "the current normal Flow evidence and select an exact record ID.",
        "",
        "Options:",
        "  --record-id <id>  Exact available validator failure record to recover.",
        "  --agent-work-dir <path>  Set the agent/tmp/log base directory for this invocation.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    "recover-existing-implementation": {
      helpKey: "flow.run.recover-existing-implementation",
      command: () => import("./lib/run-recover-existing-implementation.js"),
      args: {
        flags: FLOW_TARGET_GUARD_FLAGS,
        options: FLOW_RUN_OPTIONS,
      },
      help: [
        `Usage: senti flow run recover-existing-implementation [--agent-work-dir <path>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Record an audited transition from a post-acceptance-rewind scenario-validity preflight block to post-implementation test execution. The command requires exact target guards, the latest rewind from acceptance-review, and preflight evidence of implementation-target changes.",
        "",
        "Options:",
        "  --agent-work-dir <path>  Set the agent/tmp/log base directory for this invocation.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    "recover-review-pass": {
      helpKey: "flow.run.recover-review-pass",
      command: () => import("./lib/run-recover-review-pass.js"),
      args: {
        flags: FLOW_TARGET_GUARD_FLAGS,
        options: [...FLOW_RUN_OPTIONS, "--phase"],
      },
      help: [
        `Usage: senti flow run recover-review-pass --phase <draft-questions|draft-coverage|spec|test|impl> ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Restore a flow-level review projection from one exact canonical PASS.",
        "The command requires exact target guards and verifies the current tree,",
        "review target state, canonical digest, provenance, PASS step outcome,",
        "and one matching immutable review-history artifact before mutation.",
        "It does not invoke the reviewer or fabricate triage evidence.",
        "",
        "Options:",
        "  --phase <phase>       Exact flow-level review phase to recover.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    "preimplementation-bootstrap": {
      helpKey: "flow.run.preimplementation-bootstrap",
      command: () => import("./lib/run-preimplementation-bootstrap.js"),
      args: {
        flags: FLOW_TARGET_GUARD_FLAGS,
        options: FLOW_RUN_OPTIONS,
      },
      help: [
        `Usage: senti flow run preimplementation-bootstrap [--agent-work-dir <path>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Record an audited recovery from a scenario-validity preflight block caused by existing implementation-target changes. Exact target guards, an immutable repair baseline, and the persisted preflight evidence are required; the command skips only scenario-validity and test-review, then resumes implement.",
        "",
        "Options:",
        "  --agent-work-dir <path>  Set the agent/tmp/log base directory for this invocation.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    "rewind-test-evidence": {
      helpKey: "flow.run.rewind-test-evidence",
      command: () => import("./lib/run-rewind-test-evidence.js"),
      args: {
        flags: FLOW_TARGET_GUARD_FLAGS,
        options: FLOW_RUN_OPTIONS,
      },
      help: [
        `Usage: senti flow run rewind-test-evidence [--agent-work-dir <path>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Recover a flow-level impl-gate blocked only by stale test evidence after a materialized implementation repair; exact runId, spec, and Issue identity guards are required, with no step, fingerprint, or allowlist input.",
        "",
        "Options:",
        "  --agent-work-dir <path>  Set the agent/tmp/log base directory for this invocation.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
    },
    gate: {
      helpKey: "flow.run.gate",
      requiresFlow: false,
      responsibilities: DRAFT_REVIEW_GATE_RESPONSIBILITIES,
      runtimeLog: { stepId: gateRuntimeLogStepId },
      async pre(ctx) {
        if (!ctx.flowState) return;
        // When --phase is omitted, phase resolution and stale-step recovery
        // happen inside RunGateCommand.execute (which has exclusive ownership
        // over flow state mutations for the duration of the gate). The
        // pre-hook's step-status update is only valid when phase is already
        // known, so skip it otherwise.
        if (ctx.phase == null) return;
        if (terminalGateRevalidation(ctx)) {
          ctx.terminalGateRevalidation = true;
          return;
        }
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "gate:pre",
          command: "run-gate",
          phase: ctx.phase,
        });
      },
      command: () => import("./lib/run-gate.js"),
      args: {
        options: ["--spec", "--phase", ...FLOW_RUN_OPTIONS],
        flags: FLOW_TARGET_GUARD_FLAGS,
      },
      help: [
        "Usage: senti flow run gate [options]",
        "",
        "Run gate check. Resolves target from flow.json if omitted.",
        `Responsibility boundary: ${DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY.summary}.`,
        "",
        "Options:",
        "  --spec <path>                 Path to spec (directory / spec.json / legacy spec.md; auto-resolved from flow.json)",
        `  --phase <${VALID_GATE_PHASES.join("|")}>  Gate phase (default: auto-resolve from in-progress step)`,
        "  --agent-work-dir <path>       Per-invocation agent/tmp base directory",
        "  Required evaluations cannot be bypassed from the public CLI.",
      ].join("\n"),
      async post(ctx, result) {
        if (!ctx.flowState) return;
        if (
          ctx.terminalGateRevalidation === true
          || (
            result?.result === "recovered"
            && result?.artifacts?.evidenceRefresh?.recovered === true
          )
        ) return;
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "gate:post",
          command: "run-gate",
          phase: result?.artifacts?.phase || ctx.phase,
        }, result);
      },
      async nonblockingPost(ctx, result) {
        const phase = result?.artifacts?.phase || result?.data?.effectivePhase || ctx.phase;
        const active = findActiveNode(ctx.flowState || {});
        const stepId = active?.stepId === "task-gate"
          ? "task-gate"
          : phase === "draft"
            ? "draft-gate"
            : phase === "spec"
              ? "spec-gate"
              : phase === "integration"
                ? "impl-gate"
                : null;
        if (!stepId || !nonblockingRouteFor(stepId)) return;
        const { recordEligibleNonblockingAttempt } = await import("./lib/nonblocking.js");
        recordEligibleNonblockingAttempt(ctx, stepId, result);
      },
      async onError(ctx, err) {
        const { appendIssueLogFromGateError } = await import("./lib/run-gate.js");
        const phase = err?.data?.effectivePhase
          || ctx.phase
          || resolveGatePhaseFromState(ctx.flowState)?.phase;
        const errorCtx = { ...ctx, phase };
        tryAppendIssueLog(() => appendIssueLogFromGateError(errorCtx, err));
        if (ctx.terminalGateRevalidation === true) return;
        if (err?.code === "GATE_OUTPUT_TOOLING_FAILURE") return;
        await applyLifecycleActionsFromRegistry(errorCtx, {
          event: "gate:onError",
          command: "run-gate",
          phase,
        }, null, err);
      },
    },
    review: {
      helpKey: "flow.run.review",
      draftReviewPostHookBoundary: DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY,
      responsibilities: DRAFT_REVIEW_REVIEW_RESPONSIBILITIES,
      runtimeLog: { stepId: reviewRuntimeLogStepId },
      command: () => import("./lib/run-review.js"),
      args: {
        flags: withTargetGuardFlags(["--dry-run", "--skip-confirm"]),
        options: ["--phase", ...FLOW_RUN_OPTIONS],
      },
      help: [
        `Usage: senti flow run review [options] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Run AI code review on current changes.",
        `Responsibility boundary: ${DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY.summary}.`,
        "",
        "Options:",
        `  --phase <type>   Review phase: ${VALID_REVIEW_PHASES.map((p) => `'${p}'`).join(", ")}`,
        "  --agent-work-dir <path>  Per-invocation agent/tmp base directory",
        "  --dry-run        Show proposals without applying",
        "  --skip-confirm   Skip initial confirmation prompt",
        ...FLOW_TARGET_GUARD_HELP_LINES,
      ].join("\n"),
      async post(ctx, result) {
        assertDraftReviewRegistryHookBoundary();
        if (
          result?.result === "recovered"
          && result?.artifacts?.evidenceRefresh?.recovered === true
        ) return;
        try {
          await applyLifecycleActionsFromRegistry(ctx, {
            event: "review:post",
            command: "run-review",
            phase: ctx.phase,
            currentStepId: activeImplReviewStepId(ctx.flowState),
            dryRun: ctx.dryRun,
          }, result);
        } catch (error) {
          const reviewMod = await import("./lib/run-review.js");
          let persistenceFailure = null;
          try {
            reviewMod.persistReviewPostHookToolingFailure(ctx, result, error);
          } catch (failure) {
            persistenceFailure = failure;
          }
          const recovery = reviewMod.recoverFinalizedFlowReviewPostHookFailure(ctx, result, error);
          if (recovery) {
            await applyLifecycleActionsFromRegistry(ctx, {
              event: "review:post",
              command: "run-review",
              phase: ctx.phase,
              currentStepId: activeImplReviewStepId(ctx.flowState),
              dryRun: ctx.dryRun,
            }, result);
            return;
          }
          throw persistenceFailure || error;
        }
      },
      async nonblockingPost(ctx, result) {
        if (ctx.dryRun) return;
        const phase = result?.artifacts?.phase || result?.data?.phase || ctx.phase;
        const active = findActiveNode(ctx.flowState || {});
        const stepId = phase === "draft-questions"
          ? "draft-questions-review"
          : phase === "draft-coverage"
            ? "draft-coverage-review"
            : phase === "spec"
              ? "spec-review"
              : phase === "test"
                ? "test-review"
                : phase === "impl"
                  ? active?.stepId === "task-review" ? "task-review" : "impl-review"
                  : null;
        if (!stepId || !nonblockingRouteFor(stepId)) return;
        const { recordEligibleNonblockingAttempt } = await import("./lib/nonblocking.js");
        recordEligibleNonblockingAttempt(ctx, stepId, result);
      },
    },
    "auto-check": {
      helpKey: "flow.run.auto-check",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-auto-check.js"),
      requiresFlow: false,
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: withTargetGuardOptions(["--run-id", ...FLOW_RUN_RUNTIME_OPTIONS]) },
      help: [
        `Usage: senti flow run auto-check [--run-id <id>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Evaluate whether the current request qualifies for auto mode.",
        "Input is derived statically from flow state based on phase:",
        "  - approval done            → skip AI (unconditionally eligible)",
        "  - draft-gate done + draft  → issue + request + draft body",
        "  - otherwise                → issue + request",
        "",
        "Runs static keyword gates first; if clear, calls the AI once for scoring.",
        "Result is persisted to the active flow.json autoCheck, or to the",
        "preparing flow state (.active-flow.<runId>) when --run-id targets one.",
        "`flow set auto on` then trusts this persisted verdict instead of",
        "re-invoking the AI with a thinner input.",
        "",
        "Options:",
        "  --run-id <runId>   Target preparing flow (required for prelude, even when another flow is active)",
        ...FLOW_TARGET_GUARD_HELP_LINES,
        "  --agent-work-dir <path>  Per-invocation agent/tmp base directory",
      ].join("\n"),
    },
    // impl-confirm is a read-only check, not the finalize action itself.
    // Step status is managed by the skill, not hooks.
    "impl-confirm": {
      helpKey: "flow.run.impl-confirm",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-impl-confirm.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: ["--mode", ...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run impl-confirm [options]",
        "",
        "Check implementation readiness against requirements.",
        "",
        "Options:",
        "  --mode <overview|detail>  Check mode (default: overview)",
        "    overview: summarize requirements status from flow.json",
        "    detail:   also compare git diff against requirements",
        "  --agent-work-dir <path>   Per-invocation agent/tmp base directory",
      ].join("\n"),
    },
    "finalize-commit": {
      helpKey: "flow.run.finalize-commit",
      runtimeLog: { stepId: "finalize-commit" },
      command: () => import("./lib/run-finalize-commit.js"),
      args: {
        flags: FLOW_TARGET_GUARD_FLAGS,
        options: ["--message", ...FLOW_RUN_OPTIONS],
      },
      help: [
        "Usage: senti flow run finalize-commit [options]",
        "",
        "Commit implementation changes and durable finalization artifacts.",
        "",
        "Options:",
        "  --message <msg>  Custom commit message",
        "  --agent-work-dir <path>  Per-invocation agent/tmp base directory",
      ].join("\n"),
      async pre(ctx) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:pre",
          command: "finalize-commit",
        });
      },
      async post(ctx, result) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:post",
          command: "finalize-commit",
        }, result);
      },
      async onError(ctx, err) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:onError",
          command: "finalize-commit",
        }, null, err);
      },
    },
    "finalize-merge": {
      helpKey: "flow.run.finalize-merge",
      // Its failure handler commits the complete Flow metadata transaction.
      // Do not append a second runtime-log state mutation after that commit.
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-finalize-merge.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run finalize-merge",
        "",
        "Squash merge or PR creation. On failure, subsequent steps are skipped.",
      ].join("\n"),
      async pre(ctx) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:pre",
          command: "finalize-merge",
        });
      },
      async post(ctx, result) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:post",
          command: "finalize-merge",
        }, result);
      },
      async onError(ctx, err) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:onError",
          command: "finalize-merge",
        }, null, err);
      },
    },
    "finalize-sync": {
      helpKey: "flow.run.finalize-sync",
      runtimeLog: { stepId: "finalize-sync" },
      command: () => import("./lib/run-finalize-sync.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run finalize-sync",
        "",
        "Build docs on main repo after merge and commit.",
      ].join("\n"),
      async pre(ctx) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:pre",
          command: finalizeCommand("sync"),
        });
      },
      async post(ctx, result) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:post",
          command: finalizeCommand("sync"),
        }, result);
      },
      async onError(ctx, err) {
        if (["REPOSITORY_FLOW_OPERATION_BUSY", "REPOSITORY_MAINTENANCE_BUSY"].includes(err?.code)) return;
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:onError",
          command: finalizeCommand("sync"),
        }, null, err);
      },
    },
    "finalize-cleanup": {
      helpKey: "flow.run.finalize-cleanup",
      runtimeLog: { stepMetadata: false },
      explicitTargetResolution: true,
      command: () => import("./lib/run-finalize-cleanup.js"),
      args: { flags: withTargetGuardFlags(["--auto-rescue", "--force"]), options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run finalize-cleanup [--auto-rescue | --force]",
        "",
        "Clear flow state, remove worktree/branch, write last-finalized-spec pointer.",
        "",
        "Spec 253 orphan commit handling (squash route only):",
        "  --auto-rescue  Cherry-pick orphan commits onto baseBranch before deletion.",
        "                 Aborts on conflict; halts on main repo dirty/locked.",
        "  --force        Delete feature branch even if orphan commits exist.",
        "                 Records the dropped commit list to issue-log.",
        "  (no flag)      Detect orphan commits and halt (worktree/branch retained).",
        "                 The user must re-run with --auto-rescue or --force, or",
        "                 archive the branch and run --force after manual recovery.",
        "",
        "--auto-rescue and --force are mutually exclusive.",
      ].join("\n"),
      async pre(ctx) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:pre",
          command: finalizeCommand("cleanup"),
        });
      },
      // The command body completes the cleanup step, outbox, and durable final
      // commit before deleting its worktree. A dispatcher post hook would run
      // after that deletion and cannot safely load worktree-owned modules.
      async onError(ctx, err) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "finalize:onError",
          command: finalizeCommand("cleanup"),
        }, null, err);
      },
    },
    sync: {
      helpKey: "flow.run.sync",
      runtimeLog: { stepMetadata: false },
      requiresFlow: false,
      command: () => import("./lib/run-sync.js"),
      args: { flags: withTargetGuardFlags(["--dry-run"]), options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run sync [options]",
        "",
        "Sync documentation: build -> review -> add -> commit.",
        "",
        "Options:",
        "  --dry-run   Preview only",
      ].join("\n"),
    },
    "reopen-draft": {
      helpKey: "flow.run.reopen-draft",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-reopen-draft.js"),
      args: {
        flags: ["--expect-no-issue"],
        options: ["--reason", "--category", ...FLOW_RUN_OPTIONS],
      },
      help: [
        `Usage: senti flow run reopen-draft [--reason <text>] [--category <category>] ${FLOW_TARGET_GUARD_USAGE}`,
        "",
        "Rewind the flow's draft step to in_progress. The task-addition route",
        "requires at least one done task. Source-discovered spec corrections use:",
        "  --category spec-correction",
        "  --expect-run-id <runId> --expect-spec <spec>",
        "  --expect-issue <number> or --expect-no-issue",
        "",
        "The reason and target identity are recorded in the rewind audit.",
        "",
        "Task-level mode rewinds draft so the user can add tasks to an approved spec;",
        "its existing optional reason and completed-task prerequisites are unchanged.",
        "",
        "Flow-level mode rewinds impl-review, impl-gate, retro, acceptance-review,",
        "or final-regression to draft. It requires --reason and all target guards,",
        "preserves source/tasks/artifacts, and invalidates prior approval/evidence.",
        ...FLOW_TARGET_GUARD_HELP_LINES,
        "",
        "Task-level events remain recorded in specs/<spec>/issue-log.json;",
        "flow-level events are atomically audited in flow.json planRewinds.",
      ].join("\n"),
    },
    "start-task": {
      helpKey: "flow.run.start-task",
      explicitTargetResolution: true,
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-start-task.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: ["--task-id", ...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run start-task --task-id <id>",
        "",
        "Manually promote a pending task to currentTaskId and transition",
        "it to in_progress. Useful for recovery or manual ordering when",
        "auto-promote is not desired.",
      ].join("\n"),
    },
    "complete-task": {
      helpKey: "flow.run.complete-task",
      explicitTargetResolution: true,
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-complete-task.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: ["--task-id", ...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run complete-task [--task-id <id>]",
        "",
        "Complete currentTaskId (or --task-id if specified), apply parent",
        "propagation, and auto-promote the next pending task. Useful for",
        "recovery when impl-gate post-hook did not fire.",
      ].join("\n"),
    },
    "update-overview": {
      helpKey: "flow.run.update-overview",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-update-overview.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: ["--json", ...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run update-overview --json '<additions>'",
        "",
        "Append this task's overview contribution to the parent spec.json.",
        "Additions JSON shape:",
        "  {modules: string[], data_flow: string[], decisions: string[]}",
        "All three categories are required.",
        "The current task id is auto-stamped as added_by_task. spec.md is",
        "re-rendered after the merge. Spec 226 moves this from a dedicated",
        "step to an impl-step production caller.",
      ].join("\n"),
    },
    // lint is a sub-task of the implement phase; it does not exclusively own the step.
    // Step status is managed by the skill, not hooks.
    lint: {
      helpKey: "flow.run.lint",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-lint.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: ["--base", ...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run lint [options]",
        "",
        "Check changed files against guardrail lint patterns.",
        "",
        "Options:",
        "  --base <branch>  Base branch for git diff (auto-resolved from flow.json)",
      ].join("\n"),
    },
    "test-execute": {
      helpKey: "flow.run.test-execute",
      runtimeLog: { stepId: "test-execute" },
      command: () => import("./lib/run-test-execute.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run test-execute",
        "",
        "Execute the project's test runner via AI agent and persist:",
        "  specs/<spec>/test-execute-result.json (machine-readable summary)",
        "  specs/<spec>/tests/.raw/test-execution.log (raw stdout/stderr)",
      ].join("\n"),
      async post(ctx) {
        const path = await import("node:path");
        const { readJsonStrict, validateTestExecuteResultV2 } = await import("./lib/test-artifacts.js");
        const specDir = path.dirname(path.resolve(ctx.root, ctx.flowState.spec));
        validateTestExecuteResultV2(readJsonStrict(path.join(specDir, "test-execute-result.json")));
        tryUpdateStepStatus(ctx, "test-execute", "done", undefined, { event: "test-execute:post" });
      },
    },
    "scenario-validity": {
      helpKey: "flow.run.scenario-validity",
      runtimeLog: { stepId: "scenario-validity" },
      internal: true,
      requiresFlow: true,
      command: () => import("./lib/run-scenario-validity.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run scenario-validity",
        "",
        "Execute pre-implementation spec-local tests and persist:",
        "  specs/<spec>/scenario-validity-result.json",
        "  specs/<spec>/tests/.raw/scenario-validity.log",
      ].join("\n"),
      post(ctx, result) {
        if (result?.result === "pass") {
          tryUpdateStepStatus(ctx, "scenario-validity", "done", { taskId: null }, { event: "scenario-validity:post" });
        }
      },
      async nonblockingPost(ctx, result) {
        const { recordEligibleNonblockingAttempt } = await import("./lib/nonblocking.js");
        recordEligibleNonblockingAttempt(ctx, "scenario-validity", result);
      },
    },
    "test-result-review": {
      helpKey: "flow.run.test-result-review",
      runtimeLog: { stepId: "test-result-review" },
      command: () => import("./lib/run-test-result-review.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run test-result-review",
        "",
        "Verify test-execute-result.json integrity against raw output and code.",
        "Persists specs/<spec>/test-result-review.json and test-result-review.md.",
      ].join("\n"),
      async post(ctx) {
        const path = await import("node:path");
        const { readJsonStrict, validateTestResultReview } = await import("./lib/test-artifacts.js");
        const specDir = path.dirname(path.resolve(ctx.root, ctx.flowState.spec));
        const review = validateTestResultReview(readJsonStrict(path.join(specDir, "test-result-review.json")));
        if (review.verdict !== "pass") throw new Error("test-result-review verdict is not pass");
        tryUpdateStepStatus(ctx, "test-result-review", "done", undefined, { event: "test-result-review:post" });
      },
      async nonblockingPost(ctx, result) {
        const { recordEligibleNonblockingAttempt } = await import("./lib/nonblocking.js");
        recordEligibleNonblockingAttempt(ctx, "test-result-review", result);
      },
    },
    // retro is a mainline impl-phase step that aggregates test-execute results.
    retro: {
      helpKey: "flow.run.retro",
      runtimeLog: { stepId: "retro" },
      command: () => import("./lib/run-retro.js"),
      args: { flags: withTargetGuardFlags(["--force", "--dry-run"]), options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run retro [options]",
        "",
        "Aggregate test-execute results per requirement and save retro.json.",
        "Reads test-result-review.json and test-execute-result.json (produced",
        "by earlier impl steps); does not execute tests.",
        "",
        "Options:",
        "  --force     Overwrite existing retro.json (default: always overwrites)",
        "  --dry-run   Preview only, do not write retro.json",
      ].join("\n"),
      post(ctx, result) {
        if (
          result?.result === "recovered"
          && result?.artifacts?.evidenceRefresh?.recovered === true
        ) return;
        if (ctx.flowState?.nonblocking?.enabled === true) {
          const specDir = path.dirname(path.resolve(ctx.root, ctx.flowState.spec));
          const artifact = JSON.parse(fs.readFileSync(path.join(specDir, "retro.json"), "utf8"));
          if (Number(artifact?.summary?.not_done || 0) > 0) return;
        }
        tryUpdateStepStatus(ctx, "retro", "done", undefined, { event: "retro:post" });
      },
      async nonblockingPost(ctx, result) {
        const { recordEligibleNonblockingAttempt } = await import("./lib/nonblocking.js");
        recordEligibleNonblockingAttempt(ctx, "retro", result);
      },
    },
    "final-regression": {
      helpKey: "flow.run.final-regression",
      runtimeLog: { stepId: "final-regression" },
      command: () => import("./lib/run-final-regression.js"),
      args: {
        flags: withTargetGuardFlags(["--record-and-proceed"]),
        options: ["--record-category", "--record-evidence", "--remaining-risk", ...FLOW_RUN_OPTIONS],
      },
      help: [
        "Usage: senti flow run final-regression [--record-and-proceed --record-category <category> --record-evidence <text> --remaining-risk <text>]",
        "",
        "Run the full project-level regression command after retro and before finalize.",
        "Persists specs/<spec>/final-regression-result.json and specs/<spec>/tests/.raw/final-regression-attempt-<N>.log (zero-padded to at least three digits).",
        "A current-diff failure may be recorded only as out_of_scope with explicit evidence and remaining risk.",
      ].join("\n"),
      async post(ctx, result) {
        if (
          result?.result === "recovered"
          && result?.artifacts?.evidenceRefresh?.recovered === true
        ) return;
        const path = await import("node:path");
        const { readJsonStrict, validateFinalRegressionResult } = await import("./lib/test-artifacts.js");
        const specDir = path.dirname(path.resolve(ctx.root, ctx.flowState.spec));
        const artifact = validateFinalRegressionResult(readJsonStrict(path.join(specDir, "final-regression-result.json")));
        const failedRecorded = artifact.result === "fail"
          && result?.result === "fail"
          && result?.failedRecorded === true
          && artifact.completed === true
          && artifact.selectedAction === "explicit-record-and-proceed"
          && artifact.recordAndProceed?.validated === true
          && artifact.nextAction === "report";
        const completed = (artifact.result === "pass" && result?.result === "pass")
          || (artifact.result === "skipped" && result?.result === "skipped")
          || failedRecorded;
        if (!completed && ctx.flowState?.nonblocking?.enabled === true && artifact.result === "fail") {
          return;
        }
        if (!completed) {
          throw new Error("final-regression result is not pass, skipped, or failed-recorded");
        }
        tryUpdateStepStatus(ctx, "final-regression", "done", undefined, { event: "final-regression:post" });
      },
      async nonblockingPost(ctx, result) {
        const { recordEligibleNonblockingAttempt } = await import("./lib/nonblocking.js");
        recordEligibleNonblockingAttempt(ctx, "final-regression", result);
      },
    },
    "acceptance-review": {
      helpKey: "flow.run.acceptance-review",
      runtimeLog: { stepId: "acceptance-review" },
      command: () => import("./lib/run-acceptance-review.js"),
      args: { flags: FLOW_TARGET_GUARD_FLAGS, options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run acceptance-review",
        "",
        "Evaluate original request satisfaction after retro and before final-regression.",
        "Persists specs/<spec>/acceptance-review.json and routes pass/non-pass verdicts.",
      ].join("\n"),
    },
    // report generates a work report from the current flow state.
    report: {
      helpKey: "flow.run.report",
      runtimeLog: { stepId: "report" },
      command: () => import("./lib/run-report.js"),
      args: { flags: withTargetGuardFlags(["--dry-run"]), options: [...FLOW_RUN_OPTIONS] },
      help: [
        "Usage: senti flow run report [options]",
        "",
        "Generate a work report from the current flow state.",
        "",
        "Options:",
        "  --dry-run   Preview only, do not write report.json",
      ].join("\n"),
      async pre(ctx) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "report:pre",
          command: "report",
        });
      },
      async post(ctx, result) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "report:post",
          command: "report",
        }, result);
      },
      async onError(ctx, err) {
        await applyLifecycleActionsFromRegistry(ctx, {
          event: "report:onError",
          command: "report",
        }, null, err);
      },
    },
  },
  report: {
    show: {
      helpKey: "flow.report.show",
      runtimeLog: { stepMetadata: false },
      command: () => import("./lib/run-report-show.js"),
      requiresFlow: false,
      args: { flags: [] },
      help: [
        "Usage: senti flow report show",
        "",
        "Stream the most recent finalize Report text to stdout.",
        "Reads .senti/last-finalized-spec to locate the latest",
        "finalized spec and prints its report.json `text` field.",
        "Exits non-zero if the pointer or report.json is missing.",
      ].join("\n"),
    },
  },
};
