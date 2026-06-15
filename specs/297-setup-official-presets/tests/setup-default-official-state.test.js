// spec: R3 R4 R6
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";

async function importFresh(relPath) {
  return import(`../../../${relPath}?spec297=${Date.now()}-${Math.random()}`);
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

function defaultOfficialSource(root) {
  return { id: "official-presets", type: "local", path: root };
}

function keys(candidates) {
  return candidates.map((preset) => preset.key);
}

describe("setup default official preset persistence", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R3: base-only setup does not persist default official plugin state", async () => {
    tmp = createTmpDir("senti-297-default-base-only-");
    const officialRoot = path.join(tmp, "official-presets");
    const projectRoot = path.join(tmp, "project");
    writeOfficialSource(officialRoot);
    writeProject(projectRoot, "base");
    delete process.env.SENTI_OFFICIAL_PRESETS_REPO;

    const { listSetupWizardPresetCandidates } = await importFresh("src/setup.js");
    const candidates = listSetupWizardPresetCandidates(projectRoot, {
      defaultOfficialPresetSource: defaultOfficialSource(officialRoot),
    });
    assert.deepEqual(keys(candidates), ["base", "webapp"]);

    const { ensureSetupOfficialPresetState } = await importFresh("src/lib/plugin-registry.js");
    ensureSetupOfficialPresetState(projectRoot, {
      selectedTypes: ["base"],
      officialPresetSource: defaultOfficialSource(officialRoot),
    });

    const config = readJson(path.join(projectRoot, ".senti", "config.json"));
    assert.equal(config.plugin.sources.some((source) => source.id === "official-presets"), false);
    assert.equal(config.plugin.packages.some((pkg) => pkg.id === "official-presets"), false);
    assert.equal(fs.existsSync(path.join(projectRoot, ".senti", "plugins", "official-presets")), false);
  });

  it("R4: selecting a default-source official preset persists installable official state", async () => {
    tmp = createTmpDir("senti-297-default-state-");
    const officialRoot = path.join(tmp, "official-presets");
    const projectRoot = path.join(tmp, "project");
    writeOfficialSource(officialRoot);
    writeProject(projectRoot, "webapp");
    delete process.env.SENTI_OFFICIAL_PRESETS_REPO;

    const { ensureSetupOfficialPresetState } = await importFresh("src/lib/plugin-registry.js");
    ensureSetupOfficialPresetState(projectRoot, {
      selectedTypes: ["webapp"],
      officialPresetSource: defaultOfficialSource(officialRoot),
    });

    const config = readJson(path.join(projectRoot, ".senti", "config.json"));
    const source = config.plugin.sources.find((entry) => entry.id === "official-presets");
    const pkg = config.plugin.packages.find((entry) => entry.id === "official-presets");
    assert.deepEqual(source, { id: "official-presets", type: "local", path: officialRoot });
    assert.equal(pkg.source, "official-presets");
    assert.equal(
      fs.existsSync(path.join(projectRoot, ".senti", "plugins", "official-presets", "plugin.json")),
      true,
    );

    const { resolveMultiChains, validatePresetChain } = await importFresh("src/lib/presets.js");
    assert.equal(resolveMultiChains("webapp", projectRoot).at(-1).at(-1).key, "webapp");
    assert.doesNotThrow(() => validatePresetChain("webapp", projectRoot, { languages: ["en"] }));
  });

  it("R6: default-source official state does not copy private local plugin entries into public config", async () => {
    tmp = createTmpDir("senti-297-default-local-privacy-");
    const officialRoot = path.join(tmp, "official-presets");
    const projectRoot = path.join(tmp, "project");
    writeOfficialSource(officialRoot);
    writeProject(projectRoot, "webapp");
    writeJson(projectRoot, ".senti/config.local.json", {
      plugin: {
        sources: [{ id: "private-presets", type: "local", path: "/private/presets" }],
        packages: [{ id: "private-presets", source: "private-presets", commit: SHA }],
      },
    });
    delete process.env.SENTI_OFFICIAL_PRESETS_REPO;

    const { ensureSetupOfficialPresetState } = await importFresh("src/lib/plugin-registry.js");
    ensureSetupOfficialPresetState(projectRoot, {
      selectedTypes: ["webapp"],
      officialPresetSource: defaultOfficialSource(officialRoot),
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
  });
});
