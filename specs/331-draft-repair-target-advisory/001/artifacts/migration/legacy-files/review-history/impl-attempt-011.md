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
**Finding key:** loop-cc2b80f2ab09aa4cc7f0
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records`, `stepAttempts`, and nested `handoffFindings` are append-only runtime histories. The file has grown to 7,452 lines and contains many repeated historical review findings, which violates the bounded-resource-usage guardrail unless the flow schema enforces explicit retention limits.  
**Suggestion:** Store only the latest effective record plus a bounded `history` window per phase/task, or add explicit caps such as max records per phase, max handoff findings per record, and max metrics retained per run.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R8  
**Issue:** `metrics`, `reviewConvergence.records`, `stepAttempts`, and nested `handoffFindings` are append-only runtime histories. The file has grown to 7,452 lines and contains many repeated historical review findings, which violates the bounded-resource-usage guardrail unless the flow schema enforces explicit retention limits.  
**Suggestion:** Store only the latest effective record plus a bounded `history` window per phase/task, or add explicit caps such as max records per phase, max handoff findings per record, and max metrics retained per run.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Deduplicate Evidence Identity Blocks
**Finding key:** loop-27b28181cbca7889b49c
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R3  
**Issue:** Each review convergence record repeats the same evidence metadata across `evidenceIdentity`, `evidenceHistory[0]`, `canonicalEvidenceRef`, and every `handoffFindings[*]` entry. This makes the snapshot noisy and increases the chance of inconsistent metadata during repair.  
**Suggestion:** Keep canonical evidence metadata once at the convergence-record level and let handoff findings reference it by `evidenceDigest` or `canonicalEvidenceRef` only.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R3  
**Issue:** Each review convergence record repeats the same evidence metadata across `evidenceIdentity`, `evidenceHistory[0]`, `canonicalEvidenceRef`, and every `handoffFindings[*]` entry. This makes the snapshot noisy and increases the chance of inconsistent metadata during repair.  
**Suggestion:** Keep canonical evidence metadata once at the convergence-record level and let handoff findings reference it by `evidenceDigest` or `canonicalEvidenceRef` only.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Remove Stale Runtime Logs From Pending Steps
**Finding key:** loop-26d065c98b57cfbe2b24
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R1  
**Issue:** Several steps marked `pending` still contain `runtimeLog` entries from previous executions, such as `impl-gate`, `retro`, and `acceptance-review`. That mixes current state with stale execution history and makes lifecycle status harder to reason about.  
**Suggestion:** Move historical execution logs into `stepAttempts` or a bounded audit collection, and keep pending step nodes free of `runtimeLog` unless the current activation has actually started.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R1  
**Issue:** Several steps marked `pending` still contain `runtimeLog` entries from previous executions, such as `impl-gate`, `retro`, and `acceptance-review`. That mixes current state with stale execution history and makes lifecycle status harder to reason about.  
**Suggestion:** Move historical execution logs into `stepAttempts` or a bounded audit collection, and keep pending step nodes free of `runtimeLog` unless the current activation has actually started.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Normalize Duplicate Issue-Log Recovery Data
**Finding key:** loop-9507975c3db87e8343ca
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** The `retry-recovery` entry duplicates data already represented in `flow.json.retryRecovery.entries`, including `changedEvidence`, counters, and recovery command text. This creates two sources of truth for the same recovery event.  
**Suggestion:** In `issue-log.json`, keep a compact event reference such as `grantId`, `reason`, and `timestamp`, and leave detailed retry recovery state in `flow.json`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R8  
**Issue:** The `retry-recovery` entry duplicates data already represented in `flow.json.retryRecovery.entries`, including `changedEvidence`, counters, and recovery command text. This creates two sources of truth for the same recovery event.  
**Suggestion:** In `issue-log.json`, keep a compact event reference such as `grantId`, `reason`, and `timestamp`, and leave detailed retry recovery state in `flow.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Standardize Step Naming
**Finding key:** loop-20b6623c4ef93abdf7a2
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R4
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R4  
**Issue:** Step names use mixed formats, for example `task.impl`, `task-impl`, `spec-gate`, and `retry-recovery`. The rest of the flow state mostly uses kebab-case step IDs.  
**Suggestion:** Normalize `step` values to the canonical flow step IDs, especially changing `task.impl` to `task-impl`, so issue-log entries can be joined reliably with `flow.json.steps` and `stepAttempts`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R4  
**Issue:** Step names use mixed formats, for example `task.impl`, `task-impl`, `spec-gate`, and `retry-recovery`. The rest of the flow state mostly uses kebab-case step IDs.  
**Suggestion:** Normalize `step` values to the canonical flow step IDs, especially changing `task.impl` to `task-impl`, so issue-log entries can be joined reliably with `flow.json.steps` and `stepAttempts`.
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

### 26. 1. Add an explicit bound for artifact scans
**Finding key:** loop-3429a673b4dd7b6ea8d1
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `StaleTestEvidenceMismatch.detect()` iterates over every entry in `artifacts` without an explicit upper bound. That violates the `bounded-resource-usage` guardrail for bulk processing, even if the expected artifact set is normally small.  
**Suggestion:** Define a local maximum such as `MAX_REPAIR_ARTIFACTS` and fail fast when the artifact count exceeds it before scanning. If `artifacts` is not always countable, track the loop count and throw once the limit is exceeded.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `StaleTestEvidenceMismatch.detect()` iterates over every entry in `artifacts` without an explicit upper bound. That violates the `bounded-resource-usage` guardrail for bulk processing, even if the expected artifact set is normally small.  
**Suggestion:** Define a local maximum such as `MAX_REPAIR_ARTIFACTS` and fail fast when the artifact count exceeds it before scanning. If `artifacts` is not always countable, track the loop count and throw once the limit is exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 2. Add an explicit bound for additional artifact deletion
**Finding key:** loop-8f1a34298b8068bc656a
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `recover()` accepts `additionalArtifacts` and maps/deletes all entries without a count bound. This is another bulk operation covered by the `bounded-resource-usage` guardrail.  
**Suggestion:** Add a maximum such as `MAX_ADDITIONAL_ARTIFACTS`, validate `additionalArtifacts.length` before constructing `AdditionalArtifactDeletion` instances, and throw a clear error if exceeded.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `recover()` accepts `additionalArtifacts` and maps/deletes all entries without a count bound. This is another bulk operation covered by the `bounded-resource-usage` guardrail.  
**Suggestion:** Add a maximum such as `MAX_ADDITIONAL_ARTIFACTS`, validate `additionalArtifacts.length` before constructing `AdditionalArtifactDeletion` instances, and throw a clear error if exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 3. Extract repeated recovered evidence-refresh checks
**Finding key:** loop-0c184234317546ddc7a2
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R8
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The condition `result?.result === "recovered" && result?.artifacts?.evidenceRefresh?.recovered === true` is duplicated in two registry hooks. This makes the lifecycle-skip rule easier to drift if one hook changes later.  
**Suggestion:** Extract a small helper in `src/flow/registry.js`, for example `isEvidenceRefreshRecoveryResult(result)`, and use it in both `post()` hooks.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The condition `result?.result === "recovered" && result?.artifacts?.evidenceRefresh?.recovered === true` is duplicated in two registry hooks. This makes the lifecycle-skip rule easier to drift if one hook changes later.  
**Suggestion:** Extract a small helper in `src/flow/registry.js`, for example `isEvidenceRefreshRecoveryResult(result)`, and use it in both `post()` hooks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 1. Extract Repeated Advisory Recording Assertions
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

### 30. 2. Avoid Inline Artifact Name Branching In The Phase Loop
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

### 31. 3. Clarify Fixture Naming Around Classification
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

### 32. 4. Replace Mutable Sentinel With Assert-Rejecting Stub
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

### 33. 1. Extract repeated flow manager test doubles
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

### 34. 2. Extract stale artifact absence assertions
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

### 35. 3. Use a named helper for changed-file fingerprint construction
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

### 36. 4. Replace magic metric count with named intent
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

### 37. 1. Extract Stale Artifact Filenames
**Finding key:** loop-d71de41d59643841a6e1
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R1  
**Issue:** The stale artifact filenames are duplicated between the file creation loop, the expected `staleArtifacts` assertion, and the `existsSync` cleanup assertions. This makes the test more brittle if the artifact set changes.  
**Suggestion:** Define a local `const staleArtifactFiles = [...]` and reuse it for writing, asserting, and existence checks.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R1  
**Issue:** The stale artifact filenames are duplicated between the file creation loop, the expected `staleArtifacts` assertion, and the `existsSync` cleanup assertions. This makes the test more brittle if the artifact set changes.  
**Suggestion:** Define a local `const staleArtifactFiles = [...]` and reuse it for writing, asserting, and existence checks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Split Absolute And Traversal Path Cases
**Finding key:** loop-3e67717ebafc748be61d
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R1  
**Issue:** The loop tests two distinct validation behaviors, path traversal and absolute outside path, but both failures are reported under the same assertion location and use the same `additionalArtifacts[0]` index.  
**Suggestion:** Use `test()`/`subtest()` cases or an array of named cases so failures identify whether the broken behavior is traversal rejection or absolute-path rejection.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R1  
**Issue:** The loop tests two distinct validation behaviors, path traversal and absolute outside path, but both failures are reported under the same assertion location and use the same `additionalArtifacts[0]` index.  
**Suggestion:** Use `test()`/`subtest()` cases or an array of named cases so failures identify whether the broken behavior is traversal rejection or absolute-path rejection.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Prefer Descriptive Test Fixture Names
**Finding key:** loop-2bf113cf688d9cb2467b
**Failure mode:** refactor
**File:** tests/unit/flow/stale-test-evidence-refresh.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R2  
**Issue:** The module-level variable `tmp` is terse and less descriptive than the rest of the test naming.  
**Suggestion:** Rename it to `tmpDir` to match its role and align with helper names like `createTmpDir` and `removeTmpDir`.
**Suggestion:** **File:** `tests/unit/flow/stale-test-evidence-refresh.test.js`  
**Requirement:** R2  
**Issue:** The module-level variable `tmp` is terse and less descriptive than the rest of the test naming.  
**Suggestion:** Rename it to `tmpDir` to match its role and align with helper names like `createTmpDir` and `removeTmpDir`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 1. Extract Repeated Run Metadata
**Finding key:** loop-55c5d50df1e1a8638bb3
**Failure mode:** refactor
**File:** tests/unit/flow/step-outcome.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/step-outcome.test.js`  
**Requirement:** R1  
**Issue:** The new test repeats `"run-reactivated-419"` and embeds the related spec path inline, which makes future fixture changes more error-prone.  
**Suggestion:** Introduce local constants such as `const runId = "run-reactivated-419";` and `const spec = "specs/419-reactivated/spec.json";`, then reuse them in `StepAttempt` construction and `flowState`.
**Suggestion:** **File:** `tests/unit/flow/step-outcome.test.js`  
**Requirement:** R1  
**Issue:** The new test repeats `"run-reactivated-419"` and embeds the related spec path inline, which makes future fixture changes more error-prone.  
**Suggestion:** Introduce local constants such as `const runId = "run-reactivated-419";` and `const spec = "specs/419-reactivated/spec.json";`, then reuse them in `StepAttempt` construction and `flowState`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 2. Clarify Attempt Variable Names
**Finding key:** loop-404e4e44374ad183c80f
**Failure mode:** refactor
**File:** tests/unit/flow/step-outcome.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/step-outcome.test.js`  
**Requirement:** R1  
**Issue:** `blocked` and `recovery` describe outcome types loosely, but the test’s intent depends on activation ordering and step ownership.  
**Suggestion:** Rename them to something more specific, such as `previousReviewAttempt` and `repairDecisionAttempt`, so the stale-outcome scenario is clear without rereading each constructor.
**Suggestion:** **File:** `tests/unit/flow/step-outcome.test.js`  
**Requirement:** R1  
**Issue:** `blocked` and `recovery` describe outcome types loosely, but the test’s intent depends on activation ordering and step ownership.  
**Suggestion:** Rename them to something more specific, such as `previousReviewAttempt` and `repairDecisionAttempt`, so the stale-outcome scenario is clear without rereading each constructor.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 1. Consolidate stale evidence recovery flow
**Finding key:** loop-6f0a701f94e9f750a7db
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** Stale evidence recovery logic is being introduced across `run-gate.js`, `run-review.js`, `stale-test-evidence-refresh.js`, and registry hooks with overlapping responsibilities: stale detection, recovery routing, artifact deletion, fingerprint checks, and lifecycle skipping. This creates multiple places where recovery semantics can drift.  
**Suggestion:** Extract a shared stale-test-evidence recovery helper/result type used by gate and review paths, with bounded artifact scanning/deletion enforced in one place and a single predicate for recovered evidence-refresh results.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** Stale evidence recovery logic is being introduced across `run-gate.js`, `run-review.js`, `stale-test-evidence-refresh.js`, and registry hooks with overlapping responsibilities: stale detection, recovery routing, artifact deletion, fingerprint checks, and lifecycle skipping. This creates multiple places where recovery semantics can drift.  
**Suggestion:** Extract a shared stale-test-evidence recovery helper/result type used by gate and review paths, with bounded artifact scanning/deletion enforced in one place and a single predicate for recovered evidence-refresh results.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 2. Standardize draft phase to artifact mapping
**Finding key:** loop-f2f120b3126ebb7bbf36
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R2  
**Issue:** Multiple files encode draft phase artifact selection with inline conditionals or defaults, including `draft-repair-target-recording.test.js` and `review.test.js`. The mappings for `draft-questions` and `draft-coverage` are duplicated and one default path can mask unknown phases.  
**Suggestion:** Use an explicit phase-to-artifact map helper in each relevant test module, or a shared fixture helper if available, and throw on unknown phases.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R2  
**Issue:** Multiple files encode draft phase artifact selection with inline conditionals or defaults, including `draft-repair-target-recording.test.js` and `review.test.js`. The mappings for `draft-questions` and `draft-coverage` are duplicated and one default path can mask unknown phases.  
**Suggestion:** Use an explicit phase-to-artifact map helper in each relevant test module, or a shared fixture helper if available, and throw on unknown phases.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 3. Normalize step identifier format across flow artifacts
**Finding key:** loop-b7487a3413104e4b616b
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R4
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R4  
**Issue:** Runtime/spec artifacts use inconsistent step naming formats across `flow.json` and `issue-log.json`, such as `task.impl`, `task-impl`, `spec-gate`, and `retry-recovery`. This makes cross-file joins against `flow.json.steps` and `stepAttempts` unreliable.  
**Suggestion:** Normalize issue-log `step` values to canonical flow step IDs, especially replacing dotted names like `task.impl` with the canonical kebab-case form.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R4  
**Issue:** Runtime/spec artifacts use inconsistent step naming formats across `flow.json` and `issue-log.json`, such as `task.impl`, `task-impl`, `spec-gate`, and `retry-recovery`. This makes cross-file joins against `flow.json.steps` and `stepAttempts` unreliable.  
**Suggestion:** Normalize issue-log `step` values to canonical flow step IDs, especially replacing dotted names like `task.impl` with the canonical kebab-case form.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 4. Share proposal parsing constants
**Finding key:** loop-b68d16cc49e89c760825
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** Proposal heading parsing is duplicated in provider parsing/validation code, while the review contract requires strict proposal formatting across aggregated file-review output and cross-file-review output. Small divergence in `"### "` handling could cause one review stage to accept output another rejects.  
**Suggestion:** Define shared proposal heading constants or parser helpers for review-provider output validation and reuse them wherever proposal blocks are stripped, parsed, or validated.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** Proposal heading parsing is duplicated in provider parsing/validation code, while the review contract requires strict proposal formatting across aggregated file-review output and cross-file-review output. Small divergence in `"### "` handling could cause one review stage to accept output another rejects.  
**Suggestion:** Define shared proposal heading constants or parser helpers for review-provider output validation and reuse them wherever proposal blocks are stripped, parsed, or validated.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
