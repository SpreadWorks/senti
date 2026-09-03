import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { attachCanonicalCommandResultPublications } from "../../../src/flow/lib/canonical-command-result.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  canonicalDraftDocument,
  FlowAtStepFixture,
  TaskLifecycleFixture,
  makeFlowManager,
} from "../../support/infrastructure/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

const SPEC_ID = "441-reopen-spec-correction";

describe("canonical reopen draft routes", () => {
  let root;
  afterEach(() => { if (root) removeTmpDir(root); root = null; });

  function commandContext(flowManager, state, input = {}) {
    return { root, flowManager, flowState: state, ...input };
  }

  function preimplementationFixture() {
    root = createTmpDir("reopen-draft-pre-");
    const flowManager = makeFlowManager(root);
    const fixture = new FlowAtStepFixture({
      flowManager, specId: SPEC_ID, runId: "run-reopen-pre", request: "reopen draft",
      execution: { mode: "branch", baseBranch: "main", featureBranch: `feature/${SPEC_ID}` },
      specRecord: { goal: "fixture", requirements: [] }, targetStep: "spec-review",
    }).create();
    return { flowManager, fixture };
  }

  it("reopens a pre-implementation plan through the fixed draft replacement route", async () => {
    const { flowManager, fixture } = preimplementationFixture();
    const state = fixture.state();

    const result = await new RunReopenDraftCommand().execute(commandContext(flowManager, state));

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.mode, "pre-implementation");
    assert.equal(result.data.destinationStep, "draft");
    const refreshed = flowManager.loadReadOnly(SPEC_ID);
    assert.equal(refreshed.currentNodeId, "draft");
    assert.equal(findStepById(refreshed.steps, "draft").status, "in_progress");
    assert.equal(findStepById(refreshed.steps, "spec-review").status, "invalidated");
    assert.equal(flowManager.activityLedger(SPEC_ID).at(-2).transition.operation, "reopen_draft_preimplementation");
  });

  it("reopens draft-refine when the persisted draft cannot accept a question answer", async () => {
    root = createTmpDir("reopen-draft-refine-");
    const flowManager = makeFlowManager(root);
    const fixture = new FlowAtStepFixture({
      flowManager, specId: SPEC_ID, runId: "run-reopen-refine", request: "recover invalid draft questions",
      execution: { mode: "branch", baseBranch: "main", featureBranch: `feature/${SPEC_ID}` },
      specRecord: { goal: "fixture", requirements: [] }, targetStep: "draft-refine",
    }).create();

    const result = await new RunReopenDraftCommand().execute(commandContext(flowManager, fixture.state(), {
      reason: "regenerate an invalid persisted draft question schema",
    }));

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.previousActiveStep, "draft-refine");
    assert.equal(result.data.destinationStep, "draft");
    const refreshed = flowManager.loadReadOnly(SPEC_ID);
    assert.equal(refreshed.currentNodeId, "draft");
    assert.equal(findStepById(refreshed.steps, "draft").status, "in_progress");
    assert.equal(findStepById(refreshed.steps, "draft-refine").status, "invalidated");
  });

  it("requires a completed Task before entering the task-addition route", async () => {
    root = createTmpDir("reopen-draft-task-");
    const flowManager = makeFlowManager(root);
    const fixture = new TaskLifecycleFixture({
      flowManager, specId: SPEC_ID, runId: "run-reopen-task", request: "add a Task",
      execution: { mode: "branch", baseBranch: "main", featureBranch: `feature/${SPEC_ID}` },
      specRecord: { goal: "fixture", requirements: [{ id: "R-T-1", desc: "Complete the first Task.", task_ids: ["T-1"] }] },
      taskDocuments: [{ id: "T-1", title: "first", goal: "finish", parent: null, origin: "plan", added_round: 0, status: "pending" }],
      taskId: "T-1", targetStep: "task-gate",
    }).create();
    fixture.flow.flow.settle("T-1-gate").activate("test-execute");
    const state = flowManager.loadReadOnly(SPEC_ID);

    const result = await new RunReopenDraftCommand().execute(commandContext(flowManager, state, { category: "task-addition", reason: "add another task" }));

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.mode, "implementation");
    assert.equal(result.data.doneTaskCount, 1);
    assert.equal(flowManager.loadReadOnly(SPEC_ID).currentNodeId, "draft");
    assert.equal(flowManager.activityLedger(SPEC_ID).at(-2).transition.operation, "reopen_draft_task_addition");
  });

  it("requires exact guards and catalog draft/spec authority for spec correction", async () => {
    root = createTmpDir("reopen-draft-correction-");
    const flowManager = makeFlowManager(root);
    const fixture = new FlowAtStepFixture({
      flowManager, specId: SPEC_ID, runId: "run-reopen-correction", request: "correct spec",
      execution: { mode: "branch", baseBranch: "main", featureBranch: `feature/${SPEC_ID}` }, issue: 441,
      issueSnapshot: "# Issue 441\nbody\n", specRecord: { goal: "fixture", requirements: [] }, targetStep: "draft",
    }).create();
    flowManager.publishCurrentAttemptResult({
      specId: SPEC_ID,
      commandResult: attachCanonicalCommandResultPublications({ result: "ok" }, [{
        logicalKey: "draft", payload: canonicalDraftDocument({ goal: "fixture" }),
      }]),
    });
    fixture.flow.flow.activate("implement");
    const state = flowManager.loadReadOnly(SPEC_ID);

    const missingGuard = await new RunReopenDraftCommand().execute(commandContext(flowManager, state, {
      category: "spec-correction", reason: "contradictory requirement",
    }));
    assert.equal(missingGuard.ok, false);
    assert.equal(missingGuard.errors[0].code, "TARGET_GUARDS_REQUIRED");

    const result = await new RunReopenDraftCommand().execute(commandContext(flowManager, state, {
      category: "spec-correction", reason: "contradictory requirement",
      expectRunId: state.runId, expectSpec: state.specId, expectIssue: 441,
    }));
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.mode, "spec-correction");
    assert.ok(result.data.evidence.draftBytes > 0);
    assert.ok(result.data.evidence.specRecordBytes > 0);
    assert.equal(flowManager.loadReadOnly(SPEC_ID).currentNodeId, "draft");
    assert.equal(flowManager.activityLedger(SPEC_ID).at(-2).transition.operation, "reopen_draft_spec_correction");
  });
});
