# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 2. Rename Ambiguous Repair Target Title
**Finding key:** loop-a362c561bfff812e9fb5
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft-review-questions.json
**Requirement:** R2
**Issue:** **File:** `specs/329-review-convergence-edges/draft-review-questions.json`  
**Requirement:** R2  
**Issue:** The repair target title `"1. Empty QA List"` is stale relative to `draft.json`, which now contains an answered QA entry. The numbered prefix also duplicates list ordering that is already represented by array position.  
**Suggestion:** Rename the title to something state-based and unnumbered, such as `"Initial QA List Was Empty During Draft Review"`, or regenerate this artifact so it reflects the current `qa` state.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft-review-questions.json`  
**Requirement:** R2  
**Issue:** The repair target title `"1. Empty QA List"` is stale relative to `draft.json`, which now contains an answered QA entry. The numbered prefix also duplicates list ordering that is already represented by array position.  
**Suggestion:** Rename the title to something state-based and unnumbered, such as `"Initial QA List Was Empty During Draft Review"`, or regenerate this artifact so it reflects the current `qa` state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Consolidate Repeated Invariants
**Finding key:** loop-9db0cdfc3b897b63047d
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R1  
**Issue:** The same invariants are repeated across `analysis.proposedApproach`, `analysis.validation`, `decisionMap.knownFacts`, `decisionMap.resolvedByProjectRules`, and `scopeVerification.out`, especially `toolingMaxAttempts=1`, review semantic maxAttempts, scope/CAS preservation, and excluded files. This makes the draft harder to maintain and risks inconsistent edits later.  
**Suggestion:** Move shared invariants into one canonical section, such as `decisionMap.resolvedByProjectRules`, and have other sections reference that constraint briefly instead of restating the full list.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R1  
**Issue:** The same invariants are repeated across `analysis.proposedApproach`, `analysis.validation`, `decisionMap.knownFacts`, `decisionMap.resolvedByProjectRules`, and `scopeVerification.out`, especially `toolingMaxAttempts=1`, review semantic maxAttempts, scope/CAS preservation, and excluded files. This makes the draft harder to maintain and risks inconsistent edits later.  
**Suggestion:** Move shared invariants into one canonical section, such as `decisionMap.resolvedByProjectRules`, and have other sections reference that constraint briefly instead of restating the full list.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Simplify Validation Narrative
**Finding key:** loop-c33051d4fa099f6849e0
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft.json
**Requirement:** R5
**Issue:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R5  
**Issue:** `analysis.validation` is a very long paragraph that mixes test file names, scenario matrices, expected attempt counts, lifecycle assertions, and final command expectations. This makes individual validation requirements difficult to scan or update.  
**Suggestion:** Convert `analysis.validation` into a structured array grouped by test file or behavior area, with one concise validation expectation per item.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R5  
**Issue:** `analysis.validation` is a very long paragraph that mixes test file names, scenario matrices, expected attempt counts, lifecycle assertions, and final command expectations. This makes individual validation requirements difficult to scan or update.  
**Suggestion:** Convert `analysis.validation` into a structured array grouped by test file or behavior area, with one concise validation expectation per item.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Remove Empty Placeholder Fields
**Finding key:** loop-112a694f8f1c7c274d31
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R3  
**Issue:** Several fields are present but empty, including `requiresUserJudgment`, `openQuestions`, and `qa[0].droppedReason`. If the schema does not require explicit empty placeholders, these add noise without carrying information.  
**Suggestion:** Omit optional empty arrays/strings, or use `null` only where the schema needs an explicit “not applicable” value.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R3  
**Issue:** Several fields are present but empty, including `requiresUserJudgment`, `openQuestions`, and `qa[0].droppedReason`. If the schema does not require explicit empty placeholders, these add noise without carrying information.  
**Suggestion:** Omit optional empty arrays/strings, or use `null` only where the schema needs an explicit “not applicable” value.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Bound Review History Growth
**Finding key:** loop-5a9aaf022cd2a2ad3b80
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** `reviewConvergence.records[*].evidenceHistory`, `metrics`, `stepAttempts`, and `reviewRecoveryBaselines` accumulate historical entries without an explicit retention limit. This violates `bounded-resource-usage` because repeated review/gate cycles can grow the flow state indefinitely.  
**Suggestion:** Add an explicit retention policy in this artifact, such as max history entries per `(phase, taskId, treeSha)` and max global recovery baseline entries, and compact older entries into a summary/count field.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** `reviewConvergence.records[*].evidenceHistory`, `metrics`, `stepAttempts`, and `reviewRecoveryBaselines` accumulate historical entries without an explicit retention limit. This violates `bounded-resource-usage` because repeated review/gate cycles can grow the flow state indefinitely.  
**Suggestion:** Add an explicit retention policy in this artifact, such as max history entries per `(phase, taskId, treeSha)` and max global recovery baseline entries, and compact older entries into a summary/count field.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Deduplicate Repeated Recovery Baselines
**Finding key:** loop-cb4347a585b67d26b2aa
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** `reviewRecoveryBaselines` contains multiple identical `fingerprint.hash` entries for the same `kind`, `phase`, `canonicalPhase`, and `trigger`, differing only by `createdAt`. This repeats bulky `paths` and `components` payloads.  
**Suggestion:** Store one baseline per identity/hash and track repeated occurrences as a bounded `attempts` or `createdAtHistory` list, capped by the retry limit.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** `reviewRecoveryBaselines` contains multiple identical `fingerprint.hash` entries for the same `kind`, `phase`, `canonicalPhase`, and `trigger`, differing only by `createdAt`. This repeats bulky `paths` and `components` payloads.  
**Suggestion:** Store one baseline per identity/hash and track repeated occurrences as a bounded `attempts` or `createdAtHistory` list, capped by the retry limit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Normalize Repeated Handoff Metadata
**Finding key:** loop-3b58c8df6c11dcef83f0
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R6  
**Issue:** Each `handoffFindings` entry repeats identical metadata such as `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`. The large impl advisory block is especially repetitive.  
**Suggestion:** Move shared evidence-level metadata to the parent convergence record and keep per-finding entries to finding-specific fields only: `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R6  
**Issue:** Each `handoffFindings` entry repeats identical metadata such as `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`. The large impl advisory block is especially repetitive.  
**Suggestion:** Move shared evidence-level metadata to the parent convergence record and keep per-finding entries to finding-specific fields only: `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Bound Issue Log Size
**Finding key:** loop-0d306c45c3f34f4dd36e
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** `entries` is an append-only log with large nested observations and full repeated final-regression fingerprint lists. There is no explicit size/count bound, violating `bounded-resource-usage`.  
**Suggestion:** Add a bounded retention/compaction rule: keep the latest N full entries per step plus summaries for older entries, and move large evidence payloads behind referenced artifact paths.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** `entries` is an append-only log with large nested observations and full repeated final-regression fingerprint lists. There is no explicit size/count bound, violating `bounded-resource-usage`.  
**Suggestion:** Add a bounded retention/compaction rule: keep the latest N full entries per step plus summaries for older entries, and move large evidence payloads behind referenced artifact paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Deduplicate Final Regression Fingerprints
**Finding key:** loop-a2bf5c9cf991f3ef7980
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** `changedFileFingerprints` repeats identical path/fingerprint pairs within the same entry, for example duplicate `draft-review-questions.json`, `draft.json`, and `spec.json` entries.  
**Suggestion:** Store `changedFileFingerprints` as a unique map keyed by path, or deduplicate the array before writing the issue-log entry.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** `changedFileFingerprints` repeats identical path/fingerprint pairs within the same entry, for example duplicate `draft-review-questions.json`, `draft.json`, and `spec.json` entries.  
**Suggestion:** Store `changedFileFingerprints` as a unique map keyed by path, or deduplicate the array before writing the issue-log entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 6. Consolidate Repeated Gate Observation Text
**Finding key:** loop-54f91756c90d291396b8
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several gate entries repeat the same project-test-integrity observation for each retry attempt, producing long duplicated `reason`, `observations`, and `failedEvaluations` sections.  
**Suggestion:** Collapse repeated observations into one grouped entry with an `attempts` array or `count`, preserving locators while avoiding repeated prose.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several gate entries repeat the same project-test-integrity observation for each retry attempt, producing long duplicated `reason`, `observations`, and `failedEvaluations` sections.  
**Suggestion:** Collapse repeated observations into one grouped entry with an `attempts` array or `count`, preserving locators while avoiding repeated prose.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Avoid duplicated issue number state
**Finding key:** loop-93da7847ac8a18a306ec
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/plugin-artifacts/workflow/prepare.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The issue number is stored twice as both `issue` and `result.issueNumber`, which creates a small drift risk if this artifact is edited or regenerated manually.  
**Suggestion:** Prefer a single source of truth if the workflow permits it. For example, keep only `issue` at the top level, or only `result.issueNumber`, and have downstream consumers read that one field consistently.
**Suggestion:** **File:** `specs/329-review-convergence-edges/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The issue number is stored twice as both `issue` and `result.issueNumber`, which creates a small drift risk if this artifact is edited or regenerated manually.  
**Suggestion:** Prefer a single source of truth if the workflow permits it. For example, keep only `issue` at the top level, or only `result.issueNumber`, and have downstream consumers read that one field consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Normalize duplicated finding payloads
**Finding key:** loop-1eca6f86c28f4689a4e0
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** The same repair target data is duplicated under both `repairTargets[0]` and `findings[0]`, but the `findings[0]` object omits `target` and `evidence` while attempt 002 includes them. This makes the review-history format inconsistent across attempts.  
**Suggestion:** Add `target: "qa[]"` and `evidence: "qa[] is empty before any answer exists"` to `findings[0]`, or remove duplicated fields from both files and keep the canonical detail only in `repairTargets`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** The same repair target data is duplicated under both `repairTargets[0]` and `findings[0]`, but the `findings[0]` object omits `target` and `evidence` while attempt 002 includes them. This makes the review-history format inconsistent across attempts.  
**Suggestion:** Add `target: "qa[]"` and `evidence: "qa[] is empty before any answer exists"` to `findings[0]`, or remove duplicated fields from both files and keep the canonical detail only in `repairTargets`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Fix inconsistent severity/verdict wording
**Finding key:** loop-8e5ada17b6a9c0b0e8a8
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R2
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R2  
**Issue:** `summary` says `0 blocking`, but `findings[0].severity` is `"blocking"`. The same finding is classified as a repair target, so this creates conflicting state inside the artifact.  
**Suggestion:** Change `findings[0].severity` to `"non-blocking"` to match attempt 002 and the advisory summary, or update the summary/verdict if this finding is intended to be blocking.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R2  
**Issue:** `summary` says `0 blocking`, but `findings[0].severity` is `"blocking"`. The same finding is classified as a repair target, so this creates conflicting state inside the artifact.  
**Suggestion:** Change `findings[0].severity` to `"non-blocking"` to match attempt 002 and the advisory summary, or update the summary/verdict if this finding is intended to be blocking.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Avoid storing identical generated history snapshots
**Finding key:** loop-7595b5e9388e4c9c064b
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-002.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-002.json`  
**Requirement:** R3  
**Issue:** Attempt 002 largely repeats attempt 001 with only timestamp, attempt number, ID, and minor schema differences changed. Keeping near-identical generated artifacts increases review noise and makes real changes harder to identify.  
**Suggestion:** If both attempts are required, keep them schema-identical and ensure the delta is intentional. If only the latest attempt matters, remove the superseded attempt artifact from the change set.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-002.json`  
**Requirement:** R3  
**Issue:** Attempt 002 largely repeats attempt 001 with only timestamp, attempt number, ID, and minor schema differences changed. Keeping near-identical generated artifacts increases review noise and makes real changes harder to identify.  
**Suggestion:** If both attempts are required, keep them schema-identical and ensure the delta is intentional. If only the latest attempt matters, remove the superseded attempt artifact from the change set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Consolidate duplicated overview entries
**Finding key:** loop-48eec73194cfeaef22a0
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules` and `overview.data_flow` contain older Japanese entries and newer `added_by_task` entries that restate the same module ownership and data flow for finding identity, changed-tree recovery, and review scope. This makes the spec harder to maintain and increases the chance of future drift.  
**Suggestion:** Merge each duplicated pair into a single canonical entry per module/data flow, preserving any task attribution only where it adds information.
**Suggestion:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules` and `overview.data_flow` contain older Japanese entries and newer `added_by_task` entries that restate the same module ownership and data flow for finding identity, changed-tree recovery, and review scope. This makes the spec harder to maintain and increases the chance of future drift.  
**Suggestion:** Merge each duplicated pair into a single canonical entry per module/data flow, preserving any task attribution only where it adds information.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Align task status with completed requirements
**Finding key:** loop-a42b2b3bf6c32d469af5
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** All requirements are marked `"status": "done"`, but tasks `T-1`, `T-2`, and `T-3` remain `"status": "pending"`. The mixed lifecycle state is confusing for reviewers and automation consuming the spec.  
**Suggestion:** Update task statuses to match the completed requirement state, or remove per-task status if requirement status is the source of truth.
**Suggestion:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** All requirements are marked `"status": "done"`, but tasks `T-1`, `T-2`, and `T-3` remain `"status": "pending"`. The mixed lifecycle state is confusing for reviewers and automation consuming the spec.  
**Suggestion:** Update task statuses to match the completed requirement state, or remove per-task status if requirement status is the source of truth.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Split canonical truncation from presentation truncation
**Finding key:** loop-56b7bd0e1b9e317c4cee
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `normalizeTestReviewText` now uses `REVIEW_FINDING_CANONICAL_FIELD_MAX_CHARS` for every normalized test-review field, including fields that are not part of the canonical fingerprint tuple such as `requiredChange`, `whyBlocking`, and `whyNonBlocking`. This couples presentation/disposition text limits to fingerprint identity limits.  
**Suggestion:** Keep canonical-field truncation for `target`, `title`, `issue`, and `improvement`, but use a separately named test-review display/detail limit for non-identity fields. This preserves the R1 identity behavior while making the different purposes explicit.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `normalizeTestReviewText` now uses `REVIEW_FINDING_CANONICAL_FIELD_MAX_CHARS` for every normalized test-review field, including fields that are not part of the canonical fingerprint tuple such as `requiredChange`, `whyBlocking`, and `whyNonBlocking`. This couples presentation/disposition text limits to fingerprint identity limits.  
**Suggestion:** Keep canonical-field truncation for `target`, `title`, `issue`, and `improvement`, but use a separately named test-review display/detail limit for non-identity fields. This preserves the R1 identity behavior while making the different purposes explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Centralize fingerprint hashing
**Finding key:** loop-6a53bec7450bb0c73e38
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `ReviewFindingFingerprint.fromFinding()` and `fromCanonicalTuple()` duplicate the same SHA-256 creation flow over `stableStringify(...)`.  
**Suggestion:** Add a small private helper such as `fingerprintFromStableValue(value)` or `sha256StableJson(value)` and have both methods call it. This keeps future fingerprint behavior changes in one place.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `ReviewFindingFingerprint.fromFinding()` and `fromCanonicalTuple()` duplicate the same SHA-256 creation flow over `stableStringify(...)`.  
**Suggestion:** Add a small private helper such as `fingerprintFromStableValue(value)` or `sha256StableJson(value)` and have both methods call it. This keeps future fingerprint behavior changes in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Make canonical tuple normalization explicit
**Finding key:** loop-3fac99a1e51f962a6a8e
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** `fromCanonicalTuple()` validates `value.trim() !== ""` but hashes the original string, so `"title"` and `" title "` produce different fingerprints even though the method name implies canonical input.  
**Suggestion:** Either trim/collapse the tuple values before hashing, or rename/document the method as accepting already-normalized canonical values and add an assertion/helper name that makes that contract obvious.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** `fromCanonicalTuple()` validates `value.trim() !== ""` but hashes the original string, so `"title"` and `" title "` produce different fingerprints even though the method name implies canonical input.  
**Suggestion:** Either trim/collapse the tuple values before hashing, or rename/document the method as accepting already-normalized canonical values and add an assertion/helper name that makes that contract obvious.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Reuse convergence record replacement logic
**Finding key:** loop-425d924ed22d829e080e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `ReviewToolingRecoveryMutation.apply()` duplicates much of `replaceTargetRecord()` by cloning records, replacing an index, and rewriting `flowState.reviewConvergence`. This creates two subtly different write paths for the same state structure.  
**Suggestion:** Extract a shared helper for “replace existing target record” or extend `replaceTargetRecord()` with an option that requires an existing record. Use that helper from recovery mutation and the existing record paths.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `ReviewToolingRecoveryMutation.apply()` duplicates much of `replaceTargetRecord()` by cloning records, replacing an index, and rewriting `flowState.reviewConvergence`. This creates two subtly different write paths for the same state structure.  
**Suggestion:** Extract a shared helper for “replace existing target record” or extend `replaceTargetRecord()` with an option that requires an existing record. Use that helper from recovery mutation and the existing record paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 4. Rename issue guard fields for clarity
**Finding key:** loop-32b7f9e5d38d3e810902
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `expectedHasIssue` is derived from whether `expectedIssue` exists, not whether the expected issue value is truthy or valid. The current name can be misread when `issue` exists with an empty/null-like value.  
**Suggestion:** Rename it to `expectedIssuePresent` or `expectedIssuePropertyPresent` so the guard clearly describes property presence rather than semantic issue existence.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `expectedHasIssue` is derived from whether `expectedIssue` exists, not whether the expected issue value is truthy or valid. The current name can be misread when `issue` exists with an empty/null-like value.  
**Suggestion:** Rename it to `expectedIssuePresent` or `expectedIssuePropertyPresent` so the guard clearly describes property presence rather than semantic issue existence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 4. Rename Recovery Helper To Reflect Side Effect
**Finding key:** loop-fe9de9e33de4ab0f7a6b
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** `recoverStaleTestEvidence` sounds like a pure classification/recovery calculation, but it invalidates artifacts through `mismatch.recover(...)` and can move the active flow step.  
**Suggestion:** Rename it to something side-effect explicit, for example `invalidateStaleTestEvidenceAndReturnToTestExecute`, or split detection from mutation with `detectStaleTestEvidence(...)` and `recoverStaleTestEvidence(...)`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** `recoverStaleTestEvidence` sounds like a pure classification/recovery calculation, but it invalidates artifacts through `mismatch.recover(...)` and can move the active flow step.  
**Suggestion:** Rename it to something side-effect explicit, for example `invalidateStaleTestEvidenceAndReturnToTestExecute`, or split detection from mutation with `detectStaleTestEvidence(...)` and `recoverStaleTestEvidence(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 5. Use A Constant For Artifact Name
**Finding key:** loop-e40d53a0e1c17c8153ad
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** `"test-execute-result.json"` is introduced as a string literal while `FINAL_REGRESSION_RESULT_FILE` already uses a named constant pattern.  
**Suggestion:** Use an existing constant if available in this file, or introduce a local `TEST_EXECUTE_RESULT_FILE` constant so stale-evidence recovery cannot drift from `testExecuteArtifactPath(specDir)`.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** `"test-execute-result.json"` is introduced as a string literal while `FINAL_REGRESSION_RESULT_FILE` already uses a named constant pattern.  
**Suggestion:** Use an existing constant if available in this file, or introduce a local `TEST_EXECUTE_RESULT_FILE` constant so stale-evidence recovery cannot drift from `testExecuteArtifactPath(specDir)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Reuse Diff Filtering Helper
**Finding key:** loop-d0441f5061d211029027
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` duplicates the diff-segment parsing pattern already used by `excludeScenarioValidityEvidenceFromTaskGateDiff`: split on `diff --git`, parse the `b/` path, filter, and join. That makes future lifecycle/evidence exclusions easier to drift apart.  
**Suggestion:** Extract a small shared helper such as `excludeDiffFiles(diff, predicate)` and implement both exclusion functions through it.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` duplicates the diff-segment parsing pattern already used by `excludeScenarioValidityEvidenceFromTaskGateDiff`: split on `diff --git`, parse the `b/` path, filter, and join. That makes future lifecycle/evidence exclusions easier to drift apart.  
**Suggestion:** Extract a small shared helper such as `excludeDiffFiles(diff, predicate)` and implement both exclusion functions through it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Avoid Exporting Internal Helper Unless Needed
**Finding key:** loop-21ca77334faf9205b8fd
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` is exported, but the diff shows only internal use through `buildGateEvaluationDiff`. If no tests or external modules need it, this expands the module API unnecessarily.  
**Suggestion:** Keep it non-exported, or export only the higher-level behavior that is intentionally part of the module contract.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` is exported, but the diff shows only internal use through `buildGateEvaluationDiff`. If no tests or external modules need it, this expands the module API unnecessarily.  
**Suggestion:** Keep it non-exported, or export only the higher-level behavior that is intentionally part of the module contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Simplify Repeated Gate Diff Construction
**Finding key:** loop-4e3478170abf5b22ea4e
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** The same `buildGateEvaluationDiff({ committed, uncommitted, untracked, specPath: state.spec })` block is repeated in both gate paths. The surrounding collection code is also nearly identical.  
**Suggestion:** Extract a helper that collects committed, uncommitted, and untracked diffs, then applies lifecycle filtering once. This would reduce duplication and make the lifecycle-artifact exclusion harder to forget in future gate paths.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** The same `buildGateEvaluationDiff({ committed, uncommitted, untracked, specPath: state.spec })` block is repeated in both gate paths. The surrounding collection code is also nearly identical.  
**Suggestion:** Extract a helper that collects committed, uncommitted, and untracked diffs, then applies lifecycle filtering once. This would reduce duplication and make the lifecycle-artifact exclusion harder to forget in future gate paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 3. Rename ambiguous scope context helper
**Finding key:** loop-a63aeeb500f258a28ec6
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `ReviewCompletionScope.context(ctx)` is terse and easy to confuse with a generic context accessor. It actually resolves a task-scoped or flow-scoped review context.  
**Suggestion:** Rename it to something explicit like `resolveReviewContext(ctx)` or `toReviewContext(ctx)`, and update call sites.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `ReviewCompletionScope.context(ctx)` is terse and easy to confuse with a generic context accessor. It actually resolves a task-scoped or flow-scoped review context.  
**Suggestion:** Rename it to something explicit like `resolveReviewContext(ctx)` or `toReviewContext(ctx)`, and update call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 4. Consolidate repeated `completionScope.taskId` usage
**Finding key:** loop-b948fa6d12e94eb94c61
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `completionScope.taskId` is threaded repeatedly through `canonicalReviewExecutionBlock`, failure envelopes, finalization, tooling persistence, and parsed artifacts. The repetition makes it easier for a future edit to accidentally reintroduce `currentTaskId` fallback behavior.  
**Suggestion:** Assign `const reviewTaskId = completionScope.taskId;` immediately after creating the scope and use that variable consistently throughout the execution path.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `completionScope.taskId` is threaded repeatedly through `canonicalReviewExecutionBlock`, failure envelopes, finalization, tooling persistence, and parsed artifacts. The repetition makes it easier for a future edit to accidentally reintroduce `currentTaskId` fallback behavior.  
**Suggestion:** Assign `const reviewTaskId = completionScope.taskId;` immediately after creating the scope and use that variable consistently throughout the execution path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Avoid repeated convergence record scans
**Finding key:** loop-d8f890cce526d544d6bf
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** `latestReviewConvergenceRecord(ctx.flowState, p, reviewTaskId)` is called after `unchangedReviewConvergenceTarget(...)` already scanned the same records for the normalized review phase. For review reset paths this duplicates traversal and allocation.  
**Suggestion:** Resolve `currentTreeSha` and the latest matching review record once before the unchanged-tree check, then reuse that record when building `ReviewToolingRecoveryMutation`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** `latestReviewConvergenceRecord(ctx.flowState, p, reviewTaskId)` is called after `unchangedReviewConvergenceTarget(...)` already scanned the same records for the normalized review phase. For review reset paths this duplicates traversal and allocation.  
**Suggestion:** Resolve `currentTreeSha` and the latest matching review record once before the unchanged-tree check, then reuse that record when building `ReviewToolingRecoveryMutation`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Replace `filter(...).last` with reverse search
**Finding key:** loop-3482e2e9d288bb886d15
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `latestReviewConvergenceRecord` builds a full `matching` array only to return the last element. That is unnecessary bulk allocation and weaker against the bounded-resource guardrail.  
**Suggestion:** Iterate from the end of `records` and return the first matching record. This preserves “latest record” behavior while avoiding an intermediate array.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `latestReviewConvergenceRecord` builds a full `matching` array only to return the last element. That is unnecessary bulk allocation and weaker against the bounded-resource guardrail.  
**Suggestion:** Iterate from the end of `records` and return the first matching record. This preserves “latest record” behavior while avoiding an intermediate array.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Extract Recovered Evidence Refresh Predicate
**Finding key:** loop-c5941c648d1964fa6205
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The new `final-regression` post-hook repeats the same recovered-result predicate already used by `gate` and `review`:

```js
result?.result === "recovered"
&& result?.artifacts?.evidenceRefresh?.recovered === true
```

This duplicates flow-control semantics in multiple registry hooks, making future changes easy to miss.

**Suggestion:** Add a small local helper in `registry.js`, for example `isRecoveredEvidenceRefreshResult(result)`, and use it in all three touched/nearby post-hook checks. This keeps the R7 recovery semantics centralized without changing behavior.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The new `final-regression` post-hook repeats the same recovered-result predicate already used by `gate` and `review`:

```js
result?.result === "recovered"
&& result?.artifacts?.evidenceRefresh?.recovered === true
```

This duplicates flow-control semantics in multiple registry hooks, making future changes easy to miss.

**Suggestion:** Add a small local helper in `registry.js`, for example `isRecoveredEvidenceRefreshResult(result)`, and use it in all three touched/nearby post-hook checks. This keeps the R7 recovery semantics centralized without changing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Make the post-hook assertion more specific
**Finding key:** loop-09ba95ddddac029817c3
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression-record-and-proceed.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R7  
**Issue:** The new post-hook test verifies that no step status update occurs, but it does not make the stale-evidence recovery shape easy to distinguish from any other artifact-only recovered result.  
**Suggestion:** Rename `updated` to `statusTransitions` and add a short assertion that the supplied result is the stale-evidence recovery case under test, for example by assigning the result payload to a named `staleEvidenceRecovery` constant before passing it into `post`.
**Suggestion:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R7  
**Issue:** The new post-hook test verifies that no step status update occurs, but it does not make the stale-evidence recovery shape easy to distinguish from any other artifact-only recovered result.  
**Suggestion:** Rename `updated` to `statusTransitions` and add a short assertion that the supplied result is the stale-evidence recovery case under test, for example by assigning the result payload to a named `staleEvidenceRecovery` constant before passing it into `post`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Extract stale evidence artifact paths
**Finding key:** loop-c60bb042884a93c560dc
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R7  
**Issue:** The new stale-evidence test repeats the same three artifact paths across setup and deletion assertions, making the test slightly brittle if the recovery artifact set changes.  
**Suggestion:** Define a local `staleEvidencePaths` array in the test and use it for both `writeFile` setup and `existsSync` assertions.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R7  
**Issue:** The new stale-evidence test repeats the same three artifact paths across setup and deletion assertions, making the test slightly brittle if the recovery artifact set changes.  
**Suggestion:** Define a local `staleEvidencePaths` array in the test and use it for both `writeFile` setup and `existsSync` assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Rename fingerprint variables for intent
**Finding key:** loop-85947f7c4b0f1f81732b
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R7  
**Issue:** `previous` and `current` are understandable but generic; the test is specifically comparing repair fingerprints before and after a source change.  
**Suggestion:** Rename them to `staleFingerprint` and `refreshedFingerprint` or `previousRepairFingerprint` and `currentRepairFingerprint` to make the stale-evidence recovery behavior clearer.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R7  
**Issue:** `previous` and `current` are understandable but generic; the test is specifically comparing repair fingerprints before and after a source change.  
**Suggestion:** Rename them to `staleFingerprint` and `refreshedFingerprint` or `previousRepairFingerprint` and `currentRepairFingerprint` to make the stale-evidence recovery behavior clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Avoid Duplicated Path Literals in Assertions
**Finding key:** loop-41b5db3fefbb51d5e9c7
**Failure mode:** refactor
**File:** tests/unit/flow/gate-diff-compaction.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** The test defines `flowState`, `gateResult`, `testResult`, `specTest`, and `implementation`, but the assertions repeat separate regex path fragments. This creates small drift risk if the fixture paths change.  
**Suggestion:** Add a local helper such as `assertIncludesPath(filtered, path)` / `assertExcludesPath(filtered, path)` or derive regexes from the same path constants used to build the diff.
**Suggestion:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** The test defines `flowState`, `gateResult`, `testResult`, `specTest`, and `implementation`, but the assertions repeat separate regex path fragments. This creates small drift risk if the fixture paths change.  
**Suggestion:** Add a local helper such as `assertIncludesPath(filtered, path)` / `assertExcludesPath(filtered, path)` or derive regexes from the same path constants used to build the diff.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Extract the Exhausted Review Record Fixture
**Finding key:** loop-5879369f18bbcf194124
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The new test inlines a large `reviewConvergence.records[0]` object. Most fields are setup noise, while the important behavior is limited to `treeSha`, `toolingAttempts`, `toolingMaxAttempts`, and semantic attempt preservation.  
**Suggestion:** Extract a same-file helper like `makeToolingExhaustedReviewRecord({ previousTreeSha })` with defaults. Keep only test-specific values inline so the convergence behavior is easier to review.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The new test inlines a large `reviewConvergence.records[0]` object. Most fields are setup noise, while the important behavior is limited to `treeSha`, `toolingAttempts`, `toolingMaxAttempts`, and semantic attempt preservation.  
**Suggestion:** Extract a same-file helper like `makeToolingExhaustedReviewRecord({ previousTreeSha })` with defaults. Keep only test-specific values inline so the convergence behavior is easier to review.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Name the Hash Fixture Values by Role
**Finding key:** loop-3c168bfeae746868f7a0
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R7  
**Issue:** The test uses `"1".repeat(40)`, `"2".repeat(40)`, and `"3".repeat(64)` directly. `previousTreeSha` and `nextTreeSha` are clear, but the digest value’s purpose is less obvious and the repeated literal pattern makes it easy to confuse SHA-1 and SHA-256 sized fixtures.  
**Suggestion:** Introduce named constants or helpers such as `OLD_TREE_SHA`, `NEW_TREE_SHA`, and `TARGET_STATE_DIGEST` near the test setup. This improves readability without changing behavior.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R7  
**Issue:** The test uses `"1".repeat(40)`, `"2".repeat(40)`, and `"3".repeat(64)` directly. `previousTreeSha` and `nextTreeSha` are clear, but the digest value’s purpose is less obvious and the repeated literal pattern makes it easy to confuse SHA-1 and SHA-256 sized fixtures.  
**Suggestion:** Introduce named constants or helpers such as `OLD_TREE_SHA`, `NEW_TREE_SHA`, and `TARGET_STATE_DIGEST` near the test setup. This improves readability without changing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 1. Centralize Review Convergence Retention Rules
**Finding key:** loop-f3f469daad8d1d6cb116
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** Multiple artifacts now raise the same bounded-growth concern for review convergence state, issue-log entries, recovery baselines, evidence histories, metrics, and repeated gate observations. The retention behavior appears spread across `flow.json`, `issue-log.json`, and implementation/test expectations rather than defined once.
**Suggestion:** Add one canonical retention/compaction policy for review convergence and lifecycle evidence, then reference it from `flow.json`, `issue-log.json`, and tests instead of describing per-artifact bounds independently.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** Multiple artifacts now raise the same bounded-growth concern for review convergence state, issue-log entries, recovery baselines, evidence histories, metrics, and repeated gate observations. The retention behavior appears spread across `flow.json`, `issue-log.json`, and implementation/test expectations rather than defined once.
**Suggestion:** Add one canonical retention/compaction policy for review convergence and lifecycle evidence, then reference it from `flow.json`, `issue-log.json`, and tests instead of describing per-artifact bounds independently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 2. Align Review History Schema Across Attempts
**Finding key:** loop-c138cd6e6fae8e55396c
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`
**Requirement:** R1
**Issue:** Attempt 001 and attempt 002 store the same draft-review finding with different field shapes: attempt 001 omits `target` and `evidence` in `findings[0]`, while attempt 002 includes them. This creates a cross-file interface inconsistency for consumers reading review-history attempts.
**Suggestion:** Normalize both attempt files to the same schema, either by including `target` and `evidence` in all `findings` entries or by keeping that detail only in `repairTargets` across both files.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`
**Requirement:** R1
**Issue:** Attempt 001 and attempt 002 store the same draft-review finding with different field shapes: attempt 001 omits `target` and `evidence` in `findings[0]`, while attempt 002 includes them. This creates a cross-file interface inconsistency for consumers reading review-history attempts.
**Suggestion:** Normalize both attempt files to the same schema, either by including `target` and `evidence` in all `findings` entries or by keeping that detail only in `repairTargets` across both files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 3. Unify Recovery Result Predicate Naming
**Finding key:** loop-c2f0bdb9447a3322d844
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/registry.js`
**Requirement:** R7
**Issue:** The same recovered evidence-refresh condition is repeated across `gate`, `review`, and `final-regression` post-hooks, while related recovery behavior is also named differently in `run-final-regression.js`. This spreads one lifecycle interface across files and increases drift risk.
**Suggestion:** Introduce a shared helper such as `isRecoveredEvidenceRefreshResult(result)` and use it in all registry hooks. Consider aligning recovery function names around the same “evidence refresh recovery” wording.
**Suggestion:** **File:** `src/flow/registry.js`
**Requirement:** R7
**Issue:** The same recovered evidence-refresh condition is repeated across `gate`, `review`, and `final-regression` post-hooks, while related recovery behavior is also named differently in `run-final-regression.js`. This spreads one lifecycle interface across files and increases drift risk.
**Suggestion:** Introduce a shared helper such as `isRecoveredEvidenceRefreshResult(result)` and use it in all registry hooks. Consider aligning recovery function names around the same “evidence refresh recovery” wording.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 4. Share Diff File Filtering Logic
**Finding key:** loop-14d0f5a44f9885f80fe1
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** Gate lifecycle diff filtering duplicates the diff-segment parsing pattern already used for scenario-validity evidence filtering. This is a cross-function duplicate introduction in the same gate surface and can lead to inconsistent path filtering behavior.
**Suggestion:** Extract a shared `excludeDiffFiles(diff, predicate)` helper and route both lifecycle-artifact and scenario-validity evidence exclusions through it.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** Gate lifecycle diff filtering duplicates the diff-segment parsing pattern already used for scenario-validity evidence filtering. This is a cross-function duplicate introduction in the same gate surface and can lead to inconsistent path filtering behavior.
**Suggestion:** Extract a shared `excludeDiffFiles(diff, predicate)` helper and route both lifecycle-artifact and scenario-validity evidence exclusions through it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 5. Use Consistent Review Task ID Threading
**Finding key:** loop-caf8d7b733076e957dc9
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R5
**Issue:** `completionScope.taskId` is repeatedly passed through review execution, artifacts, failure envelopes, and finalization, while related convergence/retry code also resolves review task IDs separately. This creates a cross-file consistency risk around task-scoped versus flow-scoped review behavior.
**Suggestion:** Resolve `const reviewTaskId = completionScope.taskId` once in the review path and use that name consistently. Mirror that naming in convergence and retry helpers where the same task identity is consumed.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R5
**Issue:** `completionScope.taskId` is repeatedly passed through review execution, artifacts, failure envelopes, and finalization, while related convergence/retry code also resolves review task IDs separately. This creates a cross-file consistency risk around task-scoped versus flow-scoped review behavior.
**Suggestion:** Resolve `const reviewTaskId = completionScope.taskId` once in the review path and use that name consistently. Mirror that naming in convergence and retry helpers where the same task identity is consumed.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
