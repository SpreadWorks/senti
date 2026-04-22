/**
 * tests/unit/flow/run-report-show.test.js
 *
 * Covers AC1/AC2/AC3 of spec 211: `sdd-forge flow report show` streams the
 * latest finalize Report text from `report.json`, and fails clearly when the
 * pointer or `report.json` is missing.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import {
  resolveLatestReportPath,
  readReportText,
  POINTER_REL_PATH,
} from "../../../src/flow/lib/run-report-show.js";

describe("flow report show — resolve + read", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("AC1: resolves latest report.json from pointer and returns its text field", () => {
    tmp = createTmpDir("sdd-report-show-");
    const specRel = "specs/001-demo/spec.json";
    writeFile(tmp, POINTER_REL_PATH, specRel + "\n");
    const reportText = "  Report\n\n  Implementation\n──\n    feat: demo\n";
    writeFile(
      tmp,
      "specs/001-demo/report.json",
      JSON.stringify({ data: {}, text: reportText }),
    );

    const reportPath = resolveLatestReportPath(tmp);
    assert.equal(
      reportPath,
      path.join(tmp, "specs/001-demo/report.json"),
    );
    assert.equal(readReportText(reportPath), reportText);
  });

  it("AC2: throws NO_POINTER when the pointer file is absent", () => {
    tmp = createTmpDir("sdd-report-show-no-ptr-");
    assert.throws(
      () => resolveLatestReportPath(tmp),
      (err) => err.code === "NO_POINTER" && /pointer not found/.test(err.message),
    );
  });

  it("AC2: throws EMPTY_POINTER when the pointer file is empty", () => {
    tmp = createTmpDir("sdd-report-show-empty-ptr-");
    writeFile(tmp, POINTER_REL_PATH, "   \n");
    assert.throws(
      () => resolveLatestReportPath(tmp),
      (err) => err.code === "EMPTY_POINTER",
    );
  });

  it("AC3: throws NO_REPORT when pointer exists but report.json is missing", () => {
    tmp = createTmpDir("sdd-report-show-no-report-");
    writeFile(tmp, POINTER_REL_PATH, "specs/001-demo/spec.json\n");
    assert.throws(
      () => resolveLatestReportPath(tmp),
      (err) => err.code === "NO_REPORT" && /report\.json not found/.test(err.message),
    );
  });

  it("readReportText: throws PARSE_ERROR on invalid JSON", () => {
    tmp = createTmpDir("sdd-report-show-bad-json-");
    const reportPath = path.join(tmp, "report.json");
    fs.writeFileSync(reportPath, "{ not json");
    assert.throws(
      () => readReportText(reportPath),
      (err) => err.code === "PARSE_ERROR",
    );
  });

  it("readReportText: throws NO_TEXT when text field is missing", () => {
    tmp = createTmpDir("sdd-report-show-no-text-");
    const reportPath = path.join(tmp, "report.json");
    fs.writeFileSync(reportPath, JSON.stringify({ data: {} }));
    assert.throws(
      () => readReportText(reportPath),
      (err) => err.code === "NO_TEXT",
    );
  });
});
