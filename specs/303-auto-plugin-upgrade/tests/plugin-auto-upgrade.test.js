// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10
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
  const dir = createTmpDir(`spec-303-${name}`);
  tmpDirs.push(dir);
  return dir;
}

function runSenti(root, args, options = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: root,
    env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: root, ...(options.env || {}) },
    encoding: "utf8",
  });
}

function assertSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function assertFailure(result) {
  assert.notEqual(result.status, 0, result.stdout || result.stderr);
}

function parseJsonOutput(result) {
  assertSuccess(result);
  try {
    return JSON.parse(result.stdout);
  } catch {
    assert.fail(`stdout must be JSON, got: ${result.stdout}`);
  }
}

function parseJsonFailureOutput(result) {
  assertFailure(result);
  try {
    return JSON.parse(result.stdout);
  } catch {
    assert.fail(`failure stdout must be JSON, got: ${result.stdout}`);
  }
}

function gitHead(repo) {
  return execFileSync("git", ["-C", repo, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
}

function writeSkillPlugin(sourceRoot, id, body, options = {}) {
  const skillName = options.skillName || `${id}-skill`;
  const files = ["plugin.json", "skills/", ...(options.files || [])];
  writeJson(sourceRoot, "plugin.json", {
    name: id,
    type: "mixed",
    files,
    contributions: {
      skills: [{ name: skillName, path: `skills/${skillName}` }],
    },
  });
  writeFile(
    sourceRoot,
    `skills/${skillName}/SKILL.md`,
    `---\nname: ${skillName}\ndescription: fixture skill\n---\n${body}\n`,
  );
}

function createPluginSource(root, id, body = "version one", options = {}) {
  const sourceRoot = path.join(root, `${id}-source`);
  writeSkillPlugin(sourceRoot, id, body, options);
  initGitRepo(sourceRoot);
  commitAll(sourceRoot, `create ${id}`);
  return { sourceRoot, commit: gitHead(sourceRoot), skillName: options.skillName || `${id}-skill` };
}

function createHookScriptPluginSource(root, id, markerPath) {
  const sourceRoot = path.join(root, `${id}-source`);
  writeSkillPlugin(sourceRoot, id, "script fixture", { files: ["hooks/"] });
  writeFile(
    sourceRoot,
    "hooks/postinstall.js",
    `import fs from "node:fs";\nfs.writeFileSync(${JSON.stringify(markerPath)}, "ran");\n`,
  );
  initGitRepo(sourceRoot);
  commitAll(sourceRoot, `create ${id}`);
  return { sourceRoot, commit: gitHead(sourceRoot), skillName: `${id}-skill` };
}

function updatePluginSource(sourceRoot, id, body, options = {}) {
  writeSkillPlugin(sourceRoot, id, body, options);
  commitAll(sourceRoot, `update ${id}`);
  return gitHead(sourceRoot);
}

function writeProjectConfigEntries(root, sources, packages = []) {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources,
      packages,
    },
  });
}

function writeProjectConfig(root, sourceRoot, packages = []) {
  writeProjectConfigEntries(root, [{ id: "fixture-source", type: "local", path: sourceRoot }], packages);
}

function sourceEntry(id, sourceRoot) {
  return { id, type: "local", path: sourceRoot };
}

function packageEntry(id, source, commit) {
  return { id, source, commit };
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

function deployedSkill(root, skillName) {
  return path.join(root, ".agents", "skills", skillName, "SKILL.md");
}

function assertDeployedSkillContains(root, skillName, pattern) {
  const file = deployedSkill(root, skillName);
  assert.equal(fs.existsSync(file), true, `${file} must exist`);
  assert.match(fs.readFileSync(file, "utf8"), pattern);
}

test("R1: install runs upgrade and deploys plugin skill by default", () => {
  const root = tmpProject("install-upgrade");
  const plugin = createPluginSource(root, "sample-plugin", "installed by upgrade");
  writeProjectConfig(root, plugin.sourceRoot);

  const result = runSenti(root, ["plugin", "install", "sample-plugin"]);

  assertSuccess(result);
  assertDeployedSkillContains(root, plugin.skillName, /installed by upgrade/);

  const probeRoot = tmpProject("install-upgrade-probe");
  const probePlugin = createPluginSource(probeRoot, "sample-plugin", "probe install");
  writeProjectConfig(probeRoot, probePlugin.sourceRoot);
  const probe = writeUpgradeProbe(probeRoot);

  const probeResult = runSenti(probeRoot, ["plugin", "install", "sample-plugin"], { env: probe.env });

  assertSuccess(probeResult);
  assert.equal(fs.existsSync(probe.logPath), true, "install must invoke senti upgrade through PATH");
  assert.equal(fs.readFileSync(probe.logPath, "utf8").trim().split(/\n/).length, 1);
});

test("R2: update-all records package change metadata and runs upgrade once after changed packages", () => {
  const root = tmpProject("update-all-changed");
  const first = createPluginSource(root, "first-plugin", "before first update");
  const second = createPluginSource(root, "second-plugin", "before second update");
  writeProjectConfigEntries(root, [
    sourceEntry("first-source", first.sourceRoot),
    sourceEntry("second-source", second.sourceRoot),
  ], [
    packageEntry("first-plugin", "first-source", first.commit),
    packageEntry("second-plugin", "second-source", second.commit),
  ]);
  const nextCommit = updatePluginSource(first.sourceRoot, "first-plugin", "after first update");
  const secondNextCommit = updatePluginSource(second.sourceRoot, "second-plugin", "after second update");

  const output = parseJsonOutput(runSenti(root, ["plugin", "update-all", "--json"]));

  assert.equal(Array.isArray(output.packages), true, "update-all JSON must include packages array");
  assert.equal(output.packages[0].id, "first-plugin");
  assert.equal(output.packages[0].previousCommit, first.commit);
  assert.equal(output.packages[0].commit, nextCommit);
  assert.equal(output.packages[0].updated, true);
  assert.equal(output.packages[1].id, "second-plugin");
  assert.equal(output.packages[1].previousCommit, second.commit);
  assert.equal(output.packages[1].commit, secondNextCommit);
  assert.equal(output.packages[1].updated, true);
  assert.equal(output.upgrade.ran, true);
  assert.equal(output.upgrade.succeeded, true);
  assertDeployedSkillContains(root, first.skillName, /after first update/);
  assertDeployedSkillContains(root, second.skillName, /after second update/);
});

test("R2: update-all bounds enabled package processing and reports a single upgrade line", () => {
  const boundedRoot = tmpProject("update-all-bound");
  const sources = [];
  const packages = [];
  for (let i = 0; i < 101; i++) {
    const id = `bounded-plugin-${String(i).padStart(3, "0")}`;
    const sourceId = `bounded-source-${String(i).padStart(3, "0")}`;
    const plugin = createPluginSource(boundedRoot, id, `bounded ${i}`);
    sources.push(sourceEntry(sourceId, plugin.sourceRoot));
    packages.push(packageEntry(id, sourceId, plugin.commit));
  }
  writeProjectConfigEntries(boundedRoot, sources, packages);
  const boundedProbe = writeUpgradeProbe(boundedRoot);

  const boundedResult = runSenti(boundedRoot, ["plugin", "update-all", "--no-upgrade"], { env: boundedProbe.env });

  assertFailure(boundedResult);
  assert.match(`${boundedResult.stdout}\n${boundedResult.stderr}`, /100|enabled plugin packages/i);
  assert.equal(fs.existsSync(boundedProbe.logPath), false, "bounded failure must not invoke senti upgrade");

  const humanRoot = tmpProject("update-all-one-upgrade-line");
  const first = createPluginSource(humanRoot, "first-plugin", "first old");
  const second = createPluginSource(humanRoot, "second-plugin", "second old");
  writeProjectConfigEntries(humanRoot, [
    sourceEntry("first-source", first.sourceRoot),
    sourceEntry("second-source", second.sourceRoot),
  ], [
    packageEntry("first-plugin", "first-source", first.commit),
    packageEntry("second-plugin", "second-source", second.commit),
  ]);
  updatePluginSource(first.sourceRoot, "first-plugin", "first new");
  updatePluginSource(second.sourceRoot, "second-plugin", "second new");
  const probe = writeUpgradeProbe(humanRoot);

  const result = runSenti(humanRoot, ["plugin", "update-all"], { env: probe.env });

  assertSuccess(result);
  assert.equal((result.stdout.match(/upgrade\s+(ran|skipped|failed)/gi) || []).length, 1);
  assert.equal(fs.existsSync(probe.logPath), true, "automatic upgrade must invoke senti upgrade through PATH");
  assert.equal(fs.readFileSync(probe.logPath, "utf8").trim().split(/\n/).length, 1);
});

test("R3: update-all skips upgrade and reports a skip reason when no package commits change", () => {
  const root = tmpProject("update-all-unchanged");
  const plugin = createPluginSource(root, "sample-plugin", "current version");
  writeProjectConfig(root, plugin.sourceRoot, [{ id: "sample-plugin", source: "fixture-source", commit: plugin.commit }]);
  const probe = writeUpgradeProbe(root);

  const output = parseJsonOutput(runSenti(root, ["plugin", "update-all", "--json"], { env: probe.env }));

  assert.equal(Array.isArray(output.packages), true, "update-all JSON must include packages array");
  assert.equal(output.packages[0].previousCommit, plugin.commit);
  assert.equal(output.packages[0].commit, plugin.commit);
  assert.equal(output.packages[0].updated, false);
  assert.equal(output.upgrade.ran, false);
  assert.match(output.upgrade.skipReason, /no package updates/i);
  assert.equal(fs.existsSync(probe.logPath), false, "unchanged update-all must not invoke senti upgrade");
});

test("R4: sync and source update do not trigger automatic upgrade after a plugin source changes", () => {
  const root = tmpProject("no-upgrade-for-sync");
  const plugin = createPluginSource(root, "sample-plugin", "deployed once");
  writeProjectConfig(root, plugin.sourceRoot);
  assertSuccess(runSenti(root, ["plugin", "install", "sample-plugin"]));
  updatePluginSource(plugin.sourceRoot, "sample-plugin", "not automatically deployed");
  const probe = writeUpgradeProbe(root);

  const syncResult = runSenti(root, ["plugin", "sync"], { env: probe.env });
  const sourceUpdateResult = runSenti(root, ["plugin", "source", "update"], { env: probe.env });

  assertSuccess(syncResult);
  assertSuccess(sourceUpdateResult);
  assert.equal(fs.existsSync(deployedSkill(root, plugin.skillName)), true, "initial install must deploy the plugin skill");
  const deployed = fs.readFileSync(deployedSkill(root, plugin.skillName), "utf8");
  assert.match(deployed, /deployed once/);
  assert.doesNotMatch(deployed, /not automatically deployed/);
  assert.doesNotMatch(`${syncResult.stdout}\n${sourceUpdateResult.stdout}`, /upgrade\s+(ran|failed)/i);
  assert.equal(fs.existsSync(probe.logPath), false, "sync and source update must not invoke senti upgrade");
});

test("R5: no-upgrade is accepted for install and update-all and documented only on those commands", () => {
  const root = tmpProject("no-upgrade-option");
  const plugin = createPluginSource(root, "sample-plugin", "not deployed");
  writeProjectConfig(root, plugin.sourceRoot);

  const installHelp = runSenti(root, ["plugin", "install", "--help"]);
  const updateAllHelp = runSenti(root, ["plugin", "update-all", "--help"]);
  const syncHelp = runSenti(root, ["plugin", "sync", "--help"]);
  const sourceUpdateHelp = runSenti(root, ["plugin", "source", "update", "--help"]);
  const result = runSenti(root, ["plugin", "install", "sample-plugin", "--no-upgrade"]);

  assertSuccess(result);
  assert.match(installHelp.stdout, /--no-upgrade/);
  assert.match(updateAllHelp.stdout, /--no-upgrade/);
  assert.doesNotMatch(syncHelp.stdout, /--no-upgrade/);
  assert.doesNotMatch(sourceUpdateHelp.stdout, /--no-upgrade/);
  assert.equal(fs.existsSync(deployedSkill(root, plugin.skillName)), false);

  const updateRoot = tmpProject("update-all-no-upgrade");
  const updatePlugin = createPluginSource(updateRoot, "sample-plugin", "old no-upgrade");
  writeProjectConfig(updateRoot, updatePlugin.sourceRoot, [
    packageEntry("sample-plugin", "fixture-source", updatePlugin.commit),
  ]);
  updatePluginSource(updatePlugin.sourceRoot, "sample-plugin", "new no-upgrade");

  const output = parseJsonOutput(runSenti(updateRoot, ["plugin", "update-all", "--json", "--no-upgrade"]));

  assert.equal(output.packages[0].updated, true);
  assert.equal(output.upgrade.ran, false);
  assert.match(output.upgrade.skipReason, /no-upgrade/i);
  assert.equal(fs.existsSync(deployedSkill(updateRoot, updatePlugin.skillName)), false);
});

test("R6: JSON output for install exposes plugin operation data and upgrade status", () => {
  const root = tmpProject("install-json");
  const plugin = createPluginSource(root, "sample-plugin", "json upgrade");
  writeProjectConfig(root, plugin.sourceRoot);

  const output = parseJsonOutput(runSenti(root, ["plugin", "install", "sample-plugin", "--json"]));

  assert.equal(output.package.id, "sample-plugin");
  assert.equal(output.package.source, "fixture-source");
  assert.equal(output.package.commit, plugin.commit);
  assert.equal(output.upgrade.ran, true);
  assert.equal(output.upgrade.succeeded, true);

  const noUpgradeRoot = tmpProject("install-json-no-upgrade");
  const noUpgradePlugin = createPluginSource(noUpgradeRoot, "sample-plugin", "json no-upgrade");
  writeProjectConfig(noUpgradeRoot, noUpgradePlugin.sourceRoot);

  const noUpgradeOutput = parseJsonOutput(runSenti(noUpgradeRoot, ["plugin", "install", "sample-plugin", "--json", "--no-upgrade"]));

  assert.equal(noUpgradeOutput.package.id, "sample-plugin");
  assert.equal(noUpgradeOutput.package.source, "fixture-source");
  assert.equal(noUpgradeOutput.package.commit, noUpgradePlugin.commit);
  assert.equal(noUpgradeOutput.upgrade.ran, false);
  assert.equal(Object.hasOwn(noUpgradeOutput.upgrade, "succeeded"), true);
  assert.match(noUpgradeOutput.upgrade.skipReason, /no-upgrade/i);
});

test("R7: upgrade failure exits non-zero while preserving plugin operation and failure details", () => {
  const root = tmpProject("upgrade-failure");
  const plugin = createPluginSource(root, "sample-plugin", "cannot deploy", { skillName: "blocked-skill" });
  writeProjectConfig(root, plugin.sourceRoot);
  writeFile(root, ".agents/skills/blocked-skill", "file blocks skill directory creation\n");

  const result = runSenti(root, ["plugin", "install", "sample-plugin", "--json"]);

  const output = parseJsonFailureOutput(result);
  assert.equal(output.package.id, "sample-plugin");
  assert.equal(output.upgrade.ran, true);
  assert.equal(output.upgrade.succeeded, false);
  assert.match(output.upgrade.error, /upgrade failed/i);

  const updateRoot = tmpProject("update-all-upgrade-failure");
  const updatePlugin = createPluginSource(updateRoot, "sample-plugin", "old deployable", { skillName: "blocked-skill" });
  writeProjectConfig(updateRoot, updatePlugin.sourceRoot, [
    packageEntry("sample-plugin", "fixture-source", updatePlugin.commit),
  ]);
  updatePluginSource(updatePlugin.sourceRoot, "sample-plugin", "new blocked", { skillName: "blocked-skill" });
  writeFile(updateRoot, ".agents/skills/blocked-skill", "file blocks skill directory creation\n");

  const updateOutput = parseJsonFailureOutput(runSenti(updateRoot, ["plugin", "update-all", "--json"]));

  assert.equal(updateOutput.packages[0].id, "sample-plugin");
  assert.equal(updateOutput.packages[0].updated, true);
  assert.equal(updateOutput.upgrade.ran, true);
  assert.equal(updateOutput.upgrade.succeeded, false);
  assert.match(updateOutput.upgrade.error, /upgrade failed/i);
});

test("R8: human output includes plugin output followed by one upgrade result line", () => {
  const root = tmpProject("human-output");
  const plugin = createPluginSource(root, "sample-plugin", "human upgrade");
  writeProjectConfig(root, plugin.sourceRoot);

  const result = runSenti(root, ["plugin", "install", "sample-plugin"]);

  assertSuccess(result);
  assert.match(result.stdout, /sample-plugin/);
  assert.ok(result.stdout.indexOf("sample-plugin") < result.stdout.search(/upgrade\s+(ran|skipped|failed)/i));
  assert.equal((result.stdout.match(/upgrade\s+(ran|skipped|failed)/gi) || []).length, 1);
});

test("R9: pinned sync behavior remains intact while automatic upgrade is limited to install and update-all", () => {
  const root = tmpProject("pinned-sync");
  const plugin = createPluginSource(root, "sample-plugin", "pinned version");
  writeProjectConfig(root, plugin.sourceRoot);
  assertSuccess(runSenti(root, ["plugin", "install", "sample-plugin"]));
  updatePluginSource(plugin.sourceRoot, "sample-plugin", "unpinned head");

  const output = parseJsonOutput(runSenti(root, ["plugin", "sync", "--json"]));

  assert.equal(output[0].commit, plugin.commit);
  assert.match(fs.readFileSync(path.join(root, ".senti", "plugins", "sample-plugin", "skills", plugin.skillName, "SKILL.md"), "utf8"), /pinned version/);
  assertDeployedSkillContains(root, plugin.skillName, /pinned version/);

  const scriptRoot = tmpProject("script-safety");
  const markerPath = path.join(scriptRoot, "script-ran.txt");
  const scripted = createHookScriptPluginSource(scriptRoot, "scripted-plugin", markerPath);
  writeProjectConfig(scriptRoot, scripted.sourceRoot, [
    packageEntry("scripted-plugin", "fixture-source", scripted.commit),
  ]);

  assertSuccess(runSenti(scriptRoot, ["plugin", "install", "scripted-plugin"]));
  assertSuccess(runSenti(scriptRoot, ["plugin", "update-all"]));
  assertSuccess(runSenti(scriptRoot, ["plugin", "sync"]));
  assertSuccess(runSenti(scriptRoot, ["plugin", "source", "update"]));

  assert.equal(fs.existsSync(markerPath), false, "plugin-side package scripts must not be executed");
});

test("R10: config.local plugin overlays remain private while install upgrade uses merged config", () => {
  const root = tmpProject("local-overlay");
  const plugin = createPluginSource(root, "private-plugin", "private overlay");
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: { sources: [], packages: [] },
  });
  writeJson(root, ".senti/config.local.json", {
    plugin: {
      sources: [{ id: "private-source", type: "local", path: plugin.sourceRoot }],
      packages: [{ id: "private-plugin", source: "private-source", commit: plugin.commit }],
    },
  });

  const output = parseJsonOutput(runSenti(root, ["plugin", "install", "private-plugin", "--json"]));
  const publicConfig = JSON.parse(fs.readFileSync(path.join(root, ".senti", "config.json"), "utf8"));

  assert.equal(output.package.id, "private-plugin");
  assert.equal(output.upgrade.ran, true);
  assertDeployedSkillContains(root, plugin.skillName, /private overlay/);
  assert.deepEqual(publicConfig.plugin.sources, []);
  assert.deepEqual(publicConfig.plugin.packages, []);

  const firstInstallRoot = tmpProject("local-overlay-first-install");
  const firstInstallPlugin = createPluginSource(firstInstallRoot, "private-plugin", "private first install");
  writeJson(firstInstallRoot, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: { sources: [], packages: [] },
  });
  writeJson(firstInstallRoot, ".senti/config.local.json", {
    plugin: {
      sources: [{ id: "private-source", type: "local", path: firstInstallPlugin.sourceRoot }],
      packages: [],
    },
  });

  const firstInstallOutput = parseJsonOutput(runSenti(firstInstallRoot, ["plugin", "install", "private-plugin", "--json", "--no-upgrade"]));
  const firstInstallPublicConfig = JSON.parse(fs.readFileSync(path.join(firstInstallRoot, ".senti", "config.json"), "utf8"));
  const firstInstallLocalConfig = JSON.parse(fs.readFileSync(path.join(firstInstallRoot, ".senti", "config.local.json"), "utf8"));

  assert.equal(firstInstallOutput.package.id, "private-plugin");
  assert.equal(firstInstallOutput.upgrade.ran, false);
  assert.deepEqual(firstInstallPublicConfig.plugin.sources, []);
  assert.deepEqual(firstInstallPublicConfig.plugin.packages, []);
  assert.equal(firstInstallLocalConfig.plugin.packages[0].id, "private-plugin");
  assert.equal(firstInstallLocalConfig.plugin.packages[0].source, "private-source");
  assert.equal(firstInstallLocalConfig.plugin.packages[0].commit, firstInstallPlugin.commit);
  const firstInstallNextCommit = updatePluginSource(firstInstallPlugin.sourceRoot, "private-plugin", "private first install update");

  const firstInstallUpdateOutput = parseJsonOutput(runSenti(firstInstallRoot, ["plugin", "update-all", "--json"]));
  const firstInstallUpdatePublicConfig = JSON.parse(fs.readFileSync(path.join(firstInstallRoot, ".senti", "config.json"), "utf8"));
  const firstInstallUpdateLocalConfig = JSON.parse(fs.readFileSync(path.join(firstInstallRoot, ".senti", "config.local.json"), "utf8"));

  assert.equal(firstInstallUpdateOutput.packages[0].id, "private-plugin");
  assert.equal(firstInstallUpdateOutput.packages[0].previousCommit, firstInstallPlugin.commit);
  assert.equal(firstInstallUpdateOutput.packages[0].commit, firstInstallNextCommit);
  assert.equal(firstInstallUpdateOutput.packages[0].updated, true);
  assert.equal(firstInstallUpdateOutput.upgrade.ran, true);
  assert.deepEqual(firstInstallUpdatePublicConfig.plugin.sources, []);
  assert.deepEqual(firstInstallUpdatePublicConfig.plugin.packages, []);
  assert.equal(firstInstallUpdateLocalConfig.plugin.packages[0].commit, firstInstallNextCommit);
  assertDeployedSkillContains(firstInstallRoot, firstInstallPlugin.skillName, /private first install update/);

  const updateRoot = tmpProject("local-overlay-update-all");
  const updatePlugin = createPluginSource(updateRoot, "private-plugin", "private old");
  writeJson(updateRoot, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: { sources: [], packages: [] },
  });
  writeJson(updateRoot, ".senti/config.local.json", {
    plugin: {
      sources: [{ id: "private-source", type: "local", path: updatePlugin.sourceRoot }],
      packages: [{ id: "private-plugin", source: "private-source", commit: updatePlugin.commit }],
    },
  });
  const privateNextCommit = updatePluginSource(updatePlugin.sourceRoot, "private-plugin", "private new");

  const updateOutput = parseJsonOutput(runSenti(updateRoot, ["plugin", "update-all", "--json"]));
  const updatePublicConfig = JSON.parse(fs.readFileSync(path.join(updateRoot, ".senti", "config.json"), "utf8"));
  const updateLocalConfig = JSON.parse(fs.readFileSync(path.join(updateRoot, ".senti", "config.local.json"), "utf8"));

  assert.equal(updateOutput.packages[0].id, "private-plugin");
  assert.equal(updateOutput.packages[0].updated, true);
  assert.equal(updateOutput.upgrade.ran, true);
  assertDeployedSkillContains(updateRoot, updatePlugin.skillName, /private new/);
  assert.deepEqual(updatePublicConfig.plugin.sources, []);
  assert.deepEqual(updatePublicConfig.plugin.packages, []);
  assert.equal(updateLocalConfig.plugin.packages[0].commit, privateNextCommit);
});
