/**
 * Spec 251 R8: end-to-end regression for finalize self-contained behavior.
 *
 * Runs the cleanup CLI against a minimal git repo, exercising the
 * spec-only branch (featureBranch === baseBranch) so we don't need a real
 * worktree to reach the cleanup envelope. The branch covers the new
 * envelope contract:
 *   - data.report is null when no report.json exists (and an errors entry
 *     with code REPORT_MISSING is attached at level 'warn', preserving ok:true)
 *   - .senti/last-finalized-spec is written
 *   - .senti/.active-flow is cleared
 *   - flow get status returns active:false post-cleanup (R17)
 *
 * The full worktree path (commit → merge → sync → cleanup with squash) is
 * exercised at the registry-hook level by tests/unit/flow/finalize-merge-retry
 * and the registry hooks themselves; orchestrating real git worktree state
 * here would balloon the test without adding contract coverage beyond what
 * the unit and post-hook tests already provide.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import {
  makeFlowState,
  makeFlowManager,
  replaceFlowState,
  setupFlow,
  setupFlowConfig,
} from "../../../helpers/flow-setup.js";
import { findStepById, flattenSteps } from "../../../../src/flow/lib/step-tree.js";
import { FlowOutbox, finalizationOutboxIdentity } from "../../../../src/flow/lib/flow-outbox.js";
import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from "../../../../src/lib/worktree-flow-binding.js";
import { FlowManager } from "../../../../src/lib/flow-manager.js";

const FLOW_CMD = path.join(process.cwd(), "src/senti.js");

function git(args, cwd) {
  return execSync(`git ${args}`, { cwd, encoding: "utf8" });
}

function initGitRepo(tmp) {
  git("init -q -b main", tmp);
  git('config user.email "test@example.com"', tmp);
  git('config user.name "Test"', tmp);
  fs.writeFileSync(path.join(tmp, "README.md"), "x\n");
  fs.writeFileSync(path.join(tmp, ".gitignore"), ".tmp/\n.senti/.active-flow\n");
  git("add -A", tmp);
  git('commit -q -m "init"', tmp);
}

function setupSpecOnlyFlow(tmp) {
  initGitRepo(tmp);
  const state = makeFlowState({
    specId: "001-test",
    runId: "run-001-test",
    baseBranch: "main",
    featureBranch: "main", // spec-only mode
  });
  // Mark all leaves up to finalize-cleanup as done; cleanup is in_progress.
  for (const s of state.steps) {
    if (Array.isArray(s.children)) {
      for (const c of s.children) {
        if (c.id === "finalize") {
          for (const leaf of c.children || []) {
            leaf.status = leaf.id === "finalize-cleanup" ? "in_progress" : "done";
          }
          c.status = "in_progress";
        } else {
          c.status = "done";
        }
      }
      s.status = s.id === "impl" ? "in_progress" : "done";
    } else if (s.status !== "in_progress") {
      s.status = "done";
    }
  }
  // Persist a minimal spec.json so resolve-context can read it without crashing.
  const specDir = path.join(tmp, "specs", "001-test");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({ goal: "x", scope: { in: [], out: [] }, requirements: [] }) + "\n");
  fs.writeFileSync(path.join(specDir, "spec.md"), "# spec\n## Goal\nx\n## Scope\n");
  makeFlowManager(tmp).create(state);
  makeFlowManager(tmp).addActiveFlow("001-test", "local");
  git("add specs/001-test", tmp);
  git('commit -q -m "add spec fixture"', tmp);
}

function runCli(args, tmp) {
  const result = spawnSync("node", [FLOW_CMD, "flow", ...args], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

function runCliResult(args, tmp) {
  return spawnSync("node", [FLOW_CMD, "flow", ...args], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
}

function gitFile(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function activateFinalizeMerge(state) {
  let active = false;
  for (const step of flattenSteps(state.steps)) {
    if (step.id === "finalize-merge") {
      step.status = "in_progress";
      active = true;
    } else {
      step.status = active ? "pending" : "done";
    }
  }
  return state;
}

function setupConflictWorktree(root, origin) {
  gitFile(["init", "--quiet", "--initial-branch=main"], root);
  gitFile(["config", "user.email", "test@example.com"], root);
  gitFile(["config", "user.name", "Test User"], root);
  setupFlowConfig(root, "en");
  fs.writeFileSync(path.join(root, "conflict.txt"), "base\n");
  fs.writeFileSync(path.join(root, ".gitignore"), ".tmp/\n.senti/.active-flow\n");
  gitFile(["add", "."], root);
  gitFile(["commit", "--quiet", "-m", "base"], root);
  gitFile(["init", "--quiet", "--bare", origin], root);
  gitFile(["remote", "add", "origin", origin], root);
  gitFile(["push", "--quiet", "-u", "origin", "main"], root);
  const worktree = path.join(root, ".senti", "worktree", "feature-478");
  gitFile(["worktree", "add", "--quiet", "-b", "feature/478", worktree], root);
  fs.writeFileSync(path.join(worktree, "conflict.txt"), "feature\n");
  gitFile(["commit", "--all", "--quiet", "-m", "feature change"], worktree);
  fs.writeFileSync(path.join(root, "conflict.txt"), "main\n");
  gitFile(["commit", "--all", "--quiet", "-m", "main change"], root);
  gitFile(["push", "--quiet", "origin", "main"], root);

  const state = activateFinalizeMerge(makeFlowState({
    specId: "478-test",
    runId: "run-478-e2e",
    baseBranch: "main",
    featureBranch: "feature/478",
    worktree: true,
    issue: 478,
    nonblocking: {
      enabled: true,
      activatedAt: "2026-07-28T00:00:00.000Z",
      activatedStep: "impl-review",
      reason: "Acceptance-backed quality handling was selected earlier in this Flow.",
    },
  }));
  const specDir = path.join(root, "specs", "478-test");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({ goal: "recover merge", scope: { in: [], out: [] }, requirements: [] }) + "\n");
  fs.writeFileSync(path.join(specDir, "spec.md"), "# spec\n## Goal\nrecover merge\n## Scope\n");
  setupFlow(root, state);
  const bindingPath = path.resolve(worktree, gitFile(["rev-parse", "--git-path", "info/exclude"], worktree).trim());
  fs.appendFileSync(bindingPath, "/.senti/flow-identity.json\n");
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
    tmp = createTmpDir("senti-finalize-e2e-");
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

  it("writes .senti/last-finalized-spec and clears .active-flow", () => {
    tmp = createTmpDir("senti-finalize-e2e-pointer-");
    setupSpecOnlyFlow(tmp);

    runCli(["run", "finalize-cleanup"], tmp);

    const pointer = path.join(tmp, ".senti", "last-finalized-spec");
    assert.ok(fs.existsSync(pointer), "last-finalized-spec pointer must be written");
    assert.equal(fs.readFileSync(pointer, "utf8").trim(), "001-test");

    const activeFlow = path.join(tmp, ".senti", ".active-flow");
    if (fs.existsSync(activeFlow)) {
      const content = fs.readFileSync(activeFlow, "utf8").trim();
      assert.ok(
        content === "" || content === "[]" || !content.includes("001-test"),
        `.active-flow must not still reference the finalized spec (got: ${content})`,
      );
    }
  });

  it("flow get status returns active:false after cleanup (R17 post-cleanup inactive)", () => {
    tmp = createTmpDir("senti-finalize-e2e-status-");
    setupSpecOnlyFlow(tmp);

    runCli(["run", "finalize-cleanup"], tmp);
    const out = runCli(["get", "status"], tmp);
    const env = JSON.parse(out);

    assert.equal(env.ok, true);
    assert.equal(env.data.active, false, "flow get status must report active:false post-cleanup");
  });

  it("completes cleanup with an explicit warning when docs sync previously failed", () => {
    tmp = createTmpDir("senti-finalize-sync-warning-");
    setupSpecOnlyFlow(tmp);
    const flowManager = makeFlowManager(tmp);
    flowManager.mutate((state) => {
      findStepById(state.steps, "finalize-sync").status = "skipped";
      const identity = finalizationOutboxIdentity(state, "finalize-sync");
      const outbox = new FlowOutbox(state.outbox || []);
      outbox.begin(identity);
      outbox.fail(identity, Object.assign(new Error("docs build failed"), { code: "FINALIZE_SYNC_FAILED" }));
      state.outbox = outbox.toJSON();
    });
    assert.equal(flowManager.load().outbox.find((entry) => entry.stepId === "finalize-sync").status, "failed");

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
    tmp = createTmpDir("senti-finalize-merge-cli-");
    setupSpecOnlyFlow(tmp);
    const state = makeFlowManager(tmp).load();
    for (const step of state.steps) {
      for (const child of step.children || []) {
        for (const leaf of child.children || []) {
          if (leaf.id === "finalize-merge") leaf.status = "in_progress";
          if (leaf.id === "finalize-cleanup") leaf.status = "pending";
        }
      }
    }
    makeFlowManager(tmp).mutate((flow) => Object.assign(flow, state));

    const env = JSON.parse(runCli(["run", "finalize-merge"], tmp));
    assert.equal(env.ok, true);
    assert.equal(env.key, "finalize-merge");
    assert.equal(env.data.strategy, "skip");
  });

  it("requires rebase repair before granting a finalize-merge retry, then accepts it", () => {
    tmp = createTmpDir("senti-finalize-merge-worktree-");
    origin = createTmpDir("senti-finalize-merge-origin-");
    const { worktree } = setupConflictWorktree(tmp, origin);

    const failed = runCliResult(["run", "finalize-merge"], worktree);
    assert.notEqual(failed.status, 0, failed.stdout);
    assert.match(`${failed.stdout}\n${failed.stderr}`, /git rebase --continue/);
    assert.deepEqual(
      gitFile(["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"], tmp)
        .trim().split("\n").sort(),
      ["specs/478-test/flow.json", "specs/478-test/issue-log.json"],
    );
    assert.equal(gitFile(["status", "--porcelain"], worktree).trim(), "");

    const persistedEntry = sharedWorktreeManager(tmp, worktree).load().outbox
      .find((entry) => entry.stepId === "finalize-merge");
    assert.equal(persistedEntry.failureHistory.at(-1).code, "MERGE_PRE_SYNC_CONFLICT");
    assert.ok(persistedEntry.failureHistory.at(-1).recovery?.baseHead);

    // A Flow paused by the previous implementation has only the prose
    // failure and an already-consumed generic exact-recovery receipt. Keep
    // this fixture so upgrades recover a live stranded Flow, not only new
    // failures written by the revised CLI.
    sharedWorktreeManager(tmp, worktree).mutate((flow) => {
      const entry = flow.outbox.find((candidate) => candidate.stepId === "finalize-merge");
      const failure = entry.failureHistory.at(-1);
      delete failure.code;
      delete failure.recovery;
      entry.exactRecoveryReceipt = {
        idempotencyKey: entry.idempotencyKey,
        attempt: entry.attempt,
        failure: entry.failure,
      };
    });
    gitFile(["add", "specs/478-test/flow.json"], tmp);
    gitFile(["commit", "--quiet", "-m", "test: retain finalize recovery fixture"], tmp);

    const repair = runCliResult(["get", "next-action"], worktree);
    assert.equal(repair.status, 0, `${repair.stdout}\n${repair.stderr}`);
    const repairEnvelope = JSON.parse(repair.stdout);
    assert.equal(repairEnvelope.data.directive.kind, "repair_evidence");
    assert.equal(repairEnvelope.data.directive.actionId, "REPAIR_FINALIZE_MERGE_REBASE");
    const failedEntry = sharedWorktreeManager(tmp, worktree).load().outbox
      .find((entry) => entry.stepId === "finalize-merge");
    assert.equal(failedEntry.exactRecoveryReceipt.recoveryKey, undefined, "legacy retry receipt remains unaltered before rebase repair");

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
    const reopenedEntry = sharedWorktreeManager(tmp, worktree).load().outbox
      .find((entry) => entry.stepId === "finalize-merge");
    assert.ok(reopenedEntry.exactRecoveryReceipt, "resolved rebase grants the exact retry");

    const retried = runCliResult(["run", "finalize-merge"], worktree);
    assert.equal(retried.status, 0, `${retried.stdout}\n${retried.stderr}`);
    const mainState = makeFlowManager(tmp).load("478-test");
    assert.equal(
      findStepById(mainState.steps, "finalize-merge").status,
      "done",
      `${retried.stdout}\n${retried.stderr}`,
    );
    assert.equal(findStepById(mainState.steps, "finalize-sync").status, "pending");
    assert.equal(mainState.outbox.filter((entry) => entry.stepId === "finalize-merge").length, 1);
    assert.equal(mainState.outbox.find((entry) => entry.stepId === "finalize-merge").status, "done");
  });
});
