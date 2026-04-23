/**
 * spec 202 — integration tests for gate-impl wiring.
 *
 * Invokes the real `sdd-forge` CLI as a subprocess against a throwaway git
 * repo fixture, verifying:
 *   R1: PASS wiring (mechanical test-change check admits multi-line +)
 *   R2: FAIL wiring (mechanical check rejects deletions / single-line +)
 *   R3: ESCALATE end-to-end (retry limit enforcement via CLI exit)
 *   R4: post-hook retry counter transitions (PASS resets, FAIL +1)
 *   (spec 215) R5 removed: run-draft-task was removed together with addition origin
 *
 * AI is replaced via config.agent.providers stub (see tests/helpers/stub-agent.js).
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";
import { initGitRepo, commitAll, checkoutNewBranch } from "../../helpers/git-repo.js";
import { writeStubAgentScript, stubAgentConfig, defaultPassResponse } from "../../helpers/stub-agent.js";
import { FLOW_STEPS } from "../../../src/lib/flow-helpers.js";

const CMD = path.join(process.cwd(), "src/sdd-forge.js");
const SPEC_ID = "001-test";
const SPEC_PATH = `specs/${SPEC_ID}/spec.md`;

function minimalSpecJson() {
  return {
    goal: "Fixture for integration test.",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [{ id: "R1", desc: "anything goes", priority: "must", status: "pending" }],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
}

function setupFixture(tmp, { initialTest, modifiedTest, gateRetry = 0, seedIssueLog = false } = {}) {
  // Stub AI provider
  const stubPath = writeStubAgentScript(tmp, ".stub-agent.js", defaultPassResponse());
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: stubAgentConfig(stubPath),
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });

  // Minimal spec.md — no **REQ-XXX** markers so extractRequirementIds falls back to REQ-SPEC.
  writeFile(tmp, SPEC_PATH, [
    "# Fixture Spec",
    "",
    "## Goal",
    "Fixture for integration test.",
    "",
    "## Requirements",
    "Anything goes.",
    "",
  ].join("\n"));
  // Post-T8: run-gate loads spec.json via the single validated load path.
  writeJson(tmp, `specs/${SPEC_ID}/spec.json`, minimalSpecJson());

  // Initial test file
  writeFile(tmp, "tests/dummy.test.js", initialTest);

  // Git repo with main as base
  initGitRepo(tmp);
  commitAll(tmp, "initial");

  // Feature branch with the modified test file
  checkoutNewBranch(tmp, `feature/${SPEC_ID}`);
  if (modifiedTest !== undefined) {
    writeFile(tmp, "tests/dummy.test.js", modifiedTest);
    commitAll(tmp, "feature change");
  } else {
    commitAll(tmp, "empty feature commit");
  }

  // Flow state (cac6/T10: metrics is a flat append-only entry array)
  const metrics = [];
  for (let i = 0; i < (gateRetry || 0); i++) {
    metrics.push({ phase: "task-impl", counter: "gateRetry", delta: 1, taskId: null, ts: new Date().toISOString() });
  }
  writeJson(tmp, `specs/${SPEC_ID}/flow.json`, {
    spec: SPEC_PATH,
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    steps: FLOW_STEPS.map((id) => ({ id, status: "pending" })),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    metrics,
    // spec 222: gate-impl requires tool-recorded head test evidence
    // (`test.summary.exitCode`) before invoking the AI evaluator.
    test: { summary: { exitCode: 0 } },
  });

  // Active flow pointer — format is `[{ spec: <specId>, mode }]`.
  writeJson(tmp, ".sdd-forge/.active-flow", [
    { spec: SPEC_ID, mode: "local" },
  ]);

  if (seedIssueLog) {
    writeJson(tmp, `specs/${SPEC_ID}/issue-log.json`, {
      entries: [
        { step: "gate-impl", reason: "seeded FAIL reason 1" },
        { step: "gate-impl", reason: "seeded FAIL reason 2" },
        { step: "gate-impl", reason: "seeded FAIL reason 3" },
      ],
    });
  }

  return { stubPath };
}

function runGate(tmp, extraArgs = []) {
  return spawnSync(
    "node",
    [CMD, "flow", "run", "gate", "--phase", "task-impl", ...extraArgs],
    {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
    },
  );
}

function readCounter(tmp) {
  const fj = JSON.parse(fs.readFileSync(path.join(tmp, `specs/${SPEC_ID}/flow.json`), "utf8"));
  const entries = Array.isArray(fj?.metrics) ? fj.metrics : [];
  let count = 0;
  for (const e of entries) {
    if (e.phase !== "task-impl" || e.counter !== "gateRetry") continue;
    if (e.reset) count = 0;
    else count += e.delta ?? 1;
  }
  return count;
}

function parseEnvelope(stdout) {
  // CLI prints JSON envelope on stdout; be tolerant of trailing newlines.
  return JSON.parse(stdout.trim());
}

const BASE_TEST = [
  "// test fixture",
  "test('a', () => { assert(1 === 1); });",
  "",
].join("\n");

describe("gate-impl integration (spec 202)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: multi-line-only addition in test file → gate PASS", () => {
    tmp = createTmpDir();
    const modified = [
      "// test fixture",
      "test('a', () => { assert(1 === 1); });",
      "test('b', () => {",
      "  assert(2 === 2);",
      "});",
      "",
    ].join("\n");
    setupFixture(tmp, { initialTest: BASE_TEST, modifiedTest: modified });

    const res = runGate(tmp, ["--skip-guardrail"]);
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}. stderr=${res.stderr}`);
    const env = parseEnvelope(res.stdout);
    assert.equal(env.ok, true);
    assert.equal(env.data.result, "pass", `envelope=${res.stdout}`);
  });

  it("R2: deletion / single-line addition in test file → gate FAIL with file:line reason", () => {
    tmp = createTmpDir();
    // Delete the original assertion and add a 1-line replacement: guaranteed `-` + `+1`.
    const modified = [
      "// test fixture",
      "test('a', () => { assert(true); });", // modification: original deleted, new added
      "",
    ].join("\n");
    setupFixture(tmp, { initialTest: BASE_TEST, modifiedTest: modified });

    const res = runGate(tmp);
    // Gate FAIL is a successful CLI invocation that reports an evaluation failure.
    // The CLI returns a JSON envelope either way.
    const env = parseEnvelope(res.stdout);
    assert.equal(env.data.result, "fail", `envelope=${res.stdout}`);
    const issues = env.data.artifacts?.issues || [];
    assert.ok(issues.length > 0, "expected issues array");
    const joined = issues.join("\n");
    assert.match(joined, /tests\/dummy\.test\.js:\d+/, `issues should name file:line — got: ${joined}`);
  });

  it("R3: retry counter at limit → non-zero exit with retry history output", () => {
    tmp = createTmpDir();
    setupFixture(tmp, {
      initialTest: BASE_TEST,
      modifiedTest: BASE_TEST + "// trivial change\n",
      gateRetry: 3,
      seedIssueLog: true,
    });

    const res = runGate(tmp);
    assert.notEqual(res.status, 0, `expected non-zero exit, got ${res.status}`);
    const out = (res.stdout || "") + (res.stderr || "");
    assert.match(out, /gate retry limit exhausted/, "expected retry limit message");
    assert.match(out, /attempt 1/, "expected retry history attempt listing");
    assert.match(out, /seeded FAIL reason/, "expected seeded reasons in history");
  });

  it("R4a: gate PASS resets counter to 0", () => {
    tmp = createTmpDir();
    const modified = [
      "// test fixture",
      "test('a', () => { assert(1 === 1); });",
      "test('b', () => {",
      "  assert(2 === 2);",
      "});",
      "",
    ].join("\n");
    setupFixture(tmp, { initialTest: BASE_TEST, modifiedTest: modified, gateRetry: 2 });

    const res = runGate(tmp, ["--skip-guardrail"]);
    assert.equal(res.status, 0, `stderr=${res.stderr}`);
    const env = parseEnvelope(res.stdout);
    assert.equal(env.data.result, "pass");
    assert.equal(readCounter(tmp), 0, "counter must reset to 0 on PASS");
  });

  it("R4b: gate FAIL increments counter by +1", () => {
    tmp = createTmpDir();
    const modified = [
      "// test fixture",
      "test('a', () => { assert(true); });", // has `-` line
      "",
    ].join("\n");
    setupFixture(tmp, { initialTest: BASE_TEST, modifiedTest: modified, gateRetry: 1 });

    const res = runGate(tmp);
    const env = parseEnvelope(res.stdout);
    assert.equal(env.data.result, "fail");
    assert.equal(readCounter(tmp), 2, "counter must +1 on FAIL");
  });

});

