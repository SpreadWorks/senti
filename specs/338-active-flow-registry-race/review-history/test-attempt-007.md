# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/338-active-flow-registry-race/test-coverage.json`

## Blocking Findings

### 1. R6 bounded repair recovery does not cover the permitted test-review-gate retry
**Target:** specs/338-active-flow-registry-race/tests/bounded-recovery.test.js
**Issue:** The R6 test exercises the first impl-repair recovery and then manually moves the flow back to impl-gate, but it never proves that the recovery permits exactly one subsequent test-review-gate evaluation. No test-review-gate transition or second evaluation boundary is asserted.
**Required change:** Add spec-local coverage that, after the one allowed impl-repair recovery, drives the flow through the subsequent test-review-gate evaluation and asserts exactly one retry is permitted before further recovery/evaluation is rejected.
**Why blocking:** R6 explicitly requires permitting one subsequent test-review-gate evaluation; the current executable test does not cover that acceptance requirement.

### 2. R6 repair recovery does not prove only leaf steps from test-execute through finalize-cleanup are invalidated
**Target:** specs/338-active-flow-registry-race/tests/bounded-recovery.test.js
**Issue:** The test checks that draft is unchanged and a few downstream statuses/artifacts change, but it does not enumerate the full affected leaf-step range from test-execute through finalize-cleanup or assert that steps outside that range remain untouched.
**Required change:** Add assertions comparing pre/post statuses for every relevant leaf step, proving only the intended test-execute through finalize-cleanup leaf steps are invalidated and unrelated flow state is unchanged.
**Why blocking:** R6 requires precise invalidation scope; partial spot checks can pass while recovery mutates too much or too little of the flow.


## Advisory Findings

No advisory findings.