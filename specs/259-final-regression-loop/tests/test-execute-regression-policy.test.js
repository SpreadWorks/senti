// spec: R1 R9
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  RegressionClassification,
  planTestExecuteRegression,
} from "../../../src/flow/lib/test-regression.js";
import {
  validateTestExecuteResultEvidence,
  validateTestExecuteResultV2,
} from "../../../src/flow/lib/test-artifacts.js";

function changedSourceFiles() {
  return [{ status: "modified", path: "src/example.js" }];
}

function fullClassification() {
  const changedFiles = changedSourceFiles();
  return new RegressionClassification({
    required: true,
    mode: "full",
    reason: "project source changed",
    changedFiles,
    triggerRelevantChangedFiles: changedFiles,
  });
}

function deferredRegressionArtifact() {
  const changedFiles = changedSourceFiles();
  return validateTestExecuteResultV2({
    version: "2",
    raw_output_path: "specs/259-final-regression-loop/tests/.raw/test-execution.log",
    summary: [],
    regression: {
      required: false,
      result: "skipped",
      mode: "none",
      category: "full-regression-deferred",
      reason: "full project regression deferred to final-regression",
      classified_paths: changedFiles.map((entry) => ({
        path: entry.path,
        category: "full-regression-deferred",
      })),
      trigger_relevant_changed_files: changedFiles,
      changed_files: changedFiles,
    },
  });
}

test("R1: default test-execute defers full project regression to final-regression", () => {
  const plan = planTestExecuteRegression(fullClassification(), {});

  assert.equal(plan.run, false);
  assert.equal(plan.classification.required, false);
  assert.equal(plan.classification.category, "full-regression-deferred");
  assert.match(plan.classification.reason, /final-regression/);
});

test("R1: explicit full policy is the only normal-loop full regression exception", () => {
  const plan = planTestExecuteRegression(fullClassification(), {
    test: { testExecuteRegression: "full" },
  });

  assert.equal(plan.run, true);
  assert.equal(plan.classification.required, true);
  assert.equal(plan.classification.mode, "full");
  assert.equal(plan.reason, "test.testExecuteRegression=full");
});

test("R9: deferred full regression evidence validates without project regression markers", () => {
  const rawOutputText = [
    "[sdd-forge] spec-local tests start",
    "command: node --test specs/259-final-regression-loop/tests/*.test.js",
    "[sdd-forge] spec-local tests end",
  ].join("\n");

  assert.doesNotThrow(() => validateTestExecuteResultEvidence(deferredRegressionArtifact(), {
    root: process.cwd(),
    rawOutputText,
    rawLines: rawOutputText.split(/\r?\n/),
    requirements: [],
    summary: false,
  }));
});

test("R9: scenario-validity prompt keeps project-wide regression out of test-execute", () => {
  const promptPath = path.resolve("src/flow/prompts/plan/scenario-validity.md");
  const prompt = fs.readFileSync(promptPath, "utf8");

  assert.match(prompt, /impl\/final-regression/);
  assert.doesNotMatch(prompt, /project-wide regression suite[\s\S]*impl\/test-execute/);
});
