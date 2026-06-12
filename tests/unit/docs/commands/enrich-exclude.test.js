import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterByDocsExclude } from "../../../../src/docs/commands/enrich.js";

describe("filterByDocsExclude", () => {
  const entries = [
    { category: "modules", index: 0, file: "src/lib/cli.js", enriched: false },
    { category: "modules", index: 1, file: "src/presets/base/data/structure.js", enriched: false },
    { category: "modules", index: 2, file: "fixtures/presets/sample-parent/tests/unit/scan.test.js", enriched: false },
    { category: "modules", index: 3, file: "fixtures/presets/sample-preset/tests/acceptance/fixtures/src/App.php", enriched: false },
    { category: "modules", index: 4, file: "src/docs/commands/text.js", enriched: false },
  ];

  it("returns all entries when no exclude patterns", () => {
    const result = filterByDocsExclude(entries, undefined);
    assert.equal(result.length, 5);
  });

  it("returns all entries when exclude is empty array", () => {
    const result = filterByDocsExclude(entries, []);
    assert.equal(result.length, 5);
  });

  it("excludes entries matching a single pattern", () => {
    const result = filterByDocsExclude(entries, ["fixtures/presets/*/tests/**"]);
    assert.equal(result.length, 3);
    assert.ok(result.every((e) => !e.file.includes("/tests/")));
  });

  it("excludes entries matching multiple patterns", () => {
    const result = filterByDocsExclude(entries, [
      "fixtures/presets/*/tests/**",
      "src/presets/*/data/**",
    ]);
    assert.equal(result.length, 2);
    assert.ok(result.some((e) => e.file === "src/lib/cli.js"));
    assert.ok(result.some((e) => e.file === "src/docs/commands/text.js"));
  });

  it("does not exclude non-matching entries", () => {
    const result = filterByDocsExclude(entries, ["src/nonexistent/**"]);
    assert.equal(result.length, 5);
  });

  it("handles entries without file field gracefully", () => {
    const withNoFile = [
      ...entries,
      { category: "modules", index: 5, enriched: false },
    ];
    const result = filterByDocsExclude(withNoFile, ["fixtures/presets/*/tests/**"]);
    // Entry without file should not be excluded
    assert.ok(result.some((e) => e.index === 5));
  });
});
