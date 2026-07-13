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

import fs from "fs";
import path from "path";
import { FlowCommand } from "./base-command.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { targetMismatchEnvelopeForInput } from "../../lib/flow-target-guard.js";
import { loadIssueLog, saveIssueLog } from "./set-issue-log.js";
import { FLOW_STEPS } from "../../lib/flow-helpers.js";
import { findInProgressLeaf, findStepById } from "./step-tree.js";
import { DRAFT_REVIEW_ROUTES } from "./draft-review-routes.js";
import { ReopenDraftTransaction } from "./reopen-draft-transaction.js";

const MAX_REASON_LENGTH = 500;
const SPEC_CORRECTION_CATEGORY = "spec-correction";

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
const SPEC_CORRECTION_STALE_ARTIFACTS = Object.freeze([
  ...STALE_ARTIFACTS,
  "draft-gate-result.json",
  "spec-review.json",
  "spec-gate-result.json",
  "approval.json",
  "test-review.json",
  "test-review-triage.json",
  "test-review-repair.json",
  "test-execute-result.json",
  "impl-review.json",
  "impl-gate-result.json",
]);
const RETRY_RESETS = Object.freeze([
  ...["draft", "spec", "task-impl", "integration"].map((phase) => ({ phase, counter: "gateRetry" })),
  ...["draft-questions", "draft-coverage", "spec", "test", "impl"].map((phase) => ({ phase, counter: "reviewRetry" })),
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

function appendRetryResets(state, timestamp) {
  if (!Array.isArray(state.metrics)) state.metrics = [];
  for (const reset of RETRY_RESETS) {
    state.metrics.push({ ...reset, delta: 0, reset: true, taskId: null, ts: timestamp });
  }
}

class PlanRewindAuditEntry {
  constructor({ state, category, reason, sourceStage, invalidatedEvidence, timestamp }) {
    const hasIssue = state.issue != null;
    this.category = category;
    this.reason = reason;
    this.target = {
      runId: state.runId,
      spec: state.spec,
      issue: { present: hasIssue, value: hasIssue ? Number(state.issue) : null },
    };
    this.sourceStage = sourceStage;
    this.destinationStep = "draft";
    this.invalidatedEvidence = [...invalidatedEvidence];
    this.preservedWorktree = {
      enabled: state.worktree === true,
      featureBranch: state.featureBranch ?? null,
      spec: state.spec,
    };
    this.timestamp = timestamp;
    Object.freeze(this.invalidatedEvidence);
    Object.freeze(this.preservedWorktree);
    Object.freeze(this.target.issue);
    Object.freeze(this.target);
    Object.freeze(this);
  }

  toJSON() {
    return {
      category: this.category,
      reason: this.reason,
      target: this.target,
      sourceStage: this.sourceStage,
      destinationStep: this.destinationStep,
      invalidatedEvidence: this.invalidatedEvidence,
      preservedWorktree: this.preservedWorktree,
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
  const log = loadIssueLog(root, state.spec);
  log.entries.push({ ...entry, timestamp: new Date().toISOString() });
  saveIssueLog(root, state.spec, log);
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function executeSpecCorrection({ root, mainRoot, state, reason }) {
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const previousActiveStep = findInProgressLeaf(state.steps || [])?.id ?? null;
  const timestamp = new Date().toISOString();
  const audit = new PlanRewindAuditEntry({
    state,
    category: SPEC_CORRECTION_CATEGORY,
    reason,
    sourceStage: previousActiveStep,
    invalidatedEvidence: SPEC_CORRECTION_STALE_ARTIFACTS,
    timestamp,
  });
  const specPath = path.resolve(root, state.spec);
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const issueLog = loadIssueLog(root, state.spec);
  const resetSteps = resetStepSequence(state, specCorrectionResetStepIds());
  state.currentTaskId = null;
  appendRetryResets(state, timestamp);
  if (!Array.isArray(state.planRewinds)) state.planRewinds = [];
  state.planRewinds.push(audit.toJSON());
  spec.user_approval = {
    ...(spec.user_approval || {}),
    approved: false,
    confirmed_at: "",
    notes: "Invalidated by an audited Issue #441 spec-correction rewind.",
  };
  issueLog.entries.push({
    step: "draft",
    category: SPEC_CORRECTION_CATEGORY,
    originIssue: 441,
    reason,
    trigger: `source verification discovered a spec correction during ${previousActiveStep}`,
    resolution: `flow rewound to draft; evidence retained but invalidated: ${SPEC_CORRECTION_STALE_ARTIFACTS.join(", ")}`,
    target: audit.target,
    timestamp,
  });

  let transaction;
  try {
    transaction = new ReopenDraftTransaction({
      root: mainRoot,
      specPath,
      contents: {
        flow: serializeJson(state),
        spec: serializeJson(spec),
        issueLog: serializeJson(issueLog),
      },
    }).commit();
  } catch (err) {
    return Envelope.fail(
      "run",
      "reopen-draft",
      err.code || "REOPEN_FAILED",
      err.message,
      {
        journalPath: err.journalPath ?? null,
        recovered: err.recovered ?? false,
        transaction: "issue-441-reopen-draft",
      },
    );
  }

  return Envelope.ok("run", "reopen-draft", {
    reopened: true,
    mode: SPEC_CORRECTION_CATEGORY,
    previousActiveStep,
    resetSteps,
    staleArtifacts: [...SPEC_CORRECTION_STALE_ARTIFACTS],
    doneTaskCount: 0,
    taskCount: tasks.length,
    transaction,
  });
}

export class RunReopenDraftCommand extends FlowCommand {
  async run(container, input = {}) {
    if (input.category === SPEC_CORRECTION_CATEGORY) {
      const recoveryFailure = this.runRecoveryPreflight(container, input);
      if (recoveryFailure) return recoveryFailure;
      let reason;
      try {
        reason = validateReason(input.reason);
      } catch (err) {
        return Envelope.fail("run", "reopen-draft", "INVALID_REASON", err.message);
      }
      if (!reason) {
        return Envelope.fail("run", "reopen-draft", "INVALID_REASON", "--reason is required for spec-correction");
      }
      const flowManager = container.get("flowManager");
      const flowPath = flowManager.pathForCurrent();
      const flowState = flowPath && fs.existsSync(flowPath)
        ? JSON.parse(fs.readFileSync(flowPath, "utf8"))
        : null;
      const mismatch = targetMismatchEnvelopeForInput({
        type: input._envelopeType || "run",
        key: input._envelopeKey || "reopen-draft",
        input,
        flowState,
      });
      if (mismatch) return mismatch;
      if (flowState) {
        const guardFailure = validateCorrectionGuards(input, flowState);
        if (guardFailure) return guardFailure;
        const activeStep = findInProgressLeaf(flowState.steps || [])?.id ?? null;
        const hasDoneTask = (flowState.tasks || []).some((task) => task.status === "done");
        if (activeStep !== "implement" || hasDoneTask) {
          return Envelope.fail(
            "run",
            "reopen-draft",
            "REOPEN_STAGE_UNSUPPORTED",
            "spec-correction reopen is only available from implement with zero done tasks",
          );
        }
        return executeSpecCorrection({
          root: container.get("paths").root,
          mainRoot: container.get("mainRoot") || container.get("paths").root,
          state: flowState,
          reason,
        });
      }
    }
    return super.run(container, input);
  }

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
      fm.mutate((s) => {
        resetSteps.push(...resetStepSequence(s, ["draft", ...PLAN_REOPEN_RESET_STEPS]));
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

    fm.mutate((s) => {
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
