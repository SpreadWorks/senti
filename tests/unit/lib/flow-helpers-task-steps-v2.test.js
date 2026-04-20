/**
 * tests/unit/lib/flow-helpers-task-steps-v2.test.js
 *
 * Tests for spec 197 (cac6/T4): test-first determinism.
 *
 * Covers:
 * - New TASK_STEPS_PLAN / TASK_STEPS_ADDITION include write-tests/impl/run-tests
 * - TASK_PHASE_MAP maps write-tests, impl, run-tests to "task-impl"
 * - FLOW_STEPS includes integration-* steps before review
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FLOW_STEPS,
  PHASE_MAP,
  TASK_STEPS_PLAN,
  TASK_STEPS_ADDITION,
  TASK_PHASE_MAP,
  buildInitialTaskSteps,
  derivePhase,
  buildInitialSteps,
} from "../../../src/lib/flow-helpers.js";

describe("TASK_STEPS_PLAN v2 (test-first decomposition)", () => {
  it("contains write-tests, impl, run-tests in order", () => {
    const i = TASK_STEPS_PLAN.indexOf("write-tests");
    const j = TASK_STEPS_PLAN.indexOf("impl");
    const k = TASK_STEPS_PLAN.indexOf("run-tests");
    assert.ok(i >= 0, "write-tests missing from TASK_STEPS_PLAN");
    assert.ok(j > i, "impl must come after write-tests");
    assert.ok(k > j, "run-tests must come after impl");
  });

  it("no longer contains a standalone 'test' step", () => {
    assert.ok(
      !TASK_STEPS_PLAN.includes("test"),
      "legacy 'test' step must be replaced by write-tests/run-tests",
    );
  });

  it("still contains review and update-overview at the tail", () => {
    const k = TASK_STEPS_PLAN.indexOf("run-tests");
    const r = TASK_STEPS_PLAN.indexOf("review");
    const u = TASK_STEPS_PLAN.indexOf("update-overview");
    assert.ok(r > k, "review must come after run-tests");
    assert.ok(u > r, "update-overview must come after review");
  });
});

describe("TASK_STEPS_ADDITION v2 (test-first decomposition)", () => {
  it("contains write-tests, impl, run-tests in order after approval-2", () => {
    const a2 = TASK_STEPS_ADDITION.indexOf("approval-2");
    const i = TASK_STEPS_ADDITION.indexOf("write-tests");
    const j = TASK_STEPS_ADDITION.indexOf("impl");
    const k = TASK_STEPS_ADDITION.indexOf("run-tests");
    assert.ok(a2 >= 0, "approval-2 required for addition");
    assert.ok(i > a2, "write-tests must come after approval-2");
    assert.ok(j > i, "impl must come after write-tests");
    assert.ok(k > j, "run-tests must come after impl");
  });

  it("no longer contains a standalone 'test' step", () => {
    assert.ok(!TASK_STEPS_ADDITION.includes("test"));
  });
});

describe("TASK_PHASE_MAP v2", () => {
  it("maps write-tests to task-impl", () => {
    assert.equal(TASK_PHASE_MAP["write-tests"], "task-impl");
  });
  it("maps impl to task-impl", () => {
    assert.equal(TASK_PHASE_MAP["impl"], "task-impl");
  });
  it("maps run-tests to task-impl", () => {
    assert.equal(TASK_PHASE_MAP["run-tests"], "task-impl");
  });
});

describe("buildInitialTaskSteps v2", () => {
  it("plan origin produces step list with write-tests/impl/run-tests", () => {
    const steps = buildInitialTaskSteps("plan");
    const ids = steps.map((s) => s.id);
    assert.ok(ids.includes("write-tests"));
    assert.ok(ids.includes("impl"));
    assert.ok(ids.includes("run-tests"));
    assert.ok(!ids.includes("test"));
    for (const s of steps) assert.equal(s.status, "pending");
  });

  it("addition origin produces step list with write-tests/impl/run-tests", () => {
    const steps = buildInitialTaskSteps("addition");
    const ids = steps.map((s) => s.id);
    assert.ok(ids.includes("write-tests"));
    assert.ok(ids.includes("impl"));
    assert.ok(ids.includes("run-tests"));
    assert.ok(!ids.includes("test"));
  });
});

describe("derivePhase(state) with v2 task steps", () => {
  function makeState(overrides = {}) {
    return {
      spec: "specs/001-test/spec.md",
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [],
      currentTaskId: null,
      ...overrides,
    };
  }

  it("returns task-impl when current task's write-tests step is in_progress", () => {
    const state = makeState({
      currentTaskId: "001",
      tasks: [
        {
          id: "001",
          origin: "plan",
          status: "in_progress",
          steps: buildInitialTaskSteps("plan").map((s) =>
            s.id === "write-tests" ? { ...s, status: "in_progress" } : s,
          ),
        },
      ],
    });
    assert.equal(derivePhase(state), "task-impl");
  });

  it("returns task-impl when current task's run-tests step is in_progress", () => {
    const state = makeState({
      currentTaskId: "001",
      tasks: [
        {
          id: "001",
          origin: "plan",
          status: "in_progress",
          steps: buildInitialTaskSteps("plan").map((s) =>
            s.id === "run-tests" ? { ...s, status: "in_progress" } : s,
          ),
        },
      ],
    });
    assert.equal(derivePhase(state), "task-impl");
  });
});

describe("FLOW_STEPS integration phase", () => {
  it("contains integration-write-tests, integration-run-tests, integration-run-all-tests, integration-evaluate", () => {
    for (const id of [
      "integration-write-tests",
      "integration-run-tests",
      "integration-run-all-tests",
      "integration-evaluate",
    ]) {
      assert.ok(FLOW_STEPS.includes(id), `missing integration step: ${id}`);
    }
  });

  it("integration steps come before review", () => {
    const reviewIdx = FLOW_STEPS.indexOf("review");
    const lastIntegrationIdx = FLOW_STEPS.indexOf("integration-evaluate");
    assert.ok(lastIntegrationIdx >= 0);
    assert.ok(reviewIdx > lastIntegrationIdx, "review must come after integration-evaluate");
  });

  it("integration steps are phase-mapped to impl", () => {
    for (const id of [
      "integration-write-tests",
      "integration-run-tests",
      "integration-run-all-tests",
      "integration-evaluate",
    ]) {
      assert.equal(PHASE_MAP[id], "impl", `integration step ${id} should map to impl phase`);
    }
  });
});
