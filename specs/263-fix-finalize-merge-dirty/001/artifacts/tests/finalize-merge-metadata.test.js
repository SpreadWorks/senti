// spec: R1 R2 R3 R4 R5
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { runPreSync } from "../../../src/flow/commands/merge.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import * as finalize from "../../../src/flow/lib/run-finalize.js";
import { runCmd } from "../../../src/lib/process.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const tmpDirs = [];

function createTrackedTmpDir(prefix) {
  const dir = createTmpDir(prefix);
  tmpDirs.push(dir);
  return dir;
}

function initRepo(root) {
  runCmd("git", ["init", "-q", "-b", "main", root]);
  runCmd("git", ["-C", root, "config", "user.email", "t@example.com"]);
  runCmd("git", ["-C", root, "config", "user.name", "T"]);
  runCmd("git", ["-C", root, "config", "commit.gpgsign", "false"]);
}

function write(root, relPath, content) {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function commitAll(root, message) {
  runCmd("git", ["-C", root, "add", "."]);
  runCmd("git", ["-C", root, "commit", "-q", "-m", message]);
}

function status(root) {
  return runCmd("git", ["-C", root, "status", "--short", "--untracked-files=all"]).stdout.trim();
}

function stagedFiles(root) {
  return runCmd("git", ["-C", root, "diff", "--cached", "--name-only"])
    .stdout
    .trim()
    .split("\n")
    .filter(Boolean);
}

function lastCommitFiles(root) {
  return runCmd("git", ["-C", root, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"])
    .stdout
    .trim()
    .split("\n")
    .filter(Boolean);
}

function logCount(root) {
  return Number(runCmd("git", ["-C", root, "rev-list", "--count", "HEAD"]).stdout.trim());
}

function headJson(root, relPath) {
  return JSON.parse(runCmd("git", ["-C", root, "show", `HEAD:${relPath}`]).stdout);
}

function setupRepo(specId = "263-alpha") {
  const root = createTrackedTmpDir("finalize-merge-metadata-");
  initRepo(root);
  write(root, `specs/${specId}/flow.json`, JSON.stringify({ steps: [] }, null, 2) + "\n");
  commitAll(root, "init");
  return root;
}

function attachFetchableRemote(root, featureBranch) {
  const remoteRoot = createTrackedTmpDir("finalize-merge-remote-");
  runCmd("git", ["init", "-q", "--bare", remoteRoot]);
  runCmd("git", ["-C", root, "remote", "add", "origin", remoteRoot]);
  runCmd("git", ["-C", root, "push", "-q", "-u", "origin", "main"]);
  runCmd("git", ["-C", root, "checkout", "-q", "-b", featureBranch]);
}

function commitMetadata(root, specId) {
  assert.equal(typeof finalize.commitFinalizeMergeMetadataIfSafe, "function");
  return finalize.commitFinalizeMergeMetadataIfSafe({ root, specId });
}

function flowStepStatuses(root, specId) {
  const state = JSON.parse(fs.readFileSync(path.join(root, `specs/${specId}/flow.json`), "utf8"));
  return Object.fromEntries((state.steps || []).map((step) => [step.id, step.status]));
}

function findStep(steps, stepId) {
  for (const step of steps || []) {
    if (step.id === stepId) return step;
    const child = findStep(step.children, stepId);
    if (child) return child;
  }
  return null;
}

class TestFlowManager {
  constructor(root, specId) {
    this.root = root;
    this.specId = specId;
  }

  flowPath() {
    return path.join(this.root, `specs/${this.specId}/flow.json`);
  }

  load() {
    return JSON.parse(fs.readFileSync(this.flowPath(), "utf8"));
  }

  updateStepStatus(stepId, status) {
    const state = this.load();
    const step = findStep(state.steps, stepId);
    assert.ok(step, `missing flow step ${stepId}`);
    step.status = status;
    fs.writeFileSync(this.flowPath(), JSON.stringify(state, null, 2) + "\n");
  }
}

async function runFinalizeMergePreHook(root, specId) {
  await FLOW_COMMANDS.run["finalize-merge"].pre({
    root,
    specId,
    flowManager: new TestFlowManager(root, specId),
  });
}

describe("finalize-merge metadata preflight commits", () => {
  let root;

  afterEach(() => {
    for (const dir of tmpDirs.splice(0).reverse()) {
      removeTmpDir(dir);
    }
    root = null;
  });

  it("R1: commits dirty flow.json before pre-merge rebase", async () => {
    const specId = "263-alpha";
    const featureBranch = "feature/263-alpha";
    root = setupRepo(specId);
    attachFetchableRemote(root, featureBranch);
    write(root, `specs/${specId}/flow.json`, JSON.stringify({ current: "finalize-merge" }, null, 2) + "\n");

    await runFinalizeMergePreHook(root, specId);
    const syncResult = runPreSync({
      worktreePath: root,
      baseBranch: "main",
      featureBranch,
      remote: "origin",
    });

    assert.equal(syncResult.ok, true);
    assert.equal(status(root), "");
    assert.deepEqual(lastCommitFiles(root), [`specs/${specId}/flow.json`]);
  });

  it("R2: stages only flow.json and issue-log.json", () => {
    const specId = "263-alpha";
    root = setupRepo(specId);
    write(root, `specs/${specId}/flow.json`, JSON.stringify({ current: "finalize-merge" }, null, 2) + "\n");
    write(root, `specs/${specId}/issue-log.json`, JSON.stringify({ entries: [{ step: "finalize-merge" }] }, null, 2) + "\n");

    const result = commitMetadata(root, specId);

    assert.equal(result.status, "done");
    assert.deepEqual(lastCommitFiles(root).sort(), [
      `specs/${specId}/flow.json`,
      `specs/${specId}/issue-log.json`,
    ]);
  });

  it("R2: skips instead of staging non-target spec files", () => {
    const specId = "263-alpha";
    root = setupRepo(specId);
    const before = logCount(root);
    write(root, `specs/${specId}/flow.json`, JSON.stringify({ current: "finalize-merge" }, null, 2) + "\n");
    write(root, `specs/${specId}/issue-log.json`, JSON.stringify({ entries: [{ step: "finalize-merge" }] }, null, 2) + "\n");
    write(root, `specs/${specId}/notes.md`, "non-metadata same-spec change\n");
    write(root, "specs/999-other/flow.json", JSON.stringify({ other: true }, null, 2) + "\n");

    const result = commitMetadata(root, specId);

    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "target-external-dirty");
    assert.equal(logCount(root), before);
    assert.deepEqual(stagedFiles(root), []);
    assert.match(status(root), /specs\/263-alpha\/flow\.json/);
    assert.match(status(root), /specs\/263-alpha\/issue-log\.json/);
    assert.match(status(root), /specs\/263-alpha\/notes\.md/);
    assert.match(status(root), /specs\/999-other\/flow\.json/);
  });

  it("R3: skips metadata commit and downstream reset when target-external dirty file exists", async () => {
    const specId = "263-alpha";
    const featureBranch = "feature/263-alpha";
    root = setupRepo(specId);
    attachFetchableRemote(root, featureBranch);
    const before = logCount(root);
    write(root, `specs/${specId}/flow.json`, JSON.stringify({
      steps: [
        { id: "finalize-sync", status: "skipped" },
        { id: "finalize-cleanup", status: "skipped" },
      ],
    }, null, 2) + "\n");
    write(root, "src/flow/registry.js", "target external change\n");

    await runFinalizeMergePreHook(root, specId);
    const syncResult = runPreSync({
      worktreePath: root,
      baseBranch: "main",
      featureBranch,
      remote: "origin",
    });

    assert.equal(syncResult.ok, false);
    assert.equal(syncResult.dirty, true);
    assert.equal(logCount(root), before);
    assert.deepEqual(flowStepStatuses(root, specId), {
      "finalize-sync": "skipped",
      "finalize-cleanup": "skipped",
    });
    assert.match(status(root), /specs\/263-alpha\/flow\.json/);
    assert.match(status(root), /src\/flow\/registry\.js/);
  });

  it("R4: downstream skipped reset is committed when no external path is dirty", async () => {
    const specId = "263-alpha";
    root = setupRepo(specId);
    write(root, `specs/${specId}/flow.json`, JSON.stringify({
      steps: [
        { id: "finalize-sync", status: "skipped" },
        { id: "finalize-cleanup", status: "skipped" },
      ],
    }, null, 2) + "\n");

    await runFinalizeMergePreHook(root, specId);

    assert.equal(status(root), "");
    assert.deepEqual(lastCommitFiles(root), [`specs/${specId}/flow.json`]);
    assert.deepEqual(flowStepStatuses(root, specId), {
      "finalize-sync": "pending",
      "finalize-cleanup": "pending",
    });
    assert.deepEqual(headJson(root, `specs/${specId}/flow.json`).steps, [
      { id: "finalize-sync", status: "pending" },
      { id: "finalize-cleanup", status: "pending" },
    ]);
  });

  it("R5: exposes the metadata dirty guard used by spec-local coverage", () => {
    const specId = "263-alpha";
    root = setupRepo(specId);
    assert.equal(typeof finalize.hasFinalizeMergeTargetExternalDirty, "function");

    write(root, `specs/${specId}/flow.json`, JSON.stringify({ current: "finalize-merge" }, null, 2) + "\n");
    assert.equal(finalize.hasFinalizeMergeTargetExternalDirty({ root, specId }), false);

    write(root, "src/flow/registry.js", "target external change\n");
    assert.equal(finalize.hasFinalizeMergeTargetExternalDirty({ root, specId }), true);
  });
});
