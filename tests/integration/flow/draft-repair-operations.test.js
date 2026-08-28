import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyDraftRepairOperations,
  DraftRepairOperationBatch,
  DraftRepairPath,
} from "../../../src/flow/lib/draft-repair-operations.js";
import { checkDraftJson } from "../../../src/flow/lib/run-gate.js";
import { workerArtifactHandoffPolicy } from "../../../src/flow/lib/worker-artifact-handoff.js";

const INPUT_REVISION = "a".repeat(64);

function digest(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function draft() {
  return {
    devType: "feature", goal: "Original goal", unrelated: "must survive",
    analysis: { problem: "Original problem", proposedApproach: "Original approach", validation: "Original validation" },
    decisionMap: { knownFacts: [], decisionPoints: [], resolvedByProjectRules: [], requiresUserJudgment: [], deferredToSpec: [] },
    questionLedger: { revision: 0, publication: "test", evidenceDigest: "b".repeat(64), questions: [] },
    approval: { approved: true },
  };
}
function triage({ allowedFieldPaths = ["goal"], requiredFieldPaths = ["goal"] } = {}) {
  return { items: [{ title: "Repair goal", target: "goal", decision: "apply", rationale: "Bounded correction", evidence: "Goal is incomplete", allowedFieldPaths, requiredFieldPaths }] };
}
function operation(overrides = {}) {
  return {
    title: "Repair goal", target: "goal", kind: "replace-value", path: "goal",
    expectedDigest: digest("Original goal"), replacement: "Corrected goal", reason: "Apply the bounded correction.",
    ...overrides,
  };
}
function repair(operations, baseRevision = `sha256:${INPUT_REVISION}`) { return { version: 1, baseRevision, operations }; }
function apply(input = {}) {
  return applyDraftRepairOperations({ draft: input.draft ?? draft(), triage: input.triage ?? triage(), repair: input.repair ?? repair([]), inputRevision: INPUT_REVISION, phase: "draft-coverage-repair" });
}
function prompt(name) {
  return fs.readFileSync(fileURLToPath(new URL(`../../../src/flow/prompts/plan/${name}.md`, import.meta.url)), "utf8");
}

describe("command-owned draft repair operations", () => {
  it("keeps repair workers on an operations-only handoff and prompt contract", () => {
    for (const stepId of ["draft-questions-repair", "draft-coverage-repair"]) {
      const policy = workerArtifactHandoffPolicy(stepId);
      assert.deepEqual(policy.payloads.map((payload) => payload.logicalName), [`${stepId}.json`]);
    }
  });

  it("parses only bounded data paths and v1 proposal envelopes", () => {
    assert.deepEqual(new DraftRepairPath("questionLedger.questions[0].question").segments, ["questionLedger", "questions", 0, "question"]);
    assert.throws(() => new DraftRepairPath("approval.__proto__.approved"));
    assert.ok(new DraftRepairOperationBatch(repair([])));
    const malformed = new DraftRepairOperationBatch({ version: 2, baseRevision: "wrong", operations: [] });
    assert.equal(malformed.envelopeErrors.length, 2);
  });

  it("audits malformed and empty envelopes without changing the canonical draft", () => {
    const source = draft();
    const malformed = apply({
      draft: source,
      repair: { version: 2, baseRevision: `sha256:${INPUT_REVISION}`, operations: [operation()] },
    });
    assert.deepEqual(malformed.draft, source);
    assert.equal(malformed.audit.acceptedOperations.length, 0);
    assert.deepEqual(malformed.audit.audit.envelopeErrors, ["draft repair version is invalid"]);
    assert.equal(malformed.audit.discardedOperations[0].reason, "invalid repair envelope");

    const empty = apply({ draft: source, repair: repair([]) });
    assert.deepEqual(empty.draft, source);
    assert.equal(empty.audit.acceptedOperations.length, 0);
    assert.deepEqual(empty.audit.audit.envelopeErrors, []);

    const nonObject = apply({ draft: source, repair: [] });
    assert.deepEqual(nonObject.draft, source);
    assert.deepEqual(nonObject.audit.audit.envelopeErrors, [
      "draft repair version is invalid",
      "draft repair baseRevision is invalid",
      "draft repair operations are invalid",
    ]);

    const invalidBase = apply({
      draft: source,
      repair: { version: 1, baseRevision: "wrong", operations: [operation()] },
    });
    assert.deepEqual(invalidBase.draft, source);
    assert.deepEqual(invalidBase.audit.audit.envelopeErrors, ["draft repair baseRevision is invalid"]);
  });

  it("reconstructs from the immutable draft and preserves unrelated fields", () => {
    const source = draft();
    const result = apply({ draft: source, repair: repair([operation()]) });
    assert.equal(result.draft.goal, "Corrected goal");
    assert.equal(result.draft.unrelated, "must survive");
    assert.deepEqual(result.draft.analysis, source.analysis);
    assert.equal(source.goal, "Original goal");
  });

  it("filters unknown and out-of-scope proposals without suppressing a valid operation", () => {
    const result = apply({ repair: repair([
      operation({ title: "Unknown", target: "other" }),
      operation({ path: "approval.approved" }),
      operation(),
      operation({ kind: "unknown-operation" }),
    ]) });
    assert.equal(result.draft.goal, "Corrected goal");
    assert.equal(result.audit.acceptedOperations.length, 1);
    assert.equal(result.audit.discardedOperations.length, 3);
    assert.ok(result.audit.discardedOperations.every((entry) => entry.reason));
  });

  it("rejects approval operations from both repair routes even when triage grants them", () => {
    const source = draft();
    source.approval = { approved: false };
    const approvalTriage = triage({ allowedFieldPaths: ["approval.approved"], requiredFieldPaths: ["approval.approved"] });
    const approvalOperation = operation({
      path: "approval.approved",
      expectedDigest: digest(false),
      replacement: true,
    });
    for (const phase of ["draft-questions-repair", "draft-coverage-repair"]) {
      const result = applyDraftRepairOperations({
        draft: source,
        triage: approvalTriage,
        repair: repair([approvalOperation]),
        inputRevision: INPUT_REVISION,
        phase,
      });
      assert.deepEqual(result.draft, source);
      assert.equal(result.audit.acceptedOperations.length, 0);
      assert.equal(result.audit.discardedOperations[0].reason, "gate-owned approval field");
      assert.deepEqual(result.audit.audit.missingRequiredTargets, [{ key: "Repair goal\u0000goal", path: "approval.approved" }]);
      assert.ok(result.audit.audit.lifecycleIssues.some((issue) => issue.includes("approval")));
      assert.ok(checkDraftJson(result.draft).some((issue) => issue.includes("approval")));
    }
  });

  it("keeps coverage triage and repair outside draft-gate approval ownership", () => {
    const triagePrompt = prompt("draft-coverage-triage");
    const repairPrompt = prompt("draft-coverage-repair");
    assert.match(triagePrompt, /approval is owned exclusively by `draft-gate`/);
    assert.match(triagePrompt, /never use `apply` to set approval automatically/);
    assert.match(repairPrompt, /Never set or rewrite approval: it is owned exclusively by `draft-gate`/);
    assert.doesNotMatch(triagePrompt, /"approval\.approved"/);
    assert.doesNotMatch(repairPrompt, /"approval\.approved"/);
  });

  it("keeps the canonical draft when no valid operation can apply and records the audit", () => {
    const source = draft();
    const result = apply({ draft: source, repair: repair([operation({ expectedDigest: digest("stale") })]) });
    assert.deepEqual(result.draft, source);
    assert.equal(result.audit.acceptedOperations.length, 0);
    assert.equal(result.audit.discardedOperations[0].reason, "stale target");
    assert.deepEqual(result.audit.audit.missingRequiredTargets, [{ key: "Repair goal\u0000goal", path: "goal" }]);
  });

  it("retains lifecycle validation findings for draft-gate instead of hiding an incomplete canonical draft", () => {
    const source = draft();
    source.approval = { approved: false };
    delete source.questionLedger.questions;
    const result = apply({ draft: source, repair: repair([]) });
    assert.deepEqual(result.draft, source);
    assert.ok(result.audit.audit.lifecycleIssues.some((issue) => issue.includes("approval")));
    assert.ok(result.audit.audit.lifecycleIssues.some((issue) => issue.includes("questions")));
    assert.ok(checkDraftJson(result.draft).some((issue) => issue.includes("approval")));
    assert.ok(checkDraftJson(result.draft).some((issue) => issue.includes("questions")));
  });
});
