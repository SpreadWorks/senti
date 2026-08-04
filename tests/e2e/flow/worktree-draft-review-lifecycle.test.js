import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import {
  registerDraftReviewRevision,
  validateDraftReviewArtifacts,
} from "../../../src/flow/lib/draft-review-artifacts.js";
import {
  createInitialDraftArtifactRevision,
} from "../../../src/flow/lib/draft-artifact-promotion.js";
import { draftReviewRouteForKey } from "../../../src/flow/lib/draft-review-routes.js";
import { checkDraftJson, runGateFlow } from "../../../src/flow/lib/run-gate.js";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { findActiveNode } from "../../../src/flow/definition.js";
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

function writeReview(root, specId, route, revision, verdict) {
  const finding = {
    title: "Preserve canonical authority",
    target: "goal",
    rationale: "The worktree repair must consume base-side review evidence.",
    evidence: "The route review is stored under the base spec directory.",
    classification: "repair_target",
  };
  writeJson(root, `specs/${specId}/${route.reviewArtifact}`, {
    version: 2,
    phase: route.retryPhase,
    sourceDraft: "draft.json",
    sourceDraftRevision: revision,
    generatedAt: GENERATED_AT,
    verdict,
    summary: verdict === "PASS" ? "No findings." : "One canonical repair is required.",
    blockingFindings: [],
    advisoryFindings: [],
    repairTargets: verdict === "PASS" ? [] : [finding],
  });
}

function reviewResult(route, verdict) {
  return {
    result: "ok",
    changed: [],
    artifacts: {
      phase: "draft",
      retryPhase: route.retryPhase,
      verdict,
      issueCount: verdict === "PASS" ? 0 : 1,
    },
    next: verdict === "PASS" ? route.passNextStepId : route.triageStepId,
  };
}

function setStepContext({ mainRoot, executionRoot, flowManager, id }) {
  return {
    root: mainRoot,
    executionRoot,
    flowManager,
    flowState: flowManager.load(),
    specId: flowManager.load().specId,
    id,
    status: "done",
  };
}

describe("worktree draft review lifecycle", () => {
  let temporaryRoot;

  afterEach(() => {
    if (temporaryRoot) removeTmpDir(temporaryRoot);
    temporaryRoot = null;
  });

  it("passes questions ADVISORY through canonical repair, refine, coverage PASS, and draft-gate", async () => {
    temporaryRoot = createTmpDir("worktree-draft-review-lifecycle-");
    const mainRoot = path.join(temporaryRoot, "main");
    const executionRoot = path.join(temporaryRoot, "worktree");
    const specId = "498-worktree-lifecycle";
    const specPath = `specs/${specId}/draft.json`;
    const questions = draftReviewRouteForKey("questions");
    const coverage = draftReviewRouteForKey("coverage");
    writeJson(mainRoot, ".senti/config.json", {
      name: "draft-review-lifecycle",
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    const initialDraft = {
      devType: "bugfix",
      goal: "Keep worktree Flow evidence canonical.",
      analysis: {
        problem: "Worktree artifacts and base review evidence are disconnected.",
        proposedApproach: "Publish and validate artifacts through base-side CLI authority.",
        validation: "Run the complete worktree draft review lifecycle and gate.",
      },
      decisionMap: {
        knownFacts: ["The review command owns base-side evidence."],
        decisionPoints: ["The completion command publishes worker artifacts."],
        resolvedByProjectRules: ["Flow state is agent-independent."],
        requiresUserJudgment: [],
        deferredToSpec: [],
      },
      qa: [{
        id: "q1",
        status: "answered",
        category: "impact-scope",
        question: "Which authority owns draft review evidence?",
        answer: "The base-side spec directory.",
        evidence: "The review command publishes there.",
        why: "The gate reads canonical evidence.",
        considered: "The execution worktree.",
        droppedReason: "",
      }],
      openQuestions: [],
      approval: { approved: false, confirmedAt: "", notes: "" },
    };
    const canonicalDraftPath = writeJson(mainRoot, specPath, initialDraft);
    writeJson(executionRoot, specPath, initialDraft);
    let state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-worktree-lifecycle",
      worktree: true,
    }), questions.reviewStepId);
    state.draftArtifactRevision = createInitialDraftArtifactRevision({
      state,
      draftPath: canonicalDraftPath,
    }).toJSON();
    state.draftArtifactRevision.sourceStepId = "draft";
    const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
    flowManager.create(state);

    writeReview(mainRoot, specId, questions, state.draftArtifactRevision, "ADVISORY");
    registerDraftReviewRevision({
      root: mainRoot,
      state: flowManager.load(),
      flowManager,
      route: questions,
    });
    await FLOW_COMMANDS.run.review.post({
      root: mainRoot,
      executionRoot,
      phase: "draft",
      flowState: flowManager.load(),
      flowManager,
    }, reviewResult(questions, "ADVISORY"));
    assert.equal(findActiveNode(flowManager.load()).stepId, questions.triageStepId);

    writeJson(executionRoot, `specs/${specId}/${questions.triageArtifact}`, {
      version: 1,
      phase: questions.triageStepId,
      sourceReview: questions.reviewArtifact,
      generatedAt: GENERATED_AT,
      summary: "Apply the canonical repair target.",
      items: [{
        title: "Preserve canonical authority",
        target: "goal",
        decision: "apply",
        rationale: "The review evidence is authoritative.",
        evidence: "The base-side review contains this target.",
      }],
    });
    const triageResult = await new SetStepCommand().execute(setStepContext({
      mainRoot,
      executionRoot,
      flowManager,
      id: questions.triageStepId,
    }));
    assert.equal(triageResult.promoted, true, JSON.stringify(triageResult));
    assert.equal(findActiveNode(flowManager.load()).stepId, questions.repairStepId);

    const repairedDraft = { ...initialDraft, goal: "Keep all Flow evidence under base-side authority." };
    writeJson(executionRoot, specPath, repairedDraft);
    writeJson(executionRoot, `specs/${specId}/${questions.repairArtifact}`, {
      version: 1,
      phase: questions.repairStepId,
      sourceTriage: questions.triageArtifact,
      generatedAt: GENERATED_AT,
      summary: "Applied the canonical authority repair.",
      items: [{
        title: "Preserve canonical authority",
        target: "goal",
        rationale: "The draft now states the canonical owner.",
        evidence: "The goal field was changed.",
        changedFieldPaths: ["goal"],
      }],
    });
    const repairResult = await new SetStepCommand().execute(setStepContext({
      mainRoot,
      executionRoot,
      flowManager,
      id: questions.repairStepId,
    }));
    assert.equal(repairResult.promoted, true, JSON.stringify(repairResult));
    assert.equal(flowManager.load().draftArtifactRevision.sourceStepId, questions.repairStepId);
    assert.equal(findActiveNode(flowManager.load()).stepId, "draft-refine");

    const refinedDraft = {
      ...repairedDraft,
      analysis: { ...repairedDraft.analysis, problem: "Canonical authority is explicit and guarded." },
    };
    writeJson(executionRoot, specPath, refinedDraft);
    const refineResult = await new SetStepCommand().execute(setStepContext({
      mainRoot,
      executionRoot,
      flowManager,
      id: "draft-refine",
    }));
    assert.equal(refineResult.promoted, true, JSON.stringify(refineResult));
    assert.equal(flowManager.load().draftArtifactRevision.sourceStepId, "draft-refine");
    assert.equal(findActiveNode(flowManager.load()).stepId, coverage.reviewStepId);

    state = flowManager.load();
    writeReview(mainRoot, specId, coverage, state.draftArtifactRevision, "PASS");
    registerDraftReviewRevision({
      root: mainRoot,
      state,
      flowManager,
      route: coverage,
    });
    await FLOW_COMMANDS.run.review.post({
      root: mainRoot,
      executionRoot,
      phase: "draft",
      flowState: flowManager.load(),
      flowManager,
    }, reviewResult(coverage, "PASS"));
    state = flowManager.load();
    assert.equal(findActiveNode(state).stepId, "draft-gate");
    assert.equal(state.draftArtifactRevision.sourceStepId, coverage.reviewStepId);

    const canonicalDraft = JSON.parse(fs.readFileSync(canonicalDraftPath, "utf8"));
    const gateResult = await runGateFlow({
      root: mainRoot,
      config: {},
      level: "parent",
      phase: "draft",
      targetPath: specPath,
      targetText: JSON.stringify(canonicalDraft),
      textCheck: () => [
        ...checkDraftJson(canonicalDraft),
        ...validateDraftReviewArtifacts(mainRoot, specPath, canonicalDraft, state),
      ],
      skipGuardrail: true,
    });
    assert.equal(gateResult.result, "pass", JSON.stringify(gateResult));
  });
});
