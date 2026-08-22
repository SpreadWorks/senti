import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { FlowAtStepFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";

describe("canonical set-step implementation repair", () => {
  let root = null;

  afterEach(() => {
    if (root !== null) removeTmpDir(root);
    root = null;
  });

  function contextAt(targetStep, runId) {
    root = createTmpDir("set-step-canonical-impl-repair-");
    const flowManager = makeFlowManager(root);
    const specId = "001-test";
    new FlowAtStepFixture({
      flowManager,
      specId,
      runId,
      request: "Exercise canonical implementation recovery.",
      targetStep,
      specRecord: { goal: "repair fixture", requirements: [] },
    }).create();
    return { root, flowManager, specId };
  }

  it("confirms impl-repair through the Version Store without legacy repair sidecars", async () => {
    const ctx = contextAt("impl-repair", "run-impl-repair");

    const result = await new SetStepCommand().execute({
      ...ctx,
      id: "impl-repair",
      status: "done",
    });

    assert.deepEqual(result, { id: "impl-repair", status: "done" });
    const state = ctx.flowManager.loadReadOnly(ctx.specId);
    assert.equal(findStepById(state.steps, "impl-repair").status, "done");
    assert.equal(state.currentNodeId, null);
    assert.equal(ctx.flowManager.activityLedger(ctx.specId).at(-1).transition.operation, "confirm_attempt");
    assert.equal(fs.existsSync(path.join(root, "specs", ctx.specId, "impl-repair.json")), false);
    assert.equal(fs.existsSync(path.join(root, "specs", ctx.specId, "impl-repair-transaction.json")), false);
  });

  it("confirms impl-triage through the same typed Attempt boundary", async () => {
    const ctx = contextAt("impl-triage", "run-impl-triage");

    const result = await new SetStepCommand().execute({
      ...ctx,
      id: "impl-triage",
      status: "skipped",
    });

    assert.deepEqual(result, { id: "impl-triage", status: "skipped" });
    assert.equal(findStepById(ctx.flowManager.loadReadOnly(ctx.specId).steps, "impl-triage").status, "skipped");
    assert.equal(ctx.flowManager.activityLedger(ctx.specId).at(-1).transition.operation, "confirm_attempt");
    assert.equal(fs.existsSync(path.join(root, "specs", ctx.specId, "impl-triage.json")), false);
  });

  it("rejects completion of a non-current implementation leaf", async () => {
    const ctx = contextAt("impl-triage", "run-wrong-impl-target");

    const result = await new SetStepCommand().execute({
      ...ctx,
      id: "impl-repair",
      status: "done",
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FLOW_STEP_TRANSITION_INVALID");
    assert.match(result.errors[0].messages[0], /not the current step/);
    assert.equal(findStepById(ctx.flowManager.loadReadOnly(ctx.specId).steps, "impl-triage").status, "in_progress");
  });

  it("rejects a noncanonical mutable state instead of replaying a repair transaction", async () => {
    const result = await new SetStepCommand().execute({
      root: process.cwd(),
      flowManager: { load: () => ({ specId: "legacy", steps: [] }) },
      id: "impl-repair",
      status: "done",
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "CANONICAL_FLOW_REQUIRED");
  });
});
