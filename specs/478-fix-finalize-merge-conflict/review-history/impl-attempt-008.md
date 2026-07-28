# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Dirty Flow Metadata Can Block Conflict Persistence After Mutating State
**Finding key:** finalize-merge-conflict-commit-can-fail-after-metadata-mutation
**Failure mode:** security_or_data_integrity_bug
**File:** src/flow/definition.js
**Requirement:** R1
**Issue:** The finalize-merge onError lifecycle mutates Flow metadata before proving that the metadata-only recovery commit can actually be made. For finalize-merge, the lifecycle runs assertFinalizeMergeMetadataMutationSafe, then BeginOutboxEffect, FailOutboxEffect, SkipSteps, finalizeOnError, and only then commitFinalizeMergeConflictMetadata. If the active spec metadata is already dirty before onError starts, the initial guard permits it because active spec metadata is Flow-owned, the lifecycle mutates the in-memory/on-disk outbox, step statuses, and issue log, and the final commitFinalizeMergeMetadataIfSafe call can then fail because the metadata preflight baseline no longer matches. That leaves the recovery evidence uncommitted, contradicting the requirement to commit conflict metadata before returning recovery instructions.
**Suggestion:** In resolveFinalizeLifecycle for finalize-merge onError, capture the metadata preflight before any mutation and pass that same preflight through to commitFinalizeMergeConflictMetadata, or otherwise make commitFinalizeMergeConflictMetadata evaluate the pre-mutation baseline rather than re-reading after FailOutboxEffect/SkipSteps/finalizeOnError have changed the files.
**Disposition:** must-fix
**Rationale:** R1 is a mandatory requirement mapped to src/flow/definition.js and src/flow/lib/run-finalize.js. The current ordering can fail the required recovery metadata commit specifically during the conflict error path, so this is a blocking data-integrity issue rather than an optional cleanup.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
