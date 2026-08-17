import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/docs/commands/scan.js");

describe("scan structural info extraction", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("scan extracts imports and exports for JS files", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", [
      'import fs from "fs";',
      'import { helper } from "./lib/helper.js";',
      "",
      "export function main() {}",
      "export default main;",
    ].join("\n"));
    writeFile(tmp, "src/lib/helper.js", [
      "export function helper() { return 1; }",
    ].join("\n"));

    const result = execFileSync("node", [CMD, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);

    const indexEntry = analysis.modules.entries.find(e => e.file === "src/index.js");
    assert.ok(indexEntry, "src/index.js should be in analysis");
    assert.ok(Array.isArray(indexEntry.imports), "imports should be an array");
    assert.ok(indexEntry.imports.includes("./lib/helper.js"), "imports should include ./lib/helper.js");
    assert.ok(Array.isArray(indexEntry.exports), "exports should be an array");
    assert.ok(indexEntry.exports.includes("main"), "exports should include main");
  });

  it("scan populates usedBy from reverse import lookup", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/main.js", [
      'import { util } from "./util.js";',
      "export function main() { util(); }",
    ].join("\n"));
    writeFile(tmp, "src/util.js", [
      "export function util() { return 1; }",
    ].join("\n"));

    const result = execFileSync("node", [CMD, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);

    const utilEntry = analysis.modules.entries.find(e => e.file === "src/util.js");
    assert.ok(utilEntry, "src/util.js should be in analysis");
    assert.ok(Array.isArray(utilEntry.usedBy), "usedBy should be an array");
    assert.ok(utilEntry.usedBy.includes("src/main.js"), "usedBy should include src/main.js");
  });
});
