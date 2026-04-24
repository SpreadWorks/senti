/**
 * src/flow/lib/get-next-action.js
 *
 * Return the next AI/skill action for the current flow or task step.
 *
 * Acts as a CLI dispatch hub for skill thinning (cac6/T5): the skill calls
 * `sdd-forge flow get next-action`, reads the returned envelope, and acts
 * on the declared `action` / `context` / `output_schema` / `requires_approval`
 * fields.
 *
 * REQ-11 (data-only extensibility contract):
 *   This module has NO hardcoded step names, action verbs, approval points,
 *   or context kinds. Every decision flows through `loadJson("context-rules.json")`
 *   and `loadJson(rule.output_schema_ref)`. Adding a new flow step, task step,
 *   action, or context kind is done by appending an entry to context-rules.json
 *   and a matching <name>.schema.json file — with zero changes to this file.
 *   Proof: see `tests/unit/flow/get-next-action.test.js` — the
 *   "data-only extensibility (REQ-11)" suite runs the CLI against a stubbed
 *   schema directory containing a fabricated step, and asserts the command
 *   picks it up correctly.
 *
 * Returns `{ taskId, step, action, instructions, context, output_schema, requires_approval }`.
 */

import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { FlowCommand } from "./base-command.js";
import { getStepInstructions } from "./get-step-instructions.js";
import { promoteFirstPending } from "../../lib/flow-store.js";

const DEFAULT_SCHEMA_DIR = fileURLToPath(new URL("../schemas/", import.meta.url));

function resolveSchemaDir() {
  return process.env.SDD_FORGE_NEXT_ACTION_SCHEMA_DIR || DEFAULT_SCHEMA_DIR;
}

function loadJson(relPath) {
  const full = path.join(resolveSchemaDir(), relPath);
  return JSON.parse(readFileSync(full, "utf8"));
}

function findInProgress(steps) {
  if (!Array.isArray(steps)) return null;
  return steps.find((s) => s.status === "in_progress") || null;
}

function findCurrentTask(state) {
  if (state.currentTaskId == null || !Array.isArray(state.tasks)) return null;
  return state.tasks.find((t) => t.id === state.currentTaskId) || null;
}

function allTasksDone(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return false;
  return tasks.every((t) => t.status === "done" || t.status === "skipped");
}

function resolveTarget(state) {
  // Spec 226: forest-aware target resolution. Priority:
  //   (1) current task's in_progress step (task scope)
  //   (2) flow-scope in_progress step (incl. finalize when all tasks done)
  const task = findCurrentTask(state);
  if (task) {
    const step = findInProgress(task.steps);
    if (step) return { scope: "task", taskId: task.id, stepId: step.id };
  }
  const step = findInProgress(state.steps);
  if (step) return { scope: "flow", taskId: null, stepId: step.id };
  return null;
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
      throw new Error("NO_ACTIVE_FLOW: no active flow; run `sdd-forge flow prepare` first");
    }
    let state = ctx.flowState;

    let target = resolveTarget(state);
    if (!target) {
      // spec 219: safety-net fallback for flows that ended up with no
      // in_progress step (e.g. older state created before auto-promote, or
      // externally edited flow.json). Promote the first pending step in the
      // task scope if a current task exists, otherwise in the flow scope,
      // then reload state and redispatch.
      const task = findCurrentTask(state);
      const promoted = (task && promoteFirstPending(task.steps))
        || promoteFirstPending(state.steps);
      if (promoted) {
        ctx.flowManager.save(state);
        state = ctx.flowManager.load();
        target = resolveTarget(state);
      }
    }
    if (!target) {
      throw new Error("NO_IN_PROGRESS_STEP: flow has no in_progress step; update step status before requesting next-action");
    }

    const rules = loadJson("context-rules.json");
    const scopeRules = rules[target.scope];
    const rule = scopeRules?.[target.stepId];
    if (!rule) {
      throw new Error(`NO_RULE_FOR_STEP: ${target.scope}.${target.stepId} has no entry in context-rules.json`);
    }

    const output_schema = loadJson(rule.output_schema_ref);
    const context = buildContextDescriptor(rule.context_kinds, target, state);

    return {
      taskId: target.taskId,
      step: target.stepId,
      action: rule.action,
      instructions: {
        key: rule.instructions_key,
        content: getStepInstructions(rule.instructions_key),
      },
      context,
      output_schema,
      requires_approval: rule.requires_approval === true,
    };
  }
}
