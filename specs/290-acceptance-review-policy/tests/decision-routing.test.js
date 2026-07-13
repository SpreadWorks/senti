// spec: R10 R11 R12
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

const CLI = join(process.cwd(), "src/senti.js");

function runCli(tmp, args, extraEnv = {}) {
  try {
    const stdout = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, ...extraEnv },
    });
    return { envelope: JSON.parse(stdout), exitCode: 0 };
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    return { envelope: stdout ? JSON.parse(stdout) : null, exitCode: err.status || 1 };
  }
}

function setupFlow(tmp, acceptanceReview, options = {}) {
  const specId = "001-test";
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({ requirements: [] }, null, 2));
  if (options.prewriteArtifact !== false) {
    fs.writeFileSync(path.join(specDir, "acceptance-review.json"), JSON.stringify(acceptanceReview, null, 2));
  }

  const state = {
    spec: `specs/${specId}/spec.json`,
    runId: `run-${specId}`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    acceptanceReview: options.prepopulateState === false ? undefined : {
      verdict: acceptanceReview.verdict,
      artifactPath: `specs/${specId}/acceptance-review.json`,
    },
  };
  for (const step of state.steps.flatMap((entry) => entry.children || [entry])) {
    step.status = "pending";
  }
  for (const id of options.doneSteps || []) {
    findStepById(state.steps, id).status = "done";
  }
  findStepById(state.steps, "acceptance-review").status = "in_progress";

  const fm = makeFlowManager(tmp);
  fm.create(state);
  fm.addActiveFlow(specId, "local");
}

function artifact(overrides = {}) {
  return {
    version: 1,
    goalSatisfactionScore: 1,
    requirementAlignmentScore: 1,
    implementationQualityScore: 1,
    acceptanceScore: 1,
    thresholds: {
      goalSatisfactionPass: 0.9,
      requirementAlignmentPass: 0.9,
      implementationQualityPass: 0.8,
    },
    verdict: "amend_required",
    mechanicalBlockers: [],
    hardBlockers: [],
    attempt: 1,
    findings: [{
      findingId: "F-1",
      summary: "Goal gap",
      severity: "blocking",
      category: "goal_gap",
      mappedRequirementIds: ["R3"],
      linkedRequirementAmendmentProposalIds: ["P-1"],
      evidenceRefs: ["spec:R3"],
      confidence: "high",
      shouldReimplement: true,
      reimplementationReason: "The flow must be rerun after amendment.",
      requiresUserDecision: false,
    }],
    requirementAmendmentProposals: [{
      proposalId: "P-1",
      proposalType: "modify_requirement",
      targetRequirementIds: ["R3"],
      proposedRequirementSummary: "Amend the spec.",
      reason: "Acceptance-review detected a goal gap.",
      relationToOriginalRequest: "direct",
      linkedFindingIds: ["F-1"],
      shouldReimplementAfterAmendment: true,
    }],
    userDecision: null,
    blockedDecision: null,
    repairTargetStep: null,
    ...overrides,
  };
}

describe("acceptance-review decision routing", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R10: amend_required records proposals and resets spec through acceptance-review without mutating spec.json", () => {
    tmp = createTmpDir();
    const reviewArtifact = artifact();
    const fixturePath = path.join(tmp, "acceptance-review-fixture.json");
    fs.writeFileSync(fixturePath, JSON.stringify(reviewArtifact, null, 2));
    setupFlow(tmp, reviewArtifact, {
      prewriteArtifact: false,
      prepopulateState: false,
      doneSteps: ["spec", "approval", "test", "scenario-validity", "test-review", "implement", "test-execute", "test-result-review", "impl-review", "impl-gate", "retro"],
    });
    const beforeSpec = fs.readFileSync(path.join(tmp, "specs", "001-test", "spec.json"), "utf8");

    const { envelope, exitCode } = runCli(tmp, ["flow", "run", "acceptance-review"], {
      SENTI_ACCEPTANCE_REVIEW_ARTIFACT: fixturePath,
    });
    assert.equal(exitCode, 0);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.verdict, "amend_required");
    assert.equal(fs.existsSync(path.join(tmp, "specs", "001-test", "acceptance-review.json")), true);

    const state = makeFlowManager(tmp).load();
    assert.equal(state.acceptanceReview.verdict, "amend_required");
    assert.equal(state.acceptanceReview.requirementAmendmentProposals.length, 1);
    for (const id of ["spec", "approval", "test", "scenario-validity", "test-review", "implement", "test-execute", "test-result-review", "impl-review", "impl-gate", "retro", "acceptance-review"]) {
      assert.equal(findStepById(state.steps, id).status, "pending", `${id} reset to pending`);
    }
    assert.notEqual(findStepById(state.steps, "approval").status, "in_progress");
    assert.equal(fs.readFileSync(path.join(tmp, "specs", "001-test", "spec.json"), "utf8"), beforeSpec);
  });

  it("R10: approval routing distinguishes amend_required from user_decision_required", () => {
    tmp = createTmpDir();
    const decisionRequired = artifact({
      verdict: "user_decision_required",
      findings: [artifact().findings[0], {
        ...artifact().findings[0],
        findingId: "F-2",
        linkedRequirementAmendmentProposalIds: [],
        requiresUserDecision: true,
      }],
      requirementAmendmentProposals: [],
    });
    const fixturePath = path.join(tmp, "acceptance-review-user-decision.json");
    fs.writeFileSync(fixturePath, JSON.stringify(decisionRequired, null, 2));
    setupFlow(tmp, decisionRequired, {
      prewriteArtifact: false,
      prepopulateState: false,
      doneSteps: ["spec", "approval", "test", "scenario-validity", "test-review", "implement", "test-execute", "test-result-review", "impl-review", "impl-gate", "retro"],
    });

    const { envelope, exitCode } = runCli(tmp, ["flow", "run", "acceptance-review"], {
      SENTI_ACCEPTANCE_REVIEW_ARTIFACT: fixturePath,
    });
    assert.equal(exitCode, 0);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.verdict, "user_decision_required");

    const state = makeFlowManager(tmp).load();
    assert.equal(state.acceptanceReview.verdict, "user_decision_required");
    assert.equal(findStepById(state.steps, "spec").status, "done");
    assert.equal(findStepById(state.steps, "approval").status, "done");
    assert.equal(findStepById(state.steps, "acceptance-review").status, "in_progress");
  });

  it("R11: user_decision_required supports amend_and_retry", () => {
    tmp = createTmpDir();
    setupFlow(tmp, artifact({ verdict: "user_decision_required" }), {
      doneSteps: ["spec", "approval", "test", "scenario-validity", "test-review", "implement", "test-execute", "test-result-review", "impl-review", "impl-gate", "retro"],
    });

    const { envelope, exitCode } = runCli(tmp, [
      "flow",
      "set",
      "acceptance-decision",
      "--choice",
      "amend_and_retry",
    ]);
    assert.equal(exitCode, 0);
    assert.equal(envelope.ok, true);

    const state = makeFlowManager(tmp).load();
    assert.equal(state.acceptanceReview.userDecision.choice, "amend_and_retry");
    for (const id of ["spec", "approval", "test", "scenario-validity", "test-review", "implement", "test-execute", "test-result-review", "impl-review", "impl-gate", "retro", "acceptance-review"]) {
      assert.equal(findStepById(state.steps, id).status, "pending", `${id} reset to pending`);
    }
  });

  it("R11: user_decision_required supports abort", () => {
    tmp = createTmpDir();
    setupFlow(tmp, artifact({ verdict: "user_decision_required" }));

    const { envelope, exitCode } = runCli(tmp, [
      "flow",
      "set",
      "acceptance-decision",
      "--choice",
      "abort",
    ]);
    assert.equal(exitCode, 0);
    assert.equal(envelope.ok, true);

    const state = makeFlowManager(tmp).load();
    assert.equal(state.acceptanceReview.userDecision.choice, "abort");
    assert.equal(state.acceptanceReview.status, "aborted");
    assert.notEqual(findStepById(state.steps, "final-regression").status, "in_progress");
  });

  it("R11: user_decision_required persists accepted risk and records issue-log evidence", () => {
    tmp = createTmpDir();
    setupFlow(tmp, artifact({ verdict: "user_decision_required" }));

    const { envelope, exitCode } = runCli(tmp, [
      "flow",
      "set",
      "acceptance-decision",
      "--choice",
      "accept_risk_and_continue",
    ]);
    assert.equal(exitCode, 0);
    assert.equal(envelope.ok, true);

    const state = makeFlowManager(tmp).load();
    assert.equal(state.acceptanceReview.userDecision.choice, "accept_risk_and_continue");
    assert.equal(findStepById(state.steps, "final-regression").status, "in_progress");
    const issueLog = JSON.parse(fs.readFileSync(path.join(tmp, "specs", "001-test", "issue-log.json"), "utf8"));
    assert.equal(
      issueLog.entries.some((entry) => /accept_risk_and_continue/.test(entry.reason)),
      true,
    );
  });

  it("R11: user_decision_required rejects accepted risk when mechanicalBlockers exist", () => {
    tmp = createTmpDir();
    setupFlow(tmp, artifact({
      verdict: "user_decision_required",
      mechanicalBlockers: [{ blockerId: "M-1", kind: "missing_tests", summary: "Tests missing." }],
    }));

    const rejected = runCli(tmp, [
      "flow",
      "set",
      "acceptance-decision",
      "--choice",
      "accept_risk_and_continue",
    ]);
    assert.notEqual(rejected.exitCode, 0);
    assert.equal(rejected.envelope.ok, false);
  });

  it("R12: blocked accepts only repair_and_reevaluate or abort decisions", () => {
    tmp = createTmpDir();
    setupFlow(tmp, artifact({
      verdict: "blocked",
      mechanicalBlockers: [{ blockerId: "M-1", kind: "failed_tests", summary: "Tests failed." }],
      repairTargetStep: "implement",
    }), {
      doneSteps: ["implement", "test-execute", "test-result-review", "impl-review", "impl-gate", "retro"],
    });

    const rejected = runCli(tmp, [
      "flow",
      "set",
      "acceptance-decision",
      "--choice",
      "accept_risk_and_continue",
    ]);
    assert.notEqual(rejected.exitCode, 0);
    assert.equal(rejected.envelope.ok, false);

    const accepted = runCli(tmp, [
      "flow",
      "set",
      "acceptance-decision",
      "--choice",
      "repair_and_reevaluate",
    ]);
    assert.equal(accepted.exitCode, 0);
    assert.equal(accepted.envelope.ok, true);

    const state = makeFlowManager(tmp).load();
    assert.equal(state.acceptanceReview.blockedDecision.choice, "repair_and_reevaluate");
    assert.equal(findStepById(state.steps, "implement").status, "in_progress");
    for (const id of ["test-execute", "test-result-review", "impl-review", "impl-gate", "retro", "acceptance-review"]) {
      assert.equal(findStepById(state.steps, id).status, "pending", `${id} reset to pending`);
    }
  });

  it("R12: blocked abort records aborted state without promoting final-regression", () => {
    tmp = createTmpDir();
    setupFlow(tmp, artifact({
      verdict: "blocked",
      mechanicalBlockers: [{ blockerId: "M-1", kind: "missing_artifact", summary: "Artifact missing." }],
      repairTargetStep: "test-execute",
    }));

    const { envelope, exitCode } = runCli(tmp, [
      "flow",
      "set",
      "acceptance-decision",
      "--choice",
      "abort",
    ]);
    assert.equal(exitCode, 0);
    assert.equal(envelope.ok, true);

    const state = makeFlowManager(tmp).load();
    assert.equal(state.acceptanceReview.blockedDecision.choice, "abort");
    assert.equal(state.acceptanceReview.status, "aborted");
    assert.notEqual(findStepById(state.steps, "final-regression").status, "in_progress");
  });
});
