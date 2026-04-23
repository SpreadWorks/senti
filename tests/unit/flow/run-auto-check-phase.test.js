import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../helpers/git-repo.js";
import {
  writeStubAgentScript,
  writeCapturingStubAgentScript,
  stubAgentConfig,
} from "../../helpers/stub-agent.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";

const CMD = path.join(process.cwd(), "src/sdd-forge.js");

function stubResponse() {
  return JSON.stringify({
    specBuildability: 2,
    ambiguity: 2,
    verifiability: 2,
    scopeBoundedness: 2,
    targetSpecificity: 1,
    precedent: 1,
    reason: "stub ok",
  });
}

function setupProject(tmp, { aiResponse, capturePath } = {}) {
  const stubPath = capturePath
    ? writeCapturingStubAgentScript(tmp, ".stub-agent.js", capturePath, aiResponse ?? stubResponse())
    : writeStubAgentScript(tmp, ".stub-agent.js", aiResponse ?? stubResponse());
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: stubAgentConfig(stubPath),
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  return tmp;
}

function seedActiveFlow(tmp, { steps, issue, request, draftBody } = {}) {
  const specDir = path.join(tmp, "specs", "001-test");
  fs.mkdirSync(specDir, { recursive: true });
  if (draftBody != null) {
    fs.writeFileSync(path.join(specDir, "draft.md"), draftBody);
  }
  makeFlowManager(tmp).save({
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    issue: issue ?? 100,
    request: request ?? "add a progress bar",
    steps: steps ?? buildInitialSteps(),
  });
  makeFlowManager(tmp).addActiveFlow("001-test", "branch");
}

function runCli(tmp, args) {
  return spawnSync("node", [CMD, ...args], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
  });
}

function withStepDone(baseSteps, stepId) {
  return baseSteps.map((s) => (s.id === stepId ? { ...s, status: "done" } : s));
}

describe("flow run auto-check — phase-aware input selection (spec 220)", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("auto-check-phase-");
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  // A1 (R1) — spec-approved skip path
  it("returns skipped eligible=true without calling AI when approval step is done", () => {
    const capturePath = path.join(tmp, ".stub-agent-called");
    setupProject(tmp, { capturePath });
    const steps = withStepDone(buildInitialSteps(), "approval");
    seedActiveFlow(tmp, { steps });

    const res = runCli(tmp, ["flow", "run", "auto-check"]);
    assert.equal(res.status, 0, res.stderr);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.data.eligible, true);
    assert.equal(envelope.data.skipped, true);
    assert.equal(envelope.data.reason, "spec approved");
    assert.equal(
      fs.existsSync(capturePath),
      false,
      "AI agent must not be invoked when spec is approved",
    );

    // Persist audit record
    const state = makeFlowManager(tmp).load();
    assert.equal(state.autoCheck?.skipped, true);
  });

  // A2 (R2) — draft body is included after gate-draft done
  it("includes draft.md body in AI prompt when gate-draft is done", () => {
    const capturePath = path.join(tmp, ".stub-agent-prompt");
    setupProject(tmp, { capturePath });
    const steps = withStepDone(buildInitialSteps(), "gate-draft");
    const draftBody = "DRAFT_MARKER_XYZ123 このドラフトは識別用のマーカーを含む";
    seedActiveFlow(tmp, { steps, draftBody });

    const res = runCli(tmp, ["flow", "run", "auto-check"]);
    assert.equal(res.status, 0, res.stderr);

    const prompt = fs.readFileSync(capturePath, "utf8");
    assert.ok(
      prompt.includes("DRAFT_MARKER_XYZ123"),
      `draft body marker must appear in prompt. prompt snippet: ${prompt.slice(0, 400)}`,
    );
    // Issue / request context should still be present
    assert.ok(prompt.includes("add a progress bar") || prompt.includes("Issue #100"));
  });

  // A2 (R2) complement — when gate-draft NOT done, draft body is excluded
  it("excludes draft body when gate-draft is not done", () => {
    const capturePath = path.join(tmp, ".stub-agent-prompt");
    setupProject(tmp, { capturePath });
    const draftBody = "PROVISIONAL_DRAFT_MARKER should not leak while gate-draft is still pending";
    seedActiveFlow(tmp, { draftBody });

    const res = runCli(tmp, ["flow", "run", "auto-check"]);
    assert.equal(res.status, 0, res.stderr);
    const prompt = fs.readFileSync(capturePath, "utf8");
    assert.ok(
      !prompt.includes("PROVISIONAL_DRAFT_MARKER"),
      "draft body must NOT be included before gate-draft passes",
    );
  });

  // A6 (R5) — --input option is rejected
  it("rejects --input option with unknown option error", () => {
    setupProject(tmp);
    seedActiveFlow(tmp);
    const res = runCli(tmp, ["flow", "run", "auto-check", "--input", "foo"]);
    assert.notEqual(res.status, 0, "CLI must exit non-zero when --input is passed");
    const combined = `${res.stdout}\n${res.stderr}`;
    assert.ok(
      /--input|unknown option|unknown flag/i.test(combined),
      `expected unknown option error. output: ${combined.slice(0, 400)}`,
    );
  });

  // A3 (R3) — preparing mode + no --run-id → MISSING_RUN_ID
  it("returns MISSING_RUN_ID when no active flow, multiple preparing, no --run-id", () => {
    setupProject(tmp);
    const fm = makeFlowManager(tmp);
    fm.createPreparingFlow(fm.generateRunId(), { issue: 1, request: "x" });
    fm.createPreparingFlow(fm.generateRunId(), { issue: 2, request: "y" });

    const res = runCli(tmp, ["flow", "run", "auto-check"]);
    assert.notEqual(res.status, 0, res.stdout);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.ok, false);
    const codes = (envelope.errors || []).map((e) => e.code);
    assert.ok(
      codes.includes("MISSING_RUN_ID"),
      `expected MISSING_RUN_ID, got codes: ${codes.join(",")}`,
    );
  });

  // A4 (R3,R6) — preparing 1 + no --run-id → still MISSING_RUN_ID (no auto-select)
  it("does NOT auto-select the sole preparing flow when --run-id is omitted", () => {
    setupProject(tmp);
    const fm = makeFlowManager(tmp);
    const runId = fm.generateRunId();
    fm.createPreparingFlow(runId, { issue: 1, request: "x" });

    const res = runCli(tmp, ["flow", "run", "auto-check"]);
    assert.notEqual(res.status, 0, res.stdout);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.ok, false);
    const codes = (envelope.errors || []).map((e) => e.code);
    assert.ok(
      codes.includes("MISSING_RUN_ID"),
      `expected MISSING_RUN_ID even with one preparing flow, got codes: ${codes.join(",")}`,
    );

    // The preparing state must remain untouched — no autoCheck persisted
    const preparing = fm.loadPreparingFlow(runId);
    assert.equal(preparing.autoCheck, undefined);
  });
});
