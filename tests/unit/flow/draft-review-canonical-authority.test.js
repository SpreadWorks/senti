import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  DraftReviewArtifactFile,
  DraftReviewArtifactRecoveryError,
  completeDraftReviewArtifactStep,
  registerDraftReviewRevision,
  validateDraftReviewArtifactSet,
} from "../../../src/flow/lib/draft-review-artifacts.js";
import { createDraftReviewRevisionBinding } from "../../../src/flow/lib/draft-review-revision.js";
import {
  completeCanonicalDraftMutation,
  createInitialDraftArtifactRevision,
} from "../../../src/flow/lib/draft-artifact-promotion.js";
import { draftReviewRouteForKey } from "../../../src/flow/lib/draft-review-routes.js";
import RunReopenDraftCommand from "../../../src/flow/lib/run-reopen-draft.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { NormalStepTransition } from "../../../src/flow/lib/step-transition-policy.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const GENERATED_AT = "2026-08-04T00:00:00.000Z";

function writeJson(root, relativePath, value) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function reviewArtifact(revision, route, { verdict = "ADVISORY", repairTargets = null } = {}) {
  const targets = repairTargets ?? [{
    title: "Keep canonical authority",
    target: "draft.goal",
    rationale: "The worker must use the reviewed base-side evidence.",
    evidence: "The review recorded the canonical draft revision.",
    classification: "repair_target",
  }];
  return {
    version: 2,
    phase: route.retryPhase,
    sourceDraft: "draft.json",
    sourceDraftRevision: revision,
    generatedAt: GENERATED_AT,
    verdict,
    summary: verdict === "PASS" ? "No findings." : "Canonical evidence requires repair.",
    blockingFindings: [],
    advisoryFindings: [],
    repairTargets: verdict === "PASS" ? [] : targets,
  };
}

function triageArtifact(route, { items = null } = {}) {
  return {
    version: 1,
    phase: route.triageStepId,
    sourceReview: route.reviewArtifact,
    generatedAt: GENERATED_AT,
    summary: "The canonical finding will be applied.",
    items: items ?? [{
      title: "Keep canonical authority",
      target: "draft.goal",
      decision: "apply",
      rationale: "The source review requires it.",
      evidence: "The base-side review contains the target.",
    }],
  };
}

function repairArtifact(route) {
  return {
    version: 1,
    phase: route.repairStepId,
    sourceTriage: route.triageArtifact,
    generatedAt: GENERATED_AT,
    summary: "The canonical repair was applied.",
    items: [{
      title: "Keep canonical authority",
      target: "draft.goal",
      rationale: "The route now uses canonical evidence.",
      evidence: "The draft field was updated.",
      changedFieldPaths: ["goal"],
    }],
  };
}

function revisionFor(state, sourceStepId, digest) {
  return {
    version: 1,
    runId: state.runId,
    specId: state.specId,
    sourceStepId,
    digest,
    byteLength: 128,
    finalizedAt: GENERATED_AT,
  };
}

describe("draft review canonical authority", () => {
  let temporaryRoot;

  afterEach(() => {
    if (temporaryRoot) removeTmpDir(temporaryRoot);
    temporaryRoot = null;
  });

  it("binds a questions review to its historical route revision after refine changes the global revision", () => {
    temporaryRoot = createTmpDir("draft-review-route-revision-");
    const route = draftReviewRouteForKey("questions");
    const specId = "498-route-revision";
    const state = makeFlowState({ specId, runId: "run-route-revision" });
    const reviewed = revisionFor(state, "draft", "a".repeat(64));
    state.draftArtifactRevision = revisionFor(state, "draft-refine", "b".repeat(64));
    const specDir = path.join(temporaryRoot, "specs", specId);
    writeJson(temporaryRoot, `specs/${specId}/${route.reviewArtifact}`, reviewArtifact(reviewed, route));
    writeJson(temporaryRoot, `specs/${specId}/${route.triageArtifact}`, triageArtifact(route));
    writeJson(temporaryRoot, `specs/${specId}/${route.repairArtifact}`, repairArtifact(route));
    const reviewFile = new DraftReviewArtifactFile({ specDir, filename: route.reviewArtifact });
    state.draftReviewRevisions = {
      [route.retryPhase]: createDraftReviewRevisionBinding({
        phase: route.retryPhase,
        reviewArtifact: route.reviewArtifact,
        reviewArtifactDigest: reviewFile.digest,
        revision: reviewed,
        recordedAt: GENERATED_AT,
      }).toJSON(),
    };

    const result = validateDraftReviewArtifactSet(specDir, route, state);
    assert.equal(result.issues.length, 0, result.issues.join("\n"));
  });

  for (const scenario of [
    { label: "worktree", inWorktree: true },
    { label: "non-worktree", inWorktree: false },
  ]) {
    it(`publishes and validates ${scenario.label} triage before marking the step done`, () => {
      temporaryRoot = createTmpDir(`draft-review-${scenario.label}-triage-promotion-`);
      const mainRoot = path.join(temporaryRoot, "main");
      const executionRoot = scenario.inWorktree
        ? path.join(temporaryRoot, "worktree")
        : mainRoot;
      const route = draftReviewRouteForKey("questions");
      const specId = `498-${scenario.label}-triage-promotion`;
      fs.mkdirSync(mainRoot, { recursive: true });
      fs.mkdirSync(executionRoot, { recursive: true });
      const state = moveFlowToStep(makeFlowState({
        specId,
        runId: `run-${scenario.label}-triage-promotion`,
        worktree: scenario.inWorktree,
      }), route.triageStepId);
      state.draftArtifactRevision = revisionFor(state, "draft", "a".repeat(64));
      writeJson(mainRoot, `specs/${specId}/${route.reviewArtifact}`, reviewArtifact(state.draftArtifactRevision, route));
      const reviewFile = new DraftReviewArtifactFile({
        specDir: path.join(mainRoot, "specs", specId),
        filename: route.reviewArtifact,
      });
      state.draftReviewRevisions = {
        [route.retryPhase]: createDraftReviewRevisionBinding({
          phase: route.retryPhase,
          reviewArtifact: route.reviewArtifact,
          reviewArtifactDigest: reviewFile.digest,
          revision: state.draftArtifactRevision,
          recordedAt: GENERATED_AT,
        }).toJSON(),
      };
      writeJson(executionRoot, `specs/${specId}/${route.triageArtifact}`, triageArtifact(route));
      const flowManager = new FlowManager({
        root: executionRoot,
        mainRoot,
        inWorktree: scenario.inWorktree,
        specId,
      });
      flowManager.create(state);
      const transition = new NormalStepTransition({
        stepId: route.triageStepId,
        currentStepId: route.triageStepId,
        currentStatus: "in_progress",
        requestedStatus: "done",
      });

      const completed = completeDraftReviewArtifactStep({
        mainRoot,
        executionRoot,
        flowManager,
        state: flowManager.load(),
        transition,
      });

      assert.equal(completed.promoted, scenario.inWorktree);
      assert.equal(findStepById(flowManager.load().steps, route.triageStepId).status, "done");
      assert.equal(
        fs.readFileSync(path.join(mainRoot, "specs", specId, route.triageArtifact), "utf8"),
        fs.readFileSync(path.join(executionRoot, "specs", specId, route.triageArtifact), "utf8"),
      );
    });
  }

  it("rejects an empty worktree triage that lost canonical review targets", () => {
    temporaryRoot = createTmpDir("draft-review-empty-triage-");
    const mainRoot = path.join(temporaryRoot, "main");
    const executionRoot = path.join(temporaryRoot, "worktree");
    const route = draftReviewRouteForKey("questions");
    const specId = "498-empty-triage";
    fs.mkdirSync(mainRoot, { recursive: true });
    fs.mkdirSync(executionRoot, { recursive: true });
    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-empty-triage",
      worktree: true,
    }), route.triageStepId);
    state.draftArtifactRevision = revisionFor(state, "draft", "a".repeat(64));
    writeJson(mainRoot, `specs/${specId}/${route.reviewArtifact}`, reviewArtifact(state.draftArtifactRevision, route));
    registerDraftReviewRevision({
      root: mainRoot,
      state,
      flowManager: {
        mutate(mutator) { mutator(state); },
      },
      route,
    });
    writeJson(executionRoot, `specs/${specId}/${route.triageArtifact}`, triageArtifact(route, { items: [] }));
    const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
    flowManager.create(state);
    const transition = new NormalStepTransition({
      stepId: route.triageStepId,
      currentStepId: route.triageStepId,
      currentStatus: "in_progress",
      requestedStatus: "done",
    });

    assert.throws(
      () => completeDraftReviewArtifactStep({
        mainRoot,
        executionRoot,
        flowManager,
        state: flowManager.load(),
        transition,
      }),
      (error) => error instanceof DraftReviewArtifactRecoveryError
        && error.code === "DRAFT_REVIEW_ARTIFACT_INVALID",
    );
    assert.equal(findStepById(flowManager.load().steps, route.triageStepId).status, "in_progress");
    assert.equal(fs.existsSync(path.join(mainRoot, "specs", specId, route.triageArtifact)), false);
  });

  it("updates approval bytes and the recorded revision in one recoverable canonical mutation", () => {
    temporaryRoot = createTmpDir("draft-review-approval-revision-");
    const specId = "498-approval-revision";
    const state = makeFlowState({ specId, runId: "run-approval-revision" });
    const draftPath = writeJson(temporaryRoot, `specs/${specId}/draft.json`, {
      goal: "Keep approval revision-aligned.",
      qa: [{ status: "answered" }],
      approval: { approved: false, confirmedAt: "", notes: "" },
    });
    state.draftArtifactRevision = createInitialDraftArtifactRevision({ state, draftPath }).toJSON();
    state.draftArtifactRevision.sourceStepId = "draft-refine";
    const flowManager = new FlowManager({ root: temporaryRoot, mainRoot: temporaryRoot, specId });
    flowManager.create(state);

    completeCanonicalDraftMutation({
      root: temporaryRoot,
      flowManager,
      state: flowManager.load(),
      sourceStepId: "draft-coverage-review",
      mutateDocument(draft) {
        draft.approval = { ...draft.approval, approved: true, confirmedAt: GENERATED_AT };
        return draft;
      },
    });

    const bytes = fs.readFileSync(draftPath);
    const current = flowManager.load();
    assert.equal(current.draftArtifactPromotion, undefined);
    assert.equal(current.draftArtifactRevision.sourceStepId, "draft-coverage-review");
    assert.equal(current.draftArtifactRevision.byteLength, bytes.length);
    assert.equal(current.draftArtifactRevision.digest, crypto.createHash("sha256").update(bytes).digest("hex"));
  });

  it("reopens directly from draft-gate and invalidates obsolete route bindings", async () => {
    temporaryRoot = createTmpDir("draft-gate-reopen-");
    const specId = "498-draft-gate-reopen";
    const state = moveFlowToStep(makeFlowState({ specId, runId: "run-draft-gate-reopen" }), "draft-gate");
    state.draftReviewRevisions = {
      "draft-questions": {
        version: 1,
        phase: "draft-questions",
        reviewArtifact: "draft-review-questions.json",
        reviewArtifactDigest: "a".repeat(64),
        revision: revisionFor(state, "draft", "b".repeat(64)),
        recordedAt: GENERATED_AT,
      },
    };
    writeJson(temporaryRoot, `specs/${specId}/draft.json`, { goal: "Recover from draft-gate." });
    const flowManager = new FlowManager({ root: temporaryRoot, mainRoot: temporaryRoot, specId });
    flowManager.create(state);

    const result = await new RunReopenDraftCommand().execute({
      root: temporaryRoot,
      flowManager,
      flowState: flowManager.load(),
      reason: "recover canonical draft review evidence",
    });

    const reopened = flowManager.load();
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.previousActiveStep, "draft-gate");
    assert.equal(findStepById(reopened.steps, "draft").status, "in_progress");
    assert.equal(findStepById(reopened.steps, "draft-gate").status, "pending");
    assert.equal(reopened.draftReviewRevisions, undefined);
  });
});
