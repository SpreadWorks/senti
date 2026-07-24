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

### 5. 1. Bound Generated Review History Arrays
**Finding key:** loop-d29ff5644271e92008f9
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records`, `evidenceHistory`, and `reviewRecoveryBaselines` grow as append-only histories. The file already shows large repeated review/gate cycles, and there is no explicit retention marker or cap in the persisted state. This violates the bounded-resource-usage guardrail for bulk history loading/growth.  
**Suggestion:** Add explicit retention metadata or compact older entries into bounded summaries, for example keeping only the latest N attempts per `(phase, taskId, treeSha)` plus a summarized count/digest for older attempts.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** `metrics`, `stepAttempts`, `reviewConvergence.records`, `evidenceHistory`, and `reviewRecoveryBaselines` grow as append-only histories. The file already shows large repeated review/gate cycles, and there is no explicit retention marker or cap in the persisted state. This violates the bounded-resource-usage guardrail for bulk history loading/growth.  
**Suggestion:** Add explicit retention metadata or compact older entries into bounded summaries, for example keeping only the latest N attempts per `(phase, taskId, treeSha)` plus a summarized count/digest for older attempts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Deduplicate Repeated Recovery Baselines
**Finding key:** loop-af94ef3aa120dd16e95b
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** `reviewRecoveryBaselines` repeats identical `fingerprint` payloads for the same `kind`, `phase`, `canonicalPhase`, `trigger`, and hash, differing only by `createdAt`. This inflates the artifact and makes recovery evidence harder to inspect.  
**Suggestion:** Store one baseline per stable recovery key and attach an `occurrences` array or `lastSeenAt` field for repeated observations.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R3  
**Issue:** `reviewRecoveryBaselines` repeats identical `fingerprint` payloads for the same `kind`, `phase`, `canonicalPhase`, `trigger`, and hash, differing only by `createdAt`. This inflates the artifact and makes recovery evidence harder to inspect.  
**Suggestion:** Store one baseline per stable recovery key and attach an `occurrences` array or `lastSeenAt` field for repeated observations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Normalize Repeated Handoff Metadata
**Finding key:** loop-1e6729ebead1fc3edd49
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R6  
**Issue:** Every `handoffFindings` entry repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` from its parent record. This is high-volume duplication and creates drift risk.  
**Suggestion:** Keep shared evidence metadata at the convergence-record level and let each finding contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R6  
**Issue:** Every `handoffFindings` entry repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` from its parent record. This is high-volume duplication and creates drift risk.  
**Suggestion:** Keep shared evidence metadata at the convergence-record level and let each finding contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Compact Repeated Issue Log Evaluations
**Finding key:** loop-df520b3d1b9ea622065b
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several issue log entries repeat near-identical gate observations and `failedEvaluations`, especially around `project-test-integrity` and final-regression fingerprints. This makes the log noisy and unnecessarily large.  
**Suggestion:** Collapse repeated observations into one entry with `count`, `firstSeenAt`, `lastSeenAt`, and representative locators, preserving auditability without duplicating full text.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several issue log entries repeat near-identical gate observations and `failedEvaluations`, especially around `project-test-integrity` and final-regression fingerprints. This makes the log noisy and unnecessarily large.  
**Suggestion:** Collapse repeated observations into one entry with `count`, `firstSeenAt`, `lastSeenAt`, and representative locators, preserving auditability without duplicating full text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Remove Duplicate Fingerprint Entries
**Finding key:** loop-734a368897d3c6eaee01
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** `changedFileFingerprints` contains exact duplicate path/fingerprint pairs, such as repeated `draft-review-questions.json`, `draft.json`, and `spec.json` entries. These duplicates add no information and complicate downstream comparisons.  
**Suggestion:** Deduplicate `changedFileFingerprints` by `(path, fingerprint)` before persisting final-regression issue entries.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** `changedFileFingerprints` contains exact duplicate path/fingerprint pairs, such as repeated `draft-review-questions.json`, `draft.json`, and `spec.json` entries. These duplicates add no information and complicate downstream comparisons.  
**Suggestion:** Deduplicate `changedFileFingerprints` by `(path, fingerprint)` before persisting final-regression issue entries.
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

### 19. 1. Add Bounds for Refresh Artifact Processing
**Finding key:** loop-f17e58366e5dcc2022f8
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R7  
**Issue:** `additionalArtifacts` / `relativePaths` are processed with unbounded `flatMap` and file IO. This violates the `bounded-resource-usage` guardrail if a caller can pass a large list.  
**Suggestion:** Add an explicit maximum count, for example `MAX_REFRESH_ARTIFACT_INVALIDATIONS`, validate `additionalArtifacts.length`, and fail early when exceeded.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R7  
**Issue:** `additionalArtifacts` / `relativePaths` are processed with unbounded `flatMap` and file IO. This violates the `bounded-resource-usage` guardrail if a caller can pass a large list.  
**Suggestion:** Add an explicit maximum count, for example `MAX_REFRESH_ARTIFACT_INVALIDATIONS`, validate `additionalArtifacts.length`, and fail early when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Normalize Active State Once
**Finding key:** loop-807715f8d6f913c6bfc8
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R7  
**Issue:** `completeTestEvidenceRefresh` uses `state.repairBaseline` before `activeState = state || flowManager.load()`. If `state` is omitted and the manifest is missing, the code can fail inconsistently.  
**Suggestion:** Move `const activeState = state || flowManager.load();` to the top after lock acquisition and use `activeState` throughout.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R7  
**Issue:** `completeTestEvidenceRefresh` uses `state.repairBaseline` before `activeState = state || flowManager.load()`. If `state` is omitted and the manifest is missing, the code can fail inconsistently.  
**Suggestion:** Move `const activeState = state || flowManager.load();` to the top after lock acquisition and use `activeState` throughout.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Clarify Fingerprint Parameter Naming
**Finding key:** loop-816c2cd2fd8f890b1d9f
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R7  
**Issue:** `expectedCurrentFingerprint` appears to be treated as both a fingerprint object and a hash string: it is passed as `currentFingerprint`, returned as `currentFingerprint`, and compared to `current.hash`.  
**Suggestion:** Split or rename it to match its actual type, e.g. `expectedCurrentFingerprintHash`, and compare/return hashes consistently.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R7  
**Issue:** `expectedCurrentFingerprint` appears to be treated as both a fingerprint object and a hash string: it is passed as `currentFingerprint`, returned as `currentFingerprint`, and compared to `current.hash`.  
**Suggestion:** Split or rename it to match its actual type, e.g. `expectedCurrentFingerprintHash`, and compare/return hashes consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 4. Avoid Revalidating Reason Inside the Artifact Loop
**Finding key:** loop-562059d17b75e3be9739
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R7  
**Issue:** `requireString(reason, "reason")` is called once per artifact inside `planAdditionalRefreshInvalidations`. That duplicates validation work and obscures that `reason` is invariant.  
**Suggestion:** Validate once before the loop, store `const refreshReason = ...`, and reuse it.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R7  
**Issue:** `requireString(reason, "reason")` is called once per artifact inside `planAdditionalRefreshInvalidations`. That duplicates validation work and obscures that `reason` is invariant.  
**Suggestion:** Validate once before the loop, store `const refreshReason = ...`, and reuse it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 5. Reuse Existing Record Replacement Pattern
**Finding key:** loop-2d735664dad2df1cda4e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `ReviewToolingRecoveryMutation.apply` manually clones records and rewrites `flowState.reviewConvergence`, despite `replaceTargetRecord` existing immediately above for this purpose.  
**Suggestion:** Use or extend `replaceTargetRecord(flowState, target, recovered)` to keep convergence mutation behavior consistent and reduce duplicated record replacement logic.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `ReviewToolingRecoveryMutation.apply` manually clones records and rewrites `flowState.reviewConvergence`, despite `replaceTargetRecord` existing immediately above for this purpose.  
**Suggestion:** Use or extend `replaceTargetRecord(flowState, target, recovered)` to keep convergence mutation behavior consistent and reduce duplicated record replacement logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Avoid Recomputing Final Regression Fingerprint on Every Run Path
**Finding key:** loop-696c8ae5aacc3ca03a9a
**Failure mode:** refactor
**File:** src/flow/lib/run-final-regression.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** `recoverStaleTestEvidence` always builds a repair fingerprint after reading `test-execute-result.json`, even though stale evidence detection only needs the current hash. If similar fingerprint logic exists elsewhere in this command path, this increases coupling and makes the recovery check heavier than necessary.  
**Suggestion:** Consider passing the current repair fingerprint or fingerprint hash into `recoverStaleTestEvidence` from the caller if it is already available nearby, keeping stale-evidence recovery as a narrower helper.
**Suggestion:** **File:** `src/flow/lib/run-final-regression.js`  
**Requirement:** R7  
**Issue:** `recoverStaleTestEvidence` always builds a repair fingerprint after reading `test-execute-result.json`, even though stale evidence detection only needs the current hash. If similar fingerprint logic exists elsewhere in this command path, this increases coupling and makes the recovery check heavier than necessary.  
**Suggestion:** Consider passing the current repair fingerprint or fingerprint hash into `recoverStaleTestEvidence` from the caller if it is already available nearby, keeping stale-evidence recovery as a narrower helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 1. Consolidate Diff Artifact Exclusion Helpers
**Finding key:** loop-6743bb5ff8863442fbe0
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` duplicates the same split/filter/join structure already used by `excludeScenarioValidityEvidenceFromTaskGateDiff`. This creates two near-identical diff filtering implementations that can drift.  
**Suggestion:** Extract a shared helper such as `excludeDiffFiles(diff, predicate)` and have both functions pass their artifact predicate into it.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `excludeGateLifecycleArtifactsFromGateDiff` duplicates the same split/filter/join structure already used by `excludeScenarioValidityEvidenceFromTaskGateDiff`. This creates two near-identical diff filtering implementations that can drift.  
**Suggestion:** Extract a shared helper such as `excludeDiffFiles(diff, predicate)` and have both functions pass their artifact predicate into it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Rename Gate Lifecycle Predicate for Clarity
**Finding key:** loop-26286b5e84025af6e628
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `isGateLifecycleArtifactForGate` repeats “Gate” and does not clearly signal that it is scoped to artifacts that should be ignored during gate diff evaluation.  
**Suggestion:** Rename it to something more direct, for example `isExcludedGateLifecycleArtifact` or `isGateDiffLifecycleArtifact`, and update the call site in `excludeGateLifecycleArtifactsFromGateDiff`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R7  
**Issue:** `isGateLifecycleArtifactForGate` repeats “Gate” and does not clearly signal that it is scoped to artifacts that should be ignored during gate diff evaluation.  
**Suggestion:** Rename it to something more direct, for example `isExcludedGateLifecycleArtifact` or `isGateDiffLifecycleArtifact`, and update the call site in `excludeGateLifecycleArtifactsFromGateDiff`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 3. Centralize Completion Task ID Usage in Run Review
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

### 28. 1. Avoid Repeated Full-Array Filtering for Latest Review Record
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

### 29. 2. Cache Current Review Tree SHA During Retry Reset
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

### 30. 1. Replace One-Use Wrapper Class With a Helper
**Finding key:** loop-a2142826f1bda05f9281
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R7  
**Issue:** `AdditionalRefreshArtifact` is now just a thin wrapper around `normalizeSourceArtifactPath`, and callers immediately unwrap `.relativePath`. With deletion behavior removed, the class no longer carries useful state or behavior.  
**Suggestion:** Remove `AdditionalRefreshArtifact` and normalize inline or via a small helper such as `normalizeAdditionalArtifact(relativePath, index)`. This keeps the refresh path simpler and avoids a class that suggests lifecycle behavior it no longer has.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R7  
**Issue:** `AdditionalRefreshArtifact` is now just a thin wrapper around `normalizeSourceArtifactPath`, and callers immediately unwrap `.relativePath`. With deletion behavior removed, the class no longer carries useful state or behavior.  
**Suggestion:** Remove `AdditionalRefreshArtifact` and normalize inline or via a small helper such as `normalizeAdditionalArtifact(relativePath, index)`. This keeps the refresh path simpler and avoids a class that suggests lifecycle behavior it no longer has.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Add an Explicit Bound for Additional Artifacts
**Finding key:** loop-bbdf9740b57d8ba7e7dc
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R7  
**Issue:** `additionalArtifacts.map(...)` processes an arbitrary-sized list without an explicit cap. Under the `bounded-resource-usage` guardrail, bulk processing should have a clear upper bound, even when entries are only normalized and passed into the refresh transaction.  
**Suggestion:** Define a maximum additional artifact count for stale evidence refresh, validate `additionalArtifacts.length` before mapping, and throw a clear error when exceeded. Use the same limit or configuration pattern as nearby repair artifact handling if one already exists.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R7  
**Issue:** `additionalArtifacts.map(...)` processes an arbitrary-sized list without an explicit cap. Under the `bounded-resource-usage` guardrail, bulk processing should have a clear upper bound, even when entries are only normalized and passed into the refresh transaction.  
**Suggestion:** Define a maximum additional artifact count for stale evidence refresh, validate `additionalArtifacts.length` before mapping, and throw a clear error when exceeded. Use the same limit or configuration pattern as nearby repair artifact handling if one already exists.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Name the Recovery Predicate
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

### 33. 2. Tighten Test Naming Around Observed Effect
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

### 34. 1. Extract Stale Evidence Artifact Paths
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

### 35. 2. Simplify Gate Diff Fixture Assembly
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

### 36. 1. Extract JSON Artifact Writing Helper
**Finding key:** loop-1c1231dcfc0660abf862
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R7  
**Issue:** The new integration test repeatedly calls `writeFile(..., JSON.stringify(..., null, 2))`, which adds noise and makes the repair/evidence setup harder to scan.  
**Suggestion:** Add a small local helper such as `writeJson(root, relativePath, value)` and use it for `spec.json`, `impl-review.json`, `test-execute-result.json`, and `retro.json`.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R7  
**Issue:** The new integration test repeatedly calls `writeFile(..., JSON.stringify(..., null, 2))`, which adds noise and makes the repair/evidence setup harder to scan.  
**Suggestion:** Add a small local helper such as `writeJson(root, relativePath, value)` and use it for `spec.json`, `impl-review.json`, `test-execute-result.json`, and `retro.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Name Fingerprints By Role In The Ledger Scenario
**Finding key:** loop-5aa2ac730b5016b373a6
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R7  
**Issue:** The variables `baseline`, `repaired`, `unledgeredRefresh`, and `current` are accurate but unevenly named. In a test validating ledger extension behavior, the role of each fingerprint in the ledger chain is the key concept.  
**Suggestion:** Rename them to make the transition sequence explicit, for example `initialFingerprint`, `ledgeredRepairFingerprint`, `manifestOnlyFingerprint`, and `currentFingerprint`.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R7  
**Issue:** The variables `baseline`, `repaired`, `unledgeredRefresh`, and `current` are accurate but unevenly named. In a test validating ledger extension behavior, the role of each fingerprint in the ledger chain is the key concept.  
**Suggestion:** Rename them to make the transition sequence explicit, for example `initialFingerprint`, `ledgeredRepairFingerprint`, `manifestOnlyFingerprint`, and `currentFingerprint`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 3. Extract Mutable Flow Manager Test Double
**Finding key:** loop-31176fe699a07a70d500
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R7  
**Issue:** The inline `flowManager` object is boilerplate setup and distracts from the stale evidence refresh scenario being tested.  
**Suggestion:** Add a small helper like `makeMutableFlowManager(state)` near the test helpers in this file, returning the `{ load, mutate }` object. This keeps the test focused on the repair ledger and artifact refresh behavior.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R7  
**Issue:** The inline `flowManager` object is boilerplate setup and distracts from the stale evidence refresh scenario being tested.  
**Suggestion:** Add a small helper like `makeMutableFlowManager(state)` near the test helpers in this file, returning the `{ load, mutate }` object. This keeps the test focused on the repair ledger and artifact refresh behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 1. Align Additional Artifact Bounds Across Refresh Paths
**Finding key:** loop-3b35dfe9fdc0111eb6b7
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** Both `impl-repair-artifacts.js` and `stale-test-evidence-refresh.js` introduce unbounded `additionalArtifacts` processing. The same bounded-resource concern appears in two refresh paths, but the proposals suggest fixing them independently, which risks different limits or validation behavior.
**Suggestion:** Define one shared maximum and validation helper for additional refresh artifacts, then use it from both repair refresh and stale-evidence refresh paths.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`
**Requirement:** R7
**Issue:** Both `impl-repair-artifacts.js` and `stale-test-evidence-refresh.js` introduce unbounded `additionalArtifacts` processing. The same bounded-resource concern appears in two refresh paths, but the proposals suggest fixing them independently, which risks different limits or validation behavior.
**Suggestion:** Define one shared maximum and validation helper for additional refresh artifacts, then use it from both repair refresh and stale-evidence refresh paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 2. Centralize Fingerprint Hash Construction
**Finding key:** loop-e64aaf890549783f440c
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`
**Requirement:** R1
**Issue:** Fingerprint construction concerns appear across `finding-disposition-policy.js`, `impl-repair-artifacts.js`, and stale evidence/final regression flows. Several proposals mention naming or recomputation around fingerprints, suggesting the same SHA/hash/object distinction is being handled inconsistently between files.
**Suggestion:** Introduce a shared fingerprint helper or clearly named factory methods for stable-value hashing and current-repair fingerprint hashes, then update call sites to distinguish fingerprint objects from fingerprint hash strings.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`
**Requirement:** R1
**Issue:** Fingerprint construction concerns appear across `finding-disposition-policy.js`, `impl-repair-artifacts.js`, and stale evidence/final regression flows. Several proposals mention naming or recomputation around fingerprints, suggesting the same SHA/hash/object distinction is being handled inconsistently between files.
**Suggestion:** Introduce a shared fingerprint helper or clearly named factory methods for stable-value hashing and current-repair fingerprint hashes, then update call sites to distinguish fingerprint objects from fingerprint hash strings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 3. Normalize Review History Schema Across Attempts
**Finding key:** loop-58ed71b8f7a7b5fdd1ee
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`
**Requirement:** R1
**Issue:** `draft-questions-attempt-001.json` and `draft-questions-attempt-002.json` represent the same finding shape differently: attempt 001 omits fields that attempt 002 includes, and severity/verdict wording diverges. That is a cross-file interface inconsistency in generated review-history artifacts.
**Suggestion:** Make all review-history attempts emit the same finding schema and severity vocabulary, even when older attempts are retained.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`
**Requirement:** R1
**Issue:** `draft-questions-attempt-001.json` and `draft-questions-attempt-002.json` represent the same finding shape differently: attempt 001 omits fields that attempt 002 includes, and severity/verdict wording diverges. That is a cross-file interface inconsistency in generated review-history artifacts.
**Suggestion:** Make all review-history attempts emit the same finding schema and severity vocabulary, even when older attempts are retained.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 4. Consolidate Repeated Artifact Invalidity Matching
**Finding key:** loop-d22b987498beb7797fd3
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R7
**Issue:** Artifact invalid-summary matching in `acceptance-review-artifacts.js` overlaps conceptually with artifact invalidation/refresh logic in `impl-repair-artifacts.js` and `stale-test-evidence-refresh.js`. Keeping summary string construction local to one file while refresh paths manage artifact lists elsewhere creates drift risk.
**Suggestion:** Use a shared artifact invalidation summary helper or constant naming convention that all artifact refresh/recovery files consume.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`
**Requirement:** R7
**Issue:** Artifact invalid-summary matching in `acceptance-review-artifacts.js` overlaps conceptually with artifact invalidation/refresh logic in `impl-repair-artifacts.js` and `stale-test-evidence-refresh.js`. Keeping summary string construction local to one file while refresh paths manage artifact lists elsewhere creates drift risk.
**Suggestion:** Use a shared artifact invalidation summary helper or constant naming convention that all artifact refresh/recovery files consume.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 5. Unify Gate Lifecycle Diff Filtering Names
**Finding key:** loop-af776f99c306847c2902
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** Gate lifecycle artifact filtering and scenario validity evidence filtering use parallel diff exclusion concepts, but the names differ enough that their relationship is unclear. This naming inconsistency spans helper definitions and call sites.
**Suggestion:** Extract a shared `excludeDiffFiles(diff, predicate)` helper and name predicates by excluded artifact class, such as `isExcludedGateLifecycleArtifact` and `isExcludedScenarioValidityArtifact`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R7
**Issue:** Gate lifecycle artifact filtering and scenario validity evidence filtering use parallel diff exclusion concepts, but the names differ enough that their relationship is unclear. This naming inconsistency spans helper definitions and call sites.
**Suggestion:** Extract a shared `excludeDiffFiles(diff, predicate)` helper and name predicates by excluded artifact class, such as `isExcludedGateLifecycleArtifact` and `isExcludedScenarioValidityArtifact`.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
