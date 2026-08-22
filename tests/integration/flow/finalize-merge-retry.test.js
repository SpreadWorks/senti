/**
 * tests/integration/flow/finalize-merge-retry.test.js
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
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import {
  CanonicalFlowFixture,
  makeFlowManager,
} from "../../support/infrastructure/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import {
  FlowOutboxStore,
  finalizationOutboxIdentity,
} from "../../../src/flow/lib/flow-outbox.js";

function getStep(state, id) {
  return findStepById(state.steps, id);
}

function initGitRepo(root) {
  execFileSync("git", ["init", "--quiet", root], { encoding: "utf8" });
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"], { encoding: "utf8" });
  execFileSync("git", ["-C", root, "config", "user.name", "Test User"], { encoding: "utf8" });
}

function commitAll(root, message) {
  execFileSync("git", ["-C", root, "add", "-A"], { encoding: "utf8" });
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", message], { encoding: "utf8" });
}

function activateFinalizeMerge(fm) {
  const fixture = new CanonicalFlowFixture({ flowManager: fm }).create().registerActive().activate("finalize-merge");
  return fixture.state();
}

function beginFinalizeMergeOutbox(fm, state) {
  return new FlowOutboxStore(fm).begin(finalizationOutboxIdentity(state, "finalize-merge"));
}

function specIdFromState(state) {
  return state.specId;
}

function skipFinalizeSteps(fm, specId, stepIds) {
  return fm.finalizeDownstream({ specId, action: "skip", stepIds });
}

describe("finalize-merge — failed merge retry contract (spec 251)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("onError marks finalize-sync and finalize-cleanup as skipped", async () => {
    tmp = createTmpDir("sennel-finalize-merge-retry-");
    initGitRepo(tmp);
    const fm = makeFlowManager(tmp);
    const activeState = activateFinalizeMerge(fm);
    commitAll(tmp, "test: initial flow state");
    const specId = specIdFromState(activeState);
    beginFinalizeMergeOutbox(fm, activeState);

    const entry = FLOW_COMMANDS.run["finalize-merge"];
    const ctx = {
      flowManager: fm,
      flowState: activeState,
      root: tmp,
      specId,
    };
    await entry.onError(ctx, new Error("merge failed"));

    const after = fm.load();
    assert.equal(getStep(after, "finalize-sync").status, "skipped");
    assert.equal(getStep(after, "finalize-cleanup").status, "skipped");
  });

  it("pre hook resets skipped finalize-sync/cleanup back to pending before retry", async () => {
    tmp = createTmpDir("sennel-finalize-merge-retry-reset-");
    initGitRepo(tmp);
    const fm = makeFlowManager(tmp);
    const activeState = activateFinalizeMerge(fm);
    commitAll(tmp, "test: initial flow state");
    const specId = specIdFromState(activeState);

    // Simulate prior failure leaving sync/cleanup skipped.
    skipFinalizeSteps(fm, specId, ["finalize-sync", "finalize-cleanup"]);

    const entry = FLOW_COMMANDS.run["finalize-merge"];
    const ctx = {
      flowManager: fm,
      flowState: activeState,
      root: tmp,
      specId,
    };
    await entry.pre(ctx);

    const after = fm.load();
    assert.equal(getStep(after, "finalize-sync").status, "pending");
    assert.equal(getStep(after, "finalize-cleanup").status, "pending");
  });

  it("post hook on retry success normalizes finalize-merge to done and resets skipped downstream", async () => {
    tmp = createTmpDir("sennel-finalize-merge-retry-post-");
    const fm = makeFlowManager(tmp);
    const activeState = activateFinalizeMerge(fm);
    const specId = specIdFromState(activeState);

    // Simulate a stale skipped left over from an earlier failure that the
    // pre hook somehow missed (paranoia path covered by R6).
    skipFinalizeSteps(fm, specId, ["finalize-cleanup"]);
    beginFinalizeMergeOutbox(fm, activeState);

    const entry = FLOW_COMMANDS.run["finalize-merge"];
    const ctx = {
      flowManager: fm,
      flowState: activeState,
      root: tmp,
      specId,
    };
    await entry.post(ctx, { status: "done", strategy: "squash" });

    const after = fm.load();
    assert.equal(getStep(after, "finalize-merge").status, "done");
    assert.equal(getStep(after, "finalize-cleanup").status, "pending");
  });

  it("post hook does nothing on failed status (no normalization)", async () => {
    tmp = createTmpDir("sennel-finalize-merge-retry-fail-");
    const fm = makeFlowManager(tmp);
    const activeState = activateFinalizeMerge(fm);
    const specId = specIdFromState(activeState);
    beginFinalizeMergeOutbox(fm, activeState);
    const entry = FLOW_COMMANDS.run["finalize-merge"];
    const ctx = {
      flowManager: fm,
      flowState: activeState,
      root: tmp,
      specId,
    };
    await entry.post(ctx, { status: "failed", message: "merge conflict" });

    const after = fm.load();
    assert.equal(getStep(after, "finalize-merge").status, "in_progress");
  });
});
