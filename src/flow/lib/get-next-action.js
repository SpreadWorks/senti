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
  FLOW_DEFINITION,
  TASK_DEFINITION,
  findFirstPendingLeaf,
  flattenSteps,
  promoteNextPendingLeaf,
  findStepById,
} from "../definition.js";
import { promoteNextPending } from "../../lib/flow-helpers.js";
import { loadRules, filterRules, renderRuleBlock } from "../../lib/skill-rules.js";
import { buildReviewStopView, reviewPhaseForStepId } from "./review-failure.js";

const DEFAULT_SCHEMA_DIR = fileURLToPath(new URL("../schemas/", import.meta.url));

function resolveSchemaDir() {
  return process.env.SDD_FORGE_NEXT_ACTION_SCHEMA_DIR || DEFAULT_SCHEMA_DIR;
}

function loadSchema(relPath) {
  const full = path.join(resolveSchemaDir(), relPath);
  return JSON.parse(readFileSync(full, "utf8"));
}

function findCurrentTask(state) {
  if (state.currentTaskId == null) return null;
  return state.tasks.find((t) => t.id === state.currentTaskId) || null;
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
  if (state.spec && kinds.includes("spec")) {
    paths.spec = state.spec;
  }
  if (target.scope === "task" && kinds.includes("task_spec")) {
    const task = state.tasks.find((t) => t.id === target.taskId);
    if (task?.spec) paths.task_spec = task.spec;
  }
  return { kinds, paths };
}

export default class GetNextActionCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  execute(ctx) {
    if (!ctx.flowState) {
      return { taskId: null, step: null, action: null, instructions: null, context: null, output_schema: null, requires_approval: false };
    }
    let state = ctx.flowState;

    let target = findActiveNode(state.steps, state.tasks, state.currentTaskId);
    if (!target) {
      let promoted = false;
      const task = findCurrentTask(state);
      if (task && Array.isArray(task.steps)) {
        const pending = task.steps.find((s) => s.status === "pending");
        if (pending) {
          pending.status = "in_progress";
          promoted = true;
        }
      }
      if (!promoted) {
        const leaf = promoteNextPendingLeaf(state.steps);
        if (leaf) {
          leaf.status = "in_progress";
          promoted = true;
        }
      }
      if (!promoted) {
        state.currentTaskId = null;
        const taskId = promoteNextPending(state);
        if (taskId) {
          const promotedTask = findCurrentTask(state);
          if (promotedTask) {
            const pending = promotedTask.steps.find((s) => s.status === "pending");
            if (pending) pending.status = "in_progress";
          }
          promoted = true;
        }
      }
      if (promoted) {
        ctx.flowManager.save(state);
        state = ctx.flowManager.load();
        target = findActiveNode(state.steps, state.tasks, state.currentTaskId);
      }
    }
    if (!target) {
      return { taskId: null, step: null, action: "completed", instructions: null, context: null, output_schema: null, requires_approval: false };
    }

    const derived = deriveNextAction(target.scope, target.stepId, state);
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
    const reviewPhase = reviewPhaseForStepId(target.stepId);
    if (reviewPhase) {
      const reviewStop = buildReviewStopView(state, {
        surface: "next-action",
        phase: reviewPhase,
        maxAttempts: derived.maxAttempts,
      });
      if (reviewStop) {
        result.reviewStop = reviewStop;
        Object.assign(result, {
          stopReason: reviewStop.stopReason,
          classification: reviewStop.classification,
          phase: reviewStop.phase,
          retryBudgetConsumed: reviewStop.retryBudgetConsumed,
          recoveryCommand: reviewStop.recoveryCommand,
          ...(reviewStop.reason && { reason: reviewStop.reason }),
          ...(reviewStop.recoveryHint && { recoveryHint: reviewStop.recoveryHint }),
        });
      }
    }
    return result;
  }
}
