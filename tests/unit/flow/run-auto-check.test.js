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
  goal = "test goal",
  reason = "stub ok",
} = {}) {
  return JSON.stringify({
    specBuildability,
    ambiguity,
    verifiability,
    scopeBoundedness,
    targetSpecificity,
    precedent,
    goal,
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

function seedFlowState(tmp, { request = "add a progress bar with bounded scope" } = {}) {
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
  makeFlowManager(tmp).save({
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    request,
    steps: buildInitialSteps(),
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
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

function runAutoCheck(tmp, { aiOverrides, request } = {}) {
  setupProject(tmp, aiOverrides ? { aiResponse: stubResponse(aiOverrides) } : undefined);
  seedFlowState(tmp, request ? { request } : undefined);
  const res = runCli(tmp, ["flow", "run", "auto-check"]);
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(res.stdout.trim());
}

describe("flow run auto-check CLI", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("auto-check-");
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  it("returns eligible:true with passing scores (input derived from flow state)", () => {
    const envelope = runAutoCheck(tmp);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.eligible, true);
    assert.equal(envelope.data.maxScore, 24);
    assert.equal(envelope.data.threshold, 16);
    assert.ok("specBuildability" in envelope.data.breakdown);
    assert.ok("ambiguity" in envelope.data.breakdown);
    assert.deepEqual(envelope.data.staticGates, { G: false, H: false, I: false });
  });

  it("returns eligible:false and skips AI when static gate G hits", () => {
    const envelope = runAutoCheck(tmp, { request: "reset admin password in migration" });
    assert.equal(envelope.data.eligible, false);
    assert.equal(envelope.data.staticGates.G, true);
  });

  it("returns eligible:true when single hard-gate key is 0 but sum ≥ 2 (staged gate)", () => {
    const envelope = runAutoCheck(tmp, { aiOverrides: { verifiability: 0 }, request: "vague idea" });
    assert.equal(envelope.data.eligible, true);
  });

  it("returns eligible:false with hard-gate when sum ≤ 1", () => {
    const envelope = runAutoCheck(tmp, { aiOverrides: { specBuildability: 0, ambiguity: 0, verifiability: 1 }, request: "vague idea" });
    assert.equal(envelope.data.eligible, false);
  });

  it("returns eligible:false when total score below threshold", () => {
    const envelope = runAutoCheck(tmp, {
      aiOverrides: { specBuildability: 1, ambiguity: 1, verifiability: 1, scopeBoundedness: 1, targetSpecificity: 0, precedent: 0 },
      request: "x",
    });
    assert.equal(envelope.data.eligible, false);
    assert.ok(envelope.data.score < envelope.data.threshold);
  });

  it("persists result to flow.json autoCheck field when active flow exists", () => {
    setupProject(tmp);
    seedFlowState(tmp);
    runCli(tmp, ["flow", "run", "auto-check"]);
    const state = makeFlowManager(tmp).load();
    assert.ok(state.autoCheck, "autoCheck should be saved");
    assert.equal(state.autoCheck.eligible, true);
    assert.equal(state.autoCheck.maxScore, 24);
  });

  it("does not persist autoCheck when eligible:false (spec 232 R5)", () => {
    setupProject(tmp);
    seedFlowState(tmp, { request: "password migration release" });
    runCli(tmp, ["flow", "run", "auto-check"]);
    const state = makeFlowManager(tmp).load();
    assert.equal(state.autoCheck, undefined, "autoCheck must not be persisted for failed verdict (spec 232)");
  });

  // Spec 218: run auto-check must persist the verdict to the preparing flow
  // state file as well, so that a subsequent `flow set auto on --run-id <id>`
  // can trust the result instead of re-invoking the agent with a different
  // (thinner) input.
  it("persists autoCheck to preparing flow state when --run-id is provided", () => {
    setupProject(tmp);
    const fm = makeFlowManager(tmp);
    const runId = fm.generateRunId();
    fm.createPreparingFlow(runId, { issue: 230, request: "add a progress bar with bounded scope" });

    const res = runCli(tmp, [
      "flow", "run", "auto-check",
      "--run-id", runId,
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
    fm.createPreparingFlow(runIdA, { issue: 1, request: "add a progress bar with bounded scope" });
    fm.createPreparingFlow(runIdB, { issue: 2, request: "add a progress bar with bounded scope" });

    const res = runCli(tmp, [
      "flow", "run", "auto-check",
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
