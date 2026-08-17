// spec: R1 R2 R3 R5 R7
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";

async function importFresh(relPath) {
  return import(`../../../${relPath}?spec297=${Date.now()}-${Math.random()}`);
}

function writeProjectConfig(root, plugin = {}) {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin,
  });
}

function writePresetPlugin(root, id, entries) {
  writeJson(root, `.senti/plugins/${id}/plugin.json`, {
    name: id,
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: entries.map((entry) => ({
        key: entry.key,
        path: `presets/${entry.key}`,
        parent: entry.parent || "base",
      })),
    },
  });
  for (const entry of entries) {
    writeJson(root, `.senti/plugins/${id}/presets/${entry.key}/preset.json`, {
      parent: entry.parent || "base",
      label: entry.label || entry.key,
      chapters: [],
    });
  }
}

function writeOfficialSource(root, key, label = key) {
  writeJson(root, "plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key, path: `presets/${key}`, parent: "base" }],
    },
  });
  writeJson(root, `presets/${key}/preset.json`, {
    parent: "base",
    label,
    chapters: [],
  });
}

function defaultOfficialSource(root) {
  return { id: "official-presets", type: "local", path: root };
}

function keys(candidates) {
  return candidates.map((preset) => preset.key);
}

describe("setup default official preset candidate discovery", () => {
  let tmp;
  let originalOfficialRepo;

  afterEach(() => {
    if (originalOfficialRepo === undefined) delete process.env.SENTI_OFFICIAL_PRESETS_REPO;
    else process.env.SENTI_OFFICIAL_PRESETS_REPO = originalOfficialRepo;
    if (tmp) removeTmpDir(tmp);
    tmp = null;
    originalOfficialRepo = undefined;
  });

  it("R1: fresh setup uses the default official source when the env override is unset", async () => {
    tmp = createTmpDir("senti-297-default-candidates-");
    const officialRoot = path.join(tmp, "official-presets");
    const projectRoot = path.join(tmp, "project");
    fs.mkdirSync(projectRoot, { recursive: true });
    writeOfficialSource(officialRoot, "webapp", "Webapp");
    delete process.env.SENTI_OFFICIAL_PRESETS_REPO;

    const { listSetupWizardPresetCandidates } = await importFresh("src/setup.js");
    const candidates = listSetupWizardPresetCandidates(projectRoot, {
      defaultOfficialPresetSource: defaultOfficialSource(officialRoot),
    });

    assert.deepEqual(keys(candidates), ["base", "webapp"]);
  });

  it("R2: SENTI_OFFICIAL_PRESETS_REPO takes precedence over the default official source", async () => {
    tmp = createTmpDir("senti-297-env-override-");
    originalOfficialRepo = process.env.SENTI_OFFICIAL_PRESETS_REPO;
    const envRoot = path.join(tmp, "env-official-presets");
    const defaultRoot = path.join(tmp, "default-official-presets");
    const projectRoot = path.join(tmp, "project");
    fs.mkdirSync(projectRoot, { recursive: true });
    writeOfficialSource(envRoot, "env-webapp", "Env Webapp");
    writeOfficialSource(defaultRoot, "default-webapp", "Default Webapp");
    process.env.SENTI_OFFICIAL_PRESETS_REPO = envRoot;

    const { listSetupWizardPresetCandidates } = await importFresh("src/setup.js");
    const candidates = listSetupWizardPresetCandidates(projectRoot, {
      defaultOfficialPresetSource: defaultOfficialSource(defaultRoot),
    });

    assert.deepEqual(keys(candidates), ["base", "env-webapp"]);
  });

  it("R3: discovering default official candidates does not persist official plugin state", async () => {
    tmp = createTmpDir("senti-297-default-readonly-");
    const officialRoot = path.join(tmp, "official-presets");
    const projectRoot = path.join(tmp, "project");
    fs.mkdirSync(projectRoot, { recursive: true });
    writeOfficialSource(officialRoot, "webapp", "Webapp");
    delete process.env.SENTI_OFFICIAL_PRESETS_REPO;

    const { listSetupWizardPresetCandidates } = await importFresh("src/setup.js");
    const candidates = listSetupWizardPresetCandidates(projectRoot, {
      defaultOfficialPresetSource: defaultOfficialSource(officialRoot),
    });

    assert.deepEqual(keys(candidates), ["base", "webapp"]);
    assert.equal(fs.existsSync(path.join(projectRoot, ".senti", "config.json")), false);
    assert.equal(fs.existsSync(path.join(projectRoot, ".senti", "plugins", "official-presets")), false);
  });

  it("R5: unresolved default official source fails instead of returning only base", async () => {
    tmp = createTmpDir("senti-297-default-missing-");
    const projectRoot = path.join(tmp, "project");
    fs.mkdirSync(projectRoot, { recursive: true });
    delete process.env.SENTI_OFFICIAL_PRESETS_REPO;

    const { listSetupWizardPresetCandidates } = await importFresh("src/setup.js");
    let thrown;
    try {
      listSetupWizardPresetCandidates(projectRoot, {
        defaultOfficialPresetSource: defaultOfficialSource(path.join(tmp, "missing-official-presets")),
      });
    } catch (err) {
      thrown = err;
    }

    assert.ok(thrown, "default official source resolution must throw");
    assert.match(thrown.message, /official|source|not found|cannot resolve/i);
    assert.ok(thrown.cause, "default official source failure must retain the underlying cause");
  });

  it("R7: installed plugin preset candidates remain present with default official candidates", async () => {
    tmp = createTmpDir("senti-297-installed-plus-default-");
    const officialRoot = path.join(tmp, "official-presets");
    const projectRoot = path.join(tmp, "project");
    writeOfficialSource(officialRoot, "webapp", "Webapp");
    writeProjectConfig(projectRoot, {
      sources: [{ id: "fixture-presets", type: "local", path: ".senti/plugins/fixture-presets" }],
      packages: [{ id: "fixture-presets", source: "fixture-presets", commit: SHA }],
    });
    writePresetPlugin(projectRoot, "fixture-presets", [{ key: "alpha", label: "Alpha" }]);
    delete process.env.SENTI_OFFICIAL_PRESETS_REPO;

    const { listSetupWizardPresetCandidates } = await importFresh("src/setup.js");
    const candidates = listSetupWizardPresetCandidates(projectRoot, {
      defaultOfficialPresetSource: defaultOfficialSource(officialRoot),
    });

    assert.deepEqual(keys(candidates), ["base", "alpha", "webapp"]);
  });
});
