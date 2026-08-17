# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/303-workunit-review-resume/test-coverage.json`

## Blocking Findings

### 1. R7 cross-check invalidation contradicts chunk reuse
**Target:** specs/303-workunit-review-resume/tests/cross-check-fallback.test.js, test "R7: loop cross-check is checkpointed and reused by summary hashes"
**Issue:** The final `summaryVersion = "v2"` assertion expects `crossCheckCalls` to increase even though the chunk WorkUnit inputs, target files, provider identity, prompt version, and schema version are unchanged. Under R4, the chunk success checkpoints should be reused without calling `reviewChunk`, so the chunk summaries used for the cross-check should remain the cached v1 summaries.
**Required change:** Make the final invalidation step change a planned chunk identity, for example by including the version in `buildChunkInput`, then assert the stale chunk reruns and the cross-check reruns from the new summary hashes.
**Why blocking:** As written, the test encodes an incorrect implementation premise and can reward re-executing cached chunk WorkUnits, contradicting R4 while testing R7.

### 2. R5 immediate checkpoint ordering is not exercised
**Target:** specs/303-workunit-review-resume/tests/loop-review-resume.test.js, test "R5: later chunk tooling failure preserves earlier success checkpoints without final artifacts"
**Issue:** The test checks checkpoint counts only after the failing run returns. An implementation could defer saving the first successful chunk until failure handling and still pass. The test also has no later chunk or cross-check spy to prove execution stops after the failure.
**Required change:** Assert during the second chunk execution that the first success checkpoint already exists, and add a third chunk or cross-check spy asserting no later WorkUnit or next step runs after the failure.
**Why blocking:** R5 specifically requires saving success checkpoints before executing later WorkUnits and stopping without advancing; the current test would pass without exercising that production behavior.

### 3. R5/R10 execution coverage misses retryable failure kinds
**Target:** specs/303-workunit-review-resume/tests/loop-review-resume.test.js
**Issue:** Only `provider_failure` is exercised through WorkUnit execution. `timeout`, `parser_failure`, and `schema_failure` are only partially covered by classification or normalization checks, not by a run that saves a failed checkpoint, suppresses final artifacts, and returns impl `TOOLING_FAILURE` without consuming semantic review retry.
**Required change:** Parameterize the WorkUnit execution failure scenario, or add focused tests, for `timeout`, `parser_failure`, and `schema_failure` across the loop review/run-review boundary.
**Why blocking:** R5 and R10 require these failure kinds to behave as checkpointed tooling failures; there is no corresponding executable spec-local coverage for that behavior.

### 4. R8 fallback threshold has no positive trigger assertion
**Target:** specs/303-workunit-review-resume/tests/cross-check-fallback.test.js, test "R8: two retryable parent failures split only that parent into one-level bounded children"
**Issue:** `shouldFallbackSplit` is asserted false for one retryable failure, mixed parents, and non-retryable failures, but never asserted true for two retryable failures on the same parent. `planFallbackChildWorkUnits` is called directly, so an implementation where the production threshold never triggers fallback could still satisfy the test.
**Required change:** Add a positive assertion or integrated scenario where two retryable failed checkpoints for the same parent cause child WorkUnits to be planned and executed.
**Why blocking:** R8's core acceptance condition is the two-failure trigger; the current test has a static anti-pattern that can pass without exercising that production decision.


## Advisory Findings

### 1. R9 root-relative matching boundary is light
**Target:** specs/303-workunit-review-resume/tests/review-exclusions.test.js
**Improvement:** Add a case using absolute paths under the temporary repository root, or paths requiring normalization such as `./generated/client.js`, to prove the matcher really performs one repository-root-relative decision.
**Why non-blocking:** The current test already covers default plus configured exclusions before touched-file filtering, diff collection, and chunk creation; this would harden an edge of the matcher contract.
