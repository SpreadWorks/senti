import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeCoverage, coveragePercent, formatText } from "../../../src/check/commands/scan.js";
import { checkFreshness } from "../../../src/check/commands/freshness.js";
import { ScanPolicy } from "../../../src/lib/file-tree-walker.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";

const FRESHNESS_EXCLUDED_DIRECTORIES = [
  ".git/objects",
  ".senti/output",
  "node_modules/example",
  "src/node_modules/example",
  "vendor/example",
  "specs/example/review-history",
  "specs/example/review-evidence",
  "specs/example/tests/.raw",
];

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
    const json = result.toJSON();
    assert.equal(json.ok, false);
    assert.deepEqual(json.sourceScan, {
      target: src,
      policy: "freshness-source",
      complete: false,
      limits: [{ kind: "files", relativePath: "c.js", maximum: 2 }],
    });
    assert.deepEqual(json.docsScan, {
      target: path.join(tmp, "docs"),
      policy: "default",
      complete: true,
      limits: [],
    });
  });

  it("ignores generated source boundaries that exceed the file budget", async () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/current.js", "export {}\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    for (const directory of FRESHNESS_EXCLUDED_DIRECTORIES) {
      for (let index = 0; index < 3; index += 1) {
        writeFile(tmp, `${directory}/artifact-${index}.json`, "{}\n");
      }
    }

    const sourceFile = path.join(tmp, "src/current.js");
    const docsFile = path.join(tmp, "docs/overview.md");
    const generatedFile = path.join(tmp, "specs/example/tests/.raw/artifact-0.json");
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-01-02T00:00:00.000Z");
    fs.utimesSync(sourceFile, older, older);
    fs.utimesSync(docsFile, newer, newer);
    fs.utimesSync(generatedFile, newer, newer);

    const result = await checkFreshness(tmp, tmp, {
      policy: new ScanPolicy({ maxFiles: 2 }),
    });

    assert.equal(result.result, "fresh");
    assert.equal(result.srcNewest, older.toISOString());
    assert.equal(result.docsNewest, newer.toISOString());
    assert.deepEqual(result.toJSON().sourceScan.limits, []);
  });

  it("applies generated spec exclusions from a nested source root", async () => {
    tmp = createTmpDir();
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    for (let index = 0; index < 3; index += 1) {
      writeFile(tmp, `specs/example/review-evidence/artifact-${index}.json`, "{}\n");
    }

    const result = await checkFreshness(tmp, path.join(tmp, "specs/example"), {
      policy: new ScanPolicy({ maxFiles: 2 }),
    });

    assert.equal(result.result, "fresh");
    assert.deepEqual(result.toJSON().sourceScan.limits, []);
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

  it("reports both scan details when documentation has never been built", async () => {
    tmp = createTmpDir();
    const src = path.join(tmp, "src");
    fs.mkdirSync(src, { recursive: true });

    const result = await checkFreshness(tmp, src);

    assert.equal(result.result, "never-built");
    assert.deepEqual(result.toJSON().sourceScan, {
      target: src,
      policy: "freshness-source",
      complete: false,
      limits: [],
    });
    assert.deepEqual(result.toJSON().docsScan, {
      target: path.join(tmp, "docs"),
      policy: "default",
      complete: false,
      limits: [],
    });
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
