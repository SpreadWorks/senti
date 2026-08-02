/**
 * src/flow/lib/sync-spec-tasks.js
 *
 * Differential sync of spec.json tasks[] → flow.json tasks[].
 *
 * Called from the approval post-hook (REQ-2, REQ-6 of spec 215). Reads the
 * spec.json for the active flow, compares its tasks[] with flow.json.tasks[],
 * and appends only the tasks whose id is not already present in the flow.
 * Existing tasks are preserved as-is.
 *
 * Part of spec 215-flow-task-decomposition (draft-return task flow).
 */

import fs from "node:fs";
import path from "node:path";
import { FlowManager } from "../../lib/flow-manager.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { loadSpecJson } from "../../lib/spec-json.js";
import { buildInitialTaskSteps, promoteNextPending } from "../../lib/flow-helpers.js";
import {
  TaskCollection,
  TaskOutputPath,
} from "../../spec/lib/render-contract.js";
import {
  StepTransitionCommitIntent,
  StepTransitionError,
} from "./step-transition-policy.js";

export class SpecTaskSyncCommitIntent extends StepTransitionCommitIntent {
  #preparedTasks;

  constructor(preparedTasks) {
    super();
    if (!Array.isArray(preparedTasks)) {
      throw new StepTransitionError("prepared spec tasks must be an array");
    }
    const seen = new Set();
    this.#preparedTasks = preparedTasks.map((task) => {
      if (!task || typeof task !== "object") {
        throw new StepTransitionError("prepared spec task must be an object");
      }
      if (typeof task.id !== "string" || task.id.trim() === "") {
        throw new StepTransitionError("prepared spec task id must be a non-empty string");
      }
      if (seen.has(task.id)) {
        throw new StepTransitionError(`duplicate prepared spec task id: ${task.id}`);
      }
      seen.add(task.id);
      return structuredClone(task);
    });
    this.added = Object.freeze(this.#preparedTasks.map((task) => task.id));
    Object.freeze(this);
  }

  applyTo(state) {
    if (!Array.isArray(state?.tasks)) {
      throw new StepTransitionError("flow state tasks must be an array");
    }
    const existingIds = new Set(state.tasks.map((task) => task.id));
    for (const task of this.#preparedTasks) {
      if (existingIds.has(task.id)) {
        throw new StepTransitionError(`prepared spec task already exists: ${task.id}`);
      }
    }
    if (this.#preparedTasks.length === 0) return;
    state.tasks.push(...structuredClone(this.#preparedTasks));
    promoteNextPending(state);
  }
}

/**
 * Prepare append-only task additions from an already-resolved flow state.
 * This function performs no flow-state mutation.
 *
 * @param {{ root: string, state: object }} opts
 * @returns {SpecTaskSyncCommitIntent}
 */
export function prepareSpecTaskSync({ root, state }) {
  if (!state || typeof state !== "object") {
    throw new StepTransitionError("active flow state is required for spec task sync");
  }
  if (typeof state.specId !== "string" || state.specId.trim() === "") {
    throw new StepTransitionError("active flow spec id is required for spec task sync");
  }
  if (!Array.isArray(state.tasks)) {
    throw new StepTransitionError("active flow tasks must be an array");
  }

  const absSpecPath = path.join(root, relativeFlowSpecFile(state));
  const spec = loadSpecJson(absSpecPath);
  const collection = new TaskCollection(spec.tasks ?? []);
  const existingIds = new Set(state.tasks.map((task) => task.id));
  const newTasks = [...collection].filter((task) => !existingIds.has(task.id.value));

  const isFirstApproval = state.tasks.length === 0;
  const maxExisting = state.tasks.reduce(
    (maximum, task) => Math.max(maximum, task.added_round ?? 0),
    0,
  );
  const assignedRound = isFirstApproval ? 0 : maxExisting + 1;
  const tasksDir = path.join(path.dirname(absSpecPath), "tasks");
  const preparedTasks = newTasks.map((specTask) => buildFlowTask(
    specTask,
    new TaskOutputPath(tasksDir, specTask.id),
    root,
    assignedRound,
  ));

  return new SpecTaskSyncCommitIntent(preparedTasks);
}

/**
 * Synchronize spec.json tasks[] into flow.json tasks[] (append-only).
 *
 * @param {{ root: string }} opts
 * @returns {{ added: string[], skipped?: boolean, reason?: string }}
 */
export function syncSpecTasksToFlow({ root }) {
  const fm = new FlowManager({ root, mainRoot: root, inWorktree: false });
  const state = fm.load();
  if (!state) return { added: [], skipped: true, reason: "no active flow" };
  const intent = prepareSpecTaskSync({ root, state });
  if (intent.added.length === 0) return { added: [] };
  fm.mutate((nextState) => intent.applyTo(nextState), { expectedOriginal: state });
  return { added: [...intent.added] };
}

function buildFlowTask(specTask, outputPath, root, assignedRound) {
  return {
    id: specTask.id.value,
    spec: path.relative(root, outputPath.value).split(path.sep).join("/"),
    origin: specTask.origin,
    // Spec 226: transcribe parent from spec.json (was: always null).
    // Null/undefined stays null (flat list compatibility).
    parent: specTask.parent == null ? null : specTask.parent.value,
    status: specTask.status || "pending",
    steps: buildInitialTaskSteps(specTask.origin),
    requirements: [],
    summary: null,
    added_round: assignedRound,
  };
}
