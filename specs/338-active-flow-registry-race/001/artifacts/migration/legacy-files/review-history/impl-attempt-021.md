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

### 11. 1. Bound Delta Path Scanning
**Finding key:** loop-1866f38707366a6784d0
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `repairEvidenceFile()` calls `delta.changedPaths.find(...)`, and `isDurableRepairEvidencePath()` performs a synchronous `lstatSync()` per path. If a delta artifact contains many paths, this can become unbounded filesystem work, violating `bounded-resource-usage`.  
**Suggestion:** Cap the number of candidate paths scanned, for example with an explicit constant such as `REPAIR_EVIDENCE_SCAN_LIMIT`, or validate/enforce the existing changed-path limit before scanning. Throw a clear error when the limit is exceeded.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `repairEvidenceFile()` calls `delta.changedPaths.find(...)`, and `isDurableRepairEvidencePath()` performs a synchronous `lstatSync()` per path. If a delta artifact contains many paths, this can become unbounded filesystem work, violating `bounded-resource-usage`.  
**Suggestion:** Cap the number of candidate paths scanned, for example with an explicit constant such as `REPAIR_EVIDENCE_SCAN_LIMIT`, or validate/enforce the existing changed-path limit before scanning. Throw a clear error when the limit is exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Reuse Changed Path Prefix Naming
**Finding key:** loop-a2d758fb644d9827ea31
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `WORKFLOW_ARTIFACT_PATH_PREFIXES` is a little broad as a name. The constant is specifically used to exclude non-durable repair evidence candidates, not all workflow artifacts generally.  
**Suggestion:** Rename it to something more intent-revealing, such as `NON_DURABLE_REPAIR_EVIDENCE_PATH_PREFIXES` or `REPAIR_EVIDENCE_EXCLUDED_PATH_PREFIXES`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `WORKFLOW_ARTIFACT_PATH_PREFIXES` is a little broad as a name. The constant is specifically used to exclude non-durable repair evidence candidates, not all workflow artifacts generally.  
**Suggestion:** Rename it to something more intent-revealing, such as `NON_DURABLE_REPAIR_EVIDENCE_PATH_PREFIXES` or `REPAIR_EVIDENCE_EXCLUDED_PATH_PREFIXES`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Avoid Duplicate Ledger Hash Branching
**Finding key:** loop-d833320e90c35965c7dc
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `completeLateAppliedFindingRepair()` repeats the condition `ledgerPreviousHash === previous.hash` to decide both `changedPaths` and `delta` construction. This duplicates decision logic and makes the recovery path slightly harder to audit.  
**Suggestion:** Store the comparison once, e.g. `const extendsCurrentManifest = ledgerPreviousHash === previous.hash;`, and use that named boolean in both places. This makes the two branches visibly tied to the same lifecycle authority decision.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `completeLateAppliedFindingRepair()` repeats the condition `ledgerPreviousHash === previous.hash` to decide both `changedPaths` and `delta` construction. This duplicates decision logic and makes the recovery path slightly harder to audit.  
**Suggestion:** Store the comparison once, e.g. `const extendsCurrentManifest = ledgerPreviousHash === previous.hash;`, and use that named boolean in both places. This makes the two branches visibly tied to the same lifecycle authority decision.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 4. Extract Transaction ID Creation
**Finding key:** loop-51ff667a3bc9853bed7a
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** The repair entry ID generation is embedded inline: ``repair-${String(existing.entries.length + 1).padStart(3, "0")}``. If similar repair entry creation exists or is added later, this formatting rule is easy to duplicate inconsistently.  
**Suggestion:** Extract a small helper like `nextImplRepairEntryId(existing)` or `formatImplRepairEntryId(index)` and use it here. This keeps artifact identity formatting centralized.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** The repair entry ID generation is embedded inline: ``repair-${String(existing.entries.length + 1).padStart(3, "0")}``. If similar repair entry creation exists or is added later, this formatting rule is easy to duplicate inconsistently.  
**Suggestion:** Extract a small helper like `nextImplRepairEntryId(existing)` or `formatImplRepairEntryId(index)` and use it here. This keeps artifact identity formatting centralized.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Clarify shared mutation base name
**Finding key:** loop-e911ada7575e6f56c039
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `ReviewRecoveryMutation` is a shared base class, but its name sounds instantiable and domain-complete. The exported subclasses are specifically recovery mutations, while the base only provides target lookup and replacement helpers.  
**Suggestion:** Rename it to something like `ReviewRecoveryMutationBase` or `BaseReviewRecoveryMutation` to make the inheritance role explicit and align with the surrounding exported mutation class naming.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `ReviewRecoveryMutation` is a shared base class, but its name sounds instantiable and domain-complete. The exported subclasses are specifically recovery mutations, while the base only provides target lookup and replacement helpers.  
**Suggestion:** Rename it to something like `ReviewRecoveryMutationBase` or `BaseReviewRecoveryMutation` to make the inheritance role explicit and align with the surrounding exported mutation class naming.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Avoid negative semantic attempt count
**Finding key:** loop-7229893a606d94338e86
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `ReviewSemanticRecoveryMutation` sets `semanticAttempts: current.semanticMaxAttempts - 1`. If `semanticMaxAttempts` is `0`, this produces `-1`. Even if that state is unlikely, the method does not explicitly bound the value. This touches the bounded re-evaluation behavior in R6 and the bounded-resource-usage guardrail.  
**Suggestion:** Validate `current.semanticMaxAttempts > 0` before constructing `recovered`, or assign `Math.max(0, current.semanticMaxAttempts - 1)` if zero-attempt semantics are valid.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `ReviewSemanticRecoveryMutation` sets `semanticAttempts: current.semanticMaxAttempts - 1`. If `semanticMaxAttempts` is `0`, this produces `-1`. Even if that state is unlikely, the method does not explicitly bound the value. This touches the bounded re-evaluation behavior in R6 and the bounded-resource-usage guardrail.  
**Suggestion:** Validate `current.semanticMaxAttempts > 0` before constructing `recovered`, or assign `Math.max(0, current.semanticMaxAttempts - 1)` if zero-attempt semantics are valid.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Extract recovery-state construction helper
**Finding key:** loop-604d27dd67d9197f5908
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** Both recovery subclasses repeat the same pattern: read current state, validate exhaustion conditions, construct a `ReviewConvergenceState` from `current.toJSON()` with a new `treeSha`, then call `replace`. The duplication is small now but likely to grow with additional recovery modes.  
**Suggestion:** Add a protected-style helper on the base, for example `recover(flowState, overrides)`, that handles `readCurrent`, `new ReviewConvergenceState({ ...current.toJSON(), treeSha: this.nextTreeSha, ...overrides })`, and `replace`. Keep subclass-specific validation in each `apply`.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** Both recovery subclasses repeat the same pattern: read current state, validate exhaustion conditions, construct a `ReviewConvergenceState` from `current.toJSON()` with a new `treeSha`, then call `replace`. The duplication is small now but likely to grow with additional recovery modes.  
**Suggestion:** Add a protected-style helper on the base, for example `recover(flowState, overrides)`, that handles `readCurrent`, `new ReviewConvergenceState({ ...current.toJSON(), treeSha: this.nextTreeSha, ...overrides })`, and `replace`. Keep subclass-specific validation in each `apply`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 4. Tighten semantic exhaustion validation
**Finding key:** loop-3ee5e705e105f921f4e3
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** The semantic recovery path checks `current.semanticAttempts !== current.semanticMaxAttempts`, but it does not verify that `semanticMaxAttempts` is the expected bounded maximum, unlike tooling recovery which checks `toolingMaxAttempts === REVIEW_TOOLING_MAX_ATTEMPTS`. This makes the two recovery authorities inconsistent.  
**Suggestion:** If there is a fixed semantic max constant, validate it here before allowing recovery. If semantic max is intentionally state-driven, add a short comment explaining why semantic recovery uses the stored max while tooling recovery requires the global constant.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** The semantic recovery path checks `current.semanticAttempts !== current.semanticMaxAttempts`, but it does not verify that `semanticMaxAttempts` is the expected bounded maximum, unlike tooling recovery which checks `toolingMaxAttempts === REVIEW_TOOLING_MAX_ATTEMPTS`. This makes the two recovery authorities inconsistent.  
**Suggestion:** If there is a fixed semantic max constant, validate it here before allowing recovery. If semantic max is intentionally state-driven, add a short comment explaining why semantic recovery uses the stored max while tooling recovery requires the global constant.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Extract Shared Repair Ledger Finding Collection
**Finding key:** loop-49b910dcfb661704d858
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds` both read the impl repair ledger and build the same `Set` of repaired `sourceFindingIds`. This duplicates logic and makes future ledger shape changes easier to miss in one path.  
**Suggestion:** Add a small helper such as `repairedSourceFindingIds(specDir)` that calls `readImplRepairLedger(specDir)` and returns the `Set`, then reuse it in both recovery paths.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds` both read the impl repair ledger and build the same `Set` of repaired `sourceFindingIds`. This duplicates logic and makes future ledger shape changes easier to miss in one path.  
**Suggestion:** Add a small helper such as `repairedSourceFindingIds(specDir)` that calls `readImplRepairLedger(specDir)` and returns the `Set`, then reuse it in both recovery paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Rename Missing Finding Variables For Clarity
**Finding key:** loop-edc200d606023b989915
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** Several names use `missing` or `missingFindingIds`, but the values mean different things in different contexts: findings missing repair evidence, findings observed by the gate, and findings already present in the repair ledger. This makes the recovery logic harder to audit.  
**Suggestion:** Rename to more precise terms, for example `unrepairedAppliedFindingIds` in `missingCurrentAppliedFindingIds`, `gateObservedRepairedFindingIds` or `gateObservedFindingIds` in `missingGateObservedFindingIds`, and `recoveryFindingIds` at the call site.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** Several names use `missing` or `missingFindingIds`, but the values mean different things in different contexts: findings missing repair evidence, findings observed by the gate, and findings already present in the repair ledger. This makes the recovery logic harder to audit.  
**Suggestion:** Rename to more precise terms, for example `unrepairedAppliedFindingIds` in `missingCurrentAppliedFindingIds`, `gateObservedRepairedFindingIds` or `gateObservedFindingIds` in `missingGateObservedFindingIds`, and `recoveryFindingIds` at the call site.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Consolidate Fresh Test Evidence Validation
**Finding key:** loop-4d38c4fbd23a497670b5
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `assertFreshRecoveryTestEvidence(specDir)` is called inside both fallback recovery branches. In the current flow, if triage validation fails after checking evidence, the fallback path checks the same files again.  
**Suggestion:** Move the freshness check to `validateBlockedImplRepairRecovery` after one recovery source has identified candidate finding IDs, or cache the manifest/artifact result in a helper so the validation is performed once per recovery attempt.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `assertFreshRecoveryTestEvidence(specDir)` is called inside both fallback recovery branches. In the current flow, if triage validation fails after checking evidence, the fallback path checks the same files again.  
**Suggestion:** Move the freshness check to `validateBlockedImplRepairRecovery` after one recovery source has identified candidate finding IDs, or cache the manifest/artifact result in a helper so the validation is performed once per recovery attempt.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 4. Simplify Nested Recovery Fallback Error Handling
**Finding key:** loop-e53eb60204532fccc338
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `validateBlockedImplRepairRecovery` uses nested `try/catch` blocks to attempt triage-based recovery, then gate-observed recovery, then concatenate error messages. This is correct but visually dense and makes the intended two-source fallback pattern harder to follow.  
**Suggestion:** Extract the two candidate readers into an ordered list and iterate until one succeeds, collecting failure messages. This would make the bounded two-attempt behavior explicit and easier to extend or audit.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `validateBlockedImplRepairRecovery` uses nested `try/catch` blocks to attempt triage-based recovery, then gate-observed recovery, then concatenate error messages. This is correct but visually dense and makes the intended two-source fallback pattern harder to follow.  
**Suggestion:** Extract the two candidate readers into an ordered list and iterate until one succeeds, collecting failure messages. This would make the bounded two-attempt behavior explicit and easier to extend or audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 5. Avoid `instanceof Envelope` As A Control Signal
**Finding key:** loop-762717f44697d4d71bf1
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** The new call site checks `if (recovery instanceof Envelope) return recovery;`, while the success path returns a plain object. This mixes command result data with error-envelope control flow and can become brittle if `Envelope.fail` changes implementation details.  
**Suggestion:** Prefer a consistent result shape from `validateBlockedImplRepairRecovery`, such as `{ ok: true, ... }` / `{ ok: false, envelope }`, or split validation so failures are thrown internally and converted to `Envelope.fail` only at the command boundary.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** The new call site checks `if (recovery instanceof Envelope) return recovery;`, while the success path returns a plain object. This mixes command result data with error-envelope control flow and can become brittle if `Envelope.fail` changes implementation details.  
**Suggestion:** Prefer a consistent result shape from `validateBlockedImplRepairRecovery`, such as `{ ok: true, ... }` / `{ ok: false, envelope }`, or split validation so failures are thrown internally and converted to `Envelope.fail` only at the command boundary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Add an explicit snapshot size bound
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

### 25. 2. Rename the local `snapshot` variable
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

### 26. 3. Simplify entry normalization in `ActiveFlowRegistrySnapshot`
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

### 27. 1. Align exact-target validation
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

### 28. 2. Remove duplicated explicit target resolver
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

### 29. 3. Rename captured mutation wrapper for clarity
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

### 30. 1. Extract ReviewEvidence fixture creation
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

### 31. 2. Align the test request text with the asserted behavior
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

### 32. 3. Avoid hard-coded retry exhaustion values repeated inline
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

### 33. 1. Extract Shared Review Convergence Record Setup
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

### 34. 2. Name the Test Around the Observable Behavior
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

### 35. 1. Rename helper to match returned shape
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

### 36. 2. Avoid custom camelCase keys for step status overrides
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

### 37. 1. Extract repeated repair fixture setup
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

### 38. 2. Extract repeated flow manager status application
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

### 39. 3. Use a more specific finding ID constant name
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

### 40. 4. Avoid nondeterministic timestamp generation in fixture data
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

### 41. 1. Centralize Bounded Scan Limits
**Finding key:** loop-4553f702d7e6e254d916
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** Multiple files introduce bulk scans or snapshot copies without consistent limit handling: `historicalReviewHandoffs()` scans convergence history, `repairEvidenceFile()` scans delta paths in `src/flow/lib/impl-repair-artifacts.js`, and `ActiveFlowRegistrySnapshot` copies registry entries in `src/lib/active-flow-registry.js`. Each proposal suggests a local cap, but independent caps risk inconsistent error semantics and naming.
**Suggestion:** Add a shared bounded-collection helper or shared constants module for artifact/registry scan limits, with consistent mechanical-blocker errors. Use it from acceptance review artifacts, impl repair artifact scanning, and active-flow registry snapshot creation.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** Multiple files introduce bulk scans or snapshot copies without consistent limit handling: `historicalReviewHandoffs()` scans convergence history, `repairEvidenceFile()` scans delta paths in `src/flow/lib/impl-repair-artifacts.js`, and `ActiveFlowRegistrySnapshot` copies registry entries in `src/lib/active-flow-registry.js`. Each proposal suggests a local cap, but independent caps risk inconsistent error semantics and naming.
**Suggestion:** Add a shared bounded-collection helper or shared constants module for artifact/registry scan limits, with consistent mechanical-blocker errors. Use it from acceptance review artifacts, impl repair artifact scanning, and active-flow registry snapshot creation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Align Exact-Target Mutation Interfaces
**Finding key:** loop-4e697aa93702b38690df
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `flow-manager.js` has inconsistent exact-target validation between `captureExactTarget()` and `mutateExactTarget()`, while `src/flow/lib/acceptance-review-artifacts.js` builds mutation/rollback closures around `registrySnapshot == null`. Together, these create two layers of target-selection logic with slightly different assumptions about whether a spec identity is required.
**Suggestion:** Expose one authoritative exact-target capture/mutation API from `flow-manager.js` that always validates the required spec/run identity, then have acceptance decision mutation and rollback paths consume that captured target instead of branching independently on registry snapshot presence.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `flow-manager.js` has inconsistent exact-target validation between `captureExactTarget()` and `mutateExactTarget()`, while `src/flow/lib/acceptance-review-artifacts.js` builds mutation/rollback closures around `registrySnapshot == null`. Together, these create two layers of target-selection logic with slightly different assumptions about whether a spec identity is required.
**Suggestion:** Expose one authoritative exact-target capture/mutation API from `flow-manager.js` that always validates the required spec/run identity, then have acceptance decision mutation and rollback paths consume that captured target instead of branching independently on registry snapshot presence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 3. Normalize Repair/Recovery Naming Across Flow Files
**Finding key:** loop-1d2c822c1eaec7f69ca6
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** Recovery-related names vary across files: `ReviewRecoveryMutation` sounds like a concrete mutation, `REJECTED_IMPL_REVIEW_RESET_STEPS` in `src/flow/definition.js` describes reset behavior from a different angle, and `set-step.js` uses broad `missing*FindingIds` names for repair recovery paths. The concepts are related, but naming does not consistently distinguish recovery trigger, reset action, and unrepaired finding selection.
**Suggestion:** Adopt a common naming pattern: use `*Recovery*` for recovery authority objects, `*RejectionReset*` for reset-step constants, and `unrepaired*FindingIds` for finding sets that still require repair evidence. Rename the affected symbols together to keep the R6 lifecycle vocabulary consistent.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** Recovery-related names vary across files: `ReviewRecoveryMutation` sounds like a concrete mutation, `REJECTED_IMPL_REVIEW_RESET_STEPS` in `src/flow/definition.js` describes reset behavior from a different angle, and `set-step.js` uses broad `missing*FindingIds` names for repair recovery paths. The concepts are related, but naming does not consistently distinguish recovery trigger, reset action, and unrepaired finding selection.
**Suggestion:** Adopt a common naming pattern: use `*Recovery*` for recovery authority objects, `*RejectionReset*` for reset-step constants, and `unrepaired*FindingIds` for finding sets that still require repair evidence. Rename the affected symbols together to keep the R6 lifecycle vocabulary consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
