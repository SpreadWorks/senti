/**
 * tests/unit/flow/set-issue-log.test.js
 *
 * Tests for `flow set issue-log` — records issue-log entries to issue-log.json.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
const FLOW_CMD = join(process.cwd(), "src/sennel.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

// Reason strings must be >= 20 chars (trimmed). Use realistic explanatory text.
const REASON_A = "out of scope decision recorded by gate";
const REASON_B = "first placeholder replaced with real reason";
const REASON_C = "second placeholder replaced with real reason";
const REASON_D = "gate post hook recorded a decision";
const REASON_E = "unclear requirement needing clarification";
// Optional fields must be >= 10 chars (trimmed).
const TRIGGER_E = "user correction during review";
const RESOLUTION_E = "added clarification in spec section";
const GUARDRAIL_E = "Always verify scope boundaries explicitly";

function runSetIssueLog(tmp, args) {
  return execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "issue-log", ...args], {
    encoding: "utf8",
    env: { ...process.env, SENNEL_WORK_ROOT: tmp },
  });
}

function expectValidationError(tmp, args, expectedCode) {
  try {
    runSetIssueLog(tmp, args);
    assert.fail("should exit non-zero");
  } catch (err) {
    assert.notEqual(err.status, 0, "should exit non-zero");
    const envelope = JSON.parse(err.stdout);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.errors[0].code, expectedCode);
  }
}

describe("flow set issue-log", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlowState(dir) {
    const specId = "001-test";
    const state = {
      specId: specId,
      runId: `run-${specId}`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(dir).create(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
    return specId;
  }

  it("creates issue-log.json in specs/<spec>/ directory", () => {
    tmp = createTmpDir();
    const specId = setupFlowState(tmp);
    runSetIssueLog(tmp, ["--step", "draft", "--reason", REASON_A]);
    const logPath = path.join(tmp, "specs", specId, "issue-log.json");
    assert.ok(fs.existsSync(logPath), "issue-log.json should exist");
    const issueLog = JSON.parse(fs.readFileSync(logPath, "utf8"));
    assert.equal(issueLog.entries.length, 1);
    assert.equal(issueLog.entries[0].step, "draft");
    assert.equal(issueLog.entries[0].reason, REASON_A);
  });

  it("appends to existing issue-log.json", () => {
    tmp = createTmpDir();
    const specId = setupFlowState(tmp);
    runSetIssueLog(tmp, ["--step", "draft", "--reason", REASON_B]);
    runSetIssueLog(tmp, ["--step", "spec", "--reason", REASON_C]);
    const logPath = path.join(tmp, "specs", specId, "issue-log.json");
    const issueLog = JSON.parse(fs.readFileSync(logPath, "utf8"));
    assert.equal(issueLog.entries.length, 2);
  });

  it("returns JSON envelope with entry and total", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = runSetIssueLog(tmp, ["--step", "gate", "--reason", REASON_D]);
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "set");
    assert.equal(envelope.key, "issue-log");
    assert.equal(envelope.data.entry.step, "gate");
    assert.equal(envelope.data.total, 1);
  });

  it("includes optional fields when provided", () => {
    tmp = createTmpDir();
    const specId = setupFlowState(tmp);
    runSetIssueLog(tmp, [
      "--step", "draft",
      "--reason", REASON_E,
      "--trigger", TRIGGER_E,
      "--resolution", RESOLUTION_E,
      "--guardrail-candidate", GUARDRAIL_E,
    ]);
    const logPath = path.join(tmp, "specs", specId, "issue-log.json");
    const issueLog = JSON.parse(fs.readFileSync(logPath, "utf8"));
    const entry = issueLog.entries[0];
    assert.equal(entry.trigger, TRIGGER_E);
    assert.equal(entry.resolution, RESOLUTION_E);
    assert.equal(entry.guardrailCandidate, GUARDRAIL_E);
    assert.ok(entry.timestamp);
  });

  it("fails when --step is missing", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    try {
      runSetIssueLog(tmp, ["--reason", REASON_A]);
      assert.fail("should exit non-zero");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.ok(envelope.errors[0].code, "should have an error code");
    }
  });

  it("does NOT store issue-log in flow.json", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    runSetIssueLog(tmp, ["--step", "draft", "--reason", REASON_A]);
    const flowPath = path.join(tmp, "specs", "001-test", "flow.json");
    const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    assert.equal(flow.issueLog, undefined, "issueLog should not be in flow.json");
  });

  // Validation (P1/P2): reject short placeholder inputs.

  it("rejects reason shorter than 20 chars (trimmed)", () => {
    tmp = createTmpDir();
    const specId = setupFlowState(tmp);
    expectValidationError(tmp, ["--step", "draft", "--reason", "first"], "INVALID_REASON");
    const logPath = path.join(tmp, "specs", specId, "issue-log.json");
    assert.ok(!fs.existsSync(logPath), "issue-log.json must not be created on validation failure");
  });

  it("rejects reason that is only whitespace padding under 20 chars", () => {
    tmp = createTmpDir();
    const specId = setupFlowState(tmp);
    expectValidationError(tmp, ["--step", "draft", "--reason", "    wrong scope     "], "INVALID_REASON");
    const logPath = path.join(tmp, "specs", specId, "issue-log.json");
    assert.ok(!fs.existsSync(logPath));
  });

  it("accepts reason with exactly 20 chars (boundary)", () => {
    tmp = createTmpDir();
    const specId = setupFlowState(tmp);
    const twenty = "a".repeat(20);
    assert.equal(twenty.length, 20);
    runSetIssueLog(tmp, ["--step", "draft", "--reason", twenty]);
    const logPath = path.join(tmp, "specs", specId, "issue-log.json");
    const issueLog = JSON.parse(fs.readFileSync(logPath, "utf8"));
    assert.equal(issueLog.entries[0].reason, twenty);
  });

  it("rejects trigger shorter than 10 chars with INVALID_FIELD", () => {
    tmp = createTmpDir();
    const specId = setupFlowState(tmp);
    expectValidationError(tmp,
      ["--step", "draft", "--reason", REASON_A, "--trigger", "short"],
      "INVALID_FIELD",
    );
    const logPath = path.join(tmp, "specs", specId, "issue-log.json");
    assert.ok(!fs.existsSync(logPath));
  });

  it("rejects resolution shorter than 10 chars with INVALID_FIELD", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    expectValidationError(tmp,
      ["--step", "draft", "--reason", REASON_A, "--resolution", "short"],
      "INVALID_FIELD",
    );
  });

  it("rejects guardrail-candidate shorter than 10 chars with INVALID_FIELD", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    expectValidationError(tmp,
      ["--step", "draft", "--reason", REASON_A, "--guardrail-candidate", "short"],
      "INVALID_FIELD",
    );
  });

  it("accepts optional fields with exactly 10 chars (boundary)", () => {
    tmp = createTmpDir();
    const specId = setupFlowState(tmp);
    const ten = "b".repeat(10);
    assert.equal(ten.length, 10);
    runSetIssueLog(tmp, [
      "--step", "draft",
      "--reason", REASON_A,
      "--trigger", ten,
      "--resolution", ten,
      "--guardrail-candidate", ten,
    ]);
    const logPath = path.join(tmp, "specs", specId, "issue-log.json");
    const issueLog = JSON.parse(fs.readFileSync(logPath, "utf8"));
    assert.equal(issueLog.entries[0].trigger, ten);
  });
});
