import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { computeGitState } from "../../../src/flow/lib/run-gate.js";

function initGitRepo() {
  const tmp = createTmpDir();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: tmp });
  execFileSync("git", ["config", "user.email", "t@t"], { cwd: tmp });
  execFileSync("git", ["config", "user.name", "t"], { cwd: tmp });
  fs.writeFileSync(path.join(tmp, "a.txt"), "hello\n");
  execFileSync("git", ["add", "."], { cwd: tmp });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: tmp });
  return tmp;
}

describe("computeGitState", () => {
  it("returns headSha and worktreeHash as non-empty strings", () => {
    const tmp = initGitRepo();
    try {
      const state = computeGitState(tmp);
      assert.equal(typeof state.headSha, "string");
      assert.equal(typeof state.worktreeHash, "string");
      assert.ok(state.headSha.length > 0);
      assert.ok(state.worktreeHash.length > 0);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("returns the same worktreeHash for identical tree state", () => {
    const tmp = initGitRepo();
    try {
      const a = computeGitState(tmp);
      const b = computeGitState(tmp);
      assert.equal(a.headSha, b.headSha);
      assert.equal(a.worktreeHash, b.worktreeHash);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("returns a different worktreeHash when a tracked file changes", () => {
    const tmp = initGitRepo();
    try {
      const before = computeGitState(tmp);
      fs.writeFileSync(path.join(tmp, "a.txt"), "modified\n");
      const after = computeGitState(tmp);
      assert.equal(before.headSha, after.headSha);
      assert.notEqual(before.worktreeHash, after.worktreeHash);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("returns a different worktreeHash when an untracked file is added", () => {
    const tmp = initGitRepo();
    try {
      const before = computeGitState(tmp);
      fs.writeFileSync(path.join(tmp, "new.txt"), "new\n");
      const after = computeGitState(tmp);
      assert.notEqual(before.worktreeHash, after.worktreeHash);
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("impl-gate prompt", () => {
  it("keeps deferred full regression owned by final-regression", () => {
    const prompt = fs.readFileSync(
      path.join(process.cwd(), "src/flow/prompts/impl/impl-gate.md"),
      "utf8",
    );
    assert.match(
      prompt,
      /MUST:[\s\S]*full-regression-deferred[\s\S]*final-regression/i,
      "impl-gate.md must not require a deferred full regression before final-regression",
    );
  });
});
