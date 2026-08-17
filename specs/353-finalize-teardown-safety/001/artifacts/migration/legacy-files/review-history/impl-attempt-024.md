# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Remove Redundant Empty Result Fields
**Finding key:** loop-556a10a07da67e192791
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/draft-review-questions.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`
**Requirement:** R8
**Issue:** The PASS result includes multiple empty arrays and null placeholders (`blockingFindings`, `advisoryFindings`, `repairTargets`, `taskId`) that add schema noise without carrying information.
**Suggestion:** Omit empty optional fields from successful review artifacts, or replace them with a compact `findings: []` field if the schema needs an explicit empty result.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`
**Requirement:** R8
**Issue:** The PASS result includes multiple empty arrays and null placeholders (`blockingFindings`, `advisoryFindings`, `repairTargets`, `taskId`) that add schema noise without carrying information.
**Suggestion:** Omit empty optional fields from successful review artifacts, or replace them with a compact `findings: []` field if the schema needs an explicit empty result.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 5. Consolidate Empty Draft Sections
**Finding key:** loop-bc0fa755fb65fa5fb4b5
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/draft.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/draft.json`
**Requirement:** R8
**Issue:** Several sections encode empty placeholders (`requiresUserJudgment`, `notes`, `droppedReason`) where absence already communicates the same state.
**Suggestion:** Drop optional empty sections/fields from the draft artifact, or normalize them through one schema-level “none” convention to reduce dead metadata.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/draft.json`
**Requirement:** R8
**Issue:** Several sections encode empty placeholders (`requiresUserJudgment`, `notes`, `droppedReason`) where absence already communicates the same state.
**Suggestion:** Drop optional empty sections/fields from the draft artifact, or normalize them through one schema-level “none” convention to reduce dead metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Bound Flow History Growth
**Finding key:** loop-6cb77697d24d121678cf
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R1
**Issue:** `flow.json` stores large, append-only runtime collections such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` without an evident retention bound. This violates the bounded-resource-usage guardrail because repeated retries/reviews can grow the artifact indefinitely.
**Suggestion:** Add an explicit retention policy for each append-only collection, for example keep the latest N records plus canonical summary pointers, or move older entries into bounded referenced artifacts.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R1
**Issue:** `flow.json` stores large, append-only runtime collections such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` without an evident retention bound. This violates the bounded-resource-usage guardrail because repeated retries/reviews can grow the artifact indefinitely.
**Suggestion:** Add an explicit retention policy for each append-only collection, for example keep the latest N records plus canonical summary pointers, or move older entries into bounded referenced artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Deduplicate Repeated Target State Snapshots
**Finding key:** loop-aa21a71480640452a865
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R6
**Issue:** `reviewConvergence.records[*].targetState.entries` repeats near-identical full file snapshots many times, making the file hard to review and increasing storage churn.
**Suggestion:** Store each unique target-state snapshot once in a keyed map by digest, then have each record reference `targetStateDigest` only or a compact `targetStateRef`.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R6
**Issue:** `reviewConvergence.records[*].targetState.entries` repeats near-identical full file snapshots many times, making the file hard to review and increasing storage churn.
**Suggestion:** Store each unique target-state snapshot once in a keyed map by digest, then have each record reference `targetStateDigest` only or a compact `targetStateRef`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Avoid Committing Volatile Runtime Telemetry
**Finding key:** loop-9db85ea5707204128f4f
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R8
**Issue:** The file contains highly volatile execution telemetry such as timestamps, token counts, runtime logs, invocation IDs, and retry attempts. This creates noisy diffs and obscures the durable state relevant to the spec.
**Suggestion:** Split durable flow state from runtime telemetry. Keep stable fields in `flow.json` and write logs/metrics to ignored or bounded artifact files referenced by digest.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R8
**Issue:** The file contains highly volatile execution telemetry such as timestamps, token counts, runtime logs, invocation IDs, and retry attempts. This creates noisy diffs and obscures the durable state relevant to the spec.
**Suggestion:** Split durable flow state from runtime telemetry. Keep stable fields in `flow.json` and write logs/metrics to ignored or bounded artifact files referenced by digest.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Avoid Duplicating Retry Recovery Records
**Finding key:** loop-1f819602939680ea28f1
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The retry recovery entry duplicates the same recovery metadata already stored in `retry-recovery.json`, including IDs, hashes, command text, counters, and timestamps. This creates two sources of truth that can drift.  
**Suggestion:** Keep `issue-log.json` as a concise audit reference only, for example storing `step`, `issueLogId`, `retryRecoveryId`, `reason`, and `timestamp`, while leaving the full structured recovery payload in `retry-recovery.json`.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The retry recovery entry duplicates the same recovery metadata already stored in `retry-recovery.json`, including IDs, hashes, command text, counters, and timestamps. This creates two sources of truth that can drift.  
**Suggestion:** Keep `issue-log.json` as a concise audit reference only, for example storing `step`, `issueLogId`, `retryRecoveryId`, `reason`, and `timestamp`, while leaving the full structured recovery payload in `retry-recovery.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Remove Redundant Identifier Fields
**Finding key:** loop-6892916f59e039cc95ba
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The retry recovery entry contains both `grantId` and `id` with the same value, while most other entries use `issueLogId` as the entry identifier. This naming overlap makes the schema harder to read and maintain.  
**Suggestion:** Use one canonical field for the recovery identifier, preferably `issueLogId` for log identity plus `recoveryId` if a domain-specific recovery reference is needed.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The retry recovery entry contains both `grantId` and `id` with the same value, while most other entries use `issueLogId` as the entry identifier. This naming overlap makes the schema harder to read and maintain.  
**Suggestion:** Use one canonical field for the recovery identifier, preferably `issueLogId` for log identity plus `recoveryId` if a domain-specific recovery reference is needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Consolidate Repeated Guardrail Failure Text
**Finding key:** loop-f011f85b1d497beafcdb
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat the same long guardrail text across `reason`, `observations[].observed`, and `failedEvaluations[].reason`. This makes the file very large and increases the chance of inconsistent edits.  
**Suggestion:** Store the detailed text once per observation and derive summary fields from it, or replace repeated `failedEvaluations` reasons with references to observation IDs.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat the same long guardrail text across `reason`, `observations[].observed`, and `failedEvaluations[].reason`. This makes the file very large and increases the chance of inconsistent edits.  
**Suggestion:** Store the detailed text once per observation and derive summary fields from it, or replace repeated `failedEvaluations` reasons with references to observation IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Bound Audit Log Growth
**Finding key:** loop-34ddffd7653a270af811
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The new issue log is nearly 2,000 lines and contains large embedded payloads. Continued retries or review loops could grow this file without an explicit cap, which violates the bounded-resource-usage guardrail for bulk log accumulation.  
**Suggestion:** Add an explicit retention policy to the artifact format, such as max entries per phase, max serialized bytes, or archival/rollover behavior for older review evidence.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The new issue log is nearly 2,000 lines and contains large embedded payloads. Continued retries or review loops could grow this file without an explicit cap, which violates the bounded-resource-usage guardrail for bulk log accumulation.  
**Suggestion:** Add an explicit retention policy to the artifact format, such as max entries per phase, max serialized bytes, or archival/rollover behavior for older review evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Remove duplicate review-result artifacts
**Finding key:** loop-3ac0373d35a42198f945
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md`  
**Requirement:** R7  
**Issue:** This Markdown file records the same effective PASS/no-findings result as `spec-attempt-002.json`, creating duplicate review history in two formats with no additional signal.  
**Suggestion:** Keep the structured JSON attempt as the canonical artifact, or add a short note explaining why both formats are intentionally retained.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md`  
**Requirement:** R7  
**Issue:** This Markdown file records the same effective PASS/no-findings result as `spec-attempt-002.json`, creating duplicate review history in two formats with no additional signal.  
**Suggestion:** Keep the structured JSON attempt as the canonical artifact, or add a short note explaining why both formats are intentionally retained.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Add trailing newline
**Finding key:** loop-52ee538f5fc7aa7bc5a3
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md`  
**Requirement:** R7  
**Issue:** The file has no trailing newline, which is inconsistent with common repository formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md`  
**Requirement:** R7  
**Issue:** The file has no trailing newline, which is inconsistent with common repository formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Remove duplicate review-result artifacts
**Finding key:** loop-76dfd5401c615a181fe0
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/review-history/spec-attempt-002.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-002.md`  
**Requirement:** R7  
**Issue:** This Markdown file records the same effective PASS/no-findings result as `spec-attempt-002.json`, creating duplicate review history in two formats with no additional signal.  
**Suggestion:** Keep the structured JSON attempt as the canonical artifact, or add a short note explaining why both formats are intentionally retained.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-002.md`  
**Requirement:** R7  
**Issue:** This Markdown file records the same effective PASS/no-findings result as `spec-attempt-002.json`, creating duplicate review history in two formats with no additional signal.  
**Suggestion:** Keep the structured JSON attempt as the canonical artifact, or add a short note explaining why both formats are intentionally retained.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Add trailing newline
**Finding key:** loop-c760cc46ed933792e7b9
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/review-history/spec-attempt-002.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-002.md`  
**Requirement:** R7  
**Issue:** The file has no trailing newline, which is inconsistent with common repository formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-002.md`  
**Requirement:** R7  
**Issue:** The file has no trailing newline, which is inconsistent with common repository formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Remove duplicate review-result artifacts
**Finding key:** loop-37ad2a89cfbc84d76470
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-review.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-review.md`  
**Requirement:** R7  
**Issue:** This Markdown file records the same effective PASS/no-findings result as `spec-attempt-002.json`, creating duplicate review history in two formats with no additional signal.  
**Suggestion:** Keep the structured JSON attempt as the canonical artifact, or add a short note explaining why both formats are intentionally retained.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-review.md`  
**Requirement:** R7  
**Issue:** This Markdown file records the same effective PASS/no-findings result as `spec-attempt-002.json`, creating duplicate review history in two formats with no additional signal.  
**Suggestion:** Keep the structured JSON attempt as the canonical artifact, or add a short note explaining why both formats are intentionally retained.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Add trailing newline
**Finding key:** loop-2ffce25322bedb99e81b
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-review.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-review.md`  
**Requirement:** R7  
**Issue:** The file has no trailing newline, which is inconsistent with common repository formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-review.md`  
**Requirement:** R7  
**Issue:** The file has no trailing newline, which is inconsistent with common repository formatting and can create unnecessary diff churn.  
**Suggestion:** Add a final newline at the end of the Markdown file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 2. Consolidate repeated evidence fields
**Finding key:** loop-cbe9fbca0773b9dbdde4
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/scenario-validity-result.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** Each `summary` entry repeats the same `test_file`, `command`, and `raw_output_lines`, making the artifact noisy and harder to review.  
**Suggestion:** Move shared evidence fields to a top-level `evidenceDefaults` or equivalent shared object, leaving each requirement entry with only the requirement-specific `id`, `classification`, and `test_name`.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/scenario-validity-result.json`  
**Requirement:** R8  
**Issue:** Each `summary` entry repeats the same `test_file`, `command`, and `raw_output_lines`, making the artifact noisy and harder to review.  
**Suggestion:** Move shared evidence fields to a top-level `evidenceDefaults` or equivalent shared object, leaving each requirement entry with only the requirement-specific `id`, `classification`, and `test_name`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Remove Duplicate Finding Payloads
**Finding key:** loop-187ade53351c2c778140
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-gate-source.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-gate-source.json`  
**Requirement:** R7  
**Issue:** The same `spec-test-coverage` violation is represented once under `evaluations[0].observations` and again under top-level `observations`, with mostly duplicated fields and different `findingId`/`fingerprint` values. This creates avoidable duplication and risks consumers treating one issue as two separate findings.  
**Suggestion:** Keep one canonical observation source, or make the top-level `observations` reference the evaluation finding instead of duplicating the full payload.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-gate-source.json`  
**Requirement:** R7  
**Issue:** The same `spec-test-coverage` violation is represented once under `evaluations[0].observations` and again under top-level `observations`, with mostly duplicated fields and different `findingId`/`fingerprint` values. This creates avoidable duplication and risks consumers treating one issue as two separate findings.  
**Suggestion:** Keep one canonical observation source, or make the top-level `observations` reference the evaluation finding instead of duplicating the full payload.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Reconcile Contradictory Review Outcomes
**Finding key:** loop-d6a30f814a5ab67b039a
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-review.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`  
**Requirement:** R7  
**Issue:** `spec-review.json` reports `"verdict": "PASS"` with zero findings, while `spec-gate-source.json` reports a blocking `spec-test-coverage` failure for missing spec-local tests. These artifacts describe the same spec phase but disagree, which makes the review state ambiguous.  
**Suggestion:** Regenerate or update the review artifact so it reflects the blocking R7 coverage failure, or remove the stale passing review artifact from this change set.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`  
**Requirement:** R7  
**Issue:** `spec-review.json` reports `"verdict": "PASS"` with zero findings, while `spec-gate-source.json` reports a blocking `spec-test-coverage` failure for missing spec-local tests. These artifacts describe the same spec phase but disagree, which makes the review state ambiguous.  
**Suggestion:** Regenerate or update the review artifact so it reflects the blocking R7 coverage failure, or remove the stale passing review artifact from this change set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Align Task Status With Requirement Status
**Finding key:** loop-f9e110ab278d695c73e8
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R1  
**Issue:** Requirements R1 through R7 are marked `"status": "done"`, but their corresponding tasks T-1 through T-6 remain `"status": "pending"`. That inconsistency makes it unclear whether the spec considers the work complete or only planned.  
**Suggestion:** Update task statuses to match the requirement state, or keep the requirements pending until their tasks and evidence are complete.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R1  
**Issue:** Requirements R1 through R7 are marked `"status": "done"`, but their corresponding tasks T-1 through T-6 remain `"status": "pending"`. That inconsistency makes it unclear whether the spec considers the work complete or only planned.  
**Suggestion:** Update task statuses to match the requirement state, or keep the requirements pending until their tasks and evidence are complete.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 4. Simplify Repeated Lifecycle Descriptions
**Finding key:** loop-26723399160d48ba84f5
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R1  
**Issue:** The spec repeats near-identical checkpoint language across `goal`, `design_principles`, `overview.data_flow`, requirement R1, acceptance criteria, and task T-1. The repetition increases maintenance cost and makes future edits easy to miss.  
**Suggestion:** Keep the normative checkpoint behavior in R1 and acceptance criteria, then shorten the overview/task text to reference that requirement instead of restating the full behavior.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R1  
**Issue:** The spec repeats near-identical checkpoint language across `goal`, `design_principles`, `overview.data_flow`, requirement R1, acceptance criteria, and task T-1. The repetition increases maintenance cost and makes future edits easy to miss.  
**Suggestion:** Keep the normative checkpoint behavior in R1 and acceptance criteria, then shorten the overview/task text to reference that requirement instead of restating the full behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 5. Clarify “At Most One Retry Per Invocation” Naming
**Finding key:** loop-76487f15bc44e488a698
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.json
**Requirement:** R2
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R2  
**Issue:** The phrase “at most one retry per invocation” appears many times, but the spec does not name the policy as a distinct concept. This makes the text verbose and increases the chance of slight semantic drift between sections.  
**Suggestion:** Define a concise term such as `single-retry replay policy` once, then use that consistently in requirements, data flow, and task descriptions.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R2  
**Issue:** The phrase “at most one retry per invocation” appears many times, but the spec does not name the policy as a distinct concept. This makes the text verbose and increases the chance of slight semantic drift between sections.  
**Suggestion:** Define a concise term such as `single-retry replay policy` once, then use that consistently in requirements, data flow, and task descriptions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Remove Empty Placeholder Sections
**Finding key:** loop-0e668c2db7b00c8211fd
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R8  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These placeholders add noise and may be mistaken for intentionally incomplete spec content.  
**Suggestion:** Remove these sections until they contain real entries, or populate them with concrete implementation targets/open questions.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R8  
**Issue:** `## Implementation Targets` contains only `-`, and `## Open Questions` contains only `- [ ]`. These placeholders add noise and may be mistaken for intentionally incomplete spec content.  
**Suggestion:** Remove these sections until they contain real entries, or populate them with concrete implementation targets/open questions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Consolidate Repeated Retry Wording
**Finding key:** loop-dbb11c247d562342c4f8
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R1  
**Issue:** The phrase “at most one retry per invocation” is repeated across Goal, Scope, Data Flow, Clarifications, Requirements, and Acceptance Criteria. This makes future edits error-prone because the same policy must be kept consistent in many places.  
**Suggestion:** Define the retry policy once in Requirements R1/R2, then shorten surrounding sections to reference “the R1/R2 retry policy” or “recorded-checkpoint replay.”
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R1  
**Issue:** The phrase “at most one retry per invocation” is repeated across Goal, Scope, Data Flow, Clarifications, Requirements, and Acceptance Criteria. This makes future edits error-prone because the same policy must be kept consistent in many places.  
**Suggestion:** Define the retry policy once in Requirements R1/R2, then shorten surrounding sections to reference “the R1/R2 retry policy” or “recorded-checkpoint replay.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Clarify “Destructive Persistence”
**Finding key:** loop-4b1ba00cba02489715ad
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R1  
**Issue:** R1 says “destructive persistence, authority, worktree, branch, validation, pointer, and active-flow transition.” “Destructive persistence” is ambiguous because persistence itself is usually the safety boundary before destructive work, not the destructive action.  
**Suggestion:** Rename this to a clearer boundary list, such as “merge-outcome persistence, finalize-metadata persistence, authority deletion, worktree deletion, branch deletion, validation, pointer publication, and active-flow clearing.”
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R1  
**Issue:** R1 says “destructive persistence, authority, worktree, branch, validation, pointer, and active-flow transition.” “Destructive persistence” is ambiguous because persistence itself is usually the safety boundary before destructive work, not the destructive action.  
**Suggestion:** Rename this to a clearer boundary list, such as “merge-outcome persistence, finalize-metadata persistence, authority deletion, worktree deletion, branch deletion, validation, pointer publication, and active-flow clearing.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Avoid Duplicating Task Metadata Across Files
**Finding key:** loop-8dc171f39063c8e0e743
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R7  
**Issue:** The `## Tasks` section duplicates task titles, status, summaries, and file references that are also present in `tasks/T-1.md` through `tasks/T-6.md`. This creates two sources that can drift.  
**Suggestion:** Keep only a compact task index in `spec.md`, such as task ID plus link, and let each `tasks/T-*.md` own goal, acceptance criteria, implementation notes, and test strategy.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R7  
**Issue:** The `## Tasks` section duplicates task titles, status, summaries, and file references that are also present in `tasks/T-1.md` through `tasks/T-6.md`. This creates two sources that can drift.  
**Suggestion:** Keep only a compact task index in `spec.md`, such as task ID plus link, and let each `tasks/T-*.md` own goal, acceptance criteria, implementation notes, and test strategy.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Split The Combined Spec Header Into Per-Requirement Headers
**Finding key:** loop-52ce12e3f4d92ed49f1d
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R7  
**Issue:** The file has one broad `// spec: R1 R2 R3 R4 R5 R6 R7` header at the top, while individual tests are requirement-specific. This weakens traceability because any test in the file appears to cover every requirement.  
**Suggestion:** Move requirement headers next to the relevant test groups, for example `// spec: R1` before the checkpoint matrix tests, `// spec: R2` before retry target rejection tests, and so on. Keep the final meta-test aligned with that structure.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R7  
**Issue:** The file has one broad `// spec: R1 R2 R3 R4 R5 R6 R7` header at the top, while individual tests are requirement-specific. This weakens traceability because any test in the file appears to cover every requirement.  
**Suggestion:** Move requirement headers next to the relevant test groups, for example `// spec: R1` before the checkpoint matrix tests, `// spec: R2` before retry target rejection tests, and so on. Keep the final meta-test aligned with that structure.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Extract Duplicate Finalize Rejection Capture Logic
**Finding key:** loop-0ec39803e6667d75dea2
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js
**Requirement:** R2
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R2  
**Issue:** `assertForeignTargetRejected` and `assertMissingTargetRejected` duplicate the same run/catch/rejection serialization and journal snapshot comparison flow.  
**Suggestion:** Introduce a shared helper such as `assertRetryRejected(fixture, expectedPattern, extraAssertions)` that captures the result or thrown error once, checks the journal is unchanged, and lets callers add target-specific assertions.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R2  
**Issue:** `assertForeignTargetRejected` and `assertMissingTargetRejected` duplicate the same run/catch/rejection serialization and journal snapshot comparison flow.  
**Suggestion:** Introduce a shared helper such as `assertRetryRejected(fixture, expectedPattern, extraAssertions)` that captures the result or thrown error once, checks the journal is unchanged, and lets callers add target-specific assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Add An Explicit Upper Bound When Reading Recovery Journals
**Finding key:** loop-995f65caea3674f5cced
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R1  
**Issue:** `readRecoveryJournal` reads all filenames in `.senti/recovery/finalize-cleanup` and filters them without an explicit bound. The fixture should normally contain one file, but the helper does not enforce bounded directory processing before loading the list. This touches the `bounded-resource-usage` guardrail.  
**Suggestion:** Use a bounded scan or assert a maximum directory size before filtering, e.g. fail if `fs.readdirSync(directory).length > 2`, then assert exactly one `.json` journal. This keeps the test helper consistent with the project guardrail.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R1  
**Issue:** `readRecoveryJournal` reads all filenames in `.senti/recovery/finalize-cleanup` and filters them without an explicit bound. The fixture should normally contain one file, but the helper does not enforce bounded directory processing before loading the list. This touches the `bounded-resource-usage` guardrail.  
**Suggestion:** Use a bounded scan or assert a maximum directory size before filtering, e.g. fail if `fs.readdirSync(directory).length > 2`, then assert exactly one `.json` journal. This keeps the test helper consistent with the project guardrail.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 4. Remove Or Reclassify The Raw Scenario Validity Log
**Finding key:** loop-bebce9c6f36ccbc7e52e
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/.raw/scenario-validity.log
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/.raw/scenario-validity.log`  
**Requirement:** R7  
**Issue:** The committed `.raw/scenario-validity.log` records `invalid_test` for R1 through R7 and includes a large environment-specific invalid path list. As a checked-in artifact, it can make the change set look intentionally invalid or stale.  
**Suggestion:** Remove this file from the change set if it is transient output, or regenerate it only after the scenario-validity preflight passes. If raw failing evidence is required, rename or document it so it is clearly not consumed as passing test evidence.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/.raw/scenario-validity.log`  
**Requirement:** R7  
**Issue:** The committed `.raw/scenario-validity.log` records `invalid_test` for R1 through R7 and includes a large environment-specific invalid path list. As a checked-in artifact, it can make the change set look intentionally invalid or stale.  
**Suggestion:** Remove this file from the change set if it is transient output, or regenerate it only after the scenario-validity preflight passes. If raw failing evidence is required, rename or document it so it is clearly not consumed as passing test evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 5. Rename Fixture Helpers To Match Their Specific Domain
**Finding key:** loop-cf448fb07d19bb6c3d36
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R1  
**Issue:** Names like `setupFinalizeFixture`, `runFinalize`, and `captureBoundaryReality` are broad compared with what they actually do: they build a managed-worktree cleanup fixture, run finalize cleanup, and snapshot destructive-boundary state.  
**Suggestion:** Rename them to more precise names such as `setupManagedWorktreeCleanupFixture`, `runFinalizeCleanup`, and `captureDestructiveBoundarySnapshot`. This makes the large test file easier to scan and reduces ambiguity with finalize sync tests.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R1  
**Issue:** Names like `setupFinalizeFixture`, `runFinalize`, and `captureBoundaryReality` are broad compared with what they actually do: they build a managed-worktree cleanup fixture, run finalize cleanup, and snapshot destructive-boundary state.  
**Suggestion:** Rename them to more precise names such as `setupManagedWorktreeCleanupFixture`, `runFinalizeCleanup`, and `captureDestructiveBoundarySnapshot`. This makes the large test file easier to scan and reduces ambiguity with finalize sync tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 6. Replace Source-Regex Design Assertions With Behavior-Oriented Checks Where Possible
**Finding key:** loop-eb95a39f94bce3cfcc14
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js
**Requirement:** R6
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R6  
**Issue:** The R6 test asserts implementation details by reading source files and matching regexes such as `class FinalizeFlowStateOwner`, `new FlowManager`, and `hookCtx.flowManager.forRoot(...)`. These checks are brittle and can fail on harmless refactors while missing equivalent behavior implemented differently.  
**Suggestion:** Prefer behavioral assertions through instrumentation, like the existing `mutationRoots` checks. Keep only minimal source checks if the spec explicitly requires removal of direct writers, and wrap them in a helper with comments explaining why a source-level assertion is intentional.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R6  
**Issue:** The R6 test asserts implementation details by reading source files and matching regexes such as `class FinalizeFlowStateOwner`, `new FlowManager`, and `hookCtx.flowManager.forRoot(...)`. These checks are brittle and can fail on harmless refactors while missing equivalent behavior implemented differently.  
**Suggestion:** Prefer behavioral assertions through instrumentation, like the existing `mutationRoots` checks. Keep only minimal source checks if the spec explicitly requires removal of direct writers, and wrap them in a helper with comments explaining why a source-level assertion is intentional.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Remove dead import
**Finding key:** loop-48a45d94ae3763b6a9b5
**Failure mode:** refactor
**File:** src/flow/lib/finalize-cleanup-state.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `specIdFromPath` is still imported but no longer used after `ensureCleanupStep()` moved to `stateOwner.mutate()`.  
**Suggestion:** Delete `import { specIdFromPath } from "../../lib/flow-helpers.js";`.
**Suggestion:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `specIdFromPath` is still imported but no longer used after `ensureCleanupStep()` moved to `stateOwner.mutate()`.  
**Suggestion:** Delete `import { specIdFromPath } from "../../lib/flow-helpers.js";`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Centralize bounded flow-file hashing
**Finding key:** loop-993ea18dd493650b901b
**Failure mode:** refactor
**File:** src/flow/lib/finalize-cleanup-state.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `FinalizeWorktreeFlowSnapshot.capture()` and `authorizedDirtyRootFiles()` both read the entire `flow.json` with `fs.readFileSync()` and hash it. This duplicates logic and may violate `bounded-resource-usage` because the file read has no explicit size bound.  
**Suggestion:** Add a small helper like `hashFlowFileIfBounded(filePath)` that checks `fs.statSync(filePath).size` against an explicit max before reading, then reuse it in both methods.
**Suggestion:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `FinalizeWorktreeFlowSnapshot.capture()` and `authorizedDirtyRootFiles()` both read the entire `flow.json` with `fs.readFileSync()` and hash it. This duplicates logic and may violate `bounded-resource-usage` because the file read has no explicit size bound.  
**Suggestion:** Add a small helper like `hashFlowFileIfBounded(filePath)` that checks `fs.statSync(filePath).size` against an explicit max before reading, then reuse it in both methods.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Harden repository-relative path validation
**Finding key:** loop-fb077179645d0f6569fc
**Failure mode:** refactor
**File:** src/flow/lib/finalize-cleanup-state.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `FinalizeWorktreeFlowSnapshot` rejects paths starting with `../`, but not the exact string `".."`. A malformed `spec` could produce a relative path that escapes the worktree but passes this check.  
**Suggestion:** Change the validation to reject both `relativePath === ".."` and `relativePath.startsWith(\`..${path.sep}\`)`.
**Suggestion:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `FinalizeWorktreeFlowSnapshot` rejects paths starting with `../`, but not the exact string `".."`. A malformed `spec` could produce a relative path that escapes the worktree but passes this check.  
**Suggestion:** Change the validation to reject both `relativePath === ".."` and `relativePath.startsWith(\`..${path.sep}\`)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 4. Avoid JSON-stringifying entire step trees
**Finding key:** loop-9a13079c7c4d82adfad2
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` compares `mainState.steps` and `worktreeState.steps` using `JSON.stringify()`. This is brittle, potentially expensive for large step trees, and conflicts with the `bounded-resource-usage` guardrail because the comparison has no explicit bound.  
**Suggestion:** Replace it with a focused comparison of the fields needed to establish ownership, such as step ids/statuses for the relevant finalize lifecycle steps, or add an explicit bounded step-summary helper.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` compares `mainState.steps` and `worktreeState.steps` using `JSON.stringify()`. This is brittle, potentially expensive for large step trees, and conflicts with the `bounded-resource-usage` guardrail because the comparison has no explicit bound.  
**Suggestion:** Replace it with a focused comparison of the fields needed to establish ownership, such as step ids/statuses for the relevant finalize lifecycle steps, or add an explicit bounded step-summary helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 5. Rename ownership helper to match behavior
**Finding key:** loop-f0dd4800caca3936cba1
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` returns true either when `finalize-merge` is done or when the main/worktree step arrays serialize identically. The name implies a direct ownership check, but the implementation also treats synchronized state as ownership.  
**Suggestion:** Rename it to something more precise, such as `mainStateIsAuthoritativeForWorktreeFlow()` or `mainStateCanOwnWorktreeFlow()`.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` returns true either when `finalize-merge` is done or when the main/worktree step arrays serialize identically. The name implies a direct ownership check, but the implementation also treats synchronized state as ownership.  
**Suggestion:** Rename it to something more precise, such as `mainStateIsAuthoritativeForWorktreeFlow()` or `mainStateCanOwnWorktreeFlow()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 1. Bound journal directory scanning
**Finding key:** loop-367e631f38de9a35ee87
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** `#assertNoForeignTargetJournal()` scans every `.json` file in the teardown transaction directory with no explicit count or size bound, which violates the `bounded-resource-usage` guardrail for bulk loading.  
**Suggestion:** Add an explicit maximum journal-file count, fail closed when exceeded, and preferably skip non-transaction names via a stricter filename pattern before reading/parsing candidates.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** `#assertNoForeignTargetJournal()` scans every `.json` file in the teardown transaction directory with no explicit count or size bound, which violates the `bounded-resource-usage` guardrail for bulk loading.  
**Suggestion:** Add an explicit maximum journal-file count, fail closed when exceeded, and preferably skip non-transaction names via a stricter filename pattern before reading/parsing candidates.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Bound checkpoint JSON parsing
**Finding key:** loop-4e9fa1686b75f0500826
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** `FinalizeTeardownCheckpoint.fromResult()` parses checkpoint JSON embedded in `result.code` without a maximum payload length. A malformed or oversized journal value can force unbounded parsing work.  
**Suggestion:** Define a small constant such as `MAX_FINALIZE_CHECKPOINT_CODE_BYTES` and reject checkpoint codes exceeding it before `JSON.parse`.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** `FinalizeTeardownCheckpoint.fromResult()` parses checkpoint JSON embedded in `result.code` without a maximum payload length. A malformed or oversized journal value can force unbounded parsing work.  
**Suggestion:** Define a small constant such as `MAX_FINALIZE_CHECKPOINT_CODE_BYTES` and reject checkpoint codes exceeding it before `JSON.parse`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Extract repeated checkpoint boundary flow
**Finding key:** loop-12676d958bf20d948d98
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** The pattern `persistFinalizeTeardownCheckpoint(...)`, perform boundary action, on error `transaction.fail(...)` plus `store.write(...)`, then `persistFinalizeTeardownCompletion(...)` is repeated for pointer, active-flow, validation, completion, and commit phases.  
**Suggestion:** Introduce a focused helper for checkpointed phase execution that owns begin/fail/complete persistence, while allowing each call site to supply the destructive action and failure envelope code.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** The pattern `persistFinalizeTeardownCheckpoint(...)`, perform boundary action, on error `transaction.fail(...)` plus `store.write(...)`, then `persistFinalizeTeardownCompletion(...)` is repeated for pointer, active-flow, validation, completion, and commit phases.  
**Suggestion:** Introduce a focused helper for checkpointed phase execution that owns begin/fail/complete persistence, while allowing each call site to supply the destructive action and failure envelope code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Rename injectable dependencies for clarity
**Finding key:** loop-71d655208b4c14f64a9d
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-sync.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-finalize-sync.js`  
**Requirement:** R3  
**Issue:** Constructor fields like `git`, `commit`, and `hasCommit` are short enough to obscure that they are injected command helpers, while surrounding code uses more descriptive function names like `runGit`, `commitOrSkip`, and `hasOutboxCommit`.  
**Suggestion:** Rename the constructor options and instance fields to `runGitCommand`, `commitOrSkipCommand`, and `hasOutboxCommitMarker` or similar, preserving backwards compatibility only if tests or external callers instantiate this command directly.
**Suggestion:** **File:** `src/flow/lib/run-finalize-sync.js`  
**Requirement:** R3  
**Issue:** Constructor fields like `git`, `commit`, and `hasCommit` are short enough to obscure that they are injected command helpers, while surrounding code uses more descriptive function names like `runGit`, `commitOrSkip`, and `hasOutboxCommit`.  
**Suggestion:** Rename the constructor options and instance fields to `runGitCommand`, `commitOrSkipCommand`, and `hasOutboxCommitMarker` or similar, preserving backwards compatibility only if tests or external callers instantiate this command directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Avoid duplicate finalize state owner initialization paths
**Finding key:** loop-cb29a88226553b16b12a
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `switchToMainRepoFlowAuthority()` uses `FinalizeFlowStateOwner.forMainContext(ctx).bindContext(ctx)`, while `RegistryLifecycleAdapter.finalizeStateOwner()` uses `FinalizeFlowStateOwner.fromContext(this.ctx).bindContext(this.ctx)`. These two authority-selection paths are very similar but subtly different, which makes finalize write ownership harder to reason about.  
**Suggestion:** Consolidate ownership creation behind one helper or make `finalizeStateOwner()` delegate to the same main-context binding path used by `switchToMainRepoFlowAuthority()` when finalization requires durable main-repository state.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `switchToMainRepoFlowAuthority()` uses `FinalizeFlowStateOwner.forMainContext(ctx).bindContext(ctx)`, while `RegistryLifecycleAdapter.finalizeStateOwner()` uses `FinalizeFlowStateOwner.fromContext(this.ctx).bindContext(this.ctx)`. These two authority-selection paths are very similar but subtly different, which makes finalize write ownership harder to reason about.  
**Suggestion:** Consolidate ownership creation behind one helper or make `finalizeStateOwner()` delegate to the same main-context binding path used by `switchToMainRepoFlowAuthority()` when finalization requires durable main-repository state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Simplify `tryUpdateStepStatus` target handling
**Finding key:** loop-a2f64ddb6eeb1c849156
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `tryUpdateStepStatus()` now supports three target shapes: hook context, raw `FlowManager`, and `FinalizeFlowStateOwner`. The branching makes mutation ownership less obvious and requires special-case option forwarding for `FinalizeFlowStateOwner`.  
**Suggestion:** Normalize the target at the start into a small `{ flowManager, updateStepStatus, mutationOpts }` adapter object, then use one mutation call path. This would reduce conditional complexity and make the single-owner finalize mutation behavior clearer.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `tryUpdateStepStatus()` now supports three target shapes: hook context, raw `FlowManager`, and `FinalizeFlowStateOwner`. The branching makes mutation ownership less obvious and requires special-case option forwarding for `FinalizeFlowStateOwner`.  
**Suggestion:** Normalize the target at the start into a small `{ flowManager, updateStepStatus, mutationOpts }` adapter object, then use one mutation call path. This would reduce conditional complexity and make the single-owner finalize mutation behavior clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 1. Add the required spec header to the new test
**Finding key:** loop-4641e8ba5c2ab2e8a5cc
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The added `scopeTaskReviewTarget` test appears to cover spec-local review scoping, but it lacks the mandatory `// spec: R<N>` header required by R7.  
**Suggestion:** Add an explicit requirement marker immediately before or inside the test, for example `// spec: R7`, so the test is discoverable by the project’s spec-local coverage checks.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The added `scopeTaskReviewTarget` test appears to cover spec-local review scoping, but it lacks the mandatory `// spec: R<N>` header required by R7.  
**Suggestion:** Add an explicit requirement marker immediately before or inside the test, for example `// spec: R7`, so the test is discoverable by the project’s spec-local coverage checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 1. Reconcile Conflicting Review And Gate Outcomes
**Finding key:** loop-ac34b521632fa1ddf163
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-review.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`
**Requirement:** R7
**Issue:** `spec-review.json`, `spec-gate-source.json`, `review-history/spec-attempt-001.md`, and `review-history/spec-attempt-002.json` appear to describe overlapping spec review state, but they disagree or duplicate PASS/failure outcomes. This creates ambiguous review authority across files.
**Suggestion:** Pick one canonical structured review/gate artifact for the current outcome, make historical attempts clearly archival, and remove or regenerate stale PASS artifacts when the gate source reports a blocking failure.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`
**Requirement:** R7
**Issue:** `spec-review.json`, `spec-gate-source.json`, `review-history/spec-attempt-001.md`, and `review-history/spec-attempt-002.json` appear to describe overlapping spec review state, but they disagree or duplicate PASS/failure outcomes. This creates ambiguous review authority across files.
**Suggestion:** Pick one canonical structured review/gate artifact for the current outcome, make historical attempts clearly archival, and remove or regenerate stale PASS artifacts when the gate source reports a blocking failure.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 2. Consolidate Runtime Telemetry Into One Bounded Artifact Model
**Finding key:** loop-0e865351c75c75b9a042
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R1
**Issue:** `flow.json`, `issue-log.json`, `retry-recovery.json`, `scenario-validity-result.json`, and `.raw/scenario-validity.log` all carry runtime evidence, logs, counters, timestamps, retries, or raw outputs. The same pattern of unbounded or volatile telemetry appears across several artifacts.
**Suggestion:** Define a shared bounded telemetry convention: durable state stays in canonical JSON files, bulky runtime evidence moves to capped referenced artifacts, and each collection declares max entries, max bytes, or rollover behavior.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R1
**Issue:** `flow.json`, `issue-log.json`, `retry-recovery.json`, `scenario-validity-result.json`, and `.raw/scenario-validity.log` all carry runtime evidence, logs, counters, timestamps, retries, or raw outputs. The same pattern of unbounded or volatile telemetry appears across several artifacts.
**Suggestion:** Define a shared bounded telemetry convention: durable state stays in canonical JSON files, bulky runtime evidence moves to capped referenced artifacts, and each collection declares max entries, max bytes, or rollover behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 3. Remove Duplicate Task State Sources
**Finding key:** loop-83364d2b4bb18cbadd11
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R7
**Issue:** Task status and metadata are represented in both `spec.md` and `tasks/T-*.md`, while `spec.json` also tracks task statuses that conflict with requirement statuses. This makes task completion state drift-prone across Markdown, JSON, and per-task files.
**Suggestion:** Make `tasks/T-*.md` or `spec.json` the canonical task-state source, then reduce `spec.md` to a linked task index and ensure requirement/task statuses are updated from the same source.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R7
**Issue:** Task status and metadata are represented in both `spec.md` and `tasks/T-*.md`, while `spec.json` also tracks task statuses that conflict with requirement statuses. This makes task completion state drift-prone across Markdown, JSON, and per-task files.
**Suggestion:** Make `tasks/T-*.md` or `spec.json` the canonical task-state source, then reduce `spec.md` to a linked task index and ensure requirement/task statuses are updated from the same source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 4. Normalize Retry Policy Naming Across Spec Artifacts
**Finding key:** loop-c9049c959eb5f51270b1
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.json
**Requirement:** R2
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.json`
**Requirement:** R2
**Issue:** The retry rule is repeatedly phrased as “at most one retry per invocation” across `spec.json`, `spec.md`, and related task/review artifacts without a named policy. Repeated prose across files increases the chance of semantic drift.
**Suggestion:** Define a single named term, such as `single-retry replay policy`, in the normative requirement text, then reference that term consistently in `spec.md`, `spec.json`, tasks, and tests.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.json`
**Requirement:** R2
**Issue:** The retry rule is repeatedly phrased as “at most one retry per invocation” across `spec.json`, `spec.md`, and related task/review artifacts without a named policy. Repeated prose across files increases the chance of semantic drift.
**Suggestion:** Define a single named term, such as `single-retry replay policy`, in the normative requirement text, then reference that term consistently in `spec.md`, `spec.json`, tasks, and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 5. Align Finalize State Owner Construction Paths
**Finding key:** loop-5b37e7c0ee3126ab5d18
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`
**Requirement:** R6
**Issue:** Finalize flow ownership is initialized through different APIs across files: `FinalizeFlowStateOwner.forMainContext(ctx).bindContext(ctx)` in `registry.js`, `FinalizeFlowStateOwner.fromContext(...).bindContext(...)` elsewhere, and direct flow-manager paths in review/finalize helpers. These near-duplicate construction paths make ownership semantics harder to verify.
**Suggestion:** Introduce one canonical helper for obtaining the finalize state owner for durable main-repository mutations, and have registry, cleanup, review, and lifecycle code call that helper.
**Suggestion:** **File:** `src/flow/registry.js`
**Requirement:** R6
**Issue:** Finalize flow ownership is initialized through different APIs across files: `FinalizeFlowStateOwner.forMainContext(ctx).bindContext(ctx)` in `registry.js`, `FinalizeFlowStateOwner.fromContext(...).bindContext(...)` elsewhere, and direct flow-manager paths in review/finalize helpers. These near-duplicate construction paths make ownership semantics harder to verify.
**Suggestion:** Introduce one canonical helper for obtaining the finalize state owner for durable main-repository mutations, and have registry, cleanup, review, and lifecycle code call that helper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 6. Centralize Bounded JSON/File Reading Helpers
**Finding key:** loop-0eeb0f1878296645700e
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R1
**Issue:** Multiple files independently read or parse potentially large artifacts: journal directory scans in `run-finalize-cleanup.js`, full `flow.json` hashing in `finalize-cleanup-state.js`, `JSON.stringify()` step comparisons in `flow-context.js`, and recovery-journal reads in tests. The same bounded-resource concern is being solved piecemeal.
**Suggestion:** Add shared bounded helpers for directory scans, JSON parsing, file hashing, and compact flow-step comparison, then reuse them in production code and tests.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R1
**Issue:** Multiple files independently read or parse potentially large artifacts: journal directory scans in `run-finalize-cleanup.js`, full `flow.json` hashing in `finalize-cleanup-state.js`, `JSON.stringify()` step comparisons in `flow-context.js`, and recovery-journal reads in tests. The same bounded-resource concern is being solved piecemeal.
**Suggestion:** Add shared bounded helpers for directory scans, JSON parsing, file hashing, and compact flow-step comparison, then reuse them in production code and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 7. Make Requirement Trace Headers Consistent In Tests
**Finding key:** loop-28eb658e7fa5998502e1
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`
**Requirement:** R7
**Issue:** One test file uses a broad `// spec: R1 R2 R3 R4 R5 R6 R7` header, while `tests/unit/flow/commands/review.test.js` reportedly lacks a required `// spec: R7` marker. This creates inconsistent test-to-requirement traceability across spec-local and unit tests.
**Suggestion:** Require per-test or per-describe requirement markers, placing `// spec: R<N>` next to the specific coverage it provides, and update the coverage scanner expectations accordingly.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`
**Requirement:** R7
**Issue:** One test file uses a broad `// spec: R1 R2 R3 R4 R5 R6 R7` header, while `tests/unit/flow/commands/review.test.js` reportedly lacks a required `// spec: R7` marker. This creates inconsistent test-to-requirement traceability across spec-local and unit tests.
**Suggestion:** Require per-test or per-describe requirement markers, placing `// spec: R<N>` next to the specific coverage it provides, and update the coverage scanner expectations accordingly.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
