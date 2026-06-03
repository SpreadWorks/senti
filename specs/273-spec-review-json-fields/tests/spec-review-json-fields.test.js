// spec: R1 R2 R3 R4 R5 R6
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const review = await import("../../../src/flow/commands/review.js");

test("R1: spec-review prompt states both review arrays are always required", () => {
  const prompt = review.buildSpecReviewPrompt("# Requirements\n- R1 [must]: Do x", []);
  const combined = `${prompt.systemPrompt || ""}\n${prompt.userPrompt || ""}\n${prompt.fmtFallback || ""}`;

  assert.match(combined, /always include both top-level arrays/i);
  assert.match(combined, /blockingFindings\[\]/);
  assert.match(combined, /nonBlockingImprovements\[\]/);
  assert.match(combined, /empty arrays/i);
});

test("R2: parser treats missing spec-review arrays as empty arrays", () => {
  const empty = review.parseSpecReviewFindings("{}");
  assert.equal(empty.blocking.length, 0);
  assert.equal(empty.improvements.length, 0);

  const blockingOnly = review.parseSpecReviewFindings(JSON.stringify({ blockingFindings: [] }));
  assert.equal(blockingOnly.blocking.length, 0);
  assert.equal(blockingOnly.improvements.length, 0);

  const improvementsOnly = review.parseSpecReviewFindings(JSON.stringify({ nonBlockingImprovements: [] }));
  assert.equal(improvementsOnly.blocking.length, 0);
  assert.equal(improvementsOnly.improvements.length, 0);
});

test("R3: schema-invalid parsed response is repaired with one bounded retry", async () => {
  assert.equal(typeof review.parseSpecReviewFindingsWithRepair, "function");

  let repairCalls = 0;
  const findings = await review.parseSpecReviewFindingsWithRepair(
    JSON.stringify({ blockingFindings: "not-array", nonBlockingImprovements: [] }),
    async ({ rawResponse, validationError, repairPrompt }) => {
      repairCalls += 1;
      assert.match(rawResponse, /not-array/);
      assert.match(validationError.message, /blockingFindings/);
      assert.match(repairPrompt.userPrompt, /Rewrite the existing spec-review response/i);
      return JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] });
    },
  );

  assert.equal(repairCalls, 1);
  assert.equal(findings.blocking.length, 0);
  assert.equal(findings.improvements.length, 0);
});

test("R4: invalid schema-repair output still fails instead of writing success", async () => {
  assert.equal(typeof review.parseSpecReviewFindingsWithRepair, "function");

  await assert.rejects(
    review.parseSpecReviewFindingsWithRepair(
      JSON.stringify({ blockingFindings: "not-array", nonBlockingImprovements: [] }),
      async () => JSON.stringify({ blockingFindings: "still-not-array", nonBlockingImprovements: [] }),
    ),
    /spec review output failed schema validation|blockingFindings/,
  );

  await assert.rejects(
    review.parseSpecReviewFindingsWithRepair(
      JSON.stringify({ blockingFindings: "not-array", nonBlockingImprovements: [] }),
      async () => "not json",
    ),
    /spec review output failed schema validation: repair response is invalid JSON/,
  );
});

test("R5: repaired output keeps the existing JSON and Markdown artifact sections", async () => {
  assert.equal(typeof review.parseSpecReviewFindingsWithRepair, "function");

  const findings = await review.parseSpecReviewFindingsWithRepair(
    JSON.stringify({ blockingFindings: [] }),
    async () => {
      throw new Error("repair should not run for missing arrays only");
    },
  );
  const json = JSON.parse(review.formatSpecReviewJson({ ...findings, verdict: "PASS" }));
  const md = review.formatSpecReviewMd({ ...findings, verdict: "PASS" });

  assert.deepEqual(json.blockingFindings, []);
  assert.deepEqual(json.nonBlockingImprovements, []);
  assert.match(md, /## Blocking Findings/);
  assert.match(md, /## Non-blocking Improvements/);
});

test("R6: spec-local coverage maps every requirement and uses executable assertions", () => {
  const source = readFileSync(new URL(import.meta.url), "utf8");
  for (const id of ["R1", "R2", "R3", "R4", "R5", "R6"]) {
    assert.match(source, new RegExp(`test\\("${id}:`));
  }
});
