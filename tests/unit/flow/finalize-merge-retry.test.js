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
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  makeFlowManager,
  makeLifecycleStepTransition,
  setupFlow,
} from "../../helpers/flow-setup.js";
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
  fm.mutate((state) => {
    let reachedMerge = false;
    for (const step of flattenSteps(state.steps)) {
      if (step.id === "finalize-merge") {
        step.status = "in_progress";
        reachedMerge = true;
      } else {
        step.status = reachedMerge ? "pending" : "done";
      }
    }
  });
  return fm.load();
}

function beginFinalizeMergeOutbox(fm, state) {
  return new FlowOutboxStore(fm).begin(finalizationOutboxIdentity(state, "finalize-merge"));
}

function specIdFromState(state) {
  return path.basename(path.dirname(state.spec));
}

function skipFinalizeStep(fm, specId, stepId) {
  const transition = makeLifecycleStepTransition(
    fm.loadReadOnly(specId),
    stepId,
    "skipped",
    "definition:skip-steps",
  );
  fm.updateStepStatus(transition, { specId });
}

describe("finalize-merge — failed merge retry contract (spec 251)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("onError marks finalize-sync and finalize-cleanup as skipped", async () => {
    tmp = createTmpDir("senti-finalize-merge-retry-");
    initGitRepo(tmp);
    setupFlow(tmp);
    commitAll(tmp, "test: initial flow state");
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
    await entry.onError(ctx, new Error("merge failed"));

    const after = fm.load();
    assert.equal(getStep(after, "finalize-sync").status, "skipped");
    assert.equal(getStep(after, "finalize-cleanup").status, "skipped");
  });

  it("pre hook resets skipped finalize-sync/cleanup back to pending before retry", async () => {
    tmp = createTmpDir("senti-finalize-merge-retry-reset-");
    initGitRepo(tmp);
    const state = setupFlow(tmp);
    commitAll(tmp, "test: initial flow state");
    const fm = makeFlowManager(tmp);
    const specId = specIdFromState(state);
    const activeState = activateFinalizeMerge(fm);

    // Simulate prior failure leaving sync/cleanup skipped.
    skipFinalizeStep(fm, specId, "finalize-sync");
    skipFinalizeStep(fm, specId, "finalize-cleanup");

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
    tmp = createTmpDir("senti-finalize-merge-retry-post-");
    const state = setupFlow(tmp);
    const fm = makeFlowManager(tmp);
    const activeState = activateFinalizeMerge(fm);
    const specId = specIdFromState(state);

    // Simulate a stale skipped left over from an earlier failure that the
    // pre hook somehow missed (paranoia path covered by R6).
    skipFinalizeStep(fm, specId, "finalize-cleanup");
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
    tmp = createTmpDir("senti-finalize-merge-retry-fail-");
    const state = setupFlow(tmp);
    const fm = makeFlowManager(tmp);
    const specId = specIdFromState(state);

    const activeState = activateFinalizeMerge(fm);
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
