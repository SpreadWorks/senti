# Code Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. 1. Add explicit retry bounds to fail-closed contract
**Finding key:** loop-1f9f09a6bde9065bda6c
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/issue.md
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R2  
**Issue:** The spec mentions a “semantic retry budget” but does not define an explicit upper bound. This leaves retry behavior underspecified and conflicts with `bounded-resource-usage`, which requires retries to have explicit count bounds.  
**Suggestion:** Add a concrete maximum retry count, or reference an existing named constant/configuration that enforces the limit, in the Expected Contract or Acceptance Criteria.
**Suggestion:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R2  
**Issue:** The spec mentions a “semantic retry budget” but does not define an explicit upper bound. This leaves retry behavior underspecified and conflicts with `bounded-resource-usage`, which requires retries to have explicit count bounds.  
**Suggestion:** Add a concrete maximum retry count, or reference an existing named constant/configuration that enforces the limit, in the Expected Contract or Acceptance Criteria.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 2. 2. Add trailing newline
**Finding key:** loop-ead4f67a553ee5c8ae12
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/issue.md
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R1  
**Issue:** The file has no trailing newline, which is inconsistent with normal repository text-file formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Suggestion:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R1  
**Issue:** The file has no trailing newline, which is inconsistent with normal repository text-file formatting and can create noisy diffs later.  
**Suggestion:** Add a final newline at EOF.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 3. 2. Align Task Status With Requirement Status
**Finding key:** loop-5c50ec3c6191c0d300e1
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.json
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R2  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That makes the spec internally inconsistent and weakens downstream automation that may rely on task state.  
**Suggestion:** Either mark completed tasks as `"done"` or keep requirements non-done until their implementation tasks are complete.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R2  
**Issue:** All requirements are marked `"status": "done"`, but every task remains `"status": "pending"`. That makes the spec internally inconsistent and weakens downstream automation that may rely on task state.  
**Suggestion:** Either mark completed tasks as `"done"` or keep requirements non-done until their implementation tasks are complete.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 4. 4. Make The Bounded Retry Limit Easier To Maintain
**Finding key:** loop-a70190ece8350687bcc8
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.json
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R1  
**Issue:** The semantic retry bound appears as prose: “configured maximum of five semantic gate retries.” If implementation or tests consume this requirement, the bound is not mechanically discoverable.  
**Suggestion:** Add a structured field such as `"semantic_gate_retry_limit": 5` or include the value in a dedicated constraint object, while keeping the prose for readability.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.json`  
**Requirement:** R1  
**Issue:** The semantic retry bound appears as prose: “configured maximum of five semantic gate retries.” If implementation or tests consume this requirement, the bound is not mechanically discoverable.  
**Suggestion:** Add a structured field such as `"semantic_gate_retry_limit": 5` or include the value in a dedicated constraint object, while keeping the prose for readability.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 5. 1. Remove Empty Placeholder Sections
**Finding key:** loop-33df5dfb873032b1e388
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R1  
**Issue:** `Clarifications (Q&A)`, `Implementation Targets`, and `Open Questions` contain only empty placeholders, which add noise and can be mistaken for incomplete spec work.  
**Suggestion:** Remove these sections when they have no content, or replace them with explicit `None` entries if the spec format requires the headings.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R1  
**Issue:** `Clarifications (Q&A)`, `Implementation Targets`, and `Open Questions` contain only empty placeholders, which add noise and can be mistaken for incomplete spec work.  
**Suggestion:** Remove these sections when they have no content, or replace them with explicit `None` entries if the spec format requires the headings.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 6. 3. Avoid Duplicated Spec Content Across Markdown And JSON
**Finding key:** loop-d7a6716dc4ee53b475f5
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The markdown file duplicates much of `spec.json` verbatim: goal, background, scope, constraints, overview, requirements, acceptance criteria, tasks, and approval metadata. This creates two sources that can drift.  
**Suggestion:** Treat one file as canonical. If both formats are required, generate `spec.md` from `spec.json` or add a short note identifying which file is authoritative.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The markdown file duplicates much of `spec.json` verbatim: goal, background, scope, constraints, overview, requirements, acceptance criteria, tasks, and approval metadata. This creates two sources that can drift.  
**Suggestion:** Treat one file as canonical. If both formats are required, generate `spec.md` from `spec.json` or add a short note identifying which file is authoritative.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 7. 1. Extract Repeated Temporary Project Setup
**Finding key:** loop-1904fb786b803b1dbf98
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** The test file repeats temporary root creation, `.senti` directory creation, config writing, and cleanup across `executeProductionGate`, the R1 test, and the R4 foreign-policy test. This makes setup details harder to audit and increases the chance that future tests drift in subtly different ways.  
**Suggestion:** Add a local helper such as `withTempSentiProject(prefix, config, fn)` that creates the temp root, writes `.senti/config.json`, runs the callback, and always removes the directory.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** The test file repeats temporary root creation, `.senti` directory creation, config writing, and cleanup across `executeProductionGate`, the R1 test, and the R4 foreign-policy test. This makes setup details harder to audit and increases the chance that future tests drift in subtly different ways.  
**Suggestion:** Add a local helper such as `withTempSentiProject(prefix, config, fn)` that creates the temp root, writes `.senti/config.json`, runs the callback, and always removes the directory.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Remove Unused Scenario Field or Make It Explicit
**Finding key:** loop-17fcee0c9606d8c76f68
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** `executeProductionGate` checks `scenario.presetChain?.includes("missing-preset")`, but the helper does not actually model a preset chain. It only toggles the config `type` to `"missing-preset"`. The name implies deeper behavior than the test exercises.  
**Suggestion:** Replace `presetChain` with a clearer boolean or enum, for example `missingPreset: true`, or pass the desired config type directly as `configType: "missing-preset"`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** `executeProductionGate` checks `scenario.presetChain?.includes("missing-preset")`, but the helper does not actually model a preset chain. It only toggles the config `type` to `"missing-preset"`. The name implies deeper behavior than the test exercises.  
**Suggestion:** Replace `presetChain` with a clearer boolean or enum, for example `missingPreset: true`, or pass the desired config type directly as `configType: "missing-preset"`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Rename `configuredEvaluation`
**Finding key:** loop-3d3ce072a9301c53727f
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `configuredEvaluation` is derived from either `requiredAgent.output` or `requiredGuardrail.output`, but the helper uses it inside the fake agent call. The name obscures that this is the mocked evaluator output and not necessarily configuration.  
**Suggestion:** Rename it to something more concrete, such as `mockEvaluationOutput` or `agentOutputFixture`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `configuredEvaluation` is derived from either `requiredAgent.output` or `requiredGuardrail.output`, but the helper uses it inside the fake agent call. The name obscures that this is the mocked evaluator output and not necessarily configuration.  
**Suggestion:** Rename it to something more concrete, such as `mockEvaluationOutput` or `agentOutputFixture`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 4. Extract Public CLI Rejection Assertion
**Finding key:** loop-58cfc9f0dbb93ab89631
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 test repeats three nearly identical `assert.throws(() => execFileSync(...), matcher)` blocks for rejected CLI flags. The duplicated command construction and output matching make the test longer than needed.  
**Suggestion:** Add a helper like `assertPublicGateRejects(args, expectedPattern)` and call it for `["--skip-guardrail"]`, `["--test-fixture", "required-agent-pass"]`, and `["--test-fixture=required-agent-pass"]`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 test repeats three nearly identical `assert.throws(() => execFileSync(...), matcher)` blocks for rejected CLI flags. The duplicated command construction and output matching make the test longer than needed.  
**Suggestion:** Add a helper like `assertPublicGateRejects(args, expectedPattern)` and call it for `["--skip-guardrail"]`, `["--test-fixture", "required-agent-pass"]`, and `["--test-fixture=required-agent-pass"]`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 5. Extract Stale Artifact Rejection Helper
**Finding key:** loop-a0c70a8c2841f324dfd0
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R6
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R6  
**Issue:** The R6 stale artifact loop repeats the full `recoverFinalizedFlowReviewEvidence` invocation, including provider and store wiring, inside the assertion. This makes the actual stale-field matrix less prominent.  
**Suggestion:** Extract a local `recover(providerArtifact)` helper inside the test and use `assert.throws(() => recover(staleArtifact), /phase|task|tree|state/i)`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R6  
**Issue:** The R6 stale artifact loop repeats the full `recoverFinalizedFlowReviewEvidence` invocation, including provider and store wiring, inside the assertion. This makes the actual stale-field matrix less prominent.  
**Suggestion:** Extract a local `recover(providerArtifact)` helper inside the test and use `assert.throws(() => recover(staleArtifact), /phase|task|tree|state/i)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 6. Consider Whether the New Comment Adds Enough Signal
**Finding key:** loop-f695e395a310746ee5aa
**Failure mode:** refactor
**File:** src/flow/lib/impl-repair-artifacts.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** The added JSDoc explains why `completeLateAppliedFindingRepair` exists, but it does not document the function’s inputs or observable behavior. If the surrounding file does not generally use narrative JSDoc for exported functions, this may be inconsistent with local style.  
**Suggestion:** Either expand the comment into API-oriented JSDoc with parameter semantics, or shorten it to a focused inline comment near the logic that avoids invalidating current artifacts.
**Suggestion:** **File:** `src/flow/lib/impl-repair-artifacts.js`  
**Requirement:** R6  
**Issue:** The added JSDoc explains why `completeLateAppliedFindingRepair` exists, but it does not document the function’s inputs or observable behavior. If the surrounding file does not generally use narrative JSDoc for exported functions, this may be inconsistent with local style.  
**Suggestion:** Either expand the comment into API-oriented JSDoc with parameter semantics, or shorten it to a focused inline comment near the logic that avoids invalidating current artifacts.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 1. Reject Evidence Missing The Expected State Digest
**Finding key:** loop-b21f781407dafe0b5b8f
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** `validateTarget()` only rejects when `this.evidence.targetStateDigest != null` and differs from `targetStateDigest`. If the finalized artifact has no `targetStateDigest` but the caller supplies the current state fingerprint, validation passes. R6 requires rejecting artifacts whose target state does not match, and a missing digest cannot prove a match.  
**Suggestion:** Compare both sides when a target digest is required, for example:

```js
if (targetStateDigest != null && this.evidence.targetStateDigest !== targetStateDigest) {
  throw new Error("review evidence state digest target mismatch");
}
```

If legacy digest-less evidence must remain valid in other paths, make that allowance explicit at the call site with a named option such as `allowMissingTargetStateDigest`, rather than silently accepting it here.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** `validateTarget()` only rejects when `this.evidence.targetStateDigest != null` and differs from `targetStateDigest`. If the finalized artifact has no `targetStateDigest` but the caller supplies the current state fingerprint, validation passes. R6 requires rejecting artifacts whose target state does not match, and a missing digest cannot prove a match.  
**Suggestion:** Compare both sides when a target digest is required, for example:

```js
if (targetStateDigest != null && this.evidence.targetStateDigest !== targetStateDigest) {
  throw new Error("review evidence state digest target mismatch");
}
```

If legacy digest-less evidence must remain valid in other paths, make that allowance explicit at the call site with a named option such as `allowMissingTargetStateDigest`, rather than silently accepting it here.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 1. Centralize Required-Evaluation Failure Construction
**Finding key:** loop-c9f963a715632bfb89b1
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `checkGuardrail()` now builds the same failure object shape in multiple places: `requiredGuardrailFailure()`, the agent-unset branch, and the evaluation catch block. This duplicates `passed: false`, `evaluations: []`, and failure metadata wiring.  
**Suggestion:** Use `requiredGuardrailFailure()` for every required-evaluation failure path, or rename it to a broader `requiredEvaluationFailure()` and route guardrail, agent, output, and schema failures through it.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** `checkGuardrail()` now builds the same failure object shape in multiple places: `requiredGuardrailFailure()`, the agent-unset branch, and the evaluation catch block. This duplicates `passed: false`, `evaluations: []`, and failure metadata wiring.  
**Suggestion:** Use `requiredGuardrailFailure()` for every required-evaluation failure path, or rename it to a broader `requiredEvaluationFailure()` and route guardrail, agent, output, and schema failures through it.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 2. Extract Failure Classification Logic
**Finding key:** loop-65ab8a5e101bde65b037
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R3
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** Spawn/schema/output classification is repeated inline with string/regex checks in both guardrail loading and agent evaluation handling. This makes failure-kind/code consistency easier to drift over time.  
**Suggestion:** Extract small helpers such as `isSpawnFailure(error)` and `classifyRequiredEvaluationError(error)`, returning `{ failureKind, failureCode, failureReason }`.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R3  
**Issue:** Spawn/schema/output classification is repeated inline with string/regex checks in both guardrail loading and agent evaluation handling. This makes failure-kind/code consistency easier to drift over time.  
**Suggestion:** Extract small helpers such as `isSpawnFailure(error)` and `classifyRequiredEvaluationError(error)`, returning `{ failureKind, failureCode, failureReason }`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 16. 3. Remove Dead Return Value From Argument Parser
**Finding key:** loop-f494be783ff54308a1b9
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `parsePublicGateArguments()` always returns `{}`, but callers only use it for its throwing behavior. The return value suggests parsed data exists when it does not.  
**Suggestion:** Make the function return `undefined`, or rename it to `assertPublicGateArgumentsAllowed(argv)` to match its actual purpose.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** `parsePublicGateArguments()` always returns `{}`, but callers only use it for its throwing behavior. The return value suggests parsed data exists when it does not.  
**Suggestion:** Make the function return `undefined`, or rename it to `assertPublicGateArgumentsAllowed(argv)` to match its actual purpose.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 17. 4. Deduplicate Public Bypass Error Metadata
**Finding key:** loop-bbb911f7aec6202b620f
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** The bypass error code and message are duplicated in `parsePublicGateArguments()` and `RunGateCommand.run()`.  
**Suggestion:** Introduce constants or a helper like `requiredEvaluationBypassEnvelope()` so the public CLI rejection path uses one source of truth for code/message.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** The bypass error code and message are duplicated in `parsePublicGateArguments()` and `RunGateCommand.run()`.  
**Suggestion:** Introduce constants or a helper like `requiredEvaluationBypassEnvelope()` so the public CLI rejection path uses one source of truth for code/message.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 18. 5. Reuse Prerequisite Failure Formatting
**Finding key:** loop-b6bb2b225ae22cf09a32
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R1
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** The preset-chain prerequisite failure is built manually inside `runGateFlow()`, while required-evaluation failures now have a dedicated helper path. This creates another one-off failure-artifact mutation site.  
**Suggestion:** Add a focused helper, for example `gatePrerequisiteFail(level, phase, targetPath, code, message)`, that wraps `gateFail()` and sets `artifacts.failureKind`, `artifacts.failureCode`, and warnings consistently.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R1  
**Issue:** The preset-chain prerequisite failure is built manually inside `runGateFlow()`, while required-evaluation failures now have a dedicated helper path. This creates another one-off failure-artifact mutation site.  
**Suggestion:** Add a focused helper, for example `gatePrerequisiteFail(level, phase, targetPath, code, message)`, that wraps `gateFail()` and sets `artifacts.failureKind`, `artifacts.failureCode`, and warnings consistently.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 19. 1. Extract Review Target Validation
**Finding key:** loop-7c4b123d58cd65bf0fde
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** The new recovery path and `persistCanonicalReviewArtifact` now both validate or stamp `phase`, `taskId`, `treeSha`, and `targetStateDigest`, but the logic is split and slightly different. Recovery rejects missing or mismatched target metadata, while persistence mutates missing fields into the artifact.  
**Suggestion:** Add a shared helper such as `assertReviewArtifactMatchesTarget(artifact, expected, { allowMissing })` and use it in both paths. This removes duplicate target-field handling and makes the R6 fail-closed behavior easier to audit.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** The new recovery path and `persistCanonicalReviewArtifact` now both validate or stamp `phase`, `taskId`, `treeSha`, and `targetStateDigest`, but the logic is split and slightly different. Recovery rejects missing or mismatched target metadata, while persistence mutates missing fields into the artifact.  
**Suggestion:** Add a shared helper such as `assertReviewArtifactMatchesTarget(artifact, expected, { allowMissing })` and use it in both paths. This removes duplicate target-field handling and makes the R6 fail-closed behavior easier to audit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 20. 2. Avoid Silent Mutation Of Finalized Provider Artifacts
**Finding key:** loop-f28f12666e8d47cc2c7d
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `persistCanonicalReviewArtifact` rewrites the provider artifact with target fields when they are missing. That makes finalized artifact validation less explicit and creates a second representation of provider output on disk.  
**Suggestion:** Keep provider artifacts immutable after provider completion. Validate existing target fields, then apply normalized target metadata only to the canonical evidence object. If missing fields are acceptable for older artifacts, handle that through an explicit compatibility branch rather than rewriting the artifact file.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `persistCanonicalReviewArtifact` rewrites the provider artifact with target fields when they are missing. That makes finalized artifact validation less explicit and creates a second representation of provider output on disk.  
**Suggestion:** Keep provider artifacts immutable after provider completion. Validate existing target fields, then apply normalized target metadata only to the canonical evidence object. If missing fields are acceptable for older artifacts, handle that through an explicit compatibility branch rather than rewriting the artifact file.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 21. 3. Guard Missing Recovery Registration
**Finding key:** loop-c41a297c7a1cf6da0208
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `recoverFinalizedFlowReviewPostHookFailure` assumes `recoverFinalizedFlowReviewEvidence` always calls `canonicalEvidenceStore.register`. If that contract changes or recovery short-circuits, `registration.convergenceState` will throw a vague `TypeError`.  
**Suggestion:** Add an explicit post-call assertion, for example throwing `REVIEW_EVIDENCE_RECOVERY_FAILED` when `registration` is still unset. This makes the recovery path fail clearly without obscuring the artifact validation result.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** `recoverFinalizedFlowReviewPostHookFailure` assumes `recoverFinalizedFlowReviewEvidence` always calls `canonicalEvidenceStore.register`. If that contract changes or recovery short-circuits, `registration.convergenceState` will throw a vague `TypeError`.  
**Suggestion:** Add an explicit post-call assertion, for example throwing `REVIEW_EVIDENCE_RECOVERY_FAILED` when `registration` is still unset. This makes the recovery path fail clearly without obscuring the artifact validation result.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 22. 4. Extract Lock Conflict Detection
**Finding key:** loop-e0dbfb132db15100104c
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** The lock-conflict check is embedded as an inline regex in `recoverFinalizedFlowReviewPostHookFailure`, which makes the recovery trigger hard to reuse or test independently.  
**Suggestion:** Move it to a small helper such as `isPostHookLockConflict(error)`. That keeps the recovery function focused on artifact validation and evidence registration, and gives one place to adjust lock-error matching.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** The lock-conflict check is embedded as an inline regex in `recoverFinalizedFlowReviewPostHookFailure`, which makes the recovery trigger hard to reuse or test independently.  
**Suggestion:** Move it to a small helper such as `isPostHookLockConflict(error)`. That keeps the recovery function focused on artifact validation and evidence registration, and gives one place to adjust lock-error matching.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 23. 1. Remove Unused Registration Shape Method
**Finding key:** loop-8adbc1cd2dd50f6c1f11
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact.toRegistration()` is not used by the added recovery path. The actual registration passes `artifact.evidence` directly to `canonicalEvidenceStore.register()`, so this method appears to be dead code and adds a second representation of the same identity fields.  
**Suggestion:** Remove `toRegistration()` unless a caller in this change set needs it. If a registration payload is needed later, construct it at the call site or expose a clearly named helper only when used.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact.toRegistration()` is not used by the added recovery path. The actual registration passes `artifact.evidence` directly to `canonicalEvidenceStore.register()`, so this method appears to be dead code and adds a second representation of the same identity fields.  
**Suggestion:** Remove `toRegistration()` unless a caller in this change set needs it. If a registration payload is needed later, construct it at the call site or expose a clearly named helper only when used.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 24. 2. Simplify Artifact Wrapper
**Finding key:** loop-2faa4ea00887ed8f8230
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact` stores `phase`, `taskId`, `treeSha`, and `targetStateDigest` only to immediately duplicate them into `ReviewEvidence`. This makes the adapter heavier than necessary and creates two places that must remain consistent.  
**Suggestion:** Replace the class with a smaller helper such as `buildRecoveredFinalizedFlowReviewEvidence(providerArtifact, state)` that validates the artifact and returns a `ReviewEvidence` instance directly. Then `recoverFinalizedFlowReviewEvidence()` can register that returned evidence.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** `FinalizedFlowReviewArtifact` stores `phase`, `taskId`, `treeSha`, and `targetStateDigest` only to immediately duplicate them into `ReviewEvidence`. This makes the adapter heavier than necessary and creates two places that must remain consistent.  
**Suggestion:** Replace the class with a smaller helper such as `buildRecoveredFinalizedFlowReviewEvidence(providerArtifact, state)` that validates the artifact and returns a `ReviewEvidence` instance directly. Then `recoverFinalizedFlowReviewEvidence()` can register that returned evidence.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 25. 3. Extract Artifact Target Validation
**Finding key:** loop-afcb23335f1aa0555185
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** The constructor mixes validation, provenance fallback, disposition creation, evidence construction, and object freezing. This makes the R6 rejection rules harder to scan and maintain.  
**Suggestion:** Extract the phase/tree/task/state checks into a focused helper, for example `assertFinalizedFlowArtifactMatchesState(providerArtifact, state)`. Keep evidence construction separate so the “reject artifacts whose phase, tree, or target state does not match” behavior is explicit.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** The constructor mixes validation, provenance fallback, disposition creation, evidence construction, and object freezing. This makes the R6 rejection rules harder to scan and maintain.  
**Suggestion:** Extract the phase/tree/task/state checks into a focused helper, for example `assertFinalizedFlowArtifactMatchesState(providerArtifact, state)`. Keep evidence construction separate so the “reject artifacts whose phase, tree, or target state does not match” behavior is explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 26. 4. Tighten Naming Around Canonical Store
**Finding key:** loop-fef29584e46687cbe600
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** The parameter name `canonicalEvidenceStore` differs from the imported `ReviewEvidenceStore` naming style and from the domain phrase “review evidence.” It is clear enough locally, but slightly generic in a file that may handle multiple evidence-like concepts.  
**Suggestion:** Rename the parameter to `reviewEvidenceStore` or `canonicalReviewEvidenceStore` to match the surrounding domain and make the required `.register()` dependency clearer.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** The parameter name `canonicalEvidenceStore` differs from the imported `ReviewEvidenceStore` naming style and from the domain phrase “review evidence.” It is clear enough locally, but slightly generic in a file that may handle multiple evidence-like concepts.  
**Suggestion:** Rename the parameter to `reviewEvidenceStore` or `canonicalReviewEvidenceStore` to match the surrounding domain and make the required `.register()` dependency clearer.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 27. 1. Extract post-hook recovery handling
**Finding key:** loop-8bb834fa9036e862284d
**Failure mode:** refactor
**File:** src/flow/registry.js
**Requirement:** R6
**Issue:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** The `run.gate` post-hook `catch` block now mixes persistence failure handling, finalized artifact recovery, lifecycle replay, and error selection inline. This makes the R6 recovery path harder to audit.  
**Suggestion:** Move this block into a small helper such as `handleGatePostHookFailure(ctx, result, error)`, returning a boolean for recovered vs rethrow. Keep the `post` hook focused on orchestration.
**Suggestion:** **File:** `src/flow/registry.js`  
**Requirement:** R6  
**Issue:** The `run.gate` post-hook `catch` block now mixes persistence failure handling, finalized artifact recovery, lifecycle replay, and error selection inline. This makes the R6 recovery path harder to audit.  
**Suggestion:** Move this block into a small helper such as `handleGatePostHookFailure(ctx, result, error)`, returning a boolean for recovered vs rethrow. Keep the `post` hook focused on orchestration.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 28. 2. Avoid repeated option-set expansion while parsing
**Finding key:** loop-f75dd28c81983a773b70
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R5
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** `splitArgsBySpec` now runs `[...optionSet].find(...)` for every argument. That repeatedly allocates an array and scans all options.  
**Suggestion:** Precompute `const options = [...optionSet];` once near the start of `splitArgsBySpec`, then use `options.find(...)`.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** `splitArgsBySpec` now runs `[...optionSet].find(...)` for every argument. That repeatedly allocates an array and scans all options.  
**Suggestion:** Precompute `const options = [...optionSet];` once near the start of `splitArgsBySpec`, then use `options.find(...)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 29. 3. Centralize `--option=value` parsing
**Finding key:** loop-772773f4890f332cab94
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R5
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** Required options now support `--option=value`, but the parsing is embedded inline and separate from the existing option handling path. This increases the chance of future drift between `--option value` and `--option=value`.  
**Suggestion:** Extract a helper like `parseEqualsOption(arg, optionSet)` and route the result through the same validation/push behavior used by normal options. This keeps option parsing behavior consistent.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** Required options now support `--option=value`, but the parsing is embedded inline and separate from the existing option handling path. This increases the chance of future drift between `--option value` and `--option=value`.  
**Suggestion:** Extract a helper like `parseEqualsOption(arg, optionSet)` and route the result through the same validation/push behavior used by normal options. This keeps option parsing behavior consistent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 30. 1. Align the Return Contract With the Implementation
**Finding key:** loop-56f175dd4835e8cc2ca1
**Failure mode:** refactor
**File:** src/lib/presets.js
**Requirement:** R1
**Issue:** **File:** `src/lib/presets.js`  
**Requirement:** R1  
**Issue:** The JSDoc says `validateConfiguredPresetChains` returns `object|null`, but the implementation always returns `config` from `loadConfig(projectRoot)`. There is no visible `null` path in this change, so the comment creates a misleading API contract.  
**Suggestion:** Either update the JSDoc to match the real `loadConfig` behavior, or explicitly return `null` when no config exists if that is the intended contract. For example, prefer a precise comment such as `@returns {object} the project config` if `loadConfig` always returns an object.
**Suggestion:** **File:** `src/lib/presets.js`  
**Requirement:** R1  
**Issue:** The JSDoc says `validateConfiguredPresetChains` returns `object|null`, but the implementation always returns `config` from `loadConfig(projectRoot)`. There is no visible `null` path in this change, so the comment creates a misleading API contract.  
**Suggestion:** Either update the JSDoc to match the real `loadConfig` behavior, or explicitly return `null` when no config exists if that is the intended contract. For example, prefer a precise comment such as `@returns {object} the project config` if `loadConfig` always returns an object.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 31. 1. Align Retry Bound Across Spec Artifacts
**Finding key:** loop-ec5778515da105707677
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/issue.md
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R2  
**Issue:** `spec.json` defines the semantic retry bound as “maximum of five semantic gate retries,” while `issue.md` only says “semantic retry budget” without the explicit bound. That creates a cross-file contract mismatch for R2.  
**Suggestion:** Update `issue.md` to reference the same retry limit as `spec.json`, ideally through one canonical structured field or named constant.
**Suggestion:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R2  
**Issue:** `spec.json` defines the semantic retry bound as “maximum of five semantic gate retries,” while `issue.md` only says “semantic retry budget” without the explicit bound. That creates a cross-file contract mismatch for R2.  
**Suggestion:** Update `issue.md` to reference the same retry limit as `spec.json`, ideally through one canonical structured field or named constant.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Avoid Dual Canonical Spec Sources
**Finding key:** loop-31aa7b36eaad1da751cb
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** `spec.md` duplicates large portions of `spec.json`, including requirements, tasks, acceptance criteria, and approval metadata. This introduces two cross-file sources of truth that can drift.  
**Suggestion:** Declare `spec.json` canonical and generate `spec.md` from it, or reduce `spec.md` to a human-readable summary that links back to the JSON source.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** `spec.md` duplicates large portions of `spec.json`, including requirements, tasks, acceptance criteria, and approval metadata. This introduces two cross-file sources of truth that can drift.  
**Suggestion:** Declare `spec.json` canonical and generate `spec.md` from it, or reduce `spec.md` to a human-readable summary that links back to the JSON source.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Centralize Review Artifact Target Validation
**Finding key:** loop-7c17a63ff02eb8507494
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** R6 target validation is spread across `run-review.js`, `set-review-evidence.js`, and `review-evidence-store.js`, with slightly different behavior around missing or mismatched `phase`, `taskId`, `treeSha`, and `targetStateDigest`.  
**Suggestion:** Add one shared helper such as `assertReviewArtifactMatchesTarget(...)` and use it in recovery, persistence, and evidence-store validation paths.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** R6 target validation is spread across `run-review.js`, `set-review-evidence.js`, and `review-evidence-store.js`, with slightly different behavior around missing or mismatched `phase`, `taskId`, `treeSha`, and `targetStateDigest`.  
**Suggestion:** Add one shared helper such as `assertReviewArtifactMatchesTarget(...)` and use it in recovery, persistence, and evidence-store validation paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 4. Normalize Review Evidence Store Naming
**Finding key:** loop-5b2177766e2ac2d98381
**Failure mode:** refactor
**File:** src/flow/lib/set-review-evidence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** The same dependency is referred to with related but inconsistent names across files: `canonicalEvidenceStore`, `ReviewEvidenceStore`, and canonical review evidence language in `run-review.js`. This makes the cross-file recovery contract harder to follow.  
**Suggestion:** Use one domain name consistently, such as `canonicalReviewEvidenceStore`, across `set-review-evidence.js`, `run-review.js`, and related tests.
**Suggestion:** **File:** `src/flow/lib/set-review-evidence.js`  
**Requirement:** R6  
**Issue:** The same dependency is referred to with related but inconsistent names across files: `canonicalEvidenceStore`, `ReviewEvidenceStore`, and canonical review evidence language in `run-review.js`. This makes the cross-file recovery contract harder to follow.  
**Suggestion:** Use one domain name consistently, such as `canonicalReviewEvidenceStore`, across `set-review-evidence.js`, `run-review.js`, and related tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 5. Share Public Gate Rejection Helpers Between Code And Tests
**Finding key:** loop-d5c5bfba37c9426a1343
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** Public bypass rejection metadata is duplicated in production code, while the tests separately duplicate CLI rejection assertions for the same behavior. This increases drift risk between rejected flags, error code/message, and expected output.  
**Suggestion:** Centralize production rejection metadata in one helper or constant, and mirror the test assertions through a single `assertPublicGateRejects(...)` helper.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** Public bypass rejection metadata is duplicated in production code, while the tests separately duplicate CLI rejection assertions for the same behavior. This increases drift risk between rejected flags, error code/message, and expected output.  
**Suggestion:** Centralize production rejection metadata in one helper or constant, and mirror the test assertions through a single `assertPublicGateRejects(...)` helper.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
