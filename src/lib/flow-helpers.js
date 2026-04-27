/**
 * src/lib/flow-helpers.js
 *
 * Pure helpers and constants for SDD flow state.
 * No I/O, no git, no environmental coupling — safe to import anywhere.
 *
 * Stateful operations live in `src/lib/flow-manager.js` (and its internal
 * sub-services) accessed via `container.get("flowManager")`.
 */

import path from "path";

export const STATE_FILE = "flow.json";
export const ACTIVE_FLOW_FILE = ".active-flow";
export const PREPARING_PREFIX = ".active-flow.";
export const PREPARING_TTL_MS = 60 * 60 * 1000;
export const PREPARING_SCAN_LIMIT = 100;
export const SCAN_FLOWS_LIMIT = 200;

/** SDD workflow step IDs in order (flow level). */
export const FLOW_STEPS = [
  "branch", "prepare-spec", "draft", "gate-draft", "spec",
  "gate", "approval", "test", "implement", "gate-impl",
  "integration-write-tests", "integration-run-tests",
  "integration-run-all-tests", "integration-evaluate",
  "review", "finalize",
  "commit", "push", "merge", "pr-create", "branch-cleanup",
  "pr-merge", "sync-cleanup", "docs-update", "docs-review", "docs-commit",
  "show-report",
];

/** Step ID → phase mapping (flow level). */
export const PHASE_MAP = {
  branch: "plan", "prepare-spec": "plan", draft: "plan",
  "gate-draft": "plan", spec: "plan", gate: "plan", approval: "plan", test: "plan",
  implement: "impl", "gate-impl": "impl",
  "integration-write-tests": "impl",
  "integration-run-tests": "impl",
  "integration-run-all-tests": "impl",
  "integration-evaluate": "impl",
  review: "impl", finalize: "impl",
  commit: "finalize", push: "finalize", merge: "finalize",
  "pr-create": "finalize", "branch-cleanup": "finalize",
  "pr-merge": "sync", "sync-cleanup": "sync",
  "docs-update": "sync", "docs-review": "sync", "docs-commit": "sync",
  "show-report": "sync",
};

/** Valid values for Task.origin. */
export const TASK_ORIGINS = ["plan", "integration"];

/** Valid values for Task.status. */
export const TASK_STATUSES = ["pending", "in_progress", "done", "skipped"];

/** Valid values for Task.steps[].status. */
export const TASK_STEP_STATUSES = ["pending", "in_progress", "done", "skipped"];

/** Valid values for Task.requirements[].status. */
export const TASK_REQUIREMENT_STATUSES = ["pending", "done"];

/**
 * Task-level step sequence (spec 235: reduced from 5 to 3 steps).
 *
 * Removed:
 *  - "write-tests" — test responsibility moved to spec level (spec 235)
 *  - "run-tests" — test execution moved to spec level (spec 235)
 */
export const TASK_STEPS_PLAN = [
  "impl", "review", "gate-impl",
];

/** Task-level step → phase mapping. */
export const TASK_PHASE_MAP = {
  impl: "task-impl",
  review: "task-impl",
  "gate-impl": "task-impl",
};

/**
 * Extract the spec name (e.g. "152-add-logger-to-callsites") from a flow object or state.
 * Both `flow.spec` and `state.spec` hold a relative path like "specs/152-.../spec.md".
 *
 * @param {{ spec?: string }|null|undefined} flowOrState
 * @returns {string|null}
 */
export function getSpecName(flowOrState) {
  if (!flowOrState?.spec) return null;
  return path.basename(path.dirname(flowOrState.spec));
}

/**
 * Resolve the absolute spec directory from a flow state and repo root.
 * Returns null if `state.spec` is missing.
 *
 * @param {{ spec?: string }|null|undefined} flowOrState
 * @param {string} root - Repository root (absolute)
 * @returns {string|null}
 */
export function getSpecDir(flowOrState, root) {
  if (!flowOrState?.spec) return null;
  const specMdPath = path.isAbsolute(flowOrState.spec)
    ? flowOrState.spec
    : path.join(root, flowOrState.spec);
  return path.dirname(specMdPath);
}

/**
 * Derive current phase from a flow state (task-aware).
 *
 * If the state has a current task with an in_progress step, returns the
 * task-level phase (e.g. "task-plan" / "task-impl"). Otherwise falls back
 * to the flow-level phase based on FLOW_STEPS.
 *
 * @param {object|null|undefined} state - Full flow state.
 * @returns {"plan"|"impl"|"finalize"|"sync"|"task-plan"|"task-impl"}
 */
export function derivePhase(state) {
  if (!state) return "plan";

  if (state.currentTaskId != null && Array.isArray(state.tasks)) {
    const task = state.tasks.find((t) => t.id === state.currentTaskId);
    if (task && Array.isArray(task.steps)) {
      const inProgress = task.steps.find((s) => s.status === "in_progress" && TASK_PHASE_MAP[s.id]);
      if (inProgress) return TASK_PHASE_MAP[inProgress.id];
    }
  }

  const steps = state.steps;
  if (!steps?.length) return "plan";
  const inProgress = steps.find((s) => s.status === "in_progress" && PHASE_MAP[s.id]);
  if (inProgress) return PHASE_MAP[inProgress.id];
  let lastDone = null;
  for (const s of steps) {
    if ((s.status === "done" || s.status === "skipped") && PHASE_MAP[s.id]) lastDone = s;
  }
  if (!lastDone) return "plan";
  return PHASE_MAP[lastDone.id];
}

/** Integration step IDs that are skipped when a flow has no tasks. */
export const INTEGRATION_STEP_IDS = [
  "integration-write-tests",
  "integration-run-tests",
  "integration-run-all-tests",
  "integration-evaluate",
];

/**
 * Build initial flow-level steps array.
 *
 * When called with `{ tasks: [] }` (no tasks in the spec), integration-*
 * steps are initialized as `skipped` so skill step-scanners naturally jump
 * over them. When tasks are present (or when no argument is passed), all
 * steps start as `pending`.
 *
 * @param {{ tasks?: Array<unknown> }} [opts]
 * @returns {Array<{id:string, status:"pending"|"skipped"}>}
 */
export function buildInitialSteps(opts) {
  const tasks = opts?.tasks;
  const skipIntegration = Array.isArray(tasks) && tasks.length === 0;
  return FLOW_STEPS.map((id) => ({
    id,
    status: skipIntegration && INTEGRATION_STEP_IDS.includes(id) ? "skipped" : "pending",
  }));
}

/**
 * Build initial task-level steps array based on the task's origin.
 *
 * @param {"plan"|"integration"} origin
 * @returns {Array<{id:string, status:"pending"}>}
 */
export function buildInitialTaskSteps(origin) {
  if (origin !== "plan" && origin !== "integration") {
    throw new Error(`unknown task origin: ${origin}`);
  }
  return TASK_STEPS_PLAN.map((id) => ({ id, status: "pending" }));
}

/**
 * Return true if a task is in a terminal state (done or skipped).
 *
 * Spec 226: centralizing this predicate avoids drift between call sites
 * that check completion status (completeTask parent propagation,
 * findNextPendingTask leaf preference, etc.).
 *
 * @param {string | undefined | null} status
 * @returns {boolean}
 */
export function isTaskTerminalStatus(status) {
  return status === "done" || status === "skipped";
}

/**
 * Forest-aware lookup of the next task to run.
 *
 * Spec 226: Walks `tasks[]` in DFS pre-order, respecting the array order for
 * siblings (deterministic per spec.json.tasks[] order), and returns the first
 * pending task whose children (if any) are all done or skipped. That is,
 * returns the deepest pending leaf in document order.
 *
 * For a flat list (all parent=null), returns the first pending task in array
 * order. For an empty list, returns null.
 *
 * @param {Array<{id:string, parent?:string|null, status:string}>} tasks
 * @returns {object|null} the task entry, or null if no pending task exists
 */
export function findNextPendingTask(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;

  const childrenOf = new Map();
  for (const t of tasks) childrenOf.set(t.id, []);
  for (const t of tasks) {
    if (t.parent != null && childrenOf.has(t.parent)) {
      childrenOf.get(t.parent).push(t);
    }
  }

  const roots = tasks.filter((t) => t.parent == null);

  function visit(task) {
    const kids = childrenOf.get(task.id) || [];
    for (const c of kids) {
      const found = visit(c);
      if (found) return found;
    }
    // Leaf-preference: pick this task only if all children are done/skipped.
    if (task.status === "pending") {
      const allKidsDone = kids.every((c) => isTaskTerminalStatus(c.status));
      if (allKidsDone) return task;
    }
    return null;
  }

  for (const root of roots) {
    const found = visit(root);
    if (found) return found;
  }
  return null;
}

/**
 * Promote the next pending task's id into `state.currentTaskId` (no-op if
 * currentTaskId is already set or no pending tasks remain).
 *
 * Spec 226: single caller boundary — call sites are (1) sync-spec-tasks at end
 * of sync, (2) gate-impl PASS post-hook after completeTask. completeTask itself
 * must NOT call this (responsibility separation).
 *
 * Mutates `state` in place. Returns the promoted task id or null.
 *
 * @param {object} state - flow state with tasks[] and currentTaskId
 * @returns {string|null}
 */
export function promoteNextPending(state) {
  if (!state || typeof state !== "object") return null;
  if (state.currentTaskId != null) return null;
  if (!Array.isArray(state.tasks) || state.tasks.length === 0) return null;

  const next = findNextPendingTask(state.tasks);
  if (!next) return null;

  state.currentTaskId = next.id;
  if (next.status === "pending") next.status = "in_progress";
  return next.id;
}

/**
 * Extract spec ID from spec path.
 * e.g. "specs/086-migrate-flow-state/spec.md" → "086-migrate-flow-state"
 * @param {string} specPath
 * @returns {string}
 */
export function specIdFromPath(specPath) {
  const parts = specPath.replace(/\\/g, "/").split("/");
  const idx = parts.indexOf("specs");
  if (idx >= 0 && idx + 1 < parts.length) return parts[idx + 1];
  return parts[0];
}
