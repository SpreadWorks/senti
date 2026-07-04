import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../helpers/git-repo.js";
import { setupFlow, setupFlowConfig } from "../../helpers/flow-setup.js";

const CMD = path.join(process.cwd(), "src/senti.js");

function runCli(tmp, args) {
  return spawnSync("node", [CMD, ...args], {
    encoding: "utf8",
    cwd: tmp,
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
}

function setupProject(tmp) {
  setupFlowConfig(tmp, "ja");
  fs.writeFileSync(path.join(tmp, "package.json"), JSON.stringify({ name: "fixture", version: "0.0.0" }, null, 2));
  initGitRepo(tmp);
  commitAll(tmp, "initial");
}

describe("e2e — concurrent flow prelude isolation", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("e2e-concurrent-prelude-");
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  it("prepares a second Issue flow from main while another worktree flow is active", () => {
    setupProject(tmp);

    const issue11Init = runCli(tmp, [
      "flow", "set", "init",
      "--issue", "11",
      "--request", "start issue 11",
    ]);
    assert.equal(issue11Init.status, 0, issue11Init.stderr);
    const issue11RunId = JSON.parse(issue11Init.stdout.trim()).data.runId;
    const issue11Prepare = runCli(tmp, [
      "flow", "prepare",
      "--title", "issue-11",
      "--base", "main",
      "--worktree",
      "--run-id", issue11RunId,
    ]);
    assert.equal(issue11Prepare.status, 0, issue11Prepare.stderr);
    const issue11Data = JSON.parse(issue11Prepare.stdout.trim()).data;
    const issue11Worktree = issue11Data.artifacts.worktree;
    assert.ok(issue11Worktree, "first flow should use worktree mode");

    const initRes = runCli(tmp, [
      "flow", "set", "init",
      "--issue", "12",
      "--request", "start issue 12",
    ]);
    assert.equal(initRes.status, 0, initRes.stderr);
    const runId = JSON.parse(initRes.stdout.trim()).data.runId;
    assert.ok(runId);

    const preStatus = runCli(tmp, [
      "flow", "get", "status", runId,
      "--expect-run-id", runId,
      "--expect-issue", "12",
    ]);
    assert.equal(preStatus.status, 0, preStatus.stderr);
    const preStatusData = JSON.parse(preStatus.stdout.trim()).data;
    assert.equal(preStatusData.runId, runId);
    assert.equal(preStatusData.issue, 12);
    assert.equal(preStatusData.spec, null);

    const prepareRes = runCli(tmp, [
      "flow", "prepare",
      "--title", "issue-12",
      "--no-branch",
      "--run-id", runId,
    ]);

    assert.equal(prepareRes.status, 0, prepareRes.stderr);
    const envelope = JSON.parse(prepareRes.stdout.trim());
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.runId, runId);
    assert.equal(envelope.data.issue, 12);
    assert.equal(envelope.data.artifacts.mode, "spec-only");
    assert.equal(envelope.data.worktreePath, null);
    const specDir = envelope.data.artifacts.specDir;
    assert.equal(
      fs.existsSync(path.join(tmp, specDir, "flow.json")),
      true,
      "second flow must be prepared in the main repo",
    );
    assert.equal(
      fs.existsSync(path.join(issue11Worktree, specDir, "flow.json")),
      false,
      "second flow must not be created inside the first flow worktree",
    );

    const postStatus = runCli(tmp, [
      "flow", "get", "status", runId,
      "--expect-run-id", runId,
      "--expect-issue", "12",
      "--expect-spec", envelope.data.spec,
    ]);
    assert.equal(postStatus.status, 0, postStatus.stderr);
    const postStatusData = JSON.parse(postStatus.stdout.trim()).data;
    assert.equal(postStatusData.runId, runId);
    assert.equal(postStatusData.issue, 12);
    assert.equal(postStatusData.spec, envelope.data.spec);

    const activeFlows = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", ".active-flow"), "utf8"));
    assert.equal(
      activeFlows.some((entry) => entry.mode === "worktree" && entry.spec === issue11Data.artifacts.specDir.split("/").at(-1)),
      true,
      "first worktree flow must remain active",
    );
    assert.equal(
      activeFlows.some((entry) => entry.mode === "local" && entry.spec === specDir.split("/").at(-1)),
      true,
      "second local flow must be registered active",
    );
  });

  it("rejects bare prepare while another flow is active", () => {
    setupProject(tmp);
    setupFlow(tmp, {
      spec: "specs/011-active/spec.json",
      featureBranch: "main",
      issue: 11,
      runId: "issue-11-run",
    });

    const prepareRes = runCli(tmp, [
      "flow", "prepare",
      "--title", "issue-12",
      "--no-branch",
    ]);

    assert.notEqual(prepareRes.status, 0, prepareRes.stdout);
    const envelope = JSON.parse(prepareRes.stdout.trim());
    assert.equal(envelope.ok, false);
    assert.equal(envelope.errors[0].code, "TARGET_REQUIRED");
  });
});
