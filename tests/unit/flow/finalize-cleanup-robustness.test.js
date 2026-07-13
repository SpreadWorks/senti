/**
 * tests/unit/flow/finalize-cleanup-robustness.test.js
 *
 * Tests for enhanced finalize-cleanup robustness and authority switch.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager, replaceFlowState } from "../../helpers/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { ProcessIdentitySource } from "../../../src/lib/flow-state-atomic-writer.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";

function initGitRepo(root) {
  execFileSync("git", ["init", "--quiet", root], { encoding: "utf8" });
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"], { encoding: "utf8" });
  execFileSync("git", ["-C", root, "config", "user.name", "Test User"], { encoding: "utf8" });
  fs.writeFileSync(path.join(root, "README.md"), "# Test Repo\n");
  execFileSync("git", ["-C", root, "add", "README.md"], { encoding: "utf8" });
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "initial commit"], { encoding: "utf8" });
}

function writeLiveFlowWriterLock(root, specId) {
  const statePath = path.join(root, "specs", specId, "flow.json");
  const lockPath = path.join(path.dirname(statePath), ".flow.json.writer.lock");
  const processIdentity = new ProcessIdentitySource().createOwner(crypto.randomUUID());
  fs.writeFileSync(lockPath, `${JSON.stringify({
    version: 2,
    kind: "flow-state-writer",
    processIdentity,
    root: fs.realpathSync(root),
    spec: `specs/${specId}/spec.json`,
    statePath: fs.realpathSync(statePath),
  }, null, 2)}\n`, { mode: 0o600 });
  return lockPath;
}

describe("finalize-cleanup robustness", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("registry post hooks switch ctx.flowManager to main repo authority", async () => {
    tmp = createTmpDir("senti-finalize-auth-switch-");
    const mainRoot = path.join(tmp, "main");
    const worktreeRoot = path.join(tmp, "worktree");
    fs.mkdirSync(mainRoot);
    fs.mkdirSync(worktreeRoot);
    initGitRepo(mainRoot);

    const state = setupFlow(worktreeRoot);
    const specId = path.basename(path.dirname(state.spec));
    // Copy flow.json to main repo to simulate merged state
    const mainSpecDir = path.join(mainRoot, "specs", specId);
    fs.mkdirSync(mainSpecDir, { recursive: true });
    fs.writeFileSync(path.join(mainSpecDir, "flow.json"), JSON.stringify(state, null, 2));

    const { FlowManager } = await import("../../../src/lib/flow-manager.js");
    const fm = new FlowManager({ root: worktreeRoot, mainRoot: mainRoot, inWorktree: true, specId });
    const ctx = {
      flowManager: fm,
      flowState: { ...state, worktree: true, featureBranch: "feature/test" },
      root: worktreeRoot,
      mainRoot: mainRoot,
      specId,
    };

    const entry = FLOW_COMMANDS.run["finalize-merge"];
    await entry.post(ctx, { status: "done", strategy: "squash" });

    assert.notEqual(ctx.flowManager, fm, "flowManager should have been switched");
    assert.equal(path.resolve(ctx.flowManager._root), path.resolve(mainRoot), "new flowManager should be rooted in main");
  });

  it("syncMetadataFromWorktreeToMain copies runtime logs without replacing a concurrent writer's fields", async () => {
    const { syncMetadataFromWorktreeToMain } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senti-sync-metadata-");
    const mainRoot = path.join(tmp, "main");
    const worktreeRoot = path.join(tmp, "worktree");
    const specId = "123";
    const wtSpecDir = path.join(worktreeRoot, "specs", specId);
    const mainSpecDir = path.join(mainRoot, "specs", specId);
    fs.mkdirSync(wtSpecDir, { recursive: true });
    fs.mkdirSync(mainSpecDir, { recursive: true });

    const spec = `specs/${specId}/spec.json`;
    const mainState = setupFlow(mainRoot, { spec, runId: "run-main", concurrentWriter: "winner" });
    const wtState = setupFlow(worktreeRoot, { spec, runId: "run-main" });
    const wtFinalize = findStepById(wtState.steps, "finalize-merge");
    wtFinalize.runtimeLog = { sequence: 5, runId: "abc" };
    replaceFlowState(worktreeRoot, wtState, { specId });

    syncMetadataFromWorktreeToMain(worktreeRoot, mainRoot, specId);

    const mainAfter = JSON.parse(fs.readFileSync(path.join(mainSpecDir, "flow.json"), "utf8"));
    const finalize = findStepById(mainAfter.steps, "finalize-merge");
    assert.ok(finalize.runtimeLog, "runtimeLog should have been synced");
    assert.equal(finalize.runtimeLog.sequence, 5);
    assert.equal(mainAfter.concurrentWriter, "winner");
  });

  it("syncMetadataFromWorktreeToMain preserves a concurrent writer's newer runtime log", async () => {
    const { syncMetadataFromWorktreeToMain } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senti-sync-metadata-winner-");
    const mainRoot = path.join(tmp, "main");
    const worktreeRoot = path.join(tmp, "worktree");
    const specId = "124";
    const spec = `specs/${specId}/spec.json`;
    fs.mkdirSync(mainRoot);
    fs.mkdirSync(worktreeRoot);
    const mainState = setupFlow(mainRoot, { spec, runId: "run-shared" });
    const worktreeState = setupFlow(worktreeRoot, { spec, runId: "run-shared" });
    findStepById(mainState.steps, "finalize-merge").runtimeLog = { sequence: 6, runId: "winner" };
    findStepById(worktreeState.steps, "finalize-merge").runtimeLog = { sequence: 5, runId: "stale" };
    replaceFlowState(mainRoot, mainState, { specId });
    replaceFlowState(worktreeRoot, worktreeState, { specId });

    syncMetadataFromWorktreeToMain(worktreeRoot, mainRoot, specId);

    const saved = makeFlowManager(mainRoot).load(specId);
    assert.deepEqual(findStepById(saved.steps, "finalize-merge").runtimeLog, {
      sequence: 6,
      runId: "winner",
    });
  });

  it("finalize stops before every teardown side effect when main metadata sync is busy, then succeeds on retry", async () => {
    const { runTeardown } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senti-finalize-sync-required-");
    const mainRoot = path.join(tmp, "main");
    const worktreePath = path.join(tmp, "worktree");
    const specId = "125";
    const spec = `specs/${specId}/spec.json`;
    const featureBranch = `feature/${specId}`;
    initGitRepo(mainRoot);

    const mainState = setupFlow(mainRoot, {
      spec,
      runId: "run-required-sync",
      featureBranch,
      baseBranch: "master",
      worktree: true,
    });
    execFileSync("git", ["-C", mainRoot, "add", `specs/${specId}/flow.json`]);
    execFileSync("git", ["-C", mainRoot, "commit", "--quiet", "-m", "add flow"]);
    execFileSync("git", ["-C", mainRoot, "worktree", "add", "-b", featureBranch, worktreePath]);
    const worktreeState = makeFlowManager(worktreePath).load(specId);
    findStepById(worktreeState.steps, "finalize-merge").runtimeLog = { sequence: 7, runId: "worktree-log" };
    replaceFlowState(worktreePath, worktreeState, { specId });
    execFileSync("git", ["-C", worktreePath, "add", `specs/${specId}/flow.json`]);
    execFileSync("git", ["-C", worktreePath, "commit", "--quiet", "-m", "record runtime log"]);

    const fm = new FlowManager({ root: worktreePath, mainRoot, inWorktree: true, specId });
    const registryPath = path.join(mainRoot, ".senti", ".active-flow");
    const lockPath = writeLiveFlowWriterLock(mainRoot, specId);
    const before = {
      mainFlow: fs.readFileSync(path.join(mainRoot, `specs/${specId}/flow.json`)),
      worktreeFlow: fs.readFileSync(path.join(worktreePath, `specs/${specId}/flow.json`)),
      registry: fs.readFileSync(registryPath),
      head: execFileSync("git", ["-C", mainRoot, "rev-parse", "HEAD"], { encoding: "utf8" }),
      branches: execFileSync("git", ["-C", mainRoot, "branch", "--format=%(refname)"], { encoding: "utf8" }),
      worktrees: execFileSync("git", ["-C", mainRoot, "worktree", "list", "--porcelain"], { encoding: "utf8" }),
    };
    const ctx = {
      flowManager: fm,
      flowState: worktreeState,
      root: worktreePath,
      mainRoot,
      force: true,
    };

    const stopped = await runTeardown(ctx, {
      worktreePath,
      mainRepoPath: mainRoot,
      reportRoot: mainRoot,
      specId,
    });

    assert.equal(stopped.ok, false);
    assert.equal(stopped.errors[0].code, "FINALIZE_METADATA_SYNC_FAILED");
    assert.deepEqual(fs.readFileSync(path.join(mainRoot, `specs/${specId}/flow.json`)), before.mainFlow);
    assert.deepEqual(fs.readFileSync(path.join(worktreePath, `specs/${specId}/flow.json`)), before.worktreeFlow);
    assert.deepEqual(fs.readFileSync(registryPath), before.registry);
    assert.equal(execFileSync("git", ["-C", mainRoot, "rev-parse", "HEAD"], { encoding: "utf8" }), before.head);
    assert.equal(execFileSync("git", ["-C", mainRoot, "branch", "--format=%(refname)"], { encoding: "utf8" }), before.branches);
    assert.equal(execFileSync("git", ["-C", mainRoot, "worktree", "list", "--porcelain"], { encoding: "utf8" }), before.worktrees);

    fs.unlinkSync(lockPath);
    const retried = await runTeardown(ctx, {
      worktreePath,
      mainRepoPath: mainRoot,
      reportRoot: mainRoot,
      specId,
    });
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(fs.existsSync(worktreePath), false);
    assert.equal(fs.existsSync(registryPath), false);
  });

  it("validateTeardown detects remaining branch", async () => {
    const { validateTeardown } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senti-validate-teardown-");
    initGitRepo(tmp);
    const featureBranch = "feature/test";
    execFileSync("git", ["-C", tmp, "checkout", "-b", featureBranch], { encoding: "utf8" });

    const result = validateTeardown({
      worktreePath: path.join(tmp, "wt"),
      mainRepoPath: tmp,
      featureBranch,
      specId: "123"
    });

    assert.equal(result.ok, false);
    assert.ok(result.reasons.some(r => r.includes("Feature branch remains")));
  });

  it("runTeardown fails if worktree remove fails (e.g. dirty)", async () => {
    tmp = createTmpDir("senti-teardown-fail-");
    const mainRoot = path.join(tmp, "main");
    initGitRepo(mainRoot);

    const featureBranch = "feature/test";
    const specId = "123";
    const worktreePath = path.join(tmp, "wt");

    // Create a real worktree
    execFileSync("git", ["-C", mainRoot, "worktree", "add", "-b", featureBranch, worktreePath], { encoding: "utf8" });

    // Make it dirty
    fs.writeFileSync(path.join(worktreePath, "dirty.txt"), "dirty");

    const { FlowManager } = await import("../../../src/lib/flow-manager.js");
    const fm = new FlowManager({ root: worktreePath, mainRoot: mainRoot, inWorktree: true, specId });
    const state = setupFlow(mainRoot, { spec: `specs/${specId}/spec.json` });
    const ctx = {
      flowManager: fm,
      flowState: {
        ...state,
        worktree: true,
        featureBranch,
        baseBranch: "master"
      },
      root: worktreePath,
      mainRoot: mainRoot
    };

    const { runTeardown } = await import("../../../src/flow/lib/run-finalize-cleanup.js");

    const result = await runTeardown(ctx, {
      worktreePath,
      mainRepoPath: mainRoot,
      reportRoot: mainRoot,
      specId
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "WORKTREE_REMOVE_FAILED");

    // Cleanup the worktree for real so we can delete tmp
    execFileSync("git", ["-C", mainRoot, "worktree", "remove", "--force", worktreePath], { encoding: "utf8" });
  });
});
