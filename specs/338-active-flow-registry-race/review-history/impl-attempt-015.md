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

### 6. 1. Add an Explicit Registry Snapshot Size Bound
**Finding key:** loop-f1a8334eb9a7bfcc5898
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `AcceptanceDecisionRegistrySnapshot` maps and compares every `registrySnapshot.entries` item without an explicit size bound. This violates the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Define a local maximum, for example `MAX_ACCEPTANCE_DECISION_REGISTRY_ENTRIES`, validate `registrySnapshot.entries.length` during capture and verification, and fail with an explicit registry error if exceeded.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `AcceptanceDecisionRegistrySnapshot` maps and compares every `registrySnapshot.entries` item without an explicit size bound. This violates the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Define a local maximum, for example `MAX_ACCEPTANCE_DECISION_REGISTRY_ENTRIES`, validate `registrySnapshot.entries.length` during capture and verification, and fail with an explicit registry error if exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Extract Registry Entry Key Comparison
**Finding key:** loop-8e67d8fb3b418ff8ebc4
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** Registry entry normalization and sorted key comparison logic is duplicated across snapshot construction and `verify()`, making identity-preservation logic harder to audit.  
**Suggestion:** Add small helpers such as `normalizeRegistryEntries(entries)` and `sameRegistryEntryKeys(a, b)` to centralize entry construction, sorting, and equality checks.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** Registry entry normalization and sorted key comparison logic is duplicated across snapshot construction and `verify()`, making identity-preservation logic harder to audit.  
**Suggestion:** Add small helpers such as `normalizeRegistryEntries(entries)` and `sameRegistryEntryKeys(a, b)` to centralize entry construction, sorting, and equality checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Rename `appendIssueLog` Parameter for Consistency
**Finding key:** loop-c6ec709d52572f174b80
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `applyAcceptanceDecision` injects `appendIssueLog = appendIssueLogEntry`, then passes it to `appendRiskDecisionIssue`. The shorter name reads like data rather than a function and is very close to the existing imported function name.  
**Suggestion:** Rename the injected parameter to `appendIssueLogEntryFn` or `appendRiskIssueLogEntry` and pass that through to clarify it is a dependency-injected callback used for testing/failure injection.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** `applyAcceptanceDecision` injects `appendIssueLog = appendIssueLogEntry`, then passes it to `appendRiskDecisionIssue`. The shorter name reads like data rather than a function and is very close to the existing imported function name.  
**Suggestion:** Rename the injected parameter to `appendIssueLogEntryFn` or `appendRiskIssueLogEntry` and pass that through to clarify it is a dependency-injected callback used for testing/failure injection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Avoid Returning a Hard-Coded `prohibitedOperations: []`
**Finding key:** loop-5b1ff5eaca1b0e36490a
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `AcceptanceDecisionRegistrySnapshot.verify()` always returns `prohibitedOperations: []`, but the code does not actually record or inspect prohibited remove/park/document-replacement operations. This field can imply stronger verification than the implementation provides.  
**Suggestion:** Remove the field unless it is populated from real instrumentation, or rename the returned object to reflect what is actually verified: target identity, registry revision, and entry preservation.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `AcceptanceDecisionRegistrySnapshot.verify()` always returns `prohibitedOperations: []`, but the code does not actually record or inspect prohibited remove/park/document-replacement operations. This field can imply stronger verification than the implementation provides.  
**Suggestion:** Remove the field unless it is populated from real instrumentation, or rename the returned object to reflect what is actually verified: target identity, registry revision, and entry preservation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 5. Simplify Rollback Error Accumulation
**Finding key:** loop-d25aa709598d4cbb0f37
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `appendRollbackError()` builds nested `AggregateError` instances as rollback steps fail, which can make failure reporting noisy and harder to inspect.  
**Suggestion:** Accumulate rollback failures in an array inside the catch block, then throw one `AggregateError([error, ...rollbackErrors], ...)` if any rollback failed. This keeps the rollback path simpler and preserves all causes without nesting.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `appendRollbackError()` builds nested `AggregateError` instances as rollback steps fail, which can make failure reporting noisy and harder to inspect.  
**Suggestion:** Accumulate rollback failures in an array inside the catch block, then throw one `AggregateError([error, ...rollbackErrors], ...)` if any rollback failed. This keeps the rollback path simpler and preserves all causes without nesting.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Bound Late Repair Inputs and Delta Scans
**Finding key:** loop-ff659cd51bfc0fce8218
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `sourceFindingIds`, `resetStepIds`, and `delta.changedPaths.find(...)` can process unbounded arrays. This risks violating `bounded-resource-usage`, especially because `sourceFindingIds` is joined into a reason string and later iterated to append issue log entries.  
**Suggestion:** Add explicit caps, for example `IMPL_REPAIR_SOURCE_FINDING_LIMIT`, `IMPL_REPAIR_RESET_STEP_LIMIT`, and reuse or add a changed-path scan limit before iterating `delta.changedPaths`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `sourceFindingIds`, `resetStepIds`, and `delta.changedPaths.find(...)` can process unbounded arrays. This risks violating `bounded-resource-usage`, especially because `sourceFindingIds` is joined into a reason string and later iterated to append issue log entries.  
**Suggestion:** Add explicit caps, for example `IMPL_REPAIR_SOURCE_FINDING_LIMIT`, `IMPL_REPAIR_RESET_STEP_LIMIT`, and reuse or add a changed-path scan limit before iterating `delta.changedPaths`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Rename Workflow Artifact Prefix Constant
**Finding key:** loop-cf8813633197a77f4ff8
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `WORKFLOW_ARTIFACT_PATH_PREFIXES` is used specifically to reject non-durable repair evidence paths, not to classify workflow artifacts generally. The current name is broader than its behavior.  
**Suggestion:** Rename it to something like `NON_DURABLE_REPAIR_EVIDENCE_PATH_PREFIXES` or `REPAIR_EVIDENCE_EXCLUDED_PATH_PREFIXES`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `WORKFLOW_ARTIFACT_PATH_PREFIXES` is used specifically to reject non-durable repair evidence paths, not to classify workflow artifacts generally. The current name is broader than its behavior.  
**Suggestion:** Rename it to something like `NON_DURABLE_REPAIR_EVIDENCE_PATH_PREFIXES` or `REPAIR_EVIDENCE_EXCLUDED_PATH_PREFIXES`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Rename `ledgerPreviousHash` for Accuracy
**Finding key:** loop-6be79972751e9c0991de
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `ledgerPreviousHash` is not always the previous manifest hash; it is the base hash for the new repair entry, either from the latest ledger entry or the manifest.  
**Suggestion:** Rename it to `baseHash` or `repairBaseHash`, then update related comparisons for clearer intent.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `ledgerPreviousHash` is not always the previous manifest hash; it is the base hash for the new repair entry, either from the latest ledger entry or the manifest.  
**Suggestion:** Rename it to `baseHash` or `repairBaseHash`, then update related comparisons for clearer intent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 4. Extract Late Repair Transaction Construction
**Finding key:** loop-f8b1534430bb9e078ad6
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `completeLateAppliedFindingRepair` is doing validation, changed-path selection, invalidation planning, delta creation, entry creation, transaction creation, lifecycle mutation, and effect commit in one large block. This makes it harder to compare with other repair transaction paths and increases future duplication risk.  
**Suggestion:** Extract the id/reason/delta/entry/transaction construction into a helper such as `buildLateAppliedFindingRepairTransaction(...)`, leaving `completeLateAppliedFindingRepair` to orchestrate lifecycle update and commit.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `completeLateAppliedFindingRepair` is doing validation, changed-path selection, invalidation planning, delta creation, entry creation, transaction creation, lifecycle mutation, and effect commit in one large block. This makes it harder to compare with other repair transaction paths and increases future duplication risk.  
**Suggestion:** Extract the id/reason/delta/entry/transaction construction into a helper such as `buildLateAppliedFindingRepairTransaction(...)`, leaving `completeLateAppliedFindingRepair` to orchestrate lifecycle update and commit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Move freezing back to the shared base class
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

### 16. 2. Rename `readCurrent` to reflect validation behavior
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

### 17. 3. Guard semantic attempt decrement
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

### 18. 1. Consolidate Duplicate Repair Ledger Scanning
**Finding key:** loop-a8184ce3f61de333dbc3
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds` both read the impl-repair ledger and build the same `Set` of repaired `sourceFindingIds`. This duplicates the ledger traversal and makes future ledger-shape changes easier to miss.  
**Suggestion:** Extract a helper such as `repairedFindingIdsFromLedger(specDir)` and reuse it in both functions.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds` both read the impl-repair ledger and build the same `Set` of repaired `sourceFindingIds`. This duplicates the ledger traversal and makes future ledger-shape changes easier to miss.  
**Suggestion:** Extract a helper such as `repairedFindingIdsFromLedger(specDir)` and reuse it in both functions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Simplify Recovery Result Shape
**Finding key:** loop-4da3057b703b06a7a0a6
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R4  
**Issue:** `completeImplRepairStep` returns `{ completed, mutationOptions }`, but callers only use `completed`. `mutationOptions` is an internal implementation detail and currently dead return data.  
**Suggestion:** Return only the repair completion object, or rename the local caller variable to avoid `completed.completed`, for example:
```js
const repair = completeImplRepairStep(...);
return { id, status, repair: repair.entry, invalidations: repair.invalidations };
```
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R4  
**Issue:** `completeImplRepairStep` returns `{ completed, mutationOptions }`, but callers only use `completed`. `mutationOptions` is an internal implementation detail and currently dead return data.  
**Suggestion:** Return only the repair completion object, or rename the local caller variable to avoid `completed.completed`, for example:
```js
const repair = completeImplRepairStep(...);
return { id, status, repair: repair.entry, invalidations: repair.invalidations };
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Improve Naming Around “Missing” Findings
**Finding key:** loop-0a66640dc57c30e2fbcb
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds` return finding IDs that need late repair evidence, but the name `missing` is overloaded and ambiguous. In `missingGateObservedFindingIds`, IDs are included only when they are already present in the repair ledger, which makes “missing” especially confusing.  
**Suggestion:** Rename the helpers and locals toward the domain meaning, such as `lateAppliedFindingIds`, `gateObservedRepairEvidenceFindingIds`, or `recoverableFindingIds`, depending on the intended semantics.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds` return finding IDs that need late repair evidence, but the name `missing` is overloaded and ambiguous. In `missingGateObservedFindingIds`, IDs are included only when they are already present in the repair ledger, which makes “missing” especially confusing.  
**Suggestion:** Rename the helpers and locals toward the domain meaning, such as `lateAppliedFindingIds`, `gateObservedRepairEvidenceFindingIds`, or `recoverableFindingIds`, depending on the intended semantics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 4. Bound Issue Log Processing
**Finding key:** loop-65c7586235b1578ffc2c
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `missingGateObservedFindingIds` processes every `loadIssueLog(...).entries` item without an explicit upper bound. The `bounded-resource-usage` guardrail requires bulk data loading or processing to have explicit size/count bounds.  
**Suggestion:** Apply a defined maximum when scanning issue-log entries, or rely on and reference an existing bounded loader if one exists. For example, slice to a named constant before mapping, and fail if the log exceeds the bound.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `missingGateObservedFindingIds` processes every `loadIssueLog(...).entries` item without an explicit upper bound. The `bounded-resource-usage` guardrail requires bulk data loading or processing to have explicit size/count bounds.  
**Suggestion:** Apply a defined maximum when scanning issue-log entries, or rely on and reference an existing bounded loader if one exists. For example, slice to a named constant before mapping, and fail if the log exceeds the bound.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Add an explicit snapshot size bound
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

### 23. 2. Rename the local `snapshot` variable
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

### 24. 3. Simplify entry normalization in `ActiveFlowRegistrySnapshot`
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

### 25. 1. Align exact-target validation
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

### 26. 2. Remove duplicated explicit target resolver
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

### 27. 3. Rename captured mutation wrapper for clarity
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

### 28. 1. Extract Shared Review Convergence Record Setup
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

### 29. 2. Name the Test Around the Observable Behavior
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

### 30. 1. Rename helper to match returned shape
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

### 31. 2. Avoid custom camelCase keys for step status overrides
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

### 32. 1. Extract repeated repair fixture setup
**Finding key:** loop-72e586ebcd4a9d2514c7
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The two new tests duplicate most of the same setup: temp spec creation, initial target file, fingerprint creation, `impl-review.json`, triage artifact, test artifacts, and post-repair target mutation.  
**Suggestion:** Add a local helper such as `setupGateRepairEvidenceFixture(tmp, { runId })` that returns `{ specDir, previousFingerprint, state }`. This would make the test-specific behavior easier to see.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The two new tests duplicate most of the same setup: temp spec creation, initial target file, fingerprint creation, `impl-review.json`, triage artifact, test artifacts, and post-repair target mutation.  
**Suggestion:** Add a local helper such as `setupGateRepairEvidenceFixture(tmp, { runId })` that returns `{ specDir, previousFingerprint, state }`. This would make the test-specific behavior easier to see.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Extract repeated flow manager status application
**Finding key:** loop-5225e63c615dee85bcda
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** Both new tests inline similar `flowManager.updateStepStatuses` logic that applies transition changes to `state.steps` and then calls `intent.applyTo(state)`.  
**Suggestion:** Add a small helper like `makeRecordingFlowManager(state, transitions)` or `applyTransitionChanges(state, nextTransitions)` to remove duplication and keep the tests focused on recovery behavior.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** Both new tests inline similar `flowManager.updateStepStatuses` logic that applies transition changes to `state.steps` and then calls `intent.applyTo(state)`.  
**Suggestion:** Add a small helper like `makeRecordingFlowManager(state, transitions)` or `applyTransitionChanges(state, nextTransitions)` to remove duplication and keep the tests focused on recovery behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Use a more specific finding ID constant name
**Finding key:** loop-c350d8018f6dce5c9f4e
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `GATE_FINDING_ID` is accurate but broad; the tests specifically exercise missing repair evidence for a gate-observed finding.  
**Suggestion:** Rename it to something like `MISSING_REPAIR_EVIDENCE_FINDING_ID` so the assertions read closer to the scenario under test.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `GATE_FINDING_ID` is accurate but broad; the tests specifically exercise missing repair evidence for a gate-observed finding.  
**Suggestion:** Rename it to something like `MISSING_REPAIR_EVIDENCE_FINDING_ID` so the assertions read closer to the scenario under test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 4. Avoid nondeterministic timestamp generation in fixture data
**Finding key:** loop-0e06d4b590660fea4b45
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The second new test writes `timestamp: new Date().toISOString()` into the issue log. The exact value is not relevant to the behavior under test and introduces unnecessary nondeterminism.  
**Suggestion:** Use a fixed timestamp string, for example `"2026-01-01T00:00:00.000Z"`, to keep the fixture stable and easier to debug.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The second new test writes `timestamp: new Date().toISOString()` into the issue log. The exact value is not relevant to the behavior under test and introduces unnecessary nondeterminism.  
**Suggestion:** Use a fixed timestamp string, for example `"2026-01-01T00:00:00.000Z"`, to keep the fixture stable and easier to debug.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Align registry snapshot bounds across registry layers
**Finding key:** loop-315664f6bd656df029e1
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R4
**Issue:** **File:** `src/lib/active-flow-registry.js`
**Requirement:** R4
**Issue:** Both `ActiveFlowRegistrySnapshot` in `src/lib/active-flow-registry.js` and `AcceptanceDecisionRegistrySnapshot` in `src/flow/lib/acceptance-review-artifacts.js` introduce full registry-entry snapshotting without an explicit shared bound. If each file adds its own limit independently, the same registry could be accepted in one layer and rejected in another.
**Suggestion:** Define one shared registry snapshot entry limit, or have acceptance-review snapshotting reuse the active-flow registry snapshot validation path, so registry-size behavior is consistent across both files.
**Suggestion:** **File:** `src/lib/active-flow-registry.js`
**Requirement:** R4
**Issue:** Both `ActiveFlowRegistrySnapshot` in `src/lib/active-flow-registry.js` and `AcceptanceDecisionRegistrySnapshot` in `src/flow/lib/acceptance-review-artifacts.js` introduce full registry-entry snapshotting without an explicit shared bound. If each file adds its own limit independently, the same registry could be accepted in one layer and rejected in another.
**Suggestion:** Define one shared registry snapshot entry limit, or have acceptance-review snapshotting reuse the active-flow registry snapshot validation path, so registry-size behavior is consistent across both files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Consolidate registry entry normalization helpers
**Finding key:** loop-7fbf7f21886c5cee61f4
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R4
**Issue:** **File:** `src/lib/active-flow-registry.js`
**Requirement:** R4
**Issue:** `src/lib/active-flow-registry.js` and `src/flow/lib/acceptance-review-artifacts.js` both appear to normalize, sort, freeze, or compare registry entries for snapshot verification. This duplicates registry identity logic across files and increases the chance that preservation checks diverge.
**Suggestion:** Extract shared helpers for snapshot entry normalization and key comparison, for example `normalizeRegistrySnapshotEntries()` and `sameRegistryEntryKeys()`, and use them from both registry snapshot implementations.
**Suggestion:** **File:** `src/lib/active-flow-registry.js`
**Requirement:** R4
**Issue:** `src/lib/active-flow-registry.js` and `src/flow/lib/acceptance-review-artifacts.js` both appear to normalize, sort, freeze, or compare registry entries for snapshot verification. This duplicates registry identity logic across files and increases the chance that preservation checks diverge.
**Suggestion:** Extract shared helpers for snapshot entry normalization and key comparison, for example `normalizeRegistrySnapshotEntries()` and `sameRegistryEntryKeys()`, and use them from both registry snapshot implementations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 3. Use consistent exact-target validation semantics
**Finding key:** loop-3a524ce3315ec53344a9
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`
**Requirement:** R1
**Issue:** `flow-manager.js` has inconsistent exact-target validation between `captureExactTarget()` and `mutateExactTarget()`, while `review-convergence.js` also relies on current-record validation before mutation. The cross-file interface expectation is unclear: callers cannot easily tell which mutation paths require a fully resolved spec identity and which merely accept partial expectations.
**Suggestion:** Introduce a single exact-target validation contract in `flow-manager.js`, then ensure callers such as review recovery/convergence mutation paths use that same contract before mutating flow state.
**Suggestion:** **File:** `src/lib/flow-manager.js`
**Requirement:** R1
**Issue:** `flow-manager.js` has inconsistent exact-target validation between `captureExactTarget()` and `mutateExactTarget()`, while `review-convergence.js` also relies on current-record validation before mutation. The cross-file interface expectation is unclear: callers cannot easily tell which mutation paths require a fully resolved spec identity and which merely accept partial expectations.
**Suggestion:** Introduce a single exact-target validation contract in `flow-manager.js`, then ensure callers such as review recovery/convergence mutation paths use that same contract before mutating flow state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 4. Standardize late repair evidence naming
**Finding key:** loop-5aea4ad1df279aca4e15
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`
**Requirement:** R2
**Issue:** Late repair evidence concepts are named differently across files: `missingCurrentAppliedFindingIds` / `missingGateObservedFindingIds` in `set-step.js`, `sourceFindingIds` in `impl-repair-artifacts.js`, and `GATE_FINDING_ID` in `set-step-impl-repair.test.js`. These names describe overlapping concepts but from different angles, making the repair-evidence flow harder to trace across implementation and tests.
**Suggestion:** Pick a consistent domain term such as `lateRepairEvidenceFindingIds` or `repairEvidenceSourceFindingIds`, then apply it across `set-step.js`, `impl-repair-artifacts.js`, and the related tests.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Requirement:** R2
**Issue:** Late repair evidence concepts are named differently across files: `missingCurrentAppliedFindingIds` / `missingGateObservedFindingIds` in `set-step.js`, `sourceFindingIds` in `impl-repair-artifacts.js`, and `GATE_FINDING_ID` in `set-step-impl-repair.test.js`. These names describe overlapping concepts but from different angles, making the repair-evidence flow harder to trace across implementation and tests.
**Suggestion:** Pick a consistent domain term such as `lateRepairEvidenceFindingIds` or `repairEvidenceSourceFindingIds`, then apply it across `set-step.js`, `impl-repair-artifacts.js`, and the related tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 5. Share repaired finding ledger scanning
**Finding key:** loop-02cfc0cd4f4904c30db9
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/set-step.js`
**Requirement:** R1
**Issue:** `set-step.js` duplicates repair-ledger scanning internally, and `impl-repair-artifacts.js` also works with `sourceFindingIds` from repair ledger entries. This suggests ledger-shape knowledge is spreading across files.
**Suggestion:** Extract a shared helper such as `repairedFindingIdsFromLedger(specDir)` near the repair artifact/ledger code and reuse it from `set-step.js` and any repair artifact logic that needs the same source-finding interpretation.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Requirement:** R1
**Issue:** `set-step.js` duplicates repair-ledger scanning internally, and `impl-repair-artifacts.js` also works with `sourceFindingIds` from repair ledger entries. This suggests ledger-shape knowledge is spreading across files.
**Suggestion:** Extract a shared helper such as `repairedFindingIdsFromLedger(specDir)` near the repair artifact/ledger code and reuse it from `set-step.js` and any repair artifact logic that needs the same source-finding interpretation.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
