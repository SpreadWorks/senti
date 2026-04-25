import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../helpers/git-repo.js";
import {
  writeStubAgentScript,
  writeCapturingStubAgentScript,
  stubAgentConfig,
} from "../helpers/stub-agent.js";
import { makeFlowManager } from "../helpers/flow-setup.js";
import { buildInitialSteps } from "../../src/lib/flow-helpers.js";

const CMD = path.join(process.cwd(), "src/sdd-forge.js");

function passingScore() {
  return JSON.stringify({
    specBuildability: 2,
    ambiguity: 2,
    verifiability: 2,
    scopeBoundedness: 2,
    targetSpecificity: 1,
    precedent: 1,
    reason: "e2e stub pass",
  });
}

function setupProject(tmp, { capturePath } = {}) {
  const stubPath = capturePath
    ? writeCapturingStubAgentScript(tmp, ".stub-agent.js", capturePath, passingScore())
    : writeStubAgentScript(tmp, ".stub-agent.js", passingScore());
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: stubAgentConfig(stubPath),
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });
  initGitRepo(tmp);
  commitAll(tmp, "initial");
}

function runCli(tmp, args) {
  return spawnSync("node", [CMD, ...args], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
  });
}

describe("e2e — phase-aware auto-check flow (spec 220)", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("e2e-auto-check-phase-");
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  // A8 — preparing phase 1: set init → run auto-check --run-id → set auto on --run-id
  it("preparing phase completes set init → run auto-check → set auto on with stub agent", () => {
    setupProject(tmp);

    const initRes = runCli(tmp, [
      "flow", "set", "init",
      "--issue", "237",
      "--request", "add a progress bar with bounded scope",
    ]);
    assert.equal(initRes.status, 0, initRes.stderr);
    const runId = JSON.parse(initRes.stdout.trim()).data.runId;
    assert.ok(runId);

    const checkRes = runCli(tmp, [
      "flow", "run", "auto-check",
      "--run-id", runId,
    ]);
    assert.equal(checkRes.status, 0, checkRes.stderr);
    const checkData = JSON.parse(checkRes.stdout.trim()).data;
    assert.equal(checkData.eligible, true);

    // set auto on trusts the persisted verdict
    const autoOn = runCli(tmp, [
      "flow", "set", "auto", "on",
      "--run-id", runId,
    ]);
    assert.equal(autoOn.status, 0, autoOn.stderr);
    const autoData = JSON.parse(autoOn.stdout.trim()).data;
    assert.equal(autoData.autoApprove, true);
  });

  // A8 companion — spec-approved phase: skip path short-circuits AI
  it("approval phase short-circuits auto-check (no agent call)", () => {
    const capturePath = path.join(tmp, ".stub-agent-called");
    setupProject(tmp, { capturePath });

    const specDir = path.join(tmp, "specs", "050-approved");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.md"), "# placeholder");
    const steps = buildInitialSteps().map((s) =>
      s.id === "approval" ? { ...s, status: "done" } : s,
    );
    makeFlowManager(tmp).save({
      spec: "specs/050-approved/spec.md",
      baseBranch: "main",
      featureBranch: "feature/050-approved",
      issue: 50,
      request: "implement feature X",
      steps,
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    });
    makeFlowManager(tmp).addActiveFlow("050-approved", "branch");

    const res = runCli(tmp, ["flow", "run", "auto-check"]);
    assert.equal(res.status, 0, res.stderr);
    const env = JSON.parse(res.stdout.trim());
    assert.equal(env.data.eligible, true);
    assert.equal(env.data.skipped, true);
    assert.equal(env.data.reason, "spec approved");
    assert.equal(fs.existsSync(capturePath), false, "AI must not be invoked");
  });
});
