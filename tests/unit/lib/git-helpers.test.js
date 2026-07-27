/**
 * Tests for runGit.
 *
 * runGit reads the Logger from the Container, so tests register a test
 * Logger into the container before exercising the helper.
 *
 * Verifies:
 *   R1  業務 git 操作のロギング (cmd, exitCode, stderr)
 *   R2  worktree 内で再帰なくログ記録
 *   R4  失敗時の exitCode/stderr 記録
 *   R5  失敗時に ok:false かつ status 非 0
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  GitCommitPathSet,
  runGit,
} from "../../../src/lib/git-helpers.js";
import { runCmd } from "../../../src/lib/process.js";
import { Logger } from "../../../src/lib/log.js";
import { container } from "../../../src/lib/container.js";
import { todayLocal, readJsonl } from "../../helpers/log-fixtures.js";

function initRepo(dir) {
  runCmd("git", ["init", "-q", "-b", "main", dir]);
  runCmd("git", ["-C", dir, "config", "user.email", "test@example.com"]);
  runCmd("git", ["-C", dir, "config", "user.name", "Test"]);
  fs.writeFileSync(path.join(dir, "README.md"), "init\n");
  runCmd("git", ["-C", dir, "add", "."]);
  runCmd("git", ["-C", dir, "commit", "-q", "-m", "init"]);
}

function registerLogger(logDir) {
  fs.mkdirSync(logDir, { recursive: true });
  const logger = new Logger({ logDir, enabled: true, entryCommand: "test" });
  container.reset();
  container.register("logger", logger);
  return logger;
}

describe("runGit — basic logging", () => {
  let tmpDir;
  let logger;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rungit-"));
    initRepo(tmpDir);
    logger = registerLogger(path.join(tmpDir, "logs"));
  });

  afterEach(async () => {
    await logger.flush();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    container.reset();
  });

  it("R1: returns runCmd-compatible result on success and writes a git log record", async () => {
    const result = runGit(["status", "--short"], { cwd: tmpDir });
    assert.equal(result.ok, true);
    assert.equal(result.status, 0);
    assert.equal(typeof result.stdout, "string");
    assert.equal(typeof result.stderr, "string");

    await logger.flush();
    const jsonl = path.join(tmpDir, "logs", `senti-${todayLocal()}.jsonl`);
    const lines = readJsonl(jsonl);
    const gitLines = lines.filter((l) => l.type === "git");
    assert.equal(gitLines.length, 1);
    assert.deepEqual(gitLines[0].cmd, ["git", "status", "--short"]);
    assert.equal(gitLines[0].exitCode, 0);
    assert.equal(gitLines[0].stderr, "");
  });

  it("R4, R5: failure produces ok:false with non-zero status and is logged with stderr", async () => {
    const result = runGit(["this-is-not-a-real-subcommand"], { cwd: tmpDir });
    assert.equal(result.ok, false);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.length > 0, "stderr should be captured");

    await logger.flush();
    const jsonl = path.join(tmpDir, "logs", `senti-${todayLocal()}.jsonl`);
    const lines = readJsonl(jsonl);
    const gitLines = lines.filter((l) => l.type === "git");
    assert.equal(gitLines.length, 1);
    assert.notEqual(gitLines[0].exitCode, 0);
    assert.ok(String(gitLines[0].stderr).length > 0);
  });

  it("resolves current and tracked-deleted paths while excluding committed deletions", () => {
    const committedDeletion = "committed-deletion.txt";
    const trackedDeletion = "tracked-deletion.txt";
    const untracked = "untracked.txt";
    fs.writeFileSync(path.join(tmpDir, committedDeletion), "committed deletion\n");
    fs.writeFileSync(path.join(tmpDir, trackedDeletion), "tracked deletion\n");
    runCmd("git", ["-C", tmpDir, "add", committedDeletion, trackedDeletion]);
    runCmd("git", ["-C", tmpDir, "commit", "-q", "-m", "add deletion fixtures"]);
    fs.unlinkSync(path.join(tmpDir, committedDeletion));
    runCmd("git", ["-C", tmpDir, "add", "-A", "--", committedDeletion]);
    runCmd("git", ["-C", tmpDir, "commit", "-q", "-m", "commit one deletion"]);
    fs.unlinkSync(path.join(tmpDir, trackedDeletion));
    fs.writeFileSync(path.join(tmpDir, untracked), "untracked\n");

    const resolved = GitCommitPathSet.resolve({
      root: tmpDir,
      treeish: "HEAD",
      candidates: [
        committedDeletion,
        trackedDeletion,
        untracked,
        "transient-removed.txt",
      ],
    });

    assert.deepEqual(resolved.toArray(), [trackedDeletion, untracked]);
  });
});

describe("runGit — worktree regression (R2)", () => {
  let mainDir;
  let worktreeDir;
  let logger;

  beforeEach(() => {
    mainDir = fs.mkdtempSync(path.join(os.tmpdir(), "rungit-main-"));
    initRepo(mainDir);
    worktreeDir = path.join(os.tmpdir(), `rungit-wt-${Date.now()}`);
    const r = runCmd("git", ["-C", mainDir, "worktree", "add", "-b", "feature-x", worktreeDir]);
    if (!r.ok) throw new Error("worktree add failed: " + r.stderr);

    // Simulate container init with main-repo-side log dir (matches buildPaths behavior).
    logger = registerLogger(path.join(mainDir, ".tmp", "logs"));
  });

  afterEach(async () => {
    await logger.flush();
    runCmd("git", ["-C", mainDir, "worktree", "remove", "--force", worktreeDir]);
    fs.rmSync(mainDir, { recursive: true, force: true });
    fs.rmSync(worktreeDir, { recursive: true, force: true });
    container.reset();
  });

  it("logs to the main-repo-side log dir even when called inside a worktree", async () => {
    const result = runGit(["status", "--short"], { cwd: worktreeDir });
    assert.equal(result.ok, true);
    await logger.flush();
    const jsonl = path.join(mainDir, ".tmp", "logs", `senti-${todayLocal()}.jsonl`);
    assert.ok(fs.existsSync(jsonl), `expected log file at ${jsonl}`);
    const lines = readJsonl(jsonl);
    const gitLines = lines.filter((l) => l.type === "git");
    assert.ok(gitLines.length >= 1);
  });
});

describe("runCmd no longer logs git commands", () => {
  let tmpDir;
  let logger;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rungit-rc-"));
    initRepo(tmpDir);
    logger = registerLogger(path.join(tmpDir, "logs"));
  });

  afterEach(async () => {
    await logger.flush();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    container.reset();
  });

  it("R3: runCmd('git', ...) does NOT emit a git log record (use runGit instead)", async () => {
    const result = runCmd("git", ["status", "--short"], { cwd: tmpDir });
    assert.equal(result.ok, true);
    await logger.flush();
    const jsonl = path.join(tmpDir, "logs", `senti-${todayLocal()}.jsonl`);
    if (fs.existsSync(jsonl)) {
      const lines = readJsonl(jsonl);
      const gitLines = lines.filter((l) => l.type === "git");
      assert.equal(gitLines.length, 0);
    }
  });
});
