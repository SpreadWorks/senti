// spec: R1 R2 R3 R4 R5 R6 R7
import { test } from "node:test";
import assert from "node:assert/strict";
import * as review from "../../../src/flow/commands/review.js";

function requireFunction(name) {
  assert.equal(typeof review[name], "function", `${name} must be exported for behavioral testing`);
  return review[name];
}

function group(id, diff = `diff-${id}`) {
  return { representative: `src/file-${id}.js`, files: [`src/file-${id}.js`], diff };
}

function proposal(file = "src/file-a.js") {
  return [
    "### 1. Keep review behavior",
    `**File:** \`${file}\``,
    "**Issue:** fixture issue",
    "**Suggestion:** fixture suggestion",
  ].join("\n");
}

test("R1: impl loop review uses fixed MAX_LOOP_CALLS value 16", () => {
  assert.equal(review.MAX_LOOP_CALLS, 16);
});

test("R2: grouped diffs above the limit are batched to at most MAX_LOOP_CALLS calls", async () => {
  const runLoopReviewWithDependencies = requireFunction("runLoopReviewWithDependencies");
  const groups = Array.from({ length: 41 }, (_, index) => group(index));
  let reviewCalls = 0;
  const reviewedGroups = [];

  await runLoopReviewWithDependencies({
    groups,
    maxLoopCalls: 16,
    buildChunkInput: (chunk) => chunk.map((item) => item.representative).join("\n"),
    reviewChunk: async (chunk) => {
      reviewCalls += 1;
      reviewedGroups.push(...chunk);
      return "NO_PROPOSALS";
    },
    crossCheck: async () => {
      assert.fail("no proposals means cross-check should not run");
    },
  });

  assert.ok(reviewCalls <= 16, `expected at most 16 review calls, got ${reviewCalls}`);
  assert.deepEqual(reviewedGroups, groups, "runner must cover all groups in order");
});

test("R3: cross-check runs only for proposals from more than one reviewed chunk", async () => {
  const runLoopReviewWithDependencies = requireFunction("runLoopReviewWithDependencies");
  let reviewCalls = 0;
  let crossCheckCalls = 0;

  await runLoopReviewWithDependencies({
    groups: [group("a"), group("b")],
    maxLoopCalls: 16,
    buildChunkInput: (chunk) => chunk.map((item) => item.representative).join("\n"),
    reviewChunk: async (chunk) => {
      reviewCalls += 1;
      return proposal(chunk[0].representative);
    },
    crossCheck: async () => {
      crossCheckCalls += 1;
      return "NO_PROPOSALS";
    },
  });

  assert.equal(reviewCalls, 2);
  assert.equal(crossCheckCalls, 1);
});

test("R4: single proposal chunk does not run the cross-check pass", async () => {
  const runLoopReviewWithDependencies = requireFunction("runLoopReviewWithDependencies");
  let crossCheckCalls = 0;

  await runLoopReviewWithDependencies({
    groups: [group("a"), group("b")],
    maxLoopCalls: 16,
    buildChunkInput: (chunk) => chunk.map((item) => item.representative).join("\n"),
    reviewChunk: async (chunk) => (
      chunk[0].representative.endsWith("file-a.js")
        ? proposal(chunk[0].representative)
        : "NO_PROPOSALS"
    ),
    crossCheck: async () => {
      crossCheckCalls += 1;
      return "NO_PROPOSALS";
    },
  });

  assert.equal(crossCheckCalls, 0);
});

test("R5: duplicate chunk hashes are skipped before another AI call", async () => {
  const runLoopReviewWithDependencies = requireFunction("runLoopReviewWithDependencies");
  let reviewCalls = 0;

  await runLoopReviewWithDependencies({
    groups: [group("a", "same diff"), group("b", "same diff")],
    maxLoopCalls: 16,
    buildChunkInput: () => "same normalized chunk input",
    reviewChunk: async () => {
      reviewCalls += 1;
      return "NO_PROPOSALS";
    },
    crossCheck: async () => {
      assert.fail("duplicate chunks with no proposals must not reach cross-check");
    },
  });

  assert.equal(reviewCalls, 1);
});

test("R6: active loop review path still writes through existing impl review artifact helpers", async () => {
  const runActiveImplReviewWithDependencies = requireFunction("runActiveImplReviewWithDependencies");
  let persistedOutput = null;

  const persisted = await runActiveImplReviewWithDependencies({
    touchedFiles: new Set(Array.from({ length: 10 }, (_, index) => `src/file-${index}.js`)),
    shouldUseLoopReview: () => true,
    runLoopReview: async () => JSON.stringify({
      blockingFindings: [],
      nonBlockingImprovements: [{
        title: "Keep format",
        failureMode: "refactor",
        file: "src/file-1.js",
        issue: "The artifact shape must remain stable.",
        suggestion: "Keep the existing formatter contract.",
        rationale: "Consumers read review.md and impl-review.json.",
      }],
    }),
    runSingleReview: async () => assert.fail("single review path should not run"),
    persistImplReview: async (reviewOutput) => {
      persistedOutput = reviewOutput;
      return {
        markdown: review.formatImplReviewMd({
          ...JSON.parse(reviewOutput),
          excluded: { missingFile: 0, outOfScope: 0 },
        }),
        json: JSON.parse(review.formatImplReviewJson({
          ...JSON.parse(reviewOutput),
          excluded: { missingFile: 0, outOfScope: 0 },
        })),
      };
    },
  });

  assert.ok(persistedOutput, "active path should persist loop review output");
  const parsed = JSON.parse(persistedOutput);
  assert.equal(parsed.nonBlockingImprovements[0].title, "Keep format");
  assert.match(persisted.markdown, /## Non-blocking Improvements/);
  assert.match(persisted.markdown, /Keep format/);
  assert.equal(persisted.json.verdict, "ADVISORY");
  assert.deepEqual(persisted.json.summary, { blocking: 0, nonBlocking: 1, total: 1 });
  assert.equal(persisted.json.nonBlockingImprovements[0].title, "Keep format");
});

test("R7: active impl review path uses loop review when shouldUseLoopReview is true", async () => {
  const runReviewWithDependencies = requireFunction("runReviewWithDependencies");
  let loopCalls = 0;
  let singleCalls = 0;

  await runReviewWithDependencies({
    phase: null,
    touchedFiles: new Set(Array.from({ length: 10 }, (_, index) => `src/file-${index}.js`)),
    shouldUseLoopReview: () => true,
    runLoopReview: async () => {
      loopCalls += 1;
      return JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] });
    },
    runSingleReview: async () => {
      singleCalls += 1;
      return JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] });
    },
    persistImplReview: async () => ({ markdown: "", json: {} }),
  });

  assert.equal(loopCalls, 1);
  assert.equal(singleCalls, 0);
});
