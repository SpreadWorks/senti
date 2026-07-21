# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/326-update-overview-contract/test-coverage.json`

## Blocking Findings

### 1. R1 invalid shape test can pass after active-flow work
**Target:** specs/326-update-overview-contract/tests/update-overview-contract.test.js:22
**Issue:** The R1 invalid-shape cases call only `validateOverviewAdditions()` directly. R1 requires invalid parsed shapes to return `INVALID_SHAPE` before active-flow lookup or persistence, but no command-boundary test supplies an invalid-but-well-formed `--json` payload with missing/invalid flow state and verifies the command returns `INVALID_SHAPE`. An implementation could validate in the helper while `RunUpdateOverviewCommand.execute()` performs active-flow/spec lookup first and these tests would still pass.
**Required change:** Add a spec-local command-boundary invalid-shape case for `RunUpdateOverviewCommand.execute()` that uses malformed shape JSON and a flow state/root setup that would fail if active-flow lookup or persistence happened first, asserting `INVALID_SHAPE`.
**Why blocking:** This is explicit acceptance coverage for error ordering at the command boundary, and the current tests do not exercise the production behavior where the ordering matters.


## Advisory Findings

### 1. R3 only checks one category for order and stamping
**Target:** specs/326-update-overview-contract/tests/update-overview-contract.test.js:101
**Improvement:** Extend the pure merge assertions to include multiple additions across `data_flow` and `decisions`, not just `modules`, so category coverage and input ordering are visibly complete.
**Why non-blocking:** The command-boundary R2 test already checks all three categories are persisted with task stamps, so this is a useful strengthening rather than a blocker.
