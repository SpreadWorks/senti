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

function createTmpProject(agentResponse = lowResponse()) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "auto-desired-"));
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
  execFileSync("git", ["init", tmp], { stdio: "ignore" });

  const stubPath = writeStubAgentScript(tmp, ".stub-agent.js", agentResponse);
  fs.writeFileSync(
    path.join(tmp, ".senti", "config.json"),
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
    spec: "specs/001-test/spec.json",
    runId: "run-001-test",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    request: "add a progress bar",
    steps: buildInitialSteps(),
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
    ...extra,
  };
  makeFlowManager(tmp).create(state);
  makeFlowManager(tmp).addActiveFlow("001-test", "branch");
}

function runSetAuto(tmp, value) {
  const script = path.resolve("src/senti.js");
  const args = ["flow", "set", "auto", value];
  return spawnSync("node", [script, ...args], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
}

describe("spec 232: autoDesired persistence (R1)", () => {
  let tmp;
  afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

  it("persists autoDesired=true when set auto on is rejected (AC1)", () => {
    tmp = createTmpProject(lowResponse());
    createFlowState(tmp);
    const res = runSetAuto(tmp, "on");
    assert.notEqual(res.status, 0, "should exit non-zero on reject");
    const state = makeFlowManager(tmp).load();
    assert.equal(state.autoDesired, true, "autoDesired must be true after reject");
  });

  it("sets autoDesired=false when set auto off is called (AC2)", () => {
    tmp = createTmpProject(passResponse());
    createFlowState(tmp, { autoDesired: true });
    const res = runSetAuto(tmp, "off");
    assert.equal(res.status, 0, res.stderr);
    const state = makeFlowManager(tmp).load();
    assert.equal(state.autoDesired, false, "autoDesired must be false after off");
  });

  it("persists autoDesired=true in preparing mode when rejected (AC8)", () => {
    tmp = createTmpProject(lowResponse());
    const fm = makeFlowManager(tmp);
    const runId = fm.generateRunId();
    fm.createPreparingFlow(runId, { request: "add a progress bar" });

    const script = path.resolve("src/senti.js");
    const res = spawnSync("node", [script, "flow", "set", "auto", "on", "--run-id", runId], {
      encoding: "utf8",
      cwd: tmp,
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });
    assert.notEqual(res.status, 0, "should exit non-zero on reject");
    const preparing = fm.loadPreparingFlow(runId);
    assert.equal(preparing.autoDesired, true, "autoDesired must be true in preparing state");
  });
});
