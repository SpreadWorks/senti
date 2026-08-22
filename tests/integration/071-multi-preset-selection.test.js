/**
 * Multi-preset config and directive parsing.
 *
 * Runtime resolution for non-base presets is covered by plugin-backed unit and
 * spec-local tests. This file keeps the config/parser contracts that remain in
 * the main package after preset migration.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("validateConfig: type as string | string[]", () => {
  const baseConfig = {
    lang: "ja",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  };

  it("accepts type as string", async () => {
    const { validate } = await import("../../src/lib/config.js");
    const result = validate({ ...baseConfig, type: "sample-preset" });
    assert.equal(result.type, "sample-preset");
  });

  it("accepts type as string array", async () => {
    const { validate } = await import("../../src/lib/config.js");
    const result = validate({ ...baseConfig, type: ["sample-node-command", "sample-db"] });
    assert.deepEqual(result.type, ["sample-node-command", "sample-db"]);
  });

  it("rejects empty array and non-string elements", async () => {
    const { validate } = await import("../../src/lib/config.js");
    assert.throws(() => validate({ ...baseConfig, type: [] }), /type/);
    assert.throws(() => validate({ ...baseConfig, type: ["sample-preset", 123] }), /type/);
  });
});

describe("directive-parser: preset.source.method syntax", () => {
  it("parses 3-part data directives", async () => {
    const { parseDirectives } = await import("../../src/docs/lib/directive-parser.js");
    const result = parseDirectives([
      '<!-- {{data("sample-preset.controllers.list", {labels: "Name|File"})}} -->',
      "old content",
      "<!-- {{/data}} -->",
    ].join("\n"));
    assert.equal(result.length, 1);
    assert.equal(result[0].preset, "sample-preset");
    assert.equal(result[0].source, "controllers");
    assert.equal(result[0].method, "list");
    assert.deepEqual(result[0].labels, ["Name", "File"]);
  });

  it("keeps text directives preset-free", async () => {
    const { parseDirectives } = await import("../../src/docs/lib/directive-parser.js");
    const result = parseDirectives('<!-- {{text({prompt: "Describe"})}} -->\n<!-- {{/text}} -->');
    assert.equal(result.length, 1);
    assert.equal(result[0].type, "text");
    assert.equal(result[0].preset, undefined);
  });
});

describe("presets.js: removed bundled non-base runtime", () => {
  it("does not export old lang-axis helpers or bundled non-base aliases", async () => {
    const presets = await import("../../src/lib/presets.js");
    assert.equal(presets.resolveLangPreset, undefined);
    assert.equal(presets.presetByLeaf("node"), undefined);
    assert.equal(presets.presetByLeaf("php"), undefined);
  });
});
