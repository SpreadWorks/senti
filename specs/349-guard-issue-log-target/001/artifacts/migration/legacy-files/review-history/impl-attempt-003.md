# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Avoid Silent Intent Cleanup When Flow Manager Lacks Completion API
**Finding key:** loop-009fc679b953f1d4ee4f
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `clearImplRepairTransitionIntent` now deletes `current.implRepairTransaction` and returns `true` when `flowManager.completeStepTransitionIntent` is unavailable. That changes the function from failing fast to silently mutating in-memory state without using the lifecycle authority. This is inconsistent with the surrounding authority checks and may leave persisted state unchanged depending on how `current` is managed.  
**Suggestion:** Keep the explicit error, or route fallback cleanup through an existing persistence/transaction API if one exists in this file. If fallback cleanup is intentional, rename/comment the branch to make the degraded behavior explicit and ensure it is persisted atomically.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** `clearImplRepairTransitionIntent` now deletes `current.implRepairTransaction` and returns `true` when `flowManager.completeStepTransitionIntent` is unavailable. That changes the function from failing fast to silently mutating in-memory state without using the lifecycle authority. This is inconsistent with the surrounding authority checks and may leave persisted state unchanged depending on how `current` is managed.  
**Suggestion:** Keep the explicit error, or route fallback cleanup through an existing persistence/transaction API if one exists in this file. If fallback cleanup is intentional, rename/comment the branch to make the degraded behavior explicit and ensure it is persisted atomically.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Reduce Repeated Transition Option Construction
**Finding key:** loop-40b3fb8aa33737c40524
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** The `completeLateAppliedFindingRepair` call site now wraps a single `ExplicitRecoveryTransition` in an array for `updateStepStatuses`, but still manually constructs the first transition from `changes[0]` while also passing the full `changes` list. This creates a small duplication between the leading change and the `changes` payload.  
**Suggestion:** Extract the first change into a named local, e.g. `const firstChange = changes[0];`, and use that in the transition constructor. This makes the relationship clearer and avoids repeated indexing.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** The `completeLateAppliedFindingRepair` call site now wraps a single `ExplicitRecoveryTransition` in an array for `updateStepStatuses`, but still manually constructs the first transition from `changes[0]` while also passing the full `changes` list. This creates a small duplication between the leading change and the `changes` payload.  
**Suggestion:** Extract the first change into a named local, e.g. `const firstChange = changes[0];`, and use that in the transition constructor. This makes the relationship clearer and avoids repeated indexing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Align Error Message With Batch Lifecycle API
**Finding key:** loop-07512895963adc85fb7e
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The guard now checks for `flowManager.updateStepStatuses`, but the error message still says the operation requires “the impl-repair lifecycle authority” without naming the missing capability. That makes diagnosis less precise, especially because this change specifically moved from singular to batch status updates.  
**Suggestion:** Update the error text to mention `updateStepStatuses`, for example: `late applied-finding repair requires flowManager.updateStepStatuses lifecycle authority`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The guard now checks for `flowManager.updateStepStatuses`, but the error message still says the operation requires “the impl-repair lifecycle authority” without naming the missing capability. That makes diagnosis less precise, especially because this change specifically moved from singular to batch status updates.  
**Suggestion:** Update the error text to mention `updateStepStatuses`, for example: `late applied-finding repair requires flowManager.updateStepStatuses lifecycle authority`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Preserve explicit zero timeout values
**Finding key:** loop-6884ce878d29ec414d6b
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R4  
**Issue:** `resolveFinalRegressionTimeoutSeconds()` uses `||`, so a configured `test.finalRegressionTimeout: 0` is ignored and falls back to `resolveTestTimeoutSeconds(config)`. This matches the existing resolver style, but the new function repeats the same falsy-value behavior for a new config field.  
**Suggestion:** Use nullish coalescing for the new resolver, and ideally align the existing resolver in the same touched file if `0` is a meaningful value:

```js
export function resolveFinalRegressionTimeoutSeconds(config = {}) {
  return config?.test?.finalRegressionTimeout ?? resolveTestTimeoutSeconds(config);
}
```
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R4  
**Issue:** `resolveFinalRegressionTimeoutSeconds()` uses `||`, so a configured `test.finalRegressionTimeout: 0` is ignored and falls back to `resolveTestTimeoutSeconds(config)`. This matches the existing resolver style, but the new function repeats the same falsy-value behavior for a new config field.  
**Suggestion:** Use nullish coalescing for the new resolver, and ideally align the existing resolver in the same touched file if `0` is a meaningful value:

```js
export function resolveFinalRegressionTimeoutSeconds(config = {}) {
  return config?.test?.finalRegressionTimeout ?? resolveTestTimeoutSeconds(config);
}
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Extract target failure code normalization
**Finding key:** loop-988d74b0cf14e0fd6390
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R2
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R2  
**Issue:** The conditional mapping from `FLOW_TARGET_NOT_FOUND` to `ACTIVE_FLOW_MISMATCH` is embedded directly in `dispatch`, adding branching detail to an already broad dispatcher path.  
**Suggestion:** Extract the mapping into a small helper such as `resolveTargetFailureCode(targetResolutionError, entry)`. This makes the R2 behavior explicit and easier to test or reuse if other target-resolution failure paths need the same normalization.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R2  
**Issue:** The conditional mapping from `FLOW_TARGET_NOT_FOUND` to `ACTIVE_FLOW_MISMATCH` is embedded directly in `dispatch`, adding branching detail to an already broad dispatcher path.  
**Suggestion:** Extract the mapping into a small helper such as `resolveTargetFailureCode(targetResolutionError, entry)`. This makes the R2 behavior explicit and easier to test or reuse if other target-resolution failure paths need the same normalization.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Rename `failureCode` to reflect mismatch-specific behavior
**Finding key:** loop-e98ef4b50d7195dfe8fb
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R2
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R2  
**Issue:** `failureCode` is generic, but the variable exists specifically to convert target-not-found into `ACTIVE_FLOW_MISMATCH` when `targetNotFoundAsMismatch` is enabled.  
**Suggestion:** Rename it to something more precise, for example `targetFailureCode` or `normalizedTargetFailureCode`, so the intent is clear at the call site.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R2  
**Issue:** `failureCode` is generic, but the variable exists specifically to convert target-not-found into `ACTIVE_FLOW_MISMATCH` when `targetNotFoundAsMismatch` is enabled.  
**Suggestion:** Rename it to something more precise, for example `targetFailureCode` or `normalizedTargetFailureCode`, so the intent is clear at the call site.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Consolidate Duplicate Cleanup Calls
**Finding key:** loop-7b442fc2522a40827ba2
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The two adjacent `fs.rmSync(..., { force: true })` calls differ only by filename, which adds small but avoidable duplication in test setup cleanup.  
**Suggestion:** Replace them with a short loop over `["impl-review.json", "impl-triage.json"]` so future cleanup options or path handling stay in one place.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The two adjacent `fs.rmSync(..., { force: true })` calls differ only by filename, which adds small but avoidable duplication in test setup cleanup.  
**Suggestion:** Replace them with a short loop over `["impl-review.json", "impl-triage.json"]` so future cleanup options or path handling stay in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
