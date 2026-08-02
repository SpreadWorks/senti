import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";

import {
  FlowRecoveryTransition,
  RecoveryDeliveryDeferred,
  RecoveryDeliveryDone,
  RecoveryInputVerifier,
  RecoveryIssueLogDelivery,
  RecoveryTransitionPlan,
} from "./flow-recovery-transition.js";
import {
  CurrentRecoveryValidatorRerun,
  RecoveryFailureLedger,
  RecoveryFailureRecordStore,
  RecoveryInputArtifact,
  RecoveryInputFingerprint,
  RecoveryUnavailable,
  RecoveryValidationInput,
  RecoveryValidatorRegistry,
  RecoveryValidatorRerunRequired,
  resolveCurrentRecoveryPolicy,
} from "./recovery-contract.js";
import {
  UPGRADE_EVIDENCE_RECOVERY_AUTHORITY,
  UpgradeEvidenceRecoveryValidator,
} from "./upgrade-evidence-recovery-validator.js";
import { buildRepairFingerprint, ImplRepairTargetIdentity } from "./impl-repair-artifacts.js";
import { listUpgradeRequiredChangedPaths } from "./test-artifacts.js";

function requireRoot(value, field) {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    throw new Error(`${field} must be an absolute path`);
  }
  return fs.realpathSync(value);
}

function recoveryUnavailable(reason, message, actionId, description) {
  return new RecoveryUnavailable({
    reason,
    message,
    nextAction: { actionId, description },
  });
}

/** Re-reads exactly the artifact set that a validator recorded before recovery. */
export class CurrentRecoveryInputVerifier extends RecoveryInputVerifier {
  constructor({ root, record }) {
    super();
    this.root = requireRoot(root, "recovery input root");
    this.record = record;
    Object.freeze(this);
  }

  readCurrent() {
    const artifacts = this.record.inputFingerprint.artifacts.map((artifact) => {
      const absolute = path.resolve(this.root, artifact.artifactPath);
      const relative = path.relative(this.root, absolute);
      if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`)) {
        throw new Error(`recovery input artifact is outside the selected Flow root: ${artifact.artifactPath}`);
      }
      const stat = fs.lstatSync(absolute);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`recovery input artifact must be a regular file: ${artifact.artifactPath}`);
      }
      return new RecoveryInputArtifact({
        artifactPath: artifact.artifactPath,
        digest: crypto.createHash("sha256").update(fs.readFileSync(absolute)).digest("hex"),
        authority: artifact.authority,
      });
    });
    return new RecoveryValidationInput({
      target: this.record.target,
      inputFingerprint: new RecoveryInputFingerprint({ artifacts }),
    });
  }
}

/** Selects one available, validator-owned failure record without inventing a route. */
export class RecoveryRecordSelection {
  constructor({ state, recordId = null }) {
    const ledger = new RecoveryFailureLedger(state?.recoveryFailureRecords || []);
    const available = ledger.records.filter((record) => record.consumption.state === "available");
    this.record = recordId == null
      ? (available.length === 1 ? available[0] : null)
      : available.find((record) => record.recordId === recordId) || null;
    this.unavailable = this.record
      ? null
      : recordId != null
        ? recoveryUnavailable(
          "recovery-record-unavailable",
          "The selected recovery record is not available for this normal Flow.",
          "inspect-recovery-record",
          "Read the current validator failure records and select an available record for this exact Flow.",
        )
        : available.length === 0
          ? recoveryUnavailable(
            "recovery-record-unavailable",
            "No validator-owned recovery failure record is available for this normal Flow.",
            "inspect-normal-flow",
            "Run the current normal Flow step or inspect its durable validator evidence before retrying recovery.",
          )
          : recoveryUnavailable(
            "recovery-record-ambiguous",
            "More than one validator failure record is available, so recovery did not choose one automatically.",
            "inspect-recovery-records",
            "Inspect the available validator records and select the exact record for recovery.",
          );
    Object.freeze(this);
  }
}

/** Production registry factory for validators that currently expose recovery contracts. */
export class NormalRecoveryValidatorRegistry {
  constructor({ root, state, record }) {
    if (!record || record.validatorId !== "upgrade-evidence") {
      this.registry = new RecoveryValidatorRegistry();
      Object.freeze(this);
      return;
    }
    const specPath = relativeFlowSpecFile(state);
    const specDir = path.dirname(specPath);
    const currentFingerprint = buildRepairFingerprint({
      root,
      specPath,
      state,
    }).hash;
    const validator = new UpgradeEvidenceRecoveryValidator({
      root,
      specDir,
      baseBranch: state.baseBranch || null,
      currentRequiredPaths: listUpgradeRequiredChangedPaths({ root, baseBranch: state.baseBranch }),
      currentFingerprint,
      target: ImplRepairTargetIdentity.fromState(state),
      authority: UPGRADE_EVIDENCE_RECOVERY_AUTHORITY,
    });
    this.registry = new RecoveryValidatorRegistry([validator]);
    Object.freeze(this);
  }
}

export class NormalRecoveryDispatchResult {
  constructor({ applied = null, delivery = null, unavailable = null, rerunRecordId = null }) {
    if ((applied == null) === (unavailable == null)) {
      throw new Error("normal recovery dispatch requires one applied or unavailable result");
    }
    this.applied = applied;
    this.delivery = delivery;
    this.unavailable = unavailable;
    this.rerunRecordId = rerunRecordId;
    Object.freeze(this);
  }

  toJSON() {
    if (this.unavailable) return { status: "unavailable", recovery: this.unavailable.toJSON() };
    return {
      status: "transition-applied",
      decision: this.applied.decision.toJSON(),
      outbox: this.applied.outboxEntry?.toJSON?.() || null,
      delivery: this.delivery instanceof RecoveryDeliveryDone
        ? { status: "done", appended: this.delivery.appended }
        : this.delivery instanceof RecoveryDeliveryDeferred
          ? { status: "deferred", message: this.delivery.error.message }
          : null,
      ...(this.rerunRecordId ? { rerunRecordId: this.rerunRecordId } : {}),
    };
  }
}

/**
 * Converts one current validator failure into the existing atomic normal-Flow
 * recovery transition. It owns no session, plan, verification, or finalize
 * state; unavailable authority is reported without mutation.
 */
export class NormalRecoveryDispatcher {
  constructor({
    flowManager,
    root,
    mainRoot,
    validatorRegistryFactory = (input) => new NormalRecoveryValidatorRegistry(input).registry,
  }) {
    if (!flowManager || typeof flowManager.snapshotActiveFlows !== "function") {
      throw new Error("normal recovery dispatcher requires a flow manager");
    }
    if (typeof validatorRegistryFactory !== "function") {
      throw new Error("normal recovery dispatcher validator registry factory is required");
    }
    this.flowManager = flowManager;
    this.root = requireRoot(root, "normal recovery root");
    this.mainRoot = requireRoot(mainRoot, "normal recovery main root");
    this.validatorRegistryFactory = validatorRegistryFactory;
    Object.freeze(this);
  }

  execute({ state, recordId = null, allowRerun = true } = {}) {
    const selection = new RecoveryRecordSelection({ state, recordId });
    if (selection.unavailable) return new NormalRecoveryDispatchResult({ unavailable: selection.unavailable });
    const verifier = new CurrentRecoveryInputVerifier({ root: this.root, record: selection.record });
    let input;
    try {
      input = verifier.readCurrent();
    } catch (error) {
      return new NormalRecoveryDispatchResult({ unavailable: recoveryUnavailable(
        "recovery-input-unavailable",
        `Recovery did not change the Flow because current validator input could not be read: ${error.message}`,
        "inspect-recovery-input",
        "Restore the validator input artifacts for this exact Flow, then retry recovery.",
      ) });
    }
    const registry = this.validatorRegistryFactory({
      root: this.root,
      state,
      record: selection.record,
    });
    if (!(registry instanceof RecoveryValidatorRegistry)) {
      throw new Error("normal recovery dispatcher registry factory must return a RecoveryValidatorRegistry");
    }
    const resolution = resolveCurrentRecoveryPolicy({
      record: selection.record,
      input,
      registry,
    });
    if (resolution instanceof RecoveryUnavailable) {
      return new NormalRecoveryDispatchResult({ unavailable: resolution });
    }
    if (resolution instanceof RecoveryValidatorRerunRequired) {
      return this.#rerunOrStop({ state, resolution, verifier, allowRerun });
    }
    const plan = new RecoveryTransitionPlan({
      resolution,
      expectedFlowState: state,
      expectedRegistryRevision: this.flowManager.snapshotActiveFlows().revision,
      inputVerifier: verifier,
      validatorRegistry: registry,
      transitionId: crypto.randomUUID(),
      decidedAt: new Date().toISOString(),
    });
    const applied = new FlowRecoveryTransition({
      flowManager: this.flowManager,
      mainRoot: this.mainRoot,
    }).apply(plan);
    const delivery = new RecoveryIssueLogDelivery({
      flowManager: this.flowManager,
      root: this.root,
      mainRoot: this.mainRoot,
    }).deliver(plan);
    return new NormalRecoveryDispatchResult({ applied, delivery });
  }

  #rerunOrStop({ state, resolution, verifier, allowRerun }) {
    if (!allowRerun) {
      return new NormalRecoveryDispatchResult({ unavailable: recoveryUnavailable(
        "recovery-policy-not-current",
        "The validator produced another non-current recovery record, so recovery stopped without selecting an older policy.",
        "inspect-recovery-record",
        "Inspect the refreshed validator evidence before attempting another normal recovery transition.",
      ) });
    }
    const rerun = new CurrentRecoveryValidatorRerun({
      record: resolution.record,
      registry: new RecoveryValidatorRegistry([resolution.validator]),
      inputCollector: verifier,
      recordStore: new RecoveryFailureRecordStore(this.flowManager),
    }).rerun();
    if (rerun.unavailable) return new NormalRecoveryDispatchResult({ unavailable: rerun.unavailable });
    const refreshedState = this.flowManager.load();
    const refreshed = this.execute({
      state: refreshedState,
      recordId: rerun.record.recordId,
      allowRerun: false,
    });
    if (refreshed.applied) {
      return new NormalRecoveryDispatchResult({
        applied: refreshed.applied,
        delivery: refreshed.delivery,
        rerunRecordId: rerun.record.recordId,
      });
    }
    return refreshed;
  }
}
