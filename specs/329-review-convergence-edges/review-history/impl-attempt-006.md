# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Remove Redundant Numbering From Finding Title
**Finding key:** loop-f1adf1a8ff9ae5c28edb
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft-review-questions.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/draft-review-questions.json`  
**Requirement:** R1  
**Issue:** The `repairTargets[0].title` value includes an ordinal prefix (`"1. Empty QA List"`). Since the finding already lives inside an ordered array, embedding numbering in the title duplicates structure and can become stale if entries are reordered.  
**Suggestion:** Change the title to `"Empty QA List"` and let presentation/reporting layers handle numbering.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft-review-questions.json`  
**Requirement:** R1  
**Issue:** The `repairTargets[0].title` value includes an ordinal prefix (`"1. Empty QA List"`). Since the finding already lives inside an ordered array, embedding numbering in the title duplicates structure and can become stale if entries are reordered.  
**Suggestion:** Change the title to `"Empty QA List"` and let presentation/reporting layers handle numbering.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Consolidate Repeated Attempt Invariants
**Finding key:** loop-d67eed9c517bb2b03d55
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft.json
**Requirement:** R2
**Issue:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R2  
**Issue:** The review attempt limits are repeated across `analysis.proposedApproach`, `analysis.validation`, `decisionMap.knownFacts`, `decisionMap.resolvedByProjectRules`, and `scopeVerification.out`, increasing the chance that future edits update one copy but not the others.  
**Suggestion:** Define the semantic/tooling attempt invariants once in the most authoritative section, then refer back to that invariant elsewhere instead of restating every phase count.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R2  
**Issue:** The review attempt limits are repeated across `analysis.proposedApproach`, `analysis.validation`, `decisionMap.knownFacts`, `decisionMap.resolvedByProjectRules`, and `scopeVerification.out`, increasing the chance that future edits update one copy but not the others.  
**Suggestion:** Define the semantic/tooling attempt invariants once in the most authoritative section, then refer back to that invariant elsewhere instead of restating every phase count.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Reduce Duplicate Finding Identity Criteria
**Finding key:** loop-f90b306b8358997094b2
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R1  
**Issue:** The finding identity tuple requirements are duplicated in `analysis.proposedApproach`, `decisionMap.decisionPoints`, and `decisionMap.deferredToSpec` with nearly identical wording.  
**Suggestion:** Keep the full canonical identity definition in `deferredToSpec`, and shorten the earlier mentions to a reference such as “use the canonical finding identity defined in deferredToSpec.”
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R1  
**Issue:** The finding identity tuple requirements are duplicated in `analysis.proposedApproach`, `decisionMap.decisionPoints`, and `decisionMap.deferredToSpec` with nearly identical wording.  
**Suggestion:** Keep the full canonical identity definition in `deferredToSpec`, and shorten the earlier mentions to a reference such as “use the canonical finding identity defined in deferredToSpec.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Simplify Repeated Scope/Handoff Language
**Finding key:** loop-86ae54680eed20e53e7a
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft.json
**Requirement:** R4
**Issue:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R4  
**Issue:** Flow-level and task-level review scope behavior is described multiple times in `analysis.validation`, `decisionMap.decisionPoints`, `decisionMap.deferredToSpec`, `scopeVerification.in`, and `impactOnExisting`. The repeated phrasing makes the design harder to scan.  
**Suggestion:** Extract the flow/task lifecycle invariant into one concise canonical statement, then reference it from validation and impact sections.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R4  
**Issue:** Flow-level and task-level review scope behavior is described multiple times in `analysis.validation`, `decisionMap.decisionPoints`, `decisionMap.deferredToSpec`, `scopeVerification.in`, and `impactOnExisting`. The repeated phrasing makes the design harder to scan.  
**Suggestion:** Extract the flow/task lifecycle invariant into one concise canonical statement, then reference it from validation and impact sections.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 4. Rename Ambiguous QA Evidence Field
**Finding key:** loop-eadb0809abb4247b88cb
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft.json
**Requirement:** R5
**Issue:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R5  
**Issue:** In `qa[0]`, the `evidence` field mixes source provenance with a statement of what the evidence proves. That makes the field less precise than nearby fields like `why` and `considered`.  
**Suggestion:** Rename or split the field into a clearer structure such as `sourceEvidence` and `evidenceSummary`, if the surrounding spec schema allows it. If the schema is fixed, rewrite the value to lead with the concrete source and keep interpretation in `why`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R5  
**Issue:** In `qa[0]`, the `evidence` field mixes source provenance with a statement of what the evidence proves. That makes the field less precise than nearby fields like `why` and `considered`.  
**Suggestion:** Rename or split the field into a clearer structure such as `sourceEvidence` and `evidenceSummary`, if the surrounding spec schema allows it. If the schema is fixed, rewrite the value to lead with the concrete source and keep interpretation in `why`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 5. Remove Empty Placeholder Fields When Optional
**Finding key:** loop-733278f6890a150de444
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/draft.json
**Requirement:** R6
**Issue:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R6  
**Issue:** `requiresUserJudgment`, `openQuestions`, and `qa[0].droppedReason` are empty placeholders. If these fields are optional, they add noise without carrying information.  
**Suggestion:** Omit optional empty arrays/strings from the draft, or standardize on a single explicit marker if the schema requires them.
**Suggestion:** **File:** `specs/329-review-convergence-edges/draft.json`  
**Requirement:** R6  
**Issue:** `requiresUserJudgment`, `openQuestions`, and `qa[0].droppedReason` are empty placeholders. If these fields are optional, they add noise without carrying information.  
**Suggestion:** Omit optional empty arrays/strings from the draft, or standardize on a single explicit marker if the schema requires them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Remove Generated Runtime State From The Change Set
**Finding key:** loop-86bd7ea30d2e5d8f0ffa
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** The new file is a 2,500-line generated flow/runtime snapshot containing timestamps, run IDs, metrics, retry history, evidence digests, and transient step state. This adds noisy, non-source data that will churn on every run and makes reviews harder.  
**Suggestion:** Do not commit `flow.json` as part of the implementation diff unless it is an intentional source artifact. If it must remain, reduce it to stable declarative fields only and exclude runtime logs, metrics, evidence history, retry recovery records, and timestamps.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** The new file is a 2,500-line generated flow/runtime snapshot containing timestamps, run IDs, metrics, retry history, evidence digests, and transient step state. This adds noisy, non-source data that will churn on every run and makes reviews harder.  
**Suggestion:** Do not commit `flow.json` as part of the implementation diff unless it is an intentional source artifact. If it must remain, reduce it to stable declarative fields only and exclude runtime logs, metrics, evidence history, retry recovery records, and timestamps.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Collapse Repeated Recovery Baseline Entries
**Finding key:** loop-8aef17166d96a14ed31c
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** `reviewRecoveryBaselines` contains multiple near-identical entries with the same `kind`, `phase`, `canonicalPhase`, `trigger`, fingerprint hash, paths, and component hashes, differing mostly by `createdAt`. This duplicates state and obscures the meaningful recovery events.  
**Suggestion:** Store one baseline per unique recovery fingerprint and track repeated occurrences with a compact counter or timestamp list, for example `occurrences: 5` and `lastSeenAt`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** `reviewRecoveryBaselines` contains multiple near-identical entries with the same `kind`, `phase`, `canonicalPhase`, `trigger`, fingerprint hash, paths, and component hashes, differing mostly by `createdAt`. This duplicates state and obscures the meaningful recovery events.  
**Suggestion:** Store one baseline per unique recovery fingerprint and track repeated occurrences with a compact counter or timestamp list, for example `occurrences: 5` and `lastSeenAt`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Bound Runtime History Arrays
**Finding key:** loop-b5537201d779d5d54289
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewConvergence.records[].evidenceHistory`, and `reviewRecoveryBaselines` can grow without an explicit visible cap in this artifact. That conflicts with the bounded-resource-usage guardrail because repeated reviews/retries can make the file grow indefinitely.  
**Suggestion:** Add or enforce explicit retention bounds in this persisted state, such as keeping only the latest N metrics per phase, latest N attempts per step, and latest N evidence history entries per convergence record. If the unbounded history is intentional, add a matched spec acknowledgment rationale for `bounded-resource-usage`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** Arrays such as `metrics`, `stepAttempts`, `reviewConvergence.records[].evidenceHistory`, and `reviewRecoveryBaselines` can grow without an explicit visible cap in this artifact. That conflicts with the bounded-resource-usage guardrail because repeated reviews/retries can make the file grow indefinitely.  
**Suggestion:** Add or enforce explicit retention bounds in this persisted state, such as keeping only the latest N metrics per phase, latest N attempts per step, and latest N evidence history entries per convergence record. If the unbounded history is intentional, add a matched spec acknowledgment rationale for `bounded-resource-usage`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 4. Normalize Repeated Fingerprint Path Lists
**Finding key:** loop-1badc490440cddf63f2d
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/flow.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** The same `fingerprint.paths` list is repeated across several recovery baseline objects. This makes the file larger and increases the chance of inconsistent edits if the structure is ever manually inspected or repaired.  
**Suggestion:** Deduplicate repeated path sets by storing named fingerprint objects once and referencing them by digest/hash from recovery entries.
**Suggestion:** **File:** `specs/329-review-convergence-edges/flow.json`  
**Requirement:** R7  
**Issue:** The same `fingerprint.paths` list is repeated across several recovery baseline objects. This makes the file larger and increases the chance of inconsistent edits if the structure is ever manually inspected or repaired.  
**Suggestion:** Deduplicate repeated path sets by storing named fingerprint objects once and referencing them by digest/hash from recovery entries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 1. Collapse repeated gate observations
**Finding key:** loop-2e6fa9f319e2e74eee55
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat nearly identical `project-test-integrity` observations for T-3 task-gate attempts, especially around `2026-07-24T15:32:00Z` through `2026-07-24T15:37:07Z`. This makes the issue log noisy and harder to review without adding distinct diagnostic value.  
**Suggestion:** Replace repeated per-attempt prose with one summarized entry that lists the affected attempt numbers, or store repeated observations as a compact structured array such as `attempts: [1, 2, 3, 4]` with one shared reason.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** Several entries repeat nearly identical `project-test-integrity` observations for T-3 task-gate attempts, especially around `2026-07-24T15:32:00Z` through `2026-07-24T15:37:07Z`. This makes the issue log noisy and harder to review without adding distinct diagnostic value.  
**Suggestion:** Replace repeated per-attempt prose with one summarized entry that lists the affected attempt numbers, or store repeated observations as a compact structured array such as `attempts: [1, 2, 3, 4]` with one shared reason.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 2. Add an explicit retention or size bound
**Finding key:** loop-e031b745a940e808a4ae
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** The `entries` array is an append-only bulk log with no visible cap, retention policy, truncation marker, or rollover strategy. This risks violating the `bounded-resource-usage` guardrail as future retries and gate loops can grow the file indefinitely.  
**Suggestion:** Add explicit bounded-log metadata or enforce a documented cap, for example `maxEntries`, `maxEntriesPerStep`, or a rollover/truncation record that preserves the latest actionable entries while bounding total log size.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** The `entries` array is an append-only bulk log with no visible cap, retention policy, truncation marker, or rollover strategy. This risks violating the `bounded-resource-usage` guardrail as future retries and gate loops can grow the file indefinitely.  
**Suggestion:** Add explicit bounded-log metadata or enforce a documented cap, for example `maxEntries`, `maxEntriesPerStep`, or a rollover/truncation record that preserves the latest actionable entries while bounding total log size.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 3. Normalize duplicated identifier fields
**Finding key:** loop-39e8b11c4c9197765f2d
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** `retry-recovery` entries contain both `grantId` and `id` with the same value, while other entries use `issueLogId`. This creates redundant identity fields and inconsistent naming across entry types.  
**Suggestion:** Keep one canonical identifier field for all entries, preferably `issueLogId`, or document and enforce a clear distinction if `grantId` is semantically different from the log entry ID.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue-log.json`  
**Requirement:** R7  
**Issue:** `retry-recovery` entries contain both `grantId` and `id` with the same value, while other entries use `issueLogId`. This creates redundant identity fields and inconsistent naming across entry types.  
**Suggestion:** Keep one canonical identifier field for all entries, preferably `issueLogId`, or document and enforce a clear distinction if `grantId` is semantically different from the log entry ID.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Add a Final Newline
**Finding key:** loop-b9fedea8ea8a274928ce
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue.md
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue.md`  
**Requirement:** R7  
**Issue:** The file ends without a trailing newline, which is inconsistent with common Markdown/source formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a newline at the end of the file.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue.md`  
**Requirement:** R7  
**Issue:** The file ends without a trailing newline, which is inconsistent with common Markdown/source formatting conventions and can create noisy diffs later.  
**Suggestion:** Add a newline at the end of the file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Replace Vague Test Target With Concrete Paths Or Patterns
**Finding key:** loop-81a62905a56cef260031
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue.md
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue.md`  
**Requirement:** R7  
**Issue:** The “Main Targets” list uses `focused review/convergence tests`, which is less actionable than the surrounding concrete file paths.  
**Suggestion:** Replace it with specific test file paths or a clear pattern, for example `test/**/review-convergence*.test.js`, matching the project’s actual test layout.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue.md`  
**Requirement:** R7  
**Issue:** The “Main Targets” list uses `focused review/convergence tests`, which is less actionable than the surrounding concrete file paths.  
**Suggestion:** Replace it with specific test file paths or a clear pattern, for example `test/**/review-convergence*.test.js`, matching the project’s actual test layout.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Consolidate Repeated Boundary Summary
**Finding key:** loop-1bfc3426dc5b0d891f20
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/issue.md
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/issue.md`  
**Requirement:** R7  
**Issue:** The three boundary problems are listed once under “Remaining Inconsistencies” and then repeated in shorter form under “Problem”. This adds duplication without much extra detail.  
**Suggestion:** Keep the detailed numbered list and simplify “Problem” to reference those boundaries directly, reducing maintenance drift if the scope changes.
**Suggestion:** **File:** `specs/329-review-convergence-edges/issue.md`  
**Requirement:** R7  
**Issue:** The three boundary problems are listed once under “Remaining Inconsistencies” and then repeated in shorter form under “Problem”. This adds duplication without much extra detail.  
**Suggestion:** Keep the detailed numbered list and simplify “Problem” to reference those boundaries directly, reducing maintenance drift if the scope changes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Remove duplicated issue identifier
**Finding key:** loop-794361eca61a89f1f9ef
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/plugin-artifacts/workflow/prepare.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The issue number is stored twice as `issue` and `result.issueNumber`, both with value `453`. This creates avoidable duplication and a risk of inconsistent artifact data if one field changes without the other.  
**Suggestion:** Keep a single source of truth for the issue number if the artifact schema allows it. For example, retain only the top-level `issue`, or only `result.issueNumber`, depending on the expected consumer contract.
**Suggestion:** **File:** `specs/329-review-convergence-edges/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R1  
**Issue:** The issue number is stored twice as `issue` and `result.issueNumber`, both with value `453`. This creates avoidable duplication and a risk of inconsistent artifact data if one field changes without the other.  
**Suggestion:** Keep a single source of truth for the issue number if the artifact schema allows it. For example, retain only the top-level `issue`, or only `result.issueNumber`, depending on the expected consumer contract.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Remove duplicated finding data
**Finding key:** loop-2eac2e7d7037e00f0d95
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** The same repair target is represented twice: once in `repairTargets[]` and again in `findings[]`, with duplicated `title`, `rationale/body`, `sourceArtifact`, and `attempt` data. This increases drift risk if one copy changes independently.  
**Suggestion:** Keep a single canonical representation, or make `findings[]` reference the `repairTargets[]` entry by ID instead of duplicating the full content.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R1  
**Issue:** The same repair target is represented twice: once in `repairTargets[]` and again in `findings[]`, with duplicated `title`, `rationale/body`, `sourceArtifact`, and `attempt` data. This increases drift risk if one copy changes independently.  
**Suggestion:** Keep a single canonical representation, or make `findings[]` reference the `repairTargets[]` entry by ID instead of duplicating the full content.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Align severity with repair-target classification
**Finding key:** loop-7bdd5c8ecb1f1be8718f
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json
**Requirement:** R2
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R2  
**Issue:** `blockingFindings` is empty and the summary says `0 blocking`, but `findings[0].severity` is `"blocking"` while `category` is `"repair_target"`. This makes the artifact internally inconsistent.  
**Suggestion:** Use a repair-target-specific severity/status value, or include the item under `blockingFindings` if it is truly blocking. The summary, categorized arrays, and normalized `findings[]` entry should agree.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-001.json`  
**Requirement:** R2  
**Issue:** `blockingFindings` is empty and the summary says `0 blocking`, but `findings[0].severity` is `"blocking"` while `category` is `"repair_target"`. This makes the artifact internally inconsistent.  
**Suggestion:** Use a repair-target-specific severity/status value, or include the item under `blockingFindings` if it is truly blocking. The summary, categorized arrays, and normalized `findings[]` entry should agree.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 1. Avoid Duplicating Finding Details
**Finding key:** loop-b5904a5cf9ee177f3a47
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/review-history/draft-questions-attempt-002.json
**Requirement:** R1
**Issue:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-002.json`  
**Requirement:** R1  
**Issue:** The same finding is represented twice: once in `repairTargets` and again in `findings`, with duplicated `title`, `target`, `evidence`, `rationale`, `sourceArtifact`, and `attempt` data. This increases drift risk if one copy is updated later.  
**Suggestion:** Store the finding once in `findings` and have `repairTargets` reference it by `findingId`, or derive `repairTargets` from `findings` where `category` is `repair_target`.
**Suggestion:** **File:** `specs/329-review-convergence-edges/review-history/draft-questions-attempt-002.json`  
**Requirement:** R1  
**Issue:** The same finding is represented twice: once in `repairTargets` and again in `findings`, with duplicated `title`, `target`, `evidence`, `rationale`, `sourceArtifact`, and `attempt` data. This increases drift risk if one copy is updated later.  
**Suggestion:** Store the finding once in `findings` and have `repairTargets` reference it by `findingId`, or derive `repairTargets` from `findings` where `category` is `repair_target`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Consolidate Duplicate Overview Entries
**Finding key:** loop-05aee7d61a5d10dcf398
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules` and `overview.data_flow` contain overlapping pre-task Japanese entries and later `added_by_task` English entries describing the same responsibilities for `review.js`, `review-convergence.js`, `set-retry.js`, and `run-review.js`. This makes the spec harder to maintain and increases the chance of drift.  
**Suggestion:** Merge each duplicated module/data-flow description into a single canonical entry, preserving the `added_by_task` metadata only where it adds useful traceability.
**Suggestion:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** `overview.modules` and `overview.data_flow` contain overlapping pre-task Japanese entries and later `added_by_task` English entries describing the same responsibilities for `review.js`, `review-convergence.js`, `set-retry.js`, and `run-review.js`. This makes the spec harder to maintain and increases the chance of drift.  
**Suggestion:** Merge each duplicated module/data-flow description into a single canonical entry, preserving the `added_by_task` metadata only where it adds useful traceability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Normalize Task Status With Completed Requirements
**Finding key:** loop-7d446a099dae80cc6af0
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That creates conflicting lifecycle signals inside the same spec.  
**Suggestion:** Either mark `T-1`, `T-2`, and `T-3` as done if implementation is complete, or keep requirements non-done until the corresponding task completion state is updated.
**Suggestion:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That creates conflicting lifecycle signals inside the same spec.  
**Suggestion:** Either mark `T-1`, `T-2`, and `T-3` as done if implementation is complete, or keep requirements non-done until the corresponding task completion state is updated.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 3. Simplify Repeated Protected-Surface References
**Finding key:** loop-950830994e926430817a
**Failure mode:** refactor
**File:** specs/329-review-convergence-edges/spec.json
**Requirement:** R7
**Issue:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** Protected acceptance files and invariant constraints are repeated across `scope.out`, `constraints`, `requirements`, and task notes. The repetition is useful for emphasis but currently duplicates exact file lists and invariant language.  
**Suggestion:** Introduce one canonical protected-surface constraint entry and have related sections reference that constraint by concept, reducing maintenance overhead when the protected list changes.
**Suggestion:** **File:** `specs/329-review-convergence-edges/spec.json`  
**Requirement:** R7  
**Issue:** Protected acceptance files and invariant constraints are repeated across `scope.out`, `constraints`, `requirements`, and task notes. The repetition is useful for emphasis but currently duplicates exact file lists and invariant language.  
**Suggestion:** Introduce one canonical protected-surface constraint entry and have related sections reference that constraint by concept, reducing maintenance overhead when the protected list changes.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 1. Reuse The Existing Path Normalizer For Targets
**Finding key:** loop-6fd42df9391873ae4c34
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `this.target = normalizeTestReviewText(item.target, "GLOBAL").replaceAll("\\", "/")` duplicates part of the existing `normalizeReviewPath()` behavior but omits its backtick stripping. That makes test-review target normalization slightly inconsistent with the rest of review identity handling.  
**Suggestion:** Add a small `normalizeTestReviewTarget(value)` helper in this file that applies `normalizeTestReviewText(...)` and the same path normalization rules as `normalizeReviewPath(...)`, then use it in `TestReviewFinding`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R1  
**Issue:** `this.target = normalizeTestReviewText(item.target, "GLOBAL").replaceAll("\\", "/")` duplicates part of the existing `normalizeReviewPath()` behavior but omits its backtick stripping. That makes test-review target normalization slightly inconsistent with the rest of review identity handling.  
**Suggestion:** Add a small `normalizeTestReviewTarget(value)` helper in this file that applies `normalizeTestReviewText(...)` and the same path normalization rules as `normalizeReviewPath(...)`, then use it in `TestReviewFinding`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 2. Name The Canonical Tuple Construction
**Finding key:** loop-e5c21ff3b47a51ade98e
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R2
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** The fingerprint tuple is currently an inline positional array. The required tuple fields are important, but the ordering and meaning are implicit, making future edits more likely to accidentally add finding order, array index, or omit title/body fields.  
**Suggestion:** Extract the tuple creation into a helper such as `testReviewFindingCanonicalTuple(finding)` or `buildTestReviewFindingIdentityTuple(...)`, with clearly named local values for normalized target, kind/failureMode, title, and issue/improvement before calling `ReviewFindingFingerprint.fromCanonicalTuple(...)`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R2  
**Issue:** The fingerprint tuple is currently an inline positional array. The required tuple fields are important, but the ordering and meaning are implicit, making future edits more likely to accidentally add finding order, array index, or omit title/body fields.  
**Suggestion:** Extract the tuple creation into a helper such as `testReviewFindingCanonicalTuple(finding)` or `buildTestReviewFindingIdentityTuple(...)`, with clearly named local values for normalized target, kind/failureMode, title, and issue/improvement before calling `ReviewFindingFingerprint.fromCanonicalTuple(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 1. Centralize SHA-256 fingerprint creation
**Finding key:** loop-9ced8b335f8948dc1ba6
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `fromFinding` and `fromCanonicalTuple` duplicate the same `crypto.createHash("sha256").update(stableStringify(...)).digest("hex")` sequence.  
**Suggestion:** Extract a private helper such as `fingerprintValue(value)` or `digestStableValue(value)` and have both static constructors call it. This keeps the hashing pattern consistent and reduces future drift.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `fromFinding` and `fromCanonicalTuple` duplicate the same `crypto.createHash("sha256").update(stableStringify(...)).digest("hex")` sequence.  
**Suggestion:** Extract a private helper such as `fingerprintValue(value)` or `digestStableValue(value)` and have both static constructors call it. This keeps the hashing pattern consistent and reduces future drift.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Enforce canonical tuple shape explicitly
**Finding key:** loop-7dd59b67e7006eabe474
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `fromCanonicalTuple(values)` accepts any non-empty string array, but the requirement defines a specific canonical tuple: normalized target, finding kind or failureMode, title, and issue or improvement. Accepting arbitrary lengths makes incorrect tuple construction harder to catch.  
**Suggestion:** Validate the expected tuple arity, or name/deconstruct the entries before hashing. For example, require exactly the fields used by the canonical tuple and throw a targeted error when the shape is wrong.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** `fromCanonicalTuple(values)` accepts any non-empty string array, but the requirement defines a specific canonical tuple: normalized target, finding kind or failureMode, title, and issue or improvement. Accepting arbitrary lengths makes incorrect tuple construction harder to catch.  
**Suggestion:** Validate the expected tuple arity, or name/deconstruct the entries before hashing. For example, require exactly the fields used by the canonical tuple and throw a targeted error when the shape is wrong.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Bound canonical tuple size
**Finding key:** loop-0f6b64b915a8fbfb261e
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** The new method hashes an arbitrary-length array with no upper bound, which conflicts with the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Add an explicit maximum tuple length, preferably the exact canonical tuple length required by R1. If the design intentionally allows optional fields, define a small named constant such as `MAX_FINDING_CANONICAL_TUPLE_FIELDS`.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R1  
**Issue:** The new method hashes an arbitrary-length array with no upper bound, which conflicts with the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Add an explicit maximum tuple length, preferably the exact canonical tuple length required by R1. If the design intentionally allows optional fields, define a small named constant such as `MAX_FINDING_CANONICAL_TUPLE_FIELDS`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 4. Normalize validated tuple values before hashing
**Finding key:** loop-229f9e250a9ec28af409
**Failure mode:** refactor
**File:** src/flow/lib/finding-disposition-policy.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** The validation checks `value.trim() === ""`, but hashes the original strings. That means semantically identical tuples with leading/trailing whitespace can produce different fingerprints.  
**Suggestion:** Convert to a normalized tuple before hashing, e.g. `const tuple = values.map((value) => value.trim())`, or route each field through the same canonical normalization used by the tuple builder.
**Suggestion:** **File:** `src/flow/lib/finding-disposition-policy.js`  
**Requirement:** R2  
**Issue:** The validation checks `value.trim() === ""`, but hashes the original strings. That means semantically identical tuples with leading/trailing whitespace can produce different fingerprints.  
**Suggestion:** Convert to a normalized tuple before hashing, e.g. `const tuple = values.map((value) => value.trim())`, or route each field through the same canonical normalization used by the tuple builder.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Avoid redundant cloning when replacing the recovered record
**Finding key:** loop-6c9d0feaf136e07d5a03
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `nextRecords` is already a cloned copy of every record, but `nextRecords[index]` clones `records[index]` again before merging the recovered state.  
**Suggestion:** Reuse the cloned record already present at `nextRecords[index]`:

```js
nextRecords[index] = {
  ...nextRecords[index],
  ...recovered.toJSON(),
};
```
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `nextRecords` is already a cloned copy of every record, but `nextRecords[index]` clones `records[index]` again before merging the recovered state.  
**Suggestion:** Reuse the cloned record already present at `nextRecords[index]`:

```js
nextRecords[index] = {
  ...nextRecords[index],
  ...recovered.toJSON(),
};
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 2. Add an explicit bound for recovery record scans
**Finding key:** loop-6243e61d5f7555338a7e
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** The new recovery mutation scans and clones all convergence records with `findIndex()` and `map()` without an explicit upper bound. This may violate the `bounded-resource-usage` guardrail if `reviewConvergence.records` can grow without a hard cap.  
**Suggestion:** Enforce or reuse a maximum convergence-record count before scanning/cloning, or route the mutation through an existing bounded helper if one exists in this file.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** The new recovery mutation scans and clones all convergence records with `findIndex()` and `map()` without an explicit upper bound. This may violate the `bounded-resource-usage` guardrail if `reviewConvergence.records` can grow without a hard cap.  
**Suggestion:** Enforce or reuse a maximum convergence-record count before scanning/cloning, or route the mutation through an existing bounded helper if one exists in this file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 3. Rename `expectedHasIssue` for clearer guard semantics
**Finding key:** loop-0c3dbf3c8cf6160a535c
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `expectedHasIssue` is derived from whether `expectedIssue` was supplied, but the name can read like a business-state expectation rather than an object-shape guard.  
**Suggestion:** Rename it to something more precise, such as `expectedIssuePresent`, `expectedIssueWasProvided`, or `expectsIssueProperty`, so the subsequent `Object.hasOwn(flowState, "issue")` guard is easier to understand.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R4  
**Issue:** `expectedHasIssue` is derived from whether `expectedIssue` was supplied, but the name can read like a business-state expectation rather than an object-shape guard.  
**Suggestion:** Rename it to something more precise, such as `expectedIssuePresent`, `expectedIssueWasProvided`, or `expectsIssueProperty`, so the subsequent `Object.hasOwn(flowState, "issue")` guard is easier to understand.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 1. Extract Repeated Gate Diff Assembly
**Finding key:** loop-bf10bf645d1594cd99cb
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** The same `committed + uncommitted + untracked` assembly and `excludeGateLifecycleArtifactsFromGateDiff(..., state.spec)` call now appears in two places. This duplicates policy about which artifacts are ignored for gate review.  
**Suggestion:** Introduce a small helper, for example `buildReviewableGateDiff(committed, uncommitted, untracked, specPath)`, and use it in both call sites.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** The same `committed + uncommitted + untracked` assembly and `excludeGateLifecycleArtifactsFromGateDiff(..., state.spec)` call now appears in two places. This duplicates policy about which artifacts are ignored for gate review.  
**Suggestion:** Introduce a small helper, for example `buildReviewableGateDiff(committed, uncommitted, untracked, specPath)`, and use it in both call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Reuse Artifact Name Set
**Finding key:** loop-d73da0d058c3312ac277
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `isGateLifecycleArtifactForGate` hard-codes several exact lifecycle filenames as repeated `||` comparisons, while the regex handles only the patterned gate files. This is harder to scan and easier to miss when adding/removing lifecycle artifacts.  
**Suggestion:** Move exact filenames into a `Set`, e.g. `GATE_LIFECYCLE_ARTIFACTS`, and use `GATE_LIFECYCLE_ARTIFACTS.has(localPath) || gateArtifactRegex.test(localPath)`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `isGateLifecycleArtifactForGate` hard-codes several exact lifecycle filenames as repeated `||` comparisons, while the regex handles only the patterned gate files. This is harder to scan and easier to miss when adding/removing lifecycle artifacts.  
**Suggestion:** Move exact filenames into a `Set`, e.g. `GATE_LIFECYCLE_ARTIFACTS`, and use `GATE_LIFECYCLE_ARTIFACTS.has(localPath) || gateArtifactRegex.test(localPath)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 3. Consider Sharing Path Normalization Logic
**Finding key:** loop-43036d233ca2cc750949
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** The new `isGateLifecycleArtifactForGate` repeats path normalization patterns already present near related gate artifact helpers, such as converting separators and checking paths relative to the spec directory.  
**Suggestion:** Extract a small local helper for deriving the normalized path relative to the spec directory, then reuse it from the artifact predicates in this file. This keeps artifact classification consistent and reduces subtle divergence.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** The new `isGateLifecycleArtifactForGate` repeats path normalization patterns already present near related gate artifact helpers, such as converting separators and checking paths relative to the spec directory.  
**Suggestion:** Extract a small local helper for deriving the normalized path relative to the spec directory, then reuse it from the artifact predicates in this file. This keeps artifact classification consistent and reduces subtle divergence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Simplify redundant post-hook scope branching
**Finding key:** loop-f24538a6c535cefdb762
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope.forPostHook()` has two fallback branches that both return `new ReviewCompletionScope({ phase, taskId: null })`, making the `phase !== IMPL_REVIEW_PHASE` check redundant.  
**Suggestion:** Collapse the method to: return artifact `taskId` when explicitly present, otherwise return `{ phase, taskId: null }`.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R5  
**Issue:** `ReviewCompletionScope.forPostHook()` has two fallback branches that both return `new ReviewCompletionScope({ phase, taskId: null })`, making the `phase !== IMPL_REVIEW_PHASE` check redundant.  
**Suggestion:** Collapse the method to: return artifact `taskId` when explicitly present, otherwise return `{ phase, taskId: null }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Reduce repeated `completionScope.taskId` access in execution path
**Finding key:** loop-83d177b97366d05f8f16
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** `RunReviewCommand` repeatedly passes `completionScope.taskId` through several nearby calls, which makes the execution scope harder to scan and increases the chance of future inconsistencies.  
**Suggestion:** Introduce a local `const completionTaskId = completionScope.taskId;` after `completionScope` is created, then use that consistently for canonical block creation, failure envelopes, finalization, tooling persistence, and parsed artifacts.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** `RunReviewCommand` repeatedly passes `completionScope.taskId` through several nearby calls, which makes the execution scope harder to scan and increases the chance of future inconsistencies.  
**Suggestion:** Introduce a local `const completionTaskId = completionScope.taskId;` after `completionScope` is created, then use that consistently for canonical block creation, failure envelopes, finalization, tooling persistence, and parsed artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 1. Extract shared review convergence record lookup
**Finding key:** loop-4e4a35daff26fd8b09cc
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `unchangedReviewConvergenceTarget` and `reviewToolingRecoveryMutation` duplicate the same `records` normalization, phase/task filtering, and “latest matching record” selection. This makes the changed-tree recovery path easier to drift, especially because R4 depends on the CAS mutation using the same target record that was checked.  
**Suggestion:** Add a helper such as `latestReviewConvergenceRecord(flowState, phase, taskId)` and use it in both functions. That keeps the same phase/task selection logic in one place.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `unchangedReviewConvergenceTarget` and `reviewToolingRecoveryMutation` duplicate the same `records` normalization, phase/task filtering, and “latest matching record” selection. This makes the changed-tree recovery path easier to drift, especially because R4 depends on the CAS mutation using the same target record that was checked.  
**Suggestion:** Add a helper such as `latestReviewConvergenceRecord(flowState, phase, taskId)` and use it in both functions. That keeps the same phase/task selection logic in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 2. Avoid resolving the current tree SHA twice
**Finding key:** loop-d412e55df0b26ecca9c9
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** The current review tree SHA is resolved separately in `unchangedReviewConvergenceTarget` and again in `reviewToolingRecoveryMutation`. If this operation is non-trivial or can observe changing state, the retry rejection check and recovery mutation may be based on different values.  
**Suggestion:** Resolve `currentTreeSha` once in `execute` for review retries and pass it into both helpers, or have a single helper return the selected record plus current tree SHA.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R3  
**Issue:** The current review tree SHA is resolved separately in `unchangedReviewConvergenceTarget` and again in `reviewToolingRecoveryMutation`. If this operation is non-trivial or can observe changing state, the retry rejection check and recovery mutation may be based on different values.  
**Suggestion:** Resolve `currentTreeSha` once in `execute` for review retries and pass it into both helpers, or have a single helper return the selected record plus current tree SHA.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 3. Clarify task ID naming around nullable scope
**Finding key:** loop-58677e3e32b9dc0af8b5
**Failure mode:** refactor
**File:** src/flow/lib/set-retry.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `reviewRecoveryTaskId` returns either a task id or `null`, but the name reads like it always returns an ID. Since `null` is semantically meaningful for flow/broad review convergence records, the current name hides an important distinction.  
**Suggestion:** Rename it to something like `resolveReviewRecoveryTaskId` or `resolveReviewConvergenceTaskId`, and consider a short local variable name such as `reviewConvergenceTaskId` instead of `reviewTaskId` in `execute`. This makes the guarded phase/task matching intent clearer.
**Suggestion:** **File:** `src/flow/lib/set-retry.js`  
**Requirement:** R4  
**Issue:** `reviewRecoveryTaskId` returns either a task id or `null`, but the name reads like it always returns an ID. Since `null` is semantically meaningful for flow/broad review convergence records, the current name hides an important distinction.  
**Suggestion:** Rename it to something like `resolveReviewRecoveryTaskId` or `resolveReviewConvergenceTaskId`, and consider a short local variable name such as `reviewConvergenceTaskId` instead of `reviewTaskId` in `execute`. This makes the guarded phase/task matching intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 1. Use an array for diff fixture composition
**Finding key:** loop-6bf30d1acaf96b42bbf9
**Failure mode:** refactor
**File:** tests/unit/flow/gate-diff-compaction.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R1  
**Issue:** The test builds the combined diff with chained string concatenation, which is harder to scan and easier to break when adding/removing fixtures.  
**Suggestion:** Replace `flowState + gateResult + testResult + specTest + implementation` with an array and `.join("")`, e.g. `[flowState, gateResult, testResult, specTest, implementation].join("")`.
**Suggestion:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R1  
**Issue:** The test builds the combined diff with chained string concatenation, which is harder to scan and easier to break when adding/removing fixtures.  
**Suggestion:** Replace `flowState + gateResult + testResult + specTest + implementation` with an array and `.join("")`, e.g. `[flowState, gateResult, testResult, specTest, implementation].join("")`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Rename `implementation` for consistency with evidence naming
**Finding key:** loop-8c30d566fdccd4658984
**Failure mode:** refactor
**File:** tests/unit/flow/gate-diff-compaction.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R2  
**Issue:** The test name says it retains “product and test evidence,” but the variable is named `implementation`, while the other variables are named by artifact type.  
**Suggestion:** Rename `implementation` to `productCode` or `productEvidence` to align with the assertion intent.
**Suggestion:** **File:** `tests/unit/flow/gate-diff-compaction.test.js`  
**Requirement:** R2  
**Issue:** The test name says it retains “product and test evidence,” but the variable is named `implementation`, while the other variables are named by artifact type.  
**Suggestion:** Rename `implementation` to `productCode` or `productEvidence` to align with the assertion intent.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
