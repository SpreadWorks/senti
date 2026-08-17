# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Avoid Re-parsing Nullable Issue During Identity Check
**Finding key:** loop-3796e9b5476db36936a7
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `matchesResolvedTarget()` now calls `requireNullableIssue(resolved.state?.issue, "resolved flow issue")` inline inside a boolean mismatch check. If the resolved issue is malformed, this throws a validation error while the surrounding branch otherwise normalizes mismatches into `ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH`. That makes the method’s error behavior less consistent and slightly harder to read.  
**Suggestion:** Assign the parsed value before the comparison, then compare named values. If malformed resolved state should be treated as an identity mismatch, catch or normalize that error to the same registry error path.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `matchesResolvedTarget()` now calls `requireNullableIssue(resolved.state?.issue, "resolved flow issue")` inline inside a boolean mismatch check. If the resolved issue is malformed, this throws a validation error while the surrounding branch otherwise normalizes mismatches into `ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH`. That makes the method’s error behavior less consistent and slightly harder to read.  
**Suggestion:** Assign the parsed value before the comparison, then compare named values. If malformed resolved state should be treated as an identity mismatch, catch or normalize that error to the same registry error path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Remove Silent Fallback for Transition Intent Completion
**Finding key:** loop-475d37e0bac8f69059c9
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `clearImplRepairTransitionIntent` now silently deletes `current.implRepairTransaction` and returns `true` when `flowManager.completeStepTransitionIntent` is unavailable. That bypasses the flow manager authority path and makes cleanup semantics inconsistent with the rest of the lifecycle code, which otherwise fails fast when required manager APIs are missing. It also introduces a mutation-only fallback whose persistence depends on external transaction behavior, making the design harder to reason about.  
**Suggestion:** Keep the previous fail-fast behavior and require `completeStepTransitionIntent` here. If a fallback is genuinely required, extract it into a clearly named helper and make the persistence contract explicit, but avoid silently accepting a manager that cannot complete the intent through the established API.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `clearImplRepairTransitionIntent` now silently deletes `current.implRepairTransaction` and returns `true` when `flowManager.completeStepTransitionIntent` is unavailable. That bypasses the flow manager authority path and makes cleanup semantics inconsistent with the rest of the lifecycle code, which otherwise fails fast when required manager APIs are missing. It also introduces a mutation-only fallback whose persistence depends on external transaction behavior, making the design harder to reason about.  
**Suggestion:** Keep the previous fail-fast behavior and require `completeStepTransitionIntent` here. If a fallback is genuinely required, extract it into a clearly named helper and make the persistence contract explicit, but avoid silently accepting a manager that cannot complete the intent through the established API.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Centralize Final Regression Timeout Resolution
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

### 4. 2. Rename `configForAuthorityRoot` To Clarify Behavior
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

### 5. 3. Avoid Repeated Config Resolution In Command Methods
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

### 6. 4. Prefer Nullish Fallback For Context Config
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

### 7. 1. Extract target failure code normalization
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

### 8. 2. Rename `failureCode` to reflect mismatch-specific behavior
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

### 9. 1. Extract Stale Config Fixture Setup
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

### 10. 1. Consolidate Duplicate Cleanup Calls
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

### 11. 1. Centralize Target Failure Normalization
**Finding key:** loop-6689f585b524eeab748a
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R2
**Issue:** **File:** `src/lib/dispatcher.js`
**Requirement:** R2
**Issue:** Target mismatch normalization appears in multiple areas with slightly different names and behavior: `matchesResolvedTarget()` in `acceptance-review-artifacts.js` normalizes identity mismatch behavior, while `dispatcher.js` maps `FLOW_TARGET_NOT_FOUND` to `ACTIVE_FLOW_MISMATCH`. These are related flow-target failure concepts but are implemented and named independently.
**Suggestion:** Introduce a shared helper or clearly documented flow-target error normalization convention so target-not-found, identity mismatch, and active-flow mismatch paths use consistent names and semantics.
**Suggestion:** **File:** `src/lib/dispatcher.js`
**Requirement:** R2
**Issue:** Target mismatch normalization appears in multiple areas with slightly different names and behavior: `matchesResolvedTarget()` in `acceptance-review-artifacts.js` normalizes identity mismatch behavior, while `dispatcher.js` maps `FLOW_TARGET_NOT_FOUND` to `ACTIVE_FLOW_MISMATCH`. These are related flow-target failure concepts but are implemented and named independently.
**Suggestion:** Introduce a shared helper or clearly documented flow-target error normalization convention so target-not-found, identity mismatch, and active-flow mismatch paths use consistent names and semantics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Align Config Resolution Naming Across Runtime And Tests
**Finding key:** loop-67f455fac5aef6d81b83
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R2
**Issue:** `configForAuthorityRoot` is vague, and the related test summary proposes a helper like `writeContextConfig`. Together these introduce inconsistent terminology around “authority root”, “context config”, and persisted config behavior.
**Suggestion:** Use consistent names that distinguish loading from writing, for example `loadConfigForAuthorityRoot(root, fallback)` in runtime code and `writeAuthorityRootConfig(tmp, overrides)` or similar in tests.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R2
**Issue:** `configForAuthorityRoot` is vague, and the related test summary proposes a helper like `writeContextConfig`. Together these introduce inconsistent terminology around “authority root”, “context config”, and persisted config behavior.
**Suggestion:** Use consistent names that distinguish loading from writing, for example `loadConfigForAuthorityRoot(root, fallback)` in runtime code and `writeAuthorityRootConfig(tmp, overrides)` or similar in tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Avoid Duplicating Final Regression Timeout Semantics
**Finding key:** loop-488940e9cb9572be2b3d
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R1
**Issue:** Runtime timeout resolution is being added inline, while the test introduces explicit duplicated config shape for `test.timeout` and `test.finalRegressionTimeout`. This risks the test and implementation drifting on which timeout field takes precedence.
**Suggestion:** Centralize final regression timeout resolution in a helper such as `resolveFinalRegressionTimeoutSeconds(config)`, then structure the test fixture to override only the timeout fields needed to verify that helper’s precedence behavior.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R1
**Issue:** Runtime timeout resolution is being added inline, while the test introduces explicit duplicated config shape for `test.timeout` and `test.finalRegressionTimeout`. This risks the test and implementation drifting on which timeout field takes precedence.
**Suggestion:** Centralize final regression timeout resolution in a helper such as `resolveFinalRegressionTimeoutSeconds(config)`, then structure the test fixture to override only the timeout fields needed to verify that helper’s precedence behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
