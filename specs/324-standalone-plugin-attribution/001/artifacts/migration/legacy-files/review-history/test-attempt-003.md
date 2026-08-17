# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/324-standalone-plugin-attribution/test-coverage.json`

## Blocking Findings

### 1. No-flow layout is not actually no-flow
**Target:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js R7 / makeLayout
**Issue:** The `no-flow` matrix case passes `activeCount: 0`, but `makeLayout` still creates one `specs/foreign-1/flow.json`, one `.senti/agent-cache/...` file, and one context because the loop uses `Math.max(activeCount, 1)`. With `withFlowManager: false`, this covers a repository with no flow manager but still seeded flow artifacts, not a no-flow repository layout.
**Required change:** Adjust the fixture or add a separate R7 case that constructs a repository layout with no active flow artifacts/contexts and verifies standalone calls do not create or mutate flow/cache state.
**Why blocking:** R7 explicitly requires spec-local tests to construct a no-flow repository layout; the current artifact marks R7 covered, but the test does not exercise that layout.

### 2. R4 does not assert core-bound attribution cannot be overridden
**Target:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js R4
**Issue:** The R4 test records delegated `resolve` and `call` options but only asserts command namespacing plus provider/profile precedence. It never asserts that delegated options include the core-bound no-flow attribution after plugin/user options, so an implementation could pass this test while allowing plugin-supplied `flowAttribution` to override the core binding.
**Required change:** Add an assertion in the R4 delegate test that both delegated `resolve` and `call` receive the enforced no-flow attribution even when caller options attempt to supply a different attribution mode.
**Why blocking:** R4 specifically requires the plugin cannot override the core-bound attribution mode; the current R4 coverage omits that contract and the coverage artifact incorrectly marks it covered.


## Advisory Findings

No advisory findings.