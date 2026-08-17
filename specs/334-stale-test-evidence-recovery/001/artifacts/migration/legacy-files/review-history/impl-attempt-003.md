# Code Review Results

## Verdict: REJECTED

## Blocking Findings

### 1. Recovery no longer writes invalidation audit records
**Finding key:** recovery-omits-invalidation-records
**Failure mode:** missing_acceptance_requirement
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R4
**Issue:** `StaleTestEvidenceRefresh.recover()` builds a `planRepairEvidenceInvalidation()` but never applies it. The new transaction only renames/removes the artifact paths and returns `invalidatedArtifacts`, so the previous `InvalidatedRepairArtifactRecord.toJSON()` audit records produced by `invalidateRepairEvidence().apply()` are dropped from the successful recovery path.
**Suggestion:** In `StaleTestEvidenceRefresh.recover()`, preserve the staged atomic behavior but also commit the planned invalidation records from `RepairEvidenceInvalidationPlan.apply()` or an equivalent record-writing branch after the lifecycle mutation succeeds, and include the serialized invalidations in the recovery result.
**Disposition:** must-fix
**Rationale:** R4 is mandatory and requires successful stale recovery to be auditable as one owned recovery operation. Removing the invalidation record application weakens the audit trail even though the result still lists path names.

### 2. Rollback failure can replace the original recovery error
**Finding key:** rollback-can-mask-mutation-failure
**Failure mode:** security_or_data_integrity_bug
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R4
**Issue:** When `flowManager.mutate()` throws, `recover()` calls `transaction.rollback()` directly inside the catch block. If rollback restoration or staging-dir cleanup throws, `rollback()` throws an `AggregateError` and masks the original lifecycle mutation failure, leaving callers without the authoritative cause of the failed owned recovery operation.
**Suggestion:** In the `flowManager.mutate()` catch branch, catch rollback errors separately and rethrow an error that preserves the original mutation error as the primary cause while attaching rollback failures as suppressed/secondary detail.
**Disposition:** must-fix
**Rationale:** R4 requires artifact and lifecycle mutations to complete as one owned recovery operation. A failed recovery must remain diagnosable and auditable; masking the lifecycle failure with cleanup errors undermines that mandatory guarantee.


## Non-blocking Improvements

No non-blocking improvements.

## Excluded Findings

- Missing file: 0
- Out of scope: 0
