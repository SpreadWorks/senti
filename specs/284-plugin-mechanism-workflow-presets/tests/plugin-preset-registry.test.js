// spec: R5 R6 R7
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createResolver } from "../../../src/docs/lib/resolver-factory.js";
import { resolveChain } from "../../../src/lib/presets.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const SENTI = path.join(ROOT, "src", "senti.js");

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

function projectConfig(extra = {}) {
  const { presetRepo = "fixture-senti-presets", ...rest } = extra;
  return {
    lang: "en",
    type: "plugin-webapp",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: rest.plugin || {
      repos: [{ id: "local-presets", source: presetRepo }],
      packages: [
        { id: "official-presets", repo: "local-presets", commit: "0123456789abcdef0123456789abcdef01234567" },
      ],
    },
    ...rest,
  };
}

function writeSentiPresetsRepo(repo) {
  writeJson(repo, "plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["presets/", "plugin.json"],
    contributions: {
      presets: [
        { key: "node-cli", path: "presets/node-cli", parent: "base" },
        { key: "webapp", path: "presets/webapp", parent: "base" },
        { key: "laravel", path: "presets/laravel", parent: "webapp" },
        { key: "symfony", path: "presets/symfony", parent: "webapp" },
      ],
    },
  });
  for (const key of ["node-cli", "webapp", "laravel", "symfony"]) {
    writeJson(repo, `presets/${key}/preset.json`, {
      parent: key === "node-cli" || key === "webapp" ? "base" : "webapp",
      label: key,
      chapters: [{ chapter: "architecture.md" }],
    });
  }
  commitAll(repo);
}

function writeInstalledPresetPlugin(root) {
  writeJson(root, ".senti/plugins/official-presets/plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["presets/", "plugin.json"],
    contributions: {
      presets: [
        { key: "plugin-webapp", path: "presets/plugin-webapp", parent: "base" },
      ],
      dataSources: [
        {
          name: "plugin-webapp/routes",
          path: "presets/plugin-webapp/data/routes.js",
          category: "routes",
          methods: ["projectData"],
        },
      ],
    },
  });
  writeJson(root, ".senti/plugins/official-presets/presets/plugin-webapp/preset.json", {
    parent: "base",
    label: "Plugin Webapp",
    chapters: [{ chapter: "architecture.md" }],
  });
  writeFile(
    root,
    ".senti/plugins/official-presets/presets/plugin-webapp/data/routes.js",
    "export default class PluginRoutes { init() {} projectData() { return \"plugin-docs-loaded\"; } }\n",
  );
}

function writeOverridePresetPlugin(root) {
  writeJson(root, ".senti/plugins/override-presets/plugin.json", {
    name: "override-presets",
    type: "preset",
    files: ["presets/", "plugin.json"],
    contributions: {
      presets: [
        { key: "plugin-webapp", path: "presets/plugin-webapp", parent: "base" },
      ],
      dataSources: [
        {
          name: "plugin-webapp/routes",
          path: "presets/plugin-webapp/data/routes.js",
          category: "routes",
          methods: ["projectData", "summary"],
        },
      ],
    },
  });
  writeJson(root, ".senti/plugins/override-presets/presets/plugin-webapp/preset.json", {
    parent: "base",
    label: "Override Plugin Webapp",
    chapters: [{ chapter: "architecture.md" }],
  });
  writeFile(
    root,
    ".senti/plugins/override-presets/presets/plugin-webapp/data/routes.js",
    "export default class OverrideRoutes { init() {} projectData() { return \"override\"; } summary() { return \"ok\"; } }\n",
  );
}

function writeCyclePresetPlugin(root) {
  writeJson(root, ".senti/plugins/cycle-presets/plugin.json", {
    name: "cycle-presets",
    type: "preset",
    files: ["presets/", "plugin.json"],
    contributions: {
      presets: [
        { key: "cycle-a", path: "presets/cycle-a", parent: "cycle-b" },
        { key: "cycle-b", path: "presets/cycle-b", parent: "cycle-a" },
      ],
      dataSources: [],
    },
  });
  writeJson(root, ".senti/plugins/cycle-presets/presets/cycle-a/preset.json", { parent: "cycle-b" });
  writeJson(root, ".senti/plugins/cycle-presets/presets/cycle-b/preset.json", { parent: "cycle-a" });
}

describe("plugin preset registry integration", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R5: resolveChain uses enabled plugin preset contributions and project-local overlays", () => {
    tmp = createTmpDir("senti-plugin-preset-");
    const presetsRepo = path.join(tmp, "fixtures", "senti-presets");
    writeSentiPresetsRepo(presetsRepo);
    writeJson(tmp, ".senti/config.json", projectConfig({ presetRepo: presetsRepo }));
    writeInstalledPresetPlugin(tmp);
    writeFile(tmp, ".senti/presets/plugin-webapp/data/local.js", "export default class Local {}\n");

    const chain = resolveChain("plugin-webapp", tmp);

    assert.deepEqual(chain.map((preset) => preset.key), ["base", "plugin-webapp"]);
    assert.equal(chain.at(-1).dir, path.join(tmp, ".senti", "presets", "plugin-webapp"));
    assert.equal(chain.at(-1).parent, "base", "project-local overlay inherits plugin preset metadata");
  });

  it("R5: docs resolver loads DataSources from an enabled plugin preset contribution", async () => {
    tmp = createTmpDir("senti-plugin-docs-");
    const presetsRepo = path.join(tmp, "fixtures", "senti-presets");
    writeSentiPresetsRepo(presetsRepo);
    writeJson(tmp, ".senti/config.json", projectConfig({ presetRepo: presetsRepo }));
    writeInstalledPresetPlugin(tmp);

    const resolver = await createResolver("plugin-webapp", tmp, {});
    assert.deepEqual(resolver.presetKeys(), ["plugin-webapp"]);
    assert.equal(
      resolver.resolve("plugin-webapp", "routes", "projectData", {}, []),
      "plugin-docs-loaded",
    );
  });

  it("R5: setup dry-run accepts plugin repo preset candidates selected by type", () => {
    tmp = createTmpDir("senti-plugin-setup-");
    const presetsRepo = path.join(tmp, "fixtures", "senti-presets");
    writeSentiPresetsRepo(presetsRepo);
    fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
    writeJson(tmp, ".senti/config.json", projectConfig({ presetRepo: presetsRepo, type: "base" }));
    writeInstalledPresetPlugin(tmp);

    const result = runCli(tmp, [
      "setup",
      "--name", "plugin-setup",
      "--path", path.join(tmp, "src"),
      "--work-root", tmp,
      "--type", "plugin-webapp",
      "--purpose", "developer-guide",
      "--tone", "formal",
      "--lang", "en",
      "--dry-run",
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /plugin-webapp/);
  });

  it("R5: upgrade consumes an enabled plugin preset contribution as config.type", () => {
    tmp = createTmpDir("senti-plugin-upgrade-consumer-");
    const presetsRepo = path.join(tmp, "fixtures", "senti-presets");
    writeSentiPresetsRepo(presetsRepo);
    writeJson(tmp, ".senti/config.json", projectConfig({ presetRepo: presetsRepo }));
    writeInstalledPresetPlugin(tmp);

    const result = runCli(tmp, ["upgrade"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const chain = resolveChain("plugin-webapp", tmp);
    assert.deepEqual(chain.map((preset) => preset.key), ["base", "plugin-webapp"]);
  });

  it("R6: registry metadata validates DataSource static meta and bounded parent chains", async () => {
    tmp = createTmpDir("senti-plugin-meta-");
    const presetsRepo = path.join(tmp, "fixtures", "senti-presets");
    writeSentiPresetsRepo(presetsRepo);
    writeJson(tmp, ".senti/config.json", projectConfig({
      plugin: {
        repos: [
          { id: "local-presets", source: presetsRepo },
          { id: "override-presets", source: "../override-presets" },
          { id: "cycle-presets", source: "../cycle-presets" },
        ],
        packages: [
          { id: "official-presets", repo: "local-presets", commit: "0123456789abcdef0123456789abcdef01234567" },
          { id: "override-presets", repo: "override-presets", commit: "fedcba9876543210fedcba9876543210fedcba98" },
          { id: "cycle-presets", repo: "cycle-presets", commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        ],
      },
    }));
    writeInstalledPresetPlugin(tmp);
    writeOverridePresetPlugin(tmp);
    writeCyclePresetPlugin(tmp);

    const registryPath = path.join(ROOT, "src", "lib", "plugin-registry.js");
    assert.ok(fs.existsSync(registryPath), "src/lib/plugin-registry.js must exist");
    const registry = await import(registryPath);
    assert.equal(typeof registry.loadPluginRegistry, "function");

    const loaded = registry.loadPluginRegistry(tmp);
    assert.equal(loaded.dataSources.get("plugin-webapp/routes").category, "routes");
    assert.equal(
      loaded.resolveDataSource("plugin-webapp/routes").providerId,
      "override-presets",
      "later plugin.packages entries override earlier DataSource providers",
    );
    assert.throws(
      () => loaded.validatePresetChain("cycle-a", { maxDepth: 20 }),
      /cycle|depth|parent/i,
    );
    assert.doesNotThrow(() => loaded.validatePresetChain("plugin-webapp", { maxDepth: 20 }));
    assert.doesNotThrow(() => loaded.validateDataDirective("plugin-webapp/routes", "projectData"));
    assert.deepEqual(
      loaded.prevalidateTemplateDirective('{{data("plugin-webapp/routes.summary")}}'),
      { ok: true },
    );
    assert.equal(
      loaded.prevalidateTemplateDirective('{{data("plugin-webapp/routes.missingMethod")}}').ok,
      false,
    );
  });

  it("R7: non-base official presets move out of core and into the official senti-presets artifact", async () => {
    const corePresets = fs.readdirSync(path.join(ROOT, "src", "presets"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    assert.deepEqual(corePresets, ["base"], "core must keep only the base builtin preset");

    const officialPath = path.join(ROOT, "src", "lib", "official-plugins.js");
    assert.ok(fs.existsSync(officialPath), "src/lib/official-plugins.js must expose official plugin roots");
    const official = await import(officialPath);
    assert.equal(typeof official.officialPresetPluginRoot, "function");
    const manifestPath = path.join(official.officialPresetPluginRoot(), "plugin.json");
    assert.ok(fs.existsSync(manifestPath), `missing ${manifestPath}`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const presetKeys = manifest.contributions.presets.map((preset) => preset.key);
    for (const expected of ["node-cli", "webapp", "laravel", "symfony"]) {
      assert.ok(presetKeys.includes(expected), `senti-presets must contribute ${expected}`);
    }
  });

  it("R7: upgrade installs and enables official presets when existing config.type requires them", async () => {
    tmp = createTmpDir("senti-official-preset-upgrade-");
    writeJson(tmp, ".senti/config.json", {
      lang: "en",
      type: "webapp",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });

    const result = runCli(tmp, ["upgrade"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    assert.ok(config.plugin.repos.some((repo) => /preset/i.test(repo.id)));
    const official = config.plugin.packages.find((pkg) => /preset/i.test(pkg.id));
    assert.ok(official, "official preset package must be enabled");
    assert.match(official.commit, /^[0-9a-f]{40}$/);
    const officialModule = await import(path.join(ROOT, "src", "lib", "official-plugins.js"));
    const officialRoot = officialModule.officialPresetPluginRoot();
    const officialRepo = config.plugin.repos.find((repo) => repo.id === official.repo);
    assert.equal(officialRepo.source, officialRoot);
    assert.equal(config.type, "webapp");
  });
});
