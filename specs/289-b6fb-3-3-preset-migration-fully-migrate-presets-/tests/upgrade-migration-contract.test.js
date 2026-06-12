// spec: R3 R4 R9
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadPluginRegistry } from "../../../src/lib/plugin-registry.js";
import { resolveChain } from "../../../src/lib/presets.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const SENTI = path.join(REPO_ROOT, "src", "senti.js");

function runCli(project, args, extraEnv = {}) {
  return spawnSync(process.execPath, [SENTI, ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...extraEnv, SENTI_WORK_ROOT: project, SENTI_SOURCE_ROOT: REPO_ROOT },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commitAll(repo) {
  git(repo, ["init"]);
  git(repo, ["config", "user.email", "spec@example.test"]);
  git(repo, ["config", "user.name", "Spec Test"]);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "fixture"]);
  return git(repo, ["rev-parse", "HEAD"]);
}

function readConfig(project) {
  return JSON.parse(fs.readFileSync(path.join(project, ".senti", "config.json"), "utf8"));
}

function createProject(name, config = {}) {
  const project = createTmpDir(`senti-289-upgrade-${name}-`);
  writeJson(project, ".senti/config.json", {
    lang: "en",
    type: "child-preset",
    docs: { languages: ["en"], defaultLanguage: "en" },
    scan: { include: ["src"] },
    plugin: { sources: [], packages: [] },
    ...config,
  });
  writeFile(project, "src/index.js", "export const value = 1;\n");
  return project;
}

function writeProviderRepo(repo, { depth = 2 } = {}) {
  const presets = [
    { key: "sample-preset", path: "presets/sample-preset", parent: "base" },
    { key: "child-preset", path: "presets/child-preset", parent: "sample-preset" },
  ];
  for (let i = 1; i <= depth; i += 1) {
    presets.push({
      key: `deep-${i}`,
      path: `presets/deep-${i}`,
      parent: i === 1 ? "base" : `deep-${i - 1}`,
    });
  }
  writeJson(repo, "plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: { presets },
  });
  writeJson(repo, "presets/sample-preset/preset.json", {
    parent: "base",
    label: "Sample",
    scan: { include: ["src"] },
    chapters: [{ chapter: "sample.md" }],
  });
  writeJson(repo, "presets/child-preset/preset.json", {
    parent: "sample-preset",
    label: "Child",
    scan: { include: ["app"] },
    chapters: [{ chapter: "child.md" }],
  });
  for (let i = 1; i <= depth; i += 1) {
    writeJson(repo, `presets/deep-${i}/preset.json`, {
      parent: i === 1 ? "base" : `deep-${i - 1}`,
      label: `Deep ${i}`,
    });
  }
  return commitAll(repo);
}

function writeBrokenParentProviderRepo(repo) {
  writeJson(repo, "plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key: "child-preset", path: "presets/child-preset", parent: "missing-parent" }],
    },
  });
  writeJson(repo, "presets/child-preset/preset.json", {
    parent: "missing-parent",
    label: "Child",
  });
  return commitAll(repo);
}

function configureProviderSource(project, repo, id = "official-presets") {
  const config = readConfig(project);
  config.plugin.sources.push({ id, type: "local", path: path.relative(project, repo).split(path.sep).join("/") });
  writeJson(project, ".senti/config.json", config);
}

function configureGitProviderSource(project, repo, id = "official-presets") {
  const config = readConfig(project);
  config.plugin.sources.push({ id, type: "git", url: pathToFileURL(repo).href });
  writeJson(project, ".senti/config.json", config);
}

function findMigratedFile(project, relSuffix) {
  const roots = [
    path.join(project, ".senti", "plugins"),
    path.join(project, ".senti", "plugin-sources"),
  ];
  const matches = [];
  const walk = (current) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && full.endsWith(relSuffix.split("/").join(path.sep))) matches.push(full);
    }
  };
  for (const root of roots) walk(root);
  return matches;
}

describe("upgrade migration contract", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R3/R9: upgrade completes a missing non-base provider package from a local source and exits zero", () => {
    tmp = createProject("provider-local-success");
    const provider = path.join(tmp, "fixtures", "senti-presets");
    const commit = writeProviderRepo(provider);
    configureProviderSource(tmp, provider);

    const result = runCli(tmp, ["upgrade"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const config = readConfig(tmp);
    const pkg = config.plugin.packages.find((entry) => entry.id === "official-presets");
    assert.ok(pkg, "upgrade must enable the provider package");
    assert.equal(pkg.commit, commit, "upgrade must persist reproducibility metadata");
    assert.ok(fs.existsSync(path.join(tmp, ".senti", "plugins", "official-presets", "plugin.json")));
    assert.deepEqual(resolveChain("child-preset", tmp).map((preset) => preset.key), [
      "base",
      "sample-preset",
      "child-preset",
    ]);
  });

  it("R3: upgrade records reproducibility metadata when provider completion uses a git source", () => {
    tmp = createProject("provider-git-success");
    const provider = path.join(tmp, "fixtures", "senti-presets-git");
    const commit = writeProviderRepo(provider);
    configureGitProviderSource(tmp, provider);

    const result = runCli(tmp, ["upgrade"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const config = readConfig(tmp);
    const pkg = config.plugin.packages.find((entry) => entry.id === "official-presets");
    assert.ok(pkg, "upgrade must enable the provider package from a git source");
    assert.equal(pkg.commit, commit);
    assert.equal(config.plugin.sources.find((source) => source.id === pkg.source).type, "git");
  });

  it("R3: upgrade adds the official default source when no suitable provider source exists", () => {
    tmp = createProject("default-source");
    const provider = path.join(tmp, "fixtures", "default-senti-presets");
    const commit = writeProviderRepo(provider);

    const result = runCli(tmp, ["upgrade"], {
      SENTI_OFFICIAL_PRESETS_REPO: provider,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const config = readConfig(tmp);
    const source = config.plugin.sources.find((entry) => entry.id === "official-presets");
    assert.ok(source, "upgrade must add the default official provider source");
    assert.equal(source.type, "git");
    assert.equal(source.remote, "git@github.com:SpreadWorks/senti-presets.git");
    const pkg = config.plugin.packages.find((entry) => entry.id === "official-presets");
    assert.ok(pkg, "upgrade must enable the default provider package");
    assert.equal(pkg.source, "official-presets");
    assert.equal(pkg.commit, commit);
    assert.ok(fs.existsSync(path.join(tmp, ".senti", "plugins", "official-presets", "plugin.json")));
    assert.deepEqual(resolveChain("child-preset", tmp).map((preset) => preset.key), [
      "base",
      "sample-preset",
      "child-preset",
    ]);
  });

  it("R3/R9: upgrade fails non-zero when a provider cannot be found", () => {
    tmp = createProject("missing-provider");

    const result = runCli(tmp, ["upgrade"]);

    assert.notEqual(result.status, 0, "unresolved provider must return a non-zero exit code");
    assert.match(`${result.stdout}\n${result.stderr}`, /provider|preset|not found|official-presets/i);
    assert.equal(loadPluginRegistry(tmp).resolvePreset("child-preset"), null);
  });

  it("R3: upgrade enforces the source search limit independently", () => {
    tmp = createProject("source-limit");
    const provider = path.join(tmp, "fixtures", "shallow-presets");
    writeProviderRepo(provider);
    const config = readConfig(tmp);
    config.plugin.sources = Array.from({ length: 101 }, (_, index) => ({
      id: `source-${index}`,
      type: "local",
      path: `missing-${index}`,
    }));
    config.plugin.sources[100] = {
      id: "official-presets",
      type: "local",
      path: path.relative(tmp, provider).split(path.sep).join("/"),
    };
    writeJson(tmp, ".senti/config.json", config);

    const result = runCli(tmp, ["upgrade"]);

    assert.notEqual(result.status, 0, "upgrade must fail before searching more than 100 sources");
    assert.match(`${result.stdout}\n${result.stderr}`, /100|source/i);
  });

  it("R3: upgrade enforces parent-chain depth 16 independently", () => {
    tmp = createProject("depth-limit", { type: "deep-17" });
    const provider = path.join(tmp, "fixtures", "deep-presets");
    writeProviderRepo(provider, { depth: 17 });
    configureProviderSource(tmp, provider);

    const result = runCli(tmp, ["upgrade"]);

    assert.notEqual(result.status, 0, "upgrade must fail when provider parent traversal exceeds depth 16");
    assert.match(`${result.stdout}\n${result.stderr}`, /depth|16/i);
  });

  it("R3: upgrade fails non-zero when a found child references an unresolved non-base parent", () => {
    tmp = createProject("missing-parent");
    const provider = path.join(tmp, "fixtures", "broken-parent-presets");
    writeBrokenParentProviderRepo(provider);
    configureProviderSource(tmp, provider);

    const result = runCli(tmp, ["upgrade"]);

    assert.notEqual(result.status, 0, "unresolved non-base parent provider must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /missing-parent|parent|provider/i);
  });

  it("R4: upgrade migrates manifestless legacy presets using provider parent scan and chapters", () => {
    tmp = createProject("legacy-manifestless");
    const provider = path.join(tmp, "fixtures", "senti-presets");
    writeProviderRepo(provider);
    configureProviderSource(tmp, provider);
    writeFile(tmp, ".senti/presets/child-preset/data/local.js", "export default class Local {}\n");

    const result = runCli(tmp, ["upgrade"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const chain = resolveChain("child-preset", tmp);
    const leaf = chain.at(-1);
    assert.equal(leaf.parent, "sample-preset");
    assert.deepEqual(leaf.scan, { include: ["app"] });
    assert.deepEqual(leaf.chapters, [{ chapter: "child.md" }]);
    assert.ok(!leaf.dir.includes(`${path.sep}.senti${path.sep}presets${path.sep}`),
      "runtime resolution must not treat legacy .senti/presets as a leaf override");
    assert.ok(
      findMigratedFile(tmp, "presets/child-preset/data/local.js").length > 0,
      "legacy DataSource files must be copied into the migrated local plugin package/source",
    );
  });

  it("R4: upgrade preserves explicit legacy preset manifests in the migrated plugin package", () => {
    tmp = createProject("legacy-manifest", { type: "legacy-child" });
    writeJson(tmp, ".senti/presets/legacy-child/preset.json", {
      parent: "base",
      label: "Legacy Child",
      scan: { include: ["legacy-src"] },
      chapters: [{ chapter: "legacy.md" }],
    });
    writeFile(tmp, ".senti/presets/legacy-child/data/local.js", "export default class Local {}\n");

    const result = runCli(tmp, ["upgrade"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const leaf = resolveChain("legacy-child", tmp).at(-1);
    assert.equal(leaf.label, "Legacy Child");
    assert.deepEqual(leaf.scan, { include: ["legacy-src"] });
    assert.deepEqual(leaf.chapters, [{ chapter: "legacy.md" }]);
    assert.ok(!leaf.dir.includes(`${path.sep}.senti${path.sep}presets${path.sep}`),
      "legacy preset content must move behind plugin registry resolution");
    assert.ok(
      findMigratedFile(tmp, "presets/legacy-child/data/local.js").length > 0,
      "explicit legacy preset files must be preserved in the migrated plugin package/source",
    );
  });

  it("R4: upgrade migrates manifestless legacy presets without providers as bare presets", () => {
    tmp = createProject("legacy-bare", { type: "orphan-preset" });
    writeFile(tmp, ".senti/presets/orphan-preset/data/local.js", "export default class Local {}\n");

    const result = runCli(tmp, ["upgrade"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const leaf = resolveChain("orphan-preset", tmp).at(-1);
    assert.equal(leaf.parent, null);
    assert.deepEqual(leaf.scan, {});
    assert.deepEqual(leaf.chapters, []);
    assert.ok(!leaf.dir.includes(`${path.sep}.senti${path.sep}presets${path.sep}`));
    assert.ok(
      findMigratedFile(tmp, "presets/orphan-preset/data/local.js").length > 0,
      "bare legacy preset files must be preserved in the migrated plugin package/source",
    );
  });

  it("R4/R9: upgrade fails non-zero with a clear migration error for invalid legacy presets", () => {
    tmp = createProject("legacy-invalid", { type: "broken-legacy" });
    writeFile(tmp, ".senti/presets/broken-legacy/preset.json", "{ invalid json\n");
    writeFile(tmp, ".senti/presets/broken-legacy/data/local.js", "export default class Local {}\n");

    const result = runCli(tmp, ["upgrade"]);

    assert.notEqual(result.status, 0, "invalid legacy preset migration must fail");
    assert.match(`${result.stdout}\n${result.stderr}`, /legacy|migration|preset\.json|broken-legacy/i);
    assert.equal(loadPluginRegistry(tmp).resolvePreset("broken-legacy"), null);
  });

  it("R9: upgrade keeps --dry-run stable and rejects unsupported arguments with non-zero status", () => {
    tmp = createProject("cli-flags", { type: "base" });

    const dryRun = runCli(tmp, ["upgrade", "--dry-run"]);
    const invalidFlag = runCli(tmp, ["upgrade", "--output", "x"]);
    const positional = runCli(tmp, ["upgrade", "extra"]);

    assert.equal(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
    assert.notEqual(invalidFlag.status, 0, "unsupported option must fail");
    assert.notEqual(positional.status, 0, "positional argument must fail");
  });
});
