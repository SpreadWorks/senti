import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  DraftReviewArtifactFile,
  DraftReviewArtifactRecoveryError,
  completeDraftReviewArtifactStep,
  completeDraftReviewRepairStep,
  registerDraftReviewRevision,
  validateDraftReviewArtifactSet,
} from "../../../src/flow/lib/draft-review-artifacts.js";
import { createDraftReviewRevisionBinding } from "../../../src/flow/lib/draft-review-revision.js";
import {
  completeDraftArtifactStep,
  completeCanonicalDraftMutation,
  createInitialDraftArtifactRevision,
} from "../../../src/flow/lib/draft-artifact-promotion.js";
import { draftReviewRouteForKey } from "../../../src/flow/lib/draft-review-routes.js";
import RunReviewCommand from "../../../src/flow/lib/run-review.js";
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

  it("rejects a schema-invalid canonical review before recording its route binding", () => {
    temporaryRoot = createTmpDir("draft-review-invalid-binding-");
    const route = draftReviewRouteForKey("questions");
    const specId = "498-invalid-review-binding";
    const state = makeFlowState({ specId, runId: "run-invalid-review-binding" });
    state.draftArtifactRevision = revisionFor(state, "draft", "a".repeat(64));
    const invalid = reviewArtifact(state.draftArtifactRevision, route);
    invalid.repairTargets[0] = { title: "Missing traceability" };
    writeJson(temporaryRoot, `specs/${specId}/${route.reviewArtifact}`, invalid);

    assert.throws(
      () => registerDraftReviewRevision({
        root: temporaryRoot,
        state,
        flowManager: { mutate() { throw new Error("binding mutation must not run"); } },
        route,
      }),
      /target must be non-empty/,
    );
    assert.equal(state.draftReviewRevisions, undefined);
  });

  for (const scenario of [
    { label: "worktree", inWorktree: true },
    { label: "non-worktree", inWorktree: false },
  ]) {
    it(`validates canonical ${scenario.label} triage before marking the step done`, () => {
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
      writeJson(mainRoot, `specs/${specId}/${route.triageArtifact}`, triageArtifact(route));
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

      assert.equal(completed.promoted, false);
      assert.equal(findStepById(flowManager.load().steps, route.triageStepId).status, "done");
      assert.equal(fs.existsSync(path.join(mainRoot, "specs", specId, route.triageArtifact)), true);
    });
  }

  it("rejects a valid triage that exists only in the worktree authority", () => {
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
    writeJson(executionRoot, `specs/${specId}/${route.triageArtifact}`, triageArtifact(route));
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
        && error.code === "DRAFT_REVIEW_ARTIFACT_WRONG_AUTHORITY"
        && error.data.canonicalPath === path.join(mainRoot, "specs", specId, route.triageArtifact),
    );
    assert.equal(findStepById(flowManager.load().steps, route.triageStepId).status, "in_progress");
    assert.equal(fs.existsSync(path.join(mainRoot, "specs", specId, route.triageArtifact)), false);
  });

  it("keeps repair in progress until a valid canonical repair artifact exists", () => {
    temporaryRoot = createTmpDir("draft-review-repair-guard-");
    const mainRoot = path.join(temporaryRoot, "main");
    const executionRoot = path.join(temporaryRoot, "worktree");
    const route = draftReviewRouteForKey("questions");
    const specId = "498-repair-guard";
    fs.mkdirSync(mainRoot, { recursive: true });
    fs.mkdirSync(executionRoot, { recursive: true });
    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-repair-guard",
      worktree: true,
    }), route.repairStepId);
    state.draftArtifactRevision = revisionFor(state, "draft", "a".repeat(64));
    writeJson(mainRoot, `specs/${specId}/${route.reviewArtifact}`, reviewArtifact(state.draftArtifactRevision, route));
    writeJson(mainRoot, `specs/${specId}/${route.triageArtifact}`, triageArtifact(route));
    registerDraftReviewRevision({
      root: mainRoot,
      state,
      flowManager: { mutate(mutator) { mutator(state); } },
      route,
    });
    const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
    flowManager.create(state);
    const transition = new NormalStepTransition({
      stepId: route.repairStepId,
      currentStepId: route.repairStepId,
      currentStatus: "in_progress",
      requestedStatus: "done",
    });
    const complete = () => completeDraftReviewArtifactStep({
      mainRoot,
      executionRoot,
      flowManager,
      state: flowManager.load(),
      transition,
    });

    assert.throws(
      complete,
      (error) => error instanceof DraftReviewArtifactRecoveryError
        && error.code === "DRAFT_REVIEW_ARTIFACT_INVALID",
    );
    assert.equal(findStepById(flowManager.load().steps, route.repairStepId).status, "in_progress");

    writeJson(executionRoot, `specs/${specId}/${route.repairArtifact}`, repairArtifact(route));
    assert.throws(
      complete,
      (error) => error instanceof DraftReviewArtifactRecoveryError
        && error.code === "DRAFT_REVIEW_ARTIFACT_WRONG_AUTHORITY",
    );
    assert.equal(findStepById(flowManager.load().steps, route.repairStepId).status, "in_progress");
    assert.equal(fs.existsSync(path.join(mainRoot, "specs", specId, route.repairArtifact)), false);

    const invalidRepair = repairArtifact(route);
    delete invalidRepair.items[0].changedFieldPaths;
    writeJson(mainRoot, `specs/${specId}/${route.repairArtifact}`, invalidRepair);
    assert.throws(
      complete,
      (error) => error instanceof DraftReviewArtifactRecoveryError
        && error.code === "DRAFT_REVIEW_ARTIFACT_INVALID",
    );
    assert.equal(findStepById(flowManager.load().steps, route.repairStepId).status, "in_progress");
  });

  it("reports missing triage and repair evidence independently", () => {
    temporaryRoot = createTmpDir("draft-review-missing-route-evidence-");
    const route = draftReviewRouteForKey("coverage");
    const specId = "499-missing-route-evidence";
    const state = makeFlowState({ specId, runId: "run-missing-route-evidence" });
    state.draftArtifactRevision = revisionFor(state, "draft-refine", "a".repeat(64));
    const specDir = path.join(temporaryRoot, "specs", specId);
    writeJson(temporaryRoot, `specs/${specId}/${route.reviewArtifact}`, reviewArtifact(
      state.draftArtifactRevision,
      route,
    ));

    const result = validateDraftReviewArtifactSet(specDir, route, state);

    assert.ok(result.issues.some((issue) => issue.includes(`${route.triageArtifact}: missing draft triage artifact`)));
    assert.ok(result.issues.some((issue) => issue.includes(`${route.repairArtifact}: missing draft repair artifact`)));
  });

  it("binds coverage repair evidence to the same atomic transition as draft promotion", () => {
    temporaryRoot = createTmpDir("draft-coverage-repair-atomic-");
    const mainRoot = path.join(temporaryRoot, "main");
    const executionRoot = path.join(temporaryRoot, "worktree");
    const route = draftReviewRouteForKey("coverage");
    const specId = "499-coverage-repair-atomic";
    fs.mkdirSync(mainRoot, { recursive: true });
    fs.mkdirSync(executionRoot, { recursive: true });
    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-coverage-repair-atomic",
      worktree: true,
    }), route.triageStepId);
    const canonicalDraftPath = writeJson(mainRoot, `specs/${specId}/draft.json`, {
      goal: "Approve only through the coverage repair transaction.",
      approval: { approved: false, confirmedAt: "" },
    });
    writeJson(executionRoot, `specs/${specId}/draft.json`, {
      goal: "Approve only through the coverage repair transaction.",
      approval: { approved: true, confirmedAt: GENERATED_AT },
    });
    state.draftArtifactRevision = createInitialDraftArtifactRevision({
      state,
      draftPath: canonicalDraftPath,
    }).toJSON();
    state.draftArtifactRevision.sourceStepId = "draft-refine";
    writeJson(mainRoot, `specs/${specId}/${route.reviewArtifact}`, reviewArtifact(
      state.draftArtifactRevision,
      route,
    ));
    writeJson(mainRoot, `specs/${specId}/${route.triageArtifact}`, triageArtifact(route));
    registerDraftReviewRevision({
      root: mainRoot,
      state,
      flowManager: { mutate(mutator) { mutator(state); } },
      route,
    });
    const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
    flowManager.create(state);
    completeDraftReviewArtifactStep({
      mainRoot,
      executionRoot,
      flowManager,
      state: flowManager.load(),
      transition: new NormalStepTransition({
        stepId: route.triageStepId,
        currentStepId: route.triageStepId,
        currentStatus: "in_progress",
        requestedStatus: "done",
      }),
    });
    const repairPath = writeJson(mainRoot, `specs/${specId}/${route.repairArtifact}`, repairArtifact(route));
    const repairTransition = new NormalStepTransition({
      stepId: route.repairStepId,
      currentStepId: route.repairStepId,
      currentStatus: "in_progress",
      requestedStatus: "done",
    });
    let changed = false;

    assert.throws(
      () => completeDraftReviewRepairStep({
        mainRoot,
        executionRoot,
        flowManager,
        state: flowManager.load(),
        transition: repairTransition,
        faultInjector({ phase }) {
          if (changed || phase !== "after-draft-review-artifact-validation") return;
          changed = true;
          const replacement = repairArtifact(route);
          replacement.summary = "The canonical repair evidence changed after validation.";
          fs.writeFileSync(repairPath, `${JSON.stringify(replacement, null, 2)}\n`);
        },
      }),
      (error) => error instanceof DraftReviewArtifactRecoveryError
        && error.code === "DRAFT_REVIEW_ARTIFACT_CHANGED",
    );
    const interrupted = flowManager.load();
    assert.equal(findStepById(interrupted.steps, route.repairStepId).status, "in_progress");
    assert.ok(interrupted.draftArtifactPromotion);

    const completed = completeDraftReviewRepairStep({
      mainRoot,
      executionRoot,
      flowManager,
      state: interrupted,
      transition: repairTransition,
    });
    const current = flowManager.load();
    const canonicalBytes = fs.readFileSync(canonicalDraftPath);
    assert.equal(findStepById(current.steps, route.repairStepId).status, "done");
    assert.equal(current.draftArtifactPromotion, undefined);
    assert.equal(current.draftArtifactRevision.sourceStepId, route.repairStepId);
    assert.equal(current.draftArtifactRevision.digest, crypto.createHash("sha256").update(canonicalBytes).digest("hex"));
    assert.equal(completed.digest, crypto.createHash("sha256").update(fs.readFileSync(repairPath)).digest("hex"));
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

  it("replays an interrupted coverage PASS mutation before downstream review continues", async () => {
    temporaryRoot = createTmpDir("draft-review-pass-recovery-");
    const route = draftReviewRouteForKey("coverage");
    const specId = "500-review-pass-recovery";
    const state = moveFlowToStep(
      makeFlowState({ specId, runId: "run-review-pass-recovery" }),
      route.reviewStepId,
    );
    const draftPath = writeJson(temporaryRoot, `specs/${specId}/draft.json`, {
      goal: "Recover approval publication.",
      qa: [{ status: "answered" }],
      approval: { approved: false, confirmedAt: "", notes: "" },
    });
    state.draftArtifactRevision = createInitialDraftArtifactRevision({ state, draftPath }).toJSON();
    state.draftArtifactRevision.sourceStepId = "draft-refine";
    writeJson(
      temporaryRoot,
      `specs/${specId}/${route.reviewArtifact}`,
      reviewArtifact(state.draftArtifactRevision, route, { verdict: "PASS" }),
    );
    const flowManager = new FlowManager({ root: temporaryRoot, mainRoot: temporaryRoot, specId });
    flowManager.create(state);
    registerDraftReviewRevision({
      root: temporaryRoot,
      state: flowManager.load(),
      flowManager,
      route,
    });

    assert.throws(
      () => completeCanonicalDraftMutation({
        root: temporaryRoot,
        flowManager,
        state: flowManager.load(),
        sourceStepId: route.reviewStepId,
        mutateDocument(draft) {
          draft.approval = { ...draft.approval, approved: true, confirmedAt: GENERATED_AT };
          return draft;
        },
        faultInjector({ phase }) {
          if (phase === "before-draft-rename") throw new Error("simulated PASS interruption");
        },
      }),
      (error) => error.code === "DRAFT_PROMOTION_RECOVERY_REQUIRED",
    );
    assert.ok(flowManager.load().draftArtifactPromotion);

    let providerCalls = 0;
    const recovered = await new RunReviewCommand({
      runCommand() {
        providerCalls += 1;
        throw new Error("the review provider must not rerun during PASS recovery");
      },
    }).execute({
      root: temporaryRoot,
      flowManager,
      flowState: flowManager.load(),
      phase: "draft",
    });
    const current = flowManager.load();
    const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
    assert.equal(providerCalls, 0);
    assert.equal(recovered.result, "ok");
    assert.equal(recovered.artifacts.verdict, "PASS");
    assert.equal(recovered.artifacts.retryPhase, route.retryPhase);
    assert.equal(recovered.artifacts.recoveredInterruptedPassCommit, true);
    assert.equal(current.draftArtifactPromotion, undefined);
    assert.equal(current.draftArtifactRevision.sourceStepId, route.reviewStepId);
    assert.equal(draft.approval.approved, true);
    assert.equal(draft.approval.confirmedAt, GENERATED_AT);
    assert.equal(fs.existsSync(path.join(path.dirname(draftPath), route.triageArtifact)), true);
    assert.equal(fs.existsSync(path.join(path.dirname(draftPath), route.repairArtifact)), true);

    const replayedAfterCommit = await new RunReviewCommand({
      runCommand() {
        providerCalls += 1;
        throw new Error("the review provider must not rerun after PASS commit");
      },
    }).execute({
      root: temporaryRoot,
      flowManager,
      flowState: current,
      phase: "draft",
    });
    assert.equal(providerCalls, 0);
    assert.equal(replayedAfterCommit.artifacts.recoveredInterruptedPassCommit, true);
  });

  for (const sourceStep of ["draft-questions-review", "draft-coverage-review", "draft-gate"]) {
    it(`reopens directly from ${sourceStep} and invalidates obsolete route bindings`, async () => {
      temporaryRoot = createTmpDir(`${sourceStep}-reopen-`);
      const specId = `499-${sourceStep}-reopen`;
      const state = moveFlowToStep(makeFlowState({ specId, runId: `run-${sourceStep}-reopen` }), sourceStep);
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
      const draftPath = writeJson(
        temporaryRoot,
        `specs/${specId}/draft.json`,
        { goal: `Recover from ${sourceStep}.` },
      );
      const flowManager = new FlowManager({ root: temporaryRoot, mainRoot: temporaryRoot, specId });
      flowManager.create(state);

      const result = await new RunReopenDraftCommand().execute({
        root: temporaryRoot,
        flowManager,
        flowState: flowManager.load(),
        reason: "recover canonical draft review evidence",
      });

      const reopened = flowManager.load();
      const draftBytes = fs.readFileSync(draftPath);
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.data.previousActiveStep, sourceStep);
      assert.equal(findStepById(reopened.steps, "draft").status, "in_progress");
      assert.equal(findStepById(reopened.steps, sourceStep).status, "pending");
      assert.equal(reopened.draftReviewRevisions, undefined);
      assert.equal(reopened.draftArtifactRevision.sourceStepId, "draft");
      assert.equal(reopened.draftArtifactRevision.byteLength, draftBytes.length);
      assert.equal(
        reopened.draftArtifactRevision.digest,
        crypto.createHash("sha256").update(draftBytes).digest("hex"),
      );
    });
  }

  it("rebaselines stale canonical bytes so a worktree draft can complete after reopen", async () => {
    temporaryRoot = createTmpDir("draft-gate-worktree-rebaseline-");
    const mainRoot = path.join(temporaryRoot, "main");
    const executionRoot = path.join(temporaryRoot, "worktree");
    const specId = "499-worktree-rebaseline";
    fs.mkdirSync(mainRoot, { recursive: true });
    fs.mkdirSync(executionRoot, { recursive: true });
    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-worktree-rebaseline",
      worktree: true,
    }), "draft-gate");
    const originalDraft = { goal: "Old finalized draft.", approval: { approved: false } };
    const canonicalDraftPath = writeJson(mainRoot, `specs/${specId}/draft.json`, originalDraft);
    writeJson(executionRoot, `specs/${specId}/draft.json`, originalDraft);
    state.draftArtifactRevision = createInitialDraftArtifactRevision({
      state,
      draftPath: canonicalDraftPath,
    }).toJSON();
    state.draftArtifactRevision.sourceStepId = "draft-refine";
    writeJson(mainRoot, `specs/${specId}/draft.json`, {
      ...originalDraft,
      approval: { approved: true },
    });
    const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
    flowManager.create(state);

    const reopenedResult = await new RunReopenDraftCommand().execute({
      root: mainRoot,
      flowManager,
      flowState: flowManager.load(),
      reason: "recover a stale coverage bookkeeping revision",
    });
    assert.equal(reopenedResult.ok, true, JSON.stringify(reopenedResult));
    const reopened = flowManager.load();
    const canonicalBytes = fs.readFileSync(canonicalDraftPath);
    assert.equal(
      reopened.draftArtifactRevision.digest,
      crypto.createHash("sha256").update(canonicalBytes).digest("hex"),
    );

    writeJson(executionRoot, `specs/${specId}/draft.json`, {
      goal: "Recovered worktree draft.",
      approval: { approved: false },
    });
    const completed = completeDraftArtifactStep({
      mainRoot,
      executionRoot,
      flowManager,
      state: reopened,
      transition: new NormalStepTransition({
        stepId: "draft",
        currentStepId: "draft",
        currentStatus: "in_progress",
        requestedStatus: "done",
      }),
    });
    assert.equal(completed.promoted, true);
    assert.equal(flowManager.load().draftArtifactRevision.digest, completed.revision.digest);
  });
});
