/**
 * Spec 251 R8: end-to-end regression for finalize self-contained behavior.
 *
 * Runs the cleanup CLI against a minimal git repo, exercising the
 * spec-only branch (featureBranch === baseBranch) so we don't need a real
 * worktree to reach the cleanup envelope. The branch covers the new
 * envelope contract:
 *   - data.report is null when no report.json exists (and an errors entry
 *     with code REPORT_MISSING is attached at level 'warn', preserving ok:true)
 *   - .sennel/last-finalized-spec is written
 *   - .sennel/.active-flow is cleared
 *   - flow get status returns active:false post-cleanup (R17)
 *
 * The full worktree path (commit → merge → sync → cleanup with squash) is
 * exercised at the registry-hook level by tests/integration/flow/finalize-merge-retry
 * and the registry hooks themselves; orchestrating real git worktree state
 * here would balloon the test without adding contract coverage beyond what
 * the integration and post-hook tests already provide.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../../support/builders/tmp-dir.js";
import {
  FlowAtStepFixture,
  makeFlowManager,
  setupFlowConfig,
} from "../../../support/infrastructure/flow-setup.js";
import { findStepById } from "../../../../src/flow/lib/step-tree.js";
import { FlowOutboxStore, finalizationOutboxIdentity } from "../../../../src/flow/lib/flow-outbox.js";
import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from "../../../../src/lib/worktree-flow-binding.js";
import { FlowManager } from "../../../../src/lib/flow-manager.js";

const FLOW_CMD = path.join(process.cwd(), "src/sennel.js");

function git(args, cwd) {
  return execSync(`git ${args}`, { cwd, encoding: "utf8" });
}

function initGitRepo(tmp) {
  git("init -q -b main", tmp);
  git('config user.email "test@example.com"', tmp);
  git('config user.name "Test"', tmp);
  fs.writeFileSync(path.join(tmp, "README.md"), "x\n");
  fs.writeFileSync(path.join(tmp, ".gitignore"), ".tmp/\n.sennel/.active-flow\n");
  git("add -A", tmp);
  git('commit -q -m "init"', tmp);
}

function setupSpecOnlyFlow(tmp) {
  initGitRepo(tmp);
  const flowManager = makeFlowManager(tmp);
  const state = new FlowAtStepFixture({
    flowManager,
    specId: "001-test",
    runId: "run-001-test",
    request: "spec-only finalization fixture",
    execution: { mode: "direct", baseBranch: "main", featureBranch: "main" },
    targetStep: "finalize-cleanup",
  }).create().state();
  git("add specs/001-test/001", tmp);
  git('commit -q -m "add spec fixture"', tmp);
  return state;
}

function runCli(args, tmp) {
  const result = spawnSync("node", [FLOW_CMD, "flow", ...args], {
    encoding: "utf8",
    env: { ...process.env, SENNEL_WORK_ROOT: tmp },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function runCliResult(args, tmp) {
  return spawnSync("node", [FLOW_CMD, "flow", ...args], {
    encoding: "utf8",
    env: { ...process.env, SENNEL_WORK_ROOT: tmp },
  });
}

function gitFile(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function setupConflictWorktree(root, origin) {
  gitFile(["init", "--quiet", "--initial-branch=main"], root);
  gitFile(["config", "user.email", "test@example.com"], root);
  gitFile(["config", "user.name", "Test User"], root);
  setupFlowConfig(root, "en");
  fs.writeFileSync(path.join(root, "conflict.txt"), "base\n");
  fs.writeFileSync(path.join(root, ".gitignore"), ".tmp/\n.sennel/.active-flow\n");
  gitFile(["add", "."], root);
  gitFile(["commit", "--quiet", "-m", "base"], root);
  gitFile(["init", "--quiet", "--bare", origin], root);
  gitFile(["remote", "add", "origin", origin], root);
  gitFile(["push", "--quiet", "-u", "origin", "main"], root);
  const worktree = path.join(root, ".sennel", "worktree", "feature-478");
  gitFile(["worktree", "add", "--quiet", "-b", "feature/478", worktree], root);
  fs.writeFileSync(path.join(worktree, "conflict.txt"), "feature\n");
  gitFile(["commit", "--all", "--quiet", "-m", "feature change"], worktree);
  fs.writeFileSync(path.join(root, "conflict.txt"), "main\n");
  gitFile(["commit", "--all", "--quiet", "-m", "main change"], root);
  gitFile(["push", "--quiet", "origin", "main"], root);

  const flowManager = makeFlowManager(root);
  const state = new FlowAtStepFixture({
    flowManager,
    specId: "478-test",
    runId: "run-478-e2e",
    request: "recover merge",
    issue: 478,
    issueSnapshot: "# Issue\nRecover merge\n",
    execution: { mode: "worktree", baseBranch: "main", featureBranch: "feature/478" },
    targetStep: "finalize-merge",
  }).create().state();
  const bindingPath = path.resolve(worktree, gitFile(["rev-parse", "--git-path", "info/exclude"], worktree).trim());
  fs.appendFileSync(bindingPath, "/.sennel/flow-identity.json\n");
  new WorktreeFlowBindingStore({ worktreePath: worktree }).save(new WorktreeFlowIdentity({
    runId: state.runId,
    issue: state.issue,
    specId: state.specId,
    worktreePath: worktree,
  }));
  return { worktree, state };
}

function sharedWorktreeManager(root, worktree, specId = "478-test") {
  return new FlowManager({
    root: worktree,
    mainRoot: root,
    inWorktree: true,
    specId,
  });
}

describe("flow run finalize-cleanup — self-contained envelope (spec 251)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("emits ok:true envelope with data.report=null + REPORT_MISSING warning when no report.json exists", () => {
    tmp = createTmpDir("sennel-finalize-e2e-");
    setupSpecOnlyFlow(tmp);

    const out = runCli(["run", "finalize-cleanup"], tmp);
    const env = JSON.parse(out);

    assert.equal(env.ok, true, "cleanup envelope must be ok:true even when report is missing");
    assert.equal(env.type, "run");
    assert.equal(env.key, "finalize-cleanup");
    assert.equal(env.data.report, null, "data.report must be null when report.json is missing");
    const warn = env.errors.find((e) => e.code === "REPORT_MISSING");
    assert.ok(warn, "errors must contain a REPORT_MISSING entry");
    assert.equal(warn.level, "warn");
  });

  it("writes .sennel/last-finalized-spec and clears .active-flow", () => {
    tmp = createTmpDir("sennel-finalize-e2e-pointer-");
    setupSpecOnlyFlow(tmp);

    runCli(["run", "finalize-cleanup"], tmp);

    const pointer = path.join(tmp, ".sennel", "last-finalized-spec");
    assert.ok(fs.existsSync(pointer), "last-finalized-spec pointer must be written");
    assert.equal(fs.readFileSync(pointer, "utf8").trim(), "001-test");

    const activeFlow = path.join(tmp, ".sennel", ".active-flow");
    if (fs.existsSync(activeFlow)) {
      const content = fs.readFileSync(activeFlow, "utf8").trim();
      assert.ok(
        content === "" || content === "[]" || !content.includes("001-test"),
        `.active-flow must not still reference the finalized spec (got: ${content})`,
      );
    }
  });

  it("flow get status returns active:false after cleanup (R17 post-cleanup inactive)", () => {
    tmp = createTmpDir("sennel-finalize-e2e-status-");
    setupSpecOnlyFlow(tmp);

    runCli(["run", "finalize-cleanup"], tmp);
    const out = runCli(["get", "status"], tmp);
    const env = JSON.parse(out);

    assert.equal(env.ok, true);
    assert.equal(env.data.active, false, "flow get status must report active:false post-cleanup");
  });

  it("completes cleanup with an explicit warning when docs sync previously failed", () => {
    tmp = createTmpDir("sennel-finalize-sync-warning-");
    setupSpecOnlyFlow(tmp);
    const flowManager = makeFlowManager(tmp);
    const state = flowManager.loadReadOnly("001-test");
    const outbox = new FlowOutboxStore(flowManager);
    const identity = finalizationOutboxIdentity(state, "finalize-sync");
    outbox.begin(identity);
    outbox.fail(identity, Object.assign(new Error("docs build failed"), { code: "FINALIZE_SYNC_FAILED" }));
    assert.equal(outbox.status(identity).status, "failed");

    const env = JSON.parse(runCli(["run", "finalize-cleanup"], tmp));

    assert.equal(env.ok, true);
    assert.equal(env.data.outcome, "completed_with_warnings", JSON.stringify(env));
    assert.equal(env.data.finalizeWarnings[0].code, "FINALIZE_SYNC_FAILED");
    assert.ok(env.errors.some((error) => error.code === "FINALIZE_SYNC_FAILED"));
  });
});

describe("flow run finalize-merge — shared CLI route (spec 478)", () => {
  let tmp;
  let origin;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    if (origin) removeTmpDir(origin);
  });

  it("executes the finalize-merge CLI route before the main-side cleanup route", () => {
    tmp = createTmpDir("sennel-finalize-merge-cli-");
    initGitRepo(tmp);
    new FlowAtStepFixture({
      flowManager: makeFlowManager(tmp),
      specId: "001-test",
      runId: "run-001-test",
      request: "finalize merge fixture",
      execution: { mode: "direct", baseBranch: "main", featureBranch: "main" },
      targetStep: "finalize-merge",
    }).create();

    const env = JSON.parse(runCli(["run", "finalize-merge"], tmp));
    assert.equal(env.ok, true);
    assert.equal(env.key, "finalize-merge");
    assert.equal(env.data.strategy, "skip");
  });

  it("requires rebase repair before granting a finalize-merge retry, then accepts it", () => {
    tmp = createTmpDir("sennel-finalize-merge-worktree-");
    origin = createTmpDir("sennel-finalize-merge-origin-");
    const { worktree } = setupConflictWorktree(tmp, origin);

    const failed = runCliResult(["run", "finalize-merge"], worktree);
    assert.notEqual(failed.status, 0, failed.stdout);
    assert.match(`${failed.stdout}\n${failed.stderr}`, /git rebase --continue/);
    assert.deepEqual(
      gitFile(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], tmp)
        .trim().split("\n").sort(),
      [
        "specs/478-test/001/activities.jsonl",
        "specs/478-test/001/artifact-catalog.json",
        "specs/478-test/001/flow.json",
        "specs/478-test/001/issue-log.json",
      ],
    );
    assert.equal(gitFile(["status", "--porcelain"], worktree).trim(), "");

    const failedManager = sharedWorktreeManager(tmp, worktree);
    const persistedEntry = new FlowOutboxStore(failedManager, { specId: "478-test" }).status(
      finalizationOutboxIdentity(failedManager.loadReadOnly("478-test"), "finalize-merge"),
    );
    assert.equal(persistedEntry.failureHistory.at(-1).code, "MERGE_PRE_SYNC_CONFLICT");
    assert.ok(persistedEntry.failureHistory.at(-1).recovery?.baseHead);

    const repair = runCliResult(["get", "next-action"], worktree);
    assert.equal(repair.status, 0, `${repair.stdout}\n${repair.stderr}`);
    const repairEnvelope = JSON.parse(repair.stdout);
    assert.equal(repairEnvelope.data.directive.kind, "repair_evidence");
    assert.equal(repairEnvelope.data.directive.actionId, "REPAIR_FINALIZE_MERGE_REBASE");
    const failedEntry = new FlowOutboxStore(failedManager, { specId: "478-test" }).status(
      finalizationOutboxIdentity(failedManager.loadReadOnly("478-test"), "finalize-merge"),
    );
    assert.equal(failedEntry.exactRecoveryReceipt, null, "failed canonical outbox has no mutable legacy receipt");

    assert.throws(() => gitFile(["rebase", "main"], worktree));
    fs.writeFileSync(path.join(worktree, "conflict.txt"), "resolved\n");
    gitFile(["add", "conflict.txt"], worktree);
    execFileSync("git", ["rebase", "--continue"], {
      cwd: worktree,
      encoding: "utf8",
      env: { ...process.env, GIT_EDITOR: "true" },
    });
    assert.equal(gitFile(["status", "--porcelain"], worktree).trim(), "");

    const recovery = runCliResult(["get", "next-action"], worktree);
    assert.equal(recovery.status, 0, `${recovery.stdout}\n${recovery.stderr}`);
    const recoveryEnvelope = JSON.parse(recovery.stdout);
    assert.equal(
      recoveryEnvelope.data.directive.kind,
      "execute_command",
      JSON.stringify(recoveryEnvelope, null, 2),
    );
    assert.equal(recoveryEnvelope.data.directive.actionId, "RECOVER_FINALIZE_MERGE_OUTBOX");
    const reopenedManager = sharedWorktreeManager(tmp, worktree);
    const reopenedEntry = new FlowOutboxStore(reopenedManager, { specId: "478-test" }).status(
      finalizationOutboxIdentity(reopenedManager.loadReadOnly("478-test"), "finalize-merge"),
    );
    assert.equal(reopenedEntry.status, "failed", "the read-only projection does not consume the retry");
    assert.equal(reopenedEntry.exactRecoveryReceipt, null);

    const consumed = runCliResult(["run", "recover-finalization"], worktree);
    assert.equal(consumed.status, 0, `${consumed.stdout}\n${consumed.stderr}`);
    const recoveredEntry = new FlowOutboxStore(reopenedManager, { specId: "478-test" }).status(
      finalizationOutboxIdentity(reopenedManager.loadReadOnly("478-test"), "finalize-merge"),
    );
    assert.equal(recoveredEntry.status, "pending");
    assert.ok(recoveredEntry.exactRecoveryReceipt, "the explicit command grants the exact retry");

    const retried = runCliResult(["run", "finalize-merge"], worktree);
    assert.equal(retried.status, 0, `${retried.stdout}\n${retried.stderr}`);
    const mainState = makeFlowManager(tmp).load("478-test");
    assert.equal(
      findStepById(mainState.steps, "finalize-merge").status,
      "done",
      `${retried.stdout}\n${retried.stderr}`,
    );
    assert.equal(findStepById(mainState.steps, "finalize-sync").status, "pending");
    const completedManager = sharedWorktreeManager(tmp, worktree);
    const completedEntry = new FlowOutboxStore(completedManager, { specId: "478-test" }).status(
      finalizationOutboxIdentity(completedManager.loadReadOnly("478-test"), "finalize-merge"),
    );
    assert.ok(completedEntry, "one canonical finalize-merge outbox identity remains queryable");
    assert.equal(completedEntry.status, "done");
  });
});
