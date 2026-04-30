/**
 * src/lib/git-helpers.js
 *
 * Shared helpers for Git and GitHub CLI operations.
 * Includes both read-only state queries and GitHub actions (e.g. issue comments).
 */

import { runCmd, formatError, assertOk } from "./process.js";
import { container } from "./container.js";

/**
 * Run a git command and record a JSONL log entry via Logger.
 *
 * All "business" git operations (commit, push, diff, branch, merge, worktree, status, log, etc.)
 * SHOULD go through this wrapper instead of calling `runCmd("git", ...)` directly,
 * so they are uniformly logged.
 *
 * Exception: git invocations that the Logger itself depends on (repo top-level /
 * git-common-dir resolution in `cli.js`) MUST stay on `runCmd` to avoid recursion.
 *
 * @param {string[]} args - git argument array (without the leading "git")
 * @param {Object}   [opts] - same shape as runCmd opts
 * @returns {{ ok: boolean, status: number, stdout: string, stderr: string, signal: string|null, killed: boolean }}
 */
export function runGit(args, opts = {}) {
  const result = runCmd("git", args, opts);
  if (container.has("logger")) {
    container.get("logger").git({ cmd: ["git", ...args], exitCode: result.status, stderr: result.stderr });
  }
  return result;
}

/** @returns {{ dirty: boolean, dirtyFiles: string[] }} */
export function getWorktreeStatus(cwd) {
  const res = runGit(["status", "--short"], { cwd });
  if (!res.ok) return { dirty: false, dirtyFiles: [] };
  const files = res.stdout.trim().split("\n").filter(Boolean);
  return { dirty: files.length > 0, dirtyFiles: files };
}

/** @returns {string|null} */
export function getCurrentBranch(cwd) {
  const res = runGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
  return res.ok ? res.stdout.trim() : null;
}

/** @returns {number} */
export function getAheadCount(cwd, baseBranch) {
  const res = runGit(["rev-list", "--count", `${baseBranch}..HEAD`], { cwd });
  return res.ok ? parseInt(res.stdout.trim(), 10) || 0 : 0;
}

/** @returns {string|null} */
export function getLastCommit(cwd) {
  const res = runGit(["log", "-1", "--oneline"], { cwd });
  return res.ok ? res.stdout.trim() : null;
}

/** @returns {boolean} */
export function isGhAvailable() {
  return runCmd("gh", ["--version"], { timeout: 5000 }).ok;
}

/**
 * Collect diff stat and commit messages between base and HEAD.
 * @param {string} root - Working directory
 * @param {string} baseBranch - Base branch name
 * @returns {{ diffStat: string, commitMessages: string[] }}
 */
export function collectGitSummary(root, baseBranch) {
  let diffStat = "";
  let commitMessages = [];
  const diffRes = runGit(["diff", "--stat", `${baseBranch}...HEAD`], { cwd: root });
  if (diffRes.ok) diffStat = diffRes.stdout.trim();
  const logRes = runGit(["log", "--format=%s", `${baseBranch}..HEAD`], { cwd: root });
  if (logRes.ok) commitMessages = logRes.stdout.trim().split("\n").filter(Boolean);
  return { diffStat, commitMessages };
}

/**
 * Fetch a branch from a remote. Non-throwing: returns runGit's result envelope.
 * @param {string} remote
 * @param {string} branch
 * @param {{cwd?: string}} [opts]
 */
export function fetchBranch(remote, branch, opts = {}) {
  return runGit(["fetch", remote, branch], opts);
}

/**
 * Run `git rebase <baseRef>`. Returns { ok: true } on success, or
 * { ok: false, reason, conflictFiles, stderr } on failure.
 * `reason` is "dirty" when the working tree has uncommitted changes
 * (rebase never started — no abort needed), or "conflict" for actual
 * merge conflicts (caller must call abortRebase()).
 * @param {string} baseRef
 * @param {{cwd?: string}} [opts]
 */
export function rebaseOnto(baseRef, opts = {}) {
  const res = runGit(["rebase", baseRef], opts);
  if (res.ok) return { ok: true };
  const stderr = res.stderr || "";
  const isDirty = /unstaged changes|uncommitted changes/.test(stderr);
  if (isDirty) {
    return { ok: false, reason: "dirty", conflictFiles: [], stderr };
  }
  const statusRes = runGit(["diff", "--name-only", "--diff-filter=U"], opts);
  const conflictFiles = statusRes.ok
    ? statusRes.stdout.trim().split("\n").filter(Boolean)
    : [];
  return { ok: false, reason: "conflict", conflictFiles, stderr };
}

/** @param {{cwd?: string}} [opts] */
export function abortRebase(opts = {}) {
  return runGit(["rebase", "--abort"], opts);
}

/**
 * Count commits reachable from head but not from base (`git rev-list --count base..head`).
 *
 * Throws (via assertOk) when git itself fails — e.g. unresolvable ref, not a repo —
 * because those are programmer / environment errors that must be surfaced.
 * A legitimate "no commits in range" yields `0` via stdout, not a failure.
 *
 * @param {string} base
 * @param {string} head
 * @param {{cwd?: string}} [opts]
 * @returns {number}
 */
export function countCommitsBetween(base, head, opts = {}) {
  const res = runGit(["rev-list", "--count", `${base}..${head}`], opts);
  assertOk(res, `countCommitsBetween failed for ${base}..${head}`);
  const n = parseInt(res.stdout.trim(), 10);
  if (!Number.isFinite(n)) {
    throw new Error(
      `countCommitsBetween: unexpected non-numeric output for ${base}..${head}: ${JSON.stringify(res.stdout)}`,
    );
  }
  return n;
}

/**
 * List uncommitted (modified, added, untracked) files via `git status --porcelain`.
 *
 * Throws (via assertOk) when git itself fails. Empty output (no uncommitted files)
 * is a success and yields an empty array.
 *
 * @param {{cwd?: string}} [opts]
 * @returns {string[]}
 */
export function listUncommittedFiles(opts = {}) {
  const res = runGit(["status", "--porcelain"], opts);
  assertOk(res, "listUncommittedFiles failed");
  return res.stdout
    .split("\n")
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
}

/**
 * Post a comment to a GitHub issue.
 * @param {number|string} issueNumber
 * @param {string} body - Comment body text
 * @param {string} [cwd] - Working directory
 * @returns {{ ok: boolean, error?: string }}
 */
export function commentOnIssue(issueNumber, body, cwd) {
  const res = runCmd("gh", ["issue", "comment", String(issueNumber), "--body", body], {
    cwd,
    timeout: 30000,
  });
  return res.ok ? { ok: true } : { ok: false, error: formatError(res) };
}
