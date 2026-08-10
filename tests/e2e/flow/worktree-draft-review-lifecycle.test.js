import assert from "node:assert/strict";
import crypto from "node:crypto";
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
import {
  WorkerArtifactHandoffCoordinator,
  sealWorkerArtifactHandoff,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import { findActiveNode } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../../src/lib/worktree-flow-binding.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const GENERATED_AT = "2026-08-04T00:00:00.000Z";
const SENNEL_CLI = path.join(process.cwd(), "src/sennel.js");

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

function publishWorkerArtifacts({ mainRoot, executionRoot, flowManager, writePayloads }) {
  const state = flowManager.load();
  const stepId = findActiveNode(state).stepId;
  const receiptCount = state.workerArtifactReceipts?.length || 0;
  const invocationId = `draft-review-e2e-${stepId}-${receiptCount}`;
  const actionDigest = crypto.createHash("sha256")
    .update(`${state.runId}:${invocationId}`)
    .digest("hex");
  const coordinator = new WorkerArtifactHandoffCoordinator();
  const ctx = {
    root: executionRoot,
    mainRoot,
    executionRoot,
    flowManager,
    specId: state.specId,
  };
  const request = coordinator.createRequest({
    ctx,
    state,
    invocation: {
      id: invocationId,
      target: { digest: crypto.createHash("sha256").update(`target:${state.runId}`).digest("hex") },
      action: { digest: actionDigest, nextAction: { step: stepId } },
    },
  });
  assert.ok(request, `${stepId} must use a worker artifact handoff`);
  writePayloads(request);
  sealWorkerArtifactHandoff({
    requestPath: request.requestPath,
    invocationId,
  });
  return coordinator.reconcile({ ctx, request });
}

function writePayloadJson(request, logicalName, value) {
  fs.writeFileSync(request.payloadPath(logicalName), `${JSON.stringify(value, null, 2)}\n`);
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

function invokeSennel(root, args) {
  try {
    const output = execFileSync("node", [SENNEL_CLI, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: root },
    });
    return { exitCode: 0, envelope: JSON.parse(output) };
  } catch (error) {
    const output = error.stdout?.toString() || "";
    return { exitCode: error.status ?? 1, envelope: output ? JSON.parse(output) : null };
  }
}

function runSennel(root, args) {
  const result = invokeSennel(root, args);
  assert.equal(result.exitCode, 0, JSON.stringify(result.envelope));
  return result.envelope;
}

describe("worktree draft review lifecycle", () => {
  let temporaryRoot;

  afterEach(() => {
    if (temporaryRoot) removeTmpDir(temporaryRoot);
    temporaryRoot = null;
  });

  it("passes canonical questions and coverage repairs through a worktree draft-gate", async () => {
    temporaryRoot = createTmpDir("worktree-draft-review-lifecycle-");
    const mainRoot = path.join(temporaryRoot, "main");
    const executionRoot = path.join(temporaryRoot, "worktree");
    const specId = "498-worktree-lifecycle";
    const specPath = `specs/${specId}/draft.json`;
    const questions = draftReviewRouteForKey("questions");
    const coverage = draftReviewRouteForKey("coverage");
    writeJson(mainRoot, ".sennel/config.json", {
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
      request: "Exercise the canonical draft review lifecycle.",
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
    const questionsTriage = {
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
    };
    const triageResult = publishWorkerArtifacts({
      mainRoot,
      executionRoot,
      flowManager,
      writePayloads(request) {
        writePayloadJson(request, questions.triageArtifact, questionsTriage);
      },
    });
    assert.equal(triageResult.completed, true, JSON.stringify(triageResult));
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
    const questionsRepair = {
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
    };
    const repairResult = publishWorkerArtifacts({
      mainRoot,
      executionRoot,
      flowManager,
      writePayloads(request) {
        writePayloadJson(request, questions.repairArtifact, questionsRepair);
        writePayloadJson(request, "draft.json", repairedDraft);
      },
    });
    assert.equal(repairResult.completed, true, JSON.stringify(repairResult));
    assert.equal(flowManager.load().draftArtifactRevision.sourceStepId, questions.repairStepId);
    assert.equal(findActiveNode(flowManager.load()).stepId, "draft-refine");

    const refinedDraft = {
      ...repairedDraft,
      analysis: { ...repairedDraft.analysis, problem: "Canonical authority is explicit and guarded." },
    };
    const refineResult = publishWorkerArtifacts({
      mainRoot,
      executionRoot,
      flowManager,
      writePayloads(request) {
        writePayloadJson(request, "draft.json", refinedDraft);
      },
    });
    assert.equal(refineResult.completed, true, JSON.stringify(refineResult));
    assert.equal(flowManager.load().draftArtifactRevision.sourceStepId, "draft-refine");
    assert.equal(findActiveNode(flowManager.load()).stepId, coverage.reviewStepId);

    state = flowManager.load();
    writeReview(mainRoot, specId, coverage, state.draftArtifactRevision, "ADVISORY");
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
    }, reviewResult(coverage, "ADVISORY"));
    assert.equal(findActiveNode(flowManager.load()).stepId, coverage.triageStepId);

    const coverageTriageAction = await new GetNextActionCommand().execute({
      root: mainRoot,
      mainRoot,
      executionRoot,
      flowManager,
      flowState: flowManager.load(),
    });
    const coverageFinding = coverageTriageAction.context.draftReview.artifacts
      .find((artifact) => artifact.name === coverage.reviewArtifact)?.document.repairTargets[0];
    const coverageTriageDocument = {
      version: 1,
      phase: coverage.triageStepId,
      sourceReview: coverage.reviewArtifact,
      generatedAt: GENERATED_AT,
      summary: "Apply the canonical coverage repair target.",
      items: [{
        title: coverageFinding.title,
        target: coverageFinding.target,
        decision: "apply",
        rationale: "The coverage review requires canonical approval evidence.",
        evidence: "The base-side coverage review contains the target.",
      }],
    };
    publishWorkerArtifacts({
      mainRoot,
      executionRoot,
      flowManager,
      writePayloads(request) {
        writePayloadJson(request, coverage.triageArtifact, coverageTriageDocument);
      },
    });
    assert.equal(findActiveNode(flowManager.load()).stepId, coverage.repairStepId);

    const coverageRepairAction = await new GetNextActionCommand().execute({
      root: mainRoot,
      mainRoot,
      executionRoot,
      flowManager,
      flowState: flowManager.load(),
    });
    const coverageTriage = coverageRepairAction.context.draftReview.artifacts
      .find((artifact) => artifact.name === coverage.triageArtifact)?.document;
    const coverageRepairedDraft = {
      ...refinedDraft,
      goal: "Keep canonical coverage evidence and approval aligned.",
      approval: { approved: true, confirmedAt: GENERATED_AT, notes: "" },
    };
    const coverageRepairDocument = {
      version: 1,
      phase: coverage.repairStepId,
      sourceTriage: coverage.triageArtifact,
      generatedAt: GENERATED_AT,
      summary: "Applied the canonical coverage repair.",
      items: [{
        title: coverageTriage.items[0].title,
        target: coverageTriage.items[0].target,
        rationale: "The draft now records coverage approval.",
        evidence: "The canonical draft approval is true.",
        changedFieldPaths: ["goal", "approval"],
      }],
    };
    const coverageRepairResult = publishWorkerArtifacts({
      mainRoot,
      executionRoot,
      flowManager,
      writePayloads(request) {
        writePayloadJson(request, coverage.repairArtifact, coverageRepairDocument);
        writePayloadJson(request, "draft.json", coverageRepairedDraft);
      },
    });
    assert.equal(coverageRepairResult.completed, true, JSON.stringify(coverageRepairResult));
    state = flowManager.load();
    assert.equal(findActiveNode(state).stepId, "draft-gate");
    assert.equal(state.draftArtifactRevision.sourceStepId, coverage.repairStepId);

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
    writeJson(root, ".sennel/config.json", {
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
      request: "Recover and rerun the draft gate.",
    }), "draft-gate");
    state.draftArtifactRevision = createInitialDraftArtifactRevision({ state, draftPath }).toJSON();
    const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
    flowManager.create(state);
    flowManager.addActiveFlow(specId, "local");

    const failedGateInvocation = invokeSennel(root, ["flow", "run", "gate", "--phase", "draft"]);
    assert.equal(failedGateInvocation.exitCode, 1);
    assert.equal(failedGateInvocation.envelope.errors[0].code, "DRAFT_GATE_REOPEN_REQUIRED");
    assert.match(
      failedGateInvocation.envelope.data.artifacts.recoveryCommand,
      /^sennel flow run reopen-draft /,
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

    const nextActionEnvelope = runSennel(root, ["flow", "get", "next-action"]);
    const recoveryDirective = nextActionEnvelope.data.directive;
    assert.equal(recoveryDirective.kind, "execute_command");
    assert.equal(recoveryDirective.actionId, "RECOVER_EXTERNAL_BLOCK");
    const recoveryArgv = parseGeneratedCommand(recoveryDirective.nextAction);
    assert.equal(recoveryArgv.shift(), "sennel");
    const recoveryEnvelope = runSennel(root, recoveryArgv);
    assert.equal(recoveryEnvelope.ok, true, JSON.stringify(recoveryEnvelope));
    assert.equal(findStepById(flowManager.load().steps, "draft").status, "in_progress");
    assert.equal(flowManager.load().draftReviewRevisions, undefined);

    const draftResult = publishWorkerArtifacts({
      mainRoot: root,
      executionRoot: root,
      flowManager,
      writePayloads(request) {
        writePayloadJson(request, "draft.json", JSON.parse(fs.readFileSync(draftPath, "utf8")));
      },
    });
    assert.equal(draftResult.completed, true);
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

    publishWorkerArtifacts({
      mainRoot: root,
      executionRoot: root,
      flowManager,
      writePayloads(request) {
        writePayloadJson(request, "draft.json", JSON.parse(fs.readFileSync(draftPath, "utf8")));
      },
    });
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

  it("executes the guarded draft-gate recovery from a managed worktree", () => {
    temporaryRoot = createTmpDir("draft-gate-worktree-recovery-");
    const mainRoot = path.join(temporaryRoot, "main");
    const executionRoot = path.join(temporaryRoot, "worktree");
    const specId = "499-worktree-recovery";
    const featureBranch = "feature/499-worktree-recovery";
    const draftPath = writeJson(mainRoot, `specs/${specId}/draft.json`, makeDraft());
    writeJson(mainRoot, ".sennel/config.json", {
      name: "draft-gate-worktree-recovery",
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    initGitRepo(mainRoot);
    commitAll(mainRoot, "fixture baseline");
    execFileSync("git", ["worktree", "add", "-q", "-b", featureBranch, executionRoot], {
      cwd: mainRoot,
    });
    const state = moveFlowToStep(makeFlowState({
      specId,
      runId: "run-worktree-recovery",
      baseBranch: "main",
      featureBranch,
      worktree: true,
      request: "Recover the worktree draft gate.",
    }), "draft-gate");
    state.draftArtifactRevision = createInitialDraftArtifactRevision({ state, draftPath }).toJSON();
    const flowManager = new FlowManager({ root: mainRoot, mainRoot, inWorktree: false, specId });
    flowManager.create(state);
    flowManager.addActiveFlow(specId, "worktree");
    new WorktreeFlowBindingStore({ worktreePath: executionRoot }).save(new WorktreeFlowIdentity({
      runId: state.runId,
      issue: null,
      specId,
      worktreePath: executionRoot,
    }));

    const failedGate = invokeSennel(executionRoot, ["flow", "run", "gate", "--phase", "draft"]);
    assert.equal(failedGate.exitCode, 1);
    assert.equal(failedGate.envelope.errors[0].code, "DRAFT_GATE_REOPEN_REQUIRED");
    const nextAction = runSennel(executionRoot, ["flow", "get", "next-action"]);
    assert.equal(nextAction.data.directive.actionId, "RECOVER_EXTERNAL_BLOCK");
    const recoveryArgv = parseGeneratedCommand(nextAction.data.directive.nextAction);
    assert.equal(recoveryArgv.shift(), "sennel");

    const recovery = runSennel(executionRoot, recoveryArgv);

    assert.equal(recovery.ok, true, JSON.stringify(recovery));
    const reopened = flowManager.loadReadOnly(specId);
    const canonicalBytes = fs.readFileSync(draftPath);
    assert.equal(findStepById(reopened.steps, "draft").status, "in_progress");
    assert.equal(reopened.draftReviewRevisions, undefined);
    assert.equal(
      reopened.draftArtifactRevision.digest,
      crypto.createHash("sha256").update(canonicalBytes).digest("hex"),
    );
  });
});
