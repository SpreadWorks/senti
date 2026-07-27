# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Remove Redundant Empty Result Fields
**Finding key:** loop-2d0416287a8fef715a24
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/draft-review-questions.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** The file records a PASS verdict with several empty arrays and `taskId: null`, but no findings. These fields add boilerplate without carrying information for this artifact.  
**Suggestion:** If the consumer allows it, omit empty optional fields on PASS artifacts and keep only `version`, `phase`, `sourceDraft`, `generatedAt`, `verdict`, `summary`, and digest fields.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/draft-review-questions.json`  
**Requirement:** R8  
**Issue:** The file records a PASS verdict with several empty arrays and `taskId: null`, but no findings. These fields add boilerplate without carrying information for this artifact.  
**Suggestion:** If the consumer allows it, omit empty optional fields on PASS artifacts and keep only `version`, `phase`, `sourceDraft`, `generatedAt`, `verdict`, `summary`, and digest fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Avoid Committing Volatile Runtime State
**Finding key:** loop-30546e1458a89c97ca62
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R7  
**Issue:** `flow.json` contains large runtime-only data such as metrics, step attempts, review convergence history, target state hashes, timestamps, provider invocation IDs, and repeated target snapshots. This creates noisy diffs and makes future reviews harder because most of the file is generated process state rather than durable spec input.  
**Suggestion:** Trim this file to the minimal persisted flow contract needed by the project, or move transient execution history into ignored runtime artifacts. Keep stable fields like spec path, branches, run id, current step/task state, and any required durable journal metadata.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R7  
**Issue:** `flow.json` contains large runtime-only data such as metrics, step attempts, review convergence history, target state hashes, timestamps, provider invocation IDs, and repeated target snapshots. This creates noisy diffs and makes future reviews harder because most of the file is generated process state rather than durable spec input.  
**Suggestion:** Trim this file to the minimal persisted flow contract needed by the project, or move transient execution history into ignored runtime artifacts. Keep stable fields like spec path, branches, run id, current step/task state, and any required durable journal metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Deduplicate Repeated Target State Snapshots
**Finding key:** loop-b75a1ea284517761351b
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** `reviewConvergence.records[*].targetState.entries` repeats near-identical long file lists many times, making the JSON difficult to inspect and maintain. This is duplicate data with high churn.  
**Suggestion:** Store each unique `targetStateDigest` once in a top-level map, then reference it from each convergence record by digest. This preserves traceability while eliminating thousands of repeated lines.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R6  
**Issue:** `reviewConvergence.records[*].targetState.entries` repeats near-identical long file lists many times, making the JSON difficult to inspect and maintain. This is duplicate data with high churn.  
**Suggestion:** Store each unique `targetStateDigest` once in a top-level map, then reference it from each convergence record by digest. This preserves traceability while eliminating thousands of repeated lines.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Bound Review History Growth
**Finding key:** loop-db67378b4dc2e8689ec2
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R1  
**Issue:** Arrays such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` can grow without an obvious upper bound. This conflicts with the bounded-resource-usage guardrail for bulk data loading and persistent recursive/retry history.  
**Suggestion:** Add an explicit retention cap or compaction scheme in the persisted format, for example keeping only the latest N records per phase/task plus canonical evidence references for older records.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/flow.json`  
**Requirement:** R1  
**Issue:** Arrays such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` can grow without an obvious upper bound. This conflicts with the bounded-resource-usage guardrail for bulk data loading and persistent recursive/retry history.  
**Suggestion:** Add an explicit retention cap or compaction scheme in the persisted format, for example keeping only the latest N records per phase/task plus canonical evidence references for older records.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Consolidate Repeated Gate Findings
**Finding key:** loop-a72174f8f202a8a2d5d7
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat the same `spec-test-coverage` failure with near-identical payloads, timestamps, observations, and failed evaluations. This makes the log harder to scan and increases artifact size without adding much new information.  
**Suggestion:** Collapse repeated gate failures into one entry with an `attempts` count or a compact `retryTimestamps` array, preserving the final distinct resolution entry.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat the same `spec-test-coverage` failure with near-identical payloads, timestamps, observations, and failed evaluations. This makes the log harder to scan and increases artifact size without adding much new information.  
**Suggestion:** Collapse repeated gate failures into one entry with an `attempts` count or a compact `retryTimestamps` array, preserving the final distinct resolution entry.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Add an Explicit Retention Bound for Log Entries
**Finding key:** loop-014ad92f11d70335e7a5
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R8  
**Issue:** The `entries` array is an append-only log with no visible maximum entry count, byte size, or truncation policy. This can violate the `bounded-resource-usage` guardrail if the artifact is loaded or processed wholesale.  
**Suggestion:** Add metadata such as `maxEntries`, `maxBytes`, or `truncated: true`, and define how older entries are compacted or summarized once the bound is reached.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R8  
**Issue:** The `entries` array is an append-only log with no visible maximum entry count, byte size, or truncation policy. This can violate the `bounded-resource-usage` guardrail if the artifact is loaded or processed wholesale.  
**Suggestion:** Add metadata such as `maxEntries`, `maxBytes`, or `truncated: true`, and define how older entries are compacted or summarized once the bound is reached.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Avoid Duplicating Recovery Data Across Artifacts
**Finding key:** loop-b0716a3ee8a0c4c36a64
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/retry-recovery.json
**Requirement:** R2
**Issue:** **File:** `specs/353-finalize-teardown-safety/retry-recovery.json`  
**Requirement:** R2  
**Issue:** The recovery entry in this file is also embedded in `issue-log.json` with overlapping fields such as `id`, `kind`, `phase`, `reason`, `changedEvidence`, and retry counters. Maintaining the same event in two places risks drift.  
**Suggestion:** Keep the canonical recovery payload in `retry-recovery.json` and have `issue-log.json` reference it by `issueLogId`/`id`, or generate one artifact from the other.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/retry-recovery.json`  
**Requirement:** R2  
**Issue:** The recovery entry in this file is also embedded in `issue-log.json` with overlapping fields such as `id`, `kind`, `phase`, `reason`, `changedEvidence`, and retry counters. Maintaining the same event in two places risks drift.  
**Suggestion:** Keep the canonical recovery payload in `retry-recovery.json` and have `issue-log.json` reference it by `issueLogId`/`id`, or generate one artifact from the other.
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

### 15. 2. Remove Duplicated Guardrail Finding Payload
**Finding key:** loop-067682fb2b67deaa8f4c
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-gate-source.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-gate-source.json`  
**Requirement:** R7  
**Issue:** The same `spec-test-coverage` violation appears in both `evaluations[0].observations[0]` and top-level `observations[0]`, with nearly identical content but different `findingId` and `fingerprint` values. This duplicates maintenance surface and can make consumers disagree about finding identity.  
**Suggestion:** Keep one canonical finding representation, or ensure the top-level observation references the evaluation finding by shared ID instead of duplicating the full payload.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-gate-source.json`  
**Requirement:** R7  
**Issue:** The same `spec-test-coverage` violation appears in both `evaluations[0].observations[0]` and top-level `observations[0]`, with nearly identical content but different `findingId` and `fingerprint` values. This duplicates maintenance surface and can make consumers disagree about finding identity.  
**Suggestion:** Keep one canonical finding representation, or ensure the top-level observation references the evaluation finding by shared ID instead of duplicating the full payload.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Reconcile Contradictory Spec Review Results
**Finding key:** loop-a6c2d4f77b38680f985c
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-review.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`  
**Requirement:** R7  
**Issue:** `spec-review.json` reports `verdict: "PASS"` with zero findings, while `spec-gate-source.json` reports a blocking `spec-test-coverage` failure for missing spec-local tests. These generated artifacts describe the same spec phase but disagree.  
**Suggestion:** Regenerate or update the review artifact so the verdict and counts reflect the current gate result, or remove the stale passing artifact if only one source of truth should be retained.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`  
**Requirement:** R7  
**Issue:** `spec-review.json` reports `verdict: "PASS"` with zero findings, while `spec-gate-source.json` reports a blocking `spec-test-coverage` failure for missing spec-local tests. These generated artifacts describe the same spec phase but disagree.  
**Suggestion:** Regenerate or update the review artifact so the verdict and counts reflect the current gate result, or remove the stale passing artifact if only one source of truth should be retained.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 3. Align Requirement And Task Statuses
**Finding key:** loop-eed114c5dd6dfe34d899
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R7  
**Issue:** Requirements R1 through R7 are marked `done`, but their corresponding tasks T-1 through T-6 remain `pending`. This makes the spec state internally inconsistent and weakens downstream automation or review signals.  
**Suggestion:** Update task statuses to match the completed requirement state, or add an explicit field explaining why requirements are `done` while implementation tasks remain `pending`.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R7  
**Issue:** Requirements R1 through R7 are marked `done`, but their corresponding tasks T-1 through T-6 remain `pending`. This makes the spec state internally inconsistent and weakens downstream automation or review signals.  
**Suggestion:** Update task statuses to match the completed requirement state, or add an explicit field explaining why requirements are `done` while implementation tasks remain `pending`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Remove Empty Placeholder Sections
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

### 19. 2. Consolidate Repeated Retry Wording
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

### 20. 3. Clarify “Destructive Persistence”
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

### 21. 4. Avoid Duplicating Task Metadata Across Files
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

### 22. 1. Bound Recursive Step Traversal
**Finding key:** loop-04384db17409ff05e254
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R7  
**Issue:** `flowStepStatus()` recursively walks `step.children` without an explicit depth or node-count bound, which violates the `bounded-resource-usage` guardrail even in test code.  
**Suggestion:** Replace it with an iterative traversal that caps visited nodes, or add a `depth`/`remaining` parameter with a hard maximum and fail clearly if exceeded.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R7  
**Issue:** `flowStepStatus()` recursively walks `step.children` without an explicit depth or node-count bound, which violates the `bounded-resource-usage` guardrail even in test code.  
**Suggestion:** Replace it with an iterative traversal that caps visited nodes, or add a `depth`/`remaining` parameter with a hard maximum and fail clearly if exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Extract Repeated Dispatch Harness Setup
**Finding key:** loop-a2654cad0bbe8bb9e135
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js
**Requirement:** R5
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R5  
**Issue:** The R4 and R5 tests duplicate `Container` setup, `dispatch()` wiring, output collection, exit-code capture, and envelope parsing. This makes envelope-related assertions harder to maintain consistently.  
**Suggestion:** Introduce a small helper such as `dispatchFinalizeCleanupFixture({ fixture, command, buildHookCtx })` that returns `{ envelope, serializedEnvelope, exitCode, runtimeLogPath }`.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R5  
**Issue:** The R4 and R5 tests duplicate `Container` setup, `dispatch()` wiring, output collection, exit-code capture, and envelope parsing. This makes envelope-related assertions harder to maintain consistently.  
**Suggestion:** Introduce a small helper such as `dispatchFinalizeCleanupFixture({ fixture, command, buildHookCtx })` that returns `{ envelope, serializedEnvelope, exitCode, runtimeLogPath }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Centralize Prototype Patch Cleanup
**Finding key:** loop-3da1d89d0cc07abe94a1
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js
**Requirement:** R1
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R1  
**Issue:** Several tests monkey-patch `AtomicJsonFile.prototype.write` and manually restore it in `finally` blocks. The pattern is repeated and easy to get subtly wrong as more fault cases are added.  
**Suggestion:** Add a helper like `withPatchedAtomicWrite(patchFn, asyncFn)` that installs the patch, runs the callback, and always restores the original method.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/finalize-teardown-contract.test.js`  
**Requirement:** R1  
**Issue:** Several tests monkey-patch `AtomicJsonFile.prototype.write` and manually restore it in `finally` blocks. The pattern is repeated and easy to get subtly wrong as more fault cases are added.  
**Suggestion:** Add a helper like `withPatchedAtomicWrite(patchFn, asyncFn)` that installs the patch, runs the callback, and always restores the original method.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Remove Or Rename Committed Raw Failure Log
**Finding key:** loop-18490772cbeb0ba21cd7
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/tests/.raw/scenario-validity.log
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/tests/.raw/scenario-validity.log`  
**Requirement:** R7  
**Issue:** The committed `.raw` log records `invalid_test` results and a large list of unrelated invalid paths. As a generated preflight artifact, it reads like stale diagnostic output rather than intentional test source.  
**Suggestion:** Remove it from the change set if it is generated evidence, or rename/document it as an expected fixture if tests consume it directly.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/tests/.raw/scenario-validity.log`  
**Requirement:** R7  
**Issue:** The committed `.raw` log records `invalid_test` results and a large list of unrelated invalid paths. As a generated preflight artifact, it reads like stale diagnostic output rather than intentional test source.  
**Suggestion:** Remove it from the change set if it is generated evidence, or rename/document it as an expected fixture if tests consume it directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 3. Avoid unbounded materialization of untracked files
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

### 27. 1. Remove stale import
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

### 28. 2. Extract repeated main-state authority resolution
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

### 29. 1. Bound foreign journal scan
**Finding key:** loop-006a3d5fd230a23a2b76
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R2  
**Issue:** `#assertNoForeignTargetJournal()` synchronously scans every `.json` file in the transaction directory and parses each candidate without an explicit count or size bound. This violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Add explicit limits, for example `MAX_TRANSACTION_JOURNAL_FILES` and `MAX_TRANSACTION_JOURNAL_BYTES`, and fail with a targeted error when exceeded before parsing candidates.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R2  
**Issue:** `#assertNoForeignTargetJournal()` synchronously scans every `.json` file in the transaction directory and parses each candidate without an explicit count or size bound. This violates the `bounded-resource-usage` guardrail for bulk data loading.  
**Suggestion:** Add explicit limits, for example `MAX_TRANSACTION_JOURNAL_FILES` and `MAX_TRANSACTION_JOURNAL_BYTES`, and fail with a targeted error when exceeded before parsing candidates.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 2. Centralize finalize state owner resolution
**Finding key:** loop-6c8815482870de47dc3e
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** The pattern `ctx.finalizeFlowStateOwner || FinalizeFlowStateOwner.forMainContext({ ...ctx, specId })` is repeated in multiple helpers. This duplicates authority-selection logic and makes future changes to main-repository ownership easier to miss.  
**Suggestion:** Add a small helper such as `resolveFinalizeStateOwner(ctx, specId)` and use it from `activeFlowIsCleared`, `clearActiveFlowBoundary`, `runSpecOnlyCompletion`, and teardown transaction setup.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** The pattern `ctx.finalizeFlowStateOwner || FinalizeFlowStateOwner.forMainContext({ ...ctx, specId })` is repeated in multiple helpers. This duplicates authority-selection logic and makes future changes to main-repository ownership easier to miss.  
**Suggestion:** Add a small helper such as `resolveFinalizeStateOwner(ctx, specId)` and use it from `activeFlowIsCleared`, `clearActiveFlowBoundary`, `runSpecOnlyCompletion`, and teardown transaction setup.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 3. Rename generic phase persistence helper
**Finding key:** loop-459e7279a5d4d9a4ffc9
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** `persistFinalizeTeardownCompletion()` sounds specific to the final `completed` phase, but it advances and writes any teardown phase such as `branch-deleted`, `validated`, or `active-cleared`.  
**Suggestion:** Rename it to something phase-generic, such as `persistFinalizeTeardownAdvance()` or `advanceAndPersistFinalizeTeardownPhase()`.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R1  
**Issue:** `persistFinalizeTeardownCompletion()` sounds specific to the final `completed` phase, but it advances and writes any teardown phase such as `branch-deleted`, `validated`, or `active-cleared`.  
**Suggestion:** Rename it to something phase-generic, such as `persistFinalizeTeardownAdvance()` or `advanceAndPersistFinalizeTeardownPhase()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 4. Simplify branch deletion checkpoint flow
**Finding key:** loop-685ac12941e90984cdcd
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R2  
**Issue:** `deleteFeatureBranchAtCheckpoint()` can call `deleteFeatureBranchForCleanup()` when a checkpoint was newly created even if `featureBranchExists()` already returned false. That makes the boundary harder to reason about and relies on delete behavior for an already-absent branch.  
**Suggestion:** Split the cases: if the branch exists, validate authority, checkpoint, then delete; if it does not exist, checkpoint and assert absence/reality without invoking the delete path.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R2  
**Issue:** `deleteFeatureBranchAtCheckpoint()` can call `deleteFeatureBranchForCleanup()` when a checkpoint was newly created even if `featureBranchExists()` already returned false. That makes the boundary harder to reason about and relies on delete behavior for an already-absent branch.  
**Suggestion:** Split the cases: if the branch exists, validate authority, checkpoint, then delete; if it does not exist, checkpoint and assert absence/reality without invoking the delete path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 5. Reduce polymorphism in step-status mutation
**Finding key:** loop-776e27823e89283a1704
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `tryUpdateStepStatus()` now accepts a hook context, a `FlowManager`, or a `FinalizeFlowStateOwner`, and branches on `instanceof` plus shape checks. This makes the mutation authority rules harder to follow.  
**Suggestion:** Normalize the caller before invoking the helper, or split into two helpers: one for ordinary `FlowManager` updates and one for `FinalizeFlowStateOwner` updates. That keeps the R6 ownership boundary explicit.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** `tryUpdateStepStatus()` now accepts a hook context, a `FlowManager`, or a `FinalizeFlowStateOwner`, and branches on `instanceof` plus shape checks. This makes the mutation authority rules harder to follow.  
**Suggestion:** Normalize the caller before invoking the helper, or split into two helpers: one for ordinary `FlowManager` updates and one for `FinalizeFlowStateOwner` updates. That keeps the R6 ownership boundary explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Add spec Requirement Header to New Test
**Finding key:** loop-4c1f24aa639c0aed6ca7
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The added `scopeTaskReviewTarget` test covers spec-local review scoping behavior but does not include a `// spec: R<N>` header, while R7 requires spec-local tests to be annotated with requirement headers.  
**Suggestion:** Add an appropriate requirement marker immediately before or inside the test, for example `// spec: R7`, so the new coverage is traceable and consistent with the project’s spec-test convention.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R7  
**Issue:** The added `scopeTaskReviewTarget` test covers spec-local review scoping behavior but does not include a `// spec: R<N>` header, while R7 requires spec-local tests to be annotated with requirement headers.  
**Suggestion:** Add an appropriate requirement marker immediately before or inside the test, for example `// spec: R7`, so the new coverage is traceable and consistent with the project’s spec-test convention.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 1. Unify Bounded-Resource Requirement Mapping
**Finding key:** loop-805da2d0913b331ad8f8
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R7  
**Issue:** Multiple files flag the same bounded-resource-usage concern but attach different requirement IDs: `flow.json` uses R1, `issue-log.json` uses R8, `review.js` uses R7, `run-finalize-cleanup.js` uses R2, and `finalize-teardown-contract.test.js` uses R7. This makes traceability inconsistent across generated artifacts, tests, and implementation reviews.
**Suggestion:** Pick the canonical requirement ID for bounded-resource behavior in `spec.md`, then update review artifacts and test annotations to use that same ID consistently.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.md`  
**Requirement:** R7  
**Issue:** Multiple files flag the same bounded-resource-usage concern but attach different requirement IDs: `flow.json` uses R1, `issue-log.json` uses R8, `review.js` uses R7, `run-finalize-cleanup.js` uses R2, and `finalize-teardown-contract.test.js` uses R7. This makes traceability inconsistent across generated artifacts, tests, and implementation reviews.
**Suggestion:** Pick the canonical requirement ID for bounded-resource behavior in `spec.md`, then update review artifacts and test annotations to use that same ID consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 2. Consolidate Finalize State Owner Resolution
**Finding key:** loop-fa5c2f95e7ef25a00061
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** Finalize ownership logic is being introduced in multiple places: `flow-context.js`, `run-finalize-cleanup.js`, `finalize-cleanup-state.js`, and `registry.js`. The summaries show repeated authority resolution and polymorphic state mutation paths, which risks divergent behavior between main-flow ownership, post-merge ownership, and step-status mutation.
**Suggestion:** Centralize ownership resolution behind one explicit interface, then have cleanup, context resolution, and registry step updates call that interface instead of repeating or shape-checking authority logic.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R6  
**Issue:** Finalize ownership logic is being introduced in multiple places: `flow-context.js`, `run-finalize-cleanup.js`, `finalize-cleanup-state.js`, and `registry.js`. The summaries show repeated authority resolution and polymorphic state mutation paths, which risks divergent behavior between main-flow ownership, post-merge ownership, and step-status mutation.
**Suggestion:** Centralize ownership resolution behind one explicit interface, then have cleanup, context resolution, and registry step updates call that interface instead of repeating or shape-checking authority logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 3. Remove Duplicate Recovery Event Storage
**Finding key:** loop-9179722dfc0ba9e3a926
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/issue-log.json
**Requirement:** R2
**Issue:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R2  
**Issue:** Recovery data appears in both `issue-log.json` and `retry-recovery.json` with overlapping fields. This creates two sources of truth for the same retry/recovery event and can drift across future retries.
**Suggestion:** Make `retry-recovery.json` canonical and store only a reference in `issue-log.json`, or generate one artifact from the other.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/issue-log.json`  
**Requirement:** R2  
**Issue:** Recovery data appears in both `issue-log.json` and `retry-recovery.json` with overlapping fields. This creates two sources of truth for the same retry/recovery event and can drift across future retries.
**Suggestion:** Make `retry-recovery.json` canonical and store only a reference in `issue-log.json`, or generate one artifact from the other.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 4. Reconcile Spec Phase Verdict Artifacts
**Finding key:** loop-bd454ef7d8346e784807
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec-review.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`  
**Requirement:** R7  
**Issue:** `spec-review.json` reports PASS/no findings while `spec-gate-source.json` reports a blocking `spec-test-coverage` failure for the same phase. Downstream consumers can receive contradictory review status depending on which artifact they read.
**Suggestion:** Regenerate the stale artifact or define one canonical phase verdict source and have the other reference it.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec-review.json`  
**Requirement:** R7  
**Issue:** `spec-review.json` reports PASS/no findings while `spec-gate-source.json` reports a blocking `spec-test-coverage` failure for the same phase. Downstream consumers can receive contradictory review status depending on which artifact they read.
**Suggestion:** Regenerate the stale artifact or define one canonical phase verdict source and have the other reference it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 5. Avoid Maintaining Review Results In Multiple Formats
**Finding key:** loop-2926b05a0529befc7fba
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md`  
**Requirement:** R7  
**Issue:** The review history contains equivalent PASS/no-findings results in both Markdown and JSON artifacts. This duplicates the same outcome across formats without a clear ownership rule.
**Suggestion:** Keep structured JSON as canonical, or document that Markdown is a human-readable projection generated from the JSON.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/review-history/spec-attempt-001.md`  
**Requirement:** R7  
**Issue:** The review history contains equivalent PASS/no-findings results in both Markdown and JSON artifacts. This duplicates the same outcome across formats without a clear ownership rule.
**Suggestion:** Keep structured JSON as canonical, or document that Markdown is a human-readable projection generated from the JSON.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 6. Normalize Task Status Ownership
**Finding key:** loop-aa0e143e7727beeee964
**Failure mode:** refactor
**File:** specs/353-finalize-teardown-safety/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R7  
**Issue:** Requirement statuses in `spec.json` are marked done while task files and task metadata still report pending work. This is a cross-file state inconsistency between requirement completion and task completion.
**Suggestion:** Make task files the canonical task-status source and derive summary status from them, or update `spec.json` and `tasks/T-*.md` together through one generation path.
**Suggestion:** **File:** `specs/353-finalize-teardown-safety/spec.json`  
**Requirement:** R7  
**Issue:** Requirement statuses in `spec.json` are marked done while task files and task metadata still report pending work. This is a cross-file state inconsistency between requirement completion and task completion.
**Suggestion:** Make task files the canonical task-status source and derive summary status from them, or update `spec.json` and `tasks/T-*.md` together through one generation path.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
