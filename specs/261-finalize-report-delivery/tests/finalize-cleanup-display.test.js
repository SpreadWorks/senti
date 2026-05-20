// spec: R1 R2 R3
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Container } from "../../../src/lib/container.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { RunFinalizeCleanupCommand } from "../../../src/flow/lib/run-finalize-cleanup.js";
import RunReportShowCommand from "../../../src/flow/lib/run-report-show.js";
import { captureProcessStdout } from "./helpers/process-stream.js";

const SPEC_REL_PATH = path.join("specs", "261-finalize-report-delivery", "spec.json");

function makeContainer(mainRoot) {
  const container = new Container();
  const flowState = {
    spec: SPEC_REL_PATH,
    baseBranch: "main",
    featureBranch: "main",
    worktree: false,
  };
  container.register("config", {});
  container.register("root", mainRoot);
  container.register("mainRoot", mainRoot);
  container.register("inWorktree", false);
  container.register("paths", {
    root: mainRoot,
    agentWorkDir: path.join(mainRoot, ".sdd-forge", "agent-work"),
    logDir: path.join(mainRoot, ".sdd-forge", "agent-work", "logs"),
  });
  container.register("flowManager", {
    load: () => flowState,
    resolveWorktreePaths: () => ({ worktreePath: null, mainRepoPath: mainRoot }),
    clearFlowState: () => {},
  });
  return container;
}

async function runFinalizeCleanupCommand(mainRoot) {
  const stdout = [];
  const stderr = [];
  const exitCodes = [];
  await dispatch({
    container: makeContainer(mainRoot),
    entry: { command: async () => ({ default: RunFinalizeCleanupCommand }) },
    argv: [],
    envelopeType: "run",
    envelopeKey: "finalize-cleanup",
    stdout: (s) => stdout.push(s),
    stderr: (s) => stderr.push(s),
    setExitCode: (code) => exitCodes.push(code),
  });
  return {
    stdout: stdout.join(""),
    stderr: stderr.join(""),
    exitCode: exitCodes.at(-1),
  };
}

async function runReportShowCommand(mainRoot) {
  return captureProcessStdout(async () => {
    await dispatch({
      container: makeContainer(mainRoot),
      entry: { command: async () => ({ default: RunReportShowCommand }), requiresFlow: false },
      argv: [],
      envelopeType: "report",
      envelopeKey: "show",
    });
  });
}

function makeReportFixture(reportText, { writeReport = true } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-cleanup-report-"));
  const mainRoot = path.join(tmp, "main");
  const specDir = path.join(mainRoot, "specs", "261-finalize-report-delivery");
  fs.mkdirSync(path.join(mainRoot, ".sdd-forge"), { recursive: true });
  fs.mkdirSync(specDir, { recursive: true });

  const reportPath = path.join(specDir, "report.json");
  fs.writeFileSync(path.join(mainRoot, ".sdd-forge", "last-finalized-spec"), `${SPEC_REL_PATH}\n`);
  if (writeReport) {
    fs.writeFileSync(reportPath, JSON.stringify({ text: reportText }, null, 2));
  }
  return { tmp, mainRoot, reportPath };
}

function extractDisplayedReportText(stderr) {
  const marker = "Finalize Report\n";
  const idx = stderr.indexOf(marker);
  assert.notEqual(idx, -1, "stderr must contain a Finalize Report block");
  return stderr.slice(idx + marker.length);
}

describe("finalize-cleanup Report display contract", () => {
  it("R1: writes one JSON envelope to stdout and the Report block to stderr", async () => {
    const fixture = makeReportFixture("Report line 1\nReport line 2\n");
    try {
      const result = await runFinalizeCleanupCommand(fixture.mainRoot);

      const parsed = JSON.parse(result.stdout);
      assert.equal(result.exitCode, 0);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.data.report.text, "Report line 1\nReport line 2\n");
      assert.doesNotMatch(result.stdout, /Finalize Report/);
      assert.match(result.stderr, /Finalize Report/);
      assert.match(result.stderr, /Report line 1\nReport line 2/);
    } finally {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    }
  });

  it("R2: displays the exact report-show text for the finalized report", async () => {
    const fixture = makeReportFixture("alpha\n\nbeta: 42\n");
    try {
      const result = await runFinalizeCleanupCommand(fixture.mainRoot);
      const reportShowText = await runReportShowCommand(fixture.mainRoot);

      assert.equal(extractDisplayedReportText(result.stderr), reportShowText);
    } finally {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    }
  });

  it("R3: REPORT_MISSING emits a visible warning and no fabricated Report block", async () => {
    const fixture = makeReportFixture("", { writeReport: false });
    try {
      const result = await runFinalizeCleanupCommand(fixture.mainRoot);
      const parsed = JSON.parse(result.stdout);
      assert.equal(result.exitCode, 0);
      assert.equal(parsed.ok, true);
      assert.equal(parsed.data.report, null);
      assert.match(JSON.stringify(parsed.errors), /REPORT_MISSING/);
      assert.match(result.stderr, /REPORT_MISSING/);
      assert.match(result.stderr, /report\.json not found/);
      assert.doesNotMatch(result.stderr, /Finalize Report/);
    } finally {
      fs.rmSync(fixture.tmp, { recursive: true, force: true });
    }
  });
});
