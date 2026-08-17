# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 2. Use Consistent Metadata Across Review Artifacts
**Finding key:** loop-6602f71223769724326e
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-questions-repair.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-repair.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` includes `generatedAt`, but the new triage and repair artifacts do not. If these files are part of the same review artifact family, the metadata pattern is inconsistent.  
**Suggestion:** Add a `generatedAt` timestamp to `draft-questions-repair.json` using the same ISO timestamp format as `draft-review-coverage.json`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-repair.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` includes `generatedAt`, but the new triage and repair artifacts do not. If these files are part of the same review artifact family, the metadata pattern is inconsistent.  
**Suggestion:** Add a `generatedAt` timestamp to `draft-questions-repair.json` using the same ISO timestamp format as `draft-review-coverage.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Remove Ordinal Prefixes From Item Titles
**Finding key:** loop-86f5d830320cc568410f
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-questions-triage.json
**Requirement:** R4
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`  
**Requirement:** R4  
**Issue:** Each `items[].title` embeds a numeric prefix like `"1. q2..."` even though ordering is already represented by array position. This duplicates structure in data and can become stale if items are reordered.  
**Suggestion:** Rename titles to stable descriptive values such as `"q2 includes recommendation and rationale"` and `"q3 includes recommendation and rationale"`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`  
**Requirement:** R4  
**Issue:** Each `items[].title` embeds a numeric prefix like `"1. q2..."` even though ordering is already represented by array position. This duplicates structure in data and can become stale if items are reordered.  
**Suggestion:** Rename titles to stable descriptive values such as `"q2 includes recommendation and rationale"` and `"q3 includes recommendation and rationale"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Use Consistent Metadata Across Review Artifacts
**Finding key:** loop-f022e59794b81d09bbf0
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-questions-triage.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` includes `generatedAt`, but this triage artifact omits it. That makes provenance and ordering less consistent across generated review outputs.  
**Suggestion:** Add a `generatedAt` timestamp field using the same format and placement convention as `draft-review-coverage.json`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` includes `generatedAt`, but this triage artifact omits it. That makes provenance and ordering less consistent across generated review outputs.  
**Suggestion:** Add a `generatedAt` timestamp field using the same format and placement convention as `draft-review-coverage.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Remove Ordinal Prefixes From Stored Titles
**Finding key:** loop-6d7ee1342e7e3ce7c07f
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-review-questions.json
**Requirement:** R4
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`  
**Requirement:** R4  
**Issue:** `repairTargets[*].title` includes presentation ordinals like `"1. q2 includes recommendation and rationale"` and `"2. q3 includes recommendation and rationale"`. Persisting numbering in data fields is brittle because ordering changes require rewriting titles.  
**Suggestion:** Store titles without numeric prefixes, for example `"q2 includes recommendation and rationale"`, and let renderers or reports apply numbering at display time.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`  
**Requirement:** R4  
**Issue:** `repairTargets[*].title` includes presentation ordinals like `"1. q2 includes recommendation and rationale"` and `"2. q3 includes recommendation and rationale"`. Persisting numbering in data fields is brittle because ordering changes require rewriting titles.  
**Suggestion:** Store titles without numeric prefixes, for example `"q2 includes recommendation and rationale"`, and let renderers or reports apply numbering at display time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 4. Reduce Repeated Policy Text
**Finding key:** loop-a9b267498d137414303b
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`  
**Requirement:** R1  
**Issue:** The same policy boundary is repeated across `knownFacts`, `resolvedByProjectRules`, `scopeVerification`, `impactOnExisting`, and QA answers: valid matching fingerprints are recoverable, missing/invalid/conflicting fingerprints are structural errors, and existing guards must not be weakened.  
**Suggestion:** Keep the canonical rule in one section, preferably `decisionMap.knownFacts` or `resolvedByProjectRules`, and have QA answers reference that decision instead of restating the full policy each time.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft.json`  
**Requirement:** R1  
**Issue:** The same policy boundary is repeated across `knownFacts`, `resolvedByProjectRules`, `scopeVerification`, `impactOnExisting`, and QA answers: valid matching fingerprints are recoverable, missing/invalid/conflicting fingerprints are structural errors, and existing guards must not be weakened.  
**Suggestion:** Keep the canonical rule in one section, preferably `decisionMap.knownFacts` or `resolvedByProjectRules`, and have QA answers reference that decision instead of restating the full policy each time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Bound Embedded Runtime History
**Finding key:** loop-a85631522e89a8bc802c
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records[*].handoffFindings`, `evidenceHistory`, and `stepAttempts` embed a large, growing runtime history directly in the flow artifact. This violates the bounded-resource-usage guardrail because the file can grow without an explicit count or size cap as retries and review attempts accumulate.  
**Suggestion:** Store only the current summarized state plus a bounded recent history, such as the last N attempts per phase, and move full historical details to separately referenced evidence artifacts. Add an explicit maximum count or truncation marker for retained entries.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records[*].handoffFindings`, `evidenceHistory`, and `stepAttempts` embed a large, growing runtime history directly in the flow artifact. This violates the bounded-resource-usage guardrail because the file can grow without an explicit count or size cap as retries and review attempts accumulate.  
**Suggestion:** Store only the current summarized state plus a bounded recent history, such as the last N attempts per phase, and move full historical details to separately referenced evidence artifacts. Add an explicit maximum count or truncation marker for retained entries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Remove Duplicate Review Finding Payloads
**Finding key:** loop-65a17236c11508da9e32
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R1  
**Issue:** Many `reviewConvergence.records[*].handoffFindings` entries repeat the same metadata fields verbatim, including `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`. This makes the artifact noisy and increases the chance of inconsistent metadata edits.  
**Suggestion:** Factor shared metadata to the parent review record and keep each finding entry limited to finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R1  
**Issue:** Many `reviewConvergence.records[*].handoffFindings` entries repeat the same metadata fields verbatim, including `sourceStep`, `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner`. This makes the artifact noisy and increases the chance of inconsistent metadata edits.  
**Suggestion:** Factor shared metadata to the parent review record and keep each finding entry limited to finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Normalize Review Metadata Naming
**Finding key:** loop-f4652a8f0bcf4c8a32a3
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/flow.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R5  
**Issue:** The artifact uses overlapping phase names such as `draft-questions-review`, `draft-questions`, `test-review`, `test`, `impl-review`, `impl`, `task-review`, and `task-impl`. The distinction between step id, phase, canonical phase, and source step is not consistently clear.  
**Suggestion:** Use explicit field names such as `stepId`, `reviewPhase`, and `canonicalPhase` consistently across records, and avoid placing step-like values in generic `phase` fields.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/flow.json`  
**Requirement:** R5  
**Issue:** The artifact uses overlapping phase names such as `draft-questions-review`, `draft-questions`, `test-review`, `test`, `impl-review`, `impl`, `task-review`, and `task-impl`. The distinction between step id, phase, canonical phase, and source step is not consistently clear.  
**Suggestion:** Use explicit field names such as `stepId`, `reviewPhase`, and `canonicalPhase` consistently across records, and avoid placing step-like values in generic `phase` fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Add duplicate linkage for repeated gate records
**Finding key:** loop-a40bd23ee737b4f6ee1f
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`
**Requirement:** R8
**Issue:** The two `spec-gate` entries for `project-test-integrity` record the same blocker with only wording/locator changes, which makes the log noisier and harder to scan.
**Suggestion:** Mark the later entry with an explicit duplicate/retry reference such as `duplicateOfIssueLogId` or consolidate the repeated details into one canonical entry if the artifact format allows it.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`
**Requirement:** R8
**Issue:** The two `spec-gate` entries for `project-test-integrity` record the same blocker with only wording/locator changes, which makes the log noisier and harder to scan.
**Suggestion:** Mark the later entry with an explicit duplicate/retry reference such as `duplicateOfIssueLogId` or consolidate the repeated details into one canonical entry if the artifact format allows it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Bound issue-log growth explicitly
**Finding key:** loop-2983b14856809eb0b899
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`
**Requirement:** R8
**Issue:** `entries` is an append-only array with no visible cap, rollover rule, or summary mechanism. That conflicts with the bounded-resource-usage guardrail if downstream tools load or scan the full log.
**Suggestion:** Add an explicit bound policy in this artifact or its metadata, for example `maxEntries`, `maxBytes`, or a summarized/archive marker, so consumers have a clear limit.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/issue-log.json`
**Requirement:** R8
**Issue:** `entries` is an append-only array with no visible cap, rollover rule, or summary mechanism. That conflicts with the bounded-resource-usage guardrail if downstream tools load or scan the full log.
**Suggestion:** Add an explicit bound policy in this artifact or its metadata, for example `maxEntries`, `maxBytes`, or a summarized/archive marker, so consumers have a clear limit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Pretty-print spec evidence JSON
**Finding key:** loop-bbe8665a6dd390bd2ff2
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`  
**Requirement:** R1  
**Issue:** The PASS spec evidence is also a single-line JSON object. This is less severe here, but inconsistent with review-friendly evidence artifacts once larger fields are added.  
**Suggestion:** Use the same pretty-printed canonical JSON format as the other evidence files.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`  
**Requirement:** R1  
**Issue:** The PASS spec evidence is also a single-line JSON object. This is less severe here, but inconsistent with review-friendly evidence artifacts once larger fields are added.  
**Suggestion:** Use the same pretty-printed canonical JSON format as the other evidence files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Pretty-print dense evidence JSON
**Finding key:** loop-3801c05be518a1080be5
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/927ba919f3639bbe049ab1c2d54cbbf6a0bdc8dc3226237bff96259aebdf0589.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/927ba919f3639bbe049ab1c2d54cbbf6a0bdc8dc3226237bff96259aebdf0589.json`  
**Requirement:** R8  
**Issue:** The entire rejected test-phase evidence payload is stored on one very long line, making review of the regression matrix findings difficult and increasing merge-conflict risk.  
**Suggestion:** Format the JSON with stable indentation and key ordering, matching the same data exactly. This keeps generated evidence auditable without changing semantics.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/927ba919f3639bbe049ab1c2d54cbbf6a0bdc8dc3226237bff96259aebdf0589.json`  
**Requirement:** R8  
**Issue:** The entire rejected test-phase evidence payload is stored on one very long line, making review of the regression matrix findings difficult and increasing merge-conflict risk.  
**Suggestion:** Format the JSON with stable indentation and key ordering, matching the same data exactly. This keeps generated evidence auditable without changing semantics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Pretty-print draft coverage evidence JSON
**Finding key:** loop-61fbe1035c065bf944cb
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/d3443c0c1b6625e4c9fa2e4d730e22b48ea5a1d94812163c343983acb1cef037.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/d3443c0c1b6625e4c9fa2e4d730e22b48ea5a1d94812163c343983acb1cef037.json`  
**Requirement:** R1  
**Issue:** The draft-coverage evidence file repeats the same compact single-line structure, creating avoidable inconsistency and making future diffs noisy if fields are added.  
**Suggestion:** Normalize it to the same stable pretty-printed JSON representation used for all review evidence artifacts.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/d3443c0c1b6625e4c9fa2e4d730e22b48ea5a1d94812163c343983acb1cef037.json`  
**Requirement:** R1  
**Issue:** The draft-coverage evidence file repeats the same compact single-line structure, creating avoidable inconsistency and making future diffs noisy if fields are added.  
**Suggestion:** Normalize it to the same stable pretty-printed JSON representation used for all review evidence artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Format generated JSON consistently
**Finding key:** loop-0e50fec949c936046062
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/dc4975c13f70b83a624d8615ac1ee6fd0890581f9b9a0730c4afada09dc3ddc3.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/dc4975c13f70b83a624d8615ac1ee6fd0890581f9b9a0730c4afada09dc3ddc3.json`  
**Requirement:** R8  
**Issue:** This JSON artifact is stored as a single long line, unlike the other touched JSON files. That makes review diffs noisy and harder to inspect.  
**Suggestion:** Pretty-print this artifact with the same indentation style used by the files under `review-history`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/dc4975c13f70b83a624d8615ac1ee6fd0890581f9b9a0730c4afada09dc3ddc3.json`  
**Requirement:** R8  
**Issue:** This JSON artifact is stored as a single long line, unlike the other touched JSON files. That makes review diffs noisy and harder to inspect.  
**Suggestion:** Pretty-print this artifact with the same indentation style used by the files under `review-history`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Normalize duplicated finding content
**Finding key:** loop-b4eeed946859f4017ba5
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json`  
**Requirement:** R5  
**Issue:** Each repair target repeats the same title, target, evidence, and rationale again under `findings`, creating two parallel representations that can drift.  
**Suggestion:** Keep one canonical finding list and derive `repairTargets` from `findings` by filtering `category: "repair_target"`, or reduce `repairTargets` to lightweight references such as finding IDs.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json`  
**Requirement:** R5  
**Issue:** Each repair target repeats the same title, target, evidence, and rationale again under `findings`, creating two parallel representations that can drift.  
**Suggestion:** Keep one canonical finding list and derive `repairTargets` from `findings` by filtering `category: "repair_target"`, or reduce `repairTargets` to lightweight references such as finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Avoid conflicting advisory counts
**Finding key:** loop-04bcebbbe88d1a39ab18
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json
**Requirement:** R4
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json`  
**Requirement:** R4  
**Issue:** The file has `verdict: "ADVISORY"` and two repair targets, but the summary says `0 advisory`, while the related review-evidence artifact records two advisory findings. This naming/count mismatch makes the review state harder to reason about.  
**Suggestion:** Use consistent terminology and counts across the artifact, for example `0 blocking, 2 advisory repair target finding(s) recorded.` or rename the verdict/category if repair targets are intentionally distinct from advisory findings.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/draft-questions-attempt-001.json`  
**Requirement:** R4  
**Issue:** The file has `verdict: "ADVISORY"` and two repair targets, but the summary says `0 advisory`, while the related review-evidence artifact records two advisory findings. This naming/count mismatch makes the review state harder to reason about.  
**Suggestion:** Use consistent terminology and counts across the artifact, for example `0 blocking, 2 advisory repair target finding(s) recorded.` or rename the verdict/category if repair targets are intentionally distinct from advisory findings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Normalize empty finding field names across review history artifacts
**Finding key:** loop-95c659b3b3c8781a8891
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.json`  
**Requirement:** R1  
**Issue:** The spec artifact uses `nonBlockingImprovements`, while the test artifact uses `advisoryFindings`. If these files are consumed by shared review-history tooling, the differing names force avoidable branching.  
**Suggestion:** Use a consistent naming convention for non-blocking/advisory findings across review-history JSON artifacts, or document phase-specific schema differences explicitly in the artifact.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.json`  
**Requirement:** R1  
**Issue:** The spec artifact uses `nonBlockingImprovements`, while the test artifact uses `advisoryFindings`. If these files are consumed by shared review-history tooling, the differing names force avoidable branching.  
**Suggestion:** Use a consistent naming convention for non-blocking/advisory findings across review-history JSON artifacts, or document phase-specific schema differences explicitly in the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 3. Add trailing newline
**Finding key:** loop-d472deb221b25b22049e
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Add trailing newline
**Finding key:** loop-76b895be85a41ab1b743
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/spec-review.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/spec-review.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/spec-review.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Remove duplicated finding payloads
**Finding key:** loop-3a2440344ed3fbeae9fc
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once in `blockingFindings` and again in `findings`, with mostly duplicated fields under slightly different names. This creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical findings array and derive phase-specific groupings from it, or reduce `blockingFindings` to lightweight references such as finding IDs.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json`  
**Requirement:** R8  
**Issue:** Each blocking finding is represented twice: once in `blockingFindings` and again in `findings`, with mostly duplicated fields under slightly different names. This creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical findings array and derive phase-specific groupings from it, or reduce `blockingFindings` to lightweight references such as finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Normalize newline handling
**Finding key:** loop-e42d99abb18b9b7cf9ae
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text-file conventions and can cause noisy diffs.  
**Suggestion:** Add a trailing newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, which is inconsistent with normal text-file conventions and can cause noisy diffs.  
**Suggestion:** Add a trailing newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Use distinct finding identifiers
**Finding key:** loop-073ea3f26fa870f8c2b8
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`  
**Requirement:** R5  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id`, even though they describe different R7 and R5 issues. This makes deduplication, tracking, and history correlation ambiguous.  
**Suggestion:** Generate stable identifiers from each finding’s own title/body/requirement so the R7 delegated-test finding and R5 missing-review-input finding have distinct IDs.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`  
**Requirement:** R5  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id`, even though they describe different R7 and R5 issues. This makes deduplication, tracking, and history correlation ambiguous.  
**Suggestion:** Generate stable identifiers from each finding’s own title/body/requirement so the R7 delegated-test finding and R5 missing-review-input finding have distinct IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Remove duplicated rationale text inside each finding
**Finding key:** loop-eb672bea4d81f2313843
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json
**Requirement:** R7
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`  
**Requirement:** R7  
**Issue:** Each `blockingFindings` entry repeats the same sentence in both `rationale` and `whyBlocking`. This is redundant and increases the chance that future edits drift between fields.  
**Suggestion:** Keep one canonical field for the blocking rationale, or make `whyBlocking` a derived rendering-only value instead of storing duplicate text.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`  
**Requirement:** R7  
**Issue:** Each `blockingFindings` entry repeats the same sentence in both `rationale` and `whyBlocking`. This is redundant and increases the chance that future edits drift between fields.  
**Suggestion:** Keep one canonical field for the blocking rationale, or make `whyBlocking` a derived rendering-only value instead of storing duplicate text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 4. Normalize newline handling
**Finding key:** loop-fce77c540d272138b7e5
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, matching the same formatting issue as the previous attempt file.  
**Suggestion:** Add a trailing newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, matching the same formatting issue as the previous attempt file.  
**Suggestion:** Add a trailing newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Normalize newline handling
**Finding key:** loop-95363f0e9f1e8cbed3ff
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.md
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, matching the same formatting issue as the previous attempt file.  
**Suggestion:** Add a trailing newline at EOF.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.md`  
**Requirement:** R1  
**Issue:** The markdown file has no trailing newline, matching the same formatting issue as the previous attempt file.  
**Suggestion:** Add a trailing newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Use unique finding identifiers
**Finding key:** loop-e72db97906fcc102f5ee
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json
**Requirement:** R7
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json`  
**Requirement:** R7  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id`, even though they describe different requirements and different missing coverage paths. This makes deduplication, tracking, and history analysis ambiguous.  
**Suggestion:** Generate distinct stable IDs/fingerprints per finding, ideally from requirement ID plus normalized title/body/target.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json`  
**Requirement:** R7  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id`, even though they describe different requirements and different missing coverage paths. This makes deduplication, tracking, and history analysis ambiguous.  
**Suggestion:** Generate distinct stable IDs/fingerprints per finding, ideally from requirement ID plus normalized title/body/target.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Remove duplicated finding payloads
**Finding key:** loop-b202bcd3fb89b3d22dc0
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json`  
**Requirement:** R5  
**Issue:** The same findings are represented twice, once in `blockingFindings` and again in `findings`, with overlapping fields such as title, rationale, disposition, fingerprint, and source metadata. This duplication can drift over time.  
**Suggestion:** Keep one canonical findings array and derive blocking/advisory subsets from severity, or reduce `blockingFindings` to references by finding ID.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-003.json`  
**Requirement:** R5  
**Issue:** The same findings are represented twice, once in `blockingFindings` and again in `findings`, with overlapping fields such as title, rationale, disposition, fingerprint, and source metadata. This duplication can drift over time.  
**Suggestion:** Keep one canonical findings array and derive blocking/advisory subsets from severity, or reduce `blockingFindings` to references by finding ID.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Align process result naming with exit status
**Finding key:** loop-b3b7642926acf0d0f075
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/scenario-validity-result.json
**Requirement:** R1
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/scenario-validity-result.json`  
**Requirement:** R1  
**Issue:** `process.exitCode` is `1` while top-level `result` is `"pass"`. Because every requirement is classified as `expected_fail`, this may be intentional, but the naming makes the artifact easy to misread as a successful test execution.  
**Suggestion:** Rename or split the status fields, for example `harnessResult: "pass"` and `commandResult: "failed_as_expected"`, or add an explicit `expectedExitCode: 1`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/scenario-validity-result.json`  
**Requirement:** R1  
**Issue:** `process.exitCode` is `1` while top-level `result` is `"pass"`. Because every requirement is classified as `expected_fail`, this may be intentional, but the naming makes the artifact easy to misread as a successful test execution.  
**Suggestion:** Rename or split the status fields, for example `harnessResult: "pass"` and `commandResult: "failed_as_expected"`, or add an explicit `expectedExitCode: 1`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 4. Factor repeated evidence fields
**Finding key:** loop-bddbdf57b8e5d908daea
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/scenario-validity-result.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats identical `test_file`, `command`, and `raw_output_lines` values. This increases artifact size and makes later edits error-prone.  
**Suggestion:** Move shared evidence fields to a top-level `evidenceDefaults` object and keep only requirement-specific fields such as `id`, `classification`, and `test_name` inside each summary entry.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** Each summary entry repeats identical `test_file`, `command`, and `raw_output_lines` values. This increases artifact size and makes later edits error-prone.  
**Suggestion:** Move shared evidence fields to a top-level `evidenceDefaults` object and keep only requirement-specific fields such as `id`, `classification`, and `test_name` inside each summary entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Remove Duplicate Overview Entries
**Finding key:** loop-da6e2ae46625509c22d5
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/spec.json`  
**Requirement:** R8  
**Issue:** The `overview.modules` and `overview.data_flow` sections repeat similar responsibilities for `test-artifacts.js`, `stale-test-evidence-refresh.js`, and integration gate classification, with some entries marked `added_by_task`. This makes the generated spec harder to scan and risks divergence between near-duplicate statements.  
**Suggestion:** Consolidate each repeated module/data-flow idea into one canonical entry and keep task-specific provenance only where it adds unique information.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/spec.json`  
**Requirement:** R8  
**Issue:** The `overview.modules` and `overview.data_flow` sections repeat similar responsibilities for `test-artifacts.js`, `stale-test-evidence-refresh.js`, and integration gate classification, with some entries marked `added_by_task`. This makes the generated spec harder to scan and risks divergence between near-duplicate statements.  
**Suggestion:** Consolidate each repeated module/data-flow idea into one canonical entry and keep task-specific provenance only where it adds unique information.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Clean Up Empty Placeholder Sections
**Finding key:** loop-f7263d9c38b3b960019c
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/spec.md`  
**Requirement:** R8  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead generated placeholders with no useful content.  
**Suggestion:** Either omit empty sections during render or render explicit empty-state text such as `None`, matching the populated `open_questions: []` value in `spec.json`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/spec.md`  
**Requirement:** R8  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead generated placeholders with no useful content.  
**Suggestion:** Either omit empty sections during render or render explicit empty-state text such as `None`, matching the populated `open_questions: []` value in `spec.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Avoid Duplicating Generated Task Content
**Finding key:** loop-dc14dfaae2d22d409184
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/spec.md`  
**Requirement:** R8  
**Issue:** The task summary in `spec.md` duplicates content that is fully rendered again in `tasks/T-1.md`. Maintaining both increases drift risk, especially around acceptance criteria and test strategy.  
**Suggestion:** Keep `spec.md` to a concise task index with id, title, status, and link to `tasks/T-1.md`; leave full task details in the generated task file.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/spec.md`  
**Requirement:** R8  
**Issue:** The task summary in `spec.md` duplicates content that is fully rendered again in `tasks/T-1.md`. Maintaining both increases drift risk, especially around acceptance criteria and test strategy.  
**Suggestion:** Keep `spec.md` to a concise task index with id, title, status, and link to `tasks/T-1.md`; leave full task details in the generated task file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Align review phase naming
**Finding key:** loop-24c17e9b7f8709a3883c
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/test-review.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/test-review.json`  
**Requirement:** R8  
**Issue:** The top-level `"phase"` is `"test"`, while the artifact path, `contractSummary.targetStep`, and coverage artifact all refer to `"test-review"`. This creates avoidable naming inconsistency in generated evidence.  
**Suggestion:** Change `"phase": "test"` to `"phase": "test-review"` unless the schema explicitly requires the shorter phase name.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/test-review.json`  
**Requirement:** R8  
**Issue:** The top-level `"phase"` is `"test"`, while the artifact path, `contractSummary.targetStep`, and coverage artifact all refer to `"test-review"`. This creates avoidable naming inconsistency in generated evidence.  
**Suggestion:** Change `"phase": "test"` to `"phase": "test-review"` unless the schema explicitly requires the shorter phase name.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Add final newline
**Finding key:** loop-884eb227582fd028693e
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/test-review.md`  
**Requirement:** R8  
**Issue:** The Markdown artifact has no trailing newline, which is a small formatting inconsistency and can create unnecessary diff noise.  
**Suggestion:** Add a newline at end of file.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/test-review.md`  
**Requirement:** R8  
**Issue:** The Markdown artifact has no trailing newline, which is a small formatting inconsistency and can create unnecessary diff noise.  
**Suggestion:** Add a newline at end of file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Remove Checked-In Failing Test Log
**Finding key:** loop-a316389bd1f17aa3dad0
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/tests/.raw/scenario-validity.log
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** This file is a generated raw test execution log, and it records an all-failing run. Keeping transient failure output in the change set adds noise and can become stale immediately.  
**Suggestion:** Remove this generated `.raw/scenario-validity.log` from the diff, or replace it only with intentionally curated fixture evidence if the test suite explicitly consumes it.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/tests/.raw/scenario-validity.log`  
**Requirement:** R8  
**Issue:** This file is a generated raw test execution log, and it records an all-failing run. Keeping transient failure output in the change set adds noise and can become stale immediately.  
**Suggestion:** Remove this generated `.raw/scenario-validity.log` from the diff, or replace it only with intentionally curated fixture evidence if the test suite explicitly consumes it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Extract Shared Stale Recovery Assertions
**Finding key:** loop-2758f757428060062a70
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js
**Requirement:** R3
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R3  
**Issue:** Recovery expectations are repeated across R3 and R8: checking `result.result === "recovered"` and `result.next === "test-execute"`. R3 also performs a fuller version of the same contract.  
**Suggestion:** Add a small helper such as `assertRecoveredToTestExecute(result)` and reuse it anywhere the recovery contract is asserted.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R3  
**Issue:** Recovery expectations are repeated across R3 and R8: checking `result.result === "recovered"` and `result.next === "test-execute"`. R3 also performs a fuller version of the same contract.  
**Suggestion:** Add a small helper such as `assertRecoveredToTestExecute(result)` and reuse it anywhere the recovery contract is asserted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Reuse Invalid Authority Case Fixtures
**Finding key:** loop-01363a5cd86c0a17c020
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R5  
**Issue:** Malformed and inconsistent authority cases are defined once in the R5 table and again in the R8 test. This duplicates the same mutation patterns with slightly different labels.  
**Suggestion:** Extract shared case builders, for example `invalidAuthorityCases`, and let R5 and R8 select the cases they need from that list.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R5  
**Issue:** Malformed and inconsistent authority cases are defined once in the R5 table and again in the R8 test. This duplicates the same mutation patterns with slightly different labels.  
**Suggestion:** Extract shared case builders, for example `invalidAuthorityCases`, and let R5 and R8 select the cases they need from that list.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Rename `prepareEvidence` To Reflect Fixture Creation
**Finding key:** loop-2915047ae678c76f3fd1
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R8  
**Issue:** `prepareEvidence` does more than prepare evidence: it creates a repository fixture, writes artifacts, mutates source state, computes fingerprints, and returns paths plus flow state. The name understates the helper’s responsibility.  
**Suggestion:** Rename it to something more explicit, such as `prepareEvidenceFixture` or `prepareStaleEvidenceFixture`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/tests/stale-test-evidence-recovery.test.js`  
**Requirement:** R8  
**Issue:** `prepareEvidence` does more than prepare evidence: it creates a repository fixture, writes artifacts, mutates source state, computes fingerprints, and returns paths plus flow state. The name understates the helper’s responsibility.  
**Suggestion:** Rename it to something more explicit, such as `prepareEvidenceFixture` or `prepareStaleEvidenceFixture`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Avoid Recomputing Review Tree SHA Per Resolver Call
**Finding key:** loop-b18803d2a31b8d3f3863
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha` is passed as a callback that calls `resolveCurrentReviewTreeSha(ctx.root)` each time it is invoked. If `resolveReviewActionForFlowState` calls the resolver more than once, this repeats the same repository lookup.  
**Suggestion:** Compute the tree SHA once before calling `resolveReviewActionForFlowState`, then pass `resolveTreeSha: () => currentReviewTreeSha`.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha` is passed as a callback that calls `resolveCurrentReviewTreeSha(ctx.root)` each time it is invoked. If `resolveReviewActionForFlowState` calls the resolver more than once, this repeats the same repository lookup.  
**Suggestion:** Compute the tree SHA once before calling `resolveReviewActionForFlowState`, then pass `resolveTreeSha: () => currentReviewTreeSha`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Memoize review tree SHA resolution
**Finding key:** loop-88498170ab0d97816b9e
**Failure mode:** refactor
**File:** src/flow/lib/get-status.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha: () => resolveCurrentReviewTreeSha(root)` may perform repeated filesystem/git evidence resolution if `resolveReviewActionForFlowState` calls the callback more than once. It also risks inconsistent values during one status build if the underlying tree changes mid-call.  
**Suggestion:** Capture a lazy memoized value inside `buildStatusReviewViews`, e.g. `let treeSha; const resolveTreeSha = () => treeSha ??= resolveCurrentReviewTreeSha(root);`, then pass `resolveTreeSha`.
**Suggestion:** **File:** `src/flow/lib/get-status.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha: () => resolveCurrentReviewTreeSha(root)` may perform repeated filesystem/git evidence resolution if `resolveReviewActionForFlowState` calls the callback more than once. It also risks inconsistent values during one status build if the underlying tree changes mid-call.  
**Suggestion:** Capture a lazy memoized value inside `buildStatusReviewViews`, e.g. `let treeSha; const resolveTreeSha = () => treeSha ??= resolveCurrentReviewTreeSha(root);`, then pass `resolveTreeSha`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Avoid repeated invalidation projection work
**Finding key:** loop-9192007ddc2085d91ed0
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `RepairEvidenceInvalidationPlan.apply()` computes `invalidatedArtifacts` and `invalidationRecords` through getters that each remap `this.invalidations`. This duplicates traversal and makes the return payload depend on recomputed projections after mutation application.  
**Suggestion:** Compute both arrays once in `apply()` before returning, and return those local values after `applyRepairInvalidations(...)`. This keeps the owned recovery result explicit and avoids redundant work.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** `RepairEvidenceInvalidationPlan.apply()` computes `invalidatedArtifacts` and `invalidationRecords` through getters that each remap `this.invalidations`. This duplicates traversal and makes the return payload depend on recomputed projections after mutation application.  
**Suggestion:** Compute both arrays once in `apply()` before returning, and return those local values after `applyRepairInvalidations(...)`. This keeps the owned recovery result explicit and avoids redundant work.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Rename stored invalidation records for clarity
**Finding key:** loop-c9557993b3a17e609b35
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The class field `this.invalidations` contains planned invalidation record objects, while the public return field `invalidations` contains serialized JSON records. The shared name makes it harder to distinguish plan objects from emitted recovery artifact data.  
**Suggestion:** Rename the internal field to `plannedInvalidations` or `invalidationPlanRecords`, and leave the public return key as `invalidations` for compatibility.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R4  
**Issue:** The class field `this.invalidations` contains planned invalidation record objects, while the public return field `invalidations` contains serialized JSON records. The shared name makes it harder to distinguish plan objects from emitted recovery artifact data.  
**Suggestion:** Rename the internal field to `plannedInvalidations` or `invalidationPlanRecords`, and leave the public return key as `invalidations` for compatibility.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 4. Extract Scoped Review Record Resolution
**Finding key:** loop-39db2c73421936172f7e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `resolveReviewActionForFlowState` now contains two resolution modes: latest scoped record and persisted target by tree SHA. The branching is compact but mixes scope filtering, argument validation, target matching, and state extraction in one function.  
**Suggestion:** Extract helpers such as `latestScopedConvergenceRecord(...)` and `latestTargetedConvergenceRecord(...)`. This would preserve behavior while making the persisted-target path easier to reason about and test independently.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `resolveReviewActionForFlowState` now contains two resolution modes: latest scoped record and persisted target by tree SHA. The branching is compact but mixes scope filtering, argument validation, target matching, and state extraction in one function.  
**Suggestion:** Extract helpers such as `latestScopedConvergenceRecord(...)` and `latestTargetedConvergenceRecord(...)`. This would preserve behavior while making the persisted-target path easier to reason about and test independently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 5. Rename `resolveTreeSha` For Consistency
**Finding key:** loop-ff6914e78d8d817e1ff4
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha` sounds like it may resolve a value asynchronously or perform broader lookup work, but this function expects a synchronous callback returning the current tree SHA.  
**Suggestion:** Rename the option to `getTreeSha` or `readTreeSha`, matching the synchronous callback shape and making the error message clearer: `getTreeSha is required for a persisted review target`.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R7  
**Issue:** `resolveTreeSha` sounds like it may resolve a value asynchronously or perform broader lookup work, but this function expects a synchronous callback returning the current tree SHA.  
**Suggestion:** Rename the option to `getTreeSha` or `readTreeSha`, matching the synchronous callback shape and making the error message clearer: `getTreeSha is required for a persisted review target`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 6. Extract Artifact Outcome Failure Formatting
**Finding key:** loop-d93e81db0e331b60a6da
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `checkIntegrationTestArtifacts` now has two separate failure-return blocks after trust validation: stale mismatch recovery and outcome failure. The outcome failure message construction is inline, which makes the main decision flow slightly harder to scan.  
**Suggestion:** Extract a small helper such as `failIntegrationArtifactValidation({ outcome, phase, level, specPath })`. This keeps the precheck flow focused on ordering: structural trust, stale classification, then outcome verdict.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R6  
**Issue:** `checkIntegrationTestArtifacts` now has two separate failure-return blocks after trust validation: stale mismatch recovery and outcome failure. The outcome failure message construction is inline, which makes the main decision flow slightly harder to scan.  
**Suggestion:** Extract a small helper such as `failIntegrationArtifactValidation({ outcome, phase, level, specPath })`. This keeps the precheck flow focused on ordering: structural trust, stale classification, then outcome verdict.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 1. Collapse The Transaction Helper Classes
**Finding key:** loop-8fc59bef0ccad5a285fb
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** `AdditionalArtifactDeletion`, `StagedArtifact`, and `StaleArtifactInvalidationTransaction` split a small staging workflow across several single-purpose classes. This adds object churn and indirection without matching the surrounding module style, which otherwise uses small functions and direct procedural flow.  
**Suggestion:** Replace these classes with local helper functions such as `collectExistingArtifacts(...)`, `stageArtifacts(...)`, `rollbackStagedArtifacts(...)`, and `commitStagedArtifacts(...)`. This would make the owned recovery transaction easier to audit and keep the mutation sequence visibly atomic.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** `AdditionalArtifactDeletion`, `StagedArtifact`, and `StaleArtifactInvalidationTransaction` split a small staging workflow across several single-purpose classes. This adds object churn and indirection without matching the surrounding module style, which otherwise uses small functions and direct procedural flow.  
**Suggestion:** Replace these classes with local helper functions such as `collectExistingArtifacts(...)`, `stageArtifacts(...)`, `rollbackStagedArtifacts(...)`, and `commitStagedArtifacts(...)`. This would make the owned recovery transaction easier to audit and keep the mutation sequence visibly atomic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 2. Rename `additional` To Reflect Existing Invalidations
**Finding key:** loop-e8a4dfcd9567120f7818
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** The variable name `additional` is vague and loses the important fact that it only contains paths that currently exist and will be invalidated.  
**Suggestion:** Rename it to `existingAdditionalArtifacts` or `additionalInvalidatedArtifacts` so the result construction clearly reports only artifacts that were actually part of the recovery operation.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** The variable name `additional` is vague and loses the important fact that it only contains paths that currently exist and will be invalidated.  
**Suggestion:** Rename it to `existingAdditionalArtifacts` or `additionalInvalidatedArtifacts` so the result construction clearly reports only artifacts that were actually part of the recovery operation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 3. Avoid Duplicate Rollback Error Aggregation
**Finding key:** loop-cde0ac48edb4c9eb7064
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** `rollback()` already throws an `AggregateError`, and `StaleRecoveryRollbackError` wraps that aggregate as a single-element aggregate. This creates nested aggregate errors that are harder to inspect and does not add much structure.  
**Suggestion:** Make `StaleRecoveryRollbackError` extend `Error` with `cause: rollbackError`, or flatten `rollbackError.errors` when available. Keep the original mutation error attached explicitly, for example as `mutationError`.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R4  
**Issue:** `rollback()` already throws an `AggregateError`, and `StaleRecoveryRollbackError` wraps that aggregate as a single-element aggregate. This creates nested aggregate errors that are harder to inspect and does not add much structure.  
**Suggestion:** Make `StaleRecoveryRollbackError` extend `Error` with `cause: rollbackError`, or flatten `rollbackError.errors` when available. Keep the original mutation error attached explicitly, for example as `mutationError`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 1. Consolidate Fingerprint Validation Errors
**Finding key:** loop-4d2240891171fb6c053f
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactFingerprintAuthority` duplicates the same repair fingerprint validation logic and error shape for result and review artifacts.  
**Suggestion:** Extract a small helper such as `assertValidRepairFingerprint(value, fileName)` and reuse it for both artifacts. This keeps malformed fingerprint handling consistent and makes future validation changes less error-prone.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactFingerprintAuthority` duplicates the same repair fingerprint validation logic and error shape for result and review artifacts.  
**Suggestion:** Extract a small helper such as `assertValidRepairFingerprint(value, fileName)` and reuse it for both artifacts. This keeps malformed fingerprint handling consistent and makes future validation changes less error-prone.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 2. Avoid Storing Unused Link Authority State
**Finding key:** loop-89cd7ef89826331348f3
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactLinkAuthority` stores `resultPath` and `rawOutputPath`, but the current diff shows no consumer using those fields. The class appears to exist only to validate artifact links.  
**Suggestion:** Either remove the stored fields and make the class purely validation-oriented, or replace the class with a helper like `assertIntegrationArtifactLinks({ root, specDir, result, review })` unless later code genuinely needs an authority object.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R5  
**Issue:** `IntegrationArtifactLinkAuthority` stores `resultPath` and `rawOutputPath`, but the current diff shows no consumer using those fields. The class appears to exist only to validate artifact links.  
**Suggestion:** Either remove the stored fields and make the class purely validation-oriented, or replace the class with a helper like `assertIntegrationArtifactLinks({ root, specDir, result, review })` unless later code genuinely needs an authority object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 3. Rename Authority Function For Clarity
**Finding key:** loop-7f03f333effdbb2e5edd
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R1  
**Issue:** `assertIntegrationRegressionAuthority` now performs structural regression evidence checks, while `assertIntegrationTestOutcome` separately validates verdict/result pass status. The name “Authority” is broad and can be confused with the newer `IntegrationArtifactTrustAssessment` authority classes.  
**Suggestion:** Rename it to something more specific, such as `assertIntegrationRegressionStructure` or `assertIntegrationRegressionTrustInputs`, to make the outcome/structure split easier to follow.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R1  
**Issue:** `assertIntegrationRegressionAuthority` now performs structural regression evidence checks, while `assertIntegrationTestOutcome` separately validates verdict/result pass status. The name “Authority” is broad and can be confused with the newer `IntegrationArtifactTrustAssessment` authority classes.  
**Suggestion:** Rename it to something more specific, such as `assertIntegrationRegressionStructure` or `assertIntegrationRegressionTrustInputs`, to make the outcome/structure split easier to follow.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 4. Remove Unused Artifact Map Method If Not Consumed
**Finding key:** loop-0a108b5bd5f84c0d60d2
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `IntegrationArtifactFingerprintAuthority.toArtifactMap()` is introduced but not used in the shown diff. If there is no consumer elsewhere in the touched file, it is dead API surface.  
**Suggestion:** Remove `toArtifactMap()` until a concrete caller needs it, or replace current consumers with it if the intent is to standardize artifact map construction.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Requirement:** R2  
**Issue:** `IntegrationArtifactFingerprintAuthority.toArtifactMap()` is introduced but not used in the shown diff. If there is no consumer elsewhere in the touched file, it is dead API surface.  
**Suggestion:** Remove `toArtifactMap()` until a concrete caller needs it, or replace current consumers with it if the intent is to standardize artifact map construction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 1. Extract Flow State Fixture Builder
**Finding key:** loop-6042da9ee93eb6a69709
**Failure mode:** refactor
**File:** tests/unit/flow/review-convergence-action.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** Each test repeats the same `flowState.reviewConvergence.version/records` wrapper, which makes the tests noisier and obscures the behavior under review.  
**Suggestion:** Add a small helper such as `flowStateWithRecords(records)` and use it across the tests.
**Suggestion:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** Each test repeats the same `flowState.reviewConvergence.version/records` wrapper, which makes the tests noisier and obscures the behavior under review.  
**Suggestion:** Add a small helper such as `flowStateWithRecords(records)` and use it across the tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 2. Rename `toolingRecord` to Clarify Its Fixture Semantics
**Finding key:** loop-4c2cedca4f6ec6f48756
**Failure mode:** refactor
**File:** tests/unit/flow/review-convergence-action.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `toolingRecord` sounds generic, but the helper always creates a failed tooling-result record with `TOOLING_ERROR` and `stage: "result_recording"`.  
**Suggestion:** Rename it to something more precise, such as `toolingErrorRecord` or `failedToolingRecord`, so test intent is clearer.
**Suggestion:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `toolingRecord` sounds generic, but the helper always creates a failed tooling-result record with `TOOLING_ERROR` and `stage: "result_recording"`.  
**Suggestion:** Rename it to something more precise, such as `toolingErrorRecord` or `failedToolingRecord`, so test intent is clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 3. Avoid Hard-Coded Attempt Math in Fixture
**Finding key:** loop-6dff5d9ac3b863b6e72c
**Failure mode:** refactor
**File:** tests/unit/flow/review-convergence-action.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `remainingAttempts: 2 - attempt` duplicates the implicit `maxAttempts: 2` value. If `maxAttempts` changes, the fixture can become internally inconsistent.  
**Suggestion:** Introduce a local `const maxAttempts = 2;` inside the helper and set both `maxAttempts` and `remainingAttempts: maxAttempts - attempt` from it.
**Suggestion:** **File:** `tests/unit/flow/review-convergence-action.test.js`  
**Requirement:** R8  
**Issue:** `remainingAttempts: 2 - attempt` duplicates the implicit `maxAttempts: 2` value. If `maxAttempts` changes, the fixture can become internally inconsistent.  
**Suggestion:** Introduce a local `const maxAttempts = 2;` inside the helper and set both `maxAttempts` and `remainingAttempts: maxAttempts - attempt` from it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 1. Standardize Review Phase Naming
**Finding key:** loop-cf762ce320f78b5a8aea
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** Multiple artifacts and code paths use overlapping names for the same lifecycle concepts: `test`, `test-review`, `impl`, `impl-review`, `draft-questions`, and `draft-questions-review`. The same inconsistency appears in `flow.json`, `test-review.json`, and review convergence handling, making it unclear whether a value is a step id, review phase, canonical phase, or target step.
**Suggestion:** Define one canonical vocabulary for persisted review state, for example `stepId`, `reviewPhase`, and `canonicalPhase`, then update producers and consumers to avoid storing step-like values in generic `phase` fields.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** Multiple artifacts and code paths use overlapping names for the same lifecycle concepts: `test`, `test-review`, `impl`, `impl-review`, `draft-questions`, and `draft-questions-review`. The same inconsistency appears in `flow.json`, `test-review.json`, and review convergence handling, making it unclear whether a value is a step id, review phase, canonical phase, or target step.
**Suggestion:** Define one canonical vocabulary for persisted review state, for example `stepId`, `reviewPhase`, and `canonicalPhase`, then update producers and consumers to avoid storing step-like values in generic `phase` fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 2. Rename `resolveTreeSha` Consistently Across Callers
**Finding key:** loop-92a2c815933063be67ef
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** `resolveReviewActionForFlowState` accepts `resolveTreeSha`, while callers in `get-next-action.js` and `get-status.js` pass callbacks that synchronously read the current review tree SHA. The name is broad and repeated across files, and reviewers separately suggested memoizing the callback in both callers.
**Suggestion:** Rename the option to `getTreeSha` or `readTreeSha`, and memoize the value at the call sites so one status/action resolution uses a stable tree SHA.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`
**Requirement:** R7
**Issue:** `resolveReviewActionForFlowState` accepts `resolveTreeSha`, while callers in `get-next-action.js` and `get-status.js` pass callbacks that synchronously read the current review tree SHA. The name is broad and repeated across files, and reviewers separately suggested memoizing the callback in both callers.
**Suggestion:** Rename the option to `getTreeSha` or `readTreeSha`, and memoize the value at the call sites so one status/action resolution uses a stable tree SHA.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 3. Consolidate Duplicate Finding Representations
**Finding key:** loop-1fd97fc555bfbb3162b8
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json`
**Requirement:** R5
**Issue:** Several review artifacts store the same finding payload twice under different collections, such as `blockingFindings` plus `findings`, or `repairTargets` plus `findings`. This pattern appears across draft-question and test-attempt history files and creates drift risk between parallel representations.
**Suggestion:** Keep one canonical `findings` array with severity/category fields, and derive `blockingFindings`, `repairTargets`, or advisory subsets by filtering or by storing lightweight finding-id references.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-001.json`
**Requirement:** R5
**Issue:** Several review artifacts store the same finding payload twice under different collections, such as `blockingFindings` plus `findings`, or `repairTargets` plus `findings`. This pattern appears across draft-question and test-attempt history files and creates drift risk between parallel representations.
**Suggestion:** Keep one canonical `findings` array with severity/category fields, and derive `blockingFindings`, `repairTargets`, or advisory subsets by filtering or by storing lightweight finding-id references.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 4. Use Unique Finding IDs Across Review History
**Finding key:** loop-bde3c7a3f0f03f1c974a
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json
**Requirement:** R7
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`
**Requirement:** R7
**Issue:** Both `test-attempt-002.json` and `test-attempt-003.json` reuse the same `findingId`, `fingerprint`, and `id` for distinct findings. This breaks cross-file deduplication and makes history correlation ambiguous.
**Suggestion:** Generate stable finding identifiers from each finding’s requirement id plus normalized title/body/target so separate R5 and R7 findings receive distinct ids.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-history/test-attempt-002.json`
**Requirement:** R7
**Issue:** Both `test-attempt-002.json` and `test-attempt-003.json` reuse the same `findingId`, `fingerprint`, and `id` for distinct findings. This breaks cross-file deduplication and makes history correlation ambiguous.
**Suggestion:** Generate stable finding identifiers from each finding’s requirement id plus normalized title/body/target so separate R5 and R7 findings receive distinct ids.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 5. Normalize Generated Review Artifact Metadata
**Finding key:** loop-e2f8db1e9170189b57d9
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-questions-triage.json
**Requirement:** R5
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`
**Requirement:** R5
**Issue:** `draft-review-coverage.json` includes `generatedAt`, while related triage and repair artifacts omit it. Because these files belong to the same generated review artifact family, provenance metadata is inconsistent across files.
**Suggestion:** Add `generatedAt` with the same ISO timestamp format and placement convention to `draft-questions-triage.json` and `draft-questions-repair.json`.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-questions-triage.json`
**Requirement:** R5
**Issue:** `draft-review-coverage.json` includes `generatedAt`, while related triage and repair artifacts omit it. Because these files belong to the same generated review artifact family, provenance metadata is inconsistent across files.
**Suggestion:** Add `generatedAt` with the same ISO timestamp format and placement convention to `draft-questions-triage.json` and `draft-questions-repair.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 6. Apply One JSON Formatting Policy To Evidence Artifacts
**Finding key:** loop-04a26f86cd2e1ed55693
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json
**Requirement:** R8
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`
**Requirement:** R8
**Issue:** Multiple evidence JSON files are stored as single-line compact JSON while review-history JSON files are pretty-printed. This creates inconsistent generated artifact diffs and makes cross-file review harder.
**Suggestion:** Use one canonical JSON serialization policy for generated evidence artifacts, preferably stable pretty-printed JSON with consistent key ordering.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/review-evidence/667f4562f63ed3378f9db5046830723dbdbd756d4c4d8b49731c3e7b21c24e81.json`
**Requirement:** R8
**Issue:** Multiple evidence JSON files are stored as single-line compact JSON while review-history JSON files are pretty-printed. This creates inconsistent generated artifact diffs and makes cross-file review harder.
**Suggestion:** Use one canonical JSON serialization policy for generated evidence artifacts, preferably stable pretty-printed JSON with consistent key ordering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 7. Remove Ordinal Prefixes From Persisted Titles
**Finding key:** loop-aa05cbb1c7ddcf424cb6
**Failure mode:** refactor
**File:** specs/334-stale-test-evidence-recovery/draft-review-questions.json
**Requirement:** R4
**Issue:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`
**Requirement:** R4
**Issue:** Both `draft-review-questions.json` and `draft-questions-triage.json` persist numeric prefixes in title strings, duplicating array order in content and making titles stale if entries are reordered.
**Suggestion:** Store descriptive titles without ordinals and apply numbering only in renderers or reports.
**Suggestion:** **File:** `specs/334-stale-test-evidence-recovery/draft-review-questions.json`
**Requirement:** R4
**Issue:** Both `draft-review-questions.json` and `draft-questions-triage.json` persist numeric prefixes in title strings, duplicating array order in content and making titles stale if entries are reordered.
**Suggestion:** Store descriptive titles without ordinals and apply numbering only in renderers or reports.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
