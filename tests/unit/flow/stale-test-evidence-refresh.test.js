import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  buildRepairFingerprint,
  completeImplRepair,
  prepareImplTriageArtifact,
  readImplRepairLedger,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import { AcceptanceEvidenceRefresh } from "../../../src/flow/lib/acceptance-review-artifacts.js";
import { StaleTestEvidenceRefresh } from "../../../src/flow/lib/stale-test-evidence-refresh.js";
import { flowLeafIdsBetween } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { writeRepairFingerprintManifest } from "../../../src/flow/lib/repair-state-identity.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";

let tmp;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function mutableFlowManager(state) {
  return {
    load() {
      return state;
    },
    loadReadOnly() {
      return state;
    },
    mutate(mutator) {
      mutator(state);
    },
    updateStepStatus(transition, _options, commitIntent = null) {
      commitIntent?.assertBeforeTransition(state);
      for (const change of transition.changes) {
        const step = findStepById(state.steps, change.stepId);
        step.status = change.requestedStatus;
        delete step.startedAt;
        delete step.finishedAt;
      }
      commitIntent?.applyTo(state);
      return state;
    },
    completeStepTransitionIntent(commitIntent) {
      commitIntent.completeIn(state);
      return state;
    },
  };
}

test("stale evidence refresh rejects additional artifact paths outside the spec directory", () => {
  tmp = createTmpDir("stale-test-evidence-refresh-");
  const specDir = path.join(tmp, "specs", "demo");
  const outsidePath = path.join(tmp, "outside.json");
  writeFile(tmp, "outside.json", "{}\n");
  const refresh = new StaleTestEvidenceRefresh({
    previousFingerprint: "a".repeat(64),
    currentFingerprint: "b".repeat(64),
  });
  const flowManager = {
    mutate() {
      assert.fail("invalid additional artifacts must be rejected before flow mutation");
    },
  };

  for (const relativePath of ["../../outside.json", outsidePath]) {
    assert.throws(
      () => refresh.recover({
        specDir,
        flowManager,
        reason: "test stale evidence",
        additionalArtifacts: [relativePath],
      }),
      /additionalArtifacts\[0\] must (?:be relative to|stay inside) the spec directory/,
    );
    assert.equal(fs.existsSync(outsidePath), true);
  }
});

test("acceptance refresh treats a stale repair ledger endpoint as part of stale evidence recovery", () => {
  const previousFingerprint = "a".repeat(64);
  const currentFingerprint = "b".repeat(64);
  const refresh = new AcceptanceEvidenceRefresh({
    fingerprint: { hash: currentFingerprint },
    artifacts: {
      "test-execute-result.json": { repairFingerprint: previousFingerprint },
    },
    blockers: [
      {
        kind: "invalid_schema",
        summary: "Required artifact is invalid: impl-repair.json.",
      },
      {
        kind: "invalid_schema",
        summary: "Required artifact is invalid: test-execute-result.json.",
      },
    ],
    deferredFindings: [],
  });

  assert.equal(refresh.required, true);
  assert.deepEqual(refresh.staleArtifacts, ["test-execute-result.json"]);
});

test("acceptance refresh ignores an older impl review fingerprint backed by canonical evidence", () => {
  const previousFingerprint = "a".repeat(64);
  const currentFingerprint = "b".repeat(64);
  const refresh = new AcceptanceEvidenceRefresh({
    fingerprint: { hash: currentFingerprint },
    artifacts: {
      "impl-review.json": { repairFingerprint: previousFingerprint },
    },
    blockers: [{
      kind: "invalid_schema",
      summary: "Required artifact is invalid: impl-repair.json.",
    }],
    deferredFindings: [],
    fingerprintExemptArtifacts: ["impl-review.json"],
  });

  assert.deepEqual(refresh.staleArtifacts, []);
  assert.equal(refresh.previousFingerprint, null);
  assert.equal(refresh.required, false);
});

test("stale evidence refresh extends an existing repair ledger to the current fingerprint", () => {
  tmp = createTmpDir("stale-test-evidence-refresh-ledger-");
  const specPath = "specs/demo/spec.json";
  const specDir = path.join(tmp, "specs", "demo");
  writeFile(tmp, specPath, JSON.stringify({ requirements: [] }, null, 2));
  writeFile(tmp, "src/value.js", "export const value = 1;\n");
  initGitRepo(tmp);
  commitAll(tmp, "initial");

  const baseline = buildRepairFingerprint({ root: tmp, specPath });
  const state = moveFlowToStep(makeFlowState({
    specId: "demo",
    repairBaseline: baseline.baseline.toJSON(),
  }), "impl-repair");
  const flowManager = mutableFlowManager(state);
  writeFile(tmp, "specs/demo/impl-review.json", JSON.stringify({
    repairFingerprint: baseline.hash,
    blockingFindings: [{ findingId: "F-1" }],
    nonBlockingImprovements: [],
  }, null, 2));
  prepareImplTriageArtifact({
    specDir,
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    findings: [{ findingId: "F-1", summary: "Apply the first repair." }],
    fingerprint: baseline,
  });
  writeFile(tmp, "specs/demo/test-execute-result.json", JSON.stringify({
    repairFingerprint: baseline.hash,
  }, null, 2));
  writeFile(tmp, "src/value.js", "export const value = 2;\n");
  completeImplRepair({
    root: tmp,
    state,
    flowManager,
    resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
  });

  const repaired = buildRepairFingerprint({ root: tmp, specPath, state });
  writeFile(tmp, "src/value.js", "export const value = 2.5;\n");
  const unledgeredRefresh = buildRepairFingerprint({ root: tmp, specPath, state });
  writeRepairFingerprintManifest(specDir, unledgeredRefresh);
  writeFile(tmp, "specs/demo/test-execute-result.json", JSON.stringify({
    repairFingerprint: unledgeredRefresh.hash,
  }, null, 2));
  writeFile(tmp, "specs/demo/upgrade-result.json", JSON.stringify({
    version: 1,
    command: "sennel upgrade",
    dryRun: false,
    exitCode: 0,
    result: "success-updated",
    summary: {},
    checkedPaths: ["src/skills/demo/SKILL.md"],
    rawLogPath: "tests/.raw/upgrade.log",
    rawLogDigest: "0".repeat(64),
  }, null, 2));
  writeFile(tmp, "specs/demo/tests/.raw/upgrade.log", "stale upgrade output\n");
  writeFile(tmp, "specs/demo/retro.json", JSON.stringify({
    repairFingerprint: unledgeredRefresh.hash,
  }, null, 2));
  moveFlowToStep(state, "final-regression");
  writeFile(tmp, "src/value.js", "export const value = 3;\n");
  const current = buildRepairFingerprint({ root: tmp, specPath, state });

  const result = new StaleTestEvidenceRefresh({
    previousFingerprint: unledgeredRefresh.hash,
    currentFingerprint: current.hash,
  }).recover({
    specDir,
    flowManager,
    reason: "final regression detected stale evidence",
    sourceStep: "final-regression",
  });

  const ledger = readImplRepairLedger(specDir);
  assert.equal(ledger.entries.length, 2);
  assert.equal(ledger.entries[0].currentHash, repaired.hash);
  assert.equal(ledger.entries[1].previousHash, repaired.hash);
  assert.equal(ledger.entries[1].currentHash, current.hash);
  assert.deepEqual(ledger.entries[1].sourceFindingIds, [
    "test-evidence-refresh:final-regression",
  ]);
  assert.equal(result.currentFingerprint, current.hash);
  assert.equal(state.implRepairTransaction, undefined);
  assert.equal(findStepById(state.steps, "test-execute").status, "in_progress");
  assert.equal(findStepById(state.steps, "final-regression").status, "pending");
  assert.ok(result.invalidatedArtifacts.includes("upgrade-result.json"));
  assert.ok(result.invalidatedArtifacts.includes("tests/.raw/upgrade.log"));
  assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);
  assert.equal(fs.existsSync(path.join(specDir, "upgrade-result.json")), false);
  assert.equal(fs.existsSync(path.join(specDir, "tests", ".raw", "upgrade.log")), false);
  assert.equal(fs.existsSync(path.join(specDir, "retro.json")), false);
});

test("stale evidence refresh clears an active impl-repair leaf before restarting tests", () => {
  tmp = createTmpDir("stale-test-evidence-refresh-active-repair-");
  const specPath = "specs/demo/spec.json";
  const specDir = path.join(tmp, "specs", "demo");
  writeFile(tmp, specPath, JSON.stringify({ requirements: [] }, null, 2));
  writeFile(tmp, "src/value.js", "export const value = 1;\n");
  initGitRepo(tmp);
  commitAll(tmp, "initial");

  const baseline = buildRepairFingerprint({ root: tmp, specPath });
  const state = moveFlowToStep(makeFlowState({
    specId: "demo",
    repairBaseline: baseline.baseline.toJSON(),
  }), "impl-repair");
  const flowManager = mutableFlowManager(state);
  writeRepairFingerprintManifest(specDir, baseline);
  writeFile(tmp, "specs/demo/test-execute-result.json", JSON.stringify({
    repairFingerprint: baseline.hash,
  }, null, 2));
  writeFile(tmp, "src/value.js", "export const value = 2;\n");
  const current = buildRepairFingerprint({ root: tmp, specPath, state });

  new StaleTestEvidenceRefresh({
    previousFingerprint: baseline.hash,
    currentFingerprint: current.hash,
  }).recover({
    root: tmp,
    state,
    specDir,
    flowManager,
    reason: "acceptance review detected stale evidence",
    sourceStep: "acceptance-review",
  });

  assert.equal(findStepById(state.steps, "test-execute").status, "in_progress");
  assert.equal(findStepById(state.steps, "impl-repair").status, "pending");
  assert.equal(
    state.steps.flatMap((phase) => phase.children || []).filter((step) => step.status === "in_progress").length,
    1,
  );
});
