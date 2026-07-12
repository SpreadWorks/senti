# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/318-enforce-target-guards-for-preparing-flow-prelude/test-coverage.json`

## Blocking Findings

### 1. Missing guarded unknown-run coverage for set commands
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js R3 test
**Issue:** R3 requires `flow set request`, `flow set note`, and `flow set auto` to return `ACTIVE_FLOW_MISMATCH` for guarded explicit unknown runs. The test only checks guard-free unknown runs for those commands; guarded unknown coverage exists only for auto-check and prepare.
**Required change:** Add guarded explicit unknown-run assertions for request, note, and auto, for example `--run-id missing-run --expect-run-id missing-run`, expecting `ACTIVE_FLOW_MISMATCH`.
**Why blocking:** An acceptance requirement has no corresponding spec-local test coverage.

### 2. Auto mismatch mutation guard is not observable
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js R3 mismatchMatrix loop
**Issue:** The auto mismatch case runs `flow set auto off` after the preparing state has already been set to `autoApprove: false`, so an implementation that mutates before rejecting could still leave identical persisted state and pass the before/after assertion.
**Required change:** Make the forbidden auto operation change the current value, or reset the state to the opposite value before each auto mismatch assertion, then assert the state remains unchanged.
**Why blocking:** The test has a static anti-pattern that could pass without exercising the required pre-mutation guarantee for `flow set auto`.

### 3. Guard-free unknown failures are under-specified for auto-check and prepare
**Target:** specs/318-enforce-target-guards-for-preparing-flow-prelude/tests/preparing-target-guards.test.js R4 test
**Issue:** R4 requires guard-free unknown runs to retain command-specific failures, but the test only asserts the error is not `ACTIVE_FLOW_MISMATCH`. Any unrelated new error code would pass.
**Required change:** Assert the exact existing command-specific error code for guard-free unknown `flow run auto-check` and guard-free unknown `flow prepare`.
**Why blocking:** The retained behavior requirement lacks precise regression coverage.


## Advisory Findings

No advisory findings.