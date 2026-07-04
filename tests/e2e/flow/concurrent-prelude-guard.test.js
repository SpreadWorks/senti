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

describe("e2e — concurrent flow prelude guard", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("e2e-concurrent-prelude-");
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  it("rejects prepare --run-id while another active flow owns the context", () => {
    setupProject(tmp);
    setupFlow(tmp, {
      spec: "specs/011-active/spec.json",
      featureBranch: "main",
      issue: 11,
      runId: "issue-11-run",
    });

    const initRes = runCli(tmp, [
      "flow", "set", "init",
      "--issue", "12",
      "--request", "start issue 12",
    ]);
    assert.equal(initRes.status, 0, initRes.stderr);
    const runId = JSON.parse(initRes.stdout.trim()).data.runId;
    assert.ok(runId);

    const prepareRes = runCli(tmp, [
      "flow", "prepare",
      "--title", "issue-12",
      "--no-branch",
      "--run-id", runId,
    ]);

    assert.notEqual(prepareRes.status, 0, prepareRes.stdout);
    const envelope = JSON.parse(prepareRes.stdout.trim());
    assert.equal(envelope.ok, false);
    assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(envelope.data.active.issue, 11);
    assert.equal(envelope.data.requested.runId, runId);
    assert.ok(
      fs.existsSync(path.join(tmp, ".senti", `.active-flow.${runId}`)),
      "preparing state must remain for user recovery",
    );
    assert.equal(
      fs.existsSync(path.join(tmp, "specs", "012-issue-12")),
      false,
      "prepare must not create a new spec directory after the mismatch",
    );
  });
});
