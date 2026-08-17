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

### 6. 1. Bound historical evidence scanning
**Finding key:** loop-80a76722ad02ddc05cca
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** `historicalReviewHandoffs()` iterates every `reviewConvergence.records` entry and every `record.evidenceHistory` entry without an explicit upper bound. This violates the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Add explicit caps, for example `MAX_REVIEW_CONVERGENCE_RECORDS` and `MAX_EVIDENCE_HISTORY_ENTRIES`, and fail with a clear mechanical-blocker error when exceeded.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** `historicalReviewHandoffs()` iterates every `reviewConvergence.records` entry and every `record.evidenceHistory` entry without an explicit upper bound. This violates the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Add explicit caps, for example `MAX_REVIEW_CONVERGENCE_RECORDS` and `MAX_EVIDENCE_HISTORY_ENTRIES`, and fail with a clear mechanical-blocker error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Remove misleading prohibited operations field
**Finding key:** loop-a3c1fc3ee52a2849e6ec
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `AcceptanceDecisionRegistrySnapshot.verify()` returns `prohibitedOperations: []`, but the code does not actually observe or track remove/park/document-replacement operations. The empty array implies stronger verification than this method performs.  
**Suggestion:** Either remove the field from the return payload or replace it with a concrete verification mechanism/boolean that accurately reflects what was checked, such as registry identity and revision preservation.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `AcceptanceDecisionRegistrySnapshot.verify()` returns `prohibitedOperations: []`, but the code does not actually observe or track remove/park/document-replacement operations. The empty array implies stronger verification than this method performs.  
**Suggestion:** Either remove the field from the return payload or replace it with a concrete verification mechanism/boolean that accurately reflects what was checked, such as registry identity and revision preservation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Rename rollback error combiner
**Finding key:** loop-f06a865c10d943e394bc
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `appendRollbackError(rollbackError, cause)` does not append to a collection; it combines rollback failures into an `AggregateError`. The name makes the error-flow harder to read.  
**Suggestion:** Rename it to something like `combineRollbackError()` or `mergeRollbackError()` and rename the second parameter from `cause` to `nextError` for clarity.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `appendRollbackError(rollbackError, cause)` does not append to a collection; it combines rollback failures into an `AggregateError`. The name makes the error-flow harder to read.  
**Suggestion:** Rename it to something like `combineRollbackError()` or `mergeRollbackError()` and rename the second parameter from `cause` to `nextError` for clarity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Simplify duplicated target mutation selection
**Finding key:** loop-d0c4cacaaa774f5775df
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R1  
**Issue:** `applyAcceptanceDecision()` creates two nearly parallel closures, `mutateDecision` and `rollbackDecision`, both branching on `registrySnapshot == null`. This makes the managed-worktree mutation path harder to audit.  
**Suggestion:** Extract a small helper such as `createAcceptanceDecisionMutators(flowManager, registrySnapshot)` that returns `{ mutateDecision, rollbackDecision }`. That keeps the exact-target behavior centralized and easier to verify against R1/R4.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R1  
**Issue:** `applyAcceptanceDecision()` creates two nearly parallel closures, `mutateDecision` and `rollbackDecision`, both branching on `registrySnapshot == null`. This makes the managed-worktree mutation path harder to audit.  
**Suggestion:** Extract a small helper such as `createAcceptanceDecisionMutators(flowManager, registrySnapshot)` that returns `{ mutateDecision, rollbackDecision }`. That keeps the exact-target behavior centralized and easier to verify against R1/R4.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 5. Avoid unnecessary issue-log snapshot work before availability checks
**Finding key:** loop-97d595ba0d4ed594494c
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `AcceptanceDecisionIssueLogSnapshot.capture(specDir)` runs before checking `artifact.verdict !== "user_decision_required"`. If the decision is unavailable, the function has already performed extra filesystem work that will never be used.  
**Suggestion:** Move issue-log snapshot capture until after all precondition checks that can fail before mutation, especially the verdict check and fingerprint derivation.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `AcceptanceDecisionIssueLogSnapshot.capture(specDir)` runs before checking `artifact.verdict !== "user_decision_required"`. If the decision is unavailable, the function has already performed extra filesystem work that will never be used.  
**Suggestion:** Move issue-log snapshot capture until after all precondition checks that can fail before mutation, especially the verdict check and fingerprint derivation.
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

### 28. 1. Extract ReviewEvidence fixture creation
**Finding key:** loop-4ff90df2bee1b4ba5188
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R4  
**Issue:** The new test repeats verbose `ReviewEvidence` construction twice with mostly identical structure, which makes the test harder to scan and duplicates provider/provenance setup.  
**Suggestion:** Add a small local helper such as `makeImplReviewEvidence({ treeSha, invocationId, capturedAt, disposition })` near the existing fixture helpers, then use it for both `rejectedEvidence` and `advisoryEvidence`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R4  
**Issue:** The new test repeats verbose `ReviewEvidence` construction twice with mostly identical structure, which makes the test harder to scan and duplicates provider/provenance setup.  
**Suggestion:** Add a small local helper such as `makeImplReviewEvidence({ treeSha, invocationId, capturedAt, disposition })` near the existing fixture helpers, then use it for both `rejectedEvidence` and `advisoryEvidence`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Align the test request text with the asserted behavior
**Finding key:** loop-26389b66073abe7efd66
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R2  
**Issue:** The `state.request` says “Verify deferred findings survive a later implementation review,” but the test title and assertions are specifically about resolving deferred findings from superseded canonical review evidence. The wording is slightly broader than the behavior under test.  
**Suggestion:** Rename the request string to something closer to the assertion, for example: `"Verify deferred findings resolve from superseded canonical review evidence."`
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R2  
**Issue:** The `state.request` says “Verify deferred findings survive a later implementation review,” but the test title and assertions are specifically about resolving deferred findings from superseded canonical review evidence. The wording is slightly broader than the behavior under test.  
**Suggestion:** Rename the request string to something closer to the assertion, for example: `"Verify deferred findings resolve from superseded canonical review evidence."`
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Avoid hard-coded retry exhaustion values repeated inline
**Finding key:** loop-bb9ef1537f53b68721cc
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The value `4` appears in both `configuredSemanticMaxAttempts`, `attempts`, and `round`. If the fixture changes, these can drift and weaken the test’s intent.  
**Suggestion:** Introduce `const maxAttempts = 4;` and use it for `configuredSemanticMaxAttempts`, `attempts`, and `round`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The value `4` appears in both `configuredSemanticMaxAttempts`, `attempts`, and `round`. If the fixture changes, these can drift and weaken the test’s intent.  
**Suggestion:** Introduce `const maxAttempts = 4;` and use it for `configuredSemanticMaxAttempts`, `attempts`, and `round`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Extract Shared Review Convergence Record Setup
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

### 32. 2. Name the Test Around the Observable Behavior
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

### 33. 1. Rename helper to match returned shape
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

### 34. 2. Avoid custom camelCase keys for step status overrides
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

### 35. 1. Extract repeated repair fixture setup
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

### 36. 2. Extract repeated flow manager status application
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

### 37. 3. Use a more specific finding ID constant name
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

### 38. 4. Avoid nondeterministic timestamp generation in fixture data
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

### 39. 1. Align exact-target mutation expectations
**Finding key:** loop-8a80399b780003b058e5
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`
**Requirement:** R1
**Issue:** `captureExactTarget()` requires a spec identity, while `mutateExactTarget()` can accept weaker expectations. Cross-file callers such as `src/flow/lib/acceptance-review-artifacts.js` depend on exact-target mutation semantics for rollback and registry preservation, so this inconsistent interface makes the mutation path harder to reason about.
**Suggestion:** Add one shared validation helper for exact flow targets and use it in `captureExactTarget()`, `mutateExactTarget()`, and captured target construction.
**Suggestion:** **File:** `src/lib/flow-manager.js`
**Requirement:** R1
**Issue:** `captureExactTarget()` requires a spec identity, while `mutateExactTarget()` can accept weaker expectations. Cross-file callers such as `src/flow/lib/acceptance-review-artifacts.js` depend on exact-target mutation semantics for rollback and registry preservation, so this inconsistent interface makes the mutation path harder to reason about.
**Suggestion:** Add one shared validation helper for exact flow targets and use it in `captureExactTarget()`, `mutateExactTarget()`, and captured target construction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 2. Consolidate repair finding terminology
**Finding key:** loop-83737024b5ac26ab4b71
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`
**Requirement:** R2
**Issue:** Repair-related finding IDs are named inconsistently across files: `missingCurrentAppliedFindingIds`, `missingGateObservedFindingIds`, `sourceFindingIds`, `GATE_FINDING_ID`, and proposed names like `MISSING_REPAIR_EVIDENCE_FINDING_ID` all describe overlapping late/gate repair concepts. This increases drift between production code and tests.
**Suggestion:** Pick one domain vocabulary, such as `lateRepairFindingIds` / `gateObservedRepairFindingIds`, and apply it consistently in `set-step.js`, `impl-repair-artifacts.js`, and related tests.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Requirement:** R2
**Issue:** Repair-related finding IDs are named inconsistently across files: `missingCurrentAppliedFindingIds`, `missingGateObservedFindingIds`, `sourceFindingIds`, `GATE_FINDING_ID`, and proposed names like `MISSING_REPAIR_EVIDENCE_FINDING_ID` all describe overlapping late/gate repair concepts. This increases drift between production code and tests.
**Suggestion:** Pick one domain vocabulary, such as `lateRepairFindingIds` / `gateObservedRepairFindingIds`, and apply it consistently in `set-step.js`, `impl-repair-artifacts.js`, and related tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 3. Centralize repaired finding ledger scanning
**Finding key:** loop-687b1df7e925c75b1a7b
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/set-step.js`
**Requirement:** R1
**Issue:** Ledger-derived repaired finding ID logic appears in multiple places conceptually: `set-step.js` scans the impl-repair ledger, while `impl-repair-artifacts.js` creates and appends `sourceFindingIds`. Keeping read/write assumptions separate makes future ledger-shape changes easy to miss.
**Suggestion:** Add a shared helper near the impl-repair ledger utilities, for example `repairedFindingIdsFromLedger(specDir)`, and use it from step recovery code and tests.
**Suggestion:** **File:** `src/flow/lib/set-step.js`
**Requirement:** R1
**Issue:** Ledger-derived repaired finding ID logic appears in multiple places conceptually: `set-step.js` scans the impl-repair ledger, while `impl-repair-artifacts.js` creates and appends `sourceFindingIds`. Keeping read/write assumptions separate makes future ledger-shape changes easy to miss.
**Suggestion:** Add a shared helper near the impl-repair ledger utilities, for example `repairedFindingIdsFromLedger(specDir)`, and use it from step recovery code and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 4. Share review evidence fixture builders
**Finding key:** loop-06ab4a2bb7f0675f1421
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`
**Requirement:** R4
**Issue:** Multiple test files introduce verbose review convergence/evidence fixtures independently, especially `retry-exhaustion-defer.test.js` and `retry-recovery-convergence.test.js`. These fixtures encode the same artifact shape in different places.
**Suggestion:** Add local shared fixture helpers under the flow test support area, such as `makeImplReviewEvidence()` and `makeReviewConvergenceRecord()`, then reuse them across the retry/convergence tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`
**Requirement:** R4
**Issue:** Multiple test files introduce verbose review convergence/evidence fixtures independently, especially `retry-exhaustion-defer.test.js` and `retry-recovery-convergence.test.js`. These fixtures encode the same artifact shape in different places.
**Suggestion:** Add local shared fixture helpers under the flow test support area, such as `makeImplReviewEvidence()` and `makeReviewConvergenceRecord()`, then reuse them across the retry/convergence tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 5. Use step IDs consistently in test data
**Finding key:** loop-d1d6d462531ee0f1cefa
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`
**Requirement:** R5
**Issue:** Tests mix actual step IDs like `"impl-repair"` with custom camelCase aliases like `implRepair` and `implGate`. Other files and production code use step IDs directly, so the aliases create avoidable naming drift.
**Suggestion:** Use canonical step IDs as object keys in test fixtures and overrides, e.g. `{ "impl-repair": "done", "impl-gate": "done" }`.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`
**Requirement:** R5
**Issue:** Tests mix actual step IDs like `"impl-repair"` with custom camelCase aliases like `implRepair` and `implGate`. Other files and production code use step IDs directly, so the aliases create avoidable naming drift.
**Suggestion:** Use canonical step IDs as object keys in test fixtures and overrides, e.g. `{ "impl-repair": "done", "impl-gate": "done" }`.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
