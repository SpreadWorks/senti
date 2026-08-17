/**
 * specs/159-check-config-command/tests/check-config.test.js
 *
 * Spec verification tests for `sdd-forge check config`.
 * These tests verify that the requirements in spec 159 are met.
 * Run with: node --test specs/159-check-config-command/tests/check-config.test.js
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/check/commands/config.js");

const VALID_CONFIG = {
  lang: "ja",
  type: "node-cli",
  docs: { languages: ["ja"], defaultLanguage: "ja" },
};

describe("sdd-forge check config", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  // Requirement 1: command runs
  it("runs successfully with a valid config", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", VALID_CONFIG);

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 0, `expected exit 0, got ${result.status}\nstderr: ${result.stderr}`);
    assert.ok(
      result.stdout.includes("config is valid"),
      `expected "config is valid" in stdout:\n${result.stdout}`
    );
  });

  // Requirement 2: missing config.json → exit 1
  it("reports error and exits 1 when config.json does not exist", () => {
    tmp = createTmpDir();

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 1, `expected exit 1, got ${result.status}`);
    assert.ok(
      result.stderr.includes("config") || result.stdout.includes("config"),
      `expected error message about config:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
  });

  // Requirement 3: invalid JSON → exit 1
  it("reports parse error and exits 1 when config.json is invalid JSON", () => {
    tmp = createTmpDir();
    writeFile(tmp, ".sdd-forge/config.json", "{ invalid json }");

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 1, `expected exit 1, got ${result.status}`);
  });

  // Requirement 4: schema errors → exit 1, errors listed
  it("lists missing required field and exits 1", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      // lang is missing
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 1, `expected exit 1, got ${result.status}`);
    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes("lang"),
      `expected error mentioning 'lang':\n${output}`
    );
  });

  // Requirement 5: unknown preset → exit 1
  it("reports unknown preset and exits 1 when type is not found", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "nonexistent-preset-xyz",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 1, `expected exit 1, got ${result.status}`);
    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes("nonexistent-preset-xyz"),
      `expected preset name in output:\n${output}`
    );
  });

  // Requirement 5 (array): multiple types, one unknown
  it("reports unknown preset when type is an array with unknown entry", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: ["node-cli", "bogus-preset"],
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });

    const result = spawnSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 1, `expected exit 1, got ${result.status}`);
    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes("bogus-preset"),
      `expected unknown preset name in output:\n${output}`
    );
  });

  // Requirement 7: --format json
  it("outputs valid JSON with ok field when --format json is passed", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", VALID_CONFIG);

    const result = spawnSync("node", [CMD, "--format", "json"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 0, `expected exit 0, got ${result.status}\nstderr: ${result.stderr}`);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.stdout); }, "stdout must be valid JSON");
    assert.ok("ok" in parsed, `expected 'ok' field in JSON:\n${result.stdout}`);
    assert.equal(parsed.ok, true);
  });

  // Requirement 7: --format json on error
  it("outputs JSON with ok=false when --format json and config is invalid", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      // lang missing
    });

    const result = spawnSync("node", [CMD, "--format", "json"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    assert.equal(result.status, 1, `expected exit 1, got ${result.status}`);
    let parsed;
    assert.doesNotThrow(() => { parsed = JSON.parse(result.stdout); }, "stdout must be valid JSON");
    assert.equal(parsed.ok, false);
    assert.ok(Array.isArray(parsed.checks), `expected 'checks' array in JSON:\n${result.stdout}`);
  });

  // Requirement 8: --help
  it("displays help with -h and exits 0", () => {
    const result = spawnSync("node", [CMD, "-h"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 0, `expected exit 0, got ${result.status}`);
    assert.ok(
      result.stdout.includes("Usage"),
      `expected Usage in help output:\n${result.stdout}`
    );
  });
});
