// spec: R1 R2 R3 R4 R5 R7
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  addPluginRepo,
  findPluginCandidates,
  installPlugin,
  resolveSetupOfficialPresetSource,
  syncInstalledPlugins,
  updatePluginRepos,
} from "../../../src/lib/plugin-registry.js";

const roots = [];

function tmpDir(label = "senti-plugin-git-cache-") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), label));
  roots.push(dir);
  return dir;
}

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function initRepo(dir) {
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["config", "user.email", "test@example.com"]);
  git(dir, ["config", "user.name", "Test User"]);
  git(dir, ["config", "commit.gpgsign", "false"]);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writePlugin(repo, name, extra = "") {
  writeJson(path.join(repo, "plugin.json"), {
    name,
    type: "mixed",
    files: ["plugin.json", "commands/"],
    contributions: {
      commands: [{ name: "sample", path: "commands/sample.js" }],
    },
  });
  fs.mkdirSync(path.join(repo, "commands"), { recursive: true });
  fs.writeFileSync(path.join(repo, "commands", "sample.js"), `export const value = ${JSON.stringify(extra)};\n`, "utf8");
}

function writeOfficialPresetPlugin(repo, extra = "") {
  writeJson(path.join(repo, "plugin.json"), {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key: "sample-preset", path: "presets/sample-preset", parent: "base" }],
    },
  });
  writeJson(path.join(repo, "presets", "sample-preset", "preset.json"), {
    parent: "base",
    label: `Sample ${extra}`,
    chapters: [],
  });
}

function commitAll(repo, message) {
  git(repo, ["add", "-A"]);
  git(repo, ["commit", "-q", "-m", message]);
  return git(repo, ["rev-parse", "HEAD"]);
}

function createPluginRepo({ name = "sample-plugin" } = {}) {
  const repo = tmpDir();
  initRepo(repo);
  writePlugin(repo, name, "initial");
  const first = commitAll(repo, "initial plugin");
  return { repo, first };
}

function advancePluginRepo(repo, name = "sample-plugin", extra = "updated") {
  writePlugin(repo, name, "updated");
  return commitAll(repo, `${extra} plugin`);
}

function createProject({ sourceId = "sample-source", source, commit, ref = null, packageId = "sample-plugin" }) {
  const root = tmpDir();
  const sourceEntry = { id: sourceId, type: "git", url: `file://${source}` };
  if (ref) sourceEntry.ref = ref;
  writeJson(path.join(root, ".senti", "config.json"), {
    plugin: {
      sources: [sourceEntry],
      packages: [{ id: packageId, source: sourceId, commit }],
    },
  });
  return root;
}

function cloneCache(projectRoot, sourceId, repo, checkout = null) {
  const cache = path.join(projectRoot, ".senti", "plugin-sources", sourceId);
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  git(path.dirname(cache), ["clone", "-q", `file://${repo}`, cache]);
  if (checkout) git(cache, ["checkout", "-q", checkout]);
  return cache;
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("Git URL plugin source cache update", () => {
  it("R1: update-all adopts the fetched remote default branch instead of stale cache HEAD", () => {
    const { repo, first } = createPluginRepo();
    const project = createProject({ source: repo, commit: first });
    cloneCache(project, "sample-source", repo);
    const second = advancePluginRepo(repo);

    const [result] = syncInstalledPlugins(project, { update: true });

    assert.equal(result.previousCommit, first);
    assert.equal(result.commit, second);
    assert.equal(result.updated, true);
  });

  it("R2: source.ref branch resolves to the fetched branch commit rather than the stale local branch", () => {
    const repo = tmpDir();
    initRepo(repo);
    writePlugin(repo, "sample-plugin", "main");
    commitAll(repo, "main plugin");
    git(repo, ["checkout", "-q", "-b", "release"]);
    writePlugin(repo, "sample-plugin", "release-old");
    const oldRelease = commitAll(repo, "old release plugin");

    const project = createProject({ source: repo, commit: oldRelease, ref: "release" });
    cloneCache(project, "sample-source", repo, "release");

    writePlugin(repo, "sample-plugin", "release-new");
    const newRelease = commitAll(repo, "new release plugin");

    const [result] = syncInstalledPlugins(project, { update: true });

    assert.equal(result.previousCommit, oldRelease);
    assert.equal(result.commit, newRelease);
    assert.equal(result.updated, true);
  });

  it("R2: source.ref tag resolves to the fetched tag target commit", () => {
    const repo = tmpDir();
    initRepo(repo);
    writePlugin(repo, "sample-plugin", "tag-old");
    const oldTagCommit = commitAll(repo, "old tag plugin");
    git(repo, ["tag", "release-tag"]);

    const project = createProject({ source: repo, commit: oldTagCommit, ref: "release-tag" });
    cloneCache(project, "sample-source", repo, "release-tag");

    writePlugin(repo, "sample-plugin", "tag-new");
    const newTagCommit = commitAll(repo, "new tag plugin");
    git(repo, ["tag", "-f", "release-tag", newTagCommit]);

    const [result] = syncInstalledPlugins(project, { update: true });

    assert.equal(result.previousCommit, oldTagCommit);
    assert.equal(result.commit, newTagCommit);
    assert.equal(result.updated, true);
  });

  it("R2: source.ref full SHA resolves after fetch even when the managed cache is dirty", () => {
    const { repo, first } = createPluginRepo();
    const project = createProject({ source: repo, commit: first, ref: first });
    const cache = cloneCache(project, "sample-source", repo);
    const second = advancePluginRepo(repo);
    const configPath = path.join(project, ".senti", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.plugin.sources[0].ref = second;
    writeJson(configPath, config);
    fs.writeFileSync(path.join(cache, "commands", "sample.js"), "dirty before sha checkout\n", "utf8");

    const [result] = syncInstalledPlugins(project, { update: true });

    assert.equal(result.previousCommit, first);
    assert.equal(result.commit, second);
    assert.equal(result.updated, true);
  });

  it("R3: dirty managed cache is repaired before adopting the resolved target commit", () => {
    const { repo, first } = createPluginRepo();
    const project = createProject({ source: repo, commit: first });
    const cache = cloneCache(project, "sample-source", repo);
    const second = advancePluginRepo(repo);
    fs.writeFileSync(path.join(cache, "commands", "sample.js"), "dirty cache content\n", "utf8");
    fs.writeFileSync(path.join(cache, "untracked.txt"), "dirty\n", "utf8");
    fs.appendFileSync(path.join(cache, ".git", "info", "exclude"), "\nignored-cache.txt\n", "utf8");
    fs.writeFileSync(path.join(cache, "ignored-cache.txt"), "ignored dirty content\n", "utf8");

    const [result] = syncInstalledPlugins(project, { update: true });
    const status = git(cache, ["status", "--porcelain"]);

    assert.equal(result.commit, second);
    assert.equal(result.updated, true);
    assert.equal(status, "");
    assert.equal(fs.existsSync(path.join(cache, "ignored-cache.txt")), false);
  });

  it("R3: unsafe managed cache source ids are rejected before destructive repair", () => {
    const { repo, first } = createPluginRepo();
    const project = createProject({ sourceId: "../escaped-cache", source: repo, commit: first });
    const escapedTarget = path.join(project, ".senti", "escaped-cache");
    const sentinel = path.join(escapedTarget, "sentinel.txt");
    fs.mkdirSync(escapedTarget, { recursive: true });
    fs.writeFileSync(sentinel, "must remain untouched\n", "utf8");

    assert.throws(
      () => syncInstalledPlugins(project, { update: true }),
      /unsafe|plugin-sources|source id|path/i,
    );
    assert.equal(fs.readFileSync(sentinel, "utf8"), "must remain untouched\n");
    assert.equal(fs.existsSync(path.join(escapedTarget, ".git")), false);
  });

  it("R3: symlinked managed cache paths are rejected before Git repair commands", () => {
    const { repo, first } = createPluginRepo();
    const project = createProject({ source: repo, commit: first });
    const external = tmpDir();
    initRepo(external);
    writePlugin(external, "external-plugin", "external");
    commitAll(external, "external plugin");
    const sentinel = path.join(external, "sentinel.txt");
    fs.writeFileSync(sentinel, "must remain untouched\n", "utf8");
    const cache = path.join(project, ".senti", "plugin-sources", "sample-source");
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.symlinkSync(external, cache, "dir");

    assert.throws(
      () => syncInstalledPlugins(project, { update: true }),
      /unsafe|symlink|plugin source cache path/i,
    );
    assert.equal(fs.readFileSync(sentinel, "utf8"), "must remain untouched\n");
  });

  it("R3: redirected Git metadata is rejected before Git repair commands", () => {
    const { repo, first } = createPluginRepo();
    const project = createProject({ source: repo, commit: first });
    const external = tmpDir();
    initRepo(external);
    writePlugin(external, "external-plugin", "external");
    commitAll(external, "external plugin");
    const sentinel = path.join(external, "sentinel.txt");
    fs.writeFileSync(sentinel, "must remain untouched\n", "utf8");
    const cache = path.join(project, ".senti", "plugin-sources", "sample-source");
    fs.mkdirSync(cache, { recursive: true });
    fs.writeFileSync(path.join(cache, ".git"), `gitdir: ${path.join(external, ".git")}\n`, "utf8");

    assert.throws(
      () => syncInstalledPlugins(project, { update: true }),
      /unsafe|\.git|plugin source cache path/i,
    );
    assert.equal(fs.readFileSync(sentinel, "utf8"), "must remain untouched\n");
  });

  it("R3: symlinked .senti ancestor is rejected before managed cache creation", () => {
    const { repo, first } = createPluginRepo();
    const project = tmpDir();
    const externalSenti = tmpDir();
    fs.symlinkSync(externalSenti, path.join(project, ".senti"), "dir");
    const sentinel = path.join(externalSenti, "sentinel.txt");
    fs.writeFileSync(sentinel, "must remain untouched\n", "utf8");
    writeJson(path.join(project, ".senti", "config.json"), {
      plugin: {
        sources: [{ id: "sample-source", type: "git", url: `file://${repo}` }],
        packages: [{ id: "sample-plugin", source: "sample-source", commit: first }],
      },
    });

    assert.throws(
      () => syncInstalledPlugins(project, { update: true }),
      /unsafe|\.senti|plugin source cache path/i,
    );
    assert.equal(fs.readFileSync(sentinel, "utf8"), "must remain untouched\n");
    assert.equal(fs.existsSync(path.join(externalSenti, "plugin-sources")), false);
  });

  it("R3: unrecoverable managed cache is deleted and recloned at the resolved commit", () => {
    const { repo, first } = createPluginRepo();
    const project = createProject({ source: repo, commit: first });
    const cache = path.join(project, ".senti", "plugin-sources", "sample-source");
    fs.mkdirSync(cache, { recursive: true });
    fs.writeFileSync(path.join(cache, "blocking-file.txt"), "not a git checkout\n", "utf8");
    const second = advancePluginRepo(repo);

    const [result] = syncInstalledPlugins(project, { update: true });
    const cacheHead = git(cache, ["rev-parse", "HEAD"]);

    assert.equal(result.commit, second);
    assert.equal(result.updated, true);
    assert.equal(cacheHead, second);
  });

  it("R4: update-all result reports the new commit and updated true when package commit changes", () => {
    const { repo, first } = createPluginRepo();
    const project = createProject({ source: repo, commit: first });
    cloneCache(project, "sample-source", repo);
    const second = advancePluginRepo(repo);

    const [result] = syncInstalledPlugins(project, { update: true });

    assert.deepEqual(
      {
        commit: result.commit,
        previousCommit: result.previousCommit,
        updated: result.updated,
      },
      {
        commit: second,
        previousCommit: first,
        updated: true,
      },
    );
  });

  it("R5: local path plugin source dirty rejection remains unchanged", () => {
    const source = tmpDir();
    initRepo(source);
    writePlugin(source, "sample-plugin", "local");
    const commit = commitAll(source, "local plugin");
    fs.writeFileSync(path.join(source, "commands", "sample.js"), "dirty local source\n", "utf8");
    const project = tmpDir();
    writeJson(path.join(project, ".senti", "config.json"), {
      plugin: {
        sources: [{ id: "local-source", type: "local", path: source }],
        packages: [{ id: "sample-plugin", source: "local-source", commit }],
      },
    });

    assert.throws(
      () => syncInstalledPlugins(project, { update: true }),
      /dirty local plugin source rejected/,
    );
  });

  it("R5: source add persists config and source update reports the fetched resolved commit", () => {
    const { repo, first } = createPluginRepo();
    const project = tmpDir();
    writeJson(path.join(project, ".senti", "config.json"), {
      plugin: {
        sources: [],
        packages: [],
      },
    });

    const added = addPluginRepo(project, `file://${repo}`);
    const configAfterAdd = JSON.parse(fs.readFileSync(path.join(project, ".senti", "config.json"), "utf8"));
    const second = advancePluginRepo(repo);
    const [updated] = updatePluginRepos(project);

    assert.equal(added.commit, first);
    assert.equal(configAfterAdd.plugin.sources.length, 1);
    assert.equal(configAfterAdd.plugin.sources[0].url, `file://${repo}`);
    assert.equal(updated.commit, second);
  });

  it("R5: official preset source resolution adopts the fetched Git URL commit", () => {
    const repo = tmpDir();
    initRepo(repo);
    writeOfficialPresetPlugin(repo, "old");
    const first = commitAll(repo, "old official preset");
    const project = tmpDir();
    writeJson(path.join(project, ".senti", "config.json"), {
      plugin: {
        sources: [],
        packages: [],
      },
    });
    cloneCache(project, "official-presets", repo);

    writeOfficialPresetPlugin(repo, "new");
    const second = commitAll(repo, "new official preset");

    const resolved = resolveSetupOfficialPresetSource(project, {
      defaultOfficialPresetSource: {
        id: "official-presets",
        type: "git",
        url: `file://${repo}`,
      },
    });

    assert.equal(resolved.commit, second);
    assert.equal(resolved.source.url, `file://${repo}`);
    assert.notEqual(resolved.commit, first);
  });

  it("R7: metadata consumers inspect a tree matching the resolved target commit", () => {
    const repo = tmpDir();
    initRepo(repo);
    writePlugin(repo, "old-plugin", "old");
    commitAll(repo, "old plugin");
    const project = tmpDir();
    writeJson(path.join(project, ".senti", "config.json"), {
      plugin: {
        sources: [{ id: "sample-source", type: "git", url: `file://${repo}` }],
        packages: [],
      },
    });
    cloneCache(project, "sample-source", repo);

    writePlugin(repo, "new-plugin", "new");
    const newCommit = commitAll(repo, "new plugin");

    const [candidate] = findPluginCandidates(project);

    assert.equal(candidate.id, "new-plugin");
    assert.equal(candidate.commit, newCommit);
  });

  it("R7: existing managed cache is recloned when the configured Git URL changes", () => {
    const oldRepo = tmpDir();
    initRepo(oldRepo);
    writePlugin(oldRepo, "sample-plugin", "old-remote");
    const oldCommit = commitAll(oldRepo, "old remote plugin");
    const newRepo = tmpDir();
    initRepo(newRepo);
    writePlugin(newRepo, "sample-plugin", "new-remote");
    const newCommit = commitAll(newRepo, "new remote plugin");
    const project = createProject({ source: newRepo, commit: oldCommit });
    const cache = cloneCache(project, "sample-source", oldRepo);

    const [result] = syncInstalledPlugins(project, { update: true });
    const cacheOrigin = git(cache, ["remote", "get-url", "origin"]);
    const cacheCommand = fs.readFileSync(path.join(cache, "commands", "sample.js"), "utf8");

    assert.equal(result.commit, newCommit);
    assert.equal(result.updated, true);
    assert.equal(cacheOrigin, `file://${newRepo}`);
    assert.match(cacheCommand, /new-remote/);
  });

  it("R7: nested Git worktree metadata is recloned before returning the cache root", () => {
    const { repo, first } = createPluginRepo();
    const project = createProject({ source: repo, commit: first });
    const cache = path.join(project, ".senti", "plugin-sources", "sample-source");
    fs.mkdirSync(path.join(cache, "subtree"), { recursive: true });
    git(cache, ["init", "-q"]);
    git(cache, ["config", "core.worktree", "subtree"]);
    fs.writeFileSync(path.join(cache, "plugin.json"), "{\"name\":\"stale-plugin\"}\n", "utf8");
    const second = advancePluginRepo(repo, "sample-plugin", "nested-reclone");

    const [result] = syncInstalledPlugins(project, { update: true });
    const topLevel = git(cache, ["rev-parse", "--show-toplevel"]);
    const cacheCommand = fs.readFileSync(path.join(cache, "commands", "sample.js"), "utf8");

    assert.equal(result.commit, second);
    assert.equal(result.updated, true);
    assert.equal(path.resolve(topLevel), cache);
    assert.match(cacheCommand, /updated/);
  });

  it("R7: install materializes files from the resolved target commit", () => {
    const { repo, first } = createPluginRepo();
    const project = tmpDir();
    writeJson(path.join(project, ".senti", "config.json"), {
      plugin: {
        sources: [{ id: "sample-source", type: "git", url: `file://${repo}` }],
        packages: [],
      },
    });
    cloneCache(project, "sample-source", repo);
    const second = advancePluginRepo(repo, "sample-plugin", "install-new");

    const installed = installPlugin(project, "sample-plugin");
    const installedCommand = fs.readFileSync(
      path.join(project, ".senti", "plugins", "sample-plugin", "commands", "sample.js"),
      "utf8",
    );

    assert.equal(installed.commit, second);
    assert.match(installedCommand, /updated/);
    assert.notEqual(installed.commit, first);
  });
});
