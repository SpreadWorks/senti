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

### 5. 1. Add Retention Bounds for Generated History Arrays
**Finding key:** loop-c70e95fb6cfd99b36c4d
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records`, nested `evidenceHistory`, `handoffFindings`, and `reviewRecoveryBaselines` can grow indefinitely across retries and review iterations. This violates the `bounded-resource-usage` guardrail because no explicit retained count, byte size, or pruning rule is represented in the flow artifact.
**Suggestion:** Add an explicit retention policy to the flow state, for example max records per phase/task identity and max evidence history entries per record, and compact older entries into bounded summaries or canonical evidence refs.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records`, nested `evidenceHistory`, `handoffFindings`, and `reviewRecoveryBaselines` can grow indefinitely across retries and review iterations. This violates the `bounded-resource-usage` guardrail because no explicit retained count, byte size, or pruning rule is represented in the flow artifact.
**Suggestion:** Add an explicit retention policy to the flow state, for example max records per phase/task identity and max evidence history entries per record, and compact older entries into bounded summaries or canonical evidence refs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Deduplicate Repeated Handoff Finding Metadata
**Finding key:** loop-d8c31cdf2e7e6c8a851b
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R5
**Issue:** Each `handoffFindings` item repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values for the same evidence record.
**Suggestion:** Keep shared evidence-level metadata once on the enclosing convergence record and store only finding-specific fields inside each handoff item: `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R5
**Issue:** Each `handoffFindings` item repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values for the same evidence record.
**Suggestion:** Keep shared evidence-level metadata once on the enclosing convergence record and store only finding-specific fields inside each handoff item: `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Normalize Duplicate Gate Failure Observations
**Finding key:** loop-837ad6f59465ec5e8c54
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Several issue-log entries repeat the same gate failure observation many times in `reason`, `observations`, and `failedEvaluations`, especially the T-3 `task-gate` retry/project-test-integrity entries.
**Suggestion:** Store one normalized observation with a count or affected attempt list, such as `attempts: [1,2,3,4]`, instead of duplicating full text blocks for every retry.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Several issue-log entries repeat the same gate failure observation many times in `reason`, `observations`, and `failedEvaluations`, especially the T-3 `task-gate` retry/project-test-integrity entries.
**Suggestion:** Store one normalized observation with a count or affected attempt list, such as `attempts: [1,2,3,4]`, instead of duplicating full text blocks for every retry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Remove Redundant Recovery Identifiers
**Finding key:** loop-e1ff011a389af66b748c
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R3
**Issue:** Retry recovery entries contain duplicate identifiers: `grantId`, `id`, and `issueLogId` all carry the same recovery UUID value.
**Suggestion:** Keep a single canonical identifier, preferably `id`, and use `issueLogId` only when it differs from the domain recovery id. This reduces redundant state and avoids future mismatch bugs.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R3
**Issue:** Retry recovery entries contain duplicate identifiers: `grantId`, `id`, and `issueLogId` all carry the same recovery UUID value.
**Suggestion:** Keep a single canonical identifier, preferably `id`, and use `issueLogId` only when it differs from the domain recovery id. This reduces redundant state and avoids future mismatch bugs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Avoid duplicated issue number state
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

### 10. 1. Normalize duplicated finding payloads
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

### 11. 2. Fix inconsistent severity/verdict wording
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

### 12. 3. Avoid storing identical generated history snapshots
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

### 13. 1. Remove Duplicate Spec Overview Entries
**Finding key:** loop-19a7d3c1aaeb42b747b3
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules` and `overview.data_flow` contain overlapping pre-task and `added_by_task` entries for the same concepts, especially test-review identity, changed-tree recovery, and review completion scope. This makes the spec harder to maintain and increases the chance of inconsistent future edits.  
**Suggestion:** Consolidate each duplicated concept into one canonical entry, preserving the more precise `added_by_task` wording where useful.
**Suggestion:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules` and `overview.data_flow` contain overlapping pre-task and `added_by_task` entries for the same concepts, especially test-review identity, changed-tree recovery, and review completion scope. This makes the spec harder to maintain and increases the chance of inconsistent future edits.  
**Suggestion:** Consolidate each duplicated concept into one canonical entry, preserving the more precise `added_by_task` wording where useful.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Name the Finding Identity Tuple Components
**Finding key:** loop-a2b50afeb167fe8f6e78
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** The fingerprint input tuple is correct but built inline with positional values. Because `fromCanonicalTuple` depends on field order, the current code makes the identity contract easy to accidentally break during future edits.  
**Suggestion:** Introduce local names before constructing the tuple, for example `identityKind` and `identityDetail`, then pass `[this.target, identityKind, this.title, identityDetail]`. This documents the tuple semantics without changing behavior.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** The fingerprint input tuple is correct but built inline with positional values. Because `fromCanonicalTuple` depends on field order, the current code makes the identity contract easy to accidentally break during future edits.  
**Suggestion:** Introduce local names before constructing the tuple, for example `identityKind` and `identityDetail`, then pass `[this.target, identityKind, this.title, identityDetail]`. This documents the tuple semantics without changing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Add Bounds to Canonical Tuple Input
**Finding key:** loop-7ed73a996de736b35ce8
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `ReviewFindingFingerprint.fromCanonicalTuple(values)` accepts an unbounded array of unbounded strings before hashing. That violates the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Enforce explicit limits, for example expected tuple arity and max string length, before calling `stableStringify(values)`. Since R1 defines the canonical tuple fields, this can be a fixed-length tuple validation rather than a generic non-empty array.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `ReviewFindingFingerprint.fromCanonicalTuple(values)` accepts an unbounded array of unbounded strings before hashing. That violates the `bounded-resource-usage` guardrail for bulk data processing.  
**Suggestion:** Enforce explicit limits, for example expected tuple arity and max string length, before calling `stableStringify(values)`. Since R1 defines the canonical tuple fields, this can be a fixed-length tuple validation rather than a generic non-empty array.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Centralize Fingerprint Digest Creation
**Finding key:** loop-cd221f76d28b3e69d560
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** `fromCanonicalTuple` duplicates the SHA-256 + `stableStringify` digest construction already used by nearby fingerprint creation logic. That makes future canonicalization changes easier to apply inconsistently.  
**Suggestion:** Extract a private helper such as `digestStableValue(value)` or `fingerprintDigest(value)` and have both existing constructors and `fromCanonicalTuple` use it.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** `fromCanonicalTuple` duplicates the SHA-256 + `stableStringify` digest construction already used by nearby fingerprint creation logic. That makes future canonicalization changes easier to apply inconsistently.  
**Suggestion:** Extract a private helper such as `digestStableValue(value)` or `fingerprintDigest(value)` and have both existing constructors and `fromCanonicalTuple` use it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Reuse Existing Record Replacement Helper
**Finding key:** loop-eab8ce5a7b17de9abc9c
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `ReviewToolingRecoveryMutation.apply()` manually clones records, replaces one entry, and rewrites `flowState.reviewConvergence`, even though `replaceTargetRecord()` already exists immediately above. This duplicates mutation mechanics and risks future divergence.  
**Suggestion:** After constructing `recovered`, call the existing replacement path, or factor the shared “replace record at matched target” behavior so recovery and normal convergence updates use the same mutation pattern.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `ReviewToolingRecoveryMutation.apply()` manually clones records, replaces one entry, and rewrites `flowState.reviewConvergence`, even though `replaceTargetRecord()` already exists immediately above. This duplicates mutation mechanics and risks future divergence.  
**Suggestion:** After constructing `recovered`, call the existing replacement path, or factor the shared “replace record at matched target” behavior so recovery and normal convergence updates use the same mutation pattern.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 4. Clarify Issue Guard Naming
**Finding key:** loop-a3f3ca7e95de8fb9f75a
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `expectedHasIssue` is derived from `Object.hasOwn(input, "expectedIssue")`, so it means “expected issue field presence,” not whether an issue exists semantically. The name can be misread during future guard changes.  
**Suggestion:** Rename it to something like `expectedIssuePresent` or `expectedIssueFieldPresent`, and keep the comparison against `Object.hasOwn(flowState, "issue")` unchanged.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `expectedHasIssue` is derived from `Object.hasOwn(input, "expectedIssue")`, so it means “expected issue field presence,” not whether an issue exists semantically. The name can be misread during future guard changes.  
**Suggestion:** Rename it to something like `expectedIssuePresent` or `expectedIssueFieldPresent`, and keep the comparison against `Object.hasOwn(flowState, "issue")` unchanged.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Extract repeated gate diff collection
**Finding key:** loop-c2aebb33a99c75513c20
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** The committed/uncommitted/untracked diff collection block is duplicated in two gate paths, with only the downstream filtering differing slightly. `buildGateEvaluationDiff()` removes the concatenation duplication but leaves most of the workflow repeated.  
**Suggestion:** Introduce a helper such as `collectGateEvaluationDiff(root, state.spec)` that performs the three collection calls and applies `excludeGateLifecycleArtifactsFromGateDiff()`. Keep the scenario-validity filtering as a caller-specific follow-up where needed.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** The committed/uncommitted/untracked diff collection block is duplicated in two gate paths, with only the downstream filtering differing slightly. `buildGateEvaluationDiff()` removes the concatenation duplication but leaves most of the workflow repeated.  
**Suggestion:** Introduce a helper such as `collectGateEvaluationDiff(root, state.spec)` that performs the three collection calls and applies `excludeGateLifecycleArtifactsFromGateDiff()`. Keep the scenario-validity filtering as a caller-specific follow-up where needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Simplify redundant post-hook scope branching
**Finding key:** loop-60235087434e9c58c289
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope.forPostHook()` has two branches that both return `new ReviewCompletionScope({ phase, taskId: null })`, making the phase check dead code.  
**Suggestion:** Collapse the tail of the method to a single default return after the `artifacts.taskId` check.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope.forPostHook()` has two branches that both return `new ReviewCompletionScope({ phase, taskId: null })`, making the phase check dead code.  
**Suggestion:** Collapse the tail of the method to a single default return after the `artifacts.taskId` check.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Ignore taskId artifacts for non-implementation review phases
**Finding key:** loop-2c723ddd94eed2b383a4
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope.forPostHook()` accepts `result.artifacts.taskId` for any phase. Previously, non-implementation review phases always used `taskId: null`; the new helper can accidentally create task-scoped completion handling for flow-level phases if malformed or stale artifacts include `taskId`.  
**Suggestion:** Only read `artifacts.taskId` when `phase === IMPL_REVIEW_PHASE`; otherwise always return flow scope with `taskId: null`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope.forPostHook()` accepts `result.artifacts.taskId` for any phase. Previously, non-implementation review phases always used `taskId: null`; the new helper can accidentally create task-scoped completion handling for flow-level phases if malformed or stale artifacts include `taskId`.  
**Suggestion:** Only read `artifacts.taskId` when `phase === IMPL_REVIEW_PHASE`; otherwise always return flow scope with `taskId: null`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Cache the current review tree SHA once
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

### 23. 2. Avoid allocating all matching convergence records
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

### 24. 3. Rename `reviewRecoveryTaskId` for intent clarity
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

### 25. 1. Extract changed-tree convergence fixture setup
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

### 26. 2. Name the test around the observable invariant
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

### 27. 3. Replace magic hash literals with named constants
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

### 28. 1. Normalize Draft Review History Schema
**Finding key:** loop-f665b02caa5e8a0e437f
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** `draft-questions-attempt-001.json` and `draft-questions-attempt-002.json` represent the same repair finding with different payload shapes. Attempt 001 omits `target` and `evidence` from `findings[0]`, while attempt 002 includes them.  
**Suggestion:** Make both attempt artifacts schema-identical, or keep detailed finding data only in `repairTargets` and store a compact reference in `findings`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** `draft-questions-attempt-001.json` and `draft-questions-attempt-002.json` represent the same repair finding with different payload shapes. Attempt 001 omits `target` and `evidence` from `findings[0]`, while attempt 002 includes them.  
**Suggestion:** Make both attempt artifacts schema-identical, or keep detailed finding data only in `repairTargets` and store a compact reference in `findings`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Consolidate Repeated Convergence Metadata Across Artifacts
**Finding key:** loop-602b6746a11c906805b2
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R5  
**Issue:** The same convergence metadata appears repeatedly across `flow.json`, `issue-log.json`, and review-history artifacts: phase, task identity, tree SHA, evidence refs/digests, disposition ownership, and retry observations. This creates multiple sources of truth for the same review-convergence state.  
**Suggestion:** Store canonical convergence metadata once per convergence record, then reference it from issue-log entries and review-history findings by stable IDs or evidence refs.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R5  
**Issue:** The same convergence metadata appears repeatedly across `flow.json`, `issue-log.json`, and review-history artifacts: phase, task identity, tree SHA, evidence refs/digests, disposition ownership, and retry observations. This creates multiple sources of truth for the same review-convergence state.  
**Suggestion:** Store canonical convergence metadata once per convergence record, then reference it from issue-log entries and review-history findings by stable IDs or evidence refs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Align Review Scope Naming Across Implementation Files
**Finding key:** loop-cd485d91f100d84155fe
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** Related review-scope concepts are named inconsistently across implementation files: `reviewRecoveryTaskId()` in `set-retry.js`, `ReviewCompletionScope.forPostHook()` in `run-review.js`, and `expectedHasIssue` in `review-convergence.js`. The names mix recovery, completion scope, and field-presence semantics, making cross-file behavior harder to trace.  
**Suggestion:** Rename these helpers/locals around the shared concept they encode, for example `resolveReviewConvergenceTaskId()`, `ReviewCompletionScope`, and `expectedIssueFieldPresent`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** Related review-scope concepts are named inconsistently across implementation files: `reviewRecoveryTaskId()` in `set-retry.js`, `ReviewCompletionScope.forPostHook()` in `run-review.js`, and `expectedHasIssue` in `review-convergence.js`. The names mix recovery, completion scope, and field-presence semantics, making cross-file behavior harder to trace.  
**Suggestion:** Rename these helpers/locals around the shared concept they encode, for example `resolveReviewConvergenceTaskId()`, `ReviewCompletionScope`, and `expectedIssueFieldPresent`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Centralize Review Fingerprint Identity Contract
**Finding key:** loop-3442401a4e529afbb3d5
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `review.js` constructs the canonical fingerprint tuple inline, while `finding-disposition-policy.js` owns `ReviewFindingFingerprint.fromCanonicalTuple(values)`. The tuple field order and bounds are therefore split across files, which risks future mismatch.  
**Suggestion:** Define the canonical tuple shape in one place, preferably near `ReviewFindingFingerprint`, with named fields and validation. Have `review.js` call that API instead of assembling a positional tuple directly.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `review.js` constructs the canonical fingerprint tuple inline, while `finding-disposition-policy.js` owns `ReviewFindingFingerprint.fromCanonicalTuple(values)`. The tuple field order and bounds are therefore split across files, which risks future mismatch.  
**Suggestion:** Define the canonical tuple shape in one place, preferably near `ReviewFindingFingerprint`, with named fields and validation. Have `review.js` call that API instead of assembling a positional tuple directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 5. Apply Bounded Retention Consistently
**Finding key:** loop-098d23e68a35824b08af
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Multiple files introduce or describe unbounded growth patterns: `flow.json` history arrays, repeated `issue-log.json` gate observations, near-duplicate review-history attempts, and unbounded fingerprint tuple input in `finding-disposition-policy.js`. The bounded-resource rule is being handled piecemeal rather than as a shared contract.  
**Suggestion:** Add one cross-file retention and input-size policy covering convergence records, evidence histories, issue-log observations, review-history attempts, and fingerprint tuple inputs. Then reference that policy from each artifact or implementation point.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Multiple files introduce or describe unbounded growth patterns: `flow.json` history arrays, repeated `issue-log.json` gate observations, near-duplicate review-history attempts, and unbounded fingerprint tuple input in `finding-disposition-policy.js`. The bounded-resource rule is being handled piecemeal rather than as a shared contract.  
**Suggestion:** Add one cross-file retention and input-size policy covering convergence records, evidence histories, issue-log observations, review-history attempts, and fingerprint tuple inputs. Then reference that policy from each artifact or implementation point.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
