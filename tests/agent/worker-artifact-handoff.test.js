import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import GetNextActionCommand from "../../src/flow/lib/get-next-action.js";
import RunClaimNextActionCommand from "../../src/flow/lib/run-claim-next-action.js";
import RunDispatchCommand from "../../src/flow/lib/run-dispatch.js";
import RunRepairTestReviewCommand from "../../src/flow/lib/run-repair-test-review.js";
import { CanonicalTestArtifactStore } from "../../src/flow/lib/canonical-test-artifacts.js";
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

function testReviewRepairWorkerAction() {
  return {
    taskId: null,
    step: "test",
    action: "repair-tests",
    instructions: {
      key: "plan.test",
      content: [
        "Read the worker handoff request and its testReviewRepair workerScope.",
        "Edit only the stated target file beneath the declared spec-tests payload root.",
        "Make the required assertion change, then run the exact sealCommand from the request once.",
      ].join(" "),
    },
    context: { workerArtifactHandoff: { required: true } },
    output_schema: JSON.parse(fs.readFileSync(WORKER_ARTIFACT_HANDOFF_SCHEMA, "utf8")),
    requires_approval: false,
    maxAttempts: 1,
    directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "repair-tests" },
  };
}

function sourceWorkerAction() {
  return {
    taskId: null,
    step: "implement",
    action: "implement-source",
    instructions: {
      key: "plan.implement",
      content: [
        "Run `sennel flow get context docs/context.md --raw` exactly once and require it to succeed.",
        "Then replace product.js with exactly `export const value = 2;` followed by a newline.",
        "Run `npm run lint` and require it to succeed.",
        "Do not modify any other source file.",
        "Write the declared effects.json handoff payload with exactly this JSON document:",
        JSON.stringify({
          version: 1,
          stepId: "implement",
          completionStatus: "done",
          files: [{ requirementId: "R1", paths: ["product.js"] }],
          issues: [],
          overview: null,
          triage: null,
          repair: null,
        }),
        "Run the exact sealCommand once after the context read, source check, and payload write all succeed.",
      ].join(" "),
    },
    context: { workerArtifactHandoff: { required: true } },
    output_schema: JSON.parse(fs.readFileSync(WORKER_ARTIFACT_HANDOFF_SCHEMA, "utf8")),
    requires_approval: false,
    maxAttempts: 1,
    directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "implement-source" },
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
        '"evidence":"The parent owns canonical publication.","allowedFieldPaths":["goal"],"requiredFieldPaths":["goal"]}]}',
        "Do not rename or omit items. Then seal the handoff exactly once.",
      ].join(" ")
    : [
        "Use only the immutable handoff input snapshots and write the declared payload.",
        "Write the declared draft-questions-repair.json payload with exactly this JSON shape:",
        '"version":1,"baseRevision":"sha256:<exact inputRevision>","operations":[{"title":"Publish through the parent",',
        '"target":"goal","kind":"replace-value","path":"goal",',
        '"expectedDigest":"634747b65b9a50fcc3d49a71b10763c810dd2a8f88b9446acdd99f4e1012cea9","replacement":"Parent publication is canonical.",',
        '"reason":"The parent publishes the derived canonical draft."}]}',
        "Use the exact inputRevision from the handoff request for baseRevision. Do not rename or omit items. Then seal the handoff exactly once.",
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
  it("keeps a source handoff valid when a real worker reads context and checks its source", async () => {
    const temporaryRoot = createTmpDir("worker-handoff-agent-source-");
    const originalPath = process.env.PATH;
    try {
      const mainRoot = path.join(temporaryRoot, "main");
      const executionRoot = path.join(temporaryRoot, "execution");
      fs.mkdirSync(mainRoot, { recursive: true });
      initGitRepo(mainRoot);
      fs.mkdirSync(path.join(mainRoot, "docs"), { recursive: true });
      fs.writeFileSync(path.join(mainRoot, ".gitignore"), ".sennel/\n.test-bin/\n.tmp/\n");
      fs.writeFileSync(path.join(mainRoot, "docs", "context.md"), "# Context\n\nRead by the source worker.\n");
      fs.writeFileSync(path.join(mainRoot, "package.json"), `${JSON.stringify({
        scripts: { lint: "node --check product.js" },
      }, null, 2)}\n`);
      fs.writeFileSync(path.join(mainRoot, "product.js"), "export const value = 1;\n");
      commitAll(mainRoot, "source worker baseline");
      execFileSync(
        "git",
        ["-C", mainRoot, "worktree", "add", "-q", "-b", "feature/worker-handoff-agent-source", executionRoot],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      process.env.PATH = `${installSennelWrapper(executionRoot)}${path.delimiter}${originalPath}`;

      const specId = "507-worker-handoff-agent-source";
      const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
      const fixture = new CanonicalFlowFixture({
        flowManager,
        specId,
        runId: "run-worker-handoff-agent-source",
        request: "Read canonical context and complete a source worker handoff.",
        execution: {
          mode: "worktree",
          baseBranch: "main",
          featureBranch: "feature/worker-handoff-agent-source",
        },
        specRecord: {
          goal: "Exercise source handoff observation advances",
          requirements: [{ id: "R1", desc: "Update the exported value." }],
        },
      }).create().registerActive().activate("implement");
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            return findStepById(flowManager.load().steps, "implement").status === "done"
              ? action(null)
              : sourceWorkerAction();
          },
        },
        agent: realCodexAgent({ mainRoot, executionRoot, flowManager }),
        repositoryFingerprint: () => "real-agent-source-handoff",
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
        expectRunId: flowManager.load().runId,
        expectSpec: specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.dispatch?.boundary, "completed", JSON.stringify(result, null, 2));
      assert.equal(result.dispatch.dispatchCount, 1);
      const completed = flowManager.load();
      assert.equal(findStepById(completed.steps, "implement").status, "done");
      assert.equal(fs.readFileSync(path.join(executionRoot, "product.js"), "utf8"), "export const value = 2;\n");
      const contextMetrics = completed.metrics.filter((entry) => entry.counter === "docsRead");
      assert.equal(contextMetrics.length, 1);
      assert.equal(contextMetrics[0].phase, "impl");
      assert.equal(flowManager.activityLedger(specId).some((entry) => (
        entry.transition.operation === "record_metric"
        && entry.metric?.counter === "docsRead"
      )), true);
    } finally {
      process.env.PATH = originalPath;
      removeTmpDir(temporaryRoot);
    }
  });

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
      assert.equal(downstream.directive.actionId, "CLAIM_NEXT_ACTION");
      const claim = await new RunClaimNextActionCommand().execute({
        root: executionRoot,
        executionRoot,
        mainRoot,
        specId,
        flowManager,
        flowState: completed,
      });
      assert.equal(claim.ok, true, JSON.stringify(claim));
      const claimed = flowManager.load();
      assert.equal(claimed.currentNodeId, "draft-refine");
      assert.equal(flowManager.canonicalState(specId).attempt.failure, null);
      const downstreamRequest = new WorkerArtifactHandoffCoordinator().createRequest({
        ctx: { root: executionRoot, executionRoot, mainRoot, specId, flowManager },
        state: claimed,
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

  it("has a real Codex CLI repair one scoped test-review finding from canonical payload bytes", async () => {
    const mainRoot = createTmpDir("worker-handoff-agent-test-review-main-");
    const originalPath = process.env.PATH;
    try {
      const executionRoot = path.join(mainRoot, "execution");
      fs.mkdirSync(executionRoot, { recursive: true });
      initGitRepo(executionRoot);
      fs.writeFileSync(path.join(executionRoot, "README.md"), "test review repair fixture\n");
      commitAll(executionRoot, "test review repair fixture");
      process.env.PATH = `${installSennelWrapper(executionRoot)}${path.delimiter}${originalPath}`;

      const specId = "503-worker-handoff-agent-test-review";
      const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
      const fixture = new CanonicalFlowFixture({
        flowManager, specId, runId: "run-worker-handoff-agent-test-review",
        request: "Exercise a real scoped test review repair handoff.",
        execution: { mode: "worktree", baseBranch: "main", featureBranch: "feature/worker-handoff-agent-test-review" },
        specRecord: { goal: "Repair a reviewed test", requirements: [{ id: "R1", desc: "Preserve a test assertion." }] },
      }).create().registerActive();
      const original = Buffer.from("// spec: R1\nimport test from 'node:test';\ntest('R1: original assertion', () => {});\n", "utf8");
      fixture.activate("test");
      flowManager.publishArtifacts({
        specId, nodeId: "test", artifactWrites: [{
          logicalKey: "tests.source", parameters: { testPath: "requirement.test.js" },
          mediaType: "text/javascript", bytes: original,
        }],
      });
      fixture.settle("test").activate("test-review");
      const sourceRevision = new CanonicalTestArtifactStore({ flowManager, state: flowManager.load() })
        .testSourceRevision().toJSON();
      const finding = {
        findingId: "real-agent-finding", fingerprint: "f".repeat(64), target: "requirement.test.js",
        requiredChange: "Add one explicit assertion that preserves R1 behavior.", disposition: "must-fix", rationale: "The review requires an observable assertion.",
      };
      publishAttemptArtifact(flowManager, specId, "test-review", "test.review", {
        phase: "test", verdict: "REJECTED", blockingFindings: [finding], advisoryFindings: [],
        sourceTestArtifactRevision: sourceRevision,
        canonicalEvidence: { disposition: "REJECTED", blockingFindings: [finding], advisoryFindings: [], identity: { evidenceDigest: "e".repeat(64) } },
      });
      const context = { root: executionRoot, executionRoot, mainRoot, specId, flowManager, flowState: flowManager.load() };
      assert.equal(new RunRepairTestReviewCommand().execute(context).ok, true);
      const dispatcher = new RunDispatchCommand({
        nextAction: { async run() {
          return findStepById(flowManager.load().steps, "test").status === "done"
            ? action(null) : testReviewRepairWorkerAction();
        } },
        agent: realCodexAgent({ mainRoot, executionRoot, flowManager }),
        repositoryFingerprint: () => "real-agent-test-review-repair",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};
      const result = await dispatcher.execute({
        ...context, flowState: flowManager.load(), expectRunId: flowManager.load().runId, expectSpec: specId,
        _envelopeType: "run", _envelopeKey: "dispatch",
      });
      assert.equal(result.dispatch?.boundary, "completed", JSON.stringify(result, null, 2));
      assert.equal(result.dispatch.dispatchCount, 1);
      const completed = flowManager.load();
      assert.equal(findStepById(completed.steps, "test").status, "done");
      const repaired = flowManager.readArtifact({
        specId, logicalKey: "tests.source", parameters: { testPath: "requirement.test.js" }, consumerNodeId: "test-review",
      }).bytes;
      assert.match(repaired.toString("utf8"), /assert|strict/);
      assert.equal(flowManager.artifactCatalog(specId).artifacts.some((entry) => entry.logicalKey === "test.review.repair.progress"), true);
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
          bytes: Buffer.from(workerArtifactJson(draftHandoffPayload(
            "Publish the canonical spec through the parent dispatcher.",
          ))),
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
