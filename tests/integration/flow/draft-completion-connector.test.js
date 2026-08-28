import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import {
  DraftCompletionConnector,
  CompleteDraftCoverageRepair,
  resolveDraftCoverageRepairCompletion,
  resolveDraftCompletionConnector,
  resolveLifecyclePlan,
} from "../../../src/flow/definition.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { DraftCompletionFacts } from "../../../src/flow/lib/draft-completion-connector.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { CanonicalFlowFixture } from "../../support/infrastructure/flow-setup.js";

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function draft({ approval = false, questions = [] } = {}) {
  return {
    devType: "feature",
    goal: "Confirm a completed draft through the canonical connector.",
    analysis: {
      problem: "The completion marker must have one parent-owned writer.",
      proposedApproach: "Select a connector from canonical coverage facts.",
      validation: "Exercise the connector's complete and reject paths.",
    },
    decisionMap: {
      knownFacts: [], decisionPoints: [], resolvedByProjectRules: [], requiresUserJudgment: [], deferredToSpec: [],
    },
    questionLedger: {
      revision: 0,
      publication: "draft-completion-connector-test",
      evidenceDigest: "a".repeat(64),
      questions,
    },
    approval: { approved: approval },
  };
}

function repairAudit(overrides = {}) {
  return {
    version: 2,
    phase: "draft-coverage-repair",
    sourceTriage: "draft-coverage-triage.json",
    baseRevision: `sha256:${"b".repeat(64)}`,
    acceptedOperations: [],
    discardedOperations: [],
    appliedFindingKeys: [],
    operationDigest: "c".repeat(64),
    audit: {
      envelopeErrors: [],
      baseRevisionMatches: true,
      missingRequiredTargets: [],
      lifecycleIssues: ["draft approval is required: set approval.approved = true"],
    },
    ...overrides,
  };
}

function facts({
  source = "coverage-pass",
  draftDocument = draft(),
  reviewVerdict = "PASS",
  triage = null,
  repair = null,
  canonicalDigest = null,
  canonicalByteLength = null,
} = {}) {
  const bytes = Buffer.from(`${JSON.stringify(draftDocument, null, 2)}\n`, "utf8");
  const sourceDigest = canonicalDigest ?? crypto.createHash("sha256").update(bytes).digest("hex");
  return new DraftCompletionFacts({
    source,
    sourceStepId: "draft-coverage-repair",
    targetStepId: "draft-gate",
    draft: draftDocument,
    draftDigest: sourceDigest,
    draftByteLength: canonicalByteLength ?? bytes.length,
    reviewVerdict,
    reviewDraftDigest: sourceDigest,
    triage,
    repair,
  });
}

describe("DraftCompletionConnector", () => {
  it("uses the repair completion action rather than adding a Flow step on a coverage PASS", () => {
    const actions = resolveLifecyclePlan({
      event: "review:post",
      currentStepId: "draft-coverage-review",
      phase: "draft",
      result: { artifacts: { phase: "draft-coverage", retryPhase: "draft-coverage", verdict: "PASS" } },
      flowState: { policy: { nonblocking: { enabled: false } } },
    }).actions;

    assert.ok(actions.at(-1) instanceof CompleteDraftCoverageRepair);
    assert.equal(actions.some((action) => action.constructor.name === "SetStepStatus" && action.step === "draft-coverage-repair"), false);
  });

  it("is selected by Definition for the no-repair coverage path and derives only the approval marker", () => {
    const source = draft();
    const connector = resolveDraftCompletionConnector(facts({ draftDocument: source }));

    assert.ok(connector instanceof DraftCompletionConnector);
    assert.equal(connector.source, "coverage-pass");
    assert.equal(connector.sourceStepId, "draft-coverage-repair");
    assert.equal(connector.targetStepId, "draft-gate");
    assert.equal(connector.expectedDraftDigest, facts({ draftDocument: source }).draftDigest);
    assert.deepEqual(connector.applyTo(source), {
      ...source,
      approval: { approved: true },
    });
    assert.deepEqual(source.approval, { approved: false });
  });

  it("is selected after a valid coverage repair while keeping discarded unrelated operations auditable", () => {
    const source = draft();
    const connector = resolveDraftCompletionConnector(facts({
      source: "coverage-repair",
      draftDocument: source,
      reviewVerdict: "REJECTED",
      triage: { items: [{ decision: "apply" }] },
      repair: repairAudit({
        discardedOperations: [{ reason: "out-of-scope operation" }],
      }),
    }));

    assert.ok(connector instanceof DraftCompletionConnector);
    assert.equal(connector.source, "coverage-repair");
    assert.equal(connector.applyTo(source).approval.approved, true);
  });

  it("does not select a connector when canonical coverage facts are incomplete, stale, or structurally invalid", () => {
    const unresolved = {
      state: "AwaitingUserAnswer",
      id: "q1",
      category: "user-visible-behavior",
      question: "Which behavior should be selected?",
      revision: 0,
      provenance: { producer: "test" },
      evidenceDigest: "d".repeat(64),
    };
    const cases = [
      facts({ draftDocument: draft({ questions: [unresolved] }) }),
      facts({ reviewVerdict: "REJECTED" }),
      facts({ source: "coverage-repair", triage: { items: [{ decision: "requires_user_decision" }] }, repair: repairAudit() }),
      facts({ source: "coverage-repair", triage: { items: [{ decision: "apply" }] }, repair: repairAudit({ audit: { envelopeErrors: ["invalid"], baseRevisionMatches: true, missingRequiredTargets: [], lifecycleIssues: [] } }) }),
      facts({ source: "coverage-repair", triage: { items: [{ decision: "apply" }] }, repair: repairAudit({ audit: { envelopeErrors: [], baseRevisionMatches: false, missingRequiredTargets: [], lifecycleIssues: [] } }) }),
      facts({ source: "coverage-repair", triage: { items: [{ decision: "apply" }] }, repair: repairAudit({ audit: { envelopeErrors: [], baseRevisionMatches: true, missingRequiredTargets: [{ path: "goal" }], lifecycleIssues: [] } }) }),
    ];

    for (const candidate of cases) {
      assert.equal(resolveDraftCompletionConnector(candidate), null);
    }
  });

  it("binds connector application to the exact canonical draft revision", () => {
    const source = draft();
    const connector = resolveDraftCompletionConnector(facts({ draftDocument: source }));
    const changed = { ...source, goal: "A different canonical draft." };

    assert.throws(
      () => connector.applyTo(changed),
      /draft revision/i,
    );
    assert.equal(digest(connector.toJSON()).length, 64);
  });

  it("publishes completion, catalog provenance, and repair-to-gate promotion in one replay-safe transaction", () => {
    const repository = createTmpDir("draft-completion-connector-");
    const specId = "715f-draft-completion";
    const flowManager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    try {
      const fixture = new CanonicalFlowFixture({ flowManager, specId, runId: "715f-run" });
      fixture.create().registerActive().activate("draft");
      const source = draft();
      const sourceBytes = Buffer.from(`${JSON.stringify(source, null, 2)}\n`, "utf8");
      flowManager.publishArtifacts({
        specId,
        nodeId: "draft",
        artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: sourceBytes }],
      });
      flowManager.confirmCurrentAttempt({ specId });
      fixture.activate("draft-coverage-repair");
      const selected = resolveDraftCoverageRepairCompletion(facts({ draftDocument: source }));
      const before = flowManager.activityLedger(specId).length;
      flowManager.confirmDraftCoverageRepairCompletion({ specId, decision: selected, draft: source });

      const state = flowManager.loadReadOnly(specId);
      const ledger = flowManager.activityLedger(specId);
      const published = flowManager.readArtifact({
        specId, logicalKey: "draft", consumerNodeId: "draft-gate",
      });
      assert.equal(JSON.parse(published.bytes.toString("utf8")).approval.approved, true);
      assert.equal(findStepById(state.steps, "draft-coverage-repair").status, "done");
      assert.equal(state.currentNodeId, null);
      assert.equal(flowManager.canonicalState(specId).nextAction().nodeId, "draft-gate");
      assert.equal(ledger.length, before + 1);
      assert.equal(published.descriptor.activityId, ledger.at(-1).id);
      assert.equal(ledger.at(-1).result.artifactRefs.at(-1).kind, "draft-completion-connector");

      flowManager.confirmDraftCoverageRepairCompletion({ specId, decision: selected, draft: source });
      assert.equal(flowManager.activityLedger(specId).length, ledger.length);
    } finally {
      removeTmpDir(repository);
    }
  });

  it("publishes a repaired draft, its audit, and completion together when repair facts are eligible", () => {
    const repository = createTmpDir("draft-completion-repair-");
    const specId = "715f-draft-completion-repair";
    const flowManager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    try {
      const fixture = new CanonicalFlowFixture({ flowManager, specId, runId: "715f-repair-run" });
      fixture.create().registerActive().activate("draft");
      const source = draft();
      const sourceBytes = Buffer.from(`${JSON.stringify(source, null, 2)}\n`, "utf8");
      flowManager.publishArtifacts({
        specId,
        nodeId: "draft",
        artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: sourceBytes }],
      });
      flowManager.confirmCurrentAttempt({ specId });
      fixture.activate("draft-coverage-repair");
      const repaired = { ...source, goal: "Repaired canonical coverage goal." };
      const audit = repairAudit({
        acceptedOperations: [{ path: "goal" }],
        operationDigest: "e".repeat(64),
      });
      const selected = resolveDraftCoverageRepairCompletion(facts({
        source: "coverage-repair",
        draftDocument: repaired,
        canonicalDigest: crypto.createHash("sha256").update(sourceBytes).digest("hex"),
        canonicalByteLength: sourceBytes.length,
        reviewVerdict: "REJECTED",
        triage: { items: [{ decision: "apply" }] },
        repair: audit,
      }));
      flowManager.confirmDraftCoverageRepairCompletion({
        specId,
        decision: selected,
        draft: repaired,
        artifactBaselines: [{
          logicalKey: "draft",
          digest: crypto.createHash("sha256").update(sourceBytes).digest("hex"),
          byteLength: sourceBytes.length,
        }],
        artifactWrites: [{
          logicalKey: "draft.coverage.repair",
          mediaType: "application/json",
          bytes: Buffer.from(`${JSON.stringify(audit, null, 2)}\n`, "utf8"),
        }],
      });

      const published = JSON.parse(flowManager.readArtifact({
        specId, logicalKey: "draft", consumerNodeId: "draft-gate",
      }).bytes.toString("utf8"));
      const repairPublication = flowManager.readArtifact({
        specId, logicalKey: "draft.coverage.repair", consumerNodeId: "draft-gate",
      });
      const activity = flowManager.activityLedger(specId).at(-1);
      assert.equal(published.goal, repaired.goal);
      assert.equal(published.approval.approved, true);
      assert.equal(repairPublication.descriptor.activityId, activity.id);
      assert.equal(activity.result.artifactRefs.at(-1).kind, "draft-completion-connector");
    } finally {
      removeTmpDir(repository);
    }
  });

  it("rejects a stale selected canonical revision without completing repair", () => {
    const repository = createTmpDir("draft-completion-stale-");
    const specId = "715f-draft-completion-stale";
    const flowManager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    try {
      const fixture = new CanonicalFlowFixture({ flowManager, specId, runId: "715f-stale-run" });
      fixture.create().registerActive().activate("draft");
      const source = draft();
      flowManager.publishArtifacts({
        specId,
        nodeId: "draft",
        artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: Buffer.from(`${JSON.stringify(source, null, 2)}\n`) }],
      });
      flowManager.confirmCurrentAttempt({ specId });
      fixture.settleBefore("draft-coverage-repair");
      const stale = resolveDraftCoverageRepairCompletion(facts({
        draftDocument: source,
        canonicalDigest: "f".repeat(64),
      }));
      const before = flowManager.activityLedger(specId).length;

      assert.throws(
        () => flowManager.confirmDraftCoverageRepairCompletion({ specId, decision: stale, draft: source }),
        /stale canonical draft revision/i,
      );
      assert.equal(flowManager.activityLedger(specId).length, before);
      assert.equal(findStepById(flowManager.loadReadOnly(specId).steps, "draft-coverage-repair").status, "pending");
      assert.equal(flowManager.loadReadOnly(specId).currentNodeId, null);
    } finally {
      removeTmpDir(repository);
    }
  });
});
