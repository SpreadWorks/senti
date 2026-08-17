# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Remove duplicated violation payload
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-gate-source.json
**Requirement:** R4
**Issue:** **File:** `specs/319-requirement-gate-context/draft-gate-source.json`  
**Requirement:** R4  
**Issue:** The same violation is represented twice: once under `evaluations[0].observations[0]` and again under the top-level `observations[0]`. This duplicates a long `observed` message and increases the chance of the two copies drifting.  
**Suggestion:** Keep the detailed observation in one place and have the other location reference it by stable identifier, or derive the top-level `observations` list from `evaluations[*].observations` during generation instead of storing both copies.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-gate-source.json`  
**Requirement:** R4  
**Issue:** The same violation is represented twice: once under `evaluations[0].observations[0]` and again under the top-level `observations[0]`. This duplicates a long `observed` message and increases the chance of the two copies drifting.  
**Suggestion:** Keep the detailed observation in one place and have the other location reference it by stable identifier, or derive the top-level `observations` list from `evaluations[*].observations` during generation instead of storing both copies.
**Rationale:** Loop review proposal.

### 2. 1. Remove duplicated violation payload
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-gate-source.json
**Requirement:** R4
**Issue:** **File:** `specs/319-requirement-gate-context/draft-gate-source.json`  
**Requirement:** R4  
**Issue:** The same violation is represented twice: once under `evaluations[0].observations[0]` and again under the top-level `observations[0]`. This duplicates a long `observed` message and increases the chance of the two copies drifting.  
**Suggestion:** Keep the detailed observation in one place and have the other location reference it by stable identifier, or derive the top-level `observations` list from `evaluations[*].observations` during generation instead of storing both copies.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-gate-source.json`  
**Requirement:** R4  
**Issue:** The same violation is represented twice: once under `evaluations[0].observations[0]` and again under the top-level `observations[0]`. This duplicates a long `observed` message and increases the chance of the two copies drifting.  
**Suggestion:** Keep the detailed observation in one place and have the other location reference it by stable identifier, or derive the top-level `observations` list from `evaluations[*].observations` during generation instead of storing both copies.
**Rationale:** Loop review proposal.

### 3. 1. Remove duplicated violation payload
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-gate-source.json
**Requirement:** R4
**Issue:** **File:** `specs/319-requirement-gate-context/draft-gate-source.json`  
**Requirement:** R4  
**Issue:** The same violation is represented twice: once under `evaluations[0].observations[0]` and again under the top-level `observations[0]`. This duplicates a long `observed` message and increases the chance of the two copies drifting.  
**Suggestion:** Keep the detailed observation in one place and have the other location reference it by stable identifier, or derive the top-level `observations` list from `evaluations[*].observations` during generation instead of storing both copies.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-gate-source.json`  
**Requirement:** R4  
**Issue:** The same violation is represented twice: once under `evaluations[0].observations[0]` and again under the top-level `observations[0]`. This duplicates a long `observed` message and increases the chance of the two copies drifting.  
**Suggestion:** Keep the detailed observation in one place and have the other location reference it by stable identifier, or derive the top-level `observations` list from `evaluations[*].observations` during generation instead of storing both copies.
**Rationale:** Loop review proposal.

### 4. 1. Remove duplicated violation payload
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-gate-source.json
**Requirement:** R4
**Issue:** **File:** `specs/319-requirement-gate-context/draft-gate-source.json`  
**Requirement:** R4  
**Issue:** The same violation is represented twice: once under `evaluations[0].observations[0]` and again under the top-level `observations[0]`. This duplicates a long `observed` message and increases the chance of the two copies drifting.  
**Suggestion:** Keep the detailed observation in one place and have the other location reference it by stable identifier, or derive the top-level `observations` list from `evaluations[*].observations` during generation instead of storing both copies.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-gate-source.json`  
**Requirement:** R4  
**Issue:** The same violation is represented twice: once under `evaluations[0].observations[0]` and again under the top-level `observations[0]`. This duplicates a long `observed` message and increases the chance of the two copies drifting.  
**Suggestion:** Keep the detailed observation in one place and have the other location reference it by stable identifier, or derive the top-level `observations` list from `evaluations[*].observations` during generation instead of storing both copies.
**Rationale:** Loop review proposal.

### 5. 1. Remove Regeneration-Volatile Timestamps
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-review-questions.json
**Requirement:** R8
**Issue:** **File:** `specs/319-requirement-gate-context/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** `generatedAt` embeds a run-specific timestamp in a generated artifact. That makes otherwise identical regenerated review output byte-different, which conflicts with the draft’s deterministic byte-equality and cache-identity goals.  
**Suggestion:** Omit `generatedAt` from generated review artifacts, or replace it with a stable value derived from the reviewed draft/version.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** `generatedAt` embeds a run-specific timestamp in a generated artifact. That makes otherwise identical regenerated review output byte-different, which conflicts with the draft’s deterministic byte-equality and cache-identity goals.  
**Suggestion:** Omit `generatedAt` from generated review artifacts, or replace it with a stable value derived from the reviewed draft/version.
**Rationale:** Loop review proposal.

### 6. 2. Avoid Duplicated Empty Review Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-review-coverage.json
**Requirement:** R8
**Issue:** **File:** `specs/319-requirement-gate-context/draft-review-coverage.json`  
**Requirement:** R8  
**Issue:** `draft-review-coverage.json` and `draft-review-questions.json` duplicate the same empty PASS structure, summary, and arrays, differing only by phase/source metadata. This creates extra committed artifacts with no additional review signal.  
**Suggestion:** If the pipeline allows it, collapse empty PASS outputs into a single shared review result shape, or omit phase-specific files when there are no findings and record the successful phase status in one canonical artifact.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-review-coverage.json`  
**Requirement:** R8  
**Issue:** `draft-review-coverage.json` and `draft-review-questions.json` duplicate the same empty PASS structure, summary, and arrays, differing only by phase/source metadata. This creates extra committed artifacts with no additional review signal.  
**Suggestion:** If the pipeline allows it, collapse empty PASS outputs into a single shared review result shape, or omit phase-specific files when there are no findings and record the successful phase status in one canonical artifact.
**Rationale:** Loop review proposal.

### 7. 2. Avoid Duplicated Empty Review Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-review-coverage.json
**Requirement:** R8
**Issue:** **File:** `specs/319-requirement-gate-context/draft-review-coverage.json`  
**Requirement:** R8  
**Issue:** `draft-review-coverage.json` and `draft-review-questions.json` duplicate the same empty PASS structure, summary, and arrays, differing only by phase/source metadata. This creates extra committed artifacts with no additional review signal.  
**Suggestion:** If the pipeline allows it, collapse empty PASS outputs into a single shared review result shape, or omit phase-specific files when there are no findings and record the successful phase status in one canonical artifact.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-review-coverage.json`  
**Requirement:** R8  
**Issue:** `draft-review-coverage.json` and `draft-review-questions.json` duplicate the same empty PASS structure, summary, and arrays, differing only by phase/source metadata. This creates extra committed artifacts with no additional review signal.  
**Suggestion:** If the pipeline allows it, collapse empty PASS outputs into a single shared review result shape, or omit phase-specific files when there are no findings and record the successful phase status in one canonical artifact.
**Rationale:** Loop review proposal.

### 8. 1. Remove Regeneration-Volatile Timestamps
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-review-questions.json
**Requirement:** R8
**Issue:** **File:** `specs/319-requirement-gate-context/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** `generatedAt` embeds a run-specific timestamp in a generated artifact. That makes otherwise identical regenerated review output byte-different, which conflicts with the draft’s deterministic byte-equality and cache-identity goals.  
**Suggestion:** Omit `generatedAt` from generated review artifacts, or replace it with a stable value derived from the reviewed draft/version.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** `generatedAt` embeds a run-specific timestamp in a generated artifact. That makes otherwise identical regenerated review output byte-different, which conflicts with the draft’s deterministic byte-equality and cache-identity goals.  
**Suggestion:** Omit `generatedAt` from generated review artifacts, or replace it with a stable value derived from the reviewed draft/version.
**Rationale:** Loop review proposal.

### 9. 1. Remove Regeneration-Volatile Timestamps
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-review-questions.json
**Requirement:** R8
**Issue:** **File:** `specs/319-requirement-gate-context/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** `generatedAt` embeds a run-specific timestamp in a generated artifact. That makes otherwise identical regenerated review output byte-different, which conflicts with the draft’s deterministic byte-equality and cache-identity goals.  
**Suggestion:** Omit `generatedAt` from generated review artifacts, or replace it with a stable value derived from the reviewed draft/version.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** `generatedAt` embeds a run-specific timestamp in a generated artifact. That makes otherwise identical regenerated review output byte-different, which conflicts with the draft’s deterministic byte-equality and cache-identity goals.  
**Suggestion:** Omit `generatedAt` from generated review artifacts, or replace it with a stable value derived from the reviewed draft/version.
**Rationale:** Loop review proposal.

### 10. 2. Avoid Duplicated Empty Review Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/draft-review-coverage.json
**Requirement:** R8
**Issue:** **File:** `specs/319-requirement-gate-context/draft-review-coverage.json`  
**Requirement:** R8  
**Issue:** `draft-review-coverage.json` and `draft-review-questions.json` duplicate the same empty PASS structure, summary, and arrays, differing only by phase/source metadata. This creates extra committed artifacts with no additional review signal.  
**Suggestion:** If the pipeline allows it, collapse empty PASS outputs into a single shared review result shape, or omit phase-specific files when there are no findings and record the successful phase status in one canonical artifact.
**Suggestion:** **File:** `specs/319-requirement-gate-context/draft-review-coverage.json`  
**Requirement:** R8  
**Issue:** `draft-review-coverage.json` and `draft-review-questions.json` duplicate the same empty PASS structure, summary, and arrays, differing only by phase/source metadata. This creates extra committed artifacts with no additional review signal.  
**Suggestion:** If the pipeline allows it, collapse empty PASS outputs into a single shared review result shape, or omit phase-specific files when there are no findings and record the successful phase status in one canonical artifact.
**Rationale:** Loop review proposal.

### 11. 1. Deduplicate Repeated Requirement File Lists
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/file-map.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/file-map.json`  
**Requirement:** R9  
**Issue:** Most requirement entries repeat identical or near-identical path arrays, which makes the ownership map harder to maintain and increases the chance of accidental drift between requirements.  
**Suggestion:** If the consuming schema allows it, introduce shared groups such as `unitContextRequirements`, `e2eContextRequirements`, or a `defaults`/`overrides` structure. If the schema requires the current expanded shape, generate this file from a compact source to avoid hand-maintaining duplicate arrays.
**Suggestion:** **File:** `specs/319-requirement-gate-context/file-map.json`  
**Requirement:** R9  
**Issue:** Most requirement entries repeat identical or near-identical path arrays, which makes the ownership map harder to maintain and increases the chance of accidental drift between requirements.  
**Suggestion:** If the consuming schema allows it, introduce shared groups such as `unitContextRequirements`, `e2eContextRequirements`, or a `defaults`/`overrides` structure. If the schema requires the current expanded shape, generate this file from a compact source to avoid hand-maintaining duplicate arrays.
**Rationale:** Loop review proposal.

### 12. 4. Normalize Deferred Finding Entries
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/flow-findings.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/flow-findings.json`  
**Requirement:** R10  
**Issue:** The three deferred finding entries duplicate every field except IDs. This repetition makes future updates noisy and risks inconsistent retry metadata across equivalent findings.  
**Suggestion:** If supported by the artifact schema, represent common fields once at the collection level, or generate these entries from a compact list of `sourceFindingId` values plus shared retry/disposition metadata.
**Suggestion:** **File:** `specs/319-requirement-gate-context/flow-findings.json`  
**Requirement:** R10  
**Issue:** The three deferred finding entries duplicate every field except IDs. This repetition makes future updates noisy and risks inconsistent retry metadata across equivalent findings.  
**Suggestion:** If supported by the artifact schema, represent common fields once at the collection level, or generate these entries from a compact list of `sourceFindingId` values plus shared retry/disposition metadata.
**Rationale:** Loop review proposal.

### 13. 2. Remove Stale Runtime Logs From Pending Steps
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/flow.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/flow.json`  
**Requirement:** R11  
**Issue:** Several steps have `"status": "pending"` while also carrying completed `runtimeLog` entries with `endedAt` and `exitCode: 0`, for example `impl-gate`, `retro`, and `acceptance-review`. That mixes historical execution data with current pending state and makes the flow state harder to reason about.  
**Suggestion:** Either clear `runtimeLog` when a step is reset to `pending`, or move prior executions into `stepAttempts`/history-only storage so the active step object represents only the current state.
**Suggestion:** **File:** `specs/319-requirement-gate-context/flow.json`  
**Requirement:** R11  
**Issue:** Several steps have `"status": "pending"` while also carrying completed `runtimeLog` entries with `endedAt` and `exitCode: 0`, for example `impl-gate`, `retro`, and `acceptance-review`. That mixes historical execution data with current pending state and makes the flow state harder to reason about.  
**Suggestion:** Either clear `runtimeLog` when a step is reset to `pending`, or move prior executions into `stepAttempts`/history-only storage so the active step object represents only the current state.
**Rationale:** Loop review proposal.

### 14. 3. Bound Flow History Growth
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/319-requirement-gate-context/flow.json`  
**Requirement:** R3  
**Issue:** The `metrics`, `notes`, `stepAttempts`, and `reviewRecoveryBaselines` arrays can grow without an explicit visible cap in this persisted artifact. That conflicts with the bounded-resource-usage guardrail when flow state is repeatedly retried or resumed.  
**Suggestion:** Add or document explicit retention bounds for persisted history, such as max entries per array, max serialized bytes, or deterministic compaction/truncation rules.
**Suggestion:** **File:** `specs/319-requirement-gate-context/flow.json`  
**Requirement:** R3  
**Issue:** The `metrics`, `notes`, `stepAttempts`, and `reviewRecoveryBaselines` arrays can grow without an explicit visible cap in this persisted artifact. That conflicts with the bounded-resource-usage guardrail when flow state is repeatedly retried or resumed.  
**Suggestion:** Add or document explicit retention bounds for persisted history, such as max entries per array, max serialized bytes, or deterministic compaction/truncation rules.
**Rationale:** Loop review proposal.

### 15. 5. Reduce Issue Log Duplication
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/issue-log.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/issue-log.json`  
**Requirement:** R11  
**Issue:** Several entries duplicate the same finding text across `reason`, `observations[*].observed`, and `failedEvaluations[*].reason`. This inflates the artifact and makes corrections require editing the same semantic content in multiple places.  
**Suggestion:** Store detailed findings once, then reference them from summary fields by ID. Keep `reason` as a short summary instead of concatenating every detailed violation string.
**Suggestion:** **File:** `specs/319-requirement-gate-context/issue-log.json`  
**Requirement:** R11  
**Issue:** Several entries duplicate the same finding text across `reason`, `observations[*].observed`, and `failedEvaluations[*].reason`. This inflates the artifact and makes corrections require editing the same semantic content in multiple places.  
**Suggestion:** Store detailed findings once, then reference them from summary fields by ID. Keep `reason` as a short summary instead of concatenating every detailed violation string.
**Rationale:** Loop review proposal.

### 16. 1. Remove duplicated issue body in localized details
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/issue.md
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/issue.md`  
**Requirement:** R2  
**Issue:** The `<details><summary>ja</summary>` section repeats the full English issue text almost verbatim instead of providing distinct Japanese content. This doubles maintenance surface and makes future edits easy to apply inconsistently.  
**Suggestion:** Either replace the section with an actual Japanese translation, or remove it and keep a single authoritative issue body.
**Suggestion:** **File:** `specs/319-requirement-gate-context/issue.md`  
**Requirement:** R2  
**Issue:** The `<details><summary>ja</summary>` section repeats the full English issue text almost verbatim instead of providing distinct Japanese content. This doubles maintenance surface and makes future edits easy to apply inconsistently.  
**Suggestion:** Either replace the section with an actual Japanese translation, or remove it and keep a single authoritative issue body.
**Rationale:** Loop review proposal.

### 17. 2. Avoid duplicated issue identifiers in prepare artifact
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/plugin-artifacts/workflow/prepare.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R2  
**Issue:** The artifact stores the same issue number in both `issue` and `result.issueNumber`. If one value changes and the other does not, downstream consumers may see conflicting ownership metadata.  
**Suggestion:** Prefer a single canonical issue field, or document why both are required by the workflow contract and add validation that they must match.
**Suggestion:** **File:** `specs/319-requirement-gate-context/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R2  
**Issue:** The artifact stores the same issue number in both `issue` and `result.issueNumber`. If one value changes and the other does not, downstream consumers may see conflicting ownership metadata.  
**Suggestion:** Prefer a single canonical issue field, or document why both are required by the workflow contract and add validation that they must match.
**Rationale:** Loop review proposal.

### 18. 3. Consider omitting empty review arrays from generated history
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/draft-coverage-attempt-001.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/draft-coverage-attempt-001.json`  
**Requirement:** R2  
**Issue:** `blockingFindings`, `advisoryFindings`, `repairTargets`, and `findings` are all empty for a PASS result, which creates repeated boilerplate across review artifacts.  
**Suggestion:** If the artifact schema allows it, omit empty collections for PASS results or collapse them into a single `findings: []` field.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/draft-coverage-attempt-001.json`  
**Requirement:** R2  
**Issue:** `blockingFindings`, `advisoryFindings`, `repairTargets`, and `findings` are all empty for a PASS result, which creates repeated boilerplate across review artifacts.  
**Suggestion:** If the artifact schema allows it, omit empty collections for PASS results or collapse them into a single `findings: []` field.
**Rationale:** Loop review proposal.

### 19. 4. Consider omitting empty review arrays from generated history
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/draft-questions-attempt-001.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/draft-questions-attempt-001.json`  
**Requirement:** R2  
**Issue:** This file repeats the same empty PASS artifact structure as the coverage review history, including several empty arrays that carry no additional information.  
**Suggestion:** If compatible with consumers, simplify PASS artifacts by keeping only the required metadata plus a single empty findings collection.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/draft-questions-attempt-001.json`  
**Requirement:** R2  
**Issue:** This file repeats the same empty PASS artifact structure as the coverage review history, including several empty arrays that carry no additional information.  
**Suggestion:** If compatible with consumers, simplify PASS artifacts by keeping only the required metadata plus a single empty findings collection.
**Rationale:** Loop review proposal.

### 20. 1. Avoid Duplicating Finding Details Within The JSON Artifact
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-001.json`  
**Requirement:** R9  
**Issue:** The same review findings are represented twice: once in `blockingFindings` / `advisoryFindings` with full detail, and again in `findings` with partially duplicated `title` and `body`. This creates drift risk because future updates must keep two structures synchronized.  
**Suggestion:** Store findings in one canonical array and derive grouped views from it, or make the grouped sections reference canonical finding IDs instead of repeating the text.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-001.json`  
**Requirement:** R9  
**Issue:** The same review findings are represented twice: once in `blockingFindings` / `advisoryFindings` with full detail, and again in `findings` with partially duplicated `title` and `body`. This creates drift risk because future updates must keep two structures synchronized.  
**Suggestion:** Store findings in one canonical array and derive grouped views from it, or make the grouped sections reference canonical finding IDs instead of repeating the text.
**Rationale:** Loop review proposal.

### 21. 2. Normalize Review History Markdown Generation
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-001.md
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-001.md`  
**Requirement:** R9  
**Issue:** The Markdown file duplicates the same finding content already present in `test-attempt-001.json`. If both are persisted artifacts, this increases maintenance cost and can produce inconsistent review history.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or persist only one format if both are not required by downstream consumers.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-001.md`  
**Requirement:** R9  
**Issue:** The Markdown file duplicates the same finding content already present in `test-attempt-001.json`. If both are persisted artifacts, this increases maintenance cost and can produce inconsistent review history.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or persist only one format if both are not required by downstream consumers.
**Rationale:** Loop review proposal.

### 22. 3. Add Missing Trailing Newline
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/spec-attempt-001.md
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/spec-attempt-001.md`  
**Requirement:** R9  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/spec-attempt-001.md`  
**Requirement:** R9  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Rationale:** Loop review proposal.

### 23. 3. Add Missing Trailing Newline
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/spec-attempt-001.md
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/spec-attempt-001.md`  
**Requirement:** R9  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/spec-attempt-001.md`  
**Requirement:** R9  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Rationale:** Loop review proposal.

### 24. 3. Add Missing Trailing Newline
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/spec-review.md
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/spec-review.md`  
**Requirement:** R9  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/319-requirement-gate-context/spec-review.md`  
**Requirement:** R9  
**Issue:** The file ends without a trailing newline, which is inconsistent with typical text artifact formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Rationale:** Loop review proposal.

### 25. 1. Avoid Duplicating Finding Details Within The JSON Artifact
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-001.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-001.json`  
**Requirement:** R9  
**Issue:** The same review findings are represented twice: once in `blockingFindings` / `advisoryFindings` with full detail, and again in `findings` with partially duplicated `title` and `body`. This creates drift risk because future updates must keep two structures synchronized.  
**Suggestion:** Store findings in one canonical array and derive grouped views from it, or make the grouped sections reference canonical finding IDs instead of repeating the text.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-001.json`  
**Requirement:** R9  
**Issue:** The same review findings are represented twice: once in `blockingFindings` / `advisoryFindings` with full detail, and again in `findings` with partially duplicated `title` and `body`. This creates drift risk because future updates must keep two structures synchronized.  
**Suggestion:** Store findings in one canonical array and derive grouped views from it, or make the grouped sections reference canonical finding IDs instead of repeating the text.
**Rationale:** Loop review proposal.

### 26. 2. Normalize Review History Markdown Generation
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-001.md
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-001.md`  
**Requirement:** R9  
**Issue:** The Markdown file duplicates the same finding content already present in `test-attempt-001.json`. If both are persisted artifacts, this increases maintenance cost and can produce inconsistent review history.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or persist only one format if both are not required by downstream consumers.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-001.md`  
**Requirement:** R9  
**Issue:** The Markdown file duplicates the same finding content already present in `test-attempt-001.json`. If both are persisted artifacts, this increases maintenance cost and can produce inconsistent review history.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or persist only one format if both are not required by downstream consumers.
**Rationale:** Loop review proposal.

### 27. 3. Remove redundant finding fields inside the JSON artifact
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-002.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-002.json`  
**Requirement:** R11  
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with overlapping title/body/severity/origin data. This duplication makes updates error-prone and increases artifact size without adding clear value.  
**Suggestion:** Keep a single normalized findings array and derive blocking counts/views from `severity`, or make `blockingFindings` references to finding IDs instead of duplicating full content.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-002.json`  
**Requirement:** R11  
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with overlapping title/body/severity/origin data. This duplication makes updates error-prone and increases artifact size without adding clear value.  
**Suggestion:** Keep a single normalized findings array and derive blocking counts/views from `severity`, or make `blockingFindings` references to finding IDs instead of duplicating full content.
**Rationale:** Loop review proposal.

### 28. 1. Eliminate duplicated review content between JSON and Markdown artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-002.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-002.md`  
**Requirement:** R11  
**Issue:** The Markdown file manually duplicates the same findings already represented structurally in `test-attempt-002.json`. This creates drift risk across titles, issues, required changes, and blocking rationale.  
**Suggestion:** Generate the Markdown review summary from the JSON artifact, or keep only the canonical JSON artifact if Markdown is not required as a persisted source.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-002.md`  
**Requirement:** R11  
**Issue:** The Markdown file manually duplicates the same findings already represented structurally in `test-attempt-002.json`. This creates drift risk across titles, issues, required changes, and blocking rationale.  
**Suggestion:** Generate the Markdown review summary from the JSON artifact, or keep only the canonical JSON artifact if Markdown is not required as a persisted source.
**Rationale:** Loop review proposal.

### 29. 4. Remove redundant finding fields inside the JSON artifact
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-003.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-003.json`  
**Requirement:** R11  
**Issue:** `blockingFindings` and `findings` duplicate the same three review findings using different schemas. This weakens design consistency and invites stale or contradictory data.  
**Suggestion:** Consolidate to one canonical schema, then compute blocking/advisory groupings when rendering reports.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-003.json`  
**Requirement:** R11  
**Issue:** `blockingFindings` and `findings` duplicate the same three review findings using different schemas. This weakens design consistency and invites stale or contradictory data.  
**Suggestion:** Consolidate to one canonical schema, then compute blocking/advisory groupings when rendering reports.
**Rationale:** Loop review proposal.

### 30. 5. Use consistent target path naming
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-003.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-003.json`  
**Requirement:** R11  
**Issue:** The `target` values use `tests/requirement-gate-context.test.js`, while attempt 002 uses the fuller spec-local path `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The inconsistency makes cross-attempt comparison and tooling harder.  
**Suggestion:** Normalize `target` paths to the same repo-relative format across all review-history artifacts.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-003.json`  
**Requirement:** R11  
**Issue:** The `target` values use `tests/requirement-gate-context.test.js`, while attempt 002 uses the fuller spec-local path `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The inconsistency makes cross-attempt comparison and tooling harder.  
**Suggestion:** Normalize `target` paths to the same repo-relative format across all review-history artifacts.
**Rationale:** Loop review proposal.

### 31. 2. Eliminate duplicated review content between JSON and Markdown artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-003.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-003.md`  
**Requirement:** R11  
**Issue:** The Markdown file repeats all finding data from `test-attempt-003.json`, creating a second hand-maintained representation of the same review state.  
**Suggestion:** Derive this Markdown from `test-attempt-003.json` during reporting, or store only the JSON and render Markdown on demand.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-003.md`  
**Requirement:** R11  
**Issue:** The Markdown file repeats all finding data from `test-attempt-003.json`, creating a second hand-maintained representation of the same review state.  
**Suggestion:** Derive this Markdown from `test-attempt-003.json` during reporting, or store only the JSON and render Markdown on demand.
**Rationale:** Loop review proposal.

### 32. 1. Remove Duplicated Review Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-004.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-004.json`
**Requirement:** R11
**Issue:** The same review findings are stored twice per attempt: once in JSON and once in Markdown. This duplicates titles, issues, required changes, and blocking rationale across `test-attempt-004.json` and `test-attempt-004.md`, creating drift risk when one representation is edited without the other.
**Suggestion:** Keep a single source of truth for review history, preferably the structured JSON artifact, and generate the Markdown view from it when needed. If both files must remain committed, add metadata indicating the Markdown is derived and ensure generation is automated.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-004.json`
**Requirement:** R11
**Issue:** The same review findings are stored twice per attempt: once in JSON and once in Markdown. This duplicates titles, issues, required changes, and blocking rationale across `test-attempt-004.json` and `test-attempt-004.md`, creating drift risk when one representation is edited without the other.
**Suggestion:** Keep a single source of truth for review history, preferably the structured JSON artifact, and generate the Markdown view from it when needed. If both files must remain committed, add metadata indicating the Markdown is derived and ensure generation is automated.
**Rationale:** Loop review proposal.

### 33. 5. Add Missing Trailing Newline
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-004.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-004.md`
**Requirement:** R11
**Issue:** The Markdown file has no trailing newline. This is minor, but inconsistent with normal text-file formatting and can cause needless diff noise.
**Suggestion:** End the file with a newline.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-004.md`
**Requirement:** R11
**Issue:** The Markdown file has no trailing newline. This is minor, but inconsistent with normal text-file formatting and can cause needless diff noise.
**Suggestion:** End the file with a newline.
**Rationale:** Loop review proposal.

### 34. 2. Remove Duplicated Review Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-005.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The attempt 005 findings are also duplicated between JSON and Markdown, including long repeated prose for blocking findings. This increases maintenance cost and makes review-history consistency harder to audit.
**Suggestion:** Store the canonical finding data in JSON only, or generate `test-attempt-005.md` from `test-attempt-005.json` as part of the review artifact workflow instead of hand-maintaining both.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The attempt 005 findings are also duplicated between JSON and Markdown, including long repeated prose for blocking findings. This increases maintenance cost and makes review-history consistency harder to audit.
**Suggestion:** Store the canonical finding data in JSON only, or generate `test-attempt-005.md` from `test-attempt-005.json` as part of the review artifact workflow instead of hand-maintaining both.
**Rationale:** Loop review proposal.

### 35. 3. Normalize Finding Severity Naming
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-005.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The same advisory finding is represented with mixed terminology: `advisoryFindings.kind` uses `"advisory"`, while `findings.severity` uses `"non-blocking"`. That naming split makes downstream consumers more complex and invites mapping bugs.
**Suggestion:** Use one severity vocabulary throughout the artifact, such as `"blocking"` and `"advisory"`, or add a clearly named normalized field while avoiding duplicate semantic labels.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The same advisory finding is represented with mixed terminology: `advisoryFindings.kind` uses `"advisory"`, while `findings.severity` uses `"non-blocking"`. That naming split makes downstream consumers more complex and invites mapping bugs.
**Suggestion:** Use one severity vocabulary throughout the artifact, such as `"blocking"` and `"advisory"`, or add a clearly named normalized field while avoiding duplicate semantic labels.
**Rationale:** Loop review proposal.

### 36. 4. Preserve Advisory Finding Details Consistently
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-005.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The advisory entry in `advisoryFindings` contains `improvement` and `whyNonBlocking`, but the mirrored entry in `findings` reduces the body to `"Boundary coverage could be clearer"`. This loses useful detail and makes the two representations inconsistent.
**Suggestion:** Populate the mirrored `findings.body` from the advisory `improvement` text, or remove the redundant `findings` list if `blockingFindings` and `advisoryFindings` are canonical.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The advisory entry in `advisoryFindings` contains `improvement` and `whyNonBlocking`, but the mirrored entry in `findings` reduces the body to `"Boundary coverage could be clearer"`. This loses useful detail and makes the two representations inconsistent.
**Suggestion:** Populate the mirrored `findings.body` from the advisory `improvement` text, or remove the redundant `findings` list if `blockingFindings` and `advisoryFindings` are canonical.
**Rationale:** Loop review proposal.

### 37. 1. Remove Duplicated Review Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-004.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-004.json`
**Requirement:** R11
**Issue:** The same review findings are stored twice per attempt: once in JSON and once in Markdown. This duplicates titles, issues, required changes, and blocking rationale across `test-attempt-004.json` and `test-attempt-004.md`, creating drift risk when one representation is edited without the other.
**Suggestion:** Keep a single source of truth for review history, preferably the structured JSON artifact, and generate the Markdown view from it when needed. If both files must remain committed, add metadata indicating the Markdown is derived and ensure generation is automated.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-004.json`
**Requirement:** R11
**Issue:** The same review findings are stored twice per attempt: once in JSON and once in Markdown. This duplicates titles, issues, required changes, and blocking rationale across `test-attempt-004.json` and `test-attempt-004.md`, creating drift risk when one representation is edited without the other.
**Suggestion:** Keep a single source of truth for review history, preferably the structured JSON artifact, and generate the Markdown view from it when needed. If both files must remain committed, add metadata indicating the Markdown is derived and ensure generation is automated.
**Rationale:** Loop review proposal.

### 38. 2. Remove Duplicated Review Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-005.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The attempt 005 findings are also duplicated between JSON and Markdown, including long repeated prose for blocking findings. This increases maintenance cost and makes review-history consistency harder to audit.
**Suggestion:** Store the canonical finding data in JSON only, or generate `test-attempt-005.md` from `test-attempt-005.json` as part of the review artifact workflow instead of hand-maintaining both.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The attempt 005 findings are also duplicated between JSON and Markdown, including long repeated prose for blocking findings. This increases maintenance cost and makes review-history consistency harder to audit.
**Suggestion:** Store the canonical finding data in JSON only, or generate `test-attempt-005.md` from `test-attempt-005.json` as part of the review artifact workflow instead of hand-maintaining both.
**Rationale:** Loop review proposal.

### 39. 3. Normalize Finding Severity Naming
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-005.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The same advisory finding is represented with mixed terminology: `advisoryFindings.kind` uses `"advisory"`, while `findings.severity` uses `"non-blocking"`. That naming split makes downstream consumers more complex and invites mapping bugs.
**Suggestion:** Use one severity vocabulary throughout the artifact, such as `"blocking"` and `"advisory"`, or add a clearly named normalized field while avoiding duplicate semantic labels.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The same advisory finding is represented with mixed terminology: `advisoryFindings.kind` uses `"advisory"`, while `findings.severity` uses `"non-blocking"`. That naming split makes downstream consumers more complex and invites mapping bugs.
**Suggestion:** Use one severity vocabulary throughout the artifact, such as `"blocking"` and `"advisory"`, or add a clearly named normalized field while avoiding duplicate semantic labels.
**Rationale:** Loop review proposal.

### 40. 4. Preserve Advisory Finding Details Consistently
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-005.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The advisory entry in `advisoryFindings` contains `improvement` and `whyNonBlocking`, but the mirrored entry in `findings` reduces the body to `"Boundary coverage could be clearer"`. This loses useful detail and makes the two representations inconsistent.
**Suggestion:** Populate the mirrored `findings.body` from the advisory `improvement` text, or remove the redundant `findings` list if `blockingFindings` and `advisoryFindings` are canonical.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-005.json`
**Requirement:** R11
**Issue:** The advisory entry in `advisoryFindings` contains `improvement` and `whyNonBlocking`, but the mirrored entry in `findings` reduces the body to `"Boundary coverage could be clearer"`. This loses useful detail and makes the two representations inconsistent.
**Suggestion:** Populate the mirrored `findings.body` from the advisory `improvement` text, or remove the redundant `findings` list if `blockingFindings` and `advisoryFindings` are canonical.
**Rationale:** Loop review proposal.

### 41. 5. Add Missing Trailing Newline
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-004.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-004.md`
**Requirement:** R11
**Issue:** The Markdown file has no trailing newline. This is minor, but inconsistent with normal text-file formatting and can cause needless diff noise.
**Suggestion:** End the file with a newline.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-004.md`
**Requirement:** R11
**Issue:** The Markdown file has no trailing newline. This is minor, but inconsistent with normal text-file formatting and can cause needless diff noise.
**Suggestion:** End the file with a newline.
**Rationale:** Loop review proposal.

### 42. 1. Remove Duplicated Review Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-review.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The same review findings are stored twice per attempt: once in JSON and once in Markdown. This duplicates titles, issues, required changes, and blocking rationale across `test-attempt-004.json` and `test-attempt-004.md`, creating drift risk when one representation is edited without the other.
**Suggestion:** Keep a single source of truth for review history, preferably the structured JSON artifact, and generate the Markdown view from it when needed. If both files must remain committed, add metadata indicating the Markdown is derived and ensure generation is automated.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The same review findings are stored twice per attempt: once in JSON and once in Markdown. This duplicates titles, issues, required changes, and blocking rationale across `test-attempt-004.json` and `test-attempt-004.md`, creating drift risk when one representation is edited without the other.
**Suggestion:** Keep a single source of truth for review history, preferably the structured JSON artifact, and generate the Markdown view from it when needed. If both files must remain committed, add metadata indicating the Markdown is derived and ensure generation is automated.
**Rationale:** Loop review proposal.

### 43. 2. Remove Duplicated Review Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-review.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The attempt 005 findings are also duplicated between JSON and Markdown, including long repeated prose for blocking findings. This increases maintenance cost and makes review-history consistency harder to audit.
**Suggestion:** Store the canonical finding data in JSON only, or generate `test-attempt-005.md` from `test-attempt-005.json` as part of the review artifact workflow instead of hand-maintaining both.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The attempt 005 findings are also duplicated between JSON and Markdown, including long repeated prose for blocking findings. This increases maintenance cost and makes review-history consistency harder to audit.
**Suggestion:** Store the canonical finding data in JSON only, or generate `test-attempt-005.md` from `test-attempt-005.json` as part of the review artifact workflow instead of hand-maintaining both.
**Rationale:** Loop review proposal.

### 44. 3. Normalize Finding Severity Naming
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-review.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The same advisory finding is represented with mixed terminology: `advisoryFindings.kind` uses `"advisory"`, while `findings.severity` uses `"non-blocking"`. That naming split makes downstream consumers more complex and invites mapping bugs.
**Suggestion:** Use one severity vocabulary throughout the artifact, such as `"blocking"` and `"advisory"`, or add a clearly named normalized field while avoiding duplicate semantic labels.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The same advisory finding is represented with mixed terminology: `advisoryFindings.kind` uses `"advisory"`, while `findings.severity` uses `"non-blocking"`. That naming split makes downstream consumers more complex and invites mapping bugs.
**Suggestion:** Use one severity vocabulary throughout the artifact, such as `"blocking"` and `"advisory"`, or add a clearly named normalized field while avoiding duplicate semantic labels.
**Rationale:** Loop review proposal.

### 45. 4. Preserve Advisory Finding Details Consistently
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-review.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The advisory entry in `advisoryFindings` contains `improvement` and `whyNonBlocking`, but the mirrored entry in `findings` reduces the body to `"Boundary coverage could be clearer"`. This loses useful detail and makes the two representations inconsistent.
**Suggestion:** Populate the mirrored `findings.body` from the advisory `improvement` text, or remove the redundant `findings` list if `blockingFindings` and `advisoryFindings` are canonical.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The advisory entry in `advisoryFindings` contains `improvement` and `whyNonBlocking`, but the mirrored entry in `findings` reduces the body to `"Boundary coverage could be clearer"`. This loses useful detail and makes the two representations inconsistent.
**Suggestion:** Populate the mirrored `findings.body` from the advisory `improvement` text, or remove the redundant `findings` list if `blockingFindings` and `advisoryFindings` are canonical.
**Rationale:** Loop review proposal.

### 46. 5. Add Missing Trailing Newline
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-review.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The Markdown file has no trailing newline. This is minor, but inconsistent with normal text-file formatting and can cause needless diff noise.
**Suggestion:** End the file with a newline.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-review.md`
**Requirement:** R11
**Issue:** The Markdown file has no trailing newline. This is minor, but inconsistent with normal text-file formatting and can cause needless diff noise.
**Suggestion:** End the file with a newline.
**Rationale:** Loop review proposal.

### 47. 1. Deduplicate Work Unit Identity Fields
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json
**Requirement:** R3
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R3  
**Issue:** Metadata such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` is stored both at the top level and under `identity`. This repeated structure appears to be generated boilerplate and creates drift risk if one copy changes without the other.  
**Suggestion:** Keep the metadata in one canonical location, preferably `identity`, and have readers derive any flattened view instead of persisting duplicate fields.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`  
**Requirement:** R3  
**Issue:** Metadata such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` is stored both at the top level and under `identity`. This repeated structure appears to be generated boilerplate and creates drift risk if one copy changes without the other.  
**Suggestion:** Keep the metadata in one canonical location, preferably `identity`, and have readers derive any flattened view instead of persisting duplicate fields.
**Rationale:** Loop review proposal.

### 48. 4. Use One Completion Timestamp When Start And Finish Are Identical
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R9  
**Issue:** `startedAt` and `finishedAt` are identical down to the millisecond, which suggests these generated work-unit artifacts are recording a single event timestamp as two lifecycle fields. That adds noise without conveying real duration.  
**Suggestion:** Either record one timestamp such as `completedAt` for synchronous/generated artifacts, or ensure `startedAt` and `finishedAt` reflect actual execution timing if lifecycle duration matters.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/0bdf3b707356690edf741e13.json`  
**Requirement:** R9  
**Issue:** `startedAt` and `finishedAt` are identical down to the millisecond, which suggests these generated work-unit artifacts are recording a single event timestamp as two lifecycle fields. That adds noise without conveying real duration.  
**Suggestion:** Either record one timestamp such as `completedAt` for synchronous/generated artifacts, or ensure `startedAt` and `finishedAt` reflect actual execution timing if lifecycle duration matters.
**Rationale:** Loop review proposal.

### 49. 2. Avoid Persisting Proposals Twice
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json`  
**Requirement:** R9  
**Issue:** The proposal content is duplicated in `rawResponse` and again in structured form under `success.proposals[].body`. This repeats the same long text payload and makes later normalization or correction harder.  
**Suggestion:** Persist only the structured `success.proposals` data as canonical output, or make `rawResponse` optional/debug-only and omit it for successful parsed responses.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json`  
**Requirement:** R9  
**Issue:** The proposal content is duplicated in `rawResponse` and again in structured form under `success.proposals[].body`. This repeats the same long text payload and makes later normalization or correction harder.  
**Suggestion:** Persist only the structured `success.proposals` data as canonical output, or make `rawResponse` optional/debug-only and omit it for successful parsed responses.
**Rationale:** Loop review proposal.

### 50. 3. Normalize Proposal Titles
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`  
**Requirement:** R9  
**Issue:** `success.proposals[].title` includes the rendered list number, for example `"1. Add requirement IDs to stored review proposals"`. Since array order already provides sequence, embedding numbering in the title makes titles harder to reuse, compare, or reorder.  
**Suggestion:** Store titles without ordinal prefixes, for example `"Add requirement IDs to stored review proposals"`, and add numbering only when rendering Markdown.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`  
**Requirement:** R9  
**Issue:** `success.proposals[].title` includes the rendered list number, for example `"1. Add requirement IDs to stored review proposals"`. Since array order already provides sequence, embedding numbering in the title makes titles harder to reuse, compare, or reorder.  
**Suggestion:** Store titles without ordinal prefixes, for example `"Add requirement IDs to stored review proposals"`, and add numbering only when rendering Markdown.
**Rationale:** Loop review proposal.

### 51. 1. Enforce Scope-Valid Proposal Files
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`  
**Requirement:** R1  
**Issue:** The stored proposals reference files that are not part of this diff, such as `specs/319-requirement-gate-context/spec.json`, `spec.md`, and `issue-log.json`. That violates the mandatory scope constraint for this review output and makes the artifact unsuitable for consumers that discard out-of-scope proposals.  
**Suggestion:** Regenerate or repair this work unit so every proposal points only to touched files in this change set, or mark the unit failed instead of storing invalid scoped proposals as `success`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`  
**Requirement:** R1  
**Issue:** The stored proposals reference files that are not part of this diff, such as `specs/319-requirement-gate-context/spec.json`, `spec.md`, and `issue-log.json`. That violates the mandatory scope constraint for this review output and makes the artifact unsuitable for consumers that discard out-of-scope proposals.  
**Suggestion:** Regenerate or repair this work unit so every proposal points only to touched files in this change set, or mark the unit failed instead of storing invalid scoped proposals as `success`.
**Rationale:** Loop review proposal.

### 52. 2. Add Missing Requirement IDs To Stored Proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`  
**Requirement:** R1  
**Issue:** The proposals in both `rawResponse` and `success.proposals[].body` omit the mandatory `**Requirement:** <id>` line. The structured proposal objects also lack `requirementId`, unlike the later work units.  
**Suggestion:** Require a valid requirement ID during parsing and persistence. For this artifact, either add valid `**Requirement:** ...` lines and `requirementId` fields or reject the provider output.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`  
**Requirement:** R1  
**Issue:** The proposals in both `rawResponse` and `success.proposals[].body` omit the mandatory `**Requirement:** <id>` line. The structured proposal objects also lack `requirementId`, unlike the later work units.  
**Suggestion:** Require a valid requirement ID during parsing and persistence. For this artifact, either add valid `**Requirement:** ...` lines and `requirementId` fields or reject the provider output.
**Rationale:** Loop review proposal.

### 53. 3. Remove Out-Of-Scope Embedded Proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`  
**Requirement:** R1  
**Issue:** Several proposals embedded in this loop-chunk reference files outside the actual diff, including `test-attempt-004.json`, `spec.md`, and other non-touched artifacts. Even though they appear inside a JSON file that is touched, their `**File:**` lines violate the requested review scope.  
**Suggestion:** Filter parsed proposals against the actual diff file list before writing `success.proposals`; out-of-scope entries should be dropped or the work unit should be marked invalid.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`  
**Requirement:** R1  
**Issue:** Several proposals embedded in this loop-chunk reference files outside the actual diff, including `test-attempt-004.json`, `spec.md`, and other non-touched artifacts. Even though they appear inside a JSON file that is touched, their `**File:**` lines violate the requested review scope.  
**Suggestion:** Filter parsed proposals against the actual diff file list before writing `success.proposals`; out-of-scope entries should be dropped or the work unit should be marked invalid.
**Rationale:** Loop review proposal.

### 54. 4. Deduplicate Identity Metadata
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`  
**Requirement:** R10  
**Issue:** `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` are stored both at the top level and inside `identity`. This duplicated metadata appears across the new work-unit files and creates avoidable drift risk.  
**Suggestion:** Choose one canonical location for immutable identity fields. Keep either the top-level values or `identity` values, and derive the other only at read/render time if needed.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`  
**Requirement:** R10  
**Issue:** `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` are stored both at the top level and inside `identity`. This duplicated metadata appears across the new work-unit files and creates avoidable drift risk.  
**Suggestion:** Choose one canonical location for immutable identity fields. Keep either the top-level values or `identity` values, and derive the other only at read/render time if needed.
**Rationale:** Loop review proposal.

### 55. 5. Avoid Storing Parsed Proposals Twice
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`  
**Requirement:** R10  
**Issue:** Proposal content is duplicated as markdown in `rawResponse` and again as structured objects in `success.proposals`. The two representations can diverge and inflate review-history artifacts.  
**Suggestion:** Store `success.proposals` as the canonical representation after successful parsing, and replace `rawResponse` with a checksum, short debug excerpt, or omit it for successful runs.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`  
**Requirement:** R10  
**Issue:** Proposal content is duplicated as markdown in `rawResponse` and again as structured objects in `success.proposals`. The two representations can diverge and inflate review-history artifacts.  
**Suggestion:** Store `success.proposals` as the canonical representation after successful parsing, and replace `rawResponse` with a checksum, short debug excerpt, or omit it for successful runs.
**Rationale:** Loop review proposal.

### 56. 6. Normalize Repeated Work-Unit Schema Shape
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/591b4feebb7073ebc2e7b66d.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/591b4feebb7073ebc2e7b66d.json`  
**Requirement:** R10  
**Issue:** The four new work-unit JSON files repeat the same run envelope fields with minor value differences. This makes schema changes noisy and increases the chance of inconsistent fields, as already seen with missing `requirementId` in one artifact and present `requirementId` in others.  
**Suggestion:** Generate these artifacts from a shared schema/envelope builder that always emits the same required fields, including `requirementId`, and applies the same validation before writing `status: "success"`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/591b4feebb7073ebc2e7b66d.json`  
**Requirement:** R10  
**Issue:** The four new work-unit JSON files repeat the same run envelope fields with minor value differences. This makes schema changes noisy and increases the chance of inconsistent fields, as already seen with missing `requirementId` in one artifact and present `requirementId` in others.  
**Suggestion:** Generate these artifacts from a shared schema/envelope builder that always emits the same required fields, including `requirementId`, and applies the same validation before writing `status: "success"`.
**Rationale:** Loop review proposal.

### 57. 3. Avoid Duplicating Target Metadata
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`
**Requirement:** R2
**Issue:** The same metadata is stored both at the top level and inside `identity`, including `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`. This duplicates maintenance surface and can drift if artifacts are rewritten partially.
**Suggestion:** Keep these fields in one canonical location, preferably `identity`, and have consumers read from that. If the schema requires both, add validation that the duplicated fields must match.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`
**Requirement:** R2
**Issue:** The same metadata is stored both at the top level and inside `identity`, including `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`. This duplicates maintenance surface and can drift if artifacts are rewritten partially.
**Suggestion:** Keep these fields in one canonical location, preferably `identity`, and have consumers read from that. If the schema requires both, add validation that the duplicated fields must match.
**Rationale:** Loop review proposal.

### 58. 4. Avoid Duplicating Target Metadata
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`
**Requirement:** R2
**Issue:** The file repeats identity metadata at the top level and under `identity`, creating the same drift risk as the other work-unit artifacts.
**Suggestion:** Normalize the work-unit schema so identity fields are stored once, or enforce equality during artifact generation.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`
**Requirement:** R2
**Issue:** The file repeats identity metadata at the top level and under `identity`, creating the same drift risk as the other work-unit artifacts.
**Suggestion:** Normalize the work-unit schema so identity fields are stored once, or enforce equality during artifact generation.
**Rationale:** Loop review proposal.

### 59. 7. Store Proposal Text Once
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`
**Requirement:** R2
**Issue:** Each proposal is stored twice: once embedded in `rawResponse` and again split into `success.proposals[].title/body/file/requirementId`. This makes edits and validation harder because two representations must remain synchronized.
**Suggestion:** Prefer the structured `success.proposals` form as canonical and omit `rawResponse`, or keep `rawResponse` only in an ignored/debug artifact.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`
**Requirement:** R2
**Issue:** Each proposal is stored twice: once embedded in `rawResponse` and again split into `success.proposals[].title/body/file/requirementId`. This makes edits and validation harder because two representations must remain synchronized.
**Suggestion:** Prefer the structured `success.proposals` form as canonical and omit `rawResponse`, or keep `rawResponse` only in an ignored/debug artifact.
**Rationale:** Loop review proposal.

### 60. 1. Add Requirement IDs To Cross-Check Proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`
**Requirement:** R1
**Issue:** The `rawResponse` and `success.proposals[].body` entries omit the mandatory `**Requirement:** <id>` line, and the structured proposal objects also omit `requirementId`. This makes the saved provider output invalid under the stated impl-review contract.
**Suggestion:** Add a valid requirement ID to every proposal body and populate `success.proposals[].requirementId` consistently.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`
**Requirement:** R1
**Issue:** The `rawResponse` and `success.proposals[].body` entries omit the mandatory `**Requirement:** <id>` line, and the structured proposal objects also omit `requirementId`. This makes the saved provider output invalid under the stated impl-review contract.
**Suggestion:** Add a valid requirement ID to every proposal body and populate `success.proposals[].requirementId` consistently.
**Rationale:** Loop review proposal.

### 61. 2. Remove Out-Of-Scope File References From Cross-Check Proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`
**Requirement:** R1
**Issue:** Several proposal `**File:**` values reference files that are not present in the diff for this change set, such as `specs/319-requirement-gate-context/spec.md`, `specs/319-requirement-gate-context/draft.json`, and `specs/319-requirement-gate-context/issue-log.json`. The scope constraint says proposals must only target files that appear in the given diff.
**Suggestion:** Either remove those proposals from this work-unit artifact or retarget them only to files present in the diff, which are the four newly added impl-review work-unit JSON files.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`
**Requirement:** R1
**Issue:** Several proposal `**File:**` values reference files that are not present in the diff for this change set, such as `specs/319-requirement-gate-context/spec.md`, `specs/319-requirement-gate-context/draft.json`, and `specs/319-requirement-gate-context/issue-log.json`. The scope constraint says proposals must only target files that appear in the given diff.
**Suggestion:** Either remove those proposals from this work-unit artifact or retarget them only to files present in the diff, which are the four newly added impl-review work-unit JSON files.
**Rationale:** Loop review proposal.

### 62. 5. Avoid Duplicating Target Metadata
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`
**Requirement:** R2
**Issue:** `targetFiles`, `inputHash`, provider metadata, schema metadata, and `unitId` appear both at the top level and under `identity`.
**Suggestion:** Collapse these into a single canonical metadata object, or make the duplication explicitly generated and validated.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`
**Requirement:** R2
**Issue:** `targetFiles`, `inputHash`, provider metadata, schema metadata, and `unitId` appear both at the top level and under `identity`.
**Suggestion:** Collapse these into a single canonical metadata object, or make the duplication explicitly generated and validated.
**Rationale:** Loop review proposal.

### 63. 6. Avoid Duplicating Target Metadata
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`
**Requirement:** R2
**Issue:** The work-unit artifact repeats the same identity fields in two places, matching the duplication pattern across the new files.
**Suggestion:** Store the duplicated fields once, or add schema-level validation to prevent inconsistent copies.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`
**Requirement:** R2
**Issue:** The work-unit artifact repeats the same identity fields in two places, matching the duplication pattern across the new files.
**Suggestion:** Store the duplicated fields once, or add schema-level validation to prevent inconsistent copies.
**Rationale:** Loop review proposal.

### 64. 1. Enforce scoped proposal files in captured responses
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/7e5d5fb7ab4d2a3c8c35d417.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/7e5d5fb7ab4d2a3c8c35d417.json`
**Requirement:** R11
**Issue:** `rawResponse` and `success.proposals` reference files that are not part of this diff, such as `spec.md`, `spec.json`, and `flow.json`. That violates the stated scope constraint for this review artifact and makes downstream review output invalid.
**Suggestion:** Regenerate or filter this work-unit result so every proposal points only to files touched by the change set, or persist a validation failure instead of `status: "success"` when the provider returns out-of-scope files.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/7e5d5fb7ab4d2a3c8c35d417.json`
**Requirement:** R11
**Issue:** `rawResponse` and `success.proposals` reference files that are not part of this diff, such as `spec.md`, `spec.json`, and `flow.json`. That violates the stated scope constraint for this review artifact and makes downstream review output invalid.
**Suggestion:** Regenerate or filter this work-unit result so every proposal points only to files touched by the change set, or persist a validation failure instead of `status: "success"` when the provider returns out-of-scope files.
**Rationale:** Loop review proposal.

### 65. 2. Add missing requirement IDs to stored proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/81371a5f1c9b299fd850f568.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/81371a5f1c9b299fd850f568.json`
**Requirement:** R11
**Issue:** The captured `rawResponse` proposal bodies do not include mandatory `**Requirement:** <id>` lines, and the structured proposal objects also omit `requirementId`. This contradicts the impl-review requirement contract while the artifact is marked successful.
**Suggestion:** Reject or repair provider output that lacks a known requirement ID before writing a successful work-unit artifact.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/81371a5f1c9b299fd850f568.json`
**Requirement:** R11
**Issue:** The captured `rawResponse` proposal bodies do not include mandatory `**Requirement:** <id>` lines, and the structured proposal objects also omit `requirementId`. This contradicts the impl-review requirement contract while the artifact is marked successful.
**Suggestion:** Reject or repair provider output that lacks a known requirement ID before writing a successful work-unit artifact.
**Rationale:** Loop review proposal.

### 66. 3. Remove duplicate metadata blocks
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/a3a9b06f11a6e12d9b02c066.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/a3a9b06f11a6e12d9b02c066.json`
**Requirement:** R11
**Issue:** Top-level fields duplicate the same values already nested under `identity`, including `phase`, `kind`, `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`. This creates drift risk and bloats every artifact.
**Suggestion:** Keep immutable identity fields under `identity` and store only run-state fields at the top level, or make the top-level fields derived when rendering/reporting.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/a3a9b06f11a6e12d9b02c066.json`
**Requirement:** R11
**Issue:** Top-level fields duplicate the same values already nested under `identity`, including `phase`, `kind`, `unitId`, `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, and `schemaVersion`. This creates drift risk and bloats every artifact.
**Suggestion:** Keep immutable identity fields under `identity` and store only run-state fields at the top level, or make the top-level fields derived when rendering/reporting.
**Rationale:** Loop review proposal.

### 67. 4. Normalize proposal titles instead of embedding ordinals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json`
**Requirement:** R11
**Issue:** Each structured proposal `title` includes a numeric prefix like `"1. Eliminate..."` even though the array order already provides numbering. This duplicates presentation state inside data and makes reordering harder.
**Suggestion:** Store titles without numeric prefixes and add numbering only when rendering Markdown or CLI output.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json`
**Requirement:** R11
**Issue:** Each structured proposal `title` includes a numeric prefix like `"1. Eliminate..."` even though the array order already provides numbering. This duplicates presentation state inside data and makes reordering harder.
**Suggestion:** Store titles without numeric prefixes and add numbering only when rendering Markdown or CLI output.
**Rationale:** Loop review proposal.

### 68. 1. Remove Empty Open Questions Placeholder
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/spec.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/spec.md`  
**Requirement:** R11  
**Issue:** The `## Open Questions` section contains a blank checklist item (`- [ ]`), while `spec.json` correctly represents this as an empty `open_questions` array. This creates dead/generated noise and can be mistaken for an unresolved item.  
**Suggestion:** Render empty open questions as `None` or omit the placeholder item entirely.
**Suggestion:** **File:** `specs/319-requirement-gate-context/spec.md`  
**Requirement:** R11  
**Issue:** The `## Open Questions` section contains a blank checklist item (`- [ ]`), while `spec.json` correctly represents this as an empty `open_questions` array. This creates dead/generated noise and can be mistaken for an unresolved item.  
**Suggestion:** Render empty open questions as `None` or omit the placeholder item entirely.
**Rationale:** Loop review proposal.

### 69. 2. Define Diff Evidence Citation Format Explicitly
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/319-requirement-gate-context/spec.json`  
**Requirement:** R8  
**Issue:** The spec requires reasons to cite every additional source used, including mapped diff evidence, but only defines stable citation formats for spec-derived entries like `[REQ:<id>]`, `[AC:<n>]`, `[FILE-MAP:<id>:<n>]`, etc. The mapped diff evidence citation format is not explicitly named.  
**Suggestion:** Add a deterministic citation label for mapped diff evidence, such as `[DIFF:<path>:<n>]` or a single `[DIFF]` section reference, and mirror it in `spec.md` so evaluator reasons have an unambiguous source-reference contract.
**Suggestion:** **File:** `specs/319-requirement-gate-context/spec.json`  
**Requirement:** R8  
**Issue:** The spec requires reasons to cite every additional source used, including mapped diff evidence, but only defines stable citation formats for spec-derived entries like `[REQ:<id>]`, `[AC:<n>]`, `[FILE-MAP:<id>:<n>]`, etc. The mapped diff evidence citation format is not explicitly named.  
**Suggestion:** Add a deterministic citation label for mapped diff evidence, such as `[DIFF:<path>:<n>]` or a single `[DIFF]` section reference, and mirror it in `spec.md` so evaluator reasons have an unambiguous source-reference contract.
**Rationale:** Loop review proposal.

### 70. 2. Define Diff Evidence Citation Format Explicitly
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/319-requirement-gate-context/spec.json`  
**Requirement:** R8  
**Issue:** The spec requires reasons to cite every additional source used, including mapped diff evidence, but only defines stable citation formats for spec-derived entries like `[REQ:<id>]`, `[AC:<n>]`, `[FILE-MAP:<id>:<n>]`, etc. The mapped diff evidence citation format is not explicitly named.  
**Suggestion:** Add a deterministic citation label for mapped diff evidence, such as `[DIFF:<path>:<n>]` or a single `[DIFF]` section reference, and mirror it in `spec.md` so evaluator reasons have an unambiguous source-reference contract.
**Suggestion:** **File:** `specs/319-requirement-gate-context/spec.json`  
**Requirement:** R8  
**Issue:** The spec requires reasons to cite every additional source used, including mapped diff evidence, but only defines stable citation formats for spec-derived entries like `[REQ:<id>]`, `[AC:<n>]`, `[FILE-MAP:<id>:<n>]`, etc. The mapped diff evidence citation format is not explicitly named.  
**Suggestion:** Add a deterministic citation label for mapped diff evidence, such as `[DIFF:<path>:<n>]` or a single `[DIFF]` section reference, and mirror it in `spec.md` so evaluator reasons have an unambiguous source-reference contract.
**Rationale:** Loop review proposal.

### 71. 1. Remove Empty Open Questions Placeholder
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/spec.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/spec.md`  
**Requirement:** R11  
**Issue:** The `## Open Questions` section contains a blank checklist item (`- [ ]`), while `spec.json` correctly represents this as an empty `open_questions` array. This creates dead/generated noise and can be mistaken for an unresolved item.  
**Suggestion:** Render empty open questions as `None` or omit the placeholder item entirely.
**Suggestion:** **File:** `specs/319-requirement-gate-context/spec.md`  
**Requirement:** R11  
**Issue:** The `## Open Questions` section contains a blank checklist item (`- [ ]`), while `spec.json` correctly represents this as an empty `open_questions` array. This creates dead/generated noise and can be mistaken for an unresolved item.  
**Suggestion:** Render empty open questions as `None` or omit the placeholder item entirely.
**Rationale:** Loop review proposal.

### 72. 1. Remove Empty Open Questions Placeholder
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/spec.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/spec.md`  
**Requirement:** R11  
**Issue:** The `## Open Questions` section contains a blank checklist item (`- [ ]`), while `spec.json` correctly represents this as an empty `open_questions` array. This creates dead/generated noise and can be mistaken for an unresolved item.  
**Suggestion:** Render empty open questions as `None` or omit the placeholder item entirely.
**Suggestion:** **File:** `specs/319-requirement-gate-context/spec.md`  
**Requirement:** R11  
**Issue:** The `## Open Questions` section contains a blank checklist item (`- [ ]`), while `spec.json` correctly represents this as an empty `open_questions` array. This creates dead/generated noise and can be mistaken for an unresolved item.  
**Suggestion:** Render empty open questions as `None` or omit the placeholder item entirely.
**Rationale:** Loop review proposal.

### 73. 2. Define Diff Evidence Citation Format Explicitly
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/319-requirement-gate-context/spec.json`  
**Requirement:** R8  
**Issue:** The spec requires reasons to cite every additional source used, including mapped diff evidence, but only defines stable citation formats for spec-derived entries like `[REQ:<id>]`, `[AC:<n>]`, `[FILE-MAP:<id>:<n>]`, etc. The mapped diff evidence citation format is not explicitly named.  
**Suggestion:** Add a deterministic citation label for mapped diff evidence, such as `[DIFF:<path>:<n>]` or a single `[DIFF]` section reference, and mirror it in `spec.md` so evaluator reasons have an unambiguous source-reference contract.
**Suggestion:** **File:** `specs/319-requirement-gate-context/spec.json`  
**Requirement:** R8  
**Issue:** The spec requires reasons to cite every additional source used, including mapped diff evidence, but only defines stable citation formats for spec-derived entries like `[REQ:<id>]`, `[AC:<n>]`, `[FILE-MAP:<id>:<n>]`, etc. The mapped diff evidence citation format is not explicitly named.  
**Suggestion:** Add a deterministic citation label for mapped diff evidence, such as `[DIFF:<path>:<n>]` or a single `[DIFF]` section reference, and mirror it in `spec.md` so evaluator reasons have an unambiguous source-reference contract.
**Rationale:** Loop review proposal.

### 74. 2. Use consistent test file paths across artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-coverage.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The requirement `files` entries use `tests/requirement-gate-context.test.js`, while the execution artifact references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes traceability harder.  
**Suggestion:** Use the same project-relative path format as `test-execute-result.json`: `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The requirement `files` entries use `tests/requirement-gate-context.test.js`, while the execution artifact references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes traceability harder.  
**Suggestion:** Use the same project-relative path format as `test-execute-result.json`: `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Rationale:** Loop review proposal.

### 75. 1. Normalize repeated test evidence fields
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-execute-result.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each summary entry repeats the same `command`, `test_file`, and identical `raw_output_lines`. This makes the artifact noisy and increases the chance of inconsistent updates if the command or output range changes.  
**Suggestion:** Move shared execution metadata to a top-level object such as `execution`, and keep each requirement summary focused on `id`, `result`, and `test_name`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each summary entry repeats the same `command`, `test_file`, and identical `raw_output_lines`. This makes the artifact noisy and increases the chance of inconsistent updates if the command or output range changes.  
**Suggestion:** Move shared execution metadata to a top-level object such as `execution`, and keep each requirement summary focused on `id`, `result`, and `test_name`.
**Rationale:** Loop review proposal.

### 76. 3. Avoid duplicating changed file lists
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-execute-result.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R9  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` contain the same three entries with the same fingerprints. This duplicates data without adding meaning.  
**Suggestion:** Keep a single `changed_files` list and add a separate field only if trigger relevance differs, such as `trigger_relevant: true` per entry or a list of referenced paths.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R9  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` contain the same three entries with the same fingerprints. This duplicates data without adding meaning.  
**Suggestion:** Keep a single `changed_files` list and add a separate field only if trigger relevance differs, such as `trigger_relevant: true` per entry or a list of referenced paths.
**Rationale:** Loop review proposal.

### 77. 1. Normalize repeated test evidence fields
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-execute-result.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each summary entry repeats the same `command`, `test_file`, and identical `raw_output_lines`. This makes the artifact noisy and increases the chance of inconsistent updates if the command or output range changes.  
**Suggestion:** Move shared execution metadata to a top-level object such as `execution`, and keep each requirement summary focused on `id`, `result`, and `test_name`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each summary entry repeats the same `command`, `test_file`, and identical `raw_output_lines`. This makes the artifact noisy and increases the chance of inconsistent updates if the command or output range changes.  
**Suggestion:** Move shared execution metadata to a top-level object such as `execution`, and keep each requirement summary focused on `id`, `result`, and `test_name`.
**Rationale:** Loop review proposal.

### 78. 2. Use consistent test file paths across artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-coverage.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The requirement `files` entries use `tests/requirement-gate-context.test.js`, while the execution artifact references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes traceability harder.  
**Suggestion:** Use the same project-relative path format as `test-execute-result.json`: `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The requirement `files` entries use `tests/requirement-gate-context.test.js`, while the execution artifact references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes traceability harder.  
**Suggestion:** Use the same project-relative path format as `test-execute-result.json`: `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Rationale:** Loop review proposal.

### 79. 3. Avoid duplicating changed file lists
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-execute-result.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R9  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` contain the same three entries with the same fingerprints. This duplicates data without adding meaning.  
**Suggestion:** Keep a single `changed_files` list and add a separate field only if trigger relevance differs, such as `trigger_relevant: true` per entry or a list of referenced paths.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R9  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` contain the same three entries with the same fingerprints. This duplicates data without adding meaning.  
**Suggestion:** Keep a single `changed_files` list and add a separate field only if trigger relevance differs, such as `trigger_relevant: true` per entry or a list of referenced paths.
**Rationale:** Loop review proposal.

### 80. 1. Normalize repeated test evidence fields
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-execute-result.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each summary entry repeats the same `command`, `test_file`, and identical `raw_output_lines`. This makes the artifact noisy and increases the chance of inconsistent updates if the command or output range changes.  
**Suggestion:** Move shared execution metadata to a top-level object such as `execution`, and keep each requirement summary focused on `id`, `result`, and `test_name`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each summary entry repeats the same `command`, `test_file`, and identical `raw_output_lines`. This makes the artifact noisy and increases the chance of inconsistent updates if the command or output range changes.  
**Suggestion:** Move shared execution metadata to a top-level object such as `execution`, and keep each requirement summary focused on `id`, `result`, and `test_name`.
**Rationale:** Loop review proposal.

### 81. 2. Use consistent test file paths across artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-coverage.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The requirement `files` entries use `tests/requirement-gate-context.test.js`, while the execution artifact references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes traceability harder.  
**Suggestion:** Use the same project-relative path format as `test-execute-result.json`: `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The requirement `files` entries use `tests/requirement-gate-context.test.js`, while the execution artifact references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes traceability harder.  
**Suggestion:** Use the same project-relative path format as `test-execute-result.json`: `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Rationale:** Loop review proposal.

### 82. 3. Avoid duplicating changed file lists
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-execute-result.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R9  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` contain the same three entries with the same fingerprints. This duplicates data without adding meaning.  
**Suggestion:** Keep a single `changed_files` list and add a separate field only if trigger relevance differs, such as `trigger_relevant: true` per entry or a list of referenced paths.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R9  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` contain the same three entries with the same fingerprints. This duplicates data without adding meaning.  
**Suggestion:** Keep a single `changed_files` list and add a separate field only if trigger relevance differs, such as `trigger_relevant: true` per entry or a list of referenced paths.
**Rationale:** Loop review proposal.

### 83. I’ll review only the four touched files in the supplied diff and frame any suggestions against the required IDs. I’m treating this as a code-quality review rather than changing files.### 1. Remove stale failing execution artifact
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/.raw/scenario-validity.log
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records 11 failing subtests, while `tests/.raw/test-execution.log` records the same spec-local test suite passing with 12 subtests. Keeping contradictory generated artifacts makes the change set harder to audit and can mislead future reviewers about the actual expected state.  
**Suggestion:** Delete the stale failing log, or regenerate it from the same final test run so the raw artifacts consistently reflect the current passing suite.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records 11 failing subtests, while `tests/.raw/test-execution.log` records the same spec-local test suite passing with 12 subtests. Keeping contradictory generated artifacts makes the change set harder to audit and can mislead future reviewers about the actual expected state.  
**Suggestion:** Delete the stale failing log, or regenerate it from the same final test run so the raw artifacts consistently reflect the current passing suite.
**Rationale:** Loop review proposal.

### 84. 2. Consolidate duplicated RunGate fixture setup
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `runGateFixture()` builds a large temporary spec, flow state, file map, Git repo, stub agent, and CLI invocation inline. Much of this mirrors existing setup concepts already represented by `fixtureSpec()`, `buildContext()`, and the shared temp/git helpers, but the function is long enough that the actual e2e assertion intent is buried.  
**Suggestion:** Split the setup into small helpers such as `writeGateFixtureProject()`, `writeGateFlowState()`, and `runTaskImplGate()`. Keep `runGateFixture()` as orchestration returning `{ tmp, execution, envelope, prompt, flowState }`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `runGateFixture()` builds a large temporary spec, flow state, file map, Git repo, stub agent, and CLI invocation inline. Much of this mirrors existing setup concepts already represented by `fixtureSpec()`, `buildContext()`, and the shared temp/git helpers, but the function is long enough that the actual e2e assertion intent is buried.  
**Suggestion:** Split the setup into small helpers such as `writeGateFixtureProject()`, `writeGateFlowState()`, and `runTaskImplGate()`. Keep `runGateFixture()` as orchestration returning `{ tmp, execution, envelope, prompt, flowState }`.
**Rationale:** Loop review proposal.

### 85. 3. Use a single requirement fixture factory for e2e cases
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** The R11 e2e fixtures repeatedly spell out requirement objects with the same `{ id, desc, priority: "must", status: "pending" }` shape. This duplicates boilerplate and makes the case-specific behavior less visible.  
**Suggestion:** Add a small helper like `requirement(id, desc)` or `mustRequirement(id, desc)` and use it in the `fixtures` array.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** The R11 e2e fixtures repeatedly spell out requirement objects with the same `{ id, desc, priority: "must", status: "pending" }` shape. This duplicates boilerplate and makes the case-specific behavior less visible.  
**Suggestion:** Add a small helper like `requirement(id, desc)` or `mustRequirement(id, desc)` and use it in the `fixtures` array.
**Rationale:** Loop review proposal.

### 86. 4. Avoid monkey-patching `fs` globally inside a test
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test temporarily replaces `fs.readFileSync` and `fs.writeFileSync` globally. Even with `finally` restoration, this pattern is brittle under concurrent test execution and can cause unrelated code in the same process to observe instrumented filesystem behavior.  
**Suggestion:** Prefer dependency injection through the command/container if available, or assert guard behavior through stable external effects only: unchanged artifact bytes, zero agent calls, and unchanged flow state. If read/write counting remains necessary, wrap the command’s filesystem dependency at its local boundary rather than patching Node’s `fs` module globally.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test temporarily replaces `fs.readFileSync` and `fs.writeFileSync` globally. Even with `finally` restoration, this pattern is brittle under concurrent test execution and can cause unrelated code in the same process to observe instrumented filesystem behavior.  
**Suggestion:** Prefer dependency injection through the command/container if available, or assert guard behavior through stable external effects only: unchanged artifact bytes, zero agent calls, and unchanged flow state. If read/write counting remains necessary, wrap the command’s filesystem dependency at its local boundary rather than patching Node’s `fs` module globally.
**Rationale:** Loop review proposal.

### 87. 5. Rename `responseResult` to reflect gate verdict casing
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `responseResult` is generic and easy to confuse with the full command result or envelope result. In the fixtures it specifically means the stubbed per-requirement evaluation verdict, using lowercase `"pass"`/`"fail"`.  
**Suggestion:** Rename it to `stubVerdict` or `evaluationVerdict`, and update `runGateFixture()` plus the R11 fixture table accordingly.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `responseResult` is generic and easy to confuse with the full command result or envelope result. In the fixtures it specifically means the stubbed per-requirement evaluation verdict, using lowercase `"pass"`/`"fail"`.  
**Suggestion:** Rename it to `stubVerdict` or `evaluationVerdict`, and update `runGateFixture()` plus the R11 fixture table accordingly.
**Rationale:** Loop review proposal.

### 88. I’ll review only the four touched files in the supplied diff and frame any suggestions against the required IDs. I’m treating this as a code-quality review rather than changing files.### 1. Remove stale failing execution artifact
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/.raw/scenario-validity.log
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records 11 failing subtests, while `tests/.raw/test-execution.log` records the same spec-local test suite passing with 12 subtests. Keeping contradictory generated artifacts makes the change set harder to audit and can mislead future reviewers about the actual expected state.  
**Suggestion:** Delete the stale failing log, or regenerate it from the same final test run so the raw artifacts consistently reflect the current passing suite.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records 11 failing subtests, while `tests/.raw/test-execution.log` records the same spec-local test suite passing with 12 subtests. Keeping contradictory generated artifacts makes the change set harder to audit and can mislead future reviewers about the actual expected state.  
**Suggestion:** Delete the stale failing log, or regenerate it from the same final test run so the raw artifacts consistently reflect the current passing suite.
**Rationale:** Loop review proposal.

### 89. I’ll review only the four touched files in the supplied diff and frame any suggestions against the required IDs. I’m treating this as a code-quality review rather than changing files.### 1. Remove stale failing execution artifact
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/.raw/scenario-validity.log
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records 11 failing subtests, while `tests/.raw/test-execution.log` records the same spec-local test suite passing with 12 subtests. Keeping contradictory generated artifacts makes the change set harder to audit and can mislead future reviewers about the actual expected state.  
**Suggestion:** Delete the stale failing log, or regenerate it from the same final test run so the raw artifacts consistently reflect the current passing suite.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records 11 failing subtests, while `tests/.raw/test-execution.log` records the same spec-local test suite passing with 12 subtests. Keeping contradictory generated artifacts makes the change set harder to audit and can mislead future reviewers about the actual expected state.  
**Suggestion:** Delete the stale failing log, or regenerate it from the same final test run so the raw artifacts consistently reflect the current passing suite.
**Rationale:** Loop review proposal.

### 90. 2. Consolidate duplicated RunGate fixture setup
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `runGateFixture()` builds a large temporary spec, flow state, file map, Git repo, stub agent, and CLI invocation inline. Much of this mirrors existing setup concepts already represented by `fixtureSpec()`, `buildContext()`, and the shared temp/git helpers, but the function is long enough that the actual e2e assertion intent is buried.  
**Suggestion:** Split the setup into small helpers such as `writeGateFixtureProject()`, `writeGateFlowState()`, and `runTaskImplGate()`. Keep `runGateFixture()` as orchestration returning `{ tmp, execution, envelope, prompt, flowState }`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `runGateFixture()` builds a large temporary spec, flow state, file map, Git repo, stub agent, and CLI invocation inline. Much of this mirrors existing setup concepts already represented by `fixtureSpec()`, `buildContext()`, and the shared temp/git helpers, but the function is long enough that the actual e2e assertion intent is buried.  
**Suggestion:** Split the setup into small helpers such as `writeGateFixtureProject()`, `writeGateFlowState()`, and `runTaskImplGate()`. Keep `runGateFixture()` as orchestration returning `{ tmp, execution, envelope, prompt, flowState }`.
**Rationale:** Loop review proposal.

### 91. 3. Use a single requirement fixture factory for e2e cases
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** The R11 e2e fixtures repeatedly spell out requirement objects with the same `{ id, desc, priority: "must", status: "pending" }` shape. This duplicates boilerplate and makes the case-specific behavior less visible.  
**Suggestion:** Add a small helper like `requirement(id, desc)` or `mustRequirement(id, desc)` and use it in the `fixtures` array.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** The R11 e2e fixtures repeatedly spell out requirement objects with the same `{ id, desc, priority: "must", status: "pending" }` shape. This duplicates boilerplate and makes the case-specific behavior less visible.  
**Suggestion:** Add a small helper like `requirement(id, desc)` or `mustRequirement(id, desc)` and use it in the `fixtures` array.
**Rationale:** Loop review proposal.

### 92. 4. Avoid monkey-patching `fs` globally inside a test
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test temporarily replaces `fs.readFileSync` and `fs.writeFileSync` globally. Even with `finally` restoration, this pattern is brittle under concurrent test execution and can cause unrelated code in the same process to observe instrumented filesystem behavior.  
**Suggestion:** Prefer dependency injection through the command/container if available, or assert guard behavior through stable external effects only: unchanged artifact bytes, zero agent calls, and unchanged flow state. If read/write counting remains necessary, wrap the command’s filesystem dependency at its local boundary rather than patching Node’s `fs` module globally.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test temporarily replaces `fs.readFileSync` and `fs.writeFileSync` globally. Even with `finally` restoration, this pattern is brittle under concurrent test execution and can cause unrelated code in the same process to observe instrumented filesystem behavior.  
**Suggestion:** Prefer dependency injection through the command/container if available, or assert guard behavior through stable external effects only: unchanged artifact bytes, zero agent calls, and unchanged flow state. If read/write counting remains necessary, wrap the command’s filesystem dependency at its local boundary rather than patching Node’s `fs` module globally.
**Rationale:** Loop review proposal.

### 93. 5. Rename `responseResult` to reflect gate verdict casing
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `responseResult` is generic and easy to confuse with the full command result or envelope result. In the fixtures it specifically means the stubbed per-requirement evaluation verdict, using lowercase `"pass"`/`"fail"`.  
**Suggestion:** Rename it to `stubVerdict` or `evaluationVerdict`, and update `runGateFixture()` plus the R11 fixture table accordingly.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `responseResult` is generic and easy to confuse with the full command result or envelope result. In the fixtures it specifically means the stubbed per-requirement evaluation verdict, using lowercase `"pass"`/`"fail"`.  
**Suggestion:** Rename it to `stubVerdict` or `evaluationVerdict`, and update `runGateFixture()` plus the R11 fixture table accordingly.
**Rationale:** Loop review proposal.

### 94. 2. Consolidate duplicated RunGate fixture setup
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `runGateFixture()` builds a large temporary spec, flow state, file map, Git repo, stub agent, and CLI invocation inline. Much of this mirrors existing setup concepts already represented by `fixtureSpec()`, `buildContext()`, and the shared temp/git helpers, but the function is long enough that the actual e2e assertion intent is buried.  
**Suggestion:** Split the setup into small helpers such as `writeGateFixtureProject()`, `writeGateFlowState()`, and `runTaskImplGate()`. Keep `runGateFixture()` as orchestration returning `{ tmp, execution, envelope, prompt, flowState }`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `runGateFixture()` builds a large temporary spec, flow state, file map, Git repo, stub agent, and CLI invocation inline. Much of this mirrors existing setup concepts already represented by `fixtureSpec()`, `buildContext()`, and the shared temp/git helpers, but the function is long enough that the actual e2e assertion intent is buried.  
**Suggestion:** Split the setup into small helpers such as `writeGateFixtureProject()`, `writeGateFlowState()`, and `runTaskImplGate()`. Keep `runGateFixture()` as orchestration returning `{ tmp, execution, envelope, prompt, flowState }`.
**Rationale:** Loop review proposal.

### 95. 3. Use a single requirement fixture factory for e2e cases
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** The R11 e2e fixtures repeatedly spell out requirement objects with the same `{ id, desc, priority: "must", status: "pending" }` shape. This duplicates boilerplate and makes the case-specific behavior less visible.  
**Suggestion:** Add a small helper like `requirement(id, desc)` or `mustRequirement(id, desc)` and use it in the `fixtures` array.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** The R11 e2e fixtures repeatedly spell out requirement objects with the same `{ id, desc, priority: "must", status: "pending" }` shape. This duplicates boilerplate and makes the case-specific behavior less visible.  
**Suggestion:** Add a small helper like `requirement(id, desc)` or `mustRequirement(id, desc)` and use it in the `fixtures` array.
**Rationale:** Loop review proposal.

### 96. 4. Avoid monkey-patching `fs` globally inside a test
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test temporarily replaces `fs.readFileSync` and `fs.writeFileSync` globally. Even with `finally` restoration, this pattern is brittle under concurrent test execution and can cause unrelated code in the same process to observe instrumented filesystem behavior.  
**Suggestion:** Prefer dependency injection through the command/container if available, or assert guard behavior through stable external effects only: unchanged artifact bytes, zero agent calls, and unchanged flow state. If read/write counting remains necessary, wrap the command’s filesystem dependency at its local boundary rather than patching Node’s `fs` module globally.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test temporarily replaces `fs.readFileSync` and `fs.writeFileSync` globally. Even with `finally` restoration, this pattern is brittle under concurrent test execution and can cause unrelated code in the same process to observe instrumented filesystem behavior.  
**Suggestion:** Prefer dependency injection through the command/container if available, or assert guard behavior through stable external effects only: unchanged artifact bytes, zero agent calls, and unchanged flow state. If read/write counting remains necessary, wrap the command’s filesystem dependency at its local boundary rather than patching Node’s `fs` module globally.
**Rationale:** Loop review proposal.

### 97. 5. Rename `responseResult` to reflect gate verdict casing
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `responseResult` is generic and easy to confuse with the full command result or envelope result. In the fixtures it specifically means the stubbed per-requirement evaluation verdict, using lowercase `"pass"`/`"fail"`.  
**Suggestion:** Rename it to `stubVerdict` or `evaluationVerdict`, and update `runGateFixture()` plus the R11 fixture table accordingly.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** `responseResult` is generic and easy to confuse with the full command result or envelope result. In the fixtures it specifically means the stubbed per-requirement evaluation verdict, using lowercase `"pass"`/`"fail"`.  
**Suggestion:** Rename it to `stubVerdict` or `evaluationVerdict`, and update `runGateFixture()` plus the R11 fixture table accordingly.
**Rationale:** Loop review proposal.

### 98. 1. Fix Broken RegExp Escaping
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `escapeRegExp()` replaces every regex metacharacter with the literal string `\{{PROMPT}}`, so requirement IDs containing regex-significant characters are not matched correctly and may produce invalid exact-boundary matching behavior.  
**Suggestion:** Replace the implementation with the standard escaped-match replacement:
```js
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `escapeRegExp()` replaces every regex metacharacter with the literal string `\{{PROMPT}}`, so requirement IDs containing regex-significant characters are not matched correctly and may produce invalid exact-boundary matching behavior.  
**Suggestion:** Replace the implementation with the standard escaped-match replacement:
```js
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```
**Rationale:** Loop review proposal.

### 99. 2. Deduplicate Context Lookup and Batch Construction
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `buildRequirementGateBatches()` repeats the same `new RequirementGateBatch({ requirements: [requirement], contexts: ..., diff, maxChars, structuredSpec })` construction in two branches, and context lookup is split across multiple expressions. This makes future prompt-size/cache behavior changes easier to apply inconsistently.  
**Suggestion:** Add a small local helper such as `contextFor(requirement)` and `newBatch(requirement)` inside `buildRequirementGateBatches()`, then reuse it for the initial batch and rollover batch creation.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `buildRequirementGateBatches()` repeats the same `new RequirementGateBatch({ requirements: [requirement], contexts: ..., diff, maxChars, structuredSpec })` construction in two branches, and context lookup is split across multiple expressions. This makes future prompt-size/cache behavior changes easier to apply inconsistently.  
**Suggestion:** Add a small local helper such as `contextFor(requirement)` and `newBatch(requirement)` inside `buildRequirementGateBatches()`, then reuse it for the initial batch and rollover batch creation.
**Rationale:** Loop review proposal.

### 100. 3. Avoid Re-Filtering Entries For Every Rendered Section
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `RequirementGateContext.#render()` calls `this.entries.filter(...)` once per section. With bounded context this is not dangerous, but it duplicates scanning logic and makes the fixed section ordering harder to reason about.  
**Suggestion:** Group entries by section once before the render loop, then iterate `REQUIREMENT_CONTEXT_SECTION_ORDER` against that grouped map. This keeps ordering explicit while simplifying the loop.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `RequirementGateContext.#render()` calls `this.entries.filter(...)` once per section. With bounded context this is not dangerous, but it duplicates scanning logic and makes the fixed section ordering harder to reason about.  
**Suggestion:** Group entries by section once before the render loop, then iterate `REQUIREMENT_CONTEXT_SECTION_ORDER` against that grouped map. This keeps ordering explicit while simplifying the loop.
**Rationale:** Loop review proposal.

### 101. 4. Remove Duplicated Prompt Rendering Branches
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `RequirementGateBatch` repeats the “contexts versus raw requirements” rendering decision in the constructor and `fitsWith()`. The logic must stay byte-identical for cache stability, so duplication increases maintenance risk.  
**Suggestion:** Extract a helper like `renderRequirementGateInputs(requirements, contexts, usesFullSpec, fullSpecText)` or narrower `renderRequirementsOrContexts(requirements, contexts)`, and use it consistently in the constructor and `fitsWith()`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `RequirementGateBatch` repeats the “contexts versus raw requirements” rendering decision in the constructor and `fitsWith()`. The logic must stay byte-identical for cache stability, so duplication increases maintenance risk.  
**Suggestion:** Extract a helper like `renderRequirementGateInputs(requirements, contexts, usesFullSpec, fullSpecText)` or narrower `renderRequirementsOrContexts(requirements, contexts)`, and use it consistently in the constructor and `fitsWith()`.
**Rationale:** Loop review proposal.

### 102. 1. Fix Broken RegExp Escaping
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `escapeRegExp()` replaces every regex metacharacter with the literal string `\{{PROMPT}}`, so requirement IDs containing regex-significant characters are not matched correctly and may produce invalid exact-boundary matching behavior.  
**Suggestion:** Replace the implementation with the standard escaped-match replacement:
```js
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `escapeRegExp()` replaces every regex metacharacter with the literal string `\{{PROMPT}}`, so requirement IDs containing regex-significant characters are not matched correctly and may produce invalid exact-boundary matching behavior.  
**Suggestion:** Replace the implementation with the standard escaped-match replacement:
```js
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```
**Rationale:** Loop review proposal.

### 103. 2. Deduplicate Context Lookup and Batch Construction
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `buildRequirementGateBatches()` repeats the same `new RequirementGateBatch({ requirements: [requirement], contexts: ..., diff, maxChars, structuredSpec })` construction in two branches, and context lookup is split across multiple expressions. This makes future prompt-size/cache behavior changes easier to apply inconsistently.  
**Suggestion:** Add a small local helper such as `contextFor(requirement)` and `newBatch(requirement)` inside `buildRequirementGateBatches()`, then reuse it for the initial batch and rollover batch creation.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `buildRequirementGateBatches()` repeats the same `new RequirementGateBatch({ requirements: [requirement], contexts: ..., diff, maxChars, structuredSpec })` construction in two branches, and context lookup is split across multiple expressions. This makes future prompt-size/cache behavior changes easier to apply inconsistently.  
**Suggestion:** Add a small local helper such as `contextFor(requirement)` and `newBatch(requirement)` inside `buildRequirementGateBatches()`, then reuse it for the initial batch and rollover batch creation.
**Rationale:** Loop review proposal.

### 104. 3. Avoid Re-Filtering Entries For Every Rendered Section
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `RequirementGateContext.#render()` calls `this.entries.filter(...)` once per section. With bounded context this is not dangerous, but it duplicates scanning logic and makes the fixed section ordering harder to reason about.  
**Suggestion:** Group entries by section once before the render loop, then iterate `REQUIREMENT_CONTEXT_SECTION_ORDER` against that grouped map. This keeps ordering explicit while simplifying the loop.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** `RequirementGateContext.#render()` calls `this.entries.filter(...)` once per section. With bounded context this is not dangerous, but it duplicates scanning logic and makes the fixed section ordering harder to reason about.  
**Suggestion:** Group entries by section once before the render loop, then iterate `REQUIREMENT_CONTEXT_SECTION_ORDER` against that grouped map. This keeps ordering explicit while simplifying the loop.
**Rationale:** Loop review proposal.

### 105. 4. Remove Duplicated Prompt Rendering Branches
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `RequirementGateBatch` repeats the “contexts versus raw requirements” rendering decision in the constructor and `fitsWith()`. The logic must stay byte-identical for cache stability, so duplication increases maintenance risk.  
**Suggestion:** Extract a helper like `renderRequirementGateInputs(requirements, contexts, usesFullSpec, fullSpecText)` or narrower `renderRequirementsOrContexts(requirements, contexts)`, and use it consistently in the constructor and `fitsWith()`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `RequirementGateBatch` repeats the “contexts versus raw requirements” rendering decision in the constructor and `fitsWith()`. The logic must stay byte-identical for cache stability, so duplication increases maintenance risk.  
**Suggestion:** Extract a helper like `renderRequirementGateInputs(requirements, contexts, usesFullSpec, fullSpecText)` or narrower `renderRequirementsOrContexts(requirements, contexts)`, and use it consistently in the constructor and `fitsWith()`.
**Rationale:** Loop review proposal.

### 106. 5. Strengthen Tests Around Invalid Constructor Inputs
**Failure mode:** refactor
**File:** tests/unit/flow/gate-requirement-context.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R1  
**Issue:** The unit test covers successful rendering but does not exercise the new constructor rejection paths for empty references/text, unknown sections, unknown obligation kinds, non-positive caps, or context/requirement ID mismatches.  
**Suggestion:** Add focused `assert.throws()` cases for `RequirementContextEntry`, `RequirementObligation`, and `RequirementGateContext` invalid inputs so the immutability/value-object contract is protected directly.
**Suggestion:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R1  
**Issue:** The unit test covers successful rendering but does not exercise the new constructor rejection paths for empty references/text, unknown sections, unknown obligation kinds, non-positive caps, or context/requirement ID mismatches.  
**Suggestion:** Add focused `assert.throws()` cases for `RequirementContextEntry`, `RequirementObligation`, and `RequirementGateContext` invalid inputs so the immutability/value-object contract is protected directly.
**Rationale:** Loop review proposal.

### 107. 5. Strengthen Tests Around Invalid Constructor Inputs
**Failure mode:** refactor
**File:** tests/unit/flow/gate-requirement-context.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R1  
**Issue:** The unit test covers successful rendering but does not exercise the new constructor rejection paths for empty references/text, unknown sections, unknown obligation kinds, non-positive caps, or context/requirement ID mismatches.  
**Suggestion:** Add focused `assert.throws()` cases for `RequirementContextEntry`, `RequirementObligation`, and `RequirementGateContext` invalid inputs so the immutability/value-object contract is protected directly.
**Suggestion:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R1  
**Issue:** The unit test covers successful rendering but does not exercise the new constructor rejection paths for empty references/text, unknown sections, unknown obligation kinds, non-positive caps, or context/requirement ID mismatches.  
**Suggestion:** Add focused `assert.throws()` cases for `RequirementContextEntry`, `RequirementObligation`, and `RequirementGateContext` invalid inputs so the immutability/value-object contract is protected directly.
**Rationale:** Loop review proposal.

### 108. 1. Normalize Test Path Format Across Artifacts
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-coverage.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** Multiple artifacts use inconsistent paths for the same test file: some use `tests/requirement-gate-context.test.js`, while others use `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. This affects `test-coverage.json`, `test-execute-result.json`, and review-history targets, making cross-artifact traceability harder.  
**Suggestion:** Standardize on one repo-relative path format across all generated artifacts, preferably `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** Multiple artifacts use inconsistent paths for the same test file: some use `tests/requirement-gate-context.test.js`, while others use `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. This affects `test-coverage.json`, `test-execute-result.json`, and review-history targets, making cross-artifact traceability harder.  
**Suggestion:** Standardize on one repo-relative path format across all generated artifacts, preferably `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Rationale:** Loop review proposal.

### 109. 2. Use One Canonical Review Finding Representation
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/test-attempt-002.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-002.json`  
**Requirement:** R11  
**Issue:** Review findings are duplicated across JSON and Markdown files, and also duplicated within JSON as grouped arrays such as `blockingFindings` / `advisoryFindings` plus a separate `findings` array. This pattern appears across several review-history attempts and creates cross-file drift risk.  
**Suggestion:** Store findings once in a canonical structured JSON array, derive blocking/advisory groupings from fields like severity, and generate Markdown summaries from JSON instead of persisting independently maintained copies.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/test-attempt-002.json`  
**Requirement:** R11  
**Issue:** Review findings are duplicated across JSON and Markdown files, and also duplicated within JSON as grouped arrays such as `blockingFindings` / `advisoryFindings` plus a separate `findings` array. This pattern appears across several review-history attempts and creates cross-file drift risk.  
**Suggestion:** Store findings once in a canonical structured JSON array, derive blocking/advisory groupings from fields like severity, and generate Markdown summaries from JSON instead of persisting independently maintained copies.
**Rationale:** Loop review proposal.

### 110. 3. Consolidate Work-Unit Identity Metadata
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`  
**Requirement:** R2  
**Issue:** Several impl-review work-unit JSON files repeat the same identity fields both at the top level and under `identity`, including `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`. The repetition spans multiple files and can drift between artifacts.  
**Suggestion:** Normalize the work-unit schema so immutable identity metadata lives in one canonical object, preferably `identity`, with any flattened view derived at render/read time.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`  
**Requirement:** R2  
**Issue:** Several impl-review work-unit JSON files repeat the same identity fields both at the top level and under `identity`, including `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId`. The repetition spans multiple files and can drift between artifacts.  
**Suggestion:** Normalize the work-unit schema so immutable identity metadata lives in one canonical object, preferably `identity`, with any flattened view derived at render/read time.
**Rationale:** Loop review proposal.

### 111. 4. Store Provider Proposal Text Once
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R2  
**Issue:** Across multiple impl-review work-unit artifacts, proposal content is stored both as markdown in `rawResponse` and as parsed structured data in `success.proposals`. This duplicates long proposal bodies and risks inconsistency between raw and parsed representations.  
**Suggestion:** Treat `success.proposals` as canonical after successful parsing. Omit `rawResponse` for successful parsed outputs, or replace it with a checksum/debug excerpt.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R2  
**Issue:** Across multiple impl-review work-unit artifacts, proposal content is stored both as markdown in `rawResponse` and as parsed structured data in `success.proposals`. This duplicates long proposal bodies and risks inconsistency between raw and parsed representations.  
**Suggestion:** Treat `success.proposals` as canonical after successful parsing. Omit `rawResponse` for successful parsed outputs, or replace it with a checksum/debug excerpt.
**Rationale:** Loop review proposal.

### 112. 5. Enforce Requirement ID Contract Consistently
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`  
**Requirement:** R1  
**Issue:** Some stored impl-review proposal artifacts include `requirementId`, while others omit both the structured field and the mandatory `**Requirement:** <id>` line in proposal bodies. This creates an interface inconsistency across work-unit files and violates the stated provider contract.  
**Suggestion:** Add validation before persisting `status: "success"` so every proposal has a known requirement ID in both the structured field and rendered body, or reject the provider output.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`  
**Requirement:** R1  
**Issue:** Some stored impl-review proposal artifacts include `requirementId`, while others omit both the structured field and the mandatory `**Requirement:** <id>` line in proposal bodies. This creates an interface inconsistency across work-unit files and violates the stated provider contract.  
**Suggestion:** Add validation before persisting `status: "success"` so every proposal has a known requirement ID in both the structured field and rendered body, or reject the provider output.
**Rationale:** Loop review proposal.

### 113. 6. Normalize Proposal Title Data
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R11  
**Issue:** Some structured proposal titles include ordinal prefixes like `"1. ..."`, while ordering is already represented by array position. This mixes rendered presentation with data and is inconsistent with normalized proposal storage.  
**Suggestion:** Store proposal titles without numeric prefixes and add numbering only when rendering Markdown or CLI output.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/bd3798396b2128f722503801.json`  
**Requirement:** R11  
**Issue:** Some structured proposal titles include ordinal prefixes like `"1. ..."`, while ordering is already represented by array position. This mixes rendered presentation with data and is inconsistent with normalized proposal storage.  
**Suggestion:** Store proposal titles without numeric prefixes and add numbering only when rendering Markdown or CLI output.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
