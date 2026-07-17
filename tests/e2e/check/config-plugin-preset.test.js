import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, it } from "node:test";

import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { resolveChain } from "../../../src/lib/presets.js";

const SENTI = path.join(process.cwd(), "src/senti.js");

function runConfigCheck(root) {
  return spawnSync("node", [SENTI, "check", "config", "--format", "json"], {
    encoding: "utf8",
    env: {
      ...process.env,
      SENTI_WORK_ROOT: root,
      SENTI_SOURCE_ROOT: root,
    },
  });
}

describe("check config plugin preset catalog", () => {
  let root;
  afterEach(() => root && removeTmpDir(root));

  it("accepts a plugin preset that the runtime can resolve", () => {
    root = createTmpDir("check-plugin-preset-");
    writeJson(root, ".senti/config.json", {
      lang: "en",
      type: "plugin-preset",
      docs: { languages: ["en"], defaultLanguage: "en" },
      plugin: {
        sources: [{ id: "plugin-source", type: "local", path: "unused" }],
        packages: [{
          id: "plugin-package",
          source: "plugin-source",
          commit: "a".repeat(40),
        }],
      },
    });
    writeJson(root, ".senti/plugins/plugin-package/plugin.json", {
      name: "plugin-package",
      type: "preset",
      files: ["plugin.json", "presets/"],
      contributions: {
        presets: [{ key: "plugin-preset", path: "presets/plugin-preset", parent: "base" }],
      },
    });
    writeJson(root, ".senti/plugins/plugin-package/presets/plugin-preset/preset.json", {
      parent: "base",
      label: "Plugin Preset",
      chapters: [],
    });

    assert.equal(resolveChain("plugin-preset", root).at(-1).key, "plugin-preset");
    const result = runConfigCheck(root);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.checks.find((check) => check.name === "presets").result, "pass");
  });
});
