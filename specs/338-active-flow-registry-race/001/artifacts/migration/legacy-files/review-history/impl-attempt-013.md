# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Extract rollback snapshot assertions
**Finding key:** loop-b1a9301b6026530dfbe2
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R4
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The R4 failure-loop test and the issue-log write failure test repeat the same “capture before state, execute failure, assert registry/flow/artifact/state unchanged” pattern.  
**Suggestion:** Add helpers like `captureAcceptanceDecisionSnapshot(context)` and `assertAcceptanceDecisionSnapshotUnchanged(context, snapshot, message)` to centralize the preservation checks.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The R4 failure-loop test and the issue-log write failure test repeat the same “capture before state, execute failure, assert registry/flow/artifact/state unchanged” pattern.  
**Suggestion:** Add helpers like `captureAcceptanceDecisionSnapshot(context)` and `assertAcceptanceDecisionSnapshotUnchanged(context, snapshot, message)` to centralize the preservation checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Replace string-based case branching with explicit metadata
**Finding key:** loop-572730cb9c420eb76c4a
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R4
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The R4 table checks `if (name === "registry revision conflict")`, making behavior depend on display text. Renaming the case title could silently skip the assertion.  
**Suggestion:** Add a case option such as `{ expectPostMutationObserved: true }` and branch on that metadata instead of the human-readable name.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The R4 table checks `if (name === "registry revision conflict")`, making behavior depend on display text. Renaming the case title could silently skip the assertion.  
**Suggestion:** Add a case option such as `{ expectPostMutationObserved: true }` and branch on that metadata instead of the human-readable name.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Remove unused `root` from managed flow objects
**Finding key:** loop-9ea3d020b41b9d93591d
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R5
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R5  
**Issue:** `createManagedFlow()` returns `root`, but callers already use `context.root`; the per-flow `root` property appears unused.  
**Suggestion:** Drop `root` from the returned flow object unless a test specifically needs per-flow access to the main root.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R5  
**Issue:** `createManagedFlow()` returns `root`, but callers already use `context.root`; the per-flow `root` property appears unused.  
**Suggestion:** Drop `root` from the returned flow object unless a test specifically needs per-flow access to the main root.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Consolidate fresh module imports
**Finding key:** loop-29dc419e90f4586b80a5
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R2
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R2  
**Issue:** `loadAcceptanceModule()` and `repairFingerprint()` both manually build cache-busting dynamic imports with `pathToFileURL(...).href` and `Date.now()`.  
**Suggestion:** Add a small helper such as `importFresh(modulePath)` and reuse it for both modules. This reduces duplicate import mechanics and makes the cache-busting intent clearer.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R2  
**Issue:** `loadAcceptanceModule()` and `repairFingerprint()` both manually build cache-busting dynamic imports with `pathToFileURL(...).href` and `Date.now()`.  
**Suggestion:** Add a small helper such as `importFresh(modulePath)` and reuse it for both modules. This reduces duplicate import mechanics and makes the cache-busting intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Clarify reset-step constant name
**Finding key:** loop-111168d232c1a41f9f43
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R4
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `REJECTED_IMPL_REVIEW_RESET_STEPS` is understandable, but the phrasing is slightly ambiguous: it could mean “steps that rejected impl-review reset” rather than “steps reset when impl-review is rejected.”  
**Suggestion:** Rename it to something more lifecycle-oriented, such as `IMPL_REVIEW_REJECTION_RESET_STEPS`, to match the surrounding domain terminology and make the trigger condition explicit.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** `REJECTED_IMPL_REVIEW_RESET_STEPS` is understandable, but the phrasing is slightly ambiguous: it could mean “steps that rejected impl-review reset” rather than “steps reset when impl-review is rejected.”  
**Suggestion:** Rename it to something more lifecycle-oriented, such as `IMPL_REVIEW_REJECTION_RESET_STEPS`, to match the surrounding domain terminology and make the trigger condition explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Bound issue-log rollback snapshot size
**Finding key:** loop-9f149cadaf6819a8efc3
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `AcceptanceDecisionIssueLogSnapshot.capture()` reads the entire `issue-log.json` into memory with `fs.readFileSync(file)` and has no explicit size bound, violating `bounded-resource-usage`.  
**Suggestion:** Check `stat.size` before reading and fail explicitly if it exceeds a defined maximum, or use a bounded rollback strategy such as writing a temporary backup with size validation.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `AcceptanceDecisionIssueLogSnapshot.capture()` reads the entire `issue-log.json` into memory with `fs.readFileSync(file)` and has no explicit size bound, violating `bounded-resource-usage`.  
**Suggestion:** Check `stat.size` before reading and fail explicitly if it exceeds a defined maximum, or use a bounded rollback strategy such as writing a temporary backup with size validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Extract registry entry key comparison
**Finding key:** loop-c60be5cafcea59e175b7
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** Registry entry normalization and sorted key comparison are split across the constructor and `verify()`, duplicating the `map(...).sort()` pattern and making preservation logic harder to audit.  
**Suggestion:** Add a small helper like `registryEntryKeys(entries)` or a method on `AcceptanceDecisionRegistrySnapshot` to normalize entries and compare keys consistently.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** Registry entry normalization and sorted key comparison are split across the constructor and `verify()`, duplicating the `map(...).sort()` pattern and making preservation logic harder to audit.  
**Suggestion:** Add a small helper like `registryEntryKeys(entries)` or a method on `AcceptanceDecisionRegistrySnapshot` to normalize entries and compare keys consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Rename injected issue-log dependency
**Finding key:** loop-7dff9509da73652d0966
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `appendRiskDecisionIssue(root, state, appendIssueLog)` uses a generic parameter name that reads like a boolean/action rather than the injected function replacing `appendIssueLogEntry`.  
**Suggestion:** Rename the parameter to `appendIssueLogEntryFn` or `appendIssueLogEntryImpl` in both `appendRiskDecisionIssue()` and `applyAcceptanceDecision()` to make the dependency injection clearer.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `appendRiskDecisionIssue(root, state, appendIssueLog)` uses a generic parameter name that reads like a boolean/action rather than the injected function replacing `appendIssueLogEntry`.  
**Suggestion:** Rename the parameter to `appendIssueLogEntryFn` or `appendIssueLogEntryImpl` in both `appendRiskDecisionIssue()` and `applyAcceptanceDecision()` to make the dependency injection clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Extract shared repair transaction construction
**Finding key:** loop-86ddf26083ad8e144cc0
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R1  
**Issue:** `completeLateAppliedFindingRepair` appears to duplicate the same repair lifecycle steps used by other repair completion flows: load state, resolve spec dir, read fingerprints, compute changed paths, build ledger entry, build transaction, plan invalidations, update step status, and commit effects.  
**Suggestion:** Extract the common “build repair transaction and apply lifecycle invalidation” logic into a private helper, with only the source-specific inputs passed in: source step, finding IDs, reason, reset step IDs, and previous hash behavior.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R1  
**Issue:** `completeLateAppliedFindingRepair` appears to duplicate the same repair lifecycle steps used by other repair completion flows: load state, resolve spec dir, read fingerprints, compute changed paths, build ledger entry, build transaction, plan invalidations, update step status, and commit effects.  
**Suggestion:** Extract the common “build repair transaction and apply lifecycle invalidation” logic into a private helper, with only the source-specific inputs passed in: source step, finding IDs, reason, reset step IDs, and previous hash behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Bound `sourceFindingIds` before formatting and persisting
**Finding key:** loop-dfef6b8f43c594173de5
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R5  
**Issue:** `sourceFindingIds` is accepted as an arbitrary string array and then joined into `reason` and stored in the repair entry without an explicit count or size bound. This violates the bounded-resource-usage guardrail for bulk input handling.  
**Suggestion:** Add an explicit maximum finding ID count and/or total character limit at the system boundary, then reject oversized input with a clear error before constructing `reason` or ledger artifacts.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R5  
**Issue:** `sourceFindingIds` is accepted as an arbitrary string array and then joined into `reason` and stored in the repair entry without an explicit count or size bound. This violates the bounded-resource-usage guardrail for bulk input handling.  
**Suggestion:** Add an explicit maximum finding ID count and/or total character limit at the system boundary, then reject oversized input with a clear error before constructing `reason` or ledger artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Simplify repeated `ledgerPreviousHash === previous.hash` branching
**Finding key:** loop-8b83a5e0a761ac2d050a
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4  
**Issue:** The expression `ledgerPreviousHash === previous.hash` controls both changed-path calculation and delta construction, but the condition is repeated inline. This makes the two branches easy to accidentally diverge later.  
**Suggestion:** Assign the condition to a named local such as `continuesFromManifest` or `usesManifestBaseline`, then use that variable for both `changedPaths` and `delta`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R4  
**Issue:** The expression `ledgerPreviousHash === previous.hash` controls both changed-path calculation and delta construction, but the condition is repeated inline. This makes the two branches easy to accidentally diverge later.  
**Suggestion:** Assign the condition to a named local such as `continuesFromManifest` or `usesManifestBaseline`, then use that variable for both `changedPaths` and `delta`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 4. Improve naming around `previous`
**Finding key:** loop-f0de442df39fcbcf39a6
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R2  
**Issue:** `previous` refers specifically to the repair fingerprint manifest, while `ledgerPreviousHash` may refer to either the last ledger entry or the manifest hash. The generic name makes the baseline relationship harder to follow.  
**Suggestion:** Rename `previous` to `previousManifest` or `manifestFingerprint` so the hash comparison and fallback behavior are clearer.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R2  
**Issue:** `previous` refers specifically to the repair fingerprint manifest, while `ledgerPreviousHash` may refer to either the last ledger entry or the manifest hash. The generic name makes the baseline relationship harder to follow.  
**Suggestion:** Rename `previous` to `previousManifest` or `manifestFingerprint` so the hash comparison and fallback behavior are clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Move freezing back to the shared base class
**Finding key:** loop-742a45cc748c2799b011
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** Both subclasses define identical constructors whose only purpose is `super(input); Object.freeze(this);`. This duplicates boilerplate introduced by the new shared base class.  
**Suggestion:** Put `Object.freeze(this)` back in `ReviewRecoveryMutation` after shared field initialization, then remove the subclass constructors.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** Both subclasses define identical constructors whose only purpose is `super(input); Object.freeze(this);`. This duplicates boilerplate introduced by the new shared base class.  
**Suggestion:** Put `Object.freeze(this)` back in `ReviewRecoveryMutation` after shared field initialization, then remove the subclass constructors.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Rename `readCurrent` to reflect validation behavior
**Finding key:** loop-6edaa6abf104741946ff
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** `readCurrent()` does more than read current state: it validates run/task/spec/issue expectations and throws if the target record no longer matches. The current name undersells the side effects.  
**Suggestion:** Rename it to something like `resolveCurrentRecord()` or `validateAndReadCurrent()` so callers understand it performs optimistic-concurrency validation.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R2  
**Issue:** `readCurrent()` does more than read current state: it validates run/task/spec/issue expectations and throws if the target record no longer matches. The current name undersells the side effects.  
**Suggestion:** Rename it to something like `resolveCurrentRecord()` or `validateAndReadCurrent()` so callers understand it performs optimistic-concurrency validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Guard semantic attempt decrement
**Finding key:** loop-9d1447ce8390415ff7e2
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R3  
**Issue:** `semanticAttempts: current.semanticMaxAttempts - 1` can become `-1` if `semanticMaxAttempts` is `0` and `semanticAttempts` is also `0`, because the exhaustion check still passes.  
**Suggestion:** Add an explicit lower-bound check before constructing `recovered`, or clamp with clear intent, e.g. require `current.semanticMaxAttempts > 0` before subtracting.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R3  
**Issue:** `semanticAttempts: current.semanticMaxAttempts - 1` can become `-1` if `semanticMaxAttempts` is `0` and `semanticAttempts` is also `0`, because the exhaustion check still passes.  
**Suggestion:** Add an explicit lower-bound check before constructing `recovered`, or clamp with clear intent, e.g. require `current.semanticMaxAttempts > 0` before subtracting.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Clarify wrapper return shape
**Finding key:** loop-73d0fdf4156ef1a0b419
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `completeImplRepairStep()` returns `{ completed, mutationOptions }`, but `mutationOptions` is unused and callers must access `completed.completed.entry`, which is awkward and easy to misread.  
**Suggestion:** Return the repair result directly, or rename the outer field to avoid repetition. For example, return `{ repair, mutationOptions }`, then use `completed.repair.entry`, or omit `mutationOptions` entirely if it is only internal.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `completeImplRepairStep()` returns `{ completed, mutationOptions }`, but `mutationOptions` is unused and callers must access `completed.completed.entry`, which is awkward and easy to misread.  
**Suggestion:** Return the repair result directly, or rename the outer field to avoid repetition. For example, return `{ repair, mutationOptions }`, then use `completed.repair.entry`, or omit `mutationOptions` entirely if it is only internal.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Extract repeated artifact JSON reads
**Finding key:** loop-fa5dedf634c0aa16d553
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `missingAppliedFindingIds()` repeats `JSON.parse(fs.readFileSync(path.join(specDir, ...), "utf8"))` for multiple artifacts. This adds noise and makes future validation changes more error-prone.  
**Suggestion:** Add a small local helper such as `readSpecJson(specDir, artifactName)` and use it for `impl-triage.json`, `impl-review.json`, and the test evidence artifacts.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `missingAppliedFindingIds()` repeats `JSON.parse(fs.readFileSync(path.join(specDir, ...), "utf8"))` for multiple artifacts. This adds noise and makes future validation changes more error-prone.  
**Suggestion:** Add a small local helper such as `readSpecJson(specDir, artifactName)` and use it for `impl-triage.json`, `impl-review.json`, and the test evidence artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Avoid unbounded triage/review processing
**Finding key:** loop-613376f6b5efc9f014b7
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `missingAppliedFindingIds()` loads and iterates all review findings, triage items, and ledger entries without an explicit count bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Enforce explicit maximum counts before building sets or flattening ledger entries, ideally using existing project constants if available. For example, validate maximum review findings, triage items, ledger entries, and source finding IDs per ledger entry before processing.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `missingAppliedFindingIds()` loads and iterates all review findings, triage items, and ledger entries without an explicit count bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Enforce explicit maximum counts before building sets or flattening ledger entries, ideally using existing project constants if available. For example, validate maximum review findings, triage items, ledger entries, and source finding IDs per ledger entry before processing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Simplify boolean-heavy recovery predicate naming
**Finding key:** loop-11c1d0da025420e82327
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `isBlockedImplRepairRecovery()` sounds like it validates the whole recovery condition, but it only checks step/status/active-node shape. The actual blocked-attempt and artifact validation happens later.  
**Suggestion:** Rename it to something narrower, such as `isImplRepairRecoveryRequest()` or `matchesImplRepairRecoveryStepState()`, so callers do not assume all recovery preconditions have been checked.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `isBlockedImplRepairRecovery()` sounds like it validates the whole recovery condition, but it only checks step/status/active-node shape. The actual blocked-attempt and artifact validation happens later.  
**Suggestion:** Rename it to something narrower, such as `isImplRepairRecoveryRequest()` or `matchesImplRepairRecoveryStepState()`, so callers do not assume all recovery preconditions have been checked.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Add an explicit snapshot size bound
**Finding key:** loop-0bbf8fedf5835102a4fb
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R4
**Issue:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** `ActiveFlowRegistrySnapshot` copies and freezes every registry entry without an explicit upper bound. Under the `bounded-resource-usage` guardrail, bulk loading/copying should have a defined maximum size.  
**Suggestion:** Introduce a registry snapshot entry limit, validate `entries.length` before mapping, and return an explicit failure/error when exceeded.
**Suggestion:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** `ActiveFlowRegistrySnapshot` copies and freezes every registry entry without an explicit upper bound. Under the `bounded-resource-usage` guardrail, bulk loading/copying should have a defined maximum size.  
**Suggestion:** Introduce a registry snapshot entry limit, validate `entries.length` before mapping, and return an explicit failure/error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Rename the local `snapshot` variable
**Finding key:** loop-7c994670e33b0fb672bd
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R4
**Issue:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** In `snapshot()`, the local variable named `snapshot` actually holds the full authority read result, not an `ActiveFlowRegistrySnapshot`. This makes the method harder to scan because the returned object has the same conceptual name.  
**Suggestion:** Rename it to something like `authorityState`, `registryState`, or `readResult`:

```js
const authorityState = readActiveFlowAuthority(activeFlowPath(this._mainRoot));
return new ActiveFlowRegistrySnapshot({
  entries: authorityState.document.entries,
  revision: authorityState.revision,
});
```
**Suggestion:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** In `snapshot()`, the local variable named `snapshot` actually holds the full authority read result, not an `ActiveFlowRegistrySnapshot`. This makes the method harder to scan because the returned object has the same conceptual name.  
**Suggestion:** Rename it to something like `authorityState`, `registryState`, or `readResult`:

```js
const authorityState = readActiveFlowAuthority(activeFlowPath(this._mainRoot));
return new ActiveFlowRegistrySnapshot({
  entries: authorityState.document.entries,
  revision: authorityState.revision,
});
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Simplify entry normalization in `ActiveFlowRegistrySnapshot`
**Finding key:** loop-640a5070d917df8855fc
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R4
**Issue:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** The constructor embeds normalization, serialization, and freezing in one nested expression, which makes the behavior harder to read and maintain.  
**Suggestion:** Extract a small helper such as `snapshotEntry(entry)` or split the mapping into clearer steps before freezing. This would also make future validation easier, especially if snapshot limits or entry-shape checks are added.
**Suggestion:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** The constructor embeds normalization, serialization, and freezing in one nested expression, which makes the behavior harder to read and maintain.  
**Suggestion:** Extract a small helper such as `snapshotEntry(entry)` or split the mapping into clearer steps before freezing. This would also make future validation easier, especially if snapshot limits or entry-shape checks are added.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Align exact-target validation
**Finding key:** loop-fe6c3cf88dbeb1b7c993
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `captureExactTarget()` requires `expectation.spec != null`, but `mutateExactTarget()` only rejects empty expectations. Despite its “exact target” name, it can accept a runId/Issue-only expectation, resolve a target, discard the resolved spec, then call `#mutateCapturedTarget()` with `specId: expectation.spec`, which may be `null`.  
**Suggestion:** Extract a shared helper such as `assertExactFlowTargetWithSpec(expectation, action)` and use it in `CapturedFlowTargetMutation`, `captureExactTarget()`, and `mutateExactTarget()` so all exact mutation paths require a spec identity consistently.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `captureExactTarget()` requires `expectation.spec != null`, but `mutateExactTarget()` only rejects empty expectations. Despite its “exact target” name, it can accept a runId/Issue-only expectation, resolve a target, discard the resolved spec, then call `#mutateCapturedTarget()` with `specId: expectation.spec`, which may be `null`.  
**Suggestion:** Extract a shared helper such as `assertExactFlowTargetWithSpec(expectation, action)` and use it in `CapturedFlowTargetMutation`, `captureExactTarget()`, and `mutateExactTarget()` so all exact mutation paths require a spec identity consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Remove duplicated explicit target resolver
**Finding key:** loop-8b8502902af744412e62
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R3
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `resolveExplicitFlowTarget()` and `resolveExplicitFlowTargetForRead()` currently have identical implementations. This adds another public method name without any behavioral distinction, making future changes easy to apply to one path but not the other.  
**Suggestion:** Make one method delegate to the other, or remove the duplicate if both read and mutation call sites can use the same resolver. For example, keep `resolveExplicitFlowTargetForRead()` only if it will later differ; otherwise implement `resolveExplicitFlowTargetForRead(expectation) { return this.resolveExplicitFlowTarget(expectation); }`.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `resolveExplicitFlowTarget()` and `resolveExplicitFlowTargetForRead()` currently have identical implementations. This adds another public method name without any behavioral distinction, making future changes easy to apply to one path but not the other.  
**Suggestion:** Make one method delegate to the other, or remove the duplicate if both read and mutation call sites can use the same resolver. For example, keep `resolveExplicitFlowTargetForRead()` only if it will later differ; otherwise implement `resolveExplicitFlowTargetForRead(expectation) { return this.resolveExplicitFlowTarget(expectation); }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Rename captured mutation wrapper for clarity
**Finding key:** loop-51aaee41d91e0ac2efb8
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `CapturedFlowTargetMutation` reads like it represents a mutation result, but it actually represents a captured exact flow target that can later perform mutations. The internal method `_mutate` and public method `mutate()` also make the class harder to scan.  
**Suggestion:** Rename it to something like `CapturedFlowTarget` or `CapturedExactFlowTarget`, and rename the constructor callback to `mutateTarget` or `runMutation` to clarify that the object stores target identity plus a mutation operation.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `CapturedFlowTargetMutation` reads like it represents a mutation result, but it actually represents a captured exact flow target that can later perform mutations. The internal method `_mutate` and public method `mutate()` also make the class harder to scan.  
**Suggestion:** Rename it to something like `CapturedFlowTarget` or `CapturedExactFlowTarget`, and rename the constructor callback to `mutateTarget` or `runMutation` to clarify that the object stores target identity plus a mutation operation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Extract Shared Review Convergence Record Setup
**Finding key:** loop-6cbda61996857ee9bdb0
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The new test builds a full `reviewConvergence.records[0]` object inline. This is verbose and likely duplicates similar record setup elsewhere in the same test file, making future field additions or default changes harder to maintain.  
**Suggestion:** Add a local helper in this file, such as `makeReviewConvergenceRecord(overrides)`, with sensible defaults for common fields. Use overrides for `treeSha`, attempt counts, evidence, and provider-specific values. This keeps the test focused on the behavior under review.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The new test builds a full `reviewConvergence.records[0]` object inline. This is verbose and likely duplicates similar record setup elsewhere in the same test file, making future field additions or default changes harder to maintain.  
**Suggestion:** Add a local helper in this file, such as `makeReviewConvergenceRecord(overrides)`, with sensible defaults for common fields. Use overrides for `treeSha`, attempt counts, evidence, and provider-specific values. This keeps the test focused on the behavior under review.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Name the Test Around the Observable Behavior
**Finding key:** loop-3620b7413002ae5d9508
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** The test title says “commits a changed-tree review grant and semantic reset in one flow mutation”, but the assertions mainly verify that semantic recovery resets convergence state when the tree changes. “Grant” is not clearly reflected in the assertions and makes the intent harder to scan.  
**Suggestion:** Rename the test to something more direct, for example: `resets semantic review convergence when review evidence tree changes`. This better matches the setup and expected state changes.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** The test title says “commits a changed-tree review grant and semantic reset in one flow mutation”, but the assertions mainly verify that semantic recovery resets convergence state when the tree changes. “Grant” is not clearly reflected in the assertions and makes the intent harder to scan.  
**Suggestion:** Rename the test to something more direct, for example: `resets semantic review convergence when review evidence tree changes`. This better matches the setup and expected state changes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Rename helper to match returned shape
**Finding key:** loop-f1bb26024e47658bd481
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** `updatesFor()` now returns `{ updates, flowState }`, not just updates. The name is misleading and forces callers to know the helper’s internal return shape.  
**Suggestion:** Rename it to something like `runPostHookFor()` or `stateAfterPostHook()` so the helper name reflects that it returns both captured transitions and mutated flow state.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** `updatesFor()` now returns `{ updates, flowState }`, not just updates. The name is misleading and forces callers to know the helper’s internal return shape.  
**Suggestion:** Rename it to something like `runPostHookFor()` or `stateAfterPostHook()` so the helper name reflects that it returns both captured transitions and mutated flow state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Avoid custom camelCase keys for step status overrides
**Finding key:** loop-3bc2d4961cea83c65f83
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** `priorStatuses.implRepair` and `priorStatuses.implGate` duplicate step identity using names that differ from the actual step ids, increasing the chance of drift.  
**Suggestion:** Use step ids directly as keys, e.g. `priorStatuses["impl-repair"] || "pending"` and pass `{ "impl-repair": "done", "impl-gate": "done" }`. This keeps the test data aligned with the domain identifiers it is exercising.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** `priorStatuses.implRepair` and `priorStatuses.implGate` duplicate step identity using names that differ from the actual step ids, increasing the chance of drift.  
**Suggestion:** Use step ids directly as keys, e.g. `priorStatuses["impl-repair"] || "pending"` and pass `{ "impl-repair": "done", "impl-gate": "done" }`. This keeps the test data aligned with the domain identifiers it is exercising.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Extract the in-memory flow manager test double
**Finding key:** loop-32dffd95d67ac8da0242
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The new test builds a fairly detailed `flowManager` inline, including transition application, status mutation, and intent completion behavior. This is substantial fixture code inside a scenario test and is likely to be duplicated by future recovery-transition tests.  
**Suggestion:** Move this into a small local helper such as `makeFlowManagerStub(state, transitions)` or a shared test helper if similar patterns already exist in this file. Keep the test focused on arrange/assert semantics rather than flow-manager mechanics.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The new test builds a fairly detailed `flowManager` inline, including transition application, status mutation, and intent completion behavior. This is substantial fixture code inside a scenario test and is likely to be duplicated by future recovery-transition tests.  
**Suggestion:** Move this into a small local helper such as `makeFlowManagerStub(state, transitions)` or a shared test helper if similar patterns already exist in this file. Keep the test focused on arrange/assert semantics rather than flow-manager mechanics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Reuse the spec directory path consistently
**Finding key:** loop-954694e02489f0d1b780
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** The test defines `SPEC_PATH` and `specDir`, but still repeats `"specs/001-test/..."` string literals for artifact paths. This makes the fixture more brittle if the spec path changes.  
**Suggestion:** Build artifact paths from `SPEC_PATH` or introduce a helper like `artifactPath(name)` returning `path.join(path.dirname(SPEC_PATH), name)`, then use it for `impl-review.json`, `test-execute-result.json`, and `test-result-review.json`.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** The test defines `SPEC_PATH` and `specDir`, but still repeats `"specs/001-test/..."` string literals for artifact paths. This makes the fixture more brittle if the spec path changes.  
**Suggestion:** Build artifact paths from `SPEC_PATH` or introduce a helper like `artifactPath(name)` returning `path.join(path.dirname(SPEC_PATH), name)`, then use it for `impl-review.json`, `test-execute-result.json`, and `test-result-review.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Name the fingerprint by role rather than chronology
**Finding key:** loop-0f21176511fd0003eb27
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R3  
**Issue:** `previousFingerprint` is technically accurate, but the important test concept is that this is the review-time fingerprint used to detect changed implementation state. The current name forces readers to infer why it matters.  
**Suggestion:** Rename it to something more intent-revealing, such as `reviewFingerprint` or `blockedReviewFingerprint`, and use that name in the related artifact setup.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R3  
**Issue:** `previousFingerprint` is technically accurate, but the important test concept is that this is the review-time fingerprint used to detect changed implementation state. The current name forces readers to infer why it matters.  
**Suggestion:** Rename it to something more intent-revealing, such as `reviewFingerprint` or `blockedReviewFingerprint`, and use that name in the related artifact setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 4. Avoid manual status mutation details in the test body
**Finding key:** loop-f5addd29e9ba19d127fb
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R4  
**Issue:** The inline `updateStepStatuses` implementation reaches into `transition.changes` and mutates `findStepById(...).status` directly. That low-level behavior is not what this test is primarily validating, and it couples the test to transition internals.  
**Suggestion:** Hide this behind a helper with a narrow name like `applyTransitionChanges(state, transition)` or reuse an existing flow-test helper if available. This keeps the recovery behavior test insulated from mechanical transition application details.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R4  
**Issue:** The inline `updateStepStatuses` implementation reaches into `transition.changes` and mutates `findStepById(...).status` directly. That low-level behavior is not what this test is primarily validating, and it couples the test to transition internals.  
**Suggestion:** Hide this behind a helper with a narrow name like `applyTransitionChanges(state, transition)` or reuse an existing flow-test helper if available. This keeps the recovery behavior test insulated from mechanical transition application details.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Centralize rollback snapshot behavior
**Finding key:** loop-44baeff68b610dcb975b
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** Both `AcceptanceDecisionIssueLogSnapshot` and `ActiveFlowRegistrySnapshot` introduce snapshot/rollback-style preservation logic, while tests also propose separate snapshot assertion helpers. The snapshot concepts are spreading across files with different bounds, key comparison, and naming patterns.  
**Suggestion:** Extract or align a shared snapshot convention for acceptance-decision rollback checks: bounded capture, normalized entry keys, and unchanged-state verification helpers.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** Both `AcceptanceDecisionIssueLogSnapshot` and `ActiveFlowRegistrySnapshot` introduce snapshot/rollback-style preservation logic, while tests also propose separate snapshot assertion helpers. The snapshot concepts are spreading across files with different bounds, key comparison, and naming patterns.  
**Suggestion:** Extract or align a shared snapshot convention for acceptance-decision rollback checks: bounded capture, normalized entry keys, and unchanged-state verification helpers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Share bounded bulk-input limits for finding IDs
**Finding key:** loop-7d7746f03bb6f58af5ab
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `sourceFindingIds` handling in `impl-repair-artifacts.js` and ledger/review finding processing in `set-step.js` both need explicit bounds, but the proposals would likely add separate limits in each file. That risks inconsistent accepted sizes for the same repair workflow data.  
**Suggestion:** Define shared constants for max source finding IDs, ledger entries, and finding ID string size, then use them in both repair completion and missing-applied-finding validation.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `sourceFindingIds` handling in `impl-repair-artifacts.js` and ledger/review finding processing in `set-step.js` both need explicit bounds, but the proposals would likely add separate limits in each file. That risks inconsistent accepted sizes for the same repair workflow data.  
**Suggestion:** Define shared constants for max source finding IDs, ledger entries, and finding ID string size, then use them in both repair completion and missing-applied-finding validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Align fingerprint baseline naming
**Finding key:** loop-b1a63e721e3ae48bd35e
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** Production code uses generic `previous` for the repair fingerprint manifest, while tests use `previousFingerprint` for the review-time fingerprint. Across files, the important role is baseline/review fingerprint, not chronology.  
**Suggestion:** Rename production and test variables around role, such as `previousManifest`, `reviewFingerprint`, or `blockedReviewFingerprint`, so the same concept is recognizable across implementation and tests.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** Production code uses generic `previous` for the repair fingerprint manifest, while tests use `previousFingerprint` for the review-time fingerprint. Across files, the important role is baseline/review fingerprint, not chronology.  
**Suggestion:** Rename production and test variables around role, such as `previousManifest`, `reviewFingerprint`, or `blockedReviewFingerprint`, so the same concept is recognizable across implementation and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Use step IDs consistently in test fixtures
**Finding key:** loop-cb1a3995e5ff328fa24d
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** This test introduces camelCase status override keys like `implRepair` and `implGate`, while other tests and implementation paths use canonical step IDs such as `impl-repair` and `impl-gate`. This creates cross-file naming drift from the domain identifiers.  
**Suggestion:** Use canonical step IDs as object keys in test fixtures and helpers, matching the identifiers used by flow state and transition code.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** This test introduces camelCase status override keys like `implRepair` and `implGate`, while other tests and implementation paths use canonical step IDs such as `impl-repair` and `impl-gate`. This creates cross-file naming drift from the domain identifiers.  
**Suggestion:** Use canonical step IDs as object keys in test fixtures and helpers, matching the identifiers used by flow state and transition code.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
