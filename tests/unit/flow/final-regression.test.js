import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../helpers/git-repo.js";

const FIXTURE_PATH = "final-regression-fixture.js";
const PASSING_FIXTURE_BODY = "console.log('initial pass');\n";

function setupProject(tmp, scriptBody) {
  fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
  writeFile(tmp, "specs/001-test/spec.md", "# Spec\n");
  writeFile(tmp, FIXTURE_PATH, scriptBody);
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  return {
    root: tmp,
    config: { test: { command: `node ${FIXTURE_PATH}`, timeout: 5 } },
    flowState: {
      spec: "specs/001-test/spec.md",
      baseBranch: "main",
      featureBranch: "feature/001-test",
    },
  };
}

function writeChangedFileReferencingFailureFixture(tmp, message) {
  writeFile(tmp, FIXTURE_PATH, [
    `console.error(${JSON.stringify(`${FIXTURE_PATH}: ${message}`)});`,
    "process.exit(1);",
    "",
  ].join("\n"));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

describe("flow run final-regression", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("writes a pass artifact and returns finalize-commit as next action", async () => {
    tmp = createTmpDir("final-regression-pass-");
    const ctx = setupProject(tmp, "console.log('final pass');\n");

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.result, "pass");
    assert.equal(result.next, "finalize-commit");
    const artifactPath = path.join(tmp, "specs/001-test/final-regression-result.json");
    const artifact = validateFinalRegressionResult(readJson(artifactPath));
    assert.equal(artifact.result, "pass");
    assert.equal(artifact.failureKind, null);
    assert.equal(artifact.nextAction, "finalize-commit");
    assert.equal(artifact.completed, true);
    assert.ok(fs.existsSync(path.join(tmp, "specs/001-test/tests/.raw/final-regression.log")));
  });

  it("classifies current-change failure, records issue-log, and allows one repair retry", async () => {
    tmp = createTmpDir("final-regression-fail-");
    const ctx = setupProject(tmp, PASSING_FIXTURE_BODY);
    writeChangedFileReferencingFailureFixture(tmp, "boom");

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "FINAL_REGRESSION_FAILED");
    assert.equal(result.data.failureKind, "caused_by_current_change");
    assert.equal(result.data.retryable, true);
    assert.equal(result.data.nextAction, "regression-repair");

    const artifact = validateFinalRegressionResult(readJson(path.join(tmp, "specs/001-test/final-regression-result.json")));
    assert.equal(artifact.failureKind, "caused_by_current_change");
    assert.equal(artifact.retryable, true);

    const issueLog = readJson(path.join(tmp, "specs/001-test/issue-log.json"));
    assert.equal(issueLog.entries.length, 1);
    assert.equal(issueLog.entries[0].step, "final-regression");
    assert.equal(issueLog.entries[0].failureKind, "caused_by_current_change");
  });

  it("classifies failure with no project change as pre-existing", async () => {
    tmp = createTmpDir("final-regression-pre-existing-");
    const ctx = setupProject(tmp, "console.error('existing failure');\nprocess.exit(1);\n");

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.ok, false);
    assert.equal(result.data.failureKind, "pre_existing");
    assert.equal(result.data.retryable, false);
    assert.equal(result.data.nextAction, "user-confirmation");
    const artifact = validateFinalRegressionResult(readJson(path.join(tmp, "specs/001-test/final-regression-result.json")));
    assert.equal(artifact.failureKind, "pre_existing");
  });

  it("classifies silent non-zero test runner exits as infrastructure failure", async () => {
    tmp = createTmpDir("final-regression-silent-fail-");
    const ctx = setupProject(tmp, "process.exit(1);\n");

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.ok, false);
    assert.equal(result.data.failureKind, "infra_failure");
    assert.equal(result.data.retryable, false);
    assert.equal(result.data.nextAction, "stop");
    const artifact = validateFinalRegressionResult(readJson(path.join(tmp, "specs/001-test/final-regression-result.json")));
    assert.equal(artifact.failureKind, "infra_failure");
  });

  it("stops on the second final-regression failure", async () => {
    tmp = createTmpDir("final-regression-second-fail-");
    const ctx = setupProject(tmp, PASSING_FIXTURE_BODY);
    writeChangedFileReferencingFailureFixture(tmp, "still failing");

    await new RunFinalRegressionCommand().execute(ctx);
    const second = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(second.ok, false);
    assert.equal(second.data.failureKind, "caused_by_current_change");
    assert.equal(second.data.retryable, false);
    assert.equal(second.data.nextAction, "stop");
    const artifact = validateFinalRegressionResult(readJson(path.join(tmp, "specs/001-test/final-regression-result.json")));
    assert.equal(artifact.previousFailureKind, "caused_by_current_change");
  });
});
