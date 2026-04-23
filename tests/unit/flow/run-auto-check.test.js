import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../helpers/git-repo.js";
import { writeStubAgentScript, stubAgentConfig } from "../../helpers/stub-agent.js";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";

const CMD = path.join(process.cwd(), "src/sdd-forge.js");

function stubResponse({
  specBuildability = 2,
  ambiguity = 2,
  verifiability = 2,
  scopeBoundedness = 2,
  targetSpecificity = 1,
  precedent = 1,
  reason = "stub ok",
} = {}) {
  return JSON.stringify({
    specBuildability,
    ambiguity,
    verifiability,
    scopeBoundedness,
    targetSpecificity,
    precedent,
    reason,
  });
}

function setupProject(tmp, { aiResponse } = {}) {
  const stubPath = writeStubAgentScript(tmp, ".stub-agent.js", aiResponse ?? stubResponse());
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

function seedFlowState(tmp) {
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
  makeFlowManager(tmp).save({
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    request: "add a progress bar",
    steps: buildInitialSteps(),
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

describe("flow run auto-check CLI", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("auto-check-");
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  it("returns eligible:true with passing scores", () => {
    setupProject(tmp);
    seedFlowState(tmp);
    const res = runCli(tmp, ["flow", "run", "auto-check", "--input", "add a progress bar"]);
    assert.equal(res.status, 0, res.stderr);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.eligible, true);
    assert.equal(envelope.data.maxScore, 24);
    assert.equal(envelope.data.threshold, 18);
    assert.ok("specBuildability" in envelope.data.breakdown);
    assert.ok("ambiguity" in envelope.data.breakdown);
    assert.deepEqual(envelope.data.staticGates, { G: false, H: false, I: false });
  });

  it("returns eligible:false and skips AI when static gate G hits", () => {
    setupProject(tmp);
    seedFlowState(tmp);
    const res = runCli(tmp, [
      "flow", "run", "auto-check",
      "--input", "reset admin password in migration",
    ]);
    assert.equal(res.status, 0, res.stderr);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.data.eligible, false);
    assert.equal(envelope.data.staticGates.G, true);
  });

  it("returns eligible:false with hard-gate when verifiability is 0", () => {
    setupProject(tmp, { aiResponse: stubResponse({ verifiability: 0 }) });
    seedFlowState(tmp);
    const res = runCli(tmp, ["flow", "run", "auto-check", "--input", "vague idea"]);
    assert.equal(res.status, 0, res.stderr);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.data.eligible, false);
  });

  it("returns eligible:false when total score below threshold", () => {
    setupProject(tmp, {
      aiResponse: stubResponse({
        specBuildability: 1,
        ambiguity: 1,
        verifiability: 1,
        scopeBoundedness: 1,
        targetSpecificity: 0,
        precedent: 0,
      }),
    });
    seedFlowState(tmp);
    const res = runCli(tmp, ["flow", "run", "auto-check", "--input", "x"]);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.data.eligible, false);
    assert.ok(envelope.data.score < envelope.data.threshold);
  });

  it("persists result to flow.json autoCheck field when active flow exists", () => {
    setupProject(tmp);
    seedFlowState(tmp);
    runCli(tmp, ["flow", "run", "auto-check", "--input", "add a progress bar"]);
    const state = makeFlowManager(tmp).load();
    assert.ok(state.autoCheck, "autoCheck should be saved");
    assert.equal(state.autoCheck.eligible, true);
    assert.equal(state.autoCheck.maxScore, 24);
  });

  it("persists autoCheck even when eligible:false (audit-friendly)", () => {
    setupProject(tmp);
    seedFlowState(tmp);
    runCli(tmp, ["flow", "run", "auto-check", "--input", "password migration release"]);
    const state = makeFlowManager(tmp).load();
    assert.ok(state.autoCheck);
    assert.equal(state.autoCheck.eligible, false);
    assert.equal(state.autoCheck.staticGates.G, true);
  });

  // Spec 218: run auto-check must persist the verdict to the preparing flow
  // state file as well, so that a subsequent `flow set auto on --run-id <id>`
  // can trust the result instead of re-invoking the agent with a different
  // (thinner) input.
  it("persists autoCheck to preparing flow state when no active flow exists", () => {
    setupProject(tmp);
    const fm = makeFlowManager(tmp);
    const runId = fm.generateRunId();
    fm.createPreparingFlow(runId, { issue: 230 });

    const res = runCli(tmp, [
      "flow", "run", "auto-check",
      "--input", "add a progress bar with bounded scope",
    ]);
    assert.equal(res.status, 0, res.stderr);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.data.eligible, true);

    const preparing = fm.loadPreparingFlow(runId);
    assert.ok(preparing.autoCheck, "autoCheck must be persisted to preparing state");
    assert.equal(preparing.autoCheck.eligible, true);
    assert.equal(preparing.autoCheck.maxScore, 24);
    assert.notEqual(preparing.autoApprove, true, "autoApprove must not be set by auto-check alone");
  });

  it("persists autoCheck to the --run-id-targeted preparing flow", () => {
    setupProject(tmp);
    const fm = makeFlowManager(tmp);
    const runIdA = fm.generateRunId();
    const runIdB = fm.generateRunId();
    fm.createPreparingFlow(runIdA, { issue: 1 });
    fm.createPreparingFlow(runIdB, { issue: 2 });

    const res = runCli(tmp, [
      "flow", "run", "auto-check",
      "--input", "add a progress bar with bounded scope",
      "--run-id", runIdB,
    ]);
    assert.equal(res.status, 0, res.stderr);

    const a = fm.loadPreparingFlow(runIdA);
    const b = fm.loadPreparingFlow(runIdB);
    assert.equal(a.autoCheck, undefined, "non-targeted preparing flow must remain untouched");
    assert.ok(b.autoCheck, "targeted preparing flow must receive the verdict");
    assert.equal(b.autoCheck.eligible, true);
  });
});
