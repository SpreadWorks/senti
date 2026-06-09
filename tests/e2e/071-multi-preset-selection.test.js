/**
 * tests/e2e/071-multi-preset-selection.test.js
 *
 * Spec #071: 複数 preset 選択の仕組み。
 *
 * テスト対象:
 *   - types.js: type が string | string[] を受け付ける
 *   - presets.js: php-webapp チェーン解決、lang/axis 廃止
 *   - presets.js: 複数チェーン解決、親子重複除去
 *   - directive-parser.js: preset.source.method 3部構成パース
 *   - template-merger.js: parent チェーンのみでレイヤー構築
 *   - E2E: type: ["node-cli", "postgres"] の組み合わせ
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// types.js: type が string | string[] を受け付ける
// ---------------------------------------------------------------------------

describe("validateConfig: type as string | string[]", () => {
  const baseConfig = {
    lang: "ja",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  };

  it("accepts type as string", async () => {
    const { validate } = await import("../../src/lib/config.js");
    const cfg = { ...baseConfig, type: "symfony" };
    const result = validate(cfg);
    assert.equal(result.type, "symfony");
  });

  it("accepts type as string array", async () => {
    const { validate } = await import("../../src/lib/config.js");
    const cfg = { ...baseConfig, type: ["node-cli", "postgres"] };
    const result = validate(cfg);
    assert.deepEqual(result.type, ["node-cli", "postgres"]);
  });

  it("rejects empty array", async () => {
    const { validate } = await import("../../src/lib/config.js");
    const cfg = { ...baseConfig, type: [] };
    assert.throws(() => validate(cfg), /type/);
  });

  it("rejects non-string elements in array", async () => {
    const { validate } = await import("../../src/lib/config.js");
    const cfg = { ...baseConfig, type: ["symfony", 123] };
    assert.throws(() => validate(cfg), /type/);
  });
});

// ---------------------------------------------------------------------------
// types.js: resolveType / TYPE_ALIASES が廃止されている
// ---------------------------------------------------------------------------

describe("types.js: resolveType and TYPE_ALIASES abolished", () => {
  it("resolveType is no longer exported", async () => {
    const mod = await import("../../src/lib/types.js");
    assert.equal(mod.resolveType, undefined, "resolveType should not be exported");
  });

  it("TYPE_ALIASES is no longer exported", async () => {
    const mod = await import("../../src/lib/types.js");
    assert.equal(mod.TYPE_ALIASES, undefined, "TYPE_ALIASES should not be exported");
  });
});

// ---------------------------------------------------------------------------
// presets.js: php-webapp チェーン解決
// ---------------------------------------------------------------------------

describe("presets.js: php-webapp chain", () => {
  it("php-webapp exists with parent webapp", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const phpWebapp = presetByLeaf("php-webapp");
    assert.ok(phpWebapp, "php-webapp preset should exist");
    assert.equal(phpWebapp.parent, "webapp");
  });

  it("cakephp2 parent is php-webapp", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const cakephp2 = presetByLeaf("cakephp2");
    assert.equal(cakephp2.parent, "php-webapp");
  });

  it("laravel parent is php-webapp", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const laravel = presetByLeaf("laravel");
    assert.equal(laravel.parent, "php-webapp");
  });

  it("symfony parent is php-webapp", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const symfony = presetByLeaf("symfony");
    assert.equal(symfony.parent, "php-webapp");
  });

  it("resolveChain for cakephp2 includes php-webapp", async () => {
    const { resolveChain } = await import("../../src/lib/presets.js");
    const chain = resolveChain("cakephp2");
    const keys = chain.map((p) => p.key);
    assert.deepEqual(keys, ["base", "webapp", "php-webapp", "cakephp2"]);
  });
});

// ---------------------------------------------------------------------------
// presets.js: lang / axis フィールドが廃止されている
// ---------------------------------------------------------------------------

describe("presets.js: lang and axis fields abolished", () => {
  it("no preset has lang field", async () => {
    const { PRESETS } = await import("../../src/lib/presets.js");
    for (const p of PRESETS) {
      assert.equal(p.lang, undefined, `${p.key} should not have lang field`);
    }
  });

  it("no preset has axis field", async () => {
    const { PRESETS } = await import("../../src/lib/presets.js");
    for (const p of PRESETS) {
      assert.equal(p.axis, undefined, `${p.key} should not have axis field`);
    }
  });

  it("resolveLangPreset is no longer exported", async () => {
    const mod = await import("../../src/lib/presets.js");
    assert.equal(mod.resolveLangPreset, undefined, "resolveLangPreset should not be exported");
  });

  it("node preset no longer exists", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const node = presetByLeaf("node");
    assert.equal(node, undefined, "node preset should not exist");
  });

  it("php preset no longer exists (renamed to php-webapp)", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const php = presetByLeaf("php");
    assert.equal(php, undefined, "php preset should not exist (renamed to php-webapp)");
  });
});

// ---------------------------------------------------------------------------
// presets.js: postgres preset
// ---------------------------------------------------------------------------

describe("presets.js: postgres preset", () => {
  it("postgres preset exists with parent base", async () => {
    const { presetByLeaf } = await import("../../src/lib/presets.js");
    const postgres = presetByLeaf("postgres");
    assert.ok(postgres, "postgres preset should exist");
    assert.equal(postgres.parent, "database");
  });

  it("resolveChain for postgres is [base, postgres]", async () => {
    const { resolveChain } = await import("../../src/lib/presets.js");
    const chain = resolveChain("postgres");
    const keys = chain.map((p) => p.key);
    assert.deepEqual(keys, ["base", "database", "postgres"]);
  });
});

// ---------------------------------------------------------------------------
// presets.js: 複数チェーン解決
// ---------------------------------------------------------------------------

describe("presets.js: multi-chain resolution", () => {
  it("resolveMultiChains returns independent chains for each type", async () => {
    const { resolveMultiChains } = await import("../../src/lib/presets.js");
    const chains = resolveMultiChains(["node-cli", "postgres"]);
    assert.equal(chains.length, 2);
    // chain 1: node-cli
    const keys1 = chains[0].map((p) => p.key);
    assert.ok(keys1.includes("node-cli"));
    assert.ok(keys1.includes("base"));
    // chain 2: postgres
    const keys2 = chains[1].map((p) => p.key);
    assert.deepEqual(keys2, ["base", "database", "postgres"]);
  });

  it("deduplicates parent-child: ['webapp', 'symfony'] resolves same as ['symfony']", async () => {
    const { resolveMultiChains } = await import("../../src/lib/presets.js");
    const chains1 = resolveMultiChains(["webapp", "symfony"]);
    const chains2 = resolveMultiChains(["symfony"]);
    // webapp is ancestor of symfony, so it should be deduped
    assert.equal(chains1.length, 1, "parent-child should be deduped to single chain");
    const keys1 = chains1[0].map((p) => p.key);
    const keys2 = chains2[0].map((p) => p.key);
    assert.deepEqual(keys1, keys2);
  });

  it("handles single string type (backward compat)", async () => {
    const { resolveMultiChains } = await import("../../src/lib/presets.js");
    const chains = resolveMultiChains("symfony");
    assert.equal(chains.length, 1);
    const keys = chains[0].map((p) => p.key);
    assert.ok(keys.includes("symfony"));
  });
});

// ---------------------------------------------------------------------------
// directive-parser.js: preset.source.method 3部構成
// ---------------------------------------------------------------------------

describe("directive-parser: preset.source.method syntax", () => {
  it("parses 3-part data directive", async () => {
    const { parseDirectives } = await import("../../src/docs/lib/directive-parser.js");
    const text = [
      '<!-- {{data("symfony.controllers.list", {labels: "Name|File"})}} -->',
      "old content",
      "<!-- {{/data}} -->",
    ].join("\n");
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    const d = result[0];
    assert.equal(d.type, "data");
    assert.equal(d.preset, "symfony");
    assert.equal(d.source, "controllers");
    assert.equal(d.method, "list");
    assert.deepEqual(d.labels, ["Name", "File"]);
  });

  it("parses 3-part inline data directive", async () => {
    const { parseDirectives } = await import("../../src/docs/lib/directive-parser.js");
    const text =
      '# <!-- {{data("base.project.name")}} -->senti<!-- {{/data}} -->';
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    const d = result[0];
    assert.equal(d.preset, "base");
    assert.equal(d.source, "project");
    assert.equal(d.method, "name");
    assert.equal(d.inline, true);
  });

  it("parses 3-part directive with dotted source (e.g. preset.config.constants)", async () => {
    const { parseDirectives } = await import("../../src/docs/lib/directive-parser.js");
    const text = [
      '<!-- {{data("cakephp2.config.constants", {labels: "Name|Value"})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    const d = result[0];
    assert.equal(d.preset, "cakephp2");
    assert.equal(d.source, "config");
    assert.equal(d.method, "constants");
  });

  it("{{text}} directives are unchanged (no preset field)", async () => {
    const { parseDirectives } = await import("../../src/docs/lib/directive-parser.js");
    const text = [
      '<!-- {{text({prompt: "Describe the architecture"})}} -->',
      "<!-- {{/text}} -->",
    ].join("\n");
    const result = parseDirectives(text);
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "text");
    assert.equal(result[0].preset, undefined);
  });
});

// ---------------------------------------------------------------------------
// template-merger.js: parent チェーンのみでレイヤー構築
// ---------------------------------------------------------------------------

describe("template-merger: parent-chain-only layers", () => {
  it("buildLayers for cakephp2 uses parent chain (no separate lang layer)", async () => {
    const { buildLayers } = await import("../../src/docs/lib/template-merger.js");
    const layers = buildLayers("cakephp2", "en", null);
    assert.ok(Array.isArray(layers));
    // php-webapp has no templates dir, so it's not in layers — that's correct
    // But the chain should include webapp and base layers
    const hasWebapp = layers.some((l) => l.includes("webapp"));
    assert.ok(hasWebapp, "layers should include webapp");
    const hasBase = layers.some((l) => l.includes("base"));
    assert.ok(hasBase, "layers should include base");
  });

  it("buildLayers does not use lang-axis logic", async () => {
    const { buildLayers } = await import("../../src/docs/lib/template-merger.js");
    // node-cli layers should not have a separate "node" lang layer
    const layers = buildLayers("node-cli", "en", null);
    const hasNode = layers.some((l) => l.includes("/node/"));
    assert.ok(!hasNode, "layers should not include separate node lang layer");
  });
});

// ---------------------------------------------------------------------------
// E2E: type: ["node-cli", "postgres"] の組み合わせ
// ---------------------------------------------------------------------------

describe("E2E: multi-preset combination", () => {
  it("resolver handles multiple type chains", async () => {
    const { createResolver } = await import("../../src/docs/lib/resolver-factory.js");
    const tmp = createTmpDir("multi-preset");
    fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
    writeJson(tmp, "package.json", {
      name: "test-multi",
      version: "1.0.0",
    });

    // createResolver should accept array type
    const resolver = await createResolver(["node-cli", "postgres"], tmp);
    assert.equal(typeof resolver.resolve, "function");

    // Each preset's DataSource should be accessible via preset key
    const keys = resolver.presetKeys();
    assert.ok(keys.includes("node-cli"), "resolver should have node-cli preset");
    assert.ok(keys.includes("postgres"), "resolver should have postgres preset");

    // common DataSource (project) should work via each preset
    const name = resolver.resolve("node-cli", "project", "name", {}, [""]);
    assert.equal(name.toMarkdown(), "test-multi");

    removeTmpDir(tmp);
  });

  it("single type string still works with createResolver", async () => {
    const { createResolver } = await import("../../src/docs/lib/resolver-factory.js");
    const tmp = createTmpDir("single-preset");
    fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
    writeJson(tmp, "package.json", { name: "test-single" });

    const resolver = await createResolver("symfony", tmp);
    assert.equal(typeof resolver.resolve, "function");

    removeTmpDir(tmp);
  });
});

// ---------------------------------------------------------------------------
// 全 preset テンプレートが新ディレクティブ構文を使用している
// ---------------------------------------------------------------------------

describe("all templates use preset.source.method syntax", () => {
  it("no template uses old 2-part data directive syntax", async () => {
    const presetsDir = path.resolve(__dirname, "../../src/presets");
    const oldPattern = /<!--\s*\{\{data:\s*(\w+)\.(\w+)\(/;
    const newPattern = /<!--\s*\{\{data:\s*(\w+)\.(\w+)\.(\w+)\(/;

    function scanDir(dir) {
      if (!fs.existsSync(dir)) return [];
      const violations = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          violations.push(...scanDir(fullPath));
        } else if (entry.name.endsWith(".md")) {
          const content = fs.readFileSync(fullPath, "utf8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (oldPattern.test(lines[i]) && !newPattern.test(lines[i])) {
              violations.push(`${path.relative(presetsDir, fullPath)}:${i + 1}`);
            }
          }
        }
      }
      return violations;
    }

    const violations = scanDir(path.join(presetsDir));
    assert.equal(
      violations.length, 0,
      `Found old 2-part directive syntax in:\n  ${violations.join("\n  ")}`,
    );
  });
});
