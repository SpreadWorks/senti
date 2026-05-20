// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const fixturePath = "final-regression-fixture.sh";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function setupProject(tmp, scriptBody, flowStateOverrides = {}) {
  fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
  writeFile(tmp, "specs/001-test/spec.json", JSON.stringify({
    goal: "fixture",
    requirements: [],
  }, null, 2));
  writeFile(tmp, fixturePath, scriptBody);
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  return {
    root: tmp,
    config: { test: { command: `sh ${fixturePath}`, timeout: 5 } },
    flowState: {
      spec: "specs/001-test/spec.json",
      baseBranch: "main",
      featureBranch: "feature/001-test",
      ...flowStateOverrides,
    },
  };
}

function failingFixtureBody(message) {
  return `printf '%s\\n' ${JSON.stringify(message)} >&2\nexit 1\n`;
}

function artifactPath(tmp) {
  return path.join(tmp, "specs/001-test/final-regression-result.json");
}

function rawPath(tmp, relPath) {
  return path.join(tmp, relPath);
}

describe("spec 262 final-regression evidence", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: renames unattributed final-regression failures", async () => {
    tmp = createTmpDir("spec-262-r1-");
    const ctx = setupProject(tmp, failingFixtureBody("existing failure"));

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.ok, false);
    assert.equal(result.data.failureKind, "unattributed_existing_failure");
    const artifact = validateFinalRegressionResult(readJson(artifactPath(tmp)));
    assert.equal(artifact.failureKind, "unattributed_existing_failure");
  });

  it("R2: keeps environment failures out of unattributed classification and rejects the legacy kind", async () => {
    tmp = createTmpDir("spec-262-r2-");
    const ctx = setupProject(tmp, "exit 1\n");

    const result = await new RunFinalRegressionCommand().execute(ctx);
    const artifact = validateFinalRegressionResult(readJson(artifactPath(tmp)));

    assert.equal(result.data.failureKind, "infra_failure");
    assert.notEqual(artifact.failureKind, "unattributed_existing_failure");
    assert.throws(
      () => validateFinalRegressionResult({ ...artifact, failureKind: "pre_existing" }),
      /final-regression failureKind invalid: pre_existing/,
    );
  });

  it("R2: classifies child-process EPERM output with the correctly spelled failure kind", async () => {
    tmp = createTmpDir("spec-262-r2-eperm-");
    const ctx = setupProject(tmp, failingFixtureBody("spawn EPERM"));

    const result = await new RunFinalRegressionCommand().execute(ctx);
    const artifact = validateFinalRegressionResult(readJson(artifactPath(tmp)));

    assert.equal(result.data.failureKind, "child_process_eperm");
    assert.equal(artifact.failureKind, "child_process_eperm");
  });

  it("R3: removes previous failure state from current-run artifacts", async () => {
    tmp = createTmpDir("spec-262-r3-");
    const ctx = setupProject(tmp, failingFixtureBody("first failure"));

    await new RunFinalRegressionCommand().execute(ctx);
    writeFile(tmp, fixturePath, "printf '%s\\n' 'now passing'\n");
    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.result, "pass");
    const artifact = validateFinalRegressionResult(readJson(artifactPath(tmp)));
    assert.equal(Object.hasOwn(artifact, "previousFailureKind"), false);
  });

  it("R4: retains a distinct raw log for every final-regression attempt", async () => {
    tmp = createTmpDir("spec-262-r4-");
    const ctx = setupProject(tmp, "printf '%s\\n' 'pass'\n");

    await new RunFinalRegressionCommand().execute(ctx);
    await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(fs.existsSync(rawPath(tmp, "specs/001-test/tests/.raw/final-regression-attempt-001.log")), true);
    assert.equal(fs.existsSync(rawPath(tmp, "specs/001-test/tests/.raw/final-regression-attempt-002.log")), true);
  });

  it("R5: points result artifacts and issue-log entries at the matching attempt log", async () => {
    tmp = createTmpDir("spec-262-r5-");
    const ctx = setupProject(tmp, failingFixtureBody("failure"));

    await new RunFinalRegressionCommand().execute(ctx);
    const artifact = validateFinalRegressionResult(readJson(artifactPath(tmp)));
    const issueLog = readJson(path.join(tmp, "specs/001-test/issue-log.json"));

    assert.equal(artifact.rawOutputPath, "specs/001-test/tests/.raw/final-regression-attempt-001.log");
    assert.equal(issueLog.entries[0].rawOutputPath, artifact.rawOutputPath);
  });

  it("R6: stops worktree root mismatches before project tests start", async () => {
    tmp = createTmpDir("spec-262-r6-");
    const markerPath = path.join(tmp, "project-test-ran.txt");
    const commandBody = [
      `printf '%s' 'ran' > ${JSON.stringify(markerPath)}`,
      "printf '%s\\n' 'should not run'",
      "",
    ].join("\n");
    const ctx = setupProject(tmp, commandBody, {
      worktree: true,
      worktreePath: path.join(tmp, "different-active-worktree"),
    });
    fs.mkdirSync(ctx.flowState.worktreePath, { recursive: true });

    const result = await new RunFinalRegressionCommand().execute(ctx);

    assert.equal(result.ok, false);
    assert.equal(result.data.failureKind, "infra_failure");
    assert.equal(result.data.retryable, false);
    assert.equal(result.data.nextAction, "stop");
    assert.equal(fs.existsSync(markerPath), false);
  });

  it("R7: records result, attribution, retryability, and flow action as separate output signals", async () => {
    tmp = createTmpDir("spec-262-r7-");
    const ctx = setupProject(tmp, failingFixtureBody("failure"));

    await new RunFinalRegressionCommand().execute(ctx);
    const artifact = validateFinalRegressionResult(readJson(artifactPath(tmp)));
    const raw = fs.readFileSync(path.join(tmp, artifact.rawOutputPath), "utf8");

    assert.equal(artifact.result, "fail");
    assert.equal(typeof artifact.failureKind, "string");
    assert.equal(typeof artifact.retryable, "boolean");
    assert.equal(typeof artifact.nextAction, "string");
    assert.match(raw, /^result: fail$/m);
    assert.match(raw, /^failureKind: unattributed_existing_failure$/m);
    assert.match(raw, /^retryable: false$/m);
    assert.match(raw, /^nextAction: user-confirmation$/m);
  });

  it("R8: updates guidance and durable artifact references for the new final-regression contract", () => {
    const prompt = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/impl/final-regression.md"), "utf8");
    const artifacts = fs.readFileSync(path.join(repoRoot, "src/flow/lib/test-artifacts.js"), "utf8");

    assert.match(prompt, /unattributed_existing_failure/);
    assert.doesNotMatch(prompt, /\bpre_existing\b/);
    assert.match(artifacts, /tests\/\.raw\/final-regression-attempt-\*\.log/);
  });

  it("R9: keeps shared unit coverage aligned with the production contracts", () => {
    const unitTest = fs.readFileSync(path.join(repoRoot, "tests/unit/flow/final-regression.test.js"), "utf8");

    assert.match(unitTest, /unattributed_existing_failure/);
    assert.match(unitTest, /previousFailureKind/);
    assert.match(unitTest, /attempt-001/);
    assert.match(unitTest, /worktree root|root mismatch|worktreePath/);
  });
});
