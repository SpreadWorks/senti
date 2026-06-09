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
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../helpers/tmp-dir.js";

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
    // Project-local preset with a chapter that has no matching template.
    writeJson(tmp, ".senti/presets/myext/preset.json", {
      label: "My Extension",
      chapters: [{ chapter: "missing.md" }],
    });

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

  it("accepts a template provided under .senti/templates/<lang>/docs/<chapter>", () => {
    writeJson(tmp, ".senti/presets/myext/preset.json", {
      label: "My Extension",
      chapters: [{ chapter: "custom.md" }],
    });
    writeFile(tmp, ".senti/templates/ja/docs/custom.md", "# Custom (ja)\n");

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
    writeJson(tmp, ".senti/presets/myext/preset.json", {
      label: "My Extension",
      chapters: [{ chapter: "missing.md" }],
    });

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
    writeJson(tmp, ".senti/presets/myext/preset.json", {
      label: "My Extension",
      chapters: [{ chapter: "custom.md" }],
    });
    writeFile(tmp, ".senti/presets/myext/templates/ja/custom.md", "# Custom\n");
    // Extra template not listed in chapters — should be warned but not fail.
    writeFile(tmp, ".senti/presets/myext/templates/ja/extra.md", "# Extra\n");

    assert.doesNotThrow(() => {
      validatePresetChain("myext", tmp, { languages: ["ja"] });
    });
  });

  // ---------------------------------------------------------------------
  // Empty languages list: no-op (nothing to validate)
  // ---------------------------------------------------------------------

  it("does not throw when languages array is empty", () => {
    writeJson(tmp, ".senti/presets/myext/preset.json", {
      label: "My Extension",
      chapters: [{ chapter: "missing.md" }],
    });

    assert.doesNotThrow(() => {
      validatePresetChain("myext", tmp, { languages: [] });
    });
  });
});
