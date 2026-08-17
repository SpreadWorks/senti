# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/296-review-gate-defer/test-coverage.json`

## Blocking Findings

### 1. Test-review retry budget is not proven across separate invocations
**Target:** tests/retry-exhaustion-defer.test.js: R5 test "test-review uses flow-level repair and reviewRetry budget"
**Issue:** R5 requires bounded flow-level repair between separate `senti flow run review --phase test` invocations, where each semantic FAIL invocation consumes the existing `reviewRetry` budget and only retry exhaustion delegates to acceptance-review. The test starts with a pre-exhausted metrics array and calls `checkReviewRetryBelowMax` once, so it does not prove that separate invocations consume the persisted budget or that non-exhausted semantic FAILs remain repairable before deferral.
**Required change:** Add a spec-local test that simulates at least two separate test-review invocations against persisted flow state: one below the retry limit that does not defer, followed by an exhausted invocation that defers unresolved semantic findings to acceptance-review.
**Why blocking:** The coverage artifact marks R5 covered, but the executable test does not cover the core flow-level repair behavior required by R5. An implementation could immediately defer only when preloaded with exhausted metrics while failing the separate-invocation budget behavior.


## Advisory Findings

### 1. Prose-token coverage is narrow
**Target:** tests/retry-exhaustion-defer.test.js: R3 test "prose words do not turn AI semantic findings into mechanical blockers"
**Improvement:** Consider adding examples with the trigger words in `title`, `body`, `reason`, and guardrail text fields, not only `observed` and nearby fixtures.
**Why non-blocking:** The existing tests do exercise semantic deferral despite prose containing words like missing, test, command, and schema-adjacent language, so this is an edge-expansion rather than a complete coverage gap.
