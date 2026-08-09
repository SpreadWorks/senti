import { describe, it } from "node:test";
import assert from "node:assert/strict";

// These functions will be created in the implementation phase.
// For now, import paths are placeholders that match the expected module structure.
import {
  mergeChapters,
  extractDataCategories,
  buildCategoryToChapterMap,
} from "../../../../src/docs/lib/chapter-resolver.js";

// ---------------------------------------------------------------------------
// mergeChapters — R1, R2
// ---------------------------------------------------------------------------

describe("mergeChapters", () => {
  it("returns preset chapters when config has no chapters", () => {
    const preset = [
      { chapter: "overview.md", desc: "Project overview" },
      { chapter: "cli_commands.md", desc: "CLI reference" },
    ];
    const result = mergeChapters(preset, undefined);
    assert.deepEqual(result, preset);
  });

  it("returns preset chapters when config chapters is empty", () => {
    const preset = [
      { chapter: "overview.md", desc: "Project overview" },
    ];
    const result = mergeChapters(preset, []);
    assert.deepEqual(result, preset);
  });

  it("overrides desc from config", () => {
    const preset = [
      { chapter: "stack_and_ops.md", desc: "Runtime stack" },
    ];
    const config = [
      { chapter: "stack_and_ops.md", desc: "Runtime stack of this tool, not preset capabilities" },
    ];
    const result = mergeChapters(preset, config);
    assert.equal(result[0].desc, "Runtime stack of this tool, not preset capabilities");
  });

  it("excludes chapters with exclude: true", () => {
    const preset = [
      { chapter: "overview.md", desc: "Overview" },
      { chapter: "internal_design.md", desc: "Internal design" },
      { chapter: "cli_commands.md", desc: "CLI" },
    ];
    const config = [
      { chapter: "internal_design.md", exclude: true },
    ];
    const result = mergeChapters(preset, config);
    assert.equal(result.length, 2);
    assert.ok(!result.find((c) => c.chapter === "internal_design.md"));
  });

  it("preserves preset order", () => {
    const preset = [
      { chapter: "overview.md" },
      { chapter: "stack_and_ops.md" },
      { chapter: "cli_commands.md" },
    ];
    const config = [
      { chapter: "cli_commands.md", desc: "Commands" },
    ];
    const result = mergeChapters(preset, config);
    assert.equal(result[0].chapter, "overview.md");
    assert.equal(result[1].chapter, "stack_and_ops.md");
    assert.equal(result[2].chapter, "cli_commands.md");
  });

  it("appends config-only chapters at the end", () => {
    const preset = [
      { chapter: "overview.md" },
    ];
    const config = [
      { chapter: "custom_deploy.md", desc: "Custom deployment" },
    ];
    const result = mergeChapters(preset, config);
    assert.equal(result.length, 2);
    assert.equal(result[0].chapter, "overview.md");
    assert.equal(result[1].chapter, "custom_deploy.md");
    assert.equal(result[1].desc, "Custom deployment");
  });

  it("does not add excluded config-only chapters", () => {
    const preset = [{ chapter: "overview.md" }];
    const config = [{ chapter: "removed.md", exclude: true }];
    const result = mergeChapters(preset, config);
    assert.equal(result.length, 1);
  });

  it("preserves preset desc when config does not override", () => {
    const preset = [
      { chapter: "overview.md", desc: "Original desc" },
    ];
    const config = [
      { chapter: "overview.md", exclude: false },
    ];
    const result = mergeChapters(preset, config);
    assert.equal(result[0].desc, "Original desc");
  });
});

// ---------------------------------------------------------------------------
// extractDataCategories — R5
// ---------------------------------------------------------------------------

describe("extractDataCategories", () => {
  it("extracts category from data directive", () => {
    const template = [
      '<!-- {{data("base.modules.list", {labels: "Name|Path"})}} -->',
      "table content",
      "<!-- {{/data}} -->",
    ].join("\n");
    const categories = extractDataCategories(template);
    assert.ok(categories.has("modules"));
  });

  it("extracts multiple categories from one file", () => {
    const template = [
      '<!-- {{data("base.modules.list")}} -->',
      "<!-- {{/data}} -->",
      '<!-- {{data("base.structure.tree")}} -->',
      "<!-- {{/data}} -->",
    ].join("\n");
    const categories = extractDataCategories(template);
    assert.ok(categories.has("modules"));
    assert.ok(categories.has("structure"));
  });

  it("returns empty set when no data directives", () => {
    const template = [
      "# Overview",
      '<!-- {{text({prompt: "Describe the project."})}} -->',
      "<!-- {{/text}} -->",
    ].join("\n");
    const categories = extractDataCategories(template);
    assert.equal(categories.size, 0);
  });

  it("handles inline data directives", () => {
    const template = '<!-- {{data("sample-command.project.name")}} -->senrail<!-- {{/data}} -->';
    const categories = extractDataCategories(template);
    assert.ok(categories.has("project"));
  });
});

// ---------------------------------------------------------------------------
// buildCategoryToChapterMap — R4
// ---------------------------------------------------------------------------

describe("buildCategoryToChapterMap", () => {
  it("builds mapping from chapter files and their data categories", () => {
    const chapterCategories = new Map([
      ["overview.md", new Set(["modules"])],
      ["cli_commands.md", new Set(["commands"])],
    ]);
    const map = buildCategoryToChapterMap(chapterCategories);
    assert.equal(map.get("modules"), "overview");
    assert.equal(map.get("commands"), "cli_commands");
  });

  it("uses first chapter when category appears in multiple chapters", () => {
    const chapterCategories = new Map([
      ["overview.md", new Set(["modules"])],
      ["project_structure.md", new Set(["modules", "structure"])],
    ]);
    const map = buildCategoryToChapterMap(chapterCategories);
    // First chapter wins
    assert.equal(map.get("modules"), "overview");
    assert.equal(map.get("structure"), "project_structure");
  });

  it("returns empty map when no categories", () => {
    const chapterCategories = new Map([
      ["overview.md", new Set()],
    ]);
    const map = buildCategoryToChapterMap(chapterCategories);
    assert.equal(map.size, 0);
  });

  it("strips .md from chapter names in values", () => {
    const chapterCategories = new Map([
      ["stack_and_ops.md", new Set(["runtime"])],
    ]);
    const map = buildCategoryToChapterMap(chapterCategories);
    assert.equal(map.get("runtime"), "stack_and_ops");
  });
});
