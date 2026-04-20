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
export const PREPARING_TTL_MS = 24 * 60 * 60 * 1000;
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
};

/** Valid values for Task.origin. */
export const TASK_ORIGINS = ["plan", "addition", "integration"];

/** Valid values for Task.status. */
export const TASK_STATUSES = ["pending", "in_progress", "done", "skipped"];

/** Valid values for Task.steps[].status. */
export const TASK_STEP_STATUSES = ["pending", "in_progress", "done", "skipped"];

/** Valid values for Task.requirements[].status. */
export const TASK_REQUIREMENT_STATUSES = ["pending", "done"];

/** Task-level step sequences (cac6/T2 + T4 test-first decomposition). */
export const TASK_STEPS_PLAN = [
  "gate", "approval", "write-tests", "impl", "run-tests", "review", "update-overview",
];

export const TASK_STEPS_ADDITION = [
  "draft", "approval", "gate", "approval-2",
  "write-tests", "impl", "run-tests",
  "review", "update-overview",
];

/** Task-level step → phase mapping. */
export const TASK_PHASE_MAP = {
  draft: "task-plan",
  gate: "task-plan",
  approval: "task-plan",
  "approval-2": "task-plan",
  "write-tests": "task-impl",
  impl: "task-impl",
  "run-tests": "task-impl",
  review: "task-impl",
  "update-overview": "task-impl",
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

/**
 * Build initial flow-level steps array with all steps set to "pending".
 * @returns {Array<{id:string, status:"pending"}>}
 */
export function buildInitialSteps() {
  return FLOW_STEPS.map((id) => ({ id, status: "pending" }));
}

/**
 * Build initial task-level steps array based on the task's origin.
 *
 * @param {"plan"|"addition"|"integration"} origin
 * @returns {Array<{id:string, status:"pending"}>}
 */
export function buildInitialTaskSteps(origin) {
  let ids;
  if (origin === "plan" || origin === "integration") ids = TASK_STEPS_PLAN;
  else if (origin === "addition") ids = TASK_STEPS_ADDITION;
  else throw new Error(`unknown task origin: ${origin}`);
  return ids.map((id) => ({ id, status: "pending" }));
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
