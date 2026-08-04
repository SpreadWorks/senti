/**
 * src/flow/definition.js
 *
 * Single source of truth for the Spec-Driven Development flow structure.
 *
 * Every node carries the attributes that other modules previously derived
 * from context-rules.json, registry hooks, hardcoded constants, or prompt
 * literals. Adding / reordering steps is done here; consumers derive
 * behaviour from this data structure instead of maintaining parallel maps.
 *
 * Max depth: 3 (root list → branch → leaf). Traversal helpers enforce this.
 */

import fs from "fs";
import path from "path";
import { AtomicFile } from "../lib/atomic-file.js";
import { draftReviewRouteForKey, draftReviewRouteForRetryPhase } from "./lib/draft-review-routes.js";
import {
  flattenSteps,
  findFirstPendingLeaf,
  findStepById,
} from "./lib/step-tree.js";
import { nonblockingRouteFor } from "./lib/nonblocking-route.js";

const MAX_DEPTH = 3;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

class ScalarMaxAttempts {
  constructor(value) {
    if (!isPositiveInteger(value)) {
      throw new Error("invalid maxAttempts: expected a positive integer");
    }
    this.value = value;
    Object.freeze(this);
  }

  resolve() {
    return this.value;
  }
}

class ModeMaxAttempts {
  constructor(value) {
    if (!isPlainObject(value)) {
      throw new Error("invalid maxAttempts: expected exactly own auto/manual keys");
    }
    const keys = Object.keys(value);
    if (
      keys.length !== 2
      || !Object.hasOwn(value, "auto")
      || !Object.hasOwn(value, "manual")
    ) {
      throw new Error("invalid maxAttempts: expected exactly own auto/manual keys");
    }
    if (!isPositiveInteger(value.auto) || !isPositiveInteger(value.manual)) {
      throw new Error("invalid maxAttempts: auto/manual must be positive integers");
    }
    this.auto = value.auto;
    this.manual = value.manual;
    Object.freeze(this);
  }

  resolve(context = {}) {
    return context.autoApprove === true ? this.auto : this.manual;
  }
}

function isPlainObject(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
  );
}

function createMaxAttempts(value) {
  if (typeof value === "number") return new ScalarMaxAttempts(value);
  return new ModeMaxAttempts(value);
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function requireStepList(value, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${field} must be a non-empty array`);
  }
  return Object.freeze(value.map((step) => requireString(step, field)));
}

const STEP_STATUSES = new Set(["pending", "in_progress", "done", "skipped"]);
const FAILURE_POLICIES = new Set(["retry", "record", "amend-spec", "block"]);

export class SetStepStatus {
  constructor({ step, status, suppressAutoPromotion = false }) {
    this.step = requireString(step, "step");
    this.status = requireString(status, "status");
    if (!STEP_STATUSES.has(this.status)) throw new Error(`invalid status: ${this.status}`);
    if (typeof suppressAutoPromotion !== "boolean") {
      throw new Error("suppressAutoPromotion must be boolean");
    }
    this.suppressAutoPromotion = suppressAutoPromotion;
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.setStepStatus(this.step, this.status, this);
  }

  forStep(step) {
    const scopedStep = requireString(step, "step");
    if (scopedStep === this.step) return this;
    return new SetStepStatus({
      step: scopedStep,
      status: this.status,
      suppressAutoPromotion: this.suppressAutoPromotion,
    });
  }
}

const DEFINITION_LIFECYCLE_PLAN_TOKEN = Symbol("definition-lifecycle-plan");

export class DefinitionLifecyclePlan {
  constructor(token, { event, currentStepId, actions }) {
    if (token !== DEFINITION_LIFECYCLE_PLAN_TOKEN) {
      throw new Error("DefinitionLifecyclePlan is created only by the definition resolver");
    }
    if (!Array.isArray(actions)) throw new Error("actions must be an array");
    const lifecycleActions = [...actions];
    const hasStepTransition = lifecycleActions.some((action) => action instanceof SetStepStatus);
    this.event = requireString(event, "event");
    this.currentStepId = currentStepId == null && !hasStepTransition
      ? null
      : requireString(currentStepId, "currentStepId");
    this.actions = Object.freeze(lifecycleActions);
    Object.freeze(this);
  }

  allows(action) {
    return this.actions.includes(action);
  }

  forStepAlias({ sourceStep, targetStep }) {
    const source = requireString(sourceStep, "sourceStep");
    const target = requireString(targetStep, "targetStep");
    if (source === target) return this;
    const actions = this.actions.map((action) => (
      action instanceof SetStepStatus && action.step === source
        ? action.forStep(target)
        : action
    ));
    const currentStepId = this.currentStepId === source ? target : this.currentStepId;
    if (currentStepId === this.currentStepId && actions.every((action, index) => action === this.actions[index])) {
      return this;
    }
    return new DefinitionLifecyclePlan(DEFINITION_LIFECYCLE_PLAN_TOKEN, {
      event: this.event,
      currentStepId,
      actions,
    });
  }
}

export class KeepInProgress {
  constructor({ step }) {
    this.step = requireString(step, "step");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.keepInProgress(this.step);
  }
}

export class IncrementMetric {
  constructor({ phase, counter }) {
    this.phase = requireString(phase, "phase");
    this.counter = requireString(counter, "counter");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.incrementMetric(this.phase, this.counter);
  }
}

export class AppendIssueLog {
  constructor({ source }) {
    this.source = requireString(source, "source");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.appendIssueLog(this.source);
  }
}

export class ExecuteSideEffects {
  constructor() {
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.executeSideEffects();
  }
}

export class SkipSteps {
  constructor({ steps }) {
    this.steps = requireStepList(steps, "steps");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.skipSteps([...this.steps]);
  }
}

export class ResetSteps {
  constructor({ steps }) {
    this.steps = requireStepList(steps, "steps");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.resetSteps([...this.steps]);
  }
}

export class RunLifecycleHook {
  constructor({ module, handler, args = null }) {
    this.module = requireString(module, "module");
    this.handler = requireString(handler, "handler");
    this.args = args == null ? null : Object.freeze({ ...args });
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.runLifecycleHook(this.module, this.handler, this.args);
  }
}

export class BeginOutboxEffect {
  constructor({ step }) {
    this.step = requireString(step, "step");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.beginOutboxEffect(this.step);
  }
}

export class CompleteOutboxEffect {
  constructor({ step }) {
    this.step = requireString(step, "step");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.completeOutboxEffect(this.step);
  }
}

export class FailOutboxEffect {
  constructor({ step }) {
    this.step = requireString(step, "step");
    Object.freeze(this);
  }

  apply(adapter) {
    return adapter.failOutboxEffect(this.step);
  }
}

export function applyLifecycleActions(adapter, actions) {
  for (const action of actions) action.apply(adapter);
}

const FINALIZE_SUCCESS_STATUSES = new Set(["done", "completed", "skipped"]);
const REVIEW_STEP_BY_PHASE = Object.freeze({
  "draft-questions": "draft-questions-review",
  "draft-coverage": "draft-coverage-review",
  spec: "spec-review",
  test: "test-review",
  impl: "impl-review",
});
const IMPL_REVIEW_RESET_RANGE = Object.freeze([
  "test-execute",
  "test-result-review",
  "impl-review",
  "impl-triage",
  "impl-repair",
  "impl-gate",
  "retro",
  "acceptance-review",
  "acceptance-decision",
  "final-regression",
  "report",
  "finalize-commit",
  "finalize-merge",
  "finalize-sync",
  "finalize-cleanup",
]);
const REJECTED_IMPL_REVIEW_RESET_STEPS = Object.freeze([
  "impl-repair",
  "impl-gate",
]);
const REBUILDABLE_TEST_ARTIFACT_PATHS = Object.freeze([
  "upgrade-result.json",
  "scenario-validity-result.json",
  "test-execute-result.json",
  "test-result-review.json",
  "test-result-review.md",
  "impl-gate-result.json",
  "final-regression-result.json",
  "retro.json",
  "acceptance-review.json",
  "report.json",
  "tests/.raw/upgrade.log",
  "tests/.raw/scenario-validity.log",
  "tests/.raw/test-execution.log",
  "tests/.raw/requirement-summary.json",
]);

function isFinalizeSuccess(result) {
  return FINALIZE_SUCCESS_STATUSES.has(String(result?.status || result?.data?.status || ""));
}

function gateStepIdForPhase(phase) {
  return Object.fromEntries(collectGatePhaseEntries())[phase] || "spec-gate";
}

function draftReviewRouteForInput(input = {}) {
  const retryPhase = input.result?.artifacts?.retryPhase
    || (String(input.phase || "").startsWith("draft-") ? input.phase : null);
  return draftReviewRouteForRetryPhase(retryPhase || "draft-questions");
}

function reviewStepIdForInput(input = {}) {
  const phase = input.result?.artifacts?.phase || input.phase;
  if (phase === "draft" || phase === "draft-questions" || phase === "draft-coverage") {
    return draftReviewRouteForInput(input).reviewStepId;
  }
  return REVIEW_STEP_BY_PHASE[phase] || input.currentStepId || null;
}

export function resolveRuntimeStep(input = {}) {
  const command = input.command || input.action;
  if (command === "run-review") return reviewStepIdForInput(input);
  if (command === "run-gate") return gateStepIdForPhase(input.phase || input.result?.artifacts?.phase);
  if (command === "report") return "report";
  if (String(command || "").startsWith("finalize-")) return command;
  return input.currentStepId || null;
}

function resolveDraftReviewLifecycle(input) {
  const route = draftReviewRouteForInput(input);
  const verdict = input.result?.artifacts?.verdict;
  const actions = [];
  if (!["PASS", "ADVISORY", "REJECTED"].includes(verdict)) return actions;
  if (verdict === "PASS") {
    actions.push(new RunLifecycleHook({
      module: "review",
      handler: "commitDraftReviewPassArtifacts",
      args: { retryPhase: route.retryPhase },
    }));
  }
  actions.push(new SetStepStatus({ step: route.reviewStepId, status: "done" }));
  if (verdict === "PASS") {
    actions.push(new SetStepStatus({ step: route.triageStepId, status: "done" }));
    actions.push(new SetStepStatus({ step: route.repairStepId, status: "done" }));
  }
  actions.push(new IncrementMetric({ phase: route.retryPhase, counter: "reviewRetry" }));
  return actions;
}

function resolvePlanReviewLifecycle(input) {
  const phase = input.result?.artifacts?.phase || input.phase;
  const verdict = input.result?.artifacts?.verdict;
  const toolingOutcome = input.result?.artifacts?.toolingOutcome;
  if (phase === "draft" || phase === "draft-questions" || phase === "draft-coverage") {
    const route = nonblockingRouteFor(draftReviewRouteForInput(input).reviewStepId);
    if (input.flowState?.nonblocking?.enabled === true && route && (verdict === "REJECTED" || toolingOutcome)) {
      return [];
    }
    return resolveDraftReviewLifecycle(input);
  }
  const actions = [];
  const recordRetry = !toolingOutcome;
  if (phase === "spec") {
    if (input.flowState?.nonblocking?.enabled === true && (verdict === "REJECTED" || toolingOutcome)) return [];
    if (verdict === "PASS" || verdict === "ADVISORY") {
      actions.push(
        new SetStepStatus({ step: "spec-review", status: "done" }),
        new SetStepStatus({ step: "spec-triage", status: "done" }),
        new SetStepStatus({ step: "spec-repair", status: "done" }),
      );
    } else if (verdict === "REJECTED") {
      actions.push(new SetStepStatus({ step: "spec-review", status: "done" }));
    }
    if (recordRetry) actions.push(new IncrementMetric({ phase, counter: "reviewRetry" }));
    return actions;
  }
  if (phase === "test") {
    if (input.flowState?.nonblocking?.enabled === true && (verdict === "REJECTED" || toolingOutcome)) {
      // A test-review advisory decision must create the same durable
      // acceptance handoff as retry exhaustion before it can advance.
      return actions;
    }
    if (verdict === "PASS" || verdict === "ADVISORY") {
      actions.push(new SetStepStatus({ step: "test-review", status: "done" }));
    } else if (toolingOutcome) {
      actions.push(new AppendIssueLog({ source: "test-review-tooling-failure" }));
    }
    if (recordRetry) actions.push(new IncrementMetric({ phase, counter: "reviewRetry" }));
    return actions;
  }
  if (recordRetry) actions.push(new IncrementMetric({ phase, counter: "reviewRetry" }));
  return actions;
}

function resolveImplReviewLifecycle(input) {
  const artifacts = input.result?.artifacts;
  const flowScoped = artifacts?.phase === "impl" && artifacts?.taskId == null;
  if (input.result?.artifacts?.deferred === true) {
    if (!flowScoped) return [];
    return [
      new SetStepStatus({ step: "impl-triage", status: "done" }),
      new SetStepStatus({ step: "impl-repair", status: "done" }),
    ];
  }
  const verdict = input.result?.artifacts?.verdict;
  const toolingOutcome = input.result?.artifacts?.toolingOutcome;
  const proposalCount = input.result?.artifacts?.proposalCount ?? 0;
  const actions = [];
  if (input.flowState?.nonblocking?.enabled === true && input.result?.artifacts?.phase === "impl" && (
    verdict === "REJECTED" || toolingOutcome
  )) {
    // Evidence stays authoritative; the agent records repair/retry/continue
    // through the guarded nonblocking decision command.
    return actions;
  }
  if (input.result?.artifacts?.phase === "impl") {
    if (toolingOutcome) return actions;
    if (!flowScoped) {
      if (verdict === "PASS" || verdict === "ADVISORY") {
        actions.push(new SetStepStatus({ step: input.currentStepId || "impl-review", status: "done" }));
      }
      actions.push(new IncrementMetric({ phase: "impl", counter: "reviewRetry" }));
      return actions;
    }
    if (verdict === "PASS" || verdict === "ADVISORY") {
      actions.push(
        new SetStepStatus({ step: input.currentStepId || "impl-review", status: "done" }),
        new SetStepStatus({ step: "impl-triage", status: "done" }),
        new SetStepStatus({ step: "impl-repair", status: "done" }),
        new SetStepStatus({ step: "impl-gate", status: "in_progress" }),
      );
    } else if (flowScoped && verdict === "REJECTED") {
      actions.push(
        new ResetSteps({ steps: REJECTED_IMPL_REVIEW_RESET_STEPS }),
        new SetStepStatus({ step: input.currentStepId || "impl-review", status: "done" }),
        new SetStepStatus({ step: "impl-triage", status: "in_progress" }),
      );
    }
    actions.push(new IncrementMetric({ phase: "impl", counter: "reviewRetry" }));
    return actions;
  }
  if (!input.dryRun && proposalCount > 0) {
    actions.push(
      new ResetSteps({ steps: IMPL_REVIEW_RESET_RANGE }),
      new RunLifecycleHook({ module: "review", handler: "resetImplEvidenceAfterReviewProposals" }),
    );
    return actions;
  }
  actions.push(new SetStepStatus({ step: input.currentStepId || "impl-review", status: "done" }));
  return actions;
}

function resolveReviewLifecycle(input) {
  if (input.result?.artifacts?.deferred === true) return [];
  if (input.phase === "draft" || input.phase === "spec" || input.phase === "test") {
    return resolvePlanReviewLifecycle(input);
  }
  return resolveImplReviewLifecycle(input);
}

function resolveGateLifecycle(input) {
  const phase = input.result?.artifacts?.phase || input.phase;
  const active = findActiveNode(input.flowState || {});
  const step = active?.stepId === "task-gate" ? "task-gate" : gateStepIdForPhase(phase);
  if (input.event === "gate:pre") {
    return [new SetStepStatus({ step, status: "in_progress" })];
  }
  if (input.result?.artifacts?.deferred === true) return [];
  if (input.flowState?.nonblocking?.enabled === true && input.result?.result !== "pass" && nonblockingRouteFor(step)) {
    return [];
  }
  const actions = [];
  if (input.result?.result === "pass") {
    actions.push(new SetStepStatus({ step, status: "done" }));
    actions.push(new IncrementMetric({ phase, counter: "gateRetry" }));
    actions.push(new ExecuteSideEffects());
  } else {
    actions.push(new SetStepStatus({ step, status: "in_progress" }));
    actions.push(new IncrementMetric({ phase, counter: "gateRetry" }));
    actions.push(new AppendIssueLog({ source: "gate-result" }));
  }
  return actions;
}

function finalizeMergeMetadataPreflightAction() {
  return new RunLifecycleHook({
    module: "finalize",
    handler: "assertFinalizeMergeMetadataMutationSafe",
  });
}

function resolveFinalizeLifecycle(input) {
  const command = input.command || input.currentStepId || input.targetStepId;
  if (input.event === "finalize:interrupted" && command === "finalize-sync") {
    return [new SetStepStatus({ step: command, status: "skipped" })];
  }
  if (input.event === "finalize:pre") {
    const actions = [];
    if (command === "finalize-merge") {
      actions.push(finalizeMergeMetadataPreflightAction());
    } else if (command === "finalize-sync") {
      actions.push(new RunLifecycleHook({ module: "finalize", handler: "resolveMainRepoFlowManager" }));
    }
    if (command === "finalize-merge") {
      actions.push(new RunLifecycleHook({
        module: "finalize",
        handler: "prepareFinalizeMerge",
        args: { steps: ["finalize-sync", "finalize-cleanup"] },
      }));
      // Record the idempotency key before RunFinalizeMergeCommand can start
      // the merge. The post lifecycle begins the same identity again after
      // authority switches to main, which is how the pending entry is carried
      // into main's flow state without a clean-path metadata-only commit.
      actions.push(new BeginOutboxEffect({ step: command }));
    } else {
      actions.push(new BeginOutboxEffect({ step: command }));
    }
    return actions;
  }
  if (input.event === "finalize:onError") {
    const actions = [];
    if (command === "finalize-merge") {
      actions.push(finalizeMergeMetadataPreflightAction());
    } else if (command === "finalize-sync") {
      actions.push(new RunLifecycleHook({ module: "finalize", handler: "resolveMainRepoFlowManager" }));
    } else if (command === "finalize-cleanup") {
      actions.push(new RunLifecycleHook({ module: "finalize", handler: "resolveCleanupOutboxFlowManager" }));
    }
    if (command === "finalize-merge") {
      actions.push(new FailOutboxEffect({ step: command }));
      actions.push(new SkipSteps({ steps: ["finalize-sync", "finalize-cleanup"] }));
    } else {
      actions.push(new FailOutboxEffect({ step: command }));
      if (command === "finalize-sync") {
        actions.push(new SetStepStatus({ step: command, status: "skipped" }));
      }
    }
    actions.push(new RunLifecycleHook({ module: "finalize", handler: "finalizeOnError", args: { command } }));
    if (command === "finalize-merge") {
      actions.push(new RunLifecycleHook({
        module: "finalize",
        handler: "commitFinalizeMergeConflictMetadata",
      }));
    }
    return actions;
  }
  if (!isFinalizeSuccess(input.result)) return [new FailOutboxEffect({ step: command })];
  const actions = [];
  if (command === "finalize-merge" || command === "finalize-sync" || command === "finalize-cleanup") {
    actions.push(new RunLifecycleHook({
      module: "finalize",
      handler: "resolveMainRepoFlowManager",
      args: command === "finalize-merge" ? { unlessPr: true } : null,
    }));
  }
  if (command === "finalize-merge") {
    actions.push(
      new BeginOutboxEffect({ step: command }),
      new RunLifecycleHook({ module: "finalize", handler: "ensureFinalizeMergeInProgress" }),
      new RunLifecycleHook({ module: "finalize", handler: "recordMergeOutcome" }),
      new RunLifecycleHook({
        module: "finalize",
        handler: "resetSkippedDownstreamSteps",
        args: { steps: ["finalize-sync", "finalize-cleanup"] },
      }),
    );
  }
  actions.push(new SetStepStatus({
    step: command,
    status: "done",
    // A retried merge restores its downstream leaves for the next normal
    // command; it does not begin finalize-sync as part of merge completion.
    suppressAutoPromotion: command === "finalize-merge",
  }));
  actions.push(new CompleteOutboxEffect({ step: command }));
  return actions;
}

function resolveReportLifecycle(input) {
  if (input.event === "report:pre") return [new BeginOutboxEffect({ step: "report" })];
  if (input.event === "report:onError") return [new FailOutboxEffect({ step: "report" })];
  if (input.result?.result !== "ok") return [new FailOutboxEffect({ step: "report" })];
  return [
    new SetStepStatus({ step: "report", status: "done" }),
    new CompleteOutboxEffect({ step: "report" }),
  ];
}

function resolveLifecycleForNode(node, input = {}) {
  if (input.event === "review:post" || node.action === "run-review") return resolveReviewLifecycle(input);
  if (input.event === "gate:post" || node.action === "run-gate") return resolveGateLifecycle(input);
  if (String(input.event || "").startsWith("report:") || node.action === "run-report") {
    return resolveReportLifecycle(input);
  }
  if (String(input.event || "").startsWith("finalize:") || String(node.action || "").startsWith("run-finalize-")) {
    return resolveFinalizeLifecycle(input);
  }
  return [];
}

export function resolveLifecycle(input = {}) {
  if (input.event === "set-step:impl-triage") {
    return [
      new SetStepStatus({ step: "impl-repair", status: "done" }),
      new SetStepStatus({ step: "impl-gate", status: "in_progress" }),
    ];
  }
  if ([
    "gate:defer",
    "gate:phase-inference",
    "review:defer",
    "finalize-cleanup:complete",
    "definition:keep-in-progress",
    "definition:skip-steps",
    "test-execute:post",
    "scenario-validity:post",
    "test-result-review:post",
    "retro:post",
    "final-regression:post",
  ].includes(input.event)) {
    return [new SetStepStatus({ step: input.targetStepId, status: input.status })];
  }
  const stepId = input.currentStepId || resolveRuntimeStep(input);
  const node = stepId ? (getFlowNode(stepId) || getTaskNode(stepId)) : null;
  if (!node) return [];
  return node.resolveLifecycle(input);
}

export function resolveLifecyclePlan(input = {}) {
  let actions = resolveLifecycle(input);
  const currentStepId = input.currentStepId || resolveRuntimeStep(input) || input.targetStepId || null;
  if (input.settleInProgressAsDone === true) {
    actions = actions.map((action) => (
      action instanceof SetStepStatus
        && action.step === currentStepId
        && action.status === "in_progress"
        ? new SetStepStatus({ step: action.step, status: "done" })
        : action
    ));
  }
  return new DefinitionLifecyclePlan(DEFINITION_LIFECYCLE_PLAN_TOKEN, {
    event: input.event,
    currentStepId,
    actions,
  });
}

function writeEmptyDraftReviewArtifact({
  file,
  phase,
  sourceField,
  sourceArtifact,
  generatedAt,
  summary,
}) {
  const payload = {
    version: 1,
    phase: requireString(phase, "phase"),
    [sourceField]: requireString(sourceArtifact, sourceField),
    generatedAt: requireString(generatedAt, "generatedAt"),
    summary: requireString(summary, "summary"),
    items: [],
  };
  new AtomicFile(file, { phaseNamespace: "draft-review" })
    .write(`${JSON.stringify(payload, null, 2)}\n`);
}

export function writeEmptyDraftReviewRouteArtifacts({
  specDir,
  route,
  generatedAt = new Date().toISOString(),
}) {
  fs.mkdirSync(specDir, { recursive: true });
  writeEmptyDraftReviewArtifact({
    file: path.join(specDir, route.triageArtifact),
    phase: route.triageStepId,
    sourceField: "sourceReview",
    sourceArtifact: route.reviewArtifact,
    generatedAt,
    summary: "No draft review findings to triage.",
  });
  writeEmptyDraftReviewArtifact({
    file: path.join(specDir, route.repairArtifact),
    phase: route.repairStepId,
    sourceField: "sourceTriage",
    sourceArtifact: route.triageArtifact,
    generatedAt,
    summary: "No draft triage items to repair.",
  });
  let approvalEligible = false;
  if (route.key === "coverage") {
    const draftPath = path.join(specDir, "draft.json");
    const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
    const unresolved = Array.isArray(draft.qa)
      && draft.qa.some((entry) => entry?.status === "pending" || entry?.status === "approved");
    if (!unresolved) {
      approvalEligible = true;
    }
  }
  return Object.freeze({ approvalEligible, generatedAt });
}

export function resetImplEvidenceAfterReviewProposals({ specDir, flowState }) {
  for (const relPath of REBUILDABLE_TEST_ARTIFACT_PATHS) {
    const filePath = path.join(specDir, relPath);
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
  }
  for (const id of IMPL_REVIEW_RESET_RANGE) {
    const step = findStepById(flowState.steps || [], id);
    if (!step) continue;
    step.status = "pending";
    delete step.finishedAt;
    delete step.startedAt;
  }
  return true;
}

class FlowExecutionCommand {
  constructor(subcommand, ...args) {
    const tokens = [subcommand, ...args];
    if (tokens.some((token) => (
      typeof token !== "string" || token.trim() === "" || /\s/.test(token)
    ))) {
      throw new Error("flow execution command tokens must be non-empty strings without whitespace");
    }
    this.tokens = Object.freeze(["senti", "flow", "run", ...tokens]);
    Object.freeze(this);
  }

  toString() {
    return this.tokens.join(" ");
  }
}

class FlowNode {
  constructor({
    id,
    label,
    action,
    instructionsKey,
    contextKinds = [],
    outputSchemaRef = null,
    requiresApproval = false,
    autoApproveChoiceId = null,
    skippable = false,
    maxAttempts = 1,
    toolingMaxAttempts = null,
    fallbacks = null,
    children = null,
    sideEffects = null,
    gatePhase = null,
    failurePolicy = null,
    definitionLifecycleOwned = false,
    executionCommand = null,
  }) {
    this.id = id;
    this.label = label;
    this.action = action;
    this.instructionsKey = instructionsKey;
    this.contextKinds = Object.freeze([...contextKinds]);
    this.outputSchemaRef = outputSchemaRef;
    this.requiresApproval = requiresApproval;
    if (autoApproveChoiceId !== null && (requiresApproval !== true || autoApproveChoiceId !== "1")) {
      throw new Error("autoApproveChoiceId must be choice id=1 on an approval-required step");
    }
    this.autoApproveChoiceId = autoApproveChoiceId;
    this.skippable = skippable;
    this.maxAttempts = createMaxAttempts(maxAttempts);
    this.toolingMaxAttempts = toolingMaxAttempts == null ? null : createMaxAttempts(toolingMaxAttempts);
    this.fallbacks = fallbacks ? Object.freeze([...fallbacks]) : null;
    this.children = children ? Object.freeze(children.map((c) => Object.freeze(c))) : null;
    this.sideEffects = sideEffects ? Object.freeze([...sideEffects]) : null;
    this.gatePhase = gatePhase ? Object.freeze([...gatePhase]) : null;
    this.definitionLifecycleOwned = definitionLifecycleOwned === true;
    if (this.definitionLifecycleOwned && !this.action.startsWith("run-")) {
      throw new Error(`definition lifecycle-owned action must start with run-: ${this.action}`);
    }
    if (
      this.definitionLifecycleOwned
      && !(executionCommand instanceof FlowExecutionCommand)
    ) {
      throw new Error(`definition lifecycle-owned step must declare executionCommand: ${this.id}`);
    }
    if (!this.definitionLifecycleOwned && executionCommand !== null) {
      throw new Error(`only definition lifecycle-owned steps may declare executionCommand: ${this.id}`);
    }
    this.executionCommand = executionCommand;
    if (failurePolicy !== null && !FAILURE_POLICIES.has(failurePolicy)) {
      throw new Error(`invalid failurePolicy: ${failurePolicy}`);
    }
    this.failurePolicy = failurePolicy;
  }

  get isBranch() { return this.children != null; }
  get isLeaf() { return this.children == null; }

  resolveMaxAttempts(context = {}) {
    return this.maxAttempts.resolve(context);
  }

  resolveToolingMaxAttempts(context = {}) {
    return this.toolingMaxAttempts?.resolve(context) ?? null;
  }

  resolveLifecycle(input = {}) {
    return resolveLifecycleForNode(this, input);
  }
}

const DRAFT_QUESTIONS_ROUTE = draftReviewRouteForKey("questions");
const DRAFT_COVERAGE_ROUTE = draftReviewRouteForKey("coverage");
const DRAFT_REVIEW_ROUTE_EXPECTATIONS = Object.freeze([
  Object.freeze({
    route: DRAFT_QUESTIONS_ROUTE,
    triageStepId: "draft-questions-triage",
    repairStepId: "draft-questions-repair",
  }),
  Object.freeze({
    route: DRAFT_COVERAGE_ROUTE,
    triageStepId: "draft-coverage-triage",
    repairStepId: "draft-coverage-repair",
  }),
]);
for (const expectation of DRAFT_REVIEW_ROUTE_EXPECTATIONS) {
  if (
    expectation.route.triageStepId !== expectation.triageStepId
    || expectation.route.repairStepId !== expectation.repairStepId
  ) {
    throw new Error(`draft review route mismatch: ${expectation.triageStepId}`);
  }
}
const PLAN_REVIEW_MAX_ATTEMPTS_BY_ID = Object.freeze({
  "draft-questions-review": Object.freeze({ auto: 1, manual: 1 }),
  "draft-coverage-review": Object.freeze({ auto: 1, manual: 1 }),
  "spec-review": Object.freeze({ auto: 4, manual: 4 }),
  "test-review": Object.freeze({ auto: 5, manual: 5 }),
});

function createPlanReviewNode({ id, label, contextKinds, executionCommand }) {
  const maxAttempts = PLAN_REVIEW_MAX_ATTEMPTS_BY_ID[id];
  return new FlowNode({
    id,
    label,
    action: "run-review",
    instructionsKey: `plan.${id}`,
    contextKinds,
    outputSchemaRef: "next-action/review.schema.json",
    maxAttempts,
    toolingMaxAttempts: 1,
    failurePolicy: "retry",
    definitionLifecycleOwned: true,
    executionCommand,
  });
}

function createDraftReviewLeafNode({ id, label }) {
  return new FlowNode({
    id,
    label,
    action: "write-draft",
    instructionsKey: `plan.${id}`,
    contextKinds: ["draft", "issue", "guardrail"],
    outputSchemaRef: "next-action/spec.schema.json",
    maxAttempts: 1,
  });
}

function createDraftReviewRouteNodes(route) {
  return [
    createDraftReviewLeafNode({
      id: route.triageStepId,
      label: `${route.label} triage`,
    }),
    createDraftReviewLeafNode({
      id: route.repairStepId,
      label: `${route.label} repair`,
    }),
  ];
}

// ── FLOW_DEFINITION ─────────────────────────────────────────────────────────

const FLOW_DEFINITION = Object.freeze([
  new FlowNode({
    id: "plan",
    label: "Plan",
    children: [
      new FlowNode({
        id: "branch",
        label: "Branch",
        action: "create-branch",
        instructionsKey: "plan.branch",
        contextKinds: [],
        skippable: true,
      }),
      new FlowNode({
        id: "prepare-spec",
        label: "Prepare spec",
        action: "prepare-spec",
        instructionsKey: "plan.prepare-spec",
        contextKinds: [],
      }),
      new FlowNode({
        id: "draft",
        label: "Draft",
        action: "write-draft",
        instructionsKey: "plan.draft",
        contextKinds: ["issue", "guardrail", "project_overview"],
        outputSchemaRef: "next-action/draft.schema.json",
        maxAttempts: 1,
      }),
      createPlanReviewNode({
        id: "draft-questions-review",
        label: "Review (draft questions)",
        contextKinds: ["draft", "issue"],
        executionCommand: new FlowExecutionCommand("review", "--phase", "draft"),
      }),
      ...createDraftReviewRouteNodes(DRAFT_QUESTIONS_ROUTE),
      new FlowNode({
        id: "draft-refine",
        label: "Draft refine",
        action: "write-draft",
        instructionsKey: "plan.draft-refine",
        contextKinds: ["draft", "issue", "guardrail", "project_overview"],
        outputSchemaRef: "next-action/draft.schema.json",
        maxAttempts: 1,
      }),
      createPlanReviewNode({
        id: "draft-coverage-review",
        label: "Review (draft coverage)",
        contextKinds: ["draft", "issue"],
        executionCommand: new FlowExecutionCommand("review", "--phase", "draft"),
      }),
      ...createDraftReviewRouteNodes(DRAFT_COVERAGE_ROUTE),
      new FlowNode({
        id: "draft-gate",
        label: "Gate (draft)",
        action: "run-gate",
        instructionsKey: "plan.draft-gate",
        contextKinds: ["draft", "guardrail"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 5,
        gatePhase: ["draft"],
        failurePolicy: "block",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("gate"),
      }),
      new FlowNode({
        id: "spec",
        label: "Spec",
        action: "write-spec",
        instructionsKey: "plan.spec",
        contextKinds: ["draft", "guardrail"],
        outputSchemaRef: "next-action/spec.schema.json",
      }),
      createPlanReviewNode({
        id: "spec-review",
        label: "Review (spec)",
        contextKinds: ["spec", "guardrail"],
        executionCommand: new FlowExecutionCommand("review", "--phase", "spec"),
      }),
      new FlowNode({
        id: "spec-triage",
        label: "Spec review triage",
        action: "write-spec",
        instructionsKey: "plan.spec-triage",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/spec.schema.json",
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "spec-repair",
        label: "Spec repair",
        action: "write-spec",
        instructionsKey: "plan.spec-repair",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/spec.schema.json",
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "spec-gate",
        label: "Gate (spec)",
        action: "run-gate",
        instructionsKey: "plan.spec-gate",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 5,
        gatePhase: ["spec", "task-spec"],
        failurePolicy: "block",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("gate"),
      }),
      new FlowNode({
        id: "approval",
        label: "Approval",
        action: "await-approval",
        instructionsKey: "plan.approval",
        contextKinds: ["spec"],
        outputSchemaRef: "next-action/approval.schema.json",
        requiresApproval: true,
        autoApproveChoiceId: "1",
        sideEffects: ["syncSpecTasks", "autoUpgradeReeval"],
      }),
      new FlowNode({
        id: "test",
        label: "Test",
        action: "write-tests",
        instructionsKey: "plan.test",
        contextKinds: ["spec", "guardrail"],
        outputSchemaRef: "next-action/spec.schema.json",
      }),
      new FlowNode({
        id: "scenario-validity",
        label: "Scenario Validity",
        action: "run-scenario-validity",
        instructionsKey: "plan.scenario-validity",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/scenario-validity.schema.json",
        maxAttempts: 3,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("scenario-validity"),
      }),
      createPlanReviewNode({
        id: "test-review",
        label: "Review (test)",
        contextKinds: ["spec", "guardrail"],
        executionCommand: new FlowExecutionCommand("review", "--phase", "test"),
      }),
    ],
  }),

  new FlowNode({
    id: "impl",
    label: "Implementation",
    children: [
      new FlowNode({
        id: "implement",
        label: "Implement",
        action: "run-impl",
        instructionsKey: "impl.implement",
        contextKinds: ["spec", "test", "overview"],
        outputSchemaRef: "next-action/impl.schema.json",
        maxAttempts: 3,
      }),
      new FlowNode({
        id: "test-execute",
        label: "Test Execute",
        action: "run-test-execute",
        instructionsKey: "impl.test-execute",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/test-execute.schema.json",
        maxAttempts: 3,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("test-execute"),
      }),
      new FlowNode({
        id: "test-result-review",
        label: "Test Result Review",
        action: "run-test-result-review",
        instructionsKey: "impl.test-result-review",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/test-result-review.schema.json",
        maxAttempts: 3,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("test-result-review"),
      }),
      new FlowNode({
        id: "impl-review",
        label: "Review",
        action: "run-review",
        instructionsKey: "impl.impl-review",
        contextKinds: ["spec", "diff", "testlog"],
        outputSchemaRef: "next-action/review.schema.json",
        maxAttempts: 4,
        toolingMaxAttempts: 1,
        failurePolicy: "retry",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("review", "--phase", "impl"),
      }),
      new FlowNode({
        id: "impl-triage",
        label: "Implementation review triage",
        action: "write-impl-triage",
        instructionsKey: "impl.impl-triage",
        contextKinds: ["spec", "diff"],
        outputSchemaRef: "next-action/impl.schema.json",
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "impl-repair",
        label: "Implementation repair",
        action: "run-impl-repair",
        instructionsKey: "impl.impl-repair",
        contextKinds: ["spec", "diff"],
        outputSchemaRef: "next-action/impl.schema.json",
        maxAttempts: 3,
      }),
      new FlowNode({
        id: "impl-gate",
        label: "Gate (impl)",
        action: "run-gate",
        instructionsKey: "impl.impl-gate",
        contextKinds: ["spec", "diff", "testlog"],
        outputSchemaRef: "next-action/gate.schema.json",
        maxAttempts: 5,
        sideEffects: [],
        gatePhase: ["integration", "task-impl"],
        failurePolicy: "block",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("gate"),
      }),
      new FlowNode({
        id: "retro",
        label: "Retrospective",
        action: "run-retro",
        instructionsKey: "impl.retro",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/retro.schema.json",
        maxAttempts: 2,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("retro"),
      }),
      new FlowNode({
        id: "acceptance-review",
        label: "Acceptance Review",
        action: "run-acceptance-review",
        instructionsKey: "impl.acceptance-review",
        contextKinds: ["spec", "diff", "test", "issue-log", "retro", "report"],
        outputSchemaRef: "next-action/acceptance-review.schema.json",
        maxAttempts: 1,
        sideEffects: ["promoteFinalRegression"],
        failurePolicy: "amend-spec",
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("acceptance-review"),
      }),
      new FlowNode({
        id: "acceptance-decision",
        label: "Acceptance decision",
        action: "set-acceptance-decision",
        instructionsKey: "impl.acceptance-decision",
        contextKinds: ["spec", "diff", "test"],
        outputSchemaRef: "next-action/acceptance-review.schema.json",
        requiresApproval: true,
        maxAttempts: 1,
      }),
      new FlowNode({
        id: "final-regression",
        label: "Final Regression",
        action: "run-final-regression",
        instructionsKey: "impl.final-regression",
        contextKinds: ["spec", "test"],
        outputSchemaRef: "next-action/final-regression.schema.json",
        maxAttempts: 2,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("final-regression"),
      }),
      new FlowNode({
        id: "report",
        label: "Report",
        action: "run-report",
        instructionsKey: "impl.report",
        contextKinds: ["spec", "diff", "test", "issue-log", "retro"],
        outputSchemaRef: "next-action/report.schema.json",
        maxAttempts: 2,
        definitionLifecycleOwned: true,
        executionCommand: new FlowExecutionCommand("report"),
      }),
      new FlowNode({
        id: "finalize",
        label: "Finalize",
        children: [
          new FlowNode({
            id: "finalize-commit",
            label: "Commit",
            action: "run-finalize-commit",
            instructionsKey: "impl.finalize-commit",
            contextKinds: ["spec", "diff"],
            outputSchemaRef: "next-action/finalize.schema.json",
            requiresApproval: true,
            autoApproveChoiceId: "1",
            definitionLifecycleOwned: true,
            executionCommand: new FlowExecutionCommand("finalize-commit"),
          }),
          new FlowNode({
            id: "finalize-merge",
            label: "Merge",
            action: "run-finalize-merge",
            instructionsKey: "impl.finalize-merge",
            contextKinds: ["spec", "diff"],
            outputSchemaRef: "next-action/finalize.schema.json",
            definitionLifecycleOwned: true,
            executionCommand: new FlowExecutionCommand("finalize-merge"),
          }),
          new FlowNode({
            id: "finalize-sync",
            label: "Sync",
            action: "run-finalize-sync",
            instructionsKey: "impl.finalize-sync",
            contextKinds: ["spec"],
            outputSchemaRef: "next-action/finalize.schema.json",
            definitionLifecycleOwned: true,
            executionCommand: new FlowExecutionCommand("finalize-sync"),
          }),
          new FlowNode({
            id: "finalize-cleanup",
            label: "Cleanup",
            action: "run-finalize-cleanup",
            instructionsKey: "impl.finalize-cleanup",
            contextKinds: ["spec"],
            outputSchemaRef: "next-action/finalize.schema.json",
            definitionLifecycleOwned: true,
            executionCommand: new FlowExecutionCommand("finalize-cleanup"),
          }),
        ],
      }),
    ],
  }),
]);

// ── TASK_DEFINITION ─────────────────────────────────────────────────────────

const TASK_DEFINITION = Object.freeze([
  new FlowNode({
    id: "task-impl",
    label: "Task impl",
    action: "run-impl",
    instructionsKey: "task.task-impl",
    contextKinds: ["task_spec", "related_summary", "overview"],
    outputSchemaRef: "next-action/impl.schema.json",
  }),
  new FlowNode({
    id: "task-review",
    label: "Task review",
    action: "run-review",
    instructionsKey: "task.task-review",
    contextKinds: ["task_spec", "diff", "testlog"],
    outputSchemaRef: "next-action/review.schema.json",
    maxAttempts: 4,
    toolingMaxAttempts: 1,
    failurePolicy: "retry",
    definitionLifecycleOwned: true,
    executionCommand: new FlowExecutionCommand("review", "--phase", "impl"),
  }),
  new FlowNode({
    id: "task-gate",
    label: "Task gate",
    action: "run-gate",
    instructionsKey: "impl.impl-gate",
    contextKinds: ["task_spec", "guardrail"],
    outputSchemaRef: "next-action/gate.schema.json",
    maxAttempts: 5,
    sideEffects: ["mergeOverview"],
    failurePolicy: "block",
    definitionLifecycleOwned: true,
    executionCommand: new FlowExecutionCommand("gate"),
  }),
]);

// ── Gate-phase collection ───────────────────────────────────────────────────

/**
 * Collect [phase, stepId] pairs from all gate nodes across FLOW_DEFINITION
 * and TASK_DEFINITION. Order follows definition order.
 */
export function collectGatePhaseEntries() {
  const entries = [];
  function walk(nodes, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.children) {
        walk(node.children, depth + 1);
      } else if (node.gatePhase) {
        for (const phase of node.gatePhase) {
          entries.push([phase, node.id]);
        }
      }
    }
  }
  walk(FLOW_DEFINITION, 1);
  walk(TASK_DEFINITION, 1);
  return entries;
}

export function collectFlowLeafIds() {
  return collectLeafIds(FLOW_DEFINITION);
}

export function flowLeafIdsBetween(startId, endId) {
  const ids = collectFlowLeafIds();
  const start = ids.indexOf(startId);
  const end = ids.indexOf(endId);
  if (start < 0 || end < start) throw new Error(`flow definition range not found: ${startId}..${endId}`);
  return ids.slice(start, end + 1);
}

export function collectTaskLeafIds() {
  return collectLeafIds(TASK_DEFINITION);
}

export function deriveFlowPhaseMap() {
  return derivePhaseMap(FLOW_DEFINITION);
}

export function getFlowDefinitionOrder() {
  return collectFlowLeafIds();
}

export function getTaskDefinitionOrder() {
  return collectTaskLeafIds();
}

export function collectFlowNodes() {
  return [...FLOW_DEFINITION];
}

export function collectTaskNodes() {
  return [...TASK_DEFINITION];
}

export function getFlowNode(id) {
  return resolveNodeFor(FLOW_DEFINITION, id);
}

export function getTaskNode(id) {
  return resolveNodeFor(TASK_DEFINITION, id);
}

export function resolveMaxAttempts({ scope = "flow", stepId, context = {} }) {
  const node = scope === "task" ? getTaskNode(stepId) : getFlowNode(stepId);
  return node?.resolveMaxAttempts(context) ?? null;
}

export function resolveToolingMaxAttempts({ scope = "flow", stepId, context = {} }) {
  const node = scope === "task" ? getTaskNode(stepId) : getFlowNode(stepId);
  return node?.resolveToolingMaxAttempts(context) ?? null;
}

export function resolveSideEffects({ scope = "flow", stepId }) {
  const node = scope === "task" ? getTaskNode(stepId) : getFlowNode(stepId);
  return node?.sideEffects ? [...node.sideEffects] : null;
}

export function isDefinitionLifecycleOwnedStep({ scope = "flow", stepId }) {
  const node = scope === "task" ? getTaskNode(stepId) : getFlowNode(stepId);
  return node?.definitionLifecycleOwned === true;
}

export function deriveFlowPrereqs(targetId) {
  return derivePrereqs(FLOW_DEFINITION, targetId);
}

export function getFlowBranchLeafIds(parentId) {
  const parent = getFlowNode(parentId);
  if (!parent?.children) return [];
  return flattenSteps(parent.children).map((step) => step.id);
}

// ── Traversal helpers ───────────────────────────────────────────────────────

function assertDepth(depth) {
  if (depth > MAX_DEPTH) {
    throw new Error(`definition depth exceeds maximum (${MAX_DEPTH})`);
  }
}

/**
 * Collect all leaf node IDs from a definition tree in document order.
 */
export function collectLeafIds(definition) {
  const ids = [];
  function walk(nodes, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.children) {
        walk(node.children, depth + 1);
      } else {
        ids.push(node.id);
      }
    }
  }
  walk(definition, 1);
  return ids;
}

/**
 * Derive a phase map (leaf id → branch id) from a definition tree.
 */
export function derivePhaseMap(definition) {
  const map = {};
  function walk(nodes, parentId, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.children) {
        walk(node.children, node.id, depth + 1);
      } else {
        map[node.id] = parentId;
      }
    }
  }
  walk(definition, null, 1);
  return map;
}

/**
 * Look up a node by id (any depth) in the definition tree.
 */
export function resolveNodeFor(definition, id) {
  function walk(nodes, depth) {
    assertDepth(depth);
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = walk(node.children, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(definition, 1);
}

/**
 * Find the currently active (in_progress) leaf in a nested steps structure,
 * matching against the definition tree for navigation.
 *
 * Returns `{ scope: "flow"|"task", taskId, stepId }` or null.
 */
export function findActiveNode({ steps, tasks, currentTaskId }) {
  if (currentTaskId != null && Array.isArray(tasks)) {
    const task = tasks.find((t) => t.id === currentTaskId);
    if (task && Array.isArray(task.steps)) {
      const step = findLatestInProgressLeaf(task.steps, TASK_DEFINITION);
      if (step) return { scope: "task", taskId: currentTaskId, stepId: step.id };
    }
  }
  const step = findLatestInProgressLeaf(steps, FLOW_DEFINITION);
  if (step) return { scope: "flow", taskId: null, stepId: step.id };
  return null;
}

export function taskIdForResolvedStep(activeNode, targetStepId) {
  return activeNode?.stepId === targetStepId ? activeNode.taskId : null;
}

const MAX_IN_PROGRESS_STEP_SCAN = 500;
const DEFINITION_ORDER_CACHE = new WeakMap();

function scanLatestInProgressLeaf(steps, order, state, depth = 1) {
  assertDepth(depth);
  if (!Array.isArray(steps)) return state;
  for (const s of steps) {
    state.scanned += 1;
    if (state.scanned > MAX_IN_PROGRESS_STEP_SCAN) {
      throw new Error(`too many flow steps while resolving active step (max ${MAX_IN_PROGRESS_STEP_SCAN})`);
    }
    if (s.children) {
      scanLatestInProgressLeaf(s.children, order, state, depth + 1);
      continue;
    }
    if (s.status === "in_progress") {
      if (!order.has(s.id)) {
        if (!state.unknownStep) state.unknownStep = s;
        continue;
      }
      const index = order.get(s.id);
      if (!state.step || index >= state.index) {
        state.step = s;
        state.index = index;
      }
    }
  }
  return state;
}

function orderMapForDefinition(definition) {
  let order = DEFINITION_ORDER_CACHE.get(definition);
  if (!order) {
    order = new Map(collectLeafIds(definition).map((id, idx) => [id, idx]));
    DEFINITION_ORDER_CACHE.set(definition, order);
  }
  return order;
}

export function findLatestInProgressLeaf(steps, definition = FLOW_DEFINITION) {
  const order = orderMapForDefinition(definition);
  const selected = scanLatestInProgressLeaf(
    steps,
    order,
    { step: null, unknownStep: null, index: -1, scanned: 0 },
  );
  return selected.unknownStep || selected.step;
}

/**
 * Derive the next action envelope fields from the definition for a given step.
 *
 * Returns definition-owned action metadata, including the declared executionCommand,
 * for the step identified by `scope` ("flow" or "task") and `stepId`.
 */
export function deriveNextAction({ scope = "flow", stepId, context = {} }) {
  const def = scope === "task" ? TASK_DEFINITION : FLOW_DEFINITION;
  const node = resolveNodeFor(def, stepId);
  if (!node) return null;
  return {
    action: node.action,
    instructionsKey: node.instructionsKey,
    contextKinds: [...node.contextKinds],
    outputSchemaRef: node.outputSchemaRef,
    requiresApproval: node.requiresApproval,
    autoApproveChoiceId: node.autoApproveChoiceId,
    maxAttempts: node.resolveMaxAttempts(context),
    sideEffects: node.sideEffects ? [...node.sideEffects] : null,
    failurePolicy: node.failurePolicy,
    executionCommand: node.executionCommand?.toString() ?? null,
  };
}

/**
 * Build initial nested steps from the definition tree.
 * Branch nodes get `{ id, status: "pending", children: [...] }`;
 * leaf nodes get `{ id, status: "pending" }`.
 *
 * The first leaf is promoted to "in_progress".
 */
export function buildInitialNestedSteps(definition = FLOW_DEFINITION) {
  function buildNode(node) {
    if (node.children) {
      return { id: node.id, status: "pending", children: node.children.map(buildNode) };
    }
    return { id: node.id, status: "pending" };
  }
  const steps = definition.map(buildNode);
  const firstLeaf = findFirstPendingLeaf(steps);
  if (firstLeaf) firstLeaf.status = "in_progress";
  return steps;
}

/**
 * Build initial task-level steps from TASK_DEFINITION.
 */
export function buildInitialTaskSteps() {
  return TASK_DEFINITION.map((node) => ({ id: node.id, status: "pending" }));
}

/**
 * Derive prerequisite step ids for a given target step from the definition.
 * Prerequisites are all leaf steps in branches that appear before the target's
 * branch in the definition.
 */
export function derivePrereqs(definition, targetId) {
  const targetBranchIdx = findBranchIndexForLeaf(definition, targetId);
  if (targetBranchIdx < 0) return [];

  const prereqs = [];
  for (let i = 0; i < targetBranchIdx; i++) {
    const branch = definition[i];
    if (branch.children) {
      const lastLeaf = getLastLeaf(branch.children);
      if (lastLeaf) prereqs.push(lastLeaf.id);
    }
  }
  return prereqs;
}

function findBranchIndexForLeaf(definition, leafId) {
  for (let i = 0; i < definition.length; i++) {
    const branch = definition[i];
    if (branch.id === leafId) return i;
    if (branch.children && resolveNodeFor([branch], leafId)) return i;
  }
  return -1;
}

function getLastLeaf(nodes) {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.children) {
      const found = getLastLeaf(n.children);
      if (found) return found;
    } else {
      return n;
    }
  }
  return null;
}

/**
 * Check if a step is a branch containing a leaf with the given id.
 * Returns the branch node or null.
 */
export function findBranchForLeaf(definition, leafId) {
  for (const branch of definition) {
    if (branch.children && resolveNodeFor([branch], leafId)) return branch;
  }
  return null;
}

export { FlowExecutionCommand, FlowNode };
