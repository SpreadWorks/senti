/**
 * Unit tests for project-local preset resolution (.senti/presets/).
 *
 * Tests verify:
 * 1. .senti/presets/<name>/ is preferred over src/presets/<name>/
 * 2. preset.json in project preset takes precedence
 * 3. When preset.json is omitted and built-in exists, built-in settings are inherited
 * 4. When preset.json is omitted and no built-in exists, bare preset is returned
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { resolveChain } from "../../../src/lib/presets.js";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../helpers/tmp-dir.js";

describe("project-local preset resolution: priority", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("uses project preset dir when .senti/presets/<name>/preset.json exists", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/presets/symfony/preset.json", {
      parent: "webapp",
      label: "Symfony (project override)",
      chapters: [],
    });

    const chain = resolveChain("symfony", tmp);
    const leaf = chain[chain.length - 1];
    assert.ok(
      leaf.dir.includes(path.join(tmp, ".senti", "presets", "symfony")),
      `Expected dir to be from .senti/presets/, got: ${leaf.dir}`,
    );
    assert.equal(leaf.label, "Symfony (project override)");
  });

  it("project preset takes precedence over built-in for the same name", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/presets/symfony/preset.json", {
      parent: "base",
      label: "Custom Symfony",
      chapters: ["overview.md"],
    });

    const chain = resolveChain("symfony", tmp);
    const leaf = chain[chain.length - 1];
    // parent is "base" (from project preset), not "php-webapp" (from built-in)
    assert.equal(leaf.parent, "base");
  });
});

describe("project-local preset resolution: preset.json omitted", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("inherits built-in settings when preset.json is omitted and built-in exists", () => {
    tmp = createTmpDir();
    // Only data/ directory, no preset.json
    writeFile(tmp, ".senti/presets/symfony/data/.keep", "");

    const chain = resolveChain("symfony", tmp);
    const leaf = chain[chain.length - 1];
    // Should inherit built-in symfony's parent
    assert.equal(leaf.parent, "php-webapp", "Should inherit built-in parent");
    // Dir should be from .senti/presets/
    assert.ok(
      leaf.dir.includes(path.join(tmp, ".senti", "presets", "symfony")),
      `Expected dir to be from .senti/presets/, got: ${leaf.dir}`,
    );
  });

  it("returns bare preset when preset.json is omitted and no built-in match", () => {
    tmp = createTmpDir();
    writeFile(tmp, ".senti/presets/eccube/data/.keep", "");

    const chain = resolveChain("eccube", tmp);
    assert.ok(chain.length >= 1);
    const leaf = chain[chain.length - 1];
    assert.equal(leaf.key, "eccube");
    assert.equal(leaf.parent, null, "Bare preset should have no parent");
  });
});

describe("project-local preset resolution: no project preset", () => {
  it("falls back to built-in when .senti/presets/ does not exist", () => {
    // Use a tmp dir with no .senti/presets/
    const tmp2 = createTmpDir();
    try {
      const chain = resolveChain("symfony", tmp2);
      const leaf = chain[chain.length - 1];
      // Should resolve to built-in symfony
      assert.equal(leaf.parent, "php-webapp");
      assert.ok(leaf.dir.includes("src"), `Expected built-in dir, got: ${leaf.dir}`);
    } finally {
      removeTmpDir(tmp2);
    }
  });

  it("built-in chain resolution is unchanged when root has no project presets", () => {
    const tmp3 = createTmpDir();
    try {
      const chain = resolveChain("hono", tmp3);
      const keys = chain.map((p) => p.key);
      assert.deepEqual(keys, ["base", "webapp", "js-webapp", "hono"]);
    } finally {
      removeTmpDir(tmp3);
    }
  });
});
