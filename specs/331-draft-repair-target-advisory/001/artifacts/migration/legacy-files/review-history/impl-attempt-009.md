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
**Finding key:** loop-3c6852b1d435103ee931
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** The new `flow.json` commits large append-only runtime collections (`metrics`, `reviewConvergence.records`, `stepAttempts`, `reviewRecoveryBaselines`) with repeated provider calls, evidence identities, handoff findings, and timestamps. This creates substantial duplication and makes the spec artifact harder to review or maintain.
**Suggestion:** Reduce the committed snapshot to the minimal canonical flow state needed for replay/audit, or move verbose runtime history into separate generated artifacts that are not part of the implementation diff.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** The new `flow.json` commits large append-only runtime collections (`metrics`, `reviewConvergence.records`, `stepAttempts`, `reviewRecoveryBaselines`) with repeated provider calls, evidence identities, handoff findings, and timestamps. This creates substantial duplication and makes the spec artifact harder to review or maintain.
**Suggestion:** Reduce the committed snapshot to the minimal canonical flow state needed for replay/audit, or move verbose runtime history into separate generated artifacts that are not part of the implementation diff.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Bound Append-Only Runtime Collections
**Finding key:** loop-8386a5a06dddf37f9d0b
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R1
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` grow append-only with no visible cap in the artifact. This violates the bounded-resource-usage guardrail because repeated retries/reviews can grow the file without an explicit maximum count or retention policy.
**Suggestion:** Add or enforce a documented retention bound for these collections, such as keeping only the latest record per phase plus a capped history, or recording summarized counters while storing full detail elsewhere.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R1
**Issue:** `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` grow append-only with no visible cap in the artifact. This violates the bounded-resource-usage guardrail because repeated retries/reviews can grow the file without an explicit maximum count or retention policy.
**Suggestion:** Add or enforce a documented retention bound for these collections, such as keeping only the latest record per phase plus a capped history, or recording summarized counters while storing full detail elsewhere.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Deduplicate Repeated Evidence Identity Blocks
**Finding key:** loop-5478b3a14fd3ddab2f5f
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Each handoff finding repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values from the parent review record. This inflates the file and increases the chance of inconsistent updates.
**Suggestion:** Store shared evidence metadata once at the review record level and let handoff findings contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Each handoff finding repeats the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` values from the parent review record. This inflates the file and increases the chance of inconsistent updates.
**Suggestion:** Store shared evidence metadata once at the review record level and let handoff findings contain only finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Normalize Repeated Issue Repair References
**Finding key:** loop-421acf045cdbaf7e178f
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R7
**Issue:** Many issue-log entries repeat similar `repairRef.files` structures and long prose for the same repair phases. The repetition makes it harder to distinguish distinct repairs from restatements of the same action.
**Suggestion:** Extract repeated repair references into a compact shared reference shape or consolidate adjacent entries that describe the same repair into one entry with multiple finding IDs.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R7
**Issue:** Many issue-log entries repeat similar `repairRef.files` structures and long prose for the same repair phases. The repetition makes it harder to distinguish distinct repairs from restatements of the same action.
**Suggestion:** Extract repeated repair references into a compact shared reference shape or consolidate adjacent entries that describe the same repair into one entry with multiple finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 1. Avoid Phase Default Masking
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

### 9. 2. Parameterize Review Evidence Phase
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

### 10. 3. Extract Canonical Disposition Setup
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

### 11. 3. Rename `stripProposalPreamble` to reflect parser behavior
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

### 12. 4. Keep JSON validation independent from markdown proposal extraction
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

### 13. 1. Avoid summary-string coupling in stale evidence recovery
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

### 14. 2. Simplify stale artifact lookup to avoid repeated linear scans
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

### 15. 1. Extract shared display phase construction
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

### 16. 2. Avoid recursive flattening for a single step lookup
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

### 17. 3. Clarify scoped step naming
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

### 18. 2. Use a more explicit helper name
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

### 19. 1. Simplify repeated evidence refresh access
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

### 20. 1. Extract Shared Test Evidence Validation
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

### 21. 2. Avoid Exposing A Single-Use Internal Class
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

### 22. 3. Rename `evidenceRefresh` For Result Semantics
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

### 23. 4. Replace Phase Set With Predicate Helper
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

### 24. 5. Clarify `canonicalFindingList` Fallback Scope
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

### 25. 2. Bound additional artifact deletion
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

### 26. 3. Validate additional artifact paths before deletion
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

### 27. 4. Avoid materializing the fingerprint set just to read one value
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

### 28. 1. Extract recovered evidence-refresh detection
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

### 33. 1. Extract the repeated demo diff fixture
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

### 34. 2. Extract the repeated flowManager test double
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

### 35. 3. Replace repeated artifact cleanup assertions with a named expected list
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

### 36. 4. Name the retry metrics fixture by behavior
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

### 37. 1. Consolidate stale evidence refresh logic
**Finding key:** loop-31fc1ddab9eefc82e3ac
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** Stale test evidence recovery logic appears across `run-gate.js`, `run-review.js`, `stale-test-evidence-refresh.js`, and related registry hooks with repeated detection, artifact handling, and recovery-result checks. This creates cross-file drift risk in how stale evidence is detected and reported.  
**Suggestion:** Move shared stale evidence recovery predicates and artifact-check orchestration into a single helper module, then parameterize caller-specific labels, phases, and returned artifact metadata.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** Stale test evidence recovery logic appears across `run-gate.js`, `run-review.js`, `stale-test-evidence-refresh.js`, and related registry hooks with repeated detection, artifact handling, and recovery-result checks. This creates cross-file drift risk in how stale evidence is detected and reported.  
**Suggestion:** Move shared stale evidence recovery predicates and artifact-check orchestration into a single helper module, then parameterize caller-specific labels, phases, and returned artifact metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Normalize draft repair-target phase handling
**Finding key:** loop-eaaa7baa7c9aeb27a5b0
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** The draft repair-target phase set is repeated conceptually across implementation, tests, and spec text as `draft-questions` / `draft-coverage`, with inline set checks and ternary artifact mappings. This makes phase additions or renames error-prone across files.  
**Suggestion:** Introduce a canonical helper or mapping such as `isDraftRepairTargetPhase()` and `draftRepairTargetArtifactForPhase()`, and reuse it in production code and tests.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** The draft repair-target phase set is repeated conceptually across implementation, tests, and spec text as `draft-questions` / `draft-coverage`, with inline set checks and ternary artifact mappings. This makes phase additions or renames error-prone across files.  
**Suggestion:** Introduce a canonical helper or mapping such as `isDraftRepairTargetPhase()` and `draftRepairTargetArtifactForPhase()`, and reuse it in production code and tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 3. Align evidence refresh result naming
**Finding key:** loop-66a89e0a44f6c4b9b290
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** Similar recovery concepts use different names across files: `evidenceRefresh`, `staleEvidenceResult`, `artifactCheckResult`, and registry-level recovered checks. Some variables hold full command results while others hold only refresh metadata.  
**Suggestion:** Standardize naming around the actual interface, for example `artifactCheckResult` for command-level early returns and `evidenceRefresh` only for nested refresh metadata.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** Similar recovery concepts use different names across files: `evidenceRefresh`, `staleEvidenceResult`, `artifactCheckResult`, and registry-level recovered checks. Some variables hold full command results while others hold only refresh metadata.  
**Suggestion:** Standardize naming around the actual interface, for example `artifactCheckResult` for command-level early returns and `evidenceRefresh` only for nested refresh metadata.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 4. Deduplicate advisory recording test fixtures
**Finding key:** loop-8495a2c3ab97355b933e
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** Multiple test files introduce repeated fixture patterns for draft advisory evidence, phase-to-artifact naming, canonical disposition setup, and recorded advisory assertions. The same behavior is being described with different local helpers or inline setup.  
**Suggestion:** Extract shared test helpers for draft phase cases, advisory evidence construction, and completed advisory recording assertions, then reuse them across the draft repair-target tests.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** Multiple test files introduce repeated fixture patterns for draft advisory evidence, phase-to-artifact naming, canonical disposition setup, and recorded advisory assertions. The same behavior is being described with different local helpers or inline setup.  
**Suggestion:** Extract shared test helpers for draft phase cases, advisory evidence construction, and completed advisory recording assertions, then reuse them across the draft repair-target tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 5. Make repair-target terminology consistent
**Finding key:** loop-ad88b24832e5cf24d013
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R4
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R4  
**Issue:** The reviewed files refer to the same concept using `repairTarget`, `repair_target`, `classification`, `category`, and `repairTargets`. It is unclear which field is canonical and which names are test conveniences.  
**Suggestion:** Pick one canonical domain term for the persisted contract, then align fixture names, helper names, and assertions to distinguish collection names from serialized field values.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R4  
**Issue:** The reviewed files refer to the same concept using `repairTarget`, `repair_target`, `classification`, `category`, and `repairTargets`. It is unclear which field is canonical and which names are test conveniences.  
**Suggestion:** Pick one canonical domain term for the persisted contract, then align fixture names, helper names, and assertions to distinguish collection names from serialized field values.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
