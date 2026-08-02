import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { FlowStateRevision } from "../../../src/lib/flow-state-atomic-writer.js";
import { FlowState, FlowStepLedger } from "../../../src/lib/flow-state.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "420-flow-state";

function state() {
  return {
    specId: SPEC_ID,
    runId: "run-420",
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
  };
}

function manager(root) {
  return new FlowManager({ root, mainRoot: root, inWorktree: false });
}

describe("FlowState persistence invariants", () => {
  it("represents a definition-bound ledger and validates its loaded revision", () => {
    const value = state();
    const content = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
    const revision = new FlowStateRevision(content);
    const flow = new FlowState(value, { revision });

    assert.ok(flow.steps instanceof FlowStepLedger);
    assert.equal(flow.revision, revision);
    assert.deepEqual(flow.toJSON(), value);
    assert.throws(() => new FlowState(value, { revision: {} }), /revision/);
    assert.throws(
      () => new FlowState({ ...value, request: "changed after revision" }, { revision }),
      /revision does not match state content/,
    );
  });

  it("rejects definition drift and competing active leaves before construction", () => {
    const unknown = state();
    findStepById(unknown.steps, "branch").id = "unknown-branch";
    assert.throws(() => new FlowState(unknown), /definition/);

    const competing = state();
    findStepById(competing.steps, "draft").status = "in_progress";
    assert.throws(() => new FlowState(competing), /multiple active flow leaves/);

    const competingTasks = state();
    findStepById(competingTasks.steps, "branch").status = "done";
    findStepById(competingTasks.steps, "implement").status = "in_progress";
    competingTasks.tasks = ["T-1", "T-2"].map((id) => ({
      id,
      status: "in_progress",
      steps: [{ id: "task-impl", status: "in_progress" }],
    }));
    competingTasks.currentTaskId = "T-1";
    assert.throws(() => new FlowState(competingTasks), /multiple active task steps/);
  });

  it("rejects an invalid create or mutation without changing visible bytes", () => {
    const root = createTmpDir("flow-state-invariant-boundary-");
    try {
      const fm = manager(root);
      const invalid = state();
      findStepById(invalid.steps, "draft").status = "in_progress";
      assert.throws(
        () => fm.create(invalid),
        (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED",
      );
      assert.equal(fs.existsSync(path.join(root, "specs", SPEC_ID, "flow.json")), false);

      fm.create(state());
      const file = path.join(root, "specs", SPEC_ID, "flow.json");
      const before = fs.readFileSync(file);
      assert.throws(
        () => fm.forRoot(root, { specId: SPEC_ID }).mutate((next) => {
          findStepById(next.steps, "draft").status = "in_progress";
        }),
        (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED",
      );
      assert.deepEqual(fs.readFileSync(file), before);
    } finally {
      removeTmpDir(root);
    }
  });

  it("rejects removed direct recovery state before it becomes a normal Flow route", () => {
    const root = createTmpDir("flow-state-removed-direct-");
    try {
      const fm = manager(root);
      const legacy = { ...state(), directFlowSession: { phase: "COMPLETED_DIRECT" } };
      const specDir = path.join(root, "specs", SPEC_ID);
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "flow.json"), `${JSON.stringify(legacy, null, 2)}\n`);
      assert.throws(
        () => fm.load(SPEC_ID),
        (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED" && /removed direct recovery state/.test(error.message),
      );
    } finally {
      removeTmpDir(root);
    }
  });
});
