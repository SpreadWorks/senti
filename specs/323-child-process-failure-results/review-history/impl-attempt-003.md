# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 3. Avoid Stale Generated Timestamps in Empty Artifacts
**Finding key:** loop-7a66f07fa61e0fede996
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/draft-coverage-repair.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/draft-coverage-repair.json`
**Requirement:** R6
**Issue:** The artifact contains only static empty-state data plus `generatedAt`. For an empty repair result, the timestamp creates noisy diffs without adding meaningful review value.
**Suggestion:** Omit `generatedAt` from empty no-op artifacts, or move run metadata into a shared manifest so repeated no-op phases do not create otherwise meaningless changes.
**Suggestion:** **File:** `specs/323-child-process-failure-results/draft-coverage-repair.json`
**Requirement:** R6
**Issue:** The artifact contains only static empty-state data plus `generatedAt`. For an empty repair result, the timestamp creates noisy diffs without adding meaningful review value.
**Suggestion:** Omit `generatedAt` from empty no-op artifacts, or move run metadata into a shared manifest so repeated no-op phases do not create otherwise meaningless changes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Remove Duplicated Finding Payloads
**Finding key:** loop-70ce93306bc077b3d6ad
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/draft-gate-source.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/draft-gate-source.json`
**Requirement:** R6
**Issue:** The same three guardrail failures are represented twice: once under `evaluations` and again under `observations`, with largely duplicated fields such as `reason`/`observed`, `rationale`, `guardrail_id`, `guardrailId`, `findingId`, and `fingerprint`.
**Suggestion:** Keep a single canonical collection for findings, or make one section reference the other by ID. If both views are required by consumers, generate one as a derived projection instead of storing duplicated full payloads in the artifact.
**Suggestion:** **File:** `specs/323-child-process-failure-results/draft-gate-source.json`
**Requirement:** R6
**Issue:** The same three guardrail failures are represented twice: once under `evaluations` and again under `observations`, with largely duplicated fields such as `reason`/`observed`, `rationale`, `guardrail_id`, `guardrailId`, `findingId`, and `fingerprint`.
**Suggestion:** Keep a single canonical collection for findings, or make one section reference the other by ID. If both views are required by consumers, generate one as a derived projection instead of storing duplicated full payloads in the artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Normalize Duplicate Field Names
**Finding key:** loop-03384405d4402a34b24d
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/draft-gate-source.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/draft-gate-source.json`
**Requirement:** R6
**Issue:** The file mixes snake_case and camelCase aliases for the same concepts, for example `guardrail_id` and `guardrailId`. This increases schema ambiguity and makes downstream consumers more error-prone.
**Suggestion:** Use one naming convention per field. Prefer the convention already used by the surrounding artifact schema, and remove redundant aliases unless a documented consumer requires both.
**Suggestion:** **File:** `specs/323-child-process-failure-results/draft-gate-source.json`
**Requirement:** R6
**Issue:** The file mixes snake_case and camelCase aliases for the same concepts, for example `guardrail_id` and `guardrailId`. This increases schema ambiguity and makes downstream consumers more error-prone.
**Suggestion:** Use one naming convention per field. Prefer the convention already used by the surrounding artifact schema, and remove redundant aliases unless a documented consumer requires both.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Consolidate repeated process-result contract wording
**Finding key:** loop-f1e15becd77e1f393727
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/draft.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/draft.json`  
**Requirement:** R6  
**Issue:** The same result-kind contract is repeated in several places with slightly different wording: `normally completed`, `passed`, `assertion failure`, `assertion-failure`, `spawn failure`, `spawn-error`, etc. That makes the spec easier to drift during implementation.  
**Suggestion:** Define the canonical result kinds once, for example `passed`, `assertion-failure`, `spawn-error`, `signal`, `timeout`, `max-buffer`, then reference that list consistently throughout `analysis`, `decisionMap`, and `qa`.
**Suggestion:** **File:** `specs/323-child-process-failure-results/draft.json`  
**Requirement:** R6  
**Issue:** The same result-kind contract is repeated in several places with slightly different wording: `normally completed`, `passed`, `assertion failure`, `assertion-failure`, `spawn failure`, `spawn-error`, etc. That makes the spec easier to drift during implementation.  
**Suggestion:** Define the canonical result kinds once, for example `passed`, `assertion-failure`, `spawn-error`, `signal`, `timeout`, `max-buffer`, then reference that list consistently throughout `analysis`, `decisionMap`, and `qa`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Replace vague bounded-buffer wording with explicit limits
**Finding key:** loop-45e7268ea6aed51fc693
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/draft.json
**Requirement:** R3
**Issue:** **File:** `specs/323-child-process-failure-results/draft.json`  
**Requirement:** R3  
**Issue:** The draft says stdout/stderr should use the child process API’s bounded buffer, but the limit is only explicit in the matched acknowledgment rationale, not in the draft body itself. This weakens the bounded-resource-usage guardrail traceability.  
**Suggestion:** Add the concrete limits to the relevant decision point or impact section: `tests/run.js` keeps the existing `64 MiB maxBuffer`, and `runProcessDetailed` uses `opts.maxBuffer` or the default `20 MiB`, without reconstructing or duplicating raw output beyond that bound.
**Suggestion:** **File:** `specs/323-child-process-failure-results/draft.json`  
**Requirement:** R3  
**Issue:** The draft says stdout/stderr should use the child process API’s bounded buffer, but the limit is only explicit in the matched acknowledgment rationale, not in the draft body itself. This weakens the bounded-resource-usage guardrail traceability.  
**Suggestion:** Add the concrete limits to the relevant decision point or impact section: `tests/run.js` keeps the existing `64 MiB maxBuffer`, and `runProcessDetailed` uses `opts.maxBuffer` or the default `20 MiB`, without reconstructing or duplicating raw output beyond that bound.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Remove duplicate empty review artifact shape if generation allows it
**Finding key:** loop-dd44139ff068c8a6cf7e
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/draft-review-coverage.json
**Requirement:** R5
**Issue:** **File:** `specs/323-child-process-failure-results/draft-review-coverage.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` and `draft-review-questions.json` have nearly identical empty PASS structures, differing mainly by phase and timestamp. If these are manually maintained artifacts, the duplication adds noise and creates a drift point.  
**Suggestion:** If the workflow supports it, keep only the source review artifact plus the triage result, or generate these review PASS files from a shared template so empty review metadata is not duplicated by hand.
**Suggestion:** **File:** `specs/323-child-process-failure-results/draft-review-coverage.json`  
**Requirement:** R5  
**Issue:** `draft-review-coverage.json` and `draft-review-questions.json` have nearly identical empty PASS structures, differing mainly by phase and timestamp. If these are manually maintained artifacts, the duplication adds noise and creates a drift point.  
**Suggestion:** If the workflow supports it, keep only the source review artifact plus the triage result, or generate these review PASS files from a shared template so empty review metadata is not duplicated by hand.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Deduplicate Requirement File Lists
**Finding key:** loop-a6d674fcadf9c417da64
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/file-map.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/file-map.json`
**Requirement:** R6
**Issue:** `R1`, `R2`, and `R4` repeat identical file lists, while `R6` repeats the union of several earlier lists. This creates multiple maintenance points for the same mapping.
**Suggestion:** If supported by the tooling, introduce named file groups or generate this map from a single source of truth. If not, consider adding generator support rather than hand-maintaining repeated arrays.
**Suggestion:** **File:** `specs/323-child-process-failure-results/file-map.json`
**Requirement:** R6
**Issue:** `R1`, `R2`, and `R4` repeat identical file lists, while `R6` repeats the union of several earlier lists. This creates multiple maintenance points for the same mapping.
**Suggestion:** If supported by the tooling, introduce named file groups or generate this map from a single source of truth. If not, consider adding generator support rather than hand-maintaining repeated arrays.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Normalize Inconsistent Step State
**Finding key:** loop-c3d0d1cde3e404592db7
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/flow.json`
**Requirement:** R6
**Issue:** The `impl-review` step has `status: "in_progress"` while also carrying `finishedAt`, and its `finishedAt` timestamp is earlier than `startedAt`. That creates an internally inconsistent flow state for downstream tooling.
**Suggestion:** Regenerate or repair this step so an in-progress step has no `finishedAt`, or mark it with a terminal status and monotonic `startedAt`/`finishedAt` values.
**Suggestion:** **File:** `specs/323-child-process-failure-results/flow.json`
**Requirement:** R6
**Issue:** The `impl-review` step has `status: "in_progress"` while also carrying `finishedAt`, and its `finishedAt` timestamp is earlier than `startedAt`. That creates an internally inconsistent flow state for downstream tooling.
**Suggestion:** Regenerate or repair this step so an in-progress step has no `finishedAt`, or mark it with a terminal status and monotonic `startedAt`/`finishedAt` values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Remove Volatile Runtime Telemetry From Durable Flow State
**Finding key:** loop-3d39af26811ca7eb6446
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/flow.json`
**Requirement:** R6
**Issue:** The file stores extensive runtime-only data such as token counts, command logs, attempt history, timestamps, and agent metrics. This makes the artifact large and noisy, and obscures the durable flow definition.
**Suggestion:** Split runtime telemetry into a separate generated log artifact, or omit volatile fields from committed flow state if the workflow format permits it.
**Suggestion:** **File:** `specs/323-child-process-failure-results/flow.json`
**Requirement:** R6
**Issue:** The file stores extensive runtime-only data such as token counts, command logs, attempt history, timestamps, and agent metrics. This makes the artifact large and noisy, and obscures the durable flow definition.
**Suggestion:** Split runtime telemetry into a separate generated log artifact, or omit volatile fields from committed flow state if the workflow format permits it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 4. Avoid Storing Review Proposal Text Twice
**Finding key:** loop-61a7c15c4e1b488a707d
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/impl-review.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/impl-review.json`
**Requirement:** R6
**Issue:** Each non-blocking improvement stores the same full proposal body in both `issue` and `suggestion`, with identical text repeated verbatim.
**Suggestion:** Keep one canonical structured proposal body, or split the fields by purpose so `issue` contains only the issue description and `suggestion` contains only the suggested change.
**Suggestion:** **File:** `specs/323-child-process-failure-results/impl-review.json`
**Requirement:** R6
**Issue:** Each non-blocking improvement stores the same full proposal body in both `issue` and `suggestion`, with identical text repeated verbatim.
**Suggestion:** Keep one canonical structured proposal body, or split the fields by purpose so `issue` contains only the issue description and `suggestion` contains only the suggested change.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 6. Bound Persisted Review History Growth
**Finding key:** loop-70df0de6c1f84cdeeaef
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/impl-review.json
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/impl-review.json`
**Requirement:** R1
**Issue:** The artifact persists 45 full non-blocking improvements inline, including repeated full proposal bodies. The matched bounded-resource rationale covers child-process buffers, but this review artifact itself has no visible count or size bound.
**Suggestion:** Persist only a bounded number of improvements per run, or enforce a maximum serialized size with truncation metadata for oversized review output.
**Suggestion:** **File:** `specs/323-child-process-failure-results/impl-review.json`
**Requirement:** R1
**Issue:** The artifact persists 45 full non-blocking improvements inline, including repeated full proposal bodies. The matched bounded-resource rationale covers child-process buffers, but this review artifact itself has no visible count or size bound.
**Suggestion:** Persist only a bounded number of improvements per run, or enforce a maximum serialized size with truncation metadata for oversized review output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 5. Consolidate Repeated Issue Log Failure Text
**Finding key:** loop-fe36487aec5551fc6e8b
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/issue-log.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/issue-log.json`
**Requirement:** R6
**Issue:** Several entries duplicate the same failure details across `reason`, `observations[].observed`, and `failedEvaluations[].reason`. This inflates the artifact and creates drift risk between equivalent fields.
**Suggestion:** Store findings once in a canonical list and have summary fields reference finding IDs, or generate `reason` as a derived summary from `observations`.
**Suggestion:** **File:** `specs/323-child-process-failure-results/issue-log.json`
**Requirement:** R6
**Issue:** Several entries duplicate the same failure details across `reason`, `observations[].observed`, and `failedEvaluations[].reason`. This inflates the artifact and creates drift risk between equivalent fields.
**Suggestion:** Store findings once in a canonical list and have summary fields reference finding IDs, or generate `reason` as a derived summary from `observations`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Use distinct finding identifiers per finding
**Finding key:** loop-c1cf5e60a150904f2062
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/test-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id` even though they describe different issues. This makes downstream tracking ambiguous and can collapse two findings into one when deduplicating by fingerprint.  
**Suggestion:** Generate or assign a unique `findingId`/`fingerprint`/`id` for each distinct finding, matching the pattern already used in `test-attempt-002.json`.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** Both blocking findings use the same `findingId`, `fingerprint`, and `id` even though they describe different issues. This makes downstream tracking ambiguous and can collapse two findings into one when deduplicating by fingerprint.  
**Suggestion:** Generate or assign a unique `findingId`/`fingerprint`/`id` for each distinct finding, matching the pattern already used in `test-attempt-002.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Normalize newline termination in markdown artifacts
**Finding key:** loop-065dcdbdba0c673ec05e
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/test-attempt-001.md
**Requirement:** R4
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/test-attempt-001.md`  
**Requirement:** R4  
**Issue:** The file has no trailing newline. This is minor, but it creates avoidable formatting churn and is inconsistent with common markdown/text-file conventions.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/test-attempt-001.md`  
**Requirement:** R4  
**Issue:** The file has no trailing newline. This is minor, but it creates avoidable formatting churn and is inconsistent with common markdown/text-file conventions.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Normalize newline termination in markdown artifacts
**Finding key:** loop-1ecefebae084fd608387
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/test-attempt-002.md
**Requirement:** R4
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/test-attempt-002.md`  
**Requirement:** R4  
**Issue:** The file has no trailing newline, matching the same formatting inconsistency as the previous attempt artifact.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/test-attempt-002.md`  
**Requirement:** R4  
**Issue:** The file has no trailing newline, matching the same formatting inconsistency as the previous attempt artifact.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 4. Consolidate repeated advisory finding fields
**Finding key:** loop-341cce2afa394f15a03d
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/test-attempt-003.json
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/test-attempt-003.json`  
**Requirement:** R1  
**Issue:** The same advisory finding is represented in both `advisoryFindings` and `findings`, with repeated identifiers, title, fingerprint, disposition, and rationale/body text.  
**Suggestion:** Keep one canonical findings array and derive phase-specific views such as advisory/blocking summaries from severity or kind.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/test-attempt-003.json`  
**Requirement:** R1  
**Issue:** The same advisory finding is represented in both `advisoryFindings` and `findings`, with repeated identifiers, title, fingerprint, disposition, and rationale/body text.  
**Suggestion:** Keep one canonical findings array and derive phase-specific views such as advisory/blocking summaries from severity or kind.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Remove duplicated work-unit identity fields
**Finding key:** loop-26ea32b3e463a5439619
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R6  
**Issue:** Several fields are stored both at the root and inside `identity`, including `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`. This duplicates the same metadata and creates drift risk.  
**Suggestion:** Keep canonical execution metadata in one location. If `identity` is meant to be the stable identity payload, root fields should reference it or omit duplicated values.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R6  
**Issue:** Several fields are stored both at the root and inside `identity`, including `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`. This duplicates the same metadata and creates drift risk.  
**Suggestion:** Keep canonical execution metadata in one location. If `identity` is meant to be the stable identity payload, root fields should reference it or omit duplicated values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Remove duplicated work-unit identity fields
**Finding key:** loop-f820e6911a8fcf369007
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R6  
**Issue:** The file repeats the same metadata at the root and under `identity`, mirroring `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`.  
**Suggestion:** Normalize the artifact shape so this metadata is stored once, with any alternate view generated by consumers when needed.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R6  
**Issue:** The file repeats the same metadata at the root and under `identity`, mirroring `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`.  
**Suggestion:** Normalize the artifact shape so this metadata is stored once, with any alternate view generated by consumers when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Avoid storing raw and parsed proposal payloads together
**Finding key:** loop-08885c1c343a3469b208
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R6  
**Issue:** `rawResponse` contains the full proposal text, while `success.proposals` stores the parsed version of the same content. This duplicates review data and increases artifact size/noise.  
**Suggestion:** Store the parsed `success.proposals` as canonical data and omit `rawResponse`, or keep `rawResponse` only for failed parses/debug artifacts.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R6  
**Issue:** `rawResponse` contains the full proposal text, while `success.proposals` stores the parsed version of the same content. This duplicates review data and increases artifact size/noise.  
**Suggestion:** Store the parsed `success.proposals` as canonical data and omit `rawResponse`, or keep `rawResponse` only for failed parses/debug artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Remove duplicated work-unit identity fields
**Finding key:** loop-a5c7af454239536600d1
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/test-review.md
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/test-review.md`  
**Requirement:** R6  
**Issue:** Several fields are stored both at the root and inside `identity`, including `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`. This duplicates the same metadata and creates drift risk.  
**Suggestion:** Keep canonical execution metadata in one location. If `identity` is meant to be the stable identity payload, root fields should reference it or omit duplicated values.
**Suggestion:** **File:** `specs/323-child-process-failure-results/test-review.md`  
**Requirement:** R6  
**Issue:** Several fields are stored both at the root and inside `identity`, including `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`. This duplicates the same metadata and creates drift risk.  
**Suggestion:** Keep canonical execution metadata in one location. If `identity` is meant to be the stable identity payload, root fields should reference it or omit duplicated values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Remove duplicated work-unit identity fields
**Finding key:** loop-fee7c4e9617a1e0afd9c
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/test-review.md
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/test-review.md`  
**Requirement:** R6  
**Issue:** The file repeats the same metadata at the root and under `identity`, mirroring `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`.  
**Suggestion:** Normalize the artifact shape so this metadata is stored once, with any alternate view generated by consumers when needed.
**Suggestion:** **File:** `specs/323-child-process-failure-results/test-review.md`  
**Requirement:** R6  
**Issue:** The file repeats the same metadata at the root and under `identity`, mirroring `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`.  
**Suggestion:** Normalize the artifact shape so this metadata is stored once, with any alternate view generated by consumers when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Avoid storing raw and parsed proposal payloads together
**Finding key:** loop-69a39288ef3f2de33caa
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/test-review.md
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/test-review.md`  
**Requirement:** R6  
**Issue:** `rawResponse` contains the full proposal text, while `success.proposals` stores the parsed version of the same content. This duplicates review data and increases artifact size/noise.  
**Suggestion:** Store the parsed `success.proposals` as canonical data and omit `rawResponse`, or keep `rawResponse` only for failed parses/debug artifacts.
**Suggestion:** **File:** `specs/323-child-process-failure-results/test-review.md`  
**Requirement:** R6  
**Issue:** `rawResponse` contains the full proposal text, while `success.proposals` stores the parsed version of the same content. This duplicates review data and increases artifact size/noise.  
**Suggestion:** Store the parsed `success.proposals` as canonical data and omit `rawResponse`, or keep `rawResponse` only for failed parses/debug artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 4. Consolidate repeated advisory finding fields
**Finding key:** loop-2695cae999fbe9f64cd1
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/test-review.md
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/test-review.md`  
**Requirement:** R1  
**Issue:** The same advisory finding is represented in both `advisoryFindings` and `findings`, with repeated identifiers, title, fingerprint, disposition, and rationale/body text.  
**Suggestion:** Keep one canonical findings array and derive phase-specific views such as advisory/blocking summaries from severity or kind.
**Suggestion:** **File:** `specs/323-child-process-failure-results/test-review.md`  
**Requirement:** R1  
**Issue:** The same advisory finding is represented in both `advisoryFindings` and `findings`, with repeated identifiers, title, fingerprint, disposition, and rationale/body text.  
**Suggestion:** Keep one canonical findings array and derive phase-specific views such as advisory/blocking summaries from severity or kind.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Remove Out-Of-Scope Proposal References
**Finding key:** loop-320ef2eb48319de02140
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json`
**Requirement:** R6
**Issue:** The stored `rawResponse` and `success.proposals` entries reference files that are not part of the provided diff, such as `spec-gate-source.json`, `impl-review.json`, and `spec.md`. This violates the mandatory scope constraint embedded in the review prompt and preserves invalid provider output as a successful artifact.
**Suggestion:** Mark this work unit as failed/invalid, or regenerate it with validation that rejects proposals whose `file`/`**File:**` target is not one of the touched files in the current diff.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json`
**Requirement:** R6
**Issue:** The stored `rawResponse` and `success.proposals` entries reference files that are not part of the provided diff, such as `spec-gate-source.json`, `impl-review.json`, and `spec.md`. This violates the mandatory scope constraint embedded in the review prompt and preserves invalid provider output as a successful artifact.
**Suggestion:** Mark this work unit as failed/invalid, or regenerate it with validation that rejects proposals whose `file`/`**File:**` target is not one of the touched files in the current diff.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 5. Deduplicate Repeated Work-Unit Metadata
**Finding key:** loop-aa70356b5c53e238d4f2
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json
**Requirement:** R5
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json`
**Requirement:** R5
**Issue:** The file repeats the same metadata in both `identity` and top-level fields: `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`. This creates drift risk inside a single artifact.
**Suggestion:** Keep immutable identity fields under `identity`, and store only execution/result fields at the top level. If top-level duplication is required for indexing, generate it from `identity` and validate equality before writing.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json`
**Requirement:** R5
**Issue:** The file repeats the same metadata in both `identity` and top-level fields: `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`. This creates drift risk inside a single artifact.
**Suggestion:** Keep immutable identity fields under `identity`, and store only execution/result fields at the top level. If top-level duplication is required for indexing, generate it from `identity` and validate equality before writing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Remove Out-Of-Scope Proposal References
**Finding key:** loop-160e5e48199b36a5378f
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`
**Requirement:** R6
**Issue:** The successful proposal payload references `draft.json`, `draft-review-coverage.json`, and other files outside the diff. Since the diff only adds this JSON work-unit file, the recorded proposals do not satisfy the review contract.
**Suggestion:** Regenerate this work unit against the actual touched-file set, or store an invalid status with an error explaining that the provider output failed scope validation.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`
**Requirement:** R6
**Issue:** The successful proposal payload references `draft.json`, `draft-review-coverage.json`, and other files outside the diff. Since the diff only adds this JSON work-unit file, the recorded proposals do not satisfy the review contract.
**Suggestion:** Regenerate this work unit against the actual touched-file set, or store an invalid status with an error explaining that the provider output failed scope validation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 3. Remove Out-Of-Scope Proposal References
**Finding key:** loop-0665e859d0862e21d76b
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/8dd631de9065ac75b1dfdc57.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/8dd631de9065ac75b1dfdc57.json`
**Requirement:** R6
**Issue:** The proposals target test and fixture files that are not present in the diff. The artifact records `status: "success"` even though the provider output violates the mandatory scope rule.
**Suggestion:** Add post-processing validation before writing successful work-unit artifacts: every proposal `file` and markdown `**File:**` line must match a touched file from the actual diff.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/8dd631de9065ac75b1dfdc57.json`
**Requirement:** R6
**Issue:** The proposals target test and fixture files that are not present in the diff. The artifact records `status: "success"` even though the provider output violates the mandatory scope rule.
**Suggestion:** Add post-processing validation before writing successful work-unit artifacts: every proposal `file` and markdown `**File:**` line must match a touched file from the actual diff.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 4. Remove Out-Of-Scope Proposal References
**Finding key:** loop-ca8c213fb011963aca00
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/8ff62bd023cdfcaf5e4dab92.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/8ff62bd023cdfcaf5e4dab92.json`
**Requirement:** R6
**Issue:** Like the other generated work units, this file stores successful proposals for files outside the diff, including `flow.json`, `spec.md`, and `scenario-validity-result.json`. This creates misleading review history and makes downstream aggregation unreliable.
**Suggestion:** Treat scope validation failure as a failed attempt, not a successful proposal set. Either regenerate with the correct touched-file scope or replace the proposal list with no valid proposals.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/8ff62bd023cdfcaf5e4dab92.json`
**Requirement:** R6
**Issue:** Like the other generated work units, this file stores successful proposals for files outside the diff, including `flow.json`, `spec.md`, and `scenario-validity-result.json`. This creates misleading review history and makes downstream aggregation unreliable.
**Suggestion:** Treat scope validation failure as a failed attempt, not a successful proposal set. Either regenerate with the correct touched-file scope or replace the proposal list with no valid proposals.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 6. Deduplicate Repeated Work-Unit Metadata
**Finding key:** loop-5fdb9753a7c9feeddad5
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/8ff62bd023cdfcaf5e4dab92.json
**Requirement:** R5
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/8ff62bd023cdfcaf5e4dab92.json`
**Requirement:** R5
**Issue:** This file has the same duplicated `identity` versus top-level metadata shape as the other work units. The duplication is especially risky because these generated artifacts are later used as review evidence.
**Suggestion:** Normalize the work-unit schema so duplicated fields are represented once, or replace duplicate top-level fields with a compact index object derived from `identity`.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/8ff62bd023cdfcaf5e4dab92.json`
**Requirement:** R5
**Issue:** This file has the same duplicated `identity` versus top-level metadata shape as the other work units. The duplication is especially risky because these generated artifacts are later used as review evidence.
**Suggestion:** Normalize the work-unit schema so duplicated fields are represented once, or replace duplicate top-level fields with a compact index object derived from `identity`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Deduplicate Work-Unit Identity Metadata
**Finding key:** loop-ada19e043b125243bac2
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/bd3798396b2128f722503801.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R6  
**Issue:** The same metadata appears both under `identity` and at the top level: `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`. The same pattern is repeated across the added work-unit artifacts, making the files noisy and allowing drift between two representations.  
**Suggestion:** Keep these fields in one canonical location, preferably `identity`, and have readers derive any top-level indexing/display values from that object.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R6  
**Issue:** The same metadata appears both under `identity` and at the top level: `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`. The same pattern is repeated across the added work-unit artifacts, making the files noisy and allowing drift between two representations.  
**Suggestion:** Keep these fields in one canonical location, preferably `identity`, and have readers derive any top-level indexing/display values from that object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Normalize Empty Proposal Results
**Finding key:** loop-5171ad7cfeca9fed5821
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R6  
**Issue:** The artifact stores a verbose `rawResponse` containing proposals, but the parsed result is `success.proposals: []`. This creates an inconsistent representation: the raw response says proposals exist, while the structured result says none exist.  
**Suggestion:** Treat parsed structured output as authoritative. If parsing rejects all proposals because they target files outside the current diff, store an explicit bounded diagnostic field such as `discardedProposalCount` or `parseWarnings`, instead of leaving contradictory raw and structured states.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R6  
**Issue:** The artifact stores a verbose `rawResponse` containing proposals, but the parsed result is `success.proposals: []`. This creates an inconsistent representation: the raw response says proposals exist, while the structured result says none exist.  
**Suggestion:** Treat parsed structured output as authoritative. If parsing rejects all proposals because they target files outside the current diff, store an explicit bounded diagnostic field such as `discardedProposalCount` or `parseWarnings`, instead of leaving contradictory raw and structured states.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Avoid Storing Successful Provider Output Twice
**Finding key:** loop-eb227a8202184deb5622
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R1  
**Issue:** `rawResponse` stores the full markdown response, while `success.proposals[].body` stores parsed copies of the same proposal text. This duplicates potentially large model output and weakens the bounded-resource posture for persisted artifacts.  
**Suggestion:** After successful parsing, persist `success.proposals` as the canonical structured form and either omit `rawResponse` or replace it with bounded debug metadata such as a checksum, byte count, and truncation flag.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R1  
**Issue:** `rawResponse` stores the full markdown response, while `success.proposals[].body` stores parsed copies of the same proposal text. This duplicates potentially large model output and weakens the bounded-resource posture for persisted artifacts.  
**Suggestion:** After successful parsing, persist `success.proposals` as the canonical structured form and either omit `rawResponse` or replace it with bounded debug metadata such as a checksum, byte count, and truncation flag.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Remove Presentation Numbering From Structured Titles
**Finding key:** loop-e8f417d7b13fc1c1a032
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/d85e17476af5711ba3ad8791.json
**Requirement:** R4
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/d85e17476af5711ba3ad8791.json`  
**Requirement:** R4  
**Issue:** `success.proposals[].title` includes numeric prefixes such as `"1. Deduplicate repeated test command evidence"`. That embeds markdown/list presentation into structured data and can produce stale numbering if proposals are filtered, merged, or reordered.  
**Suggestion:** Store titles without list numbers, and let the markdown renderer add numbering when producing `rawResponse` or display output.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/d85e17476af5711ba3ad8791.json`  
**Requirement:** R4  
**Issue:** `success.proposals[].title` includes numeric prefixes such as `"1. Deduplicate repeated test command evidence"`. That embeds markdown/list presentation into structured data and can produce stale numbering if proposals are filtered, merged, or reordered.  
**Suggestion:** Store titles without list numbers, and let the markdown renderer add numbering when producing `rawResponse` or display output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Remove Duplicated Finding Payloads
**Finding key:** loop-510b2986a0763ad700a8
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/spec-gate-source.json`  
**Requirement:** R1  
**Issue:** The same guardrail failures are stored under both `evaluations` and top-level `observations`, with duplicated reason/rationale/location/guardrail metadata. This creates two sources of truth and drift risk.  
**Suggestion:** Keep one canonical findings collection. If both views are needed, make one contain references to the canonical finding IDs or derive it during rendering.
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec-gate-source.json`  
**Requirement:** R1  
**Issue:** The same guardrail failures are stored under both `evaluations` and top-level `observations`, with duplicated reason/rationale/location/guardrail metadata. This creates two sources of truth and drift risk.  
**Suggestion:** Keep one canonical findings collection. If both views are needed, make one contain references to the canonical finding IDs or derive it during rendering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Use Unique Finding IDs Per Distinct Failure
**Finding key:** loop-642ca28a1414edefd800
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/spec-gate-source.json`  
**Requirement:** R1  
**Issue:** The two `migration-parity` evaluation entries share the same `findingId` and `fingerprint` even though they describe different failures. The same issue appears in top-level `observations`, where two distinct migration findings also share one ID/fingerprint.  
**Suggestion:** Generate a unique `findingId` and `fingerprint` for each distinct finding, or merge truly identical observations into one finding with multiple locations.
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec-gate-source.json`  
**Requirement:** R1  
**Issue:** The two `migration-parity` evaluation entries share the same `findingId` and `fingerprint` even though they describe different failures. The same issue appears in top-level `observations`, where two distinct migration findings also share one ID/fingerprint.  
**Suggestion:** Generate a unique `findingId` and `fingerprint` for each distinct finding, or merge truly identical observations into one finding with multiple locations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Normalize Guardrail Field Naming
**Finding key:** loop-60ed07c6c1749e385201
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec-gate-source.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/spec-gate-source.json`  
**Requirement:** R6  
**Issue:** The artifact stores both `guardrail_id` and `guardrailId` for the same concept. This mixes snake_case and camelCase aliases and makes the schema harder to consume consistently.  
**Suggestion:** Pick the artifact’s canonical naming convention and remove the duplicate alias, or document and generate compatibility aliases in one dedicated compatibility layer.
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec-gate-source.json`  
**Requirement:** R6  
**Issue:** The artifact stores both `guardrail_id` and `guardrailId` for the same concept. This mixes snake_case and camelCase aliases and makes the schema harder to consume consistently.  
**Suggestion:** Pick the artifact’s canonical naming convention and remove the duplicate alias, or document and generate compatibility aliases in one dedicated compatibility layer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Consolidate Repeated Evidence Metadata
**Finding key:** loop-cf9fe89fcc2fb1116bbf
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/scenario-validity-result.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/scenario-validity-result.json`  
**Requirement:** R6  
**Issue:** Every `summary[].evidence` repeats the same `command` and identical `raw_output_lines`, while the command is already present at the top level.  
**Suggestion:** Keep shared execution metadata at the top level, and limit each requirement’s evidence to the differing fields such as `test_file` and `test_name`.
**Suggestion:** **File:** `specs/323-child-process-failure-results/scenario-validity-result.json`  
**Requirement:** R6  
**Issue:** Every `summary[].evidence` repeats the same `command` and identical `raw_output_lines`, while the command is already present at the top level.  
**Suggestion:** Keep shared execution metadata at the top level, and limit each requirement’s evidence to the differing fields such as `test_file` and `test_name`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 5. Avoid Conflicting Review State Artifacts
**Finding key:** loop-64c2c0f695b270a10ccd
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec-review.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/spec-review.json`  
**Requirement:** R6  
**Issue:** `spec-review.json` reports `PASS`, while `spec-gate-source.json` for the same `phase: "spec"` reports `fail` with blocking guardrail findings. Keeping both artifacts creates ambiguous review state.  
**Suggestion:** Regenerate `spec-review.json` from the gate result, or store a clear lifecycle distinction so consumers know whether `spec-review.json` is pre-gate input, stale output, or superseded.
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec-review.json`  
**Requirement:** R6  
**Issue:** `spec-review.json` reports `PASS`, while `spec-gate-source.json` for the same `phase: "spec"` reports `fail` with blocking guardrail findings. Keeping both artifacts creates ambiguous review state.  
**Suggestion:** Regenerate `spec-review.json` from the gate result, or store a clear lifecycle distinction so consumers know whether `spec-review.json` is pre-gate input, stale output, or superseded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Normalize Task Status With Approved Requirements
**Finding key:** loop-b8dda5b03b817e4ab430
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/spec.json`  
**Requirement:** R6  
**Issue:** All requirements are marked `"status": "done"`, but both tasks remain `"status": "pending"`. If tasks represent the implementation work needed to satisfy those requirements, this naming/state mismatch is confusing.  
**Suggestion:** Either mark the tasks complete when the corresponding requirements are done, or rename/use a clearer task status model that distinguishes “planned task” from “implementation complete.”
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec.json`  
**Requirement:** R6  
**Issue:** All requirements are marked `"status": "done"`, but both tasks remain `"status": "pending"`. If tasks represent the implementation work needed to satisfy those requirements, this naming/state mismatch is confusing.  
**Suggestion:** Either mark the tasks complete when the corresponding requirements are done, or rename/use a clearer task status model that distinguishes “planned task” from “implementation complete.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Avoid Repeating Long Product File Boundaries
**Finding key:** loop-e313102c4fc33ccd429b
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec.json
**Requirement:** R4
**Issue:** **File:** `specs/323-child-process-failure-results/spec.json`  
**Requirement:** R4  
**Issue:** The same product-file boundary appears in multiple places: constraints, scope/out-of-scope, implementation targets, task notes, and alternatives. This is useful once, but repeated phrasing increases maintenance overhead if the allowed file set changes.  
**Suggestion:** Keep the authoritative boundary in `scope`/`constraints`, and make task implementation notes refer to that boundary instead of restating specific excluded files.
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec.json`  
**Requirement:** R4  
**Issue:** The same product-file boundary appears in multiple places: constraints, scope/out-of-scope, implementation targets, task notes, and alternatives. This is useful once, but repeated phrasing increases maintenance overhead if the allowed file set changes.  
**Suggestion:** Keep the authoritative boundary in `scope`/`constraints`, and make task implementation notes refer to that boundary instead of restating specific excluded files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 1. Align Approved Spec Status
**Finding key:** loop-d6102e9ae1d6b8f9db37
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec.md
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/spec.md`  
**Requirement:** R6  
**Issue:** The spec shows `**Status**: Draft` while the same file later says the user approved the spec, and `spec.json` has `"approved": true`. This creates inconsistent lifecycle state in generated documentation.  
**Suggestion:** Change the rendered status to an approved/finalized state, or adjust the generator/source field so `spec.md` reflects the approval state consistently.
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec.md`  
**Requirement:** R6  
**Issue:** The spec shows `**Status**: Draft` while the same file later says the user approved the spec, and `spec.json` has `"approved": true`. This creates inconsistent lifecycle state in generated documentation.  
**Suggestion:** Change the rendered status to an approved/finalized state, or adjust the generator/source field so `spec.md` reflects the approval state consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Remove Manual Duplication Risk Between Rendered Spec Files
**Finding key:** loop-655e775e81bc9eaafedc
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec.md
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/spec.md`  
**Requirement:** R6  
**Issue:** `spec.md` duplicates most of `spec.json` content, including requirements, acceptance criteria, constraints, tasks, and approval metadata. Because the task files already state they are generated, this duplication is expected, but it creates review noise and drift risk unless `spec.md` is clearly treated as generated output.  
**Suggestion:** Add a top-level generated-file notice to `spec.md`, similar to the task files, indicating it is rendered from `spec.json` and should not be edited manually.
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec.md`  
**Requirement:** R6  
**Issue:** `spec.md` duplicates most of `spec.json` content, including requirements, acceptance criteria, constraints, tasks, and approval metadata. Because the task files already state they are generated, this duplication is expected, but it creates review noise and drift risk unless `spec.md` is clearly treated as generated output.  
**Suggestion:** Add a top-level generated-file notice to `spec.md`, similar to the task files, indicating it is rendered from `spec.json` and should not be edited manually.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 1. Deduplicate Repeated Test Command Evidence
**Finding key:** loop-a90a90ce1d48e5016e63
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/test-execute-result.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/test-execute-result.json`  
**Requirement:** R6  
**Issue:** The same long `command` string is repeated for every requirement summary entry, making the artifact noisy and more error-prone if the command changes.  
**Suggestion:** Move the shared command to a top-level field such as `execution_command`, then let each evidence entry omit it or reference it by key. Keep per-entry fields focused on requirement-specific evidence like `test_file`, `test_name`, and `raw_output_lines`.
**Suggestion:** **File:** `specs/323-child-process-failure-results/test-execute-result.json`  
**Requirement:** R6  
**Issue:** The same long `command` string is repeated for every requirement summary entry, making the artifact noisy and more error-prone if the command changes.  
**Suggestion:** Move the shared command to a top-level field such as `execution_command`, then let each evidence entry omit it or reference it by key. Keep per-entry fields focused on requirement-specific evidence like `test_file`, `test_name`, and `raw_output_lines`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 2. Deduplicate Repeated Raw Output Ranges
**Finding key:** loop-f47ed8a692ac29238c66
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/test-execute-result.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/test-execute-result.json`  
**Requirement:** R6  
**Issue:** Every summary entry repeats the same `raw_output_lines` range `{ "start_line": 1, "end_line": 137 }`, which adds duplication without adding per-requirement signal.  
**Suggestion:** Store the shared raw output range once at the execution level, and only include an entry-level range when a requirement has a distinct evidence span.
**Suggestion:** **File:** `specs/323-child-process-failure-results/test-execute-result.json`  
**Requirement:** R6  
**Issue:** Every summary entry repeats the same `raw_output_lines` range `{ "start_line": 1, "end_line": 137 }`, which adds duplication without adding per-requirement signal.  
**Suggestion:** Store the shared raw output range once at the execution level, and only include an entry-level range when a requirement has a distinct evidence span.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 1. Remove stale failing raw log
**Finding key:** loop-f32600b9632099d3af4a
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/tests/.raw/scenario-validity.log
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/tests/.raw/scenario-validity.log`  
**Requirement:** R6  
**Issue:** This new artifact records an earlier scenario-validity run where all spec-local tests failed due to missing exports, while `test-execution.log` records the final passing run. Keeping both as committed evidence is confusing and makes the change set look internally inconsistent.  
**Suggestion:** Delete this stale raw log, or regenerate it after the implementation is complete so it reflects the same passing behavior as the final test execution artifact.
**Suggestion:** **File:** `specs/323-child-process-failure-results/tests/.raw/scenario-validity.log`  
**Requirement:** R6  
**Issue:** This new artifact records an earlier scenario-validity run where all spec-local tests failed due to missing exports, while `test-execution.log` records the final passing run. Keeping both as committed evidence is confusing and makes the change set look internally inconsistent.  
**Suggestion:** Delete this stale raw log, or regenerate it after the implementation is complete so it reflects the same passing behavior as the final test execution artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 2. Extract repeated result assertions
**Finding key:** loop-d6f3e041689759fd0ce9
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/tests/child-process-result.test.js
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/tests/child-process-result.test.js`  
**Requirement:** R1  
**Issue:** Several tests repeat the same `kind`, `started`, `completed`, `exitCode`, `errorCode`, `signal`, and `timedOut` assertions. This makes the tests longer and increases the chance of inconsistent expectations across result kinds.  
**Suggestion:** Add a small helper such as `assertResultFields(result, expected)` that loops over expected fields and compares them. Use it for ENOENT, max-buffer, signal, timeout, assertion-failure, and passed cases.
**Suggestion:** **File:** `specs/323-child-process-failure-results/tests/child-process-result.test.js`  
**Requirement:** R1  
**Issue:** Several tests repeat the same `kind`, `started`, `completed`, `exitCode`, `errorCode`, `signal`, and `timedOut` assertions. This makes the tests longer and increases the chance of inconsistent expectations across result kinds.  
**Suggestion:** Add a small helper such as `assertResultFields(result, expected)` that loops over expected fields and compares them. Use it for ENOENT, max-buffer, signal, timeout, assertion-failure, and passed cases.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 3. Avoid duplicating fixture executions
**Finding key:** loop-f508196619e4b72a7f20
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/tests/child-process-result.test.js
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/tests/child-process-result.test.js`  
**Requirement:** R6  
**Issue:** The same child-process scenarios are executed in multiple tests, especially `signal`, `timeout`, `max-buffer`, `assertion-failure`, and `passed`. These tests spawn real processes, so duplication increases runtime and creates more places where timeout-sensitive behavior can flake.  
**Suggestion:** Consolidate the “classification” and “processOutputLines metadata” checks into a single table-driven test that runs each scenario once and verifies both the result fields and diagnostic output.
**Suggestion:** **File:** `specs/323-child-process-failure-results/tests/child-process-result.test.js`  
**Requirement:** R6  
**Issue:** The same child-process scenarios are executed in multiple tests, especially `signal`, `timeout`, `max-buffer`, `assertion-failure`, and `passed`. These tests spawn real processes, so duplication increases runtime and creates more places where timeout-sensitive behavior can flake.  
**Suggestion:** Consolidate the “classification” and “processOutputLines metadata” checks into a single table-driven test that runs each scenario once and verifies both the result fields and diagnostic output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 4. Replace magic max-buffer values with a named constant
**Finding key:** loop-1500026c6c6e843c2d8b
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/tests/child-process-result.test.js
**Requirement:** R4
**Issue:** **File:** `specs/323-child-process-failure-results/tests/child-process-result.test.js`  
**Requirement:** R4  
**Issue:** The value `128` is repeated for max-buffer scenarios and stdout setup. Its role as an intentionally small buffer limit is not immediately clear from each call site.  
**Suggestion:** Introduce a constant like `const SMALL_MAX_BUFFER = 128;` and use it in the max-buffer tests and fixture result setup.
**Suggestion:** **File:** `specs/323-child-process-failure-results/tests/child-process-result.test.js`  
**Requirement:** R4  
**Issue:** The value `128` is repeated for max-buffer scenarios and stdout setup. Its role as an intentionally small buffer limit is not immediately clear from each call site.  
**Suggestion:** Introduce a constant like `const SMALL_MAX_BUFFER = 128;` and use it in the max-buffer tests and fixture result setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 5. Use a table for invalid constructor cases
**Finding key:** loop-f3df800241de8864de07
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/tests/child-process-result.test.js
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/tests/child-process-result.test.js`  
**Requirement:** R1  
**Issue:** The constructor invariant test contains a long inline array of object literals with repeated `{ ...passed, ... }` setup. It is correct but hard to scan, and future invariant cases will make the test increasingly bulky.  
**Suggestion:** Extract a helper such as `invalidResultCase(name, overrides)` or split invalid cases into grouped arrays by kind. That keeps the invariant matrix compact while preserving explicit case names.
**Suggestion:** **File:** `specs/323-child-process-failure-results/tests/child-process-result.test.js`  
**Requirement:** R1  
**Issue:** The constructor invariant test contains a long inline array of object literals with repeated `{ ...passed, ... }` setup. It is correct but hard to scan, and future invariant cases will make the test increasingly bulky.  
**Suggestion:** Extract a helper such as `invalidResultCase(name, overrides)` or split invalid cases into grouped arrays by kind. That keeps the invariant matrix compact while preserving explicit case names.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 1. Avoid Full Stream Splitting For Summaries
**Finding key:** loop-14e5a044ab38b483ebb1
**Failure mode:** refactor
**File:** src/flow/lib/test-regression.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R2  
**Issue:** `ProcessStreamSummary` builds `nonEmptyLines` with `text.split(...).filter(...)`, which duplicates large stdout/stderr content into an array just to find first and last non-empty lines. This is avoidable memory churn, especially around max-buffer cases.  
**Suggestion:** Compute `byteLength`, first non-empty line, and last non-empty line in a single pass over lines without retaining every non-empty line.
**Suggestion:** **File:** `src/flow/lib/test-regression.js`  
**Requirement:** R2  
**Issue:** `ProcessStreamSummary` builds `nonEmptyLines` with `text.split(...).filter(...)`, which duplicates large stdout/stderr content into an array just to find first and last non-empty lines. This is avoidable memory churn, especially around max-buffer cases.  
**Suggestion:** Compute `byteLength`, first non-empty line, and last non-empty line in a single pass over lines without retaining every non-empty line.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 2. Extract Repeated Category List
**Finding key:** loop-10055f56728f8701bae9
**Failure mode:** refactor
**File:** tests/run.js
**Requirement:** R3
**Issue:** **File:** `tests/run.js`  
**Requirement:** R3  
**Issue:** The category list `["unit", "integration", "acceptance"]` is duplicated in `formatExecutionSummary`, `counts`, and the execution loop also repeats `"other"`. This makes future category changes easy to apply inconsistently.  
**Suggestion:** Define shared constants such as `SUMMARY_CATEGORIES` and `EXECUTION_CATEGORIES`, then reuse them for count initialization, summary formatting, and iteration.
**Suggestion:** **File:** `tests/run.js`  
**Requirement:** R3  
**Issue:** The category list `["unit", "integration", "acceptance"]` is duplicated in `formatExecutionSummary`, `counts`, and the execution loop also repeats `"other"`. This makes future category changes easy to apply inconsistently.  
**Suggestion:** Define shared constants such as `SUMMARY_CATEGORIES` and `EXECUTION_CATEGORIES`, then reuse them for count initialization, summary formatting, and iteration.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 3. Reduce Repeated Spawn Result Literals
**Finding key:** loop-b8dc349c7695057e32c3
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/tests/runner-reporting.test.js
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/tests/runner-reporting.test.js`  
**Requirement:** R6  
**Issue:** The tests repeat verbose spawn result object shapes with the same fields (`status`, `signal`, `error`, `stdout`, `stderr`) across many cases. This makes the scenarios harder to scan and increases maintenance noise.  
**Suggestion:** Add a small helper like `spawnResult(overrides)` that supplies defaults, then each test can specify only the fields relevant to the scenario.
**Suggestion:** **File:** `specs/323-child-process-failure-results/tests/runner-reporting.test.js`  
**Requirement:** R6  
**Issue:** The tests repeat verbose spawn result object shapes with the same fields (`status`, `signal`, `error`, `stdout`, `stderr`) across many cases. This makes the scenarios harder to scan and increases maintenance noise.  
**Suggestion:** Add a small helper like `spawnResult(overrides)` that supplies defaults, then each test can specify only the fields relevant to the scenario.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 4. Escape Diagnostic Field Names In Regex Assertions
**Finding key:** loop-e0948ca83bc0106f9bfd
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/tests/runner-reporting.test.js
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/tests/runner-reporting.test.js`  
**Requirement:** R6  
**Issue:** The loop asserting fields such as `stdout.bytes` builds `new RegExp(\`process\\.${field}:\`)`; dots inside `field` are treated as regex wildcards. The assertion is less precise than intended.  
**Suggestion:** Escape regex metacharacters in `field`, or avoid regex construction by checking `result.stderr.includes(\`process.${field}:\`)`.
**Suggestion:** **File:** `specs/323-child-process-failure-results/tests/runner-reporting.test.js`  
**Requirement:** R6  
**Issue:** The loop asserting fields such as `stdout.bytes` builds `new RegExp(\`process\\.${field}:\`)`; dots inside `field` are treated as regex wildcards. The assertion is less precise than intended.  
**Suggestion:** Escape regex metacharacters in `field`, or avoid regex construction by checking `result.stderr.includes(\`process.${field}:\`)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 1. Normalize Finding Schemas Across Review Artifacts
**Finding key:** loop-ba04df06480e083ab634
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec-gate-source.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/spec-gate-source.json`
**Requirement:** R6
**Issue:** Multiple artifacts represent findings with overlapping but inconsistent shapes: `evaluations` plus `observations`, `advisoryFindings` plus `findings`, and mixed fields such as `guardrail_id`/`guardrailId`, `findingId`, `fingerprint`, and `id`.
**Suggestion:** Define one canonical finding schema and use derived projections for phase-specific views. Standardize IDs and field naming across `spec-gate-source.json`, `draft-gate-source.json`, `issue-log.json`, and review-history attempt files.
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec-gate-source.json`
**Requirement:** R6
**Issue:** Multiple artifacts represent findings with overlapping but inconsistent shapes: `evaluations` plus `observations`, `advisoryFindings` plus `findings`, and mixed fields such as `guardrail_id`/`guardrailId`, `findingId`, `fingerprint`, and `id`.
**Suggestion:** Define one canonical finding schema and use derived projections for phase-specific views. Standardize IDs and field naming across `spec-gate-source.json`, `draft-gate-source.json`, `issue-log.json`, and review-history attempt files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 2. Consolidate Work-Unit Metadata Shape
**Finding key:** loop-96d6e3c18b898b1ecf7a
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json`
**Requirement:** R6
**Issue:** Several work-unit artifacts duplicate the same identity metadata both at the root and under `identity`, including `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`.
**Suggestion:** Store immutable identity fields only under `identity`, and have readers/indexers derive any top-level display or lookup fields from that object.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json`
**Requirement:** R6
**Issue:** Several work-unit artifacts duplicate the same identity metadata both at the root and under `identity`, including `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`.
**Suggestion:** Store immutable identity fields only under `identity`, and have readers/indexers derive any top-level display or lookup fields from that object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 3. Avoid Persisting Raw And Parsed Provider Output Together
**Finding key:** loop-dd0a79d6d13590e26d43
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json
**Requirement:** R1
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`
**Requirement:** R1
**Issue:** Multiple review-history work-unit files persist `rawResponse` alongside parsed `success.proposals`, sometimes duplicating the same proposal text and sometimes creating contradictions when parsed proposals are empty.
**Suggestion:** Treat parsed proposals as canonical for successful parses. Keep `rawResponse` only for failed/debug cases, or replace it with bounded metadata such as checksum, byte count, and parse warnings.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`
**Requirement:** R1
**Issue:** Multiple review-history work-unit files persist `rawResponse` alongside parsed `success.proposals`, sometimes duplicating the same proposal text and sometimes creating contradictions when parsed proposals are empty.
**Suggestion:** Treat parsed proposals as canonical for successful parses. Keep `rawResponse` only for failed/debug cases, or replace it with bounded metadata such as checksum, byte count, and parse warnings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 57. 4. Standardize Review Scope Validation
**Finding key:** loop-8600208a8cf90705a02a
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json`
**Requirement:** R6
**Issue:** Several successful work-unit artifacts contain proposals targeting files outside their touched-file scope, while other summaries depend on those artifacts as valid review evidence.
**Suggestion:** Add one shared post-processing validator for all provider outputs. A work unit should be marked failed or partially discarded when any proposal target is outside the actual diff scope.
**Suggestion:** **File:** `specs/323-child-process-failure-results/review-history/work-units/impl-review/723ff9e5998f88d518d2fa2e.json`
**Requirement:** R6
**Issue:** Several successful work-unit artifacts contain proposals targeting files outside their touched-file scope, while other summaries depend on those artifacts as valid review evidence.
**Suggestion:** Add one shared post-processing validator for all provider outputs. A work unit should be marked failed or partially discarded when any proposal target is outside the actual diff scope.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 58. 5. Unify Generated Empty Review Artifact Handling
**Finding key:** loop-425b59ccc1ead7d06fbe
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/draft-review-coverage.json
**Requirement:** R5
**Issue:** **File:** `specs/323-child-process-failure-results/draft-review-coverage.json`
**Requirement:** R5
**Issue:** Several generated review artifacts contain nearly identical empty PASS/no-op structures that differ mostly by phase and timestamp, creating noisy diffs and repeated schema maintenance.
**Suggestion:** Generate empty review artifacts from a shared template or store only a compact canonical no-op result with phase metadata.
**Suggestion:** **File:** `specs/323-child-process-failure-results/draft-review-coverage.json`
**Requirement:** R5
**Issue:** Several generated review artifacts contain nearly identical empty PASS/no-op structures that differ mostly by phase and timestamp, creating noisy diffs and repeated schema maintenance.
**Suggestion:** Generate empty review artifacts from a shared template or store only a compact canonical no-op result with phase metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 59. 6. Normalize Lifecycle State Across Spec Artifacts
**Finding key:** loop-5ebe4dbc96fff92123ef
**Failure mode:** refactor
**File:** specs/323-child-process-failure-results/spec.md
**Requirement:** R6
**Issue:** **File:** `specs/323-child-process-failure-results/spec.md`
**Requirement:** R6
**Issue:** Lifecycle state is inconsistent across files: `spec.md` says Draft while also noting approval, `spec.json` has `"approved": true`, and review artifacts show conflicting PASS/fail states for related phases.
**Suggestion:** Make one source authoritative for lifecycle state, then regenerate rendered markdown and review summaries from that source so approved/draft/pass/fail states cannot drift independently.
**Suggestion:** **File:** `specs/323-child-process-failure-results/spec.md`
**Requirement:** R6
**Issue:** Lifecycle state is inconsistent across files: `spec.md` says Draft while also noting approval, `spec.json` has `"approved": true`, and review artifacts show conflicting PASS/fail states for related phases.
**Suggestion:** Make one source authoritative for lifecycle state, then regenerate rendered markdown and review summaries from that source so approved/draft/pass/fail states cannot drift independently.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
