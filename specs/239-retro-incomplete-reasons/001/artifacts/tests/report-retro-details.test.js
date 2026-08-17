import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateReport } from "../../../src/flow/commands/report.js";

function makeState() {
  return {
    metrics: [],
    test: {},
  };
}

function makeRetroResults(summary, requirements) {
  return {
    retro: {
      status: "done",
      summary,
      ...(requirements ? { requirements } : {}),
    },
  };
}

describe("generateReport retro requirements (R1)", () => {
  it("includes requirements in data.retro when provided via results", () => {
    const reqs = [
      { desc: "R1: do X", status: "done", note: "ok" },
      { desc: "R2: do Y", status: "partial", note: "half done" },
    ];
    const summary = { total: 2, done: 1, partial: 1, not_done: 0, rate: 0.75 };
    const report = generateReport({
      state: makeState(),
      results: makeRetroResults(summary, reqs),
      issueLog: { entries: [] },
      implDiffStat: "",
      commitMessages: [],
    });
    assert.ok(report.data.retro.requirements, "data.retro should have requirements");
    assert.equal(report.data.retro.requirements.length, 2);
    assert.equal(report.data.retro.requirements[1].status, "partial");
  });

  it("data.retro has no requirements when retroResult has none", () => {
    const summary = { total: 1, done: 1, partial: 0, not_done: 0, rate: 1.0 };
    const report = generateReport({
      state: makeState(),
      results: makeRetroResults(summary),
      issueLog: { entries: [] },
      implDiffStat: "",
      commitMessages: [],
    });
    assert.ok(report.data.retro, "data.retro should exist");
    assert.equal(report.data.retro.requirements, undefined);
  });
});

describe("formatText retro incomplete details (R2, R3)", () => {
  it("shows partial/not_done requirement details when rate < 1.0", () => {
    const reqs = [
      { desc: "R1: feature A", status: "done", note: "implemented" },
      { desc: "R2: feature B", status: "partial", note: "half done reason" },
      { desc: "R3: feature C", status: "not_done", note: "not started reason" },
    ];
    const summary = { total: 3, done: 1, partial: 1, not_done: 1, rate: 0.5 };
    const report = generateReport({
      state: makeState(),
      results: makeRetroResults(summary, reqs),
      issueLog: { entries: [] },
      implDiffStat: "",
      commitMessages: [],
    });
    const text = report.text;
    assert.ok(text.includes("partial"), "should contain 'partial' label");
    assert.ok(text.includes("R2: feature B"), "should contain partial requirement desc");
    assert.ok(text.includes("half done reason"), "should contain partial requirement note");
    assert.ok(text.includes("not_done"), "should contain 'not_done' label");
    assert.ok(text.includes("R3: feature C"), "should contain not_done requirement desc");
    assert.ok(text.includes("not started reason"), "should contain not_done requirement note");
    assert.ok(!text.includes("R1: feature A"), "should NOT contain done requirement desc");
  });

  it("does not show extra lines when rate = 1.0", () => {
    const reqs = [
      { desc: "R1: feature A", status: "done", note: "ok" },
    ];
    const summary = { total: 1, done: 1, partial: 0, not_done: 0, rate: 1.0 };
    const report = generateReport({
      state: makeState(),
      results: makeRetroResults(summary, reqs),
      issueLog: { entries: [] },
      implDiffStat: "",
      commitMessages: [],
    });
    const text = report.text;
    assert.ok(text.includes("100%"), "should show 100%");
    assert.ok(!text.includes("R1: feature A"), "should NOT show requirement detail lines");
  });

  it("does not show extra lines when retro is null", () => {
    const report = generateReport({
      state: makeState(),
      results: {},
      issueLog: { entries: [] },
      implDiffStat: "",
      commitMessages: [],
    });
    const text = report.text;
    assert.ok(text.includes("Retro"), "should have Retro section");
    assert.ok(text.includes("-"), "should show dash for no retro");
  });
});
