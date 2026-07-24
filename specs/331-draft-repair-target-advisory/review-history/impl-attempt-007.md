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
**Finding key:** loop-512113a44d1caf64f453
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** The new `flow.json` includes very large append-only runtime sections such as `metrics`, `runtimeLog`, `stepAttempts`, `reviewRecoveryBaselines`, and `retryRecovery`. Much of this is duplicated operational history rather than durable spec intent, making review noisy and increasing merge-conflict risk.
**Suggestion:** Persist only the canonical state needed to resume or validate the flow, and move detailed attempt/runtime telemetry to ignored artifacts or a bounded log file. If the flow format requires these fields, add a compaction step that keeps only the latest relevant record per phase/task plus explicit counters.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** The new `flow.json` includes very large append-only runtime sections such as `metrics`, `runtimeLog`, `stepAttempts`, `reviewRecoveryBaselines`, and `retryRecovery`. Much of this is duplicated operational history rather than durable spec intent, making review noisy and increasing merge-conflict risk.
**Suggestion:** Persist only the canonical state needed to resume or validate the flow, and move detailed attempt/runtime telemetry to ignored artifacts or a bounded log file. If the flow format requires these fields, add a compaction step that keeps only the latest relevant record per phase/task plus explicit counters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 2. Bound Append-Only Collections
**Finding key:** loop-c2ee416c0c18ff64ee43
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** Collections like `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` appear append-only and have no visible size bound in the artifact. This conflicts with the `bounded-resource-usage` guardrail because repeated retries/reviews can grow the file indefinitely.
**Suggestion:** Add an explicit retention policy to the producer of this file: for example, cap metrics per phase, keep only the latest convergence record per `(phase, taskId, treeSha)`, and summarize older attempts into counters.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R8
**Issue:** Collections like `metrics`, `reviewConvergence.records`, `stepAttempts`, and `reviewRecoveryBaselines` appear append-only and have no visible size bound in the artifact. This conflicts with the `bounded-resource-usage` guardrail because repeated retries/reviews can grow the file indefinitely.
**Suggestion:** Add an explicit retention policy to the producer of this file: for example, cap metrics per phase, keep only the latest convergence record per `(phase, taskId, treeSha)`, and summarize older attempts into counters.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Deduplicate Repeated Evidence Identity Blocks
**Finding key:** loop-9fb64b199b408c8e4f8e
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Many `reviewConvergence.records` repeat the same identity fields across `evidenceIdentity`, `evidenceHistory`, handoff findings, and top-level record fields: `phase`, `taskId`, `treeSha`, `provider`, `capturedAt`, and `evidenceDigest`. This makes accidental divergence likely.
**Suggestion:** Store evidence identity once per record and reference it from handoff findings/history by ID or digest. If full denormalization is required for downstream consumers, generate it at read/render time rather than committing repeated copies.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Many `reviewConvergence.records` repeat the same identity fields across `evidenceIdentity`, `evidenceHistory`, handoff findings, and top-level record fields: `phase`, `taskId`, `treeSha`, `provider`, `capturedAt`, and `evidenceDigest`. This makes accidental divergence likely.
**Suggestion:** Store evidence identity once per record and reference it from handoff findings/history by ID or digest. If full denormalization is required for downstream consumers, generate it at read/render time rather than committing repeated copies.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 4. Normalize Repeated Issue Repair References
**Finding key:** loop-58d845c6c31a82e98d68
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R6
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R6
**Issue:** Several issue-log entries repeat identical `repairRef.files` arrays and similar task-review repair descriptions. This makes the log harder to scan and creates many near-duplicate records.
**Suggestion:** Introduce a compact grouped entry shape for repeated repairs against the same file/finding context, or collapse consecutive entries that share `step`, `taskId`, and `repairRef.files` into one entry with multiple normalized finding IDs.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R6
**Issue:** Several issue-log entries repeat identical `repairRef.files` arrays and similar task-review repair descriptions. This makes the log harder to scan and creates many near-duplicate records.
**Suggestion:** Introduce a compact grouped entry shape for repeated repairs against the same file/finding context, or collapse consecutive entries that share `step`, `taskId`, and `repairRef.files` into one entry with multiple normalized finding IDs.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 5. Remove Redundant Recovery Identifiers
**Finding key:** loop-dc963a30ddfa32f8d851
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/issue-log.json
**Requirement:** R8
**Issue:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R8
**Issue:** The `retry-recovery` entry stores the same UUID three times as `grantId`, `id`, and `issueLogId`. This duplicates identity fields without adding information.
**Suggestion:** Keep a single canonical identifier, preferably `issueLogId` if that is the log-wide convention, and derive/display aliases only in tooling output when needed.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/issue-log.json`
**Requirement:** R8
**Issue:** The `retry-recovery` entry stores the same UUID three times as `grantId`, `id`, and `issueLogId`. This duplicates identity fields without adding information.
**Suggestion:** Keep a single canonical identifier, preferably `issueLogId` if that is the log-wide convention, and derive/display aliases only in tooling output when needed.
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

### 18. 1. Extract Gate Recovery Display Phase Construction
**Finding key:** loop-01ae5a91cedef3734cad
**Failure mode:** refactor
**File:** src/flow/lib/gate-recovery-display.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/gate-recovery-display.js`  
**Requirement:** R1  
**Issue:** The logic for counting attempts, resolving max attempts, and constructing `GateRecoveryDisplayPhase` is duplicated for the active phase and configured gate phases.  
**Suggestion:** Add a small helper such as `createGateRecoveryDisplayPhase({ root, flowState, phase, maxAttempts })` and use it in both branches. This keeps the changed priority behavior while reducing repeated parameter wiring.
**Suggestion:** **File:** `src/flow/lib/gate-recovery-display.js`  
**Requirement:** R1  
**Issue:** The logic for counting attempts, resolving max attempts, and constructing `GateRecoveryDisplayPhase` is duplicated for the active phase and configured gate phases.  
**Suggestion:** Add a small helper such as `createGateRecoveryDisplayPhase({ root, flowState, phase, maxAttempts })` and use it in both branches. This keeps the changed priority behavior while reducing repeated parameter wiring.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 2. Rename Fingerprint Normalizer For Intent
**Finding key:** loop-6c39fc0955de88d524f9
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `invalidationFingerprint` reads like a domain object, but the function actually normalizes either a raw hash string or a fingerprint-like value into the fingerprint shape.  
**Suggestion:** Rename it to something more action-oriented, such as `normalizeInvalidationFingerprint` or `fingerprintFromInvalidationInput`, so callers immediately understand that strings are accepted and converted.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R1  
**Issue:** `invalidationFingerprint` reads like a domain object, but the function actually normalizes either a raw hash string or a fingerprint-like value into the fingerprint shape.  
**Suggestion:** Rename it to something more action-oriented, such as `normalizeInvalidationFingerprint` or `fingerprintFromInvalidationInput`, so callers immediately understand that strings are accepted and converted.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 3. Simplify Evidence Refresh Branching
**Finding key:** loop-28b9161226ee7290e775
**Failure mode:** refactor
**File:** src/flow/lib/run-acceptance-review.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R4  
**Issue:** The nested ternary for `next` now mixes the evidence-refresh path with the verdict path, making the transition logic harder to scan.  
**Suggestion:** Assign `const evidenceRefresh = result.evidenceRefresh || null;` and compute `next` before returning, or use a small helper such as `resolveNextAcceptanceStep(result)`. This keeps the evidence-refresh override explicit and avoids deepening the ternary expression.
**Suggestion:** **File:** `src/flow/lib/run-acceptance-review.js`  
**Requirement:** R4  
**Issue:** The nested ternary for `next` now mixes the evidence-refresh path with the verdict path, making the transition logic harder to scan.  
**Suggestion:** Assign `const evidenceRefresh = result.evidenceRefresh || null;` and compute `next` before returning, or use a small helper such as `resolveNextAcceptanceStep(result)`. This keeps the evidence-refresh override explicit and avoids deepening the ternary expression.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 1. Extract Stale Evidence Recovery Handling
**Finding key:** loop-148c090c45586c9a1025
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `StaleIntegrationTestEvidence.recover()` constructs a gate recovery result that appears tightly coupled to generic stale evidence refresh behavior. If similar stale evidence checks are added for other phases, this class will encourage duplicated result-shaping logic.  
**Suggestion:** Move the common recovery-result construction into `stale-test-evidence-refresh.js` or a small helper in this file, with phase/level/reason passed in. Keep `StaleIntegrationTestEvidence` as a thin phase-specific adapter if needed.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `StaleIntegrationTestEvidence.recover()` constructs a gate recovery result that appears tightly coupled to generic stale evidence refresh behavior. If similar stale evidence checks are added for other phases, this class will encourage duplicated result-shaping logic.  
**Suggestion:** Move the common recovery-result construction into `stale-test-evidence-refresh.js` or a small helper in this file, with phase/level/reason passed in. Keep `StaleIntegrationTestEvidence` as a thin phase-specific adapter if needed.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 2. Avoid Exposing Internal Check Function Unless Required
**Finding key:** loop-e5898c5882d69788927c
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `checkIntegrationTestArtifacts` was changed from private to exported, but the diff does not show a consumer. Exporting it expands the module surface and makes future refactoring harder.  
**Suggestion:** Keep it non-exported unless there is a touched-file consumer or test that requires direct access. If export is needed for tests, consider documenting that intent or exporting through an explicit test-support path already used by this codebase.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** `checkIntegrationTestArtifacts` was changed from private to exported, but the diff does not show a consumer. Exporting it expands the module surface and makes future refactoring harder.  
**Suggestion:** Keep it non-exported unless there is a touched-file consumer or test that requires direct access. If export is needed for tests, consider documenting that intent or exporting through an explicit test-support path already used by this codebase.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 3. Keep command-result shaping out of the artifact checker
**Finding key:** loop-20baf6fadfb6eb976ac6
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** `checkImplReviewTestArtifacts()` both validates test artifacts and constructs a `RunReviewCommand` response object. That makes the helper harder to reuse and gives it two responsibilities.  
**Suggestion:** Have the helper return `null` or a `StaleTestEvidenceRefreshResult`, then build the command response near the `RunReviewCommand.run()` call site where command flow decisions already live.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R8  
**Issue:** `checkImplReviewTestArtifacts()` both validates test artifacts and constructs a `RunReviewCommand` response object. That makes the helper harder to reuse and gives it two responsibilities.  
**Suggestion:** Have the helper return `null` or a `StaleTestEvidenceRefreshResult`, then build the command response near the `RunReviewCommand.run()` call site where command flow decisions already live.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 4. Name `reviewArtifactFindingLists` after its expanded behavior
**Finding key:** loop-8ab62e7deb6af44c03d6
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R3  
**Issue:** `reviewArtifactFindingLists()` now conditionally folds `repairTargets` into advisory findings, but the name still suggests it only reads finding-list fields.  
**Suggestion:** Rename it to something like `reviewArtifactCanonicalInputLists()` or `reviewArtifactFindingBuckets()` to make the repair-target inclusion explicit.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R3  
**Issue:** `reviewArtifactFindingLists()` now conditionally folds `repairTargets` into advisory findings, but the name still suggests it only reads finding-list fields.  
**Suggestion:** Rename it to something like `reviewArtifactCanonicalInputLists()` or `reviewArtifactFindingBuckets()` to make the repair-target inclusion explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 1. Remove unused `additionalArtifacts` branch
**Finding key:** loop-abebf60f3e087d7282d5
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `StaleTestEvidenceRefresh.recover()` accepts `additionalArtifacts`, deletes those files, and imports `fs`/`path` only for that path, but the new call site never supplies it. This adds unused behavior to a focused recovery helper.  
**Suggestion:** Remove `additionalArtifacts`, the deletion loop, and the `fs`/`path` imports until a real caller needs it.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `StaleTestEvidenceRefresh.recover()` accepts `additionalArtifacts`, deletes those files, and imports `fs`/`path` only for that path, but the new call site never supplies it. This adds unused behavior to a focused recovery helper.  
**Suggestion:** Remove `additionalArtifacts`, the deletion loop, and the `fs`/`path` imports until a real caller needs it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 2. Consolidate duplicate fingerprint-pair validation
**Finding key:** loop-09f8c0ce23620e0105c4
**Failure mode:** refactor
**File:** src/flow/lib/stale-test-evidence-refresh.js
**Requirement:** R8
**Issue:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `StaleTestEvidenceMismatch` and `StaleTestEvidenceRefresh` both normalize `previousFingerprint` / `currentFingerprint` and enforce that they differ.  
**Suggestion:** Extract a small helper such as `requireStaleFingerprintPair({ previousFingerprint, currentFingerprint })` and use it in both constructors.
**Suggestion:** **File:** `src/flow/lib/stale-test-evidence-refresh.js`  
**Requirement:** R8  
**Issue:** `StaleTestEvidenceMismatch` and `StaleTestEvidenceRefresh` both normalize `previousFingerprint` / `currentFingerprint` and enforce that they differ.  
**Suggestion:** Extract a small helper such as `requireStaleFingerprintPair({ previousFingerprint, currentFingerprint })` and use it in both constructors.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Extract Recovered Evidence Refresh Predicate
**Finding key:** loop-2b69ea825b62545e6173
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R8
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The same `result?.result === "recovered" && result?.artifacts?.evidenceRefresh?.recovered === true` condition is duplicated in both `run-gate` and `impl-review` post hooks. This makes the Issue #453 recovery bypass rule easy to update inconsistently later.  
**Suggestion:** Add a small local helper such as `isRecoveredEvidenceRefreshResult(result)` and use it in both post hooks.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R8  
**Issue:** The same `result?.result === "recovered" && result?.artifacts?.evidenceRefresh?.recovered === true` condition is duplicated in both `run-gate` and `impl-review` post hooks. This makes the Issue #453 recovery bypass rule easy to update inconsistently later.  
**Suggestion:** Add a small local helper such as `isRecoveredEvidenceRefreshResult(result)` and use it in both post hooks.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Clarify Test Fixture Provenance Name
**Finding key:** loop-05d73eb2011b6878e121
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R8  
**Issue:** `recordCanonicalDraftEvidence()` hard-codes `provider: "issue-454-fixture"` while the related requirement and surrounding checkpoint replay behavior are for Issue #453. That mismatch makes the test intent harder to trace.  
**Suggestion:** Rename the fixture provider string to match the exercised scenario, for example `issue-453-fixture` or a requirement-neutral name like `draft-repair-target-fixture`.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R8  
**Issue:** `recordCanonicalDraftEvidence()` hard-codes `provider: "issue-454-fixture"` while the related requirement and surrounding checkpoint replay behavior are for Issue #453. That mismatch makes the test intent harder to trace.  
**Suggestion:** Rename the fixture provider string to match the exercised scenario, for example `issue-453-fixture` or a requirement-neutral name like `draft-repair-target-fixture`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Replace Inline Phase Artifact Ternary With a Named Map
**Finding key:** loop-4e707d9a2579f1084dfd
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The phase-to-artifact-name selection is embedded as a ternary inside the loop, which slightly obscures the shared contract being tested for `draft-questions` and `draft-coverage`.  
**Suggestion:** Define a small constant map near the loop, such as `const draftArtifactNames = { "draft-questions": "...", "draft-coverage": "..." }`, and pass `draftArtifactNames[phase]` into `recordCanonicalDraftEvidence()`.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`  
**Requirement:** R1  
**Issue:** The phase-to-artifact-name selection is embedded as a ternary inside the loop, which slightly obscures the shared contract being tested for `draft-questions` and `draft-coverage`.  
**Suggestion:** Define a small constant map near the loop, such as `const draftArtifactNames = { "draft-questions": "...", "draft-coverage": "..." }`, and pass `draftArtifactNames[phase]` into `recordCanonicalDraftEvidence()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 3. Rename `loaded` to describe the guarded lifecycle call
**Finding key:** loop-bc7c2462284f1db23ac2
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R3  
**Issue:** The variable name `loaded` is slightly vague in the new post-hook test. The behavior being asserted is not merely that loading did not happen, but that the normal gate lifecycle was skipped after recovery.  
**Suggestion:** Rename it to something like `normalLifecycleLoaded` or `normalGateLoadCalled` to make the assertion intent clearer.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`  
**Requirement:** R3  
**Issue:** The variable name `loaded` is slightly vague in the new post-hook test. The behavior being asserted is not merely that loading did not happen, but that the normal gate lifecycle was skipped after recovery.  
**Suggestion:** Rename it to something like `normalLifecycleLoaded` or `normalGateLoadCalled` to make the assertion intent clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Extract stale-artifact absence assertions
**Finding key:** loop-607fd8ca17c4e26a2ed4
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R3  
**Issue:** The new stale recovery tests manually assert deleted artifact files with repeated `fs.existsSync(path.join(...))` checks. This pattern is likely to grow as more recovery cases are added, and the expected artifact set is semantically meaningful.  
**Suggestion:** Add a small local helper such as `assertArtifactsAbsent(specDir, relativePaths)` and reuse it in both the acceptance-review and integration-gate stale recovery tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R3  
**Issue:** The new stale recovery tests manually assert deleted artifact files with repeated `fs.existsSync(path.join(...))` checks. This pattern is likely to grow as more recovery cases are added, and the expected artifact set is semantically meaningful.  
**Suggestion:** Add a small local helper such as `assertArtifactsAbsent(specDir, relativePaths)` and reuse it in both the acceptance-review and integration-gate stale recovery tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Extract changed-file fingerprint fixture creation
**Finding key:** loop-bc0bd3ca071793469700
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R3  
**Issue:** The integration gate test builds a `changedFile` object inline, including SHA-256 fingerprint calculation. That fixture shape is domain-specific and may be duplicated by future tests that need regression `changed_files` entries.  
**Suggestion:** Add a helper like `changedFileFixture(relativePath, sourceText)` that returns `{ status: "modified", path, fingerprint }`, keeping the test focused on stale evidence behavior.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`  
**Requirement:** R3  
**Issue:** The integration gate test builds a `changedFile` object inline, including SHA-256 fingerprint calculation. That fixture shape is domain-specific and may be duplicated by future tests that need regression `changed_files` entries.  
**Suggestion:** Add a helper like `changedFileFixture(relativePath, sourceText)` that returns `{ status: "modified", path, fingerprint }`, keeping the test focused on stale evidence behavior.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Reuse the retry metric fixture shape
**Finding key:** loop-1aa4eac723ff2460294e
**Failure mode:** refactor
**File:** tests/unit/flow/retry-recovery-convergence.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R8  
**Issue:** The new test inlines five identical retry metric objects with `Array.from`, which duplicates the metric object shape used by other retry convergence tests and makes the intent less prominent than the fixture mechanics.  
**Suggestion:** If this file already has nearby retry metric setup helpers, reuse or extract a small local helper such as `gateRetryMetrics(phase, count)` to centralize the `{ phase, counter: "gateRetry", delta: 1 }` construction.
**Suggestion:** **File:** `tests/unit/flow/retry-recovery-convergence.test.js`  
**Requirement:** R8  
**Issue:** The new test inlines five identical retry metric objects with `Array.from`, which duplicates the metric object shape used by other retry convergence tests and makes the intent less prominent than the fixture mechanics.  
**Suggestion:** If this file already has nearby retry metric setup helpers, reuse or extract a small local helper such as `gateRetryMetrics(phase, count)` to centralize the `{ phase, counter: "gateRetry", delta: 1 }` construction.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 1. Extract stale artifact filenames into a local constant
**Finding key:** loop-953a5e8936b3bf691d37
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R8  
**Issue:** The stale artifact filenames are duplicated in the setup loop and the `assert.deepEqual` expectation. This makes the test slightly more brittle if the artifact set changes.  
**Suggestion:** Define a local `const staleArtifactFiles = ["test-execute-result.json", "test-result-review.json"];` and reuse it for both writing fixtures and asserting `result.artifacts.staleArtifacts`.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R8  
**Issue:** The stale artifact filenames are duplicated in the setup loop and the `assert.deepEqual` expectation. This makes the test slightly more brittle if the artifact set changes.  
**Suggestion:** Define a local `const staleArtifactFiles = ["test-execute-result.json", "test-result-review.json"];` and reuse it for both writing fixtures and asserting `result.artifacts.staleArtifacts`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 2. Rename `loaded` to reflect the lifecycle assertion
**Finding key:** loop-e2f263f5eee56edb25ed
**Failure mode:** refactor
**File:** tests/unit/flow/run-review-advisory.test.js
**Requirement:** R8
**Issue:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R8  
**Issue:** The variable name `loaded` is generic; the test is specifically asserting that the normal review lifecycle was not entered after recovery.  
**Suggestion:** Rename it to something like `normalLifecycleLoaded` or `loadCalled` so the final assertion reads more directly.
**Suggestion:** **File:** `tests/unit/flow/run-review-advisory.test.js`  
**Requirement:** R8  
**Issue:** The variable name `loaded` is generic; the test is specifically asserting that the normal review lifecycle was not entered after recovery.  
**Suggestion:** Rename it to something like `normalLifecycleLoaded` or `loadCalled` so the final assertion reads more directly.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Centralize Stale Evidence Refresh Result Handling
**Finding key:** loop-33274ebff429594d3c40
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R4
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** Stale evidence recovery behavior is now spread across `run-gate.js`, `run-review.js`, `run-acceptance-review.js`, `stale-test-evidence-refresh.js`, and registry post hooks. Multiple files shape or inspect the same recovered evidence-refresh result, which risks interface drift.
**Suggestion:** Introduce one shared helper/module for stale evidence refresh results, including result construction and predicate checks such as `isRecoveredEvidenceRefreshResult(result)`. Use it from gate, review, acceptance-review, and registry code.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R4  
**Issue:** Stale evidence recovery behavior is now spread across `run-gate.js`, `run-review.js`, `run-acceptance-review.js`, `stale-test-evidence-refresh.js`, and registry post hooks. Multiple files shape or inspect the same recovered evidence-refresh result, which risks interface drift.
**Suggestion:** Introduce one shared helper/module for stale evidence refresh results, including result construction and predicate checks such as `isRecoveredEvidenceRefreshResult(result)`. Use it from gate, review, acceptance-review, and registry code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 2. Normalize Lifecycle-Skip Test Naming
**Finding key:** loop-bdc2e3964cb0ef54f69e
**Failure mode:** refactor
**File:** tests/unit/flow/gate-phase-inference.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** Multiple tests use a generic variable name like `loaded` while asserting that the normal lifecycle was skipped after recovery. The same naming issue appears in both gate and review recovery tests.
**Suggestion:** Rename these consistently across files to something intent-specific, such as `normalLifecycleLoaded` or `normalLifecycleLoadCalled`.
**Suggestion:** **File:** `tests/unit/flow/gate-phase-inference.test.js`
**Requirement:** R3
**Issue:** Multiple tests use a generic variable name like `loaded` while asserting that the normal lifecycle was skipped after recovery. The same naming issue appears in both gate and review recovery tests.
**Suggestion:** Rename these consistently across files to something intent-specific, such as `normalLifecycleLoaded` or `normalLifecycleLoadCalled`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 3. Extract Shared Stale Artifact Test Helpers
**Finding key:** loop-0623b1b4c74cb627241b
**Failure mode:** refactor
**File:** tests/unit/flow/retry-exhaustion-defer.test.js
**Requirement:** R3
**Issue:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`
**Requirement:** R3
**Issue:** Stale artifact fixture setup and absence assertions are repeated across recovery-oriented tests, including `retry-exhaustion-defer.test.js` and `run-review-advisory.test.js`.
**Suggestion:** Add local or shared test helpers for stale artifact filenames, fixture creation, and absence assertions, then reuse them across stale evidence recovery tests.
**Suggestion:** **File:** `tests/unit/flow/retry-exhaustion-defer.test.js`
**Requirement:** R3
**Issue:** Stale artifact fixture setup and absence assertions are repeated across recovery-oriented tests, including `retry-exhaustion-defer.test.js` and `run-review-advisory.test.js`.
**Suggestion:** Add local or shared test helpers for stale artifact filenames, fixture creation, and absence assertions, then reuse them across stale evidence recovery tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 4. Align Draft Phase Artifact Mapping Across Tests
**Finding key:** loop-cb9551b600093fd1ff88
**Failure mode:** refactor
**File:** tests/unit/flow/commands/review.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/flow/commands/review.test.js`
**Requirement:** R1
**Issue:** Draft phase handling is represented in several places with repeated `draft-questions` / `draft-coverage` conditionals, literals, and helper names. This creates a cross-file maintenance risk if phase-to-artifact mapping changes.
**Suggestion:** Define a canonical draft phase artifact map or helper and reuse it in tests and fixture builders that need to resolve phase-specific artifact names.
**Suggestion:** **File:** `tests/unit/flow/commands/review.test.js`
**Requirement:** R1
**Issue:** Draft phase handling is represented in several places with repeated `draft-questions` / `draft-coverage` conditionals, literals, and helper names. This creates a cross-file maintenance risk if phase-to-artifact mapping changes.
**Suggestion:** Define a canonical draft phase artifact map or helper and reuse it in tests and fixture builders that need to resolve phase-specific artifact names.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 5. Consolidate Evidence Identity Modeling
**Finding key:** loop-3831450429dfe588cfa9
**Failure mode:** refactor
**File:** specs/331-draft-repair-target-advisory/flow.json
**Requirement:** R3
**Issue:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Evidence identity fields such as `phase`, `taskId`, `treeSha`, `provider`, timestamps, and digests are duplicated across flow records, issue-log repair references, and test fixture helpers. This increases the chance that committed artifacts and tests encode subtly different identity shapes.
**Suggestion:** Store evidence identity once per logical record and reference it by ID or digest where possible. Mirror that model in test fixture helpers so tests construct the same canonical identity shape as persisted flow artifacts.
**Suggestion:** **File:** `specs/331-draft-repair-target-advisory/flow.json`
**Requirement:** R3
**Issue:** Evidence identity fields such as `phase`, `taskId`, `treeSha`, `provider`, timestamps, and digests are duplicated across flow records, issue-log repair references, and test fixture helpers. This increases the chance that committed artifacts and tests encode subtly different identity shapes.
**Suggestion:** Store evidence identity once per logical record and reference it by ID or digest where possible. Mirror that model in test fixture helpers so tests construct the same canonical identity shape as persisted flow artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
