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

### 4. 1. Preserve `0` Timeout Semantics With Nullish Fallback
**Finding key:** loop-73ba44d1bc14df8da5fd
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** The new expression uses `||`, so a configured `finalRegressionTimeout` of `0` is ignored and falls back to `resolveTestTimeoutSeconds(config)`. If `0` is invalid, that should be rejected at the configuration boundary; if it is meaningful, this silently changes behavior.  
**Suggestion:** Use nullish coalescing to distinguish “not configured” from falsy values:

```js
timeoutMs: (config?.test?.finalRegressionTimeout ?? resolveTestTimeoutSeconds(config)) * 1000,
```
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** The new expression uses `||`, so a configured `finalRegressionTimeout` of `0` is ignored and falls back to `resolveTestTimeoutSeconds(config)`. If `0` is invalid, that should be rejected at the configuration boundary; if it is meaningful, this silently changes behavior.  
**Suggestion:** Use nullish coalescing to distinguish “not configured” from falsy values:

```js
timeoutMs: (config?.test?.finalRegressionTimeout ?? resolveTestTimeoutSeconds(config)) * 1000,
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Avoid Timeout Resolution Duplication
**Finding key:** loop-e925c94810b9afd3c424
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** Timeout selection logic is now embedded inline at the `runProcessDetailed` call site, while `resolveTestTimeoutSeconds(config)` already appears to be the existing abstraction for test timeout resolution. This weakens design consistency and makes future timeout precedence changes easier to miss.  
**Suggestion:** Move `config?.test?.finalRegressionTimeout` handling into the timeout resolver or introduce a specific helper such as `resolveFinalRegressionTimeoutSeconds(config)`, then keep the call site simple:

```js
timeoutMs: resolveFinalRegressionTimeoutSeconds(config) * 1000,
```
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** Timeout selection logic is now embedded inline at the `runProcessDetailed` call site, while `resolveTestTimeoutSeconds(config)` already appears to be the existing abstraction for test timeout resolution. This weakens design consistency and makes future timeout precedence changes easier to miss.  
**Suggestion:** Move `config?.test?.finalRegressionTimeout` handling into the timeout resolver or introduce a specific helper such as `resolveFinalRegressionTimeoutSeconds(config)`, then keep the call site simple:

```js
timeoutMs: resolveFinalRegressionTimeoutSeconds(config) * 1000,
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Extract target failure code normalization
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

### 7. 2. Rename `failureCode` to reflect mismatch-specific behavior
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

### 8. 1. Consolidate Duplicate Cleanup Calls
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

### 9. 1. Centralize Timeout Resolution Semantics
**Finding key:** loop-d96fc29192f75f96633d
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** Timeout precedence is being introduced inline for final regression while existing timeout behavior appears to live behind `resolveTestTimeoutSeconds(config)`. This creates an interface inconsistency: some callers use the resolver abstraction, while this path partially bypasses it.  
**Suggestion:** Add a dedicated resolver such as `resolveFinalRegressionTimeoutSeconds(config)` or extend the existing timeout resolver to handle final-regression precedence, then keep call sites using resolver APIs consistently.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** Timeout precedence is being introduced inline for final regression while existing timeout behavior appears to live behind `resolveTestTimeoutSeconds(config)`. This creates an interface inconsistency: some callers use the resolver abstraction, while this path partially bypasses it.  
**Suggestion:** Add a dedicated resolver such as `resolveFinalRegressionTimeoutSeconds(config)` or extend the existing timeout resolver to handle final-regression precedence, then keep call sites using resolver APIs consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Align Lifecycle Authority Error Naming With API Checks
**Finding key:** loop-204a7c1d47453a04a866
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The code now checks for the batch lifecycle API `flowManager.updateStepStatuses`, but the reported authority name remains generic. Across files, recent changes appear to be tightening specific failure codes and capability checks, so this vague lifecycle message is inconsistent with the more precise target-resolution naming in `src/lib/dispatcher.js`.  
**Suggestion:** Name the missing capability directly in the error, for example `late applied-finding repair requires flowManager.updateStepStatuses lifecycle authority`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The code now checks for the batch lifecycle API `flowManager.updateStepStatuses`, but the reported authority name remains generic. Across files, recent changes appear to be tightening specific failure codes and capability checks, so this vague lifecycle message is inconsistent with the more precise target-resolution naming in `src/lib/dispatcher.js`.  
**Suggestion:** Name the missing capability directly in the error, for example `late applied-finding repair requires flowManager.updateStepStatuses lifecycle authority`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Avoid Scattered Normalization Logic
**Finding key:** loop-ff12669b03fe341b33ba
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R2
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R2  
**Issue:** Target-resolution failure normalization is embedded directly in `dispatch`, while other reviewed changes also introduce local call-site adaptations around lifecycle/status transition APIs. These small inline mappings can diverge across files as more recovery paths are added.  
**Suggestion:** Extract the target failure-code mapping into a named helper such as `resolveTargetFailureCode(...)`, and use similarly named helpers for transition/status normalization where needed. This keeps cross-file recovery behavior explicit and easier to compare.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R2  
**Issue:** Target-resolution failure normalization is embedded directly in `dispatch`, while other reviewed changes also introduce local call-site adaptations around lifecycle/status transition APIs. These small inline mappings can diverge across files as more recovery paths are added.  
**Suggestion:** Extract the target failure-code mapping into a named helper such as `resolveTargetFailureCode(...)`, and use similarly named helpers for transition/status normalization where needed. This keeps cross-file recovery behavior explicit and easier to compare.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
