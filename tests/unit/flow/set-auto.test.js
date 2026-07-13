import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync, spawnSync } from "node:child_process";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
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
    goal: "add a progress bar",
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
    goal: "add a progress bar",
    reason: "stub low",
  });
}

function createTmpProject(agentResponse = passResponse()) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-auto-"));
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

function createFlowState(tmp, request = "add a progress bar") {
  const state = {
    spec: "specs/001-test/spec.json",
    runId: "run-001-test",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    request,
    steps: buildInitialSteps(),
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
  };
  makeFlowManager(tmp).create(state);
  makeFlowManager(tmp).addActiveFlow("001-test", "branch");
}

function runSetAuto(tmp, value, extraArgs = []) {
  const script = path.resolve("src/senti.js");
  const args = ["flow", "set", "auto"];
  if (value !== undefined) args.push(value);
  args.push(...extraArgs);
  return spawnSync("node", [script, ...args], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
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
    assert.equal(state.autoCheck, undefined, "autoCheck must not be persisted for failed verdict (spec 232)");
  });

  it("rejects 'on' when static gate hits (no AI needed)", () => {
    tmp = createTmpProject(passResponse());
    createFlowState(tmp, "reset password and run migration");
    const res = runSetAuto(tmp, "on");
    assert.notEqual(res.status, 0);
    const state = makeFlowManager(tmp).load();
    assert.notEqual(state.autoApprove, true);
    assert.equal(state.autoCheck, undefined, "autoCheck must not be persisted for failed verdict (spec 232)");
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

    const res = runSetAuto(tmp, "on", ["--run-id", runId]);
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

  it("fails with MISSING_RUN_ID when no flow.json and preparing flows exist without --run-id (spec 220)", () => {
    tmp = createTmpProject(passResponse());
    const fm = makeFlowManager(tmp);
    fm.createPreparingFlow(fm.generateRunId(), { request: "a" });
    fm.createPreparingFlow(fm.generateRunId(), { request: "b" });

    const res = runSetAuto(tmp, "on");
    assert.notEqual(res.status, 0);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.ok, false);
    const codes = (envelope.errors || []).map((e) => e.code);
    assert.ok(
      codes.includes("MISSING_RUN_ID"),
      `expected MISSING_RUN_ID, got ${codes.join(",")}`,
    );
  });

  it("fails with MISSING_RUN_ID even when only one preparing exists (spec 220 — no auto-select)", () => {
    tmp = createTmpProject(passResponse());
    const fm = makeFlowManager(tmp);
    fm.createPreparingFlow(fm.generateRunId(), { request: "sole" });

    const res = runSetAuto(tmp, "on");
    assert.notEqual(res.status, 0);
    const envelope = JSON.parse(res.stdout.trim());
    const codes = (envelope.errors || []).map((e) => e.code);
    assert.ok(
      codes.includes("MISSING_RUN_ID"),
      `expected MISSING_RUN_ID for single preparing, got ${codes.join(",")}`,
    );
  });

  it("targets a specific preparing flow via --run-id", () => {
    tmp = createTmpProject(passResponse());
    const fm = makeFlowManager(tmp);
    const runIdA = fm.generateRunId();
    const runIdB = fm.generateRunId();
    fm.createPreparingFlow(runIdA, { request: "add a progress bar" });
    fm.createPreparingFlow(runIdB, { request: "add a progress bar" });

    const script = path.resolve("src/senti.js");
    const res = spawnSync(
      "node",
      [script, "flow", "set", "auto", "on", "--run-id", runIdB],
      { encoding: "utf8", cwd: tmp, env: { ...process.env, SENTI_WORK_ROOT: tmp } },
    );
    assert.equal(res.status, 0, res.stderr);
    assert.equal(fm.loadPreparingFlow(runIdA).autoApprove, false);
    assert.equal(fm.loadPreparingFlow(runIdB).autoApprove, true);
  });

  it("skips auto-check when approval step is done (R1/R2)", () => {
    tmp = createTmpProject(lowResponse()); // would reject if auto-check ran
    const steps = buildInitialSteps();
    const approvalStep = findStepById(steps, "approval");
    approvalStep.status = "done";
    const state = {
      spec: "specs/001-test/spec.json",
      runId: "run-001-test",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      request: "reset password and run migration", // also hits static gate
      steps,
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(tmp).create(state);
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

  it("appends draft.json to auto-check input when draft-gate done (spec 220)", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-auto-draft-"));
    fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
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
      path.join(tmp, ".senti", "config.json"),
      JSON.stringify({
        lang: "ja",
        type: "base",
        docs: { languages: ["ja"], defaultLanguage: "ja" },
        agent: stubAgentConfig(stubPath),
      }),
    );
    fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "fixture" }));

    const DRAFT_MARKER = "UNIQUE_DRAFT_CONTENT_MARKER_QWERTY";
    const REQUEST_MARKER = "REQUEST_MARKER_APPENDED_ALONGSIDE_DRAFT";
    fs.writeFileSync(
      path.join(tmp, "specs", "001-test", "draft.json"),
      JSON.stringify({ devType: "feature", goal: DRAFT_MARKER, analysis: { problem: "p", proposedApproach: "a", validation: "v" }, qa: [], approval: { approved: true } }),
    );

    // Mark draft-gate done (phase 2) per spec 220
    const steps = buildInitialSteps();
    findStepById(steps, "draft-gate").status = "done";
    const state = {
      spec: "specs/001-test/spec.json",
      runId: "run-001-test",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      request: REQUEST_MARKER,
      steps,
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(tmp).create(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "branch");

    const res = runSetAuto(tmp, "on");
    assert.equal(res.status, 0, res.stderr);

    const captured = fs.readFileSync(capturePath, "utf8");
    assert.ok(captured.includes(DRAFT_MARKER), "auto-check prompt must include draft content");
    assert.ok(
      captured.includes(REQUEST_MARKER),
      "spec 220: request must be included alongside draft (not replaced)",
    );

    const saved = makeFlowManager(tmp).load();
    assert.equal(saved.autoApprove, true);
    assert.equal(saved.autoCheck.eligible, true);
    assert.deepEqual(saved.autoCheck.goalGate, { checked: true, passed: true });
    assert.notEqual(saved.autoCheck.skipped, true, "skipped must NOT be set on draft-input path");
  });

  it("rejects auto mode when draft-gate is done but draft goal is missing", () => {
    tmp = createTmpProject(passResponse());
    fs.writeFileSync(
      path.join(tmp, "specs", "001-test", "draft.json"),
      JSON.stringify({
        devType: "feature",
        goal: "",
        analysis: { problem: "p", proposedApproach: "a", validation: "v" },
        qa: [],
        approval: { approved: true },
      }),
    );
    const steps = buildInitialSteps();
    findStepById(steps, "draft-gate").status = "done";
    makeFlowManager(tmp).create({
      spec: "specs/001-test/spec.json",
      runId: "run-001-test",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      request: "add a progress bar",
      steps,
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    });
    makeFlowManager(tmp).addActiveFlow("001-test", "branch");

    const res = runSetAuto(tmp, "on");
    assert.notEqual(res.status, 0);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.ok, false);
    assert.match(JSON.stringify(envelope), /draft goal is missing/);
    const saved = makeFlowManager(tmp).load();
    assert.notEqual(saved.autoApprove, true);
    assert.equal(saved.autoCheck, undefined);
  });

  it("falls back to request+issue input when approval pending and no draft.json (R5)", () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "set-auto-fallback-"));
    fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
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
      path.join(tmp, ".senti", "config.json"),
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
      spec: "specs/001-test/spec.json",
      runId: "run-001-test",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      request: `add a progress bar ${REQUEST_MARKER}`,
      steps: buildInitialSteps(),
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(tmp).create(state);
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

  describe("PREPARING_FLOW_NOT_FOUND for unknown --run-id", () => {
    function createCapturingFixture(prefix) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
      fs.mkdirSync(path.join(dir, ".senti"), { recursive: true });
      execFileSync("git", ["init", dir], { stdio: "ignore" });
      const capturePath = path.join(dir, "captured-prompt.txt");
      const stubPath = writeCapturingStubAgentScript(
        dir,
        ".stub-agent.js",
        capturePath,
        passResponse(),
      );
      fs.writeFileSync(
        path.join(dir, ".senti", "config.json"),
        JSON.stringify({
          lang: "ja",
          type: "base",
          docs: { languages: ["ja"], defaultLanguage: "ja" },
          agent: stubAgentConfig(stubPath),
        }),
      );
      fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "fixture" }));
      return { dir, capturePath };
    }

    function runSetAutoWithRunId(dir, value, runId) {
      const script = path.resolve("src/senti.js");
      return spawnSync(
        "node",
        [script, "flow", "set", "auto", value, "--run-id", runId],
        { encoding: "utf8", cwd: dir, env: { ...process.env, SENTI_WORK_ROOT: dir } },
      );
    }

    it("fails for 'on' without invoking AI", () => {
      const fixture = createCapturingFixture("set-auto-notfound-on-");
      tmp = fixture.dir;
      const nonexistent = "00000000-0000-0000-0000-000000000000";
      const res = runSetAutoWithRunId(tmp, "on", nonexistent);
      assert.notEqual(res.status, 0);
      const envelope = JSON.parse(res.stdout.trim());
      assert.equal(envelope.ok, false);
      assert.ok(
        envelope.errors?.some((e) => e.code === "PREPARING_FLOW_NOT_FOUND"),
        "envelope must include PREPARING_FLOW_NOT_FOUND code",
      );
      assert.ok(
        envelope.errors?.some((e) => (e.messages?.join(" ") ?? "").includes(nonexistent)),
        "envelope message must include the offending runId",
      );
      assert.equal(
        fs.existsSync(fixture.capturePath),
        false,
        "AI agent must not be invoked when --run-id does not exist",
      );
    });

    it("fails for 'off' without invoking AI", () => {
      const fixture = createCapturingFixture("set-auto-notfound-off-");
      tmp = fixture.dir;
      const nonexistent = "11111111-1111-1111-1111-111111111111";
      const res = runSetAutoWithRunId(tmp, "off", nonexistent);
      assert.notEqual(res.status, 0);
      const envelope = JSON.parse(res.stdout.trim());
      assert.equal(envelope.ok, false);
      assert.ok(
        envelope.errors?.some((e) => e.code === "PREPARING_FLOW_NOT_FOUND"),
        "envelope must include PREPARING_FLOW_NOT_FOUND code",
      );
      assert.equal(
        fs.existsSync(fixture.capturePath),
        false,
        "AI agent must not be invoked for 'off' path",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Spec 218: Trust previously persisted autoCheck instead of re-invoking the AI.
  // The split-brain between `run auto-check` (rich input) and `set auto on`
  // (thin input rebuild) is resolved by making `set auto on` trust whatever
  // verdict is already in state. These tests assert the trust path on both
  // preparing and active flows, the rejection-on-trust path, and that the
  // fallback (no verdict present) still invokes the agent.
  // ---------------------------------------------------------------------------

  function createCapturingProject() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "set-auto-trust-"));
    fs.mkdirSync(path.join(dir, ".senti"), { recursive: true });
    fs.mkdirSync(path.join(dir, "specs", "001-test"), { recursive: true });
    execFileSync("git", ["init", dir], { stdio: "ignore" });
    const capturePath = path.join(dir, "captured-prompt.txt");
    const stubPath = writeCapturingStubAgentScript(
      dir,
      ".stub-agent.js",
      capturePath,
      passResponse(),
    );
    fs.writeFileSync(
      path.join(dir, ".senti", "config.json"),
      JSON.stringify({
        lang: "ja",
        type: "base",
        docs: { languages: ["ja"], defaultLanguage: "ja" },
        agent: stubAgentConfig(stubPath),
      }),
    );
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "fixture" }));
    return { dir, capturePath };
  }

  it("trusts persisted autoCheck on preparing flow without re-invoking the agent", () => {
    const { dir, capturePath } = createCapturingProject();
    tmp = dir;
    const fm = makeFlowManager(tmp);
    const runId = fm.generateRunId();
    fm.createPreparingFlow(runId, { issue: 230 });
    fm.mutatePreparingFlow(runId, (s) => {
      s.autoCheck = {
        eligible: true,
        score: 20,
        maxScore: 24,
        threshold: 18,
        breakdown: {},
        staticGates: { G: false, H: false, I: false },
        goalGate: { checked: true, passed: true },
        reason: "persisted by run auto-check",
      };
    });

    const res = runSetAuto(tmp, "on", ["--run-id", runId]);
    assert.equal(res.status, 0, res.stderr);
    const output = JSON.parse(res.stdout.trim());
    assert.equal(output.ok, true);
    assert.equal(output.data.autoApprove, true);

    assert.equal(
      fs.existsSync(capturePath),
      false,
      "agent must not be invoked when a verdict is already persisted",
    );

    const preparing = fm.loadPreparingFlow(runId);
    assert.equal(preparing.autoApprove, true);
    assert.equal(preparing.autoCheck.reason, "persisted by run auto-check");
  });

  it("rejects persisted autoCheck on preparing flow without re-invoking the agent (eligible:false)", () => {
    const { dir, capturePath } = createCapturingProject();
    tmp = dir;
    const fm = makeFlowManager(tmp);
    const runId = fm.generateRunId();
    fm.createPreparingFlow(runId, { issue: 230 });
    fm.mutatePreparingFlow(runId, (s) => {
      s.autoCheck = {
        eligible: false,
        score: 4,
        maxScore: 24,
        threshold: 18,
        breakdown: {},
        staticGates: { G: false, H: false, I: false },
        goalGate: { checked: true, passed: false },
        reason: "persisted ineligible",
      };
    });

    const res = runSetAuto(tmp, "on", ["--run-id", runId]);
    assert.notEqual(res.status, 0);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.ok, false);
    assert.ok(
      envelope.errors?.some((e) => /AUTO_CHECK_INELIGIBLE/.test(e.code ?? "")),
      "envelope must signal AUTO_CHECK_INELIGIBLE",
    );

    assert.equal(
      fs.existsSync(capturePath),
      false,
      "agent must not be invoked when a verdict is already persisted",
    );

    const preparing = fm.loadPreparingFlow(runId);
    assert.notEqual(preparing.autoApprove, true);
    assert.equal(preparing.autoCheck.reason, "persisted ineligible");
  });

  it("trusts persisted autoCheck on active flow without re-invoking the agent", () => {
    const { dir, capturePath } = createCapturingProject();
    tmp = dir;
    const state = {
      spec: "specs/001-test/spec.json",
      runId: "run-001-test",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      request: "add a progress bar",
      steps: buildInitialSteps(),
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
      autoCheck: {
        eligible: true,
        score: 20,
        maxScore: 24,
        threshold: 18,
        breakdown: {},
        staticGates: { G: false, H: false, I: false },
        goalGate: { checked: true, passed: true },
        reason: "persisted by run auto-check",
      },
    };
    makeFlowManager(tmp).create(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "branch");

    const res = runSetAuto(tmp, "on");
    assert.equal(res.status, 0, res.stderr);
    const output = JSON.parse(res.stdout.trim());
    assert.equal(output.ok, true);
    assert.equal(output.data.autoApprove, true);

    assert.equal(
      fs.existsSync(capturePath),
      false,
      "agent must not be invoked when a verdict is already persisted",
    );

    const saved = makeFlowManager(tmp).load();
    assert.equal(saved.autoApprove, true);
    assert.equal(saved.autoCheck.reason, "persisted by run auto-check");
  });

  it("rejects legacy persisted autoCheck without a passing goalGate marker", () => {
    const { dir, capturePath } = createCapturingProject();
    tmp = dir;
    const state = {
      spec: "specs/001-test/spec.json",
      runId: "run-001-test",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      request: "add a progress bar",
      steps: buildInitialSteps(),
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
      autoCheck: {
        eligible: true,
        score: 20,
        maxScore: 24,
        threshold: 18,
        breakdown: {},
        staticGates: { G: false, H: false, I: false },
        reason: "legacy persisted by run auto-check",
      },
    };
    makeFlowManager(tmp).create(state);
    makeFlowManager(tmp).addActiveFlow("001-test", "branch");

    const res = runSetAuto(tmp, "on");
    assert.notEqual(res.status, 0);
    const envelope = JSON.parse(res.stdout.trim());
    assert.equal(envelope.ok, false);
    assert.ok(
      envelope.errors?.some((e) => /AUTO_CHECK_INELIGIBLE/.test(e.code ?? "")),
      "envelope must signal AUTO_CHECK_INELIGIBLE",
    );
    assert.match(
      JSON.stringify(envelope),
      /missing a passing goalGate marker/,
      "legacy verdict must not be trusted without goalGate evidence",
    );

    assert.equal(
      fs.existsSync(capturePath),
      false,
      "agent must not be invoked when a persisted verdict is rejected",
    );

    const saved = makeFlowManager(tmp).load();
    assert.notEqual(saved.autoApprove, true);
  });

  it("falls back to agent invocation on preparing flow when no autoCheck is persisted", () => {
    const { dir, capturePath } = createCapturingProject();
    tmp = dir;
    const fm = makeFlowManager(tmp);
    const runId = fm.generateRunId();
    fm.createPreparingFlow(runId, { request: "add a progress bar" });

    const res = runSetAuto(tmp, "on", ["--run-id", runId]);
    assert.equal(res.status, 0, res.stderr);
    const output = JSON.parse(res.stdout.trim());
    assert.equal(output.ok, true);
    assert.equal(output.data.autoApprove, true);

    assert.ok(
      fs.existsSync(capturePath),
      "agent must be invoked when no verdict is persisted (fallback path)",
    );

    const preparing = fm.loadPreparingFlow(runId);
    assert.equal(preparing.autoApprove, true);
    assert.ok(preparing.autoCheck);
    assert.equal(preparing.autoCheck.eligible, true);
  });
});
