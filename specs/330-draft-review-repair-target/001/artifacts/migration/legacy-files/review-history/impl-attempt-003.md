# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 3. Avoid repeated empty repair/triage summary shape
**Finding key:** loop-181b905ef479c6eef59c
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft-coverage-repair.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/draft-coverage-repair.json`  
**Requirement:** R1  
**Issue:** This file repeats the same empty-result structure and summary wording pattern used by the other draft repair/triage artifacts, differing only by phase and source field.  
**Suggestion:** If these files are generated, centralize the empty-artifact template in the generator so the common fields, empty `items`, and summary wording come from one implementation path.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft-coverage-repair.json`  
**Requirement:** R1  
**Issue:** This file repeats the same empty-result structure and summary wording pattern used by the other draft repair/triage artifacts, differing only by phase and source field.  
**Suggestion:** If these files are generated, centralize the empty-artifact template in the generator so the common fields, empty `items`, and summary wording come from one implementation path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Remove duplicated finding payloads
**Finding key:** loop-4fed79f56ff0c2224275
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same guardrail failures are represented twice: once in `evaluations[].observations[]` and again in top-level `observations[]`, with duplicated text, refs, disposition, rationale, and metadata. This increases drift risk because future repair logic may update one copy but not the other.  
**Suggestion:** Keep one canonical observation list and have `evaluations` reference observations by stable IDs, or derive top-level `observations` from `evaluations` during rendering instead of persisting both copies.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same guardrail failures are represented twice: once in `evaluations[].observations[]` and again in top-level `observations[]`, with duplicated text, refs, disposition, rationale, and metadata. This increases drift risk because future repair logic may update one copy but not the other.  
**Suggestion:** Keep one canonical observation list and have `evaluations` reference observations by stable IDs, or derive top-level `observations` from `evaluations` during rendering instead of persisting both copies.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Normalize duplicated failure metadata
**Finding key:** loop-3d2fe6dc485d2c6724f8
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** Each finding stores both snake_case and camelCase variants such as `guardrail_id` and `guardrailId`, plus `findingId` and `fingerprint` with identical values in `evaluations`. This makes the contract noisier and invites inconsistent reads.  
**Suggestion:** Pick one naming convention for persisted fields in this file, preferably the project’s canonical schema, and remove redundant aliases unless they are explicitly required by a boundary format.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** Each finding stores both snake_case and camelCase variants such as `guardrail_id` and `guardrailId`, plus `findingId` and `fingerprint` with identical values in `evaluations`. This makes the contract noisier and invites inconsistent reads.  
**Suggestion:** Pick one naming convention for persisted fields in this file, preferably the project’s canonical schema, and remove redundant aliases unless they are explicitly required by a boundary format.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Avoid repeated empty repair/triage summary shape
**Finding key:** loop-a889804403c611fd3bc9
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft-questions-repair.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/draft-questions-repair.json`  
**Requirement:** R1  
**Issue:** This file duplicates the empty repair artifact structure from the coverage repair file, including versioning, timestamp field, summary shape, and empty `items`.  
**Suggestion:** Generate both repair artifacts through the same shared repair-result contract/template, parameterized by phase and source triage filename.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft-questions-repair.json`  
**Requirement:** R1  
**Issue:** This file duplicates the empty repair artifact structure from the coverage repair file, including versioning, timestamp field, summary shape, and empty `items`.  
**Suggestion:** Generate both repair artifacts through the same shared repair-result contract/template, parameterized by phase and source triage filename.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Align triage summary wording with source review wording
**Finding key:** loop-48555a068ee20568631e
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft-questions-triage.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/draft-questions-triage.json`  
**Requirement:** R8  
**Issue:** The triage artifact says “No draft review findings to triage,” while the source review artifact says “No draft review findings recorded.” The meanings are close but not identical, which creates unnecessary terminology variation across generated review artifacts.  
**Suggestion:** Use a consistent summary phrase for empty review-derived artifacts, or make the triage-specific wording explicit through a shared naming convention.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft-questions-triage.json`  
**Requirement:** R8  
**Issue:** The triage artifact says “No draft review findings to triage,” while the source review artifact says “No draft review findings recorded.” The meanings are close but not identical, which creates unnecessary terminology variation across generated review artifacts.  
**Suggestion:** Use a consistent summary phrase for empty review-derived artifacts, or make the triage-specific wording explicit through a shared naming convention.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Remove duplicated empty review artifact wording
**Finding key:** loop-cc2f39086cac3bad0de0
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft-review-coverage.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/draft-review-coverage.json`  
**Requirement:** R8  
**Issue:** This file duplicates the same empty PASS review shape and summary text used by `draft-review-questions.json`, differing only by phase and timestamp. If these artifacts are hand-maintained, the duplication is easy to drift.  
**Suggestion:** Prefer generating both artifacts from a shared review-result template or helper so the common fields stay consistent.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft-review-coverage.json`  
**Requirement:** R8  
**Issue:** This file duplicates the same empty PASS review shape and summary text used by `draft-review-questions.json`, differing only by phase and timestamp. If these artifacts are hand-maintained, the duplication is easy to drift.  
**Suggestion:** Prefer generating both artifacts from a shared review-result template or helper so the common fields stay consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Split dense validation text into structured cases
**Finding key:** loop-645d413e3b05fd45d23b
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/draft.json
**Requirement:** R6
**Issue:** **File:** `specs/330-draft-review-repair-target/draft.json`  
**Requirement:** R6  
**Issue:** `analysis.validation` packs reproduction steps, six positive cases, three invalid cases, command execution, commit requirements, and audit requirements into one long string. This makes duplicate case coverage and future edits harder to review.  
**Suggestion:** Represent the validation plan as structured arrays, for example `reproduction`, `positiveCases`, `invalidCases`, and `commands`, while preserving the same content.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/draft.json`  
**Requirement:** R6  
**Issue:** `analysis.validation` packs reproduction steps, six positive cases, three invalid cases, command execution, commit requirements, and audit requirements into one long string. This makes duplicate case coverage and future edits harder to review.  
**Suggestion:** Represent the validation plan as structured arrays, for example `reproduction`, `positiveCases`, `invalidCases`, and `commands`, while preserving the same content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Deduplicate Repeated Recovery Baselines
**Finding key:** loop-7ae76e3657709b0c13b7
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/flow.json`  
**Requirement:** R7  
**Issue:** `reviewRecoveryBaselines` contains five entries with the same `kind`, `phase`, `canonicalPhase`, `fingerprint`, and `trigger`, differing only by `createdAt`. This makes the flow state noisy and weakens the “no duplicate artifact/review” invariant by preserving repeated equivalent recovery records.  
**Suggestion:** Store one recovery baseline per `{kind, phase, fingerprint.hash, trigger}` and represent repeats as an explicit bounded counter or history array if the timestamps are needed.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/flow.json`  
**Requirement:** R7  
**Issue:** `reviewRecoveryBaselines` contains five entries with the same `kind`, `phase`, `canonicalPhase`, `fingerprint`, and `trigger`, differing only by `createdAt`. This makes the flow state noisy and weakens the “no duplicate artifact/review” invariant by preserving repeated equivalent recovery records.  
**Suggestion:** Store one recovery baseline per `{kind, phase, fingerprint.hash, trigger}` and represent repeats as an explicit bounded counter or history array if the timestamps are needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Normalize Review Status Timestamps
**Finding key:** loop-52136deef8bffebc8b4f
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/flow.json`  
**Requirement:** R7  
**Issue:** The `impl-review` step is `in_progress` with a `runtimeLog` whose `endedAt` is earlier than the step’s `startedAt`. This stale runtime log makes the current state ambiguous and looks like dead or incorrectly retained state.  
**Suggestion:** Clear the stale `runtimeLog` when reopening or restarting a step, or move previous executions into a bounded attempt history so the active step has only current execution metadata.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/flow.json`  
**Requirement:** R7  
**Issue:** The `impl-review` step is `in_progress` with a `runtimeLog` whose `endedAt` is earlier than the step’s `startedAt`. This stale runtime log makes the current state ambiguous and looks like dead or incorrectly retained state.  
**Suggestion:** Clear the stale `runtimeLog` when reopening or restarting a step, or move previous executions into a bounded attempt history so the active step has only current execution metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Remove Duplicate Gate Failure Blocks
**Finding key:** loop-09b74fefeb5d97ef3327
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/issue-log.json
**Requirement:** R6
**Issue:** **File:** `specs/330-draft-review-repair-target/issue-log.json`  
**Requirement:** R6  
**Issue:** The same scenario-validity failure is logged repeatedly across multiple `spec-gate` entries with nearly identical observations for R1, R2, R3, R6, R7, and R8. This duplicates bulk JSON and makes the actual state harder to review.  
**Suggestion:** Collapse repeated findings into one canonical issue-log entry and add a compact repeat reference, such as `repeatedFromIssueLogId` plus `attempt`, instead of copying the full observation matrix each time.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/issue-log.json`  
**Requirement:** R6  
**Issue:** The same scenario-validity failure is logged repeatedly across multiple `spec-gate` entries with nearly identical observations for R1, R2, R3, R6, R7, and R8. This duplicates bulk JSON and makes the actual state harder to review.  
**Suggestion:** Collapse repeated findings into one canonical issue-log entry and add a compact repeat reference, such as `repeatedFromIssueLogId` plus `attempt`, instead of copying the full observation matrix each time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Bound Recovery Discovery Truncation Explicitly
**Finding key:** loop-eb7d0226ecd752dc7fa0
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/issue-log.json`  
**Requirement:** R7  
**Issue:** The final `impl-review` entry says recovery discovery “truncated at 200 entries,” but the artifact does not record the configured bound or the total candidate count. Under the bounded-resource-usage guardrail, truncation should be explicit enough to audit.  
**Suggestion:** Add structured fields such as `scanLimit: 200`, `candidateCount`, and `truncated: true` to the issue-log entry, rather than relying only on prose in `reason` / `trigger`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/issue-log.json`  
**Requirement:** R7  
**Issue:** The final `impl-review` entry says recovery discovery “truncated at 200 entries,” but the artifact does not record the configured bound or the total candidate count. Under the bounded-resource-usage guardrail, truncation should be explicit enough to audit.  
**Suggestion:** Add structured fields such as `scanLimit: 200`, `candidateCount`, and `truncated: true` to the issue-log entry, rather than relying only on prose in `reason` / `trigger`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Add trailing newline to markdown review artifacts
**Finding key:** loop-61150647682a9e5ce2ce
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/spec-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The file has no trailing newline. This is minor, but it creates noisy diffs and is inconsistent with common markdown/text-file conventions.  
**Suggestion:** Ensure the review-history markdown writer always terminates files with `\n`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/spec-attempt-001.md`  
**Requirement:** R1  
**Issue:** The file has no trailing newline. This is minor, but it creates noisy diffs and is inconsistent with common markdown/text-file conventions.  
**Suggestion:** Ensure the review-history markdown writer always terminates files with `\n`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Add trailing newline to markdown review artifacts
**Finding key:** loop-04844ce16f66a2de2fcf
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec-review.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/spec-review.md`  
**Requirement:** R1  
**Issue:** The file has no trailing newline. This is minor, but it creates noisy diffs and is inconsistent with common markdown/text-file conventions.  
**Suggestion:** Ensure the review-history markdown writer always terminates files with `\n`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec-review.md`  
**Requirement:** R1  
**Issue:** The file has no trailing newline. This is minor, but it creates noisy diffs and is inconsistent with common markdown/text-file conventions.  
**Suggestion:** Ensure the review-history markdown writer always terminates files with `\n`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Remove duplicated finding payloads inside attempt JSON
**Finding key:** loop-fb4276eb18b7145f36c0
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/test-attempt-001.json
**Requirement:** R4
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-001.json`  
**Requirement:** R4  
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with mostly duplicated title, fingerprint, disposition, rationale, and issue/body text. This increases drift risk when artifacts are repaired or regenerated.  
**Suggestion:** If the consumer does not require both shapes, keep one canonical array and derive the alternate view at read/render time. If both are required for compatibility, add a clear schema-level reason in the generator rather than storing manually duplicated content.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-001.json`  
**Requirement:** R4  
**Issue:** Each finding is represented twice: once in `blockingFindings` and again in `findings`, with mostly duplicated title, fingerprint, disposition, rationale, and issue/body text. This increases drift risk when artifacts are repaired or regenerated.  
**Suggestion:** If the consumer does not require both shapes, keep one canonical array and derive the alternate view at read/render time. If both are required for compatibility, add a clear schema-level reason in the generator rather than storing manually duplicated content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Add trailing newline to test review markdown artifact
**Finding key:** loop-e120acce5711f8d2651e
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/test-attempt-001.md
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The file also lacks a trailing newline, creating avoidable diff noise.  
**Suggestion:** Update the artifact generation path so all emitted markdown files end with a newline consistently.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-001.md`  
**Requirement:** R1  
**Issue:** The file also lacks a trailing newline, creating avoidable diff noise.  
**Suggestion:** Update the artifact generation path so all emitted markdown files end with a newline consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Remove duplicated finding payloads inside second attempt JSON
**Finding key:** loop-e4019677a722941edc7b
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/test-attempt-002.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-002.json`  
**Requirement:** R8  
**Issue:** The same duplication pattern appears between `blockingFindings` and `findings`, repeating nearly identical data for both R8 findings. This makes future review-history repair more error-prone.  
**Suggestion:** Normalize the artifact to a single source of finding data, or generate one view from the other during serialization so repeated fields cannot diverge.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-002.json`  
**Requirement:** R8  
**Issue:** The same duplication pattern appears between `blockingFindings` and `findings`, repeating nearly identical data for both R8 findings. This makes future review-history repair more error-prone.  
**Suggestion:** Normalize the artifact to a single source of finding data, or generate one view from the other during serialization so repeated fields cannot diverge.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Add trailing newlines to Markdown artifacts
**Finding key:** loop-a82ce0c7267bc8d1cd52
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/test-attempt-002.md
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-002.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline, which is inconsistent with typical repository text-file formatting and creates avoidable diff noise.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-002.md`  
**Requirement:** R8  
**Issue:** The file has no trailing newline, which is inconsistent with typical repository text-file formatting and creates avoidable diff noise.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Normalize duplicated scenario evidence fields
**Finding key:** loop-6e0f17778f58846c8da4
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/scenario-validity-result.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/scenario-validity-result.json`  
**Requirement:** R1  
**Issue:** The same `command` and `raw_output_lines` values are duplicated across all eight summary entries. This makes the artifact noisy and easy to edit inconsistently if regenerated or repaired manually.  
**Suggestion:** Move shared evidence fields to a top-level `evidenceDefaults` or similar object, and keep per-requirement entries limited to `test_file`, `test_name`, and classification-specific data.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/scenario-validity-result.json`  
**Requirement:** R1  
**Issue:** The same `command` and `raw_output_lines` values are duplicated across all eight summary entries. This makes the artifact noisy and easy to edit inconsistently if regenerated or repaired manually.  
**Suggestion:** Move shared evidence fields to a top-level `evidenceDefaults` or similar object, and keep per-requirement entries limited to `test_file`, `test_name`, and classification-specific data.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Add trailing newline to passing review artifact
**Finding key:** loop-f2c87c26a03df444011b
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/review-history/test-attempt-003.md
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-003.md`  
**Requirement:** R8  
**Issue:** The file also has no trailing newline, creating the same formatting inconsistency as the rejected review artifact.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/review-history/test-attempt-003.md`  
**Requirement:** R8  
**Issue:** The file also has no trailing newline, creating the same formatting inconsistency as the rejected review artifact.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Add trailing newline to passing review artifact
**Finding key:** loop-4d94819d85ed202def8c
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/test-review.md
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R8  
**Issue:** The file also has no trailing newline, creating the same formatting inconsistency as the rejected review artifact.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/test-review.md`  
**Requirement:** R8  
**Issue:** The file also has no trailing newline, creating the same formatting inconsistency as the rejected review artifact.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Remove duplicated finding records
**Finding key:** loop-51ddf2da822944cd9321
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec-gate-source.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/spec-gate-source.json`  
**Requirement:** R8  
**Issue:** The same guardrail failures are recorded twice: once under `evaluations[*].observations` and again under top-level `observations`. This duplicates reason text, fingerprints, metadata, and makes future consumers choose between two sources of truth.  
**Suggestion:** Keep one canonical representation. Prefer deriving top-level `observations` from `evaluations` at read/render time, or store only top-level observations and have evaluations reference them by `findingId`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec-gate-source.json`  
**Requirement:** R8  
**Issue:** The same guardrail failures are recorded twice: once under `evaluations[*].observations` and again under top-level `observations`. This duplicates reason text, fingerprints, metadata, and makes future consumers choose between two sources of truth.  
**Suggestion:** Keep one canonical representation. Prefer deriving top-level `observations` from `evaluations` at read/render time, or store only top-level observations and have evaluations reference them by `findingId`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Resolve contradictory review artifacts
**Finding key:** loop-2e70ad17fc50380e2e61
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec-review.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/spec-review.json`  
**Requirement:** R8  
**Issue:** `spec-review.json` reports `verdict: "PASS"` with zero findings, while `spec-gate-source.json` in the same diff reports `result: "fail"` with blocking guardrail violations for the same spec phase. This creates inconsistent review state.  
**Suggestion:** Regenerate or remove the stale artifact so the spec review and gate source agree on the final state. If the later approval made the gate pass, update the gate artifact instead of leaving a failing source beside a passing review.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec-review.json`  
**Requirement:** R8  
**Issue:** `spec-review.json` reports `verdict: "PASS"` with zero findings, while `spec-gate-source.json` in the same diff reports `result: "fail"` with blocking guardrail violations for the same spec phase. This creates inconsistent review state.  
**Suggestion:** Regenerate or remove the stale artifact so the spec review and gate source agree on the final state. If the later approval made the gate pass, update the gate artifact instead of leaving a failing source beside a passing review.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 4. Avoid repeating the same implementation target
**Finding key:** loop-08a54da0d156c4645e3e
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec.json
**Requirement:** R4
**Issue:** **File:** `specs/330-draft-review-repair-target/spec.json`  
**Requirement:** R4  
**Issue:** `overview.modules` and `overview.data_flow` both repeat that `src/flow/commands/review.js` normalizes `repairTargets` as non-blocking `repair_target` findings. The duplicated statement is easy to let drift.  
**Suggestion:** Keep the module responsibility in `overview.modules` and the transformation detail in `overview.data_flow`, or move the shared wording into one decision entry and reference it from the task notes.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec.json`  
**Requirement:** R4  
**Issue:** `overview.modules` and `overview.data_flow` both repeat that `src/flow/commands/review.js` normalizes `repairTargets` as non-blocking `repair_target` findings. The duplicated statement is easy to let drift.  
**Suggestion:** Keep the module responsibility in `overview.modules` and the transformation detail in `overview.data_flow`, or move the shared wording into one decision entry and reference it from the task notes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Remove dead placeholders from markdown spec
**Finding key:** loop-08726d0402d46789d334
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/spec.md`  
**Requirement:** R8  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are empty placeholders that add noise and can be mistaken for incomplete required content.  
**Suggestion:** Remove the empty sections, or populate them with meaningful content. Since `spec.json` has `"open_questions": []`, omitting the section is cleaner.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec.md`  
**Requirement:** R8  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These are empty placeholders that add noise and can be mistaken for incomplete required content.  
**Suggestion:** Remove the empty sections, or populate them with meaningful content. Since `spec.json` has `"open_questions": []`, omitting the section is cleaner.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 1. Remove duplicated gate findings
**Finding key:** loop-395c6d5f5e9623887bcd
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/task-impl-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/task-impl-gate-source.json`  
**Requirement:** R1  
**Issue:** The same seven violations are represented twice: once under `evaluations[]` and again under top-level `observations[]`, with mostly duplicated `reason`/`observed`, `where`, severity, guardrail, disposition, and timestamps. This makes the artifact noisy and increases drift risk between the two sections.  
**Suggestion:** Keep one canonical representation and derive the other at render/read time, or reduce `observations[]` to references into `evaluations[]` rather than copying full violation payloads.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/task-impl-gate-source.json`  
**Requirement:** R1  
**Issue:** The same seven violations are represented twice: once under `evaluations[]` and again under top-level `observations[]`, with mostly duplicated `reason`/`observed`, `where`, severity, guardrail, disposition, and timestamps. This makes the artifact noisy and increases drift risk between the two sections.  
**Suggestion:** Keep one canonical representation and derive the other at render/read time, or reduce `observations[]` to references into `evaluations[]` rather than copying full violation payloads.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Use real requirement IDs instead of null
**Finding key:** loop-a230db45b1353ef430b8
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/task-impl-gate-source.json
**Requirement:** R2
**Issue:** **File:** `specs/330-draft-review-repair-target/task-impl-gate-source.json`  
**Requirement:** R2  
**Issue:** Several findings clearly mention `R1`, `R2`, `R3`, `R6`, `R7`, and `R8` in their reason text, but every `requirementId` is `null`. Consumers must parse prose to recover structured requirement ownership.  
**Suggestion:** Populate `requirementId` with the matching requirement where known, and reserve `null` only for findings that are genuinely not tied to a single requirement.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/task-impl-gate-source.json`  
**Requirement:** R2  
**Issue:** Several findings clearly mention `R1`, `R2`, `R3`, `R6`, `R7`, and `R8` in their reason text, but every `requirementId` is `null`. Consumers must parse prose to recover structured requirement ownership.  
**Suggestion:** Populate `requirementId` with the matching requirement where known, and reserve `null` only for findings that are genuinely not tied to a single requirement.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 3. Consolidate repeated task test-strategy wording
**Finding key:** loop-9268c636213576cdd209
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tasks/T-2.md
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/tasks/T-2.md`  
**Requirement:** R8  
**Issue:** The test strategy repeats the same scenario-header and execution wording pattern already present in adjacent generated task files, while only the requirement set and concrete commands differ. This is a small duplication point in generated task prose.  
**Suggestion:** Move the common phrasing into the generator/template and let each task supply only the variable parts: requirement header, scenario location, and command list.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tasks/T-2.md`  
**Requirement:** R8  
**Issue:** The test strategy repeats the same scenario-header and execution wording pattern already present in adjacent generated task files, while only the requirement set and concrete commands differ. This is a small duplication point in generated task prose.  
**Suggestion:** Move the common phrasing into the generator/template and let each task supply only the variable parts: requirement header, scenario location, and command list.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 4. Clarify “producer focused test” reference
**Finding key:** loop-d2ede5eff2cea32c53a3
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tasks/T-3.md
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/tasks/T-3.md`  
**Requirement:** R7  
**Issue:** The phrase “the producer focused test” is less precise than the concrete test paths used elsewhere in the tasks. It forces readers to infer which test file is intended.  
**Suggestion:** Name the exact test file or scenario path, matching the specificity used for `tests/unit/flow/retry-exhaustion-defer.test.js`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tasks/T-3.md`  
**Requirement:** R7  
**Issue:** The phrase “the producer focused test” is less precise than the concrete test paths used elsewhere in the tasks. It forces readers to infer which test file is intended.  
**Suggestion:** Name the exact test file or scenario path, matching the specificity used for `tests/unit/flow/retry-exhaustion-defer.test.js`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Remove Committed Raw Failure Log
**Finding key:** loop-141bf3cc55f05a2d8bde
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/.raw/scenario-validity.log
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/.raw/scenario-validity.log`
**Requirement:** R1
**Issue:** This file is a generated execution log containing absolute local paths, transient timings, stack traces, and pre-fix failures. It is not stable test source or structured review output, and it adds noisy, environment-specific data to the change set.
**Suggestion:** Do not commit `.raw/scenario-validity.log`; keep it as local evidence or regenerate it during the workflow only when needed.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/.raw/scenario-validity.log`
**Requirement:** R1
**Issue:** This file is a generated execution log containing absolute local paths, transient timings, stack traces, and pre-fix failures. It is not stable test source or structured review output, and it adds noisy, environment-specific data to the change set.
**Suggestion:** Do not commit `.raw/scenario-validity.log`; keep it as local evidence or regenerate it during the workflow only when needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Avoid Duplicated Route Assertions
**Finding key:** loop-ef1efbf28963d01fdf54
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js
**Requirement:** R1
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`
**Requirement:** R1
**Issue:** The R1 and R2 tests duplicate the same assertions for `questions` and `coverage`, differing only by route and test label.
**Suggestion:** Extract a small helper such as `assertRepairTargetOnlyRoute(route)` or use a loop over route cases to centralize the common assertions while keeping requirement-specific test names visible.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`
**Requirement:** R1
**Issue:** The R1 and R2 tests duplicate the same assertions for `questions` and `coverage`, differing only by route and test label.
**Suggestion:** Extract a small helper such as `assertRepairTargetOnlyRoute(route)` or use a loop over route cases to centralize the common assertions while keeping requirement-specific test names visible.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Extract Repeated Empty Finding Assertions
**Finding key:** loop-e3bdac947e8669def177
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js
**Requirement:** R5
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`
**Requirement:** R5
**Issue:** Assertions for empty `blockingFindings`, `advisoryFindings`, and `repairTargets` are repeated across multiple tests.
**Suggestion:** Add a helper like `assertNoRawFindings(rawArtifact)` or `assertDraftRawCounts(rawArtifact, counts)` to reduce duplication and make future expectation changes less scattered.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`
**Requirement:** R5
**Issue:** Assertions for empty `blockingFindings`, `advisoryFindings`, and `repairTargets` are repeated across multiple tests.
**Suggestion:** Add a helper like `assertNoRawFindings(rawArtifact)` or `assertDraftRawCounts(rawArtifact, counts)` to reduce duplication and make future expectation changes less scattered.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 4. Rename `proposal(kind)` for Clarity
**Finding key:** loop-9d534f131568f0c1c7f7
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js
**Requirement:** R3
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`
**Requirement:** R3
**Issue:** `DraftReviewScenario.proposal(kind)` sounds like it returns a generic proposal, but it actually builds fixture proposals for specific review classifications.
**Suggestion:** Rename it to `buildProposal(kind)` or `proposalForKind(kind)` to make the fixture-construction role clearer.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`
**Requirement:** R3
**Issue:** `DraftReviewScenario.proposal(kind)` sounds like it returns a generic proposal, but it actually builds fixture proposals for specific review classifications.
**Suggestion:** Rename it to `buildProposal(kind)` or `proposalForKind(kind)` to make the fixture-construction role clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 5. Replace `issue-454` Temp Prefix
**Finding key:** loop-087f297b15bcd75d8284
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`
**Requirement:** R8
**Issue:** The temporary directory prefix uses `issue-454`, while the spec path and change set are for `330-draft-review-repair-target`. This stale identifier makes the test harder to trace.
**Suggestion:** Rename the prefix to something aligned with the current spec, for example `draft-repair-target-${route}-`.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/tests/draft-repair-target-recording.test.js`
**Requirement:** R8
**Issue:** The temporary directory prefix uses `issue-454`, while the spec path and change set are for `330-draft-review-repair-target`. This stale identifier makes the test harder to trace.
**Suggestion:** Rename the prefix to something aligned with the current spec, for example `draft-repair-target-${route}-`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 6. Remove Volatile Timestamp From Review Artifact If Committed
**Finding key:** loop-0210b57c3f10b1ff9af8
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/test-review.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/test-review.json`
**Requirement:** R8
**Issue:** `generatedAt` is a volatile timestamp in a committed artifact. If this file is regenerated, it will churn even when the logical review result is unchanged.
**Suggestion:** Omit `generatedAt` from committed review artifacts, or keep generated review artifacts out of source control unless the workflow requires them as canonical state.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/test-review.json`
**Requirement:** R8
**Issue:** `generatedAt` is a volatile timestamp in a committed artifact. If this file is regenerated, it will churn even when the logical review result is unchanged.
**Suggestion:** Omit `generatedAt` from committed review artifacts, or keep generated review artifacts out of source control unless the workflow requires them as canonical state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. I’ll review only the three files in the supplied diff and focus on maintainability/design issues plus the bounded-resource guardrail.### 1. Preserve repair target fields for all repair targets
**Finding key:** loop-2b69026eddc70411521b
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `target` and `evidence` are only retained when `repairTarget: isDraftRepairPhase` is true. That means non-draft `repairTargets` still get `category=repair_target` but lose repair-target-specific fields, which is inconsistent with the normalization path.  
**Suggestion:** Pass `repairTarget: true` for every `artifact.repairTargets` item, and keep the draft-phase condition only for severity selection.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `target` and `evidence` are only retained when `repairTarget: isDraftRepairPhase` is true. That means non-draft `repairTargets` still get `category=repair_target` but lose repair-target-specific fields, which is inconsistent with the normalization path.  
**Suggestion:** Pass `repairTarget: true` for every `artifact.repairTargets` item, and keep the draft-phase condition only for severity selection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Split repair-target field handling from severity policy
**Finding key:** loop-ec0e8418426a3d4d0b36
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** The `repairTarget` option currently controls both semantic identity and field preservation, while severity is decided separately by `isDraftRepairPhase`. This makes the intent easy to misread and contributed to the field-retention issue above.  
**Suggestion:** Extract a small helper such as `isDraftRepairPhase(phase)` or `repairTargetSeverityForPhase(phase)`, and rename the push option to something more literal like `includeRepairTargetFields`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** The `repairTarget` option currently controls both semantic identity and field preservation, while severity is decided separately by `isDraftRepairPhase`. This makes the intent easy to misread and contributed to the field-retention issue above.  
**Suggestion:** Extract a small helper such as `isDraftRepairPhase(phase)` or `repairTargetSeverityForPhase(phase)`, and rename the push option to something more literal like `includeRepairTargetFields`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Add an explicit bound for normalized finding inputs
**Finding key:** loop-bb16a2c027b65ad5e2e4
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R3
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R3  
**Issue:** `normalizeReviewFindingRecords` iterates over all `blockingFindings`, `nonBlockingImprovements`, `advisoryFindings`, `repairTargets`, and `findings` without an explicit count bound. This violates the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Apply an existing artifact validation limit if one exists, or introduce a local maximum total finding count before normalization and reject artifacts exceeding it with a clear error.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R3  
**Issue:** `normalizeReviewFindingRecords` iterates over all `blockingFindings`, `nonBlockingImprovements`, `advisoryFindings`, `repairTargets`, and `findings` without an explicit count bound. This violates the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Apply an existing artifact validation limit if one exists, or introduce a local maximum total finding count before normalization and reject artifacts exceeding it with a clear error.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 5. Align repair target semantics between source and generated artifacts
**Finding key:** loop-177e0555f7161a098fa5
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`
**Requirement:** R4
**Issue:** The source review notes indicate `repairTargets` are normalized inconsistently: non-draft repair targets receive `category=repair_target` but lose fields like `target` and `evidence`. That inconsistency can propagate into multiple generated artifacts and make cross-file review state disagree.
**Suggestion:** Treat every `artifact.repairTargets` item as a repair target for field preservation, and keep phase-specific logic limited to severity or blocking policy.
**Suggestion:** **File:** `src/flow/commands/review.js`
**Requirement:** R4
**Issue:** The source review notes indicate `repairTargets` are normalized inconsistently: non-draft repair targets receive `category=repair_target` but lose fields like `target` and `evidence`. That inconsistency can propagate into multiple generated artifacts and make cross-file review state disagree.
**Suggestion:** Treat every `artifact.repairTargets` item as a repair target for field preservation, and keep phase-specific logic limited to severity or blocking policy.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 7. Remove repeated transient or bounded-scan evidence from committed state
**Finding key:** loop-796abfd9b67fe48e6c39
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/330-draft-review-repair-target/issue-log.json`
**Requirement:** R7
**Issue:** Several artifacts preserve repeated execution or recovery evidence: duplicate recovery baselines, repeated gate failure blocks, raw command output repeated per requirement, and prose-only truncation at 200 entries. These patterns weaken the bounded-resource guardrail across the workflow state.
**Suggestion:** Store bounded evidence structurally and once: use fields like `scanLimit`, `candidateCount`, `truncated`, `attempt`, and references to prior entries instead of copying repeated payloads or relying on prose.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/issue-log.json`
**Requirement:** R7
**Issue:** Several artifacts preserve repeated execution or recovery evidence: duplicate recovery baselines, repeated gate failure blocks, raw command output repeated per requirement, and prose-only truncation at 200 entries. These patterns weaken the bounded-resource guardrail across the workflow state.
**Suggestion:** Store bounded evidence structurally and once: use fields like `scanLimit`, `candidateCount`, `truncated`, `attempt`, and references to prior entries instead of copying repeated payloads or relying on prose.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 8. Keep spec/review verdict artifacts mutually consistent
**Finding key:** loop-7aa4032e63536739a240
**Failure mode:** refactor
**File:** specs/330-draft-review-repair-target/spec-review.json
**Requirement:** R8
**Issue:** **File:** `specs/330-draft-review-repair-target/spec-review.json`
**Requirement:** R8
**Issue:** `spec-review.json` reports a passing review while `spec-gate-source.json` reports failing blocking guardrail violations for the same phase. This is a cross-file state contradiction.
**Suggestion:** Regenerate or remove stale artifacts so review verdicts and gate-source results agree. If the final state is pass, update the gate source; if the gate failed, the review artifact should not report a clean pass.
**Suggestion:** **File:** `specs/330-draft-review-repair-target/spec-review.json`
**Requirement:** R8
**Issue:** `spec-review.json` reports a passing review while `spec-gate-source.json` reports failing blocking guardrail violations for the same phase. This is a cross-file state contradiction.
**Suggestion:** Regenerate or remove stale artifacts so review verdicts and gate-source results agree. If the final state is pass, update the gate source; if the gate failed, the review artifact should not report a clean pass.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 5
