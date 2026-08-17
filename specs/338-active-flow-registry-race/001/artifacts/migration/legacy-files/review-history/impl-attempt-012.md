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

### 23. 1. Consolidate Exact Target Validation
**Finding key:** loop-f2f3e7b0387ff672e441
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** The exact-target validation is duplicated in `CapturedFlowTargetMutation` and `FlowManager.captureExactTarget`, and `mutateExactTarget` uses a weaker version that does not require `expectation.spec != null`. That inconsistency risks allowing a mutation without the spec identity required by the managed-worktree flow-state write.  
**Suggestion:** Extract a small helper such as `assertExactFlowTargetWithSpec(expectation, message)` and use it in all three paths, including `mutateExactTarget`.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** The exact-target validation is duplicated in `CapturedFlowTargetMutation` and `FlowManager.captureExactTarget`, and `mutateExactTarget` uses a weaker version that does not require `expectation.spec != null`. That inconsistency risks allowing a mutation without the spec identity required by the managed-worktree flow-state write.  
**Suggestion:** Extract a small helper such as `assertExactFlowTargetWithSpec(expectation, message)` and use it in all three paths, including `mutateExactTarget`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Avoid Revalidating Captured Targets
**Finding key:** loop-b60fd1821c4fe90dbde2
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `captureExactTarget` validates the expectation, then `CapturedFlowTargetMutation` validates the same expectation again. This adds duplicate defensive code without changing behavior because construction is private to this module.  
**Suggestion:** Either move validation entirely into `CapturedFlowTargetMutation` or validate once before construction and make the wrapper constructor assume a validated target.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `captureExactTarget` validates the expectation, then `CapturedFlowTargetMutation` validates the same expectation again. This adds duplicate defensive code without changing behavior because construction is private to this module.  
**Suggestion:** Either move validation entirely into `CapturedFlowTargetMutation` or validate once before construction and make the wrapper constructor assume a validated target.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Clarify Captured Mutation Naming
**Finding key:** loop-3d47b274f9b7b8ab81eb
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R3
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` sounds like it represents a mutation that has already happened, but it actually captures a target and exposes a future `mutate` operation.  
**Suggestion:** Rename it to something action-neutral like `CapturedFlowTarget`, `BoundFlowTargetMutation`, or `FlowTargetMutationHandle` to better match its role.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` sounds like it represents a mutation that has already happened, but it actually captures a target and exposes a future `mutate` operation.  
**Suggestion:** Rename it to something action-neutral like `CapturedFlowTarget`, `BoundFlowTargetMutation`, or `FlowTargetMutationHandle` to better match its role.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Simplify Captured Mutation Wrapper
**Finding key:** loop-771eaea19453b49fbacc
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R3
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` stores `expectation` but never uses it internally except as a public property; the actual behavior is entirely delegated through `_mutate`. This makes the class feel heavier than its responsibilities.  
**Suggestion:** If external callers only need `.mutate(...)`, replace the class with a frozen plain object returned by `captureExactTarget`, or have the class own the expectation and call back into a supplied manager/store method directly.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` stores `expectation` but never uses it internally except as a public property; the actual behavior is entirely delegated through `_mutate`. This makes the class feel heavier than its responsibilities.  
**Suggestion:** If external callers only need `.mutate(...)`, replace the class with a frozen plain object returned by `captureExactTarget`, or have the class own the expectation and call back into a supplied manager/store method directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Extract Shared Review Convergence Record Setup
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

### 28. 2. Name the Test Around the Observable Behavior
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

### 29. 1. Rename helper to match expanded return value
**Finding key:** loop-0aa3935c95ce416ff6f9
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** `updatesFor()` now returns `{ updates, flowState }`, not just updates. The name is misleading and makes the assertions read awkwardly with repeated `.updates` access.  
**Suggestion:** Rename it to something like `runPostHookFor()` or `postHookResultFor()`, then use the returned object consistently.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** `updatesFor()` now returns `{ updates, flowState }`, not just updates. The name is misleading and makes the assertions read awkwardly with repeated `.updates` access.  
**Suggestion:** Rename it to something like `runPostHookFor()` or `postHookResultFor()`, then use the returned object consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Use step-id keyed prior status overrides
**Finding key:** loop-2ca28889ce0b5acad6fc
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** `priorStatuses.implRepair` and `priorStatuses.implGate` introduce camelCase aliases for step IDs that are otherwise hyphenated (`impl-repair`, `impl-gate`). This creates a small naming mismatch inside the test fixture.  
**Suggestion:** Key `priorStatuses` by actual step ID names, e.g. `priorStatuses["impl-repair"]`, so the setup mirrors `flowState.steps` directly and avoids translation logic.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** `priorStatuses.implRepair` and `priorStatuses.implGate` introduce camelCase aliases for step IDs that are otherwise hyphenated (`impl-repair`, `impl-gate`). This creates a small naming mismatch inside the test fixture.  
**Suggestion:** Key `priorStatuses` by actual step ID names, e.g. `priorStatuses["impl-repair"]`, so the setup mirrors `flowState.steps` directly and avoids translation logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Extract the Inline Flow Manager Fixture
**Finding key:** loop-286ad0b97fb5e4a4a781
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The new test builds a fairly detailed `flowManager` mock inline, including transition application, mutation, and completion behavior. This makes the test harder to scan and will likely be duplicated by future recovery-path tests.  
**Suggestion:** Move the mock construction into a local helper such as `makeFlowManagerForState(state, transitions)` within this same test file. Keep the helper scoped to the file so the test body focuses on setup, command execution, and assertions.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The new test builds a fairly detailed `flowManager` mock inline, including transition application, mutation, and completion behavior. This makes the test harder to scan and will likely be duplicated by future recovery-path tests.  
**Suggestion:** Move the mock construction into a local helper such as `makeFlowManagerForState(state, transitions)` within this same test file. Keep the helper scoped to the file so the test body focuses on setup, command execution, and assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Name the Fingerprint Variables by Scenario Role
**Finding key:** loop-7795ae6c56f5fa34a359
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `previousFingerprint` is accurate but slightly vague in this scenario. The fingerprint represents the blocked review baseline that later becomes stale after the target file is changed.  
**Suggestion:** Rename it to something more intent-revealing, such as `blockedReviewFingerprint` or `preRepairFingerprint`, and update the related artifact writes accordingly.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `previousFingerprint` is accurate but slightly vague in this scenario. The fingerprint represents the blocked review baseline that later becomes stale after the target file is changed.  
**Suggestion:** Rename it to something more intent-revealing, such as `blockedReviewFingerprint` or `preRepairFingerprint`, and update the related artifact writes accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Extract Repeated Spec Directory Path
**Finding key:** loop-122f344756e49db282a3
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R4  
**Issue:** The test repeats `"specs/001-test"` and also derives paths from both `SPEC_PATH` and hard-coded strings. This creates a small consistency risk if the fixture path changes.  
**Suggestion:** Introduce a local constant near `SPEC_PATH`, for example `const SPEC_DIR = "specs/001-test";`, and use it for `path.join(tmp, SPEC_DIR)` and artifact paths in this file.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R4  
**Issue:** The test repeats `"specs/001-test"` and also derives paths from both `SPEC_PATH` and hard-coded strings. This creates a small consistency risk if the fixture path changes.  
**Suggestion:** Introduce a local constant near `SPEC_PATH`, for example `const SPEC_DIR = "specs/001-test";`, and use it for `path.join(tmp, SPEC_DIR)` and artifact paths in this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Standardize Snapshot Size Bounds
**Finding key:** loop-891cd09e0b4d44c78e4e
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R4
**Issue:** Multiple snapshot implementations were flagged for unbounded bulk copying/reading: `AcceptanceDecisionIssueLogSnapshot.capture()` reads the full issue log, while `ActiveFlowRegistrySnapshot` copies all registry entries. Treating these independently risks inconsistent resource limits and error behavior across rollback/snapshot code.
**Suggestion:** Introduce shared snapshot limit constants or a small validation helper for rollback/snapshot reads, then apply it consistently in both acceptance-review artifact snapshots and active-flow registry snapshots.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R4
**Issue:** Multiple snapshot implementations were flagged for unbounded bulk copying/reading: `AcceptanceDecisionIssueLogSnapshot.capture()` reads the full issue log, while `ActiveFlowRegistrySnapshot` copies all registry entries. Treating these independently risks inconsistent resource limits and error behavior across rollback/snapshot code.
**Suggestion:** Introduce shared snapshot limit constants or a small validation helper for rollback/snapshot reads, then apply it consistently in both acceptance-review artifact snapshots and active-flow registry snapshots.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Reuse Registry Entry Key Normalization
**Finding key:** loop-b04a177c7294ae4c1bbe
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R2
**Issue:** Registry snapshot/key preservation logic appears in both `acceptance-review-artifacts.js` and `active-flow-registry.js`, with separate normalization/sorting/copying concerns. This can drift if registry entry shape or comparison semantics change.
**Suggestion:** Move registry entry key extraction/normalization into a shared helper near `src/lib/active-flow-registry.js`, then reuse it from acceptance decision rollback verification.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R2
**Issue:** Registry snapshot/key preservation logic appears in both `acceptance-review-artifacts.js` and `active-flow-registry.js`, with separate normalization/sorting/copying concerns. This can drift if registry entry shape or comparison semantics change.
**Suggestion:** Move registry entry key extraction/normalization into a shared helper near `src/lib/active-flow-registry.js`, then reuse it from acceptance decision rollback verification.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Align Impl-Review Reset Naming
**Finding key:** loop-4dd16a9dda207003ae4a
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R4
**Issue:** **File:** `src/flow/definition.js`
**Requirement:** R4
**Issue:** `REJECTED_IMPL_REVIEW_RESET_STEPS` in `definition.js` and the repair/recovery terminology in `impl-repair-artifacts.js`/`set-step.js` describe the same lifecycle behavior with slightly different framing: rejected review reset, semantic reset, and repair recovery invalidation. This makes cross-file flow behavior harder to trace.
**Suggestion:** Pick one lifecycle phrase, such as `IMPL_REVIEW_REJECTION_RESET_STEPS`, and use matching names in repair transaction inputs, test titles, and recovery assertions.
**Suggestion:** **File:** `src/flow/definition.js`
**Requirement:** R4
**Issue:** `REJECTED_IMPL_REVIEW_RESET_STEPS` in `definition.js` and the repair/recovery terminology in `impl-repair-artifacts.js`/`set-step.js` describe the same lifecycle behavior with slightly different framing: rejected review reset, semantic reset, and repair recovery invalidation. This makes cross-file flow behavior harder to trace.
**Suggestion:** Pick one lifecycle phrase, such as `IMPL_REVIEW_REJECTION_RESET_STEPS`, and use matching names in repair transaction inputs, test titles, and recovery assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Consolidate Exact Target Validation
**Finding key:** loop-fc0beaadf1d1402dbf13
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`
**Requirement:** R1
**Issue:** Exact target validation is duplicated and inconsistent inside `flow-manager.js`, while `set-step.js` depends on these captured/mutated flow targets for impl-repair recovery. A weaker path in `mutateExactTarget` can create cross-file interface ambiguity about whether `spec` is guaranteed.
**Suggestion:** Extract a single exact-target-with-spec validator and make all captured target and mutation entry points use it before downstream flow-state writes.
**Suggestion:** **File:** `src/lib/flow-manager.js`
**Requirement:** R1
**Issue:** Exact target validation is duplicated and inconsistent inside `flow-manager.js`, while `set-step.js` depends on these captured/mutated flow targets for impl-repair recovery. A weaker path in `mutateExactTarget` can create cross-file interface ambiguity about whether `spec` is guaranteed.
**Suggestion:** Extract a single exact-target-with-spec validator and make all captured target and mutation entry points use it before downstream flow-state writes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 5. Normalize Step ID Fixture Keys
**Finding key:** loop-9fc90a3ecc5f72a6b7f4
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`
**Requirement:** R5
**Issue:** Some tests use camelCase aliases like `priorStatuses.implRepair`, while other files and production code use canonical hyphenated step IDs such as `impl-repair`. This creates naming friction across fixtures and increases translation logic.
**Suggestion:** Key test fixtures by canonical step IDs everywhere, for example `priorStatuses["impl-repair"]`, matching `flowState.steps` and production step constants.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`
**Requirement:** R5
**Issue:** Some tests use camelCase aliases like `priorStatuses.implRepair`, while other files and production code use canonical hyphenated step IDs such as `impl-repair`. This creates naming friction across fixtures and increases translation logic.
**Suggestion:** Key test fixtures by canonical step IDs everywhere, for example `priorStatuses["impl-repair"]`, matching `flowState.steps` and production step constants.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
