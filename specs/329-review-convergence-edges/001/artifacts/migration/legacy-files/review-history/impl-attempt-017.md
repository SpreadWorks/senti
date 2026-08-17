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
**Finding key:** loop-495ca14212446a4b01c9
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `reviewConvergence.records[*].evidenceHistory` and `reviewConvergence.records[*].handoffFindings` can grow with every review attempt, and this file already shows large repeated histories. This risks violating `bounded-resource-usage` because persisted review state has no visible max count or compaction policy.
**Suggestion:** Persist only the latest finalized evidence plus a bounded recent history, or move full history to append-only artifacts referenced by digest while keeping `flow.json` capped to a documented maximum.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** `reviewConvergence.records[*].evidenceHistory` and `reviewConvergence.records[*].handoffFindings` can grow with every review attempt, and this file already shows large repeated histories. This risks violating `bounded-resource-usage` because persisted review state has no visible max count or compaction policy.
**Suggestion:** Persist only the latest finalized evidence plus a bounded recent history, or move full history to append-only artifacts referenced by digest while keeping `flow.json` capped to a documented maximum.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Deduplicate Recovery Baselines
**Finding key:** loop-a02c0a45b6e6c554bfe3
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R3
**Issue:** `reviewRecoveryBaselines` contains repeated entries with identical `kind`, `phase`, `canonicalPhase`, `fingerprint`, and `trigger`, differing only by `createdAt`. This duplicates state and makes recovery reasoning noisier.
**Suggestion:** Store one baseline per `(kind, canonicalPhase, fingerprint.hash, trigger)` and track repeated observations as a bounded `observedAt` array or a `count`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R3
**Issue:** `reviewRecoveryBaselines` contains repeated entries with identical `kind`, `phase`, `canonicalPhase`, `fingerprint`, and `trigger`, differing only by `createdAt`. This duplicates state and makes recovery reasoning noisier.
**Suggestion:** Store one baseline per `(kind, canonicalPhase, fingerprint.hash, trigger)` and track repeated observations as a bounded `observedAt` array or a `count`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Normalize Repeated Finding Handoff Metadata
**Finding key:** loop-1b989e6aaccd92d6177f
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R6
**Issue:** Every `handoffFindings` item repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` already present on the parent convergence record.
**Suggestion:** Keep shared handoff metadata on the parent record and store only finding-specific fields in each item: `findingId`, `summary`, `fingerprint`, `evidenceRefs`, and `sourceStep`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R6
**Issue:** Every `handoffFindings` item repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` already present on the parent convergence record.
**Suggestion:** Keep shared handoff metadata on the parent record and store only finding-specific fields in each item: `findingId`, `summary`, `fingerprint`, `evidenceRefs`, and `sourceStep`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Compact Duplicate Final Regression Fingerprints
**Finding key:** loop-8193309027278a56118b
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** `changedFileFingerprints` repeats identical path/fingerprint pairs, for example duplicated `draft-review-questions.json`, `draft.json`, and `spec.json` entries. This inflates artifacts and weakens scanability.
**Suggestion:** Deduplicate `changedFileFingerprints` by `(path, fingerprint)` before writing the issue-log entry.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** `changedFileFingerprints` repeats identical path/fingerprint pairs, for example duplicated `draft-review-questions.json`, `draft.json`, and `spec.json` entries. This inflates artifacts and weakens scanability.
**Suggestion:** Deduplicate `changedFileFingerprints` by `(path, fingerprint)` before writing the issue-log entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Bound Large Failure Evidence Lists
**Finding key:** loop-d7bab4cd9162fdd5dc2e
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Final-regression entries embed very large `changedFileFingerprints` arrays. Without a max size, future large flows can keep expanding this artifact and violate `bounded-resource-usage`.
**Suggestion:** Add an explicit cap and truncation marker, such as `changedFileFingerprintsTruncated: true`, while preserving a digest or external artifact reference for the full list.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`
**Requirement:** R7
**Issue:** Final-regression entries embed very large `changedFileFingerprints` arrays. Without a max size, future large flows can keep expanding this artifact and violate `bounded-resource-usage`.
**Suggestion:** Add an explicit cap and truncation marker, such as `changedFileFingerprintsTruncated: true`, while preserving a digest or external artifact reference for the full list.
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

### 14. 1. Consolidate Duplicate Overview Entries
**Finding key:** loop-f12cabf3d8cc7a61fc8c
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules` and `overview.data_flow` contain repeated descriptions for the same implementation areas, especially `review.js`, `review-convergence.js`, `set-retry.js`, and `run-review.js`, with both original and `added_by_task` variants. This makes the spec harder to maintain and increases drift risk.  
**Suggestion:** Merge each duplicated module/data-flow description into a single authoritative entry per implementation area, preserving the task attribution only where it adds unique information.
**Suggestion:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules` and `overview.data_flow` contain repeated descriptions for the same implementation areas, especially `review.js`, `review-convergence.js`, `set-retry.js`, and `run-review.js`, with both original and `added_by_task` variants. This makes the spec harder to maintain and increases drift risk.  
**Suggestion:** Merge each duplicated module/data-flow description into a single authoritative entry per implementation area, preserving the task attribution only where it adds unique information.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Extract Target Normalization
**Finding key:** loop-f7ce831d742111c19fd6
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `this.target = normalizeTestReviewText(item.target, "GLOBAL").replaceAll("\\", "/");` adds target-specific canonicalization inline in the constructor, while other canonical tuple fields use the shared text normalizer directly.  
**Suggestion:** Add a small `normalizeTestReviewTarget(value)` helper that calls `normalizeTestReviewText(value, "GLOBAL")` and normalizes path separators. This keeps canonical tuple preparation easier to scan and avoids burying target-specific behavior inside assignment logic.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `this.target = normalizeTestReviewText(item.target, "GLOBAL").replaceAll("\\", "/");` adds target-specific canonicalization inline in the constructor, while other canonical tuple fields use the shared text normalizer directly.  
**Suggestion:** Add a small `normalizeTestReviewTarget(value)` helper that calls `normalizeTestReviewText(value, "GLOBAL")` and normalizes path separators. This keeps canonical tuple preparation easier to scan and avoids burying target-specific behavior inside assignment logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Extract artifact invalid-summary matching
**Finding key:** loop-f9b7d0400e07233e15c3
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R7  
**Issue:** `supports()` now has two separate string comparisons for invalid artifact summaries, one hard-coded for `impl-repair.json` and one generated from `staleArtifacts`. This makes the special case look unrelated to the general artifact-summary pattern.  
**Suggestion:** Add a small helper/constant such as `invalidArtifactSummary(file)` and use it for both `impl-repair.json` and fingerprinted artifacts.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R7  
**Issue:** `supports()` now has two separate string comparisons for invalid artifact summaries, one hard-coded for `impl-repair.json` and one generated from `staleArtifacts`. This makes the special case look unrelated to the general artifact-summary pattern.  
**Suggestion:** Add a small helper/constant such as `invalidArtifactSummary(file)` and use it for both `impl-repair.json` and fingerprinted artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Reuse SHA-256 fingerprint construction
**Finding key:** loop-0d8c50ee8595d597dc39
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `fromCanonicalTuple()` duplicates the same `crypto.createHash("sha256").update(stableStringify(...)).digest("hex")` construction already used by the class. Future fingerprint format changes would need multiple edits.  
**Suggestion:** Extract a private helper like `fingerprintStableValue(value)` or a private static method and call it from both fingerprint factory methods.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `fromCanonicalTuple()` duplicates the same `crypto.createHash("sha256").update(stableStringify(...)).digest("hex")` construction already used by the class. Future fingerprint format changes would need multiple edits.  
**Suggestion:** Extract a private helper like `fingerprintStableValue(value)` or a private static method and call it from both fingerprint factory methods.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Improve canonical tuple parameter naming
**Finding key:** loop-54c0da8fca1545a7a1d9
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** `fromCanonicalTuple(values)` uses a generic name for a requirement-critical identity input. The method validates a strict four-field canonical tuple, not arbitrary values.  
**Suggestion:** Rename the parameter to `canonicalTuple` or `fields` so call sites and validation errors communicate that ordering and field meaning are intentional.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** `fromCanonicalTuple(values)` uses a generic name for a requirement-critical identity input. The method validates a strict four-field canonical tuple, not arbitrary values.  
**Suggestion:** Rename the parameter to `canonicalTuple` or `fields` so call sites and validation errors communicate that ordering and field meaning are intentional.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Add an explicit bound for additional refresh artifacts
**Finding key:** loop-82590a06a8f09924579f
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** `additionalArtifacts` is processed without an explicit count bound in `completeTestEvidenceRefresh` and `planAdditionalRefreshInvalidations`. This violates the `bounded-resource-usage` guardrail for bulk data processing.
**Suggestion:** Define a maximum such as `MAX_REFRESH_ADDITIONAL_ARTIFACTS`, validate `additionalArtifacts.length` before processing, and reject inputs over the limit.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** `additionalArtifacts` is processed without an explicit count bound in `completeTestEvidenceRefresh` and `planAdditionalRefreshInvalidations`. This violates the `bounded-resource-usage` guardrail for bulk data processing.
**Suggestion:** Define a maximum such as `MAX_REFRESH_ADDITIONAL_ARTIFACTS`, validate `additionalArtifacts.length` before processing, and reject inputs over the limit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Normalize `reason` once before invalidation planning
**Finding key:** loop-5b103d2c9b25b35c36c0
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** `requireString(reason, "reason")` is called inside `planAdditionalRefreshInvalidations` for every artifact even though the value is invariant.
**Suggestion:** Validate once at the start of `completeTestEvidenceRefresh` or `planAdditionalRefreshInvalidations`, store it as `refreshReason`, and reuse it.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** `requireString(reason, "reason")` is called inside `planAdditionalRefreshInvalidations` for every artifact even though the value is invariant.
**Suggestion:** Validate once at the start of `completeTestEvidenceRefresh` or `planAdditionalRefreshInvalidations`, store it as `refreshReason`, and reuse it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Clarify expected fingerprint parameter shape
**Finding key:** loop-e9595321682385c72cc0
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** `expectedCurrentFingerprint` is treated like a hash string in `current.hash !== expectedCurrentFingerprint`, but elsewhere the naming suggests a fingerprint object.
**Suggestion:** Rename it to `expectedCurrentHash`, or accept both explicitly by normalizing to `expectedCurrentHash` before comparison and return values.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** `expectedCurrentFingerprint` is treated like a hash string in `current.hash !== expectedCurrentFingerprint`, but elsewhere the naming suggests a fingerprint object.
**Suggestion:** Rename it to `expectedCurrentHash`, or accept both explicitly by normalizing to `expectedCurrentHash` before comparison and return values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 4. Extract recovery target guard logic
**Finding key:** loop-67398200608016bacb95
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R4
**Issue:** `ReviewToolingRecoveryMutation.apply` embeds run/spec/issue guard validation inline, making the mutation harder to scan and easier to diverge from other guarded mutations.
**Suggestion:** Move the guard check into a small helper such as `assertRecoveryTargetGuard(flowState, mutation)` and keep `apply` focused on recovery state transition logic.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R4
**Issue:** `ReviewToolingRecoveryMutation.apply` embeds run/spec/issue guard validation inline, making the mutation harder to scan and easier to diverge from other guarded mutations.
**Suggestion:** Move the guard check into a small helper such as `assertRecoveryTargetGuard(flowState, mutation)` and keep `apply` focused on recovery state transition logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 5. Avoid repeated structured clones in recovery mutation
**Finding key:** loop-3432bb19f375063c79fb
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R4
**Issue:** `nextRecords[index]` clones `records[index]` even though `nextRecords` was already built from cloned records.
**Suggestion:** Replace the assignment with `{ ...nextRecords[index], ...recovered.toJSON() }` to remove redundant cloning and simplify the code.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R4
**Issue:** `nextRecords[index]` clones `records[index]` even though `nextRecords` was already built from cloned records.
**Suggestion:** Replace the assignment with `{ ...nextRecords[index], ...recovered.toJSON() }` to remove redundant cloning and simplify the code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Reuse stale evidence detection instead of duplicating artifact/fingerprint logic
**Finding key:** loop-6da2e4bf9bdf05c3ea9d
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R7
**Issue:** `recoverStaleTestEvidence` duplicates the same stale-evidence detection pattern now present in `checkIntegrationTestArtifacts`: build the repair fingerprint, construct an artifact map, call `StaleTestEvidenceMismatch.detect`, then recover. This makes future changes to stale evidence handling easy to apply inconsistently across final-regression and gate.
**Suggestion:** Extract a small shared helper in this file or reuse an existing helper from `stale-test-evidence-refresh.js` if one exists, e.g. `detectStaleTestEvidence({ root, state, specDir, artifactNames })`, then call it from `recoverStaleTestEvidence`. Keep the final-regression-specific recovery reason, `sourceStep`, and `additionalArtifacts` local.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R7
**Issue:** `recoverStaleTestEvidence` duplicates the same stale-evidence detection pattern now present in `checkIntegrationTestArtifacts`: build the repair fingerprint, construct an artifact map, call `StaleTestEvidenceMismatch.detect`, then recover. This makes future changes to stale evidence handling easy to apply inconsistently across final-regression and gate.
**Suggestion:** Extract a small shared helper in this file or reuse an existing helper from `stale-test-evidence-refresh.js` if one exists, e.g. `detectStaleTestEvidence({ root, state, specDir, artifactNames })`, then call it from `recoverStaleTestEvidence`. Keep the final-regression-specific recovery reason, `sourceStep`, and `additionalArtifacts` local.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Avoid silent JSON parse failures from unchecked artifact reads
**Finding key:** loop-3aeca593a479061df039
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** `checkIntegrationTestArtifacts` now reads optional artifacts with `JSON.parse(fs.readFileSync(...))` before calling `validateIntegrationArtifactTrust`. If an artifact exists but is malformed, the function throws a raw syntax error instead of returning the existing structured `test artifact validation failed` rejection path.
**Suggestion:** Move stale mismatch detection behind `validateIntegrationArtifactTrust`, or read artifacts through an existing tolerant helper if available. If stale detection must happen first, wrap parsing so malformed JSON still produces the same `GateEvidenceFailure` style used by artifact trust validation.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** `checkIntegrationTestArtifacts` now reads optional artifacts with `JSON.parse(fs.readFileSync(...))` before calling `validateIntegrationArtifactTrust`. If an artifact exists but is malformed, the function throws a raw syntax error instead of returning the existing structured `test artifact validation failed` rejection path.
**Suggestion:** Move stale mismatch detection behind `validateIntegrationArtifactTrust`, or read artifacts through an existing tolerant helper if available. If stale detection must happen first, wrap parsing so malformed JSON still produces the same `GateEvidenceFailure` style used by artifact trust validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Remove duplicate gate diff construction call sites
**Finding key:** loop-e58e1fc393fcb9b11d81
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** The new `buildGateEvaluationDiff` helper removes the raw concatenation, but the surrounding `committed`, `uncommitted`, and `untracked` collection block is still duplicated in both gate flows.
**Suggestion:** Extend `buildGateEvaluationDiff` or add an async helper such as `collectGateEvaluationDiff({ root, specPath })` that performs the three collection calls and lifecycle-artifact filtering in one place. This keeps lifecycle exclusion behavior consistent across both gate paths.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** The new `buildGateEvaluationDiff` helper removes the raw concatenation, but the surrounding `committed`, `uncommitted`, and `untracked` collection block is still duplicated in both gate flows.
**Suggestion:** Extend `buildGateEvaluationDiff` or add an async helper such as `collectGateEvaluationDiff({ root, specPath })` that performs the three collection calls and lifecycle-artifact filtering in one place. This keeps lifecycle exclusion behavior consistent across both gate paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 4. Clarify lifecycle artifact naming
**Finding key:** loop-625122704a5f629b34b0
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** `isGateLifecycleArtifactForGate` has a redundant “ForGate” suffix and overlaps conceptually with `isGeneratedSpecArtifactForGate`, making the distinction between generated artifacts and lifecycle artifacts less clear.
**Suggestion:** Rename it to something more precise, such as `isGateLifecycleArtifact`, and consider a companion name like `excludeGateLifecycleArtifactsFromDiff` for the exported diff helper. This keeps names aligned with what the functions actually test or transform.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** `isGateLifecycleArtifactForGate` has a redundant “ForGate” suffix and overlaps conceptually with `isGeneratedSpecArtifactForGate`, making the distinction between generated artifacts and lifecycle artifacts less clear.
**Suggestion:** Rename it to something more precise, such as `isGateLifecycleArtifact`, and consider a companion name like `excludeGateLifecycleArtifactsFromDiff` for the exported diff helper. This keeps names aligned with what the functions actually test or transform.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Centralize Completion Task ID Usage in Run Review
**Finding key:** loop-8a0e7b33ccb94afafb6d
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** The change introduces `ReviewCompletionScope`, but callers still repeatedly pass `completionScope.taskId` through many persistence/finalization calls. That keeps the old primitive plumbing pattern partly intact and makes future scope handling easier to accidentally diverge.  
**Suggestion:** Where practical, pass `completionScope` or a small derived object into helper calls that need both context and task id, instead of repeatedly extracting `taskId`. This would make the flow/task-scope distinction more explicit and reduce duplicated call-site logic.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** The change introduces `ReviewCompletionScope`, but callers still repeatedly pass `completionScope.taskId` through many persistence/finalization calls. That keeps the old primitive plumbing pattern partly intact and makes future scope handling easier to accidentally diverge.  
**Suggestion:** Where practical, pass `completionScope` or a small derived object into helper calls that need both context and task id, instead of repeatedly extracting `taskId`. This would make the flow/task-scope distinction more explicit and reduce duplicated call-site logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Avoid Repeated Full-Array Filtering for Latest Review Record
**Finding key:** loop-25c8d59e302f0b4dbeac
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R7  
**Issue:** `latestReviewConvergenceRecord()` uses `records.filter(...)` and then takes the last item. This allocates an intermediate array and scans every record, even though only the latest matching record is needed.  
**Suggestion:** Replace it with a reverse scan that returns the first matching record. This removes unnecessary allocation and better aligns with bounded-resource-usage expectations for growing convergence history.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R7  
**Issue:** `latestReviewConvergenceRecord()` uses `records.filter(...)` and then takes the last item. This allocates an intermediate array and scans every record, even though only the latest matching record is needed.  
**Suggestion:** Replace it with a reverse scan that returns the first matching record. This removes unnecessary allocation and better aligns with bounded-resource-usage expectations for growing convergence history.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Cache Current Review Tree SHA During Retry Reset
**Finding key:** loop-84d9cc2811080bed09fe
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is called in `unchangedReviewConvergenceTarget()` and again while building each `ReviewToolingRecoveryMutation`. If this resolver performs git or filesystem work, the command repeats the same lookup unnecessarily.  
**Suggestion:** Resolve the current tree SHA once near the start of `execute()` for review retries, then pass it into `unchangedReviewConvergenceTarget()` and reuse it for `nextTreeSha`.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** `resolveCurrentReviewTreeSha(ctx.root)` is called in `unchangedReviewConvergenceTarget()` and again while building each `ReviewToolingRecoveryMutation`. If this resolver performs git or filesystem work, the command repeats the same lookup unnecessarily.  
**Suggestion:** Resolve the current tree SHA once near the start of `execute()` for review retries, then pass it into `unchangedReviewConvergenceTarget()` and reuse it for `nextTreeSha`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Replace Single-Use Wrapper Class With a Helper
**Finding key:** loop-fe3d7b87dee8149f4c4a
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R7  
**Issue:** `AdditionalRefreshArtifact` only normalizes `relativePath`, stores it, freezes itself, and is immediately discarded via `.relativePath`. This keeps class ceremony from the old deletion workflow even though the object no longer owns behavior.  
**Suggestion:** Replace the class with a small helper such as `normalizeAdditionalRefreshArtifact(relativePath, index)` and map directly to strings.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R7  
**Issue:** `AdditionalRefreshArtifact` only normalizes `relativePath`, stores it, freezes itself, and is immediately discarded via `.relativePath`. This keeps class ceremony from the old deletion workflow even though the object no longer owns behavior.  
**Suggestion:** Replace the class with a small helper such as `normalizeAdditionalRefreshArtifact(relativePath, index)` and map directly to strings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Add an Explicit Bound for Additional Artifact Processing
**Finding key:** loop-75db0ad58d567c9a314f
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R7  
**Issue:** `recover()` processes every entry in `additionalArtifacts` without an explicit count bound. That conflicts with the bounded-resource-usage guardrail for bulk processing.  
**Suggestion:** Define a local maximum, validate `additionalArtifacts.length` before mapping, and throw a clear error if exceeded. Keep the cap aligned with the transaction/manifest limits used by `completeTestEvidenceRefresh` if one already exists there.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R7  
**Issue:** `recover()` processes every entry in `additionalArtifacts` without an explicit count bound. That conflicts with the bounded-resource-usage guardrail for bulk processing.  
**Suggestion:** Define a local maximum, validate `additionalArtifacts.length` before mapping, and throw a clear error if exceeded. Keep the cap aligned with the transaction/manifest limits used by `completeTestEvidenceRefresh` if one already exists there.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Name the Recovery Predicate
**Finding key:** loop-c6ca300d60e46a1cc6af
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R7
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The new early-return condition embeds a fairly specific business rule directly in the post-hook: recovered final-regression stale-evidence refreshes should not require a final artifact. The optional-chain condition is readable now, but it makes the R7 behavior harder to identify and reuse if adjacent final-regression logic grows.  
**Suggestion:** Extract the condition into a small local helper such as `isStaleEvidenceRefreshRecovery(result)` near the post-hook or nearby final-regression helpers, then use `if (isStaleEvidenceRefreshRecovery(result)) return;`.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R7  
**Issue:** The new early-return condition embeds a fairly specific business rule directly in the post-hook: recovered final-regression stale-evidence refreshes should not require a final artifact. The optional-chain condition is readable now, but it makes the R7 behavior harder to identify and reuse if adjacent final-regression logic grows.  
**Suggestion:** Extract the condition into a small local helper such as `isStaleEvidenceRefreshRecovery(result)` near the post-hook or nearby final-regression helpers, then use `if (isStaleEvidenceRefreshRecovery(result)) return;`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Tighten Test Naming Around Observed Effect
**Finding key:** loop-b60cc94107f9ee4b4d8d
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression-record-and-proceed.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R7  
**Issue:** The test variable `updated` is vague; it actually records attempted `updateStepStatus` transitions. That weakens the test’s readability because the assertion is about ensuring the recovery path does not proceed into status updates.  
**Suggestion:** Rename `updated` to `statusTransitions` or `stepStatusUpdates`, and update the assertion accordingly.
**Suggestion:** **File:** `tests/unit/flow/final-regression-record-and-proceed.test.js`  
**Requirement:** R7  
**Issue:** The test variable `updated` is vague; it actually records attempted `updateStepStatus` transitions. That weakens the test’s readability because the assertion is about ensuring the recovery path does not proceed into status updates.  
**Suggestion:** Rename `updated` to `statusTransitions` or `stepStatusUpdates`, and update the assertion accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Extract Stale Evidence Artifact Paths
**Finding key:** loop-9e1b2d583b2cc062a59e
**Failure mode:** refactor
**File:** tests/unit/flow/final-regression.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R7  
**Issue:** The stale-evidence test repeats the same artifact paths across setup and assertions, which makes future changes easy to miss or update inconsistently.  
**Suggestion:** Define a local `staleEvidencePaths` array for `test-execute-result.json`, `retro.json`, and `final-regression-result.json`, then use it for both writing stale files and asserting removal.
**Suggestion:** **File:** `tests/unit/flow/final-regression.test.js`  
**Requirement:** R7  
**Issue:** The stale-evidence test repeats the same artifact paths across setup and assertions, which makes future changes easy to miss or update inconsistently.  
**Suggestion:** Define a local `staleEvidencePaths` array for `test-execute-result.json`, `retro.json`, and `final-regression-result.json`, then use it for both writing stale files and asserting removal.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Simplify Gate Diff Fixture Assembly
**Finding key:** loop-cf64b5747bea834e22d3
**Failure mode:** refactor
**File:** tests/unit/flow/gate-diff-compaction.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** The test builds the combined diff with direct string concatenation, which is harder to scan and easier to break if another fixture is added.  
**Suggestion:** Store the `modifiedDiff(...)` values in an array and call `.join("")`, making the set of included diff entries explicit while preserving the existing behavior.
**Suggestion:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R7  
**Issue:** The test builds the combined diff with direct string concatenation, which is harder to scan and easier to break if another fixture is added.  
**Suggestion:** Store the `modifiedDiff(...)` values in an array and call `.join("")`, making the set of included diff entries explicit while preserving the existing behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Name the Stale Failure Summary Entry
**Finding key:** loop-d48487b4c30d58581a76
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The added lines mutate `testResult.summary[0]` twice, which hides the intent of the fixture change and repeats the positional lookup.  
**Suggestion:** Assign the entry to a named local before mutation, for example `const staleFailure = testResult.summary[0];`, then set `staleFailure.result` and `staleFailure.error`. This makes it clearer that the test is intentionally preparing stale failed evidence before the refresh-only repair path.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The added lines mutate `testResult.summary[0]` twice, which hides the intent of the fixture change and repeats the positional lookup.  
**Suggestion:** Assign the entry to a named local before mutation, for example `const staleFailure = testResult.summary[0];`, then set `staleFailure.result` and `staleFailure.error`. This makes it clearer that the test is intentionally preparing stale failed evidence before the refresh-only repair path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 1. Extract the Exhausted Review Record Fixture
**Finding key:** loop-94a764400766372b2a9f
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The new test builds a large inline `reviewConvergence.records[0]` object, mixing the scenario setup with low-level convergence record shape. This makes the test harder to scan and likely duplicates fixture structure used by adjacent retry recovery tests.  
**Suggestion:** Move the record construction into a local helper such as `makeToolingExhaustedReviewRecord({ phase, treeSha, targetStateDigest })`, with only scenario-specific fields passed in. Keep assertions in the test focused on the changed-tree tooling reset behavior.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R3  
**Issue:** The new test builds a large inline `reviewConvergence.records[0]` object, mixing the scenario setup with low-level convergence record shape. This makes the test harder to scan and likely duplicates fixture structure used by adjacent retry recovery tests.  
**Suggestion:** Move the record construction into a local helper such as `makeToolingExhaustedReviewRecord({ phase, treeSha, targetStateDigest })`, with only scenario-specific fields passed in. Keep assertions in the test focused on the changed-tree tooling reset behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 1. Extract Repair Fingerprint Artifact Writes
**Finding key:** loop-7daafa8f5393066e6069
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`
**Requirement:** R7
**Issue:** The new ledger recovery test repeats the same JSON artifact write shape for `impl-review.json`, `test-execute-result.json`, and `retro.json`, each carrying a `repairFingerprint`. This makes the R7 stale-evidence setup harder to scan.
**Suggestion:** Add a small local helper in this test file, for example `writeRepairArtifact(tmp, relativePath, repairFingerprint, extra = {})`, and use it for the repeated artifact setup.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`
**Requirement:** R7
**Issue:** The new ledger recovery test repeats the same JSON artifact write shape for `impl-review.json`, `test-execute-result.json`, and `retro.json`, each carrying a `repairFingerprint`. This makes the R7 stale-evidence setup harder to scan.
**Suggestion:** Add a small local helper in this test file, for example `writeRepairArtifact(tmp, relativePath, repairFingerprint, extra = {})`, and use it for the repeated artifact setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 2. Name Fingerprints By Role
**Finding key:** loop-3b7d983e661b121aa6b2
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`
**Requirement:** R7
**Issue:** The acceptance refresh test uses generic names `previousFingerprint` and `currentFingerprint`, but the assertion is specifically about stale test evidence versus the current repair fingerprint.
**Suggestion:** Rename them to role-based names such as `staleArtifactFingerprint` and `currentRepairFingerprint` to make the test intent clearer.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`
**Requirement:** R7
**Issue:** The acceptance refresh test uses generic names `previousFingerprint` and `currentFingerprint`, but the assertion is specifically about stale test evidence versus the current repair fingerprint.
**Suggestion:** Rename them to role-based names such as `staleArtifactFingerprint` and `currentRepairFingerprint` to make the test intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 3. Split Long Ledger Recovery Setup Into Phases
**Finding key:** loop-f4be5cd52bcb22df15f5
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`
**Requirement:** R7
**Issue:** The new ledger recovery test performs baseline setup, first repair completion, unledgered refresh setup, final-regression mutation, recovery execution, and assertions in one long uninterrupted block.
**Suggestion:** Separate the test with small local helpers or clearly named setup variables for phases like `seedInitialRepairLedger`, `writeUnledgeredCurrentEvidence`, and `advanceToFinalRegression`. This would make the R7 behavior under test easier to distinguish from fixture construction.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`
**Requirement:** R7
**Issue:** The new ledger recovery test performs baseline setup, first repair completion, unledgered refresh setup, final-regression mutation, recovery execution, and assertions in one long uninterrupted block.
**Suggestion:** Separate the test with small local helpers or clearly named setup variables for phases like `seedInitialRepairLedger`, `writeUnledgeredCurrentEvidence`, and `advanceToFinalRegression`. This would make the R7 behavior under test easier to distinguish from fixture construction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 1. Align Additional Artifact Bounds Across Refresh Paths
**Finding key:** loop-3bed62a2e30dfd16dbbc
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** Multiple reviewers flagged unbounded `additionalArtifacts` processing in both `impl-repair-artifacts.js` and `stale-test-evidence-refresh.js`. If each path adds its own limit independently, the same refresh concept can diverge across completion and recovery flows.
**Suggestion:** Define one shared maximum and validation helper for refresh additional artifacts, then use it from both files.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** Multiple reviewers flagged unbounded `additionalArtifacts` processing in both `impl-repair-artifacts.js` and `stale-test-evidence-refresh.js`. If each path adds its own limit independently, the same refresh concept can diverge across completion and recovery flows.
**Suggestion:** Define one shared maximum and validation helper for refresh additional artifacts, then use it from both files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 2. Centralize Stale Evidence Detection
**Finding key:** loop-52256f0927a0a6c669f5
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R7
**Issue:** Stale evidence detection appears to be introduced in multiple places: final regression recovery, gate artifact checks, and stale evidence refresh handling. The per-file reviews already note duplicated artifact/fingerprint detection logic and inconsistent malformed-artifact behavior risk.
**Suggestion:** Extract a shared stale-evidence detection helper that owns fingerprint construction, artifact reads, trust/parse handling, and mismatch detection. Keep only flow-specific recovery reasons and source-step metadata at call sites.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`
**Requirement:** R7
**Issue:** Stale evidence detection appears to be introduced in multiple places: final regression recovery, gate artifact checks, and stale evidence refresh handling. The per-file reviews already note duplicated artifact/fingerprint detection logic and inconsistent malformed-artifact behavior risk.
**Suggestion:** Extract a shared stale-evidence detection helper that owns fingerprint construction, artifact reads, trust/parse handling, and mismatch detection. Keep only flow-specific recovery reasons and source-step metadata at call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 3. Normalize Fingerprint Naming Across Files
**Finding key:** loop-5e437433652bbd732923
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R2
**Issue:** Fingerprint values are named inconsistently across implementation and tests, including `expectedCurrentFingerprint` where only `.hash` is compared, plus generic `previousFingerprint` / `currentFingerprint` in tests. This blurs whether a value is a full fingerprint object or a hash string.
**Suggestion:** Use role- and shape-specific names consistently, such as `expectedCurrentHash`, `currentRepairFingerprint`, and `staleArtifactFingerprint`.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R2
**Issue:** Fingerprint values are named inconsistently across implementation and tests, including `expectedCurrentFingerprint` where only `.hash` is compared, plus generic `previousFingerprint` / `currentFingerprint` in tests. This blurs whether a value is a full fingerprint object or a hash string.
**Suggestion:** Use role- and shape-specific names consistently, such as `expectedCurrentHash`, `currentRepairFingerprint`, and `staleArtifactFingerprint`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 4. Deduplicate Review Convergence History Formats
**Finding key:** loop-d4012c2db24e824d281a
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`
**Requirement:** R1
**Issue:** Review-history artifacts, `flow.json`, and handoff records all repeat finding/evidence payloads with slightly different shapes. Attempt 001 omits fields that attempt 002 includes, while `flow.json` repeats shared handoff metadata inside every item.
**Suggestion:** Establish one canonical review finding shape and reference it consistently from attempts, convergence records, and handoff lists. Store shared metadata once at the parent level.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`
**Requirement:** R1
**Issue:** Review-history artifacts, `flow.json`, and handoff records all repeat finding/evidence payloads with slightly different shapes. Attempt 001 omits fields that attempt 002 includes, while `flow.json` repeats shared handoff metadata inside every item.
**Suggestion:** Establish one canonical review finding shape and reference it consistently from attempts, convergence records, and handoff lists. Store shared metadata once at the parent level.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 5. Consolidate Generated Artifact Deduplication Rules
**Finding key:** loop-99eeaf21cbe3bee6ba7a
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** Several files show duplicate generated state: repeated recovery baselines in `flow.json`, duplicate changed file fingerprints in `issue-log.json`, repeated spec overview entries in `spec.json`, and near-identical review-history attempts. These are the same cross-file persistence problem expressed in different artifacts.
**Suggestion:** Add a shared artifact compaction rule: deduplicate by stable identity keys, cap historical arrays, and preserve repeated observations as counts, bounded timestamps, or external digest references.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`
**Requirement:** R7
**Issue:** Several files show duplicate generated state: repeated recovery baselines in `flow.json`, duplicate changed file fingerprints in `issue-log.json`, repeated spec overview entries in `spec.json`, and near-identical review-history attempts. These are the same cross-file persistence problem expressed in different artifacts.
**Suggestion:** Add a shared artifact compaction rule: deduplicate by stable identity keys, cap historical arrays, and preserve repeated observations as counts, bounded timestamps, or external digest references.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
