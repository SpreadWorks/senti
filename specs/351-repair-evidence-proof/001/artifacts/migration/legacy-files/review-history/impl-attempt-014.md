# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Extract Attempt Freshness Check
**Finding key:** loop-beac7ada412832ca8531
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R1  
**Issue:** `attachLatestStepAttempt` now combines two freshness checks inline: attempt before `startedAt`, and attempt before retry reset timestamp. This makes the guard harder to read and will be easy to duplicate if similar filtering is needed elsewhere.  
**Suggestion:** Extract a helper such as `isAttemptCurrentForStep({ attempt, targetStep, resetAt })` or `isStaleStepAttempt(...)` and use it in the early return.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R1  
**Issue:** `attachLatestStepAttempt` now combines two freshness checks inline: attempt before `startedAt`, and attempt before retry reset timestamp. This makes the guard harder to read and will be easy to duplicate if similar filtering is needed elsewhere.  
**Suggestion:** Extract a helper such as `isAttemptCurrentForStep({ attempt, targetStep, resetAt })` or `isStaleStepAttempt(...)` and use it in the early return.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 5. Guard Invalid Timestamp Parsing
**Finding key:** loop-7a6c340681c12578318a
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R1  
**Issue:** `Date.parse(attempt.recordedAt) < resetAt` silently returns `false` when `attempt.recordedAt` is invalid because `Date.parse` returns `NaN`. That can allow malformed attempt timestamps to survive the reset filter.  
**Suggestion:** Store the parsed timestamp in a named variable and explicitly handle non-finite values, either by treating them as stale or throwing if invalid timestamps should never occur.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R1  
**Issue:** `Date.parse(attempt.recordedAt) < resetAt` silently returns `false` when `attempt.recordedAt` is invalid because `Date.parse` returns `NaN`. That can allow malformed attempt timestamps to survive the reset filter.  
**Suggestion:** Store the parsed timestamp in a named variable and explicitly handle non-finite values, either by treating them as stale or throwing if invalid timestamps should never occur.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Remove Unused Parameter
**Finding key:** loop-55bc291fb5d4c74bfc35
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `repairProofValidationContext({ specDir, entry })` accepts `entry` but never uses it, which adds noise and suggests validation may depend on entry data when it does not.  
**Suggestion:** Change the signature to `repairProofValidationContext({ specDir })` and update the call site accordingly.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `repairProofValidationContext({ specDir, entry })` accepts `entry` but never uses it, which adds noise and suggests validation may depend on entry data when it does not.  
**Suggestion:** Change the signature to `repairProofValidationContext({ specDir })` and update the call site accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Avoid Revalidating Proof Input Through a Second Wrapper
**Finding key:** loop-1474415327d94f3d2548
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `recordAppliedFindingRepairEvidence` manually constructs a proof-shaped object, then `buildAppliedFindingRepairProof` immediately wraps it in `new RepairEvidenceReference(input)` and reconstructs nearly the same structure. This duplicates field mapping and makes the data flow harder to follow.  
**Suggestion:** Either construct `RepairEvidenceReference` directly in `recordAppliedFindingRepairEvidence` and serialize it once, or make `buildAppliedFindingRepairProof` accept a `RepairEvidenceReference` instance so the validation/mapping boundary is explicit.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `recordAppliedFindingRepairEvidence` manually constructs a proof-shaped object, then `buildAppliedFindingRepairProof` immediately wraps it in `new RepairEvidenceReference(input)` and reconstructs nearly the same structure. This duplicates field mapping and makes the data flow harder to follow.  
**Suggestion:** Either construct `RepairEvidenceReference` directly in `recordAppliedFindingRepairEvidence` and serialize it once, or make `buildAppliedFindingRepairProof` accept a `RepairEvidenceReference` instance so the validation/mapping boundary is explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Rename Validated Purpose For Consistency
**Finding key:** loop-33d699d6b4d7731777ea
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `ValidatedAppliedFindingRepairPurpose` is semantically close to `AppliedFindingRepairPurpose`, but the name does not clearly indicate that it represents the post-validation evidence-recording phase rather than a different kind of repair.  
**Suggestion:** Rename it to something more precise, such as `AppliedFindingRepairEvidencePurpose` or `ValidatedRepairEvidencePurpose`, and update the serialized `kind` string if persisted compatibility allows.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `ValidatedAppliedFindingRepairPurpose` is semantically close to `AppliedFindingRepairPurpose`, but the name does not clearly indicate that it represents the post-validation evidence-recording phase rather than a different kind of repair.  
**Suggestion:** Rename it to something more precise, such as `AppliedFindingRepairEvidencePurpose` or `ValidatedRepairEvidencePurpose`, and update the serialized `kind` string if persisted compatibility allows.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Centralize recovery active-step mapping
**Finding key:** loop-75648d97e2f41f857cdd
**Failure mode:** refactor
**File:** src/flow/lib/retry-recovery.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/retry-recovery.js`  
**Requirement:** R4  
**Issue:** `expectedActiveStep()` now mixes fixed phase-to-step mapping with conditional task context logic inline. This makes the new `draft` gate case and task-scoped impl review case harder to scan and easier to diverge from nearby phase mapping constants.  
**Suggestion:** Replace the nested conditionals with small lookup maps, for example `GATE_ACTIVE_STEP_BY_PHASE` and `REVIEW_ACTIVE_STEP_BY_PHASE`, and handle only the `impl` task/non-task split as the special case.
**Suggestion:** **File:** `src/flow/lib/retry-recovery.js`  
**Requirement:** R4  
**Issue:** `expectedActiveStep()` now mixes fixed phase-to-step mapping with conditional task context logic inline. This makes the new `draft` gate case and task-scoped impl review case harder to scan and easier to diverge from nearby phase mapping constants.  
**Suggestion:** Replace the nested conditionals with small lookup maps, for example `GATE_ACTIVE_STEP_BY_PHASE` and `REVIEW_ACTIVE_STEP_BY_PHASE`, and handle only the `impl` task/non-task split as the special case.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Extract semantic recovery eligibility into named helpers
**Finding key:** loop-e01f4e70351280074ddf
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R5  
**Issue:** `ReviewSemanticRecoveryMutation.apply()` now has a long inline disposition condition plus a second conditional tied only to `REJECTED`. The error message also introduces domain language, “invalidated pass” and “no-verdict,” that is not reflected by named code concepts.  
**Suggestion:** Add a small helper such as `canApplySemanticRecovery(current)` or constants like `SEMANTIC_RECOVERY_DISPOSITIONS = new Set(["REJECTED", "PASS", null])`, plus `requiresExhaustedSemanticAttempts(current)`. This would make the allowed states explicit and reduce future mistakes when adding another recovery disposition.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R5  
**Issue:** `ReviewSemanticRecoveryMutation.apply()` now has a long inline disposition condition plus a second conditional tied only to `REJECTED`. The error message also introduces domain language, “invalidated pass” and “no-verdict,” that is not reflected by named code concepts.  
**Suggestion:** Add a small helper such as `canApplySemanticRecovery(current)` or constants like `SEMANTIC_RECOVERY_DISPOSITIONS = new Set(["REJECTED", "PASS", null])`, plus `requiresExhaustedSemanticAttempts(current)`. This would make the allowed states explicit and reduce future mistakes when adding another recovery disposition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Clarify draft semantic finding predicate
**Finding key:** loop-6e061abc2258a21cd718
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** The draft retry-exhaustion branch embeds `finding?.category === "semantic"` inline. That category check is now policy-significant because only semantic draft findings defer.  
**Suggestion:** Extract a named helper such as `isDraftDeferrableSemanticFinding(finding)` or `allFindingsAreSemantic(rawFindings)` and use it in `classifyGateRetryExhaustionSource`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** The draft retry-exhaustion branch embeds `finding?.category === "semantic"` inline. That category check is now policy-significant because only semantic draft findings defer.  
**Suggestion:** Extract a named helper such as `isDraftDeferrableSemanticFinding(finding)` or `allFindingsAreSemantic(rawFindings)` and use it in `classifyGateRetryExhaustionSource`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Rename recovery phase set to match behavior
**Finding key:** loop-d88f98e3d2b786436362
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `GATE_RECOVERY_PHASES` now includes `draft`, but draft exhaustion does not follow the same repair-evidence recovery path as task/integration; it defers semantic findings directly. The name is broader than the behavior.  
**Suggestion:** Rename it to something like `GATE_RETRY_EXHAUSTION_PHASES` so the constant describes which phases participate in retry-exhaustion handling, not just repair recovery.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `GATE_RECOVERY_PHASES` now includes `draft`, but draft exhaustion does not follow the same repair-evidence recovery path as task/integration; it defers semantic findings directly. The name is broader than the behavior.  
**Suggestion:** Rename it to something like `GATE_RETRY_EXHAUSTION_PHASES` so the constant describes which phases participate in retry-exhaustion handling, not just repair recovery.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 4. Avoid stale “latest ledger entry” ambiguity
**Finding key:** loop-ddea9a87607e68135099
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `repairDiff` is derived from `ledger?.entries.at(-1)?.changedPathsDigest`, but the name hides that this is specifically the latest repair ledger digest.  
**Suggestion:** Introduce a small helper or clearer local name, e.g. `latestRepairDiff = latestImplRepairDiffDigest(ledger)`, then pass it as `repairDiff`. That keeps the policy API intact while making the source and selection rule explicit.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `repairDiff` is derived from `ledger?.entries.at(-1)?.changedPathsDigest`, but the name hides that this is specifically the latest repair ledger digest.  
**Suggestion:** Introduce a small helper or clearer local name, e.g. `latestRepairDiff = latestImplRepairDiffDigest(ledger)`, then pass it as `repairDiff`. That keeps the policy API intact while making the source and selection rule explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Extract retry reset record construction
**Finding key:** loop-dae8988563ae92b7ae4f
**Failure mode:** refactor
**File:** src/flow/lib/run-reopen-draft.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R5  
**Issue:** `resetSpecCorrectionRetries` duplicates the same metric record shape across two loops, differing only by phase list and counter name. This makes future retry-reset changes easy to apply inconsistently.  
**Suggestion:** Build one local reset descriptor list, e.g. `SPEC_CORRECTION_RETRY_RESETS`, and loop once to append `{ phase, counter, delta: 0, reset: true, taskId: null, ts }`.
**Suggestion:** **File:** `src/flow/lib/run-reopen-draft.js`  
**Requirement:** R5  
**Issue:** `resetSpecCorrectionRetries` duplicates the same metric record shape across two loops, differing only by phase list and counter name. This makes future retry-reset changes easy to apply inconsistently.  
**Suggestion:** Build one local reset descriptor list, e.g. `SPEC_CORRECTION_RETRY_RESETS`, and loop once to append `{ phase, counter, delta: 0, reset: true, taskId: null, ts }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Consolidate phase remapping with artifact naming
**Finding key:** loop-df924d9fc6bfc6ce7e27
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** `sourceArtifactPhase()` hard-codes the same special-case phase knowledge that is already related to `REVIEW_SOURCE_ARTIFACT_BY_PHASE` / `canonicalArtifactName()`. This creates a second place to update when review phase naming changes.  
**Suggestion:** Replace the `if` chain with a shared map or derive both artifact filename and stored artifact phase from one phase metadata object.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** `sourceArtifactPhase()` hard-codes the same special-case phase knowledge that is already related to `REVIEW_SOURCE_ARTIFACT_BY_PHASE` / `canonicalArtifactName()`. This creates a second place to update when review phase naming changes.  
**Suggestion:** Replace the `if` chain with a shared map or derive both artifact filename and stored artifact phase from one phase metadata object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Avoid mutating parsed artifact directly during replay
**Finding key:** loop-177d9fd76a08316d885f
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** `completedReviewLifecycleReplay()` mutates `artifact.phase` after validation and writes the whole object back. This is a narrow repair path, but mutating the loaded object makes the write behavior less explicit.  
**Suggestion:** Create a new object for the repaired artifact, e.g. `const repairedArtifact = { ...artifact, phase: artifactPhase };`, and write that. This keeps validation input and repaired output distinct.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R4  
**Issue:** `completedReviewLifecycleReplay()` mutates `artifact.phase` after validation and writes the whole object back. This is a narrow repair path, but mutating the loaded object makes the write behavior less explicit.  
**Suggestion:** Create a new object for the repaired artifact, e.g. `const repairedArtifact = { ...artifact, phase: artifactPhase };`, and write that. This keeps validation input and repaired output distinct.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Extract repeated review target metadata
**Finding key:** loop-7adfc93d4ca8cb8ba8a5
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** The same target identity fields are assembled in multiple places: `phase`, `taskId`, `treeSha`, and `targetStateDigest`. The replay path and canonical artifact persistence path both depend on matching these fields exactly.  
**Suggestion:** Add a small helper such as `buildReviewTargetIdentity({ phase, taskId, treeSha, targetStateDigest })`, with an option for artifact phase normalization where needed. That reduces drift between validation and persistence logic.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** The same target identity fields are assembled in multiple places: `phase`, `taskId`, `treeSha`, and `targetStateDigest`. The replay path and canonical artifact persistence path both depend on matching these fields exactly.  
**Suggestion:** Add a small helper such as `buildReviewTargetIdentity({ phase, taskId, treeSha, targetStateDigest })`, with an option for artifact phase normalization where needed. That reduces drift between validation and persistence logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Simplify baseline fallback naming
**Finding key:** loop-36250d4a312febadc47f
**Failure mode:** refactor
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R2  
**Issue:** `baselineRef` is clearer than the previous `baseBranch`, but `buildScenarioValidityDiffArgs(baseBranch = "main")` still uses the old parameter name. The function now accepts any baseline ref, not necessarily a branch.  
**Suggestion:** Rename the parameter to `baselineRef = "main"` in `buildScenarioValidityDiffArgs()` for consistency with the call site and the repaired state model.
**Suggestion:** **File:** `src/flow/lib/run-scenario-validity.js`  
**Requirement:** R2  
**Issue:** `baselineRef` is clearer than the previous `baseBranch`, but `buildScenarioValidityDiffArgs(baseBranch = "main")` still uses the old parameter name. The function now accepts any baseline ref, not necessarily a branch.  
**Suggestion:** Rename the parameter to `baselineRef = "main"` in `buildScenarioValidityDiffArgs()` for consistency with the call site and the repaired state model.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Rename Bootstrap Predicate to Match What It Verifies
**Finding key:** loop-a7342b8a956c9d3fa066
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `hasAuditedPreimplementationBootstrap` implies it verifies an audit record, but it only checks final step statuses, repair baseline presence, and scenario artifact shape. That name overstates the guarantee.  
**Suggestion:** Rename it to something like `isPreimplementationBootstrapState` or `shouldSkipScenarioCompletionForBootstrap` so the predicate describes the actual condition.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R1  
**Issue:** `hasAuditedPreimplementationBootstrap` implies it verifies an audit record, but it only checks final step statuses, repair baseline presence, and scenario artifact shape. That name overstates the guarantee.  
**Suggestion:** Rename it to something like `isPreimplementationBootstrapState` or `shouldSkipScenarioCompletionForBootstrap` so the predicate describes the actual condition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Remove Repeated Step Lookups in Bootstrap Predicate
**Finding key:** loop-c8de44c6fdda99ccf1ed
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** The helper repeats `findStepById(state.steps || [], ...)` three times and hardcodes the expected status checks inline. This makes future lifecycle edits more error-prone.  
**Suggestion:** Build a small expected-status table and check it with `every`, e.g. `Object.entries(expectedStatuses).every(([id, status]) => findStepById(steps, id)?.status === status)`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R2  
**Issue:** The helper repeats `findStepById(state.steps || [], ...)` three times and hardcodes the expected status checks inline. This makes future lifecycle edits more error-prone.  
**Suggestion:** Build a small expected-status table and check it with `every`, e.g. `Object.entries(expectedStatuses).every(([id, status]) => findStepById(steps, id)?.status === status)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Bound and Simplify Retry Reset Metric Scanning
**Finding key:** loop-38686c0822d19a5ba381
**Failure mode:** refactor
**File:** src/flow/lib/step-outcome.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/step-outcome.js`  
**Requirement:** R3  
**Issue:** `retryResetTimestampForStep` scans all `flowState.metrics` and creates multiple intermediate arrays. That violates the `bounded-resource-usage` guardrail because metric history can grow without an explicit scan bound.  
**Suggestion:** Replace the `filter/map/filter/reduce` chain with a single loop and an explicit maximum scan count, ideally scanning from the end because only the latest reset matters. Define a named cap such as `MAX_RETRY_RESET_METRICS_SCAN`.
**Suggestion:** **File:** `src/flow/lib/step-outcome.js`  
**Requirement:** R3  
**Issue:** `retryResetTimestampForStep` scans all `flowState.metrics` and creates multiple intermediate arrays. That violates the `bounded-resource-usage` guardrail because metric history can grow without an explicit scan bound.  
**Suggestion:** Replace the `filter/map/filter/reduce` chain with a single loop and an explicit maximum scan count, ideally scanning from the end because only the latest reset matters. Define a named cap such as `MAX_RETRY_RESET_METRICS_SCAN`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Avoid Duplicate Retry Metric Mapping Concepts
**Finding key:** loop-917dda25064e01a4f8c4
**Failure mode:** refactor
**File:** src/flow/lib/step-outcome.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/step-outcome.js`  
**Requirement:** R4  
**Issue:** `RETRY_RESET_METRIC_BY_STEP` introduces another hardcoded step-to-phase/counter mapping alongside existing retry accounting concepts elsewhere in the flow code. This increases the chance that retry behavior diverges when phases change.  
**Suggestion:** Centralize the mapping behind a small local helper with a descriptive name, such as `retryResetMetricForStep(stepId)`, and keep `nextStepAttemptNumber` dependent on that abstraction instead of directly indexing the table.
**Suggestion:** **File:** `src/flow/lib/step-outcome.js`  
**Requirement:** R4  
**Issue:** `RETRY_RESET_METRIC_BY_STEP` introduces another hardcoded step-to-phase/counter mapping alongside existing retry accounting concepts elsewhere in the flow code. This increases the chance that retry behavior diverges when phases change.  
**Suggestion:** Centralize the mapping behind a small local helper with a descriptive name, such as `retryResetMetricForStep(stepId)`, and keep `nextStepAttemptNumber` dependent on that abstraction instead of directly indexing the table.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Extract Supported Recovery Entrypoints
**Finding key:** loop-c2458aa895ee64ac5ca6
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R4  
**Issue:** `ExplicitRecoveryTransition.validate()` and `isStepTransition()` now both encode supported recovery entrypoints separately. This creates drift risk when adding future recovery entrypoints.  
**Suggestion:** Introduce a shared `SUPPORTED_RECOVERY_ENTRYPOINTS` `Set` using `RESET_SKIPPED_ENTRYPOINT`, `"impl-repair-invalidation"`, and `PREIMPLEMENTATION_BOOTSTRAP_ENTRYPOINT`, then reuse it in `isStepTransition()` and validation dispatch where appropriate.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R4  
**Issue:** `ExplicitRecoveryTransition.validate()` and `isStepTransition()` now both encode supported recovery entrypoints separately. This creates drift risk when adding future recovery entrypoints.  
**Suggestion:** Introduce a shared `SUPPORTED_RECOVERY_ENTRYPOINTS` `Set` using `RESET_SKIPPED_ENTRYPOINT`, `"impl-repair-invalidation"`, and `PREIMPLEMENTATION_BOOTSTRAP_ENTRYPOINT`, then reuse it in `isStepTransition()` and validation dispatch where appropriate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Move Bootstrap Expected Changes To Module Constant
**Finding key:** loop-3a1651f3874a4783eacc
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R5  
**Issue:** The expected preimplementation bootstrap transition `Map` is recreated every time validation runs, even though it is static policy data.  
**Suggestion:** Define a module-level constant such as `PREIMPLEMENTATION_BOOTSTRAP_EXPECTED_CHANGES`, then reference it from `validate()`. This makes the policy easier to scan and avoids repeated allocation.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R5  
**Issue:** The expected preimplementation bootstrap transition `Map` is recreated every time validation runs, even though it is static policy data.  
**Suggestion:** Define a module-level constant such as `PREIMPLEMENTATION_BOOTSTRAP_EXPECTED_CHANGES`, then reference it from `validate()`. This makes the policy easier to scan and avoids repeated allocation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Name Bootstrap Transition Policy More Specifically
**Finding key:** loop-b0e9d583d97de9f27c42
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R2  
**Issue:** The local variable name `expected` is generic and does not communicate that it encodes required current/requested status pairs for this specific recovery entrypoint.  
**Suggestion:** Rename it to something like `requiredBootstrapTransitions` or `PREIMPLEMENTATION_BOOTSTRAP_EXPECTED_CHANGES` if extracted to module scope.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`  
**Requirement:** R2  
**Issue:** The local variable name `expected` is generic and does not communicate that it encodes required current/requested status pairs for this specific recovery entrypoint.  
**Suggestion:** Rename it to something like `requiredBootstrapTransitions` or `PREIMPLEMENTATION_BOOTSTRAP_EXPECTED_CHANGES` if extracted to module scope.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Rename direct-child state to match exit semantics
**Finding key:** loop-30b36b3b4bc335c0a8e6
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R2
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R2  
**Issue:** `directChildClosed` is now set in `_handleExit`, before the child process `close` event has necessarily fired. The name implies stream closure, but the new behavior is specifically tracking direct process exit.  
**Suggestion:** Rename it to something like `directChildExited` and update the related checks in `_handleExit` and the exit-drain timer.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R2  
**Issue:** `directChildClosed` is now set in `_handleExit`, before the child process `close` event has necessarily fired. The name implies stream closure, but the new behavior is specifically tracking direct process exit.  
**Suggestion:** Rename it to something like `directChildExited` and update the related checks in `_handleExit` and the exit-drain timer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Avoid duplicated phase literal in replay test
**Finding key:** loop-0e738500f0edc674ccbc
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** `"draft-questions-review"` is now repeated in the test setup and assertion, so a typo or future rename would require updating multiple locations.  
**Suggestion:** Introduce a local constant, for example `const artifactPhase = "draft-questions-review";`, and use it in both `stage.artifactPhase` and the `producedArtifact.phase` assertion.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** `"draft-questions-review"` is now repeated in the test setup and assertion, so a typo or future rename would require updating multiple locations.  
**Suggestion:** Introduce a local constant, for example `const artifactPhase = "draft-questions-review";`, and use it in both `stage.artifactPhase` and the `producedArtifact.phase` assertion.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Strengthen the duplicate-proof assertion
**Finding key:** loop-274602e6d3291d717961
**Failure mode:** refactor
**File:** tests/unit/flow/finding-disposition-policy.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/finding-disposition-policy.test.js`  
**Requirement:** R6  
**Issue:** The new duplicate-proof test only checks `allowsPass() === false`. If the policy failed for an unrelated reason, the test could still pass while not actually verifying duplicate proof rejection.  
**Suggestion:** Assert the specific diagnostic or failure reason emitted for duplicate complete proofs, if available in the decision object. That keeps the test aligned with the behavior it names.
**Suggestion:** **File:** `tests/unit/flow/finding-disposition-policy.test.js`  
**Requirement:** R6  
**Issue:** The new duplicate-proof test only checks `allowsPass() === false`. If the policy failed for an unrelated reason, the test could still pass while not actually verifying duplicate proof rejection.  
**Suggestion:** Assert the specific diagnostic or failure reason emitted for duplicate complete proofs, if available in the decision object. That keeps the test aligned with the behavior it names.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Extract repeated task-gate state setup
**Finding key:** loop-01737415f134310c0a26
**Failure mode:** refactor
**File:** tests/unit/flow/get-next-action.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/get-next-action.test.js`  
**Requirement:** R6  
**Issue:** The new test builds a full active-flow state, manually sets `task-gate` in progress, injects `stepAttempts`, writes state, runs the CLI, and asserts the shared success envelope inline. This is likely to grow duplicated as more retry-reset/external-block cases are added.  
**Suggestion:** Extract a small helper in this test file, for example `setupTaskGateAttempt({ attemptRecordedAt, resetAt, outcome })`, and keep the individual test focused on the behavior being asserted.
**Suggestion:** **File:** `tests/unit/flow/get-next-action.test.js`  
**Requirement:** R6  
**Issue:** The new test builds a full active-flow state, manually sets `task-gate` in progress, injects `stepAttempts`, writes state, runs the CLI, and asserts the shared success envelope inline. This is likely to grow duplicated as more retry-reset/external-block cases are added.  
**Suggestion:** Extract a small helper in this test file, for example `setupTaskGateAttempt({ attemptRecordedAt, resetAt, outcome })`, and keep the individual test focused on the behavior being asserted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Use named timestamp constants for ordering semantics
**Finding key:** loop-cfd29f772c21e4cabe40
**Failure mode:** refactor
**File:** tests/unit/flow/get-next-action.test.js
**Requirement:** R6
**Issue:** **File:** `tests/unit/flow/get-next-action.test.js`  
**Requirement:** R6  
**Issue:** The test depends on the fact that the external block timestamp is before the audited retry reset timestamp, but that relationship is only visible by comparing string literals.  
**Suggestion:** Introduce local constants such as `const blockedBeforeResetAt = ...` and `const retryResetAt = ...`, then use those in the metric and `StepAttempt`. This makes the reset-ordering condition explicit and reduces the chance of accidentally reversing the dates later.
**Suggestion:** **File:** `tests/unit/flow/get-next-action.test.js`  
**Requirement:** R6  
**Issue:** The test depends on the fact that the external block timestamp is before the audited retry reset timestamp, but that relationship is only visible by comparing string literals.  
**Suggestion:** Introduce local constants such as `const blockedBeforeResetAt = ...` and `const retryResetAt = ...`, then use those in the metric and `StepAttempt`. This makes the reset-ordering condition explicit and reduces the chance of accidentally reversing the dates later.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Extract shared typed-finding fixture setup
**Finding key:** loop-2bc6c04032187abcd639
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R5  
**Issue:** The new draft-gate semantic and non-semantic tests duplicate most of the `classifyGateRetryExhaustionSource` input shape, differing only in `category` and `reason`.  
**Suggestion:** Add a small local helper such as `classifyDraftFinding(category, reason, extra = {})` or a `draftEvaluation(overrides)` fixture builder to reduce repetition and make the semantic/non-semantic distinction stand out.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R5  
**Issue:** The new draft-gate semantic and non-semantic tests duplicate most of the `classifyGateRetryExhaustionSource` input shape, differing only in `category` and `reason`.  
**Suggestion:** Add a small local helper such as `classifyDraftFinding(category, reason, extra = {})` or a `draftEvaluation(overrides)` fixture builder to reduce repetition and make the semantic/non-semantic distinction stand out.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Name the gate evidence recovery fixture around the expected failure
**Finding key:** loop-37b24845699e43f8d6f8
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The temp directory prefix still uses `set-step-impl-repair-gate-evidence-recovery-`, but the test was renamed to assert fail-closed behavior when canonical review evidence is missing. The fixture name now suggests successful recovery.  
**Suggestion:** Rename the prefix to something like `set-step-impl-repair-gate-evidence-fail-closed-` so the fixture naming matches the test’s behavior.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The temp directory prefix still uses `set-step-impl-repair-gate-evidence-recovery-`, but the test was renamed to assert fail-closed behavior when canonical review evidence is missing. The fixture name now suggests successful recovery.  
**Suggestion:** Rename the prefix to something like `set-step-impl-repair-gate-evidence-fail-closed-` so the fixture naming matches the test’s behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Avoid repeated `entries.at(-1)` lookups
**Finding key:** loop-685b285ca4cfe3c579ba
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The test repeatedly calls `issueLog.entries.at(-1)` for several assertions, which adds noise and makes failures slightly harder to read.  
**Suggestion:** Store the latest entry once, e.g. `const latestIssue = issueLog.entries.at(-1);`, then assert against `latestIssue.findingFingerprint`, `latestIssue.reviewedTree`, and `latestIssue.validatingTestResult.status`.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The test repeatedly calls `issueLog.entries.at(-1)` for several assertions, which adds noise and makes failures slightly harder to read.  
**Suggestion:** Store the latest entry once, e.g. `const latestIssue = issueLog.entries.at(-1);`, then assert against `latestIssue.findingFingerprint`, `latestIssue.reviewedTree`, and `latestIssue.validatingTestResult.status`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Avoid Real Process PID in Supervisor Test
**Finding key:** loop-4431700f9d1f970df2b0
**Failure mode:** refactor
**File:** tests/unit/lib/agent.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/lib/agent.test.js`  
**Requirement:** R5  
**Issue:** The test sets `child.pid = process.pid`, so if the supervisor timeout path is accidentally triggered by a future regression, the test could attempt to act on the current test runner process.  
**Suggestion:** Use an inert fake PID and stub any process-control behavior the supervisor expects, or omit `pid` if the tested path does not require it. For example, use a fake child object with explicit no-op `kill()` behavior instead of pointing at `process.pid`.
**Suggestion:** **File:** `tests/unit/lib/agent.test.js`  
**Requirement:** R5  
**Issue:** The test sets `child.pid = process.pid`, so if the supervisor timeout path is accidentally triggered by a future regression, the test could attempt to act on the current test runner process.  
**Suggestion:** Use an inert fake PID and stub any process-control behavior the supervisor expects, or omit `pid` if the tested path does not require it. For example, use a fake child object with explicit no-op `kill()` behavior instead of pointing at `process.pid`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Centralize Retry Reset Mapping
**Finding key:** loop-08db89befbff6ac9e9b0
**Failure mode:** refactor
**File:** src/flow/lib/step-outcome.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/step-outcome.js`
**Requirement:** R4
**Issue:** Retry reset phase/counter mapping appears to be introduced in multiple places: `step-outcome.js` maps steps to reset metrics, while `run-reopen-draft.js`, `get-next-action.js`, and `set-step.js` depend on related retry reset semantics. This creates cross-file drift risk when phases or counters change.
**Suggestion:** Move retry reset metadata behind one shared helper, for example `retryResetMetricForStep(stepId)` plus shared reset descriptors, and reuse it from attempt filtering, reset recording, and attempt numbering.
**Suggestion:** **File:** `src/flow/lib/step-outcome.js`
**Requirement:** R4
**Issue:** Retry reset phase/counter mapping appears to be introduced in multiple places: `step-outcome.js` maps steps to reset metrics, while `run-reopen-draft.js`, `get-next-action.js`, and `set-step.js` depend on related retry reset semantics. This creates cross-file drift risk when phases or counters change.
**Suggestion:** Move retry reset metadata behind one shared helper, for example `retryResetMetricForStep(stepId)` plus shared reset descriptors, and reuse it from attempt filtering, reset recording, and attempt numbering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Unify Review Phase Metadata
**Finding key:** loop-3f43287cdcbf1d7b09d9
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R1
**Issue:** Review phase normalization and artifact naming are handled separately across `run-review.js`, tests, and recovery logic. Proposals mention `sourceArtifactPhase()`, `REVIEW_SOURCE_ARTIFACT_BY_PHASE`, hardcoded `"draft-questions-review"`, and recovery active-step phase mapping. These are all encoding related phase identity rules independently.
**Suggestion:** Introduce a single review phase metadata table that provides artifact phase, canonical artifact name, and expected active step where applicable. Use it in `run-review.js`, `retry-recovery.js`, and tests.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R1
**Issue:** Review phase normalization and artifact naming are handled separately across `run-review.js`, tests, and recovery logic. Proposals mention `sourceArtifactPhase()`, `REVIEW_SOURCE_ARTIFACT_BY_PHASE`, hardcoded `"draft-questions-review"`, and recovery active-step phase mapping. These are all encoding related phase identity rules independently.
**Suggestion:** Introduce a single review phase metadata table that provides artifact phase, canonical artifact name, and expected active step where applicable. Use it in `run-review.js`, `retry-recovery.js`, and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Align Recovery Entrypoint Constants
**Finding key:** loop-8077cfc2b437bfa24892
**Failure mode:** refactor
**File:** src/flow/lib/step-transition-policy.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/step-transition-policy.js`
**Requirement:** R4
**Issue:** Recovery entrypoints and bootstrap semantics are referenced across `step-transition-policy.js`, `set-step.js`, and retry recovery logic, but the summaries show separate predicates, maps, and literal entrypoint handling. This can lead to inconsistent support for new recovery modes.
**Suggestion:** Define shared recovery entrypoint constants and policy helpers, such as `SUPPORTED_RECOVERY_ENTRYPOINTS` and bootstrap transition metadata, then consume them from transition validation and state predicates.
**Suggestion:** **File:** `src/flow/lib/step-transition-policy.js`
**Requirement:** R4
**Issue:** Recovery entrypoints and bootstrap semantics are referenced across `step-transition-policy.js`, `set-step.js`, and retry recovery logic, but the summaries show separate predicates, maps, and literal entrypoint handling. This can lead to inconsistent support for new recovery modes.
**Suggestion:** Define shared recovery entrypoint constants and policy helpers, such as `SUPPORTED_RECOVERY_ENTRYPOINTS` and bootstrap transition metadata, then consume them from transition validation and state predicates.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 4. Normalize Draft Semantic Recovery Naming
**Finding key:** loop-086fa8a093c3df9e0049
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R5
**Issue:** Draft semantic retry behavior is described with several overlapping names across files: `GATE_RECOVERY_PHASES`, inline semantic finding checks, semantic recovery dispositions, and draft deferral tests. Some names imply repair recovery while draft semantics appear to defer instead.
**Suggestion:** Rename shared concepts around the actual behavior, for example `GATE_RETRY_EXHAUSTION_PHASES` and `isDraftDeferrableSemanticFinding()`, and use the same terminology in `review-convergence.js` and retry exhaustion tests.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R5
**Issue:** Draft semantic retry behavior is described with several overlapping names across files: `GATE_RECOVERY_PHASES`, inline semantic finding checks, semantic recovery dispositions, and draft deferral tests. Some names imply repair recovery while draft semantics appear to defer instead.
**Suggestion:** Rename shared concepts around the actual behavior, for example `GATE_RETRY_EXHAUSTION_PHASES` and `isDraftDeferrableSemanticFinding()`, and use the same terminology in `review-convergence.js` and retry exhaustion tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 5. Standardize Process Exit Terminology
**Finding key:** loop-5b2c5ad9967fb4b7603d
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R2
**Issue:** **File:** `src/lib/agent.js`
**Requirement:** R2
**Issue:** The implementation uses `directChildClosed` for process exit semantics, while the related test exercises supervisor exit behavior. “Closed” and “exited” imply different lifecycle events, which can confuse future changes across implementation and tests.
**Suggestion:** Rename the state to `directChildExited` and update test names/assertions to use the same process-exit terminology.
**Suggestion:** **File:** `src/lib/agent.js`
**Requirement:** R2
**Issue:** The implementation uses `directChildClosed` for process exit semantics, while the related test exercises supervisor exit behavior. “Closed” and “exited” imply different lifecycle events, which can confuse future changes across implementation and tests.
**Suggestion:** Rename the state to `directChildExited` and update test names/assertions to use the same process-exit terminology.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
