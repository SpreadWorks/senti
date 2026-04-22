import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync, spawnSync } from "node:child_process";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import {
  writeStubAgentScript,
  writeCapturingStubAgentScript,
  stubAgentConfig,
} from "../../helpers/stub-agent.js";

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

  it("sets autoApprove on a preparing flow when no flow.json exists", () => {
    tmp = createTmpProject(passResponse());
    // Create a preparing flow (no flow.json)
    const fm = makeFlowManager(tmp);
    const runId = fm.generateRunId();
    fm.createPreparingFlow(runId, { request: "add a progress bar" });

    const res = runSetAuto(tmp, "on");
    assert.equal(res.status, 0, res.stderr);
    const output = JSON.parse(res.stdout.trim());
    assert.equal(output.ok, true);
    assert.equal(output.data.autoApprove, true);
    assert.equal(output.data.runId, runId);

    const preparing = fm.loadPreparingFlow(runId);
    assert.equal(preparing.autoApprove, true);
    assert.ok(preparing.autoCheck);
    assert.equal(preparing.autoCheck.eligible, true);
  });

  it("fails when no flow.json and multiple preparing flows exist without --run-id", () => {
    tmp = createTmpProject(passResponse());
    const fm = makeFlowManager(tmp);
    fm.createPreparingFlow(fm.generateRunId(), { request: "a" });
    fm.createPreparingFlow(fm.generateRunId(), { request: "b" });

    const res = runSetAuto(tmp, "on");
    assert.notEqual(res.status, 0);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.ok, false);
    assert.ok(
      envelope.errors?.some((e) => /multiple preparing/i.test(e.messages?.join(" ") ?? "")),
    );
  });

  it("targets a specific preparing flow via --run-id", () => {
    tmp = createTmpProject(passResponse());
    const fm = makeFlowManager(tmp);
    const runIdA = fm.generateRunId();
    const runIdB = fm.generateRunId();
    fm.createPreparingFlow(runIdA, { request: "add a progress bar" });
    fm.createPreparingFlow(runIdB, { request: "add a progress bar" });

    const script = path.resolve("src/sdd-forge.js");
    const res = spawnSync(
      "node",
      [script, "flow", "set", "auto", "on", "--run-id", runIdB],
      { encoding: "utf8", cwd: tmp, env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
    );
    assert.equal(res.status, 0, res.stderr);
    assert.equal(fm.loadPreparingFlow(runIdA).autoApprove, false);
    assert.equal(fm.loadPreparingFlow(runIdB).autoApprove, true);
  });

  it("skips auto-check when approval step is done (R1/R2)", () => {
    tmp = createTmpProject(lowResponse()); // would reject if auto-check ran
    const steps = buildInitialSteps();
    const approvalStep = steps.find((s) => s.id === "approval");
    approvalStep.status = "done";
    const state = {
      spec: "specs/001-test/spec.md",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      request: "reset password and run migration", // also hits static gate
      steps,
    };
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "branch");

    const res = runSetAuto(tmp, "on");
    assert.equal(res.status, 0, res.stderr);
    const output = JSON.parse(res.stdout.trim());
    assert.equal(output.ok, true);
    assert.equal(output.data.autoApprove, true);

    const saved = makeFlowManager(tmp).load();
    assert.equal(saved.autoApprove, true);
    assert.ok(saved.autoCheck, "autoCheck must be recorded");
    assert.equal(saved.autoCheck.skipped, true, "skipped marker must be true");
    assert.equal(saved.autoCheck.eligible, true);
  });

  it("uses draft.md as auto-check input when present and approval pending (R3/R4)", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-auto-draft-"));
    fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
    execFileSync("git", ["init", tmp], { stdio: "ignore" });

    const capturePath = path.join(tmp, "captured-prompt.txt");
    const stubPath = writeCapturingStubAgentScript(
      tmp,
      ".stub-agent.js",
      capturePath,
      passResponse(),
    );
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

    const DRAFT_MARKER = "UNIQUE_DRAFT_CONTENT_MARKER_QWERTY";
    fs.writeFileSync(
      path.join(tmp, "specs", "001-test", "draft.md"),
      `# Draft\n\n${DRAFT_MARKER}\n\nGoal: build feature X with bounded scope.\n`,
    );

    const steps = buildInitialSteps();
    const state = {
      spec: "specs/001-test/spec.md",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      request: "REQUEST_ONLY_MARKER_SHOULD_NOT_APPEAR",
      steps,
    };
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "branch");

    const res = runSetAuto(tmp, "on");
    assert.equal(res.status, 0, res.stderr);

    const captured = fs.readFileSync(capturePath, "utf8");
    assert.ok(captured.includes(DRAFT_MARKER), "auto-check prompt must include draft content");
    assert.ok(
      !captured.includes("REQUEST_ONLY_MARKER_SHOULD_NOT_APPEAR"),
      "auto-check prompt must not include original request when draft is used",
    );

    const saved = makeFlowManager(tmp).load();
    assert.equal(saved.autoApprove, true);
    assert.equal(saved.autoCheck.eligible, true);
    assert.notEqual(saved.autoCheck.skipped, true, "skipped must NOT be set on draft-input path");
  });

  it("falls back to request+issue input when approval pending and no draft.md (R5)", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-auto-fallback-"));
    fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
    execFileSync("git", ["init", tmp], { stdio: "ignore" });

    const capturePath = path.join(tmp, "captured-prompt.txt");
    const stubPath = writeCapturingStubAgentScript(
      tmp,
      ".stub-agent.js",
      capturePath,
      passResponse(),
    );
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

    const REQUEST_MARKER = "ORIGINAL_REQUEST_TEXT_MARKER_12345";
    const state = {
      spec: "specs/001-test/spec.md",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      request: `add a progress bar ${REQUEST_MARKER}`,
      steps: buildInitialSteps(),
    };
    makeFlowManager(tmp).save(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "branch");

    const res = runSetAuto(tmp, "on");
    assert.equal(res.status, 0, res.stderr);

    const captured = fs.readFileSync(capturePath, "utf8");
    assert.ok(
      captured.includes(REQUEST_MARKER),
      "auto-check prompt must include original request when no draft exists",
    );
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
