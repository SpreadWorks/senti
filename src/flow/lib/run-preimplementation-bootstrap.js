import { Envelope } from "../../lib/flow-envelope.js";
import { FlowCommand } from "./base-command.js";
import {
  CanonicalTestArtifactStore,
  isCanonicalFlowState,
} from "./canonical-test-artifacts.js";
import { findStepById } from "./step-tree.js";

class PreimplementationBootstrapError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PreimplementationBootstrapError";
    this.code = code;
  }
}

/** Immutable evidence selected from scenario-validity's producer Attempt. */
export class PreimplementationBootstrapPlan {
  constructor({ invalidPaths } = {}) {
    if (!Array.isArray(invalidPaths) || invalidPaths.length === 0) {
      throw new Error("preimplementation bootstrap plan requires invalid paths");
    }
    this.invalidPaths = Object.freeze(invalidPaths.map((value, index) => {
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`preimplementation bootstrap invalidPaths[${index}] must be a non-empty string`);
      }
      return value;
    }));
    Object.freeze(this);
  }
}

function reject(code, message) {
  throw new PreimplementationBootstrapError(code, message);
}

function requireExactGuards(ctx, state) {
  const missing = [];
  if (ctx.expectRunId == null) missing.push("--expect-run-id");
  if (ctx.expectSpec == null) missing.push("--expect-spec");
  if (state.issue == null) {
    if (ctx.expectNoIssue !== true) missing.push("--expect-no-issue");
  } else if (ctx.expectIssue == null) {
    missing.push("--expect-issue");
  }
  if (missing.length > 0) {
    return Envelope.fail(
      "run",
      "preimplementation-bootstrap",
      "PREIMPLEMENTATION_BOOTSTRAP_GUARDS_REQUIRED",
      `preimplementation bootstrap requires ${missing.join(", ")}`,
    );
  }
  return null;
}

function preflightPlan({ flowManager, state }) {
  if (!isCanonicalFlowState(state)) {
    reject("PREIMPLEMENTATION_BOOTSTRAP_LIFECYCLE_INVALID", "preimplementation bootstrap requires a Version-1 Flow");
  }
  const artifact = new CanonicalTestArtifactStore({ flowManager, state }).readCurrentAttempt({
    logicalKey: "scenario.validity",
    consumerNodeId: "implement",
    optional: true,
  });
  const invalidPaths = artifact?.payload?.preflight?.invalid_paths;
  if (artifact?.payload?.result !== "block" || !Array.isArray(invalidPaths) || invalidPaths.length === 0) {
    reject(
      "PREIMPLEMENTATION_BOOTSTRAP_EVIDENCE_INVALID",
      "preimplementation bootstrap requires a scenario-validity preflight block with implementation-target changes",
    );
  }
  return new PreimplementationBootstrapPlan({ invalidPaths });
}

function assertBootstrapRoute(state) {
  if (state.currentNodeId !== "scenario-validity") {
    reject(
      "PREIMPLEMENTATION_BOOTSTRAP_LIFECYCLE_INVALID",
      "preimplementation bootstrap is available only while scenario-validity is active",
    );
  }
  for (const [stepId, expectedStatus] of [
    ["scenario-validity", "in_progress"],
    ["test-review", "pending"],
    ["implement", "pending"],
  ]) {
    const step = findStepById(state.steps, stepId);
    if (step?.status !== expectedStatus) {
      reject(
        "PREIMPLEMENTATION_BOOTSTRAP_LIFECYCLE_INVALID",
        `preimplementation bootstrap requires ${stepId}=${expectedStatus}`,
      );
    }
  }
}

function buildPreimplementationBootstrapPlan({ flowManager, state }) {
  const plan = preflightPlan({ flowManager, state });
  assertBootstrapRoute(state);
  return plan;
}

export function inspectPreimplementationBootstrap({ flowManager, state }) {
  try {
    return buildPreimplementationBootstrapPlan({ flowManager, state });
  } catch (error) {
    if (error instanceof PreimplementationBootstrapError) return null;
    throw error;
  }
}

export default class RunPreimplementationBootstrapCommand extends FlowCommand {
  execute(ctx) {
    const state = ctx.flowState;
    const guardFailure = requireExactGuards(ctx, state);
    if (guardFailure) return guardFailure;
    try {
      const plan = buildPreimplementationBootstrapPlan({ flowManager: ctx.flowManager, state });
      ctx.flowManager.preimplementationBootstrap({ specId: state.specId });
      return Envelope.ok("run", "preimplementation-bootstrap", {
        recovered: true,
        skipped: ["scenario-validity", "test-review"],
        activeStep: "implement",
        preflightInvalidPaths: plan.invalidPaths,
      });
    } catch (error) {
      if (error instanceof PreimplementationBootstrapError) {
        return Envelope.fail("run", "preimplementation-bootstrap", error.code, error.message);
      }
      if (error?.code === "FLOW_STATE_ATOMIC_STALE") {
        return Envelope.fail(
          "run",
          "preimplementation-bootstrap",
          "PREIMPLEMENTATION_BOOTSTRAP_AUTHORITY_CHANGED",
          "flow revision changed before preimplementation bootstrap mutation",
        );
      }
      return Envelope.fail(
        "run",
        "preimplementation-bootstrap",
        "PREIMPLEMENTATION_BOOTSTRAP_REJECTED",
        `preimplementation bootstrap rejected: ${error.message}`,
      );
    }
  }
}
