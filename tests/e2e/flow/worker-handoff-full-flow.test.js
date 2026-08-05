import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";
import { flowArtifactAuthorityForStep } from "../../../src/flow/lib/flow-artifact-authority.js";
import { findInProgressLeaf, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { sealWorkerArtifactHandoff } from "../../../src/flow/lib/worker-artifact-handoff.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
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

function prepareCommandArtifact(stepId, specDir, state) {
  if (stepId === "draft-questions-review") {
    fs.writeFileSync(
      path.join(specDir, "draft-review-questions.json"),
      workerArtifactJson(draftReview("draft-questions", state.draftArtifactRevision)),
    );
  }
  if (stepId === "draft-coverage-review") {
    fs.writeFileSync(
      path.join(specDir, "draft-review-coverage.json"),
      workerArtifactJson(draftReview("draft-coverage", state.draftArtifactRevision)),
    );
  }
  if (stepId === "spec-review") {
    fs.writeFileSync(path.join(specDir, "spec-review.json"), workerArtifactJson({
      verdict: "REJECTED",
      blockingFindings: [{ title: "Bind publication", target: "requirements[0]" }],
      nonBlockingImprovements: [],
    }));
  }
}

function payloadPath(request, logicalName) {
  return request.payloads.find((entry) => entry.logicalName === logicalName).payloadPath;
}

function writeHandoffPayload(stepId, request, specDir) {
  if (["draft", "draft-refine"].includes(stepId)) {
    const existing = path.join(specDir, "draft.json");
    const draft = fs.existsSync(existing)
      ? JSON.parse(fs.readFileSync(existing, "utf8"))
      : { goal: "deterministic full-flow draft" };
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
      fs.readFileSync(path.join(specDir, "draft.json")),
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
  flowManager.mutate((state) => {
    const leaves = flattenSteps(state.steps);
    const index = leaves.findIndex((step) => step.id === stepId);
    assert.notEqual(index, -1);
    leaves[index].status = "done";
    if (leaves[index + 1]) leaves[index + 1].status = "in_progress";
  });
}

function fileDigest(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    digest: crypto.createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length,
  };
}

function assertCanonicalInputs(request, specDir) {
  for (const input of request.inputs) {
    const canonical = fileDigest(path.join(specDir, input.targetRelativePath));
    assert.equal(canonical.digest, input.digest, input.targetRelativePath);
    assert.equal(canonical.byteLength, input.byteLength, input.targetRelativePath);
  }
}

function assertPublishedForConsumer(pending, flowManager, specDir, consumerStepId) {
  const authority = flowArtifactAuthorityForStep(pending.stepId);
  assert.equal(authority.consumer, consumerStepId, pending.stepId);
  const state = flowManager.load();
  const receipt = state.workerArtifactReceipts.find((entry) => entry.stepId === pending.stepId);
  assert.ok(receipt, `${pending.stepId} must record a canonical publication receipt`);
  assert.equal(receipt.handoffDigest, pending.submission.handoffDigest);
  for (const entry of pending.submission.payloadManifest) {
    const canonical = fileDigest(path.join(specDir, entry.targetRelativePath));
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
      const initial = moveFlowToStep(makeFlowState({
        specId,
        runId: "run-worker-handoff-full-flow",
        worktree: true,
      }), "branch");
      const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
      flowManager.create(initial);
      const specDir = path.join(mainRoot, "specs", specId);
      const visited = [];
      let handoffCount = 0;
      let pendingConsumer = null;
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            const stepId = findInProgressLeaf(flowManager.load().steps)?.id ?? null;
            if (pendingConsumer) {
              assertPublishedForConsumer(pendingConsumer, flowManager, specDir, stepId);
              pendingConsumer = null;
            }
            return nextAction(stepId);
          },
        },
        agent: {
          async call(_prompt, options) {
            const invocation = JSON.parse(options.executionEnvironment.SENTI_FLOW_DISPATCH_INVOCATION);
            const stepId = invocation.action.step;
            visited.push(stepId);
            const requestPath = options.executionEnvironment.SENTI_FLOW_HANDOFF_REQUEST;
            if (requestPath) {
              handoffCount += 1;
              const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
              assertCanonicalInputs(request, specDir);
              writeHandoffPayload(stepId, request, specDir);
              const sealed = sealWorkerArtifactHandoff({
                requestPath,
                invocationId: options.executionEnvironment.SENTI_FLOW_DISPATCH_INVOCATION_ID,
              });
              pendingConsumer = {
                stepId,
                submission: JSON.parse(fs.readFileSync(sealed.handoffPath, "utf8")),
              };
            } else {
              prepareCommandArtifact(stepId, specDir, flowManager.load());
              advanceCommandStep(flowManager, stepId);
            }
            return "deterministic worker report";
          },
        },
        repositoryFingerprint: () => "deterministic-full-flow",
        maxDispatches: 64,
        leaseFactory: () => ({ acquire() {}, release() {} }),
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
      assert.equal(result.dispatch?.boundary, "completed", JSON.stringify(result, null, 2));
      assert.deepEqual(visited, expected);
      assert.equal(handoffCount, 10);
      assert.equal(result.dispatch.dispatchCount, 36);
      assert.equal(flattenSteps(flowManager.load().steps).every((step) => step.status === "done"), true);
    } finally {
      removeTmpDir(mainRoot);
    }
  });
});
