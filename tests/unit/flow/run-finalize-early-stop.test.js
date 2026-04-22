/**
 * Tests for spec 211 finalize preflight additions:
 *   - no-commits early stop (R2)
 *   - dirty-worktree early stop (R4)
 *
 * These extend the existing preflight (git write access) without replacing it.
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runPreflightChecks } from "../../../src/flow/lib/run-finalize.js";
import { runCmd } from "../../../src/lib/process.js";

function init(dir) {
  runCmd("git", ["init", "-q", "-b", "main", dir]);
  runCmd("git", ["-C", dir, "config", "user.email", "t@example.com"]);
  runCmd("git", ["-C", dir, "config", "user.name", "T"]);
  runCmd("git", ["-C", dir, "config", "commit.gpgsign", "false"]);
  fs.writeFileSync(path.join(dir, "a.txt"), "a");
  runCmd("git", ["-C", dir, "add", "."]);
  runCmd("git", ["-C", dir, "commit", "-q", "-m", "init"]);
}

describe("runPreflightChecks — no-commits", () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "fin-nc-")); init(dir); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("returns { ok: false, reason: 'no-commits' } when feature has no commits beyond base", () => {
    runCmd("git", ["-C", dir, "checkout", "-b", "feature"]);
    const result = runPreflightChecks({ root: dir, baseBranch: "main", featureBranch: "feature" });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "no-commits");
    assert.equal(result.baseBranch, "main");
    assert.equal(result.featureBranch, "feature");
    assert.equal(typeof result.hasUncommitted, "boolean");
  });

  it("returns { ok: true } when feature has commits beyond base", () => {
    runCmd("git", ["-C", dir, "checkout", "-b", "feature"]);
    fs.writeFileSync(path.join(dir, "b.txt"), "b");
    runCmd("git", ["-C", dir, "add", "."]);
    runCmd("git", ["-C", dir, "commit", "-q", "-m", "feat"]);
    const result = runPreflightChecks({ root: dir, baseBranch: "main", featureBranch: "feature" });
    assert.equal(result.ok, true);
  });
});

describe("runPreflightChecks — dirty-worktree", () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "fin-dw-")); init(dir); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("returns { ok: false, reason: 'dirty-worktree' } with uncommittedFiles when worktree is dirty", () => {
    runCmd("git", ["-C", dir, "checkout", "-b", "feature"]);
    fs.writeFileSync(path.join(dir, "b.txt"), "b");
    runCmd("git", ["-C", dir, "add", "."]);
    runCmd("git", ["-C", dir, "commit", "-q", "-m", "feat"]);
    // Now dirty the worktree with an unstaged change.
    fs.writeFileSync(path.join(dir, "a.txt"), "a-modified");
    const result = runPreflightChecks({ root: dir, baseBranch: "main", featureBranch: "feature" });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "dirty-worktree");
    assert.ok(Array.isArray(result.uncommittedFiles));
    assert.ok(result.uncommittedFiles.includes("a.txt"));
  });
});

describe("runPreflightChecks — spec-only mode (R6)", () => {
  let dir;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "fin-so-")); init(dir); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("returns { ok: true } when featureBranch == baseBranch (spec-only mode skips checks)", () => {
    const result = runPreflightChecks({ root: dir, baseBranch: "main", featureBranch: "main" });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, "spec-only");
  });
});
