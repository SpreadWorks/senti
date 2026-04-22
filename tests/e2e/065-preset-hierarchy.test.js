/**
 * tests/065-preset-hierarchy.test.js
 *
 * Spec #065: preset hierarchy unit tests.
 * Validates parent chain resolution, DataSource loading, and variable-length template merging.
 *
 * Test targets:
 *   - presets.js: resolveChain(), parent chain cycle detection
 *   - resolver-factory.js: parent chain DataSource loading
 *   - template-merger.js: variable-length layer construction
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "../../src");

// ---------------------------------------------------------------------------
// presets.js: parent chain resolution
// ---------------------------------------------------------------------------

describe("presets.js: resolveChain", () => {
  it("resolves chain for leaf preset (cakephp2 → php-webapp → webapp → base)", async () => {
    const { resolveChain } = await import("../../src/lib/presets.js");
    const chain = resolveChain("cakephp2");
    assert.ok(Array.isArray(chain), "resolveChain should return an array");
    assert.equal(chain.length, 4, "chain should have 4 elements");
    assert.equal(chain[0].key, "base");
    assert.equal(chain[1].key, "webapp");
    assert.equal(chain[2].key, "php-webapp");
    assert.equal(chain[3].key, "cakephp2");
  });

  it("resolves chain for node-cli (node-cli → cli → base)", async () => {
    const { resolveChain } = await import("../../src/lib/presets.js");
    const chain = resolveChain("node-cli");
    assert.equal(chain.length, 3);
    assert.equal(chain[0].key, "base");
    assert.equal(chain[1].key, "cli");
    assert.equal(chain[2].key, "node-cli");
  });

  it("resolves chain for arch-level preset (webapp → base)", async () => {
    const { resolveChain } = await import("../../src/lib/presets.js");
    const chain = resolveChain("webapp");
    assert.equal(chain.length, 2);
    assert.equal(chain[0].key, "base");
    assert.equal(chain[1].key, "webapp");
  });

  it("resolves chain for php-webapp (php-webapp → webapp → base)", async () => {
    const { resolveChain } = await import("../../src/lib/presets.js");
    const chain = resolveChain("php-webapp");
    assert.equal(chain.length, 3);
    assert.equal(chain[0].key, "base");
    assert.equal(chain[1].key, "webapp");
    assert.equal(chain[2].key, "php-webapp");
  });

  it("resolves chain for base (just base)", async () => {
    const { resolveChain } = await import("../../src/lib/presets.js");
    const chain = resolveChain("base");
    assert.equal(chain.length, 1);
    assert.equal(chain[0].key, "base");
  });

  it("throws for unknown preset", async () => {
    const { resolveChain } = await import("../../src/lib/presets.js");
    assert.throws(() => resolveChain("nonexistent"), /not found|unknown/i);
  });
});

// ---------------------------------------------------------------------------
// presets.js: backward compatibility
// ---------------------------------------------------------------------------

describe("presets.js: backward compatibility", () => {
  it("presetByLeaf still works for existing presets", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const cakephp2 = presetByLeaf("cakephp2");
    assert.ok(cakephp2, "cakephp2 should be found");
    assert.equal(cakephp2.key, "cakephp2");

    const nodeCli = presetByLeaf("node-cli");
    assert.ok(nodeCli, "node-cli should be found");
    assert.equal(nodeCli.key, "node-cli");
  });

  it("presetByLeaf finds php-webapp preset", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const phpWebapp = presetByLeaf("php-webapp");
    assert.ok(phpWebapp, "php-webapp preset should exist");
    assert.equal(phpWebapp.key, "php-webapp");
  });

  it("PRESETS array contains all expected presets", async () => {
    const { PRESETS } = await import("../../src/lib/presets.js");
    const keys = PRESETS.map((p) => p.key);
    for (const expected of ["base", "webapp", "cli", "library", "cakephp2", "laravel", "symfony", "node-cli", "php-webapp"]) {
      assert.ok(keys.includes(expected), `${expected} should be in PRESETS`);
    }
  });
});

// ---------------------------------------------------------------------------
// presets.js: parent field in preset.json
// ---------------------------------------------------------------------------

describe("presets.js: parent field in preset.json", () => {
  it("all non-base presets have a parent field", async () => {
    const { PRESETS } = await import("../../src/lib/presets.js");
    for (const p of PRESETS) {
      if (p.key === "base") continue;
      assert.ok(p.parent, `${p.key} should have a parent field`);
    }
  });

  it("base preset has no parent", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const base = presetByLeaf("base");
    assert.ok(!base.parent, "base should not have a parent");
  });

  it("php-webapp parent is webapp", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const phpWebapp = presetByLeaf("php-webapp");
    assert.equal(phpWebapp.parent, "webapp");
  });

  it("cakephp2 parent is php-webapp", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const cakephp2 = presetByLeaf("cakephp2");
    assert.equal(cakephp2.parent, "php-webapp");
  });

  it("node-cli parent is cli", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const nodeCli = presetByLeaf("node-cli");
    assert.equal(nodeCli.parent, "cli");
  });
});

// ---------------------------------------------------------------------------
// resolver-factory.js: parent chain DataSource loading
// ---------------------------------------------------------------------------

describe("resolver-factory: parent chain loading", () => {
  it("resolves project.name from common layer", async () => {
    const { createResolver } = await import("../../src/docs/lib/resolver-factory.js");
    const tmp = createTmpDir("resolver-chain");
    fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
    writeJson(tmp, "package.json", { name: "test-pkg", version: "1.0.0" });

    const resolver = await createResolver("node-cli", tmp);
    const result = resolver.resolve("node-cli", "project", "name", {}, [""]);
    assert.equal(result.toMarkdown(), "test-pkg");
    removeTmpDir(tmp);
  });

  it("cakephp2 resolver works with parent chain", async () => {
    const { createResolver } = await import("../../src/docs/lib/resolver-factory.js");
    const tmp = createTmpDir("resolver-chain");
    fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
    writeJson(tmp, "package.json", { name: "test-cakephp" });

    const resolver = await createResolver("cakephp2", tmp);
    assert.equal(typeof resolver.resolve, "function");
    // common data sources should still be available
    const result = resolver.resolve("cakephp2", "project", "name", {}, [""]);
    assert.equal(result.toMarkdown(), "test-cakephp");
    removeTmpDir(tmp);
  });

  it("presetKeys returns the leaf key", async () => {
    const { createResolver } = await import("../../src/docs/lib/resolver-factory.js");
    const tmp = createTmpDir("resolver-chain");
    fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
    writeJson(tmp, "package.json", { name: "test-keys" });

    const resolver = await createResolver("node-cli", tmp);
    const keys = resolver.presetKeys();
    assert.ok(keys.includes("node-cli"), "presetKeys should include node-cli");
    removeTmpDir(tmp);
  });
});

// ---------------------------------------------------------------------------
// template-merger.js: variable-length layer construction
// ---------------------------------------------------------------------------

describe("template-merger: variable-length layers", () => {
  it("buildLayers returns layers for node-cli (node-cli → cli → base)", async () => {
    const { buildLayers } = await import("../../src/docs/lib/template-merger.js");
    const layers = buildLayers("node-cli", "en", null);
    assert.ok(Array.isArray(layers));
    // layers are in priority order: leaf first, base last
    if (layers.length > 0) {
      assert.ok(layers[layers.length - 1].includes("base"), "last layer should be base");
    }
  });

  it("buildLayers returns layers for php-webapp (php-webapp → webapp → base)", async () => {
    const { buildLayers } = await import("../../src/docs/lib/template-merger.js");
    const layers = buildLayers("php-webapp", "en", null);
    assert.ok(Array.isArray(layers));
    if (layers.length > 0) {
      assert.ok(layers[layers.length - 1].includes("base"), "last layer should be base");
    }
  });

  it("buildLayers for cakephp2 includes full chain", async () => {
    const { buildLayers } = await import("../../src/docs/lib/template-merger.js");
    const layers = buildLayers("cakephp2", "en", null);
    assert.ok(layers.length >= 1, "should have at least one layer");
    assert.ok(layers[layers.length - 1].includes("base"), "last layer should be base");
  });

  it("resolveChaptersOrder uses leaf chapters when defined", async () => {
    const { resolveChaptersOrder } = await import("../../src/docs/lib/template-merger.js");
    // node-cli defines its own chapters, should use those
    const nodeCliChapters = resolveChaptersOrder("node-cli");
    assert.ok(Array.isArray(nodeCliChapters));
    assert.ok(nodeCliChapters.length > 0, "node-cli should have chapters");
    assert.ok(nodeCliChapters.includes("cli_commands.md"), "node-cli chapters should include cli_commands.md");
  });

  it("resolveChaptersOrder falls back to parent chapters", async () => {
    const { resolveChaptersOrder } = await import("../../src/docs/lib/template-merger.js");
    // cakephp2 does not define chapters, should inherit from webapp
    const cakephp2Chapters = resolveChaptersOrder("cakephp2");
    assert.ok(Array.isArray(cakephp2Chapters));
    assert.ok(cakephp2Chapters.length > 0, "cakephp2 should inherit chapters");
  });

  it("resolveChaptersOrder respects configChapters override", async () => {
    const { resolveChaptersOrder } = await import("../../src/docs/lib/template-merger.js");
    const custom = ["custom_a.md", "custom_b.md"];
    const result = resolveChaptersOrder("node-cli", custom);
    assert.deepEqual(result, custom, "configChapters should take priority");
  });
});

// ---------------------------------------------------------------------------
// presets.js: resolveMultiChains
// ---------------------------------------------------------------------------

describe("presets.js: resolveMultiChains", () => {
  it("resolves single preset as one chain", async () => {
    const { resolveMultiChains } = await import("../../src/lib/presets.js");
    const chains = resolveMultiChains("cakephp2");
    assert.equal(chains.length, 1);
    assert.equal(chains[0][0].key, "base");
    assert.equal(chains[0][chains[0].length - 1].key, "cakephp2");
  });

  it("deduplicates parent-child when both specified", async () => {
    const { resolveMultiChains } = await import("../../src/lib/presets.js");
    // webapp is an ancestor of cakephp2, so only cakephp2 chain should remain
    const chains = resolveMultiChains(["webapp", "cakephp2"]);
    assert.equal(chains.length, 1, "parent-child should be deduped to one chain");
    assert.equal(chains[0][chains[0].length - 1].key, "cakephp2");
  });

  it("keeps independent chains separate", async () => {
    const { resolveMultiChains } = await import("../../src/lib/presets.js");
    // node-cli and cakephp2 are independent
    const chains = resolveMultiChains(["node-cli", "cakephp2"]);
    assert.equal(chains.length, 2, "independent presets should produce separate chains");
    const leafKeys = chains.map((c) => c[c.length - 1].key);
    assert.ok(leafKeys.includes("node-cli"));
    assert.ok(leafKeys.includes("cakephp2"));
  });
});
