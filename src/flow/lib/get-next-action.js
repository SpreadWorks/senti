/**
 * src/flow/lib/get-next-action.js
 *
 * Return the next AI/skill action for the current flow or task step.
 *
 * Derives behaviour from definition.js instead of context-rules.json.
 * Adding a new flow step is done by editing definition.js — zero changes here.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FlowCommand } from "./base-command.js";
import { getStepInstructions } from "./get-step-instructions.js";
import {
  findActiveNode,
  deriveNextAction,
  getFlowNode,
  getTaskNode,
} from "../definition.js";
import { flattenSteps, promoteNextPendingLeaf } from "./step-tree.js";
import { promoteNextPending } from "../../lib/flow-helpers.js";
import { loadRules, filterRules, renderRuleBlock } from "../../lib/skill-rules.js";
import { buildReviewStopView, reviewPhaseForStepId } from "./review-failure.js";
import { resolveGateRecoveryDisplayPhase } from "./gate-recovery-display.js";
import { countReviewRetry } from "./run-review.js";
import { inspectDurableGateSemanticDeferral } from "./run-gate.js";
import { buildStateRetryRecoveryView, resolveRecoveryMaxAttempts } from "./retry-recovery.js";
import {
  evaluateTaskScope,
  taskScopeViolationMessages,
} from "./task-scope.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { FlowCompletion } from "./flow-completion.js";
import {
  AwaitingDecisionOutcome,
  ExternalBlockedOutcome,
  StepAttemptLog,
} from "./step-outcome.js";

const DEFAULT_SCHEMA_DIR = fileURLToPath(new URL("../schemas/", import.meta.url));

function resolveSchemaDir() {
  return process.env.SENTI_NEXT_ACTION_SCHEMA_DIR || DEFAULT_SCHEMA_DIR;
}

function loadSchema(relPath) {
  const full = path.join(resolveSchemaDir(), relPath);
  return JSON.parse(readFileSync(full, "utf8"));
}

function findCurrentTask(state) {
  if (state.currentTaskId == null) return null;
  return state.tasks.find((t) => t.id === state.currentTaskId) || null;
}

function findUnresolvedInProgressStep(steps, resolveNode) {
  return flattenSteps(steps || []).find((step) => (
    step.status === "in_progress" && !resolveNode(step.id)
  )) || null;
}

function findUnresolvedInProgressTarget(state) {
  const task = findCurrentTask(state);
  if (task && Array.isArray(task.steps)) {
    const step = findUnresolvedInProgressStep(task.steps, getTaskNode);
    if (step) return { scope: "task", taskId: state.currentTaskId, stepId: step.id };
  }
  const step = findUnresolvedInProgressStep(state.steps, getFlowNode);
  if (step) return { scope: "flow", taskId: null, stepId: step.id };
  return null;
}

function assertNoUnresolvedInProgressTarget(state) {
  const target = findUnresolvedInProgressTarget(state);
  if (target) {
    throw new Error(`NO_RULE_FOR_STEP: ${target.scope}.${target.stepId} has no entry in definition`);
  }
}

function deriveStateSet(state) {
  const result = [];
  if (state?.worktree === true) result.push("worktreeActive");
  if (state?.autoApprove === true) result.push("autoApproveOn");
  return result;
}

let _cachedRules = null;
function getRulesCached() {
  if (_cachedRules === null) {
    try {
      _cachedRules = loadRules();
    } catch (err) {
      // If rules.json is missing or invalid, fail loudly — drift mitigation is a core
      // package guarantee per spec D7.
      throw err;
    }
  }
  return _cachedRules;
}

function injectPersistentRules(baseContent, target, state) {
  const rules = getRulesCached();
  const phaseId = `${target.scope}.${target.stepId}`;
  const stateSet = deriveStateSet(state);
  const matched = filterRules(rules, { phase: phaseId, state: stateSet });
  if (matched.length === 0) return baseContent;
  const block = renderRuleBlock(matched);
  return `${block}\n${baseContent}`;
}

function buildContextDescriptor(kinds, target, state) {
  const paths = {};
  if (state.spec && kinds.includes("spec") && target.scope !== "task") {
    paths.spec = state.spec;
  }
  if (target.scope === "task" && kinds.includes("task_spec")) {
    const task = state.tasks.find((t) => t.id === target.taskId);
    if (task?.spec) paths.task_spec = task.spec;
  }
  return { kinds, paths };
}

function isFlowImplementationStep(target) {
  return target?.scope === "flow"
    && ["implement", "impl-review", "impl-gate"].includes(target.stepId);
}

function attachRetryRecovery(result, stopKey, stopView, retryRecovery) {
  const view = retryRecovery ? { ...(stopView || {}), ...retryRecovery } : stopView;
  if (view && stopKey) result[stopKey] = view;
  if (retryRecovery) result.retryRecovery = retryRecovery;
  if (!view) return;
  for (const key of ["stopReason", "classification", "phase", "retryBudgetConsumed", "recoveryCommand", "reason", "recoveryHint"]) {
    if (view[key] !== undefined) result[key] = view[key];
  }
}

function buildRetryRecoveryForState(ctx, state, { kind, phase, attempts, max }) {
  return buildStateRetryRecoveryView({
    root: ctx.root,
    flowState: state,
    kind,
    phase,
    attempts,
    max,
  });
}

function attachLatestStepAttempt(result, state, target) {
  if (!state.runId || !target?.stepId) return;
  const log = new StepAttemptLog(state.stepAttempts || []);
  const lastAttempt = log.latestForRun(state.runId);
  if (lastAttempt) {
    result.lastStepAttempt = lastAttempt.toJSON();
    result.lastStepOutcome = lastAttempt.outcome.toJSON();
  }
  const attempt = log.latest({
    runId: state.runId,
    taskId: target.taskId ?? null,
    stepId: target.stepId,
  });
  if (!attempt) return;
  result.stepAttempt = attempt.toJSON();
  result.stepOutcome = attempt.outcome.toJSON();
  if (attempt.outcome instanceof ExternalBlockedOutcome || attempt.outcome instanceof AwaitingDecisionOutcome) {
    result.halt = true;
    result.resumeInstruction = attempt.outcome.resumeInstruction;
  }
}

function buildPlanGateSemanticDeferralRecovery(ctx, state, gateRecoveryDisplay) {
  if (!["draft", "spec"].includes(gateRecoveryDisplay.phase)) return null;
  const inspection = inspectDurableGateSemanticDeferral({
    root: ctx.root,
    flowState: state,
    phase: gateRecoveryDisplay.phase,
  });
  if (!inspection.deferAllowed || inspection.reason !== "semantic_findings") return null;
  const phase = gateRecoveryDisplay.phase;
  return Object.freeze({
    kind: "gate",
    phase,
    canonicalPhase: phase,
    attempts: gateRecoveryDisplay.attempts,
    max: gateRecoveryDisplay.max,
    recoveryPossible: true,
    recoveryReason: "semantic_findings",
    classification: "semantic_findings",
    changedEvidence: null,
    recoveryCommand: [
      "senti flow run gate",
      `--phase ${phase}`,
      `--expect-run-id ${state.runId}`,
      `--expect-issue ${state.issue}`,
      `--expect-spec ${state.spec}`,
    ].join(" "),
    reason: "semantic_findings",
  });
}

function buildGateRetryRecovery(ctx, state, gateRecoveryDisplay) {
  const existingRecovery = () => buildRetryRecoveryForState(ctx, state, {
    kind: "gate",
    phase: gateRecoveryDisplay.phase,
    attempts: gateRecoveryDisplay.attempts,
    max: gateRecoveryDisplay.max,
  });
  if (["task-impl", "integration"].includes(gateRecoveryDisplay.phase)) {
    return existingRecovery();
  }
  return buildPlanGateSemanticDeferralRecovery(ctx, state, gateRecoveryDisplay)
    || existingRecovery();
}

function promoteNextTaskAndFirstStep(state) {
  const taskId = promoteNextPending(state);
  if (!taskId) return false;
  const task = findCurrentTask(state);
  if (!task || !Array.isArray(task.steps)) return true;
  const pending = task.steps.find((s) => s.status === "pending");
  if (pending) pending.status = "in_progress";
  return true;
}

function promoteNextAvailableTarget(state) {
  const task = findCurrentTask(state);
  if (task && Array.isArray(task.steps)) {
    const pending = task.steps.find((s) => s.status === "pending");
    if (pending) {
      pending.status = "in_progress";
      return true;
    }
  }
  const leaf = promoteNextPendingLeaf(state.steps);
  if (leaf) {
    leaf.status = "in_progress";
    return true;
  }
  state.currentTaskId = null;
  return promoteNextTaskAndFirstStep(state);
}

function completedNextAction() {
  return {
    taskId: null,
    step: null,
    action: "completed",
    instructions: null,
    context: null,
    output_schema: null,
    requires_approval: false,
  };
}

export default class GetNextActionCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  execute(ctx) {
    if (!ctx.flowState) {
      return {
        taskId: null,
        step: null,
        action: null,
        instructions: null,
        context: null,
        output_schema: null,
        requires_approval: false,
      };
    }
    let state = ctx.flowState;

    if (new FlowCompletion(state).complete) return completedNextAction();

    assertNoUnresolvedInProgressTarget(state);
    let target = findActiveNode({
      steps: state.steps,
      tasks: state.tasks,
      currentTaskId: state.currentTaskId,
    });
    if (isFlowImplementationStep(target)) {
      const decision = evaluateTaskScope(state, target.stepId);
      if (decision.kind === "invalid-current-task" || decision.kind === "blocked") {
        return Envelope.fail(
          "get",
          "next-action",
          "TASK_CURSOR_REQUIRED",
          taskScopeViolationMessages(decision, target.stepId),
          { step: target.stepId, currentTaskId: state.currentTaskId ?? null },
        );
      }
      if (decision.promotable) {
        ctx.flowManager.mutate((s) => { promoteNextTaskAndFirstStep(s); });
        state = ctx.flowManager.load();
        target = findActiveNode({
          steps: state.steps,
          tasks: state.tasks,
          currentTaskId: state.currentTaskId,
        });
      }
    }
    if (!target) {
      let promoted = false;
      ctx.flowManager.mutate((s) => {
        promoted = promoteNextAvailableTarget(s);
      });
      if (promoted) {
        state = ctx.flowManager.load();
        assertNoUnresolvedInProgressTarget(state);
        target = findActiveNode({
          steps: state.steps,
          tasks: state.tasks,
          currentTaskId: state.currentTaskId,
        });
      }
    }
    if (!target) {
      return completedNextAction();
    }

    const derived = deriveNextAction({
      scope: target.scope,
      stepId: target.stepId,
      context: state,
    });
    if (!derived) {
      throw new Error(`NO_RULE_FOR_STEP: ${target.scope}.${target.stepId} has no entry in definition`);
    }

    if (!Number.isSafeInteger(derived.maxAttempts) || derived.maxAttempts < 1) {
      throw new Error(
        `INVALID_MAX_ATTEMPTS: ${target.scope}.${target.stepId} did not resolve numeric maxAttempts`,
      );
    }

    const output_schema = derived.outputSchemaRef
      ? loadSchema(derived.outputSchemaRef)
      : {};
    const context = buildContextDescriptor(derived.contextKinds, target, state);

    const baseInstructions = getStepInstructions(derived.instructionsKey);
    const injectedContent = injectPersistentRules(baseInstructions, target, state);

    const result = {
      taskId: target.taskId,
      step: target.stepId,
      action: derived.action,
      instructions: {
        key: derived.instructionsKey,
        content: injectedContent,
      },
      context,
      output_schema,
      requires_approval: derived.requiresApproval === true,
      maxAttempts: derived.maxAttempts,
    };
    if (state.autoUpgrade?.available === true) {
      result.autoUpgrade = state.autoUpgrade;
    }
    if (target.stepId === "acceptance-review" && derived.failurePolicy) {
      result.failurePolicy = derived.failurePolicy;
    }
    attachLatestStepAttempt(result, state, target);
    const reviewPhase = reviewPhaseForStepId(target.stepId);
    if (reviewPhase) {
      const reviewAttempts = countReviewRetry(state.metrics, reviewPhase);
      const reviewMaxAttempts = resolveRecoveryMaxAttempts({
        root: ctx.root,
        flowState: state,
        kind: "review",
        phase: reviewPhase,
        attempts: reviewAttempts,
        resolvedMax: derived.maxAttempts,
      });
      const reviewStop = buildReviewStopView(state, {
        surface: "next-action",
        phase: reviewPhase,
        maxAttempts: reviewMaxAttempts,
      });
      const retryRecovery = buildRetryRecoveryForState(ctx, state, {
        kind: "review",
        phase: reviewPhase,
        attempts: reviewAttempts,
        max: reviewMaxAttempts,
      });
      if (reviewStop || retryRecovery) {
        attachRetryRecovery(result, "reviewStop", reviewStop, retryRecovery);
      }
    }
    const gateRecoveryDisplay = target.stepId.endsWith("-gate")
      ? resolveGateRecoveryDisplayPhase({
          root: ctx.root,
          flowState: state,
          stepId: target.stepId,
          maxAttempts: derived.maxAttempts,
        })
      : null;
    if (gateRecoveryDisplay) {
      const retryRecovery = buildGateRetryRecovery(ctx, state, gateRecoveryDisplay);
      if (retryRecovery) {
        attachRetryRecovery(result, "gateStop", null, retryRecovery);
      }
    }
    return result;
  }
}
