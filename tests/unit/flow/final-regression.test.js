import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../helpers/git-repo.js";

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

  it("writes a pass artifact and returns finalize-commit as next action", async () => {
    tmp = createTmpDir("final-regression-pass-");
    const ctx = setupProject(tmp, "printf '%s\\n' 'final pass'\n");

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.result, "pass");
    assert.equal(result.next, "finalize-commit");
    const artifact = readFinalRegressionArtifact(tmp);
    assert.equal(artifact.result, "pass");
    assert.equal(artifact.failureKind, null);
    assert.equal(artifact.nextAction, "finalize-commit");
    assert.equal(artifact.completed, true);
    assert.equal(artifact.rawOutputPath, "specs/001-test/tests/.raw/final-regression-attempt-001.log");
    assert.ok(fs.existsSync(path.join(tmp, attemptLogPath(1))));
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
    const ctx = setupProject(tmp, failingFixtureBody("existing failure"));

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assertFinalRegressionFailure(tmp, result, {
      failureKind: "unattributed_existing_failure",
      retryable: false,
      nextAction: "user-confirmation",
    });
  });

  it("classifies silent non-zero test runner exits as infrastructure failure", async () => {
    tmp = createTmpDir("final-regression-silent-fail-");
    const ctx = setupProject(tmp, "exit 1\n");

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assertFinalRegressionFailure(tmp, result, {
      failureKind: "infra_failure",
      retryable: false,
      nextAction: "stop",
    });
  });

  it("classifies child-process EPERM output distinctly", async () => {
    tmp = createTmpDir("final-regression-eperm-");
    const ctx = setupProject(tmp, failingFixtureBody("spawn EPERM"));

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
