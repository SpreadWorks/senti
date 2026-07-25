// spec: R6
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import {
  buildRepairFingerprint,
  prepareImplTriageArtifact,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import * as reviewConvergence from "../../../src/flow/lib/review-convergence.js";
import {
  ExternalBlockedOutcome,
  StepAttempt,
} from "../../../src/flow/lib/step-outcome.js";
import { flowLeafIdsBetween } from "../../../src/flow/definition.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowState, moveFlowToStep } from "../../../tests/helpers/flow-setup.js";

const SPEC_PATH = "specs/338-active-flow-registry-race/spec.json";
const FINDING_ID = "a".repeat(64);
const SECOND_FINDING_ID = "b".repeat(64);
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeTmpDir(root);
});

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function completeRecoveryTransition(state, transitions) {
  for (const transition of transitions) {
    for (const change of transition.changes || []) {
      findStepById(state.steps, change.stepId).status = change.requestedStatus;
    }
  }
}

test("R6: bounded repair and semantic review recovery invalidate only stale current-flow evidence", async () => {
  const root = createTmpDir("spec-338-bounded-recovery-");
  roots.push(root);
  writeJson(root, SPEC_PATH, { goal: "bounded recovery fixture" });
  writeFile(root, "src/repair-target.js", "export const value = 'before';\n");
  const previousFingerprint = buildRepairFingerprint({ root, specPath: SPEC_PATH });
  const specDir = path.join(root, "specs/338-active-flow-registry-race");
  writeJson(root, "specs/338-active-flow-registry-race/impl-review.json", {
    repairFingerprint: previousFingerprint.hash,
    blockingFindings: [{ findingId: FINDING_ID }],
    nonBlockingImprovements: [],
  });
  prepareImplTriageArtifact({
    specDir,
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    findings: [{ findingId: FINDING_ID, suggestion: "Repair the target." }],
    fingerprint: previousFingerprint,
  });
  writeJson(root, "specs/338-active-flow-registry-race/test-execute-result.json", {
    repairFingerprint: previousFingerprint.hash,
  });
  writeJson(root, "specs/338-active-flow-registry-race/test-result-review.json", {
    repairFingerprint: previousFingerprint.hash,
  });
  writeFile(root, "src/repair-target.js", "export const value = 'after';\n");

  const state = moveFlowToStep(makeFlowState({
    runId: "run-spec-338-bounded-recovery",
    spec: SPEC_PATH,
    issue: 461,
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
  const draftStatusBeforeRecovery = findStepById(state.steps, "draft").status;
  const issueBeforeRecovery = state.issue;
  const leafStatusesBeforeRecovery = new Map(
    flattenSteps(state.steps).map((step) => [step.id, step.status]),
  );
  const flowManager = {
    load: () => state,
    loadReadOnly: () => state,
    updateStepStatus(transition, _options, intent) {
      intent?.assertBeforeTransition(state);
      completeRecoveryTransition(state, [transition]);
      intent?.applyTo(state);
    },
    updateStepStatuses(transitions, _options, intent) {
      intent?.assertBeforeTransition(state);
      completeRecoveryTransition(state, transitions);
      intent?.applyTo(state);
    },
    mutate(mutator) { mutator(state); },
    saveAtomic(nextState) {
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, nextState);
    },
    completeStepTransitionIntent(intent) { intent.completeIn(state); },
  };

  const repair = await new SetStepCommand().execute({
    root,
    flowManager,
    id: "impl-repair",
    status: "done",
  });

  assert.equal(repair.id, "impl-repair");
  assert.deepEqual(repair.missingFindingIds, [FINDING_ID]);
  assert.equal(findStepById(state.steps, "test-execute").status, "in_progress");
  assert.equal(findStepById(state.steps, "impl-gate").status, "pending");
  const recoveredLeaves = flattenSteps(state.steps);
  const resetStepIds = new Set(flowLeafIdsBetween("test-execute", "finalize-cleanup"));
  for (const step of recoveredLeaves) {
    const expected = step.id === "impl-repair"
      ? "done"
      : resetStepIds.has(step.id)
        ? step.id === "test-execute" ? "in_progress" : "pending"
        : leafStatusesBeforeRecovery.get(step.id);
    assert.equal(step.status, expected, `recovery status for ${step.id}`);
  }
  assert.equal(findStepById(state.steps, "draft").status, draftStatusBeforeRecovery);
  assert.equal(state.issue, issueBeforeRecovery);
  assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);
  const postRecoveryNextAction = await new GetNextActionCommand().execute({
    root,
    flowState: state,
    flowManager,
  });
  assert.equal(postRecoveryNextAction.step, "test-execute");
  assert.equal(postRecoveryNextAction.action, "run-test-execute");
  assert.deepEqual(
    JSON.parse(fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8")).entries[0].sourceFindingIds,
    [FINDING_ID],
  );
  const repairLedgerAfterRecovery = fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8");

  const repeatedRecovery = await new SetStepCommand().execute({
    root,
    flowManager,
    id: "impl-repair",
    status: "done",
  });
  assert.equal(repeatedRecovery.ok, false);
  assert.equal(repeatedRecovery.errors[0].code, "FLOW_STEP_TRANSITION_INVALID");

  const currentFingerprint = buildRepairFingerprint({ root, specPath: SPEC_PATH });
  const rawOutputPath = "specs/338-active-flow-registry-race/tests/.raw/test-execution.log";
  writeFile(root, rawOutputPath, "R6 recovery evidence refreshed\n");
  writeJson(root, "specs/338-active-flow-registry-race/test-execute-result.json", {
    version: "2",
    raw_output_path: rawOutputPath,
    summary: [],
    regression: {
      required: false,
      result: "skipped",
      mode: "none",
      category: "spec-artifact-only",
      reason: "bounded recovery fixture does not run project regression",
      classified_paths: [],
      changed_files: [],
      trigger_relevant_changed_files: [],
    },
    repairFingerprint: currentFingerprint.hash,
  });
  writeJson(root, "specs/338-active-flow-registry-race/test-result-review.json", {
    verdict: "pass",
    checked_items: [{
      check: "project_regression_verification",
      result: "pass",
      detail: "bounded recovery fixture permits the next review gate evaluation",
    }],
    result_file_path: "specs/338-active-flow-registry-race/test-execute-result.json",
    raw_output_path: rawOutputPath,
    repairFingerprint: currentFingerprint.hash,
  });

  // test-execute and test-result-review are lifecycle-owned steps. Their own
  // runners advance them; this fixture verifies the recovery boundary and
  // models that one subsequent evaluation path reaches the integration gate.
  moveFlowToStep(state, "impl-gate");
  assert.equal(findStepById(state.steps, "test-execute").status, "done");
  assert.equal(findStepById(state.steps, "test-result-review").status, "done");
  assert.equal(findStepById(state.steps, "impl-review").status, "done");
  assert.equal(findStepById(state.steps, "impl-gate").status, "in_progress");
  writeFile(root, "src/repair-target.js", "export const value = 'after-second-current-triage';\n");
  const secondFingerprint = buildRepairFingerprint({ root, specPath: SPEC_PATH });
  writeJson(root, "specs/338-active-flow-registry-race/test-execute-result.json", {
    repairFingerprint: secondFingerprint.hash,
  });
  writeJson(root, "specs/338-active-flow-registry-race/test-result-review.json", {
    repairFingerprint: secondFingerprint.hash,
  });
  writeJson(root, "specs/338-active-flow-registry-race/impl-review.json", {
    repairFingerprint: secondFingerprint.hash,
    blockingFindings: [{ findingId: SECOND_FINDING_ID }],
    nonBlockingImprovements: [],
  });
  prepareImplTriageArtifact({
    specDir,
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    findings: [{ findingId: SECOND_FINDING_ID, suggestion: "Record the second repair." }],
    fingerprint: secondFingerprint,
  });
  state.stepAttempts = [new StepAttempt({
    runId: state.runId,
    stepId: "impl-gate",
    attempt: 2,
    outcome: new ExternalBlockedOutcome({
      reason: "mechanical",
      resumeInstruction: "Do not recover the current triage finding twice.",
    }),
  })];
  const laterCurrentTriageRecovery = await new SetStepCommand().execute({
    root,
    flowManager,
    id: "impl-repair",
    status: "done",
  });
  assert.equal(laterCurrentTriageRecovery.ok, false);
  assert.equal(laterCurrentTriageRecovery.errors[0].code, "IMPL_REPAIR_RECOVERY_UNAVAILABLE");
  assert.equal(
    fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"),
    repairLedgerAfterRecovery,
  );
  assert.equal(findStepById(state.steps, "impl-gate").status, "in_progress");

  writeJson(root, "specs/338-active-flow-registry-race/impl-review.json", {
    repairFingerprint: secondFingerprint.hash,
    blockingFindings: [{ findingId: FINDING_ID }],
    nonBlockingImprovements: [],
  });
  prepareImplTriageArtifact({
    specDir,
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    findings: [{ findingId: FINDING_ID, suggestion: "Repair the original target." }],
    fingerprint: secondFingerprint,
  });
  writeJson(root, "specs/338-active-flow-registry-race/issue-log.json", {
    entries: [{
      reason: `must-fix finding ${FINDING_ID} is missing matching repair evidence`,
    }],
  });
  const laterRecovery = await new SetStepCommand().execute({
    root,
    flowManager,
    id: "impl-repair",
    status: "done",
  });
  assert.equal(laterRecovery.ok, false);
  assert.equal(laterRecovery.errors[0].code, "IMPL_REPAIR_RECOVERY_UNAVAILABLE");
  assert.equal(
    fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"),
    repairLedgerAfterRecovery,
  );
  assert.equal(findStepById(state.steps, "impl-gate").status, "in_progress");

  const previousTreeSha = "4".repeat(40);
  const nextTreeSha = "5".repeat(40);
  const reviewState = {
    runId: "run-spec-338-semantic",
    spec: SPEC_PATH,
    reviewConvergence: {
      version: 1,
      records: [{
        phase: "spec",
        taskId: null,
        treeSha: previousTreeSha,
        semanticAttempts: 1,
        semanticMaxAttempts: 1,
        toolingAttempts: 0,
        toolingMaxAttempts: 1,
        evidence: { evidenceId: "6".repeat(64), disposition: "REJECTED" },
        finalizedEvidenceAvailable: true,
        handoffFindings: [],
        blocker: null,
        toolingOutcome: null,
        provider: "independent-reviewer",
        targetStateDigest: "7".repeat(64),
      }, {
        phase: "draft",
        taskId: null,
        treeSha: "8".repeat(40),
        semanticAttempts: 0,
        semanticMaxAttempts: 1,
        toolingAttempts: 0,
        toolingMaxAttempts: 1,
        evidence: null,
        finalizedEvidenceAvailable: false,
        handoffFindings: [],
        blocker: null,
        toolingOutcome: null,
        provider: "independent-reviewer",
        targetStateDigest: "9".repeat(64),
      }],
    },
  };
  const unrelatedReviewRecord = structuredClone(reviewState.reviewConvergence.records[1]);
  assert.equal(typeof reviewConvergence.ReviewSemanticRecoveryMutation, "function");
  const reviewStateBeforeSameTreeRecovery = structuredClone(reviewState.reviewConvergence.records[0]);
  assert.throws(() => new reviewConvergence.ReviewSemanticRecoveryMutation({
    phase: "spec",
    taskId: null,
    previousTreeSha,
    nextTreeSha: previousTreeSha,
    expectedRunId: reviewState.runId,
    expectedSpec: SPEC_PATH,
  }).apply(reviewState), /requires a changed tree identity/);
  assert.deepEqual(reviewState.reviewConvergence.records[0], reviewStateBeforeSameTreeRecovery);
  new reviewConvergence.ReviewSemanticRecoveryMutation({
    phase: "spec",
    taskId: null,
    previousTreeSha,
    nextTreeSha,
    expectedRunId: reviewState.runId,
    expectedSpec: SPEC_PATH,
  }).apply(reviewState);

  const recovered = reviewState.reviewConvergence.records[0];
  assert.equal(recovered.treeSha, nextTreeSha);
  assert.equal(recovered.semanticAttempts, 0);
  assert.equal(recovered.evidence, null);
  assert.equal(recovered.finalizedEvidenceAvailable, false);
  assert.deepEqual(recovered.handoffFindings, []);
  assert.deepEqual(reviewState.reviewConvergence.records[1], unrelatedReviewRecord);

  const reevaluation = reviewConvergence.applyReviewEvidenceTransition(
    reviewState,
    new reviewConvergence.ReviewEvidence({
      phase: "spec",
      taskId: null,
      treeSha: nextTreeSha,
      provenance: {
        provider: "spec-338-fixture",
        invocationId: "one-permitted-semantic-reevaluation",
        capturedAt: "2026-07-25T00:00:00.000Z",
      },
      disposition: new reviewConvergence.ReviewDisposition({
        value: "REJECTED",
        blockingFindings: [new reviewConvergence.ReviewFinding({
          findingId: "R6-one-permitted-semantic-reevaluation",
          summary: "The permitted semantic re-evaluation remains rejected.",
          fingerprint: "b".repeat(64),
          evidenceRefs: ["bounded-recovery.test.js"],
        })],
      }),
    }),
  );
  assert.equal(reevaluation.semanticAttempts, 1);
  assert.equal(reevaluation.remainingSemanticAttempts, 0);
  const reviewStateAfterReevaluation = structuredClone(reviewState.reviewConvergence.records[0]);
  assert.throws(() => new reviewConvergence.ReviewSemanticRecoveryMutation({
    phase: "spec",
    taskId: null,
    previousTreeSha,
    nextTreeSha,
    expectedRunId: reviewState.runId,
    expectedSpec: SPEC_PATH,
  }).apply(reviewState), /review recovery previous target no longer exists/);
  assert.deepEqual(reviewState.reviewConvergence.records[0], reviewStateAfterReevaluation);
});
