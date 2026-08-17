/**
 * specs/245-metrics-output-improvements/tests/245-metrics-output.test.js
 *
 * Spec verification tests for #245: metrics output improvements.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatText, formatCsv, formatJson, buildRowsFromMetrics } from "../../../src/metrics/commands/token.js";
import { VALID_PHASES } from "../../../src/lib/constants.js";

function makeRow(overrides) {
  return {
    date: "2026-04-01",
    phase: "draft",
    difficulty: null,
    tokenInput: 1000,
    tokenOutput: 500,
    cacheRead: 200,
    cacheCreate: 100,
    callCount: 3,
    cost: 0.05,
    costIncomplete: false,
    durationMs: 5000,
    ...overrides,
  };
}

// ── R1: sortRows uses VALID_PHASES order ──

describe("R1: VALID_PHASES sort order", () => {
  it("sortRows orders phases by VALID_PHASES index, not alphabetically", () => {
    const rows = [
      makeRow({ phase: "review", date: "2026-04-01" }),
      makeRow({ phase: "draft", date: "2026-04-01" }),
      makeRow({ phase: "impl", date: "2026-04-01" }),
      makeRow({ phase: "gate", date: "2026-04-01" }),
      makeRow({ phase: "spec", date: "2026-04-01" }),
    ];
    const text = formatText(rows);
    const phaseHeaders = [...text.matchAll(/^PHASE (\S+)/gm)].map(m => m[1]);
    const expectedOrder = ["draft", "spec", "gate", "impl", "review"];
    assert.deepEqual(phaseHeaders, expectedOrder);
  });

  it("same phase rows are displayed by date descending (most recent first)", () => {
    const rows = [
      makeRow({ phase: "draft", date: "2026-04-03" }),
      makeRow({ phase: "draft", date: "2026-04-01" }),
      makeRow({ phase: "draft", date: "2026-04-02" }),
    ];
    const text = formatText(rows);
    const dateLines = text.split("\n").filter(l => /^\d{4}-\d{2}-\d{2}/.test(l.trim()));
    const dates = dateLines.map(l => l.trim().slice(0, 10));
    assert.deepEqual(dates, ["2026-04-03", "2026-04-02", "2026-04-01"]);
  });

  it("unknown phases are placed after all VALID_PHASES entries", () => {
    const rows = [
      makeRow({ phase: "unknown-phase", date: "2026-04-01" }),
      makeRow({ phase: "draft", date: "2026-04-01" }),
    ];
    const text = formatText(rows);
    const phaseHeaders = [...text.matchAll(/^PHASE (\S+)/gm)].map(m => m[1]);
    assert.equal(phaseHeaders[0], "draft");
    assert.equal(phaseHeaders[1], "unknown-phase");
  });
});

// ── R2: formatText 7-row limit ──

describe("R2: formatText 7-row limit per phase", () => {
  it("shows all rows when phase has 7 or fewer", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeRow({ phase: "draft", date: `2026-04-${String(i + 1).padStart(2, "0")}` })
    );
    const text = formatText(rows);
    assert.ok(!text.includes("... and"), "should not show ellipsis for 5 rows");
  });

  it("limits to 7 rows and shows ellipsis for 10 rows", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({ phase: "draft", date: `2026-04-${String(i + 1).padStart(2, "0")}` })
    );
    const text = formatText(rows);
    assert.ok(text.includes("... and 3 more"), `should show '... and 3 more'; got:\n${text}`);
    const dateLines = text.split("\n").filter(l => /^\d{4}-\d{2}-\d{2}/.test(l.trim()));
    assert.equal(dateLines.length, 7, "should display exactly 7 data rows");
  });

  it("displays most recent 7 rows (by date descending)", () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({ phase: "draft", date: `2026-04-${String(i + 1).padStart(2, "0")}` })
    );
    const text = formatText(rows);
    const dateLines = text.split("\n").filter(l => /^\d{4}-\d{2}-\d{2}/.test(l.trim()));
    const dates = dateLines.map(l => l.trim().slice(0, 10));
    assert.ok(dates.includes("2026-04-10"), "most recent date should be shown");
    assert.ok(dates.includes("2026-04-04"), "7th most recent date should be shown");
    assert.ok(!dates.includes("2026-04-03"), "8th most recent should be elided");
  });
});

// ── R3: formatText summary row ──

describe("R3: formatText phase summary row", () => {
  it("displays summary at the end of each phase block", () => {
    const rows = [
      makeRow({ phase: "draft", cost: 0.10, durationMs: 10000, callCount: 5, tokenInput: 1000, tokenOutput: 500, cacheRead: 200 }),
      makeRow({ phase: "draft", cost: 0.20, durationMs: 20000, callCount: 3, tokenInput: 2000, tokenOutput: 800, cacheRead: 600, date: "2026-04-02" }),
    ];
    const text = formatText(rows);
    assert.ok(/avg cost/i.test(text) || /avg/i.test(text), `summary should contain avg; got:\n${text}`);
  });

  it("excludes cost-null rows from avg cost calculation", () => {
    const rows = [
      makeRow({ phase: "draft", cost: 0.10 }),
      makeRow({ phase: "draft", cost: null, date: "2026-04-02" }),
    ];
    const text = formatText(rows);
    assert.ok(!text.includes("0.050000"), "avg cost should not average with null rows");
  });

  it("includes cache hit rate in summary", () => {
    const rows = [
      makeRow({ phase: "draft", tokenInput: 1000, cacheRead: 500 }),
    ];
    const text = formatText(rows);
    assert.ok(/cache/i.test(text), `summary should mention cache; got:\n${text}`);
  });
});

// ── R4: formatJson phaseSummary ──

describe("R4: formatJson phaseSummary", () => {
  it("JSON output includes phaseSummary key with per-phase aggregates", () => {
    const rows = [
      makeRow({ phase: "draft", cost: 0.10, durationMs: 10000, callCount: 5, tokenInput: 1000, tokenOutput: 500, cacheRead: 200 }),
      makeRow({ phase: "draft", cost: 0.20, durationMs: 20000, callCount: 3, tokenInput: 2000, tokenOutput: 800, cacheRead: 600, date: "2026-04-02" }),
      makeRow({ phase: "spec", cost: 0.05, durationMs: 5000, callCount: 2, tokenInput: 500, tokenOutput: 250, cacheRead: 100 }),
    ];
    const json = formatJson(rows);
    const parsed = JSON.parse(json);
    assert.ok(parsed.phaseSummary, "should have phaseSummary key");
    assert.ok(parsed.phaseSummary.draft, "should have draft summary");
    assert.ok(parsed.phaseSummary.spec, "should have spec summary");
    assert.equal(parsed.phaseSummary.draft.totalCalls, 8);
    assert.equal(parsed.rows.length, 3, "rows should be full output (no limit)");
  });

  it("phaseSummary avgCost excludes null-cost rows", () => {
    const rows = [
      makeRow({ phase: "draft", cost: 0.10 }),
      makeRow({ phase: "draft", cost: null, date: "2026-04-02" }),
    ];
    const json = formatJson(rows);
    const parsed = JSON.parse(json);
    assert.equal(parsed.phaseSummary.draft.avgCost, 0.10);
  });
});

// ── R5: formatCsv SUMMARY rows ──

describe("R5: formatCsv SUMMARY rows", () => {
  it("CSV includes SUMMARY row after each phase", () => {
    const rows = [
      makeRow({ phase: "draft" }),
      makeRow({ phase: "spec" }),
    ];
    const csv = formatCsv(rows);
    const lines = csv.split("\n");
    const summaryLines = lines.filter(l => l.startsWith("SUMMARY,"));
    assert.equal(summaryLines.length, 2, `should have 2 SUMMARY rows (one per phase); got ${summaryLines.length}`);
  });

  it("SUMMARY row contains phase name", () => {
    const rows = [makeRow({ phase: "draft" })];
    const csv = formatCsv(rows);
    const summaryLine = csv.split("\n").find(l => l.startsWith("SUMMARY,"));
    assert.ok(summaryLine, "SUMMARY row should exist");
    assert.ok(summaryLine.includes("draft"), "SUMMARY row should contain phase name");
  });
});

// ── R6: asDisplayValue cost null → — ──

describe("R6: asDisplayValue cost null shows —", () => {
  it("text output shows — for null cost instead of N/A", () => {
    const rows = [makeRow({ phase: "draft", cost: null })];
    const text = formatText(rows);
    const dataLines = text.split("\n").filter(l => /^\d{4}-\d{2}-\d{2}/.test(l.trim()));
    assert.ok(dataLines.length > 0, "should have data lines");
    assert.ok(dataLines[0].includes("—"), `cost null should show —; got: ${dataLines[0]}`);
    assert.ok(!dataLines[0].includes("N/A"), `cost null should not show N/A; got: ${dataLines[0]}`);
  });

  it("text output still shows N/A for null duration", () => {
    const rows = [makeRow({ phase: "draft", durationMs: null })];
    const text = formatText(rows);
    assert.ok(text.includes("N/A"), "null duration should still show N/A");
  });
});

// ── R7: asCsvValue cost null → — ──

describe("R7: asCsvValue cost null shows — in CSV", () => {
  it("CSV shows — for null cost", () => {
    const rows = [makeRow({ phase: "draft", cost: null })];
    const csv = formatCsv(rows);
    const dataLines = csv.split("\n").filter(l => /^\d{4}-\d{2}-\d{2}/.test(l));
    assert.ok(dataLines.length > 0);
    const cols = dataLines[0].split(",");
    const costIdx = csv.split("\n")[0].split(",").indexOf("cost");
    assert.equal(cols[costIdx], "—", `CSV cost null should be —; got: ${cols[costIdx]}`);
  });
});
