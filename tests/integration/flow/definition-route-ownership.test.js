import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { afterEach } from "node:test";

import {
  AcceptanceDecisionRouteFacts,
  AcceptanceReviewRouteFacts,
  ApprovalRouteFacts,
  DefinitionRouteTarget,
  resolveDefinitionRoute,
} from "../../../src/flow/definition.js";
import { CanonicalSpecApproval } from "../../../src/flow/lib/canonical-spec-approval.js";
import { FlowAtStepFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import { emptySpecStub } from "../../../src/lib/spec-json.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { projectApprovalRequirements } from "../../../src/flow/lib/get-next-action.js";
import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";

const digest = "a".repeat(64);
const fixtureRoots = [];

afterEach(() => {
  for (const root of fixtureRoots.splice(0)) removeTmpDir(root);
});

function target(stepId) {
  return new DefinitionRouteTarget({
    runId: "run-definition-route",
    specId: "definition-route",
    stepId,
    attemptId: `${stepId}-attempt`,
    sequence: 3,
  });
}

describe("Definition-owned approval and acceptance routes", () => {
  it("keeps approval waiting until a bound explicit or auto policy confirmation exists", () => {
    const waiting = resolveDefinitionRoute(new ApprovalRouteFacts({
      target: target("approval"), specPublicationDigest: digest,
    }));
    assert.equal(waiting.route, "await-approval");
    const approved = resolveDefinitionRoute(new ApprovalRouteFacts({
      target: target("approval"), specPublicationDigest: digest, requestedApproval: true,
    }));
    assert.equal(approved.route, "confirm-and-advance");
    const automatic = resolveDefinitionRoute(new ApprovalRouteFacts({
      target: target("approval"), specPublicationDigest: digest, autoApprove: true,
    }));
    assert.equal(automatic.route, "confirm-and-advance");
    const stale = resolveDefinitionRoute(new ApprovalRouteFacts({
      target: target("approval"), specPublicationDigest: digest,
      approvalRecord: { approved: true, confirmed_at: "2026-01-01T00:00:00.000Z" },
      requestedApproval: true,
    }));
    assert.deepEqual(stale.toJSON().route, "blocked");
  });

  it("selects every acceptance review route from canonical review facts", () => {
    const expected = [
      ["pass", "advance-final-regression"],
      ["repair_required", "repair-acceptance-to-impl-triage"],
      ["user_decision_required", "await-acceptance-decision"],
      ["blocked", "blocked"],
    ];
    for (const [verdict, route] of expected) {
      const plan = resolveDefinitionRoute(new AcceptanceReviewRouteFacts({
        target: target("acceptance-review"),
        reviewArtifactDigest: digest,
        requirementIds: ["REQ-1"],
        findingDispositions: ["finding-1:still_open"],
        verdict,
      }));
      assert.equal(plan.route, route);
      if (verdict === "blocked") assert.equal(plan.reason, "acceptance_blocked");
    }
  });

  it("keeps semantic blocked distinct from partial completion after fact reload", () => {
    const partial = new AcceptanceReviewRouteFacts({
      target: target("acceptance-review"), reviewArtifactDigest: digest,
      requirementIds: ["REQ-1"], findingDispositions: [], verdict: "pass", completed: false,
    });
    const reloaded = new AcceptanceReviewRouteFacts(JSON.parse(JSON.stringify(partial.toJSON())));
    const first = resolveDefinitionRoute(partial);
    const restored = resolveDefinitionRoute(reloaded);
    assert.equal(first.route, "blocked");
    assert.equal(first.reason, "partial_completion");
    assert.deepEqual(restored.toJSON(), first.toJSON());
  });

  it("keeps acceptance decisions tokenless and never lets auto approval choose abort or continue", () => {
    const base = {
      target: target("acceptance-decision"),
      reviewArtifactDigest: digest,
      requirementIds: ["REQ-1"],
      findingDispositions: ["finding-1:still_open"],
    };
    assert.equal(resolveDefinitionRoute(new AcceptanceDecisionRouteFacts(base)).route, "await-acceptance-decision");
    assert.equal(resolveDefinitionRoute(new AcceptanceDecisionRouteFacts({
      ...base,
      choice: "accept_risk_and_continue",
      decisionRecord: { choice: "accept_risk_and_continue", reviewArtifactDigest: digest },
    })).route, "advance-final-regression");
    assert.equal(resolveDefinitionRoute(new AcceptanceDecisionRouteFacts({
      ...base,
      choice: "abort",
      decisionRecord: { choice: "abort", reviewArtifactDigest: digest },
    })).route, "park");
    assert.throws(() => new AcceptanceDecisionRouteFacts({
      ...base,
      choice: "abort",
      decisionRecord: { choice: "abort", reviewArtifactDigest: "b".repeat(64) },
    }), /bound to canonical review evidence/);
  });

  it("rejects a stale approval publication digest without advancing the Flow", () => {
    const root = createTmpDir("definition-route-stale-approval-");
    fixtureRoots.push(root);
    const specId = "stale-approval";
    const manager = makeFlowManager(root);
    new FlowAtStepFixture({
      flowManager: manager, specId, runId: "run-stale-approval", execution: { mode: "direct" },
      targetStep: "approval", specRecord: { ...emptySpecStub(), tasks: [] },
    }).create();
    const before = manager.readArtifact({ specId, logicalKey: "spec.record", consumerNodeId: "approval" });
    manager.updateSpecApproval({
      specId,
      approval: new CanonicalSpecApproval({ confirmedAt: "2026-01-01T00:00:00.000Z" }),
    });
    const flowBefore = manager.canonicalState(specId).toJSON();
    assert.throws(() => manager.approveSpecContinuation({
      specId,
      approval: new CanonicalSpecApproval({ confirmedAt: "2026-01-02T00:00:00.000Z" }),
      expectedSpecDigest: before.descriptor.hash,
    }), /changed before approval confirmation/);
    assert.deepEqual(manager.canonicalState(specId).toJSON(), flowBefore);
  });

  it("projects manual, automatic, and recovered approval plans without an unintended token", () => {
    const base = { target: target("approval"), specPublicationDigest: digest };
    const manual = resolveDefinitionRoute(new ApprovalRouteFacts(base));
    assert.deepEqual(projectApprovalRequirements({ plan: manual, requiresApproval: true, autoApproveChoiceId: "1" }), {
      requiresApproval: true, autoApproveChoiceId: "1",
    });
    for (const facts of [
      new ApprovalRouteFacts({ ...base, autoApprove: true }),
      new ApprovalRouteFacts({ ...base, approvalRecord: { approved: true, confirmed_at: "2026-01-01T00:00:00.000Z", notes: "kept" } }),
    ]) {
      const plan = resolveDefinitionRoute(facts);
      assert.deepEqual(projectApprovalRequirements({ plan, requiresApproval: true, autoApproveChoiceId: "1" }), {
        requiresApproval: false, autoApproveChoiceId: null,
      });
    }
  });

  it("rejects a blocked approval plan before any Store call", () => {
    let storeCalls = 0;
    const flowManager = {
      canonicalState: () => ({
        runId: "run-definition-route", specId: "definition-route", current: ["approval"],
        currentNodeId: "approval", attempt: { id: "approval-attempt", sequence: 1 },
        policy: { autoApprove: false },
      }),
      readArtifact: () => ({
        descriptor: { hash: digest },
        bytes: Buffer.from(JSON.stringify({
          user_approval: { approved: true, confirmed_at: "2026-01-01T00:00:00.000Z" },
        })),
      }),
      approveSpecContinuation() { storeCalls += 1; },
    };
    assert.throws(() => new RunDispatchCommand().runApprovalContinuation({
      specId: "definition-route", flowManager,
    }, {
      action: { nextAction: { step: "approval" } }, approved: true, authorization: null,
    }), /approval_already_recorded/);
    assert.equal(storeCalls, 0);
  });

  it("reuses an existing approval record when Definition resumes confirmation", () => {
    const recorded = {
      approved: true,
      confirmed_at: "2026-01-01T00:00:00.000Z",
      notes: "preserve this approval",
    };
    let applied = null;
    const flowManager = {
      canonicalState: () => ({
        runId: "run-definition-route", specId: "definition-route", current: ["approval"],
        currentNodeId: "approval", attempt: { id: "approval-attempt", sequence: 1 },
        policy: { autoApprove: false },
      }),
      readArtifact: () => ({
        descriptor: { hash: digest },
        bytes: Buffer.from(JSON.stringify({ user_approval: recorded })),
      }),
      approveSpecContinuation(input) { applied = input; return input; },
    };
    new RunDispatchCommand().runApprovalContinuation({
      specId: "definition-route", flowManager,
    }, {
      action: { nextAction: { step: "approval" } }, approved: false, authorization: null,
    });
    assert.equal(applied.expectedSpecDigest, digest);
    assert.deepEqual(applied.approval.toJSON(), recorded);
  });
});
