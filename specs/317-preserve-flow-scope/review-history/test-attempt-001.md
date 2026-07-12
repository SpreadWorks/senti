# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/317-preserve-flow-scope/test-coverage.json`

## Blocking Findings

### 1. R3 missing passing test-review coverage
**Target:** specs/317-preserve-flow-scope/tests/flow-scope-regression.test.js
**Issue:** R3 requires registry lifecycle completion for both passing and advisory `test-review` results to update the top-level `test-review` step with `taskId: null` when `currentTaskId` is non-null. The test only exercises an advisory `test-review` verdict.
**Required change:** Add a spec-local assertion for a passing `test-review` result that verifies `updateStepStatus("test-review", "done", { taskId: null })`.
**Why blocking:** An acceptance requirement branch has no corresponding spec-local test coverage.

### 2. R4 missing task-impl lifecycle status coverage
**Target:** specs/317-preserve-flow-scope/tests/flow-scope-regression.test.js
**Issue:** R4 requires task-scoped `task-impl`, `task-review`, and `task-gate` lifecycle status routing to continue using the explicit current task. The tests cover `task-review` completion and `task-gate` start, while `task-impl` lifecycle status routing is not exercised.
**Required change:** Add a spec-local lifecycle status assertion for a `task-impl` mutation verifying it uses `{ taskId: "T-1" }` and does not update a top-level step.
**Why blocking:** A required task-scoped lifecycle routing case has no corresponding spec-local test coverage.

### 3. R5 missing lifecycle mutation unchanged assertion
**Target:** specs/317-preserve-flow-scope/tests/flow-scope-regression.test.js
**Issue:** R5 requires mismatched targets to leave both flow and task steps unchanged before lifecycle status mutation. The mismatch test verifies command execution and runtime metadata are skipped, but it does not include or observe any lifecycle status mutation path/state to prove flow and task steps remain unchanged.
**Required change:** Add a spec-local mismatched-target case around a target-sensitive lifecycle command that would mutate status on success, and assert both flow and task step state are unchanged after `ACTIVE_FLOW_MISMATCH`.
**Why blocking:** A critical guard requirement has no regression test for the lifecycle status mutation portion.


## Advisory Findings

No advisory findings.