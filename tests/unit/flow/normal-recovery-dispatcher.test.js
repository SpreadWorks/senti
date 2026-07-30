import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  EvidenceProcessingFailure,
  RecoveryFailureRecordStore,
  RecoveryInputArtifact,
  RecoveryInputFingerprint,
  RecoveryValidationInput,
  RecoveryValidatorFailure,
  RecoveryValidatorRegistry,
} from "../../../src/flow/lib/recovery-contract.js";
import { NormalRecoveryDispatcher } from "../../../src/flow/lib/normal-recovery-dispatcher.js";
import {
  UPGRADE_EVIDENCE_RECOVERY_AUTHORITY,
  UpgradeEvidenceRecoveryValidator,
} from "../../../src/flow/lib/upgrade-evidence-recovery-validator.js";
import { makeFlowManager, setupFlowAtStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root = null;

afterEach(() => {
  if (root) removeTmpDir(root);
  root = null;
});

function digest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("thin recovery dispatcher consumes one current validator record through the normal Flow transition", () => {
  root = createTmpDir("normal-recovery-dispatcher-");
  const specId = "normal-recovery";
  const state = setupFlowAtStep(root, "impl-gate", {
    spec: `specs/${specId}/spec.json`,
    runId: "run-normal-recovery",
    issue: 656,
  });
  const inputPath = path.join(root, "specs", specId, "recovery-input.json");
  fs.writeFileSync(inputPath, '{"current":true}\n');
  const input = new RecoveryValidationInput({
    target: {
      runId: state.runId,
      issue: state.issue,
      spec: state.spec,
      stepId: "impl-gate",
      attemptId: "impl-gate-attempt-001",
    },
    inputFingerprint: new RecoveryInputFingerprint({
      artifacts: [new RecoveryInputArtifact({
        artifactPath: `specs/${specId}/recovery-input.json`,
        digest: digest(inputPath),
        authority: "fixture/current-input",
      })],
    }),
  });
  const validator = new UpgradeEvidenceRecoveryValidator({
    root,
    specDir: `specs/${specId}`,
    baseBranch: null,
    currentRequiredPaths: [],
    currentFingerprint: null,
    target: null,
    authority: UPGRADE_EVIDENCE_RECOVERY_AUTHORITY,
  });
  const record = validator.recordFailure(input, new RecoveryValidatorFailure({
    checkId: "upgrade-evidence",
    failureClass: new EvidenceProcessingFailure(),
  }), "2026-07-30T04:00:00.000Z");
  const manager = makeFlowManager(root);
  new RecoveryFailureRecordStore(manager).record(record);

  const result = new NormalRecoveryDispatcher({
    flowManager: manager,
    root,
    mainRoot: root,
    validatorRegistryFactory: () => new RecoveryValidatorRegistry([validator]),
  }).execute({ state: manager.loadReadOnly(specId) });

  assert.equal(result.toJSON().status, "transition-applied");
  assert.equal(result.toJSON().decision.recordId, record.recordId);
  assert.equal(result.toJSON().delivery.status, "done");
  const persisted = manager.loadReadOnly(specId);
  assert.equal(findStepById(persisted.steps, "impl-gate").status, "pending");
  assert.equal(persisted.recoveryFailureRecords[0].consumption.state, "consumed");
  assert.equal(persisted.recoveryDecisions.length, 1);
});

test("thin recovery dispatcher leaves normal Flow unchanged without one available validator record", () => {
  root = createTmpDir("normal-recovery-unavailable-");
  const state = setupFlowAtStep(root, "impl-gate", {
    spec: "specs/normal-recovery-unavailable/spec.json",
    runId: "run-normal-recovery-unavailable",
    issue: 656,
  });
  const manager = makeFlowManager(root);
  const before = fs.readFileSync(path.join(root, "specs", "normal-recovery-unavailable", "flow.json"), "utf8");

  const result = new NormalRecoveryDispatcher({
    flowManager: manager,
    root,
    mainRoot: root,
  }).execute({ state });

  assert.equal(result.toJSON().status, "unavailable");
  assert.equal(result.toJSON().recovery.reason, "recovery-record-unavailable");
  assert.equal(
    fs.readFileSync(path.join(root, "specs", "normal-recovery-unavailable", "flow.json"), "utf8"),
    before,
  );
});
