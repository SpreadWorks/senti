// spec: R11
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildReportTotals } from "../../../src/flow/lib/get-status.js";
import { generateReport } from "../../../src/flow/commands/report.js";

let tmpRoot = null;

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
  tmpRoot = null;
});

function setup() {
  tmpRoot = mkdtempSync(join(tmpdir(), "sdd-report-totals-"));
  mkdirSync(join(tmpRoot, ".sdd-forge", "output"), { recursive: true });
  mkdirSync(join(tmpRoot, "specs", "001-report"), { recursive: true });
  return tmpRoot;
}

function flowWithProviderTaggedMetrics() {
  return {
    spec: "specs/001-report/spec.md",
    steps: [],
    metrics: [
      {
        phase: "draft",
        kind: "agent",
        provider: "claude",
        profileKey: "claude/sonnet",
        callCount: 2,
        responseChars: 1500,
        durationMs: 12300,
        tokens: { input: 1000, output: 200, cacheRead: 50, cacheCreation: 100 },
        cost: 0.025,
        model: "sonnet",
      },
      {
        phase: "spec",
        kind: "agent",
        provider: "codex",
        profileKey: "codex/default",
        callCount: 1,
        responseChars: 800,
        durationMs: 4100,
        tokens: { input: 500, output: 100, cacheRead: 0, cacheCreation: 0 },
        cost: 0.005,
        model: "codex",
      },
    ],
  };
}

describe("flow run report provider bucket compatibility (R11)", () => {
  it("R11: report.json shape has only legacy tokenMetrics keys", () => {
    setup();
    const flow = flowWithProviderTaggedMetrics();
    const input = {
      state: flow,
      results: {},
      issueLog: { entries: [] },
      implDiffStat: null,
      commitMessages: [],
    };
    const { data, text } = generateReport(input);
    assert.ok(data.tokenMetrics, "data.tokenMetrics must be present");
    // Allowed keys (flat shape).
    const allowed = new Set([
      "input", "output", "cacheRead", "cacheCreation",
      "cost", "callCount", "durationMs", "phaseDurations",
    ]);
    for (const key of Object.keys(data.tokenMetrics)) {
      assert.ok(
        allowed.has(key),
        `tokenMetrics has unexpected key '${key}' (provider/profile fields must not leak into report.json)`,
      );
    }
    assert.ok(!("providers" in data.tokenMetrics), "providers map must not appear in report.json");

    // Rendered text must not include provider / profile labels.
    for (const forbidden of ["providers", "profileKey", "claude/sonnet", "codex/default"]) {
      assert.ok(
        !text.includes(forbidden),
        `report text leaked '${forbidden}'`,
      );
    }
  });

  it("R11: buildReportTotals ignores provider buckets", () => {
    const totals = buildReportTotals({
      draft: {
        tokens: { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
        cost: 0.01,
        callCount: 1,
        durationMs: 200,
        providers: {
          claude: {
            "claude/sonnet": {
              tokens: { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
              cost: 0.01,
              callCount: 1,
              durationMs: 200,
            },
          },
        },
      },
    });
    assert.ok(!("providers" in totals.tokens));
  });
});
