import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  DRAFT_ARTIFACT_WRITER_STEPS,
  DraftArtifactRecoveryError,
  completeDraftArtifactStep,
  createInitialDraftArtifactRevision,
  inspectCanonicalDraftRevision,
} from "../../../src/flow/lib/draft-artifact-promotion.js";
import {
  buildDraftReviewArtifact,
  buildDraftReviewPrompt,
  writeReviewAttemptHistory,
} from "../../../src/flow/commands/review.js";
import { ReviewTargetAuthority } from "../../../src/flow/lib/review-target-authority.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { NormalStepTransition } from "../../../src/flow/lib/step-transition-policy.js";
import { RunReviewCommand } from "../../../src/flow/lib/run-review.js";
import { validateDraftReviewArtifactSet } from "../../../src/flow/lib/run-gate.js";
import { draftReviewRouteForKey } from "../../../src/flow/lib/draft-review-routes.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

function jsonBytes(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeDraft(root, specId, value) {
  const file = path.join(root, "specs", specId, "draft.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, jsonBytes(value));
  return file;
}

function promotionFixture({ stepId = "draft" } = {}) {
  const mainRoot = createTmpDir("draft-promotion-main-");
  const executionRoot = path.join(mainRoot, "execution-checkout");
  fs.mkdirSync(executionRoot, { recursive: true });
  const specId = "497-draft-promotion";
  const canonicalPath = writeDraft(mainRoot, specId, { goal: "prepare placeholder" });
  const sourcePath = writeDraft(executionRoot, specId, {
    goal: "completed worktree draft",
    analysis: { problem: "stale canonical draft" },
    qa: [{
      id: "q1",
      status: "pending",
      category: "impact-scope",
      question: "Which canonical draft behavior should the review verify?",
    }],
  });
  const state = moveFlowToStep(makeFlowState({
    specId,
    runId: "run-draft-promotion",
    worktree: true,
  }), stepId);
  state.draftArtifactRevision = createInitialDraftArtifactRevision({
    state,
    draftPath: canonicalPath,
  }).toJSON();
  const flowManager = new FlowManager({
    root: executionRoot,
    mainRoot,
    inWorktree: true,
    specId,
  });
  flowManager.create(state);
  const transition = new NormalStepTransition({
    stepId,
    currentStepId: stepId,
    currentStatus: "in_progress",
    requestedStatus: "done",
  });
  return { mainRoot, executionRoot, specId, canonicalPath, sourcePath, state, flowManager, transition };
}

function complete(fixture, options = {}) {
  return completeDraftArtifactStep({
    mainRoot: fixture.mainRoot,
    executionRoot: fixture.executionRoot,
    flowManager: fixture.flowManager,
    state: fixture.flowManager.load(),
    transition: fixture.transition,
    ...options,
  });
}

describe("canonical draft artifact promotion", () => {
  it("atomically promotes a worktree draft before marking draft done", () => {
    const fixture = promotionFixture();
    try {
      const result = complete(fixture);
      const state = fixture.flowManager.load();

      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), fs.readFileSync(fixture.sourcePath, "utf8"));
      assert.equal(findStepById(state.steps, "draft").status, "done");
      assert.equal(state.draftArtifactPromotion, undefined);
      assert.equal(state.draftArtifactRevision.digest, result.revision.digest);
      assert.equal(result.promoted, true);
      const reviewInput = inspectCanonicalDraftRevision({
        root: fixture.mainRoot,
        state,
        phase: "draft-questions",
      });
      assert.equal(reviewInput.snapshot.document.goal, "completed worktree draft");
      assert.equal(reviewInput.snapshot.digest, state.draftArtifactRevision.digest);
      const prompt = buildDraftReviewPrompt(
        reviewInput.snapshot.document,
        "review the finalized draft",
        [],
        { key: "questions" },
      );
      assert.match(prompt, /Which canonical draft behavior should the review verify\?/);
      assert.doesNotMatch(prompt, /prepare placeholder/);
      const targetState = ReviewTargetAuthority.fromContext({
        root: fixture.mainRoot,
        executionRoot: fixture.executionRoot,
        flowState: state,
      }).captureTargetStateForPhase("draft-questions");
      assert.equal(targetState.digest, state.draftArtifactRevision.digest);
      const artifact = buildDraftReviewArtifact({
        raw: "NO_PROPOSALS",
        draftPath: "draft.json",
        draftRevision: reviewInput.revision,
        proposals: [],
        stage: {
          retryPhase: "draft-questions",
          findingClassification: "repair_target",
        },
      }).toJSON();
      assert.equal(artifact.version, 2);
      assert.deepEqual(artifact.sourceDraftRevision, state.draftArtifactRevision);
      const written = writeReviewAttemptHistory({
        specDir: path.dirname(fixture.canonicalPath),
        phase: "draft-questions",
        latestBasename: "draft-review-questions.json",
        artifact,
      });
      const history = JSON.parse(fs.readFileSync(written.historyJsonPath, "utf8"));
      assert.deepEqual(history.sourceDraftRevision, state.draftArtifactRevision);
      assert.equal(
        fs.existsSync(path.join(
          fixture.executionRoot,
          "specs",
          fixture.specId,
          "draft-review-questions.json",
        )),
        false,
      );
    } finally {
      removeTmpDir(fixture.mainRoot);
    }
  });

  for (const stepId of DRAFT_ARTIFACT_WRITER_STEPS.filter((candidate) => candidate !== "draft")) {
    it(`uses canonical promotion semantics for ${stepId}`, () => {
      const fixture = promotionFixture({ stepId });
      try {
        complete(fixture);
        const state = fixture.flowManager.load();
        assert.equal(findStepById(state.steps, stepId).status, "done");
        assert.equal(state.draftArtifactRevision.sourceStepId, stepId);
        assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), fs.readFileSync(fixture.sourcePath, "utf8"));
      } finally {
        removeTmpDir(fixture.mainRoot);
      }
    });
  }

  it("leaves a retryable journal when atomic publication is interrupted", () => {
    const fixture = promotionFixture();
    const placeholder = fs.readFileSync(fixture.canonicalPath, "utf8");
    try {
      assert.throws(
        () => complete(fixture, {
          faultInjector({ phase }) {
            if (phase === "before-draft-rename") throw new Error("simulated promotion interruption");
          },
        }),
        (error) => error instanceof DraftArtifactRecoveryError
          && error.code === "DRAFT_PROMOTION_RECOVERY_REQUIRED",
      );
      const interrupted = fixture.flowManager.load();
      assert.equal(findStepById(interrupted.steps, "draft").status, "in_progress");
      assert.ok(interrupted.draftArtifactPromotion);
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), placeholder);

      complete(fixture);
      const recovered = fixture.flowManager.load();
      assert.equal(findStepById(recovered.steps, "draft").status, "done");
      assert.equal(recovered.draftArtifactPromotion, undefined);
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), fs.readFileSync(fixture.sourcePath, "utf8"));
    } finally {
      removeTmpDir(fixture.mainRoot);
    }
  });

  it("recovers idempotently when publication reached the canonical name before interruption", () => {
    const fixture = promotionFixture();
    try {
      assert.throws(
        () => complete(fixture, {
          faultInjector({ phase }) {
            if (phase === "before-draft-directory-fsync") {
              throw new Error("simulated interruption after canonical rename");
            }
          },
        }),
        (error) => error instanceof DraftArtifactRecoveryError
          && error.code === "DRAFT_PROMOTION_RECOVERY_REQUIRED",
      );
      const interrupted = fixture.flowManager.load();
      assert.equal(findStepById(interrupted.steps, "draft").status, "in_progress");
      assert.ok(interrupted.draftArtifactPromotion);
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), fs.readFileSync(fixture.sourcePath, "utf8"));

      complete(fixture);
      const recovered = fixture.flowManager.load();
      assert.equal(findStepById(recovered.steps, "draft").status, "done");
      assert.equal(recovered.draftArtifactPromotion, undefined);
    } finally {
      removeTmpDir(fixture.mainRoot);
    }
  });

  it("replans idempotently when the source changes during publication", () => {
    const fixture = promotionFixture();
    const placeholder = fs.readFileSync(fixture.canonicalPath, "utf8");
    let changed = false;
    try {
      assert.throws(
        () => complete(fixture, {
          faultInjector({ phase }) {
            if (!changed && phase === "before-draft-rename") {
              changed = true;
              fs.writeFileSync(fixture.sourcePath, jsonBytes({ goal: "newer completed worktree draft" }));
            }
          },
        }),
        (error) => error instanceof DraftArtifactRecoveryError
          && error.code === "DRAFT_PROMOTION_SOURCE_CHANGED",
      );
      assert.equal(findStepById(fixture.flowManager.load().steps, "draft").status, "in_progress");
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), placeholder);

      complete(fixture);
      const recovered = fixture.flowManager.load();
      assert.equal(findStepById(recovered.steps, "draft").status, "done");
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), fs.readFileSync(fixture.sourcePath, "utf8"));
    } finally {
      removeTmpDir(fixture.mainRoot);
    }
  });

  it("preserves a canonical revision that changes immediately before rename", () => {
    const fixture = promotionFixture();
    const placeholder = fs.readFileSync(fixture.canonicalPath, "utf8");
    const divergent = jsonBytes({ goal: "concurrent canonical edit" });
    let changed = false;
    try {
      assert.throws(
        () => complete(fixture, {
          faultInjector({ phase }) {
            if (!changed && phase === "before-draft-rename") {
              changed = true;
              fs.writeFileSync(fixture.canonicalPath, divergent);
            }
          },
        }),
        (error) => error instanceof DraftArtifactRecoveryError
          && error.code === "DRAFT_PROMOTION_CONFLICT",
      );
      const interrupted = fixture.flowManager.load();
      assert.equal(findStepById(interrupted.steps, "draft").status, "in_progress");
      assert.ok(interrupted.draftArtifactPromotion);
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), divergent);

      fs.writeFileSync(fixture.canonicalPath, placeholder);
      complete(fixture);
      assert.equal(findStepById(fixture.flowManager.load().steps, "draft").status, "done");
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), fs.readFileSync(fixture.sourcePath, "utf8"));
    } finally {
      removeTmpDir(fixture.mainRoot);
    }
  });

  it("stops before rename when the pending Flow promotion changes", () => {
    const fixture = promotionFixture();
    const placeholder = fs.readFileSync(fixture.canonicalPath, "utf8");
    const flowPath = path.join(fixture.mainRoot, "specs", fixture.specId, "flow.json");
    let changed = false;
    try {
      assert.throws(
        () => complete(fixture, {
          faultInjector({ phase }) {
            if (!changed && phase === "before-draft-rename") {
              changed = true;
              const state = JSON.parse(fs.readFileSync(flowPath, "utf8"));
              state.draftArtifactPromotion.sourceDigest = "f".repeat(64);
              fs.writeFileSync(flowPath, jsonBytes(state));
            }
          },
        }),
        (error) => error instanceof DraftArtifactRecoveryError
          && error.code === "DRAFT_PROMOTION_CHANGED",
      );
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), placeholder);
      assert.equal(findStepById(fixture.flowManager.load().steps, "draft").status, "in_progress");

      complete(fixture);
      assert.equal(findStepById(fixture.flowManager.load().steps, "draft").status, "done");
    } finally {
      removeTmpDir(fixture.mainRoot);
    }
  });

  it("fails closed without overwriting an unexpected canonical revision", () => {
    const fixture = promotionFixture();
    const divergent = jsonBytes({ goal: "external canonical edit" });
    fs.writeFileSync(fixture.canonicalPath, divergent);
    try {
      assert.throws(
        () => complete(fixture),
        (error) => error instanceof DraftArtifactRecoveryError
          && error.code === "DRAFT_PROMOTION_CANONICAL_STALE",
      );
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), divergent);
      assert.equal(findStepById(fixture.flowManager.load().steps, "draft").status, "in_progress");
    } finally {
      removeTmpDir(fixture.mainRoot);
    }
  });

  it("rejects a draft revision bound to a different Flow before publication", () => {
    const fixture = promotionFixture();
    const placeholder = fs.readFileSync(fixture.canonicalPath, "utf8");
    try {
      fixture.flowManager.mutate((state) => {
        state.draftArtifactRevision.runId = "run-other-flow";
      });
      assert.throws(
        () => complete(fixture),
        (error) => error instanceof DraftArtifactRecoveryError
          && error.code === "DRAFT_ARTIFACT_BINDING_MISMATCH",
      );
      assert.equal(fs.readFileSync(fixture.canonicalPath, "utf8"), placeholder);
      assert.equal(findStepById(fixture.flowManager.load().steps, "draft").status, "in_progress");
    } finally {
      removeTmpDir(fixture.mainRoot);
    }
  });

  it("uses the same revision transition without copying in a non-worktree Flow", () => {
    const root = createTmpDir("draft-promotion-local-");
    const specId = "497-local-draft";
    const draftPath = writeDraft(root, specId, { goal: "completed local draft" });
    const state = moveFlowToStep(makeFlowState({ specId, runId: "run-local-draft" }), "draft");
    state.draftArtifactRevision = createInitialDraftArtifactRevision({ state, draftPath }).toJSON();
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
    flowManager.create(state);
    const transition = new NormalStepTransition({
      stepId: "draft",
      currentStepId: "draft",
      currentStatus: "in_progress",
      requestedStatus: "done",
    });
    try {
      const before = fs.readFileSync(draftPath, "utf8");
      const result = completeDraftArtifactStep({
        mainRoot: root,
        executionRoot: root,
        flowManager,
        state: flowManager.load(),
        transition,
      });
      assert.equal(result.promoted, false);
      assert.equal(fs.readFileSync(draftPath, "utf8"), before);
      assert.equal(findStepById(flowManager.load().steps, "draft").status, "done");
    } finally {
      removeTmpDir(root);
    }
  });

  it("rejects a stale canonical draft before provider invocation without consuming retry budget", async () => {
    const root = createTmpDir("draft-review-stale-");
    const specId = "497-stale-review";
    const draftPath = writeDraft(root, specId, { goal: "finalized draft" });
    const state = moveFlowToStep(makeFlowState({ specId, runId: "run-stale-review" }), "draft-questions-review");
    state.draftArtifactRevision = createInitialDraftArtifactRevision({ state, draftPath }).toJSON();
    state.draftArtifactRevision.sourceStepId = "draft";
    fs.writeFileSync(draftPath, jsonBytes({ goal: "stale prepare placeholder" }));
    let providerInvocations = 0;
    const command = new RunReviewCommand({
      runCommand() {
        providerInvocations += 1;
        throw new Error("provider must not be invoked");
      },
    });
    try {
      const result = await command.execute({
        root,
        executionRoot: root,
        phase: "draft",
        config: { agent: {} },
        flowState: state,
        flowManager: { load() { return state; } },
      });
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "DRAFT_REVIEW_CANONICAL_STALE");
      assert.equal(result.data.retryBudgetConsumed, false);
      assert.match(result.data.recoveryCommand, /flow run reopen-draft/);
      assert.equal(providerInvocations, 0);
      assert.equal(state.reviewConvergence, undefined);
    } finally {
      removeTmpDir(root);
    }
  });

  it("rejects a missing draft revision before provider invocation without consuming retry budget", async () => {
    const root = createTmpDir("draft-review-revision-missing-");
    const specId = "497-missing-review-revision";
    writeDraft(root, specId, { goal: "unverified canonical draft" });
    const state = moveFlowToStep(makeFlowState({ specId, runId: "run-missing-review-revision" }), "draft-questions-review");
    let providerInvocations = 0;
    const command = new RunReviewCommand({
      runCommand() {
        providerInvocations += 1;
        throw new Error("provider must not be invoked");
      },
    });
    try {
      const result = await command.execute({
        root,
        executionRoot: root,
        phase: "draft",
        config: { agent: {} },
        flowState: state,
        flowManager: { load() { return state; } },
      });
      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "DRAFT_REVIEW_REVISION_MISSING");
      assert.equal(result.data.retryBudgetConsumed, false);
      assert.match(result.data.recoveryCommand, /flow run abort/);
      assert.equal(providerInvocations, 0);
      assert.equal(state.reviewConvergence, undefined);
    } finally {
      removeTmpDir(root);
    }
  });

  it("rejects unlinked and foreign draft review artifacts at the draft gate", () => {
    const root = createTmpDir("draft-review-gate-revision-");
    const specId = "497-gate-review-revision";
    const specDir = path.join(root, "specs", specId);
    const route = draftReviewRouteForKey("questions");
    fs.mkdirSync(specDir, { recursive: true });
    const state = makeFlowState({ specId, runId: "run-gate-review-revision" });
    state.draftArtifactRevision = {
      version: 1,
      runId: state.runId,
      specId,
      sourceStepId: "draft",
      digest: "b".repeat(64),
      byteLength: 256,
      finalizedAt: "2026-08-04T00:00:00.000Z",
    };
    const common = {
      phase: "draft-questions",
      sourceDraft: "draft.json",
      generatedAt: "2026-08-04T00:00:00.000Z",
      verdict: "PASS",
      summary: "No findings.",
      blockingFindings: [],
      advisoryFindings: [],
      repairTargets: [],
    };
    try {
      fs.writeFileSync(path.join(specDir, route.reviewArtifact), jsonBytes({
        version: 1,
        ...common,
      }));
      const unlinked = validateDraftReviewArtifactSet(specDir, route, state);
      assert.ok(unlinked.issues.includes(`${route.reviewArtifact}: version must be 2`));

      fs.writeFileSync(path.join(specDir, route.reviewArtifact), jsonBytes({
        version: 2,
        ...common,
        sourceDraftRevision: {
          version: 1,
          runId: "run-foreign",
          specId,
          sourceStepId: "draft",
          digest: "a".repeat(64),
          byteLength: 128,
          finalizedAt: "2026-08-04T00:00:00.000Z",
        },
      }));
      const foreign = validateDraftReviewArtifactSet(specDir, route, state);
      assert.ok(foreign.issues.some((issue) => (
        issue.includes("invalid sourceDraftRevision")
        && issue.includes("does not match the active Flow target")
      )));

      fs.writeFileSync(path.join(specDir, route.reviewArtifact), jsonBytes({
        version: 2,
        ...common,
        sourceDraftRevision: {
          ...state.draftArtifactRevision,
          digest: "a".repeat(64),
        },
      }));
      const stale = validateDraftReviewArtifactSet(specDir, route, state);
      assert.ok(stale.issues.some((issue) => (
        issue.includes("invalid sourceDraftRevision")
        && issue.includes("does not match the current finalized draft revision")
      )));

      fs.writeFileSync(path.join(specDir, route.reviewArtifact), jsonBytes({
        version: 2,
        ...common,
        sourceDraftRevision: state.draftArtifactRevision,
      }));
      const current = validateDraftReviewArtifactSet(specDir, route, state);
      assert.equal(
        current.issues.some((issue) => issue.includes("sourceDraftRevision")),
        false,
      );
    } finally {
      removeTmpDir(root);
    }
  });
});
