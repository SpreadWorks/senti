/**
 * tests/unit/lib/flow-state-agent-metrics.test.js
 *
 * Tests for `makeFlowManager().accumulateAgentMetrics()` in flow-state.js.
 * Verifies that agent call metrics (tokens, cost, callCount, responseChars, model)
 * are correctly accumulated into flow.json metrics per phase.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
function makeUsage({ input = 100, output = 50, cacheRead = 20, cacheCreation = 10, cost = 0.005 } = {}) {
  return {
    input_tokens: input,
    output_tokens: output,
    cache_read_tokens: cacheRead,
    cache_creation_tokens: cacheCreation,
    cost_usd: cost,
  };
}

describe("accumulateAgentMetrics", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlow(dir, phase = "draft") {
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: buildInitialSteps(),
    };
    // Set the given phase to in_progress
    const step = state.steps.find((s) => s.id === phase);
    if (step) step.status = "in_progress";
    makeFlowManager(dir).save(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
  }

  it("accumulates token counts, cost, callCount, responseChars, and model on happy path", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");

    const usage = makeUsage();
    makeFlowManager(tmp).accumulateAgentMetrics("draft", { usage, responseChars: 1500, model: "claude-sonnet-4-6" });

    const loaded = makeFlowManager(tmp).load();
    const m = loaded.metrics.draft;
    assert.equal(m.tokens.input, 100);
    assert.equal(m.tokens.output, 50);
    assert.equal(m.tokens.cacheRead, 20);
    assert.equal(m.tokens.cacheCreation, 10);
    assert.equal(m.cost, 0.005);
    assert.equal(m.callCount, 1);
    assert.equal(m.responseChars, 1500);
    assert.equal(m.models["claude-sonnet-4-6"], 1);
  });

  it("skips cost accumulation when cost_usd is null, records other fields", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "spec");

    const usage = makeUsage({ cost: null });
    makeFlowManager(tmp).accumulateAgentMetrics("spec", { usage, responseChars: 800, model: "gpt-5-codex" });

    const loaded = makeFlowManager(tmp).load();
    const m = loaded.metrics.spec;
    assert.equal(m.tokens.input, 100);
    assert.equal(m.tokens.output, 50);
    assert.equal(m.callCount, 1);
    assert.equal(m.responseChars, 800);
    assert.equal(m.models["gpt-5-codex"], 1);
    // cost should not be set (or remain 0 / undefined)
    assert.ok(!m.cost, "cost should not be set when cost_usd is null");
  });

  it("accumulates additively across multiple calls (not overwrite)", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");

    makeFlowManager(tmp).accumulateAgentMetrics("draft", { usage: makeUsage({ input: 100, output: 50, cost: 0.005 }), responseChars: 1000, model: "claude-sonnet-4-6" });
    makeFlowManager(tmp).accumulateAgentMetrics("draft", { usage: makeUsage({ input: 200, output: 80, cost: 0.010 }), responseChars: 2000, model: "claude-sonnet-4-6" });

    const loaded = makeFlowManager(tmp).load();
    const m = loaded.metrics.draft;
    assert.equal(m.tokens.input, 300);
    assert.equal(m.tokens.output, 130);
    assert.equal(m.callCount, 2);
    assert.equal(m.responseChars, 3000);
    assert.ok(Math.abs(m.cost - 0.015) < 0.0001, "cost should be summed");
    assert.equal(m.models["claude-sonnet-4-6"], 2);
  });

  it("initializes nested structure correctly on first call (no prior metrics)", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "gate");

    const usage = makeUsage();
    makeFlowManager(tmp).accumulateAgentMetrics("gate", { usage, responseChars: 500, model: "claude-opus-4-6" });

    const loaded = makeFlowManager(tmp).load();
    assert.ok(loaded.metrics, "metrics should be initialized");
    assert.ok(loaded.metrics.gate, "phase key should be initialized");
    assert.ok(loaded.metrics.gate.tokens, "tokens object should be initialized");
  });

  it("records different models separately in models map", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "impl");

    makeFlowManager(tmp).accumulateAgentMetrics("impl", { usage: makeUsage({ cost: null }), responseChars: 500, model: "claude-sonnet-4-6" });
    makeFlowManager(tmp).accumulateAgentMetrics("impl", { usage: makeUsage({ cost: null }), responseChars: 400, model: "gpt-5-codex" });
    makeFlowManager(tmp).accumulateAgentMetrics("impl", { usage: makeUsage({ cost: null }), responseChars: 300, model: "claude-sonnet-4-6" });

    const loaded = makeFlowManager(tmp).load();
    const models = loaded.metrics.impl.models;
    assert.equal(models["claude-sonnet-4-6"], 2);
    assert.equal(models["gpt-5-codex"], 1);
  });

  it("does not modify existing non-token metrics (e.g. question counter)", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");

    // Pre-set an existing counter
    const state = makeFlowManager(tmp).load();
    state.metrics = { draft: { question: 5, srcRead: 2 } };
    makeFlowManager(tmp).save(state);

    makeFlowManager(tmp).accumulateAgentMetrics("draft", { usage: makeUsage(), responseChars: 1000, model: "claude-sonnet-4-6" });

    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.metrics.draft.question, 5, "existing question counter should be unchanged");
    assert.equal(loaded.metrics.draft.srcRead, 2, "existing srcRead counter should be unchanged");
    assert.equal(loaded.metrics.draft.callCount, 1, "callCount should be added");
  });

  it("silently no-ops when phase is null (no active flow)", () => {
    tmp = createTmpDir();
    // No flow state created — simulates being outside any flow
    // Should not throw
    assert.doesNotThrow(() => {
      makeFlowManager(tmp).accumulateAgentMetrics(null, { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6" });
    });
  });

  // ─── Spec 191: durationMs accumulation (R1, R2) ─────────────────────────────

  it("accumulates durationMs when provided (spec 191 R2)", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");

    makeFlowManager(tmp).accumulateAgentMetrics("draft", { usage: makeUsage(), responseChars: 1000, model: "claude-sonnet-4-6", durationMs: 1234 });

    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.metrics.draft.durationMs, 1234);
  });

  it("sums durationMs additively across multiple calls", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");

    const fm = makeFlowManager(tmp);
    fm.accumulateAgentMetrics("draft", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6", durationMs: 1000 });
    fm.accumulateAgentMetrics("draft", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6", durationMs: 2500 });
    fm.accumulateAgentMetrics("draft", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6", durationMs: 800 });

    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.metrics.draft.durationMs, 4300);
  });

  it("skips durationMs accumulation when phase is null", () => {
    tmp = createTmpDir();
    // no flow state
    assert.doesNotThrow(() => {
      makeFlowManager(tmp).accumulateAgentMetrics(null, { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6", durationMs: 2000 });
    });
  });

  it("treats missing/nullish durationMs as 0 (does not pollute existing total)", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "spec");

    const fm = makeFlowManager(tmp);
    fm.accumulateAgentMetrics("spec", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6", durationMs: 1500 });
    // Call without durationMs should leave total unchanged
    fm.accumulateAgentMetrics("spec", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6" });

    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.metrics.spec.durationMs, 1500);
  });
});
