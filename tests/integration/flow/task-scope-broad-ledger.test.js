import assert from "node:assert/strict";
import { test } from "node:test";

import { FlowManager } from "../../../src/lib/flow-manager.js";
import SetBroadCommand from "../../../src/flow/lib/set-broad.js";
import {
  BroadModeLedgerEntry,
  buildBoundedBroadModeHistory,
  latestBroadModeRecord,
} from "../../../src/flow/lib/task-scope.js";
import { CanonicalFlowFixture } from "../../support/infrastructure/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

test("set broad records its audited fact through the canonical Activity note ledger", async () => {
  const root = createTmpDir("canonical-broad-mode-");
  try {
    const manager = new FlowManager({ root, mainRoot: root, inWorktree: false });
    const fixture = new CanonicalFlowFixture({ flowManager: manager, specId: "481-broad", runId: "run-481" })
      .create()
      .addTask({ id: "T-1", title: "Task", goal: "Exercise broad mode.", parent: null, origin: "plan", added_round: 0, status: "pending" })
      .registerActive()
      .activate("implement");
    const result = await new SetBroadCommand().execute({
      action: "on", step: "implement", reason: "The cross-task repair is explicitly audited.",
      flowState: manager.load(fixture.specId), flowManager: manager,
    });
    assert.equal(result.broadMode.step, "implement");
    const state = manager.load(fixture.specId);
    assert.equal(Object.hasOwn(state, "broadModeHistory"), false);
    assert.equal(latestBroadModeRecord(state, "implement").reason, result.broadMode.reason);
    assert.deepEqual(buildBoundedBroadModeHistory(state, 1).entries, [result.broadMode]);
  } finally { removeTmpDir(root); }
});

test("broad mode ledger values reject untyped note payloads", () => {
  assert.equal(BroadModeLedgerEntry.fromActivityNote({ text: "ordinary note" }), null);
  assert.throws(() => BroadModeLedgerEntry.fromActivityNote({ text: "sennel.broad-mode.v1:{" }), SyntaxError);
});
