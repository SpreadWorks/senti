/**
 * tests/unit/flow/finalize-merge-retry.test.js
 *
 * Spec 251 R6 / R20 / R21: failed merge retry contract.
 *
 * - On finalize-merge failure, the onError hook marks finalize-sync and
 *   finalize-cleanup as 'skipped' so the dispatcher does not advance into
 *   a half-merged state.
 * - On retry success, the pre hook (run before the next merge attempt)
 *   resets those 'skipped' steps back to 'pending'. This serves two
 *   purposes (R20 / R21): the worktree's flow.json no longer carries the
 *   stale onError write that would otherwise dirty the pre-merge tree, and
 *   `promoteNextPendingLeaf` can now advance to finalize-sync after the
 *   post hook normalizes finalize-merge to 'done'.
 * - On retry success, the post hook also re-normalizes finalize-merge to
 *   'done' on the main repo flow.json and reset any lingering 'skipped'
 *   downstream leaves (idempotent with the pre hook). The covered path
 *   here is the worktree-cwd happy retry: pre resets, post normalizes.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager } from "../../helpers/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { findStepById } from "../../../src/flow/definition.js";

function getStep(state, id) {
  return findStepById(state.steps, id);
}

describe("finalize-merge — failed merge retry contract (spec 251)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("onError marks finalize-sync and finalize-cleanup as skipped", async () => {
    tmp = createTmpDir("sdd-finalize-merge-retry-");
    setupFlow(tmp);
    const fm = makeFlowManager(tmp);

    const entry = FLOW_COMMANDS.run["finalize-merge"];
    const ctx = {
      flowManager: fm,
      flowState: fm.load(),
      root: tmp,
    };
    await entry.onError(ctx, new Error("merge failed"));

    const after = fm.load();
    assert.equal(getStep(after, "finalize-sync").status, "skipped");
    assert.equal(getStep(after, "finalize-cleanup").status, "skipped");
  });

  it("pre hook resets skipped finalize-sync/cleanup back to pending before retry", async () => {
    tmp = createTmpDir("sdd-finalize-merge-retry-reset-");
    setupFlow(tmp);
    const fm = makeFlowManager(tmp);

    // Simulate prior failure leaving sync/cleanup skipped.
    fm.updateStepStatus("finalize-sync", "skipped");
    fm.updateStepStatus("finalize-cleanup", "skipped");

    const entry = FLOW_COMMANDS.run["finalize-merge"];
    const ctx = {
      flowManager: fm,
      flowState: fm.load(),
      root: tmp,
    };
    entry.pre(ctx);

    const after = fm.load();
    assert.equal(getStep(after, "finalize-sync").status, "pending");
    assert.equal(getStep(after, "finalize-cleanup").status, "pending");
  });

  it("post hook on retry success normalizes finalize-merge to done and resets skipped downstream", async () => {
    tmp = createTmpDir("sdd-finalize-merge-retry-post-");
    setupFlow(tmp);
    const fm = makeFlowManager(tmp);

    // Simulate a stale skipped left over from an earlier failure that the
    // pre hook somehow missed (paranoia path covered by R6).
    fm.updateStepStatus("finalize-cleanup", "skipped");

    const entry = FLOW_COMMANDS.run["finalize-merge"];
    const ctx = {
      flowManager: fm,
      flowState: fm.load(),
      root: tmp,
    };
    await entry.post(ctx, { status: "done", strategy: "squash" });

    const after = fm.load();
    assert.equal(getStep(after, "finalize-merge").status, "done");
    assert.equal(getStep(after, "finalize-cleanup").status, "pending");
  });

  it("post hook does nothing on failed status (no normalization)", async () => {
    tmp = createTmpDir("sdd-finalize-merge-retry-fail-");
    setupFlow(tmp);
    const fm = makeFlowManager(tmp);

    fm.updateStepStatus("finalize-merge", "in_progress");
    const entry = FLOW_COMMANDS.run["finalize-merge"];
    const ctx = {
      flowManager: fm,
      flowState: fm.load(),
      root: tmp,
    };
    await entry.post(ctx, { status: "failed", message: "merge conflict" });

    const after = fm.load();
    assert.equal(getStep(after, "finalize-merge").status, "in_progress");
  });
});
