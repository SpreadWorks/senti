import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { resolveCurrentReviewTreeSha } from "../../../src/flow/lib/review-evidence-store.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let tmp = null;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function git(...args) {
  return execFileSync("git", args, { cwd: tmp, encoding: "utf8" }).trim();
}

describe("resolveCurrentReviewTreeSha", () => {
  it("uses the committed tree for a clean worktree and includes tracked changes", () => {
    tmp = createTmpDir("review-evidence-tree-");
    git("init", "-q", "-b", "main");
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test User");
    fs.writeFileSync(path.join(tmp, "subject.js"), "export const value = 1;\n");
    git("add", "subject.js");
    git("commit", "-q", "-m", "baseline");

    assert.equal(resolveCurrentReviewTreeSha(tmp), git("rev-parse", "HEAD^{tree}"));

    fs.writeFileSync(path.join(tmp, "subject.js"), "export const value = 2;\n");
    const unstaged = resolveCurrentReviewTreeSha(tmp);
    assert.notEqual(unstaged, git("rev-parse", "HEAD^{tree}"));

    git("add", "subject.js");
    assert.equal(resolveCurrentReviewTreeSha(tmp), unstaged);
  });
});
