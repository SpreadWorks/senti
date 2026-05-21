// spec: R14
// review-test coverage artifacts report spec-local files relative to this spec directory.
// `tests/impl-review-shared-contracts.test.js` means this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as reviewCommand from "../../../src/flow/commands/review.js";
import * as runReview from "../../../src/flow/lib/run-review.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

const {
  filterImplReviewFindingsByScope,
  formatImplReviewJson,
  formatImplReviewMd,
  parseImplReviewFindings,
} = reviewCommand;
const {
  parseImplReviewOutput,
  updateReviewRetryCounter,
} = runReview;

test("R14: shared regression contract covers structured impl review behavior", async () => {
  const parsed = parseImplReviewFindings(JSON.stringify({
    blockingFindings: [{
      title: "Missing artifact",
      failureMode: "missing_acceptance_requirement",
      requirementId: "R4",
      issue: "impl-review.json is not written.",
      suggestion: "Write impl-review.json.",
      rationale: "The machine-readable artifact is required.",
    }],
    nonBlockingImprovements: [{
      title: "Optional prompt cleanup",
      failureMode: "docs",
      file: "src/flow/prompts/impl/review.md",
      issue: "One sentence could be clearer.",
      suggestion: "Clarify that sentence.",
      rationale: "Prompt polish is non-blocking.",
    }],
  }));
  const filtered = filterImplReviewFindingsByScope({
    parsed,
    touchedFiles: new Set(["src/flow/prompts/impl/review.md"]),
    requirementIds: new Set(["R4"]),
  });
  const json = JSON.parse(formatImplReviewJson(filtered));
  const md = formatImplReviewMd(json);
  const advisory = parseImplReviewOutput(
    { ok: true },
    "Impl review ADVISORY. 1 non-blocking improvement(s) recorded. See review.md.",
    "  [review] Results saved to specs/demo/review.md\n  [review] verdict=ADVISORY blocking=0 nonBlocking=1",
  );

  const metrics = [];
  updateReviewRetryCounter({
    phase: null,
    flowState: {},
    flowManager: {
      appendMetric(payload, opts) {
        metrics.push({ payload, opts });
      },
    },
  }, advisory);

  const updates = [];
  await FLOW_COMMANDS.run.review.post({
    phase: null,
    flowState: {},
    flowManager: {
      appendMetric() {},
      updateStepStatus(stepId, status) {
        updates.push({ stepId, status });
      },
    },
  }, advisory);

  assert.equal(json.verdict, "FAIL");
  assert.match(md, /Missing artifact/);
  assert.match(md, /Optional prompt cleanup/);
  assert.equal(advisory.next, "gate-impl");
  assert.deepEqual(metrics[0].payload, { phase: "impl", counter: "reviewRetry", delta: 0, reset: true });
  assert.deepEqual(updates, [{ stepId: "review", status: "done" }]);
});
