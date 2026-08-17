# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Rollback can mutate a different flow after a guarded write fails verification
**Finding key:** rollback-uses-unguarded-mutation
**Failure mode:** security_or_data_integrity_bug
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R1
**Issue:** In `applyAcceptanceDecision()`, the main acceptance update uses `mutateExactTarget(...)`, but the error path rolls state back with plain `flowManager.mutate((current) => replaceState(current, previousState))`. If registry verification fails after the guarded write and the current target has changed before rollback, this unguarded rollback can overwrite another active flow state with the previous state captured for the original runId/Issue/spec.
**Suggestion:** Use the same captured `registrySnapshot.target.expectation` for rollback, for example by calling `flowManager.mutateExactTarget(registrySnapshot.target.expectation, ...)` when `registrySnapshot` is present, and fail closed if the exact target no longer matches instead of applying `previousState` to the default/current target.
**Disposition:** must-fix
**Rationale:** R1 requires the selected runId, Issue, and spec to remain bound through the flow-state mutation lifecycle. The rollback branch is part of that lifecycle and currently performs an unbound mutation after a guarded write, creating a mandatory data-integrity risk under the race this task is meant to close.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
