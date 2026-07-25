import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import SetStepCommand from "../../../src/flow/lib/set-step.js";
import {
  buildRepairFingerprint,
  commitImplRepairEffects,
  completeImplRepair,
  ImplRepairTransitionIntent,
  prepareImplTriageArtifact,
  recoverImplRepairTransaction,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  ExplicitRecoveryTransition,
  NormalStepTransition,
} from "../../../src/flow/lib/step-transition-policy.js";
import {
  ExternalBlockedOutcome,
  StepAttempt,
} from "../../../src/flow/lib/step-outcome.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";

const SPEC_PATH = "specs/001-test/spec.json";
const GATE_FINDING_ID = "a".repeat(64);

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe("set step impl-repair completion", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("commits only the normal transition when the downstream reset range is empty", async () => {
    tmp = createTmpDir("set-step-impl-repair-empty-reset-");
    writeJson(tmp, SPEC_PATH, { goal: "repair fixture" });
    writeFile(tmp, "src/repair-target.js", "export const value = 'before';\n");
    const previousFingerprint = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH });
    const specDir = path.join(tmp, "specs/001-test");
    writeJson(tmp, "specs/001-test/review-source.json", {
      repairFingerprint: previousFingerprint.hash,
      blockingFindings: [{ findingId: "F-1" }],
      nonBlockingImprovements: [],
    });
    prepareImplTriageArtifact({
      specDir,
      sourceStep: "impl-review",
      sourceArtifact: "review-source.json",
      findings: [{ findingId: "F-1", suggestion: "Update the repair target." }],
      fingerprint: previousFingerprint,
    });
    writeJson(tmp, "specs/001-test/test-execute-result.json", {
      repairFingerprint: previousFingerprint.hash,
    });
    writeJson(tmp, ".senti/config.json", { enabled: true });
    writeFile(tmp, "src/repair-target.js", "export const value = 'after';\n");

    const state = {
      runId: "run-impl-repair-intent-recovery",
      spec: SPEC_PATH,
      steps: [{ id: "impl-repair", status: "in_progress" }],
      tasks: [],
      currentTaskId: null,
    };
    const commits = [];
    const flowManager = {
      load: () => state,
      updateStepStatuses(transitions, options) {
        commits.push({ transitions, options });
        state.steps[0].status = transitions[0].requestedStatus;
      },
    };

    const result = await new SetStepCommand().execute({
      root: tmp,
      flowManager,
      id: "impl-repair",
      status: "done",
    });

    assert.equal(state.steps[0].status, "done");
    assert.equal(commits.length, 1);
    assert.equal(commits[0].transitions.length, 1);
    assert.ok(commits[0].transitions[0] instanceof NormalStepTransition);
    assert.ok(!commits[0].transitions.some((entry) => entry instanceof ExplicitRecoveryTransition));
    assert.deepEqual(commits[0].options, { taskId: null });
    assert.equal(result.id, "impl-repair");
    assert.equal(result.invalidations.length, 1);
    assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);

    const ledger = JSON.parse(fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"));
    assert.equal(ledger.entries.length, 1);
    const issueLog = JSON.parse(fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"));
    assert.equal(issueLog.entries.length, 1);
    assert.equal(issueLog.entries[0].normalizedFindingId, "F-1");
    assert.deepEqual(issueLog.entries[0].repairRef.files, ["src/repair-target.js"]);
  });

  it("recovers post-commit effects from the atomic transition intent", () => {
    tmp = createTmpDir("set-step-impl-repair-intent-recovery-");
    writeJson(tmp, SPEC_PATH, { goal: "repair fixture" });
    writeFile(tmp, "src/repair-target.js", "export const value = 'before';\n");
    const previousFingerprint = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH });
    const specDir = path.join(tmp, "specs/001-test");
    writeJson(tmp, "specs/001-test/review-source.json", {
      repairFingerprint: previousFingerprint.hash,
      blockingFindings: [{ findingId: "F-1" }],
      nonBlockingImprovements: [],
    });
    prepareImplTriageArtifact({
      specDir,
      sourceStep: "impl-review",
      sourceArtifact: "review-source.json",
      findings: [{ findingId: "F-1", suggestion: "Update the repair target." }],
      fingerprint: previousFingerprint,
    });
    writeJson(tmp, "specs/001-test/test-execute-result.json", {
      repairFingerprint: previousFingerprint.hash,
    });
    writeFile(tmp, "src/repair-target.js", "export const value = 'after';\n");

    const state = {
      runId: "run-impl-repair-intent-recovery",
      spec: SPEC_PATH,
      steps: [{ id: "impl-repair", status: "in_progress" }],
      tasks: [],
      currentTaskId: null,
    };
    const completed = completeImplRepair({ root: tmp, state, resetStepIds: [] });
    new ImplRepairTransitionIntent(completed.transaction).applyTo(state);
    state.steps[0].status = "done";
    assert.equal(fs.existsSync(path.join(specDir, "impl-repair-transaction.json")), false);

    const flowManager = {
      load: () => state,
      loadReadOnly: () => state,
      mutate(mutator) { mutator(state); },
      completeStepTransitionIntent(commitIntent) {
        commitIntent.completeIn(state);
      },
    };
    const recovered = recoverImplRepairTransaction({ root: tmp, state, flowManager });

    assert.equal(recovered.entry.id, "repair-001");
    assert.equal(state.implRepairTransaction, undefined);
    assert.equal(fs.existsSync(path.join(specDir, "impl-repair-transaction.json")), false);
    assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);
    const ledger = JSON.parse(fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"));
    assert.equal(ledger.entries.length, 1);
  });

  it("recovers a mechanically blocked gate when an applied finding lacks repair evidence", async () => {
    tmp = createTmpDir("set-step-impl-repair-blocked-gate-");
    writeJson(tmp, SPEC_PATH, { goal: "repair fixture" });
    writeFile(tmp, "src/repair-target.js", "export const value = 'before';\n");
    const previousFingerprint = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH });
    const specDir = path.join(tmp, "specs/001-test");
    writeJson(tmp, "specs/001-test/impl-review.json", {
      repairFingerprint: previousFingerprint.hash,
      blockingFindings: [{ findingId: GATE_FINDING_ID }],
      nonBlockingImprovements: [],
    });
    prepareImplTriageArtifact({
      specDir,
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      findings: [{ findingId: GATE_FINDING_ID, suggestion: "Repair the target." }],
      fingerprint: previousFingerprint,
    });
    writeJson(tmp, "specs/001-test/test-execute-result.json", {
      repairFingerprint: previousFingerprint.hash,
    });
    writeJson(tmp, "specs/001-test/test-result-review.json", {
      repairFingerprint: previousFingerprint.hash,
    });
    writeFile(tmp, "src/repair-target.js", "export const value = 'after';\n");

    const state = moveFlowToStep(makeFlowState({
      runId: "run-blocked-impl-repair",
      spec: SPEC_PATH,
      issue: 7,
      tasks: [],
      currentTaskId: null,
    }), "impl-gate");
    state.stepAttempts = [new StepAttempt({
      runId: state.runId,
      stepId: "impl-gate",
      attempt: 1,
      outcome: new ExternalBlockedOutcome({
        reason: "mechanical",
        resumeInstruction: "Record the missing repair evidence.",
      }),
    })];
    const transitions = [];
    const flowManager = {
      load: () => state,
      loadReadOnly: () => state,
      updateStepStatuses(nextTransitions, _options, intent) {
        transitions.push(...nextTransitions);
        intent.assertBeforeTransition(state);
        for (const transition of nextTransitions) {
          for (const change of transition.changes || []) {
            findStepById(state.steps, change.stepId).status = change.requestedStatus;
          }
        }
        intent.applyTo(state);
      },
      mutate(mutator) {
        mutator(state);
      },
      completeStepTransitionIntent(intent) {
        intent.completeIn(state);
      },
    };

    const result = await new SetStepCommand().execute({
      root: tmp,
      flowManager,
      id: "impl-repair",
      status: "done",
    });

    assert.equal(result.recovered, true);
    assert.deepEqual(result.missingFindingIds, [GATE_FINDING_ID]);
    assert.equal(transitions.length, 1);
    assert.ok(transitions[0] instanceof ExplicitRecoveryTransition);
    assert.equal(findStepById(state.steps, "test-execute").status, "in_progress");
    assert.equal(findStepById(state.steps, "impl-gate").status, "pending");
    const ledger = JSON.parse(fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"));
    assert.deepEqual(ledger.entries[0].sourceFindingIds, [GATE_FINDING_ID]);
    assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);
  });

  it("recovers a gate-observed repair evidence failure after review artifacts were invalidated", async () => {
    tmp = createTmpDir("set-step-impl-repair-gate-evidence-recovery-");
    writeJson(tmp, SPEC_PATH, { goal: "repair fixture" });
    writeFile(tmp, "src/repair-target.js", "export const value = 'before';\n");
    const previousFingerprint = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH });
    const specDir = path.join(tmp, "specs/001-test");
    writeJson(tmp, "specs/001-test/impl-review.json", {
      repairFingerprint: previousFingerprint.hash,
      blockingFindings: [{ findingId: GATE_FINDING_ID }],
      nonBlockingImprovements: [],
    });
    prepareImplTriageArtifact({
      specDir,
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      findings: [{ findingId: GATE_FINDING_ID, suggestion: "Repair the target." }],
      fingerprint: previousFingerprint,
    });
    writeJson(tmp, "specs/001-test/test-execute-result.json", {
      repairFingerprint: previousFingerprint.hash,
    });
    writeJson(tmp, "specs/001-test/test-result-review.json", {
      repairFingerprint: previousFingerprint.hash,
    });
    writeFile(tmp, "src/repair-target.js", "export const value = 'after';\n");

    const state = moveFlowToStep(makeFlowState({
      runId: "run-gate-evidence-recovery",
      spec: SPEC_PATH,
      issue: 7,
      tasks: [],
      currentTaskId: null,
    }), "impl-gate");
    const initialRepair = completeImplRepair({ root: tmp, state, resetStepIds: [] });
    commitImplRepairEffects({ root: tmp, state, transaction: initialRepair.transaction });

    const issueLogPath = path.join(specDir, "issue-log.json");
    const issueLog = JSON.parse(fs.readFileSync(issueLogPath, "utf8"));
    issueLog.entries[0].repairRef = { files: [".senti/config.json"] };
    issueLog.entries.push({
      step: "impl-gate",
      reason: `must-fix finding ${GATE_FINDING_ID} is missing matching repair evidence`,
      timestamp: new Date().toISOString(),
    });
    writeJson(tmp, "specs/001-test/issue-log.json", issueLog);
    fs.rmSync(path.join(specDir, "impl-review.json"), { force: true });
    fs.rmSync(path.join(specDir, "impl-triage.json"), { force: true });

    const currentFingerprint = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH, state });
    writeJson(tmp, "specs/001-test/test-execute-result.json", {
      repairFingerprint: currentFingerprint.hash,
    });
    writeJson(tmp, "specs/001-test/test-result-review.json", {
      repairFingerprint: currentFingerprint.hash,
    });
    writeFile(tmp, "src/repair-evidence-recovery.js", "export const recovered = true;\n");

    state.stepAttempts = [new StepAttempt({
      runId: state.runId,
      stepId: "impl-gate",
      attempt: 1,
      outcome: new ExternalBlockedOutcome({
        reason: "mechanical",
        resumeInstruction: "Record the missing repair evidence.",
      }),
    })];
    const flowManager = {
      load: () => state,
      updateStepStatuses(nextTransitions, _options, intent) {
        intent.assertBeforeTransition(state);
        for (const transition of nextTransitions) {
          for (const change of transition.changes || []) {
            findStepById(state.steps, change.stepId).status = change.requestedStatus;
          }
        }
        intent.applyTo(state);
      },
    };

    const result = await new SetStepCommand().execute({
      root: tmp,
      flowManager,
      id: "impl-repair",
      status: "done",
    });

    assert.equal(result.recovered, true);
    assert.deepEqual(result.missingFindingIds, [GATE_FINDING_ID]);
    const repairedLog = JSON.parse(fs.readFileSync(issueLogPath, "utf8"));
    assert.deepEqual(repairedLog.entries.at(-1).repairRef.files, ["src/repair-evidence-recovery.js"]);
  });
});
