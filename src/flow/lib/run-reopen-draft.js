/**
 * src/flow/lib/run-reopen-draft.js
 *
 * FlowCommand: `flow reopen-draft` — rewind the flow's draft step to
 * in_progress so the user can add tasks to the approved spec.
 *
 * Preconditions (REQ-5 of spec 215):
 *   - flow.json.tasks[] must contain at least one task with status='done'
 *
 * Side effects (REQ-4):
 *   - mark flow.draft step as in_progress
 *   - append an entry to specs/<spec>/issue-log.json recording the event
 *
 * Part of spec 215-flow-task-decomposition (draft-return task flow).
 */

import { FlowCommand } from "./base-command.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";

const MAX_REASON_LENGTH = 500;

function validateReason(raw) {
  if (raw == null) return "";
  if (typeof raw !== "string") {
    throw new Error("--reason must be a string");
  }
  if (raw.includes("\0")) {
    throw new Error("--reason contains invalid NUL byte");
  }
  const trimmed = raw.trim();
  if (trimmed.length > MAX_REASON_LENGTH) {
    throw new Error(`--reason exceeds ${MAX_REASON_LENGTH} characters`);
  }
  return trimmed;
}

export class RunReopenDraftCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const fm = ctx.flowManager || new FlowManager({ root, mainRoot: root, inWorktree: false });
    const state = ctx.flowState || fm.load();
    if (!state) {
      return Envelope.fail("run", "reopen-draft", "NO_ACTIVE_FLOW", "no active flow found");
    }

    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    if (tasks.length === 0) {
      return Envelope.fail(
        "run",
        "reopen-draft",
        "NO_TASKS",
        "cannot reopen draft: flow has no committed tasks yet (use the regular approval cycle instead)",
      );
    }
    const hasDone = tasks.some((t) => t.status === "done");
    if (!hasDone) {
      return Envelope.fail(
        "run",
        "reopen-draft",
        "NO_DONE_TASK",
        "cannot reopen draft: no done task exists. Reopen is only for adding tasks mid-implementation",
      );
    }

    let reason;
    try {
      reason = validateReason(ctx.reason);
    } catch (err) {
      return Envelope.fail("run", "reopen-draft", "INVALID_REASON", err.message);
    }

    fm._store.mutate((s) => {
      const draft = (s.steps || []).find((step) => step.id === "draft");
      if (draft) draft.status = "in_progress";
      // reset gate-draft so the new round re-runs the gate
      const gateDraft = (s.steps || []).find((step) => step.id === "gate-draft");
      if (gateDraft) gateDraft.status = "pending";
    });

    const log = loadIssueLog(root, state.spec);
    log.entries.push({
      step: "draft",
      reason: `reopen-draft triggered: draft step rewound to add new tasks mid-implementation${reason ? ` — ${reason}` : ""}`,
      trigger: "user invoked sdd-forge flow reopen-draft",
      resolution: "flow.draft step set to in_progress; gate-draft reset to pending",
      ts: new Date().toISOString(),
    });
    saveIssueLog(root, state.spec, log);

    return Envelope.ok("run", "reopen-draft", {
      reopened: true,
      doneTaskCount: tasks.filter((t) => t.status === "done").length,
      taskCount: tasks.length,
    });
  }
}
