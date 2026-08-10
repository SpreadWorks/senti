/**
 * tests/unit/flow/get-status.test.js
 *
 * Tests for `flow get status` — returns flow state as JSON envelope.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync, spawnSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps, FLOW_STEPS } from "../../../src/lib/flow-helpers.js";
const FLOW_CMD = join(process.cwd(), "src/sennel.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

describe("flow get status", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlowState(dir) {
    const specId = "001-test";
    const state = {
      specId: specId,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      runId: "run-001-test",
      issue: 1001,
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
      request: "request belongs in detailed status",
      notes: [{ text: "status note", taskId: null, ts: "2026-01-01T00:00:00.000Z" }],
      metrics: [{ phase: "draft", counter: "srcRead", delta: 1, taskId: null, ts: "2026-01-01T00:00:00.000Z" }],
      broadModeHistory: [{ step: "implement", enabled: true, reason: "audit", ts: "2026-01-01T00:00:00.000Z" }],
      mergeStrategy: "squash",
      autoApprove: true,
    };
    makeFlowManager(dir).create(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
    return state;
  }

  it("returns JSON envelope with ok: true", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "get");
    assert.equal(envelope.key, "status");
    assert.equal(envelope.data.specId, "001-test");
    assert.ok(Array.isArray(envelope.data.steps));
  });

  it("returns ok: true with active: false when no active flow", () => {
    tmp = createTmpDir();
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "get");
    assert.equal(envelope.key, "status");
    assert.equal(envelope.data.active, false);
  });

  it("returns active: true when a flow exists", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.data.active, true);
  });

  it("selects the expected runId when multiple active flows exist", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const secondSpec = "002-second";
    makeFlowManager(tmp).create({
      specId: secondSpec,
      baseBranch: "main",
      featureBranch: `feature/${secondSpec}`,
      runId: "run-002-second",
      issue: 1002,
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-2", title: "y", goal: "y", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    });
    makeFlowManager(tmp).addActiveFlow(secondSpec, "local");
    fs.writeFileSync(join(tmp, "specs", "001-test", "flow.json"), "{truncated");

    const result = execFileSync("node", [
      FLOW_CMD,
      ...FLOW_CMD_ARGS_PREFIX,
      "get",
      "status",
      "--expect-run-id",
      "run-002-second",
    ], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.specId, secondSpec);
    assert.equal(envelope.data.runId, "run-002-second");
  });

  it("fails on a corrupt selected runId before creating a runtime log", () => {
    tmp = createTmpDir();
    const state = setupFlowState(tmp);
    fs.writeFileSync(join(tmp, "specs", state.specId, "flow.json"), "{truncated");

    const result = spawnSync("node", [
      FLOW_CMD,
      ...FLOW_CMD_ARGS_PREFIX,
      "get",
      "status",
      state.runId,
      "--expect-run-id",
      state.runId,
      "--expect-issue",
      String(state.issue),
      "--expect-spec",
      state.specId,
    ], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result.stdout);
    assert.notEqual(result.status, 0);
    assert.equal(envelope.errors[0].code, "FLOW_TARGET_RECOVERY_REQUIRED");
    assert.deepEqual(
      { runId: envelope.data.runId, issue: envelope.data.issue, specId: envelope.data.specId },
      { runId: state.runId, issue: state.issue, specId: state.specId },
    );
    assert.equal(fs.existsSync(join(tmp, ".tmp", "logs")), false);
  });

  it("omits audit details from default status", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.data.active, true);
    for (const key of ["request", "notes", "metrics", "metricsSummary", "broadModeHistory", "broadModeHistoryTotal", "broadModeHistoryTruncated"]) {
      assert.equal(Object.hasOwn(envelope.data, key), false, `default status must omit ${key}`);
    }
    assert.equal(envelope.data.mergeStrategy, "squash");
    assert.equal(envelope.data.autoApprove, true);
  });

  it("returns audit details when --details is requested", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status", "--details"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.data.request, "request belongs in detailed status");
    assert.equal(envelope.data.notes.length, 1);
    assert.equal(envelope.data.metrics.length, 1);
    assert.equal(envelope.data.metricsSummary.flow.draft.srcRead, 1);
    assert.equal(envelope.data.broadModeHistory.length, 1);
  });

  it("returns target runId identifiers in mismatch data for runId status", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    let result;
    assert.throws(
      () => {
        result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status", "run-001-test", "--expect-issue", "1002"], {
          encoding: "utf8",
          env: { ...process.env, SENNEL_WORK_ROOT: tmp },
        });
      },
      (err) => {
        const envelope = JSON.parse(err.stdout);
        assert.equal(envelope.ok, false);
        assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
        assert.equal(envelope.data.expectedIssue, 1002);
        assert.equal(envelope.data.activeIssue, 1001);
        assert.equal(envelope.data.expectedRunId, "run-001-test");
        assert.equal(envelope.data.activeRunId, "run-001-test");
        return true;
      },
    );
    assert.equal(result, undefined);
  });
});
