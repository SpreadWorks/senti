// spec: R9 R14
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCleanupSrc() {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
    "utf8",
  );
}

describe("R9: --auto-rescue cherry-picks safely with proper preconditions", () => {
  it("R9: auto-rescue path detects MAIN_REPO_DIRTY and halts before cherry-pick", () => {
    const src = readCleanupSrc();
    assert.ok(src.includes("MAIN_REPO_DIRTY"), "MAIN_REPO_DIRTY code required");
    assert.ok(
      /["']status["'][\s\S]{0,80}["']--porcelain["']/.test(src),
      "auto-rescue must check main repo dirty state via git status --porcelain",
    );
  });
  it("R9: auto-rescue handles baseBranch lock with detached worktree fallback or MAIN_REPO_LOCKED", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("worktree add") || src.includes("MAIN_REPO_LOCKED") || src.includes("--detach"),
      "auto-rescue must handle baseBranch lock (detached fallback or explicit lock code)",
    );
  });
  it("R9: cherry-pick conflict triggers --abort and CHERRY_PICK_CONFLICT halt", () => {
    const src = readCleanupSrc();
    assert.ok(src.includes("CHERRY_PICK_CONFLICT"), "CHERRY_PICK_CONFLICT code required");
    assert.ok(
      src.includes("cherry-pick") && src.includes("--abort"),
      "auto-rescue conflict path must invoke cherry-pick --abort to restore state",
    );
  });
  it("R9: empty patch (duplicate apply) is handled via cherry-pick --skip", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("--skip"),
      "auto-rescue must use cherry-pick --skip for empty/duplicate patches",
    );
  });
});

describe("R14: audit log durability and dirty-check exclusion", () => {
  it("R14: audit log writes to main repo path (not worktree) for cherry-pick conflict", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("appendIssueLog(mainRepoPath, state.spec"),
      "conflict path must persist audit log to main repo",
    );
  });
  it("R14: dirty-check excludes issue-log.json via pathspec when retrying after conflict", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("issue-log.json") &&
        (src.includes(":!") || src.includes("pathspec") || src.includes("exclude")),
      "dirty check must exclude issue-log.json so retry after conflict is not blocked",
    );
  });
  it("R14: audit rollback uses stable-id compensation through the shared store", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("IssueLogStore") && src.includes(".compensate(idempotencyKey)"),
      "rollback must remove only its stable audit id through IssueLogStore",
    );
    assert.ok(!src.includes("saveIssueLog("), "whole-file issue-log rollback must not remain");
  });
});
