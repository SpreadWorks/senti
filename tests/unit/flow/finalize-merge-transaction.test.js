import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  FinalizeMergeTransaction,
  FinalizeMergeTransactionError,
} from "../../../src/flow/lib/finalize-merge-transaction.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { checkoutNewBranch, commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { runGit } from "../../../src/lib/git-helpers.js";

function git(root, args) {
  const result = runGit(["-C", root, ...args]);
  assert.equal(result.ok, true, result.stderr || result.stdout);
  return result.stdout.trim();
}

function createFixture(root, { conflict = false, withBaseWorktree = true } = {}) {
  initGitRepo(root);
  fs.writeFileSync(path.join(root, "shared.txt"), "base\n");
  fs.writeFileSync(path.join(root, "feature.txt"), "baseline\n");
  commitAll(root, "test: baseline");
  checkoutNewBranch(root, "feature/finalize-merge");
  fs.writeFileSync(path.join(root, conflict ? "shared.txt" : "feature.txt"), conflict ? "feature\n" : "feature change\n");
  commitAll(root, "feat: feature change");

  if (!withBaseWorktree) return { baseWorktree: null };
  const baseWorktree = path.join(root, "..", `${path.basename(root)}-base`);
  git(root, ["worktree", "add", "--quiet", baseWorktree, "main"]);
  if (conflict) {
    fs.writeFileSync(path.join(baseWorktree, "shared.txt"), "base change\n");
    commitAll(baseWorktree, "test: conflicting base change");
  }
  return { baseWorktree };
}

function transaction(root, options = {}) {
  return new FinalizeMergeTransaction({
    featureRoot: root,
    mainRoot: root,
    baseBranch: "main",
    featureBranch: "feature/finalize-merge",
    commitMessage: "feat: isolated integration\n\nsenti-outbox: test-finalize-merge",
    idempotencyKey: "test-finalize-merge",
    ...options,
  });
}

describe("FinalizeMergeTransaction", () => {
  let root;
  let baseWorktree;

  afterEach(() => {
    if (root) {
      const registered = runGit(["-C", root, "worktree", "list", "--porcelain"]);
      if (registered.ok && baseWorktree && fs.existsSync(baseWorktree)) {
        runGit(["-C", root, "worktree", "remove", "--force", baseWorktree]);
      }
      removeTmpDir(root);
    }
    root = null;
    baseWorktree = null;
  });

  it("integrates in an isolated worktree while the base branch is checked out elsewhere", () => {
    root = createTmpDir("senti-finalize-merge-transaction-");
    ({ baseWorktree } = createFixture(root));
    const beforeFeatureHead = git(root, ["rev-parse", "HEAD"]);

    const result = transaction(root).execute();

    assert.equal(result.strategy, "squash");
    assert.equal(result.mergedFromSha, beforeFeatureHead);
    assert.equal(git(root, ["rev-parse", "HEAD"]), beforeFeatureHead, "feature worktree remains untouched");
    assert.equal(git(baseWorktree, ["branch", "--show-current"]), "main");
    assert.equal(fs.readFileSync(path.join(baseWorktree, "feature.txt"), "utf8"), "feature change\n");
    assert.match(git(baseWorktree, ["log", "-1", "--format=%B"]), /senti-outbox: test-finalize-merge/);
  });

  it("reports a dirty base worktree without changing the base ref", () => {
    root = createTmpDir("senti-finalize-merge-target-dirty-");
    ({ baseWorktree } = createFixture(root));
    fs.writeFileSync(path.join(baseWorktree, "local-only.txt"), "do not overwrite\n");
    const before = git(root, ["rev-parse", "main"]);

    assert.throws(
      () => transaction(root).execute(),
      (error) => error instanceof FinalizeMergeTransactionError && error.code === "MERGE_TARGET_DIRTY",
    );

    assert.equal(git(root, ["rev-parse", "main"]), before);
    assert.equal(fs.readFileSync(path.join(baseWorktree, "local-only.txt"), "utf8"), "do not overwrite\n");
  });

  it("rejects an external dirty feature file without changing the base ref", () => {
    root = createTmpDir("senti-finalize-merge-feature-dirty-");
    ({ baseWorktree } = createFixture(root));
    fs.writeFileSync(path.join(root, "uncommitted.txt"), "do not merge\n");
    const before = git(root, ["rev-parse", "main"]);

    assert.throws(
      () => transaction(root).execute(),
      (error) => error instanceof FinalizeMergeTransactionError && error.code === "MERGE_FEATURE_DIRTY",
    );

    assert.equal(git(root, ["rev-parse", "main"]), before);
  });

  it("permits only the Flow-owned pending metadata required by the outbox", () => {
    root = createTmpDir("senti-finalize-merge-flow-metadata-");
    ({ baseWorktree } = createFixture(root));
    fs.mkdirSync(path.join(root, "specs", "001-test"), { recursive: true });
    fs.writeFileSync(path.join(root, "specs", "001-test", "flow.json"), "{\"outbox\":[]}\n");

    const result = transaction(root, {
      allowedFeatureMetadataPaths: ["specs/001-test/flow.json"],
    }).execute();

    assert.equal(result.strategy, "squash");
    assert.equal(fs.readFileSync(path.join(root, "specs", "001-test", "flow.json"), "utf8"), "{\"outbox\":[]}\n");
  });

  it("moves a branch-mode caller to the published base only after the isolated merge", () => {
    root = createTmpDir("senti-finalize-merge-branch-transition-");
    ({ baseWorktree } = createFixture(root, { withBaseWorktree: false }));

    const result = transaction(root, { promoteFeatureWorktreeToBase: true }).execute();

    assert.equal(result.strategy, "squash");
    assert.equal(git(root, ["branch", "--show-current"]), "main");
    assert.equal(fs.readFileSync(path.join(root, "feature.txt"), "utf8"), "feature change\n");
  });

  it("reports only a graph-proven content conflict as a merge conflict", () => {
    root = createTmpDir("senti-finalize-merge-conflict-");
    ({ baseWorktree } = createFixture(root, { conflict: true }));
    const before = git(root, ["rev-parse", "main"]);

    assert.throws(
      () => transaction(root).execute(),
      (error) => error instanceof FinalizeMergeTransactionError && error.code === "MERGE_CONTENT_CONFLICT",
    );

    assert.equal(git(root, ["rev-parse", "main"]), before);
  });

  it("resumes an already published merge without creating a second commit", () => {
    root = createTmpDir("senti-finalize-merge-resume-");
    ({ baseWorktree } = createFixture(root));
    const first = transaction(root).execute();
    const commitCount = git(root, ["rev-list", "--count", "main"]);

    const resumed = transaction(root).execute();

    assert.equal(resumed.resumed, true);
    assert.equal(resumed.mergeCommit, first.mergeCommit);
    assert.equal(git(root, ["rev-list", "--count", "main"]), commitCount);
  });
});
