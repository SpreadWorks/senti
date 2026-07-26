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
import { reviewPhaseForStepId } from "./review-failure.js";
import { resolveGateRecoveryDisplayPhase } from "./gate-recovery-display.js";
import { inspectDurableGateSemanticDeferral } from "./run-gate.js";
import { buildStateRetryRecoveryView } from "./retry-recovery.js";
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
import { resolveReviewActionForFlowState } from "./review-convergence.js";
import { assertReviewRecoveryAuthority } from "./review-recovery-authority.js";
import { resolveCurrentReviewTreeSha } from "./review-evidence-store.js";

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

function normalizeTaskCursor(state) {
  let changed = false;
  let task = findCurrentTask(state);
  if (!task) {
    if (promoteNextPending(state) == null) return false;
    task = findCurrentTask(state);
    changed = true;
  }
  if (!task) return changed;
  if (task.status === "pending") {
    task.status = "in_progress";
    changed = true;
  }
  if (Array.isArray(task.steps) && !task.steps.some((step) => step.status === "in_progress")) {
    const pending = task.steps.find((step) => step.status === "pending");
    if (pending) {
      pending.status = "in_progress";
      changed = true;
    }
  }
  return changed;
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
    && ["implement", "impl-review", "impl-triage", "impl-repair", "impl-gate"].includes(target.stepId);
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
  const targetSteps = target.scope === "task"
    ? state.tasks.find((task) => task.id === target.taskId)?.steps
    : state.steps;
  const targetStep = flattenSteps(targetSteps || [])
    .find((step) => step.id === target.stepId);
  if (targetStep?.startedAt && attempt.recordedAt < targetStep.startedAt) return;
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
  return normalizeTaskCursor(state);
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

function abortedNextAction() {
  return {
    taskId: null,
    step: null,
    action: "aborted",
    instructions: null,
    context: null,
    output_schema: null,
    requires_approval: false,
  };
}

export class NextActionPlanError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "NextActionPlanError";
    this.code = code;
  }
}

function requiredPlanObject(value, field, display = field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new NextActionPlanError("NEXT_ACTION_PLAN_INVALID", `${field} (${display}) is required`);
  }
  return value;
}

export class NextActionPromotionPlan {
  constructor({
    definition,
    rule,
    outputSchema,
    instruction,
    target,
    taskScope,
    expectedRevision,
    maxAttempts,
    nextState = null,
    result = null,
    commitRequired = null,
  }) {
    this.definition = requiredPlanObject(definition, "definition");
    this.rule = requiredPlanObject(rule, "rule");
    this.outputSchema = requiredPlanObject(outputSchema, "outputSchema", "output schema");
    this.instruction = requiredPlanObject(instruction, "instruction");
    this.target = requiredPlanObject(target, "target");
    this.taskScope = requiredPlanObject(taskScope, "taskScope", "task scope");
    this.expectedRevision = requiredPlanObject(expectedRevision, "expectedRevision", "expected revision");
    if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10_000) {
      throw new NextActionPlanError(
        "NEXT_ACTION_PLAN_INVALID",
        `maxAttempts must be a safe integer from 1 through 10000, got ${maxAttempts}`,
      );
    }
    this.maxAttempts = maxAttempts;
    this.nextState = nextState;
    this.result = result;
    this.commitRequired = commitRequired;
    Object.freeze(this);
  }
}

class NextActionTerminalPlan {
  constructor(result) {
    this.result = result;
    Object.freeze(this);
  }
}

function buildNextActionResult(ctx, state, target, derived, outputSchema, instruction) {
  const context = buildContextDescriptor(derived.contextKinds, target, state);
  const result = {
    taskId: target.taskId,
    step: target.stepId,
    action: derived.action,
    instructions: instruction,
    context,
    output_schema: outputSchema,
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
    assertReviewRecoveryAuthority({
      root: ctx.root,
      flowState: state,
      phase: reviewPhase,
      resolvedMax: derived.maxAttempts,
    });
    const reviewAction = resolveReviewActionForFlowState(state, {
      phase: reviewPhase,
      taskId: target.taskId,
      resolveTreeSha: () => resolveCurrentReviewTreeSha(ctx.root, state.spec),
    });
    if (reviewAction) result.reviewAction = reviewAction;
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

export class NextActionPlanner {
  build(ctx) {
    const original = ctx.flowState;
    if (original.acceptanceReview?.status === "aborted") {
      return new NextActionTerminalPlan(abortedNextAction());
    }
    if (new FlowCompletion(original).complete) {
      return new NextActionTerminalPlan(completedNextAction());
    }

    const state = structuredClone(original);
    assertNoUnresolvedInProgressTarget(state);
    let promoted = false;
    let target = findActiveNode(state);
    if (isFlowImplementationStep(target)) {
      const decision = evaluateTaskScope(state, target.stepId);
      if (decision.kind === "invalid-current-task" || decision.kind === "blocked") {
        return new NextActionTerminalPlan(Envelope.fail(
          "get",
          "next-action",
          "TASK_CURSOR_REQUIRED",
          taskScopeViolationMessages(decision, target.stepId),
          { step: target.stepId, currentTaskId: state.currentTaskId ?? null },
        ));
      }
      if (decision.promotable || decision.kind === "task") {
        promoted = normalizeTaskCursor(state);
        target = findActiveNode(state);
      }
    }
    if (!target) {
      promoted = promoteNextAvailableTarget(state);
      if (promoted) {
        assertNoUnresolvedInProgressTarget(state);
        target = findActiveNode(state);
      }
    }
    if (!target) return new NextActionTerminalPlan(completedNextAction());

    const derived = deriveNextAction({
      scope: target.scope,
      stepId: target.stepId,
      context: state,
    });
    if (!derived) {
      throw new Error(`NO_RULE_FOR_STEP: ${target.scope}.${target.stepId} has no entry in definition`);
    }
    const outputSchema = derived.outputSchemaRef ? loadSchema(derived.outputSchemaRef) : {};
    const baseInstructions = getStepInstructions(derived.instructionsKey);
    const instruction = {
      key: derived.instructionsKey,
      content: injectPersistentRules(baseInstructions, target, state),
    };
    const result = buildNextActionResult(ctx, state, target, derived, outputSchema, instruction);
    return new NextActionPromotionPlan({
      definition: target.scope === "task" ? getTaskNode(target.stepId) : getFlowNode(target.stepId),
      rule: derived,
      outputSchema,
      instruction,
      target: { ...target, runId: state.runId },
      taskScope: { taskId: original.currentTaskId ?? null },
      expectedRevision: original,
      maxAttempts: derived.maxAttempts,
      nextState: state,
      result,
      commitRequired: promoted,
    });
  }
}

function targetStepForPlan(state, target) {
  const scope = target.scope === "task"
    ? state.tasks?.find((task) => task.id === target.taskId)
    : state;
  return flattenSteps(scope?.steps || []).find((step) => step.id === target.stepId) || null;
}

function validatePlanAgainstState(plan, state) {
  if (plan.nextState && plan.expectedRevision !== state) {
    throw new NextActionPlanError(
      "NEXT_ACTION_EXPECTED_REVISION_MISMATCH",
      "expected revision does not match the loaded flow state",
    );
  }
  if (plan.target.runId !== state.runId) {
    throw new NextActionPlanError(
      "NEXT_ACTION_TARGET_MISMATCH",
      `target runId ${plan.target.runId ?? "missing"} does not match ${state.runId ?? "missing"}`,
    );
  }
  const expectedTaskId = state.currentTaskId ?? null;
  if ((plan.taskScope.taskId ?? null) !== expectedTaskId) {
    throw new NextActionPlanError(
      "NEXT_ACTION_TASK_SCOPE_MISMATCH",
      `task scope ${plan.taskScope.taskId ?? "none"} does not match ${expectedTaskId ?? "none"}`,
    );
  }
  if (
    expectedTaskId !== null
    && plan.nextState
    && (plan.nextState.currentTaskId ?? null) !== expectedTaskId
  ) {
    throw new NextActionPlanError(
      "NEXT_ACTION_TASK_SCOPE_MISMATCH",
      `planned task ${plan.nextState.currentTaskId ?? "none"} does not match current task ${expectedTaskId}`,
    );
  }
  const targetTaskId = plan.target.taskId ?? null;
  const expectedTargetTaskId = plan.nextState
    ? plan.nextState.currentTaskId
    : state.currentTaskId;
  if (
    (plan.target.scope === "task" && plan.target.taskId !== expectedTargetTaskId)
    || (plan.target.scope === "flow" && targetTaskId !== null)
  ) {
    throw new NextActionPlanError(
      "NEXT_ACTION_TASK_SCOPE_MISMATCH",
      `target ${plan.target.scope} task ${targetTaskId ?? "none"} does not match planned task ${expectedTargetTaskId ?? "none"}`,
    );
  }
  const step = targetStepForPlan(state, plan.target);
  if (!step || !["pending", "in_progress"].includes(step.status)) {
    throw new NextActionPlanError(
      "NEXT_ACTION_TARGET_MISMATCH",
      `target ${plan.target.scope}.${plan.target.stepId} is not pending or in_progress`,
    );
  }
  return step;
}

function injectedPlanResult(plan) {
  return {
    taskId: plan.target.taskId ?? null,
    step: plan.target.stepId,
    action: plan.rule.action,
    instructions: plan.instruction,
    context: null,
    output_schema: plan.outputSchema,
    requires_approval: plan.rule.requiresApproval === true,
    maxAttempts: plan.maxAttempts,
  };
}

export default class GetNextActionCommand extends FlowCommand {
  constructor({ planner = new NextActionPlanner(), effects = null } = {}) {
    super({ requiresFlow: false });
    if (!planner || typeof planner.build !== "function") {
      throw new Error("next-action planner.build is required");
    }
    if (effects) {
      for (const method of ["writeRuntimeLog", "writeArtifact", "recordRetry"]) {
        if (typeof effects[method] !== "function") {
          throw new Error(`next-action effects.${method} is required`);
        }
      }
    }
    this.planner = planner;
    this.effects = effects;
  }

  async execute(ctx) {
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

    const candidate = this.planner.build(ctx);
    if (candidate instanceof NextActionTerminalPlan) return candidate.result;
    const plan = new NextActionPromotionPlan(candidate);
    const currentStep = validatePlanAgainstState(plan, ctx.flowState);
    const result = plan.result || injectedPlanResult(plan);
    if (currentStep.status === "in_progress") return result;

    const nextState = plan.nextState ? structuredClone(plan.nextState) : structuredClone(ctx.flowState);
    const nextStep = targetStepForPlan(nextState, plan.target);
    if (!nextStep) {
      throw new NextActionPlanError(
        "NEXT_ACTION_TARGET_MISMATCH",
        `target ${plan.target.scope}.${plan.target.stepId} is absent from the promotion state`,
      );
    }
    nextStep.status = "in_progress";
    if (!nextStep.startedAt) nextStep.startedAt = new Date().toISOString();
    delete nextStep.finishedAt;

    if (plan.commitRequired === true && plan.nextState) {
      ctx.flowManager.mutate((state) => {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, nextState);
      }, { expectedOriginal: plan.expectedRevision });
    } else {
      ctx.flowManager.saveAtomic(nextState, {
        expectedOriginal: plan.expectedRevision,
      });
    }
    this.effects?.writeRuntimeLog({ plan, result });
    this.effects?.writeArtifact({ plan, result });
    this.effects?.recordRetry({ plan, result });
    return result;
  }
}
