import fs from "fs";
import path from "path";
import { Container } from "../../src/lib/container.js";
import { FlowManager } from "../../src/lib/flow-manager.js";
import { FLOW_STEPS, buildInitialSteps } from "../../src/lib/flow-helpers.js";
import { findStepById } from "../../src/flow/lib/step-tree.js";

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

const DEFAULT_TASK = {
  id: "T-default",
  title: "Default test task",
  goal: "Placeholder task for test fixtures.",
  parent: null,
  origin: "plan",
  added_round: 0,
  status: "pending",
  steps: [
    { id: "impl", status: "pending" },
    { id: "review", status: "pending" },
    { id: "gate-impl", status: "pending" },
  ],
};

export function makeDefaultTask(overrides = {}) {
  return { ...DEFAULT_TASK, ...overrides };
}

export function makeFlowState(overrides = {}) {
  return {
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{ ...DEFAULT_TASK }],
    currentTaskId: null,
    ...overrides,
  };
}

export function setupFlow(tmp, overrides = {}) {
  const state = makeFlowState(overrides);
  const fm = makeFlowManager(tmp);
  fm.save(state);
  const specId = state.spec.split("/")[1];
  const mode = state.worktree ? "worktree" : state.featureBranch === state.baseBranch ? "local" : "branch";
  fm.addActiveFlow(specId, mode);
  return state;
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
