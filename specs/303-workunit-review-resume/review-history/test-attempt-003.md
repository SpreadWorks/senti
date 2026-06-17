# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/303-workunit-review-resume/test-coverage.json`

## Blocking Findings

### 1. R6 success-count assertion contradicts required cross-check WorkUnit
**Target:** specs/303-workunit-review-resume/tests/loop-review-resume.test.js: R6 final review artifacts are produced only after every planned WorkUnit succeeds
**Issue:** The test uses two chunk groups with maxLoopCalls set to 4, so the R7 cross-check condition holds and a cross-check WorkUnit is part of the current plan. The test then asserts only two successful checkpoints, which excludes the required cross-check checkpoint.
**Required change:** Either make the R6 scenario avoid cross-check planning, for example by using one group or maxLoopCalls that is not above the chunk call count, or update the expected success checkpoint count to include the cross-check WorkUnit.
**Why blocking:** An implementation that satisfies R7 by planning and checkpointing cross-checks under these conditions would fail this R6 test despite being correct.

### 2. Parser and schema failure coverage is simulated instead of exercising production parsing
**Target:** specs/303-workunit-review-resume/tests/loop-review-resume.test.js: R5 timeout parser and schema failures are checkpointed tooling failures
**Issue:** The parser_failure and schema_failure cases are tested by throwing WorkUnitToolingFailure from the reviewChunk dependency. That can pass without validating that successful provider responses are parsed, schema-checked, checkpointed as failures, and returned as TOOLING_FAILURE when the actual parser or schema validation fails.
**Required change:** Add at least one parser/schema failure case where reviewChunk returns malformed or schema-invalid provider output and the production parsing/validation path creates the failed checkpoint and TOOLING_FAILURE result.
**Why blocking:** R5 explicitly covers parser and schema failures after provider execution; the current test can pass while the production parser/schema failure path is unimplemented.

### 3. Non-retryable command failure behavior is not covered
**Target:** specs/303-workunit-review-resume/tests/loop-review-resume.test.js: R10 WorkUnit tooling failures normalize without semantic reviewRetry consumption
**Issue:** The test only asserts checkpoint_io_failure and invariant_violation are retryable false and do not trigger fallback splitting. It does not assert they are command failures rather than tooling failures, nor that they avoid semantic reviewRetry consumption across the command/run-review boundary.
**Required change:** Add a focused assertion or scenario that checkpoint I/O failure and invariant violation normalize or propagate as non-retryable command failures, distinct from WorkUnit TOOLING_FAILURE, and do not consume semantic reviewRetry.
**Why blocking:** R10 requires command-failure classification for these failure kinds; the current tests would allow an implementation to classify them as retryable-false tooling failures and still pass.


## Advisory Findings

No advisory findings.