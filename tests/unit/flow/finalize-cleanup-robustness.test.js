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
import { execFileSync, spawn, spawnSync } from "child_process";
import { pathToFileURL } from "node:url";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager, replaceFlowState } from "../../helpers/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { ProcessIdentitySource } from "../../../src/lib/flow-state-atomic-writer.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../../src/lib/worktree-flow-binding.js";
import { IssueLogStore } from "../../../src/flow/lib/issue-log-store.js";
import {
  FlowOutboxStore,
  finalizationOutboxIdentity,
} from "../../../src/flow/lib/flow-outbox.js";

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
    version: 3,
    kind: "flow-state-writer",
    processIdentity,
    root: fs.realpathSync(root),
    specId: specId,
    specRoot: "specs",
    statePath: fs.realpathSync(statePath),
  }, null, 2)}\n`, { mode: 0o600 });
  return lockPath;
}

function saveManagedWorktreeBinding(worktreePath, state) {
  new WorktreeFlowBindingStore({ worktreePath }).save(new WorktreeFlowIdentity({
    runId: state.runId,
    issue: Object.hasOwn(state, "issue") ? state.issue : null,
    specId: state.specId,
    worktreePath,
  }));
}

describe("finalize-cleanup robustness", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("registry post hooks switch ctx.flowManager to main repo authority", async () => {
    tmp = createTmpDir("senrail-finalize-auth-switch-");
    const mainRoot = path.join(tmp, "main");
    const worktreeRoot = path.join(tmp, "worktree");
    fs.mkdirSync(mainRoot);
    fs.mkdirSync(worktreeRoot);
    initGitRepo(mainRoot);

    const state = setupFlow(mainRoot, { worktree: true, featureBranch: "feature/test" });
    const specId = state.specId;

    const { FlowManager } = await import("../../../src/lib/flow-manager.js");
    const fm = new FlowManager({ root: worktreeRoot, mainRoot: mainRoot, inWorktree: true, specId });
    new FlowOutboxStore(fm, { specId }).begin(finalizationOutboxIdentity(state, "finalize-merge"));
    const preparedState = fm.loadReadOnly(specId);
    const ctx = {
      flowManager: fm,
      flowState: { ...preparedState, worktree: true, featureBranch: "feature/test" },
      root: mainRoot,
      repositoryRoot: mainRoot,
      executionRoot: worktreeRoot,
      mainRoot: mainRoot,
      specId,
    };

    const entry = FLOW_COMMANDS.run["finalize-merge"];
    await entry.post(ctx, { status: "done", strategy: "squash" });

    assert.notEqual(ctx.flowManager, fm, "flowManager should have been switched");
    assert.equal(path.resolve(ctx.flowManager._root), path.resolve(mainRoot), "new flowManager should be rooted in main");
  });

  it("finalize stops before every teardown side effect when main metadata sync is busy, then succeeds on retry", async () => {
    const { runTeardown } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-finalize-sync-required-");
    const mainRoot = path.join(tmp, "main");
    const worktreePath = path.join(tmp, "worktree");
    const specId = "125";
    const spec = `specs/${specId}/spec.json`;
    const featureBranch = `feature/${specId}`;
    initGitRepo(mainRoot);

    const mainState = setupFlow(mainRoot, {
      specId,
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
    const registryPath = path.join(mainRoot, ".senrail", ".active-flow");
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
      flowState: fm.loadReadOnly(specId),
      root: mainRoot,
      mainRoot,
      repositoryRoot: mainRoot,
      executionRoot: worktreePath,
      force: true,
    };

    await assert.rejects(
      () => runTeardown(ctx, {
        worktreePath,
        mainRepoPath: mainRoot,
        reportRoot: mainRoot,
        specId,
      }),
      (error) => error.code === "FLOW_STATE_ATOMIC_BUSY",
    );
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
    assert.equal(fs.existsSync(registryPath), true, "active entry is cleared only after the completion commit");
  });

  it("validateTeardown detects remaining branch", async () => {
    const { validateTeardown } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-validate-teardown-");
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

  it("auto-rescue updates the base without changing the caller checkout, HEAD, or index", async () => {
    const { runAutoRescue } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-auto-rescue-isolated-");
    initGitRepo(tmp);
    const baseBranch = execFileSync("git", ["-C", tmp, "branch", "--show-current"], { encoding: "utf8" }).trim();
    const baseline = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const featureBranch = "feature/isolated-rescue";
    execFileSync("git", ["-C", tmp, "checkout", "-qb", featureBranch]);
    fs.writeFileSync(path.join(tmp, "rescued.txt"), "rescued\n");
    execFileSync("git", ["-C", tmp, "add", "rescued.txt"]);
    execFileSync("git", ["-C", tmp, "commit", "-qm", "rescue me"]);
    const before = {
      branch: execFileSync("git", ["-C", tmp, "branch", "--show-current"], { encoding: "utf8" }),
      head: execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }),
      index: fs.readFileSync(path.join(tmp, ".git", "index")),
    };

    const result = runAutoRescue({
      mainRepoPath: tmp,
      baseBranch,
      baseline,
      featureBranch,
      specId: "isolated-rescue",
    });

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(execFileSync("git", ["-C", tmp, "branch", "--show-current"], { encoding: "utf8" }), before.branch);
    assert.equal(execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }), before.head);
    assert.deepEqual(fs.readFileSync(path.join(tmp, ".git", "index")), before.index);
    assert.equal(execFileSync("git", ["-C", tmp, "show", `${baseBranch}:rescued.txt`], { encoding: "utf8" }), "rescued\n");
  });

  it("auto-rescue materializes an updated base checkout and leaves its index clean", async () => {
    const { runAutoRescue } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-auto-rescue-base-checkout-");
    initGitRepo(tmp);
    const baseBranch = execFileSync("git", ["-C", tmp, "branch", "--show-current"], { encoding: "utf8" }).trim();
    const baseline = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const featureBranch = "feature/materialized-rescue";
    execFileSync("git", ["-C", tmp, "checkout", "-qb", featureBranch]);
    fs.writeFileSync(path.join(tmp, "rescued.txt"), "rescued on base\n");
    execFileSync("git", ["-C", tmp, "add", "rescued.txt"]);
    execFileSync("git", ["-C", tmp, "commit", "-qm", "rescue materialized file"]);
    execFileSync("git", ["-C", tmp, "checkout", "-q", baseBranch]);

    const result = runAutoRescue({
      mainRepoPath: tmp,
      baseBranch,
      baseline,
      featureBranch,
      specId: "materialized-rescue",
    });

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(fs.readFileSync(path.join(tmp, "rescued.txt"), "utf8"), "rescued on base\n");
    assert.equal(execFileSync("git", ["-C", tmp, "status", "--porcelain"], { encoding: "utf8" }), "");
  });

  it("public auto-rescue resumes a ref-update crash before dirty preflight", async () => {
    const { runAutoRescue } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-auto-rescue-ref-crash-");
    initGitRepo(tmp);
    const baseBranch = execFileSync("git", ["-C", tmp, "branch", "--show-current"], { encoding: "utf8" }).trim();
    const baseline = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const featureBranch = "feature/ref-crash-rescue";
    execFileSync("git", ["-C", tmp, "checkout", "-qb", featureBranch]);
    fs.writeFileSync(path.join(tmp, "rescued-after-crash.txt"), "recovered\n");
    execFileSync("git", ["-C", tmp, "add", "rescued-after-crash.txt"]);
    execFileSync("git", ["-C", tmp, "commit", "-qm", "rescue after ref crash"]);
    execFileSync("git", ["-C", tmp, "checkout", "-q", baseBranch]);

    const bin = path.join(tmp, ".git", "crash-bin");
    fs.mkdirSync(bin);
    const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    fs.writeFileSync(path.join(bin, "git"), [
      "#!/bin/sh",
      `real=${JSON.stringify(realGit)}`,
      'case "$*" in *update-ref*refs/heads/*)',
      '  "$real" "$@" || exit $?',
      '  kill -KILL "$SENRAIL_RESCUE_PID"',
      "  sleep 5",
      "  exit 91",
      ";; esac",
      'exec "$real" "$@"',
      "",
    ].join("\n"), { mode: 0o755 });
    const moduleUrl = pathToFileURL(path.resolve("src/flow/lib/run-finalize-cleanup.js")).href;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
      const { runAutoRescue } = await import(${JSON.stringify(moduleUrl)});
      process.env.SENRAIL_RESCUE_PID = String(process.pid);
      runAutoRescue(${JSON.stringify({
        mainRepoPath: tmp,
        baseBranch,
        baseline,
        featureBranch,
        specId: "ref-crash-rescue",
      })});
    `], {
      cwd: tmp,
      env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` },
      encoding: "utf8",
    });
    assert.equal(child.signal, "SIGKILL", child.stderr);
    assert.notEqual(execFileSync("git", ["-C", tmp, "rev-parse", baseBranch], { encoding: "utf8" }).trim(), baseline);
    assert.notEqual(execFileSync("git", ["-C", tmp, "status", "--porcelain"], { encoding: "utf8" }), "");

    const resumed = runAutoRescue({
      mainRepoPath: tmp,
      baseBranch,
      baseline,
      featureBranch,
      specId: "ref-crash-rescue",
    });
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    assert.equal(fs.readFileSync(path.join(tmp, "rescued-after-crash.txt"), "utf8"), "recovered\n");
    assert.equal(execFileSync("git", ["-C", tmp, "status", "--porcelain"], { encoding: "utf8" }), "");
  });

  it("auto-rescue adopts a successful ref CAS reported as a Git failure", async () => {
    const { runAutoRescue } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-auto-rescue-ref-ambiguous-");
    initGitRepo(tmp);
    const baseBranch = execFileSync("git", ["-C", tmp, "branch", "--show-current"], { encoding: "utf8" }).trim();
    const baseline = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const featureBranch = "feature/ref-ambiguous-rescue";
    execFileSync("git", ["-C", tmp, "checkout", "-qb", featureBranch]);
    fs.writeFileSync(path.join(tmp, "ambiguous-ref.txt"), "adopted\n");
    execFileSync("git", ["-C", tmp, "add", "ambiguous-ref.txt"]);
    execFileSync("git", ["-C", tmp, "commit", "-qm", "ambiguous ref rescue"]);
    execFileSync("git", ["-C", tmp, "checkout", "-q", baseBranch]);
    const bin = path.join(tmp, ".git", "ambiguous-bin");
    fs.mkdirSync(bin);
    const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    fs.writeFileSync(path.join(bin, "git"), [
      "#!/bin/sh",
      `real=${JSON.stringify(realGit)}`,
      'case "$*" in *update-ref*refs/heads/*)',
      '  "$real" "$@" || exit $?',
      "  echo injected-ambiguous-result >&2",
      "  exit 73",
      ";; esac",
      'exec "$real" "$@"',
      "",
    ].join("\n"), { mode: 0o755 });
    const oldPath = process.env.PATH;
    process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
    let result;
    try {
      result = runAutoRescue({
        mainRepoPath: tmp,
        baseBranch,
        baseline,
        featureBranch,
        specId: "ref-ambiguous-rescue",
      });
    } finally {
      process.env.PATH = oldPath;
    }
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(fs.readFileSync(path.join(tmp, "ambiguous-ref.txt"), "utf8"), "adopted\n");
    assert.equal(execFileSync("git", ["-C", tmp, "status", "--porcelain"], { encoding: "utf8" }), "");
  });

  it("auto-rescue fails closed when conflict-file probing fails", async () => {
    const { runAutoRescue } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-auto-rescue-conflict-probe-");
    initGitRepo(tmp);
    const baseBranch = execFileSync("git", ["-C", tmp, "branch", "--show-current"], { encoding: "utf8" }).trim();
    const baseline = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const featureBranch = "feature/conflict-probe-rescue";
    execFileSync("git", ["-C", tmp, "checkout", "-qb", featureBranch]);
    fs.writeFileSync(path.join(tmp, "README.md"), "feature version\n");
    execFileSync("git", ["-C", tmp, "commit", "-qam", "feature conflict"]);
    execFileSync("git", ["-C", tmp, "checkout", "-q", baseBranch]);
    fs.writeFileSync(path.join(tmp, "README.md"), "base version\n");
    execFileSync("git", ["-C", tmp, "commit", "-qam", "base conflict"]);
    const baseHead = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const bin = path.join(tmp, ".git", "probe-bin");
    fs.mkdirSync(bin);
    const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    fs.writeFileSync(path.join(bin, "git"), [
      "#!/bin/sh",
      'case "$*" in *diff*--name-only*--diff-filter=U*) echo injected-conflict-probe >&2; exit 74;; esac',
      `exec ${JSON.stringify(realGit)} "$@"`,
      "",
    ].join("\n"), { mode: 0o755 });
    const oldPath = process.env.PATH;
    process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
    try {
      assert.throws(
        () => runAutoRescue({
          mainRepoPath: tmp,
          baseBranch,
          baseline,
          featureBranch,
          specId: "conflict-probe-rescue",
        }),
        (error) => error.code === "AUTO_RESCUE_CONFLICT_PROBE_FAILED",
      );
    } finally {
      process.env.PATH = oldPath;
    }
    assert.equal(execFileSync("git", ["-C", tmp, "rev-parse", baseBranch], { encoding: "utf8" }).trim(), baseHead);
    assert.equal(execFileSync("git", ["-C", tmp, "status", "--porcelain"], { encoding: "utf8" }), "");
  });

  it("auto-rescue exempts only its exact conflict audit from issue-log dirtiness", async () => {
    const { runAutoRescue } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-auto-rescue-issue-log-allowance-");
    initGitRepo(tmp);
    const specId = "issue-log-allowance";
    const specDirectory = path.join(tmp, "specs", specId);
    const issuePath = path.join(specDirectory, "issue-log.json");
    fs.mkdirSync(specDirectory, { recursive: true });
    fs.writeFileSync(path.join(specDirectory, "spec.json"), "{}\n");
    execFileSync("git", ["-C", tmp, "add", `specs/${specId}`]);
    execFileSync("git", ["-C", tmp, "commit", "-qm", "add issue log"]);
    const baseBranch = execFileSync("git", ["-C", tmp, "branch", "--show-current"], { encoding: "utf8" }).trim();
    const baseline = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const featureBranch = "feature/issue-log-allowance";
    execFileSync("git", ["-C", tmp, "checkout", "-qb", featureBranch]);
    fs.writeFileSync(path.join(tmp, "rescued.txt"), "rescue audit allowance\n");
    execFileSync("git", ["-C", tmp, "add", "rescued.txt"]);
    execFileSync("git", ["-C", tmp, "commit", "-qm", "add rescued file"]);
    execFileSync("git", ["-C", tmp, "checkout", "-q", baseBranch]);

    const ownedAudit = { reason: "owned conflict", issueLogId: "owned-conflict-audit" };
    fs.writeFileSync(issuePath, `${JSON.stringify({ entries: [ownedAudit, { reason: "user edit" }] })}\n`);
    const blocked = runAutoRescue({
      mainRepoPath: tmp,
      baseBranch,
      baseline,
      featureBranch,
      specId,
      allowedIssueLogId: ownedAudit.issueLogId,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "MAIN_REPO_DIRTY");
    assert.deepEqual(blocked.dirtyFiles, [`specs/${specId}/issue-log.json`]);

    fs.writeFileSync(issuePath, `${JSON.stringify({ entries: [ownedAudit] })}\n`);
    const rescued = runAutoRescue({
      mainRepoPath: tmp,
      baseBranch,
      baseline,
      featureBranch,
      specId,
      allowedIssueLogId: ownedAudit.issueLogId,
    });
    assert.equal(rescued.ok, true, JSON.stringify(rescued));
    assert.equal(fs.readFileSync(path.join(tmp, "rescued.txt"), "utf8"), "rescue audit allowance\n");
    assert.deepEqual(JSON.parse(fs.readFileSync(issuePath, "utf8")).entries, [ownedAudit]);
  });

  it("auto-rescue fails closed when repository status cannot be established", async () => {
    const { runAutoRescue } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-auto-rescue-status-failure-");

    const result = runAutoRescue({
      mainRepoPath: tmp,
      baseBranch: "main",
      baseline: "1".repeat(40),
      featureBranch: "feature/status-failure",
      specId: "status-failure",
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "MAIN_REPO_STATUS_FAILED");
    assert.match(result.message, /status probe failed/i);
  });

  it("runTeardown fails if worktree remove fails (e.g. dirty)", async () => {
    tmp = createTmpDir("senrail-teardown-fail-");
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
    setupFlow(mainRoot, {
      specId,
      worktree: true,
      featureBranch,
      baseBranch: "master",
    });
    const ctx = {
      flowManager: fm,
      flowState: fm.loadReadOnly(specId),
      root: mainRoot,
      mainRoot,
      repositoryRoot: mainRoot,
      executionRoot: worktreePath,
    };

    const { runTeardown } = await import("../../../src/flow/lib/run-finalize-cleanup.js");

    const result = await runTeardown(ctx, {
      worktreePath,
      mainRepoPath: mainRoot,
      reportRoot: mainRoot,
      specId
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "WORKTREE_DIRTY");

    // Cleanup the worktree for real so we can delete tmp
    execFileSync("git", ["-C", mainRoot, "worktree", "remove", "--force", worktreePath], { encoding: "utf8" });
  });

  it("forced teardown failure compensates only its stable audit id after another process appends", async () => {
    const { RunFinalizeCleanupCommand } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-finalize-audit-compensation-");
    initGitRepo(tmp);
    const specId = "126";
    const spec = `specs/${specId}/spec.json`;
    const featureBranch = "feature/126";
    const state = setupFlow(tmp, {
      specId,
      runId: "run-compensation",
      baseBranch: "master",
      featureBranch,
      worktree: false,
    });
    state.state = {};
    replaceFlowState(tmp, state, { specId });
    execFileSync("git", ["-C", tmp, "branch", featureBranch]);
    const issuePath = path.join(tmp, `specs/${specId}/issue-log.json`);
    fs.writeFileSync(issuePath, `${JSON.stringify({ entries: [{ issueLogId: "existing", reason: "existing" }] }, null, 2)}\n`);
    const marker = path.join(tmp, "concurrent-appended");
    const hook = path.join(tmp, ".git", "hooks", "pre-commit");
    fs.writeFileSync(hook, `#!/bin/sh\nwhile [ ! -f ${JSON.stringify(marker)} ]; do sleep 0.01; done\nexit 1\n`, { mode: 0o755 });
    const watcherScript = `
      const fs = require("node:fs");
      const issuePath = ${JSON.stringify(issuePath)};
      const marker = ${JSON.stringify(marker)};
      const wait = new Int32Array(new SharedArrayBuffer(4));
      for (let attempt = 0; attempt < 500; attempt += 1) {
        const value = JSON.parse(fs.readFileSync(issuePath, "utf8"));
        if (value.entries.some((entry) => /FORCED_ORPHAN_DROP/.test(entry.reason || ""))) {
          value.entries.push({ issueLogId: "concurrent-writer", reason: "concurrent" });
          fs.writeFileSync(issuePath, JSON.stringify(value, null, 2) + "\\n");
          fs.writeFileSync(marker, "done");
          process.exit(0);
        }
        Atomics.wait(wait, 0, 0, 10);
      }
      process.exit(2);
    `;
    const watcher = spawn(process.execPath, ["-e", watcherScript], { stdio: "ignore" });
    const watcherDone = new Promise((resolve) => watcher.on("close", resolve));

    const result = await new RunFinalizeCleanupCommand().execute({
      root: tmp,
      flowState: state,
      flowManager: makeFlowManager(tmp),
      force: true,
    });
    assert.equal(await watcherDone, 0);

    assert.equal(result.ok, true, JSON.stringify(result));
    const entries = JSON.parse(fs.readFileSync(issuePath, "utf8")).entries;
    assert.equal(entries.some((entry) => entry.issueLogId === "existing"), true);
    assert.equal(entries.some((entry) => entry.issueLogId === "concurrent-writer"), true);
    assert.equal(entries.some((entry) => /FORCED_ORPHAN_DROP/.test(entry.reason || "")), true);
  });

  it("forced teardown fails closed before destructive work when audit append fails", async () => {
    const { RunFinalizeCleanupCommand } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senrail-finalize-audit-fail-stop-");
    initGitRepo(tmp);
    const specId = "127";
    const spec = `specs/${specId}/spec.json`;
    const featureBranch = "feature/127";
    const state = setupFlow(tmp, {
      specId,
      runId: "run-audit-fail-stop",
      baseBranch: "master",
      featureBranch,
      worktree: false,
    });
    state.state = {};
    replaceFlowState(tmp, state, { specId });
    execFileSync("git", ["-C", tmp, "branch", featureBranch]);
    const issuePath = path.join(tmp, `specs/${specId}/issue-log.json`);
    fs.mkdirSync(issuePath);
    const before = {
      flow: fs.readFileSync(path.join(tmp, `specs/${specId}/flow.json`)),
      head: execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }),
      branches: execFileSync("git", ["-C", tmp, "branch", "--format=%(refname)"], { encoding: "utf8" }),
      worktrees: execFileSync("git", ["-C", tmp, "worktree", "list", "--porcelain"], { encoding: "utf8" }),
    };

    const result = await new RunFinalizeCleanupCommand().execute({
      root: tmp,
      flowState: state,
      flowManager: makeFlowManager(tmp),
      force: true,
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "ISSUE_LOG_AUDIT_FAILED");
    assert.deepEqual(fs.readFileSync(path.join(tmp, `specs/${specId}/flow.json`)), before.flow);
    assert.equal(execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }), before.head);
    assert.equal(execFileSync("git", ["-C", tmp, "branch", "--format=%(refname)"], { encoding: "utf8" }), before.branches);
    assert.equal(execFileSync("git", ["-C", tmp, "worktree", "list", "--porcelain"], { encoding: "utf8" }), before.worktrees);
    assert.equal(fs.statSync(issuePath).isDirectory(), true);
  });

});
