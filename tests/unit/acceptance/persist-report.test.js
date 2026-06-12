/**
 * tests/unit/acceptance/persist-report.test.js
 *
 * Unit tests for persisting acceptance reports to project root.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { persistReport } from "../../acceptance/lib/test-template.js";

describe("persistReport", () => {
  let tmp;

  it("writes report to .senti/output/acceptance-report-{preset}.json", () => {
    tmp = createTmpDir("persist-test-");
    const report = { preset: "child-preset", timestamp: "2026-03-28T00:00:00.000Z" };

    persistReport(tmp, report);

    const outPath = path.join(tmp, ".senti", "output", "acceptance-report-child-preset.json");
    assert.ok(fs.existsSync(outPath), "report file should exist");
    const written = JSON.parse(fs.readFileSync(outPath, "utf8"));
    assert.deepEqual(written, report);
  });

  it("creates .senti/output/ directory if it does not exist", () => {
    tmp = createTmpDir("persist-test-");
    const outDir = path.join(tmp, ".senti", "output");
    assert.ok(!fs.existsSync(outDir), "output dir should not exist before");

    persistReport(tmp, { preset: "base" });

    assert.ok(fs.existsSync(outDir), "output dir should be created");
  });

  it("overwrites existing report file on re-run", () => {
    tmp = createTmpDir("persist-test-");
    const oldReport = { preset: "sample-node-command", timestamp: "2026-03-27T00:00:00.000Z" };
    const newReport = { preset: "sample-node-command", timestamp: "2026-03-28T00:00:00.000Z" };
    const outPath = path.join(tmp, ".senti", "output", "acceptance-report-sample-node-command.json");

    persistReport(tmp, oldReport);
    persistReport(tmp, newReport);

    const written = JSON.parse(fs.readFileSync(outPath, "utf8"));
    assert.deepEqual(written, newReport);
  });

  it("uses preset name from report as filename suffix", () => {
    tmp = createTmpDir("persist-test-");

    persistReport(tmp, { preset: "sample-preset" });

    const outPath = path.join(tmp, ".senti", "output", "acceptance-report-sample-preset.json");
    assert.ok(fs.existsSync(outPath), "file should use preset name as suffix");
  });

  it("cleanup", () => {
    if (tmp) removeTmpDir(tmp);
  });
});
