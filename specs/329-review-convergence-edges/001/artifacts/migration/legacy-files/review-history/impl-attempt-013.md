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

### 5. 1. Bound Accumulated Flow History Arrays
**Finding key:** loop-6f9b3b85ee9db1f431db
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, and `reviewRecoveryBaselines` grow as append-only history without an explicit retention cap in the artifact. This violates the `bounded-resource-usage` guardrail for bulk data loading/storage.
**Suggestion:** Add an explicit bounded retention policy to the flow artifact generation, such as keeping the latest N entries per phase/task identity plus a summarized overflow count, and persist that policy metadata in `flow.json`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, and `reviewRecoveryBaselines` grow as append-only history without an explicit retention cap in the artifact. This violates the `bounded-resource-usage` guardrail for bulk data loading/storage.
**Suggestion:** Add an explicit bounded retention policy to the flow artifact generation, such as keeping the latest N entries per phase/task identity plus a summarized overflow count, and persist that policy metadata in `flow.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Deduplicate Repeated Handoff Finding Metadata
**Finding key:** loop-7e314db48dfba69d092f
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R6
**Issue:** Every `reviewConvergence.records[*].handoffFindings[*]` repeats identical provenance, phase, taskId, treeSha, canonicalEvidenceRef, evidenceDigest, reviewDisposition, and finalDispositionOwner values. The large `impl` handoff list repeats the same evidence metadata dozens of times.
**Suggestion:** Store common evidence/provenance fields once at the convergence record level and keep each handoff finding limited to finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R6
**Issue:** Every `reviewConvergence.records[*].handoffFindings[*]` repeats identical provenance, phase, taskId, treeSha, canonicalEvidenceRef, evidenceDigest, reviewDisposition, and finalDispositionOwner values. The large `impl` handoff list repeats the same evidence metadata dozens of times.
**Suggestion:** Store common evidence/provenance fields once at the convergence record level and keep each handoff finding limited to finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Consolidate Duplicate Recovery Baselines
**Finding key:** loop-e4fc30c587e8424e2c45
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R3
**Issue:** `reviewRecoveryBaselines` contains multiple entries with the same `kind`, `phase`, `canonicalPhase`, `fingerprint.hash`, paths, components, and trigger, differing only by `createdAt`. This duplicates state and makes recovery intent harder to inspect.
**Suggestion:** Collapse identical baselines by fingerprint identity, preserving the earliest/latest timestamp or an occurrence count if audit history is needed.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R3
**Issue:** `reviewRecoveryBaselines` contains multiple entries with the same `kind`, `phase`, `canonicalPhase`, `fingerprint.hash`, paths, components, and trigger, differing only by `createdAt`. This duplicates state and makes recovery intent harder to inspect.
**Suggestion:** Collapse identical baselines by fingerprint identity, preserving the earliest/latest timestamp or an occurrence count if audit history is needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Remove Duplicate Changed File Fingerprints
**Finding key:** loop-9097a31585157735df2a
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** `changedFileFingerprints` includes exact duplicate path/fingerprint pairs, for example repeated `draft-review-questions.json`, `draft.json`, and `spec.json` entries. This adds noise and inflates final-regression evidence.
**Suggestion:** Deduplicate `changedFileFingerprints` by `(path, fingerprint)` before writing final-regression issue-log entries.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** `changedFileFingerprints` includes exact duplicate path/fingerprint pairs, for example repeated `draft-review-questions.json`, `draft.json`, and `spec.json` entries. This adds noise and inflates final-regression evidence.
**Suggestion:** Deduplicate `changedFileFingerprints` by `(path, fingerprint)` before writing final-regression issue-log entries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Bound Final Regression Fingerprint Lists
**Finding key:** loop-d38fa26161e5a1a6441a
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Final-regression issue-log entries embed very large `changedFileFingerprints` arrays. Without an explicit maximum, large specs or generated review histories can produce unbounded issue-log growth, violating `bounded-resource-usage`.
**Suggestion:** Cap the recorded fingerprint list and add summary fields such as `changedFileFingerprintCount`, `omittedFingerprintCount`, and optionally grouped counts by directory. Keep full details in a separate bounded artifact if needed.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Final-regression issue-log entries embed very large `changedFileFingerprints` arrays. Without an explicit maximum, large specs or generated review histories can produce unbounded issue-log growth, violating `bounded-resource-usage`.
**Suggestion:** Cap the recorded fingerprint list and add summary fields such as `changedFileFingerprintCount`, `omittedFingerprintCount`, and optionally grouped counts by directory. Keep full details in a separate bounded artifact if needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 6. Normalize Retry Recovery Entries
**Finding key:** loop-18d1ff585cf87b951bce
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R3
**Issue:** Retry recovery issue-log entries duplicate `grantId` and `id` with the same value, and repeat the same recovery payload already stored in `flow.json` under `retryRecovery.entries`.
**Suggestion:** Keep the issue-log entry as a lightweight event reference, such as `grantId`, `phase`, `reason`, and `timestamp`, and rely on the canonical recovery entry for full details.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R3
**Issue:** Retry recovery issue-log entries duplicate `grantId` and `id` with the same value, and repeat the same recovery payload already stored in `flow.json` under `retryRecovery.entries`.
**Suggestion:** Keep the issue-log entry as a lightweight event reference, such as `grantId`, `phase`, `reason`, and `timestamp`, and rely on the canonical recovery entry for full details.
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

### 15. 1. Remove Duplicated Overview Entries
**Finding key:** loop-90438923813a1cf0157e
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** The `overview.modules` and `overview.data_flow` sections contain overlapping entries for `src/flow/commands/review.js`, `src/flow/lib/review-convergence.js`, `src/flow/lib/set-retry.js`, and `src/flow/lib/run-review.js`. This makes the spec harder to maintain and increases the chance of stale or contradictory descriptions.  
**Suggestion:** Consolidate the original and `added_by_task` entries into one canonical entry per module/data-flow concept, preserving the useful task-specific detail without repeating the same ownership statement.
**Suggestion:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** The `overview.modules` and `overview.data_flow` sections contain overlapping entries for `src/flow/commands/review.js`, `src/flow/lib/review-convergence.js`, `src/flow/lib/set-retry.js`, and `src/flow/lib/run-review.js`. This makes the spec harder to maintain and increases the chance of stale or contradictory descriptions.  
**Suggestion:** Consolidate the original and `added_by_task` entries into one canonical entry per module/data-flow concept, preserving the useful task-specific detail without repeating the same ownership statement.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Normalize Target Separators Before Truncation
**Finding key:** loop-91dc40e30f0543b98710
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `this.target` is truncated by `normalizeTestReviewText()` before `replaceAll("\\", "/")` is applied. For long targets, equivalent slash/backslash paths can truncate at different positions before being canonicalized, producing avoidable identity instability.  
**Suggestion:** Normalize path separators before applying the canonical field length cap, for example by allowing `normalizeTestReviewText()` to accept a pre-normalized string or by introducing a dedicated `normalizeTestReviewTarget()` helper that trims, replaces separators, then truncates.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `this.target` is truncated by `normalizeTestReviewText()` before `replaceAll("\\", "/")` is applied. For long targets, equivalent slash/backslash paths can truncate at different positions before being canonicalized, producing avoidable identity instability.  
**Suggestion:** Normalize path separators before applying the canonical field length cap, for example by allowing `normalizeTestReviewText()` to accept a pre-normalized string or by introducing a dedicated `normalizeTestReviewTarget()` helper that trims, replaces separators, then truncates.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Name the Finding Body Used for Identity
**Finding key:** loop-4793dbd2b2db80dccbfe
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R2
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** The fourth fingerprint tuple element repeats the inline conditional `kind === "blocking" ? this.issue : this.improvement`. The same distinction is central to the finding identity contract, but it is unnamed at the call site.  
**Suggestion:** Assign the selected value to a clearly named local or instance field such as `identityBody` or `canonicalFindingBody` before calling `ReviewFindingFingerprint.fromCanonicalTuple()`. This makes the identity tuple easier to audit and reduces future risk of using `requiredChange` or rationale fields by mistake.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** The fourth fingerprint tuple element repeats the inline conditional `kind === "blocking" ? this.issue : this.improvement`. The same distinction is central to the finding identity contract, but it is unnamed at the call site.  
**Suggestion:** Assign the selected value to a clearly named local or instance field such as `identityBody` or `canonicalFindingBody` before calling `ReviewFindingFingerprint.fromCanonicalTuple()`. This makes the identity tuple easier to audit and reduces future risk of using `requiredChange` or rationale fields by mistake.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Extract fingerprint hashing helper
**Finding key:** loop-2c7e44a1875d6c24684f
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `ReviewFindingFingerprint.fromFinding()` and `fromCanonicalTuple()` duplicate the same SHA-256 creation over `stableStringify(...)`.  
**Suggestion:** Add a small private helper such as `fingerprintFromStableValue(value)` or `sha256Stable(value)` and use it in both methods. This keeps canonical tuple hashing consistent with existing finding identity hashing.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `ReviewFindingFingerprint.fromFinding()` and `fromCanonicalTuple()` duplicate the same SHA-256 creation over `stableStringify(...)`.  
**Suggestion:** Add a small private helper such as `fingerprintFromStableValue(value)` or `sha256Stable(value)` and use it in both methods. This keeps canonical tuple hashing consistent with existing finding identity hashing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Reuse target record replacement logic
**Finding key:** loop-7e5b877ea013a0962b02
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `ReviewToolingRecoveryMutation.apply()` reimplements the same clone-and-replace pattern already centralized in `replaceTargetRecord()`, including another full `records.map(structuredClone)` pass. This adds duplicate update logic and makes future record mutation behavior easier to drift.  
**Suggestion:** After validating the previous record and building `recovered`, call `replaceTargetRecord(flowState, target, { ...structuredClone(records[index]), ...recovered.toJSON() })`. This preserves the same CAS mutation behavior while following the existing design pattern.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `ReviewToolingRecoveryMutation.apply()` reimplements the same clone-and-replace pattern already centralized in `replaceTargetRecord()`, including another full `records.map(structuredClone)` pass. This adds duplicate update logic and makes future record mutation behavior easier to drift.  
**Suggestion:** After validating the previous record and building `recovered`, call `replaceTargetRecord(flowState, target, { ...structuredClone(records[index]), ...recovered.toJSON() })`. This preserves the same CAS mutation behavior while following the existing design pattern.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Bound convergence record bulk cloning
**Finding key:** loop-ca830e95c2265ec0d8e2
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** The new recovery mutation clones every `reviewConvergence.records` entry without an explicit upper bound. That conflicts with the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Introduce or reuse a maximum convergence record count before bulk cloning/replacement, and fail fast if `records.length` exceeds that bound.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** The new recovery mutation clones every `reviewConvergence.records` entry without an explicit upper bound. That conflicts with the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Introduce or reuse a maximum convergence record count before bulk cloning/replacement, and fail fast if `records.length` exceeds that bound.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Consolidate lifecycle diff filtering with existing diff-filter pattern
**Finding key:** loop-81edabd53e10deb4c2ed
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` duplicates the same segment-splitting/header-matching structure as `excludeScenarioValidityEvidenceFromTaskGateDiff`, which makes future gate diff exclusions harder to keep consistent.  
**Suggestion:** Extract a shared helper such as `excludeDiffSegments(diff, predicate)` and implement both exclusion functions through it, leaving only the artifact predicate different.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` duplicates the same segment-splitting/header-matching structure as `excludeScenarioValidityEvidenceFromTaskGateDiff`, which makes future gate diff exclusions harder to keep consistent.  
**Suggestion:** Extract a shared helper such as `excludeDiffSegments(diff, predicate)` and implement both exclusion functions through it, leaving only the artifact predicate different.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Add an explicit bound or documented cap around diff segment processing
**Finding key:** loop-91a0ce6d3c21ab18c5b5
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` splits the full concatenated committed/uncommitted/untracked diff into segments with no explicit upper bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Reuse an existing project diff-size limit if one exists in this file, or add a clear maximum diff byte/segment count before splitting and fail/report deterministically when exceeded.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` splits the full concatenated committed/uncommitted/untracked diff into segments with no explicit upper bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Reuse an existing project diff-size limit if one exists in this file, or add a clear maximum diff byte/segment count before splitting and fail/report deterministically when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 3. Make Review Scope Naming More Precise
**Finding key:** loop-9ca6d23e2e7c50c29ca7
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope` sounds like it represents a completed review, but it is also used before execution to decide the execution context and canonical identity. That makes the abstraction slightly misleading.  
**Suggestion:** Rename it to something closer to its role, such as `ReviewCanonicalScope` or `ReviewExecutionScope`, and keep `forExecution` / `forPostHook` as named constructors.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope` sounds like it represents a completed review, but it is also used before execution to decide the execution context and canonical identity. That makes the abstraction slightly misleading.  
**Suggestion:** Rename it to something closer to its role, such as `ReviewCanonicalScope` or `ReviewExecutionScope`, and keep `forExecution` / `forPostHook` as named constructors.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 4. Centralize Task ID Access on the Scope Object
**Finding key:** loop-8472b3eae47a038f5320
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `updateReviewRetryCounter` assigns `const resultTaskId = completionScope.taskId`, then uses both `resultTaskId` and `completionScope` in nearby code. This adds an alias without improving readability.  
**Suggestion:** Use `completionScope.taskId` directly, or add a small predicate like `completionScope.isTaskScoped()` if the branch needs a semantic name. This keeps one source of truth for the scoped task identity.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `updateReviewRetryCounter` assigns `const resultTaskId = completionScope.taskId`, then uses both `resultTaskId` and `completionScope` in nearby code. This adds an alias without improving readability.  
**Suggestion:** Use `completionScope.taskId` directly, or add a small predicate like `completionScope.isTaskScoped()` if the branch needs a semantic name. This keeps one source of truth for the scoped task identity.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 1. Avoid Duplicate Tree SHA Resolution
**Finding key:** loop-da636ff429323d35b8fd
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is called once for the unchanged-target check and again for every recovery mutation. This duplicates work and can make the operation harder to reason about if the target resolver ever becomes non-trivial.  
**Suggestion:** Resolve it once near `normalizedReviewPhase` / `reviewTaskId`, e.g. `const currentReviewTreeSha = kind === "review" ? resolveCurrentReviewTreeSha(ctx.root) : null;`, then pass that value into `unchangedReviewConvergenceTarget` and `ReviewToolingRecoveryMutation`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is called once for the unchanged-target check and again for every recovery mutation. This duplicates work and can make the operation harder to reason about if the target resolver ever becomes non-trivial.  
**Suggestion:** Resolve it once near `normalizedReviewPhase` / `reviewTaskId`, e.g. `const currentReviewTreeSha = kind === "review" ? resolveCurrentReviewTreeSha(ctx.root) : null;`, then pass that value into `unchangedReviewConvergenceTarget` and `ReviewToolingRecoveryMutation`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Replace Full Record Filtering With Reverse Search
**Finding key:** loop-b958b1b0d8657b96d0e3
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R7  
**Issue:** `latestReviewConvergenceRecord` builds a full `matching` array only to read the final element. That creates unnecessary allocation and scans every record even after the latest matching entry is found.  
**Suggestion:** Iterate backward through `records` and return the first matching record. This is simpler and avoids duplicate storage for potentially large convergence histories.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R7  
**Issue:** `latestReviewConvergenceRecord` builds a full `matching` array only to read the final element. That creates unnecessary allocation and scans every record even after the latest matching entry is found.  
**Suggestion:** Iterate backward through `records` and return the first matching record. This is simpler and avoids duplicate storage for potentially large convergence histories.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Document the `recovered` post-hook exception
**Finding key:** loop-4de873d957b589699aca
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R4  
**Issue:** The command description still says final regression “Persists” result artifacts, but the new `recovered` branch returns before validation/persistence. That makes the runtime behavior diverge from the registry metadata.  
**Suggestion:** Update the `FLOW_COMMANDS.final-regression` description text to explicitly mention that `recovered` is a no-persist recovery outcome that routes back to `test-execute`.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R4  
**Issue:** The command description still says final regression “Persists” result artifacts, but the new `recovered` branch returns before validation/persistence. That makes the runtime behavior diverge from the registry metadata.  
**Suggestion:** Update the `FLOW_COMMANDS.final-regression` description text to explicitly mention that `recovered` is a no-persist recovery outcome that routes back to `test-execute`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Name the recovered-result predicate
**Finding key:** loop-dbd0d434b4adc5adb6b8
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** The inline condition checks a fairly specific result shape: `result?.result === "recovered"` plus `result?.artifacts?.evidenceRefresh?.recovered === true`. That intent is easy to miss inside the `post` hook.  
**Suggestion:** Extract the condition into a small local helper or named boolean, for example `const isEvidenceRefreshRecovery = ...`, then use that in the early return. This makes the special-case control flow clearer without changing behavior.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** The inline condition checks a fairly specific result shape: `result?.result === "recovered"` plus `result?.artifacts?.evidenceRefresh?.recovered === true`. That intent is easy to miss inside the `post` hook.  
**Suggestion:** Extract the condition into a small local helper or named boolean, for example `const isEvidenceRefreshRecovery = ...`, then use that in the early return. This makes the special-case control flow clearer without changing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Name the captured transitions by domain intent
**Finding key:** loop-d8cccf42996293edbdc7
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression-record-and-proceed.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R2  
**Issue:** The test variable `updated` is generic; it actually captures step status transitions from `updateStepStatus`.  
**Suggestion:** Rename it to `statusTransitions` or `recordedTransitions` to make the assertion `assert.deepEqual(statusTransitions, [])` self-documenting.
**Suggestion:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R2  
**Issue:** The test variable `updated` is generic; it actually captures step status transitions from `updateStepStatus`.  
**Suggestion:** Rename it to `statusTransitions` or `recordedTransitions` to make the assertion `assert.deepEqual(statusTransitions, [])` self-documenting.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Extract stale artifact setup helper
**Finding key:** loop-fb5bfa0821c312905883
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R1  
**Issue:** The stale-evidence test repeats the same `writeFile(... JSON.stringify({ repairFingerprint: previous.hash }, null, 2))` pattern for multiple artifacts, making the intent slightly harder to scan and increasing maintenance cost if the artifact shape changes.  
**Suggestion:** Add a small local helper in the test, such as `writeStaleRepairFingerprintArtifact(tmp, relativePath, fingerprint)`, and use it for `test-execute-result.json` and `retro.json`.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R1  
**Issue:** The stale-evidence test repeats the same `writeFile(... JSON.stringify({ repairFingerprint: previous.hash }, null, 2))` pattern for multiple artifacts, making the intent slightly harder to scan and increasing maintenance cost if the artifact shape changes.  
**Suggestion:** Add a small local helper in the test, such as `writeStaleRepairFingerprintArtifact(tmp, relativePath, fingerprint)`, and use it for `test-execute-result.json` and `retro.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Use more descriptive fingerprint names
**Finding key:** loop-3104b8053940f3e6d885
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R2  
**Issue:** The variables `previous` and `current` are repair fingerprint objects, but their names are broad and easy to confuse with flow state or artifact contents.  
**Suggestion:** Rename them to `previousFingerprint` and `currentFingerprint`, or `staleFingerprint` and `freshFingerprint`, so assertions like `evidenceRefresh.previousFingerprint` read more clearly.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R2  
**Issue:** The variables `previous` and `current` are repair fingerprint objects, but their names are broad and easy to confuse with flow state or artifact contents.  
**Suggestion:** Rename them to `previousFingerprint` and `currentFingerprint`, or `staleFingerprint` and `freshFingerprint`, so assertions like `evidenceRefresh.previousFingerprint` read more clearly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Rename lifecycle evidence test variables for intent
**Finding key:** loop-b155b8a34bb00feddfd3
**Failure mode:** refactor
**File:** tests/unit/flow/gate-diff-compaction.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** Names like `flowState` and `gateResult` describe file contents generally, but the assertion depends specifically on these being protected active gate lifecycle artifacts.  
**Suggestion:** Rename them to intent-bearing names such as `activeFlowStateArtifact` and `activeGateResultArtifact`, making the protected-vs-retained evidence distinction obvious from the setup.
**Suggestion:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** Names like `flowState` and `gateResult` describe file contents generally, but the assertion depends specifically on these being protected active gate lifecycle artifacts.  
**Suggestion:** Rename them to intent-bearing names such as `activeFlowStateArtifact` and `activeGateResultArtifact`, making the protected-vs-retained evidence distinction obvious from the setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Extract changed-tree review setup helper
**Finding key:** loop-a6c35ac7c29e18e66807
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The new test embeds a large `reviewConvergence.records[0]` fixture inline, which makes the actual behavior under test harder to see and will be costly to duplicate for nearby retry/convergence cases.  
**Suggestion:** Move the exhausted review convergence record into a small local helper such as `makeToolingExhaustedReviewRecord({ previousTreeSha })`, then keep the test focused on the changed tree, reset, and mutation assertions.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The new test embeds a large `reviewConvergence.records[0]` fixture inline, which makes the actual behavior under test harder to see and will be costly to duplicate for nearby retry/convergence cases.  
**Suggestion:** Move the exhausted review convergence record into a small local helper such as `makeToolingExhaustedReviewRecord({ previousTreeSha })`, then keep the test focused on the changed tree, reset, and mutation assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Avoid hard-coded convergence record indexing
**Finding key:** loop-f60e0e0b7640f208ff2d
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R7  
**Issue:** The assertions repeatedly access `recovered.reviewConvergence.records[0]`, which is noisy and obscures the bucket invariant being checked.  
**Suggestion:** Assign `const [record] = recovered.reviewConvergence.records;` after asserting the length, then assert against `record.treeSha`, `record.toolingAttempts`, etc. This simplifies the test without changing behavior.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R7  
**Issue:** The assertions repeatedly access `recovered.reviewConvergence.records[0]`, which is noisy and obscures the bucket invariant being checked.  
**Suggestion:** Assign `const [record] = recovered.reviewConvergence.records;` after asserting the length, then assert against `record.treeSha`, `record.toolingAttempts`, etc. This simplifies the test without changing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Centralize Review Convergence Retention Policy
**Finding key:** loop-97a278e8d9a85712305a
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** Multiple files introduce or expose unbounded convergence-related histories: `flow.json` records/evidence histories, `issue-log.json` changed-file fingerprints, and code paths that bulk-clone or scan convergence records. The same bounded-resource concern is being addressed piecemeal across artifacts, runtime code, and tests.  
**Suggestion:** Define one explicit convergence/history retention policy in the runtime layer, then have artifact writers and tests assert against that shared limit instead of adding separate caps or cleanup behavior per file.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** Multiple files introduce or expose unbounded convergence-related histories: `flow.json` records/evidence histories, `issue-log.json` changed-file fingerprints, and code paths that bulk-clone or scan convergence records. The same bounded-resource concern is being addressed piecemeal across artifacts, runtime code, and tests.  
**Suggestion:** Define one explicit convergence/history retention policy in the runtime layer, then have artifact writers and tests assert against that shared limit instead of adding separate caps or cleanup behavior per file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Normalize Review Recovery Payload Ownership
**Finding key:** loop-0d6b58947061adeca2c8
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R3  
**Issue:** Recovery state appears duplicated across `flow.json` recovery baselines, `issue-log.json` retry recovery entries, and review convergence recovery mutations. This creates unclear ownership over which artifact is canonical for full recovery details.  
**Suggestion:** Make `flow.json` or the convergence record the canonical recovery payload, and have `issue-log.json` store only lightweight references such as `grantId`, `phase`, `reason`, and timestamp.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R3  
**Issue:** Recovery state appears duplicated across `flow.json` recovery baselines, `issue-log.json` retry recovery entries, and review convergence recovery mutations. This creates unclear ownership over which artifact is canonical for full recovery details.  
**Suggestion:** Make `flow.json` or the convergence record the canonical recovery payload, and have `issue-log.json` store only lightweight references such as `grantId`, `phase`, `reason`, and timestamp.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Unify Review Finding Identity Naming
**Finding key:** loop-2545c11b2db681c7c275
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R2
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** Finding identity concepts are named inconsistently across files: `identityBody`/canonical tuple ideas in `review.js`, fingerprint hashing in `finding-disposition-policy.js`, and duplicated finding payloads in review-history artifacts. This makes it harder to tell which fields participate in stable identity.  
**Suggestion:** Introduce consistent terminology such as `canonicalFindingBody` and `canonicalFindingFingerprint`, and use it across runtime code, serialized review-history artifacts, and tests.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** Finding identity concepts are named inconsistently across files: `identityBody`/canonical tuple ideas in `review.js`, fingerprint hashing in `finding-disposition-policy.js`, and duplicated finding payloads in review-history artifacts. This makes it harder to tell which fields participate in stable identity.  
**Suggestion:** Introduce consistent terminology such as `canonicalFindingBody` and `canonicalFindingFingerprint`, and use it across runtime code, serialized review-history artifacts, and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Consolidate Review Scope and Task Identity Access
**Finding key:** loop-38937b6be8261fe81f31
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Review task identity is represented through several overlapping names and aliases across `run-review.js`, `set-retry.js`, convergence records, and issue-log recovery entries. Examples include `completionScope.taskId`, `resultTaskId`, `reviewTaskId`, and duplicated `grantId`/`id`.  
**Suggestion:** Use one canonical scope object or identity accessor for review phase/task identity, and avoid local aliases unless they add domain meaning.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Review task identity is represented through several overlapping names and aliases across `run-review.js`, `set-retry.js`, convergence records, and issue-log recovery entries. Examples include `completionScope.taskId`, `resultTaskId`, `reviewTaskId`, and duplicated `grantId`/`id`.  
**Suggestion:** Use one canonical scope object or identity accessor for review phase/task identity, and avoid local aliases unless they add domain meaning.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Deduplicate Generated Review Attempt Artifacts
**Finding key:** loop-6e53ba433307991456ae
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-002.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-002.json`  
**Requirement:** R3  
**Issue:** Generated review artifacts repeat nearly identical content across attempt history, draft review questions, and convergence handoff records. This inflates the change set and makes real semantic differences harder to inspect across files.  
**Suggestion:** Store repeated finding details once and let later attempts or handoff records reference the canonical finding by ID/fingerprint, preserving only attempt-specific deltas.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-002.json`  
**Requirement:** R3  
**Issue:** Generated review artifacts repeat nearly identical content across attempt history, draft review questions, and convergence handoff records. This inflates the change set and makes real semantic differences harder to inspect across files.  
**Suggestion:** Store repeated finding details once and let later attempts or handoff records reference the canonical finding by ID/fingerprint, preserving only attempt-specific deltas.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
