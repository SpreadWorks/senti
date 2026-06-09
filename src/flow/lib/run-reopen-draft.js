/**
 * src/flow/lib/run-reopen-draft.js
 *
 * FlowCommand: `flow reopen-draft` — rewind the flow's draft step to
 * in_progress so the user can answer draft QA or add tasks to a spec.
 *
 * Preconditions:
 *   - pre-implementation plan flows may reopen before tasks exist
 *   - implementation-phase task additions require at least one done task
 *
 * Side effects:
 *   - mark flow.draft step as in_progress
 *   - append an entry to specs/<spec>/issue-log.json recording the event
 */

import { FlowCommand } from "./base-command.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";
import { findInProgressLeaf, findStepById } from "./step-tree.js";
import { DRAFT_REVIEW_ROUTES } from "./draft-review-routes.js";

const MAX_REASON_LENGTH = 500;

function draftReviewArtifactNamesForReopen() {
  return DRAFT_REVIEW_ROUTES.flatMap((route) => [
    route.reviewArtifact,
    route.triageArtifact,
    route.repairArtifact,
  ]);
}

function draftReviewResetStepIdsForReopen() {
  return DRAFT_REVIEW_ROUTES.flatMap((route) => [
    route.reviewStepId,
    route.triageStepId,
    route.repairStepId,
    route.passNextStepId,
  ]);
}

const STALE_DRAFT_REVIEW_ARTIFACTS = Object.freeze(
  draftReviewArtifactNamesForReopen(),
);
const PLAN_REOPEN_DRAFT_REVIEW_RESET_STEPS = Object.freeze(
  draftReviewResetStepIdsForReopen(),
);
const PLAN_REOPEN_ACTIVE_STEPS = Object.freeze([
  "spec",
  "spec-review",
  "spec-triage",
  "spec-repair",
  "spec-gate",
  "approval",
  "test",
  "test-review",
]);
const PLAN_REOPEN_RESET_STEPS = Object.freeze([
  ...PLAN_REOPEN_DRAFT_REVIEW_RESET_STEPS,
  ...PLAN_REOPEN_ACTIVE_STEPS,
]);
const STALE_ARTIFACTS = Object.freeze([
  "spec.json",
  "spec.md",
  "spec-triage.json",
  "spec-repair.json",
  "draft.json",
  ...STALE_DRAFT_REVIEW_ARTIFACTS,
  "issue.md",
  "test.md",
]);

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

function setStepStatusAndClearTimestamps(steps, id, status) {
  const step = findStepById(steps || [], id);
  if (!step) return false;
  step.status = status;
  delete step.startedAt;
  delete step.finishedAt;
  return true;
}

function appendIssueLog(root, state, entry) {
  const log = loadIssueLog(root, state.spec);
  log.entries.push({ ...entry, timestamp: new Date().toISOString() });
  saveIssueLog(root, state.spec, log);
}

export class RunReopenDraftCommand extends FlowCommand {
  async execute(ctx) {
    const { root } = ctx;
    const fm = ctx.flowManager || new FlowManager({ root, mainRoot: root, inWorktree: false });
    const state = ctx.flowState || fm.load();
    if (!state) {
      return Envelope.fail("run", "reopen-draft", "NO_ACTIVE_FLOW", "no active flow found");
    }

    let reason;
    try {
      reason = validateReason(ctx.reason);
    } catch (err) {
      return Envelope.fail("run", "reopen-draft", "INVALID_REASON", err.message);
    }

    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const previousActiveStep = findInProgressLeaf(state.steps || [])?.id ?? null;
    if (state.currentTaskId == null && PLAN_REOPEN_ACTIVE_STEPS.includes(previousActiveStep)) {
      const resetSteps = [];
      fm._store.mutate((s) => {
        setStepStatusAndClearTimestamps(s.steps, "draft", "in_progress");
        for (const id of PLAN_REOPEN_RESET_STEPS) {
          if (setStepStatusAndClearTimestamps(s.steps, id, "pending")) resetSteps.push(id);
        }
      });

      appendIssueLog(root, state, {
        step: "draft",
        reason: `reopen-draft triggered: pre-implementation plan draft regression; stale planning artifacts retained${reason ? ` — ${reason}` : ""}`,
        trigger: "user invoked senti flow reopen-draft before implementation task execution",
        resolution: `draft step set to in_progress; reset plan steps: ${resetSteps.join(", ")}; stale artifacts retained: ${STALE_ARTIFACTS.join(", ")}`,
      });

      return Envelope.ok("run", "reopen-draft", {
        reopened: true,
        mode: "pre-implementation",
        previousActiveStep,
        resetSteps,
        staleArtifacts: [...STALE_ARTIFACTS],
        doneTaskCount: tasks.filter((t) => t.status === "done").length,
        taskCount: tasks.length,
      });
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

    fm._store.mutate((s) => {
      setStepStatusAndClearTimestamps(s.steps, "draft", "in_progress");
      // Reset draft-gate so the new round re-runs the gate.
      setStepStatusAndClearTimestamps(s.steps, "draft-gate", "pending");
    });

    appendIssueLog(root, state, {
      step: "draft",
      reason: `reopen-draft triggered: draft step rewound to add new tasks mid-implementation${reason ? ` — ${reason}` : ""}`,
      trigger: "user invoked senti flow reopen-draft",
      resolution: "flow.draft step set to in_progress; draft-gate reset to pending",
    });

    return Envelope.ok("run", "reopen-draft", {
      reopened: true,
      mode: "implementation",
      doneTaskCount: tasks.filter((t) => t.status === "done").length,
      taskCount: tasks.length,
    });
  }
}

export default RunReopenDraftCommand;
