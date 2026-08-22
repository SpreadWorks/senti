/**
 * tests/integration/flow/spec-gate-tasks-monotonic.test.js
 *
 * Tests for REQ-3 (spec 215): spec gate が 2 回目以降の approval で
 * 既存 task の id / origin / added_round 不変性を検証する。
 * title / description の変更は許可する。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkTasksMonotonic } from "../../../src/flow/lib/check-tasks-monotonic.js";

function ft(id, added_round, origin = "plan", extras = {}) {
  return {
    id, spec: `tasks/${id}.md`, origin, parent: null,
    status: "pending", steps: [], requirements: [], summary: null,
    added_round, ...extras,
  };
}
function st(id, added_round, title = "t", origin = "plan", extras = {}) {
  return { id, title, origin, added_round, status: "pending", ...extras };
}

describe("checkTasksMonotonic (REQ-3)", () => {
  it("PASS when flow.tasks is empty (first approval)", () => {
    const issues = checkTasksMonotonic({ flowTasks: [], specTasks: [st("T-1", 0)] });
    assert.deepEqual(issues, []);
  });

  it("PASS when spec.tasks contains all flow.tasks unchanged", () => {
    const issues = checkTasksMonotonic({
      flowTasks: [ft("T-1", 0)],
      specTasks: [st("T-1", 0), st("T-2", 1)],
    });
    assert.deepEqual(issues, []);
  });

  it("PASS when title/description differ", () => {
    const issues = checkTasksMonotonic({
      flowTasks: [ft("T-1", 0)],
      specTasks: [st("T-1", 0, "new title", "plan", { description: "new desc" })],
    });
    assert.deepEqual(issues, []);
  });

  it("FAIL when existing task is missing from spec", () => {
    const issues = checkTasksMonotonic({
      flowTasks: [ft("T-1", 0), ft("T-2", 0)],
      specTasks: [st("T-1", 0)],
    });
    assert.ok(issues.some((i) => /T-2/.test(i) && /missing/.test(i)));
  });

  it("FAIL when existing task origin differs", () => {
    const issues = checkTasksMonotonic({
      flowTasks: [ft("T-1", 0, "plan")],
      specTasks: [st("T-1", 0, "t", "integration")],
    });
    assert.ok(issues.some((i) => /T-1/.test(i) && /origin/.test(i)));
  });

  it("FAIL when existing task added_round differs", () => {
    const issues = checkTasksMonotonic({
      flowTasks: [ft("T-1", 0)],
      specTasks: [st("T-1", 1)],
    });
    assert.ok(issues.some((i) => /T-1/.test(i) && /added_round/.test(i)));
  });

  it("FAIL when new task's added_round is not max+1", () => {
    const issues = checkTasksMonotonic({
      flowTasks: [ft("T-1", 0), ft("T-2", 0)],
      specTasks: [st("T-1", 0), st("T-2", 0), st("T-3", 2)],
    });
    assert.ok(issues.some((i) => /T-3/.test(i) && /added_round/.test(i)));
  });

  it("PASS when new task's added_round is exactly max+1", () => {
    const issues = checkTasksMonotonic({
      flowTasks: [ft("T-1", 0), ft("T-2", 0)],
      specTasks: [st("T-1", 0), st("T-2", 0), st("T-3", 1)],
    });
    assert.deepEqual(issues, []);
  });

  it("PASS when spec has no tasks[]", () => {
    const issues = checkTasksMonotonic({ flowTasks: [], specTasks: undefined });
    assert.deepEqual(issues, []);
  });
});
