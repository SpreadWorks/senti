/**
 * tests/unit/flow/get-check.test.js
 *
 * Tests for `flow get check <target>` — returns prerequisite check results.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
const FLOW_CMD = join(process.cwd(), "src/flow.js");

describe("flow get check", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlowState(dir) {
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(dir).save(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
  }

  it("returns JSON envelope with pass and checks array", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    makeFlowManager(tmp).updateStepStatus("review-draft-questions", "skipped");
    makeFlowManager(tmp).updateStepStatus("draft-refine", "skipped");
    makeFlowManager(tmp).updateStepStatus("review-draft-coverage", "skipped");
    makeFlowManager(tmp).updateStepStatus("gate", "done");
    makeFlowManager(tmp).updateStepStatus("review-spec", "skipped");
    makeFlowManager(tmp).updateStepStatus("test", "done");
    makeFlowManager(tmp).updateStepStatus("review-test", "skipped");
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "check", "impl"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "get");
    assert.equal(envelope.key, "check");
    assert.equal(envelope.data.pass, true);
    assert.ok(Array.isArray(envelope.data.checks));
  });

  it("returns pass: false when prerequisites not met", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "check", "impl"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.pass, false);
    const failedChecks = envelope.data.checks.filter((c) => !c.pass);
    assert.ok(failedChecks.length > 0);
  });

  it("returns error for unknown target", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    try {
      execFileSync(
        "node", [FLOW_CMD, "get", "check", "nonexistent"],
        { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
      );
      assert.fail("should exit non-zero");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
    }
  });
});
