/**
 * src/flow/lib/gate-step.js
 *
 * Gate step / gate phase mapping — derived from definition.js.
 */

import { FLOW_DEFINITION, TASK_DEFINITION, collectLeafIds, resolveNodeFor, collectGatePhaseEntries } from "../definition.js";

const PHASE_TO_STEP_ENTRIES = Object.freeze(collectGatePhaseEntries());

const PHASE_TO_STEP = Object.freeze(Object.fromEntries(PHASE_TO_STEP_ENTRIES));

/** Flow-level step id → gate phase (inverse; first-wins on collisions). */
export const STEP_TO_PHASE = Object.freeze(
  PHASE_TO_STEP_ENTRIES.reduce((acc, [phase, step]) => {
    if (phase === "task-spec") return acc;
    if (!(step in acc)) acc[step] = phase;
    return acc;
  }, {}),
);

export function resolveGateStepId(phase) {
  const step = PHASE_TO_STEP[phase];
  return step || "gate";
}

const TASK_STEP_TO_PHASE = Object.freeze({
  "gate": "task-spec",
});

const FLOW_GATE_STEP_IDS = Object.freeze(Object.keys(STEP_TO_PHASE));
const TASK_GATE_STEP_IDS = Object.freeze(Object.keys(TASK_STEP_TO_PHASE));

export function resolveGatePhaseFromState(state) {
  if (!state || !Array.isArray(state.steps)) return null;

  const flatSteps = flattenForGate(state.steps);
  const flowInProgress = flatSteps.filter(
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

  const leafIds = collectLeafIds(FLOW_DEFINITION);
  const chosen = pickLatestFlowGateStep(flowInProgress, leafIds);
  const staleSteps = flowInProgress.filter((s) => s.id !== chosen.id).map((s) => s.id);
  return { phase: STEP_TO_PHASE[chosen.id], staleSteps };
}

function resolveActiveTask(state) {
  if (state.currentTaskId == null || !Array.isArray(state.tasks)) return null;
  return state.tasks.find((t) => t.id === state.currentTaskId) || null;
}

function pickLatestFlowGateStep(inProgressSteps, leafIds) {
  let chosen = inProgressSteps[0];
  let chosenIdx = leafIds.indexOf(chosen.id);
  for (let i = 1; i < inProgressSteps.length; i++) {
    const idx = leafIds.indexOf(inProgressSteps[i].id);
    if (idx > chosenIdx) {
      chosen = inProgressSteps[i];
      chosenIdx = idx;
    }
  }
  return chosen;
}

function flattenForGate(steps) {
  const flat = [];
  for (const s of steps) {
    if (s.children) {
      flat.push(...flattenForGate(s.children));
    } else {
      flat.push(s);
    }
  }
  return flat;
}
