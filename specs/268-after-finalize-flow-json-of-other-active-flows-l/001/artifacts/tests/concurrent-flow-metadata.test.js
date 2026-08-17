// spec: R1 R2 R3 R4 R5
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { resolveFlowContext } from "../../../src/flow/lib/flow-context.js";
import { RunFinalizeCleanupCommand } from "../../../src/flow/lib/run-finalize-cleanup.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { runCmd } from "../../../src/lib/process.js";
import { Container } from "../../../src/lib/container.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const tmpDirs = [];

function trackedTmp(prefix) {
  const dir = createTmpDir(prefix);
  tmpDirs.push(dir);
  return dir;
}

function write(root, relPath, content) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

function initRepo(root) {
  runCmd("git", ["init", "-q", "-b", "main", root]);
  runCmd("git", ["-C", root, "config", "user.email", "t@example.com"]);
  runCmd("git", ["-C", root, "config", "user.name", "T"]);
  runCmd("git", ["-C", root, "config", "commit.gpgsign", "false"]);
}

function commitAll(root, message) {
  runCmd("git", ["-C", root, "add", "."]);
  runCmd("git", ["-C", root, "commit", "-q", "-m", message]);
}

function git(root, args) {
  return runCmd("git", ["-C", root, ...args]).stdout.trim();
}

function readJson(root, relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

function lastCommitFiles(root) {
  return git(root, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])
    .split("\n")
    .filter(Boolean);
}

function findStep(steps, stepId) {
  for (const step of steps || []) {
    if (step.id === stepId) return step;
    const found = findStep(step.children, stepId);
    if (found) return found;
  }
  return null;
}

function statusFor(root, relPath) {
  return runCmd("git", ["-C", root, "status", "--short", "--untracked-files=all", "--", relPath]).stdout.replace(/\n$/, "");
}

function hasOtherFlowMetadataWarning(result, relPath) {
  return result.errors.some((entry) => (
    entry.level === "warn"
    && entry.code === "OTHER_FLOW_METADATA_DIRTY"
    && entry.messages.join("\n").includes(relPath)
  ));
}

function makeFlowState(specId, overrides = {}) {
  return {
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    worktree: true,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    metrics: [],
    notes: [],
    ...overrides,
  };
}

function setupFinalizeRepo() {
  const root = trackedTmp("finalize-other-flow-");
  initRepo(root);
  write(root, "specs/002-target/spec.json", "{}\n");
  write(root, "specs/001-other/spec.json", "{}\n");
  write(root, "specs/002-target/flow.json", JSON.stringify(makeFlowState("002-target"), null, 2) + "\n");
  write(root, "specs/001-other/flow.json", JSON.stringify(makeFlowState("001-other", { worktree: false }), null, 2) + "\n");
  commitAll(root, "init");
  runCmd("git", ["-C", root, "branch", "feature/002-target"]);
  runCmd("git", ["-C", root, "worktree", "add", "-q", path.join(root, ".sdd-forge", "worktree", "feature-002-target"), "feature/002-target"]);
  return root;
}

function setupAuthoritySwitchRepo() {
  const root = trackedTmp("authority-switch-");
  initRepo(root);
  write(root, "specs/002-target/spec.json", "{}\n");
  write(root, "specs/001-other/spec.json", "{}\n");
  write(root, "specs/002-target/flow.json", JSON.stringify(makeFlowState("002-target", { runId: "target-run" }), null, 2) + "\n");
  write(root, "specs/001-other/flow.json", JSON.stringify(makeFlowState("001-other", {
    runId: "other-run",
    worktree: false,
    metrics: [{ phase: "preexisting", counter: "other", delta: 1, taskId: null, ts: "2026-01-01T00:00:00.000Z" }],
  }), null, 2) + "\n");
  commitAll(root, "init");
  runCmd("git", ["-C", root, "branch", "feature/001-other"]);
  runCmd("git", ["-C", root, "branch", "feature/002-target"]);
  const worktreeRoot = path.join(root, ".sdd-forge", "worktree", "feature-002-target");
  runCmd("git", ["-C", root, "worktree", "add", "-q", worktreeRoot, "feature/002-target"]);
  runCmd("git", ["-C", root, "switch", "-q", "feature/001-other"]);
  write(root, ".sdd-forge/.active-flow", JSON.stringify([
    { spec: "001-other", mode: "branch" },
    { spec: "002-target", mode: "worktree" },
  ], null, 2) + "\n");
  return { root, worktreeRoot };
}

async function runCleanup(root) {
  const baseline = git(root, ["rev-parse", "feature/002-target"]);
  const flowState = makeFlowState("002-target", {
    state: {
      mergeStrategy: "squash",
      featureBranchSquashedSha: baseline,
    },
  });
  const flowManager = new FlowManager({
    root: path.join(root, ".sdd-forge", "worktree", "feature-002-target"),
    mainRoot: root,
    inWorktree: true,
  });
  const cmd = new RunFinalizeCleanupCommand();
  return cmd.execute({
    root: flowManager._root,
    flowState,
    flowManager,
    autoRescue: false,
    force: false,
  });
}

describe("concurrent flow metadata isolation", () => {
  afterEach(() => {
    for (const dir of tmpDirs.splice(0).reverse()) {
      removeTmpDir(dir);
    }
  });

  it("R1: metadata write after worktree authority switch preserves other active flow.json", () => {
    const { root: mainRoot, worktreeRoot } = setupAuthoritySwitchRepo();
    const otherBefore = fs.readFileSync(path.join(mainRoot, "specs/001-other/flow.json"), "utf8");
    const baseFlowManager = new FlowManager({
      root: worktreeRoot,
      mainRoot,
      inWorktree: true,
    });
    const c = new Container();
    c.register("paths", { root: worktreeRoot });
    c.register("mainRoot", mainRoot);
    c.register("inWorktree", true);
    c.register("config", {});
    c.register("flowManager", baseFlowManager);

    const ctx = resolveFlowContext(c);
    ctx.flowManager.incrementMetric("post-merge", "contextWrite");
    ctx.flowManager.updateStepStatus("implement", "done");

    assert.equal(ctx.specId, "002-target");
    assert.equal(fs.readFileSync(path.join(mainRoot, "specs/001-other/flow.json"), "utf8"), otherBefore);
    const targetAfter = readJson(mainRoot, "specs/002-target/flow.json");
    assert.deepEqual(targetAfter.metrics.map((entry) => [entry.phase, entry.counter]), [["post-merge", "contextWrite"]]);
    assert.equal(findStep(targetAfter.steps, "implement").status, "done");
  });

  it("R2: reports staged non-target flow.json before finalize cleanup commit", async () => {
    const root = setupFinalizeRepo();
    write(root, "specs/001-other/flow.json", JSON.stringify({ dirty: true, tasks: [], currentTaskId: null }, null, 2) + "\n");
    runCmd("git", ["-C", root, "add", "specs/001-other/flow.json"]);

    const result = await runCleanup(root);

    assert.equal(result.ok, true);
    assert.ok(
      hasOtherFlowMetadataWarning(result, "specs/001-other/flow.json"),
      "cleanup must warn about staged non-target flow.json",
    );
  });

  it("R2: reports unstaged non-target flow.json after finalize cleanup", async () => {
    const root = setupFinalizeRepo();
    write(root, "specs/001-other/flow.json", JSON.stringify({ dirty: true, tasks: [], currentTaskId: null }, null, 2) + "\n");

    const result = await runCleanup(root);

    assert.equal(result.ok, true);
    assert.ok(
      hasOtherFlowMetadataWarning(result, "specs/001-other/flow.json"),
      "cleanup must warn about unstaged non-target flow.json",
    );
  });

  it("R3: does not include staged other-flow flow.json in the target finalize commit", async () => {
    const root = setupFinalizeRepo();
    const stagedOtherContent = JSON.stringify({ dirty: true, tasks: [], currentTaskId: null }, null, 2) + "\n";
    write(root, "specs/001-other/flow.json", stagedOtherContent);
    runCmd("git", ["-C", root, "add", "specs/001-other/flow.json"]);

    await runCleanup(root);

    assert.deepEqual(lastCommitFiles(root), ["specs/002-target/flow.json"]);
    assert.equal(statusFor(root, "specs/001-other/flow.json"), "M  specs/001-other/flow.json");
    assert.equal(fs.readFileSync(path.join(root, "specs/001-other/flow.json"), "utf8"), stagedOtherContent);
    assert.equal(git(root, ["diff", "--name-only", "--", "specs/001-other/flow.json"]), "");
    assert.equal(git(root, ["diff", "--cached", "--name-only", "--", "specs/001-other/flow.json"]), "specs/001-other/flow.json");
  });

  it("R3: preserves unstaged other-flow flow.json content and status", async () => {
    const root = setupFinalizeRepo();
    const unstagedOtherContent = JSON.stringify({ dirty: true, tasks: [], currentTaskId: null }, null, 2) + "\n";
    write(root, "specs/001-other/flow.json", unstagedOtherContent);

    await runCleanup(root);

    assert.deepEqual(lastCommitFiles(root), ["specs/002-target/flow.json"]);
    assert.equal(statusFor(root, "specs/001-other/flow.json"), " M specs/001-other/flow.json");
    assert.equal(fs.readFileSync(path.join(root, "specs/001-other/flow.json"), "utf8"), unstagedOtherContent);
    assert.equal(git(root, ["diff", "--name-only", "--", "specs/001-other/flow.json"]), "specs/001-other/flow.json");
    assert.equal(git(root, ["diff", "--cached", "--name-only", "--", "specs/001-other/flow.json"]), "");
  });

  it("R4: successful cleanup output omits other-flow warning when no non-target flow.json is dirty", async () => {
    const root = setupFinalizeRepo();

    const result = await runCleanup(root);

    assert.equal(result.ok, true);
    assert.equal(
      result.errors.some((entry) => entry.code === "OTHER_FLOW_METADATA_DIRTY"),
      false,
    );
  });

  it("R5: declares all testable requirements in the spec coverage header", () => {
    const source = fs.readFileSync(new URL(import.meta.url), "utf8");
    assert.match(source, /^\/\/ spec: R1 R2 R3 R4 R5$/m);
    for (const id of ["R1", "R2", "R3", "R4", "R5"]) {
      assert.match(source, new RegExp(`it\\("${id}:`));
    }
  });
});
