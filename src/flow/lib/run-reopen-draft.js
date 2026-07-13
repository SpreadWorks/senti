/**
 * FlowCommand: `flow reopen-draft`.
 *
 * The established plan and task-addition routes update flow.json and append
 * issue-log entries. The guarded spec-correction route has a narrower owner:
 * it atomically replaces only the already-resolved flow.json authority and
 * leaves spec, issue-log, source, and evidence files to their normal owners.
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { appendIssueLogEntry } from "./set-issue-log.js";
import { FLOW_STEPS, PHASE_MAP } from "../../lib/flow-helpers.js";
import { findInProgressLeaf, findStepById } from "./step-tree.js";
import { DRAFT_REVIEW_ROUTES } from "./draft-review-routes.js";

const MAX_REASON_LENGTH = 500;
const SPEC_CORRECTION_CATEGORY = "spec-correction";
const REOPEN_CATEGORIES = new Set([undefined, "task-addition", SPEC_CORRECTION_CATEGORY]);

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

const STALE_DRAFT_REVIEW_ARTIFACTS = Object.freeze(draftReviewArtifactNamesForReopen());
const PLAN_REOPEN_DRAFT_REVIEW_RESET_STEPS = Object.freeze(draftReviewResetStepIdsForReopen());
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
  if (typeof raw !== "string") throw new Error("--reason must be a string");
  if (raw.includes("\0")) throw new Error("--reason contains invalid NUL byte");
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

function resetStepSequence(state, stepIds, destinationStep = "draft") {
  const resetSteps = [];
  for (const id of stepIds) {
    if (setStepStatusAndClearTimestamps(state.steps, id, id === destinationStep ? "in_progress" : "pending")) {
      resetSteps.push(id);
    }
  }
  return resetSteps;
}

function specCorrectionResetStepIds() {
  return FLOW_STEPS.slice(FLOW_STEPS.indexOf("draft"));
}

class PlanRewindPreviousState {
  constructor(state, stepIds) {
    this.activeStep = findInProgressLeaf(state.steps || [])?.id ?? null;
    this.currentTaskId = state.currentTaskId ?? null;
    this.stepStatuses = Object.fromEntries(stepIds.map((id) => [
      id,
      findStepById(state.steps || [], id)?.status ?? null,
    ]));
    Object.freeze(this.stepStatuses);
    Object.freeze(this);
  }

  toJSON() {
    return {
      activeStep: this.activeStep,
      currentTaskId: this.currentTaskId,
      stepStatuses: this.stepStatuses,
    };
  }
}

class PlanRewindAuditEntry {
  constructor({ state, category, reason, stepIds, timestamp }) {
    this.category = category;
    this.reason = reason;
    this.target = {
      runId: state.runId,
      spec: state.spec,
      issue: state.issue == null ? null : Number(state.issue),
    };
    this.previousState = new PlanRewindPreviousState(state, stepIds);
    this.invalidatedPhases = [...new Set(stepIds
      .filter((id) => this.previousState.stepStatuses[id] !== "pending")
      .map((id) => PHASE_MAP[id])
      .filter(Boolean))];
    this.timestamp = timestamp;
    Object.freeze(this.target);
    Object.freeze(this.invalidatedPhases);
    Object.freeze(this);
  }

  toJSON() {
    return {
      category: this.category,
      reason: this.reason,
      target: this.target,
      invalidatedPhases: this.invalidatedPhases,
      previousState: this.previousState.toJSON(),
      timestamp: this.timestamp,
    };
  }
}

function validateCorrectionGuards(ctx, state) {
  const missing = [];
  if (ctx.expectRunId == null) missing.push("--expect-run-id");
  if (ctx.expectSpec == null) missing.push("--expect-spec");
  if (state.issue == null) {
    if (ctx.expectNoIssue !== true) missing.push("--expect-no-issue");
  } else if (ctx.expectIssue == null) {
    missing.push("--expect-issue");
  }
  if (missing.length === 0) return null;
  return Envelope.fail(
    "run",
    "reopen-draft",
    "TARGET_GUARDS_REQUIRED",
    `spec-correction requires explicit target guards: ${missing.join(", ")}`,
  );
}

function appendIssueLog(root, state, entry) {
  appendIssueLogEntry(root, state.spec, { ...entry, timestamp: new Date().toISOString() });
}

function executeSpecCorrection({ flowManager, root, specId, state, reason }) {
  const stepIds = specCorrectionResetStepIds();
  const timestamp = new Date().toISOString();
  const audit = new PlanRewindAuditEntry({
    state,
    category: SPEC_CORRECTION_CATEGORY,
    reason,
    stepIds,
    timestamp,
  });
  const nextState = structuredClone(state);
  const resetSteps = resetStepSequence(nextState, stepIds);
  nextState.currentTaskId = null;
  if (!Array.isArray(nextState.planRewinds)) nextState.planRewinds = [];
  nextState.planRewinds.push(audit.toJSON());

  let replacement;
  try {
    replacement = flowManager
      .forRoot(root, { specId })
      .saveAtomic(nextState, { expectedOriginal: state });
  } catch (err) {
    return Envelope.fail(
      "run",
      "reopen-draft",
      err.code || "REOPEN_SAVE_FAILED",
      err.message,
      {
        committed: err.committed === true,
        statePath: err.path ?? null,
        lockPath: err.lockPath ?? null,
        cleanupErrors: err.cleanupErrors ?? [],
        residuePaths: err.residuePaths ?? [],
      },
    );
  }

  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  return Envelope.ok("run", "reopen-draft", {
    reopened: true,
    mode: SPEC_CORRECTION_CATEGORY,
    previousActiveStep: audit.previousState.activeStep,
    resetSteps,
    invalidatedPhases: [...audit.invalidatedPhases],
    doneTaskCount: 0,
    taskCount: tasks.length,
    stateReplacement: replacement,
  });
}

export class RunReopenDraftCommand extends FlowCommand {
  async execute(ctx) {
    if (!REOPEN_CATEGORIES.has(ctx.category)) {
      return Envelope.fail(
        "run",
        "reopen-draft",
        "ARGS_ERROR",
        `--category must be task-addition or ${SPEC_CORRECTION_CATEGORY}`,
      );
    }

    const { root, flowManager, flowState: state } = ctx;
    if (!state) return Envelope.fail("run", "reopen-draft", "NO_ACTIVE_FLOW", "no active flow found");

    let reason;
    try {
      reason = validateReason(ctx.reason);
    } catch (err) {
      return Envelope.fail("run", "reopen-draft", "INVALID_REASON", err.message);
    }

    if (ctx.category === SPEC_CORRECTION_CATEGORY) {
      if (!reason) {
        return Envelope.fail("run", "reopen-draft", "INVALID_REASON", "--reason is required for spec-correction");
      }
      const guardFailure = validateCorrectionGuards(ctx, state);
      if (guardFailure) return guardFailure;
      const activeStep = findInProgressLeaf(state.steps || [])?.id ?? null;
      const tasks = Array.isArray(state.tasks) ? state.tasks : [];
      const tasksUnstarted = state.currentTaskId == null && tasks.every((task) => (
        task.status === "pending"
        && Array.isArray(task.steps)
        && task.steps.every((step) => step.status === "pending")
      ));
      if (activeStep !== "implement" || !tasksUnstarted) {
        return Envelope.fail(
          "run",
          "reopen-draft",
          "REOPEN_STAGE_UNSUPPORTED",
          "spec-correction reopen is only available from implement before any task has started",
        );
      }
      return executeSpecCorrection({ flowManager, root, specId: ctx.specId, state, reason });
    }

    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const previousActiveStep = findInProgressLeaf(state.steps || [])?.id ?? null;
    if (state.currentTaskId == null && PLAN_REOPEN_ACTIVE_STEPS.includes(previousActiveStep)) {
      const resetSteps = [];
      flowManager.mutate((nextState) => {
        resetSteps.push(...resetStepSequence(nextState, ["draft", ...PLAN_REOPEN_RESET_STEPS]));
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
        doneTaskCount: tasks.filter((task) => task.status === "done").length,
        taskCount: tasks.length,
      });
    }

    if (!tasks.some((task) => task.status === "done")) {
      return Envelope.fail(
        "run",
        "reopen-draft",
        "NO_DONE_TASK",
        "cannot reopen draft: no done task exists. Reopen is only for adding tasks mid-implementation",
      );
    }

    flowManager.mutate((nextState) => {
      setStepStatusAndClearTimestamps(nextState.steps, "draft", "in_progress");
      setStepStatusAndClearTimestamps(nextState.steps, "draft-gate", "pending");
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
      doneTaskCount: tasks.filter((task) => task.status === "done").length,
      taskCount: tasks.length,
    });
  }
}

export default RunReopenDraftCommand;
