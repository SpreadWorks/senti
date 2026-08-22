import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  formatReviewMd,
  NO_PROPOSALS_MARKER,
} from "../../../../src/flow/commands/review.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REVIEW_SOURCE_PATH = resolve(__dirname, "../../../../src/flow/commands/review.js");

describe("formatReviewMd — empty input (spec 219 R2)", () => {
  it("emits NO_PROPOSALS_MARKER line when no proposals", () => {
    const output = formatReviewMd([]);
    assert.ok(
      output.includes(NO_PROPOSALS_MARKER),
      `empty body must include NO_PROPOSALS_MARKER "${NO_PROPOSALS_MARKER}" but got:\n${output}`,
    );
  });

  it("emits body strictly longer than the bare header", () => {
    const output = formatReviewMd([]);
    const headerOnly = "# Code Review Results\n";
    assert.notEqual(
      output.trim(),
      headerOnly.trim(),
      "empty body must not degenerate to header-only output",
    );
  });
});

describe("formatReviewMd — entry count matches proposals (spec 247)", () => {
  it("renders one entry per proposal", () => {
    const results = [
      { title: "Alpha", body: "Body A" },
      { title: "Beta", body: "Body B" },
      { title: "Gamma", body: "Body C" },
    ];
    const output = formatReviewMd(results);
    const entries = output.split(/^### /m).slice(1);
    assert.equal(entries.length, results.length);
  });

  it("each entry contains its title without verdict markers", () => {
    const results = [
      { title: "OnlyOne", body: "Body" },
    ];
    const output = formatReviewMd(results);
    assert.match(output, /OnlyOne/);
    assert.doesNotMatch(output, /\*\*Verdict:\*\*/);
  });
});

describe("runReviewLoop structure — every terminal point writes review.md (spec 219 R1)", () => {
  it("contains no plain `return;` statement inside runReviewLoop that is not preceded by a writeReviewMd call", () => {
    const source = readFileSync(REVIEW_SOURCE_PATH, "utf8");
    const loopMatch = source.match(/async function runReviewLoop[\s\S]*?^\}/m);
    assert.ok(loopMatch, "runReviewLoop must exist in review.js");
    const body = loopMatch[0];

    const lines = body.split("\n");
    const plainReturnIndexes = [];
    for (let i = 0; i < lines.length; i += 1) {
      if (/^\s*return\s*;\s*$/.test(lines[i])) plainReturnIndexes.push(i);
    }

    for (const idx of plainReturnIndexes) {
      const windowStart = Math.max(0, idx - 6);
      const windowText = lines.slice(windowStart, idx).join("\n");
      assert.match(
        windowText,
        /writeReviewMd\s*\(/,
        `runReviewLoop has a 'return;' at line offset ${idx} (inside runReviewLoop) without a nearby writeReviewMd(...) call above it.\nContext:\n${lines.slice(windowStart, idx + 1).join("\n")}`,
      );
    }
  });
});

describe("NO_PROPOSALS_MARKER is a stable, identifiable string (spec 219 R2)", () => {
  it("is a non-empty string", () => {
    assert.equal(typeof NO_PROPOSALS_MARKER, "string");
    assert.ok(NO_PROPOSALS_MARKER.trim().length > 0);
  });

  it("conveys 'no proposals' in human-readable form", () => {
    assert.match(
      NO_PROPOSALS_MARKER,
      /no\s+proposals|no\s+approved\s+proposals|提案.*(なし|0)/i,
      `marker must read as 'no proposals' but got: ${NO_PROPOSALS_MARKER}`,
    );
  });
});
