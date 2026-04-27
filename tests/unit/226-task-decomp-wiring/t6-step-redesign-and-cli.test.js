/**
 * tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js
 *
 * Spec 226 / T-6: task-scope step 再編と手動制御 CLI。
 * TASK_STEPS_PLAN を 7 → 5 step に再編、approval / task-spec gate /
 * update-overview 独立 step を削除、update-overview 機能を impl に統合、
 * start-task / complete-task CLI の追加を検証する。
 *
 * REQ-15 / REQ-16 / REQ-17 / REQ-18 / REQ-19 / REQ-20 に対応。
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TASK_STEPS_PLAN, buildInitialTaskSteps } from "../../../src/lib/flow-helpers.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager } from "../../helpers/flow-setup.js";

// Resolve source root for file-existence checks.
const SRC_ROOT = path.resolve(
  new URL(import.meta.url).pathname,
  "../../../../src",
);

describe("T-6: task-scope step redesign and manual control CLI", () => {
  // ── step redesign ──────────────────────────────────────────────────────────

  it("TASK_STEPS_PLAN is [impl, review, gate-impl]", () => {
    assert.deepEqual(TASK_STEPS_PLAN, [
      "impl", "review", "gate-impl",
    ]);
  });

  it("buildInitialTaskSteps returns 3 steps matching TASK_STEPS_PLAN", () => {
    const steps = buildInitialTaskSteps("plan");
    assert.equal(steps.length, 3);
    assert.deepEqual(
      steps.map((s) => s.id),
      TASK_STEPS_PLAN,
    );
    // All start as pending.
    for (const s of steps) {
      assert.equal(s.status, "pending");
    }
  });

  it("context-rules.json task scope has no approval/gate/update-overview entries", () => {
    const rulesPath = path.join(SRC_ROOT, "flow/schemas/context-rules.json");
    const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    const taskKeys = Object.keys(rules.task);
    assert.ok(!taskKeys.includes("approval"), "task scope must not contain approval");
    assert.ok(!taskKeys.includes("gate"), "task scope must not contain gate (task-spec gate)");
    assert.ok(!taskKeys.includes("update-overview"), "task scope must not contain update-overview");
  });

  it("context-rules.json task scope has gate-impl entry", () => {
    const rulesPath = path.join(SRC_ROOT, "flow/schemas/context-rules.json");
    const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    assert.ok(
      Object.keys(rules.task).includes("gate-impl"),
      "task scope must contain gate-impl",
    );
  });

  // ── deleted prompts ────────────────────────────────────────────────────────

  it("src/flow/prompts/task/approval.md does not exist", () => {
    const p = path.join(SRC_ROOT, "flow/prompts/task/approval.md");
    assert.equal(fs.existsSync(p), false, `${p} should not exist`);
  });

  it("src/flow/prompts/task/gate.md does not exist", () => {
    const p = path.join(SRC_ROOT, "flow/prompts/task/gate.md");
    assert.equal(fs.existsSync(p), false, `${p} should not exist`);
  });

  it("src/flow/prompts/task/update-overview.md does not exist", () => {
    const p = path.join(SRC_ROOT, "flow/prompts/task/update-overview.md");
    assert.equal(fs.existsSync(p), false, `${p} should not exist`);
  });

  // ── impl prompt has overview update directive ──────────────────────────────

  it("src/flow/prompts/task/impl.md contains overview update directive", () => {
    const p = path.join(SRC_ROOT, "flow/prompts/task/impl.md");
    const content = fs.readFileSync(p, "utf8");
    assert.ok(
      content.includes("persistOverviewUpdate") || content.includes("applyOverviewAdditions"),
      "impl.md must reference persistOverviewUpdate or applyOverviewAdditions",
    );
    assert.ok(
      content.includes("overview"),
      "impl.md must mention overview update functionality",
    );
  });

  // ── start-task CLI ─────────────────────────────────────────────────────────

  describe("start-task CLI", () => {
    let tmp;
    beforeEach(() => {
      tmp = createTmpDir("t6-start-");
    });

    it("start-task CLI sets currentTaskId to the specified task", async () => {
      const task = {
        id: "T-1",
        title: "Test task",
        goal: "Test goal",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "pending",
        steps: buildInitialTaskSteps("plan"),
      };
      setupFlow(tmp, { tasks: [task], currentTaskId: null });

      const { RunStartTaskCommand } = await import(
        "../../../src/flow/lib/run-start-task.js"
      );
      const fm = makeFlowManager(tmp);
      const state = fm.load();
      const cmd = new RunStartTaskCommand();
      const env = await cmd.execute({
        root: tmp,
        flowManager: fm,
        flowState: state,
        taskId: "T-1",
      });

      assert.equal(env.ok, true);
      assert.equal(env.data.currentTaskId, "T-1");

      // Verify persisted state.
      const reloaded = fm.load();
      assert.equal(reloaded.currentTaskId, "T-1");
    });

    it("start-task CLI transitions task status to in_progress", async () => {
      const task = {
        id: "T-1",
        title: "Task",
        goal: "Goal",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "pending",
        steps: buildInitialTaskSteps("plan"),
      };
      setupFlow(tmp, { tasks: [task], currentTaskId: null });

      const { RunStartTaskCommand } = await import(
        "../../../src/flow/lib/run-start-task.js"
      );
      const fm = makeFlowManager(tmp);
      const state = fm.load();
      const cmd = new RunStartTaskCommand();
      await cmd.execute({
        root: tmp,
        flowManager: fm,
        flowState: state,
        taskId: "T-1",
      });

      const reloaded = fm.load();
      const t = reloaded.tasks.find((x) => x.id === "T-1");
      assert.equal(t.status, "in_progress");
    });

    it("start-task CLI delegates validation to flow-store primitive (throws on unknown id)", async () => {
      const task = {
        id: "T-1",
        title: "Task",
        goal: "Goal",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "pending",
        steps: buildInitialTaskSteps("plan"),
      };
      setupFlow(tmp, { tasks: [task], currentTaskId: null });

      const { RunStartTaskCommand } = await import(
        "../../../src/flow/lib/run-start-task.js"
      );
      const fm = makeFlowManager(tmp);
      const state = fm.load();
      const cmd = new RunStartTaskCommand();
      const env = await cmd.execute({
        root: tmp,
        flowManager: fm,
        flowState: state,
        taskId: "T-nonexistent",
      });

      assert.equal(env.ok, false);
      assert.equal(env.errors[0].code, "UNKNOWN_TASK_ID");
    });

    it("start-task CLI returns proper envelope shape", async () => {
      const task = {
        id: "T-1",
        title: "Task",
        goal: "Goal",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "pending",
        steps: buildInitialTaskSteps("plan"),
      };
      setupFlow(tmp, { tasks: [task], currentTaskId: null });

      const { RunStartTaskCommand } = await import(
        "../../../src/flow/lib/run-start-task.js"
      );
      const fm = makeFlowManager(tmp);
      const state = fm.load();
      const cmd = new RunStartTaskCommand();
      const env = await cmd.execute({
        root: tmp,
        flowManager: fm,
        flowState: state,
        taskId: "T-1",
      });

      assert.equal(env.ok, true);
      assert.equal(env.type, "run");
      assert.equal(env.key, "start-task");
      assert.equal(env.data.taskId, "T-1");
      assert.equal(env.data.status, "in_progress");
    });
  });

  // ── complete-task CLI ──────────────────────────────────────────────────────

  describe("complete-task CLI", () => {
    let tmp;
    beforeEach(() => {
      tmp = createTmpDir("t6-complete-");
    });

    it("complete-task CLI (no args) completes currentTaskId task", async () => {
      const task = {
        id: "T-1",
        title: "Task",
        goal: "Goal",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "in_progress",
        steps: [
          { id: "impl", status: "done" },
          { id: "review", status: "done" },
          { id: "gate-impl", status: "done" },
        ],
      };
      setupFlow(tmp, { tasks: [task], currentTaskId: "T-1" });

      const { RunCompleteTaskCommand } = await import(
        "../../../src/flow/lib/run-complete-task.js"
      );
      const fm = makeFlowManager(tmp);
      const state = fm.load();
      const cmd = new RunCompleteTaskCommand();
      const env = await cmd.execute({
        root: tmp,
        flowManager: fm,
        flowState: state,
        // no taskId — should use currentTaskId
      });

      assert.equal(env.ok, true);
      assert.equal(env.data.taskId, "T-1");
      assert.equal(env.data.completed, true);

      const reloaded = fm.load();
      const t = reloaded.tasks.find((x) => x.id === "T-1");
      assert.equal(t.status, "done");
    });

    it("complete-task CLI (with --task-id) completes specified task", async () => {
      const tasks = [
        {
          id: "T-1",
          title: "First",
          goal: "Goal A",
          parent: null,
          origin: "plan",
          added_round: 0,
          status: "in_progress",
          steps: [
            { id: "impl", status: "done" },
            { id: "review", status: "done" },
            { id: "gate-impl", status: "done" },
          ],
        },
        {
          id: "T-2",
          title: "Second",
          goal: "Goal B",
          parent: null,
          origin: "plan",
          added_round: 0,
          status: "in_progress",
          steps: [
            { id: "impl", status: "done" },
            { id: "review", status: "done" },
            { id: "gate-impl", status: "done" },
          ],
        },
      ];
      setupFlow(tmp, { tasks, currentTaskId: "T-1" });

      const { RunCompleteTaskCommand } = await import(
        "../../../src/flow/lib/run-complete-task.js"
      );
      const fm = makeFlowManager(tmp);
      const state = fm.load();
      const cmd = new RunCompleteTaskCommand();
      const env = await cmd.execute({
        root: tmp,
        flowManager: fm,
        flowState: state,
        taskId: "T-2",
      });

      assert.equal(env.ok, true);
      assert.equal(env.data.taskId, "T-2");

      const reloaded = fm.load();
      const t2 = reloaded.tasks.find((x) => x.id === "T-2");
      assert.equal(t2.status, "done");
    });

    it("complete-task CLI invokes completeTask then promoteNextPending (in this order)", async () => {
      // T-1 is current and in_progress. T-2 is pending.
      // After completing T-1, promoteNextPending should auto-promote T-2.
      const tasks = [
        {
          id: "T-1",
          title: "First",
          goal: "Goal A",
          parent: null,
          origin: "plan",
          added_round: 0,
          status: "in_progress",
          steps: [
            { id: "impl", status: "done" },
            { id: "review", status: "done" },
            { id: "gate-impl", status: "done" },
          ],
        },
        {
          id: "T-2",
          title: "Second",
          goal: "Goal B",
          parent: null,
          origin: "plan",
          added_round: 0,
          status: "pending",
          steps: [
            { id: "impl", status: "pending" },
            { id: "review", status: "pending" },
            { id: "gate-impl", status: "pending" },
          ],
        },
      ];
      setupFlow(tmp, { tasks, currentTaskId: "T-1" });

      const { RunCompleteTaskCommand } = await import(
        "../../../src/flow/lib/run-complete-task.js"
      );
      const fm = makeFlowManager(tmp);
      const state = fm.load();
      const cmd = new RunCompleteTaskCommand();
      const env = await cmd.execute({
        root: tmp,
        flowManager: fm,
        flowState: state,
        // uses currentTaskId = T-1
      });

      assert.equal(env.ok, true);
      assert.equal(env.data.taskId, "T-1");
      // promoteNextPending should have promoted T-2.
      assert.equal(env.data.promoted, "T-2");

      const reloaded = fm.load();
      assert.equal(reloaded.currentTaskId, "T-2");
      const t2 = reloaded.tasks.find((x) => x.id === "T-2");
      assert.equal(t2.status, "in_progress");
    });

    it("complete-task CLI propagates to parent when all children done", async () => {
      const tasks = [
        {
          id: "T-parent",
          title: "Parent",
          goal: "Parent goal",
          parent: null,
          origin: "plan",
          added_round: 0,
          status: "in_progress",
          steps: [
            { id: "impl", status: "pending" },
            { id: "review", status: "pending" },
            { id: "gate-impl", status: "pending" },
          ],
        },
        {
          id: "T-child-1",
          title: "Child 1",
          goal: "Child 1 goal",
          parent: "T-parent",
          origin: "plan",
          added_round: 0,
          status: "done",
          steps: [
            { id: "impl", status: "done" },
            { id: "review", status: "done" },
            { id: "gate-impl", status: "done" },
          ],
        },
        {
          id: "T-child-2",
          title: "Child 2",
          goal: "Child 2 goal",
          parent: "T-parent",
          origin: "plan",
          added_round: 0,
          status: "in_progress",
          steps: [
            { id: "impl", status: "done" },
            { id: "review", status: "done" },
            { id: "gate-impl", status: "done" },
          ],
        },
      ];
      setupFlow(tmp, { tasks, currentTaskId: "T-child-2" });

      const { RunCompleteTaskCommand } = await import(
        "../../../src/flow/lib/run-complete-task.js"
      );
      const fm = makeFlowManager(tmp);
      const state = fm.load();
      const cmd = new RunCompleteTaskCommand();
      await cmd.execute({
        root: tmp,
        flowManager: fm,
        flowState: state,
        taskId: "T-child-2",
      });

      const reloaded = fm.load();
      const child2 = reloaded.tasks.find((x) => x.id === "T-child-2");
      assert.equal(child2.status, "done");
      // Parent should also be done since all children are done.
      const parent = reloaded.tasks.find((x) => x.id === "T-parent");
      assert.equal(parent.status, "done");
    });

    it("complete-task CLI is a thin wrapper (no validation duplication)", async () => {
      // Verify that the execute method body is concise by checking that
      // attempting to complete an unknown task returns a fail envelope
      // (validation is delegated), not an uncaught exception.
      const task = {
        id: "T-1",
        title: "Task",
        goal: "Goal",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "in_progress",
        steps: [
          { id: "impl", status: "done" },
          { id: "review", status: "done" },
          { id: "gate-impl", status: "done" },
        ],
      };
      setupFlow(tmp, { tasks: [task], currentTaskId: "T-1" });

      const { RunCompleteTaskCommand } = await import(
        "../../../src/flow/lib/run-complete-task.js"
      );
      const fm = makeFlowManager(tmp);
      const state = fm.load();
      const cmd = new RunCompleteTaskCommand();

      // unknown task id → fail envelope
      const envUnknown = await cmd.execute({
        root: tmp,
        flowManager: fm,
        flowState: state,
        taskId: "T-nonexistent",
      });
      assert.equal(envUnknown.ok, false);
      assert.equal(envUnknown.errors[0].code, "UNKNOWN_TASK_ID");

      // no target at all (no currentTaskId, no --task-id) → fail envelope
      setupFlow(tmp, { tasks: [task], currentTaskId: null });
      const fm2 = makeFlowManager(tmp);
      const state2 = fm2.load();
      const envNoTarget = await cmd.execute({
        root: tmp,
        flowManager: fm2,
        flowState: state2,
        // no taskId, no currentTaskId
      });
      assert.equal(envNoTarget.ok, false);
      assert.equal(envNoTarget.errors[0].code, "NO_TASK_TARGET");
    });
  });

  // ── impl overview update integration ───────────────────────────────────────

  it("impl step invokes applyOverviewAdditions via spec 207 helper", () => {
    // The impl.md prompt instructs the agent to call persistOverviewUpdate
    // (which internally uses applyOverviewAdditions). Verify the prompt
    // references this helper, and that run-update-overview.js imports it.
    const implPrompt = fs.readFileSync(
      path.join(SRC_ROOT, "flow/prompts/task/impl.md"),
      "utf8",
    );
    assert.ok(
      implPrompt.includes("persistOverviewUpdate"),
      "impl.md must reference persistOverviewUpdate",
    );

    // Verify run-update-overview.js imports applyOverviewAdditions.
    const updateOverviewSrc = fs.readFileSync(
      path.join(SRC_ROOT, "flow/lib/run-update-overview.js"),
      "utf8",
    );
    assert.ok(
      updateOverviewSrc.includes("applyOverviewAdditions"),
      "run-update-overview.js must import applyOverviewAdditions",
    );
  });

  it("impl overview update is performed in impl step (not as separate update-overview step)", () => {
    // Verify that TASK_STEPS_PLAN does not include "update-overview"
    // and that context-rules.json's task scope has no "update-overview".
    assert.ok(
      !TASK_STEPS_PLAN.includes("update-overview"),
      "TASK_STEPS_PLAN must not include update-overview as a separate step",
    );

    const rulesPath = path.join(SRC_ROOT, "flow/schemas/context-rules.json");
    const rules = JSON.parse(fs.readFileSync(rulesPath, "utf8"));
    assert.ok(
      !Object.keys(rules.task).includes("update-overview"),
      "context-rules.json task scope must not include update-overview",
    );

    // Confirm the impl.md prompt contains the overview update directive.
    const implPrompt = fs.readFileSync(
      path.join(SRC_ROOT, "flow/prompts/task/impl.md"),
      "utf8",
    );
    assert.ok(
      implPrompt.includes("overview") && implPrompt.includes("update-overview"),
      "impl.md must describe that the standalone update-overview step has been removed and overview update is in impl",
    );
  });
});
