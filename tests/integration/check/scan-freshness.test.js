import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeCoverage, coveragePercent, formatText } from "../../../src/check/commands/scan.js";
import { checkFreshness, FreshnessFileInventory } from "../../../src/check/commands/freshness.js";
import { ScanPolicy } from "../../../src/lib/file-tree-walker.js";
import {
  DocumentationSourceSelection,
} from "../../../src/docs/lib/source-selection.js";
import { DocumentationBuildInputSelection } from "../../../src/check/lib/documentation-build-input-selection.js";
import { commitAll, initGitRepo } from "../../support/infrastructure/git-repo.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../support/builders/tmp-dir.js";

function selectedSource(include, exclude = [], flowSpecRoot = "specs") {
  return new DocumentationBuildInputSelection({
    scanSelection: new DocumentationSourceSelection({ include, exclude }),
    flowSpecRoot,
  });
}

describe("bounded scan and freshness results", () => {
  let tmp;
  let externalSource;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    if (externalSource) removeTmpDir(externalSource);
  });

  it("uses strict equality for 100 percent and preserves an empty-set zero", () => {
    assert.equal(coveragePercent({ analyzed: 215, total: 216 }), 99.53);
    assert.equal(coveragePercent({ analyzed: 216, total: 216 }), 100);
    assert.equal(coveragePercent({ analyzed: 0, total: 0 }), 0);
  });

  it("marks scan coverage indeterminate immediately after the file limit", () => {
    tmp = createTmpDir();
    const src = path.join(tmp, "src");
    for (const file of ["a.js", "b.js", "c.js"]) writeFile(src, file, "export {};\n");
    writeJson(tmp, ".sennel/output/analysis.json", {
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
      sourceSelection: selectedSource(["**/*.js"]),
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

  it("applies scan selection before the source file budget", async () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/current.js", "export {}\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    for (let index = 0; index < 3; index += 1) {
      writeFile(tmp, `flow-workspace/example/001/steps/artifact-${index}.js`, "export {}\n");
    }

    const sourceFile = path.join(tmp, "src/current.js");
    const docsFile = path.join(tmp, "docs/overview.md");
    const generatedFile = path.join(tmp, "flow-workspace/example/001/steps/artifact-0.js");
    const older = new Date("2026-01-01T00:00:00.000Z");
    const newer = new Date("2026-01-02T00:00:00.000Z");
    fs.utimesSync(sourceFile, older, older);
    fs.utimesSync(docsFile, newer, newer);
    fs.utimesSync(generatedFile, newer, newer);

    const result = await checkFreshness(tmp, tmp, {
      policy: new ScanPolicy({ maxFiles: 2 }),
      sourceSelection: selectedSource(["src/**/*.js"], [], "flow-workspace"),
    });

    assert.equal(result.result, "fresh");
    assert.equal(result.srcNewest, older.toISOString());
    assert.equal(result.docsNewest, newer.toISOString());
    assert.deepEqual(result.toJSON().sourceScan.limits, []);
  });

  it("does not count ignored files that docs scan does not select", async () => {
    tmp = createTmpDir();
    initGitRepo(tmp);
    writeFile(tmp, ".gitignore", "specs/\n");
    writeFile(tmp, "src/tracked.js", "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    for (let index = 0; index < 5; index += 1) {
      writeFile(tmp, `specs/flow/001/steps/generated-${index}.js`, "export {};\n");
    }
    commitAll(tmp, "initial fixture");

    const older = new Date("2026-01-01T00:00:00.000Z");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    const ignoredNewer = new Date("2026-01-03T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, ".gitignore"), older, older);
    fs.utimesSync(path.join(tmp, "src/tracked.js"), older, older);
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);
    fs.utimesSync(path.join(tmp, "specs/flow/001/steps/generated-0.js"), ignoredNewer, ignoredNewer);

    const result = await checkFreshness(tmp, tmp, {
      policy: new ScanPolicy({ maxFiles: 2 }),
      sourceSelection: selectedSource(["src/**/*.js", "package.json"]),
    });

    assert.equal(result.result, "fresh");
    assert.equal(result.sourceScan.complete, true);
    assert.deepEqual(result.toJSON().sourceScan.limits, []);
  });

  it("counts ignored files when docs scan selects them", async () => {
    tmp = createTmpDir();
    initGitRepo(tmp);
    writeFile(tmp, ".gitignore", "specs/\n");
    writeFile(tmp, "src/tracked.js", "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    writeFile(tmp, "specs/flow/001/steps/included.js", "export const changed = true;\n");
    commitAll(tmp, "initial fixture");

    const older = new Date("2026-01-01T00:00:00.000Z");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    const ignoredNewer = new Date("2026-01-03T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, ".gitignore"), older, older);
    fs.utimesSync(path.join(tmp, "src/tracked.js"), older, older);
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);
    fs.utimesSync(path.join(tmp, "specs/flow/001/steps/included.js"), ignoredNewer, ignoredNewer);

    const result = await checkFreshness(tmp, tmp, {
      sourceSelection: selectedSource(["specs/**/*.js"]),
    });

    assert.equal(result.result, "stale");
    assert.equal(result.srcNewest, ignoredNewer.toISOString());
  });

  it("includes non-ignored untracked files in Git freshness", async () => {
    tmp = createTmpDir();
    initGitRepo(tmp);
    writeFile(tmp, ".gitignore", ".tmp/\n");
    writeFile(tmp, "src/tracked.js", "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    commitAll(tmp, "initial fixture");
    writeFile(tmp, "src/untracked.js", "export const changed = true;\n");

    const older = new Date("2026-01-01T00:00:00.000Z");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    const untrackedNewer = new Date("2026-01-03T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, ".gitignore"), older, older);
    fs.utimesSync(path.join(tmp, "src/tracked.js"), older, older);
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);
    fs.utimesSync(path.join(tmp, "src/untracked.js"), untrackedNewer, untrackedNewer);

    const result = await checkFreshness(tmp, tmp, {
      sourceSelection: selectedSource(["src/**/*.js"]),
    });

    assert.equal(result.result, "stale");
    assert.equal(result.srcNewest, untrackedNewer.toISOString());
  });

  it("keeps tracked files in freshness after a later ignore rule matches them", async () => {
    tmp = createTmpDir();
    initGitRepo(tmp);
    writeFile(tmp, ".gitignore", "");
    writeFile(tmp, "src/tracked.js", "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    commitAll(tmp, "track source");
    writeFile(tmp, ".gitignore", "src/tracked.js\n");
    commitAll(tmp, "ignore matching source path");

    const ignoreTime = new Date("2026-01-01T00:00:00.000Z");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    const trackedNewer = new Date("2026-01-03T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, ".gitignore"), ignoreTime, ignoreTime);
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);
    fs.utimesSync(path.join(tmp, "src/tracked.js"), trackedNewer, trackedNewer);

    const result = await checkFreshness(tmp, tmp, {
      sourceSelection: selectedSource(["src/**/*.js"]),
    });

    assert.equal(result.result, "stale");
    assert.equal(result.srcNewest, trackedNewer.toISOString());
  });

  it("does not count ignored cache files unless docs scan explicitly selects them", async () => {
    tmp = createTmpDir();
    initGitRepo(tmp);
    writeFile(tmp, ".gitignore", ".cache/\n");
    writeFile(tmp, "src/current.js", "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    for (let index = 0; index < 3; index += 1) {
      writeFile(tmp, `.cache/cache-${index}.js`, "export {};\n");
    }
    commitAll(tmp, "initial fixture");

    const older = new Date("2026-01-01T00:00:00.000Z");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    const cacheTime = new Date("2026-01-03T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, ".gitignore"), older, older);
    fs.utimesSync(path.join(tmp, "src/current.js"), older, older);
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);
    for (let index = 0; index < 3; index += 1) {
      fs.utimesSync(path.join(tmp, `.cache/cache-${index}.js`), cacheTime, cacheTime);
    }

    const unselected = await checkFreshness(tmp, tmp, {
      policy: new ScanPolicy({ maxFiles: 2 }),
      sourceSelection: selectedSource(["src/**/*.js"]),
    });
    assert.equal(unselected.result, "fresh");
    assert.equal(unselected.sourceScan.complete, true);

    const selected = await checkFreshness(tmp, tmp, {
      sourceSelection: selectedSource([".cache/**/*.js"]),
    });
    assert.equal(selected.result, "stale");
    assert.equal(selected.srcNewest, cacheTime.toISOString());
  });

  it("keeps a custom Flow workspace outside a docs scan that does not select it", async () => {
    tmp = createTmpDir();
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    for (let index = 0; index < 3; index += 1) {
      writeFile(tmp, `flow-data/example/001/steps/artifact-${index}.js`, "export {};\n");
    }

    writeFile(tmp, "src/current.js", "export {};\n");
    const older = new Date("2026-01-01T00:00:00.000Z");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    const artifactTime = new Date("2026-01-03T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, "src/current.js"), older, older);
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);
    fs.utimesSync(path.join(tmp, "flow-data/example/001/steps/artifact-0.js"), artifactTime, artifactTime);

    const result = await checkFreshness(tmp, tmp, {
      policy: new ScanPolicy({ maxFiles: 2 }),
      sourceSelection: selectedSource(["src/**/*.js"], [], "flow-data"),
    });

    assert.equal(result.result, "fresh");
    assert.deepEqual(result.toJSON().sourceScan.limits, []);
  });

  it("includes an explicitly selected custom Flow workspace", async () => {
    tmp = createTmpDir();
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    writeFile(tmp, "flow-data/example/001/steps/result.js", "export {};\n");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    const artifactTime = new Date("2026-01-03T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);
    fs.utimesSync(path.join(tmp, "flow-data/example/001/steps/result.js"), artifactTime, artifactTime);

    const result = await checkFreshness(tmp, tmp, {
      sourceSelection: selectedSource(["flow-data/**/*.js"], [], "flow-data"),
    });

    assert.equal(result.result, "stale");
    assert.equal(result.srcNewest, artifactTime.toISOString());
  });

  it("does not apply repository Flow exclusions to an external source root", async () => {
    tmp = createTmpDir();
    externalSource = createTmpDir();
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    writeFile(externalSource, "specs/external.js", "export {};\n");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    const sourceTime = new Date("2026-01-03T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);
    fs.utimesSync(path.join(externalSource, "specs/external.js"), sourceTime, sourceTime);

    const result = await checkFreshness(tmp, externalSource, {
      sourceSelection: new DocumentationBuildInputSelection({
        scanSelection: new DocumentationSourceSelection({ include: ["**/*.js"] }),
        flowSpecRoot: null,
      }),
    });

    assert.equal(result.result, "stale");
    assert.equal(result.srcNewest, sourceTime.toISOString());
  });

  it("treats config, plugin preset, and template inputs as material outside scan selection", async () => {
    tmp = createTmpDir();
    writeFile(tmp, "src/current.js", "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    writeJson(tmp, ".sennel/config.json", { type: "example" });
    writeJson(tmp, ".sennel/plugins/example/plugin.json", { name: "example" });
    writeFile(tmp, ".sennel/templates/en/docs/overview.md", "# Template\n");
    const sourceTime = new Date("2026-01-01T00:00:00.000Z");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    const configTime = new Date("2026-01-03T00:00:00.000Z");
    const pluginTime = new Date("2026-01-04T00:00:00.000Z");
    const templateTime = new Date("2026-01-05T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, "src/current.js"), sourceTime, sourceTime);
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);
    fs.utimesSync(path.join(tmp, ".sennel/config.json"), configTime, configTime);
    fs.utimesSync(path.join(tmp, ".sennel/plugins/example/plugin.json"), pluginTime, pluginTime);
    fs.utimesSync(path.join(tmp, ".sennel/templates/en/docs/overview.md"), templateTime, templateTime);

    const result = await checkFreshness(tmp, tmp, {
      sourceSelection: selectedSource(["src/**/*.js"]),
    });

    assert.equal(result.result, "stale");
    assert.equal(result.srcNewest, templateTime.toISOString());
  });

  it("skips over ten thousand tracked canonical artifacts before applying the budget", async () => {
    tmp = createTmpDir();
    initGitRepo(tmp);
    writeFile(tmp, "src/current.js", "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    for (let index = 0; index < 10_001; index += 1) {
      writeFile(tmp, `specs/flow/001/steps/task-${index}/result.json`, "{}\n");
    }
    commitAll(tmp, "track canonical Flow artifacts");

    const older = new Date("2026-01-01T00:00:00.000Z");
    const docsTime = new Date("2026-01-02T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, "src/current.js"), older, older);
    fs.utimesSync(path.join(tmp, "docs/overview.md"), docsTime, docsTime);

    const result = await checkFreshness(tmp, tmp, {
      policy: new ScanPolicy({ maxFiles: 2 }),
      sourceSelection: selectedSource(["src/**/*.js", "package.json"]),
    });

    assert.equal(result.result, "fresh");
    assert.equal(result.sourceScan.complete, true);
    assert.deepEqual(result.sourceScan.limits, []);
  });

  it("excludes canonical Flow storage in the Git listing before buffering candidates", () => {
    tmp = createTmpDir();
    const calls = [];
    const inventory = new FreshnessFileInventory({
      root: tmp,
      policy: new ScanPolicy({ maxFiles: 2 }),
      sourceSelection: selectedSource(["src/**/*.js", "package.json"]),
      excludedDirectory: "docs",
      gitRunner(args) {
        calls.push(args);
        if (args[0] === "rev-parse") return { ok: true, stdout: "true\n" };
        return { ok: true, stdout: "src/current.js\0package.json\0" };
      },
    });

    assert.deepEqual(inventory.collect().files, ["package.json", "src/current.js"]);
    assert.deepEqual(calls[1].slice(-4), [
      ".",
      ":(exclude,literal)specs",
      ":(exclude,literal).sennel",
      ":(exclude,literal)docs",
    ]);
  });

  it("treats a complete empty source set as fresh", async () => {
    tmp = createTmpDir();
    const src = path.join(tmp, "src");
    fs.mkdirSync(src, { recursive: true });
    fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });

    const result = await checkFreshness(tmp, src, {
      policy: new ScanPolicy({ maxFiles: 2 }),
      sourceSelection: selectedSource(["**/*.js"]),
    });

    assert.equal(result.result, "fresh");
  });

  it("keeps all documentation files in the default documentation timestamp scan", async () => {
    tmp = createTmpDir();
    const src = path.join(tmp, "src");
    writeFile(src, "index.js", "export {};\n");
    writeFile(tmp, "docs/overview.md", "# Overview\n");
    writeFile(tmp, "docs/vendor/reference.md", "# Reference\n");
    const overviewTime = new Date("2026-01-01T00:00:00.000Z");
    const sourceTime = new Date("2026-01-02T00:00:00.000Z");
    const vendorTime = new Date("2026-01-03T00:00:00.000Z");
    fs.utimesSync(path.join(tmp, "docs/overview.md"), overviewTime, overviewTime);
    fs.utimesSync(path.join(src, "index.js"), sourceTime, sourceTime);
    fs.utimesSync(path.join(tmp, "docs/vendor/reference.md"), vendorTime, vendorTime);

    const result = await checkFreshness(tmp, src, {
      sourceSelection: selectedSource(["**/*.js"]),
    });

    assert.equal(result.result, "fresh");
    assert.equal(result.docsNewest, vendorTime.toISOString());
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
    assert.equal((await checkFreshness(tmp, src, {
      sourceSelection: selectedSource(["**/*.js"]),
    })).result, "fresh");

    fs.utimesSync(sourceFile, newer, newer);
    fs.utimesSync(docsFile, older, older);
    assert.equal((await checkFreshness(tmp, src, {
      sourceSelection: selectedSource(["**/*.js"]),
    })).result, "stale");
  });
});
