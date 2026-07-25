/**
 * src/flow/lib/run-complete-task.js
 *
 * FlowCommand: `flow run complete-task [--task-id <id>]` — manually complete
 * a task and auto-promote the next pending task.
 *
 * Spec 226: thin wrapper. Calls `completeTask` (which handles parent
 * propagation) then `promoteNextPending` (single-caller boundary site 2 of 2).
 * Validation is delegated to the flow-store primitive via `throw`.
 */

import { FlowCommand } from "./base-command.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { promoteNextPending } from "../../lib/flow-helpers.js";

export class RunCompleteTaskCommand extends FlowCommand {
  constructor() {
    super({ explicitTargetResolution: true });
  }

  async execute(ctx) {
    const { root } = ctx;
    const fm = ctx.flowManager || new FlowManager({ root, mainRoot: root, inWorktree: false });
    const state = ctx.flowState || fm.load();
    if (!state) {
      return Envelope.fail("run", "complete-task", "NO_ACTIVE_FLOW", "no active flow found");
    }

    const explicit = typeof ctx.taskId === "string" && ctx.taskId.trim()
      ? ctx.taskId.trim()
      : null;
    const taskId = explicit || state.currentTaskId || null;
    if (!taskId) {
      return Envelope.fail(
        "run",
        "complete-task",
        "NO_TASK_TARGET",
        "no currentTaskId and --task-id not specified",
      );
    }

    const task = (state.tasks || []).find((t) => t.id === taskId);
    if (!task) {
      return Envelope.fail(
        "run",
        "complete-task",
        "UNKNOWN_TASK_ID",
        `unknown task id: ${taskId}`,
      );
    }
    if (task.status === "done") {
      return Envelope.fail(
        "run",
        "complete-task",
        "TASK_ALREADY_DONE",
        `task ${taskId} already done`,
      );
    }

    // completeTask handles parent propagation internally (spec 226).
    fm.completeTask(taskId);

    // Auto-promote next pending — call site (2) of the single-caller boundary.
    let promoted = null;
    fm.mutate((s) => {
      promoted = promoteNextPending(s);
    });
    const nextAction = promoted
      ? `next task ${promoted} is current; run senti flow get next-action`
      : "no pending tasks remain; continue with integration verification";

    return Envelope.ok("run", "complete-task", {
      completedTaskId: taskId,
      nextTaskId: promoted,
      nextAction,
      taskId,
      completed: true,
      promoted,
    });
  }
}

export default RunCompleteTaskCommand;
