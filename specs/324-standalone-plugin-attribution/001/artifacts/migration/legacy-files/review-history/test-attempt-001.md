# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/324-standalone-plugin-attribution/test-coverage.json`

## Blocking Findings

### 1. R2 cache-decision callback preservation is untested
**Target:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js
**Issue:** The R2 tests verify provider execution, thrown error behavior, and unchanged foreign flow/cache bytes, but no test installs or asserts a cache-decision callback during a no-flow call.
**Required change:** Add a spec-local no-flow test that passes the cache-decision callback option used by the target Agent API and asserts it is still invoked with the expected decision data while flow cache reads/writes and metrics remain skipped.
**Why blocking:** R2 explicitly requires no-flow calls to preserve cache-decision callbacks; without executable coverage, an implementation could drop or bypass that callback and still pass these tests.

### 2. R3 does not verify start log null attribution
**Target:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js
**Issue:** The R3 test checks the agent end entry and prompt context, but it never locates the agent start entry or asserts that start.spec, start.sentiPhase, and start.taskId are null.
**Required change:** Extend the R3 log test to assert the agent start entry retains the existing payload shape and has spec, sentiPhase, and taskId set to null.
**Why blocking:** R3 requires both start and end logs for no-flow calls to carry explicit null flow identity; an implementation could fix only end logging and still pass.

### 3. R7 layout matrix omits failure and repeated-call R6 scenarios
**Target:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js
**Issue:** The R7 matrix covers managed worktree, main single-flow, main multi-flow, and no-flow layouts, but each layout only performs one successful standalone call. It does not assert the R6 byte-snapshot invariant for provider failure or repeated equivalent calls in each layout.
**Required change:** For each R7 repository layout, exercise standalone provider success, provider failure, and repeated equivalent calls, asserting the seeded flow/cache snapshots remain byte-identical after each scenario.
**Why blocking:** R7 explicitly requires the R6 byte-snapshot coverage to hold for each repository layout; the current tests leave critical layout-specific failure and cache-repeat paths uncovered.

### 4. R8 core flow and cache-hit attribution are not covered
**Target:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js
**Issue:** The R8 test only covers an explicit flow-hook agent call and verifies one invocation metric plus a cache write. It does not cover existing core flow agent calls, nor does it verify existing cache-hit attribution remains unchanged.
**Required change:** Add spec-local tests for an existing core flow Agent.call path with ambient attribution and for a cache-hit path, asserting exactly one invocation metric per provider call and unchanged cache-hit attribution semantics.
**Why blocking:** R8 requires both existing core flow calls and existing cache-hit attribution to remain unchanged; regressions in either path would not be caught by the current test suite.


## Advisory Findings

No advisory findings.