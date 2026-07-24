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

### 5. 1. Remove Generated Runtime State From The Change Set
**Finding key:** loop-c7783553d775db331b9e
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** The new `flow.json` is a large generated lifecycle artifact containing run IDs, timestamps, transient statuses, metrics, retry attempts, and review evidence history. This adds high churn and makes code review focus on runtime state instead of implementation behavior.  
**Suggestion:** Do not commit this generated flow state unless the project explicitly requires persisted flow artifacts in source control. If it must be committed, reduce it to the minimal canonical state needed for reproducibility and omit transient runtime logs, timestamps, metrics, and repeated attempt history.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** The new `flow.json` is a large generated lifecycle artifact containing run IDs, timestamps, transient statuses, metrics, retry attempts, and review evidence history. This adds high churn and makes code review focus on runtime state instead of implementation behavior.  
**Suggestion:** Do not commit this generated flow state unless the project explicitly requires persisted flow artifacts in source control. If it must be committed, reduce it to the minimal canonical state needed for reproducibility and omit transient runtime logs, timestamps, metrics, and repeated attempt history.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Bound Runtime History Arrays
**Finding key:** loop-13a841ee410949043a3c
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, and `reviewRecoveryBaselines` can grow indefinitely across retries and reruns. This violates the bounded-resource-usage guardrail because retained runtime history has no explicit count or size cap.  
**Suggestion:** Add explicit retention limits for these arrays, such as keeping only the latest N entries per phase/task/identity, or store summarized counters plus the current canonical evidence record.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, and `reviewRecoveryBaselines` can grow indefinitely across retries and reruns. This violates the bounded-resource-usage guardrail because retained runtime history has no explicit count or size cap.  
**Suggestion:** Add explicit retention limits for these arrays, such as keeping only the latest N entries per phase/task/identity, or store summarized counters plus the current canonical evidence record.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Collapse Duplicate Recovery Baselines
**Finding key:** loop-66e8c9fe30d2a5616cba
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R4
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R4  
**Issue:** `reviewRecoveryBaselines` repeats nearly identical gate baseline entries with the same phase, canonical phase, fingerprint hash, paths, trigger, and components, differing only by `createdAt`. This duplicates data without adding meaningful state.  
**Suggestion:** Store one baseline per canonical fingerprint and add a compact `seenAt`/`attemptCount` field if recurrence matters.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R4  
**Issue:** `reviewRecoveryBaselines` repeats nearly identical gate baseline entries with the same phase, canonical phase, fingerprint hash, paths, trigger, and components, differing only by `createdAt`. This duplicates data without adding meaningful state.  
**Suggestion:** Store one baseline per canonical fingerprint and add a compact `seenAt`/`attemptCount` field if recurrence matters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Deduplicate Repeated Handoff Finding Metadata
**Finding key:** loop-8e115042b4d6089bd3e7
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R6  
**Issue:** Each `handoffFindings` item repeats the same `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values. This makes the evidence payload much larger and harder to inspect.  
**Suggestion:** Hoist shared evidence-level metadata to the containing record and keep each finding focused on finding-specific fields like `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R6  
**Issue:** Each `handoffFindings` item repeats the same `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values. This makes the evidence payload much larger and harder to inspect.  
**Suggestion:** Hoist shared evidence-level metadata to the containing record and keep each finding focused on finding-specific fields like `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Remove Duplicate Recovery Identifiers
**Finding key:** loop-7dbc2a56f99ef6dbd401
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R3  
**Issue:** `retry-recovery` entries include both `grantId` and `id` with the same value. This creates two names for one identifier and invites drift.  
**Suggestion:** Keep a single canonical field, preferably `id`, unless there is a documented schema reason for both.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R3  
**Issue:** `retry-recovery` entries include both `grantId` and `id` with the same value. This creates two names for one identifier and invites drift.  
**Suggestion:** Keep a single canonical field, preferably `id`, unless there is a documented schema reason for both.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 6. Normalize Repeated Gate Observations
**Finding key:** loop-a9eb689441f9f63c844d
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several `spec-gate` entries repeat the same `project-test-integrity` observation multiple times for each retry attempt, with near-identical wording. This inflates the log and reduces signal.  
**Suggestion:** Collapse repeated observations into one grouped entry with an `attempts` list or `count`, preserving the distinct locators only where they carry different meaning.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several `spec-gate` entries repeat the same `project-test-integrity` observation multiple times for each retry attempt, with near-identical wording. This inflates the log and reduces signal.  
**Suggestion:** Collapse repeated observations into one grouped entry with an `attempts` list or `count`, preserving the distinct locators only where they carry different meaning.
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

### 15. 1. Remove duplicated overview entries
**Finding key:** loop-94ad53da746a9e0dbe57
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R1  
**Issue:** The `overview.modules` and `overview.data_flow` sections repeat the test-review identity flow twice: once in Japanese and again as `added_by_task: T-1`. This makes the spec noisier and increases the chance that future updates change one copy but not the other.  
**Suggestion:** Keep one canonical entry per concept. Prefer the more specific `added_by_task` entries if task traceability matters, and remove the earlier duplicate text.
**Suggestion:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R1  
**Issue:** The `overview.modules` and `overview.data_flow` sections repeat the test-review identity flow twice: once in Japanese and again as `added_by_task: T-1`. This makes the spec noisier and increases the chance that future updates change one copy but not the other.  
**Suggestion:** Keep one canonical entry per concept. Prefer the more specific `added_by_task` entries if task traceability matters, and remove the earlier duplicate text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Make the fingerprint tuple self-documenting
**Finding key:** loop-3aa385fb3d61bd56ec37
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** The new `fromCanonicalTuple([...])` call uses a positional four-element array. The order is requirement-critical, but the call site does not name the tuple parts, so future edits could accidentally reorder or substitute fields.  
**Suggestion:** Extract the tuple into a clearly named local before hashing, for example `const canonicalFindingTuple = [target, kindOrFailureMode, title, issueOrImprovement];`, or add a small local helper that constructs the tuple in one named place before passing it to `ReviewFindingFingerprint.fromCanonicalTuple`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** The new `fromCanonicalTuple([...])` call uses a positional four-element array. The order is requirement-critical, but the call site does not name the tuple parts, so future edits could accidentally reorder or substitute fields.  
**Suggestion:** Extract the tuple into a clearly named local before hashing, for example `const canonicalFindingTuple = [target, kindOrFailureMode, title, issueOrImprovement];`, or add a small local helper that constructs the tuple in one named place before passing it to `ReviewFindingFingerprint.fromCanonicalTuple`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Avoid scattered target normalization rules
**Finding key:** loop-e0cc4688ba201b1dc754
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R2
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** `this.target` now applies both text normalization and path separator normalization inline. If target normalization is reused elsewhere in this file, future call sites may forget the `.replaceAll("\\", "/")` step and produce inconsistent finding identity behavior.  
**Suggestion:** Introduce a small `normalizeTestReviewTarget` helper near `normalizeTestReviewText` that performs both operations, then use it for `this.target`. This keeps the canonical identity rule centralized.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** `this.target` now applies both text normalization and path separator normalization inline. If target normalization is reused elsewhere in this file, future call sites may forget the `.replaceAll("\\", "/")` step and produce inconsistent finding identity behavior.  
**Suggestion:** Introduce a small `normalizeTestReviewTarget` helper near `normalizeTestReviewText` that performs both operations, then use it for `this.target`. This keeps the canonical identity rule centralized.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Add Bounds to Canonical Tuple Input
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

### 19. 2. Centralize Fingerprint Digest Creation
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

### 20. 3. Reuse Existing Record Replacement Helper
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

### 21. 4. Clarify Issue Guard Naming
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

### 22. 2. Extract repeated gate diff assembly
**Finding key:** loop-ac3901c599659b2ce0e8
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** The same lifecycle-artifact filtering pattern is now repeated in both gate paths:

```js
const diff = excludeGateLifecycleArtifactsFromGateDiff(
  committed + uncommitted + untracked,
  state.spec,
);
```

The repeated assembly makes it easier for future changes to update one gate path but miss the other.  
**Suggestion:** Introduce a small local helper such as `buildGateReviewDiff({ committed, uncommitted, untracked, specPath })` or `excludeGeneratedGateDiffArtifacts(...)` and use it in both places. This keeps the PASS/ADVISORY/REJECTED review diff invariant centralized.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** The same lifecycle-artifact filtering pattern is now repeated in both gate paths:

```js
const diff = excludeGateLifecycleArtifactsFromGateDiff(
  committed + uncommitted + untracked,
  state.spec,
);
```

The repeated assembly makes it easier for future changes to update one gate path but miss the other.  
**Suggestion:** Introduce a small local helper such as `buildGateReviewDiff({ committed, uncommitted, untracked, specPath })` or `excludeGeneratedGateDiffArtifacts(...)` and use it in both places. This keeps the PASS/ADVISORY/REJECTED review diff invariant centralized.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Remove redundant branch in `forPostHook`
**Finding key:** loop-499602784e9645131bf2
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope.forPostHook()` has two branches that return the same flow-scope completion for non-artifact cases:

```js
if (phase !== IMPL_REVIEW_PHASE) {
  return new ReviewCompletionScope({ phase, taskId: null });
}
return new ReviewCompletionScope({ phase, taskId: null });
```

This is dead branching and makes the scope rule look more complex than it is.  
**Suggestion:** Collapse the method tail to a single return:

```js
if (artifacts && Object.hasOwn(artifacts, "taskId")) {
  return new ReviewCompletionScope({ phase, taskId: artifacts.taskId });
}
return new ReviewCompletionScope({ phase, taskId: null });
```
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope.forPostHook()` has two branches that return the same flow-scope completion for non-artifact cases:

```js
if (phase !== IMPL_REVIEW_PHASE) {
  return new ReviewCompletionScope({ phase, taskId: null });
}
return new ReviewCompletionScope({ phase, taskId: null });
```

This is dead branching and makes the scope rule look more complex than it is.  
**Suggestion:** Collapse the method tail to a single return:

```js
if (artifacts && Object.hasOwn(artifacts, "taskId")) {
  return new ReviewCompletionScope({ phase, taskId: artifacts.taskId });
}
return new ReviewCompletionScope({ phase, taskId: null });
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Extract Shared Review Convergence Lookup
**Finding key:** loop-4d52bd7a309e9a838b98
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `unchangedReviewConvergenceTarget` and `reviewToolingRecoveryMutation` duplicate the same `reviewConvergence.records` normalization, filtering, and latest-record selection logic. This makes the recovery path easier to drift if task-scoped review matching changes again.  
**Suggestion:** Add a small helper such as `latestReviewConvergenceRecord(flowState, phase, taskId)` and reuse it in both functions.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `unchangedReviewConvergenceTarget` and `reviewToolingRecoveryMutation` duplicate the same `reviewConvergence.records` normalization, filtering, and latest-record selection logic. This makes the recovery path easier to drift if task-scoped review matching changes again.  
**Suggestion:** Add a small helper such as `latestReviewConvergenceRecord(flowState, phase, taskId)` and reuse it in both functions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Avoid Recomputing Current Review Tree SHA
**Finding key:** loop-0c754eb2c95d69eaf145
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is called separately when checking unchanged convergence and when constructing the recovery mutation. The value should represent one retry decision, and recomputing it adds unnecessary work and a small consistency risk if the working tree changes between calls.  
**Suggestion:** Resolve `currentReviewTreeSha` once in `execute` for review retries and pass it into both `unchangedReviewConvergenceTarget` and `reviewToolingRecoveryMutation`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is called separately when checking unchanged convergence and when constructing the recovery mutation. The value should represent one retry decision, and recomputing it adds unnecessary work and a small consistency risk if the working tree changes between calls.  
**Suggestion:** Resolve `currentReviewTreeSha` once in `execute` for review retries and pass it into both `unchangedReviewConvergenceTarget` and `reviewToolingRecoveryMutation`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Rename `afterReset` To Reflect Its Role
**Finding key:** loop-f59d85ca8eee5327bc89
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `afterReset` is generic, but in this change it carries the review tooling recovery CAS-side mutation. The name hides an important invariant: attempts reset and recovery grant must be persisted in the same flow-state mutation.  
**Suggestion:** Rename it to something more specific, such as `recoveryMutation` or `postResetMutation`, and keep the call site explicit: `(flowState) => op.recoveryMutation.apply(flowState)`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `afterReset` is generic, but in this change it carries the review tooling recovery CAS-side mutation. The name hides an important invariant: attempts reset and recovery grant must be persisted in the same flow-state mutation.  
**Suggestion:** Rename it to something more specific, such as `recoveryMutation` or `postResetMutation`, and keep the call site explicit: `(flowState) => op.recoveryMutation.apply(flowState)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 4. Reduce Test Fixture Duplication
**Finding key:** loop-ef3ba3de3fefcbaf5812
**Failure mode:** refactor
**File:** tests/unit/flow/gate-diff-compaction.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** The new test repeats several `modifiedDiff(...)` declarations and manual string concatenation. This pattern can become noisy as more lifecycle artifact cases are added.  
**Suggestion:** Use an array of paths and join mapped `modifiedDiff` results, for example `paths.map(modifiedDiff).join("")`, while keeping the assertions unchanged.
**Suggestion:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** The new test repeats several `modifiedDiff(...)` declarations and manual string concatenation. This pattern can become noisy as more lifecycle artifact cases are added.  
**Suggestion:** Use an array of paths and join mapped `modifiedDiff` results, for example `paths.map(modifiedDiff).join("")`, while keeping the assertions unchanged.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Extract changed-tree convergence fixture setup
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

### 29. 2. Name the test around the observable invariant
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

### 30. 3. Replace magic hash literals with named constants
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

### 31. 1. Standardize Review Finding History Shape
**Finding key:** loop-601895e8deeada1dc324
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** Review finding data is represented inconsistently across `draft-review-questions.json`, `review-history/draft-questions-attempt-001.json`, and `review-history/draft-questions-attempt-002.json`. Attempt 001 omits fields that attempt 002 includes, while similar repair target data is duplicated under both `repairTargets` and `findings`.  
**Suggestion:** Define one canonical review finding schema for all generated review artifacts, then regenerate or normalize the attempt files so `findings` and `repairTargets` either share the same complete shape or one clearly references the other.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** Review finding data is represented inconsistently across `draft-review-questions.json`, `review-history/draft-questions-attempt-001.json`, and `review-history/draft-questions-attempt-002.json`. Attempt 001 omits fields that attempt 002 includes, while similar repair target data is duplicated under both `repairTargets` and `findings`.  
**Suggestion:** Define one canonical review finding schema for all generated review artifacts, then regenerate or normalize the attempt files so `findings` and `repairTargets` either share the same complete shape or one clearly references the other.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Centralize Review Target Normalization
**Finding key:** loop-581377c1f010fcf88b51
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R2
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** Target normalization appears as an inline rule in `review.js`, while retry and convergence logic in `src/flow/lib/set-retry.js` and `src/flow/lib/review-convergence.js` depends on matching review convergence records by phase/task/target identity. If normalization is not shared, cross-file matching can drift.  
**Suggestion:** Extract a shared review target normalization helper and use it anywhere review finding identity or convergence record lookup is constructed or compared.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** Target normalization appears as an inline rule in `review.js`, while retry and convergence logic in `src/flow/lib/set-retry.js` and `src/flow/lib/review-convergence.js` depends on matching review convergence records by phase/task/target identity. If normalization is not shared, cross-file matching can drift.  
**Suggestion:** Extract a shared review target normalization helper and use it anywhere review finding identity or convergence record lookup is constructed or compared.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Unify Review Convergence Record Replacement And Lookup Helpers
**Finding key:** loop-1ae3ba49bd9fa90606fd
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `review-convergence.js` and `set-retry.js` both manipulate review convergence records, but the summaries show duplicated replacement mechanics in one file and duplicated lookup/latest-record selection in another. This creates multiple implementations of the same convergence-record contract across files.  
**Suggestion:** Provide shared helpers for “latest convergence record for phase/task” and “replace convergence record,” then use them from both normal convergence updates and retry recovery paths.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `review-convergence.js` and `set-retry.js` both manipulate review convergence records, but the summaries show duplicated replacement mechanics in one file and duplicated lookup/latest-record selection in another. This creates multiple implementations of the same convergence-record contract across files.  
**Suggestion:** Provide shared helpers for “latest convergence record for phase/task” and “replace convergence record,” then use them from both normal convergence updates and retry recovery paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 4. Use One Fingerprint Digest Construction Path
**Finding key:** loop-bdb258a449c497e91fea
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** `ReviewFindingFingerprint.fromCanonicalTuple(...)` is introduced in the policy layer, while `src/flow/commands/review.js` constructs the tuple at the call site. Without a named tuple builder and shared digest helper, the cross-file fingerprint contract is split between caller ordering and callee hashing.  
**Suggestion:** Add a small named builder or factory for canonical review finding fingerprints so tuple field order, normalization, bounds, and digest creation live in one place.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** `ReviewFindingFingerprint.fromCanonicalTuple(...)` is introduced in the policy layer, while `src/flow/commands/review.js` constructs the tuple at the call site. Without a named tuple builder and shared digest helper, the cross-file fingerprint contract is split between caller ordering and callee hashing.  
**Suggestion:** Add a small named builder or factory for canonical review finding fingerprints so tuple field order, normalization, bounds, and digest creation live in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 5. Normalize Generated Lifecycle Artifact Retention
**Finding key:** loop-98ede9087c3748e307c3
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Multiple generated artifacts contain repeated runtime or history data: `flow.json`, `issue-log.json`, `review-history/*`, and `plugin-artifacts/workflow/prepare.json`. The same lifecycle state is being preserved in several formats with overlapping identifiers, timestamps, attempts, and observations.  
**Suggestion:** Define which generated artifacts are source-controlled canonical state versus transient run logs, then remove or compact duplicates across the spec directory according to that rule.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Multiple generated artifacts contain repeated runtime or history data: `flow.json`, `issue-log.json`, `review-history/*`, and `plugin-artifacts/workflow/prepare.json`. The same lifecycle state is being preserved in several formats with overlapping identifiers, timestamps, attempts, and observations.  
**Suggestion:** Define which generated artifacts are source-controlled canonical state versus transient run logs, then remove or compact duplicates across the spec directory according to that rule.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
