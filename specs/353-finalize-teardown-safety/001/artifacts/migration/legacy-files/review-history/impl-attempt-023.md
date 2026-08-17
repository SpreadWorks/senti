# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Remove Empty Placeholder Fields From Draft Review Result
**Finding key:** loop-5ecf78c4465af85043b4
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/draft-review-questions.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** The PASS result contains multiple empty arrays and null placeholders: `blockingFindings`, `advisoryFindings`, `repairTargets`, and `taskId`. These add schema noise without carrying useful information.  
**Suggestion:** Omit empty optional fields for PASS results, or use a minimal PASS schema containing only `version`, `phase`, `sourceDraft`, `generatedAt`, `verdict`, `summary`, and stable digests.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** The PASS result contains multiple empty arrays and null placeholders: `blockingFindings`, `advisoryFindings`, `repairTargets`, and `taskId`. These add schema noise without carrying useful information.  
**Suggestion:** Omit empty optional fields for PASS results, or use a minimal PASS schema containing only `version`, `phase`, `sourceDraft`, `generatedAt`, `verdict`, `summary`, and stable digests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 5. Consolidate Empty Draft Sections
**Finding key:** loop-9e55d6d29265e1f666c1
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/draft.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/draft.json`  
**Requirement:** R8  
**Issue:** Several draft sections are present but empty, including `requiresUserJudgment`, `notes`, and `droppedReason` values. This makes the draft harder to scan and mixes meaningful decisions with placeholders.  
**Suggestion:** Omit empty optional sections and empty-string fields, or represent them through a single explicit `none` summary only when the schema requires presence.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/draft.json`  
**Requirement:** R8  
**Issue:** Several draft sections are present but empty, including `requiresUserJudgment`, `notes`, and `droppedReason` values. This makes the draft harder to scan and mixes meaningful decisions with placeholders.  
**Suggestion:** Omit empty optional sections and empty-string fields, or represent them through a single explicit `none` summary only when the schema requires presence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Avoid Committing Volatile Runtime State
**Finding key:** loop-fbde474f0f08d705b37e
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** `flow.json` includes extensive transient execution data: `runtimeLog`, `metrics`, `reviewConvergence`, `stepAttempts`, retry recovery baselines, timestamps, provider invocation IDs, token counts, and intermediate review findings. This makes the artifact very large, noisy, and difficult to review or maintain.  
**Suggestion:** Keep the committed flow artifact to stable state only, and move volatile runtime/review history into ignored run logs or canonical evidence files referenced by digest/path.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** `flow.json` includes extensive transient execution data: `runtimeLog`, `metrics`, `reviewConvergence`, `stepAttempts`, retry recovery baselines, timestamps, provider invocation IDs, token counts, and intermediate review findings. This makes the artifact very large, noisy, and difficult to review or maintain.  
**Suggestion:** Keep the committed flow artifact to stable state only, and move volatile runtime/review history into ignored run logs or canonical evidence files referenced by digest/path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Bound Review And Recovery History Growth
**Finding key:** loop-f8a07d5b1f07fdc8054c
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R1  
**Issue:** `reviewConvergence.records`, `metrics`, `stepAttempts`, `reviewRecoveryBaselines`, and `retryRecovery.entries` grow as append-only arrays with no visible retention or count bound. This violates the bounded-resource-usage guardrail for bulk data loading/history retention.  
**Suggestion:** Add explicit retention limits for these arrays, such as max records per phase/task and max retained attempts per step, or replace historical payloads with bounded summaries plus references to external evidence files.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R1  
**Issue:** `reviewConvergence.records`, `metrics`, `stepAttempts`, `reviewRecoveryBaselines`, and `retryRecovery.entries` grow as append-only arrays with no visible retention or count bound. This violates the bounded-resource-usage guardrail for bulk data loading/history retention.  
**Suggestion:** Add explicit retention limits for these arrays, such as max records per phase/task and max retained attempts per step, or replace historical payloads with bounded summaries plus references to external evidence files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Deduplicate Repeated Target State Snapshots
**Finding key:** loop-5871ba9d79b97d177f77
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** Many `reviewConvergence.records[*].targetState.entries` repeat nearly identical file lists and hashes, producing large duplicated JSON payloads.  
**Suggestion:** Store each unique target-state snapshot once under a keyed `targetStates` map by digest, and have review records reference `targetStateDigest` only.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** Many `reviewConvergence.records[*].targetState.entries` repeat nearly identical file lists and hashes, producing large duplicated JSON payloads.  
**Suggestion:** Store each unique target-state snapshot once under a keyed `targetStates` map by digest, and have review records reference `targetStateDigest` only.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Avoid Duplicating Retry Recovery Entry Data Across Artifacts
**Finding key:** loop-3b90c0ad9449c5bffe72
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R8  
**Issue:** The retry recovery event in `issue-log.json` duplicates the same recovery data already stored in `specs/353-finalize-teardown-safety/retry-recovery.json`, including id, kind, phase, changed evidence, retry counts, command, and timestamp. This makes the artifacts harder to maintain and can drift if recovery metadata is amended.  
**Suggestion:** Store a compact issue-log entry that references the recovery id and summarizes the event, while keeping the detailed recovery payload in `retry-recovery.json` as the authoritative artifact.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R8  
**Issue:** The retry recovery event in `issue-log.json` duplicates the same recovery data already stored in `specs/353-finalize-teardown-safety/retry-recovery.json`, including id, kind, phase, changed evidence, retry counts, command, and timestamp. This makes the artifacts harder to maintain and can drift if recovery metadata is amended.  
**Suggestion:** Store a compact issue-log entry that references the recovery id and summarizes the event, while keeping the detailed recovery payload in `retry-recovery.json` as the authoritative artifact.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Normalize Duplicate Identifier Fields
**Finding key:** loop-ae52735ab4d72afc80f0
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R8  
**Issue:** The retry recovery log entry contains both `grantId` and `id` with the same value, and also repeats that value as `issueLogId`. These names appear to represent overlapping identities rather than distinct concepts.  
**Suggestion:** Use a single canonical identifier field for the recovery event, or make the roles explicit if all three are required, for example `recoveryId`, `grantId`, and `issueLogId` only when they can differ.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R8  
**Issue:** The retry recovery log entry contains both `grantId` and `id` with the same value, and also repeats that value as `issueLogId`. These names appear to represent overlapping identities rather than distinct concepts.  
**Suggestion:** Use a single canonical identifier field for the recovery event, or make the roles explicit if all three are required, for example `recoveryId`, `grantId`, and `issueLogId` only when they can differ.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 4. Consolidate Repeated Spec-Test Coverage Failures
**Finding key:** loop-d1b448669c3a9149e593
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The spec-test coverage failure appears repeatedly with nearly identical `reason`, `observations`, and `failedEvaluations` content across multiple entries. This inflates the log and makes the meaningful state transition harder to find.  
**Suggestion:** Collapse repeated identical gate failures into one issue entry with an attempt count, timestamps, or retry history array, then keep the distinct resolution entry separately.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The spec-test coverage failure appears repeatedly with nearly identical `reason`, `observations`, and `failedEvaluations` content across multiple entries. This inflates the log and makes the meaningful state transition harder to find.  
**Suggestion:** Collapse repeated identical gate failures into one issue entry with an attempt count, timestamps, or retry history array, then keep the distinct resolution entry separately.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Remove Redundant Issue Number Field
**Finding key:** loop-fb179a107006324293dc
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/plugin-artifacts/workflow/prepare.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R8  
**Issue:** The file stores the same issue number twice: top-level `issue: 473` and nested `result.issueNumber: 473`. This creates avoidable duplication and a risk of inconsistent metadata if one value changes later.  
**Suggestion:** Keep one canonical issue identifier. Prefer either top-level `issue` for workflow artifact identity or `result.issueNumber` if this mirrors the plugin response schema, but not both unless the duplication is required by a documented consumer.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R8  
**Issue:** The file stores the same issue number twice: top-level `issue: 473` and nested `result.issueNumber: 473`. This creates avoidable duplication and a risk of inconsistent metadata if one value changes later.  
**Suggestion:** Keep one canonical issue identifier. Prefer either top-level `issue` for workflow artifact identity or `result.issueNumber` if this mirrors the plugin response schema, but not both unless the duplication is required by a documented consumer.
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

### 32. 4. Simplify nested diff filtering
**Finding key:** loop-161b448e3ce32e38f0c7
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R7  
**Issue:** `scopeTaskReviewTarget()` nests `excludeGeneratedSpecArtifactsFromGateDiff()` inside `excludeGateLifecycleArtifactsFromGateDiff()`, which makes the filtering pipeline harder to scan and easier to extend inconsistently later.  
**Suggestion:** Split the filtering into named intermediate values, for example `withoutGeneratedSpecArtifacts` and `withoutLifecycleArtifacts`, or add a local helper like `excludeTaskReviewArtifacts(diff, specPath)`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R7  
**Issue:** `scopeTaskReviewTarget()` nests `excludeGeneratedSpecArtifactsFromGateDiff()` inside `excludeGateLifecycleArtifactsFromGateDiff()`, which makes the filtering pipeline harder to scan and easier to extend inconsistently later.  
**Suggestion:** Split the filtering into named intermediate values, for example `withoutGeneratedSpecArtifacts` and `withoutLifecycleArtifacts`, or add a local helper like `excludeTaskReviewArtifacts(diff, specPath)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Remove unused import
**Finding key:** loop-df9fecd2e6edea9a0199
**Failure mode:** refactor
**File:** src/flow/lib/finalize-cleanup-state.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `specIdFromPath` is still imported but no longer used after switching `ensureCleanupStep()` to `stateOwner.mutate()`.  
**Suggestion:** Remove `specIdFromPath` from the import list to avoid dead code.
**Suggestion:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `specIdFromPath` is still imported but no longer used after switching `ensureCleanupStep()` to `stateOwner.mutate()`.  
**Suggestion:** Remove `specIdFromPath` from the import list to avoid dead code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Rename ownership helper for accuracy
**Finding key:** loop-7c08258b0eb2f741956c
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` returns `true` both when `finalize-merge` is done and when main/worktree steps are identical. The name implies only post-merge ownership, which makes the identical-state branch harder to reason about.  
**Suggestion:** Rename it to something like `mainStateCanOwnFlow()` or `mainStateIsAuthoritativeForWorktree()`.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` returns `true` both when `finalize-merge` is done and when main/worktree steps are identical. The name implies only post-merge ownership, which makes the identical-state branch harder to reason about.  
**Suggestion:** Rename it to something like `mainStateCanOwnFlow()` or `mainStateIsAuthoritativeForWorktree()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 3. Avoid JSON string comparison for step ownership
**Finding key:** loop-4a81084d169c625e23bd
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `JSON.stringify(mainState?.steps || []) === JSON.stringify(worktreeState?.steps || [])` is a brittle structural comparison and can become expensive as step state grows. It also hides the intended ownership rule.  
**Suggestion:** Extract a small helper such as `stepsMatchForOwnership(mainSteps, worktreeSteps)` that compares the specific fields needed for authority, or document why full structural equality is required.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `JSON.stringify(mainState?.steps || []) === JSON.stringify(worktreeState?.steps || [])` is a brittle structural comparison and can become expensive as step state grows. It also hides the intended ownership rule.  
**Suggestion:** Extract a small helper such as `stepsMatchForOwnership(mainSteps, worktreeSteps)` that compares the specific fields needed for authority, or document why full structural equality is required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Bound journal scan before reading every JSON file
**Finding key:** loop-f9d3fff37e2e2d3c7371
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R2  
**Issue:** `#assertNoForeignTargetJournal()` synchronously scans every `*.json` file in the transaction directory and parses each candidate without an explicit upper bound. This violates the `bounded-resource-usage` guardrail for bulk loading.  
**Suggestion:** Add a maximum journal-entry scan limit, or better, maintain/read a bounded identity index keyed by spec/branch so the check does not depend on unbounded directory size.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R2  
**Issue:** `#assertNoForeignTargetJournal()` synchronously scans every `*.json` file in the transaction directory and parses each candidate without an explicit upper bound. This violates the `bounded-resource-usage` guardrail for bulk loading.  
**Suggestion:** Add a maximum journal-entry scan limit, or better, maintain/read a bounded identity index keyed by spec/branch so the check does not depend on unbounded directory size.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Centralize finalize flow state owner resolution
**Finding key:** loop-94697826ca6a1c0d6f69
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** The fallback expression `ctx.finalizeFlowStateOwner || FinalizeFlowStateOwner.forMainContext({ ...ctx, specId })` is repeated in `activeFlowIsCleared`, `clearActiveFlowBoundary`, and `runSpecOnlyCompletion`.  
**Suggestion:** Add a small helper such as `resolveFinalizeFlowStateOwner(ctx, specId)` and use it everywhere. This keeps the single-owner pattern easier to audit.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** The fallback expression `ctx.finalizeFlowStateOwner || FinalizeFlowStateOwner.forMainContext({ ...ctx, specId })` is repeated in `activeFlowIsCleared`, `clearActiveFlowBoundary`, and `runSpecOnlyCompletion`.  
**Suggestion:** Add a small helper such as `resolveFinalizeFlowStateOwner(ctx, specId)` and use it everywhere. This keeps the single-owner pattern easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 3. Extract repeated checkpoint boundary pattern
**Finding key:** loop-889594fa9deb1ee77fda
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** Several phases repeat the same pattern: persist checkpoint, perform a boundary operation, fail with a phase-specific code, then persist completion. The pointer and active-flow paths duplicate this especially closely across spec-only and full teardown completion.  
**Suggestion:** Introduce a helper for checkpointed phase execution, e.g. `runCheckpointedPhase(store, transaction, phase, operation, completionOptions)`, while preserving each phase’s failure envelope. This would reduce drift in retry/checkpoint behavior.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** Several phases repeat the same pattern: persist checkpoint, perform a boundary operation, fail with a phase-specific code, then persist completion. The pointer and active-flow paths duplicate this especially closely across spec-only and full teardown completion.  
**Suggestion:** Introduce a helper for checkpointed phase execution, e.g. `runCheckpointedPhase(store, transaction, phase, operation, completionOptions)`, while preserving each phase’s failure envelope. This would reduce drift in retry/checkpoint behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 4. Rename generic injected dependencies
**Finding key:** loop-18a20fa0b113b1840dd6
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-sync.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-finalize-sync.js`  
**Requirement:** R3  
**Issue:** Constructor fields like `git`, `commit`, and `hasCommit` are test seams but read generically at call sites, making it less obvious that they specifically operate on finalize-sync outbox commits and git commands.  
**Suggestion:** Rename them to more specific names such as `runGitCommand`, `commitOrSkipDocsSync`, and `hasOutboxCommitMarker` to make the injected behavior self-documenting.
**Suggestion:** **File:** `src/flow/lib/run-finalize-sync.js`  
**Requirement:** R3  
**Issue:** Constructor fields like `git`, `commit`, and `hasCommit` are test seams but read generically at call sites, making it less obvious that they specifically operate on finalize-sync outbox commits and git commands.  
**Suggestion:** Rename them to more specific names such as `runGitCommand`, `commitOrSkipDocsSync`, and `hasOutboxCommitMarker` to make the injected behavior self-documenting.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Simplify `tryUpdateStepStatus` Owner Handling
**Finding key:** loop-be0b518c4b30478377c2
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `tryUpdateStepStatus` now branches on three target shapes: hook context, `FinalizeFlowStateOwner`, and raw `FlowManager`. The `FinalizeFlowStateOwner` path partially bypasses `mutationOpts`, while the other paths pass options directly. This makes ownership behavior harder to reason about.  
**Suggestion:** Split finalize-owner mutation into a small helper, e.g. `updateStepStatusThroughOwner(stateOwner, transition, mutationOpts)`, or normalize the target at the top into `{ flowManager, updateStepStatus, mutationOpts }`. That would remove the nested `isFinalizeStateOwner` checks and make R6 ownership explicit.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `tryUpdateStepStatus` now branches on three target shapes: hook context, `FinalizeFlowStateOwner`, and raw `FlowManager`. The `FinalizeFlowStateOwner` path partially bypasses `mutationOpts`, while the other paths pass options directly. This makes ownership behavior harder to reason about.  
**Suggestion:** Split finalize-owner mutation into a small helper, e.g. `updateStepStatusThroughOwner(stateOwner, transition, mutationOpts)`, or normalize the target at the top into `{ flowManager, updateStepStatus, mutationOpts }`. That would remove the nested `isFinalizeStateOwner` checks and make R6 ownership explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Remove Redundant `specId` Option Passed To Finalize Owner
**Finding key:** loop-5343f7ebf6cba7e782b0
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `skipSteps` calls `tryUpdateStepStatus(stateOwner, ..., { specId: stateOwner.specId }, ...)`, but the finalize owner already encapsulates the spec identity and the `FinalizeFlowStateOwner` branch ignores `specId`.  
**Suggestion:** Pass `undefined` or only the options actually consumed by the owner path, such as `{ taskId, operationOwnerToken }` when needed. This avoids suggesting that callers can override the owner’s spec context.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `skipSteps` calls `tryUpdateStepStatus(stateOwner, ..., { specId: stateOwner.specId }, ...)`, but the finalize owner already encapsulates the spec identity and the `FinalizeFlowStateOwner` branch ignores `specId`.  
**Suggestion:** Pass `undefined` or only the options actually consumed by the owner path, such as `{ taskId, operationOwnerToken }` when needed. This avoids suggesting that callers can override the owner’s spec context.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Avoid Repeated Finalize Owner Resolution In Lifecycle Hooks
**Finding key:** loop-f4de0250fea4e091c067
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** Several methods call `this.finalizeStateOwner()` multiple times within the same lifecycle path, including `onHookHandler`, `skipSteps`, `outboxStore`, and merge outcome handling. The helper is idempotent, but repeated lookup obscures that one mutation owner is intended for the whole finalize lifecycle operation.  
**Suggestion:** Cache the owner in a local variable per method before related operations, as already done in `skipSteps`. Apply the same pattern in `onHookHandler` branches that call `resetSkippedDownstreamSteps`, `setMergeOutcome`, and metadata commits.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** Several methods call `this.finalizeStateOwner()` multiple times within the same lifecycle path, including `onHookHandler`, `skipSteps`, `outboxStore`, and merge outcome handling. The helper is idempotent, but repeated lookup obscures that one mutation owner is intended for the whole finalize lifecycle operation.  
**Suggestion:** Cache the owner in a local variable per method before related operations, as already done in `skipSteps`. Apply the same pattern in `onHookHandler` branches that call `resetSkippedDownstreamSteps`, `setMergeOutcome`, and metadata commits.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 4. Add An Explicit Bound For Bulk Step Resets
**Finding key:** loop-4d1d061913d412b8234d
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `resetSkippedDownstreamSteps` and `skipSteps` iterate over caller-provided step arrays without an explicit upper bound. This conflicts with the `bounded-resource-usage` guardrail for bulk processing unless the upstream source is already capped and documented here.  
**Suggestion:** Add a small validation helper that rejects or truncates excessive step lists with a named constant, e.g. `MAX_LIFECYCLE_STEP_MUTATIONS`, and use it before looping/filtering `args?.steps`.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `resetSkippedDownstreamSteps` and `skipSteps` iterate over caller-provided step arrays without an explicit upper bound. This conflicts with the `bounded-resource-usage` guardrail for bulk processing unless the upstream source is already capped and documented here.  
**Suggestion:** Add a small validation helper that rejects or truncates excessive step lists with a named constant, e.g. `MAX_LIFECYCLE_STEP_MUTATIONS`, and use it before looping/filtering `args?.steps`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 5. Keep Finalize Owner Construction Consistent
**Finding key:** loop-97b1752ec06dcaf80a2c
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R6
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R6  
**Issue:** `persistFinalizeCleanupPostReturnMetadata` manually creates a `FinalizeFlowStateOwner` fallback but only passes `stateOwner.flowManager` to `recordFinalizeCleanupPostCommandMetadata`. This weakens the “one mutation owner” design because the callee still receives a raw manager.  
**Suggestion:** Prefer passing the owner itself if the recorder can accept it, or add a narrowly named helper on `FinalizeFlowStateOwner` for recording cleanup metadata. If the callee must remain unchanged, add a short comment explaining why only `flowManager` is passed here.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R6  
**Issue:** `persistFinalizeCleanupPostReturnMetadata` manually creates a `FinalizeFlowStateOwner` fallback but only passes `stateOwner.flowManager` to `recordFinalizeCleanupPostCommandMetadata`. This weakens the “one mutation owner” design because the callee still receives a raw manager.  
**Suggestion:** Prefer passing the owner itself if the recorder can accept it, or add a narrowly named helper on `FinalizeFlowStateOwner` for recording cleanup metadata. If the callee must remain unchanged, add a short comment explaining why only `flowManager` is passed here.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 6. Add Spec Header To New Requirement Test
**Finding key:** loop-280db2caea8a152fcc7e
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The new `scopeTaskReviewTarget` test appears related to spec-local review scoping, but it lacks a `// spec: R<N>` header. R7 explicitly requires spec-local tests to cover requirements with `// spec: R<N>` headers.  
**Suggestion:** Add the relevant requirement marker immediately above the test or describe block, for example `// spec: R7`, so the coverage remains discoverable by requirement tooling.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The new `scopeTaskReviewTarget` test appears related to spec-local review scoping, but it lacks a `// spec: R<N>` header. R7 explicitly requires spec-local tests to cover requirements with `// spec: R<N>` headers.  
**Suggestion:** Add the relevant requirement marker immediately above the test or describe block, for example `// spec: R7`, so the coverage remains discoverable by requirement tooling.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 1. Normalize Finalize Flow Owner Interfaces
**Finding key:** loop-589e0ee1bdf46597e9e9
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`
**Requirement:** R6
**Issue:** Multiple files introduce slightly different ways to handle finalize flow ownership: `registry.js` accepts hook contexts, `FinalizeFlowStateOwner`, and raw `FlowManager`; `run-finalize-cleanup.js` repeatedly resolves `ctx.finalizeFlowStateOwner || FinalizeFlowStateOwner.forMainContext(...)`; `dispatcher.js` constructs an owner but passes only its raw `flowManager` onward. These inconsistent interfaces weaken the single-owner model and make mutation authority harder to audit across files.
**Suggestion:** Define one canonical owner-resolution helper or interface for finalize flow mutations, then have `registry.js`, `run-finalize-cleanup.js`, and `dispatcher.js` pass and consume that owner consistently instead of mixing owner and raw manager paths.
**Suggestion:** **File:** `src/flow/registry.js`
**Requirement:** R6
**Issue:** Multiple files introduce slightly different ways to handle finalize flow ownership: `registry.js` accepts hook contexts, `FinalizeFlowStateOwner`, and raw `FlowManager`; `run-finalize-cleanup.js` repeatedly resolves `ctx.finalizeFlowStateOwner || FinalizeFlowStateOwner.forMainContext(...)`; `dispatcher.js` constructs an owner but passes only its raw `flowManager` onward. These inconsistent interfaces weaken the single-owner model and make mutation authority harder to audit across files.
**Suggestion:** Define one canonical owner-resolution helper or interface for finalize flow mutations, then have `registry.js`, `run-finalize-cleanup.js`, and `dispatcher.js` pass and consume that owner consistently instead of mixing owner and raw manager paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 2. Consolidate Duplicate Review And Gate Artifacts
**Finding key:** loop-0bbba0d4c0d54e528ffa
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-review.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`
**Requirement:** R7
**Issue:** Several review artifacts appear to describe overlapping spec-phase outcomes but disagree or duplicate each other: `spec-review.json` reports PASS, `spec-gate-source.json` reports a blocking coverage failure, `review-history/spec-attempt-001.md` duplicates a PASS/no-findings result also present in structured JSON, and `issue-log.json` repeats similar gate failures. This creates cross-file ambiguity about the authoritative review state.
**Suggestion:** Pick one canonical structured artifact for the current review/gate result, keep historical attempts only when they add distinct signal, and make other files reference the canonical artifact by id/path instead of duplicating full findings or contradictory verdicts.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`
**Requirement:** R7
**Issue:** Several review artifacts appear to describe overlapping spec-phase outcomes but disagree or duplicate each other: `spec-review.json` reports PASS, `spec-gate-source.json` reports a blocking coverage failure, `review-history/spec-attempt-001.md` duplicates a PASS/no-findings result also present in structured JSON, and `issue-log.json` repeats similar gate failures. This creates cross-file ambiguity about the authoritative review state.
**Suggestion:** Pick one canonical structured artifact for the current review/gate result, keep historical attempts only when they add distinct signal, and make other files reference the canonical artifact by id/path instead of duplicating full findings or contradictory verdicts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 3. Deduplicate Retry Recovery Data Across Logs
**Finding key:** loop-d38f13e57d36159918d1
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`
**Requirement:** R8
**Issue:** Retry recovery details are duplicated between `issue-log.json`, `retry-recovery.json`, and the large runtime data embedded in `flow.json`. The same ids, retry counts, commands, timestamps, and changed evidence can drift across these artifacts.
**Suggestion:** Make `retry-recovery.json` the authoritative detailed recovery record. Store only compact references and summaries in `issue-log.json` and `flow.json`, such as `recoveryId`, status, and evidence digest/path.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`
**Requirement:** R8
**Issue:** Retry recovery details are duplicated between `issue-log.json`, `retry-recovery.json`, and the large runtime data embedded in `flow.json`. The same ids, retry counts, commands, timestamps, and changed evidence can drift across these artifacts.
**Suggestion:** Make `retry-recovery.json` the authoritative detailed recovery record. Store only compact references and summaries in `issue-log.json` and `flow.json`, such as `recoveryId`, status, and evidence digest/path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 4. Align Requirement, Task, And Test Traceability
**Finding key:** loop-07584fe52d6b7d4b5bc9
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.json`
**Requirement:** R7
**Issue:** Requirement/task/test traceability is inconsistent across files: `spec.json` marks requirements R1-R7 done while tasks T-1 through T-6 remain pending, `spec.md` duplicates task metadata from `tasks/T-*.md`, `tests/finalize-teardown-contract.test.js` uses one broad `// spec: R1 R2 R3 R4 R5 R6 R7` marker, and `tests/unit/flow/commands/review.test.js` lacks a requirement marker for a new requirement-related test.
**Suggestion:** Use one task source of truth in `tasks/T-*.md`, keep `spec.md` as a compact index, align `spec.json` task statuses with requirement statuses, and place requirement-specific `// spec: R<N>` headers near the relevant tests.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.json`
**Requirement:** R7
**Issue:** Requirement/task/test traceability is inconsistent across files: `spec.json` marks requirements R1-R7 done while tasks T-1 through T-6 remain pending, `spec.md` duplicates task metadata from `tasks/T-*.md`, `tests/finalize-teardown-contract.test.js` uses one broad `// spec: R1 R2 R3 R4 R5 R6 R7` marker, and `tests/unit/flow/commands/review.test.js` lacks a requirement marker for a new requirement-related test.
**Suggestion:** Use one task source of truth in `tasks/T-*.md`, keep `spec.md` as a compact index, align `spec.json` task statuses with requirement statuses, and place requirement-specific `// spec: R<N>` headers near the relevant tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 5. Unify Bounded Resource Guardrails
**Finding key:** loop-b49f3a332dfb1016e3d7
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R1
**Issue:** Bounded-resource concerns appear in multiple places with no shared limit or naming convention: journal scanning in `run-finalize-cleanup.js`, recovery journal reading in `finalize-teardown-contract.test.js`, lifecycle step loops in `registry.js`, and append-only history arrays in `flow.json`. The same guardrail is being handled ad hoc across runtime code, tests, and artifacts.
**Suggestion:** Introduce named limits for finalize journal scans, lifecycle step mutations, and retained review/recovery history. Reuse those names in tests and artifact-shaping logic so R1/R2 bounded-resource behavior is consistent across files.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R1
**Issue:** Bounded-resource concerns appear in multiple places with no shared limit or naming convention: journal scanning in `run-finalize-cleanup.js`, recovery journal reading in `finalize-teardown-contract.test.js`, lifecycle step loops in `registry.js`, and append-only history arrays in `flow.json`. The same guardrail is being handled ad hoc across runtime code, tests, and artifacts.
**Suggestion:** Introduce named limits for finalize journal scans, lifecycle step mutations, and retained review/recovery history. Reuse those names in tests and artifact-shaping logic so R1/R2 bounded-resource behavior is consistent across files.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 6. Standardize Retry Policy Naming
**Finding key:** loop-011802407136410f3964
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R2
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R2
**Issue:** The retry policy is repeatedly described as “at most one retry per invocation” across `spec.md`, `spec.json`, task text, and review artifacts, while related implementation/test helpers use broader or different names like `assertRetryRejected`, `runFinalize`, and foreign/missing target checks. This increases the chance of semantic drift between specification and code.
**Suggestion:** Define a single term such as `single-retry replay policy` in the spec, then use that term consistently in `spec.md`, `spec.json`, task files, test helper names, and review artifacts.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R2
**Issue:** The retry policy is repeatedly described as “at most one retry per invocation” across `spec.md`, `spec.json`, task text, and review artifacts, while related implementation/test helpers use broader or different names like `assertRetryRejected`, `runFinalize`, and foreign/missing target checks. This increases the chance of semantic drift between specification and code.
**Suggestion:** Define a single term such as `single-retry replay policy` in the spec, then use that term consistently in `spec.md`, `spec.json`, task files, test helper names, and review artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 7. Remove Cross-Artifact Placeholder Noise
**Finding key:** loop-0f243c09310239985a69
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R8
**Issue:** Empty or placeholder fields appear across several artifacts: placeholder sections in `spec.md`, empty optional fields in `draft-review-questions.json`, empty draft sections in `draft.json`, and duplicated issue identifiers in workflow/issue artifacts. Across files, this makes it harder to distinguish meaningful missing information from schema filler.
**Suggestion:** Adopt a minimal artifact convention: omit empty optional fields and sections, keep only canonical identifiers, and require placeholders only when a documented consumer needs them.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R8
**Issue:** Empty or placeholder fields appear across several artifacts: placeholder sections in `spec.md`, empty optional fields in `draft-review-questions.json`, empty draft sections in `draft.json`, and duplicated issue identifiers in workflow/issue artifacts. Across files, this makes it harder to distinguish meaningful missing information from schema filler.
**Suggestion:** Adopt a minimal artifact convention: omit empty optional fields and sections, keep only canonical identifiers, and require placeholders only when a documented consumer needs them.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
