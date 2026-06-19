// spec: R1 R2 R3 R4 R5 R6 R7
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";

const cliPath = path.resolve("src/senti.js");
const tmpDirs = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) removeTmpDir(dir);
});

function tmpProject(name) {
  const dir = createTmpDir(`spec-312-${name}-`);
  tmpDirs.push(dir);
  return dir;
}

function runSenti(root, args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: root,
    env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: path.resolve("."), ...(options.env || {}) },
    input: options.input || "",
    encoding: "utf8",
  });
}

function assertSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function assertFailure(result) {
  assert.notEqual(result.status, 0, result.stdout || result.stderr);
}

function parseJson(result) {
  assertSuccess(result);
  try {
    return JSON.parse(result.stdout);
  } catch {
    assert.fail(`stdout must be JSON, got: ${result.stdout}`);
  }
}

function gitHead(repo) {
  return execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function writeSkillPlugin(sourceRoot, id, body) {
  const skillName = `${id}-skill`;
  writeJson(sourceRoot, "plugin.json", {
    name: id,
    type: "mixed",
    files: ["plugin.json", "skills/"],
    contributions: {
      skills: [{ name: skillName, path: `skills/${skillName}` }],
    },
  });
  writeFile(sourceRoot, `skills/${skillName}/SKILL.md`, `---\nname: ${skillName}\ndescription: fixture skill\n---\n${body}\n`);
}

function createPluginSource(root, id, body = "version one") {
  const sourceRoot = path.join(root, `${id}-source`);
  writeSkillPlugin(sourceRoot, id, body);
  initGitRepo(sourceRoot);
  commitAll(sourceRoot, `create ${id}`);
  return { sourceRoot, commit: gitHead(sourceRoot) };
}

function updatePluginSource(sourceRoot, id, body) {
  writeSkillPlugin(sourceRoot, id, body);
  commitAll(sourceRoot, `update ${id}`);
  return gitHead(sourceRoot);
}

function writeProjectConfig(root, sources, packages) {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: { sources, packages },
  });
}

function readPackages(root) {
  return JSON.parse(fs.readFileSync(path.join(root, ".senti", "config.json"), "utf8")).plugin.packages;
}

function sourceEntry(id, sourceRoot) {
  return { id, type: "local", path: sourceRoot };
}

function packageEntry(id, source, commit, extra = {}) {
  return { id, source, commit, ...extra };
}

function writeUpgradeProbe(root) {
  const binDir = path.join(root, "bin");
  const logPath = path.join(root, "upgrade-invocations.log");
  writeFile(
    root,
    "bin/senti",
    `#!/usr/bin/env node\nimport fs from "node:fs";\nif (process.argv[2] === "upgrade") {\n  fs.appendFileSync(${JSON.stringify(logPath)}, "upgrade\\n");\n  process.exit(0);\n}\nprocess.exit(2);\n`,
  );
  fs.chmodSync(path.join(binDir, "senti"), 0o755);
  return {
    logPath,
    env: { PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}` },
  };
}

test("R1: bulk update lists candidates from a non-mutating plan before refusal leaves state unchanged", () => {
  const root = tmpProject("bulk-plan");
  const plugin = createPluginSource(root, "first-plugin", "before update");
  writeProjectConfig(root, [sourceEntry("first-source", plugin.sourceRoot)], [
    packageEntry("first-plugin", "first-source", plugin.commit),
  ]);
  const nextCommit = updatePluginSource(plugin.sourceRoot, "first-plugin", "after update");

  const output = parseJson(runSenti(root, ["plugin", "update", "--json", "--no-upgrade"], { input: "no\n" }));

  assert.match(resultText(output), /first-plugin/);
  assert.match(resultText(output), new RegExp(plugin.commit));
  assert.match(resultText(output), new RegExp(nextCommit));
  assert.equal(readPackages(root)[0].commit, plugin.commit);
});

test("R2: accepted bulk update applies the enabled-package plan", () => {
  const root = tmpProject("bulk-accept");
  const first = createPluginSource(root, "first-plugin", "before first update");
  const second = createPluginSource(root, "second-plugin", "before second update");
  writeProjectConfig(root, [
    sourceEntry("first-source", first.sourceRoot),
    sourceEntry("second-source", second.sourceRoot),
  ], [
    packageEntry("first-plugin", "first-source", first.commit),
    packageEntry("second-plugin", "second-source", second.commit),
  ]);
  const firstNext = updatePluginSource(first.sourceRoot, "first-plugin", "after first update");
  const secondNext = updatePluginSource(second.sourceRoot, "second-plugin", "after second update");

  const result = runSenti(root, ["plugin", "update", "--json", "--no-upgrade"], { input: " YES \n" });
  const output = parseJson(result);
  const packages = readPackages(root);

  assert.match(result.stderr, /Update all installed plugins/i);
  assert.equal(packages.find((pkg) => pkg.id === "first-plugin").commit, firstNext);
  assert.equal(packages.find((pkg) => pkg.id === "second-plugin").commit, secondNext);
  assert.equal(output.upgrade.ran, false);
});

test("R3: refused bulk update does not mutate commits or installed files", () => {
  for (const [name, input] of [
    ["empty", "\n"],
    ["n", "n\n"],
    ["no", "no\n"],
    ["other", "later\n"],
  ]) {
    const root = tmpProject(`bulk-refuse-${name}`);
    const plugin = createPluginSource(root, "first-plugin", "before update");
    writeProjectConfig(root, [sourceEntry("first-source", plugin.sourceRoot)], [
      packageEntry("first-plugin", "first-source", plugin.commit),
    ]);
    updatePluginSource(plugin.sourceRoot, "first-plugin", "after update");

    const output = parseJson(runSenti(root, ["plugin", "update", "--json", "--no-upgrade"], { input }));

    assert.equal(readPackages(root)[0].commit, plugin.commit, `${name} must not update config commit`);
    assert.equal(fs.existsSync(path.join(root, ".senti", "plugins", "first-plugin", "plugin.json")), false, `${name} must not install plugin files`);
    assert.equal(output.upgrade.ran, false, `${name} must not run upgrade`);
  }
});

test("R4: single update only updates the named installed plugin without bulk confirmation", () => {
  const root = tmpProject("single-update");
  const first = createPluginSource(root, "first-plugin", "before first update");
  const second = createPluginSource(root, "second-plugin", "before second update");
  writeProjectConfig(root, [
    sourceEntry("first-source", first.sourceRoot),
    sourceEntry("second-source", second.sourceRoot),
  ], [
    packageEntry("first-plugin", "first-source", first.commit),
    packageEntry("second-plugin", "second-source", second.commit),
  ]);
  const firstNext = updatePluginSource(first.sourceRoot, "first-plugin", "after first update");
  updatePluginSource(second.sourceRoot, "second-plugin", "after second update");

  const result = runSenti(root, ["plugin", "update", "first-plugin", "--json", "--no-upgrade"]);
  const output = parseJson(result);
  const packages = readPackages(root);

  assert.doesNotMatch(result.stderr, /Update all installed plugins/i);
  assert.equal(packages.find((pkg) => pkg.id === "first-plugin").commit, firstNext);
  assert.equal(packages.find((pkg) => pkg.id === "second-plugin").commit, second.commit);
  assert.equal(output.package.id, "first-plugin");
});

test("R5: migrated bulk update excludes disabled packages and preserves result metadata", () => {
  const root = tmpProject("bulk-disabled");
  const enabled = createPluginSource(root, "enabled-plugin", "enabled before");
  const disabled = createPluginSource(root, "disabled-plugin", "disabled before");
  writeProjectConfig(root, [
    sourceEntry("enabled-source", enabled.sourceRoot),
    sourceEntry("disabled-source", disabled.sourceRoot),
  ], [
    packageEntry("enabled-plugin", "enabled-source", enabled.commit),
    packageEntry("disabled-plugin", "disabled-source", disabled.commit, { enabled: false }),
  ]);
  const enabledNext = updatePluginSource(enabled.sourceRoot, "enabled-plugin", "enabled after");
  updatePluginSource(disabled.sourceRoot, "disabled-plugin", "disabled after");

  const output = parseJson(runSenti(root, ["plugin", "update", "--json", "--no-upgrade"], { input: "yes\n" }));
  const packages = readPackages(root);

  assert.equal(packages.find((pkg) => pkg.id === "enabled-plugin").commit, enabledNext);
  assert.equal(packages.find((pkg) => pkg.id === "disabled-plugin").commit, disabled.commit);
  assert.equal(output.packages.find((pkg) => pkg.id === "enabled-plugin").previousCommit, enabled.commit);
  assert.equal(output.packages.some((pkg) => pkg.id === "disabled-plugin"), false);
});

test("R5: accepted bulk update runs upgrade once and no-candidate bulk update skips upgrade", () => {
  const changedRoot = tmpProject("bulk-upgrade-run");
  const changed = createPluginSource(changedRoot, "first-plugin", "before update");
  writeProjectConfig(changedRoot, [sourceEntry("first-source", changed.sourceRoot)], [
    packageEntry("first-plugin", "first-source", changed.commit),
  ]);
  updatePluginSource(changed.sourceRoot, "first-plugin", "after update");
  const changedProbe = writeUpgradeProbe(changedRoot);

  const changedOutput = parseJson(runSenti(changedRoot, ["plugin", "update", "--json"], {
    input: "y\n",
    env: changedProbe.env,
  }));

  assert.equal(changedOutput.upgrade.ran, true);
  assert.equal(fs.readFileSync(changedProbe.logPath, "utf8").trim(), "upgrade");

  const currentRoot = tmpProject("bulk-upgrade-skip");
  const current = createPluginSource(currentRoot, "first-plugin", "current version");
  writeProjectConfig(currentRoot, [sourceEntry("first-source", current.sourceRoot)], [
    packageEntry("first-plugin", "first-source", current.commit),
  ]);
  const currentProbe = writeUpgradeProbe(currentRoot);

  const currentOutput = parseJson(runSenti(currentRoot, ["plugin", "update", "--json"], {
    env: currentProbe.env,
  }));

  assert.equal(currentOutput.upgrade.ran, false);
  assert.equal(currentOutput.upgrade.skipReason, "no package updates");
  assert.equal(fs.existsSync(currentProbe.logPath), false);
});

test("R6: help advertises update and update-all fails without updating", () => {
  const root = tmpProject("update-all-removed");
  const plugin = createPluginSource(root, "first-plugin", "before update");
  writeProjectConfig(root, [sourceEntry("first-source", plugin.sourceRoot)], [
    packageEntry("first-plugin", "first-source", plugin.commit),
  ]);
  updatePluginSource(plugin.sourceRoot, "first-plugin", "after update");

  const help = runSenti(root, ["plugin", "--help"]);
  assertSuccess(help);
  assert.match(help.stdout, /update\s+Update installed plugin packages/);
  assert.doesNotMatch(help.stdout, /update-all/);

  const removed = runSenti(root, ["plugin", "update-all", "--json", "--no-upgrade"]);
  assertFailure(removed);
  assert.match(removed.stderr, /unknown plugin command: update-all/);
  assert.equal(readPackages(root)[0].commit, plugin.commit);
});

test("R7: no-candidate bulk update reports no updates without prompting", () => {
  const root = tmpProject("bulk-no-candidates");
  const plugin = createPluginSource(root, "first-plugin", "current version");
  writeProjectConfig(root, [sourceEntry("first-source", plugin.sourceRoot)], [
    packageEntry("first-plugin", "first-source", plugin.commit),
  ]);

  const result = runSenti(root, ["plugin", "update", "--json", "--no-upgrade"]);
  const output = parseJson(result);

  assert.doesNotMatch(result.stderr, /Update all installed plugins/i);
  assert.equal(output.upgrade.ran, false);
  assert.match(resultText(output), /no package updates|updated/i);
  assert.equal(readPackages(root)[0].commit, plugin.commit);
});

function resultText(value) {
  return JSON.stringify(value);
}
