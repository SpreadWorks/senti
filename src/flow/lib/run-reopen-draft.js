/**
 * FlowCommand: `flow reopen-draft`.
 *
 * The established plan and task-addition routes update flow.json and append
 * issue-log entries. The guarded spec-correction route has a narrower owner:
 * it atomically replaces only the already-resolved flow.json authority and
 * leaves spec, issue-log, source, and evidence files to their normal owners.
 */

import { isDeepStrictEqual } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { missingExactTargetGuardNames } from "../../lib/flow-target-guard.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { appendIssueLogEntry } from "./set-issue-log.js";
import { FLOW_STEPS, PHASE_MAP } from "../../lib/flow-helpers.js";
import { loadSpecJson, resolveSpecJsonPath } from "../../lib/spec-json.js";
import { findInProgressLeaf, findInProgressLeaves, findStepById } from "./step-tree.js";
import { DRAFT_REVIEW_ROUTES } from "./draft-review-routes.js";
import {
  PlanRewindAuditHistory,
  sealLatestPlanRewind,
} from "./spec-correction-rewind-audit.js";
import {
  PLAN_REWIND_SUPPORTED_STAGES,
  SPEC_CORRECTION_SUPPORTED_STAGES,
  PlanRewindError,
  PlanRewindRequest,
  applyPlanRewind,
  capturePlanRewindEvidence,
  validatePlanRewindGuards,
} from "./plan-rewind.js";
import { ExplicitRecoveryTransition } from "./step-transition-policy.js";

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
  "scenario-validity",
  "test-review",
]);
const PLAN_REOPEN_RESET_STEPS = Object.freeze([
  ...PLAN_REOPEN_DRAFT_REVIEW_RESET_STEPS,
  ...PLAN_REOPEN_ACTIVE_STEPS,
]);
const FLOW_REWIND_REJECTED_STAGES = new Set([
  "finalize-commit",
  "finalize-merge",
  "finalize-sync",
  "finalize-cleanup",
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

function clearExecutionMetadata(value, { runtimeLog = false } = {}) {
  delete value.startedAt;
  delete value.finishedAt;
  if (runtimeLog) delete value.runtimeLog;
}

function setStepStatusAndClearTimestamps(steps, id, status, options) {
  const step = findStepById(steps || [], id);
  if (!step) return false;
  step.status = status;
  clearExecutionMetadata(step, options);
  return true;
}

function resetStepSequence(state, stepIds, destinationStep = "draft", options) {
  const resetSteps = [];
  for (const id of stepIds) {
    if (setStepStatusAndClearTimestamps(
      state.steps,
      id,
      id === destinationStep ? "in_progress" : "pending",
      options,
    )) {
      resetSteps.push(id);
    }
  }
  return resetSteps;
}

function resetSpecCorrectionStepSequence(state, stepIds) {
  return resetStepSequence(state, stepIds, "draft", { runtimeLog: true });
}

function createReopenResetTransition(state, stepIds, { clearRuntimeLog = false } = {}) {
  const changes = stepIds.flatMap((stepId) => {
    const step = findStepById(state.steps || [], stepId);
    return step ? [{
      stepId,
      currentStatus: step.status,
      requestedStatus: stepId === "draft" ? "in_progress" : "pending",
    }] : [];
  });
  const draft = findStepById(state.steps || [], "draft");
  return new ExplicitRecoveryTransition({
    stepId: "draft",
    currentStatus: draft?.status,
    requestedStatus: "in_progress",
    entrypoint: "reopen-draft",
    changes,
    clearRuntimeLog,
  });
}

function resetSpecCorrectionTasks(state) {
  for (const task of state.tasks || []) {
    task.status = "pending";
    task.summary = null;
    clearExecutionMetadata(task, { runtimeLog: true });
    for (const step of task.steps || []) {
      step.status = "pending";
      clearExecutionMetadata(step, { runtimeLog: true });
    }
    for (const requirement of task.requirements || []) requirement.status = "pending";
  }
  state.currentTaskId = null;
}

function specCorrectionResetStepIds() {
  return FLOW_STEPS.slice(FLOW_STEPS.indexOf("draft"));
}

function cloneFrozen(value) {
  return Object.freeze(structuredClone(value));
}

function hasStepResult(step) {
  return step.status !== "pending"
    || step.startedAt != null
    || step.finishedAt != null
    || step.runtimeLog != null;
}

function hasTaskResult(task) {
  return task.status !== "pending"
    || task.startedAt != null
    || task.finishedAt != null
    || task.runtimeLog != null
    || task.summary != null
    || (task.steps || []).some(hasStepResult)
    || (task.requirements || []).some((requirement) => requirement.status !== "pending");
}

class PlanRewindEvidenceSnapshot {
  constructor(value, label) {
    if (!value?.id) throw new Error(`invalidated ${label} result requires an id`);
    this.value = cloneFrozen(value);
    Object.freeze(this);
  }

  toJSON() {
    return structuredClone(this.value);
  }
}

class PlanRewindApprovalSnapshot {
  constructor(step, userApproval) {
    this.value = cloneFrozen({
      stepId: step.id,
      status: step.status,
      userApproval: userApproval == null ? null : structuredClone(userApproval),
    });
    Object.freeze(this);
  }

  toJSON() {
    return structuredClone(this.value);
  }
}

class PlanRewindInvalidatedResults {
  constructor(state, stepIds, approvalSnapshot) {
    this.flowSteps = Object.freeze(stepIds
      .map((id) => findStepById(state.steps || [], id))
      .filter((step) => step && hasStepResult(step))
      .map((step) => new PlanRewindEvidenceSnapshot(step, "flow step")));
    this.tasks = Object.freeze((state.tasks || [])
      .filter(hasTaskResult)
      .map((task) => new PlanRewindEvidenceSnapshot(task, "task")));
    this.approvals = Object.freeze(approvalSnapshot ? [approvalSnapshot] : []);
    Object.freeze(this);
  }

  toJSON() {
    return {
      flowSteps: this.flowSteps.map((result) => result.toJSON()),
      tasks: this.tasks.map((result) => result.toJSON()),
      approvals: this.approvals.map((result) => result.toJSON()),
    };
  }
}

class PlanRewindTaskState {
  constructor(task) {
    this.id = task.id;
    this.status = task.status;
    this.stepStatuses = Object.fromEntries((task.steps || []).map((step) => [step.id, step.status]));
    this.requirementStatuses = (task.requirements || []).map((requirement, index) => ({
      id: requirement.id ?? null,
      index,
      status: requirement.status,
    }));
    this.summary = task.summary ?? null;
    Object.freeze(this.stepStatuses);
    Object.freeze(this.requirementStatuses);
    Object.freeze(this);
  }

  toJSON() {
    return {
      id: this.id,
      status: this.status,
      stepStatuses: this.stepStatuses,
      requirementStatuses: this.requirementStatuses,
      summary: this.summary,
    };
  }
}

class PlanRewindResultingState {
  constructor(state, stepIds) {
    this.activeStep = findInProgressLeaf(state.steps || [])?.id ?? null;
    this.currentTaskId = state.currentTaskId ?? null;
    this.stepStatuses = Object.fromEntries(stepIds.map((id) => [
      id,
      findStepById(state.steps || [], id)?.status ?? null,
    ]));
    this.tasks = Object.freeze((state.tasks || []).map((task) => new PlanRewindTaskState(task)));
    Object.freeze(this.stepStatuses);
    Object.freeze(this);
  }

  toJSON() {
    return {
      activeStep: this.activeStep,
      currentTaskId: this.currentTaskId,
      stepStatuses: this.stepStatuses,
      tasks: this.tasks.map((task) => task.toJSON()),
    };
  }
}

class PlanRewindPreviousState {
  constructor(state, stepIds) {
    this.activeStep = findInProgressLeaf(state.steps || [])?.id ?? null;
    this.currentTaskId = state.currentTaskId ?? null;
    this.stepStatuses = Object.fromEntries(stepIds.map((id) => [
      id,
      findStepById(state.steps || [], id)?.status ?? null,
    ]));
    this.taskStatuses = Object.fromEntries((state.tasks || []).map((task) => [task.id, task.status]));
    Object.freeze(this.stepStatuses);
    Object.freeze(this.taskStatuses);
    Object.freeze(this);
  }

  toJSON() {
    return {
      activeStep: this.activeStep,
      currentTaskId: this.currentTaskId,
      stepStatuses: this.stepStatuses,
      taskStatuses: this.taskStatuses,
    };
  }
}

class PlanRewindAuditEntry {
  constructor({ state, resultingState, approvalSnapshot, category, reason, stepIds, timestamp }) {
    this.category = category;
    this.reason = reason;
    this.target = {
      runId: state.runId,
      specId: state.specId,
      issue: state.issue == null ? null : Number(state.issue),
    };
    this.previousState = new PlanRewindPreviousState(state, stepIds);
    this.invalidatedResults = new PlanRewindInvalidatedResults(state, stepIds, approvalSnapshot);
    this.invalidatedPhases = [...new Set(stepIds
      .filter((id) => this.previousState.stepStatuses[id] !== "pending")
      .map((id) => PHASE_MAP[id])
      .filter(Boolean))];
    this.resultingState = new PlanRewindResultingState(resultingState, stepIds);
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
      invalidatedResults: this.invalidatedResults.toJSON(),
      previousState: this.previousState.toJSON(),
      resultingState: this.resultingState.toJSON(),
      timestamp: this.timestamp,
    };
  }
}

function validateCorrectionGuards(ctx, state) {
  const missing = missingExactTargetGuardNames(ctx, state);
  if (missing.length === 0) return null;
  return Envelope.fail(
    "run",
    "reopen-draft",
    "TARGET_GUARDS_REQUIRED",
    `spec-correction requires explicit target guards: ${missing.join(", ")}`,
  );
}

function appendIssueLog(root, state, entry) {
  appendIssueLogEntry(root, relativeFlowSpecFile(state), { ...entry, timestamp: new Date().toISOString() });
}

function specCorrectionResult(audit, resetSteps, replacement, options = {}) {
  const taskStatuses = audit.previousState?.taskStatuses || {};
  return Envelope.ok("run", "reopen-draft", {
    reopened: true,
    mode: SPEC_CORRECTION_CATEGORY,
    previousActiveStep: audit.previousState?.activeStep ?? null,
    resetSteps,
    invalidatedPhases: [...(audit.invalidatedPhases || [])],
    doneTaskCount: Object.values(taskStatuses).filter((status) => status === "done").length,
    taskCount: Object.keys(taskStatuses).length,
    ...(replacement && { stateReplacement: replacement }),
    ...(options.idempotent === true && { idempotent: true }),
    ...(options.recoveredCommittedWrite === true && { recoveredCommittedWrite: true }),
  });
}

function saveFailure(err) {
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

function auditFailure(err) {
  return Envelope.fail(
    "run",
    "reopen-draft",
    err.code || "REOPEN_AUDIT_INVALID",
    err.message,
  );
}

function loadInvalidatedApproval(root, state) {
  const approvalStep = findStepById(state.steps || [], "approval");
  if (!approvalStep || !hasStepResult(approvalStep)) return null;
  const specPath = resolveSpecJsonPath(path.resolve(root, relativeFlowSpecFile(state)));
  const spec = loadSpecJson(specPath, { validate: false });
  return new PlanRewindApprovalSnapshot(approvalStep, spec.user_approval ?? null);
}

function executeSpecCorrection({ flowManager, root, specId, state, reason }) {
  const stepIds = specCorrectionResetStepIds();
  const timestamp = new Date().toISOString();
  let approvalSnapshot;
  try {
    approvalSnapshot = loadInvalidatedApproval(root, state);
  } catch (err) {
    return Envelope.fail(
      "run",
      "reopen-draft",
      "REOPEN_EVIDENCE_UNREADABLE",
      `cannot preserve approval evidence before rewind: ${err.message}`,
    );
  }
  const nextState = structuredClone(state);
  const resetSteps = resetSpecCorrectionStepSequence(nextState, stepIds);
  resetSpecCorrectionTasks(nextState);
  const audit = new PlanRewindAuditEntry({
    state,
    resultingState: nextState,
    approvalSnapshot,
    category: SPEC_CORRECTION_CATEGORY,
    reason,
    stepIds,
    timestamp,
  });
  if (!Object.hasOwn(nextState, "planRewinds")) nextState.planRewinds = [];
  const auditEntry = audit.toJSON();
  auditEntry.previousEntryDigest = nextState.planRewinds.at(-1)?.entryDigest ?? null;
  nextState.planRewinds.push(auditEntry);
  try {
    sealLatestPlanRewind(nextState);
  } catch (err) {
    return auditFailure(err);
  }

  const boundManager = flowManager.forRoot(root, { specId });
  const draft = findStepById(state.steps || [], "draft");
  const transition = new ExplicitRecoveryTransition({
    stepId: "draft",
    currentStatus: draft?.status,
    requestedStatus: "in_progress",
    entrypoint: "reopen-spec-correction",
    expectedOriginal: state,
    replacementState: nextState,
  });
  let replacement;
  try {
    replacement = boundManager.saveRecoveryAtomic(transition);
  } catch (err) {
    if (err.committed !== true) return saveFailure(err);
    let committedState = null;
    try {
      committedState = boundManager.load();
    } catch {
      return saveFailure(err);
    }
    if (!committedState || !isDeepStrictEqual(committedState, nextState)) return saveFailure(err);
    let committedAudit;
    try {
      const committedHistory = new PlanRewindAuditHistory(committedState);
      committedAudit = committedHistory.exactRetry(committedState, { reason });
    } catch {
      return saveFailure(err);
    }
    if (!committedAudit) return saveFailure(err);
    return specCorrectionResult(
      committedAudit,
      resetSteps,
      { committed: true, path: err.path ?? null, durabilityRecovered: true },
      { recoveredCommittedWrite: true },
    );
  }

  return specCorrectionResult(audit.toJSON(), resetSteps, replacement);
}

function invalidatedApprovalConfirmedAt(root, state) {
  const file = path.resolve(root, relativeFlowSpecFile(state));
  if (!fs.existsSync(file)) return null;
  const spec = JSON.parse(fs.readFileSync(file, "utf8"));
  return typeof spec.user_approval?.confirmed_at === "string"
    ? spec.user_approval.confirmed_at
    : null;
}

function flowRewindEnvelope(error) {
  if (!(error instanceof PlanRewindError)) throw error;
  return Envelope.fail("run", "reopen-draft", error.code, error.message);
}

function createFlowRewindRequest({ root, state, ctx, reason, sourceStage }) {
  validatePlanRewindGuards(ctx);
  return new PlanRewindRequest({
    runId: state.runId,
    issue: state.issue,
    specId: state.specId,
    sourceStage,
    destinationStep: "draft",
    reason,
    rewoundAt: new Date().toISOString(),
    invalidatedApprovalConfirmedAt: invalidatedApprovalConfirmedAt(root, state),
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
      let auditHistory;
      try {
        auditHistory = new PlanRewindAuditHistory(state);
      } catch (err) {
        return auditFailure(err);
      }
      const activeStep = findInProgressLeaf(state.steps || [])?.id ?? null;
      if (!SPEC_CORRECTION_SUPPORTED_STAGES.includes(activeStep)) {
        const stepIds = specCorrectionResetStepIds();
        let retryAudit;
        try {
          retryAudit = auditHistory.exactRetry(state, { reason });
        } catch (err) {
          return auditFailure(err);
        }
        if (retryAudit) {
          const resetSteps = stepIds.filter((id) => findStepById(state.steps || [], id));
          return specCorrectionResult(retryAudit, resetSteps, null, { idempotent: true });
        }
        return Envelope.fail(
          "run",
          "reopen-draft",
          "REOPEN_STAGE_UNSUPPORTED",
          "spec-correction reopen is only available from a supported implementation stage",
        );
      }
      return executeSpecCorrection({ flowManager, root, specId: ctx.specId, state, reason });
    }

    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const parentActiveLeaves = findInProgressLeaves(state.steps || []);
    const previousActiveStep = parentActiveLeaves.length === 1
      ? parentActiveLeaves[0].id
      : findInProgressLeaf(state.steps || [])?.id ?? null;
    const supportedFlowStage = parentActiveLeaves.length === 1
      && PLAN_REWIND_SUPPORTED_STAGES.includes(previousActiveStep);
    const rejectedFlowStage = FLOW_REWIND_REJECTED_STAGES.has(previousActiveStep);
    if (
      state.currentTaskId == null
      && parentActiveLeaves.length !== 1
      && parentActiveLeaves.some((step) => (
        PLAN_REWIND_SUPPORTED_STAGES.includes(step.id) || FLOW_REWIND_REJECTED_STAGES.has(step.id)
      ))
    ) {
      return Envelope.fail(
        "run",
        "reopen-draft",
        "PLAN_REWIND_INVARIANT",
        `flow-level plan rewind requires exactly one active parent leaf (got ${parentActiveLeaves.length})`,
      );
    }
    if (rejectedFlowStage && state.currentTaskId == null) {
      try {
        const request = createFlowRewindRequest({ root, state, ctx, reason, sourceStage: previousActiveStep });
        applyPlanRewind(state, request, []);
        throw new PlanRewindError("PLAN_REWIND_INVARIANT", "rejected plan rewind stage unexpectedly validated");
      } catch (error) {
        return flowRewindEnvelope(error);
      }
    }
    if (supportedFlowStage && state.currentTaskId == null) {
      try {
        const request = createFlowRewindRequest({ root, state, ctx, reason, sourceStage: previousActiveStep });
        // Validate the complete candidate before walking or hashing artifacts.
        applyPlanRewind(state, request, []);
        const specDir = path.dirname(path.resolve(root, relativeFlowSpecFile(state)));
        const evidence = capturePlanRewindEvidence(specDir);
        const draft = findStepById(state.steps || [], "draft");
        const transition = new ExplicitRecoveryTransition({
          stepId: "draft",
          currentStatus: draft?.status,
          requestedStatus: "in_progress",
          entrypoint: "reopen-draft",
          request,
          evidence,
        });
        const audit = flowManager.rewindPlan(transition);
        return Envelope.ok("run", "reopen-draft", {
          reopened: true,
          mode: "flow-level",
          previousActiveStep,
          destinationStep: audit.destinationStep,
          rewoundAt: audit.rewoundAt,
          invalidatedStepIds: audit.invalidatedStepIds,
          invalidatedEvidence: audit.invalidatedEvidence,
          retryReset: {
            review: audit.reviewRetryResetPhases,
            gate: audit.gateRetryResetPhases,
          },
        });
      } catch (error) {
        return flowRewindEnvelope(error);
      }
    }
    if (PLAN_REOPEN_ACTIVE_STEPS.includes(previousActiveStep)) {
      const transition = createReopenResetTransition(state, ["draft", ...PLAN_REOPEN_RESET_STEPS]);
      flowManager.rewindPlan(transition);
      const resetSteps = transition.changes.map((change) => change.stepId);

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

    const transition = createReopenResetTransition(
      state,
      ["draft", ...PLAN_REOPEN_RESET_STEPS, "implement"],
    );
    flowManager.rewindPlan(transition);
    const resetSteps = transition.changes.map((change) => change.stepId);

    appendIssueLog(root, state, {
      step: "draft",
      reason: `reopen-draft triggered: draft step rewound to add new tasks mid-implementation${reason ? ` — ${reason}` : ""}`,
      trigger: "user invoked senti flow reopen-draft",
      resolution: `draft step set to in_progress; reset flow steps: ${resetSteps.join(", ")}`,
    });

    return Envelope.ok("run", "reopen-draft", {
      reopened: true,
      mode: "implementation",
      resetSteps,
      doneTaskCount: tasks.filter((task) => task.status === "done").length,
      taskCount: tasks.length,
    });
  }
}

export default RunReopenDraftCommand;
