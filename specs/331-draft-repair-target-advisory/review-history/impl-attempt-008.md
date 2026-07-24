# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 3. Remove Redundant Permission Rule If Covered By Existing Prefix
**Finding key:** loop-9fb17b6fc3822e7ebc74
**Failure mode:** refactor
**File:** .codex/rules/default.rules
**Requirement:** R8
**Issue:** **File:** `.codex/rules/default.rules`  
**Requirement:** R8  
**Issue:** The new `prefix_rule(pattern=["senti", "workflow"], decision="allow")` may be redundant if command execution already allows the broader `senti` command family elsewhere, but this file now has separate allow rules for closely related `senti flow` and `senti workflow` commands.  
**Suggestion:** If the rules format supports it, consider replacing the two specific `senti` command rules with one explicit shared rule for the approved `senti` subcommands, or document why `flow` and `workflow` must remain separate.
**Suggestion:** **File:** `.codex/rules/default.rules`  
**Requirement:** R8  
**Issue:** The new `prefix_rule(pattern=["senti", "workflow"], decision="allow")` may be redundant if command execution already allows the broader `senti` command family elsewhere, but this file now has separate allow rules for closely related `senti flow` and `senti workflow` commands.  
**Suggestion:** If the rules format supports it, consider replacing the two specific `senti` command rules with one explicit shared rule for the approved `senti` subcommands, or document why `flow` and `workflow` must remain separate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 1. Consolidate Repeated Scope Constraints
**Finding key:** loop-589f023f78f894bac799
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/draft.json
**Requirement:** R5
**Issue:** **File:** `specs/331-draft-repair-target-advisory/draft.json`  
**Requirement:** R5  
**Issue:** The same out-of-scope constraints are repeated across `scopeVerification.out`, `impactOnExisting`, and `qa.q5` with slightly different wording. This increases maintenance risk if the scope boundary changes during spec refinement.  
**Suggestion:** Keep the canonical exclusion list in `scopeVerification.out`, and have the related QA/effects text reference that boundary more compactly instead of restating every excluded subsystem.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/draft.json`  
**Requirement:** R5  
**Issue:** The same out-of-scope constraints are repeated across `scopeVerification.out`, `impactOnExisting`, and `qa.q5` with slightly different wording. This increases maintenance risk if the scope boundary changes during spec refinement.  
**Suggestion:** Keep the canonical exclusion list in `scopeVerification.out`, and have the related QA/effects text reference that boundary more compactly instead of restating every excluded subsystem.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Normalize Repeated Phase Pair Wording
**Finding key:** loop-ea34f181831c2c50d7b0
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/draft.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/draft.json`  
**Requirement:** R1  
**Issue:** The phrase `draft-questions と draft-coverage` appears throughout the draft. Because these two phases define the core target set, repeated inline wording makes later edits error-prone.  
**Suggestion:** Introduce a single named concept in the draft, such as “対象 phase は draft-questions / draft-coverage”, then refer to “対象 phase” in later sections where the exact pair does not need to be repeated.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/draft.json`  
**Requirement:** R1  
**Issue:** The phrase `draft-questions と draft-coverage` appears throughout the draft. Because these two phases define the core target set, repeated inline wording makes later edits error-prone.  
**Suggestion:** Introduce a single named concept in the draft, such as “対象 phase は draft-questions / draft-coverage”, then refer to “対象 phase” in later sections where the exact pair does not need to be repeated.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 1. Trim Runtime State From Committed Flow Snapshot
**Finding key:** loop-07f215e1a40537a906c3
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** The new `flow.json` is 4009 lines and includes volatile runtime details such as `metrics`, `runtimeLog`, `stepAttempts`, `reviewConvergence`, and retry recovery histories. This makes the file noisy, hard to review, and likely to churn on every flow command.
**Suggestion:** Commit only the stable flow metadata required for resumption/audit, or split append-only runtime state into ignored/local artifacts if this file is intended to be versioned.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** The new `flow.json` is 4009 lines and includes volatile runtime details such as `metrics`, `runtimeLog`, `stepAttempts`, `reviewConvergence`, and retry recovery histories. This makes the file noisy, hard to review, and likely to churn on every flow command.
**Suggestion:** Commit only the stable flow metadata required for resumption/audit, or split append-only runtime state into ignored/local artifacts if this file is intended to be versioned.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Bound Append-Only Collections
**Finding key:** loop-5c27d94bf54f0540c9cb
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** Arrays such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` appear append-only and have no visible size cap. This violates the `bounded-resource-usage` guardrail for bulk data loading and long-running flows.
**Suggestion:** Add explicit retention limits for stored runtime history, for example max entries per collection, max findings per review record, and/or archival compaction once terminal evidence is available.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** Arrays such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` appear append-only and have no visible size cap. This violates the `bounded-resource-usage` guardrail for bulk data loading and long-running flows.
**Suggestion:** Add explicit retention limits for stored runtime history, for example max entries per collection, max findings per review record, and/or archival compaction once terminal evidence is available.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Deduplicate Repeated Evidence Identity Blocks
**Finding key:** loop-5f264a5e48ba8b6cac95
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Many `handoffFindings` repeat identical `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values already represented at the parent review record level.
**Suggestion:** Store shared evidence identity once on the parent record and let each finding contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Many `handoffFindings` repeat identical `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values already represented at the parent review record level.
**Suggestion:** Store shared evidence identity once on the parent record and let each finding contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Normalize Repeated Issue Repair References
**Finding key:** loop-da8bdb4dadc68e0b9b2e
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R6
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R6
**Issue:** Several entries repeat the same `repairRef.files` values and similar repair phrasing for the same files, especially `tests/unit/flow/commands/review.test.js` and the spec-local test file. This makes the log longer without adding much distinct information.
**Suggestion:** Consolidate related repair entries into a single entry per finding or introduce a compact shared repair reference list for repeated file sets.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R6
**Issue:** Several entries repeat the same `repairRef.files` values and similar repair phrasing for the same files, especially `tests/unit/flow/commands/review.test.js` and the spec-local test file. This makes the log longer without adding much distinct information.
**Suggestion:** Consolidate related repair entries into a single entry per finding or introduce a compact shared repair reference list for repeated file sets.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Remove Redundant Recovery Identifiers
**Finding key:** loop-922071397a70a36dc63d
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R8
**Issue:** The `retry-recovery` entry stores the same value in `grantId`, `id`, and `issueLogId`. Keeping three aliases for one identifier increases schema noise and invites inconsistent future updates.
**Suggestion:** Keep one canonical identifier field for recovery entries, or derive the issue-log id from the recovery id at read time.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R8
**Issue:** The `retry-recovery` entry stores the same value in `grantId`, `id`, and `issueLogId`. Keeping three aliases for one identifier increases schema noise and invites inconsistent future updates.
**Suggestion:** Keep one canonical identifier field for recovery entries, or derive the issue-log id from the recovery id at read time.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 5. Clarify Spec Task Status
**Finding key:** loop-527a7abd524ce20f06f0
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R1  
**Issue:** The top-level requirements are all marked `"status": "done"`, while task `T-1` remains `"status": "pending"`. That status mismatch makes the spec harder to interpret during review and later automation.  
**Suggestion:** Align the task status with the completed requirements, or add an explicit note explaining why the task remains pending despite all requirements being done.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/spec.json`  
**Requirement:** R1  
**Issue:** The top-level requirements are all marked `"status": "done"`, while task `T-1` remains `"status": "pending"`. That status mismatch makes the spec harder to interpret during review and later automation.  
**Suggestion:** Align the task status with the completed requirements, or add an explicit note explaining why the task remains pending despite all requirements being done.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 1. Extract Canonical Disposition Helper
**Finding key:** loop-c0037c50bef77608f44a
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R1  
**Issue:** Several tests repeat the same pattern: build canonical findings, create `ReviewDisposition`, then assert common `ADVISORY`/empty blocking behavior. This makes the tests slightly noisy and increases maintenance cost if the canonical recording contract changes.  
**Suggestion:** Add a small helper such as `advisoryDispositionFor(fixture)` or extend `DraftReviewFixture` with `advisoryDisposition()` to centralize the `"ADVISORY"` construction and common expectations where appropriate.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R1  
**Issue:** Several tests repeat the same pattern: build canonical findings, create `ReviewDisposition`, then assert common `ADVISORY`/empty blocking behavior. This makes the tests slightly noisy and increases maintenance cost if the canonical recording contract changes.  
**Suggestion:** Add a small helper such as `advisoryDispositionFor(fixture)` or extend `DraftReviewFixture` with `advisoryDisposition()` to centralize the `"ADVISORY"` construction and common expectations where appropriate.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 2. Make Evidence Phase Match Fixture Phase
**Finding key:** loop-8b6e84166940f55927fb
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R2
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R2  
**Issue:** `advisoryEvidence()` always sets `phase: "draft-questions"`, even though the suite also covers `draft-coverage`. This is currently harmless because the helper is only used with draft-questions dispositions, but the name is generic and invites accidental misuse.  
**Suggestion:** Accept `phase` as an argument, defaulting to `"draft-questions"`, or rename the helper to `draftQuestionsAdvisoryEvidence()` to make the limitation explicit.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R2  
**Issue:** `advisoryEvidence()` always sets `phase: "draft-questions"`, even though the suite also covers `draft-coverage`. This is currently harmless because the helper is only used with draft-questions dispositions, but the name is generic and invites accidental misuse.  
**Suggestion:** Accept `phase` as an argument, defaulting to `"draft-questions"`, or rename the helper to `draftQuestionsAdvisoryEvidence()` to make the limitation explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 3. Reduce Inline Checkpoint Fixture Noise
**Finding key:** loop-57e48c161b0e59bbba1b
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R8  
**Issue:** The R8 test contains a large inline checkpoint-shaped artifact setup, flow state setup, mocked flow manager, and assertion sequence. The test intent is harder to scan because fixture construction dominates the behavior being verified.  
**Suggestion:** Extract local helpers such as `buildCheckpointRepairArtifact()`, `createDraftQuestionsFlowState()`, and `createRecordingFlowManager(flowState, transitions)` within this test file.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R8  
**Issue:** The R8 test contains a large inline checkpoint-shaped artifact setup, flow state setup, mocked flow manager, and assertion sequence. The test intent is harder to scan because fixture construction dominates the behavior being verified.  
**Suggestion:** Extract local helpers such as `buildCheckpointRepairArtifact()`, `createDraftQuestionsFlowState()`, and `createRecordingFlowManager(flowState, transitions)` within this test file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 4. Avoid Duplicated Fallback ID Literals
**Finding key:** loop-9e338e9b51c20e69f2a3
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R7
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R7  
**Issue:** Expected fallback IDs like `"draft-questions-advisory-001"` and `"draft-questions-advisory-002"` are repeated across tests. If the deterministic fallback format changes, multiple assertions must be updated manually.  
**Suggestion:** Add a small local helper, for example `expectedAdvisoryIds(phase, count)`, and use it in R1, R2, R3, and R7 assertions.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R7  
**Issue:** Expected fallback IDs like `"draft-questions-advisory-001"` and `"draft-questions-advisory-002"` are repeated across tests. If the deterministic fallback format changes, multiple assertions must be updated manually.  
**Suggestion:** Add a small local helper, for example `expectedAdvisoryIds(phase, count)`, and use it in R1, R2, R3, and R7 assertions.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Rename `stripProposalPreamble` to reflect parser behavior
**Finding key:** loop-69b1d61b36ead4619757
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `stripProposalPreamble()` does not generally strip a preamble; it slices from the first markdown proposal heading. That distinction matters because `providerOutputInvalid()` also uses it before checking JSON output.  
**Suggestion:** Rename it to something more precise, such as `sliceFromFirstMarkdownProposal()` or `extractMarkdownProposalSection()`, so callers do not assume it normalizes all provider preambles.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `stripProposalPreamble()` does not generally strip a preamble; it slices from the first markdown proposal heading. That distinction matters because `providerOutputInvalid()` also uses it before checking JSON output.  
**Suggestion:** Rename it to something more precise, such as `sliceFromFirstMarkdownProposal()` or `extractMarkdownProposalSection()`, so callers do not assume it normalizes all provider preambles.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Keep JSON validation independent from markdown proposal extraction
**Finding key:** loop-cee13af3ac295260ecd0
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `providerOutputInvalid()` applies `stripProposalPreamble()` before JSON detection. If a provider returns JSON plus explanatory markdown, the function may attempt to parse only the markdown section or miss the JSON path entirely.  
**Suggestion:** First validate JSON using `result.trim()` when it starts with `{`; only apply markdown proposal extraction for the markdown proposal path. This keeps the two accepted output formats separate and easier to maintain.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `providerOutputInvalid()` applies `stripProposalPreamble()` before JSON detection. If a provider returns JSON plus explanatory markdown, the function may attempt to parse only the markdown section or miss the JSON path entirely.  
**Suggestion:** First validate JSON using `result.trim()` when it starts with `{`; only apply markdown proposal extraction for the markdown proposal path. This keeps the two accepted output formats separate and easier to maintain.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Avoid summary-string coupling in stale evidence recovery
**Finding key:** loop-cb7593fa113746b953c8
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `AcceptanceEvidenceRefresh.supports()` determines recoverability by comparing `blocker.summary` against exact formatted strings. This is brittle: changing blocker wording will silently disable stale evidence refresh even when the blocker still describes the same artifact condition.  
**Suggestion:** Add structured blocker metadata when constructing these blockers, such as `artifactFile` and `sourceFindingId`, and have `supports()` match on those fields instead of human-readable summary text.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `AcceptanceEvidenceRefresh.supports()` determines recoverability by comparing `blocker.summary` against exact formatted strings. This is brittle: changing blocker wording will silently disable stale evidence refresh even when the blocker still describes the same artifact condition.  
**Suggestion:** Add structured blocker metadata when constructing these blockers, such as `artifactFile` and `sourceFindingId`, and have `supports()` match on those fields instead of human-readable summary text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 2. Simplify stale artifact lookup to avoid repeated linear scans
**Finding key:** loop-ad08034cdad654f76bf0
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `supports()` repeatedly uses `this.staleArtifacts.some()` and `this.staleArtifacts.includes()` while also iterating deferred findings. This is small today, but it duplicates lookup logic and makes the class harder to reason about.  
**Suggestion:** Store `this.staleArtifactSet = new Set(this.staleArtifacts)` in the constructor and use `has()` in `supports()`. This also makes the recoverability checks clearer.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `supports()` repeatedly uses `this.staleArtifacts.some()` and `this.staleArtifacts.includes()` while also iterating deferred findings. This is small today, but it duplicates lookup logic and makes the class harder to reason about.  
**Suggestion:** Store `this.staleArtifactSet = new Set(this.staleArtifacts)` in the constructor and use `has()` in `supports()`. This also makes the recoverability checks clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 1. Extract shared display phase construction
**Finding key:** loop-dd0625743ac57172b85f
**Failure mode:** refactor
**File:** src/flow/lib/gate-recovery-display.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/gate-recovery-display.js`  
**Requirement:** R4  
**Issue:** The active-phase path and configured-phase loop both repeat the same `countGateRetry` / `resolveRecoveryMaxAttempts` / `new GateRecoveryDisplayPhase` construction.  
**Suggestion:** Add a small local helper such as `createGateRecoveryDisplayPhase({ root, flowState, phase, maxAttempts })` and use it in both branches. This keeps the ordering change clear while avoiding duplicated recovery-display logic.
**Suggestion:** **File:** `src/flow/lib/gate-recovery-display.js`  
**Requirement:** R4  
**Issue:** The active-phase path and configured-phase loop both repeat the same `countGateRetry` / `resolveRecoveryMaxAttempts` / `new GateRecoveryDisplayPhase` construction.  
**Suggestion:** Add a small local helper such as `createGateRecoveryDisplayPhase({ root, flowState, phase, maxAttempts })` and use it in both branches. This keeps the ordering change clear while avoiding duplicated recovery-display logic.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Avoid recursive flattening for a single step lookup
**Finding key:** loop-6abbf2471cd364d39b5b
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R8  
**Issue:** `attachLatestStepAttempt` now calls `flattenSteps(targetSteps || [])` just to find one step. If step trees can grow deeply or broadly, this adds recursive bulk traversal in a path that only needs one item, and it has no explicit traversal bound.  
**Suggestion:** Replace the flatten-then-find pattern with a bounded or short-circuiting step lookup helper in this file, for example `findStepById(steps, stepId)`, ideally with an explicit max depth/count if the project has no existing bound for step trees. This also better satisfies the bounded-resource-usage guardrail.
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R8  
**Issue:** `attachLatestStepAttempt` now calls `flattenSteps(targetSteps || [])` just to find one step. If step trees can grow deeply or broadly, this adds recursive bulk traversal in a path that only needs one item, and it has no explicit traversal bound.  
**Suggestion:** Replace the flatten-then-find pattern with a bounded or short-circuiting step lookup helper in this file, for example `findStepById(steps, stepId)`, ideally with an explicit max depth/count if the project has no existing bound for step trees. This also better satisfies the bounded-resource-usage guardrail.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Clarify scoped step naming
**Finding key:** loop-3528e767e20b7d5cd652
**Failure mode:** refactor
**File:** src/flow/lib/get-next-action.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R3  
**Issue:** `targetSteps` is slightly ambiguous because it means “the step collection for the target scope,” not necessarily the target step itself. The next variable is `targetStep`, which makes the distinction easy to miss.  
**Suggestion:** Rename `targetSteps` to `scopedSteps` or `stepScopeSteps` so the code reads more clearly:

```js
const scopedSteps = target.scope === "task"
  ? state.tasks.find((task) => task.id === target.taskId)?.steps
  : state.steps;
```
**Suggestion:** **File:** `src/flow/lib/get-next-action.js`  
**Requirement:** R3  
**Issue:** `targetSteps` is slightly ambiguous because it means “the step collection for the target scope,” not necessarily the target step itself. The next variable is `targetStep`, which makes the distinction easy to miss.  
**Suggestion:** Rename `targetSteps` to `scopedSteps` or `stepScopeSteps` so the code reads more clearly:

```js
const scopedSteps = target.scope === "task"
  ? state.tasks.find((task) => task.id === target.taskId)?.steps
  : state.steps;
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 2. Use a more explicit helper name
**Finding key:** loop-bbdb49bb18a6de8fc44a
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R8  
**Issue:** `invalidationFingerprint` sounds like a data value, but the function normalizes either a raw hash string or fingerprint object into a fingerprint shape.  
**Suggestion:** Rename it to `normalizeInvalidationFingerprint` or `coerceInvalidationFingerprint` so the intent matches the behavior.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R8  
**Issue:** `invalidationFingerprint` sounds like a data value, but the function normalizes either a raw hash string or fingerprint object into a fingerprint shape.  
**Suggestion:** Rename it to `normalizeInvalidationFingerprint` or `coerceInvalidationFingerprint` so the intent matches the behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 1. Simplify repeated evidence refresh access
**Finding key:** loop-651cfbf8b28a4449b30c
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R8  
**Issue:** `result.evidenceRefresh` is read multiple times in the return object, and the `next` ternary now mixes evidence-refresh routing with verdict routing, making the control flow harder to scan.  
**Suggestion:** Assign `const evidenceRefresh = result.evidenceRefresh || null;` and compute `const next = evidenceRefresh ? evidenceRefresh.activeStep : ...` before the return.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R8  
**Issue:** `result.evidenceRefresh` is read multiple times in the return object, and the `next` ternary now mixes evidence-refresh routing with verdict routing, making the control flow harder to scan.  
**Suggestion:** Assign `const evidenceRefresh = result.evidenceRefresh || null;` and compute `const next = evidenceRefresh ? evidenceRefresh.activeStep : ...` before the return.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Extract Shared Test Evidence Validation
**Finding key:** loop-3a3000b54cf5baa18aee
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** `checkIntegrationTestArtifacts` now duplicates the same stale test evidence loading, mismatch detection, recovery, and fingerprint assertion flow added in `run-review.js`. The only meaningful differences are error/result wording and returned artifact metadata.  
**Suggestion:** Introduce a small shared helper in one of the touched files, or move the repeated logic behind a local helper shape reused by both call sites in this change set. Parameterize artifact names, stale-reason text, phase/level metadata, and recovery output text.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** `checkIntegrationTestArtifacts` now duplicates the same stale test evidence loading, mismatch detection, recovery, and fingerprint assertion flow added in `run-review.js`. The only meaningful differences are error/result wording and returned artifact metadata.  
**Suggestion:** Introduce a small shared helper in one of the touched files, or move the repeated logic behind a local helper shape reused by both call sites in this change set. Parameterize artifact names, stale-reason text, phase/level metadata, and recovery output text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Avoid Exposing A Single-Use Internal Class
**Finding key:** loop-5f18c8f24ec7490c8638
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** `StaleIntegrationTestEvidence` is only used as a private control-flow wrapper so `RunGateCommand` can detect it via `instanceof`. This adds a new class for one branch and makes `checkIntegrationTestArtifacts` return mixed result types.  
**Suggestion:** Return a plain gate result directly from `checkIntegrationTestArtifacts`, or return a dedicated local result object with an explicit method-free shape such as `{ staleEvidenceRecovery: ... }`. This would simplify the call site and avoid class-based control flow for a single internal case.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** `StaleIntegrationTestEvidence` is only used as a private control-flow wrapper so `RunGateCommand` can detect it via `instanceof`. This adds a new class for one branch and makes `checkIntegrationTestArtifacts` return mixed result types.  
**Suggestion:** Return a plain gate result directly from `checkIntegrationTestArtifacts`, or return a dedicated local result object with an explicit method-free shape such as `{ staleEvidenceRecovery: ... }`. This would simplify the call site and avoid class-based control flow for a single internal case.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Rename `evidenceRefresh` For Result Semantics
**Finding key:** loop-8666a21b2ea0b7e8622c
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** In `RunReviewCommand`, the variable `evidenceRefresh` holds the full command result returned by `checkImplReviewTestArtifacts`, not just refresh metadata. The name understates that returning it exits the command.  
**Suggestion:** Rename it to `testArtifactGateResult`, `staleEvidenceResult`, or `artifactCheckResult` so the early return reads as command-level control flow.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** In `RunReviewCommand`, the variable `evidenceRefresh` holds the full command result returned by `checkImplReviewTestArtifacts`, not just refresh metadata. The name understates that returning it exits the command.  
**Suggestion:** Rename it to `testArtifactGateResult`, `staleEvidenceResult`, or `artifactCheckResult` so the early return reads as command-level control flow.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Replace Phase Set With Predicate Helper
**Finding key:** loop-c22febd238109a4fa9d0
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** `DRAFT_REPAIR_TARGET_PHASES.has(phase)` appears in multiple places and encodes a domain rule: only draft repair-target phases merge `repairTargets` into advisory findings and receive deterministic fallback IDs.  
**Suggestion:** Add a small helper such as `isDraftRepairTargetPhase(phase)` and use it in `reviewArtifactFindingLists` and `canonicalFindingList`. This makes the policy name explicit and reduces repeated set checks.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** `DRAFT_REPAIR_TARGET_PHASES.has(phase)` appears in multiple places and encodes a domain rule: only draft repair-target phases merge `repairTargets` into advisory findings and receive deterministic fallback IDs.  
**Suggestion:** Add a small helper such as `isDraftRepairTargetPhase(phase)` and use it in `reviewArtifactFindingLists` and `canonicalFindingList`. This makes the policy name explicit and reduces repeated set checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 5. Clarify `canonicalFindingList` Fallback Scope
**Finding key:** loop-ea9a70afe764e833c38f
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** `canonicalFindingList` generates deterministic fallback IDs for every finding in draft repair-target phases, including existing advisory/blocking lists, not only `repairTargets`. That may be correct, but the helper name and implementation do not make the behavior obvious.  
**Suggestion:** Either rename the helper or split fallback ID construction into a named function like `fallbackFindingIdFor({ phase, bucket, index })`. This makes the R7 uniqueness behavior easier to audit and avoids hiding the policy inside a map callback.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** `canonicalFindingList` generates deterministic fallback IDs for every finding in draft repair-target phases, including existing advisory/blocking lists, not only `repairTargets`. That may be correct, but the helper name and implementation do not make the behavior obvious.  
**Suggestion:** Either rename the helper or split fallback ID construction into a named function like `fallbackFindingIdFor({ phase, bucket, index })`. This makes the R7 uniqueness behavior easier to audit and avoids hiding the policy inside a map callback.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Bound additional artifact deletion
**Finding key:** loop-387e44c7a0d07d145e65
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `additionalArtifacts` is iterated without an explicit count or size bound. Under the `bounded-resource-usage` guardrail, bulk processing should have a clear upper bound.  
**Suggestion:** Define a maximum number of additional artifacts, validate `additionalArtifacts.length` before the loop, and reject oversized input with a clear error. For example, introduce `MAX_ADDITIONAL_ARTIFACTS` near the top of the file.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `additionalArtifacts` is iterated without an explicit count or size bound. Under the `bounded-resource-usage` guardrail, bulk processing should have a clear upper bound.  
**Suggestion:** Define a maximum number of additional artifacts, validate `additionalArtifacts.length` before the loop, and reject oversized input with a clear error. For example, introduce `MAX_ADDITIONAL_ARTIFACTS` near the top of the file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Validate additional artifact paths before deletion
**Finding key:** loop-f6c041c55573d3f227e8
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `path.join(specDir, relativePath)` accepts absolute paths and `..` traversal segments, so a malformed `additionalArtifacts` entry could target files outside `specDir`. Even if callers are internal, this method performs filesystem deletion and should keep the boundary explicit.  
**Suggestion:** Add a helper that requires each artifact path to be a relative normalized path contained under `specDir`, then use that helper before `fs.rmSync`.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `path.join(specDir, relativePath)` accepts absolute paths and `..` traversal segments, so a malformed `additionalArtifacts` entry could target files outside `specDir`. Even if callers are internal, this method performs filesystem deletion and should keep the boundary explicit.  
**Suggestion:** Add a helper that requires each artifact path to be a relative normalized path contained under `specDir`, then use that helper before `fs.rmSync`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 4. Avoid materializing the fingerprint set just to read one value
**Finding key:** loop-b1ae3a99422dfc3c1633
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `previousFingerprint: [...previousFingerprints][0]` allocates an array only to retrieve the single set value.  
**Suggestion:** Replace it with `previousFingerprints.values().next().value` after the `size !== 1` check. This is simpler and avoids unnecessary allocation.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `previousFingerprint: [...previousFingerprints][0]` allocates an array only to retrieve the single set value.  
**Suggestion:** Replace it with `previousFingerprints.values().next().value` after the `size !== 1` check. This is simpler and avoids unnecessary allocation.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Extract recovered evidence-refresh detection
**Finding key:** loop-20c84b55f1852787c0bd
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R8
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The same nested condition for `result?.result === "recovered"` and `result?.artifacts?.evidenceRefresh?.recovered === true` is duplicated in both `run-gate` and `run-review` post hooks.  
**Suggestion:** Add a small local helper such as `isEvidenceRefreshRecovery(result)` and use it in both hooks. This keeps the checkpoint-shaped recovery behavior consistent and makes future changes less error-prone.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The same nested condition for `result?.result === "recovered"` and `result?.artifacts?.evidenceRefresh?.recovered === true` is duplicated in both `run-gate` and `run-review` post hooks.  
**Suggestion:** Add a small local helper such as `isEvidenceRefreshRecovery(result)` and use it in both hooks. This keeps the checkpoint-shaped recovery behavior consistent and makes future changes less error-prone.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Extract Repeated Advisory Recording Assertions
**Finding key:** loop-60a8508843ddbd02e622
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The same canonical recording assertions are repeated in the repair-target loop and checkpoint replay test: disposition value, advisory finding count, finalized evidence, and convergence record count/availability.  
**Suggestion:** Add a small assertion helper such as `assertCompletedAdvisoryRecording(recorded, advisoryCount)` and reuse it in both places. This keeps the tests focused on scenario-specific expectations.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The same canonical recording assertions are repeated in the repair-target loop and checkpoint replay test: disposition value, advisory finding count, finalized evidence, and convergence record count/availability.  
**Suggestion:** Add a small assertion helper such as `assertCompletedAdvisoryRecording(recorded, advisoryCount)` and reuse it in both places. This keeps the tests focused on scenario-specific expectations.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Avoid Inline Artifact Name Branching In The Phase Loop
**Finding key:** loop-eb384033982a291cd110
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R2  
**Issue:** The `phase === "draft-coverage" ? ... : ...` branch inside the loop couples phase selection and artifact naming inline, making the parameterized test slightly harder to scan.  
**Suggestion:** Replace the phase array with explicit cases, for example `{ phase: "draft-questions", artifactName: "draft-review-questions.json" }` and `{ phase: "draft-coverage", artifactName: "draft-review-coverage.json" }`.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R2  
**Issue:** The `phase === "draft-coverage" ? ... : ...` branch inside the loop couples phase selection and artifact naming inline, making the parameterized test slightly harder to scan.  
**Suggestion:** Replace the phase array with explicit cases, for example `{ phase: "draft-questions", artifactName: "draft-review-questions.json" }` and `{ phase: "draft-coverage", artifactName: "draft-review-coverage.json" }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Clarify Fixture Naming Around Classification
**Finding key:** loop-acf3733a45d1b9fb3e63
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R4  
**Issue:** The fixture is named `repairTarget`, but it uses `classification: "repair_target"` while the requirement refers to retaining `category=repair_target`. If both terms are meaningful in the production contract, this test does not make that distinction obvious.  
**Suggestion:** Rename or extend the fixture to make the asserted contract explicit, for example `classifiedRepairTarget`, or include `category: "repair_target"` if that is the canonical field being protected.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R4  
**Issue:** The fixture is named `repairTarget`, but it uses `classification: "repair_target"` while the requirement refers to retaining `category=repair_target`. If both terms are meaningful in the production contract, this test does not make that distinction obvious.  
**Suggestion:** Rename or extend the fixture to make the asserted contract explicit, for example `classifiedRepairTarget`, or include `category: "repair_target"` if that is the canonical field being protected.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 4. Replace Mutable Sentinel With Assert-Rejecting Stub
**Finding key:** loop-4e3df8a2f20055836187
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R8  
**Issue:** The stale evidence recovery test uses a mutable `loaded` flag plus a throwing `load()` method to verify the normal gate lifecycle is skipped. The flag is redundant because any call already fails the test.  
**Suggestion:** Remove `loaded` and the final assertion, leaving `load()` as the assertion boundary with a clear failure message. This simplifies the test without weakening coverage.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R8  
**Issue:** The stale evidence recovery test uses a mutable `loaded` flag plus a throwing `load()` method to verify the normal gate lifecycle is skipped. The flag is redundant because any call already fails the test.  
**Suggestion:** Remove `loaded` and the final assertion, leaving `load()` as the assertion boundary with a clear failure message. This simplifies the test without weakening coverage.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Extract the repeated demo diff fixture
**Finding key:** loop-a1eb5e827cb151067889
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The new acceptance-review tests duplicate near-identical `src/demo.js` unified diff construction inline. This makes later fixture changes more error-prone and adds noise to the test intent.  
**Suggestion:** Add a small local helper such as `demoSourceDiff(before, after)` or `buildDemoDiff(addedLine)` in this test file, and use it in both new tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The new acceptance-review tests duplicate near-identical `src/demo.js` unified diff construction inline. This makes later fixture changes more error-prone and adds noise to the test intent.  
**Suggestion:** Add a small local helper such as `demoSourceDiff(before, after)` or `buildDemoDiff(addedLine)` in this test file, and use it in both new tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Extract the repeated flowManager test double
**Finding key:** loop-1aad2c2507e84c6035ee
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** Multiple new tests define ad hoc `flowManager` objects with similar `mutate()` behavior, and one adds `load()` manually. The duplication obscures which behavior each test actually depends on.  
**Suggestion:** Add a local helper like `makeMutableFlowManager(state, { includeLoad = false } = {})`, or always include `load()` if harmless, then reuse it in the new tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** Multiple new tests define ad hoc `flowManager` objects with similar `mutate()` behavior, and one adds `load()` manually. The duplication obscures which behavior each test actually depends on.  
**Suggestion:** Add a local helper like `makeMutableFlowManager(state, { includeLoad = false } = {})`, or always include `load()` if harmless, then reuse it in the new tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 3. Replace repeated artifact cleanup assertions with a named expected list
**Finding key:** loop-b2175ca5b459519d69df
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The stale fingerprint recovery test embeds a long inline list of artifact filenames inside the assertion loop. This is readable once, but it mixes policy detail with test mechanics and will be harder to reuse if another recovery test needs the same assertion.  
**Suggestion:** Move the list to a named constant or helper near the test, for example `STALE_ACCEPTANCE_ARTIFACTS`, and assert through a helper such as `assertArtifactsRemoved(specDir, STALE_ACCEPTANCE_ARTIFACTS)`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The stale fingerprint recovery test embeds a long inline list of artifact filenames inside the assertion loop. This is readable once, but it mixes policy detail with test mechanics and will be harder to reuse if another recovery test needs the same assertion.  
**Suggestion:** Move the list to a named constant or helper near the test, for example `STALE_ACCEPTANCE_ARTIFACTS`, and assert through a helper such as `assertArtifactsRemoved(specDir, STALE_ACCEPTANCE_ARTIFACTS)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 4. Name the retry metrics fixture by behavior
**Finding key:** loop-3a572d9b0974ce347a9a
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The test creates `Array.from({ length: 5 }, ...)` inline to represent exhausted `task-impl` gate retries. The literal `5` appears both in the metrics setup and `maxAttempts`, so the test intent depends on matching two separate values.  
**Suggestion:** Introduce a local constant such as `const exhaustedAttempts = 5;` and use it for both the metrics length and `maxAttempts`. This makes the scenario intent explicit and avoids accidental divergence.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R1  
**Issue:** The test creates `Array.from({ length: 5 }, ...)` inline to represent exhausted `task-impl` gate retries. The literal `5` appears both in the metrics setup and `maxAttempts`, so the test intent depends on matching two separate values.  
**Suggestion:** Introduce a local constant such as `const exhaustedAttempts = 5;` and use it for both the metrics length and `maxAttempts`. This makes the scenario intent explicit and avoids accidental divergence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Consolidate stale test evidence recovery logic
**Finding key:** loop-b69d9cf68dcbd71cb619
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R8
**Issue:** Stale test evidence validation and recovery appears to be introduced in both `run-gate.js` and `run-review.js`, with similar loading, mismatch detection, recovery routing, and fingerprint checks. This creates cross-file duplication and risks behavior drift between gate and review flows.
**Suggestion:** Extract a shared stale-test-evidence validation/recovery helper, likely near `src/flow/lib/stale-test-evidence-refresh.js`, and parameterize the flow-specific labels, artifact metadata, and return formatting.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`
**Requirement:** R8
**Issue:** Stale test evidence validation and recovery appears to be introduced in both `run-gate.js` and `run-review.js`, with similar loading, mismatch detection, recovery routing, and fingerprint checks. This creates cross-file duplication and risks behavior drift between gate and review flows.
**Suggestion:** Extract a shared stale-test-evidence validation/recovery helper, likely near `src/flow/lib/stale-test-evidence-refresh.js`, and parameterize the flow-specific labels, artifact metadata, and return formatting.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Normalize evidence-refresh result naming
**Finding key:** loop-c719f933ba3e780160c3
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R8
**Issue:** The same recovery concept is named differently across files: `evidenceRefresh` in `run-review.js`, `StaleIntegrationTestEvidence` in `run-gate.js`, and checkpoint recovery metadata in `registry.js`. The names mix artifact metadata, command result, and control-flow result semantics.
**Suggestion:** Use one cross-file naming convention, such as `artifactCheckResult` for command-level early returns and `evidenceRefresh` only for the nested artifact metadata.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R8
**Issue:** The same recovery concept is named differently across files: `evidenceRefresh` in `run-review.js`, `StaleIntegrationTestEvidence` in `run-gate.js`, and checkpoint recovery metadata in `registry.js`. The names mix artifact metadata, command result, and control-flow result semantics.
**Suggestion:** Use one cross-file naming convention, such as `artifactCheckResult` for command-level early returns and `evidenceRefresh` only for the nested artifact metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 3. Share evidence-refresh recovery detection
**Finding key:** loop-8a3a3aaf3e97a834e58d
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R8
**Issue:** **File:** `src/flow/registry.js`
**Requirement:** R8
**Issue:** `run-gate` and `run-review` post hooks duplicate the same nested recovered-result check for `result?.result === "recovered"` and `result?.artifacts?.evidenceRefresh?.recovered === true`.
**Suggestion:** Add a local helper such as `isEvidenceRefreshRecovery(result)` and reuse it in both hook branches.
**Suggestion:** **File:** `src/flow/registry.js`
**Requirement:** R8
**Issue:** `run-gate` and `run-review` post hooks duplicate the same nested recovered-result check for `result?.result === "recovered"` and `result?.artifacts?.evidenceRefresh?.recovered === true`.
**Suggestion:** Add a local helper such as `isEvidenceRefreshRecovery(result)` and reuse it in both hook branches.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 4. Centralize draft repair-target phase policy
**Finding key:** loop-c9f69fe1d31d7b17fa4f
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R1
**Issue:** Draft repair-target phase handling appears in production code and tests as repeated literal phase pairs: `draft-questions` / `draft-coverage`, plus matching artifact-name branches in tests and repeated wording in specs. This spreads one domain policy across files.
**Suggestion:** Introduce a named helper or constant for the phase set, such as `isDraftRepairTargetPhase(phase)` and shared phase cases for tests, then reference that policy consistently in code and specs.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R1
**Issue:** Draft repair-target phase handling appears in production code and tests as repeated literal phase pairs: `draft-questions` / `draft-coverage`, plus matching artifact-name branches in tests and repeated wording in specs. This spreads one domain policy across files.
**Suggestion:** Introduce a named helper or constant for the phase set, such as `isDraftRepairTargetPhase(phase)` and shared phase cases for tests, then reference that policy consistently in code and specs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 5. Align advisory evidence phase helpers with phase-parameterized tests
**Finding key:** loop-571b8e9fc44d33cc8d97
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R2
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R2
**Issue:** Spec-local tests include a generic `advisoryEvidence()` helper fixed to `draft-questions`, while unit tests cover both `draft-questions` and `draft-coverage` with phase-specific artifact names. The helper interface is inconsistent with the broader phase-parameterized behavior.
**Suggestion:** Make advisory evidence helpers accept `phase` explicitly, or rename fixed-phase helpers to make their scope clear.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`
**Requirement:** R2
**Issue:** Spec-local tests include a generic `advisoryEvidence()` helper fixed to `draft-questions`, while unit tests cover both `draft-questions` and `draft-coverage` with phase-specific artifact names. The helper interface is inconsistent with the broader phase-parameterized behavior.
**Suggestion:** Make advisory evidence helpers accept `phase` explicitly, or rename fixed-phase helpers to make their scope clear.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 6. Standardize deterministic advisory fallback ID construction
**Finding key:** loop-08e8517adda53fa74d74
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R7
**Issue:** Deterministic advisory fallback IDs are asserted as repeated literals in both spec-local and unit tests, while production generation is hidden inside `canonicalFindingList`. This creates cross-file coupling to an implicit string format.
**Suggestion:** Extract a named production helper like `fallbackFindingIdFor({ phase, bucket, index })` and mirror expected IDs in tests through a small helper rather than repeating string literals.
**Suggestion:** **File:** `src/flow/lib/run-review.js`
**Requirement:** R7
**Issue:** Deterministic advisory fallback IDs are asserted as repeated literals in both spec-local and unit tests, while production generation is hidden inside `canonicalFindingList`. This creates cross-file coupling to an implicit string format.
**Suggestion:** Extract a named production helper like `fallbackFindingIdFor({ phase, bucket, index })` and mirror expected IDs in tests through a small helper rather than repeating string literals.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
