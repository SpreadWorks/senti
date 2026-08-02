import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { FlowManager } from "../../../src/lib/flow-manager.js";
import { flowLeafIdsBetween } from "../../../src/flow/definition.js";
import {
  buildRepairFingerprint,
  readImplRepairLedger,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  ImplementationRevalidation,
  ImplementationRevalidationPlan,
} from "../../../src/flow/lib/implementation-revalidation.js";
import { writeRepairFingerprintManifest } from "../../../src/flow/lib/repair-state-identity.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";

const SPEC_ID = "implementation-revalidation";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;

let tmp = null;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function setupRevalidationFixture() {
  tmp = createTmpDir("implementation-revalidation-");
  writeFile(tmp, SPEC_PATH, JSON.stringify({ requirements: [] }, null, 2));
  writeFile(tmp, "src/value.js", "export const value = 1;\n");
  initGitRepo(tmp);
  commitAll(tmp, "initial");

  const baseline = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH });
  const state = moveFlowToStep(makeFlowState({
    specId: SPEC_ID,
    runId: "run-implementation-revalidation",
    repairBaseline: baseline.baseline.toJSON(),
  }), "impl-gate");
  const manager = new FlowManager({ root: tmp, mainRoot: tmp, inWorktree: false });
  manager.create(state);
  manager.addActiveFlow(SPEC_ID, "branch");
  const active = manager.loadReadOnly();
  const specDir = path.join(tmp, "specs", SPEC_ID);
  const previous = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH, state: active });
  writeRepairFingerprintManifest(specDir, previous);
  writeFile(tmp, `specs/${SPEC_ID}/test-execute-result.json`, JSON.stringify({
    repairFingerprint: previous.hash,
  }, null, 2));
  writeFile(tmp, `specs/${SPEC_ID}/tests/.raw/test-execution.log`, "stale test evidence\n");
  writeFile(tmp, "src/value.js", "export const value = 2;\n");
  const current = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH, state: active });
  return { active, current, manager, previous, specDir };
}

function target() {
  return {
    runId: "run-implementation-revalidation",
    issue: null,
    specId: SPEC_ID,
    stepId: "impl-gate",
    attemptId: "impl-gate-001",
  };
}

describe("implementation revalidation", () => {
  it("derives the normal dependency reset range, retains the repair record, and resumes test-execute", () => {
    const fixture = setupRevalidationFixture();
    const plan = new ImplementationRevalidationPlan({
      target: target(),
      flowState: fixture.active,
      previousFingerprint: fixture.previous.hash,
      currentFingerprint: fixture.current.hash,
      reason: "Implementation changes require authoritative normal Flow revalidation.",
    });

    const result = new ImplementationRevalidation(plan).execute({
      root: tmp,
      state: fixture.active,
      specDir: fixture.specDir,
      flowManager: fixture.manager,
    });

    const expectedReset = flowLeafIdsBetween("test-execute", "finalize-cleanup");
    assert.deepEqual(plan.resetStepIds, expectedReset);
    assert.deepEqual(plan.revalidationPathStepIds, flowLeafIdsBetween("test-execute", "impl-gate"));
    assert.deepEqual(plan.downstreamDependencyStepIds, flowLeafIdsBetween("impl-gate", "finalize-cleanup"));
    assert.deepEqual(result.invalidatedStepIds, expectedReset.filter((stepId) => stepId !== "impl-repair"));
    assert.equal(result.restartStepId, "test-execute");
    assert.ok(result.changedPathCount > 0);
    assert.equal(fs.existsSync(path.join(fixture.specDir, result.changedPathsRef)), true);
    assert.equal(fs.existsSync(path.join(fixture.specDir, "test-execute-result.json")), false);
    assert.equal(fs.existsSync(path.join(fixture.specDir, "tests/.raw/test-execution.log")), false);

    const refreshed = fixture.manager.loadReadOnly();
    for (const stepId of expectedReset) {
      const step = findStepById(refreshed.steps, stepId);
      const expectedStatus = stepId === "test-execute"
        ? "in_progress"
        : stepId === "impl-repair"
          ? "done"
          : "pending";
      assert.equal(step.status, expectedStatus, stepId);
    }
    const ledger = readImplRepairLedger(fixture.specDir);
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.entries[0].id, result.repairEntryId);
    assert.equal(ledger.entries[0].previousHash, fixture.previous.hash);
    assert.equal(ledger.entries[0].currentHash, fixture.current.hash);
    assert.deepEqual(ledger.entries[0].sourceFindingIds, ["test-evidence-refresh:impl-gate"]);
  });

  it("fails closed before mutation when the recovery target is outside the normal dependency range", () => {
    const fixture = setupRevalidationFixture();
    const before = fs.readFileSync(path.join(fixture.specDir, "flow.json"), "utf8");

    assert.throws(() => new ImplementationRevalidationPlan({
      target: { ...target(), stepId: "implement" },
      flowState: fixture.active,
      previousFingerprint: fixture.previous.hash,
      currentFingerprint: fixture.current.hash,
      reason: "Implementation changes require authoritative normal Flow revalidation.",
    }), /outside the normal post-implementation dependency range/);

    assert.equal(fs.readFileSync(path.join(fixture.specDir, "flow.json"), "utf8"), before);
    assert.equal(fs.existsSync(path.join(fixture.specDir, "impl-repair.json")), false);
  });

  it("appends revalidation evidence instead of replacing earlier repair attempts", () => {
    const fixture = setupRevalidationFixture();
    const first = new ImplementationRevalidation(new ImplementationRevalidationPlan({
      target: target(),
      flowState: fixture.active,
      previousFingerprint: fixture.previous.hash,
      currentFingerprint: fixture.current.hash,
      reason: "Implementation changes require authoritative normal Flow revalidation.",
    })).execute({
      root: tmp,
      state: fixture.active,
      specDir: fixture.specDir,
      flowManager: fixture.manager,
    });
    const firstEntry = readImplRepairLedger(fixture.specDir).entries[0].toJSON();
    fixture.manager.mutate((state) => moveFlowToStep(state, "impl-gate"));
    const active = fixture.manager.loadReadOnly();
    const continuationPrevious = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH, state: active });
    assert.equal(continuationPrevious.hash, first.currentFingerprint);
    writeFile(tmp, `specs/${SPEC_ID}/test-execute-result.json`, JSON.stringify({
      repairFingerprint: continuationPrevious.hash,
    }, null, 2));
    writeFile(tmp, `specs/${SPEC_ID}/tests/.raw/test-execution.log`, "replacement stale test evidence\n");
    writeFile(tmp, "src/value.js", "export const value = 3;\n");
    const continuationCurrent = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH, state: active });

    const second = new ImplementationRevalidation(new ImplementationRevalidationPlan({
      target: target(),
      flowState: active,
      previousFingerprint: continuationPrevious.hash,
      currentFingerprint: continuationCurrent.hash,
      reason: "A later implementation change requires fresh normal Flow evidence.",
    })).execute({
      root: tmp,
      state: active,
      specDir: fixture.specDir,
      flowManager: fixture.manager,
    });
    const ledger = readImplRepairLedger(fixture.specDir);

    assert.equal(ledger.entries.length, 2);
    assert.deepEqual(ledger.entries[0].toJSON(), firstEntry);
    assert.notEqual(ledger.entries[1].id, first.repairEntryId);
    assert.equal(ledger.entries[1].id, second.repairEntryId);
    assert.equal(ledger.entries[1].previousHash, continuationPrevious.hash);
    assert.equal(ledger.entries[1].currentHash, continuationCurrent.hash);
  });

  it("fails closed when the target step changes after planning", () => {
    const fixture = setupRevalidationFixture();
    const plan = new ImplementationRevalidationPlan({
      target: target(),
      flowState: fixture.active,
      previousFingerprint: fixture.previous.hash,
      currentFingerprint: fixture.current.hash,
      reason: "Implementation changes require authoritative normal Flow revalidation.",
    });
    fixture.manager.mutate((state) => {
      const step = findStepById(state.steps, "impl-gate");
      step.status = "done";
    });
    const before = fs.readFileSync(path.join(fixture.specDir, "flow.json"), "utf8");

    assert.throws(() => new ImplementationRevalidation(plan).execute({
      root: tmp,
      state: fixture.manager.loadReadOnly(),
      specDir: fixture.specDir,
      flowManager: fixture.manager,
    }), /target step changed/);

    assert.equal(fs.readFileSync(path.join(fixture.specDir, "flow.json"), "utf8"), before);
    assert.equal(fs.existsSync(path.join(fixture.specDir, "impl-repair.json")), false);
  });
});
