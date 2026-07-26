import fs from "node:fs";
import path from "node:path";

import { Envelope } from "../../lib/flow-envelope.js";
import { findActiveNode, flowLeafIdsBetween } from "../definition.js";
import { findStepById } from "./step-tree.js";
import { completeTestEvidenceRefresh } from "./impl-repair-artifacts.js";
import { latestPlanRewind } from "./plan-rewind.js";
import { FlowCommand } from "./base-command.js";
import { ExplicitRecoveryTransition } from "./step-transition-policy.js";

const SCENARIO_VALIDITY_RESULT_FILE = "scenario-validity-result.json";
const RECOVERY_ENTRYPOINT = "existing-implementation-revalidation";
const RECOVERY_REASON = "Existing implementation revalidation recorded after an acceptance-review plan rewind blocked pre-implementation scenario validity.";

class ExistingImplementationRecoveryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ExistingImplementationRecoveryError";
    this.code = code;
  }
}

function reject(code, message) {
  throw new ExistingImplementationRecoveryError(code, message);
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
      "recover-existing-implementation",
      "EXISTING_IMPLEMENTATION_RECOVERY_GUARDS_REQUIRED",
      `existing implementation recovery requires ${missing.join(", ")}`,
    );
  }
  return null;
}

function readScenarioValidityResult(specDir) {
  const file = path.join(specDir, SCENARIO_VALIDITY_RESULT_FILE);
  let artifact;
  try {
    artifact = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    reject(
      "EXISTING_IMPLEMENTATION_RECOVERY_EVIDENCE_INVALID",
      `scenario-validity evidence is unavailable: ${error.message}`,
    );
  }
  const invalidPaths = artifact?.preflight?.invalid_paths;
  if (artifact?.result !== "block" || !Array.isArray(invalidPaths) || invalidPaths.length === 0) {
    reject(
      "EXISTING_IMPLEMENTATION_RECOVERY_EVIDENCE_INVALID",
      "scenario-validity evidence must be a preflight block with implementation-target changes",
    );
  }
  return invalidPaths;
}

function recoveryTransition(state) {
  const expected = [
    ["scenario-validity", "in_progress", "skipped"],
    ["test-review", "pending", "skipped"],
    ["implement", "pending", "done"],
    ["test-execute", "pending", "in_progress"],
  ];
  const changes = expected.map(([stepId, currentStatus, requestedStatus]) => {
    const step = findStepById(state.steps || [], stepId);
    if (!step || step.status !== currentStatus) {
      reject(
        "EXISTING_IMPLEMENTATION_RECOVERY_LIFECYCLE_INVALID",
        `existing implementation recovery requires ${stepId}=${currentStatus}`,
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

function assertEligibility(state) {
  const active = findActiveNode(state);
  const pendingRecovery = state.implRepairTransaction?.sourceStep === RECOVERY_ENTRYPOINT;
  if (pendingRecovery) {
    if (active?.scope !== "flow" || active.stepId !== "test-execute") {
      reject(
        "EXISTING_IMPLEMENTATION_RECOVERY_LIFECYCLE_INVALID",
        "pending existing implementation recovery must remain at test-execute",
      );
    }
    return { pendingRecovery: true };
  }
  if (active?.scope !== "flow" || active.stepId !== "scenario-validity") {
    reject(
      "EXISTING_IMPLEMENTATION_RECOVERY_LIFECYCLE_INVALID",
      "existing implementation recovery is available only while scenario-validity is active",
    );
  }
  if (state.implRepairTransaction != null) {
    reject(
      "EXISTING_IMPLEMENTATION_RECOVERY_LIFECYCLE_INVALID",
      "existing implementation recovery cannot overlap an impl-repair transaction",
    );
  }
  const rewind = latestPlanRewind(state);
  if (rewind?.sourceStage !== "acceptance-review" || rewind.destinationStep !== "draft") {
    reject(
      "EXISTING_IMPLEMENTATION_RECOVERY_AUDIT_REQUIRED",
      "existing implementation recovery requires the latest plan rewind to originate at acceptance-review",
    );
  }
  return { pendingRecovery: false };
}

export default class RunRecoverExistingImplementationCommand extends FlowCommand {
  execute(ctx) {
    const state = ctx.flowState;
    const guardFailure = requireExactGuards(ctx, state);
    if (guardFailure) return guardFailure;
    try {
      const eligibility = assertEligibility(state);
      const specDir = path.dirname(path.resolve(ctx.root, state.spec));
      const invalidPaths = readScenarioValidityResult(specDir);
      const result = completeTestEvidenceRefresh({
        root: ctx.root,
        state,
        specDir,
        flowManager: ctx.flowManager,
        reason: RECOVERY_REASON,
        sourceStep: RECOVERY_ENTRYPOINT,
        resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
        ...(eligibility.pendingRecovery ? {} : { transition: recoveryTransition(state) }),
      });
      const refreshed = ctx.specId
        ? ctx.flowManager.loadReadOnly(ctx.specId)
        : ctx.flowManager.loadReadOnly();
      const active = findActiveNode(refreshed);
      if (active?.scope !== "flow" || active.stepId !== "test-execute") {
        reject(
          "EXISTING_IMPLEMENTATION_RECOVERY_LIFECYCLE_INVALID",
          "existing implementation recovery did not promote test-execute",
        );
      }
      return Envelope.ok("run", "recover-existing-implementation", {
        recovered: true,
        skipped: ["scenario-validity", "test-review"],
        completed: "implement",
        activeStep: active.stepId,
        previousRepairFingerprint: result.previousFingerprint,
        currentRepairFingerprint: result.currentFingerprint,
        invalidatedArtifacts: result.invalidatedArtifacts,
        preflightInvalidPaths: invalidPaths,
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
