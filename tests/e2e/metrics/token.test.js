import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";
import { SDD_FORGE, writeBaseConfig } from "../../helpers/metrics-token.js";

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

describe("metrics token command", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupProject() {
    tmp = createTmpDir("sdd-metrics-token-");
    writeBaseConfig(tmp);
    writeJson(tmp, "specs/001-alpha/flow.json", {
      state: { finalizedAt: "2025-06-15T12:00:00.000Z" },
      metrics: {
        draft: {
          tokens: { input: 100, output: 50, cacheRead: 20, cacheCreation: 10 },
          cost: 0.01,
          callCount: 2,
        },
      },
    });
  }

  function setupProjectWithDifficultyData() {
    tmp = createTmpDir("sdd-metrics-token-diff-");
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
      request: "metrics difficulty test request",
      summary: [{ desc: "r1" }, { desc: "r2" }],
      reviewCount: { spec: 2, test: 0, impl: 0 },
      redoCount: 1,
      metrics: {
        draft: {
          question: 1,
          tokens: { input: 100, output: 50, cacheRead: 20, cacheCreation: 10 },
          cost: 0.01,
          callCount: 2,
        },
      },
    });
  }

  it("supports json format and returns aggregated rows", () => {
    setupProject();
    const out = execFileSync("node", [SDD_FORGE, "metrics", "token", "--format", "json"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      cwd: tmp,
    });
    const parsed = JSON.parse(out);
    assert.ok(Array.isArray(parsed.rows), "json output should include rows array");
    assert.ok(parsed.rows.length >= 1, "rows should not be empty");
  });

  it("uses text format by default and prints phase sections", () => {
    setupProject();
    const out = execFileSync("node", [SDD_FORGE, "metrics", "token"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      cwd: tmp,
    });
    assert.match(out, /PHASE\s+draft/i);
    assert.match(out, /difficulty/i);
    assert.match(out, /call count/i);
  });

  it("supports csv format with expected headers", () => {
    setupProject();
    const out = execFileSync("node", [SDD_FORGE, "metrics", "token", "--format", "csv"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      cwd: tmp,
    });
    assert.match(
      out,
      /date,phase,difficulty,tokenInput,tokenOutput,cacheRead,cacheCreate,callCount,cost/i
    );
  });

  it("computes numeric difficulty when required fields exist", () => {
    setupProjectWithDifficultyData();
    const out = execFileSync("node", [SDD_FORGE, "metrics", "token", "--format", "json"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      cwd: tmp,
    });
    const parsed = JSON.parse(out);
    const row = parsed.rows.find((r) => r.phase === "draft");
    assert.ok(row, "draft row should exist");
    assert.equal(typeof row.difficulty, "number");
    assert.ok(row.difficulty > 0, "difficulty should be positive");
  });

  it("returns — difficulty when reviewCount/redoCount are missing", () => {
    setupProject();
    writeFile(tmp, "specs/001-alpha/spec.json", paddedSpecJson("C", 10));
    writeFile(tmp, "specs/001-alpha/review.md", "### [x] 1. one");
    writeJson(tmp, "specs/001-alpha/issue-log.json", { entries: [] });
    const out = execFileSync("node", [SDD_FORGE, "metrics", "token", "--format", "csv"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      cwd: tmp,
    });
    const lines = out.trim().split("\n");
    assert.ok(lines.length >= 2, "csv must include at least one data row");
    const cols = lines[1].split(",");
    assert.equal(cols[2], "—");
  });

  it("treats missing qaCount/testCount/issueLogEntries as zero for calculation", () => {
    tmp = createTmpDir("sdd-metrics-token-zeroable-");
    writeBaseConfig(tmp);
    writeFile(tmp, "specs/001-alpha/spec.json", paddedSpecJson("B", 1200));
    writeJson(tmp, "specs/001-alpha/flow.json", {
      state: { finalizedAt: "2025-06-15T12:00:00.000Z" },
      request: "request for zero-fill fields",
      summary: [{ desc: "r1" }],
      reviewCount: { spec: 1, test: 0, impl: 0 },
      redoCount: 1,
      metrics: {
        draft: {
          tokens: { input: 10, output: 5, cacheRead: 2, cacheCreation: 1 },
          cost: 0.001,
          callCount: 1,
        },
      },
    });
    const out = execFileSync("node", [SDD_FORGE, "metrics", "token", "--format", "json"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      cwd: tmp,
    });
    const parsed = JSON.parse(out);
    const row = parsed.rows.find((r) => r.phase === "draft");
    assert.ok(row);
    assert.equal(typeof row.difficulty, "number");
    assert.ok(row.difficulty > 0);
  });

  it("returns — when requestChars resolves to zero", () => {
    tmp = createTmpDir("sdd-metrics-token-reqzero-");
    writeBaseConfig(tmp);
    writeFile(tmp, "specs/001-alpha/spec.json", paddedSpecJson("C", 10));
    writeJson(tmp, "specs/001-alpha/flow.json", {
      state: { finalizedAt: "2025-06-15T12:00:00.000Z" },
      request: "",
      summary: [{ desc: "r1" }],
      reviewCount: { spec: 1, test: 0, impl: 0 },
      redoCount: 1,
      metrics: {
        draft: {
          question: 1,
          tokens: { input: 10, output: 5, cacheRead: 2, cacheCreation: 1 },
          cost: 0.001,
          callCount: 1,
        },
      },
    });
    const out = execFileSync("node", [SDD_FORGE, "metrics", "token", "--format", "csv"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      cwd: tmp,
    });
    const lines = out.trim().split("\n");
    const cols = lines[1].split(",");
    assert.equal(cols[2], "—");
  });
});
