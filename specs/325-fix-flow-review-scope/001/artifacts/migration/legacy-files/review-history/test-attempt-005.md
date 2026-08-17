# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/325-fix-flow-review-scope/test-coverage.json`

## Blocking Findings

### 1. Missing no-actionable coverage for empty-spec/skipped tasks
**Target:** specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js R1
**Issue:** R1 defines actionable task work as a task with a non-empty spec and status neither done nor skipped, but the no-actionable flow case is only covered with a done task. There is no spec-local executable case proving pending tasks with an empty spec, or skipped tasks, are excluded from actionable work.
**Required change:** Add the smallest R1 resolver assertion covering currentTaskId null with no actionable work due to an empty spec and/or skipped status resolving according to the no-actionable flow rule.
**Why blocking:** This is an explicit acceptance condition in R1 and currently has no corresponding spec-local test coverage.

### 2. Missing rejection coverage for empty broad-mode reason
**Target:** specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js R6
**Issue:** R6 requires broad-mode success only with a matching non-empty reason record. The tests cover success with a non-empty reason and failure with no broad record, but not a broad-mode record whose reason is empty.
**Required change:** Add an R6 case where currentTaskId is null and broadModeHistory has a matching impl-review record with an empty reason, asserting the command fails before subprocess launch and without durable mutation.
**Why blocking:** The non-empty reason guard is part of the Issue #325 contract and lacks direct regression coverage.


## Advisory Findings

### 1. Narrow task mutation assertion
**Target:** specs/325-fix-flow-review-scope/tests/review-scope-regression.test.js R3
**Improvement:** R3 says no task step shall change, but the test only asserts task-review remains pending. Snapshotting all task steps before post and comparing afterward would make the intent clearer.
**Why non-blocking:** The current test still checks the highest-risk task-review mutation path; broader snapshot coverage would improve precision without changing the executable premise.
