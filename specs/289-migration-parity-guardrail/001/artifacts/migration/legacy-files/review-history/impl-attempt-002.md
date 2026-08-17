# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. I’ll review the touched JSON files only and check the added guardrail text against the bounded-resource-usage perspective before proposing anything.The supplied diff is enough to review, but the workspace path does not currently contain those files, so I’m treating the diff as the source of truth and staying within the listed touched paths.### 1. Remove no-op generated artifact
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/draft-coverage-repair.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/draft-coverage-repair.json`
**Issue:** This newly added file contains only an empty `items` array and a summary saying there is nothing to repair. If the pipeline does not require empty repair artifacts to be checked in, this adds repository noise without useful state.
**Suggestion:** Omit this file when there are no repair items, or generate it only as an untracked build artifact.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/draft-coverage-repair.json`
**Issue:** This newly added file contains only an empty `items` array and a summary saying there is nothing to repair. If the pipeline does not require empty repair artifacts to be checked in, this adds repository noise without useful state.
**Suggestion:** Omit this file when there are no repair items, or generate it only as an untracked build artifact.
**Rationale:** Loop review proposal.

### 2. 2. Remove no-op generated artifact
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/draft-coverage-triage.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/draft-coverage-triage.json`
**Issue:** This newly added file contains only an empty `items` array and a summary saying there are no findings to triage. As a committed artifact, it duplicates process metadata without adding actionable content.
**Suggestion:** Omit this file when there are no triage items, unless downstream tooling explicitly requires the empty JSON marker.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/draft-coverage-triage.json`
**Issue:** This newly added file contains only an empty `items` array and a summary saying there are no findings to triage. As a committed artifact, it duplicates process metadata without adding actionable content.
**Suggestion:** Omit this file when there are no triage items, unless downstream tooling explicitly requires the empty JSON marker.
**Rationale:** Loop review proposal.

### 3. I’ll review the touched JSON files only and check the added guardrail text against the bounded-resource-usage perspective before proposing anything.The supplied diff is enough to review, but the workspace path does not currently contain those files, so I’m treating the diff as the source of truth and staying within the listed touched paths.### 1. Remove no-op generated artifact
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/draft-coverage-repair.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/draft-coverage-repair.json`
**Issue:** This newly added file contains only an empty `items` array and a summary saying there is nothing to repair. If the pipeline does not require empty repair artifacts to be checked in, this adds repository noise without useful state.
**Suggestion:** Omit this file when there are no repair items, or generate it only as an untracked build artifact.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/draft-coverage-repair.json`
**Issue:** This newly added file contains only an empty `items` array and a summary saying there is nothing to repair. If the pipeline does not require empty repair artifacts to be checked in, this adds repository noise without useful state.
**Suggestion:** Omit this file when there are no repair items, or generate it only as an untracked build artifact.
**Rationale:** Loop review proposal.

### 4. 2. Remove no-op generated artifact
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/draft-coverage-triage.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/draft-coverage-triage.json`
**Issue:** This newly added file contains only an empty `items` array and a summary saying there are no findings to triage. As a committed artifact, it duplicates process metadata without adding actionable content.
**Suggestion:** Omit this file when there are no triage items, unless downstream tooling explicitly requires the empty JSON marker.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/draft-coverage-triage.json`
**Issue:** This newly added file contains only an empty `items` array and a summary saying there are no findings to triage. As a committed artifact, it duplicates process metadata without adding actionable content.
**Suggestion:** Omit this file when there are no triage items, unless downstream tooling explicitly requires the empty JSON marker.
**Rationale:** Loop review proposal.

### 5. 1. Collapse repeated file-map entries
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/file-map.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/file-map.json`  
**Issue:** `R1`, `R2`, and `R3` contain identical file lists, which makes future edits easy to miss or apply inconsistently.  
**Suggestion:** If the file-map schema supports grouping, combine these into a shared requirement group such as `R1-R3`, or introduce a common named file set and reference it from each requirement. If the schema requires one key per requirement, keep as-is.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/file-map.json`  
**Issue:** `R1`, `R2`, and `R3` contain identical file lists, which makes future edits easy to miss or apply inconsistently.  
**Suggestion:** If the file-map schema supports grouping, combine these into a shared requirement group such as `R1-R3`, or introduce a common named file set and reference it from each requirement. If the schema requires one key per requirement, keep as-is.
**Rationale:** Loop review proposal.

### 6. 1. Collapse repeated file-map entries
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/file-map.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/file-map.json`  
**Issue:** `R1`, `R2`, and `R3` contain identical file lists, which makes future edits easy to miss or apply inconsistently.  
**Suggestion:** If the file-map schema supports grouping, combine these into a shared requirement group such as `R1-R3`, or introduce a common named file set and reference it from each requirement. If the schema requires one key per requirement, keep as-is.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/file-map.json`  
**Issue:** `R1`, `R2`, and `R3` contain identical file lists, which makes future edits easy to miss or apply inconsistently.  
**Suggestion:** If the file-map schema supports grouping, combine these into a shared requirement group such as `R1-R3`, or introduce a common named file set and reference it from each requirement. If the schema requires one key per requirement, keep as-is.
**Rationale:** Loop review proposal.

### 7. 1. Collapse repeated file-map entries
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/file-map.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/file-map.json`  
**Issue:** `R1`, `R2`, and `R3` contain identical file lists, which makes future edits easy to miss or apply inconsistently.  
**Suggestion:** If the file-map schema supports grouping, combine these into a shared requirement group such as `R1-R3`, or introduce a common named file set and reference it from each requirement. If the schema requires one key per requirement, keep as-is.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/file-map.json`  
**Issue:** `R1`, `R2`, and `R3` contain identical file lists, which makes future edits easy to miss or apply inconsistently.  
**Suggestion:** If the file-map schema supports grouping, combine these into a shared requirement group such as `R1-R3`, or introduce a common named file set and reference it from each requirement. If the schema requires one key per requirement, keep as-is.
**Rationale:** Loop review proposal.

### 8. 1. Remove volatile flow runtime state
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/flow.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/flow.json`  
**Issue:** The file is dominated by generated runtime state: timestamps, run IDs, command logs, metrics, token counts, and in-progress status. This creates noisy churn and duplicates execution metadata rather than source-controlled behavior.  
**Suggestion:** Do not commit this artifact unless the project explicitly treats flow state as a durable spec artifact. If it must remain, strip volatile `runtimeLog` and `metrics` sections or replace them with a bounded summary.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/flow.json`  
**Issue:** The file is dominated by generated runtime state: timestamps, run IDs, command logs, metrics, token counts, and in-progress status. This creates noisy churn and duplicates execution metadata rather than source-controlled behavior.  
**Suggestion:** Do not commit this artifact unless the project explicitly treats flow state as a durable spec artifact. If it must remain, strip volatile `runtimeLog` and `metrics` sections or replace them with a bounded summary.
**Rationale:** Loop review proposal.

### 9. 2. Avoid committing failed review output
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/impl-review.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/impl-review.json`  
**Issue:** The committed artifact records `verdict: "FAIL"` and blocking findings, which makes the change set carry stale failure state rather than finalized evidence.  
**Suggestion:** Remove this generated review artifact from the diff, or regenerate it only after the blocking findings are resolved so the checked-in state reflects the final accepted implementation.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/impl-review.json`  
**Issue:** The committed artifact records `verdict: "FAIL"` and blocking findings, which makes the change set carry stale failure state rather than finalized evidence.  
**Suggestion:** Remove this generated review artifact from the diff, or regenerate it only after the blocking findings are resolved so the checked-in state reflects the final accepted implementation.
**Rationale:** Loop review proposal.

### 10. 3. Bound accumulated issue history
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/issue-log.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/issue-log.json`  
**Issue:** `entries` is an append-only issue history with no visible retention bound. Under the bounded-resource-usage guardrail, bulk accumulated logs should have an explicit size/count limit when persisted.  
**Suggestion:** Keep only the final relevant issue entries for this spec, or add/record an explicit retention policy such as max entries per phase and max character length per entry.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/issue-log.json`  
**Issue:** `entries` is an append-only issue history with no visible retention bound. Under the bounded-resource-usage guardrail, bulk accumulated logs should have an explicit size/count limit when persisted.  
**Suggestion:** Keep only the final relevant issue entries for this spec, or add/record an explicit retention policy such as max entries per phase and max character length per entry.
**Rationale:** Loop review proposal.

### 11. 1. Consolidate duplicated guardrail text
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/issue.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/issue.md`  
**Issue:** The proposed guardrail body and implementation notes are maintained twice, once in English and once in Japanese. This creates drift risk if one copy is edited later.  
**Suggestion:** Keep one canonical guardrail definition, preferably the English version used for implementation, and make the Japanese section summarize or reference it instead of repeating the full body verbatim.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/issue.md`  
**Issue:** The proposed guardrail body and implementation notes are maintained twice, once in English and once in Japanese. This creates drift risk if one copy is edited later.  
**Suggestion:** Keep one canonical guardrail definition, preferably the English version used for implementation, and make the Japanese section summarize or reference it instead of repeating the full body verbatim.
**Rationale:** Loop review proposal.

### 12. 3. Add trailing newline
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/issue.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/issue.md`  
**Issue:** The file ends without a trailing newline.  
**Suggestion:** Add a final newline to match standard text-file formatting and avoid noisy diffs later.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/issue.md`  
**Issue:** The file ends without a trailing newline.  
**Suggestion:** Add a final newline to match standard text-file formatting and avoid noisy diffs later.
**Rationale:** Loop review proposal.

### 13. 1. Consolidate duplicated guardrail text
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/issue.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/issue.md`  
**Issue:** The proposed guardrail body and implementation notes are maintained twice, once in English and once in Japanese. This creates drift risk if one copy is edited later.  
**Suggestion:** Keep one canonical guardrail definition, preferably the English version used for implementation, and make the Japanese section summarize or reference it instead of repeating the full body verbatim.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/issue.md`  
**Issue:** The proposed guardrail body and implementation notes are maintained twice, once in English and once in Japanese. This creates drift risk if one copy is edited later.  
**Suggestion:** Keep one canonical guardrail definition, preferably the English version used for implementation, and make the Japanese section summarize or reference it instead of repeating the full body verbatim.
**Rationale:** Loop review proposal.

### 14. 2. Fix repair-target severity inconsistency
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/draft-questions-attempt-001.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/draft-questions-attempt-001.json`  
**Issue:** The summary and `repairTargets` classify the finding as a repair target, but `findings[0].id` includes `blocking` and `findings[0].severity` is `"blocking"`. This makes the artifact internally inconsistent.  
**Suggestion:** Align the normalized finding with the repair-target classification, or move it into `blockingFindings` and update the verdict/summary accordingly. Ensure `id`, `severity`, `category`, and containing array describe the same classification.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/draft-questions-attempt-001.json`  
**Issue:** The summary and `repairTargets` classify the finding as a repair target, but `findings[0].id` includes `blocking` and `findings[0].severity` is `"blocking"`. This makes the artifact internally inconsistent.  
**Suggestion:** Align the normalized finding with the repair-target classification, or move it into `blockingFindings` and update the verdict/summary accordingly. Ensure `id`, `severity`, `category`, and containing array describe the same classification.
**Rationale:** Loop review proposal.

### 15. 3. Add trailing newline
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/issue.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/issue.md`  
**Issue:** The file ends without a trailing newline.  
**Suggestion:** Add a final newline to match standard text-file formatting and avoid noisy diffs later.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/issue.md`  
**Issue:** The file ends without a trailing newline.  
**Suggestion:** Add a final newline to match standard text-file formatting and avoid noisy diffs later.
**Rationale:** Loop review proposal.

### 16. 2. Fix repair-target severity inconsistency
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/draft-questions-attempt-001.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/draft-questions-attempt-001.json`  
**Issue:** The summary and `repairTargets` classify the finding as a repair target, but `findings[0].id` includes `blocking` and `findings[0].severity` is `"blocking"`. This makes the artifact internally inconsistent.  
**Suggestion:** Align the normalized finding with the repair-target classification, or move it into `blockingFindings` and update the verdict/summary accordingly. Ensure `id`, `severity`, `category`, and containing array describe the same classification.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/draft-questions-attempt-001.json`  
**Issue:** The summary and `repairTargets` classify the finding as a repair target, but `findings[0].id` includes `blocking` and `findings[0].severity` is `"blocking"`. This makes the artifact internally inconsistent.  
**Suggestion:** Align the normalized finding with the repair-target classification, or move it into `blockingFindings` and update the verdict/summary accordingly. Ensure `id`, `severity`, `category`, and containing array describe the same classification.
**Rationale:** Loop review proposal.

### 17. 1. Collapse duplicated finding text
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/impl-attempt-001.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/impl-attempt-001.json`
**Issue:** The same two findings are stored twice, once in `blockingFindings` and again in `findings`, with duplicated title/body/category data. This creates drift risk if one copy is edited or regenerated differently.
**Suggestion:** Make one findings collection canonical, preferably `findings`, and derive `blockingFindings` from severity at read/render time, or store only finding IDs in the secondary grouping.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/impl-attempt-001.json`
**Issue:** The same two findings are stored twice, once in `blockingFindings` and again in `findings`, with duplicated title/body/category data. This creates drift risk if one copy is edited or regenerated differently.
**Suggestion:** Make one findings collection canonical, preferably `findings`, and derive `blockingFindings` from severity at read/render time, or store only finding IDs in the secondary grouping.
**Rationale:** Loop review proposal.

### 18. 1. Collapse duplicated finding text
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/impl-attempt-001.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/impl-attempt-001.json`
**Issue:** The same two findings are stored twice, once in `blockingFindings` and again in `findings`, with duplicated title/body/category data. This creates drift risk if one copy is edited or regenerated differently.
**Suggestion:** Make one findings collection canonical, preferably `findings`, and derive `blockingFindings` from severity at read/render time, or store only finding IDs in the secondary grouping.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/impl-attempt-001.json`
**Issue:** The same two findings are stored twice, once in `blockingFindings` and again in `findings`, with duplicated title/body/category data. This creates drift risk if one copy is edited or regenerated differently.
**Suggestion:** Make one findings collection canonical, preferably `findings`, and derive `blockingFindings` from severity at read/render time, or store only finding IDs in the secondary grouping.
**Rationale:** Loop review proposal.

### 19. 2. Avoid repeated advisory content
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json`
**Issue:** Each non-blocking improvement repeats the same content in `body`, `improvement`, and `whyNonBlocking`, then repeats it again in `findings`. This is excessive duplication for a generated artifact.
**Suggestion:** Store structured fields once, then render `body` only in the Markdown artifact or generate it on demand. If `findings` is required, reference the improvement IDs instead of copying the full text.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json`
**Issue:** Each non-blocking improvement repeats the same content in `body`, `improvement`, and `whyNonBlocking`, then repeats it again in `findings`. This is excessive duplication for a generated artifact.
**Suggestion:** Store structured fields once, then render `body` only in the Markdown artifact or generate it on demand. If `findings` is required, reference the improvement IDs instead of copying the full text.
**Rationale:** Loop review proposal.

### 20. 3. Replace generic categories
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json`
**Issue:** The normalized `findings` entries all use `"category": "unknown"`, despite the surrounding records having meaningful titles and targets. This weakens downstream filtering and makes the field look like placeholder data.
**Suggestion:** Use a meaningful category such as `spec_clarity`, `scope_clarification`, or `test_organization`, or omit `category` when no category is known.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json`
**Issue:** The normalized `findings` entries all use `"category": "unknown"`, despite the surrounding records having meaningful titles and targets. This weakens downstream filtering and makes the field look like placeholder data.
**Suggestion:** Use a meaningful category such as `spec_clarity`, `scope_clarification`, or `test_organization`, or omit `category` when no category is known.
**Rationale:** Loop review proposal.

### 21. 1. Collapse duplicated finding text
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/review.md`
**Issue:** The same two findings are stored twice, once in `blockingFindings` and again in `findings`, with duplicated title/body/category data. This creates drift risk if one copy is edited or regenerated differently.
**Suggestion:** Make one findings collection canonical, preferably `findings`, and derive `blockingFindings` from severity at read/render time, or store only finding IDs in the secondary grouping.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review.md`
**Issue:** The same two findings are stored twice, once in `blockingFindings` and again in `findings`, with duplicated title/body/category data. This creates drift risk if one copy is edited or regenerated differently.
**Suggestion:** Make one findings collection canonical, preferably `findings`, and derive `blockingFindings` from severity at read/render time, or store only finding IDs in the secondary grouping.
**Rationale:** Loop review proposal.

### 22. 2. Avoid repeated advisory content
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/review.md`
**Issue:** Each non-blocking improvement repeats the same content in `body`, `improvement`, and `whyNonBlocking`, then repeats it again in `findings`. This is excessive duplication for a generated artifact.
**Suggestion:** Store structured fields once, then render `body` only in the Markdown artifact or generate it on demand. If `findings` is required, reference the improvement IDs instead of copying the full text.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review.md`
**Issue:** Each non-blocking improvement repeats the same content in `body`, `improvement`, and `whyNonBlocking`, then repeats it again in `findings`. This is excessive duplication for a generated artifact.
**Suggestion:** Store structured fields once, then render `body` only in the Markdown artifact or generate it on demand. If `findings` is required, reference the improvement IDs instead of copying the full text.
**Rationale:** Loop review proposal.

### 23. 3. Replace generic categories
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/review.md`
**Issue:** The normalized `findings` entries all use `"category": "unknown"`, despite the surrounding records having meaningful titles and targets. This weakens downstream filtering and makes the field look like placeholder data.
**Suggestion:** Use a meaningful category such as `spec_clarity`, `scope_clarification`, or `test_organization`, or omit `category` when no category is known.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review.md`
**Issue:** The normalized `findings` entries all use `"category": "unknown"`, despite the surrounding records having meaningful titles and targets. This weakens downstream filtering and makes the field look like placeholder data.
**Suggestion:** Use a meaningful category such as `spec_clarity`, `scope_clarification`, or `test_organization`, or omit `category` when no category is known.
**Rationale:** Loop review proposal.

### 24. 2. Avoid repeated advisory content
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json`
**Issue:** Each non-blocking improvement repeats the same content in `body`, `improvement`, and `whyNonBlocking`, then repeats it again in `findings`. This is excessive duplication for a generated artifact.
**Suggestion:** Store structured fields once, then render `body` only in the Markdown artifact or generate it on demand. If `findings` is required, reference the improvement IDs instead of copying the full text.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json`
**Issue:** Each non-blocking improvement repeats the same content in `body`, `improvement`, and `whyNonBlocking`, then repeats it again in `findings`. This is excessive duplication for a generated artifact.
**Suggestion:** Store structured fields once, then render `body` only in the Markdown artifact or generate it on demand. If `findings` is required, reference the improvement IDs instead of copying the full text.
**Rationale:** Loop review proposal.

### 25. 3. Replace generic categories
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json`
**Issue:** The normalized `findings` entries all use `"category": "unknown"`, despite the surrounding records having meaningful titles and targets. This weakens downstream filtering and makes the field look like placeholder data.
**Suggestion:** Use a meaningful category such as `spec_clarity`, `scope_clarification`, or `test_organization`, or omit `category` when no category is known.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/spec-attempt-001.json`
**Issue:** The normalized `findings` entries all use `"category": "unknown"`, despite the surrounding records having meaningful titles and targets. This weakens downstream filtering and makes the field look like placeholder data.
**Suggestion:** Use a meaningful category such as `spec_clarity`, `scope_clarification`, or `test_organization`, or omit `category` when no category is known.
**Rationale:** Loop review proposal.

### 26. 1. Add trailing newline
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/test-attempt-001.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/test-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/test-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Rationale:** Loop review proposal.

### 27. 1. Add trailing newline
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/spec-review.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/spec-review.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/spec-review.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Rationale:** Loop review proposal.

### 28. 1. Add trailing newline
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/test-attempt-001.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/test-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/test-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Rationale:** Loop review proposal.

### 29. 1. Add trailing newline
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/review-history/test-attempt-001.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/review-history/test-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/review-history/test-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Rationale:** Loop review proposal.

### 30. 1. Add trailing newline
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/test-review.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/test-review.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/test-review.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common text-file conventions and can cause noisy diffs later.  
**Suggestion:** Add a final newline after `No advisory findings.`
**Rationale:** Loop review proposal.

### 31. 1. Remove Redundant Review Text Fields
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/spec-review.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/spec-review.json`
**Issue:** Each improvement repeats the same content across `body`, `improvement`, and `whyNonBlocking`, increasing drift risk.
**Suggestion:** Keep structured fields as the source of truth and generate `body` only where rendered, or remove `body` if consumers can use `improvement` and `whyNonBlocking` directly.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/spec-review.json`
**Issue:** Each improvement repeats the same content across `body`, `improvement`, and `whyNonBlocking`, increasing drift risk.
**Suggestion:** Keep structured fields as the source of truth and generate `body` only where rendered, or remove `body` if consumers can use `improvement` and `whyNonBlocking` directly.
**Rationale:** Loop review proposal.

### 32. 2. Align Spec Status With Task State
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/spec.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/spec.json`
**Issue:** Requirements R1-R5 are marked `"status": "done"` while all implementation tasks are still `"pending"`, which makes the spec state internally inconsistent.
**Suggestion:** Mark requirements as pending until implementation/test evidence exists, or update task statuses if the work is genuinely complete.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/spec.json`
**Issue:** Requirements R1-R5 are marked `"status": "done"` while all implementation tasks are still `"pending"`, which makes the spec state internally inconsistent.
**Suggestion:** Mark requirements as pending until implementation/test evidence exists, or update task statuses if the work is genuinely complete.
**Rationale:** Loop review proposal.

### 33. 4. Name The Project Regression Test File
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/spec.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/spec.json`
**Issue:** `implementationTargets` and T-2 cite only `tests/unit/presets/base/`, leaving the actual regression file ambiguous.
**Suggestion:** Specify a concrete new test file path, for example `tests/unit/presets/base/migration-parity-guardrail.test.js`, to avoid mixing this coverage into an unrelated existing regression file.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/spec.json`
**Issue:** `implementationTargets` and T-2 cite only `tests/unit/presets/base/`, leaving the actual regression file ambiguous.
**Suggestion:** Specify a concrete new test file path, for example `tests/unit/presets/base/migration-parity-guardrail.test.js`, to avoid mixing this coverage into an unrelated existing regression file.
**Rationale:** Loop review proposal.

### 34. 3. Replace Empty Open Question Placeholder
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/spec.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/spec.md`
**Issue:** The `## Open Questions` section contains only `- [ ]`, which is dead placeholder content.
**Suggestion:** Replace it with `None.` or omit the section until there is a concrete open question.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/spec.md`
**Issue:** The `## Open Questions` section contains only `- [ ]`, which is dead placeholder content.
**Suggestion:** Replace it with `None.` or omit the section until there is a concrete open question.
**Rationale:** Loop review proposal.

### 35. 1. Use consistent repo-relative test paths
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/test-coverage.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/test-coverage.json`  
**Issue:** Test paths use `tests/migration-parity-guardrail.test.js`, while the execution artifact uses `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`. The mismatch makes cross-artifact comparison more error-prone.  
**Suggestion:** Store the same repo-relative path format used by `test-execute-result.json` in both `requirements[*].files` and `files[*].file`.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/test-coverage.json`  
**Issue:** Test paths use `tests/migration-parity-guardrail.test.js`, while the execution artifact uses `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`. The mismatch makes cross-artifact comparison more error-prone.  
**Suggestion:** Store the same repo-relative path format used by `test-execute-result.json` in both `requirements[*].files` and `files[*].file`.
**Rationale:** Loop review proposal.

### 36. 2. Eliminate duplicated evidence metadata across summary entries
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/test-execute-result.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/test-execute-result.json`  
**Issue:** Every `summary` entry repeats the same `test_file`, `command`, and `raw_output_lines`, with only `id` and `test_name` changing. This creates avoidable maintenance noise and drift risk.  
**Suggestion:** Move shared execution metadata to a top-level object, for example `spec_test_run`, and keep per-requirement entries focused on `id`, `result`, and `test_name`, if the artifact schema allows it.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/test-execute-result.json`  
**Issue:** Every `summary` entry repeats the same `test_file`, `command`, and `raw_output_lines`, with only `id` and `test_name` changing. This creates avoidable maintenance noise and drift risk.  
**Suggestion:** Move shared execution metadata to a top-level object, for example `spec_test_run`, and keep per-requirement entries focused on `id`, `result`, and `test_name`, if the artifact schema allows it.
**Rationale:** Loop review proposal.

### 37. 3. Avoid duplicate changed-file lists
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/test-execute-result.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/test-execute-result.json`  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` currently contain identical arrays. Keeping both copies makes the artifact larger and risks inconsistency if one is updated without the other.  
**Suggestion:** Keep one canonical changed-file list and derive trigger relevance from it, or only include `trigger_relevant_changed_files` when it differs from `changed_files`.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/test-execute-result.json`  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` currently contain identical arrays. Keeping both copies makes the artifact larger and risks inconsistency if one is updated without the other.  
**Suggestion:** Keep one canonical changed-file list and derive trigger relevance from it, or only include `trigger_relevant_changed_files` when it differs from `changed_files`.
**Rationale:** Loop review proposal.

### 38. 4. Reduce duplicated result fields
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/test-result-review.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/test-result-review.json`  
**Issue:** The artifact records the same pass state in multiple places: top-level `verdict`, `contractSummary.verdict`, and `contractSummary.result`. This duplicates state without adding clarity.  
**Suggestion:** If consumers do not require all three fields, keep a single canonical result field and derive the contract summary value from it during artifact generation.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/test-result-review.json`  
**Issue:** The artifact records the same pass state in multiple places: top-level `verdict`, `contractSummary.verdict`, and `contractSummary.result`. This duplicates state without adding clarity.  
**Suggestion:** If consumers do not require all three fields, keep a single canonical result field and derive the contract summary value from it during artifact generation.
**Rationale:** Loop review proposal.

### 39. 2. Avoid duplicating pass metadata across review artifacts
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/test-result-review.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/test-result-review.md`
**Issue:** This file repeats verdict and artifact references that are also represented structurally in `test-review.json`, creating two sources to keep synchronized.
**Suggestion:** Keep the Markdown file as a concise human summary derived from the JSON, or reduce it to verdict plus checked-item notes while relying on `test-review.json` for canonical paths and machine-readable metadata.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/test-result-review.md`
**Issue:** This file repeats verdict and artifact references that are also represented structurally in `test-review.json`, creating two sources to keep synchronized.
**Suggestion:** Keep the Markdown file as a concise human summary derived from the JSON, or reduce it to verdict plus checked-item notes while relying on `test-review.json` for canonical paths and machine-readable metadata.
**Rationale:** Loop review proposal.

### 40. 1. Bound raw test output size
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/.raw/test-execution.log
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/.raw/test-execution.log`
**Issue:** The raw regression artifact stores thousands of lines of passing TAP output. As evidence grows, this becomes unbounded bulk data retention and makes review artifacts noisy.
**Suggestion:** Replace the full passing log with a bounded excerpt strategy: keep command lines, local test summary, regression final counts, failure blocks if present, and a capped head/tail excerpt with an explicit truncation marker.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/.raw/test-execution.log`
**Issue:** The raw regression artifact stores thousands of lines of passing TAP output. As evidence grows, this becomes unbounded bulk data retention and makes review artifacts noisy.
**Suggestion:** Replace the full passing log with a bounded excerpt strategy: keep command lines, local test summary, regression final counts, failure blocks if present, and a capped head/tail excerpt with an explicit truncation marker.
**Rationale:** Loop review proposal.

### 41. 2. Avoid duplicating pass metadata across review artifacts
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/test-result-review.md
**Issue:** **File:** `specs/289-migration-parity-guardrail/test-result-review.md`
**Issue:** This file repeats verdict and artifact references that are also represented structurally in `test-review.json`, creating two sources to keep synchronized.
**Suggestion:** Keep the Markdown file as a concise human summary derived from the JSON, or reduce it to verdict plus checked-item notes while relying on `test-review.json` for canonical paths and machine-readable metadata.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/test-result-review.md`
**Issue:** This file repeats verdict and artifact references that are also represented structurally in `test-review.json`, creating two sources to keep synchronized.
**Suggestion:** Keep the Markdown file as a concise human summary derived from the JSON, or reduce it to verdict plus checked-item notes while relying on `test-review.json` for canonical paths and machine-readable metadata.
**Rationale:** Loop review proposal.

### 42. 1. Bound raw test output size
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/.raw/test-execution.log
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/.raw/test-execution.log`
**Issue:** The raw regression artifact stores thousands of lines of passing TAP output. As evidence grows, this becomes unbounded bulk data retention and makes review artifacts noisy.
**Suggestion:** Replace the full passing log with a bounded excerpt strategy: keep command lines, local test summary, regression final counts, failure blocks if present, and a capped head/tail excerpt with an explicit truncation marker.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/.raw/test-execution.log`
**Issue:** The raw regression artifact stores thousands of lines of passing TAP output. As evidence grows, this becomes unbounded bulk data retention and makes review artifacts noisy.
**Suggestion:** Replace the full passing log with a bounded excerpt strategy: keep command lines, local test summary, regression final counts, failure blocks if present, and a capped head/tail excerpt with an explicit truncation marker.
**Rationale:** Loop review proposal.

### 43. 1. Bound git subprocess execution
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `execFileSync("git", ...)` has no timeout, so a stalled git command can hang the test indefinitely. This violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit timeout in the `git` helper, e.g. `execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10_000 })`.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `execFileSync("git", ...)` has no timeout, so a stalled git command can hang the test indefinitely. This violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit timeout in the `git` helper, e.g. `execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10_000 })`.
**Rationale:** Loop review proposal.

### 44. 2. Extract repeated body inclusion assertions
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The tests repeat the same `for ... assert.ok(body.includes(...))` pattern across trigger terms, parity concepts, evidence limits, labels, forbidden terms, and preserved ids.  
**Suggestion:** Add small helpers such as `assertIncludesAll(text, terms, messagePrefix)` and `assertExcludesAll(text, terms, messagePrefix)` to reduce duplication and make assertion intent consistent.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The tests repeat the same `for ... assert.ok(body.includes(...))` pattern across trigger terms, parity concepts, evidence limits, labels, forbidden terms, and preserved ids.  
**Suggestion:** Add small helpers such as `assertIncludesAll(text, terms, messagePrefix)` and `assertExcludesAll(text, terms, messagePrefix)` to reduce duplication and make assertion intent consistent.
**Rationale:** Loop review proposal.

### 45. 3. Avoid repeated fixture file reads
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `baseGuardrails()`, `migrationParityGuardrail()`, and `normalizedBody()` repeatedly read and parse the same `guardrail.json` file during one test process.  
**Suggestion:** Load the guardrails once into a top-level constant or cached helper, then derive `migrationParityGuardrail` and its lowercase body from that shared value.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `baseGuardrails()`, `migrationParityGuardrail()`, and `normalizedBody()` repeatedly read and parse the same `guardrail.json` file during one test process.  
**Suggestion:** Load the guardrails once into a top-level constant or cached helper, then derive `migrationParityGuardrail` and its lowercase body from that shared value.
**Rationale:** Loop review proposal.

### 46. 4. Simplify temp repository path handling
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The R5 test repeats `path.join(tmp, "src", "presets", "base", "guardrail.json")`, making the setup noisier than necessary.  
**Suggestion:** Introduce local constants like `const basePresetDir = path.join(tmp, "src", "presets", "base");` and `const tmpGuardrailPath = path.join(basePresetDir, "guardrail.json");`.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The R5 test repeats `path.join(tmp, "src", "presets", "base", "guardrail.json")`, making the setup noisier than necessary.  
**Suggestion:** Introduce local constants like `const basePresetDir = path.join(tmp, "src", "presets", "base");` and `const tmpGuardrailPath = path.join(basePresetDir, "guardrail.json");`.
**Rationale:** Loop review proposal.

### 47. 5. Use clearer body helper naming
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `normalizedBody()` is vague; in this file it specifically means the lowercase body of the `migration-parity` guardrail.  
**Suggestion:** Rename it to `migrationParityBodyLower()` or `normalizedMigrationParityBody()` so call sites communicate exactly what is being checked.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `normalizedBody()` is vague; in this file it specifically means the lowercase body of the `migration-parity` guardrail.  
**Suggestion:** Rename it to `migrationParityBodyLower()` or `normalizedMigrationParityBody()` so call sites communicate exactly what is being checked.
**Rationale:** Loop review proposal.

### 48. 1. Bound git subprocess execution
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `execFileSync("git", ...)` has no timeout, so a stalled git command can hang the test indefinitely. This violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit timeout in the `git` helper, e.g. `execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10_000 })`.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `execFileSync("git", ...)` has no timeout, so a stalled git command can hang the test indefinitely. This violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit timeout in the `git` helper, e.g. `execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10_000 })`.
**Rationale:** Loop review proposal.

### 49. 2. Extract repeated body inclusion assertions
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The tests repeat the same `for ... assert.ok(body.includes(...))` pattern across trigger terms, parity concepts, evidence limits, labels, forbidden terms, and preserved ids.  
**Suggestion:** Add small helpers such as `assertIncludesAll(text, terms, messagePrefix)` and `assertExcludesAll(text, terms, messagePrefix)` to reduce duplication and make assertion intent consistent.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The tests repeat the same `for ... assert.ok(body.includes(...))` pattern across trigger terms, parity concepts, evidence limits, labels, forbidden terms, and preserved ids.  
**Suggestion:** Add small helpers such as `assertIncludesAll(text, terms, messagePrefix)` and `assertExcludesAll(text, terms, messagePrefix)` to reduce duplication and make assertion intent consistent.
**Rationale:** Loop review proposal.

### 50. 3. Avoid repeated fixture file reads
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `baseGuardrails()`, `migrationParityGuardrail()`, and `normalizedBody()` repeatedly read and parse the same `guardrail.json` file during one test process.  
**Suggestion:** Load the guardrails once into a top-level constant or cached helper, then derive `migrationParityGuardrail` and its lowercase body from that shared value.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `baseGuardrails()`, `migrationParityGuardrail()`, and `normalizedBody()` repeatedly read and parse the same `guardrail.json` file during one test process.  
**Suggestion:** Load the guardrails once into a top-level constant or cached helper, then derive `migrationParityGuardrail` and its lowercase body from that shared value.
**Rationale:** Loop review proposal.

### 51. 4. Simplify temp repository path handling
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The R5 test repeats `path.join(tmp, "src", "presets", "base", "guardrail.json")`, making the setup noisier than necessary.  
**Suggestion:** Introduce local constants like `const basePresetDir = path.join(tmp, "src", "presets", "base");` and `const tmpGuardrailPath = path.join(basePresetDir, "guardrail.json");`.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The R5 test repeats `path.join(tmp, "src", "presets", "base", "guardrail.json")`, making the setup noisier than necessary.  
**Suggestion:** Introduce local constants like `const basePresetDir = path.join(tmp, "src", "presets", "base");` and `const tmpGuardrailPath = path.join(basePresetDir, "guardrail.json");`.
**Rationale:** Loop review proposal.

### 52. 5. Use clearer body helper naming
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `normalizedBody()` is vague; in this file it specifically means the lowercase body of the `migration-parity` guardrail.  
**Suggestion:** Rename it to `migrationParityBodyLower()` or `normalizedMigrationParityBody()` so call sites communicate exactly what is being checked.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `normalizedBody()` is vague; in this file it specifically means the lowercase body of the `migration-parity` guardrail.  
**Suggestion:** Rename it to `migrationParityBodyLower()` or `normalizedMigrationParityBody()` so call sites communicate exactly what is being checked.
**Rationale:** Loop review proposal.

### 53. 1. Bound git subprocess execution
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `execFileSync("git", ...)` has no timeout, so a stalled git command can hang the test indefinitely. This violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit timeout in the `git` helper, e.g. `execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10_000 })`.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `execFileSync("git", ...)` has no timeout, so a stalled git command can hang the test indefinitely. This violates the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit timeout in the `git` helper, e.g. `execFileSync("git", args, { cwd, encoding: "utf8", timeout: 10_000 })`.
**Rationale:** Loop review proposal.

### 54. 2. Extract repeated body inclusion assertions
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The tests repeat the same `for ... assert.ok(body.includes(...))` pattern across trigger terms, parity concepts, evidence limits, labels, forbidden terms, and preserved ids.  
**Suggestion:** Add small helpers such as `assertIncludesAll(text, terms, messagePrefix)` and `assertExcludesAll(text, terms, messagePrefix)` to reduce duplication and make assertion intent consistent.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The tests repeat the same `for ... assert.ok(body.includes(...))` pattern across trigger terms, parity concepts, evidence limits, labels, forbidden terms, and preserved ids.  
**Suggestion:** Add small helpers such as `assertIncludesAll(text, terms, messagePrefix)` and `assertExcludesAll(text, terms, messagePrefix)` to reduce duplication and make assertion intent consistent.
**Rationale:** Loop review proposal.

### 55. 3. Avoid repeated fixture file reads
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `baseGuardrails()`, `migrationParityGuardrail()`, and `normalizedBody()` repeatedly read and parse the same `guardrail.json` file during one test process.  
**Suggestion:** Load the guardrails once into a top-level constant or cached helper, then derive `migrationParityGuardrail` and its lowercase body from that shared value.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `baseGuardrails()`, `migrationParityGuardrail()`, and `normalizedBody()` repeatedly read and parse the same `guardrail.json` file during one test process.  
**Suggestion:** Load the guardrails once into a top-level constant or cached helper, then derive `migrationParityGuardrail` and its lowercase body from that shared value.
**Rationale:** Loop review proposal.

### 56. 4. Simplify temp repository path handling
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The R5 test repeats `path.join(tmp, "src", "presets", "base", "guardrail.json")`, making the setup noisier than necessary.  
**Suggestion:** Introduce local constants like `const basePresetDir = path.join(tmp, "src", "presets", "base");` and `const tmpGuardrailPath = path.join(basePresetDir, "guardrail.json");`.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** The R5 test repeats `path.join(tmp, "src", "presets", "base", "guardrail.json")`, making the setup noisier than necessary.  
**Suggestion:** Introduce local constants like `const basePresetDir = path.join(tmp, "src", "presets", "base");` and `const tmpGuardrailPath = path.join(basePresetDir, "guardrail.json");`.
**Rationale:** Loop review proposal.

### 57. 5. Use clearer body helper naming
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `normalizedBody()` is vague; in this file it specifically means the lowercase body of the `migration-parity` guardrail.  
**Suggestion:** Rename it to `migrationParityBodyLower()` or `normalizedMigrationParityBody()` so call sites communicate exactly what is being checked.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`  
**Issue:** `normalizedBody()` is vague; in this file it specifically means the lowercase body of the `migration-parity` guardrail.  
**Suggestion:** Rename it to `migrationParityBodyLower()` or `normalizedMigrationParityBody()` so call sites communicate exactly what is being checked.
**Rationale:** Loop review proposal.

### 58. 1. Deduplicate mapped upgrade-required paths
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** Including both `entry.path` and `entry.old_path` can produce duplicate matched paths, especially for renames within the same upgrade-required area such as `src/skills/`.  
**Suggestion:** Deduplicate before returning, e.g. `return [...new Set(matchUpgradeRequiredSourcePaths(files))];`.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** Including both `entry.path` and `entry.old_path` can produce duplicate matched paths, especially for renames within the same upgrade-required area such as `src/skills/`.  
**Suggestion:** Deduplicate before returning, e.g. `return [...new Set(matchUpgradeRequiredSourcePaths(files))];`.
**Rationale:** Loop review proposal.

### 59. 2. Add an explicit changed-file processing bound
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `listUpgradeRequiredChangedPaths` now processes all detailed changed-file entries, including untracked files, without an explicit count bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Add a clear maximum changed-file count before `flatMap`, fail with an actionable error when exceeded, and document why the limit is sufficient for flow artifact checks.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `listUpgradeRequiredChangedPaths` now processes all detailed changed-file entries, including untracked files, without an explicit count bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Add a clear maximum changed-file count before `flatMap`, fail with an actionable error when exceeded, and document why the limit is sufficient for flow artifact checks.
**Rationale:** Loop review proposal.

### 60. 1. Deduplicate mapped upgrade-required paths
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** Including both `entry.path` and `entry.old_path` can produce duplicate matched paths, especially for renames within the same upgrade-required area such as `src/skills/`.  
**Suggestion:** Deduplicate before returning, e.g. `return [...new Set(matchUpgradeRequiredSourcePaths(files))];`.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** Including both `entry.path` and `entry.old_path` can produce duplicate matched paths, especially for renames within the same upgrade-required area such as `src/skills/`.  
**Suggestion:** Deduplicate before returning, e.g. `return [...new Set(matchUpgradeRequiredSourcePaths(files))];`.
**Rationale:** Loop review proposal.

### 61. 2. Add an explicit changed-file processing bound
**Failure mode:** refactor
**File:** src/flow/lib/test-artifacts.js
**Issue:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `listUpgradeRequiredChangedPaths` now processes all detailed changed-file entries, including untracked files, without an explicit count bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Add a clear maximum changed-file count before `flatMap`, fail with an actionable error when exceeded, and document why the limit is sufficient for flow artifact checks.
**Suggestion:** **File:** `src/flow/lib/test-artifacts.js`  
**Issue:** `listUpgradeRequiredChangedPaths` now processes all detailed changed-file entries, including untracked files, without an explicit count bound. This conflicts with the `bounded-resource-usage` guardrail for bulk data loading/processing.  
**Suggestion:** Add a clear maximum changed-file count before `flatMap`, fail with an actionable error when exceeded, and document why the limit is sufficient for flow artifact checks.
**Rationale:** Loop review proposal.

### 62. 3. Avoid mutable shared repo state in tests
**Failure mode:** refactor
**File:** tests/unit/flow/upgrade-required-changed-paths.test.js
**Issue:** **File:** `tests/unit/flow/upgrade-required-changed-paths.test.js`  
**Issue:** The test helper relies on the module-level `tmp` variable, coupling `git()` and `initRepo()` through hidden mutable state. This makes future test additions easier to break.  
**Suggestion:** Have `initRepo()` return the temp directory and pass it explicitly to `git(repo, args)`, while keeping `afterEach` cleanup for the returned/current repo path.
**Suggestion:** **File:** `tests/unit/flow/upgrade-required-changed-paths.test.js`  
**Issue:** The test helper relies on the module-level `tmp` variable, coupling `git()` and `initRepo()` through hidden mutable state. This makes future test additions easier to break.  
**Suggestion:** Have `initRepo()` return the temp directory and pass it explicitly to `git(repo, args)`, while keeping `afterEach` cleanup for the returned/current repo path.
**Rationale:** Loop review proposal.

### 63. 3. Avoid mutable shared repo state in tests
**Failure mode:** refactor
**File:** tests/unit/flow/upgrade-required-changed-paths.test.js
**Issue:** **File:** `tests/unit/flow/upgrade-required-changed-paths.test.js`  
**Issue:** The test helper relies on the module-level `tmp` variable, coupling `git()` and `initRepo()` through hidden mutable state. This makes future test additions easier to break.  
**Suggestion:** Have `initRepo()` return the temp directory and pass it explicitly to `git(repo, args)`, while keeping `afterEach` cleanup for the returned/current repo path.
**Suggestion:** **File:** `tests/unit/flow/upgrade-required-changed-paths.test.js`  
**Issue:** The test helper relies on the module-level `tmp` variable, coupling `git()` and `initRepo()` through hidden mutable state. This makes future test additions easier to break.  
**Suggestion:** Have `initRepo()` return the temp directory and pass it explicitly to `git(repo, args)`, while keeping `afterEach` cleanup for the returned/current repo path.
**Rationale:** Loop review proposal.

### 64. 1. Use consistent Node built-in import specifiers
**Failure mode:** refactor
**File:** tests/unit/presets/base/migration-parity-guardrail.test.js
**Issue:** **File:** `tests/unit/presets/base/migration-parity-guardrail.test.js`  
**Issue:** The file mixes `node:` imports for `node:test` / `node:assert/strict` with bare built-in imports for `fs`, `path`, and `url`.  
**Suggestion:** Change these to `node:fs`, `node:path`, and `node:url` for consistency with the existing import style.
**Suggestion:** **File:** `tests/unit/presets/base/migration-parity-guardrail.test.js`  
**Issue:** The file mixes `node:` imports for `node:test` / `node:assert/strict` with bare built-in imports for `fs`, `path`, and `url`.  
**Suggestion:** Change these to `node:fs`, `node:path`, and `node:url` for consistency with the existing import style.
**Rationale:** Loop review proposal.

### 65. 2. Rename the generic `body()` helper
**Failure mode:** refactor
**File:** tests/unit/presets/base/migration-parity-guardrail.test.js
**Issue:** **File:** `tests/unit/presets/base/migration-parity-guardrail.test.js`  
**Issue:** `body()` is very generic and hides that it specifically returns the migration-parity guardrail body. It also assumes the guardrail exists, which makes failures less direct if future tests call it before the existence assertion is clear.  
**Suggestion:** Rename it to something like `migrationParityBody()` or define `const migrationParity = byId.get(GUARDRAIL_ID)` and use a small helper that asserts presence before returning `.body`.
**Suggestion:** **File:** `tests/unit/presets/base/migration-parity-guardrail.test.js`  
**Issue:** `body()` is very generic and hides that it specifically returns the migration-parity guardrail body. It also assumes the guardrail exists, which makes failures less direct if future tests call it before the existence assertion is clear.  
**Suggestion:** Rename it to something like `migrationParityBody()` or define `const migrationParity = byId.get(GUARDRAIL_ID)` and use a small helper that asserts presence before returning `.body`.
**Rationale:** Loop review proposal.

### 66. 3. Extract repeated include/exclude assertion loops
**Failure mode:** refactor
**File:** tests/unit/presets/base/migration-parity-guardrail.test.js
**Issue:** **File:** `tests/unit/presets/base/migration-parity-guardrail.test.js`  
**Issue:** Several tests repeat the same pattern: iterate over terms and assert `includes` or `!includes` with similar messages.  
**Suggestion:** Add small helpers such as `assertIncludesAll(text, terms, messagePrefix)` and `assertExcludesAll(text, terms, messagePrefix)` to reduce duplication and make the intent of each test block clearer.
**Suggestion:** **File:** `tests/unit/presets/base/migration-parity-guardrail.test.js`  
**Issue:** Several tests repeat the same pattern: iterate over terms and assert `includes` or `!includes` with similar messages.  
**Suggestion:** Add small helpers such as `assertIncludesAll(text, terms, messagePrefix)` and `assertExcludesAll(text, terms, messagePrefix)` to reduce duplication and make the intent of each test block clearer.
**Rationale:** Loop review proposal.

### 67. 1. Canonicalize regression test path
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/test-coverage.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/test-coverage.json`
**Issue:** The same migration-parity regression test is referenced with conflicting paths across artifacts: `tests/migration-parity-guardrail.test.js`, `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`, and `tests/unit/presets/base/migration-parity-guardrail.test.js`.
**Suggestion:** Pick one canonical repo-relative path, preferably the actual project test path `tests/unit/presets/base/migration-parity-guardrail.test.js`, and update `test-coverage.json`, `test-execute-result.json`, `spec.json`, and related summaries to match.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/test-coverage.json`
**Issue:** The same migration-parity regression test is referenced with conflicting paths across artifacts: `tests/migration-parity-guardrail.test.js`, `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`, and `tests/unit/presets/base/migration-parity-guardrail.test.js`.
**Suggestion:** Pick one canonical repo-relative path, preferably the actual project test path `tests/unit/presets/base/migration-parity-guardrail.test.js`, and update `test-coverage.json`, `test-execute-result.json`, `spec.json`, and related summaries to match.
**Rationale:** Loop review proposal.

### 68. 2. Avoid duplicate regression test introductions
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js
**Issue:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`
**Issue:** The summaries reference both a spec-local test file and a project-level unit test file for the same guardrail behavior. This risks two similar test suites drifting in assertions, helper names, and fixture setup.
**Suggestion:** Keep the executable regression test in one location, likely `tests/unit/presets/base/migration-parity-guardrail.test.js`, and have spec artifacts reference that file instead of carrying a duplicate spec-local test.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/tests/migration-parity-guardrail.test.js`
**Issue:** The summaries reference both a spec-local test file and a project-level unit test file for the same guardrail behavior. This risks two similar test suites drifting in assertions, helper names, and fixture setup.
**Suggestion:** Keep the executable regression test in one location, likely `tests/unit/presets/base/migration-parity-guardrail.test.js`, and have spec artifacts reference that file instead of carrying a duplicate spec-local test.
**Rationale:** Loop review proposal.

### 69. 3. Align lifecycle status across artifacts
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/spec.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/spec.json`
**Issue:** Cross-file state appears inconsistent: requirements are marked `done`, implementation tasks are `pending`, `impl-review.json` records a failed review, while test result artifacts record passing evidence. These artifacts describe different lifecycle states for the same work.
**Suggestion:** Normalize the final checked-in state so `spec.json`, `flow.json`, `impl-review.json`, `test-result-review.json`, and review-history artifacts agree on whether the implementation is pending, failed, or accepted.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/spec.json`
**Issue:** Cross-file state appears inconsistent: requirements are marked `done`, implementation tasks are `pending`, `impl-review.json` records a failed review, while test result artifacts record passing evidence. These artifacts describe different lifecycle states for the same work.
**Suggestion:** Normalize the final checked-in state so `spec.json`, `flow.json`, `impl-review.json`, `test-result-review.json`, and review-history artifacts agree on whether the implementation is pending, failed, or accepted.
**Rationale:** Loop review proposal.

### 70. 4. Use one canonical review finding schema
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/spec-review.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/spec-review.json`
**Issue:** Review finding content is duplicated across `spec-review.json`, `review-history/spec-attempt-001.json`, Markdown review files, and grouped fields such as `findings`, `blockingFindings`, and `repairTargets`. Some summaries also report classification drift between blocking and repair-target categories.
**Suggestion:** Store canonical findings once with stable IDs, severity, category, and target file, then derive Markdown summaries and grouped views from those IDs.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/spec-review.json`
**Issue:** Review finding content is duplicated across `spec-review.json`, `review-history/spec-attempt-001.json`, Markdown review files, and grouped fields such as `findings`, `blockingFindings`, and `repairTargets`. Some summaries also report classification drift between blocking and repair-target categories.
**Suggestion:** Store canonical findings once with stable IDs, severity, category, and target file, then derive Markdown summaries and grouped views from those IDs.
**Rationale:** Loop review proposal.

### 71. 5. Consolidate changed-file evidence fields
**Failure mode:** refactor
**File:** specs/289-migration-parity-guardrail/test-execute-result.json
**Issue:** **File:** `specs/289-migration-parity-guardrail/test-execute-result.json`
**Issue:** Changed-file lists and execution metadata are repeated across test execution, coverage, and flow artifacts, with slightly different field names and path formats. This creates avoidable drift between machine-readable evidence files.
**Suggestion:** Keep shared execution metadata and changed-file lists in one canonical artifact or top-level object, and have coverage/review artifacts reference that source instead of copying arrays and command details.
**Suggestion:** **File:** `specs/289-migration-parity-guardrail/test-execute-result.json`
**Issue:** Changed-file lists and execution metadata are repeated across test execution, coverage, and flow artifacts, with slightly different field names and path formats. This creates avoidable drift between machine-readable evidence files.
**Suggestion:** Keep shared execution metadata and changed-file lists in one canonical artifact or top-level object, and have coverage/review artifacts reference that source instead of copying arrays and command details.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
