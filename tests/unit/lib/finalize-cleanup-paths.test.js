import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import {
  FINALIZE_CLEANUP_DURABLE_AGENT_WORK_DIR,
  FinalizeCleanupPathResolver,
  FinalizeCleanupRoute,
} from "../../../src/lib/finalize-cleanup-paths.js";

test("finalize cleanup command and dispatcher share one destructive route contract", () => {
  assert.equal(
    FinalizeCleanupRoute
      .fromCliArgs(["flow", "run", "finalize-cleanup"])
      .removesManagedWorktree,
    true,
  );
  assert.equal(
    FinalizeCleanupRoute.fromDispatch({ envelopeKey: "finalize-cleanup" }).removesManagedWorktree,
    true,
  );
});

test("cleanup logging authority is relocated to the durable main repository", () => {
  const worktreeRoot = path.resolve("/repo/.senti/worktree/feature-demo");
  const mainRoot = path.resolve("/repo");
  const resolver = new FinalizeCleanupPathResolver({
    enabled: true,
    worktreeRoot,
    mainRoot,
    inWorktree: true,
  });
  const calls = [];
  const durableManager = { authority: "main" };
  const worktreeManager = {
    forRoot(root) {
      calls.push(root);
      return durableManager;
    },
  };

  assert.equal(resolver.authorityRoot, mainRoot);
  assert.equal(resolver.flowManager(worktreeManager), durableManager);
  assert.deepEqual(calls, [mainRoot]);
  assert.equal(
    resolver.agentWorkDir(path.join(worktreeRoot, ".tmp")),
    path.join(mainRoot, FINALIZE_CLEANUP_DURABLE_AGENT_WORK_DIR),
  );
  assert.equal(
    resolver.relocatePath(path.join(worktreeRoot, ".tmp", "logs")),
    path.join(mainRoot, ".tmp", "logs"),
  );
});
