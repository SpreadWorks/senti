import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import {
  RunFinalizeCleanupCommand,
  commitFinalizeCleanupPostCommandMetadata,
  recordFinalizeCleanupPostCommandMetadata,
} from "../../../src/flow/lib/run-finalize-cleanup.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../../src/lib/worktree-flow-binding.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root;

afterEach(() => {
  if (root) removeTmpDir(root);
  root = null;
});

function git(args, cwd = root) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function write(relativePath, content, cwd = root) {
  const file = path.join(cwd, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function prepareSpecOnlyFinalize({ prefix, specId, runId, specRoot = "specs", ignored = false }) {
  root = createTmpDir(prefix);
  initGitRepo(root);
  if (ignored) write(".gitignore", `${specRoot}/\n`);
  write("docs/overview.md", "baseline\n");
  commitAll(root, "test: baseline");
  const manager = new FlowManager({
    root,
    mainRoot: root,
    inWorktree: false,
    specRoot,
  });
  const specLocation = manager.specLocation(specId);
  const state = moveFlowToStep(makeFlowState({ specId, runId, featureBranch: "main" }), "finalize-cleanup");
  fs.mkdirSync(specLocation.directory, { recursive: true });
  write(specLocation.relativeSpecFile, JSON.stringify({ requirements: [] }) + "\n");
  manager.create(state);
  manager.addActiveFlow(specId, "local");
  write("docs/overview.md", "generated docs\n");
  return { manager, specLocation, state };
}

async function runSpecOnlyCleanup({ manager, specLocation }) {
  return new RunFinalizeCleanupCommand().execute({
    root,
    mainRoot: root,
    flowManager: manager,
    flowState: manager.loadReadOnly(specLocation.specId.toString()),
    specLocation,
    specRoot: specLocation.specRoot,
    force: false,
    autoRescue: false,
  });
}

test("worktree cleanup is followed by one target-spec plus docs completion commit", async () => {
  root = createTmpDir("shared-spec-finalize-e2e-");
  initGitRepo(root);
  write("README.md", "baseline\n");
  write("AGENTS.md", "baseline\n");
  write("docs/overview.md", "baseline\n");
  write("unrelated.txt", "baseline\n");
  commitAll(root, "test: baseline");

  const specId = "485-shared-finalize";
  const featureBranch = `feature/${specId}`;
  const worktreePath = path.join(root, ".senti", "worktree", "feature-485-shared-finalize");
  git(["worktree", "add", "-q", "-b", featureBranch, worktreePath, "main"]);
  write("src/feature.js", "export const value = 485;\n", worktreePath);
  git(["add", "src/feature.js"], worktreePath);
  git(["commit", "-q", "-m", "feat: add shared finalize fixture"], worktreePath);
  const featureSha = git(["rev-parse", "HEAD"], worktreePath);
  git(["merge", "--squash", featureBranch]);
  git(["commit", "-q", "-m", "feat: merge shared finalize fixture"]);

  const excludePath = git(["rev-parse", "--git-path", "info/exclude"], worktreePath);
  fs.appendFileSync(excludePath, "/.senti/flow-identity.json\n");
  const state = moveFlowToStep(makeFlowState({
    specId,
    runId: "run-485-shared-finalize",
    featureBranch,
    worktree: true,
    state: {
      mergeStrategy: "squash",
      featureBranchSquashedSha: featureSha,
    },
  }), "finalize-cleanup");
  const manager = new FlowManager({ root, mainRoot: root, inWorktree: false });
  const specLocation = manager.specLocation(specId);
  fs.mkdirSync(specLocation.directory, { recursive: true });
  write(specLocation.relativeSpecFile, JSON.stringify({ requirements: [] }) + "\n");
  manager.create(state);
  manager.addActiveFlow(specId, "worktree");
  new WorktreeFlowBindingStore({ worktreePath }).save(new WorktreeFlowIdentity({
    runId: state.runId,
    issue: null,
    specId,
    worktreePath,
  }));

  write("docs/overview.md", "generated docs\n");
  write("unrelated.txt", "user staged change\n");
  git(["add", "unrelated.txt"]);
  const baseBeforeCleanup = git(["rev-parse", "HEAD"]);

  const result = await new RunFinalizeCleanupCommand().execute({
    root,
    mainRoot: root,
    flowManager: manager,
    flowState: manager.loadReadOnly(specId),
    specLocation,
    specRoot: specLocation.specRoot,
    force: false,
    autoRescue: false,
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(git(["rev-parse", "HEAD"]), baseBeforeCleanup, "cleanup must not create a pre-cleanup commit");
  assert.equal(fs.existsSync(worktreePath), false);
  assert.equal(git(["branch", "--list", featureBranch]), "");
  assert.deepEqual(manager.loadActiveFlows(), [{ mode: "worktree", specId }]);

  const retained = recordFinalizeCleanupPostCommandMetadata({
    flowManager: manager,
    specId,
    runtimeLog: { runId: state.runId, sequence: 1, attempt: 1 },
  });
  const completion = commitFinalizeCleanupPostCommandMetadata({
    flowManager: manager,
    specId,
    writtenPaths: retained.writtenPaths,
  });
  assert.equal(completion.status, "done");
  assert.deepEqual(manager.loadActiveFlows(), []);

  const committed = git(["show", "--pretty=format:", "--name-only", "HEAD"]).split("\n").filter(Boolean);
  assert.ok(committed.includes("docs/overview.md"));
  assert.ok(committed.includes(`${specLocation.relativeDirectory}/flow.json`));
  assert.ok(committed.includes(`${specLocation.relativeDirectory}/runtime-log.json`));
  assert.equal(committed.includes("unrelated.txt"), false);
  assert.equal(git(["diff", "--cached", "--name-only"]), "unrelated.txt");
});

test("ignored configured spec root completes finalize without force-adding artifacts", async () => {
  const specId = "485-ignored-finalize";
  const { manager, specLocation, state } = prepareSpecOnlyFinalize({
    prefix: "shared-spec-finalize-ignored-",
    specId,
    runId: "run-485-ignored-finalize",
    specRoot: "flow-artifacts/specs",
    ignored: true,
  });
  const result = await runSpecOnlyCleanup({ manager, specLocation });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(manager.loadActiveFlows(), [{ mode: "local", specId }]);

  const retained = recordFinalizeCleanupPostCommandMetadata({
    flowManager: manager,
    specId,
    runtimeLog: { runId: state.runId, sequence: 1, attempt: 1 },
  });
  const completion = commitFinalizeCleanupPostCommandMetadata({
    flowManager: manager,
    specId,
    writtenPaths: retained.writtenPaths,
  });

  assert.equal(completion.status, "done");
  assert.deepEqual(manager.loadActiveFlows(), []);
  assert.equal(git(["show", "--pretty=format:", "--name-only", "HEAD"]), "docs/overview.md");
  assert.equal(git(["ls-files", specLocation.relativeDirectory]), "");
  assert.equal(fs.existsSync(specLocation.flowStateFile), true);
});

test("failed completion commit retains the active flow and a retry clears it", async () => {
  const specId = "485-finalize-retry";
  const { manager, specLocation, state } = prepareSpecOnlyFinalize({
    prefix: "shared-spec-finalize-retry-",
    specId,
    runId: "run-485-finalize-retry",
  });
  const result = await runSpecOnlyCleanup({ manager, specLocation });
  assert.equal(result.ok, true, JSON.stringify(result));
  const retained = recordFinalizeCleanupPostCommandMetadata({
    flowManager: manager,
    specId,
    runtimeLog: { runId: state.runId, sequence: 1, attempt: 1 },
  });

  const hook = path.join(root, ".git", "hooks", "pre-commit");
  fs.writeFileSync(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  assert.throws(() => commitFinalizeCleanupPostCommandMetadata({
    flowManager: manager,
    specId,
    writtenPaths: retained.writtenPaths,
  }), /finalize completion commit failed/);
  assert.deepEqual(manager.loadActiveFlows(), [{ mode: "local", specId }]);

  fs.unlinkSync(hook);
  const completion = commitFinalizeCleanupPostCommandMetadata({
    flowManager: manager,
    specId,
    writtenPaths: retained.writtenPaths,
  });
  assert.equal(completion.status, "done");
  assert.deepEqual(manager.loadActiveFlows(), []);
});
