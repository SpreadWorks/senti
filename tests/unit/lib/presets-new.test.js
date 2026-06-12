import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveChain,
  resolveMultiChains,
  presetByLeaf,
} from "../../../src/lib/presets.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";

// ---------------------------------------------------------------------------
// New preset discovery
// ---------------------------------------------------------------------------

const NEW_PRESETS = [
  { key: "sample-service", parent: "base" },
  { key: "sample-endpoint", parent: "sample-service" },
  { key: "sample-schema", parent: "sample-service" },
  { key: "js-sample-preset", parent: "sample-preset" },
  { key: "sample-runtime", parent: "js-sample-preset" },
  { key: "second-preset", parent: "js-sample-preset" },
  { key: "sample-bucket", parent: "base" },
  { key: "sample-object", parent: "sample-bucket" },
  { key: "sample-platform", parent: "base" },
  { key: "sample-worker", parent: "sample-platform" },
  { key: "sample-db", parent: "sample-store" },
];

const FIXTURE_PRESETS = [
  { key: "sample-preset", parent: "base" },
  { key: "sample-store", parent: "base" },
  ...NEW_PRESETS,
];

function withPluginPresets(fn) {
  const tmp = createTmpDir("senti-test-plugin-presets-");
  try {
    writeJson(tmp, ".senti/config.json", {
      lang: "en",
      type: FIXTURE_PRESETS.map((preset) => preset.key),
      docs: { languages: ["en"], defaultLanguage: "en" },
      plugin: { packages: [{ id: "test-presets" }] },
    });
    writeJson(tmp, ".senti/plugins/test-presets/plugin.json", {
      name: "test-presets",
      files: ["plugin.json", "presets/"],
      contributions: {
        presets: FIXTURE_PRESETS.map((preset) => ({
          key: preset.key,
          path: `presets/${preset.key}`,
        })),
      },
    });
    for (const preset of FIXTURE_PRESETS) {
      writeJson(tmp, `.senti/plugins/test-presets/presets/${preset.key}/preset.json`, {
        parent: preset.parent,
        chapters: [],
      });
    }
    return fn(tmp);
  } finally {
    removeTmpDir(tmp);
  }
}

describe("new presets: discovery", () => {
  for (const { key } of NEW_PRESETS) {
    it(`preset "${key}" is discovered`, () => {
      withPluginPresets((tmp) => {
        const found = presetByLeaf(key, tmp);
        assert.ok(found, `preset "${key}" should be in plugin registry`);
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Parent chain resolution
// ---------------------------------------------------------------------------

describe("new presets: parent chain", () => {
  for (const { key, parent } of NEW_PRESETS) {
    it(`"${key}" has parent "${parent}"`, () => {
      withPluginPresets((tmp) => {
        const preset = presetByLeaf(key, tmp);
        assert.equal(preset.parent, parent);
      });
    });
  }

  it("sample-endpoint chain is base → sample-service → sample-endpoint", () => {
    withPluginPresets((tmp) => {
      const chain = resolveChain("sample-endpoint", tmp);
      const keys = chain.map((p) => p.key);
      assert.deepEqual(keys, ["base", "sample-service", "sample-endpoint"]);
    });
  });

  it("sample-runtime chain is base → sample-preset → js-sample-preset → sample-runtime", () => {
    withPluginPresets((tmp) => {
      const chain = resolveChain("sample-runtime", tmp);
      const keys = chain.map((p) => p.key);
      assert.deepEqual(keys, ["base", "sample-preset", "js-sample-preset", "sample-runtime"]);
    });
  });

  it("second-preset chain is base → sample-preset → js-sample-preset → second-preset", () => {
    withPluginPresets((tmp) => {
      const chain = resolveChain("second-preset", tmp);
      const keys = chain.map((p) => p.key);
      assert.deepEqual(keys, ["base", "sample-preset", "js-sample-preset", "second-preset"]);
    });
  });

  it("sample-object chain is base → sample-bucket → sample-object", () => {
    withPluginPresets((tmp) => {
      const chain = resolveChain("sample-object", tmp);
      const keys = chain.map((p) => p.key);
      assert.deepEqual(keys, ["base", "sample-bucket", "sample-object"]);
    });
  });

  it("sample-worker chain is base → sample-platform → sample-worker", () => {
    withPluginPresets((tmp) => {
      const chain = resolveChain("sample-worker", tmp);
      const keys = chain.map((p) => p.key);
      assert.deepEqual(keys, ["base", "sample-platform", "sample-worker"]);
    });
  });

  it("sample-db chain is base → sample-store → sample-db", () => {
    withPluginPresets((tmp) => {
      const chain = resolveChain("sample-db", tmp);
      const keys = chain.map((p) => p.key);
      assert.deepEqual(keys, ["base", "sample-store", "sample-db"]);
    });
  });
});

// ---------------------------------------------------------------------------
// Multi-chain resolution
// ---------------------------------------------------------------------------

describe("new presets: resolveMultiChains", () => {
  it("resolves independent chains for [second-preset, sample-endpoint]", () => {
    withPluginPresets((tmp) => {
      const chains = resolveMultiChains(["second-preset", "sample-endpoint"], tmp);
      assert.equal(chains.length, 2);
      const leafKeys = chains.map((c) => c[c.length - 1].key);
      assert.ok(leafKeys.includes("second-preset"));
      assert.ok(leafKeys.includes("sample-endpoint"));
    });
  });

  it("resolves independent chains for [sample-runtime, sample-worker, sample-db, sample-db]", () => {
    withPluginPresets((tmp) => {
      const chains = resolveMultiChains(["sample-runtime", "sample-worker", "sample-db", "sample-db"], tmp);
      const leafKeys = chains.map((c) => c[c.length - 1].key);
      assert.ok(leafKeys.includes("sample-runtime"));
      assert.ok(leafKeys.includes("sample-worker"));
    });
  });

  it("deduplicates when parent and child are both listed", () => {
    withPluginPresets((tmp) => {
      const chains = resolveMultiChains(["sample-service", "sample-endpoint"], tmp);
      // sample-endpoint includes sample-service in its chain, so the parent-only chain should be removed
      assert.equal(chains.length, 1);
      assert.equal(chains[0][chains[0].length - 1].key, "sample-endpoint");
    });
  });
});
