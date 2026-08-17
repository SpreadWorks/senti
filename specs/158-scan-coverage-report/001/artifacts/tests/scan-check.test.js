/**
 * specs/158-scan-coverage-report/tests/scan-check.test.js
 *
 * Spec verification tests for `sdd-forge check scan`.
 * These tests verify that the requirements in spec 158 are met.
 * Run with: node --test specs/158-scan-coverage-report/tests/scan-check.test.js
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/check/commands/scan.js");

/**
 * Build a minimal analysis.json with given categories and file entries.
 */
function buildAnalysis(categories = {}) {
  return { analyzedAt: new Date().toISOString(), ...categories };
}

describe("sdd-forge check scan", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  // Requirement 5-1: include coverage calculation
  it("displays include coverage (matched files / total files)", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    // 3 total files, 2 match src/**/*.js
    writeFile(tmp, "src/a.js", "");
    writeFile(tmp, "src/b.js", "");
    writeFile(tmp, "README.md", "");

    writeJson(tmp, ".sdd-forge/output/analysis.json", buildAnalysis({
      modules: { entries: [{ file: "src/a.js" }, { file: "src/b.js" }], summary: { total: 2 } },
    }));

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes("2"), "should show matched file count");
    assert.ok(result.stdout.includes("3"), "should show total file count");
  });

  // Requirement 5-2: DataSource coverage calculation
  it("displays DataSource coverage (analyzed files / include-matched files)", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/a.js", "");
    writeFile(tmp, "src/b.js", "");
    writeFile(tmp, "src/c.js", "");

    // Only 2 of 3 matched files were analyzed by a DataSource
    writeJson(tmp, ".sdd-forge/output/analysis.json", buildAnalysis({
      modules: { entries: [{ file: "src/a.js" }, { file: "src/b.js" }], summary: { total: 2 } },
    }));

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    // DataSource coverage: 2 analyzed / 3 matched
    assert.ok(result.stdout.includes("2"), "should show analyzed count");
  });

  // Requirement 6: default 10 files, --list for all
  it("shows at most 10 uncovered files by default and suggests --list when more exist", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    // Create 15 files, none analyzed
    for (let i = 1; i <= 15; i++) {
      writeFile(tmp, `src/file${i}.js`, "");
    }
    writeJson(tmp, ".sdd-forge/output/analysis.json", buildAnalysis());

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const lines = result.stdout.split("\n").filter(l => l.includes("src/file"));
    assert.ok(lines.length <= 10, `should show at most 10 file lines, got ${lines.length}`);
    assert.ok(result.stdout.includes("--list"), "should suggest --list when more than 10 uncovered files");
  });

  it("shows all uncovered files with --list", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    for (let i = 1; i <= 15; i++) {
      writeFile(tmp, `src/file${i}.js`, "");
    }
    writeJson(tmp, ".sdd-forge/output/analysis.json", buildAnalysis());

    const result = spawnSync("node", [CMD, "--list"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    const lines = result.stdout.split("\n").filter(l => l.includes("src/file"));
    assert.ok(lines.length >= 15, `should show all 15 file lines, got ${lines.length}`);
  });

  // Requirement 4-1: --format json
  it("outputs JSON with --format json", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/a.js", "");
    writeJson(tmp, ".sdd-forge/output/analysis.json", buildAnalysis({
      modules: { entries: [{ file: "src/a.js" }], summary: { total: 1 } },
    }));

    const result = spawnSync("node", [CMD, "--format", "json"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 0, `stderr: ${result.stderr}`);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.stdout); }, "output should be valid JSON");
    assert.ok("includeCoverage" in parsed, "JSON should have includeCoverage");
    assert.ok("dataSourceCoverage" in parsed, "JSON should have dataSourceCoverage");
  });

  // Requirement 7: non-zero exit on missing analysis.json
  it("exits with code 1 when analysis.json does not exist", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 1, "should exit with code 1 when analysis.json missing");
    assert.ok(result.stderr.length > 0 || result.stdout.length > 0, "should output an error message");
  });
});
