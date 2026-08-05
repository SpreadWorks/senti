import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
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
import {
  WorkerArtifactHandoffCoordinator,
  WorkerArtifactHandoffError,
  sealWorkerArtifactHandoff,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  validWorkerHandoffSpec as validSpec,
  workerArtifactJson as json,
} from "../../helpers/worker-artifact.js";

const ACTION_DIGEST = "a".repeat(64);
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
} = {}) {
  const mainRoot = createTmpDir("worker-handoff-main-");
  const executionRoot = worktree ? path.join(mainRoot, "execution") : mainRoot;
  fs.mkdirSync(executionRoot, { recursive: true });
  const state = moveFlowToStep(makeFlowState({
    specId,
    runId,
    worktree,
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

function seal(request) {
  return sealWorkerArtifactHandoff({
    requestPath: request.requestPath,
    invocationId: request.dispatchInvocationId,
    now: () => new Date("2026-08-04T00:00:01.000Z"),
  });
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
      assert.equal(request.directory.startsWith(path.join(value.mainRoot, ".senti", "handoffs")), true);
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
            const requestPath = options.executionEnvironment.SENTI_FLOW_HANDOFF_REQUEST;
            const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
            fs.writeFileSync(
              request.payloads.find((entry) => entry.logicalName === "draft.json").payloadPath,
              json({ goal: "dispatcher-owned handoff" }),
            );
            sealWorkerArtifactHandoff({
              requestPath,
              invocationId: options.executionEnvironment.SENTI_FLOW_DISPATCH_INVOCATION_ID,
            });
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
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "done");
      } finally {
        removeTmpDir(value.mainRoot);
      }
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
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
    } finally {
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
      seal(request);

      assert.throws(
        () => value.coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "invalid"
          && error.code === "FLOW_ARTIFACT_HANDOFF_INVALID",
      );
      assert.equal(findStepById(value.flowManager.load().steps, "draft").status, "in_progress");
      assert.equal(fs.existsSync(path.join(canonicalSpecDir(value), "draft.json")), false);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects a pre-existing symlink in the staging directory authority", () => {
    const value = fixture();
    const outside = path.join(value.mainRoot, "outside-handoffs");
    try {
      fs.mkdirSync(outside);
      fs.mkdirSync(path.join(value.executionRoot, ".senti"), { recursive: true });
      fs.symlinkSync(outside, path.join(value.executionRoot, ".senti", "handoffs"));
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
});
