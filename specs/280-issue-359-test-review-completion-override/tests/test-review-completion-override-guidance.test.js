// spec: R5
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const TEST_REVIEW_PROMPT = path.join(ROOT, "src/flow/prompts/plan/test-review.md");

function readTestReviewPrompt() {
  return fs.readFileSync(TEST_REVIEW_PROMPT, "utf8");
}

function assertIncludesAll(text, patterns) {
  for (const pattern of patterns) {
    assert.match(text, pattern);
  }
}

describe("test-review completion override guidance", () => {
  it("R5: documents TOOLING_FAILURE override evidence fields and boundaries", () => {
    const prompt = readTestReviewPrompt();

    assertIncludesAll(prompt, [
      /TOOLING_FAILURE/,
      /not (?:a )?test-quality failure|not (?:a )?test quality failure/i,
      /completion-overrides\.json/,
      /entries\.test-review/,
      /userApproval\s*=\s*true/,
      /reason/,
      /approvedAt/,
      /approvedBy/,
      /findings\[\]/,
      /findings\[\][^\n]*(?:non-empty|at least one|required)/i,
      /findingId/,
      /disposition/,
      /successorOwner/,
      /acceptedRisk/,
      /out_of_scope/,
      /transferred_to_successor/,
      /accepted_risk/,
      /false_positive/,
      /test-review:tooling_failure:<toolingFailure>/,
      /parser_error/,
      /issue-log|related task/i,
      /accepted_risk[\s\S]{0,200}(?:audit|task trail|related task)/i,
      /(?:issue-log TOOLING_FAILURE entry|TOOLING_FAILURE issue-log entry|explicit related task reference)/i,
      /free-text issue-log alone|issue-log alone/i,
    ]);
  });
});
