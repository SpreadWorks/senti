import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { SDD_FORGE, writeBaseConfig, runToken } from "../../../tests/helpers/metrics-token.js";

function paddedSpecJson(padChar, padLen) {
  return JSON.stringify({
    goal: padChar.repeat(padLen),
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  });
}

function setupTwoSpecProject(tmp) {
  writeBaseConfig(tmp);
  writeFile(tmp, "specs/001-alpha/spec.json", paddedSpecJson("A", 1600));
  writeFile(tmp, "specs/001-alpha/review.md", [
    "# Code Review Results",
    "",
    "### [x] 1. first",
    "### [ ] 2. second",
  ].join("\n"));
  writeFile(tmp, "specs/001-alpha/tests/a.test.js", "export {};\n");
  writeJson(tmp, "specs/001-alpha/issue-log.json", {
    entries: [{ step: "draft", reason: "r1" }],
  });
  writeJson(tmp, "specs/001-alpha/flow.json", {
    state: { finalizedAt: "2025-06-15T12:00:00.000Z" },
    request: "test request alpha",
    summary: [{ desc: "r1" }],
    reviewCount: { spec: 1, test: 0, impl: 0 },
    redoCount: 1,
    metrics: {
      draft: {
        question: 1,
        tokens: { input: 1000, output: 200, cacheRead: 500, cacheCreation: 10 },
        cost: 0.05,
        callCount: 3,
        duration: 45000,
      },
    },
  });

  writeFile(tmp, "specs/002-beta/spec.json", paddedSpecJson("B", 800));
  writeFile(tmp, "specs/002-beta/review.md", [
    "# Code Review Results",
    "",
    "### [x] 1. one",
  ].join("\n"));
  writeFile(tmp, "specs/002-beta/tests/b.test.js", "export {};\n");
  writeJson(tmp, "specs/002-beta/issue-log.json", {
    entries: [{ step: "draft", reason: "r2" }],
  });
  writeJson(tmp, "specs/002-beta/flow.json", {
    state: { finalizedAt: "2025-06-15T12:00:00.000Z" },
    request: "test request beta",
    summary: [{ desc: "r2" }],
    reviewCount: { spec: 1, test: 0, impl: 0 },
    redoCount: 0,
    metrics: {
      draft: {
        question: 0,
        tokens: { input: 500, output: 100, cacheRead: 0, cacheCreation: 5 },
        cost: 0.02,
        callCount: 1,
        duration: 12000,
      },
    },
  });
}

describe("247 metrics token AVG row", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  // R1: formatText outputs column header once at top, not repeated per phase
  it("R1: text output shows column header once at top", () => {
    tmp = createTmpDir("sdd-247-r1-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp);
    const lines = out.split("\n");
    const headerLines = lines.filter((l) => /\|\s*specs\s*\|/.test(l) && /difficulty/.test(l) && /cost/.test(l));
    assert.equal(headerLines.length, 1, "column header row (with specs, difficulty, cost) should appear exactly once");
  });

  // R2: phase separator is '-- {phaseLabel} ' + '-' padding
  it("R2: text output uses -- phase --- separator format", () => {
    tmp = createTmpDir("sdd-247-r2-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp);
    assert.match(out, /^-- draft -+$/m, "should have '-- draft ---...' separator");
    assert.doesNotMatch(out, /PHASE\s+draft/i, "should NOT use old 'PHASE draft' format");
  });

  // R3: summary line is AVG row with same column layout, first column 'AVG.'
  it("R3: text output has AVG. row aligned to data columns", () => {
    tmp = createTmpDir("sdd-247-r3-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp);
    assert.match(out, /^AVG\.\s+\|/m, "AVG row should start with 'AVG.' followed by column data");
  });

  // R4: rows include specCount in all formats
  it("R4: json rows include specCount field", () => {
    tmp = createTmpDir("sdd-247-r4j-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp, ["--format", "json"]);
    const parsed = JSON.parse(out);
    for (const row of parsed.rows) {
      assert.ok("specCount" in row, `row for ${row.date}/${row.phase} should have specCount`);
      assert.equal(typeof row.specCount, "number");
      assert.ok(row.specCount >= 1, "specCount should be at least 1");
    }
  });

  it("R4: csv includes specCount column", () => {
    tmp = createTmpDir("sdd-247-r4c-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp, ["--format", "csv"]);
    const header = out.split("\n")[0];
    assert.match(header, /specCount/i, "CSV header should include specCount");
  });

  it("R4: text output shows specs column", () => {
    tmp = createTmpDir("sdd-247-r4t-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp);
    assert.match(out, /specs/i, "text output should have specs column header");
  });

  // R5: rows include cacheHitRate in all formats
  it("R5: json rows include cacheHitRate field", () => {
    tmp = createTmpDir("sdd-247-r5j-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp, ["--format", "json"]);
    const parsed = JSON.parse(out);
    for (const row of parsed.rows) {
      assert.ok("cacheHitRate" in row, `row for ${row.date}/${row.phase} should have cacheHitRate`);
      if (row.cacheHitRate !== null) {
        assert.equal(typeof row.cacheHitRate, "number");
        assert.ok(row.cacheHitRate >= 0 && row.cacheHitRate <= 1, "cacheHitRate should be between 0 and 1");
      }
    }
  });

  it("R5: cacheHitRate is null when tokenInput + cacheRead is 0", () => {
    tmp = createTmpDir("sdd-247-r5null-");
    writeBaseConfig(tmp);
    writeJson(tmp, "specs/001-zero/flow.json", {
      state: { finalizedAt: "2025-06-15T12:00:00.000Z" },
      metrics: {
        draft: {
          tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
          cost: null,
          callCount: 0,
        },
      },
    });
    const out = runToken(tmp, ["--format", "json"]);
    const parsed = JSON.parse(out);
    const row = parsed.rows.find((r) => r.phase === "draft");
    assert.ok(row, "draft row should exist");
    assert.equal(row.cacheHitRate, null, "cacheHitRate should be null when tokenInput + cacheRead = 0");
  });

  it("R5: csv includes cacheHitRate column", () => {
    tmp = createTmpDir("sdd-247-r5c-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp, ["--format", "csv"]);
    const header = out.split("\n")[0];
    assert.match(header, /cacheHitRate/i, "CSV header should include cacheHitRate");
  });

  it("R5: text output shows hit column in cache group", () => {
    tmp = createTmpDir("sdd-247-r5t-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp);
    assert.match(out, /hit/i, "text output should have cache hit column");
  });

  // R6: text/CSV cost uses toFixed(1), JSON keeps numeric
  it("R6: text cost displays with one decimal place", () => {
    tmp = createTmpDir("sdd-247-r6t-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp);
    assert.match(out, /\$\d+\.\d(?:\s|\|)/, "text cost should show $X.X format (one decimal)");
  });

  it("R6: csv cost uses toFixed(1)", () => {
    tmp = createTmpDir("sdd-247-r6c-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp, ["--format", "csv"]);
    const lines = out.trim().split("\n");
    const header = lines[0].split(",");
    const costIdx = header.findIndex((h) => /cost/i.test(h));
    assert.ok(costIdx >= 0, "CSV should have cost column");
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].startsWith("SUMMARY")) continue;
      const cols = lines[i].split(",");
      const cost = cols[costIdx];
      if (cost && cost !== "—") {
        assert.match(cost, /^\d+\.\d$/, `CSV cost '${cost}' on line ${i + 1} should be X.X format`);
      }
    }
  });

  it("R6: json cost remains numeric (not string)", () => {
    tmp = createTmpDir("sdd-247-r6j-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp, ["--format", "json"]);
    const parsed = JSON.parse(out);
    for (const row of parsed.rows) {
      if (row.cost !== null) {
        assert.equal(typeof row.cost, "number", "JSON cost should be a number, not a string");
      }
    }
  });

  // R7: cache version — stale cache triggers rebuild
  it("R7: stale cache (no version) triggers rebuild", () => {
    tmp = createTmpDir("sdd-247-r7-");
    setupTwoSpecProject(tmp);
    // First run to generate cache
    runToken(tmp, ["--format", "json"]);
    const cachePath = join(tmp, ".sdd-forge", "output", "metrics.json");
    const cache = JSON.parse(readFileSync(cachePath, "utf8"));
    delete cache.version;
    writeFileSync(cachePath, JSON.stringify(cache));
    // Second run should still work (rebuild)
    const out = runToken(tmp, ["--format", "json"]);
    const parsed = JSON.parse(out);
    assert.ok(Array.isArray(parsed.rows), "should rebuild and return valid output");
    // Verify cache now has version
    const newCache = JSON.parse(readFileSync(cachePath, "utf8"));
    assert.ok("version" in newCache, "rebuilt cache should have version field");
  });

  // R8: computePhaseSummary includes avgSpecCount and avgDifficulty
  it("R8: json phaseSummary includes avgSpecCount, avgDifficulty, avgCallCount", () => {
    tmp = createTmpDir("sdd-247-r8-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp, ["--format", "json"]);
    const parsed = JSON.parse(out);
    assert.ok(parsed.phaseSummary, "json output should have phaseSummary");
    const draftSummary = parsed.phaseSummary.draft;
    assert.ok(draftSummary, "phaseSummary should have draft phase");
    assert.ok("avgSpecCount" in draftSummary, "phaseSummary.draft should have avgSpecCount");
    assert.ok("avgDifficulty" in draftSummary, "phaseSummary.draft should have avgDifficulty");
    assert.ok("avgCallCount" in draftSummary, "phaseSummary.draft should have avgCallCount");
  });

  // R3 + R8: AVG row shows correct values
  it("R3+R8: AVG row in text includes specs and cache hit columns", () => {
    tmp = createTmpDir("sdd-247-avg-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp);
    const avgLine = out.split("\n").find((l) => l.startsWith("AVG."));
    assert.ok(avgLine, "AVG line should exist");
    const parts = avgLine.split("|").map((s) => s.trim());
    assert.ok(parts.length >= 8, `AVG row should have at least 8 columns, got ${parts.length}: ${avgLine}`);
  });

  // R4: specCount counts aggregated flow.json per (date, phase)
  it("R4: specCount reflects number of flow.json files per (date, phase)", () => {
    tmp = createTmpDir("sdd-247-r4count-");
    writeBaseConfig(tmp);
    // Two specs with same finalizedAt date, same phase → should aggregate as specCount=2
    writeJson(tmp, "specs/001-alpha/flow.json", {
      state: { finalizedAt: "2025-06-15T12:00:00.000Z" },
      metrics: {
        draft: {
          tokens: { input: 100, output: 50, cacheRead: 20, cacheCreation: 10 },
          cost: 0.01,
          callCount: 1,
        },
      },
    });
    writeJson(tmp, "specs/002-beta/flow.json", {
      state: { finalizedAt: "2025-06-15T18:00:00.000Z" },
      metrics: {
        draft: {
          tokens: { input: 200, output: 100, cacheRead: 50, cacheCreation: 5 },
          cost: 0.02,
          callCount: 2,
        },
      },
    });
    const out = runToken(tmp, ["--format", "json"]);
    const parsed = JSON.parse(out);
    const draftRow = parsed.rows.find((r) => r.phase === "draft" && r.date === "2025-06-15");
    assert.ok(draftRow, "aggregated draft row for 2025-06-15 should exist");
    assert.equal(draftRow.specCount, 2, "specCount should be 2 for two flow.json files on same date+phase");
  });

  // R5: cacheHitRate calculated correctly
  it("R5: cacheHitRate = cacheRead / (tokenInput + cacheRead)", () => {
    tmp = createTmpDir("sdd-247-r5calc-");
    writeBaseConfig(tmp);
    writeJson(tmp, "specs/001-alpha/flow.json", {
      state: { finalizedAt: "2025-06-15T12:00:00.000Z" },
      metrics: {
        draft: {
          tokens: { input: 600, output: 100, cacheRead: 400, cacheCreation: 10 },
          cost: 0.01,
          callCount: 1,
        },
      },
    });
    const out = runToken(tmp, ["--format", "json"]);
    const parsed = JSON.parse(out);
    const row = parsed.rows.find((r) => r.phase === "draft");
    assert.ok(row, "draft row should exist");
    // cacheHitRate = 400 / (600 + 400) = 0.4
    assert.equal(row.cacheHitRate, 0.4, "cacheHitRate should be 400/(600+400)=0.4");
  });

  // Separator line before AVG
  it("R3: separator line before AVG row uses dashes", () => {
    tmp = createTmpDir("sdd-247-sep-");
    setupTwoSpecProject(tmp);
    const out = runToken(tmp);
    const lines = out.split("\n");
    const avgIdx = lines.findIndex((l) => l.startsWith("AVG."));
    assert.ok(avgIdx > 0, "AVG line should exist");
    const sepLine = lines[avgIdx - 1];
    assert.match(sepLine, /^-{10,}$/, "line before AVG should be a separator of dashes");
  });
});
