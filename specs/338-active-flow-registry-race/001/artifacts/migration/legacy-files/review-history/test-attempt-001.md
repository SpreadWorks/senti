# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/338-active-flow-registry-race/test-coverage.json`

## Blocking Findings

### 1. R1 flow-state mutation coverage is missing
**Target:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Issue:** The tests use a single in-memory state object and never create or compare bound versus unbound flow.json files. They do not prove that the acceptance-decision write retains runId/Issue/spec identity through persistence or mutates only the selected bound flow.json.
**Required change:** Add a spec-local test with at least two managed-worktree flow state files that runs acceptance-decision on one binding and asserts only that bound flow.json changed while runId, issue, and spec identity are retained.
**Why blocking:** R1 has no corresponding executable coverage for the persistence and bound-file mutation requirement.

### 2. R2 success-path registry side-effect coverage is incomplete
**Target:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Issue:** The tests verify registry entries are preserved after success, but they do not detect calls to active-flow registry remove, park, or document-replacement operations on the success path.
**Required change:** Add success-path instrumentation or test doubles that fail if remove, park, or document-replacement operations are invoked during acceptance-decision.
**Why blocking:** R2 explicitly forbids these operations; preservation assertions alone can pass even if forbidden calls happen and are later repaired or masked.

### 3. R3 guarded resolution and final-regression state coverage is missing
**Target:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Issue:** The success test asserts registryVerification.target and acceptance-decision done, but does not call guarded flow resolution after the operation and does not assert final-regression becomes in_progress only for accept_risk_and_continue.
**Required change:** Extend success coverage to invoke guarded flow resolution after acceptance-decision and assert the same runId, issue, and spec are returned, with final-regression in_progress for accept_risk_and_continue and not for other decisions where applicable.
**Why blocking:** R3's required post-operation guarded resolution and step-transition behavior are not exercised.

### 4. R4 failure boundaries are not fully injected
**Target:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Issue:** R4 requires coverage for worktree binding mismatch, registry operation lock failure, registry revision conflict, and registry identity verification failure. The current tests cover an absent target and a read conflict, but not all named boundaries, and the read-conflict test does not assert no pre-operation entry loss.
**Required change:** Add tests for each named R4 boundary and assert the operation fails explicitly, does not report a successful transition, and preserves every pre-operation registry entry.
**Why blocking:** Required failure-mode regression coverage is missing for multiple critical boundaries.

### 5. R5 required regression scenarios are missing
**Target:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Issue:** The file uses two registry entries in some cases, but it does not prove guarded target resolution with two managed-worktree flows, does not preserve existing single-flow behavior, does not cover flow resume --parked behavior, and does not inject each R4 failure boundary with no-entry-loss assertions.
**Required change:** Add spec-local regression tests for two-flow guarded resolution, existing single-flow acceptance behavior, flow resume --parked behavior, and every R4 failure boundary preserving entries.
**Why blocking:** R5 is a regression-coverage requirement and several mandated scenarios have no corresponding tests.


## Advisory Findings

No advisory findings.