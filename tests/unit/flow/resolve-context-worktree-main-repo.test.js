/**
 * tests/unit/flow/resolve-context-worktree-main-repo.test.js
 *
 * Regression test for spec 219: when running inside a worktree, both
 * `flow get resolve-context` and `flow run resume` must return
 * data.mainRepoPath pointing to the primary repository — not to the
 * worktree itself.
 *
 * Before the fix the commands set `mainRepoPath = ctx.root`, which
 * collapsed to the worktree path in worktree mode and silently broke
 * the `cd <mainRepoPath>` post-finalize recovery documented in the
 * flow-finalize skill.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import GetResolveContextCommand from "../../../src/flow/lib/get-resolve-context.js";
import RunResumeCommand from "../../../src/flow/lib/run-resume.js";

function setupMainAndWorktree() {
  const mainRoot = createTmpDir("senrail-main-");
  execFileSync("git", ["init", mainRoot], { encoding: "utf8" });
  execFileSync("git", ["-C", mainRoot, "commit", "--allow-empty", "-m", "init"], { encoding: "utf8" });

  const worktreePath = path.join(mainRoot, ".senrail", "worktree", "feature-001-test");
  fs.mkdirSync(path.dirname(worktreePath), { recursive: true });
  execFileSync(
    "git",
    ["-C", mainRoot, "worktree", "add", worktreePath, "-b", "feature/001-test"],
    { encoding: "utf8" },
  );
  return { mainRoot, worktreePath };
}

function writeFlowState(mainRoot) {
  const specId = "001-test";
  const specDir = path.join(mainRoot, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), '{"requirements":[]}\n');
  const state = {
    specId,
    runId: "run-001-test",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    worktree: true,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
  };
  fs.writeFileSync(path.join(specDir, "flow.json"), JSON.stringify(state, null, 2));
  return state;
}

function prepareWorktreeCommandCtx() {
  const { mainRoot, worktreePath } = setupMainAndWorktree();
  const state = writeFlowState(mainRoot);
  const flowManager = new FlowManager({ root: worktreePath, mainRoot, inWorktree: true });
  const ctx = {
    root: worktreePath,
    mainRoot,
    flowManager,
    flowState: state,
    inWorktree: true,
  };
  return { ctx, mainRoot, worktreePath };
}

describe("flow resolve-context / resume (worktree mainRepoPath)", () => {
  let mainRoot;
  let worktreePath;

  afterEach(() => {
    if (mainRoot && worktreePath) {
      try {
        execFileSync("git", ["-C", mainRoot, "worktree", "remove", "--force", worktreePath], { encoding: "utf8" });
      } catch (err) {
        // Cleanup errors are non-fatal (tmp dir removal below still runs),
        // but surface them so silent failures do not accumulate untracked worktrees.
        process.stderr.write(`[test cleanup] worktree remove failed: ${err.message}\n`);
      }
    }
    if (mainRoot) removeTmpDir(mainRoot);
    mainRoot = null;
    worktreePath = null;
  });

  it("flow get resolve-context returns mainRepoPath pointing to the primary repo (REQ-1)", () => {
    let ctx;
    ({ ctx, mainRoot, worktreePath } = prepareWorktreeCommandCtx());

    const result = new GetResolveContextCommand().execute(ctx);

    assert.equal(result.mainRepoPath, mainRoot, "mainRepoPath must equal the primary repo path");
    assert.equal(result.worktreePath, worktreePath, "worktreePath must equal the worktree path");
    assert.notEqual(result.mainRepoPath, result.worktreePath, "mainRepoPath must not collapse to worktreePath");
    assert.ok(fs.existsSync(result.mainRepoPath), "mainRepoPath must exist on disk");
    assert.ok(fs.existsSync(result.worktreePath), "worktreePath must exist on disk");
  });

  it("flow run resume returns mainRepoPath pointing to the primary repo (REQ-2)", () => {
    let ctx;
    ({ ctx, mainRoot, worktreePath } = prepareWorktreeCommandCtx());

    const result = new RunResumeCommand().execute(ctx);

    assert.equal(result.mainRepoPath, mainRoot);
    assert.equal(result.worktreePath, worktreePath);
    assert.notEqual(result.mainRepoPath, result.worktreePath);
  });
});
