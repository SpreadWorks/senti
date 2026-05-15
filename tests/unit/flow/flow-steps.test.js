/**
 * tests/unit/flow/flow-steps.test.js
 *
 * Tests for FLOW_STEPS ordering and PHASE_MAP after the plan rework.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FLOW_STEPS, PHASE_MAP } from "../../../src/lib/flow-helpers.js";
import { FLOW_DEFINITION, resolveNodeFor } from "../../../src/flow/definition.js";
describe("FLOW_STEPS ordering (plan rework)", () => {
  it("has split draft review and spec repair before their gates", () => {
    const first15 = FLOW_STEPS.slice(0, 15);
    assert.deepEqual(first15, [
      "branch", "prepare-spec", "draft", "review-draft-questions", "draft-refine", "review-draft-coverage", "gate-draft",
      "spec", "review-spec", "spec-review-triage", "spec-repair", "gate", "approval", "test", "review-test",
    ]);
  });

  it("does not contain approach (removed in spec 178)", () => {
    assert.ok(!FLOW_STEPS.includes("approach"), "approach should be removed");
  });

  it("does not contain fill-spec (renamed to spec)", () => {
    assert.ok(!FLOW_STEPS.includes("fill-spec"), "fill-spec should be removed");
  });

  it("does not have spec before prepare-spec", () => {
    const prepIdx = FLOW_STEPS.indexOf("prepare-spec");
    const specIdx = FLOW_STEPS.indexOf("spec");
    assert.ok(prepIdx < specIdx, "prepare-spec should come before spec");
  });

  it("keeps draft question review one-shot in manual and auto modes", () => {
    const node = resolveNodeFor(FLOW_DEFINITION, "review-draft-questions");

    assert.equal(node.resolveMaxAttempts({ autoApprove: true }), 1);
    assert.equal(node.resolveMaxAttempts({ autoApprove: false }), 1);
  });

  it("keeps draft coverage review one-shot in manual and auto modes", () => {
    const node = resolveNodeFor(FLOW_DEFINITION, "review-draft-coverage");

    assert.equal(node.resolveMaxAttempts({ autoApprove: true }), 1);
    assert.equal(node.resolveMaxAttempts({ autoApprove: false }), 1);
  });

  it("keeps spec review one-shot in manual and auto modes", () => {
    const node = resolveNodeFor(FLOW_DEFINITION, "review-spec");

    assert.equal(node.resolveMaxAttempts({ autoApprove: true }), 1);
    assert.equal(node.resolveMaxAttempts({ autoApprove: false }), 1);
  });

  it("has gate before approval", () => {
    const gateIdx = FLOW_STEPS.indexOf("gate");
    const approvalIdx = FLOW_STEPS.indexOf("approval");
    assert.ok(gateIdx < approvalIdx, "gate should come before approval");
  });
});

describe("PHASE_MAP (plan rework)", () => {
  it("maps prepare-spec to plan phase", () => {
    assert.equal(PHASE_MAP["prepare-spec"], "plan");
  });

  it("maps spec to plan phase", () => {
    assert.equal(PHASE_MAP["spec"], "plan");
  });

  it("maps spec-repair to plan phase", () => {
    assert.equal(PHASE_MAP["spec-repair"], "plan");
  });

  it("maps spec-review-triage to plan phase", () => {
    assert.equal(PHASE_MAP["spec-review-triage"], "plan");
  });

  it("maps gate to plan phase", () => {
    assert.equal(PHASE_MAP["gate"], "plan");
  });

  it("maps approval to plan phase", () => {
    assert.equal(PHASE_MAP["approval"], "plan");
  });
});
