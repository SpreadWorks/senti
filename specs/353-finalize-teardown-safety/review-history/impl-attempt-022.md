# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Remove Redundant Empty Result Fields
**Finding key:** loop-0ccdc9023a3c0a92a9f0
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/draft-review-questions.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`
**Requirement:** R8
**Issue:** The PASS artifact stores several empty arrays and null fields (`blockingFindings`, `advisoryFindings`, `repairTargets`, `taskId`) that add boilerplate without conveying meaningful data.
**Suggestion:** Omit empty optional fields from PASS artifacts, or use a shared compact PASS schema that only records `verdict`, `summary`, provenance, and digests.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`
**Requirement:** R8
**Issue:** The PASS artifact stores several empty arrays and null fields (`blockingFindings`, `advisoryFindings`, `repairTargets`, `taskId`) that add boilerplate without conveying meaningful data.
**Suggestion:** Omit empty optional fields from PASS artifacts, or use a shared compact PASS schema that only records `verdict`, `summary`, provenance, and digests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 5. Simplify Empty Placeholder Sections
**Finding key:** loop-78285bb1901fdd78a363
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/draft.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/draft.json`
**Requirement:** R8
**Issue:** Sections such as `requiresUserJudgment`, `openQuestions`, and empty `droppedReason` fields are present even when they contain no actionable information, making the draft harder to scan.
**Suggestion:** Omit empty placeholder arrays/strings from generated drafts, or normalize them into a single optional `unresolved` section only when content exists.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/draft.json`
**Requirement:** R8
**Issue:** Sections such as `requiresUserJudgment`, `openQuestions`, and empty `droppedReason` fields are present even when they contain no actionable information, making the draft harder to scan.
**Suggestion:** Omit empty placeholder arrays/strings from generated drafts, or normalize them into a single optional `unresolved` section only when content exists.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 1. Bound Review History Growth
**Finding key:** loop-f39ee7a206465cc6e627
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R1
**Issue:** `reviewConvergence.records`, `metrics`, `stepAttempts`, and recovery history are persisted inline and appear to grow with every retry/review attempt. This violates the bounded-resource-usage guardrail because repeated review/gate retries can keep expanding `flow.json` without an explicit retention cap.
**Suggestion:** Add an explicit retention policy to this artifact format, such as keeping only the latest N records per phase/task and moving older detailed evidence to canonical external artifacts already referenced by digest.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R1
**Issue:** `reviewConvergence.records`, `metrics`, `stepAttempts`, and recovery history are persisted inline and appear to grow with every retry/review attempt. This violates the bounded-resource-usage guardrail because repeated review/gate retries can keep expanding `flow.json` without an explicit retention cap.
**Suggestion:** Add an explicit retention policy to this artifact format, such as keeping only the latest N records per phase/task and moving older detailed evidence to canonical external artifacts already referenced by digest.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 2. Deduplicate Repeated Target State Snapshots
**Finding key:** loop-1c16ac39c391959db64f
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R6
**Issue:** Large `targetState.entries` arrays are repeated across many review convergence records, duplicating mostly identical path/hash snapshots and making the state file difficult to review and maintain.
**Suggestion:** Store each distinct target-state snapshot once by digest, then let individual records reference `targetStateDigest` only unless an inline expansion is strictly needed.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R6
**Issue:** Large `targetState.entries` arrays are repeated across many review convergence records, duplicating mostly identical path/hash snapshots and making the state file difficult to review and maintain.
**Suggestion:** Store each distinct target-state snapshot once by digest, then let individual records reference `targetStateDigest` only unless an inline expansion is strictly needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 3. Remove Volatile Runtime State From Committed Flow Artifact
**Finding key:** loop-c0014914986c050050aa
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R6
**Issue:** The file includes volatile execution details such as timestamps, token counts, runtime logs, attempt histories, and agent invocation metadata. These are noisy, frequently changing, and obscure the meaningful persistent flow state.
**Suggestion:** Split runtime telemetry into separate generated/log artifacts and keep `flow.json` focused on durable state needed for replay, ownership, and recovery.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`
**Requirement:** R6
**Issue:** The file includes volatile execution details such as timestamps, token counts, runtime logs, attempt histories, and agent invocation metadata. These are noisy, frequently changing, and obscure the meaningful persistent flow state.
**Suggestion:** Split runtime telemetry into separate generated/log artifacts and keep `flow.json` focused on durable state needed for replay, ownership, and recovery.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 1. Deduplicate Recovery Event Storage
**Finding key:** loop-ccd938f9d8c063fa108b
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The retry recovery event is stored in both `issue-log.json` and `retry-recovery.json` with overlapping fields such as `id`, `kind`, `phase`, `reason`, `changedEvidence`, counters, command, and timestamp. This creates two sources of truth for the same recovery fact.  
**Suggestion:** Keep the full recovery payload in `retry-recovery.json` and store only a compact reference in `issue-log.json`, such as `issueLogId`, `step`, `reason`, and `retryRecoveryRef`.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The retry recovery event is stored in both `issue-log.json` and `retry-recovery.json` with overlapping fields such as `id`, `kind`, `phase`, `reason`, `changedEvidence`, counters, command, and timestamp. This creates two sources of truth for the same recovery fact.  
**Suggestion:** Keep the full recovery payload in `retry-recovery.json` and store only a compact reference in `issue-log.json`, such as `issueLogId`, `step`, `reason`, and `retryRecoveryRef`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 2. Add an Explicit Retention Bound for the Issue Log
**Finding key:** loop-cdb00a401fda8dc7ad2a
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The new `entries` array is already very large and has no visible retention, truncation, or maximum-entry policy. That conflicts with the bounded-resource-usage guardrail for bulk data accumulation.  
**Suggestion:** Add metadata such as `maxEntries`, `truncated`, or `retentionPolicy`, or split historical entries into bounded review-history artifacts while keeping only recent/current blocking entries here.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The new `entries` array is already very large and has no visible retention, truncation, or maximum-entry policy. That conflicts with the bounded-resource-usage guardrail for bulk data accumulation.  
**Suggestion:** Add metadata such as `maxEntries`, `truncated`, or `retentionPolicy`, or split historical entries into bounded review-history artifacts while keeping only recent/current blocking entries here.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 3. Remove Duplicate Issue Number Fields
**Finding key:** loop-48598313b078801812fb
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/plugin-artifacts/workflow/prepare.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R8  
**Issue:** The same identifier appears as both top-level `issue: 473` and nested `result.issueNumber: 473`. This duplication can drift and makes the artifact schema noisier than needed.  
**Suggestion:** Keep one canonical field. Prefer either top-level `issue` for workflow context or nested `result.issueNumber` for plugin result parity, but not both unless the schema requires both.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R8  
**Issue:** The same identifier appears as both top-level `issue: 473` and nested `result.issueNumber: 473`. This duplication can drift and makes the artifact schema noisier than needed.  
**Suggestion:** Keep one canonical field. Prefer either top-level `issue` for workflow context or nested `result.issueNumber` for plugin result parity, but not both unless the schema requires both.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 4. Normalize Retry Recovery Timestamps
**Finding key:** loop-f515c9cc258d51950065
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/retry-recovery.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/retry-recovery.json`  
**Requirement:** R7  
**Issue:** `retry-recovery.json` records `createdAt`, while the mirrored issue-log event records both `createdAt` and `timestamp`. The naming is inconsistent for the same event type and makes consumers choose between equivalent time fields.  
**Suggestion:** Use one timestamp field consistently, or document distinct meanings. If there is no semantic difference, standardize on `timestamp` across recovery and issue-log artifacts.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/retry-recovery.json`  
**Requirement:** R7  
**Issue:** `retry-recovery.json` records `createdAt`, while the mirrored issue-log event records both `createdAt` and `timestamp`. The naming is inconsistent for the same event type and makes consumers choose between equivalent time fields.  
**Suggestion:** Use one timestamp field consistently, or document distinct meanings. If there is no semantic difference, standardize on `timestamp` across recovery and issue-log artifacts.
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

### 32. 3. Consolidate task review target scoping with touched file calculation
**Finding key:** loop-1800426f04df5d9b5bc3
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R7  
**Issue:** Task review scoping now computes included files in `scopeTaskReviewTarget()` via `collectDiffFilePaths(diff)`, then `runReview()` recomputes the same set with `collectDiffFilePaths(diff)` for `touchedFiles`.  
**Suggestion:** Have `scopeTaskReviewTarget()` return `touchedFiles` or `includedFiles` alongside `diff` and `untrackedFiles`, then reuse that set in `runReview()` to avoid duplicate parsing and keep task-scope behavior in one place.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R7  
**Issue:** Task review scoping now computes included files in `scopeTaskReviewTarget()` via `collectDiffFilePaths(diff)`, then `runReview()` recomputes the same set with `collectDiffFilePaths(diff)` for `touchedFiles`.  
**Suggestion:** Have `scopeTaskReviewTarget()` return `touchedFiles` or `includedFiles` alongside `diff` and `untrackedFiles`, then reuse that set in `runReview()` to avoid duplicate parsing and keep task-scope behavior in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Avoid unbounded full-state serialization for ownership checks
**Finding key:** loop-ec88ce4e1500b9ce4c9b
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` compares `mainState.steps` and `worktreeState.steps` using `JSON.stringify()`. This bulk-serializes the entire step tree with no explicit size bound, which conflicts with the bounded-resource-usage guardrail and is also brittle because object key ordering can affect equality.  
**Suggestion:** Replace the full serialization comparison with a bounded, structural predicate that checks only the fields needed to decide post-merge ownership, such as known step ids/statuses or a capped traversal with an explicit maximum step count/depth.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` compares `mainState.steps` and `worktreeState.steps` using `JSON.stringify()`. This bulk-serializes the entire step tree with no explicit size bound, which conflicts with the bounded-resource-usage guardrail and is also brittle because object key ordering can affect equality.  
**Suggestion:** Replace the full serialization comparison with a bounded, structural predicate that checks only the fields needed to decide post-merge ownership, such as known step ids/statuses or a capped traversal with an explicit maximum step count/depth.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Rename ownership helper to reflect fallback behavior
**Finding key:** loop-2523f819def4307a54e9
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` returns true both when `finalize-merge` is done and when the main/worktree step arrays stringify identically. The name suggests only post-merge ownership, but the equality branch also covers synchronized pre/post states.  
**Suggestion:** Rename it to something like `mainStateCanOwnWorktreeFlow()` or `shouldUseMainFlowState()` so callers understand it is a broader authority-selection predicate.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** `mainStateOwnsPostMergeFlow()` returns true both when `finalize-merge` is done and when the main/worktree step arrays stringify identically. The name suggests only post-merge ownership, but the equality branch also covers synchronized pre/post states.  
**Suggestion:** Rename it to something like `mainStateCanOwnWorktreeFlow()` or `shouldUseMainFlowState()` so callers understand it is a broader authority-selection predicate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Bound journal scan before reading every JSON file
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

### 36. 2. Centralize finalize flow state owner resolution
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

### 37. 3. Extract repeated checkpoint boundary pattern
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

### 38. 4. Rename generic injected dependencies
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

### 39. 1. Simplify `tryUpdateStepStatus` Owner Handling
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

### 40. 2. Remove Redundant `specId` Option Passed To Finalize Owner
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

### 41. 3. Avoid Repeated Finalize Owner Resolution In Lifecycle Hooks
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

### 42. 4. Add An Explicit Bound For Bulk Step Resets
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

### 43. 5. Keep Finalize Owner Construction Consistent
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

### 44. 6. Add Spec Header To New Requirement Test
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

### 45. 1. Normalize Recovery Event Ownership
**Finding key:** loop-328b5b4e3f0fe3b088be
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`
**Requirement:** R7
**Issue:** Recovery events are duplicated across `issue-log.json`, `retry-recovery.json`, and inline `flow.json` review/recovery history. These artifacts appear to describe overlapping retry/recovery facts with different payload shapes and timestamp fields.
**Suggestion:** Make `retry-recovery.json` the canonical recovery-event artifact, and have `issue-log.json` and `flow.json` store compact references by recovery id/digest plus only local status metadata.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`
**Requirement:** R7
**Issue:** Recovery events are duplicated across `issue-log.json`, `retry-recovery.json`, and inline `flow.json` review/recovery history. These artifacts appear to describe overlapping retry/recovery facts with different payload shapes and timestamp fields.
**Suggestion:** Make `retry-recovery.json` the canonical recovery-event artifact, and have `issue-log.json` and `flow.json` store compact references by recovery id/digest plus only local status metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 2. Standardize Timestamp Naming
**Finding key:** loop-acceae4d8a0294127dbc
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/retry-recovery.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/retry-recovery.json`
**Requirement:** R7
**Issue:** Recovery artifacts use both `createdAt` and `timestamp` for what appears to be the same event time, while related issue-log entries mirror the same event with different timestamp naming.
**Suggestion:** Pick one canonical field name, preferably `timestamp` if that is already used by event logs, and apply it consistently across recovery, issue-log, and flow-history artifacts.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/retry-recovery.json`
**Requirement:** R7
**Issue:** Recovery artifacts use both `createdAt` and `timestamp` for what appears to be the same event time, while related issue-log entries mirror the same event with different timestamp naming.
**Suggestion:** Pick one canonical field name, preferably `timestamp` if that is already used by event logs, and apply it consistently across recovery, issue-log, and flow-history artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 3. Consolidate Review Result Artifacts
**Finding key:** loop-082b72ad2b01d60b7ac9
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md`
**Requirement:** R7
**Issue:** Review outcomes are represented in multiple places and formats: Markdown review history, JSON attempt artifacts, `spec-review.json`, `spec-gate-source.json`, and inline `flow.json` review convergence records. Some of these also disagree about pass/fail state.
**Suggestion:** Define one canonical structured review-result artifact per attempt, then let Markdown summaries, gate sources, and flow records reference that artifact instead of duplicating verdicts and findings.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md`
**Requirement:** R7
**Issue:** Review outcomes are represented in multiple places and formats: Markdown review history, JSON attempt artifacts, `spec-review.json`, `spec-gate-source.json`, and inline `flow.json` review convergence records. Some of these also disagree about pass/fail state.
**Suggestion:** Define one canonical structured review-result artifact per attempt, then let Markdown summaries, gate sources, and flow records reference that artifact instead of duplicating verdicts and findings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 4. Align Spec And Task Status Sources
**Finding key:** loop-46ce18763db9572967ac
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.json`
**Requirement:** R1
**Issue:** Requirement statuses in `spec.json` are marked done while task statuses remain pending, and task metadata is also duplicated in `spec.md` and `tasks/T-*.md`. This creates multiple sources of truth for completion state.
**Suggestion:** Make task files the canonical source for task status and implementation detail, keep `spec.md` as a compact index, and ensure `spec.json` derives or mirrors task status consistently.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.json`
**Requirement:** R1
**Issue:** Requirement statuses in `spec.json` are marked done while task statuses remain pending, and task metadata is also duplicated in `spec.md` and `tasks/T-*.md`. This creates multiple sources of truth for completion state.
**Suggestion:** Make task files the canonical source for task status and implementation detail, keep `spec.md` as a compact index, and ensure `spec.json` derives or mirrors task status consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 5. Use One Retry Policy Name Across Spec Files
**Finding key:** loop-ae7ca6f159d48aba03d8
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R2
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R2
**Issue:** The retry policy is repeated as prose across `spec.md`, `spec.json`, and related review artifacts, with phrases like “at most one retry per invocation” appearing in many sections without a stable concept name.
**Suggestion:** Define a single named policy, such as `single-retry replay policy`, in the canonical requirement text and use that exact name across spec, tasks, tests, and review artifacts.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R2
**Issue:** The retry policy is repeated as prose across `spec.md`, `spec.json`, and related review artifacts, with phrases like “at most one retry per invocation” appearing in many sections without a stable concept name.
**Suggestion:** Define a single named policy, such as `single-retry replay policy`, in the canonical requirement text and use that exact name across spec, tasks, tests, and review artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 6. Centralize Finalize State Owner Resolution
**Finding key:** loop-2165423d2ebdeb484372
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R6
**Issue:** Finalize owner resolution is repeated across `run-finalize-cleanup.js`, `registry.js`, `flow-context.js`, and `dispatcher.js`, with some call sites passing a `FinalizeFlowStateOwner` while others pass or unwrap a raw `FlowManager`.
**Suggestion:** Introduce one shared resolver/helper for finalize state ownership and pass the owner object through mutation paths consistently, unwrapping to `flowManager` only at clearly documented boundaries.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R6
**Issue:** Finalize owner resolution is repeated across `run-finalize-cleanup.js`, `registry.js`, `flow-context.js`, and `dispatcher.js`, with some call sites passing a `FinalizeFlowStateOwner` while others pass or unwrap a raw `FlowManager`.
**Suggestion:** Introduce one shared resolver/helper for finalize state ownership and pass the owner object through mutation paths consistently, unwrapping to `flowManager` only at clearly documented boundaries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 7. Normalize Finalize Helper Names
**Finding key:** loop-51621630ff52071b2bf6
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R6
**Issue:** Related helpers use inconsistent levels of specificity across files: broad names like `runFinalize`, `setupFinalizeFixture`, `mainStateOwnsPostMergeFlow`, and generic injected dependencies like `git` or `commit` obscure whether they refer to cleanup, sync, ownership fallback, or outbox behavior.
**Suggestion:** Rename helpers with domain-specific prefixes, such as `runFinalizeCleanup`, `setupManagedWorktreeCleanupFixture`, `shouldUseMainFlowState`, and `commitOrSkipDocsSync`, so finalize cleanup, finalize sync, and ownership paths stay distinct.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R6
**Issue:** Related helpers use inconsistent levels of specificity across files: broad names like `runFinalize`, `setupFinalizeFixture`, `mainStateOwnsPostMergeFlow`, and generic injected dependencies like `git` or `commit` obscure whether they refer to cleanup, sync, ownership fallback, or outbox behavior.
**Suggestion:** Rename helpers with domain-specific prefixes, such as `runFinalizeCleanup`, `setupManagedWorktreeCleanupFixture`, `shouldUseMainFlowState`, and `commitOrSkipDocsSync`, so finalize cleanup, finalize sync, and ownership paths stay distinct.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 8. Apply A Shared Bound For Bulk Artifact Processing
**Finding key:** loop-03cfff3eab1a8a5c422a
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R1
**Issue:** Several files introduce unbounded or weakly bounded bulk operations: journal scanning in finalize cleanup, full-state `JSON.stringify` comparisons in flow context, step-array mutations in registry, review-history accumulation in `flow.json`, and large issue-log arrays.
**Suggestion:** Add named bounds for journal scans, step mutations, review-history retention, and state comparisons, then reuse those constants or document equivalent limits across implementation and spec artifacts.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R1
**Issue:** Several files introduce unbounded or weakly bounded bulk operations: journal scanning in finalize cleanup, full-state `JSON.stringify` comparisons in flow context, step-array mutations in registry, review-history accumulation in `flow.json`, and large issue-log arrays.
**Suggestion:** Add named bounds for journal scans, step mutations, review-history retention, and state comparisons, then reuse those constants or document equivalent limits across implementation and spec artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
