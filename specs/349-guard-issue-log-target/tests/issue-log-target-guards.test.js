// spec: R1 R2 R3 R4
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const CMD = path.join(process.cwd(), "src/senti.js");
const REASON = "target guard behavior must remain auditable";

function flowState(specId, runId, issue) {
  return {
    spec: `specs/${specId}/spec.json`,
    runId,
    issue,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{
      id: "T-1",
      title: "fixture task",
      goal: "fixture task",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "pending",
      steps: [],
    }],
    currentTaskId: null,
  };
}

function addFlow(root, specId, runId, issue) {
  const manager = makeFlowManager(root);
  manager.create(flowState(specId, runId, issue));
  manager.addActiveFlow(specId, "local");
}

function runIssueLog(root, args) {
  return spawnSync("node", [CMD, "flow", "set", "issue-log", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
}

function parse(result) {
  assert.notEqual(result.stdout.trim(), "", result.stderr);
  return JSON.parse(result.stdout);
}

function entries(root, specId) {
  const log = path.join(root, "specs", specId, "issue-log.json");
  return fs.existsSync(log) ? JSON.parse(fs.readFileSync(log, "utf8")).entries : [];
}

describe("issue-log target guards", () => {
  let root;
  afterEach(() => root && removeTmpDir(root));

  function setupPair() {
    root = createTmpDir("spec-349-issue-log-target-");
    addFlow(root, "349-target", "run-349", 349);
    addFlow(root, "350-foreign", "run-350", 350);
  }

  it("R1: appends only to the flow for every supported matching guard combination", () => {
    setupPair();
    const guards = [
      ["--expect-run-id", "run-349"],
      ["--expect-run-id", "run-349", "--expect-issue", "349"],
      ["--expect-run-id", "run-349", "--expect-issue", "349", "--expect-spec", "specs/349-target/spec.json"],
    ];

    for (const expected of guards) {
      const result = runIssueLog(root, ["--step", "draft", "--reason", REASON, ...expected]);
      assert.equal(result.status, 0, result.stderr);
    }
    assert.equal(entries(root, "349-target").length, guards.length);
    assert.equal(entries(root, "350-foreign").length, 0);
  });

  it("R2: rejects each mismatched guard without appending to either flow", () => {
    setupPair();
    const cwdLog = path.join(root, "issue-log.json");
    const cwdBefore = "{\"entries\":[\"cwd-sentinel\"]}\n";
    fs.writeFileSync(cwdLog, cwdBefore);
    const matching = [
      "--expect-run-id", "run-349",
      "--expect-issue", "349",
      "--expect-spec", "specs/349-target/spec.json",
    ];
    const mismatches = [
      ["--expect-run-id", "run-wrong", ...matching.slice(2)],
      ["--expect-run-id", "run-349", "--expect-issue", "999", ...matching.slice(4)],
      ["--expect-run-id", "run-349", "--expect-issue", "349", "--expect-spec", "specs/wrong/spec.json"],
    ];

    for (const guards of mismatches) {
      const result = runIssueLog(root, ["--step", "draft", "--reason", REASON, ...guards]);
      assert.notEqual(result.status, 0, result.stdout);
      assert.equal(parse(result).errors[0].code, "ACTIVE_FLOW_MISMATCH");
      assert.equal(entries(root, "349-target").length, 0);
      assert.equal(entries(root, "350-foreign").length, 0);
      assert.equal(fs.readFileSync(cwdLog, "utf8"), cwdBefore);
    }
  });

  it("R3: keeps guard-free appends for one active flow", () => {
    root = createTmpDir("spec-349-issue-log-guard-free-");
    addFlow(root, "349-target", "run-349", 349);

    const result = runIssueLog(root, [
      "--step", "draft",
      "--reason", REASON,
      "--trigger", "guard-free trigger",
      "--resolution", "guard-free resolution",
      "--guardrail-candidate", "guard-free candidate",
      "--task-id", "T-1",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const envelope = parse(result);
    assert.equal(envelope.type, "set");
    assert.equal(envelope.key, "issue-log");
    assert.equal(envelope.data.total, 1);
    assert.equal(envelope.data.entry.step, "draft");
    assert.equal(envelope.data.entry.reason, REASON);
    assert.equal(envelope.data.entry.trigger, "guard-free trigger");
    assert.equal(envelope.data.entry.resolution, "guard-free resolution");
    assert.equal(envelope.data.entry.guardrailCandidate, "guard-free candidate");
    assert.equal(envelope.data.entry.taskId, "T-1");
    assert.ok(envelope.data.entry.timestamp);
    assert.deepEqual(entries(root, "349-target")[0], envelope.data.entry);
  });

  it("R4: help documents all supported target guards", () => {
    root = createTmpDir("spec-349-issue-log-help-");
    const result = spawnSync("node", [CMD, "flow", "set", "issue-log", "--help"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: root },
    });

    assert.equal(result.status, 0, result.stderr);
    for (const option of ["--expect-run-id", "--expect-issue", "--expect-spec"]) {
      assert.match(result.stdout, new RegExp(option));
    }
  });
});
