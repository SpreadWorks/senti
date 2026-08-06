import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { findActiveNode } from "../../../src/flow/definition.js";
import { NextActionPlanner } from "../../../src/flow/lib/get-next-action.js";
import { ReviewTargetAuthority } from "../../../src/flow/lib/review-target-authority.js";
import RunRepairTestReviewCommand from "../../../src/flow/lib/run-repair-test-review.js";
import {
  findStepById,
  flattenSteps,
} from "../../../src/flow/lib/step-tree.js";
import {
  TestReviewRepairCompletion,
  TestReviewRepairRecord,
} from "../../../src/flow/lib/test-review-repair.js";
import {
  sealWorkerArtifactHandoff,
  WorkerArtifactHandoffCoordinator,
  WorkerArtifactHandoffError,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { validWorkerHandoffSpec } from "../../helpers/worker-artifact.js";

const SPEC_ID = "500-test-review-repair";
const RUN_ID = "run-test-review-repair";
const SOURCE_REVISION = "1".repeat(64);
const EVIDENCE_ID = "2".repeat(64);
const FINDING_ID = "3".repeat(64);
const ADVISORY_FINDING_ID = "4".repeat(64);

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function initGit(root) {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: root });
  fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
  execFileSync("git", ["add", "README.md"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: root });
}

function blockingFinding(overrides = {}) {
  return {
    kind: "blocking",
    title: "The test does not exercise the required behavior.",
    target: "tests/review-repair.test.js",
    findingId: FINDING_ID,
    fingerprint: FINDING_ID,
    disposition: "must-fix",
    rationale: "Implementation cannot proceed with a self-fulfilling assertion.",
    issue: "The assertion proves its own fixture.",
    requiredChange: "Exercise the declared public behavior.",
    whyBlocking: "The current test cannot detect an incorrect implementation.",
    ...overrides,
  };
}

function advisoryFinding(overrides = {}) {
  return {
    kind: "advisory",
    title: "Add a boundary assertion for the repaired behavior.",
    target: "tests/review-repair.test.js",
    findingId: ADVISORY_FINDING_ID,
    fingerprint: ADVISORY_FINDING_ID,
    disposition: "informational",
    rationale: "The existing test is sufficient to block the known regression.",
    improvement: "Add a boundary assertion for the repaired behavior.",
    whyNonBlocking: "The current test still exercises the required behavior.",
    ...overrides,
  };
}

function testSource(label = "original premise") {
  return [
    "// spec: R1",
    "import assert from 'node:assert/strict';",
    "import test from 'node:test';",
    `test('R1: ${label}', () => assert.fail('not implemented'));`,
    "",
  ].join("\n");
}

function fixture({ worktree = false, mixedFindings = false } = {}) {
  const root = createTmpDir("test-review-repair-");
  initGit(root);
  const executionRoot = worktree ? path.join(root, "execution") : root;
  if (worktree) {
    execFileSync("git", ["worktree", "add", "-q", "-b", "feature/test-review-repair", executionRoot], {
      cwd: root,
    });
  }
  const state = moveFlowToStep(makeFlowState({
    specId: SPEC_ID,
    runId: RUN_ID,
    issue: 500,
    request: "Repair rejected spec-local tests through canonical handoff authority.",
    worktree,
    baseBranch: "main",
    featureBranch: worktree ? "feature/test-review-repair" : "main",
    metrics: [{ phase: "test", counter: "reviewRetry", delta: 1, taskId: null }],
    specTestArtifactRevision: {
      version: 1,
      runId: RUN_ID,
      specId: SPEC_ID,
      stepId: "test",
      digest: SOURCE_REVISION,
      byteLength: 100,
      finalizedAt: "2026-08-05T00:00:00.000Z",
    },
  }), "test-review");
  const flowManager = new FlowManager({
    root: executionRoot,
    mainRoot: root,
    inWorktree: worktree,
    specId: SPEC_ID,
  });
  flowManager.create(state);
  const specDir = path.join(root, "specs", SPEC_ID);
  const testsDir = path.join(specDir, "tests");
  fs.mkdirSync(testsDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), json(validWorkerHandoffSpec()));
  fs.writeFileSync(path.join(testsDir, "review-repair.test.js"), testSource());
  fs.writeFileSync(path.join(specDir, "scenario-validity-result.json"), json({
    version: "1",
    result: "pass",
  }));
  fs.writeFileSync(path.join(specDir, "test-coverage.json"), json({
    version: 1,
    phase: "test-review",
    requirements: [{ id: "R1", status: "covered" }],
  }));
  const advisoryFindings = mixedFindings ? [advisoryFinding()] : [];
  fs.writeFileSync(path.join(specDir, "test-review.json"), json({
    version: 1,
    phase: "test",
    verdict: "REJECTED",
    counts: { blocking: 1, advisory: advisoryFindings.length, total: 1 + advisoryFindings.length },
    coverageArtifact: `specs/${SPEC_ID}/test-coverage.json`,
    sourceTestArtifactRevision: state.specTestArtifactRevision,
    blockingFindings: [blockingFinding()],
    advisoryFindings,
  }));
  const current = flowManager.load();
  const authority = new ReviewTargetAuthority({
    executionRoot,
    artifactRoot: root,
    flowState: current,
  });
  const treeSha = authority.resolveTreeSha();
  const targetState = authority.captureTargetStateForPhase("test");
  flowManager.mutate((flow) => {
    flow.reviewConvergence = {
      version: 1,
      records: [{
        phase: "test",
        taskId: null,
        treeSha,
        semanticAttempts: 1,
        semanticMaxAttempts: 5,
        toolingAttempts: 0,
        toolingMaxAttempts: 1,
        evidence: { evidenceId: EVIDENCE_ID, disposition: "REJECTED" },
        finalizedEvidenceAvailable: true,
        handoffFindings: [{
          findingId: FINDING_ID,
          fingerprint: FINDING_ID,
          sourceStep: "test-review",
          canonicalEvidenceRef: `review-evidence/${EVIDENCE_ID}.json`,
        }, ...advisoryFindings.map((finding) => ({
          findingId: finding.findingId,
          fingerprint: finding.fingerprint,
          sourceStep: "test-review",
          canonicalEvidenceRef: `review-evidence/${EVIDENCE_ID}.json`,
        }))],
        blocker: null,
        toolingOutcome: null,
        provider: "independent-reviewer",
        evidenceIdentity: {
          phase: "test",
          taskId: null,
          treeSha,
          provenance: {
            provider: "independent-reviewer",
            invocationId: "review-invocation-1",
            capturedAt: "2026-08-05T00:00:30.000Z",
          },
          evidenceDigest: EVIDENCE_ID,
        },
        evidenceHistory: [],
        canonicalEvidenceRef: `review-evidence/${EVIDENCE_ID}.json`,
        targetStateDigest: targetState.digest,
        targetState: targetState.toJSON(),
      }],
    };
  });
  const ctx = {
    root,
    mainRoot: root,
    executionRoot,
    flowManager,
    flowState: flowManager.load(),
    specId: SPEC_ID,
  };
  return { root, executionRoot, specDir, testsDir, flowManager, ctx };
}

function repair(value) {
  const result = new RunRepairTestReviewCommand().execute(value.ctx);
  if (result.ok) value.ctx.flowState = value.flowManager.load();
  return result;
}

function request(value, invocationId = "dispatch-test-review-repair") {
  const coordinator = new WorkerArtifactHandoffCoordinator({
    now: () => new Date("2026-08-05T00:01:00.000Z"),
  });
  const handoff = coordinator.createRequest({
    ctx: value.ctx,
    state: value.flowManager.load(),
    invocation: {
      id: invocationId,
      target: { digest: "4".repeat(64) },
      action: {
        digest: "5".repeat(64),
        nextAction: { step: "test" },
      },
    },
  });
  return { coordinator, handoff };
}

function writeChangedPayload(handoff) {
  fs.writeFileSync(
    path.join(handoff.payloadPath("spec-tests"), "review-repair.test.js"),
    testSource("repaired public behavior"),
  );
  sealWorkerArtifactHandoff({
    requestPath: handoff.requestPath,
    invocationId: handoff.dispatchInvocationId,
  });
}

describe("governed test-review repair", () => {
  it("matches mixed blocking and advisory evidence but repairs only blocking findings", () => {
    const value = fixture({ mixedFindings: true });
    try {
      const plan = new NextActionPlanner().build({
        root: value.root,
        mainRoot: value.root,
        executionRoot: value.root,
        flowState: value.flowManager.load(),
        config: {},
        flowCommandBoundary: false,
      });
      assert.equal(plan.result.directive.actionId, "REPAIR_TEST_REVIEW");

      const result = repair(value);
      const state = value.flowManager.load();
      const record = TestReviewRepairRecord.from(state.testReviewRepair);
      assert.equal(result.ok, true);
      assert.deepEqual(
        record.blockingFindings.map((finding) => finding.findingId),
        [FINDING_ID],
      );
      assert.deepEqual(
        record.toWorkerJSON().blockingFindings.map((finding) => finding.findingId),
        [FINDING_ID],
      );
    } finally {
      removeTmpDir(value.root);
    }
  });

  it("rejects advisory mismatches and duplicate identities across canonical buckets", () => {
    const mismatch = fixture({ mixedFindings: true });
    try {
      const review = JSON.parse(fs.readFileSync(path.join(mismatch.specDir, "test-review.json"), "utf8"));
      review.advisoryFindings[0].fingerprint = "6".repeat(64);
      fs.writeFileSync(path.join(mismatch.specDir, "test-review.json"), json(review));
      const rejected = repair(mismatch);
      assert.equal(rejected.ok, false);
      assert.equal(rejected.errors[0].code, "TEST_REVIEW_REPAIR_FINDINGS_MISMATCH");
      assert.equal(findActiveNode(mismatch.flowManager.load()).stepId, "test-review");
    } finally {
      removeTmpDir(mismatch.root);
    }

    for (const field of ["findingId", "fingerprint"]) {
      const duplicate = fixture({ mixedFindings: true });
      try {
        const review = JSON.parse(fs.readFileSync(path.join(duplicate.specDir, "test-review.json"), "utf8"));
        review.advisoryFindings[0][field] = FINDING_ID;
        fs.writeFileSync(path.join(duplicate.specDir, "test-review.json"), json(review));
        const rejected = repair(duplicate);
        assert.equal(rejected.ok, false);
        assert.equal(rejected.errors[0].code, "TEST_REVIEW_REPAIR_EVIDENCE_INVALID");
        assert.equal(findActiveNode(duplicate.flowManager.load()).stepId, "test-review");
      } finally {
        removeTmpDir(duplicate.root);
      }
    }
  });

  it("routes rejected semantic evidence through the guarded test handoff and preserves review budgets", () => {
    const value = fixture();
    try {
      const before = value.flowManager.load();
      const plan = new NextActionPlanner().build({
        root: value.root,
        mainRoot: value.root,
        executionRoot: value.root,
        flowState: before,
        config: {},
        flowCommandBoundary: false,
      });
      assert.equal(plan.result.directive.kind, "repair_evidence");
      assert.equal(plan.result.directive.actionId, "REPAIR_TEST_REVIEW");
      assert.match(plan.result.directive.nextAction, /^senti flow run repair-test-review /);

      const result = repair(value);
      const state = value.flowManager.load();
      const record = TestReviewRepairRecord.from(state.testReviewRepair);
      assert.equal(result.ok, true);
      assert.equal(findActiveNode(state).stepId, "test");
      assert.equal(findStepById(state.steps, "scenario-validity").status, "pending");
      assert.equal(findStepById(state.steps, "test-review").status, "pending");
      assert.equal(record.sourceEvidenceId, EVIDENCE_ID);
      assert.equal(record.sourceTestRevision.digest, SOURCE_REVISION);
      assert.equal(record.blockingFindings[0].findingId, FINDING_ID);
      assert.deepEqual(state.metrics, before.metrics);
      assert.deepEqual(state.reviewConvergence, before.reviewConvergence);
      assert.equal(flattenSteps(state.steps).length, flattenSteps(before.steps).length);

      const { handoff } = request(value);
      assert.deepEqual(
        handoff.inputs.map((input) => input.targetRelativePath),
        ["spec.json", "test-review.json"],
      );
      const repairPlan = new NextActionPlanner().build({
        root: value.root,
        mainRoot: value.root,
        executionRoot: value.root,
        flowState: state,
        config: {},
        flowCommandBoundary: false,
      });
      assert.equal(repairPlan.result.context.testReviewRepair.sourceEvidenceId, EVIDENCE_ID);
      assert.equal(repairPlan.result.context.testReviewRepair.blockingFindings[0].findingId, FINDING_ID);
    } finally {
      removeTmpDir(value.root);
    }
  });

  it("rejects stale findings and an unchanged repaired test tree", () => {
    const stale = fixture();
    try {
      fs.writeFileSync(path.join(stale.specDir, "test-review.json"), json({
        version: 1,
        phase: "test",
        verdict: "REJECTED",
        sourceTestArtifactRevision: stale.flowManager.load().specTestArtifactRevision,
        blockingFindings: [blockingFinding({
          findingId: "6".repeat(64),
          fingerprint: "6".repeat(64),
        })],
        advisoryFindings: [],
      }));
      const rejected = repair(stale);
      assert.equal(rejected.ok, false);
      assert.equal(rejected.errors[0].code, "TEST_REVIEW_REPAIR_FINDINGS_MISMATCH");
      assert.equal(findActiveNode(stale.flowManager.load()).stepId, "test-review");
    } finally {
      removeTmpDir(stale.root);
    }

    const staleRevision = fixture();
    try {
      const review = JSON.parse(fs.readFileSync(path.join(staleRevision.specDir, "test-review.json"), "utf8"));
      review.sourceTestArtifactRevision.digest = "6".repeat(64);
      fs.writeFileSync(path.join(staleRevision.specDir, "test-review.json"), json(review));
      const rejected = repair(staleRevision);
      assert.equal(rejected.ok, false);
      assert.equal(rejected.errors[0].code, "TEST_REVIEW_REPAIR_REVISION_MISMATCH");
      assert.equal(findActiveNode(staleRevision.flowManager.load()).stepId, "test-review");
    } finally {
      removeTmpDir(staleRevision.root);
    }

    const unchanged = fixture();
    try {
      assert.equal(repair(unchanged).ok, true);
      const { coordinator, handoff } = request(unchanged, "dispatch-unchanged-test-review-repair");
      fs.writeFileSync(
        path.join(handoff.payloadPath("spec-tests"), "review-repair.test.js"),
        fs.readFileSync(path.join(unchanged.testsDir, "review-repair.test.js")),
      );
      sealWorkerArtifactHandoff({
        requestPath: handoff.requestPath,
        invocationId: handoff.dispatchInvocationId,
      });
      assert.throws(
        () => coordinator.reconcile({ ctx: unchanged.ctx, request: handoff }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_TEST_REVIEW_REPAIR_NO_PROGRESS",
      );
      assert.equal(findActiveNode(unchanged.flowManager.load()).stepId, "test");
      assert.ok(unchanged.flowManager.load().testReviewRepair);
    } finally {
      removeTmpDir(unchanged.root);
    }
  });

  it("publishes a changed tree, records revision progress, and forces scenario-validity before re-review", () => {
    const value = fixture();
    try {
      assert.equal(repair(value).ok, true);
      const { coordinator, handoff } = request(value);
      writeChangedPayload(handoff);

      const published = coordinator.reconcile({ ctx: value.ctx, request: handoff });
      const state = value.flowManager.load();
      const completion = TestReviewRepairCompletion.from(state.testReviewRepairHistory[0]);
      assert.equal(published.completed, true);
      assert.equal(findActiveNode(state).stepId, "scenario-validity");
      assert.equal(findStepById(state.steps, "test-review").status, "pending");
      assert.equal(state.testReviewRepair, undefined);
      assert.notEqual(state.specTestArtifactRevision.digest, SOURCE_REVISION);
      assert.equal(completion.repair.sourceTestRevision.digest, SOURCE_REVISION);
      assert.equal(completion.publishedTestRevisionDigest, state.specTestArtifactRevision.digest);
      assert.equal(completion.handoffDigest, state.workerArtifactReceipts.at(-1).handoffDigest);
      assert.equal(fs.existsSync(path.join(value.specDir, "scenario-validity-result.json")), true);
      assert.equal(fs.existsSync(path.join(value.specDir, "test-review.json")), true);
      assert.equal(fs.existsSync(path.join(value.specDir, "test-coverage.json")), true);
    } finally {
      removeTmpDir(value.root);
    }
  });

  it("keeps the same repair authority split in an isolated execution worktree", () => {
    const value = fixture({ worktree: true });
    try {
      assert.equal(repair(value).ok, true);
      const { coordinator, handoff } = request(value, "dispatch-worktree-test-review-repair");
      assert.equal(handoff.payloadDirectory.startsWith(value.executionRoot), true);
      assert.equal(fs.existsSync(path.join(value.executionRoot, "specs", SPEC_ID, "tests")), false);
      writeChangedPayload(handoff);

      const published = coordinator.reconcile({ ctx: value.ctx, request: handoff });
      const state = value.flowManager.load();
      assert.equal(published.completed, true);
      assert.equal(findActiveNode(state).stepId, "scenario-validity");
      assert.match(
        fs.readFileSync(path.join(value.testsDir, "review-repair.test.js"), "utf8"),
        /repaired public behavior/,
      );
      assert.equal(state.workerArtifactReceipts.length, 1);
      assert.equal(state.testReviewRepairHistory.length, 1);
    } finally {
      removeTmpDir(value.root);
    }
  });

  it("recovers an interrupted publication without duplicate receipt or repair history", () => {
    const value = fixture();
    try {
      assert.equal(repair(value).ok, true);
      const { coordinator, handoff } = request(value, "dispatch-test-review-repair-recovery");
      writeChangedPayload(handoff);
      const interrupted = new WorkerArtifactHandoffCoordinator({
        faultInjector({ phase }) {
          if (phase === "after-worker-handoff-publication") throw new Error("simulated interruption");
        },
      });
      assert.throws(
        () => interrupted.reconcile({ ctx: value.ctx, request: handoff }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required",
      );

      const recovered = coordinator.recoverPending({ ctx: value.ctx });
      const state = value.flowManager.load();
      assert.equal(recovered.completed, true);
      assert.equal(state.workerArtifactPublication, undefined);
      assert.equal(state.workerArtifactReceipts.length, 1);
      assert.equal(state.testReviewRepairHistory.length, 1);
      assert.equal(findActiveNode(state).stepId, "scenario-validity");
    } finally {
      removeTmpDir(value.root);
    }
  });
});
