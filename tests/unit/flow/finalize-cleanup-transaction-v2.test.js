import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowManager, replaceFlowState, setupFlow } from "../../helpers/flow-setup.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  RunFinalizeCleanupCommand,
  deleteFeatureBranchForCleanup,
} from "../../../src/flow/lib/run-finalize-cleanup.js";
import { ProcessOwnedLock } from "../../../src/lib/process-owned-lock.js";
import { AtomicJsonFile } from "../../../src/lib/atomic-json-file.js";

const finalizeModule = path.resolve("src/flow/lib/run-finalize-cleanup.js");
const flowManagerModule = path.resolve("src/lib/flow-manager.js");

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

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
  return fs.readdirSync(directory)
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => path.join(directory, entry));
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

function setupWorktreeFinalizeFlow(root, specId) {
  const spec = `specs/${specId}/spec.json`;
  const featureBranch = `feature/${specId}`;
  const worktreePath = path.join(root, ".senti", "worktree", specId);
  const state = setupFlow(root, {
    spec,
    runId: `run-${specId}`,
    baseBranch: "master",
    featureBranch,
    worktree: true,
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
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "pre-commit");

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
    assert.equal(git(root, ["rev-parse", "HEAD"]), committedHead);
    assertCompletedJournal(root);
    assert.equal(git(root, ["log", "--format=%s", "--all"]).split("\n").filter((line) => line === `chore: finalize ${specId}`).length, 1);
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
      else value.result.phase = "pre-commit";
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
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "commit-durable");
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
      assert.equal(git(root, ["rev-parse", "HEAD"]), committedHead);
      assert.equal(fs.existsSync(path.join(root, ".senti", ".active-flow")), false);
      assert.equal(fs.readFileSync(fixture.pointerPath, "utf8").trim(), fixture.spec);
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
    assert.equal(loser?.value?.errors?.[0]?.code, "FINALIZE_REPOSITORY_BUSY", JSON.stringify(results));
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
    assert.equal(secondValue?.errors?.[0]?.code, "FINALIZE_REPOSITORY_BUSY", JSON.stringify(secondValue));
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
      if (!changed && value?.version === 2 && value.commitExpectation) {
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
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).phase, "pre-commit");
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

test("git add failure leaves no finalize journal or commit and restores flow state", async () => {
  const root = createTmpDir("finalize-git-add-failure-");
  try {
    initGitRepo(root);
    const specId = "162";
    setupFinalizeFlow(root, specId);
    const indexLock = path.join(root, ".git", "index.lock");
    fs.writeFileSync(indexLock, "busy\n");
    const before = {
      head: git(root, ["rev-parse", "HEAD"]),
      flow: fs.readFileSync(path.join(root, "specs", specId, "flow.json")),
    };

    const failed = await runFinalize(root, specId);

    assert.equal(failed.ok, false, JSON.stringify(failed));
    assert.equal(failed.errors[0].code, "FINALIZE_GIT_ADD_FAILED");
    assert.equal(git(root, ["rev-parse", "HEAD"]), before.head);
    assert.deepEqual(fs.readFileSync(path.join(root, "specs", specId, "flow.json")), before.flow);
    assert.equal(recoveryJournals(root).length, 0);
  } finally {
    fs.rmSync(path.join(root, ".git", "index.lock"), { force: true });
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

test("preserves commit and flow-status rollback failures in primary-first order", async () => {
  const root = createTmpDir("finalize-commit-rollback-order-");
  try {
    initGitRepo(root);
    const specId = "157";
    setupFinalizeFlow(root, specId);
    const hook = path.join(root, ".git", "hooks", "pre-commit");
    fs.writeFileSync(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    const flowManager = makeFlowManager(root);
    const originalUpdate = flowManager.updateStepStatus.bind(flowManager);
    flowManager.updateStepStatus = (stepId, status, options) => {
      if (stepId === "finalize-cleanup" && status === "in_progress") {
        throw new Error("injected flow status rollback failure");
      }
      return originalUpdate(stepId, status, options);
    };

    await assert.rejects(
      () => runFinalize(root, specId, { flowManager }),
      (error) => error instanceof AggregateError
        && error.errors.length >= 2
        && error.errors[0].code === "COMMIT_FAILED"
        && error.errors[1].message === "injected flow status rollback failure"
        && error.cause === error.errors[0],
    );
    assert.equal(JSON.parse(fs.readFileSync(recoveryJournal(root), "utf8")).result.code, "COMMIT_FAILED");
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
    assert.equal(git(root, ["rev-parse", "HEAD"]), head);
    assert.equal(retried.data.forceAuthorization.auditId, before.authorization.auditId);
    assert.equal(retried.data.forceAuthorization.mergeStrategy, null);
    assert.equal(retried.errors.some((error) => error.code === "FORCED_ORPHAN_DROP"), true);
    const entries = JSON.parse(fs.readFileSync(path.join(root, "specs", specId, "issue-log.json"), "utf8")).entries;
    assert.equal(entries.filter((entry) => entry.issueLogId === before.authorization.auditId).length, 1);
    const completed = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    assert.equal(completed.phase, "completed");
    assert.deepEqual(completed.authorization, before.authorization);
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
