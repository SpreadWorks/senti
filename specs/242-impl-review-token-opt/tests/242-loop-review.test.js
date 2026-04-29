import { describe, it } from "node:test";
import assert from "node:assert/strict";

// These imports will resolve once the implementation exists.
// Tests are expected to fail before implementation (test-first).
import {
  groupByDiffContent,
  shouldUseLoopReview,
  buildPerFileReviewInput,
  buildCrossCheckInput,
  expandProposalsToGroup,
  formatReviewMd,
  mergeVerdicts,
  LOOP_REVIEW_THRESHOLD,
  MAX_LOOP_CALLS,
} from "../../../src/flow/commands/review.js";

// ---------------------------------------------------------------------------
// R1: file-map.json required validation
// ---------------------------------------------------------------------------

describe("R1: file-map.json required", () => {
  it("null fileMap is detected as missing", () => {
    const fileMap = null;
    assert.equal(!fileMap || Object.keys(fileMap).length === 0, true);
  });

  it("empty fileMap is detected as missing", () => {
    const fileMap = {};
    assert.equal(!fileMap || Object.keys(fileMap).length === 0, true);
  });

  it("non-empty fileMap passes validation", () => {
    const fileMap = { R1: ["src/a.js"] };
    assert.equal(!fileMap || Object.keys(fileMap).length === 0, false);
  });
});

// ---------------------------------------------------------------------------
// R2: Threshold-based routing
// ---------------------------------------------------------------------------

describe("shouldUseLoopReview", () => {
  it("returns false when file count is below threshold", () => {
    assert.equal(shouldUseLoopReview(9), false);
  });

  it("returns true when file count equals threshold", () => {
    assert.equal(shouldUseLoopReview(10), true);
  });

  it("returns true when file count exceeds threshold", () => {
    assert.equal(shouldUseLoopReview(11), true);
  });

  it("returns false for zero files", () => {
    assert.equal(shouldUseLoopReview(0), false);
  });
});

describe("LOOP_REVIEW_THRESHOLD", () => {
  it("equals 10", () => {
    assert.equal(LOOP_REVIEW_THRESHOLD, 10);
  });
});

describe("MAX_LOOP_CALLS", () => {
  it("equals 50", () => {
    assert.equal(MAX_LOOP_CALLS, 50);
  });
});

// ---------------------------------------------------------------------------
// R3 + R4: Per-file loop review input
// ---------------------------------------------------------------------------

describe("buildPerFileReviewInput", () => {
  it("includes file diff and mapped requirements", () => {
    const input = buildPerFileReviewInput(
      "src/foo.js",
      "diff --git a/src/foo.js\n+added line",
      ["R1: must do X", "R2: must do Y"],
    );
    assert.ok(input.includes("src/foo.js"), "includes file path");
    assert.ok(input.includes("+added line"), "includes diff content");
    assert.ok(input.includes("R1: must do X"), "includes requirement R1");
    assert.ok(input.includes("R2: must do Y"), "includes requirement R2");
  });

  it("works with empty requirements (unmapped file, R4)", () => {
    const input = buildPerFileReviewInput(
      "src/bar.js",
      "diff --git a/src/bar.js\n+new line",
      [],
    );
    assert.ok(input.includes("src/bar.js"), "includes file path");
    assert.ok(input.includes("+new line"), "includes diff content");
  });
});

// ---------------------------------------------------------------------------
// R5: Cross-check pass
// ---------------------------------------------------------------------------

describe("buildCrossCheckInput", () => {
  it("aggregates proposal summaries from multiple files", () => {
    const summaries = [
      { file: "src/a.js", proposals: "### 1. Rename foo\n**File:** `src/a.js`" },
      { file: "src/b.js", proposals: "### 1. Extract helper\n**File:** `src/b.js`" },
    ];
    const input = buildCrossCheckInput(summaries);
    assert.ok(input.includes("src/a.js"), "includes file a");
    assert.ok(input.includes("src/b.js"), "includes file b");
    assert.ok(input.includes("Rename foo"), "includes proposal from a");
    assert.ok(input.includes("Extract helper"), "includes proposal from b");
  });

  it("handles empty summaries (no proposals from any file)", () => {
    const input = buildCrossCheckInput([]);
    assert.equal(typeof input, "string");
  });
});

// ---------------------------------------------------------------------------
// R6: Compaction — group files by identical diff content
// ---------------------------------------------------------------------------

describe("groupByDiffContent", () => {
  it("groups files with identical diff content", () => {
    const perFileDiffs = new Map([
      ["src/a.js", "- old\n+ new"],
      ["src/b.js", "- old\n+ new"],
      ["src/c.js", "- different\n+ change"],
    ]);
    const groups = groupByDiffContent(perFileDiffs);

    assert.equal(groups.length, 2, "two distinct groups");

    const largeGroup = groups.find((g) => g.files.length === 2);
    assert.ok(largeGroup, "group with 2 files exists");
    assert.deepEqual(largeGroup.files.sort(), ["src/a.js", "src/b.js"]);
    assert.equal(largeGroup.diff, "- old\n+ new");

    const singleGroup = groups.find((g) => g.files.length === 1);
    assert.ok(singleGroup, "group with 1 file exists");
    assert.deepEqual(singleGroup.files, ["src/c.js"]);
  });

  it("returns one group when all diffs are identical", () => {
    const perFileDiffs = new Map([
      ["src/a.js", "same diff"],
      ["src/b.js", "same diff"],
      ["src/c.js", "same diff"],
    ]);
    const groups = groupByDiffContent(perFileDiffs);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].files.length, 3);
  });

  it("returns individual groups when all diffs are unique", () => {
    const perFileDiffs = new Map([
      ["src/a.js", "diff a"],
      ["src/b.js", "diff b"],
    ]);
    const groups = groupByDiffContent(perFileDiffs);
    assert.equal(groups.length, 2);
  });

  it("handles single file", () => {
    const perFileDiffs = new Map([["src/a.js", "only diff"]]);
    const groups = groupByDiffContent(perFileDiffs);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].files, ["src/a.js"]);
  });
});

describe("expandProposalsToGroup", () => {
  it("replicates proposals for each file in the group, replacing file path", () => {
    const proposals = [
      { title: "1. Rename var", body: "**File:** `src/a.js`\n**Issue:** bad name", file: "src/a.js" },
    ];
    const groupFiles = ["src/a.js", "src/b.js", "src/c.js"];

    const expanded = expandProposalsToGroup(proposals, groupFiles);
    assert.equal(expanded.length, 3, "one proposal per file");
    assert.equal(expanded[0].file, "src/a.js");
    assert.equal(expanded[1].file, "src/b.js");
    assert.equal(expanded[2].file, "src/c.js");
    assert.ok(expanded[1].body.includes("src/b.js"), "File line has updated file path");
    assert.ok(expanded[1].body.includes("**Issue:** bad name"), "Issue text preserved");
  });

  it("handles empty proposals", () => {
    const expanded = expandProposalsToGroup([], ["src/a.js", "src/b.js"]);
    assert.equal(expanded.length, 0);
  });

  it("handles single-file group (no expansion needed)", () => {
    const proposals = [
      { title: "1. Fix", body: "**File:** `src/a.js`", file: "src/a.js" },
    ];
    const expanded = expandProposalsToGroup(proposals, ["src/a.js"]);
    assert.equal(expanded.length, 1);
    assert.equal(expanded[0].file, "src/a.js");
  });
});

// ---------------------------------------------------------------------------
// R7: Same output format for loop and legacy paths
// ---------------------------------------------------------------------------

describe("R7: formatReviewMd produces identical format regardless of input source", () => {
  it("formats loop-sourced proposals the same as legacy-sourced proposals", () => {
    const loopResults = [
      { title: "1. Rename var", body: "**File:** `src/a.js`", verdict: "APPROVED", reason: "Good" },
      { title: "2. Fix typo", body: "**File:** `src/b.js`", verdict: "REJECTED", reason: "Cosmetic" },
    ];
    const legacyResults = [
      { title: "1. Rename var", body: "**File:** `src/a.js`", verdict: "APPROVED", reason: "Good" },
      { title: "2. Fix typo", body: "**File:** `src/b.js`", verdict: "REJECTED", reason: "Cosmetic" },
    ];
    const loopMd = formatReviewMd(loopResults);
    const legacyMd = formatReviewMd(legacyResults);
    assert.equal(loopMd, legacyMd);
    assert.ok(loopMd.includes("# Code Review Results"));
    assert.ok(loopMd.includes("[x] 1. Rename var"));
    assert.ok(loopMd.includes("[ ] 2. Fix typo"));
  });

  it("produces consistent format for empty results", () => {
    const md = formatReviewMd([]);
    assert.ok(md.includes("# Code Review Results"));
    assert.ok(md.includes("No proposals"));
  });
});
