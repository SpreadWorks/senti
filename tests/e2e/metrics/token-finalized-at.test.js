import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { runTokenJson, runTokenCapture, writeBaseConfig } from "../../helpers/metrics-token.js";

function metricsFlow(finalizedAt) {
  const flow = {
    metrics: {
      draft: {
        tokens: { input: 100, output: 50, cacheRead: 20, cacheCreation: 10 },
        cost: 0.01,
        callCount: 2,
      },
    },
  };
  if (finalizedAt !== undefined) {
    flow.state = { finalizedAt };
  }
  return flow;
}

describe("metrics token — state.finalizedAt as date axis (R2, R3, R4, R5)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R2: uses state.finalizedAt as the date column (not file mtime)", () => {
    tmp = createTmpDir("sdd-metrics-finalized-at-");
    writeBaseConfig(tmp);
    writeJson(
      tmp,
      "specs/001-alpha/flow.json",
      metricsFlow("2025-06-15T12:00:00Z"),
    );

    const parsed = JSON.parse(runTokenJson(tmp));
    const row = parsed.rows.find((r) => r.phase === "draft");
    assert.ok(row, "draft row should exist");
    assert.equal(row.date, "2025-06-15", "date axis should come from finalizedAt");
  });

  it("R3: skips specs missing state.finalizedAt and prints a warning", () => {
    tmp = createTmpDir("sdd-metrics-finalized-at-missing-");
    writeBaseConfig(tmp);
    writeJson(tmp, "specs/001-alpha/flow.json", metricsFlow());
    writeJson(
      tmp,
      "specs/002-beta/flow.json",
      metricsFlow("2025-06-20T00:00:00Z"),
    );

    const res = runTokenCapture(tmp);
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}. stderr=${res.stderr}`);
    const parsed = JSON.parse(res.stdout);
    const draftRows = parsed.rows.filter((r) => r.phase === "draft");
    assert.equal(draftRows.length, 1, "only specs with finalizedAt should be aggregated");
    assert.equal(draftRows[0].date, "2025-06-20");
    assert.match(
      res.stderr,
      /finalizedAt/i,
      "warning about missing finalizedAt should be emitted on stderr",
    );
  });

  it("R4/R5: cache without maxFinalizedAt is invalidated and rebuilt", () => {
    tmp = createTmpDir("sdd-metrics-finalized-at-cache-");
    writeBaseConfig(tmp);
    writeJson(
      tmp,
      "specs/001-alpha/flow.json",
      metricsFlow("2025-06-15T12:00:00Z"),
    );
    writeJson(tmp, ".sdd-forge/output/metrics.json", {
      generatedAt: "2020-01-01T00:00:00Z",
      rows: [
        {
          date: "2020-01-01",
          phase: "draft",
          difficulty: null,
          tokenInput: 999999,
          tokenOutput: 0,
          cacheRead: 0,
          cacheCreate: 0,
          callCount: 0,
          cost: 0,
        },
      ],
    });

    runTokenJson(tmp);

    const cachePath = join(tmp, ".sdd-forge/output/metrics.json");
    const cache = JSON.parse(readFileSync(cachePath, "utf8"));
    assert.ok(
      typeof cache.maxFinalizedAt === "string" && cache.maxFinalizedAt.length > 0,
      "cache should contain maxFinalizedAt after rebuild",
    );
    assert.equal(
      cache.rows[0].tokenInput,
      100,
      "legacy cache rows should be replaced with fresh aggregation",
    );
    assert.equal(cache.rows[0].date, "2025-06-15");
  });

  it("R4: cache is reused when maxFinalizedAt matches current max", () => {
    tmp = createTmpDir("sdd-metrics-finalized-at-cache-reuse-");
    writeBaseConfig(tmp);
    writeJson(
      tmp,
      "specs/001-alpha/flow.json",
      metricsFlow("2025-06-15T12:00:00Z"),
    );
    writeJson(tmp, ".sdd-forge/output/metrics.json", {
      version: 3,
      generatedAt: "2025-06-16T00:00:00Z",
      maxFinalizedAt: "2025-06-15T12:00:00Z",
      rows: [
        {
          date: "2025-06-15",
          phase: "draft",
          difficulty: null,
          tokenInput: 42,
          tokenOutput: 0,
          cacheRead: 0,
          cacheCreate: 0,
          callCount: 0,
          cost: 0,
        },
      ],
    });

    const parsed = JSON.parse(runTokenJson(tmp));
    const row = parsed.rows.find((r) => r.phase === "draft");
    assert.equal(row.tokenInput, 42, "cached row should be returned as-is");
  });
});
