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
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { NormalStepTransition } from "../../../src/flow/lib/step-transition-policy.js";
const FLOW_CMD = join(process.cwd(), "src/flow.js");

describe("flow set step", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlowState(dir) {
    const specId = "001-test";
    const state = {
      specId: specId,
      runId: "run-test",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(dir).create(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
    return state;
  }

  it("updates step and returns JSON envelope", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "set", "step", "branch", "done"],
      { encoding: "utf8", env: { ...process.env, SENRAIL_WORK_ROOT: tmp } },
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
        { encoding: "utf8", env: { ...process.env, SENRAIL_WORK_ROOT: tmp } },
      );
      assert.fail("should exit non-zero");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.errors[0].level, "fatal");
    }
  });

  it("passes explicit flow and task scope for the resolved active step", async () => {
    const updates = [];
    const flowManager = {
      state: {
        steps: [{ id: "draft", status: "in_progress" }],
        tasks: [{
          id: "T-1",
          steps: [
            { id: "task-impl", status: "pending" },
            { id: "task-review", status: "pending" },
            { id: "task-gate", status: "pending" },
          ],
        }],
        currentTaskId: "T-1",
      },
      load() { return this.state; },
      updateStepStatus(transition, opts) { updates.push({ transition, opts }); },
    };
    const command = new SetStepCommand();

    await command.execute({
      id: "draft",
      status: "skipped",
      specId: "demo",
      flowManager,
    });
    flowManager.state.steps[0].status = "done";
    flowManager.state.tasks[0].steps[0].status = "in_progress";
    await command.execute({
      id: "task-impl",
      status: "skipped",
      specId: "demo",
      flowManager,
    });

    assert.equal(updates.length, 2);
    assert.ok(updates.every(({ transition }) => transition instanceof NormalStepTransition));
    assert.deepEqual(updates.map(({ transition, opts }) => ({
      stepId: transition.stepId,
      status: transition.requestedStatus,
      opts,
    })), [
      { stepId: "draft", status: "skipped", opts: { specId: "demo", taskId: null } },
      { stepId: "task-impl", status: "skipped", opts: { specId: "demo", taskId: "T-1" } },
    ]);
  });

  it("rejects a current step whose completion is owned by a definition lifecycle", async () => {
    const updates = [];
    const state = {
      specId: "demo",
      currentTaskId: null,
      steps: [{ id: "scenario-validity", status: "in_progress" }],
      tasks: [],
    };
    const result = await new SetStepCommand().execute({
      id: "scenario-validity",
      status: "done",
      root: tmp,
      flowManager: {
        load() { return state; },
        updateStepStatus(transition) { updates.push(transition); },
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_STEP_TRANSITION_INVALID");
    assert.equal(updates.length, 0);
    assert.equal(state.steps[0].status, "in_progress");
  });
});
