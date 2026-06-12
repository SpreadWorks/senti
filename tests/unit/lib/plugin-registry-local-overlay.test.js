import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { installPlugin, readProjectConfig } from "../../../src/lib/plugin-registry.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";

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
    writeJson(tmp, ".senti/config.json", {
      plugin: {
        sources: [],
        packages: [],
      },
    });
    writeJson(tmp, ".senti/config.local.json", {
      plugin: {
        sources: [{ id: "private-source", type: "local", path: pluginRoot }],
        packages: [{ id: "private-plugin", source: "private-source", commit: "a".repeat(40) }],
      },
    });

    const installed = installPlugin(tmp, "private-plugin");
    assert.equal(installed.id, "private-plugin");
    assert.equal(fs.existsSync(path.join(tmp, ".senti", "plugins", "private-plugin", "plugin.json")), true);

    const publicConfig = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    assert.deepEqual(publicConfig.plugin.sources, []);
    assert.deepEqual(publicConfig.plugin.packages, []);

    const merged = readProjectConfig(tmp);
    assert.equal(merged.plugin.sources[0].id, "private-source");
    assert.equal(merged.plugin.packages[0].id, "private-plugin");
  });
});
