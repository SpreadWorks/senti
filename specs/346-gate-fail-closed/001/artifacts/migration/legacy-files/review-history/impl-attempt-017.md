# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Remove duplicated gate failure observations
**Finding key:** loop-6cdfb1f6f5877f8cac8f
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same two `complete-context` failures are represented twice, once under `evaluations` and again under top-level `observations`, with nearly identical fields and text. This duplicates data and creates drift risk between the two collections.  
**Suggestion:** Keep one canonical representation and derive the other when needed, or make `evaluations[].observations` reference/shared-source the top-level observations instead of copying the full payload.
**Suggestion:** **File:** `specs/346-gate-fail-closed/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same two `complete-context` failures are represented twice, once under `evaluations` and again under top-level `observations`, with nearly identical fields and text. This duplicates data and creates drift risk between the two collections.  
**Suggestion:** Keep one canonical representation and derive the other when needed, or make `evaluations[].observations` reference/shared-source the top-level observations instead of copying the full payload.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Normalize empty review/triage/repair artifacts
**Finding key:** loop-44cf918b936b33e9f442
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/draft-review-coverage.json
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/draft-review-coverage.json`  
**Requirement:** R4  
**Issue:** The empty review artifact shape is repeated across review, triage, and repair files with only `phase`, source field, timestamp, and summary text changing. This makes generated artifacts noisy and harder to compare.  
**Suggestion:** Use a consistent minimal empty-artifact schema or generation helper contract so empty states are represented uniformly, for example by standardizing `source`, `status`, `summary`, and `items` fields across all empty draft workflow artifacts.
**Suggestion:** **File:** `specs/346-gate-fail-closed/draft-review-coverage.json`  
**Requirement:** R4  
**Issue:** The empty review artifact shape is repeated across review, triage, and repair files with only `phase`, source field, timestamp, and summary text changing. This makes generated artifacts noisy and harder to compare.  
**Suggestion:** Use a consistent minimal empty-artifact schema or generation helper contract so empty states are represented uniformly, for example by standardizing `source`, `status`, `summary`, and `items` fields across all empty draft workflow artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 3. Fix inconsistent JSON formatting in scope arrays
**Finding key:** loop-b266ac5c62aa1761bc9c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/draft.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/draft.json`  
**Requirement:** R6  
**Issue:** Two array entries place the comma at the beginning of the next line, unlike the rest of the file. This is valid JSON but inconsistent with the surrounding formatting and makes diffs harder to read.  
**Suggestion:** Move leading commas to the previous line and format the arrays consistently with the rest of the file.
**Suggestion:** **File:** `specs/346-gate-fail-closed/draft.json`  
**Requirement:** R6  
**Issue:** Two array entries place the comma at the beginning of the next line, unlike the rest of the file. This is valid JSON but inconsistent with the surrounding formatting and makes diffs harder to read.  
**Suggestion:** Move leading commas to the previous line and format the arrays consistently with the rest of the file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Replace duplicated failure-kind field names with one convention
**Finding key:** loop-31a71f5b4977f09a1095
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** Failure metadata appears in both snake_case and camelCase forms, such as `guardrail_id` and `guardrailId`, plus duplicated `findingId` and `fingerprint` values. This weakens naming consistency and makes consumers guess which field is authoritative.  
**Suggestion:** Pick one naming convention for generated JSON artifacts, preferably the existing project artifact convention, and avoid emitting duplicate aliases unless backward compatibility requires them. If aliases are required, document which field is canonical.
**Suggestion:** **File:** `specs/346-gate-fail-closed/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** Failure metadata appears in both snake_case and camelCase forms, such as `guardrail_id` and `guardrailId`, plus duplicated `findingId` and `fingerprint` values. This weakens naming consistency and makes consumers guess which field is authoritative.  
**Suggestion:** Pick one naming convention for generated JSON artifacts, preferably the existing project artifact convention, and avoid emitting duplicate aliases unless backward compatibility requires them. If aliases are required, document which field is canonical.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Normalize Repeated Repair Invalidation Data
**Finding key:** loop-c738e5e6e4769a7b600e
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/impl-repair.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/impl-repair.json`
**Requirement:** R6
**Issue:** Each repair entry repeats the same `invalidatedArtifacts` list and then duplicates the same paths again in `invalidations`, with only the reason/fingerprint varying. This makes the artifact noisy and harder to review.
**Suggestion:** Store the common invalidated artifact paths once, then keep per-repair metadata such as `reason`, `previousFingerprint`, and mismatch type separately. If full expansion is required for consumers, generate it at read time.
**Suggestion:** **File:** `specs/346-gate-fail-closed/impl-repair.json`
**Requirement:** R6
**Issue:** Each repair entry repeats the same `invalidatedArtifacts` list and then duplicates the same paths again in `invalidations`, with only the reason/fingerprint varying. This makes the artifact noisy and harder to review.
**Suggestion:** Store the common invalidated artifact paths once, then keep per-repair metadata such as `reason`, `previousFingerprint`, and mismatch type separately. If full expansion is required for consumers, generate it at read time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Add Explicit Bounds To Flow History Arrays
**Finding key:** loop-d23671c6ef63bbfc944b
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/flow.json`
**Requirement:** R6
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, and `issueLog`-style embedded histories can grow without an explicit retained-count or size limit. This violates the `bounded-resource-usage` guardrail for bulk data loading/history retention.
**Suggestion:** Add explicit retention metadata and enforcement, for example `maxEvidenceHistoryEntries`, `maxMetricsEntries`, or a documented compaction policy that caps entries per phase/task.
**Suggestion:** **File:** `specs/346-gate-fail-closed/flow.json`
**Requirement:** R6
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewConvergence.records[*].evidenceHistory`, and `issueLog`-style embedded histories can grow without an explicit retained-count or size limit. This violates the `bounded-resource-usage` guardrail for bulk data loading/history retention.
**Suggestion:** Add explicit retention metadata and enforcement, for example `maxEvidenceHistoryEntries`, `maxMetricsEntries`, or a documented compaction policy that caps entries per phase/task.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Collapse Repeated Issue Log Repair Entries
**Finding key:** loop-ce6217e41346a54ceb8a
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/issue-log.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/issue-log.json`
**Requirement:** R6
**Issue:** The log contains many near-identical `impl-repair completed` entries that differ only by `normalizedFindingId`, while repeating the same `reason`, `trigger`, `resolution`, `repairRef`, and timestamp.
**Suggestion:** Represent these as one grouped repair entry with `normalizedFindingIds: [...]`, or reference the corresponding `impl-repair.json` repair id once. This removes duplication while preserving traceability.
**Suggestion:** **File:** `specs/346-gate-fail-closed/issue-log.json`
**Requirement:** R6
**Issue:** The log contains many near-identical `impl-repair completed` entries that differ only by `normalizedFindingId`, while repeating the same `reason`, `trigger`, `resolution`, `repairRef`, and timestamp.
**Suggestion:** Represent these as one grouped repair entry with `normalizedFindingIds: [...]`, or reference the corresponding `impl-repair.json` repair id once. This removes duplication while preserving traceability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Normalize Review Evidence Formatting
**Finding key:** loop-a8de4c8ba03834bff07f
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-evidence/11b2d4f686d5e8f680d44b1b69b4d1f53352c7b859b7bd28220eea1141061bd1.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-evidence/11b2d4f686d5e8f680d44b1b69b4d1f53352c7b859b7bd28220eea1141061bd1.json`  
**Requirement:** R6  
**Issue:** The new evidence files are committed as single-line minified JSON, which makes review diffs hard to inspect and increases the chance that future small changes appear as whole-file rewrites.  
**Suggestion:** Store review evidence JSON in a consistently pretty-printed format, or ensure the generator writes stable formatted output for all files in `review-evidence`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-evidence/11b2d4f686d5e8f680d44b1b69b4d1f53352c7b859b7bd28220eea1141061bd1.json`  
**Requirement:** R6  
**Issue:** The new evidence files are committed as single-line minified JSON, which makes review diffs hard to inspect and increases the chance that future small changes appear as whole-file rewrites.  
**Suggestion:** Store review evidence JSON in a consistently pretty-printed format, or ensure the generator writes stable formatted output for all files in `review-evidence`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Avoid Repeating Identical Finding Identifiers
**Finding key:** loop-3339796c1c5822fb7f54
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-evidence/216e6bedbb8c84267e64d5ab73d55fcd40b16807ef767c3c9df20b6428a7d654.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-evidence/216e6bedbb8c84267e64d5ab73d55fcd40b16807ef767c3c9df20b6428a7d654.json`  
**Requirement:** R6  
**Issue:** Each finding repeats the same hash in both `findingId` and `fingerprint`. If these fields are always identical, the duplicated data adds noise and creates a risk of inconsistent future artifacts.  
**Suggestion:** If the schema allows it, keep only one canonical identifier field. If both are required by consumers, document that they intentionally mirror each other and enforce equality in the evidence generation/validation path.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-evidence/216e6bedbb8c84267e64d5ab73d55fcd40b16807ef767c3c9df20b6428a7d654.json`  
**Requirement:** R6  
**Issue:** Each finding repeats the same hash in both `findingId` and `fingerprint`. If these fields are always identical, the duplicated data adds noise and creates a risk of inconsistent future artifacts.  
**Suggestion:** If the schema allows it, keep only one canonical identifier field. If both are required by consumers, document that they intentionally mirror each other and enforce equality in the evidence generation/validation path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 3. Consolidate Duplicate Rejection Evidence
**Finding key:** loop-0957fb01fb95d9b15c7f
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-evidence/27a8949f9c7a15b7025f2ee894ad0b42034abeb2e7eadf1572f402e05a6937c5.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-evidence/27a8949f9c7a15b7025f2ee894ad0b42034abeb2e7eadf1572f402e05a6937c5.json`  
**Requirement:** R6  
**Issue:** This file and `5fc41f8ef2fda61c60f4fa90140087c5be17dcbdfc6d92d995e1d990e4a13117.json` appear to record the same blocking finding for the same task, phase, tree SHA, and finding fingerprint, differing mainly by capture metadata and summary wording.  
**Suggestion:** Avoid committing multiple evidence artifacts for the same canonical finding unless the distinct invocation history is required. Prefer a single canonical evidence record, or add an explicit field explaining supersession/retry semantics.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-evidence/27a8949f9c7a15b7025f2ee894ad0b42034abeb2e7eadf1572f402e05a6937c5.json`  
**Requirement:** R6  
**Issue:** This file and `5fc41f8ef2fda61c60f4fa90140087c5be17dcbdfc6d92d995e1d990e4a13117.json` appear to record the same blocking finding for the same task, phase, tree SHA, and finding fingerprint, differing mainly by capture metadata and summary wording.  
**Suggestion:** Avoid committing multiple evidence artifacts for the same canonical finding unless the distinct invocation history is required. Prefer a single canonical evidence record, or add an explicit field explaining supersession/retry semantics.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 4. Make Nullable Task Scope Explicit
**Finding key:** loop-7fc2b85783fada7a00a0
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-evidence/29bded05c9a48b8ca47cfdfb72bb9eed9a9d76063286fcfb7f29679c9021e02f.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-evidence/29bded05c9a48b8ca47cfdfb72bb9eed9a9d76063286fcfb7f29679c9021e02f.json`  
**Requirement:** R6  
**Issue:** `taskId` is `null` in some artifacts and a concrete task ID in others. Without an explicit scope field, `null` can be ambiguous: whole-change review, unassigned task, or missing data.  
**Suggestion:** Replace or supplement `taskId: null` with an explicit scope value such as `scope: "change"` or `taskId: null, taskScope: "global"` so downstream consumers and reviewers do not infer intent from nullability.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-evidence/29bded05c9a48b8ca47cfdfb72bb9eed9a9d76063286fcfb7f29679c9021e02f.json`  
**Requirement:** R6  
**Issue:** `taskId` is `null` in some artifacts and a concrete task ID in others. Without an explicit scope field, `null` can be ambiguous: whole-change review, unassigned task, or missing data.  
**Suggestion:** Replace or supplement `taskId: null` with an explicit scope value such as `scope: "change"` or `taskId: null, taskScope: "global"` so downstream consumers and reviewers do not infer intent from nullability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Normalize Review Evidence Formatting
**Finding key:** loop-9b7546ce705ca1f76f9c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-evidence/bbaa15e638f31442eadd5655eb42aa763a04d63bba7cab0c40ba8c695c128e40.json
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/review-evidence/bbaa15e638f31442eadd5655eb42aa763a04d63bba7cab0c40ba8c695c128e40.json`
**Requirement:** R2
**Issue:** The review-evidence files are stored as single-line JSON, while `review-history/draft-coverage-attempt-001.json` is pretty-printed. This inconsistency makes diffs, reviews, and manual inspection harder.
**Suggestion:** Format this evidence JSON with the same multi-line indentation style used by the review-history artifact, or enforce a single formatter for all generated review artifacts.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-evidence/bbaa15e638f31442eadd5655eb42aa763a04d63bba7cab0c40ba8c695c128e40.json`
**Requirement:** R2
**Issue:** The review-evidence files are stored as single-line JSON, while `review-history/draft-coverage-attempt-001.json` is pretty-printed. This inconsistency makes diffs, reviews, and manual inspection harder.
**Suggestion:** Format this evidence JSON with the same multi-line indentation style used by the review-history artifact, or enforce a single formatter for all generated review artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Normalize Review Evidence Formatting
**Finding key:** loop-47a7cf76f83e0780b4b2
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-evidence/c0ef92872ca74c248bf6fdb46ec6d5a55fd5a5f9990eab0d58b6fb7009fbe663.json
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/review-evidence/c0ef92872ca74c248bf6fdb46ec6d5a55fd5a5f9990eab0d58b6fb7009fbe663.json`
**Requirement:** R1
**Issue:** This file contains many repeated finding objects in a single minified line, which obscures field-level changes and makes duplicate `findingId` / `fingerprint` patterns harder to review.
**Suggestion:** Pretty-print the JSON and keep one finding object per block so reviewers can compare `evidenceRefs`, `findingId`, `fingerprint`, and `summary` cleanly.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-evidence/c0ef92872ca74c248bf6fdb46ec6d5a55fd5a5f9990eab0d58b6fb7009fbe663.json`
**Requirement:** R1
**Issue:** This file contains many repeated finding objects in a single minified line, which obscures field-level changes and makes duplicate `findingId` / `fingerprint` patterns harder to review.
**Suggestion:** Pretty-print the JSON and keep one finding object per block so reviewers can compare `evidenceRefs`, `findingId`, `fingerprint`, and `summary` cleanly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Consider Omitting Empty Finding Arrays In PASS Artifacts
**Finding key:** loop-9ebaafebcef9345374ce
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-evidence/fc66cf1b7a656f0f78addbb959a533f80c535ee3cab4c25349717933658f3dbc.json
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/review-evidence/fc66cf1b7a656f0f78addbb959a533f80c535ee3cab4c25349717933658f3dbc.json`
**Requirement:** R4
**Issue:** PASS artifacts repeat empty `blockingFindings` and `advisoryFindings` arrays. If the schema does not require these fields, they add noise without information.
**Suggestion:** Either omit empty finding arrays for PASS dispositions or document that the schema intentionally requires them for downstream consumers.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-evidence/fc66cf1b7a656f0f78addbb959a533f80c535ee3cab4c25349717933658f3dbc.json`
**Requirement:** R4
**Issue:** PASS artifacts repeat empty `blockingFindings` and `advisoryFindings` arrays. If the schema does not require these fields, they add noise without information.
**Suggestion:** Either omit empty finding arrays for PASS dispositions or document that the schema intentionally requires them for downstream consumers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Consider Omitting Null Task IDs When Not Applicable
**Finding key:** loop-b1359ccba51ef6b12f4c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-evidence/fc7be35d3918ba8878075e0cfb7ecbf13d21eda5f0c7832e8d6843b5cd67714d.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-evidence/fc7be35d3918ba8878075e0cfb7ecbf13d21eda5f0c7832e8d6843b5cd67714d.json`
**Requirement:** R6
**Issue:** `taskId:null` appears in artifacts where no task applies. If nullable fields are not required by the artifact schema, this creates unnecessary serialized noise.
**Suggestion:** Prefer omitting `taskId` when absent, or standardize on explicit `null` only if downstream validation requires a stable key set.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-evidence/fc7be35d3918ba8878075e0cfb7ecbf13d21eda5f0c7832e8d6843b5cd67714d.json`
**Requirement:** R6
**Issue:** `taskId:null` appears in artifacts where no task applies. If nullable fields are not required by the artifact schema, this creates unnecessary serialized noise.
**Suggestion:** Prefer omitting `taskId` when absent, or standardize on explicit `null` only if downstream validation requires a stable key set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Consolidate Repeated Draft Coverage PASS Records
**Finding key:** loop-ed2c22d386ec6faf000b
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/draft-coverage-attempt-002.json
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/draft-coverage-attempt-002.json`  
**Requirement:** R3  
**Issue:** This file is nearly identical to `draft-coverage-attempt-003.json`, differing only in `generatedAt` and `attempt`. Keeping full duplicate snapshots makes the review history verbose without adding much information.  
**Suggestion:** Store repeated PASS attempts as entries in a single phase-level history file, with per-attempt metadata containing only `attempt`, `generatedAt`, and `verdict`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/draft-coverage-attempt-002.json`  
**Requirement:** R3  
**Issue:** This file is nearly identical to `draft-coverage-attempt-003.json`, differing only in `generatedAt` and `attempt`. Keeping full duplicate snapshots makes the review history verbose without adding much information.  
**Suggestion:** Store repeated PASS attempts as entries in a single phase-level history file, with per-attempt metadata containing only `attempt`, `generatedAt`, and `verdict`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Avoid Storing Duplicate Review Findings Twice
**Finding key:** loop-db713f406dfd6ba0d514
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-001.json`  
**Requirement:** R1  
**Issue:** The same findings are duplicated in both `blockingFindings` and `findings`, with repeated fields such as IDs, titles, rationale, requirement, disposition, and repeat count. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Store the canonical finding records once, preferably in `findings`, and derive `blockingFindings` by filtering on `severity: "blocking"` when rendering or consuming the artifact.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-001.json`  
**Requirement:** R1  
**Issue:** The same findings are duplicated in both `blockingFindings` and `findings`, with repeated fields such as IDs, titles, rationale, requirement, disposition, and repeat count. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Store the canonical finding records once, preferably in `findings`, and derive `blockingFindings` by filtering on `severity: "blocking"` when rendering or consuming the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Normalize Empty PASS Attempt Artifacts
**Finding key:** loop-2b3ebeba918b864d56fe
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-002.json
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-002.json`  
**Requirement:** R2  
**Issue:** PASS artifacts repeat a large amount of boilerplate structure with empty arrays and zero-count summaries. The same shape appears across other attempt files, making history noisy and harder to scan.  
**Suggestion:** Introduce a compact PASS artifact format for zero-finding attempts, or omit redundant empty collections such as `blockingFindings`, `nonBlockingImprovements`, and `findings` when `summary.total` is `0`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-002.json`  
**Requirement:** R2  
**Issue:** PASS artifacts repeat a large amount of boilerplate structure with empty arrays and zero-count summaries. The same shape appears across other attempt files, making history noisy and harder to scan.  
**Suggestion:** Introduce a compact PASS artifact format for zero-finding attempts, or omit redundant empty collections such as `blockingFindings`, `nonBlockingImprovements`, and `findings` when `summary.total` is `0`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 4. Consolidate Repeated Draft Questions PASS Records
**Finding key:** loop-8a35a973272f3bbad419
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/draft-questions-attempt-001.json
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/draft-questions-attempt-001.json`  
**Requirement:** R3  
**Issue:** The draft question review attempts duplicate the same successful result structure across separate files, with only timestamp and attempt number changing.  
**Suggestion:** Use one `draft-questions-history.json` artifact containing an array of attempts, or generate these files from a shared schema/template to avoid duplicated static fields.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/draft-questions-attempt-001.json`  
**Requirement:** R3  
**Issue:** The draft question review attempts duplicate the same successful result structure across separate files, with only timestamp and attempt number changing.  
**Suggestion:** Use one `draft-questions-history.json` artifact containing an array of attempts, or generate these files from a shared schema/template to avoid duplicated static fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 5. Remove Redundant Markdown Mirrors
**Finding key:** loop-51f4375dd17e63539c41
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-001.md
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-001.md`  
**Requirement:** R4  
**Issue:** The Markdown file mirrors the JSON review result almost exactly. This creates two sources of truth for the same review content.  
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or clearly mark Markdown files as generated outputs and exclude them from hand-maintained history.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-001.md`  
**Requirement:** R4  
**Issue:** The Markdown file mirrors the JSON review result almost exactly. This creates two sources of truth for the same review content.  
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or clearly mark Markdown files as generated outputs and exclude them from hand-maintained history.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 6. Use Consistent Summary Field Naming
**Finding key:** loop-1159b73f976505e66da3
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-003.json
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-003.json`  
**Requirement:** R5  
**Issue:** The artifact uses both `verdict` and `contractSummary.result`, plus both top-level `summary` and nested `contractSummary` fields. Some of these names overlap semantically, which makes consumers choose between equivalent-looking values.  
**Suggestion:** Standardize on one canonical outcome field, such as top-level `verdict`, and reserve `contractSummary` for fields that are genuinely contract-specific and not duplicated elsewhere.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-003.json`  
**Requirement:** R5  
**Issue:** The artifact uses both `verdict` and `contractSummary.result`, plus both top-level `summary` and nested `contractSummary` fields. Some of these names overlap semantically, which makes consumers choose between equivalent-looking values.  
**Suggestion:** Standardize on one canonical outcome field, such as top-level `verdict`, and reserve `contractSummary` for fields that are genuinely contract-specific and not duplicated elsewhere.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Avoid Storing Duplicate Review Findings Twice
**Finding key:** loop-ba4d9e74d0792c8d49cb
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-004.md
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R1  
**Issue:** The same findings are duplicated in both `blockingFindings` and `findings`, with repeated fields such as IDs, titles, rationale, requirement, disposition, and repeat count. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Store the canonical finding records once, preferably in `findings`, and derive `blockingFindings` by filtering on `severity: "blocking"` when rendering or consuming the artifact.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R1  
**Issue:** The same findings are duplicated in both `blockingFindings` and `findings`, with repeated fields such as IDs, titles, rationale, requirement, disposition, and repeat count. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Store the canonical finding records once, preferably in `findings`, and derive `blockingFindings` by filtering on `severity: "blocking"` when rendering or consuming the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Normalize Empty PASS Attempt Artifacts
**Finding key:** loop-51a1cbce36f68cd5139b
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-004.md
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R2  
**Issue:** PASS artifacts repeat a large amount of boilerplate structure with empty arrays and zero-count summaries. The same shape appears across other attempt files, making history noisy and harder to scan.  
**Suggestion:** Introduce a compact PASS artifact format for zero-finding attempts, or omit redundant empty collections such as `blockingFindings`, `nonBlockingImprovements`, and `findings` when `summary.total` is `0`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R2  
**Issue:** PASS artifacts repeat a large amount of boilerplate structure with empty arrays and zero-count summaries. The same shape appears across other attempt files, making history noisy and harder to scan.  
**Suggestion:** Introduce a compact PASS artifact format for zero-finding attempts, or omit redundant empty collections such as `blockingFindings`, `nonBlockingImprovements`, and `findings` when `summary.total` is `0`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Consolidate Repeated Draft Coverage PASS Records
**Finding key:** loop-de0217e7cf6ba5523c8c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-004.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R3  
**Issue:** This file is nearly identical to `draft-coverage-attempt-003.json`, differing only in `generatedAt` and `attempt`. Keeping full duplicate snapshots makes the review history verbose without adding much information.  
**Suggestion:** Store repeated PASS attempts as entries in a single phase-level history file, with per-attempt metadata containing only `attempt`, `generatedAt`, and `verdict`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R3  
**Issue:** This file is nearly identical to `draft-coverage-attempt-003.json`, differing only in `generatedAt` and `attempt`. Keeping full duplicate snapshots makes the review history verbose without adding much information.  
**Suggestion:** Store repeated PASS attempts as entries in a single phase-level history file, with per-attempt metadata containing only `attempt`, `generatedAt`, and `verdict`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Consolidate Repeated Draft Questions PASS Records
**Finding key:** loop-4a201a038fc4dfe21561
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-004.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R3  
**Issue:** The draft question review attempts duplicate the same successful result structure across separate files, with only timestamp and attempt number changing.  
**Suggestion:** Use one `draft-questions-history.json` artifact containing an array of attempts, or generate these files from a shared schema/template to avoid duplicated static fields.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R3  
**Issue:** The draft question review attempts duplicate the same successful result structure across separate files, with only timestamp and attempt number changing.  
**Suggestion:** Use one `draft-questions-history.json` artifact containing an array of attempts, or generate these files from a shared schema/template to avoid duplicated static fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Remove Redundant Markdown Mirrors
**Finding key:** loop-65ba77ab988be3dfddc1
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-004.md
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R4  
**Issue:** The Markdown file mirrors the JSON review result almost exactly. This creates two sources of truth for the same review content.  
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or clearly mark Markdown files as generated outputs and exclude them from hand-maintained history.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R4  
**Issue:** The Markdown file mirrors the JSON review result almost exactly. This creates two sources of truth for the same review content.  
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or clearly mark Markdown files as generated outputs and exclude them from hand-maintained history.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 6. Use Consistent Summary Field Naming
**Finding key:** loop-628dbf8ab2e0d6883f62
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-004.md
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R5  
**Issue:** The artifact uses both `verdict` and `contractSummary.result`, plus both top-level `summary` and nested `contractSummary` fields. Some of these names overlap semantically, which makes consumers choose between equivalent-looking values.  
**Suggestion:** Standardize on one canonical outcome field, such as top-level `verdict`, and reserve `contractSummary` for fields that are genuinely contract-specific and not duplicated elsewhere.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-004.md`  
**Requirement:** R5  
**Issue:** The artifact uses both `verdict` and `contractSummary.result`, plus both top-level `summary` and nested `contractSummary` fields. Some of these names overlap semantically, which makes consumers choose between equivalent-looking values.  
**Suggestion:** Standardize on one canonical outcome field, such as top-level `verdict`, and reserve `contractSummary` for fields that are genuinely contract-specific and not duplicated elsewhere.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Avoid Storing Duplicate Review Findings Twice
**Finding key:** loop-b5a29062e5eb8e366a53
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-008.md
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R1  
**Issue:** The same findings are duplicated in both `blockingFindings` and `findings`, with repeated fields such as IDs, titles, rationale, requirement, disposition, and repeat count. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Store the canonical finding records once, preferably in `findings`, and derive `blockingFindings` by filtering on `severity: "blocking"` when rendering or consuming the artifact.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R1  
**Issue:** The same findings are duplicated in both `blockingFindings` and `findings`, with repeated fields such as IDs, titles, rationale, requirement, disposition, and repeat count. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Store the canonical finding records once, preferably in `findings`, and derive `blockingFindings` by filtering on `severity: "blocking"` when rendering or consuming the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Normalize Empty PASS Attempt Artifacts
**Finding key:** loop-1b2425c1cd8f3bb5f0cd
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-008.md
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R2  
**Issue:** PASS artifacts repeat a large amount of boilerplate structure with empty arrays and zero-count summaries. The same shape appears across other attempt files, making history noisy and harder to scan.  
**Suggestion:** Introduce a compact PASS artifact format for zero-finding attempts, or omit redundant empty collections such as `blockingFindings`, `nonBlockingImprovements`, and `findings` when `summary.total` is `0`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R2  
**Issue:** PASS artifacts repeat a large amount of boilerplate structure with empty arrays and zero-count summaries. The same shape appears across other attempt files, making history noisy and harder to scan.  
**Suggestion:** Introduce a compact PASS artifact format for zero-finding attempts, or omit redundant empty collections such as `blockingFindings`, `nonBlockingImprovements`, and `findings` when `summary.total` is `0`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Consolidate Repeated Draft Coverage PASS Records
**Finding key:** loop-cdcb68551375515ee107
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-008.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R3  
**Issue:** This file is nearly identical to `draft-coverage-attempt-003.json`, differing only in `generatedAt` and `attempt`. Keeping full duplicate snapshots makes the review history verbose without adding much information.  
**Suggestion:** Store repeated PASS attempts as entries in a single phase-level history file, with per-attempt metadata containing only `attempt`, `generatedAt`, and `verdict`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R3  
**Issue:** This file is nearly identical to `draft-coverage-attempt-003.json`, differing only in `generatedAt` and `attempt`. Keeping full duplicate snapshots makes the review history verbose without adding much information.  
**Suggestion:** Store repeated PASS attempts as entries in a single phase-level history file, with per-attempt metadata containing only `attempt`, `generatedAt`, and `verdict`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Consolidate Repeated Draft Questions PASS Records
**Finding key:** loop-9ebe13dc12e2120ec3b4
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-008.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R3  
**Issue:** The draft question review attempts duplicate the same successful result structure across separate files, with only timestamp and attempt number changing.  
**Suggestion:** Use one `draft-questions-history.json` artifact containing an array of attempts, or generate these files from a shared schema/template to avoid duplicated static fields.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R3  
**Issue:** The draft question review attempts duplicate the same successful result structure across separate files, with only timestamp and attempt number changing.  
**Suggestion:** Use one `draft-questions-history.json` artifact containing an array of attempts, or generate these files from a shared schema/template to avoid duplicated static fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 5. Remove Redundant Markdown Mirrors
**Finding key:** loop-2398ff7e5b8cb5804f6a
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-008.md
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R4  
**Issue:** The Markdown file mirrors the JSON review result almost exactly. This creates two sources of truth for the same review content.  
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or clearly mark Markdown files as generated outputs and exclude them from hand-maintained history.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R4  
**Issue:** The Markdown file mirrors the JSON review result almost exactly. This creates two sources of truth for the same review content.  
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or clearly mark Markdown files as generated outputs and exclude them from hand-maintained history.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 6. Use Consistent Summary Field Naming
**Finding key:** loop-ea5ec2442b91bac89d89
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-008.md
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R5  
**Issue:** The artifact uses both `verdict` and `contractSummary.result`, plus both top-level `summary` and nested `contractSummary` fields. Some of these names overlap semantically, which makes consumers choose between equivalent-looking values.  
**Suggestion:** Standardize on one canonical outcome field, such as top-level `verdict`, and reserve `contractSummary` for fields that are genuinely contract-specific and not duplicated elsewhere.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-008.md`  
**Requirement:** R5  
**Issue:** The artifact uses both `verdict` and `contractSummary.result`, plus both top-level `summary` and nested `contractSummary` fields. Some of these names overlap semantically, which makes consumers choose between equivalent-looking values.  
**Suggestion:** Standardize on one canonical outcome field, such as top-level `verdict`, and reserve `contractSummary` for fields that are genuinely contract-specific and not duplicated elsewhere.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Avoid Storing Duplicate Review Findings Twice
**Finding key:** loop-bbad291d06085038645c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-012.md
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R1  
**Issue:** The same findings are duplicated in both `blockingFindings` and `findings`, with repeated fields such as IDs, titles, rationale, requirement, disposition, and repeat count. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Store the canonical finding records once, preferably in `findings`, and derive `blockingFindings` by filtering on `severity: "blocking"` when rendering or consuming the artifact.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R1  
**Issue:** The same findings are duplicated in both `blockingFindings` and `findings`, with repeated fields such as IDs, titles, rationale, requirement, disposition, and repeat count. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Store the canonical finding records once, preferably in `findings`, and derive `blockingFindings` by filtering on `severity: "blocking"` when rendering or consuming the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Normalize Empty PASS Attempt Artifacts
**Finding key:** loop-09e78ace95834031b7ee
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-012.md
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R2  
**Issue:** PASS artifacts repeat a large amount of boilerplate structure with empty arrays and zero-count summaries. The same shape appears across other attempt files, making history noisy and harder to scan.  
**Suggestion:** Introduce a compact PASS artifact format for zero-finding attempts, or omit redundant empty collections such as `blockingFindings`, `nonBlockingImprovements`, and `findings` when `summary.total` is `0`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R2  
**Issue:** PASS artifacts repeat a large amount of boilerplate structure with empty arrays and zero-count summaries. The same shape appears across other attempt files, making history noisy and harder to scan.  
**Suggestion:** Introduce a compact PASS artifact format for zero-finding attempts, or omit redundant empty collections such as `blockingFindings`, `nonBlockingImprovements`, and `findings` when `summary.total` is `0`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Consolidate Repeated Draft Coverage PASS Records
**Finding key:** loop-7b13e8dce078e8105166
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-012.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R3  
**Issue:** This file is nearly identical to `draft-coverage-attempt-003.json`, differing only in `generatedAt` and `attempt`. Keeping full duplicate snapshots makes the review history verbose without adding much information.  
**Suggestion:** Store repeated PASS attempts as entries in a single phase-level history file, with per-attempt metadata containing only `attempt`, `generatedAt`, and `verdict`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R3  
**Issue:** This file is nearly identical to `draft-coverage-attempt-003.json`, differing only in `generatedAt` and `attempt`. Keeping full duplicate snapshots makes the review history verbose without adding much information.  
**Suggestion:** Store repeated PASS attempts as entries in a single phase-level history file, with per-attempt metadata containing only `attempt`, `generatedAt`, and `verdict`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Consolidate Repeated Draft Questions PASS Records
**Finding key:** loop-e0bb468b24a7870421fe
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-012.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R3  
**Issue:** The draft question review attempts duplicate the same successful result structure across separate files, with only timestamp and attempt number changing.  
**Suggestion:** Use one `draft-questions-history.json` artifact containing an array of attempts, or generate these files from a shared schema/template to avoid duplicated static fields.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R3  
**Issue:** The draft question review attempts duplicate the same successful result structure across separate files, with only timestamp and attempt number changing.  
**Suggestion:** Use one `draft-questions-history.json` artifact containing an array of attempts, or generate these files from a shared schema/template to avoid duplicated static fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 5. Remove Redundant Markdown Mirrors
**Finding key:** loop-fd2b289c0b171601b54d
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-012.md
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R4  
**Issue:** The Markdown file mirrors the JSON review result almost exactly. This creates two sources of truth for the same review content.  
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or clearly mark Markdown files as generated outputs and exclude them from hand-maintained history.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R4  
**Issue:** The Markdown file mirrors the JSON review result almost exactly. This creates two sources of truth for the same review content.  
**Suggestion:** Keep the JSON as the canonical artifact and generate Markdown views on demand, or clearly mark Markdown files as generated outputs and exclude them from hand-maintained history.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 6. Use Consistent Summary Field Naming
**Finding key:** loop-2b8652dd856bc0059dd3
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-012.md
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R5  
**Issue:** The artifact uses both `verdict` and `contractSummary.result`, plus both top-level `summary` and nested `contractSummary` fields. Some of these names overlap semantically, which makes consumers choose between equivalent-looking values.  
**Suggestion:** Standardize on one canonical outcome field, such as top-level `verdict`, and reserve `contractSummary` for fields that are genuinely contract-specific and not duplicated elsewhere.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-012.md`  
**Requirement:** R5  
**Issue:** The artifact uses both `verdict` and `contractSummary.result`, plus both top-level `summary` and nested `contractSummary` fields. Some of these names overlap semantically, which makes consumers choose between equivalent-looking values.  
**Suggestion:** Standardize on one canonical outcome field, such as top-level `verdict`, and reserve `contractSummary` for fields that are genuinely contract-specific and not duplicated elsewhere.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Avoid duplicating review findings across JSON and Markdown artifacts
**Finding key:** loop-426f069de6b3138301c5
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-005.md
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-005.md`  
**Requirement:** R5  
**Issue:** The same finding content is stored in both `impl-attempt-005.json` and `impl-attempt-005.md`, duplicating title, issue, suggestion, rationale, file, and requirement data. This creates drift risk between machine-readable and human-readable review history.  
**Suggestion:** Treat the JSON artifact as canonical and generate the Markdown view from it, or keep only one representation per attempt if both formats are not required.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-005.md`  
**Requirement:** R5  
**Issue:** The same finding content is stored in both `impl-attempt-005.json` and `impl-attempt-005.md`, duplicating title, issue, suggestion, rationale, file, and requirement data. This creates drift risk between machine-readable and human-readable review history.  
**Suggestion:** Treat the JSON artifact as canonical and generate the Markdown view from it, or keep only one representation per attempt if both formats are not required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Avoid duplicating review findings across JSON and Markdown artifacts
**Finding key:** loop-25993777534c618e9541
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-006.md
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-006.md`  
**Requirement:** R4  
**Issue:** The Markdown file repeats the same finding already present in `impl-attempt-006.json`, including the issue, suggestion, rationale, and requirement metadata.  
**Suggestion:** Generate this Markdown from the JSON artifact or remove the redundant Markdown artifact if consumers can read the JSON review history directly.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-006.md`  
**Requirement:** R4  
**Issue:** The Markdown file repeats the same finding already present in `impl-attempt-006.json`, including the issue, suggestion, rationale, and requirement metadata.  
**Suggestion:** Generate this Markdown from the JSON artifact or remove the redundant Markdown artifact if consumers can read the JSON review history directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Avoid duplicating review findings across JSON and Markdown artifacts
**Finding key:** loop-b232a7ff4b95f7695def
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-007.md
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-007.md`  
**Requirement:** R5  
**Issue:** The skip-guardrail finding is duplicated between `impl-attempt-007.json` and `impl-attempt-007.md`, increasing maintenance burden and making historical records harder to validate for consistency.  
**Suggestion:** Use a single canonical review-history format, preferably JSON, and derive any human-readable Markdown reports from that source.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-007.md`  
**Requirement:** R5  
**Issue:** The skip-guardrail finding is duplicated between `impl-attempt-007.json` and `impl-attempt-007.md`, increasing maintenance burden and making historical records harder to validate for consistency.  
**Suggestion:** Use a single canonical review-history format, preferably JSON, and derive any human-readable Markdown reports from that source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 1. Remove duplicated human-readable review artifacts
**Finding key:** loop-29ac794ad74e5f58a2ca
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-009.md
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-009.md`
**Requirement:** R6
**Issue:** The `.md` review history duplicates the same finding data already stored in `impl-attempt-009.json`, including title, file, requirement, issue, suggestion, disposition, and rationale. This creates two sources of truth for the same attempt.
**Suggestion:** Keep the structured JSON artifact as the canonical history record and generate Markdown views on demand, or store only one persisted representation per attempt.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-009.md`
**Requirement:** R6
**Issue:** The `.md` review history duplicates the same finding data already stored in `impl-attempt-009.json`, including title, file, requirement, issue, suggestion, disposition, and rationale. This creates two sources of truth for the same attempt.
**Suggestion:** Keep the structured JSON artifact as the canonical history record and generate Markdown views on demand, or store only one persisted representation per attempt.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 2. Consolidate repeated rejected-attempt records
**Finding key:** loop-7c8d15a38d9d2f259206
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-010.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-010.json`
**Requirement:** R6
**Issue:** Attempts 009 and 010 contain nearly identical R6 rejection records with the same finding fingerprint and only small wording changes. Persisting full copies increases noise and makes it harder to inspect meaningful changes between attempts.
**Suggestion:** Store repeated findings once with attempt metadata, or add a compact delta/history format that references the previous finding fingerprint and records only changed fields such as `repeatCount`, `generatedAt`, and revised wording.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-010.json`
**Requirement:** R6
**Issue:** Attempts 009 and 010 contain nearly identical R6 rejection records with the same finding fingerprint and only small wording changes. Persisting full copies increases noise and makes it harder to inspect meaningful changes between attempts.
**Suggestion:** Store repeated findings once with attempt metadata, or add a compact delta/history format that references the previous finding fingerprint and records only changed fields such as `repeatCount`, `generatedAt`, and revised wording.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 3. Avoid duplicating findings within each JSON artifact
**Finding key:** loop-8bc0dcbdf3d5a293cd7a
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-013.json
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-013.json`
**Requirement:** R5
**Issue:** Each blocking finding appears twice: once under `blockingFindings` and again under `findings`, with mostly the same data but different field names such as `issue` vs `body`, `failureMode` vs `category`, and `findingKey` vs `id`.
**Suggestion:** Keep a single canonical `findings` array with a `severity` field, and derive `blockingFindings` or summary views when rendering. This removes duplicate data and avoids divergence between equivalent fields.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-013.json`
**Requirement:** R5
**Issue:** Each blocking finding appears twice: once under `blockingFindings` and again under `findings`, with mostly the same data but different field names such as `issue` vs `body`, `failureMode` vs `category`, and `findingKey` vs `id`.
**Suggestion:** Keep a single canonical `findings` array with a `severity` field, and derive `blockingFindings` or summary views when rendering. This removes duplicate data and avoids divergence between equivalent fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 4. Normalize naming between JSON fields
**Finding key:** loop-d38044adc999bc1aef41
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-011.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-011.json`
**Requirement:** R6
**Issue:** The artifact uses multiple names for the same concepts: `verdict` and `result`, `findingId` and `fingerprint`, `failureMode` and `category`, `issue` and `body`. This makes consumers harder to implement and encourages ad hoc mapping.
**Suggestion:** Standardize on one field name per concept in the stored schema, then adapt legacy names only at import/export boundaries if backward compatibility is needed.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-011.json`
**Requirement:** R6
**Issue:** The artifact uses multiple names for the same concepts: `verdict` and `result`, `findingId` and `fingerprint`, `failureMode` and `category`, `issue` and `body`. This makes consumers harder to implement and encourages ad hoc mapping.
**Suggestion:** Standardize on one field name per concept in the stored schema, then adapt legacy names only at import/export boundaries if backward compatibility is needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 1. Remove duplicated review-history artifacts
**Finding key:** loop-4946b168eebd4c1cf2f2
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-014.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-014.json`  
**Requirement:** R6  
**Issue:** The same review finding content is duplicated across JSON and Markdown files for each attempt, and multiple historical attempts are added together. This creates maintenance noise and increases the chance of stale or contradictory review history being committed.  
**Suggestion:** Keep only the canonical machine-readable artifact required by the workflow, or generate the Markdown history from JSON instead of committing both representations.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-014.json`  
**Requirement:** R6  
**Issue:** The same review finding content is duplicated across JSON and Markdown files for each attempt, and multiple historical attempts are added together. This creates maintenance noise and increases the chance of stale or contradictory review history being committed.  
**Suggestion:** Keep only the canonical machine-readable artifact required by the workflow, or generate the Markdown history from JSON instead of committing both representations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 2. Normalize inconsistent summary field names
**Finding key:** loop-10cca0de8610bb805169
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/spec-attempt-001.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/spec-attempt-001.json`  
**Requirement:** R6  
**Issue:** Spec attempt JSON uses `counts`, while implementation attempt JSON uses `summary` for the same blocking/non-blocking/total structure. This inconsistency makes downstream consumers branch on phase-specific field names for identical data.  
**Suggestion:** Use one field name consistently across review-history JSON files, preferably `summary` if that is already used by newer implementation artifacts.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/spec-attempt-001.json`  
**Requirement:** R6  
**Issue:** Spec attempt JSON uses `counts`, while implementation attempt JSON uses `summary` for the same blocking/non-blocking/total structure. This inconsistency makes downstream consumers branch on phase-specific field names for identical data.  
**Suggestion:** Use one field name consistently across review-history JSON files, preferably `summary` if that is already used by newer implementation artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 3. Avoid repeating full finding records in two arrays
**Finding key:** loop-f43a437fbb087937e21d
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-015.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-015.json`  
**Requirement:** R6  
**Issue:** Each blocking finding appears once in `blockingFindings` and again in `findings` with largely duplicated fields. This duplicates IDs, titles, rationale, requirement IDs, and fingerprints in the same file.  
**Suggestion:** Store findings once in `findings`, and derive `blockingFindings` by filtering on severity when rendering or consuming the artifact. If compatibility requires both, make `blockingFindings` contain only references such as finding IDs.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-015.json`  
**Requirement:** R6  
**Issue:** Each blocking finding appears once in `blockingFindings` and again in `findings` with largely duplicated fields. This duplicates IDs, titles, rationale, requirement IDs, and fingerprints in the same file.  
**Suggestion:** Store findings once in `findings`, and derive `blockingFindings` by filtering on severity when rendering or consuming the artifact. If compatibility requires both, make `blockingFindings` contain only references such as finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 4. Add missing trailing newline
**Finding key:** loop-c08a802591bce17c9020
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/spec-attempt-001.md
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/spec-attempt-001.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, unlike the other Markdown artifacts.  
**Suggestion:** Add a final newline to keep formatting consistent and avoid unnecessary diffs from editors or formatters.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/spec-attempt-001.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, unlike the other Markdown artifacts.  
**Suggestion:** Add a final newline to keep formatting consistent and avoid unnecessary diffs from editors or formatters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 4. Add missing trailing newline
**Finding key:** loop-790f846f66cdec9d8caf
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/spec-attempt-002.md
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/spec-attempt-002.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, unlike the other Markdown artifacts.  
**Suggestion:** Add a final newline to keep formatting consistent and avoid unnecessary diffs from editors or formatters.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/spec-attempt-002.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, unlike the other Markdown artifacts.  
**Suggestion:** Add a final newline to keep formatting consistent and avoid unnecessary diffs from editors or formatters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 4. Add missing trailing newline
**Finding key:** loop-df06b9adfe0287374d49
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec-review.md
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/spec-review.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, unlike the other Markdown artifacts.  
**Suggestion:** Add a final newline to keep formatting consistent and avoid unnecessary diffs from editors or formatters.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec-review.md`  
**Requirement:** R6  
**Issue:** The file has no trailing newline, unlike the other Markdown artifacts.  
**Suggestion:** Add a final newline to keep formatting consistent and avoid unnecessary diffs from editors or formatters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 1. Avoid duplicating findings in JSON artifacts
**Finding key:** loop-d2b235543f3318a5d30b
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/test-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with repeated IDs, titles, body/issue text, disposition, fingerprint, and rationale. This creates drift risk and makes generated history noisier than necessary.  
**Suggestion:** Keep one canonical findings array and derive `blockingFindings`/`advisoryFindings` from `severity` or `kind` when rendering/consuming the artifact.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with repeated IDs, titles, body/issue text, disposition, fingerprint, and rationale. This creates drift risk and makes generated history noisier than necessary.  
**Suggestion:** Keep one canonical findings array and derive `blockingFindings`/`advisoryFindings` from `severity` or `kind` when rendering/consuming the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 2. Normalize duplicated Markdown and JSON review content
**Finding key:** loop-1d691d8358629752b5b9
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/test-attempt-004.md
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-004.md`  
**Requirement:** R4  
**Issue:** The Markdown file repeats the same review data already present in `test-attempt-004.json`. Maintaining both checked-in representations increases duplication and can cause inconsistencies between machine-readable and human-readable history.  
**Suggestion:** Store only the JSON artifact as source of truth and generate the Markdown report on demand, or add an explicit generated-file convention so reviewers know the Markdown must not be hand-edited.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-004.md`  
**Requirement:** R4  
**Issue:** The Markdown file repeats the same review data already present in `test-attempt-004.json`. Maintaining both checked-in representations increases duplication and can cause inconsistencies between machine-readable and human-readable history.  
**Suggestion:** Store only the JSON artifact as source of truth and generate the Markdown report on demand, or add an explicit generated-file convention so reviewers know the Markdown must not be hand-edited.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 3. Add a bounded retention rule for repeated attempt artifacts
**Finding key:** loop-4e996cb7d5219038164f
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/test-attempt-005.json
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-005.json`  
**Requirement:** R5  
**Issue:** The review history pattern creates a new JSON and Markdown file per attempt with no visible cap. That can grow without bound across repeated review cycles, conflicting with the `bounded-resource-usage` guardrail.  
**Suggestion:** Add or encode a retention policy for review history, such as keeping the latest N attempts plus the final accepted attempt, or compacting older attempts into a summary artifact.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-005.json`  
**Requirement:** R5  
**Issue:** The review history pattern creates a new JSON and Markdown file per attempt with no visible cap. That can grow without bound across repeated review cycles, conflicting with the `bounded-resource-usage` guardrail.  
**Suggestion:** Add or encode a retention policy for review history, such as keeping the latest N attempts plus the final accepted attempt, or compacting older attempts into a summary artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 4. Add trailing newline to Markdown artifacts
**Finding key:** loop-3c65dd42e21fa078e896
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/test-attempt-005.md
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-005.md`
**Requirement:** R5
**Issue:** The file has no trailing newline, unlike common Markdown/text-file conventions.
**Suggestion:** Add a final newline to keep generated review artifacts consistent and avoid noisy diffs in future edits.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-005.md`
**Requirement:** R5
**Issue:** The file has no trailing newline, unlike common Markdown/text-file conventions.
**Suggestion:** Add a final newline to keep generated review artifacts consistent and avoid noisy diffs in future edits.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 1. Normalize duplicated finding data
**Finding key:** loop-aa52de31990aa8d2c3b4
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/test-attempt-006.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-006.json`
**Requirement:** R6
**Issue:** The same finding is represented twice, once in `blockingFindings` and again in `findings`, with duplicated title, fingerprint, disposition, rationale, and body content. This creates drift risk if one copy is updated.
**Suggestion:** Keep a single canonical `findings` array with severity/kind metadata, and derive `blockingFindings` from it when rendering or consuming the artifact.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-006.json`
**Requirement:** R6
**Issue:** The same finding is represented twice, once in `blockingFindings` and again in `findings`, with duplicated title, fingerprint, disposition, rationale, and body content. This creates drift risk if one copy is updated.
**Suggestion:** Keep a single canonical `findings` array with severity/kind metadata, and derive `blockingFindings` from it when rendering or consuming the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 2. Normalize duplicated finding data
**Finding key:** loop-7d83e24212b8d1a28cbb
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/test-attempt-007.json
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-007.json`
**Requirement:** R2
**Issue:** The blocking finding is duplicated across `blockingFindings` and `findings`, including repeated fingerprint, rationale, title, and issue/body text.
**Suggestion:** Store the finding once and use `severity: "blocking"` or `kind: "blocking"` as the filter source instead of maintaining two copies.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-007.json`
**Requirement:** R2
**Issue:** The blocking finding is duplicated across `blockingFindings` and `findings`, including repeated fingerprint, rationale, title, and issue/body text.
**Suggestion:** Store the finding once and use `severity: "blocking"` or `kind: "blocking"` as the filter source instead of maintaining two copies.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 3. Normalize duplicated finding data
**Finding key:** loop-d168fbc147dda02fee55
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/test-attempt-008.json
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-008.json`
**Requirement:** R5
**Issue:** The same R5 finding appears in both `blockingFindings` and `findings`, which increases maintenance overhead and can lead to inconsistent review history.
**Suggestion:** Collapse to one canonical findings list and generate any blocking-specific view from that data.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-008.json`
**Requirement:** R5
**Issue:** The same R5 finding appears in both `blockingFindings` and `findings`, which increases maintenance overhead and can lead to inconsistent review history.
**Suggestion:** Collapse to one canonical findings list and generate any blocking-specific view from that data.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 60. 1. Normalize duplicated finding data
**Finding key:** loop-020bd6ec8fe6bef5b6ed
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/test-review.md
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/test-review.md`
**Requirement:** R6
**Issue:** The same finding is represented twice, once in `blockingFindings` and again in `findings`, with duplicated title, fingerprint, disposition, rationale, and body content. This creates drift risk if one copy is updated.
**Suggestion:** Keep a single canonical `findings` array with severity/kind metadata, and derive `blockingFindings` from it when rendering or consuming the artifact.
**Suggestion:** **File:** `specs/346-gate-fail-closed/test-review.md`
**Requirement:** R6
**Issue:** The same finding is represented twice, once in `blockingFindings` and again in `findings`, with duplicated title, fingerprint, disposition, rationale, and body content. This creates drift risk if one copy is updated.
**Suggestion:** Keep a single canonical `findings` array with severity/kind metadata, and derive `blockingFindings` from it when rendering or consuming the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 61. 2. Normalize duplicated finding data
**Finding key:** loop-092b1c6cce700518a90c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/test-review.md
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/test-review.md`
**Requirement:** R2
**Issue:** The blocking finding is duplicated across `blockingFindings` and `findings`, including repeated fingerprint, rationale, title, and issue/body text.
**Suggestion:** Store the finding once and use `severity: "blocking"` or `kind: "blocking"` as the filter source instead of maintaining two copies.
**Suggestion:** **File:** `specs/346-gate-fail-closed/test-review.md`
**Requirement:** R2
**Issue:** The blocking finding is duplicated across `blockingFindings` and `findings`, including repeated fingerprint, rationale, title, and issue/body text.
**Suggestion:** Store the finding once and use `severity: "blocking"` or `kind: "blocking"` as the filter source instead of maintaining two copies.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 62. 3. Normalize duplicated finding data
**Finding key:** loop-b2d69533379f938758ab
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/test-review.md
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/test-review.md`
**Requirement:** R5
**Issue:** The same R5 finding appears in both `blockingFindings` and `findings`, which increases maintenance overhead and can lead to inconsistent review history.
**Suggestion:** Collapse to one canonical findings list and generate any blocking-specific view from that data.
**Suggestion:** **File:** `specs/346-gate-fail-closed/test-review.md`
**Requirement:** R5
**Issue:** The same R5 finding appears in both `blockingFindings` and `findings`, which increases maintenance overhead and can lead to inconsistent review history.
**Suggestion:** Collapse to one canonical findings list and generate any blocking-specific view from that data.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 63. 4. Add trailing newline to Markdown artifacts
**Finding key:** loop-0949aead6773d6cb91b8
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/test-review.md
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/test-review.md`
**Requirement:** R5
**Issue:** The file has no trailing newline, unlike common Markdown/text-file conventions.
**Suggestion:** Add a final newline to keep generated review artifacts consistent and avoid noisy diffs in future edits.
**Suggestion:** **File:** `specs/346-gate-fail-closed/test-review.md`
**Requirement:** R5
**Issue:** The file has no trailing newline, unlike common Markdown/text-file conventions.
**Suggestion:** Add a final newline to keep generated review artifacts consistent and avoid noisy diffs in future edits.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 64. 1. Remove Stale Failed Gate Artifact
**Finding key:** loop-93d8c1f8b5a4f03277db
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/spec-gate-source.json`  
**Requirement:** R1  
**Issue:** This file records a failed spec gate with `bounded-resource-usage` and other guardrail failures that appear to have been repaired in `spec.json`. Keeping the stale failure artifact alongside `spec-review.json` reporting `PASS` makes the change set internally inconsistent.  
**Suggestion:** Regenerate or remove `spec-gate-source.json` so committed gate evidence reflects the final passing spec state.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec-gate-source.json`  
**Requirement:** R1  
**Issue:** This file records a failed spec gate with `bounded-resource-usage` and other guardrail failures that appear to have been repaired in `spec.json`. Keeping the stale failure artifact alongside `spec-review.json` reporting `PASS` makes the change set internally inconsistent.  
**Suggestion:** Regenerate or remove `spec-gate-source.json` so committed gate evidence reflects the final passing spec state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 65. 2. Align Spec Status With Approval State
**Finding key:** loop-fb5f8300a4ff06e840a9
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R5  
**Issue:** The rendered markdown says `**Status**: Draft`, but the same file later says the user approved the spec, and `spec.json` has `user_approval.approved: true`.  
**Suggestion:** Regenerate `spec.md` or update the status to the approved/final state used by the spec workflow.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R5  
**Issue:** The rendered markdown says `**Status**: Draft`, but the same file later says the user approved the spec, and `spec.json` has `user_approval.approved: true`.  
**Suggestion:** Regenerate `spec.md` or update the status to the approved/final state used by the spec workflow.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 66. 3. Fix Task Status Drift
**Finding key:** loop-2b76e5e84b2ebfeed8f5
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R6  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That weakens the spec as a source of truth and can confuse downstream tooling or reviewers.  
**Suggestion:** Regenerate the spec after task completion, or mark completed tasks consistently with the requirement state.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R6  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That weakens the spec as a source of truth and can confuse downstream tooling or reviewers.  
**Suggestion:** Regenerate the spec after task completion, or mark completed tasks consistently with the requirement state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 67. 4. Avoid Committing Duplicated Gate Findings
**Finding key:** loop-ecf7fa7b289cb493a56d
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec-gate-source.json
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/spec-gate-source.json`  
**Requirement:** R2  
**Issue:** The same guardrail findings are duplicated under both `evaluations[].observations[]` and top-level `observations[]`, with repeated rationale, fingerprints, timestamps, and metadata. This creates noisy review artifacts and increases the chance of stale copies diverging.  
**Suggestion:** Prefer committing only the canonical summarized gate result, or regenerate this artifact in a compact format if the project supports one.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec-gate-source.json`  
**Requirement:** R2  
**Issue:** The same guardrail findings are duplicated under both `evaluations[].observations[]` and top-level `observations[]`, with repeated rationale, fingerprints, timestamps, and metadata. This creates noisy review artifacts and increases the chance of stale copies diverging.  
**Suggestion:** Prefer committing only the canonical summarized gate result, or regenerate this artifact in a compact format if the project supports one.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 68. 1. Extract CLI Failure Assertion Helper
**Finding key:** loop-19d1382fe2910aa2102c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 test repeats the same `assert.throws(() => execFileSync(...), error => { stdout/stderr merge; regex test })` pattern three times with only arguments and expected error code changing.  
**Suggestion:** Add a small helper such as `assertCliRejects(args, code)` inside this test file, then call it for `--skip-guardrail`, `--test-fixture required-agent-pass`, and `--test-fixture=required-agent-pass`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 test repeats the same `assert.throws(() => execFileSync(...), error => { stdout/stderr merge; regex test })` pattern three times with only arguments and expected error code changing.  
**Suggestion:** Add a small helper such as `assertCliRejects(args, code)` inside this test file, then call it for `--skip-guardrail`, `--test-fixture required-agent-pass`, and `--test-fixture=required-agent-pass`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 69. 2. Reduce Scenario Fixture Branching
**Finding key:** loop-1431bee5ae2867ecde1b
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `executeProductionGate` encodes several scenario shapes with nested conditionals across agent resolution, agent calls, guardrail loading, spawn errors, evaluation errors, malformed output, and semantic output. This makes the fixture harder to reason about as more failure modes are added.  
**Suggestion:** Normalize the scenario at the start of `executeProductionGate`, for example into `agentConfig`, `guardrailConfig`, and `configuredEvaluation`, then use focused helpers like `makeRequiredAgent(config)` and `loadRequiredGuardrails(config)` within the same file.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `executeProductionGate` encodes several scenario shapes with nested conditionals across agent resolution, agent calls, guardrail loading, spawn errors, evaluation errors, malformed output, and semantic output. This makes the fixture harder to reason about as more failure modes are added.  
**Suggestion:** Normalize the scenario at the start of `executeProductionGate`, for example into `agentConfig`, `guardrailConfig`, and `configuredEvaluation`, then use focused helpers like `makeRequiredAgent(config)` and `loadRequiredGuardrails(config)` within the same file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 70. 3. Name Test Helper By Behavior
**Finding key:** loop-290627daf559f8fc969d
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R4  
**Issue:** `executeProductionGate` is broad and slightly misleading: it does not merely execute a production gate, it creates an isolated temporary repo, writes config, injects guardrail/provider fixtures, runs the gate, and cleans up.  
**Suggestion:** Rename it to something more specific, such as `runGateInTempProjectWithRequiredEvaluation`, so call sites communicate that the helper is a fixture-backed production-route execution.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R4  
**Issue:** `executeProductionGate` is broad and slightly misleading: it does not merely execute a production gate, it creates an isolated temporary repo, writes config, injects guardrail/provider fixtures, runs the gate, and cleans up.  
**Suggestion:** Rename it to something more specific, such as `runGateInTempProjectWithRequiredEvaluation`, so call sites communicate that the helper is a fixture-backed production-route execution.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 71. 4. Remove Obsolete Failing Scenario Log
**Finding key:** loop-2b055472a7b753fe9742
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/.raw/scenario-validity.log
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/tests/.raw/scenario-validity.log`  
**Requirement:** R6  
**Issue:** This newly added raw log records an obsolete failing run where all six subtests fail because expected exported functions were undefined. The current execution evidence in `test-execution.log` shows the same test file passing, so retaining the stale failure log creates confusing review evidence.  
**Suggestion:** Remove `scenario-validity.log` unless it is consumed by a required review artifact. If historical failure evidence is needed, reference it from a structured artifact with a clear status instead of keeping an unreferenced failing raw log.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/.raw/scenario-validity.log`  
**Requirement:** R6  
**Issue:** This newly added raw log records an obsolete failing run where all six subtests fail because expected exported functions were undefined. The current execution evidence in `test-execution.log` shows the same test file passing, so retaining the stale failure log creates confusing review evidence.  
**Suggestion:** Remove `scenario-validity.log` unless it is consumed by a required review artifact. If historical failure evidence is needed, reference it from a structured artifact with a clear status instead of keeping an unreferenced failing raw log.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 72. 1. Consolidate public gate bypass validation
**Finding key:** loop-26c7726468699deca788
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `RunGateCommand.run()` checks bypass/test-fixture inputs in several places, while `parsePublicGateArguments()` separately parses raw args. This duplicates policy enforcement and makes future public-route bypass flags easier to miss.  
**Suggestion:** Move all public CLI rejection logic into one helper, e.g. `validatePublicGateInput(input)`, covering parsed input and `_rawArgs`, and have `run()` call only that helper before `super.run()`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `RunGateCommand.run()` checks bypass/test-fixture inputs in several places, while `parsePublicGateArguments()` separately parses raw args. This duplicates policy enforcement and makes future public-route bypass flags easier to miss.  
**Suggestion:** Move all public CLI rejection logic into one helper, e.g. `validatePublicGateInput(input)`, covering parsed input and `_rawArgs`, and have `run()` call only that helper before `super.run()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 73. 2. Reuse required-evaluation failure construction consistently
**Finding key:** loop-84c56afdeff1a8307ece
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `requiredGuardrailFailure()` exists, but some failure paths still construct equivalent objects inline, including agent-unset and agent evaluation/schema/output failures.  
**Suggestion:** Use `requiredGuardrailFailure()` for every blocking required-evaluation failure path, and consider extracting error classification into a small helper such as `classifyRequiredEvaluationError(error)`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `requiredGuardrailFailure()` exists, but some failure paths still construct equivalent objects inline, including agent-unset and agent evaluation/schema/output failures.  
**Suggestion:** Use `requiredGuardrailFailure()` for every blocking required-evaluation failure path, and consider extracting error classification into a small helper such as `classifyRequiredEvaluationError(error)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 74. 3. Avoid repeated option-list allocation while parsing args
**Finding key:** loop-36ed6ed83211dcc72819
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R5
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** `splitArgsBySpec()` now runs `[...optionSet].find(...)` on every argument to support `--option=value`. That repeatedly allocates an array during argument parsing.  
**Suggestion:** Precompute `const options = [...optionSet];` once before the loop and use `options.find(...)` inside the loop.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** `splitArgsBySpec()` now runs `[...optionSet].find(...)` on every argument to support `--option=value`. That repeatedly allocates an array during argument parsing.  
**Suggestion:** Precompute `const options = [...optionSet];` once before the loop and use `options.find(...)` inside the loop.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 75. 4. Remove unused registration adapter method
**Finding key:** loop-e58e547609cc506d2f94
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact.toRegistration()` is added but not used by the recovery path. It appears to be dead code and creates a second representation that can drift from the actual `ReviewEvidence` registration behavior.  
**Suggestion:** Remove `toRegistration()` unless a caller needs it now. If registration metadata is needed, use the returned artifact’s existing fields directly or add the method when there is an actual consumer.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact.toRegistration()` is added but not used by the recovery path. It appears to be dead code and creates a second representation that can drift from the actual `ReviewEvidence` registration behavior.  
**Suggestion:** Remove `toRegistration()` unless a caller needs it now. If registration metadata is needed, use the returned artifact’s existing fields directly or add the method when there is an actual consumer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 76. 5. Centralize repeated explicit target resolution metadata
**Finding key:** loop-dcb7d3fa1e9075d9dd69
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R5
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `explicitTargetResolution: true` is now declared in the registry and also repeated in constructors for `set-step`, `start-task`, and `complete-task`. This duplicates command configuration across two layers.  
**Suggestion:** Keep this concern in one place. Prefer the registry as the single source if the dispatcher already reads command metadata there, or remove the registry duplication if constructor options are authoritative.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R5  
**Issue:** `explicitTargetResolution: true` is now declared in the registry and also repeated in constructors for `set-step`, `start-task`, and `complete-task`. This duplicates command configuration across two layers.  
**Suggestion:** Keep this concern in one place. Prefer the registry as the single source if the dispatcher already reads command metadata there, or remove the registry duplication if constructor options are authoritative.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 77. 1. Standardize canonical finding storage
**Finding key:** loop-6556c8d2b7d4a4071b6a
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-001.json`
**Requirement:** R1
**Issue:** Multiple review-history JSON files duplicate the same finding records across `blockingFindings` and `findings`, sometimes with inconsistent parallel names such as `issue`/`body`, `failureMode`/`category`, and `findingKey`/`id`.
**Suggestion:** Store each finding once in a canonical `findings` array with severity/kind metadata, and derive blocking/advisory views from that array. If compatibility requires separate arrays, make them contain only finding IDs.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-001.json`
**Requirement:** R1
**Issue:** Multiple review-history JSON files duplicate the same finding records across `blockingFindings` and `findings`, sometimes with inconsistent parallel names such as `issue`/`body`, `failureMode`/`category`, and `findingKey`/`id`.
**Suggestion:** Store each finding once in a canonical `findings` array with severity/kind metadata, and derive blocking/advisory views from that array. If compatibility requires separate arrays, make them contain only finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 78. 2. Remove or generate Markdown mirrors from JSON artifacts
**Finding key:** loop-b2922bc3296079319bc0
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/impl-attempt-005.md
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-005.md`
**Requirement:** R4
**Issue:** Many `.md` review-history files duplicate the same content already present in same-attempt `.json` files, creating two sources of truth across attempts and phases.
**Suggestion:** Keep JSON as the canonical persisted artifact and generate Markdown reports on demand, or clearly mark Markdown files as generated and exclude them from hand-maintained history.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/impl-attempt-005.md`
**Requirement:** R4
**Issue:** Many `.md` review-history files duplicate the same content already present in same-attempt `.json` files, creating two sources of truth across attempts and phases.
**Suggestion:** Keep JSON as the canonical persisted artifact and generate Markdown reports on demand, or clearly mark Markdown files as generated and exclude them from hand-maintained history.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 79. 3. Normalize generated artifact field naming across phases
**Finding key:** loop-26b2255b209101bee2a3
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/spec-attempt-001.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/spec-attempt-001.json`
**Requirement:** R6
**Issue:** Review artifacts use different names for equivalent concepts across files, including `counts` vs `summary`, `verdict` vs `result`, `findingId` vs `fingerprint`, and `taskId: null` without explicit scope.
**Suggestion:** Define one shared schema for review/gate/evidence artifacts, with canonical names for outcome, counts, IDs, finding text, and scope. Keep legacy aliases only at import/export boundaries.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/spec-attempt-001.json`
**Requirement:** R6
**Issue:** Review artifacts use different names for equivalent concepts across files, including `counts` vs `summary`, `verdict` vs `result`, `findingId` vs `fingerprint`, and `taskId: null` without explicit scope.
**Suggestion:** Define one shared schema for review/gate/evidence artifacts, with canonical names for outcome, counts, IDs, finding text, and scope. Keep legacy aliases only at import/export boundaries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 80. 4. Consolidate duplicated gate and evidence observations
**Finding key:** loop-2f8521cfc009d43d219a
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec-gate-source.json
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/spec-gate-source.json`
**Requirement:** R2
**Issue:** Gate and review evidence artifacts repeatedly store identical observations or finding identifiers in multiple places, such as `evaluations[].observations` plus top-level `observations`, and `findingId` plus `fingerprint` with the same value.
**Suggestion:** Keep one canonical observation/finding identity representation, then derive nested or summary views when rendering. If both fields are required, document and validate their equality.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec-gate-source.json`
**Requirement:** R2
**Issue:** Gate and review evidence artifacts repeatedly store identical observations or finding identifiers in multiple places, such as `evaluations[].observations` plus top-level `observations`, and `findingId` plus `fingerprint` with the same value.
**Suggestion:** Keep one canonical observation/finding identity representation, then derive nested or summary views when rendering. If both fields are required, document and validate their equality.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 81. 5. Apply one formatting policy to generated JSON artifacts
**Finding key:** loop-c1b89ffe4ffc7c337cfb
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-evidence/bbaa15e638f31442eadd5655eb42aa763a04d63bba7cab0c40ba8c695c128e40.json
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/review-evidence/bbaa15e638f31442eadd5655eb42aa763a04d63bba7cab0c40ba8c695c128e40.json`
**Requirement:** R6
**Issue:** Generated JSON formatting varies across files: review-evidence files are minified, review-history files are pretty-printed, and some draft files have inconsistent comma placement.
**Suggestion:** Enforce a single formatter for all generated JSON artifacts, preferably stable pretty-printing with trailing newlines for text artifacts.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-evidence/bbaa15e638f31442eadd5655eb42aa763a04d63bba7cab0c40ba8c695c128e40.json`
**Requirement:** R6
**Issue:** Generated JSON formatting varies across files: review-evidence files are minified, review-history files are pretty-printed, and some draft files have inconsistent comma placement.
**Suggestion:** Enforce a single formatter for all generated JSON artifacts, preferably stable pretty-printing with trailing newlines for text artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 82. 6. Add retention or compaction for repeated attempt/history artifacts
**Finding key:** loop-026a8849f18dc486cef0
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/review-history/test-attempt-005.json
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-005.json`
**Requirement:** R5
**Issue:** Review history, flow history, issue logs, and evidence files introduce repeated full snapshots per attempt with no visible cap, while several entries differ only by timestamp, attempt number, or normalized finding ID.
**Suggestion:** Add bounded retention metadata and compaction rules, such as keeping latest N attempts plus the final accepted attempt, grouping repeated findings by fingerprint, and storing per-attempt deltas instead of full duplicate records.
**Suggestion:** **File:** `specs/346-gate-fail-closed/review-history/test-attempt-005.json`
**Requirement:** R5
**Issue:** Review history, flow history, issue logs, and evidence files introduce repeated full snapshots per attempt with no visible cap, while several entries differ only by timestamp, attempt number, or normalized finding ID.
**Suggestion:** Add bounded retention metadata and compaction rules, such as keeping latest N attempts plus the final accepted attempt, grouping repeated findings by fingerprint, and storing per-attempt deltas instead of full duplicate records.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
