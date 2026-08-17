import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const sentiBin = path.join(repoRoot, "src", "senti.js");

function initRepository(root) {
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senti", "config.json"), JSON.stringify({
    type: "base",
    lang: "en",
    docs: { languages: ["en"], defaultLanguage: "en" },
  }));
  fs.writeFileSync(path.join(root, ".gitignore"), ".tmp/\n.senti/output/\n");
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "run-id-fixture", version: "1.0.0" }));
  execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  execFileSync("git", ["-C", root, "config", "user.name", "Test User"]);
  execFileSync("git", ["-C", root, "add", "."]);
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "fixture"]);
}

function runSenti(root, args) {
  const result = spawnSync(process.execPath, [sentiBin, ...args], {
    cwd: root,
    env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: root },
    encoding: "utf8",
  });
  return {
    ...result,
    envelope: result.stdout.trim() ? JSON.parse(result.stdout) : null,
  };
}

function manager(root, specId = null) {
  return new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
}

describe("flow set init -> prepare integration", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("rejects legacy flow state without runId byte-identically instead of transparent migration", () => {
    tmp = createTmpDir("flow-runid-legacy-");
    const specId = "001-test";
    const flowPath = path.join(tmp, "specs", specId, "flow.json");
    fs.mkdirSync(path.dirname(flowPath), { recursive: true });
    const legacy = {
      spec: `specs/${specId}/spec.json`,
      baseBranch: "main",
      featureBranch: `feature/${specId}`,
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [],
      currentTaskId: null,
    };
    fs.writeFileSync(flowPath, `${JSON.stringify(legacy, null, 2)}\n`);
    const before = fs.readFileSync(flowPath);

    assert.throws(
      () => manager(tmp, specId).load(),
      (error) => error.code === "FLOW_STATE_SCHEMA_UNSUPPORTED",
    );
    assert.deepEqual(fs.readFileSync(flowPath), before);
  });

  it("flow prepare without --run-id generates and persists a runId", () => {
    tmp = createTmpDir("flow-runid-auto-");
    initRepository(tmp);

    const prepared = runSenti(tmp, ["flow", "prepare", "--title", "auto run id", "--no-branch"]);

    assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
    assert.equal(prepared.envelope.ok, true);
    const specId = prepared.envelope.data.spec.split("/")[1];
    const state = manager(tmp, specId).load();
    assert.equal(typeof state.runId, "string");
    assert.ok(state.runId.length > 0);
    assert.equal(state.runId, prepared.envelope.data.runId);
  });

  it("prepare inherits a provided runId and consumes only that preparing record", () => {
    tmp = createTmpDir("flow-runid-provided-");
    initRepository(tmp);
    const first = runSenti(tmp, ["flow", "set", "init", "--request", "selected request"]);
    const retained = runSenti(tmp, ["flow", "set", "init", "--request", "unrelated request"]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(retained.status, 0, retained.stderr);
    const runId = first.envelope.data.runId;
    const retainedRunId = retained.envelope.data.runId;

    const prepared = runSenti(tmp, [
      "flow", "prepare", "--title", "provided run id", "--no-branch", "--run-id", runId,
    ]);

    assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
    assert.equal(prepared.envelope.data.runId, runId);
    const specId = prepared.envelope.data.spec.split("/")[1];
    const fm = manager(tmp, specId);
    assert.equal(fm.load().request, "selected request");
    assert.equal(fm.loadPreparingFlow(runId), null);
    assert.equal(fm.loadPreparingFlow(retainedRunId).request, "unrelated request");
  });

  it("flow get status resolves the active flow by runId", () => {
    tmp = createTmpDir("flow-runid-status-");
    initRepository(tmp);
    const prepared = runSenti(tmp, ["flow", "prepare", "--title", "status run id", "--no-branch"]);
    assert.equal(prepared.status, 0, prepared.stderr || prepared.stdout);
    const runId = prepared.envelope.data.runId;

    const status = runSenti(tmp, ["flow", "get", "status", runId]);

    assert.equal(status.status, 0, status.stderr || status.stdout);
    assert.equal(status.envelope.ok, true);
    assert.equal(status.envelope.data.runId, runId);
  });

  it("aged preparing records remain byte-identical and discoverable", () => {
    tmp = createTmpDir("flow-runid-aged-");
    const fm = manager(tmp);
    const agedRunId = fm.generateRunId();
    const freshRunId = fm.generateRunId();
    const agedPath = fm.createPreparingFlow(agedRunId, { request: "aged request" });
    const freshPath = fm.createPreparingFlow(freshRunId, { request: "fresh request" });
    const agedTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    fs.utimesSync(agedPath, agedTime, agedTime);
    const beforeAged = fs.readFileSync(agedPath);
    const beforeFresh = fs.readFileSync(freshPath);

    const listed = fm.listPreparingFlows();

    assert.ok(listed.includes(agedRunId));
    assert.ok(listed.includes(freshRunId));
    assert.deepEqual(fs.readFileSync(agedPath), beforeAged);
    assert.deepEqual(fs.readFileSync(freshPath), beforeFresh);
    assert.equal(path.dirname(agedPath), path.join(tmp, ".senti"));
    assert.notEqual(path.dirname(agedPath), path.join(tmp, ".sdd-forge"));
  });
});
