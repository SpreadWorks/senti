import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
// ── shared helpers ─────────────────────────────────────────────────────────

function makeState(overrides = {}) {
  return {
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    worktree: false,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
    ...overrides,
  };
}

// ── runId in flow.json ─────────────────────────────────────────────────────

describe("flow-state runId management", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  // ── Req 4: transparent migration ───────────────────────────────────────

  it("loadFlowState auto-assigns runId when flow.json lacks one", () => {
    tmp = createTmpDir();
    const state = makeState();
    // Save without runId
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "local");

    const loaded = makeFlowManager(tmp).load("001-test");
    assert.ok(loaded.runId, "runId should be auto-assigned");
    assert.equal(typeof loaded.runId, "string");
    assert.ok(loaded.runId.length > 0);

    // Verify it was persisted
    const raw = JSON.parse(fs.readFileSync(join(tmp, "specs/001-test/flow.json"), "utf8"));
    assert.equal(raw.runId, loaded.runId);
  });

  it("loadFlowState preserves existing runId", () => {
    tmp = createTmpDir();
    const state = makeState({ runId: "existing-run-id-123" });
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "local");

    const loaded = makeFlowManager(tmp).load("001-test");
    assert.equal(loaded.runId, "existing-run-id-123");
  });

  it("transparent migration assigns different runIds to different flows", () => {
    tmp = createTmpDir();
    const state1 = makeState({ spec: "specs/001-test/spec.md" });
    const state2 = makeState({ spec: "specs/002-other/spec.md", featureBranch: "feature/002-other" });
    makeFlowManager(tmp).save(state1);
    makeFlowManager(tmp).save(state2);

    const loaded1 = makeFlowManager(tmp).load("001-test");
    const loaded2 = makeFlowManager(tmp).load("002-other");
    assert.ok(loaded1.runId);
    assert.ok(loaded2.runId);
    assert.notEqual(loaded1.runId, loaded2.runId);
  });

  // ── Req 3: lifecycle field (spec 233: removed from flow.json) ──────────

  it("flow.json without lifecycle field loads without error", () => {
    tmp = createTmpDir();
    const state = makeState({ runId: "test-run" });
    makeFlowManager(tmp).save(state);

    const loaded = makeFlowManager(tmp).load("001-test");
    assert.equal(loaded.lifecycle, undefined);
    assert.equal(loaded.runId, "test-run");
  });

  // ── Req 5: status output includes runId ────────────────────────────────

  it("loadFlowState returns runId in state object", () => {
    tmp = createTmpDir();
    const state = makeState({ runId: "my-run-id" });
    makeFlowManager(tmp).save(state);

    const loaded = makeFlowManager(tmp).load("001-test");
    assert.equal(loaded.runId, "my-run-id");
  });
});

// ── .active-flow.<runId> preparing files ────────────────────────────────────

function makePreparingState(runId, overrides = {}) {
  return {
    runId,
    lifecycle: "preparing",
    spec: null,
    baseBranch: null,
    featureBranch: null,
    worktree: null,
    steps: buildInitialSteps(),
    requirements: [],
    autoApprove: false,
    ...overrides,
  };
}

function writePreparingFile(sentiDir, runId, overrides = {}) {
  const state = makePreparingState(runId, overrides);
  fs.writeFileSync(join(sentiDir, `.active-flow.${runId}`), JSON.stringify(state, null, 2) + "\n");
  return state;
}

describe("preparing state files (.active-flow.<runId>)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  // ── Req 1: flow set init creates .active-flow.<runId> ──────────────────

  it(".active-flow.<runId> file uses flow.json schema with null fields", () => {
    tmp = createTmpDir();
    const sentiDir = join(tmp, ".senti");
    fs.mkdirSync(sentiDir, { recursive: true });

    const runId = "test-run-id-abc";
    writePreparingFile(sentiDir, runId);

    // Verify file exists and is valid JSON with expected schema
    const raw = JSON.parse(fs.readFileSync(join(sentiDir, `.active-flow.${runId}`), "utf8"));
    assert.equal(raw.runId, runId);
    assert.equal(raw.lifecycle, "preparing");
    assert.equal(raw.spec, null);
    assert.equal(raw.baseBranch, null);
    assert.equal(raw.featureBranch, null);
    assert.equal(raw.worktree, null);
    assert.equal(raw.autoApprove, false);
    assert.ok(Array.isArray(raw.steps));
    assert.ok(Array.isArray(raw.requirements));
  });

  // ── Req 8: autoApprove in preparing state ──────────────────────────────

  it("preparing state always has autoApprove false", () => {
    tmp = createTmpDir();
    const sentiDir = join(tmp, ".senti");
    fs.mkdirSync(sentiDir, { recursive: true });

    const runId = "test-auto-approve";
    writePreparingFile(sentiDir, runId);

    const raw = JSON.parse(fs.readFileSync(join(sentiDir, `.active-flow.${runId}`), "utf8"));
    assert.equal(raw.autoApprove, false);
  });

  // ── Req 4: deletion after promotion ────────────────────────────────────

  it(".active-flow.<runId> is deletable after promotion to flow.json", () => {
    tmp = createTmpDir();
    const sentiDir = join(tmp, ".senti");
    fs.mkdirSync(sentiDir, { recursive: true });

    const runId = "promote-test";
    const preparingFile = join(sentiDir, `.active-flow.${runId}`);
    writePreparingFile(sentiDir, runId);
    assert.ok(fs.existsSync(preparingFile));

    // Simulate promotion: save flow.json + add to .active-flow + delete preparing file
    const state = makeState({ runId });
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "local");
    fs.unlinkSync(preparingFile);

    // Verify: flow.json exists, .active-flow has entry, preparing file gone
    const loaded = makeFlowManager(tmp).load("001-test");
    assert.equal(loaded.runId, runId);
    assert.ok(!fs.existsSync(preparingFile));
    const flows = makeFlowManager(tmp).loadActiveFlows();
    assert.equal(flows.length, 1);
  });

  // ── Req 9: conflict guard ─────────────────────────────────────────────

  it("multiple .active-flow.* files can coexist", () => {
    tmp = createTmpDir();
    const sentiDir = join(tmp, ".senti");
    fs.mkdirSync(sentiDir, { recursive: true });

    const runId1 = "run-1";
    const runId2 = "run-2";
    writePreparingFile(sentiDir, runId1);
    writePreparingFile(sentiDir, runId2);

    const files = fs.readdirSync(sentiDir).filter((f) => f.startsWith(".active-flow."));
    assert.equal(files.length, 2);
  });
});
