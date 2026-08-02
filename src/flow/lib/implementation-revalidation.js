import path from "node:path";

import { flowLeafIdsBetween } from "../definition.js";
import {
  completeTestEvidenceRefresh,
  readImplRepairLedger,
} from "./impl-repair-artifacts.js";
import { RecoveryTarget } from "./recovery-contract.js";
import { findStepById } from "./step-tree.js";
import { flowStateSpecLocation } from "../../lib/flow-workspace.js";

const DIGEST = /^[a-f0-9]{64}$/;
const IDENTIFIER = /^[a-z][a-z0-9-]{0,127}$/;
const RESTART_STEP_ID = "test-execute";
const LAST_INVALIDATED_STEP_ID = "finalize-cleanup";

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function requireDigest(value, field) {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new Error(`${field} must be a 64-character SHA-256 digest`);
  }
  return value;
}

function requireSourceStep(value) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new Error("implementation revalidation sourceStep is invalid");
  }
  return value;
}

function issueOf(state) {
  return state.issue == null ? null : Number(state.issue);
}

function assertTargetMatchesState(target, state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw new Error("implementation revalidation requires an active Flow state");
  }
  if (
    state.runId !== target.runId
    || issueOf(state) !== target.issue
    || state.specId !== target.specId
  ) {
    throw new Error("implementation revalidation target authority changed");
  }
  return state;
}

/**
 * Describes a revalidation entirely in terms of the current Flow definition.
 * The reset range intentionally comes from the normal dependency ordering,
 * never from a recovery-specific step list.
 */
export class ImplementationRevalidationPlan {
  constructor({
    target,
    flowState,
    previousFingerprint,
    currentFingerprint,
    reason,
    sourceStep = null,
    additionalArtifacts = [],
  }) {
    this.target = target instanceof RecoveryTarget ? target : new RecoveryTarget(target);
    assertTargetMatchesState(this.target, flowState);
    const normalPostImplementationSteps = flowLeafIdsBetween(RESTART_STEP_ID, LAST_INVALIDATED_STEP_ID);
    if (!normalPostImplementationSteps.includes(this.target.stepId)) {
      throw new Error("implementation revalidation target is outside the normal post-implementation dependency range");
    }
    // A source change first invalidates the normal test producer, then every
    // dependency from the recorded failed target through the normal terminal
    // cleanup step. Joining the two definition-derived paths is deliberately
    // equivalent to the normal post-implementation range, while retaining
    // the target-specific dependency calculation as Flow evolves.
    this.revalidationPathStepIds = Object.freeze(flowLeafIdsBetween(
      RESTART_STEP_ID,
      this.target.stepId,
    ));
    this.downstreamDependencyStepIds = Object.freeze(flowLeafIdsBetween(
      this.target.stepId,
      LAST_INVALIDATED_STEP_ID,
    ));
    this.resetStepIds = Object.freeze([
      ...this.revalidationPathStepIds,
      ...this.downstreamDependencyStepIds.slice(1),
    ]);
    const targetStep = findStepById(flowState.steps || [], this.target.stepId);
    if (!targetStep || targetStep.status !== "in_progress") {
      throw new Error("implementation revalidation requires its recovery target step to be in progress");
    }
    this.targetStatus = targetStep.status;
    this.restartStepId = RESTART_STEP_ID;
    this.previousFingerprint = requireDigest(previousFingerprint, "implementation revalidation previousFingerprint");
    this.currentFingerprint = requireDigest(currentFingerprint, "implementation revalidation currentFingerprint");
    if (this.previousFingerprint === this.currentFingerprint) {
      throw new Error("implementation revalidation requires changed repair fingerprints");
    }
    this.reason = requireString(reason, "implementation revalidation reason");
    this.sourceStep = requireSourceStep(sourceStep || this.target.stepId);
    if (!Array.isArray(additionalArtifacts) || additionalArtifacts.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
      throw new Error("implementation revalidation additionalArtifacts must be an array of non-empty paths");
    }
    this.additionalArtifacts = Object.freeze([...additionalArtifacts]);
    Object.freeze(this);
  }

  assertActiveState(state) {
    assertTargetMatchesState(this.target, state);
    const targetStep = findStepById(state.steps || [], this.target.stepId);
    if (!targetStep || targetStep.status !== this.targetStatus) {
      throw new Error("implementation revalidation target step changed");
    }
    return state;
  }
}

/** The durable, normal-Flow result of an implementation revalidation. */
export class ImplementationRevalidationResult {
  constructor({ plan, completed, repairEntry }) {
    if (!(plan instanceof ImplementationRevalidationPlan)) {
      throw new Error("implementation revalidation result requires a plan");
    }
    if (!completed || typeof completed !== "object") {
      throw new Error("implementation revalidation result requires completed refresh evidence");
    }
    if (!repairEntry || typeof repairEntry !== "object") {
      throw new Error("implementation revalidation result requires a durable repair entry");
    }
    if (
      completed.currentFingerprint !== plan.currentFingerprint
      || repairEntry.currentHash !== plan.currentFingerprint
      || completed.previousFingerprint !== repairEntry.previousHash
    ) {
      throw new Error("implementation revalidation repair entry fingerprint authority changed");
    }
    this.revalidated = true;
    this.target = plan.target;
    this.restartStepId = plan.restartStepId;
    // impl-repair is the durable transaction owner for this reset. It is
    // completed by that transaction rather than invalidated as downstream
    // evidence, so the reported invalidation set reflects the actual
    // lifecycle changes while the plan retains the full normal range.
    this.invalidatedStepIds = Object.freeze(plan.resetStepIds.filter((stepId) => stepId !== "impl-repair"));
    // The expected prior fingerprint is the authority checked before the
    // transaction. A pre-existing ledger can have an older lineage endpoint,
    // which is retained separately rather than rewritten or rejected.
    this.previousFingerprint = plan.previousFingerprint;
    this.currentFingerprint = plan.currentFingerprint;
    this.ledgerPreviousFingerprint = completed.previousFingerprint;
    this.invalidatedArtifacts = Object.freeze([...completed.invalidatedArtifacts]);
    this.repairEntryId = repairEntry.id;
    this.changedPathCount = repairEntry.changedPathCount;
    this.changedPathsRef = repairEntry.changedPathsRef;
    Object.freeze(this);
  }

  toJSON() {
    return {
      revalidated: this.revalidated,
      target: this.target.toJSON(),
      restartStepId: this.restartStepId,
      invalidatedStepIds: [...this.invalidatedStepIds],
      previousFingerprint: this.previousFingerprint,
      currentFingerprint: this.currentFingerprint,
      ledgerPreviousFingerprint: this.ledgerPreviousFingerprint,
      invalidatedArtifacts: [...this.invalidatedArtifacts],
      repairEntryId: this.repairEntryId,
      changedPathCount: this.changedPathCount,
      changedPathsRef: this.changedPathsRef,
    };
  }
}

/**
 * Executes the existing normal Flow repair transaction. That transaction
 * atomically journals its transition intent, retains the repair delta and
 * prior ledger entries, then invalidates stale artifacts before normal
 * test-execute resumes.
 */
export class ImplementationRevalidation {
  constructor(plan) {
    if (!(plan instanceof ImplementationRevalidationPlan)) {
      throw new Error("implementation revalidation requires a plan");
    }
    this.plan = plan;
    Object.freeze(this);
  }

  execute({ root, state, specDir = null, flowManager, faultInjector = null }) {
    const executionRoot = path.resolve(requireString(root, "implementation revalidation root"));
    this.plan.assertActiveState(state);
    if (!flowManager || typeof flowManager.updateStepStatus !== "function") {
      throw new Error("implementation revalidation requires the normal Flow lifecycle authority");
    }
    const expectedSpecDir = flowStateSpecLocation(state)?.directory;
    if (!expectedSpecDir) throw new Error("implementation revalidation spec location is unavailable");
    const resolvedSpecDir = path.resolve(specDir || expectedSpecDir);
    if (resolvedSpecDir !== expectedSpecDir) {
      throw new Error("implementation revalidation spec directory does not match the exact active Flow target");
    }
    const completed = completeTestEvidenceRefresh({
      root: executionRoot,
      state,
      specDir: resolvedSpecDir,
      flowManager,
      reason: this.plan.reason,
      sourceStep: this.plan.sourceStep,
      resetStepIds: this.plan.resetStepIds,
      additionalArtifacts: this.plan.additionalArtifacts,
      expectedPreviousFingerprint: this.plan.previousFingerprint,
      expectedCurrentFingerprint: this.plan.currentFingerprint,
      faultInjector,
    });
    const repairEntry = readImplRepairLedger(resolvedSpecDir)?.entries.at(-1);
    return new ImplementationRevalidationResult({
      plan: this.plan,
      completed,
      repairEntry,
    });
  }
}
