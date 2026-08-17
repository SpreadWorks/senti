/**
 * Spec verification tests: 149-fix-agent-log-worktree-path
 *
 * Tests for resolveLogDir worktree path fix.
 * Requirements covered: req0, req1, req2, req3
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { createTmpDir, removeTmpDir, useTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { resolveLogDir } from "../../../src/lib/agent-log.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Initialize a git repo and a worktree from it. Returns { mainRepoDir, worktreeDir }. */
function createWorktreeSetup(baseDir) {
  const mainRepoDir = path.join(baseDir, "main");
  const worktreeDir = path.join(baseDir, "worktree");
  fs.mkdirSync(mainRepoDir, { recursive: true });
  execSync("git init", { cwd: mainRepoDir, stdio: "pipe" });
  execSync("git config user.email test@test.com", { cwd: mainRepoDir, stdio: "pipe" });
  execSync("git config user.name test", { cwd: mainRepoDir, stdio: "pipe" });
  fs.writeFileSync(path.join(mainRepoDir, "init.txt"), "init");
  execSync("git add .", { cwd: mainRepoDir, stdio: "pipe" });
  execSync("git commit -m init", { cwd: mainRepoDir, stdio: "pipe" });
  execSync(`git worktree add "${worktreeDir}" -b wt-branch`, {
    cwd: mainRepoDir,
    stdio: "pipe",
  });
  return { mainRepoDir, worktreeDir };
}

// ---------------------------------------------------------------------------
// req0: cfg.logs.dir が設定されている場合は worktree 検出なし
// ---------------------------------------------------------------------------

describe("resolveLogDir — req0: cfg.logs.dir explicit override", () => {
  const getDir = useTmpDir("sdd-149-req0-");

  it("returns cfg.logs.dir as-is without worktree detection", () => {
    const explicitDir = "/some/explicit/log/dir";
    const cfg = { logs: { dir: explicitDir, prompts: true } };
    const result = resolveLogDir(getDir(), cfg);
    assert.equal(result, explicitDir);
  });
});

// ---------------------------------------------------------------------------
// req2: 通常リポジトリ（非 worktree）では cwd ベースのパスを返す
// ---------------------------------------------------------------------------

describe("resolveLogDir — req2: normal repo uses cwd", () => {
  const getDir = useTmpDir("sdd-149-req2-");

  it("returns {cwd}/.tmp/logs when not in a worktree", () => {
    const cfg = { logs: { prompts: true } };
    const result = resolveLogDir(getDir(), cfg);
    assert.equal(result, path.join(getDir(), ".tmp", "logs"));
  });

  it("respects agent.workDir from config", () => {
    const cfg = { agent: { workDir: ".custom" }, logs: { prompts: true } };
    const result = resolveLogDir(getDir(), cfg);
    assert.equal(result, path.join(getDir(), ".custom", "logs"));
  });
});

// ---------------------------------------------------------------------------
// req1: worktree パスを渡した場合、メインリポジトリベースのパスを返す
// ---------------------------------------------------------------------------

describe("resolveLogDir — req1: worktree redirects to main repo", () => {
  const getDir = useTmpDir("sdd-149-req1-");
  let mainRepoDir;
  let worktreeDir;

  before(() => {
    ({ mainRepoDir, worktreeDir } = createWorktreeSetup(getDir()));
  });

  it("returns main repo based path when cwd is a worktree", () => {
    const cfg = { logs: { prompts: true } };
    const result = resolveLogDir(worktreeDir, cfg);
    const expected = path.join(mainRepoDir, ".tmp", "logs");
    assert.equal(result, expected);
  });

  it("respects agent.workDir from config even in worktree", () => {
    const cfg = { agent: { workDir: ".work" }, logs: { prompts: true } };
    const result = resolveLogDir(worktreeDir, cfg);
    const expected = path.join(mainRepoDir, ".work", "logs");
    assert.equal(result, expected);
  });
});

// ---------------------------------------------------------------------------
// req3: getMainRepoPath が失敗した場合はエラーを伝播させる
// ---------------------------------------------------------------------------

describe("resolveLogDir — req3: error propagates when getMainRepoPath fails", () => {
  const getDir = useTmpDir("sdd-149-req3-");

  before(() => {
    // .git file that looks like a worktree but points to a nonexistent location
    fs.writeFileSync(path.join(getDir(), ".git"), "gitdir: /nonexistent/.git/worktrees/fake\n");
  });

  it("throws when .git file exists but git-common-dir resolution fails", () => {
    const cfg = { logs: { prompts: true } };
    assert.throws(() => resolveLogDir(getDir(), cfg), /failed to resolve git-common-dir|not a git repository/i);
  });
});
