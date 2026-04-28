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

    const derived = deriveNextAction(target.scope, target.stepId);
    if (!derived) {
      throw new Error(`NO_RULE_FOR_STEP: ${target.scope}.${target.stepId} has no entry in definition`);
    }

    const output_schema = derived.outputSchemaRef
      ? loadSchema(derived.outputSchemaRef)
      : {};
    const context = buildContextDescriptor(derived.contextKinds, target, state);

    const result = {
      taskId: target.taskId,
      step: target.stepId,
      action: derived.action,
      instructions: {
        key: derived.instructionsKey,
        content: getStepInstructions(derived.instructionsKey),
      },
      context,
      output_schema,
      requires_approval: derived.requiresApproval === true,
    };
    if (state.autoUpgrade?.available === true) {
      result.autoUpgrade = state.autoUpgrade;
    }
    return result;
  }
}
