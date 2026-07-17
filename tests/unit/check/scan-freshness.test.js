import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeCoverage, coveragePercent, formatText } from "../../../src/check/commands/scan.js";
import { checkFreshness } from "../../../src/check/commands/freshness.js";
import { ScanPolicy } from "../../../src/lib/file-tree-walker.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";

describe("bounded scan and freshness results", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("uses strict equality for 100 percent and preserves an empty-set zero", () => {
    assert.equal(coveragePercent({ analyzed: 215, total: 216 }), 99.53);
    assert.equal(coveragePercent({ analyzed: 216, total: 216 }), 100);
    assert.equal(coveragePercent({ analyzed: 0, total: 0 }), 0);
  });

  it("marks scan coverage indeterminate immediately after the file limit", () => {
    tmp = createTmpDir();
    const src = path.join(tmp, "src");
    for (const file of ["a.js", "b.js", "c.js"]) writeFile(src, file, "export {};\n");
    writeJson(tmp, ".senti/output/analysis.json", {
      files: { entries: [{ file: "a.js" }, { file: "b.js" }] },
    });

    const data = computeCoverage(tmp, src, {
      scan: { include: ["*.js"], exclude: [] },
    }, {
      policy: new ScanPolicy({ maxFiles: 2 }),
    });

    assert.equal(data.dataSourceCoverage.complete, false);
    assert.equal(data.dataSourceCoverage.result, "indeterminate");
    assert.match(data.dataSourceCoverage.limits.join(" "), /files limit 2/);
    assert.match(formatText(data, false), /DataSource: indeterminate/);
    assert.doesNotMatch(formatText(data, false), /100%/);
  });

  it("returns indeterminate freshness when either traversal exceeds the limit", async () => {
    tmp = createTmpDir();
    const src = path.join(tmp, "src");
    for (const file of ["a.js", "b.js", "c.js"]) writeFile(src, file, "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");

    const result = await checkFreshness(tmp, src, {
      policy: new ScanPolicy({ maxFiles: 2 }),
    });

    assert.equal(result.result, "indeterminate");
    assert.match(result.limits.join(" "), /source: files limit 2/);
    assert.match(result.toText(), /^indeterminate/);
    assert.equal(result.toJSON().ok, false);
  });

  it("treats a complete empty source set as fresh", async () => {
    tmp = createTmpDir();
    const src = path.join(tmp, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });

    const result = await checkFreshness(tmp, src, {
      policy: new ScanPolicy({ maxFiles: 2 }),
    });

    assert.equal(result.result, "fresh");
  });

  it("preserves fresh and stale results for complete traversals", async () => {
    tmp = createTmpDir();
    const src = path.join(tmp, "src");
    writeFile(src, "index.js", "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    const sourceFile = path.join(src, "index.js");
    const docsFile = path.join(tmp, "docs/overview.md");
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-01-02T00:00:00.000Z");

    fs.utimesSync(sourceFile, older, older);
    fs.utimesSync(docsFile, newer, newer);
    assert.equal((await checkFreshness(tmp, src)).result, "fresh");

    fs.utimesSync(sourceFile, newer, newer);
    fs.utimesSync(docsFile, older, older);
    assert.equal((await checkFreshness(tmp, src)).result, "stale");
  });
});
