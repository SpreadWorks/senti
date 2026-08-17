# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Schema-repair prompt construction not pinned to a concrete builder/agent
**Target:** R3 / Tasks T-2 / src/flow/commands/review.js buildSpecReviewPrompt
**Improvement:** The spec describes the repair prompt's intent (rewrite the existing raw response into the required JSON shape without re-reviewing) but does not name where it is built or which agent/commandId it uses. Implementation can reuse the existing `flow.spec.review.propose` agent via `callReviewAgent` and a dedicated PromptBuilder; noting this would remove ambiguity.
**Why non-blocking:** Concrete integration points (proposeAgent, callReviewAgent, PromptBuilder, SPEC_REVIEW_FMT_FALLBACK) already exist and the prompt's behavioral constraints are stated, so the retry is implementable and testable as specified.

### 2. Behavior for a completely unparseable first response could be stated explicitly
**Target:** Data Flow / Acceptance Criteria
**Improvement:** The Data Flow and acceptance criteria scope schema-repair retry to a successfully parsed response that fails the schema after normalization (`parseSpecReviewJsonOutput` throws on JSON.parse + repairJson failure before normalization). Stating that a non-parseable first response remains an immediate failure (no retry) would make the intended boundary unambiguous.
**Why non-blocking:** The scope is already consistent (criteria reference a 'parsed response' and Issue #352 concerns valid JSON missing arrays); the unparseable path keeps the existing throw behavior, so implementation and tests are not blocked.

### 3. Normalization scope vs. shared parsing helpers
**Target:** src/flow/commands/review.js (extractJsonObjectCandidate / repairJson shared with impl-review)
**Improvement:** spec-review and impl-review share `extractJsonObjectCandidate`/`repairJson`. The Decisions note that missing-array defaulting applies only to the spec-review response shape; reaffirming that `parseImplReviewJsonOutput` stays unchanged would guard against accidentally relaxing impl-review parsing when adding normalization.
**Why non-blocking:** The spec already restricts normalization to spec-review response shape in Decisions, so the constraint is captured and impl-review behavior is not at risk of being changed by a correct implementation.
