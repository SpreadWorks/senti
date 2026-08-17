import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runMerge, runPreSync } from "../../../src/flow/commands/merge.js";
import { rebaseOnto } from "../../../src/lib/git-helpers.js";
import { runCmd } from "../../../src/lib/process.js";
import { container } from "../../../src/lib/container.js";

function init(dir) {
  runCmd("git", ["init", "-q", "-b", "main", dir]);
  runCmd("git", ["-C", dir, "config", "user.email", "t@example.com"]);
  runCmd("git", ["-C", dir, "config", "user.name", "T"]);
  runCmd("git", ["-C", dir, "config", "commit.gpgsign", "false"]);
}

function commitIn(dir, file, content, msg) {
  fs.writeFileSync(path.join(dir, file), content);
  runCmd("git", ["-C", dir, "add", file]);
  runCmd("git", ["-C", dir, "commit", "-q", "-m", msg]);
}

// R4: rebaseOnto distinguishes dirty worktree from conflict
describe("rebaseOnto — dirty worktree detection (R4)", () => {
  let upstream, clone;
  beforeEach(() => {
    upstream = fs.mkdtempSync(path.join(os.tmpdir(), "r4-up-"));
    init(upstream);
    commitIn(upstream, "a.txt", "a", "base");

    clone = fs.mkdtempSync(path.join(os.tmpdir(), "r4-cl-"));
    runCmd("git", ["clone", "-q", upstream, clone]);
    runCmd("git", ["-C", clone, "config", "user.email", "t@example.com"]);
    runCmd("git", ["-C", clone, "config", "user.name", "T"]);
    runCmd("git", ["-C", clone, "config", "commit.gpgsign", "false"]);
  });
  afterEach(() => {
    fs.rmSync(upstream, { recursive: true, force: true });
    fs.rmSync(clone, { recursive: true, force: true });
  });

  it("returns reason:'dirty' when worktree has unstaged changes", () => {
    runCmd("git", ["-C", clone, "checkout", "-b", "feature"]);
    commitIn(clone, "b.txt", "b", "feat");
    commitIn(upstream, "c.txt", "c", "advance base");
    runCmd("git", ["-C", clone, "fetch", "-q", "origin", "main"]);
    // make worktree dirty
    fs.writeFileSync(path.join(clone, "b.txt"), "dirty-change");

    const result = rebaseOnto("origin/main", { cwd: clone });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "dirty");
    assert.deepEqual(result.conflictFiles, []);
  });

  it("returns reason:'conflict' when rebase has actual conflicts", () => {
    runCmd("git", ["-C", clone, "checkout", "-b", "feature"]);
    fs.writeFileSync(path.join(clone, "a.txt"), "feature-change");
    runCmd("git", ["-C", clone, "add", "a.txt"]);
    runCmd("git", ["-C", clone, "commit", "-q", "-m", "feat"]);
    fs.writeFileSync(path.join(upstream, "a.txt"), "upstream-change");
    runCmd("git", ["-C", upstream, "add", "a.txt"]);
    runCmd("git", ["-C", upstream, "commit", "-q", "-m", "up"]);
    runCmd("git", ["-C", clone, "fetch", "-q", "origin", "main"]);

    const result = rebaseOnto("origin/main", { cwd: clone });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "conflict");
    assert.ok(result.conflictFiles.includes("a.txt"));
    // cleanup
    runCmd("git", ["-C", clone, "rebase", "--abort"]);
  });
});

// R5: dirty worktree error message in runPreSync
describe("runPreSync — dirty worktree error message (R5)", () => {
  let upstream, worktree;
  beforeEach(() => {
    upstream = fs.mkdtempSync(path.join(os.tmpdir(), "r5-up-"));
    init(upstream);
    commitIn(upstream, "a.txt", "a", "base");
    worktree = fs.mkdtempSync(path.join(os.tmpdir(), "r5-wt-"));
    runCmd("git", ["clone", "-q", upstream, worktree]);
    runCmd("git", ["-C", worktree, "config", "user.email", "t@example.com"]);
    runCmd("git", ["-C", worktree, "config", "user.name", "T"]);
    runCmd("git", ["-C", worktree, "config", "commit.gpgsign", "false"]);
    runCmd("git", ["-C", worktree, "checkout", "-b", "feature"]);
    commitIn(worktree, "b.txt", "b", "feat");
    commitIn(upstream, "c.txt", "c", "advance");
  });
  afterEach(() => {
    fs.rmSync(upstream, { recursive: true, force: true });
    fs.rmSync(worktree, { recursive: true, force: true });
  });

  it("throws with 'uncommitted changes' message when worktree is dirty", () => {
    fs.writeFileSync(path.join(worktree, "b.txt"), "dirty");

    const result = runPreSync({ worktreePath: worktree, baseBranch: "main", remote: "origin" });
    // dirty rebase should produce a specific error, not a conflict error
    // Current behavior (pre-fix): conflictFiles is empty, message says "conflicts in "
    // Expected behavior (post-fix): error mentions "uncommitted changes"
    assert.equal(result.ok, false);
    // Post-fix expectation: the error should indicate dirty worktree, not empty conflicts
    // For now, this test documents the expected behavior — it will fail before implementation
    assert.ok(
      result.dirty === true || (result.recoveryHint && result.recoveryHint.includes("uncommitted changes")),
      `Expected dirty indicator or 'uncommitted changes' in hint, got: ${JSON.stringify(result)}`,
    );
  });
});

// R1, R2, R3: worktree squash merge creates squash commit on baseBranch
describe("runMerge — worktree squash route with baseBranch checkout (R1, R2, R3)", () => {
  let mainRepo, worktreeDir;

  function setupRepos() {
    mainRepo = fs.mkdtempSync(path.join(os.tmpdir(), "mr-main-"));
    init(mainRepo);
    commitIn(mainRepo, "init.txt", "init", "initial");

    // create a feature branch in main repo
    runCmd("git", ["-C", mainRepo, "checkout", "-b", "feature"]);
    commitIn(mainRepo, "feat.txt", "feat", "feature commit");

    // go back to main
    runCmd("git", ["-C", mainRepo, "checkout", "main"]);

    // simulate worktree: clone main repo to act as worktree on feature branch
    worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "mr-wt-"));
    runCmd("git", ["clone", "-q", mainRepo, worktreeDir]);
    runCmd("git", ["-C", worktreeDir, "config", "user.email", "t@example.com"]);
    runCmd("git", ["-C", worktreeDir, "config", "user.name", "T"]);
    runCmd("git", ["-C", worktreeDir, "config", "commit.gpgsign", "false"]);
    runCmd("git", ["-C", worktreeDir, "checkout", "feature"]);
  }

  beforeEach(() => {
    setupRepos();
    container.set("config", {});
    container.set("root", worktreeDir);
  });
  afterEach(() => {
    fs.rmSync(mainRepo, { recursive: true, force: true });
    fs.rmSync(worktreeDir, { recursive: true, force: true });
  });

  it("R1: squash merge creates commit on baseBranch even when main repo is on a different branch", () => {
    // Put main repo on a non-baseBranch
    runCmd("git", ["-C", mainRepo, "checkout", "-b", "other-branch"]);
    commitIn(mainRepo, "other.txt", "other", "other branch commit");

    // Verify main repo is NOT on baseBranch
    const currentBranch = runCmd("git", ["-C", mainRepo, "rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
    assert.equal(currentBranch, "other-branch");

    try {
      runMerge({
        root: worktreeDir,
        flowState: { baseBranch: "main", featureBranch: "feature", worktree: true },
        worktreePath: worktreeDir,
        mainRepoPath: mainRepo,
      });

      // After fix: squash commit should be on baseBranch (main), not other-branch
      const mainLog = runCmd("git", ["-C", mainRepo, "log", "--oneline", "main"]).stdout;
      assert.ok(mainLog.includes("feature"), "expected squash commit on main branch");
    } catch (e) {
      // Before fix: this may fail or create commit on wrong branch
      // The test documents expected post-fix behavior
      assert.fail(`runMerge should succeed but threw: ${e.message}`);
    }
  });

  it("R2: squash merge succeeds when baseBranch is checked out in another worktree", () => {
    // Create another worktree that locks baseBranch (main)
    const lockingWorktree = fs.mkdtempSync(path.join(os.tmpdir(), "mr-lock-"));
    try {
      runCmd("git", ["-C", mainRepo, "worktree", "add", lockingWorktree, "main"]);
      // Now main repo cannot checkout 'main' because it's locked by another worktree

      // Put main repo on a different branch
      runCmd("git", ["-C", mainRepo, "checkout", "-b", "temp-branch"]);

      runMerge({
        root: worktreeDir,
        flowState: { baseBranch: "main", featureBranch: "feature", worktree: true },
        worktreePath: worktreeDir,
        mainRepoPath: mainRepo,
      });

      // baseBranch should have been updated via fallback
      const mainLog = runCmd("git", ["-C", mainRepo, "log", "--oneline", "main"]).stdout;
      assert.ok(mainLog.includes("feature"), "expected squash commit on main branch via fallback");
    } catch (e) {
      assert.fail(`runMerge should succeed via fallback but threw: ${e.message}`);
    } finally {
      runCmd("git", ["-C", mainRepo, "worktree", "remove", "--force", lockingWorktree]);
      fs.rmSync(lockingWorktree, { recursive: true, force: true });
    }
  });

  it("R3: temporary worktree is cleaned up after merge", () => {
    // Create another worktree that locks baseBranch to force fallback path
    const lockingWorktree = fs.mkdtempSync(path.join(os.tmpdir(), "mr-cl-"));
    try {
      runCmd("git", ["-C", mainRepo, "worktree", "add", lockingWorktree, "main"]);
      runCmd("git", ["-C", mainRepo, "checkout", "-b", "temp-branch"]);

      runMerge({
        root: worktreeDir,
        flowState: { baseBranch: "main", featureBranch: "feature", worktree: true },
        worktreePath: worktreeDir,
        mainRepoPath: mainRepo,
      });

      // Check no temporary worktrees remain (only lockingWorktree + main repo)
      const worktreeList = runCmd("git", ["-C", mainRepo, "worktree", "list"]).stdout;
      const lines = worktreeList.trim().split("\n");
      // Should have: mainRepo, lockingWorktree, worktreeDir (3 entries, no temp)
      for (const line of lines) {
        assert.ok(!line.includes("sdd-merge-tmp"), `temporary worktree should be cleaned up: ${line}`);
      }
    } catch (e) {
      assert.fail(`runMerge should succeed but threw: ${e.message}`);
    } finally {
      runCmd("git", ["-C", mainRepo, "worktree", "remove", "--force", lockingWorktree]);
      fs.rmSync(lockingWorktree, { recursive: true, force: true });
    }
  });
});
