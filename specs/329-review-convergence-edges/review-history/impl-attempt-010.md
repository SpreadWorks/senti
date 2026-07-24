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

### 5. 1. Add Retention Bounds for Runtime Arrays
**Finding key:** loop-4ece476b3b1642519bfb
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records`, `evidenceHistory`, and `reviewRecoveryBaselines` grow by appending runtime data. The file already contains thousands of entries, and there is no visible retention/count bound. This violates the `bounded-resource-usage` guardrail for bulk history accumulation.
**Suggestion:** Define and persist explicit retention limits for each history surface, for example max records per phase/task identity and max global runtime entries, then prune or compact older entries into summaries.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records`, `evidenceHistory`, and `reviewRecoveryBaselines` grow by appending runtime data. The file already contains thousands of entries, and there is no visible retention/count bound. This violates the `bounded-resource-usage` guardrail for bulk history accumulation.
**Suggestion:** Define and persist explicit retention limits for each history surface, for example max records per phase/task identity and max global runtime entries, then prune or compact older entries into summaries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Deduplicate Repeated Handoff Finding Metadata
**Finding key:** loop-6d7fa13eb525489cff37
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R5
**Issue:** Each `handoffFindings` entry repeats identical fields such as `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`.
**Suggestion:** Store shared evidence-level metadata once at the convergence record level, and keep per-finding entries limited to finding-specific fields like `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R5
**Issue:** Each `handoffFindings` entry repeats identical fields such as `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`.
**Suggestion:** Store shared evidence-level metadata once at the convergence record level, and keep per-finding entries limited to finding-specific fields like `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Collapse Duplicate Recovery Baselines
**Finding key:** loop-99b1585f0b9358750947
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R3
**Issue:** `reviewRecoveryBaselines` contains several nearly identical `task-impl` gate baselines with the same fingerprint hash, paths, trigger, and components, differing only by `createdAt`.
**Suggestion:** Replace duplicate baseline objects with one baseline plus an `attempts` or `observedAt` list, or key baselines by `kind + canonicalPhase + fingerprint.hash` and update the existing entry.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R3
**Issue:** `reviewRecoveryBaselines` contains several nearly identical `task-impl` gate baselines with the same fingerprint hash, paths, trigger, and components, differing only by `createdAt`.
**Suggestion:** Replace duplicate baseline objects with one baseline plus an `attempts` or `observedAt` list, or key baselines by `kind + canonicalPhase + fingerprint.hash` and update the existing entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Normalize Repeated Gate Failure Observations
**Finding key:** loop-3a57e19d29e6ce2eeede
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Several issue-log entries repeat the same T-3 task-gate observation text across multiple attempts, sometimes duplicated within one `reason` and `failedEvaluations` array.
**Suggestion:** Store repeated evaluator observations as a single canonical issue with an attempt/count field and references to affected attempts, instead of duplicating full reason text each time.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Several issue-log entries repeat the same T-3 task-gate observation text across multiple attempts, sometimes duplicated within one `reason` and `failedEvaluations` array.
**Suggestion:** Store repeated evaluator observations as a single canonical issue with an attempt/count field and references to affected attempts, instead of duplicating full reason text each time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Remove Redundant Retry Recovery Identifiers
**Finding key:** loop-bad984a69942109d1c7d
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R3
**Issue:** Retry recovery entries duplicate the same identifier in `grantId`, `id`, and `issueLogId`, which creates multiple names for the same concept.
**Suggestion:** Keep one canonical identifier field, such as `id`, and derive display/linkage fields from it during rendering or reporting.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R3
**Issue:** Retry recovery entries duplicate the same identifier in `grantId`, `id`, and `issueLogId`, which creates multiple names for the same concept.
**Suggestion:** Keep one canonical identifier field, such as `id`, and derive display/linkage fields from it during rendering or reporting.
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

### 14. 1. Remove Duplicate Spec Overview Entries
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

### 15. 2. Name the Finding Identity Tuple Components
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

### 16. 1. Add Bounds to Canonical Tuple Input
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

### 17. 2. Centralize Fingerprint Digest Creation
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

### 18. 3. Reuse Existing Record Replacement Helper
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

### 19. 4. Clarify Issue Guard Naming
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

### 20. 3. Extract repeated gate diff collection
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

### 21. 1. Simplify redundant post-hook scope branching
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

### 22. 2. Ignore taskId artifacts for non-implementation review phases
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

### 23. 1. Cache the current review tree SHA once
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

### 24. 2. Avoid allocating all matching convergence records
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

### 25. 3. Rename `reviewRecoveryTaskId` for intent clarity
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

### 26. 1. Extract changed-tree convergence fixture setup
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

### 27. 2. Name the test around the observable invariant
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

### 28. 3. Replace magic hash literals with named constants
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

### 29. 1. Define a Shared Finding Fingerprint Tuple Contract
**Finding key:** loop-fb5ac98c50612930944f
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `src/flow/commands/review.js` builds the canonical fingerprint tuple inline, while `finding-disposition-policy.js` accepts an arbitrary `values` array. The producer and consumer rely on the same positional interface, but that interface is not named or validated in one place.  
**Suggestion:** Introduce a shared fixed-shape helper or tuple builder, for example `ReviewFindingFingerprint.fromFindingIdentity({ target, kind, title, detail })`, and validate arity/string bounds inside the policy layer.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `src/flow/commands/review.js` builds the canonical fingerprint tuple inline, while `finding-disposition-policy.js` accepts an arbitrary `values` array. The producer and consumer rely on the same positional interface, but that interface is not named or validated in one place.  
**Suggestion:** Introduce a shared fixed-shape helper or tuple builder, for example `ReviewFindingFingerprint.fromFindingIdentity({ target, kind, title, detail })`, and validate arity/string bounds inside the policy layer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Normalize Review History Finding Shape Across Attempts
**Finding key:** loop-df5579bbf26fe147121a
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** Attempt 001 and attempt 002 represent the same draft-question finding with different object shapes: attempt 001 omits `target` and `evidence` in `findings[0]`, while attempt 002 includes them. This creates a cross-file schema inconsistency for review-history consumers.  
**Suggestion:** Make both attempt artifacts schema-identical. Either include `target` and `evidence` in all `findings[]` entries, or keep those details only in `repairTargets[]` consistently across attempts.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** Attempt 001 and attempt 002 represent the same draft-question finding with different object shapes: attempt 001 omits `target` and `evidence` in `findings[0]`, while attempt 002 includes them. This creates a cross-file schema inconsistency for review-history consumers.  
**Suggestion:** Make both attempt artifacts schema-identical. Either include `target` and `evidence` in all `findings[]` entries, or keep those details only in `repairTargets[]` consistently across attempts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Align Draft QA State With Repair Target Artifact
**Finding key:** loop-ad290e807cd3c772e74b
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft-review-questions.json
**Requirement:** R2
**Issue:** **File:** `specs/329-review-convergence-edges/draft-review-questions.json`  
**Requirement:** R2  
**Issue:** The review artifact still describes `"Empty QA List"`, but `draft.json` now has an answered QA entry. The two files describe different states of the same draft review surface.  
**Suggestion:** Regenerate or rename the repair target so it reflects the historical condition explicitly, such as `"Initial QA List Was Empty During Draft Review"`, or remove it if it no longer applies.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft-review-questions.json`  
**Requirement:** R2  
**Issue:** The review artifact still describes `"Empty QA List"`, but `draft.json` now has an answered QA entry. The two files describe different states of the same draft review surface.  
**Suggestion:** Regenerate or rename the repair target so it reflects the historical condition explicitly, such as `"Initial QA List Was Empty During Draft Review"`, or remove it if it no longer applies.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 4. Consolidate Repeated Review Convergence Metadata
**Finding key:** loop-5801abb6ebcbfd06bd1f
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R5  
**Issue:** Review convergence metadata is repeated across `flow.json`, `issue-log.json`, and review-history artifacts, including phase/task identity, evidence digests, dispositions, and repeated gate observations. This duplicates the same convergence state across files and increases drift risk.  
**Suggestion:** Store canonical convergence/evidence metadata once in `flow.json`, then have issue-log and review-history entries reference it by stable IDs plus attempt-specific details.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R5  
**Issue:** Review convergence metadata is repeated across `flow.json`, `issue-log.json`, and review-history artifacts, including phase/task identity, evidence digests, dispositions, and repeated gate observations. This duplicates the same convergence state across files and increases drift risk.  
**Suggestion:** Store canonical convergence/evidence metadata once in `flow.json`, then have issue-log and review-history entries reference it by stable IDs plus attempt-specific details.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 5. Use One Review Scope Naming Pattern
**Finding key:** loop-db9f4c9f8c666f8ddeda
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `reviewRecoveryTaskId()` names the value from a recovery perspective, while `ReviewCompletionScope.forPostHook()` and convergence records treat the same concept as review completion/convergence scope. This makes the cross-file interface harder to follow.  
**Suggestion:** Rename the resolver to match the shared concept, for example `resolveReviewConvergenceTaskId()` or `resolveReviewCompletionTaskId()`, and use that terminology consistently in retry and review completion code.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `reviewRecoveryTaskId()` names the value from a recovery perspective, while `ReviewCompletionScope.forPostHook()` and convergence records treat the same concept as review completion/convergence scope. This makes the cross-file interface harder to follow.  
**Suggestion:** Rename the resolver to match the shared concept, for example `resolveReviewConvergenceTaskId()` or `resolveReviewCompletionTaskId()`, and use that terminology consistently in retry and review completion code.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
