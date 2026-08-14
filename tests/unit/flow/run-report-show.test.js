/**
 * tests/unit/flow/run-report-show.test.js
 *
 * Covers AC1/AC2/AC3 of spec 211: `sennel flow report show` streams the
 * latest finalize Report text from `report.json`, and fails clearly when the
 * pointer or `report.json` is missing.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../helpers/flow-setup.js";
import {
  resolveLatestReportPath,
  readReportText,
  POINTER_REL_PATH,
} from "../../../src/flow/lib/run-report-show.js";

function canonicalReportFixture(root, { specRoot = "specs", report = null } = {}) {
  const flowManager = makeFlowManager(root, { specRoot });
  const flow = new CanonicalFlowFixture({
    flowManager,
    specId: "001-demo",
    runId: "run-report-show",
    request: "Render the finalized canonical report.",
    specRecord: { requirements: [] },
  }).create().registerActive().activate("report");
  if (report !== null) {
    flowManager.publishArtifacts({
      specId: flow.specId,
      nodeId: "report",
      artifactWrites: [{
        logicalKey: "report",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(report)}\n`, "utf8"),
      }],
    });
  }
  writeFile(root, POINTER_REL_PATH, `${flow.specId}\n`);
  return { flow, flowManager };
}

describe("flow report show — resolve + read", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("AC1: resolves latest report.json from pointer and returns its text field", () => {
    tmp = createTmpDir("sennel-report-show-");
    const reportText = "  Report\n\n  Implementation\n──\n    feat: demo\n";
    const { flow, flowManager } = canonicalReportFixture(tmp, {
      report: { data: {}, text: reportText },
    });

    const reportPath = resolveLatestReportPath(tmp, "specs", flowManager);
    assert.equal(
      reportPath,
      path.join(flow.location().directory, "artifacts/report.json"),
    );
    assert.equal(readReportText(reportPath), reportText);
  });

  it("resolves a report from a configured spec root", () => {
    tmp = createTmpDir("sennel-report-show-configured-root-");
    const { flow, flowManager } = canonicalReportFixture(tmp, {
      specRoot: "flow-artifacts/specs",
      report: { data: {}, text: "ok" },
    });

    assert.equal(
      resolveLatestReportPath(tmp, "flow-artifacts/specs", flowManager),
      path.join(flow.location().directory, "artifacts/report.json"),
    );
  });

  it("AC2: throws NO_POINTER when the pointer file is absent", () => {
    tmp = createTmpDir("sennel-report-show-no-ptr-");
    assert.throws(
      () => resolveLatestReportPath(tmp),
      (err) => err.code === "NO_POINTER" && /pointer not found/.test(err.message),
    );
  });

  it("AC2: throws EMPTY_POINTER when the pointer file is empty", () => {
    tmp = createTmpDir("sennel-report-show-empty-ptr-");
    writeFile(tmp, POINTER_REL_PATH, "   \n");
    assert.throws(
      () => resolveLatestReportPath(tmp),
      (err) => err.code === "EMPTY_POINTER",
    );
  });

  it("AC3: throws NO_REPORT when pointer exists but report.json is missing", () => {
    tmp = createTmpDir("sennel-report-show-no-report-");
    const { flowManager } = canonicalReportFixture(tmp);
    assert.throws(
      () => resolveLatestReportPath(tmp, "specs", flowManager),
      (err) => err.code === "NO_REPORT" && /cataloged report is unavailable/.test(err.message),
    );
  });

  it("readReportText: throws PARSE_ERROR on invalid JSON", () => {
    tmp = createTmpDir("sennel-report-show-bad-json-");
    const reportPath = path.join(tmp, "report.json");
    fs.writeFileSync(reportPath, "{ not json");
    assert.throws(
      () => readReportText(reportPath),
      (err) => err.code === "PARSE_ERROR",
    );
  });

  it("readReportText: throws NO_TEXT when text field is missing", () => {
    tmp = createTmpDir("sennel-report-show-no-text-");
    const reportPath = path.join(tmp, "report.json");
    fs.writeFileSync(reportPath, JSON.stringify({ data: {} }));
    assert.throws(
      () => readReportText(reportPath),
      (err) => err.code === "NO_TEXT",
    );
  });
});
