import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseBlocks } from "../../../../src/docs/lib/directive-parser.js";
import { mergeResolved } from "../../../../src/docs/lib/template-merger.js";

// ---------------------------------------------------------------------------
// parseBlocks — {%extends "name"%} syntax
// ---------------------------------------------------------------------------

describe('parseBlocks {%extends "name"%}', () => {
  it('parses {%extends "layout"%} with target name', () => {
    const text = [
      '<!-- {%extends "layout"%} -->',
      '<!-- {%block "content"%} -->',
      "chapter body",
      "<!-- {%/block%} -->",
    ].join("\n");
    const result = parseBlocks(text);
    assert.equal(result.extends, true);
    assert.equal(result.extendsTarget, "layout");
    assert.equal(result.blocks.size, 1);
    assert.deepEqual(result.blocks.get("content").content, ["chapter body"]);
  });

  it("parses plain {%extends%} without target", () => {
    const text = [
      "<!-- {%extends%} -->",
      '<!-- {%block "main"%} -->',
      "content",
      "<!-- {%/block%} -->",
    ].join("\n");
    const result = parseBlocks(text);
    assert.equal(result.extends, true);
    assert.equal(result.extendsTarget, null);
  });

  it('{%extends%} with hyphenated name', () => {
    const text = '<!-- {%extends "my-layout"%} -->\n<!-- {%block "content"%} -->\nx\n<!-- {%/block%} -->';
    const result = parseBlocks(text);
    assert.equal(result.extends, true);
    assert.equal(result.extendsTarget, "my-layout");
  });
});

// ---------------------------------------------------------------------------
// mergeResolved — layout applied to chapter content
// ---------------------------------------------------------------------------

describe("mergeResolved with layout", () => {
  it('merges chapter content into layout {%block "content"%}', () => {
    const layout = {
      path: "base/layout.md",
      content: [
        "HEADER",
        '<!-- {%block "content"%} -->',
        "default content",
        "<!-- {%/block%} -->",
        "FOOTER",
      ].join("\n"),
      extends: false,
    };
    const chapter = {
      path: "base/overview.md",
      content: [
        '<!-- {%extends "layout"%} -->',
        '<!-- {%block "content"%} -->',
        "# Overview",
        "Real chapter content",
        "<!-- {%/block%} -->",
      ].join("\n"),
      extends: true,
    };
    // mergeResolved processes sources in priority order (most specific first)
    // then merges base-to-child: layout is base, chapter overrides content block
    const result = mergeResolved([chapter, layout]);
    assert.ok(result.includes("HEADER"), "should include layout header");
    assert.ok(result.includes("FOOTER"), "should include layout footer");
    assert.ok(result.includes("# Overview"), "should include chapter content");
    assert.ok(result.includes("Real chapter content"), "should include chapter body");
    assert.ok(!result.includes("default content"), "should not include default content");
  });
});

// ---------------------------------------------------------------------------
// docs.nav — link generation (tested via DocsSource directly)
// ---------------------------------------------------------------------------

describe("docs.nav link generation", () => {
  // These tests will call DocsSource.nav() directly after implementation.
  // For now, define the expected behavior as failing tests.

  it("returns null for single chapter", async () => {
    const { container, initContainer } = await import("../../../../src/lib/container.js"); initContainer(); const DocsSource = (await import("../../../../src/docs/data/docs.js")).default(container);
    const ds = new DocsSource();
    // Minimal init with a temp dir containing one chapter
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nav-test-"));
    const docsDir = path.join(tmpDir, "docs");
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, "overview.md"), "# Overview\n");

    ds.init({
      desc: () => "—",
      loadOverrides: () => ({}),
      root: tmpDir,
      docsDir,
      type: "base",
      configChapters: ["overview.md"],
    });

    const result = ds.nav({}, ["docs/overview.md"]);
    assert.equal(result, null, "single chapter should return null");

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns next link only for first chapter", async () => {
    const { container, initContainer } = await import("../../../../src/lib/container.js"); initContainer(); const DocsSource = (await import("../../../../src/docs/data/docs.js")).default(container);
    const ds = new DocsSource();
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nav-test-"));
    const docsDir = path.join(tmpDir, "docs");
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, "overview.md"), "# Overview\n");
    fs.writeFileSync(path.join(docsDir, "design.md"), "# Design\n");
    fs.writeFileSync(path.join(docsDir, "dev.md"), "# Development\n");

    ds.init({
      desc: () => "—",
      loadOverrides: () => ({}),
      root: tmpDir,
      docsDir,
      type: "base",
      configChapters: ["overview.md", "design.md", "dev.md"],
    });

    const result = ds.nav({}, ["docs/overview.md"]);
    assert.ok(result !== null, "should return nav for first chapter");
    assert.ok(!result.includes("←"), "first chapter should not have prev link");
    assert.ok(result.includes("→"), "first chapter should have next link");
    assert.ok(result.includes("design.md"), "should link to second chapter");

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns prev link only for last chapter", async () => {
    const { container, initContainer } = await import("../../../../src/lib/container.js"); initContainer(); const DocsSource = (await import("../../../../src/docs/data/docs.js")).default(container);
    const ds = new DocsSource();
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nav-test-"));
    const docsDir = path.join(tmpDir, "docs");
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, "overview.md"), "# Overview\n");
    fs.writeFileSync(path.join(docsDir, "design.md"), "# Design\n");
    fs.writeFileSync(path.join(docsDir, "dev.md"), "# Development\n");

    ds.init({
      desc: () => "—",
      loadOverrides: () => ({}),
      root: tmpDir,
      docsDir,
      type: "base",
      configChapters: ["overview.md", "design.md", "dev.md"],
    });

    const result = ds.nav({}, ["docs/dev.md"]);
    assert.ok(result !== null, "should return nav for last chapter");
    assert.ok(result.includes("←"), "last chapter should have prev link");
    assert.ok(!result.includes("→"), "last chapter should not have next link");
    assert.ok(result.includes("design.md"), "should link to second chapter");

    fs.rmSync(tmpDir, { recursive: true });
  });

  it("returns both links for middle chapter", async () => {
    const { container, initContainer } = await import("../../../../src/lib/container.js"); initContainer(); const DocsSource = (await import("../../../../src/docs/data/docs.js")).default(container);
    const ds = new DocsSource();
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nav-test-"));
    const docsDir = path.join(tmpDir, "docs");
    fs.mkdirSync(docsDir, { recursive: true });
    fs.writeFileSync(path.join(docsDir, "overview.md"), "# Overview\n");
    fs.writeFileSync(path.join(docsDir, "design.md"), "# Design\n");
    fs.writeFileSync(path.join(docsDir, "dev.md"), "# Development\n");

    ds.init({
      desc: () => "—",
      loadOverrides: () => ({}),
      root: tmpDir,
      docsDir,
      type: "base",
      configChapters: ["overview.md", "design.md", "dev.md"],
    });

    const result = ds.nav({}, ["docs/design.md"]);
    assert.ok(result !== null, "should return nav for middle chapter");
    assert.ok(result.includes("←"), "middle chapter should have prev link");
    assert.ok(result.includes("→"), "middle chapter should have next link");
    assert.ok(result.includes("overview.md"), "should link to first chapter");
    assert.ok(result.includes("dev.md"), "should link to third chapter");

    fs.rmSync(tmpDir, { recursive: true });
  });
});
