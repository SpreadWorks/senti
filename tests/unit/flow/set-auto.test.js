import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync, spawnSync } from "node:child_process";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { writeStubAgentScript, stubAgentConfig } from "../../helpers/stub-agent.js";

function passResponse() {
  return JSON.stringify({
    specBuildability: 2,
    ambiguity: 2,
    verifiability: 2,
    scopeBoundedness: 2,
    targetSpecificity: 1,
    precedent: 1,
    reason: "stub pass",
  });
}

function lowResponse() {
  return JSON.stringify({
    specBuildability: 1,
    ambiguity: 0,
    verifiability: 1,
    scopeBoundedness: 1,
    targetSpecificity: 0,
    precedent: 0,
    reason: "stub low",
  });
}

function createTmpProject(agentResponse = passResponse()) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-auto-"));
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

function createFlowState(tmp, request = "add a progress bar") {
  const state = {
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    request,
    steps: buildInitialSteps(),
  };
  makeFlowManager(tmp).save(state);
  makeFlowManager(tmp).addActiveFlow("001-test", "branch");
}

function runSetAuto(tmp, value) {
  const script = path.resolve("src/sdd-forge.js");
  const args = ["flow", "set", "auto"];
  if (value !== undefined) args.push(value);
  return spawnSync("node", [script, ...args], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
  });
}

describe("flow set auto", () => {
  let tmp;

  afterEach(() => {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("sets autoApprove to true with 'on' when auto-check is eligible", () => {
    tmp = createTmpProject(passResponse());
    createFlowState(tmp);
    const res = runSetAuto(tmp, "on");
    assert.equal(res.status, 0, res.stderr);
    const output = JSON.parse(res.stdout.trim());
    assert.equal(output.ok, true);
    assert.equal(output.data.autoApprove, true);
    const state = makeFlowManager(tmp).load();
    assert.equal(state.autoApprove, true);
    assert.ok(state.autoCheck, "autoCheck must be recorded");
    assert.equal(state.autoCheck.eligible, true);
  });

  it("rejects 'on' with non-zero exit when auto-check is ineligible (AI scores)", () => {
    tmp = createTmpProject(lowResponse());
    createFlowState(tmp);
    const res = runSetAuto(tmp, "on");
    assert.notEqual(res.status, 0);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.ok, false);
    assert.ok(
      envelope.errors?.some((e) => /auto-check|reject|eligible/i.test(e.messages?.join(" ") ?? "")),
      "envelope must include reject reason",
    );
    const state = makeFlowManager(tmp).load();
    assert.notEqual(state.autoApprove, true, "autoApprove must not be updated on reject");
    assert.ok(state.autoCheck);
    assert.equal(state.autoCheck.eligible, false);
  });

  it("rejects 'on' when static gate hits (no AI needed)", () => {
    tmp = createTmpProject(passResponse());
    createFlowState(tmp, "reset password and run migration");
    const res = runSetAuto(tmp, "on");
    assert.notEqual(res.status, 0);
    const state = makeFlowManager(tmp).load();
    assert.notEqual(state.autoApprove, true);
    assert.equal(state.autoCheck.staticGates.G, true);
  });

  it("sets autoApprove to false with 'off' without running auto-check", () => {
    tmp = createTmpProject(passResponse());
    createFlowState(tmp);
    runSetAuto(tmp, "on");
    const res = runSetAuto(tmp, "off");
    assert.equal(res.status, 0, res.stderr);
    const output = JSON.parse(res.stdout.trim());
    assert.equal(output.ok, true);
    assert.equal(output.data.autoApprove, false);
  });

  it("fails without argument", () => {
    tmp = createTmpProject();
    createFlowState(tmp);
    const res = runSetAuto(tmp, undefined);
    assert.notEqual(res.status, 0);
    const output = JSON.parse(res.stdout.trim());
    assert.equal(output.ok, false);
  });
});
