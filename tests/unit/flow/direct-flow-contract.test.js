import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DirectAbortReceipt,
  DirectCompletionReceipt,
  DirectGitEvidence,
  DirectSkippedStep,
} from "../../../src/flow/lib/direct-completion.js";
import { DirectFinalizeAdapter } from "../../../src/flow/lib/direct-finalize-adapter.js";
import {
  activeDirectPrompt,
  eligibility,
  getDirectFlowAction,
  runDirectFlowAction,
} from "../../../src/flow/lib/direct-flow-controller.js";
import {
  DirectFlowSession,
  DirectFlowTarget,
  DirectVerificationCheck,
  DirectVerificationResult,
} from "../../../src/flow/lib/direct-flow-session.js";
import { FlowCompletion } from "../../../src/flow/lib/flow-completion.js";
import {
  DirectResolutionFinding,
  DirectResolutionPlan,
} from "../../../src/flow/lib/direct-resolution-plan.js";
import {
  AwaitingDecisionOutcome,
  ExternalBlockedOutcome,
  StepOutcome,
} from "../../../src/flow/lib/step-outcome.js";
import {
  attachFlowContinuation,
  genericFlowStopContinuation,
  UserActionChoice,
  UserActionImpact,
  UserActionPrompt,
} from "../../../src/flow/lib/user-action-prompt.js";
import { Envelope } from "../../../src/lib/flow-envelope.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";

const NOW = "2026-07-26T00:00:00.000Z";
const FEATURE_HEAD = "a".repeat(40);
const MAIN_HEAD = "b".repeat(40);
const FLOW_REVISION = "c".repeat(64);

function target() {
  return new DirectFlowTarget({
    runId: "run-direct-476",
    issue: 476,
    spec: "specs/476-direct/spec.json",
    worktreePath: "/tmp/senti-direct-476",
    bindingRevision: "binding-r1",
    featureBranch: "enhance/476-direct",
    baseBranch: "main",
    featureHead: FEATURE_HEAD,
    flowStateRevision: FLOW_REVISION,
    activeRegistryRevision: "registry-r1",
  });
}

function selectedSession() {
  return new DirectFlowSession({
    phase: "DIRECT_SELECTED",
    target: target(),
    sourceStep: "impl-gate",
    transitionReason: "User selected the bounded direct fix.",
    selectionSource: "manual",
    adoptedActionId: "SELECT_DIRECT_FIX",
    requestedScopePaths: ["src/flow"],
    selectedAt: NOW,
  });
}

function plan(findings = []) {
  return new DirectResolutionPlan({
    target: target(),
    sourceStep: "impl-gate",
    transitionReason: "User selected the bounded direct fix.",
    transitionAt: NOW,
    skippedSteps: ["impl-gate", "retro", "report"],
    validationItems: ["target identity", "deterministic tests"],
    findings,
    routingFailure: "retry budget exhausted",
    originFlowStateRevision: FLOW_REVISION,
    selectionSource: "manual",
    adoptedActionId: "SELECT_DIRECT_FIX",
    scopePaths: ["src/flow"],
  });
}

function verification({
  status = "passed",
  testStatus = "passed",
  checks = [
    new DirectVerificationCheck({
      id: "target-identity",
      passed: true,
      detail: "The direct target is unchanged.",
    }),
    new DirectVerificationCheck({
      id: "deterministic-tests",
      passed: true,
      detail: "The deterministic test passed.",
      overrideable: true,
    }),
  ],
} = {}) {
  return new DirectVerificationResult({
    status,
    testStatus,
    testCommand: "node --test",
    checks,
    changedPaths: ["src/flow/direct.js"],
    verifiedAt: NOW,
  });
}

function directSessionWithVerification(result = verification()) {
  const directPlan = plan();
  return selectedSession()
    .withPlan(directPlan)
    .transition("DIRECT_HANDOFF_PREFLIGHT")
    .transition("DIRECT_FIX")
    .transition("DIRECT_VERIFY")
    .withVerification(result);
}

function completionReceipt(status = "completed") {
  return new DirectCompletionReceipt({
    status,
    runId: "run-direct-476",
    issue: 476,
    spec: "specs/476-direct/spec.json",
    planId: plan().planId,
    planRevision: 1,
    mergeDisposition: "merged",
    sourceStep: "impl-gate",
    gitEvidence: new DirectGitEvidence({
      kind: "integration-receipt",
      featureHead: FEATURE_HEAD,
      mainHead: MAIN_HEAD,
      receiptKey: "direct-integration-fixture",
      receiptCommit: MAIN_HEAD,
      observedAt: NOW,
    }),
    skippedSteps: [
      new DirectSkippedStep({
        stepId: "impl-gate",
        reason: "Direct completion did not credit this normal step.",
      }),
    ],
    minimalValidation: verification(),
    preparedAt: NOW,
    ...(status === "completed" ? { completedAt: NOW } : {}),
  });
}

describe("typed user-action stop contract", () => {
  it("requires stable action IDs, executable choices, and an explicit recommendation", () => {
    assert.throws(() => new UserActionChoice({
      actionId: "retry",
      label: "Retry",
      impact: new UserActionImpact({ retains: ["Flow state"] }),
    }), /stable uppercase action token/);
    assert.throws(() => new UserActionChoice({
      actionId: "RETRY_FLOW",
      label: "Retry",
      impact: new UserActionImpact({ retains: ["Flow state"] }),
    }), /executable nextAction or stateTransition/);
    assert.throws(() => new UserActionPrompt({
      question: "Continue?",
      choices: [new UserActionChoice({
        actionId: "INSPECT_FLOW",
        label: "Inspect",
        nextAction: "senti flow get status",
        impact: new UserActionImpact({ retains: ["Flow state"] }),
      })],
      recommendedActionId: "MISSING_ACTION",
      recommendationReason: "Inspect first.",
    }), /must reference an existing choice/);
  });

  it("preserves StepOutcome terminal semantics while yielding a typed prompt", () => {
    const outcomes = [
      new ExternalBlockedOutcome({
        reason: "provider unavailable",
        resumeInstruction: "Retry after provider recovery.",
      }),
      new AwaitingDecisionOutcome({
        reason: "risk decision",
        resumeInstruction: "Record the explicit decision.",
      }),
    ];

    for (const outcome of outcomes) {
      const json = outcome.toJSON();
      assert.equal(outcome.terminal, true);
      assert.equal(json.terminal, true);
      assert.equal(json.yieldsControl, true);
      assert.equal(json.requiresUserAction, true);
      assert.ok(UserActionPrompt.fromStored(json.actionPrompt));
      assert.deepEqual(StepOutcome.fromStored(json).toJSON(), json);
    }
  });

  it("rejects incomplete envelopes that do not carry a valid prompt", () => {
    const missing = Envelope.fail("run", "direct", "STOPPED", "Stopped.", {
      yieldsControl: true,
      requiresUserAction: true,
    });
    const invalid = Envelope.fail("run", "direct", "STOPPED", "Stopped.", {
      yieldsControl: true,
      requiresUserAction: false,
      actionPrompt: {},
    });

    assert.throws(() => missing.toJSON(), /prompt\.question|stored|destructur/i);
    assert.throws(() => invalid.toJSON(), /requires requiresUserAction/);
  });

  it("represents lock inspection as a mechanical continuation", () => {
    const envelope = Envelope.fail(
      "get",
      "status",
      "PROCESS_OWNED_LOCK_LIVE",
      "lock owner is active",
    );
    attachFlowContinuation(envelope, genericFlowStopContinuation({
      state: {
        runId: "run-lock",
        issue: null,
        spec: "specs/001-lock/spec.json",
      },
      code: "PROCESS_OWNED_LOCK_LIVE",
      message: "lock owner is active",
    }));

    const json = envelope.toJSON();
    assert.equal(json.data.yieldsControl, false);
    assert.equal(json.data.requiresUserAction, false);
    assert.equal(json.data.continuation.actionId, "INSPECT_FLOW_STATUS");
    assert.match(json.data.continuation.nextAction, /--expect-run-id 'run-lock'/);
    assert.equal(Object.hasOwn(json.data, "actionPrompt"), false);
  });
});

describe("direct session and plan authority", () => {
  it("reports no Flow without fabricating state or a transition", () => {
    assert.deepEqual(getDirectFlowAction({ flowState: null }), {
      code: "NO_FLOW",
      directMode: false,
      normalDirectFix: true,
      message: "No Flow exists. This is an ordinary direct fix; no Flow or Git state was changed.",
      yieldsControl: false,
    });
  });

  it("allows only declared phase transitions and resumes the exact suspended phase", () => {
    const directPlan = plan();
    const fixing = selectedSession()
      .withPlan(directPlan)
      .transition("DIRECT_HANDOFF_PREFLIGHT")
      .transition("DIRECT_FIX");
    const suspended = fixing.transition("SUSPENDED");
    const resumed = suspended.transition(suspended.suspendedFrom);

    assert.equal(suspended.suspendedFrom, "DIRECT_FIX");
    assert.equal(resumed.phase, "DIRECT_FIX");
    assert.equal(resumed.suspendedFrom, null);
    assert.throws(() => resumed.transition("COMPLETED_DIRECT"), /invalid direct session transition/);
  });

  it("generates a stable plan ID and CAS-revises only explicit finding decisions", () => {
    const unresolved = new DirectResolutionFinding({
      findingId: "acceptance:user-decision",
      source: "acceptance-review.json",
      classification: "USER_DECISION_REQUIRED",
      summary: "A product decision remains open.",
      recommendedResolution: "Keep the safer behavior.",
      changeTargets: ["src/flow"],
      rationale: "The acceptance artifact delegates this decision to the user.",
    });
    const initial = plan([unresolved]);
    const restored = DirectResolutionPlan.fromStored(initial.toJSON());
    const revised = restored.withFindingResolution(
      "acceptance:user-decision",
      "Keep the safer behavior.",
    );

    assert.equal(restored.planId, initial.planId);
    assert.equal(revised.planId, initial.planId);
    assert.equal(revised.revision, initial.revision + 1);
    assert.equal(initial.unresolvedDecisions.length, 1);
    assert.equal(revised.unresolvedDecisions.length, 0);
    assert.throws(() => new DirectResolutionPlan({
      ...initial.toJSON(),
      originFlowStateRevision: "d".repeat(64),
    }), /does not match its target guard/);
  });

  it("does not treat pre-implementation, branch, local, or parked state as eligible", () => {
    const steps = buildInitialSteps();
    const state = {
      runId: "run-direct-476",
      spec: "specs/476-direct/spec.json",
      baseBranch: "main",
      featureBranch: "enhance/476-direct",
      worktree: true,
      steps,
    };
    assert.equal(eligibility({}, state).supported, false);

    findStepById(steps, "approval").status = "done";
    findStepById(steps, "implement").status = "in_progress";
    assert.equal(eligibility({}, { ...state, worktree: false }).supported, false);
  });

  it("returns to the normal Flow without asking when direct mode is unsupported", async () => {
    const state = {
      runId: "run-direct-476",
      issue: 476,
      spec: "specs/476-direct/spec.json",
      baseBranch: "main",
      featureBranch: "feature/476-direct",
      worktree: false,
      steps: buildInitialSteps(),
    };
    findStepById(state.steps, "approval").status = "done";
    findStepById(state.steps, "implement").status = "in_progress";
    const before = structuredClone(state);
    const result = await runDirectFlowAction({
      root: "/tmp",
      mainRoot: "/tmp",
      flowState: state,
      state,
      flowManager: {},
    }, {
      action: "SELECT_DIRECT_FIX",
      reason: "This branch mode action must remain unsupported.",
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "DIRECT_MODE_UNSUPPORTED");
    assert.equal(result.data.yieldsControl, false);
    assert.equal(result.data.requiresUserAction, false);
    assert.equal(result.data.continuation.actionId, "CONTINUE_NORMAL_FLOW");
    assert.match(result.data.continuation.nextAction, /flow get next-action/);
    assert.equal(Object.hasOwn(result.data, "actionPrompt"), false);
    assert.deepEqual(state, before);
  });

  it("never offers risk acceptance when a non-overrideable check failed", () => {
    const failed = verification({
      status: "failed",
      checks: [
        new DirectVerificationCheck({
          id: "target-identity",
          passed: false,
          detail: "The target changed.",
          overrideable: false,
        }),
        new DirectVerificationCheck({
          id: "deterministic-tests",
          passed: false,
          detail: "Tests failed.",
          overrideable: true,
        }),
      ],
    });
    const session = directSessionWithVerification(failed);
    const state = {
      runId: "run-direct-476",
      issue: 476,
      spec: "specs/476-direct/spec.json",
      directFlowSession: session.toJSON(),
      directResolutionPlan: plan().toJSON(),
    };

    const result = activeDirectPrompt({}, state);
    assert.equal(result.yieldsControl, true);
    assert.equal(
      result.actionPrompt.choices.some((entry) => entry.actionId === "ACCEPT_DIRECT_RISK"),
      false,
    );
  });
});

describe("shared completion read model", () => {
  it("distinguishes normal, direct, prepared, and aborted terminal states", () => {
    const steps = buildInitialSteps();
    for (const step of flattenSteps(steps)) step.status = "done";
    const normal = new FlowCompletion({ steps, state: { mergeStrategy: "squash" } });
    assert.deepEqual(normal.toJSON(), {
      terminal: true,
      success: true,
      completionMode: "normal",
      mergeDisposition: "squash",
    });

    const preparedReceipt = completionReceipt("prepared");
    const preparedSession = directSessionWithVerification().transition("MERGE_ONLY_FINALIZE");
    const prepared = new FlowCompletion({
      steps: buildInitialSteps(),
      directFlowSession: new DirectFlowSession({
        ...preparedSession.toJSON(),
        completion: {
          success: null,
          completionMode: "direct",
          mergeDisposition: "merged",
          receiptId: preparedReceipt.receiptId,
          status: "prepared",
        },
      }).toJSON(),
      directCompletionReceipt: preparedReceipt.toJSON(),
    });
    assert.equal(prepared.terminal, false);
    assert.equal(prepared.completionMode, "direct");
    const completedNormalStepsDuringDirect = buildInitialSteps();
    for (const step of flattenSteps(completedNormalStepsDuringDirect)) step.status = "done";
    const directAuthorityWins = new FlowCompletion({
      steps: completedNormalStepsDuringDirect,
      directFlowSession: preparedSession.toJSON(),
      directCompletionReceipt: preparedReceipt.toJSON(),
    });
    assert.equal(directAuthorityWins.terminal, false);
    assert.equal(directAuthorityWins.completionMode, "direct");

    const completedReceipt = completionReceipt();
    const completedSession = preparedSession.transition("COMPLETED_DIRECT", {
      completion: {
        success: true,
        completionMode: "direct",
        mergeDisposition: "merged",
        receiptId: completedReceipt.receiptId,
        completedAt: NOW,
      },
    });
    const direct = new FlowCompletion({
      steps: buildInitialSteps(),
      directFlowSession: completedSession.toJSON(),
      directCompletionReceipt: completedReceipt.toJSON(),
    });
    assert.equal(direct.terminal, true);
    assert.equal(direct.success, true);
    assert.equal(direct.completionMode, "direct");

    const directPlan = plan();
    const abortReceipt = new DirectAbortReceipt({
      runId: "run-direct-476",
      issue: 476,
      spec: "specs/476-direct/spec.json",
      planId: directPlan.planId,
      planRevision: directPlan.revision,
      reason: "The user chose to retain the incomplete implementation.",
      recordedAt: NOW,
    });
    const abortedSession = selectedSession()
      .withPlan(directPlan)
      .transition("DIRECT_HANDOFF_PREFLIGHT")
      .transition("DIRECT_FIX")
      .transition("ABORTED");
    const aborted = new FlowCompletion({
      steps: buildInitialSteps(),
      directFlowSession: abortedSession.toJSON(),
      directAbortReceipt: abortReceipt.toJSON(),
    });
    assert.equal(aborted.terminal, true);
    assert.equal(aborted.success, false);
    assert.equal(aborted.completionMode, "aborted");
  });

  it("requires the corresponding durable receipt for direct terminal phases", () => {
    const directPlan = plan();
    const abortedSession = selectedSession()
      .withPlan(directPlan)
      .transition("DIRECT_HANDOFF_PREFLIGHT")
      .transition("DIRECT_FIX")
      .transition("ABORTED");

    assert.throws(() => new FlowCompletion({
      steps: buildInitialSteps(),
      directFlowSession: abortedSession.toJSON(),
    }), /requires a direct abort receipt/);
  });

  it("reuses an already-published direct tombstone after a completion crash boundary", () => {
    const directPlan = plan();
    const receipt = completionReceipt("prepared");
    const mergeSession = directSessionWithVerification().transition("MERGE_ONLY_FINALIZE");
    const state = {
      directFlowSession: new DirectFlowSession({
        ...mergeSession.toJSON(),
        revision: mergeSession.revision + 1,
        completion: {
          status: "prepared",
          success: null,
          completionMode: "direct",
          mergeDisposition: receipt.mergeDisposition,
          receiptId: receipt.receiptId,
        },
      }).toJSON(),
      directCompletionReceipt: receipt.toJSON(),
    };
    let mutationCount = 0;
    const flowManager = {
      load: () => state,
      mutate: (mutator) => {
        mutationCount += 1;
        mutator(state);
      },
    };
    const adapter = new DirectFinalizeAdapter({
      plan: directPlan,
      completionReceipt: receipt,
    });

    const first = adapter.complete(flowManager, "476-direct", "operation-owner");
    const second = adapter.complete(flowManager, "476-direct", "operation-owner");

    assert.equal(first.status, "completed");
    assert.equal(second.receiptId, first.receiptId);
    assert.equal(mutationCount, 1);
    assert.equal(state.directFlowSession.phase, "COMPLETED_DIRECT");
    assert.equal(state.directCompletionReceipt.status, "completed");
  });
});
