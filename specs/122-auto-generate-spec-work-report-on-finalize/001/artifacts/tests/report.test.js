/**
 * specs/122-auto-generate-spec-work-report-on-finalize/tests/report.test.js
 *
 * Spec verification tests for the report generation in finalize.
 * Tests the generateReport() function directly.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { generateReport } from "../../../src/flow/commands/report.js";

describe("generateReport", () => {
  const baseInput = {
    state: {
      spec: "specs/122-test/spec.md",
      baseBranch: "development",
      featureBranch: "feature/122-test",
      worktree: false,
      metrics: {
        plan: { question: 3, docsRead: 2 },
        impl: { srcRead: 5, redo: 1, docsRead: 1 },
      },
    },
    results: {
      commit: { status: "done", message: "feat: feature/122-test" },
      merge: { status: "done", strategy: "squash" },
      retro: {
        status: "done",
        summary: { total: 3, done: 2, partial: 1, not_done: 0, rate: 0.833 },
      },
      sync: {
        status: "done",
        diffStat: " docs/overview.md | 10 +++++-----\n 1 file changed, 5 insertions(+), 5 deletions(-)",
        diffSummary: "docs/overview.md",
      },
      cleanup: { status: "done" },
    },
    redolog: {
      entries: [
        { step: "impl", reason: "typo in variable name", timestamp: "2026-04-01T10:00:00Z" },
      ],
    },
    implDiffStat: " src/flow/run/finalize.js | 50 +++++++++\n 1 file changed, 50 insertions(+)",
    commitMessages: ["feat: feature/122-test"],
  };

  it("AC1: returns data and text fields", () => {
    const report = generateReport(baseInput);
    assert.ok(report.data, "report.data should exist");
    assert.ok(report.text, "report.text should exist");
    assert.equal(typeof report.data, "object");
    assert.equal(typeof report.text, "string");
  });

  it("AC2: data contains required keys", () => {
    const report = generateReport(baseInput);
    const keys = Object.keys(report.data);
    for (const key of ["implementation", "retro", "redolog", "metrics", "sync"]) {
      assert.ok(keys.includes(key), `data should contain key: ${key}`);
    }
  });

  it("AC3: text has section headings for each report item", () => {
    const report = generateReport(baseInput);
    for (const section of ["Implementation", "Retro", "Redo", "Metrics", "Sync"]) {
      assert.ok(report.text.includes(section), `text should contain section: ${section}`);
    }
  });

  it("AC5: retro skipped/failed results in null retro field", () => {
    const input = {
      ...baseInput,
      results: {
        ...baseInput.results,
        retro: { status: "skipped" },
      },
    };
    const report = generateReport(input);
    assert.equal(report.data.retro, null, "retro should be null when skipped");
    assert.ok(report.text, "text should still be generated");
  });

  it("AC5: retro failed results in null retro field", () => {
    const input = {
      ...baseInput,
      results: {
        ...baseInput.results,
        retro: { status: "failed", message: "agent error" },
      },
    };
    const report = generateReport(input);
    assert.equal(report.data.retro, null, "retro should be null when failed");
  });

  it("AC6: sync skipped results in skipped sync field", () => {
    const input = {
      ...baseInput,
      results: {
        ...baseInput.results,
        sync: { status: "skipped", message: "PR route: run sdd-forge build after PR merge" },
      },
    };
    const report = generateReport(input);
    assert.equal(report.data.sync.status, "skipped");
    assert.ok(report.data.sync.reason, "sync should have a reason when skipped");
  });

  it("redolog with no entries", () => {
    const input = {
      ...baseInput,
      redolog: { entries: [] },
    };
    const report = generateReport(input);
    assert.equal(report.data.redolog.count, 0);
    assert.deepEqual(report.data.redolog.entries, []);
  });

  it("metrics aggregation sums across phases", () => {
    const report = generateReport(baseInput);
    // plan.docsRead(2) + impl.docsRead(1) = 3
    assert.equal(report.data.metrics.docsRead, 3);
    // impl.srcRead(5)
    assert.equal(report.data.metrics.srcRead, 5);
    // plan.question(3)
    assert.equal(report.data.metrics.question, 3);
    // impl.redo(1)
    assert.equal(report.data.metrics.redo, 1);
  });

  it("null/missing metrics handled gracefully", () => {
    const input = {
      ...baseInput,
      state: { ...baseInput.state, metrics: null },
    };
    const report = generateReport(input);
    assert.equal(report.data.metrics.docsRead, 0);
    assert.equal(report.data.metrics.srcRead, 0);
    assert.equal(report.data.metrics.question, 0);
    assert.equal(report.data.metrics.redo, 0);
  });
});
