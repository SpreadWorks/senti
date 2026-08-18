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
import { deriveNextAction } from "../definition.js";
import { loadRules, filterRules, renderRuleBlock } from "../../lib/skill-rules.js";
import { PRODUCT } from "../../lib/product.js";
import {
  AbortedDirective,
  AwaitUserDecisionDirective,
  CompletedDirective,
  ExecuteCommandDirective,
  ExecuteStepDirective,
  IdleDirective,
  NextActionDirectiveResolver,
  RepairEvidenceDirective,
} from "./next-action-directive.js";
import { TaskNode } from "./current-flow-state.js";
import {
  UserActionChoice,
  UserActionImpact,
  UserActionPrompt,
} from "./user-action-prompt.js";
import {
  ApprovalDecisionPrompt,
  FlowDecisionMessages,
} from "./flow-decision-prompt.js";
import { FlowTargetBinding } from "../../lib/flow-target-guard.js";
import { guardedCommand } from "./guarded-command.js";
import { inspectPreimplementationBootstrap } from "./run-preimplementation-bootstrap.js";
import { resolveFinalizationOutboxRecovery } from "./finalization-outbox-recovery.js";
import {
  recoverInterruptedFinalizeSync,
  recordInterruptedFinalizeSyncIssue,
} from "./recover-interrupted-finalize-sync.js";
import {
  flowArtifactAuthorityForStep,
  requiresWorkerArtifactHandoff,
} from "./flow-artifact-authority.js";
import {
  canonicalPlanGateRepairForTarget,
  inspectCanonicalPlanGateRepair,
} from "./plan-gate-repair.js";
import {
  canonicalTestReviewRepairForTarget,
  inspectCanonicalTestReviewRepair,
} from "./test-review-repair.js";
import { captureRetryRecoveryBaseline, readRetryBaseline, retryEvidenceRouteForNode } from "./retry-recovery.js";

const DEFAULT_SCHEMA_DIR = fileURLToPath(new URL("../schemas/", import.meta.url));

function resolveSchemaDir() {
  return process.env[PRODUCT.env("NEXT_ACTION_SCHEMA_DIR")] || DEFAULT_SCHEMA_DIR;
}

function loadSchema(relPath) {
  const full = path.join(resolveSchemaDir(), relPath);
  return JSON.parse(readFileSync(full, "utf8"));
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
  if (state.specId && kinds.includes("spec") && target.scope !== "task") {
    paths.specId = state.specId;
  }
  if (target.scope === "task" && kinds.includes("task_spec")) {
    const task = state.tasks.find((t) => t.id === target.taskId);
    if (task?.spec) paths.task_spec = task.spec;
  }
  return { kinds, paths };
}

function captureNextActionBinding(ctx, state) {
  if (ctx.flowCommandBoundary !== true) return null;
  try {
    return FlowTargetBinding.captureContext(ctx, state);
  } catch (error) {
    const resumedFromMainAfterWorktreeRemoval = state.worktree === true
      && ctx.mainRoot
      && path.resolve(ctx.executionRoot || ctx.root) === path.resolve(ctx.mainRoot);
    if (resumedFromMainAfterWorktreeRemoval) return null;
    throw error;
  }
}

function buildPreimplementationBootstrapDirective(ctx, state, target, binding) {
  if (target.stepId !== "scenario-validity") return null;
  const plan = inspectPreimplementationBootstrap({ flowManager: ctx.flowManager, state });
  if (!plan) return null;
  return new ExecuteCommandDirective({
    actionId: "RECOVER_PREIMPLEMENTATION_BOOTSTRAP",
    nextAction: guardedCommand("sennel flow run preimplementation-bootstrap", state, binding),
    instruction: "Use the persisted scenario-validity preflight evidence to enter implementation without reclassifying existing implementation-target changes as test design.",
    reason: `scenario-validity detected ${plan.invalidPaths.length} existing implementation-target change(s) against the immutable Flow baseline`,
  });
}

function buildCanonicalTestReviewRepairDirective(ctx, state, target, binding) {
  if (target.stepId !== "test-review") return null;
  let source;
  try {
    source = inspectCanonicalTestReviewRepair({ flowManager: ctx.flowManager, state });
  } catch (error) {
    if (/absent from catalog/.test(error.message)) return null;
    throw error;
  }
  if (source === null) return null;
  return new RepairEvidenceDirective({
    actionId: "REPAIR_TEST_REVIEW",
    evidenceKind: "test",
    phase: "test",
    instruction: "Run the guarded test-review repair transition. It binds the rejected review Attempt and current cataloged test revision, then starts a replacement test worker Attempt.",
    reason: "The cataloged test-review contains blocking findings that require changed test evidence.",
    nextAction: guardedCommand("sennel flow run repair-test-review", state, binding),
  });
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
    directive: new CompletedDirective().toJSON(),
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
    directive: new AbortedDirective().toJSON(),
  };
}

export class NextActionPlanError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "NextActionPlanError";
    this.code = code;
  }
}

/**
 * Definition-facing identity for a Version-1 next action.
 *
 * A materialized Task leaf has a globally unique id such as `T-1-impl`,
 * while the public worker contract deliberately keeps the definition id
 * `task-impl`. This value object owns that translation so no consumer
 * mistakes a materialized id or prompt key for a rule identity.
 */
class CanonicalNextActionTarget {
  constructor({ state, descriptor }) {
    if (!state || typeof state.findNode !== "function") {
      throw new NextActionPlanError("NEXT_ACTION_TARGET_MISMATCH", "canonical Flow state is unavailable");
    }
    if (!descriptor || !Array.isArray(descriptor.path) || descriptor.path.length === 0) {
      throw new NextActionPlanError("NEXT_ACTION_TARGET_MISMATCH", "canonical next action has no stable path");
    }
    const task = descriptor.path
      .map((nodeId) => state.findNode(nodeId))
      .find((node) => node instanceof TaskNode) ?? null;
    if (typeof descriptor.nodeId !== "string" || descriptor.nodeId.length === 0) {
      throw new NextActionPlanError("NEXT_ACTION_TARGET_MISMATCH", "canonical next action has no node id");
    }
    if (typeof descriptor.nodeKey !== "string" || descriptor.nodeKey.length === 0) {
      throw new NextActionPlanError("NEXT_ACTION_TARGET_MISMATCH", "canonical next action has no definition key");
    }
    const taskPrefix = task === null ? null : `${task.id}-`;
    const definitionStepId = task === null
      ? descriptor.nodeId
      : descriptor.nodeId.startsWith(taskPrefix)
        ? `task-${descriptor.nodeId.slice(taskPrefix.length)}`
        : null;
    if (typeof definitionStepId !== "string" || definitionStepId.length === 0) {
      throw new NextActionPlanError("NEXT_ACTION_TARGET_MISMATCH", "canonical next action does not match its Task Step identity");
    }
    this.nodeId = descriptor.nodeId;
    this.stepId = definitionStepId;
    this.scope = task === null ? "flow" : "task";
    this.taskId = task?.id ?? null;
    Object.freeze(this);
  }

  toJSON() {
    return {
      scope: this.scope,
      taskId: this.taskId,
      stepId: this.stepId,
      nodeId: this.nodeId,
    };
  }
}

function canonicalInstruction(derived, target, state) {
  const baseInstructions = getStepInstructions(derived.instructionsKey);
  return Object.freeze({
    key: derived.instructionsKey,
    content: injectPersistentRules(baseInstructions, target, state),
  });
}

function canonicalWorkerContext(ctx, derived, target, state, typedState) {
  const context = buildContextDescriptor(derived.contextKinds, target, state);
  if (requiresWorkerArtifactHandoff(target.stepId)) {
    const authority = flowArtifactAuthorityForStep(target.stepId);
    context.workerArtifactHandoff = Object.freeze({
      version: 2,
      required: true,
      writableAuthority: authority.writableAuthority,
      publicationOwner: authority.publicationOwner,
      completionValidator: authority.completionValidator,
    });
  }
  const planGateRepair = canonicalPlanGateRepairForTarget({
    flowManager: ctx.flowManager,
    state,
    targetStepId: target.stepId,
  });
  if (planGateRepair) context.planGateRepair = planGateRepair.toWorkerJSON();
  const testReviewRepair = canonicalTestReviewRepairForTarget({
    flowManager: ctx.flowManager,
    state,
    targetStepId: target.stepId,
  });
  if (testReviewRepair) context.testReviewRepair = testReviewRepair.toWorkerJSON();
  return context;
}

function retryRecoveryCommandFor({ ctx, state, descriptor, target, binding }) {
  const disposition = descriptor.failureDisposition;
  const failure = state?.attempt?.failure;
  const toolingFailure = failure?.retryKind === "tooling"
    || failure?.category === "tooling"
    || failure?.category === "provider";
  if (disposition?.operation !== "record" || disposition.remaining !== 0 || !toolingFailure || failure?.category === "semantic") return null;
  const route = retryEvidenceRouteForNode(state, target.nodeId);
  if (route === null || !ctx.flowManager) return null;
  const baseline = readRetryBaseline(ctx.flowManager, state, route);
  if (baseline === null) return null;
  const current = captureRetryRecoveryBaseline({
    flowState: state,
    flowManager: ctx.flowManager,
    executionRoot: ctx.executionRoot || ctx.root,
    artifactRoot: ctx.mainRoot || ctx.root,
    nodeId: target.nodeId,
  });
  if (current === null) return null;
  const changed = ["projectDigest", "runtimeDigest", "targetDigest"].some((field) => current[field] !== baseline[field]);
  if (!changed) return null;
  return guardedCommand(
    `sennel flow set retry reset ${route.kind} ${route.phase} --reason "${disposition.reason.replaceAll('"', "'")}" --yes`,
    state,
    binding,
  );
}

function acceptanceDecisionMessages({ root, config }) {
  return new FlowDecisionMessages({ root, config, decision: "acceptanceDecision", names: [
    "question",
    "acceptRisk",
    "abort",
    "reviewSummary",
    "reviewFull",
    "decisionRecord",
    "decisionState",
    "recommendationReason",
    "reason",
  ] });
}

/**
 * An ordinary Flow approval remains dispatcher-authorized, but it has a
 * first-class prompt so review is a concrete read-only action rather than an
 * instruction inferred from a worker prompt. The actual approval token is
 * intentionally issued only by the dispatcher boundary.
 */
function approvalDecisionDirective({ root, state, binding, target, config, action }) {
  if (target.scope !== "flow" || target.stepId !== "approval") return null;
  return new ExecuteStepDirective({
    action,
    actionPrompt: new ApprovalDecisionPrompt({ root, config })
      .toUserActionPrompt({ state, binding }),
  });
}

/**
 * Acceptance risk disposition is a user-decision boundary, not a dispatch
 * approval.  Its review alternatives are executable read-only commands, so
 * the same target binding remains valid when the user returns to this scene.
 */
function acceptanceDecisionDirective({ root, state, binding, target, config }) {
  if (target.scope !== "flow" || target.stepId !== "acceptance-decision") return null;
  const messages = acceptanceDecisionMessages({ root, config });
  const command = (value) => guardedCommand(value, state, binding);
  return new AwaitUserDecisionDirective({
    prompt: new UserActionPrompt({
      question: messages.get("question"),
      choices: [
        new UserActionChoice({
          actionId: "ACCEPT_RISK_AND_CONTINUE",
          label: messages.get("acceptRisk"),
          nextAction: command("sennel flow set acceptance-decision --choice accept_risk_and_continue"),
          impact: new UserActionImpact({ changes: [messages.get("decisionRecord")] }),
        }),
        new UserActionChoice({
          actionId: "ABORT_ACCEPTANCE",
          label: messages.get("abort"),
          nextAction: command("sennel flow set acceptance-decision --choice abort"),
          impact: new UserActionImpact({ changes: [messages.get("decisionRecord")] }),
        }),
        new UserActionChoice({
          actionId: "REVIEW_ACCEPTANCE_SUMMARY",
          label: messages.get("reviewSummary"),
          nextAction: command("sennel flow get artifact acceptance.review --mode summary"),
          impact: new UserActionImpact({ retains: [messages.get("decisionState")] }),
        }),
        new UserActionChoice({
          actionId: "REVIEW_ACCEPTANCE_FULL",
          label: messages.get("reviewFull"),
          nextAction: command("sennel flow get artifact acceptance.review --mode full"),
          impact: new UserActionImpact({ retains: [messages.get("decisionState")] }),
        }),
      ],
      recommendedActionId: "REVIEW_ACCEPTANCE_SUMMARY",
      recommendationReason: messages.get("recommendationReason"),
    }),
    reason: messages.get("reason"),
  });
}

/**
 * Assemble the stable worker envelope from V1's typed descriptor rather than
 * its projected compatibility view.  The enumerable payload remains in the
 * established field order; only the source of identity and lifecycle facts
 * changes from mutable state to the Version Store.
 */
function buildCanonicalNextActionResult(ctx, state, typedState, descriptor) {
  const target = new CanonicalNextActionTarget({ state: typedState, descriptor });
  const binding = captureNextActionBinding(ctx, state);
  const derived = deriveNextAction({
    scope: target.scope,
    stepId: target.stepId,
    context: state,
  });
  if (derived === null) {
    throw new NextActionPlanError(
      "NEXT_ACTION_TARGET_MISMATCH",
      `canonical Flow selected ${target.scope}.${target.stepId}, which is absent from the definition`,
    );
  }
  const outputSchema = derived.outputSchemaRef ? loadSchema(derived.outputSchemaRef) : {};
  const instruction = canonicalInstruction(derived, target, state);
  const outboxRecovery = target.scope === "flow"
    ? resolveFinalizationOutboxRecovery(ctx, state, target, null)
    : null;
  const strictDirective = target.scope === "flow"
    ? buildPreimplementationBootstrapDirective(ctx, state, target, binding)
      || buildCanonicalTestReviewRepairDirective(ctx, state, target, binding)
    : null;
  const approvalDirective = approvalDecisionDirective({
    root: ctx.root,
    state,
    binding,
    target,
    config: ctx.config,
    action: derived.action,
  });
  const userDecisionDirective = acceptanceDecisionDirective({
    root: ctx.root,
    state,
    binding,
    target,
    config: ctx.config,
  });
  const recoveryCommand = retryRecoveryCommandFor({ ctx, state, descriptor, target, binding });
  const planGateRepair = inspectCanonicalPlanGateRepair({
    flowManager: ctx.flowManager,
    state: typedState,
  });
  const lifecycleDirective = new NextActionDirectiveResolver({
    state,
    binding,
    action: derived.action,
    descriptor,
    recoveryCommand,
    planGateRepairRoute: planGateRepair?.route ?? null,
    planGateRepairReason: planGateRepair?.reason ?? null,
  }).resolve();
  const result = {
    taskId: target.taskId,
    step: target.stepId,
    action: derived.action,
    instructions: instruction,
    context: canonicalWorkerContext(ctx, derived, target, state, typedState),
    output_schema: outputSchema,
    requires_approval: derived.requiresApproval === true,
    ...(derived.autoApproveChoiceId && {
      auto_approval_choice_id: derived.autoApproveChoiceId,
    }),
    maxAttempts: derived.maxAttempts,
    directive: (userDecisionDirective ?? approvalDirective ?? strictDirective ?? outboxRecovery?.directive ?? lifecycleDirective).toJSON(),
  };
  if (target.stepId === "acceptance-review" && derived.failurePolicy) {
    result.failurePolicy = derived.failurePolicy;
  }
  return result;
}

export default class GetNextActionCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false, explicitTargetResolution: true });
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
        directive: new IdleDirective().toJSON(),
      };
    }

    if (ctx.flowState.schemaRevision !== 3 || typeof ctx.flowManager?.canonicalState !== "function") {
      throw new NextActionPlanError(
        "NEXT_ACTION_TARGET_MISMATCH",
        "active Flow must be backed by the canonical Version Store",
      );
    }
    const interruptedSync = recoverInterruptedFinalizeSync(ctx);
    if (interruptedSync.recovered) {
      ctx.flowState = ctx.flowManager.load(ctx.specId);
      recordInterruptedFinalizeSyncIssue(ctx, interruptedSync);
      ctx.flowState = ctx.flowManager.load(ctx.specId);
    }
    return this.executeCanonical(ctx);
  }

  executeCanonical(ctx) {
    const typedState = ctx.flowManager.canonicalState(ctx.specId);
    if (!typedState) {
      throw new NextActionPlanError("NEXT_ACTION_TARGET_MISMATCH", "canonical Flow state is unavailable");
    }
    if (typedState.lifecycle.state !== "active") {
      return typedState.lifecycle.state === "finalized" ? completedNextAction() : abortedNextAction();
    }

    const descriptor = typedState.nextAction();

    if (descriptor === null) {
      return completedNextAction();
    }
    const result = buildCanonicalNextActionResult(ctx, ctx.flowState, typedState, descriptor);
    if (["start", "recover", "retry"].includes(descriptor.operation)) {
      ctx.flowManager.beginNextAction(ctx.specId);
      // Downstream dispatcher hooks and injected test effects must observe the
      // Activity-confirmed state, never the planner's temporary projection.
      ctx.flowState = ctx.flowManager.load(ctx.specId);
    }
    return result;
  }
}
