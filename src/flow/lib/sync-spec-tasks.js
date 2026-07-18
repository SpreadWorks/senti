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
import { tryLoadSpecJson, validateSpecJsonObject } from "../../lib/spec-json.js";
import { buildInitialTaskSteps, promoteNextPending } from "../../lib/flow-helpers.js";
import {
  TaskCollection,
  TaskOutputPath,
} from "../../spec/lib/render-contract.js";

/**
 * Synchronize spec.json tasks[] into flow.json tasks[] (append-only).
 *
 * @param {{ root: string }} opts
 * @returns {{ added: string[], skipped?: boolean, reason?: string }}
 */
export function syncSpecTasksToFlow({ root }) {
  const fm = new FlowManager({ root, mainRoot: root, inWorktree: false });
  let state;
  try {
    state = fm.load();
  } catch {
    return { added: [], skipped: true, reason: "no active flow" };
  }
  if (!state) return { added: [], skipped: true, reason: "no active flow" };

  const specPath = state.spec;
  if (!specPath) return { added: [], skipped: true, reason: "no spec path" };

  const absSpecPath = path.isAbsolute(specPath) ? specPath : path.join(root, specPath);
  const spec = tryLoadSpecJson(absSpecPath, { validate: false });
  if (!spec) return { added: [], skipped: true, reason: "spec.json not found" };

  const collection = new TaskCollection(spec.tasks ?? []);
  validateSpecJsonObject(spec);
  if (collection.size === 0) return { added: [] };

  const existingIds = new Set((state.tasks || []).map((t) => t.id));
  const newTasks = [...collection].filter((task) => !existingIds.has(task.id.value));
  if (newTasks.length === 0) return { added: [] };

  // REQ-6: auto-compute added_round for new tasks at approval time.
  // For the first approval (flow has no prior tasks), newly added tasks get
  // added_round = 0. For subsequent approvals, new tasks get
  // max(existing added_round) + 1 — regardless of what spec.json says.
  const isFirstApproval = (state.tasks || []).length === 0;
  const maxExisting = (state.tasks || []).reduce(
    (m, t) => Math.max(m, t.added_round ?? 0),
    0,
  );
  const assignedRound = isFirstApproval ? 0 : maxExisting + 1;

  // Use low-level mutate to append without touching currentTaskId on each insert.
  // Spec 226: at the end of the batch, call promoteNextPending to auto-promote
  // the first pending task (forest leaf priority) into currentTaskId if it was
  // null. This is call site (1) of the single-caller boundary.
  const tasksDir = path.join(path.dirname(absSpecPath), "tasks");
  const preparedTasks = newTasks.map((specTask) => buildFlowTask(
    specTask,
    new TaskOutputPath(tasksDir, specTask.id),
    root,
    assignedRound,
  ));
  const added = preparedTasks.map((task) => task.id);
  fm._store.mutate((s) => {
    for (const task of preparedTasks) {
      s.tasks.push(task);
    }
    promoteNextPending(s);
  });

  return { added };
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
