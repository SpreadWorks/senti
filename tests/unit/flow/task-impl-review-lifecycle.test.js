import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { DecisionOutcome, StepAttempt } from "../../../src/flow/lib/step-outcome.js";
import {
  makeDefaultTask,
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
} from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

describe("task-scoped implementation review lifecycle", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  function setupReviewState({ parentStep = "implement" } = {}) {
    tmp = createTmpDir("task-impl-review-lifecycle-");
    const specId = "443-task-review";
    const state = moveFlowToStep(makeFlowState({
      spec: `specs/${specId}/spec.json`,
      runId: "run-task-review",
      currentTaskId: "T-1",
      tasks: [makeDefaultTask({
        id: "T-1",
        spec: `specs/${specId}/tasks/T-1.md`,
        status: "in_progress",
        steps: [
          { id: "task-impl", status: "done" },
          { id: "task-review", status: "in_progress" },
          { id: "task-gate", status: "pending" },
        ],
      })],
    }), parentStep);
    const baseFlowManager = makeFlowManager(tmp);
    baseFlowManager.create(state);
    baseFlowManager.addActiveFlow(specId, "local");
    const flowManager = baseFlowManager.forRoot(tmp, { specId });
    return { specId, state, flowManager };
  }

  function reviewDecisionAttempt(verdict) {
    return new StepAttempt({
      runId: "run-task-review",
      taskId: "T-1",
      stepId: "task-review",
      attempt: 1,
      outcome: new DecisionOutcome({ decision: verdict, nextAction: "task-gate" }),
    }).toJSON();
  }

  for (const verdict of ["PASS", "ADVISORY"]) {
    it(`${verdict} completes task review and activates task-gate without advancing impl-gate`, async () => {
      const { specId, state, flowManager } = setupReviewState();
      const parentStepIds = ["implement", "impl-review", "impl-triage", "impl-repair", "impl-gate"];
      const parentStatusesBefore = parentStepIds.map((stepId) => [
        stepId,
        findStepById(state.steps, stepId).status,
      ]);
      const result = {
        result: "ok",
        artifacts: { phase: "impl", verdict, taskId: "T-1" },
        next: "task-gate",
        stepAttempt: reviewDecisionAttempt(verdict),
      };

      await FLOW_COMMANDS.run.review.post({
        phase: "impl",
        flowState: state,
        flowManager,
        specId,
      }, result);

      const committed = flowManager.load(specId);
      assert.deepEqual(
        parentStepIds.map((stepId) => [
          stepId,
          findStepById(committed.steps, stepId).status,
        ]),
        parentStatusesBefore,
      );
      assert.deepEqual(
        committed.tasks[0].steps.map(({ id, status }) => [id, status]),
        [
          ["task-impl", "done"],
          ["task-review", "done"],
          ["task-gate", "in_progress"],
        ],
      );
      assert.equal(
        fs.existsSync(path.join(tmp, "specs", specId, "impl-triage.json")),
        false,
        "task PASS/ADVISORY must not require a fabricated zero-finding triage artifact",
      );
    });

    it(`${verdict} does not generically promote impl-gate from a partial parent triage state`, async () => {
      const { specId, state, flowManager } = setupReviewState({ parentStep: "impl-triage" });
      const parentStepIds = ["implement", "impl-review", "impl-triage", "impl-repair", "impl-gate"];
      const parentStatusesBefore = parentStepIds.map((stepId) => [
        stepId,
        findStepById(state.steps, stepId).status,
      ]);
      const result = {
        result: "ok",
        artifacts: { phase: "impl", verdict, taskId: "T-1" },
        next: "task-gate",
        stepAttempt: reviewDecisionAttempt(verdict),
      };

      await FLOW_COMMANDS.run.review.post({
        phase: "impl",
        flowState: state,
        flowManager,
        specId,
      }, result);

      const committed = flowManager.load(specId);
      assert.deepEqual(
        parentStepIds.map((stepId) => [
          stepId,
          findStepById(committed.steps, stepId).status,
        ]),
        parentStatusesBefore,
      );
      assert.deepEqual(
        committed.tasks[0].steps.map(({ id, status }) => [id, status]),
        [
          ["task-impl", "done"],
          ["task-review", "done"],
          ["task-gate", "in_progress"],
        ],
      );
      assert.equal(
        fs.existsSync(path.join(tmp, "specs", specId, "impl-triage.json")),
        false,
      );
    });
  }

  it("REJECTED retains task review retry behavior without advancing flow lifecycle steps", async () => {
    const { specId, state, flowManager } = setupReviewState();
    const result = {
      result: "ok",
      artifacts: { phase: "impl", verdict: "REJECTED", taskId: "T-1" },
      next: null,
    };

    await FLOW_COMMANDS.run.review.post({
      phase: "impl",
      flowState: state,
      flowManager,
      specId,
    }, result);

    const committed = flowManager.load(specId);
    assert.deepEqual(
      ["implement", "impl-triage", "impl-repair", "impl-gate"].map((stepId) => [
        stepId,
        findStepById(committed.steps, stepId).status,
      ]),
      [
        ["implement", "in_progress"],
        ["impl-triage", "pending"],
        ["impl-repair", "pending"],
        ["impl-gate", "pending"],
      ],
    );
    assert.deepEqual(
      committed.tasks[0].steps.map(({ id, status }) => [id, status]),
      [
        ["task-impl", "done"],
        ["task-review", "in_progress"],
        ["task-gate", "pending"],
      ],
    );
    assert.equal(result.stepAttempt?.outcome?.kind, "retry");
  });
});
