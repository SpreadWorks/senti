# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Factor repeated manual-review rationale into shared fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** Multiple `acceptedRisk` entries repeat the same long rationale: the finding was valid at attempt 006, the current test SHA resolved it, and the only accepted risk is proceeding without another semantic review after 5 of 5 attempts. This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Add shared entry-level fields such as `currentTestSha`, `semanticAttemptsExhausted`, and `manualCompletionRisk`, then keep each finding’s `acceptedRisk` focused only on the finding-specific evidence and successor ownership.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** Multiple `acceptedRisk` entries repeat the same long rationale: the finding was valid at attempt 006, the current test SHA resolved it, and the only accepted risk is proceeding without another semantic review after 5 of 5 attempts. This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Add shared entry-level fields such as `currentTestSha`, `semanticAttemptsExhausted`, and `manualCompletionRisk`, then keep each finding’s `acceptedRisk` focused only on the finding-specific evidence and successor ownership.
**Rationale:** Loop review proposal.

### 2. 2. Shorten and structure the top-level reason
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` field is a very long prose blob containing several distinct facts: authority, failed tooling attempt, retry accounting, test counts, audit severity, semantic correction, and successor ownership. This reduces readability and makes future validation harder.  
**Suggestion:** Split the content into named fields or an array of concise rationale items, for example `authorityRationale`, `attemptHistory`, `testEvidence`, `auditSummary`, and `dispositionRationale`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` field is a very long prose blob containing several distinct facts: authority, failed tooling attempt, retry accounting, test counts, audit severity, semantic correction, and successor ownership. This reduces readability and makes future validation harder.  
**Suggestion:** Split the content into named fields or an array of concise rationale items, for example `authorityRationale`, `attemptHistory`, `testEvidence`, `auditSummary`, and `dispositionRationale`.
**Rationale:** Loop review proposal.

### 3. 3. Normalize repeated successor-owner wording
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** Successor ownership appears both in the structured `successorOwner` field and again in prose inside several `acceptedRisk` values. That duplicates the same responsibility assignment in two places.  
**Suggestion:** Treat `successorOwner` as the authoritative field and remove repeated ownership sentences from `acceptedRisk`, unless a finding needs extra context beyond the owner name.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** Successor ownership appears both in the structured `successorOwner` field and again in prose inside several `acceptedRisk` values. That duplicates the same responsibility assignment in two places.  
**Suggestion:** Treat `successorOwner` as the authoritative field and remove repeated ownership sentences from `acceptedRisk`, unless a finding needs extra context beyond the owner name.
**Rationale:** Loop review proposal.

### 4. 1. Factor repeated manual-review rationale into shared fields
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** Multiple `acceptedRisk` entries repeat the same long rationale: the finding was valid at attempt 006, the current test SHA resolved it, and the only accepted risk is proceeding without another semantic review after 5 of 5 attempts. This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Add shared entry-level fields such as `currentTestSha`, `semanticAttemptsExhausted`, and `manualCompletionRisk`, then keep each finding’s `acceptedRisk` focused only on the finding-specific evidence and successor ownership.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** Multiple `acceptedRisk` entries repeat the same long rationale: the finding was valid at attempt 006, the current test SHA resolved it, and the only accepted risk is proceeding without another semantic review after 5 of 5 attempts. This makes the override hard to review and easy to update inconsistently.  
**Suggestion:** Add shared entry-level fields such as `currentTestSha`, `semanticAttemptsExhausted`, and `manualCompletionRisk`, then keep each finding’s `acceptedRisk` focused only on the finding-specific evidence and successor ownership.
**Rationale:** Loop review proposal.

### 5. 2. Shorten and structure the top-level reason
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` field is a very long prose blob containing several distinct facts: authority, failed tooling attempt, retry accounting, test counts, audit severity, semantic correction, and successor ownership. This reduces readability and makes future validation harder.  
**Suggestion:** Split the content into named fields or an array of concise rationale items, for example `authorityRationale`, `attemptHistory`, `testEvidence`, `auditSummary`, and `dispositionRationale`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** The `reason` field is a very long prose blob containing several distinct facts: authority, failed tooling attempt, retry accounting, test counts, audit severity, semantic correction, and successor ownership. This reduces readability and makes future validation harder.  
**Suggestion:** Split the content into named fields or an array of concise rationale items, for example `authorityRationale`, `attemptHistory`, `testEvidence`, `auditSummary`, and `dispositionRationale`.
**Rationale:** Loop review proposal.

### 6. 3. Normalize repeated successor-owner wording
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/completion-overrides.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** Successor ownership appears both in the structured `successorOwner` field and again in prose inside several `acceptedRisk` values. That duplicates the same responsibility assignment in two places.  
**Suggestion:** Treat `successorOwner` as the authoritative field and remove repeated ownership sentences from `acceptedRisk`, unless a finding needs extra context beyond the owner name.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/completion-overrides.json`  
**Requirement:** R8  
**Issue:** Successor ownership appears both in the structured `successorOwner` field and again in prose inside several `acceptedRisk` values. That duplicates the same responsibility assignment in two places.  
**Suggestion:** Treat `successorOwner` as the authoritative field and remove repeated ownership sentences from `acceptedRisk`, unless a finding needs extra context beyond the owner name.
**Rationale:** Loop review proposal.

### 7. 1. Remove duplicated violation payload
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-gate-source.json
**Requirement:** R3
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R3  
**Issue:** The same violation object is duplicated in both `evaluations[0].observations[0]` and top-level `observations[0]`, including identical `kind`, `failureMode`, `requirementRef`, `where`, `observed`, `severity`, and `refs`. This creates maintenance risk if one copy changes and the other does not.  
**Suggestion:** Keep the canonical detailed observation in one place and have the other location reference it by `findingId` or a compact summary, if the schema allows. If both locations are required by downstream consumers, consider generating one from the other rather than storing two independent copies.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R3  
**Issue:** The same violation object is duplicated in both `evaluations[0].observations[0]` and top-level `observations[0]`, including identical `kind`, `failureMode`, `requirementRef`, `where`, `observed`, `severity`, and `refs`. This creates maintenance risk if one copy changes and the other does not.  
**Suggestion:** Keep the canonical detailed observation in one place and have the other location reference it by `findingId` or a compact summary, if the schema allows. If both locations are required by downstream consumers, consider generating one from the other rather than storing two independent copies.
**Rationale:** Loop review proposal.

### 8. 1. Remove duplicated violation payload
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-gate-source.json
**Requirement:** R3
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R3  
**Issue:** The same violation object is duplicated in both `evaluations[0].observations[0]` and top-level `observations[0]`, including identical `kind`, `failureMode`, `requirementRef`, `where`, `observed`, `severity`, and `refs`. This creates maintenance risk if one copy changes and the other does not.  
**Suggestion:** Keep the canonical detailed observation in one place and have the other location reference it by `findingId` or a compact summary, if the schema allows. If both locations are required by downstream consumers, consider generating one from the other rather than storing two independent copies.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-gate-source.json`  
**Requirement:** R3  
**Issue:** The same violation object is duplicated in both `evaluations[0].observations[0]` and top-level `observations[0]`, including identical `kind`, `failureMode`, `requirementRef`, `where`, `observed`, `severity`, and `refs`. This creates maintenance risk if one copy changes and the other does not.  
**Suggestion:** Keep the canonical detailed observation in one place and have the other location reference it by `findingId` or a compact summary, if the schema allows. If both locations are required by downstream consumers, consider generating one from the other rather than storing two independent copies.
**Rationale:** Loop review proposal.

### 9. 1. Remove redundant numbering from item titles
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-questions-repair.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-questions-repair.json`  
**Requirement:** R4  
**Issue:** Each `items[].title` embeds an ordinal like `"1. ..."`, duplicating the array order and making future insertions/reordering noisier.  
**Suggestion:** Store titles without numeric prefixes, e.g. `"TaskId contract is implementation-detail heavy"`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-questions-repair.json`  
**Requirement:** R4  
**Issue:** Each `items[].title` embeds an ordinal like `"1. ..."`, duplicating the array order and making future insertions/reordering noisier.  
**Suggestion:** Store titles without numeric prefixes, e.g. `"TaskId contract is implementation-detail heavy"`.
**Rationale:** Loop review proposal.

### 10. 2. Remove redundant numbering from item titles
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-questions-triage.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-questions-triage.json`  
**Requirement:** R4  
**Issue:** Each `items[].title` embeds an ordinal that duplicates the array position and can become stale if items are reordered.  
**Suggestion:** Drop the leading `"1. "`, `"2. "`, etc. from `title` values and rely on array order or `target` for identity.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-questions-triage.json`  
**Requirement:** R4  
**Issue:** Each `items[].title` embeds an ordinal that duplicates the array position and can become stale if items are reordered.  
**Suggestion:** Drop the leading `"1. "`, `"2. "`, etc. from `title` values and rely on array order or `target` for identity.
**Rationale:** Loop review proposal.

### 11. 1. Remove duplicated numbering from repair target titles
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-review-questions.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-review-questions.json`  
**Requirement:** R4  
**Issue:** Each `repairTargets[].title` embeds an ordinal like `"1. ..."`, duplicating the item’s position in the array. This makes the data harder to reorder or filter without stale numbering.  
**Suggestion:** Store titles without numeric prefixes, e.g. `"TaskId contract is implementation-detail heavy"`, and let renderers add numbering when displaying the list.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-review-questions.json`  
**Requirement:** R4  
**Issue:** Each `repairTargets[].title` embeds an ordinal like `"1. ..."`, duplicating the item’s position in the array. This makes the data harder to reorder or filter without stale numbering.  
**Suggestion:** Store titles without numeric prefixes, e.g. `"TaskId contract is implementation-detail heavy"`, and let renderers add numbering when displaying the list.
**Rationale:** Loop review proposal.

### 12. 1. Remove duplicated numbering from repair target titles
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-review-questions.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-review-questions.json`  
**Requirement:** R4  
**Issue:** Each `repairTargets[].title` embeds an ordinal like `"1. ..."`, duplicating the item’s position in the array. This makes the data harder to reorder or filter without stale numbering.  
**Suggestion:** Store titles without numeric prefixes, e.g. `"TaskId contract is implementation-detail heavy"`, and let renderers add numbering when displaying the list.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-review-questions.json`  
**Requirement:** R4  
**Issue:** Each `repairTargets[].title` embeds an ordinal like `"1. ..."`, duplicating the item’s position in the array. This makes the data harder to reorder or filter without stale numbering.  
**Suggestion:** Store titles without numeric prefixes, e.g. `"TaskId contract is implementation-detail heavy"`, and let renderers add numbering when displaying the list.
**Rationale:** Loop review proposal.

### 13. 1. Add an Explicit Task Count Bound
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` validates duplicate IDs and parent references, but the draft does not clearly require an upper bound for task collection size. That leaves bulk task validation/rendering underspecified against the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit max task count requirement, ideally reusing the existing schema limit if one exists, and require render/view/sync to reject collections above that bound before writing.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R2  
**Issue:** `TaskCollection` validates duplicate IDs and parent references, but the draft does not clearly require an upper bound for task collection size. That leaves bulk task validation/rendering underspecified against the `bounded-resource-usage` guardrail.  
**Suggestion:** Add an explicit max task count requirement, ideally reusing the existing schema limit if one exists, and require render/view/sync to reject collections above that bound before writing.
**Rationale:** Loop review proposal.

### 14. 2. Deduplicate Migration Parity Mapping Text
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R6
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R6  
**Issue:** The `knownFacts` section repeats the same ownership mapping for `TaskCollection`, `TaskOutputPath`, and `SpecRenderContext` across `runSpecRender`, `renderSpecView`, and `syncSpecTasksToFlow`.  
**Suggestion:** Replace the repeated prose with a compact mapping table/object keyed by consumer, with shared value-object responsibilities stated once.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R6  
**Issue:** The `knownFacts` section repeats the same ownership mapping for `TaskCollection`, `TaskOutputPath`, and `SpecRenderContext` across `runSpecRender`, `renderSpecView`, and `syncSpecTasksToFlow`.  
**Suggestion:** Replace the repeated prose with a compact mapping table/object keyed by consumer, with shared value-object responsibilities stated once.
**Rationale:** Loop review proposal.

### 15. 3. Fix Regex Formatting Inconsistency
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings start inline code formatting for `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}` but do not close the backtick, making the requirement text harder to scan and easier to misread.  
**Suggestion:** Normalize every occurrence to a complete inline code span, for example `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` ``, and include the ending `$` if exact full-string matching is intended.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft.json`  
**Requirement:** R1  
**Issue:** Several strings start inline code formatting for `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}` but do not close the backtick, making the requirement text harder to scan and easier to misread.  
**Suggestion:** Normalize every occurrence to a complete inline code span, for example `` `^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$` ``, and include the ending `$` if exact full-string matching is intended.
**Rationale:** Loop review proposal.

### 16. 4. Remove Or Populate Empty Flow Planning Arrays
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/flow.json`  
**Requirement:** R8  
**Issue:** `requirements` and `tasks` are both empty even though the flow has progressed through spec, approval, test, and implementation phases. This creates dead or misleading state in the flow artifact.  
**Suggestion:** Either populate these arrays from the approved spec requirements/tasks or omit them if this flow format no longer uses them.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/flow.json`  
**Requirement:** R8  
**Issue:** `requirements` and `tasks` are both empty even though the flow has progressed through spec, approval, test, and implementation phases. This creates dead or misleading state in the flow artifact.  
**Suggestion:** Either populate these arrays from the approved spec requirements/tasks or omit them if this flow format no longer uses them.
**Rationale:** Loop review proposal.

### 17. 3. Remove Or Compress Volatile Attempt History
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/issue-log.json`  
**Requirement:** R8  
**Issue:** The log contains many long, highly repetitive historical entries describing intermediate review attempts, assertion counts, and retry mechanics. Much of this appears operational rather than durable issue evidence, making the file noisy and harder to review.  
**Suggestion:** Keep only durable final dispositions and source-relevant findings, or replace repeated attempt narratives with a compact summary entry that preserves final rationale, affected requirements, and evidence IDs.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue-log.json`  
**Requirement:** R8  
**Issue:** The log contains many long, highly repetitive historical entries describing intermediate review attempts, assertion counts, and retry mechanics. Much of this appears operational rather than durable issue evidence, making the file noisy and harder to review.  
**Suggestion:** Keep only durable final dispositions and source-relevant findings, or replace repeated attempt narratives with a compact summary entry that preserves final rationale, affected requirements, and evidence IDs.
**Rationale:** Loop review proposal.

### 18. 1. Add Explicit Task Count Bounds
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue.md
**Requirement:** R2
**Issue:** **File:** `specs/318-explicit-task-render-context/issue.md`  
**Requirement:** R2  
**Issue:** `TaskCollection` acceptance criteria require validating uniqueness and parent existence across the collection, but the issue does not state an explicit maximum collection size. This risks violating `bounded-resource-usage` because bulk validation could be interpreted as unbounded.  
**Suggestion:** Add a concrete upper bound, such as “render/sync must reject more than 200 tasks before per-task path construction or writes.”
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue.md`  
**Requirement:** R2  
**Issue:** `TaskCollection` acceptance criteria require validating uniqueness and parent existence across the collection, but the issue does not state an explicit maximum collection size. This risks violating `bounded-resource-usage` because bulk validation could be interpreted as unbounded.  
**Suggestion:** Add a concrete upper bound, such as “render/sync must reject more than 200 tasks before per-task path construction or writes.”
**Rationale:** Loop review proposal.

### 19. 2. Bound Path Planning Work Before Writes
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/issue.md
**Requirement:** R3
**Issue:** **File:** `specs/318-explicit-task-render-context/issue.md`  
**Requirement:** R3  
**Issue:** `TaskOutputPath` requires validating path confinement before the first write, but the issue does not cap how many output paths may be planned in one operation.  
**Suggestion:** State that path planning is limited by the same maximum task count and must reject over-limit inputs before allocating or resolving all output paths.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/issue.md`  
**Requirement:** R3  
**Issue:** `TaskOutputPath` requires validating path confinement before the first write, but the issue does not cap how many output paths may be planned in one operation.  
**Suggestion:** State that path planning is limited by the same maximum task count and must reject over-limit inputs before allocating or resolving all output paths.
**Rationale:** Loop review proposal.

### 20. 1. Consolidate duplicated review findings
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json`  
**Requirement:** R8  
**Issue:** The same five findings are represented twice: once under `repairTargets` and again under `findings`, with duplicated title/body/category metadata. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical findings list and derive the alternate view when needed, or reduce `repairTargets` to references containing only `target` plus finding `id`.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json`  
**Requirement:** R8  
**Issue:** The same five findings are represented twice: once under `repairTargets` and again under `findings`, with duplicated title/body/category metadata. This increases drift risk if one copy is updated without the other.  
**Suggestion:** Keep one canonical findings list and derive the alternate view when needed, or reduce `repairTargets` to references containing only `target` plus finding `id`.
**Rationale:** Loop review proposal.

### 21. 2. Shorten repeated render-planning constraints
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/spec.json
**Requirement:** R3
**Issue:** **File:** `specs/318-explicit-task-render-context/spec.json`  
**Requirement:** R3  
**Issue:** The same constraints appear repeatedly across `requirements`, `acceptance_criteria`, `tasks.acceptance`, and `tasks.implementation_notes`: exactly one path per task, bounded task counts, O(n) planning, and no pre-write side effects.  
**Suggestion:** Keep the precise normative wording in R3/R5, then make the task and AC text refer to those requirements instead of restating the full algorithmic contract multiple times.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/spec.json`  
**Requirement:** R3  
**Issue:** The same constraints appear repeatedly across `requirements`, `acceptance_criteria`, `tasks.acceptance`, and `tasks.implementation_notes`: exactly one path per task, bounded task counts, O(n) planning, and no pre-write side effects.  
**Suggestion:** Keep the precise normative wording in R3/R5, then make the task and AC text refer to those requirements instead of restating the full algorithmic contract multiple times.
**Rationale:** Loop review proposal.

### 22. 3. Rename ambiguous metadata fallback wording
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/spec.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/spec.json`  
**Requirement:** R4  
**Issue:** The phrase “selected-spec defaults” is used many times, but the actual values are only sometimes repeated inline. That name is slightly vague because it hides that the defaults are specifically `feature/<selected-directory>` and `User request`.  
**Suggestion:** Introduce a clearer term such as “standalone render metadata defaults” the first time it appears, define the two values once, and use that term consistently throughout the spec.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/spec.json`  
**Requirement:** R4  
**Issue:** The phrase “selected-spec defaults” is used many times, but the actual values are only sometimes repeated inline. That name is slightly vague because it hides that the defaults are specifically `feature/<selected-directory>` and `User request`.  
**Suggestion:** Introduce a clearer term such as “standalone render metadata defaults” the first time it appears, define the two values once, and use that term consistently throughout the spec.
**Rationale:** Loop review proposal.

### 23. 4. Remove stale “done” status from pre-implementation requirements
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/spec.json`  
**Requirement:** R8  
**Issue:** Every requirement is marked `"status": "done"` even though this file is the implementation spec and its tasks remain `"status": "pending"`. That creates inconsistent state inside the same artifact.  
**Suggestion:** Either remove `status` from requirements entirely or align it with the task lifecycle, for example using `"planned"` until implementation evidence exists.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/spec.json`  
**Requirement:** R8  
**Issue:** Every requirement is marked `"status": "done"` even though this file is the implementation spec and its tasks remain `"status": "pending"`. That creates inconsistent state inside the same artifact.  
**Suggestion:** Either remove `status` from requirements entirely or align it with the task lifecycle, for example using `"planned"` until implementation evidence exists.
**Rationale:** Loop review proposal.

### 24. 3. Remove Unused Function Parameters From Call Sites and API Shape
**Failure mode:** refactor
**File:** src/flow/lib/get-prompt.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/get-prompt.js`
**Requirement:** R4
**Issue:** The call site correctly removes `state`, but `renderSpecView` also removed `meta` from its signature. Any remaining callers in the touched API surface that still pass `meta` would now be silently ignored due to destructuring, which can hide dead/obsolete usage during migration.
**Suggestion:** Within the touched files, keep the API explicit by adding a defensive check for unsupported keys or by updating all known touched call sites to use the reduced shape. For example, destructure a single `options` object and reject `state`/`meta` if present, so callers do not assume ambient metadata is still honored.
**Suggestion:** **File:** `src/flow/lib/get-prompt.js`
**Requirement:** R4
**Issue:** The call site correctly removes `state`, but `renderSpecView` also removed `meta` from its signature. Any remaining callers in the touched API surface that still pass `meta` would now be silently ignored due to destructuring, which can hide dead/obsolete usage during migration.
**Suggestion:** Within the touched files, keep the API explicit by adding a defensive check for unsupported keys or by updating all known touched call sites to use the reduced shape. For example, destructure a single `options` object and reject `state`/`meta` if present, so callers do not assume ambient metadata is still honored.
**Rationale:** Loop review proposal.

### 25. 1. Avoid Double Validation Path for Preloaded Specs
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`
**Requirement:** R7
**Issue:** `renderSpecView` now skips `validateSpecJsonObject(currentSpec)` when a `spec` object is passed in. Since the old code rendered whatever `spec` it received after `loadSpecJson` validation in the non-preloaded case, this can preserve an internal invalid-spec path and make behavior depend on whether the caller passed `spec` or `specPath`.
**Suggestion:** Validate `currentSpec` unconditionally, or document and enforce that callers passing `spec` must provide an already validated object. A simple improvement is:
```js
const currentSpec = spec || loadSpecJson(specJsonPath, { validate: false });
validateSpecJsonObject(currentSpec);
```
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`
**Requirement:** R7
**Issue:** `renderSpecView` now skips `validateSpecJsonObject(currentSpec)` when a `spec` object is passed in. Since the old code rendered whatever `spec` it received after `loadSpecJson` validation in the non-preloaded case, this can preserve an internal invalid-spec path and make behavior depend on whether the caller passed `spec` or `specPath`.
**Suggestion:** Validate `currentSpec` unconditionally, or document and enforce that callers passing `spec` must provide an already validated object. A simple improvement is:
```js
const currentSpec = spec || loadSpecJson(specJsonPath, { validate: false });
validateSpecJsonObject(currentSpec);
```
**Rationale:** Loop review proposal.

### 26. 2. Rename `collection` to Clarify Domain
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/render-spec-view.js`
**Requirement:** R3
**Issue:** `collection` is generic and does not make it obvious that this is the validated task collection used to construct the render plan.
**Suggestion:** Rename it to `taskCollection` and pass that into `TaskRenderPlan`. This improves readability around the R3/R5 sequencing:
```js
const taskCollection = new TaskCollection(currentSpec.tasks ?? []);
...
collection: taskCollection,
```
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`
**Requirement:** R3
**Issue:** `collection` is generic and does not make it obvious that this is the validated task collection used to construct the render plan.
**Suggestion:** Rename it to `taskCollection` and pass that into `TaskRenderPlan`. This improves readability around the R3/R5 sequencing:
```js
const taskCollection = new TaskCollection(currentSpec.tasks ?? []);
...
collection: taskCollection,
```
**Rationale:** Loop review proposal.

### 27. 1. Validate schema before constructing `TaskCollection`
**Failure mode:** refactor
**File:** src/flow/lib/sync-spec-tasks.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/sync-spec-tasks.js`  
**Requirement:** R7  
**Issue:** `tryLoadSpecJson(..., { validate: false })` is followed by `new TaskCollection(spec.tasks ?? [])` before `validateSpecJsonObject(spec)`. If `TaskCollection` rejects malformed task data first, CLI/schema error reporting may differ from the existing schema validation path.  
**Suggestion:** Move `validateSpecJsonObject(spec)` immediately after loading `spec`, then construct `TaskCollection` from validated data.
**Suggestion:** **File:** `src/flow/lib/sync-spec-tasks.js`  
**Requirement:** R7  
**Issue:** `tryLoadSpecJson(..., { validate: false })` is followed by `new TaskCollection(spec.tasks ?? [])` before `validateSpecJsonObject(spec)`. If `TaskCollection` rejects malformed task data first, CLI/schema error reporting may differ from the existing schema validation path.  
**Suggestion:** Move `validateSpecJsonObject(spec)` immediately after loading `spec`, then construct `TaskCollection` from validated data.
**Rationale:** Loop review proposal.

### 28. 2. Centralize the task ID regex in the schema
**Failure mode:** refactor
**File:** src/flow/schemas/spec.schema.json
**Requirement:** R1
**Issue:** **File:** `src/flow/schemas/spec.schema.json`  
**Requirement:** R1  
**Issue:** The same task ID pattern is duplicated for `tasks[].id` and `tasks[].parent`. If the pattern changes later, one copy can drift from the other.  
**Suggestion:** Add a schema definition such as `$defs.taskId` and reference it from both `id` and `parent`, preserving the exact pattern string required by R1.
**Suggestion:** **File:** `src/flow/schemas/spec.schema.json`  
**Requirement:** R1  
**Issue:** The same task ID pattern is duplicated for `tasks[].id` and `tasks[].parent`. If the pattern changes later, one copy can drift from the other.  
**Suggestion:** Add a schema definition such as `$defs.taskId` and reference it from both `id` and `parent`, preserving the exact pattern string required by R1.
**Rationale:** Loop review proposal.

### 29. 1. Bound Recursive Schema Validation
**Failure mode:** refactor
**File:** src/lib/schema-validate.js
**Requirement:** R1
**Issue:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `validateSchema` recursively validates nested arrays/objects without an explicit depth or node-count limit, which violates `bounded-resource-usage` for recursive processing.  
**Suggestion:** Add internal validation options such as `maxDepth` and `maxNodes`, increment them through recursive calls, and return a schema error once either bound is exceeded.
**Suggestion:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `validateSchema` recursively validates nested arrays/objects without an explicit depth or node-count limit, which violates `bounded-resource-usage` for recursive processing.  
**Suggestion:** Add internal validation options such as `maxDepth` and `maxNodes`, increment them through recursive calls, and return a schema error once either bound is exceeded.
**Rationale:** Loop review proposal.

### 30. 2. Avoid Recompiling Pattern Regexes Per Value
**Failure mode:** refactor
**File:** src/lib/schema-validate.js
**Requirement:** R1
**Issue:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `new RegExp(schema.pattern)` is created on every string validation. This is small here, but it duplicates work and scatters pattern handling inside the hot validation path.  
**Suggestion:** Precompile schema regexes when loading the schema, or add a tiny helper/cache keyed by `schema.pattern` so repeated task IDs and parents reuse the same `RegExp`.
**Suggestion:** **File:** `src/lib/schema-validate.js`  
**Requirement:** R1  
**Issue:** `new RegExp(schema.pattern)` is created on every string validation. This is small here, but it duplicates work and scatters pattern handling inside the hot validation path.  
**Suggestion:** Precompile schema regexes when loading the schema, or add a tiny helper/cache keyed by `schema.pattern` so repeated task IDs and parents reuse the same `RegExp`.
**Rationale:** Loop review proposal.

### 31. 3. Extract Task Rendering Side-Effect Loop
**Failure mode:** refactor
**File:** src/spec/commands/render.js
**Requirement:** R3
**Issue:** **File:** `src/spec/commands/render.js`  
**Requirement:** R3  
**Issue:** `runSpecRender` now mixes render contract construction with the task file write loop, including directory creation, writes, and stdout formatting inline.  
**Suggestion:** Extract a local helper like `writeTaskRenderPlan({ taskPlan, tasksDir, root })` to keep `runSpecRender` focused on validation/context/plan construction and make the side-effect boundary easier to audit.
**Suggestion:** **File:** `src/spec/commands/render.js`  
**Requirement:** R3  
**Issue:** `runSpecRender` now mixes render contract construction with the task file write loop, including directory creation, writes, and stdout formatting inline.  
**Suggestion:** Extract a local helper like `writeTaskRenderPlan({ taskPlan, tasksDir, root })` to keep `runSpecRender` focused on validation/context/plan construction and make the side-effect boundary easier to audit.
**Rationale:** Loop review proposal.

### 32. 2. Collapse `TaskId` Validation to a Single Regex Check
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R1
**Issue:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R1
**Issue:** `TASK_ID_PATTERN` is already anchored with `^` and `$`, so `TASK_ID_PATTERN.exec(value)` plus `match[0] !== value` duplicates full-string validation logic.
**Suggestion:** Replace it with `if (typeof value !== "string" || !TASK_ID_PATTERN.test(value))`. This is simpler, matches the schema contract directly, and avoids carrying redundant match state.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R1
**Issue:** `TASK_ID_PATTERN` is already anchored with `^` and `$`, so `TASK_ID_PATTERN.exec(value)` plus `match[0] !== value` duplicates full-string validation logic.
**Suggestion:** Replace it with `if (typeof value !== "string" || !TASK_ID_PATTERN.test(value))`. This is simpler, matches the schema contract directly, and avoids carrying redundant match state.
**Rationale:** Loop review proposal.

### 33. 3. Name `ValidatedTask` Around Its Runtime Role
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R2
**Issue:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R2
**Issue:** `ValidatedTask` describes a past action rather than the object’s role. Since the class represents the normalized task record exposed by `TaskCollection`, the name is a little vague beside `TaskId`, `TaskOutputPath`, and `TaskRenderPlan`.
**Suggestion:** Rename it to `TaskEntry` or `TaskRecord`. That keeps the naming aligned with the other domain objects and makes constructor usage in `TaskCollection` read more naturally.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R2
**Issue:** `ValidatedTask` describes a past action rather than the object’s role. Since the class represents the normalized task record exposed by `TaskCollection`, the name is a little vague beside `TaskId`, `TaskOutputPath`, and `TaskRenderPlan`.
**Suggestion:** Rename it to `TaskEntry` or `TaskRecord`. That keeps the naming aligned with the other domain objects and makes constructor usage in `TaskCollection` read more naturally.
**Rationale:** Loop review proposal.

### 34. 4. Freeze the Lookup Map or Avoid Storing It Mutably
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R2
**Issue:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R2
**Issue:** `TaskCollection` freezes the instance and entries array, but `#byId` remains a mutable `Map`. Private fields prevent outside access, but the object’s internal validated lookup state is still mutable by class methods added later, which is inconsistent with the rest of the immutable design.
**Suggestion:** Either store a frozen plain object lookup created from the entries, or add a comment/utility boundary making `#byId` intentionally internal and never mutated after construction. A frozen lookup would better match the current design pattern.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R2
**Issue:** `TaskCollection` freezes the instance and entries array, but `#byId` remains a mutable `Map`. Private fields prevent outside access, but the object’s internal validated lookup state is still mutable by class methods added later, which is inconsistent with the rest of the immutable design.
**Suggestion:** Either store a frozen plain object lookup created from the entries, or add a comment/utility boundary making `#byId` intentionally internal and never mutated after construction. A frozen lookup would better match the current design pattern.
**Rationale:** Loop review proposal.

### 35. 5. Remove Redundant Path Escape Check in `TaskOutputPath`
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R3
**Issue:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R3
**Issue:** `TaskId` already rejects slash, backslash, dot-segment, drive-prefix, whitespace, and non-ASCII input through its strict pattern, so `path.dirname(candidate) !== resolvedTasksDir` is defensive but unreachable for valid `TaskId` values.
**Suggestion:** Keep the dirname check only if you want an explicit belt-and-suspenders invariant for R3, but document that it is intentional defense in depth. Otherwise, remove it to reduce dead-path logic and rely on `TaskId` as the single validation source.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R3
**Issue:** `TaskId` already rejects slash, backslash, dot-segment, drive-prefix, whitespace, and non-ASCII input through its strict pattern, so `path.dirname(candidate) !== resolvedTasksDir` is defensive but unreachable for valid `TaskId` values.
**Suggestion:** Keep the dirname check only if you want an explicit belt-and-suspenders invariant for R3, but document that it is intentional defense in depth. Otherwise, remove it to reduce dead-path logic and rely on `TaskId` as the single validation source.
**Rationale:** Loop review proposal.

### 36. 1. Avoid Repeated Markdown Normalization Logic in the Test Body
**Failure mode:** refactor
**File:** tests/unit/flow/run-update-overview.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/run-update-overview.test.js`
**Requirement:** R4
**Issue:** The determinism test now mixes three concerns inline: same-directory determinism, directory-specific fallback metadata, and cross-directory markdown normalization. The local `normalizeSelectedMeta` helper is specific but embedded inside the test, making the assertion flow harder to scan.
**Suggestion:** Move `normalizeSelectedMeta(markdown, basename)` to a small file-level helper near `makeFixture()`. That keeps the test focused on assertions and makes the selected-context metadata behavior easier to reuse if more render-context tests are added.
**Suggestion:** **File:** `tests/unit/flow/run-update-overview.test.js`
**Requirement:** R4
**Issue:** The determinism test now mixes three concerns inline: same-directory determinism, directory-specific fallback metadata, and cross-directory markdown normalization. The local `normalizeSelectedMeta` helper is specific but embedded inside the test, making the assertion flow harder to scan.
**Suggestion:** Move `normalizeSelectedMeta(markdown, basename)` to a small file-level helper near `makeFixture()`. That keeps the test focused on assertions and makes the selected-context metadata behavior easier to reuse if more render-context tests are added.
**Rationale:** Loop review proposal.

### 37. 1. Align Schema Validation Order Across Render Paths
**Failure mode:** refactor
**File:** src/flow/lib/render-spec-view.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/render-spec-view.js`
**Requirement:** R7
**Issue:** `renderSpecView` may skip schema validation when a preloaded `spec` is passed, while `sync-spec-tasks.js` constructs `TaskCollection` before schema validation. These two paths now have inconsistent validation sequencing and error behavior for the same spec/task contract.
**Suggestion:** Use one shared ordering everywhere: load or receive spec, run `validateSpecJsonObject(spec)`, then construct `TaskCollection` and render/sync plans. If prevalidated specs are allowed, make that explicit with an option name and enforce it consistently.
**Suggestion:** **File:** `src/flow/lib/render-spec-view.js`
**Requirement:** R7
**Issue:** `renderSpecView` may skip schema validation when a preloaded `spec` is passed, while `sync-spec-tasks.js` constructs `TaskCollection` before schema validation. These two paths now have inconsistent validation sequencing and error behavior for the same spec/task contract.
**Suggestion:** Use one shared ordering everywhere: load or receive spec, run `validateSpecJsonObject(spec)`, then construct `TaskCollection` and render/sync plans. If prevalidated specs are allowed, make that explicit with an option name and enforce it consistently.
**Rationale:** Loop review proposal.

### 38. 2. Centralize Task ID Pattern Across Schema, Spec Text, and Runtime
**Failure mode:** refactor
**File:** src/flow/schemas/spec.schema.json
**Requirement:** R1
**Issue:** **File:** `src/flow/schemas/spec.schema.json`
**Requirement:** R1
**Issue:** The task ID regex appears in multiple places: schema fields for `id` and `parent`, spec prose, and runtime `TASK_ID_PATTERN` handling in `render-contract.js`. The per-file reviews already show formatting drift in prose and duplicate schema definitions, which means the contract can diverge across files.
**Suggestion:** Define the pattern once in schema `$defs`, reference it for all schema fields, and ensure runtime/tests/spec prose either import or explicitly cite the same canonical pattern source.
**Suggestion:** **File:** `src/flow/schemas/spec.schema.json`
**Requirement:** R1
**Issue:** The task ID regex appears in multiple places: schema fields for `id` and `parent`, spec prose, and runtime `TASK_ID_PATTERN` handling in `render-contract.js`. The per-file reviews already show formatting drift in prose and duplicate schema definitions, which means the contract can diverge across files.
**Suggestion:** Define the pattern once in schema `$defs`, reference it for all schema fields, and ensure runtime/tests/spec prose either import or explicitly cite the same canonical pattern source.
**Rationale:** Loop review proposal.

### 39. 3. Normalize Task Collection Naming Across Callers and Domain Objects
**Failure mode:** refactor
**File:** src/spec/lib/render-contract.js
**Requirement:** R2
**Issue:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R2
**Issue:** The same concept is named unevenly across files: `collection` in `render-spec-view.js`, `TaskCollection` in the domain layer, and `ValidatedTask` for entries. This weakens the intended explicit task render context vocabulary.
**Suggestion:** Use consistent domain names such as `taskCollection` at call sites and rename `ValidatedTask` to `TaskEntry` or `TaskRecord` so the runtime API reads consistently with `TaskCollection`, `TaskId`, `TaskOutputPath`, and `TaskRenderPlan`.
**Suggestion:** **File:** `src/spec/lib/render-contract.js`
**Requirement:** R2
**Issue:** The same concept is named unevenly across files: `collection` in `render-spec-view.js`, `TaskCollection` in the domain layer, and `ValidatedTask` for entries. This weakens the intended explicit task render context vocabulary.
**Suggestion:** Use consistent domain names such as `taskCollection` at call sites and rename `ValidatedTask` to `TaskEntry` or `TaskRecord` so the runtime API reads consistently with `TaskCollection`, `TaskId`, `TaskOutputPath`, and `TaskRenderPlan`.
**Rationale:** Loop review proposal.

### 40. 4. Deduplicate Render Planning Constraints Between Spec Artifacts
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/spec.json
**Requirement:** R3
**Issue:** **File:** `specs/318-explicit-task-render-context/spec.json`
**Requirement:** R3
**Issue:** Render planning constraints are repeated across `spec.json`, `draft.json`, `issue.md`, and task acceptance notes: bounded task counts, one path per task, O(n) planning, path confinement before writes, and no side effects before validation. This creates cross-file drift risk as the requirement evolves.
**Suggestion:** Keep the normative contract in one canonical requirement section, then have related issue, draft, task, and acceptance entries reference that requirement by ID instead of restating the full behavior.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/spec.json`
**Requirement:** R3
**Issue:** Render planning constraints are repeated across `spec.json`, `draft.json`, `issue.md`, and task acceptance notes: bounded task counts, one path per task, O(n) planning, path confinement before writes, and no side effects before validation. This creates cross-file drift risk as the requirement evolves.
**Suggestion:** Keep the normative contract in one canonical requirement section, then have related issue, draft, task, and acceptance entries reference that requirement by ID instead of restating the full behavior.
**Rationale:** Loop review proposal.

### 41. 5. Use One Canonical Review Finding Representation
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json
**Requirement:** R8
**Issue:** **File:** `specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json`
**Requirement:** R8
**Issue:** Review findings and operational rationale are duplicated across several artifacts: `repairTargets` vs `findings`, top-level vs nested observations, repeated accepted-risk text, and repeated successor-owner prose. These are the same kinds of duplication spread across files, not isolated local issues.
**Suggestion:** Store canonical finding data once with stable IDs, and let summaries, repair targets, observations, and completion overrides reference those IDs plus only local disposition fields.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/review-history/draft-questions-attempt-001.json`
**Requirement:** R8
**Issue:** Review findings and operational rationale are duplicated across several artifacts: `repairTargets` vs `findings`, top-level vs nested observations, repeated accepted-risk text, and repeated successor-owner prose. These are the same kinds of duplication spread across files, not isolated local issues.
**Suggestion:** Store canonical finding data once with stable IDs, and let summaries, repair targets, observations, and completion overrides reference those IDs plus only local disposition fields.
**Rationale:** Loop review proposal.

### 42. 6. Normalize Numbered Review Titles Across Draft Review Files
**Failure mode:** refactor
**File:** specs/318-explicit-task-render-context/draft-questions-repair.json
**Requirement:** R4
**Issue:** **File:** `specs/318-explicit-task-render-context/draft-questions-repair.json`
**Requirement:** R4
**Issue:** Multiple draft review artifacts embed ordinal prefixes in title fields, including `draft-questions-repair.json`, `draft-questions-triage.json`, and `draft-review-questions.json`. This is a cross-file representation inconsistency because ordering is data structure metadata, not title content.
**Suggestion:** Remove numeric prefixes from all review title fields and rely on array order, IDs, or renderer-generated numbering consistently across these artifacts.
**Suggestion:** **File:** `specs/318-explicit-task-render-context/draft-questions-repair.json`
**Requirement:** R4
**Issue:** Multiple draft review artifacts embed ordinal prefixes in title fields, including `draft-questions-repair.json`, `draft-questions-triage.json`, and `draft-review-questions.json`. This is a cross-file representation inconsistency because ordering is data structure metadata, not title content.
**Suggestion:** Remove numeric prefixes from all review title fields and rely on array order, IDs, or renderer-generated numbering consistently across these artifacts.
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
