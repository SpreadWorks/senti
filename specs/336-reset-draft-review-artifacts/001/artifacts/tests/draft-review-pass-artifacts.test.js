// spec: R1 R2 R3 R4 R5 R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps, FLOW_STEPS } from "../../../src/lib/flow-helpers.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import {
  DRAFT_REVIEW_ROUTES,
  draftReviewRouteForKey,
} from "../../../src/flow/lib/draft-review-routes.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const SPEC_ID = "fixture";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;

function stepsAt(activeStepId) {
  const steps = buildInitialSteps();
  const activeIndex = FLOW_STEPS.indexOf(activeStepId);
  assert.notEqual(activeIndex, -1, activeStepId);
  for (const [index, stepId] of FLOW_STEPS.entries()) {
    const step = findStepById(steps, stepId);
    step.status = index < activeIndex ? "done" : index === activeIndex ? "in_progress" : "pending";
  }
  return steps;
}

class DraftReviewLifecycleHarness {
  constructor(root, route) {
    this.root = root;
    this.route = route;
    this.specDir = path.join(root, "specs", SPEC_ID);
    this.flowPath = path.join(this.specDir, "flow.json");
    this.issueLogPath = path.join(this.specDir, "issue-log.json");
    this.existingSourceReview = `retained-${route.key}-review-source.json`;
    this.existingSourceTriage = `retained-${route.key}-triage-source.json`;
    this.flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false });

    this.writeJson(path.join(this.specDir, "spec.json"), { goal: "fixture" });
    this.writeJson(this.issueLogPath, {
      entries: [{ step: "fixture", reason: "history before the rewind" }],
    });
    this.flowManager.create({
      spec: SPEC_PATH,
      issue: 459,
      runId: `run-${route.key}`,
      baseBranch: "main",
      featureBranch: `feature/${route.key}`,
      currentTaskId: null,
      steps: stepsAt(route.reviewStepId),
      requirements: [],
      tasks: [],
      metrics: [],
    });
    this.flowManager.addActiveFlow(SPEC_ID, "local");
  }

  writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  }

  artifactPath(kind) {
    const name = {
      review: this.route.reviewArtifact,
      triage: this.route.triageArtifact,
      repair: this.route.repairArtifact,
    }[kind];
    return path.join(this.specDir, name);
  }

  readArtifact(kind) {
    return JSON.parse(fs.readFileSync(this.artifactPath(kind), "utf8"));
  }

  materializeAiAuthoredArtifact(kind, artifact) {
    const file = this.artifactPath(kind);
    assert.equal(fs.existsSync(file), false);
    this.writeJson(file, artifact);
    assert.equal(fs.existsSync(file), true);
    assert.deepEqual(this.readArtifact(kind), artifact);
  }

  readArtifactBytes(kind) {
    return fs.readFileSync(this.artifactPath(kind));
  }

  readIssueLogBytes() {
    return fs.readFileSync(this.issueLogPath);
  }

  readFlowBytes() {
    return fs.readFileSync(this.flowPath);
  }

  load() {
    return this.flowManager.load();
  }

  stepStatus(stepId) {
    return findStepById(this.load().steps, stepId)?.status;
  }

  setActiveStep(stepId) {
    this.flowManager.mutate((state) => {
      state.steps = stepsAt(stepId);
    });
  }

  async postReview(verdict, findings) {
    this.writeJson(this.artifactPath("review"), {
      version: 1,
      phase: this.route.reviewStepId,
      verdict,
      findings,
    });
    const ctx = {
      phase: "draft",
      root: this.root,
      specId: SPEC_ID,
      flowState: this.load(),
      flowManager: this.flowManager,
    };
    await FLOW_COMMANDS.run.review.post(ctx, {
      artifacts: {
        phase: "draft",
        verdict,
        retryPhase: this.route.retryPhase,
        findings,
      },
    });
  }

  async completeCurrentStep(stepId) {
    const result = await new SetStepCommand().execute({
      id: stepId,
      status: "done",
      root: this.root,
      specId: SPEC_ID,
      flowManager: this.flowManager,
    });
    assert.equal(result.status, "done", JSON.stringify(result));
  }

  async recordNonPassRouteArtifacts(verdict, findings) {
    assert.equal(fs.existsSync(this.artifactPath("review")), false);
    assert.equal(fs.existsSync(this.artifactPath("triage")), false);
    assert.equal(fs.existsSync(this.artifactPath("repair")), false);

    await this.postReview(verdict, findings);
    assert.equal(this.stepStatus(this.route.reviewStepId), "done");
    assert.equal(this.stepStatus(this.route.triageStepId), "in_progress");
    assert.equal(this.stepStatus(this.route.repairStepId), "pending");

    const flowBeforeRejectedTransition = this.readFlowBytes();
    const guardResult = await new SetStepCommand().execute({
      id: this.route.repairStepId,
      status: "done",
      root: this.root,
      specId: SPEC_ID,
      flowManager: this.flowManager,
    });
    assert.equal(guardResult.ok, false);
    assert.equal(guardResult.errors[0].code, "FLOW_STEP_TRANSITION_INVALID");
    assert.deepEqual(this.readFlowBytes(), flowBeforeRejectedTransition);

    const finding = findings[0];
    const triageArtifact = {
      version: 1,
      phase: this.route.triageStepId,
      sourceReview: this.existingSourceReview,
      generatedAt: "2026-07-24T00:00:00.000Z",
      summary: `${verdict} findings require triage.`,
      items: [{ title: finding.title, decision: "apply" }],
    };
    this.materializeAiAuthoredArtifact("triage", triageArtifact);
    await this.completeCurrentStep(this.route.triageStepId);
    assert.equal(this.stepStatus(this.route.repairStepId), "in_progress");

    const repairArtifact = {
      version: 1,
      phase: this.route.repairStepId,
      sourceTriage: this.existingSourceTriage,
      generatedAt: "2026-07-24T00:00:01.000Z",
      summary: `${verdict} triage produced a repair.`,
      items: [{ title: finding.title, changedFieldPaths: ["qa[0]"] }],
    };
    this.materializeAiAuthoredArtifact("repair", repairArtifact);
    await this.completeCurrentStep(this.route.repairStepId);

    return {
      review: this.readArtifact("review"),
      triage: this.readArtifact("triage"),
      repair: this.readArtifact("repair"),
      guardCode: guardResult.errors[0].code,
    };
  }

  async reopenFromTestReview() {
    this.setActiveStep("test-review");
    const artifactsBefore = {
      review: this.readArtifactBytes("review"),
      triage: this.readArtifactBytes("triage"),
      repair: this.readArtifactBytes("repair"),
    };
    const result = await new RunReopenDraftCommand().execute({
      category: "task-addition",
      reason: "Exercise retained draft-review history before a later PASS.",
      root: this.root,
      specId: SPEC_ID,
      flowState: this.load(),
      flowManager: this.flowManager,
    });

    assert.equal(result.ok, true, JSON.stringify(result.errors));
    assert.equal(result.data.mode, "pre-implementation");
    assert.equal(result.data.previousActiveStep, "test-review");
    assert.equal(this.stepStatus("draft"), "in_progress");
    assert.deepEqual(this.readArtifactBytes("review"), artifactsBefore.review);
    assert.deepEqual(this.readArtifactBytes("triage"), artifactsBefore.triage);
    assert.deepEqual(this.readArtifactBytes("repair"), artifactsBefore.repair);
    return result;
  }
}

async function runInvalidatedAttemptSequence(routeKey) {
  const root = createTmpDir(`draft-review-pass-${routeKey}-`);
  const route = draftReviewRouteForKey(routeKey);
  const harness = new DraftReviewLifecycleHarness(root, route);
  const firstVerdict = routeKey === "questions" ? "ADVISORY" : "REJECTED";
  const findings = [{ title: `stale ${routeKey} finding` }];

  try {
    const beforeRewind = await harness.recordNonPassRouteArtifacts(firstVerdict, findings);
    assert.equal(fs.existsSync(harness.artifactPath("triage")), true);
    assert.equal(fs.existsSync(harness.artifactPath("repair")), true);
    const issueLogBeforeRewind = harness.readIssueLogBytes();
    const reopenResult = await harness.reopenFromTestReview();
    const auditBeforePass = harness.readIssueLogBytes();
    assert.notDeepEqual(auditBeforePass, issueLogBeforeRewind);

    harness.setActiveStep(route.reviewStepId);
    const passStartedAt = Date.now();
    await harness.postReview("PASS", []);
    const passFinishedAt = Date.now();

    return {
      route,
      harness,
      firstVerdict,
      reopenResult,
      beforeRewind,
      afterPass: {
        triage: harness.readArtifact("triage"),
        repair: harness.readArtifact("repair"),
      },
      auditBeforePass,
      auditAfterPass: harness.readIssueLogBytes(),
      metricsAfterPass: harness.load().metrics,
      passStartedAt,
      passFinishedAt,
    };
  } catch (error) {
    removeTmpDir(root);
    throw error;
  }
}

function assertCurrentTimestamp(value, startedAt, finishedAt) {
  const timestamp = Date.parse(value);
  assert.ok(Number.isFinite(timestamp), value);
  assert.ok(timestamp >= startedAt, `${value} must be generated by the PASS attempt`);
  assert.ok(timestamp <= finishedAt, `${value} must be generated by the PASS attempt`);
}

function cleanupSequence(sequence) {
  removeTmpDir(sequence.harness.root);
}

describe("draft review PASS current artifacts after rewind", () => {
  it("R1: replaces the questions triage artifact with the canonical empty state", async () => {
    const sequence = await runInvalidatedAttemptSequence("questions");
    try {
      assert.equal(sequence.beforeRewind.triage.items.length, 1);
      assert.deepEqual(sequence.afterPass.triage, {
        version: 1,
        phase: "draft-questions-triage",
        sourceReview: sequence.route.reviewArtifact,
        generatedAt: sequence.afterPass.triage.generatedAt,
        summary: "No draft review findings to triage.",
        items: [],
      });
      assertCurrentTimestamp(
        sequence.afterPass.triage.generatedAt,
        sequence.passStartedAt,
        sequence.passFinishedAt,
      );
    } finally {
      cleanupSequence(sequence);
    }
  });

  it("R2: replaces the questions repair artifact in the same PASS attempt", async () => {
    const sequence = await runInvalidatedAttemptSequence("questions");
    try {
      assert.equal(sequence.beforeRewind.repair.items.length, 1);
      assert.deepEqual(sequence.afterPass.repair, {
        version: 1,
        phase: "draft-questions-repair",
        sourceTriage: sequence.route.triageArtifact,
        generatedAt: sequence.afterPass.repair.generatedAt,
        summary: "No draft triage items to repair.",
        items: [],
      });
      assert.equal(
        sequence.afterPass.repair.generatedAt,
        sequence.afterPass.triage.generatedAt,
      );
    } finally {
      cleanupSequence(sequence);
    }
  });

  it("R3: applies route-correct empty replacement to coverage artifacts", async () => {
    const sequence = await runInvalidatedAttemptSequence("coverage");
    try {
      assert.equal(sequence.beforeRewind.triage.items.length, 1);
      assert.equal(sequence.beforeRewind.repair.items.length, 1);
      assert.deepEqual(sequence.afterPass.triage, {
        version: 1,
        phase: "draft-coverage-triage",
        sourceReview: sequence.route.reviewArtifact,
        generatedAt: sequence.afterPass.triage.generatedAt,
        summary: "No draft review findings to triage.",
        items: [],
      });
      assert.deepEqual(sequence.afterPass.repair, {
        version: 1,
        phase: "draft-coverage-repair",
        sourceTriage: sequence.route.triageArtifact,
        generatedAt: sequence.afterPass.repair.generatedAt,
        summary: "No draft triage items to repair.",
        items: [],
      });
      assertCurrentTimestamp(
        sequence.afterPass.triage.generatedAt,
        sequence.passStartedAt,
        sequence.passFinishedAt,
      );
      assert.equal(
        sequence.afterPass.repair.generatedAt,
        sequence.afterPass.triage.generatedAt,
      );
    } finally {
      cleanupSequence(sequence);
    }
  });

  it("R4: completes every route step and removes invalidated findings from the current view", async () => {
    for (const route of DRAFT_REVIEW_ROUTES) {
      const sequence = await runInvalidatedAttemptSequence(route.key);
      try {
        assert.deepEqual(
          [route.reviewStepId, route.triageStepId, route.repairStepId]
            .map((stepId) => [stepId, sequence.harness.stepStatus(stepId)]),
          [
            [route.reviewStepId, "done"],
            [route.triageStepId, "done"],
            [route.repairStepId, "done"],
          ],
        );
        assert.equal(JSON.stringify(sequence.afterPass).includes("stale"), false);
      } finally {
        cleanupSequence(sequence);
      }
    }
  });

  it("R5: preserves routing, schemas, retry accounting, rewind history, and transition guards", async () => {
    const expectedRoutes = [
      {
        key: "questions",
        retryPhase: "draft-questions",
        reviewStepId: "draft-questions-review",
        triageStepId: "draft-questions-triage",
        repairStepId: "draft-questions-repair",
        reviewArtifact: "draft-review-questions.json",
        triageArtifact: "draft-questions-triage.json",
        repairArtifact: "draft-questions-repair.json",
      },
      {
        key: "coverage",
        retryPhase: "draft-coverage",
        reviewStepId: "draft-coverage-review",
        triageStepId: "draft-coverage-triage",
        repairStepId: "draft-coverage-repair",
        reviewArtifact: "draft-review-coverage.json",
        triageArtifact: "draft-coverage-triage.json",
        repairArtifact: "draft-coverage-repair.json",
      },
    ];
    assert.deepEqual(
      DRAFT_REVIEW_ROUTES.map((route) => Object.fromEntries(
        Object.keys(expectedRoutes[0]).map((key) => [key, route[key]]),
      )),
      expectedRoutes,
    );

    for (const route of DRAFT_REVIEW_ROUTES) {
      const sequence = await runInvalidatedAttemptSequence(route.key);
      try {
        assert.equal(sequence.beforeRewind.triage.items[0].title, `stale ${route.key} finding`);
        assert.equal(sequence.beforeRewind.repair.items[0].title, `stale ${route.key} finding`);
        assert.equal(sequence.beforeRewind.guardCode, "FLOW_STEP_TRANSITION_INVALID");
        assert.deepEqual(sequence.auditAfterPass, sequence.auditBeforePass);
        assert.match(sequence.auditAfterPass.toString(), /reopen-draft triggered/);
        assert.deepEqual(
          Object.keys(sequence.afterPass.triage),
          ["version", "phase", "sourceReview", "generatedAt", "summary", "items"],
        );
        assert.deepEqual(
          Object.keys(sequence.afterPass.repair),
          ["version", "phase", "sourceTriage", "generatedAt", "summary", "items"],
        );
        const retryMetrics = sequence.metricsAfterPass.filter((metric) => (
          metric.phase === route.retryPhase && metric.counter === "reviewRetry"
        ));
        assert.deepEqual(
          retryMetrics.map(({ delta, reset }) => ({ delta, reset: reset ?? false })),
          route.key === "questions"
            ? [{ delta: 0, reset: true }, { delta: 0, reset: true }]
            : [{ delta: 1, reset: false }, { delta: 0, reset: true }],
        );
      } finally {
        cleanupSequence(sequence);
      }
    }
  });

  it("R6: creates non-PASS artifacts, uses production rewind, then runs each PASS hook", async () => {
    const questions = await runInvalidatedAttemptSequence("questions");
    const coverage = await runInvalidatedAttemptSequence("coverage");
    try {
      assert.equal(questions.firstVerdict, "ADVISORY");
      assert.equal(coverage.firstVerdict, "REJECTED");
      assert.equal(questions.beforeRewind.review.findings[0].title, "stale questions finding");
      assert.equal(coverage.beforeRewind.review.findings[0].title, "stale coverage finding");
      assert.equal(questions.reopenResult.data.mode, "pre-implementation");
      assert.equal(coverage.reopenResult.data.mode, "pre-implementation");
      assert.deepEqual(questions.afterPass.triage.items, []);
      assert.deepEqual(questions.afterPass.repair.items, []);
      assert.deepEqual(coverage.afterPass.triage.items, []);
      assert.deepEqual(coverage.afterPass.repair.items, []);
    } finally {
      cleanupSequence(questions);
      cleanupSequence(coverage);
    }
  });
});
