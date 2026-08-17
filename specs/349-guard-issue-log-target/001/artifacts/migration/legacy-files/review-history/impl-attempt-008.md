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

### 2. 1. Extract durable-effect status helper
**Finding key:** loop-33639740d5f6c85680d2
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** The new `durableEffectsCurrent()` logic and the `effectsStarted` block in `recoverImplRepairTransaction()` both derive artifact paths and compare persisted delta/ledger/manifest state. The second version is partially duplicated and uses “any effect started” semantics, which makes the recovery rules harder to audit.  
**Suggestion:** Extract a shared helper/class method that returns `{ deltaCurrent, ledgerCurrent, manifestCurrent, anyStarted, allCurrent }`, and use it from both `CommittedImplRepairEffects.reconcileJournal()` and `recoverImplRepairTransaction()`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** The new `durableEffectsCurrent()` logic and the `effectsStarted` block in `recoverImplRepairTransaction()` both derive artifact paths and compare persisted delta/ledger/manifest state. The second version is partially duplicated and uses “any effect started” semantics, which makes the recovery rules harder to audit.  
**Suggestion:** Extract a shared helper/class method that returns `{ deltaCurrent, ledgerCurrent, manifestCurrent, anyStarted, allCurrent }`, and use it from both `CommittedImplRepairEffects.reconcileJournal()` and `recoverImplRepairTransaction()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Rename `durableEffectsCurrent()` for clarity
**Finding key:** loop-d5757fa6c25d8832ec85
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `durableEffectsCurrent()` reads like a boolean predicate but returns a status object. That makes call sites such as `const durable = committed.durableEffectsCurrent()` slightly misleading.  
**Suggestion:** Rename it to something object-oriented and descriptive, such as `currentDurableEffectStatus()` or `inspectDurableEffects()`, so the return shape is obvious from the name.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `durableEffectsCurrent()` reads like a boolean predicate but returns a status object. That makes call sites such as `const durable = committed.durableEffectsCurrent()` slightly misleading.  
**Suggestion:** Rename it to something object-oriented and descriptive, such as `currentDurableEffectStatus()` or `inspectDurableEffects()`, so the return shape is obvious from the name.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Simplify the empty branch in `commitRepairTransaction()`
**Finding key:** loop-c49465c3f1839b6e6828
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** The `if (durable.deltaCurrent && durable.ledgerCurrent && durable.manifestCurrent)` branch contains only a comment and relies on falling through to the invalidation transaction. This is easy to misread as missing logic.  
**Suggestion:** Replace the empty branch with an explicit boolean such as `const durableEffectsCommitted = ...`; then structure the condition as `if (!durableEffectsCommitted) { ... }`. That makes the intended fall-through behavior clear without a no-op block.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R3  
**Issue:** The `if (durable.deltaCurrent && durable.ledgerCurrent && durable.manifestCurrent)` branch contains only a comment and relies on falling through to the invalidation transaction. This is easy to misread as missing logic.  
**Suggestion:** Replace the empty branch with an explicit boolean such as `const durableEffectsCommitted = ...`; then structure the condition as `if (!durableEffectsCommitted) { ... }`. That makes the intended fall-through behavior clear without a no-op block.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 4. Remove the redundant local state mutation after `flowManager.mutate()`
**Finding key:** loop-1362d8bc06e89fc4ea7f
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** In `recoverImplRepairTransaction()`, `delete state.implRepairTransaction` runs immediately after deleting the same field inside `flowManager.mutate()`. If `state` and `current` are the same object it is redundant; if they are different, mutating the caller’s state object as a side effect is surprising.  
**Suggestion:** Let `flowManager.mutate()` be the single authority for clearing persisted flow state, and remove the direct `delete state.implRepairTransaction` unless there is a documented local-cache requirement.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** In `recoverImplRepairTransaction()`, `delete state.implRepairTransaction` runs immediately after deleting the same field inside `flowManager.mutate()`. If `state` and `current` are the same object it is redundant; if they are different, mutating the caller’s state object as a side effect is surprising.  
**Suggestion:** Let `flowManager.mutate()` be the single authority for clearing persisted flow state, and remove the direct `delete state.implRepairTransaction` unless there is a documented local-cache requirement.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Centralize Final Regression Timeout Resolution
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

### 7. 2. Rename `configForAuthorityRoot` To Clarify Behavior
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

### 8. 3. Avoid Repeated Config Resolution In Command Methods
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

### 9. 4. Prefer Nullish Fallback For Context Config
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

### 10. 1. Extract target failure code normalization
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

### 11. 2. Rename `failureCode` to reflect mismatch-specific behavior
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

### 12. 1. Extract Stale Config Fixture Setup
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

### 13. 1. Consolidate Duplicate Cleanup Calls
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

### 14. 1. Align Active Flow Target Mismatch Error Codes
**Finding key:** loop-8e36545d066c9bd2cde7
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R2
**Issue:** Target/identity mismatch handling appears to diverge across files: `acceptance-review-artifacts.js` normalizes mismatches to `ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH`, while `dispatcher.js` maps `FLOW_TARGET_NOT_FOUND` to `ACTIVE_FLOW_MISMATCH` under `targetNotFoundAsMismatch`. These names suggest overlapping failure semantics but different registry codes.
**Suggestion:** Centralize target mismatch classification in a shared helper or registry-facing function, and make each call site use the same naming model: either distinguish “identity mismatch” vs “active flow mismatch” explicitly, or normalize both through one documented target-resolution error interface.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R2
**Issue:** Target/identity mismatch handling appears to diverge across files: `acceptance-review-artifacts.js` normalizes mismatches to `ACTIVE_FLOW_TARGET_IDENTITY_MISMATCH`, while `dispatcher.js` maps `FLOW_TARGET_NOT_FOUND` to `ACTIVE_FLOW_MISMATCH` under `targetNotFoundAsMismatch`. These names suggest overlapping failure semantics but different registry codes.
**Suggestion:** Centralize target mismatch classification in a shared helper or registry-facing function, and make each call site use the same naming model: either distinguish “identity mismatch” vs “active flow mismatch” explicitly, or normalize both through one documented target-resolution error interface.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Centralize Authority-Root Config Resolution
**Finding key:** loop-ca7d89ce63ba834738ba
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R1
**Issue:** `run-final-regression.js` introduces authority-root config reloading, while `tests/unit/flow/final-regression.test.js` now has to manually construct stale-context config fixtures to exercise that behavior. This suggests config resolution is becoming a cross-file contract but is still embedded in command/test-specific code.
**Suggestion:** Extract a small exported config-resolution helper, for example `resolveAuthorityRootConfig(root, fallbackConfig)`, and have command code and tests use that interface. Tests can then override only the relevant timeout fields instead of duplicating config shape.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R1
**Issue:** `run-final-regression.js` introduces authority-root config reloading, while `tests/unit/flow/final-regression.test.js` now has to manually construct stale-context config fixtures to exercise that behavior. This suggests config resolution is becoming a cross-file contract but is still embedded in command/test-specific code.
**Suggestion:** Extract a small exported config-resolution helper, for example `resolveAuthorityRootConfig(root, fallbackConfig)`, and have command code and tests use that interface. Tests can then override only the relevant timeout fields instead of duplicating config shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Normalize “Status Object” Naming Across Flow Helpers
**Finding key:** loop-0bb467838001f7acd99b
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R2
**Issue:** `durableEffectsCurrent()` returns a status object despite predicate-style naming, while nearby proposals in other files point to similar naming ambiguity such as `configForAuthorityRoot` and generic `failureCode`. Across the touched flow files, new helper names are mixing predicates, loaders, and normalized-state concepts without consistently reflecting return shape.
**Suggestion:** Adopt a naming convention for non-boolean inspection helpers, such as `inspect*`, `resolve*`, or `current*Status`, and rename `durableEffectsCurrent()` accordingly. Apply the same convention to config and target-failure helpers when extracted.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R2
**Issue:** `durableEffectsCurrent()` returns a status object despite predicate-style naming, while nearby proposals in other files point to similar naming ambiguity such as `configForAuthorityRoot` and generic `failureCode`. Across the touched flow files, new helper names are mixing predicates, loaders, and normalized-state concepts without consistently reflecting return shape.
**Suggestion:** Adopt a naming convention for non-boolean inspection helpers, such as `inspect*`, `resolve*`, or `current*Status`, and rename `durableEffectsCurrent()` accordingly. Apply the same convention to config and target-failure helpers when extracted.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
