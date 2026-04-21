/**
 * tests/unit/lib/flow-state-agent-metrics.test.js
 *
 * Tests for `accumulateAgentMetrics()` — appends one agent-kind entry per call
 * to the flat `state.metrics` array (cac6/T10). Aggregation is done at read
 * time via `buildMetricsSummary`.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager, makeFlowState } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildMetricsSummary } from "../../../src/flow/lib/get-status.js";

function makeUsage({ input = 100, output = 50, cacheRead = 20, cacheCreation = 10, cost = 0.005 } = {}) {
  return {
    input_tokens: input,
    output_tokens: output,
    cache_read_tokens: cacheRead,
    cache_creation_tokens: cacheCreation,
    cost_usd: cost,
  };
}

function setupFlow(dir, phase = "draft") {
  const specId = "001-test";
  const state = makeFlowState({ spec: `specs/${specId}/spec.md` });
  const step = state.steps.find((s) => s.id === phase);
  if (step) step.status = "in_progress";
  makeFlowManager(dir).save(state);
  makeFlowManager(dir).addActiveFlow(specId, "local");
}

function agentEntries(metrics) {
  return (metrics || []).filter((e) => e.kind === "agent");
}

describe("accumulateAgentMetrics (flat append)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("appends one entry per call with tokens, cost, callCount, responseChars, model", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");
    makeFlowManager(tmp).accumulateAgentMetrics("draft", {
      usage: makeUsage(),
      responseChars: 1500,
      model: "claude-sonnet-4-6",
    });
    const entries = agentEntries(makeFlowManager(tmp).load().metrics);
    assert.equal(entries.length, 1);
    const e = entries[0];
    assert.equal(e.phase, "draft");
    assert.equal(e.tokens.input, 100);
    assert.equal(e.tokens.output, 50);
    assert.equal(e.tokens.cacheRead, 20);
    assert.equal(e.tokens.cacheCreation, 10);
    assert.equal(e.cost, 0.005);
    assert.equal(e.callCount, 1);
    assert.equal(e.responseChars, 1500);
    assert.equal(e.model, "claude-sonnet-4-6");
  });

  it("omits cost field when cost_usd is null, records other fields", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "spec");
    makeFlowManager(tmp).accumulateAgentMetrics("spec", {
      usage: makeUsage({ cost: null }),
      responseChars: 800,
      model: "gpt-5-codex",
    });
    const e = agentEntries(makeFlowManager(tmp).load().metrics)[0];
    assert.equal(e.tokens.input, 100);
    assert.equal(e.callCount, 1);
    assert.equal(e.responseChars, 800);
    assert.equal(e.model, "gpt-5-codex");
    assert.ok(!("cost" in e), "cost should be absent when cost_usd is null");
  });

  it("aggregation across multiple calls via buildMetricsSummary", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");
    const fm = makeFlowManager(tmp);
    fm.accumulateAgentMetrics("draft", {
      usage: makeUsage({ input: 100, output: 50, cost: 0.005 }),
      responseChars: 1000,
      model: "claude-sonnet-4-6",
    });
    fm.accumulateAgentMetrics("draft", {
      usage: makeUsage({ input: 200, output: 80, cost: 0.010 }),
      responseChars: 2000,
      model: "claude-sonnet-4-6",
    });
    const summary = buildMetricsSummary(fm.load().metrics);
    const d = summary.total.draft;
    assert.equal(d.tokens.input, 300);
    assert.equal(d.tokens.output, 130);
    assert.equal(d.callCount, 2);
    assert.equal(d.responseChars, 3000);
    assert.ok(Math.abs(d.cost - 0.015) < 0.0001, "cost should be summed");
    assert.equal(d.models["claude-sonnet-4-6"], 2);
  });

  it("creates a flat array on first call (no prior metrics)", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "gate");
    makeFlowManager(tmp).accumulateAgentMetrics("gate", {
      usage: makeUsage(),
      responseChars: 500,
      model: "claude-opus-4-6",
    });
    const loaded = makeFlowManager(tmp).load();
    assert.ok(Array.isArray(loaded.metrics));
    assert.equal(loaded.metrics.length, 1);
    assert.equal(loaded.metrics[0].phase, "gate");
    assert.ok(loaded.metrics[0].tokens);
  });

  it("records different models separately in summary.models map", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "impl");
    const fm = makeFlowManager(tmp);
    fm.accumulateAgentMetrics("impl", { usage: makeUsage({ cost: null }), responseChars: 500, model: "claude-sonnet-4-6" });
    fm.accumulateAgentMetrics("impl", { usage: makeUsage({ cost: null }), responseChars: 400, model: "gpt-5-codex" });
    fm.accumulateAgentMetrics("impl", { usage: makeUsage({ cost: null }), responseChars: 300, model: "claude-sonnet-4-6" });
    const summary = buildMetricsSummary(fm.load().metrics);
    assert.equal(summary.total.impl.models["claude-sonnet-4-6"], 2);
    assert.equal(summary.total.impl.models["gpt-5-codex"], 1);
  });

  it("counter entries and agent entries coexist without interference", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");
    const fm = makeFlowManager(tmp);
    fm.incrementMetric("draft", "question");
    fm.incrementMetric("draft", "question");
    fm.incrementMetric("draft", "srcRead");
    fm.incrementMetric("draft", "srcRead");
    fm.accumulateAgentMetrics("draft", { usage: makeUsage(), responseChars: 1000, model: "claude-sonnet-4-6" });
    const summary = buildMetricsSummary(fm.load().metrics);
    assert.equal(summary.total.draft.question, 2);
    assert.equal(summary.total.draft.srcRead, 2);
    assert.equal(summary.total.draft.callCount, 1);
  });

  it("silently no-ops when phase is null (no active flow)", () => {
    tmp = createTmpDir();
    assert.doesNotThrow(() => {
      makeFlowManager(tmp).accumulateAgentMetrics(null, { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6" });
    });
  });

  it("accumulates durationMs when provided (spec 191 R2)", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");
    makeFlowManager(tmp).accumulateAgentMetrics("draft", {
      usage: makeUsage(), responseChars: 1000, model: "claude-sonnet-4-6", durationMs: 1234,
    });
    const summary = buildMetricsSummary(makeFlowManager(tmp).load().metrics);
    assert.equal(summary.total.draft.durationMs, 1234);
  });

  it("sums durationMs additively across multiple calls", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "draft");
    const fm = makeFlowManager(tmp);
    fm.accumulateAgentMetrics("draft", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6", durationMs: 1000 });
    fm.accumulateAgentMetrics("draft", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6", durationMs: 2500 });
    fm.accumulateAgentMetrics("draft", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6", durationMs: 800 });
    const summary = buildMetricsSummary(fm.load().metrics);
    assert.equal(summary.total.draft.durationMs, 4300);
  });

  it("treats missing/nullish durationMs as not-present (does not pollute total)", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "spec");
    const fm = makeFlowManager(tmp);
    fm.accumulateAgentMetrics("spec", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6", durationMs: 1500 });
    fm.accumulateAgentMetrics("spec", { usage: makeUsage(), responseChars: 500, model: "claude-sonnet-4-6" });
    const summary = buildMetricsSummary(fm.load().metrics);
    assert.equal(summary.total.spec.durationMs, 1500);
  });
});
