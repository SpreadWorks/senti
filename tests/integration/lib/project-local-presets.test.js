/**
 * Unit tests for project-installed plugin preset resolution.
 *
 * Legacy `.sennel/presets/<name>` directories are migration input only. Runtime
 * preset resolution reads builtin base plus enabled plugin preset contributions.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { resolveChain } from "../../../src/lib/presets.js";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../support/builders/tmp-dir.js";

function writePluginPreset(root, { key, parent = "base", label, chapters = [] }) {
  writeJson(root, ".sennel/config.json", {
    lang: "en",
    type: key,
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: { packages: [{ id: "local-presets" }] },
  });
  writeJson(root, ".sennel/plugins/local-presets/plugin.json", {
    name: "local-presets",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key, path: `presets/${key}` }],
    },
  });
  writeJson(root, `.sennel/plugins/local-presets/presets/${key}/preset.json`, {
    parent,
    label,
    chapters,
  });
  writeFile(root, `.sennel/plugins/local-presets/presets/${key}/data/.keep`, "");
}

describe("project-installed plugin preset resolution: priority", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("uses enabled plugin preset dir when a plugin contributes the key", () => {
    tmp = createTmpDir();
    writePluginPreset(tmp, {
      key: "sample-preset",
      label: "Project plugin preset",
    });

    const chain = resolveChain("sample-preset", tmp);
    const leaf = chain[chain.length - 1];
    assert.ok(
      leaf.dir.includes(path.join(tmp, ".sennel", "plugins", "local-presets", "presets", "sample-preset")),
      `Expected dir to be from installed plugin, got: ${leaf.dir}`,
    );
    assert.equal(leaf.label, "Project plugin preset");
  });

  it("plugin preset metadata takes precedence for the same key", () => {
    tmp = createTmpDir();
    writePluginPreset(tmp, {
      key: "sample-preset",
      parent: "base",
      label: "Custom plugin preset",
      chapters: ["overview.md"],
    });

    const chain = resolveChain("sample-preset", tmp);
    const leaf = chain[chain.length - 1];
    assert.equal(leaf.parent, "base");
    assert.deepEqual(leaf.chapters, ["overview.md"]);
  });
});

describe("project-installed plugin preset resolution: missing plugin", () => {
  it("throws when a non-base preset is not contributed by an enabled plugin", () => {
    const tmp = createTmpDir();
    try {
      assert.throws(
        () => resolveChain("sample-preset", tmp),
        /Preset not found: sample-preset/,
      );
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("still resolves builtin base without project plugin state", () => {
    const tmp = createTmpDir();
    try {
      const chain = resolveChain("base", tmp);
      assert.deepEqual(chain.map((preset) => preset.key), ["base"]);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
