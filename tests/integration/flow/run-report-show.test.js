/**
 * tests/integration/flow/run-report-show.test.js
 *
 * Covers AC1/AC2/AC3 of spec 211: `sennel flow report show` streams the
 * latest finalize Report text from `report.json`, and fails clearly when the
 * pointer or `report.json` is missing.
 */

import { after, afterEach, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeFile } from "../../support/builders/tmp-dir.js";
import { SeedWorkRoot } from "../../support/builders/seed-work-root.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import {
  CanonicalLatestReport,
  POINTER_REL_PATH,
} from "../../../src/flow/lib/run-report-show.js";

const SPEC_ID = "001-demo";

function canonicalReportFixture(root, { specRoot = "specs", report = null } = {}) {
  const flowManager = makeFlowManager(root, { specRoot });
  const flow = new CanonicalFlowFixture({
    flowManager,
    specId: SPEC_ID,
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
        bytes: Buffer.isBuffer(report)
          ? report
          : Buffer.from(`${JSON.stringify(report)}\n`, "utf8"),
      }],
    });
  }
  writeFile(root, POINTER_REL_PATH, `${flow.specId}\n`);
  return { flow, flowManager };
}

class CanonicalReportScenario {
  constructor(workRoot, flowManager) {
    this.workRoot = workRoot;
    this.flowManager = flowManager;
    this.location = flowManager.specLocation(SPEC_ID);
  }

  cleanup() {
    this.workRoot.cleanup();
  }
}

class CanonicalReportSeed {
  constructor() {
    this.root = createTmpDir("sennel-report-seed-");
    canonicalReportFixture(this.root);
  }

  createScenario(report) {
    const workRoot = new SeedWorkRoot(this.root, { prefix: "sennel-report-show-" });
    const flowManager = makeFlowManager(workRoot.root);
    if (report !== null) {
      flowManager.publishArtifacts({
        specId: SPEC_ID,
        nodeId: "report",
        artifactWrites: [{
          logicalKey: "report",
          mediaType: "application/json",
          bytes: Buffer.isBuffer(report)
            ? report
            : Buffer.from(`${JSON.stringify(report)}\n`, "utf8"),
        }],
      });
    }
    writeFile(workRoot.root, POINTER_REL_PATH, `${SPEC_ID}\n`);
    return new CanonicalReportScenario(workRoot, flowManager);
  }

  cleanup() {
    removeTmpDir(this.root);
  }
}

describe("flow report show — resolve + read", () => {
  let tmp;
  let seed;
  let scenario;

  before(() => { seed = new CanonicalReportSeed(); });
  after(() => seed.cleanup());
  afterEach(() => {
    if (scenario) scenario.cleanup();
    if (tmp) removeTmpDir(tmp);
    scenario = null;
    tmp = null;
  });

  it("AC1: resolves latest report.json from pointer and returns its text field", () => {
    const reportText = "  Report\n\n  Implementation\n──\n    feat: demo\n";
    scenario = seed.createScenario({ data: {}, text: reportText });

    const report = CanonicalLatestReport.read({
      mainRoot: scenario.workRoot.root,
      specRoot: "specs",
      flowManager: scenario.flowManager,
    });
    assert.equal(
      report.path,
      path.join(scenario.location.directory, "artifacts/report.json"),
    );
    assert.equal(report.text(), reportText);
  });

  it("resolves a report from a configured spec root", () => {
    tmp = createTmpDir("sennel-report-show-configured-root-");
    const { flow, flowManager } = canonicalReportFixture(tmp, {
      specRoot: "flow-artifacts/specs",
      report: { data: {}, text: "ok" },
    });

    const report = CanonicalLatestReport.read({
      mainRoot: tmp,
      specRoot: "flow-artifacts/specs",
      flowManager,
    });
    assert.equal(report.path, path.join(flow.location().directory, "artifacts/report.json"));
  });

  it("AC2: throws NO_POINTER when the pointer file is absent", () => {
    tmp = createTmpDir("sennel-report-show-no-ptr-");
    assert.throws(
      () => CanonicalLatestReport.read({ mainRoot: tmp }),
      (err) => err.code === "NO_POINTER" && /pointer not found/.test(err.message),
    );
  });

  it("AC2: throws EMPTY_POINTER when the pointer file is empty", () => {
    tmp = createTmpDir("sennel-report-show-empty-ptr-");
    writeFile(tmp, POINTER_REL_PATH, "   \n");
    assert.throws(
      () => CanonicalLatestReport.read({ mainRoot: tmp }),
      (err) => err.code === "EMPTY_POINTER",
    );
  });

  it("AC3: throws NO_REPORT when pointer exists but report.json is missing", () => {
    scenario = seed.createScenario(null);
    assert.throws(
      () => CanonicalLatestReport.read({
        mainRoot: scenario.workRoot.root,
        specRoot: "specs",
        flowManager: scenario.flowManager,
      }),
      (err) => err.code === "NO_REPORT" && /cataloged report is unavailable/.test(err.message),
    );
  });

  it("throws PARSE_ERROR when the cataloged report bytes are invalid JSON", () => {
    scenario = seed.createScenario(Buffer.from("{ not json"));
    const report = CanonicalLatestReport.read({
      mainRoot: scenario.workRoot.root,
      specRoot: "specs",
      flowManager: scenario.flowManager,
    });
    assert.throws(
      () => report.text(),
      (err) => err.code === "PARSE_ERROR",
    );
  });

  it("throws NO_TEXT when the cataloged report has no text field", () => {
    scenario = seed.createScenario({ data: {} });
    const report = CanonicalLatestReport.read({
      mainRoot: scenario.workRoot.root,
      specRoot: "specs",
      flowManager: scenario.flowManager,
    });
    assert.throws(
      () => report.text(),
      (err) => err.code === "NO_TEXT",
    );
  });
});
