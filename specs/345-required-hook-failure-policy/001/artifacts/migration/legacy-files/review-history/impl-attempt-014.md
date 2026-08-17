# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 4. Remove Redundant Empty Repair Artifact When No Work Exists
**Finding key:** loop-a96a489dd51436920b68
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-coverage-repair.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-repair.json`  
**Requirement:** R1  
**Issue:** The file records only “No draft triage items to repair” with an empty `items` array. If this artifact is generated every time there is no repair work, it adds repository churn without carrying actionable state.  
**Suggestion:** Skip generating this file when `items` is empty, or replace it with a single shared status field in the preceding triage artifact if consumers need to know that repair was intentionally unnecessary.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-coverage-repair.json`  
**Requirement:** R1  
**Issue:** The file records only “No draft triage items to repair” with an empty `items` array. If this artifact is generated every time there is no repair work, it adds repository churn without carrying actionable state.  
**Suggestion:** Skip generating this file when `items` is empty, or replace it with a single shared status field in the preceding triage artifact if consumers need to know that repair was intentionally unnecessary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Deduplicate Repeated Guardrail Findings
**Finding key:** loop-7dc3ac4c919c0868a21c
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same `prioritize-requirements` failure appears multiple times with identical `findingId`, `fingerprint`, `reason`, `rationale`, and metadata, differing only by locator. This makes the gate source noisy and harder to review.  
**Suggestion:** Collapse identical findings into one entry per fingerprint and store all affected locators in a bounded array, e.g. `locations: [...]`, or ensure each repeated observation has a distinct fingerprint if it represents a separate actionable finding.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The same `prioritize-requirements` failure appears multiple times with identical `findingId`, `fingerprint`, `reason`, `rationale`, and metadata, differing only by locator. This makes the gate source noisy and harder to review.  
**Suggestion:** Collapse identical findings into one entry per fingerprint and store all affected locators in a bounded array, e.g. `locations: [...]`, or ensure each repeated observation has a distinct fingerprint if it represents a separate actionable finding.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Avoid Duplicating Full Finding Data Across Sections
**Finding key:** loop-f4d07e9843038325936e
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** `evaluations` and `observations` repeat much of the same information, including guardrail IDs, rationale, disposition, timestamps, and fingerprints. This creates two sources of truth inside the same artifact.  
**Suggestion:** Keep the canonical finding payload in one section and let the other section reference it by `findingId`/`fingerprint`, or reduce `observations` to location-level details while `evaluations` owns the finding summary.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** `evaluations` and `observations` repeat much of the same information, including guardrail IDs, rationale, disposition, timestamps, and fingerprints. This creates two sources of truth inside the same artifact.  
**Suggestion:** Keep the canonical finding payload in one section and let the other section reference it by `findingId`/`fingerprint`, or reduce `observations` to location-level details while `evaluations` owns the finding summary.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 3. Normalize Guardrail Field Naming
**Finding key:** loop-1f743a2e5b8c52d09fa5
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The artifact uses both `guardrail_id` and `guardrailId` for the same concept. This naming inconsistency increases parser complexity and invites drift.  
**Suggestion:** Use one field name consistently throughout the artifact. Since other camelCase fields exist (`findingId`, `requirementId`, `reportedAt`), prefer `guardrailId` unless an external schema explicitly requires `guardrail_id`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`  
**Requirement:** R1  
**Issue:** The artifact uses both `guardrail_id` and `guardrailId` for the same concept. This naming inconsistency increases parser complexity and invites drift.  
**Suggestion:** Use one field name consistently throughout the artifact. Since other camelCase fields exist (`findingId`, `requirementId`, `reportedAt`), prefer `guardrailId` unless an external schema explicitly requires `guardrail_id`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Remove duplicated bilingual requirement body
**Finding key:** loop-b1a7d2530f5e2599a233
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/issue.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R8  
**Issue:** The Japanese `<details>` section repeats the full Summary, Decision, Requirements, Scope, Out of Scope, Acceptance Criteria, and Evidence content already stated in English. This creates two authoritative copies that can drift during later edits.  
**Suggestion:** Keep one canonical requirements body and replace the Japanese section with a short localized summary or remove it if bilingual duplication is not required.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R8  
**Issue:** The Japanese `<details>` section repeats the full Summary, Decision, Requirements, Scope, Out of Scope, Acceptance Criteria, and Evidence content already stated in English. This creates two authoritative copies that can drift during later edits.  
**Suggestion:** Keep one canonical requirements body and replace the Japanese section with a short localized summary or remove it if bilingual duplication is not required.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 2. Consolidate repeated failure matrix wording
**Finding key:** loop-b325116d1de41953b70d
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft.json
**Requirement:** R3
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft.json`  
**Requirement:** R3  
**Issue:** The required/advisory failure matrix is repeated across `analysis.validation`, `scopeVerification.in`, and `impactOnExisting` with slightly different phrasing. This makes future changes to covered failure modes error-prone.  
**Suggestion:** Define the lifecycle matrix once in a dedicated field, then reference it from validation/scope/impact text instead of restating the full list each time.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft.json`  
**Requirement:** R3  
**Issue:** The required/advisory failure matrix is repeated across `analysis.validation`, `scopeVerification.in`, and `impactOnExisting` with slightly different phrasing. This makes future changes to covered failure modes error-prone.  
**Suggestion:** Define the lifecycle matrix once in a dedicated field, then reference it from validation/scope/impact text instead of restating the full list each time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 3. Add explicit bounded wording for fixture/test-helper updates
**Finding key:** loop-e13dd2a10cbb7109330b
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/issue.md
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R6  
**Issue:** The scope says to update “the fixtures / test helpers that build it” without a bound or selection rule. Under the bounded-resource-usage guardrail, bulk updates should have an explicit limit or deterministic scope.  
**Suggestion:** Narrow this to fixtures and helpers that directly construct `plugins.flowCommandHooks` snapshots for the affected lifecycle tests, or state a concrete discovery rule such as “all references found by searching for `flowCommandHooks` in touched spec/test fixtures.”
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/issue.md`  
**Requirement:** R6  
**Issue:** The scope says to update “the fixtures / test helpers that build it” without a bound or selection rule. Under the bounded-resource-usage guardrail, bulk updates should have an explicit limit or deterministic scope.  
**Suggestion:** Narrow this to fixtures and helpers that directly construct `plugins.flowCommandHooks` snapshots for the affected lifecycle tests, or state a concrete discovery rule such as “all references found by searching for `flowCommandHooks` in touched spec/test fixtures.”
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Remove Redundant Issue Number Field
**Finding key:** loop-c22e6a3f8ef42a581f61
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R8  
**Issue:** The issue number is stored twice as `issue` and `result.issueNumber`, which creates unnecessary duplication and a risk of inconsistency.  
**Suggestion:** Keep a single source of truth. Prefer either the top-level `issue` field or `result.issueNumber`, but not both.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/plugin-artifacts/workflow/prepare.json`  
**Requirement:** R8  
**Issue:** The issue number is stored twice as `issue` and `result.issueNumber`, which creates unnecessary duplication and a risk of inconsistency.  
**Suggestion:** Keep a single source of truth. Prefer either the top-level `issue` field or `result.issueNumber`, but not both.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 2. Reconcile Conflicting Gate And Review Results
**Finding key:** loop-d25d3d18cafa2451e116
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec-review.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec-review.json`  
**Requirement:** R8  
**Issue:** `spec-review.json` reports `verdict: "PASS"` with zero findings, while `spec-gate-source.json` in the same change set reports `result: "fail"` with a blocking violation. These artifacts appear inconsistent.  
**Suggestion:** Regenerate or update `spec-review.json` so its verdict and finding counts reflect the blocking gate failure, or remove the stale artifact if it should not be committed.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec-review.json`  
**Requirement:** R8  
**Issue:** `spec-review.json` reports `verdict: "PASS"` with zero findings, while `spec-gate-source.json` in the same change set reports `result: "fail"` with a blocking violation. These artifacts appear inconsistent.  
**Suggestion:** Regenerate or update `spec-review.json` so its verdict and finding counts reflect the blocking gate failure, or remove the stale artifact if it should not be committed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Add Explicit Bounds To Snapshot Comparisons
**Finding key:** loop-d70d5f97a19bc7cedf56
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec.json`  
**Requirement:** R8  
**Issue:** The test strategy requires byte-for-byte snapshots of flow state, issue-log, spec/draft files, plugin artifact directories, and Git/worktree state, but it does not define any upper bound for directory traversal, file count, file size, or total bytes. This violates `bounded-resource-usage` for bulk data loading.  
**Suggestion:** Add explicit caps to the relevant acceptance criteria or test strategy, such as maximum artifact directory depth, maximum file count, maximum per-file bytes, and maximum total snapshot bytes. Also define the expected failure behavior when those caps are exceeded.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec.json`  
**Requirement:** R8  
**Issue:** The test strategy requires byte-for-byte snapshots of flow state, issue-log, spec/draft files, plugin artifact directories, and Git/worktree state, but it does not define any upper bound for directory traversal, file count, file size, or total bytes. This violates `bounded-resource-usage` for bulk data loading.  
**Suggestion:** Add explicit caps to the relevant acceptance criteria or test strategy, such as maximum artifact directory depth, maximum file count, maximum per-file bytes, and maximum total snapshot bytes. Also define the expected failure behavior when those caps are exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Remove Empty Placeholder Sections
**Finding key:** loop-9da5ffffb377ed7be108
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec.md
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R8  
**Issue:** `## Clarifications (Q&A)` contains empty `Q:` / `A:` bullets, and `## Open Questions` contains only `- [ ]`. These are dead placeholder content and make the spec look less finalized than the `PASS` review suggests.  
**Suggestion:** Remove the empty placeholder entries, or render these sections as `None` / `No open questions` consistently.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R8  
**Issue:** `## Clarifications (Q&A)` contains empty `Q:` / `A:` bullets, and `## Open Questions` contains only `- [ ]`. These are dead placeholder content and make the spec look less finalized than the `PASS` review suggests.  
**Suggestion:** Remove the empty placeholder entries, or render these sections as `None` / `No open questions` consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Consolidate Repeated Lifecycle Atomicity Text
**Finding key:** loop-63ecda02a42d25a8a8aa
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec.md
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R6  
**Issue:** The same prepare/finalize-cleanup atomicity surfaces are repeated in the Goal, Scope, Design Principles, Overview, R6, AC5, AC6, and T-3. This increases maintenance risk if the protected surface list changes.  
**Suggestion:** Define a single named list of protected prepare and finalize-cleanup surfaces, then reference that list from requirements, acceptance criteria, and task descriptions.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec.md`  
**Requirement:** R6  
**Issue:** The same prepare/finalize-cleanup atomicity surfaces are repeated in the Goal, Scope, Design Principles, Overview, R6, AC5, AC6, and T-3. This increases maintenance risk if the protected surface list changes.  
**Suggestion:** Define a single named list of protected prepare and finalize-cleanup surfaces, then reference that list from requirements, acceptance criteria, and task descriptions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Deduplicate Repeated Guardrail Findings
**Finding key:** loop-0448d0879c4aaf2fc649
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/task-impl-gate-source.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R2  
**Issue:** The same two `no-overengineering` findings are repeated in both `evaluations[]` and top-level `observations[]`, with largely identical rationale text and metadata. This makes the artifact harder to review and increases the chance of inconsistent future updates.  
**Suggestion:** Store the canonical finding data once and have the other section reference it by `findingId`/`fingerprint`, or remove one redundant representation if consumers do not require both.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R2  
**Issue:** The same two `no-overengineering` findings are repeated in both `evaluations[]` and top-level `observations[]`, with largely identical rationale text and metadata. This makes the artifact harder to review and increases the chance of inconsistent future updates.  
**Suggestion:** Store the canonical finding data once and have the other section reference it by `findingId`/`fingerprint`, or remove one redundant representation if consumers do not require both.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Use Concrete Requirement IDs In Gate Findings
**Finding key:** loop-cdeeda1c853b91e0c093
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/task-impl-gate-source.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R2  
**Issue:** Each finding has `"requirementId": null` while the review contract requires findings to map to known requirement IDs. That weakens traceability from implementation gate failures back to the spec contract.  
**Suggestion:** Populate `requirementId` with the relevant requirement, likely `R2` for typed hook outcome handling or `R6` if the finding is specifically about finalize-cleanup pre-hook stop behavior.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R2  
**Issue:** Each finding has `"requirementId": null` while the review contract requires findings to map to known requirement IDs. That weakens traceability from implementation gate failures back to the spec contract.  
**Suggestion:** Populate `requirementId` with the relevant requirement, likely `R2` for typed hook outcome handling or `R6` if the finding is specifically about finalize-cleanup pre-hook stop behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Avoid Duplicated Long Rationale Text
**Finding key:** loop-656d2dadb204b11aebca
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/task-impl-gate-source.json
**Requirement:** R2
**Issue:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R2  
**Issue:** `reason`, `observed`, and `rationale` repeat the same long text within each finding. This is noisy and makes the generated JSON unnecessarily large.  
**Suggestion:** Keep the detailed text in one canonical field, such as `rationale`, and make `reason` a short summary or derive it when rendering human-readable output.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/task-impl-gate-source.json`  
**Requirement:** R2  
**Issue:** `reason`, `observed`, and `rationale` repeat the same long text within each finding. This is noisy and makes the generated JSON unnecessarily large.  
**Suggestion:** Keep the detailed text in one canonical field, such as `rationale`, and make `reason` a short summary or derive it when rendering human-readable output.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Remove Duplicated Advisory Text
**Finding key:** loop-bd8ab0170fdfec67c317
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/test-review.json
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/test-review.json`
**Requirement:** R8
**Issue:** The advisory finding stores the same sentence in both `rationale` and `whyNonBlocking`, which creates duplicate maintenance surface and makes the fields less semantically distinct.
**Suggestion:** Keep `rationale` focused on why the finding exists, and reserve `whyNonBlocking` for why it does not block. For example, make `rationale` describe the artifact-write ambiguity, while `whyNonBlocking` keeps the current coverage justification.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/test-review.json`
**Requirement:** R8
**Issue:** The advisory finding stores the same sentence in both `rationale` and `whyNonBlocking`, which creates duplicate maintenance surface and makes the fields less semantically distinct.
**Suggestion:** Keep `rationale` focused on why the finding exists, and reserve `whyNonBlocking` for why it does not block. For example, make `rationale` describe the artifact-write ambiguity, while `whyNonBlocking` keeps the current coverage justification.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Extract Snapshot Fixture Builders
**Finding key:** loop-50f8d03ce0ac4b75bdff
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`  
**Requirement:** R8  
**Issue:** Hook snapshot objects are repeated throughout the test file with mostly identical fields, which makes policy/module/class changes noisy and easy to miss.  
**Suggestion:** Add helpers such as `prepareHookSnapshot(overrides = {})` and `finalizeHookSnapshot(overrides = {})`, then use overrides for `failurePolicy`, `module`, `className`, `command`, and `hook`.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`  
**Requirement:** R8  
**Issue:** Hook snapshot objects are repeated throughout the test file with mostly identical fields, which makes policy/module/class changes noisy and easy to miss.  
**Suggestion:** Add helpers such as `prepareHookSnapshot(overrides = {})` and `finalizeHookSnapshot(overrides = {})`, then use overrides for `failurePolicy`, `module`, `className`, `command`, and `hook`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 2. Extract Finalize Hook Fixture Writer
**Finding key:** loop-d2e40ffe1e683df2f6d0
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`  
**Requirement:** R6  
**Issue:** The finalize hook module source and file-writing setup are duplicated across finalize-cleanup tests.  
**Suggestion:** Add a `writeFinalizeHook(projectRoot, { className, body, policy = "required" })` helper that writes `.senti/plugins/fixture/hooks/finalize.js` and returns the matching snapshot metadata.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`  
**Requirement:** R6  
**Issue:** The finalize hook module source and file-writing setup are duplicated across finalize-cleanup tests.  
**Suggestion:** Add a `writeFinalizeHook(projectRoot, { className, body, policy = "required" })` helper that writes `.senti/plugins/fixture/hooks/finalize.js` and returns the matching snapshot metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 3. Remove Redundant Initial Plugin Lifecycle Value
**Finding key:** loop-270b81071e3b7c8c724c
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** `let pluginLifecycle = { warnings: [], issueLogEntries: [], data: {} };` is immediately overwritten before meaningful use in `runTeardownTransactionOwned`, so the initializer is dead state.  
**Suggestion:** Change it to `let pluginLifecycle;` or declare it at the assignment point after `postResult` succeeds.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** `let pluginLifecycle = { warnings: [], issueLogEntries: [], data: {} };` is immediately overwritten before meaningful use in `runTeardownTransactionOwned`, so the initializer is dead state.  
**Suggestion:** Change it to `let pluginLifecycle;` or declare it at the assignment point after `postResult` succeeds.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 4. Centralize Required Hook Failure Details
**Finding key:** loop-2b38c08b9ee81522a81f
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R3  
**Issue:** Required hook failure message and metadata extraction are duplicated between `finalizeRequiredPluginHookFailure` and the teardown failure path.  
**Suggestion:** Add a small helper, for example `requiredHookFailureDetails(pluginLifecycle)`, returning `{ message, pluginId, hook }`, and use it in both places.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R3  
**Issue:** Required hook failure message and metadata extraction are duplicated between `finalizeRequiredPluginHookFailure` and the teardown failure path.  
**Suggestion:** Add a small helper, for example `requiredHookFailureDetails(pluginLifecycle)`, returning `{ message, pluginId, hook }`, and use it in both places.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 5. Avoid Reaching Into Envelope Internals For Post-Hook Errors
**Finding key:** loop-a649242ef5de291c7248
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** `new Error(postResult.env.errors[0].messages[0])` depends on the internal shape of `Envelope` errors at the call site.  
**Suggestion:** Have `runFinalizePostHooks` return the caught error alongside the envelope, e.g. `{ ok: false, env, error }`, so `failBeforeCommit(postResult.env, postResult.error)` does not need to inspect envelope internals.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`  
**Requirement:** R7  
**Issue:** `new Error(postResult.env.errors[0].messages[0])` depends on the internal shape of `Envelope` errors at the call site.  
**Suggestion:** Have `runFinalizePostHooks` return the caught error alongside the envelope, e.g. `{ ok: false, env, error }`, so `failBeforeCommit(postResult.env, postResult.error)` does not need to inspect envelope internals.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Remove Redundant Catch Block
**Finding key:** loop-bd54f0b71c2e1049bd58
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`
**Requirement:** R7
**Issue:** `writeFlowState()` wraps the lifecycle execution in `try { ... } catch (error) { throw error; }`, which adds no behavior and makes the required-hook control flow harder to scan.
**Suggestion:** Remove the redundant `try/catch` and keep the lifecycle failure handling inline after `runFlowCommandWithPluginLifecycle()`.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`
**Requirement:** R7
**Issue:** `writeFlowState()` wraps the lifecycle execution in `try { ... } catch (error) { throw error; }`, which adds no behavior and makes the required-hook control flow harder to scan.
**Suggestion:** Remove the redundant `try/catch` and keep the lifecycle failure handling inline after `runFlowCommandWithPluginLifecycle()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 2. Rename Callback to Match Its Side Effect
**Finding key:** loop-cd079be1a81e5ab97fc8
**Failure mode:** refactor
**File:** src/flow/lib/run-prepare-spec.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-prepare-spec.js`
**Requirement:** R6
**Issue:** `writeFlowState(extra, writePrepareFiles)` now receives a callback that writes spec/source files before creating flow state, but the name `writePrepareFiles` is broad and easy to confuse with `writeFlowState()` itself.
**Suggestion:** Rename the parameter to something more explicit, such as `writeSpecFilesBeforeState`, or extract a helper like `createPrepareFilesAndState(state, writeSpecFiles)` to make the “hooks first, files second” ordering obvious.
**Suggestion:** **File:** `src/flow/lib/run-prepare-spec.js`
**Requirement:** R6
**Issue:** `writeFlowState(extra, writePrepareFiles)` now receives a callback that writes spec/source files before creating flow state, but the name `writePrepareFiles` is broad and easy to confuse with `writeFlowState()` itself.
**Suggestion:** Rename the parameter to something more explicit, such as `writeSpecFilesBeforeState`, or extract a helper like `createPrepareFilesAndState(state, writeSpecFiles)` to make the “hooks first, files second” ordering obvious.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 3. Avoid Revalidating The Full Hook Snapshot On Every Dispatch
**Finding key:** loop-3baaefab37a540218428
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R1
**Issue:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R1
**Issue:** `runFlowCommandHooks()` calls `validateHookSnapshot(snapshot)` every time hooks are dispatched. A lifecycle with pre and post hooks validates the same snapshot twice, and future callers may repeat this further.
**Suggestion:** Move snapshot validation to `runFlowCommandWithPluginLifecycle()` once per lifecycle, or introduce a small validated snapshot wrapper/helper so callers do not repeatedly scan the same data.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R1
**Issue:** `runFlowCommandHooks()` calls `validateHookSnapshot(snapshot)` every time hooks are dispatched. A lifecycle with pre and post hooks validates the same snapshot twice, and future callers may repeat this further.
**Suggestion:** Move snapshot validation to `runFlowCommandWithPluginLifecycle()` once per lifecycle, or introduce a small validated snapshot wrapper/helper so callers do not repeatedly scan the same data.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 4. Make Outcome Kind Constants Shared
**Finding key:** loop-2f4372e42ce3ae905a39
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R2
**Issue:** Outcome kind strings are repeated inline across `FlowCommandHookExecutionOutcome`, `runFlowCommandHooks()`, and `composePluginLifecycleResult()`. This increases typo risk as the typed outcome model grows.
**Suggestion:** Define constants or a frozen set for outcome kinds, similar to `FLOW_COMMAND_HOOK_FAILURE_POLICIES`, and use them consistently.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R2
**Issue:** Outcome kind strings are repeated inline across `FlowCommandHookExecutionOutcome`, `runFlowCommandHooks()`, and `composePluginLifecycleResult()`. This increases typo risk as the typed outcome model grows.
**Suggestion:** Define constants or a frozen set for outcome kinds, similar to `FLOW_COMMAND_HOOK_FAILURE_POLICIES`, and use them consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 5. Simplify Lifecycle Failure Composition Naming
**Finding key:** loop-6f422de849eaa8d0e65c
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R7
**Issue:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R7
**Issue:** `pluginLifecycleFailure(failure, result, pre = null)` passes a hook result named `failure` into `composePluginLifecycleResult()` as `terminal`. The naming shifts between “failure” and “terminal”, which makes pre-failure vs post-failure behavior harder to follow.
**Suggestion:** Use one term consistently, for example `terminalHooks`, and inline `pluginLifecycleFailure()` if it remains a one-line wrapper.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R7
**Issue:** `pluginLifecycleFailure(failure, result, pre = null)` passes a hook result named `failure` into `composePluginLifecycleResult()` as `terminal`. The naming shifts between “failure” and “terminal”, which makes pre-failure vs post-failure behavior harder to follow.
**Suggestion:** Use one term consistently, for example `terminalHooks`, and inline `pluginLifecycleFailure()` if it remains a one-line wrapper.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 6. Keep Envelope Validation Near Result Handling
**Finding key:** loop-adf696313fb6eec03140
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R3
**Issue:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R3
**Issue:** `isEnvelopeLike()` was moved away from the other dispatch helpers and now sits between `loadHookClass()` and `runFlowCommandHooks()`. It is only used by hook execution.
**Suggestion:** Keep `isEnvelopeLike()` immediately before `runFlowCommandHooks()` with a short name like `isHookEnvelopeResult()`, making its scope and purpose clearer.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R3
**Issue:** `isEnvelopeLike()` was moved away from the other dispatch helpers and now sits between `loadHookClass()` and `runFlowCommandHooks()`. It is only used by hook execution.
**Suggestion:** Keep `isEnvelopeLike()` immediately before `runFlowCommandHooks()` with a short name like `isHookEnvelopeResult()`, making its scope and purpose clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 1. Extract repeated fake flow manager transition logic
**Finding key:** loop-5e24e3433675f4381b93
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The inline `flowManager.updateStepStatus` implementations repeat the same transition-application loop in multiple tests. This makes later API changes easier to miss across fixtures.  
**Suggestion:** Introduce a small test helper such as `createFlowManagerStub(state, transitions)` or `applyTransitionChanges(state, transition)` and reuse it in both test cases.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R1  
**Issue:** The inline `flowManager.updateStepStatus` implementations repeat the same transition-application loop in multiple tests. This makes later API changes easier to miss across fixtures.  
**Suggestion:** Introduce a small test helper such as `createFlowManagerStub(state, transitions)` or `applyTransitionChanges(state, transition)` and reuse it in both test cases.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Extract plugin fixture installation setup
**Finding key:** loop-182d9720f865c5068eec
**Failure mode:** refactor
**File:** tests/unit/flow/finalize-cleanup-transaction-v2.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R1  
**Issue:** The plugin setup now writes the same config and hook source into both the main root and worktree, then manually stages and commits the worktree copy. This is dense fixture plumbing inside the test body and is likely to be repeated by future finalize plugin tests.  
**Suggestion:** Extract a helper like `installFinalizeHookPlugin({ root, worktreePath, pluginId, hookSource })` that writes both runtime copies, stages the worktree paths, and commits them.
**Suggestion:** **File:** `tests/unit/flow/finalize-cleanup-transaction-v2.test.js`  
**Requirement:** R1  
**Issue:** The plugin setup now writes the same config and hook source into both the main root and worktree, then manually stages and commits the worktree copy. This is dense fixture plumbing inside the test body and is likely to be repeated by future finalize plugin tests.  
**Suggestion:** Extract a helper like `installFinalizeHookPlugin({ root, worktreePath, pluginId, hookSource })` that writes both runtime copies, stages the worktree paths, and commits them.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Avoid force-removing expected fixture files without an assertion
**Finding key:** loop-ab46fd2d5a2ecc6844af
**Failure mode:** refactor
**File:** tests/unit/flow/set-step-impl-repair.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** Changing `fs.rmSync(... )` to `{ force: true }` removes the signal that `impl-review.json` and `impl-triage.json` were actually created by the fixture before the test deletes them. If fixture setup regresses, the test will silently continue with a different precondition.  
**Suggestion:** Assert file existence before removal, or use a helper such as `removeExpectedFixtureFile(path)` that checks `existsSync` and then removes the file.
**Suggestion:** **File:** `tests/unit/flow/set-step-impl-repair.test.js`  
**Requirement:** R2  
**Issue:** Changing `fs.rmSync(... )` to `{ force: true }` removes the signal that `impl-review.json` and `impl-triage.json` were actually created by the fixture before the test deletes them. If fixture setup regresses, the test will silently continue with a different precondition.  
**Suggestion:** Assert file existence before removal, or use a helper such as `removeExpectedFixtureFile(path)` that checks `existsSync` and then removes the file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Normalize Gate Finding Schema Across Artifacts
**Finding key:** loop-2d8af819066772373163
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/draft-gate-source.json
**Requirement:** R1
**Issue:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R1
**Issue:** Multiple gate artifacts report the same structural problems: duplicated finding payloads across `evaluations` and `observations`, repeated rationale fields, inconsistent field naming, and missing/nullable requirement traceability. This suggests the artifacts are being generated from inconsistent or under-specified interfaces rather than isolated file mistakes.
**Suggestion:** Define one shared gate-finding schema for all `*-gate-source.json` artifacts: canonical finding data stored once, location/observation references separated, consistent camelCase names, and required `requirementId` values.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/draft-gate-source.json`
**Requirement:** R1
**Issue:** Multiple gate artifacts report the same structural problems: duplicated finding payloads across `evaluations` and `observations`, repeated rationale fields, inconsistent field naming, and missing/nullable requirement traceability. This suggests the artifacts are being generated from inconsistent or under-specified interfaces rather than isolated file mistakes.
**Suggestion:** Define one shared gate-finding schema for all `*-gate-source.json` artifacts: canonical finding data stored once, location/observation references separated, consistent camelCase names, and required `requirementId` values.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Consolidate Required Hook Failure Language Across Spec And Tests
**Finding key:** loop-cf724349149414f915e3
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/spec.md
**Requirement:** R6
**Issue:** **File:** `specs/345-required-hook-failure-policy/spec.md`
**Requirement:** R6
**Issue:** Required/advisory hook behavior and finalize-cleanup atomicity are repeated across `issue.md`, `draft.json`, `spec.md`, and test descriptions. The same policy surface is described in several places with slightly different wording, creating drift risk between requirements, acceptance criteria, and implementation tests.
**Suggestion:** Introduce a single named lifecycle failure matrix or protected-surface list in the spec data, then reference it from rendered markdown, validation, scope, acceptance criteria, and tests.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/spec.md`
**Requirement:** R6
**Issue:** Required/advisory hook behavior and finalize-cleanup atomicity are repeated across `issue.md`, `draft.json`, `spec.md`, and test descriptions. The same policy surface is described in several places with slightly different wording, creating drift risk between requirements, acceptance criteria, and implementation tests.
**Suggestion:** Introduce a single named lifecycle failure matrix or protected-surface list in the spec data, then reference it from rendered markdown, validation, scope, acceptance criteria, and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Share Hook Fixture Builders Between Spec And Unit Tests
**Finding key:** loop-fc097696b8290f858d6f
**Failure mode:** refactor
**File:** specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js
**Requirement:** R8
**Issue:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`
**Requirement:** R8
**Issue:** Hook snapshot/plugin fixture setup is duplicated in both spec-local tests and unit tests, including repeated hook metadata, config writing, hook source writing, and finalize plugin installation behavior. This creates parallel fixture conventions that can diverge as hook snapshot fields evolve.
**Suggestion:** Extract shared test helpers for hook snapshots and plugin installation, then use them from both spec tests and unit tests where feasible.
**Suggestion:** **File:** `specs/345-required-hook-failure-policy/tests/required-hook-failure-policy.test.js`
**Requirement:** R8
**Issue:** Hook snapshot/plugin fixture setup is duplicated in both spec-local tests and unit tests, including repeated hook metadata, config writing, hook source writing, and finalize plugin installation behavior. This creates parallel fixture conventions that can diverge as hook snapshot fields evolve.
**Suggestion:** Extract shared test helpers for hook snapshots and plugin installation, then use them from both spec tests and unit tests where feasible.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 4. Align Hook Outcome Naming Across Plugin Registry And Callers
**Finding key:** loop-172edfb4754cea57c2dc
**Failure mode:** refactor
**File:** src/lib/plugin-registry.js
**Requirement:** R2
**Issue:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R2
**Issue:** Outcome terms shift between `failure`, `terminal`, outcome kind strings, and lifecycle result composition, while callers such as finalize cleanup separately inspect failure details. The interface vocabulary is inconsistent across producer and consumer files.
**Suggestion:** Define shared outcome kind constants and use one term, such as `terminalHooks`, across `plugin-registry.js`, prepare, and finalize cleanup call sites.
**Suggestion:** **File:** `src/lib/plugin-registry.js`
**Requirement:** R2
**Issue:** Outcome terms shift between `failure`, `terminal`, outcome kind strings, and lifecycle result composition, while callers such as finalize cleanup separately inspect failure details. The interface vocabulary is inconsistent across producer and consumer files.
**Suggestion:** Define shared outcome kind constants and use one term, such as `terminalHooks`, across `plugin-registry.js`, prepare, and finalize cleanup call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 5. Centralize Required Hook Failure Detail Extraction
**Finding key:** loop-25251a4dc7e541541f20
**Failure mode:** refactor
**File:** src/flow/lib/run-finalize-cleanup.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R3
**Issue:** Required hook failure message/plugin/hook extraction is duplicated inside finalize cleanup, while prepare and plugin registry also participate in the same lifecycle failure model. This risks inconsistent user-facing failure messages between prepare and finalize paths.
**Suggestion:** Add a shared helper or lifecycle result method that exposes `{ message, pluginId, hook }` for terminal required-hook failures, and have prepare/finalize callers use that interface instead of rebuilding details locally.
**Suggestion:** **File:** `src/flow/lib/run-finalize-cleanup.js`
**Requirement:** R3
**Issue:** Required hook failure message/plugin/hook extraction is duplicated inside finalize cleanup, while prepare and plugin registry also participate in the same lifecycle failure model. This risks inconsistent user-facing failure messages between prepare and finalize paths.
**Suggestion:** Add a shared helper or lifecycle result method that exposes `{ message, pluginId, hook }` for terminal required-hook failures, and have prepare/finalize callers use that interface instead of rebuilding details locally.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
