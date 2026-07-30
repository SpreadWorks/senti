import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  RecoveryFailureRecordStore,
  RecoveryInputFingerprint,
  RecoveryPolicy,
  RecoveryUnavailable,
  RecoveryValidationInput,
  RecoveryValidator,
  RecoveryValidatorFailure,
  SemanticDecisionFailure,
} from "../../../src/flow/lib/recovery-contract.js";
import {
  ImplementationRevalidationIntent,
  RecoveryComposition,
  RecoveryUnavailableNotice,
  UserResolution,
  UserResolutionRequest,
  UserResolutionStore,
} from "../../../src/flow/lib/recovery-composition.js";
import { ImplementationRevalidationPlan } from "../../../src/flow/lib/implementation-revalidation.js";
import { makeFlowManager, makeFlowState, moveFlowToStep, setupFlow } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let tmp = null;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function target() {
  return {
    runId: "run-recovery-composition",
    issue: 656,
    spec: "specs/recovery-composition/spec.json",
    stepId: "impl-gate",
    attemptId: "impl-gate-001",
  };
}

function input() {
  return new RecoveryValidationInput({
    target: target(),
    inputFingerprint: new RecoveryInputFingerprint({
      artifacts: [{
        artifactPath: "specs/recovery-composition/impl-gate-result.json",
        digest: "a".repeat(64),
        authority: "flow-revision-001",
      }],
    }),
  });
}

class SemanticValidator extends RecoveryValidator {
  constructor() { super({ validatorId: "semantic-decision" }); }

  currentPolicy() {
    return new RecoveryPolicy({
      policyId: "semantic-resolution",
      policyVersion: "1",
      failureClass: new SemanticDecisionFailure(),
    });
  }

  validate() {
    return new RecoveryValidatorFailure({
      checkId: "product-decision",
      failureClass: new SemanticDecisionFailure(),
    });
  }
}

function semanticRecord() {
  const validator = new SemanticValidator();
  const currentInput = input();
  return validator.recordFailure(currentInput, validator.validate(currentInput), "2026-07-30T00:00:00.000Z");
}

function revalidationPlan() {
  const state = moveFlowToStep(makeFlowState({
    runId: target().runId,
    issue: target().issue,
    spec: target().spec,
  }), "impl-gate");
  return new ImplementationRevalidationPlan({
    target: target(),
    flowState: state,
    previousFingerprint: "a".repeat(64),
    currentFingerprint: "b".repeat(64),
    reason: "The selected product behavior changes implementation evidence.",
  });
}

function resolution(record = semanticRecord()) {
  return new UserResolution({
    resolutionId: "4d6f16c8-4555-4aa8-8f53-27ced7e06f91",
    record,
    subject: { kind: "product-behavior", reference: "The behavior described by the implementation finding." },
    decision: "Use the documented behavior and repair the implementation to match it.",
    rationale: "The product requirement takes precedence over the conflicting finding interpretation.",
    normalRepairStepId: "impl-repair",
    changedPaths: [{ path: "src/behavior.js" }],
    resolvedAt: "2026-07-30T00:01:00.000Z",
  });
}

describe("recovery composition", () => {
  it("orders a user resolution before the required normal implementation revalidation", () => {
    const selected = resolution();
    const intent = new ImplementationRevalidationIntent({
      plan: revalidationPlan(),
      changedPaths: [{ path: "src/behavior.js" }],
    });

    const composition = new RecoveryComposition({ entries: [selected, intent] });
    const stored = composition.toJSON();

    assert.equal(composition.requiresUserAction, true);
    assert.equal(stored.entries[0].type, "user-resolution");
    assert.equal(stored.entries[1].type, "implementation-revalidation");
    assert.equal(stored.entries[1].restartStepId, "test-execute");
  });

  it("rejects automatic semantic approval and code changes without revalidation", () => {
    const selected = resolution();
    assert.throws(
      () => new RecoveryComposition({ entries: [selected], autoMode: false }),
      /must be followed by implementation revalidation/,
    );
    assert.throws(
      () => new RecoveryComposition({
        entries: [selected, new ImplementationRevalidationIntent({
          plan: revalidationPlan(),
          changedPaths: [{ path: "src/behavior.js" }],
        })],
        autoMode: true,
      }),
      /must not approve a user resolution/,
    );
  });

  it("records one user resolution for the exact semantic failure without changing its normal step", () => {
    tmp = createTmpDir("recovery-composition-store-");
    setupFlow(tmp, {
      runId: target().runId,
      issue: target().issue,
      spec: target().spec,
    });
    const record = semanticRecord();
    const manager = makeFlowManager(tmp);
    new RecoveryFailureRecordStore(manager).record(record);
    const before = JSON.parse(fs.readFileSync(
      path.join(tmp, "specs", "recovery-composition", "flow.json"),
      "utf8",
    ));

    const saved = new UserResolutionStore(manager).record(resolution(record));
    const persisted = JSON.parse(fs.readFileSync(
      path.join(tmp, "specs", "recovery-composition", "flow.json"),
      "utf8",
    ));

    assert.equal(saved.record.recordId, record.recordId);
    assert.equal(persisted.recoveryUserResolutions.length, 1);
    assert.equal(persisted.recoveryUserResolutions[0].normalRepairStepId, "impl-repair");
    assert.deepEqual(persisted.steps, before.steps);
    assert.equal(persisted.recoveryFailureRecords[0].consumption.state, "available");
  });

  it("returns plain-language user and unavailable presentations without action-token labels", () => {
    const request = new UserResolutionRequest({
      target: target(),
      subject: { kind: "requirement", reference: "R-1" },
      question: "Which product behavior should the repair implement?",
      choices: [
        { label: "Keep the documented behavior", outcome: "Repair the code to match the documented behavior.", impact: "Changes the implementation and reruns normal verification." },
        { label: "Revise the requirement", outcome: "Update the requirement before repairing the implementation.", impact: "Changes the specification and its downstream evidence." },
      ],
    }).toJSON();
    const unavailable = new RecoveryUnavailableNotice(new RecoveryUnavailable({
      reason: "validator-unavailable",
      message: "Recovery is paused because the current validator is unavailable; the Flow was not changed.",
      nextAction: {
        actionId: "inspect-validator-registry",
        description: "Restore the validator, then collect a current failure record for this Flow.",
      },
    })).toJSON();

    assert.equal(request.requiresUserAction, true);
    assert.equal(Object.hasOwn(request.choices[0], "actionId"), false);
    assert.match(request.choices[0].label, /documented behavior/);
    assert.equal(unavailable.available, false);
    assert.match(unavailable.message, /Flow was not changed/);
    assert.equal(unavailable.nextAction.actionId, "inspect-validator-registry");
  });

  it("does not combine an unavailable result with state-changing decisions", () => {
    const unavailable = new RecoveryUnavailableNotice(new RecoveryUnavailable({
      reason: "target-mismatch",
      nextAction: {
        actionId: "inspect-recovery-target",
        description: "Read the active Flow target before attempting recovery.",
      },
    }));
    assert.throws(
      () => new RecoveryComposition({ entries: [unavailable, resolution()] }),
      /cannot be combined/,
    );
  });
});
