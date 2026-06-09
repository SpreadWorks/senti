/**
 * tests/unit/metrics/token-duration.test.js
 *
 * Tests for duration display in `senti metrics token` output (spec 191 R4).
 * Verifies that per-phase duration is rendered in seconds (one decimal) in
 * the text and included in CSV/JSON rows.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatText, formatCsv, buildRowsFromMetrics } from "../../../src/metrics/commands/token.js";

describe("metrics token: duration display (spec 191 R4)", () => {
  it("buildRowsFromMetrics extracts durationMs per phase-date row", () => {
    const rows = buildRowsFromMetrics("2026-04-18", {
      draft: {
        tokens: { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
        cost: 0.001,
        callCount: 2,
        durationMs: 12300,
      },
      spec: {
        tokens: { input: 50, output: 25, cacheRead: 0, cacheCreation: 0 },
        cost: 0.0005,
        callCount: 1,
        durationMs: 4100,
      },
    });

    const byPhase = Object.fromEntries(rows.map((r) => [r.phase, r]));
    assert.equal(byPhase.draft.durationMs, 12300);
    assert.equal(byPhase.spec.durationMs, 4100);
  });

  it("formatText includes a duration column with seconds (one decimal)", () => {
    const rows = [
      {
        date: "2026-04-18", phase: "draft", difficulty: null,
        tokenInput: 100, tokenOutput: 50, cacheRead: 0, cacheCreate: 0,
        callCount: 2, cost: 0.001, durationMs: 12300,
      },
    ];
    const text = formatText(rows);
    assert.ok(/duration/i.test(text), `header should mention duration; got:\n${text}`);
    assert.ok(text.includes("12.3s"), `row should show 12.3s; got:\n${text}`);
  });

  it("formatText shows N/A when durationMs is null", () => {
    const rows = [
      {
        date: "2026-04-18", phase: "draft", difficulty: null,
        tokenInput: 100, tokenOutput: 50, cacheRead: 0, cacheCreate: 0,
        callCount: 2, cost: 0.001, durationMs: null,
      },
    ];
    const text = formatText(rows);
    assert.ok(text.includes("N/A"), "N/A should appear when durationMs is null");
  });

  it("formatCsv includes durationMs column", () => {
    const rows = [
      {
        date: "2026-04-18", phase: "draft", difficulty: null,
        tokenInput: 100, tokenOutput: 50, cacheRead: 0, cacheCreate: 0,
        callCount: 2, cost: 0.001, durationMs: 12300,
      },
    ];
    const csv = formatCsv(rows);
    const [header, row] = csv.split("\n");
    assert.ok(header.split(",").includes("durationMs"), `CSV header should include durationMs; got: ${header}`);
    assert.ok(row.endsWith(",12300") || row.includes(",12300,") || row.includes(",12300\n") || /,12300$/.test(row), `CSV row should include 12300; got: ${row}`);
  });
});
