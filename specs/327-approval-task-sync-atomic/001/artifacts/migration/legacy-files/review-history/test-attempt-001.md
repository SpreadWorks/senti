# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/327-approval-task-sync-atomic/test-coverage.json`

## Blocking Findings

### 1. Missing guarded target mismatch coverage
**Target:** specs/327-approval-task-sync-atomic/tests/approval-task-sync-atomic.test.js R2
**Issue:** R2 requires caller-visible failures before mutation for guarded run/spec/issue target mismatches while preserving the losing approval/task state. The test only covers missing/malformed/invalid spec input, active-flow load error, and revision drift; it does not exercise runId, specId/spec path, or issue target mismatch guards.
**Required change:** Add spec-local executable tests that attempt approval completion with mismatched guarded run/spec/issue targets and assert failure before mutation with unchanged approval/task state.
**Why blocking:** The coverage artifact marks R2 covered, but a required acceptance condition has no corresponding spec-local test coverage.

### 2. Missing deterministic retry coverage for pre-commit failures
**Target:** specs/327-approval-task-sync-atomic/tests/approval-task-sync-atomic.test.js R3
**Issue:** R3 requires one retry with the same logical input to repeat unchanged pre-commit, parse, validation, or target-mismatch failures with unchanged state, and requires success after removing the condition to match a clean first attempt. The current test only covers retry after a committed:true post-rename failure.
**Required change:** Add retry tests for at least the specified pre-commit failure classes: parse/load failure, validation failure, and target mismatch, including unchanged-state repeated failure and success after removing the condition.
**Why blocking:** A required idempotence and determinism behavior is untested for the pre-commit failure paths that R3 explicitly names.

### 3. Missing append-only existing-task coverage
**Target:** specs/327-approval-task-sync-atomic/tests/approval-task-sync-atomic.test.js R4
**Issue:** R4 requires the happy path to append only previously absent spec task ids. The current happy-path fixture starts with an empty task list, so it does not prove existing spec tasks are preserved and not duplicated while only absent ids are appended.
**Required change:** Add a happy-path case with at least one existing matching task in flow state and assert only absent spec task ids are appended with no duplicates and preserved existing task data.
**Why blocking:** A concrete R4 acceptance requirement has no direct spec-local coverage.


## Advisory Findings

No advisory findings.