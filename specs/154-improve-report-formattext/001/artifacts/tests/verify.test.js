/**
 * specs/154-improve-report-formattext/tests/verify.test.js
 *
 * Spec verification tests for formatText() improvements.
 * Tests AC1–AC4 from the spec, plus AC5 (regression).
 *
 * These are spec-scoped tests (not in tests/) because they verify this
 * spec's specific format requirements. Future format changes would
 * intentionally break these, not unconditionally indicate a bug.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateReport } from "../../../src/flow/commands/report.js";

function makeInput(overrides = {}) {
  return {
    state: {
      spec: "specs/154-test/spec.md",
      baseBranch: "development",
      featureBranch: "feature/154-test",
      worktree: true,
      metrics: {
        plan: { question: 2, docsRead: 1 },
        impl: { srcRead: 3 },
      },
      ...overrides.state,
    },
    results: {
      commit: { status: "done", message: "feat: 154-test" },
      merge: { status: "done", strategy: "squash" },
      retro: { status: "skipped" },
      sync: { status: "skipped", message: "PR route: run sdd-forge build after PR merge" },
      cleanup: { status: "done" },
      ...overrides.results,
    },
    issueLog: overrides.issueLog ?? { entries: [] },
    implDiffStat: overrides.implDiffStat ?? null,
    commitMessages: overrides.commitMessages ?? ["feat: 154-test"],
  };
}

describe("formatText() improvements (spec 154)", () => {
  // AC1: Documents section removed
  describe("AC1: Documents section is absent", () => {
    it("text output does not contain 'Documents'", () => {
      const { text } = generateReport(makeInput());
      assert.ok(!text.includes("Documents"), `text must not include 'Documents', got:\n${text}`);
    });

    it("sync skipped case also produces no Documents section", () => {
      const { text } = generateReport(makeInput({
        results: {
          sync: { status: "skipped", message: "PR route" },
        },
      }));
      assert.ok(!text.includes("Documents"), "Documents section should not appear even for skipped sync");
    });

    it("sync done case also produces no Documents section", () => {
      const { text } = generateReport(makeInput({
        results: {
          sync: {
            status: "done",
            diffStat: " docs/overview.md | 5 ++---\n 1 file changed",
            diffSummary: "docs/overview.md",
          },
        },
      }));
      assert.ok(!text.includes("Documents"), "Documents section should not appear even for done sync");
    });
  });

  // AC2: Metrics labels clarified
  describe("AC2: Metrics labels use 'docs read', 'src read', 'issue-log'", () => {
    it("metrics line contains 'docs read'", () => {
      const { text } = generateReport(makeInput());
      assert.ok(text.includes("docs read"), `text must contain 'docs read', got:\n${text}`);
    });

    it("metrics line contains 'src read'", () => {
      const { text } = generateReport(makeInput());
      assert.ok(text.includes("src read"), `text must contain 'src read', got:\n${text}`);
    });

    it("metrics line contains 'issue-log'", () => {
      const { text } = generateReport(makeInput());
      assert.ok(text.includes("issue-log"), `text must contain 'issue-log', got:\n${text}`);
    });

    it("metrics line does not use standalone 'docs ' label (without 'read')", () => {
      const { text } = generateReport(makeInput());
      // Should not have "docs N" without "read" (i.e., old "docs 1" format)
      assert.ok(!/\bdocs \d/.test(text), `text must not contain standalone 'docs N' label, got:\n${text}`);
    });

    it("metrics line does not use standalone 'src ' label (without 'read')", () => {
      const { text } = generateReport(makeInput());
      assert.ok(!/\bsrc \d/.test(text), `text must not contain standalone 'src N' label, got:\n${text}`);
    });

    it("metrics line does not use 'issues' label", () => {
      const { text } = generateReport(makeInput());
      assert.ok(!/ issues /.test(text), `text must not contain ' issues ' label, got:\n${text}`);
    });
  });

  // AC3: Issue Log shows only reason (no resolution)
  describe("AC3: Issue Log shows only reason, no resolution suffix", () => {
    it("issue log entry does not include '->' separator", () => {
      const { text } = generateReport(makeInput({
        issueLog: {
          entries: [
            { step: "impl", reason: "typo in variable name", resolution: "fixed the typo", timestamp: "2026-04-07T00:00:00Z" },
          ],
        },
      }));
      assert.ok(!text.includes("->"), `text must not contain '->' in issue log, got:\n${text}`);
    });

    it("issue log entry shows the reason text", () => {
      const { text } = generateReport(makeInput({
        issueLog: {
          entries: [
            { step: "gate", reason: "missing required field", resolution: "added the field", timestamp: "2026-04-07T00:00:00Z" },
          ],
        },
      }));
      assert.ok(text.includes("missing required field"), `text must contain the reason, got:\n${text}`);
    });

    it("multiple issue log entries each show only reason", () => {
      const { text } = generateReport(makeInput({
        issueLog: {
          entries: [
            { step: "draft", reason: "first issue reason", resolution: "first resolution" },
            { step: "impl", reason: "second issue reason", resolution: "second resolution" },
          ],
        },
      }));
      assert.ok(!text.includes("->"), "no '->' should appear for any entry");
      assert.ok(text.includes("first issue reason"), "first reason should appear");
      assert.ok(text.includes("second issue reason"), "second reason should appear");
      assert.ok(!text.includes("first resolution"), "first resolution should NOT appear");
      assert.ok(!text.includes("second resolution"), "second resolution should NOT appear");
    });

    it("issue log with no entries still omits the section", () => {
      const { text } = generateReport(makeInput({ issueLog: { entries: [] } }));
      assert.ok(!text.includes("Issue Log"), "Issue Log section should be absent when no entries");
    });
  });

  // AC4: Tests section always shown
  describe("AC4: Tests section always present", () => {
    it("Tests section appears when data.tests is null (no test summary)", () => {
      const input = makeInput();
      // Ensure no test summary in state
      input.state.metrics = { plan: { question: 1 } };
      const { text } = generateReport(input);
      assert.ok(text.includes("Tests"), `text must contain 'Tests' section, got:\n${text}`);
    });

    it("Tests section shows '-' placeholder when no test data", () => {
      const input = makeInput();
      input.state.metrics = null;
      const { text } = generateReport(input);
      assert.ok(text.includes("Tests"), "Tests section must be present");
      // After 'Tests' header, a '-' placeholder should appear
      const testsIdx = text.indexOf("Tests");
      const afterTests = text.slice(testsIdx);
      assert.ok(afterTests.includes("-"), "Tests section should contain '-' when no data");
    });

    it("Tests section appears with data when test summary exists", () => {
      const input = makeInput();
      input.state.metrics = {
        test: { summary: { unit: 5, integration: 2, acceptance: 1 } },
      };
      const { text } = generateReport(input);
      assert.ok(text.includes("Tests"), "Tests section must be present");
      assert.ok(text.includes("unit"), "Tests section should contain unit count");
    });
  });

  // AC5: Regression — other sections unchanged
  describe("AC5: Other sections remain unchanged", () => {
    it("Implementation section is still present", () => {
      const { text } = generateReport(makeInput());
      assert.ok(text.includes("Implementation"), "Implementation section must be present");
    });

    it("Retro section is still present", () => {
      const { text } = generateReport(makeInput());
      assert.ok(text.includes("Retro"), "Retro section must be present");
    });

    it("Metrics section is still present", () => {
      const { text } = generateReport(makeInput());
      assert.ok(text.includes("Metrics"), "Metrics section must be present");
    });

    it("generateReport returns both data and text", () => {
      const report = generateReport(makeInput());
      assert.ok(report.data, "report.data must exist");
      assert.ok(report.text, "report.text must exist");
      assert.equal(typeof report.data, "object");
      assert.equal(typeof report.text, "string");
    });
  });
});
