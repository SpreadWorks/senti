// spec: R1 R2 R3 R4 R5 R6
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager, replaceFlowState, setupFlow } from "../../../tests/helpers/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { FlowOutboxStore, finalizationOutboxIdentity } from "../../../src/flow/lib/flow-outbox.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from "../../../src/lib/worktree-flow-binding.js";
import { runPreSync } from "../../../src/flow/commands/merge.js";

let root;
let origin;
afterEach(() => {
  if (root) removeTmpDir(root);
  if (origin) removeTmpDir(origin);
  root = null;
  origin = null;
});

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function specIdFromState(state) {
  return path.basename(path.dirname(state.spec));
}

function flowPath(specId) {
  return path.join(root, "specs", specId, "flow.json");
}

function activateMerge(manager) {
  manager.mutate((state) => {
    let active = false;
    for (const step of flattenSteps(state.steps)) {
      if (step.id === "finalize-merge") {
        step.status = "in_progress";
        active = true;
      } else {
        step.status = active ? "pending" : "done";
      }
    }
  });
  return manager.load();
}

function setupConflictFlow() {
  root = createTmpDir("spec-478-finalize-merge-conflict-");
  git("init", "--quiet", root);
  git("-C", root, "config", "user.email", "test@example.com");
  git("-C", root, "config", "user.name", "Test User");
  setupFlow(root, { spec: "specs/test-spec/spec.json" });
  git("-C", root, "add", ".");
  git("-C", root, "commit", "--quiet", "-m", "test: initial flow");
  const manager = makeFlowManager(root);
  const state = activateMerge(manager);
  new FlowOutboxStore(manager).begin(finalizationOutboxIdentity(state, "finalize-merge"));
  return {
    manager,
    state: manager.load(),
    specId: specIdFromState(state),
    head: git("-C", root, "rev-parse", "HEAD").trim(),
  };
}

async function failMerge() {
  const { manager, state, specId, head } = setupConflictFlow();
  const error = new Error("pre-merge rebase conflict; run git rebase --continue");
  await FLOW_COMMANDS.run["finalize-merge"].onError({
    flowManager: manager,
    flowState: state,
    root,
    specId,
  }, error);
  return { manager, specId, error, head };
}

function lastCommitFiles(cwd = root) {
  return git("-C", cwd, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")
    .trim()
    .split("\n")
    .filter(Boolean)
    .sort();
}

test("R1: commits conflict metadata before returning a recovery instruction", async () => {
  const { error, specId, head } = await failMerge();
  assert.equal(git("-C", root, "rev-parse", "HEAD^").trim(), head);
  assert.deepEqual(lastCommitFiles(), [
    `specs/${specId}/flow.json`,
    `specs/${specId}/issue-log.json`,
  ]);
  assert.equal(git("-C", root, "status", "--porcelain").trim(), "");
  assert.match(error.message, /git rebase --continue/);
});

test("R2: records the failed outbox and skipped downstream steps in metadata only", async () => {
  const { manager, specId } = await failMerge();
  assert.deepEqual(lastCommitFiles(), [
    `specs/${specId}/flow.json`,
    `specs/${specId}/issue-log.json`,
  ]);
  const persistedFlow = JSON.parse(git("-C", root, "show", `HEAD:specs/${specId}/flow.json`));
  const persistedIssueLog = JSON.parse(git("-C", root, "show", `HEAD:specs/${specId}/issue-log.json`));
  assert.equal(persistedFlow.outbox[0].status, "failed");
  assert.equal(findStepById(persistedFlow.steps, "finalize-sync").status, "skipped");
  assert.equal(findStepById(persistedFlow.steps, "finalize-cleanup").status, "skipped");
  assert.match(persistedFlow.outbox[0].failure, /pre-merge rebase conflict/);
  assert.deepEqual(persistedFlow.outbox[0].failureHistory.map(({ attempt, failure }) => ({ attempt, failure })), [
    { attempt: 1, failure: "pre-merge rebase conflict; run git rebase --continue" },
  ]);
  assert.match(JSON.stringify(persistedIssueLog), /pre-merge rebase conflict/);

  const retryState = manager.load();
  await FLOW_COMMANDS.run["finalize-merge"].pre({ flowManager: manager, flowState: retryState, root, specId });
  new FlowOutboxStore(manager).begin(finalizationOutboxIdentity(manager.load(), "finalize-merge"));
  await FLOW_COMMANDS.run["finalize-merge"].post({
    flowManager: manager,
    flowState: manager.load(),
    root,
    specId,
  }, { status: "done", strategy: "squash", mergedFromSha: "retry-merge" });
  const mainSnapshot = manager.load();
  assert.equal(mainSnapshot.outbox[0].status, "done");
  assert.match(fs.readFileSync(path.join(root, "specs", specId, "issue-log.json"), "utf8"), /pre-merge rebase conflict/);
});

test("R3: rejects external dirtiness without mutating Flow recovery metadata", async () => {
  const { manager, state, specId } = setupConflictFlow();
  const externalPath = "src/external.js";
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, externalPath), "external\n");
  const head = git("-C", root, "rev-parse", "HEAD").trim();
  const beforeFlow = fs.readFileSync(flowPath(specId), "utf8");
  const beforeState = manager.load();
  const expectedStatus = git("-C", root, "status", "--short", "--", externalPath).trim();

  await assert.rejects(
    () => FLOW_COMMANDS.run["finalize-merge"].onError({
      flowManager: manager,
      flowState: state,
      root,
      specId,
    }, new Error("pre-merge rebase conflict")),
    (err) => {
      assert.ok(err.message.includes(externalPath));
      assert.ok(err.message.includes(expectedStatus));
      assert.ok(err.message.includes("senti flow run finalize-merge"));
      return true;
    },
  );
  assert.equal(git("-C", root, "rev-parse", "HEAD").trim(), head);
  assert.equal(fs.readFileSync(flowPath(specId), "utf8"), beforeFlow);
  assert.deepEqual(manager.load().outbox, beforeState.outbox);
  assert.deepEqual(manager.load().steps, beforeState.steps);
});

test("R4: retry persists the downstream reset in one additional metadata commit", async () => {
  const { manager, specId } = await failMerge();
  const retryState = manager.load();
  await FLOW_COMMANDS.run["finalize-merge"].pre({
    flowManager: manager,
    flowState: retryState,
    root,
    specId,
  });

  // Retrying records a new pending outbox attempt before the merge command
  // executes. That Flow-owned state is intentionally left for the normal
  // merge lifecycle rather than creating a second metadata-only commit.
  assert.equal(git("-C", root, "status", "--porcelain").trim(), `M specs/${specId}/flow.json`);
  assert.equal(Number(git("-C", root, "rev-list", "--count", "HEAD").trim()), 3);
  new FlowOutboxStore(manager).begin(finalizationOutboxIdentity(manager.load(), "finalize-merge"));
  await FLOW_COMMANDS.run["finalize-merge"].post({
    flowManager: manager,
    flowState: manager.load(),
    root,
    specId,
  }, { status: "done", strategy: "squash", mergedFromSha: "retry-merge" });
  const state = manager.load();
  assert.equal(findStepById(state.steps, "finalize-merge").status, "done");
  assert.equal(state.outbox.filter((entry) => entry.status === "done").length, 1);
  assert.equal(state.outbox[0].attempt, 2);
  assert.equal(findStepById(state.steps, "finalize-sync").status, "pending");
  assert.equal(findStepById(state.steps, "finalize-cleanup").status, "pending");
});

test("R5: a clean normal merge preparation does not use a metadata-only commit", async () => {
  root = createTmpDir("spec-478-finalize-merge-normal-");
  git("init", "--quiet", root);
  git("-C", root, "config", "user.email", "test@example.com");
  git("-C", root, "config", "user.name", "Test User");
  const initial = setupFlow(root, { spec: "specs/test-spec/spec.json" });
  git("-C", root, "add", ".");
  git("-C", root, "commit", "--quiet", "-m", "test: initial flow");
  const manager = makeFlowManager(root);
  const state = activateMerge(manager);
  const specId = specIdFromState(initial);
  const before = git("-C", root, "rev-parse", "HEAD").trim();
  await FLOW_COMMANDS.run["finalize-merge"].pre({
    flowManager: manager,
    flowState: state,
    root,
    specId,
  });
  assert.equal(git("-C", root, "rev-parse", "HEAD").trim(), before);
  assert.equal(git("-C", root, "status", "--porcelain").trim(), `M specs/${specId}/flow.json`);
});

test("R6: makes the conflict recovery transaction executable in a real feature worktree", async () => {
  root = createTmpDir("spec-478-finalize-merge-rebase-");
  origin = createTmpDir("spec-478-finalize-merge-origin-");
  git("init", "--quiet", "--initial-branch=main", root);
  git("-C", root, "config", "user.email", "test@example.com");
  git("-C", root, "config", "user.name", "Test User");
  fs.writeFileSync(path.join(root, "conflict.txt"), "base\n");
  git("-C", root, "add", ".");
  git("-C", root, "commit", "--quiet", "-m", "base");
  git("init", "--quiet", "--bare", origin);
  git("-C", root, "remote", "add", "origin", origin);
  git("-C", root, "push", "--quiet", "-u", "origin", "main");
  const worktreePath = path.join(root, ".senti", "worktree", "feature-test");
  git("-C", root, "worktree", "add", "--quiet", "-b", "feature/test", worktreePath);
  fs.writeFileSync(path.join(worktreePath, "conflict.txt"), "feature\n");
  git("-C", worktreePath, "commit", "--all", "--quiet", "-m", "feature change");
  fs.writeFileSync(path.join(root, "conflict.txt"), "main\n");
  git("-C", root, "commit", "--all", "--quiet", "-m", "main change");
  git("-C", root, "push", "--quiet", "origin", "main");

  const detected = runPreSync({
    worktreePath,
    baseBranch: "main",
    featureBranch: "feature/test",
    remote: "origin",
  });
  assert.equal(detected.ok, false);
  assert.ok(detected.conflictFiles.includes("conflict.txt"));
  assert.match(detected.recoveryHint, /git rebase --continue/);
  assert.equal(git("-C", worktreePath, "status", "--porcelain").trim(), "");

  assert.throws(() => git("-C", worktreePath, "rebase", "main"));
  fs.writeFileSync(path.join(worktreePath, "conflict.txt"), "resolved\n");
  git("-C", worktreePath, "add", "conflict.txt");
  execFileSync("git", ["-C", worktreePath, "rebase", "--continue"], {
    encoding: "utf8",
    env: { ...process.env, GIT_EDITOR: "true" },
  });
  assert.equal(git("-C", worktreePath, "status", "--porcelain").trim(), "");
  setupFlow(worktreePath, { spec: "specs/test-spec/spec.json" });
  git("-C", worktreePath, "add", ".");
  git("-C", worktreePath, "commit", "--quiet", "-m", "record retry flow");
  const manager = makeFlowManager(worktreePath);
  const state = activateMerge(manager);
  const specId = specIdFromState(state);
  new FlowOutboxStore(manager).begin(finalizationOutboxIdentity(state, "finalize-merge"));
  await FLOW_COMMANDS.run["finalize-merge"].onError({
    flowManager: manager,
    flowState: manager.load(),
    root: worktreePath,
    specId,
  }, new Error(detected.recoveryHint));
  assert.deepEqual(lastCommitFiles(worktreePath), [
    `specs/${specId}/flow.json`,
    `specs/${specId}/issue-log.json`,
  ]);
  assert.equal(git("-C", worktreePath, "status", "--porcelain").trim(), "");
  await FLOW_COMMANDS.run["finalize-merge"].pre({
    flowManager: manager,
    flowState: manager.load(),
    root: worktreePath,
    specId,
  });
  new FlowOutboxStore(manager).begin(finalizationOutboxIdentity(manager.load(), "finalize-merge"));
  const retry = { status: "done", strategy: "squash", mergedFromSha: "resolved-retry" };
  await FLOW_COMMANDS.run["finalize-merge"].post({ flowManager: manager, flowState: manager.load(), root: worktreePath, specId }, retry);
  await FLOW_COMMANDS.run["finalize-merge"].post({ flowManager: manager, flowState: manager.load(), root: worktreePath, specId }, retry);
  const afterRetry = manager.load();
  assert.equal(afterRetry.outbox.length, 1);
  assert.equal(afterRetry.outbox[0].status, "done");
  assert.equal(findStepById(afterRetry.steps, "finalize-sync").status, "pending");
  assert.equal(findStepById(afterRetry.steps, "finalize-cleanup").status, "pending");

  const syncContext = {
    flowManager: manager,
    flowState: afterRetry,
    root: worktreePath,
    specId,
  };
  await FLOW_COMMANDS.run["finalize-sync"].pre(syncContext);
  await FLOW_COMMANDS.run["finalize-sync"].post({
    ...syncContext,
    flowState: manager.load(),
  }, { status: "done" });
  const afterSync = manager.load();
  assert.equal(findStepById(afterSync.steps, "finalize-sync").status, "done");
  assert.equal(afterSync.outbox.find((entry) => entry.stepId === "finalize-sync").status, "done");

  git("-C", root, "merge", "--squash", "feature/test");
  git("-C", root, "commit", "--quiet", "-m", "integrate resolved retry");
  manager.mutate((flow) => {
    flow.worktree = true;
    flow.baseBranch = "main";
    flow.featureBranch = "feature/test";
  });
  const mainManager = makeFlowManager(root);
  const mainState = structuredClone(manager.load());
  mainState.state = {
    mergeStrategy: "squash",
    featureBranchSquashedSha: git("-C", worktreePath, "rev-parse", "HEAD").trim(),
  };
  replaceFlowState(root, mainState, { specId });
  const excludePath = path.resolve(
    worktreePath,
    git("-C", worktreePath, "rev-parse", "--git-path", "info/exclude").trim(),
  );
  fs.appendFileSync(excludePath, "/.senti/flow-identity.json\n");
  new WorktreeFlowBindingStore({ worktreePath }).save(new WorktreeFlowIdentity({
    runId: mainState.runId,
    issue: null,
    spec: mainState.spec,
    worktreePath,
  }));

  const cleanupContext = {
    flowManager: mainManager,
    flowState: mainManager.load(),
    root,
    mainRoot: root,
    specId,
  };
  await FLOW_COMMANDS.run["finalize-cleanup"].pre(cleanupContext);
  const cleanupReady = mainManager.load();
  assert.equal(findStepById(cleanupReady.steps, "finalize-cleanup").status, "in_progress");
  assert.equal(cleanupReady.outbox.find((entry) => entry.stepId === "finalize-cleanup").status, "pending");

  const CleanupCommand = (await FLOW_COMMANDS.run["finalize-cleanup"].command()).default;
  const cleanup = await new CleanupCommand().execute({
    ...cleanupContext,
    flowState: cleanupReady,
  });
  assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
  assert.equal(fs.existsSync(worktreePath), false);
  assert.equal(git("-C", root, "branch", "--list", "feature/test").trim(), "");
  assert.equal(findStepById(mainManager.load().steps, "finalize-cleanup").status, "done");
});
