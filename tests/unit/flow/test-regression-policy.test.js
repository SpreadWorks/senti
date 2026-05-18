import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RegressionClassification,
  planTestExecuteRegression,
} from "../../../src/flow/lib/test-regression.js";

function fullClassification() {
  const changed = [{ status: "modified", path: "src/example.js" }];
  return new RegressionClassification({
    required: true,
    mode: "full",
    reason: "project source changed",
    changedFiles: changed,
    triggerRelevantChangedFiles: changed,
  });
}

function targetedClassification() {
  const changed = [{ status: "modified", path: "tests/example.test.js" }];
  return new RegressionClassification({
    required: true,
    mode: "targeted",
    reason: "project test changed",
    changedFiles: changed,
    triggerRelevantChangedFiles: changed,
    targetPaths: ["tests/example.test.js"],
  });
}

describe("test-execute project regression policy", () => {
  it("defers full project regression by default", () => {
    const plan = planTestExecuteRegression(fullClassification(), {});

    assert.equal(plan.run, false);
    assert.equal(plan.classification.required, false);
    assert.equal(plan.classification.category, "full-regression-deferred");
    assert.equal(plan.classification.reason, "full project regression deferred to final-regression");
  });

  it("runs targeted project regression in the normal repair loop", () => {
    const plan = planTestExecuteRegression(targetedClassification(), {});

    assert.equal(plan.run, true);
    assert.equal(plan.classification.mode, "targeted");
    assert.deepEqual([...plan.classification.targetPaths], ["tests/example.test.js"]);
  });

  it("allows explicit full regression during test-execute", () => {
    const plan = planTestExecuteRegression(fullClassification(), {
      test: { testExecuteRegression: "full" },
    });

    assert.equal(plan.run, true);
    assert.equal(plan.classification.mode, "full");
  });

  it("allows explicit project regression skip during test-execute", () => {
    const plan = planTestExecuteRegression(targetedClassification(), {
      test: { testExecuteRegression: "skip" },
    });

    assert.equal(plan.run, false);
    assert.equal(plan.classification.category, "project-regression-skipped");
  });
});
