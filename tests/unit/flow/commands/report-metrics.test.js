/**
 * tests/unit/flow/commands/report-metrics.test.js
 *
 * Tests for token/cost metrics display in generateReport().
 * Verifies R3-1 and R3-2: token counts and cost are included in report output,
 * and N/A is shown (not 0) when cost is not recorded.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateReport } from "../../../../src/flow/commands/report.js";

function makeInput(metricsOverride = {}) {
  return {
    state: {
      spec: "specs/001-test/spec.md",
      steps: [],
      metrics: metricsOverride,
    },
    results: {},
    issueLog: { entries: [] },
    implDiffStat: null,
    commitMessages: [],
  };
}

describe("generateReport: token/cost metrics (R3-1, R3-2)", () => {
  it("includes token counts in report text when metrics are present", () => {
    const input = makeInput({
      draft: {
        tokens: { input: 1000, output: 200, cacheRead: 500, cacheCreation: 100 },
        cost: 0.025,
        callCount: 3,
        responseChars: 5000,
      },
    });

    const { text } = generateReport(input);
    assert.ok(text.includes("1000") || text.includes("1,000"), "input token count should appear in report");
    assert.ok(text.includes("3"), "callCount should appear in report");
  });

  it("shows N/A for cost when no cost is recorded (R3-2)", () => {
    const input = makeInput({
      draft: {
        tokens: { input: 500, output: 100, cacheRead: 0, cacheCreation: 0 },
        cost: null,
        callCount: 2,
        responseChars: 2000,
      },
    });

    const { text } = generateReport(input);
    assert.ok(text.includes("N/A"), "N/A should appear when cost is null");
    assert.ok(!text.match(/cost.*\b0\b/i), "0 should not be shown as cost when cost is null");
  });

  it("does not break when metrics has no token data (backward compat)", () => {
    const input = makeInput({
      draft: { question: 5, srcRead: 2 },
    });

    let result;
    assert.doesNotThrow(() => {
      result = generateReport(input);
    });
    assert.ok(result.text, "report text should be generated");
  });

  it("does not break when metrics is null", () => {
    const input = makeInput(null);

    let result;
    assert.doesNotThrow(() => {
      result = generateReport(input);
    });
    assert.ok(result.text, "report text should be generated");
  });

  // ─── Spec 191: duration display (R3) ────────────────────────────────────────

  it("includes per-phase duration in seconds with one decimal (spec 191 R3)", () => {
    const input = makeInput({
      draft: {
        tokens: { input: 1000, output: 200, cacheRead: 0, cacheCreation: 0 },
        cost: 0.01,
        callCount: 2,
        responseChars: 3000,
        durationMs: 12300,
      },
    });

    const { text, data } = generateReport(input);
    assert.ok(data.tokenMetrics.durationMs >= 12300, "tokenMetrics.durationMs should be aggregated");
    assert.ok(text.includes("12.3s"), `report text should contain '12.3s'; got:\n${text}`);
  });

  it("aggregates durationMs across phases (spec 191 R3)", () => {
    const input = makeInput({
      draft: {
        tokens: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 },
        callCount: 1,
        durationMs: 1500,
      },
      spec: {
        tokens: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 },
        callCount: 1,
        durationMs: 800,
      },
    });

    const { data } = generateReport(input);
    assert.equal(data.tokenMetrics.durationMs, 2300);
  });

  it("omits duration when no durationMs is recorded", () => {
    const input = makeInput({
      draft: {
        tokens: { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
        cost: 0.001,
        callCount: 1,
      },
    });

    const { text } = generateReport(input);
    // Should not produce a bogus "0.0s" line when duration is absent
    assert.ok(!/duration[^\n]*0\.0s/i.test(text), "should not show 0.0s when duration is missing");
  });

  it("aggregates token counts across multiple phases", () => {
    const input = makeInput({
      draft: {
        tokens: { input: 1000, output: 200, cacheRead: 0, cacheCreation: 0 },
        cost: 0.01,
        callCount: 2,
      },
      spec: {
        tokens: { input: 500, output: 100, cacheRead: 0, cacheCreation: 0 },
        cost: 0.005,
        callCount: 1,
      },
    });

    const { data } = generateReport(input);
    assert.ok(data.metrics, "data.metrics should be present");
    assert.ok(data.tokenMetrics, "data.tokenMetrics should be present");
    assert.equal(data.tokenMetrics.input, 1500, "input tokens should be aggregated across phases");
    assert.equal(data.tokenMetrics.callCount, 3, "callCount should be aggregated across phases");
  });
});
