import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PlanGateRepairLocation,
  PlanGateRepairRecord,
  planGateRepairRouteForPhase,
  planGateRepairRouteForTargetStep,
} from "../../../src/flow/lib/plan-gate-repair.js";
import RunRepairPlanGateCommand from "../../../src/flow/lib/run-repair-plan-gate.js";

const SOURCE = Object.freeze({
  issueLogId: "draft-gate-blocking-evidence",
  step: "draft-gate",
  phase: "draft",
  reason: "A retained behavior is absent.",
  observations: [{
    kind: "violation",
    failureMode: "guardrail-violation",
    requirementRef: "R1",
    where: { file: "spec.json" },
    observed: "The required behavior is absent.",
    severity: "blocking",
    refs: ["R1"],
  }],
  timestamp: "2026-08-05T00:00:00.000Z",
});

function record() {
  return PlanGateRepairRecord.create({
    state: { runId: "run-plan-repair", specId: "001-test", issue: 7 },
    phase: "draft",
    issueLogEntry: SOURCE,
    requestedAt: "2026-08-05T00:01:00.000Z",
  });
}

describe("canonical plan-gate repair values", () => {
  it("normalizes a document-level observation without inventing a locator", () => {
    const location = new PlanGateRepairLocation({ file: "spec.json", locator: null });
    assert.deepEqual(location.toJSON(), { file: "spec.json" });
    assert.deepEqual(record().observations[0].where.toJSON(), { file: "spec.json" });
  });

  it("preserves a process observation without a file location", () => {
    const value = PlanGateRepairRecord.create({
      state: { runId: "run-plan-repair", specId: "001-test", issue: 7 },
      phase: "draft",
      issueLogEntry: {
        ...SOURCE,
        observations: [{ ...SOURCE.observations[0], where: null }],
      },
      requestedAt: "2026-08-05T00:01:00.000Z",
    });

    assert.equal(value.observations[0].where, null);
    assert.equal(value.toJSON().observations[0].where, null);
    assert.equal(PlanGateRepairRecord.from(value.toJSON()).observations[0].where, null);
  });

  it("uses fixed definition-authorized rewind routes", () => {
    assert.deepEqual(planGateRepairRouteForPhase("draft").resetStepIds, [
      "draft-refine",
      "draft-coverage-review",
      "draft-coverage-triage",
      "draft-coverage-repair",
      "draft-gate",
    ]);
    assert.equal(planGateRepairRouteForPhase("spec").targetStepId, "spec");
    assert.equal(planGateRepairRouteForPhase("test").targetStepId, "test");
    assert.equal(planGateRepairRouteForTargetStep("draft-refine").phase, "draft");
    assert.equal(planGateRepairRouteForTargetStep("unknown"), null);
  });

  it("binds immutable source evidence to a stable Activity/idempotency identity", () => {
    const value = record();
    assert.match(value.sourceEntryDigest, /^[a-f0-9]{64}$/);
    assert.match(value.idempotencyKey, /^plan-gate-repair-[a-f0-9]{64}$/);
    assert.deepEqual(value.activityReference(), {
      id: value.idempotencyKey,
      label: SOURCE.issueLogId,
    });
    assert.equal(value.matchesIssueLogEntry(SOURCE), true);
    assert.equal(value.matchesIssueLogEntry({ ...SOURCE, reason: "changed" }), false);
  });

  it("appends one typed catalog issue-log entry idempotently", () => {
    const value = record();
    const first = value.appendToIssueLog({ entries: [SOURCE] });
    const second = value.appendToIssueLog(first);

    assert.equal(first.entries.length, 2);
    assert.deepEqual(second, first);
    assert.equal(PlanGateRepairRecord.fromIssueLogEntry(first.entries[1]).idempotencyKey, value.idempotencyKey);
  });

  it("fails closed when the source contains no blocking observation", () => {
    assert.throws(() => PlanGateRepairRecord.create({
      state: { runId: "run-plan-repair", specId: "001-test", issue: null },
      phase: "draft",
      issueLogEntry: { ...SOURCE, observations: [{ ...SOURCE.observations[0], severity: "advisory" }] },
    }), /requires blocking observations/);
  });

  it("rejects a retired mutable Flow before any repair side effect", () => {
    const result = new RunRepairPlanGateCommand().execute({
      flowState: { specId: "legacy", steps: [] },
      flowManager: {},
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "CANONICAL_FLOW_REQUIRED");
  });
});
