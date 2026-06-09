# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Add Missing Generation Timestamp
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** This artifact omits `generatedAt`, while the coverage triage/repair artifacts include it. That makes the generated metadata shape inconsistent across sibling workflow outputs.
**Suggestion:** Add a `generatedAt` field using the same timestamp format as the coverage files.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** This artifact omits `generatedAt`, while the coverage triage/repair artifacts include it. That makes the generated metadata shape inconsistent across sibling workflow outputs.
**Suggestion:** Add a `generatedAt` field using the same timestamp format as the coverage files.
**Rationale:** Loop review proposal.

### 2. 2. Add Missing Generation Timestamp
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** This artifact also omits `generatedAt`, creating the same metadata inconsistency with the other generated repair/triage JSON files.
**Suggestion:** Add a `generatedAt` field so all four draft workflow artifacts share the same top-level metadata pattern.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** This artifact also omits `generatedAt`, creating the same metadata inconsistency with the other generated repair/triage JSON files.
**Suggestion:** Add a `generatedAt` field so all four draft workflow artifacts share the same top-level metadata pattern.
**Rationale:** Loop review proposal.

### 3. 3. Remove Embedded Ordinal From Item Title
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** The item title includes `"1. "` even though the array position already provides ordering. This duplicates numbering and can become stale if items are inserted or reordered.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** The item title includes `"1. "` even though the array position already provides ordering. This duplicates numbering and can become stale if items are inserted or reordered.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Rationale:** Loop review proposal.

### 4. 4. Remove Embedded Ordinal From Item Title
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** The item title repeats the same embedded ordinal pattern, which is brittle for generated or reorderable JSON arrays.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** The item title repeats the same embedded ordinal pattern, which is brittle for generated or reorderable JSON arrays.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Rationale:** Loop review proposal.

### 5. 1. Add Missing Generation Timestamp
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** This artifact omits `generatedAt`, while the coverage triage/repair artifacts include it. That makes the generated metadata shape inconsistent across sibling workflow outputs.
**Suggestion:** Add a `generatedAt` field using the same timestamp format as the coverage files.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** This artifact omits `generatedAt`, while the coverage triage/repair artifacts include it. That makes the generated metadata shape inconsistent across sibling workflow outputs.
**Suggestion:** Add a `generatedAt` field using the same timestamp format as the coverage files.
**Rationale:** Loop review proposal.

### 6. 2. Add Missing Generation Timestamp
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** This artifact also omits `generatedAt`, creating the same metadata inconsistency with the other generated repair/triage JSON files.
**Suggestion:** Add a `generatedAt` field so all four draft workflow artifacts share the same top-level metadata pattern.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** This artifact also omits `generatedAt`, creating the same metadata inconsistency with the other generated repair/triage JSON files.
**Suggestion:** Add a `generatedAt` field so all four draft workflow artifacts share the same top-level metadata pattern.
**Rationale:** Loop review proposal.

### 7. 3. Remove Embedded Ordinal From Item Title
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** The item title includes `"1. "` even though the array position already provides ordering. This duplicates numbering and can become stale if items are inserted or reordered.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** The item title includes `"1. "` even though the array position already provides ordering. This duplicates numbering and can become stale if items are inserted or reordered.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Rationale:** Loop review proposal.

### 8. 4. Remove Embedded Ordinal From Item Title
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** The item title repeats the same embedded ordinal pattern, which is brittle for generated or reorderable JSON arrays.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** The item title repeats the same embedded ordinal pattern, which is brittle for generated or reorderable JSON arrays.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Rationale:** Loop review proposal.

### 9. 2. Add Missing Generation Timestamp
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** This artifact also omits `generatedAt`, creating the same metadata inconsistency with the other generated repair/triage JSON files.
**Suggestion:** Add a `generatedAt` field so all four draft workflow artifacts share the same top-level metadata pattern.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** This artifact also omits `generatedAt`, creating the same metadata inconsistency with the other generated repair/triage JSON files.
**Suggestion:** Add a `generatedAt` field so all four draft workflow artifacts share the same top-level metadata pattern.
**Rationale:** Loop review proposal.

### 10. 4. Remove Embedded Ordinal From Item Title
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** The item title repeats the same embedded ordinal pattern, which is brittle for generated or reorderable JSON arrays.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-repair.json`
**Issue:** The item title repeats the same embedded ordinal pattern, which is brittle for generated or reorderable JSON arrays.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Rationale:** Loop review proposal.

### 11. 1. Add Missing Generation Timestamp
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** This artifact omits `generatedAt`, while the coverage triage/repair artifacts include it. That makes the generated metadata shape inconsistent across sibling workflow outputs.
**Suggestion:** Add a `generatedAt` field using the same timestamp format as the coverage files.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** This artifact omits `generatedAt`, while the coverage triage/repair artifacts include it. That makes the generated metadata shape inconsistent across sibling workflow outputs.
**Suggestion:** Add a `generatedAt` field using the same timestamp format as the coverage files.
**Rationale:** Loop review proposal.

### 12. 3. Remove Embedded Ordinal From Item Title
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** The item title includes `"1. "` even though the array position already provides ordering. This duplicates numbering and can become stale if items are inserted or reordered.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** The item title includes `"1. "` even though the array position already provides ordering. This duplicates numbering and can become stale if items are inserted or reordered.
**Suggestion:** Change `"title": "1. Empty Initial QA List"` to `"title": "Empty Initial QA List"`.
**Rationale:** Loop review proposal.

### 13. 3. Collapse Empty Finding Arrays
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-review-coverage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-review-coverage.json`  
**Issue:** `blockingFindings`, `advisoryFindings`, and `repairTargets` are all empty while `summary` already states no findings. This is harmless but repetitive for generated review output.  
**Suggestion:** If the schema allows it, omit empty finding arrays or use one normalized `findings: []` field to reduce boilerplate.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-review-coverage.json`  
**Issue:** `blockingFindings`, `advisoryFindings`, and `repairTargets` are all empty while `summary` already states no findings. This is harmless but repetitive for generated review output.  
**Suggestion:** If the schema allows it, omit empty finding arrays or use one normalized `findings: []` field to reduce boilerplate.
**Rationale:** Loop review proposal.

### 14. 4. Avoid Stale Repair Output After Draft Repair
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-review-questions.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-review-questions.json`  
**Issue:** The review file still records an “Empty Initial QA List” repair target, while `draft.json` now contains answered QA. Keeping stale advisory output can confuse later reviewers.  
**Suggestion:** Regenerate or replace this file after the repair so the recorded review state matches the current draft.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-review-questions.json`  
**Issue:** The review file still records an “Empty Initial QA List” repair target, while `draft.json` now contains answered QA. Keeping stale advisory output can confuse later reviewers.  
**Suggestion:** Regenerate or replace this file after the repair so the recorded review state matches the current draft.
**Rationale:** Loop review proposal.

### 15. 1. Remove Volatile Runtime State
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/flow.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/flow.json`  
**Issue:** The file commits large transient execution data: `runtimeLog`, `metrics`, `reviewRecoveryBaselines`, and `retryRecovery`. This creates noisy churn and duplicates information better suited to generated logs.  
**Suggestion:** Keep `flow.json` to durable workflow state only, and move detailed run telemetry to ignored `.raw` artifacts or another generated log file.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/flow.json`  
**Issue:** The file commits large transient execution data: `runtimeLog`, `metrics`, `reviewRecoveryBaselines`, and `retryRecovery`. This creates noisy churn and duplicates information better suited to generated logs.  
**Suggestion:** Keep `flow.json` to durable workflow state only, and move detailed run telemetry to ignored `.raw` artifacts or another generated log file.
**Rationale:** Loop review proposal.

### 16. 2. Normalize Parent Step Statuses
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/flow.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/flow.json`  
**Issue:** Parent statuses are inconsistent with children, for example `plan` remains `"pending"` while its child steps are completed. This makes the state harder to reason about.  
**Suggestion:** Update parent statuses from child state, or remove parent `status` when it is derived.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/flow.json`  
**Issue:** Parent statuses are inconsistent with children, for example `plan` remains `"pending"` while its child steps are completed. This makes the state harder to reason about.  
**Suggestion:** Update parent statuses from child state, or remove parent `status` when it is derived.
**Rationale:** Loop review proposal.

### 17. 3. Collapse Empty Finding Arrays
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-review-coverage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-review-coverage.json`  
**Issue:** `blockingFindings`, `advisoryFindings`, and `repairTargets` are all empty while `summary` already states no findings. This is harmless but repetitive for generated review output.  
**Suggestion:** If the schema allows it, omit empty finding arrays or use one normalized `findings: []` field to reduce boilerplate.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-review-coverage.json`  
**Issue:** `blockingFindings`, `advisoryFindings`, and `repairTargets` are all empty while `summary` already states no findings. This is harmless but repetitive for generated review output.  
**Suggestion:** If the schema allows it, omit empty finding arrays or use one normalized `findings: []` field to reduce boilerplate.
**Rationale:** Loop review proposal.

### 18. 4. Avoid Stale Repair Output After Draft Repair
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-review-questions.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-review-questions.json`  
**Issue:** The review file still records an “Empty Initial QA List” repair target, while `draft.json` now contains answered QA. Keeping stale advisory output can confuse later reviewers.  
**Suggestion:** Regenerate or replace this file after the repair so the recorded review state matches the current draft.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-review-questions.json`  
**Issue:** The review file still records an “Empty Initial QA List” repair target, while `draft.json` now contains answered QA. Keeping stale advisory output can confuse later reviewers.  
**Suggestion:** Regenerate or replace this file after the repair so the recorded review state matches the current draft.
**Rationale:** Loop review proposal.

### 19. 1. Remove Volatile Runtime State
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/flow.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/flow.json`  
**Issue:** The file commits large transient execution data: `runtimeLog`, `metrics`, `reviewRecoveryBaselines`, and `retryRecovery`. This creates noisy churn and duplicates information better suited to generated logs.  
**Suggestion:** Keep `flow.json` to durable workflow state only, and move detailed run telemetry to ignored `.raw` artifacts or another generated log file.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/flow.json`  
**Issue:** The file commits large transient execution data: `runtimeLog`, `metrics`, `reviewRecoveryBaselines`, and `retryRecovery`. This creates noisy churn and duplicates information better suited to generated logs.  
**Suggestion:** Keep `flow.json` to durable workflow state only, and move detailed run telemetry to ignored `.raw` artifacts or another generated log file.
**Rationale:** Loop review proposal.

### 20. 2. Normalize Parent Step Statuses
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/flow.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/flow.json`  
**Issue:** Parent statuses are inconsistent with children, for example `plan` remains `"pending"` while its child steps are completed. This makes the state harder to reason about.  
**Suggestion:** Update parent statuses from child state, or remove parent `status` when it is derived.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/flow.json`  
**Issue:** Parent statuses are inconsistent with children, for example `plan` remains `"pending"` while its child steps are completed. This makes the state harder to reason about.  
**Suggestion:** Update parent statuses from child state, or remove parent `status` when it is derived.
**Rationale:** Loop review proposal.

### 21. 1. Resolve duplicate `issue-log.json` additions
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/issue-log.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`  
**Issue:** The diff shows the same new file added twice with different contents: one version includes `recovery-002`, while the later version omits it. This makes the intended committed state ambiguous.  
**Suggestion:** Keep a single canonical version of the file and ensure it includes only the intended entries.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`  
**Issue:** The diff shows the same new file added twice with different contents: one version includes `recovery-002`, while the later version omits it. This makes the intended committed state ambiguous.  
**Suggestion:** Keep a single canonical version of the file and ensure it includes only the intended entries.
**Rationale:** Loop review proposal.

### 22. 3. Avoid duplicating retry recovery records across artifacts
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/issue-log.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`  
**Issue:** Retry recovery details appear duplicated between `issue-log.json` and `retry-recovery.json`, including hashes, changed paths, counters, commands, and timestamps. This creates drift risk.  
**Suggestion:** Store full retry recovery records in `retry-recovery.json`, and keep `issue-log.json` to a short event reference such as `id`, `step`, `phase`, and reason.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`  
**Issue:** Retry recovery details appear duplicated between `issue-log.json` and `retry-recovery.json`, including hashes, changed paths, counters, commands, and timestamps. This creates drift risk.  
**Suggestion:** Store full retry recovery records in `retry-recovery.json`, and keep `issue-log.json` to a short event reference such as `id`, `step`, `phase`, and reason.
**Rationale:** Loop review proposal.

### 23. 2. Resolve duplicate `retry-recovery.json` additions
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/retry-recovery.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/retry-recovery.json`  
**Issue:** The same file is also added twice with conflicting contents: one version records two recoveries, the other records only `recovery-001`.  
**Suggestion:** Collapse this to one committed version and verify whether `recovery-002` should be retained or removed.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/retry-recovery.json`  
**Issue:** The same file is also added twice with conflicting contents: one version records two recoveries, the other records only `recovery-001`.  
**Suggestion:** Collapse this to one committed version and verify whether `recovery-002` should be retained or removed.
**Rationale:** Loop review proposal.

### 24. 1. Resolve duplicate `issue-log.json` additions
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/issue-log.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`  
**Issue:** The diff shows the same new file added twice with different contents: one version includes `recovery-002`, while the later version omits it. This makes the intended committed state ambiguous.  
**Suggestion:** Keep a single canonical version of the file and ensure it includes only the intended entries.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`  
**Issue:** The diff shows the same new file added twice with different contents: one version includes `recovery-002`, while the later version omits it. This makes the intended committed state ambiguous.  
**Suggestion:** Keep a single canonical version of the file and ensure it includes only the intended entries.
**Rationale:** Loop review proposal.

### 25. 2. Resolve duplicate `retry-recovery.json` additions
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/retry-recovery.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/retry-recovery.json`  
**Issue:** The same file is also added twice with conflicting contents: one version records two recoveries, the other records only `recovery-001`.  
**Suggestion:** Collapse this to one committed version and verify whether `recovery-002` should be retained or removed.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/retry-recovery.json`  
**Issue:** The same file is also added twice with conflicting contents: one version records two recoveries, the other records only `recovery-001`.  
**Suggestion:** Collapse this to one committed version and verify whether `recovery-002` should be retained or removed.
**Rationale:** Loop review proposal.

### 26. 3. Avoid duplicating retry recovery records across artifacts
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/issue-log.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`  
**Issue:** Retry recovery details appear duplicated between `issue-log.json` and `retry-recovery.json`, including hashes, changed paths, counters, commands, and timestamps. This creates drift risk.  
**Suggestion:** Store full retry recovery records in `retry-recovery.json`, and keep `issue-log.json` to a short event reference such as `id`, `step`, `phase`, and reason.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`  
**Issue:** Retry recovery details appear duplicated between `issue-log.json` and `retry-recovery.json`, including hashes, changed paths, counters, commands, and timestamps. This creates drift risk.  
**Suggestion:** Store full retry recovery records in `retry-recovery.json`, and keep `issue-log.json` to a short event reference such as `id`, `step`, `phase`, and reason.
**Rationale:** Loop review proposal.

### 27. 4. Align verdict and finding severity
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/draft-questions-attempt-001.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/draft-questions-attempt-001.json`  
**Issue:** The artifact has `"verdict": "ADVISORY"` and a `repairTargets` entry, but the corresponding finding uses `"severity": "blocking"` and an id containing `blocking`.  
**Suggestion:** Rename the finding id and severity to match the advisory/repair-target classification, or change the verdict if the finding is truly blocking.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/draft-questions-attempt-001.json`  
**Issue:** The artifact has `"verdict": "ADVISORY"` and a `repairTargets` entry, but the corresponding finding uses `"severity": "blocking"` and an id containing `blocking`.  
**Suggestion:** Rename the finding id and severity to match the advisory/repair-target classification, or change the verdict if the finding is truly blocking.
**Rationale:** Loop review proposal.

### 28. 4. Align verdict and finding severity
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/draft-questions-attempt-001.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/draft-questions-attempt-001.json`  
**Issue:** The artifact has `"verdict": "ADVISORY"` and a `repairTargets` entry, but the corresponding finding uses `"severity": "blocking"` and an id containing `blocking`.  
**Suggestion:** Rename the finding id and severity to match the advisory/repair-target classification, or change the verdict if the finding is truly blocking.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/draft-questions-attempt-001.json`  
**Issue:** The artifact has `"verdict": "ADVISORY"` and a `repairTargets` entry, but the corresponding finding uses `"severity": "blocking"` and an id containing `blocking`.  
**Suggestion:** Rename the finding id and severity to match the advisory/repair-target classification, or change the verdict if the finding is truly blocking.
**Rationale:** Loop review proposal.

### 29. 1. Remove duplicated finding text
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/spec-attempt-001.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/spec-attempt-001.json`  
**Issue:** Each blocking finding stores the same content in `body`, `issue`, `requiredChange`, and `whyBlocking`, then repeats it again in `findings`. This makes the artifact harder to maintain and easy to desynchronize.  
**Suggestion:** Pick one canonical representation for finding details, ideally structured fields, and generate any combined `body` text from those fields when rendering.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/spec-attempt-001.json`  
**Issue:** Each blocking finding stores the same content in `body`, `issue`, `requiredChange`, and `whyBlocking`, then repeats it again in `findings`. This makes the artifact harder to maintain and easy to desynchronize.  
**Suggestion:** Pick one canonical representation for finding details, ideally structured fields, and generate any combined `body` text from those fields when rendering.
**Rationale:** Loop review proposal.

### 30. 3. Add trailing newline
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/spec-attempt-001.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/spec-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common Markdown/text-file conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/spec-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common Markdown/text-file conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 31. 3. Add trailing newline
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec-review.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec-review.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common Markdown/text-file conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec-review.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common Markdown/text-file conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 32. 2. Remove duplicated finding text
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-001.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-001.json`  
**Issue:** The R4 finding is represented in both `blockingFindings` and `findings`, duplicating title, severity, source metadata, and body text.  
**Suggestion:** Keep one canonical finding list and derive summary/grouped views from it, or store only IDs in secondary sections that need to reference the same finding.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-001.json`  
**Issue:** The R4 finding is represented in both `blockingFindings` and `findings`, duplicating title, severity, source metadata, and body text.  
**Suggestion:** Keep one canonical finding list and derive summary/grouped views from it, or store only IDs in secondary sections that need to reference the same finding.
**Rationale:** Loop review proposal.

### 33. 4. Add trailing newline
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-001.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common Markdown/text-file conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-001.md`  
**Issue:** The file ends without a trailing newline, which is inconsistent with common Markdown/text-file conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at EOF.
**Rationale:** Loop review proposal.

### 34. 1. Remove duplicated finding payloads
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** The same findings are represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the generic `findings` array. This creates drift risk, already visible in the advisory entry where `findings[].body` only repeats the title instead of preserving the advisory detail.
**Suggestion:** Prefer one canonical findings structure, or ensure the generic `findings` entries are generated from the canonical blocking/advisory arrays without losing fields like `improvement` and `whyNonBlocking`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** The same findings are represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the generic `findings` array. This creates drift risk, already visible in the advisory entry where `findings[].body` only repeats the title instead of preserving the advisory detail.
**Suggestion:** Prefer one canonical findings structure, or ensure the generic `findings` entries are generated from the canonical blocking/advisory arrays without losing fields like `improvement` and `whyNonBlocking`.
**Rationale:** Loop review proposal.

### 35. 2. Replace generic finding category values
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** Each `findings[].category` is set to `"unknown"`, which is not meaningful and makes downstream filtering or reporting less useful.
**Suggestion:** Use a concrete category such as `"coverage"`, `"committed-artifacts"`, or `"test-gap"`, matching the actual finding type.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** Each `findings[].category` is set to `"unknown"`, which is not meaningful and makes downstream filtering or reporting less useful.
**Suggestion:** Use a concrete category such as `"coverage"`, `"committed-artifacts"`, or `"test-gap"`, matching the actual finding type.
**Rationale:** Loop review proposal.

### 36. 3. Add missing trailing newline
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-002.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-002.md`
**Issue:** The file ends without a trailing newline.
**Suggestion:** Add a final newline for consistency with normal text-file formatting and cleaner diffs.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-002.md`
**Issue:** The file ends without a trailing newline.
**Suggestion:** Add a final newline for consistency with normal text-file formatting and cleaner diffs.
**Rationale:** Loop review proposal.

### 37. 3. Add missing trailing newline
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-002.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-002.md`
**Issue:** The file ends without a trailing newline.
**Suggestion:** Add a final newline for consistency with normal text-file formatting and cleaner diffs.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-002.md`
**Issue:** The file ends without a trailing newline.
**Suggestion:** Add a final newline for consistency with normal text-file formatting and cleaner diffs.
**Rationale:** Loop review proposal.

### 38. 1. Remove duplicated finding payloads
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** The same findings are represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the generic `findings` array. This creates drift risk, already visible in the advisory entry where `findings[].body` only repeats the title instead of preserving the advisory detail.
**Suggestion:** Prefer one canonical findings structure, or ensure the generic `findings` entries are generated from the canonical blocking/advisory arrays without losing fields like `improvement` and `whyNonBlocking`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** The same findings are represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the generic `findings` array. This creates drift risk, already visible in the advisory entry where `findings[].body` only repeats the title instead of preserving the advisory detail.
**Suggestion:** Prefer one canonical findings structure, or ensure the generic `findings` entries are generated from the canonical blocking/advisory arrays without losing fields like `improvement` and `whyNonBlocking`.
**Rationale:** Loop review proposal.

### 39. 2. Replace generic finding category values
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** Each `findings[].category` is set to `"unknown"`, which is not meaningful and makes downstream filtering or reporting less useful.
**Suggestion:** Use a concrete category such as `"coverage"`, `"committed-artifacts"`, or `"test-gap"`, matching the actual finding type.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** Each `findings[].category` is set to `"unknown"`, which is not meaningful and makes downstream filtering or reporting less useful.
**Suggestion:** Use a concrete category such as `"coverage"`, `"committed-artifacts"`, or `"test-gap"`, matching the actual finding type.
**Rationale:** Loop review proposal.

### 40. 1. Remove duplicated finding payloads
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** The same findings are represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the generic `findings` array. This creates drift risk, already visible in the advisory entry where `findings[].body` only repeats the title instead of preserving the advisory detail.
**Suggestion:** Prefer one canonical findings structure, or ensure the generic `findings` entries are generated from the canonical blocking/advisory arrays without losing fields like `improvement` and `whyNonBlocking`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** The same findings are represented twice: once in `blockingFindings` / `advisoryFindings`, and again in the generic `findings` array. This creates drift risk, already visible in the advisory entry where `findings[].body` only repeats the title instead of preserving the advisory detail.
**Suggestion:** Prefer one canonical findings structure, or ensure the generic `findings` entries are generated from the canonical blocking/advisory arrays without losing fields like `improvement` and `whyNonBlocking`.
**Rationale:** Loop review proposal.

### 41. 2. Replace generic finding category values
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** Each `findings[].category` is set to `"unknown"`, which is not meaningful and makes downstream filtering or reporting less useful.
**Suggestion:** Use a concrete category such as `"coverage"`, `"committed-artifacts"`, or `"test-gap"`, matching the actual finding type.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-003.json`
**Issue:** Each `findings[].category` is set to `"unknown"`, which is not meaningful and makes downstream filtering or reporting less useful.
**Suggestion:** Use a concrete category such as `"coverage"`, `"committed-artifacts"`, or `"test-gap"`, matching the actual finding type.
**Rationale:** Loop review proposal.

### 42. 3. Add missing trailing newline
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-002.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-002.md`
**Issue:** The file ends without a trailing newline.
**Suggestion:** Add a final newline for consistency with normal text-file formatting and cleaner diffs.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-002.md`
**Issue:** The file ends without a trailing newline.
**Suggestion:** Add a final newline for consistency with normal text-file formatting and cleaner diffs.
**Rationale:** Loop review proposal.

### 43. 1. Standardize Advisory Severity Naming
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-004.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-004.json`
**Issue:** The same advisory finding is represented as `"kind": "advisory"` in `advisoryFindings` but `"severity": "non-blocking"` in `findings`. This creates avoidable naming inconsistency inside one artifact.
**Suggestion:** Use one term consistently, preferably `"advisory"` if that is the section name and count key, or document why the flattened `findings` schema intentionally maps advisory to non-blocking.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-004.json`
**Issue:** The same advisory finding is represented as `"kind": "advisory"` in `advisoryFindings` but `"severity": "non-blocking"` in `findings`. This creates avoidable naming inconsistency inside one artifact.
**Suggestion:** Use one term consistently, preferably `"advisory"` if that is the section name and count key, or document why the flattened `findings` schema intentionally maps advisory to non-blocking.
**Rationale:** Loop review proposal.

### 44. 1. Standardize Advisory Severity Naming
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-004.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-004.json`
**Issue:** The same advisory finding is represented as `"kind": "advisory"` in `advisoryFindings` but `"severity": "non-blocking"` in `findings`. This creates avoidable naming inconsistency inside one artifact.
**Suggestion:** Use one term consistently, preferably `"advisory"` if that is the section name and count key, or document why the flattened `findings` schema intentionally maps advisory to non-blocking.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-004.json`
**Issue:** The same advisory finding is represented as `"kind": "advisory"` in `advisoryFindings` but `"severity": "non-blocking"` in `findings`. This creates avoidable naming inconsistency inside one artifact.
**Suggestion:** Use one term consistently, preferably `"advisory"` if that is the section name and count key, or document why the flattened `findings` schema intentionally maps advisory to non-blocking.
**Rationale:** Loop review proposal.

### 45. 2. Remove Duplicated Finding Text
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.json`
**Issue:** Each blocking finding is duplicated between `blockingFindings` and `findings`, increasing the chance that title/body/category data drifts between sections.
**Suggestion:** If consumers allow it, keep a single canonical `findings` array and derive grouped sections from `severity`/`kind`. If both shapes are required, generate one from the other instead of maintaining both independently.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.json`
**Issue:** Each blocking finding is duplicated between `blockingFindings` and `findings`, increasing the chance that title/body/category data drifts between sections.
**Suggestion:** If consumers allow it, keep a single canonical `findings` array and derive grouped sections from `severity`/`kind`. If both shapes are required, generate one from the other instead of maintaining both independently.
**Rationale:** Loop review proposal.

### 46. 3. Add Final Newline
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.md`
**Issue:** The file is missing a trailing newline, unlike normal text-file conventions and the adjacent markdown artifact.
**Suggestion:** Add a newline after `No advisory findings.` to keep generated markdown output consistent.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.md`
**Issue:** The file is missing a trailing newline, unlike normal text-file conventions and the adjacent markdown artifact.
**Suggestion:** Add a newline after `No advisory findings.` to keep generated markdown output consistent.
**Rationale:** Loop review proposal.

### 47. 2. Remove Duplicated Finding Text
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.json`
**Issue:** Each blocking finding is duplicated between `blockingFindings` and `findings`, increasing the chance that title/body/category data drifts between sections.
**Suggestion:** If consumers allow it, keep a single canonical `findings` array and derive grouped sections from `severity`/`kind`. If both shapes are required, generate one from the other instead of maintaining both independently.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.json`
**Issue:** Each blocking finding is duplicated between `blockingFindings` and `findings`, increasing the chance that title/body/category data drifts between sections.
**Suggestion:** If consumers allow it, keep a single canonical `findings` array and derive grouped sections from `severity`/`kind`. If both shapes are required, generate one from the other instead of maintaining both independently.
**Rationale:** Loop review proposal.

### 48. 3. Add Final Newline
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.md`
**Issue:** The file is missing a trailing newline, unlike normal text-file conventions and the adjacent markdown artifact.
**Suggestion:** Add a newline after `No advisory findings.` to keep generated markdown output consistent.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-005.md`
**Issue:** The file is missing a trailing newline, unlike normal text-file conventions and the adjacent markdown artifact.
**Suggestion:** Add a newline after `No advisory findings.` to keep generated markdown output consistent.
**Rationale:** Loop review proposal.

### 49. 2. Avoid parallel finding representations
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-006.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-006.json`
**Issue:** The same two findings appear in both `blockingFindings` and `findings`, with overlapping but differently shaped fields. This duplicates maintenance and can become inconsistent.
**Suggestion:** Prefer one canonical `findings` array with `severity`/`kind`, then derive blocking counts and blocking-specific views from it.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-006.json`
**Issue:** The same two findings appear in both `blockingFindings` and `findings`, with overlapping but differently shaped fields. This duplicates maintenance and can become inconsistent.
**Suggestion:** Prefer one canonical `findings` array with `severity`/`kind`, then derive blocking counts and blocking-specific views from it.
**Rationale:** Loop review proposal.

### 50. 3. Normalize report formatting
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-006.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-006.md`
**Issue:** The file has no trailing newline, which is inconsistent with normal text artifact formatting and can cause needless diff noise.
**Suggestion:** Add a trailing newline at EOF.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-006.md`
**Issue:** The file has no trailing newline, which is inconsistent with normal text artifact formatting and can cause needless diff noise.
**Suggestion:** Add a trailing newline at EOF.
**Rationale:** Loop review proposal.

### 51. 4. Rename vague repair item fields
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec-repair.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec-repair.json`
**Issue:** `items` is generic and does not communicate that entries represent applied spec-review findings.
**Suggestion:** Rename `items` to `appliedFindings` or `repairs` to make the JSON easier to understand without reading every entry.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec-repair.json`
**Issue:** `items` is generic and does not communicate that entries represent applied spec-review findings.
**Suggestion:** Rename `items` to `appliedFindings` or `repairs` to make the JSON easier to understand without reading every entry.
**Rationale:** Loop review proposal.

### 52. 1. Remove duplicated finding prose
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec-review.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec-review.json`
**Issue:** Each `blockingFindings` entry stores the same content twice: once as structured `issue` / `requiredChange` / `whyBlocking` fields and again in the formatted `body` string. This creates drift risk.
**Suggestion:** Keep the structured fields as the canonical representation and remove `body`, or make `body` generated only at render time.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec-review.json`
**Issue:** Each `blockingFindings` entry stores the same content twice: once as structured `issue` / `requiredChange` / `whyBlocking` fields and again in the formatted `body` string. This creates drift risk.
**Suggestion:** Keep the structured fields as the canonical representation and remove `body`, or make `body` generated only at render time.
**Rationale:** Loop review proposal.

### 53. 1. Add Explicit Bounds To Bulk Validation
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.json`
**Issue:** The spec requires validating “every contribution path” and copying sibling repository artifacts, but does not define limits on manifest entry counts, path depth, file count, or byte size. This violates the bounded-resource-usage guardrail for bulk data loading/recursive processing.
**Suggestion:** Add concrete caps, for example max contribution entries per manifest, max relative path length/depth, max copied files, max total copied bytes, and excluded directories such as `.git` and `node_modules`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.json`
**Issue:** The spec requires validating “every contribution path” and copying sibling repository artifacts, but does not define limits on manifest entry counts, path depth, file count, or byte size. This violates the bounded-resource-usage guardrail for bulk data loading/recursive processing.
**Suggestion:** Add concrete caps, for example max contribution entries per manifest, max relative path length/depth, max copied files, max total copied bytes, and excluded directories such as `.git` and `node_modules`.
**Rationale:** Loop review proposal.

### 54. 2. Mirror Resource Bounds In Rendered Spec
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** The human-readable spec repeats the unbounded validation/copy requirements from `spec.json`, so reviewers and implementers may miss the bounded-resource requirement.
**Suggestion:** After updating `spec.json`, regenerate `spec.md` so the Constraints or Acceptance Criteria include the same explicit bounds.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** The human-readable spec repeats the unbounded validation/copy requirements from `spec.json`, so reviewers and implementers may miss the bounded-resource requirement.
**Suggestion:** After updating `spec.json`, regenerate `spec.md` so the Constraints or Acceptance Criteria include the same explicit bounds.
**Rationale:** Loop review proposal.

### 55. 3. Remove Empty Open Questions Placeholder
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** `## Open Questions` contains only `- [ ]`, which is dead placeholder content and can be mistaken for an unresolved required decision.
**Suggestion:** Replace it with `None.` or omit the section until an actual open question exists.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** `## Open Questions` contains only `- [ ]`, which is dead placeholder content and can be mistaken for an unresolved required decision.
**Suggestion:** Replace it with `None.` or omit the section until an actual open question exists.
**Rationale:** Loop review proposal.

### 56. 1. Add Explicit Bounds To Bulk Validation
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.json`
**Issue:** The spec requires validating “every contribution path” and copying sibling repository artifacts, but does not define limits on manifest entry counts, path depth, file count, or byte size. This violates the bounded-resource-usage guardrail for bulk data loading/recursive processing.
**Suggestion:** Add concrete caps, for example max contribution entries per manifest, max relative path length/depth, max copied files, max total copied bytes, and excluded directories such as `.git` and `node_modules`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.json`
**Issue:** The spec requires validating “every contribution path” and copying sibling repository artifacts, but does not define limits on manifest entry counts, path depth, file count, or byte size. This violates the bounded-resource-usage guardrail for bulk data loading/recursive processing.
**Suggestion:** Add concrete caps, for example max contribution entries per manifest, max relative path length/depth, max copied files, max total copied bytes, and excluded directories such as `.git` and `node_modules`.
**Rationale:** Loop review proposal.

### 57. 2. Mirror Resource Bounds In Rendered Spec
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** The human-readable spec repeats the unbounded validation/copy requirements from `spec.json`, so reviewers and implementers may miss the bounded-resource requirement.
**Suggestion:** After updating `spec.json`, regenerate `spec.md` so the Constraints or Acceptance Criteria include the same explicit bounds.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** The human-readable spec repeats the unbounded validation/copy requirements from `spec.json`, so reviewers and implementers may miss the bounded-resource requirement.
**Suggestion:** After updating `spec.json`, regenerate `spec.md` so the Constraints or Acceptance Criteria include the same explicit bounds.
**Rationale:** Loop review proposal.

### 58. 3. Remove Empty Open Questions Placeholder
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** `## Open Questions` contains only `- [ ]`, which is dead placeholder content and can be mistaken for an unresolved required decision.
**Suggestion:** Replace it with `None.` or omit the section until an actual open question exists.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** `## Open Questions` contains only `- [ ]`, which is dead placeholder content and can be mistaken for an unresolved required decision.
**Suggestion:** Replace it with `None.` or omit the section until an actual open question exists.
**Rationale:** Loop review proposal.

### 59. 1. Add Explicit Bounds To Bulk Validation
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.json`
**Issue:** The spec requires validating “every contribution path” and copying sibling repository artifacts, but does not define limits on manifest entry counts, path depth, file count, or byte size. This violates the bounded-resource-usage guardrail for bulk data loading/recursive processing.
**Suggestion:** Add concrete caps, for example max contribution entries per manifest, max relative path length/depth, max copied files, max total copied bytes, and excluded directories such as `.git` and `node_modules`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.json`
**Issue:** The spec requires validating “every contribution path” and copying sibling repository artifacts, but does not define limits on manifest entry counts, path depth, file count, or byte size. This violates the bounded-resource-usage guardrail for bulk data loading/recursive processing.
**Suggestion:** Add concrete caps, for example max contribution entries per manifest, max relative path length/depth, max copied files, max total copied bytes, and excluded directories such as `.git` and `node_modules`.
**Rationale:** Loop review proposal.

### 60. 2. Mirror Resource Bounds In Rendered Spec
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** The human-readable spec repeats the unbounded validation/copy requirements from `spec.json`, so reviewers and implementers may miss the bounded-resource requirement.
**Suggestion:** After updating `spec.json`, regenerate `spec.md` so the Constraints or Acceptance Criteria include the same explicit bounds.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** The human-readable spec repeats the unbounded validation/copy requirements from `spec.json`, so reviewers and implementers may miss the bounded-resource requirement.
**Suggestion:** After updating `spec.json`, regenerate `spec.md` so the Constraints or Acceptance Criteria include the same explicit bounds.
**Rationale:** Loop review proposal.

### 61. 3. Remove Empty Open Questions Placeholder
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** `## Open Questions` contains only `- [ ]`, which is dead placeholder content and can be mistaken for an unresolved required decision.
**Suggestion:** Replace it with `None.` or omit the section until an actual open question exists.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.md`
**Issue:** `## Open Questions` contains only `- [ ]`, which is dead placeholder content and can be mistaken for an unresolved required decision.
**Suggestion:** Replace it with `None.` or omit the section until an actual open question exists.
**Rationale:** Loop review proposal.

### 62. 1. Bound repository and manifest inspection
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md`  
**Issue:** The task asks tests to inspect real sibling repositories and verify every manifest contribution path, but does not specify limits on traversal depth, file count, manifest entry count, or copied artifact size. That leaves room for unbounded filesystem processing, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit bounds to the acceptance criteria or implementation notes, such as maximum manifest contribution entries, maximum traversal depth, and maximum copied file count/size for sibling artifact verification.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md`  
**Issue:** The task asks tests to inspect real sibling repositories and verify every manifest contribution path, but does not specify limits on traversal depth, file count, manifest entry count, or copied artifact size. That leaves room for unbounded filesystem processing, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit bounds to the acceptance criteria or implementation notes, such as maximum manifest contribution entries, maximum traversal depth, and maximum copied file count/size for sibling artifact verification.
**Rationale:** Loop review proposal.

### 63. 1. Bound repository and manifest inspection
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md`  
**Issue:** The task asks tests to inspect real sibling repositories and verify every manifest contribution path, but does not specify limits on traversal depth, file count, manifest entry count, or copied artifact size. That leaves room for unbounded filesystem processing, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit bounds to the acceptance criteria or implementation notes, such as maximum manifest contribution entries, maximum traversal depth, and maximum copied file count/size for sibling artifact verification.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md`  
**Issue:** The task asks tests to inspect real sibling repositories and verify every manifest contribution path, but does not specify limits on traversal depth, file count, manifest entry count, or copied artifact size. That leaves room for unbounded filesystem processing, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit bounds to the acceptance criteria or implementation notes, such as maximum manifest contribution entries, maximum traversal depth, and maximum copied file count/size for sibling artifact verification.
**Rationale:** Loop review proposal.

### 64. 1. Bound repository and manifest inspection
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md`  
**Issue:** The task asks tests to inspect real sibling repositories and verify every manifest contribution path, but does not specify limits on traversal depth, file count, manifest entry count, or copied artifact size. That leaves room for unbounded filesystem processing, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit bounds to the acceptance criteria or implementation notes, such as maximum manifest contribution entries, maximum traversal depth, and maximum copied file count/size for sibling artifact verification.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md`  
**Issue:** The task asks tests to inspect real sibling repositories and verify every manifest contribution path, but does not specify limits on traversal depth, file count, manifest entry count, or copied artifact size. That leaves room for unbounded filesystem processing, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit bounds to the acceptance criteria or implementation notes, such as maximum manifest contribution entries, maximum traversal depth, and maximum copied file count/size for sibling artifact verification.
**Rationale:** Loop review proposal.

### 65. 1. Bound repository and manifest inspection
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md`  
**Issue:** The task asks tests to inspect real sibling repositories and verify every manifest contribution path, but does not specify limits on traversal depth, file count, manifest entry count, or copied artifact size. That leaves room for unbounded filesystem processing, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit bounds to the acceptance criteria or implementation notes, such as maximum manifest contribution entries, maximum traversal depth, and maximum copied file count/size for sibling artifact verification.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tasks/T-4.md`  
**Issue:** The task asks tests to inspect real sibling repositories and verify every manifest contribution path, but does not specify limits on traversal depth, file count, manifest entry count, or copied artifact size. That leaves room for unbounded filesystem processing, which violates the bounded-resource-usage guardrail.  
**Suggestion:** Add explicit bounds to the acceptance criteria or implementation notes, such as maximum manifest contribution entries, maximum traversal depth, and maximum copied file count/size for sibling artifact verification.
**Rationale:** Loop review proposal.

### 66. 1. Consolidate duplicated review outputs
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/test-review.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.json`  
**Issue:** The diff shows two different new versions of the same artifact with conflicting verdicts, timestamps, counts, and findings.  
**Suggestion:** Regenerate or edit the artifact so only one canonical review result is committed, and keep it consistent with `test-review.md`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.json`  
**Issue:** The diff shows two different new versions of the same artifact with conflicting verdicts, timestamps, counts, and findings.  
**Suggestion:** Regenerate or edit the artifact so only one canonical review result is committed, and keep it consistent with `test-review.md`.
**Rationale:** Loop review proposal.

### 67. 2. Keep Markdown and JSON review artifacts consistent
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/test-review.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.md`  
**Issue:** The Markdown review output also appears in conflicting PASS/FAIL forms, mirroring `test-review.json`.  
**Suggestion:** Treat the Markdown as a render of the JSON artifact and regenerate it from the final JSON result to avoid stale or contradictory review summaries.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.md`  
**Issue:** The Markdown review output also appears in conflicting PASS/FAIL forms, mirroring `test-review.json`.  
**Suggestion:** Treat the Markdown as a render of the JSON artifact and regenerate it from the final JSON result to avoid stale or contradictory review summaries.
**Rationale:** Loop review proposal.

### 68. 3. Add explicit bounds around repository scans
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** `assertTrackedAtHead()` calls `git ls-files` and iterates every returned path without an explicit count or size bound. This violates the bounded-resource-usage guardrail for bulk data loading/processing.  
**Suggestion:** Add a maximum tracked file count per asserted contribution, or assert single-file vs directory expectations separately. For directory contributions, cap the number of `ls-files` entries processed and fail clearly if exceeded.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** `assertTrackedAtHead()` calls `git ls-files` and iterates every returned path without an explicit count or size bound. This violates the bounded-resource-usage guardrail for bulk data loading/processing.  
**Suggestion:** Add a maximum tracked file count per asserted contribution, or assert single-file vs directory expectations separately. For directory contributions, cap the number of `ls-files` entries processed and fail clearly if exceeded.
**Rationale:** Loop review proposal.

### 69. 4. Extract repeated manifest validation
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** The preset and workflow tests repeat the same manifest setup checks: clean repo, `plugin.json` existence, tracked-at-HEAD validation, JSON read, `manifest.files` validation, and `plugin.json` packaging.  
**Suggestion:** Introduce a helper such as `readCommittedPluginManifest(repo, expectedName, expectedType)` that performs the common checks and returns the parsed manifest.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** The preset and workflow tests repeat the same manifest setup checks: clean repo, `plugin.json` existence, tracked-at-HEAD validation, JSON read, `manifest.files` validation, and `plugin.json` packaging.  
**Suggestion:** Introduce a helper such as `readCommittedPluginManifest(repo, expectedName, expectedType)` that performs the common checks and returns the parsed manifest.
**Rationale:** Loop review proposal.

### 70. 5. Tighten path traversal validation
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** `assertInsideRepo()` rejects any path containing `".."`, which is simple but imprecise. It rejects harmless names containing that substring and still relies on string prefix checks afterward.  
**Suggestion:** Normalize path segments and reject only actual parent traversal segments, for example by checking `path.normalize(relPath).split(path.sep).includes("..")`, then keep the resolved-path containment assertion.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** `assertInsideRepo()` rejects any path containing `".."`, which is simple but imprecise. It rejects harmless names containing that substring and still relies on string prefix checks afterward.  
**Suggestion:** Normalize path segments and reject only actual parent traversal segments, for example by checking `path.normalize(relPath).split(path.sep).includes("..")`, then keep the resolved-path containment assertion.
**Rationale:** Loop review proposal.

### 71. 1. Consolidate duplicated review outputs
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/test-review.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.json`  
**Issue:** The diff shows two different new versions of the same artifact with conflicting verdicts, timestamps, counts, and findings.  
**Suggestion:** Regenerate or edit the artifact so only one canonical review result is committed, and keep it consistent with `test-review.md`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.json`  
**Issue:** The diff shows two different new versions of the same artifact with conflicting verdicts, timestamps, counts, and findings.  
**Suggestion:** Regenerate or edit the artifact so only one canonical review result is committed, and keep it consistent with `test-review.md`.
**Rationale:** Loop review proposal.

### 72. 2. Keep Markdown and JSON review artifacts consistent
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/test-review.md
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.md`  
**Issue:** The Markdown review output also appears in conflicting PASS/FAIL forms, mirroring `test-review.json`.  
**Suggestion:** Treat the Markdown as a render of the JSON artifact and regenerate it from the final JSON result to avoid stale or contradictory review summaries.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.md`  
**Issue:** The Markdown review output also appears in conflicting PASS/FAIL forms, mirroring `test-review.json`.  
**Suggestion:** Treat the Markdown as a render of the JSON artifact and regenerate it from the final JSON result to avoid stale or contradictory review summaries.
**Rationale:** Loop review proposal.

### 73. 3. Add explicit bounds around repository scans
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** `assertTrackedAtHead()` calls `git ls-files` and iterates every returned path without an explicit count or size bound. This violates the bounded-resource-usage guardrail for bulk data loading/processing.  
**Suggestion:** Add a maximum tracked file count per asserted contribution, or assert single-file vs directory expectations separately. For directory contributions, cap the number of `ls-files` entries processed and fail clearly if exceeded.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** `assertTrackedAtHead()` calls `git ls-files` and iterates every returned path without an explicit count or size bound. This violates the bounded-resource-usage guardrail for bulk data loading/processing.  
**Suggestion:** Add a maximum tracked file count per asserted contribution, or assert single-file vs directory expectations separately. For directory contributions, cap the number of `ls-files` entries processed and fail clearly if exceeded.
**Rationale:** Loop review proposal.

### 74. 4. Extract repeated manifest validation
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** The preset and workflow tests repeat the same manifest setup checks: clean repo, `plugin.json` existence, tracked-at-HEAD validation, JSON read, `manifest.files` validation, and `plugin.json` packaging.  
**Suggestion:** Introduce a helper such as `readCommittedPluginManifest(repo, expectedName, expectedType)` that performs the common checks and returns the parsed manifest.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** The preset and workflow tests repeat the same manifest setup checks: clean repo, `plugin.json` existence, tracked-at-HEAD validation, JSON read, `manifest.files` validation, and `plugin.json` packaging.  
**Suggestion:** Introduce a helper such as `readCommittedPluginManifest(repo, expectedName, expectedType)` that performs the common checks and returns the parsed manifest.
**Rationale:** Loop review proposal.

### 75. 5. Tighten path traversal validation
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** `assertInsideRepo()` rejects any path containing `".."`, which is simple but imprecise. It rejects harmless names containing that substring and still relies on string prefix checks afterward.  
**Suggestion:** Normalize path segments and reject only actual parent traversal segments, for example by checking `path.normalize(relPath).split(path.sep).includes("..")`, then keep the resolved-path containment assertion.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-artifacts.test.js`  
**Issue:** `assertInsideRepo()` rejects any path containing `".."`, which is simple but imprecise. It rejects harmless names containing that substring and still relies on string prefix checks afterward.  
**Suggestion:** Normalize path segments and reject only actual parent traversal segments, for example by checking `path.normalize(relPath).split(path.sep).includes("..")`, then keep the resolved-path containment assertion.
**Rationale:** Loop review proposal.

### 76. 3. Deduplicate fixture manifest builders
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-behavior.test.js
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-behavior.test.js`  
**Issue:** Preset and workflow plugin manifests are repeated across minimal, broken, and non-Git fixture setup. This makes the tests longer and increases the chance of inconsistent fixture updates.  
**Suggestion:** Add small helpers such as `presetManifest()` and `workflowManifest()` and reuse them in `writeMinimalPresetPlugin`, `writeBrokenPresetPlugin`, `writeMinimalWorkflowPlugin`, and inline non-Git setup.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-behavior.test.js`  
**Issue:** Preset and workflow plugin manifests are repeated across minimal, broken, and non-Git fixture setup. This makes the tests longer and increases the chance of inconsistent fixture updates.  
**Suggestion:** Add small helpers such as `presetManifest()` and `workflowManifest()` and reuse them in `writeMinimalPresetPlugin`, `writeBrokenPresetPlugin`, `writeMinimalWorkflowPlugin`, and inline non-Git setup.
**Rationale:** Loop review proposal.

### 77. 4. Consolidate Git repository setup
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-behavior.test.js
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-behavior.test.js`  
**Issue:** `commitAll`, `commitEmptyRepo`, and `initRepoWithoutHead` repeat `git init` plus user config setup.  
**Suggestion:** Extract `initGitRepo(repo)` that initializes and configures the repo, then layer commit-specific behavior on top.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/official-sibling-behavior.test.js`  
**Issue:** `commitAll`, `commitEmptyRepo`, and `initRepoWithoutHead` repeat `git init` plus user config setup.  
**Suggestion:** Extract `initGitRepo(repo)` that initializes and configures the repo, then layer commit-specific behavior on top.
**Rationale:** Loop review proposal.

### 78. 1. Centralize preset fallback resolution
**Failure mode:** refactor
**File:** src/docs/commands/scan.js
**Issue:** **File:** `src/docs/commands/scan.js`  
**Issue:** `resolveScanChains()` duplicates the same `Preset not found` fallback logic added in `src/docs/lib/resolver-factory.js`, making future behavior changes easy to miss in one path.  
**Suggestion:** Extract a shared helper, e.g. `resolveMultiChainsWithFallback(types, root)`, and have both scan and resolver creation call it.
**Suggestion:** **File:** `src/docs/commands/scan.js`  
**Issue:** `resolveScanChains()` duplicates the same `Preset not found` fallback logic added in `src/docs/lib/resolver-factory.js`, making future behavior changes easy to miss in one path.  
**Suggestion:** Extract a shared helper, e.g. `resolveMultiChainsWithFallback(types, root)`, and have both scan and resolver creation call it.
**Rationale:** Loop review proposal.

### 79. 2. Avoid matching errors by message text
**Failure mode:** refactor
**File:** src/docs/lib/resolver-factory.js
**Issue:** **File:** `src/docs/lib/resolver-factory.js`  
**Issue:** The fallback depends on `/Preset not found:/` against `err.message`, which is brittle and can accidentally catch unrelated errors with similar text.  
**Suggestion:** Prefer a typed error/code from preset resolution if available. If not, wrap this check in a named predicate like `isPresetNotFoundError(err)` so the coupling is explicit and reused consistently.
**Suggestion:** **File:** `src/docs/lib/resolver-factory.js`  
**Issue:** The fallback depends on `/Preset not found:/` against `err.message`, which is brittle and can accidentally catch unrelated errors with similar text.  
**Suggestion:** Prefer a typed error/code from preset resolution if available. If not, wrap this check in a named predicate like `isPresetNotFoundError(err)` so the coupling is explicit and reused consistently.
**Rationale:** Loop review proposal.

### 80. 5. Clarify sibling root search intent
**Failure mode:** refactor
**File:** src/lib/official-plugins.js
**Issue:** **File:** `src/lib/official-plugins.js`  
**Issue:** `findSiblingPluginRoot()` walks upward from `PKG_DIR` looking for a sibling directory, but the function name does not make the upward search behavior obvious.  
**Suggestion:** Rename it to something more explicit, such as `findNearestAncestorSiblingPluginRoot()` or `findPluginSiblingFromPackageAncestors()`, to make the discovery strategy clear.
**Suggestion:** **File:** `src/lib/official-plugins.js`  
**Issue:** `findSiblingPluginRoot()` walks upward from `PKG_DIR` looking for a sibling directory, but the function name does not make the upward search behavior obvious.  
**Suggestion:** Rename it to something more explicit, such as `findNearestAncestorSiblingPluginRoot()` or `findPluginSiblingFromPackageAncestors()`, to make the discovery strategy clear.
**Rationale:** Loop review proposal.

### 81. I’ll inspect the touched files around these hunks so the proposals are grounded in the existing code shape, not only the excerpted diff.The provided cwd is an empty or staging `.tmp` directory rather than the repository root. I’m going to locate the checkout under the allowed workspace path before reviewing.The repository root is the parent of `.tmp`; I found the touched files there and am reading only those files plus nearby symbols needed to assess the diff.I’ve got enough context for the touched files. I’m checking for local duplication and consistency issues now, including the bounded-resource guardrail where the new paths read or traverse data.One pattern stands out: preset resolution calls `allPresets(projectRoot)` repeatedly, and the new implementation adds config parsing and plugin registry loading to each call. I’m reading the resolver section to see whether that should be a targeted refactor proposal.I also checked the manifest entries. I’m going to keep the final list scoped to concrete improvements in the diff files, including one guardrail proposal where the new official install path exercises unbounded package traversal.### 1. Add explicit package traversal bounds
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Issue:** `ensureOfficialPackage()` now installs via `installFromSource()`, which archives, extracts, recursively walks, validates, and copies package files without explicit file count, depth, or extracted-size limits. This violates `bounded-resource-usage`.  
**Suggestion:** Add shared limits such as `MAX_PLUGIN_FILES`, `MAX_PLUGIN_DEPTH`, and `MAX_PLUGIN_BYTES`, enforce them in `walkFiles()`, `validateSourceTree()`, `copyAllowlistedFiles()`, and after archive extraction.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Issue:** `ensureOfficialPackage()` now installs via `installFromSource()`, which archives, extracts, recursively walks, validates, and copies package files without explicit file count, depth, or extracted-size limits. This violates `bounded-resource-usage`.  
**Suggestion:** Add shared limits such as `MAX_PLUGIN_FILES`, `MAX_PLUGIN_DEPTH`, and `MAX_PLUGIN_BYTES`, enforce them in `walkFiles()`, `validateSourceTree()`, `copyAllowlistedFiles()`, and after archive extraction.
**Rationale:** Loop review proposal.

### 82. 2. Reuse discovered core presets
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`  
**Issue:** `discoverPresets()` calls `discoverPresetsInDir(CORE_PRESETS_DIR)`, and `CORE_PRESETS` repeats the same scan immediately after.  
**Suggestion:** Initialize `CORE_PRESETS` once and build `PRESETS` from that array, avoiding duplicate filesystem reads at module load.
**Suggestion:** **File:** `src/lib/presets.js`  
**Issue:** `discoverPresets()` calls `discoverPresetsInDir(CORE_PRESETS_DIR)`, and `CORE_PRESETS` repeats the same scan immediately after.  
**Suggestion:** Initialize `CORE_PRESETS` once and build `PRESETS` from that array, avoiding duplicate filesystem reads at module load.
**Rationale:** Loop review proposal.

### 83. 3. Cache merged preset lookup per resolution
**Failure mode:** refactor
**File:** src/lib/presets.js
**Issue:** **File:** `src/lib/presets.js`  
**Issue:** `allPresets(projectRoot)` now reads config and loads the plugin registry, but callers like `resolveChain()` invoke it repeatedly inside parent-chain loops.  
**Suggestion:** Build a preset `Map` once per resolver call, then reuse it for leaf and parent lookups. This simplifies the code and avoids repeated registry/config work.
**Suggestion:** **File:** `src/lib/presets.js`  
**Issue:** `allPresets(projectRoot)` now reads config and loads the plugin registry, but callers like `resolveChain()` invoke it repeatedly inside parent-chain loops.  
**Suggestion:** Build a preset `Map` once per resolver call, then reuse it for leaf and parent lookups. This simplifies the code and avoids repeated registry/config work.
**Rationale:** Loop review proposal.

### 84. 4. Remove duplicated preset parent metadata
**Failure mode:** refactor
**File:** src/official-plugins/senti-presets/plugin.json
**Issue:** **File:** `src/official-plugins/senti-presets/plugin.json`  
**Issue:** The manifest repeats `parent` values already present in each preset’s `preset.json`; the diff updates both sources of truth.  
**Suggestion:** Omit `parent` from plugin contributions when the preset directory has `preset.json`, and rely on `PluginManifest.presetEntries()` fallback to `presetManifest.parent`.
**Suggestion:** **File:** `src/official-plugins/senti-presets/plugin.json`  
**Issue:** The manifest repeats `parent` values already present in each preset’s `preset.json`; the diff updates both sources of truth.  
**Suggestion:** Omit `parent` from plugin contributions when the preset directory has `preset.json`, and rely on `PluginManifest.presetEntries()` fallback to `presetManifest.parent`.
**Rationale:** Loop review proposal.

### 85. 5. Clarify plugin command root naming
**Failure mode:** refactor
**File:** src/official-plugins/senti-workflow-plugin/commands/workflow.js
**Issue:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** `packageRoot` can come from `ctx.packageRoot`, `SENTI_PACKAGE_ROOT`, `ctx.sourceRoot`, or `SENTI_SOURCE_ROOT`, which makes the command contract hard to reason about.  
**Suggestion:** Prefer a single explicit input, `ctx.packageRoot`, and keep environment fallback handling in the dispatcher if compatibility is required.
**Suggestion:** **File:** `src/official-plugins/senti-workflow-plugin/commands/workflow.js`  
**Issue:** `packageRoot` can come from `ctx.packageRoot`, `SENTI_PACKAGE_ROOT`, `ctx.sourceRoot`, or `SENTI_SOURCE_ROOT`, which makes the command contract hard to reason about.  
**Suggestion:** Prefer a single explicit input, `ctx.packageRoot`, and keep environment fallback handling in the dispatcher if compatibility is required.
**Rationale:** Loop review proposal.

### 86. 1. De-duplicate Evidence Metadata
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/scenario-validity-result.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/scenario-validity-result.json`  
**Issue:** Each summary entry repeats the same `command` value even though the file already has a top-level `command`. Each entry also points to the full raw log range `1..503`, which makes the evidence less precise.  
**Suggestion:** Rely on the top-level `command`, remove duplicated per-entry `evidence.command` if the schema allows it, and record narrower `raw_output_lines` ranges for each specific failing test.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/scenario-validity-result.json`  
**Issue:** Each summary entry repeats the same `command` value even though the file already has a top-level `command`. Each entry also points to the full raw log range `1..503`, which makes the evidence less precise.  
**Suggestion:** Rely on the top-level `command`, remove duplicated per-entry `evidence.command` if the schema allows it, and record narrower `raw_output_lines` ranges for each specific failing test.
**Rationale:** Loop review proposal.

### 87. 2. Bound And Normalize Raw Output
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/tests/.raw/scenario-validity.log
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/.raw/scenario-validity.log`  
**Issue:** The committed raw log is a large full TAP dump with repeated absolute machine-local paths. This is noisy, not portable, and can grow without an obvious bound as more failures are added.  
**Suggestion:** Store a bounded, normalized excerpt per failing requirement instead of the entire raw run, or redact the workspace prefix to a stable placeholder such as `<workspace>`. This also better satisfies the bounded-resource-usage guardrail for generated evidence artifacts.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/tests/.raw/scenario-validity.log`  
**Issue:** The committed raw log is a large full TAP dump with repeated absolute machine-local paths. This is noisy, not portable, and can grow without an obvious bound as more failures are added.  
**Suggestion:** Store a bounded, normalized excerpt per failing requirement instead of the entire raw run, or redact the workspace prefix to a stable placeholder such as `<workspace>`. This also better satisfies the bounded-resource-usage guardrail for generated evidence artifacts.
**Rationale:** Loop review proposal.

### 88. 1. Standardize Draft Artifact Metadata
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** `draft-questions-triage.json` and `draft-questions-repair.json` omit `generatedAt`, while sibling draft coverage artifacts include it.
**Suggestion:** Add `generatedAt` to both question artifacts using the same timestamp format as the coverage artifacts.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** `draft-questions-triage.json` and `draft-questions-repair.json` omit `generatedAt`, while sibling draft coverage artifacts include it.
**Suggestion:** Add `generatedAt` to both question artifacts using the same timestamp format as the coverage artifacts.
**Rationale:** Loop review proposal.

### 89. 2. Remove Repeated Embedded Item Ordinals
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** Both question triage and repair artifacts use `"title": "1. Empty Initial QA List"`, duplicating ordering inside item content.
**Suggestion:** Use `"Empty Initial QA List"` in both files and let array order provide sequencing.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/draft-questions-triage.json`
**Issue:** Both question triage and repair artifacts use `"title": "1. Empty Initial QA List"`, duplicating ordering inside item content.
**Suggestion:** Use `"Empty Initial QA List"` in both files and let array order provide sequencing.
**Rationale:** Loop review proposal.

### 90. 3. Consolidate Recovery Records
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/issue-log.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`
**Issue:** Retry recovery details are duplicated across `issue-log.json`, `retry-recovery.json`, and `flow.json` runtime state, creating drift risk.
**Suggestion:** Keep full recovery payloads in `retry-recovery.json`; store only compact references in `issue-log.json` and durable workflow state in `flow.json`.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/issue-log.json`
**Issue:** Retry recovery details are duplicated across `issue-log.json`, `retry-recovery.json`, and `flow.json` runtime state, creating drift risk.
**Suggestion:** Keep full recovery payloads in `retry-recovery.json`; store only compact references in `issue-log.json` and durable workflow state in `flow.json`.
**Rationale:** Loop review proposal.

### 91. 4. Use One Canonical Finding Shape
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/spec-attempt-001.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/spec-attempt-001.json`
**Issue:** Many review artifacts duplicate findings across `blockingFindings` / `advisoryFindings` and generic `findings`, sometimes with different fields or reduced body text.
**Suggestion:** Define one canonical findings array and derive grouped views, counts, Markdown output, and repair targets from it.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/spec-attempt-001.json`
**Issue:** Many review artifacts duplicate findings across `blockingFindings` / `advisoryFindings` and generic `findings`, sometimes with different fields or reduced body text.
**Suggestion:** Define one canonical findings array and derive grouped views, counts, Markdown output, and repair targets from it.
**Rationale:** Loop review proposal.

### 92. 5. Standardize Finding Severity Terms
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-004.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-004.json`
**Issue:** Review artifacts mix terms like `advisory`, `non-blocking`, `blocking`, and ids containing `blocking` even when verdicts are advisory.
**Suggestion:** Adopt one severity taxonomy across all review JSON files, preferably `blocking` and `advisory`, and regenerate derived fields/ids consistently.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/review-history/test-attempt-004.json`
**Issue:** Review artifacts mix terms like `advisory`, `non-blocking`, `blocking`, and ids containing `blocking` even when verdicts are advisory.
**Suggestion:** Adopt one severity taxonomy across all review JSON files, preferably `blocking` and `advisory`, and regenerate derived fields/ids consistently.
**Rationale:** Loop review proposal.

### 93. 6. Align Resource Bounds Across Spec, Tasks, Tests, And Implementation
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/spec.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.json`
**Issue:** The bounded-resource requirement appears in proposals for `spec.json`, `spec.md`, `T-4.md`, tests, and `src/lib/plugin-registry.js`, but the limits are not defined consistently across layers.
**Suggestion:** Define concrete shared limits once, then mirror them in the rendered spec, task acceptance criteria, tests, and implementation constants.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/spec.json`
**Issue:** The bounded-resource requirement appears in proposals for `spec.json`, `spec.md`, `T-4.md`, tests, and `src/lib/plugin-registry.js`, but the limits are not defined consistently across layers.
**Suggestion:** Define concrete shared limits once, then mirror them in the rendered spec, task acceptance criteria, tests, and implementation constants.
**Rationale:** Loop review proposal.

### 94. 7. Keep JSON And Markdown Review Outputs In Sync
**Failure mode:** refactor
**File:** specs/285-fix-371-plugin-sibling-repos/test-review.json
**Issue:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.json`
**Issue:** `test-review.json` and `test-review.md` appear to have conflicting PASS/FAIL versions, making the rendered Markdown inconsistent with the machine-readable artifact.
**Suggestion:** Treat Markdown as generated output from the final JSON review result and regenerate both from one canonical source.
**Suggestion:** **File:** `specs/285-fix-371-plugin-sibling-repos/test-review.json`
**Issue:** `test-review.json` and `test-review.md` appear to have conflicting PASS/FAIL versions, making the rendered Markdown inconsistent with the machine-readable artifact.
**Suggestion:** Treat Markdown as generated output from the final JSON review result and regenerate both from one canonical source.
**Rationale:** Loop review proposal.

### 95. 8. Centralize Preset Fallback Resolution
**Failure mode:** refactor
**File:** src/docs/commands/scan.js
**Issue:** **File:** `src/docs/commands/scan.js`
**Issue:** Preset fallback logic is duplicated between `scan.js` and `src/docs/lib/resolver-factory.js`, including brittle matching of `"Preset not found"` message text.
**Suggestion:** Extract a shared resolver helper or typed predicate such as `isPresetNotFoundError(err)` and use it in both call paths.
**Suggestion:** **File:** `src/docs/commands/scan.js`
**Issue:** Preset fallback logic is duplicated between `scan.js` and `src/docs/lib/resolver-factory.js`, including brittle matching of `"Preset not found"` message text.
**Suggestion:** Extract a shared resolver helper or typed predicate such as `isPresetNotFoundError(err)` and use it in both call paths.
**Rationale:** Loop review proposal.

### 96. 9. Avoid Duplicate Preset Parent Sources
**Failure mode:** refactor
**File:** src/official-plugins/senti-presets/plugin.json
**Issue:** **File:** `src/official-plugins/senti-presets/plugin.json`
**Issue:** Preset parent metadata is duplicated between plugin contribution entries and each preset’s own `preset.json`.
**Suggestion:** Keep parent relationships in `preset.json` only, and let plugin manifest loading fall back to that source.
**Suggestion:** **File:** `src/official-plugins/senti-presets/plugin.json`
**Issue:** Preset parent metadata is duplicated between plugin contribution entries and each preset’s own `preset.json`.
**Suggestion:** Keep parent relationships in `preset.json` only, and let plugin manifest loading fall back to that source.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
