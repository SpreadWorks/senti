/**
 * specs/123-add-test-info-to-report/tests/report-tests.test.js
 *
 * Spec verification tests for adding test information to the report.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateReport } from "../../../src/flow/commands/report.js";

const baseInput = {
  state: {
    spec: "specs/123-test/spec.md",
    baseBranch: "development",
    featureBranch: "feature/123-test",
    worktree: false,
    metrics: {
      plan: { question: 3 },
      impl: { srcRead: 5 },
      test: {
        summary: { unit: 5, integration: 2, acceptance: 1 },
      },
    },
  },
  results: {
    commit: { status: "done" },
    merge: { status: "done", strategy: "squash" },
    retro: { status: "skipped" },
    sync: { status: "done" },
    cleanup: { status: "done" },
  },
  redolog: { entries: [] },
  implDiffStat: "",
  commitMessages: [],
};

describe("report test information", () => {
  it("AC1: test summary is included in data.tests with total", () => {
    const report = generateReport(baseInput);
    assert.deepEqual(report.data.tests, {
      unit: 5,
      integration: 2,
      acceptance: 1,
      total: 8,
    });
  });

  it("AC2: data.tests is null when metrics.test is absent", () => {
    const input = {
      ...baseInput,
      state: {
        ...baseInput.state,
        metrics: { plan: { question: 3 } },
      },
    };
    const report = generateReport(input);
    assert.equal(report.data.tests, null);
  });

  it("AC2: data.tests is null when metrics is null", () => {
    const input = {
      ...baseInput,
      state: { ...baseInput.state, metrics: null },
    };
    const report = generateReport(input);
    assert.equal(report.data.tests, null);
  });

  it("AC3: text contains Tests section with counts", () => {
    const report = generateReport(baseInput);
    assert.ok(report.text.includes("Tests"), "text should have Tests section");
    assert.ok(report.text.includes("unit: 5"), "text should show unit count");
    assert.ok(report.text.includes("total: 8"), "text should show total");
  });

  it("AC3: text shows not available when no test info", () => {
    const input = {
      ...baseInput,
      state: { ...baseInput.state, metrics: null },
    };
    const report = generateReport(input);
    assert.ok(report.text.includes("Tests"), "text should have Tests section");
    assert.ok(report.text.includes("(not available)"), "text should show not available");
  });

  it("AC4: Tests section is between Metrics and Sync", () => {
    const report = generateReport(baseInput);
    const metricsIdx = report.text.indexOf("Metrics");
    const testsIdx = report.text.indexOf("Tests");
    const syncIdx = report.text.indexOf("Sync");
    assert.ok(metricsIdx < testsIdx, "Tests should come after Metrics");
    assert.ok(testsIdx < syncIdx, "Tests should come before Sync");
  });

  it("R3: handles partial summary (missing keys default to 0)", () => {
    const input = {
      ...baseInput,
      state: {
        ...baseInput.state,
        metrics: {
          test: { summary: { unit: 3 } },
        },
      },
    };
    const report = generateReport(input);
    assert.deepEqual(report.data.tests, {
      unit: 3,
      integration: 0,
      acceptance: 0,
      total: 3,
    });
  });
});
