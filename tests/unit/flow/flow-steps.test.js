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
  it("has draft review triage and repair steps before their consumers", () => {
    assertStepsAppearInOrder(
      "review-draft-questions",
      "draft-questions-triage",
      "draft-questions-repair",
      "draft-refine",
    );
    assertStepsAppearInOrder(
      "review-draft-coverage",
      "draft-coverage-triage",
      "draft-coverage-repair",
      "gate-draft",
    );
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

function assertStepsAppearInOrder(...stepIds) {
  const indexes = stepIds.map((stepId) => {
    const index = FLOW_STEPS.indexOf(stepId);
    assert.notEqual(index, -1, `${stepId} must exist`);
    return index;
  });
  for (let i = 1; i < indexes.length; i += 1) {
    assert.ok(
      indexes[i - 1] < indexes[i],
      `${stepIds[i - 1]} must appear before ${stepIds[i]}`,
    );
  }
}

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
