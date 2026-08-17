import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateReport } from "../../../src/flow/commands/report.js";

function buildMinimalInput(stateOverrides = {}) {
  return {
    state: {
      metrics: {},
      ...stateOverrides,
    },
    results: { retro: null, sync: { status: "skipped" } },
    issueLog: { entries: [] },
    implDiffStat: null,
    commitMessages: [],
  };
}

const sampleSummary = { unit: 3, integration: 2, acceptance: 1 };

describe("report reads test summary from state.test.summary", () => {
  it("R1: reads test summary from state.test.summary", () => {
    const input = buildMinimalInput({ test: { summary: sampleSummary } });
    const { data } = generateReport(input);
    assert.deepEqual(data.tests, { unit: 3, integration: 2, acceptance: 1, total: 6 });
  });

  it("R2: displays correct values in report text", () => {
    const input = buildMinimalInput({ test: { summary: sampleSummary } });
    const { text } = generateReport(input);
    assert.match(text, /unit 3/);
    assert.match(text, /integration 2/);
    assert.match(text, /acceptance 1/);
    assert.match(text, /total 6/);
  });

  it("returns tests: null when state.test.summary is absent", () => {
    const input = buildMinimalInput();
    const { data } = generateReport(input);
    assert.equal(data.tests, null);
  });

  it("does not read from state.metrics.test.summary", () => {
    const input = buildMinimalInput({
      metrics: { test: { summary: { unit: 99 } } },
    });
    const { data } = generateReport(input);
    // metrics.test.summary should NOT be used as test summary source
    assert.equal(data.tests, null);
  });
});
