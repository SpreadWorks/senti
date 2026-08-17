# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/306-guard-flow-target-status/test-coverage.json`

## Blocking Findings

### 1. R5 approval parity lacks executable coverage
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js
**Issue:** The R5 test for requires_approval / autoApprove normal approval behavior only asserts that guidance text still mentions related phrases. It does not execute a flow status/action path that proves the normal approval behavior is preserved.
**Required change:** Add a spec-local executable test that drives the normal requires_approval / autoApprove approval path and asserts the expected behavior remains unchanged.
**Why blocking:** R5 explicitly requires migration parity for normal approval behavior, and the current coverage artifact marks R5 covered, but the executable tests do not cover that production behavior.

### 2. R5 finalize recovery parity lacks executable coverage
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js
**Issue:** The R5 finalize recovery exception coverage only checks for documentation markers such as ORPHAN_COMMITS_DETECTED, SQUASH_BASELINE_, and FORCED_ORPHAN_. It does not exercise finalize cleanup/recovery behavior.
**Required change:** Add a spec-local executable regression test for the finalize recovery exception behavior, or narrow the coverage artifact if this behavior is intentionally covered elsewhere outside this spec-local suite.
**Why blocking:** R5 requires preserving finalize recovery exception behavior, and documentation string checks can pass without exercising production behavior.


## Advisory Findings

### 1. R6 test does not prove upgrade command execution
**Target:** specs/306-guard-flow-target-status/tests/flow-target-status.test.js
**Improvement:** The R6 test verifies source/generated skill markers are synchronized, but it cannot prove that `senti upgrade` was actually run. Consider naming the test around generated skill synchronization rather than command execution, or documenting that command execution is a manual process check.
**Why non-blocking:** The executable part that matters for regression risk is the generated artifact parity check; proving the historical command invocation is not generally reliable in a unit test.
