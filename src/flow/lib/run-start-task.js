/**
 * src/flow/lib/run-start-task.js
 *
 * FlowCommand: `flow run start-task --task-id <id>` — manually promote a
 * pending task into `currentTaskId` and transition it to in_progress.
 *
 * Spec 226: thin wrapper. Validation (unknown id / invalid status transition)
 * is delegated to the flow-store primitive via `throw`. The CLI layer only
 * resolves arguments and formats the envelope.
 */

import { FlowCommand } from "./base-command.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { Envelope } from "../../lib/flow-envelope.js";

export class RunStartTaskCommand extends FlowCommand {
  async execute(ctx) {
    const taskId = typeof ctx.taskId === "string" && ctx.taskId.trim()
      ? ctx.taskId.trim()
      : null;
    if (!taskId) {
      return Envelope.fail("run", "start-task", "MISSING_TASK_ID", "--task-id is required");
    }

    const { root } = ctx;
    const fm = ctx.flowManager || new FlowManager({ root, mainRoot: root, inWorktree: false });
    const state = ctx.flowState || fm.load();
    if (!state) {
      return Envelope.fail("run", "start-task", "NO_ACTIVE_FLOW", "no active flow found");
    }

    const task = (state.tasks || []).find((t) => t.id === taskId);
    if (!task) {
      return Envelope.fail("run", "start-task", "UNKNOWN_TASK_ID", `unknown task id: ${taskId}`);
    }
    if (task.status === "done") {
      return Envelope.fail(
        "run",
        "start-task",
        "TASK_ALREADY_DONE",
        `task ${taskId} already done (cannot restart)`,
      );
    }

    fm.mutate((s) => {
      const t = (s.tasks || []).find((x) => x.id === taskId);
      if (!t) return; // defensive — validated above
      s.currentTaskId = taskId;
      if (t.status === "pending") t.status = "in_progress";
    });

    return Envelope.ok("run", "start-task", {
      taskId,
      currentTaskId: taskId,
      status: "in_progress",
    });
  }
}

export default RunStartTaskCommand;
