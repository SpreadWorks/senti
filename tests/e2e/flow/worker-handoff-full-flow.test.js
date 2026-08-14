import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";
import { flowArtifactAuthorityForStep } from "../../../src/flow/lib/flow-artifact-authority.js";
import { findInProgressLeaf, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import {
  sealWorkerArtifactHandoff,
  WorkerArtifactHandoffCoordinator,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import { CanonicalWorkerArtifactAddress } from "../../../src/flow/lib/canonical-worker-artifacts.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  FlowArtifactAttemptHistory,
  FlowArtifactAttemptRecord,
} from "../../../src/lib/flow-artifact-contract.js";
import { CanonicalFlowFixture } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  validWorkerHandoffSpec,
  workerArtifactJson,
} from "../../helpers/worker-artifact.js";

function nextAction(stepId) {
  if (stepId == null) {
    return {
      taskId: null,
      step: null,
      action: "completed",
      instructions: null,
      context: null,
      output_schema: null,
      requires_approval: false,
      directive: { kind: "completed", terminal: true, requiresUserAction: false },
    };
  }
  return {
    taskId: null,
    step: stepId,
    action: `execute-${stepId}`,
    instructions: { key: `plan.${stepId}`, content: `Execute ${stepId}.` },
    context: {},
    output_schema: {},
    requires_approval: false,
    maxAttempts: 1,
    directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: `execute-${stepId}` },
  };
}

function draftReview(phase, revision) {
  return {
    version: 2,
    phase,
    sourceDraft: "draft.json",
    sourceDraftRevision: revision,
    generatedAt: "2026-08-04T00:00:00.000Z",
    verdict: "PASS",
    summary: "No draft findings.",
    blockingFindings: [],
    advisoryFindings: [],
    repairTargets: [],
  };
}

function attemptHistoryBytes(nodeId, logicalKey, payload) {
  return Buffer.from(`${JSON.stringify(new FlowArtifactAttemptHistory([
    new FlowArtifactAttemptRecord({
      attempt: 1,
      payload: {
        nodeId,
        outcome: "completed",
        result: { result: "ok" },
        artifact: { logicalKey, payload },
      },
    }),
  ]).toJSON(), null, 2)}\n`, "utf8");
}

function publishAttemptArtifact(flowManager, specId, nodeId, logicalKey, payload) {
  flowManager.publishArtifacts({
    specId,
    nodeId,
    artifactWrites: [{
      logicalKey,
      mediaType: "application/json",
      bytes: attemptHistoryBytes(nodeId, logicalKey, payload),
    }],
  });
}

function prepareCommandArtifact(stepId, flowManager, specId) {
  const draftArtifact = ["draft-questions-review", "draft-coverage-review"].includes(stepId)
    ? flowManager.readArtifact({ specId, logicalKey: "draft", consumerNodeId: stepId })
    : null;
  const draftRevision = draftArtifact === null ? null : {
    version: 1,
    runId: flowManager.load().runId,
    specId,
    sourceStepId: stepId === "draft-coverage-review" ? "draft-refine" : "draft",
    digest: crypto.createHash("sha256").update(draftArtifact.bytes).digest("hex"),
    byteLength: draftArtifact.bytes.length,
    finalizedAt: "2026-08-14T00:00:00.000Z",
  };
  if (stepId === "draft-questions-review") {
    publishAttemptArtifact(
      flowManager,
      specId,
      stepId,
      "draft.questions.review",
      draftReview("draft-questions", draftRevision),
    );
  }
  if (stepId === "draft-coverage-review") {
    publishAttemptArtifact(
      flowManager,
      specId,
      stepId,
      "draft.coverage.review",
      draftReview("draft-coverage", draftRevision),
    );
  }
  if (stepId === "spec-review") {
    publishAttemptArtifact(flowManager, specId, stepId, "spec.review", {
      version: 1,
      phase: "spec",
      generatedAt: "2026-08-14T00:00:00.000Z",
      verdict: "REJECTED",
      blockingFindings: [{ title: "Bind publication", target: "requirements[0]" }],
      nonBlockingImprovements: [],
    });
  }
}

function payloadPath(request, logicalName) {
  return request.payloads.find((entry) => entry.logicalName === logicalName).payloadPath;
}

function inputDocument(request, name) {
  return request.inputs.find((entry) => entry.name === name)?.document ?? null;
}

function writeHandoffPayload(stepId, request) {
  if (["draft", "draft-refine"].includes(stepId)) {
    const draft = inputDocument(request, "draft.json") ?? { goal: "deterministic full-flow draft" };
    fs.writeFileSync(payloadPath(request, "draft.json"), workerArtifactJson({ ...draft, completedBy: stepId }));
    return;
  }
  if (["draft-questions-triage", "draft-coverage-triage"].includes(stepId)) {
    const prefix = stepId.replace("-triage", "");
    fs.writeFileSync(payloadPath(request, `${stepId}.json`), workerArtifactJson({
      version: 1,
      phase: stepId,
      sourceReview: prefix === "draft-questions" ? "draft-review-questions.json" : "draft-review-coverage.json",
      summary: "No repair required.",
      items: [],
    }));
    return;
  }
  if (["draft-questions-repair", "draft-coverage-repair"].includes(stepId)) {
    const prefix = stepId.replace("-repair", "");
    fs.writeFileSync(payloadPath(request, `${stepId}.json`), workerArtifactJson({
      version: 1,
      phase: stepId,
      sourceTriage: `${prefix}-triage.json`,
      summary: "No applied repairs.",
      items: [],
    }));
    fs.writeFileSync(
      payloadPath(request, "draft.json"),
      workerArtifactJson(inputDocument(request, "draft.json")),
    );
    return;
  }
  if (stepId === "spec") {
    fs.writeFileSync(payloadPath(request, "spec.json"), workerArtifactJson(validWorkerHandoffSpec()));
    return;
  }
  if (stepId === "spec-triage") {
    fs.writeFileSync(payloadPath(request, "spec-triage.json"), workerArtifactJson({
      version: 1,
      phase: "spec-triage",
      sourceReview: "spec-review.json",
      summary: "Apply the blocking finding.",
      items: [{
        title: "Bind publication",
        target: "requirements[0]",
        decision: "apply",
        rationale: "The finding is valid.",
        evidence: "The requirement owns canonical publication.",
      }],
    }));
    return;
  }
  if (stepId === "spec-repair") {
    fs.writeFileSync(payloadPath(request, "spec-repair.json"), workerArtifactJson({
      version: 1,
      phase: "spec-repair",
      sourceReview: "spec-triage.json",
      summary: "Applied the blocking finding.",
      items: [{
        title: "Bind publication",
        target: "requirements[0]",
        decision: "applied",
        rationale: "The publication owner is explicit.",
        evidence: "requirements[0] retains the binding contract.",
        changedFields: ["requirements[0].desc"],
      }],
    }));
    fs.writeFileSync(payloadPath(request, "spec.json"), workerArtifactJson(validWorkerHandoffSpec()));
    return;
  }
  if (stepId === "test") {
    fs.writeFileSync(path.join(payloadPath(request, "spec-tests"), "full-flow.test.js"), [
      "// spec: R1",
      "import test from \"node:test\";",
      "test(\"R1: publishes the validated artifact\", () => {});",
      "",
    ].join("\n"));
  }
}

function advanceCommandStep(flowManager, stepId) {
  const state = flowManager.load();
  const leaves = flattenSteps(state.steps);
  const index = leaves.findIndex((step) => step.id === stepId);
  assert.notEqual(index, -1);
  flowManager.updateStepStatus({ stepId, requestedStatus: "done" });
  if (leaves[index + 1]) {
    flowManager.updateStepStatus({ stepId: leaves[index + 1].id, requestedStatus: "in_progress" });
  }
}

function assertCanonicalInputs(request, flowManager) {
  for (const input of request.inputs) {
    const canonical = new CanonicalWorkerArtifactAddress(input.name).catalogSnapshot({
      flowManager,
      specId: request.specId,
    });
    assert.notEqual(canonical, null, input.name);
    assert.equal(canonical.digest, input.digest, input.targetRelativePath);
    assert.equal(canonical.byteLength, input.byteLength, input.targetRelativePath);
  }
}

function assertPublishedForConsumer(pending, flowManager, consumerStepId) {
  const authority = flowArtifactAuthorityForStep(pending.stepId);
  assert.equal(typeof authority.consumer, "string", pending.stepId);
  assert.equal(typeof consumerStepId, "string", pending.stepId);
  for (const entry of pending.submission.payloadManifest) {
    const canonical = new CanonicalWorkerArtifactAddress(entry.targetRelativePath).catalogSnapshot({
      flowManager,
      specId: pending.submission.specId,
    });
    assert.notEqual(canonical, null, JSON.stringify({
      producer: pending.stepId,
      payload: entry.targetRelativePath,
      currentNodeId: flowManager.load().currentNodeId,
      catalog: flowManager.artifactCatalog(pending.submission.specId).artifacts.map((artifact) => artifact.relativePath),
      activities: flowManager.activityLedger(pending.submission.specId).slice(-8).map((activity) => ({
        type: activity.type,
        operation: activity.transition?.operation,
        nodeId: activity.transition?.resourceClaim?.nodeId,
      })),
    }, null, 2));
    if (entry.targetRelativePath === "spec.json") {
      const specRecord = JSON.parse(flowManager.readArtifact({
        specId: pending.submission.specId,
        logicalKey: "spec.record",
        consumerNodeId: consumerStepId,
      }).bytes.toString("utf8"));
      assert.equal(specRecord.goal, "Validate worker handoff publication.");
      assert.deepEqual(specRecord.requirements.map((requirement) => requirement.id), ["R1"]);
      continue;
    }
    assert.equal(canonical.digest, entry.digest, `${pending.stepId}:${entry.targetRelativePath}`);
    assert.equal(canonical.byteLength, entry.byteLength, `${pending.stepId}:${entry.targetRelativePath}`);
  }
}

describe("deterministic full Flow worker handoff", () => {
  it("dispatches all 36 Flow leaves through finalize-cleanup with parent-owned handoffs", async () => {
    const mainRoot = createTmpDir("worker-handoff-full-main-");
    try {
      const executionRoot = path.join(mainRoot, "execution");
      fs.mkdirSync(executionRoot, { recursive: true });
      const specId = "500-worker-handoff-full-flow";
      const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
      const fixture = new CanonicalFlowFixture({
        flowManager,
        specId,
        runId: "run-worker-handoff-full-flow",
        request: "Exercise the complete target-bound worker handoff lifecycle.",
        execution: {
          mode: "worktree",
          baseBranch: "main",
          featureBranch: "feature/worker-handoff-full-flow",
        },
        specRecord: { goal: "Exercise the full worker handoff", requirements: [] },
      }).create().activate("branch");
      const initial = flowManager.load();
      const visited = [];
      const workerFailures = [];
      let handoffCount = 0;
      let pendingConsumer = null;
      const coordinator = new WorkerArtifactHandoffCoordinator();
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            let current = flowManager.load();
            let stepId = findInProgressLeaf(current.steps)?.id ?? null;
            if (stepId === null) {
              const pending = flattenSteps(current.steps).find((step) => step.status === "pending") ?? null;
              if (pending !== null) {
                flowManager.updateStepStatus({ stepId: pending.id, requestedStatus: "in_progress" });
                current = flowManager.load();
                stepId = findInProgressLeaf(current.steps)?.id ?? null;
              }
            }
            if (pendingConsumer) {
              assertPublishedForConsumer(pendingConsumer, flowManager, stepId);
              pendingConsumer = null;
            }
            return nextAction(stepId);
          },
        },
        agent: {
          async call(_prompt, options) {
            try {
              const invocation = JSON.parse(options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION);
              const stepId = invocation.action.step;
              visited.push(stepId);
              const requestPath = options.executionEnvironment.SENNEL_FLOW_HANDOFF_REQUEST;
              if (requestPath) {
                handoffCount += 1;
                const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
                assertCanonicalInputs(request, flowManager);
                writeHandoffPayload(stepId, request);
                const sealed = sealWorkerArtifactHandoff({
                  requestPath,
                  invocationId: options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION_ID,
                });
                assert.equal(sealed.handoffPath.endsWith("handoff.json"), true);
              } else {
                prepareCommandArtifact(stepId, flowManager, specId);
                advanceCommandStep(flowManager, stepId);
              }
              return "deterministic worker report";
            } catch (error) {
              workerFailures.push(error?.stack || error?.message || String(error));
              throw error;
            }
          },
        },
        repositoryFingerprint: () => "deterministic-full-flow",
        maxDispatches: 64,
        leaseFactory: () => ({ acquire() {}, release() {} }),
        handoffCoordinator: {
          recoverPending(input) {
            return coordinator.recoverPending(input);
          },
          createRequest(input) {
            return coordinator.createRequest(input);
          },
          reconcile(input) {
            const submission = JSON.parse(fs.readFileSync(input.request.submissionPath, "utf8"));
            const result = coordinator.reconcile(input);
            pendingConsumer = {
              stepId: input.request.stepId,
              submission,
            };
            return result;
          },
        },
      });
      dispatcher.container = {};
      const result = await dispatcher.execute({
        root: executionRoot,
        executionRoot,
        mainRoot,
        specId,
        flowManager,
        flowState: flowManager.load(),
        expectRunId: initial.runId,
        expectSpec: specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      const expected = flattenSteps(initial.steps).map((step) => step.id);
      assert.equal(expected.length, 36);
      assert.equal(result.dispatch?.boundary, "completed", JSON.stringify({ result, visited, workerFailures }, null, 2));
      assert.deepEqual(visited, expected);
      assert.equal(handoffCount, 10);
      assert.equal(result.dispatch.dispatchCount, 36);
      assert.equal(flattenSteps(flowManager.load().steps).every((step) => step.status === "done"), true);
    } finally {
      removeTmpDir(mainRoot);
    }
  });
});
