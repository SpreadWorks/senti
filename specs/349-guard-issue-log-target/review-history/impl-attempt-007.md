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

### 4. 1. Centralize Final Regression Timeout Resolution
**Finding key:** loop-a4184735764182b48cd0
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** Timeout selection now mixes two paths inline: `config?.test?.finalRegressionTimeout || resolveTestTimeoutSeconds(config)`. This duplicates timeout-resolution responsibility outside the existing `resolveTestTimeoutSeconds` helper and uses `||`, so an intentional `0` or other falsy value would be ignored.  
**Suggestion:** Move `test.finalRegressionTimeout` handling into a dedicated helper, for example `resolveFinalRegressionTimeoutSeconds(config)`, and use `??` instead of `||` if zero is not meant to be silently replaced.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** Timeout selection now mixes two paths inline: `config?.test?.finalRegressionTimeout || resolveTestTimeoutSeconds(config)`. This duplicates timeout-resolution responsibility outside the existing `resolveTestTimeoutSeconds` helper and uses `||`, so an intentional `0` or other falsy value would be ignored.  
**Suggestion:** Move `test.finalRegressionTimeout` handling into a dedicated helper, for example `resolveFinalRegressionTimeoutSeconds(config)`, and use `??` instead of `||` if zero is not meant to be silently replaced.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Rename `configForAuthorityRoot` To Clarify Behavior
**Finding key:** loop-7f3f44bc6b959206949c
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `configForAuthorityRoot` is vague: it does not clearly communicate that it conditionally reloads config from `sentiConfigPath(root)` and otherwise returns a fallback.  
**Suggestion:** Rename it to something behavior-specific such as `loadConfigIfPresent(root, fallback)` or `resolveConfigForRoot(root, fallback)`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R2  
**Issue:** `configForAuthorityRoot` is vague: it does not clearly communicate that it conditionally reloads config from `sentiConfigPath(root)` and otherwise returns a fallback.  
**Suggestion:** Rename it to something behavior-specific such as `loadConfigIfPresent(root, fallback)` or `resolveConfigForRoot(root, fallback)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Avoid Repeated Config Resolution In Command Methods
**Finding key:** loop-faee20dc0dd00ebcc5ce
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** `configForAuthorityRoot(root, ctx.config || {})` is now called in both `run()` and `recordAndProceed()`. If more paths need the same authority-root config, this repeats the same resolution pattern and can reload config multiple times.  
**Suggestion:** Resolve the config once in the command flow and pass it into helper methods that need it, or store it in a local execution context object used by `run()` and `recordAndProceed()`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** `configForAuthorityRoot(root, ctx.config || {})` is now called in both `run()` and `recordAndProceed()`. If more paths need the same authority-root config, this repeats the same resolution pattern and can reload config multiple times.  
**Suggestion:** Resolve the config once in the command flow and pass it into helper methods that need it, or store it in a local execution context object used by `run()` and `recordAndProceed()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Prefer Nullish Fallback For Context Config
**Finding key:** loop-86c058b592be26ca8407
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R4  
**Issue:** Both new calls use `ctx.config || {}`. This treats any falsy value as missing, which is broader than necessary and inconsistent with the optional chaining used nearby.  
**Suggestion:** Use `ctx.config ?? {}` so only `null` or `undefined` fall back to an empty config.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R4  
**Issue:** Both new calls use `ctx.config || {}`. This treats any falsy value as missing, which is broader than necessary and inconsistent with the optional chaining used nearby.  
**Suggestion:** Use `ctx.config ?? {}` so only `null` or `undefined` fall back to an empty config.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Extract target failure code normalization
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

### 9. 2. Rename `failureCode` to reflect mismatch-specific behavior
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

### 10. 1. Extract Stale Config Fixture Setup
**Finding key:** loop-1d0dea4741ba3b59772e
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R3  
**Issue:** The new test inlines a full `.senti/config.json` object even though only `test.timeout` and `test.finalRegressionTimeout` are relevant. This duplicates baseline project config shape and makes the test more brittle if `setupProject` defaults change.  
**Suggestion:** Add a small helper in this test file, such as `writeContextConfig(tmp, testConfig)`, or read/merge from the existing generated config and override only the timeout fields needed for the stale-context scenario.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R3  
**Issue:** The new test inlines a full `.senti/config.json` object even though only `test.timeout` and `test.finalRegressionTimeout` are relevant. This duplicates baseline project config shape and makes the test more brittle if `setupProject` defaults change.  
**Suggestion:** Add a small helper in this test file, such as `writeContextConfig(tmp, testConfig)`, or read/merge from the existing generated config and override only the timeout fields needed for the stale-context scenario.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Consolidate Duplicate Cleanup Calls
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

### 12. 1. Centralize Final Regression Config Resolution
**Finding key:** loop-9a8b028aad2ab92f8508
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** Final regression timeout/config resolution is now spread across production logic and mirrored by `tests/unit/flow/final-regression.test.js`, which hardcodes stale config shape to exercise the behavior. This creates a cross-file coupling where tests must know too much about config fallback details.  
**Suggestion:** Add a focused helper such as `resolveFinalRegressionTimeoutSeconds(config)` or `resolveFinalRegressionConfig(root, fallbackConfig)`, use it from command code, and test that helper directly with minimal fixtures.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R1  
**Issue:** Final regression timeout/config resolution is now spread across production logic and mirrored by `tests/unit/flow/final-regression.test.js`, which hardcodes stale config shape to exercise the behavior. This creates a cross-file coupling where tests must know too much about config fallback details.  
**Suggestion:** Add a focused helper such as `resolveFinalRegressionTimeoutSeconds(config)` or `resolveFinalRegressionConfig(root, fallbackConfig)`, use it from command code, and test that helper directly with minimal fixtures.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Align Target/Transition Authority Failure Naming
**Finding key:** loop-6b2039e7eab52bae469b
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** Capability checks introduced across flow code use different levels of specificity: `dispatcher.js` normalizes target-resolution failure codes explicitly, while `impl-repair-artifacts.js` reports a broad “lifecycle authority” error even though the missing interface is specifically `updateStepStatuses`. This makes cross-file diagnostics inconsistent.  
**Suggestion:** Standardize failure messages around the missing capability or normalized failure code, e.g. mention `flowManager.updateStepStatuses` in impl-repair and keep dispatcher naming similarly explicit with `normalizedTargetFailureCode`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** Capability checks introduced across flow code use different levels of specificity: `dispatcher.js` normalizes target-resolution failure codes explicitly, while `impl-repair-artifacts.js` reports a broad “lifecycle authority” error even though the missing interface is specifically `updateStepStatuses`. This makes cross-file diagnostics inconsistent.  
**Suggestion:** Standardize failure messages around the missing capability or normalized failure code, e.g. mention `flowManager.updateStepStatuses` in impl-repair and keep dispatcher naming similarly explicit with `normalizedTargetFailureCode`.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
