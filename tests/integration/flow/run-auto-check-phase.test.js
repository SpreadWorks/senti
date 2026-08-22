import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../../support/builders/tmp-dir.js";
import { initGitRepo, commitAll } from "../../support/infrastructure/git-repo.js";
import {
  writeStubAgentScript,
  writeCapturingStubAgentScript,
  stubAgentConfig,
} from "../../support/fakes/stub-agent.js";
import { CanonicalAutoCheckScenario, makeFlowManager } from "../../support/infrastructure/flow-setup.js";

const CMD = path.join(process.cwd(), "src/sennel.js");

function stubResponse() {
  return JSON.stringify({
    specBuildability: 2,
    ambiguity: 2,
    verifiability: 2,
    scopeBoundedness: 2,
    targetSpecificity: 1,
    precedent: 1,
    goal: "test goal",
    reason: "stub ok",
  });
}

function setupProject(tmp, { aiResponse, capturePath } = {}) {
  const stubPath = capturePath
    ? writeCapturingStubAgentScript(tmp, ".stub-agent.js", capturePath, aiResponse ?? stubResponse())
    : writeStubAgentScript(tmp, ".stub-agent.js", aiResponse ?? stubResponse());
  writeJson(tmp, ".sennel/config.json", {
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

function seedActiveFlow(tmp, {
  issue = 100,
  request = "add a progress bar",
  draftBody = null,
  phase = "fresh",
} = {}) {
  const scenario = new CanonicalAutoCheckScenario({
    flowManager: makeFlowManager(tmp),
    specId: "001-test",
    runId: "run-001-test",
    issue,
    request,
    execution: { mode: "branch", baseBranch: "main", featureBranch: "feature/001-test" },
  }).create();

  if (phase === "fresh") return scenario;
  if (!new Set(["draft-saved-before-gate", "draft-gate-done", "approval-done"]).has(phase)) {
    throw new Error(`unknown canonical auto-check fixture phase: ${phase}`);
  }
  if (phase === "approval-done") {
    return scenario.approvalDone();
  }
  if (typeof draftBody !== "string") throw new Error(`${phase} requires a canonical draft body`);
  if (phase === "draft-saved-before-gate") return scenario.draftSavedBeforeGate(draftBody);
  return scenario.draftGateDone(draftBody);
}

function runCli(tmp, args) {
  return spawnSync("node", [CMD, ...args], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SENNEL_WORK_ROOT: tmp },
  });
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
    seedActiveFlow(tmp, { phase: "approval-done" });

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

    // Exact V1 state does not cache an auto-check verdict.
    const state = makeFlowManager(tmp).load();
    assert.equal(Object.hasOwn(state, "autoCheck"), false);
  });

  // A2 (R2) — draft body is included after draft-gate done
  it("includes draft.json body in AI prompt when draft-gate is done", () => {
    const capturePath = path.join(tmp, ".stub-agent-prompt");
    setupProject(tmp, { capturePath });
    const draftBody = JSON.stringify({ goal: "DRAFT_MARKER_XYZ123 add a progress bar" });
    seedActiveFlow(tmp, { phase: "draft-gate-done", draftBody });

    const res = runCli(tmp, ["flow", "run", "auto-check"]);
    assert.equal(res.status, 0, res.stderr);

    const prompt = fs.readFileSync(capturePath, "utf8");
    assert.ok(
      prompt.includes("DRAFT_MARKER_XYZ123"),
      `draft body marker must appear in prompt. prompt snippet: ${prompt.slice(0, 400)}`,
    );
    // The canonical catalog adapter preserves the worker-facing input order.
    assert.ok(prompt.includes("add a progress bar"));
    assert.ok(prompt.includes("Issue #100"));
    assert.ok(prompt.indexOf("add a progress bar") < prompt.indexOf("Issue #100"));
    assert.ok(prompt.indexOf("Issue #100") < prompt.indexOf("DRAFT_MARKER_XYZ123"));
  });

  // A2 (R2) complement — when draft-gate NOT done, draft body is excluded
  it("excludes draft body when draft-gate is not done", () => {
    const capturePath = path.join(tmp, ".stub-agent-prompt");
    setupProject(tmp, { capturePath });
    const draftBody = JSON.stringify({ goal: "PROVISIONAL_DRAFT_MARKER should not leak while draft-gate is pending" });
    seedActiveFlow(tmp, { phase: "draft-saved-before-gate", draftBody });

    const res = runCli(tmp, ["flow", "run", "auto-check"]);
    assert.equal(res.status, 0, res.stderr);
    const prompt = fs.readFileSync(capturePath, "utf8");
    assert.ok(
      !prompt.includes("PROVISIONAL_DRAFT_MARKER"),
      "draft body must NOT be included before draft-gate passes",
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
