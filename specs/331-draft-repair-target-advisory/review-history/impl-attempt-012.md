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

### 4. 1. Trim Volatile Runtime State From Flow Snapshot
**Finding key:** loop-c6550bd7f45f7c86d7e6
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** The new flow snapshot commits extensive transient runtime data: agent metrics, timestamps, runtime logs, retry baselines, step attempts, and large review convergence histories. This makes the file noisy, hard to review, and likely to churn on every flow command.
**Suggestion:** Persist only the canonical flow state needed to resume or audit the spec, and move volatile execution traces to generated runtime artifacts or omit them from committed state.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** The new flow snapshot commits extensive transient runtime data: agent metrics, timestamps, runtime logs, retry baselines, step attempts, and large review convergence histories. This makes the file noisy, hard to review, and likely to churn on every flow command.
**Suggestion:** Persist only the canonical flow state needed to resume or audit the spec, and move volatile execution traces to generated runtime artifacts or omit them from committed state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Add Explicit Bounds To Append-Only Flow Collections
**Finding key:** loop-248185336bd62edf3d5b
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R6
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R6
**Issue:** Arrays such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` appear append-only and can grow without a visible cap. This violates the bounded-resource-usage guardrail because repeated review or gate retries can produce unbounded JSON growth.
**Suggestion:** Enforce maximum retained entries per collection, or compact older entries into summaries while preserving the latest canonical evidence and decision state.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R6
**Issue:** Arrays such as `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` appear append-only and can grow without a visible cap. This violates the bounded-resource-usage guardrail because repeated review or gate retries can produce unbounded JSON growth.
**Suggestion:** Enforce maximum retained entries per collection, or compact older entries into summaries while preserving the latest canonical evidence and decision state.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Deduplicate Repeated Evidence Identity Blocks
**Finding key:** loop-25b18d8350d65c741fb2
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Many `handoffFindings` repeat the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` fields. This creates large duplication and increases the risk of inconsistent edits.
**Suggestion:** Store shared evidence metadata once at the record level and keep each finding focused on finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Many `handoffFindings` repeat the same `phase`, `taskId`, `treeSha`, `provenance`, `canonicalEvidenceRef`, `evidenceDigest`, `reviewDisposition`, and `finalDispositionOwner` fields. This creates large duplication and increases the risk of inconsistent edits.
**Suggestion:** Store shared evidence metadata once at the record level and keep each finding focused on finding-specific fields such as `findingId`, `summary`, `fingerprint`, and `evidenceRefs`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Normalize Step Identifier Naming
**Finding key:** loop-3880025fa31e5da38042
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R7
**Issue:** Step names mix formats such as `task.impl`, `task-impl`, `task-review`, `spec-gate`, and `retry-recovery`. The inconsistent naming makes filtering and correlation with `flow.json` harder.
**Suggestion:** Use one canonical step-id format matching `flow.json`, preferably hyphenated IDs, and migrate `task.impl` to `task-impl`.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R7
**Issue:** Step names mix formats such as `task.impl`, `task-impl`, `task-review`, `spec-gate`, and `retry-recovery`. The inconsistent naming makes filtering and correlation with `flow.json` harder.
**Suggestion:** Use one canonical step-id format matching `flow.json`, preferably hyphenated IDs, and migrate `task.impl` to `task-impl`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Factor Repeated Issue Log Repair Metadata
**Finding key:** loop-972a35cd24f64a2e7f3b
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R4
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R4
**Issue:** Multiple entries repeat nearly identical `repairRef.files` arrays and similar repair descriptions for the same touched files, especially around review-test repairs.
**Suggestion:** Group related repair entries under a shared repair batch identifier or normalize repeated file references into a single local repair reference object reused by entries.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R4
**Issue:** Multiple entries repeat nearly identical `repairRef.files` arrays and similar repair descriptions for the same touched files, especially around review-test repairs.
**Suggestion:** Group related repair entries under a shared repair batch identifier or normalize repeated file references into a single local repair reference object reused by entries.
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

### 12. 1. Bound Accepted Preamble Size Before Proposal Parsing
**Finding key:** loop-06d9413cf3db5f53c4e2
**Failure mode:** refactor
**File:** src/flow/commands/review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `stripProposalPreamble()` scans and slices arbitrary provider output before validation. Because provider output can include a large preamble, this adds an unbounded scan path contrary to the bounded-resource-usage guardrail.  
**Suggestion:** Add an explicit maximum preamble size, for example reject or return the original text when `"### "` is not found within the existing provider-output size budget. Prefer a named constant such as `MAX_REVIEW_PROPOSAL_PREAMBLE_BYTES` and use it in both `parseProposals()` and `providerOutputInvalid()`.
**Suggestion:** **File:** `src/flow/commands/review.js`  
**Requirement:** R4  
**Issue:** `stripProposalPreamble()` scans and slices arbitrary provider output before validation. Because provider output can include a large preamble, this adds an unbounded scan path contrary to the bounded-resource-usage guardrail.  
**Suggestion:** Add an explicit maximum preamble size, for example reject or return the original text when `"### "` is not found within the existing provider-output size budget. Prefer a named constant such as `MAX_REVIEW_PROPOSAL_PREAMBLE_BYTES` and use it in both `parseProposals()` and `providerOutputInvalid()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Avoid Recomputing Review Handoff Findings
**Finding key:** loop-396b9a47398e55f7e02b
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `DeferredFindingSources` calls `reviewHandoffFindings(flowState)` internally, while `inspectDeferredSources()` separately calls `reviewHandoffFindings(flowState)` and `latestReviewConvergenceRecords(flowState)`. This repeats traversal of the same review state and makes canonical/deferred-source resolution harder to reason about.  
**Suggestion:** Reuse a single source object or pass precomputed handoffs into the helper. For example, let `DeferredFindingSources` expose `reviewHandoffsByFindingId` or accept `reviewHandoffs` in its constructor so `buildDeferredFindingsFromEvidence()`, `validateDeferredFindingCoverage()`, and `inspectDeferredSources()` share the same resolved source set.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `DeferredFindingSources` calls `reviewHandoffFindings(flowState)` internally, while `inspectDeferredSources()` separately calls `reviewHandoffFindings(flowState)` and `latestReviewConvergenceRecords(flowState)`. This repeats traversal of the same review state and makes canonical/deferred-source resolution harder to reason about.  
**Suggestion:** Reuse a single source object or pass precomputed handoffs into the helper. For example, let `DeferredFindingSources` expose `reviewHandoffsByFindingId` or accept `reviewHandoffs` in its constructor so `buildDeferredFindingsFromEvidence()`, `validateDeferredFindingCoverage()`, and `inspectDeferredSources()` share the same resolved source set.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Extract Canonical Evidence Projection Cache Lookup
**Finding key:** loop-a9cad73306432d77c392
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `inspectDeferredSources()` now has two similar `canonicalCache` lookup paths: one for `reviewHandoffs` and one for `canonicalRecords`. Both create `CanonicalReviewEvidenceProjection` lazily and then call `findFinding()`. The duplicated cache mechanics increase the chance that future canonical-source fixes update only one branch.  
**Suggestion:** Extract a local helper such as `findCanonicalSourceFinding(record, sourceFindingId)` that handles cache initialization and lookup. Then both branches can call that helper and keep only their source-resolution differences inline.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `inspectDeferredSources()` now has two similar `canonicalCache` lookup paths: one for `reviewHandoffs` and one for `canonicalRecords`. Both create `CanonicalReviewEvidenceProjection` lazily and then call `findFinding()`. The duplicated cache mechanics increase the chance that future canonical-source fixes update only one branch.  
**Suggestion:** Extract a local helper such as `findCanonicalSourceFinding(record, sourceFindingId)` that handles cache initialization and lookup. Then both branches can call that helper and keep only their source-resolution differences inline.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 4. Rename AcceptanceEvidenceRefresh Fields for Clarity
**Finding key:** loop-0506b731b992d26d515d
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `AcceptanceEvidenceRefresh` stores `currentFingerprint` from `fingerprint.hash`, but `previousFingerprint` is inferred from the first stale artifact. The names read as generic fingerprints, while this logic specifically compares repair fingerprints across acceptance-input artifacts.  
**Suggestion:** Rename fields to `currentRepairFingerprint`, `previousRepairFingerprint`, and `staleFingerprintArtifacts`. This makes the class intent clearer and reduces ambiguity with deferred finding fingerprints used nearby.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R8  
**Issue:** `AcceptanceEvidenceRefresh` stores `currentFingerprint` from `fingerprint.hash`, but `previousFingerprint` is inferred from the first stale artifact. The names read as generic fingerprints, while this logic specifically compares repair fingerprints across acceptance-input artifacts.  
**Suggestion:** Rename fields to `currentRepairFingerprint`, `previousRepairFingerprint`, and `staleFingerprintArtifacts`. This makes the class intent clearer and reduces ambiguity with deferred finding fingerprints used nearby.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 5. Preserve Hard Blocker Semantics With a Named Verdict Check
**Finding key:** loop-0f2ae595197ab27142a2
**Failure mode:** refactor
**File:** src/flow/lib/acceptance-review-artifacts.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `deriveAcceptanceReviewVerdict()` now treats `hardBlockers` as `user_decision_required` instead of `blocked`, but that behavior is embedded in a compound condition with `notVerifiable` judgments. The distinction between mechanical blockers, unmet requirements, unverifiable requirements, and hard blockers is important but not self-documenting.  
**Suggestion:** Extract small named predicates such as `hasMechanicalBlockers()`, `hasUnmetRequirements()`, and `hasUnresolvedAcceptanceRisk()`. This keeps the changed hard-blocker behavior explicit and reduces the chance of future edits accidentally moving hard blockers back into the blocked path.
**Suggestion:** **File:** `src/flow/lib/acceptance-review-artifacts.js`  
**Requirement:** R4  
**Issue:** `deriveAcceptanceReviewVerdict()` now treats `hardBlockers` as `user_decision_required` instead of `blocked`, but that behavior is embedded in a compound condition with `notVerifiable` judgments. The distinction between mechanical blockers, unmet requirements, unverifiable requirements, and hard blockers is important but not self-documenting.  
**Suggestion:** Extract small named predicates such as `hasMechanicalBlockers()`, `hasUnmetRequirements()`, and `hasUnresolvedAcceptanceRisk()`. This keeps the changed hard-blocker behavior explicit and reduces the chance of future edits accidentally moving hard blockers back into the blocked path.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 1. Extract shared display phase construction
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

### 18. 2. Avoid recursive flattening for a single step lookup
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

### 19. 3. Clarify scoped step naming
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

### 20. 3. Use a More General Fingerprint Helper Name
**Finding key:** loop-5a4fb9f8d87a6d263f6a
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `invalidationFingerprint()` describes where the helper is currently used, not what it does. The function actually normalizes either a hash string or a fingerprint-like value into a fingerprint object.  
**Suggestion:** Rename it to something behavior-oriented like `normalizeFingerprint()` or `coerceFingerprint()` so the name remains accurate if reused outside invalidation planning.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R5  
**Issue:** `invalidationFingerprint()` describes where the helper is currently used, not what it does. The function actually normalizes either a hash string or a fingerprint-like value into a fingerprint object.  
**Suggestion:** Rename it to something behavior-oriented like `normalizeFingerprint()` or `coerceFingerprint()` so the name remains accurate if reused outside invalidation planning.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Normalize Evidence Refresh Before Routing
**Finding key:** loop-c456924d311f6adfb53f
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R4  
**Issue:** `result.evidenceRefresh` is normalized to `null` in the returned payload, but the `next` routing condition uses the raw value. This duplicates the same concept in two forms and makes future edits easier to get subtly wrong.  
**Suggestion:** Assign `const evidenceRefresh = result.evidenceRefresh || null;` before the return and use that variable for both `evidenceRefresh` and `next`.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R4  
**Issue:** `result.evidenceRefresh` is normalized to `null` in the returned payload, but the `next` routing condition uses the raw value. This duplicates the same concept in two forms and makes future edits easier to get subtly wrong.  
**Suggestion:** Assign `const evidenceRefresh = result.evidenceRefresh || null;` before the return and use that variable for both `evidenceRefresh` and `next`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Extract Acceptance Next-Step Selection
**Finding key:** loop-b66c13f98bfe0fd7e037
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R4  
**Issue:** The `next` value now combines evidence-refresh routing and verdict routing in a nested ternary. As more routing cases are added, this becomes harder to scan and easier to mis-edit.  
**Suggestion:** Extract the routing into a small helper such as `nextAcceptanceStep(result)` or compute it in a named local variable before returning.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R4  
**Issue:** The `next` value now combines evidence-refresh routing and verdict routing in a nested ternary. As more routing cases are added, this becomes harder to scan and easier to mis-edit.  
**Suggestion:** Extract the routing into a small helper such as `nextAcceptanceStep(result)` or compute it in a named local variable before returning.
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

### 28. 1. Extract duplicate fingerprint mismatch validation
**Finding key:** loop-7b39d73b2cfde98e5e86
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R1  
**Issue:** `StaleTestEvidenceMismatch` and `StaleTestEvidenceRefresh` both validate `previousFingerprint`, `currentFingerprint`, and require them to differ with identical logic.  
**Suggestion:** Extract a small helper such as `requireFingerprintMismatch({ previousFingerprint, currentFingerprint })` that returns normalized values. This reduces duplication and keeps the invariant in one place.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R1  
**Issue:** `StaleTestEvidenceMismatch` and `StaleTestEvidenceRefresh` both validate `previousFingerprint`, `currentFingerprint`, and require them to differ with identical logic.  
**Suggestion:** Extract a small helper such as `requireFingerprintMismatch({ previousFingerprint, currentFingerprint })` that returns normalized values. This reduces duplication and keeps the invariant in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 2. Add explicit bounds for artifact processing
**Finding key:** loop-72015a3b0f739512b99d
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `StaleTestEvidenceMismatch.detect()` iterates over all `artifacts`, and `recover()` maps all `additionalArtifacts` without an explicit upper bound. This conflicts with the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Define local maximums, for example `MAX_STALE_ARTIFACTS` and `MAX_ADDITIONAL_ARTIFACTS`, validate input sizes before processing, and throw a clear error if the bound is exceeded.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `StaleTestEvidenceMismatch.detect()` iterates over all `artifacts`, and `recover()` maps all `additionalArtifacts` without an explicit upper bound. This conflicts with the `bounded-resource-usage` guardrail for bulk processing.  
**Suggestion:** Define local maximums, for example `MAX_STALE_ARTIFACTS` and `MAX_ADDITIONAL_ARTIFACTS`, validate input sizes before processing, and throw a clear error if the bound is exceeded.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Rename `AdditionalArtifactDeletion` for intent clarity
**Finding key:** loop-c0dd55a8e0c9b76db81d
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R2  
**Issue:** `AdditionalArtifactDeletion` describes the operation but not the domain role. It is specifically a recovery cleanup artifact, not a general deletion abstraction.  
**Suggestion:** Rename it to something more contextual, such as `RecoveryArtifactDeletion` or `AdditionalRecoveryArtifact`, so readers can understand why the file is being removed.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R2  
**Issue:** `AdditionalArtifactDeletion` describes the operation but not the domain role. It is specifically a recovery cleanup artifact, not a general deletion abstraction.  
**Suggestion:** Rename it to something more contextual, such as `RecoveryArtifactDeletion` or `AdditionalRecoveryArtifact`, so readers can understand why the file is being removed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 4. Avoid creating deletion objects before core invalidation succeeds
**Finding key:** loop-eb815f6588b6d981a202
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R5  
**Issue:** `additionalArtifactDeletions` are constructed before `invalidateRepairEvidence()` runs, even though they are only used afterward. If invalidation throws, that work was unnecessary.  
**Suggestion:** Move construction of `additionalArtifactDeletions` after `invalidateRepairEvidence()` succeeds, or process `additionalArtifacts` directly in the deletion loop. This slightly simplifies control flow and avoids premature work.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R5  
**Issue:** `additionalArtifactDeletions` are constructed before `invalidateRepairEvidence()` runs, even though they are only used afterward. If invalidation throws, that work was unnecessary.  
**Suggestion:** Move construction of `additionalArtifactDeletions` after `invalidateRepairEvidence()` succeeds, or process `additionalArtifacts` directly in the deletion loop. This slightly simplifies control flow and avoids premature work.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 1. Extract duplicate recovered-evidence short-circuit
**Finding key:** loop-b6d69ce8c2ee1620f6b9
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R8
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The same nested condition appears in both `run-gate` and `draft-review` post hooks: `result?.result === "recovered" && result?.artifacts?.evidenceRefresh?.recovered === true`. This duplicates checkpoint recovery routing logic and makes future changes easy to miss in one hook.  
**Suggestion:** Add a small local helper such as `isRecoveredEvidenceRefresh(result)` near the registry helpers, then use it in both post hooks. This also gives the Issue #453 behavior a clearer name.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The same nested condition appears in both `run-gate` and `draft-review` post hooks: `result?.result === "recovered" && result?.artifacts?.evidenceRefresh?.recovered === true`. This duplicates checkpoint recovery routing logic and makes future changes easy to miss in one hook.  
**Suggestion:** Add a small local helper such as `isRecoveredEvidenceRefresh(result)` near the registry helpers, then use it in both post hooks. This also gives the Issue #453 behavior a clearer name.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Improve recovered result naming clarity
**Finding key:** loop-b727f794187a60b1eb92
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R8
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The condition combines two similarly named concepts, `result.result === "recovered"` and `evidenceRefresh.recovered === true`, which makes the intent hard to scan and increases the chance of confusing generic recovery with checkpoint-shaped repair-target recovery.  
**Suggestion:** If the result shape is owned by this change set, prefer a more specific predicate or artifact flag name at the usage site, e.g. `isCheckpointRepairTargetRecovery(result)` or `evidenceRefresh.checkpointRepairTargetRecovered`, so the no-AI advance path required by R8 is explicit.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The condition combines two similarly named concepts, `result.result === "recovered"` and `evidenceRefresh.recovered === true`, which makes the intent hard to scan and increases the chance of confusing generic recovery with checkpoint-shaped repair-target recovery.  
**Suggestion:** If the result shape is owned by this change set, prefer a more specific predicate or artifact flag name at the usage site, e.g. `isCheckpointRepairTargetRecovery(result)` or `evidenceRefresh.checkpointRepairTargetRecovered`, so the no-AI advance path required by R8 is explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Extract Repeated Advisory Recording Assertions
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

### 35. 2. Avoid Inline Artifact Name Branching In The Phase Loop
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

### 36. 3. Clarify Fixture Naming Around Classification
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

### 37. 4. Replace Mutable Sentinel With Assert-Rejecting Stub
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

### 38. 1. Extract stale-evidence rewind fixture/assertion helpers
**Finding key:** loop-35cfa36724c5e5a8f5f9
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The two new stale fingerprint tests repeat the same setup pattern: prepare fixture, mutate `src/demo.js`, create a flow state, invoke recovery, assert rewind statuses, and assert evidence artifacts were removed. This makes future changes to rewind behavior harder to update consistently.  
**Suggestion:** Add small local helpers such as `assertStepRewound(state, fromStep, toStep)` and `assertArtifactsRemoved(specDir, paths)`, and reuse them in both `"acceptance-review rewinds..."` and `"integration gate rewinds..."`.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The two new stale fingerprint tests repeat the same setup pattern: prepare fixture, mutate `src/demo.js`, create a flow state, invoke recovery, assert rewind statuses, and assert evidence artifacts were removed. This makes future changes to rewind behavior harder to update consistently.  
**Suggestion:** Add small local helpers such as `assertStepRewound(state, fromStep, toStep)` and `assertArtifactsRemoved(specDir, paths)`, and reuse them in both `"acceptance-review rewinds..."` and `"integration gate rewinds..."`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 2. Replace hard-coded artifact removal list with named constant
**Finding key:** loop-c393eb90710decc3c29c
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The acceptance rewind test embeds a long inline array of artifact filenames. This obscures the behavioral distinction between artifacts that should be removed and artifacts that should remain.  
**Suggestion:** Define local constants like `ACCEPTANCE_REWIND_REMOVED_ARTIFACTS` and `ACCEPTANCE_REWIND_PRESERVED_ARTIFACTS`, then assert against those. This improves naming and makes the intent clearer.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The acceptance rewind test embeds a long inline array of artifact filenames. This obscures the behavioral distinction between artifacts that should be removed and artifacts that should remain.  
**Suggestion:** Define local constants like `ACCEPTANCE_REWIND_REMOVED_ARTIFACTS` and `ACCEPTANCE_REWIND_PRESERVED_ARTIFACTS`, then assert against those. This improves naming and makes the intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 3. Extract repeated in-memory flow manager test double
**Finding key:** loop-40fb3dd70d0335f96abf
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The new tests define similar ad hoc `flowManager` objects with `load()` and/or `mutate()` methods. The shape is repeated and slightly inconsistent between tests.  
**Suggestion:** Add a local helper such as `makeMutableFlowManager(state, { includeLoad = false } = {})` or simply always include both `load` and `mutate`. This removes duplication and makes the test double consistent.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The new tests define similar ad hoc `flowManager` objects with `load()` and/or `mutate()` methods. The shape is repeated and slightly inconsistent between tests.  
**Suggestion:** Add a local helper such as `makeMutableFlowManager(state, { includeLoad = false } = {})` or simply always include both `load` and `mutate`. This removes duplication and makes the test double consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 4. Use a helper for SHA-256 file fingerprint construction
**Finding key:** loop-ef2d2e35e53c6d59be7e
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The integration gate test manually constructs a changed-file object and computes the SHA-256 fingerprint inline. That mixes fixture mechanics with the behavior under test.  
**Suggestion:** Extract a helper like `changedFileFingerprint(path, contents)` returning `{ status: "modified", path, fingerprint }`. The test body can then focus on stale evidence recovery behavior.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R7  
**Issue:** The integration gate test manually constructs a changed-file object and computes the SHA-256 fingerprint inline. That mixes fixture mechanics with the behavior under test.  
**Suggestion:** Extract a helper like `changedFileFingerprint(path, contents)` returning `{ status: "modified", path, fingerprint }`. The test body can then focus on stale evidence recovery behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 5. Name retry metric fixture construction
**Finding key:** loop-b204c3c675fc7737a934
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R7
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R7  
**Issue:** `Array.from({ length: 5 }, () => ({ phase: "task-impl", counter: "gateRetry", delta: 1 }))` is technically clear but semantically dense. The purpose is “five exhausted task implementation gate retries,” not generic array construction.  
**Suggestion:** Extract a local helper or variable, for example `const exhaustedTaskImplGateRetries = retryMetrics("task-impl", "gateRetry", 5);`, to make the scenario intent explicit.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R7  
**Issue:** `Array.from({ length: 5 }, () => ({ phase: "task-impl", counter: "gateRetry", delta: 1 }))` is technically clear but semantically dense. The purpose is “five exhausted task implementation gate retries,” not generic array construction.  
**Suggestion:** Extract a local helper or variable, for example `const exhaustedTaskImplGateRetries = retryMetrics("task-impl", "gateRetry", 5);`, to make the scenario intent explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 1. Extract Stale Artifact Filenames
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

### 44. 2. Split Absolute And Traversal Path Cases
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

### 45. 3. Prefer Descriptive Test Fixture Names
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

### 46. 1. Extract Repeated Run Metadata
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

### 47. 2. Clarify Attempt Variable Names
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

### 48. 1. Normalize stale evidence refresh naming
**Finding key:** loop-b8165566b92289fe489b
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** Related concepts are named inconsistently across files: `StaleTestEvidenceRefresh`, `AcceptanceEvidenceRefresh`, `StaleIntegrationTestEvidence`, and variables like `evidenceRefresh` that sometimes mean metadata and sometimes a full command result. This makes the stale-evidence recovery interface harder to follow across `run-gate.js`, `run-review.js`, `run-acceptance-review.js`, and artifact helpers.  
**Suggestion:** Establish one naming convention: use `*EvidenceRefresh` only for refresh metadata, `*EvidenceRecoveryResult` for command-level early-return objects, and phase-specific prefixes only when behavior actually differs.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** Related concepts are named inconsistently across files: `StaleTestEvidenceRefresh`, `AcceptanceEvidenceRefresh`, `StaleIntegrationTestEvidence`, and variables like `evidenceRefresh` that sometimes mean metadata and sometimes a full command result. This makes the stale-evidence recovery interface harder to follow across `run-gate.js`, `run-review.js`, `run-acceptance-review.js`, and artifact helpers.  
**Suggestion:** Establish one naming convention: use `*EvidenceRefresh` only for refresh metadata, `*EvidenceRecoveryResult` for command-level early-return objects, and phase-specific prefixes only when behavior actually differs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 49. 2. Extract shared stale test evidence validation flow
**Finding key:** loop-542003f0d0aa619ff537
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** `run-gate.js` and `run-review.js` appear to introduce parallel stale test evidence validation and recovery flows with similar fingerprint checks, stale artifact detection, recovery, and result routing. This is duplicate cross-file behavior and increases the risk that future changes fix one command but not the other.  
**Suggestion:** Move the common stale-test-evidence check into a shared helper module, parameterized by phase, artifact labels, recovery messages, and returned metadata shape.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R8  
**Issue:** `run-gate.js` and `run-review.js` appear to introduce parallel stale test evidence validation and recovery flows with similar fingerprint checks, stale artifact detection, recovery, and result routing. This is duplicate cross-file behavior and increases the risk that future changes fix one command but not the other.  
**Suggestion:** Move the common stale-test-evidence check into a shared helper module, parameterized by phase, artifact labels, recovery messages, and returned metadata shape.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 50. 3. Use a canonical draft repair-target phase helper
**Finding key:** loop-728009ee3c8e05880c1d
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** Draft repair-target phases are represented in several forms across implementation, tests, and specs: repeated `draft-questions` / `draft-coverage` pairs, inline phase-to-artifact ternaries, and direct `DRAFT_REPAIR_TARGET_PHASES.has(phase)` checks. This spreads one domain rule across files.  
**Suggestion:** Introduce a canonical helper such as `isDraftRepairTargetPhase(phase)` plus a phase-to-artifact map, then reuse it in production code and tests instead of repeating the phase pair or inline ternaries.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R1  
**Issue:** Draft repair-target phases are represented in several forms across implementation, tests, and specs: repeated `draft-questions` / `draft-coverage` pairs, inline phase-to-artifact ternaries, and direct `DRAFT_REPAIR_TARGET_PHASES.has(phase)` checks. This spreads one domain rule across files.  
**Suggestion:** Introduce a canonical helper such as `isDraftRepairTargetPhase(phase)` plus a phase-to-artifact map, then reuse it in production code and tests instead of repeating the phase pair or inline ternaries.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 51. 4. Standardize step identifier format across flow artifacts
**Finding key:** loop-b5a57985fd015aa74a92
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R7
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R7  
**Issue:** Step identifiers mix dotted and hyphenated formats across persisted artifacts, such as `task.impl`, `task-impl`, `task-review`, `spec-gate`, and `retry-recovery`. This inconsistency affects correlation with `flow.json`, test fixtures, retry metrics, and recovery logs.  
**Suggestion:** Pick one canonical step-id format, preferably the hyphenated format already used by most flow steps, and migrate persisted/test references to that format.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`  
**Requirement:** R7  
**Issue:** Step identifiers mix dotted and hyphenated formats across persisted artifacts, such as `task.impl`, `task-impl`, `task-review`, `spec-gate`, and `retry-recovery`. This inconsistency affects correlation with `flow.json`, test fixtures, retry metrics, and recovery logs.  
**Suggestion:** Pick one canonical step-id format, preferably the hyphenated format already used by most flow steps, and migrate persisted/test references to that format.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 52. 5. Consolidate repeated repair evidence metadata
**Finding key:** loop-e9d3fba8c6965faeccb7
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R3  
**Issue:** Evidence identity and repair metadata are repeated across `flow.json`, `issue-log.json`, and related tests: phase, task id, tree SHA, provenance, evidence refs, repair file lists, and fingerprint fields recur with slight local variations. This creates cross-file drift risk for evidence correlation.  
**Suggestion:** Store shared evidence identity once per record or repair batch, and have findings/tests reference that canonical identity instead of duplicating the same metadata blocks.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`  
**Requirement:** R3  
**Issue:** Evidence identity and repair metadata are repeated across `flow.json`, `issue-log.json`, and related tests: phase, task id, tree SHA, provenance, evidence refs, repair file lists, and fingerprint fields recur with slight local variations. This creates cross-file drift risk for evidence correlation.  
**Suggestion:** Store shared evidence identity once per record or repair batch, and have findings/tests reference that canonical identity instead of duplicating the same metadata blocks.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
