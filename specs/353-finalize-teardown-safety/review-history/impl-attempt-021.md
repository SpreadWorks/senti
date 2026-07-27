# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Remove Redundant Empty Result Fields
**Finding key:** loop-8242f5966d1b0b95b2da
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/draft-review-questions.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** Empty arrays like `blockingFindings`, `advisoryFindings`, and `repairTargets`, plus `taskId: null`, add boilerplate without conveying useful information for a PASS result.  
**Suggestion:** Omit empty/default fields from PASS artifacts, or use a compact schema where only non-empty result sections are emitted.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** Empty arrays like `blockingFindings`, `advisoryFindings`, and `repairTargets`, plus `taskId: null`, add boilerplate without conveying useful information for a PASS result.  
**Suggestion:** Omit empty/default fields from PASS artifacts, or use a compact schema where only non-empty result sections are emitted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Avoid Committing Volatile Runtime State
**Finding key:** loop-f741510d48e62ac90377
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** The file is a 10k+ line runtime snapshot containing run IDs, timestamps, attempts, metrics, transient review evidence, and retry history. This makes the change noisy and likely to churn on every execution.  
**Suggestion:** Do not commit `flow.json` as a generated runtime artifact, or replace it with a minimal stable summary that excludes volatile execution state.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** The file is a 10k+ line runtime snapshot containing run IDs, timestamps, attempts, metrics, transient review evidence, and retry history. This makes the change noisy and likely to churn on every execution.  
**Suggestion:** Do not commit `flow.json` as a generated runtime artifact, or replace it with a minimal stable summary that excludes volatile execution state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Deduplicate Repeated Target State Snapshots
**Finding key:** loop-fcd3b3200087e31ec749
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** `reviewConvergence.records[*].targetState.entries` repeats large, mostly identical file/hash snapshots many times, creating substantial duplication and making real changes hard to review.  
**Suggestion:** Store each unique target-state snapshot once under a keyed map by digest, then reference it from records via `targetStateDigest`.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** `reviewConvergence.records[*].targetState.entries` repeats large, mostly identical file/hash snapshots many times, creating substantial duplication and making real changes hard to review.  
**Suggestion:** Store each unique target-state snapshot once under a keyed map by digest, then reference it from records via `targetStateDigest`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Bound Review History Growth
**Finding key:** loop-cd7b6b5229b81b030576
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R1  
**Issue:** Arrays such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` appear to grow with every retry/review run. This risks unbounded artifact growth and violates the bounded-resource-usage guardrail.  
**Suggestion:** Add an explicit retention policy, such as keeping only the latest N records per phase/task plus canonical evidence references, or move full history to bounded external evidence artifacts.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R1  
**Issue:** Arrays such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` appear to grow with every retry/review run. This risks unbounded artifact growth and violates the bounded-resource-usage guardrail.  
**Suggestion:** Add an explicit retention policy, such as keeping only the latest N records per phase/task plus canonical evidence references, or move full history to bounded external evidence artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Deduplicate Recovery Evidence
**Finding key:** loop-976aac0e40db0a21c6af
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R2
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R2  
**Issue:** The `retry-recovery` entry duplicates the same recovery payload already stored in `specs/353-finalize-teardown-safety/retry-recovery.json`, including id, reason, evidence hashes, command, and timestamp. This creates two sources of truth for the same recovery event.  
**Suggestion:** Keep the detailed recovery metadata in `retry-recovery.json` and replace the issue-log entry with a compact reference containing only `step`, `issueLogId`, `taskId`, `timestamp`, and a pointer to the recovery id.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R2  
**Issue:** The `retry-recovery` entry duplicates the same recovery payload already stored in `specs/353-finalize-teardown-safety/retry-recovery.json`, including id, reason, evidence hashes, command, and timestamp. This creates two sources of truth for the same recovery event.  
**Suggestion:** Keep the detailed recovery metadata in `retry-recovery.json` and replace the issue-log entry with a compact reference containing only `step`, `issueLogId`, `taskId`, `timestamp`, and a pointer to the recovery id.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Add Explicit Log Retention Bounds
**Finding key:** loop-cbf2ce91c8ac21a9d94e
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The new issue log is already large and has no visible cap on entry count, observation count, reason length, or embedded evidence size. This conflicts with the bounded-resource-usage guardrail for bulk data loading and retry/recovery histories.  
**Suggestion:** Add or document explicit bounds for generated issue-log content, such as maximum retained entries per phase/task, maximum observations per entry, and truncation behavior for long `reason` / `observed` fields.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** The new issue log is already large and has no visible cap on entry count, observation count, reason length, or embedded evidence size. This conflicts with the bounded-resource-usage guardrail for bulk data loading and retry/recovery histories.  
**Suggestion:** Add or document explicit bounds for generated issue-log content, such as maximum retained entries per phase/task, maximum observations per entry, and truncation behavior for long `reason` / `observed` fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Normalize Duplicate Issue Entries
**Finding key:** loop-f04ba9ca42e8c40cdbae
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat nearly identical `spec-test-coverage` failures with different timestamps and ids. The repetition makes the artifact harder to review and inflates generated state without adding much signal.  
**Suggestion:** Collapse repeated equivalent failures into a single entry with an `attempts` count or `repeatedAt` timestamps, preserving auditability while reducing duplicate data.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat nearly identical `spec-test-coverage` failures with different timestamps and ids. The repetition makes the artifact harder to review and inflates generated state without adding much signal.  
**Suggestion:** Collapse repeated equivalent failures into a single entry with an `attempts` count or `repeatedAt` timestamps, preserving auditability while reducing duplicate data.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Remove duplicate review-result artifacts
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

### 9. 3. Add trailing newline
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

### 10. 1. Remove duplicate review-result artifacts
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

### 11. 3. Add trailing newline
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

### 12. 1. Remove duplicate review-result artifacts
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

### 13. 3. Add trailing newline
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

### 14. 2. Consolidate repeated evidence fields
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

### 15. 2. Remove Duplicate Finding Payloads
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

### 16. 1. Reconcile Contradictory Review Outcomes
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

### 17. 3. Align Task Status With Requirement Status
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

### 18. 4. Simplify Repeated Lifecycle Descriptions
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

### 19. 5. Clarify “At Most One Retry Per Invocation” Naming
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

### 20. 1. Remove Empty Placeholder Sections
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

### 21. 2. Consolidate Repeated Retry Wording
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

### 22. 3. Clarify “Destructive Persistence”
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

### 23. 4. Avoid Duplicating Task Metadata Across Files
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

### 24. 1. Split The Combined Spec Header Into Per-Requirement Headers
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

### 25. 2. Extract Duplicate Finalize Rejection Capture Logic
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

### 26. 3. Add An Explicit Upper Bound When Reading Recovery Journals
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

### 27. 4. Remove Or Reclassify The Raw Scenario Validity Log
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

### 28. 5. Rename Fixture Helpers To Match Their Specific Domain
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

### 29. 6. Replace Source-Regex Design Assertions With Behavior-Oriented Checks Where Possible
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

### 30. 3. Avoid unbounded materialization of untracked files
**Finding key:** loop-2dcfb3ad355e60208410
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R7  
**Issue:** `scopeTaskReviewTarget()` materializes `target.untrackedFiles` with `[...(target.untrackedFiles || [])]` and filters it without an explicit upper bound. That is bulk loading with no limit, which conflicts with the `bounded-resource-usage` guardrail if the iterable is unexpectedly large.  
**Suggestion:** Iterate with an explicit cap, or reuse an existing bounded collection helper if the project has one, and fail clearly when the untracked file count exceeds the review input limit.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R7  
**Issue:** `scopeTaskReviewTarget()` materializes `target.untrackedFiles` with `[...(target.untrackedFiles || [])]` and filters it without an explicit upper bound. That is bulk loading with no limit, which conflicts with the `bounded-resource-usage` guardrail if the iterable is unexpectedly large.  
**Suggestion:** Iterate with an explicit cap, or reuse an existing bounded collection helper if the project has one, and fail clearly when the untracked file count exceeds the review input limit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Remove stale import
**Finding key:** loop-b3afc61f64ee9f007a96
**Failure mode:** refactor
**File:** src/flow/lib/finalize-cleanup-state.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `specIdFromPath` appears to be left over after `ensureCleanupStep()` switched from direct `mainFlowManager.mutate()` calls to `stateOwner.mutate()`. The shown file no longer needs to compute `specId` directly.  
**Suggestion:** Remove `specIdFromPath` from the import list to keep the ownership refactor clean and avoid dead code.
**Suggestion:** **File:** `src/flow/lib/finalize-cleanup-state.js`  
**Requirement:** R6  
**Issue:** `specIdFromPath` appears to be left over after `ensureCleanupStep()` switched from direct `mainFlowManager.mutate()` calls to `stateOwner.mutate()`. The shown file no longer needs to compute `specId` directly.  
**Suggestion:** Remove `specIdFromPath` from the import list to keep the ownership refactor clean and avoid dead code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Extract repeated main-state authority resolution
**Finding key:** loop-b9dc17ab8dd1185a82f6
**Failure mode:** refactor
**File:** src/flow/lib/flow-context.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** The new `mainStateOwnsPostMergeFlow(mainState)` check is now embedded in two similar branches that both resolve `mainFlowPath`, create a main-root manager, load state, and then conditionally return main authority.  
**Suggestion:** Extract a small helper such as `resolvePostMergeMainAuthority(...)` or `loadPostMergeMainState(...)` so the post-merge ownership rule lives in one place and future changes do not drift between `boundWorktreeAuthority()` and `resolveAuthorityFlowState()`.
**Suggestion:** **File:** `src/flow/lib/flow-context.js`  
**Requirement:** R6  
**Issue:** The new `mainStateOwnsPostMergeFlow(mainState)` check is now embedded in two similar branches that both resolve `mainFlowPath`, create a main-root manager, load state, and then conditionally return main authority.  
**Suggestion:** Extract a small helper such as `resolvePostMergeMainAuthority(...)` or `loadPostMergeMainState(...)` so the post-merge ownership rule lives in one place and future changes do not drift between `boundWorktreeAuthority()` and `resolveAuthorityFlowState()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Bound journal scan before reading every JSON file
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

### 34. 2. Centralize finalize flow state owner resolution
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

### 35. 3. Extract repeated checkpoint boundary pattern
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

### 36. 4. Rename generic injected dependencies
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

### 37. 1. Simplify `tryUpdateStepStatus` Owner Handling
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

### 38. 2. Remove Redundant `specId` Option Passed To Finalize Owner
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

### 39. 3. Avoid Repeated Finalize Owner Resolution In Lifecycle Hooks
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

### 40. 4. Add An Explicit Bound For Bulk Step Resets
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

### 41. 5. Keep Finalize Owner Construction Consistent
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

### 42. 6. Add Spec Header To New Requirement Test
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

### 43. 1. Consolidate Finalize State Owner Resolution
**Finding key:** loop-17d06d5917ba87d0f601
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R6
**Issue:** Finalize flow state owner resolution is now duplicated across `run-finalize-cleanup.js`, `registry.js`, `dispatcher.js`, and the related `flow-context.js` authority paths. The same ownership rule is expressed as repeated fallback construction, repeated owner lookup, and occasional raw `flowManager` passing, which weakens the cross-file “single mutation owner” contract.
**Suggestion:** Introduce one shared helper or owner method for resolving and using `FinalizeFlowStateOwner`, then have cleanup, registry lifecycle hooks, dispatcher metadata persistence, and authority resolution call that path consistently.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R6
**Issue:** Finalize flow state owner resolution is now duplicated across `run-finalize-cleanup.js`, `registry.js`, `dispatcher.js`, and the related `flow-context.js` authority paths. The same ownership rule is expressed as repeated fallback construction, repeated owner lookup, and occasional raw `flowManager` passing, which weakens the cross-file “single mutation owner” contract.
**Suggestion:** Introduce one shared helper or owner method for resolving and using `FinalizeFlowStateOwner`, then have cleanup, registry lifecycle hooks, dispatcher metadata persistence, and authority resolution call that path consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 2. Normalize Review And Gate Outcome Sources
**Finding key:** loop-a608e8478a93ca60e6af
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-review.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`
**Requirement:** R7
**Issue:** Review artifacts disagree across files: `spec-review.json` reports PASS/no findings, while `spec-gate-source.json`, `issue-log.json`, and raw scenario-validity evidence record blocking or invalid coverage failures. These files describe the same spec phase but expose conflicting outcomes to downstream consumers.
**Suggestion:** Pick one canonical review/gate result source and regenerate dependent artifacts from it, or remove stale PASS artifacts when a blocking gate result exists.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`
**Requirement:** R7
**Issue:** Review artifacts disagree across files: `spec-review.json` reports PASS/no findings, while `spec-gate-source.json`, `issue-log.json`, and raw scenario-validity evidence record blocking or invalid coverage failures. These files describe the same spec phase but expose conflicting outcomes to downstream consumers.
**Suggestion:** Pick one canonical review/gate result source and regenerate dependent artifacts from it, or remove stale PASS artifacts when a blocking gate result exists.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 3. Deduplicate Recovery And Review Evidence Artifacts
**Finding key:** loop-4ab235363c5babdab265
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`
**Requirement:** R7
**Issue:** The same recovery, review, and coverage evidence is repeated across `issue-log.json`, `retry-recovery.json`, `flow.json`, `review-history/spec-attempt-001.md`, `spec-attempt-002.json`, and `spec-gate-source.json`. This creates multiple sources of truth and makes equivalent events appear as separate findings or attempts.
**Suggestion:** Store detailed evidence once in a canonical structured artifact, then reference it from logs, history, gate summaries, and flow records by stable IDs or digests.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`
**Requirement:** R7
**Issue:** The same recovery, review, and coverage evidence is repeated across `issue-log.json`, `retry-recovery.json`, `flow.json`, `review-history/spec-attempt-001.md`, `spec-attempt-002.json`, and `spec-gate-source.json`. This creates multiple sources of truth and makes equivalent events appear as separate findings or attempts.
**Suggestion:** Store detailed evidence once in a canonical structured artifact, then reference it from logs, history, gate summaries, and flow records by stable IDs or digests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 4. Align Retry Policy Naming Across Spec Files
**Finding key:** loop-a515cbeb471b2e8ef766
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R2
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R2
**Issue:** The phrase “at most one retry per invocation” is repeated across `spec.md` and `spec.json`, while related implementation and tests use broader cleanup/finalize terminology. Without a named policy, small wording differences can drift across requirements, tasks, acceptance criteria, and test descriptions.
**Suggestion:** Define a single policy name, such as `single-retry replay policy`, in the canonical requirement text and use that name consistently in `spec.md`, `spec.json`, task files, and test descriptions.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R2
**Issue:** The phrase “at most one retry per invocation” is repeated across `spec.md` and `spec.json`, while related implementation and tests use broader cleanup/finalize terminology. Without a named policy, small wording differences can drift across requirements, tasks, acceptance criteria, and test descriptions.
**Suggestion:** Define a single policy name, such as `single-retry replay policy`, in the canonical requirement text and use that name consistently in `spec.md`, `spec.json`, task files, and test descriptions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 5. Keep Task Metadata In One Place
**Finding key:** loop-f2fa2402501c009caf90
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R7
**Issue:** Task titles, statuses, summaries, and references are duplicated between `spec.md`, `spec.json`, and `tasks/T-1.md` through `tasks/T-6.md`. The summaries already show drift, with requirements marked done while corresponding tasks remain pending.
**Suggestion:** Make one file authoritative for task state, preferably the per-task files or `spec.json`, and reduce `spec.md` to a compact linked index. Regenerate or validate the mirrored file so task and requirement statuses cannot disagree.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`
**Requirement:** R7
**Issue:** Task titles, statuses, summaries, and references are duplicated between `spec.md`, `spec.json`, and `tasks/T-1.md` through `tasks/T-6.md`. The summaries already show drift, with requirements marked done while corresponding tasks remain pending.
**Suggestion:** Make one file authoritative for task state, preferably the per-task files or `spec.json`, and reduce `spec.md` to a compact linked index. Regenerate or validate the mirrored file so task and requirement statuses cannot disagree.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
