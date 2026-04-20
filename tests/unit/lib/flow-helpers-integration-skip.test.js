/**
 * tests/unit/lib/flow-helpers-integration-skip.test.js
 *
 * Tests for integration step skip initialization (REQ-P4-1, P4-3).
 * Spec: 198-test-first-determinism-core.
 *
 * The buildInitialSteps helper takes a tasks array (or task count) and
 * initializes integration-* steps as `skipped` when tasks.length === 0.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInitialSteps, FLOW_STEPS } from "../../../src/lib/flow-helpers.js";

const INTEGRATION_STEPS = [
  "integration-write-tests",
  "integration-run-tests",
  "integration-run-all-tests",
  "integration-evaluate",
];

describe("buildInitialSteps — integration skip initialization", () => {
  it("REQ-P4-1: sets integration steps to skipped when no tasks are present", () => {
    const steps = buildInitialSteps({ tasks: [] });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s.status]));
    for (const id of INTEGRATION_STEPS) {
      assert.equal(byId[id], "skipped", `integration step ${id} must be skipped`);
    }
  });

  it("leaves integration steps pending when tasks are present", () => {
    const steps = buildInitialSteps({ tasks: [{ id: "T1" }] });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s.status]));
    for (const id of INTEGRATION_STEPS) {
      assert.equal(byId[id], "pending", `integration step ${id} must be pending when tasks exist`);
    }
  });

  it("does not skip non-integration steps when tasks.length === 0", () => {
    const steps = buildInitialSteps({ tasks: [] });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s.status]));
    for (const id of FLOW_STEPS) {
      if (INTEGRATION_STEPS.includes(id)) continue;
      assert.equal(byId[id], "pending", `non-integration step ${id} must remain pending`);
    }
  });

});
