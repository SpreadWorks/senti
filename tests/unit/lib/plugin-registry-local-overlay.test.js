import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { ensureOfficialPackage, installPlugin, readProjectConfig } from "../../../src/lib/plugin-registry.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../helpers/git-repo.js";

function writeOfficialPresetSource(root, rel) {
  const pluginRoot = path.join(root, rel);
  fs.mkdirSync(pluginRoot, { recursive: true });
  writeJson(pluginRoot, "plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key: "sample-preset", path: "presets/sample-preset", parent: "base" }],
    },
  });
  writeJson(pluginRoot, "presets/sample-preset/preset.json", {
    parent: "base",
    label: "Sample",
    chapters: [],
  });
  initGitRepo(pluginRoot);
  commitAll(pluginRoot, "init");
  return pluginRoot;
}

describe("plugin registry local overlay", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("installs a plugin from local overlay without writing private source data to public config", () => {
    tmp = createTmpDir();
    const pluginRoot = path.join(tmp, "private-plugin-source");
    fs.mkdirSync(pluginRoot, { recursive: true });
    writeJson(pluginRoot, "plugin.json", {
      name: "private-plugin",
      type: "mixed",
      files: ["plugin.json"],
      contributions: {},
    });
    writeJson(tmp, ".sennel/config.json", {
      plugin: {
        sources: [],
        packages: [],
      },
    });
    writeJson(tmp, ".sennel/config.local.json", {
      plugin: {
        sources: [{ id: "private-source", type: "local", path: pluginRoot }],
        packages: [{ id: "private-plugin", source: "private-source", commit: "a".repeat(40) }],
      },
    });

    const installed = installPlugin(tmp, "private-plugin");
    assert.equal(installed.id, "private-plugin");
    assert.equal(fs.existsSync(path.join(tmp, ".sennel", "plugins", "private-plugin", "plugin.json")), true);

    const publicConfig = JSON.parse(fs.readFileSync(path.join(tmp, ".sennel", "config.json"), "utf8"));
    assert.deepEqual(publicConfig.plugin.sources, []);
    assert.deepEqual(publicConfig.plugin.packages, []);

    const merged = readProjectConfig(tmp);
    assert.equal(merged.plugin.sources[0].id, "private-source");
    assert.equal(merged.plugin.packages[0].id, "private-plugin");
  });

  it("repairs an existing official preset default remote by materializing the explicit source root", () => {
    tmp = createTmpDir();
    const sourceRoot = writeOfficialPresetSource(tmp, "official-source");
    writeJson(tmp, ".sennel/config.json", {
      plugin: {
        sources: [
          {
            id: "official-presets",
            type: "git",
            remote: "git@github.com:SpreadWorks/sennel-presets.git",
          },
        ],
        packages: [],
      },
    });

    ensureOfficialPackage(tmp, {
      id: "official-presets",
      sourceRoot,
    });

    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".sennel", "config.json"), "utf8"));
    assert.equal(config.plugin.sources.length, 1);
    assert.equal(config.plugin.sources[0].remote, "git@github.com:SpreadWorks/sennel-presets.git");
    assert.equal(config.plugin.packages.length, 1);
    assert.equal(config.plugin.packages[0].id, "official-presets");
    assert.equal(fs.existsSync(path.join(tmp, ".sennel", "plugins", "official-presets", "plugin.json")), true);
  });

  it("does not persist the default official preset source when provider resolution fails", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", {
      plugin: {
        sources: [],
        packages: [],
      },
    });

    assert.throws(
      () => ensureOfficialPackage(tmp, {
        id: "official-presets",
        sourceRoot: path.join(tmp, "missing-official-source"),
      }),
      /plugin source not found/,
    );

    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".sennel", "config.json"), "utf8"));
    assert.deepEqual(config.plugin.sources, []);
    assert.deepEqual(config.plugin.packages, []);
  });
});
