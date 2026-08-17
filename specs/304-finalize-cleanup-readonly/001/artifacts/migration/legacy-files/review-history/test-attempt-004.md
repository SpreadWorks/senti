# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/304-finalize-cleanup-readonly/test-coverage.json`

## Blocking Findings

### 1. R5 durable surface contents are not exercised
**Target:** specs/304-finalize-cleanup-readonly/tests/finalize-cleanup-readonly.test.js: R5 test and coverage artifact
**Issue:** The R5 test only checks that report-envelope and plugin-hook-output owners are observable and outside the worktree. It does not exercise or assert preservation of the required warning data, plugin hook warning/follow-up data, or recovery envelopes after relocation.
**Required change:** Add spec-local executable coverage that writes or records finalize-cleanup report warnings, plugin hook warning/follow-up data, and recovery envelope data through the relocated cleanup path, then asserts those caller-visible contents remain available outside the target worktree.
**Why blocking:** R5 is marked covered, but a required retained surface, especially recovery envelopes and warning/follow-up contents, can be dropped while these tests still pass.


## Advisory Findings

### 1. R4 aggregation test is broad
**Target:** specs/304-finalize-cleanup-readonly/tests/finalize-cleanup-readonly.test.js: R4 test
**Improvement:** Consider splitting the R4 umbrella test into named cases for metrics relocation, normal worktree removal, and feature branch deletion.
**Why non-blocking:** The current assertions do cover the listed behaviors, but separate tests would make future coverage drift easier to diagnose.
