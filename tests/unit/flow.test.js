import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../helpers/flow-setup.js";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../helpers/tmp-dir.js";
import { buildInitialSteps, FLOW_STEPS } from "../../src/lib/flow-helpers.js";
import { flattenSteps, findStepById } from "../../src/flow/lib/step-tree.js";
const FLOW_CMD = join(process.cwd(), "src/flow.js");

// ── .active-flow pointer tests ──────────────────────────────────────────────

describe("active-flow pointer", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("loadActiveFlows returns empty array when .active-flow does not exist", () => {
    tmp = createTmpDir();
    const flows = makeFlowManager(tmp).loadActiveFlows();
    assert.deepEqual(flows, []);
  });

  it("addActiveFlow creates .active-flow with one entry", () => {
    tmp = createTmpDir();
    makeFlowManager(tmp).addActiveFlow("086-migrate-flow-state", "worktree");
    const flows = makeFlowManager(tmp).loadActiveFlows();
    assert.equal(flows.length, 1);
    assert.equal(flows[0].spec, "086-migrate-flow-state");
    assert.equal(flows[0].mode, "worktree");
  });

  it("addActiveFlow appends to existing entries", () => {
    tmp = createTmpDir();
    makeFlowManager(tmp).addActiveFlow("086-migrate", "worktree");
    makeFlowManager(tmp).addActiveFlow("087-other", "branch");
    const flows = makeFlowManager(tmp).loadActiveFlows();
    assert.equal(flows.length, 2);
    assert.equal(flows[0].spec, "086-migrate");
    assert.equal(flows[1].spec, "087-other");
    assert.equal(flows[1].mode, "branch");
  });

  it("removeActiveFlow removes matching entry and keeps others", () => {
    tmp = createTmpDir();
    makeFlowManager(tmp).addActiveFlow("086-migrate", "worktree");
    makeFlowManager(tmp).addActiveFlow("087-other", "branch");
    makeFlowManager(tmp).removeActiveFlow("086-migrate");
    const flows = makeFlowManager(tmp).loadActiveFlows();
    assert.equal(flows.length, 1);
    assert.equal(flows[0].spec, "087-other");
  });

  it("removeActiveFlow deletes .active-flow file when last entry is removed", () => {
    tmp = createTmpDir();
    makeFlowManager(tmp).addActiveFlow("086-migrate", "worktree");
    makeFlowManager(tmp).removeActiveFlow("086-migrate");
    const flows = makeFlowManager(tmp).loadActiveFlows();
    assert.deepEqual(flows, []);
    assert.ok(!fs.existsSync(join(tmp, ".senti", ".active-flow")));
  });

  it("removeActiveFlow is a no-op when spec ID does not exist", () => {
    tmp = createTmpDir();
    makeFlowManager(tmp).addActiveFlow("086-migrate", "worktree");
    makeFlowManager(tmp).removeActiveFlow("999-nonexistent");
    const flows = makeFlowManager(tmp).loadActiveFlows();
    assert.equal(flows.length, 1);
  });

  it(".active-flow is stored as valid JSON", () => {
    tmp = createTmpDir();
    makeFlowManager(tmp).addActiveFlow("086-migrate", "local");
    const raw = fs.readFileSync(join(tmp, ".senti", ".active-flow"), "utf8");
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed));
    assert.equal(parsed[0].spec, "086-migrate");
    assert.equal(parsed[0].mode, "local");
  });
});

// ── flow.json storage in specs/NNN/ ─────────────────────────────────────────

describe("flow-state (specs-based storage)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("saveFlowState writes to specs/NNN/flow.json", () => {
    tmp = createTmpDir();
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
    };
    makeFlowManager(tmp).save(state);
    assert.ok(fs.existsSync(join(tmp, "specs", specId, "flow.json")));
  });

  it("saveFlowState does NOT write to .senti/flow.json", () => {
    tmp = createTmpDir();
    const state = {
      spec: "specs/001-test/spec.md",
      baseBranch: "main",
      featureBranch: "feature/001-test",
    };
    makeFlowManager(tmp).save(state);
    assert.ok(!fs.existsSync(join(tmp, ".senti", "flow.json")));
  });

  it("loadFlowState reads from specs/NNN/flow.json via .active-flow", () => {
    tmp = createTmpDir();
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    // Manually set up: write flow.json + .active-flow
    const flowDir = join(tmp, "specs", specId);
    fs.mkdirSync(flowDir, { recursive: true });
    fs.writeFileSync(join(flowDir, "flow.json"), JSON.stringify(state, null, 2) + "\n");
    makeFlowManager(tmp).addActiveFlow(specId, "local");

    const loaded = makeFlowManager(tmp).load();
    // Core fields must be preserved; runId is auto-assigned by transparent migration
    assert.equal(loaded.spec, state.spec);
    assert.equal(loaded.baseBranch, state.baseBranch);
    assert.equal(loaded.featureBranch, state.featureBranch);
    assert.ok(loaded.runId, "runId should be auto-assigned by transparent migration");
  });

  it("loadFlowState returns null when no .active-flow exists", () => {
    tmp = createTmpDir();
    assert.equal(makeFlowManager(tmp).load(), null);
  });

  it("clearFlowState removes entry from .active-flow but keeps flow.json", () => {
    tmp = createTmpDir();
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
    };
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow(specId, "local");

    makeFlowManager(tmp).clearFlowState(specId);

    // .active-flow entry should be removed
    const flows = makeFlowManager(tmp).loadActiveFlows();
    assert.equal(flows.length, 0);
    // flow.json should still exist
    assert.ok(fs.existsSync(join(tmp, "specs", specId, "flow.json")));
  });
});

// ── steps and requirements ──────────────────────────────────────────────────

describe("flow-state steps and requirements", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlow(dir) {
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-default", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(dir).save(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
    return specId;
  }

  it("FLOW_STEPS does not contain 'archive'", () => {
    assert.ok(!FLOW_STEPS.includes("archive"), "archive step should be removed");
  });

  it("buildInitialSteps creates nested entries covering all leaf step ids", () => {
    const steps = buildInitialSteps();
    const flat = flattenSteps(steps);
    assert.equal(flat.length, FLOW_STEPS.length);
    // First leaf is promoted to in_progress by buildInitialNestedSteps;
    // all others should be pending.
    for (const step of flat.slice(1)) {
      assert.equal(step.status, "pending");
    }
  });

  it("updateStepStatus updates the correct step", () => {
    tmp = createTmpDir();
    const specId = setupFlow(tmp);
    makeFlowManager(tmp).updateStepStatus("spec-gate", "done");
    const loaded = makeFlowManager(tmp).load();
    const gate = findStepById(loaded.steps, "spec-gate");
    assert.equal(gate.status, "done");
  });

  // ── spec 219 / REQ-1, REQ-2: auto-promote next pending on done transition ──

  it("updateStepStatus auto-promotes first pending when transitioning to done (REQ-1)", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const fm = makeFlowManager(tmp);
    fm.updateStepStatus("branch", "in_progress");
    fm.updateStepStatus("branch", "done");
    const loaded = fm.load();
    const branch = findStepById(loaded.steps, "branch");
    assert.equal(branch.status, "done");
    const prepareSpec = findStepById(loaded.steps, "prepare-spec");
    assert.equal(prepareSpec.status, "in_progress", "first pending step should be promoted to in_progress");
  });

  it("updateStepStatus skips over already-done/skipped steps when promoting (REQ-1)", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const fm = makeFlowManager(tmp);
    // Manually set prepare-spec to skipped so the next promotion target is draft.
    fm.updateStepStatus("prepare-spec", "skipped");
    fm.updateStepStatus("branch", "in_progress");
    fm.updateStepStatus("branch", "done");
    const loaded = fm.load();
    const prepareSpec = findStepById(loaded.steps, "prepare-spec");
    assert.equal(prepareSpec.status, "skipped", "skipped stays skipped");
    const draft = findStepById(loaded.steps, "draft");
    assert.equal(draft.status, "in_progress", "first pending (draft) is promoted, skipped is bypassed");
  });

  it("updateStepStatus does NOT promote when another step is already in_progress (REQ-2)", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const fm = makeFlowManager(tmp);
    // Put `spec` into in_progress first, then mark `branch` done.
    fm.updateStepStatus("spec", "in_progress");
    fm.updateStepStatus("branch", "done");
    const loaded = fm.load();
    const spec = findStepById(loaded.steps, "spec");
    assert.equal(spec.status, "in_progress", "pre-existing in_progress step is not touched");
    const prepareSpec = findStepById(loaded.steps, "prepare-spec");
    assert.equal(prepareSpec.status, "pending", "no new promotion happens when in_progress already exists");
    const draft = findStepById(loaded.steps, "draft");
    assert.equal(draft.status, "pending", "no downstream promotion happens either");
  });

  it("updateStepStatus does NOT promote on non-done transitions (REQ-2)", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const fm = makeFlowManager(tmp);
    fm.updateStepStatus("branch", "in_progress");
    // Move branch back to pending — no promotion should happen.
    fm.updateStepStatus("branch", "pending");
    const loaded = fm.load();
    const prepareSpec = findStepById(loaded.steps, "prepare-spec");
    assert.equal(prepareSpec.status, "pending", "pending transition does not trigger promotion");
  });

  it("updateStepStatus does nothing when no pending steps remain (REQ-1 edge)", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const fm = makeFlowManager(tmp);
    // Mark every leaf done.
    const state = fm.load();
    const flat = flattenSteps(state.steps);
    for (const s of flat) s.status = "done";
    fm.save(state);
    // Transition final leaf step again — no pending left, so nothing to promote.
    const lastStep = flat[flat.length - 1];
    fm.updateStepStatus(lastStep.id, "done");
    const loaded = fm.load();
    for (const s of flattenSteps(loaded.steps)) assert.equal(s.status, "done");
  });
});

// ── setIssue ─────────────────────────────────────────────────────────────────

describe("setIssue", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlow(dir) {
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-default", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(dir).save(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
    return specId;
  }

  it("sets issue number in flow.json", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    makeFlowManager(tmp).setIssue(17);
    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.issue, 17);
  });

  it("overwrites existing issue number", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    makeFlowManager(tmp).setIssue(10);
    makeFlowManager(tmp).setIssue(25);
    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.issue, 25);
  });
});
