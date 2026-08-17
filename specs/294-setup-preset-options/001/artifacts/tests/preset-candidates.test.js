// spec: R1 R2 R5 R9
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";

async function loadPresetHelpers() {
  const mod = await import(`../../../src/lib/presets.js?spec294=${Date.now()}-${Math.random()}`);
  assert.equal(typeof mod.listSetupPresetCandidates, "function");
  return mod;
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

function keys(candidates) {
  return candidates.map((preset) => preset.key);
}

describe("setup preset candidate discovery", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R1: candidate provider includes core presets and installed plugin presets in deterministic order", async () => {
    tmp = createTmpDir("senti-294-candidates-");
    writeProjectConfig(tmp, {
      sources: [{ id: "fixture-presets", type: "local", path: ".senti/plugins/fixture-presets" }],
      packages: [{ id: "fixture-presets", source: "fixture-presets", commit: SHA }],
    });
    writePresetPlugin(tmp, "fixture-presets", [
      { key: "alpha", label: "Alpha" },
      { key: "beta", label: "Beta" },
    ]);

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.deepEqual(keys(listSetupPresetCandidates(tmp)), ["base", "alpha", "beta"]);
  });

  it("R2: fresh official discovery is read-only before setup confirmation", async () => {
    tmp = createTmpDir("senti-294-official-readonly-");
    const officialRoot = path.join(tmp, "official-presets");
    fs.mkdirSync(officialRoot, { recursive: true });
    writeOfficialSource(officialRoot);
    const projectRoot = path.join(tmp, "project");
    fs.mkdirSync(projectRoot, { recursive: true });

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    const candidates = listSetupPresetCandidates(projectRoot, {
      officialPresetRoot: officialRoot,
      includeOfficialPresets: true,
    });

    assert.deepEqual(keys(candidates), ["base", "webapp"]);
    assert.equal(fs.existsSync(path.join(projectRoot, ".senti", "config.json")), false);
    assert.equal(fs.existsSync(path.join(projectRoot, ".senti", "plugins", "official-presets")), false);
  });

  it("R2: unresolved official discovery fails loudly without writing project state", async () => {
    tmp = createTmpDir("senti-294-official-missing-");
    const projectRoot = path.join(tmp, "project");
    fs.mkdirSync(projectRoot, { recursive: true });

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.throws(
      () => listSetupPresetCandidates(projectRoot, {
        officialPresetRoot: path.join(tmp, "missing-official-presets"),
        includeOfficialPresets: true,
      }),
      /official|preset|source|not found|cannot resolve/i,
    );
    assert.equal(fs.existsSync(path.join(projectRoot, ".senti", "config.json")), false);
    assert.equal(fs.existsSync(path.join(projectRoot, ".senti", "plugins")), false);
  });

  it("R5: missing non-official installed manifests are ignored without source fetch or update", async () => {
    tmp = createTmpDir("senti-294-missing-plugin-");
    writeProjectConfig(tmp, {
      sources: [{ id: "missing-presets", type: "local", path: "missing-source" }],
      packages: [{ id: "missing-presets", source: "missing-presets", commit: SHA }],
    });

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.deepEqual(keys(listSetupPresetCandidates(tmp)), ["base"]);
    assert.equal(fs.existsSync(path.join(tmp, ".senti", "plugin-sources")), false);
  });

  it("R9: candidate discovery enforces existing enabled package bounds", async () => {
    tmp = createTmpDir("senti-294-bounds-");
    writeProjectConfig(tmp, {
      sources: [{ id: "shared-source", type: "local", path: ".senti/plugins/shared-source" }],
      packages: Array.from({ length: 101 }, (_, i) => ({
        id: `pkg-${i}`,
        source: "shared-source",
        commit: SHA,
      })),
    });

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.throws(
      () => listSetupPresetCandidates(tmp),
      /enabled plugin packages exceed 100|MAX_ENABLED_PLUGIN_PACKAGES/i,
    );
  });

  it("R9: candidate discovery enforces configured plugin source bounds", async () => {
    tmp = createTmpDir("senti-294-source-bounds-");
    writeProjectConfig(tmp, {
      sources: Array.from({ length: 101 }, (_, i) => ({
        id: `source-${i}`,
        type: "local",
        path: `.senti/plugins/source-${i}`,
      })),
      packages: [],
    });

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.throws(
      () => listSetupPresetCandidates(tmp),
      /plugin source search exceeds 100|MAX_PLUGIN_SOURCES/i,
    );
  });

  it("R9: candidate discovery enforces installed plugin metadata size bounds", async () => {
    tmp = createTmpDir("senti-294-json-bound-");
    writeProjectConfig(tmp, {
      sources: [{ id: "huge-presets", type: "local", path: ".senti/plugins/huge-presets" }],
      packages: [{ id: "huge-presets", source: "huge-presets", commit: SHA }],
    });
    fs.mkdirSync(path.join(tmp, ".senti", "plugins", "huge-presets"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, ".senti", "plugins", "huge-presets", "plugin.json"),
      JSON.stringify({
        name: "huge-presets",
        type: "preset",
        files: ["plugin.json"],
        contributions: { presets: [] },
        padding: "x".repeat(1024 * 1024),
      }),
      "utf8",
    );

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.throws(
      () => listSetupPresetCandidates(tmp),
      /JSON file exceeds 1048576|MAX_PLUGIN_JSON_BYTES/i,
    );
  });

  it("R9: candidate discovery enforces official preset metadata size bounds", async () => {
    tmp = createTmpDir("senti-294-official-json-bound-");
    const officialRoot = path.join(tmp, "official-presets");
    const projectRoot = path.join(tmp, "project");
    fs.mkdirSync(officialRoot, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.writeFileSync(
      path.join(officialRoot, "plugin.json"),
      JSON.stringify({
        name: "official-presets",
        type: "preset",
        files: ["plugin.json"],
        contributions: { presets: [] },
        padding: "x".repeat(1024 * 1024),
      }),
      "utf8",
    );

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.throws(
      () => listSetupPresetCandidates(projectRoot, {
        officialPresetRoot: officialRoot,
        includeOfficialPresets: true,
      }),
      /JSON file exceeds 1048576|MAX_PLUGIN_JSON_BYTES/i,
    );
  });

  it("R9: candidate discovery enforces plugin path safety bounds", async () => {
    tmp = createTmpDir("senti-294-path-bound-");
    writeProjectConfig(tmp, {
      sources: [{ id: "bad-presets", type: "local", path: ".senti/plugins/bad-presets" }],
      packages: [{ id: "bad-presets", source: "bad-presets", commit: SHA }],
    });
    writeJson(tmp, ".senti/plugins/bad-presets/plugin.json", {
      name: "bad-presets",
      type: "preset",
      files: ["plugin.json", "presets/"],
      contributions: {
        presets: [{ key: "bad", path: "../outside", parent: "base" }],
      },
    });

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.throws(
      () => listSetupPresetCandidates(tmp),
      /unsafe|parent traversal|outside files allowlist|path/i,
    );
  });

  it("R9: candidate discovery rejects plugin metadata symlinks escaping the plugin root", async () => {
    tmp = createTmpDir("senti-294-symlink-bound-");
    writeProjectConfig(tmp, {
      sources: [{ id: "symlink-presets", type: "local", path: ".senti/plugins/symlink-presets" }],
      packages: [{ id: "symlink-presets", source: "symlink-presets", commit: SHA }],
    });
    writeJson(tmp, ".senti/plugins/symlink-presets/plugin.json", {
      name: "symlink-presets",
      type: "preset",
      files: ["plugin.json", "presets/"],
      contributions: {
        presets: [{ key: "escape", path: "presets/escape", parent: "base" }],
      },
    });
    writeJson(tmp, "outside-preset.json", {
      parent: "base",
      label: "Escaped",
      chapters: [],
    });
    fs.mkdirSync(path.join(tmp, ".senti", "plugins", "symlink-presets", "presets", "escape"), { recursive: true });
    fs.symlinkSync(
      path.join(tmp, "outside-preset.json"),
      path.join(tmp, ".senti", "plugins", "symlink-presets", "presets", "escape", "preset.json"),
    );

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.throws(
      () => listSetupPresetCandidates(tmp),
      /symlink not allowed|escapes plugin root|unsafe package metadata/i,
    );
  });

  it("R9: candidate discovery preserves preset chain depth bounds", async () => {
    tmp = createTmpDir("senti-294-depth-bound-");
    writeProjectConfig(tmp, {
      sources: [{ id: "deep-presets", type: "local", path: ".senti/plugins/deep-presets" }],
      packages: [{ id: "deep-presets", source: "deep-presets", commit: SHA }],
    });
    const entries = Array.from({ length: 17 }, (_, i) => ({
      key: `level-${i + 1}`,
      parent: i === 0 ? "base" : `level-${i}`,
    }));
    writePresetPlugin(tmp, "deep-presets", entries);

    const { listSetupPresetCandidates } = await loadPresetHelpers();
    assert.throws(
      () => listSetupPresetCandidates(tmp),
      /chain depth|MAX_CHAIN_DEPTH|exceeds/i,
    );
  });
});
