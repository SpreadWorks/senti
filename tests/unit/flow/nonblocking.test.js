import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  NonBlockingDecisionContext,
  NonBlockingPolicy,
  advisorySummary,
  activateNonBlockingPolicy,
  decisionContextForActiveFlow,
  recordNonBlockingDecision,
  recordEligibleNonblockingAttempt,
} from "../../../src/flow/lib/nonblocking.js";
import { NonBlockingDecisionOutcome, StepAttempt, StepAttemptLog } from "../../../src/flow/lib/step-outcome.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { FlowCompletion } from "../../../src/flow/lib/flow-completion.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  fromAcceptanceResult,
  fromFinalRegressionResult,
  fromGateResult,
  fromReviewResult,
} from "../../../src/flow/lib/nonblocking-evidence.js";

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

  it("requires approved implementation work and excludes direct ownership", () => {
    const state = moveFlowToStep(makeFlowState(), "impl-review");
    const manager = { load: () => state, mutate: (fn) => fn(state) };
    const enabled = activateNonBlockingPolicy({
      root: process.cwd(), flowManager: manager,
      reason: "Normal review recovery has already been exhausted for this work.",
    });
    assert.equal(enabled.enabled, true);
    assert.equal(state.nonblocking.activatedStep, "impl-review");
    state.directFlowSession = { phase: "DIRECT_FIX" };
    assert.throws(() => activateNonBlockingPolicy({
      root: process.cwd(), flowManager: manager,
      reason: "This must not take ownership from a direct session.",
    }), /direct session/);
  });

  it("uses only the four canonical artifact result fields for eligibility", () => {
    assert.equal(fromReviewResult({ ref: "review", source: '{"verdict":"REJECTED"}' }).resultKind, "quality");
    assert.equal(fromGateResult({ ref: "gate", source: '{"verdict":"fail"}' }).resultKind, "quality");
    assert.equal(fromAcceptanceResult({ ref: "acceptance", source: '{"verdict":"inconclusive"}' }).resultKind, "quality");
    assert.equal(fromFinalRegressionResult({ ref: "regression", source: '{"result":"unavailable"}' }).resultKind, "unavailable");
    assert.equal(fromReviewResult({ ref: "review", source: '{"verdict":"PASS"}' }), null);
  });

  it("rejects stale evidence and makes the exact continue decision idempotent", () => {
    const root = createTmpDir("nonblocking-decision-");
    try {
      const spec = "specs/477-nonblocking/spec.json";
      writeJson(root, spec, { requirements: [] });
      const evidence = JSON.stringify({ verdict: "REJECTED" }, null, 2) + "\n";
      fs.writeFileSync(path.join(root, "specs/477-nonblocking/impl-review.json"), evidence);
      const state = moveFlowToStep(makeFlowState({
        spec,
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "impl-review", reason: "Repeated review evidence did not converge." },
        stepAttempts: [],
      }), "impl-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      const digest = crypto.createHash("sha256").update(evidence).digest("hex");
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
  });

  it("continues each eligible post-implementation step on the normal route", () => {
    const root = createTmpDir("nonblocking-routes-");
    try {
      const cases = [
        ["impl-review", "impl-review.json", { verdict: "REJECTED" }, "impl-gate"],
        ["impl-gate", "impl-gate-result.json", { verdict: "fail" }, "retro"],
        ["acceptance-review", "acceptance-review.json", { verdict: "inconclusive" }, "final-regression"],
        ["final-regression", "final-regression-result.json", { result: "unavailable" }, "report"],
      ];
      for (const [step, file, artifact, next] of cases) {
        const spec = `specs/477-${step}/spec.json`;
        writeJson(root, spec, { requirements: [] });
        const bytes = JSON.stringify(artifact, null, 2) + "\n";
        fs.writeFileSync(path.join(root, path.dirname(spec), file), bytes);
        const state = moveFlowToStep(makeFlowState({
          spec,
          nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: step, reason: "A normal recovery cycle did not converge." },
          stepAttempts: [],
        }), step);
        const manager = { load: () => state, mutate: (fn) => fn(state) };
        recordNonBlockingDecision({
          root, flowManager: manager, choice: "continue", reason: "The requested behavior is otherwise complete.",
          remainingRisk: "The original non-pass artifact remains available for review.",
          expectEvidenceDigest: crypto.createHash("sha256").update(bytes).digest("hex"),
        });
        assert.equal(findStepById(state.steps, step).status, "done");
        assert.equal(findStepById(state.steps, next).status, "in_progress");
      }
    } finally {
      removeTmpDir(root);
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
        spec,
        nonblocking: { enabled: true, activatedAt: "2026-07-27T00:00:00.000Z", activatedStep: "impl-review", reason: "Normal repair did not converge." },
        stepAttempts: [],
      }), "impl-review");
      const manager = { load: () => state, mutate: (fn) => fn(state) };
      recordNonBlockingDecision({
        root, flowManager: manager, choice: "repair", reason: "Repair the rejected requirement evidence.",
        expectEvidenceDigest: crypto.createHash("sha256").update(first).digest("hex"),
      });
      assert.throws(() => decisionContextForActiveFlow(root, state), /subsequent check result/);
      const second = JSON.stringify({ verdict: "REJECTED", revision: 2 }, null, 2) + "\n";
      fs.writeFileSync(file, second);
      recordEligibleNonblockingAttempt({ root, flowState: state, flowManager: manager }, "impl-review");
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
