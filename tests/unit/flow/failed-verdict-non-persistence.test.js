import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync, spawnSync } from "node:child_process";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import {
  writeStubAgentScript,
  stubAgentConfig,
} from "../../helpers/stub-agent.js";

function lowResponse() {
  return JSON.stringify({
    specBuildability: 1,
    ambiguity: 0,
    verifiability: 1,
    scopeBoundedness: 1,
    targetSpecificity: 0,
    precedent: 0,
    goal: "test goal",
    reason: "stub low",
  });
}

function passResponse() {
  return JSON.stringify({
    specBuildability: 2,
    ambiguity: 2,
    verifiability: 2,
    scopeBoundedness: 2,
    targetSpecificity: 1,
    precedent: 1,
    goal: "test goal",
    reason: "stub pass",
  });
}

function createTmpProject(agentResponse) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verdict-persist-"));
  fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
  execFileSync("git", ["init", tmp], { stdio: "ignore" });

  const stubPath = writeStubAgentScript(tmp, ".stub-agent.js", agentResponse);
  fs.writeFileSync(
    path.join(tmp, ".sdd-forge", "config.json"),
    JSON.stringify({
      lang: "ja",
      type: "base",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      agent: stubAgentConfig(stubPath),
    }),
  );
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "fixture" }));
  return tmp;
}

function createFlowState(tmp, extra = {}) {
  const state = {
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    request: "add a progress bar",
    steps: buildInitialSteps(),
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
    ...extra,
  };
  makeFlowManager(tmp).save(state);
  makeFlowManager(tmp).addActiveFlow("001-test", "branch");
}

function runCmd(tmp, ...args) {
  const script = path.resolve("src/sdd-forge.js");
  return spawnSync("node", [script, ...args], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
  });
}

describe("spec 232: failed verdict non-persistence (R5)", () => {
  let tmp;
  afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

  it("does not persist autoCheck when set auto on is rejected (AC6)", () => {
    tmp = createTmpProject(lowResponse());
    createFlowState(tmp);
    runCmd(tmp, "flow", "set", "auto", "on");
    const state = makeFlowManager(tmp).load();
    assert.equal(state.autoCheck, undefined, "autoCheck must not be persisted for failed verdict");
  });

  it("persists autoCheck when set auto on is accepted", () => {
    tmp = createTmpProject(passResponse());
    createFlowState(tmp);
    runCmd(tmp, "flow", "set", "auto", "on");
    const state = makeFlowManager(tmp).load();
    assert.ok(state.autoCheck, "autoCheck must be persisted for eligible verdict");
    assert.equal(state.autoCheck.eligible, true);
  });

  it("does not persist autoCheck when run auto-check returns ineligible (AC6)", () => {
    tmp = createTmpProject(lowResponse());
    createFlowState(tmp);
    runCmd(tmp, "flow", "run", "auto-check");
    const state = makeFlowManager(tmp).load();
    assert.equal(state.autoCheck, undefined, "autoCheck must not be persisted for failed run auto-check");
  });

  it("persists autoCheck when run auto-check returns eligible", () => {
    tmp = createTmpProject(passResponse());
    createFlowState(tmp);
    runCmd(tmp, "flow", "run", "auto-check");
    const state = makeFlowManager(tmp).load();
    assert.ok(state.autoCheck, "autoCheck must be persisted for eligible run auto-check");
    assert.equal(state.autoCheck.eligible, true);
  });
});
