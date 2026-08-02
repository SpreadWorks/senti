import fs from "node:fs";
import path from "node:path";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";

import { Envelope } from "../../lib/flow-envelope.js";
import { findActiveNode } from "../definition.js";
import { findStepById } from "./step-tree.js";
import { FlowCommand } from "./base-command.js";
import { ExplicitRecoveryTransition } from "./step-transition-policy.js";

const SCENARIO_VALIDITY_RESULT_FILE = "scenario-validity-result.json";
const RECOVERY_ENTRYPOINT = "preimplementation-bootstrap";

class PreimplementationBootstrapError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PreimplementationBootstrapError";
    this.code = code;
  }
}

export class PreimplementationBootstrapPlan {
  constructor({ invalidPaths, transition }) {
    if (!Array.isArray(invalidPaths) || invalidPaths.length === 0) {
      throw new Error("preimplementation bootstrap plan requires invalid paths");
    }
    if (!(transition instanceof ExplicitRecoveryTransition)) {
      throw new Error("preimplementation bootstrap plan requires an explicit recovery transition");
    }
    this.invalidPaths = Object.freeze([...invalidPaths]);
    this.transition = transition;
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

function readPreflightInvalidPaths(specDir) {
  const file = path.join(specDir, SCENARIO_VALIDITY_RESULT_FILE);
  let artifact;
  try {
    artifact = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    reject(
      "PREIMPLEMENTATION_BOOTSTRAP_EVIDENCE_INVALID",
      `scenario-validity evidence is unavailable: ${error.message}`,
    );
  }
  const invalidPaths = artifact?.preflight?.invalid_paths;
  if (artifact?.result !== "block" || !Array.isArray(invalidPaths) || invalidPaths.length === 0) {
    reject(
      "PREIMPLEMENTATION_BOOTSTRAP_EVIDENCE_INVALID",
      "preimplementation bootstrap requires a scenario-validity preflight block with implementation-target changes",
    );
  }
  return invalidPaths;
}

function buildRecoveryTransition(state) {
  const active = findActiveNode(state);
  if (active?.scope !== "flow" || active.stepId !== "scenario-validity") {
    reject(
      "PREIMPLEMENTATION_BOOTSTRAP_LIFECYCLE_INVALID",
      "preimplementation bootstrap is available only while scenario-validity is active",
    );
  }
  if (!state.repairBaseline?.ref) {
    reject(
      "PREIMPLEMENTATION_BOOTSTRAP_BASELINE_REQUIRED",
      "preimplementation bootstrap requires the flow's immutable repair baseline",
    );
  }
  const expected = [
    ["scenario-validity", "in_progress", "skipped"],
    ["test-review", "pending", "skipped"],
    ["implement", "pending", "in_progress"],
  ];
  const changes = expected.map(([stepId, currentStatus, requestedStatus]) => {
    const step = findStepById(state.steps || [], stepId);
    if (!step || step.status !== currentStatus) {
      reject(
        "PREIMPLEMENTATION_BOOTSTRAP_LIFECYCLE_INVALID",
        `preimplementation bootstrap requires ${stepId}=${currentStatus}`,
      );
    }
    return { stepId, currentStatus, requestedStatus };
  });
  return new ExplicitRecoveryTransition({
    stepId: "scenario-validity",
    currentStatus: "in_progress",
    requestedStatus: "skipped",
    entrypoint: RECOVERY_ENTRYPOINT,
    changes,
    clearRuntimeLog: true,
  });
}

function buildPreimplementationBootstrapPlan({ root, state }) {
  const specDir = path.dirname(path.resolve(root, relativeFlowSpecFile(state)));
  return new PreimplementationBootstrapPlan({
    invalidPaths: readPreflightInvalidPaths(specDir),
    transition: buildRecoveryTransition(state),
  });
}

export function inspectPreimplementationBootstrap({ root, state }) {
  try {
    return buildPreimplementationBootstrapPlan({ root, state });
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
      const plan = buildPreimplementationBootstrapPlan({ root: ctx.root, state });
      ctx.flowManager.updateStepStatus(plan.transition, {
        taskId: null,
        expectedOriginal: state,
      });
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
