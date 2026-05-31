// spec: R10
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  renameFlowStateStepIds,
  FLOW_STEP_RENAMES,
  TASK_STEP_RENAMES,
} from "../../../src/lib/step-id-rename.js";
import { makeFlowManager, setupFlowConfig } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

// A pre-269 flow state: flow-scope steps[] and task-scope tasks[].steps[] both use legacy ids.
function legacyState() {
  return {
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    worktree: false,
    steps: [
      { id: "plan", status: "pending", children: [
        { id: "gate-draft", status: "done" },
        { id: "review-spec", status: "done" },
        { id: "spec-review-triage", status: "done" },
        { id: "gate", status: "done" },
        { id: "review-test", status: "done" },
      ] },
      { id: "impl", status: "pending", children: [
        { id: "implement", status: "done" },
        { id: "review", status: "in_progress" },
        { id: "gate-impl", status: "pending" },
      ] },
    ],
    requirements: [],
    tasks: [
      { id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "in_progress", steps: [
        { id: "impl", status: "done" },
        { id: "review", status: "in_progress" },
        { id: "gate-impl", status: "pending" },
      ] },
    ],
    currentTaskId: "T-1",
  };
}

function leafIds(nodes, acc = []) {
  for (const n of nodes) {
    if (Array.isArray(n.children) && n.children.length) leafIds(n.children, acc);
    else acc.push(n.id);
  }
  return acc;
}

test("R10: renameFlowStateStepIds renames flow-scope and task-scope leaves, preserves branch ids", () => {
  const state = legacyState();
  const changes = renameFlowStateStepIds(state);
  assert.ok(changes.length > 0, "should report renames");

  // branch container ids unchanged
  assert.equal(state.steps[0].id, "plan");
  assert.equal(state.steps[1].id, "impl");

  // flow-scope leaves -> new names (collision review/gate-impl resolve to impl-*)
  assert.deepEqual(leafIds(state.steps[0].children), ["draft-gate", "spec-review", "spec-triage", "spec-gate", "test-review"]);
  assert.deepEqual(leafIds(state.steps[1].children), ["implement", "impl-review", "impl-gate"]);

  // task-scope leaves -> task-* collisions
  assert.deepEqual(state.tasks[0].steps.map((s) => s.id), ["task-impl", "task-review", "task-gate"]);
});

test("R10: rename maps resolve collision ids by scope", () => {
  assert.equal(FLOW_STEP_RENAMES.review, "impl-review");
  assert.equal(FLOW_STEP_RENAMES["gate-impl"], "impl-gate");
  assert.equal(FLOW_STEP_RENAMES.gate, "spec-gate");
  assert.equal(TASK_STEP_RENAMES.impl, "task-impl");
  assert.equal(TASK_STEP_RENAMES.review, "task-review");
  assert.equal(TASK_STEP_RENAMES["gate-impl"], "task-gate");
});

test("R10: FlowManager.load migrates a persisted legacy flow.json to new step ids", () => {
  const tmp = createTmpDir();
  try {
    setupFlowConfig(tmp, "en");
    const fm = makeFlowManager(tmp);
    // Persist a legacy-id flow.json verbatim, then reload through the migrating load path.
    fm.save(legacyState());
    const loaded = fm.load("001-test");

    assert.deepEqual(leafIds(loaded.steps[1].children), ["implement", "impl-review", "impl-gate"]);
    assert.deepEqual(loaded.tasks[0].steps.map((s) => s.id), ["task-impl", "task-review", "task-gate"]);

    // The migrating load path persists the upgrade back to disk.
    const onDisk = JSON.parse(fs.readFileSync(path.join(tmp, "specs", "001-test", "flow.json"), "utf8"));
    const implChildren = onDisk.steps.find((s) => s.id === "impl").children.map((c) => c.id);
    assert.ok(implChildren.includes("impl-review") && implChildren.includes("impl-gate"));
    assert.ok(!implChildren.includes("review") && !implChildren.includes("gate-impl"));
  } finally {
    removeTmpDir(tmp);
  }
});
