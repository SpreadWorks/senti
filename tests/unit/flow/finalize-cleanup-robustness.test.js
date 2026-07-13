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
import { execFileSync, spawn } from "child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager, replaceFlowState } from "../../helpers/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { ProcessIdentitySource } from "../../../src/lib/flow-state-atomic-writer.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { IssueLogStore } from "../../../src/flow/lib/issue-log-store.js";

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

  it("forced teardown failure compensates only its stable audit id after another process appends", async () => {
    const { RunFinalizeCleanupCommand } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senti-finalize-audit-compensation-");
    initGitRepo(tmp);
    const specId = "126";
    const spec = `specs/${specId}/spec.json`;
    const featureBranch = "feature/126";
    const state = setupFlow(tmp, {
      spec,
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

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "COMMIT_FAILED");
    const entries = JSON.parse(fs.readFileSync(issuePath, "utf8")).entries;
    assert.deepEqual(entries.map((entry) => entry.issueLogId), ["existing", "concurrent-writer"]);
    assert.equal(entries.some((entry) => /FORCED_ORPHAN_DROP/.test(entry.reason || "")), false);
  });

  it("forced teardown fails closed before destructive work when audit append fails", async () => {
    const { RunFinalizeCleanupCommand } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senti-finalize-audit-fail-stop-");
    initGitRepo(tmp);
    const specId = "127";
    const spec = `specs/${specId}/spec.json`;
    const featureBranch = "feature/127";
    const state = setupFlow(tmp, {
      spec,
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

  it("forced teardown reports compensation failure with the original teardown failure and one audit entry", async () => {
    const { RunFinalizeCleanupCommand } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    tmp = createTmpDir("senti-finalize-audit-compensation-failure-");
    initGitRepo(tmp);
    const specId = "128";
    const spec = `specs/${specId}/spec.json`;
    const featureBranch = "feature/128";
    const state = setupFlow(tmp, {
      spec,
      runId: "run-compensation-failure",
      baseBranch: "master",
      featureBranch,
      worktree: false,
    });
    state.state = {};
    replaceFlowState(tmp, state, { specId });
    execFileSync("git", ["-C", tmp, "branch", featureBranch]);
    const issuePath = path.join(tmp, `specs/${specId}/issue-log.json`);
    fs.writeFileSync(issuePath, '{"entries":[]}\n');
    fs.writeFileSync(path.join(tmp, ".git", "hooks", "pre-commit"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const originalCompensate = IssueLogStore.prototype.compensate;
    IssueLogStore.prototype.compensate = () => {
      const error = new Error("injected compensation failure");
      error.code = "INJECTED_COMPENSATION_FAILURE";
      throw error;
    };
    let result;
    try {
      result = await new RunFinalizeCleanupCommand().execute({
        root: tmp,
        flowState: state,
        flowManager: makeFlowManager(tmp),
        force: true,
      });
    } finally {
      IssueLogStore.prototype.compensate = originalCompensate;
    }

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "ISSUE_LOG_AUDIT_COMPENSATION_FAILED");
    assert.equal(result.data.originalTeardown.errors[0].code, "COMMIT_FAILED");
    assert.equal(result.data.causeCode, "INJECTED_COMPENSATION_FAILURE");
    const entries = JSON.parse(fs.readFileSync(issuePath, "utf8")).entries;
    assert.equal(entries.filter((entry) => /FORCED_ORPHAN_DROP/.test(entry.reason || "")).length, 1);
  });

  it("post-commit teardown failures retain durable audit and active recovery until an idempotent retry succeeds", async () => {
    const { RunFinalizeCleanupCommand } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    const failures = [
      ["worktree-remove", "WORKTREE_REMOVE_FAILED", "commit-durable"],
      ["branch-delete", "BRANCH_DELETE_FAILED", "worktree-removed"],
      ["teardown-validation", "TEARDOWN_VALIDATION_FAILED", "branch-deleted"],
    ];

    for (const [faultPhase, expectedCode, expectedPhase] of failures) {
      const root = createTmpDir(`senti-finalize-post-commit-${faultPhase}-`);
      try {
        initGitRepo(root);
        const specId = `13${failures.findIndex(([phase]) => phase === faultPhase)}`;
        const spec = `specs/${specId}/spec.json`;
        const featureBranch = `feature/${specId}`;
        const worktreePath = path.join(root, ".senti", "worktree", featureBranch.replaceAll("/", "-"));
        const fm = makeFlowManager(root);
        const state = setupFlow(root, {
          spec,
          runId: `run-${faultPhase}`,
          baseBranch: "master",
          featureBranch,
          worktree: true,
        });
        state.state = {};
        replaceFlowState(root, state, { specId });
        fm.addActiveFlow(specId, "branch");
        execFileSync("git", ["-C", root, "add", `specs/${specId}/flow.json`]);
        execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "add flow authority"]);
        execFileSync("git", ["-C", root, "worktree", "add", "-b", featureBranch, worktreePath]);
        const branchBlocker = path.join(root, "branch-blocker");
        if (faultPhase === "worktree-remove") {
          execFileSync("git", ["-C", root, "worktree", "lock", worktreePath]);
        }
        if (faultPhase === "branch-delete") {
          execFileSync("git", ["-C", root, "worktree", "add", "--force", branchBlocker, featureBranch]);
        }
        const referenceHook = path.join(root, ".git", "hooks", "reference-transaction");
        if (faultPhase === "teardown-validation") {
          fs.writeFileSync(referenceHook, [
            "#!/bin/sh",
            'if [ "$1" = "committed" ]; then',
            `  mkdir -p ${JSON.stringify(worktreePath)}`,
            "fi",
            "",
          ].join("\n"), { mode: 0o755 });
        }
        const issuePath = path.join(root, `specs/${specId}/issue-log.json`);
        fs.writeFileSync(issuePath, `${JSON.stringify({
          entries: [{ issueLogId: "other-writer", reason: "independent audit" }],
        }, null, 2)}\n`);
        const headBefore = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

        const failed = await new RunFinalizeCleanupCommand().execute({
          root,
          flowState: state,
          flowManager: fm,
          force: true,
        });

        assert.equal(failed.ok, false, faultPhase);
        assert.equal(failed.errors[0].code, expectedCode, faultPhase);
        const committedHead = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
        assert.notEqual(committedHead, headBefore, `${faultPhase}: audit commit must be durable`);
        const committedIssue = JSON.parse(execFileSync("git", [
          "-C", root, "show", `HEAD:specs/${specId}/issue-log.json`,
        ], { encoding: "utf8" }));
        assert.equal(committedIssue.entries.filter((entry) => /FORCED_ORPHAN_DROP/.test(entry.reason || "")).length, 1);
        assert.equal(committedIssue.entries.filter((entry) => entry.issueLogId === "other-writer").length, 1);
        const liveEntries = JSON.parse(fs.readFileSync(issuePath, "utf8")).entries;
        assert.equal(liveEntries.filter((entry) => /FORCED_ORPHAN_DROP/.test(entry.reason || "")).length, 1, faultPhase);
        assert.equal(liveEntries.filter((entry) => entry.issueLogId === "other-writer").length, 1, faultPhase);
        assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), true, faultPhase);
        assert.equal(fs.existsSync(path.join(root, ".senti", "last-finalized-spec")), false, faultPhase);
        assert.equal(fs.existsSync(worktreePath), faultPhase !== "branch-delete", faultPhase);
        const recoveryDir = path.join(root, ".senti", "recovery", "finalize-cleanup");
        const recoveryFiles = fs.readdirSync(recoveryDir);
        assert.equal(recoveryFiles.length, 1, faultPhase);
        const transactionPath = path.join(recoveryDir, recoveryFiles[0]);
        assert.equal(fs.existsSync(transactionPath), true, faultPhase);
        assert.equal(JSON.parse(fs.readFileSync(transactionPath, "utf8")).phase, expectedPhase, faultPhase);

        if (faultPhase === "worktree-remove") {
          const transactionBytes = fs.readFileSync(transactionPath);
          const transactionValue = JSON.parse(transactionBytes);
          const authorityBefore = {
            flow: fs.readFileSync(path.join(root, `specs/${specId}/flow.json`)),
            issue: fs.readFileSync(issuePath),
            active: fs.readFileSync(path.join(root, ".senti", ".active-flow")),
            head: execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }),
            worktrees: execFileSync("git", ["-C", root, "worktree", "list", "--porcelain"], { encoding: "utf8" }),
          };
          const external = path.join(root, "journal-external-sentinel");
          const tamperCases = [
            ["malformed", () => fs.writeFileSync(transactionPath, "{broken\n")],
            ["unknown-field", () => fs.writeFileSync(transactionPath, `${JSON.stringify({ ...transactionValue, unexpected: true })}\n`)],
            ["foreign-identity", () => fs.writeFileSync(transactionPath, `${JSON.stringify({
              ...transactionValue,
              identity: { ...transactionValue.identity, runId: "foreign-run" },
            })}\n`)],
            ["symlink", () => {
              fs.writeFileSync(external, transactionBytes);
              fs.unlinkSync(transactionPath);
              fs.symlinkSync(external, transactionPath);
            }],
            ["hardlink", () => {
              fs.writeFileSync(external, transactionBytes);
              fs.unlinkSync(transactionPath);
              fs.linkSync(external, transactionPath);
            }],
          ];
          for (const [label, tamper] of tamperCases) {
            fs.rmSync(transactionPath, { force: true });
            fs.rmSync(external, { force: true });
            fs.writeFileSync(transactionPath, transactionBytes);
            tamper();
            await assert.rejects(
              () => new RunFinalizeCleanupCommand().execute({
                root,
                flowState: fm.loadReadOnly(specId),
                flowManager: fm,
                force: true,
              }),
              undefined,
              label,
            );
            assert.deepEqual(fs.readFileSync(path.join(root, `specs/${specId}/flow.json`)), authorityBefore.flow, label);
            assert.deepEqual(fs.readFileSync(issuePath), authorityBefore.issue, label);
            assert.deepEqual(fs.readFileSync(path.join(root, ".senti", ".active-flow")), authorityBefore.active, label);
            assert.equal(execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }), authorityBefore.head, label);
            assert.equal(execFileSync("git", ["-C", root, "worktree", "list", "--porcelain"], { encoding: "utf8" }), authorityBefore.worktrees, label);
            if (fs.existsSync(external)) assert.deepEqual(fs.readFileSync(external), transactionBytes, label);
          }
          fs.rmSync(transactionPath, { force: true });
          fs.rmSync(external, { force: true });
          fs.writeFileSync(transactionPath, transactionBytes);
        }

        if (faultPhase === "worktree-remove") {
          execFileSync("git", ["-C", root, "worktree", "unlock", worktreePath]);
        }
        if (faultPhase === "branch-delete") {
          execFileSync("git", ["-C", root, "worktree", "remove", "--force", branchBlocker]);
        }
        if (faultPhase === "teardown-validation") {
          fs.unlinkSync(referenceHook);
          fs.rmSync(worktreePath, { recursive: true, force: true });
        }

        const retried = await new RunFinalizeCleanupCommand().execute({
          root,
          flowState: fm.loadReadOnly(specId),
          flowManager: fm,
          force: true,
        });
        assert.equal(retried.ok, true, `${faultPhase}: ${JSON.stringify(retried)}`);
        assert.equal(fs.existsSync(transactionPath), false, faultPhase);
        assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), false, faultPhase);
        assert.equal(fs.existsSync(path.join(root, ".senti", "last-finalized-spec")), true, faultPhase);
        const finalEntries = JSON.parse(fs.readFileSync(issuePath, "utf8")).entries;
        assert.equal(finalEntries.filter((entry) => /FORCED_ORPHAN_DROP/.test(entry.reason || "")).length, 1);
        assert.equal(finalEntries.filter((entry) => entry.issueLogId === "other-writer").length, 1);
        assert.equal(execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), committedHead);
      } finally {
        removeTmpDir(root);
      }
    }
  });

  it("completion publication preserves a durable recovery authority across pointer and active-flow failures", async () => {
    const { RunFinalizeCleanupCommand } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    const failures = [
      ["pointer-write", "FINALIZE_POINTER_WRITE_FAILED", "validated"],
      ["active-clear", "ACTIVE_FLOW_CLEAR_FAILED", "pointer-written"],
    ];

    for (const [faultPhase, expectedCode, expectedPhase] of failures) {
      const root = createTmpDir(`senti-finalize-completion-${faultPhase}-`);
      try {
        initGitRepo(root);
        const specId = faultPhase === "pointer-write" ? "133" : "134";
        const spec = `specs/${specId}/spec.json`;
        const featureBranch = `feature/${specId}`;
        const worktreePath = path.join(root, ".senti", "worktree", featureBranch.replaceAll("/", "-"));
        const fm = makeFlowManager(root);
        const state = setupFlow(root, {
          spec,
          runId: `run-${faultPhase}`,
          baseBranch: "master",
          featureBranch,
          worktree: true,
        });
        state.state = {};
        replaceFlowState(root, state, { specId });
        fm.addActiveFlow(specId, "branch");
        const activePath = path.join(root, ".senti", ".active-flow");
        const activeBytes = fs.readFileSync(activePath);
        execFileSync("git", ["-C", root, "add", `specs/${specId}/flow.json`]);
        execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "add flow authority"]);
        execFileSync("git", ["-C", root, "worktree", "add", "-b", featureBranch, worktreePath]);

        const pointerPath = path.join(root, ".senti", "last-finalized-spec");
        const activeBackup = `${activePath}.saved`;
        const referenceHook = path.join(root, ".git", "hooks", "reference-transaction");
        if (faultPhase === "pointer-write") {
          fs.mkdirSync(pointerPath);
        } else {
          fs.writeFileSync(referenceHook, [
            "#!/bin/sh",
            'if [ "$1" = "committed" ] && grep -q "refs/heads/' + featureBranch + '"; then',
            `  mv ${JSON.stringify(activePath)} ${JSON.stringify(activeBackup)}`,
            `  mkdir ${JSON.stringify(activePath)}`,
            "fi",
            "",
          ].join("\n"), { mode: 0o755 });
        }

        const headBefore = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
        const failed = await new RunFinalizeCleanupCommand().execute({
          root,
          flowState: state,
          flowManager: fm,
          force: true,
        });

        assert.equal(failed.ok, false, faultPhase);
        assert.equal(failed.errors[0].code, expectedCode, faultPhase);
        assert.equal(failed.data.teardown.phase, expectedPhase, faultPhase);
        const committedHead = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
        assert.notEqual(committedHead, headBefore, `${faultPhase}: finalize commit must remain durable`);
        const recoveryDir = path.join(root, ".senti", "recovery", "finalize-cleanup");
        const recoveryFiles = fs.readdirSync(recoveryDir);
        assert.equal(recoveryFiles.length, 1, faultPhase);
        const transactionPath = path.join(recoveryDir, recoveryFiles[0]);
        assert.equal(JSON.parse(fs.readFileSync(transactionPath, "utf8")).phase, expectedPhase, faultPhase);
        assert.equal(fs.existsSync(pointerPath), true, faultPhase);
        if (faultPhase === "pointer-write") {
          assert.equal(fs.statSync(pointerPath).isDirectory(), true);
          assert.deepEqual(fs.readFileSync(activePath), activeBytes);
          fs.rmdirSync(pointerPath);
        } else {
          assert.equal(fs.statSync(activePath).isDirectory(), true);
          assert.deepEqual(fs.readFileSync(activeBackup), activeBytes);
          fs.unlinkSync(referenceHook);
          fs.rmdirSync(activePath);
          fs.renameSync(activeBackup, activePath);
        }

        const retried = await new RunFinalizeCleanupCommand().execute({
          root,
          flowState: fm.loadReadOnly(specId),
          flowManager: fm,
          force: true,
        });
        assert.equal(retried.ok, true, `${faultPhase}: ${JSON.stringify(retried)}`);
        assert.equal(execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), committedHead);
        assert.equal(fs.existsSync(transactionPath), false, faultPhase);
        assert.equal(fs.existsSync(activePath), false, faultPhase);
        assert.equal(fs.readFileSync(pointerPath, "utf8").trim(), spec);
      } finally {
        removeTmpDir(root);
      }
    }
  });
});
