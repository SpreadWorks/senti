import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { FlowOutbox, finalizationOutboxIdentity } from "../../../src/flow/lib/flow-outbox.js";
import RunFinalizeCommitCommand from "../../../src/flow/lib/run-finalize-commit.js";
import RunFinalizeMergeCommand from "../../../src/flow/lib/run-finalize-merge.js";
import RunFinalizeSyncCommand from "../../../src/flow/lib/run-finalize-sync.js";
import RunReportCommand from "../../../src/flow/lib/run-report.js";
import { outboxCommitMarker } from "../../../src/flow/lib/run-finalize.js";
import { runGit } from "../../../src/lib/git-helpers.js";
import { container } from "../../../src/lib/container.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import { checkoutNewBranch, commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { makeFlowManager, setupFlow } from "../../helpers/flow-setup.js";

function pendingEntry(state, stepId) {
  const outbox = new FlowOutbox();
  return outbox.begin(finalizationOutboxIdentity(state, stepId), "2026-07-17T00:00:00.000Z");
}

function commitCount(root, ref = "HEAD") {
  const result = runGit(["-C", root, "rev-list", "--count", ref]);
  assert.equal(result.ok, true, result.stderr);
  return Number(result.stdout.trim());
}

function setupFinalizationRepo(root) {
  initGitRepo(root);
  writeFile(root, "README.md", "baseline\n");
  commitAll(root, "test: baseline");
  checkoutNewBranch(root, "feature/001-test");
  const state = setupFlow(root);
  writeFile(root, state.spec, JSON.stringify({ requirements: [] }, null, 2));
  writeFile(root, "src-change.js", "export const changed = true;\n");
  return { state, flowManager: makeFlowManager(root) };
}

describe("finalization command crash resumption", () => {
  it("replays report generation without creating a second durable artifact", async () => {
    const root = createTmpDir("finalize-outbox-report-");
    try {
      const { state, flowManager } = setupFinalizationRepo(root);
      const entry = pendingEntry(state, "report");
      const ctx = { root, flowState: state, flowManager, flowOutboxEntry: entry };
      const reportPath = path.join(root, path.dirname(state.spec), "report.json");

      const first = await new RunReportCommand().execute(ctx);
      assert.equal(first.result, "ok");
      const firstBytes = fs.readFileSync(reportPath);

      const resumed = await new RunReportCommand().execute(ctx);
      assert.equal(resumed.result, "ok");
      assert.deepEqual(fs.readFileSync(reportPath), firstBytes);
    } finally {
      removeTmpDir(root);
    }
  });

  it("does not create a second implementation commit after a pre-post-hook crash", async () => {
    const root = createTmpDir("finalize-outbox-commit-");
    try {
      const { state, flowManager } = setupFinalizationRepo(root);
      const entry = pendingEntry(state, "finalize-commit");
      const ctx = { root, flowState: state, flowManager, flowOutboxEntry: entry };

      const first = await new RunFinalizeCommitCommand().execute(ctx);
      assert.equal(first.status, "done");
      const afterFirst = commitCount(root);

      const resumed = await new RunFinalizeCommitCommand().execute(ctx);
      assert.equal(resumed.resumed, true);
      assert.equal(commitCount(root), afterFirst);
    } finally {
      removeTmpDir(root);
    }
  });

  it("does not create a second squash merge commit after a pre-post-hook crash", async () => {
    const root = createTmpDir("finalize-outbox-merge-");
    try {
      container.set("config", { commands: { gh: "disable" } });
      const { state, flowManager } = setupFinalizationRepo(root);
      commitAll(root, "feat: implementation");
      const entry = pendingEntry(state, "finalize-merge");
      const ctx = { root, flowState: state, flowManager, flowOutboxEntry: entry };

      const first = await new RunFinalizeMergeCommand().execute(ctx);
      assert.equal(first.status, "done");
      const afterFirst = commitCount(root, "main");

      const resumed = await new RunFinalizeMergeCommand().execute(ctx);
      assert.equal(resumed.resumed, true);
      assert.equal(commitCount(root, "main"), afterFirst);
    } finally {
      container.reset();
      removeTmpDir(root);
    }
  });

  it("skips docs sync when its stable outbox commit is already durable", async () => {
    const root = createTmpDir("finalize-outbox-sync-");
    try {
      const { state, flowManager } = setupFinalizationRepo(root);
      const entry = pendingEntry(state, "finalize-sync");
      const marker = outboxCommitMarker(entry.idempotencyKey);
      const committed = runGit(["-C", root, "commit", "--allow-empty", "-m", "docs: sync documentation", "-m", marker]);
      assert.equal(committed.ok, true, committed.stderr);
      const before = commitCount(root);

      const result = await new RunFinalizeSyncCommand().execute({
        root,
        flowState: state,
        flowManager,
        flowOutboxEntry: entry,
      });

      assert.deepEqual(result, { status: "done", resumed: true });
      assert.equal(commitCount(root), before);
      assert.equal(fs.existsSync(path.join(root, "docs", ".outbox-sync-probe")), false);
    } finally {
      removeTmpDir(root);
    }
  });
});
