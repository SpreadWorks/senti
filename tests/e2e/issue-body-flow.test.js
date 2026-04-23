import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../helpers/git-repo.js";
import {
  writeStubAgentScript,
  writeCapturingStubAgentScript,
  stubAgentConfig,
} from "../helpers/stub-agent.js";

const CMD = path.join(process.cwd(), "src/sdd-forge.js");

function passingScore() {
  return JSON.stringify({
    specBuildability: 2,
    ambiguity: 2,
    verifiability: 2,
    scopeBoundedness: 2,
    targetSpecificity: 1,
    precedent: 1,
    reason: "e2e stub pass",
  });
}

function writeFakeGh(tmp, body) {
  const bin = path.join(tmp, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const script = path.join(bin, "gh");
  fs.writeFileSync(script, body, { mode: 0o755 });
  fs.chmodSync(script, 0o755);
  return bin;
}

function setupProject(tmp, { capturePath, stubGhBody } = {}) {
  const stubPath = capturePath
    ? writeCapturingStubAgentScript(tmp, ".stub-agent.js", capturePath, passingScore())
    : writeStubAgentScript(tmp, ".stub-agent.js", passingScore());
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: stubAgentConfig(stubPath),
  });
  writeJson(tmp, "package.json", { name: "fixture", version: "0.0.0" });
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  const ghBin = stubGhBody ? writeFakeGh(tmp, stubGhBody) : null;
  return { ghBin };
}

function runCli(tmp, args, { extraPath } = {}) {
  const env = { ...process.env, SDD_FORGE_WORK_ROOT: tmp };
  if (extraPath) {
    env.PATH = `${extraPath}:${env.PATH}`;
  }
  return spawnSync("node", [CMD, ...args], {
    encoding: "utf8",
    cwd: tmp,
    env,
  });
}

describe("e2e — Issue body flow (spec 225 R7/R8/R10)", () => {
  let tmp;

  beforeEach(() => { tmp = createTmpDir("e2e-issue-body-"); });
  afterEach(() => { removeTmpDir(tmp); });

  it("init → prepare → auto-check: Issue body reaches the AI prompt", () => {
    const capturePath = path.join(tmp, ".stub-agent-called");
    const ghStub = `#!/bin/sh
cat <<'JSON'
{"title":"T","body":"ISSUE_MARKER_e2e 本文","labels":[],"state":"OPEN"}
JSON
`;
    const { ghBin } = setupProject(tmp, { capturePath, stubGhBody: ghStub });

    // set init --issue → expects preparing state with issueBody persisted
    const initRes = runCli(tmp, [
      "flow", "set", "init",
      "--issue", "1001",
      "--request", "add progress bar",
    ], { extraPath: ghBin });
    assert.equal(initRes.status, 0, initRes.stderr);
    const runId = JSON.parse(initRes.stdout.trim()).data.runId;
    assert.ok(runId);

    const preparingStatePath = path.join(tmp, ".sdd-forge", `.active-flow.${runId}`);
    assert.ok(fs.existsSync(preparingStatePath), "preparing state file should exist");
    const preparing = JSON.parse(fs.readFileSync(preparingStatePath, "utf8"));
    assert.ok(preparing.issueBody, "preparing state should have issueBody");
    assert.match(preparing.issueBody, /ISSUE_MARKER_e2e/);

    // flow prepare → expect specs/<spec>/issue.md created
    const prepRes = runCli(tmp, [
      "flow", "prepare",
      "--title", "issue-body-test",
      "--no-branch",
      "--run-id", runId,
    ], { extraPath: ghBin });
    assert.equal(prepRes.status, 0, prepRes.stderr);
    const prepData = JSON.parse(prepRes.stdout.trim()).data;
    const specDir = prepData.artifacts.specDir;
    const issueMd = path.join(tmp, specDir, "issue.md");
    assert.ok(fs.existsSync(issueMd), `issue.md should exist at ${issueMd}`);
    assert.match(fs.readFileSync(issueMd, "utf8"), /ISSUE_MARKER_e2e/);

    // flow run auto-check → stub agent captures the prompt
    const checkRes = runCli(tmp, ["flow", "run", "auto-check"], { extraPath: ghBin });
    assert.equal(checkRes.status, 0, checkRes.stderr);

    assert.ok(fs.existsSync(capturePath), "stub agent must be called");
    const captured = fs.readFileSync(capturePath, "utf8");
    assert.match(captured, /ISSUE_MARKER_e2e/, "AI prompt should contain Issue body text");
  });

  it("gh fetch failure: silent fallback keeps flow running (no issueBody, no issue.md)", () => {
    const ghStub = `#!/bin/sh
echo "gh failure" >&2
exit 1
`;
    const { ghBin } = setupProject(tmp, { stubGhBody: ghStub });

    const initRes = runCli(tmp, [
      "flow", "set", "init",
      "--issue", "1002",
      "--request", "add progress bar",
    ], { extraPath: ghBin });
    assert.equal(initRes.status, 0, `init should succeed despite gh failure: ${initRes.stderr}`);
    const runId = JSON.parse(initRes.stdout.trim()).data.runId;
    const preparing = JSON.parse(fs.readFileSync(path.join(tmp, ".sdd-forge", `.active-flow.${runId}`), "utf8"));
    assert.ok(!preparing.issueBody, "issueBody should NOT be set when gh fails");
    // warning should be present on stderr
    assert.match(initRes.stderr, /warn:/);

    const prepRes = runCli(tmp, [
      "flow", "prepare",
      "--title", "issue-body-test",
      "--no-branch",
      "--run-id", runId,
    ], { extraPath: ghBin });
    assert.equal(prepRes.status, 0, prepRes.stderr);
    const prepData = JSON.parse(prepRes.stdout.trim()).data;
    const issueMd = path.join(tmp, prepData.artifacts.specDir, "issue.md");
    assert.ok(!fs.existsSync(issueMd), "issue.md should NOT be created when issueBody missing");

    const checkRes = runCli(tmp, ["flow", "run", "auto-check"], { extraPath: ghBin });
    assert.equal(checkRes.status, 0, checkRes.stderr);
    const checkData = JSON.parse(checkRes.stdout.trim()).data;
    // flow should still complete (eligible decision reached, no hard-crash)
    assert.equal(typeof checkData.eligible, "boolean");
  });
});
