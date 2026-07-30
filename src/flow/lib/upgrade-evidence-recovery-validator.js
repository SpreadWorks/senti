import {
  EvidenceProcessingFailure,
  RecoveryPolicy,
  RecoveryValidationInput,
  RecoveryValidator,
  RecoveryValidatorFailure,
  RecoveryValidatorPassed,
  ReplacementProofObligation,
} from "./recovery-contract.js";
import { validateUpgradeEvidenceForGate } from "./test-artifacts.js";

function requireString(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value;
}

/**
 * The first concrete normal-Flow recovery validator. It represents the #481
 * stale/missing upgrade-evidence class and never treats evidence as a pass:
 * recovery only resets impl-gate so its canonical owner can regenerate and
 * validate the current artifacts.
 */
export class UpgradeEvidenceRecoveryValidator extends RecoveryValidator {
  constructor({ root, specDir, baseBranch, currentRequiredPaths, currentFingerprint, target, authority }) {
    super({ validatorId: "upgrade-evidence" });
    this.root = requireString(root, "upgrade evidence validator root");
    this.specDir = requireString(specDir, "upgrade evidence validator specDir");
    this.baseBranch = baseBranch == null ? null : requireString(baseBranch, "upgrade evidence validator baseBranch");
    if (!Array.isArray(currentRequiredPaths)) throw new Error("upgrade evidence validator currentRequiredPaths must be an array");
    this.currentRequiredPaths = Object.freeze([...currentRequiredPaths]);
    this.currentFingerprint = currentFingerprint == null ? null : requireString(currentFingerprint, "upgrade evidence validator currentFingerprint");
    this.target = target;
    this.authority = requireString(authority, "upgrade evidence validator authority");
    Object.freeze(this);
  }

  currentPolicy(input) {
    if (!(input instanceof RecoveryValidationInput)) throw new Error("upgrade evidence validator input is required");
    return new RecoveryPolicy({
      policyId: "upgrade-evidence-revalidation",
      policyVersion: "1",
      failureClass: new EvidenceProcessingFailure(),
      waivable: true,
      replacementProofObligation: new ReplacementProofObligation({
        normalStepId: input.target.stepId,
        checkId: "upgrade-evidence",
        canonicalArtifactPath: `${this.specDir.replaceAll("\\", "/")}/upgrade-result.json`,
        inputFingerprint: input.inputFingerprint.fingerprint,
        authority: this.authority,
        repairStepId: input.target.stepId,
      }),
    });
  }

  validate(_input) {
    const validation = validateUpgradeEvidenceForGate({
      root: this.root,
      specDir: this.specDir,
      baseBranch: this.baseBranch,
      currentRequiredPaths: this.currentRequiredPaths,
      currentFingerprint: this.currentFingerprint,
      target: this.target,
    });
    return validation.ok
      ? new RecoveryValidatorPassed()
      : new RecoveryValidatorFailure({
          checkId: "upgrade-evidence",
          failureClass: new EvidenceProcessingFailure(),
        });
  }
}
