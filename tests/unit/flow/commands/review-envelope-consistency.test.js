import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  formatReviewMd,
  buildFinalValidationPrompt,
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

describe("formatReviewMd — entry count matches approved + rejected (spec 219 R3)", () => {
  it("renders one entry per approved/rejected result, count equals approved + rejected", () => {
    const results = [
      { title: "Alpha", body: "Body A", verdict: "APPROVED", reason: "" },
      { title: "Beta", body: "Body B", verdict: "REJECTED", reason: "not needed" },
      { title: "Gamma", body: "Body C", verdict: "APPROVED", reason: "" },
    ];
    const output = formatReviewMd(results);
    const entries = output.split(/^### /m).slice(1);
    const approved = results.filter((r) => r.verdict === "APPROVED").length;
    const rejected = results.filter((r) => r.verdict === "REJECTED").length;
    assert.equal(entries.length, approved + rejected);
  });

  it("each entry contains its title and the verdict marker", () => {
    const results = [
      { title: "OnlyOne", body: "Body", verdict: "APPROVED", reason: "" },
    ];
    const output = formatReviewMd(results);
    assert.match(output, /OnlyOne/);
    assert.match(output, /\*\*Verdict:\*\*\s*APPROVED/);
  });
});

describe("buildFinalValidationPrompt — scope-filtered input only (spec 219 R4)", () => {
  it("is exported as a callable function", () => {
    assert.equal(typeof buildFinalValidationPrompt, "function");
  });

  it("includes every kept proposal body in prompt text", () => {
    const proposals = [
      { title: "Kept1", body: "**File:** `src/a.js`\nBody-K1", file: "src/a.js" },
      { title: "Kept2", body: "**File:** `src/b.js`\nBody-K2", file: "src/b.js" },
    ];
    const diff = "diff --git a/src/a.js b/src/a.js\n";
    const prompt = buildFinalValidationPrompt(proposals, diff);
    assert.match(prompt, /Body-K1/);
    assert.match(prompt, /Body-K2/);
    assert.match(prompt, /Kept1/);
    assert.match(prompt, /Kept2/);
  });

  it("does not carry over proposals not in the passed list (excluded bodies absent)", () => {
    const proposals = [
      { title: "Kept", body: "**File:** `src/keep.js`\nBody-KEEP", file: "src/keep.js" },
    ];
    const diff = "";
    const prompt = buildFinalValidationPrompt(proposals, diff);
    assert.doesNotMatch(
      prompt,
      /Body-EXCLUDED/,
      "excluded-body text must not appear (prompt is built from passed array only)",
    );
    assert.doesNotMatch(prompt, /out-of-scope-title/i);
  });

  it("numbers proposals sequentially from 1 so verdict index lines up with array position", () => {
    const proposals = [
      { title: "First", body: "**File:** `src/x.js`\nFirstBody", file: "src/x.js" },
      { title: "Second", body: "**File:** `src/y.js`\nSecondBody", file: "src/y.js" },
      { title: "Third", body: "**File:** `src/z.js`\nThirdBody", file: "src/z.js" },
    ];
    const prompt = buildFinalValidationPrompt(proposals, "");
    assert.match(prompt, /###\s*1\..*First/s);
    assert.match(prompt, /###\s*2\..*Second/s);
    assert.match(prompt, /###\s*3\..*Third/s);
  });

  it("contains a 'Validate' instruction header so the AI knows the task", () => {
    const prompt = buildFinalValidationPrompt(
      [{ title: "P", body: "B", file: "src/p.js" }],
      "",
    );
    assert.match(prompt, /validate/i);
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
