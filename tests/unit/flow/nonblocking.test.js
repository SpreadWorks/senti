import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  NonBlockingDecisionContext,
  NonBlockingDecisionIdentity,
  NonBlockingPolicy,
  advisorySummary,
  activateNonBlockingPolicy,
  decisionContextForActiveFlow,
  nonblockingActivationOfferForStrictStop,
  recordNonBlockingDecision,
  recordEligibleNonblockingAttempt,
} from "../../../src/flow/lib/nonblocking.js";
import {
  ExternalBlockedOutcome,
  NonBlockingDecisionOutcome,
  ObservedNonPassOutcome,
  StepAttempt,
  StepAttemptLog,
} from "../../../src/flow/lib/step-outcome.js";
import SetPolicyCommand from "../../../src/flow/lib/set-policy.js";
import SetNonBlockingDecisionCommand from "../../../src/flow/lib/set-nonblocking-decision.js";
import GetNextActionCommand, { NextActionPlanner } from "../../../src/flow/lib/get-next-action.js";
import { makeDefaultTask, makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { FlowCompletion } from "../../../src/flow/lib/flow-completion.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { resolveLifecyclePlan } from "../../../src/flow/definition.js";
import {
  fromAcceptanceResult,
  fromFinalRegressionResult,
  fromGateResult,
  fromReviewResult,
} from "../../../src/flow/lib/nonblocking-evidence.js";
import { readFlowFindingsArtifact } from "../../../src/flow/lib/flow-findings.js";
import { FlowTargetBinding } from "../../../src/lib/flow-target-guard.js";

const DIGEST = "a".repeat(64);

describe("nonblocking flow policy", () => {
  it("is one-way and retains the activation audit data", () => {
    const policy = new NonBlockingPolicy({
      activatedAt: "2026-07-27T00:00:00.000Z",
      activatedStep: "impl-review",
      reason: "The same review evidence did not converge after normal repair.",
    });
    assert.deepEqual(NonBlockingPolicy.fromStored(policy.toJSON()).toJSON(), policy.toJSON());
    assert.throws(() => new NonBlockingPolicy({ enabled: false, activatedStep: "impl-review", reason: "invalid" }));
  });

  it("keeps advisory decisions bound to immutable evidence identity", () => {
    const context = new NonBlockingDecisionContext({
      sourceStep: "impl-gate",
      sourceAttempt: 2,
      evidenceRef: "specs/477/impl-gate-result.json",
      evidenceDigest: DIGEST,
      resultKind: "quality",
      allowedActions: ["repair", "continue"],
    });
    const outcome = new NonBlockingDecisionOutcome({
      action: "continue",
      ...context.toJSON(),
      rationale: "The implementation requirements are met despite this gate finding.",
      remainingRisk: "The gate finding remains visible in the completion report.",
      nextAction: "run-retro",
    });
    const log = new StepAttemptLog([new StepAttempt({
      runId: "run-477", taskId: null, stepId: "impl-gate", attempt: 2, outcome,
    })]);
    assert.deepEqual(advisorySummary({ stepAttempts: log.toJSON() }), [{
      stepId: "impl-gate",
      evidenceRef: "specs/477/impl-gate-result.json",
      rationale: outcome.rationale,
      remainingRisk: outcome.remainingRisk,
    }]);
  });

  it("rejects unsupported nonblocking sources and oversized durable text", () => {
    const base = {
      action: "continue",
      sourceAttempt: 1,
      evidenceRef: "specs/477/impl-review.json",
      evidenceDigest: DIGEST,
      rationale: "The requested behavior is complete.",
      remainingRisk: "The rejected review remains documented.",
      nextAction: "run-impl-gate",
    };
    assert.throws(() => new NonBlockingDecisionOutcome({
      ...base,
      sourceStep: "outside-supported-steps",
    }), /eligible nonblocking step/);
    assert.throws(() => new NonBlockingDecisionOutcome({
      ...base,
      sourceStep: "impl-review",
      rationale: "x".repeat(2_001),
    }), /no longer than 2000 characters/);
  });

  it("requires durable non-pass evidence", () => {
    const root = createTmpDir("nonblocking-durable-evidence-");
    try {
      const spec = "specs/477-durable-evidence/spec.json";
      writeJson(root, spec, { requirements: [] });
      fs.writeFileSync(path.join(root, "specs/477-durable-evidence/impl-review.json"), '{"verdict":"REJECTED"}\n');
      const state = moveFlowToStep(makeFlowState({ specId: path.basename(path.dirname(spec)) }), "impl-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      const enabled = activateNonBlockingPolicy({
        root, flowManager: manager,
        reason: "Normal review recovery has already been exhausted for this work.",
      });
      assert.equal(enabled.enabled, true);
      assert.equal(state.nonblocking.activatedStep, "impl-review");
    } finally {
      removeTmpDir(root);
    }
  });

  it("continues a rejected test review only through a durable acceptance handoff", () => {
    const root = createTmpDir("nonblocking-test-review-");
    try {
      const spec = "specs/477-test-review/spec.json";
      writeJson(root, spec, { requirements: [] });
      const evidence = JSON.stringify({
        verdict: "REJECTED",
        blockingFindings: [{
          findingId: "test-semantic",
          fingerprint: DIGEST,
          disposition: "must-fix",
          rationale: "The test design omits a required acceptance behavior.",
          category: "semantic",
          title: "Missing acceptance behavior test",
        }],
      }, null, 2) + "\n";
      fs.writeFileSync(path.join(root, "specs/477-test-review/test-review.json"), evidence);
      const state = moveFlowToStep(makeFlowState({ specId: path.basename(path.dirname(spec)), stepAttempts: [] }), "test-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      const policy = activateNonBlockingPolicy({
        root,
        flowManager: manager,
        reason: "The strict test-review cycle reached a bounded continuation decision.",
      });
      assert.equal(policy.activatedStep, "test-review");
      const observed = recordEligibleNonblockingAttempt(
        { root, flowState: state, flowManager: manager },
        "test-review",
        null,
        { hydrate: true },
      );
      assert.ok(observed);
      const digest = crypto.createHash("sha256").update(evidence).digest("hex");
      const continued = recordNonBlockingDecision({
        root,
        flowManager: manager,
        choice: "continue",
        reason: "Implementation can proceed while acceptance keeps the test-design finding open.",
        remainingRisk: "Acceptance review must disposition the deferred test-review finding.",
        expectEvidenceDigest: digest,
      });
      assert.equal(continued.sourceStep, "test-review");
      assert.equal(findStepById(state.steps, "test-review").status, "done");
      assert.equal(findStepById(state.steps, "implement").status, "in_progress");
      const findings = readFlowFindingsArtifact(path.join(root, "specs/477-test-review")).toJSON().entries;
      assert.deepEqual(findings.map((finding) => ({
        sourceStep: finding.sourceStep,
        sourceArtifact: finding.sourceArtifact,
        sourceFindingId: finding.sourceFindingId,
        finalDisposition: finding.finalDisposition,
      })), [{
        sourceStep: "test-review",
        sourceArtifact: "test-review.json",
        sourceFindingId: "test-semantic",
        finalDisposition: "still_open",
      }]);
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(root, "specs/477-test-review/test-review.json"), "utf8"))
          .blockingFindings[0].disposition,
        "must-fix",
      );
      assert.deepEqual(recordNonBlockingDecision({
        root,
        flowManager: manager,
        choice: "continue",
        reason: "Implementation can proceed while acceptance keeps the test-design finding open.",
        remainingRisk: "Acceptance review must disposition the deferred test-review finding.",
        expectEvidenceDigest: digest,
      }), continued);
    } finally {
      removeTmpDir(root);
    }
  });

  it("hands a tooling test-review stop to acceptance without inventing a semantic finding", () => {
    const root = createTmpDir("nonblocking-test-review-ineligible-");
    try {
      const spec = "specs/477-test-review-ineligible/spec.json";
      writeJson(root, spec, { requirements: [] });
      fs.writeFileSync(path.join(root, "specs/477-test-review-ineligible/test-review.json"), JSON.stringify({
        toolingOutcome: { reason: "review provider unavailable" },
        blockingFindings: [],
      }, null, 2) + "\n");
      const state = moveFlowToStep(makeFlowState({ specId: path.basename(path.dirname(spec)) }), "test-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      activateNonBlockingPolicy({
        root,
        flowManager: manager,
        reason: "The provider failure must remain an explicit acceptance risk.",
      });
      const source = fs.readFileSync(path.join(root, "specs/477-test-review-ineligible/test-review.json"), "utf8");
      recordNonBlockingDecision({
        root,
        flowManager: manager,
        choice: "continue",
        reason: "The provider failure is documented for acceptance review.",
        remainingRisk: "The static test review was unavailable.",
        expectEvidenceDigest: crypto.createHash("sha256").update(source).digest("hex"),
      });
      const findings = readFlowFindingsArtifact(path.join(root, "specs/477-test-review-ineligible")).toJSON().entries;
      assert.equal(findings[0].sourceArtifact, "nonblocking-handoffs.json");
      assert.equal(findings[0].sourceStep, "test-review");
      const handoff = JSON.parse(fs.readFileSync(
        path.join(root, "specs/477-test-review-ineligible/nonblocking-handoffs.json"),
        "utf8",
      ));
      assert.deepEqual(handoff.findings.map((finding) => ({
        sourceStep: finding.sourceStep,
        sourceArtifact: finding.sourceArtifact,
        evidenceDigest: finding.evidenceDigest,
        resultKind: finding.resultKind,
      })), [{
        sourceStep: "test-review",
        sourceArtifact: "test-review.json",
        evidenceDigest: crypto.createHash("sha256").update(source).digest("hex"),
        resultKind: "tooling",
      }]);
    } finally {
      removeTmpDir(root);
    }
  });

  it("does not activate test-review advisory handling from non-rejected evidence", () => {
    const root = createTmpDir("nonblocking-test-review-pass-");
    try {
      const spec = "specs/477-test-review-pass/spec.json";
      writeJson(root, spec, { requirements: [] });
      fs.writeFileSync(path.join(root, "specs/477-test-review-pass/test-review.json"), JSON.stringify({
        verdict: "PASS",
        blockingFindings: [{
          findingId: "inconsistent-pass",
          fingerprint: DIGEST,
          disposition: "must-fix",
          rationale: "An inconsistent artifact must not create an advisory route.",
          category: "semantic",
          title: "Inconsistent test-review artifact",
        }],
      }, null, 2) + "\n");
      const state = moveFlowToStep(makeFlowState({ specId: path.basename(path.dirname(spec)) }), "test-review");
      assert.throws(() => activateNonBlockingPolicy({
        root,
        flowManager: { load: () => state, mutate: (fn) => fn(state) },
        reason: "Only a rejected review may become a deferred acceptance finding.",
      }), /eligible non-pass evidence/);
    } finally {
      removeTmpDir(root);
    }
  });

  it("keeps a nonblocking rejected test review active until its decision writes the handoff", () => {
    const state = moveFlowToStep(makeFlowState({
      nonblocking: {
        enabled: true,
        activatedAt: "2026-07-27T00:00:00.000Z",
        activatedStep: "test-review",
        reason: "The review exhausted its strict recovery.",
      },
    }), "test-review");
    const plan = resolveLifecyclePlan({
      event: "review:post",
      command: "run-review",
      phase: "test",
      currentStepId: "test-review",
      flowState: state,
      result: { artifacts: { phase: "test", verdict: "REJECTED" } },
    });
    assert.deepEqual(plan.actions, []);
  });

  it("treats an already enabled policy as a no-write idempotent operation", () => {
    const state = moveFlowToStep(makeFlowState({
      nonblocking: {
        enabled: true,
        activatedAt: "2026-07-27T00:00:00.000Z",
        activatedStep: "impl-review",
        reason: "The review had already exhausted strict recovery.",
      },
    }), "retro");
    const manager = {
      load: () => state,
      mutate: () => { throw new Error("idempotent activation must not mutate flow state"); },
    };
    assert.deepEqual(activateNonBlockingPolicy({
      root: process.cwd(),
      flowManager: manager,
      reason: "A repeat invocation must retain the first activation audit record.",
    }), state.nonblocking);
  });

  it("returns a guarded continuation when policy activation cannot proceed", () => {
    const state = moveFlowToStep(makeFlowState(), "retro");
    const result = new SetPolicyCommand().execute({
      value: "nonblocking",
      reason: "The policy can only be enabled at an eligible check.",
      root: process.cwd(),
      mainRoot: process.cwd(),
      flowCommandBoundary: true,
      flowState: state,
      flowManager: { load: () => state, mutate: (fn) => fn(state) },
    });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "NONBLOCKING_OPERATION_FAILED");
    assert.equal(result.data.continuation.actionId, "REFRESH_NONBLOCKING_FLOW");
    const token = result.data.continuation.nextAction.match(/--expect-binding '([^']+)'/)?.[1];
    assert.ok(token);
    assert.equal(FlowTargetBinding.deserialize(token).runId, state.runId);
    assert.doesNotMatch(result.data.continuation.nextAction, /--expect-run-id|--expect-spec|--expect-issue/);
    assert.doesNotThrow(() => result.toJSON());
  });

  it("uses canonical result fields for every acceptance-backed checkpoint", () => {
    assert.equal(fromReviewResult({ ref: "review", source: '{"verdict":"REJECTED"}' }).resultKind, "quality");
    assert.equal(fromReviewResult({ ref: "review", source: '{"toolingOutcome":{"kind":"parser"}}' }).resultKind, "tooling");
    assert.equal(fromGateResult({ ref: "gate", source: '{"verdict":"fail"}' }).resultKind, "quality");
    assert.equal(fromGateResult({ ref: "gate", source: '{"result":"fail","failureKind":"schema"}' }).resultKind, "tooling");
    assert.equal(fromAcceptanceResult({ ref: "acceptance", source: '{"verdict":"repair_required"}' }).resultKind, "quality");
    assert.equal(fromAcceptanceResult({ ref: "acceptance", source: '{"verdict":"user_decision_required"}' }).resultKind, "quality");
    assert.equal(fromAcceptanceResult({ ref: "acceptance", source: '{"verdict":"blocked"}' }).resultKind, "quality");
    assert.equal(fromFinalRegressionResult({ ref: "regression", source: '{"result":"unavailable"}' }).resultKind, "unavailable");
    assert.equal(fromFinalRegressionResult({ ref: "regression", source: '{"result":"fail","failureKind":"caused_by_current_change"}' }).resultKind, "quality");
    assert.equal(fromFinalRegressionResult({ ref: "regression", source: '{"result":"fail","failureKind":"infra_failure"}' }).resultKind, "tooling");
    assert.equal(fromReviewResult({ ref: "review", source: '{"verdict":"PASS"}' }), null);
  });

  it("offers advisory activation only after the ordinary Flow reaches a strict stop", () => {
    const root = createTmpDir("nonblocking-activation-offer-");
    try {
      const spec = "specs/477-activation-offer/spec.json";
      writeJson(root, spec, { requirements: [] });
      fs.writeFileSync(
        path.join(root, "specs/477-activation-offer/impl-review.json"),
        JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n",
      );
      const state = moveFlowToStep(makeFlowState({ specId: path.basename(path.dirname(spec)) }), "impl-review");
      assert.equal(
        nonblockingActivationOfferForStrictStop(root, state, {
          kind: "repair_evidence",
          reason: "The review evidence changed and can still be repaired.",
        }),
        null,
      );
      const offer = nonblockingActivationOfferForStrictStop(root, state, {
        kind: "blocked",
        reason: "The strict review recovery budget is exhausted.",
      });
      assert.equal(offer.sourceStep, "impl-review");
      assert.equal(offer.resultKind, "quality");
      assert.deepEqual(offer.prompt.choices.map((choice) => choice.actionId), [
        "KEEP_STRICT_FLOW",
        "ENABLE_NONBLOCKING",
      ]);
      assert.equal(offer.prompt.recommendedActionId, "KEEP_STRICT_FLOW");
    } finally {
      removeTmpDir(root);
    }
  });

  it("rejects stale evidence and makes the exact continue decision idempotent", () => {
    const root = createTmpDir("nonblocking-decision-");
    try {
      const spec = "specs/477-nonblocking/spec.json";
      writeJson(root, spec, { requirements: [] });
      const evidence = JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n";
      fs.writeFileSync(path.join(root, "specs/477-nonblocking/impl-review.json"), evidence);
      const state = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "impl-review", reason: "Repeated review evidence did not converge." },
        stepAttempts: [],
      }), "impl-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      const digest = crypto.createHash("sha256").update(evidence).digest("hex");
      recordEligibleNonblockingAttempt({ root, flowState: state, flowManager: manager }, "impl-review", null, { hydrate: true });
      assert.throws(() => recordNonBlockingDecision({
        root, flowManager: manager, choice: "continue", reason: "The request is implemented.",
        remainingRisk: "Review findings remain visible in the final report.", expectEvidenceDigest: "b".repeat(64),
      }), (error) => (
        /evidence changed/.test(error.message)
        && error.continuation?.nextAction.includes("senti flow get next-action")
      ));
      const recorded = recordNonBlockingDecision({
        root, flowManager: manager, choice: "continue", reason: "The request is implemented.",
        remainingRisk: "Review findings remain visible in the final report.", expectEvidenceDigest: digest,
      });
      assert.equal(recorded.action, "continue");
      assert.equal(state.steps.flatMap((entry) => entry.children || [entry]).find((entry) => entry.id === "impl-gate").status, "in_progress");
      assert.deepEqual(recordNonBlockingDecision({
        root, flowManager: manager, choice: "continue", reason: "The request is implemented.",
        remainingRisk: "Review findings remain visible in the final report.", expectEvidenceDigest: digest,
      }), recorded);
      assert.throws(() => recordNonBlockingDecision({
        root, flowManager: manager, choice: "repair", reason: "Try a different route.", expectEvidenceDigest: digest,
      }), /different nonblocking decision/);
    } finally {
      removeTmpDir(root);
    }
  });

  it("marks completion advisory only after a durable continue decision", () => {
    const outcome = new NonBlockingDecisionOutcome({
      action: "continue", sourceStep: "impl-gate", sourceAttempt: 1,
      evidenceRef: "specs/477/impl-gate-result.json", evidenceDigest: DIGEST,
      rationale: "The remaining observation does not prevent the requested behavior.",
      remainingRisk: "The observation remains documented for follow-up.", nextAction: "run-retro",
    });
    const state = makeFlowState({
      stepAttempts: [new StepAttempt({ runId: "run-test", taskId: null, stepId: "impl-gate", attempt: 1, outcome }).toJSON()],
    });
    assert.equal(new FlowCompletion(state).assurance, "advisory");
    assert.equal(new FlowCompletion(makeFlowState()).assurance, "strict");
    assert.equal(new FlowCompletion(makeFlowState()).toJSON().assurance, "strict");
  });

  it("preserves a real check observation beside its decision and uses all identity fields", () => {
    const root = createTmpDir("nonblocking-identity-");
    try {
      const spec = "specs/477-identity/spec.json";
      writeJson(root, spec, { requirements: [] });
      const evidence = JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n";
      fs.writeFileSync(path.join(root, "specs/477-identity/impl-review.json"), evidence);
      const state = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "impl-review", reason: "The normal review cycle did not converge." },
        stepAttempts: [],
      }), "impl-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      const observed = recordEligibleNonblockingAttempt({ root, flowState: state, flowManager: manager }, "impl-review", null, { hydrate: true });
      const digest = crypto.createHash("sha256").update(evidence).digest("hex");
      const unrelated = new NonBlockingDecisionOutcome({
        action: "continue",
        sourceStep: "impl-review",
        sourceAttempt: observed.attempt + 10,
        evidenceRef: "specs/477-identity/impl-review.json",
        evidenceDigest: digest,
        rationale: "A distinct durable decision must not shadow this observation.",
        remainingRisk: "The unrelated record is intentionally retained for identity testing.",
        nextAction: "run-impl-gate",
      });
      state.stepAttempts.push(new StepAttempt({
        runId: state.runId, taskId: null, stepId: "impl-review", attempt: observed.attempt + 10, outcome: unrelated,
      }).toJSON());

      const recorded = recordNonBlockingDecision({
        root, flowManager: manager, choice: "continue", reason: "The requested behavior is implemented.",
        remainingRisk: "The review result remains visible in the final report.", expectEvidenceDigest: digest,
      });
      assert.equal(recorded.sourceAttempt, observed.attempt);
      const log = new StepAttemptLog(state.stepAttempts);
      assert.ok(log.entries.some((entry) => entry.outcome instanceof ObservedNonPassOutcome && entry.attempt === observed.attempt));
      assert.ok(log.entries.some((entry) => entry.outcome instanceof NonBlockingDecisionOutcome && entry.outcome.sourceAttempt === observed.attempt));
      assert.equal(new NonBlockingDecisionIdentity(recorded).equals(new NonBlockingDecisionIdentity(unrelated)), false);
    } finally {
      removeTmpDir(root);
    }
  });

  it("requires an explicit current-command artifact reference before binding an observation", () => {
    const root = createTmpDir("nonblocking-source-attempt-");
    try {
      const spec = "specs/477-source-attempt/spec.json";
      writeJson(root, spec, { requirements: [] });
      const evidence = JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n";
      fs.writeFileSync(path.join(root, "specs/477-source-attempt/impl-review.json"), evidence);
      const state = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "impl-review", reason: "The normal review cycle did not converge." },
      }), "impl-review");
      const checkAttempt = new StepAttempt({
        runId: state.runId,
        taskId: null,
        stepId: "impl-review",
        attempt: 7,
        outcome: new ExternalBlockedOutcome({
          reason: "review retry budget is exhausted",
          resumeInstruction: "Recover the strict review evidence.",
        }),
      });
      state.stepAttempts = [checkAttempt.toJSON()];
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      const stale = recordEligibleNonblockingAttempt(
        { root, flowState: state, flowManager: manager },
        "impl-review",
        { data: { stepAttempt: checkAttempt.toJSON() } },
      );
      assert.equal(stale, null);
      assert.equal(new StepAttemptLog(state.stepAttempts).entries.filter((entry) => (
        entry.outcome instanceof ObservedNonPassOutcome
      )).length, 0);

      const observed = recordEligibleNonblockingAttempt(
        { root, flowState: state, flowManager: manager },
        "impl-review",
        {
          data: {
            stepAttempt: checkAttempt.toJSON(),
            changed: ["impl-review.json"],
          },
        },
      );
      assert.equal(observed.attempt, 7);
      const log = new StepAttemptLog(state.stepAttempts);
      assert.ok(log.entries.some((entry) => entry.outcome instanceof ExternalBlockedOutcome && entry.attempt === 7));
      assert.ok(log.entries.some((entry) => entry.outcome instanceof ObservedNonPassOutcome && entry.attempt === 7));
    } finally {
      removeTmpDir(root);
    }
  });

  it("blocks guarded planning when a durable observation loses its authoritative artifact", () => {
    const root = createTmpDir("nonblocking-missing-evidence-");
    try {
      const spec = "specs/477-missing-evidence/spec.json";
      writeJson(root, spec, { requirements: [] });
      const state = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: {
          enabled: true,
          activatedAt: "2026-07-27T00:00:00.000Z",
          activatedStep: "impl-review",
          reason: "The review had already exhausted strict recovery.",
        },
        stepAttempts: [new StepAttempt({
          runId: "run-test",
          taskId: null,
          stepId: "impl-review",
          attempt: 1,
          outcome: new ObservedNonPassOutcome({
            sourceStep: "impl-review",
            evidenceRef: "specs/477-missing-evidence/impl-review.json",
            evidenceDigest: DIGEST,
            resultKind: "quality",
          }),
        }).toJSON()],
      }), "impl-review");
      assert.throws(() => decisionContextForActiveFlow(root, state), (error) => (
        error.code === "NONBLOCKING_EVIDENCE_UNAVAILABLE"
        && error.continuation?.actionId === "RECOVER_NONBLOCKING_EVIDENCE"
      ));
      assert.throws(() => new NextActionPlanner().build({ root, flowState: state }), (error) => (
        error.code === "NONBLOCKING_EVIDENCE_UNAVAILABLE"
        && error.continuation?.nextAction.includes("senti flow get next-action")
      ));
    } finally {
      removeTmpDir(root);
    }
  });

  it("does not turn a leftover artifact into a new attempt after an operational failure", () => {
    const root = createTmpDir("nonblocking-stale-artifact-");
    try {
      const spec = "specs/477-stale-artifact/spec.json";
      writeJson(root, spec, { requirements: [] });
      const evidence = JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n";
      fs.writeFileSync(path.join(root, "specs/477-stale-artifact/impl-review.json"), evidence);
      const state = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "impl-review", reason: "The normal review cycle did not converge." },
      }), "impl-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };

      assert.equal(
        recordEligibleNonblockingAttempt(
          { root, flowState: state, flowManager: manager },
          "impl-review",
          { ok: false, errors: [{ code: "REVIEW_OPERATION_FAILED" }] },
        ),
        null,
      );
      assert.deepEqual(state.stepAttempts || [], []);

      const observed = recordEligibleNonblockingAttempt(
        { root, flowState: state, flowManager: manager },
        "impl-review",
        { artifact_path: "specs/477-stale-artifact/impl-review.json" },
      );
      assert.equal(observed.attempt, 1);
    } finally {
      removeTmpDir(root);
    }
  });

  it("recognizes the explicit canonical artifact declaration from each eligible runner", () => {
    const root = createTmpDir("nonblocking-runner-artifacts-");
    try {
      const cases = [
        ["scenario-validity", "scenario-validity-result.json", { result: "block" }, () => ({ data: { changed: ["scenario-validity-result.json"] } })],
        ["test-review", "test-review.json", { verdict: "REJECTED" }, () => ({ changed: ["test-review.json"] })],
        ["test-result-review", "test-result-review.json", { verdict: "fail" }, () => ({ changed: ["test-result-review.json"] })],
        ["impl-review", "impl-review.json", { verdict: "REJECTED" }, () => ({ changed: ["impl-review.json"] })],
        ["impl-gate", "impl-gate-result.json", { verdict: "fail" }, () => ({ changed: ["impl-gate-result.json"] })],
        ["acceptance-review", "acceptance-review.json", { verdict: "repair_required" }, (ref) => ({ artifact_path: ref })],
        ["final-regression", "final-regression-result.json", { result: "unavailable" }, (ref) => ({ data: { result_path: ref } })],
      ];
      for (const [step, file, value, commandResult] of cases) {
        const spec = `specs/477-runner-${step}/spec.json`;
        writeJson(root, spec, { requirements: [] });
        fs.writeFileSync(path.join(root, path.dirname(spec), file), JSON.stringify(value, null, 2) + "\n");
        const state = moveFlowToStep(makeFlowState({
          specId: path.basename(path.dirname(spec)),
          nonblocking: {
            enabled: true,
            activatedAt: "2026-07-27T00:00:00.000Z",
            activatedStep: step,
            reason: "The strict check had already reached a user decision.",
          },
        }), step);
        const manager = { load: () => state, mutate: (fn) => fn(state) };
        const ref = `specs/477-runner-${step}/${file}`;
        const observed = recordEligibleNonblockingAttempt(
          { root, flowState: state, flowManager: manager },
          step,
          commandResult(ref),
        );
        assert.ok(observed, `${step} runner result should explicitly bind its canonical artifact`);
        assert.equal(observed.outcome.sourceStep, step);
        assert.equal(observed.outcome.evidenceRef, ref);
      }
    } finally {
      removeTmpDir(root);
    }
  });

  it("uses the strict check attempt when policy activation hydrates existing evidence", () => {
    const root = createTmpDir("nonblocking-hydrated-attempt-");
    try {
      const spec = "specs/477-hydrated-attempt/spec.json";
      writeJson(root, spec, { requirements: [] });
      fs.writeFileSync(
        path.join(root, "specs/477-hydrated-attempt/impl-review.json"),
        JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n",
      );
      const state = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: {
          enabled: true,
          activatedAt: "2026-07-27T00:00:00.000Z",
          activatedStep: "impl-review",
          reason: "The strict review had already exhausted its recovery.",
        },
        stepAttempts: [new StepAttempt({
          runId: "run-test",
          taskId: null,
          stepId: "impl-review",
          attempt: 4,
          outcome: new ExternalBlockedOutcome({
            reason: "strict review recovery exhausted",
            resumeInstruction: "Choose the next guarded Flow action.",
          }),
        }).toJSON()],
      }), "impl-review");
      const observed = recordEligibleNonblockingAttempt({
        root,
        flowState: state,
        flowManager: { load: () => state, mutate: (fn) => fn(state) },
      }, "impl-review", null, { hydrate: true });
      assert.equal(observed.attempt, 4);
    } finally {
      removeTmpDir(root);
    }
  });

  it("bounds decision rationale and remaining risk before any durable write", () => {
    const root = createTmpDir("nonblocking-bounded-text-");
    try {
      const spec = "specs/477-bounded-text/spec.json";
      writeJson(root, spec, { requirements: [] });
      const evidence = JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n";
      fs.writeFileSync(path.join(root, "specs/477-bounded-text/impl-review.json"), evidence);
      const state = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "impl-review", reason: "The normal review cycle did not converge." },
      }), "impl-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      recordEligibleNonblockingAttempt(
        { root, flowState: state, flowManager: manager },
        "impl-review",
        { changed: ["impl-review.json"] },
      );
      const digest = crypto.createHash("sha256").update(evidence).digest("hex");

      assert.throws(() => recordNonBlockingDecision({
        root,
        flowManager: manager,
        choice: "continue",
        reason: "x".repeat(2_001),
        remainingRisk: "The unresolved review finding remains documented.",
        expectEvidenceDigest: digest,
      }), /reason must be a non-empty string no longer than 2000 characters/);
      assert.deepEqual(state.stepAttempts.filter((entry) => entry.outcome.kind === "nonblocking-decision"), []);
    } finally {
      removeTmpDir(root);
    }
  });

  it("does not bypass issue-log or flow-state persistence failures", () => {
    const root = createTmpDir("nonblocking-persistence-");
    try {
      const spec = "specs/477-persistence/spec.json";
      writeJson(root, spec, { requirements: [] });
      const evidence = JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n";
      fs.writeFileSync(path.join(root, "specs/477-persistence/impl-review.json"), evidence);
      const state = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "impl-review", reason: "The normal review cycle did not converge." },
        stepAttempts: [],
      }), "impl-review");
      let failStateWrite = false;
      const manager = {
        load: () => state,
        mutate: (fn) => {
          if (failStateWrite) throw new Error("injected flow state write failure");
          fn(state);
        },
      };
      recordEligibleNonblockingAttempt({ root, flowState: state, flowManager: manager }, "impl-review", null, { hydrate: true });
      const digest = crypto.createHash("sha256").update(evidence).digest("hex");
      const beforeIssueFailure = structuredClone(state);
      assert.throws(() => recordNonBlockingDecision({
        root, flowManager: manager, choice: "continue", reason: "The requested behavior is implemented.",
        remainingRisk: "The review result remains visible in the final report.", expectEvidenceDigest: digest,
        issueLogStoreFactory: () => ({ append: () => { throw new Error("injected issue-log failure"); } }),
      }), /injected issue-log failure/);
      assert.deepEqual(state, beforeIssueFailure);

      let compensated = false;
      failStateWrite = true;
      assert.throws(() => recordNonBlockingDecision({
        root, flowManager: manager, choice: "continue", reason: "The requested behavior is implemented.",
        remainingRisk: "The review result remains visible in the final report.", expectEvidenceDigest: digest,
        issueLogStoreFactory: () => ({
          append: () => ({ appended: true }),
          compensate: () => { compensated = true; },
        }),
      }), /injected flow state write failure/);
      assert.equal(compensated, true);
      assert.equal(findStepById(state.steps, "impl-review").status, "in_progress");
      assert.equal(findStepById(state.steps, "impl-gate").status, "pending");

      const commandResult = new SetNonBlockingDecisionCommand().execute({
        root,
        mainRoot: root,
        flowCommandBoundary: true,
        flowState: state,
        flowManager: manager,
        choice: "continue",
        reason: "The requested behavior is implemented.",
        remainingRisk: "The review result remains visible in the final report.",
        expectEvidenceDigest: digest,
      });
      assert.equal(commandResult.ok, false);
      assert.equal(commandResult.data.continuation.actionId, "REFRESH_NONBLOCKING_FLOW");
      assert.match(commandResult.data.continuation.nextAction, /--expect-binding '[^']+'/);
      assert.doesNotMatch(commandResult.data.continuation.nextAction, /--expect-run-id|--expect-spec|--expect-issue/);
      assert.doesNotThrow(() => commandResult.toJSON());
    } finally {
      removeTmpDir(root);
    }
  });

  it("continues every flow-level acceptance-backed checkpoint on its declared route", () => {
    const root = createTmpDir("nonblocking-routes-");
    try {
      const cases = [
        ["draft-questions-review", "draft-review-questions.json", { verdict: "REJECTED" }, "draft-refine", ["draft-questions-triage", "draft-questions-repair"]],
        ["draft-coverage-review", "draft-review-coverage.json", { verdict: "REJECTED" }, "draft-gate", ["draft-coverage-triage", "draft-coverage-repair"]],
        ["draft-gate", "draft-gate-result.json", { verdict: "fail" }, "spec"],
        ["spec-review", "spec-review.json", { verdict: "REJECTED" }, "spec-gate", ["spec-triage", "spec-repair"]],
        ["spec-gate", "spec-gate-result.json", { verdict: "fail" }, "approval"],
        ["scenario-validity", "scenario-validity-result.json", { result: "block" }, "test-review"],
        ["test-review", "test-review.json", { verdict: "REJECTED" }, "implement"],
        ["test-result-review", "test-result-review.json", { verdict: "fail" }, "impl-review"],
        ["impl-review", "impl-review.json", { verdict: "REJECTED" }, "impl-gate"],
        ["impl-gate", "impl-gate-result.json", { verdict: "fail" }, "retro"],
        ["retro", "retro.json", { summary: { not_done: 1 } }, "acceptance-review"],
        ["acceptance-review", "acceptance-review.json", { verdict: "repair_required" }, "final-regression", ["acceptance-decision"]],
        ["final-regression", "final-regression-result.json", { result: "unavailable" }, "report"],
      ];
      for (const [step, file, artifact, next, skipped = []] of cases) {
        const spec = `specs/477-${step}/spec.json`;
        writeJson(root, spec, { requirements: [] });
        const bytes = JSON.stringify(artifact, null, 2) + "\n";
        fs.writeFileSync(path.join(root, path.dirname(spec), file), bytes);
        const state = moveFlowToStep(makeFlowState({
          specId: path.basename(path.dirname(spec)),
          nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: step, reason: "A normal recovery cycle did not converge." },
          stepAttempts: [],
        }), step);
        const manager = { load: () => state, mutate: (fn) => fn(state) };
        recordEligibleNonblockingAttempt({ root, flowState: state, flowManager: manager }, step, null, { hydrate: true });
        recordNonBlockingDecision({
          root, flowManager: manager, choice: "continue", reason: "The requested behavior is otherwise complete.",
          remainingRisk: "The original non-pass artifact remains available for review.",
          expectEvidenceDigest: crypto.createHash("sha256").update(bytes).digest("hex"),
          issueLogStoreFactory: () => ({ append: () => ({ appended: false }) }),
        });
        assert.equal(findStepById(state.steps, step).status, "done");
        assert.equal(findStepById(state.steps, next).status, "in_progress");
        for (const skippedStep of skipped) {
          assert.equal(findStepById(state.steps, skippedStep).status, "done");
        }
      }
    } finally {
      removeTmpDir(root);
    }
  });

  it("consumes a durable acceptance continuation before promoting finalization", async () => {
    const root = createTmpDir("nonblocking-acceptance-reconcile-");
    try {
      const spec = "specs/477-acceptance-reconcile/spec.json";
      writeJson(root, spec, { requirements: [] });
      const artifact = JSON.stringify({ verdict: "blocked" }, null, 2) + "\n";
      fs.writeFileSync(path.join(root, "specs/477-acceptance-reconcile/acceptance-review.json"), artifact);
      const state = makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: {
          enabled: true,
          activatedAt: "2026-07-27T00:00:00.000Z",
          activatedStep: "acceptance-review",
          reason: "The acceptance result has a bounded advisory continuation.",
        },
      });
      for (const step of state.steps.flatMap((entry) => entry.children || [entry])) {
        step.status = step.id.startsWith("finalize-") ? "pending" : "done";
      }
      findStepById(state.steps, "acceptance-decision").status = "in_progress";
      const digest = crypto.createHash("sha256").update(artifact).digest("hex");
      const outcome = new NonBlockingDecisionOutcome({
        action: "continue",
        sourceStep: "acceptance-review",
        sourceAttempt: 1,
        evidenceRef: "specs/477-acceptance-reconcile/acceptance-review.json",
        evidenceDigest: digest,
        rationale: "The blocked acceptance evidence is retained as an advisory risk.",
        remainingRisk: "The acceptance artifact remains blocked and is recorded for follow-up.",
        nextAction: "run-final-regression",
      });
      state.stepAttempts = [new StepAttempt({
        runId: state.runId,
        taskId: null,
        stepId: "acceptance-review",
        attempt: 1,
        outcome,
      }).toJSON()];

      let persisted = null;
      const result = await new GetNextActionCommand().execute({
        root,
        flowState: state,
        flowManager: {
          mutate(mutator, { expectedOriginal }) {
            assert.equal(expectedOriginal, state);
            mutator(state);
            persisted = structuredClone(state);
          },
        },
      });
      assert.equal(result.step, "finalize-commit");
      assert.equal(result.action, "run-finalize-commit");
      assert.equal(persisted.steps.flatMap((entry) => entry.children || [entry])
        .find((entry) => entry.id === "acceptance-decision").status, "done");
      assert.equal(findStepById(persisted.steps, "finalize-commit").status, "in_progress");
    } finally {
      removeTmpDir(root);
    }
  });

  it("continues task review and task gate in task scope without advancing parent impl steps", () => {
    const root = createTmpDir("nonblocking-task-routes-");
    try {
      const spec = "specs/477-task-routes/spec.json";
      writeJson(root, spec, { requirements: [] });
      fs.writeFileSync(path.join(root, "specs/477-task-routes/impl-review.json"), '{"verdict":"REJECTED"}\n');
      const reviewState = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        currentTaskId: "T-1",
        tasks: [makeDefaultTask({
          id: "T-1",
          status: "in_progress",
          steps: [
            { id: "task-impl", status: "done" },
            { id: "task-review", status: "in_progress" },
            { id: "task-gate", status: "pending" },
          ],
        })],
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "task-review", reason: "Task review is bounded." },
      }), "implement");
      const reviewManager = { load: () => reviewState, mutate: (fn) => fn(reviewState) };
      recordEligibleNonblockingAttempt({ root, flowState: reviewState, flowManager: reviewManager }, "task-review", null, { hydrate: true });
      const reviewDigest = crypto.createHash("sha256")
        .update(fs.readFileSync(path.join(root, "specs/477-task-routes/impl-review.json"), "utf8"))
        .digest("hex");
      recordNonBlockingDecision({
        root,
        flowManager: reviewManager,
        choice: "continue",
        reason: "The task review finding is retained for acceptance.",
        remainingRisk: "The task review did not reach a passing disposition.",
        expectEvidenceDigest: reviewDigest,
        issueLogStoreFactory: () => ({ append: () => ({ appended: false }) }),
      });
      assert.equal(reviewState.tasks[0].steps[1].status, "done");
      assert.equal(reviewState.tasks[0].steps[2].status, "in_progress");
      assert.equal(findStepById(reviewState.steps, "impl-gate").status, "pending");

      fs.writeFileSync(path.join(root, "specs/477-task-routes/task-impl-gate-result.json"), '{"verdict":"fail"}\n');
      const gateState = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        currentTaskId: "T-1",
        tasks: [
          makeDefaultTask({
            id: "T-1",
            status: "in_progress",
            steps: [
              { id: "task-impl", status: "done" },
              { id: "task-review", status: "done" },
              { id: "task-gate", status: "in_progress" },
            ],
          }),
          makeDefaultTask({ id: "T-2", status: "pending" }),
        ],
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "task-gate", reason: "Task gate is bounded." },
      }), "implement");
      const gateManager = { load: () => gateState, mutate: (fn) => fn(gateState) };
      recordEligibleNonblockingAttempt({ root, flowState: gateState, flowManager: gateManager }, "task-gate", null, { hydrate: true });
      const gateDigest = crypto.createHash("sha256")
        .update(fs.readFileSync(path.join(root, "specs/477-task-routes/task-impl-gate-result.json"), "utf8"))
        .digest("hex");
      recordNonBlockingDecision({
        root,
        flowManager: gateManager,
        choice: "continue",
        reason: "The task gate result remains an acceptance risk.",
        remainingRisk: "Task-level gate observations were not fully resolved.",
        expectEvidenceDigest: gateDigest,
        issueLogStoreFactory: () => ({ append: () => ({ appended: false }) }),
      });
      assert.equal(gateState.tasks[0].status, "done");
      assert.equal(gateState.tasks[0].steps[2].status, "done");
      assert.equal(gateState.currentTaskId, "T-2");
      assert.equal(findStepById(gateState.steps, "impl-gate").status, "pending");
    } finally {
      removeTmpDir(root);
    }
  });

  it("holds review and gate lifecycle ownership for every policy-covered route", () => {
    const reviewCases = [
      ["draft-questions-review", "draft", "draft-questions"],
      ["draft-coverage-review", "draft", "draft-coverage"],
      ["spec-review", "spec", "spec"],
      ["test-review", "test", "test"],
      ["impl-review", "impl", "impl"],
    ];
    for (const [stepId, phase, artifactPhase] of reviewCases) {
      const state = moveFlowToStep(makeFlowState({
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: stepId, reason: "The route is explicitly advisory." },
      }), stepId);
      const plan = resolveLifecyclePlan({
        event: "review:post",
        command: "run-review",
        phase,
        currentStepId: stepId,
        flowState: state,
        result: { artifacts: { phase: artifactPhase, verdict: "REJECTED" } },
      });
      assert.deepEqual(plan.actions, [], stepId);
    }
    const gateCases = [
      ["draft-gate", "draft"],
      ["spec-gate", "spec"],
      ["impl-gate", "integration"],
    ];
    for (const [stepId, phase] of gateCases) {
      const state = moveFlowToStep(makeFlowState({
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: stepId, reason: "The route is explicitly advisory." },
      }), stepId);
      const plan = resolveLifecyclePlan({
        event: "gate:post",
        command: "run-gate",
        phase,
        currentStepId: stepId,
        flowState: state,
        result: { result: "fail", artifacts: { phase } },
      });
      assert.deepEqual(plan.actions, [], stepId);
    }
  });

  it("allows one recovery decision and then only continue after fresh non-pass evidence", () => {
    const root = createTmpDir("nonblocking-recovery-");
    try {
      const spec = "specs/477-recovery/spec.json";
      writeJson(root, spec, { requirements: [] });
      const file = path.join(root, "specs/477-recovery/impl-review.json");
      const first = JSON.stringify({ verdict: "REJECTED", revision: 1 }, null, 2) + "\n";
      fs.writeFileSync(file, first);
      const state = moveFlowToStep(makeFlowState({
        specId: path.basename(path.dirname(spec)),
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "impl-review", reason: "Normal repair did not converge." },
        stepAttempts: [],
      }), "impl-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      recordEligibleNonblockingAttempt({ root, flowState: state, flowManager: manager }, "impl-review", null, { hydrate: true });
      recordNonBlockingDecision({
        root, flowManager: manager, choice: "repair", reason: "Repair the rejected requirement evidence.",
        expectEvidenceDigest: crypto.createHash("sha256").update(first).digest("hex"),
      });
      assert.deepEqual(decisionContextForActiveFlow(root, state).allowedActions, []);
      const second = JSON.stringify({ verdict: "REJECTED", revision: 2 }, null, 2) + "\n";
      fs.writeFileSync(file, second);
      recordEligibleNonblockingAttempt(
        { root, flowState: state, flowManager: manager },
        "impl-review",
        { changed: ["impl-review.json"] },
      );
      const context = decisionContextForActiveFlow(root, state);
      assert.deepEqual(context.allowedActions, ["continue"]);
      assert.throws(() => recordNonBlockingDecision({
        root, flowManager: manager, choice: "repair", reason: "Repair again.",
        expectEvidenceDigest: context.evidenceDigest,
      }), /not allowed/);
    } finally {
      removeTmpDir(root);
    }
  });
});
