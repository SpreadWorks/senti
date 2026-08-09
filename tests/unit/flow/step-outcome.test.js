import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  AwaitingDecisionOutcome,
  DecisionOutcome,
  DeferOutcome,
  ExternalBlockedOutcome,
  RetryOutcome,
  StepAttempt,
  StepAttemptLog,
  StepOutcome,
  retryResetTimestampForStep,
} from "../../../src/flow/lib/step-outcome.js";
import {
  DependencyRegressionFailure,
  InvalidCommandRegressionFailure,
  PermissionRegressionFailure,
  ResumeRecoveryPolicy,
  SandboxRegressionFailure,
  TimeoutRegressionFailure,
  classifyFinalRegressionFailure,
} from "../../../src/flow/lib/run-final-regression.js";
import {
  resolveReviewRetryMax,
  updateReviewRetryCounter,
} from "../../../src/flow/lib/run-review.js";
import {
  resolveRetryMax,
  updateGateRetryCounter,
} from "../../../src/flow/lib/run-gate.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { Command } from "../../../src/lib/command.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import {
  UserActionChoice,
  UserActionImpact,
  UserActionPrompt,
} from "../../../src/flow/lib/user-action-prompt.js";

function semanticFinding(findingId) {
  return {
    findingId,
    fingerprint: "b".repeat(64),
    result: "fail",
    category: "semantic",
    reason: "A semantic requirement is not satisfied.",
    disposition: "informational",
    rationale: "This semantic finding has no mandatory authority.",
  };
}

function dispositionedSemanticFinding(findingId) {
  return {
    ...semanticFinding(findingId),
    fingerprint: "b".repeat(64),
    disposition: "must-fix",
    rationale: "A mandatory semantic requirement remains unsatisfied.",
  };
}

function retryMetrics(phase, counter, count) {
  return Array.from({ length: count }, () => ({ phase, counter, delta: 1 }));
}

function flowManagerFor(flowState, updates) {
  return {
    appendMetric(metric) {
      flowState.metrics.push(metric);
    },
    mutate(mutator) {
      mutator(flowState);
    },
    updateStepStatus(transition) {
      updates.push({ stepId: transition.stepId, status: transition.requestedStatus });
    },
  };
}

function decisionPrompt() {
  return new UserActionPrompt({
    question: "Choose the recorded resolution.",
    choices: [
      new UserActionChoice({
        actionId: "ACCEPT_RESOLUTION",
        label: "Accept the recorded resolution",
        nextAction: "senrail flow set decision accept",
        impact: new UserActionImpact({ changes: ["decision record"] }),
      }),
      new UserActionChoice({
        actionId: "REJECT_RESOLUTION",
        label: "Reject the recorded resolution",
        nextAction: "senrail flow set decision reject",
        impact: new UserActionImpact({ changes: ["decision record"] }),
      }),
    ],
    recommendedActionId: "ACCEPT_RESOLUTION",
    recommendationReason: "The recorded resolution matches the request.",
  });
}

describe("typed step outcomes", () => {
  it("round-trips the outcome hierarchy through durable StepAttempt records", () => {
    const outcomes = [
      new RetryOutcome({ nextAction: "spec-repair" }),
      new DecisionOutcome({ decision: "PASS", nextAction: "spec-gate" }),
      new DeferOutcome({ nextAction: "refresh-next-action", findingCount: 2 }),
      new ExternalBlockedOutcome({
        reason: "provider_failure",
        resumeInstruction: "Retry after the provider recovers.",
      }),
      new AwaitingDecisionOutcome({
        reason: "risk_acceptance",
        resumeInstruction: "Record the user's acceptance decision.",
        prompt: decisionPrompt(),
      }),
    ];

    for (const [index, outcome] of outcomes.entries()) {
      assert.ok(outcome instanceof StepOutcome);
      const attempt = new StepAttempt({
        runId: "run-419",
        taskId: null,
        stepId: "spec-review",
        attempt: index + 1,
        outcome,
        recordedAt: "2026-07-17T00:00:00.000Z",
      });
      const restored = StepAttempt.fromStored(attempt.toJSON());
      assert.ok(restored.outcome instanceof outcome.constructor);
      assert.deepEqual(restored.toJSON(), attempt.toJSON());
    }
  });

  it("stores exactly one terminal outcome for one step attempt identity", () => {
    const retry = new StepAttempt({
      runId: "run-419",
      taskId: "T1",
      stepId: "task-gate",
      attempt: 3,
      outcome: new RetryOutcome({ nextAction: "task-repair" }),
    });
    const deferred = new StepAttempt({
      runId: "run-419",
      taskId: "T1",
      stepId: "task-gate",
      attempt: 3,
      outcome: new DeferOutcome({ nextAction: "refresh-next-action", findingCount: 1 }),
    });
    const log = new StepAttemptLog([]);

    log.record(retry);
    log.record(deferred);

    assert.equal(log.entries.length, 1);
    assert.ok(log.entries[0].outcome instanceof DeferOutcome);
    assert.ok(log.latestForRun("run-419").outcome instanceof DeferOutcome);
  });

  it("invalidates stopped attempts for every recoverable retry target", () => {
    const resetAt = "2026-07-27T00:00:00.000Z";
    const routes = [
      ["draft-gate", "draft", "gateRetry"],
      ["spec-gate", "spec", "gateRetry"],
      ["task-gate", "task-impl", "gateRetry"],
      ["impl-gate", "integration", "gateRetry"],
      ["draft-questions-review", "draft-questions", "reviewRetry"],
      ["draft-coverage-review", "draft-coverage", "reviewRetry"],
      ["spec-review", "spec", "reviewRetry"],
      ["test-review", "test", "reviewRetry"],
      ["impl-review", "impl", "reviewRetry"],
      ["task-review", "impl", "reviewRetry"],
    ];

    for (const [stepId, phase, counter] of routes) {
      assert.equal(retryResetTimestampForStep({
        metrics: [{ phase, counter, reset: true, ts: resetAt }],
      }, stepId), Date.parse(resetAt), stepId);
    }
  });

  it("persists review and gate deferral on the final command attempt", () => {
    const root = createTmpDir("typed-step-attempt-");
    try {
      const spec = "specs/419-outcome/spec.json";
      const specDir = path.join(root, path.dirname(spec));
      writeJson(root, spec, { requirements: [] });
      writeJson(specDir, "test-review.json", {
        verdict: "REJECTED",
        blockingFindings: [dispositionedSemanticFinding("review-semantic")],
      });

      const reviewState = moveFlowToStep(makeFlowState({
        runId: "run-review-419",
        specId: "419-outcome",
        currentTaskId: null,
        tasks: [],
        metrics: [],
        stepAttempts: [],
      }), "test-review");
      const reviewMax = resolveReviewRetryMax({ flowState: reviewState }, "test");
      reviewState.metrics = retryMetrics("test", "reviewRetry", reviewMax - 1);
      const reviewUpdates = [];
      const reviewResult = {
        result: "ok",
        artifacts: { phase: "test", retryPhase: "test", verdict: "REJECTED" },
        next: null,
      };
      updateReviewRetryCounter({
        root,
        phase: "test",
        flowState: reviewState,
        flowManager: flowManagerFor(reviewState, reviewUpdates),
      }, reviewResult);

      assert.equal(reviewResult.result, "deferred");
      assert.deepEqual(reviewUpdates, [{ stepId: "test-review", status: "done" }]);
      assert.ok(StepAttempt.fromStored(reviewState.stepAttempts[0]).outcome instanceof DeferOutcome);

      const gateState = moveFlowToStep(makeFlowState({
        runId: "run-gate-419",
        specId: "419-outcome",
        currentTaskId: null,
        tasks: [],
        metrics: [],
        stepAttempts: [],
      }), "spec-gate");
      const gateMax = resolveRetryMax({ flowState: gateState, scope: "flow" }, "spec");
      gateState.metrics = retryMetrics("spec", "gateRetry", gateMax - 1);
      const gateUpdates = [];
      const gateResult = {
        result: "fail",
        artifacts: {
          phase: "spec",
          failureKind: "ai_semantic_fail",
          evaluations: [semanticFinding("gate-semantic")],
        },
        next: null,
      };
      updateGateRetryCounter({
        root,
        phase: "spec",
        flowState: gateState,
        flowManager: flowManagerFor(gateState, gateUpdates),
      }, gateResult);

      assert.equal(gateResult.result, "deferred");
      assert.deepEqual(gateUpdates, [{ stepId: "spec-gate", status: "done" }]);
      assert.ok(StepAttempt.fromStored(gateState.stepAttempts[0]).outcome instanceof DeferOutcome);
    } finally {
      removeTmpDir(root);
    }
  });

  it("surfaces only typed stop outcomes as guarded resume instructions", async () => {
    const root = createTmpDir("typed-next-action-");
    try {
      const steps = buildInitialSteps();
      const leaves = flattenSteps(steps);
      const reviewIndex = leaves.findIndex((step) => step.id === "spec-review");
      leaves.forEach((step, index) => {
        step.status = index < reviewIndex ? "done" : "pending";
      });
      findStepById(steps, "spec-review").status = "in_progress";
      const blocked = new StepAttempt({
        runId: "run-next-419",
        stepId: "spec-review",
        attempt: 2,
        outcome: new ExternalBlockedOutcome({
          reason: "provider_failure",
          resumeInstruction: "Retry after the provider recovers.",
        }),
      });
      const flowState = {
        runId: "run-next-419",
        specId: "419-next",
        steps,
        tasks: [],
        currentTaskId: null,
        metrics: [],
        stepAttempts: [blocked.toJSON()],
      };
      writeJson(root, `specs/${flowState.specId}/spec.json`, { requirements: [] });

      const result = await new GetNextActionCommand().execute({
        root,
        flowState,
        flowManager: { mutate() { throw new Error("active target must not be promoted"); } },
      });

      assert.equal(result.stepOutcome.kind, "external-blocked");
      assert.equal(result.lastStepOutcome.kind, "external-blocked");
      assert.equal(result.directive.kind, "blocked");
      assert.equal(result.directive.resumeInstruction, "Retry after the provider recovers.");
    } finally {
      removeTmpDir(root);
    }
  });

  it("does not halt a reactivated step on a stopped outcome from its previous activation", async () => {
    const root = createTmpDir("superseded-stop-next-action-");
    try {
      const steps = buildInitialSteps();
      const leaves = flattenSteps(steps);
      const reviewIndex = leaves.findIndex((step) => step.id === "spec-review");
      leaves.forEach((step, index) => {
        step.status = index < reviewIndex ? "done" : "pending";
      });
      const reviewStep = findStepById(steps, "spec-review");
      reviewStep.status = "in_progress";
      reviewStep.startedAt = "2026-07-24T10:00:00.000Z";
      const blocked = new StepAttempt({
        runId: "run-reactivated-419",
        stepId: "spec-review",
        attempt: 1,
        outcome: new ExternalBlockedOutcome({
          reason: "provider_failure",
          resumeInstruction: "Retry after the provider recovers.",
        }),
        recordedAt: "2026-07-24T09:00:00.000Z",
      });
      const recovery = new StepAttempt({
        runId: "run-reactivated-419",
        stepId: "spec-repair",
        attempt: 1,
        outcome: new DecisionOutcome({
          decision: "PASS",
          nextAction: "spec-review",
        }),
        recordedAt: "2026-07-24T09:59:00.000Z",
      });
      const flowState = {
        runId: "run-reactivated-419",
        specId: "419-reactivated",
        steps,
        tasks: [],
        currentTaskId: null,
        metrics: [],
        stepAttempts: [blocked.toJSON(), recovery.toJSON()],
      };
      writeJson(root, `specs/${flowState.specId}/spec.json`, { requirements: [] });

      const result = await new GetNextActionCommand().execute({
        root,
        flowState,
        flowManager: { mutate() { throw new Error("active target must not be promoted"); } },
      });

      assert.equal(result.halt, undefined);
      assert.equal(result.stepAttempt, undefined);
      assert.equal(result.stepOutcome, undefined);
      assert.equal(result.lastStepOutcome.kind, "decision");
    } finally {
      removeTmpDir(root);
    }
  });
});

describe("typed final-regression recovery policies", () => {
  const cases = [
    {
      name: "dependency",
      input: { result: { stderr: "command not found", exitCode: 127 } },
      Failure: DependencyRegressionFailure,
    },
    {
      name: "permission",
      input: {
        result: {
          kind: "spawn-error",
          started: false,
          exitCode: null,
          errorCode: "EACCES",
          spawnError: "permission denied",
        },
      },
      Failure: PermissionRegressionFailure,
    },
    {
      name: "sandbox",
      input: {
        result: {
          kind: "spawn-error",
          started: false,
          exitCode: null,
          errorCode: null,
          spawnError: "sandbox restriction",
        },
      },
      Failure: SandboxRegressionFailure,
    },
    {
      name: "timeout",
      input: { result: { stderr: "", exitCode: null, timedOut: true } },
      Failure: TimeoutRegressionFailure,
    },
    {
      name: "invalid command",
      input: { discoveryError: new Error("invalid test command") },
      Failure: InvalidCommandRegressionFailure,
    },
  ];

  for (const scenario of cases) {
    it(`classifies ${scenario.name} with an explicit resume policy`, () => {
      const failure = classifyFinalRegressionFailure(scenario.input);
      assert.ok(failure instanceof scenario.Failure);
      assert.ok(failure.recoveryPolicy instanceof ResumeRecoveryPolicy);
      assert.match(failure.recoveryPolicy.resumeInstruction, /retry|configure|permission|sandbox|dependency|timeout/i);
    });
  }
});

describe("typed dispatcher settlement", () => {
  it("turns an external-blocked post-hook outcome into a resume-required envelope", async () => {
    class TypedBlockCommand extends Command {
      static outputMode = "envelope";

      execute() {
        return { result: "blocked", artifacts: {} };
      }
    }

    let stdout = "";
    let exitCode = 0;
    await dispatch({
      container: { has: () => false, get: () => null },
      entry: {
        args: {},
        requiresFlow: false,
        command: async () => ({ default: TypedBlockCommand }),
        async post(_ctx, result) {
          const attempt = new StepAttempt({
            runId: "run-dispatch-419",
            stepId: "spec-review",
            attempt: 1,
            outcome: new ExternalBlockedOutcome({
              reason: "provider_failure",
              resumeInstruction: "Retry after the provider recovers.",
            }),
          });
          result.stepAttempt = attempt.toJSON();
        },
      },
      argv: [],
      envelopeType: "run",
      envelopeKey: "review",
      stdout: (text) => { stdout += text; },
      stderr: () => {},
      setExitCode: (code) => { exitCode = code; },
    });

    const envelope = JSON.parse(stdout);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.errors[0].code, "STEP_EXTERNAL_BLOCKED");
    assert.equal(envelope.data.stepAttempt.outcome.kind, "external-blocked");
    assert.equal(Object.hasOwn(envelope.data, "continuation"), false);
    assert.equal(Object.hasOwn(envelope.data, "actionPrompt"), false);
    assert.equal(exitCode, 1);
  });
});

describe("flow skill liveness contract", () => {
  it("delegates non-terminal ownership to the guarded CLI dispatcher", () => {
    const skill = fs.readFileSync("src/skills/senrail.flow/SKILL.md", "utf8");
    const dispatcher = fs.readFileSync("src/flow/lib/run-dispatch.js", "utf8");
    assert.doesNotMatch(skill, /When that limit is reached, STOP/);
    assert.doesNotMatch(skill, /On budget exhaustion, STOP/);
    assert.match(skill, /senrail flow run dispatch --expect-binding <token>/);
    assert.match(skill, /only owner of\s+`execute_step`, `execute_command`, and `repair_evidence`/);
    assert.match(dispatcher, /await agent\.call/);
    assert.match(dispatcher, /await this\.fetchNextAction/);
    assert.match(skill, /without exposing raw action IDs/i);
  });

  it("forbids ending a turn at an ordinary intermediate step", () => {
    const skill = fs.readFileSync("src/skills/senrail.flow/SKILL.md", "utf8");
    assert.match(skill, /A worker's text response is diagnostic only/);
    assert.match(skill, /never accepts that text\s+as step completion/);
    assert.match(skill, /Do not ask the user to invoke `\$senrail\.flow`\s+again/);
    assert.match(skill, /The loop exits only at a dispatcher boundary/);
  });

  it("repairs recoverable evidence only through the single directive", () => {
    const dispatcher = fs.readFileSync("src/flow/lib/run-dispatch.js", "utf8");
    assert.match(dispatcher, /RepairEvidenceDirective/);
    assert.match(dispatcher, /action\.isContinuation/);
    assert.match(dispatcher, /independently verifies the refreshed Flow and repository state/);
  });

  it("forbids reconstructing authority from subsystem diagnostics", () => {
    const dispatcher = fs.readFileSync("src/flow/lib/run-dispatch.js", "utf8");
    assert.match(dispatcher, /NextActionDirective\.fromStored/);
    assert.doesNotMatch(dispatcher, /reviewAction|retryRecovery|gateStop/);
  });

  it("prioritizes an agent-owned nonblocking decision over the strict directive", () => {
    const dispatcher = fs.readFileSync("src/flow/lib/run-dispatch.js", "utf8");
    const nonblockingSkill = fs.readFileSync("src/skills/senrail.flow-nonblocking/SKILL.md", "utf8");
    assert.match(dispatcher, /A nonblockingDecision is present/);
    assert.match(dispatcher, /before the ordinary directive/);
    assert.match(nonblockingSkill, /If `nonblockingDecision` is absent, run the returned normal check action/);
    assert.match(nonblockingSkill, /at most one agent-recoverable guarded recovery\/re-run/);
  });
});
