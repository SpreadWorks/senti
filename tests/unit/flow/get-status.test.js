/**
 * tests/unit/flow/get-status.test.js
 *
 * Tests for `flow get status` — returns flow state as JSON envelope.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps, FLOW_STEPS } from "../../../src/lib/flow-helpers.js";
const FLOW_CMD = join(process.cwd(), "src/senti.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

describe("flow get status", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlowState(dir) {
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
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
    makeFlowManager(dir).save(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
    return state;
  }

  it("returns JSON envelope with ok: true", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "get");
    assert.equal(envelope.key, "status");
    assert.ok(envelope.data.spec);
    assert.ok(Array.isArray(envelope.data.steps));
  });

  it("returns ok: true with active: false when no active flow", () => {
    tmp = createTmpDir();
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
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
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.data.active, true);
  });

  it("omits audit details from default status", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
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
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
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
          env: { ...process.env, SENTI_WORK_ROOT: tmp },
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
