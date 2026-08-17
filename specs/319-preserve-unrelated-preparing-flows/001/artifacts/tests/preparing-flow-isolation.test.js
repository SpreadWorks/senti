// spec: R1 R2 R3 R4 R5 R6
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import SetInitCommand from "../../../src/flow/lib/set-init.js";
import { PREPARING_PREFIX, PREPARING_SCAN_LIMIT } from "../../../src/lib/flow-helpers.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SENTI = path.join(REPO_ROOT, "src/senti.js");

function setupProject(tmp, type = "base") {
  writeJson(tmp, ".senti/config.json", {
    lang: "en",
    type,
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  writeJson(tmp, "package.json", { name: "preparing-isolation", version: "0.0.0" });
  initGitRepo(tmp);
  commitAll(tmp, "initial");
}

function preparingPath(tmp, runId) {
  return path.join(tmp, ".senti", `${PREPARING_PREFIX}${runId}`);
}

function snapshot(tmp, runId) {
  return fs.readFileSync(preparingPath(tmp, runId));
}

function ageByHours(filePath, hours) {
  const seconds = (Date.now() - hours * 60 * 60 * 1000) / 1000;
  fs.utimesSync(filePath, seconds, seconds);
}

function runCli(tmp, args, { extraPath } = {}) {
  const env = { ...process.env, SENTI_WORK_ROOT: tmp };
  if (extraPath) env.PATH = `${extraPath}:${env.PATH}`;
  return spawnSync(process.execPath, [SENTI, ...args], {
    cwd: tmp,
    encoding: "utf8",
    env,
  });
}

function installFakeGh(tmp) {
  const bin = path.join(tmp, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const script = path.join(bin, "gh");
  fs.writeFileSync(script, `#!/bin/sh
cat <<'JSON'
{"title":"Issue title","body":"ISSUE_BODY_433","labels":[],"state":"OPEN"}
JSON
`, { mode: 0o755 });
  fs.chmodSync(script, 0o755);
  return bin;
}

function installPreparePlugin(tmp) {
  writeJson(tmp, ".senti/config.local.json", {
    plugin: {
      sources: [{ id: "prepare-proof-src", type: "local", path: ".senti/plugins/prepare-proof" }],
      packages: [{
        id: "prepare-proof",
        source: "prepare-proof-src",
        commit: "0000000000000000000000000000000000000000",
      }],
    },
  });
  writeJson(tmp, ".senti/plugins/prepare-proof/plugin.json", {
    name: "prepare-proof",
    files: ["plugin.json", "hooks/"],
    contributions: { hooks: [{ path: "hooks/prepare.js" }] },
  });
  const hookPath = path.join(tmp, ".senti/plugins/prepare-proof/hooks/prepare.js");
  fs.mkdirSync(path.dirname(hookPath), { recursive: true });
  fs.writeFileSync(hookPath, `
export default function register(api) {
  return class PrepareProofHook extends api.FlowCommandHook {
    static command = "prepare";
    static hook = "post";
    async run(context) {
      await context.artifacts.writeJson("seen.json", { runId: context.flow.runId });
      return context.envelope.ok("plugin-hook", "prepare", {});
    }
  };
}
`);
  commitAll(tmp, "add prepare proof plugin");
}

function captureStderr(fn) {
  const original = process.stderr.write;
  let stderr = "";
  process.stderr.write = (chunk) => {
    stderr += String(chunk);
    return true;
  };
  try {
    return { result: fn(), stderr };
  } finally {
    process.stderr.write = original;
  }
}

describe("Issue #433 preparing-flow data integrity", () => {
  const roots = [];

  afterEach(() => {
    while (roots.length > 0) removeTmpDir(roots.pop());
  });

  it("R1: init preserves an aged unrelated record byte-identically and reports it", () => {
    const tmp = createTmpDir("spec-319-init-");
    roots.push(tmp);
    setupProject(tmp);
    const fm = makeFlowManager(tmp);
    const unrelated = fm.generateRunId();
    fm.createPreparingFlow(unrelated, { issue: 10, request: "keep exactly" });
    const before = snapshot(tmp, unrelated);
    ageByHours(preparingPath(tmp, unrelated), 2);

    const { result, stderr } = captureStderr(() =>
      new SetInitCommand().execute({ flowManager: fm, root: tmp, issue: 11 }),
    );

    assert.ok(result.runId);
    assert.equal(fs.existsSync(preparingPath(tmp, unrelated)), true);
    assert.deepEqual(snapshot(tmp, unrelated), before);
    assert.match(stderr, new RegExp(`WARN: 1 preparing flow\\(s\\) already exist: ${unrelated}`));
  });

  it("R1: init bounds warning output at 100 without modifying records beyond the bound", () => {
    const tmp = createTmpDir("spec-319-init-bound-");
    roots.push(tmp);
    setupProject(tmp);
    const fm = makeFlowManager(tmp);
    const runIds = [];
    const before = new Map();
    for (let i = 0; i < PREPARING_SCAN_LIMIT + 1; i += 1) {
      const runId = fm.generateRunId();
      runIds.push(runId);
      fm.createPreparingFlow(runId, { issue: 1000 + i });
      before.set(runId, snapshot(tmp, runId));
      ageByHours(preparingPath(tmp, runId), 2);
    }
    const listed = fm.listPreparingFlows();
    const omitted = runIds.filter((runId) => !listed.includes(runId));

    const { stderr } = captureStderr(() =>
      new SetInitCommand().execute({ flowManager: fm, root: tmp, issue: 2000 }),
    );

    assert.equal(listed.length, PREPARING_SCAN_LIMIT);
    assert.equal(omitted.length, 1);
    assert.match(stderr, new RegExp(`WARN: ${PREPARING_SCAN_LIMIT} preparing flow\\(s\\) already exist:`));
    for (const runId of listed) assert.match(stderr, new RegExp(runId));
    assert.doesNotMatch(stderr, new RegExp(omitted[0]));
    for (const runId of runIds) {
      assert.equal(fs.existsSync(preparingPath(tmp, runId)), true);
      assert.deepEqual(snapshot(tmp, runId), before.get(runId));
    }
  });

  it("R2: successful prepare deletes only its target after preserving an aged unrelated record", () => {
    const tmp = createTmpDir("spec-319-prepare-success-");
    roots.push(tmp);
    setupProject(tmp);
    const fm = makeFlowManager(tmp);
    const unrelated = fm.generateRunId();
    const target = fm.generateRunId();
    fm.createPreparingFlow(unrelated, { issue: 20 });
    fm.createPreparingFlow(target, { issue: 21, request: "convert target" });
    const unrelatedBefore = snapshot(tmp, unrelated);
    ageByHours(preparingPath(tmp, unrelated), 2);

    const result = runCli(tmp, [
      "flow", "prepare", "--title", "target-only", "--no-branch", "--run-id", target,
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(preparingPath(tmp, target)), false);
    assert.equal(fs.existsSync(preparingPath(tmp, unrelated)), true);
    assert.deepEqual(snapshot(tmp, unrelated), unrelatedBefore);
    const data = JSON.parse(result.stdout).data;
    assert.equal(data.runId, target);
    assert.equal(data.result, "ok");
  });

  it("R3: prepare failure after target resolution preserves target and unrelated bytes", () => {
    const tmp = createTmpDir("spec-319-prepare-failure-");
    roots.push(tmp);
    setupProject(tmp, "missing-preset-for-failure");
    const fm = makeFlowManager(tmp);
    const unrelated = fm.generateRunId();
    const target = fm.generateRunId();
    fm.createPreparingFlow(unrelated, { issue: 30 });
    fm.createPreparingFlow(target, { issue: 31, request: "must remain retryable" });
    const unrelatedBefore = snapshot(tmp, unrelated);
    const targetBefore = snapshot(tmp, target);

    const result = runCli(tmp, [
      "flow", "prepare", "--title", "forced-failure", "--no-branch", "--run-id", target,
    ]);

    assert.notEqual(result.status, 0, "fixture must fail after preparing-state resolution");
    assert.equal(fs.existsSync(preparingPath(tmp, target)), true);
    assert.equal(fs.existsSync(preparingPath(tmp, unrelated)), true);
    assert.deepEqual(snapshot(tmp, target), targetBefore);
    assert.deepEqual(snapshot(tmp, unrelated), unrelatedBefore);
  });

  it("R4: production init and prepare sources expose no global TTL prune path", () => {
    const initSource = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/set-init.js"), "utf8");
    const prepareSource = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-prepare-spec.js"), "utf8");
    const storeSource = fs.readFileSync(path.join(REPO_ROOT, "src/lib/preparing-flow-store.js"), "utf8");
    const managerSource = fs.readFileSync(path.join(REPO_ROOT, "src/lib/flow-manager.js"), "utf8");
    const helpersSource = fs.readFileSync(path.join(REPO_ROOT, "src/lib/flow-helpers.js"), "utf8");

    assert.doesNotMatch(initSource, /pruneStalePreparingFlowsAndList/);
    assert.doesNotMatch(prepareSource, /cleanStalePreparingFlows/);
    assert.doesNotMatch(storeSource, /cleanStale|pruneStale|PREPARING_TTL_MS/);
    assert.doesNotMatch(managerSource, /cleanStalePreparingFlows|pruneStalePreparingFlowsAndList/);
    assert.doesNotMatch(helpersSource, /PREPARING_TTL_MS/);
    assert.equal(PREPARING_SCAN_LIMIT, 100);
  });

  it("R5: init retains its response and warning contract without consuming aged state", () => {
    const tmp = createTmpDir("spec-319-init-contract-");
    roots.push(tmp);
    setupProject(tmp);
    const fm = makeFlowManager(tmp);
    const unrelated = fm.generateRunId();
    fm.createPreparingFlow(unrelated, { request: "existing" });
    const before = snapshot(tmp, unrelated);
    ageByHours(preparingPath(tmp, unrelated), 61 / 60);

    const result = runCli(tmp, ["flow", "set", "init", "--request", "new request"]);

    assert.equal(result.status, 0, result.stderr);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, true);
    assert.ok(envelope.data.runId);
    assert.equal(envelope.data.request, "new request");
    assert.match(result.stderr, /\[flow\] WARN: 1 preparing flow\(s\) already exist:/);
    assert.equal(fs.existsSync(preparingPath(tmp, unrelated)), true);
    assert.deepEqual(snapshot(tmp, unrelated), before);
  });

  it("R5: init retains issue validation, issue-body persistence, and response fields", () => {
    const tmp = createTmpDir("spec-319-init-issue-");
    roots.push(tmp);
    setupProject(tmp);
    const extraPath = installFakeGh(tmp);
    const invalid = runCli(tmp, ["flow", "set", "init", "--issue", "0"], { extraPath });
    assert.notEqual(invalid.status, 0);
    assert.ok(JSON.parse(invalid.stdout).errors.some((error) => error.code === "INVALID_ARG_VALUE"));

    const fm = makeFlowManager(tmp);
    const unrelated = fm.generateRunId();
    fm.createPreparingFlow(unrelated, { request: "unrelated" });
    const before = snapshot(tmp, unrelated);
    ageByHours(preparingPath(tmp, unrelated), 2);
    const result = runCli(tmp, [
      "flow", "set", "init", "--issue", "433", "--request", "new request",
    ], { extraPath });

    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout).data;
    assert.ok(data.runId);
    assert.equal(data.issue, 433);
    assert.match(data.issueBody, /ISSUE_BODY_433/);
    assert.equal(data.request, "new request");
    const persisted = JSON.parse(fs.readFileSync(preparingPath(tmp, data.runId), "utf8"));
    assert.equal(persisted.issue, 433);
    assert.match(persisted.issueBody, /ISSUE_BODY_433/);
    assert.equal(persisted.request, "new request");
    assert.deepEqual(snapshot(tmp, unrelated), before);
  });

  it("R5: prepare retains guards, inherited inputs, worktree artifacts, lifecycle, registry, and response fields", () => {
    const tmp = createTmpDir("spec-319-prepare-contract-");
    roots.push(tmp);
    setupProject(tmp);
    installPreparePlugin(tmp);
    const fm = makeFlowManager(tmp);
    const unrelated = fm.generateRunId();
    const target = fm.generateRunId();
    fm.createPreparingFlow(unrelated, { issue: 432, request: "preserve this record" });
    fm.createPreparingFlow(target, {
      issue: 433,
      request: "inherit this request",
      issueBody: "ISSUE_BODY_PREPARE",
    });
    const unrelatedBefore = snapshot(tmp, unrelated);
    ageByHours(preparingPath(tmp, unrelated), 2);
    const targetBefore = snapshot(tmp, target);

    const mismatch = runCli(tmp, [
      "flow", "prepare", "--title", "guarded-contract", "--base", "main", "--worktree",
      "--run-id", target, "--expect-run-id", "wrong-run-id", "--expect-issue", "433",
    ]);
    assert.notEqual(mismatch.status, 0);
    assert.deepEqual(snapshot(tmp, target), targetBefore);

    const result = runCli(tmp, [
      "flow", "prepare", "--title", "guarded-contract", "--base", "main", "--worktree",
      "--run-id", target, "--expect-run-id", target, "--expect-issue", "433",
    ]);

    assert.equal(result.status, 0, result.stderr);
    const data = JSON.parse(result.stdout).data;
    for (const field of [
      "result", "runId", "issue", "spec", "worktreePath", "changed", "artifacts", "next", "output",
    ]) assert.ok(Object.hasOwn(data, field), `missing response field ${field}`);
    assert.equal(data.result, "ok");
    assert.equal(data.runId, target);
    assert.equal(data.issue, 433);
    assert.equal(data.worktreePath, data.artifacts.worktree);
    assert.equal(data.artifacts.mode, "worktree");
    assert.equal(data.artifacts.branch.startsWith("feature/"), true);
    assert.equal(fs.existsSync(preparingPath(tmp, target)), false);
    assert.equal(fs.existsSync(preparingPath(tmp, unrelated)), true);
    assert.deepEqual(snapshot(tmp, unrelated), unrelatedBefore);

    const specDir = path.join(data.worktreePath, data.artifacts.specDir);
    for (const file of ["spec.json", "draft.json", "flow.json", "issue.md"]) {
      assert.equal(fs.existsSync(path.join(specDir, file)), true, `${file} should exist`);
    }
    const flow = JSON.parse(fs.readFileSync(path.join(specDir, "flow.json"), "utf8"));
    assert.equal(flow.issue, 433);
    assert.equal(flow.request, "inherit this request");
    assert.ok(flow.plugins.flowCommandHooks.some((hook) => hook.pluginId === "prepare-proof"));
    const pluginArtifact = JSON.parse(fs.readFileSync(
      path.join(specDir, "plugin-artifacts/prepare-proof/seen.json"), "utf8",
    ));
    assert.equal(pluginArtifact.runId, target);
    assert.equal(fs.existsSync(path.join(data.worktreePath, ".senti/output/analysis.json")), true);
    assert.ok(fm.loadActiveFlows().some((entry) => entry.spec === path.basename(data.artifacts.specDir)));
  });

  it("R6: shared regression tests contain preservation assertions instead of TTL deletion contracts", () => {
    const setInitTest = fs.readFileSync(path.join(REPO_ROOT, "tests/unit/flow/set-init-cleanup.test.js"), "utf8");
    const staleTestPath = path.join(REPO_ROOT, "tests/unit/flow/clean-stale-preparing-flows.test.js");
    const flowStateTest = fs.readFileSync(path.join(REPO_ROOT, "tests/unit/lib/flow-state-runid.test.js"), "utf8");

    assert.match(setInitTest, /byte-identical|deepEqual\([^\n]+before/);
    assert.doesNotMatch(setInitTest, /deletes stale preparing files/);
    assert.equal(fs.existsSync(staleTestPath), false);
    assert.doesNotMatch(flowStateTest, /older than TTL can be identified/);
  });
});
