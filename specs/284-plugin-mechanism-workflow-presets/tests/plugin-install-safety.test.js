// spec: R2 R3 R4
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const SENTI = path.join(ROOT, "src", "senti.js");

function baseConfig() {
  return {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: { repos: [], packages: [] },
  };
}

function runCli(root, args) {
  try {
    const stdout = execFileSync(process.execPath, [SENTI, ...args], {
      cwd: ROOT,
      env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: ROOT },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

function git(root, args) {
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function commitAll(repo) {
  git(repo, ["init"]);
  git(repo, ["config", "user.email", "spec@example.test"]);
  git(repo, ["config", "user.name", "Spec Test"]);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "fixture"]);
}

function writePluginFixture(repo, name = "example-preset") {
  writeJson(repo, "plugin.json", {
    name,
    type: "preset",
    files: ["preset/", "plugin.json"],
    contributions: {
      presets: [{ key: name, path: "preset", parent: "base" }],
    },
  });
  writeJson(repo, "preset/preset.json", { parent: "base", label: name });
}

describe("plugin install and safety checks", () => {
  let tmp;
  let repo;
  let repo2;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    if (repo) removeTmpDir(repo);
    if (repo2) removeTmpDir(repo2);
    tmp = null;
    repo = null;
    repo2 = null;
  });

  it("R2: repo add and find discover plugin.json candidates from a clean local Git path", () => {
    tmp = createTmpDir("senti-plugin-find-project-");
    repo = createTmpDir("senti-plugin-find-repo-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    writePluginFixture(repo);
    commitAll(repo);

    const add = runCli(tmp, ["plugin", "repo", "add", repo]);
    assert.equal(add.status, 0, add.stderr || add.stdout);

    const list = runCli(tmp, ["plugin", "repo", "list", "--json"]);
    assert.equal(list.status, 0, list.stderr || list.stdout);
    assert.match(list.stdout, /example-preset|senti-plugin-find-repo/);
    assert.ok(list.stdout.includes(repo), `repo list output should include ${repo}`);

    writeJson(repo, "preset/preset.json", { parent: "base", label: "Example Preset Updated" });
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "update"]);
    const update = runCli(tmp, ["plugin", "repo", "update"]);
    assert.equal(update.status, 0, update.stderr || update.stdout);
    assert.match(update.stdout, /updated|example-preset|repo/i);

    const found = runCli(tmp, ["plugin", "find", "--json"]);
    assert.equal(found.status, 0, found.stderr || found.stdout);
    assert.match(found.stdout, /example-preset/);
    assert.match(found.stdout, /preset/);
  });

  it("R2: repo add rejects dirty local Git paths before candidate discovery", () => {
    tmp = createTmpDir("senti-plugin-dirty-project-");
    repo = createTmpDir("senti-plugin-dirty-repo-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    writePluginFixture(repo, "dirty-preset");
    commitAll(repo);
    writeFile(repo, "preset/preset.json", "{\"parent\":\"base\",\"label\":\"dirty\"}\n");

    const add = runCli(tmp, ["plugin", "repo", "add", repo]);

    assert.notEqual(add.status, 0, "dirty local plugin source must be rejected");
    assert.match(`${add.stdout}\n${add.stderr}`, /dirty|uncommitted|clean/i);
    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    assert.deepEqual(config.plugin.repos, []);
  });

  it("R2: repo add and find discover plugin.json candidates from a git URL source", () => {
    tmp = createTmpDir("senti-plugin-find-url-project-");
    repo = createTmpDir("senti-plugin-find-url-repo-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    writePluginFixture(repo, "url-preset");
    commitAll(repo);

    const add = runCli(tmp, ["plugin", "repo", "add", `file://${repo}`]);
    assert.equal(add.status, 0, add.stderr || add.stdout);

    const found = runCli(tmp, ["plugin", "find", "--json"]);
    assert.equal(found.status, 0, found.stderr || found.stdout);
    assert.match(found.stdout, /url-preset/);
    assert.match(found.stdout, /file:\/\//);
  });

  it("R3: install copies only declared files and records id repo commit in plugin.packages", () => {
    tmp = createTmpDir("senti-plugin-install-project-");
    repo = createTmpDir("senti-plugin-install-repo-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    writeJson(repo, "plugin.json", {
      name: "copy-safe",
      type: "mixed",
      files: ["commands/", "preset/", "plugin.json"],
      contributions: {
        commands: [{ name: "copy-safe", path: "commands/index.js" }],
        presets: [{ key: "copy-safe", path: "preset", parent: "base" }],
      },
    });
    writeFile(repo, "commands/index.js", "export async function main() { return { ok: true }; }\n");
    writeJson(repo, "preset/preset.json", { parent: "base", label: "Copy Safe" });
    writeFile(repo, "secret.txt", "must not be copied\n");
    commitAll(repo);

    const add = runCli(tmp, ["plugin", "repo", "add", repo]);
    assert.equal(add.status, 0, add.stderr || add.stdout);
    const install = runCli(tmp, ["plugin", "install", "copy-safe"]);
    assert.equal(install.status, 0, install.stderr || install.stdout);

    assert.ok(fs.existsSync(path.join(tmp, ".senti", "plugins", "copy-safe", "commands", "index.js")));
    assert.ok(!fs.existsSync(path.join(tmp, ".senti", "plugins", "copy-safe", "secret.txt")));
    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    const entry = config.plugin.packages.find((pkg) => pkg.id === "copy-safe");
    assert.ok(entry, "plugin.packages must include copy-safe");
    assert.equal(entry.repo, config.plugin.repos[0].id);
    assert.match(entry.commit, /^[0-9a-f]{40}$/);
  });

  it("R3: sync restores runtime files from the recorded commit instead of latest HEAD", () => {
    tmp = createTmpDir("senti-plugin-pinned-sync-project-");
    repo = createTmpDir("senti-plugin-pinned-sync-repo-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    writeJson(repo, "plugin.json", {
      name: "pinned-sync",
      type: "mixed",
      files: ["commands/", "plugin.json"],
      contributions: {
        commands: [{ name: "pinned-sync", path: "commands/index.js" }],
      },
    });
    writeFile(repo, "commands/index.js", "export async function main() { return { version: 1 }; }\n");
    commitAll(repo);

    assert.equal(runCli(tmp, ["plugin", "repo", "add", repo]).status, 0);
    assert.equal(runCli(tmp, ["plugin", "install", "pinned-sync"]).status, 0);
    const installedPath = path.join(tmp, ".senti", "plugins", "pinned-sync", "commands", "index.js");
    const installedV1 = fs.readFileSync(installedPath, "utf8");
    assert.match(installedV1, /version: 1/);

    writeFile(repo, "commands/index.js", "export async function main() { return { version: 2 }; }\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "advance-head"]);
    fs.rmSync(path.join(tmp, ".senti", "plugins", "pinned-sync"), { recursive: true, force: true });

    const synced = runCli(tmp, ["plugin", "sync"]);
    assert.equal(synced.status, 0, synced.stderr || synced.stdout);
    const syncedContent = fs.readFileSync(installedPath, "utf8");
    assert.equal(syncedContent, installedV1);
    assert.doesNotMatch(syncedContent, /version: 2/);
  });

  it("R3: repo errors mask credential-bearing source URLs", () => {
    tmp = createTmpDir("senti-plugin-token-mask-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    const secret = "super-secret-token";

    const result = runCli(tmp, ["plugin", "repo", "add", `https://user:${secret}@example.invalid/private/repo.git`]);

    assert.notEqual(result.status, 0, "unreachable credential-bearing repo should fail");
    const output = `${result.stdout}\n${result.stderr}`;
    assert.doesNotMatch(output, new RegExp(secret));
    assert.match(output, /example\.invalid|private\/repo|https:\/\/user:\*\*\*@/);
  });

  it("R3: list enable disable update-all and sync operate on installed plugin state", () => {
    tmp = createTmpDir("senti-plugin-lifecycle-project-");
    repo = createTmpDir("senti-plugin-lifecycle-repo-");
    repo2 = createTmpDir("senti-plugin-lifecycle-repo-two-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    writePluginFixture(repo, "lifecycle-preset");
    writePluginFixture(repo2, "lifecycle-preset-two");
    commitAll(repo);
    commitAll(repo2);

    assert.equal(runCli(tmp, ["plugin", "repo", "add", repo]).status, 0);
    assert.equal(runCli(tmp, ["plugin", "repo", "add", repo2]).status, 0);
    assert.equal(runCli(tmp, ["plugin", "install", "lifecycle-preset"]).status, 0);
    assert.equal(runCli(tmp, ["plugin", "install", "lifecycle-preset-two"]).status, 0);
    const beforeConfig = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    const beforeCommits = new Map(beforeConfig.plugin.packages.map((pkg) => [pkg.id, pkg.commit]));

    const listInstalled = runCli(tmp, ["plugin", "list", "--json"]);
    assert.equal(listInstalled.status, 0, listInstalled.stderr || listInstalled.stdout);
    assert.match(listInstalled.stdout, /lifecycle-preset/);
    assert.match(listInstalled.stdout, /lifecycle-preset-two/);
    assert.match(listInstalled.stdout, /enabled/i);

    const disabled = runCli(tmp, ["plugin", "disable", "lifecycle-preset"]);
    assert.equal(disabled.status, 0, disabled.stderr || disabled.stdout);
    const listDisabled = runCli(tmp, ["plugin", "list", "--json"]);
    assert.match(listDisabled.stdout, /disabled/i);

    const enabled = runCli(tmp, ["plugin", "enable", "lifecycle-preset"]);
    assert.equal(enabled.status, 0, enabled.stderr || enabled.stdout);

    const synced = runCli(tmp, ["plugin", "sync"]);
    assert.equal(synced.status, 0, synced.stderr || synced.stdout);
    assert.ok(fs.existsSync(path.join(tmp, ".senti", "plugins", "lifecycle-preset", "plugin.json")));
    assert.ok(fs.existsSync(path.join(tmp, ".senti", "plugins", "lifecycle-preset-two", "plugin.json")));

    writeJson(repo, "preset/preset.json", { parent: "base", label: "Lifecycle Preset Updated" });
    writeJson(repo2, "preset/preset.json", { parent: "base", label: "Lifecycle Preset Two Updated" });
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "update"]);
    git(repo2, ["add", "."]);
    git(repo2, ["commit", "-m", "update"]);
    const updated = runCli(tmp, ["plugin", "update-all"]);
    assert.equal(updated.status, 0, updated.stderr || updated.stdout);
    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    for (const id of ["lifecycle-preset", "lifecycle-preset-two"]) {
      const commit = config.plugin.packages.find((pkg) => pkg.id === id).commit;
      assert.match(commit, /^[0-9a-f]{40}$/);
      assert.notEqual(commit, beforeCommits.get(id), `${id} must be advanced by update-all`);
      assert.match(updated.stdout, new RegExp(id));
    }
    const firstRuntime = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "plugins", "lifecycle-preset", "preset", "preset.json"), "utf8"));
    const secondRuntime = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "plugins", "lifecycle-preset-two", "preset", "preset.json"), "utf8"));
    assert.equal(firstRuntime.label, "Lifecycle Preset Updated");
    assert.equal(secondRuntime.label, "Lifecycle Preset Two Updated");
  });

  it("R4: update-all rejects newly unsafe package contents before copying runtime files", () => {
    tmp = createTmpDir("senti-plugin-update-unsafe-project-");
    repo = createTmpDir("senti-plugin-update-unsafe-repo-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    writeJson(repo, "plugin.json", {
      name: "safe-then-unsafe",
      type: "mixed",
      files: ["plugin.json", "package.json", "commands/"],
      contributions: {
        commands: [{ name: "safe-then-unsafe", path: "commands/index.js" }],
      },
    });
    writeJson(repo, "package.json", {});
    writeFile(repo, "commands/index.js", "export async function main() { return { version: 1 }; }\n");
    commitAll(repo);

    assert.equal(runCli(tmp, ["plugin", "repo", "add", repo]).status, 0);
    assert.equal(runCli(tmp, ["plugin", "install", "safe-then-unsafe"]).status, 0);
    const installedPath = path.join(tmp, ".senti", "plugins", "safe-then-unsafe", "commands", "index.js");
    const installedV1 = fs.readFileSync(installedPath, "utf8");

    writeJson(repo, "package.json", { scripts: { postinstall: "node postinstall.js" } });
    writeFile(repo, "commands/index.js", "export async function main() { return { version: 2 }; }\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "-m", "unsafe-update"]);

    const updated = runCli(tmp, ["plugin", "update-all"]);

    assert.notEqual(updated.status, 0, "update-all must reject unsafe package metadata");
    assert.match(`${updated.stdout}\n${updated.stderr}`, /scripts|unsafe|package/i);
    assert.equal(fs.readFileSync(installedPath, "utf8"), installedV1);
  });

  function installUnsafeCase({ name, manifest, files = [], packageJson = null }) {
    tmp = createTmpDir("senti-plugin-unsafe-project-");
    repo = createTmpDir("senti-plugin-unsafe-repo-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    writeJson(repo, "plugin.json", manifest);
    for (const file of files) writeFile(repo, file.path, file.content);
    if (packageJson) writeJson(repo, "package.json", packageJson);
    commitAll(repo);

    const add = runCli(tmp, ["plugin", "repo", "add", repo]);
    assert.equal(add.status, 0, add.stderr || add.stdout);
    return runCli(tmp, ["plugin", "install", name]);
  }

  it("R4: install rejects invalid plugin ids", () => {
    const install = installUnsafeCase({
      name: "bad/id",
      manifest: {
        name: "bad/id",
        type: "preset",
        files: ["plugin.json", "preset/"],
        contributions: { presets: [{ key: "bad/id", path: "preset", parent: "base" }] },
      },
      files: [{ path: "preset/preset.json", content: "{\"parent\":\"base\"}\n" }],
    });
    assert.notEqual(install.status, 0, "unsafe package must be rejected");
    assert.match(`${install.stdout}\n${install.stderr}`, /id|unsafe/i);
    assert.ok(!fs.existsSync(path.join(tmp, ".senti", "plugins", "bad")));
  });

  it("R4: install rejects invalid files patterns", () => {
    const install = installUnsafeCase({
      name: "invalid-files",
      manifest: {
        name: "invalid-files",
        type: "preset",
        files: ["../outside"],
        contributions: { presets: [{ key: "invalid-files", path: "preset", parent: "base" }] },
      },
      files: [{ path: "preset/preset.json", content: "{\"parent\":\"base\"}\n" }],
    });
    assert.notEqual(install.status, 0, "unsafe files pattern must be rejected");
    assert.match(`${install.stdout}\n${install.stderr}`, /files|parent|traversal|outside|unsafe/i);
    assert.ok(!fs.existsSync(path.join(tmp, ".senti", "plugins", "invalid-files")));
  });

  it("R4: install rejects contribution paths outside copied files", () => {
    const install = installUnsafeCase({
      name: "outside-command",
      manifest: {
        name: "outside-command",
        type: "mixed",
        files: ["plugin.json", "commands/index.js"],
        contributions: { commands: [{ name: "outside-command", path: "../outside.js" }] },
      },
      files: [{ path: "commands/index.js", content: "export async function main() {}\n" }],
    });
    assert.notEqual(install.status, 0);
    assert.match(`${install.stdout}\n${install.stderr}`, /outside|contribution|path/i);
  });

  it("R4: install rejects in-repo contribution paths omitted from plugin.json.files", () => {
    const install = installUnsafeCase({
      name: "omitted-command",
      manifest: {
        name: "omitted-command",
        type: "mixed",
        files: ["plugin.json"],
        contributions: { commands: [{ name: "omitted-command", path: "commands/index.js" }] },
      },
      files: [{ path: "commands/index.js", content: "export async function main() {}\n" }],
    });
    assert.notEqual(install.status, 0);
    assert.match(`${install.stdout}\n${install.stderr}`, /files|allowlist|contribution|copied/i);
  });

  it("R4: install rejects package dependencies", () => {
    const install = installUnsafeCase({
      name: "dependency-plugin",
      manifest: {
        name: "dependency-plugin",
        type: "preset",
        files: ["plugin.json", "preset/", "package.json"],
        contributions: { presets: [{ key: "dependency-plugin", path: "preset", parent: "base" }] },
      },
      files: [{ path: "preset/preset.json", content: "{\"parent\":\"base\"}\n" }],
      packageJson: { dependencies: { leftpad: "1.0.0" } },
    });
    assert.notEqual(install.status, 0);
    assert.match(`${install.stdout}\n${install.stderr}`, /dependencies/i);
  });

  it("R4: install rejects package scripts", () => {
    const install = installUnsafeCase({
      name: "script-plugin",
      manifest: {
        name: "script-plugin",
        type: "preset",
        files: ["plugin.json", "preset/", "package.json"],
        contributions: { presets: [{ key: "script-plugin", path: "preset", parent: "base" }] },
      },
      files: [{ path: "preset/preset.json", content: "{\"parent\":\"base\"}\n" }],
      packageJson: { scripts: { postinstall: "node postinstall.js" } },
    });
    assert.notEqual(install.status, 0);
    assert.match(`${install.stdout}\n${install.stderr}`, /scripts/i);
  });

  it("R4: install rejects symlinks inside declared files", () => {
    tmp = createTmpDir("senti-plugin-symlink-project-");
    repo = createTmpDir("senti-plugin-symlink-repo-");
    writeJson(tmp, ".senti/config.json", baseConfig());
    writeJson(repo, "plugin.json", {
      name: "symlink-plugin",
      type: "preset",
      files: ["plugin.json", "preset/"],
      contributions: { presets: [{ key: "symlink-plugin", path: "preset", parent: "base" }] },
    });
    writeFile(repo, "preset/preset.json", "{\"parent\":\"base\"}\n");
    fs.symlinkSync("preset.json", path.join(repo, "preset", "linked.json"));
    commitAll(repo);

    assert.equal(runCli(tmp, ["plugin", "repo", "add", repo]).status, 0);
    const install = runCli(tmp, ["plugin", "install", "symlink-plugin"]);
    assert.notEqual(install.status, 0);
    assert.match(`${install.stdout}\n${install.stderr}`, /symlink/i);
  });

  it("R4: install rejects .git content when a package tries to copy the repository root", () => {
    const install = installUnsafeCase({
      name: "git-content-plugin",
      manifest: {
        name: "git-content-plugin",
        type: "preset",
        files: ["."],
        contributions: { presets: [{ key: "git-content-plugin", path: "preset", parent: "base" }] },
      },
      files: [{ path: "preset/preset.json", content: "{\"parent\":\"base\"}\n" }],
    });
    assert.notEqual(install.status, 0);
    assert.match(`${install.stdout}\n${install.stderr}`, /\.git|git content|files/i);
  });
});
