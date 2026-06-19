// spec: R1 R2 R3 R4 R5 R7 R9 R10
import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";
import { setupFlow } from "../../../tests/helpers/flow-setup.js";

const SPEC_DIR = "specs/001-record-proceed";
const FIXTURE_PATH = "final-regression-fixture.sh";
const SENTI_CLI = path.resolve("src/senti.js");

function failingFixtureBody(message) {
  return `printf '%s\\n' ${JSON.stringify(message)} >&2\nexit 1\n`;
}

function passingFixtureBody(message = "pass") {
  return `printf '%s\\n' ${JSON.stringify(message)}\n`;
}

function setupProject(tmp, scriptBody, extra = {}) {
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  writeFile(tmp, `${SPEC_DIR}/spec.md`, "# Spec\n");
  writeFile(tmp, FIXTURE_PATH, scriptBody);
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  for (const [filePath, body] of Object.entries(extra.changedFiles || {})) {
    writeFile(tmp, filePath, body);
  }
  return {
    root: tmp,
    config: { test: { command: `sh ${FIXTURE_PATH}`, timeout: 5 } },
    flowState: {
      spec: `${SPEC_DIR}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-record-proceed",
    },
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readArtifact(tmp) {
  return validateFinalRegressionResult(readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json")));
}

function readIssueLog(tmp) {
  return readJson(path.join(tmp, SPEC_DIR, "issue-log.json"));
}

function runCli(tmp, args) {
  try {
    return JSON.parse(execFileSync("node", [SENTI_CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    }));
  } catch (err) {
    const stdout = err.stdout ? String(err.stdout) : "";
    if (stdout.trim()) return JSON.parse(stdout);
    throw err;
  }
}

function writeSentiConfig(tmp, command = `sh ${FIXTURE_PATH}`) {
  writeFile(tmp, ".senti/config.json", JSON.stringify({
    lang: "ja",
    type: "sample-command",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    test: { command, timeout: 5 },
  }, null, 2));
}

function writeIssueLog(tmp, entries) {
  writeFile(tmp, `${SPEC_DIR}/issue-log.json`, JSON.stringify({ entries }, null, 2) + "\n");
}

function writeRepairAttempt(tmp, body = "observable repair attempt\n") {
  writeFile(tmp, "src/repair-attempt.js", body);
}

function assertFailedRecordedEvidence(artifact, { category, fixAttempts, nextRecommendedAction }) {
  assert.equal(artifact.result, "fail");
  assert.equal(artifact.failureCategory, category);
  assert.equal(artifact.recordAndProceed.eligible, true);
  assert.equal(artifact.fixAttempts, fixAttempts);
  assert.equal(artifact.nextRecommendedAction, nextRecommendedAction);
  assert.notEqual(artifact.result, "pass");
  assert.notEqual(artifact.result, "skipped");
}

describe("Issue 403 final-regression record-and-proceed runner behavior", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  test("R1: failed artifacts separate assertion failures from execution failures and expose Issue 403 categories", async () => {
    tmp = createTmpDir("spec-311-r1-");
    const ctx = setupProject(tmp, failingFixtureBody("existing assertion failure"));

    await new RunFinalRegressionCommand().execute(ctx);
    const assertionArtifact = readArtifact(tmp);

    assert.equal(assertionArtifact.failureNature, "assertion");
    assert.equal(assertionArtifact.failureCategory, "existing_failure");
    assert.equal(assertionArtifact.failureKind, "unattributed_existing_failure");

    const executionTmp = createTmpDir("spec-311-r1-exec-");
    try {
      const executionCtx = setupProject(executionTmp, passingFixtureBody());
      executionCtx.config = { test: { command: "definitely-missing-command-spec-311", timeout: 5 } };
      await new RunFinalRegressionCommand().execute(executionCtx);
      const executionArtifact = readArtifact(executionTmp);

      assert.equal(executionArtifact.failureNature, "execution");
      assert.equal(executionArtifact.failureCategory, "dependency");
      assert.notEqual(executionArtifact.failureCategory, "out_of_scope");
      assert.notEqual(executionArtifact.failureCategory, "flaky_suspected");
    } finally {
      removeTmpDir(executionTmp);
    }
  });

  test("R2: current-diff and invalid project-test failures are not eligible for record-and-proceed", async () => {
    tmp = createTmpDir("spec-311-r2-");
    const ctx = setupProject(tmp, passingFixtureBody());
    writeFile(tmp, FIXTURE_PATH, [
      `printf '%s\\n' ${JSON.stringify(`${FIXTURE_PATH}: current change broke regression`)} >&2`,
      "exit 1",
      "",
    ].join("\n"));

    await new RunFinalRegressionCommand().execute(ctx);
    const currentDiffArtifact = readArtifact(tmp);

    assert.equal(currentDiffArtifact.failureCategory, "caused_by_current_change");
    assert.equal(currentDiffArtifact.recordAndProceed.eligible, false);

    const result = await new RunFinalRegressionCommand().execute({
      ...ctx,
      recordAndProceed: true,
      recordAndProceedEvidence: {
        category: "out_of_scope",
        evidence: "operator tried to override a current-diff failure",
        remainingRisk: "current diff still breaks project regression",
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FINAL_REGRESSION_RECORD_AND_PROCEED_INELIGIBLE");
    assert.equal(readArtifact(tmp).completed, false);

    const invalidProjectTestTmp = createTmpDir("spec-311-r2-invalid-command-");
    try {
      const invalidCtx = setupProject(invalidProjectTestTmp, passingFixtureBody());
      invalidCtx.config = { test: { command: "", timeout: 5 } };
      await new RunFinalRegressionCommand().execute(invalidCtx);
      const invalidResult = await new RunFinalRegressionCommand().execute({
        ...invalidCtx,
        recordAndProceed: true,
        recordAndProceedEvidence: {
          category: "environment",
          evidence: "invalid project-test command must remain a repair path",
          remainingRisk: "test command is invalid",
        },
      });
      assert.equal(readArtifact(invalidProjectTestTmp).failureCategory, "environment");
      assert.equal(readArtifact(invalidProjectTestTmp).failureKind, "invalid_project_test");
      assert.equal(invalidResult.ok, false);
      assert.equal(invalidResult.errors[0].code, "FINAL_REGRESSION_RECORD_AND_PROCEED_INELIGIBLE");
    } finally {
      removeTmpDir(invalidProjectTestTmp);
    }

    const brokenStateTmp = createTmpDir("spec-311-r2-workflow-state-");
    try {
      const brokenCtx = setupProject(brokenStateTmp, failingFixtureBody("PROJECT_TEST_RAN"));
      brokenCtx.flowState = {
        ...brokenCtx.flowState,
        worktree: true,
        worktreePath: path.join(brokenStateTmp, "different-worktree"),
      };
      fs.mkdirSync(brokenCtx.flowState.worktreePath, { recursive: true });
      await new RunFinalRegressionCommand().execute(brokenCtx);
      const brokenResult = await new RunFinalRegressionCommand().execute({
        ...brokenCtx,
        recordAndProceed: true,
        recordAndProceedEvidence: {
          category: "environment",
          evidence: "workflow root mismatch must fail closed",
          remainingRisk: "active worktree evidence is inconsistent",
        },
      });
      assert.equal(readArtifact(brokenStateTmp).recordAndProceed.eligible, false);
      assert.equal(brokenResult.ok, false);
      assert.equal(brokenResult.errors[0].code, "FINAL_REGRESSION_RECORD_AND_PROCEED_INELIGIBLE");
    } finally {
      removeTmpDir(brokenStateTmp);
    }

    const missingArtifactTmp = createTmpDir("spec-311-r2-missing-artifact-");
    try {
      const missingCtx = setupProject(missingArtifactTmp, failingFixtureBody("existing failure"));
      const missingResult = await new RunFinalRegressionCommand().execute({
        ...missingCtx,
        recordAndProceed: true,
        recordAndProceedEvidence: {
          category: "out_of_scope",
          evidence: "missing failed artifact must not be accepted",
          remainingRisk: "no durable evidence exists",
        },
      });
      assert.equal(missingResult.ok, false);
      assert.equal(missingResult.errors[0].code, "FINAL_REGRESSION_RECORD_AND_PROCEED_MISSING_ARTIFACT");
    } finally {
      removeTmpDir(missingArtifactTmp);
    }

    const invalidArtifactTmp = createTmpDir("spec-311-r2-invalid-artifact-");
    try {
      const invalidArtifactCtx = setupProject(invalidArtifactTmp, failingFixtureBody("existing failure"));
      writeFile(invalidArtifactTmp, `${SPEC_DIR}/final-regression-result.json`, "{ invalid json\n");
      const invalidArtifactResult = await new RunFinalRegressionCommand().execute({
        ...invalidArtifactCtx,
        recordAndProceed: true,
        recordAndProceedEvidence: {
          category: "out_of_scope",
          evidence: "invalid artifact schema must not be accepted",
          remainingRisk: "artifact cannot be validated",
        },
      });
      assert.equal(invalidArtifactResult.ok, false);
      assert.equal(invalidArtifactResult.errors[0].code, "FINAL_REGRESSION_RECORD_AND_PROCEED_INVALID_ARTIFACT");
    } finally {
      removeTmpDir(invalidArtifactTmp);
    }

    const artifactWriteFailureTmp = createTmpDir("spec-311-r2-artifact-write-");
    try {
      const artifactWriteCtx = setupProject(artifactWriteFailureTmp, failingFixtureBody("existing failure"));
      fs.mkdirSync(path.join(artifactWriteFailureTmp, SPEC_DIR, "final-regression-result.json"), { recursive: true });
      await assert.rejects(
        new RunFinalRegressionCommand().execute(artifactWriteCtx),
        /EISDIR|artifact write|final-regression-result\.json/i,
      );
      const writeFailureProceed = await new RunFinalRegressionCommand().execute({
        ...artifactWriteCtx,
        recordAndProceed: true,
        recordAndProceedEvidence: {
          category: "out_of_scope",
          evidence: "artifact write failure must not become accepted evidence",
          remainingRisk: "final-regression artifact was not durably written",
        },
      });
      assert.equal(writeFailureProceed.ok, false);
      assert.equal(writeFailureProceed.errors[0].code, "FINAL_REGRESSION_RECORD_AND_PROCEED_MISSING_ARTIFACT");
    } finally {
      removeTmpDir(artifactWriteFailureTmp);
    }
  });

  test("R3: eligible failures keep result fail while exposing record-and-proceed eligibility", async () => {
    tmp = createTmpDir("spec-311-r3-");
    const ctx = setupProject(tmp, failingFixtureBody("existing failure"));

    await new RunFinalRegressionCommand().execute(ctx);
    const artifact = readArtifact(tmp);

    assertFailedRecordedEvidence(artifact, {
      category: "existing_failure",
      fixAttempts: 0,
      nextRecommendedAction: "fix-and-rerun",
    });
    assert.equal(artifact.completed, false);

    for (const category of ["out_of_scope", "flaky_suspected"]) {
      const explicitTmp = createTmpDir(`spec-311-r3-${category}-`);
      try {
        const explicitCtx = setupProject(explicitTmp, failingFixtureBody("existing failure"));
        await new RunFinalRegressionCommand().execute(explicitCtx);
        writeRepairAttempt(explicitTmp);
        await new RunFinalRegressionCommand().execute(explicitCtx);

        const result = await new RunFinalRegressionCommand().execute({
          ...explicitCtx,
          recordAndProceed: true,
          recordAndProceedEvidence: {
            category,
            evidence: `${category} was explicitly investigated and evidenced`,
            remainingRisk: `accepted ${category} failure remains in full regression`,
          },
        });

        assert.equal(result.result, "fail");
        const explicitArtifact = readArtifact(explicitTmp);
        assert.equal(explicitArtifact.result, "fail");
        assert.equal(explicitArtifact.failureCategory, category);
        assert.equal(explicitArtifact.recordAndProceed.validated, true);
        assert.equal(explicitArtifact.recordAndProceed.evidence.length > 0, true);
      } finally {
        removeTmpDir(explicitTmp);
      }
    }
  });

  test("R4: record-and-proceed preserves failure evidence and writes distinct selected and recommended actions", async () => {
    tmp = createTmpDir("spec-311-r4-");
    const ctx = setupProject(tmp, failingFixtureBody("existing failure"), {
      changedFiles: { "src/context.js": "export const context = 1;\n" },
    });

    await new RunFinalRegressionCommand().execute(ctx);
    writeRepairAttempt(tmp);
    await new RunFinalRegressionCommand().execute(ctx);
    const result = await new RunFinalRegressionCommand().execute({
      ...ctx,
      recordAndProceed: true,
      recordAndProceedEvidence: {
        category: "out_of_scope",
        evidence: "failure is outside the current implementation after a repair attempt",
        remainingRisk: "project regression remains red for an accepted out-of-scope failure",
      },
    });

    assert.equal(result.result, "fail");
    assert.equal(result.next, "finalize-commit");

    const artifact = readArtifact(tmp);
    assert.equal(artifact.result, "fail");
    assert.equal(artifact.completed, true);
    assert.equal(artifact.selectedAction, "record-and-proceed");
    assert.equal(artifact.nextAction, "finalize-commit");
    assert.equal(artifact.nextRecommendedAction, "record-and-proceed");
    assert.equal(artifact.remainingRisk, "project regression remains red for an accepted out-of-scope failure");
    assert.equal(artifact.fixAttempts, 1);
    assert.equal(artifact.command, `sh ${FIXTURE_PATH}`);
    assert.equal(artifact.process.exitCode, 1);
    assert.match(artifact.rawOutputPath, /tests\/\.raw\/final-regression-attempt-\d+\.log$/);
    assert.ok(artifact.failureSummary.includes("existing failure"));
    assert.ok(Array.isArray(artifact.changedFileFingerprints));
  });

  test("R5: record-and-proceed rejects stale failed artifacts by command identity or changed-file fingerprints", async () => {
    tmp = createTmpDir("spec-311-r5-");
    const ctx = setupProject(tmp, failingFixtureBody("existing failure"), {
      changedFiles: { "src/context.js": "export const context = 1;\n" },
    });

    await new RunFinalRegressionCommand().execute(ctx);
    writeFile(tmp, "src/context.js", "export const context = 2;\n");

    const result = await new RunFinalRegressionCommand().execute({
      ...ctx,
      recordAndProceed: true,
      recordAndProceedEvidence: {
        category: "out_of_scope",
        evidence: "stale changed-file evidence must be rejected",
        remainingRisk: "not accepted",
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FINAL_REGRESSION_RECORD_AND_PROCEED_STALE");
    assert.equal(readArtifact(tmp).completed, false);

    const commandStaleTmp = createTmpDir("spec-311-r5-command-stale-");
    try {
      const commandCtx = setupProject(commandStaleTmp, failingFixtureBody("existing failure"));
      await new RunFinalRegressionCommand().execute(commandCtx);
      const commandStaleResult = await new RunFinalRegressionCommand().execute({
        ...commandCtx,
        config: { test: { command: `sh ${FIXTURE_PATH} --changed-command`, timeout: 5 } },
        recordAndProceed: true,
        recordAndProceedEvidence: {
          category: "out_of_scope",
          evidence: "command identity changed after failed evidence was recorded",
          remainingRisk: "stale command evidence must not advance",
        },
      });
      assert.equal(commandStaleResult.ok, false);
      assert.equal(commandStaleResult.errors[0].code, "FINAL_REGRESSION_RECORD_AND_PROCEED_STALE");
      assert.equal(readArtifact(commandStaleTmp).completed, false);
    } finally {
      removeTmpDir(commandStaleTmp);
    }

    const matchingFingerprintTmp = createTmpDir("spec-311-r5-current-artifact-");
    try {
      const matchingCtx = setupProject(matchingFingerprintTmp, failingFixtureBody("existing failure"), {
        changedFiles: { "src/context.js": "export const context = 1;\n" },
      });
      await new RunFinalRegressionCommand().execute(matchingCtx);
      const matchingResult = await new RunFinalRegressionCommand().execute({
        ...matchingCtx,
        recordAndProceed: true,
        recordAndProceedEvidence: {
          category: "out_of_scope",
          evidence: "command identity and changed-file fingerprints still match the failed artifact",
          remainingRisk: "out-of-scope failure remains accepted",
        },
      });
      assert.equal(matchingResult.result, "fail");
      assert.equal(matchingResult.next, "finalize-commit");
      const matchingArtifact = readArtifact(matchingFingerprintTmp);
      assert.equal(matchingArtifact.result, "fail");
      assert.equal(matchingArtifact.completed, true);
      assert.equal(matchingArtifact.recordAndProceed.validated, true);
      assert.equal(matchingArtifact.selectedAction, "record-and-proceed");
    } finally {
      removeTmpDir(matchingFingerprintTmp);
    }
  });

  test("R5: CLI --record-and-proceed validates current failed artifact and returns post-hook completion envelope", () => {
    tmp = createTmpDir("spec-311-r5-cli-");
    const ctx = setupProject(tmp, failingFixtureBody("existing failure"), {
      changedFiles: { "src/context.js": "export const context = 1;\n" },
    });
    writeSentiConfig(tmp);
    setupFlow(tmp, ctx.flowState);

    const first = runCli(tmp, ["flow", "run", "final-regression"]);
    assert.equal(first.ok, false);
    writeRepairAttempt(tmp);
    const second = runCli(tmp, ["flow", "run", "final-regression"]);
    assert.equal(second.ok, false);

    const proceed = runCli(tmp, ["flow", "run", "final-regression", "--record-and-proceed"]);

    assert.equal(proceed.ok, true);
    assert.equal(proceed.data.result, "fail");
    assert.equal(proceed.data.next, "finalize-commit");
    assert.equal(proceed.data.artifacts.result, "fail");
    assert.equal(proceed.data.artifacts.selectedAction, "record-and-proceed");
    assert.equal(proceed.data.artifacts.nextRecommendedAction, "record-and-proceed");
    assert.equal(readArtifact(tmp).result, "fail");
    assert.equal(readArtifact(tmp).completed, true);
  });

  test("R7: repeated identical failures keep fixAttempts at zero, while post-failure changes recommend record-and-proceed", async () => {
    tmp = createTmpDir("spec-311-r7-");
    const ctx = setupProject(tmp, failingFixtureBody("existing failure"));

    await new RunFinalRegressionCommand().execute(ctx);
    await new RunFinalRegressionCommand().execute(ctx);
    assertFailedRecordedEvidence(readArtifact(tmp), {
      category: "existing_failure",
      fixAttempts: 0,
      nextRecommendedAction: "fix-and-rerun",
    });

    writeRepairAttempt(tmp);
    await new RunFinalRegressionCommand().execute(ctx);
    assertFailedRecordedEvidence(readArtifact(tmp), {
      category: "existing_failure",
      fixAttempts: 1,
      nextRecommendedAction: "record-and-proceed",
    });

    const autoTmp = createTmpDir("spec-311-r7-auto-");
    try {
      const autoCtx = setupProject(autoTmp, failingFixtureBody("existing failure"));
      autoCtx.flowState = { ...autoCtx.flowState, autoApprove: true };

      await new RunFinalRegressionCommand().execute(autoCtx);
      let autoArtifact = readArtifact(autoTmp);
      assert.equal(autoArtifact.nextRecommendedAction, "fix-and-rerun");
      assert.equal(autoArtifact.selectedAction, "fix-and-rerun");

      writeRepairAttempt(autoTmp, "observable repair attempt in auto mode\n");
      await new RunFinalRegressionCommand().execute(autoCtx);
      autoArtifact = readArtifact(autoTmp);
      assert.equal(autoArtifact.nextRecommendedAction, "record-and-proceed");
      assert.equal(autoArtifact.selectedAction, "record-and-proceed");
      assert.equal(autoArtifact.completed, true);
      assert.equal(autoArtifact.result, "fail");
    } finally {
      removeTmpDir(autoTmp);
    }

    const boundedTmp = createTmpDir("spec-311-r7-bounded-");
    try {
      const boundedCtx = setupProject(boundedTmp, failingFixtureBody("existing failure"));
      const oldDifferentFingerprints = {
        commandIdentity: { command: `sh ${FIXTURE_PATH}`, commandSource: "config", argv: ["sh", FIXTURE_PATH], env: {}, source: "config", metadata: {} },
        changedFileFingerprints: [{ path: "docs/old.md", fingerprint: "outside-scan-window" }],
      };
      const latestSameFingerprints = {
        commandIdentity: oldDifferentFingerprints.commandIdentity,
        changedFileFingerprints: [],
      };
      writeIssueLog(boundedTmp, [
        ...Array.from({ length: 25 }, (_, index) => ({
          step: "final-regression",
          result: "fail",
          failureCategory: "existing_failure",
          rawOutputPath: `${SPEC_DIR}/tests/.raw/should-not-read-${index}.log`,
          ...oldDifferentFingerprints,
        })),
        ...Array.from({ length: 10_000 }, (_, index) => ({
          step: "final-regression",
          result: "fail",
          failureCategory: "existing_failure",
          rawOutputPath: `${SPEC_DIR}/tests/.raw/should-not-read-latest-${index}.log`,
          ...latestSameFingerprints,
        })),
      ]);

      const originalReadFileSync = fs.readFileSync;
      fs.readFileSync = function guardedReadFileSync(filePath, ...args) {
        assert.doesNotMatch(String(filePath), /should-not-read/, "fixAttempts calculation must not read raw final-regression logs");
        return originalReadFileSync.call(this, filePath, ...args);
      };
      try {
        await new RunFinalRegressionCommand().execute(boundedCtx);
      } finally {
        fs.readFileSync = originalReadFileSync;
      }

      assertFailedRecordedEvidence(readArtifact(boundedTmp), {
        category: "existing_failure",
        fixAttempts: 0,
        nextRecommendedAction: "fix-and-rerun",
      });
    } finally {
      removeTmpDir(boundedTmp);
    }
  });

  test("R9: pass, current-diff fail-closed, raw log, changed files, process, retry, nextAction, and issue-log parity remain intact", async () => {
    tmp = createTmpDir("spec-311-r9-");
    const passCtx = setupProject(tmp, passingFixtureBody("final pass"));

    const passResult = await new RunFinalRegressionCommand().execute(passCtx);
    assert.equal(passResult.result, "pass");
    const passArtifact = readArtifact(tmp);
    assert.equal(passArtifact.completed, true);
    assert.equal(passArtifact.nextAction, "finalize-commit");
    assert.ok(fs.existsSync(path.join(tmp, passArtifact.rawOutputPath)));

    writeFile(tmp, FIXTURE_PATH, [
      `printf '%s\\n' ${JSON.stringify(`${FIXTURE_PATH}: current change broke regression`)} >&2`,
      "exit 1",
      "",
    ].join("\n"));
    const failResult = await new RunFinalRegressionCommand().execute(passCtx);
    assert.equal(failResult.ok, false);
    const artifact = readArtifact(tmp);
    assert.equal(artifact.result, "fail");
    assert.equal(artifact.failureCategory, "caused_by_current_change");
    assert.equal(artifact.recordAndProceed.eligible, false);
    assert.equal(artifact.retryable, true);
    assert.equal(artifact.nextAction, "regression-repair");
    assert.ok(Array.isArray(artifact.changedFiles));
    assert.equal(artifact.process.exitCode, 1);
    assert.ok(fs.existsSync(path.join(tmp, artifact.rawOutputPath)));

    const issueLog = readIssueLog(tmp);
    assert.equal(issueLog.entries.at(-1).step, "final-regression");
    assert.equal(issueLog.entries.at(-1).failureCategory, "caused_by_current_change");
  });

  test("R10: this spec-local file declares coverage headers and R-prefixed tests for the runner contract", () => {
    const source = fs.readFileSync(new URL(import.meta.url), "utf8");

    for (const id of ["R1", "R2", "R3", "R4", "R5", "R7", "R9", "R10"]) {
      assert.match(source, new RegExp(`^// spec: .*\\b${id}\\b`, "m"));
      assert.match(source, new RegExp(`test\\("${id}:`));
    }
  });
});
