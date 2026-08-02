import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync, spawnSync } from "node:child_process";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { writeStubAgentScript, stubAgentConfig } from "../../helpers/stub-agent.js";

const SENTI = path.resolve("src/senti.js");

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function lowAutoCheckResponse() {
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

function createTmpProject(agentResponse) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "throw-env-"));
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
  execFileSync("git", ["init", tmp], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });

  const stubPath = agentResponse
    ? writeStubAgentScript(tmp, ".stub-agent.js", agentResponse)
    : null;
  fs.writeFileSync(
    path.join(tmp, ".senti", "config.json"),
    JSON.stringify({
      lang: "ja",
      type: "base",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      ...(stubPath ? { agent: stubAgentConfig(stubPath) } : {}),
    }),
  );
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "fixture" }));
  return tmp;
}

function createFlowState(tmp, extra = {}) {
  const state = {
    specId: "001-test",
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

function run(tmp, argv) {
  return spawnSync("node", [SENTI, ...argv], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
}

function parseEnvelope(res) {
  return JSON.parse(res.stdout.trim());
}

// ---------------------------------------------------------------------------
// R1a: AUTO_CHECK_INELIGIBLE
// ---------------------------------------------------------------------------

describe("R1a: set auto on → AUTO_CHECK_INELIGIBLE on reject", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("returns ok:false envelope with code AUTO_CHECK_INELIGIBLE and score data", () => {
    tmp = createTmpProject(lowAutoCheckResponse());
    createFlowState(tmp);
    const res = run(tmp, ["flow", "set", "auto", "on"]);
    assert.notEqual(res.status, 0);
    const env = parseEnvelope(res);
    assert.equal(env.ok, false);
    assert.equal(env.errors[0].code, "AUTO_CHECK_INELIGIBLE");
    // data should carry judgment evidence
    assert.ok(env.data, "envelope.data must be present");
    assert.equal(typeof env.data.score, "number");
    assert.equal(typeof env.data.maxScore, "number");
    assert.equal(typeof env.data.threshold, "number");
    assert.ok(env.data.breakdown, "data.breakdown must be present");
  });
});

// ---------------------------------------------------------------------------
// R2a: RETRO_EXISTS
// R2b: NO_CHANGES
// ---------------------------------------------------------------------------

function writeMinimalSpec(tmp) {
  const specJson = {
    goal: "x",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [{ id: "R1", desc: "x", priority: "must" }],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
  fs.writeFileSync(
    path.join(tmp, "specs", "001-test", "spec.json"),
    JSON.stringify(specJson, null, 2),
  );
  fs.writeFileSync(
    path.join(tmp, "specs", "001-test", "spec.md"),
    "# spec\n## Requirements\n- R1\n",
  );
}

describe("R2: run retro → upstream-artifact preconditions (spec 251)", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("R2a: returns TEST_RESULT_REVIEW_MISSING when test-result-review.json is absent", () => {
    tmp = createTmpProject();
    createFlowState(tmp, {
      requirements: [{ id: "R1", desc: "x", priority: "must", status: "done" }],
    });
    writeMinimalSpec(tmp);
    // No upstream artifact prepared → retro must refuse to aggregate.
    const res = run(tmp, ["flow", "run", "retro"]);
    assert.notEqual(res.status, 0);
    const env = parseEnvelope(res);
    assert.equal(env.ok, false);
    assert.equal(env.errors[0].code, "TEST_RESULT_REVIEW_MISSING");
    assert.ok(
      env.errors[0].messages.some((m) => /test-result-review/i.test(m)),
      "messages should reference test-result-review",
    );
  });

  it("R2b: returns TEST_EXECUTE_RESULT_MISSING when only test-result-review.json exists", () => {
    tmp = createTmpProject();
    createFlowState(tmp, {
      requirements: [{ id: "R1", desc: "x", priority: "must", status: "done" }],
    });
    writeMinimalSpec(tmp);
    fs.writeFileSync(
      path.join(tmp, "specs", "001-test", "test-result-review.json"),
      JSON.stringify({
        verdict: "pass",
        checked_items: [],
        result_file_path: path.join(tmp, "specs", "001-test", "test-execute-result.json"),
        raw_output_path: path.join(tmp, "specs", "001-test", "tests", ".raw", "test-execution.log"),
      }),
    );
    const res = run(tmp, ["flow", "run", "retro"]);
    assert.notEqual(res.status, 0);
    const env = parseEnvelope(res);
    assert.equal(env.ok, false);
    assert.equal(env.errors[0].code, "TEST_EXECUTE_RESULT_MISSING");
    assert.ok(
      env.errors[0].messages.some((m) => /test-execute/i.test(m)),
      "messages should reference test-execute",
    );
  });
});

// ---------------------------------------------------------------------------
// R3: CLI argument validation codes
// ---------------------------------------------------------------------------

describe("R3: flow set argument validation → structured codes (table-driven)", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  const CASES = [
    { name: "set step with missing args", argv: ["flow", "set", "step"], code: "INVALID_USAGE" },
    { name: "set step with invalid status", argv: ["flow", "set", "step", "draft", "bogus-status"], code: "INVALID_STATUS" },
    { name: "set req with invalid index", argv: ["flow", "set", "req", "not-a-number", "done"], code: "INVALID_ARG_VALUE" },
    { name: "set req with invalid status", argv: ["flow", "set", "req", "0", "bogus"], code: "INVALID_STATUS" },
    { name: "set issue with missing arg", argv: ["flow", "set", "issue"], code: "INVALID_USAGE" },
    { name: "set issue with non-number", argv: ["flow", "set", "issue", "abc"], code: "INVALID_ARG_VALUE" },
    { name: "set note with no text", argv: ["flow", "set", "note"], code: "INVALID_USAGE" },
    { name: "set request with no text", argv: ["flow", "set", "request"], code: "INVALID_USAGE" },
    { name: "set summary is deprecated", argv: ["flow", "set", "summary", '["x"]'], code: "DEPRECATED" },
    { name: "set metric with missing args", argv: ["flow", "set", "metric"], code: "INVALID_USAGE" },
    { name: "set metric with invalid phase", argv: ["flow", "set", "metric", "bogus-phase", "docsRead"], code: "INVALID_PHASE" },
    { name: "set metric with invalid counter", argv: ["flow", "set", "metric", "draft", "bogus-counter"], code: "INVALID_ARG_VALUE" },
    { name: "set auto with no argument", argv: ["flow", "set", "auto"], code: "INVALID_USAGE" },
    { name: "set issue-log without required fields", argv: ["flow", "set", "issue-log"], code: "INVALID_USAGE" },
  ];

  for (const { name, argv, code } of CASES) {
    it(`${name} → ${code}`, () => {
      tmp = createTmpProject();
      createFlowState(tmp);
      const res = run(tmp, argv);
      assert.notEqual(res.status, 0, `expected non-zero exit for ${argv.join(" ")}`);
      const env = parseEnvelope(res);
      assert.equal(env.ok, false);
      assert.equal(
        env.errors[0].code,
        code,
        `argv=${argv.join(" ")} expected code ${code}, got ${env.errors[0].code}`,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// R1b: ESCALATE_RETRY_EXHAUSTED via direct function call
// ---------------------------------------------------------------------------

describe("R1b: checkRetryBelowMax returns envelope with ESCALATE_RETRY_EXHAUSTED", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("returns ok:false envelope with phase/attempts/max data when budget exhausted", async () => {
    tmp = createTmpProject(null);
    const { checkRetryBelowMax } = await import("../../../src/flow/lib/run-gate.js");
    const phase = "task-impl";
    // task-gate maxAttempts = 5 (from definition.js); supply 5 deltas to exhaust.
    const ctx = {
      root: tmp,
      config: {},
      flowState: {
        specId: "001-test",
        metrics: Array.from({ length: 5 }, () => ({ phase, counter: "gateRetry", delta: 1 })),
      },
    };
    const result = checkRetryBelowMax(ctx, phase);
    assert.ok(result, "expected envelope, got null");
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "ESCALATE_RETRY_EXHAUSTED");
    assert.equal(result.data.phase, phase);
    assert.equal(result.data.attempts, 5);
    assert.equal(result.data.max, 5);
  });

  it("returns null when budget is still available", async () => {
    const { checkRetryBelowMax } = await import("../../../src/flow/lib/run-gate.js");
    const phase = "task-impl";
    const ctx = {
      root: process.cwd(),
      config: { flow: { retry: { max: 3 } } },
      flowState: {
        metrics: [{ phase, counter: "gateRetry", delta: 1 }],
      },
    };
    assert.equal(checkRetryBelowMax(ctx, phase), null);
  });
});

// ---------------------------------------------------------------------------
// R1c: NO_PROGRESS_SINCE_LAST_FAIL via direct function call
// ---------------------------------------------------------------------------

describe("R1c: checkNoProgressSinceLastFail returns envelope with NO_PROGRESS_SINCE_LAST_FAIL", () => {
  it("returns ok:false envelope with structured previous state", async () => {
    const { checkNoProgressSinceLastFail } = await import("../../../src/flow/lib/run-gate.js");
    const phase = "task-impl";
    const flowState = { metrics: [{ phase, counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "task-gate", phase, reason: "prev fail", headSha: "aaa", worktreeHash: "111" },
      ],
    };
    const result = checkNoProgressSinceLastFail({
      flowState,
      issueLog,
      phase,
      currentState: { headSha: "aaa", worktreeHash: "111" },
    });
    assert.ok(result, "expected envelope, got null");
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "NO_PROGRESS_SINCE_LAST_FAIL");
    assert.equal(result.data.phase, phase);
    assert.ok(result.data.previous);
    assert.equal(result.data.previous.headSha, "aaa");
    assert.equal(result.data.previous.worktreeHash, "111");
  });
});

// ---------------------------------------------------------------------------
// R4: analyze classification-A throws remain unchanged (smoke / regression)
// ---------------------------------------------------------------------------

describe("R4: classification-A throws still propagate as errors", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("set init with invalid --issue still returns ok:false (code stays structured)", () => {
    tmp = createTmpProject();
    // set init is a preparing-flow command; missing flow is expected
    const res = run(tmp, ["flow", "set", "init", "--issue", "abc"]);
    assert.notEqual(res.status, 0);
    const env = parseEnvelope(res);
    assert.equal(env.ok, false);
    // This particular throw is D (arg validation), not A — expectation: INVALID_ARG_VALUE
    assert.equal(env.errors[0].code, "INVALID_ARG_VALUE");
  });
});
