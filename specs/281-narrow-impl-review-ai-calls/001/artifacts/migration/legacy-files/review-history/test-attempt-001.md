# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/281-narrow-impl-review-ai-calls/test-coverage.json`

## Blocking Findings

### 1. Behavioral loop review requirements are covered only by source-text assertions
**Target:** specs/281-narrow-impl-review-ai-calls/tests/loop-review-call-limit.test.js
**Issue:** R2, R3, R4, R5, and R7 are asserted primarily by reading src/flow/commands/review.js and matching regexes against function source. These tests can pass without exercising production behavior, and they can fail for valid implementations that satisfy the requirements with different local names or control flow.
**Required change:** Replace source-text assertions for loop review behavior with executable tests that call the relevant review path using stubbed AI review functions or injectable dependencies, then assert call counts, chunk batching, cross-check invocation, duplicate-hash skipping, and active-path selection from observed behavior.
**Why blocking:** The tests have a static anti-pattern that would pass without exercising production behavior, leaving the acceptance requirements without reliable spec-local regression coverage.

### 2. R2 test encodes a specific implementation formula instead of the batching contract
**Target:** specs/281-narrow-impl-review-ai-calls/tests/loop-review-call-limit.test.js
**Issue:** The R2 test requires the literal expression Math.ceil(groups.length / MAX_LOOP_CALLS) and a specific for-loop shape. A correct implementation could batch groups to at most 16 per-chunk AI calls using another algorithm, while this test would reject it; conversely, the regex can pass even if the resulting chunks are not actually used for AI calls.
**Required change:** Assert the contract by constructing more than 16 grouped diffs, running loop review with an AI-call stub, and verifying the number of per-chunk review calls is at most 16.
**Why blocking:** The test encodes an implementation premise rather than the acceptance requirement, so it does not provide valid coverage for R2.

### 3. R6 artifact preservation is not tied to loop review persistence behavior
**Target:** specs/281-narrow-impl-review-ai-calls/tests/loop-review-call-limit.test.js
**Issue:** The R6 test separately calls formatImplReviewJson and formatImplReviewMd, then uses source order checks to infer that loop review results are persisted through the existing artifact helpers. It does not execute the active review flow or verify that findings returned by loop review are written to review.md and impl-review.json in the existing formats.
**Required change:** Add an executable active-path test where loop review returns known findings, then assert the generated review.md and impl-review.json content preserve the existing formatter output shape for those findings.
**Why blocking:** R6 requires preserving recorded impl review output formats in the loop review path; the current test does not exercise that production path and can pass without proving the requirement.


## Advisory Findings

No advisory findings.