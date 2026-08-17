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
**Finding key:** loop-2c2a6f11c779492d080e
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** The file is a generated lifecycle artifact containing volatile run IDs, timestamps, retry state, metrics, review evidence, and gate attempts. Committing it adds noise and makes review convergence harder because unrelated runtime history dominates the diff.  
**Suggestion:** Remove `flow.json` from the change set unless the project explicitly treats it as a required durable artifact. If it must remain, reduce it to the minimal stable fields needed for replay or acceptance evidence.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** The file is a generated lifecycle artifact containing volatile run IDs, timestamps, retry state, metrics, review evidence, and gate attempts. Committing it adds noise and makes review convergence harder because unrelated runtime history dominates the diff.  
**Suggestion:** Remove `flow.json` from the change set unless the project explicitly treats it as a required durable artifact. If it must remain, reduce it to the minimal stable fields needed for replay or acceptance evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Bound Runtime History Arrays
**Finding key:** loop-38c55f55c2d51c995be3
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, `reviewRecoveryBaselines`, and `retryRecovery.entries` grow with each retry/review pass. There is no visible retention bound in this artifact, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Persist only the latest N entries per phase/task/identity, or move full histories into append-only external logs with an explicit retention cap. Keep the bound documented in the producer contract.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, `reviewRecoveryBaselines`, and `retryRecovery.entries` grow with each retry/review pass. There is no visible retention bound in this artifact, which conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Persist only the latest N entries per phase/task/identity, or move full histories into append-only external logs with an explicit retention cap. Keep the bound documented in the producer contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Collapse Duplicate Recovery Baselines
**Finding key:** loop-389b88bbf8657a0f0ee5
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** `reviewRecoveryBaselines` repeats nearly identical `gate/task-impl` baseline objects with the same fingerprint hash, paths, and component hashes, differing mostly by `createdAt`.  
**Suggestion:** Store one baseline per `{kind, canonicalPhase, fingerprint.hash, trigger}` and attach attempt timestamps as a bounded `events` list, or retain only the most recent duplicate.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** `reviewRecoveryBaselines` repeats nearly identical `gate/task-impl` baseline objects with the same fingerprint hash, paths, and component hashes, differing mostly by `createdAt`.  
**Suggestion:** Store one baseline per `{kind, canonicalPhase, fingerprint.hash, trigger}` and attach attempt timestamps as a bounded `events` list, or retain only the most recent duplicate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Deduplicate Repeated Handoff Finding Metadata
**Finding key:** loop-5089bd939bba93e1e729
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R5  
**Issue:** Each `handoffFindings` entry repeats identical contextual fields such as `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`.  
**Suggestion:** Move shared context to the parent convergence record and keep each finding entry focused on finding-specific fields: `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R5  
**Issue:** Each `handoffFindings` entry repeats identical contextual fields such as `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`.  
**Suggestion:** Move shared context to the parent convergence record and keep each finding entry focused on finding-specific fields: `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Normalize Repeated Gate Observations
**Finding key:** loop-b9d9a42fb7badfd94a42
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat the same gate lifecycle observation text many times, especially around `T-3 task-gate` being `in_progress` or retrying. This makes the issue log harder to scan and inflates generated artifacts.  
**Suggestion:** Collapse repeated observations into one entry with `occurrences`, affected locators, and first/last timestamps. Keep the detailed raw evaluator output elsewhere if needed.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat the same gate lifecycle observation text many times, especially around `T-3 task-gate` being `in_progress` or retrying. This makes the issue log harder to scan and inflates generated artifacts.  
**Suggestion:** Collapse repeated observations into one entry with `occurrences`, affected locators, and first/last timestamps. Keep the detailed raw evaluator output elsewhere if needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 6. Remove Duplicate Recovery Identifiers
**Finding key:** loop-68dac7340fedbf1c3f74
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R3  
**Issue:** Retry recovery entries include both `grantId` and `id` with the same value, plus `issueLogId` also repeating that same recovery ID.  
**Suggestion:** Keep a single canonical identifier field, preferably `id`, and derive display aliases at read time if needed.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R3  
**Issue:** Retry recovery entries include both `grantId` and `id` with the same value, plus `issueLogId` also repeating that same recovery ID.  
**Suggestion:** Keep a single canonical identifier field, preferably `id`, and derive display aliases at read time if needed.
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

### 15. 1. Remove Duplicate Spec Overview Entries
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

### 16. 2. Name the Finding Identity Tuple Components
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

### 17. 1. Add Bounds to Canonical Tuple Input
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

### 18. 2. Centralize Fingerprint Digest Creation
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

### 19. 3. Reuse Existing Record Replacement Helper
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

### 20. 4. Clarify Issue Guard Naming
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

### 21. 2. Extract repeated gate diff assembly
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

### 22. 1. Remove redundant branch in `forPostHook`
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

### 29. 1. Normalize Review Finding History Schema
**Finding key:** loop-99960ff97597d16e5c80
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** Review-history attempts appear to store the same finding shape inconsistently: attempt 001 omits `target` and `evidence`, while attempt 002 includes them. This creates a cross-file interface inconsistency for consumers reading `findings[]` across attempts.  
**Suggestion:** Define one canonical `findings[]` schema for all review-history attempt files and update attempt 001 to match it, or move detailed finding metadata exclusively into `repairTargets[]`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** Review-history attempts appear to store the same finding shape inconsistently: attempt 001 omits `target` and `evidence`, while attempt 002 includes them. This creates a cross-file interface inconsistency for consumers reading `findings[]` across attempts.  
**Suggestion:** Define one canonical `findings[]` schema for all review-history attempt files and update attempt 001 to match it, or move detailed finding metadata exclusively into `repairTargets[]`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Consolidate Generated Lifecycle Noise Across Artifacts
**Finding key:** loop-7524d27d1894850ed0cb
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Multiple generated artifacts appear to preserve overlapping volatile lifecycle state, including `flow.json`, `issue-log.json`, review-history attempts, and plugin workflow artifacts. This duplicates runtime history across files and makes review convergence harder to inspect.  
**Suggestion:** Keep one durable acceptance artifact for generated lifecycle evidence, and either omit the others from the change set or reduce them to stable summaries with references to the canonical artifact.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Multiple generated artifacts appear to preserve overlapping volatile lifecycle state, including `flow.json`, `issue-log.json`, review-history attempts, and plugin workflow artifacts. This duplicates runtime history across files and makes review convergence harder to inspect.  
**Suggestion:** Keep one durable acceptance artifact for generated lifecycle evidence, and either omit the others from the change set or reduce them to stable summaries with references to the canonical artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Centralize Review Fingerprint Identity Construction
**Finding key:** loop-5a80ec9db80daf81eb5b
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** Fingerprint identity is assembled in `review.js`, while canonical tuple hashing and validation live in `finding-disposition-policy.js`. The interface depends on positional tuple semantics, so changing either file independently could silently alter finding identity.  
**Suggestion:** Expose a named constructor or helper for the review finding identity tuple from the policy module, and have `review.js` call that instead of assembling positional arrays inline.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** Fingerprint identity is assembled in `review.js`, while canonical tuple hashing and validation live in `finding-disposition-policy.js`. The interface depends on positional tuple semantics, so changing either file independently could silently alter finding identity.  
**Suggestion:** Expose a named constructor or helper for the review finding identity tuple from the policy module, and have `review.js` call that instead of assembling positional arrays inline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 4. Use One Replacement Path For Review Convergence Records
**Finding key:** loop-b6df85ef7f67ac69e515
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `set-retry.js` creates recovery mutations while `review-convergence.js` implements both normal record replacement and manual recovery replacement. This duplicates the convergence-record mutation contract across files and increases drift risk.  
**Suggestion:** Route recovery updates through the same replacement helper used by normal convergence updates, so `set-retry.js` only describes the intended recovered record and `review-convergence.js` owns the mutation mechanics.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `set-retry.js` creates recovery mutations while `review-convergence.js` implements both normal record replacement and manual recovery replacement. This duplicates the convergence-record mutation contract across files and increases drift risk.  
**Suggestion:** Route recovery updates through the same replacement helper used by normal convergence updates, so `set-retry.js` only describes the intended recovered record and `review-convergence.js` owns the mutation mechanics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 5. Align Review Recovery Naming Across Modules
**Finding key:** loop-05f4e0fb641d39d5f19f
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** Naming around review recovery scope is inconsistent across files: `reviewRecoveryTaskId()` sounds action-oriented, while nearby code uses resolver-style names and convergence records are scoped by task identity.  
**Suggestion:** Rename it to `resolveReviewConvergenceTaskId()` or `resolveReviewRecoveryTaskId()` and use the same naming style in related convergence/recovery code.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** Naming around review recovery scope is inconsistent across files: `reviewRecoveryTaskId()` sounds action-oriented, while nearby code uses resolver-style names and convergence records are scoped by task identity.  
**Suggestion:** Rename it to `resolveReviewConvergenceTaskId()` or `resolveReviewRecoveryTaskId()` and use the same naming style in related convergence/recovery code.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
