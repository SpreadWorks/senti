// spec: R3 R4 R8 R9
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";

async function loadPluginHelpers() {
  const mod = await import(`../../../src/lib/plugin-registry.js?spec294=${Date.now()}-${Math.random()}`);
  assert.equal(typeof mod.ensureSetupOfficialPresetState, "function");
  return mod;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeProject(root, type = "base") {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type,
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [],
      packages: [],
    },
  });
}

function writeProjectWithPluginState(root, type, plugin) {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type,
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin,
  });
}

function writeOfficialSource(root) {
  writeJson(root, "plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key: "webapp", path: "presets/webapp", parent: "base" }],
    },
  });
  writeJson(root, "presets/webapp/preset.json", {
    parent: "base",
    label: "Webapp",
    chapters: [],
  });
}

describe("setup official preset state", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R3: selected non-base official presets persist resolvable plugin state", async () => {
    tmp = createTmpDir("senti-294-official-state-");
    const officialRoot = path.join(tmp, "official-presets");
    fs.mkdirSync(officialRoot, { recursive: true });
    writeOfficialSource(officialRoot);
    const projectRoot = path.join(tmp, "project");
    writeProject(projectRoot, "webapp");

    const { ensureSetupOfficialPresetState } = await loadPluginHelpers();
    ensureSetupOfficialPresetState(projectRoot, {
      selectedTypes: ["webapp"],
      officialPresetRoot: officialRoot,
    });

    const config = readJson(path.join(projectRoot, ".senti", "config.json"));
    assert.ok(config.plugin.sources.some((source) => source.id === "official-presets"));
    assert.ok(config.plugin.packages.some((pkg) => pkg.id === "official-presets"));
    assert.equal(
      fs.existsSync(path.join(projectRoot, ".senti", "plugins", "official-presets", "plugin.json")),
      true,
    );

    const { resolveMultiChains, validatePresetChain } = await import("../../../src/lib/presets.js");
    assert.equal(resolveMultiChains("webapp", projectRoot).at(-1).at(-1).key, "webapp");
    assert.doesNotThrow(() => validatePresetChain("webapp", projectRoot, { languages: ["en"] }));
  });

  it("R4: base-only selections do not persist official preset plugin state", async () => {
    tmp = createTmpDir("senti-294-base-only-");
    const officialRoot = path.join(tmp, "official-presets");
    fs.mkdirSync(officialRoot, { recursive: true });
    writeOfficialSource(officialRoot);
    const projectRoot = path.join(tmp, "project");
    writeProject(projectRoot, "base");

    const { ensureSetupOfficialPresetState } = await loadPluginHelpers();
    ensureSetupOfficialPresetState(projectRoot, {
      selectedTypes: ["base"],
      officialPresetRoot: officialRoot,
    });

    const config = readJson(path.join(projectRoot, ".senti", "config.json"));
    assert.equal(config.plugin.sources.some((source) => source.id === "official-presets"), false);
    assert.equal(config.plugin.packages.some((pkg) => pkg.id === "official-presets"), false);
    assert.equal(fs.existsSync(path.join(projectRoot, ".senti", "plugins", "official-presets")), false);
  });

  it("R8: official state writes do not publish config.local plugin entries", async () => {
    tmp = createTmpDir("senti-294-local-privacy-");
    const officialRoot = path.join(tmp, "official-presets");
    fs.mkdirSync(officialRoot, { recursive: true });
    writeOfficialSource(officialRoot);
    const projectRoot = path.join(tmp, "project");
    writeProject(projectRoot, "webapp");
    writeJson(projectRoot, ".senti/config.local.json", {
      plugin: {
        sources: [{ id: "private-presets", type: "local", path: "/private/presets" }],
        packages: [{ id: "private-presets", source: "private-presets", commit: SHA }],
      },
    });

    const { ensureSetupOfficialPresetState } = await loadPluginHelpers();
    ensureSetupOfficialPresetState(projectRoot, {
      selectedTypes: ["webapp"],
      officialPresetRoot: officialRoot,
    });

    const publicConfig = readJson(path.join(projectRoot, ".senti", "config.json"));
    const localConfig = readJson(path.join(projectRoot, ".senti", "config.local.json"));
    assert.equal(publicConfig.plugin.sources.some((source) => source.id === "private-presets"), false);
    assert.equal(publicConfig.plugin.packages.some((pkg) => pkg.id === "private-presets"), false);
    assert.equal(publicConfig.plugin.sources.some((source) => source.id === "official-presets"), true);
    assert.equal(publicConfig.plugin.packages.some((pkg) => pkg.id === "official-presets"), true);
    assert.deepEqual(localConfig.plugin.sources, [
      { id: "private-presets", type: "local", path: "/private/presets" },
    ]);
    assert.deepEqual(localConfig.plugin.packages, [
      { id: "private-presets", source: "private-presets", commit: SHA },
    ]);
    assert.equal(localConfig.plugin.sources.some((source) => source.id === "official-presets"), false);
    assert.equal(localConfig.plugin.packages.some((pkg) => pkg.id === "official-presets"), false);
  });

  it("R9: official state rejects adding a source beyond the source count bound", async () => {
    tmp = createTmpDir("senti-294-official-source-bound-");
    const officialRoot = path.join(tmp, "official-presets");
    fs.mkdirSync(officialRoot, { recursive: true });
    writeOfficialSource(officialRoot);
    const projectRoot = path.join(tmp, "project");
    writeProjectWithPluginState(projectRoot, "webapp", {
      sources: Array.from({ length: 100 }, (_, i) => ({
        id: `source-${i}`,
        type: "local",
        path: `.senti/plugins/source-${i}`,
      })),
      packages: [],
    });

    const { ensureSetupOfficialPresetState } = await loadPluginHelpers();
    assert.throws(
      () => ensureSetupOfficialPresetState(projectRoot, {
        selectedTypes: ["webapp"],
        officialPresetRoot: officialRoot,
      }),
      /plugin source search exceeds 100|MAX_PLUGIN_SOURCES/i,
    );

    const config = readJson(path.join(projectRoot, ".senti", "config.json"));
    assert.equal(config.plugin.sources.length, 100);
    assert.equal(config.plugin.sources.some((source) => source.id === "official-presets"), false);
  });
});
