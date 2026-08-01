import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertNextActionDirective,
  NextActionDirective,
  NextActionDirectiveResolver,
} from "../../../src/flow/lib/next-action-directive.js";
import {
  MoveToAcceptance,
  ReviewConvergenceState,
  RetryReview,
} from "../../../src/flow/lib/review-convergence.js";
import {
  AwaitingDecisionOutcome,
  ExternalBlockedOutcome,
  StepAttempt,
} from "../../../src/flow/lib/step-outcome.js";
import {
  UserActionChoice,
  UserActionImpact,
  UserActionPrompt,
} from "../../../src/flow/lib/user-action-prompt.js";
import { FlowTargetBinding } from "../../../src/lib/flow-target-guard.js";

function flowState() {
  return {
    runId: "run-473",
    spec: "specs/353-durable-finalize-cleanup/spec.json",
    issue: 473,
  };
}

function binding() {
  return FlowTargetBinding.capture({
    flowState: {
      ...flowState(),
      featureBranch: "feature/353-durable-finalize-cleanup",
      baseBranch: "main",
      worktree: false,
    },
    mode: "branch",
    mainRoot: process.cwd(),
    authorityRoot: process.cwd(),
    invocationRoot: process.cwd(),
  });
}

function convergenceState() {
  return new ReviewConvergenceState({
    phase: "spec",
    taskId: null,
    treeSha: "a".repeat(40),
    semanticAttempts: 0,
    semanticMaxAttempts: 4,
    toolingAttempts: 0,
    toolingMaxAttempts: 1,
    evidence: null,
    finalizedEvidenceAvailable: false,
    handoffFindings: [],
    blocker: null,
    toolingOutcome: null,
  });
}

function blockedAttempt(stepId = "spec-review") {
  return new StepAttempt({
    runId: "run-473",
    stepId,
    attempt: 1,
    outcome: new ExternalBlockedOutcome({
      reason: "schema_failure",
      resumeInstruction: "Recover the failed evidence.",
    }),
  });
}

function decisionPrompt() {
  return new UserActionPrompt({
    question: "Choose a product resolution.",
    choices: [
      new UserActionChoice({
        actionId: "USE_RECORDED_RULE",
        label: "Use the recorded rule",
        nextAction: "senti flow set decision recorded",
        impact: new UserActionImpact({ changes: ["decision record"] }),
      }),
      new UserActionChoice({
        actionId: "REVISE_RECORDED_RULE",
        label: "Revise the recorded rule",
        nextAction: "senti flow set decision revise",
        impact: new UserActionImpact({ changes: ["decision record"] }),
      }),
    ],
    recommendedActionId: "USE_RECORDED_RULE",
    recommendationReason: "The recorded rule matches the accepted requirements.",
  });
}

describe("single next-action directive authority", () => {
  it("routes an ordinary step through execute_step", () => {
    const directive = new NextActionDirectiveResolver({
      state: flowState(),
      action: "run-spec",
    }).resolve();

    assert.deepEqual(directive.toJSON(), {
      kind: "execute_step",
      terminal: false,
      requiresUserAction: false,
      action: "run-spec",
    });
    assert.deepEqual(NextActionDirective.fromStored(directive.toJSON()).toJSON(), directive.toJSON());
  });

  it("turns a tooling review retry into one exact guarded command", () => {
    const operation = new RetryReview({
      state: convergenceState(),
      budgetKind: "tooling",
      requiresChangedEvidence: false,
      blocker: {
        kind: "tooling_retry_required",
        reason: "The review output failed schema validation.",
      },
    });

    const directive = new NextActionDirectiveResolver({
      state: flowState(),
      binding: binding(),
      action: "run-review",
      reviewPhase: "spec",
      stepAttempt: blockedAttempt(),
      reviewOperation: operation,
    }).resolve().toJSON();

    assert.equal(directive.kind, "execute_command");
    assert.equal(directive.actionId, "RETRY_REVIEW");
    assert.match(directive.nextAction, /^senti flow run review --phase spec /);
    assert.match(directive.nextAction, /--expect-binding '[A-Za-z0-9_-]+'/);
    assert.doesNotMatch(directive.nextAction, /--expect-run-id|--expect-issue|--expect-spec/);
  });

  it("routes semantic review remediation through evidence repair without retry reset", () => {
    const operation = new RetryReview({
      state: convergenceState(),
      budgetKind: "semantic",
      requiresChangedEvidence: true,
      blocker: {
        kind: "semantic_remediation_required",
        reason: "The spec does not satisfy a recorded requirement.",
      },
    });

    const directive = new NextActionDirectiveResolver({
      state: flowState(),
      action: "run-review",
      reviewPhase: "spec",
      stepAttempt: blockedAttempt(),
      reviewOperation: operation,
    }).resolve().toJSON();

    assert.equal(directive.kind, "repair_evidence");
    assert.equal(directive.evidenceKind, "review");
    assert.equal(directive.phase, "spec");
    assert.doesNotMatch(directive.nextAction, /retry reset/);
    assert.match(directive.nextAction, /flow get next-action/);
  });

  it("completes a canonical review handoff through one guarded command", () => {
    const state = new ReviewConvergenceState({
      ...convergenceState().toJSON(),
      semanticAttempts: 4,
      evidence: {
        evidenceId: "b".repeat(64),
        disposition: "REJECTED",
      },
      handoffFindings: [{ findingId: "missing-required-test" }],
    });
    const operation = new MoveToAcceptance({
      state,
      handoffFindings: state.handoffFindings,
    });

    const directive = new NextActionDirectiveResolver({
      state: flowState(),
      binding: binding(),
      action: "run-review-test",
      reviewPhase: "test",
      reviewOperation: operation,
    }).resolve().toJSON();

    assert.equal(directive.kind, "execute_command");
    assert.equal(directive.actionId, "COMPLETE_REVIEW_LIFECYCLE");
    assert.match(directive.nextAction, /^senti flow run review --phase test /);
    assert.match(directive.nextAction, /--expect-binding '[A-Za-z0-9_-]+'/);
    assert.doesNotMatch(directive.nextAction, /--expect-run-id|--expect-issue|--expect-spec/);
  });

  it("routes an exhausted gate with unchanged evidence through one repair pass", () => {
    const directive = new NextActionDirectiveResolver({
      state: flowState(),
      binding: binding(),
      action: "run-gate",
      gatePhase: "spec",
      stepAttempt: blockedAttempt("spec-gate"),
      gateRecovery: {
        recoveryPossible: false,
        recoveryReason: "unchanged-evidence",
        reason: "The same gate evidence still fails.",
      },
    }).resolve().toJSON();

    assert.equal(directive.kind, "repair_evidence");
    assert.equal(directive.evidenceKind, "gate");
    assert.equal(directive.phase, "spec");
  });

  it("routes an audited gate reset or journal replay through one command", () => {
    const directive = new NextActionDirectiveResolver({
      state: flowState(),
      binding: binding(),
      action: "run-gate",
      gatePhase: "spec",
      stepAttempt: blockedAttempt("spec-gate"),
      gateRecovery: {
        recoveryPossible: true,
        recoveryReason: "recovery-resume-required",
        recoveryCommand: "senti flow set retry reset gate spec --reason \"repair\" --yes",
      },
    }).resolve().toJSON();

    assert.equal(directive.kind, "execute_command");
    assert.equal(directive.actionId, "RECOVER_GATE_RETRY");
    assert.match(directive.nextAction, /--expect-binding '[A-Za-z0-9_-]+'/);
    assert.doesNotMatch(directive.nextAction, /--expect-run-id|--expect-issue|--expect-spec/);
  });

  it("reports a real blocker without manufacturing an inspection choice", () => {
    const directive = new NextActionDirectiveResolver({
      state: flowState(),
      action: "run-gate",
      gatePhase: "integration",
      stepAttempt: blockedAttempt("impl-gate"),
    }).resolve().toJSON();

    assert.equal(directive.kind, "blocked");
    assert.equal(directive.code, "STEP_EXTERNAL_BLOCKED");
    assert.doesNotMatch(JSON.stringify(directive), /INSPECT|KEEP_FLOW|CONTINUE_NORMAL/);
  });

  it("preserves only materially different user decisions as a prompt", () => {
    const attempt = new StepAttempt({
      runId: "run-473",
      stepId: "approval",
      attempt: 1,
      outcome: new AwaitingDecisionOutcome({
        reason: "product_resolution_required",
        resumeInstruction: "Record the selected resolution.",
        prompt: decisionPrompt(),
      }),
    });
    const directive = new NextActionDirectiveResolver({
      state: flowState(),
      action: "approve-spec",
      stepAttempt: attempt,
    }).resolve().toJSON();

    assert.equal(directive.kind, "await_user_decision");
    assert.equal(directive.actionPrompt.choices.length, 2);
  });

  it("rejects any competing top-level routing authority", () => {
    assert.throws(() => assertNextActionDirective({
      directive: {
        kind: "execute_step",
        terminal: false,
        requiresUserAction: false,
        action: "run-spec",
      },
      continuation: {
        actionId: "INSPECT_FLOW_STATUS",
        nextAction: "senti flow get status",
      },
    }), /NEXT_ACTION_DIRECTIVE_CONFLICT/);
  });
});
