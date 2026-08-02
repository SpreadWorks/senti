import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import RunFinalizeCommitCommand from "../../../src/flow/lib/run-finalize-commit.js";
import { commitFinalizeCompletion } from "../../../src/flow/lib/run-finalize.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { makeFlowState } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root;

afterEach(() => {
  if (root) removeTmpDir(root);
  root = null;
});

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function write(relativePath, content) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test("completion commit contains only target spec and docs while preserving unrelated staged changes", () => {
  root = createTmpDir("finalize-completion-boundary-");
  initGitRepo(root);
  write("docs/overview.md", "before\n");
  write("AGENTS.md", "before\n");
  write("specs/485-finalize/flow.json", "{\"status\":\"active\"}\n");
  write("unrelated.txt", "before\n");
  commitAll(root, "test: baseline");

  write("docs/overview.md", "after\n");
  write("specs/485-finalize/flow.json", "{\"status\":\"done\"}\n");
  write("specs/485-finalize/runtime-log.json", "{\"exitCode\":0}\n");
  write("unrelated.txt", "user staged change\n");
  git(["add", "unrelated.txt"]);

  const result = commitFinalizeCompletion({
    root,
    specRoot: "specs",
    specId: "485-finalize",
    idempotencyKey: "run-485:finalize-cleanup:1",
  });

  assert.equal(result.status, "done");
  const committed = git(["show", "--pretty=format:", "--name-only", "HEAD"]).split("\n").filter(Boolean);
  assert.deepEqual(committed.sort(), [
    "docs/overview.md",
    "specs/485-finalize/flow.json",
    "specs/485-finalize/runtime-log.json",
  ]);
  assert.equal(git(["diff", "--cached", "--name-only"]), "unrelated.txt");
});

test("ignored configured spec root is left untracked while docs still commit", () => {
  root = createTmpDir("finalize-completion-ignored-root-");
  initGitRepo(root);
  write(".gitignore", "flow-artifacts/specs/\n");
  write("docs/overview.md", "before\n");
  commitAll(root, "test: baseline");

  write("docs/overview.md", "after\n");
  write("flow-artifacts/specs/485-ignored/flow.json", "{\"status\":\"done\"}\n");

  const result = commitFinalizeCompletion({
    root,
    specRoot: "flow-artifacts/specs",
    specId: "485-ignored",
    idempotencyKey: "run-485-ignored:finalize-cleanup:1",
  });

  assert.equal(result.status, "done");
  assert.equal(git(["show", "--pretty=format:", "--name-only", "HEAD"]), "docs/overview.md");
  assert.equal(git(["ls-files", "flow-artifacts/specs/485-ignored"]), "");
  assert.equal(fs.existsSync(path.join(root, "flow-artifacts/specs/485-ignored/flow.json")), true);
});

test("implementation commit excludes the shared spec root and documentation", async () => {
  root = createTmpDir("finalize-implementation-boundary-");
  initGitRepo(root);
  write("src/feature.js", "export const value = 1;\n");
  write("docs/overview.md", "before\n");
  commitAll(root, "test: baseline");
  git(["switch", "-c", "feature/485-implementation"]);

  const specId = "485-implementation";
  const manager = new FlowManager({ root, mainRoot: root, inWorktree: false });
  manager.create(makeFlowState({
    specId,
    runId: "run-485-implementation",
    featureBranch: `feature/${specId}`,
  }));
  write(`specs/${specId}/spec.json`, JSON.stringify({ requirements: [] }) + "\n");
  write("src/feature.js", "export const value = 485;\n");
  write("docs/overview.md", "generated docs\n");

  const result = await new RunFinalizeCommitCommand().execute({
    root,
    executionRoot: root,
    repositoryRoot: root,
    flowManager: manager,
    flowState: manager.loadReadOnly(specId),
    specRoot: manager.specRoot,
  });

  assert.equal(result.status, "done");
  assert.equal(git(["show", "--pretty=format:", "--name-only", "HEAD"]), "src/feature.js");
  const dirty = git(["status", "--short"]);
  assert.match(dirty, /docs\/overview\.md/);
  assert.match(dirty, /\?\? specs\//);
  assert.equal(fs.existsSync(path.join(root, "specs", specId, "flow.json")), true);
});
