import fs from "fs";
import path from "path";
import { Container } from "../../src/lib/container.js";
import { FlowManager } from "../../src/lib/flow-manager.js";
import { buildInitialSteps } from "../../src/lib/flow-helpers.js";
import { findStepById, flattenSteps } from "../../src/flow/lib/step-tree.js";
import { createLifecycleStepTransition } from "../../src/flow/lib/lifecycle-step-transition.js";
import { NormalStepTransition } from "../../src/flow/lib/step-transition-policy.js";

/**
 * Build a fresh Container instance with `flowManager` registered for a test
 * tmp root. Mirrors the production Container.register("flowManager", ...) wiring
 * so tests exercise the same `container.get("flowManager")` access path.
 *
 * Tests run outside any real worktree, so `inWorktree` is always false
 * and `mainRoot === root`.
 */
export function makeContainer(root) {
  const c = new Container();
  c.register("flowManager", new FlowManager({ root, mainRoot: root, inWorktree: false }));
  return c;
}

/** Convenience accessor used by tests: returns the per-test container's flowManager. */
export function makeFlowManager(root) {
  return makeContainer(root).get("flowManager");
}

export function makeNormalStepTransition(state, stepId, requestedStatus = "done") {
  const step = findStepById(state.steps || [], stepId);
  if (!step) throw new Error(`unknown fixture step: ${stepId}`);
  return new NormalStepTransition({
    stepId,
    currentStepId: stepId,
    currentStatus: step.status,
    requestedStatus,
  });
}

export function makeLifecycleStepTransition(
  state,
  stepId,
  requestedStatus,
  event = "definition:keep-in-progress",
) {
  return createLifecycleStepTransition({
    flowState: state,
    stepId,
    status: requestedStatus,
    event,
    taskId: null,
  });
}

const DEFAULT_TASK = {
  id: "T-default",
  title: "Default test task",
  goal: "Placeholder task for test fixtures.",
  parent: null,
  origin: "plan",
  added_round: 0,
  status: "pending",
  steps: [
    { id: "task-impl", status: "pending" },
    { id: "task-review", status: "pending" },
    { id: "task-gate", status: "pending" },
  ],
};

export function makeDefaultTask(overrides = {}) {
  return { ...structuredClone(DEFAULT_TASK), ...structuredClone(overrides) };
}

export function makeFlowState(overrides = {}) {
  return {
    specId: "001-test",
    runId: "run-test",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [makeDefaultTask()],
    currentTaskId: null,
    ...structuredClone(overrides),
  };
}

/**
 * Move a fresh full flow fixture to one definition leaf while preserving the
 * current FlowState invariant of at most one in-progress flow leaf.
 */
export function moveFlowToStep(state, stepId, { completePrevious = true } = {}) {
  const leaves = flattenSteps(state.steps);
  const targetIndex = leaves.findIndex((step) => step.id === stepId);
  if (targetIndex < 0) throw new Error(`unknown flow step: ${stepId}`);

  for (const [index, step] of leaves.entries()) {
    if (index === targetIndex) {
      step.status = "in_progress";
    } else {
      step.status = completePrevious && index < targetIndex ? "done" : "pending";
    }
  }
  return state;
}

export function setupFlow(tmp, overrides = {}) {
  const state = makeFlowState(overrides);
  return persistFlow(tmp, state);
}

export function setupFlowAtStep(tmp, stepId, overrides = {}) {
  const state = moveFlowToStep(makeFlowState(overrides), stepId);
  return persistFlow(tmp, state);
}

function persistFlow(tmp, state) {
  const fm = makeFlowManager(tmp);
  fm.create(state);
  const specId = state.specId;
  const mode = state.worktree ? "worktree" : state.featureBranch === state.baseBranch ? "local" : "branch";
  fm.addActiveFlow(specId, mode);
  return fm.loadReadOnly(specId);
}

export function replaceFlowState(root, state, options = {}) {
  const replacement = structuredClone(state);
  makeFlowManager(root).mutate((current) => {
    for (const key of Object.keys(current)) delete current[key];
    Object.assign(current, replacement);
  }, options);
}

export function setStepDone(state, ...ids) {
  for (const id of ids) {
    const step = findStepById(state.steps, id);
    if (step) step.status = "done";
  }
}

/**
 * Write a .senti/config.json with the given language into tmp.
 */
export function setupFlowConfig(tmp, lang) {
  const sentiDir = path.join(tmp, ".senti");
  fs.mkdirSync(sentiDir, { recursive: true });
  fs.writeFileSync(path.join(sentiDir, "config.json"), JSON.stringify({
    lang,
    type: "base",
    docs: { languages: [lang], defaultLanguage: lang },
  }));
}
