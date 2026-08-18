import { Envelope } from "../../lib/flow-envelope.js";
import { FlowCommand } from "./base-command.js";
import {
  inspectCanonicalPlanGateRepair,
  planGateRepairRouteForGateStep,
} from "./plan-gate-repair.js";

export default class RunRepairPlanGateCommand extends FlowCommand {
  constructor() {
    super({ explicitTargetResolution: true });
  }

  execute(ctx) {
    const projectedState = ctx.flowState;
    if (projectedState?.schemaRevision !== 3 || typeof ctx.flowManager?.canonicalState !== "function") {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        "CANONICAL_FLOW_REQUIRED",
        "plan gate repair requires a Version-1 Flow",
      );
    }
    const state = ctx.flowManager.canonicalState(ctx.specId ?? projectedState.specId);
    if (state === null) {
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
    const activeStepId = state.current === null ? null : state.current.at(-1);
    const route = planGateRepairRouteForGateStep(activeStepId);
    if (!route) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        "PLAN_GATE_REPAIR_STAGE_UNSUPPORTED",
        "plan gate repair requires draft-gate, spec-gate, or scenario-validity to be in progress",
      );
    }
    const { phase } = route;
    let evidence;
    try {
      evidence = inspectCanonicalPlanGateRepair({ flowManager: ctx.flowManager, state });
    } catch (error) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        "PLAN_GATE_REPAIR_EVIDENCE_MISSING",
        `canonical ${phase} gate evidence is unavailable: ${error.message}`,
      );
    }
    if (evidence === null) {
      return Envelope.fail(
        "run",
        "repair-plan-gate",
        "PLAN_GATE_REPAIR_EVIDENCE_MISSING",
        `no blocking ${phase} gate evidence is available for guarded repair`,
      );
    }
    let record;
    try {
      record = evidence.createRecord(state);
      ctx.flowManager.repairPlanGate({
        specId: state.specId,
        record,
        issueLog: evidence.issueLog,
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
