import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DeferredDisposition,
  FindingDispositionPolicy,
  InformationalDisposition,
  MustFixDisposition,
} from "../../../src/flow/lib/finding-disposition-policy.js";

const FINGERPRINT = "a".repeat(64);

function finding(overrides = {}) {
  return {
    findingId: "review-R1",
    fingerprint: FINGERPRINT,
    category: "maintainability",
    requirementId: "R1",
    rationale: "The finding is tied to the mandatory R1 behavior.",
    ...overrides,
  };
}

describe("FindingDispositionPolicy", () => {
  it("classifies findings tied to must requirements and blocking guardrails as must-fix", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });

    const requirementDisposition = policy.classify({
      finding: finding(),
      requirement: { id: "R1", priority: "must" },
      guardrail: null,
      repeatCount: 1,
    });
    const guardrailDisposition = policy.classify({
      finding: finding({ requirementId: null }),
      requirement: null,
      guardrail: { id: "project-oop", severity: "blocking" },
      repeatCount: 1,
    });

    assert.ok(requirementDisposition instanceof MustFixDisposition);
    assert.ok(guardrailDisposition instanceof MustFixDisposition);
    assert.equal(requirementDisposition.fingerprint, FINGERPRINT);
    assert.equal(requirementDisposition.rationale, finding().rationale);
    assert.equal(requirementDisposition.requiresRepair(), true);
  });

  it("keeps informational findings out of the repair loop", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const disposition = policy.classify({
      finding: finding({
        category: "naming",
        requirementId: null,
        rationale: "The name is readable and no requirement or guardrail mandates a change.",
      }),
      requirement: null,
      guardrail: null,
      repeatCount: 1,
    });

    assert.ok(disposition instanceof InformationalDisposition);
    assert.equal(disposition.requiresRepair(), false);
  });

  it("turns the repeated fingerprint into an explicit deferred disposition at the bound", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const disposition = policy.classify({
      finding: finding(),
      requirement: { id: "R1", priority: "must" },
      guardrail: null,
      repeatCount: 3,
    });

    assert.ok(disposition instanceof DeferredDisposition);
    assert.equal(disposition.fingerprint, FINGERPRINT);
    assert.equal(disposition.requiresRepair(), false);
  });

  it("rejects a finding whose rationale is missing", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const input = finding();
    delete input.rationale;

    assert.throws(
      () => policy.classify({
        finding: input,
        requirement: { id: "R1", priority: "must" },
        guardrail: null,
        repeatCount: 1,
      }),
      /rationale.*required|rationale.*non-empty/i,
    );
  });

  it("blocks authoritative must-fix findings until exact scoped repair evidence exists", () => {
    const policy = new FindingDispositionPolicy({ maxOccurrences: 3 });
    const mustFix = {
      ...finding(),
      findingId: FINGERPRINT,
      disposition: "must-fix",
      repeatCount: 1,
    };

    const missing = policy.evaluateGate({
      findings: [mustFix],
      issueLogEntries: [],
      phase: "integration",
    });
    assert.equal(missing.allowsPass(), false);
    assert.match(missing.issues[0], /missing matching repair evidence/);

    const repaired = policy.evaluateGate({
      findings: [mustFix],
      issueLogEntries: [{
        step: "impl-review",
        normalizedFindingId: FINGERPRINT,
        repairRef: { files: ["src/flow/lib/run-gate.js"] },
        taskId: null,
        timestamp: "2026-07-19T00:00:00.000Z",
      }],
      phase: "integration",
    });
    assert.equal(repaired.allowsPass(), true);

    const wrongTask = policy.evaluateGate({
      findings: [mustFix],
      issueLogEntries: [{
        step: "task-review",
        normalizedFindingId: FINGERPRINT,
        repairRef: { files: ["src/flow/lib/run-gate.js"] },
        taskId: "T-2",
        timestamp: "2026-07-19T00:00:00.000Z",
      }],
      phase: "task-impl",
      taskId: "T-1",
    });
    assert.equal(wrongTask.allowsPass(), false);
  });
});
