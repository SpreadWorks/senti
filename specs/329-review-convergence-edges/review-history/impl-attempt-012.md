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

### 5. 1. Bound Generated History Arrays
**Finding key:** loop-008bfab887ecf3cec9e1
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, `reviewRecoveryBaselines`, and `acceptanceReview.deferredFindings` can grow indefinitely across retries and review cycles. This violates the bounded-resource-usage guardrail for bulk generated history.
**Suggestion:** Add explicit retention limits for generated arrays, for example keeping the latest N records per phase/task identity and summarizing or pruning older entries into a bounded aggregate.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, `reviewRecoveryBaselines`, and `acceptanceReview.deferredFindings` can grow indefinitely across retries and review cycles. This violates the bounded-resource-usage guardrail for bulk generated history.
**Suggestion:** Add explicit retention limits for generated arrays, for example keeping the latest N records per phase/task identity and summarizing or pruning older entries into a bounded aggregate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Deduplicate Repeated Handoff Finding Metadata
**Finding key:** loop-bad9cde7102fbc8518ad
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R5
**Issue:** Each `handoffFindings` entry repeats identical `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values. This makes the artifact much larger and harder to inspect.
**Suggestion:** Store shared handoff context once at the convergence record level, and keep each finding entry limited to per-finding fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R5
**Issue:** Each `handoffFindings` entry repeats identical `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values. This makes the artifact much larger and harder to inspect.
**Suggestion:** Store shared handoff context once at the convergence record level, and keep each finding entry limited to per-finding fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Normalize Duplicate Recovery Baselines
**Finding key:** loop-edc79e5d930b5b9583f3
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R3
**Issue:** `reviewRecoveryBaselines` contains several entries with the same `kind`, `phase`, `canonicalPhase`, `fingerprint.hash`, `paths`, and trigger, differing only by `createdAt`. This is duplicated state rather than distinct evidence.
**Suggestion:** Collapse identical baseline fingerprints into one record with a bounded `attempts` or `createdAtHistory` count, or replace repeated entries when the fingerprint is unchanged.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R3
**Issue:** `reviewRecoveryBaselines` contains several entries with the same `kind`, `phase`, `canonicalPhase`, `fingerprint.hash`, `paths`, and trigger, differing only by `createdAt`. This is duplicated state rather than distinct evidence.
**Suggestion:** Collapse identical baseline fingerprints into one record with a bounded `attempts` or `createdAtHistory` count, or replace repeated entries when the fingerprint is unchanged.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Remove Redundant Recovery Entry Duplication
**Finding key:** loop-805e5cb84283d7c166e5
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R3
**Issue:** Retry recovery information is stored both in `flow.json.retryRecovery.entries` and again as full `issue-log.json` entries with the same `id`, `changedEvidence`, `attemptsBefore`, `maxAttempts`, and `recoveryCommand`.
**Suggestion:** In the issue log, keep only a concise reference to the recovery id and human-readable reason, and let `flow.json.retryRecovery.entries` remain the canonical structured source.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R3
**Issue:** Retry recovery information is stored both in `flow.json.retryRecovery.entries` and again as full `issue-log.json` entries with the same `id`, `changedEvidence`, `attemptsBefore`, `maxAttempts`, and `recoveryCommand`.
**Suggestion:** In the issue log, keep only a concise reference to the recovery id and human-readable reason, and let `flow.json.retryRecovery.entries` remain the canonical structured source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Consolidate Repeated Gate Failure Observations
**Finding key:** loop-abee321d9f60885701c3
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Several issue-log entries repeat near-identical project-test-integrity observations for each T-3 gate attempt. This inflates the artifact and obscures the actual lifecycle problem.
**Suggestion:** Represent repeated attempt observations as one grouped entry with an `attempts: [1, 2, 3, 4]` field and one shared observation body.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Several issue-log entries repeat near-identical project-test-integrity observations for each T-3 gate attempt. This inflates the artifact and obscures the actual lifecycle problem.
**Suggestion:** Represent repeated attempt observations as one grouped entry with an `attempts: [1, 2, 3, 4]` field and one shared observation body.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Avoid duplicated issue number state
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

### 11. 1. Normalize duplicated finding payloads
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

### 12. 2. Fix inconsistent severity/verdict wording
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

### 13. 3. Avoid storing identical generated history snapshots
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

### 14. 1. Remove Duplicated Overview Entries
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

### 15. 2. Normalize Target Separators Before Truncation
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

### 16. 3. Name the Finding Body Used for Identity
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

### 17. 1. Extract fingerprint hashing helper
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

### 18. 2. Reuse target record replacement logic
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

### 19. 3. Bound convergence record bulk cloning
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

### 20. 1. Centralize Diff Segment Filtering
**Finding key:** loop-82c5efa0b31de8962afd
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeScenarioValidityEvidenceFromTaskGateDiff` and `excludeGateLifecycleArtifactsFromGateDiff` duplicate the same diff splitting, header extraction, filtering, and joining pattern.  
**Suggestion:** Extract a shared helper such as `excludeDiffFiles(diff, shouldExclude)` or `filterDiffSegments(diff, keepSegment)` and have both functions supply only their path predicate. This keeps future gate diff exclusions consistent and reduces regex duplication.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeScenarioValidityEvidenceFromTaskGateDiff` and `excludeGateLifecycleArtifactsFromGateDiff` duplicate the same diff splitting, header extraction, filtering, and joining pattern.  
**Suggestion:** Extract a shared helper such as `excludeDiffFiles(diff, shouldExclude)` or `filterDiffSegments(diff, keepSegment)` and have both functions supply only their path predicate. This keeps future gate diff exclusions consistent and reduces regex duplication.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Bound Gate Diff Filtering Work
**Finding key:** loop-3a7a13aa070226998195
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` splits the full diff into an array with no explicit size/count bound. Since gate diffs may include bulk generated output, this conflicts with the bounded-resource-usage guardrail’s preference for explicit limits around bulk processing.  
**Suggestion:** Add an explicit upper bound before filtering, or process segments incrementally without materializing all segments at once. If the existing full-diff handling is intentionally bounded elsewhere, document that bound at this helper boundary.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` splits the full diff into an array with no explicit size/count bound. Since gate diffs may include bulk generated output, this conflicts with the bounded-resource-usage guardrail’s preference for explicit limits around bulk processing.  
**Suggestion:** Add an explicit upper bound before filtering, or process segments incrementally without materializing all segments at once. If the existing full-diff handling is intentionally bounded elsewhere, document that bound at this helper boundary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Replace Lifecycle Artifact Chain With Named Constants
**Finding key:** loop-104d0bb4a899d2b2ac51
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `isGateLifecycleArtifactForGate` uses a long inline `||` chain plus a regex for related lifecycle artifact names. This makes the exclusion policy harder to scan and easier to update inconsistently.  
**Suggestion:** Move the exact artifact names into a `Set`, for example `GATE_LIFECYCLE_ARTIFACTS`, and keep the regex as a separately named predicate such as `isGatePhaseArtifact(localPath)`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `isGateLifecycleArtifactForGate` uses a long inline `||` chain plus a regex for related lifecycle artifact names. This makes the exclusion policy harder to scan and easier to update inconsistently.  
**Suggestion:** Move the exact artifact names into a `Set`, for example `GATE_LIFECYCLE_ARTIFACTS`, and keep the regex as a separately named predicate such as `isGatePhaseArtifact(localPath)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 4. Rename Or Simplify `ReviewCompletionScope`
**Finding key:** loop-e4a0cbe6703abb7b4935
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope` is used for both execution-time review scope and post-hook result scope, so “Completion” is narrower than the actual responsibility. The class also mostly wraps phase/taskId derivation and `reviewContextForTaskId`.  
**Suggestion:** Rename it to something broader like `ReviewScope` or `ReviewAttemptScope`, or simplify it to pure helpers such as `resolveReviewScopeForExecution` and `resolveReviewScopeForPostHook` that return `{ phase, taskId, ctx }`. This would better match the procedural style already used in this file.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope` is used for both execution-time review scope and post-hook result scope, so “Completion” is narrower than the actual responsibility. The class also mostly wraps phase/taskId derivation and `reviewContextForTaskId`.  
**Suggestion:** Rename it to something broader like `ReviewScope` or `ReviewAttemptScope`, or simplify it to pure helpers such as `resolveReviewScopeForExecution` and `resolveReviewScopeForPostHook` that return `{ phase, taskId, ctx }`. This would better match the procedural style already used in this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Cache the current review tree SHA once
**Finding key:** loop-e912b3915e6e4078ac84
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is called in `unchangedReviewConvergenceTarget()` and again when constructing each `ReviewToolingRecoveryMutation`. If this resolver is filesystem-backed or non-trivial, this duplicates work and risks subtle inconsistency if the working tree changes during command execution.  
**Suggestion:** Resolve `const currentReviewTreeSha = resolveCurrentReviewTreeSha(ctx.root)` once near the start of `execute()`, then pass it into `unchangedReviewConvergenceTarget()` and use it for `nextTreeSha`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is called in `unchangedReviewConvergenceTarget()` and again when constructing each `ReviewToolingRecoveryMutation`. If this resolver is filesystem-backed or non-trivial, this duplicates work and risks subtle inconsistency if the working tree changes during command execution.  
**Suggestion:** Resolve `const currentReviewTreeSha = resolveCurrentReviewTreeSha(ctx.root)` once near the start of `execute()`, then pass it into `unchangedReviewConvergenceTarget()` and use it for `nextTreeSha`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Avoid allocating all matching convergence records
**Finding key:** loop-9456a5c422dcec4af68b
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `latestReviewConvergenceRecord()` uses `records.filter(...)` only to read the last match. This creates an intermediate array and scans every record even though only the latest matching record is needed.  
**Suggestion:** Iterate backward through `records` and return the first matching record. This removes duplicate data allocation and keeps the “latest record” intent clearer.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `latestReviewConvergenceRecord()` uses `records.filter(...)` only to read the last match. This creates an intermediate array and scans every record even though only the latest matching record is needed.  
**Suggestion:** Iterate backward through `records` and return the first matching record. This removes duplicate data allocation and keeps the “latest record” intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Rename `reviewRecoveryTaskId` for intent clarity
**Finding key:** loop-2f745da924d6976e1b22
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `reviewRecoveryTaskId()` sounds like it performs or owns recovery, but it only resolves the task id used to scope review convergence records.  
**Suggestion:** Rename it to something like `resolveReviewRecoveryTaskId()` or `resolveReviewConvergenceTaskId()` to match the surrounding resolver naming pattern and make call sites easier to read.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `reviewRecoveryTaskId()` sounds like it performs or owns recovery, but it only resolves the task id used to scope review convergence records.  
**Suggestion:** Rename it to something like `resolveReviewRecoveryTaskId()` or `resolveReviewConvergenceTaskId()` to match the surrounding resolver naming pattern and make call sites easier to read.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Extract changed-tree convergence fixture setup
**Finding key:** loop-af994236a9a90f625c5c
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The new test inlines a large `reviewConvergence.records[0]` fixture, including many fields unrelated to the behavior under test. This makes the test harder to scan and increases maintenance cost if the convergence record shape changes.  
**Suggestion:** Extract a local helper such as `makeToolingExhaustedReviewRecord({ phase, treeSha, provider, targetStateDigest })` within this test file, then override only the fields relevant to this case: `treeSha`, `toolingAttempts`, `toolingMaxAttempts`, `semanticAttempts`, and `provider`.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The new test inlines a large `reviewConvergence.records[0]` fixture, including many fields unrelated to the behavior under test. This makes the test harder to scan and increases maintenance cost if the convergence record shape changes.  
**Suggestion:** Extract a local helper such as `makeToolingExhaustedReviewRecord({ phase, treeSha, provider, targetStateDigest })` within this test file, then override only the fields relevant to this case: `treeSha`, `toolingAttempts`, `toolingMaxAttempts`, `semanticAttempts`, and `provider`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Name the test around the observable invariant
**Finding key:** loop-ac458b251ac3cfd48a13
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R7  
**Issue:** The test name says “commits a changed-tree review grant and tooling reset in one flow mutation,” but the actual assertion is broader: changed tree allows tooling attempts to reset while preserving semantic attempts and provider metadata.  
**Suggestion:** Rename the test to something more outcome-focused, for example: `allows changed-tree review retry by resetting tooling attempts only`. This makes the test’s purpose easier to understand from the describe output.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R7  
**Issue:** The test name says “commits a changed-tree review grant and tooling reset in one flow mutation,” but the actual assertion is broader: changed tree allows tooling attempts to reset while preserving semantic attempts and provider metadata.  
**Suggestion:** Rename the test to something more outcome-focused, for example: `allows changed-tree review retry by resetting tooling attempts only`. This makes the test’s purpose easier to understand from the describe output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Replace magic hash literals with named constants
**Finding key:** loop-f30409d14a2d3e5998a8
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The test uses `"1".repeat(40)`, `"2".repeat(40)`, and `"3".repeat(64)` inline. The first two are tree SHAs and the third is a target state digest, but that distinction is only clear after reading the surrounding object.  
**Suggestion:** Introduce named constants such as `previousTreeSha`, `nextTreeSha`, and `targetStateDigest`, and use the digest constant inside the convergence record. This improves readability and reduces accidental misuse of SHA/digest lengths.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The test uses `"1".repeat(40)`, `"2".repeat(40)`, and `"3".repeat(64)` inline. The first two are tree SHAs and the third is a target state digest, but that distinction is only clear after reading the surrounding object.  
**Suggestion:** Introduce named constants such as `previousTreeSha`, `nextTreeSha`, and `targetStateDigest`, and use the digest constant inside the convergence record. This improves readability and reduces accidental misuse of SHA/digest lengths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Normalize Review History Finding Schema
**Finding key:** loop-4010943e1206d73d9ceb
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** Review history attempts use inconsistent finding payload shapes: attempt 001 omits `target` and `evidence`, while attempt 002 includes them. This creates a cross-file interface inconsistency for consumers reading `review-history/*.json`.  
**Suggestion:** Make all review-history attempt files use the same finding schema, either by adding `target` and `evidence` to attempt 001 or by moving detailed finding data exclusively into `repairTargets` across all attempts.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** Review history attempts use inconsistent finding payload shapes: attempt 001 omits `target` and `evidence`, while attempt 002 includes them. This creates a cross-file interface inconsistency for consumers reading `review-history/*.json`.  
**Suggestion:** Make all review-history attempt files use the same finding schema, either by adding `target` and `evidence` to attempt 001 or by moving detailed finding data exclusively into `repairTargets` across all attempts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Choose One Canonical Recovery Source
**Finding key:** loop-4cd1b7fa4e51627a6185
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R3  
**Issue:** Retry recovery state is duplicated across `flow.json.retryRecovery.entries` and `issue-log.json`, including matching ids, attempts, evidence changes, max attempts, and recovery commands. This introduces cross-file drift risk between lifecycle state and issue-log reporting.  
**Suggestion:** Keep structured retry recovery data canonical in `flow.json`, and store only concise references plus human-readable notes in `issue-log.json`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R3  
**Issue:** Retry recovery state is duplicated across `flow.json.retryRecovery.entries` and `issue-log.json`, including matching ids, attempts, evidence changes, max attempts, and recovery commands. This introduces cross-file drift risk between lifecycle state and issue-log reporting.  
**Suggestion:** Keep structured retry recovery data canonical in `flow.json`, and store only concise references plus human-readable notes in `issue-log.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Align Review Scope Naming Across Runtime Files
**Finding key:** loop-2938b6fb097d4abaa60c
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope` in `run-review.js` appears to represent the same broader review phase/task scope used by `set-retry.js` helpers such as `reviewRecoveryTaskId()` and convergence-target lookup. The naming differs across files, making the shared interface concept harder to follow.  
**Suggestion:** Use a consistent naming family such as `ReviewScope`, `ReviewAttemptScope`, `resolveReviewScope`, and `resolveReviewConvergenceTaskId` across `run-review.js` and `set-retry.js`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope` in `run-review.js` appears to represent the same broader review phase/task scope used by `set-retry.js` helpers such as `reviewRecoveryTaskId()` and convergence-target lookup. The naming differs across files, making the shared interface concept harder to follow.  
**Suggestion:** Use a consistent naming family such as `ReviewScope`, `ReviewAttemptScope`, `resolveReviewScope`, and `resolveReviewConvergenceTaskId` across `run-review.js` and `set-retry.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 4. Centralize Review Identity Hashing
**Finding key:** loop-8a204ba4e66bbc6d363e
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** Finding identity construction is discussed in both `review.js` and `finding-disposition-policy.js`, but hashing and identity-body selection are split across files with duplicated or unnamed logic. This makes the cross-file identity contract harder to audit.  
**Suggestion:** Introduce a clearly named shared helper for stable SHA-256 fingerprinting and use named identity-body variables at call sites before passing canonical tuples.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** Finding identity construction is discussed in both `review.js` and `finding-disposition-policy.js`, but hashing and identity-body selection are split across files with duplicated or unnamed logic. This makes the cross-file identity contract harder to audit.  
**Suggestion:** Introduce a clearly named shared helper for stable SHA-256 fingerprinting and use named identity-body variables at call sites before passing canonical tuples.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 5. Consolidate Generated Artifact Retention Rules
**Finding key:** loop-2f9d3c0087c102b79998
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Multiple files introduce or preserve unbounded generated history: `flow.json` arrays, `issue-log.json` repeated gate attempts, and `review-history/*.json` near-duplicate attempts. The retention behavior is inconsistent across artifacts.  
**Suggestion:** Define one retention policy for generated review/gate history, then apply it consistently across `flow.json`, `issue-log.json`, and `review-history` artifacts using bounded histories or grouped summaries.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Multiple files introduce or preserve unbounded generated history: `flow.json` arrays, `issue-log.json` repeated gate attempts, and `review-history/*.json` near-duplicate attempts. The retention behavior is inconsistent across artifacts.  
**Suggestion:** Define one retention policy for generated review/gate history, then apply it consistently across `flow.json`, `issue-log.json`, and `review-history` artifacts using bounded histories or grouped summaries.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
