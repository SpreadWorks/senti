# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Extract transaction rollback snapshot assertions
**Finding key:** loop-b9c3e6272db74252ff64
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R4
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The R4 failure tests repeat the same snapshot capture and rollback assertions for registry entries, flow JSON, acceptance-review, issue-log, and step statuses. This makes future rollback coverage harder to maintain and easier to update inconsistently.  
**Suggestion:** Add helpers such as `captureFlowTransactionSnapshot(context)` and `assertFlowTransactionUnchanged(context, snapshot, message)` and reuse them in both `"every binding and registry failure..."` and `"issue-log write failure..."`.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The R4 failure tests repeat the same snapshot capture and rollback assertions for registry entries, flow JSON, acceptance-review, issue-log, and step statuses. This makes future rollback coverage harder to maintain and easier to update inconsistently.  
**Suggestion:** Add helpers such as `captureFlowTransactionSnapshot(context)` and `assertFlowTransactionUnchanged(context, snapshot, message)` and reuse them in both `"every binding and registry failure..."` and `"issue-log write failure..."`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Replace stringly named failure-case branching
**Finding key:** loop-167dedeaa7f08a17af58
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R4
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The failure matrix uses `name === "registry revision conflict"` to decide whether to assert `postMutationObserved`. This couples test behavior to display text and makes renaming the case risky.  
**Suggestion:** Change each case object to include explicit metadata, for example `{ name, inject, expectedCode, expectedCalls, expectPostMutationObserved: true }`, and branch on that boolean.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The failure matrix uses `name === "registry revision conflict"` to decide whether to assert `postMutationObserved`. This couples test behavior to display text and makes renaming the case risky.  
**Suggestion:** Change each case object to include explicit metadata, for example `{ name, inject, expectedCode, expectedCalls, expectPostMutationObserved: true }`, and branch on that boolean.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Rename `registryFailureBoundary`
**Finding key:** loop-27c2f639b0c98e19e840
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R4
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** `registryFailureBoundary` is assigned the restore function and then used to inspect call counters. The name suggests a boundary or scenario, not a restore handle with instrumentation state.  
**Suggestion:** Rename it to something more direct, such as `instrumentedRestore` or `registryFailureProbe`.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** `registryFailureBoundary` is assigned the restore function and then used to inspect call counters. The name suggests a boundary or scenario, not a restore handle with instrumentation state.  
**Suggestion:** Rename it to something more direct, such as `instrumentedRestore` or `registryFailureProbe`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Extract flow-path normalization in review target resolution
**Finding key:** loop-aaa4009f1818f1c07b74
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** `String(...).split(path.sep).join("/")` is repeated for `flow.spec` and untracked file paths. The intent is POSIX-style normalization for git paths, but the repeated expression obscures the filtering rules.  
**Suggestion:** Add a small local helper, for example `toGitPath(value)`, and use it for `specDir` and `normalized`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** `String(...).split(path.sep).join("/")` is repeated for `flow.spec` and untracked file paths. The intent is POSIX-style normalization for git paths, but the repeated expression obscures the filtering rules.  
**Suggestion:** Add a small local helper, for example `toGitPath(value)`, and use it for `specDir` and `normalized`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 5. Avoid parsing diff headers when file list is already available
**Finding key:** loop-fc0b24b9d3c542cf869d
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** `collectDiffFilePaths()` infers untracked files by regex-parsing generated diff text. That duplicates information likely known while building the untracked diff and is brittle if diff headers change, include quoting, or represent unusual paths.  
**Suggestion:** Prefer returning `{ diff, files }` from `collectUntrackedDiff` if that API can be extended within this change set. If not, at least rename `collectDiffFilePaths` to `collectGitDiffNewPaths` and document that it only supports standard `diff --git a/... b/...` headers.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** `collectDiffFilePaths()` infers untracked files by regex-parsing generated diff text. That duplicates information likely known while building the untracked diff and is brittle if diff headers change, include quoting, or represent unusual paths.  
**Suggestion:** Prefer returning `{ diff, files }` from `collectUntrackedDiff` if that API can be extended within this change set. If not, at least rename `collectDiffFilePaths` to `collectGitDiffNewPaths` and document that it only supports standard `diff --git a/... b/...` headers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 6. Simplify scoped tracked diff fallback
**Finding key:** loop-88c49185fa8e263521c4
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** `trackedDiff` is initialized as an empty string, conditionally assigned from scoped diffs, then filled by fallback logic. The control flow is correct but slightly indirect.  
**Suggestion:** Extract the scoped diff collection into a helper like `collectScopedReviewDiff(root, mergeBase, scopeFiles)` and then use `const trackedDiff = scopedDiff || collectCommittedAndStagedDiff(...).join("\n");`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** `trackedDiff` is initialized as an empty string, conditionally assigned from scoped diffs, then filled by fallback logic. The control flow is correct but slightly indirect.  
**Suggestion:** Extract the scoped diff collection into a helper like `collectScopedReviewDiff(root, mergeBase, scopeFiles)` and then use `const trackedDiff = scopedDiff || collectCommittedAndStagedDiff(...).join("\n");`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 6. Name Rejected Reset Steps by Lifecycle Context
**Finding key:** loop-0d2fe876e645cca7f306
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R6
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R6  
**Issue:** `REJECTED_IMPL_REVIEW_RESET_STEPS` is technically accurate but broad; it does not indicate these steps are reset specifically during flow-scoped impl-review rejection handling.  
**Suggestion:** Rename it to something more contextual, such as `FLOW_SCOPED_REJECTED_IMPL_REVIEW_RESET_STEPS`, to match the branch where it is used and reduce ambiguity if more rejection reset paths are added later.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R6  
**Issue:** `REJECTED_IMPL_REVIEW_RESET_STEPS` is technically accurate but broad; it does not indicate these steps are reset specifically during flow-scoped impl-review rejection handling.  
**Suggestion:** Rename it to something more contextual, such as `FLOW_SCOPED_REJECTED_IMPL_REVIEW_RESET_STEPS`, to match the branch where it is used and reduce ambiguity if more rejection reset paths are added later.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Consolidate Registry Entry Key Comparison
**Finding key:** loop-2c68ab87ff6e305553ca
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `AcceptanceDecisionRegistrySnapshot` builds sorted entry-key arrays in both the constructor and `verify()`, duplicating comparison setup logic.  
**Suggestion:** Extract a small helper such as `registryEntryKeys(entries)` and use it in both places. This keeps the preservation check easier to audit and reduces drift risk if the key format changes.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `AcceptanceDecisionRegistrySnapshot` builds sorted entry-key arrays in both the constructor and `verify()`, duplicating comparison setup logic.  
**Suggestion:** Extract a small helper such as `registryEntryKeys(entries)` and use it in both places. This keeps the preservation check easier to audit and reduces drift risk if the key format changes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Rename Ambiguous Registry Snapshot Variables
**Finding key:** loop-1d644270e4f228248ae5
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `registrySnapshot` is used both for the captured pre-operation snapshot and for the fresh snapshot inside `verify()`, which makes the before/after registry preservation logic harder to follow.  
**Suggestion:** Rename the constructor field input to `beforeRegistrySnapshot` or `capturedRegistrySnapshot`, and the `verify()` local to `afterRegistrySnapshot`.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R2  
**Issue:** `registrySnapshot` is used both for the captured pre-operation snapshot and for the fresh snapshot inside `verify()`, which makes the before/after registry preservation logic harder to follow.  
**Suggestion:** Rename the constructor field input to `beforeRegistrySnapshot` or `capturedRegistrySnapshot`, and the `verify()` local to `afterRegistrySnapshot`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Simplify Rollback Error Accumulation
**Finding key:** loop-b3414a0fb9b4c138ae4f
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `appendRollbackError()` nests `AggregateError` instances when multiple rollback steps fail, which makes the resulting error shape unnecessarily hard to inspect.  
**Suggestion:** Accumulate rollback failures in an array, then throw a single `AggregateError([error, ...rollbackErrors], ...)` if any rollback step fails.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `appendRollbackError()` nests `AggregateError` instances when multiple rollback steps fail, which makes the resulting error shape unnecessarily hard to inspect.  
**Suggestion:** Accumulate rollback failures in an array, then throw a single `AggregateError([error, ...rollbackErrors], ...)` if any rollback step fails.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Extract Acceptance Decision State Mutation
**Finding key:** loop-d2c4b7b8056988747583
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** The state transition logic inside `applyAcceptanceDecision()` is embedded in a larger function that also handles artifact writing, registry verification, issue-log rollback, and exact-target mutation.  
**Suggestion:** Extract the mutation body into a helper like `applyAcceptanceDecisionState(current, { decidedArtifact, userDecision, choice })`. This makes the lifecycle transition easier to test and keeps `applyAcceptanceDecision()` focused on orchestration.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R3  
**Issue:** The state transition logic inside `applyAcceptanceDecision()` is embedded in a larger function that also handles artifact writing, registry verification, issue-log rollback, and exact-target mutation.  
**Suggestion:** Extract the mutation body into a helper like `applyAcceptanceDecisionState(current, { decidedArtifact, userDecision, choice })`. This makes the lifecycle transition easier to test and keeps `applyAcceptanceDecision()` focused on orchestration.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 5. Avoid Re-validating Source Artifact Twice
**Finding key:** loop-21831e5b36c5b24e75aa
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** `CanonicalReviewEvidenceProjection` calls `requireString(record.canonicalEvidenceRef, "canonicalEvidenceRef")`, then `readCanonicalReviewEvidence()` calls `requireString()` again on the same value.  
**Suggestion:** Let `readCanonicalReviewEvidence()` own validation and remove the first `requireString()` call, or pass the already-normalized value into a lower-level helper. This trims redundant validation without changing behavior.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** `CanonicalReviewEvidenceProjection` calls `requireString(record.canonicalEvidenceRef, "canonicalEvidenceRef")`, then `readCanonicalReviewEvidence()` calls `requireString()` again on the same value.  
**Suggestion:** Let `readCanonicalReviewEvidence()` own validation and remove the first `requireString()` call, or pass the already-normalized value into a lower-level helper. This trims redundant validation without changing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Extract Shared Repair Transaction Assembly
**Finding key:** loop-655887baad1f8277c4e5
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `completeLateAppliedFindingRepair` appears to duplicate the existing repair flow pattern: read previous/current fingerprints, compute changed paths, build delta, create ledger entry, construct `ImplRepairTransaction`, plan step changes, apply `ExplicitRecoveryTransition`, then commit effects.  
**Suggestion:** Extract the common ledger/delta/transaction construction into a helper such as `buildImplRepairTransaction(...)`, with small strategy inputs for `sourceStep`, `sourceFindingIds`, and `reason`. That would make the “at most once” recovery behavior easier to audit and reduce drift between repair paths.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `completeLateAppliedFindingRepair` appears to duplicate the existing repair flow pattern: read previous/current fingerprints, compute changed paths, build delta, create ledger entry, construct `ImplRepairTransaction`, plan step changes, apply `ExplicitRecoveryTransition`, then commit effects.  
**Suggestion:** Extract the common ledger/delta/transaction construction into a helper such as `buildImplRepairTransaction(...)`, with small strategy inputs for `sourceStep`, `sourceFindingIds`, and `reason`. That would make the “at most once” recovery behavior easier to audit and reduce drift between repair paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Rename Prefix Constant To Match Behavior
**Finding key:** loop-40d67a97293d117e01fd
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `WORKFLOW_ARTIFACT_PATH_PREFIXES` includes `docs/` and `specs/`, which are broader than workflow artifact paths. The name understates what the filter excludes.  
**Suggestion:** Rename it to something behavior-focused, for example `NON_DURABLE_REPAIR_EVIDENCE_PREFIXES` or `REPAIR_EVIDENCE_EXCLUDED_PREFIXES`, so future readers do not accidentally treat docs/specs exclusions as incidental workflow cleanup.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `WORKFLOW_ARTIFACT_PATH_PREFIXES` includes `docs/` and `specs/`, which are broader than workflow artifact paths. The name understates what the filter excludes.  
**Suggestion:** Rename it to something behavior-focused, for example `NON_DURABLE_REPAIR_EVIDENCE_PREFIXES` or `REPAIR_EVIDENCE_EXCLUDED_PREFIXES`, so future readers do not accidentally treat docs/specs exclusions as incidental workflow cleanup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Bound Durable Evidence Search
**Finding key:** loop-87320de941964f1c86cb
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `repairEvidenceFile` scans `delta.changedPaths` with `.find(...)` without an explicit bound. The guardrail acknowledgment covers full snapshot comparison, but this is a later evidence-selection pass and currently has no local cap.  
**Suggestion:** Add an explicit upper bound for evidence candidate inspection, or persist a bounded durable-evidence candidate when creating the repair delta. If the full scan is intentionally required, add a matched rationale tied to this specific pass so the bounded-resource exception is explicit.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `repairEvidenceFile` scans `delta.changedPaths` with `.find(...)` without an explicit bound. The guardrail acknowledgment covers full snapshot comparison, but this is a later evidence-selection pass and currently has no local cap.  
**Suggestion:** Add an explicit upper bound for evidence candidate inspection, or persist a bounded durable-evidence candidate when creating the repair delta. If the full scan is intentionally required, add a matched rationale tied to this specific pass so the bounded-resource exception is explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 4. Add A Shared Attempt Exhaustion Helper
**Finding key:** loop-3316eb2d5604e4ab838e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `ReviewToolingRecoveryMutation.apply` and `ReviewSemanticRecoveryMutation.apply` both encode “attempts must be exhausted” checks with slightly different field names and error strings.  
**Suggestion:** Introduce a small helper such as `requireExhaustedAttempts(current, "tooling")` / `requireExhaustedAttempts(current, "semantic")`. This keeps recovery semantics consistent and makes the “exactly one re-evaluation” rule easier to verify.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `ReviewToolingRecoveryMutation.apply` and `ReviewSemanticRecoveryMutation.apply` both encode “attempts must be exhausted” checks with slightly different field names and error strings.  
**Suggestion:** Introduce a small helper such as `requireExhaustedAttempts(current, "tooling")` / `requireExhaustedAttempts(current, "semantic")`. This keeps recovery semantics consistent and makes the “exactly one re-evaluation” rule easier to verify.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Remove Dead Branch From Canonical Finding IDs
**Finding key:** loop-a4e6b4b7c533834f3c17
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R1
**Issue:** `canonicalFindingList` now always passes a phase/bucket/index ID into `canonicalFinding`, so `DRAFT_REPAIR_TARGET_PHASES.has(phase)` is no longer used in this function. If that phase gate is no longer needed anywhere else, the related import/constant usage may now be dead or misleading in this file.
**Suggestion:** Remove the obsolete `DRAFT_REPAIR_TARGET_PHASES` dependency from this path, or restore the conditional if non-draft phases must still collapse to `"review-finding"`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R1
**Issue:** `canonicalFindingList` now always passes a phase/bucket/index ID into `canonicalFinding`, so `DRAFT_REPAIR_TARGET_PHASES.has(phase)` is no longer used in this function. If that phase gate is no longer needed anywhere else, the related import/constant usage may now be dead or misleading in this file.
**Suggestion:** Remove the obsolete `DRAFT_REPAIR_TARGET_PHASES` dependency from this path, or restore the conditional if non-draft phases must still collapse to `"review-finding"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Extract Scenario Process Aggregation
**Finding key:** loop-af505c037396c80dfd71
**Failure mode:** refactor
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-scenario-validity.js`
**Requirement:** R2
**Issue:** The construction of `scenarioProcess` is a sizable inline block inside `execute`, and it now sits inside a larger baseline/worktree control flow. This makes the main command harder to scan and repeats low-level aggregation concerns there.
**Suggestion:** Move the aggregation into a helper such as `buildScenarioValidityProcessSummary(fileRecords)`, returning the existing `{ started, exitCode, signal, timedOut, spawnError, stdout, stderr }` object.
**Suggestion:** **File:** `src/flow/lib/run-scenario-validity.js`
**Requirement:** R2
**Issue:** The construction of `scenarioProcess` is a sizable inline block inside `execute`, and it now sits inside a larger baseline/worktree control flow. This makes the main command harder to scan and repeats low-level aggregation concerns there.
**Suggestion:** Move the aggregation into a helper such as `buildScenarioValidityProcessSummary(fileRecords)`, returning the existing `{ started, exitCode, signal, timedOut, spawnError, stdout, stderr }` object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Extract Artifact Output Assembly
**Finding key:** loop-b3065e73ee4cb2c584e7
**Failure mode:** refactor
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-scenario-validity.js`
**Requirement:** R3
**Issue:** The artifact and command output objects are built inline in the middle of execution logic. The try/finally baseline addition increased indentation and makes the persistence/result-shaping code harder to distinguish from test execution.
**Suggestion:** Extract helpers like `buildScenarioValidityArtifact(...)` and `buildScenarioValidityOutput(...)` to keep `execute` focused on orchestration while preserving the existing object shapes.
**Suggestion:** **File:** `src/flow/lib/run-scenario-validity.js`
**Requirement:** R3
**Issue:** The artifact and command output objects are built inline in the middle of execution logic. The try/finally baseline addition increased indentation and makes the persistence/result-shaping code harder to distinguish from test execution.
**Suggestion:** Extract helpers like `buildScenarioValidityArtifact(...)` and `buildScenarioValidityOutput(...)` to keep `execute` focused on orchestration while preserving the existing object shapes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 4. Improve Baseline Worktree Naming
**Finding key:** loop-9a8201a58ba11a1e1b80
**Failure mode:** refactor
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-scenario-validity.js`
**Requirement:** R4
**Issue:** `BaselineScenarioWorktree` is understandable but slightly ambiguous: it manages lifecycle and copies selected inputs, not just representing a worktree. The `added` flag is also vague outside the implementation detail.
**Suggestion:** Rename to something more explicit like `ScenarioValidityBaselineWorktree`, and rename `added` to `worktreeAdded` or `created` so cleanup state is clear.
**Suggestion:** **File:** `src/flow/lib/run-scenario-validity.js`
**Requirement:** R4
**Issue:** `BaselineScenarioWorktree` is understandable but slightly ambiguous: it manages lifecycle and copies selected inputs, not just representing a worktree. The `added` flag is also vague outside the implementation detail.
**Suggestion:** Rename to something more explicit like `ScenarioValidityBaselineWorktree`, and rename `added` to `worktreeAdded` or `created` so cleanup state is clear.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 5. Bound Baseline Input Copy Size
**Finding key:** loop-b16909dafa60ae888b69
**Failure mode:** refactor
**File:** src/flow/lib/run-scenario-validity.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-scenario-validity.js`
**Requirement:** R5
**Issue:** `BaselineScenarioWorktree.create()` copies every path in `inputPaths` without an explicit bound. The matched rationale acknowledges an unbounded active-flow snapshot comparison, but this change introduces separate bulk file copying for scenario validity inputs and is not covered by that rationale.
**Suggestion:** Add an explicit maximum number of copied inputs or validate against an existing project-level cap before iterating `inputPaths`, failing with a clear error if exceeded.
**Suggestion:** **File:** `src/flow/lib/run-scenario-validity.js`
**Requirement:** R5
**Issue:** `BaselineScenarioWorktree.create()` copies every path in `inputPaths` without an explicit bound. The matched rationale acknowledges an unbounded active-flow snapshot comparison, but this change introduces separate bulk file copying for scenario validity inputs and is not covered by that rationale.
**Suggestion:** Add an explicit maximum number of copied inputs or validate against an existing project-level cap before iterating `inputPaths`, failing with a clear error if exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Extract shared repair-ledger finding collection
**Finding key:** loop-d23c8ab40033c4068af5
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `readImplRepairLedger(specDir)` plus `entries.flatMap((entry) => entry.sourceFindingIds)` is duplicated in both recovery paths.  
**Suggestion:** Add a small helper like `repairedFindingIds(specDir)` or `ledgerSourceFindingIdSet(specDir)` and reuse it in `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `readImplRepairLedger(specDir)` plus `entries.flatMap((entry) => entry.sourceFindingIds)` is duplicated in both recovery paths.  
**Suggestion:** Add a small helper like `repairedFindingIds(specDir)` or `ledgerSourceFindingIdSet(specDir)` and reuse it in `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Add bounded issue-log scanning
**Finding key:** loop-59f2c26d2ed53069ecc7
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `loadIssueLog(root, state.spec).entries` scans every issue-log entry without an explicit upper bound. The acknowledgment rationale covers full comparison of one active-flow registry snapshot, but this is a different artifact and remains unbounded.  
**Suggestion:** Restrict the scan to the relevant current run/attempt if available, or add an explicit maximum number of recent issue-log entries to inspect before matching `MISSING_REPAIR_EVIDENCE_REASON`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `loadIssueLog(root, state.spec).entries` scans every issue-log entry without an explicit upper bound. The acknowledgment rationale covers full comparison of one active-flow registry snapshot, but this is a different artifact and remains unbounded.  
**Suggestion:** Restrict the scan to the relevant current run/attempt if available, or add an explicit maximum number of recent issue-log entries to inspect before matching `MISSING_REPAIR_EVIDENCE_REASON`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Simplify nested fallback error handling
**Finding key:** loop-82c8b3a59d63a04ca531
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `validateBlockedImplRepairRecovery` uses nested `try/catch` blocks to attempt triage-based recovery and then gate-observed recovery, which makes the fallback flow harder to read.  
**Suggestion:** Split the two strategies into an ordered list of resolver functions and collect their failure messages in a loop, returning the first success. This keeps the “try current triage, then gate observation” design explicit.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `validateBlockedImplRepairRecovery` uses nested `try/catch` blocks to attempt triage-based recovery and then gate-observed recovery, which makes the fallback flow harder to read.  
**Suggestion:** Split the two strategies into an ordered list of resolver functions and collect their failure messages in a loop, returning the first success. This keeps the “try current triage, then gate observation” design explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Use artifact read helpers for JSON files
**Finding key:** loop-1e1fda8d4ee1913ab3c7
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** The new recovery code manually repeats `JSON.parse(fs.readFileSync(path.join(specDir, ...), "utf8"))` for multiple artifacts.  
**Suggestion:** Introduce a local helper such as `readSpecJson(specDir, artifactName)` in this file, or reuse an existing artifact reader if one is already imported in this file’s dependency set. This reduces boilerplate and gives parse/read failures a consistent error shape.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** The new recovery code manually repeats `JSON.parse(fs.readFileSync(path.join(specDir, ...), "utf8"))` for multiple artifacts.  
**Suggestion:** Introduce a local helper such as `readSpecJson(specDir, artifactName)` in this file, or reuse an existing artifact reader if one is already imported in this file’s dependency set. This reduces boilerplate and gives parse/read failures a consistent error shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Rename recovery predicates for clarity
**Finding key:** loop-5ddb8c41ed93b32e7281
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** Names like `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds` describe the returned data, but not that they validate and throw on invalid recovery states.  
**Suggestion:** Rename them to make side effects clearer, for example `resolveCurrentAppliedRecoveryFindingIds` and `resolveGateObservedRecoveryFindingIds`, or split validation from collection.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** Names like `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds` describe the returned data, but not that they validate and throw on invalid recovery states.  
**Suggestion:** Rename them to make side effects clearer, for example `resolveCurrentAppliedRecoveryFindingIds` and `resolveGateObservedRecoveryFindingIds`, or split validation from collection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 3. Simplify Snapshot Entry Normalization
**Finding key:** loop-ede1aae629e16d9c7151
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R2  
**Issue:** `ActiveFlowRegistrySnapshot` normalizes entries through `toJSON()`, then `toJSON()` later clones those plain objects again. This creates two similar serialization paths and makes the snapshot representation less obvious.  
**Suggestion:** Add a local helper such as `snapshotEntry(entry)` or `freezeEntry(entry)` and use it to make the constructor’s intent explicit. For example, normalize once to a plain object, freeze that object, and have `toJSON()` only perform the outward clone.
**Suggestion:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R2  
**Issue:** `ActiveFlowRegistrySnapshot` normalizes entries through `toJSON()`, then `toJSON()` later clones those plain objects again. This creates two similar serialization paths and makes the snapshot representation less obvious.  
**Suggestion:** Add a local helper such as `snapshotEntry(entry)` or `freezeEntry(entry)` and use it to make the constructor’s intent explicit. For example, normalize once to a plain object, freeze that object, and have `toJSON()` only perform the outward clone.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Consolidate Exact Target Validation
**Finding key:** loop-919fa19c39fef15a21a1
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** The validation for an exact `FlowTargetExpectation` with a spec is duplicated in `CapturedFlowTargetMutation` and `FlowManager.captureExactTarget()`, with a slightly weaker variant in `mutateExactTarget()`. This makes future changes to target validation easy to miss.  
**Suggestion:** Extract a small helper such as `assertExactFlowTargetWithSpec(expectation, message)` and use it in all three places. If `mutateExactTarget()` also requires `expectation.spec` because `#mutateCapturedTarget()` passes it as `specId`, enforce that consistently there too.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** The validation for an exact `FlowTargetExpectation` with a spec is duplicated in `CapturedFlowTargetMutation` and `FlowManager.captureExactTarget()`, with a slightly weaker variant in `mutateExactTarget()`. This makes future changes to target validation easy to miss.  
**Suggestion:** Extract a small helper such as `assertExactFlowTargetWithSpec(expectation, message)` and use it in all three places. If `mutateExactTarget()` also requires `expectation.spec` because `#mutateCapturedTarget()` passes it as `specId`, enforce that consistently there too.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Avoid Keeping A Mutable Expectation Reference
**Finding key:** loop-72f05b79efc57f29d346
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R3
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` freezes the wrapper object, but it stores the original `expectation` reference. If `FlowTargetExpectation` instances are mutable, the captured target can change after capture, weakening the “captured exact target” design.  
**Suggestion:** Store an immutable copy or snapshot of the expected identity fields needed for `mismatchAgainst()` and `specId`, or explicitly freeze/copy the expectation when captured.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `CapturedFlowTargetMutation` freezes the wrapper object, but it stores the original `expectation` reference. If `FlowTargetExpectation` instances are mutable, the captured target can change after capture, weakening the “captured exact target” design.  
**Suggestion:** Store an immutable copy or snapshot of the expected identity fields needed for `mismatchAgainst()` and `specId`, or explicitly freeze/copy the expectation when captured.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Consider Naming `snapshotActiveFlows` More Explicitly
**Finding key:** loop-14b864536db93cb79279
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R2  
**Issue:** `snapshotActiveFlows()` is a thin pass-through to the registry snapshot, but the name does not indicate that it acquires the registry mutation lock and includes a revision. That behavior matters for the acceptance-decision registry preservation checks.  
**Suggestion:** Rename it to something more precise, such as `snapshotActiveFlowRegistry()` or `lockedActiveFlowRegistrySnapshot()`, if this matches existing naming conventions.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R2  
**Issue:** `snapshotActiveFlows()` is a thin pass-through to the registry snapshot, but the name does not indicate that it acquires the registry mutation lock and includes a revision. That behavior matters for the acceptance-decision registry preservation checks.  
**Suggestion:** Rename it to something more precise, such as `snapshotActiveFlowRegistry()` or `lockedActiveFlowRegistrySnapshot()`, if this matches existing naming conventions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Extract Minimal Spec Fixture Creation
**Finding key:** loop-40741380635fd160119c
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The new `resolveReviewTarget` test inlines a full minimal `spec.json` object, which is verbose and likely to be repeated by future tests covering spec-local files.  
**Suggestion:** Add a small local helper such as `writeMinimalSpec(tmp, "specs/demo/spec.json", overrides)` or reuse an existing fixture helper if present in this file. Keep the test focused on the untracked test-source behavior.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The new `resolveReviewTarget` test inlines a full minimal `spec.json` object, which is verbose and likely to be repeated by future tests covering spec-local files.  
**Suggestion:** Add a small local helper such as `writeMinimalSpec(tmp, "specs/demo/spec.json", overrides)` or reuse an existing fixture helper if present in this file. Keep the test focused on the untracked test-source behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Rename Passing Evidence Fixture
**Finding key:** loop-d629feeddd797c93b4f6
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R2  
**Issue:** `advisoryEvidence` has `disposition.value: "PASS"`, so the name suggests advisory findings even though the fixture represents a later superseding passing review.  
**Suggestion:** Rename it to `passingEvidence`, `replacementEvidence`, or `supersedingPassEvidence` to match the role it plays in the test.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R2  
**Issue:** `advisoryEvidence` has `disposition.value: "PASS"`, so the name suggests advisory findings even though the fixture represents a later superseding passing review.  
**Suggestion:** Rename it to `passingEvidence`, `replacementEvidence`, or `supersedingPassEvidence` to match the role it plays in the test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Extract Review Evidence Fixture Boilerplate
**Finding key:** loop-d9bc0cb3bf074c7687f5
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R3  
**Issue:** The new test repeats substantial `ReviewEvidence` construction and artifact writing boilerplate. This makes the behavior under test harder to see.  
**Suggestion:** Introduce a local helper such as `makeImplReviewEvidence({ treeSha, invocationId, capturedAt, disposition })` and optionally `writeReviewEvidence(fixture.specDir, evidence)`. The test would then emphasize the deferred-finding resolution scenario instead of setup mechanics.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R3  
**Issue:** The new test repeats substantial `ReviewEvidence` construction and artifact writing boilerplate. This makes the behavior under test harder to see.  
**Suggestion:** Introduce a local helper such as `makeImplReviewEvidence({ treeSha, invocationId, capturedAt, disposition })` and optionally `writeReviewEvidence(fixture.specDir, evidence)`. The test would then emphasize the deferred-finding resolution scenario instead of setup mechanics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Extract Shared Review Convergence Fixture Setup
**Finding key:** loop-4ecacfadde582f3b7259
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** The new test repeats a large amount of setup for review convergence state, temporary spec creation, baseline persistence, and flow manager creation. This makes future convergence tests harder to scan and maintain.  
**Suggestion:** Extract focused helpers such as `createReviewConvergenceState(...)` or `setupReviewRecoveryBaseline(...)` within this test file, keeping only the scenario-specific values in the test body.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** The new test repeats a large amount of setup for review convergence state, temporary spec creation, baseline persistence, and flow manager creation. This makes future convergence tests harder to scan and maintain.  
**Suggestion:** Extract focused helpers such as `createReviewConvergenceState(...)` or `setupReviewRecoveryBaseline(...)` within this test file, keeping only the scenario-specific values in the test body.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Rename `priorStatuses` to Match Step IDs
**Finding key:** loop-c21d22a304bedbe4991d
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** `priorStatuses` uses camelCase keys like `implRepair` and `implGate`, while the actual step IDs are kebab-case strings: `impl-repair` and `impl-gate`. This creates a small translation layer that is easy to misuse.  
**Suggestion:** Rename the argument to something like `initialStepStatusesById` and access it with step IDs: `initialStepStatusesById["impl-repair"] || "pending"`.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** `priorStatuses` uses camelCase keys like `implRepair` and `implGate`, while the actual step IDs are kebab-case strings: `impl-repair` and `impl-gate`. This creates a small translation layer that is easy to misuse.  
**Suggestion:** Rename the argument to something like `initialStepStatusesById` and access it with step IDs: `initialStepStatusesById["impl-repair"] || "pending"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Simplify `updatesFor` Return Shape or Split Assertions
**Finding key:** loop-8988ae1f04e79dd764fa
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** `updatesFor` now returns `{ updates, flowState }`, but most callers only need `updates`. This adds noise to the existing PASS and ADVISORY assertions.  
**Suggestion:** Either keep `updatesFor` returning only updates and add a second helper for scenarios that need final state inspection, or rename it to reflect the broader return value, such as `runPostHookScenario`.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R5  
**Issue:** `updatesFor` now returns `{ updates, flowState }`, but most callers only need `updates`. This adds noise to the existing PASS and ADVISORY assertions.  
**Suggestion:** Either keep `updatesFor` returning only updates and add a second helper for scenarios that need final state inspection, or rename it to reflect the broader return value, such as `runPostHookScenario`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Avoid Inline `flowManager` Mock Drift
**Finding key:** loop-dcd19a2726544b48e7b9
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R4  
**Issue:** The inline `flowManager` test double now implements both `mutate` and `updateStepStatus`. As post-hook behavior grows, this mock can drift from the real manager contract across tests.  
**Suggestion:** Extract a local helper like `makeRecordingFlowManager(flowState, updates)` in this file so the mocked behavior is centralized and easier to update consistently.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R4  
**Issue:** The inline `flowManager` test double now implements both `mutate` and `updateStepStatus`. As post-hook behavior grows, this mock can drift from the real manager contract across tests.  
**Suggestion:** Extract a local helper like `makeRecordingFlowManager(flowState, updates)` in this file so the mocked behavior is centralized and easier to update consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 1. Extract shared blocked-gate fixture setup
**Finding key:** loop-7839768695e213fb6f44
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The two new recovery tests duplicate the same fixture setup: temp spec, initial target file, previous fingerprint, `impl-review.json`, triage artifact, test artifacts, and post-repair target write.  
**Suggestion:** Introduce a local helper such as `prepareBlockedGateRepairFixture(tmp)` returning `{ specDir, previousFingerprint }`. This would reduce duplication and make the scenario-specific parts of each test easier to read.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The two new recovery tests duplicate the same fixture setup: temp spec, initial target file, previous fingerprint, `impl-review.json`, triage artifact, test artifacts, and post-repair target write.  
**Suggestion:** Introduce a local helper such as `prepareBlockedGateRepairFixture(tmp)` returning `{ specDir, previousFingerprint }`. This would reduce duplication and make the scenario-specific parts of each test easier to read.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 2. Extract fake flow manager creation
**Finding key:** loop-d2a61aed692628bc14ec
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** Both new tests define similar in-memory `flowManager` objects, including repeated transition application logic that mutates step statuses.  
**Suggestion:** Add a helper like `makeTestFlowManager(state, { transitions } = {})` that implements `load`, `loadReadOnly`, `updateStepStatuses`, and optional intent completion hooks. This keeps the tests focused on behavior instead of repeated harness mechanics.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** Both new tests define similar in-memory `flowManager` objects, including repeated transition application logic that mutates step statuses.  
**Suggestion:** Add a helper like `makeTestFlowManager(state, { transitions } = {})` that implements `load`, `loadReadOnly`, `updateStepStatuses`, and optional intent completion hooks. This keeps the tests focused on behavior instead of repeated harness mechanics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 3. Use clearer finding id naming
**Finding key:** loop-0eb2d74946ef2b06fbaa
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `GATE_FINDING_ID` is technically correct, but the tests specifically depend on a 64-character normalized finding id. That important detail is hidden behind a generic name.  
**Suggestion:** Rename it to something more explicit, such as `NORMALIZED_GATE_FINDING_ID` or `VALID_SHA_FINDING_ID`, so future readers understand why `"a".repeat(64)` is used.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `GATE_FINDING_ID` is technically correct, but the tests specifically depend on a 64-character normalized finding id. That important detail is hidden behind a generic name.  
**Suggestion:** Rename it to something more explicit, such as `NORMALIZED_GATE_FINDING_ID` or `VALID_SHA_FINDING_ID`, so future readers understand why `"a".repeat(64)` is used.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 4. Avoid real-time timestamps in deterministic tests
**Finding key:** loop-8c08e628026bd4802f3f
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The second new test writes `new Date().toISOString()` into `issue-log.json`. The value is not relevant to the assertion and makes the fixture nondeterministic.  
**Suggestion:** Replace it with a fixed timestamp constant, for example `"2026-01-01T00:00:00.000Z"`, to keep the test data stable and easier to snapshot or debug.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The second new test writes `new Date().toISOString()` into `issue-log.json`. The value is not relevant to the assertion and makes the fixture nondeterministic.  
**Suggestion:** Replace it with a fixed timestamp constant, for example `"2026-01-01T00:00:00.000Z"`, to keep the test data stable and easier to snapshot or debug.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 1. Consolidate Impl-Repair Recovery Transaction Logic
**Finding key:** loop-970bd1fe3b1b51e2ee88
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** Multiple files now describe duplicated impl-repair recovery concerns: `completeLateAppliedFindingRepair` repeats transaction assembly in `impl-repair-artifacts.js`, while `set-step.js` independently reads repair ledgers and resolves repaired finding IDs. This risks drift between the artifact-producing repair path and the recovery-validation path.  
**Suggestion:** Introduce shared helpers for repair ledger/finding collection and repair transaction construction, then have both `impl-repair-artifacts.js` and `set-step.js` consume those helpers instead of reimplementing adjacent recovery logic.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** Multiple files now describe duplicated impl-repair recovery concerns: `completeLateAppliedFindingRepair` repeats transaction assembly in `impl-repair-artifacts.js`, while `set-step.js` independently reads repair ledgers and resolves repaired finding IDs. This risks drift between the artifact-producing repair path and the recovery-validation path.  
**Suggestion:** Introduce shared helpers for repair ledger/finding collection and repair transaction construction, then have both `impl-repair-artifacts.js` and `set-step.js` consume those helpers instead of reimplementing adjacent recovery logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 2. Align Registry Snapshot Naming Across Manager And Artifact Layers
**Finding key:** loop-6f7c0167cdf4054a2d05
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R2
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R2  
**Issue:** Registry snapshot concepts are named inconsistently across files: `snapshotActiveFlows()` in `flow-manager.js`, `ActiveFlowRegistrySnapshot` in `active-flow-registry.js`, and `AcceptanceDecisionRegistrySnapshot` in `acceptance-review-artifacts.js`. The manager method name hides that callers receive a locked active-flow registry snapshot with revision semantics.  
**Suggestion:** Rename the manager method toward the registry terminology, such as `snapshotActiveFlowRegistry()` or `lockedActiveFlowRegistrySnapshot()`, and use matching before/after snapshot variable names in acceptance-review preservation checks.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R2  
**Issue:** Registry snapshot concepts are named inconsistently across files: `snapshotActiveFlows()` in `flow-manager.js`, `ActiveFlowRegistrySnapshot` in `active-flow-registry.js`, and `AcceptanceDecisionRegistrySnapshot` in `acceptance-review-artifacts.js`. The manager method name hides that callers receive a locked active-flow registry snapshot with revision semantics.  
**Suggestion:** Rename the manager method toward the registry terminology, such as `snapshotActiveFlowRegistry()` or `lockedActiveFlowRegistrySnapshot()`, and use matching before/after snapshot variable names in acceptance-review preservation checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 3. Centralize Acceptance Transaction Rollback Assertions
**Finding key:** loop-f80e1443f8d9b62650b7
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R4
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** Rollback preservation is implemented in production through acceptance-review artifact snapshots, while the acceptance tests duplicate detailed snapshot capture and comparison logic across registry entries, flow JSON, review artifacts, issue logs, and step statuses. The test helper proposal mirrors production concepts but remains file-local, increasing the chance that test coverage and implementation invariants evolve separately.  
**Suggestion:** Add a shared test helper named around the production invariant, for example `captureAcceptanceTransactionSnapshot()` and `assertAcceptanceTransactionUnchanged()`, and keep its terminology aligned with `AcceptanceDecisionRegistrySnapshot`.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** Rollback preservation is implemented in production through acceptance-review artifact snapshots, while the acceptance tests duplicate detailed snapshot capture and comparison logic across registry entries, flow JSON, review artifacts, issue logs, and step statuses. The test helper proposal mirrors production concepts but remains file-local, increasing the chance that test coverage and implementation invariants evolve separately.  
**Suggestion:** Add a shared test helper named around the production invariant, for example `captureAcceptanceTransactionSnapshot()` and `assertAcceptanceTransactionUnchanged()`, and keep its terminology aligned with `AcceptanceDecisionRegistrySnapshot`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 4. Standardize Flow Step Status Map Keys
**Finding key:** loop-21655bfbb1cc38695b31
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** Test helpers use camelCase keys like `implRepair` and `implGate`, while flow definitions and step transitions use kebab-case IDs like `impl-repair` and `impl-gate`. Other changed tests and recovery code operate directly on step IDs, so this helper introduces an inconsistent cross-file convention.  
**Suggestion:** Rename the helper input to something like `initialStepStatusesById` and require actual step IDs as keys, matching production flow state shape and the other tests.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R2  
**Issue:** Test helpers use camelCase keys like `implRepair` and `implGate`, while flow definitions and step transitions use kebab-case IDs like `impl-repair` and `impl-gate`. Other changed tests and recovery code operate directly on step IDs, so this helper introduces an inconsistent cross-file convention.  
**Suggestion:** Rename the helper input to something like `initialStepStatusesById` and require actual step IDs as keys, matching production flow state shape and the other tests.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
