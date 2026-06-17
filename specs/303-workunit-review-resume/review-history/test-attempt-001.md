# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/303-workunit-review-resume/test-coverage.json`

## Blocking Findings

### 1. R4 chunk reuse is only tested as a primitive decision, not production behavior
**Target:** specs/303-workunit-review-resume/tests/workunit-primitives.test.js
**Issue:** The R4 test calls WorkUnitResumeDecision.fromCheckpoint directly but never verifies that loop chunk execution actually uses a matching success checkpoint to skip the provider and only calls the provider for missing, failed, or stale WorkUnits. An implementation could pass this test while runLoopReviewWithDependencies still calls reviewChunk for every chunk on resume.
**Required change:** Add a spec-local executable test around loop review execution that preloads or creates matching, failed, and stale loop-chunk checkpoints, counts reviewChunk calls, and asserts only non-reusable chunks invoke the provider.
**Why blocking:** R4's acceptance behavior is the resume behavior in loop chunk execution, not just the standalone decision helper; current coverage can pass without exercising production behavior.

### 2. R6 does not test final artifact generation
**Target:** specs/303-workunit-review-resume/tests/loop-review-resume.test.js
**Issue:** The R6 success test only converts proposals with loopProposalsToImplReviewJson and does not provide a specDir or assert that impl-review.json and review.md are written after all WorkUnits succeed. It also does not assert review.md generation at all.
**Required change:** Change or add the R6 test to run the loop review with a specDir and assert impl-review.json and review.md are absent before failure cases and present only after every planned WorkUnit succeeds.
**Why blocking:** R6 explicitly requires generation of final review artifacts only after all required WorkUnits succeed; the current test can pass with no artifact-writing implementation.

### 3. R7 cross-check hash identity and planning condition are not covered
**Target:** specs/303-workunit-review-resume/tests/cross-check-fallback.test.js
**Issue:** The R7 test only reruns identical inputs and checks crossCheckCalls is 1. It does not prove the cross-check WorkUnit is planned only when at least two chunk summaries exist and reviewCallCount is below MAX_LOOP_CALLS, nor that a changed chunk summary hash invalidates reuse.
**Required change:** Add assertions that one-summary or max-call-reached plans do not execute or checkpoint cross-check, and that changing a chunk summary causes a new cross-check execution rather than reusing the old checkpoint.
**Why blocking:** An implementation could cache cross-checks unconditionally by kind or stable key and still pass, while violating the required planning condition and summary-hash identity.

### 4. R8 fallback split threshold and aggregation are under-tested
**Target:** specs/303-workunit-review-resume/tests/cross-check-fallback.test.js
**Issue:** The R8 test only calls planFallbackChildWorkUnits with two retryable failures and checks the returned child shape. It does not assert that one failure does not split, non-retryable failures do not split, only the same parent is considered, child WorkUnits are not split after failures, or that successful child results are aggregated at the parent position without writing a parent success checkpoint.
**Required change:** Add executable tests for the negative split cases and the loop execution aggregation case, including an assertion that no parent success checkpoint is written when children succeed.
**Why blocking:** R8's core acceptance criteria are the threshold, one-level limit, and parent-position aggregation; current tests could pass with an always-split helper that is never integrated into review execution.

### 5. R9 uses function arity instead of exercising exclusion application points
**Target:** specs/303-workunit-review-resume/tests/review-exclusions.test.js
**Issue:** The test asserts collectTouchedFiles.length >= 3, which can pass without proving exclusions are applied before touched file counting, per-file diff collection, or loop review chunk creation. It only validates the matcher in isolation.
**Required change:** Replace the arity assertion with executable coverage that runs touched-file collection and chunk creation/diff input setup with excluded files present, then asserts excluded files are absent from the touched count, diff collection inputs, and loop chunks.
**Why blocking:** This is a static anti-pattern that can pass without exercising the required production behavior for R9.

### 6. R10 does not exercise WorkUnit execution failure accounting
**Target:** specs/303-workunit-review-resume/tests/loop-review-resume.test.js
**Issue:** The R10 test only normalizes a prebuilt TOOLING_FAILURE object. It does not verify that provider failure, timeout, parser failure, or schema failure inside WorkUnit execution avoid semantic reviewRetry consumption, nor that checkpoint I/O failure and invariant violation are non-retryable command failures and do not count toward fallback splitting.
**Required change:** Add execution-level tests that trigger retryable WorkUnit failures and non-retryable checkpoint/invariant failures, then assert reviewRetryConsumed, fallback split eligibility, and failure classification.
**Why blocking:** R10 is about behavior during WorkUnit execution and fallback accounting; current coverage can pass with only a normalization helper implemented.

### 7. R11 retained public surfaces are tested through a helper only
**Target:** specs/303-workunit-review-resume/tests/retained-surfaces.test.js
**Issue:** The R11 test checks shouldUseWorkUnitsForReviewPhase return values but does not run or inspect the retained public surfaces. An implementation could return false from the helper while single-shot impl-review, gates, test-review, draft-review, or spec-review still create WorkUnit checkpoint artifacts.
**Required change:** Add spec-local tests that invoke or minimally exercise each retained review/gate path with a specDir and assert no review-history/work-units artifacts are created.
**Why blocking:** R11 requires preserved behavior of public surfaces, and the current helper-only test can pass without exercising those surfaces.

### 8. R2 full identity inputs and stable unitId fields are incomplete
**Target:** specs/303-workunit-review-resume/tests/workunit-primitives.test.js
**Issue:** The R2 test checks inputHash, providerIdentity, promptVersion, and schemaVersion differences, but does not verify normalized targetFiles or commandId are part of the full identity, nor that phase, kind, stableOrderKey, and parentUnitId drive unitId changes. It also does not verify target file normalization semantics.
**Required change:** Add assertions that commandId and normalized targetFiles affect matchesFullIdentity, that equivalent target file order/path normalization still matches, and that changing phase, kind, stableOrderKey, or parentUnitId changes unitId.
**Why blocking:** R2 defines the exact identity and lookup fields; omitting these assertions lets an incorrect identity implementation pass while breaking checkpoint reuse safety.

### 9. R3 required checkpoint fields are not fully asserted
**Target:** specs/303-workunit-review-resume/tests/workunit-primitives.test.js
**Issue:** The R3 test verifies the checkpoint path and a subset of serialized fields, but does not assert required persisted fields such as top-level targetFiles, inputHash, provider identity, promptVersion, schemaVersion, startedAt, finishedAt, and success or failure payloads.
**Required change:** Extend the checkpoint serialization assertion to cover every required persisted field in R3, including timestamps and optional success/failure fields when present.
**Why blocking:** R3 is a persistence contract; partial field assertions can pass while required checkpoint data is omitted.


## Advisory Findings

### 1. R1 invariant coverage could be more explicit
**Target:** specs/303-workunit-review-resume/tests/workunit-primitives.test.js
**Improvement:** Add focused assertions for missing required WorkUnitIdentity fields and explicit toJSON/from-serialized behavior, in addition to the current class existence and invalid status checks.
**Why non-blocking:** Other tests exercise parts of identity comparison, stale detection, and checkpoint serialization, so this is an improvement to precision rather than a standalone blocker.
