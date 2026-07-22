# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/327-approval-task-sync-atomic/test-coverage.json`

## Blocking Findings

### 1. Missing assertion for definition-driven next-step promotion
**Target:** specs/327-approval-task-sync-atomic/tests/approval-task-sync-atomic.test.js:assertCompleteCombinedState / R1 happy and committed-failure cases
**Issue:** R1 requires the approval completion, timestamps, definition-driven next-step promotion, and newly derived tasks to be persisted in the same atomic mutation. The tests assert approval is done, finishedAt exists, tasks are present, and currentTaskId is T-1, but they do not assert the flow step that should be promoted by the step definition after approval completes.
**Required change:** Add a spec-local assertion in the R1/R4 success-state checks for the expected promoted next flow step status after approval completes.
**Why blocking:** Without this, implementation could atomically persist approval and tasks while omitting or mis-persisting the definition-driven next-step promotion, and the requirement coverage artifact would still claim R1 is covered.


## Advisory Findings

### 1. Retry coverage only samples one guarded mismatch type
**Target:** specs/327-approval-task-sync-atomic/tests/approval-task-sync-atomic.test.js:R3 repeats pre-commit spec and target failures once and matches clean success after repair
**Improvement:** Consider repeating the deterministic retry check for spec and issue guarded mismatches, not only run-id mismatch.
**Why non-blocking:** R2 already covers all three guarded mismatch types before mutation, and the R3 test exercises the retry contract for one representative target mismatch condition.
