// spec: R1 R2 R3 R4 R5

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const fixtureSpecId = "001-implement-evidence-fixture";
const fixtureSpecPath = `specs/${fixtureSpecId}/spec.json`;
const rewindTime = new Date("2026-01-01T00:00:00.000Z");
const beforeRewind = new Date("2025-12-31T23:59:59.000Z");
const afterRewind = new Date("2026-01-01T00:00:01.000Z");

async function loadPreValidator() {
  const file = path.join(repoRoot, "src/flow/lib/set-step.js");
  const module = await import(`${pathToFileURL(file).href}?spec335=${Date.now()}-${Math.random()}`);
  assert.equal(typeof module.preValidateImplementStepCompletion, "function");
  return module.preValidateImplementStepCompletion;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture(t, { withRewind = true, requirementStatus = "done" } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-implement-evidence-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const specDir = path.join(root, "specs", fixtureSpecId);
  const testsDir = path.join(specDir, "tests");
  const rawDir = path.join(testsDir, ".raw");
  fs.mkdirSync(rawDir, { recursive: true });
  writeJson(path.join(specDir, "spec.json"), {
    goal: "Fixture.",
    requirements: [
      {
        id: "R1",
        desc: "Fixture readiness.",
        priority: "must",
        status: requirementStatus,
      },
    ],
  });
  writeJson(path.join(specDir, "file-map.json"), { R1: ["src/fixture.js"] });
  fs.writeFileSync(
    path.join(testsDir, "fixture.test.js"),
    "test('R1: stale fixture', () => {});\n",
  );
  fs.writeFileSync(path.join(rawDir, "scenario-validity.log"), "R1 expected failure\n");
  return {
    root,
    specDir,
    state: {
      spec: fixtureSpecPath,
      steps: [],
      metrics: [],
      ...(withRewind
        ? {
            planRewinds: [
              {
                rewoundAt: rewindTime.toISOString(),
              },
            ],
          }
        : {}),
    },
  };
}

function validScenarioArtifact() {
  const testPath = `specs/${fixtureSpecId}/tests/fixture.test.js`;
  return {
    version: "1",
    result: "pass",
    raw_output_path: `specs/${fixtureSpecId}/tests/.raw/scenario-validity.log`,
    command: `node --test ${testPath}`,
    process: {
      started: true,
      exitCode: 1,
      signal: null,
      timedOut: false,
      spawnError: null,
    },
    summary: [
      {
        id: "R1",
        classification: "expected_fail",
        evidence: {
          test_file: testPath,
          test_name: "R1: stale fixture",
          command: `node --test ${testPath}`,
          raw_output_lines: {
            start_line: 1,
            end_line: 1,
          },
        },
      },
    ],
  };
}

function validTestExecuteArtifact() {
  const testPath = `specs/${fixtureSpecId}/tests/fixture.test.js`;
  return {
    version: "2",
    raw_output_path: `specs/${fixtureSpecId}/tests/.raw/test-execution.log`,
    summary: [
      {
        id: "R1",
        result: "pass",
        evidence: {
          test_file: testPath,
          test_name: "R1: stale fixture",
          command: `node --test ${testPath}`,
          raw_output_lines: {
            start_line: 1,
            end_line: 1,
          },
        },
      },
    ],
    regression: {
      required: false,
      category: "full-regression-deferred",
      reason: "Full project regression runs at final regression.",
      changed_files: [],
      trigger_relevant_changed_files: [],
      classified_paths: [],
    },
  };
}

function validTestResultReviewArtifact() {
  return {
    verdict: "pass",
    checked_items: [
      {
        check: "project_regression_verification",
        result: "pass",
        detail: "Full project regression is deferred to final regression.",
      },
    ],
  };
}

function writeTestExecutionRaw(specDir) {
  fs.writeFileSync(
    path.join(specDir, "tests", ".raw", "test-execution.log"),
    "R1: stale fixture\n",
  );
}

function writeArtifact(specDir, name, artifact, mtime) {
  const file = path.join(specDir, name);
  writeJson(file, artifact);
  fs.utimesSync(file, mtime, mtime);
  return file;
}

function issueCodes(result) {
  return result?.data?.issueCodes || [];
}

test("R1: retained readiness evidence before or exactly at the rewind boundary is stale", async (t) => {
  const preValidate = await loadPreValidator();
  for (const [name, artifactName, artifact] of [
    ["scenario validity", "scenario-validity-result.json", validScenarioArtifact()],
    ["test execution", "test-execute-result.json", validTestExecuteArtifact()],
  ]) {
    for (const mtime of [beforeRewind, rewindTime]) {
      const fixture = createFixture(t);
      if (artifactName === "test-execute-result.json") writeTestExecutionRaw(fixture.specDir);
      writeArtifact(fixture.specDir, artifactName, artifact, mtime);

      const result = await preValidate({
        root: fixture.root,
        state: fixture.state,
        requestedStatus: "done",
      });

      assert.equal(result?.ok, false, `${name} at ${mtime.toISOString()} must fail`);
      assert.equal(result.errors[0].code, "IMPLEMENT_COMPLETION_VALIDATION_FAILED");
      assert.ok(issueCodes(result).includes("durable-artifact-stale"));
      assert.equal(issueCodes(result).includes("durable-artifact-missing"), false);
    }
  }
});

test("R2: missing and stale readiness evidence remain distinct", async (t) => {
  const preValidate = await loadPreValidator();
  const missing = createFixture(t);

  const missingResult = await preValidate({
    root: missing.root,
    state: missing.state,
    requestedStatus: "done",
  });

  assert.equal(missingResult?.ok, false);
  assert.ok(issueCodes(missingResult).includes("durable-artifact-missing"));
  assert.equal(issueCodes(missingResult).includes("durable-artifact-stale"), false);

  const stale = createFixture(t);
  writeArtifact(
    stale.specDir,
    "test-execute-result.json",
    { version: "retained-but-not-current" },
    beforeRewind,
  );
  const staleResult = await preValidate({
    root: stale.root,
    state: stale.state,
    requestedStatus: "done",
  });
  assert.equal(staleResult?.ok, false);
  assert.ok(issueCodes(staleResult).includes("durable-artifact-stale"));
  assert.equal(issueCodes(staleResult).includes("durable-artifact-missing"), false);
  assert.equal(issueCodes(staleResult).includes("requirement-summary-missing"), false);
});

test("R3: stale skipped downstream artifacts do not poison current scenario evidence", async (t) => {
  const preValidate = await loadPreValidator();
  const fixture = createFixture(t);
  writeArtifact(
    fixture.specDir,
    "scenario-validity-result.json",
    validScenarioArtifact(),
    afterRewind,
  );
  writeArtifact(
    fixture.specDir,
    "test-execute-result.json",
    { version: "stale-malformed", result: "fail" },
    beforeRewind,
  );
  writeArtifact(
    fixture.specDir,
    "test-result-review.json",
    { version: "stale-malformed", verdict: "fail" },
    beforeRewind,
  );

  const result = await preValidate({
    root: fixture.root,
    state: fixture.state,
    requestedStatus: "done",
  });

  assert.equal(
    result,
    null,
    "stale optional downstream artifacts must not enter mechanical validation or block current scenario evidence",
  );
});

test("R1: a test-result-review artifact at the rewind boundary is stale", async (t) => {
  const preValidate = await loadPreValidator();
  const fixture = createFixture(t);
  writeArtifact(
    fixture.specDir,
    "scenario-validity-result.json",
    validScenarioArtifact(),
    afterRewind,
  );
  writeArtifact(
    fixture.specDir,
    "test-result-review.json",
    { verdict: "retained-but-malformed" },
    rewindTime,
  );

  const result = await preValidate({
    root: fixture.root,
    state: fixture.state,
    requestedStatus: "done",
  });
  assert.equal(
    result,
    null,
    "a boundary-stale optional review must not substitute for or block current readiness",
  );
});

test("R4: no-rewind fixtures preserve readiness, prerequisites, and producer adapters", async (t) => {
  const preValidate = await loadPreValidator();
  const missing = createFixture(t, { withRewind: false });
  const missingResult = await preValidate({
    root: missing.root,
    state: missing.state,
    requestedStatus: "done",
  });
  assert.ok(issueCodes(missingResult).includes("durable-artifact-missing"));

  const ready = createFixture(t, { withRewind: false });
  writeArtifact(
    ready.specDir,
    "scenario-validity-result.json",
    validScenarioArtifact(),
    beforeRewind,
  );
  assert.equal(await preValidate({
    root: ready.root,
    state: ready.state,
    requestedStatus: "done",
  }), null);

  const pending = createFixture(t, { withRewind: false, requirementStatus: "pending" });
  writeArtifact(
    pending.specDir,
    "scenario-validity-result.json",
    validScenarioArtifact(),
    beforeRewind,
  );
  const pendingResult = await preValidate({
    root: pending.root,
    state: pending.state,
    requestedStatus: "done",
  });
  assert.ok(issueCodes(pendingResult).includes("requirement-status-incomplete"));

  const missingFileMap = createFixture(t, { withRewind: false });
  fs.rmSync(path.join(missingFileMap.specDir, "file-map.json"));
  writeArtifact(
    missingFileMap.specDir,
    "scenario-validity-result.json",
    validScenarioArtifact(),
    beforeRewind,
  );
  const missingFileMapResult = await preValidate({
    root: missingFileMap.root,
    state: missingFileMap.state,
    requestedStatus: "done",
  });
  assert.ok(issueCodes(missingFileMapResult).includes("file-map-missing"));

  const validTestExecution = createFixture(t, { withRewind: false });
  writeTestExecutionRaw(validTestExecution.specDir);
  writeArtifact(
    validTestExecution.specDir,
    "test-execute-result.json",
    validTestExecuteArtifact(),
    beforeRewind,
  );
  assert.equal(await preValidate({
    root: validTestExecution.root,
    state: validTestExecution.state,
    requestedStatus: "done",
  }), null);

  const missingRawOutput = createFixture(t, { withRewind: false });
  writeArtifact(
    missingRawOutput.specDir,
    "test-execute-result.json",
    validTestExecuteArtifact(),
    beforeRewind,
  );
  const missingRawOutputResult = await preValidate({
    root: missingRawOutput.root,
    state: missingRawOutput.state,
    requestedStatus: "done",
  });
  assert.ok(issueCodes(missingRawOutputResult).includes("raw-output-missing"));

  const producerAdapters = createFixture(t, { withRewind: false });
  writeTestExecutionRaw(producerAdapters.specDir);
  writeArtifact(
    producerAdapters.specDir,
    "scenario-validity-result.json",
    validScenarioArtifact(),
    beforeRewind,
  );
  writeArtifact(
    producerAdapters.specDir,
    "test-execute-result.json",
    validTestExecuteArtifact(),
    beforeRewind,
  );
  writeArtifact(
    producerAdapters.specDir,
    "test-result-review.json",
    validTestResultReviewArtifact(),
    beforeRewind,
  );
  assert.equal(await preValidate({
    root: producerAdapters.root,
    state: producerAdapters.state,
    requestedStatus: "done",
  }), null);
});

test("R5: regenerated evidence is eligible and malformed current evidence is not stale", async (t) => {
  const preValidate = await loadPreValidator();
  const regenerated = createFixture(t);
  writeArtifact(
    regenerated.specDir,
    "scenario-validity-result.json",
    validScenarioArtifact(),
    afterRewind,
  );
  assert.equal(await preValidate({
    root: regenerated.root,
    state: regenerated.state,
    requestedStatus: "done",
  }), null);

  const malformed = createFixture(t);
  writeArtifact(
    malformed.specDir,
    "scenario-validity-result.json",
    { version: "malformed" },
    afterRewind,
  );
  const malformedResult = await preValidate({
    root: malformed.root,
    state: malformed.state,
    requestedStatus: "done",
  });
  assert.ok(issueCodes(malformedResult).includes("scenario-validity-schema-invalid"));
  assert.equal(issueCodes(malformedResult).includes("durable-artifact-stale"), false);

  const malformedTestExecution = createFixture(t);
  writeArtifact(
    malformedTestExecution.specDir,
    "scenario-validity-result.json",
    validScenarioArtifact(),
    afterRewind,
  );
  writeTestExecutionRaw(malformedTestExecution.specDir);
  const malformedTestExecutionArtifact = validTestExecuteArtifact();
  malformedTestExecutionArtifact.summary[0].evidence.raw_output_lines.end_line = 3;
  writeArtifact(
    malformedTestExecution.specDir,
    "test-execute-result.json",
    malformedTestExecutionArtifact,
    afterRewind,
  );
  const malformedTestExecutionResult = await preValidate({
    root: malformedTestExecution.root,
    state: malformedTestExecution.state,
    requestedStatus: "done",
  });
  assert.ok(issueCodes(malformedTestExecutionResult).includes("raw-evidence-range-invalid"));
  assert.equal(issueCodes(malformedTestExecutionResult).includes("durable-artifact-stale"), false);

  const malformedTestReview = createFixture(t);
  writeArtifact(
    malformedTestReview.specDir,
    "scenario-validity-result.json",
    validScenarioArtifact(),
    afterRewind,
  );
  writeArtifact(
    malformedTestReview.specDir,
    "test-result-review.json",
    { verdict: "retained-but-malformed" },
    afterRewind,
  );
  const malformedTestReviewResult = await preValidate({
    root: malformedTestReview.root,
    state: malformedTestReview.state,
    requestedStatus: "done",
  });
  assert.ok(issueCodes(malformedTestReviewResult).includes("test-result-review-schema-invalid"));
  assert.equal(issueCodes(malformedTestReviewResult).includes("durable-artifact-stale"), false);
});
