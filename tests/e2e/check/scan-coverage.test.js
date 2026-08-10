import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";

const SENNEL = path.join(process.cwd(), "src/sennel.js");

function runScan(root) {
  return spawnSync("node", [SENNEL, "check", "scan", "--format", "json", "--list"], {
    encoding: "utf8",
    env: {
      ...process.env,
      SENNEL_WORK_ROOT: root,
      SENNEL_SOURCE_ROOT: path.join(root, "src"),
    },
  });
}

describe("check scan coverage", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("does not display 215 of 216 analyzed files as 100 percent", () => {
    tmp = createTmpDir();
    const files = Array.from({ length: 216 }, (_, index) => `lib/file-${index}.js`);
    for (const file of files) writeFile(tmp, `src/${file}`, "export {};\n");
    writeJson(tmp, ".sennel/config.json", {
      lang: "en",
      type: "base",
      scan: { include: ["**/*.js"], exclude: [] },
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    writeJson(tmp, ".sennel/output/analysis.json", {
      files: { entries: files.slice(0, 215).map((file) => ({ file })) },
    });

    const result = runScan(tmp);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const coverage = JSON.parse(result.stdout).dataSourceCoverage;
    assert.equal(coverage.total, 216);
    assert.equal(coverage.analyzed, 215);
    assert.equal(coverage.percent, 99.53);
    assert.notEqual(coverage.percent, 100);
  });
});
