/**
 * src/flow/lib/gate-step.js
 *
 * Single source of truth for gate step / gate phase mapping.
 * Forward: resolveGateStepId(phase) — gate phase → flow step id.
 * Inverse: STEP_TO_PHASE[stepId] and resolveGatePhaseFromState(state) —
 * flow step id (or current state) → gate phase.
 *
 * gate-impl covers both task-impl and integration; the inverse collapses to
 * task-impl because integration gate runs through dedicated integration-* steps.
 */

import { FLOW_STEPS } from "../../lib/flow-helpers.js";

/**
 * Canonical phase → step mapping. Phases that collapse to the same step
 * (e.g. task-impl and integration → gate-impl) list the inverse-preferred
 * phase first; only the first entry per step is kept when inverting.
 */
const PHASE_TO_STEP_ENTRIES = Object.freeze([
  ["draft", "gate-draft"],
  ["spec", "gate"],
  ["task-spec", "gate"],
  ["task-impl", "gate-impl"],
  ["integration", "gate-impl"],
]);

const PHASE_TO_STEP = Object.freeze(Object.fromEntries(PHASE_TO_STEP_ENTRIES));

/** Flow-level step id → gate phase (inverse; first-wins on collisions). */
export const STEP_TO_PHASE = Object.freeze(
  PHASE_TO_STEP_ENTRIES.reduce((acc, [phase, step]) => {
    // Only flow-level steps participate in the inverse map. task-spec maps to
    // a task-level context ("gate" inside task.steps) and is handled
    // separately below.
    if (phase === "task-spec") return acc;
    if (!(step in acc)) acc[step] = phase;
    return acc;
  }, {}),
);

export function resolveGateStepId(phase) {
  const step = PHASE_TO_STEP[phase];
  // Unknown phases fall back to the parent-spec gate (preserves legacy
  // behavior; validation happens separately in validateLevelPhase).
  return step || "gate";
}

/** Task-level step id → gate phase (only gate-type steps). */
const TASK_STEP_TO_PHASE = Object.freeze({
  "gate": "task-spec",
});

const FLOW_GATE_STEP_IDS = Object.freeze(Object.keys(STEP_TO_PHASE));
const TASK_GATE_STEP_IDS = Object.freeze(Object.keys(TASK_STEP_TO_PHASE));

/**
 * Resolve the current gate phase by inspecting flow state.
 *
 * Returns `{ phase, staleSteps }` when at least one gate-type step is
 * in_progress, or `null` otherwise.
 *
 * Selection rule:
 *   - If currentTaskId is set and its task has an in_progress gate-type step,
 *     pick that (task-level takes precedence).
 *   - Otherwise, among flow-level gate-type steps that are in_progress, pick
 *     the one appearing latest in FLOW_STEPS.
 *
 * `staleSteps` lists every other gate-type step (flow-level) that is
 * in_progress and was NOT chosen. Callers are expected to transition those
 * to `done` to recover from missed post-hook completions.
 *
 * @param {object} state
 * @returns {{ phase: string, staleSteps: string[] } | null}
 */
export function resolveGatePhaseFromState(state) {
  if (!state || !Array.isArray(state.steps)) return null;

  const flowInProgress = state.steps.filter(
    (s) => FLOW_GATE_STEP_IDS.includes(s.id) && s.status === "in_progress",
  );

  const task = resolveActiveTask(state);
  const taskInProgress = task
    ? (task.steps || []).filter(
        (s) => TASK_GATE_STEP_IDS.includes(s.id) && s.status === "in_progress",
      )
    : [];

  if (taskInProgress.length > 0) {
    const chosen = taskInProgress[0];
    const staleSteps = flowInProgress.map((s) => s.id);
    return { phase: TASK_STEP_TO_PHASE[chosen.id], staleSteps };
  }

  if (flowInProgress.length === 0) return null;

  const chosen = pickLatestFlowGateStep(flowInProgress);
  const staleSteps = flowInProgress.filter((s) => s.id !== chosen.id).map((s) => s.id);
  return { phase: STEP_TO_PHASE[chosen.id], staleSteps };
}

function resolveActiveTask(state) {
  if (state.currentTaskId == null || !Array.isArray(state.tasks)) return null;
  return state.tasks.find((t) => t.id === state.currentTaskId) || null;
}

function pickLatestFlowGateStep(inProgressSteps) {
  let chosen = inProgressSteps[0];
  let chosenIdx = FLOW_STEPS.indexOf(chosen.id);
  for (let i = 1; i < inProgressSteps.length; i++) {
    const idx = FLOW_STEPS.indexOf(inProgressSteps[i].id);
    if (idx > chosenIdx) {
      chosen = inProgressSteps[i];
      chosenIdx = idx;
    }
  }
  return chosen;
}
