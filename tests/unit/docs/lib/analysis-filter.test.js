/**
 * Tests for analysis-filter.js — docs.exclude filtering for analysis entries.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterAnalysisByDocsExclude, filterByDocsExclude } from "../../../../src/docs/lib/analysis-filter.js";

describe("filterByDocsExclude", () => {
  it("returns entries unchanged when excludePatterns is undefined", () => {
    const entries = [{ file: "src/a.js" }, { file: "src/b.js" }];
    assert.deepStrictEqual(filterByDocsExclude(entries, undefined), entries);
  });

  it("returns entries unchanged when excludePatterns is empty", () => {
    const entries = [{ file: "src/a.js" }, { file: "src/b.js" }];
    assert.deepStrictEqual(filterByDocsExclude(entries, []), entries);
  });

  it("excludes entries matching glob pattern", () => {
    const entries = [
      { file: "src/presets/base/data/structure.js" },
      { file: "src/lib/cli.js" },
      { file: "fixtures/presets/child-preset/data/config.js" },
    ];
    const result = filterByDocsExclude(entries, ["src/presets/**"]);
    assert.equal(result.length, 2);
    assert.equal(result[0].file, "src/lib/cli.js");
    assert.equal(result[1].file, "fixtures/presets/child-preset/data/config.js");
  });

  it("keeps entries without file field", () => {
    const entries = [{ name: "no-file" }, { file: "fixtures/presets/x.js" }];
    const result = filterByDocsExclude(entries, ["fixtures/presets/**"]);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "no-file");
  });

  it("handles multiple exclude patterns", () => {
    const entries = [
      { file: "src/presets/base/data/x.js" },
      { file: "tests/unit/foo.test.js" },
      { file: "src/lib/cli.js" },
    ];
    const result = filterByDocsExclude(entries, ["src/presets/**", "tests/**"]);
    assert.equal(result.length, 1);
    assert.equal(result[0].file, "src/lib/cli.js");
  });
});

describe("filterAnalysisByDocsExclude", () => {
  it("filters entries in all categories", () => {
    const analysis = {
      enrichedAt: "2026-01-01",
      modules: {
        entries: [
          { file: "src/lib/cli.js", relPath: "src/lib/cli.js" },
          { file: "src/presets/base/data/structure.js", relPath: "src/presets/base/data/structure.js" },
        ],
      },
      controllers: {
        entries: [
          { file: "fixtures/presets/child-preset/data/config.js", relPath: "fixtures/presets/child-preset/data/config.js" },
        ],
      },
    };
    const result = filterAnalysisByDocsExclude(analysis, ["src/presets/**"]);

    assert.equal(result.modules.entries.length, 1);
    assert.equal(result.modules.entries[0].file, "src/lib/cli.js");
    assert.equal(result.controllers.entries.length, 1);
    assert.equal(result.enrichedAt, "2026-01-01");
  });

  it("returns analysis unchanged when no exclude patterns", () => {
    const analysis = {
      modules: { entries: [{ file: "src/a.js" }] },
    };
    const result = filterAnalysisByDocsExclude(analysis, undefined);
    assert.deepStrictEqual(result, analysis);
  });

  it("does not mutate original analysis", () => {
    const analysis = {
      modules: {
        entries: [
          { file: "src/lib/cli.js" },
          { file: "src/presets/base/data/structure.js" },
        ],
      },
    };
    const result = filterAnalysisByDocsExclude(analysis, ["src/presets/**"]);
    assert.equal(analysis.modules.entries.length, 2);
    assert.equal(result.modules.entries.length, 1);
  });
});
