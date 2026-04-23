import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildInitialSteps,
  buildInitialTaskSteps,
  derivePhase,
  TASK_STEPS_PLAN,
} from "../../../src/lib/flow-helpers.js";

describe("flow-helpers task-aware APIs", () => {
  describe("buildInitialTaskSteps", () => {
    it("returns TASK_STEPS_PLAN sequence for origin=plan", () => {
      const steps = buildInitialTaskSteps("plan");
      assert.equal(steps.length, TASK_STEPS_PLAN.length);
      assert.deepEqual(steps.map((s) => s.id), TASK_STEPS_PLAN);
      for (const s of steps) assert.equal(s.status, "pending");
    });

    it("returns TASK_STEPS_PLAN sequence for origin=integration", () => {
      const steps = buildInitialTaskSteps("integration");
      assert.equal(steps.length, TASK_STEPS_PLAN.length);
      assert.deepEqual(steps.map((s) => s.id), TASK_STEPS_PLAN);
    });

    it("throws on unknown origin", () => {
      assert.throws(() => buildInitialTaskSteps("nonsense"), /origin|unknown/i);
    });

    it("throws on legacy origin=addition (removed in spec 215)", () => {
      assert.throws(() => buildInitialTaskSteps("addition"), /origin|unknown/i);
    });

    it("TASK_STEPS_PLAN is defined", () => {
      assert.ok(Array.isArray(TASK_STEPS_PLAN));
      assert.ok(TASK_STEPS_PLAN.includes("gate"));
      assert.ok(TASK_STEPS_PLAN.includes("update-overview"));
    });
  });

  describe("derivePhase(state)", () => {
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

    it("returns 'plan' for fresh flow-level steps (no tasks)", () => {
      const state = makeState();
      assert.equal(derivePhase(state), "plan");
    });

    it("returns flow-level phase when flow step is in_progress and no current task", () => {
      const state = makeState();
      state.steps.find((s) => s.id === "implement").status = "in_progress";
      assert.equal(derivePhase(state), "impl");
    });

    it("returns 'task-impl' when current task has impl in_progress", () => {
      const state = makeState({
        currentTaskId: "001",
        tasks: [
          {
            id: "001",
            spec: "specs/001-test/tasks/001-x.md",
            origin: "plan",
            parent: null,
            status: "in_progress",
            steps: buildInitialTaskSteps("plan"),
            requirements: [],
            summary: null,
          },
        ],
      });
      state.tasks[0].steps.find((s) => s.id === "impl").status = "in_progress";
      assert.equal(derivePhase(state), "task-impl");
    });

    it("returns 'task-plan' when current task has gate in_progress", () => {
      const state = makeState({
        currentTaskId: "001",
        tasks: [
          {
            id: "001",
            spec: "specs/001-test/tasks/001-x.md",
            origin: "plan",
            parent: null,
            status: "in_progress",
            steps: buildInitialTaskSteps("plan"),
            requirements: [],
            summary: null,
          },
        ],
      });
      state.tasks[0].steps.find((s) => s.id === "gate").status = "in_progress";
      assert.equal(derivePhase(state), "task-plan");
    });

    it("falls back to flow-level phase when current task has no in_progress step", () => {
      const state = makeState({
        currentTaskId: "001",
        tasks: [
          {
            id: "001",
            spec: "specs/001-test/tasks/001-x.md",
            origin: "plan",
            parent: null,
            status: "pending",
            steps: buildInitialTaskSteps("plan"),
            requirements: [],
            summary: null,
          },
        ],
      });
      state.steps.find((s) => s.id === "spec").status = "in_progress";
      assert.equal(derivePhase(state), "plan");
    });
  });
});
