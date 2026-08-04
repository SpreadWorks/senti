import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import {
  buildInitialNestedSteps,
  buildInitialTaskSteps,
} from "../../../src/flow/definition.js";
import { FLOW_ARTIFACT_AUTHORITY_MATRIX } from "../../../src/flow/lib/flow-artifact-authority.js";
import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";
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

function fixture(stepId = "draft") {
  const mainRoot = createTmpDir("worker-handoff-main-");
  const executionRoot = path.join(mainRoot, "execution");
  fs.mkdirSync(executionRoot, { recursive: true });
  const specId = "500-worker-handoff";
  const state = moveFlowToStep(makeFlowState({
    specId,
    runId: "run-worker-handoff",
    worktree: true,
  }), stepId);
  const flowManager = new FlowManager({
    root: executionRoot,
    mainRoot,
    inWorktree: true,
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

  it("lets a worktree dispatcher consume one sealed worker payload instead of worker completion", async () => {
    const value = fixture();
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
        /directory authority must be a real directory/,
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

  it("recovers an interrupted journaled publication idempotently", () => {
    const value = fixture();
    try {
      const request = value.coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: value.invocation,
      });
      fs.writeFileSync(request.payloadPath("draft.json"), json({ goal: "recoverable" }));
      seal(request);
      const interrupted = new WorkerArtifactHandoffCoordinator({
        now: () => new Date("2026-08-04T00:00:02.000Z"),
        faultInjector({ phase }) {
          if (phase === "after-worker-handoff-publication") throw new Error("simulated crash");
        },
      });
      assert.throws(
        () => interrupted.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "recovery-required",
      );
      assert.ok(value.flowManager.load().workerArtifactPublication);

      const recovered = value.coordinator.recoverPending({ ctx: value.ctx });
      const state = value.flowManager.load();
      assert.equal(recovered.completed, true);
      assert.equal(findStepById(state.steps, "draft").status, "done");
      assert.equal(state.workerArtifactPublication, undefined);
      assert.equal(state.workerArtifactReceipts.length, 1);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });
});
