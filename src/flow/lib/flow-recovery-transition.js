import { findStepById } from "./step-tree.js";
import { FlowOutbox, FlowOutboxIdentity } from "./flow-outbox.js";
import { IssueLogStore } from "./issue-log-store.js";
import {
  RecoveryFailureLedger,
  RecoveryPolicyCurrent,
  RecoveryValidationInput,
  RecoveryValidatorRegistry,
  resolveCurrentRecoveryPolicy,
} from "./recovery-contract.js";
import {
  RecoveryDecision,
  RecoveryDecisionLedger,
  RecoveryDecisionStepChange,
} from "./recovery-decision.js";
import { FlowTargetExpectation } from "../../lib/flow-target-guard.js";
import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value;
}

function targetExpectation(target) {
  return new FlowTargetExpectation({
    expectRunId: target.runId,
    expectSpec: target.spec,
    ...(target.issue == null ? { expectNoIssue: true } : { expectIssue: target.issue }),
  });
}

function sameRegistryRevision(actual, expected) {
  return actual === expected;
}

export class RecoveryTransitionError extends Error {
  constructor(code, message, { cause } = {}) {
    super(message, { cause });
    this.name = "RecoveryTransitionError";
    this.code = code;
  }
}

/** A behavioral boundary for sampling the exact validator input under the operation lock. */
export class RecoveryInputVerifier {
  readCurrent() {
    throw new Error("recovery input verifier must implement readCurrent()");
  }
}

export class StaticRecoveryInputVerifier extends RecoveryInputVerifier {
  constructor(input) {
    super();
    this.input = input instanceof RecoveryValidationInput ? input : new RecoveryValidationInput(input);
    Object.freeze(this);
  }

  readCurrent() { return this.input; }
}

export class RecoveryTransitionPlan {
  constructor({
    resolution,
    expectedFlowState,
    expectedRegistryRevision,
    inputVerifier,
    validatorRegistry,
    transitionId,
    decidedAt,
  }) {
    if (!(resolution instanceof RecoveryPolicyCurrent)) {
      throw new Error("recovery transition requires a current recovery policy");
    }
    if (!expectedFlowState || typeof expectedFlowState !== "object" || Array.isArray(expectedFlowState)) {
      throw new Error("recovery transition requires the exact flow state read before planning");
    }
    if (expectedRegistryRevision != null && typeof expectedRegistryRevision !== "string") {
      throw new Error("recovery transition expected registry revision is invalid");
    }
    if (!(inputVerifier instanceof RecoveryInputVerifier)) {
      throw new Error("recovery transition requires an input verifier");
    }
    if (!(validatorRegistry instanceof RecoveryValidatorRegistry)) {
      throw new Error("recovery transition requires the current validator registry");
    }
    const record = resolution.record;
    this.expectation = targetExpectation(record.target);
    if (this.expectation.mismatchAgainst(expectedFlowState)) {
      throw new Error("recovery transition expected flow state does not match its failure record target");
    }
    const step = findStepById(expectedFlowState.steps || [], record.target.stepId);
    if (!step) throw new Error("recovery transition validator step is absent from the expected flow state");
    this.outboxIdentity = new FlowOutboxIdentity({
      runId: record.target.runId,
      stepId: record.target.stepId,
      operation: `recovery-decision:${record.recordId}`,
    });
    this.decision = new RecoveryDecision({
      transitionId,
      record,
      policy: resolution.policy,
      stepChange: new RecoveryDecisionStepChange({
        stepId: step.id,
        currentStatus: step.status,
        requestedStatus: "pending",
      }),
      outboxIdempotencyKey: this.outboxIdentity.idempotencyKey,
      decidedAt,
    });
    this.resolution = resolution;
    this.expectedFlowState = expectedFlowState;
    this.expectedRegistryRevision = expectedRegistryRevision;
    this.inputVerifier = inputVerifier;
    this.validatorRegistry = validatorRegistry;
    Object.freeze(this);
  }
}

export class RecoveryTransitionApplied {
  constructor({ decision, outboxEntry }) {
    if (!(decision instanceof RecoveryDecision)) throw new Error("recovery transition result requires a decision");
    this.decision = decision;
    this.outboxEntry = outboxEntry;
    Object.freeze(this);
  }
}

/**
 * Owns the one CAS boundary that consumes a recovery failure record, writes a
 * decision/proof, rewinds its validator step, and starts its issue-log outbox.
 */
export class FlowRecoveryTransition {
  constructor({ flowManager, mainRoot }) {
    if (!flowManager || typeof flowManager.captureExactTarget !== "function" || typeof flowManager.snapshotActiveFlows !== "function") {
      throw new Error("flow recovery transition requires an exact-target flow manager");
    }
    this.flowManager = flowManager;
    this.mainRoot = requireString(mainRoot, "flow recovery transition mainRoot");
    Object.freeze(this);
  }

  apply(plan) {
    if (!(plan instanceof RecoveryTransitionPlan)) throw new Error("recovery transition plan is required");
    const operation = new RepositoryFlowOperationLock({
      mainRoot: this.mainRoot,
      allowProcessOwnerBorrow: false,
    });
    const ownerToken = operation.acquire();
    let primary = null;
    let result = null;
    try {
      operation.assertOwned();
      const registry = this.flowManager.snapshotActiveFlows({ operationOwnerToken: ownerToken });
      if (!sameRegistryRevision(registry.revision, plan.expectedRegistryRevision)) {
        throw new RecoveryTransitionError(
          "RECOVERY_REGISTRY_REVISION_CONFLICT",
          "active-flow registry changed after recovery planning",
        );
      }
      const currentInput = plan.inputVerifier.readCurrent();
      if (!(currentInput instanceof RecoveryValidationInput)) {
        throw new RecoveryTransitionError("RECOVERY_INPUT_INVALID", "recovery input verifier did not return validation input");
      }
      if (!currentInput.target.equals(plan.resolution.record.target)) {
        throw new RecoveryTransitionError("RECOVERY_TARGET_MISMATCH", "recovery target changed before decision commit");
      }
      if (!currentInput.inputFingerprint.equals(plan.resolution.record.inputFingerprint)) {
        throw new RecoveryTransitionError("RECOVERY_INPUT_CHANGED", "recovery validator input changed before decision commit");
      }
      const currentResolution = resolveCurrentRecoveryPolicy({
        record: plan.resolution.record,
        input: currentInput,
        registry: plan.validatorRegistry,
      });
      if (!(currentResolution instanceof RecoveryPolicyCurrent)) {
        throw new RecoveryTransitionError(
          "RECOVERY_POLICY_NOT_CURRENT",
          "recovery policy is no longer current; re-run the validator before deciding",
        );
      }
      if (!currentResolution.policy.identity.equals(plan.resolution.policy.identity)) {
        throw new RecoveryTransitionError(
          "RECOVERY_POLICY_CHANGED",
          "recovery policy changed after planning",
        );
      }
      const captured = this.flowManager.captureExactTarget(plan.expectation);
      let outboxEntry = null;
      captured.mutate((state) => {
        this.#applyToState(state, plan);
        const outbox = new FlowOutbox(state.outbox || []);
        outboxEntry = outbox.find(plan.outboxIdentity);
      }, {
        expectedOriginal: plan.expectedFlowState,
        operationOwnerToken: ownerToken,
      });
      result = new RecoveryTransitionApplied({ decision: plan.decision, outboxEntry });
    } catch (error) {
      primary = error;
    } finally {
      try {
        operation.release();
      } catch (releaseError) {
        if (primary) {
          primary = new AggregateError([primary, releaseError], "recovery transition and operation lock release both failed", { cause: primary });
        } else {
          primary = releaseError;
        }
      }
    }
    if (primary) throw primary;
    return result;
  }

  #applyToState(state, plan) {
    if (plan.expectation.mismatchAgainst(state)) {
      throw new RecoveryTransitionError("RECOVERY_TARGET_MISMATCH", "flow target changed before decision commit");
    }
    const ledger = new RecoveryFailureLedger(state.recoveryFailureRecords || []);
    const stored = ledger.find(plan.decision.record.recordId);
    if (!stored || stored.consumption.state !== "available") {
      throw new RecoveryTransitionError("RECOVERY_RECORD_UNAVAILABLE", "recovery failure record is no longer available");
    }
    if (stored.recordId !== plan.decision.record.recordId) {
      throw new RecoveryTransitionError("RECOVERY_RECORD_MISMATCH", "recovery failure record changed before decision commit");
    }
    const step = findStepById(state.steps || [], plan.decision.stepChange.stepId);
    if (!step || step.status !== plan.decision.stepChange.currentStatus) {
      throw new RecoveryTransitionError("RECOVERY_STEP_STALE", "recovery validator step changed before decision commit");
    }
    const outbox = new FlowOutbox(state.outbox || []);
    const existing = outbox.find(plan.outboxIdentity);
    if (existing && existing.idempotencyKey !== plan.decision.outboxIdempotencyKey) {
      throw new RecoveryTransitionError("RECOVERY_OUTBOX_MISMATCH", "recovery outbox identity changed before decision commit");
    }
    const consumed = stored.consume({
      transitionId: plan.decision.transitionId,
      consumedAt: plan.decision.decidedAt,
    });
    const updatedLedger = ledger.replace(consumed);
    const decisions = new RecoveryDecisionLedger({
      failureLedger: updatedLedger,
      decisions: state.recoveryDecisions || [],
    }).record(plan.decision);
    step.status = plan.decision.stepChange.requestedStatus;
    delete step.startedAt;
    delete step.finishedAt;
    outbox.begin(plan.outboxIdentity, plan.decision.decidedAt);
    state.recoveryFailureRecords = updatedLedger.toJSON();
    state.recoveryDecisions = decisions.toJSON();
    state.outbox = outbox.toJSON();
  }
}

export class RecoveryDeliveryDone {
  constructor({ entry, appended }) {
    this.entry = entry;
    this.appended = appended;
    Object.freeze(this);
  }
}

export class RecoveryDeliveryDeferred {
  constructor({ error }) {
    this.error = error instanceof Error ? error : new Error(String(error));
    Object.freeze(this);
  }
}

/**
 * Delivers the persisted recovery audit after the decision CAS. The issue-log
 * ID equals the outbox key, so a crash after append is safely resumed.
 */
export class RecoveryIssueLogDelivery {
  constructor({ flowManager, root, mainRoot = root, issueLogStoreFactory = (options) => new IssueLogStore(options) }) {
    if (!flowManager || typeof flowManager.mutateExactTarget !== "function") {
      throw new Error("recovery issue-log delivery requires an exact-target flow manager");
    }
    if (typeof issueLogStoreFactory !== "function") throw new Error("recovery issue-log store factory is required");
    this.flowManager = flowManager;
    this.root = requireString(root, "recovery issue-log root");
    this.mainRoot = requireString(mainRoot, "recovery issue-log mainRoot");
    this.issueLogStoreFactory = issueLogStoreFactory;
    Object.freeze(this);
  }

  deliver(plan) {
    if (!(plan instanceof RecoveryTransitionPlan)) throw new Error("recovery transition plan is required for delivery");
    const state = this.flowManager.loadReadOnly(plan.expectation.spec);
    if (!state || plan.expectation.mismatchAgainst(state)) {
      throw new RecoveryTransitionError("RECOVERY_TARGET_MISMATCH", "recovery target is unavailable for issue-log delivery");
    }
    let entry = new FlowOutbox(state.outbox || []).find(plan.outboxIdentity);
    if (!entry) throw new RecoveryTransitionError("RECOVERY_OUTBOX_MISSING", "recovery issue-log outbox entry is missing");
    if (entry.status === "done") return new RecoveryDeliveryDone({ entry, appended: false });
    if (entry.status === "failed") entry = this.#beginRetry(plan);
    let appended;
    try {
      appended = this.issueLogStoreFactory({
        root: this.root,
        mainRoot: this.mainRoot,
        spec: state.spec,
      }).append(plan.decision.toIssueLogEntry(), plan.outboxIdentity.idempotencyKey);
    } catch (error) {
      this.#markFailed(plan, error);
      return new RecoveryDeliveryDeferred({ error });
    }
    try {
      const completed = this.#complete(plan, { appended: appended.appended });
      return new RecoveryDeliveryDone({ entry: completed, appended: appended.appended });
    } catch (error) {
      return new RecoveryDeliveryDeferred({ error });
    }
  }

  #beginRetry(plan) {
    return this.#mutateOutbox(plan, (outbox) => outbox.begin(plan.outboxIdentity));
  }

  #complete(plan, result) {
    return this.#mutateOutbox(plan, (outbox) => outbox.complete(plan.outboxIdentity, result));
  }

  #mutateOutbox(plan, mutation) {
    let entry = null;
    this.flowManager.mutateExactTarget(plan.expectation, (state) => {
      const outbox = new FlowOutbox(state.outbox || []);
      entry = mutation(outbox);
      state.outbox = outbox.toJSON();
    });
    return entry;
  }

  #markFailed(plan, error) {
    try {
      this.#mutateOutbox(plan, (outbox) => outbox.fail(plan.outboxIdentity, error));
    } catch (_outboxError) {
      // The original decision remains durable and the pending outbox is the
      // recovery authority; never compensate the decision or step transition.
    }
  }
}
