/**
 * tests/unit/flow/set-step.test.js
 *
 * Tests for `flow set step` — updates step status and returns JSON envelope.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/definition.js";
const FLOW_CMD = join(process.cwd(), "src/flow.js");

describe("flow set step", () => {
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
    return state;
  }

  it("updates step and returns JSON envelope", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "set", "step", "branch", "done"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "set");
    assert.equal(envelope.key, "step");

    const loaded = makeFlowManager(tmp).load();
    const branch = findStepById(loaded.steps, "branch");
    assert.equal(branch.status, "done");
  });

  it("returns error for invalid step ID", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    try {
      execFileSync(
        "node", [FLOW_CMD, "set", "step", "nonexistent", "done"],
        { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
      );
      assert.fail("should exit non-zero");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.errors[0].level, "fatal");
    }
  });
});
