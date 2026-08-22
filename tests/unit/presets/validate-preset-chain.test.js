/**
 * Unit tests for validatePresetChain().
 *
 * Validates that chapters listed in preset.json (or config override) have
 * corresponding .md templates somewhere in the preset chain or the project-local
 * templates directory, for every configured language.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { validatePresetChain } from "../../../src/lib/presets.js";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../support/builders/tmp-dir.js";

function writePluginPreset(root, { key = "myext", chapters = [{ chapter: "missing.md" }] } = {}) {
  writeJson(root, ".sennel/config.json", {
    lang: "ja",
    type: key,
    docs: { languages: ["ja"], defaultLanguage: "ja" },
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
    parent: "base",
    label: "My Extension",
    chapters,
  });
  writeFile(root, `.sennel/plugins/local-presets/presets/${key}/templates/.keep`, "");
}

describe("validatePresetChain", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("validate-preset-chain-");
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  // ---------------------------------------------------------------------
  // Happy path: built-in preset with both languages
  // ---------------------------------------------------------------------

  it("passes silently for a built-in preset with all chapters present in both languages", () => {
    assert.doesNotThrow(() => {
      validatePresetChain("base", tmp, { languages: ["ja", "en"] });
    });
  });

  // ---------------------------------------------------------------------
  // Missing chapter in project-local preset — throws with details
  // ---------------------------------------------------------------------

  it("throws Error when a chapter has no template in any layer", () => {
    writePluginPreset(tmp);

    assert.throws(
      () => validatePresetChain("myext", tmp, { languages: ["ja"] }),
      (err) => {
        assert.match(err.message, /missing\.md/);
        assert.match(err.message, /ja/);
        // Message should include at least one searched path.
        assert.match(err.message, /templates/);
        return true;
      },
    );
  });

  // ---------------------------------------------------------------------
  // Project-local templates directory satisfies the requirement
  // ---------------------------------------------------------------------

  it("accepts a template provided under .sennel/templates/<lang>/docs/<chapter>", () => {
    writePluginPreset(tmp, { chapters: [{ chapter: "custom.md" }] });
    writeFile(tmp, ".sennel/templates/ja/docs/custom.md", "# Custom (ja)\n");

    assert.doesNotThrow(() => {
      validatePresetChain("myext", tmp, { languages: ["ja"] });
    });
  });

  // ---------------------------------------------------------------------
  // config.chapters overrides preset.json chapters
  // ---------------------------------------------------------------------

  it("validates configChapters when provided (overriding preset.json chapters)", () => {
    // base preset has valid chapters, but config.chapters overrides with a
    // non-existent chapter — validator must detect the override and fail.
    assert.throws(
      () => validatePresetChain("base", tmp, {
        languages: ["ja"],
        configChapters: [{ chapter: "nonexistent_chapter.md" }],
      }),
      /nonexistent_chapter\.md/,
    );
  });

  // ---------------------------------------------------------------------
  // Multiple types: each type's chain validated
  // ---------------------------------------------------------------------

  it("validates multiple types (array input)", () => {
    assert.doesNotThrow(() => {
      validatePresetChain(["base"], tmp, { languages: ["ja", "en"] });
    });
  });

  // ---------------------------------------------------------------------
  // Missing chapter surfaces both chapter and language in error
  // ---------------------------------------------------------------------

  it("includes both chapter name and language in error when multiple languages fail", () => {
    writePluginPreset(tmp);

    assert.throws(
      () => validatePresetChain("myext", tmp, { languages: ["ja", "en"] }),
      (err) => {
        assert.match(err.message, /missing\.md/);
        assert.match(err.message, /ja/);
        assert.match(err.message, /en/);
        return true;
      },
    );
  });

  // ---------------------------------------------------------------------
  // Reverse direction (template without chapter) does NOT throw
  // ---------------------------------------------------------------------

  it("does not throw when a template exists without a matching chapter (warning only)", () => {
    writePluginPreset(tmp, { chapters: [{ chapter: "custom.md" }] });
    writeFile(tmp, ".sennel/plugins/local-presets/presets/myext/templates/ja/custom.md", "# Custom\n");
    // Extra template not listed in chapters — should be warned but not fail.
    writeFile(tmp, ".sennel/plugins/local-presets/presets/myext/templates/ja/extra.md", "# Extra\n");

    assert.doesNotThrow(() => {
      validatePresetChain("myext", tmp, { languages: ["ja"] });
    });
  });

  // ---------------------------------------------------------------------
  // Empty languages list: no-op (nothing to validate)
  // ---------------------------------------------------------------------

  it("does not throw when languages array is empty", () => {
    writePluginPreset(tmp);

    assert.doesNotThrow(() => {
      validatePresetChain("myext", tmp, { languages: [] });
    });
  });
});
