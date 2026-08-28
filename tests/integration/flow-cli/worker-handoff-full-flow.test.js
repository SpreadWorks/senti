import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";
import {
  flowArtifactAuthorityForStep,
  WORKER_ARTIFACT_HANDOFF_STEPS,
  WORKER_SOURCE_HANDOFF_STEPS,
} from "../../../src/flow/lib/flow-artifact-authority.js";
import { deriveNextAction, findActiveNode } from "../../../src/flow/definition.js";
import {
  sealWorkerArtifactHandoff,
  WorkerArtifactHandoffCoordinator,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { FlowTargetBinding } from "../../../src/lib/flow-target-guard.js";
import {
  FlowArtifactAttemptHistory,
  FlowArtifactAttemptRecord,
} from "../../../src/lib/flow-artifact-contract.js";
import {
  canonicalFixtureProducerResult,
  canonicalImplReviewArtifact,
  CanonicalFlowFixture,
  confirmCanonicalFixtureStep,
} from "../../support/infrastructure/flow-setup.js";
import { commitAll, initGitRepo } from "../../support/infrastructure/git-repo.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { validWorkerHandoffSpec, workerArtifactJson } from "../../support/infrastructure/worker-artifact.js";

const TASK_ID = "T1";
const PREPARATION_LEAVES = new Set(["branch", "prepare-spec"]);
const USER_DECISION_LEAF = "acceptance-decision";

function plannedTask() {
  return {
    id: TASK_ID,
    title: "Task one",
    goal: "Exercise task effects.",
    acceptance: ["The task effect is recorded."],
    implementation_notes: "Exercise the command-owned fixture path.",
    test_strategy: "Run the focused full-flow fixture.",
    parent: null,
    origin: "plan",
    added_round: 0,
    status: "pending",
  };
}

function sourceEffect(stepId) {
  const base = {
    version: 1,
    stepId,
    completionStatus: "done",
    files: [],
    issues: [],
    overview: null,
    triage: null,
    repair: null,
  };
  if (stepId === "implement") {
    return {
      ...base,
      files: [{ requirementId: "R1", paths: ["src/implementation.js"] }],
    };
  }
  if (stepId === "impl-triage") {
    return {
      ...base,
      triage: { dispositions: [{ findingKey: "F1", disposition: "apply", rationale: "The reviewed source change must be applied." }] },
    };
  }
  if (stepId === "impl-repair") {
    return {
      ...base,
      files: [{ requirementId: "R1", paths: ["src/repair.js"] }],
      repair: { appliedFindingKeys: ["F1"], summary: "Applied the reviewed implementation correction." },
    };
  }
  if (stepId === "task-impl") {
    return {
      ...base,
      files: [{ requirementId: "R1", paths: ["src/task.js"] }],
      overview: { modules: ["Task implementation module."], data_flow: [], decisions: [] },
    };
  }
  throw new Error(`unexpected source step: ${stepId}`);
}

function payloadPath(request, logicalName) {
  const payload = request.payloads.find((entry) => entry.logicalName === logicalName);
  assert.notEqual(payload, undefined, logicalName);
  return payload.payloadPath;
}

function inputDocument(request, name) {
  return request.inputs.find((entry) => entry.name === name)?.document ?? null;
}

function repairValueDigest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function emptyQuestionLedgerDraft(goal = "full flow") {
  return {
    devType: "feature",
    goal,
    analysis: { problem: "Exercise the full flow.", proposedApproach: "Publish canonical artifacts.", validation: "Complete every deterministic step." },
    decisionMap: { knownFacts: [], decisionPoints: [], resolvedByProjectRules: [], requiresUserJudgment: [], deferredToSpec: [] },
    questionLedger: { revision: 0, publication: "fixture", evidenceDigest: "a".repeat(64), questions: [] },
    approval: { approved: true },
  };
}

function writeArtifactPayload(stepId, request, specRepairAttempt = 1) {
  if (["draft", "draft-refine"].includes(stepId)) {
    fs.writeFileSync(payloadPath(request, "draft.json"), workerArtifactJson(inputDocument(request, "draft.json") ?? emptyQuestionLedgerDraft()));
    return;
  }
  if (stepId === "spec") {
    fs.writeFileSync(payloadPath(request, "spec.json"), workerArtifactJson({
      ...validWorkerHandoffSpec(),
      tasks: [plannedTask()],
    }));
    return;
  }
  if (stepId === "test") {
    fs.writeFileSync(path.join(payloadPath(request, "spec-tests"), "full-flow.test.js"), [
      "// spec: R1",
      'import test from "node:test";',
      'test("R1: publishes the validated artifact", () => {});',
      "",
    ].join("\n"));
    return;
  }
  if (["draft-questions-triage", "draft-coverage-triage"].includes(stepId)) {
    const prefix = stepId.replace("-triage", "");
    fs.writeFileSync(payloadPath(request, `${stepId}.json`), workerArtifactJson({
      version: 1, phase: stepId,
      sourceReview: prefix === "draft-questions" ? "draft-review-questions.json" : "draft-review-coverage.json",
      summary: "No repair required.", items: [],
    }));
    return;
  }
  if (["draft-questions-repair", "draft-coverage-repair"].includes(stepId)) {
    fs.writeFileSync(payloadPath(request, `${stepId}.json`), workerArtifactJson(
      stepId === "draft-questions-repair"
        ? {}
        : { version: 1, baseRevision: `sha256:${request.inputRevision}`, operations: [] },
    ));
    return;
  }
  if (stepId === "spec-triage") {
    const requirementTarget = { entity: "requirement", id: "R1", field: "desc" };
    fs.writeFileSync(payloadPath(request, "spec-triage.json"), workerArtifactJson({
      version: 1, phase: "spec-triage", sourceReview: "spec-review.json", summary: "Apply the finding.",
      items: [{ findingId: "spec-review-blocking-1", title: "Bind publication", target: "requirements[0]", decision: "apply", rationale: "The finding is valid.", evidence: "The requirement owns publication.", allowedTargets: [
        { target: requirementTarget, operationKinds: ["replace-entity-field"] },
        { target: { entity: "spec", field: "background" }, operationKinds: ["replace-field"] },
      ], requiredTargets: [requirementTarget, { entity: "spec", field: "background" }] }],
    }));
    return;
  }
  if (stepId === "spec-repair") {
    const target = specRepairAttempt === 1
      ? { entity: "requirement", id: "R1", field: "desc" }
      : { entity: "spec", field: "background" };
    const previous = specRepairAttempt === 1
      ? "Publish a validated artifact."
      : "The worker cannot write canonical Flow artifacts.";
    fs.writeFileSync(payloadPath(request, "spec-repair.json"), workerArtifactJson({
      version: 1,
      baseRevision: `sha256:${request.inputRevision}`, scopeExpansions: [],
      operations: specRepairAttempt === 1
        ? [{ findingId: "spec-review-blocking-1", kind: "replace-entity-field", target, expectedDigest: repairValueDigest(previous), replacement: "The requirement retains publication authority.", reason: "The requirement is explicit." }]
        : [{ findingId: "spec-review-blocking-1", kind: "replace-field", target, expectedDigest: repairValueDigest(previous), replacement: "The background retains publication authority.", reason: "The remaining required target is explicit." }],
    }));
    return;
  }
  const name = `${stepId}.json`;
  fs.writeFileSync(payloadPath(request, name), workerArtifactJson({ version: 1, phase: stepId, items: [], summary: "Deterministic handoff." }));
}

function writeSourcePayload(stepId, request, executionRoot) {
  const changed = {
    implement: "src/implementation.js",
    "impl-repair": "src/repair.js",
    "task-impl": "src/task.js",
  }[stepId];
  if (changed) {
    fs.mkdirSync(path.dirname(path.join(executionRoot, changed)), { recursive: true });
    fs.writeFileSync(path.join(executionRoot, changed), `// ${stepId}\n`);
  }
  fs.writeFileSync(payloadPath(request, "effects.json"), workerArtifactJson(sourceEffect(stepId)));
}

function publishAttemptArtifact(flowManager, specId, nodeId, logicalKey, payload, histories) {
  const history = histories.get(logicalKey) ?? new FlowArtifactAttemptHistory();
  const next = history.append(new FlowArtifactAttemptRecord({
    attempt: history.sequence.next(),
    payload: { nodeId, outcome: "completed", result: { result: "ok" }, artifact: { logicalKey, payload } },
  }));
  histories.set(logicalKey, next);
  const bytes = Buffer.from(`${JSON.stringify(next.toJSON(), null, 2)}\n`);
  flowManager.publishArtifacts({ specId, nodeId, artifactWrites: [{ logicalKey, mediaType: "application/json", bytes }] });
}

function commandArtifacts(stepId, flowManager, specId, implReviewRuns, histories) {
  if (["draft-questions-review", "draft-coverage-review"].includes(stepId)) {
    const draft = flowManager.readArtifact({ specId, logicalKey: "draft", consumerNodeId: stepId });
    const revision = {
      version: 1, runId: flowManager.load().runId, specId,
      sourceStepId: stepId === "draft-coverage-review" ? "draft-refine" : "draft",
      digest: crypto.createHash("sha256").update(draft.bytes).digest("hex"),
      byteLength: draft.bytes.length, finalizedAt: "2026-08-14T00:00:00.000Z",
    };
    publishAttemptArtifact(flowManager, specId, stepId,
      stepId === "draft-questions-review" ? "draft.questions.review" : "draft.coverage.review", {
        version: 2,
        phase: stepId === "draft-questions-review" ? "draft-questions" : "draft-coverage",
        sourceDraft: "draft.json", sourceDraftRevision: revision,
        generatedAt: "2026-08-14T00:00:00.000Z", verdict: "PASS", summary: "No findings.",
        blockingFindings: [], advisoryFindings: [], repairTargets: [],
      }, histories);
  }
  if (stepId === "spec-review") {
    publishAttemptArtifact(flowManager, specId, stepId, "spec.review", {
      version: 1, phase: "spec", generatedAt: "2026-08-14T00:00:00.000Z", verdict: "REJECTED",
      blockingFindings: [{ findingId: "spec-review-blocking-1", title: "Bind publication", target: "requirements[0]" }], nonBlockingImprovements: [],
    }, histories);
  }
  if (stepId === "impl-review") {
    const finding = {
      findingKey: "F1",
      title: "Repair the implementation",
      failureMode: "missing_requirement_behavior",
      file: "src/implementation.js",
      requirementId: "R1",
      guardrailId: null,
      issue: "The first implementation review requires the deterministic repair.",
      suggestion: "Apply the cataloged implementation repair.",
      disposition: "must-fix",
      rationale: "R1 requires the repaired implementation behavior.",
    };
    const findings = implReviewRuns === 1
      ? [finding]
      : [];
    publishAttemptArtifact(flowManager, specId, stepId, "impl.review", canonicalImplReviewArtifact(
      flowManager.load(),
      {
      blockingFindings: findings,
      },
    ), histories);
  }
}

function actionFor(route) {
  const derived = deriveNextAction({ scope: route.taskId === null ? "flow" : "task", stepId: route.stepId });
  assert.notEqual(derived, null, `${route.taskId ?? "flow"}.${route.stepId}`);
  if (route.stepId === USER_DECISION_LEAF) {
    return {
      taskId: null,
      step: route.stepId,
      action: derived.action,
      instructions: { key: derived.instructionsKey, content: "Await the explicit acceptance decision." },
      context: {}, output_schema: {}, requires_approval: false,
      directive: {
        kind: "await_user_decision", terminal: false, requiresUserAction: true,
        actionPrompt: {
          question: "Accept the verified implementation?",
          choices: [
            { actionId: "ACCEPT_FLOW", label: "Accept", stateTransition: "accept", impact: { retains: ["validated implementation"] } },
            { actionId: "REJECT_FLOW", label: "Reject", stateTransition: "reject", impact: { changes: ["implementation"] } },
          ],
          recommendedActionId: "ACCEPT_FLOW",
          recommendationReason: "The deterministic test fixture accepts the verified route.",
        },
        reason: "An explicit acceptance decision is required.",
      },
    };
  }
  return {
    taskId: route.taskId,
    step: route.stepId,
    action: derived.action,
    instructions: { key: derived.instructionsKey, content: `Execute ${route.stepId}.` },
    context: {}, output_schema: {}, requires_approval: derived.requiresApproval === true,
    ...(derived.autoApproveChoiceId ? { auto_approval_choice_id: derived.autoApproveChoiceId } : {}),
    directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: derived.action },
  };
}

describe("deterministic full Flow worker handoff", () => {
  it("routes artifacts and source effects to workers, and commands/approval to the parent", async () => {
    const temporaryRoot = createTmpDir("worker-handoff-full-");
    try {
      const mainRoot = path.join(temporaryRoot, "main");
      const executionRoot = path.join(temporaryRoot, "execution");
      fs.mkdirSync(mainRoot, { recursive: true });
      fs.mkdirSync(executionRoot, { recursive: true });
      initGitRepo(executionRoot);
      fs.writeFileSync(path.join(executionRoot, "README.md"), "fixture\n");
      commitAll(executionRoot, "fixture baseline");
      const specId = "500-worker-handoff-full-flow";
      const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
      const fixture = new CanonicalFlowFixture({
        flowManager, specId, runId: "run-worker-handoff-full-flow",
        execution: { mode: "worktree", baseBranch: "main", featureBranch: "feature/worker-handoff-full-flow" },
      }).create().activate("draft");
      const binding = FlowTargetBinding.capture({
        flowState: fixture.state(),
        mainRoot,
        authorityRoot: executionRoot,
        worktreePath: executionRoot,
      }).serialize();
      const guardedAction = (entry) => ({ ...actionFor(entry), binding });

      const staticRoute = fixture.leaves().map((step) => step.id).filter((id) => !PREPARATION_LEAVES.has(id));
      const taskRoute = ["task-impl", "task-review", "task-gate"].map((stepId) => ({ stepId, taskId: TASK_ID }));
      const implementationIndex = staticRoute.indexOf("implement");
      const initialImplementation = staticRoute.slice(implementationIndex);
      const repairIndex = initialImplementation.indexOf("impl-repair");
      const firstImplGate = initialImplementation.indexOf("impl-gate");
      const route = [
        ...staticRoute.slice(0, implementationIndex + 1).map((stepId) => ({ stepId, taskId: null })),
        ...taskRoute,
        ...initialImplementation.slice(1, repairIndex + 1).map((stepId) => ({ stepId, taskId: null })),
        ...["test-execute", "test-result-review", "impl-review", "impl-gate"].map((stepId) => ({ stepId, taskId: null })),
        ...initialImplementation.slice(firstImplGate + 1).map((stepId) => ({ stepId, taskId: null })),
      ];
      let position = 0;
      const workerSteps = [];
      const parentCommands = [];
      let handoffCount = 0;
      let specRepairCalls = 0;
      let rejectedRepairSnapshot = null;
      let implReviewRuns = 0;
      const commandArtifactHistories = new Map();
      const coordinator = new WorkerArtifactHandoffCoordinator();
      const commandPublishedPrimaryArtifact = new Set([
        "draft-questions-review",
        "draft-coverage-review",
        "spec-review",
        "impl-review",
      ]);

      const routeNodeId = (entry) => entry.taskId === null ? entry.stepId : `${entry.taskId}-${entry.stepId.slice("task-".length)}`;
      const activate = (entry) => {
        const state = flowManager.load();
        const nodeId = routeNodeId(entry);
        if (state.currentNodeId === nodeId) return;
        if (entry.taskId !== null && entry.stepId === "task-impl") flowManager.startTask(entry.taskId, { specId });
        else flowManager.updateStepStatus({ stepId: nodeId, requestedStatus: "in_progress" }, { specId });
      };
      const advance = (entry) => {
        const nodeId = routeNodeId(entry);
        const active = flowManager.load();
        const current = active.currentNodeId;
        if (entry.stepId === "impl-review" && implReviewRuns === 2) {
          // A passing flow-level implementation review takes the definition's
          // fixed no-finding route: triage and repair complete without a
          // worker, then impl-gate becomes the active command leaf.
          flowManager.updateStepStatus({ stepId: nodeId, requestedStatus: "done" }, { specId });
          flowManager.updateStepStatus({ stepId: "impl-triage", requestedStatus: "done" }, { specId });
          flowManager.updateStepStatus({ stepId: "impl-repair", requestedStatus: "done" }, { specId });
          position += 1;
          if (position < route.length) activate(route[position]);
          return;
        }
        if (current === nodeId) {
          if (entry.stepId === "task-gate" || entry.stepId === "impl-gate") {
            confirmCanonicalFixtureStep(flowManager, specId, nodeId);
          } else {
            const canonicalCommandResult = commandPublishedPrimaryArtifact.has(entry.stepId)
              ? null
              : canonicalFixtureProducerResult(active, nodeId, { flowManager, specId });
            flowManager.updateStepStatus(
              { stepId: nodeId, requestedStatus: "done" },
              { specId, ...(canonicalCommandResult === null ? {} : { canonicalCommandResult }) },
            );
          }
        } else {
          // Worker-handoff confirmation is itself the canonical Attempt
          // transition, so it has already completed this leaf before the
          // test advances its deterministic route cursor.
          assert.notEqual(current, nodeId, `${nodeId} must not remain active after handoff confirmation`);
        }
        position += 1;
        if (position < route.length) activate(route[position]);
      };

      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            const entry = route[position];
            if (!entry) return { taskId: null, step: null, action: "completed", instructions: null, context: null, output_schema: null, requires_approval: false, binding, directive: { kind: "completed", terminal: true, requiresUserAction: false } };
            const nodeId = routeNodeId(entry);
            if (flowManager.load().currentNodeId !== nodeId && entry.stepId === "approval") {
              // The parent continuation already confirmed the approval Attempt.
              position += 1;
              activate(route[position]);
              return guardedAction(route[position]);
            }
            activate(entry);
            return guardedAction(entry);
          },
        },
        agent: {
          async call(_prompt, options) {
            const invocation = JSON.parse(options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION);
            const stepId = invocation.action.step;
            const requestPath = options.executionEnvironment.SENNEL_FLOW_HANDOFF_REQUEST;
            assert.equal(typeof requestPath, "string", `${stepId} must have a sealed handoff request`);
            const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
            if (stepId === "spec-repair") {
              if (specRepairCalls === 0) {
                rejectedRepairSnapshot = flowManager.readCanonicalTransitionSnapshot(specId).toJSON();
              } else {
                assert.deepEqual(
                  flowManager.readCanonicalTransitionSnapshot(specId).toJSON(),
                  rejectedRepairSnapshot,
                  "a rejected correction must not change spec, Flow, activities, catalog, step, or semantic retry state",
                );
              }
            }
            if (stepId === "task-impl") {
              const current = flowManager.load();
              assert.deepEqual(
                findActiveNode(current),
                { scope: "task", taskId: TASK_ID, stepId: "T1-impl" },
                JSON.stringify({ currentNodeId: current.currentNodeId, currentTaskId: current.currentTaskId }, null, 2),
              );
            }
            workerSteps.push(stepId);
            handoffCount += 1;
            try {
              if (WORKER_SOURCE_HANDOFF_STEPS.includes(stepId)) writeSourcePayload(stepId, request, executionRoot);
              else writeArtifactPayload(stepId, request, stepId === "spec-repair" ? ++specRepairCalls : 1);
              sealWorkerArtifactHandoff({ requestPath, invocationId: options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION_ID });
            } catch (error) {
              throw new Error(`${stepId} worker fixture failed: ${error.message}`, { cause: error });
            }
          },
        },
        commandRunner: async ({ command }) => {
          const entry = route[position];
          assert.equal(entry.stepId, command.commandName === "review" ? entry.stepId : entry.stepId);
          parentCommands.push(entry.stepId);
          if (entry.stepId === "impl-review") implReviewRuns += 1;
          commandArtifacts(entry.stepId, flowManager, specId, implReviewRuns, commandArtifactHistories);
          advance(entry);
          return command.commandName === "finalize-cleanup"
            ? { ok: true, data: { status: "done", assurance: { completed: true } }, errors: [] }
            : { ok: true, data: {}, errors: [] };
        },
        repositoryFingerprint: () => `full-flow-${position}`,
        maxDispatches: 64,
        leaseFactory: () => ({ acquire() {}, release() {} }),
        handoffCoordinator: {
          recoverPending(input) { return coordinator.recoverPending(input); },
          createRequest(input) { return coordinator.createRequest(input); },
          reconcile(input) {
            const result = coordinator.reconcile(input);
            advance(route[position]);
            return result;
          },
        },
      });
      dispatcher.container = {};
      const baseCtx = {
        root: executionRoot, executionRoot, mainRoot, specId, flowManager,
        flowState: flowManager.load(), expectBinding: binding,
        _envelopeType: "run", _envelopeKey: "dispatch",
      };

      const beforeApproval = await dispatcher.execute(baseCtx);
      assert.equal(beforeApproval.dispatch?.boundary, "approval_required", JSON.stringify(beforeApproval, null, 2));
      assert.equal(beforeApproval.dispatch.binding, binding);
      assert.equal(workerSteps.includes("approval"), false);
      const afterApproval = await dispatcher.execute({ ...baseCtx, approve: beforeApproval.dispatch.approvalToken });
      assert.equal(afterApproval.dispatch?.boundary, "await_user_decision", JSON.stringify({ afterApproval, workerSteps, parentCommands, position }, null, 2));
      assert.equal(afterApproval.dispatch.binding, binding);
      assert.equal(workerSteps.includes(USER_DECISION_LEAF), false);
      advance(route[position]); // Explicit user decision is outside dispatcher/worker ownership.
      const beforeFinalize = await dispatcher.execute(baseCtx);
      assert.equal(beforeFinalize.dispatch?.boundary, "approval_required", JSON.stringify(beforeFinalize));
      assert.equal(beforeFinalize.dispatch.binding, binding);
      const completed = await dispatcher.execute({ ...baseCtx, approve: beforeFinalize.dispatch.approvalToken });

      const artifactWorkers = workerSteps.filter((stepId) => WORKER_ARTIFACT_HANDOFF_STEPS.includes(stepId));
      const sourceWorkers = workerSteps.filter((stepId) => WORKER_SOURCE_HANDOFF_STEPS.includes(stepId));
      assert.equal(completed.dispatch?.boundary, "completed", JSON.stringify(completed));
      assert.deepEqual(new Set(artifactWorkers), new Set(WORKER_ARTIFACT_HANDOFF_STEPS));
      assert.deepEqual(new Set(sourceWorkers), new Set(WORKER_SOURCE_HANDOFF_STEPS));
      assert.equal(specRepairCalls, 2, "the constrained repair must make one correction call");
      assert.equal(handoffCount, WORKER_ARTIFACT_HANDOFF_STEPS.length + WORKER_SOURCE_HANDOFF_STEPS.length + 1);
      assert.equal(workerSteps.some((stepId) => flowArtifactAuthorityForStep(stepId)?.category === "command"), false);
      assert.equal(parentCommands.every((stepId) => flowArtifactAuthorityForStep(stepId)?.category === "command"), true);
      assert.equal(
        parentCommands.length,
        route.filter((entry) => flowArtifactAuthorityForStep(entry.stepId)?.category === "command").length,
        "every command-owned route leaf must execute once, including the repaired implementation cycle",
      );
      assert.deepEqual(
        new Set(parentCommands),
        new Set(route.filter((entry) => flowArtifactAuthorityForStep(entry.stepId)?.category === "command").map((entry) => entry.stepId)),
      );
      assert.equal(parentCommands.includes("branch"), false);
      assert.equal(parentCommands.includes("prepare-spec"), false);
      assert.equal(implReviewRuns, 2, "impl-repair must restart the test/review route");
      assert.equal(position, route.length);
      assert.equal(
        beforeApproval.dispatch.dispatchCount
          + afterApproval.dispatch.dispatchCount
          + beforeFinalize.dispatch.dispatchCount
          + completed.dispatch.dispatchCount,
        handoffCount + parentCommands.length + 1,
        "dispatch count must include each worker/parent action and the parent Spec-approval continuation, but not user-boundary prompts",
      );
      const repairAudit = JSON.parse(flowManager.readArtifact({ specId, logicalKey: "spec.repair", consumerNodeId: "spec-gate" }).bytes.toString("utf8"));
      assert.deepEqual(repairAudit.attempts.map((attempt) => attempt.status), ["rejected", "accepted"]);
      assert.equal(repairAudit.acceptedOperations.length, 2);
      const repairedSpec = JSON.parse(flowManager.readArtifact({ specId, logicalKey: "spec.record", consumerNodeId: "approval" }).bytes.toString("utf8"));
      assert.equal(repairedSpec.requirements.find((requirement) => requirement.id === "R1").desc, "The requirement retains publication authority.");
      assert.equal(repairedSpec.background, "The background retains publication authority.");
      const draftRepairAudit = JSON.parse(flowManager.readArtifact({
        specId,
        logicalKey: "draft.questions.repair",
        consumerNodeId: "draft-refine",
      }).bytes.toString("utf8"));
      const canonicalDraft = JSON.parse(flowManager.readArtifact({
        specId,
        logicalKey: "draft",
        consumerNodeId: "draft-gate",
      }).bytes.toString("utf8"));
      assert.deepEqual(draftRepairAudit.audit.envelopeErrors, [
        "draft repair version is invalid",
        "draft repair baseRevision is invalid",
        "draft repair operations are invalid",
      ]);
      assert.equal(draftRepairAudit.acceptedOperations.length, 0);
      assert.equal(canonicalDraft.goal, "full flow");
      assert.equal(canonicalDraft.analysis.problem, "Exercise the full flow.");
    } finally {
      removeTmpDir(temporaryRoot);
    }
  });
});
