import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import {
  buildInitialNestedSteps,
  buildInitialTaskSteps,
} from "../../../src/flow/definition.js";
import { FLOW_ARTIFACT_AUTHORITY_MATRIX } from "../../../src/flow/lib/flow-artifact-authority.js";
import { FLOW_ARTIFACT_CONTRACTS } from "../../../src/lib/flow-artifact-contract.js";
import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { loadSpecJsonSchema } from "../../../src/lib/spec-json.js";
import {
  WorkerArtifactHandoffCoordinator,
  WorkerArtifactHandoffError,
  WorkerArtifactMutationAuthoritySnapshot,
  SourceWorkerEffect,
  assertWorkerUpgradeAllowed,
  stageWorkerUpgradeResult,
  workerArtifactHandoffPolicy,
  sealWorkerArtifactHandoff,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { CanonicalWorkerSpecPublication, CurrentFlowSpecRecord } from "../../../src/flow/lib/current-flow-state.js";
import { CanonicalSpecApproval } from "../../../src/flow/lib/canonical-spec-approval.js";
import { persistAgentInvocationMetric } from "../../../src/lib/agent-invocation-metric.js";
import { ProcessOwnedLock, RealDirectoryAuthority } from "../../../src/lib/process-owned-lock.js";
import { CanonicalFlowFixture } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  validWorkerHandoffSpec as validSpec,
  workerArtifactJson as json,
} from "../../helpers/worker-artifact.js";

const ACTION_DIGEST = "a".repeat(64);
const WORKER_ARTIFACT_HANDOFF_SCHEMA_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../src/flow/schemas/next-action/worker-artifact-handoff.schema.json",
);
function fixture(stepId = "draft", {
  worktree = true,
  runId = "run-worker-handoff",
  specId = "500-worker-handoff",
  issue = null,
  issueSnapshot = null,
  request = "Create the target-bound worker artifact handoff.",
  specRecord = null,
  beforeActivate = null,
} = {}) {
  const mainRoot = createTmpDir("worker-handoff-main-");
  const executionRoot = worktree ? path.join(mainRoot, "execution") : mainRoot;
  fs.mkdirSync(executionRoot, { recursive: true });
  const flowManager = new FlowManager({
    root: executionRoot,
    mainRoot,
    inWorktree: worktree,
    specId,
  });
  const flow = new CanonicalFlowFixture({
    flowManager,
    specId,
    runId,
    // `flow.json.request` is required even when this fixture is exercising
    // the draft-context failure caused by an empty user request.  The V1
    // schema preserves that exact empty request; DraftInputAuthority then
    // correctly rejects it as non-authoritative worker context.
    request: request ?? "",
    issue,
    issueSnapshot,
    execution: worktree
      ? { mode: "worktree", baseBranch: "main", featureBranch: `feature/${specId}` }
      : { mode: "direct", baseBranch: "main", featureBranch: null },
    ...(specRecord === null ? {} : { specRecord }),
  }).create().registerActive();
  const ctx = { root: executionRoot, executionRoot, mainRoot, specId, flowManager };
  const invocation = {
    id: "dispatch-worker-handoff",
    target: { digest: "b".repeat(64) },
    action: {
      digest: ACTION_DIGEST,
      nextAction: { step: stepId },
    },
  };
  const coordinator = new WorkerArtifactHandoffCoordinator({
    now: () => new Date("2026-08-04T00:00:00.000Z"),
  });
  const value = { mainRoot, executionRoot, specId, flowManager, flow, ctx, invocation, coordinator };
  if (beforeActivate !== null) {
    if (typeof beforeActivate !== "function") throw new TypeError("worker handoff fixture beforeActivate must be a function");
    beforeActivate(value);
  }
  if (flow.state().currentNodeId !== stepId) flow.activate(stepId);
  return value;
}

function canonicalSpecDir(value) {
  return value.flowManager.specLocation(value.specId).directory;
}

function identityDigest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function executionHandoffRoot(value) {
  const specDigest = identityDigest(value.specId).slice(0, 24);
  return path.join(value.executionRoot, ".sennel", "handoffs", specDigest);
}

function publishDraftBeforeTarget(value, draft) {
  value.flow.activate("draft");
  value.flowManager.publishArtifacts({
    specId: value.specId,
    nodeId: "draft",
    artifactWrites: [{
      logicalKey: "draft",
      mediaType: "application/json",
      bytes: Buffer.from(json(draft), "utf8"),
    }],
  });
  value.flow.settle("draft");
}

function readCatalogJson(value, logicalKey, consumerNodeId) {
  return JSON.parse(value.flowManager.readArtifact({
    specId: value.specId,
    logicalKey,
    consumerNodeId,
  }).bytes.toString("utf8"));
}

function writeScenarioRuntimeLog(value, text) {
  value.flowManager.writeRuntimeArtifact({
    specId: value.specId,
    nodeId: "scenario-validity",
    artifact: {
      logicalKey: "scenario.validity.raw-log",
      mediaType: "text/plain",
      bytes: Buffer.from(text, "utf8"),
    },
  });
}

function initializeGitRepository(value) {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: value.mainRoot });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: value.mainRoot });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: value.mainRoot });
  fs.writeFileSync(path.join(value.mainRoot, "product.js"), "export const value = 1;\n");
  execFileSync("git", ["add", "."], { cwd: value.mainRoot });
  execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: value.mainRoot });
}

function acquireRuntimeLock(location, logicalKey) {
  const runtimeLock = location.runtimeLock(logicalKey);
  fs.mkdirSync(runtimeLock.directory, { recursive: true });
  const versionAuthority = new RealDirectoryAuthority(location.directory);
  const runtimeAuthority = new RealDirectoryAuthority(runtimeLock.runtimeDirectory, {
    parentAuthority: versionAuthority,
  });
  const lockAuthority = new RealDirectoryAuthority(runtimeLock.directory, {
    parentAuthority: runtimeAuthority,
  });
  const lock = new ProcessOwnedLock({
    directoryAuthority: lockAuthority,
    fileName: runtimeLock.fileName,
    kind: "worker-authority-runtime-lock",
    authority: { logicalKey },
  });
  lock.acquire();
  return { lock, runtimeLock };
}

function seal(request) {
  return sealWorkerArtifactHandoff({
    requestPath: request.requestPath,
    invocationId: request.dispatchInvocationId,
    now: () => new Date("2026-08-04T00:00:01.000Z"),
  });
}

function draftWorkerAction() {
  return {
    taskId: null,
    step: "draft",
    action: "write-draft",
    instructions: { key: "plan.draft", content: "Write the draft." },
    context: { workerArtifactHandoff: { required: true } },
    output_schema: {},
    requires_approval: false,
    maxAttempts: 1,
    directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-draft" },
  };
}

function completedWorkerAction() {
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

function loadWorkerArtifactHandoffSchema() {
  return JSON.parse(fs.readFileSync(WORKER_ARTIFACT_HANDOFF_SCHEMA_PATH, "utf8"));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(",")}}`;
  }
  return JSON.stringify(value);
}

function rewriteSubmission(request, mutate) {
  const document = JSON.parse(fs.readFileSync(request.submissionPath, "utf8"));
  mutate(document);
  const unsigned = { ...document };
  delete unsigned.handoffDigest;
  document.handoffDigest = crypto.createHash("sha256")
    .update(stableStringify(unsigned))
    .digest("hex");
  fs.writeFileSync(request.submissionPath, `${JSON.stringify(document, null, 2)}\n`);
}

describe("worker artifact handoff", () => {
  it("seals source-worker upgrade evidence and publishes it only with the parent confirmation", () => {
    const value = fixture("implement", { specRecord: validSpec() });
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const authority = WorkerArtifactMutationAuthoritySnapshot.capture(request);
      const effect = new SourceWorkerEffect({
        version: 1,
        stepId: "implement",
        completionStatus: "done",
        requirements: [],
        files: [{ requirementId: "R1", paths: ["product.js"] }],
        issues: [],
        overview: null,
        triage: null,
        repair: null,
      });
      const upgrade = {
        version: 1,
        command: "sennel upgrade",
        dryRun: false,
        exitCode: 0,
        result: "success-no-change",
        summary: { skills: { updated: 0, unchanged: 1, removed: 0 } },
        failureReason: null,
        checkedPaths: [],
      };
      fs.writeFileSync(request.payloadPath("effects.json"), json(effect.toJSON()));
      assert.equal(assertWorkerUpgradeAllowed({ requestPath: request.requestPath }).stepId, "implement");
      stageWorkerUpgradeResult({ requestPath: request.requestPath, artifact: upgrade });
      assert.equal(value.flowManager.readArtifact({
        specId: value.specId,
        logicalKey: "upgrade.result",
        consumerNodeId: "impl-gate",
        optional: true,
      }), null, "the worker may not publish canonical evidence before sealing and confirmation");
      fs.writeFileSync(path.join(value.executionRoot, "product.js"), "export const upgraded = true;\n");
      seal(request);

      value.coordinator.reconcile({ ctx: value.ctx, request, mutationAuthority: authority });

      assert.deepEqual(readCatalogJson(value, "upgrade.result", "impl-gate"), upgrade);
      assert.equal(value.flowManager.activityLedger(value.specId).at(-1).nodeId, "implement");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("allows an artifact-worker upgrade dry-run but rejects materialization before checkout mutation", () => {
    const value = fixture("draft");
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      assert.equal(assertWorkerUpgradeAllowed({ requestPath: request.requestPath, dryRun: true }), null);
      assert.throws(
        () => assertWorkerUpgradeAllowed({ requestPath: request.requestPath, dryRun: false }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_WORKER_UPGRADE_SOURCE_AUTHORITY_REQUIRED",
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects directly staged dry-run upgrade evidence before a source handoff can publish it", () => {
    const value = fixture("implement", { specRecord: validSpec() });
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const authority = WorkerArtifactMutationAuthoritySnapshot.capture(request);
      const effect = new SourceWorkerEffect({
        version: 1,
        stepId: "implement",
        completionStatus: "done",
        requirements: [],
        files: [{ requirementId: "R1", paths: ["product.js"] }],
        issues: [],
        overview: null,
        triage: null,
        repair: null,
      });
      fs.writeFileSync(request.payloadPath("effects.json"), json(effect.toJSON()));
      fs.writeFileSync(request.payloadPath("upgrade.result"), json({
        version: 1,
        command: "sennel upgrade --dry-run",
        dryRun: true,
        exitCode: 0,
        result: "success-no-change",
        summary: { skills: { updated: 0, unchanged: 1, removed: 0 } },
        failureReason: null,
        checkedPaths: [],
      }));
      fs.writeFileSync(path.join(value.executionRoot, "product.js"), "export const upgraded = true;\n");
      seal(request);

      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request, mutationAuthority: authority }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_WORKER_UPGRADE_RESULT_INVALID",
      );
      assert.equal(value.flowManager.readArtifact({
        specId: value.specId,
        logicalKey: "upgrade.result",
        consumerNodeId: "impl-gate",
        optional: true,
      }), null);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("quarantines an unsafe sealed artifact handoff before recovery can replay it", () => {
    const value = fixture("draft");
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "sealed but unsafe" }));
      seal(request);
      value.coordinator.quarantine({
        request,
        error: new WorkerArtifactHandoffError(
          "invalid",
          "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION",
          "repository changed outside the handoff authority",
        ),
      });

      assert.throws(
        () => value.coordinator.recoverPending({ ctx: value.ctx }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_ARTIFACT_HANDOFF_QUARANTINED"
          && error.classification === "invalid"
          && error.recoveryPossible === false,
      );
      assert.equal(fs.existsSync(request.quarantinePath), true);
      assert.equal(value.flowManager.readArtifact({
        specId: value.specId,
        logicalKey: "draft",
        consumerNodeId: "draft-questions-review",
        optional: true,
      }), null, "recovery must not publish a quarantined canonical artifact");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("blocks recovery when quarantine persistence is obstructed", () => {
    const value = fixture("draft");
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "reject without a receipt" }));
      seal(request);
      fs.mkdirSync(request.quarantinePath);
      assert.throws(
        () => value.coordinator.quarantine({
          request,
          error: new WorkerArtifactHandoffError(
            "invalid",
            "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION",
            "unsafe mutation rejected by the parent",
          ),
        }),
      );
      assert.throws(
        () => value.coordinator.recoverPending({ ctx: value.ctx }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_ARTIFACT_HANDOFF_QUARANTINE_INVALID"
          && error.recoveryPossible === false,
      );
      assert.equal(fs.lstatSync(request.quarantinePath).isDirectory(), true);
      assert.equal(value.flowManager.readArtifact({
        specId: value.specId,
        logicalKey: "draft",
        consumerNodeId: "draft-questions-review",
        optional: true,
      }), null);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("discards a parent-validated artifact handoff after a pre-commit interruption", () => {
    const value = fixture("draft");
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "accepted before crash" }));
      seal(request);
      const crashing = new WorkerArtifactHandoffCoordinator({
        faultInjector({ phase }) {
          if (phase === "before-worker-handoff-publication") throw new Error("simulated pre-commit crash");
        },
      });
      assert.throws(
        () => crashing.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
      );

      const recovered = value.coordinator.recoverPending({ ctx: value.ctx });
      assert.equal(recovered.completed, true);
      assert.equal(recovered.cleanedHandoffs, 1);
      assert.equal(value.flowManager.readArtifact({
        specId: value.specId,
        logicalKey: "draft",
        consumerNodeId: "draft-questions-review",
        optional: true,
      }), null, "recovery must not publish an artifact without a committed parent confirmation");
      assert.equal(fs.existsSync(request.directory), false);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("accepts only a sealed typed source effect with task overview additions", () => {
    const effect = SourceWorkerEffect.fromDocument({
      version: 1,
      stepId: "task-impl",
      completionStatus: "done",
      requirements: [],
      files: [],
      issues: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      triage: null,
      repair: null,
    }, "task-impl");
    assert.deepEqual(effect.toJSON().overview, { modules: [], data_flow: [], decisions: [] });
    assert.throws(() => SourceWorkerEffect.fromDocument({
      version: 1,
      stepId: "task-impl",
      completionStatus: "done",
      requirements: [],
      files: [],
      issues: [],
      overview: null,
      triage: null,
      repair: null,
    }, "task-impl"), /requires overview/);
  });

  it("defines one complete authority record for all 36 Flow leaves and 3 task leaves", () => {
    const flowLeaves = flattenSteps(buildInitialNestedSteps()).map((step) => step.id);
    const taskLeaves = buildInitialTaskSteps().map((step) => step.id);
    assert.equal(flowLeaves.length, 36);
    assert.equal(taskLeaves.length, 3);
    assert.deepEqual(
      FLOW_ARTIFACT_AUTHORITY_MATRIX.map((entry) => entry.stepId).sort(),
      [...flowLeaves, ...taskLeaves].sort(),
    );
    for (const entry of FLOW_ARTIFACT_AUTHORITY_MATRIX) {
      assert.ok(["preparation", "command", "artifact", "source", "user"].includes(entry.category));
      assert.ok(entry.producer);
      assert.ok(entry.writableAuthority);
      assert.ok(entry.consumer);
      assert.ok(entry.publicationOwner);
      assert.ok(entry.completionValidator);
      assert.ok(entry.sourceBinding);
      assert.ok(entry.recoveryOwner);
    }
    assert.ok(FLOW_ARTIFACT_AUTHORITY_MATRIX.every((entry) => (
      ["preparation", "command", "artifact", "source", "user"].filter((category) => entry.category === category).length === 1
    )), "each leaf belongs to exactly one authority category");
    assert.equal(FLOW_ARTIFACT_AUTHORITY_MATRIX.find((entry) => entry.stepId === "branch").category, "preparation");
    assert.equal(FLOW_ARTIFACT_AUTHORITY_MATRIX.find((entry) => entry.stepId === "approval").category, "user");
  });

  it("aligns every source handoff input and parent effect publication with catalog authority", () => {
    const rows = [
      { step: "implement", input: ["spec.record"], read: ["spec.record", "file.map", "issue.log"], write: ["spec.record", "file.map", "issue.log"] },
      { step: "impl-triage", input: ["spec.record", "impl.review", "acceptance.review"], read: ["spec.record"], write: ["impl.triage"] },
      { step: "impl-repair", input: ["spec.record", "impl.review", "impl.triage"], read: ["spec.record", "file.map", "issue.log"], write: ["impl.repair", "file.map", "issue.log"] },
      { step: "task-impl", input: [], read: ["spec.record", "file.map", "issue.log"], write: ["spec.record", "file.map", "issue.log"] },
    ];
    const logicalByInput = new Map([
      ["spec.json", "spec.record"], ["impl-review.json", "impl.review"],
      ["acceptance-review.json", "acceptance.review"], ["impl-triage.json", "impl.triage"],
    ]);
    for (const row of rows) {
      const policy = workerArtifactHandoffPolicy(row.step);
      assert.equal(policy?.kind, "source");
      const declaredInputs = new Set(policy.inputContract.allowedSignatures.flatMap((signature) => (
        signature === "" ? [] : signature.split("\u0000")
      )).map((input) => logicalByInput.get(input)));
      for (const logicalKey of row.input) assert.ok(declaredInputs.has(logicalKey), `${row.step} declares ${logicalKey} input`);
      for (const logicalKey of [...new Set([...row.input, ...row.read])]) {
        assert.ok(FLOW_ARTIFACT_CONTRACTS.require(logicalKey).ownership.consumers.includes(row.step), `${row.step} may read ${logicalKey}`);
      }
      for (const logicalKey of row.write) {
        assert.ok(FLOW_ARTIFACT_CONTRACTS.require(logicalKey).ownership.updaters.includes(row.step), `${row.step} parent completion may publish ${logicalKey}`);
      }
    }
  });

  it("materializes target-bound immutable draft context with explicit omissions", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const snapshot = request.contextSnapshot;
      const entries = new Map(snapshot.entries.map((entry) => [entry.kind, entry]));

      assert.equal(snapshot.binding.runId, "run-worker-handoff");
      assert.equal(snapshot.binding.specId, value.specId);
      assert.equal(snapshot.binding.dispatchInvocationId, value.invocation.id);
      assert.equal(snapshot.binding.actionDigest, ACTION_DIGEST);
      assert.equal(snapshot.binding.targetDigest, "b".repeat(64));
      assert.equal(snapshot.inputAuthority.kind, "request");
      assert.equal(entries.get("request").document, "Create the target-bound worker artifact handoff.");
      assert.equal(entries.get("issue").reason, "no-linked-issue");
      assert.equal(entries.get("project_overview").reason, "docs-overview-unavailable");
      assert.match(snapshot.digest, /^[a-f0-9]{64}$/);
      assert.equal(request.toWorkerJSON().contextSnapshot.digest, snapshot.digest);
      assert.equal(request.inputDigest, request.toJSON().inputDigest);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("selects linked Issue content over a simultaneous Flow request", () => {
    const value = fixture("draft", {
      issue: 501,
      issueSnapshot: "Authoritative Issue body.\n",
      request: "secondary Flow request",
    });
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const entries = new Map(request.contextSnapshot.entries.map((entry) => [entry.kind, entry]));

      assert.equal(request.contextSnapshot.inputAuthority.kind, "issue");
      assert.deepEqual(entries.get("issue").document, {
        number: 501,
        body: "Authoritative Issue body.",
      });
      assert.equal(entries.get("request").document, "secondary Flow request");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects missing draft input authority before worker startup", () => {
    const value = fixture("draft", { request: null });
    try {
      assert.throws(
        () => value.coordinator.createRequest({
          ctx: value.ctx,
          state: value.flowManager.load(),
          invocation: value.invocation,
        }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_ARTIFACT_HANDOFF_CONTEXT_INVALID"
          && /linked Issue content or a Flow request/.test(error.message),
      );
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("returns typed context failure without calling the dispatcher worker", async () => {
    const value = fixture("draft", { request: null });
    try {
      let calls = 0;
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            return {
              taskId: null,
              step: "draft",
              action: "write-draft",
              instructions: { key: "plan.draft", content: "Write the draft." },
              context: { workerArtifactHandoff: { required: true } },
              output_schema: {},
              requires_approval: false,
              maxAttempts: 1,
              directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-draft" },
            };
          },
        },
        agent: { async call() { calls += 1; } },
        repositoryFingerprint: () => "stable-fixture",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};

      const result = await dispatcher.execute({
        ...value.ctx,
        flowState: value.flowManager.load(),
        expectRunId: "run-worker-handoff",
        expectSpec: value.specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.errors[0].code, "FLOW_ARTIFACT_HANDOFF_CONTEXT_INVALID");
      assert.equal(calls, 0);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("publishes a sealed draft and completes the step only in the parent transaction", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      assert.equal(request.directory.startsWith(executionHandoffRoot(value)), true);
      assert.equal(
        fs.existsSync(path.join(canonicalSpecDir(value), ".runtime", "worker-handoffs")),
        false,
      );
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "sealed draft" }));
      seal(request);

      const result = value.coordinator.reconcile({ ctx: value.ctx, request });
      const state = value.flowManager.load();
      const published = value.flowManager.readArtifact({
        specId: value.specId,
        logicalKey: "draft",
        consumerNodeId: "draft-questions-review",
      });
      const activities = value.flowManager.activityLedger(value.specId);

      assert.equal(result.completed, true);
      assert.deepEqual(
        JSON.parse(published.bytes.toString("utf8")),
        { goal: "sealed draft" },
      );
      assert.equal(findStepById(state.steps, "draft").status, "done");
      assert.equal(findStepById(state.steps, "draft").result.artifactRefs[0].kind, "worker-handoff");
      assert.equal(activities.at(-1).transition.operation, "confirm_attempt");
      assert.equal(
        value.flowManager.artifactCatalog(value.specId).resolve("steps/draft/result.json").logicalKey,
        "draft",
      );
      assert.equal(fs.existsSync(request.directory), false);
      assert.equal(
        value.coordinator.reconcile({ ctx: value.ctx, request }).replayed,
        true,
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("uses the same dispatcher-owned handoff API in non-worktree Flow", () => {
    const value = fixture("draft", { worktree: false });
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      assert.ok(request);
      assert.equal(request.executionRoot, value.mainRoot);
      assert.equal(
        request.directory.startsWith(executionHandoffRoot(value)),
        true,
      );
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "local handoff" }));
      seal(request);

      value.coordinator.reconcile({ ctx: value.ctx, request });

      assert.deepEqual(readCatalogJson(value, "draft", "draft-questions-review"), { goal: "local handoff" });
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "done");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects direct completion of a dispatcher-owned step in every execution mode", async () => {
    for (const worktree of [true, false]) {
      const value = fixture("spec-triage", { worktree });
      try {
        const result = await new SetStepCommand().execute({
          ...value.ctx,
          id: "spec-triage",
          status: "done",
        });
        assert.equal(result.ok, false);
        assert.equal(result.errors[0].code, "FLOW_ARTIFACT_HANDOFF_REQUIRED");
        assert.equal(findStepById(value.flowManager.load().steps, "spec-triage").status, "in_progress");
        assert.equal(
          fs.existsSync(path.join(canonicalSpecDir(value), "spec-triage.json")),
          false,
        );
      } finally {
        removeTmpDir(value.mainRoot);
      }
    }
  });

  it("validates and publishes spec and spec-test payload types", () => {
    const specValue = fixture("spec", {
      beforeActivate(value) {
        publishDraftBeforeTarget(value, { goal: "draft input" });
      },
    });
    try {
      const specRequest = specValue.coordinator.createRequest({
        ctx: specValue.ctx,
        state: specValue.flowManager.load(),
        invocation: specValue.invocation,
      });
      const proposed = {
        ...validSpec(),
        tasks: [{
          id: "T1", title: "Publish source handoff", goal: "Exercise approval admission.",
          origin: "plan", added_round: 0, status: "pending",
        }],
      };
      fs.writeFileSync(specRequest.payloadPath("spec.json"), json(proposed));
      seal(specRequest);
      specValue.coordinator.reconcile({ ctx: specValue.ctx, request: specRequest });
      assert.equal(findStepById(specValue.flowManager.load().steps, "spec").status, "done");
      assert.deepEqual(
        JSON.parse(fs.readFileSync(specValue.flowManager.specLocation(specValue.specId).specFile, "utf8")),
        proposed,
      );
      specValue.flow.activate("approval");
      const approval = specValue.flowManager.approveSpecContinuation({
        specId: specValue.specId,
        approval: new CanonicalSpecApproval({ confirmedAt: "2026-08-04T00:00:00.000Z" }),
      });
      assert.deepEqual(approval.added, ["T1"]);
      assert.equal(specValue.flowManager.load(specValue.specId).tasks[0].id, "T1");
    } finally {
      removeTmpDir(specValue.mainRoot);
    }

    const testValue = fixture("test", { specRecord: validSpec() });
    try {
      const testRequest = testValue.coordinator.createRequest({
        ctx: testValue.ctx,
        state: testValue.flowManager.load(),
        invocation: testValue.invocation,
      });
      const testFile = path.join(testRequest.payloadPath("spec-tests"), "handoff.test.js");
      fs.writeFileSync(testFile, [
        "// spec: R1",
        "import test from \"node:test\";",
        "test(\"R1: publishes a validated artifact\", () => {});",
        "",
      ].join("\n"));
      seal(testRequest);
      testValue.coordinator.reconcile({ ctx: testValue.ctx, request: testRequest });
      assert.equal(findStepById(testValue.flowManager.load().steps, "test").status, "done");
      assert.equal(
        testValue.flowManager.artifactCatalog(testValue.specId)
          .resolve("artifacts/tests/handoff.test.js").logicalKey,
        "tests.source",
      );
    } finally {
      removeTmpDir(testValue.mainRoot);
    }
  });

  it("merges append-only worker Task proposals while rejecting admitted topology changes", () => {
    const task = {
      id: "T1", title: "Keep identity", goal: "Keep the approved Task immutable.",
      origin: "plan", added_round: 0, status: "pending",
    };
    const previous = new CurrentFlowSpecRecord({ ...validSpec(), tasks: [task] }, { specId: "500-worker-handoff" });
    const accepted = new CanonicalWorkerSpecPublication({
      ...validSpec(),
      tasks: [
        { ...task, title: "Corrected title", goal: "Corrected task description." },
        { id: "T2", title: "New task", goal: "Admit after approval.", origin: "plan", added_round: 1, status: "pending" },
      ],
    });
    const merged = accepted.materialize(previous, {
      specId: "500-worker-handoff",
      admittedTaskIds: ["T1"],
    }).toJSON();
    assert.deepEqual(merged.tasks.map((entry) => entry.id), ["T1", "T2"]);
    assert.equal(merged.tasks[0].title, "Corrected title");
    assert.equal(merged.tasks[0].goal, "Corrected task description.");
    for (const proposal of [
      [{ id: "T2", title: "New", goal: "New.", origin: "plan", added_round: 1, status: "pending" }],
      [{ ...task, added_round: 1 }],
      [{ id: "T2", title: "New", goal: "New.", origin: "plan", added_round: 1, status: "pending" }, task],
      [{ ...task }, { id: "T2", title: "New", goal: "New.", origin: "plan", added_round: 0, status: "pending" }],
    ]) {
      assert.throws(() => new CanonicalWorkerSpecPublication({ ...validSpec(), tasks: proposal })
        .materialize(previous, { specId: "500-worker-handoff", admittedTaskIds: ["T1"] }), /proposal/);
    }
  });

  it("preserves canonical Spec order when parent-first admission differs from the proposal", () => {
    const parent = {
      id: "T-parent", title: "Parent", goal: "Complete the parent Task.", parent: null,
      origin: "plan", added_round: 0, status: "pending",
    };
    const child = {
      id: "T-child", title: "Child", goal: "Complete the child Task.", parent: "T-parent",
      origin: "plan", added_round: 0, status: "pending",
    };
    const previous = new CurrentFlowSpecRecord({ ...validSpec(), tasks: [child, parent] }, { specId: "500-worker-handoff" });
    const publication = new CanonicalWorkerSpecPublication({
      ...validSpec(),
      tasks: [
        { ...child, title: "Corrected child title" },
        { ...parent, goal: "Corrected parent goal." },
      ],
    });

    assert.deepEqual(
      publication.materialize(previous, {
        specId: "500-worker-handoff",
        admittedTaskIds: ["T-parent", "T-child"],
      }).toJSON().tasks,
      [
        { ...child, title: "Corrected child title" },
        { ...parent, goal: "Corrected parent goal." },
      ],
    );
  });

  it("allows a pre-approval worker repair to replace unadmitted Task instructions", () => {
    const original = {
      id: "T1",
      title: "Original title",
      goal: "Original goal.",
      acceptance: ["Original acceptance."],
      implementation_notes: "Original implementation note.",
      test_strategy: "Original test strategy.",
      origin: "plan",
      added_round: 0,
      status: "pending",
    };
    const repaired = {
      ...original,
      title: "Repaired title",
      goal: "Repaired goal.",
      acceptance: ["Repaired acceptance."],
      implementation_notes: "Repaired implementation note.",
      test_strategy: "Repaired test strategy.",
    };
    const previous = new CurrentFlowSpecRecord({ ...validSpec(), tasks: [original] }, { specId: "500-worker-handoff" });
    const publication = new CanonicalWorkerSpecPublication({ ...validSpec(), tasks: [repaired] });

    assert.deepEqual(
      publication.materialize(previous, {
        specId: "500-worker-handoff",
        admittedTaskIds: [],
      }).toJSON().tasks,
      [repaired],
    );
  });

  it("derives Task immutability from admitted Flow state rather than the prior Spec proposal", () => {
    const value = fixture("spec", {
      beforeActivate(fixtureValue) {
        publishDraftBeforeTarget(fixtureValue, { goal: "draft input" });
      },
    });
    try {
      const initial = {
        id: "T1",
        title: "Initial title",
        goal: "Initial goal.",
        acceptance: ["Initial acceptance."],
        implementation_notes: "Initial implementation note.",
        test_strategy: "Initial test strategy.",
        origin: "plan",
        added_round: 0,
        status: "pending",
      };
      value.flowManager.confirmCurrentAttempt({
        specId: value.specId,
        specRecord: new CanonicalWorkerSpecPublication({ ...validSpec(), tasks: [initial] }),
      });

      value.flow.activate("spec-repair");
      const repaired = {
        ...initial,
        acceptance: ["Repaired acceptance."],
        implementation_notes: "Repaired implementation note.",
        test_strategy: "Repaired test strategy.",
      };
      value.flowManager.confirmCurrentAttempt({
        specId: value.specId,
        specRecord: new CanonicalWorkerSpecPublication({ ...validSpec(), tasks: [repaired] }),
      });

      assert.deepEqual(
        JSON.parse(fs.readFileSync(value.flowManager.specLocation(value.specId).specFile, "utf8")).tasks,
        [repaired],
      );
      assert.deepEqual(value.flowManager.load(value.specId).tasks, []);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("protects only admitted Tasks when a repaired Spec also has pending Task proposals", () => {
    const admitted = {
      id: "T1",
      title: "Admitted title",
      goal: "Admitted goal.",
      acceptance: ["Admitted acceptance."],
      implementation_notes: "Admitted implementation note.",
      test_strategy: "Admitted test strategy.",
      origin: "plan",
      added_round: 0,
      status: "pending",
    };
    const pending = {
      id: "T2",
      title: "Pending title",
      goal: "Pending goal.",
      acceptance: ["Pending acceptance."],
      implementation_notes: "Pending implementation note.",
      test_strategy: "Pending test strategy.",
      origin: "plan",
      added_round: 1,
      status: "pending",
    };
    const value = fixture("spec", {
      beforeActivate(fixtureValue) {
        publishDraftBeforeTarget(fixtureValue, { goal: "draft input" });
        fixtureValue.flow.addTask(admitted);
      },
    });
    try {
      value.flowManager.confirmCurrentAttempt({
        specId: value.specId,
        specRecord: new CanonicalWorkerSpecPublication({ ...validSpec(), tasks: [admitted, pending] }),
      });

      value.flow.activate("spec-repair");
      const illegal = { ...admitted, acceptance: ["Rewritten admitted acceptance."] };
      assert.throws(() => value.flowManager.confirmCurrentAttempt({
        specId: value.specId,
        specRecord: new CanonicalWorkerSpecPublication({ ...validSpec(), tasks: [illegal, pending] }),
      }), /only correct admitted Task title or goal/);

      const repairedPending = {
        ...pending,
        acceptance: ["Repaired pending acceptance."],
        implementation_notes: "Repaired pending implementation note.",
        test_strategy: "Repaired pending test strategy.",
      };
      value.flowManager.confirmCurrentAttempt({
        specId: value.specId,
        specRecord: new CanonicalWorkerSpecPublication({
          ...validSpec(),
          tasks: [{ ...admitted, title: "Corrected admitted title" }, repairedPending],
        }),
      });

      assert.deepEqual(
        JSON.parse(fs.readFileSync(value.flowManager.specLocation(value.specId).specFile, "utf8")).tasks,
        [{ ...admitted, title: "Corrected admitted title" }, repairedPending],
      );
      assert.deepEqual(value.flowManager.load(value.specId).tasks.map((task) => task.id), ["T1"]);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("preserves command-owned test evidence while replacing the worker-owned test tree", () => {
    const value = fixture("test", { specRecord: validSpec() });
    try {
      value.flowManager.publishArtifacts({
        specId: value.specId,
        nodeId: "test",
        artifactWrites: [{
          logicalKey: "tests.source",
          parameters: { testPath: "obsolete.test.js" },
          mediaType: "text/javascript",
          bytes: Buffer.from("// spec: R1\n", "utf8"),
        }],
      });
      writeScenarioRuntimeLog(value, "command-owned evidence\n");

      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(
        path.join(request.payloadPath("spec-tests"), "current.test.js"),
        "// spec: R1\nimport test from \"node:test\";\ntest(\"R1: current\", () => {});\n",
      );
      seal(request);
      value.coordinator.reconcile({ ctx: value.ctx, request });

      assert.throws(() => value.flowManager.artifactCatalog(value.specId).resolve("artifacts/tests/obsolete.test.js"));
      assert.equal(
        value.flowManager.artifactCatalog(value.specId)
          .resolve("artifacts/tests/current.test.js").logicalKey,
        "tests.source",
      );
      assert.equal(value.flowManager.readRuntimeArtifact({
        specId: value.specId,
        logicalKey: "scenario.validity.raw-log",
        consumerNodeId: "scenario-validity",
      }).bytes.toString("utf8"), "command-owned evidence\n");
      assert.equal(findStepById(value.flowManager.load().steps, "test").status, "done");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects spec tests that statically import a missing execution module", () => {
    const value = fixture("test", { specRecord: validSpec() });
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(
        path.join(request.payloadPath("spec-tests"), "future-module.test.js"),
        [
          "// spec: R1",
          "import test from 'node:test';",
          "import value from '../../../src/not-yet-implemented.js';",
          "test('R1: future module', () => value);",
          "",
        ].join("\n"),
      );
      seal(request);

      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "invalid"
          && error.code === "FLOW_ARTIFACT_HANDOFF_INVALID"
          && /missing pre-implementation module/.test(error.message),
      );
      assert.equal(findStepById(value.flowManager.load().steps, "test").status, "in_progress");
      assert.equal(value.flowManager.artifactCatalog(value.specId).artifacts
        .some((entry) => entry.relativePath === "artifacts/tests/future-module.test.js"), false);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects worker output in the command-owned test evidence directory", () => {
    const value = fixture("test", { specRecord: validSpec() });
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const evidenceDir = path.join(request.payloadPath("spec-tests"), ".raw");
      fs.mkdirSync(evidenceDir);
      fs.writeFileSync(path.join(evidenceDir, "worker.log"), "not command-owned\n");

      assert.throws(
        () => seal(request),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "invalid"
          && error.code === "FLOW_ARTIFACT_HANDOFF_INVALID",
      );
      assert.equal(findStepById(value.flowManager.load().steps, "test").status, "in_progress");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("lets worktree and non-worktree dispatchers consume a sealed payload", async () => {
    for (const worktree of [true, false]) {
      const value = fixture("draft", { worktree });
      try {
      const nextAction = {
        async run() {
          return findStepById(value.flowManager.load().steps, "draft").status === "done"
            ? {
                taskId: null,
                step: null,
                action: "completed",
                instructions: null,
                context: null,
                output_schema: null,
                requires_approval: false,
                directive: { kind: "completed", terminal: true, requiresUserAction: false },
              }
            : {
                taskId: null,
                step: "draft",
                action: "write-draft",
                instructions: { key: "plan.draft", content: "Write the draft." },
                context: { workerArtifactHandoff: { required: true } },
                output_schema: {},
                requires_approval: false,
                maxAttempts: 1,
                directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-draft" },
              };
        },
      };
      let calls = 0;
      const dispatcher = new RunDispatchCommand({
        nextAction,
        agent: {
          async call(prompt, options) {
            calls += 1;
            assert.match(prompt, /parent dispatcher alone validates, publishes/i);
            const requestPath = options.executionEnvironment.SENNEL_FLOW_HANDOFF_REQUEST;
            const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
            fs.writeFileSync(
              request.payloads.find((entry) => entry.logicalName === "draft.json").payloadPath,
              json({ goal: "dispatcher-owned handoff" }),
            );
            sealWorkerArtifactHandoff({
              requestPath,
              invocationId: options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION_ID,
            });
            await persistAgentInvocationMetric({
              flowManager: value.flowManager,
              provider: "test-provider",
              profileKey: "flow-dispatch",
              usage: null,
              responseChars: 42,
              model: null,
              durationMs: 1,
            }, options.deferredMetric);
            return "worker report is not the completion signal";
          },
        },
        repositoryFingerprint: () => "stable-fixture",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};
      const result = await dispatcher.execute({
        ...value.ctx,
        flowState: value.flowManager.load(),
        expectRunId: "run-worker-handoff",
        expectSpec: value.specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.dispatch.boundary, "completed");
      assert.equal(result.dispatch.dispatchCount, 1);
      assert.equal(calls, 1);
      const completed = value.flowManager.load();
      assert.equal(findStepById(completed.steps, "draft").status, "done");
      assert.equal(completed.metrics.filter((entry) => entry.kind === "agent").length, 1);
      } finally {
        removeTmpDir(value.mainRoot);
      }
    }
  });

  it("detects a worker-spoofed canonical metric before flushing the parent metric once", async () => {
    const value = fixture("draft", { worktree: false });
    try {
      initializeGitRepository(value);
      const action = {
        taskId: null,
        step: "draft",
        action: "write-draft",
        instructions: { key: "plan.draft", content: "Write the draft." },
        context: { workerArtifactHandoff: { required: true } },
        output_schema: {},
        requires_approval: false,
        maxAttempts: 1,
        directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-draft" },
      };
      const dispatcher = new RunDispatchCommand({
        nextAction: { async run() { return structuredClone(action); } },
        agent: {
          async call(_prompt, options) {
            const requestPath = options.executionEnvironment.SENNEL_FLOW_HANDOFF_REQUEST;
            const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
            fs.writeFileSync(
              request.payloads.find((entry) => entry.logicalName === "draft.json").payloadPath,
              json({ goal: "must not be published" }),
            );
            sealWorkerArtifactHandoff({
              requestPath,
              invocationId: options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION_ID,
            });
            value.flowManager.accumulateAgentMetrics("draft", {
              provider: "worker-spoof",
              profileKey: "fake",
              responseChars: 999,
              durationMs: 1,
            });
            await persistAgentInvocationMetric({
              flowManager: value.flowManager,
              provider: "parent-provider",
              profileKey: "flow-dispatch",
              usage: null,
              responseChars: 12,
              model: null,
              durationMs: 2,
            }, options.deferredMetric);
          },
        },
        repositoryFingerprint: () => "stable-fixture",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};

      const result = await dispatcher.execute({
        ...value.ctx,
        flowState: value.flowManager.load(),
        expectRunId: "run-worker-handoff",
        expectSpec: value.specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.errors[0].code, "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION");
      const state = value.flowManager.load();
      assert.equal(findStepById(state.steps, "draft").status, "in_progress");
      assert.equal(fs.existsSync(path.join(canonicalSpecDir(value), "draft.json")), false);
      assert.equal(state.metrics.filter((entry) => entry.provider === "parent-provider").length, 1);
      assert.equal(state.metrics.filter((entry) => entry.provider === "worker-spoof").length, 1);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects a handoff worker that mutates another spec in the execution checkout", async () => {
    const value = fixture("draft", { worktree: true });
    try {
      const action = {
        taskId: null,
        step: "draft",
        action: "write-draft",
        instructions: { key: "plan.draft", content: "Write the draft." },
        context: { workerArtifactHandoff: { required: true } },
        output_schema: {},
        requires_approval: false,
        maxAttempts: 1,
        directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-draft" },
      };
      const dispatcher = new RunDispatchCommand({
        nextAction: { async run() { return structuredClone(action); } },
        agent: {
          async call(_prompt, options) {
            const requestPath = options.executionEnvironment.SENNEL_FLOW_HANDOFF_REQUEST;
            const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
            fs.writeFileSync(
              request.payloads.find((entry) => entry.logicalName === "draft.json").payloadPath,
              json({ goal: "valid handoff payload" }),
            );
            const wrongSpec = path.join(value.executionRoot, "specs", "484-flow-authority-boundaries");
            fs.mkdirSync(wrongSpec, { recursive: true });
            fs.writeFileSync(path.join(wrongSpec, "draft.json"), json({ overwrittenBy: value.specId }));
            sealWorkerArtifactHandoff({
              requestPath,
              invocationId: options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION_ID,
            });
          },
        },
        repositoryFingerprint: () => "stable-fixture",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};

      const result = await dispatcher.execute({
        ...value.ctx,
        flowState: value.flowManager.load(),
        expectRunId: "run-worker-handoff",
        expectSpec: value.specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.errors[0].code, "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION");
      assert.equal(result.data.dispatch.dispatchCount, 1);
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
      assert.equal(fs.existsSync(path.join(canonicalSpecDir(value), "draft.json")), false);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects canonical-main mutations made outside the handoff payload authority and keeps the catalog fail-closed", () => {
    const value = fixture("draft", { worktree: true });
    try {
      initializeGitRepository(value);
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const authority = WorkerArtifactMutationAuthoritySnapshot.capture(request);
      const illicitPath = path.join(canonicalSpecDir(value), "draft.json");
      fs.writeFileSync(illicitPath, json({ goal: "illicit canonical write" }));

      assert.throws(
        () => authority.assertUnchanged(),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION"
          && error.data.authorities.includes("canonical")
          && error.data.changedPaths.some((entry) => entry.endsWith("draft.json")),
      );
      assert.throws(
        () => value.flowManager.load(),
        /Version storage contains an unclassified artifact: draft\.json/,
      );
      fs.unlinkSync(illicitPath);
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("accepts unchanged pre-existing Git dirt but rejects any further mutation", () => {
    const value = fixture("draft", { worktree: false });
    try {
      initializeGitRepository(value);
      const productPath = path.join(value.mainRoot, "product.js");
      const untrackedPath = path.join(value.mainRoot, "preexisting.json");
      fs.writeFileSync(productPath, "export const value = 2;\n");
      fs.writeFileSync(untrackedPath, json({ value: 1 }));
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const authority = WorkerArtifactMutationAuthoritySnapshot.capture(request);

      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "payload-only write" }));
      seal(request);
      assert.doesNotThrow(() => authority.assertUnchanged());

      fs.writeFileSync(productPath, "export const value = 3;\n");
      fs.writeFileSync(untrackedPath, json({ value: 2 }));
      assert.throws(
        () => authority.assertUnchanged(),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION"
          && error.data.changedPaths.includes("product.js")
          && error.data.changedPaths.includes(
            path.relative(value.mainRoot, untrackedPath).split(path.sep).join("/"),
          ),
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("ignores current Version Store locks but rejects another Version and source mutations", () => {
    const value = fixture("draft", { worktree: false });
    try {
      initializeGitRepository(value);
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const authority = WorkerArtifactMutationAuthoritySnapshot.capture(request);
      const currentLocation = value.flowManager.specLocation(value.specId);
      const currentLocks = [
        acquireRuntimeLock(currentLocation, "runtime.lock.artifact-catalog"),
        acquireRuntimeLock(currentLocation, "runtime.lock.current-flow-state"),
      ];
      const ownerTemp = path.join(
        currentLocks[0].runtimeLock.directory,
        ProcessOwnedLock.ownerTemporaryFileName(currentLocks[0].runtimeLock.fileName, crypto.randomUUID()),
      );
      fs.writeFileSync(ownerTemp, "transient owner publication\n");
      const runtimeDirectory = path.join(value.mainRoot, ".sennel");
      fs.writeFileSync(path.join(runtimeDirectory, ".repository-flow-operation.lock"), "runtime lock\n");
      fs.writeFileSync(path.join(runtimeDirectory, ".flow-dispatch-concurrent.lock"), "dispatch lock\n");
      fs.mkdirSync(path.join(runtimeDirectory, "output"), { recursive: true });
      fs.writeFileSync(path.join(runtimeDirectory, "output", "concurrent.json"), "{}\n");

      try {
        assert.doesNotThrow(() => authority.assertUnchanged());

        const unexpectedCurrentVersionRuntimePath = path.join(
          currentLocks[0].runtimeLock.directory,
          "unexpected-worker-runtime.lock",
        );
        fs.writeFileSync(unexpectedCurrentVersionRuntimePath, "worker mutation\n");
        try {
          assert.throws(
            () => authority.assertUnchanged(),
            (error) => error instanceof WorkerArtifactHandoffError
              && error.code === "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION"
              && error.data.changedPaths.includes(path.relative(
                value.mainRoot,
                unexpectedCurrentVersionRuntimePath,
              ).split(path.sep).join("/")),
          );
        } finally {
          fs.rmSync(unexpectedCurrentVersionRuntimePath, { force: true });
        }

        const otherLocation = new FlowManager({
          root: value.mainRoot,
          mainRoot: value.mainRoot,
          inWorktree: false,
          specId: "501-other-version",
        }).specLocation("501-other-version");
        const otherLock = acquireRuntimeLock(otherLocation, "runtime.lock.artifact-catalog");
        try {
          assert.throws(
            () => authority.assertUnchanged(),
            (error) => error instanceof WorkerArtifactHandoffError
              && error.code === "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION"
              && error.data.changedPaths.includes(otherLock.runtimeLock.relativeRepositoryPath),
          );
        } finally {
          otherLock.lock.release();
        }

        fs.writeFileSync(path.join(value.mainRoot, "product.js"), "export const value = 2;\n");
        assert.throws(
          () => authority.assertUnchanged(),
          (error) => error instanceof WorkerArtifactHandoffError
            && error.code === "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION"
            && error.data.changedPaths.includes("product.js"),
        );
      } finally {
        fs.rmSync(ownerTemp, { force: true });
        for (const entry of currentLocks.reverse()) entry.lock.release();
      }
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("isolates the current canonical Version from pre-existing and newly-created Flow Versions in a worktree", () => {
    const value = fixture("draft", { worktree: true });
    try {
      const otherSpecId = "501-unrelated-flow";
      const otherManager = new FlowManager({
        root: value.mainRoot,
        mainRoot: value.mainRoot,
        inWorktree: false,
        specId: otherSpecId,
      });
      new CanonicalFlowFixture({
        flowManager: otherManager,
        specId: otherSpecId,
        runId: "run-unrelated-flow",
        request: "Publish unrelated Flow state.",
        execution: { mode: "direct", baseBranch: "main", featureBranch: null },
      }).create().activate("draft");
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const authority = WorkerArtifactMutationAuthoritySnapshot.capture(request);

      otherManager.updateStepStatus({ specId: otherSpecId, stepId: "draft", requestedStatus: "done" });
      assert.doesNotThrow(() => authority.assertUnchanged(), "an existing unrelated Version is outside this handoff scope");

      const laterSpecId = "502-later-unrelated-flow";
      const laterManager = new FlowManager({
        root: value.mainRoot,
        mainRoot: value.mainRoot,
        inWorktree: false,
        specId: laterSpecId,
      });
      new CanonicalFlowFixture({
        flowManager: laterManager,
        specId: laterSpecId,
        runId: "run-later-unrelated-flow",
        request: "Create a later unrelated Flow.",
        execution: { mode: "direct", baseBranch: "main", featureBranch: null },
      }).create();
      assert.doesNotThrow(() => authority.assertUnchanged(), "a Version created after capture is outside this handoff scope");

      const illicitPath = path.join(canonicalSpecDir(value), "draft.json");
      fs.writeFileSync(illicitPath, json({ goal: "current Version mutation" }));
      assert.throws(
        () => authority.assertUnchanged(),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION"
          && error.data.authorities.includes("canonical"),
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects execution source, Git index, HEAD, and untracked project mutations", () => {
    const cases = [
      {
        expected: "product.js",
        mutate(value) {
          fs.writeFileSync(path.join(value.mainRoot, "product.js"), "export const value = 2;\n");
        },
      },
      {
        expected: "<index>",
        mutate(value) {
          fs.writeFileSync(path.join(value.mainRoot, "product.js"), "export const value = 2;\n");
          execFileSync("git", ["add", "product.js"], { cwd: value.mainRoot });
        },
      },
      {
        expected: "<HEAD>",
        mutate(value) {
          execFileSync("git", ["commit", "--allow-empty", "-q", "-m", "worker mutation"], {
            cwd: value.mainRoot,
          });
        },
      },
      {
        expected: "worker-untracked.txt",
        mutate(value) {
          fs.writeFileSync(path.join(value.mainRoot, "worker-untracked.txt"), "worker mutation\n");
        },
      },
    ];

    for (const scenario of cases) {
      const value = fixture("draft", { worktree: false });
      try {
        initializeGitRepository(value);
        const request = value.coordinator.createRequest({
          ctx: value.ctx,
          state: value.flowManager.load(),
          invocation: value.invocation,
        });
        const authority = WorkerArtifactMutationAuthoritySnapshot.capture(request);
        scenario.mutate(value);

        assert.throws(
          () => authority.assertUnchanged(),
          (error) => error instanceof WorkerArtifactHandoffError
            && error.code === "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION"
            && error.data.changedPaths.includes(scenario.expected),
          scenario.expected,
        );
      } finally {
        removeTmpDir(value.mainRoot);
      }
    }
  });

  it("does not content-scan clean historical specs in a Git repository", () => {
    const value = fixture("draft", { worktree: false });
    try {
      const historyDir = path.join(value.mainRoot, "specs", "history");
      fs.mkdirSync(historyDir, { recursive: true });
      for (let index = 0; index < 200; index += 1) {
        fs.writeFileSync(path.join(historyDir, `${index}.json`), json({ index }));
      }
      initializeGitRepository(value);
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const authority = WorkerArtifactMutationAuthoritySnapshot.capture(request);

      assert.equal(authority.repositories.length, 1);
      assert.equal(authority.repositories[0].mode, "git");
      assert.deepEqual(authority.repositories[0].entries, []);
      assert.doesNotThrow(() => authority.assertUnchanged());
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("stops a worktree dispatcher after one missing handoff without spending semantic retries", async () => {
    const value = fixture();
    try {
      let calls = 0;
      const action = {
        taskId: null,
        step: "draft",
        action: "write-draft",
        instructions: { key: "plan.draft", content: "Write the draft." },
        context: { workerArtifactHandoff: { required: true } },
        output_schema: {},
        requires_approval: false,
        maxAttempts: 1,
        directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-draft" },
      };
      const dispatcher = new RunDispatchCommand({
        nextAction: { async run() { return structuredClone(action); } },
        agent: { async call() { calls += 1; return "premature report"; } },
        repositoryFingerprint: () => "stable-fixture",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};
      const result = await dispatcher.execute({
        ...value.ctx,
        flowState: value.flowManager.load(),
        expectRunId: "run-worker-handoff",
        expectSpec: value.specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.errors[0].code, "FLOW_ARTIFACT_HANDOFF_MISSING");
      assert.equal(result.data.classification, "missing");
      assert.equal(result.data.retryBudgetConsumed, false);
      assert.equal(result.data.dispatch.dispatchCount, 1);
      assert.equal(calls, 1);
      const state = value.flowManager.load();
      assert.equal(findStepById(state.steps, "draft").status, "in_progress");
      assert.equal(state.metrics.filter((entry) => entry.kind === "agent").length, 1);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("keeps handoff failure precedence when deferred metric persistence is advisory", async () => {
    const value = fixture();
    const originalWrite = process.stderr.write;
    const originalAccumulate = value.flowManager.accumulateAgentMetrics;
    let stderr = "";
    try {
      const action = {
        taskId: null,
        step: "draft",
        action: "write-draft",
        instructions: { key: "plan.draft", content: "Write the draft." },
        context: { workerArtifactHandoff: { required: true } },
        output_schema: {},
        requires_approval: false,
        maxAttempts: 1,
        directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-draft" },
      };
      const dispatcher = new RunDispatchCommand({
        nextAction: { async run() { return structuredClone(action); } },
        agent: {
          async call() {
            throw new Error("simulated provider failure");
          },
        },
        repositoryFingerprint: () => "stable-fixture",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};
      value.flowManager.accumulateAgentMetrics = () => {
        throw new Error("simulated metric persistence failure");
      };
      process.stderr.write = (chunk) => { stderr += String(chunk); return true; };

      const result = await dispatcher.execute({
        ...value.ctx,
        flowState: value.flowManager.load(),
        expectRunId: "run-worker-handoff",
        expectSpec: value.specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.errors[0].code, "FLOW_ARTIFACT_HANDOFF_MISSING");
      assert.match(stderr, /metric accumulation failed: simulated metric persistence failure/);
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
    } finally {
      process.stderr.write = originalWrite;
      value.flowManager.accumulateAgentMetrics = originalAccumulate;
      removeTmpDir(value.mainRoot);
    }
  });

  it("classifies a missing sealed submission without consuming semantic retry budget", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "missing"
          && error.code === "FLOW_ARTIFACT_HANDOFF_MISSING",
      );
      const state = value.flowManager.load();
      assert.equal(findStepById(state.steps, "draft").status, "in_progress");
      assert.equal(state.workerArtifactPublication, undefined);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects symlink payloads and post-seal payload tampering", () => {
    const value = fixture();
    const outside = path.join(value.mainRoot, "outside.json");
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(outside, json({ goal: "outside" }));
      fs.symlinkSync(outside, request.payloadPath("draft.json"));
      assert.throws(
        () => seal(request),
        (error) => error instanceof WorkerArtifactHandoffError && error.classification === "invalid",
      );
      fs.unlinkSync(request.payloadPath("draft.json"));
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "sealed" }));
      seal(request);
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "tampered" }));
      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError && error.classification === "invalid",
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("parent validation rejects every undeclared entry added after sealing", () => {
    for (const kind of ["file", "directory", "symlink"]) {
      const value = fixture();
      const outside = path.join(value.mainRoot, "outside.js");
      try {
        const request = value.coordinator.createRequest({
          ctx: value.ctx,
          state: value.flowManager.load(),
          invocation: value.invocation,
        });
        fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "sealed" }));
        seal(request);
        if (kind === "file") {
          fs.writeFileSync(path.join(request.payloadDirectory, "unknown.js"), "export default true;\n");
        } else if (kind === "directory") {
          fs.mkdirSync(path.join(request.payloadDirectory, "unknown"));
        } else {
          fs.writeFileSync(outside, "export default false;\n");
          fs.symlinkSync(outside, path.join(request.payloadDirectory, "unknown.js"));
        }

        assert.throws(
          () => value.coordinator.reconcile({ ctx: value.ctx, request }),
          (error) => error instanceof WorkerArtifactHandoffError
            && error.classification === "invalid"
            && error.code === "FLOW_ARTIFACT_HANDOFF_INVALID",
          kind,
        );
        const unknownPath = path.join(request.payloadDirectory, kind === "directory" ? "unknown" : "unknown.js");
        if (kind === "directory") fs.rmSync(unknownPath, { recursive: true });
        else fs.unlinkSync(unknownPath);
        assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
        assert.equal(fs.existsSync(path.join(canonicalSpecDir(value), "draft.json")), false);
      } finally {
        removeTmpDir(value.mainRoot);
      }
    }
  });

  it("rejects stale identity bindings independently of the handoff digest", () => {
    const mutations = [
      ["requestDigest", "b".repeat(64)],
      ["runId", "another-run"],
      ["specId", "another-spec"],
      ["issue", 99999],
      ["stepId", "spec"],
      ["actionDigest", "b".repeat(64)],
      ["dispatchInvocationId", "another-dispatch"],
      ["targetAuthority", "execution-checkout"],
      ["inputDigest", "b".repeat(64)],
      ["inputRevision", "b".repeat(64)],
    ];
    for (const [field, replacement] of mutations) {
      const value = fixture();
      try {
        const request = value.coordinator.createRequest({
          ctx: value.ctx,
          state: value.flowManager.load(),
          invocation: value.invocation,
        });
        fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "sealed" }));
        seal(request);
        rewriteSubmission(request, (document) => { document[field] = replacement; });

        assert.throws(
          () => value.coordinator.reconcile({ ctx: value.ctx, request }),
          (error) => error instanceof WorkerArtifactHandoffError
            && error.classification === "stale"
            && error.code === "FLOW_ARTIFACT_HANDOFF_STALE",
          field,
        );
      } finally {
        removeTmpDir(value.mainRoot);
      }
    }
  });

  it("rejects request-contract tampering performed after sealing", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "sealed" }));
      seal(request);
      const stored = JSON.parse(fs.readFileSync(request.requestPath, "utf8"));
      stored.generatedAt = "2026-08-04T00:00:03.000Z";
      fs.writeFileSync(request.requestPath, `${JSON.stringify(stored, null, 2)}\n`);

      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "stale"
          && error.code === "FLOW_ARTIFACT_HANDOFF_STALE",
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects cataloged canonical input changes made after sealing as stale", () => {
    const value = fixture("draft-refine", {
      beforeActivate(candidate) {
        publishDraftBeforeTarget(candidate, { goal: "sealed input" });
      },
    });
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "worker output" }));
      seal(request);
      value.flowManager.publishArtifacts({
        specId: value.specId,
        nodeId: "draft-refine",
        artifactWrites: [{
          logicalKey: "draft",
          mediaType: "application/json",
          bytes: Buffer.from(json({ goal: "stale input" }), "utf8"),
        }],
      });

      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "stale"
          && error.code === "FLOW_ARTIFACT_HANDOFF_STALE",
      );
      assert.equal(findStepById(value.flowManager.load().steps, "draft-refine").status, "in_progress");
      assert.deepEqual(readCatalogJson(value, "draft", "draft-refine"), { goal: "stale input" });
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects traversal and oversized payloads as typed invalid handoffs", () => {
    const traversal = fixture();
    try {
      const request = traversal.coordinator.createRequest({
        ctx: traversal.ctx,
        state: traversal.flowManager.load(),
        invocation: traversal.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "sealed" }));
      seal(request);
      rewriteSubmission(request, (document) => {
        document.payloadManifest[0].relativePath = "../outside.json";
      });
      assert.throws(
        () => traversal.coordinator.reconcile({ ctx: traversal.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "invalid",
      );
    } finally {
      removeTmpDir(traversal.mainRoot);
    }

    const oversized = fixture();
    try {
      const request = oversized.coordinator.createRequest({
        ctx: oversized.ctx,
        state: oversized.flowManager.load(),
        invocation: oversized.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), Buffer.alloc((2 * 1024 * 1024) + 1));
      assert.throws(
        () => seal(request),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "invalid"
          && error.code === "FLOW_ARTIFACT_HANDOFF_INVALID",
      );
    } finally {
      removeTmpDir(oversized.mainRoot);
    }
  });

  it("rejects malformed JSON without publishing or completing", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), "{ malformed\n");
      assert.throws(
        () => seal(request),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "invalid"
          && error.code === "FLOW_ARTIFACT_HANDOFF_INVALID",
      );
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
      assert.equal(fs.existsSync(path.join(canonicalSpecDir(value), "draft.json")), false);
      assert.equal(fs.existsSync(request.submissionPath), false);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("retries one invalid pre-publication payload in a fresh handoff and preserves the first seal", async () => {
    const value = fixture("draft", { specRecord: validSpec() });
    try {
      const current = { value: draftWorkerAction() };
      let calls = 0;
      let firstHandoffDirectory = null;
      let firstPayloadBytes = null;
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            return findStepById(value.flowManager.load().steps, "draft").status === "done"
              ? completedWorkerAction()
              : structuredClone(current.value);
          },
        },
        agent: {
          async call(_prompt, options) {
            calls += 1;
            assert.equal(options.jsonSchema, undefined);
            assert.equal(options.fmtFallback, undefined);
            const requestPath = options.executionEnvironment.SENNEL_FLOW_HANDOFF_REQUEST;
            const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
            const payloadPath = request.payloads.find((entry) => entry.logicalName === "draft.json").payloadPath;
            fs.writeFileSync(payloadPath, calls === 1 ? "[]\n" : json({ goal: "retry succeeded" }));
            sealWorkerArtifactHandoff({
              requestPath,
              invocationId: options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION_ID,
            });
            if (calls === 1) {
              firstHandoffDirectory = path.dirname(requestPath);
              firstPayloadBytes = fs.readFileSync(payloadPath);
            }
          },
        },
        repositoryFingerprint: () => "stable-fixture",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};

      const result = await dispatcher.execute({
        ...value.ctx,
        flowState: value.flowManager.load(),
        expectRunId: value.flowManager.load().runId,
        expectSpec: value.specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.dispatch.boundary, "completed", JSON.stringify(result, null, 2));
      assert.equal(result.dispatch.dispatchCount, 2);
      assert.equal(calls, 2);
      assert.ok(firstHandoffDirectory);
      assert.equal(fs.existsSync(firstHandoffDirectory), true);
      assert.deepEqual(
        fs.readFileSync(path.join(firstHandoffDirectory, "payload", "draft.json")),
        firstPayloadBytes,
      );
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "done");
      assert.deepEqual(readCatalogJson(value, "draft", "draft-questions-review"), { goal: "retry succeeded" });
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("passes the guarded output schema and schema guidance to the spec artifact worker", async () => {
    const value = fixture("spec", {
      beforeActivate(candidate) {
        publishDraftBeforeTarget(candidate, { goal: "Create the specification." });
      },
    });
    try {
      const current = { value: {
        ...draftWorkerAction(),
        step: "spec",
        action: "write-spec",
        instructions: { key: "plan.spec", content: "Write the specification." },
        output_schema: loadWorkerArtifactHandoffSchema(),
      } };
      let guardedOutputSchema = null;
      let workerOptions = null;
      let workerPrompt = null;
      let calls = 0;
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            const nextAction = findStepById(value.flowManager.load().steps, "spec").status === "done"
              ? completedWorkerAction()
              : structuredClone(current.value);
            if (nextAction.step === "spec") guardedOutputSchema = nextAction.output_schema;
            return nextAction;
          },
        },
        agent: {
          async call(prompt, options) {
            calls += 1;
            workerOptions = options;
            workerPrompt = prompt;
            const requestPath = options.executionEnvironment.SENNEL_FLOW_HANDOFF_REQUEST;
            const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
            fs.writeFileSync(request.payloads.find((entry) => entry.logicalName === "spec.json").payloadPath, json(validSpec()));
            sealWorkerArtifactHandoff({
              requestPath,
              invocationId: options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION_ID,
            });
          },
        },
        repositoryFingerprint: () => "stable-fixture",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};

      const result = await dispatcher.execute({
        ...value.ctx,
        flowState: value.flowManager.load(),
        expectRunId: value.flowManager.load().runId,
        expectSpec: value.specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.deepEqual(workerOptions.jsonSchema, guardedOutputSchema);
      assert.deepEqual(workerOptions.jsonSchema, loadWorkerArtifactHandoffSchema());
      assert.notDeepEqual(workerOptions.jsonSchema, loadSpecJsonSchema());
      assert.ok(workerOptions.jsonSchema.properties.runtimeLog);
      assert.match(workerOptions.fmtFallback, /Spec artifact schema:/);
      assert.match(workerPrompt, /Spec artifact schema:/);
      assert.equal(result.dispatch.boundary, "completed", JSON.stringify(result, null, 2));
      assert.equal(result.dispatch.dispatchCount, 1);
      assert.equal(calls, 1);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("reports retry exhaustion after the second invalid output with durable diagnostics", async () => {
    const value = fixture("draft", { specRecord: validSpec() });
    try {
      const current = { value: draftWorkerAction() };
      const handoffDirectories = [];
      let calls = 0;
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            return structuredClone(current.value);
          },
        },
        agent: {
          async call(_prompt, options) {
            calls += 1;
            const requestPath = options.executionEnvironment.SENNEL_FLOW_HANDOFF_REQUEST;
            const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
            fs.writeFileSync(
              request.payloads.find((entry) => entry.logicalName === "draft.json").payloadPath,
              "[]\n",
            );
            sealWorkerArtifactHandoff({
              requestPath,
              invocationId: options.executionEnvironment.SENNEL_FLOW_DISPATCH_INVOCATION_ID,
            });
            handoffDirectories.push(path.dirname(requestPath));
          },
        },
        repositoryFingerprint: () => "stable-fixture",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};

      const result = await dispatcher.execute({
        ...value.ctx,
        flowState: value.flowManager.load(),
        expectRunId: value.flowManager.load().runId,
        expectSpec: value.specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "FLOW_ARTIFACT_HANDOFF_RETRY_EXHAUSTED");
      assert.equal(result.data.retryExhausted, true);
      assert.equal(result.data.attempts, 2);
      assert.equal(result.data.dispatch.dispatchCount, 2);
      assert.equal(result.data.first.handoffDirectory, handoffDirectories[0]);
      assert.equal(result.data.second.handoffDirectory, handoffDirectories[1]);
      assert.notEqual(result.data.first.handoffDirectory, result.data.second.handoffDirectory);
      assert.equal(result.data.first.classification, "invalid");
      assert.equal(result.data.second.classification, "invalid");
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
      assert.equal(fs.existsSync(path.join(canonicalSpecDir(value), "draft.json")), false);

      const issueLog = readCatalogJson(value, "issue.log", "impl-gate");
      const entry = issueLog.entries.find((candidate) => candidate.issueLogId === (
        `worker-handoff-${result.data.actionDigest}-invalid`
      ));
      assert.ok(entry);
      assert.equal(entry.diagnostic.code, "FLOW_ARTIFACT_HANDOFF_RETRY_EXHAUSTED");
      assert.equal(entry.diagnostic.attempts, 2);
      assert.equal(entry.diagnostic.first.handoffDirectory, handoffDirectories[0]);
      assert.equal(entry.diagnostic.second.handoffDirectory, handoffDirectories[1]);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects a pre-existing symlink in the staging directory authority", () => {
    const value = fixture();
    const outside = path.join(value.mainRoot, "outside-handoffs");
    try {
      const state = value.flowManager.load();
      fs.mkdirSync(outside);
      const handoffRoot = path.join(value.executionRoot, ".sennel", "handoffs");
      fs.mkdirSync(path.dirname(handoffRoot), { recursive: true });
      fs.symlinkSync(outside, handoffRoot);
      assert.throws(
        () => value.coordinator.createRequest({
          ctx: value.ctx,
          state,
          invocation: value.invocation,
        }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "invalid"
          && error.code === "FLOW_ARTIFACT_HANDOFF_INVALID",
      );
      assert.deepEqual(fs.readdirSync(outside), []);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects a concurrent cataloged worker target update before publishing a stale handoff", () => {
    const value = fixture("draft-refine", {
      beforeActivate(candidate) {
        publishDraftBeforeTarget(candidate, { goal: "before concurrent update" });
      },
    });
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "worker" }));
      seal(request);
      value.flowManager.publishArtifacts({
        specId: value.specId,
        nodeId: "draft-refine",
        artifactWrites: [{
          logicalKey: "draft",
          mediaType: "application/json",
          bytes: Buffer.from(json({ goal: "concurrent" }), "utf8"),
        }],
      });
      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "stale"
          && error.code === "FLOW_ARTIFACT_HANDOFF_STALE",
      );
      assert.deepEqual(readCatalogJson(value, "draft", "draft-refine"), { goal: "concurrent" });
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("discards an unsealed work unit from the current Run during recovery", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });

      const recovered = value.coordinator.recoverPending({ ctx: value.ctx });

      assert.equal(recovered.completed, true);
      assert.equal(recovered.cleanedHandoffs, 1);
      assert.equal(fs.existsSync(request.directory), false);
      assert.equal(fs.existsSync(executionHandoffRoot(value)), false);
      assert.equal(fs.existsSync(path.join(value.executionRoot, ".sennel", "handoffs")), true);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("preserves an unsealed work unit owned by another Run", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const otherRunId = "another-run-worker-handoff";
      const document = JSON.parse(fs.readFileSync(request.requestPath, "utf8"));
      document.runId = otherRunId;
      fs.writeFileSync(request.requestPath, `${JSON.stringify(document, null, 2)}\n`);
      const currentRunDirectory = path.dirname(path.dirname(request.directory));
      const otherRunDirectory = path.join(request.handoffRoot, identityDigest(otherRunId).slice(0, 24));
      fs.renameSync(currentRunDirectory, otherRunDirectory);
      const otherRequestPath = path.join(
        otherRunDirectory,
        path.basename(path.dirname(request.directory)),
        path.basename(request.directory),
        "request.json",
      );

      assert.throws(
        () => value.coordinator.recoverPending({ ctx: value.ctx }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED"
          && error.data.runId === otherRunId,
      );
      assert.equal(fs.existsSync(otherRequestPath), true);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("does not scan another Spec handoff namespace during recovery", () => {
    const value = fixture();
    try {
      const foreignRoot = path.join(
        value.executionRoot,
        ".sennel",
        "handoffs",
        identityDigest("501-foreign-worker-handoff").slice(0, 24),
      );
      fs.mkdirSync(foreignRoot, { recursive: true });
      const marker = path.join(foreignRoot, "preserve.txt");
      fs.writeFileSync(marker, "foreign handoff\n");

      assert.equal(value.coordinator.recoverPending({ ctx: value.ctx }), null);
      assert.equal(fs.readFileSync(marker, "utf8"), "foreign handoff\n");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("prunes only the completed Spec namespace after publication", () => {
    const value = fixture();
    try {
      const foreignRoot = path.join(
        value.executionRoot,
        ".sennel",
        "handoffs",
        identityDigest("501-foreign-worker-handoff").slice(0, 24),
      );
      fs.mkdirSync(foreignRoot, { recursive: true });
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "prune current namespace" }));
      seal(request);

      value.coordinator.reconcile({ ctx: value.ctx, request });

      assert.equal(fs.existsSync(executionHandoffRoot(value)), false);
      assert.equal(fs.existsSync(foreignRoot), true);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("recovers every V1 runtime cleanup interruption without reopening the Step", () => {
    const cleanupFaults = [
      "before-worker-handoff-cleanup-rename",
      "after-worker-handoff-cleanup-rename",
      "after-worker-handoff-cleanup",
    ];
    for (const faultPhase of cleanupFaults) {
      const value = fixture();
      try {
        const request = value.coordinator.createRequest({
          ctx: value.ctx,
          state: value.flowManager.load(),
          invocation: value.invocation,
        });
        fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: faultPhase }));
        seal(request);
        const interrupted = new WorkerArtifactHandoffCoordinator({
          faultInjector({ phase }) {
            if (phase === faultPhase) throw new Error("simulated cleanup crash");
          },
        });
        assert.throws(
          () => interrupted.reconcile({ ctx: value.ctx, request }),
          (error) => error instanceof WorkerArtifactHandoffError
            && error.classification === "recovery-required"
            && error.data.stepId === "draft"
            && error.data.actionDigest === ACTION_DIGEST,
          faultPhase,
        );
        assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "done", faultPhase);

        const recovered = value.coordinator.recoverPending({ ctx: value.ctx });
        if (faultPhase === "after-worker-handoff-cleanup") {
          assert.equal(recovered, null, faultPhase);
        } else {
          assert.equal(recovered.completed, true, faultPhase);
          assert.equal(recovered.cleanedHandoffs, 1, faultPhase);
        }
        assert.equal(fs.existsSync(request.directory), false, faultPhase);
        assert.equal(value.coordinator.recoverPending({ ctx: value.ctx }), null, faultPhase);
      } finally {
        removeTmpDir(value.mainRoot);
      }
    }
  });

  it("cleans a completed V1 runtime handoff when temporary request metadata is deleted", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "recover metadata cleanup" }));
      seal(request);
      const interrupted = new WorkerArtifactHandoffCoordinator({
        faultInjector({ phase }) {
          if (phase === "before-worker-handoff-cleanup-rename") throw new Error("simulated cleanup interruption");
        },
      });
      assert.throws(
        () => interrupted.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required",
      );
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "done");
      fs.unlinkSync(request.requestPath);

      const recovered = value.coordinator.recoverPending({ ctx: value.ctx });
      const state = value.flowManager.load();
      assert.equal(recovered.completed, true);
      assert.equal(recovered.cleanedHandoffs, 1);
      assert.equal(findStepById(state.steps, "draft").status, "done");
      assert.equal(fs.existsSync(request.directory), false);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("retains the guarded V1 run identity through cleanup recovery", () => {
    const runId = "b672ac1a-d8c7-4ea5-98c3-27431f6fbc8c";
    const value = fixture("draft", {
      runId,
      specId: "485-flow-authority-boundaries",
    });
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "resume preserved run" }));
      seal(request);
      const interrupted = new WorkerArtifactHandoffCoordinator({
        faultInjector({ phase }) {
          if (phase === "before-worker-handoff-cleanup-rename") throw new Error("simulated interruption");
        },
      });
      assert.throws(
        () => interrupted.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required",
      );

      value.coordinator.recoverPending({ ctx: value.ctx });
      const state = value.flowManager.load();
      assert.equal(state.runId, runId);
      assert.equal(findStepById(state.steps, "draft").status, "done");
      assert.ok(findStepById(state.steps, "draft").result.artifactRefs.some((entry) => (
        entry.kind === "worker-handoff"
      )));
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });
});
