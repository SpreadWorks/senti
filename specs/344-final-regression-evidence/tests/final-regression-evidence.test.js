// spec: R1 R2 R3 R4
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as testArtifacts from "../../../src/flow/lib/test-artifacts.js";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { childProcessRecord } from "../../../tests/helpers/child-process-record.js";
import { commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";

const SPEC_DIR = "specs/344-final-regression-evidence";
const RAW_OUTPUT_PATH = `${SPEC_DIR}/tests/.raw/final-regression-attempt-001.log`;

function setupProject(tmp, scriptBody, { autoApprove = false } = {}) {
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  writeFile(tmp, `${SPEC_DIR}/spec.md`, "# Spec\n");
  writeFile(tmp, "fixture.mjs", scriptBody);
  writeFile(tmp, "tracked-state.txt", "before\n");
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  return {
    root: tmp,
    config: { test: { command: "node fixture.mjs", timeout: 5 } },
    flowState: {
      spec: `${SPEC_DIR}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/344-final-regression-evidence",
      autoApprove,
    },
  };
}

function readArtifact(tmp) {
  return JSON.parse(fs.readFileSync(path.join(tmp, SPEC_DIR, "final-regression-result.json"), "utf8"));
}

function failedRecordedArtifact() {
  const rawOutputPath = "specs/344-final-regression-evidence/tests/.raw/final-regression-attempt-002.log";
  return {
    version: "1",
    completed: true,
    result: "fail",
    failureKind: "unattributed_existing_failure",
    failureCategory: "existing_failure",
    failureNature: "assertion",
    command: "node fixture.mjs",
    commandSource: "config",
    rawOutputPath,
    rawOutputLines: { start_line: 1, end_line: 2 },
    process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
    childProcesses: [{
      ...childProcessRecord({ stderr: "ERR_ASSERTION\ntests/unit/existing.test.js: existing failure\n" }).toJSON(),
      rawOutputPath,
    }],
    changedFiles: [],
    changedFileFingerprints: [],
    commandIdentity: {
      command: "node fixture.mjs",
      commandSource: "config",
      argv: ["node", "fixture.mjs"],
      env: {},
      source: "config",
      metadata: {},
      resolvedScriptDigest: null,
      resolvedConfigDigest: null,
    },
    recordAndProceed: {
      eligible: true,
      validated: true,
      evidence: "autoApprove selected record-and-proceed for existing_failure",
    },
    selectedAction: "record-and-proceed",
    remainingRisk: "final-regression remains failed; category=existing_failure",
    fixAttempts: 1,
    retryable: false,
    nextAction: "report",
    nextRecommendedAction: "record-and-proceed",
    failureSummary: "existing failure",
  };
}

describe("final-regression completion evidence", () => {
  const tmpDirs = [];

  afterEach(() => {
    for (const tmp of tmpDirs.splice(0)) removeTmpDir(tmp);
  });

  it("R1: zero tests or either stream beyond 1 MiB never completes a passing regression", async () => {
    const zeroTests = createTmpDir("final-regression-zero-tests-");
    tmpDirs.push(zeroTests);
    const zeroResult = await new RunFinalRegressionCommand().execute(setupProject(
      zeroTests,
      "process.stdout.write('TAP version 13\\n1..0\\n');\n",
    ));

    const oversizedStdout = createTmpDir("final-regression-oversized-stdout-");
    tmpDirs.push(oversizedStdout);
    const stdoutResult = await new RunFinalRegressionCommand().execute(setupProject(
      oversizedStdout,
      "process.stdout.write('x'.repeat(1024 * 1024 + 1));\nprocess.stdout.write('\\n1..1\\n');\n",
    ));

    const oversizedStderr = createTmpDir("final-regression-oversized-stderr-");
    tmpDirs.push(oversizedStderr);
    const stderrResult = await new RunFinalRegressionCommand().execute(setupProject(
      oversizedStderr,
      "process.stderr.write('x'.repeat(1024 * 1024 + 1));\nprocess.stdout.write('TAP version 13\\n1..1\\nok 1 - verified\\n');\n",
    ));

    const valid = createTmpDir("final-regression-valid-pass-");
    tmpDirs.push(valid);
    const validResult = await new RunFinalRegressionCommand().execute(setupProject(
      valid,
      "process.stdout.write('TAP version 13\\n1..1\\nok 1 - verified\\n');\n",
    ));
    const validArtifact = readArtifact(valid);

    for (const [label, result, artifact] of [
      ["zero tests", zeroResult, readArtifact(zeroTests)],
      ["oversized stdout", stdoutResult, readArtifact(oversizedStdout)],
      ["oversized stderr", stderrResult, readArtifact(oversizedStderr)],
    ]) {
      assert.notEqual(result.result, "pass", `${label} is incomplete evidence`);
      assert.notEqual(artifact.nextAction, "report", `${label} must not report as complete`);
      assert.equal(artifact.completed, false, `${label} must not complete`);
    }
    assert.equal(validResult.result, "pass");
    assert.equal(validArtifact.completed, true);
    assert.equal(validArtifact.nextAction, "report");
    assert.equal(validArtifact.process.started, true);
    assert.equal(validArtifact.process.exitCode, 0);
    assert.equal(validArtifact.executionBinding.testCount >= 1, true);
    assert.equal(validArtifact.executionBinding.truncated, false);
    assert.equal(validArtifact.executionBinding.stdout.truncated, false);
    assert.equal(validArtifact.executionBinding.stderr.truncated, false);
  });

  it("R2: acceptance validates the captured execution binding against the current repository", async () => {
    const tmp = createTmpDir("final-regression-binding-");
    tmpDirs.push(tmp);
    await new RunFinalRegressionCommand().execute(setupProject(
      tmp,
      "process.stdout.write('TAP version 13\\n1..1\\nok 1 - verified\\n');\n",
    ));
    const artifact = readArtifact(tmp);

    assert.equal(typeof testArtifacts.validateFinalRegressionEvidence, "function");
    assert.ok(artifact.executionBinding);
    for (const field of ["headSha", "treeSha", "worktreeSha256", "command", "rawOutputSha256", "parsedResult", "testCount", "truncated", "stdout", "stderr"]) {
      assert.ok(Object.hasOwn(artifact.executionBinding, field), `execution binding stores ${field}`);
    }
    assert.ok(artifact.executionBinding.stdout.capturedByteLength <= 1024 * 1024);
    assert.ok(artifact.executionBinding.stderr.capturedByteLength <= 1024 * 1024);
    assert.equal(testArtifacts.validateFinalRegressionEvidence({ root: tmp, artifact }).ok, true);

    for (const field of ["headSha", "treeSha", "worktreeSha256", "command", "rawOutputSha256", "parsedResult", "testCount", "truncated"]) {
      const stale = structuredClone(artifact);
      stale.executionBinding[field] = field === "testCount"
        ? artifact.executionBinding.testCount + 1
        : field === "truncated"
          ? !artifact.executionBinding.truncated
          : field === "parsedResult"
            ? "fail"
            : field === "worktreeSha256"
              ? "0".repeat(64)
            : `stale-${field}`;
      assert.equal(testArtifacts.validateFinalRegressionEvidence({ root: tmp, artifact: stale }).ok, false, `${field} mismatch must be rejected`);
    }
    for (const stream of ["stdout", "stderr"]) {
      const stale = structuredClone(artifact);
      stale.executionBinding[stream].capturedByteLength += 1;
      assert.equal(testArtifacts.validateFinalRegressionEvidence({ root: tmp, artifact: stale }).ok, false, `${stream} binding mismatch must be rejected`);
    }
    const externalRawPath = path.join(path.dirname(tmp), "external-final-regression.log");
    fs.writeFileSync(externalRawPath, fs.readFileSync(path.join(tmp, artifact.rawOutputPath)));
    const external = structuredClone(artifact);
    external.rawOutputPath = externalRawPath;
    external.executionBinding.rawOutputPath = externalRawPath;
    assert.equal(testArtifacts.validateFinalRegressionEvidence({ root: tmp, artifact: external }).ok, false, "raw output outside the repository must be rejected");
    fs.rmSync(externalRawPath);
  });

  it("R2: a passing regression that mutates a tracked file is retained as incomplete evidence", async () => {
    const tmp = createTmpDir("final-regression-worktree-mutation-");
    tmpDirs.push(tmp);
    const result = await new RunFinalRegressionCommand().execute(setupProject(tmp, [
      "import fs from 'node:fs';",
      "fs.writeFileSync('tracked-state.txt', 'after\\n');",
      "process.stdout.write('TAP version 13\\n1..1\\nok 1 - verified\\n');",
      "",
    ].join("\n")));
    const artifact = readArtifact(tmp);

    assert.equal(result.result, "fail");
    assert.equal(artifact.completed, false);
    assert.notEqual(artifact.nextAction, "report");
    assert.ok(artifact.executionBinding.worktreeSha256);
    assert.equal(testArtifacts.validateFinalRegressionEvidence({ root: tmp, artifact }).ok, true);
  });

  it("R2: a passing regression that stages a tracked mutation is retained as incomplete evidence", async () => {
    const tmp = createTmpDir("final-regression-staged-mutation-");
    tmpDirs.push(tmp);
    const result = await new RunFinalRegressionCommand().execute(setupProject(tmp, [
      "import { execFileSync } from 'node:child_process';",
      "import fs from 'node:fs';",
      "fs.writeFileSync('tracked-state.txt', 'staged after\\n');",
      "execFileSync('git', ['add', 'tracked-state.txt']);",
      "process.stdout.write('TAP version 13\\n1..1\\nok 1 - verified\\n');",
      "",
    ].join("\n")));
    const artifact = readArtifact(tmp);

    assert.equal(result.result, "fail");
    assert.equal(artifact.completed, false);
    assert.notEqual(artifact.nextAction, "report");
    assert.equal(testArtifacts.validateFinalRegressionEvidence({ root: tmp, artifact }).ok, true);
  });

  it("R2: a passing regression that creates an untracked project file is retained as incomplete evidence", async () => {
    const tmp = createTmpDir("final-regression-untracked-mutation-");
    tmpDirs.push(tmp);
    const result = await new RunFinalRegressionCommand().execute(setupProject(tmp, [
      "import fs from 'node:fs';",
      "fs.writeFileSync('created-project-file.js', 'export const created = true;\\n');",
      "process.stdout.write('TAP version 13\\n1..1\\nok 1 - verified\\n');",
      "",
    ].join("\n")));
    const artifact = readArtifact(tmp);

    assert.equal(result.result, "fail");
    assert.equal(artifact.completed, false);
    assert.notEqual(artifact.nextAction, "report");
    assert.equal(testArtifacts.validateFinalRegressionEvidence({ root: tmp, artifact }).ok, true);
  });

  it("R3: autoApprove cannot complete a failed regression, while explicit bound evidence is required", async () => {
    const tmp = createTmpDir("final-regression-explicit-proceed-");
    tmpDirs.push(tmp);
    await new RunFinalRegressionCommand().execute(setupProject(tmp, [
      "process.stderr.write('ERR_ASSERTION\\ntests/unit/existing.test.js: existing failure\\n');",
      "process.exitCode = 1;",
      "",
    ].join("\n"), { autoApprove: true }));
    const failedArtifact = readArtifact(tmp);
    assert.equal(failedArtifact.completed, false, "autoApprove must not complete failed regression evidence");
    assert.notEqual(failedArtifact.selectedAction, "record-and-proceed");
    assert.notEqual(failedArtifact.nextAction, "report");
    const automatic = failedRecordedArtifact();
    assert.equal(automatic.selectedAction, "record-and-proceed", "legacy automatic artifacts are rejected rather than resumed");
    assert.throws(() => testArtifacts.validateFinalRegressionResult(automatic), /operator|explicit|autoApprove/i);

    const explicit = structuredClone(failedArtifact);
    explicit.recordAndProceed = {
      eligible: true,
      validated: true,
      evidence: "operator confirmed the classified existing failure after review",
      failureClassification: failedArtifact.failureCategory,
      operatorJustification: "failure is outside this change",
      remainingRisk: "the existing test remains red",
      executionBinding: structuredClone(failedArtifact.executionBinding),
    };
    explicit.selectedAction = "explicit-record-and-proceed";
    explicit.completed = true;
    explicit.nextAction = "report";
    explicit.remainingRisk = explicit.recordAndProceed.remainingRisk;
    explicit.recordAndProceed.executionBinding.rawOutputPath = explicit.rawOutputPath;
    assert.equal(typeof testArtifacts.validateExplicitFinalRegressionProceed, "function");
    assert.doesNotThrow(() => testArtifacts.validateFinalRegressionResult(explicit));
    assert.equal(testArtifacts.validateExplicitFinalRegressionProceed({ root: tmp, artifact: explicit }).ok, true);
    assert.equal(explicit.remainingRisk, explicit.recordAndProceed.remainingRisk);

    const mismatched = structuredClone(explicit);
    mismatched.recordAndProceed.executionBinding.rawOutputSha256 = "0".repeat(64);
    assert.equal(testArtifacts.validateExplicitFinalRegressionProceed({ root: tmp, artifact: mismatched }).ok, false);

    const missingTopLevelRisk = structuredClone(explicit);
    delete missingTopLevelRisk.remainingRisk;
    assert.equal(testArtifacts.validateExplicitFinalRegressionProceed({ root: tmp, artifact: missingTopLevelRisk }).ok, false);

    for (const field of [
      "failureClassification",
      "operatorJustification",
      "remainingRisk",
      "executionBinding.rawOutputPath",
      "executionBinding.rawOutputSha256",
      "executionBinding.headSha",
      "executionBinding.treeSha",
    ]) {
      const incomplete = structuredClone(explicit);
      const [parent, child] = field.split(".");
      if (child) delete incomplete.recordAndProceed[parent][child];
      else delete incomplete.recordAndProceed[parent];
      assert.equal(testArtifacts.validateExplicitFinalRegressionProceed({ root: tmp, artifact: incomplete }).ok, false, `${field} is required for explicit proceed`);
    }

    for (const [field, value] of [
      ["failureClassification", "unknown"],
      ["executionBinding.rawOutputPath", "specs/other/tests/.raw/unrelated.log"],
      ["executionBinding.headSha", "0".repeat(40)],
      ["executionBinding.treeSha", "1".repeat(40)],
    ]) {
      const stale = structuredClone(explicit);
      const [parent, child] = field.split(".");
      if (child) stale.recordAndProceed[parent][child] = value;
      else stale.recordAndProceed[parent] = value;
      assert.equal(testArtifacts.validateExplicitFinalRegressionProceed({ root: tmp, artifact: stale }).ok, false, `${field} mismatch must be rejected`);
    }
  });

  it("R4: final-regression keeps its command, artifact path, and classified failure recovery", async () => {
    const tmp = createTmpDir("final-regression-parity-");
    tmpDirs.push(tmp);
    const result = await new RunFinalRegressionCommand().execute(setupProject(tmp, [
      "process.stderr.write('ERR_ASSERTION\\ntests/unit/existing.test.js: existing failure\\n');",
      "process.exitCode = 1;",
      "",
    ].join("\n")));
    const artifact = readArtifact(tmp);

    assert.equal(result.result, "fail");
    assert.equal(artifact.command, "node fixture.mjs");
    assert.equal(artifact.rawOutputPath, RAW_OUTPUT_PATH);
    assert.equal(artifact.failureKind, "unattributed_existing_failure");
    assert.equal(artifact.nextAction, "user-confirmation");
    assert.ok(artifact.executionBinding, "retained failure artifacts carry their execution binding");
    const issueLog = JSON.parse(fs.readFileSync(path.join(tmp, SPEC_DIR, "issue-log.json"), "utf8"));
    assert.equal(issueLog.entries.at(-1).step, "final-regression");
    assert.equal(issueLog.entries.at(-1).failureKind, "unattributed_existing_failure");
  });

  it("R4: project policy skip remains a completed report outcome", async () => {
    const tmp = createTmpDir("final-regression-policy-skip-");
    tmpDirs.push(tmp);
    const ctx = setupProject(tmp, "");
    ctx.config = {};

    const result = await new RunFinalRegressionCommand().execute(ctx);
    const artifact = readArtifact(tmp);

    assert.equal(result.result, "skipped");
    assert.equal(result.next, "report");
    assert.equal(artifact.skipKind, "skipped_by_project_policy");
    assert.equal(artifact.completed, true);
    assert.equal(artifact.nextAction, "report");
    assert.equal(artifact.executionBinding, undefined);
  });

  it("R4: successful regression keeps its command, artifact path, and report outcome", async () => {
    const tmp = createTmpDir("final-regression-pass-parity-");
    tmpDirs.push(tmp);
    const result = await new RunFinalRegressionCommand().execute(setupProject(
      tmp,
      "process.stdout.write('TAP version 13\\n1..1\\nok 1 - retained pass\\n');\n",
    ));
    const artifact = readArtifact(tmp);

    assert.equal(result.result, "pass");
    assert.equal(result.next, "report");
    assert.equal(artifact.command, "node fixture.mjs");
    assert.equal(artifact.rawOutputPath, RAW_OUTPUT_PATH);
    assert.equal(artifact.completed, true);
    assert.equal(artifact.nextAction, "report");
    assert.ok(artifact.executionBinding);
  });
});
