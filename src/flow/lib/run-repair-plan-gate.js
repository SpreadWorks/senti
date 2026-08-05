import { Envelope } from "../../lib/flow-envelope.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";
import { FlowCommand } from "./base-command.js";
import { loadIssueLog } from "./set-issue-log.js";
import {
  PlanGateRepairRecord,
  planGateRepairRouteForPhase,
} from "./plan-gate-repair.js";
import {
  ExplicitRecoveryTransition,
  PLAN_GATE_REPAIR_ENTRYPOINT,
  StepTransitionCommitIntent,
} from "./step-transition-policy.js";
import { findActiveNode } from "../definition.js";
import { findStepById } from "./step-tree.js";

function phaseForActiveGate(stepId) {
  if (stepId === "draft-gate") return "draft";
  if (stepId === "spec-gate") return "spec";
  if (stepId === "scenario-validity") return "test";
  return null;
}

function latestRepairableGateEntry(root, state, phase) {
  const entries = loadIssueLog(root, relativeFlowSpecFile(state)).entries;
  return [...entries].reverse().find((entry) => (
    entry?.phase === phase
    && typeof entry?.issueLogId === "string"
    && Array.isArray(entry?.observations)
    && entry.observations.some((observation) => observation?.severity === "blocking")
  )) || null;
}

export function inspectScenarioValidityTestRepair({ root, state }) {
  if (findActiveNode(state)?.stepId !== "scenario-validity") return null;
  const source = latestRepairableGateEntry(root, state, "test");
  if (source?.sourceArtifact !== "scenario-validity-result.json") return null;
  const currentRevision = state.specTestArtifactRevision?.digest || null;
  return (source.testRevisionDigest || null) === currentRevision ? source : null;
}

class PlanGateRepairCommitIntent extends StepTransitionCommitIntent {
  constructor({ root, record }) {
    super();
    this.root = root;
    this.record = PlanGateRepairRecord.from(record);
    Object.freeze(this);
  }

  assertBeforeTransition(state) {
    this.record.assertFlow(state);
    const active = findActiveNode(state);
    if (active?.stepId !== this.record.route.gateStepId) {
      throw new Error("plan gate repair source gate changed before transition");
    }
    const source = latestRepairableGateEntry(this.root, state, this.record.phase);
    if (!this.record.matchesIssueLogEntry(source)) {
      throw new Error("plan gate repair source evidence changed before transition");
    }
  }

  applyTo(state) {
    this.record.assertFlow(state);
    state.planGateRepair = this.record.toJSON();
    if (this.record.phase !== "test") {
      state.metrics = Array.isArray(state.metrics) ? state.metrics : [];
      state.metrics.push({
        phase: this.record.phase,
        counter: "gateRetry",
        delta: 0,
        reset: true,
        ts: this.record.requestedAt,
      });
      state.metrics.push({
        phase: this.record.phase === "draft" ? "draft-coverage" : "spec",
        counter: "reviewRetry",
        delta: 0,
        reset: true,
        ts: this.record.requestedAt,
      });
    } else {
      delete state.specTestArtifactRevision;
    }
    if (this.record.phase === "draft" && state.draftReviewRevisions?.["draft-coverage"]) {
      delete state.draftReviewRevisions["draft-coverage"];
    }
    for (const stepId of this.record.route.resetStepIds) {
      const step = findStepById(state.steps || [], stepId);
      delete step.runtimeLog;
      delete step.startedAt;
      delete step.finishedAt;
      if (stepId === this.record.targetStepId) step.startedAt = this.record.requestedAt;
    }
  }
}

function repairTransition(state, record) {
  const route = record.route;
  const target = findStepById(state.steps || [], route.targetStepId);
  const changes = route.resetStepIds.map((stepId) => {
    const step = findStepById(state.steps || [], stepId);
    if (!step) throw new Error(`plan gate repair step is missing: ${stepId}`);
    return {
      stepId,
      currentStatus: step.status,
      requestedStatus: route.requestedStatus(stepId),
    };
  });
  return new ExplicitRecoveryTransition({
    stepId: route.targetStepId,
    currentStatus: target?.status,
    requestedStatus: "in_progress",
    entrypoint: PLAN_GATE_REPAIR_ENTRYPOINT,
    changes,
    clearRuntimeLog: true,
  });
}

export default class RunRepairPlanGateCommand extends FlowCommand {
  constructor() {
    super({ explicitTargetResolution: true });
  }

  execute(ctx) {
    const state = ctx.flowState;
    const active = findActiveNode(state);
    const phase = phaseForActiveGate(active?.stepId);
    if (!phase) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        "PLAN_GATE_REPAIR_STAGE_UNSUPPORTED",
        "plan gate repair requires draft-gate, spec-gate, or scenario-validity to be in progress",
      );
    }
    const route = planGateRepairRouteForPhase(phase);
    const source = phase === "test"
      ? inspectScenarioValidityTestRepair({ root: ctx.root, state })
      : latestRepairableGateEntry(ctx.root, state, phase);
    if (!source) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        "PLAN_GATE_REPAIR_EVIDENCE_MISSING",
        `no blocking ${phase} gate evidence is available for guarded repair`,
      );
    }
    let record;
    let transition;
    try {
      record = PlanGateRepairRecord.create({ state, phase, issueLogEntry: source });
      transition = repairTransition(state, record);
    } catch (error) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        error.code || "PLAN_GATE_REPAIR_INVALID",
        error.message,
      );
    }

    const operation = new RepositoryFlowOperationLock({ mainRoot: ctx.mainRoot || ctx.root });
    const operationOwnerToken = operation.acquire();
    try {
      ctx.flowManager.updateStepStatus(
        transition,
        {
          specId: state.specId,
          expectedOriginal: state,
          operationOwnerToken,
        },
        new PlanGateRepairCommitIntent({ root: ctx.root, record }),
      );
    } finally {
      operation.release();
    }
    return Envelope.ok("run", "repair-plan-gate", {
      repairedPhase: phase,
      previousStep: route.gateStepId,
      nextStep: route.targetStepId,
      sourceIssueLogId: record.sourceIssueLogId,
      resetSteps: [...route.resetStepIds],
    });
  }
}
