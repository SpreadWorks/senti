import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import GetNextActionCommand from "../../src/flow/lib/get-next-action.js";
import RunDispatchCommand from "../../src/flow/lib/run-dispatch.js";
import { findStepById } from "../../src/flow/lib/step-tree.js";
import { WorkerArtifactHandoffCoordinator } from "../../src/flow/lib/worker-artifact-handoff.js";
import { Agent } from "../../src/lib/agent.js";
import { FlowManager } from "../../src/lib/flow-manager.js";
import { Logger } from "../../src/lib/log.js";
import { ProviderRegistry } from "../../src/lib/provider.js";
import {
  FlowArtifactAttemptHistory,
  FlowArtifactAttemptRecord,
} from "../../src/lib/flow-artifact-contract.js";
import { CanonicalFlowFixture } from "../support/infrastructure/flow-setup.js";
import { commitAll, initGitRepo } from "../support/infrastructure/git-repo.js";
import { createTmpDir, removeTmpDir } from "../support/builders/tmp-dir.js";
import {
  validWorkerHandoffSpec,
  workerArtifactJson,
} from "../support/infrastructure/worker-artifact.js";

const SENNEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/sennel.js");
const WORKER_ARTIFACT_HANDOFF_SCHEMA = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/flow/schemas/next-action/worker-artifact-handoff.schema.json",
);

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

function installSennelWrapper(executionRoot) {
  const binDir = path.join(executionRoot, ".test-bin");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(path.join(binDir, "sennel"), [
    "#!/bin/sh",
    `exec ${JSON.stringify(process.execPath)} ${JSON.stringify(SENNEL)} "$@"`,
    "",
  ].join("\n"), { mode: 0o755 });
  return binDir;
}

function realCodexAgent({ mainRoot, executionRoot, flowManager }) {
  return new Agent({
    config: {
      agent: {
        default: "codex/gpt-5.6-sol-medium",
        timeout: 240,
        retryCount: 0,
      },
    },
    paths: { root: executionRoot, agentWorkDir: path.join(executionRoot, ".tmp") },
    registry: new ProviderRegistry(),
    logger: new Logger({ logDir: path.join(executionRoot, ".tmp", "logs"), enabled: false }),
    flowManager,
  });
}

function specWorkerAction() {
  return {
    taskId: null,
    step: "spec",
    action: "write-spec",
    instructions: {
      key: "plan.spec",
      content: [
        "Write the declared spec.json handoff payload with exactly this JSON document:",
        JSON.stringify(validWorkerHandoffSpec()),
        "Run the exact sealCommand once after writing it.",
      ].join(" "),
    },
    context: { workerArtifactHandoff: { required: true } },
    output_schema: JSON.parse(fs.readFileSync(WORKER_ARTIFACT_HANDOFF_SCHEMA, "utf8")),
    requires_approval: false,
    maxAttempts: 1,
    directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-spec" },
  };
}

function draftHandoffPayload(goal) {
  return {
    devType: "feature",
    goal,
    analysis: {
      problem: "The worker must hand repaired draft bytes to the canonical parent publisher.",
      proposedApproach: "Exercise the guarded worker artifact handoff.",
      validation: "Read the canonical draft after the parent publishes the sealed bytes.",
    },
    decisionMap: {
      knownFacts: [],
      decisionPoints: [],
      resolvedByProjectRules: [],
      requiresUserJudgment: [],
      deferredToSpec: [],
    },
    questionLedger: {
      revision: 0,
      questions: [],
      publication: "real-agent-worker-handoff",
      evidenceDigest: "a".repeat(64),
    },
    approval: { approved: true },
  };
}

function action(stepId) {
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
  const instruction = stepId === "draft-questions-triage"
    ? [
        "Use only the immutable handoff input snapshots.",
        "Write the declared draft-questions-triage.json payload with exactly this JSON shape:",
        '{"version":1,"phase":"draft-questions-triage","sourceReview":"draft-review-questions.json",',
        '"summary":"Apply the parent publication repair.","items":[{"title":"Publish through the parent",',
        '"target":"goal","decision":"apply","rationale":"The review target is valid.",',
        '"evidence":"The parent owns canonical publication."}]}',
        "Do not rename or omit items. Then seal the handoff exactly once.",
      ].join(" ")
    : [
        "Use only the immutable handoff input snapshots and write both declared payloads.",
        "Write the declared draft-questions-repair.json payload with exactly this JSON shape:",
        '{"version":1,"phase":"draft-questions-repair","sourceTriage":"draft-questions-triage.json",',
        '"summary":"Applied the parent publication repair.","items":[{"title":"Publish through the parent",',
        '"target":"goal","rationale":"The repair uses the guarded handoff.",',
        '"evidence":"The parent publishes the sealed bytes.","changedFieldPaths":["goal"]}]}',
        `Write the declared draft.json payload with exactly this JSON document: ${JSON.stringify(draftHandoffPayload("Parent publication is canonical."))}`,
        "Do not rename or omit items. Then seal the handoff exactly once.",
      ].join(" ");
  return {
    taskId: null,
    step: stepId,
    action: "write-draft",
    instructions: {
      key: `plan.${stepId}`,
      content: instruction,
    },
    context: { workerArtifactHandoff: { required: true } },
    output_schema: {},
    requires_approval: false,
    maxAttempts: 1,
    directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-draft" },
  };
}

describe("real agent worker artifact handoff", { timeout: 480_000 }, () => {
  it("has a real Codex CLI worker hand off triage and repair to a downstream command", async () => {
    const mainRoot = createTmpDir("worker-handoff-agent-main-");
    const originalPath = process.env.PATH;
    try {
      const executionRoot = path.join(mainRoot, "execution");
      fs.mkdirSync(executionRoot, { recursive: true });
      initGitRepo(executionRoot);
      fs.writeFileSync(path.join(executionRoot, "README.md"), "worker handoff fixture\n");
      commitAll(executionRoot, "worker handoff fixture");
      const binDir = installSennelWrapper(executionRoot);
      process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;

      const specId = "500-worker-handoff-agent";
      const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
      const fixture = new CanonicalFlowFixture({
        flowManager,
        specId,
        runId: "run-worker-handoff-agent",
        request: "Exercise the real agent worker handoff.",
        execution: {
          mode: "worktree",
          baseBranch: "main",
          featureBranch: "feature/worker-handoff-agent",
        },
        specRecord: { goal: "Exercise the worker handoff", requirements: [] },
      }).create();
      const canonicalSpecDir = flowManager.specLocation(specId).directory;
      const draftBytes = Buffer.from(`${JSON.stringify(draftHandoffPayload("Repair the worker handoff."), null, 2)}\n`);
      fixture.activate("draft");
      flowManager.publishArtifacts({
        specId,
        nodeId: "draft",
        artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: draftBytes }],
      });
      fixture.settle("draft").activate("draft-questions-review");
      const draftRevision = {
        version: 1,
        runId: "run-worker-handoff-agent",
        specId,
        sourceStepId: "draft",
        digest: crypto.createHash("sha256").update(draftBytes).digest("hex"),
        byteLength: draftBytes.length,
        finalizedAt: "2026-08-14T00:00:00.000Z",
      };
      publishAttemptArtifact(flowManager, specId, "draft-questions-review", "draft.questions.review", {
        version: 2,
        phase: "draft-questions",
        sourceDraft: "draft.json",
        sourceDraftRevision: draftRevision,
        generatedAt: "2026-08-04T00:00:00.000Z",
        verdict: "ADVISORY",
        summary: "One repair is required.",
        blockingFindings: [],
        advisoryFindings: [],
        repairTargets: [{
          title: "Publish through the parent",
          target: "goal",
          rationale: "The worker cannot write canonical artifacts.",
          evidence: "The handoff contract assigns publication to the parent.",
          classification: "repair_target",
        }],
      });
      fixture.settle("draft-questions-review").activate("draft-questions-triage");
      const state = flowManager.load();
      const agent = realCodexAgent({ mainRoot, executionRoot, flowManager });
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            const current = flowManager.load();
            if (findStepById(current.steps, "draft-questions-triage").status !== "done") {
              return action("draft-questions-triage");
            }
            const repair = findStepById(current.steps, "draft-questions-repair");
            if (repair.status === "pending") {
              flowManager.updateStepStatus({
                stepId: "draft-questions-repair",
                requestedStatus: "in_progress",
              });
            }
            if (repair.status !== "done") {
              return action("draft-questions-repair");
            }
            return action(null);
          },
        },
        agent,
        repositoryFingerprint: () => "real-agent-handoff",
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
        expectRunId: state.runId,
        expectSpec: specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.dispatch?.boundary, "completed", JSON.stringify(result, null, 2));
      assert.equal(result.dispatch.dispatchCount, 2);
      const completed = flowManager.load();
      assert.equal(findStepById(completed.steps, "draft-questions-triage").status, "done");
      assert.equal(findStepById(completed.steps, "draft-questions-repair").status, "done");
      assert.equal(fs.existsSync(path.join(canonicalSpecDir, "draft-questions-triage.json")), false);
      assert.equal(fs.existsSync(path.join(canonicalSpecDir, "draft-questions-repair.json")), false);
      assert.equal(
        flowManager.artifactCatalog(specId).artifacts.some((entry) => entry.logicalKey === "draft.questions.triage"),
        true,
      );
      assert.equal(
        flowManager.artifactCatalog(specId).artifacts.some((entry) => entry.logicalKey === "draft.questions.repair"),
        true,
      );
      const downstream = await new GetNextActionCommand().execute({
        root: executionRoot,
        executionRoot,
        mainRoot,
        specId,
        flowManager,
        flowState: completed,
      });
      assert.equal(downstream.step, "draft-refine");
      assert.equal(downstream.context.workerArtifactHandoff.required, true);
      const downstreamRequest = new WorkerArtifactHandoffCoordinator().createRequest({
        ctx: { root: executionRoot, executionRoot, mainRoot, specId, flowManager },
        state: completed,
        invocation: {
          id: "downstream-draft-refine",
          target: { digest: "e".repeat(64) },
          action: { digest: "d".repeat(64), nextAction: { step: downstream.step } },
        },
      });
      assert.deepEqual(
        downstreamRequest.inputs[0].document,
        draftHandoffPayload("Parent publication is canonical."),
      );
    } finally {
      process.env.PATH = originalPath;
      removeTmpDir(mainRoot);
    }
  });

  it("has a real Codex spec worker seal and publish a canonical spec", async () => {
    const mainRoot = createTmpDir("worker-handoff-agent-spec-main-");
    const originalPath = process.env.PATH;
    try {
      const executionRoot = path.join(mainRoot, "execution");
      fs.mkdirSync(executionRoot, { recursive: true });
      initGitRepo(executionRoot);
      fs.writeFileSync(path.join(executionRoot, "README.md"), "spec worker handoff fixture\n");
      commitAll(executionRoot, "spec worker handoff fixture");
      const binDir = installSennelWrapper(executionRoot);
      process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;

      const specId = "505-worker-handoff-agent-spec";
      const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
      const fixture = new CanonicalFlowFixture({
        flowManager,
        specId,
        runId: "run-worker-handoff-agent-spec",
        request: "Exercise the real spec worker response schema and publication path.",
        execution: {
          mode: "worktree",
          baseBranch: "main",
          featureBranch: "feature/worker-handoff-agent-spec",
        },
        specRecord: { goal: "Exercise spec publication", requirements: [] },
      }).create();
      fixture.activate("draft");
      flowManager.publishArtifacts({
        specId,
        nodeId: "draft",
        artifactWrites: [{
          logicalKey: "draft",
          mediaType: "application/json",
          bytes: Buffer.from(workerArtifactJson({
            goal: "Publish the canonical spec through the parent dispatcher.",
          })),
        }],
      });
      fixture.settle("draft").activate("spec");
      const canonicalSpecDir = flowManager.specLocation(specId).directory;
      const state = flowManager.load();
      const currentAction = specWorkerAction();
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            return findStepById(flowManager.load().steps, "spec").status === "done"
              ? action(null)
              : structuredClone(currentAction);
          },
        },
        agent: realCodexAgent({ mainRoot, executionRoot, flowManager }),
        repositoryFingerprint: () => "real-agent-spec-handoff",
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
        expectRunId: state.runId,
        expectSpec: specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.dispatch?.boundary, "completed", JSON.stringify(result, null, 2));
      assert.equal(result.dispatch.dispatchCount, 1);
      const completed = flowManager.load();
      assert.equal(findStepById(completed.steps, "spec").status, "done");
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir, "spec.json"), "utf8")),
        { ...validWorkerHandoffSpec(), tasks: [] },
      );
      assert.equal(
        flowManager.artifactCatalog(specId).artifacts.some((entry) => entry.logicalKey === "spec.record"),
        true,
      );
    } finally {
      process.env.PATH = originalPath;
      removeTmpDir(mainRoot);
    }
  });
});
