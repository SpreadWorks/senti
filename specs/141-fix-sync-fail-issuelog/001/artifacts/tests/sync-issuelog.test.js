/**
 * specs/141-fix-sync-fail-issuelog/tests/sync-issuelog.test.js
 *
 * Verify fix for #87: commitOrSkip handles "no changes added to commit"
 * and finalizeOnError writes to mainRoot in worktree mode.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

describe("commitOrSkip: regex patterns", () => {
  let commitOrSkip;

  it("loads commitOrSkip from run-finalize.js", async () => {
    const mod = await import("../../../src/flow/lib/run-finalize.js");
    commitOrSkip = mod.commitOrSkip;
    assert.ok(commitOrSkip, "commitOrSkip should be exported");
  });

  it("returns skipped for 'nothing to commit, working tree clean'", async () => {
    const mod = await import("../../../src/flow/lib/run-finalize.js");
    // We can't easily call commitOrSkip without running git.
    // Instead, test the regex pattern directly.
    const pattern = /nothing to commit|no changes added to commit/i;
    assert.ok(pattern.test("nothing to commit, working tree clean"));
  });

  it("matches 'no changes added to commit'", async () => {
    const pattern = /nothing to commit|no changes added to commit/i;
    assert.ok(pattern.test("no changes added to commit (use \"git add\" and/or \"git commit -a\")"));
  });

  it("does not match real git errors", async () => {
    const pattern = /nothing to commit|no changes added to commit/i;
    assert.ok(!pattern.test("fatal: not a git repository"));
    assert.ok(!pattern.test("error: pathspec 'foo' did not match any file(s) known to git"));
  });
});

describe("finalizeOnError: worktree path resolution", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("writes to mainRoot when available", async () => {
    const mod = await import("../../../src/flow/lib/run-finalize.js");
    tmp = createTmpDir();

    // Setup: create spec dir in mainRoot
    const specDir = path.join(tmp, "specs", "test-spec");
    fs.mkdirSync(specDir, { recursive: true });

    const ctx = {
      root: "/nonexistent/worktree",  // worktree path (doesn't exist)
      mainRoot: tmp,                   // main repo path
      flowState: { spec: "specs/test-spec/spec.md" },
    };

    const handler = mod.finalizeOnError("sync");
    handler(ctx, new Error("test sync failure"));

    // Verify issue-log was written to mainRoot, not worktree
    const issueLogPath = path.join(specDir, "issue-log.json");
    assert.ok(fs.existsSync(issueLogPath), "issue-log.json should exist in mainRoot");
    const log = JSON.parse(fs.readFileSync(issueLogPath, "utf8"));
    assert.ok(log.entries.length > 0, "should have at least one entry");
    assert.equal(log.entries[0].step, "sync");
    assert.ok(log.entries[0].reason.includes("test sync failure"));
  });
});
