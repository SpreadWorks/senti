# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Avoid time-based module cache keys
**Finding key:** loop-0ad29d62bbcb2d8900bf
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R5
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R5  
**Issue:** `loadAcceptanceModule()` and `repairFingerprint()` use `Date.now()` in dynamic import query strings. If multiple imports happen in the same millisecond, the cache key can collide, which makes the test isolation mechanism weaker than intended.  
**Suggestion:** Replace `Date.now()` with a monotonic counter or `crypto.randomUUID()` helper, for example `nextImportUrl(modulePath)`, and reuse it for both dynamic imports.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R5  
**Issue:** `loadAcceptanceModule()` and `repairFingerprint()` use `Date.now()` in dynamic import query strings. If multiple imports happen in the same millisecond, the cache key can collide, which makes the test isolation mechanism weaker than intended.  
**Suggestion:** Replace `Date.now()` with a monotonic counter or `crypto.randomUUID()` helper, for example `nextImportUrl(modulePath)`, and reuse it for both dynamic imports.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Consolidate duplicated rollback assertions
**Finding key:** loop-bd016a5796ae4e2d7fce
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R4
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The R4 failure-boundary test and the issue-log rollback test repeat the same assertions for registry entries, flow file bytes, acceptance-review bytes, issue-log bytes, and step statuses. This makes future rollback coverage easy to update inconsistently.  
**Suggestion:** Introduce a helper such as `snapshotAcceptanceDecisionTransaction(context)` returning an assertion function, or `assertTransactionRolledBack(context, snapshot)`, and use it in both tests.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The R4 failure-boundary test and the issue-log rollback test repeat the same assertions for registry entries, flow file bytes, acceptance-review bytes, issue-log bytes, and step statuses. This makes future rollback coverage easy to update inconsistently.  
**Suggestion:** Introduce a helper such as `snapshotAcceptanceDecisionTransaction(context)` returning an assertion function, or `assertTransactionRolledBack(context, snapshot)`, and use it in both tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Use explicit failure case objects instead of positional tuples
**Finding key:** loop-ccd848cf160e8ae444e2
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R4
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The `cases` array uses positional tuple entries like `[name, inject, expectedCode, expectedCalls]`. The `null` and numeric fields are not self-describing, and the loop relies on unpacking order.  
**Suggestion:** Change the cases to objects with named fields: `{ name, inject, expectedCode, expectedSnapshotCalls }`. This makes each boundary easier to read and reduces accidental misordering.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R4  
**Issue:** The `cases` array uses positional tuple entries like `[name, inject, expectedCode, expectedCalls]`. The `null` and numeric fields are not self-describing, and the loop relies on unpacking order.  
**Suggestion:** Change the cases to objects with named fields: `{ name, inject, expectedCode, expectedSnapshotCalls }`. This makes each boundary easier to read and reduces accidental misordering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Rename `repairFingerprint` helper to avoid shadowing imported domain wording
**Finding key:** loop-25693285289b0db7b498
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R5
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R5  
**Issue:** The helper `repairFingerprint(root, state)` has the same conceptual name as the `repairFingerprint` value passed into `decisionArtifact(repairFingerprint)`, which makes call sites slightly ambiguous.  
**Suggestion:** Rename the helper to `buildCurrentRepairFingerprint` or `loadRepairFingerprintHash`, and rename the `decisionArtifact` parameter to `fingerprintHash`.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R5  
**Issue:** The helper `repairFingerprint(root, state)` has the same conceptual name as the `repairFingerprint` value passed into `decisionArtifact(repairFingerprint)`, which makes call sites slightly ambiguous.  
**Suggestion:** Rename the helper to `buildCurrentRepairFingerprint` or `loadRepairFingerprintHash`, and rename the `decisionArtifact` parameter to `fingerprintHash`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 5. Remove unused `targetBefore` assertion scope coupling
**Finding key:** loop-eb2b5a111d3fdf0d9501
**Failure mode:** refactor
**File:** specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js
**Requirement:** R2
**Issue:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R2  
**Issue:** The first test asserts the target flow file changes and the other flow file does not, while later tests assert detailed state transitions and registry preservation. This mixes exact identity persistence with unrelated file-byte mutation checks.  
**Suggestion:** Replace the byte-level target mutation assertion with explicit step/status assertions, or move byte rollback checks into the rollback helper proposed above.
**Suggestion:** **File:** `specs/338-active-flow-registry-race/tests/acceptance-decision-registry.test.js`  
**Requirement:** R2  
**Issue:** The first test asserts the target flow file changes and the other flow file does not, while later tests assert detailed state transitions and registry preservation. This mixes exact identity persistence with unrelated file-byte mutation checks.  
**Suggestion:** Replace the byte-level target mutation assertion with explicit step/status assertions, or move byte rollback checks into the rollback helper proposed above.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 6. Extract untracked-diff exclusion logic from `resolveReviewTarget`
**Finding key:** loop-7f2b5e3e262bf1ba5380
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** `resolveReviewTarget()` now handles scope parsing, tracked diff collection, spec-test path policy, exclusion matching, untracked diff collection, and diff-file parsing. The embedded `excludeFile` callback is doing enough path policy work to obscure the main flow.  
**Suggestion:** Extract a helper like `createReviewUntrackedExclude({ flow, scopeFiles, excludeMatcher })` and keep `resolveReviewTarget()` focused on composing tracked and untracked diffs.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** `resolveReviewTarget()` now handles scope parsing, tracked diff collection, spec-test path policy, exclusion matching, untracked diff collection, and diff-file parsing. The embedded `excludeFile` callback is doing enough path policy work to obscure the main flow.  
**Suggestion:** Extract a helper like `createReviewUntrackedExclude({ flow, scopeFiles, excludeMatcher })` and keep `resolveReviewTarget()` focused on composing tracked and untracked diffs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 7. Reuse path normalization helper
**Finding key:** loop-77a11a277216344a5617
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** Path normalization is repeated with `String(...).split(path.sep).join("/")` for both `flow.spec` and each untracked file.  
**Suggestion:** Add a small local helper such as `toPosixPath(value)` and use it in `resolveReviewTarget()` and the untracked exclusion callback. This improves readability and keeps path handling consistent.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R5  
**Issue:** Path normalization is repeated with `String(...).split(path.sep).join("/")` for both `flow.spec` and each untracked file.  
**Suggestion:** Add a small local helper such as `toPosixPath(value)` and use it in `resolveReviewTarget()` and the untracked exclusion callback. This improves readability and keeps path handling consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Align Reset Step Constant Naming
**Finding key:** loop-4eb4230ba76e2fc7a036
**Failure mode:** refactor
**File:** src/flow/definition.js
**Requirement:** R3
**Issue:** **File:** `src/flow/definition.js`  
**Requirement:** R3  
**Issue:** `REJECTED_IMPL_REVIEW_RESET_STEPS` is verdict-oriented, while nearby lifecycle constants such as `IMPL_REVIEW_RESET_RANGE` are step/lifecycle-oriented. The naming style is slightly inconsistent.  
**Suggestion:** Rename it to `IMPL_REVIEW_REJECTED_RESET_STEPS` or `IMPL_REVIEW_REJECTION_RESET_STEPS` so related impl-review lifecycle constants group together naturally.
**Suggestion:** **File:** `src/flow/definition.js`  
**Requirement:** R3  
**Issue:** `REJECTED_IMPL_REVIEW_RESET_STEPS` is verdict-oriented, while nearby lifecycle constants such as `IMPL_REVIEW_RESET_RANGE` are step/lifecycle-oriented. The naming style is slightly inconsistent.  
**Suggestion:** Rename it to `IMPL_REVIEW_REJECTED_RESET_STEPS` or `IMPL_REVIEW_REJECTION_RESET_STEPS` so related impl-review lifecycle constants group together naturally.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Add Bounds to Historical Evidence Replay
**Finding key:** loop-e55fdc51a8119376cd7e
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R6  
**Issue:** `historicalReviewHandoffs()` iterates every `reviewConvergence.records` entry and every `evidenceHistory` item, reading one evidence file per unique digest with no explicit count or size bound on the collection. The matched bounded-resource rationale only covers full comparison of one active-flow registry snapshot, not unbounded historical evidence replay.  
**Suggestion:** Add explicit caps for records, evidence history entries, and total evidence files processed, or reuse an existing project cap if one exists in this file. Throw a clear error when exceeded.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R6  
**Issue:** `historicalReviewHandoffs()` iterates every `reviewConvergence.records` entry and every `evidenceHistory` item, reading one evidence file per unique digest with no explicit count or size bound on the collection. The matched bounded-resource rationale only covers full comparison of one active-flow registry snapshot, not unbounded historical evidence replay.  
**Suggestion:** Add explicit caps for records, evidence history entries, and total evidence files processed, or reuse an existing project cap if one exists in this file. Throw a clear error when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Reuse Issue Validation Logic
**Finding key:** loop-98346c4ee28e3ac1f214
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R1  
**Issue:** `requireNullableIssue()` validates positive integer issue identities, but `AcceptanceDecisionTargetIdentity` reimplements similar parsing and validation inline. This duplicates identity validation rules and increases the chance of drift.  
**Suggestion:** Use `requireNullableIssue(state?.issue, "active flow issue")` inside `AcceptanceDecisionTargetIdentity`, then keep only the managed-worktree-specific null rejection there.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R1  
**Issue:** `requireNullableIssue()` validates positive integer issue identities, but `AcceptanceDecisionTargetIdentity` reimplements similar parsing and validation inline. This duplicates identity validation rules and increases the chance of drift.  
**Suggestion:** Use `requireNullableIssue(state?.issue, "active flow issue")` inside `AcceptanceDecisionTargetIdentity`, then keep only the managed-worktree-specific null rejection there.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Simplify Canonical Evidence Source Handling
**Finding key:** loop-46039dfa85aa648bde38
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** `CanonicalReviewEvidenceProjection` calls `requireString(record.canonicalEvidenceRef, ...)` and immediately passes the result to `readCanonicalReviewEvidence()`, which validates the same value again.  
**Suggestion:** Pass `record.canonicalEvidenceRef` directly to `readCanonicalReviewEvidence()` and let that helper own canonical evidence reference validation.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R5  
**Issue:** `CanonicalReviewEvidenceProjection` calls `requireString(record.canonicalEvidenceRef, ...)` and immediately passes the result to `readCanonicalReviewEvidence()`, which validates the same value again.  
**Suggestion:** Pass `record.canonicalEvidenceRef` directly to `readCanonicalReviewEvidence()` and let that helper own canonical evidence reference validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 4. Clarify Rollback Error Helper Naming
**Finding key:** loop-8cb881e7e44908dc51f7
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `appendRollbackError()` sounds like it mutates a collection, but it actually returns either the new cause or an `AggregateError`. The current name makes the rollback path harder to scan.  
**Suggestion:** Rename it to something like `combineRollbackError()` or `mergeRollbackError()` to reflect that it returns the combined error value.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `appendRollbackError()` sounds like it mutates a collection, but it actually returns either the new cause or an `AggregateError`. The current name makes the rollback path harder to scan.  
**Suggestion:** Rename it to something like `combineRollbackError()` or `mergeRollbackError()` to reflect that it returns the combined error value.
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

### 22. 1. Extract artifact JSON loading
**Finding key:** loop-14f437525b2520c74710
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `JSON.parse(fs.readFileSync(path.join(specDir, ...), "utf8"))` is repeated for multiple artifacts, which makes error handling and intent noisier.  
**Suggestion:** Add a small local helper such as `readSpecJson(specDir, artifactName)` and use it for `impl-triage.json`, `impl-review.json`, `test-execute-result.json`, and `test-result-review.json`.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `JSON.parse(fs.readFileSync(path.join(specDir, ...), "utf8"))` is repeated for multiple artifacts, which makes error handling and intent noisier.  
**Suggestion:** Add a small local helper such as `readSpecJson(specDir, artifactName)` and use it for `impl-triage.json`, `impl-review.json`, `test-execute-result.json`, and `test-result-review.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Rename missing finding helper for precision
**Finding key:** loop-55034d3347252df65eee
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `missingCurrentAppliedFindingIds` is vague; the function specifically validates current impl-review triage and returns applied findings that lack repair ledger evidence.  
**Suggestion:** Rename it to something like `missingAppliedTriageRepairEvidenceFindingIds` or `unrepairedAppliedTriageFindingIds` to reflect the source and condition.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `missingCurrentAppliedFindingIds` is vague; the function specifically validates current impl-review triage and returns applied findings that lack repair ledger evidence.  
**Suggestion:** Rename it to something like `missingAppliedTriageRepairEvidenceFindingIds` or `unrepairedAppliedTriageFindingIds` to reflect the source and condition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Simplify fallback recovery validation
**Finding key:** loop-599a662061f814ff1e4c
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `validateBlockedImplRepairRecovery` uses nested `try/catch` blocks to attempt triage-based recovery, then gate-observed recovery. This makes the success path harder to scan.  
**Suggestion:** Extract the two strategies into named validator functions and iterate them, collecting error messages. That keeps the “try triage, then gate issue log” design explicit without deeply nested control flow.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `validateBlockedImplRepairRecovery` uses nested `try/catch` blocks to attempt triage-based recovery, then gate-observed recovery. This makes the success path harder to scan.  
**Suggestion:** Extract the two strategies into named validator functions and iterate them, collecting error messages. That keeps the “try triage, then gate issue log” design explicit without deeply nested control flow.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Centralize repaired finding ID extraction
**Finding key:** loop-2fda48b3b59ccf7afcf8
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `new Set(ledger?.entries.flatMap((entry) => entry.sourceFindingIds) || [])` appears in both `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds`.  
**Suggestion:** Extract a helper like `repairedFindingIdSet(ledger)` to remove duplication and make ledger interpretation consistent.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `new Set(ledger?.entries.flatMap((entry) => entry.sourceFindingIds) || [])` appears in both `missingCurrentAppliedFindingIds` and `missingGateObservedFindingIds`.  
**Suggestion:** Extract a helper like `repairedFindingIdSet(ledger)` to remove duplication and make ledger interpretation consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Simplify Snapshot Entry Normalization
**Finding key:** loop-1f1f9c2abc6dd604bf6f
**Failure mode:** refactor
**File:** src/lib/active-flow-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R2  
**Issue:** `ActiveFlowRegistrySnapshot` converts entries through `toJSON()`, then freezes plain objects, while `toJSON()` later clones them again. The nested conversion expression is harder to read than necessary.  
**Suggestion:** Extract a helper like `snapshotEntry(entry)` or normalize through `new ActiveFlowDocument(entries).toJSON()` before freezing. This keeps snapshot serialization behavior explicit and easier to audit.
**Suggestion:** **File:** `src/lib/active-flow-registry.js`  
**Requirement:** R2  
**Issue:** `ActiveFlowRegistrySnapshot` converts entries through `toJSON()`, then freezes plain objects, while `toJSON()` later clones them again. The nested conversion expression is harder to read than necessary.  
**Suggestion:** Extract a helper like `snapshotEntry(entry)` or normalize through `new ActiveFlowDocument(entries).toJSON()` before freezing. This keeps snapshot serialization behavior explicit and easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Consolidate Exact Target Validation
**Finding key:** loop-215ba8ec2d424e4172e9
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R1
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `CapturedFlowTargetMutation`, `captureExactTarget`, and `mutateExactTarget` repeat similar `FlowTargetExpectation` validation, with slight differences around requiring `expectation.spec`.  
**Suggestion:** Add a small helper such as `assertExactFlowTargetExpectation(expectation, { requireSpec = true, label })` and reuse it in all three places. This reduces drift risk in managed-worktree mutation guards.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R1  
**Issue:** `CapturedFlowTargetMutation`, `captureExactTarget`, and `mutateExactTarget` repeat similar `FlowTargetExpectation` validation, with slight differences around requiring `expectation.spec`.  
**Suggestion:** Add a small helper such as `assertExactFlowTargetExpectation(expectation, { requireSpec = true, label })` and reuse it in all three places. This reduces drift risk in managed-worktree mutation guards.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Remove Duplicate Explicit Target Resolution Methods
**Finding key:** loop-45b58404d85762c4bf55
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R3
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `resolveExplicitFlowTarget` and `resolveExplicitFlowTargetForRead` currently have identical implementations.  
**Suggestion:** Keep one implementation and make the other a simple alias, or remove the redundant method if no API compatibility requires it.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R3  
**Issue:** `resolveExplicitFlowTarget` and `resolveExplicitFlowTargetForRead` currently have identical implementations.  
**Suggestion:** Keep one implementation and make the other a simple alias, or remove the redundant method if no API compatibility requires it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Reuse Active Flow Mode Validation
**Finding key:** loop-f72a52d982a296a8274d
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R4
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R4  
**Issue:** `ACTIVE_FLOW_MODES` duplicates the mode set already maintained in `active-flow-registry.js` as `VALID_MODES`. This creates a maintenance risk if registry modes change.  
**Suggestion:** Export a shared mode validator or constant from `active-flow-registry.js`, then use it in `ActiveFlowIdentityEntry` instead of defining a second mode set.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R4  
**Issue:** `ACTIVE_FLOW_MODES` duplicates the mode set already maintained in `active-flow-registry.js` as `VALID_MODES`. This creates a maintenance risk if registry modes change.  
**Suggestion:** Export a shared mode validator or constant from `active-flow-registry.js`, then use it in `ActiveFlowIdentityEntry` instead of defining a second mode set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Extract Minimal Spec Fixture Creation
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

### 31. 2. Rename Passing Evidence Fixture
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

### 32. 3. Extract Review Evidence Fixture Boilerplate
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

### 33. 1. Extract Shared Review Convergence Fixture Setup
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

### 34. 2. Rename `priorStatuses` to Match Step IDs
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

### 35. 3. Simplify `updatesFor` Return Shape or Split Assertions
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

### 36. 4. Avoid Inline `flowManager` Mock Drift
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

### 37. 1. Extract repeated gate recovery fixture setup
**Finding key:** loop-c9f90c8fa22886f8ea16
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The two new gate recovery tests duplicate most of the same setup: temp dir, spec/artifact writes, repair fingerprint, triage artifact, stale test artifacts, source mutation, and flow state creation. This makes the tests harder to maintain and increases the chance that future changes update one scenario but not the other.  
**Suggestion:** Add a local helper such as `setupGateRepairEvidenceFixture({ runId })` that returns `{ tmp, specDir, state, previousFingerprint }`, then keep only the scenario-specific mutations inside each test.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The two new gate recovery tests duplicate most of the same setup: temp dir, spec/artifact writes, repair fingerprint, triage artifact, stale test artifacts, source mutation, and flow state creation. This makes the tests harder to maintain and increases the chance that future changes update one scenario but not the other.  
**Suggestion:** Add a local helper such as `setupGateRepairEvidenceFixture({ runId })` that returns `{ tmp, specDir, state, previousFingerprint }`, then keep only the scenario-specific mutations inside each test.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Extract the repeated mock flow manager
**Finding key:** loop-a702410d318f977a1da1
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The new tests both hand-roll a `flowManager` with nearly identical `load` / `updateStepStatuses` behavior, including the same loop that applies transition changes to `state.steps`.  
**Suggestion:** Add a small helper like `makeRepairRecoveryFlowManager(state, { transitions } = {})` in this test file. Include optional methods such as `loadReadOnly`, `mutate`, and `completeStepTransitionIntent` only when needed by a scenario.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The new tests both hand-roll a `flowManager` with nearly identical `load` / `updateStepStatuses` behavior, including the same loop that applies transition changes to `state.steps`.  
**Suggestion:** Add a small helper like `makeRepairRecoveryFlowManager(state, { transitions } = {})` in this test file. Include optional methods such as `loadReadOnly`, `mutate`, and `completeStepTransitionIntent` only when needed by a scenario.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Name the gate finding constant by role, not implementation detail
**Finding key:** loop-0dd0603aaf4d9d95b6b0
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `GATE_FINDING_ID` describes where the finding appears, but not why this specific ID matters in these tests. The tests are specifically exercising missing repair evidence for a must-fix finding.  
**Suggestion:** Rename it to something more intent-revealing, for example `MISSING_REPAIR_EVIDENCE_FINDING_ID` or `MUST_FIX_FINDING_ID`.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** `GATE_FINDING_ID` describes where the finding appears, but not why this specific ID matters in these tests. The tests are specifically exercising missing repair evidence for a must-fix finding.  
**Suggestion:** Rename it to something more intent-revealing, for example `MISSING_REPAIR_EVIDENCE_FINDING_ID` or `MUST_FIX_FINDING_ID`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Avoid nondeterministic timestamps in test fixtures
**Finding key:** loop-95e4fe202723a06ae502
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The second new test writes `timestamp: new Date().toISOString()` into `issue-log.json`. The timestamp is not relevant to the assertion and adds unnecessary nondeterminism to the fixture.  
**Suggestion:** Use a fixed timestamp string such as `"2026-01-01T00:00:00.000Z"` to keep the test data deterministic.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** The second new test writes `timestamp: new Date().toISOString()` into `issue-log.json`. The timestamp is not relevant to the assertion and adds unnecessary nondeterminism to the fixture.  
**Suggestion:** Use a fixed timestamp string such as `"2026-01-01T00:00:00.000Z"` to keep the test data deterministic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 1. Share Active Flow Mode Validation
**Finding key:** loop-cff26fd438d20376923a
**Failure mode:** refactor
**File:** src/lib/flow-manager.js
**Requirement:** R4
**Issue:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R4  
**Issue:** `flow-manager.js` introduces `ACTIVE_FLOW_MODES` while `src/lib/active-flow-registry.js` already owns `VALID_MODES`. This duplicates the same interface contract across files and can drift if registry modes change.  
**Suggestion:** Export a shared mode constant or validator from `active-flow-registry.js` and use it from `flow-manager.js`.
**Suggestion:** **File:** `src/lib/flow-manager.js`  
**Requirement:** R4  
**Issue:** `flow-manager.js` introduces `ACTIVE_FLOW_MODES` while `src/lib/active-flow-registry.js` already owns `VALID_MODES`. This duplicates the same interface contract across files and can drift if registry modes change.  
**Suggestion:** Export a shared mode constant or validator from `active-flow-registry.js` and use it from `flow-manager.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Align Repair Evidence Exclusion Naming With Review Artifact Semantics
**Finding key:** loop-25850902137a39e3ccba
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `WORKFLOW_ARTIFACT_PATH_PREFIXES` excludes broad paths like `docs/` and `specs/`, while `src/flow/lib/acceptance-review-artifacts.js` discusses evidence and handoff artifacts using more domain-specific wording. The naming makes the same artifact/evidence boundary read differently across files.  
**Suggestion:** Rename the constant to a behavior-focused name such as `REPAIR_EVIDENCE_EXCLUDED_PREFIXES`, and use similar evidence/artifact terminology where related filters appear.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** `WORKFLOW_ARTIFACT_PATH_PREFIXES` excludes broad paths like `docs/` and `specs/`, while `src/flow/lib/acceptance-review-artifacts.js` discusses evidence and handoff artifacts using more domain-specific wording. The naming makes the same artifact/evidence boundary read differently across files.  
**Suggestion:** Rename the constant to a behavior-focused name such as `REPAIR_EVIDENCE_EXCLUDED_PREFIXES`, and use similar evidence/artifact terminology where related filters appear.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 3. Centralize Finding Repair Ledger Interpretation
**Finding key:** loop-8cd3eab0e3f676d5a309
**Failure mode:** refactor
**File:** src/flow/lib/set-step.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `set-step.js` repeats repaired finding ID extraction from ledger entries, while `src/flow/lib/impl-repair-artifacts.js` also constructs repair transactions and ledger entries. The write-side and read-side interpretation of `sourceFindingIds` are split without a shared helper, increasing drift risk.  
**Suggestion:** Add a shared helper near the repair ledger model, for example `repairedFindingIdSet(ledger)`, and use it from `set-step.js` and any repair-artifact validation paths.
**Suggestion:** **File:** `src/flow/lib/set-step.js`  
**Requirement:** R6  
**Issue:** `set-step.js` repeats repaired finding ID extraction from ledger entries, while `src/flow/lib/impl-repair-artifacts.js` also constructs repair transactions and ledger entries. The write-side and read-side interpretation of `sourceFindingIds` are split without a shared helper, increasing drift risk.  
**Suggestion:** Add a shared helper near the repair ledger model, for example `repairedFindingIdSet(ledger)`, and use it from `set-step.js` and any repair-artifact validation paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 4. Normalize Review Recovery Attempt Checks
**Finding key:** loop-32e8b73b34e475e5bf1c
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** Recovery attempt exhaustion is checked in `ReviewToolingRecoveryMutation` and `ReviewSemanticRecoveryMutation`, while related retry recovery tests add convergence scenarios in separate files. Slightly different field names and error strings make the recovery interface harder to assert consistently across implementation and tests.  
**Suggestion:** Introduce `requireExhaustedAttempts(current, kind)` and have tests assert the shared behavior rather than duplicating assumptions per recovery type.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** Recovery attempt exhaustion is checked in `ReviewToolingRecoveryMutation` and `ReviewSemanticRecoveryMutation`, while related retry recovery tests add convergence scenarios in separate files. Slightly different field names and error strings make the recovery interface harder to assert consistently across implementation and tests.  
**Suggestion:** Introduce `requireExhaustedAttempts(current, kind)` and have tests assert the shared behavior rather than duplicating assumptions per recovery type.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 5. Use Consistent Deterministic Fixture Time Helpers
**Finding key:** loop-49ce7d1ae55477420f9b
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R5
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** One test fixture uses `new Date().toISOString()`, while another review proposal flags `Date.now()`-based dynamic import cache keys in acceptance tests. Across test files, time is being used for unrelated uniqueness and fixture data, creating inconsistent determinism practices.  
**Suggestion:** Add small test helpers for fixed timestamps and monotonic import IDs, then use them instead of wall-clock time in affected tests.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R5  
**Issue:** One test fixture uses `new Date().toISOString()`, while another review proposal flags `Date.now()`-based dynamic import cache keys in acceptance tests. Across test files, time is being used for unrelated uniqueness and fixture data, creating inconsistent determinism practices.  
**Suggestion:** Add small test helpers for fixed timestamps and monotonic import IDs, then use them instead of wall-clock time in affected tests.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
