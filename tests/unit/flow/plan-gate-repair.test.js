import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { findActiveNode } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { PlanGateRepairRecord } from "../../../src/flow/lib/plan-gate-repair.js";
import RunRepairPlanGateCommand from "../../../src/flow/lib/run-repair-plan-gate.js";
import {
  NextActionDirectiveResolver,
} from "../../../src/flow/lib/next-action-directive.js";
import { NextActionPlanner } from "../../../src/flow/lib/get-next-action.js";
import { RetryOutcome, StepAttempt } from "../../../src/flow/lib/step-outcome.js";
import {
  WorkerArtifactHandoffCoordinator,
  WorkerArtifactHandoffError,
  sealWorkerArtifactHandoff,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import {
  appendIssueLogFromGateResult,
  computeGateEvidenceState,
  RunGateCommand,
  updateGateRetryCounter,
} from "../../../src/flow/lib/run-gate.js";
import { dispatchRepositoryFingerprint } from "../../../src/flow/lib/run-dispatch.js";
import { recordScenarioValidityRepairEvidence } from "../../../src/flow/lib/run-scenario-validity.js";
import { appendIssueLogEntry, loadIssueLog } from "../../../src/flow/lib/set-issue-log.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  makeDefaultTask,
  makeFlowState,
  moveFlowToStep,
} from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { validWorkerHandoffSpec } from "../../helpers/worker-artifact.js";

const SPEC_ID = "485-flow-authority-boundaries";
const RUN_ID = "run-plan-gate-repair";
const OBSERVATION = Object.freeze({
  kind: "violation",
  failureMode: "guardrail-violation",
  requirementRef: "migration-parity",
  where: { file: "Content", locator: "impactOnExisting" },
  observed: "The draft omits a retained public behavior mapping.",
  severity: "blocking",
  refs: ["migration-parity"],
});

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function initGit(root) {
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: root });
  fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
  execFileSync("git", ["add", "README.md"], { cwd: root });
  execFileSync("git", ["commit", "-q", "-m", "fixture"], { cwd: root });
}

function planGateFixture({ worktree = true, phase = "draft", currentTask = false } = {}) {
  const mainRoot = createTmpDir("plan-gate-repair-");
  initGit(mainRoot);
  const executionRoot = worktree ? path.join(mainRoot, "execution") : mainRoot;
  if (worktree) fs.mkdirSync(executionRoot, { recursive: true });
  const state = moveFlowToStep(makeFlowState({
    specId: SPEC_ID,
    runId: RUN_ID,
    issue: 494,
    request: "Repair the draft gate while preserving public behavior.",
    worktree,
    metrics: [
      { phase, counter: "gateRetry", delta: 5 },
      { phase: phase === "draft" ? "draft-coverage" : "spec", counter: "reviewRetry", delta: 2 },
    ],
    ...(currentTask ? {
      tasks: [makeDefaultTask({ id: "T-1", status: "in_progress" })],
      currentTaskId: "T-1",
    } : {}),
  }), phase === "draft" ? "draft-gate" : "spec-gate");
  const flowManager = new FlowManager({
    root: executionRoot,
    mainRoot,
    inWorktree: worktree,
    specId: SPEC_ID,
  });
  flowManager.create(state);
  const specDir = path.join(mainRoot, "specs", SPEC_ID);
  fs.writeFileSync(path.join(specDir, "issue.md"), "Issue 494 requires the guarded draft repair.\n");
  fs.writeFileSync(path.join(specDir, "draft.json"), json({
    goal: "Preserve public behavior.",
    impactOnExisting: ["The affected surfaces must remain compatible."],
  }));
  if (phase === "spec") {
    fs.writeFileSync(path.join(specDir, "spec.json"), json({ goal: "Preserve public behavior." }));
  }
  appendIssueLogEntry(mainRoot, `specs/${SPEC_ID}/spec.json`, {
    step: `${phase}-gate`,
    phase,
    reason: OBSERVATION.observed,
    observations: [OBSERVATION],
    timestamp: "2026-08-05T00:00:00.000Z",
  }, `${phase}-gate-failure`);
  const ctx = {
    root: mainRoot,
    mainRoot,
    executionRoot,
    flowManager,
    flowState: flowManager.load(),
    specId: SPEC_ID,
  };
  return { mainRoot, executionRoot, specDir, flowManager, ctx };
}

function scenarioRepairFixture({ currentTask = false } = {}) {
  const mainRoot = createTmpDir("scenario-test-repair-");
  initGit(mainRoot);
  const executionRoot = path.join(mainRoot, "execution");
  fs.mkdirSync(executionRoot, { recursive: true });
  const state = moveFlowToStep(makeFlowState({
    specId: SPEC_ID,
    runId: RUN_ID,
    issue: 494,
    request: "Repair invalid scenario tests before implementation.",
    worktree: true,
    specTestArtifactRevision: {
      version: 1,
      runId: RUN_ID,
      specId: SPEC_ID,
      stepId: "test",
      digest: "1".repeat(64),
      byteLength: 100,
      finalizedAt: "2026-08-05T00:00:00.000Z",
    },
    ...(currentTask ? {
      tasks: [makeDefaultTask({ id: "T-1", status: "in_progress" })],
      currentTaskId: "T-1",
    } : {}),
  }), "scenario-validity");
  const flowManager = new FlowManager({
    root: executionRoot,
    mainRoot,
    inWorktree: true,
    specId: SPEC_ID,
  });
  flowManager.create(state);
  const specDir = path.join(mainRoot, "specs", SPEC_ID);
  fs.writeFileSync(path.join(specDir, "issue.md"), "Issue 494 requires scenario-test repair.\n");
  fs.writeFileSync(path.join(specDir, "spec.json"), json(validWorkerHandoffSpec()));
  fs.mkdirSync(path.join(specDir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(specDir, "tests", "scenario.test.js"), [
    "// spec: R1",
    "import test from 'node:test';",
    "test('R1: invalid premise', () => {});",
    "",
  ].join("\n"));
  fs.writeFileSync(path.join(specDir, "scenario-validity-result.json"), json({
    version: "1",
    result: "block",
  }));
  const current = flowManager.load();
  recordScenarioValidityRepairEvidence({
    root: mainRoot,
    state: current,
    summary: [{
      id: "R1",
      classification: "invalid_test",
      evidence: {
        test_file: `specs/${SPEC_ID}/tests/scenario.test.js`,
        test_name: "R1: invalid premise",
      },
    }],
    timestamp: "2026-08-05T00:00:30.000Z",
  });
  const ctx = {
    root: mainRoot,
    mainRoot,
    executionRoot,
    flowManager,
    flowState: current,
    specId: SPEC_ID,
  };
  return { mainRoot, executionRoot, specDir, flowManager, ctx };
}

function repair(value) {
  const result = new RunRepairPlanGateCommand().execute(value.ctx);
  assert.equal(result.ok, true);
  value.ctx.flowState = value.flowManager.load();
  return result;
}

function handoffRequest(value, invocationId) {
  const coordinator = new WorkerArtifactHandoffCoordinator({
    now: () => new Date("2026-08-05T00:01:00.000Z"),
  });
  const request = coordinator.createRequest({
    ctx: value.ctx,
    state: value.flowManager.load(),
    invocation: {
      id: invocationId,
      target: { digest: "b".repeat(64) },
      action: {
        digest: "a".repeat(64),
        nextAction: { step: "draft-refine" },
      },
    },
  });
  return { coordinator, request };
}

describe("governed plan-gate repair", () => {
  it("normalizes document-level observations without a locator", () => {
    for (const where of [{ file: "spec.json" }, { file: "spec.json", locator: null }]) {
      const issueLogEntry = {
        issueLogId: "draft-gate-document-observation",
        phase: "draft",
        observations: [{
          ...OBSERVATION,
          where,
        }],
      };
      const record = PlanGateRepairRecord.create({
        state: { runId: RUN_ID, specId: SPEC_ID, issue: 494 },
        phase: "draft",
        issueLogEntry,
        requestedAt: "2026-08-05T00:00:00.000Z",
      });

      assert.deepEqual(record.observations[0].where.toJSON(), { file: "spec.json" });
      assert.deepEqual(record.toJSON().observations[0].where, { file: "spec.json" });
      assert.deepEqual(record.toWorkerJSON().observations[0].where, { file: "spec.json" });
      assert.equal(record.matchesIssueLogEntry(issueLogEntry), true);
    }
  });

  it("rewinds the whole downstream validation route and freezes exact gate evidence", () => {
    const value = planGateFixture();
    try {
      const result = repair(value);
      const state = value.flowManager.load();
      const record = PlanGateRepairRecord.from(state.planGateRepair);

      assert.equal(result.data.previousStep, "draft-gate");
      assert.equal(findActiveNode(state).stepId, "draft-refine");
      assert.equal(record.runId, RUN_ID);
      assert.equal(record.specId, SPEC_ID);
      assert.equal(record.observations[0].requirementRef, "migration-parity");
      assert.equal(findStepById(state.steps, "draft-coverage-review").status, "pending");
      assert.equal(findStepById(state.steps, "draft-gate").status, "pending");
      assert.deepEqual(state.metrics.slice(-2).map((entry) => [
        entry.phase,
        entry.counter,
        entry.reset,
      ]), [
        ["draft", "gateRetry", true],
        ["draft-coverage", "reviewRetry", true],
      ]);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("repairs the flow route without mutating an active current task", () => {
    const value = planGateFixture({ currentTask: true });
    try {
      const before = value.flowManager.load();
      const taskSnapshot = structuredClone(before.tasks);

      const result = repair(value);
      const state = value.flowManager.load();

      assert.equal(result.data.previousStep, "draft-gate");
      assert.equal(findActiveNode(state).stepId, "draft-refine");
      assert.equal(state.currentTaskId, "T-1");
      assert.deepEqual(state.tasks, taskSnapshot);
      assert.equal(state.planGateRepair.phase, "draft");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("does not partially update either scope when plan-gate evidence changes before commit", () => {
    const value = planGateFixture({ currentTask: true });
    try {
      const before = value.flowManager.load();
      const taskSnapshot = structuredClone(before.tasks);
      const metricSnapshot = structuredClone(before.metrics);
      const originalUpdate = value.flowManager.updateStepStatus.bind(value.flowManager);
      value.flowManager.updateStepStatus = (transition, options, intent) => {
        appendIssueLogEntry(value.mainRoot, `specs/${SPEC_ID}/spec.json`, {
          step: "draft-gate",
          phase: "draft",
          reason: "The canonical gate evidence changed before repair commit.",
          observations: [OBSERVATION],
          timestamp: "2026-08-05T00:00:01.000Z",
        }, "draft-gate-concurrent-evidence");
        return originalUpdate(transition, options, intent);
      };

      assert.throws(
        () => new RunRepairPlanGateCommand().execute(value.ctx),
        /plan gate repair source evidence changed before transition/,
      );

      const state = value.flowManager.load();
      assert.equal(findActiveNode(state).stepId, "draft-gate");
      assert.equal(state.planGateRepair, undefined);
      assert.equal(state.currentTaskId, "T-1");
      assert.deepEqual(state.tasks, taskSnapshot);
      assert.deepEqual(state.metrics, metricSnapshot);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("uses the same governed route for spec-gate repair", () => {
    const value = planGateFixture({ phase: "spec" });
    try {
      const result = repair(value);
      const state = value.flowManager.load();
      assert.equal(result.data.previousStep, "spec-gate");
      assert.equal(findActiveNode(state).stepId, "spec");
      assert.equal(findStepById(state.steps, "spec-review").status, "pending");
      assert.equal(findStepById(state.steps, "spec-gate").status, "pending");
      assert.equal(state.planGateRepair.phase, "spec");
      assert.deepEqual(state.metrics.slice(-2).map((entry) => [
        entry.phase,
        entry.counter,
        entry.reset,
      ]), [
        ["spec", "gateRetry", true],
        ["spec", "reviewRetry", true],
      ]);
      const coordinator = new WorkerArtifactHandoffCoordinator();
      const request = coordinator.createRequest({
        ctx: value.ctx,
        state,
        invocation: {
          id: "dispatch-spec-repair",
          action: {
            digest: "c".repeat(64),
            nextAction: { step: "spec" },
          },
        },
      });
      assert.deepEqual(request.inputs.map((input) => input.name), ["draft.json", "spec.json"]);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("routes invalid scenario evidence through a changed test handoff instead of repeating scenario-validity", () => {
    const value = scenarioRepairFixture({ currentTask: true });
    try {
      const taskSnapshot = structuredClone(value.flowManager.load().tasks);
      const plan = new NextActionPlanner().build({
        root: value.mainRoot,
        mainRoot: value.mainRoot,
        executionRoot: value.executionRoot,
        flowState: value.flowManager.load(),
        config: {},
        flowCommandBoundary: false,
      });
      assert.equal(plan.result.directive.kind, "repair_evidence");
      assert.equal(plan.result.directive.actionId, "REPAIR_SCENARIO_TESTS");
      assert.match(plan.result.directive.nextAction, /^senrail flow run repair-plan-gate /);

      const result = repair(value);
      let state = value.flowManager.load();
      assert.equal(result.data.previousStep, "scenario-validity");
      assert.equal(findActiveNode(state).stepId, "test");
      assert.equal(state.planGateRepair.phase, "test");
      assert.equal(state.specTestArtifactRevision, undefined);
      assert.equal(state.currentTaskId, "T-1");
      assert.deepEqual(state.tasks, taskSnapshot);

      const coordinator = new WorkerArtifactHandoffCoordinator();
      const request = coordinator.createRequest({
        ctx: value.ctx,
        state,
        invocation: {
          id: "dispatch-scenario-test-repair",
          action: {
            digest: "9".repeat(64),
            nextAction: { step: "test" },
          },
        },
      });
      assert.deepEqual(
        request.inputs.map((input) => input.targetRelativePath),
        ["spec.json", "scenario-validity-result.json"],
      );
      fs.writeFileSync(path.join(request.payloadPath("spec-tests"), "scenario.test.js"), [
        "// spec: R1",
        "import assert from 'node:assert/strict';",
        "import test from 'node:test';",
        "test('R1: declared behavior', () => assert.fail('not implemented'));",
        "",
      ].join("\n"));
      sealWorkerArtifactHandoff({
        requestPath: request.requestPath,
        invocationId: request.dispatchInvocationId,
      });

      const published = coordinator.reconcile({ ctx: value.ctx, request });
      state = value.flowManager.load();
      assert.equal(published.completed, true);
      assert.equal(state.planGateRepair, undefined);
      assert.equal(findActiveNode(state).stepId, "scenario-validity");
      assert.equal(state.specTestArtifactRevision.stepId, "test");
      assert.deepEqual(state.tasks, taskSnapshot);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("seals and publishes the request-owned spec repair inputs through the downstream review transition", () => {
    const value = planGateFixture({ phase: "spec" });
    try {
      repair(value);
      const coordinator = new WorkerArtifactHandoffCoordinator();
      const request = coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: {
          id: "dispatch-spec-plan-repair",
          action: {
            digest: "d".repeat(64),
            nextAction: { step: "spec" },
          },
        },
      });
      assert.deepEqual(
        request.inputs.map((input) => input.targetRelativePath),
        ["draft.json", "spec.json"],
      );
      fs.writeFileSync(request.payloadPath("spec.json"), json({
        ...validWorkerHandoffSpec(),
        goal: "Preserve every affected public behavior after authority repair.",
      }));
      sealWorkerArtifactHandoff({
        requestPath: request.requestPath,
        invocationId: request.dispatchInvocationId,
      });

      const published = coordinator.reconcile({ ctx: value.ctx, request });
      const state = value.flowManager.load();
      assert.equal(published.completed, true);
      assert.equal(state.planGateRepair, undefined);
      assert.equal(findActiveNode(state).stepId, "spec-review");
      assert.equal(state.specArtifactRevision.stepId, "spec");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("restores the exact spec repair input contract from a publication journal", () => {
    const value = planGateFixture({ phase: "spec" });
    try {
      repair(value);
      const requestCoordinator = new WorkerArtifactHandoffCoordinator();
      const request = requestCoordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: {
          id: "dispatch-spec-plan-repair-recovery",
          action: {
            digest: "e".repeat(64),
            nextAction: { step: "spec" },
          },
        },
      });
      fs.writeFileSync(request.payloadPath("spec.json"), json({
        ...validWorkerHandoffSpec(),
        goal: "Recover the complete spec-gate repair contract.",
      }));
      sealWorkerArtifactHandoff({
        requestPath: request.requestPath,
        invocationId: request.dispatchInvocationId,
      });
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

      const recovered = requestCoordinator.recoverPending({ ctx: value.ctx });
      const state = value.flowManager.load();
      assert.equal(recovered.completed, true);
      assert.equal(state.workerArtifactPublication, undefined);
      assert.equal(state.planGateRepair, undefined);
      assert.equal(findActiveNode(state).stepId, "spec-review");
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("invalidates a spec repair handoff when either request-owned input changes", () => {
    const value = planGateFixture({ phase: "spec" });
    try {
      repair(value);
      const coordinator = new WorkerArtifactHandoffCoordinator();
      const request = coordinator.createRequest({
        ctx: value.ctx,
        state: value.flowManager.load(),
        invocation: {
          id: "dispatch-stale-spec-plan-repair",
          action: {
            digest: "f".repeat(64),
            nextAction: { step: "spec" },
          },
        },
      });
      fs.writeFileSync(request.payloadPath("spec.json"), json(validWorkerHandoffSpec()));
      sealWorkerArtifactHandoff({
        requestPath: request.requestPath,
        invocationId: request.dispatchInvocationId,
      });
      fs.writeFileSync(path.join(value.specDir, "spec.json"), json({ changedConcurrently: true }));

      assert.throws(
        () => coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error instanceof WorkerArtifactHandoffError
          && error.classification === "stale"
          && error.code === "FLOW_ARTIFACT_HANDOFF_STALE",
      );
      assert.equal(findActiveNode(value.flowManager.load()).stepId, "spec");
      assert.ok(value.flowManager.load().planGateRepair);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("injects the frozen evidence only into the mapped worker handoff action", () => {
    const value = planGateFixture();
    try {
      repair(value);
      const state = value.flowManager.load();
      const plan = new NextActionPlanner().build({
        root: value.mainRoot,
        mainRoot: value.mainRoot,
        executionRoot: value.executionRoot,
        flowState: state,
        config: {},
        flowCommandBoundary: false,
      });
      assert.equal(plan.result.step, "draft-refine");
      assert.equal(plan.result.context.workerArtifactHandoff.required, true);
      assert.equal(plan.result.context.planGateRepair.phase, "draft");
      assert.equal(
        plan.result.context.planGateRepair.sourceIssueLogId,
        state.planGateRepair.sourceIssueLogId,
      );
      assert.equal(plan.result.context.planGateRepair.observations.length, 1);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("rejects an unchanged repair payload before canonical publication", () => {
    const value = planGateFixture();
    try {
      repair(value);
      const original = fs.readFileSync(path.join(value.specDir, "draft.json"));
      const { coordinator, request } = handoffRequest(value, "dispatch-noop-repair");
      fs.writeFileSync(request.payloadPath("draft.json"), original);
      sealWorkerArtifactHandoff({
        requestPath: request.requestPath,
        invocationId: request.dispatchInvocationId,
      });

      assert.throws(
        () => coordinator.reconcile({ ctx: value.ctx, request }),
        (error) => error.code === "FLOW_PLAN_GATE_REPAIR_NO_PROGRESS",
      );
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(value.specDir, "draft.json"), "utf8")),
        JSON.parse(original.toString("utf8")),
      );
      assert.ok(value.flowManager.load().planGateRepair);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("publishes a changed repair through handoff, consumes the marker, and advances to review", () => {
    const value = planGateFixture();
    try {
      repair(value);
      const { coordinator, request } = handoffRequest(value, "dispatch-changed-repair");
      fs.writeFileSync(request.payloadPath("draft.json"), json({
        goal: "Preserve public behavior.",
        impactOnExisting: [
          "Every affected public surface must map its retained behavior to the new owner.",
        ],
      }));
      sealWorkerArtifactHandoff({
        requestPath: request.requestPath,
        invocationId: request.dispatchInvocationId,
      });

      const published = coordinator.reconcile({ ctx: value.ctx, request });
      const state = value.flowManager.load();
      assert.equal(published.completed, true);
      assert.equal(state.planGateRepair, undefined);
      assert.equal(findActiveNode(state).stepId, "draft-coverage-review");
      assert.match(state.draftArtifactRevision.digest, /^[a-f0-9]{64}$/);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("routes the first draft/spec gate retry to the guarded repair command", () => {
    const attempt = new StepAttempt({
      runId: RUN_ID,
      stepId: "draft-gate",
      attempt: 1,
      outcome: new RetryOutcome({ nextAction: "run-gate-draft" }),
    });
    const directive = new NextActionDirectiveResolver({
      state: { runId: RUN_ID, specId: SPEC_ID, issue: 494 },
      action: "run-gate",
      gatePhase: "draft",
      stepAttempt: attempt,
    }).resolve().toJSON();

    assert.equal(directive.kind, "repair_evidence");
    assert.equal(directive.actionId, "REPAIR_PLAN_GATE_EVIDENCE");
    assert.match(directive.nextAction, /^senrail flow run repair-plan-gate /);
    assert.match(directive.nextAction, /--expect-run-id 'run-plan-gate-repair'/);
  });

  it("does not count any spec directory as dispatcher source progress", () => {
    const value = planGateFixture({ worktree: false });
    try {
      const ctx = {
        root: value.mainRoot,
        executionRoot: value.mainRoot,
        flowState: value.flowManager.load(),
      };
      const before = dispatchRepositoryFingerprint(ctx);
      const otherSpec = path.join(value.mainRoot, "specs", "484-flow-authority-boundaries");
      fs.mkdirSync(otherSpec, { recursive: true });
      fs.writeFileSync(path.join(otherSpec, "draft.json"), json({ wrong: true }));
      assert.equal(dispatchRepositoryFingerprint(ctx), before);

      fs.writeFileSync(path.join(value.mainRoot, "product.js"), "export const changed = true;\n");
      assert.notEqual(dispatchRepositoryFingerprint(ctx), before);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("uses canonical plan evidence, not unrelated worktree or spec mutations, for gate progress", () => {
    const value = planGateFixture({ worktree: false });
    try {
      const state = value.flowManager.load();
      const before = computeGateEvidenceState({
        root: value.mainRoot,
        executionRoot: value.mainRoot,
        flowState: state,
        phase: "draft",
      });
      const otherSpec = path.join(value.mainRoot, "specs", "484-flow-authority-boundaries");
      fs.mkdirSync(otherSpec, { recursive: true });
      fs.writeFileSync(path.join(otherSpec, "draft.json"), json({ wrong: true }));
      assert.deepEqual(computeGateEvidenceState({
        root: value.mainRoot,
        executionRoot: value.mainRoot,
        flowState: state,
        phase: "draft",
      }), before);

      fs.writeFileSync(path.join(value.specDir, "draft.json"), json({ changed: true }));
      assert.notDeepEqual(computeGateEvidenceState({
        root: value.mainRoot,
        executionRoot: value.mainRoot,
        flowState: state,
        phase: "draft",
      }), before);
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });

  it("fingerprints an explicitly selected spec without requiring or borrowing active Flow identity", () => {
    const root = createTmpDir("explicit-spec-gate-evidence-");
    try {
      initGit(root);
      const selectedDir = path.join(root, "specs", "selected");
      const activeDir = path.join(root, "specs", "active");
      fs.mkdirSync(selectedDir, { recursive: true });
      fs.mkdirSync(activeDir, { recursive: true });
      fs.writeFileSync(path.join(selectedDir, "spec.json"), json(validWorkerHandoffSpec()));
      fs.writeFileSync(path.join(activeDir, "spec.json"), json({ active: true }));

      const withoutFlow = computeGateEvidenceState({
        root,
        executionRoot: root,
        flowState: null,
        phase: "spec",
        targetPath: path.join(selectedDir, "spec.json"),
      });
      const activeFlow = { specId: "active", specPath: "specs/active/spec.json" };
      const selectedWithFlow = computeGateEvidenceState({
        root,
        executionRoot: root,
        flowState: activeFlow,
        phase: "spec",
        targetPath: path.join(selectedDir, "spec.json"),
      });
      assert.deepEqual(selectedWithFlow, withoutFlow);

      fs.writeFileSync(path.join(activeDir, "spec.json"), json({ active: "changed" }));
      assert.deepEqual(computeGateEvidenceState({
        root,
        executionRoot: root,
        flowState: activeFlow,
        phase: "spec",
        targetPath: path.join(selectedDir, "spec.json"),
      }), withoutFlow);

      fs.writeFileSync(path.join(selectedDir, "spec.json"), json({
        ...validWorkerHandoffSpec(),
        goal: "Selected evidence changed.",
      }));
      assert.notDeepEqual(computeGateEvidenceState({
        root,
        executionRoot: root,
        flowState: activeFlow,
        phase: "spec",
        targetPath: path.join(selectedDir, "spec.json"),
      }), withoutFlow);
    } finally {
      removeTmpDir(root);
    }
  });

  it("runs an explicit spec gate without an active Flow", async () => {
    const root = createTmpDir("explicit-spec-gate-");
    try {
      initGit(root);
      const specDir = path.join(root, "specs", "standalone");
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "spec.json"), json(validWorkerHandoffSpec()));
      const result = await new RunGateCommand().execute({
        root,
        executionRoot: root,
        flowState: null,
        flowManager: null,
        phase: "spec",
        spec: path.relative(root, specDir),
        config: {},
        skipGuardrail: true,
      });
      assert.ok(new Set(["pass", "fail"]).has(result.result));
      assert.equal(result.artifacts.phase, "spec");
    } finally {
      removeTmpDir(root);
    }
  });

  it("records the effective phase and persists non-deferable semantic gate evidence", () => {
    const value = planGateFixture({ worktree: false });
    try {
      const result = {
        result: "fail",
        artifacts: {
          phase: "draft",
          level: "parent",
          failureKind: "ai_semantic_fail",
          evaluations: [{
            guardrail_id: "migration-parity",
            category: "process",
            result: "fail",
            reason: OBSERVATION.observed,
            observations: [OBSERVATION],
          }],
          nextAction: { diagnosis: { observations: [OBSERVATION] } },
          issues: [],
          reasons: [],
        },
      };
      const ctx = {
        root: value.mainRoot,
        executionRoot: value.mainRoot,
        flowState: value.flowManager.load(),
        flowManager: value.flowManager,
        gitState: { headSha: "a".repeat(40), worktreeHash: "b".repeat(64) },
      };
      updateGateRetryCounter(ctx, result);
      appendIssueLogFromGateResult(ctx, result);

      assert.equal(fs.existsSync(path.join(value.specDir, "draft-gate-source.json")), true);
      const latest = loadIssueLog(value.mainRoot, `specs/${SPEC_ID}/spec.json`).entries.at(-1);
      assert.equal(latest.phase, "draft");
      assert.equal(latest.step, "draft-gate");
      assert.equal(latest.headSha, "a".repeat(40));
    } finally {
      removeTmpDir(value.mainRoot);
    }
  });
});
