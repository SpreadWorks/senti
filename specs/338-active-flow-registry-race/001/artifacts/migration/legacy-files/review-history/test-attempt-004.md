# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/338-active-flow-registry-race/test-coverage.json`

## Blocking Findings

### 1. R4 lock and revision failures are injected at the wrong boundary
**Target:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js: R4 test cases for registry operation lock failure and registry revision conflict
**Issue:** The test replaces `flow.manager.loadActiveFlows`, but the acceptance-decision path may verify registry preservation through `ActiveFlowRegistry` or another manager method. If production code never calls this overridden method, these R4 cases will pass or fail for the wrong reason and will not prove the required registry operation lock/revision-conflict boundaries.
**Required change:** Inject the lock-failure and revision-conflict faults at the actual registry operation used by acceptance-decision registry verification, or assert that the exercised production path necessarily calls the overridden method.
**Why blocking:** R4 and R5 require each failure boundary to be injected and prove no registry entry loss. These two cases currently encode an implementation premise about the method call site rather than the required external behavior.

### 2. R4 does not verify unsuccessful transition reporting
**Target:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js: R4 test
**Issue:** The R4 requirement says failures must return an explicit failure without reporting a successful acceptance-decision transition. The test only asserts thrown error codes, registry preservation, flow bytes, and the step remaining `in_progress`; it does not check that no success result/transition message is produced or recorded.
**Required change:** Add a spec-local assertion for the failure contract that would catch a reported successful acceptance-decision transition on each injected failure path.
**Why blocking:** A critical part of R4 has no direct regression coverage, so an implementation could preserve files and throw/record inconsistently while still reporting a successful transition.


## Advisory Findings

No advisory findings.