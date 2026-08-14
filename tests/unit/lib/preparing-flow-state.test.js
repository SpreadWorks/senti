import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

import {
  PreparingFlowState,
  PreparingFlowStateError,
} from "../../../src/lib/preparing-flow-state.js";
import { PreparingFlowStore } from "../../../src/lib/preparing-flow-store.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const minimal = (extra = {}) => ({
  runId: "run-preparing",
  lifecycle: "preparing",
  specId: null,
  autoApprove: false,
  ...extra,
});

describe("PreparingFlowState", () => {
  it("represents only the transient pre-Version contract", () => {
    const value = minimal({
      issue: 420,
      issueBody: "# Linked Issue\n",
      request: "Implement the request",
      autoDesired: true,
      notes: [{ text: "Keep this context", taskId: null, ts: "2026-08-14T00:00:00.000Z" }],
    });
    const state = new PreparingFlowState(value);

    assert.deepEqual(state.toJSON(), value);
    assert.equal(Object.hasOwn(state.toJSON(), "steps"), false);
    assert.equal(Object.hasOwn(state.toJSON(), "tasks"), false);
    assert.equal(Object.hasOwn(state.toJSON(), "outbox"), false);
  });

  it("rejects active-state fields and malformed transient values", () => {
    assert.throws(
      () => new PreparingFlowState(minimal({ steps: [] })),
      (error) => error instanceof PreparingFlowStateError && error.code === "PREPARING_FLOW_STATE_INVALID",
    );
    assert.throws(() => new PreparingFlowState(minimal({ issueBody: "orphan" })), /requires an issue/);
    assert.throws(
      () => new PreparingFlowState(minimal({ notes: [{ text: "note", taskId: "T-1", ts: "invalid" }] })),
      /taskId must be null/,
    );
  });

  it("rejects an invalid mutation without replacing persisted bytes", () => {
    const root = createTmpDir("preparing-flow-schema-");
    try {
      const store = new PreparingFlowStore({ mainRoot: root });
      const file = store.create("run-schema", { request: "before" });
      const before = fs.readFileSync(file);

      assert.throws(
        () => store.mutate("run-schema", (state) => { state.tasks = []; }),
        (error) => error.code === "PREPARING_FLOW_STATE_INVALID",
      );
      assert.deepEqual(fs.readFileSync(file), before);
    } finally {
      removeTmpDir(root);
    }
  });
});
