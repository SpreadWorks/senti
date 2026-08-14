import { Envelope } from "../../lib/flow-envelope.js";
import { missingExactTargetGuardNames } from "../../lib/flow-target-guard.js";
import { FlowCommand } from "./base-command.js";
import {
  CanonicalTestArtifactStore,
  isCanonicalFlowState,
} from "./canonical-test-artifacts.js";
import { findStepById } from "./step-tree.js";

class ExistingImplementationRecoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ExistingImplementationRecoveryError";
    this.code = code;
  }
}

/** Immutable scenario-validity fact accepted by the fixed recovery route. */
export class ExistingImplementationRecoveryPlan {
  constructor({ invalidPaths } = {}) {
    if (!Array.isArray(invalidPaths) || invalidPaths.length === 0) {
      throw new Error("existing implementation recovery requires invalid paths");
    }
    this.invalidPaths = Object.freeze(invalidPaths.map((value, index) => {
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`existing implementation invalidPaths[${index}] must be a non-empty string`);
      }
      return value;
    }));
    Object.freeze(this);
  }
}

function reject(code, message) {
  throw new ExistingImplementationRecoveryError(code, message);
}

function requireExactGuards(ctx, state) {
  const missing = missingExactTargetGuardNames(ctx, state);
  if (missing.length > 0) {
    return Envelope.fail(
      "run",
      "recover-existing-implementation",
      "EXISTING_IMPLEMENTATION_RECOVERY_GUARDS_REQUIRED",
      `existing implementation recovery requires ${missing.join(", ")}`,
    );
  }
  return null;
}

function readScenarioValidityPlan({ flowManager, state }) {
  if (!isCanonicalFlowState(state)) {
    reject("EXISTING_IMPLEMENTATION_RECOVERY_LIFECYCLE_INVALID", "existing implementation recovery requires a Version-1 Flow");
  }
  const artifact = new CanonicalTestArtifactStore({ flowManager, state }).readCurrentAttempt({
    logicalKey: "scenario.validity",
    consumerNodeId: "implement",
    optional: true,
  });
  const invalidPaths = artifact?.payload?.preflight?.invalid_paths;
  if (artifact?.payload?.result !== "block" || !Array.isArray(invalidPaths) || invalidPaths.length === 0) {
    reject(
      "EXISTING_IMPLEMENTATION_RECOVERY_EVIDENCE_INVALID",
      "scenario-validity evidence must be a preflight block with implementation-target changes",
    );
  }
  return new ExistingImplementationRecoveryPlan({ invalidPaths });
}

function assertRecoveryRoute(state) {
  if (state.currentNodeId !== "scenario-validity") {
    reject(
      "EXISTING_IMPLEMENTATION_RECOVERY_LIFECYCLE_INVALID",
      "existing implementation recovery is available only while scenario-validity is active",
    );
  }
  for (const [stepId, expectedStatus] of [
    ["scenario-validity", "in_progress"],
    ["test-review", "pending"],
    ["implement", "pending"],
    ["test-execute", "pending"],
  ]) {
    const step = findStepById(state.steps, stepId);
    if (step?.status !== expectedStatus) {
      reject(
        "EXISTING_IMPLEMENTATION_RECOVERY_LIFECYCLE_INVALID",
        `existing implementation recovery requires ${stepId}=${expectedStatus}`,
      );
    }
  }
}

export default class RunRecoverExistingImplementationCommand extends FlowCommand {
  execute(ctx) {
    const state = ctx.flowState;
    const guardFailure = requireExactGuards(ctx, state);
    if (guardFailure) return guardFailure;
    try {
      const plan = readScenarioValidityPlan({ flowManager: ctx.flowManager, state });
      assertRecoveryRoute(state);
      ctx.flowManager.recoverExistingImplementation({ specId: state.specId });
      return Envelope.ok("run", "recover-existing-implementation", {
        recovered: true,
        skipped: ["scenario-validity", "test-review"],
        completed: "implement",
        activeStep: "test-execute",
        preflightInvalidPaths: plan.invalidPaths,
      });
    } catch (error) {
      if (error instanceof ExistingImplementationRecoveryError) {
        return Envelope.fail("run", "recover-existing-implementation", error.code, error.message);
      }
      if (error?.code === "FLOW_STATE_ATOMIC_STALE") {
        return Envelope.fail(
          "run",
          "recover-existing-implementation",
          "EXISTING_IMPLEMENTATION_RECOVERY_AUTHORITY_CHANGED",
          "flow revision changed before existing implementation recovery mutation",
        );
      }
      return Envelope.fail(
        "run",
        "recover-existing-implementation",
        "EXISTING_IMPLEMENTATION_RECOVERY_REJECTED",
        `existing implementation recovery rejected: ${error.message}`,
      );
    }
  }
}
