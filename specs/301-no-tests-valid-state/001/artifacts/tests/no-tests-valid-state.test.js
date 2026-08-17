// spec: R1 R2 R3 R4 R5 R6 R7
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import RunTestExecuteCommand from "../../../src/flow/lib/run-test-execute.js";
import RunTestResultReviewCommand from "../../../src/flow/lib/run-test-result-review.js";
import { RunReportCommand } from "../../../src/flow/lib/run-report.js";
import { RunRetroCommand } from "../../../src/flow/lib/run-retro.js";
import { commitDurableFinalizeArtifacts } from "../../../src/flow/lib/run-finalize.js";
import { validateAcceptanceReviewArtifact } from "../../../src/flow/lib/acceptance-review-artifacts.js";
import { buildRepairFingerprint, stampRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { sentiOutputDir } from "../../../src/lib/config.js";
import { container } from "../../../src/lib/container.js";
import {
  createAcceptanceReviewFixture,
  runAcceptanceReviewFixture,
} from "../../../tests/helpers/acceptance-review-fixture.js";
import {
  buildTestResultsFromArtifacts,
  durableTestArtifactPathspecs,
  validateIntegrationArtifactTrust,
  validateFinalRegressionResult,
  validateSummaryEvidence,
  validateTestExecuteResultV2,
} from "../../../src/flow/lib/test-artifacts.js";

const SPEC_ID = "301-no-tests-valid-state";
const SPEC_DIR = `specs/${SPEC_ID}`;
const RAW_LOG = `${SPEC_DIR}/tests/.raw/test-execution.log`;

function createTmpRepo(prefix = "no-tests-flow-") {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  fs.mkdirSync(sentiOutputDir(tmp), { recursive: true });
  fs.writeFileSync(path.join(sentiOutputDir(tmp), "analysis.json"), JSON.stringify({ files: [] }, null, 2));
  execFileSync("git", ["init", "-b", "main"], { cwd: tmp, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "t@example.test"], { cwd: tmp, stdio: "ignore" });
  execFileSync("git", ["config", "user.name", "test"], { cwd: tmp, stdio: "ignore" });
  return tmp;
}

function commitAll(tmp, message = "init") {
  execFileSync("git", ["add", "."], { cwd: tmp, stdio: "ignore" });
  execFileSync("git", ["commit", "--allow-empty", "-m", message], { cwd: tmp, stdio: "ignore" });
}

function checkoutFeature(tmp) {
  execFileSync("git", ["checkout", "-b", "feature/no-tests"], { cwd: tmp, stdio: "ignore" });
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeSpec(tmp, requirements = [{ id: "R1", desc: "first behavior", priority: "must", status: "pending" }]) {
  const specDir = path.join(tmp, SPEC_DIR);
  fs.mkdirSync(specDir, { recursive: true });
  writeJson(path.join(specDir, "spec.json"), {
    goal: "test no tests state",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements,
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  });
  fs.writeFileSync(path.join(specDir, "spec.md"), "# Spec\n");
  return specDir;
}

function noTestsSummary(id = "R1") {
  return {
    id,
    result: "not_applicable",
    reason: "no_tests_declared",
    evidence: {
      command: "node --test",
      raw_output_lines: { start_line: 1, end_line: 4 },
    },
  };
}

function noTestsTestExecuteArtifact() {
  return {
    version: "2",
    raw_output_path: RAW_LOG,
    summary: [noTestsSummary()],
    regression: {
      required: false,
      result: "skipped",
      mode: "none",
      category: "project-regression-skipped",
      reason: "full project regression deferred to final-regression",
      classified_paths: [],
      changed_files: [],
      trigger_relevant_changed_files: [],
    },
  };
}

function writeNoTestsArtifacts(specDir, { root, review = true, finalRegression = false } = {}) {
  fs.mkdirSync(path.join(specDir, "tests", ".raw"), { recursive: true });
  fs.writeFileSync(path.join(specDir, "tests", ".raw", "test-execution.log"), [
    "[senti] spec-local tests start",
    "command: node --test",
    "[senti] requirement R1 result not_applicable reason no_tests_declared",
    "[senti] spec-local tests end",
    "",
  ].join("\n"));
  const fingerprint = buildRepairFingerprint({ root, specPath: `${SPEC_DIR}/spec.json`, state: flowState() });
  writeJson(path.join(specDir, "test-execute-result.json"), stampRepairFingerprint({
    artifact: noTestsTestExecuteArtifact(),
    fingerprint,
  }));
  writeJson(path.join(specDir, "file-map.json"), {
    R1: [`${SPEC_DIR}/spec.json`],
  });
  if (review) {
    writeJson(path.join(specDir, "test-result-review.json"), stampRepairFingerprint({
      fingerprint,
      artifact: {
      verdict: "pass",
      checked_items: [
        { check: "summary_evidence", result: "pass", detail: "no-tests summary is valid" },
        { check: "project_regression_verification", result: "pass", detail: "skipped regression is valid" },
      ],
      result_file_path: `${SPEC_DIR}/test-execute-result.json`,
      raw_output_path: RAW_LOG,
      },
    }));
  }
  if (finalRegression) {
    writeJson(path.join(specDir, "final-regression-result.json"), skippedByProjectPolicyArtifact());
  }
}

function skippedByProjectPolicyArtifact() {
  return {
    version: "1",
    completed: true,
    result: "skipped",
    failureKind: null,
    skipKind: "skipped_by_project_policy",
    reason: "no supported project regression command source was found",
    command: null,
    commandSource: null,
    rawOutputPath: `${SPEC_DIR}/tests/.raw/final-regression-attempt-001.log`,
    rawOutputLines: { start: 1, end: 6 },
    process: {
      started: false,
      exitCode: null,
      signal: null,
      timedOut: false,
      spawnError: null,
    },
    childProcesses: [],
    changedFiles: [],
    changedFileFingerprints: [],
    retryable: false,
    nextAction: "report",
    proof: {
      kind: "skipped_by_project_policy",
      commandDiscovery: {
        checkedSources: ["config.test.command", "package.json scripts.test", "composer.json scripts.test", "Makefile test"],
        supportedCommandFound: false,
        invalidConfiguredCommand: false,
        reason: "no supported project regression command source was found",
      },
    },
  };
}

function flowState() {
  return {
    spec: `${SPEC_DIR}/spec.json`,
    baseBranch: "main",
    featureBranch: "feature/no-tests",
  };
}

function assertFailureIsNotNoTestsSkip(artifact) {
  assert.equal(artifact.result, "fail");
  assert.notEqual(artifact.skipKind, "skipped_by_project_policy");
  assert.notEqual(artifact.result, "skipped");
}

async function assertReviewDoesNotPass(tmp, specDir) {
  try {
    const out = await new RunTestResultReviewCommand().execute({ root: tmp, flowState: flowState() });
    assert.notEqual(out.result, "ok");
  } catch (err) {
    assert.match(err.message, /summary|raw|artifact|not_applicable|no_tests_declared|membership/i);
    return;
  }
  const reviewPath = path.join(specDir, "test-result-review.json");
  if (fs.existsSync(reviewPath)) {
    const review = readJson(reviewPath);
    assert.notEqual(review.verdict, "pass");
  }
}

async function withTmpRepo(fn) {
  const tmp = createTmpRepo();
  try {
    return await fn(tmp);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("R1: test-execute writes not_applicable entries for testable requirements when no spec tests exist", async () => {
  await withTmpRepo(async (tmp) => {
    writeSpec(tmp, [
      { id: "R1", desc: "first behavior", priority: "must", status: "pending" },
      { id: "R2", desc: "second behavior", priority: "must", status: "pending" },
    ]);
    commitAll(tmp);
    checkoutFeature(tmp);
    container.set("config", { test: { testExecuteRegression: "skip" } });

    const out = await new RunTestExecuteCommand().execute({ root: tmp, flowState: flowState() });

    assert.equal(out.result, "ok");
    const artifact = readJson(path.join(tmp, SPEC_DIR, "test-execute-result.json"));
    assert.deepEqual(artifact.summary.map((entry) => [entry.id, entry.result, entry.reason]), [
      ["R1", "not_applicable", "no_tests_declared"],
      ["R2", "not_applicable", "no_tests_declared"],
    ]);
    assert.ok(artifact.summary.every((entry) => !entry.evidence.test_file || !entry.evidence.test_file.includes("missing.test.js")));
  });
});

test("R2: validators accept valid not_applicable evidence and reject malformed no-tests entries", () => {
  const artifact = noTestsTestExecuteArtifact();
  assert.doesNotThrow(() => validateTestExecuteResultV2(artifact));
  assert.doesNotThrow(() => validateSummaryEvidence(artifact.summary, {
    root: process.cwd(),
    rawLines: [
      "[senti] spec-local tests start",
      "command: node --test",
      "[senti] requirement R1 result not_applicable reason no_tests_declared",
      "[senti] spec-local tests end",
    ],
    requirements: [{ id: "R1" }],
  }));

  const missingReason = structuredClone(artifact);
  delete missingReason.summary[0].reason;
  assert.throws(() => validateTestExecuteResultV2(missingReason), /reason/i);

  const malformedRange = structuredClone(artifact);
  malformedRange.summary[0].evidence.raw_output_lines = { start_line: 4, end_line: 1 };
  assert.throws(() => validateTestExecuteResultV2(malformedRange), /raw_output_lines/i);

  assert.throws(() => validateSummaryEvidence(artifact.summary, {
    root: process.cwd(),
    rawLines: [
      "[senti] spec-local tests start",
      "command: node --test",
      "[senti] spec-local tests end",
    ],
    requirements: [{ id: "R1" }],
  }), /raw|reason|no_tests_declared|not_applicable/i);
});

test("R3: test-result-review writes pass verdict for a complete no-tests artifact", async () => {
  await withTmpRepo(async (tmp) => {
    const specDir = writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);
    writeNoTestsArtifacts(specDir, { root: tmp, review: false });

    const out = await new RunTestResultReviewCommand().execute({ root: tmp, flowState: flowState() });

    assert.equal(out.result, "ok");
    const review = readJson(path.join(specDir, "test-result-review.json"));
    assert.equal(review.verdict, "pass");
    assert.ok(review.checked_items.some((item) => item.check === "summary_evidence" && item.result === "pass"));
    assert.ok(review.checked_items.some((item) => item.check === "raw_output_lines" && item.result === "pass"));
    assert.ok(review.checked_items.some((item) => item.check === "project_regression_verification" && item.result === "pass"));
  });

  await withTmpRepo(async (tmp) => {
    const specDir = writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);
    writeNoTestsArtifacts(specDir, { root: tmp, review: false });
    const artifact = readJson(path.join(specDir, "test-execute-result.json"));
    artifact.summary[0].id = "R999";
    writeJson(path.join(specDir, "test-execute-result.json"), artifact);
    await assertReviewDoesNotPass(tmp, specDir);
  });

  await withTmpRepo(async (tmp) => {
    const specDir = writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);
    writeNoTestsArtifacts(specDir, { root: tmp, review: false });
    fs.writeFileSync(path.join(specDir, "tests", ".raw", "test-execution.log"), [
      "[senti] spec-local tests start",
      "command: node --test",
      "[senti] spec-local tests end",
      "",
    ].join("\n"));
    await assertReviewDoesNotPass(tmp, specDir);
  });

  await withTmpRepo(async (tmp) => {
    const specDir = writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);
    writeNoTestsArtifacts(specDir, { root: tmp, review: false });
    const artifact = readJson(path.join(specDir, "test-execute-result.json"));
    artifact.regression = {
      required: true,
      result: "pass",
      mode: "full",
      changed_files: [],
      trigger_relevant_changed_files: [],
    };
    writeJson(path.join(specDir, "test-execute-result.json"), artifact);
    await assertReviewDoesNotPass(tmp, specDir);
  });
});

test("R4: retro aggregates not_applicable separately from not_done", async () => {
  await withTmpRepo(async (tmp) => {
    const specDir = writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);
    writeNoTestsArtifacts(specDir, { root: tmp });

    const out = await new RunRetroCommand().execute({ root: tmp, flowState: flowState(), dryRun: true });

    assert.equal(out.artifacts.summary.not_applicable_count, 1);
    assert.equal(out.artifacts.summary.not_done, 0);
    assert.equal(out.artifacts.requirements[0].status, "not_applicable");
  });
});

test("R5: final-regression skips only when no supported command source exists and keeps invalid config as failure", async () => {
  await withTmpRepo(async (tmp) => {
    writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);

    const skipped = await new RunFinalRegressionCommand().execute({ root: tmp, flowState: flowState(), config: {} });
    assert.equal(skipped.result, "skipped");
    const artifact = readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json"));
    assert.equal(artifact.completed, true);
    assert.equal(artifact.nextAction, "report");
    assert.equal(artifact.command, null);
    assert.equal(artifact.commandSource, null);
    assert.equal(artifact.process.started, false);
    assert.equal(artifact.rawOutputPath, `${SPEC_DIR}/tests/.raw/final-regression-attempt-001.log`);
    assert.deepEqual(artifact.rawOutputLines, { start: 1, end: 6 });
    assert.equal(artifact.skipKind, "skipped_by_project_policy");
    assert.equal(artifact.proof.commandDiscovery.supportedCommandFound, false);
    assert.equal(artifact.proof.commandDiscovery.invalidConfiguredCommand, false);
    assert.ok(fs.existsSync(path.join(tmp, SPEC_DIR, "tests", ".raw", "final-regression-attempt-001.log")));
  });

  await withTmpRepo(async (tmp) => {
    writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);

    const failed = await new RunFinalRegressionCommand().execute({
      root: tmp,
      flowState: flowState(),
      config: { test: { command: "npm test | cat" } },
    });
    assert.equal(failed.ok, false);
    const artifact = readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json"));
    assert.equal(artifact.result, "fail");
    assert.equal(artifact.failureKind, "invalid_project_test");
    assert.notEqual(artifact.skipKind, "skipped_by_project_policy");
  });

  await withTmpRepo(async (tmp) => {
    writeSpec(tmp);
    fs.writeFileSync(path.join(tmp, "package.json"), "{ invalid json\n");
    commitAll(tmp);
    checkoutFeature(tmp);

    const failed = await new RunFinalRegressionCommand().execute({
      root: tmp,
      flowState: flowState(),
      config: {},
    });
    assert.equal(failed.ok, false);
    const artifact = readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json"));
    assert.equal(artifact.result, "fail");
    assert.equal(artifact.failureKind, "invalid_project_test");
    assert.notEqual(artifact.skipKind, "skipped_by_project_policy");
  });
});

test("R6: downstream artifact loading consumes no-tests states through existing file names", async () => {
  const fixture = createAcceptanceReviewFixture({ noTests: true });
  try {
    const results = buildTestResultsFromArtifacts(fixture.specDir);
    const trust = validateIntegrationArtifactTrust({
      root: fixture.root,
      specDir: fixture.specDir,
      specPath: fixture.specPath,
      state: fixture.state,
      config: {},
    });
    const durablePathspecs = durableTestArtifactPathspecs(fixture.specId);
    const fixtureSpecDir = `specs/${fixture.specId}`;
    const { artifact: acceptance, written } = runAcceptanceReviewFixture({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
      requirementJudgments: fixture.requirementJudgments,
      persist: true,
    });
    const report = await new RunReportCommand().execute({
      root: fixture.root,
      flowState: fixture.state,
      dryRun: true,
    });
    const finalizeCtx = {
      root: fixture.root,
      flowState: { ...fixture.state, issue: null },
      _results: {
        report: { status: "done", data: report.artifacts.report.data },
        testExecute: results.testExecute,
        finalRegression: results.finalRegression,
      },
    };
    await commitDurableFinalizeArtifacts(finalizeCtx);

    assert.equal(results.testExecute.summary[0].result, "not_applicable");
    assert.equal(results.finalRegression.result, "skipped");
    assert.equal(results.finalRegression.skipKind, "skipped_by_project_policy");
    assert.equal(trust.ok, false);
    assert.equal(acceptance.verdict, "pass");
    assert.equal(readJson(written.path).verdict, "pass");
    assert.doesNotThrow(() => validateAcceptanceReviewArtifact(acceptance, {
      requirementIds: fixture.requirementIds,
    }));
    assert.equal(report.result, "dry-run");
    assert.match(report.artifacts.report.text, /not_applicable|No test data|Tests/i);
    assert.equal(report.artifacts.report.data.tests.total, 1);
    assert.equal(
      report.artifacts.report.data.tests.finalRegression.skipKind,
      "skipped_by_project_policy",
    );
    assert.equal(finalizeCtx._results.report.status, "done");
    assert.equal(finalizeCtx._results.testExecute.summary[0].result, "not_applicable");
    assert.equal(finalizeCtx._results.finalRegression.skipKind, "skipped_by_project_policy");
    assert.equal(finalizeCtx._results.artifactCommit.status, "done");
    assert.ok(durablePathspecs.includes(`${fixtureSpecDir}/test-execute-result.json`));
    assert.ok(durablePathspecs.includes(`${fixtureSpecDir}/test-result-review.json`));
    assert.ok(durablePathspecs.includes(`${fixtureSpecDir}/retro.json`));
    assert.ok(durablePathspecs.some((entry) => entry.includes("tests/.raw/final-regression-attempt-*.log")));
    assert.ok(durablePathspecs.includes(`${fixtureSpecDir}/final-regression-result.json`));
  } finally {
    fixture.cleanup();
  }
});

test("R7: started regression failures are not converted into no-tests skips", async () => {
  await withTmpRepo(async (tmp) => {
    writeSpec(tmp);
    fs.writeFileSync(path.join(tmp, "failing-test.sh"), "printf '%s\\n' 'src/runtime.js: boom' >&2\nexit 1\n");
    fs.writeFileSync(path.join(tmp, "src-runtime-marker.txt"), "changed\n");
    commitAll(tmp);
    checkoutFeature(tmp);
    fs.writeFileSync(path.join(tmp, "src-runtime-marker.txt"), "changed again\n");

    const failed = await new RunFinalRegressionCommand().execute({
      root: tmp,
      flowState: flowState(),
      config: { test: { command: "sh failing-test.sh", timeout: 5 } },
    });

    assert.equal(failed.ok, false);
    const artifact = readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json"));
    assertFailureIsNotNoTestsSkip(artifact);
    assert.doesNotThrow(() => validateFinalRegressionResult({
      ...skippedByProjectPolicyArtifact(),
      nextAction: "report",
    }));
  });

  await withTmpRepo(async (tmp) => {
    writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);

    const failed = await new RunFinalRegressionCommand().execute({
      root: tmp,
      flowState: flowState(),
      config: { test: { command: "node -e \"setTimeout(()=>{}, 1000)\"", timeout: 0.01 } },
    });

    assert.equal(failed.ok, false);
    const artifact = readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json"));
    assertFailureIsNotNoTestsSkip(artifact);
    assert.equal(artifact.process.timedOut, true);
  });

  await withTmpRepo(async (tmp) => {
    writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);

    const failed = await new RunFinalRegressionCommand().execute({
      root: tmp,
      flowState: flowState(),
      config: { test: { command: "definitely_missing_senti_command_392", timeout: 5 } },
    });

    assert.equal(failed.ok, false);
    const artifact = readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json"));
    assertFailureIsNotNoTestsSkip(artifact);
    assert.ok(artifact.process.spawnError);
  });

  await withTmpRepo(async (tmp) => {
    writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);

    const failed = await new RunFinalRegressionCommand().execute({
      root: tmp,
      flowState: flowState(),
      config: { test: { command: "node definitely-missing-file-392.js", timeout: 5 } },
    });

    assert.equal(failed.ok, false);
    const artifact = readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json"));
    assertFailureIsNotNoTestsSkip(artifact);
    assert.match(
      fs.readFileSync(path.join(tmp, artifact.rawOutputPath), "utf8"),
      /Cannot find module|not found|ENOENT/i,
    );
    assert.doesNotThrow(() => validateFinalRegressionResult(skippedByProjectPolicyArtifact()));
  });

  await withTmpRepo(async (tmp) => {
    writeSpec(tmp);
    commitAll(tmp);
    checkoutFeature(tmp);

    const failed = await new RunFinalRegressionCommand().execute({
      root: tmp,
      flowState: flowState(),
      config: { test: { command: "node -e \"process.kill(process.pid, 'SIGTERM')\"", timeout: 5 } },
    });

    assert.equal(failed.ok, false);
    const artifact = readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json"));
    assertFailureIsNotNoTestsSkip(artifact);
    assert.equal(artifact.process.signal, "SIGTERM");
  });
});
