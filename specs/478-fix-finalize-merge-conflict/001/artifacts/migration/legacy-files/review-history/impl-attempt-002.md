# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. External dirtiness is checked after failure metadata mutation
**Finding key:** external-dirty-mutates-before-reject
**Failure mode:** missing_acceptance_requirement
**File:** src/flow/definition.js
**Requirement:** R3
**Issue:** The finalize-merge error lifecycle still runs `finalizeOnError` before invoking `commitFinalizeMergeConflictMetadata`. Because the external-dirty rejection is only enforced inside the later commit helper, an external dirty path can cause `finalizeOnError` to write failed outbox, issue-log, and skipped-step state before the helper rejects.
**Suggestion:** Move or add the active-spec metadata preflight before `finalizeOnError` mutates state in the finalize-merge error path, then pass that same preflight into `commitFinalizeMergeConflictMetadata` so external dirty paths prevent all finalize mutation.
**Disposition:** must-fix
**Rationale:** T-1 explicitly requires that external dirty paths prevent all finalize mutation. With the current action order, the rejection happens after finalize recovery metadata has already been mutated, so the mandatory guard is not satisfied.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
