import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import {
  resolveChaptersOrder,
  resolveTemplates,
  mergeResolved,
} from "../../../../src/docs/lib/template-merger.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../support/builders/tmp-dir.js";

function withPluginPresets(presets) {
  const tmpDir = createTmpDir("sennel-test-cross-chain-");
  writeJson(tmpDir, ".sennel/config.json", {
    lang: "en",
    type: presets.map((preset) => preset.key),
    docs: { languages: ["en"], defaultLanguage: "en" },
    scan: { include: ["src/**/*.js"], exclude: [] },
    plugin: { packages: [{ id: "test-presets" }] },
  });
  writeFile(
    tmpDir,
    ".sennel/plugins/test-presets/plugin.json",
    JSON.stringify({
      name: "test-presets",
      files: ["plugin.json", "presets/"],
      contributions: {
        presets: presets.map((preset) => ({
          key: preset.key,
          path: `presets/${preset.key}`,
        })),
      },
    }),
  );
  for (const preset of presets) {
    writeJson(tmpDir, `.sennel/plugins/test-presets/presets/${preset.key}/preset.json`, {
      parent: preset.parent ?? "base",
      chapters: preset.chapters,
    });
    for (const chapter of preset.chapters) {
      writeFile(
        tmpDir,
        `.sennel/plugins/test-presets/presets/${preset.key}/templates/en/${chapter}`,
        `# ${path.basename(chapter, ".md")}\n`,
      );
    }
  }
  return { tmpDir, cleanup: () => removeTmpDir(tmpDir) };
}

// ---------------------------------------------------------------------------
// resolveChaptersOrder with multi-preset arrays
// ---------------------------------------------------------------------------

describe("resolveChaptersOrder: multi-preset union merge", () => {
  it("merges chapters from two independent presets", () => {
    const { tmpDir, cleanup } = withPluginPresets([
      { key: "sample-pages", chapters: ["pages_routing.md"] },
      { key: "sample-api", chapters: ["endpoints.md"] },
    ]);
    try {
      const chapters = resolveChaptersOrder(["sample-pages", "sample-api"], null, tmpDir);
      assert.ok(Array.isArray(chapters));
      assert.ok(chapters.length > 0, "should produce chapters");
      // No duplicates
      const unique = new Set(chapters);
      assert.equal(unique.size, chapters.length, "should have no duplicates");
    } finally {
      cleanup();
    }
  });

  it("merges chapters from many presets", () => {
    const { tmpDir, cleanup } = withPluginPresets([
      { key: "sample-http", chapters: ["middleware.md"] },
      { key: "sample-worker", chapters: ["bindings.md"] },
      { key: "sample-db", chapters: ["database.md"] },
    ]);
    try {
      const chapters = resolveChaptersOrder(["sample-http", "sample-worker", "sample-db"], null, tmpDir);
      assert.ok(Array.isArray(chapters));
      const unique = new Set(chapters);
      assert.equal(unique.size, chapters.length, "should have no duplicates");
    } finally {
      cleanup();
    }
  });

  it("config chapters override multi-preset chapters", () => {
    const configChapters = ["custom_a.md", "custom_b.md"];
    const chapters = resolveChaptersOrder(["sample-pages", "sample-api"], configChapters);
    assert.deepEqual(chapters, configChapters);
  });

  it("single preset still works as string", () => {
    const { tmpDir, cleanup } = withPluginPresets([
      { key: "sample-api", chapters: ["endpoints.md"] },
    ]);
    try {
      const chapters = resolveChaptersOrder("sample-api", null, tmpDir);
      assert.ok(Array.isArray(chapters));
      assert.ok(chapters.length > 0);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// resolveTemplates with multi-preset arrays
// ---------------------------------------------------------------------------

describe("resolveTemplates: multi-preset", () => {
  it("resolves templates from multiple presets", () => {
    const { tmpDir, cleanup } = withPluginPresets([
      { key: "sample-pages", chapters: ["pages_routing.md"] },
      { key: "sample-api", chapters: ["endpoints.md"] },
    ]);
    try {
      const chapters = resolveChaptersOrder(["sample-pages", "sample-api"], null, tmpDir);
      const resolutions = resolveTemplates(["sample-pages", "sample-api"], "en", {
        chaptersOrder: chapters,
        projectRoot: tmpDir,
      });
      assert.ok(resolutions.length > 0);
      const fileNames = resolutions.map((r) => r.fileName);
      // Should include chapters from both presets
      assert.ok(fileNames.includes("pages_routing.md"), "should include sample-pages chapter");
      assert.ok(fileNames.includes("endpoints.md"), "should include sample-api chapter");
    } finally {
      cleanup();
    }
  });

  it("string type still works", () => {
    const { tmpDir, cleanup } = withPluginPresets([
      { key: "sample-api", chapters: ["endpoints.md"] },
    ]);
    try {
      const chapters = resolveChaptersOrder("sample-api", null, tmpDir);
      const resolutions = resolveTemplates("sample-api", "en", { chaptersOrder: chapters, projectRoot: tmpDir });
      assert.ok(resolutions.length > 0);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// mergeResolved additive mode
// ---------------------------------------------------------------------------

describe("mergeResolved: additive merge", () => {
  it("concatenates blocks from different chains", () => {
    const baseTemplate = [
      "# API",
      '<!-- {%block "endpoints"%} -->',
      "Base endpoint content",
      "<!-- {%/block%} -->",
    ].join("\n");

    const addTemplate = [
      "# API",
      '<!-- {%block "endpoints"%} -->',
      "Additional endpoint content",
      "<!-- {%/block%} -->",
    ].join("\n");

    const sources = [
      { path: "chain1/api.md", content: baseTemplate, extends: false },
      { path: "chain2/api.md", content: addTemplate, extends: false },
    ];

    const result = mergeResolved(sources, true);
    assert.ok(result.includes("Base endpoint content"), "should include base content");
    assert.ok(result.includes("Additional endpoint content"), "should include added content");
  });

  it("adds blocks from second chain that don't exist in first", () => {
    const baseTemplate = [
      "# Doc",
      '<!-- {%block "section-a"%} -->',
      "Section A",
      "<!-- {%/block%} -->",
    ].join("\n");

    const addTemplate = [
      "# Doc",
      '<!-- {%block "section-b"%} -->',
      "Section B",
      "<!-- {%/block%} -->",
    ].join("\n");

    const sources = [
      { path: "chain1/doc.md", content: baseTemplate, extends: false },
      { path: "chain2/doc.md", content: addTemplate, extends: false },
    ];

    const result = mergeResolved(sources, true);
    assert.ok(result.includes("Section A"), "should include base block");
    assert.ok(result.includes("Section B"), "should include added block");
  });

  it("handles non-additive mode as before", () => {
    const parent = [
      "# Title",
      '<!-- {%block "intro"%} -->',
      "Parent intro",
      "<!-- {%/block%} -->",
    ].join("\n");

    const child = [
      "<!-- {%extends%} -->",
      '<!-- {%block "intro"%} -->',
      "Child intro",
      "<!-- {%/block%} -->",
    ].join("\n");

    const sources = [
      { path: "child.md", content: child, extends: true },
      { path: "parent.md", content: parent, extends: false },
    ];

    const result = mergeResolved(sources, false);
    assert.ok(result.includes("Child intro"), "child should override");
    assert.ok(!result.includes("Parent intro"), "parent should be replaced");
  });

  it("falls back to non-additive for single source", () => {
    const sources = [
      { path: "only.md", content: "# Only Content", extends: false },
    ];
    const result = mergeResolved(sources, true);
    assert.equal(result, "# Only Content");
  });
});
