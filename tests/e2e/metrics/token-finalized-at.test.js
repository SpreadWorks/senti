import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import {
  readTokenCache,
  runTokenJson,
  runTokenCapture,
  writeBaseConfig,
  writeTokenCache,
} from "../../helpers/metrics-token.js";

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
    tmp = createTmpDir("senrail-metrics-finalized-at-");
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
    tmp = createTmpDir("senrail-metrics-finalized-at-missing-");
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

  it("R4/R5: cache without an input fingerprint is invalidated and rebuilt", () => {
    tmp = createTmpDir("senrail-metrics-finalized-at-cache-");
    writeBaseConfig(tmp);
    writeJson(
      tmp,
      "specs/001-alpha/flow.json",
      metricsFlow("2025-06-15T12:00:00Z"),
    );
    writeJson(tmp, ".senrail/output/metrics.json", {
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

    const cache = readTokenCache(tmp);
    assert.ok(
      typeof cache.maxFinalizedAt === "string" && cache.maxFinalizedAt.length > 0,
      "cache should contain maxFinalizedAt after rebuild",
    );
    assert.match(cache.inputFingerprint, /^[a-f0-9]{64}$/);
    assert.equal(
      cache.rows[0].tokenInput,
      100,
      "legacy cache rows should be replaced with fresh aggregation",
    );
    assert.equal(cache.rows[0].date, "2025-06-15");
  });

  it("R4: cache is reused when the input fingerprint matches", () => {
    tmp = createTmpDir("senrail-metrics-finalized-at-cache-reuse-");
    writeBaseConfig(tmp);
    writeJson(
      tmp,
      "specs/001-alpha/flow.json",
      metricsFlow("2025-06-15T12:00:00Z"),
    );
    runTokenJson(tmp);
    const cache = readTokenCache(tmp);
    cache.rows[0].tokenInput = 42;
    writeTokenCache(tmp, cache);

    const parsed = JSON.parse(runTokenJson(tmp));
    const row = parsed.rows.find((r) => r.phase === "draft");
    assert.equal(row.tokenInput, 42, "cached row should be returned as-is");
  });
});
