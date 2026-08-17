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

### 11. 2. Collapse Repeated File Maps
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/file-map.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/file-map.json`
**Requirement:** R11
**Issue:** Most requirements repeat the same three-file list, while R6/R7/R8/R10 repeat a second shared list. This makes the map harder to maintain and invites drift if one requirement’s ownership changes.
**Suggestion:** Use a shared grouping representation if the file-map consumer supports it, or generate this file from named groups such as `unitRequirementContext` and `e2eRequirementContext`. If the JSON schema requires the current shape, add a generation step or source comment/documented source so the duplication is not hand-maintained.
**Suggestion:** **File:** `specs/319-requirement-gate-context/file-map.json`
**Requirement:** R11
**Issue:** Most requirements repeat the same three-file list, while R6/R7/R8/R10 repeat a second shared list. This makes the map harder to maintain and invites drift if one requirement’s ownership changes.
**Suggestion:** Use a shared grouping representation if the file-map consumer supports it, or generate this file from named groups such as `unitRequirementContext` and `e2eRequirementContext`. If the JSON schema requires the current shape, add a generation step or source comment/documented source so the duplication is not hand-maintained.
**Rationale:** Loop review proposal.

### 12. 3. Normalize Deferred Finding Fixtures
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/flow-findings.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/flow-findings.json`
**Requirement:** R9
**Issue:** The three entries are structurally identical except for `findingId` and `sourceFindingId`. The repeated fields make fixture intent harder to see and increase the chance of accidental divergence.
**Suggestion:** If this is hand-authored test/spec data, reduce it to a smaller canonical fixture or generate the repeated entries from a compact list of finding IDs. If the persisted schema requires full entries, prefer keeping only the minimum number of entries needed to prove multi-entry behavior.
**Suggestion:** **File:** `specs/319-requirement-gate-context/flow-findings.json`
**Requirement:** R9
**Issue:** The three entries are structurally identical except for `findingId` and `sourceFindingId`. The repeated fields make fixture intent harder to see and increase the chance of accidental divergence.
**Suggestion:** If this is hand-authored test/spec data, reduce it to a smaller canonical fixture or generate the repeated entries from a compact list of finding IDs. If the persisted schema requires full entries, prefer keeping only the minimum number of entries needed to prove multi-entry behavior.
**Rationale:** Loop review proposal.

### 13. 1. Remove Runtime State From Versioned Spec Artifact
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/flow.json
**Requirement:** R9
**Issue:** **File:** `specs/319-requirement-gate-context/flow.json`
**Requirement:** R9
**Issue:** The file mixes durable spec metadata with volatile execution state: timestamps, runtime logs, token metrics, retry counters, UUIDs, issue-log counters, and in-progress step status. This creates a large noisy artifact that will churn between runs and makes meaningful review harder.
**Suggestion:** Keep only the durable flow/spec fields needed by the feature, and move runtime-only execution history to an ignored/generated artifact if the system supports it. At minimum, strip `runtimeLog`, `metrics`, transient timestamps, and run-specific counters before committing.
**Suggestion:** **File:** `specs/319-requirement-gate-context/flow.json`
**Requirement:** R9
**Issue:** The file mixes durable spec metadata with volatile execution state: timestamps, runtime logs, token metrics, retry counters, UUIDs, issue-log counters, and in-progress step status. This creates a large noisy artifact that will churn between runs and makes meaningful review harder.
**Suggestion:** Keep only the durable flow/spec fields needed by the feature, and move runtime-only execution history to an ignored/generated artifact if the system supports it. At minimum, strip `runtimeLog`, `metrics`, transient timestamps, and run-specific counters before committing.
**Rationale:** Loop review proposal.

### 14. 4. Bound Large Historical Logs
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/issue-log.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/issue-log.json`
**Requirement:** R10
**Issue:** `issue-log.json` stores large free-form historical reasons and nested observations without an apparent retention or size bound. This conflicts with the bounded-resource-usage guardrail for bulk data retained in spec artifacts.
**Suggestion:** Add an explicit cap for retained issue-log entries and per-entry text length, or trim this committed artifact to the entries required as evidence for this requirement. If the long history is intentional, include a matched spec acknowledgment rationale that names `bounded-resource-usage` and states the concrete bounds.
**Suggestion:** **File:** `specs/319-requirement-gate-context/issue-log.json`
**Requirement:** R10
**Issue:** `issue-log.json` stores large free-form historical reasons and nested observations without an apparent retention or size bound. This conflicts with the bounded-resource-usage guardrail for bulk data retained in spec artifacts.
**Suggestion:** Add an explicit cap for retained issue-log entries and per-entry text length, or trim this committed artifact to the entries required as evidence for this requirement. If the long history is intentional, include a matched spec acknowledgment rationale that names `bounded-resource-usage` and states the concrete bounds.
**Rationale:** Loop review proposal.

### 15. 1. Remove duplicated issue body in localized details
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

### 16. 2. Avoid duplicated issue identifiers in prepare artifact
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

### 17. 3. Consider omitting empty review arrays from generated history
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

### 18. 4. Consider omitting empty review arrays from generated history
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

### 19. 1. Avoid Duplicating Finding Details Within The JSON Artifact
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

### 20. 2. Normalize Review History Markdown Generation
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

### 21. 3. Add Missing Trailing Newline
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

### 24. 1. Avoid Duplicating Finding Details Within The JSON Artifact
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

### 25. 2. Normalize Review History Markdown Generation
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

### 26. 3. Remove redundant finding fields inside the JSON artifact
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

### 27. 1. Eliminate duplicated review content between JSON and Markdown artifacts
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

### 28. 4. Remove redundant finding fields inside the JSON artifact
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

### 29. 5. Use consistent target path naming
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

### 30. 2. Eliminate duplicated review content between JSON and Markdown artifacts
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

### 31. 1. Remove Duplicated Review Artifacts
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

### 32. 5. Add Missing Trailing Newline
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

### 33. 2. Remove Duplicated Review Artifacts
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

### 34. 3. Normalize Finding Severity Naming
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

### 35. 4. Preserve Advisory Finding Details Consistently
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

### 36. 1. Remove Duplicated Review Artifacts
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

### 37. 2. Remove Duplicated Review Artifacts
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

### 38. 3. Normalize Finding Severity Naming
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

### 39. 4. Preserve Advisory Finding Details Consistently
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

### 40. 5. Add Missing Trailing Newline
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

### 41. 1. Remove Duplicated Review Artifacts
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

### 42. 2. Remove Duplicated Review Artifacts
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

### 43. 3. Normalize Finding Severity Naming
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

### 44. 4. Preserve Advisory Finding Details Consistently
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

### 45. 5. Add Missing Trailing Newline
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

### 46. 1. Add missing requirement IDs to stored proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`
**Requirement:** R1
**Issue:** `rawResponse` and every `success.proposals[].body` proposal omit the mandatory `**Requirement:** <id>` line, making the provider output invalid under the impl-review requirement contract.
**Suggestion:** Include a valid requirement line in each stored proposal body and in `rawResponse`, using one of the allowed IDs: R1-R11.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`
**Requirement:** R1
**Issue:** `rawResponse` and every `success.proposals[].body` proposal omit the mandatory `**Requirement:** <id>` line, making the provider output invalid under the impl-review requirement contract.
**Suggestion:** Include a valid requirement line in each stored proposal body and in `rawResponse`, using one of the allowed IDs: R1-R11.
**Rationale:** Loop review proposal.

### 47. 1. Add missing requirement IDs to stored proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`
**Requirement:** R1
**Issue:** `rawResponse` and every `success.proposals[].body` proposal omit the mandatory `**Requirement:** <id>` line, making the provider output invalid under the impl-review requirement contract.
**Suggestion:** Include a valid requirement line in each stored proposal body and in `rawResponse`, using one of the allowed IDs: R1-R11.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/018870d7c819e46bcb116c71.json`
**Requirement:** R1
**Issue:** `rawResponse` and every `success.proposals[].body` proposal omit the mandatory `**Requirement:** <id>` line, making the provider output invalid under the impl-review requirement contract.
**Suggestion:** Include a valid requirement line in each stored proposal body and in `rawResponse`, using one of the allowed IDs: R1-R11.
**Rationale:** Loop review proposal.

### 48. 2. Add missing requirement IDs to spec review proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json`
**Requirement:** R1
**Issue:** The four stored proposals in `rawResponse` and `success.proposals[].body` do not include `**Requirement:** <id>`, despite the mandatory output contract.
**Suggestion:** Update each proposal body to include the relevant requirement ID, and ensure the serialized `rawResponse` mirrors the same compliant text.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json`
**Requirement:** R1
**Issue:** The four stored proposals in `rawResponse` and `success.proposals[].body` do not include `**Requirement:** <id>`, despite the mandatory output contract.
**Suggestion:** Update each proposal body to include the relevant requirement ID, and ensure the serialized `rawResponse` mirrors the same compliant text.
**Rationale:** Loop review proposal.

### 49. 3. Add missing requirement IDs to run-gate review proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`
**Requirement:** R1
**Issue:** All six proposals omit the required `**Requirement:** <id>` line in both `rawResponse` and structured proposal bodies.
**Suggestion:** Add a valid requirement line to each proposal before persisting the review result.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`
**Requirement:** R1
**Issue:** All six proposals omit the required `**Requirement:** <id>` line in both `rawResponse` and structured proposal bodies.
**Suggestion:** Add a valid requirement line to each proposal before persisting the review result.
**Rationale:** Loop review proposal.

### 50. 4. Avoid duplicating full proposal text in two fields
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`
**Requirement:** R10
**Issue:** The file stores the same proposal content twice: once as the large `rawResponse` string and again as parsed `success.proposals[].body`. This duplication increases drift risk and makes fixes like adding requirement IDs easy to apply inconsistently.
**Suggestion:** Prefer one authoritative representation. Keep parsed `success.proposals` for consumers and either omit `rawResponse`, retain it only for failures, or generate it from structured proposals when needed.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`
**Requirement:** R10
**Issue:** The file stores the same proposal content twice: once as the large `rawResponse` string and again as parsed `success.proposals[].body`. This duplication increases drift risk and makes fixes like adding requirement IDs easy to apply inconsistently.
**Suggestion:** Prefer one authoritative representation. Keep parsed `success.proposals` for consumers and either omit `rawResponse`, retain it only for failures, or generate it from structured proposals when needed.
**Rationale:** Loop review proposal.

### 51. 2. Add missing requirement IDs to spec review proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json`
**Requirement:** R1
**Issue:** The four stored proposals in `rawResponse` and `success.proposals[].body` do not include `**Requirement:** <id>`, despite the mandatory output contract.
**Suggestion:** Update each proposal body to include the relevant requirement ID, and ensure the serialized `rawResponse` mirrors the same compliant text.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/11401db1d0226f1231be2ae2.json`
**Requirement:** R1
**Issue:** The four stored proposals in `rawResponse` and `success.proposals[].body` do not include `**Requirement:** <id>`, despite the mandatory output contract.
**Suggestion:** Update each proposal body to include the relevant requirement ID, and ensure the serialized `rawResponse` mirrors the same compliant text.
**Rationale:** Loop review proposal.

### 52. 3. Add missing requirement IDs to run-gate review proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`
**Requirement:** R1
**Issue:** All six proposals omit the required `**Requirement:** <id>` line in both `rawResponse` and structured proposal bodies.
**Suggestion:** Add a valid requirement line to each proposal before persisting the review result.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`
**Requirement:** R1
**Issue:** All six proposals omit the required `**Requirement:** <id>` line in both `rawResponse` and structured proposal bodies.
**Suggestion:** Add a valid requirement line to each proposal before persisting the review result.
**Rationale:** Loop review proposal.

### 53. 4. Avoid duplicating full proposal text in two fields
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`
**Requirement:** R10
**Issue:** The file stores the same proposal content twice: once as the large `rawResponse` string and again as parsed `success.proposals[].body`. This duplication increases drift risk and makes fixes like adding requirement IDs easy to apply inconsistently.
**Suggestion:** Prefer one authoritative representation. Keep parsed `success.proposals` for consumers and either omit `rawResponse`, retain it only for failures, or generate it from structured proposals when needed.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/2802ea34b3003a0b446168d0.json`
**Requirement:** R10
**Issue:** The file stores the same proposal content twice: once as the large `rawResponse` string and again as parsed `success.proposals[].body`. This duplication increases drift risk and makes fixes like adding requirement IDs easy to apply inconsistently.
**Suggestion:** Prefer one authoritative representation. Keep parsed `success.proposals` for consumers and either omit `rawResponse`, retain it only for failures, or generate it from structured proposals when needed.
**Rationale:** Loop review proposal.

### 54. 2. Enforce Requirement IDs In Stored Proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`
**Requirement:** R1
**Issue:** Stored proposal bodies omit the mandatory `**Requirement:** <id>` line required by the review contract. This makes the artifact invalid for consumers that rely on requirement-gated proposals.
**Suggestion:** Add a `requirement` field to each structured proposal and ensure `rawResponse`/`body` includes `**Requirement:** ...`; reject or repair provider outputs missing one of the allowed IDs.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`
**Requirement:** R1
**Issue:** Stored proposal bodies omit the mandatory `**Requirement:** <id>` line required by the review contract. This makes the artifact invalid for consumers that rely on requirement-gated proposals.
**Suggestion:** Add a `requirement` field to each structured proposal and ensure `rawResponse`/`body` includes `**Requirement:** ...`; reject or repair provider outputs missing one of the allowed IDs.
**Rationale:** Loop review proposal.

### 55. 4. Deduplicate Identity Metadata
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`
**Requirement:** R10
**Issue:** Metadata such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` is duplicated at the top level and inside `identity`. This increases drift risk and makes the artifact noisier.
**Suggestion:** Keep immutable run identity fields under `identity` and remove the duplicated top-level copies, or define top-level fields as canonical and reduce `identity` to only ordering/parent fields.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`
**Requirement:** R10
**Issue:** Metadata such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` is duplicated at the top level and inside `identity`. This increases drift risk and makes the artifact noisier.
**Suggestion:** Keep immutable run identity fields under `identity` and remove the duplicated top-level copies, or define top-level fields as canonical and reduce `identity` to only ordering/parent fields.
**Rationale:** Loop review proposal.

### 56. 3. Enforce Requirement IDs In Loop-Chunk Results
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`
**Requirement:** R1
**Issue:** The proposal in both `rawResponse` and `success.proposals[0].body` lacks the mandatory `**Requirement:** <id>` line, so the output does not satisfy the stated implementation-review contract.
**Suggestion:** Normalize loop-chunk proposal parsing to require and persist a valid requirement ID, or mark this work unit as failed instead of `success`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`
**Requirement:** R1
**Issue:** The proposal in both `rawResponse` and `success.proposals[0].body` lacks the mandatory `**Requirement:** <id>` line, so the output does not satisfy the stated implementation-review contract.
**Suggestion:** Normalize loop-chunk proposal parsing to require and persist a valid requirement ID, or mark this work unit as failed instead of `success`.
**Rationale:** Loop review proposal.

### 57. 1. Remove Non-Result Commentary From Captured Proposal Title
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`
**Requirement:** R1
**Issue:** The first proposal title includes assistant process narration before the actual heading: `I’ll review only...### 1. Inline Fixture Setup Is Too Large`. This pollutes structured review history and makes downstream rendering/deduplication harder.
**Suggestion:** Strip conversational preamble from `rawResponse` before parsing, or repair this artifact so the first title is only `1. Inline Fixture Setup Is Too Large`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`
**Requirement:** R1
**Issue:** The first proposal title includes assistant process narration before the actual heading: `I’ll review only...### 1. Inline Fixture Setup Is Too Large`. This pollutes structured review history and makes downstream rendering/deduplication harder.
**Suggestion:** Strip conversational preamble from `rawResponse` before parsing, or repair this artifact so the first title is only `1. Inline Fixture Setup Is Too Large`.
**Rationale:** Loop review proposal.

### 58. 5. Avoid Storing The Same Proposal Twice
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`
**Requirement:** R10
**Issue:** Each proposal is stored both as markdown in `rawResponse` and again as structured entries under `success.proposals`. This duplicates content and allows the two representations to diverge.
**Suggestion:** Store the structured `success.proposals` as canonical and either omit `rawResponse` after successful parsing or keep only a compact raw-output reference/checksum for debugging.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`
**Requirement:** R10
**Issue:** Each proposal is stored both as markdown in `rawResponse` and again as structured entries under `success.proposals`. This duplicates content and allows the two representations to diverge.
**Suggestion:** Store the structured `success.proposals` as canonical and either omit `rawResponse` after successful parsing or keep only a compact raw-output reference/checksum for debugging.
**Rationale:** Loop review proposal.

### 59. 1. Remove Non-Result Commentary From Captured Proposal Title
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`
**Requirement:** R1
**Issue:** The first proposal title includes assistant process narration before the actual heading: `I’ll review only...### 1. Inline Fixture Setup Is Too Large`. This pollutes structured review history and makes downstream rendering/deduplication harder.
**Suggestion:** Strip conversational preamble from `rawResponse` before parsing, or repair this artifact so the first title is only `1. Inline Fixture Setup Is Too Large`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`
**Requirement:** R1
**Issue:** The first proposal title includes assistant process narration before the actual heading: `I’ll review only...### 1. Inline Fixture Setup Is Too Large`. This pollutes structured review history and makes downstream rendering/deduplication harder.
**Suggestion:** Strip conversational preamble from `rawResponse` before parsing, or repair this artifact so the first title is only `1. Inline Fixture Setup Is Too Large`.
**Rationale:** Loop review proposal.

### 60. 2. Enforce Requirement IDs In Stored Proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`
**Requirement:** R1
**Issue:** Stored proposal bodies omit the mandatory `**Requirement:** <id>` line required by the review contract. This makes the artifact invalid for consumers that rely on requirement-gated proposals.
**Suggestion:** Add a `requirement` field to each structured proposal and ensure `rawResponse`/`body` includes `**Requirement:** ...`; reject or repair provider outputs missing one of the allowed IDs.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`
**Requirement:** R1
**Issue:** Stored proposal bodies omit the mandatory `**Requirement:** <id>` line required by the review contract. This makes the artifact invalid for consumers that rely on requirement-gated proposals.
**Suggestion:** Add a `requirement` field to each structured proposal and ensure `rawResponse`/`body` includes `**Requirement:** ...`; reject or repair provider outputs missing one of the allowed IDs.
**Rationale:** Loop review proposal.

### 61. 3. Enforce Requirement IDs In Loop-Chunk Results
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`
**Requirement:** R1
**Issue:** The proposal in both `rawResponse` and `success.proposals[0].body` lacks the mandatory `**Requirement:** <id>` line, so the output does not satisfy the stated implementation-review contract.
**Suggestion:** Normalize loop-chunk proposal parsing to require and persist a valid requirement ID, or mark this work unit as failed instead of `success`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/427dfbd203456f4fae825b67.json`
**Requirement:** R1
**Issue:** The proposal in both `rawResponse` and `success.proposals[0].body` lacks the mandatory `**Requirement:** <id>` line, so the output does not satisfy the stated implementation-review contract.
**Suggestion:** Normalize loop-chunk proposal parsing to require and persist a valid requirement ID, or mark this work unit as failed instead of `success`.
**Rationale:** Loop review proposal.

### 62. 4. Deduplicate Identity Metadata
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`
**Requirement:** R10
**Issue:** Metadata such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` is duplicated at the top level and inside `identity`. This increases drift risk and makes the artifact noisier.
**Suggestion:** Keep immutable run identity fields under `identity` and remove the duplicated top-level copies, or define top-level fields as canonical and reduce `identity` to only ordering/parent fields.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/37639b52df928c8943fb550e.json`
**Requirement:** R10
**Issue:** Metadata such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` is duplicated at the top level and inside `identity`. This increases drift risk and makes the artifact noisier.
**Suggestion:** Keep immutable run identity fields under `identity` and remove the duplicated top-level copies, or define top-level fields as canonical and reduce `identity` to only ordering/parent fields.
**Rationale:** Loop review proposal.

### 63. 5. Avoid Storing The Same Proposal Twice
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`
**Requirement:** R10
**Issue:** Each proposal is stored both as markdown in `rawResponse` and again as structured entries under `success.proposals`. This duplicates content and allows the two representations to diverge.
**Suggestion:** Store the structured `success.proposals` as canonical and either omit `rawResponse` after successful parsing or keep only a compact raw-output reference/checksum for debugging.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/562c706852c82bb0fcee42e9.json`
**Requirement:** R10
**Issue:** Each proposal is stored both as markdown in `rawResponse` and again as structured entries under `success.proposals`. This duplicates content and allows the two representations to diverge.
**Suggestion:** Store the structured `success.proposals` as canonical and either omit `rawResponse` after successful parsing or keep only a compact raw-output reference/checksum for debugging.
**Rationale:** Loop review proposal.

### 64. 1. Persisted proposals violate the requirement contract
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`  
**Requirement:** R1  
**Issue:** The stored `rawResponse` proposals and `success.proposals[].body` entries do not include the mandatory `**Requirement:** <id>` line. This makes the review artifact invalid under the stated impl-review contract.  
**Suggestion:** Regenerate or normalize each stored proposal body to include a valid requirement ID from the allowed set, for example `**Requirement:** R7`, before persisting the artifact.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/59fa3a31c681356961cc7bdf.json`  
**Requirement:** R1  
**Issue:** The stored `rawResponse` proposals and `success.proposals[].body` entries do not include the mandatory `**Requirement:** <id>` line. This makes the review artifact invalid under the stated impl-review contract.  
**Suggestion:** Regenerate or normalize each stored proposal body to include a valid requirement ID from the allowed set, for example `**Requirement:** R7`, before persisting the artifact.
**Rationale:** Loop review proposal.

### 65. 4. Duplicate identity metadata is repeated verbatim
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json
**Requirement:** R3
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R3  
**Issue:** Fields such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` are duplicated both at the top level and inside `identity`. This repetition appears across all new work-unit artifacts and creates drift risk.  
**Suggestion:** Keep these fields in one canonical location, preferably `identity`, and derive the top-level view only when needed by readers.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/635b54e59ef6bd709a49df1c.json`  
**Requirement:** R3  
**Issue:** Fields such as `targetFiles`, `inputHash`, `providerIdentity`, `promptVersion`, `schemaVersion`, and `unitId` are duplicated both at the top level and inside `identity`. This repetition appears across all new work-unit artifacts and creates drift risk.  
**Suggestion:** Keep these fields in one canonical location, preferably `identity`, and derive the top-level view only when needed by readers.
**Rationale:** Loop review proposal.

### 66. 2. Cross-check artifact contains out-of-scope proposal file references
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json
**Requirement:** R2
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`  
**Requirement:** R2  
**Issue:** Several persisted proposals reference files that are not present in this change-set diff, such as `specs/319-requirement-gate-context/spec.md`, `specs/319-requirement-gate-context/draft.json`, and `specs/319-requirement-gate-context/issue-log.json`. That violates the mandatory scope constraint for provider output.  
**Suggestion:** Filter proposals at persistence time so `success.proposals[].file` and every `**File:**` line must be one of the files actually touched by the diff being reviewed.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`  
**Requirement:** R2  
**Issue:** Several persisted proposals reference files that are not present in this change-set diff, such as `specs/319-requirement-gate-context/spec.md`, `specs/319-requirement-gate-context/draft.json`, and `specs/319-requirement-gate-context/issue-log.json`. That violates the mandatory scope constraint for provider output.  
**Suggestion:** Filter proposals at persistence time so `success.proposals[].file` and every `**File:**` line must be one of the files actually touched by the diff being reviewed.
**Rationale:** Loop review proposal.

### 67. 3. Cross-check proposals also miss requirement IDs
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`  
**Requirement:** R1  
**Issue:** The `rawResponse` and `success.proposals[].body` entries omit the mandatory `**Requirement:** <id>` line for every proposal. This is the same contract violation repeated in the larger cross-check artifact.  
**Suggestion:** Add validation that rejects or repairs proposal output missing a known requirement ID before writing the work-unit JSON.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/68c8724c88dc3077b9eb2525.json`  
**Requirement:** R1  
**Issue:** The `rawResponse` and `success.proposals[].body` entries omit the mandatory `**Requirement:** <id>` line for every proposal. This is the same contract violation repeated in the larger cross-check artifact.  
**Suggestion:** Add validation that rejects or repairs proposal output missing a known requirement ID before writing the work-unit JSON.
**Rationale:** Loop review proposal.

### 68. 5. Repair artifact proposals miss requirement IDs
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R1  
**Issue:** Both persisted proposals lack the required `**Requirement:** <id>` line in `rawResponse` and `success.proposals[].body`.  
**Suggestion:** Update the proposal serialization path to include and validate `Requirement` alongside `File`, `Issue`, and `Suggestion` for every proposal.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/75f4871091a34c2fc78b9a8b.json`  
**Requirement:** R1  
**Issue:** Both persisted proposals lack the required `**Requirement:** <id>` line in `rawResponse` and `success.proposals[].body`.  
**Suggestion:** Update the proposal serialization path to include and validate `Requirement` alongside `File`, `Issue`, and `Suggestion` for every proposal.
**Rationale:** Loop review proposal.

### 69. 1. Add requirement IDs to stored review proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R1  
**Issue:** The embedded `rawResponse` and each `success.proposals[].body` contain proposals without the mandatory `**Requirement:** <id>` line, making the stored provider output invalid under the impl-review requirement contract.  
**Suggestion:** Regenerate or normalize the stored proposals so every proposal body includes a valid requirement line, such as `**Requirement:** R3`, before `**Issue:**`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/c43a47f76d207c075c9f3648.json`  
**Requirement:** R1  
**Issue:** The embedded `rawResponse` and each `success.proposals[].body` contain proposals without the mandatory `**Requirement:** <id>` line, making the stored provider output invalid under the impl-review requirement contract.  
**Suggestion:** Regenerate or normalize the stored proposals so every proposal body includes a valid requirement line, such as `**Requirement:** R3`, before `**Issue:**`.
**Rationale:** Loop review proposal.

### 70. 2. Add requirement IDs to single-proposal review output
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R1  
**Issue:** The stored proposal omits the mandatory `**Requirement:** <id>` field in both `rawResponse` and `success.proposals[0].body`.  
**Suggestion:** Add a valid requirement mapping to the proposal body or reject this generated artifact as schema-invalid during review result persistence.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/d7e860f04f301bf9cac6a177.json`  
**Requirement:** R1  
**Issue:** The stored proposal omits the mandatory `**Requirement:** <id>` field in both `rawResponse` and `success.proposals[0].body`.  
**Suggestion:** Add a valid requirement mapping to the proposal body or reject this generated artifact as schema-invalid during review result persistence.
**Rationale:** Loop review proposal.

### 71. 3. Remove invalid cross-check proposals that reference files outside this diff
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/ef8dc0799dc0cb3c7083f668.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/ef8dc0799dc0cb3c7083f668.json`  
**Requirement:** R1  
**Issue:** Several embedded proposals use `**File:**` values that are not files present in the supplied diff, including `spec.md`, `draft.json`, `draft-gate-source.json`, and test files outside this change set. That violates the mandatory scope constraint for this review output.  
**Suggestion:** Regenerate the cross-check response constrained to the touched files only, or filter out proposals whose `file` is not one of the files in the current diff before persisting.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/ef8dc0799dc0cb3c7083f668.json`  
**Requirement:** R1  
**Issue:** Several embedded proposals use `**File:**` values that are not files present in the supplied diff, including `spec.md`, `draft.json`, `draft-gate-source.json`, and test files outside this change set. That violates the mandatory scope constraint for this review output.  
**Suggestion:** Regenerate the cross-check response constrained to the touched files only, or filter out proposals whose `file` is not one of the files in the current diff before persisting.
**Rationale:** Loop review proposal.

### 72. 4. Add requirement IDs to cross-check proposals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/review-history/work-units/impl-review/ef8dc0799dc0cb3c7083f668.json
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/ef8dc0799dc0cb3c7083f668.json`  
**Requirement:** R1  
**Issue:** The embedded cross-check proposals also omit the required `**Requirement:** <id>` line, so even the in-scope proposals would be invalid.  
**Suggestion:** Update the review serializer or validation gate to require `**Requirement:**` in `rawResponse` and each structured proposal body before marking the work unit `success`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/review-history/work-units/impl-review/ef8dc0799dc0cb3c7083f668.json`  
**Requirement:** R1  
**Issue:** The embedded cross-check proposals also omit the required `**Requirement:** <id>` line, so even the in-scope proposals would be invalid.  
**Suggestion:** Update the review serializer or validation gate to require `**Requirement:**` in `rawResponse` and each structured proposal body before marking the work unit `success`.
**Rationale:** Loop review proposal.

### 73. 5. Deduplicate repeated evidence fields
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/scenario-validity-result.json
**Requirement:** R3
**Issue:** **File:** `specs/319-requirement-gate-context/scenario-validity-result.json`  
**Requirement:** R3  
**Issue:** Every `summary` entry repeats identical `test_file`, `command`, and `raw_output_lines` values. This creates noisy generated output and increases drift risk if the command or log range changes.  
**Suggestion:** Move shared evidence fields to a top-level `evidence_defaults` object and keep only per-requirement values like `id`, `classification`, and `test_name` inside each summary item.
**Suggestion:** **File:** `specs/319-requirement-gate-context/scenario-validity-result.json`  
**Requirement:** R3  
**Issue:** Every `summary` entry repeats identical `test_file`, `command`, and `raw_output_lines` values. This creates noisy generated output and increases drift risk if the command or log range changes.  
**Suggestion:** Move shared evidence fields to a top-level `evidence_defaults` object and keep only per-requirement values like `id`, `classification`, and `test_name` inside each summary item.
**Rationale:** Loop review proposal.

### 74. 1. Remove Empty Open Questions Placeholder
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

### 75. 2. Define Diff Evidence Citation Format Explicitly
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

### 76. 2. Define Diff Evidence Citation Format Explicitly
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

### 77. 1. Remove Empty Open Questions Placeholder
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

### 78. 1. Remove Empty Open Questions Placeholder
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

### 79. 2. Define Diff Evidence Citation Format Explicitly
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

### 80. 2. Use Consistent Test File Paths
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-coverage.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The `requirements[*].files` entries use `tests/requirement-gate-context.test.js`, while `test-execute-result.json` references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes cross-artifact comparison harder and may confuse tooling.  
**Suggestion:** Use the same repo-relative path format across artifacts, preferably `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The `requirements[*].files` entries use `tests/requirement-gate-context.test.js`, while `test-execute-result.json` references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes cross-artifact comparison harder and may confuse tooling.  
**Suggestion:** Use the same repo-relative path format across artifacts, preferably `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Rationale:** Loop review proposal.

### 81. 1. Normalize Repeated Failure Evidence
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-execute-result.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each requirement summary repeats the same `result`, `error`, `command`, `test_file`, and `raw_output_lines`, making the artifact large and harder to maintain or review.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level object and keep only requirement-specific fields like `id` and `test_name` in each summary entry.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each requirement summary repeats the same `result`, `error`, `command`, `test_file`, and `raw_output_lines`, making the artifact large and harder to maintain or review.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level object and keep only requirement-specific fields like `id` and `test_name` in each summary entry.
**Rationale:** Loop review proposal.

### 82. 1. Normalize Repeated Failure Evidence
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-execute-result.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each requirement summary repeats the same `result`, `error`, `command`, `test_file`, and `raw_output_lines`, making the artifact large and harder to maintain or review.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level object and keep only requirement-specific fields like `id` and `test_name` in each summary entry.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-execute-result.json`  
**Requirement:** R11  
**Issue:** Each requirement summary repeats the same `result`, `error`, `command`, `test_file`, and `raw_output_lines`, making the artifact large and harder to maintain or review.  
**Suggestion:** If the artifact contract allows it, move shared execution metadata to a top-level object and keep only requirement-specific fields like `id` and `test_name` in each summary entry.
**Rationale:** Loop review proposal.

### 83. 2. Use Consistent Test File Paths
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-coverage.json
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The `requirements[*].files` entries use `tests/requirement-gate-context.test.js`, while `test-execute-result.json` references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes cross-artifact comparison harder and may confuse tooling.  
**Suggestion:** Use the same repo-relative path format across artifacts, preferably `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-coverage.json`  
**Requirement:** R11  
**Issue:** The `requirements[*].files` entries use `tests/requirement-gate-context.test.js`, while `test-execute-result.json` references `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`. The mismatch makes cross-artifact comparison harder and may confuse tooling.  
**Suggestion:** Use the same repo-relative path format across artifacts, preferably `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`.
**Rationale:** Loop review proposal.

### 84. 3. Avoid Duplicate Human-Readable Review Content
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-result-review.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-result-review.md`  
**Requirement:** R11  
**Issue:** The Markdown file duplicates the same verdict, checked items, and result paths already present in `test-result-review.json`. This creates a drift risk when one artifact is regenerated or edited without the other.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or remove the Markdown artifact if no consumer requires it.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-result-review.md`  
**Requirement:** R11  
**Issue:** The Markdown file duplicates the same verdict, checked items, and result paths already present in `test-result-review.json`. This creates a drift risk when one artifact is regenerated or edited without the other.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or remove the Markdown artifact if no consumer requires it.
**Rationale:** Loop review proposal.

### 85. 3. Avoid Duplicate Human-Readable Review Content
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/test-result-review.md
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/test-result-review.md`  
**Requirement:** R11  
**Issue:** The Markdown file duplicates the same verdict, checked items, and result paths already present in `test-result-review.json`. This creates a drift risk when one artifact is regenerated or edited without the other.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or remove the Markdown artifact if no consumer requires it.
**Suggestion:** **File:** `specs/319-requirement-gate-context/test-result-review.md`  
**Requirement:** R11  
**Issue:** The Markdown file duplicates the same verdict, checked items, and result paths already present in `test-result-review.json`. This creates a drift risk when one artifact is regenerated or edited without the other.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or remove the Markdown artifact if no consumer requires it.
**Rationale:** Loop review proposal.

### 86. 1. Remove Stale Raw Failure Logs
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/.raw/scenario-validity.log
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records an obsolete run where all 11 subtests fail due to missing exports. It duplicates transient execution output and can mislead reviewers because the current test file now has 12 subtests and different behavior.  
**Suggestion:** Remove the stale raw log, or regenerate it only as part of a clearly versioned test artifact flow if these logs are required.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records an obsolete run where all 11 subtests fail due to missing exports. It duplicates transient execution output and can mislead reviewers because the current test file now has 12 subtests and different behavior.  
**Suggestion:** Remove the stale raw log, or regenerate it only as part of a clearly versioned test artifact flow if these logs are required.
**Rationale:** Loop review proposal.

### 87. 2. Avoid Checking In Failed Intermediate Test Output
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/.raw/test-execution.log
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/.raw/test-execution.log`  
**Requirement:** R11  
**Issue:** The raw execution log records a failed intermediate state with 2 failing subtests. As a committed artifact, it conflicts with the expectation that spec-local coverage is authoritative and makes it unclear whether failure is expected or stale.  
**Suggestion:** Remove this log from the change set, or replace it with a current passing execution artifact if the project intentionally tracks raw test output.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/.raw/test-execution.log`  
**Requirement:** R11  
**Issue:** The raw execution log records a failed intermediate state with 2 failing subtests. As a committed artifact, it conflicts with the expectation that spec-local coverage is authoritative and makes it unclear whether failure is expected or stale.  
**Suggestion:** Remove this log from the change set, or replace it with a current passing execution artifact if the project intentionally tracks raw test output.
**Rationale:** Loop review proposal.

### 88. 3. Deduplicate Prompt Evaluation Stub Setup
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R6
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R6  
**Issue:** `evaluateWithPromptAwareStub()` constructs a batch, builds a prompt, defines an agent-like object, calls it, and parses the response. This repeats production-adjacent orchestration logic in test-local form and makes R6/R7/R8 tests depend on a custom mini-runner.  
**Suggestion:** Extract a smaller helper that only converts a `decide()` result into the parsed evaluation, or use the real `RunGateCommand` fixture path for these semantic cases to keep the design pattern consistent with the R11 end-to-end coverage.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R6  
**Issue:** `evaluateWithPromptAwareStub()` constructs a batch, builds a prompt, defines an agent-like object, calls it, and parses the response. This repeats production-adjacent orchestration logic in test-local form and makes R6/R7/R8 tests depend on a custom mini-runner.  
**Suggestion:** Extract a smaller helper that only converts a `decide()` result into the parsed evaluation, or use the real `RunGateCommand` fixture path for these semantic cases to keep the design pattern consistent with the R11 end-to-end coverage.
**Rationale:** Loop review proposal.

### 89. 4. Rename Ambiguous `fixtureSpec`
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R1  
**Issue:** `fixtureSpec()` is very broad, but it specifically creates a requirement gate context fixture with R1/R10 defaults. The generic name makes later tests harder to scan because many override only small portions of a highly opinionated base object.  
**Suggestion:** Rename it to something more precise, such as `requirementContextSpecFixture()` or `baseRequirementGateSpec()`, and update call sites.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R1  
**Issue:** `fixtureSpec()` is very broad, but it specifically creates a requirement gate context fixture with R1/R10 defaults. The generic name makes later tests harder to scan because many override only small portions of a highly opinionated base object.  
**Suggestion:** Rename it to something more precise, such as `requirementContextSpecFixture()` or `baseRequirementGateSpec()`, and update call sites.
**Rationale:** Loop review proposal.

### 90. 5. Ensure Temporary Guard Fixture Cleanup Uses `finally`
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test removes `root` only at the end of the happy path. If an assertion fails after the filesystem monkey-patch is restored, the temporary directory is left behind.  
**Suggestion:** Wrap the full R10 fixture body in a `try/finally` and call `fs.rmSync(root, { recursive: true, force: true })` in the finalizer, matching the cleanup pattern already used by `runGateFixture()` callers.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test removes `root` only at the end of the happy path. If an assertion fails after the filesystem monkey-patch is restored, the temporary directory is left behind.  
**Suggestion:** Wrap the full R10 fixture body in a `try/finally` and call `fs.rmSync(root, { recursive: true, force: true })` in the finalizer, matching the cleanup pattern already used by `runGateFixture()` callers.
**Rationale:** Loop review proposal.

### 91. 6. Consolidate Repeated Requirement Literals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** R6 and R7 requirement objects, acceptance strings, file-map paths, and diff snippets are repeated across unit-style tests and the R11 end-to-end fixture table. This duplication increases the chance that coverage drifts between the prompt-level and RunGateCommand-level assertions.  
**Suggestion:** Define named fixture constants for the Issue #432 preservation case and Issue #434 canonical path case, then reuse them in both the focused prompt tests and the end-to-end fixture table.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** R6 and R7 requirement objects, acceptance strings, file-map paths, and diff snippets are repeated across unit-style tests and the R11 end-to-end fixture table. This duplication increases the chance that coverage drifts between the prompt-level and RunGateCommand-level assertions.  
**Suggestion:** Define named fixture constants for the Issue #432 preservation case and Issue #434 canonical path case, then reuse them in both the focused prompt tests and the end-to-end fixture table.
**Rationale:** Loop review proposal.

### 92. 1. Remove Stale Raw Failure Logs
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/.raw/scenario-validity.log
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records an obsolete run where all 11 subtests fail due to missing exports. It duplicates transient execution output and can mislead reviewers because the current test file now has 12 subtests and different behavior.  
**Suggestion:** Remove the stale raw log, or regenerate it only as part of a clearly versioned test artifact flow if these logs are required.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/.raw/scenario-validity.log`  
**Requirement:** R11  
**Issue:** This checked-in raw log records an obsolete run where all 11 subtests fail due to missing exports. It duplicates transient execution output and can mislead reviewers because the current test file now has 12 subtests and different behavior.  
**Suggestion:** Remove the stale raw log, or regenerate it only as part of a clearly versioned test artifact flow if these logs are required.
**Rationale:** Loop review proposal.

### 93. 2. Avoid Checking In Failed Intermediate Test Output
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/.raw/test-execution.log
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/.raw/test-execution.log`  
**Requirement:** R11  
**Issue:** The raw execution log records a failed intermediate state with 2 failing subtests. As a committed artifact, it conflicts with the expectation that spec-local coverage is authoritative and makes it unclear whether failure is expected or stale.  
**Suggestion:** Remove this log from the change set, or replace it with a current passing execution artifact if the project intentionally tracks raw test output.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/.raw/test-execution.log`  
**Requirement:** R11  
**Issue:** The raw execution log records a failed intermediate state with 2 failing subtests. As a committed artifact, it conflicts with the expectation that spec-local coverage is authoritative and makes it unclear whether failure is expected or stale.  
**Suggestion:** Remove this log from the change set, or replace it with a current passing execution artifact if the project intentionally tracks raw test output.
**Rationale:** Loop review proposal.

### 94. 3. Deduplicate Prompt Evaluation Stub Setup
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R6
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R6  
**Issue:** `evaluateWithPromptAwareStub()` constructs a batch, builds a prompt, defines an agent-like object, calls it, and parses the response. This repeats production-adjacent orchestration logic in test-local form and makes R6/R7/R8 tests depend on a custom mini-runner.  
**Suggestion:** Extract a smaller helper that only converts a `decide()` result into the parsed evaluation, or use the real `RunGateCommand` fixture path for these semantic cases to keep the design pattern consistent with the R11 end-to-end coverage.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R6  
**Issue:** `evaluateWithPromptAwareStub()` constructs a batch, builds a prompt, defines an agent-like object, calls it, and parses the response. This repeats production-adjacent orchestration logic in test-local form and makes R6/R7/R8 tests depend on a custom mini-runner.  
**Suggestion:** Extract a smaller helper that only converts a `decide()` result into the parsed evaluation, or use the real `RunGateCommand` fixture path for these semantic cases to keep the design pattern consistent with the R11 end-to-end coverage.
**Rationale:** Loop review proposal.

### 95. 4. Rename Ambiguous `fixtureSpec`
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R1
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R1  
**Issue:** `fixtureSpec()` is very broad, but it specifically creates a requirement gate context fixture with R1/R10 defaults. The generic name makes later tests harder to scan because many override only small portions of a highly opinionated base object.  
**Suggestion:** Rename it to something more precise, such as `requirementContextSpecFixture()` or `baseRequirementGateSpec()`, and update call sites.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R1  
**Issue:** `fixtureSpec()` is very broad, but it specifically creates a requirement gate context fixture with R1/R10 defaults. The generic name makes later tests harder to scan because many override only small portions of a highly opinionated base object.  
**Suggestion:** Rename it to something more precise, such as `requirementContextSpecFixture()` or `baseRequirementGateSpec()`, and update call sites.
**Rationale:** Loop review proposal.

### 96. 5. Ensure Temporary Guard Fixture Cleanup Uses `finally`
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R10
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test removes `root` only at the end of the happy path. If an assertion fails after the filesystem monkey-patch is restored, the temporary directory is left behind.  
**Suggestion:** Wrap the full R10 fixture body in a `try/finally` and call `fs.rmSync(root, { recursive: true, force: true })` in the finalizer, matching the cleanup pattern already used by `runGateFixture()` callers.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R10  
**Issue:** The R10 test removes `root` only at the end of the happy path. If an assertion fails after the filesystem monkey-patch is restored, the temporary directory is left behind.  
**Suggestion:** Wrap the full R10 fixture body in a `try/finally` and call `fs.rmSync(root, { recursive: true, force: true })` in the finalizer, matching the cleanup pattern already used by `runGateFixture()` callers.
**Rationale:** Loop review proposal.

### 97. 6. Consolidate Repeated Requirement Literals
**Failure mode:** refactor
**File:** specs/319-requirement-gate-context/tests/requirement-gate-context.test.js
**Requirement:** R11
**Issue:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** R6 and R7 requirement objects, acceptance strings, file-map paths, and diff snippets are repeated across unit-style tests and the R11 end-to-end fixture table. This duplication increases the chance that coverage drifts between the prompt-level and RunGateCommand-level assertions.  
**Suggestion:** Define named fixture constants for the Issue #432 preservation case and Issue #434 canonical path case, then reuse them in both the focused prompt tests and the end-to-end fixture table.
**Suggestion:** **File:** `specs/319-requirement-gate-context/tests/requirement-gate-context.test.js`  
**Requirement:** R11  
**Issue:** R6 and R7 requirement objects, acceptance strings, file-map paths, and diff snippets are repeated across unit-style tests and the R11 end-to-end fixture table. This duplication increases the chance that coverage drifts between the prompt-level and RunGateCommand-level assertions.  
**Suggestion:** Define named fixture constants for the Issue #432 preservation case and Issue #434 canonical path case, then reuse them in both the focused prompt tests and the end-to-end fixture table.
**Rationale:** Loop review proposal.

### 98. I’ll review this as a quality/design pass only against the touched files and the listed guardrail, then return proposals in the exact required format.### 1. Fix regex escaping helper
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `escapeRegExp()` replaces metacharacters with `"\\{{PROMPT}}"`, so `containsRequirementId()` will not actually escape the requirement id. IDs containing regex metacharacters can match incorrectly or break exact-boundary matching.  
**Suggestion:** Replace the helper body with the standard replacement: `return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `escapeRegExp()` replaces metacharacters with `"\\{{PROMPT}}"`, so `containsRequirementId()` will not actually escape the requirement id. IDs containing regex metacharacters can match incorrectly or break exact-boundary matching.  
**Suggestion:** Replace the helper body with the standard replacement: `return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");`.
**Rationale:** Loop review proposal.

### 99. 2. Add explicit bounds while collecting linked context sources
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Rendering caps sections at 12 items, but `buildRequirementGateContext()` still scans and accumulates across unbounded `acceptance_criteria`, `tasks`, overview arrays, constraints, and schema sources. This conflicts with the bounded-resource guardrail because bulk spec processing lacks explicit traversal limits.  
**Suggestion:** Apply deterministic caps during collection, not only render. For example, stop after 12 accepted ACs, 12 linked tasks, 12 linked overview entries per section, and use capped constraints/out-of-scope sources when feeding schema extraction.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Rendering caps sections at 12 items, but `buildRequirementGateContext()` still scans and accumulates across unbounded `acceptance_criteria`, `tasks`, overview arrays, constraints, and schema sources. This conflicts with the bounded-resource guardrail because bulk spec processing lacks explicit traversal limits.  
**Suggestion:** Apply deterministic caps during collection, not only render. For example, stop after 12 accepted ACs, 12 linked tasks, 12 linked overview entries per section, and use capped constraints/out-of-scope sources when feeding schema extraction.
**Rationale:** Loop review proposal.

### 100. 3. Avoid recomputing linked target text per implementation target
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `linkedText` is rebuilt inside every `implementationTargets.forEach()` iteration even though it does not depend on the target. That adds avoidable repeated work and obscures the selection logic.  
**Suggestion:** Compute `linkedTargetText` once before the loop, then reference it inside the target filter.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `linkedText` is rebuilt inside every `implementationTargets.forEach()` iteration even though it does not depend on the target. That adds avoidable repeated work and obscures the selection logic.  
**Suggestion:** Compute `linkedTargetText` once before the loop, then reference it inside the target filter.
**Rationale:** Loop review proposal.

### 101. 4. Validate context map completeness before batching
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R9
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R9  
**Issue:** `buildRequirementGateBatches()` and `planRequirementGateCalls()` pass `contexts.get(requirement.id)` through to `RequirementGateBatch`; if a map is missing an id, the eventual error is indirect and depends on the path taken.  
**Suggestion:** Add a small helper such as `contextForRequirement(contexts, requirement.id)` that throws a clear error when the map lacks a required context, and use it consistently wherever contexts are supplied.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R9  
**Issue:** `buildRequirementGateBatches()` and `planRequirementGateCalls()` pass `contexts.get(requirement.id)` through to `RequirementGateBatch`; if a map is missing an id, the eventual error is indirect and depends on the path taken.  
**Suggestion:** Add a small helper such as `contextForRequirement(contexts, requirement.id)` that throws a clear error when the map lacks a required context, and use it consistently wherever contexts are supplied.
**Rationale:** Loop review proposal.

### 102. I’ll review this as a quality/design pass only against the touched files and the listed guardrail, then return proposals in the exact required format.### 1. Fix regex escaping helper
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `escapeRegExp()` replaces metacharacters with `"\\{{PROMPT}}"`, so `containsRequirementId()` will not actually escape the requirement id. IDs containing regex metacharacters can match incorrectly or break exact-boundary matching.  
**Suggestion:** Replace the helper body with the standard replacement: `return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `escapeRegExp()` replaces metacharacters with `"\\{{PROMPT}}"`, so `containsRequirementId()` will not actually escape the requirement id. IDs containing regex metacharacters can match incorrectly or break exact-boundary matching.  
**Suggestion:** Replace the helper body with the standard replacement: `return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");`.
**Rationale:** Loop review proposal.

### 103. 2. Add explicit bounds while collecting linked context sources
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Rendering caps sections at 12 items, but `buildRequirementGateContext()` still scans and accumulates across unbounded `acceptance_criteria`, `tasks`, overview arrays, constraints, and schema sources. This conflicts with the bounded-resource guardrail because bulk spec processing lacks explicit traversal limits.  
**Suggestion:** Apply deterministic caps during collection, not only render. For example, stop after 12 accepted ACs, 12 linked tasks, 12 linked overview entries per section, and use capped constraints/out-of-scope sources when feeding schema extraction.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Rendering caps sections at 12 items, but `buildRequirementGateContext()` still scans and accumulates across unbounded `acceptance_criteria`, `tasks`, overview arrays, constraints, and schema sources. This conflicts with the bounded-resource guardrail because bulk spec processing lacks explicit traversal limits.  
**Suggestion:** Apply deterministic caps during collection, not only render. For example, stop after 12 accepted ACs, 12 linked tasks, 12 linked overview entries per section, and use capped constraints/out-of-scope sources when feeding schema extraction.
**Rationale:** Loop review proposal.

### 104. 3. Avoid recomputing linked target text per implementation target
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `linkedText` is rebuilt inside every `implementationTargets.forEach()` iteration even though it does not depend on the target. That adds avoidable repeated work and obscures the selection logic.  
**Suggestion:** Compute `linkedTargetText` once before the loop, then reference it inside the target filter.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `linkedText` is rebuilt inside every `implementationTargets.forEach()` iteration even though it does not depend on the target. That adds avoidable repeated work and obscures the selection logic.  
**Suggestion:** Compute `linkedTargetText` once before the loop, then reference it inside the target filter.
**Rationale:** Loop review proposal.

### 105. 4. Validate context map completeness before batching
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R9
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R9  
**Issue:** `buildRequirementGateBatches()` and `planRequirementGateCalls()` pass `contexts.get(requirement.id)` through to `RequirementGateBatch`; if a map is missing an id, the eventual error is indirect and depends on the path taken.  
**Suggestion:** Add a small helper such as `contextForRequirement(contexts, requirement.id)` that throws a clear error when the map lacks a required context, and use it consistently wherever contexts are supplied.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R9  
**Issue:** `buildRequirementGateBatches()` and `planRequirementGateCalls()` pass `contexts.get(requirement.id)` through to `RequirementGateBatch`; if a map is missing an id, the eventual error is indirect and depends on the path taken.  
**Suggestion:** Add a small helper such as `contextForRequirement(contexts, requirement.id)` that throws a clear error when the map lacks a required context, and use it consistently wherever contexts are supplied.
**Rationale:** Loop review proposal.

### 106. 5. Add the required spec-local marker to the new unit test
**Failure mode:** refactor
**File:** tests/unit/flow/gate-requirement-context.test.js
**Requirement:** R11
**Issue:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R11  
**Issue:** R11 requires spec-local tests beginning with `// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11`, but the new test file begins with imports.  
**Suggestion:** Add the required comment as the first line of the file.
**Suggestion:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R11  
**Issue:** R11 requires spec-local tests beginning with `// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11`, but the new test file begins with imports.  
**Suggestion:** Add the required comment as the first line of the file.
**Rationale:** Loop review proposal.

### 107. 5. Add the required spec-local marker to the new unit test
**Failure mode:** refactor
**File:** tests/unit/flow/gate-requirement-context.test.js
**Requirement:** R11
**Issue:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R11  
**Issue:** R11 requires spec-local tests beginning with `// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11`, but the new test file begins with imports.  
**Suggestion:** Add the required comment as the first line of the file.
**Suggestion:** **File:** `tests/unit/flow/gate-requirement-context.test.js`  
**Requirement:** R11  
**Issue:** R11 requires spec-local tests beginning with `// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11`, but the new test file begins with imports.  
**Suggestion:** Add the required comment as the first line of the file.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
