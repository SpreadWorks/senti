import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { findActiveNode } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const GENERATED_AT = "2026-08-04T00:00:00.000Z";
const SENTI_CLI = path.join(process.cwd(), "src/senti.js");

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

function makeDraft() {
  return {
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
}

function parseGeneratedCommand(command) {
  return command.match(/'[^']*'|\S+/g).map((token) => (
    token.startsWith("'") && token.endsWith("'") ? token.slice(1, -1) : token
  ));
}

function invokeSenti(root, args) {
  try {
    const output = execFileSync("node", [SENTI_CLI, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: root },
    });
    return { exitCode: 0, envelope: JSON.parse(output) };
  } catch (error) {
    const output = error.stdout?.toString() || "";
    return { exitCode: error.status ?? 1, envelope: output ? JSON.parse(output) : null };
  }
}

function runSenti(root, args) {
  const result = invokeSenti(root, args);
  assert.equal(result.exitCode, 0, JSON.stringify(result.envelope));
  return result.envelope;
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
    const initialDraft = makeDraft();
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

    writeReview(executionRoot, specId, questions, state.draftArtifactRevision, "PASS");
    const triageAction = await new GetNextActionCommand().execute({
      root: mainRoot,
      mainRoot,
      executionRoot,
      flowManager,
      flowState: flowManager.load(),
    });
    assert.equal(triageAction.step, questions.triageStepId);
    assert.equal(triageAction.context.draftReview.authority, "canonical-base");
    assert.equal(triageAction.context.draftReview.outputArtifact.name, questions.triageArtifact);
    assert.equal(
      triageAction.context.draftReview.outputArtifact.filePath,
      path.join(mainRoot, "specs", specId, questions.triageArtifact),
    );
    const canonicalReview = triageAction.context.draftReview.artifacts
      .find((artifact) => artifact.name === questions.reviewArtifact)?.document;
    assert.equal(canonicalReview.verdict, "ADVISORY");
    const canonicalRepairTarget = canonicalReview.repairTargets[0];
    writeJson(path.dirname(triageAction.context.draftReview.outputArtifact.filePath), questions.triageArtifact, {
      version: 1,
      phase: questions.triageStepId,
      sourceReview: questions.reviewArtifact,
      generatedAt: GENERATED_AT,
      summary: "Apply the canonical repair target.",
      items: [{
        title: canonicalRepairTarget.title,
        target: canonicalRepairTarget.target,
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
    assert.equal(triageResult.promoted, false, JSON.stringify(triageResult));
    assert.equal(findActiveNode(flowManager.load()).stepId, questions.repairStepId);

    const repairAction = await new GetNextActionCommand().execute({
      root: mainRoot,
      mainRoot,
      executionRoot,
      flowManager,
      flowState: flowManager.load(),
    });
    assert.equal(repairAction.step, questions.repairStepId);
    assert.equal(repairAction.context.draftReview.outputArtifact.name, questions.repairArtifact);
    assert.equal(
      repairAction.context.draftReview.outputArtifact.filePath,
      path.join(mainRoot, "specs", specId, questions.repairArtifact),
    );
    const canonicalTriage = repairAction.context.draftReview.artifacts
      .find((artifact) => artifact.name === questions.triageArtifact)?.document;
    assert.equal(canonicalTriage.items.length, 1);
    assert.equal(canonicalTriage.items[0].decision, "apply");
    const repairedDraft = { ...initialDraft, goal: "Keep all Flow evidence under base-side authority." };
    writeJson(executionRoot, specPath, repairedDraft);
    writeJson(path.dirname(repairAction.context.draftReview.outputArtifact.filePath), questions.repairArtifact, {
      version: 1,
      phase: questions.repairStepId,
      sourceTriage: questions.triageArtifact,
      generatedAt: GENERATED_AT,
      summary: "Applied the canonical authority repair.",
      items: [{
        title: canonicalTriage.items[0].title,
        target: canonicalTriage.items[0].target,
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

  it("executes the CLI-suggested draft-gate recovery and reruns fresh review evidence to PASS", async () => {
    temporaryRoot = createTmpDir("draft-gate-recovery-roundtrip-");
    const root = temporaryRoot;
    const specId = "498-draft-gate-roundtrip";
    const specPath = `specs/${specId}/draft.json`;
    const questions = draftReviewRouteForKey("questions");
    const coverage = draftReviewRouteForKey("coverage");
    writeJson(root, ".senti/config.json", {
      name: "draft-gate-recovery-roundtrip",
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    const draftPath = writeJson(root, specPath, makeDraft());
    initGitRepo(root);
    commitAll(root, "baseline");

    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-draft-gate-roundtrip",
      baseBranch: "main",
      featureBranch: "main",
    }), "draft-gate");
    state.draftArtifactRevision = createInitialDraftArtifactRevision({ state, draftPath }).toJSON();
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
    flowManager.create(state);
    flowManager.addActiveFlow(specId, "local");

    const failedGateInvocation = invokeSenti(root, ["flow", "run", "gate", "--phase", "draft"]);
    assert.equal(failedGateInvocation.exitCode, 1);
    assert.equal(failedGateInvocation.envelope.errors[0].code, "DRAFT_GATE_REOPEN_REQUIRED");
    assert.match(
      failedGateInvocation.envelope.data.artifacts.recoveryCommand,
      /^senti flow run reopen-draft /,
    );
    const failedState = flowManager.load();
    const failedAttempt = failedState.stepAttempts.at(-1);
    assert.equal(failedAttempt.stepId, "draft-gate");
    assert.equal(failedAttempt.outcome.kind, "external-blocked");
    assert.equal(failedAttempt.outcome.failureCode, "DRAFT_GATE_REOPEN_REQUIRED");
    const failedGateStep = findStepById(failedState.steps, "draft-gate");
    assert.equal(failedGateStep.runtimeLog.runId, failedState.runId);
    assert.equal(failedGateStep.runtimeLog.exitCode, 1);
    assert.ok(Number.isSafeInteger(failedGateStep.runtimeLog.sequence));
    const failedIssueLog = JSON.parse(fs.readFileSync(path.join(root, "specs", specId, "issue-log.json"), "utf8"));
    const failedGateLog = failedIssueLog.entries.at(-1);
    assert.equal(failedGateLog.step, "draft-gate");
    assert.equal(failedGateLog.phase, "draft");
    assert.match(failedGateLog.reason, /missing draft review artifact/);

    const nextActionEnvelope = runSenti(root, ["flow", "get", "next-action"]);
    const recoveryDirective = nextActionEnvelope.data.directive;
    assert.equal(recoveryDirective.kind, "execute_command");
    assert.equal(recoveryDirective.actionId, "RECOVER_EXTERNAL_BLOCK");
    const recoveryArgv = parseGeneratedCommand(recoveryDirective.nextAction);
    assert.equal(recoveryArgv.shift(), "senti");
    const recoveryEnvelope = runSenti(root, recoveryArgv);
    assert.equal(recoveryEnvelope.ok, true, JSON.stringify(recoveryEnvelope));
    assert.equal(findStepById(flowManager.load().steps, "draft").status, "in_progress");
    assert.equal(flowManager.load().draftReviewRevisions, undefined);

    const draftResult = await new SetStepCommand().execute(setStepContext({
      mainRoot: root,
      executionRoot: root,
      flowManager,
      id: "draft",
    }));
    assert.equal(draftResult.promoted, false);
    let current = flowManager.load();
    assert.equal(findActiveNode(current).stepId, questions.reviewStepId);

    writeReview(root, specId, questions, current.draftArtifactRevision, "PASS");
    registerDraftReviewRevision({ root, state: current, flowManager, route: questions });
    await FLOW_COMMANDS.run.review.post({
      root,
      executionRoot: root,
      phase: "draft",
      flowState: flowManager.load(),
      flowManager,
    }, reviewResult(questions, "PASS"));
    assert.equal(findActiveNode(flowManager.load()).stepId, "draft-refine");

    await new SetStepCommand().execute(setStepContext({
      mainRoot: root,
      executionRoot: root,
      flowManager,
      id: "draft-refine",
    }));
    current = flowManager.load();
    assert.equal(findActiveNode(current).stepId, coverage.reviewStepId);
    writeReview(root, specId, coverage, current.draftArtifactRevision, "PASS");
    registerDraftReviewRevision({ root, state: current, flowManager, route: coverage });
    await FLOW_COMMANDS.run.review.post({
      root,
      executionRoot: root,
      phase: "draft",
      flowState: flowManager.load(),
      flowManager,
    }, reviewResult(coverage, "PASS"));
    current = flowManager.load();
    assert.equal(findActiveNode(current).stepId, "draft-gate");

    const canonicalDraft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
    const passedGate = await runGateFlow({
      root,
      config: {},
      level: "parent",
      phase: "draft",
      targetPath: specPath,
      targetText: JSON.stringify(canonicalDraft),
      textCheck: () => [
        ...checkDraftJson(canonicalDraft),
        ...validateDraftReviewArtifacts(root, specPath, canonicalDraft, current),
      ],
      skipGuardrail: true,
    });
    assert.equal(passedGate.result, "pass", JSON.stringify(passedGate));
  });
});
