import { Envelope } from "../../lib/flow-envelope.js";
import { FlowCommand } from "./base-command.js";
import { PlanGateRepairRecord } from "./plan-gate-repair.js";
import { findActiveNode } from "../definition.js";
import { CanonicalGateInputStore } from "./canonical-gate-artifacts.js";
import { CanonicalTestSourceRevision } from "./canonical-test-artifacts.js";

function phaseForActiveGate(stepId) {
  if (stepId === "draft-gate") return "draft";
  if (stepId === "spec-gate") return "spec";
  if (stepId === "scenario-validity") return "test";
  return null;
}

function latestCanonicalRepairableGateEntry(issueLog, phase) {
  const entries = issueLog?.entries;
  if (!Array.isArray(entries)) throw new Error("canonical gate issue-log must contain entries");
  return [...entries].reverse().find((entry) => (
    entry?.phase === phase
    && typeof entry?.issueLogId === "string"
    && Array.isArray(entry?.observations)
    && entry.observations.some((observation) => observation?.severity === "blocking")
  )) || null;
}

function canonicalGateIssueLog(ctx, state, nodeId) {
  return new CanonicalGateInputStore({
    flowManager: ctx.flowManager,
    state,
    nodeId,
  }).issueLog();
}

function canonicalScenarioValidityTestRepair(ctx, state, source) {
  if (source?.sourceArtifact !== "scenario.validity") return null;
  const revision = CanonicalTestSourceRevision.fromCatalog({
    state,
    catalog: ctx.flowManager.artifactCatalog(state.specId),
    activities: ctx.flowManager.activityLedger(state.specId),
  });
  return source.testRevisionDigest === revision.digest ? source : null;
}

export function inspectScenarioValidityTestRepair({ flowManager, state }) {
  if (findActiveNode(state)?.stepId !== "scenario-validity") return null;
  try {
    const inputs = new CanonicalGateInputStore({
      flowManager,
      state,
      nodeId: "scenario-validity",
    });
    const source = latestCanonicalRepairableGateEntry(inputs.issueLog(), "test");
    return canonicalScenarioValidityTestRepair({ flowManager }, state, source);
  } catch {
    return null;
  }
}

export default class RunRepairPlanGateCommand extends FlowCommand {
  constructor() {
    super({ explicitTargetResolution: true });
  }

  execute(ctx) {
    const state = ctx.flowState;
    if (state?.schemaRevision !== 3) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        "CANONICAL_FLOW_REQUIRED",
        "plan gate repair requires a Version-1 Flow",
      );
    }
    return this.#executeCanonical(ctx, state);
  }

  #executeCanonical(ctx, state) {
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
    let issueLog;
    let source;
    try {
      issueLog = canonicalGateIssueLog(ctx, state, active.stepId);
      source = latestCanonicalRepairableGateEntry(issueLog, phase);
      if (phase === "test") source = canonicalScenarioValidityTestRepair(ctx, state, source);
    } catch (error) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        "PLAN_GATE_REPAIR_EVIDENCE_MISSING",
        `canonical ${phase} gate evidence is unavailable: ${error.message}`,
      );
    }
    if (!source) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        "PLAN_GATE_REPAIR_EVIDENCE_MISSING",
        `no blocking ${phase} gate evidence is available for guarded repair`,
      );
    }
    let record;
    try {
      record = PlanGateRepairRecord.create({ state, phase, issueLogEntry: source });
      ctx.flowManager.repairPlanGate({
        specId: state.specId,
        record,
        issueLog,
      });
    } catch (error) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        error.code || "PLAN_GATE_REPAIR_INVALID",
        error.message,
      );
    }
    return Envelope.ok("run", "repair-plan-gate", {
      repairedPhase: phase,
      previousStep: record.route.gateStepId,
      nextStep: record.targetStepId,
      sourceIssueLogId: record.sourceIssueLogId,
      resetSteps: [...record.route.resetStepIds],
    });
  }
}
