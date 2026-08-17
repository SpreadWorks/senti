// spec: R1 R2 R3 R4 R5 R6 R7
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  makeFlowManager,
  replaceFlowState,
  setupFlow,
} from "../../../tests/helpers/flow-setup.js";
import { AtomicJsonFile } from "../../../src/lib/atomic-json-file.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../../src/lib/worktree-flow-binding.js";
import { Command } from "../../../src/lib/command.js";
import { Container } from "../../../src/lib/container.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { Envelope } from "../../../src/lib/flow-envelope.js";
import {
  recordFinalizeCleanupPostCommandMetadata,
  RunFinalizeCleanupCommand,
} from "../../../src/flow/lib/run-finalize-cleanup.js";
import { RunFinalizeSyncCommand } from "../../../src/flow/lib/run-finalize-sync.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const registrySource = fs.readFileSync(path.join(ROOT, "src/flow/registry.js"), "utf8");

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function setupFinalizeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-finalize-checkpoint-"));
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  fs.writeFileSync(path.join(root, "README.md"), "# fixture\n");
  git(root, ["add", "README.md"]);
  git(root, ["commit", "--quiet", "-m", "initial"]);
  const specId = "353-checkpoint";
  const featureBranch = `feature/${specId}`;
  const worktreePath = path.join(root, ".senti", "worktree", specId);
  const state = setupFlow(root, {
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    baseBranch: "master",
    featureBranch,
    worktree: true,
  });
  state.state = { mergeStrategy: "pr" };
  replaceFlowState(root, state, { specId });
  git(root, ["add", `specs/${specId}/flow.json`]);
  git(root, ["commit", "--quiet", "-m", "add flow"]);
  makeFlowManager(root).addActiveFlow(specId, "worktree");
  git(root, ["worktree", "add", "-b", featureBranch, worktreePath]);
  const excludePath = git(worktreePath, ["rev-parse", "--git-path", "info/exclude"]);
  fs.appendFileSync(excludePath, [
    "/.senti/flow-identity.json",
    "/.senti/flow-identity.issue-transaction.json",
    "",
  ].join("\n"));
  new WorktreeFlowBindingStore({ worktreePath }).save(new WorktreeFlowIdentity({
    runId: state.runId,
    issue: Object.hasOwn(state, "issue") ? state.issue : null,
    spec: state.spec,
    worktreePath,
  }));
  return { root, worktreePath, specId, featureBranch };
}

async function runFinalize({ root, specId }) {
  const fixtureWorktree = path.join(root, ".senti", "worktree", specId);
  const worktreeAvailable = fs.existsSync(fixtureWorktree);
  const flowManager = worktreeAvailable
    ? new FlowManager({
        root: fixtureWorktree,
        mainRoot: root,
        inWorktree: true,
        specId,
      })
    : makeFlowManager(root);
  return new RunFinalizeCleanupCommand().execute({
    root: flowManager._root,
    mainRoot: root,
    flowManager,
    flowState: flowManager.loadReadOnly(specId),
    autoRescue: false,
    force: false,
  });
}

function checkpointTarget(value) {
  if (typeof value?.result?.code !== "string") return false;
  if (!value.result.code.startsWith("FINALIZE_CHECKPOINT:")) return false;
  return JSON.parse(value.result.code.slice("FINALIZE_CHECKPOINT:".length)).targetPhase;
}

function readRecoveryJournal(root) {
  const directory = path.join(root, ".senti", "recovery", "finalize-cleanup");
  const files = fs.readdirSync(directory).filter((name) => name.endsWith(".json"));
  assert.equal(files.length, 1);
  return JSON.parse(fs.readFileSync(path.join(directory, files[0]), "utf8"));
}

function flowStepStatus(steps, target) {
  for (const step of steps || []) {
    if (step.id === target) return step.status;
    const nested = flowStepStatus(step.children, target);
    if (nested != null) return nested;
  }
  return null;
}

function captureBoundaryReality(fixture) {
  return {
    head: git(fixture.root, ["rev-parse", "HEAD"]),
    index: fs.readFileSync(path.join(fixture.root, ".git", "index")),
  };
}

function assertBoundaryWasBlocked(targetPhase, fixture, before) {
  const pointerPath = path.join(fixture.root, ".senti", "last-finalized-spec");
  if (targetPhase === "commit-durable") {
    assert.equal(git(fixture.root, ["rev-parse", "HEAD"]), before.head);
  } else if (targetPhase === "index-reconciled") {
    assert.deepEqual(fs.readFileSync(path.join(fixture.root, ".git", "index")), before.index);
  } else if (targetPhase === "worktree-removed") {
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.match(git(fixture.root, ["worktree", "list", "--porcelain"]), new RegExp(fixture.worktreePath));
  } else if (targetPhase === "branch-deleted") {
    assert.equal(git(fixture.root, ["branch", "--list", fixture.featureBranch]), fixture.featureBranch);
  } else if (targetPhase === "validated" || targetPhase === "pointer-written") {
    assert.equal(fs.existsSync(pointerPath), false);
  } else if (targetPhase === "active-cleared") {
    assert.equal(
      makeFlowManager(fixture.root).loadActiveFlows().some((entry) => entry.spec === fixture.specId),
      true,
    );
  } else if (targetPhase === "completed") {
    const state = makeFlowManager(fixture.root).loadReadOnly(fixture.specId);
    assert.notEqual(flowStepStatus(state.steps, "finalize-cleanup"), "done");
  }
}

const CHECKPOINT_FAULT_MATRIX = [
  ["commit-durable", "prepared"],
  ["index-reconciled", "commit-durable"],
  ["worktree-removed", "index-reconciled"],
  ["branch-deleted", "worktree-removed"],
  ["validated", "branch-deleted"],
  ["pointer-written", "validated"],
  ["active-cleared", "pointer-written"],
  ["completed", "active-cleared"],
];

for (const [targetPhase, completedPhase] of CHECKPOINT_FAULT_MATRIX) {
  test(`R1: ${targetPhase} checkpoint persistence failure blocks the boundary`, async () => {
    const fixture = setupFinalizeFixture();
    const before = captureBoundaryReality(fixture);
    const originalWrite = AtomicJsonFile.prototype.write;
    let injected = false;
    AtomicJsonFile.prototype.write = function failCheckpoint(value) {
      if (!injected && checkpointTarget(value) === targetPhase) {
        injected = true;
        throw new Error(`injected ${targetPhase} checkpoint persistence failure`);
      }
      return originalWrite.call(this, value);
    };
    try {
      await assert.rejects(() => runFinalize(fixture), /checkpoint persistence failure/);
      assert.equal(injected, true);
      assert.equal(readRecoveryJournal(fixture.root).phase, completedPhase);
      assertBoundaryWasBlocked(targetPhase, fixture, before);
    } finally {
      AtomicJsonFile.prototype.write = originalWrite;
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  test(`R1: retry adopts only the unfinished ${targetPhase} checkpoint`, async () => {
    const fixture = setupFinalizeFixture();
    const originalWrite = AtomicJsonFile.prototype.write;
    let injected = false;
    AtomicJsonFile.prototype.write = function failCheckpointCompletion(value) {
      if (
        !injected
        && value?.version === 7
        && value?.phase === targetPhase
        && value?.result?.ok === true
      ) {
        injected = true;
        throw new Error(`injected ${targetPhase} completion persistence failure`);
      }
      return originalWrite.call(this, value);
    };
    try {
      await assert.rejects(() => runFinalize(fixture), /completion persistence failure/);
      assert.equal(injected, true);
      const journal = readRecoveryJournal(fixture.root);
      assert.equal(journal.phase, completedPhase);
      assert.equal(checkpointTarget(journal), targetPhase);
    } finally {
      AtomicJsonFile.prototype.write = originalWrite;
    }
    try {
      const retry = await runFinalize(fixture);
      assert.equal(retry.ok, true, JSON.stringify(retry));
      assert.equal(readRecoveryJournal(fixture.root).phase, "completed");
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
}

async function seedRecordedCleanupTarget(fixture) {
  const originalWrite = AtomicJsonFile.prototype.write;
  let injected = false;
  AtomicJsonFile.prototype.write = function stopBeforeWorktreeRemoval(value) {
    if (!injected && checkpointTarget(value) === "worktree-removed") {
      injected = true;
      throw new Error("seed recorded cleanup target");
    }
    return originalWrite.call(this, value);
  };
  try {
    await assert.rejects(() => runFinalize(fixture), /seed recorded cleanup target/);
    assert.equal(injected, true);
    assert.equal(readRecoveryJournal(fixture.root).phase, "index-reconciled");
  } finally {
    AtomicJsonFile.prototype.write = originalWrite;
  }
}

function writeFlowIdentity(fixture, mutate) {
  for (const root of [fixture.root, fixture.worktreePath]) {
    const flowPath = path.join(root, "specs", fixture.specId, "flow.json");
    const state = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    mutate(state);
    fs.writeFileSync(flowPath, `${JSON.stringify(state, null, 2)}\n`);
  }
}

async function assertForeignTargetRejected(fixture) {
  const journalBefore = JSON.stringify(readRecoveryJournal(fixture.root));
  let rejection = null;
  try {
    const result = await runFinalize(fixture);
    if (!result.ok) rejection = JSON.stringify(result);
  } catch (error) {
    rejection = `${error.code || "ERROR"}: ${error.message}`;
  }
  assert.match(
    rejection,
    /authority|binding|different|diverged|foreign|identity|mismatch|target|transaction/i,
  );
  assert.equal(fs.existsSync(fixture.worktreePath), true);
  assert.notEqual(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
  assert.equal(JSON.stringify(readRecoveryJournal(fixture.root)), journalBefore);
}

async function assertMissingTargetRejected(fixture) {
  const journalBefore = JSON.stringify(readRecoveryJournal(fixture.root));
  let rejection = null;
  try {
    const result = await runFinalize(fixture);
    if (!result.ok) rejection = JSON.stringify(result);
  } catch (error) {
    rejection = `${error.code || "ERROR"}: ${error.message}`;
  }
  assert.match(rejection, /missing|authority|target/i);
  assert.equal(JSON.stringify(readRecoveryJournal(fixture.root)), journalBefore);
}

const FOREIGN_TARGET_CASES = [
  {
    name: "worktree HEAD",
    mutate(fixture) {
      git(fixture.worktreePath, ["checkout", "--quiet", "--detach", "HEAD~1"]);
    },
  },
  {
    name: "feature branch ref",
    mutate(fixture) {
      const previous = git(fixture.root, ["rev-parse", fixture.featureBranch]);
      const tree = git(fixture.root, ["rev-parse", `${previous}^{tree}`]);
      const foreign = git(fixture.root, ["commit-tree", tree, "-p", previous, "-m", "foreign feature"]);
      git(fixture.root, ["update-ref", `refs/heads/${fixture.featureBranch}`, foreign, previous]);
    },
  },
  {
    name: "base branch identity",
    mutate(fixture) {
      git(fixture.root, ["branch", "foreign-base", "HEAD"]);
      writeFlowIdentity(fixture, (state) => {
        state.baseBranch = "foreign-base";
      });
    },
  },
  {
    name: "transaction identity",
    mutate(fixture) {
      const directory = path.join(fixture.root, ".senti", "recovery", "finalize-cleanup");
      const journalPath = path.join(directory, fs.readdirSync(directory).find((name) => name.endsWith(".json")));
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
      journal.transactionId = "foreign-transaction";
      fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
    },
  },
];

for (const targetCase of FOREIGN_TARGET_CASES) {
  test(`R2: retry rejects changed ${targetCase.name} before deletion`, async () => {
    const fixture = setupFinalizeFixture();
    try {
      await seedRecordedCleanupTarget(fixture);
      targetCase.mutate(fixture);
      await assertForeignTargetRejected(fixture);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });
}

test("R2: retry rejects a worktree missing before its recorded deletion", async () => {
  const fixture = setupFinalizeFixture();
  try {
    await seedRecordedCleanupTarget(fixture);
    git(fixture.root, ["worktree", "remove", "--force", fixture.worktreePath]);
    await assertMissingTargetRejected(fixture);
    assert.notEqual(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("R2: retry rejects a feature branch missing before its recorded deletion", async () => {
  const fixture = setupFinalizeFixture();
  try {
    await seedRecordedCleanupTarget(fixture);
    git(fixture.worktreePath, ["checkout", "--quiet", "--detach"]);
    git(fixture.root, ["update-ref", "-d", `refs/heads/${fixture.featureBranch}`]);
    await assertMissingTargetRejected(fixture);
    assert.equal(fs.existsSync(fixture.worktreePath), true);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("R3: finalize sync writes, stages, and commits only from the retained repository", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-finalize-sync-target-"));
  const mainRepoPath = path.join(root, "main");
  const worktreePath = path.join(root, "worktree");
  fs.mkdirSync(mainRepoPath);
  fs.mkdirSync(worktreePath);
  fs.writeFileSync(path.join(worktreePath, "preserved.txt"), "unchanged\n");
  const observedCwds = [];
  const command = new RunFinalizeSyncCommand({
    packageDir: path.join(root, "package"),
    hasCommit: () => false,
    runCommand: (_command, _args, options) => {
      observedCwds.push(options.cwd);
      fs.mkdirSync(path.join(options.cwd, "docs"));
      fs.writeFileSync(path.join(options.cwd, "docs", "generated.md"), "generated\n");
      return { ok: true, status: 0, stdout: "", stderr: "" };
    },
    git: (args, options) => {
      observedCwds.push(options.cwd);
      return {
        ok: true,
        status: 0,
        stdout: args.includes("--name-only") ? "docs/generated.md\n" : "",
        stderr: "",
      };
    },
    commit: (_args, options) => {
      observedCwds.push(options.cwd);
      return { status: "done", commit: "retained-repository-commit" };
    },
  });
  try {
    const result = await command.execute({
      root: worktreePath,
      flowState: { worktree: true },
      flowManager: {
        resolveWorktreePaths() {
          return { mainRepoPath };
        },
      },
    });
    assert.equal(result.status, "done");
    assert.ok(observedCwds.length >= 5);
    assert.deepEqual([...new Set(observedCwds)], [mainRepoPath]);
    assert.equal(fs.readFileSync(path.join(mainRepoPath, "docs", "generated.md"), "utf8"), "generated\n");
    assert.equal(fs.existsSync(path.join(worktreePath, "docs")), false);
    assert.equal(fs.readFileSync(path.join(worktreePath, "preserved.txt"), "utf8"), "unchanged\n");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R4: dispatcher completion uses main snapshots after worktree removal and preserves success warnings", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-finalize-post-teardown-"));
  const mainRepoPath = path.join(root, "main");
  const worktreePath = path.join(mainRepoPath, ".senti", "worktree", "feature-demo");
  fs.mkdirSync(worktreePath, { recursive: true });
  const container = new Container();
  container.register("paths", {
    root: worktreePath,
    agentWorkDir: path.join(worktreePath, ".agent-work"),
  });
  container.register("config", {});
  const mainFlowManager = { authority: "main" };
  let removed = false;
  const worktreeFlowManager = {
    resolveWorktreePaths() {
      return { mainRepoPath, worktreePath };
    },
    forRoot(target) {
      assert.equal(target, mainRepoPath);
      return mainFlowManager;
    },
    validateLock() {
      if (removed) throw new Error("removed worktree reached lock validation");
    },
  };
  let retainedMetadata = null;
  let exitCode = null;
  let commandModuleLoads = 0;
  class RemoveWorktreeCommand extends Command {
    static outputMode = "envelope";

    execute() {
      fs.rmSync(worktreePath, { recursive: true, force: true });
      removed = true;
      const envelope = Envelope.ok("run", "finalize-cleanup", { status: "done" });
      envelope.addWarning("POST_TEARDOWN_WARNING", "non-fatal retained-state warning");
      return envelope;
    }
  }
  const output = [];
  const guardedFsMethods = [
    "accessSync",
    "appendFileSync",
    "existsSync",
    "lstatSync",
    "mkdirSync",
    "openSync",
    "readFileSync",
    "realpathSync",
    "renameSync",
    "statSync",
    "unlinkSync",
    "writeFileSync",
  ];
  const originalFsMethods = new Map(guardedFsMethods.map((name) => [name, fs[name]]));
  for (const name of guardedFsMethods) {
    fs[name] = function rejectRemovedWorktreePath(target, ...args) {
      if (
        removed
        && typeof target === "string"
        && (
          path.resolve(target) === path.resolve(worktreePath)
          || path.resolve(target).startsWith(`${path.resolve(worktreePath)}${path.sep}`)
        )
      ) {
        throw new Error(`post-teardown ${name} reached removed worktree: ${target}`);
      }
      return originalFsMethods.get(name).call(this, target, ...args);
    };
  }
  try {
    await dispatch({
      container,
      entry: {
        command: async () => {
          commandModuleLoads += 1;
          if (removed) throw new Error("command module resolved after worktree removal");
          return {
            default: RemoveWorktreeCommand,
            recordFinalizeCleanupPostCommandMetadata(metadata) {
              retainedMetadata = metadata;
            },
          };
        },
        args: { options: [] },
        requiresFlow: false,
        runtimeLog: { stepMetadata: false },
      },
      argv: [],
      envelopeType: "run",
      envelopeKey: "finalize-cleanup",
      runtimeLog: true,
      stdout: (text) => output.push(text),
      stderr: () => {},
      setExitCode: (code) => {
        exitCode = code;
      },
      buildHookCtx: () => ({
        root: worktreePath,
        specId: "demo",
        flowState: { runId: "run-demo", spec: "specs/demo/spec.json", worktree: true },
        flowManager: worktreeFlowManager,
      }),
    });
  } finally {
    for (const [name, method] of originalFsMethods) fs[name] = method;
  }
  try {
    const serializedEnvelope = output.join("");
    const envelope = JSON.parse(serializedEnvelope);
    const runtimeLogPath = path.join(mainRepoPath, ".tmp", "logs", "demo.log");
    assert.equal(envelope.ok, true);
    assert.equal(exitCode, 0);
    assert.equal(envelope.errors.some((entry) => entry.code === "POST_TEARDOWN_WARNING"), true);
    assert.equal(fs.existsSync(worktreePath), false);
    assert.equal(fs.existsSync(runtimeLogPath), true);
    assert.equal(retainedMetadata.flowManager, mainFlowManager);
    assert.equal(commandModuleLoads, 1);
    assert.equal(Object.hasOwn(FLOW_COMMANDS.run["finalize-cleanup"], "post"), false);
    assert.equal(serializedEnvelope.includes(worktreePath), false);
    assert.equal(fs.readFileSync(runtimeLogPath, "utf8").includes(worktreePath), false);
    assert.equal(JSON.stringify(retainedMetadata.runtimeLog).includes(worktreePath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R5: real cleanup envelope and runtime log omit the removed worktree", async () => {
  const fixture = setupFinalizeFixture();
  const flowManager = new FlowManager({
    root: fixture.worktreePath,
    mainRoot: fixture.root,
    inWorktree: true,
    specId: fixture.specId,
  });
  const state = flowManager.loadReadOnly(fixture.specId);
  const container = new Container();
  container.register("paths", {
    root: fixture.worktreePath,
    agentWorkDir: path.join(fixture.worktreePath, ".agent-work"),
  });
  container.register("mainRoot", fixture.root);
  container.register("flowManager", flowManager);
  container.register("inWorktree", true);
  container.register("config", {});
  const output = [];
  let exitCode = null;
  try {
    await dispatch({
      container,
      entry: {
        command: async () => ({
          default: RunFinalizeCleanupCommand,
          recordFinalizeCleanupPostCommandMetadata,
        }),
        args: { options: [] },
        runtimeLog: { stepMetadata: false },
      },
      argv: [],
      envelopeType: "run",
      envelopeKey: "finalize-cleanup",
      runtimeLog: true,
      stdout: (text) => output.push(text),
      stderr: () => {},
      setExitCode: (code) => {
        exitCode = code;
      },
      buildHookCtx: () => ({
        root: fixture.worktreePath,
        specId: fixture.specId,
        flowState: state,
        flowManager,
      }),
    });
    const serializedEnvelope = output.join("");
    const envelope = JSON.parse(serializedEnvelope);
    const runtimeLogPath = path.join(
      fixture.root,
      ".tmp",
      "logs",
      `${fixture.specId}.log`,
    );
    assert.equal(envelope.ok, true, serializedEnvelope);
    assert.equal(exitCode, 0);
    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(serializedEnvelope.includes(fixture.worktreePath), false);
    assert.equal(fs.readFileSync(runtimeLogPath, "utf8").includes(fixture.worktreePath), false);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("R6: managed-worktree cleanup routes every flow-state mutation to main authority", async () => {
  const fixture = setupFinalizeFixture();
  const mutationRoots = [];
  const originalMutate = FlowManager.prototype.mutate;
  const originalUpdateStepStatus = FlowManager.prototype.updateStepStatus;
  FlowManager.prototype.mutate = function recordMutate(...args) {
    mutationRoots.push(path.resolve(this._root));
    return originalMutate.apply(this, args);
  };
  FlowManager.prototype.updateStepStatus = function recordStepUpdate(...args) {
    mutationRoots.push(path.resolve(this._root));
    return originalUpdateStepStatus.apply(this, args);
  };
  try {
    const result = await runFinalize(fixture);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.ok(mutationRoots.length > 0);
    assert.deepEqual([...new Set(mutationRoots)], [path.resolve(fixture.root)]);
  } finally {
    FlowManager.prototype.mutate = originalMutate;
    FlowManager.prototype.updateStepStatus = originalUpdateStepStatus;
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
  const ownerSource = fs.readFileSync(
    path.join(ROOT, "src", "flow", "lib", "finalize-flow-state-owner.js"),
    "utf8",
  );
  const cleanupSource = fs.readFileSync(
    path.join(ROOT, "src", "flow", "lib", "run-finalize-cleanup.js"),
    "utf8",
  );
  const dispatcherSource = fs.readFileSync(
    path.join(ROOT, "src", "lib", "dispatcher.js"),
    "utf8",
  );
  assert.match(ownerSource, /class FinalizeFlowStateOwner/);
  assert.match(ownerSource, /mergeWorktreeMetadata/);
  assert.match(ownerSource, /updateStepStatus/);
  assert.match(ownerSource, /clearActiveFlow/);
  assert.match(ownerSource, /outbox/);
  assert.match(registrySource, /switchToMainRepoFlowAuthority/);
  assert.match(registrySource, /FinalizeFlowStateOwner\.forMainContext\(ctx\)\.bindContext\(ctx\)/);
  assert.doesNotMatch(registrySource, /ctx\.flowManager = ctx\.flowManager\.forRoot/);
  assert.doesNotMatch(cleanupSource, /new FlowManager/);
  assert.doesNotMatch(dispatcherSource, /hookCtx\.flowManager\.forRoot\(mainRepoPath/);
});

test("R7: the spec-local suite retains all finalize contract headers", () => {
  assert.match(fs.readFileSync(fileURLToPath(import.meta.url), "utf8"), /\/\/ spec: R1 R2 R3 R4 R5 R6 R7/);
});
