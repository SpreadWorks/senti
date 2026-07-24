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

### 4. 1. Bound Runtime History Collections
**Finding key:** loop-0a957c3da534591953f5
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` are append-only runtime collections and the diff commits thousands of lines of accumulated execution history. This violates the bounded-resource-usage guardrail because the snapshot can grow without an explicit cap.
**Suggestion:** Store only the current canonical state plus a bounded recent history window, for example latest N attempts per phase/task and latest N metrics per phase, or move full audit history to external artifacts not committed in the flow snapshot.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` are append-only runtime collections and the diff commits thousands of lines of accumulated execution history. This violates the bounded-resource-usage guardrail because the snapshot can grow without an explicit cap.
**Suggestion:** Store only the current canonical state plus a bounded recent history window, for example latest N attempts per phase/task and latest N metrics per phase, or move full audit history to external artifacts not committed in the flow snapshot.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Deduplicate Repeated Evidence Identity Blocks
**Finding key:** loop-1562fec129d788898d9e
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** Each handoff finding repeats the same `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, `finalDispositionOwner`, and provenance data already present on the parent convergence record. This creates large duplicate JSON blocks and makes consistency harder to maintain.
**Suggestion:** Keep shared evidence metadata on the parent `reviewConvergence.records[]` entry and let each `handoffFindings[]` item contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** Each handoff finding repeats the same `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, `finalDispositionOwner`, and provenance data already present on the parent convergence record. This creates large duplicate JSON blocks and makes consistency harder to maintain.
**Suggestion:** Keep shared evidence metadata on the parent `reviewConvergence.records[]` entry and let each `handoffFindings[]` item contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Remove Stale Runtime Logs From Pending Steps
**Finding key:** loop-87c43b54bf3e8da84cd3
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** Several pending steps include `runtimeLog` entries from prior executions, such as `impl-gate`, `retro`, and `acceptance-review`. A pending step carrying a completed runtime log is confusing and makes the state model inconsistent.
**Suggestion:** Clear `runtimeLog` when a step is reset to `pending`, or move historical logs exclusively into bounded `stepAttempts`/audit history.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** Several pending steps include `runtimeLog` entries from prior executions, such as `impl-gate`, `retro`, and `acceptance-review`. A pending step carrying a completed runtime log is confusing and makes the state model inconsistent.
**Suggestion:** Clear `runtimeLog` when a step is reset to `pending`, or move historical logs exclusively into bounded `stepAttempts`/audit history.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Normalize Duplicate Issue-Log Recovery Data
**Finding key:** loop-e3e45f2509528a2283b4
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R1
**Issue:** Retry recovery data is stored both in `flow.json.retryRecovery.entries` and again as a full `issue-log.json` entry, duplicating the same `changedEvidence`, counters, command, and timestamps.
**Suggestion:** In `issue-log.json`, record a concise reference to the recovery entry ID and short reason, leaving the full structured recovery payload in one canonical location.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R1
**Issue:** Retry recovery data is stored both in `flow.json.retryRecovery.entries` and again as a full `issue-log.json` entry, duplicating the same `changedEvidence`, counters, command, and timestamps.
**Suggestion:** In `issue-log.json`, record a concise reference to the recovery entry ID and short reason, leaving the full structured recovery payload in one canonical location.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Standardize Step Naming
**Finding key:** loop-f9e48712cfd999d86958
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R1
**Issue:** Step names mix hyphen and dotted forms, for example `task.impl`, `task-impl`, `task-review`, and `impl-gate`. This makes filtering and correlation with `flow.json.steps` less reliable.
**Suggestion:** Normalize all `step` values to the canonical step IDs used in `flow.json`, such as `task-impl`, and avoid alternate spelling in log entries.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R1
**Issue:** Step names mix hyphen and dotted forms, for example `task.impl`, `task-impl`, `task-review`, and `impl-gate`. This makes filtering and correlation with `flow.json.steps` less reliable.
**Suggestion:** Normalize all `step` values to the canonical step IDs used in `flow.json`, such as `task-impl`, and avoid alternate spelling in log entries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 1. Avoid Phase Default Masking
**Finding key:** loop-792450dfc16ab94c2b5c
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R2
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R2  
**Issue:** `DraftReviewFixture` maps every phase except `"draft-coverage"` to `"draft-review-questions.json"`, which can silently hide misspelled or unsupported phases in tests.  
**Suggestion:** Replace the ternary with an explicit phase-to-artifact map and throw for unknown phases.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R2  
**Issue:** `DraftReviewFixture` maps every phase except `"draft-coverage"` to `"draft-review-questions.json"`, which can silently hide misspelled or unsupported phases in tests.  
**Suggestion:** Replace the ternary with an explicit phase-to-artifact map and throw for unknown phases.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 2. Parameterize Review Evidence Phase
**Finding key:** loop-ffd8088a5a6669b5720e
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R7
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R7  
**Issue:** `advisoryEvidence()` hardcodes `phase: "draft-questions"`, even though the fixture supports both `draft-questions` and `draft-coverage`. This makes evidence identity less reusable and can obscure phase-specific duplicate behavior.  
**Suggestion:** Accept `phase` as an argument, defaulting to `"draft-questions"`, and pass the fixture phase where relevant.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R7  
**Issue:** `advisoryEvidence()` hardcodes `phase: "draft-questions"`, even though the fixture supports both `draft-questions` and `draft-coverage`. This makes evidence identity less reusable and can obscure phase-specific duplicate behavior.  
**Suggestion:** Accept `phase` as an argument, defaulting to `"draft-questions"`, and pass the fixture phase where relevant.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 3. Extract Canonical Disposition Setup
**Finding key:** loop-6d8ddece8f743286a98c
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js
**Requirement:** R6
**Issue:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R6  
**Issue:** Several tests repeat the pattern of building a fixture, canonicalizing findings, and creating `ReviewDisposition`. The duplication makes invariant-focused tests harder to scan.  
**Suggestion:** Add a small helper such as `draftDisposition({ phase, verdict, blockingFindings, advisoryFindings, repairTargets })` and use it in R1/R2/R5/R6/R7 cases.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/tests/draft-repair-target-recording.test.js`  
**Requirement:** R6  
**Issue:** Several tests repeat the pattern of building a fixture, canonicalizing findings, and creating `ReviewDisposition`. The duplication makes invariant-focused tests harder to scan.  
**Suggestion:** Add a small helper such as `draftDisposition({ phase, verdict, blockingFindings, advisoryFindings, repairTargets })` and use it in R1/R2/R5/R6/R7 cases.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 4. Replace Repeated Proposal Heading Literal With A Constant
**Finding key:** loop-809b6494b64042c7ff84
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** The proposal heading marker `"### "` and regex `/^### /m` are now spread across `stripProposalPreamble`, `parseProposals`, and `providerOutputInvalid`. This is small duplication, but parser behavior depends on the exact marker.  
**Suggestion:** Define shared constants such as `PROPOSAL_HEADING = "### "` and `PROPOSAL_HEADING_RE = /^### /m`, then use them in all proposal parsing/validation paths.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** The proposal heading marker `"### "` and regex `/^### /m` are now spread across `stripProposalPreamble`, `parseProposals`, and `providerOutputInvalid`. This is small duplication, but parser behavior depends on the exact marker.  
**Suggestion:** Define shared constants such as `PROPOSAL_HEADING = "### "` and `PROPOSAL_HEADING_RE = /^### /m`, then use them in all proposal parsing/validation paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Avoid Ambiguous Previous Fingerprint Selection
**Finding key:** loop-741f091fdc252c4b136f
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `AcceptanceEvidenceRefresh` sets `previousFingerprint` from the first stale artifact only. If multiple stale artifacts exist with different `repairFingerprint` values, recovery runs with an arbitrary previous fingerprint while `staleArtifacts` implies all stale inputs are covered.  
**Suggestion:** Validate that all stale artifacts share the same previous fingerprint before setting `required`, or group refresh recovery by previous fingerprint. If mixed fingerprints are unsupported, make `required` false and surface a mechanical blocker instead.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `AcceptanceEvidenceRefresh` sets `previousFingerprint` from the first stale artifact only. If multiple stale artifacts exist with different `repairFingerprint` values, recovery runs with an arbitrary previous fingerprint while `staleArtifacts` implies all stale inputs are covered.  
**Suggestion:** Validate that all stale artifacts share the same previous fingerprint before setting `required`, or group refresh recovery by previous fingerprint. If mixed fingerprints are unsupported, make `required` false and surface a mechanical blocker instead.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 2. Extract Canonical Projection Cache Helper
**Finding key:** loop-06fe9a0eb11634f3a48c
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `inspectDeferredSources` now has two near-identical blocks that populate `canonicalCache` and construct `CanonicalReviewEvidenceProjection`. This makes future changes to canonical evidence lookup easy to miss in one branch.  
**Suggestion:** Add a local helper such as `canonicalProjectionFor(record)` that handles the cache lookup/construction, then use it in both the `handoff` and `canonicalRecord` branches.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `inspectDeferredSources` now has two near-identical blocks that populate `canonicalCache` and construct `CanonicalReviewEvidenceProjection`. This makes future changes to canonical evidence lookup easy to miss in one branch.  
**Suggestion:** Add a local helper such as `canonicalProjectionFor(record)` that handles the cache lookup/construction, then use it in both the `handoff` and `canonicalRecord` branches.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 3. Add Explicit Bounds To Deferred Source Aggregation
**Finding key:** loop-73233b26e57134604fde
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `DeferredFindingSources` eagerly maps all flow findings and review handoffs into arrays/maps without an explicit count bound. This newly centralized bulk processing touches artifact-derived data and should satisfy the `bounded-resource-usage` guardrail.  
**Suggestion:** Introduce a module-level maximum for deferred source entries or reuse an existing artifact entry cap if one exists in this file, and fail with a clear mechanical blocker/error when the cap is exceeded.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `DeferredFindingSources` eagerly maps all flow findings and review handoffs into arrays/maps without an explicit count bound. This newly centralized bulk processing touches artifact-derived data and should satisfy the `bounded-resource-usage` guardrail.  
**Suggestion:** Introduce a module-level maximum for deferred source entries or reuse an existing artifact entry cap if one exists in this file, and fail with a clear mechanical blocker/error when the cap is exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 1. Extract shared display phase construction
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

### 17. 2. Avoid recursive flattening for a single step lookup
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

### 18. 3. Clarify scoped step naming
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

### 19. 2. Use a more explicit helper name
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

### 20. 1. Simplify repeated evidence refresh access
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

### 21. 1. Extract Shared Test Evidence Validation
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

### 22. 2. Avoid Exposing A Single-Use Internal Class
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

### 23. 3. Rename `evidenceRefresh` For Result Semantics
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

### 24. 4. Replace Phase Set With Predicate Helper
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

### 25. 5. Clarify `canonicalFindingList` Fallback Scope
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

### 26. 2. Bound additional artifact deletion
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

### 27. 3. Validate additional artifact paths before deletion
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

### 28. 4. Avoid materializing the fingerprint set just to read one value
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

### 29. 1. Extract recovered evidence-refresh detection
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

### 30. 1. Extract Repeated Advisory Recording Assertions
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

### 31. 2. Avoid Inline Artifact Name Branching In The Phase Loop
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

### 32. 3. Clarify Fixture Naming Around Classification
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

### 33. 4. Replace Mutable Sentinel With Assert-Rejecting Stub
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

### 34. 1. Extract repeated flow manager test doubles
**Finding key:** loop-f696418c6be1a3e54b8a
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The added tests define small `flowManager` doubles inline with nearly identical `mutate()` behavior, and one adds `load()`. This duplicates setup logic and makes future changes to flow-manager expectations more error-prone.  
**Suggestion:** Add a local helper such as `makeMutableFlowManager(state)` near the existing test helpers, optionally accepting `{ withLoad: true }`, and reuse it in both acceptance/integration recovery tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The added tests define small `flowManager` doubles inline with nearly identical `mutate()` behavior, and one adds `load()`. This duplicates setup logic and makes future changes to flow-manager expectations more error-prone.  
**Suggestion:** Add a local helper such as `makeMutableFlowManager(state)` near the existing test helpers, optionally accepting `{ withLoad: true }`, and reuse it in both acceptance/integration recovery tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Extract stale artifact absence assertions
**Finding key:** loop-3aa6fe283bec00949500
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The new stale-evidence tests assert deletion of several known artifacts using repeated `fs.existsSync(path.join(...))` checks. This makes the expected cleanup contract harder to scan and easy to partially duplicate.  
**Suggestion:** Add a local assertion helper, for example `assertArtifactsAbsent(specDir, relativePaths)`, and use it for both recovery tests. Keep the path list at call sites so each scenario remains explicit.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R1  
**Issue:** The new stale-evidence tests assert deletion of several known artifacts using repeated `fs.existsSync(path.join(...))` checks. This makes the expected cleanup contract harder to scan and easy to partially duplicate.  
**Suggestion:** Add a local assertion helper, for example `assertArtifactsAbsent(specDir, relativePaths)`, and use it for both recovery tests. Keep the path list at call sites so each scenario remains explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 3. Use a named helper for changed-file fingerprint construction
**Finding key:** loop-aece6c5267ef29d1387e
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R4  
**Issue:** The integration-gate test builds a `changedFile` object inline, including the SHA-256 fingerprint calculation. That fixture detail distracts from the behavior under test and may be duplicated by future stale-fingerprint tests.  
**Suggestion:** Extract a small local helper such as `makeChangedFile(path, source)` that returns `{ status: "modified", path, fingerprint }`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R4  
**Issue:** The integration-gate test builds a `changedFile` object inline, including the SHA-256 fingerprint calculation. That fixture detail distracts from the behavior under test and may be duplicated by future stale-fingerprint tests.  
**Suggestion:** Extract a small local helper such as `makeChangedFile(path, source)` that returns `{ status: "modified", path, fingerprint }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Replace magic metric count with named intent
**Finding key:** loop-51025541e2acbd15e656
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** `Array.from({ length: 5 }, ...)` relies on the reader connecting `5` to `maxAttempts: 5`. The test intent is “exhausted task phase should not control active gate display,” but the repeated numeric literal obscures that.  
**Suggestion:** Introduce `const exhaustedTaskAttempts = 5;` and use it for both the metric array length and `maxAttempts`. This keeps the bounded resource explicit while making the scenario clearer.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R4  
**Issue:** `Array.from({ length: 5 }, ...)` relies on the reader connecting `5` to `maxAttempts: 5`. The test intent is “exhausted task phase should not control active gate display,” but the repeated numeric literal obscures that.  
**Suggestion:** Introduce `const exhaustedTaskAttempts = 5;` and use it for both the metric array length and `maxAttempts`. This keeps the bounded resource explicit while making the scenario clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 1. Standardize Step ID Format Across Runtime State And Logs
**Finding key:** loop-f758f46a19af7f94ab21
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R1  
**Issue:** Step names are reported as inconsistent in `issue-log.json` (`task.impl`, `task-impl`, `task-review`, `impl-gate`) while other proposals refer to canonical step IDs from `flow.json.steps`. This is a cross-file correlation problem because runtime state, issue logs, and recovery displays depend on matching step identity.  
**Suggestion:** Use the canonical `flow.json.steps` IDs everywhere, and add a small normalization/assertion boundary where issue-log entries are created so dotted aliases cannot be written.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R1  
**Issue:** Step names are reported as inconsistent in `issue-log.json` (`task.impl`, `task-impl`, `task-review`, `impl-gate`) while other proposals refer to canonical step IDs from `flow.json.steps`. This is a cross-file correlation problem because runtime state, issue logs, and recovery displays depend on matching step identity.  
**Suggestion:** Use the canonical `flow.json.steps` IDs everywhere, and add a small normalization/assertion boundary where issue-log entries are created so dotted aliases cannot be written.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 2. Centralize Stale Evidence Recovery Logic
**Finding key:** loop-10452052e5cb4bdafcee
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** Multiple summaries identify near-duplicate stale evidence refresh/recovery behavior across `run-gate.js`, `run-review.js`, `stale-test-evidence-refresh.js`, and `registry.js`. The duplicated checks include artifact loading, mismatch detection, recovery result shaping, fingerprint handling, and post-hook recovery detection.  
**Suggestion:** Extract a shared stale evidence recovery helper that owns the common artifact validation, fingerprint comparison, recovery result shape, and `isEvidenceRefreshRecovery(result)` predicate. Keep only command-specific labels and return metadata at the call sites.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** Multiple summaries identify near-duplicate stale evidence refresh/recovery behavior across `run-gate.js`, `run-review.js`, `stale-test-evidence-refresh.js`, and `registry.js`. The duplicated checks include artifact loading, mismatch detection, recovery result shaping, fingerprint handling, and post-hook recovery detection.  
**Suggestion:** Extract a shared stale evidence recovery helper that owns the common artifact validation, fingerprint comparison, recovery result shape, and `isEvidenceRefreshRecovery(result)` predicate. Keep only command-specific labels and return metadata at the call sites.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 3. Normalize Draft Repair Target Phase Policy
**Finding key:** loop-c699dcf5bb996bbf8ca8
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R7
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** Draft repair-target phase handling appears in several places with slightly different forms: `DRAFT_REPAIR_TARGET_PHASES.has(phase)` in production code, hardcoded `draft-questions` evidence in test fixtures, phase-to-artifact ternaries in tests, and repeated phase pair wording in the spec draft. This makes the target phase contract easy to drift across code, tests, and spec data.  
**Suggestion:** Introduce a named helper or canonical map for draft repair-target phases and their artifacts, such as `isDraftRepairTargetPhase(phase)` plus a `DraftReviewArtifactMap`. Reuse it in production code and test fixtures, and reference the same concept in the spec text.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R7  
**Issue:** Draft repair-target phase handling appears in several places with slightly different forms: `DRAFT_REPAIR_TARGET_PHASES.has(phase)` in production code, hardcoded `draft-questions` evidence in test fixtures, phase-to-artifact ternaries in tests, and repeated phase pair wording in the spec draft. This makes the target phase contract easy to drift across code, tests, and spec data.  
**Suggestion:** Introduce a named helper or canonical map for draft repair-target phases and their artifacts, such as `isDraftRepairTargetPhase(phase)` plus a `DraftReviewArtifactMap`. Reuse it in production code and test fixtures, and reference the same concept in the spec text.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 4. Bound Runtime And Artifact Collections Consistently
**Finding key:** loop-5d719ecb55c90dd74414
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R1  
**Issue:** Several files introduce or persist unbounded collections: `flow.json` runtime history, deferred source aggregation in `acceptance-review-artifacts.js`, recursive step flattening in `get-next-action.js`, and additional artifact deletion in `stale-test-evidence-refresh.js`. The same bounded-resource requirement is being handled inconsistently across state, traversal, and filesystem cleanup paths.  
**Suggestion:** Define shared caps for flow history, deferred source entries, step traversal, and additional artifacts. Enforce those limits at write/aggregation boundaries and fail with a clear mechanical blocker when exceeded.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R1  
**Issue:** Several files introduce or persist unbounded collections: `flow.json` runtime history, deferred source aggregation in `acceptance-review-artifacts.js`, recursive step flattening in `get-next-action.js`, and additional artifact deletion in `stale-test-evidence-refresh.js`. The same bounded-resource requirement is being handled inconsistently across state, traversal, and filesystem cleanup paths.  
**Suggestion:** Define shared caps for flow history, deferred source entries, step traversal, and additional artifacts. Enforce those limits at write/aggregation boundaries and fail with a clear mechanical blocker when exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 5. Use One Canonical Evidence Metadata Location
**Finding key:** loop-87ffed59c7a7f00743a0
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R1  
**Issue:** Evidence identity and recovery metadata are duplicated across `flow.json.reviewConvergence.records[].handoffFindings[]`, parent convergence records, and `issue-log.json`. Related production proposals also mention canonical projection caching and advisory evidence phase handling, so evidence identity is currently spread across multiple layers.  
**Suggestion:** Store shared evidence identity once on the parent canonical record and let findings/logs reference it by ID or digest. Keep finding-specific data local, and make projection helpers read from that canonical location.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R1  
**Issue:** Evidence identity and recovery metadata are duplicated across `flow.json.reviewConvergence.records[].handoffFindings[]`, parent convergence records, and `issue-log.json`. Related production proposals also mention canonical projection caching and advisory evidence phase handling, so evidence identity is currently spread across multiple layers.  
**Suggestion:** Store shared evidence identity once on the parent canonical record and let findings/logs reference it by ID or digest. Keep finding-specific data local, and make projection helpers read from that canonical location.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 6. Align Repair Target Terminology In Code And Tests
**Finding key:** loop-c0dd4edde5cf8021abbc
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R4  
**Issue:** The summaries mention `repairTarget`, `classification: "repair_target"`, `category=repair_target`, `repairTargets`, and draft repair-target phases. Across tests and production review code, it is unclear which term is the external contract and which is an internal classification.  
**Suggestion:** Pick canonical names for the concept, for example `repairTargets` for the list and `classification: "repair_target"` for the finding field. Rename fixtures and assertions so they explicitly protect the same contract used by production code.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R4  
**Issue:** The summaries mention `repairTarget`, `classification: "repair_target"`, `category=repair_target`, `repairTargets`, and draft repair-target phases. Across tests and production review code, it is unclear which term is the external contract and which is an internal classification.  
**Suggestion:** Pick canonical names for the concept, for example `repairTargets` for the list and `classification: "repair_target"` for the finding field. Rename fixtures and assertions so they explicitly protect the same contract used by production code.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
