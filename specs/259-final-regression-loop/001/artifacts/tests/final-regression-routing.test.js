// spec: R2 R3 R4 R5 R7
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";
import { FLOW_DEFINITION, flattenSteps, findStepById } from "../../../src/flow/definition.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createContext(tmp, config = { test: { command: "node final-regression-fixture.js", timeout: 5 } }) {
  return {
    root: tmp,
    config,
    flowState: {
      spec: "specs/001-test/spec.md",
      baseBranch: "main",
      featureBranch: "feature/001-test",
    },
  };
}

function writeSpec(tmp) {
  writeFile(tmp, "specs/001-test/spec.md", "# Spec\n");
}

let tmp;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

test("R2: final-regression pass writes the result artifact and raw log", async () => {
  tmp = createTmpDir("spec259-final-pass-");
  writeSpec(tmp);
  writeFile(tmp, "final-regression-fixture.js", "console.log('final pass');\n");
  initGitRepo(tmp);
  commitAll(tmp, "initial");

  const result = await new RunFinalRegressionCommand().execute(createContext(tmp));
  const artifactPath = path.join(tmp, "specs/001-test/final-regression-result.json");
  const rawLogPath = path.join(tmp, "specs/001-test/tests/.raw/final-regression.log");

  assert.equal(result.result, "pass");
  assert.equal(result.next, "finalize-commit");
  assert.ok(fs.existsSync(rawLogPath));
  assert.equal(validateFinalRegressionResult(readJson(artifactPath)).completed, true);
});

test("R3: pass artifact has required routing fields and finalize-commit next action", async () => {
  tmp = createTmpDir("spec259-final-fields-");
  writeSpec(tmp);
  writeFile(tmp, "final-regression-fixture.js", "console.log('final pass');\n");
  initGitRepo(tmp);
  commitAll(tmp, "initial");

  await new RunFinalRegressionCommand().execute(createContext(tmp));
  const artifact = validateFinalRegressionResult(readJson(path.join(tmp, "specs/001-test/final-regression-result.json")));

  for (const key of [
    "version",
    "result",
    "completed",
    "failureKind",
    "command",
    "rawOutputPath",
    "retryable",
    "nextAction",
    "changedFiles",
    "previousFailureKind",
    "rawOutputLines",
    "process",
  ]) {
    assert.ok(Object.hasOwn(artifact, key), `${key} is present`);
  }
  assert.equal(artifact.failureKind, null);
  assert.equal(artifact.retryable, false);
  assert.equal(artifact.nextAction, "finalize-commit");
});

test("R4: generic failure without changed-file evidence does not route to regression-repair", async () => {
  tmp = createTmpDir("spec259-final-current-link-");
  writeSpec(tmp);
  writeFile(tmp, "src/app.js", "export const mode = 'pass';\n");
  writeFile(tmp, "final-regression-fixture.js", [
    "import fs from 'node:fs';",
    "const src = fs.readFileSync('src/app.js', 'utf8');",
    "if (src.includes('fail')) {",
    "  console.error('generic regression failure');",
    "  process.exit(1);",
    "}",
    "console.log('final pass');",
  ].join("\n"));
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  writeFile(tmp, "src/app.js", "export const mode = 'fail';\n");

  const result = await new RunFinalRegressionCommand().execute(createContext(tmp));

  assert.equal(result.ok, false);
  assert.notEqual(result.data.failureKind, "caused_by_current_change");
  assert.notEqual(result.data.nextAction, "regression-repair");
});

test("R5: invalid project test routes to test-repair once, then stops without mutating project files", async () => {
  tmp = createTmpDir("spec259-final-invalid-test-");
  writeSpec(tmp);
  writeFile(tmp, "src/app.js", "export const value = 1;\n");
  writeFile(tmp, "tests/project.test.js", "console.log('project test placeholder');\n");
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  const sourceBefore = fs.readFileSync(path.join(tmp, "src/app.js"), "utf8");
  const testBefore = fs.readFileSync(path.join(tmp, "tests/project.test.js"), "utf8");
  const noCommandContext = createContext(tmp, {});

  const first = await new RunFinalRegressionCommand().execute(noCommandContext);
  const second = await new RunFinalRegressionCommand().execute(noCommandContext);
  const artifact = validateFinalRegressionResult(readJson(path.join(tmp, "specs/001-test/final-regression-result.json")));

  assert.equal(first.data.failureKind, "invalid_project_test");
  assert.equal(first.data.retryable, true);
  assert.equal(first.data.nextAction, "test-repair");
  assert.equal(second.data.failureKind, "invalid_project_test");
  assert.equal(second.data.retryable, false);
  assert.equal(second.data.nextAction, "stop");
  assert.equal(artifact.previousFailureKind, "invalid_project_test");
  assert.equal(fs.readFileSync(path.join(tmp, "src/app.js"), "utf8"), sourceBefore);
  assert.equal(fs.readFileSync(path.join(tmp, "tests/project.test.js"), "utf8"), testBefore);
});

test("R7: final-regression is a mainline impl step before finalize-commit", () => {
  const ids = flattenSteps(FLOW_DEFINITION).map((node) => node.id);
  const retroIndex = ids.indexOf("retro");
  const finalRegressionIndex = ids.indexOf("final-regression");
  const finalizeCommitIndex = ids.indexOf("finalize-commit");
  const node = findStepById(FLOW_DEFINITION, "final-regression");

  assert.ok(retroIndex >= 0);
  assert.ok(finalRegressionIndex > retroIndex);
  assert.ok(finalizeCommitIndex > finalRegressionIndex);
  assert.equal(node.action, "run-final-regression");
  assert.equal(node.instructionsKey, "impl.final-regression");
  assert.equal(node.outputSchemaRef, "next-action/final-regression.schema.json");
  assert.equal(node.requiresApproval, false);
});
