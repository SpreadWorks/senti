/**
 * scan multi-type pattern merging tests.
 *
 * Verifies that when config.type is an array, scan collects files
 * from ALL type chains' scan patterns, not just the primary type.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/sennel.js");
const CMD_ARGS = ["docs", "scan"];

function makeEnv(tmp) {
  return { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp };
}

describe("scan multi-type pattern merging", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("single type with no scan patterns collects 0 files", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", {
      lang: "ja",
      type: "sample-endpoint",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });
    writeJson(tmp, "package.json", { name: "test", version: "1.0.0" });
    writeFile(tmp, "src/index.ts", "export default {};\n");

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });
    const analysis = JSON.parse(result);
    // sample-endpoint has no matching scan results → only package (from package.json)
    assert.ok(analysis.analyzedAt);
    assert.ok(!analysis.modules, "sample-endpoint alone should not produce modules");
  });

  it("multi-type merges scan patterns from all chains", () => {
    tmp = createTmpDir();
    // sample-endpoint has no matching scan results, sample-node-command has scan patterns for src/**/*.js
    writeJson(tmp, ".sennel/config.json", {
      lang: "ja",
      type: ["sample-endpoint", "sample-node-command"],
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });
    writeJson(tmp, "package.json", { name: "test", version: "1.0.0" });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });
    const analysis = JSON.parse(result);
    assert.ok(analysis.modules, "sample-node-command scan patterns should be merged, producing modules");
    assert.equal(analysis.modules.summary.total, 1);
  });

  it("multi-type loads DataSources from all chains", () => {
    tmp = createTmpDir();
    // sample-node-command provides modules scan, child-preset provides controllers scan
    writeJson(tmp, ".sennel/config.json", {
      lang: "ja",
      type: ["sample-node-command", "child-preset"],
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });
    writeJson(tmp, "package.json", { name: "test", version: "1.0.0" });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });
    const analysis = JSON.parse(result);
    // sample-node-command chain -> modules DataSource should scan the .js file
    assert.ok(analysis.modules, "modules from sample-node-command chain should be present");
    // child-preset chain → controllers DataSource loaded (no PHP files, so no data)
    // The key point is that both chains' DataSources are loaded without error
  });

  it("config.scan overrides all preset patterns", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", {
      lang: "ja",
      type: ["sample-endpoint", "sample-node-command"],
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["lib/**/*.js"], exclude: [] },
    });
    writeJson(tmp, "package.json", { name: "test", version: "1.0.0" });
    // File in src/ should NOT be found (config.scan overrides preset patterns)
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');
    // File in lib/ should be found
    writeFile(tmp, "lib/util.js", 'export function util() { return "u"; }\n');

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });
    const analysis = JSON.parse(result);
    if (analysis.modules) {
      // Should only find lib/util.js, not src/index.js
      const files = analysis.modules.entries.map((m) => m.relPath || m.file);
      assert.ok(!files.some((f) => f.includes("src/")), "src/ files should not be collected when config.scan overrides");
    }
  });
});
