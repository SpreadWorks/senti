// spec: R1 R2 R3 R4 R5 R6 R7 R8
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  checkIntegrationTestArtifacts,
} from "../../../src/flow/lib/run-gate.js";
import RunRewindTestEvidenceCommand from "../../../src/flow/lib/run-rewind-test-evidence.js";
import {
  buildRepairFingerprint,
  writeRepairEvidenceArtifact,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  makeFlowState,
  moveFlowToStep,
} from "../../../tests/helpers/flow-setup.js";
import {
  commitAll,
  initGitRepo,
} from "../../../tests/helpers/git-repo.js";
import {
  createTmpDir,
  removeTmpDir,
  writeFile,
  writeJson,
} from "../../../tests/helpers/tmp-dir.js";

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) removeTmpDir(root);
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function standaloneTestEnvironment() {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  return environment;
}

function rewriteJson(file, mutator) {
  const value = readJson(file);
  mutator(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function flowStateAtImplGate(specPath) {
  return moveFlowToStep(makeFlowState({
    spec: specPath,
    runId: "spec-334-test-run",
    issue: 457,
    request: "Verify stale test evidence recovery.",
  }), "impl-gate");
}

function prepareRoot() {
  const root = createTmpDir("spec-334-stale-evidence-");
  temporaryRoots.push(root);
  writeJson(root, ".senti/config.json", {
    name: "stale-evidence-test",
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  writeFile(root, "src/demo.js", "export const demo = 'before-repair';\n");
  writeJson(root, "specs/demo/spec.json", {
    requirements: [{
      id: "R1",
      desc: "demo requirement",
      priority: "must",
    }],
  });
  writeJson(root, "specs/demo/file-map.json", {
    R1: ["src/demo.js"],
  });
  initGitRepo(root);
  commitAll(root, "Create stale evidence fixture");
  return {
    root,
    specDir: path.join(root, "specs", "demo"),
    specPath: "specs/demo/spec.json",
  };
}

function writeAuthoritativeEvidence(fixture) {
  const testFile = "specs/demo/tests/stale-evidence.test.js";
  const scenarioRaw = "specs/demo/tests/.raw/scenario-validity.log";
  const executionRaw = "specs/demo/tests/.raw/test-execution.log";
  writeFile(fixture.root, testFile, "test('R1: demo requirement', () => {});\n");
  writeFile(fixture.root, scenarioRaw, "R1 expected failure\n");
  writeFile(fixture.root, executionRaw, "R1 pass\n");
  writeJson(fixture.specDir, "scenario-validity-result.json", {
    version: "1",
    raw_output_path: scenarioRaw,
    command: `node ${testFile}`,
    process: {
      started: true,
      exitCode: 1,
      signal: null,
      timedOut: false,
      spawnError: null,
    },
    result: "pass",
    summary: [{
      id: "R1",
      classification: "expected_fail",
      evidence: {
        test_file: testFile,
        test_name: "R1: demo requirement",
        command: `node ${testFile}`,
        raw_output_lines: { start_line: 1, end_line: 1 },
      },
    }],
  });
  const fingerprint = buildRepairFingerprint({
    root: fixture.root,
    specPath: fixture.specPath,
  });
  writeRepairEvidenceArtifact({
    specDir: fixture.specDir,
    stepId: "test-execute",
    fingerprint,
    artifact: {
      version: "2",
      raw_output_path: executionRaw,
      summary: [{
        id: "R1",
        result: "pass",
        evidence: {
          test_file: testFile,
          test_name: "R1: demo requirement",
          command: `node --test ${testFile}`,
          raw_output_lines: { start_line: 1, end_line: 1 },
        },
      }],
      regression: {
        required: false,
        result: "skipped",
        mode: "none",
        changed_files: [],
        trigger_relevant_changed_files: [],
        category: "spec-artifact-only",
        reason: "spec verification fixture",
        classified_paths: [],
      },
    },
  });
  writeRepairEvidenceArtifact({
    specDir: fixture.specDir,
    stepId: "test-result-review",
    fingerprint,
    artifact: {
      verdict: "pass",
      checked_items: [{
        check: "project_regression_verification",
        result: "pass",
        detail: "verified",
      }],
      result_file_path: "specs/demo/test-execute-result.json",
      raw_output_path: executionRaw,
    },
  });
  return fingerprint;
}

function prepareEvidence({
  stale = true,
  summaryResult = "pass",
  reviewVerdict = "pass",
} = {}) {
  const fixture = prepareRoot();
  const previousFingerprint = writeAuthoritativeEvidence(fixture);
  commitAll(fixture.root, "Record authoritative test evidence");
  if (stale) {
    writeFile(fixture.root, "src/demo.js", "export const demo = 'after-repair';\n");
  }
  const executePath = path.join(fixture.specDir, "test-execute-result.json");
  rewriteJson(executePath, (artifact) => {
    artifact.summary[0].result = summaryResult;
  });
  const reviewPath = path.join(fixture.specDir, "test-result-review.json");
  rewriteJson(reviewPath, (artifact) => {
    artifact.verdict = reviewVerdict;
    if (reviewVerdict === "fail") {
      artifact.invalid_reason = "requirement result needs a fresh execution";
    }
  });
  const state = flowStateAtImplGate(fixture.specPath);
  return {
    ...fixture,
    state,
    previousFingerprint,
    currentFingerprint: buildRepairFingerprint({
      root: fixture.root,
      specPath: fixture.specPath,
      state,
    }),
    executePath,
    reviewPath,
  };
}

function integrationCheck(fixture) {
  return checkIntegrationTestArtifacts(
    fixture.root,
    fixture.state,
    "integration",
    "integration",
  );
}

function recover(fixture, staleEvidence) {
  const flowManager = {
    mutate(mutator) {
      mutator(fixture.state);
      return fixture.state;
    },
  };
  return staleEvidence.recover({ flowManager }, {
    level: "integration",
    phase: "integration",
    specDir: fixture.specDir,
  });
}

function assertRecoverable(value) {
  assert.equal(typeof value?.recover, "function", JSON.stringify(value));
}

test("R1: failed requirement evidence reaches stale fingerprint classification", () => {
  const fixture = prepareEvidence({ summaryResult: "fail" });
  const result = integrationCheck(fixture);
  assertRecoverable(result);
});

test("R2: failed review evidence with a material fingerprint change is stale", () => {
  const fixture = prepareEvidence({ reviewVerdict: "fail" });
  const result = integrationCheck(fixture);
  assertRecoverable(result);
  assert.notEqual(fixture.previousFingerprint.hash, fixture.currentFingerprint.hash);
});

test("R3: the gate-owned recovery invalidates evidence and reactivates test-execute", () => {
  const fixture = prepareEvidence({ summaryResult: "fail" });
  const staleEvidence = integrationCheck(fixture);
  assertRecoverable(staleEvidence);
  const result = recover(fixture, staleEvidence);

  assert.equal(result.result, "recovered");
  assert.equal(result.next, "test-execute");
  assert.equal(result.artifacts.evidenceRefresh.previousFingerprint, fixture.previousFingerprint.hash);
  assert.equal(result.artifacts.evidenceRefresh.currentFingerprint, fixture.currentFingerprint.hash);
  assert.equal(result.artifacts.evidenceRefresh.activeStep, "test-execute");
  assert.ok(
    result.artifacts.evidenceRefresh.invalidatedArtifacts.includes("test-execute-result.json"),
  );
  assert.ok(
    result.artifacts.evidenceRefresh.invalidatedArtifacts.includes("test-result-review.json"),
  );
  assert.equal(findStepById(fixture.state.steps, "test-execute").status, "in_progress");
  assert.equal(findStepById(fixture.state.steps, "impl-gate").status, "pending");
  assert.equal(fs.existsSync(fixture.executePath), false);
  assert.equal(fs.existsSync(fixture.reviewPath), false);
});

test("R4: a failed lifecycle mutation leaves stale artifacts available for retry", () => {
  const fixture = prepareEvidence();
  const staleEvidence = integrationCheck(fixture);
  assertRecoverable(staleEvidence);
  const originalSteps = structuredClone(fixture.state.steps);

  assert.throws(() => staleEvidence.recover({
    flowManager: {
      mutate() {
        throw new Error("injected flow mutation failure");
      },
    },
  }, {
    level: "integration",
    phase: "integration",
    specDir: fixture.specDir,
  }), /injected flow mutation failure/);

  assert.deepEqual(fixture.state.steps, originalSteps);
  assert.equal(fs.existsSync(fixture.executePath), true);
  assert.equal(fs.existsSync(fixture.reviewPath), true);
});

test("R5: invalid fingerprint authority fails closed without a recovery mutation", () => {
  const cases = [
    {
      name: "invalid fingerprints",
      mutate(fixture) {
        rewriteJson(fixture.executePath, (artifact) => {
          artifact.repairFingerprint = "not-a-sha256-digest";
        });
        rewriteJson(fixture.reviewPath, (artifact) => {
          artifact.repairFingerprint = "not-a-sha256-digest";
        });
      },
    },
    {
      name: "inconsistent fingerprints",
      mutate(fixture) {
        rewriteJson(fixture.reviewPath, (artifact) => {
          artifact.repairFingerprint = "b".repeat(64);
        });
      },
    },
    {
      name: "malformed JSON",
      mutate(fixture) {
        fs.writeFileSync(fixture.executePath, "{\"version\":");
      },
    },
    {
      name: "schema-invalid artifact",
      mutate(fixture) {
        rewriteJson(fixture.executePath, (artifact) => {
          delete artifact.summary;
        });
      },
    },
    {
      name: "unowned result path",
      mutate(fixture) {
        rewriteJson(fixture.reviewPath, (artifact) => {
          artifact.result_file_path = "specs/other/test-execute-result.json";
        });
      },
    },
    {
      name: "invalid raw evidence",
      mutate(fixture) {
        rewriteJson(fixture.executePath, (artifact) => {
          artifact.summary[0].evidence.raw_output_lines.end_line = 999;
        });
      },
    },
    {
      name: "placeholder without permission",
      mutate(fixture) {
        rewriteJson(fixture.executePath, (artifact) => {
          artifact.summary[0].evidence.command = "TODO";
        });
      },
    },
    {
      name: "missing required input",
      executeExists: false,
      mutate(fixture) {
        fs.renameSync(fixture.executePath, `${fixture.executePath}.missing`);
      },
    },
    {
      name: "missing review input",
      reviewExists: false,
      mutate(fixture) {
        fs.renameSync(fixture.reviewPath, `${fixture.reviewPath}.missing`);
      },
    },
  ];

  for (const testCase of cases) {
    const fixture = prepareEvidence();
    testCase.mutate(fixture);
    const originalSteps = structuredClone(fixture.state.steps);
    let result;
    assert.doesNotThrow(() => {
      result = integrationCheck(fixture);
    }, testCase.name);
    assert.equal(result?.ok, false, `${testCase.name}: ${JSON.stringify(result)}`);
    assert.deepEqual(fixture.state.steps, originalSteps, testCase.name);
    assert.equal(
      fs.existsSync(fixture.reviewPath),
      testCase.reviewExists ?? true,
      `${testCase.name}: review evidence must not be invalidated`,
    );
    assert.equal(
      fs.existsSync(fixture.executePath),
      testCase.executeExists ?? true,
      `${testCase.name}: execute evidence must not be invalidated`,
    );
  }
});

test("R6: unchanged failed evidence still fails after stale recovery is available", () => {
  const staleFixture = prepareEvidence({ summaryResult: "fail" });
  assertRecoverable(integrationCheck(staleFixture));

  const currentFixture = prepareEvidence({
    stale: false,
    summaryResult: "fail",
  });
  const result = integrationCheck(currentFixture);
  assert.equal(result?.ok, false, JSON.stringify(result));
  assert.match(JSON.stringify(result), /spec-local requirement tests failed: R1/);
  assert.equal(findStepById(currentFixture.state.steps, "impl-gate").status, "in_progress");
  assert.equal(fs.existsSync(currentFixture.executePath), true);
});

test("R7: trusted current evidence and explicit rewind guard behavior remain intact", async () => {
  const staleFixture = prepareEvidence({ reviewVerdict: "fail" });
  assertRecoverable(integrationCheck(staleFixture));

  const currentFixture = prepareEvidence({ stale: false });
  assert.equal(integrationCheck(currentFixture), null);

  const command = new RunRewindTestEvidenceCommand();
  const rejected = await command.execute({
    flowState: currentFixture.state,
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.errors[0].code, "TARGET_GUARDS_REQUIRED");

  const focused = spawnSync(process.execPath, [
    "--test",
    "--test-name-pattern",
    "formal material repair|wrong lifecycle|symlinked or oversized|requires exact guards",
    "tests/unit/flow/rewind-test-evidence.test.js",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: standaloneTestEnvironment(),
  });
  assert.equal(
    focused.status,
    0,
    `focused rewind authority regression failed\n${focused.stdout}\n${focused.stderr}`,
  );
  for (const executedCase of [
    "refreshes stale tests from a formal material repair without resolving gate findings",
    "fails closed for wrong lifecycle, outcome, structural failure, and valid competing task authority",
    "rejects symlinked or oversized result, review, and raw evidence without mutation",
    "requires exact guards and lets dispatcher reject a mismatched target before mutation",
  ]) {
    assert.match(focused.stdout, new RegExp(`ok \\d+ - ${executedCase}`));
  }
  assert.match(focused.stdout, /# pass 4\b/);
  assert.match(focused.stdout, /# fail 0\b/);
});

test("R8: failed authoritative evidence variants share one recovery contract", () => {
  for (const variant of [
    { summaryResult: "fail", reviewVerdict: "pass" },
    { summaryResult: "pass", reviewVerdict: "fail" },
  ]) {
    const fixture = prepareEvidence(variant);
    const staleEvidence = integrationCheck(fixture);
    assertRecoverable(staleEvidence);
    const result = recover(fixture, staleEvidence);
    assert.equal(result.result, "recovered");
    assert.equal(result.next, "test-execute");
  }

  for (const variant of [
    {
      name: "malformed authority",
      mutate(fixture) {
        fs.writeFileSync(fixture.reviewPath, "{\"verdict\":");
      },
    },
    {
      name: "inconsistent authority",
      mutate(fixture) {
        rewriteJson(fixture.reviewPath, (artifact) => {
          artifact.repairFingerprint = "c".repeat(64);
        });
      },
    },
  ]) {
    const fixture = prepareEvidence();
    variant.mutate(fixture);
    let result;
    assert.doesNotThrow(() => {
      result = integrationCheck(fixture);
    }, variant.name);
    assert.equal(result?.ok, false, `${variant.name}: ${JSON.stringify(result)}`);
    assert.equal(findStepById(fixture.state.steps, "impl-gate").status, "in_progress");
  }
});
