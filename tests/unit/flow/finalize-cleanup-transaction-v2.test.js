import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowManager, replaceFlowState, setupFlow } from "../../helpers/flow-setup.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  FinalizeBeforeImageRestorePolicy,
  RunFinalizeCleanupCommand,
  deleteFeatureBranchForCleanup,
} from "../../../src/flow/lib/run-finalize-cleanup.js";
import { ProcessOwnedLock } from "../../../src/lib/process-owned-lock.js";
import { AtomicJsonFile } from "../../../src/lib/atomic-json-file.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import {
  RepositoryFlowOperationLock,
  RepositoryMaintenanceLock,
} from "../../../src/lib/repository-maintenance-lock.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { collectFlowLeafIds, getFlowNode } from "../../../src/flow/definition.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

const finalizeModule = path.resolve("src/flow/lib/run-finalize-cleanup.js");
const flowManagerModule = path.resolve("src/lib/flow-manager.js");
const atomicJsonModule = path.resolve("src/lib/atomic-json-file.js");
const sentiCli = path.resolve("src/senti.js");

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

test("before-image policy reserves shared flow and issue authorities for their CAS writers", () => {
  const policy = new FinalizeBeforeImageRestorePolicy("specs/441");
  assert.equal(policy.usesSharedWriter("specs/441/flow.json"), true);
  assert.equal(policy.usesSharedWriter("specs/441/issue-log.json"), true);
  assert.equal(policy.allowsRawByteRestore("specs/441/plugin-artifacts/result.json"), true);
  assert.equal(policy.allowsRawByteRestore("specs/441/plugin-artifacts/flow.json"), true);
  assert.equal(policy.allowsRawByteRestore("specs/441/plugin-artifacts/issue-log.json"), true);
  assert.equal(policy.allowsRawByteRestore("specs/441/flow.json"), false);
});

test("flow state writers borrow finalize repository authority and reject foreign mutation", () => {
  const root = createTmpDir("finalize-flow-writer-barrier-");
  try {
    initGitRepo(root);
    const specId = "441";
    setupFinalizeFlow(root, specId);
    const manager = makeFlowManager(root);
    const repository = new RepositoryFlowOperationLock({ mainRoot: root });
    const ownerToken = repository.acquire();
    assert.throws(
      () => manager.updateStepStatus("finalize-cleanup", "done", { specId }),
      (error) => error.code === "REPOSITORY_FLOW_OPERATION_BUSY",
    );
    manager.updateStepStatus("finalize-cleanup", "done", { specId, operationOwnerToken: ownerToken });
    repository.release();
    assert.equal(findStepById(manager.loadReadOnly(specId).steps, "finalize-cleanup").status, "done");
  } finally {
    removeTmpDir(root);
  }
});

function initGitRepo(root) {
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  fs.writeFileSync(path.join(root, "README.md"), "# fixture\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "--quiet", "-m", "initial"]);
}

function setupFinalizeFlow(root, specId, overrides = {}) {
  const spec = `specs/${specId}/spec.json`;
  const featureBranch = `feature/${specId}`;
  const state = setupFlow(root, {
    spec,
    runId: `run-${specId}`,
    baseBranch: "master",
    featureBranch,
    worktree: false,
    ...overrides,
  });
  state.state = { mergeStrategy: "pr" };
  replaceFlowState(root, state, { specId });
  git(root, ["add", `specs/${specId}/flow.json`]);
  git(root, ["commit", "--quiet", "-m", "add flow"]);
  git(root, ["branch", featureBranch]);
  makeFlowManager(root).addActiveFlow(specId, "branch");
  return { state, spec, featureBranch };
}

function finalizeChild(root, specId, options = {}) {
  const script = `
    import { RunFinalizeCleanupCommand } from ${JSON.stringify(pathToFileURL(finalizeModule).href)};
    import { FlowManager } from ${JSON.stringify(pathToFileURL(flowManagerModule).href)};
    const root = ${JSON.stringify(root)};
    const specId = ${JSON.stringify(specId)};
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
    const flowState = flowManager.loadReadOnly(specId);
    const result = await new RunFinalizeCleanupCommand().execute({
      root,
      flowManager,
      flowState,
      autoRescue: false,
      force: ${options.force === true},
    });
    process.stdout.write(JSON.stringify(result.toJSON ? result.toJSON() : result));
  `;
  return spawn(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function crashFinalizeBeforeIndexRename(root, specId) {
  const script = `
    import fs from "node:fs";
    import path from "node:path";
    import { RunFinalizeCleanupCommand } from ${JSON.stringify(pathToFileURL(finalizeModule).href)};
    import { FlowManager } from ${JSON.stringify(pathToFileURL(flowManagerModule).href)};
    const root = ${JSON.stringify(root)};
    const indexPath = path.join(root, ".git", "index");
    const originalRename = fs.renameSync;
    fs.renameSync = (source, target) => {
      if (path.basename(source).startsWith("publication-") && target === indexPath) {
        process.kill(process.pid, "SIGKILL");
      }
      return originalRename(source, target);
    };
    const specId = ${JSON.stringify(specId)};
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
    await new RunFinalizeCleanupCommand().execute({
      root,
      flowManager,
      flowState: flowManager.loadReadOnly(specId),
      autoRescue: false,
      force: false,
    });
  `;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    encoding: "utf8",
  });
}

function crashFinalizeAfterPlannedPublicationSourceFsync(root, specId) {
  const script = `
    import fs from "node:fs";
    import { AtomicJsonFile } from ${JSON.stringify(pathToFileURL(atomicJsonModule).href)};
    import { RunFinalizeCleanupCommand } from ${JSON.stringify(pathToFileURL(finalizeModule).href)};
    import { FlowManager } from ${JSON.stringify(pathToFileURL(flowManagerModule).href)};
    let publicationWorkspace = null;
    const originalWrite = AtomicJsonFile.prototype.write;
    AtomicJsonFile.prototype.write = function observePublicationPlan(value) {
      const result = originalWrite.call(this, value);
      if (value?.indexLockAuthority?.publishPhase === "planned") {
        publicationWorkspace = value.tempIndexAuthority.workspacePath;
      }
      return result;
    };
    const originalFsync = fs.fsyncSync;
    fs.fsyncSync = (descriptor) => {
      originalFsync(descriptor);
      if (publicationWorkspace == null) return;
      let openedPath = "";
      try { openedPath = fs.readlinkSync(\`/proc/self/fd/\${descriptor}\`); } catch {}
      if (openedPath === publicationWorkspace) {
        process.kill(process.pid, "SIGKILL");
      }
    };
    const root = ${JSON.stringify(root)};
    const specId = ${JSON.stringify(specId)};
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
    await new RunFinalizeCleanupCommand().execute({
      root,
      flowManager,
      flowState: flowManager.loadReadOnly(specId),
      autoRescue: false,
      force: false,
    });
  `;
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    encoding: "utf8",
  });
}

function finalizeChildBlockedAfterPublicationPlan(root, specId, reachedPath, blockerPath) {
  const script = `
    import fs from "node:fs";
    import { AtomicJsonFile } from ${JSON.stringify(pathToFileURL(atomicJsonModule).href)};
    import { RunFinalizeCleanupCommand } from ${JSON.stringify(pathToFileURL(finalizeModule).href)};
    import { FlowManager } from ${JSON.stringify(pathToFileURL(flowManagerModule).href)};
    const originalWrite = AtomicJsonFile.prototype.write;
    let blocked = false;
    AtomicJsonFile.prototype.write = function blockAfterPublicationPlan(value) {
      const result = originalWrite.call(this, value);
      if (!blocked && value?.indexLockAuthority?.publishPhase === "planned") {
        blocked = true;
        fs.writeFileSync(${JSON.stringify(reachedPath)}, "reached\\n");
        const wait = new Int32Array(new SharedArrayBuffer(4));
        while (fs.existsSync(${JSON.stringify(blockerPath)})) Atomics.wait(wait, 0, 0, 20);
      }
      return result;
    };
    const root = ${JSON.stringify(root)};
    const specId = ${JSON.stringify(specId)};
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
    const result = await new RunFinalizeCleanupCommand().execute({
      root,
      flowManager,
      flowState: flowManager.loadReadOnly(specId),
      autoRescue: false,
      force: false,
    });
    process.stdout.write(JSON.stringify(result.toJSON ? result.toJSON() : result));
  `;
  return spawn(process.execPath, ["--input-type=module", "-e", script], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForFile(filePath, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${filePath}`);
}

async function waitForExit(child) {
  return new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
}

async function childResult(child) {
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exit = await waitForExit(child);
  return { ...exit, stdout, stderr };
}

function recoveryJournal(root) {
  const directory = path.join(root, ".senti", "recovery", "finalize-cleanup");
  const entries = fs.readdirSync(directory).filter((entry) => entry.endsWith(".json"));
  assert.equal(entries.length, 1);
  return path.join(directory, entries[0]);
}

function recoveryJournals(root) {
  const directory = path.join(root, ".senti", "recovery", "finalize-cleanup");
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(directory, entry));
}

function specTreeSnapshot(root, specId) {
  const specRoot = path.join(root, "specs", specId);
  const entries = [];
  const visit = (directory) => {
    const stat = fs.statSync(directory);
    entries.push({ path: path.relative(specRoot, directory), directory: true, mode: stat.mode & 0o777 });
    for (const name of fs.readdirSync(directory).sort()) {
      const target = path.join(directory, name);
      const targetStat = fs.statSync(target);
      if (targetStat.isDirectory()) visit(target);
      else entries.push({
        path: path.relative(specRoot, target),
        directory: false,
        mode: targetStat.mode & 0o777,
        bytes: fs.readFileSync(target).toString("base64"),
      });
    }
  };
  visit(specRoot);
  return entries;
}

function preCommitSnapshot(root, specId) {
  return {
    head: git(root, ["rev-parse", "HEAD"]),
    index: fs.readFileSync(path.join(root, ".git", "index")),
    specTree: specTreeSnapshot(root, specId),
  };
}

function assertPreCommitSnapshot(root, specId, expected) {
  assert.equal(git(root, ["rev-parse", "HEAD"]), expected.head);
  assert.deepEqual(fs.readFileSync(path.join(root, ".git", "index")), expected.index);
  assert.deepEqual(specTreeSnapshot(root, specId), expected.specTree);
}

function assertCompletedJournal(root) {
  const journalPath = recoveryJournal(root);
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  assert.equal(journal.phase, "completed");
  assert.equal(journal.result.phase, "completed");
  assert.equal(journal.result.ok, true);
  return journalPath;
}

async function runFinalize(root, specId, { flowManager = makeFlowManager(root), flowState = null, force = false } = {}) {
  return new RunFinalizeCleanupCommand().execute({
    root: flowManager._root,
    mainRoot: root,
    flowManager,
    flowState: flowState || flowManager.loadReadOnly(specId),
    autoRescue: false,
    force,
  });
}

async function seedPointerFailure(root, specId, { mergeStrategy = "pr", force = false } = {}) {
  const fixture = setupFinalizeFlow(root, specId);
  if (mergeStrategy === "squash") {
    fixture.state.state = {
      mergeStrategy,
      featureBranchSquashedSha: git(root, ["rev-parse", fixture.featureBranch]),
    };
    replaceFlowState(root, fixture.state, { specId });
    git(root, ["add", `specs/${specId}/flow.json`]);
    git(root, ["commit", "--quiet", "-m", "record squash route"]);
  }
  const pointerPath = path.join(root, ".senti", "last-finalized-spec");
  fs.mkdirSync(pointerPath);
  const failed = await runFinalize(root, specId, { flowState: fixture.state, force });
  assert.equal(failed.ok, false);
  assert.equal(failed.errors[0].code, "FINALIZE_POINTER_WRITE_FAILED");
  assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "validated");
  assert.equal(git(root, ["branch", "--list", fixture.featureBranch]), "");
  return { ...fixture, pointerPath };
}

function setupWorktreeFinalizeFlow(root, specId, overrides = {}) {
  const spec = `specs/${specId}/spec.json`;
  const featureBranch = `feature/${specId}`;
  const worktreePath = path.join(root, ".senti", "worktree", specId);
  const state = setupFlow(root, {
    spec,
    runId: `run-${specId}`,
    baseBranch: "master",
    featureBranch,
    worktree: true,
    ...overrides,
  });
  state.state = { mergeStrategy: "pr" };
  replaceFlowState(root, state, { specId });
  const mainFlowManager = makeFlowManager(root);
  mainFlowManager.addActiveFlow(specId, "worktree");
  git(root, ["add", `specs/${specId}/flow.json`]);
  git(root, ["commit", "--quiet", "-m", "add worktree flow"]);
  git(root, ["worktree", "add", "-b", featureBranch, worktreePath]);
  const flowManager = new FlowManager({
    root: worktreePath,
    mainRoot: root,
    inWorktree: true,
    specId,
  });
  return { spec, featureBranch, worktreePath, state: flowManager.loadReadOnly(specId), flowManager };
}

function markFinalizeCleanupReady(state) {
  for (const step of flattenSteps(state.steps || [])) {
    step.status = step.id === "finalize-cleanup" ? "in_progress" : "done";
  }
  return state;
}

function markFinalizeCommitReady(state) {
  let reachedFinalizeCommit = false;
  for (const step of flattenSteps(state.steps || [])) {
    if (step.id === "finalize-commit") {
      step.status = "in_progress";
      reachedFinalizeCommit = true;
    } else {
      step.status = reachedFinalizeCommit ? "pending" : "done";
    }
  }
  return state;
}

test("finalize-cleanup is registered as the executable final flow leaf", () => {
  const node = getFlowNode("finalize-cleanup");
  assert.ok(node);
  assert.equal(node.action, "run-finalize-cleanup");
  assert.equal(collectFlowLeafIds().at(-1), "finalize-cleanup");
  assert.equal(FLOW_COMMANDS.run["finalize-cleanup"].explicitTargetResolution, true);
  assert.equal(typeof FLOW_COMMANDS.run["finalize-cleanup"].command, "function");
});

function removeFinalizeCleanupStep(state) {
  const finalize = findStepById(state.steps || [], "finalize");
  assert.ok(finalize && Array.isArray(finalize.children));
  finalize.children = finalize.children.filter((step) => step.id !== "finalize-cleanup");
  return state;
}

test("finalize lifecycle advances commit, merge, sync, and cleanup through their registered hooks", async () => {
  const root = createTmpDir("finalize-registered-lifecycle-");
  try {
    initGitRepo(root);
    const specId = "134";
    const fixture = setupWorktreeFinalizeFlow(root, specId);
    markFinalizeCommitReady(fixture.state);
    replaceFlowState(fixture.worktreePath, fixture.state, { specId });
    fs.writeFileSync(path.join(fixture.worktreePath, fixture.spec), "{}\n");
    const ctx = {
      root: fixture.worktreePath,
      mainRoot: root,
      flowManager: fixture.flowManager,
      flowState: fixture.flowManager.loadReadOnly(specId),
      specId,
    };

    await FLOW_COMMANDS.run["finalize-commit"].pre(ctx);
    await FLOW_COMMANDS.run["finalize-commit"].post(ctx, { status: "done" });
    const afterCommit = fixture.flowManager.loadReadOnly(specId);
    assert.equal(findStepById(afterCommit.steps, "finalize-commit").status, "done");
    assert.equal(findStepById(afterCommit.steps, "finalize-merge").status, "in_progress");
    git(fixture.worktreePath, ["add", `specs/${specId}/flow.json`, fixture.spec]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "record finalize commit lifecycle"]);

    ctx.flowState = afterCommit;
    await FLOW_COMMANDS.run["finalize-merge"].pre(ctx);
    await FLOW_COMMANDS.run["finalize-merge"].post(ctx, {
      status: "done",
      strategy: "pr",
      mergedFromSha: null,
    });
    let mainState = ctx.flowManager.loadReadOnly(specId);
    assert.equal(findStepById(mainState.steps, "finalize-merge").status, "done");
    assert.equal(findStepById(mainState.steps, "finalize-sync").status, "in_progress");
    git(fixture.worktreePath, ["add", `specs/${specId}/flow.json`]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "record finalize merge lifecycle"]);
    replaceFlowState(root, mainState, { specId });
    git(root, ["add", `specs/${specId}/flow.json`]);
    git(root, ["commit", "--quiet", "-m", "simulate finalize merge snapshot"]);

    ctx.flowState = mainState;
    await FLOW_COMMANDS.run["finalize-sync"].pre(ctx);
    await FLOW_COMMANDS.run["finalize-sync"].post(ctx, { status: "done" });
    mainState = ctx.flowManager.loadReadOnly(specId);
    assert.equal(findStepById(mainState.steps, "finalize-sync").status, "done");
    assert.equal(findStepById(mainState.steps, "finalize-cleanup").status, "in_progress");
    fs.writeFileSync(
      path.join(root, "specs", specId, "report.json"),
      `${JSON.stringify({ text: "Finalize lifecycle report" }, null, 2)}\n`,
    );
    git(root, ["add", `specs/${specId}/flow.json`, `specs/${specId}/report.json`]);
    git(root, ["commit", "--quiet", "-m", "record finalize lifecycle state"]);

    const completed = await runFinalize(root, specId, {
      flowManager: fixture.flowManager,
      flowState: afterCommit,
    });
    assert.equal(completed.ok, true, JSON.stringify(completed));
    assert.equal(completed.data.report.text, "Finalize lifecycle report");
    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(git(root, ["branch", "--list", fixture.featureBranch]), "");
    const committed = JSON.parse(git(root, ["show", `HEAD:specs/${specId}/flow.json`]));
    assert.equal(findStepById(committed.steps, "finalize-cleanup").status, "done");
  } finally {
    removeTmpDir(root);
  }
});

test("flow state validation rejects a missing main cleanup leaf before teardown", () => {
  const root = createTmpDir("finalize-state-reconciliation-");
  try {
    initGitRepo(root);
    const specId = "135";
    const fixture = setupWorktreeFinalizeFlow(root, specId, {
      runId: "13584b21-273e-41e9-8828-c534482cdaf9",
      issue: 48,
    });
    markFinalizeCleanupReady(fixture.state);
    replaceFlowState(fixture.worktreePath, fixture.state, { specId });
    git(fixture.worktreePath, ["add", `specs/${specId}/flow.json`]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "prepare cleanup state"]);

    const mainState = structuredClone(fixture.state);
    removeFinalizeCleanupStep(mainState);
    fs.writeFileSync(
      path.join(root, "specs", specId, "flow.json"),
      `${JSON.stringify(mainState, null, 2)}\n`,
    );
    git(root, ["add", `specs/${specId}/flow.json`]);
    git(root, ["commit", "--quiet", "-m", "simulate merged cleanup state drift"]);
    const head = git(root, ["rev-parse", "HEAD"]);

    assert.throws(
      () => makeFlowManager(root).loadReadOnly(specId),
      (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED"
        && /does not match the flow definition/.test(error.message),
    );
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.notEqual(git(root, ["branch", "--list", fixture.featureBranch]), "");
    assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), true);
    assert.equal(git(root, ["rev-parse", "HEAD"]), head);
  } finally {
    removeTmpDir(root);
  }
});

test("guard-targeted cleanup resumes from main after worktree removal without reviving the deleted path", async () => {
  const root = createTmpDir("finalize-deleted-worktree-resume-");
  try {
    initGitRepo(root);
    const specId = "191";
    const runId = "fda30a2e-6498-4027-bab0-6ce91f58ed8e";
    const issue = 191;
    const pluginId = "finalize-resume";
    const pluginRoot = path.join(root, ".senti", "plugins", pluginId);
    fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
    fs.writeFileSync(path.join(root, ".senti", "config.json"), `${JSON.stringify({
      plugin: { packages: [{ id: pluginId }] },
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(pluginRoot, "hooks", "finalize.js"), `
      export default function register(api) {
        return class FinalizeResumeHook extends api.FlowCommandHook {
          static command = "finalize-cleanup";
          static hook = "post";
          async run(context) {
            return context.envelope.ok("plugin-hook", "finalize-cleanup", {});
          }
        };
      }
    `);
    const readyState = markFinalizeCleanupReady({ steps: buildInitialSteps() });
    const fixture = setupWorktreeFinalizeFlow(root, specId, {
      runId,
      issue,
      steps: readyState.steps,
      plugins: { flowCommandHooks: [{
        apiVersion: 1,
        pluginId,
        module: "hooks/finalize.js",
        className: "FinalizeResumeHook",
        command: "finalize-cleanup",
        hook: "post",
        priority: 0,
      }] },
    });
    const pointerPath = path.join(root, ".senti", "last-finalized-spec");
    fs.mkdirSync(pointerPath);

    const interrupted = await runFinalize(root, specId, {
      flowManager: fixture.flowManager,
      flowState: fixture.state,
    });

    assert.equal(interrupted.ok, false, JSON.stringify(interrupted));
    assert.equal(interrupted.errors[0].code, "FINALIZE_POINTER_WRITE_FAILED");
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "validated");
    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(git(root, ["branch", "--list", fixture.featureBranch]), "");
    assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), true);

    const statusBeforeResume = spawnSync(process.execPath, [sentiCli, "flow", "get", "status"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: root },
    });
    assert.equal(statusBeforeResume.status, 0, statusBeforeResume.stderr);
    assert.equal(JSON.parse(statusBeforeResume.stdout).data.active, true);

    const nextAction = spawnSync(process.execPath, [sentiCli, "flow", "get", "next-action"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: root },
    });
    assert.equal(nextAction.status, 0, nextAction.stderr);
    assert.equal(JSON.parse(nextAction.stdout).data.action, "run-finalize-cleanup");
    assert.equal(JSON.parse(nextAction.stdout).data.step, "finalize-cleanup");
    const stateAfterNextAction = makeFlowManager(root).loadReadOnly(specId);
    assert.equal(stateAfterNextAction.currentTaskId, null);
    assert.equal(stateAfterNextAction.tasks[0].steps[0].status, "pending");
    assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), true, "recovery authority remains until cleanup resumes");

    fs.rmdirSync(pointerPath);
    const resumed = spawnSync(process.execPath, [
      sentiCli,
      "flow",
      "run",
      "finalize-cleanup",
      "--expect-run-id",
      runId,
      "--expect-issue",
      String(issue),
      "--expect-spec",
      fixture.spec,
    ], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: root },
    });

    assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
    const envelope = JSON.parse(resumed.stdout);
    assert.equal(envelope.ok, true, resumed.stdout);
    assert.equal(envelope.data.status, "done");
    assert.equal(fs.existsSync(fixture.worktreePath), false, "deleted worktree path must not be recreated");
    assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), false);
    assert.equal(fs.readFileSync(pointerPath, "utf8").trim(), fixture.spec);
    assert.equal(git(root, ["status", "--porcelain", "--", `specs/${specId}`]), "");
  } finally {
    removeTmpDir(root);
  }
});

test("cleanup rejects a different main runId before any teardown side effect", async () => {
  const root = createTmpDir("finalize-state-runid-mismatch-");
  try {
    initGitRepo(root);
    const specId = "136";
    const fixture = setupWorktreeFinalizeFlow(root, specId, { issue: 48 });
    const mainManager = makeFlowManager(root);
    const mainState = mainManager.loadReadOnly(specId);
    mainState.runId = "different-main-run";
    fs.writeFileSync(
      path.join(root, "specs", specId, "flow.json"),
      `${JSON.stringify(mainState, null, 2)}\n`,
    );
    git(root, ["add", `specs/${specId}/flow.json`]);
    git(root, ["commit", "--quiet", "-m", "simulate different main run"]);
    const before = {
      head: git(root, ["rev-parse", "HEAD"]),
      mainFlow: fs.readFileSync(path.join(root, "specs", specId, "flow.json")),
      activeFlow: fs.readFileSync(path.join(root, ".senti", ".active-flow")),
      feature: git(root, ["rev-parse", fixture.featureBranch]),
    };

    const result = await runFinalize(root, specId, {
      flowManager: fixture.flowManager,
      flowState: fixture.state,
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FINALIZE_FLOW_STATE_MISMATCH");
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.equal(git(root, ["rev-parse", fixture.featureBranch]), before.feature);
    assert.equal(git(root, ["rev-parse", "HEAD"]), before.head);
    assert.deepEqual(fs.readFileSync(path.join(root, "specs", specId, "flow.json")), before.mainFlow);
    assert.deepEqual(fs.readFileSync(path.join(root, ".senti", ".active-flow")), before.activeFlow);
    assert.deepEqual(recoveryJournals(root), []);
  } finally {
    removeTmpDir(root);
  }
});

test("flow state validation rejects a missing worktree cleanup leaf before teardown", async () => {
  const root = createTmpDir("finalize-state-leaf-missing-");
  try {
    initGitRepo(root);
    const specId = "137";
    const fixture = setupWorktreeFinalizeFlow(root, specId, { issue: 48 });
    removeFinalizeCleanupStep(fixture.state);
    fs.writeFileSync(
      path.join(fixture.worktreePath, "specs", specId, "flow.json"),
      `${JSON.stringify(fixture.state, null, 2)}\n`,
    );
    const head = git(root, ["rev-parse", "HEAD"]);

    assert.throws(
      () => fixture.flowManager.loadReadOnly(specId),
      (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED"
        && /does not match the flow definition/.test(error.message),
    );
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.notEqual(git(root, ["branch", "--list", fixture.featureBranch]), "");
    assert.equal(git(root, ["rev-parse", "HEAD"]), head);
    assert.deepEqual(recoveryJournals(root), []);
  } finally {
    removeTmpDir(root);
  }
});

test("adopts a real post-commit SIGKILL boundary exactly once on retry", async () => {
  const root = createTmpDir("finalize-postcommit-sigkill-");
  try {
    initGitRepo(root);
    const specId = "140";
    setupFinalizeFlow(root, specId);
    const marker = path.join(root, ".git", "post-commit-entered");
    const blocker = path.join(root, ".git", "post-commit-block");
    const hook = path.join(root, ".git", "hooks", "post-commit");
    fs.writeFileSync(blocker, "block\n");
    fs.writeFileSync(hook, [
      "#!/bin/sh",
      `touch ${JSON.stringify(marker)}`,
      `while test -e ${JSON.stringify(blocker)}; do sleep 0.05; done`,
      "",
    ].join("\n"), { mode: 0o755 });

    const child = finalizeChild(root, specId);
    const childExit = waitForExit(child);
    await waitForFile(marker);
    const committedHead = git(root, ["rev-parse", "HEAD"]);
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "prepared");

    child.kill("SIGKILL");
    fs.unlinkSync(blocker);
    const stopped = await childExit;
    assert.equal(stopped.signal, "SIGKILL");
    fs.unlinkSync(hook);

    const flowManager = makeFlowManager(root);
    const { RunFinalizeCleanupCommand } = await import("../../../src/flow/lib/run-finalize-cleanup.js");
    const retried = await new RunFinalizeCleanupCommand().execute({
      root,
      flowManager,
      flowState: flowManager.loadReadOnly(specId),
      autoRescue: false,
      force: false,
    });

    assert.equal(retried.ok, true, JSON.stringify(retried));
    const completedHead = git(root, ["rev-parse", "HEAD"]);
    assert.notEqual(completedHead, committedHead);
    assertCompletedJournal(root);
    assert.equal(git(root, ["log", "--format=%s", "--all"]).split("\n").filter((line) => line === `chore: finalize ${specId}`).length, 1);
    assert.equal(git(root, ["log", "--format=%s", "--all"]).split("\n").filter((line) => line === "chore: complete finalize cleanup").length, 1);

    const repeated = await new RunFinalizeCleanupCommand().execute({
      root,
      flowManager,
      flowState: flowManager.loadReadOnly(specId),
      autoRescue: false,
      force: false,
    });
    assert.equal(repeated.ok, true, JSON.stringify(repeated));
    assert.equal(git(root, ["rev-parse", "HEAD"]), completedHead);
  } finally {
    removeTmpDir(root);
  }
});

for (const tamper of ["missing-result", "mismatched-result-phase"]) {
  test(`rejects ${tamper} in a commit-durable teardown journal before mutation`, async () => {
    const root = createTmpDir(`finalize-journal-${tamper}-`);
    try {
      initGitRepo(root);
      const specId = tamper === "missing-result" ? "141" : "142";
      const fixture = await seedPointerFailure(root, specId);
      const journalPath = recoveryJournal(root);
      const value = JSON.parse(fs.readFileSync(journalPath, "utf8"));
      value.phase = "commit-durable";
      if (tamper === "missing-result") value.result = null;
      else value.result.phase = "prepared";
      fs.writeFileSync(journalPath, `${JSON.stringify(value, null, 2)}\n`);
      const before = {
        head: git(root, ["rev-parse", "HEAD"]),
        active: fs.readFileSync(path.join(root, ".senti", ".active-flow")),
        pointer: fs.statSync(fixture.pointerPath).isDirectory(),
        journal: fs.readFileSync(journalPath),
      };

      await assert.rejects(
        () => runFinalize(root, specId),
        /phase|result|commit|schema/i,
      );

      assert.equal(git(root, ["rev-parse", "HEAD"]), before.head);
      assert.deepEqual(fs.readFileSync(path.join(root, ".senti", ".active-flow")), before.active);
      assert.equal(fs.statSync(fixture.pointerPath).isDirectory(), before.pointer);
      assert.deepEqual(fs.readFileSync(journalPath), before.journal);
    } finally {
      removeTmpDir(root);
    }
  });
}

test("rejects a changed worktree HEAD before removing the worktree", async () => {
  const root = createTmpDir("finalize-worktree-head-divergence-");
  try {
    initGitRepo(root);
    const specId = "143";
    const fixture = setupWorktreeFinalizeFlow(root, specId);
    git(root, ["worktree", "lock", fixture.worktreePath]);
    const failed = await runFinalize(root, specId, {
      flowManager: fixture.flowManager,
      flowState: fixture.state,
    });
    assert.equal(failed.errors[0].code, "WORKTREE_REMOVE_FAILED");
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "index-reconciled");
    git(root, ["worktree", "unlock", fixture.worktreePath]);
    fs.writeFileSync(path.join(fixture.worktreePath, "after-journal.txt"), "divergent\n");
    git(fixture.worktreePath, ["add", "after-journal.txt"]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "advance feature after journal"]);
    const featureSha = git(root, ["rev-parse", fixture.featureBranch]);

    await assert.rejects(
      () => runFinalize(root, specId, {
        flowManager: fixture.flowManager,
        flowState: fixture.state,
      }),
      /worktree|feature|authority|diverg/i,
    );

    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.equal(git(root, ["rev-parse", fixture.featureBranch]), featureSha);
  } finally {
    removeTmpDir(root);
  }
});

test("rejects a changed feature ref before branch deletion", async () => {
  const root = createTmpDir("finalize-feature-ref-divergence-");
  try {
    initGitRepo(root);
    const specId = "144";
    const fixture = setupWorktreeFinalizeFlow(root, specId);
    const blockerPath = path.join(root, ".senti", "branch-blocker");
    git(root, ["worktree", "add", "--force", blockerPath, fixture.featureBranch]);
    const failed = await runFinalize(root, specId, {
      flowManager: fixture.flowManager,
      flowState: fixture.state,
    });
    assert.equal(failed.errors[0].code, "BRANCH_DELETE_FAILED");
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "worktree-removed");
    git(root, ["worktree", "remove", "--force", blockerPath]);
    const oldSha = git(root, ["rev-parse", fixture.featureBranch]);
    const tree = git(root, ["rev-parse", `${oldSha}^{tree}`]);
    const replacementSha = git(root, ["commit-tree", tree, "-p", oldSha, "-m", "replace feature authority"]);
    git(root, ["update-ref", `refs/heads/${fixture.featureBranch}`, replacementSha, oldSha]);

    await assert.rejects(
      () => runFinalize(root, specId, {
        flowManager: makeFlowManager(root),
        flowState: fixture.state,
      }),
      /feature|authority|diverg|revision/i,
    );

    assert.equal(git(root, ["rev-parse", fixture.featureBranch]), replacementSha);
  } finally {
    removeTmpDir(root);
  }
});

test("rejects completion when the finalize commit is no longer reachable from base HEAD", async () => {
  const root = createTmpDir("finalize-base-reachability-");
  try {
    initGitRepo(root);
    const specId = "145";
    const fixture = await seedPointerFailure(root, specId);
    fs.rmdirSync(fixture.pointerPath);
    git(root, ["reset", "--hard", "HEAD^"]);
    const baseHead = git(root, ["rev-parse", "HEAD"]);
    const activePath = path.join(root, ".senti", ".active-flow");
    const activeBytes = fs.readFileSync(activePath);

    await assert.rejects(
      () => runFinalize(root, specId),
      /reachable|base|commit|authority|diverg/i,
    );

    assert.equal(git(root, ["rev-parse", "HEAD"]), baseHead);
    assert.deepEqual(fs.readFileSync(activePath), activeBytes);
    assert.equal(fs.existsSync(fixture.pointerPath), false);
    assert.equal(fs.existsSync(recoveryJournal(root)), true);
  } finally {
    removeTmpDir(root);
  }
});

for (const force of [false, true]) {
  test(`resumes a persisted squash teardown after branch deletion${force ? " with force" : ""}`, async () => {
    const root = createTmpDir(`finalize-squash-resume-${force ? "force" : "normal"}-`);
    try {
      initGitRepo(root);
      const specId = force ? "147" : "146";
      const fixture = await seedPointerFailure(root, specId, { mergeStrategy: "squash", force });
      fs.rmdirSync(fixture.pointerPath);
      const committedHead = git(root, ["rev-parse", "HEAD"]);

      const retried = await runFinalize(root, specId, { force });

      assert.equal(retried.ok, true, JSON.stringify(retried));
      const completedHead = git(root, ["rev-parse", "HEAD"]);
      assert.notEqual(completedHead, committedHead);
      assert.equal(git(root, ["log", "-1", "--format=%s"]), "chore: complete finalize cleanup");
      assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), false);
      assert.equal(fs.readFileSync(fixture.pointerPath, "utf8").trim(), fixture.spec);

      const repeated = await runFinalize(root, specId, { force });
      assert.equal(repeated.ok, true, JSON.stringify(repeated));
      assert.equal(git(root, ["rev-parse", "HEAD"]), completedHead);
    } finally {
      removeTmpDir(root);
    }
  });
}

test("spec-only completion keeps journal authority across pointer failure and retry", async () => {
  const root = createTmpDir("finalize-spec-only-transaction-");
  try {
    initGitRepo(root);
    const specId = "148";
    const spec = `specs/${specId}/spec.json`;
    const state = setupFlow(root, {
      spec,
      runId: `run-${specId}`,
      baseBranch: "master",
      featureBranch: "master",
      worktree: false,
    });
    state.state = { mergeStrategy: "pr" };
    replaceFlowState(root, state, { specId });
    const flowManager = makeFlowManager(root);
    flowManager.addActiveFlow(specId, "local");
    const pointerPath = path.join(root, ".senti", "last-finalized-spec");
    fs.mkdirSync(pointerPath);

    const failed = await runFinalize(root, specId, { flowState: state });

    assert.equal(failed.ok, false);
    assert.equal(failed.errors[0].code, "FINALIZE_POINTER_WRITE_FAILED");
    assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), true);
    assert.equal(fs.existsSync(recoveryJournal(root)), true);
    fs.rmdirSync(pointerPath);

    const retried = await runFinalize(root, specId);
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), false);
    assert.equal(fs.readFileSync(pointerPath, "utf8").trim(), spec);
    assertCompletedJournal(root);
  } finally {
    removeTmpDir(root);
  }
});

test("two finalize CLI processes elect one transaction winner", async () => {
  const root = createTmpDir("finalize-process-lock-race-");
  try {
    initGitRepo(root);
    const specId = "149";
    setupFinalizeFlow(root, specId);
    const marker = path.join(root, ".git", "first-finalize-commit");
    const blocker = path.join(root, ".git", "first-finalize-block");
    const gate = path.join(root, ".git", "first-finalize-gate");
    const hook = path.join(root, ".git", "hooks", "post-commit");
    fs.writeFileSync(blocker, "block\n");
    fs.writeFileSync(hook, [
      "#!/bin/sh",
      `if mkdir ${JSON.stringify(gate)} 2>/dev/null; then`,
      `  touch ${JSON.stringify(marker)}`,
      `  while test -e ${JSON.stringify(blocker)}; do sleep 0.05; done`,
      "fi",
      "",
    ].join("\n"), { mode: 0o755 });

    const first = finalizeChild(root, specId);
    const firstDone = childResult(first);
    await waitForFile(marker);
    const second = finalizeChild(root, specId);
    const secondResult = await childResult(second);
    fs.unlinkSync(blocker);
    const firstResult = await firstDone;
    fs.unlinkSync(hook);
    const results = [firstResult, secondResult].map((result) => ({
      ...result,
      value: result.stdout.trim() ? JSON.parse(result.stdout) : null,
    }));

    assert.equal(results.filter((result) => result.value?.ok === true).length, 1, JSON.stringify(results));
    const loser = results.find((result) => result.value?.ok !== true);
    assert.equal(loser?.value?.errors?.[0]?.code, "REPOSITORY_FLOW_OPERATION_BUSY", JSON.stringify(results));
    assert.equal(
      git(root, ["log", "--format=%s", "--all"]).split("\n").filter((line) => line === `chore: finalize ${specId}`).length,
      1,
    );
    assert.deepEqual(
      fs.readdirSync(path.join(root, ".senti", "recovery", "finalize-cleanup")).filter((entry) => entry.endsWith(".lock")),
      [],
    );
  } finally {
    removeTmpDir(root);
  }
});

test("two compliant Senti publication processes exclude the loser before source create, verify, or rename", async () => {
  const root = createTmpDir("finalize-publication-authority-race-");
  try {
    initGitRepo(root);
    const specId = "186";
    setupFinalizeFlow(root, specId);
    const reached = path.join(root, ".git", "publication-plan-reached");
    const blocker = path.join(root, ".git", "publication-plan-blocker");
    fs.writeFileSync(blocker, "block\n");
    const first = finalizeChildBlockedAfterPublicationPlan(root, specId, reached, blocker);
    const firstDone = childResult(first);
    await waitForFile(reached);
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    assert.equal(journal.indexLockAuthority.publishPhase, "planned");
    const publicationPath = path.join(
      journal.tempIndexAuthority.workspacePath,
      journal.indexLockAuthority.publicationName,
    );
    assert.equal(fs.existsSync(publicationPath), false);
    const beforeLoser = {
      index: fs.readFileSync(path.join(root, ".git", "index")),
      journal: fs.readFileSync(recoveryJournal(root)),
      workspace: fs.readdirSync(journal.tempIndexAuthority.workspacePath).sort(),
    };

    const second = await childResult(finalizeChild(root, specId));
    const secondValue = JSON.parse(second.stdout);
    assert.equal(secondValue.ok, false, JSON.stringify(secondValue));
    assert.equal(secondValue.errors[0].code, "REPOSITORY_FLOW_OPERATION_BUSY");
    assert.deepEqual(fs.readFileSync(path.join(root, ".git", "index")), beforeLoser.index);
    assert.deepEqual(fs.readFileSync(recoveryJournal(root)), beforeLoser.journal);
    assert.deepEqual(fs.readdirSync(journal.tempIndexAuthority.workspacePath).sort(), beforeLoser.workspace);
    assert.equal(fs.existsSync(publicationPath), false);

    fs.unlinkSync(blocker);
    const firstResult = await firstDone;
    assert.equal(JSON.parse(firstResult.stdout).ok, true, firstResult.stderr);
  } finally {
    removeTmpDir(root);
  }
});

test("preserves malformed journal and transaction lock release failures in causal order", async () => {
  const root = createTmpDir("finalize-lock-release-order-");
  try {
    initGitRepo(root);
    const specId = "150";
    const fixture = await seedPointerFailure(root, specId);
    const journalPath = recoveryJournal(root);
    fs.writeFileSync(journalPath, "{malformed\n");
    fs.rmdirSync(fixture.pointerPath);
    const originalRelease = ProcessOwnedLock.prototype.release;
    ProcessOwnedLock.prototype.release = function releaseWithFailure(...args) {
      if (this.kind === "finalize-teardown-operation") {
        throw new Error("finalize transaction lock release failed");
      }
      return originalRelease.apply(this, args);
    };
    try {
      await assert.rejects(
        () => runFinalize(root, specId),
        (error) => error instanceof AggregateError
          && error.errors.length === 2
          && /JSON|malformed|parse/i.test(error.errors[0].message)
          && error.errors[1].message === "finalize transaction lock release failed"
          && error.cause === error.errors[0],
      );
    } finally {
      ProcessOwnedLock.prototype.release = originalRelease;
    }
  } finally {
    removeTmpDir(root);
  }
});

test("fails closed when a persisted journal disappears after its fresh locked stat", async () => {
  const root = createTmpDir("finalize-journal-disappears-after-stat-");
  try {
    initGitRepo(root);
    const specId = "151";
    const fixture = await seedPointerFailure(root, specId);
    const journalPath = recoveryJournal(root);
    const activePath = path.join(root, ".senti", ".active-flow");
    const before = {
      head: git(root, ["rev-parse", "HEAD"]),
      active: fs.readFileSync(activePath),
      pointerIsDirectory: fs.statSync(fixture.pointerPath).isDirectory(),
    };
    const originalLstat = fs.lstatSync;
    let removed = false;
    fs.lstatSync = (target, ...args) => {
      const stat = originalLstat(target, ...args);
      if (!removed && path.resolve(String(target)) === journalPath) {
        removed = true;
        fs.unlinkSync(journalPath);
      }
      return stat;
    };
    try {
      await assert.rejects(
        () => runFinalize(root, specId),
        /ENOENT|identity|authority|revision|unavailable/i,
      );
    } finally {
      fs.lstatSync = originalLstat;
    }

    assert.equal(removed, true);
    assert.equal(git(root, ["rev-parse", "HEAD"]), before.head);
    assert.deepEqual(fs.readFileSync(activePath), before.active);
    assert.equal(fs.statSync(fixture.pointerPath).isDirectory(), before.pointerIsDirectory);
    assert.equal(fs.existsSync(journalPath), false);
  } finally {
    removeTmpDir(root);
  }
});

test("public non-spec finalize completes without an undefined journal lookup", async () => {
  const root = createTmpDir("finalize-public-nonspec-regression-");
  try {
    initGitRepo(root);
    const specId = "152";
    setupFinalizeFlow(root, specId);

    const result = await runFinalize(root, specId);

    assert.equal(result.ok, true, JSON.stringify(result));
    assertCompletedJournal(root);
  } finally {
    removeTmpDir(root);
  }
});

test("different flow CLI processes share one repository finalize operation lock", async () => {
  const root = createTmpDir("finalize-repository-lock-race-");
  try {
    initGitRepo(root);
    const firstSpecId = "153";
    const secondSpecId = "154";
    setupFinalizeFlow(root, firstSpecId);
    setupFinalizeFlow(root, secondSpecId);
    const marker = path.join(root, ".git", "repository-finalize-entered");
    const blocker = path.join(root, ".git", "repository-finalize-block");
    const gate = path.join(root, ".git", "repository-finalize-gate");
    const hook = path.join(root, ".git", "hooks", "post-commit");
    fs.writeFileSync(blocker, "block\n");
    fs.writeFileSync(hook, [
      "#!/bin/sh",
      `if mkdir ${JSON.stringify(gate)} 2>/dev/null; then`,
      `  touch ${JSON.stringify(marker)}`,
      `  while test -e ${JSON.stringify(blocker)}; do sleep 0.05; done`,
      "fi",
      "",
    ].join("\n"), { mode: 0o755 });

    const first = finalizeChild(root, firstSpecId);
    const firstDone = childResult(first);
    await waitForFile(marker);
    const beforeSecond = {
      head: git(root, ["rev-parse", "HEAD"]),
      index: git(root, ["diff", "--cached", "--name-only"]),
      secondFlow: fs.readFileSync(path.join(root, "specs", secondSpecId, "flow.json")),
      journals: recoveryJournals(root).map((filePath) => fs.readFileSync(filePath)),
    };

    const secondResult = await childResult(finalizeChild(root, secondSpecId));
    const secondValue = secondResult.stdout.trim() ? JSON.parse(secondResult.stdout) : null;
    const afterSecond = {
      head: git(root, ["rev-parse", "HEAD"]),
      index: git(root, ["diff", "--cached", "--name-only"]),
      secondFlow: fs.readFileSync(path.join(root, "specs", secondSpecId, "flow.json")),
      journals: recoveryJournals(root).map((filePath) => fs.readFileSync(filePath)),
    };
    fs.unlinkSync(blocker);
    const firstResult = await firstDone;
    fs.unlinkSync(hook);
    const firstValue = firstResult.stdout.trim() ? JSON.parse(firstResult.stdout) : null;
    assert.equal(secondValue?.ok, false, JSON.stringify(secondResult));
    assert.equal(secondValue?.errors?.[0]?.code, "REPOSITORY_FLOW_OPERATION_BUSY", JSON.stringify(secondValue));
    assert.equal(afterSecond.head, beforeSecond.head);
    assert.equal(afterSecond.index, beforeSecond.index);
    assert.deepEqual(afterSecond.secondFlow, beforeSecond.secondFlow);
    assert.deepEqual(afterSecond.journals, beforeSecond.journals);
    assert.equal(firstValue?.ok, true, JSON.stringify(firstResult));
    assert.equal(recoveryJournals(root).length, 1);
    assertCompletedJournal(root);
  } finally {
    removeTmpDir(root);
  }
});

test("maintenance and finalize actual processes stop the loser before repository mutation", async () => {
  const root = createTmpDir("finalize-maintenance-barrier-");
  try {
    initGitRepo(root);
    const firstSpec = "169";
    setupFinalizeFlow(root, firstSpec);
    const maintenance = new RepositoryMaintenanceLock({ mainRoot: root });
    maintenance.acquire();
    const beforeFinalize = {
      head: git(root, ["rev-parse", "HEAD"]),
      index: fs.readFileSync(path.join(root, ".git", "index")),
      flow: fs.readFileSync(path.join(root, "specs", firstSpec, "flow.json")),
      journals: recoveryJournals(root).map((filePath) => fs.readFileSync(filePath)),
    };
    const blockedFinalize = finalizeChild(root, firstSpec);
    const blockedFinalizeResult = await childResult(blockedFinalize);
    maintenance.release();
    const finalizeValue = JSON.parse(blockedFinalizeResult.stdout);
    assert.equal(finalizeValue.ok, false, JSON.stringify(finalizeValue));
    assert.equal(finalizeValue.errors[0].code, "REPOSITORY_MAINTENANCE_BUSY");
    assert.equal(git(root, ["rev-parse", "HEAD"]), beforeFinalize.head);
    assert.deepEqual(fs.readFileSync(path.join(root, ".git", "index")), beforeFinalize.index);
    assert.deepEqual(fs.readFileSync(path.join(root, "specs", firstSpec, "flow.json")), beforeFinalize.flow);
    assert.deepEqual(recoveryJournals(root).map((filePath) => fs.readFileSync(filePath)), beforeFinalize.journals);

    const hook = path.join(root, ".git", "hooks", "pre-commit");
    const blocker = path.join(root, "finalize-barrier-blocker");
    const reached = path.join(root, "finalize-barrier-reached");
    fs.writeFileSync(hook, `#!/bin/sh\ntouch ${JSON.stringify(reached)}\nwhile test -e ${JSON.stringify(blocker)}; do sleep 0.02; done\n`, { mode: 0o755 });
    fs.writeFileSync(blocker, "block\n");
    const runningFinalize = finalizeChild(root, firstSpec);
    await waitForFile(reached);
    const beforeMaintenance = {
      head: git(root, ["rev-parse", "HEAD"]),
      index: fs.readFileSync(path.join(root, ".git", "index")),
      flow: fs.readFileSync(path.join(root, "specs", firstSpec, "flow.json")),
      journals: recoveryJournals(root).map((filePath) => fs.readFileSync(filePath)),
    };
    const maintenanceScript = `
      import { RepositoryMaintenanceLock } from ${JSON.stringify(pathToFileURL(path.resolve("src/lib/repository-maintenance-lock.js")).href)};
      const lock = new RepositoryMaintenanceLock({ mainRoot: ${JSON.stringify(root)} });
      try { lock.acquire(); process.stdout.write("ACQUIRED"); lock.release(); }
      catch (error) { process.stdout.write(error.code || error.message); }
    `;
    const blockedMaintenance = spawn(process.execPath, ["--input-type=module", "-e", maintenanceScript], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const maintenanceResult = await childResult(blockedMaintenance);
    assert.equal(maintenanceResult.stdout, "REPOSITORY_FLOW_OPERATION_BUSY", maintenanceResult.stderr);
    assert.equal(git(root, ["rev-parse", "HEAD"]), beforeMaintenance.head);
    assert.deepEqual(fs.readFileSync(path.join(root, ".git", "index")), beforeMaintenance.index);
    assert.deepEqual(fs.readFileSync(path.join(root, "specs", firstSpec, "flow.json")), beforeMaintenance.flow);
    assert.deepEqual(recoveryJournals(root).map((filePath) => fs.readFileSync(filePath)), beforeMaintenance.journals);
    fs.unlinkSync(blocker);
    const finalizeResult = await childResult(runningFinalize);
    fs.unlinkSync(hook);
    assert.equal(JSON.parse(finalizeResult.stdout).ok, true, finalizeResult.stderr);
  } finally {
    removeTmpDir(root);
  }
});

test("revalidates commit authority after the expectation journal becomes durable", async () => {
  const root = createTmpDir("finalize-precommit-fresh-authority-");
  try {
    initGitRepo(root);
    const specId = "155";
    const fixture = setupFinalizeFlow(root, specId);
    const headBefore = git(root, ["rev-parse", "HEAD"]);
    const originalWrite = AtomicJsonFile.prototype.write;
    let changed = false;
    AtomicJsonFile.prototype.write = function writeThenChangeFeature(value) {
      const result = originalWrite.call(this, value);
      if (!changed && value?.version === 7 && value.commitExpectation) {
        changed = true;
        const oldFeature = git(root, ["rev-parse", fixture.featureBranch]);
        const tree = git(root, ["rev-parse", `${oldFeature}^{tree}`]);
        const replacement = git(root, ["commit-tree", tree, "-p", oldFeature, "-m", "foreign feature advance"]);
        git(root, ["update-ref", `refs/heads/${fixture.featureBranch}`, replacement, oldFeature]);
      }
      return result;
    };
    try {
      await assert.rejects(
        () => runFinalize(root, specId),
        /commit|expectation|feature|authority|diverg/i,
      );
    } finally {
      AtomicJsonFile.prototype.write = originalWrite;
    }

    assert.equal(changed, true);
    assert.equal(git(root, ["rev-parse", "HEAD"]), headBefore);
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "prepared");
  } finally {
    removeTmpDir(root);
  }
});

test("rejects finalize when HEAD is not the configured base branch", async () => {
  const root = createTmpDir("finalize-wrong-head-branch-");
  try {
    initGitRepo(root);
    const specId = "161";
    const fixture = setupFinalizeFlow(root, specId);
    git(root, ["checkout", "--quiet", fixture.featureBranch]);
    const before = {
      head: git(root, ["rev-parse", "HEAD"]),
      flow: fs.readFileSync(path.join(root, "specs", specId, "flow.json")),
    };

    await assert.rejects(() => runFinalize(root, specId), /base branch|HEAD ref|parent|authority/i);

    assert.equal(git(root, ["rev-parse", "HEAD"]), before.head);
    assert.deepEqual(fs.readFileSync(path.join(root, "specs", specId, "flow.json")), before.flow);
    assert.equal(recoveryJournals(root).length, 0);
  } finally {
    removeTmpDir(root);
  }
});

test("a foreign caller index lock halts before commit and retry completes cleanly", async () => {
  const root = createTmpDir("finalize-git-add-failure-");
  try {
    initGitRepo(root);
    const specId = "162";
    setupFinalizeFlow(root, specId);
    const indexLock = path.join(root, ".git", "index.lock");
    fs.writeFileSync(indexLock, "busy\n");
    const before = {
      head: git(root, ["rev-parse", "HEAD"]),
      index: fs.readFileSync(path.join(root, ".git", "index")),
      indexLock: fs.readFileSync(indexLock),
    };

    const result = await runFinalize(root, specId);

    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.errors[0].code, "FINALIZE_INDEX_RECONCILIATION_BUSY");
    assert.equal(git(root, ["rev-parse", "HEAD"]), before.head);
    assert.deepEqual(fs.readFileSync(path.join(root, ".git", "index")), before.index);
    assert.deepEqual(fs.readFileSync(indexLock), before.indexLock);
    assert.equal(recoveryJournals(root).length, 1);
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "prepared");

    fs.unlinkSync(indexLock);
    const retried = await runFinalize(root, specId);
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(git(root, ["status", "--porcelain", "--", `specs/${specId}`]), "");
  } finally {
    fs.rmSync(path.join(root, ".git", "index.lock"), { force: true });
    removeTmpDir(root);
  }
});

test("a caller index lock race after durable intent restores without deleting the winner", async () => {
  const root = createTmpDir("finalize-index-lock-race-");
  try {
    initGitRepo(root);
    const specId = "166";
    setupFinalizeFlow(root, specId);
    const before = preCommitSnapshot(root, specId);
    const indexLock = path.join(root, ".git", "index.lock");
    const originalWrite = AtomicJsonFile.prototype.write;
    let raced = false;
    AtomicJsonFile.prototype.write = function createForeignLockAfterIntent(value) {
      const result = originalWrite.call(this, value);
      if (!raced && value?.indexLockAuthority?.dev === null && value?.tempIndexAuthority == null) {
        raced = true;
        fs.writeFileSync(indexLock, "foreign winner\n");
      }
      return result;
    };
    let stopped;
    try {
      stopped = await runFinalize(root, specId);
    } finally {
      AtomicJsonFile.prototype.write = originalWrite;
    }

    assert.equal(raced, true);
    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "FINALIZE_INDEX_RECONCILIATION_BUSY");
    assertPreCommitSnapshot(root, specId, before);
    assert.equal(fs.readFileSync(indexLock, "utf8"), "foreign winner\n");
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    assert.equal(journal.phase, "prepared");
    assert.equal(journal.indexLockAuthority, null);
  } finally {
    fs.rmSync(path.join(root, ".git", "index.lock"), { force: true });
    removeTmpDir(root);
  }
});

test("retry adopts its journaled caller index lock after SIGKILL", async () => {
  const root = createTmpDir("finalize-index-lock-sigkill-");
  try {
    initGitRepo(root);
    const specId = "167";
    setupFinalizeFlow(root, specId);
    const headBefore = git(root, ["rev-parse", "HEAD"]);
    const script = `
      import { AtomicJsonFile } from ${JSON.stringify(pathToFileURL(atomicJsonModule).href)};
      import { RunFinalizeCleanupCommand } from ${JSON.stringify(pathToFileURL(finalizeModule).href)};
      import { FlowManager } from ${JSON.stringify(pathToFileURL(flowManagerModule).href)};
      const originalWrite = AtomicJsonFile.prototype.write;
      AtomicJsonFile.prototype.write = function crashAfterIndexLease(value) {
        const result = originalWrite.call(this, value);
        if (value?.indexLockAuthority?.dev != null && value?.tempIndexAuthority == null) {
          process.kill(process.pid, "SIGKILL");
        }
        return result;
      };
      const root = ${JSON.stringify(root)};
      const specId = ${JSON.stringify(specId)};
      const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
      await new RunFinalizeCleanupCommand().execute({
        root,
        flowManager,
        flowState: flowManager.loadReadOnly(specId),
        autoRescue: false,
        force: false,
      });
    `;
    const crashed = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(crashed.signal, "SIGKILL", crashed.stderr);
    assert.equal(git(root, ["rev-parse", "HEAD"]), headBefore);
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    assert.equal(journal.phase, "prepared");
    assert.equal(typeof journal.indexLockAuthority.dev, "number");
    const lockPath = path.join(root, ".git", "index.lock");
    assert.equal(fs.statSync(lockPath).ino, journal.indexLockAuthority.ino);

    const retried = await runFinalize(root, specId);
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(fs.existsSync(lockPath), false);
    assert.equal(git(root, ["status", "--porcelain", "--", `specs/${specId}`]), "");
  } finally {
    removeTmpDir(root);
  }
});

test("retry publishes journaled index bytes after SIGKILL immediately before index rename", async () => {
  const root = createTmpDir("finalize-index-publish-sigkill-");
  try {
    initGitRepo(root);
    const specId = "169";
    setupFinalizeFlow(root, specId);
    const crashed = crashFinalizeBeforeIndexRename(root, specId);
    assert.equal(crashed.signal, "SIGKILL", crashed.stderr);
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    const lockPath = path.join(root, ".git", "index.lock");
    assert.equal(journal.phase, "commit-durable");
    assert.equal(journal.indexLockAuthority.publishPhase, "publishing");
    assert.match(journal.indexLockAuthority.markerRevision, /^[a-f0-9]{64}$/);
    assert.match(journal.indexLockAuthority.expectedIndexRevision, /^[a-f0-9]{64}$/);
    assert.equal(fs.statSync(lockPath).ino, journal.indexLockAuthority.ino);

    const retried = await runFinalize(root, specId);
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(fs.existsSync(lockPath), false);
    assert.equal(git(root, ["status", "--porcelain", "--", `specs/${specId}`]), "");
  } finally {
    removeTmpDir(root);
  }
});

test("retry adopts only its journal-first publication source after the source durability crash gap", async () => {
  const root = createTmpDir("finalize-index-publication-plan-crash-");
  try {
    initGitRepo(root);
    const specId = "187";
    setupFinalizeFlow(root, specId);
    const crashed = crashFinalizeAfterPlannedPublicationSourceFsync(root, specId);
    assert.equal(crashed.signal, "SIGKILL", crashed.stderr);
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    assert.equal(journal.phase, "commit-durable");
    assert.equal(journal.indexLockAuthority.publishPhase, "planned");
    assert.match(journal.indexLockAuthority.publicationToken, /^[0-9a-f-]{36}$/);
    assert.match(journal.indexLockAuthority.publicationName, /^publication-[0-9a-f-]{36}\.index$/);
    assert.match(journal.indexLockAuthority.expectedIndexRevision, /^[a-f0-9]{64}$/);
    assert.equal(typeof journal.indexLockAuthority.expectedIndexMode, "number");
    assert.equal(journal.indexLockAuthority.publicationDev, null);
    assert.equal(fs.existsSync(path.join(
      journal.tempIndexAuthority.workspacePath,
      journal.indexLockAuthority.publicationName,
    )), true);

    const retried = await runFinalize(root, specId);
    assert.equal(retried.ok, true, JSON.stringify(retried));
    assert.equal(git(root, ["status", "--porcelain", "--", `specs/${specId}`]), "");
  } finally {
    removeTmpDir(root);
  }
});

test("retry preserves an unknown workspace artifact and leaves the caller index unchanged", async () => {
  const root = createTmpDir("finalize-index-publication-unknown-");
  try {
    initGitRepo(root);
    const specId = "188";
    setupFinalizeFlow(root, specId);
    const crashed = crashFinalizeAfterPlannedPublicationSourceFsync(root, specId);
    assert.equal(crashed.signal, "SIGKILL", crashed.stderr);
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    const unknownPath = path.join(journal.tempIndexAuthority.workspacePath, "unknown.index");
    const unknownBytes = Buffer.from("unknown publication authority\n");
    fs.writeFileSync(unknownPath, unknownBytes);
    const indexBefore = fs.readFileSync(path.join(root, ".git", "index"));

    const stopped = await runFinalize(root, specId);

    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED");
    assert.deepEqual(fs.readFileSync(path.join(root, ".git", "index")), indexBefore);
    assert.deepEqual(fs.readFileSync(unknownPath), unknownBytes);
  } finally {
    removeTmpDir(root);
  }
});

for (const drift of ["workspace-mode", "owner-mode", "owner-content", "owner-identity"]) {
  test(`workspace ${drift} drift fails closed before journaled index publication`, async () => {
    const root = createTmpDir(`finalize-index-workspace-${drift}-`);
    try {
      initGitRepo(root);
      const specId = {
        "workspace-mode": "189",
        "owner-mode": "190",
        "owner-content": "191",
        "owner-identity": "193",
      }[drift];
      setupFinalizeFlow(root, specId);
      const crashed = crashFinalizeAfterPlannedPublicationSourceFsync(root, specId);
      assert.equal(crashed.signal, "SIGKILL", crashed.stderr);
      const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
      const workspacePath = journal.tempIndexAuthority.workspacePath;
      const ownerPath = path.join(workspacePath, ".owner");
      if (drift === "workspace-mode") {
        fs.chmodSync(workspacePath, 0o755);
      } else if (drift === "owner-mode") {
        fs.chmodSync(ownerPath, 0o644);
      } else if (drift === "owner-content") {
        fs.writeFileSync(ownerPath, "foreign owner\n");
      } else {
        fs.renameSync(ownerPath, `${ownerPath}.original`);
        fs.writeFileSync(ownerPath, `${journal.tempIndexAuthority.token}\n`, { mode: 0o600 });
      }
      const indexBefore = fs.readFileSync(path.join(root, ".git", "index"));

      const stopped = await runFinalize(root, specId);

      assert.equal(stopped.ok, false, JSON.stringify(stopped));
      assert.equal(stopped.errors[0].code, "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED");
      assert.deepEqual(fs.readFileSync(path.join(root, ".git", "index")), indexBefore);
      assert.equal(fs.existsSync(workspacePath), true);
    } finally {
      removeTmpDir(root);
    }
  });
}

test("workspace UID is revalidated at the publication boundary", async () => {
  const root = createTmpDir("finalize-index-workspace-uid-");
  try {
    initGitRepo(root);
    const specId = "192";
    setupFinalizeFlow(root, specId);
    const indexPath = path.join(root, ".git", "index");
    const indexBefore = fs.readFileSync(indexPath);
    const originalWrite = AtomicJsonFile.prototype.write;
    const originalLstat = fs.lstatSync;
    let workspacePath = null;
    AtomicJsonFile.prototype.write = function observePublicationPlan(value) {
      const result = originalWrite.call(this, value);
      if (value?.indexLockAuthority?.publishPhase === "planned") {
        workspacePath = value.tempIndexAuthority.workspacePath;
      }
      return result;
    };
    fs.lstatSync = (target, ...args) => {
      const stat = originalLstat(target, ...args);
      if (workspacePath && path.resolve(String(target)) === workspacePath) {
        return new Proxy(stat, { get: (value, property) => property === "uid" ? stat.uid + 1 : value[property] });
      }
      return stat;
    };
    let stopped;
    try {
      stopped = await runFinalize(root, specId);
    } finally {
      AtomicJsonFile.prototype.write = originalWrite;
      fs.lstatSync = originalLstat;
    }

    assert.notEqual(workspacePath, null);
    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "FINALIZE_TEMP_INDEX_AUTHORITY_FAILED");
    assert.deepEqual(fs.readFileSync(indexPath), indexBefore);
  } finally {
    removeTmpDir(root);
  }
});

test("retry never mutates foreign content in the journaled index lock inode", async () => {
  const root = createTmpDir("finalize-index-publish-foreign-content-");
  try {
    initGitRepo(root);
    const specId = "171";
    setupFinalizeFlow(root, specId);
    const crashed = crashFinalizeBeforeIndexRename(root, specId);
    assert.equal(crashed.signal, "SIGKILL", crashed.stderr);
    const journalPath = recoveryJournal(root);
    const journalBefore = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    const lockPath = path.join(root, ".git", "index.lock");
    const ownedIno = fs.statSync(lockPath).ino;
    fs.writeFileSync(lockPath, "foreign same-inode content\n");
    assert.equal(fs.statSync(lockPath).ino, ownedIno);
    const foreignBytes = fs.readFileSync(lockPath);

    const stopped = await runFinalize(root, specId);

    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "FINALIZE_INDEX_RECONCILIATION_BUSY");
    assert.deepEqual(fs.readFileSync(lockPath), foreignBytes);
    const journalAfter = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    assert.equal(journalAfter.phase, "commit-durable");
    assert.deepEqual(journalAfter.indexLockAuthority, journalBefore.indexLockAuthority);
    assert.equal(journalAfter.result.ok, false);
  } finally {
    removeTmpDir(root);
  }
});

test("index lease acquisition cleanup never unlinks a foreign inode replacement", async () => {
  const root = createTmpDir("finalize-index-acquire-foreign-inode-");
  try {
    initGitRepo(root);
    const specId = "172";
    setupFinalizeFlow(root, specId);
    const before = preCommitSnapshot(root, specId);
    const lockPath = path.join(root, ".git", "index.lock");
    const foreignBytes = Buffer.from("foreign replacement after index lease create\n");
    const originalFsync = fs.fsyncSync;
    let replaced = false;
    fs.fsyncSync = (descriptor) => {
      originalFsync(descriptor);
      if (replaced) return;
      let openedPath = "";
      try { openedPath = fs.readlinkSync(`/proc/self/fd/${descriptor}`); } catch {}
      if (openedPath !== lockPath) return;
      replaced = true;
      fs.unlinkSync(lockPath);
      fs.writeFileSync(lockPath, foreignBytes);
    };
    let stopped;
    try {
      stopped = await runFinalize(root, specId);
    } finally {
      fs.fsyncSync = originalFsync;
    }

    assert.equal(replaced, true);
    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "FINALIZE_INDEX_RECONCILIATION_BUSY");
    assertPreCommitSnapshot(root, specId, before);
    assert.deepEqual(fs.readFileSync(lockPath), foreignBytes);
  } finally {
    fs.rmSync(path.join(root, ".git", "index.lock"), { force: true });
    removeTmpDir(root);
  }
});

test("index publication completes and verifies repeated short writes before rename", async () => {
  const root = createTmpDir("finalize-index-publish-short-write-");
  try {
    initGitRepo(root);
    const specId = "173";
    setupFinalizeFlow(root, specId);
    const lockPath = path.join(root, ".git", "index.lock");
    const originalWrite = fs.writeSync;
    let shortWrites = 0;
    let publishing = false;
    fs.writeSync = (descriptor, buffer, offset, length, position) => {
      let openedPath = "";
      try { openedPath = fs.readlinkSync(`/proc/self/fd/${descriptor}`); } catch {}
      if (openedPath === lockPath && offset === 0 && buffer.subarray(0, 4).toString("ascii") === "DIRC") {
        publishing = true;
      }
      if (publishing && openedPath === lockPath && length > 17) {
        shortWrites += 1;
        return originalWrite(descriptor, buffer, offset, 17, position);
      }
      return originalWrite(descriptor, buffer, offset, length, position);
    };
    let result;
    try {
      result = await runFinalize(root, specId);
    } finally {
      fs.writeSync = originalWrite;
    }

    assert.ok(shortWrites > 1);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(fs.existsSync(lockPath), false);
    assert.equal(git(root, ["status", "--porcelain", "--", `specs/${specId}`]), "");
  } finally {
    removeTmpDir(root);
  }
});

test("zero-progress index publication never renames a partial lock over the caller index", async () => {
  const root = createTmpDir("finalize-index-publish-zero-write-");
  try {
    initGitRepo(root);
    const specId = "174";
    setupFinalizeFlow(root, specId);
    const indexPath = path.join(root, ".git", "index");
    const lockPath = `${indexPath}.lock`;
    const indexBefore = fs.readFileSync(indexPath);
    const originalWrite = fs.writeSync;
    let blocked = false;
    fs.writeSync = (descriptor, buffer, offset, length, position) => {
      let openedPath = "";
      try { openedPath = fs.readlinkSync(`/proc/self/fd/${descriptor}`); } catch {}
      if (
        !blocked
        && openedPath === lockPath
        && offset === 0
        && buffer.subarray(0, 4).toString("ascii") === "DIRC"
      ) {
        blocked = true;
        return 0;
      }
      return originalWrite(descriptor, buffer, offset, length, position);
    };
    let stopped;
    try {
      stopped = await runFinalize(root, specId);
    } finally {
      fs.writeSync = originalWrite;
    }

    assert.equal(blocked, true);
    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "FINALIZE_INDEX_RECONCILIATION_FAILED");
    assert.deepEqual(fs.readFileSync(indexPath), indexBefore);
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    assert.equal(journal.indexLockAuthority.publishPhase, "publishing");
    assert.equal(fs.statSync(lockPath).ino, journal.indexLockAuthority.ino);
  } finally {
    removeTmpDir(root);
  }
});

test("post-fsync foreign lock replacement is never published over the caller index", async () => {
  const root = createTmpDir("finalize-index-post-fsync-foreign-");
  try {
    initGitRepo(root);
    const specId = "175";
    setupFinalizeFlow(root, specId);
    const indexPath = path.join(root, ".git", "index");
    const lockPath = `${indexPath}.lock`;
    const indexBefore = fs.readFileSync(indexPath);
    const foreignIndexPath = path.join(root, ".git", "foreign.index");
    const foreignRelative = "foreign-staged.txt";
    fs.copyFileSync(indexPath, foreignIndexPath);
    fs.writeFileSync(path.join(root, foreignRelative), "foreign staged content\n");
    execFileSync("git", ["-C", root, "add", "--", foreignRelative], {
      env: { ...process.env, GIT_INDEX_FILE: foreignIndexPath },
    });
    const foreignBytes = fs.readFileSync(foreignIndexPath);
    fs.unlinkSync(foreignIndexPath);
    fs.unlinkSync(path.join(root, foreignRelative));
    assert.notDeepEqual(foreignBytes, indexBefore);

    const originalFsync = fs.fsyncSync;
    let replaced = false;
    let foreignIno = null;
    fs.fsyncSync = (descriptor) => {
      originalFsync(descriptor);
      if (replaced) return;
      let openedPath = "";
      try { openedPath = fs.readlinkSync(`/proc/self/fd/${descriptor}`); } catch {}
      if (openedPath !== lockPath) return;
      const header = Buffer.alloc(4);
      if (fs.readSync(descriptor, header, 0, header.length, 0) !== header.length || header.toString("ascii") !== "DIRC") {
        return;
      }
      replaced = true;
      fs.unlinkSync(lockPath);
      fs.writeFileSync(lockPath, foreignBytes, { mode: 0o644 });
      foreignIno = fs.statSync(lockPath).ino;
    };
    let stopped;
    try {
      stopped = await runFinalize(root, specId);
    } finally {
      fs.fsyncSync = originalFsync;
    }

    assert.equal(replaced, true);
    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "FINALIZE_INDEX_RECONCILIATION_BUSY");
    assert.deepEqual(fs.readFileSync(indexPath), indexBefore);
    assert.equal(fs.statSync(lockPath).ino, foreignIno);
    assert.deepEqual(fs.readFileSync(lockPath), foreignBytes);
  } finally {
    fs.rmSync(path.join(root, ".git", "index.lock"), { force: true });
    removeTmpDir(root);
  }
});

test("foreign empty finalize workspace is never adopted or mutated", async () => {
  const root = createTmpDir("finalize-empty-workspace-race-");
  try {
    initGitRepo(root);
    const specId = "170";
    setupFinalizeFlow(root, specId);
    const before = preCommitSnapshot(root, specId);
    const originalWrite = AtomicJsonFile.prototype.write;
    let foreignWorkspace = null;
    AtomicJsonFile.prototype.write = function createForeignEmptyWorkspace(value) {
      const result = originalWrite.call(this, value);
      if (
        foreignWorkspace == null
        && value?.indexLockAuthority?.dev != null
        && value?.tempIndexAuthority?.dev === null
      ) {
        foreignWorkspace = value.tempIndexAuthority.workspacePath;
        fs.mkdirSync(foreignWorkspace, { recursive: true, mode: 0o700 });
      }
      return result;
    };
    let stopped;
    try {
      stopped = await runFinalize(root, specId);
    } finally {
      AtomicJsonFile.prototype.write = originalWrite;
    }

    assert.notEqual(foreignWorkspace, null);
    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.match(stopped.errors[0].code, /FINALIZE_TEMP_INDEX_(BUSY|AUTHORITY_FAILED)/);
    assertPreCommitSnapshot(root, specId, before);
    assert.deepEqual(fs.readdirSync(foreignWorkspace), []);
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "prepared");
  } finally {
    removeTmpDir(root);
  }
});

test("pre-commit failure restores every file while preserving a preexisting staged blob", async () => {
  const root = createTmpDir("finalize-isolated-index-failure-");
  try {
    initGitRepo(root);
    const specId = "168";
    setupFinalizeFlow(root, specId);
    const flowRel = `specs/${specId}/flow.json`;
    const flowPath = path.join(root, flowRel);
    const originalFlow = fs.readFileSync(flowPath);
    const stagedState = JSON.parse(originalFlow.toString("utf8"));
    stagedState.callerStaged = "must-survive";
    fs.writeFileSync(flowPath, `${JSON.stringify(stagedState, null, 2)}\n`);
    git(root, ["add", flowRel]);
    const stagedBlob = git(root, ["rev-parse", `:${flowRel}`]);
    fs.writeFileSync(flowPath, originalFlow);
    const indexBefore = fs.readFileSync(path.join(root, ".git", "index"));
    const headBefore = git(root, ["rev-parse", "HEAD"]);
    const hook = path.join(root, ".git", "hooks", "pre-commit");
    fs.writeFileSync(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });

    const failed = await runFinalize(root, specId);

    assert.equal(failed.ok, false, JSON.stringify(failed));
    assert.equal(failed.errors[0].code, "COMMIT_FAILED");
    assert.equal(git(root, ["rev-parse", "HEAD"]), headBefore);
    assert.equal(git(root, ["rev-parse", `:${flowRel}`]), stagedBlob);
    assert.deepEqual(fs.readFileSync(path.join(root, ".git", "index")), indexBefore);
    assert.deepEqual(fs.readFileSync(flowPath), originalFlow);
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    assert.equal(journal.phase, "prepared");
    assert.deepEqual(journal.beforeImages, []);
  } finally {
    removeTmpDir(root);
  }
});

test("successful isolated commit preserves a genuine preexisting staged blob", async () => {
  const root = createTmpDir("finalize-isolated-index-staged-success-");
  try {
    initGitRepo(root);
    const specId = "185";
    setupFinalizeFlow(root, specId);
    const flowRel = `specs/${specId}/flow.json`;
    const flowPath = path.join(root, flowRel);
    const originalFlow = fs.readFileSync(flowPath);
    const stagedState = JSON.parse(originalFlow.toString("utf8"));
    stagedState.callerStaged = "preserve-after-success";
    fs.writeFileSync(flowPath, `${JSON.stringify(stagedState, null, 2)}\n`);
    git(root, ["add", flowRel]);
    const stagedBlob = git(root, ["rev-parse", `:${flowRel}`]);
    fs.writeFileSync(flowPath, originalFlow);

    const completed = await runFinalize(root, specId);

    assert.equal(completed.ok, true, JSON.stringify(completed));
    assert.equal(git(root, ["rev-parse", `:${flowRel}`]), stagedBlob);
    assert.notEqual(git(root, ["rev-parse", `HEAD:${flowRel}`]), stagedBlob);
  } finally {
    removeTmpDir(root);
  }
});

test("post-commit isolated-index cleanup failure retains commit authority for retry", async () => {
  const root = createTmpDir("finalize-post-commit-index-cleanup-");
  try {
    initGitRepo(root);
    const specId = "186";
    setupFinalizeFlow(root, specId);
    const headBefore = git(root, ["rev-parse", "HEAD"]);
    const originalUnlink = fs.unlinkSync;
    let injected = false;
    fs.unlinkSync = (target, ...args) => {
      if (!injected && String(target).endsWith(`${path.sep}commit.index`)) {
        injected = true;
        throw Object.assign(new Error("injected isolated index cleanup failure"), { code: "EIO" });
      }
      return originalUnlink(target, ...args);
    };
    try {
      await assert.rejects(
        () => runFinalize(root, specId),
        (error) => error instanceof AggregateError
          && error.errors[0].message === "injected isolated index cleanup failure",
      );
    } finally {
      fs.unlinkSync = originalUnlink;
    }
    assert.equal(injected, true);
    assert.notEqual(git(root, ["rev-parse", "HEAD"]), headBefore);
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "commit-durable");

    const retried = await runFinalize(root, specId);
    assert.equal(retried.ok, true, JSON.stringify(retried));
  } finally {
    removeTmpDir(root);
  }
});

for (const fault of ["first-journal", "before-images", "flow-write", "expectation-journal"]) {
  test(`${fault} fault restores the prepared transaction and retries cleanly`, async () => {
    const root = createTmpDir(`finalize-prepared-${fault}-`);
    try {
      initGitRepo(root);
      const specId = `17${["first-journal", "before-images", "flow-write", "expectation-journal"].indexOf(fault)}`;
      setupFinalizeFlow(root, specId);
      const before = preCommitSnapshot(root, specId);
      const originalWrite = AtomicJsonFile.prototype.write;
      const flowManager = makeFlowManager(root);
      const originalMutate = flowManager.mutate.bind(flowManager);
      let injected = false;
      if (fault === "flow-write") {
        flowManager.mutate = (...args) => {
          const result = originalMutate(...args);
          if (!injected) {
            injected = true;
            throw new Error("injected flow write fault");
          }
          return result;
        };
      } else {
        AtomicJsonFile.prototype.write = function injectPreparedFault(value) {
          const isFinalizeJournal = this.filePath.includes(`${path.sep}recovery${path.sep}finalize-cleanup${path.sep}`);
          const matches = isFinalizeJournal && (
            (fault === "first-journal" && value?.beforeImages?.length === 0 && !value?.commitExpectation)
            || (fault === "before-images" && value?.beforeImages?.length === 2 && !value?.commitExpectation)
            || (fault === "expectation-journal" && value?.commitExpectation)
          );
          if (!injected && matches) {
            injected = true;
            if (fault === "expectation-journal") originalWrite.call(this, value);
            throw new Error(`injected ${fault} fault`);
          }
          return originalWrite.call(this, value);
        };
      }
      try {
        await assert.rejects(() => runFinalize(root, specId, { flowManager }));
      } finally {
        AtomicJsonFile.prototype.write = originalWrite;
      }
      assert.equal(injected, true);
      assertPreCommitSnapshot(root, specId, before);
      if (recoveryJournals(root).length > 0) {
        assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "prepared");
      }
      const retried = await runFinalize(root, specId);
      assert.equal(retried.ok, true, JSON.stringify(retried));
    } finally {
      removeTmpDir(root);
    }
  });
}

const FINALIZE_GIT_FAULTS = [
  "expected-tree",
  "isolated-read-tree",
  "isolated-add",
  "isolated-write-tree",
];

for (const fault of FINALIZE_GIT_FAULTS) {
  test(`${fault} Git fault preserves caller state and retries through a fresh isolated index`, async () => {
    const root = createTmpDir(`finalize-git-fault-${fault}-`);
    const oldPath = process.env.PATH;
    try {
      initGitRepo(root);
      const specId = `18${FINALIZE_GIT_FAULTS.indexOf(fault)}`;
      setupFinalizeFlow(root, specId);
      const before = preCommitSnapshot(root, specId);
      const bin = path.join(root, "fault-bin");
      fs.mkdirSync(bin);
      const wrapper = path.join(bin, "git");
      const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
      const indexSelector = fault === "expected-tree"
        ? "*/expected.index"
        : "*/commit.index";
      const commandSelector = fault === "isolated-read-tree"
        ? "read-tree"
        : fault === "isolated-add"
          ? "add"
          : "write-tree";
      fs.writeFileSync(wrapper, [
        "#!/bin/sh",
        `case \"$GIT_INDEX_FILE\" in ${indexSelector})`,
        `  case \" $* \" in *\" ${commandSelector} \"*) echo injected-${fault} >&2; exit 73;; esac`,
        "esac",
        `exec ${JSON.stringify(realGit)} \"$@\"`,
        "",
      ].join("\n"), { mode: 0o755 });
      process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
      let result = null;
      let rejection = null;
      try {
        result = await runFinalize(root, specId);
      } catch (error) {
        rejection = error;
      } finally {
        process.env.PATH = oldPath;
      }
      assert.ok(rejection || result?.ok === false, JSON.stringify(result));
      assertPreCommitSnapshot(root, specId, before);
      const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
      assert.equal(journal.phase, "prepared");
      assert.deepEqual(journal.beforeImages, []);
      const retried = await runFinalize(root, specId);
      assert.equal(retried.ok, true, JSON.stringify(retried));
    } finally {
      process.env.PATH = oldPath;
      removeTmpDir(root);
    }
  });
}

test("isolated finalize index is private, temporary, and reconciles a clean caller index", async () => {
  const root = createTmpDir("finalize-private-index-");
  const oldPath = process.env.PATH;
  try {
    initGitRepo(root);
    const specId = "184";
    setupFinalizeFlow(root, specId);
    const before = preCommitSnapshot(root, specId);
    const bin = path.join(root, "index-observer-bin");
    const marker = path.join(root, "isolated-index-observed");
    fs.mkdirSync(bin);
    const wrapper = path.join(bin, "git");
    const realGit = execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
    fs.writeFileSync(wrapper, [
      "#!/bin/sh",
      "case \"$GIT_INDEX_FILE\" in */commit.index)",
      "  case \" $* \" in *\" add \"*)",
      "    test -f \"$GIT_INDEX_FILE\" || exit 74",
      "    test \"$(stat -c %a \"$GIT_INDEX_FILE\")\" = 600 || exit 75",
      `    printf '%s\\n' \"$GIT_INDEX_FILE\" > ${JSON.stringify(marker)}`,
      "  ;; esac",
      "esac",
      `exec ${JSON.stringify(realGit)} "$@"`,
      "",
    ].join("\n"), { mode: 0o755 });
    process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
    const completed = await runFinalize(root, specId);
    process.env.PATH = oldPath;

    assert.equal(completed.ok, true, JSON.stringify(completed));
    const tempIndex = fs.readFileSync(marker, "utf8").trim();
    assert.equal(fs.existsSync(tempIndex), false);
    assert.equal(fs.existsSync(`${tempIndex}.lock`), false);
    assert.notDeepEqual(fs.readFileSync(path.join(root, ".git", "index")), before.index);
    assert.equal(git(root, ["status", "--porcelain", "--", `specs/${specId}`]), "");
  } finally {
    process.env.PATH = oldPath;
    removeTmpDir(root);
  }
});

test("plugin artifact and retained metadata fault restores main and worktree trees exactly", async () => {
  const root = createTmpDir("finalize-plugin-metadata-fault-");
  try {
    initGitRepo(root);
    const specId = "183";
    const fixture = setupWorktreeFinalizeFlow(root, specId);
    const pluginId = "finalize-fault";
    const pluginRoot = path.join(root, ".senti", "plugins", pluginId);
    fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
    fs.writeFileSync(path.join(root, ".senti", "config.json"), `${JSON.stringify({
      plugin: { packages: [{ id: pluginId }] },
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(pluginRoot, "hooks", "finalize.js"), `
      export default function register(api) {
        return class FinalizeFaultHook extends api.FlowCommandHook {
          static command = "finalize-cleanup";
          static hook = "pre";
          async run(context) {
            await context.artifacts.writeText("partial.txt", "partial plugin output");
            await context.artifacts.writeText("flow.json", "nested plugin flow output");
            await context.artifacts.writeText("issue-log.json", "nested plugin issue output");
            return context.envelope.ok("plugin-hook", "finalize-cleanup", {});
          }
        };
      }
    `);
    fixture.state.plugins = { flowCommandHooks: [{
      apiVersion: 1,
      pluginId,
      module: "hooks/finalize.js",
      className: "FinalizeFaultHook",
      command: "finalize-cleanup",
      hook: "pre",
      priority: 0,
    }] };
    fixture.state.metrics = [{ name: "fault-metric", value: 1 }];
    replaceFlowState(fixture.worktreePath, fixture.state, { specId });
    git(fixture.worktreePath, ["add", `specs/${specId}/flow.json`]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "record plugin snapshot"]);
    const nestedArtifactRoot = path.join(root, "specs", specId, "plugin-artifacts");
    const nestedFlow = path.join(nestedArtifactRoot, "flow.json");
    const nestedIssueLog = path.join(nestedArtifactRoot, "issue-log.json");
    const cleanupSidecarRoot = path.join(
      root,
      ".senti",
      "agent-work",
      "finalize-cleanup",
      specId,
    );
    fs.mkdirSync(nestedArtifactRoot, { recursive: true });
    fs.writeFileSync(nestedFlow, "original nested flow\n");
    fs.writeFileSync(nestedIssueLog, "original nested issue log\n");
    const mainBefore = preCommitSnapshot(root, specId);
    const worktreeBefore = specTreeSnapshot(fixture.worktreePath, specId);
    const originalWrite = fs.writeFileSync;
    let injected = false;
    fs.writeFileSync = (target, ...args) => {
      const result = originalWrite(target, ...args);
      if (!injected && String(target).endsWith("agent-metrics.json")) {
        injected = true;
        originalWrite(nestedFlow, "mutated nested flow\n");
        originalWrite(nestedIssueLog, "mutated nested issue log\n");
        throw new Error("injected retained metadata fault");
      }
      return result;
    };
    try {
      await assert.rejects(
        () => runFinalize(root, specId, { flowManager: fixture.flowManager, flowState: fixture.state }),
        /retained metadata fault/,
      );
    } finally {
      fs.writeFileSync = originalWrite;
    }
    assert.equal(injected, true);
    assertPreCommitSnapshot(root, specId, mainBefore);
    assert.deepEqual(specTreeSnapshot(fixture.worktreePath, specId), worktreeBefore);
    assert.equal(fs.existsSync(cleanupSidecarRoot), false);
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    assert.equal(journal.phase, "prepared");
    assert.deepEqual(journal.beforeImages, []);
    const retried = await runFinalize(root, specId, { flowManager: fixture.flowManager, flowState: fixture.state });
    assert.equal(retried.ok, true, JSON.stringify(retried));
  } finally {
    removeTmpDir(root);
  }
});

test("plugin lifecycle exceptions fail-stop and restore the prepared tree", async () => {
  const root = createTmpDir("finalize-plugin-lifecycle-fail-stop-");
  try {
    initGitRepo(root);
    const specId = "188";
    const fixture = setupFinalizeFlow(root, specId);
    const pluginId = "finalize-throw";
    const pluginRoot = path.join(root, ".senti", "plugins", pluginId);
    fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
    fs.writeFileSync(path.join(root, ".senti", "config.json"), `${JSON.stringify({
      plugin: { packages: [{ id: pluginId }] },
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(pluginRoot, "hooks", "finalize.js"), `
      export default function register(api) {
        return class FinalizeThrowHook extends api.FlowCommandHook {
          static command = "finalize-cleanup";
          static hook = "pre";
          async run(context) {
            await context.artifacts.writeText("partial.txt", "must be rolled back");
            throw new Error("injected plugin lifecycle failure");
          }
        };
      }
    `);
    fixture.state.plugins = { flowCommandHooks: [{
      apiVersion: 1,
      pluginId,
      module: "hooks/finalize.js",
      className: "FinalizeThrowHook",
      command: "finalize-cleanup",
      hook: "pre",
      priority: 0,
    }] };
    replaceFlowState(root, fixture.state, { specId });
    git(root, ["add", `specs/${specId}/flow.json`]);
    git(root, ["commit", "--quiet", "-m", "record failing plugin"]);
    const before = preCommitSnapshot(root, specId);

    const stopped = await runFinalize(root, specId, { flowState: fixture.state });

    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "PLUGIN_LIFECYCLE_FAILED");
    assertPreCommitSnapshot(root, specId, before);
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    assert.equal(journal.phase, "prepared");
    assert.deepEqual(journal.beforeImages, []);
  } finally {
    removeTmpDir(root);
  }
});

test("successful finalize keeps retained metadata in the durable sidecar and the spec tree clean", async () => {
  const root = createTmpDir("finalize-retained-metadata-commit-");
  try {
    initGitRepo(root);
    const specId = "187";
    const fixture = setupWorktreeFinalizeFlow(root, specId);
    fixture.state.metrics = [{ name: "committed-metric", value: 1 }];
    replaceFlowState(fixture.worktreePath, fixture.state, { specId });
    git(fixture.worktreePath, ["add", `specs/${specId}/flow.json`]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "record retained metadata"]);

    const completed = await runFinalize(root, specId, {
      flowManager: fixture.flowManager,
      flowState: fixture.state,
    });

    assert.equal(completed.ok, true, JSON.stringify(completed));
    assert.equal(git(root, ["status", "--porcelain", "--", `specs/${specId}`]), "");
    assert.doesNotMatch(
      git(root, ["ls-tree", "-r", "--name-only", "HEAD", `specs/${specId}`]),
      /agent-metrics\.json/,
    );
    const sidecarPath = path.join(
      root,
      ".senti",
      "agent-work",
      "finalize-cleanup",
      specId,
      "agent-metrics.json",
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(sidecarPath, "utf8")), {
      version: 1,
      entries: fixture.state.metrics,
    });
  } finally {
    removeTmpDir(root);
  }
});

test("feature branch deletion uses the expected old OID as a compare-and-swap", () => {
  const root = createTmpDir("finalize-branch-delete-cas-");
  try {
    initGitRepo(root);
    const featureBranch = "feature/cas";
    git(root, ["branch", featureBranch]);
    const expectedSha = git(root, ["rev-parse", featureBranch]);
    const tree = git(root, ["rev-parse", `${expectedSha}^{tree}`]);
    const replacement = git(root, ["commit-tree", tree, "-p", expectedSha, "-m", "concurrent ref move"]);
    let moved = false;
    const result = deleteFeatureBranchForCleanup({
      mainRepoPath: root,
      featureBranch,
      expectedSha,
      runGit(args) {
        if (!moved && args.includes("update-ref")) {
          moved = true;
          git(root, ["update-ref", `refs/heads/${featureBranch}`, replacement, expectedSha]);
        }
        try {
          return { ok: true, stdout: git(root, args.slice(2)), stderr: "" };
        } catch (error) {
          return { ok: false, stdout: error.stdout?.toString() || "", stderr: error.stderr?.toString() || error.message };
        }
      },
    });

    assert.equal(moved, true);
    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(git(root, ["rev-parse", featureBranch]), replacement);
  } finally {
    removeTmpDir(root);
  }
});

test("retains a completed tombstone and makes completed retry idempotent", async () => {
  const root = createTmpDir("finalize-completed-tombstone-");
  try {
    initGitRepo(root);
    const specId = "156";
    const fixture = setupFinalizeFlow(root, specId);
    const recoveryDirectory = path.join(root, ".senti", "recovery", "finalize-cleanup");
    const originalUnlink = fs.unlinkSync;
    fs.unlinkSync = (target, ...args) => {
      if (path.dirname(path.resolve(String(target))) === recoveryDirectory && String(target).endsWith(".json")) {
        const error = new Error("injected journal unlink failure");
        error.code = "EIO";
        throw error;
      }
      return originalUnlink(target, ...args);
    };
    let completed;
    try {
      completed = await runFinalize(root, specId);
    } finally {
      fs.unlinkSync = originalUnlink;
    }

    assert.equal(completed.ok, true, JSON.stringify(completed));
    const journalPath = assertCompletedJournal(root);
    const head = git(root, ["rev-parse", "HEAD"]);
    const retry = await runFinalize(root, specId, { flowState: fixture.state });
    assert.equal(retry.ok, true, JSON.stringify(retry));
    assert.equal(git(root, ["rev-parse", "HEAD"]), head);
    assert.equal(assertCompletedJournal(root), journalPath);
  } finally {
    removeTmpDir(root);
  }
});

test("preserves commit and exact-restore failures in primary-first order with durable residue", async () => {
  const root = createTmpDir("finalize-commit-rollback-order-");
  try {
    initGitRepo(root);
    const specId = "157";
    setupFinalizeFlow(root, specId);
    const hook = path.join(root, ".git", "hooks", "pre-commit");
    const commitFailedMarker = path.join(root, ".git", "finalize-commit-failed");
    fs.writeFileSync(hook, [
      "#!/bin/sh",
      `touch ${JSON.stringify(commitFailedMarker)}`,
      "exit 1",
      "",
    ].join("\n"), { mode: 0o755 });
    const originalRename = fs.renameSync;
    let injected = false;
    fs.renameSync = (source, target) => {
      const restoringFlowState = path.basename(String(source)).startsWith(".flow.json.")
        && path.basename(String(target)) === "flow.json"
        && fs.existsSync(commitFailedMarker);
      if (!injected && restoringFlowState) {
        injected = true;
        throw new Error("injected exact restore failure");
      }
      return originalRename(source, target);
    };

    try {
      await assert.rejects(
        () => runFinalize(root, specId),
        (error) => error instanceof AggregateError
          && error.errors.length === 2
          && error.errors[0].code === "COMMIT_FAILED"
          && error.errors[1].message === "injected exact restore failure"
          && error.cause === error.errors[0],
      );
    } finally {
      fs.renameSync = originalRename;
    }
    const journal = JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8"));
    assert.equal(journal.phase, "prepared");
    assert.equal(journal.beforeImages.length, 2);
    fs.unlinkSync(hook);
    const retried = await runFinalize(root, specId);
    assert.equal(retried.ok, true, JSON.stringify(retried));
  } finally {
    removeTmpDir(root);
  }
});

async function seedForcedPointerFailure(root, specId) {
  const fixture = setupFinalizeFlow(root, specId);
  fixture.state.state = {};
  replaceFlowState(root, fixture.state, { specId });
  git(root, ["add", `specs/${specId}/flow.json`]);
  git(root, ["commit", "--quiet", "-m", "record missing finalize route"]);
  const pointerPath = path.join(root, ".senti", "last-finalized-spec");
  fs.mkdirSync(pointerPath);
  const failed = await runFinalize(root, specId, { flowState: fixture.state, force: true });
  assert.equal(failed.ok, false, JSON.stringify(failed));
  assert.equal(failed.errors[0].code, "FINALIZE_POINTER_WRITE_FAILED");
  return { ...fixture, pointerPath };
}

test("forced teardown resumes without a new CLI force approval and preserves audit provenance", async () => {
  const root = createTmpDir("finalize-forced-provenance-resume-");
  try {
    initGitRepo(root);
    const specId = "166";
    const fixture = await seedForcedPointerFailure(root, specId);
    const journalPath = recoveryJournal(root);
    const before = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    assert.equal(before.authorization.route, "forced");
    assert.equal(before.authorization.forceAuthorized, true);
    assert.equal(typeof before.authorization.auditId, "string");
    fs.rmdirSync(fixture.pointerPath);
    const head = git(root, ["rev-parse", "HEAD"]);

    const retried = await runFinalize(root, specId, { flowState: fixture.state, force: false });

    assert.equal(retried.ok, true, JSON.stringify(retried));
    const completedHead = git(root, ["rev-parse", "HEAD"]);
    assert.notEqual(completedHead, head);
    assert.equal(git(root, ["log", "-1", "--format=%s"]), "chore: complete finalize cleanup");
    assert.equal(retried.data.forceAuthorization.auditId, before.authorization.auditId);
    assert.equal(retried.data.forceAuthorization.mergeStrategy, null);
    assert.equal(retried.errors.some((error) => error.code === "FORCED_ORPHAN_DROP"), true);
    const entries = JSON.parse(fs.readFileSync(path.join(root, "specs", specId, "issue-log.json"), "utf8")).entries;
    assert.equal(entries.filter((entry) => entry.issueLogId === before.authorization.auditId).length, 1);
    const completed = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    assert.equal(completed.phase, "completed");
    assert.deepEqual(completed.authorization, before.authorization);

    const repeated = await runFinalize(root, specId, { flowState: fixture.state, force: false });
    assert.equal(repeated.ok, true, JSON.stringify(repeated));
    assert.equal(git(root, ["rev-parse", "HEAD"]), completedHead);
  } finally {
    removeTmpDir(root);
  }
});

test("rejects a journal whose forced authorization is not internally approved", async () => {
  const root = createTmpDir("finalize-forced-authorization-invalid-");
  try {
    initGitRepo(root);
    const specId = "167";
    const fixture = await seedForcedPointerFailure(root, specId);
    const journalPath = recoveryJournal(root);
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    journal.authorization.forceAuthorized = false;
    fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    fs.rmdirSync(fixture.pointerPath);
    const before = {
      journal: fs.readFileSync(journalPath),
      active: fs.readFileSync(path.join(root, ".senti", ".active-flow")),
      head: git(root, ["rev-parse", "HEAD"]),
    };

    await assert.rejects(() => runFinalize(root, specId, { flowState: fixture.state }), /forced.*authorization|approval|incomplete/i);

    assert.deepEqual(fs.readFileSync(journalPath), before.journal);
    assert.deepEqual(fs.readFileSync(path.join(root, ".senti", ".active-flow")), before.active);
    assert.equal(git(root, ["rev-parse", "HEAD"]), before.head);
  } finally {
    removeTmpDir(root);
  }
});

for (const phase of ["branch-deleted", "validated", "pointer-written", "active-cleared"]) {
  test(`rejects ${phase} journal when its external completion reality diverges`, async () => {
    const root = createTmpDir(`finalize-${phase}-reality-`);
    try {
      initGitRepo(root);
      const specId = phase === "branch-deleted" ? "158" : phase === "validated" ? "159" : phase === "pointer-written" ? "160" : "163";
      const fixture = await seedPointerFailure(root, specId);
      const journalPath = recoveryJournal(root);
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
      journal.phase = phase;
      journal.result.phase = phase;
      journal.result.ok = true;
      journal.result.code = null;
      fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
      if (phase === "branch-deleted" || phase === "validated") {
        git(root, ["branch", fixture.featureBranch, journal.commitExpectation.featureRef]);
        fs.rmdirSync(fixture.pointerPath);
      } else if (phase === "pointer-written") {
        assert.equal(fs.statSync(fixture.pointerPath).isDirectory(), true);
      } else {
        fs.rmdirSync(fixture.pointerPath);
        fs.writeFileSync(fixture.pointerPath, `${fixture.spec}\n`);
      }
      const before = {
        head: git(root, ["rev-parse", "HEAD"]),
        active: fs.readFileSync(path.join(root, ".senti", ".active-flow")),
        journal: fs.readFileSync(journalPath),
      };

      await assert.rejects(() => runFinalize(root, specId), /reality|pointer|active|branch|teardown|authority|diverg/i);

      assert.equal(git(root, ["rev-parse", "HEAD"]), before.head);
      assert.deepEqual(fs.readFileSync(path.join(root, ".senti", ".active-flow")), before.active);
      assert.deepEqual(fs.readFileSync(journalPath), before.journal);
    } finally {
      removeTmpDir(root);
    }
  });
}

test("rejects worktree-removed journal while the authorized worktree still exists", async () => {
  const root = createTmpDir("finalize-worktree-removed-reality-");
  try {
    initGitRepo(root);
    const specId = "164";
    const fixture = setupWorktreeFinalizeFlow(root, specId);
    git(root, ["worktree", "lock", fixture.worktreePath]);
    const failed = await runFinalize(root, specId, { flowManager: fixture.flowManager, flowState: fixture.state });
    assert.equal(failed.errors[0].code, "WORKTREE_REMOVE_FAILED");
    const journalPath = recoveryJournal(root);
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    journal.phase = "worktree-removed";
    journal.result.phase = "worktree-removed";
    journal.result.ok = true;
    journal.result.code = null;
    fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    const before = fs.readFileSync(journalPath);

    await assert.rejects(
      () => runFinalize(root, specId, { flowManager: fixture.flowManager, flowState: fixture.state }),
      /worktree reality|worktree.*remain|persisted/i,
    );

    assert.deepEqual(fs.readFileSync(journalPath), before);
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.equal(git(root, ["rev-parse", fixture.featureBranch]), journal.commitExpectation.featureRef);
  } finally {
    removeTmpDir(root);
  }
});

test("Git teardown probe failures do not advance or rewrite the durable journal", async () => {
  const root = createTmpDir("finalize-validation-probe-failure-");
  const oldPath = process.env.PATH;
  try {
    initGitRepo(root);
    const specId = "165";
    const fixture = await seedPointerFailure(root, specId);
    fs.rmdirSync(fixture.pointerPath);
    const journalPath = recoveryJournal(root);
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    journal.phase = "branch-deleted";
    journal.result.phase = "branch-deleted";
    journal.result.ok = true;
    journal.result.code = null;
    fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    const bin = path.join(root, "probe-bin");
    fs.mkdirSync(bin);
    const gitWrapper = path.join(bin, "git");
    fs.writeFileSync(gitWrapper, [
      "#!/bin/sh",
      "case \" $* \" in",
      "  *\" worktree list \"*|*\" branch --list \"*) echo injected validation probe failure >&2; exit 2;;",
      "esac",
      `exec ${JSON.stringify(execFileSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).trim())} \"$@\"`,
      "",
    ].join("\n"), { mode: 0o755 });
    process.env.PATH = `${bin}${path.delimiter}${oldPath}`;
    const before = {
      journal: fs.readFileSync(journalPath),
      active: fs.readFileSync(path.join(root, ".senti", ".active-flow")),
      head: git(root, ["rev-parse", "HEAD"]),
      branches: git(root, ["branch", "--format=%(refname)"]),
    };

    const result = await runFinalize(root, specId);

    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.errors[0].code, "TEARDOWN_VALIDATION_PROBE_FAILED");
    assert.deepEqual(fs.readFileSync(journalPath), before.journal);
    assert.deepEqual(fs.readFileSync(path.join(root, ".senti", ".active-flow")), before.active);
    assert.equal(git(root, ["rev-parse", "HEAD"]), before.head);
    assert.equal(git(root, ["branch", "--format=%(refname)"]), before.branches);
  } finally {
    process.env.PATH = oldPath;
    removeTmpDir(root);
  }
});
