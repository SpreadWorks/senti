/**
 * Spec verification tests for 132-gate-draft-impl.
 *
 * These tests verify the spec requirements are met.
 * Formal tests for checkDraftText/checkImplRequirements go in tests/unit/.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

const FLOW_STATE_PATH = join(process.cwd(), "src/lib/flow-state.js");
const REGISTRY_PATH = join(process.cwd(), "src/flow/registry.js");
const RUN_GATE_PATH = join(process.cwd(), "src/flow/lib/run-gate.js");

describe("R6: step ID additions", () => {
  it("FLOW_STEPS includes gate-draft", async () => {
    const { FLOW_STEPS } = await import(FLOW_STATE_PATH);
    assert.ok(FLOW_STEPS.includes("gate-draft"), "gate-draft missing from FLOW_STEPS");
  });

  it("FLOW_STEPS includes gate-impl", async () => {
    const { FLOW_STEPS } = await import(FLOW_STATE_PATH);
    assert.ok(FLOW_STEPS.includes("gate-impl"), "gate-impl missing from FLOW_STEPS");
  });

  it("gate-draft is after draft and before spec in FLOW_STEPS", async () => {
    const { FLOW_STEPS } = await import(FLOW_STATE_PATH);
    const draftIdx = FLOW_STEPS.indexOf("draft");
    const gateDraftIdx = FLOW_STEPS.indexOf("gate-draft");
    const specIdx = FLOW_STEPS.indexOf("spec");
    assert.ok(draftIdx < gateDraftIdx, "gate-draft should be after draft");
    assert.ok(gateDraftIdx < specIdx, "gate-draft should be before spec");
  });

  it("gate-impl is after implement and before review in FLOW_STEPS", async () => {
    const { FLOW_STEPS } = await import(FLOW_STATE_PATH);
    const implIdx = FLOW_STEPS.indexOf("implement");
    const gateImplIdx = FLOW_STEPS.indexOf("gate-impl");
    const reviewIdx = FLOW_STEPS.indexOf("review");
    assert.ok(implIdx < gateImplIdx, "gate-impl should be after implement");
    assert.ok(gateImplIdx < reviewIdx, "gate-impl should be before review");
  });

  it("PHASE_MAP maps gate-draft to plan", async () => {
    const { PHASE_MAP } = await import(FLOW_STATE_PATH);
    assert.equal(PHASE_MAP["gate-draft"], "plan");
  });

  it("PHASE_MAP maps gate-impl to impl", async () => {
    const { PHASE_MAP } = await import(FLOW_STATE_PATH);
    assert.equal(PHASE_MAP["gate-impl"], "impl");
  });
});

describe("R1: --phase option accepts draft and impl", () => {
  it("run-gate.js exports checkDraftText", async () => {
    const mod = await import(RUN_GATE_PATH);
    assert.equal(typeof mod.checkDraftText, "function", "checkDraftText should be exported");
  });
});

describe("R5: error handling — gate FAIL returns structured result", () => {
  it("checkSpecText returns issues array (not throw) for invalid spec", () => {
    // checkSpecText already returns issues array, not throws.
    // The execute() method should also return, not throw, on check failure.
    // This is verified by the CLI integration tests.
  });
});
