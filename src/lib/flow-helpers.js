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

/** SDD workflow step IDs in order. */
export const FLOW_STEPS = [
  "branch", "prepare-spec", "draft", "gate-draft", "spec",
  "gate", "approval", "test", "implement", "gate-impl", "review", "finalize",
  "commit", "push", "merge", "pr-create", "branch-cleanup",
  "pr-merge", "sync-cleanup", "docs-update", "docs-review", "docs-commit",
];

/** Step ID → phase mapping. */
export const PHASE_MAP = {
  branch: "plan", "prepare-spec": "plan", draft: "plan",
  "gate-draft": "plan", spec: "plan", gate: "plan", approval: "plan", test: "plan",
  implement: "impl", "gate-impl": "impl", review: "impl", finalize: "impl",
  commit: "finalize", push: "finalize", merge: "finalize",
  "pr-create": "finalize", "branch-cleanup": "finalize",
  "pr-merge": "sync", "sync-cleanup": "sync",
  "docs-update": "sync", "docs-review": "sync", "docs-commit": "sync",
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
 * Derive current phase from steps.
 * Returns the phase of the first in_progress step,
 * or the phase after the last done/skipped step.
 * @param {Array<{id:string, status:string}>} [steps]
 * @returns {"plan"|"impl"|"finalize"|"sync"}
 */
export function derivePhase(steps) {
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
 * Build initial steps array with all steps set to "pending".
 * @returns {Array<{id:string, status:"pending"}>}
 */
export function buildInitialSteps() {
  return FLOW_STEPS.map((id) => ({ id, status: "pending" }));
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
