# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Collapse empty phase reports into a shared minimal schema
**Finding key:** loop-fa5637b9a4212660d039
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/draft-coverage-repair.json
**Requirement:** R4
**Issue:** **File:** `specs/324-standalone-plugin-attribution/draft-coverage-repair.json`  
**Requirement:** R4  
**Issue:** This file duplicates the same empty-report structure used by `draft-coverage-triage.json`, differing only by phase, source field, and summary.  
**Suggestion:** Use the same schema shape and field names across both files, such as `sourcePhase` or `sourceArtifact`, so tooling does not need separate handling for `sourceTriage` versus `sourceReview`.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/draft-coverage-repair.json`  
**Requirement:** R4  
**Issue:** This file duplicates the same empty-report structure used by `draft-coverage-triage.json`, differing only by phase, source field, and summary.  
**Suggestion:** Use the same schema shape and field names across both files, such as `sourcePhase` or `sourceArtifact`, so tooling does not need separate handling for `sourceTriage` versus `sourceReview`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 5. Use consistent source field naming
**Finding key:** loop-ab35485e154bccbfbc63
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/draft-coverage-triage.json
**Requirement:** R5
**Issue:** **File:** `specs/324-standalone-plugin-attribution/draft-coverage-triage.json`  
**Requirement:** R5  
**Issue:** `sourceReview` is semantically similar to `sourceTriage` in the repair file, but the field names encode the source type instead of using a consistent key.  
**Suggestion:** Rename this to a generic field such as `sourceArtifact` or `inputArtifact`, matching the repair report, to simplify consumers that traverse generated phase metadata.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/draft-coverage-triage.json`  
**Requirement:** R5  
**Issue:** `sourceReview` is semantically similar to `sourceTriage` in the repair file, but the field names encode the source type instead of using a consistent key.  
**Suggestion:** Rename this to a generic field such as `sourceArtifact` or `inputArtifact`, matching the repair report, to simplify consumers that traverse generated phase metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Remove duplicated finding payloads
**Finding key:** loop-b868d6cc85c5ac8084b7
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same six guardrail failures are represented twice, once under `evaluations` and again under `observations`, with mostly duplicated fields. This increases file size and creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical collection of findings and have the other section reference it by stable IDs, or remove `observations` if `evaluations` already contains the full observation details required by consumers.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same six guardrail failures are represented twice, once under `evaluations` and again under `observations`, with mostly duplicated fields. This increases file size and creates drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical collection of findings and have the other section reference it by stable IDs, or remove `observations` if `evaluations` already contains the full observation details required by consumers.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Normalize duplicate metadata fields
**Finding key:** loop-f93590914d989e369e35
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/draft-gate-source.json
**Requirement:** R2
**Issue:** **File:** `specs/324-standalone-plugin-attribution/draft-gate-source.json`  
**Requirement:** R2  
**Issue:** Each finding repeats equivalent fields with inconsistent naming styles: `guardrail_id` and `guardrailId`, plus `findingId` and `fingerprint`. This makes downstream parsing more error-prone and obscures which field is authoritative.  
**Suggestion:** Standardize on one naming convention for generated JSON, preferably camelCase if the surrounding schema uses `runId`, `generatedAt`, and `requirementId`. Remove redundant aliases unless backward compatibility explicitly requires them.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/draft-gate-source.json`  
**Requirement:** R2  
**Issue:** Each finding repeats equivalent fields with inconsistent naming styles: `guardrail_id` and `guardrailId`, plus `findingId` and `fingerprint`. This makes downstream parsing more error-prone and obscures which field is authoritative.  
**Suggestion:** Standardize on one naming convention for generated JSON, preferably camelCase if the surrounding schema uses `runId`, `generatedAt`, and `requirementId`. Remove redundant aliases unless backward compatibility explicitly requires them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Deduplicate repeated failure IDs
**Finding key:** loop-572eafc08beca923249c
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/draft-gate-source.json
**Requirement:** R3
**Issue:** **File:** `specs/324-standalone-plugin-attribution/draft-gate-source.json`  
**Requirement:** R3  
**Issue:** Multiple distinct findings in `evaluations` share the same `findingId` and `fingerprint` when they refer to different locators and different observed text. That weakens identity semantics and makes deduplication or triage workflows ambiguous.  
**Suggestion:** Generate `findingId` and `fingerprint` from the specific finding content, including guardrail ID, locator, and observed text, or split shared grouping identity into a separate `groupId`.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/draft-gate-source.json`  
**Requirement:** R3  
**Issue:** Multiple distinct findings in `evaluations` share the same `findingId` and `fingerprint` when they refer to different locators and different observed text. That weakens identity semantics and makes deduplication or triage workflows ambiguous.  
**Suggestion:** Generate `findingId` and `fingerprint` from the specific finding content, including guardrail ID, locator, and observed text, or split shared grouping identity into a separate `groupId`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Clarify The Naming Of “sourceDraft”
**Finding key:** loop-312fd00d012e48f09cd7
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/draft-review-questions.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/draft-review-questions.json`  
**Requirement:** R1  
**Issue:** `sourceDraft` is slightly ambiguous: it could mean the source file path, a draft identifier, or the draft content source.  
**Suggestion:** Rename it to `sourceDraftPath` if this field is intended to point to `draft.json`, matching its actual value and making downstream usage clearer.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/draft-review-questions.json`  
**Requirement:** R1  
**Issue:** `sourceDraft` is slightly ambiguous: it could mean the source file path, a draft identifier, or the draft content source.  
**Suggestion:** Rename it to `sourceDraftPath` if this field is intended to point to `draft.json`, matching its actual value and making downstream usage clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Tighten “Repeated Call” Bounds In The Draft
**Finding key:** loop-977c147b8e9cb6155b9e
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/draft.json
**Requirement:** R4
**Issue:** **File:** `specs/324-standalone-plugin-attribution/draft.json`  
**Requirement:** R4  
**Issue:** The draft references “repeated-call” and “repeated equivalent calls” scenarios, but does not state an explicit count. Under the `bounded-resource-usage` guardrail, repeated processing should have clear upper bounds.  
**Suggestion:** Replace vague repeated-call language with a bounded scenario, for example “two equivalent calls” or “three equivalent calls,” so the spec cannot be interpreted as requiring unbounded repetition.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/draft.json`  
**Requirement:** R4  
**Issue:** The draft references “repeated-call” and “repeated equivalent calls” scenarios, but does not state an explicit count. Under the `bounded-resource-usage` guardrail, repeated processing should have clear upper bounds.  
**Suggestion:** Replace vague repeated-call language with a bounded scenario, for example “two equivalent calls” or “three equivalent calls,” so the spec cannot be interpreted as requiring unbounded repetition.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Deduplicate Repeated File-Map Entries
**Finding key:** loop-3b9fc429fe47af6f1569
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/file-map.json
**Requirement:** R8
**Issue:** **File:** `specs/324-standalone-plugin-attribution/file-map.json`  
**Requirement:** R8  
**Issue:** The same long test path, `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`, is repeated under every requirement. This makes the map noisy and harder to maintain if the test file is renamed or split.  
**Suggestion:** If the consuming schema allows it, introduce a shared test coverage grouping or a top-level common test entry, then keep each requirement focused on only the implementation files that differ.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/file-map.json`  
**Requirement:** R8  
**Issue:** The same long test path, `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`, is repeated under every requirement. This makes the map noisy and harder to maintain if the test file is renamed or split.  
**Suggestion:** If the consuming schema allows it, introduce a shared test coverage grouping or a top-level common test entry, then keep each requirement focused on only the implementation files that differ.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Bound persisted flow history size
**Finding key:** loop-809f9af3b686ad1f9def
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/324-standalone-plugin-attribution/flow.json`  
**Requirement:** R7  
**Issue:** The new flow artifact persists large `metrics` and `stepAttempts` arrays without any visible cap or truncation metadata. This conflicts with the bounded-resource-usage guardrail because repeated retries or long-running flows can grow this file indefinitely.  
**Suggestion:** Add an explicit retention policy to the artifact format, such as capped metrics/attempt counts plus a `truncated` or `droppedCount` field, or ensure this generated file records the configured bound used by the writer.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/flow.json`  
**Requirement:** R7  
**Issue:** The new flow artifact persists large `metrics` and `stepAttempts` arrays without any visible cap or truncation metadata. This conflicts with the bounded-resource-usage guardrail because repeated retries or long-running flows can grow this file indefinitely.  
**Suggestion:** Add an explicit retention policy to the artifact format, such as capped metrics/attempt counts plus a `truncated` or `droppedCount` field, or ensure this generated file records the configured bound used by the writer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Bound issue-log growth
**Finding key:** loop-5ef75538067c84287daf
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/324-standalone-plugin-attribution/issue-log.json`  
**Requirement:** R7  
**Issue:** `entries` stores every review/gate/tooling event verbatim, including repeated observations and full provider errors. There is no explicit upper bound on entry count, observation count, or string size, so repeated failures can cause unbounded artifact growth.  
**Suggestion:** Cap retained issue-log entries and per-entry observation/error text length, and persist summary metadata for omitted content.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/issue-log.json`  
**Requirement:** R7  
**Issue:** `entries` stores every review/gate/tooling event verbatim, including repeated observations and full provider errors. There is no explicit upper bound on entry count, observation count, or string size, so repeated failures can cause unbounded artifact growth.  
**Suggestion:** Cap retained issue-log entries and per-entry observation/error text length, and persist summary metadata for omitted content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Remove duplicated acceptance criteria
**Finding key:** loop-db046a0e7b1cd6c89ba7
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/issue.md
**Requirement:** R6
**Issue:** **File:** `specs/324-standalone-plugin-attribution/issue.md`  
**Requirement:** R6  
**Issue:** The English and Japanese sections duplicate the same problem statement, fix approach, scope, and acceptance criteria. This creates a maintenance risk where one section can drift from the other.  
**Suggestion:** Keep one canonical acceptance-criteria list and make the localized section explicitly non-authoritative, or reference the canonical section instead of duplicating every item.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/issue.md`  
**Requirement:** R6  
**Issue:** The English and Japanese sections duplicate the same problem statement, fix approach, scope, and acceptance criteria. This creates a maintenance risk where one section can drift from the other.  
**Suggestion:** Keep one canonical acceptance-criteria list and make the localized section explicitly non-authoritative, or reference the canonical section instead of duplicating every item.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Remove duplicate issue identifier
**Finding key:** loop-a36b9b1cc1b352490213
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/plugin-artifacts/workflow/prepare.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The same issue ID is stored as both top-level `issue` and nested `result.issueNumber`, which creates redundant state that can drift.  
**Suggestion:** Keep a single issue identifier, preferably `result.issueNumber` if this file is meant to represent workflow output, or remove the nested copy if the top-level field is the canonical input.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The same issue ID is stored as both top-level `issue` and nested `result.issueNumber`, which creates redundant state that can drift.  
**Suggestion:** Keep a single issue identifier, preferably `result.issueNumber` if this file is meant to represent workflow output, or remove the nested copy if the top-level field is the canonical input.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Avoid duplicated empty review result structure
**Finding key:** loop-733289cf421707739b86
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/draft-coverage-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/draft-coverage-attempt-001.json`  
**Requirement:** R1  
**Issue:** This file duplicates the same PASS/no-findings structure as `draft-questions-attempt-001.json`, differing only in phase, timestamp, and source artifact.  
**Suggestion:** If these files are generated artifacts, consider having the generator emit a shared normalized schema or compact representation for empty PASS reviews to reduce repeated boilerplate and make future schema changes easier.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/draft-coverage-attempt-001.json`  
**Requirement:** R1  
**Issue:** This file duplicates the same PASS/no-findings structure as `draft-questions-attempt-001.json`, differing only in phase, timestamp, and source artifact.  
**Suggestion:** If these files are generated artifacts, consider having the generator emit a shared normalized schema or compact representation for empty PASS reviews to reduce repeated boilerplate and make future schema changes easier.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Add trailing newlines to markdown artifacts
**Finding key:** loop-7cc8dce0dd5b5cae419f
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/spec-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The file is missing a trailing newline, which creates avoidable formatter and diff noise.  
**Suggestion:** End the file with a newline to match common repository text-file conventions.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The file is missing a trailing newline, which creates avoidable formatter and diff noise.  
**Suggestion:** End the file with a newline to match common repository text-file conventions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Add trailing newlines to markdown artifacts
**Finding key:** loop-ddb021016786da84d2e9
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/spec-review.md
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/spec-review.md`  
**Requirement:** R1  
**Issue:** The file is missing a trailing newline, which creates avoidable formatter and diff noise.  
**Suggestion:** End the file with a newline to match common repository text-file conventions.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/spec-review.md`  
**Requirement:** R1  
**Issue:** The file is missing a trailing newline, which creates avoidable formatter and diff noise.  
**Suggestion:** End the file with a newline to match common repository text-file conventions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Use unique finding identifiers per finding
**Finding key:** loop-e98b72d025898404b411
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** All four blocking findings reuse the same `findingId`, `fingerprint`, and `id` value even though they describe different requirement gaps. This makes deduplication, history tracking, and suppression semantics ambiguous.  
**Suggestion:** Generate a stable unique identifier per finding, derived from distinct fields such as phase, requirement origin, target, and normalized title/body.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** All four blocking findings reuse the same `findingId`, `fingerprint`, and `id` value even though they describe different requirement gaps. This makes deduplication, history tracking, and suppression semantics ambiguous.  
**Suggestion:** Generate a stable unique identifier per finding, derived from distinct fields such as phase, requirement origin, target, and normalized title/body.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Avoid duplicating full finding text in two JSON sections
**Finding key:** loop-d80e9d3fbf30b603072b
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** The same findings are represented in both `blockingFindings` and `findings` with heavily duplicated fields. This increases drift risk if one copy is updated and the other is not.  
**Suggestion:** Keep one canonical finding list and derive grouped views from it, or make `blockingFindings` contain only references to canonical finding IDs.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-001.json`  
**Requirement:** R1  
**Issue:** The same findings are represented in both `blockingFindings` and `findings` with heavily duplicated fields. This increases drift risk if one copy is updated and the other is not.  
**Suggestion:** Keep one canonical finding list and derive grouped views from it, or make `blockingFindings` contain only references to canonical finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 4. Add trailing newline to test review markdown
**Finding key:** loop-19bfd6784bacadc130da
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The file is missing a trailing newline, creating unnecessary diff noise and inconsistency with standard markdown formatting.  
**Suggestion:** End the file with a newline.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The file is missing a trailing newline, creating unnecessary diff noise and inconsistency with standard markdown formatting.  
**Suggestion:** End the file with a newline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Avoid Repeating Identical Finding Text Across Fields
**Finding key:** loop-fc81a239bbf55220692c
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-002.json
**Requirement:** R3
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** The same finding details are duplicated across `blockingFindings` and `findings`, including `findingId`, `fingerprint`, `title`, `issue`/`body`, `disposition`, and `rationale`. This increases artifact size and makes future schema changes more error-prone.  
**Suggestion:** Store the canonical finding once and have summary sections reference it by `findingId`, or make `blockingFindings` a filtered projection generated from `findings`.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** The same finding details are duplicated across `blockingFindings` and `findings`, including `findingId`, `fingerprint`, `title`, `issue`/`body`, `disposition`, and `rationale`. This increases artifact size and makes future schema changes more error-prone.  
**Suggestion:** Store the canonical finding once and have summary sections reference it by `findingId`, or make `blockingFindings` a filtered projection generated from `findings`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 4. Prefer Consistent Failure Kind Naming
**Finding key:** loop-4fcac82a7440bf206ece
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-002.json
**Requirement:** R3
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** `failureKind` uses `"missing spec-local coverage"` while the later artifact uses `"missing-coverage"`. Mixed naming styles make downstream filtering and aggregation harder.  
**Suggestion:** Use a stable enum-style value such as `"missing-coverage"` consistently across review-history JSON artifacts.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-002.json`  
**Requirement:** R3  
**Issue:** `failureKind` uses `"missing spec-local coverage"` while the later artifact uses `"missing-coverage"`. Mixed naming styles make downstream filtering and aggregation harder.  
**Suggestion:** Use a stable enum-style value such as `"missing-coverage"` consistently across review-history JSON artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Add Missing Trailing Newline
**Finding key:** loop-3787ae54185a89a29645
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-002.md
**Requirement:** R3
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-002.md`  
**Requirement:** R3  
**Issue:** The file ends without a trailing newline, which is inconsistent with normal text artifact formatting and can cause avoidable diff noise.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-002.md`  
**Requirement:** R3  
**Issue:** The file ends without a trailing newline, which is inconsistent with normal text artifact formatting and can cause avoidable diff noise.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 3. Avoid Repeating Identical Finding Text Across Fields
**Finding key:** loop-9c517aafeaef84d62f74
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-003.json
**Requirement:** R4
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-003.json`  
**Requirement:** R4  
**Issue:** Each blocking finding is duplicated in both `blockingFindings` and `findings`, with only minor field-name differences such as `issue` versus `body`. This creates unnecessary duplication and risks the two copies drifting.  
**Suggestion:** Normalize to one canonical finding representation, then derive blocking/advisory grouping from `severity` or `kind` during rendering.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-003.json`  
**Requirement:** R4  
**Issue:** Each blocking finding is duplicated in both `blockingFindings` and `findings`, with only minor field-name differences such as `issue` versus `body`. This creates unnecessary duplication and risks the two copies drifting.  
**Suggestion:** Normalize to one canonical finding representation, then derive blocking/advisory grouping from `severity` or `kind` during rendering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Normalize historical attempt artifact format
**Finding key:** loop-28db6b8bf8e54880659d
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-003.md
**Requirement:** R7
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-003.md`  
**Requirement:** R7  
**Issue:** Attempt 003 exists only as Markdown, while attempt 004 includes both JSON and Markdown. This inconsistency makes downstream tooling harder because some attempts have structured data and others do not.  
**Suggestion:** Add a matching `test-attempt-003.json` artifact or standardize the review-history convention so every attempt uses the same single format.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-003.md`  
**Requirement:** R7  
**Issue:** Attempt 003 exists only as Markdown, while attempt 004 includes both JSON and Markdown. This inconsistency makes downstream tooling harder because some attempts have structured data and others do not.  
**Suggestion:** Add a matching `test-attempt-003.json` artifact or standardize the review-history convention so every attempt uses the same single format.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 4. Use consistent target field naming
**Finding key:** loop-ab79a2611d999825bc37
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-003.md
**Requirement:** R7
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-003.md`  
**Requirement:** R7  
**Issue:** The Markdown uses `**Target:**`, while the requested proposal/review contract uses file-oriented fields. The target line also combines path, requirement, and helper name in one free-form string.  
**Suggestion:** Split the target into structured Markdown fields such as `**File:**`, `**Requirement:**`, and optional `**Symbol:** makeLayout` to match the rest of the review output conventions and improve scanability.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-003.md`  
**Requirement:** R7  
**Issue:** The Markdown uses `**Target:**`, while the requested proposal/review contract uses file-oriented fields. The target line also combines path, requirement, and helper name in one free-form string.  
**Suggestion:** Split the target into structured Markdown fields such as `**File:**`, `**Requirement:**`, and optional `**Symbol:** makeLayout` to match the rest of the review output conventions and improve scanability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Remove repeated identifiers in finding records
**Finding key:** loop-2123e260b88c9fce95ed
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-004.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-004.json`  
**Requirement:** R1  
**Issue:** Each finding repeats the same hash under `id`, `findingId`, and `fingerprint`, while `blockingFindings` also repeats `findingId` and `fingerprint`. This is redundant and makes the artifact noisier than necessary.  
**Suggestion:** Keep one canonical identifier field, such as `findingId`, and only include aliases if a documented consumer requires them.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-004.json`  
**Requirement:** R1  
**Issue:** Each finding repeats the same hash under `id`, `findingId`, and `fingerprint`, while `blockingFindings` also repeats `findingId` and `fingerprint`. This is redundant and makes the artifact noisier than necessary.  
**Suggestion:** Keep one canonical identifier field, such as `findingId`, and only include aliases if a documented consumer requires them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Avoid duplicating review findings across Markdown and JSON
**Finding key:** loop-62dcc088d1b3ff49eef6
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-004.md
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-004.md`  
**Requirement:** R1  
**Issue:** The R1 finding is duplicated almost verbatim in both `test-attempt-004.md` and `test-attempt-004.json`, which creates drift risk if one artifact is corrected later and the other is not.  
**Suggestion:** Treat the JSON file as the canonical structured artifact and generate the Markdown summary from it, or add a short note indicating the Markdown is a rendered copy of the JSON artifact.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-004.md`  
**Requirement:** R1  
**Issue:** The R1 finding is duplicated almost verbatim in both `test-attempt-004.md` and `test-attempt-004.json`, which creates drift risk if one artifact is corrected later and the other is not.  
**Suggestion:** Treat the JSON file as the canonical structured artifact and generate the Markdown summary from it, or add a short note indicating the Markdown is a rendered copy of the JSON artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Consolidate Repeated Evidence Fields
**Finding key:** loop-ec4bfeead6cc141e5be0
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/scenario-validity-result.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/scenario-validity-result.json`  
**Requirement:** R1  
**Issue:** Each `summary` entry repeats identical `test_file`, `command`, and `raw_output_lines` values, creating unnecessary duplication and increasing the chance of inconsistent edits later.  
**Suggestion:** Move shared evidence fields to a top-level object such as `commonEvidence`, leaving each requirement entry with only requirement-specific fields like `id`, `classification`, and `test_name`.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/scenario-validity-result.json`  
**Requirement:** R1  
**Issue:** Each `summary` entry repeats identical `test_file`, `command`, and `raw_output_lines` values, creating unnecessary duplication and increasing the chance of inconsistent edits later.  
**Suggestion:** Move shared evidence fields to a top-level object such as `commonEvidence`, leaving each requirement entry with only requirement-specific fields like `id`, `classification`, and `test_name`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Add Missing Final Newline
**Finding key:** loop-97def9c048da6622785c
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/review-history/test-attempt-005.md
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-005.md`  
**Requirement:** R1  
**Issue:** The Markdown file lacks a trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at the end of the file.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/review-history/test-attempt-005.md`  
**Requirement:** R1  
**Issue:** The Markdown file lacks a trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at the end of the file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Add Missing Final Newline
**Finding key:** loop-5ba67787a2ff15963d02
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/test-review.md
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/test-review.md`  
**Requirement:** R1  
**Issue:** The Markdown file lacks a trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at the end of the file.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/test-review.md`  
**Requirement:** R1  
**Issue:** The Markdown file lacks a trailing newline, which is inconsistent with common repository formatting conventions and can create noisy diffs.  
**Suggestion:** Add a final newline at the end of the file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Remove Duplicated Finding Payload
**Finding key:** loop-e5bcb5c2b9a759fcbd1a
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/spec-gate-source.json
**Requirement:** R7
**Issue:** **File:** `specs/324-standalone-plugin-attribution/spec-gate-source.json`  
**Requirement:** R7  
**Issue:** The same guardrail violation is represented twice: once under `evaluations[0].observations[0]` and again under top-level `observations[0]`, with mostly duplicated fields and separate fingerprints. This increases maintenance risk and makes downstream consumers decide which copy is canonical.  
**Suggestion:** Keep one canonical observation representation and have the other section reference it by `findingId`, or ensure generation emits shared IDs without duplicating the full payload.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/spec-gate-source.json`  
**Requirement:** R7  
**Issue:** The same guardrail violation is represented twice: once under `evaluations[0].observations[0]` and again under top-level `observations[0]`, with mostly duplicated fields and separate fingerprints. This increases maintenance risk and makes downstream consumers decide which copy is canonical.  
**Suggestion:** Keep one canonical observation representation and have the other section reference it by `findingId`, or ensure generation emits shared IDs without duplicating the full payload.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Reconcile Contradictory Review Artifacts
**Finding key:** loop-8838c9b427dce5df0721
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/spec-review.json
**Requirement:** R7
**Issue:** **File:** `specs/324-standalone-plugin-attribution/spec-review.json`  
**Requirement:** R7  
**Issue:** `spec-review.json` reports `PASS` with zero findings, while `spec-gate-source.json` reports a blocking failure for `req-diff-verifiability` against R7 at nearly the same time. This creates conflicting source-of-truth artifacts for the spec review state.  
**Suggestion:** Regenerate or update the review artifacts so `spec-review.json` reflects the blocking R7 finding, or remove the stale failing gate artifact if the later PASS is authoritative.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/spec-review.json`  
**Requirement:** R7  
**Issue:** `spec-review.json` reports `PASS` with zero findings, while `spec-gate-source.json` reports a blocking failure for `req-diff-verifiability` against R7 at nearly the same time. This creates conflicting source-of-truth artifacts for the spec review state.  
**Suggestion:** Regenerate or update the review artifacts so `spec-review.json` reflects the blocking R7 finding, or remove the stale failing gate artifact if the later PASS is authoritative.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Add Explicit Bounds To Snapshot Matrix
**Finding key:** loop-960d876d83964c2dd6f7
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/spec.json
**Requirement:** R6
**Issue:** **File:** `specs/324-standalone-plugin-attribution/spec.json`  
**Requirement:** R6  
**Issue:** R6 requires tests to snapshot “every seeded foreign `specs/*/flow.json` file and active-flow `.senti/agent-cache` file,” but does not define an upper bound on seeded files or cache entries. This violates the bounded-resource-usage guardrail because bulk file processing can grow without an explicit cap.  
**Suggestion:** Amend R6 or the test strategy to state concrete limits, such as maximum seeded foreign flows, maximum cache files per layout, and maximum bytes per seeded file.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/spec.json`  
**Requirement:** R6  
**Issue:** R6 requires tests to snapshot “every seeded foreign `specs/*/flow.json` file and active-flow `.senti/agent-cache` file,” but does not define an upper bound on seeded files or cache entries. This violates the bounded-resource-usage guardrail because bulk file processing can grow without an explicit cap.  
**Suggestion:** Amend R6 or the test strategy to state concrete limits, such as maximum seeded foreign flows, maximum cache files per layout, and maximum bytes per seeded file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 4. Add Explicit Bounds To Layout Coverage
**Finding key:** loop-cf6a866ab864972dde48
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/324-standalone-plugin-attribution/spec.json`  
**Requirement:** R7  
**Issue:** R7 includes “main repository layouts with one and multiple active flows,” but “multiple” is not bounded. That leaves the test matrix open-ended and weakens reproducibility.  
**Suggestion:** Replace “multiple active flows” with a concrete count, for example “two active flows,” or define a bounded range such as “2-3 active flows.”
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/spec.json`  
**Requirement:** R7  
**Issue:** R7 includes “main repository layouts with one and multiple active flows,” but “multiple” is not bounded. That leaves the test matrix open-ended and weakens reproducibility.  
**Suggestion:** Replace “multiple active flows” with a concrete count, for example “two active flows,” or define a bounded range such as “2-3 active flows.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 5. Align Task Status With Completed Requirements
**Finding key:** loop-03d1ccf74db96e79bdba
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/spec.json`  
**Requirement:** R1  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That makes the spec internally inconsistent and obscures whether implementation work is complete or merely planned.  
**Suggestion:** Update task statuses to match the requirement state, or change requirement statuses back from `done` if the tasks are still pending.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/spec.json`  
**Requirement:** R1  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That makes the spec internally inconsistent and obscures whether implementation work is complete or merely planned.  
**Suggestion:** Update task statuses to match the requirement state, or change requirement statuses back from `done` if the tasks are still pending.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Bound Snapshot Scope
**Finding key:** loop-70e9f812e5eb90aeb5c9
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/spec.md
**Requirement:** R6
**Issue:** **File:** `specs/324-standalone-plugin-attribution/spec.md`  
**Requirement:** R6  
**Issue:** R6 requires tests to snapshot “every seeded foreign `specs/*/flow.json` file” and active-flow cache files, but it does not define an explicit upper bound on count or size. This conflicts with `bounded-resource-usage` because bulk file loading can become unbounded.  
**Suggestion:** Add explicit limits, for example: “Seed at most N foreign specs per layout, at most M cache files, and cap each fixture file at K bytes.”
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/spec.md`  
**Requirement:** R6  
**Issue:** R6 requires tests to snapshot “every seeded foreign `specs/*/flow.json` file” and active-flow cache files, but it does not define an explicit upper bound on count or size. This conflicts with `bounded-resource-usage` because bulk file loading can become unbounded.  
**Suggestion:** Add explicit limits, for example: “Seed at most N foreign specs per layout, at most M cache files, and cap each fixture file at K bytes.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Bound Multi-Flow Fixture Matrix
**Finding key:** loop-30934a9a819b3f4c473a
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/spec.md
**Requirement:** R7
**Issue:** **File:** `specs/324-standalone-plugin-attribution/spec.md`  
**Requirement:** R7  
**Issue:** R7 requires “main repository layouts with one and multiple active flows,” but “multiple” is not bounded. The fixture matrix could grow without a clear cap.  
**Suggestion:** Specify the exact fixture counts, such as “one active flow and two active flows,” or define a maximum number of active flows tested.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/spec.md`  
**Requirement:** R7  
**Issue:** R7 requires “main repository layouts with one and multiple active flows,” but “multiple” is not bounded. The fixture matrix could grow without a clear cap.  
**Suggestion:** Specify the exact fixture counts, such as “one active flow and two active flows,” or define a maximum number of active flows tested.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Remove Empty Placeholder Sections
**Finding key:** loop-a75ffea8a868774dde46
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/spec.md`  
**Requirement:** R1  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders that add noise and can confuse downstream readers or tooling.  
**Suggestion:** Remove both empty sections, or populate them with concrete entries before keeping them in the spec.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/spec.md`  
**Requirement:** R1  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are dead placeholders that add noise and can confuse downstream readers or tooling.  
**Suggestion:** Remove both empty sections, or populate them with concrete entries before keeping them in the spec.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Clarify Generated Task Ownership
**Finding key:** loop-0fec8214c6a5da6ce1b6
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/tasks/T-3.md
**Requirement:** R6
**Issue:** **File:** `specs/324-standalone-plugin-attribution/tasks/T-3.md`  
**Requirement:** R6  
**Issue:** The file says it is auto-generated and should not be edited manually, but the task content also contains implementation guidance that may be tempting to adjust directly during review or repair.  
**Suggestion:** Add a short pointer to the source field in `spec.json.tasks[]` that should be edited instead, so future changes go through the generator consistently.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/tasks/T-3.md`  
**Requirement:** R6  
**Issue:** The file says it is auto-generated and should not be edited manually, but the task content also contains implementation guidance that may be tempting to adjust directly during review or repair.  
**Suggestion:** Add a short pointer to the source field in `spec.json.tasks[]` that should be edited instead, so future changes go through the generator consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 2. Use Consistent Test File Paths
**Finding key:** loop-f036de9110329c79825b
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/test-coverage.json
**Requirement:** R6
**Issue:** **File:** `specs/324-standalone-plugin-attribution/test-coverage.json`  
**Requirement:** R6  
**Issue:** `test-coverage.json` records test files as `tests/attribution-boundary.test.js`, while `test-execute-result.json` records the same file as `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`. This inconsistency increases comparison and tooling complexity.  
**Suggestion:** Standardize on one path style across both artifacts, preferably the spec-relative path if these files are consumed within the spec directory.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/test-coverage.json`  
**Requirement:** R6  
**Issue:** `test-coverage.json` records test files as `tests/attribution-boundary.test.js`, while `test-execute-result.json` records the same file as `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`. This inconsistency increases comparison and tooling complexity.  
**Suggestion:** Standardize on one path style across both artifacts, preferably the spec-relative path if these files are consumed within the spec directory.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Normalize Repeated Evidence Metadata
**Finding key:** loop-cf66abb7ac4aa9806ca4
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/test-execute-result.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/test-execute-result.json`  
**Requirement:** R1  
**Issue:** Each requirement entry repeats the same `test_file`, `command`, and `raw_output_lines` values, which makes the artifact noisy and harder to update consistently if the command or log span changes.  
**Suggestion:** Move shared execution metadata to a top-level `execution` object and keep only requirement-specific fields like `id`, `result`, and `test_name` in each summary entry.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/test-execute-result.json`  
**Requirement:** R1  
**Issue:** Each requirement entry repeats the same `test_file`, `command`, and `raw_output_lines` values, which makes the artifact noisy and harder to update consistently if the command or log span changes.  
**Suggestion:** Move shared execution metadata to a top-level `execution` object and keep only requirement-specific fields like `id`, `result`, and `test_name` in each summary entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 3. Remove Redundant Regression File Lists
**Finding key:** loop-96501bda89c67f915940
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/test-execute-result.json
**Requirement:** R8
**Issue:** **File:** `specs/324-standalone-plugin-attribution/test-execute-result.json`  
**Requirement:** R8  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` contain the same three entries with identical statuses and fingerprints. This duplicates data without adding distinction in the current artifact.  
**Suggestion:** Keep a single `changed_files` list, or only include `trigger_relevant_changed_files` when it differs from the complete changed-file set.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/test-execute-result.json`  
**Requirement:** R8  
**Issue:** `regression.trigger_relevant_changed_files` and `regression.changed_files` contain the same three entries with identical statuses and fingerprints. This duplicates data without adding distinction in the current artifact.  
**Suggestion:** Keep a single `changed_files` list, or only include `trigger_relevant_changed_files` when it differs from the complete changed-file set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 1. Normalize verdict casing
**Finding key:** loop-588e029919340963bd94
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/test-result-review.json
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/test-result-review.json`  
**Requirement:** R1  
**Issue:** The file uses lowercase `"pass"` for `verdict`, `result`, and checked item results, while `test-review.json` uses uppercase `"PASS"`. This inconsistency makes downstream consumers more likely to need special-case normalization.  
**Suggestion:** Use the same enum casing across review artifacts, preferably the existing uppercase convention from `test-review.json`.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/test-result-review.json`  
**Requirement:** R1  
**Issue:** The file uses lowercase `"pass"` for `verdict`, `result`, and checked item results, while `test-review.json` uses uppercase `"PASS"`. This inconsistency makes downstream consumers more likely to need special-case normalization.  
**Suggestion:** Use the same enum casing across review artifacts, preferably the existing uppercase convention from `test-review.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 2. Avoid duplicated review content across JSON and Markdown
**Finding key:** loop-84bd81c288d804caed65
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/test-result-review.md
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/test-result-review.md`  
**Requirement:** R1  
**Issue:** The Markdown file duplicates the verdict, checked item names, statuses, details, and paths already present in `test-result-review.json`. This creates drift risk if one artifact is regenerated or edited without the other.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or reduce the Markdown to a pointer to the canonical JSON if a human-readable duplicate is not required.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/test-result-review.md`  
**Requirement:** R1  
**Issue:** The Markdown file duplicates the verdict, checked item names, statuses, details, and paths already present in `test-result-review.json`. This creates drift risk if one artifact is regenerated or edited without the other.  
**Suggestion:** Treat the JSON as the canonical artifact and generate the Markdown from it, or reduce the Markdown to a pointer to the canonical JSON if a human-readable duplicate is not required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 1. Remove Contradictory Raw Failure Log
**Finding key:** loop-b8a06ba7f9a129ccf5b3
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/tests/.raw/scenario-validity.log
**Requirement:** R1
**Issue:** **File:** `specs/324-standalone-plugin-attribution/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This checked-in raw log records seven failing subtests, while `test-execution.log` records the same test command passing. Keeping both creates stale, contradictory evidence for the change set.  
**Suggestion:** Remove the obsolete failure log or regenerate it from the final passing test run so raw artifacts agree.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/tests/.raw/scenario-validity.log`  
**Requirement:** R1  
**Issue:** This checked-in raw log records seven failing subtests, while `test-execution.log` records the same test command passing. Keeping both creates stale, contradictory evidence for the change set.  
**Suggestion:** Remove the obsolete failure log or regenerate it from the final passing test run so raw artifacts agree.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 2. Deduplicate Test Execution Artifacts
**Finding key:** loop-67494d7ed4d74157a098
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/tests/.raw/test-execution.log
**Requirement:** R8
**Issue:** **File:** `specs/324-standalone-plugin-attribution/tests/.raw/test-execution.log`  
**Requirement:** R8  
**Issue:** `test-execution.log` and `scenario-validity.log` both describe execution of `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`, but in different formats and with conflicting outcomes. This duplicates evidence and makes review harder.  
**Suggestion:** Keep a single canonical raw execution artifact for this test, or ensure each raw log has a distinct purpose and non-overlapping content.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/tests/.raw/test-execution.log`  
**Requirement:** R8  
**Issue:** `test-execution.log` and `scenario-validity.log` both describe execution of `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`, but in different formats and with conflicting outcomes. This duplicates evidence and makes review harder.  
**Suggestion:** Keep a single canonical raw execution artifact for this test, or ensure each raw log has a distinct purpose and non-overlapping content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 3. Extract Common Global Agent Binding Helper
**Finding key:** loop-e5d16b529505f96b77f1
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js
**Requirement:** R5
**Issue:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R5  
**Issue:** The `globalThis.__sentiPluginAgent` save/restore pattern is duplicated in the R5 and R8 tests. The repeated manual cleanup increases the chance of leaking global state if future tests copy it incorrectly.  
**Suggestion:** Add a small helper such as `bindPluginAgent(t, agent)` that stores the previous value, assigns the test agent, and registers the `t.after` cleanup.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R5  
**Issue:** The `globalThis.__sentiPluginAgent` save/restore pattern is duplicated in the R5 and R8 tests. The repeated manual cleanup increases the chance of leaking global state if future tests copy it incorrectly.  
**Suggestion:** Add a small helper such as `bindPluginAgent(t, agent)` that stores the previous value, assigns the test agent, and registers the `t.after` cleanup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 4. Simplify Protected Snapshot Assertions
**Finding key:** loop-7569653b07f66780e0c1
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js
**Requirement:** R6
**Issue:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R6  
**Issue:** Several tests repeat the same pattern: capture `const before = snapshot(layout.protectedFiles)`, run calls, then assert `snapshot(layout.protectedFiles)` is unchanged.  
**Suggestion:** Introduce a helper like `assertProtectedFilesUnchanged(layout, before, message)` or `snapshotProtected(layout)` to make the invariant clearer and reduce repeated plumbing.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R6  
**Issue:** Several tests repeat the same pattern: capture `const before = snapshot(layout.protectedFiles)`, run calls, then assert `snapshot(layout.protectedFiles)` is unchanged.  
**Suggestion:** Introduce a helper like `assertProtectedFilesUnchanged(layout, before, message)` or `snapshotProtected(layout)` to make the invariant clearer and reduce repeated plumbing.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 5. Rename `protectedFiles` To Domain-Specific Name
**Finding key:** loop-034bcaf72a55c1d9a05b
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js
**Requirement:** R6
**Issue:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R6  
**Issue:** `protectedFiles` is vague; the tests are specifically protecting seeded foreign flow files and active-flow cache files from no-flow attribution side effects.  
**Suggestion:** Rename it to something like `foreignAttributionFiles`, `seededForeignFiles`, or `foreignFlowAndCacheFiles` so assertions directly communicate the boundary being tested.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R6  
**Issue:** `protectedFiles` is vague; the tests are specifically protecting seeded foreign flow files and active-flow cache files from no-flow attribution side effects.  
**Suggestion:** Rename it to something like `foreignAttributionFiles`, `seededForeignFiles`, or `foreignFlowAndCacheFiles` so assertions directly communicate the boundary being tested.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 6. Replace Inline Plugin Source Strings With Builders
**Finding key:** loop-0a070de06942b65048fd
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js
**Requirement:** R5
**Issue:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R5  
**Issue:** The R5 and R8 plugin fixtures embed multi-line JavaScript strings inline. This makes the tests harder to scan and hides the behavior under test inside string literals.  
**Suggestion:** Extract named fixture builders such as `standaloneCommandSource()` and `ambientHookSource()` to keep each test focused on setup, execution, and assertions.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R5  
**Issue:** The R5 and R8 plugin fixtures embed multi-line JavaScript strings inline. This makes the tests harder to scan and hides the behavior under test inside string literals.  
**Suggestion:** Extract named fixture builders such as `standaloneCommandSource()` and `ambientHookSource()` to keep each test focused on setup, execution, and assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 7. Add Explicit Bounds To Generated Layout Size
**Finding key:** loop-882e6c9db977b0df9f82
**Failure mode:** refactor
**File:** specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js
**Requirement:** R7
**Issue:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R7  
**Issue:** `makeLayout` loops from `1` through `activeCount` without validating an upper bound. Current callers pass small constants, but the helper itself permits unbounded filesystem creation if reused with a large value. This conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Validate `activeCount` at the start of `makeLayout`, for example requiring a non-negative integer no greater than the maximum matrix size needed by these tests.
**Suggestion:** **File:** `specs/324-standalone-plugin-attribution/tests/attribution-boundary.test.js`  
**Requirement:** R7  
**Issue:** `makeLayout` loops from `1` through `activeCount` without validating an upper bound. Current callers pass small constants, but the helper itself permits unbounded filesystem creation if reused with a large value. This conflicts with the bounded-resource-usage guardrail.  
**Suggestion:** Validate `activeCount` at the start of `makeLayout`, for example requiring a non-negative integer no greater than the maximum matrix size needed by these tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 1. Centralize Flow Attribution Mode Constants
**Finding key:** loop-2b2ace78df9c4644a27c
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R1
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R1  
**Issue:** The string literals `"ambient"` and `"none"` are repeated across JSDoc, validation, defaults, and plugin binding logic. This makes future mode changes error-prone.  
**Suggestion:** Add a small constant, for example `FLOW_ATTRIBUTION = Object.freeze({ ambient: "ambient", none: "none" })`, and use it in `FlowAttributionPolicy`, defaults, and plugin API binding.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R1  
**Issue:** The string literals `"ambient"` and `"none"` are repeated across JSDoc, validation, defaults, and plugin binding logic. This makes future mode changes error-prone.  
**Suggestion:** Add a small constant, for example `FLOW_ATTRIBUTION = Object.freeze({ ambient: "ambient", none: "none" })`, and use it in `FlowAttributionPolicy`, defaults, and plugin API binding.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 2. Simplify Plugin Option Construction
**Finding key:** loop-d53317d021d7c5452c8f
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R4
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R4  
**Issue:** `PluginAgentApi.#options()` mixes command namespacing, provider/profile precedence, and attribution override handling in one method. The `boundAttribution` conditional is also harder to read because ambient mode preserves plugin-supplied options only when absent.  
**Suggestion:** Split this into focused helpers such as `#namespacedCommandId()`, `#providerOptions()`, and `#flowAttributionOptions()`. This would make the precedence rules easier to audit, especially the requirement that core-bound attribution wins for no-flow plugin calls.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R4  
**Issue:** `PluginAgentApi.#options()` mixes command namespacing, provider/profile precedence, and attribution override handling in one method. The `boundAttribution` conditional is also harder to read because ambient mode preserves plugin-supplied options only when absent.  
**Suggestion:** Split this into focused helpers such as `#namespacedCommandId()`, `#providerOptions()`, and `#flowAttributionOptions()`. This would make the precedence rules easier to audit, especially the requirement that core-bound attribution wins for no-flow plugin calls.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 53. 3. Rename `logContext` For Clarity
**Finding key:** loop-ce96a2df0b8a35995975
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R3
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R3  
**Issue:** `FlowAttributionPolicy.logContext` returns `undefined` for ambient mode and `null` for no-flow mode. The name sounds like it returns a concrete logging context, but it is really an override sentinel passed to `Logger`.  
**Suggestion:** Rename it to something like `flowContextOverride` or `loggerFlowContextOverride`, and use that name in `runWithLogging()`.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R3  
**Issue:** `FlowAttributionPolicy.logContext` returns `undefined` for ambient mode and `null` for no-flow mode. The name sounds like it returns a concrete logging context, but it is really an override sentinel passed to `Logger`.  
**Suggestion:** Rename it to something like `flowContextOverride` or `loggerFlowContextOverride`, and use that name in `runWithLogging()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 54. 4. Avoid Passing `flowAttribution` As An Unvalidated Runtime Assumption
**Finding key:** loop-fd665cc1ccba205b9e9e
**Failure mode:** refactor
**File:** src/lib/agent.js
**Requirement:** R1
**Issue:** **File:** `src/lib/agent.js`  
**Requirement:** R1  
**Issue:** `runWithLogging()` assumes `flowAttribution` is always a `FlowAttributionPolicy`. If another internal caller later invokes `runWithLogging()` without it, this will throw while logging rather than defaulting to ambient behavior.  
**Suggestion:** Normalize defensively at the boundary: `const attribution = flowAttribution instanceof FlowAttributionPolicy ? flowAttribution : new FlowAttributionPolicy(flowAttribution);`, then use `attribution` inside `runWithLogging()`.
**Suggestion:** **File:** `src/lib/agent.js`  
**Requirement:** R1  
**Issue:** `runWithLogging()` assumes `flowAttribution` is always a `FlowAttributionPolicy`. If another internal caller later invokes `runWithLogging()` without it, this will throw while logging rather than defaulting to ambient behavior.  
**Suggestion:** Normalize defensively at the boundary: `const attribution = flowAttribution instanceof FlowAttributionPolicy ? flowAttribution : new FlowAttributionPolicy(flowAttribution);`, then use `attribution` inside `runWithLogging()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 55. 5. Extract Logger Flow Context Override Normalization
**Finding key:** loop-a59c30ba1f2d99bcd3d4
**Failure mode:** refactor
**File:** src/lib/log.js
**Requirement:** R3
**Issue:** **File:** `src/lib/log.js`  
**Requirement:** R3  
**Issue:** `#flowContext(entry)` now handles two separate responsibilities: detecting an explicit flow context override and resolving ambient flow context. This makes the control flow less clear.  
**Suggestion:** Extract the override branch into a helper like `#explicitFlowContext(entry)` that returns either a normalized context or `undefined`, then let `#flowContext()` handle ambient resolution only when no override is present.
**Suggestion:** **File:** `src/lib/log.js`  
**Requirement:** R3  
**Issue:** `#flowContext(entry)` now handles two separate responsibilities: detecting an explicit flow context override and resolving ambient flow context. This makes the control flow less clear.  
**Suggestion:** Extract the override branch into a helper like `#explicitFlowContext(entry)` that returns either a normalized context or `undefined`, then let `#flowContext()` handle ambient resolution only when no override is present.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 56. 6. Rename `coreAgent` Fallback For Intent
**Finding key:** loop-7e1a878599b564000c92
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R5
**Issue:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R5  
**Issue:** `coreAgent` can either be `globalThis.__sentiPluginAgent` or a local throwing fallback. The name implies it is always a fully configured core agent, which is not true.  
**Suggestion:** Rename it to `baseAgent` or `pluginAgentDelegate` to reflect that it is the object wrapped by `createPluginAgentApi()` and may be a fallback delegate.
**Suggestion:** **File:** `src/lib/plugin-registry.js`  
**Requirement:** R5  
**Issue:** `coreAgent` can either be `globalThis.__sentiPluginAgent` or a local throwing fallback. The name implies it is always a fully configured core agent, which is not true.  
**Suggestion:** Rename it to `baseAgent` or `pluginAgentDelegate` to reflect that it is the object wrapped by `createPluginAgentApi()` and may be a fallback delegate.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
