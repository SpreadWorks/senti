import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { writeRepairFingerprintManifest } from "../../../src/flow/lib/repair-state-identity.js";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { initGitRepo, commitAll } from "../../helpers/git-repo.js";
import { shellPrintChildProcessRecord } from "../../helpers/child-process-record.js";

const SPEC_DIR = "specs/001-test";
const FIXTURE_PATH = "final-regression-fixture.sh";
const PASSING_FIXTURE_BODY = "printf '%s\\n' 'initial pass'\n";

function failingFixtureBody(message) {
  return `printf '%s\\n' ${JSON.stringify(message)} >&2\nexit 1\n`;
}

function attemptLogPath(index) {
  return `${SPEC_DIR}/tests/.raw/final-regression-attempt-${String(index).padStart(3, "0")}.log`;
}

function setupProject(tmp, scriptBody, extraFlowState = {}) {
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  writeFile(tmp, `${SPEC_DIR}/spec.md`, "# Spec\n");
  writeFile(tmp, FIXTURE_PATH, scriptBody);
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  return {
    root: tmp,
    config: { test: { command: `sh ${FIXTURE_PATH}`, timeout: 5 } },
    flowState: {
      spec: `${SPEC_DIR}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      ...extraFlowState,
    },
  };
}

function writeChangedFileReferencingFailureFixture(tmp, message) {
  writeFile(tmp, FIXTURE_PATH, [
    `printf '%s\\n' ${JSON.stringify(`${FIXTURE_PATH}: ${message}`)} >&2`,
    shellPrintChildProcessRecord({
      stderr: `ERR_ASSERTION\n${FIXTURE_PATH}: ${message}\n`,
    }),
    "exit 1",
    "",
  ].join("\n"));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readFinalRegressionArtifact(tmp) {
  return validateFinalRegressionResult(readJson(path.join(tmp, SPEC_DIR, "final-regression-result.json")));
}

function assertFinalRegressionEnvelopeFailure(envelope, { failureKind, retryable, nextAction }) {
  assert.equal(envelope.ok, false);
  assert.equal(envelope.data.failureKind, failureKind);
  assert.equal(envelope.data.retryable, retryable);
  assert.equal(envelope.data.nextAction, nextAction);
}

function assertFinalRegressionArtifactFailure(artifact, { failureKind, retryable, nextAction }) {
  assert.equal(artifact.result, "fail");
  assert.equal(artifact.failureKind, failureKind);
  assert.equal(artifact.retryable, retryable);
  assert.equal(artifact.nextAction, nextAction);
}

function assertFinalRegressionFailure(tmp, envelope, expected) {
  assertFinalRegressionEnvelopeFailure(envelope, expected);
  const artifact = readFinalRegressionArtifact(tmp);
  assertFinalRegressionArtifactFailure(artifact, expected);
  return artifact;
}

describe("flow run final-regression", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("writes a pass artifact and returns report as next action", async () => {
    tmp = createTmpDir("final-regression-pass-");
    const ctx = setupProject(tmp, "printf '%s\\n' 'TAP version 13' '1..1' 'ok 1 - final pass'\n");

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.result, "pass");
    assert.equal(result.next, "report");
    const artifact = readFinalRegressionArtifact(tmp);
    assert.equal(artifact.result, "pass");
    assert.equal(artifact.failureKind, null);
    assert.equal(artifact.nextAction, "report");
    assert.equal(artifact.completed, true);
    assert.equal(artifact.rawOutputPath, "specs/001-test/tests/.raw/final-regression-attempt-001.log");
    assert.ok(fs.existsSync(path.join(tmp, attemptLogPath(1))));
  });

  it("uses the authority root final regression timeout over a stale context config", async () => {
    tmp = createTmpDir("final-regression-authority-timeout-");
    const ctx = setupProject(tmp, "sleep 2\nprintf '%s\\n' 'TAP version 13' '1..1' 'ok 1 - final pass'\n");
    writeFile(tmp, ".senti/config.json", JSON.stringify({
      lang: "en",
      type: "node-cli",
      docs: { languages: ["en"], defaultLanguage: "en" },
      test: {
        command: `sh ${FIXTURE_PATH}`,
        timeout: 1,
        finalRegressionTimeout: 5,
      },
    }, null, 2));

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.result, "pass");
  });

  it("invalidates stale test evidence and rewinds to test-execute before starting regression", async () => {
    tmp = createTmpDir("final-regression-stale-evidence-");
    const ctx = setupProject(tmp, "printf '%s\\n' 'final pass'\n");
    writeFile(tmp, `${SPEC_DIR}/spec.json`, "{}\n");
    const previous = buildRepairFingerprint({
      root: tmp,
      specPath: `${SPEC_DIR}/spec.json`,
    });
    writeRepairFingerprintManifest(path.join(tmp, SPEC_DIR), previous);
    const state = moveFlowToStep(makeFlowState({
      spec: `${SPEC_DIR}/spec.json`,
      repairBaseline: previous.baseline.toJSON(),
    }), "final-regression");
    writeFile(tmp, "src/repair.js", "export const repaired = true;\n");
    const current = buildRepairFingerprint({
      root: tmp,
      specPath: state.spec,
      state,
    });
    writeFile(tmp, `${SPEC_DIR}/test-execute-result.json`, JSON.stringify({
      repairFingerprint: previous.hash,
    }, null, 2));
    writeFile(tmp, `${SPEC_DIR}/retro.json`, JSON.stringify({
      repairFingerprint: previous.hash,
    }, null, 2));
    writeFile(tmp, `${SPEC_DIR}/final-regression-result.json`, "{}\n");
    const flowManager = new FlowManager({
      root: tmp,
      mainRoot: tmp,
      inWorktree: false,
    });
    flowManager.create(state);
    const persistedState = flowManager.loadReadOnly();

    const result = await new RunFinalRegressionCommand().execute({
      ...ctx,
      flowState: persistedState,
      flowManager,
    });
    const recoveredState = flowManager.loadReadOnly();

    assert.equal(result.result, "recovered");
    assert.equal(result.next, "test-execute");
    assert.equal(result.artifacts.evidenceRefresh.previousFingerprint, previous.hash);
    assert.equal(result.artifacts.evidenceRefresh.currentFingerprint, current.hash);
    assert.equal(findStepById(recoveredState.steps, "test-execute").status, "in_progress");
    assert.equal(findStepById(recoveredState.steps, "final-regression").status, "pending");
    assert.equal(fs.existsSync(path.join(tmp, `${SPEC_DIR}/test-execute-result.json`)), false);
    assert.equal(fs.existsSync(path.join(tmp, `${SPEC_DIR}/retro.json`)), false);
    assert.equal(fs.existsSync(path.join(tmp, `${SPEC_DIR}/final-regression-result.json`)), false);
    assert.equal(fs.existsSync(path.join(tmp, attemptLogPath(1))), false);
  });

  it("classifies current-change failure, records issue-log, and allows one repair retry", async () => {
    tmp = createTmpDir("final-regression-fail-");
    const ctx = setupProject(tmp, PASSING_FIXTURE_BODY);
    writeChangedFileReferencingFailureFixture(tmp, "boom");

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.errors[0].code, "FINAL_REGRESSION_FAILED");
    assertFinalRegressionFailure(tmp, result, {
      failureKind: "caused_by_current_change",
      retryable: true,
      nextAction: "regression-repair",
    });

    const issueLog = readJson(path.join(tmp, SPEC_DIR, "issue-log.json"));
    assert.equal(issueLog.entries.length, 1);
    assert.equal(issueLog.entries[0].step, "final-regression");
    assert.equal(issueLog.entries[0].failureKind, "caused_by_current_change");
  });

  it("classifies failure with no project change as unattributed_existing_failure", async () => {
    tmp = createTmpDir("final-regression-unattributed-existing-");
    const ctx = setupProject(tmp, [
      "printf '%s\\n' 'existing failure' >&2",
      shellPrintChildProcessRecord({
        stderr: "ERR_ASSERTION\ntests/unit/existing.test.js: existing failure\n",
      }),
      "exit 1",
      "",
    ].join("\n"));

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assertFinalRegressionFailure(tmp, result, {
      failureKind: "unattributed_existing_failure",
      retryable: false,
      nextAction: "user-confirmation",
    });
  });

  it("prioritizes a TAP assertion failure over an earlier successful not-found warning", async () => {
    tmp = createTmpDir("final-regression-assertion-after-warning-");
    const ctx = setupProject(tmp, [
      "printf '%s\\n' '# [text] WARN: analysis.json not found. Proceeding with empty analysis context.'",
      "printf '%s\\n' '# Subtest: flow state path ownership stays in the shared writer'",
      "printf '%s\\n' 'not ok 274 - flow state path ownership stays in the shared writer'",
      "printf '%s\\n' '  ---'",
      "printf '%s\\n' \"  failureType: 'testCodeFailure'\"",
      "printf '%s\\n' \"  error: 'direct flow.json sinks detected'\"",
      "printf '%s\\n' \"  code: 'ERR_ASSERTION'\"",
      "printf '%s\\n' '  ...'",
      shellPrintChildProcessRecord({
        stderr: "ERR_ASSERTION\ntests/unit/flow-state-path.test.js: direct flow.json sinks detected\n",
      }),
      "exit 1",
      "",
    ].join("\n"));

    const result = await new RunFinalRegressionCommand().execute(ctx);

    const artifact = assertFinalRegressionFailure(tmp, result, {
      failureKind: "unattributed_existing_failure",
      retryable: false,
      nextAction: "user-confirmation",
    });
    assert.equal(artifact.failureCategory, "existing_failure");
    assert.equal(artifact.failureNature, "assertion");
    assert.match(artifact.failureSummary, /not ok 274.*flow state path ownership/);
    assert.match(artifact.failureSummary, /direct flow\.json sinks detected/);
    assert.doesNotMatch(artifact.failureSummary, /analysis\.json not found/);
  });

  it("attributes all real TAP failures while summarizing the first failure block", async () => {
    tmp = createTmpDir("final-regression-multiple-tap-failures-");
    const ctx = setupProject(tmp, PASSING_FIXTURE_BODY);
    writeFile(tmp, FIXTURE_PATH, [
      "printf '%s\\n' '# not ok 900 - diagnostic comment only'",
      "printf '%s\\n' '# Subtest: existing assertion'",
      "printf '%s\\n' 'not ok 1 - existing assertion'",
      "printf '%s\\n' '  ---'",
      "printf '%s\\n' \"  error: 'tests/unit/existing.test.js failed'\"",
      "printf '%s\\n' \"  code: 'ERR_ASSERTION'\"",
      "printf '%s\\n' '  ...'",
      "printf '%s\\n' '# Subtest: current assertion'",
      "printf '%s\\n' 'not ok 2 - current assertion'",
      "printf '%s\\n' '  ---'",
      `printf '%s\\n' "  error: '${FIXTURE_PATH} failed'"`,
      "printf '%s\\n' \"  code: 'ERR_ASSERTION'\"",
      "printf '%s\\n' '  ...'",
      shellPrintChildProcessRecord({
        stderr: [
          "ERR_ASSERTION",
          "tests/unit/existing.test.js failed",
          `${FIXTURE_PATH} failed`,
          "",
        ].join("\n"),
      }),
      "exit 1",
      "",
    ].join("\n"));

    const result = await new RunFinalRegressionCommand().execute(ctx);

    const artifact = assertFinalRegressionFailure(tmp, result, {
      failureKind: "caused_by_current_change",
      retryable: true,
      nextAction: "regression-repair",
    });
    assert.equal(artifact.failureCategory, "caused_by_current_change");
    assert.equal(artifact.failureNature, "assertion");
    assert.equal(artifact.currentDiffRelationship, "current-diff");
    assert.equal(artifact.recordAndProceed.eligible, false);
    assert.match(artifact.failureSummary, /not ok 1 - existing assertion/);
    assert.doesNotMatch(artifact.failureSummary, /diagnostic comment only/);
    assert.doesNotMatch(artifact.failureSummary, /not ok 2 - current assertion/);
  });

  it("fails closed on silent non-zero test runner exits without typed child evidence", async () => {
    tmp = createTmpDir("final-regression-silent-fail-");
    const ctx = setupProject(tmp, "exit 1\n");

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assertFinalRegressionFailure(tmp, result, {
      failureKind: "unattributed_unknown_failure",
      retryable: false,
      nextAction: "stop",
    });
  });

  it("fails closed as unknown when a non-zero runner reports zero totals without typed child evidence", async () => {
    tmp = createTmpDir("final-regression-zero-detail-fail-");
    const ctx = setupProject(tmp, [
      "printf '%s\\n' 'unit: 0'",
      "printf '%s\\n' 'integration: 0'",
      "printf '%s\\n' 'acceptance: 0'",
      "exit 1",
      "",
    ].join("\n"));

    const result = await new RunFinalRegressionCommand().execute(ctx);

    const artifact = assertFinalRegressionFailure(tmp, result, {
      failureKind: "unattributed_unknown_failure",
      retryable: false,
      nextAction: "stop",
    });
    assert.equal(artifact.failureCategory, "unknown");
    assert.equal(artifact.failureNature, "execution");
    assert.equal(artifact.recordAndProceed.eligible, false);
    assert.equal(artifact.nextRecommendedAction, "stop");
  });

  it("classifies child-process EPERM output distinctly", async () => {
    tmp = createTmpDir("final-regression-eperm-");
    const error = new Error("spawn EPERM");
    error.code = "EPERM";
    const ctx = setupProject(tmp, [
      shellPrintChildProcessRecord({ status: null, error }),
      "exit 1",
      "",
    ].join("\n"));

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assertFinalRegressionFailure(tmp, result, {
      failureKind: "child_process_eperm",
      retryable: false,
      nextAction: "stop",
    });
  });

  it("stops on the second final-regression failure and omits previous failure state", async () => {
    tmp = createTmpDir("final-regression-second-fail-");
    const ctx = setupProject(tmp, PASSING_FIXTURE_BODY);
    writeChangedFileReferencingFailureFixture(tmp, "still failing");

    await new RunFinalRegressionCommand().execute(ctx);
    const second = await new RunFinalRegressionCommand().execute(ctx);

    const artifact = assertFinalRegressionFailure(tmp, second, {
      failureKind: "caused_by_current_change",
      retryable: false,
      nextAction: "stop",
    });
    assert.ok(!Object.hasOwn(artifact, "previousFailureKind"), "previousFailureKind must not appear in the artifact");
    assert.equal(artifact.rawOutputPath, attemptLogPath(2));
  });

  it("keeps per-attempt final-regression logs", async () => {
    tmp = createTmpDir("final-regression-attempt-logs-");
    const ctx = setupProject(tmp, "printf '%s\\n' 'final pass'\n");

    await new RunFinalRegressionCommand().execute(ctx);
    await new RunFinalRegressionCommand().execute(ctx);

    const artifact = readFinalRegressionArtifact(tmp);
    assert.equal(artifact.rawOutputPath, attemptLogPath(2));
    assert.ok(fs.existsSync(path.join(tmp, attemptLogPath(1))));
    assert.ok(fs.existsSync(path.join(tmp, attemptLogPath(2))));
  });

  it("stops before project tests when worktreePath does not match ctx.root", async () => {
    tmp = createTmpDir("final-regression-worktree-root-");
    const fixtureBody = failingFixtureBody("PROJECT_TEST_RAN");
    const ctx = setupProject(tmp, fixtureBody, {
      worktree: true,
      worktreePath: path.join(tmp, "different-active-worktree"),
    });
    fs.mkdirSync(ctx.flowState.worktreePath, { recursive: true });

    const result = await new RunFinalRegressionCommand().execute(ctx);

    const artifact = assertFinalRegressionFailure(tmp, result, {
      failureKind: "infra_failure",
      retryable: false,
      nextAction: "stop",
    });
    assert.equal(artifact.rawOutputPath, attemptLogPath(1));
    const raw = fs.readFileSync(path.join(tmp, attemptLogPath(1)), "utf8");
    assert.doesNotMatch(raw, /PROJECT_TEST_RAN/);
  });
});
