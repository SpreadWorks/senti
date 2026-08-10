/**
 * src/flow/lib/run-complete-task.js
 *
 * FlowCommand: `flow run complete-task [--task-id <id>]` — manually complete
 * a task and auto-promote the next pending task.
 *
 * Completion, parent propagation, and deterministic promotion are committed
 * by one flow-state mutation. Validation remains owned by the state boundary.
 */

import { FlowCommand } from "./base-command.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { completeTaskAndPromoteInState } from "../../lib/flow-helpers.js";

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

    let promoted = null;
    fm.mutate((s) => {
      promoted = completeTaskAndPromoteInState(s, taskId);
    });
    const nextAction = promoted
      ? `next task ${promoted} is current; run sennel flow get next-action`
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
