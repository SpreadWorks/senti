// spec: R7
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { flowLeafIdsBetween } from "../../../src/flow/definition.js";
import {
  buildRepairFingerprint,
  completeImplRepair,
  prepareImplTriageArtifact,
  readImplRepairLedger,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import { writeRepairFingerprintManifest } from "../../../src/flow/lib/repair-state-identity.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";
import { makeFlowState, moveFlowToStep } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const SPEC_DIR = "specs/329-final-regression-stale-evidence";
const SPEC_PATH = `${SPEC_DIR}/spec.md`;

function write(root, relativePath, content) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

test("R7: final-regression invalidates stale test evidence before project tests start", async (t) => {
  const root = createTmpDir("final-regression-stale-evidence-");
  t.after(() => removeTmpDir(root));
  write(root, SPEC_PATH, "# Spec\n");
  write(root, "final-regression-fixture.sh", "printf '%s\\n' 'must not run'\n");
  initGitRepo(root);
  commitAll(root, "initial");

  const previousFingerprint = buildRepairFingerprint({
    root,
    specPath: SPEC_PATH,
  });
  const state = moveFlowToStep(makeFlowState({
    spec: SPEC_PATH,
    repairBaseline: previousFingerprint.baseline.toJSON(),
    retryLimits: { gate: 5, review: 4 },
    reviewConvergence: { records: [{ marker: "preserved" }] },
    acceptanceReview: { verdict: "pass" },
  }), "impl-repair");
  const flowManager = {
    mutate(mutator) {
      mutator(state);
    },
  };
  write(root, `${SPEC_DIR}/impl-review.json`, `${JSON.stringify({
    repairFingerprint: previousFingerprint.hash,
    blockingFindings: [{ findingId: "F-1" }],
    nonBlockingImprovements: [],
  }, null, 2)}\n`);
  prepareImplTriageArtifact({
    specDir: path.join(root, SPEC_DIR),
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    findings: [{ findingId: "F-1", summary: "Apply the initial repair." }],
    fingerprint: previousFingerprint,
  });
  write(root, `${SPEC_DIR}/test-execute-result.json`, `${JSON.stringify({
    repairFingerprint: previousFingerprint.hash,
  }, null, 2)}\n`);
  write(root, "src/repair.js", "export const repaired = 1;\n");
  completeImplRepair({
    root,
    state,
    flowManager,
    resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
  });
  const repairedFingerprint = buildRepairFingerprint({
    root,
    specPath: SPEC_PATH,
    state,
  });
  write(root, "src/repair.js", "export const repaired = 1.5;\n");
  const unledgeredRefreshFingerprint = buildRepairFingerprint({
    root,
    specPath: SPEC_PATH,
    state,
  });
  writeRepairFingerprintManifest(
    path.join(root, SPEC_DIR),
    unledgeredRefreshFingerprint,
  );

  moveFlowToStep(state, "final-regression");
  write(root, "src/repair.js", "export const repaired = 2;\n");
  const currentFingerprint = buildRepairFingerprint({
    root,
    specPath: SPEC_PATH,
    state,
  });
  write(root, `${SPEC_DIR}/test-execute-result.json`, `${JSON.stringify({
    repairFingerprint: unledgeredRefreshFingerprint.hash,
  }, null, 2)}\n`);
  write(root, `${SPEC_DIR}/acceptance-review.json`, `${JSON.stringify({
    repairFingerprint: unledgeredRefreshFingerprint.hash,
  }, null, 2)}\n`);
  write(root, `${SPEC_DIR}/final-regression-result.json`, "{}\n");
  const retryLimits = structuredClone(state.retryLimits);
  const reviewConvergence = structuredClone(state.reviewConvergence);

  const result = await new RunFinalRegressionCommand().execute({
    root,
    config: { test: { command: "sh final-regression-fixture.sh", timeout: 5 } },
    flowState: state,
    flowManager,
  });

  assert.equal(result.result, "recovered");
  assert.equal(result.next, "test-execute");
  assert.equal(
    result.artifacts.evidenceRefresh.previousFingerprint,
    unledgeredRefreshFingerprint.hash,
  );
  assert.equal(result.artifacts.evidenceRefresh.currentFingerprint, currentFingerprint.hash);
  const ledger = readImplRepairLedger(path.join(root, SPEC_DIR));
  assert.equal(ledger.entries.length, 2);
  assert.equal(ledger.entries[0].currentHash, repairedFingerprint.hash);
  assert.equal(ledger.entries[1].previousHash, repairedFingerprint.hash);
  assert.equal(ledger.entries[1].currentHash, currentFingerprint.hash);
  assert.equal(findStepById(state.steps, "test-execute").status, "in_progress");
  assert.equal(findStepById(state.steps, "final-regression").status, "pending");
  assert.deepEqual(state.retryLimits, retryLimits);
  assert.deepEqual(state.reviewConvergence, reviewConvergence);
  assert.equal(Object.hasOwn(state, "acceptanceReview"), false);
  assert.equal(fs.existsSync(path.join(root, `${SPEC_DIR}/test-execute-result.json`)), false);
  assert.equal(fs.existsSync(path.join(root, `${SPEC_DIR}/acceptance-review.json`)), false);
  assert.equal(fs.existsSync(path.join(root, `${SPEC_DIR}/final-regression-result.json`)), false);
  assert.equal(fs.existsSync(path.join(
    root,
    `${SPEC_DIR}/tests/.raw/final-regression-attempt-001.log`,
  )), false);
});

test("R7: recovered final-regression bypasses completion post-hook validation", async () => {
  const transitions = [];

  await FLOW_COMMANDS.run["final-regression"].post({
    root: "/unused",
    flowState: {},
    flowManager: {
      updateStepStatus(transition) {
        transitions.push(transition);
      },
    },
  }, {
    result: "recovered",
    artifacts: {
      evidenceRefresh: { recovered: true },
    },
  });

  assert.deepEqual(transitions, []);
});
