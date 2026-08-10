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
import { createInitialDraftArtifactRevision } from "../../../src/flow/lib/draft-artifact-promotion.js";
import { FLOW_ARTIFACT_AUTHORITY_MATRIX } from "../../../src/flow/lib/flow-artifact-authority.js";
import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";
import SetStepCommand from "../../../src/flow/lib/set-step.js";
import { loadSpecJsonSchema } from "../../../src/lib/spec-json.js";
import {
  WorkerArtifactHandoffCoordinator,
  WorkerArtifactHandoffError,
  WorkerArtifactMutationAuthoritySnapshot,
  sealWorkerArtifactHandoff,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { persistAgentInvocationMetric } from "../../../src/lib/agent-invocation-metric.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
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
const PUBLICATION_FAULT_PHASES = Object.freeze([
  "after-worker-handoff-journal",
  "before-worker-handoff-publication-temp-open",
  "before-worker-handoff-publication-temp-write",
  "before-worker-handoff-publication-fsync",
  "before-worker-handoff-publication-temp-close",
  "before-worker-handoff-publication-rename",
  "before-worker-handoff-publication-directory-fsync",
  "after-worker-handoff-publication",
]);

function fixture(stepId = "draft", {
  worktree = true,
  runId = "run-worker-handoff",
  specId = "500-worker-handoff",
  issue = null,
  request = "Create the target-bound worker artifact handoff.",
} = {}) {
  const mainRoot = createTmpDir("worker-handoff-main-");
  const executionRoot = worktree ? path.join(mainRoot, "execution") : mainRoot;
  fs.mkdirSync(executionRoot, { recursive: true });
  const state = moveFlowToStep(makeFlowState({
    specId,
    runId,
    worktree,
    ...(issue == null ? {} : { issue }),
    ...(request == null ? {} : { request }),
  }), stepId);
  const flowManager = new FlowManager({
    root: executionRoot,
    mainRoot,
    inWorktree: worktree,
    specId,
  });
  flowManager.create(state);
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
  return { mainRoot, executionRoot, specId, flowManager, ctx, invocation, coordinator };
}

function canonicalSpecDir(value) {
  return path.join(value.mainRoot, "specs", value.specId);
}

function initializeGitRepository(value) {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: value.mainRoot });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: value.mainRoot });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: value.mainRoot });
  fs.writeFileSync(path.join(value.mainRoot, "product.js"), "export const value = 1;\n");
  execFileSync("git", ["add", "."], { cwd: value.mainRoot });
  execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: value.mainRoot });
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

function prepareSpecRepairHandoff() {
  const value = fixture("spec-repair");
  const review = {
    verdict: "REJECTED",
    blockingFindings: [{ title: "Missing invariant", target: "requirements[0]" }],
  };
  const triage = {
    version: 1,
    phase: "spec-triage",
    sourceReview: "spec-review.json",
    summary: "Apply the required invariant.",
    items: [{
      title: "Missing invariant",
      target: "requirements[0]",
      decision: "apply",
      rationale: "The invariant is required.",
      evidence: "The review identifies the missing contract.",
    }],
  };
  const repair = {
    version: 1,
    phase: "spec-repair",
    sourceReview: "spec-triage.json",
    summary: "Applied the required invariant.",
    items: [{
      title: "Missing invariant",
      target: "requirements[0]",
      decision: "applied",
      rationale: "The specification now states the invariant.",
      evidence: "requirements[0] contains the invariant.",
      changedFields: ["requirements[0]"],
    }],
  };
  fs.writeFileSync(path.join(canonicalSpecDir(value), "spec.json"), json(validSpec()));
  fs.writeFileSync(path.join(canonicalSpecDir(value), "spec-review.json"), json(review));
  fs.writeFileSync(path.join(canonicalSpecDir(value), "spec-triage.json"), json(triage));
  const request = value.coordinator.createRequest({
    ctx: value.ctx,
    state: value.flowManager.load(),
    invocation: value.invocation,
  });
  const repairedSpec = { ...validSpec(), goal: "Repaired specification" };
  fs.writeFileSync(request.payloadPath("spec-repair.json"), json(repair));
  fs.writeFileSync(request.payloadPath("spec.json"), json(repairedSpec));
  seal(request);
  return { value, request, repair, repairedSpec };
}

function prepareDraftRepairHandoff() {
  const value = fixture("draft-questions-repair");
  const draftPath = path.join(canonicalSpecDir(value), "draft.json");
  fs.writeFileSync(draftPath, json({ goal: "Repair the canonical draft." }));
  value.flowManager.mutate((state) => {
    state.draftArtifactRevision = createInitialDraftArtifactRevision({ state, draftPath }).toJSON();
    state.draftArtifactRevision.sourceStepId = "draft";
  });
  const revision = value.flowManager.load().draftArtifactRevision;
  const review = {
    version: 2,
    phase: "draft-questions",
    sourceDraft: "draft.json",
    sourceDraftRevision: revision,
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
  };
  const triage = {
    version: 1,
    phase: "draft-questions-triage",
    sourceReview: "draft-review-questions.json",
    summary: "Apply the parent publication repair.",
    items: [{
      title: "Publish through the parent",
      target: "goal",
      decision: "apply",
      rationale: "The review target is valid.",
      evidence: "The parent owns canonical publication.",
    }],
  };
  const repair = {
    version: 1,
    phase: "draft-questions-repair",
    sourceTriage: "draft-questions-triage.json",
    summary: "Applied the parent publication repair.",
    items: [{
      title: "Publish through the parent",
      target: "goal",
      rationale: "The repair uses the guarded handoff.",
      evidence: "The parent publishes the sealed bytes.",
      changedFieldPaths: ["goal"],
    }],
  };
  fs.writeFileSync(path.join(canonicalSpecDir(value), "draft-review-questions.json"), json(review));
  fs.writeFileSync(path.join(canonicalSpecDir(value), "draft-questions-triage.json"), json(triage));
  const request = value.coordinator.createRequest({
    ctx: value.ctx,
    state: value.flowManager.load(),
    invocation: value.invocation,
  });
  const repairedDraft = { goal: "Parent publication is canonical." };
  fs.writeFileSync(request.payloadPath("draft-questions-repair.json"), json(repair));
  fs.writeFileSync(request.payloadPath("draft.json"), json(repairedDraft));
  seal(request);
  return { value, request, repair, repairedDraft };
}

describe("worker artifact handoff", () => {
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
      assert.ok(entry.producer);
      assert.ok(entry.writableAuthority);
      assert.ok(entry.consumer);
      assert.ok(entry.publicationOwner);
      assert.ok(entry.completionValidator);
      assert.ok(entry.sourceBinding);
      assert.ok(entry.recoveryOwner);
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
    const value = fixture("draft", { issue: 501, request: "secondary Flow request" });
    try {
      fs.writeFileSync(path.join(canonicalSpecDir(value), "issue.md"), "Authoritative Issue body.\n");
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
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "sealed draft" }));
      seal(request);

      const result = value.coordinator.reconcile({ ctx: value.ctx, request });
      const state = value.flowManager.load();

      assert.equal(result.completed, true);
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir(value), "draft.json"), "utf8")),
        { goal: "sealed draft" },
      );
      assert.equal(findStepById(state.steps, "draft").status, "done");
      assert.match(state.draftArtifactRevision.digest, /^[a-f0-9]{64}$/);
      assert.equal(state.workerArtifactReceipts.length, 1);
      assert.equal(state.workerArtifactPublication, undefined);
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
      assert.equal(request.directory.startsWith(path.join(value.mainRoot, ".sennel", "handoffs")), true);
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "local handoff" }));
      seal(request);

      value.coordinator.reconcile({ ctx: value.ctx, request });

      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir(value), "draft.json"), "utf8")),
        { goal: "local handoff" },
      );
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
    const specValue = fixture("spec");
    try {
      fs.writeFileSync(path.join(canonicalSpecDir(specValue), "draft.json"), json({ goal: "draft input" }));
      const specRequest = specValue.coordinator.createRequest({
        ctx: specValue.ctx,
        state: specValue.flowManager.load(),
        invocation: specValue.invocation,
      });
      fs.writeFileSync(specRequest.payloadPath("spec.json"), json(validSpec()));
      seal(specRequest);
      specValue.coordinator.reconcile({ ctx: specValue.ctx, request: specRequest });
      assert.equal(findStepById(specValue.flowManager.load().steps, "spec").status, "done");
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir(specValue), "spec.json"), "utf8")),
        validSpec(),
      );
    } finally {
      removeTmpDir(specValue.mainRoot);
    }

    const testValue = fixture("test");
    try {
      fs.writeFileSync(path.join(canonicalSpecDir(testValue), "spec.json"), json(validSpec()));
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
        fs.existsSync(path.join(canonicalSpecDir(testValue), "tests", "handoff.test.js")),
        true,
      );
    } finally {
      removeTmpDir(testValue.mainRoot);
    }
  });

  it("preserves command-owned test evidence while replacing the worker-owned test tree", () => {
    const value = fixture("test");
    try {
      const specDir = canonicalSpecDir(value);
      const testsDir = path.join(specDir, "tests");
      const evidenceDir = path.join(testsDir, ".raw");
      fs.mkdirSync(evidenceDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "spec.json"), json(validSpec()));
      fs.writeFileSync(path.join(testsDir, "obsolete.test.js"), "// spec: R1\n");
      fs.writeFileSync(path.join(evidenceDir, "scenario-validity.log"), "command-owned evidence\n");

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

      assert.equal(fs.existsSync(path.join(testsDir, "obsolete.test.js")), false);
      assert.equal(fs.existsSync(path.join(testsDir, "current.test.js")), true);
      assert.equal(
        fs.readFileSync(path.join(evidenceDir, "scenario-validity.log"), "utf8"),
        "command-owned evidence\n",
      );
      assert.equal(findStepById(value.flowManager.load().steps, "test").status, "done");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects spec tests that statically import a missing execution module", () => {
    const value = fixture("test");
    try {
      fs.writeFileSync(path.join(canonicalSpecDir(value), "spec.json"), json(validSpec()));
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
      assert.equal(
        fs.existsSync(path.join(canonicalSpecDir(value), "tests", "future-module.test.js")),
        false,
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects worker output in the command-owned test evidence directory", () => {
    const value = fixture("test");
    try {
      fs.writeFileSync(path.join(canonicalSpecDir(value), "spec.json"), json(validSpec()));
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

  it("rejects canonical-main mutations made outside the handoff payload authority", () => {
    const value = fixture("draft", { worktree: true });
    try {
      initializeGitRepository(value);
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      const authority = WorkerArtifactMutationAuthoritySnapshot.capture(request);
      fs.writeFileSync(
        path.join(canonicalSpecDir(value), "draft.json"),
        json({ goal: "illicit canonical write" }),
      );

      assert.throws(
        () => authority.assertUnchanged(),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.code === "FLOW_ARTIFACT_HANDOFF_AUTHORITY_VIOLATION"
          && error.data.authorities.includes("canonical")
          && error.data.changedPaths.some((entry) => entry.endsWith("draft.json")),
      );
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
      const untrackedPath = path.join(canonicalSpecDir(value), "preexisting.json");
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

  it("rejects canonical input changes made after sealing as stale", () => {
    const value = fixture("spec");
    try {
      const draftPath = path.join(canonicalSpecDir(value), "draft.json");
      fs.writeFileSync(draftPath, json({ goal: "sealed input" }));
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("spec.json"), json(validSpec()));
      seal(request);
      fs.writeFileSync(draftPath, json({ goal: "stale input" }));

      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "stale"
          && error.code === "FLOW_ARTIFACT_HANDOFF_STALE",
      );
      assert.equal(findStepById(value.flowManager.load().steps, "spec").status, "in_progress");
      assert.equal(fs.existsSync(path.join(canonicalSpecDir(value), "spec.json")), false);
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
    const value = fixture("draft");
    try {
      fs.writeFileSync(path.join(canonicalSpecDir(value), "spec.json"), json(validSpec()));
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
      assert.equal(value.flowManager.load().workerArtifactPublication, undefined);
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "done");
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir(value), "draft.json"), "utf8")),
        { goal: "retry succeeded" },
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("passes the guarded output schema and schema guidance to the spec artifact worker", async () => {
    const value = fixture("spec");
    try {
      const specDir = canonicalSpecDir(value);
      fs.writeFileSync(path.join(specDir, "draft.json"), json({ goal: "Create the specification." }));
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
    const value = fixture("draft");
    try {
      const specDir = canonicalSpecDir(value);
      fs.writeFileSync(path.join(specDir, "spec.json"), json(validSpec()));
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
      assert.equal(value.flowManager.load().workerArtifactPublication, undefined);
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
      assert.equal(fs.existsSync(path.join(specDir, "draft.json")), false);

      const issueLog = JSON.parse(fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"));
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
      fs.mkdirSync(outside);
      fs.mkdirSync(path.join(value.executionRoot, ".sennel"), { recursive: true });
      fs.symlinkSync(outside, path.join(value.executionRoot, ".sennel", "handoffs"));
      assert.throws(
        () => value.coordinator.createRequest({
          ctx: value.ctx,
          state: value.flowManager.load(),
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

  it("classifies a concurrent canonical target change as a conflict", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "worker" }));
      seal(request);
      fs.writeFileSync(path.join(canonicalSpecDir(value), "draft.json"), json({ goal: "concurrent" }));
      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "conflict"
          && error.code === "FLOW_ARTIFACT_HANDOFF_CONFLICT",
      );
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir(value), "draft.json"), "utf8")),
        { goal: "concurrent" },
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("recovers every journal and atomic-publication interruption idempotently", () => {
    for (const faultPhase of PUBLICATION_FAULT_PHASES) {
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
          now: () => new Date("2026-08-04T00:00:02.000Z"),
          faultInjector({ phase }) {
            if (phase === faultPhase) throw new Error("simulated crash");
          },
        });
        assert.throws(
          () => interrupted.reconcile({ ctx: value.ctx, request }),
          (error) => error instanceof WorkerArtifactHandoffError
            && error.classification === "recovery-required",
          faultPhase,
        );
        assert.ok(value.flowManager.load().workerArtifactPublication);

        const recovered = value.coordinator.recoverPending({ ctx: value.ctx });
        const state = value.flowManager.load();
        assert.equal(recovered.completed, true, faultPhase);
        assert.equal(findStepById(state.steps, "draft").status, "done", faultPhase);
        assert.equal(state.workerArtifactPublication, undefined, faultPhase);
        assert.equal(state.workerArtifactReceipts.length, 1, faultPhase);
      } finally {
        removeTmpDir(value.mainRoot);
      }
    }
  });

  it("retains guarded action identity when pending publication reconstruction fails", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "journal identity" }));
      seal(request);
      const interrupted = new WorkerArtifactHandoffCoordinator({
        faultInjector({ phase }) {
          if (phase === "after-worker-handoff-journal") throw new Error("simulated crash");
        },
      });
      assert.throws(
        () => interrupted.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required",
      );
      fs.unlinkSync(request.requestPath);

      assert.throws(
        () => value.coordinator.recoverPending({ ctx: value.ctx }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "missing"
          && error.data.stepId === "draft"
          && error.data.actionDigest === ACTION_DIGEST
          && error.data.dispatchInvocationId === value.invocation.id,
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("cleans a consumed handoff after interruption following the state transition", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "transition committed" }));
      seal(request);
      const interrupted = new WorkerArtifactHandoffCoordinator({
        faultInjector({ phase }) {
          if (phase === "after-worker-handoff-transition") throw new Error("simulated crash");
        },
      });
      assert.throws(
        () => interrupted.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required",
      );
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "done");
      assert.equal(fs.existsSync(request.directory), true);

      const recovered = value.coordinator.recoverPending({ ctx: value.ctx });
      assert.equal(recovered.completed, true);
      assert.equal(recovered.cleanedHandoffs, 1);
      assert.equal(fs.existsSync(request.directory), false);
      assert.equal(value.coordinator.recoverPending({ ctx: value.ctx }), null);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("recovers transition cleanup after request metadata was partially deleted", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "transition committed" }));
      seal(request);
      const interrupted = new WorkerArtifactHandoffCoordinator({
        faultInjector({ phase }) {
          if (phase === "after-worker-handoff-transition") throw new Error("simulated crash");
        },
      });
      assert.throws(
        () => interrupted.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required",
      );
      fs.unlinkSync(request.requestPath);

      const recovered = value.coordinator.recoverPending({ ctx: value.ctx });
      assert.equal(recovered.completed, true);
      assert.equal(recovered.cleanedHandoffs, 1);
      assert.equal(fs.existsSync(request.directory), false);
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "done");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("recovers every post-transition cleanup interruption without reopening the step", () => {
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

  it("recovers every multi-artifact spec-repair publication boundary as one transaction", () => {
    for (const faultPhase of PUBLICATION_FAULT_PHASES) {
      const { value, request, repair, repairedSpec } = prepareSpecRepairHandoff();
      try {
        let injected = false;
        const interrupted = new WorkerArtifactHandoffCoordinator({
          faultInjector({ phase }) {
            if (!injected && phase === faultPhase) {
              injected = true;
              throw new Error("simulated repair interruption");
            }
          },
        });
        assert.throws(
          () => interrupted.reconcile({ ctx: value.ctx, request }),
          (error) => error instanceof WorkerArtifactHandoffError
            && error.classification === "recovery-required",
          faultPhase,
        );
        assert.ok(value.flowManager.load().workerArtifactPublication);

        value.coordinator.recoverPending({ ctx: value.ctx });
        const state = value.flowManager.load();
        assert.equal(findStepById(state.steps, "spec-repair").status, "done", faultPhase);
        assert.equal(state.workerArtifactPublication, undefined, faultPhase);
        assert.equal(state.specArtifactRevision.stepId, "spec-repair", faultPhase);
        assert.deepEqual(
          JSON.parse(fs.readFileSync(path.join(canonicalSpecDir(value), "spec.json"), "utf8")),
          repairedSpec,
          faultPhase,
        );
        assert.deepEqual(
          JSON.parse(fs.readFileSync(path.join(canonicalSpecDir(value), "spec-repair.json"), "utf8")),
          repair,
          faultPhase,
        );
      } finally {
        removeTmpDir(value.mainRoot);
      }
    }
  });

  it("recovers a partially visible draft repair and revision as one transaction", () => {
    const { value, request, repair, repairedDraft } = prepareDraftRepairHandoff();
    try {
      let injected = false;
      const interrupted = new WorkerArtifactHandoffCoordinator({
        faultInjector({ phase }) {
          if (!injected && phase === "before-worker-handoff-publication-directory-fsync") {
            injected = true;
            throw new Error("simulated draft repair interruption");
          }
        },
      });
      assert.throws(
        () => interrupted.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required",
      );

      value.coordinator.recoverPending({ ctx: value.ctx });
      const state = value.flowManager.load();
      assert.equal(findStepById(state.steps, "draft-questions-repair").status, "done");
      assert.equal(state.draftArtifactRevision.sourceStepId, "draft-questions-repair");
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir(value), "draft.json"), "utf8")),
        repairedDraft,
      );
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir(value), "draft-questions-repair.json"), "utf8")),
        repair,
      );
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("resumes the preserved guarded run identity through journal recovery", () => {
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
          if (phase === "after-worker-handoff-journal") throw new Error("simulated interruption");
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
      assert.equal(state.workerArtifactReceipts.at(-1).runId, runId);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("keeps a pending publication journal in the recovery path instead of retrying it", () => {
    const value = fixture("draft");
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "recover the journal" }));
      seal(request);
      const interrupted = new WorkerArtifactHandoffCoordinator({
        faultInjector({ phase }) {
          if (phase === "after-worker-handoff-journal") throw new Error("simulated journal interruption");
        },
      });
      assert.throws(
        () => interrupted.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required",
      );
      const pendingBefore = structuredClone(value.flowManager.load().workerArtifactPublication);
      fs.rmSync(request.submissionPath);

      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required"
          && error.retryable === false
          && error.code === "FLOW_ARTIFACT_HANDOFF_RECOVERY_REQUIRED",
      );
      assert.deepEqual(value.flowManager.load().workerArtifactPublication, pendingBefore);
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });
});
