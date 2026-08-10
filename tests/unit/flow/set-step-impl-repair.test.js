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
  DefinitionLifecycleTransition,
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
    writeJson(tmp, ".sennel/config.json", { enabled: true });
    writeFile(tmp, "src/repair-target.js", "export const value = 'after';\n");

    const state = {
      runId: "run-impl-repair-intent-recovery",
      specId: "001-test",
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
    assert.equal(fs.existsSync(path.join(specDir, "issue-log.json")), false);
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
      specId: "001-test",
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
      phase: "integration",
      reviewedTree: previousFingerprint.hash,
      reviewedHead: "b".repeat(40),
      blockingFindings: [{ findingId: GATE_FINDING_ID, fingerprint: GATE_FINDING_ID }],
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
      summary: [{ id: "focused", result: "pass" }],
    });
    writeJson(tmp, "specs/001-test/test-result-review.json", {
      repairFingerprint: previousFingerprint.hash,
      verdict: "pass",
    });
    writeJson(tmp, "specs/001-test/impl-gate-result.json", {
      repairFingerprint: previousFingerprint.hash,
    });
    writeFile(tmp, "src/repair-target.js", "export const value = 'after';\n");

    const state = moveFlowToStep(makeFlowState({
      runId: "run-blocked-impl-repair",
      specId: "001-test",
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
    assert.equal(findStepById(state.steps, "test-execute").status, "done");
    assert.equal(findStepById(state.steps, "impl-gate").status, "pending");
    const ledger = JSON.parse(fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"));
    assert.deepEqual(ledger.entries[0].sourceFindingIds, [GATE_FINDING_ID]);
    assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), true);
    assert.equal(fs.existsSync(path.join(specDir, "test-result-review.json")), true);
    assert.equal(fs.existsSync(path.join(specDir, "impl-gate-result.json")), false);
    const issueLog = JSON.parse(fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"));
    assert.equal(issueLog.entries.at(-1).findingFingerprint, GATE_FINDING_ID);
    assert.equal(issueLog.entries.at(-1).reviewedTree, previousFingerprint.hash);
    assert.equal(issueLog.entries.at(-1).validatingTestResult.status, "pass");
  });

  it("fails closed when a gate-observed recovery no longer has canonical review evidence", async () => {
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
      specId: "001-test",
      issue: 7,
      tasks: [],
      currentTaskId: null,
    }), "impl-gate");
    const initialRepair = completeImplRepair({ root: tmp, state, resetStepIds: [] });
    commitImplRepairEffects({ root: tmp, state, transaction: initialRepair.transaction });

    const issueLogPath = path.join(specDir, "issue-log.json");
    const issueLog = { entries: [{
      normalizedFindingId: GATE_FINDING_ID,
      repairRef: { files: [".sennel/config.json"] },
      step: "impl-repair",
      reason: "stale repair proof fixture",
      timestamp: new Date().toISOString(),
    }, {
      step: "impl-gate",
      reason: `must-fix finding ${GATE_FINDING_ID} is missing matching repair evidence`,
      timestamp: new Date().toISOString(),
    }] };
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

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "IMPL_REPAIR_RECOVERY_FAILED");
    assert.match(result.errors[0].messages[0], /impl-review\.json/);
  });
});

describe("set step impl-triage completion", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("skips lifecycle actions whose target is already terminal", async () => {
    tmp = createTmpDir("set-step-impl-triage-terminal-target-");
    writeJson(tmp, SPEC_PATH, { goal: "triage fixture" });
    writeFile(tmp, "src/triage-target.js", "export const value = 'before';\n");
    const fingerprint = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH });
    const specDir = path.join(tmp, "specs/001-test");
    writeJson(tmp, "specs/001-test/impl-review.json", {
      repairFingerprint: fingerprint.hash,
      blockingFindings: [],
      nonBlockingImprovements: [{ findingId: "F-1", suggestion: "No repair needed." }],
    });
    const prepared = prepareImplTriageArtifact({
      specDir,
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      findings: [{ findingId: "F-1", decision: "reject", suggestion: "No repair needed." }],
      fingerprint,
    });
    prepared.artifact.items[0].decision = "reject";
    writeJson(tmp, "specs/001-test/impl-triage.json", prepared.artifact);

    const state = {
      runId: "run-impl-triage-terminal-target",
      specId: "001-test",
      steps: [
        { id: "impl-triage", status: "in_progress" },
        { id: "impl-repair", status: "done" },
        { id: "impl-gate", status: "pending" },
      ],
      tasks: [],
      currentTaskId: null,
    };
    const commits = [];
    const flowManager = {
      load: () => state,
      updateStepStatuses(transitions, options) {
        commits.push({ transitions, options });
        for (const transition of transitions) {
          findStepById(state.steps, transition.stepId).status = transition.requestedStatus;
        }
      },
    };

    const result = await new SetStepCommand().execute({
      root: tmp,
      flowManager,
      id: "impl-triage",
      status: "done",
    });

    assert.equal(result.next, "impl-gate");
    assert.deepEqual(commits[0].transitions.map((transition) => [
      transition.stepId,
      transition.requestedStatus,
    ]), [
      ["impl-triage", "done"],
      ["impl-gate", "in_progress"],
    ]);
    assert.ok(commits[0].transitions[1] instanceof DefinitionLifecycleTransition);
    assert.equal(findStepById(state.steps, "impl-triage").status, "done");
    assert.equal(findStepById(state.steps, "impl-repair").status, "done");
    assert.equal(findStepById(state.steps, "impl-gate").status, "in_progress");
  });
});
