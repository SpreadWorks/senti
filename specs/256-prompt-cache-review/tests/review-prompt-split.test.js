// spec: R3 R4 R5
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildDraftReviewPrompt,
  buildDraftSystemPrompt,
  buildGapAnalysisPrompt,
  buildSpecReviewPrompt,
  buildTestFixPrompt,
  runReviewLoop,
} from "../../../src/flow/commands/review.js";

const contextEntries = [
  { file: "src/example.js", summary: "example summary" },
];

function assertInstructionSplit(payload, systemNeedles, userNeedles) {
  assert.equal(typeof payload.systemPrompt, "string");
  assert.equal(typeof payload.userPrompt, "string");
  for (const needle of systemNeedles) {
    assert.ok(payload.systemPrompt.includes(needle), `systemPrompt should include: ${needle}`);
    assert.ok(!payload.userPrompt.includes(needle), `userPrompt should not include: ${needle}`);
  }
  for (const needle of userNeedles) {
    assert.ok(payload.userPrompt.includes(needle), `userPrompt should include: ${needle}`);
  }
}

describe("review prompt cache-friendly prompt split", () => {
  it("R3: spec-review keeps reviewer instructions in systemPrompt", () => {
    const payload = buildSpecReviewPrompt("SPEC TEXT", contextEntries);

    assertInstructionSplit(
      payload,
      [
        "You are a spec completeness reviewer",
        "Focus on:",
        "Output a numbered list of proposals",
      ],
      ["## Spec", "SPEC TEXT", "## Codebase Context"],
    );
  });

  it("R4: review-draft keeps reviewer instructions in systemPrompt", () => {
    const payload = buildDraftReviewPrompt(
      { qa: [{ question: "Q", answer: "A", evidence: "E", why: "W" }] },
      "REQUEST TEXT",
      contextEntries,
    );

    assertInstructionSplit(
      payload,
      [
        "You are a draft QA quality reviewer",
        "Focus on:",
        "Output a numbered list of issues",
      ],
      ["## Request / Issue", "REQUEST TEXT", "## Draft QA Entries"],
    );
  });

  it("R5: test-review gap analysis keeps stable test design in systemPrompt", () => {
    const payload = buildGapAnalysisPrompt("TEST DESIGN", [
      { source: "specs/x/tests/a.test.js", content: "test('a', () => {});" },
    ]);

    assert.equal(typeof payload.systemPrompt, "string");
    assert.equal(typeof payload.userPrompt, "string");
    assert.ok(payload.systemPrompt.includes("TEST DESIGN"));
    assert.ok(!payload.userPrompt.includes("## Test Design"));
    assert.ok(payload.userPrompt.includes("## Existing Test Code"));
  });

  it("R5: test-review fix prompt reuses the same testDesign through systemPrompt", () => {
    const payload = buildTestFixPrompt("TEST DESIGN", "### GAP-1: Missing", [
      { source: "specs/x/tests/a.test.js", content: "test('a', () => {});" },
    ]);

    assert.equal(typeof payload.systemPrompt, "string");
    assert.equal(typeof payload.userPrompt, "string");
    assert.ok(payload.systemPrompt.includes("TEST DESIGN"));
    assert.ok(!payload.userPrompt.includes("## Test Design"));
    assert.ok(payload.userPrompt.includes("## Gaps to fix"));
    assert.ok(payload.userPrompt.includes("## Current test code"));
  });

  // ─── GAP-2 / TC-10: buildDraftSystemPrompt behavioral verification ───────
  //
  // Per the source-of-truth investigation, `buildDraftSystemPrompt(guardrails)`
  // is the function that carries the `## Additional Guardrail Review
  // Perspectives` heading. It returns a single system-prompt string (not a
  // {systemPrompt, userPrompt} payload) — this is the impl-review reviewer
  // prompt that the agent receives as its system prompt. We invoke it with
  // representative inputs and assert the heading lands in the returned string
  // (i.e. in the system slot), satisfying TC-10's intent that the heading is
  // never in user-side content.

  describe("buildDraftSystemPrompt — guardrail review perspectives placement (GAP-2 / TC-10)", () => {
    it("returns a system prompt string that includes the Additional Guardrail Review Perspectives heading when guardrails are present", () => {
      const guardrails = [
        { id: "no-sync-io", title: "No Sync I/O", body: "Avoid sync I/O in hot paths." },
        { id: "no-secrets", title: "No Hardcoded Secrets", body: "Never embed credentials." },
      ];
      const result = buildDraftSystemPrompt(guardrails);
      assert.equal(typeof result, "string", "buildDraftSystemPrompt must return a string");
      assert.ok(result.length > 0, "system prompt must be non-empty");
      assert.ok(
        result.includes("## Additional Guardrail Review Perspectives"),
        `system prompt must contain the Additional Guardrail Review Perspectives heading; got first 300 chars:\n${result.slice(0, 300)}`,
      );
    });

    it("returned system prompt embeds the diff-scope reviewer constraint (sanity check; the system slot owns reviewer rules)", () => {
      const guardrails = [{ id: "x", title: "X", body: "x rule" }];
      const result = buildDraftSystemPrompt(guardrails);
      // Reviewer instructions belong in the system prompt (cache-friendly);
      // user prompt content (diff/spec text) is supplied at call time and is
      // therefore NOT in this string.
      assert.match(
        result,
        /diff|touched|changed/i,
        "reviewer system prompt must mention diff scope (reviewer rules live in system prompt)",
      );
    });

    it("returned system prompt does not contain user-supplied content placeholders such as a Spec section or a Diff section", () => {
      const guardrails = [{ id: "x", title: "X", body: "x rule" }];
      const result = buildDraftSystemPrompt(guardrails);
      // The system prompt is the stable cache key — it must not embed per-call
      // user content section markers.
      assert.ok(
        !result.includes("## Spec\n") && !result.includes("\n## Spec "),
        "system prompt must not embed user-side '## Spec' content section",
      );
      assert.ok(
        !result.includes("## Git Diff\n"),
        "system prompt must not embed user-side '## Git Diff' content section",
      );
    });
  });
});
