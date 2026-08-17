// spec: R1 R2 R3 R4 R5 R6 R7
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, test } from "node:test";

import RunReportCommand from "../../../src/flow/lib/run-report.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { captureRepairBaseline } from "../../../src/flow/lib/repair-state-identity.js";
import { FlowOutbox, finalizationOutboxIdentity } from "../../../src/flow/lib/flow-outbox.js";
import { checkoutNewBranch, commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";
import { makeFlowManager, setupFlow } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";

const roots = [];

afterEach(() => {
  while (roots.length > 0) removeTmpDir(roots.pop());
});

function setupReportRoot({ issue = null } = {}) {
  const root = createTmpDir("report-delivery-fail-closed-");
  roots.push(root);
  initGitRepo(root);
  writeFile(root, "README.md", "baseline\n");
  commitAll(root, "test: baseline");
  checkoutNewBranch(root, "feature/report-delivery");
  const repairBaseline = captureRepairBaseline({ root, baseRef: "main", runId: "report-delivery-run" });
  const state = setupFlow(root, {
    issue,
    repairBaseline: repairBaseline.toJSON(),
    runId: "report-delivery-run",
  });
  writeFile(root, state.spec, JSON.stringify({ requirements: [] }, null, 2));
  writeFile(root, path.join(path.dirname(state.spec), "issue-log.json"), JSON.stringify({ entries: [] }));
  writeFile(root, "implementation.js", "export const delivered = false;\n");
  return { root, state, flowManager: makeFlowManager(root) };
}

function reportPath(root, state) {
  return path.join(root, path.dirname(state.spec), "report.json");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function stepStatus(steps, id) {
  for (const step of steps || []) {
    if (step.id === id) return step.status;
    const nested = stepStatus(step.children, id);
    if (nested != null) return nested;
  }
  return null;
}

function installGh(root, { failComment = false } = {}) {
  const bin = path.join(root, "bin");
  const marker = path.join(root, "comment-marker");
  const log = path.join(root, "gh.log");
  writeFile(root, "bin/gh", [
    "#!/bin/sh",
    "if [ \"$1\" = \"--version\" ]; then exit 0; fi",
    `if [ \"$2\" = \"view\" ]; then test -f \"${marker}\" && cat \"${marker}\"; exit 0; fi`,
    `if [ \"$2\" = \"comment\" ]; then printf '%s\\n' \"$@\" >> \"${log}\"; ${failComment ? "exit 1" : `echo \"<!-- senti:\${SENTI_TEST_OUTBOX_KEY} -->\" > \"${marker}\"; exit 0`}; fi`,
    "exit 1",
    "",
  ].join("\n"));
  fs.chmodSync(path.join(bin, "gh"), 0o755);
  return { bin, log };
}

function installUnavailableGh(root) {
  const bin = path.join(root, "bin");
  writeFile(root, "bin/gh", "#!/bin/sh\nexit 1\n");
  fs.chmodSync(path.join(bin, "gh"), 0o755);
  return bin;
}

describe("report delivery fail-closed and freshness binding", () => {
  test("R1: missing issue-log rejects report generation", async () => {
    const { root, state, flowManager } = setupReportRoot();
    fs.rmSync(path.join(root, path.dirname(state.spec), "issue-log.json"));

    await assert.rejects(
      new RunReportCommand().execute({ root, flowState: state, flowManager }),
      /required issue-log|missing/i,
    );
    assert.equal(fs.existsSync(reportPath(root, state)), false);
  });

  test("R1: corrupt issue-log rejects report generation instead of treating it as empty", async () => {
    const { root, state, flowManager } = setupReportRoot();
    writeFile(root, path.join(path.dirname(state.spec), "issue-log.json"), "{ not json");

    await assert.rejects(
      new RunReportCommand().execute({ root, flowState: state, flowManager }),
      /issue-log|JSON|invalid/i,
    );
    assert.equal(fs.existsSync(reportPath(root, state)), false);
  });

  test("R1: structurally invalid issue-log rejects report generation", async () => {
    const { root, state, flowManager } = setupReportRoot();
    writeFile(root, path.join(path.dirname(state.spec), "issue-log.json"), JSON.stringify({ entries: {} }));

    await assert.rejects(
      new RunReportCommand().execute({ root, flowState: state, flowManager }),
      /issue-log|entries|invalid/i,
    );
    assert.equal(fs.existsSync(reportPath(root, state)), false);
  });

  test("R1: unreadable issue-log rejects report generation without a report artifact", async () => {
    const { root, state, flowManager } = setupReportRoot();
    const issueLog = path.join(root, path.dirname(state.spec), "issue-log.json");
    fs.rmSync(issueLog);
    fs.mkdirSync(issueLog);

    await assert.rejects(
      new RunReportCommand().execute({ root, flowState: state, flowManager }),
      /issue-log|directory|read/i,
    );
    assert.equal(fs.existsSync(reportPath(root, state)), false);
  });

  test("R1: malformed present retro artifact rejects report generation", async () => {
    const { root, state, flowManager } = setupReportRoot();
    writeFile(root, path.join(path.dirname(state.spec), "retro.json"), "{ not json");

    await assert.rejects(
      new RunReportCommand().execute({ root, flowState: state, flowManager }),
      /retro|parse|JSON/i,
    );
    assert.equal(fs.existsSync(reportPath(root, state)), false);
  });

  test("R1: malformed required test-execute evidence rejects report generation", async () => {
    const { root, state, flowManager } = setupReportRoot();
    writeFile(root, path.join(path.dirname(state.spec), "test-execute-result.json"), "{ not json");

    await assert.rejects(
      new RunReportCommand().execute({ root, flowState: state, flowManager }),
      /test-execute|parse|JSON/i,
    );
    assert.equal(fs.existsSync(reportPath(root, state)), false);
  });

  test("R2: no linked Issue retains successful report artifact generation", async () => {
    const { root, state, flowManager } = setupReportRoot();

    const result = await new RunReportCommand().execute({ root, flowState: state, flowManager });

    assert.equal(result.result, "ok");
    assert.equal(result.artifacts.issueComment.status, "skipped");
    assert.equal(fs.existsSync(reportPath(root, state)), true);
  });

  test("R2: linked Issue delivery unavailability rejects report completion", async () => {
    const { root, state, flowManager } = setupReportRoot({ issue: 470 });
    const originalPath = process.env.PATH;
    process.env.PATH = `${installUnavailableGh(root)}:${originalPath}`;
    try {
      await assert.rejects(
        new RunReportCommand().execute({ root, flowState: state, flowManager }),
        /gh|delivery|issue/i,
      );
      assert.notEqual(stepStatus(flowManager.load().steps, "report"), "done");
    } finally {
      process.env.PATH = originalPath;
    }
  });

  test("R2: reachable gh with a failed comment rejects report completion", async () => {
    const { root, state, flowManager } = setupReportRoot({ issue: 470 });
    const { bin } = installGh(root, { failComment: true });
    const originalPath = process.env.PATH;
    process.env.PATH = `${bin}:${originalPath}`;
    try {
      await assert.rejects(
        new RunReportCommand().execute({ root, flowState: state, flowManager, flowOutboxEntry: { idempotencyKey: "report-failure" } }),
        /post report|delivery|issue/i,
      );
      assert.notEqual(stepStatus(flowManager.load().steps, "report"), "done");
      const report = JSON.parse(fs.readFileSync(reportPath(root, state), "utf8"));
      assert.match(report.data.delivery.status, /^(unsent|pending)$/);
    } finally {
      process.env.PATH = originalPath;
    }
  });

  test("R3: failed delivery persists an explicit unsent or pending report state", async () => {
    const { root, state, flowManager } = setupReportRoot({ issue: 470 });
    const originalPath = process.env.PATH;
    process.env.PATH = `${installUnavailableGh(root)}:${originalPath}`;
    try {
      await assert.rejects(new RunReportCommand().execute({ root, flowState: state, flowManager }));
    } finally {
      process.env.PATH = originalPath;
    }

    const report = JSON.parse(fs.readFileSync(reportPath(root, state), "utf8"));
    assert.match(report.data.delivery.status, /^(unsent|pending)$/);
  });

  test("R4: resumed outbox delivery reuses the report binding and idempotency key", async () => {
    const { root, state, flowManager } = setupReportRoot({ issue: 470 });
    const identity = finalizationOutboxIdentity(state, "report");
    const entry = new FlowOutbox().begin(identity, "2026-07-25T00:00:00.000Z");
    const originalPath = process.env.PATH;
    const previousKey = process.env.SENTI_TEST_OUTBOX_KEY;
    process.env.SENTI_TEST_OUTBOX_KEY = entry.idempotencyKey;
    process.env.PATH = `${installUnavailableGh(root)}:${originalPath}`;
    try {
      await assert.rejects(new RunReportCommand().execute({ root, flowState: state, flowManager, flowOutboxEntry: entry }));
    } finally {
      process.env.PATH = originalPath;
    }

    const firstReport = JSON.parse(fs.readFileSync(reportPath(root, state), "utf8"));
    const { bin, log } = installGh(root);
    process.env.PATH = `${bin}:${originalPath}`;
    const resumed = await new RunReportCommand().resumeDelivery({
      root,
      flowState: state,
      flowManager,
      flowOutboxEntry: entry,
    });
    assert.equal(resumed.issueComment.idempotencyKey, entry.idempotencyKey);
    assert.match(fs.readFileSync(log, "utf8"), /issue\s+comment/);
    const deliveredReport = JSON.parse(fs.readFileSync(reportPath(root, state), "utf8"));
    assert.equal(deliveredReport.text, firstReport.text);
    assert.deepEqual(deliveredReport.data.binding, firstReport.data.binding);
    assert.equal(deliveredReport.data.delivery.status, "done");
    await new RunReportCommand().resumeDelivery({ root, flowState: state, flowManager, flowOutboxEntry: entry });
    assert.equal((fs.readFileSync(log, "utf8").match(/issue\s+comment/g) || []).length, 1);
    process.env.PATH = originalPath;
    if (previousKey === undefined) delete process.env.SENTI_TEST_OUTBOX_KEY;
    else process.env.SENTI_TEST_OUTBOX_KEY = previousKey;
  });

  test("R5: report records target and consumed-source binding hashes", async () => {
    const { root, state, flowManager } = setupReportRoot();
    const issueLog = path.join(path.dirname(state.spec), "issue-log.json");
    const retro = path.join(path.dirname(state.spec), "retro.json");
    const testExecute = path.join(path.dirname(state.spec), "test-execute-result.json");
    const testReview = path.join(path.dirname(state.spec), "test-result-review.json");
    const finalRegression = path.join(path.dirname(state.spec), "final-regression-result.json");
    const upgrade = path.join(path.dirname(state.spec), "upgrade-result.json");
    const upgradeLog = path.join(path.dirname(state.spec), "upgrade.log");
    writeFile(root, issueLog, JSON.stringify({ entries: [] }));
    writeFile(root, retro, JSON.stringify({ summary: { passed: 1 }, requirements: [] }));
    writeFile(root, testExecute, JSON.stringify({
      version: "2",
      raw_output_path: `${path.dirname(state.spec)}/tests/.raw/test-execution.log`,
      summary: [],
      regression: {
        required: false,
        changed_files: [],
        trigger_relevant_changed_files: [],
        category: "spec-artifact-only",
        reason: "binding fixture",
        classified_paths: [],
      },
    }));
    writeFile(root, testReview, JSON.stringify({
      verdict: "pass",
      checked_items: [{ check: "project_regression_verification", result: "pass", detail: "binding fixture" }],
    }));
    writeFile(root, finalRegression, JSON.stringify({
      version: "1",
      completed: true,
      result: "pass",
      failureKind: null,
      command: "node --test",
      commandSource: "fixture",
      rawOutputPath: `${path.dirname(state.spec)}/tests/.raw/final-regression.log`,
      rawOutputLines: { start_line: 1, end_line: 1 },
      process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
      childProcesses: [],
      changedFiles: [],
      changedFileFingerprints: [],
      retryable: false,
      nextAction: "report",
    }));
    writeFile(root, upgradeLog, "binding fixture\n");
    writeFile(root, upgrade, JSON.stringify({
      version: 1,
      command: "senti upgrade",
      dryRun: false,
      exitCode: 0,
      result: "success-no-change",
      summary: {},
      checkedPaths: [],
      rawLogPath: "upgrade.log",
    }));
    const repairFingerprint = buildRepairFingerprint({ root, specPath: state.spec, state }).hash;
    for (const artifactPath of [retro, testExecute, testReview]) {
      const artifact = JSON.parse(fs.readFileSync(path.join(root, artifactPath), "utf8"));
      writeFile(root, artifactPath, JSON.stringify({ ...artifact, repairFingerprint }));
    }
    await new RunReportCommand().execute({ root, flowState: state, flowManager });

    const binding = JSON.parse(fs.readFileSync(reportPath(root, state), "utf8")).data.binding;
    assert.match(binding.headOid, /^[0-9a-f]{40,64}$/);
    assert.match(binding.treeSha, /^[0-9a-f]{40,64}$/);
    assert.deepEqual(binding.sourceArtifacts, [issueLog, retro, testExecute, testReview, finalRegression, upgrade].map((sourcePath) => ({
      path: sourcePath,
      sha256: sha256(fs.readFileSync(path.join(root, sourcePath))),
    })));
  });

  test("R5: absent optional artifacts are omitted from the source binding", async () => {
    const { root, state, flowManager } = setupReportRoot();
    const issueLog = path.join(path.dirname(state.spec), "issue-log.json");
    writeFile(root, issueLog, JSON.stringify({ entries: [] }));

    await new RunReportCommand().execute({ root, flowState: state, flowManager });

    assert.deepEqual(JSON.parse(fs.readFileSync(reportPath(root, state), "utf8")).data.binding.sourceArtifacts, [{
      path: issueLog,
      sha256: sha256(fs.readFileSync(path.join(root, issueLog))),
    }]);
  });

  test("R6: stale or malformed binding is rejected with stable report binding codes", () => {
    const { root, state } = setupReportRoot();
    const issueLog = path.join(path.dirname(state.spec), "issue-log.json");
    writeFile(root, issueLog, JSON.stringify({ entries: [] }));
    const validBinding = {
      headOid: "0".repeat(40),
      treeSha: "1".repeat(40),
      sourceArtifacts: [{
        path: issueLog,
        sha256: sha256(fs.readFileSync(path.join(root, issueLog))),
      }],
    };

    assert.doesNotThrow(() => RunReportCommand.validateBinding(validBinding, {
      root,
      current: { headOid: validBinding.headOid, treeSha: validBinding.treeSha },
    }));
    assert.doesNotThrow(() => RunReportCommand.validateFinalEvidence({ data: { binding: validBinding } }, {
      root,
      current: { headOid: validBinding.headOid, treeSha: validBinding.treeSha },
    }));
    assert.throws(
      () => RunReportCommand.validateBinding({ headOid: "bad", treeSha: "bad", sourceArtifacts: [] }, { root }),
      /REPORT_BINDING_INVALID/,
    );
    assert.throws(
      () => RunReportCommand.validateBinding(undefined, { root }),
      /REPORT_BINDING_INVALID/,
    );
    assert.throws(
      () => RunReportCommand.validateBinding(validBinding, { root, current: { headOid: "2".repeat(40), treeSha: validBinding.treeSha } }),
      /REPORT_BINDING_STALE/,
    );
    assert.throws(
      () => RunReportCommand.validateBinding(validBinding, { root, current: { headOid: validBinding.headOid, treeSha: "3".repeat(40) } }),
      /REPORT_BINDING_STALE/,
    );
    writeFile(root, issueLog, JSON.stringify({ entries: [{ step: "report", reason: "changed report source" }] }));
    assert.throws(
      () => RunReportCommand.validateBinding(validBinding, { root, current: { headOid: validBinding.headOid, treeSha: validBinding.treeSha } }),
      /REPORT_BINDING_STALE/,
    );
  });

  test("R6: final report evidence validation rejects invalid and stale bindings", () => {
    const { root, state } = setupReportRoot();
    const issueLog = path.join(path.dirname(state.spec), "issue-log.json");
    writeFile(root, issueLog, JSON.stringify({ entries: [] }));
    const binding = {
      headOid: "4".repeat(40),
      treeSha: "5".repeat(40),
      sourceArtifacts: [{
        path: issueLog,
        sha256: sha256(fs.readFileSync(path.join(root, issueLog))),
      }],
    };

    assert.throws(
      () => RunReportCommand.validateFinalEvidence({ data: {} }, { root, current: binding }),
      /REPORT_BINDING_INVALID/,
    );
    assert.throws(
      () => RunReportCommand.validateFinalEvidence({ data: { binding } }, {
        root,
        current: { ...binding, treeSha: "6".repeat(40) },
      }),
      /REPORT_BINDING_STALE/,
    );
  });

  test("R7: existing report content remains while delivery and binding are additive", async () => {
    const { root, state, flowManager } = setupReportRoot({ issue: 470 });
    state.tasks = [{ id: "T-1", status: "pending" }];
    writeFile(root, path.join(path.dirname(state.spec), "issue-log.json"), JSON.stringify({ entries: [{ step: "report", reason: "report issue log entry" }] }));
    const { bin, log } = installGh(root);
    const originalPath = process.env.PATH;
    const previousKey = process.env.SENTI_TEST_OUTBOX_KEY;
    process.env.SENTI_TEST_OUTBOX_KEY = "report-success";
    process.env.PATH = `${bin}:${originalPath}`;
    const result = await new RunReportCommand().execute({ root, flowState: state, flowManager, flowOutboxEntry: { idempotencyKey: "report-success" } });

    const report = JSON.parse(fs.readFileSync(reportPath(root, state), "utf8"));
    for (const key of ["implementation", "retro", "upgrade", "issueLog", "metrics", "tokenMetrics", "tests", "sync", "tasks", "taskTotal", "broadModeHistory", "binding", "delivery"]) {
      assert.ok(Object.hasOwn(report.data, key), `report.data.${key} must be retained or added`);
    }
    for (const section of ["Report", "Implementation", "Retro", "Metrics", "Tests", "Tasks", "Issue Log Summary"]) {
      assert.match(report.text, new RegExp(section));
    }
    assert.equal(result.artifacts.issueComment.status, "done");
    assert.match(fs.readFileSync(log, "utf8"), /issue\s+comment/);
    process.env.PATH = originalPath;
    if (previousKey === undefined) delete process.env.SENTI_TEST_OUTBOX_KEY;
    else process.env.SENTI_TEST_OUTBOX_KEY = previousKey;
  });
});
