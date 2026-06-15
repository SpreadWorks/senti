// spec: R1 R2 R3 R4 R5 R6
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const SENTI = path.join(ROOT, "src", "senti.js");

function projectConfig(extra = {}) {
  return {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    scan: { include: ["src/**/*.js"], exclude: [] },
    ...extra,
  };
}

function setupCommittedProject(prefix = "senti-299-", configExtra = {}, beforeCommit = () => {}) {
  const root = createTmpDir(prefix);
  writeJson(root, "package.json", { name: "spec-299-fixture", version: "1.0.0", type: "module" });
  writeFile(root, "src/index.js", "export const value = 1;\n");
  writeJson(root, ".senti/config.json", projectConfig(configExtra));
  beforeCommit(root);
  initGitRepo(root);
  commitAll(root, "initial");
  return root;
}

function pluginRuntimeConfig() {
  return {
    plugin: {
      sources: [{ id: "workflow", type: "local", path: ".senti/plugins/workflow" }],
      packages: [{ id: "workflow", source: "workflow", commit: "0000000000000000000000000000000000000000" }],
    },
  };
}

function writePluginRuntime(root) {
  writeJson(root, ".senti/plugins/workflow/plugin.json", {
    name: "workflow",
    files: ["plugin.json", "hooks/"],
    contributions: {
      hooks: [{ path: "hooks/prepare.js" }],
    },
  });
  writeFile(root, ".senti/plugins/workflow/hooks/prepare.js", `
export default function register(api) {
  return class PrepareHook extends api.FlowCommandHook {
    static command = "prepare";
    static hook = "post";
    async run(context) {
      return context.envelope.ok("plugin-hook", "prepare", {});
    }
  };
}
`);
}

function setupProjectWithoutCommittedConfig(prefix = "senti-299-missing-") {
  const root = createTmpDir(prefix);
  writeJson(root, "package.json", { name: "spec-299-fixture", version: "1.0.0", type: "module" });
  writeFile(root, "src/index.js", "export const value = 1;\n");
  initGitRepo(root);
  commitAll(root, "initial without config");
  writeJson(root, ".senti/config.json", projectConfig());
  return root;
}

function runSenti(cwd, args) {
  return spawnSync("node", [SENTI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: cwd },
  });
}

function parseEnvelope(result) {
  assert.ok(result.stdout.trim(), result.stderr || "expected JSON envelope on stdout");
  return JSON.parse(result.stdout);
}

function git(cwd, args) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function worktreeEntries(root) {
  const dir = path.join(root, ".senti", "worktree");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir);
}

function branchList(root) {
  const result = git(root, ["branch", "--list", "feature/*"]);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split("\n").map((line) => line.replace(/^[* ]+/, "").trim()).filter(Boolean);
}

function commitCount(root) {
  const result = git(root, ["rev-list", "--count", "HEAD"]);
  assert.equal(result.status, 0, result.stderr);
  return Number(result.stdout.trim());
}

function statusFor(root, relPath) {
  const result = git(root, ["status", "--short", "--", relPath]);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function assertNoPrepareSideEffects(root) {
  assert.deepEqual(worktreeEntries(root), [], "preflight halt must not create a worktree directory");
  assert.deepEqual(branchList(root), [], "preflight halt must not create a feature branch");
}

function assertRequiredConfigHalt(result, expectedStatus) {
  const envelope = parseEnvelope(result);
  assert.equal(envelope.ok, false, JSON.stringify(envelope));
  const text = JSON.stringify(envelope);
  assert.match(text, /\.senti\/config\.json/);
  assert.match(text, new RegExp(expectedStatus, "i"));
  assert.match(text, /reflect|reflected|checkout|worktree|branch/i);
  assert.match(text, /commit/i);
  assert.match(text, /continue|resume|retry|rerun/i);
  assert.match(text, /abort/i);
  return envelope;
}

describe("spec 299: worktree config preflight", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R1: halts before worktree and branch side effects when required config is unreflected", () => {
    tmp = setupProjectWithoutCommittedConfig("senti-299-side-effects-");

    const result = runSenti(tmp, [
      "flow",
      "prepare",
      "--title",
      "missing-config",
      "--worktree",
      "--request",
      "side effect check",
    ]);

    assertRequiredConfigHalt(result, "missing|untracked");
    assertNoPrepareSideEffects(tmp);
  });

  it("R2: reports missing branch-reflected config before git worktree add", () => {
    tmp = setupProjectWithoutCommittedConfig("senti-299-missing-");

    const result = runSenti(tmp, [
      "flow",
      "prepare",
      "--title",
      "missing-config",
      "--worktree",
      "--request",
      "missing config check",
    ]);

    assertRequiredConfigHalt(result, "missing|untracked");
    assertNoPrepareSideEffects(tmp);
  });

  it("R3: reports staged config changes that would not be reflected", () => {
    tmp = setupCommittedProject("senti-299-staged-");
    writeJson(tmp, ".senti/config.json", projectConfig({ concurrency: 2 }));
    assert.equal(git(tmp, ["add", ".senti/config.json"]).status, 0);

    const result = runSenti(tmp, [
      "flow",
      "prepare",
      "--title",
      "staged-config",
      "--worktree",
      "--request",
      "staged config check",
    ]);

    assertRequiredConfigHalt(result, "staged");
    assertNoPrepareSideEffects(tmp);
  });

  it("R3: reports unstaged config changes that would not be reflected", () => {
    tmp = setupCommittedProject("senti-299-unstaged-");
    writeJson(tmp, ".senti/config.json", projectConfig({ concurrency: 3 }));

    const result = runSenti(tmp, [
      "flow",
      "prepare",
      "--title",
      "unstaged-config",
      "--worktree",
      "--request",
      "unstaged config check",
    ]);

    assertRequiredConfigHalt(result, "unstaged|modified");
    assertNoPrepareSideEffects(tmp);
  });

  it("R4: preserves preparing state on required config halt", () => {
    tmp = setupProjectWithoutCommittedConfig("senti-299-run-id-");
    const init = parseEnvelope(runSenti(tmp, ["flow", "set", "init", "--request", "run id preservation"]));
    const runId = init.data.runId;
    const preparingPath = path.join(tmp, ".senti", `.active-flow.${runId}`);
    assert.equal(fs.existsSync(preparingPath), true, "preparing state should exist before prepare");

    const result = runSenti(tmp, [
      "flow",
      "prepare",
      "--title",
      "run-id-preservation",
      "--worktree",
      "--run-id",
      runId,
    ]);

    assertRequiredConfigHalt(result, "missing|untracked");
    assert.equal(fs.existsSync(preparingPath), true, "preflight halt must preserve preparing state");
    const preparing = JSON.parse(fs.readFileSync(preparingPath, "utf8"));
    assert.equal(preparing.runId, runId);
    assert.equal(preparing.request, "run id preservation");
    assertNoPrepareSideEffects(tmp);
  });

  it("R5: succeeds and preserves local overlay sync when config is branch-reflected", () => {
    tmp = setupCommittedProject("senti-299-success-", pluginRuntimeConfig(), writePluginRuntime);
    writeJson(tmp, ".senti/config.local.json", {
      plugin: {
        config: { workflow: { localOverlay: true } },
      },
    });

    const result = runSenti(tmp, [
      "flow",
      "prepare",
      "--title",
      "clean-config",
      "--worktree",
      "--request",
      "clean config check",
    ]);
    const envelope = parseEnvelope(result);

    assert.equal(envelope.ok, true, JSON.stringify(envelope));
    const worktree = envelope.data.artifacts.worktree;
    assert.ok(fs.existsSync(worktree), "worktree should be created on clean config");
    assert.ok(fs.existsSync(path.join(worktree, envelope.data.artifacts.specDir, "spec.json")));
    assert.ok(fs.existsSync(path.join(worktree, envelope.data.artifacts.specDir, "draft.json")));
    assert.ok(fs.existsSync(path.join(worktree, ".senti", "output", "analysis.json")));
    assert.ok(fs.existsSync(path.join(worktree, ".senti", "config.local.json")));
    assert.ok(fs.existsSync(path.join(worktree, ".senti", "plugins", "workflow", "hooks", "prepare.js")));
  });

  it("R6: does not apply the required config halt to no-branch prepare", () => {
    tmp = setupCommittedProject("senti-299-no-branch-");
    writeJson(tmp, ".senti/config.json", projectConfig({ concurrency: 4 }));

    const result = runSenti(tmp, [
      "flow",
      "prepare",
      "--title",
      "no-branch-config",
      "--no-branch",
      "--request",
      "no branch check",
    ]);
    const envelope = parseEnvelope(result);

    assert.equal(envelope.ok, true, JSON.stringify(envelope));
    assert.equal(envelope.data.artifacts.mode, "spec-only");
    assert.deepEqual(worktreeEntries(tmp), []);
  });

  it("R6: preserves default branch prepare dirty-worktree behavior", () => {
    tmp = setupCommittedProject("senti-299-branch-mode-");
    writeJson(tmp, ".senti/config.json", projectConfig({ concurrency: 5 }));

    const result = runSenti(tmp, [
      "flow",
      "prepare",
      "--title",
      "branch-mode-config",
      "--request",
      "branch mode check",
    ]);
    const envelope = parseEnvelope(result);
    const text = JSON.stringify(envelope);

    assert.equal(envelope.ok, false, text);
    assert.match(text, /dirty worktree/i);
    assert.doesNotMatch(text, /abort/i);
    assertNoPrepareSideEffects(tmp);
  });

  it("R6: does not auto-copy or auto-commit unreflected config on worktree halt", () => {
    tmp = setupProjectWithoutCommittedConfig("senti-299-no-autofix-");
    const beforeCommits = commitCount(tmp);

    const result = runSenti(tmp, [
      "flow",
      "prepare",
      "--title",
      "no-autofix-config",
      "--worktree",
      "--request",
      "no autofix check",
    ]);

    assertRequiredConfigHalt(result, "missing|untracked");
    assertNoPrepareSideEffects(tmp);
    assert.equal(commitCount(tmp), beforeCommits, "preflight halt must not create a commit");
    assert.equal(statusFor(tmp, ".senti/config.json"), "?? .senti/config.json");
  });
});
