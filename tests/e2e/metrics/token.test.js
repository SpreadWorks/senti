import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  createCanonicalTokenMetricsFlow,
  runToken,
  writeBaseConfig,
} from "../../helpers/metrics-token.js";

describe("metrics token command", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupProject() {
    tmp = createTmpDir("sennel-metrics-token-");
    writeBaseConfig(tmp);
    return createCanonicalTokenMetricsFlow(tmp, {
      agentMetrics: [{
        phase: "draft",
        input: 100,
        output: 50,
        cacheRead: 20,
        cacheCreation: 10,
        cost: 0.01,
        callCount: 2,
      }],
    });
  }

  function setupProjectWithDifficultyData() {
    tmp = createTmpDir("sennel-metrics-token-diff-");
    writeBaseConfig(tmp);
    return createCanonicalTokenMetricsFlow(tmp, {
      request: "metrics difficulty test request",
      goal: "A".repeat(1600),
      requirements: [{ id: "R-1", desc: "Preserve canonical metric inputs." }],
      draftQuestions: 1,
      issueEntries: [{ step: "draft", reason: "recorded canonical issue fact" }],
      agentMetrics: [{
        phase: "draft",
        input: 100,
        output: 50,
        cacheRead: 20,
        cacheCreation: 10,
        cost: 0.01,
        callCount: 2,
      }],
    });
  }

  it("supports json format and returns aggregated rows", () => {
    const flow = setupProject();
    const out = runToken(tmp, ["--format", "json"]);
    const parsed = JSON.parse(out);
    assert.ok(Array.isArray(parsed.rows), "json output should include rows array");
    assert.ok(parsed.rows.length >= 1, "rows should not be empty");
    assert.equal(flow.location.relativeSpecFile, "specs/001-alpha/001/spec.json");
  });

  it("uses text format by default and prints phase sections", () => {
    setupProject();
    const out = runToken(tmp);
    assert.match(out, /-- draft -+/i);
    assert.match(out, /difficulty/i);
    assert.match(out, /call count/i);
  });

  it("supports csv format with expected headers", () => {
    setupProject();
    const out = runToken(tmp, ["--format", "csv"]);
    assert.match(
      out,
      /date,phase,specCount,difficulty,tokenInput,tokenOutput,cacheRead,cacheCreate,cacheHitRate,callCount,cost/i,
    );
  });

  it("computes numeric difficulty from cataloged Spec, Issue, and Activity inputs", () => {
    setupProjectWithDifficultyData();
    const parsed = JSON.parse(runToken(tmp, ["--format", "json"]));
    const row = parsed.rows.find((entry) => entry.phase === "draft");
    assert.ok(row, "draft row should exist");
    assert.equal(typeof row.difficulty, "number");
    assert.ok(row.difficulty > 0, "difficulty should be positive");
  });

  it("does not require retired reviewCount or redoCount state fields", () => {
    setupProject();
    const lines = runToken(tmp, ["--format", "csv"]).trim().split("\n");
    assert.ok(lines.length >= 2, "csv must include at least one data row");
    const cols = lines[1].split(",");
    assert.notEqual(cols[3], "—", "V1 derives review count from Activities");
  });

  it("treats absent optional Issue and question observations as zero", () => {
    tmp = createTmpDir("sennel-metrics-token-zeroable-");
    writeBaseConfig(tmp);
    createCanonicalTokenMetricsFlow(tmp, {
      goal: "B".repeat(1200),
      requirements: [{ id: "R-1", desc: "Metric input." }],
      agentMetrics: [{ phase: "draft", input: 10, output: 5, cacheRead: 2, cacheCreation: 1, cost: 0.001 }],
    });
    const parsed = JSON.parse(runToken(tmp, ["--format", "json"]));
    const row = parsed.rows.find((entry) => entry.phase === "draft");
    assert.ok(row);
    assert.equal(typeof row.difficulty, "number");
    assert.ok(row.difficulty > 0);
  });

  it("returns — when the immutable request is empty", () => {
    tmp = createTmpDir("sennel-metrics-token-reqzero-");
    writeBaseConfig(tmp);
    createCanonicalTokenMetricsFlow(tmp, {
      request: "",
      goal: "C".repeat(10),
      requirements: [{ id: "R-1", desc: "Metric input." }],
      draftQuestions: 1,
      agentMetrics: [{ phase: "draft", input: 10, output: 5, cacheRead: 2, cacheCreation: 1, cost: 0.001 }],
    });
    const lines = runToken(tmp, ["--format", "csv"]).trim().split("\n");
    const cols = lines[1].split(",");
    assert.equal(cols[3], "—");
  });
});
