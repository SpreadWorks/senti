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

### 5. 1. Remove redundant `flowScoped` check
**Finding key:** loop-3a75b5268d4b8430c018
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R4
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** In `resolveImplReviewLifecycle`, the `else if (flowScoped && verdict === "REJECTED")` condition is reached only after the `!flowScoped` branch has already returned. The extra `flowScoped` check is therefore redundant.  
**Suggestion:** Simplify the condition to `else if (verdict === "REJECTED")` to make the control flow clearer.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R4  
**Issue:** In `resolveImplReviewLifecycle`, the `else if (flowScoped && verdict === "REJECTED")` condition is reached only after the `!flowScoped` branch has already returned. The extra `flowScoped` check is therefore redundant.  
**Suggestion:** Simplify the condition to `else if (verdict === "REJECTED")` to make the control flow clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Extract Registry Entry Key Comparison
**Finding key:** loop-0e2f429bf81ee3d1d345
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** Registry entry normalization and key comparison are duplicated between `AcceptanceDecisionRegistrySnapshot` constructor and `verify()`: both map raw entries into `AcceptanceDecisionRegistryEntry`, derive sorted keys, and compare key arrays manually.  
**Suggestion:** Add small helpers such as `toRegistryEntries(entries)`, `registryEntryKeys(entries)`, and `sameRegistryEntryKeys(a, b)`. This would make the preservation check easier to audit and reduce the chance that future edits update capture and verify paths inconsistently.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** Registry entry normalization and key comparison are duplicated between `AcceptanceDecisionRegistrySnapshot` constructor and `verify()`: both map raw entries into `AcceptanceDecisionRegistryEntry`, derive sorted keys, and compare key arrays manually.  
**Suggestion:** Add small helpers such as `toRegistryEntries(entries)`, `registryEntryKeys(entries)`, and `sameRegistryEntryKeys(a, b)`. This would make the preservation check easier to audit and reduce the chance that future edits update capture and verify paths inconsistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Give Rollback Helpers Intent-Revealing Names
**Finding key:** loop-39d760c99ce0c88818a2
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `mutateDecision` and `rollbackDecision` are close in shape but differ in an important way: one performs the forward mutation, the other restores through the captured target. The current names are understandable but do not make the exact-target vs captured-target behavior obvious.  
**Suggestion:** Rename them to something like `mutateDecisionTarget` and `restoreCapturedDecisionTarget`, or extract them into methods on `AcceptanceDecisionRegistrySnapshot`. This makes the failure-boundary behavior easier to reason about.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `mutateDecision` and `rollbackDecision` are close in shape but differ in an important way: one performs the forward mutation, the other restores through the captured target. The current names are understandable but do not make the exact-target vs captured-target behavior obvious.  
**Suggestion:** Rename them to something like `mutateDecisionTarget` and `restoreCapturedDecisionTarget`, or extract them into methods on `AcceptanceDecisionRegistrySnapshot`. This makes the failure-boundary behavior easier to reason about.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Simplify Repeated Rollback Error Aggregation
**Finding key:** loop-3b7e43fa4b8facc35b23
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** The catch block repeats the same `rollbackError = rollbackError == null ? cause : new AggregateError(...)` pattern for artifact restoration and issue-log restoration. This is small duplication, but it sits in sensitive failure-handling code.  
**Suggestion:** Extract a local helper such as `combineRollbackError(existing, cause)` or `recordRollbackFailure(cause)`. That would make the rollback sequence clearer and reduce boilerplate in the error path.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** The catch block repeats the same `rollbackError = rollbackError == null ? cause : new AggregateError(...)` pattern for artifact restoration and issue-log restoration. This is small duplication, but it sits in sensitive failure-handling code.  
**Suggestion:** Extract a local helper such as `combineRollbackError(existing, cause)` or `recordRollbackFailure(cause)`. That would make the rollback sequence clearer and reduce boilerplate in the error path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Rename `AcceptanceDecisionTargetIdentity.specId`
**Finding key:** loop-7889b084db700af8806f
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R1  
**Issue:** `AcceptanceDecisionTargetIdentity` stores both `spec` and `specId`, where `specId` is assigned from `this.expectation.spec`. The distinction is not self-evident and may imply two different identities even though both appear to represent the selected spec.  
**Suggestion:** Use one consistently named property, or rename `specId` to something more explicit like `expectedSpec` if it intentionally refers to the normalized guard expectation. This would make identity-retention checks easier to follow.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R1  
**Issue:** `AcceptanceDecisionTargetIdentity` stores both `spec` and `specId`, where `specId` is assigned from `this.expectation.spec`. The distinction is not self-evident and may imply two different identities even though both appear to represent the selected spec.  
**Suggestion:** Use one consistently named property, or rename `specId` to something more explicit like `expectedSpec` if it intentionally refers to the normalized guard expectation. This would make identity-retention checks easier to follow.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 5. Avoid Recomputing Requirement IDs During Rollback
**Finding key:** loop-e6f12f5afb6381989a4b
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** The rollback path calls `requirementList(specDir).map((entry) => entry.id)` after a failure. That introduces fresh file reads during recovery, even though rollback should minimize additional moving parts.  
**Suggestion:** Capture `requirementIds` once before writing the decided artifact and reuse that same value in both the forward write and rollback write. This simplifies rollback and reduces the chance of rollback failing for reasons unrelated to the original acceptance-decision failure.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** The rollback path calls `requirementList(specDir).map((entry) => entry.id)` after a failure. That introduces fresh file reads during recovery, even though rollback should minimize additional moving parts.  
**Suggestion:** Capture `requirementIds` once before writing the decided artifact and reuse that same value in both the forward write and rollback write. This simplifies rollback and reduces the chance of rollback failing for reasons unrelated to the original acceptance-decision failure.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Bound changed-path expansion
**Finding key:** loop-adf035360a98c4fb3039
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `current.entries.map((entry) => entry.path)` can materialize every fingerprint entry when `ledgerPreviousHash !== previous.hash`, with no explicit upper bound. This violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Introduce an explicit maximum changed-path count or artifact-size limit before building `changedPaths`, and fail with a clear error if exceeded. If full fidelity is required, write the paths incrementally or chunk them with bounded memory.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `current.entries.map((entry) => entry.path)` can materialize every fingerprint entry when `ledgerPreviousHash !== previous.hash`, with no explicit upper bound. This violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Introduce an explicit maximum changed-path count or artifact-size limit before building `changedPaths`, and fail with a clear error if exceeded. If full fidelity is required, write the paths incrementally or chunk them with bounded memory.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Bound finding-id formatting
**Finding key:** loop-9979a33c75060cc6a844
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `appliedFindingIds.join(", ")` formats an unbounded caller-provided array into `reason`, which can produce oversized ledger entries and status metadata.  
**Suggestion:** Reuse or add a bounded preview helper for finding IDs, similar to `changedPathsPreview`, and include the total count when truncating.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `appliedFindingIds.join(", ")` formats an unbounded caller-provided array into `reason`, which can produce oversized ledger entries and status metadata.  
**Suggestion:** Reuse or add a bounded preview helper for finding IDs, similar to `changedPathsPreview`, and include the total count when truncating.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Extract repair transaction construction
**Finding key:** loop-1f4b359bc963fc87c2ea
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `completeLateAppliedFindingRepair` performs fingerprint reading, ledger hash selection, delta creation, entry creation, transaction creation, invalidation planning, and status transition in one large function. This makes it harder to compare with other repair completion paths and increases duplication risk.  
**Suggestion:** Extract focused helpers such as `resolveRepairFingerprintDelta(...)`, `buildImplRepairEntry(...)`, and `applyImplRepairInvalidationTransition(...)`, keeping this exported function as orchestration only.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R2  
**Issue:** `completeLateAppliedFindingRepair` performs fingerprint reading, ledger hash selection, delta creation, entry creation, transaction creation, invalidation planning, and status transition in one large function. This makes it harder to compare with other repair completion paths and increases duplication risk.  
**Suggestion:** Extract focused helpers such as `resolveRepairFingerprintDelta(...)`, `buildImplRepairEntry(...)`, and `applyImplRepairInvalidationTransition(...)`, keeping this exported function as orchestration only.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Move freezing into the shared base constructor
**Finding key:** loop-0129c4ca5cf2f3673414
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** `ReviewToolingRecoveryMutation` and `ReviewSemanticRecoveryMutation` both define identical constructors that only call `super(input)` and `Object.freeze(this)`.  
**Suggestion:** Move `Object.freeze(this)` back into `ReviewRecoveryMutation` after shared field initialization, then remove both subclass constructors.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R1  
**Issue:** `ReviewToolingRecoveryMutation` and `ReviewSemanticRecoveryMutation` both define identical constructors that only call `super(input)` and `Object.freeze(this)`.  
**Suggestion:** Move `Object.freeze(this)` back into `ReviewRecoveryMutation` after shared field initialization, then remove both subclass constructors.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Guard semantic attempt decrement against invalid negative state
**Finding key:** loop-be053c00bc1c0767d144
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R5  
**Issue:** `ReviewSemanticRecoveryMutation.apply()` sets `semanticAttempts: current.semanticMaxAttempts - 1`. If `semanticMaxAttempts` is `0`, this creates `semanticAttempts: -1`.  
**Suggestion:** Add an explicit precondition such as `current.semanticMaxAttempts > 0`, or compute with a bounded value if zero is valid: `Math.max(0, current.semanticMaxAttempts - 1)`. Since recovery requires exhausted attempts, an explicit error is likely clearer.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R5  
**Issue:** `ReviewSemanticRecoveryMutation.apply()` sets `semanticAttempts: current.semanticMaxAttempts - 1`. If `semanticMaxAttempts` is `0`, this creates `semanticAttempts: -1`.  
**Suggestion:** Add an explicit precondition such as `current.semanticMaxAttempts > 0`, or compute with a bounded value if zero is valid: `Math.max(0, current.semanticMaxAttempts - 1)`. Since recovery requires exhausted attempts, an explicit error is likely clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Return Only Used Data From `completeImplRepairStep`
**Finding key:** loop-51276bb3427f7aee0e86
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `completeImplRepairStep` returns `{ completed, mutationOptions }`, but callers only use `completed`. `mutationOptions` is an implementation detail and is currently dead returned data.  
**Suggestion:** Return `completed` directly, then simplify the call site from `completed.completed.entry` to `completed.entry` and `completed.completed.invalidations` to `completed.invalidations`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `completeImplRepairStep` returns `{ completed, mutationOptions }`, but callers only use `completed`. `mutationOptions` is an implementation detail and is currently dead returned data.  
**Suggestion:** Return `completed` directly, then simplify the call site from `completed.completed.entry` to `completed.entry` and `completed.completed.invalidations` to `completed.invalidations`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Rename `completed` Wrapper At Call Site
**Finding key:** loop-c2d962715d4d6474411a
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** The refactor introduced a nested naming pattern where `const completed = completeImplRepairStep(...)` later reads as `completed.completed.entry`. This is confusing because both names describe the same lifecycle concept at different wrapper levels.  
**Suggestion:** Either make `completeImplRepairStep` return the repair completion object directly, or rename the outer variable to `repairResult` if the wrapper shape is retained.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** The refactor introduced a nested naming pattern where `const completed = completeImplRepairStep(...)` later reads as `completed.completed.entry`. This is confusing because both names describe the same lifecycle concept at different wrapper levels.  
**Suggestion:** Either make `completeImplRepairStep` return the repair completion object directly, or rename the outer variable to `repairResult` if the wrapper shape is retained.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Extract Repeated JSON Artifact Loading
**Finding key:** loop-88be9842e767d148b5d1
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `missingAppliedFindingIds` repeats `JSON.parse(fs.readFileSync(path.join(specDir, ...), "utf8"))` for each artifact. This adds noise and makes validation logic harder to scan.  
**Suggestion:** Add a small local helper such as `readSpecJson(specDir, artifactName)` inside this file and use it for `impl-triage.json`, `impl-review.json`, `test-execute-result.json`, and `test-result-review.json`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `missingAppliedFindingIds` repeats `JSON.parse(fs.readFileSync(path.join(specDir, ...), "utf8"))` for each artifact. This adds noise and makes validation logic harder to scan.  
**Suggestion:** Add a small local helper such as `readSpecJson(specDir, artifactName)` inside this file and use it for `impl-triage.json`, `impl-review.json`, `test-execute-result.json`, and `test-result-review.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Make Recovery Validation Bounds Explicit
**Finding key:** loop-cb8af968a2e5f15df586
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `missingAppliedFindingIds` processes all findings from `impl-review.json`, all `triage.items`, and all repair ledger entries without an explicit local bound. The guardrail requires bulk data loading or processing to have clear upper bounds.  
**Suggestion:** Introduce explicit maximum counts before mapping/filtering, for example bounds for review findings, triage items, and ledger entries, and fail with a clear recovery-unavailable error when exceeded. This keeps recovery validation compliant with `bounded-resource-usage`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R5  
**Issue:** `missingAppliedFindingIds` processes all findings from `impl-review.json`, all `triage.items`, and all repair ledger entries without an explicit local bound. The guardrail requires bulk data loading or processing to have clear upper bounds.  
**Suggestion:** Introduce explicit maximum counts before mapping/filtering, for example bounds for review findings, triage items, and ledger entries, and fail with a clear recovery-unavailable error when exceeded. This keeps recovery validation compliant with `bounded-resource-usage`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Add an explicit bound when materializing registry snapshots
**Finding key:** loop-32a5e5d4c73168f438c0
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R4
**Issue:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** `ActiveFlowRegistrySnapshot` eagerly maps every registry entry in `entries` without any explicit size bound. This violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Add an explicit maximum snapshot entry count before mapping, ideally using the same registry size limit used elsewhere if one exists in this file. Fail with an explicit error when exceeded so registry identity/revision checks cannot accidentally perform unbounded work.
**Suggestion:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** `ActiveFlowRegistrySnapshot` eagerly maps every registry entry in `entries` without any explicit size bound. This violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Add an explicit maximum snapshot entry count before mapping, ideally using the same registry size limit used elsewhere if one exists in this file. Fail with an explicit error when exceeded so registry identity/revision checks cannot accidentally perform unbounded work.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Extract entry normalization for snapshot construction
**Finding key:** loop-9da1ce6a0ab0aae13457
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R2  
**Issue:** The constructor embeds a fairly dense normalization expression inside `entries.map(...)`, mixing type detection, stored-entry parsing, JSON conversion, and freezing in one place. This makes the snapshot invariant harder to audit.  
**Suggestion:** Extract a small helper such as `snapshotEntryJSON(entry)` or a private static method on `ActiveFlowRegistrySnapshot` that returns the normalized plain JSON entry, then freeze it in the constructor. This would make it clearer that snapshots preserve registered entries and modes without mutating the registry.
**Suggestion:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R2  
**Issue:** The constructor embeds a fairly dense normalization expression inside `entries.map(...)`, mixing type detection, stored-entry parsing, JSON conversion, and freezing in one place. This makes the snapshot invariant harder to audit.  
**Suggestion:** Extract a small helper such as `snapshotEntryJSON(entry)` or a private static method on `ActiveFlowRegistrySnapshot` that returns the normalized plain JSON entry, then freeze it in the constructor. This would make it clearer that snapshots preserve registered entries and modes without mutating the registry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Avoid ambiguous local naming in `snapshot()`
**Finding key:** loop-b3f4c97fe89b612d3743
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R4
**Issue:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** `snapshot()` assigns `const snapshot = readActiveFlowAuthority(...)`, but that value is the active-flow authority read result, not the exported `ActiveFlowRegistrySnapshot`. The name is easy to confuse with the returned snapshot object.  
**Suggestion:** Rename the local variable to `authority`, `authorityRead`, or `registryState`:

```js
const authority = readActiveFlowAuthority(activeFlowPath(this._mainRoot));
return new ActiveFlowRegistrySnapshot({
  entries: authority.document.entries,
  revision: authority.revision,
});
```
**Suggestion:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R4  
**Issue:** `snapshot()` assigns `const snapshot = readActiveFlowAuthority(...)`, but that value is the active-flow authority read result, not the exported `ActiveFlowRegistrySnapshot`. The name is easy to confuse with the returned snapshot object.  
**Suggestion:** Rename the local variable to `authority`, `authorityRead`, or `registryState`:

```js
const authority = readActiveFlowAuthority(activeFlowPath(this._mainRoot));
return new ActiveFlowRegistrySnapshot({
  entries: authority.document.entries,
  revision: authority.revision,
});
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Require spec identity for exact mutations
**Finding key:** loop-94545deab5537e706f8b
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `mutateExactTarget()` accepts any non-empty `FlowTargetExpectation`, but `#mutateCapturedTarget()` writes with `{ ...opts, specId: expectation.spec }`. If `expectation.spec` is absent, the mutation is no longer guaranteed to target the selected binding’s `flow.json`.  
**Suggestion:** Match `captureExactTarget()` and require `expectation.spec != null` in `mutateExactTarget()`, or factor both checks into a shared `assertExactTargetWithSpec(expectation, context)` helper.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `mutateExactTarget()` accepts any non-empty `FlowTargetExpectation`, but `#mutateCapturedTarget()` writes with `{ ...opts, specId: expectation.spec }`. If `expectation.spec` is absent, the mutation is no longer guaranteed to target the selected binding’s `flow.json`.  
**Suggestion:** Match `captureExactTarget()` and require `expectation.spec != null` in `mutateExactTarget()`, or factor both checks into a shared `assertExactTargetWithSpec(expectation, context)` helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Remove duplicated target validation
**Finding key:** loop-9f14d44519eb90363d60
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** The same `FlowTargetExpectation` / non-empty / spec-present validation is duplicated in `CapturedFlowTargetMutation` and `captureExactTarget()`, and partially duplicated in `mutateExactTarget()`.  
**Suggestion:** Add a small private helper such as `assertExactFlowTargetWithSpec(expectation, message)` and use it from all three places. This also prevents the spec requirement from drifting between capture and direct mutation paths.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** The same `FlowTargetExpectation` / non-empty / spec-present validation is duplicated in `CapturedFlowTargetMutation` and `captureExactTarget()`, and partially duplicated in `mutateExactTarget()`.  
**Suggestion:** Add a small private helper such as `assertExactFlowTargetWithSpec(expectation, message)` and use it from all three places. This also prevents the spec requirement from drifting between capture and direct mutation paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Clarify captured mutation naming
**Finding key:** loop-b1da76007672046f290c
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R3
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` is named like a mutation object, but it actually represents a captured target-bound mutator/facade. The current name makes call sites harder to reason about because the mutation has not happened yet.  
**Suggestion:** Rename it to something intent-focused, such as `CapturedFlowTarget` or `CapturedFlowTargetMutator`, keeping the `mutate()` method as the operation.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` is named like a mutation object, but it actually represents a captured target-bound mutator/facade. The current name makes call sites harder to reason about because the mutation has not happened yet.  
**Suggestion:** Rename it to something intent-focused, such as `CapturedFlowTarget` or `CapturedFlowTargetMutator`, keeping the `mutate()` method as the operation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Collapse identical explicit target resolvers
**Finding key:** loop-d5933ae0f512728b4c7e
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R3
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `resolveExplicitFlowTarget()` and `resolveExplicitFlowTargetForRead()` currently have identical implementations. This creates duplicate logic with no behavioral distinction.  
**Suggestion:** Implement one in terms of the other, or extract the shared body into `#resolveExplicitFlowTarget(expectation)`. If the read-specific name exists only for API clarity, keep it as a delegating alias.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `resolveExplicitFlowTarget()` and `resolveExplicitFlowTargetForRead()` currently have identical implementations. This creates duplicate logic with no behavioral distinction.  
**Suggestion:** Implement one in terms of the other, or extract the shared body into `#resolveExplicitFlowTarget(expectation)`. If the read-specific name exists only for API clarity, keep it as a delegating alias.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Extract Review Convergence Record Fixture
**Finding key:** loop-793bc65573bac8a4b186
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The new test inlines a large `reviewConvergence.records[0]` object. This creates duplication risk with nearby tests that likely need the same baseline record shape, and makes future schema changes harder to apply consistently.  
**Suggestion:** Add a small local helper such as `makeReviewConvergenceRecord(overrides = {})` in this test file, then override only `treeSha`, attempt counts, evidence, and digest fields needed by each scenario.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The new test inlines a large `reviewConvergence.records[0]` object. This creates duplication risk with nearby tests that likely need the same baseline record shape, and makes future schema changes harder to apply consistently.  
**Suggestion:** Add a small local helper such as `makeReviewConvergenceRecord(overrides = {})` in this test file, then override only `treeSha`, attempt counts, evidence, and digest fields needed by each scenario.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Name Test Around Observable Behavior
**Finding key:** loop-40a217466853d0a6687f
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R2  
**Issue:** The test title says “commits a changed-tree review grant and semantic reset”, but the assertions primarily verify that a semantic recovery mutation clears semantic state and updates `treeSha`. “grant” is not visible in the test body and makes the behavior harder to understand.  
**Suggestion:** Rename the test to something closer to the checked behavior, for example: `resets semantic review convergence state when review evidence tree changes`.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R2  
**Issue:** The test title says “commits a changed-tree review grant and semantic reset”, but the assertions primarily verify that a semantic recovery mutation clears semantic state and updates `treeSha`. “grant” is not visible in the test body and makes the behavior harder to understand.  
**Suggestion:** Rename the test to something closer to the checked behavior, for example: `resets semantic review convergence state when review evidence tree changes`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Remove Repeated Literal Digest Construction
**Finding key:** loop-22af887b93c1f4b2efb8
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R5  
**Issue:** The test uses repeated string constructions like `"4".repeat(40)`, `"5".repeat(40)`, `"6".repeat(64)`, and `"7".repeat(64)` inline. These obscure which values are tree SHAs versus evidence IDs or digests.  
**Suggestion:** Define clearly named constants near the setup, such as `previousTreeSha`, `nextTreeSha`, `rejectedEvidenceId`, and `targetStateDigest`, and reuse them in the record setup. This keeps test intent clearer and reduces magic literals.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R5  
**Issue:** The test uses repeated string constructions like `"4".repeat(40)`, `"5".repeat(40)`, `"6".repeat(64)`, and `"7".repeat(64)` inline. These obscure which values are tree SHAs versus evidence IDs or digests.  
**Suggestion:** Define clearly named constants near the setup, such as `previousTreeSha`, `nextTreeSha`, `rejectedEvidenceId`, and `targetStateDigest`, and reuse them in the record setup. This keeps test intent clearer and reduces magic literals.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Use step-id keyed status overrides
**Finding key:** loop-8b031b90a0fc70a18709
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** `priorStatuses` uses camelCase keys (`implRepair`, `implGate`) while the actual step IDs are kebab-case (`impl-repair`, `impl-gate`). That creates a small naming mismatch in test setup and makes future additions easier to mistype.  
**Suggestion:** Key the overrides by the real step IDs, e.g. `priorStatuses["impl-repair"] || "pending"`, so the helper mirrors the flow state shape directly.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** `priorStatuses` uses camelCase keys (`implRepair`, `implGate`) while the actual step IDs are kebab-case (`impl-repair`, `impl-gate`). That creates a small naming mismatch in test setup and makes future additions easier to mistype.  
**Suggestion:** Key the overrides by the real step IDs, e.g. `priorStatuses["impl-repair"] || "pending"`, so the helper mirrors the flow state shape directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Avoid rebuilding repeated await expressions inline
**Finding key:** loop-05816a7eeecf9cc17ffa
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** The assertions now repeatedly call `(await updatesFor(...)).updates`, which is slightly noisier after the helper started returning both `updates` and `flowState`.  
**Suggestion:** Store the result in named variables before assertions, matching the later `rejected` case. This makes the changed helper contract clearer and keeps the test easier to scan.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** The assertions now repeatedly call `(await updatesFor(...)).updates`, which is slightly noisier after the helper started returning both `updates` and `flowState`.  
**Suggestion:** Store the result in named variables before assertions, matching the later `rejected` case. This makes the changed helper contract clearer and keeps the test easier to scan.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Extract Repeated Fixture Setup
**Finding key:** loop-f97c8e159757c151cd31
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The new test repeats several setup steps already present in this test file: creating the temp spec, writing review artifacts, preparing triage artifacts, writing stale downstream repair fingerprints, and mutating the repair target. This makes future repair-flow test changes harder to keep consistent.  
**Suggestion:** Extract a small local helper for the “applied finding without repair evidence” fixture, returning `{ specDir, previousFingerprint }` or the relevant paths. Keep the helper in this test file to stay within the touched-file scope.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The new test repeats several setup steps already present in this test file: creating the temp spec, writing review artifacts, preparing triage artifacts, writing stale downstream repair fingerprints, and mutating the repair target. This makes future repair-flow test changes harder to keep consistent.  
**Suggestion:** Extract a small local helper for the “applied finding without repair evidence” fixture, returning `{ specDir, previousFingerprint }` or the relevant paths. Keep the helper in this test file to stay within the touched-file scope.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Name the Mock Flow Manager by Role
**Finding key:** loop-ead08ae46c92abf68fad
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `flowManager` is technically accurate but hides that this is a minimal test double with partial behavior. That makes it easier to mistake it for a fully representative manager implementation.  
**Suggestion:** Rename it to something like `recordingFlowManager` or `flowManagerStub` to clarify that it records transitions and applies only the behavior needed by this test.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `flowManager` is technically accurate but hides that this is a minimal test double with partial behavior. That makes it easier to mistake it for a fully representative manager implementation.  
**Suggestion:** Rename it to something like `recordingFlowManager` or `flowManagerStub` to clarify that it records transitions and applies only the behavior needed by this test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Avoid Inline State Mutation Details in the Test Body
**Finding key:** loop-c838429a774867f8a74b
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The nested loop inside `updateStepStatuses` directly applies transition changes to `state.steps`, adding low-level mechanics to a test whose purpose is repair recovery behavior.  
**Suggestion:** Move that block into a local helper such as `applyTransitionStatusChanges(state, transitions)`. This keeps the test focused on arrange/act/assert while preserving the existing behavior.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The nested loop inside `updateStepStatuses` directly applies transition changes to `state.steps`, adding low-level mechanics to a test whose purpose is repair recovery behavior.  
**Suggestion:** Move that block into a local helper such as `applyTransitionStatusChanges(state, transitions)`. This keeps the test focused on arrange/act/assert while preserving the existing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Align exact-target spec naming
**Finding key:** loop-17c6d9d44c54b2fb5dd4
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R1  
**Issue:** `AcceptanceDecisionTargetIdentity` uses `specId` for a value sourced from `expectation.spec`, while `src/lib/flow-manager.js` uses both `expectation.spec` and `{ specId: expectation.spec }` in exact mutation paths. Across files, the boundary between “expectation spec” and “target specId” is ambiguous.  
**Suggestion:** Standardize the name at the interface boundary. Either expose `specId` consistently from target expectations, or keep `spec` in expectation objects and use a clearly named adapter when passing options into mutation APIs.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R1  
**Issue:** `AcceptanceDecisionTargetIdentity` uses `specId` for a value sourced from `expectation.spec`, while `src/lib/flow-manager.js` uses both `expectation.spec` and `{ specId: expectation.spec }` in exact mutation paths. Across files, the boundary between “expectation spec” and “target specId” is ambiguous.  
**Suggestion:** Standardize the name at the interface boundary. Either expose `specId` consistently from target expectations, or keep `spec` in expectation objects and use a clearly named adapter when passing options into mutation APIs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Share exact-target validation semantics
**Finding key:** loop-87c5a84df1004c70f2c5
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `captureExactTarget()` requires a spec-bearing target, while `mutateExactTarget()` may allow a target without `expectation.spec`. `src/flow/lib/acceptance-review-artifacts.js` depends on exact captured target identity for rollback/preservation behavior, so inconsistent validation across capture and mutation paths risks cross-file drift.  
**Suggestion:** Introduce one shared exact-target validation helper in `flow-manager.js` and use it for capture, captured mutation, and direct mutation APIs.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `captureExactTarget()` requires a spec-bearing target, while `mutateExactTarget()` may allow a target without `expectation.spec`. `src/flow/lib/acceptance-review-artifacts.js` depends on exact captured target identity for rollback/preservation behavior, so inconsistent validation across capture and mutation paths risks cross-file drift.  
**Suggestion:** Introduce one shared exact-target validation helper in `flow-manager.js` and use it for capture, captured mutation, and direct mutation APIs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Consolidate registry snapshot normalization
**Finding key:** loop-896a4c1c55b5dd5908af
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R2  
**Issue:** Both `src/lib/active-flow-registry.js` and `src/flow/lib/acceptance-review-artifacts.js` introduce snapshot-style normalization of registry entries. The implementations are separate, so future changes to registry entry shape or identity comparison could be updated in one snapshot path but missed in the other.  
**Suggestion:** Extract shared registry entry normalization/key helpers, or make the acceptance-decision snapshot reuse the active-flow registry snapshot’s normalized representation where appropriate.
**Suggestion:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R2  
**Issue:** Both `src/lib/active-flow-registry.js` and `src/flow/lib/acceptance-review-artifacts.js` introduce snapshot-style normalization of registry entries. The implementations are separate, so future changes to registry entry shape or identity comparison could be updated in one snapshot path but missed in the other.  
**Suggestion:** Extract shared registry entry normalization/key helpers, or make the acceptance-decision snapshot reuse the active-flow registry snapshot’s normalized representation where appropriate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Use consistent captured-target naming
**Finding key:** loop-c1ef3e5bc9a6887195f2
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R3
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` in `flow-manager.js` and rollback helpers like `rollbackDecision`/`mutateDecision` in `acceptance-review-artifacts.js` describe related target-bound mutation concepts with different levels of precision. Across files, it is unclear whether “captured” means identity-preserving, mutable, already mutated, or rollback-bound.  
**Suggestion:** Adopt consistent names such as `CapturedFlowTargetMutator` and `restoreCapturedDecisionTarget`, reserving “mutation” for the operation/result rather than the captured facade.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` in `flow-manager.js` and rollback helpers like `rollbackDecision`/`mutateDecision` in `acceptance-review-artifacts.js` describe related target-bound mutation concepts with different levels of precision. Across files, it is unclear whether “captured” means identity-preserving, mutable, already mutated, or rollback-bound.  
**Suggestion:** Adopt consistent names such as `CapturedFlowTargetMutator` and `restoreCapturedDecisionTarget`, reserving “mutation” for the operation/result rather than the captured facade.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Normalize repair completion result shape
**Finding key:** loop-c8b09c3c59d99d7f6fe0
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `set-step.js` wraps the result of repair completion as `{ completed, mutationOptions }`, producing call sites like `completed.completed.entry`, while `src/flow/lib/impl-repair-artifacts.js` already appears to return the actual repair completion object. This creates a cross-file interface naming mismatch.  
**Suggestion:** Return the repair completion object directly from `completeImplRepairStep`, or rename the wrapper to `repairResult` and its nested value to something more specific than `completed`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** `set-step.js` wraps the result of repair completion as `{ completed, mutationOptions }`, producing call sites like `completed.completed.entry`, while `src/flow/lib/impl-repair-artifacts.js` already appears to return the actual repair completion object. This creates a cross-file interface naming mismatch.  
**Suggestion:** Return the repair completion object directly from `completeImplRepairStep`, or rename the wrapper to `repairResult` and its nested value to something more specific than `completed`.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
