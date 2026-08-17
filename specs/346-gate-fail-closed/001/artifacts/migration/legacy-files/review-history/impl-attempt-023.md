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

### 7. 1. Extract CLI Rejection Assertion Helper
**Finding key:** loop-14d5b393144df53777f6
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R5
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 test repeats three near-identical `assert.throws(() => execFileSync(...), matcher)` blocks for rejected public CLI options. This makes future CLI-bypass cases more verbose and easier to update inconsistently.  
**Suggestion:** Add a small helper such as `assertCliRejects(args, pattern)` and reuse it for `--skip-guardrail`, `--test-fixture required-agent-pass`, and `--test-fixture=required-agent-pass`.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R5  
**Issue:** The R5 test repeats three near-identical `assert.throws(() => execFileSync(...), matcher)` blocks for rejected public CLI options. This makes future CLI-bypass cases more verbose and easier to update inconsistently.  
**Suggestion:** Add a small helper such as `assertCliRejects(args, pattern)` and reuse it for `--skip-guardrail`, `--test-fixture required-agent-pass`, and `--test-fixture=required-agent-pass`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 8. 2. Extract Temporary Senti Root Setup
**Finding key:** loop-31b9647a262c18a311b9
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R1
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** Several tests duplicate temporary root creation, `.senti` directory creation, config writing, and cleanup. The setup varies only by config content and prefix.  
**Suggestion:** Introduce a helper like `withTempSentiRoot(prefix, config, fn)` that creates the root, writes `.senti/config.json`, runs the callback, and always removes the directory.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R1  
**Issue:** Several tests duplicate temporary root creation, `.senti` directory creation, config writing, and cleanup. The setup varies only by config content and prefix.  
**Suggestion:** Introduce a helper like `withTempSentiRoot(prefix, config, fn)` that creates the root, writes `.senti/config.json`, runs the callback, and always removes the directory.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 9. 3. Split Scenario Normalization From Execution
**Finding key:** loop-fd8c2a9b185f746f66fb
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `executeProductionGate` mixes scenario normalization, fixture agent behavior, guardrail loading behavior, filesystem setup, and the actual `runGateFlow` invocation. That makes individual failure-mode tests harder to read and extend.  
**Suggestion:** Extract helpers such as `createScenarioAgent(scenario, guardrail)` and `createGuardrailPromptOptions(scenario, guardrail)` so `executeProductionGate` reads as setup plus one production gate call.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** `executeProductionGate` mixes scenario normalization, fixture agent behavior, guardrail loading behavior, filesystem setup, and the actual `runGateFlow` invocation. That makes individual failure-mode tests harder to read and extend.  
**Suggestion:** Extract helpers such as `createScenarioAgent(scenario, guardrail)` and `createGuardrailPromptOptions(scenario, guardrail)` so `executeProductionGate` reads as setup plus one production gate call.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 10. 4. Rename `configuredEvaluation`
**Finding key:** loop-e69d8ddc2d60eb9132bd
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R4
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R4  
**Issue:** `configuredEvaluation` can come from either `requiredAgent.output` or `requiredGuardrail.output`, but it is only consumed by the fake agent’s `call()` method. The name obscures that this is the agent’s mock response source.  
**Suggestion:** Rename it to something more specific, such as `agentEvaluationOutput` or `mockAgentOutput`, and keep guardrail-loading scenarios separate from agent-output scenarios.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R4  
**Issue:** `configuredEvaluation` can come from either `requiredAgent.output` or `requiredGuardrail.output`, but it is only consumed by the fake agent’s `call()` method. The name obscures that this is the agent’s mock response source.  
**Suggestion:** Rename it to something more specific, such as `agentEvaluationOutput` or `mockAgentOutput`, and keep guardrail-loading scenarios separate from agent-output scenarios.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 11. 5. Remove Redundant Assertion
**Finding key:** loop-9d9851bbb517f528de8e
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/tests/gate-fail-closed.test.js
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** In the R2 scenario loop, `assert.equal(result.result, "fail", scenario.expected)` already proves the result is not `"pass"`, so `assert.notEqual(result.result, "pass")` is redundant.  
**Suggestion:** Delete the redundant assertion to keep the test focused on the required blocking failure code.
**Suggestion:** **File:** `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`  
**Requirement:** R2  
**Issue:** In the R2 scenario loop, `assert.equal(result.result, "fail", scenario.expected)` already proves the result is not `"pass"`, so `assert.notEqual(result.result, "pass")` is redundant.  
**Suggestion:** Delete the redundant assertion to keep the test focused on the required blocking failure code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 12. 1. Preserve explicit empty/null handling for target state digest
**Finding key:** loop-237aa44fc64860260e91
**Failure mode:** refactor
**File:** src/flow/lib/review-convergence.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `canonicalEvidenceDocument` uses `...(targetStateDigest && { targetStateDigest })`, which drops falsy values. While a SHA-256 digest should be truthy, this makes the serialization rule less explicit and inconsistent with the constructor, which normalizes absent values to `null`.  
**Suggestion:** Use a nullish check instead: `...(targetStateDigest != null && { targetStateDigest })`. This makes the intent clear: include the digest when supplied, omit it only when absent.
**Suggestion:** **File:** `src/flow/lib/review-convergence.js`  
**Requirement:** R6  
**Issue:** `canonicalEvidenceDocument` uses `...(targetStateDigest && { targetStateDigest })`, which drops falsy values. While a SHA-256 digest should be truthy, this makes the serialization rule less explicit and inconsistent with the constructor, which normalizes absent values to `null`.  
**Suggestion:** Use a nullish check instead: `...(targetStateDigest != null && { targetStateDigest })`. This makes the intent clear: include the digest when supplied, omit it only when absent.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 13. 2. Make target state validation symmetric
**Finding key:** loop-086bf460d8d709553f28
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** `validateTarget` only checks `targetStateDigest` when the expected value is non-null. That means a caller passing `null` will accept evidence that contains a non-null `targetStateDigest`, even though R6 says artifacts whose target state does not match must be rejected.  
**Suggestion:** Compare normalized values directly when the argument is provided, or distinguish “not supplied” from “expected null”. For example, avoid the default `targetStateDigest = null` and validate when the property exists in the target object:
```js
if (Object.hasOwn(target, "targetStateDigest") &&
    this.evidence.targetStateDigest !== target.targetStateDigest) {
  throw new Error("review evidence state digest target mismatch");
}
```
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** `validateTarget` only checks `targetStateDigest` when the expected value is non-null. That means a caller passing `null` will accept evidence that contains a non-null `targetStateDigest`, even though R6 says artifacts whose target state does not match must be rejected.  
**Suggestion:** Compare normalized values directly when the argument is provided, or distinguish “not supplied” from “expected null”. For example, avoid the default `targetStateDigest = null` and validate when the property exists in the target object:
```js
if (Object.hasOwn(target, "targetStateDigest") &&
    this.evidence.targetStateDigest !== target.targetStateDigest) {
  throw new Error("review evidence state digest target mismatch");
}
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 14. 3. Avoid indirect access to evidence target fields
**Finding key:** loop-d194091924b35a290ff7
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** `validateTarget` checks `phase`, `taskId`, and `treeSha` via `this.phase`, `this.taskId`, and `this.treeSha`, but checks the new digest via `this.evidence.targetStateDigest`. This inconsistency makes the target identity fields harder to scan and easier to misuse later.  
**Suggestion:** Add a `targetStateDigest` getter to `ReviewEvidenceInput` if the class already exposes the other target fields that way, then validate with `this.targetStateDigest`. This keeps the design pattern consistent across all target fields.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** `validateTarget` checks `phase`, `taskId`, and `treeSha` via `this.phase`, `this.taskId`, and `this.treeSha`, but checks the new digest via `this.evidence.targetStateDigest`. This inconsistency makes the target identity fields harder to scan and easier to misuse later.  
**Suggestion:** Add a `targetStateDigest` getter to `ReviewEvidenceInput` if the class already exposes the other target fields that way, then validate with `this.targetStateDigest`. This keeps the design pattern consistent across all target fields.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 15. 1. Centralize Required-Evaluation Failure Construction
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

### 16. 2. Extract Failure Classification Logic
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

### 17. 3. Remove Dead Return Value From Argument Parser
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

### 18. 4. Deduplicate Public Bypass Error Metadata
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

### 19. 5. Reuse Prerequisite Failure Formatting
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

### 20. 1. Extract Review Target Validation
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

### 21. 2. Avoid Silent Mutation Of Finalized Provider Artifacts
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

### 22. 3. Guard Missing Recovery Registration
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

### 23. 4. Extract Lock Conflict Detection
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

### 24. 1. Remove Unused Registration Shape Method
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

### 25. 2. Simplify Artifact Wrapper
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

### 26. 3. Extract Artifact Target Validation
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

### 27. 4. Tighten Naming Around Canonical Store
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

### 28. 1. Extract post-hook recovery handling
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

### 29. 2. Avoid repeated option-set expansion while parsing
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

### 30. 3. Centralize `--option=value` parsing
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

### 31. 1. Handle Missing Config Before Dereferencing
**Finding key:** loop-04c6278e4f60df99fe41
**Failure mode:** refactor
**File:** src/lib/presets.js
**Requirement:** R1
**Issue:** **File:** `src/lib/presets.js`  
**Requirement:** R1  
**Issue:** `validateConfiguredPresetChains()` documents that it may return `null` when no config exists, but immediately reads `config.type`. If `loadConfig(projectRoot)` can return `null`, this throws instead of returning the documented value.  
**Suggestion:** Change the guard to handle a missing config explicitly:

```js
if (!config?.type) return config;
```
**Suggestion:** **File:** `src/lib/presets.js`  
**Requirement:** R1  
**Issue:** `validateConfiguredPresetChains()` documents that it may return `null` when no config exists, but immediately reads `config.type`. If `loadConfig(projectRoot)` can return `null`, this throws instead of returning the documented value.  
**Suggestion:** Change the guard to handle a missing config explicitly:

```js
if (!config?.type) return config;
```
**Disposition:** informational
**Rationale:** Loop review proposal.

### 32. 2. Clarify Function Name Around Side Effect
**Finding key:** loop-8cc7965623de895f3aba
**Failure mode:** refactor
**File:** src/lib/presets.js
**Requirement:** R1
**Issue:** **File:** `src/lib/presets.js`  
**Requirement:** R1  
**Issue:** `validateConfiguredPresetChains()` returns the loaded config, but its name only describes validation. That makes the API slightly surprising because callers may depend on both behaviors.  
**Suggestion:** Rename it to something that reflects both actions, such as `loadAndValidateConfiguredPresetChains()`, or split it into a pure validator and let callers load config separately if that better matches existing patterns.
**Suggestion:** **File:** `src/lib/presets.js`  
**Requirement:** R1  
**Issue:** `validateConfiguredPresetChains()` returns the loaded config, but its name only describes validation. That makes the API slightly surprising because callers may depend on both behaviors.  
**Suggestion:** Rename it to something that reflects both actions, such as `loadAndValidateConfiguredPresetChains()`, or split it into a pure validator and let callers load config separately if that better matches existing patterns.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 3. Extract Repeated Gate Invocation in E2E Test
**Finding key:** loop-013047aabd4d94306ce9
**Failure mode:** refactor
**File:** tests/e2e/231-task-e2e-full-lifecycle.test.js
**Requirement:** R1
**Issue:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R1  
**Issue:** The test repeats `runEnvelope(tmp, ["flow", "run", "gate", "--phase", ...])` several times. The recent removal of `--skip-guardrail` had to be applied in multiple places, which is a small duplication hazard.  
**Suggestion:** Add a local helper such as `runGate(tmp, phase)` inside the test file and use it for `task-impl` and `integration` gate runs. This keeps future CLI argument changes localized.
**Suggestion:** **File:** `tests/e2e/231-task-e2e-full-lifecycle.test.js`  
**Requirement:** R1  
**Issue:** The test repeats `runEnvelope(tmp, ["flow", "run", "gate", "--phase", ...])` several times. The recent removal of `--skip-guardrail` had to be applied in multiple places, which is a small duplication hazard.  
**Suggestion:** Add a local helper such as `runGate(tmp, phase)` inside the test file and use it for `task-impl` and `integration` gate runs. This keeps future CLI argument changes localized.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 2. Replace Inline Guardrail Marker String With A Named Constant
**Finding key:** loop-8d9ac494a4585ecb48b8
**Failure mode:** refactor
**File:** tests/e2e/flow/gate-impl-integration.test.js
**Requirement:** R2
**Issue:** **File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Requirement:** R2  
**Issue:** The string `"## Guardrail Articles"` is used as an implicit protocol marker inside the test setup. The same marker is also embedded in `tests/helpers/stub-agent.js`, making future prompt-format changes easy to miss.  
**Suggestion:** Define a named constant such as `GUARDRAIL_PROMPT_MARKER` in `tests/helpers/stub-agent.js` and export it for tests to use, or centralize the guardrail fallback case in a helper like `defaultGuardrailPassResponseCase()`.
**Suggestion:** **File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Requirement:** R2  
**Issue:** The string `"## Guardrail Articles"` is used as an implicit protocol marker inside the test setup. The same marker is also embedded in `tests/helpers/stub-agent.js`, making future prompt-format changes easy to miss.  
**Suggestion:** Define a named constant such as `GUARDRAIL_PROMPT_MARKER` in `tests/helpers/stub-agent.js` and export it for tests to use, or centralize the guardrail fallback case in a helper like `defaultGuardrailPassResponseCase()`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 3. Simplify Empty Argument Passing
**Finding key:** loop-c515bbb8160f4fb1bf32
**Failure mode:** refactor
**File:** tests/e2e/flow/gate-impl-integration.test.js
**Requirement:** R3
**Issue:** **File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Requirement:** R3  
**Issue:** One call changed from `runGate(tmp, ["--skip-guardrail"], "integration")` to `runGate(tmp, [], "integration")`, while other no-extra-argument cases use `runGate(tmp)`. Passing an explicit empty array adds noise and makes the call pattern less consistent.  
**Suggestion:** If `runGate` supports an omitted second parameter when mode is supplied, call it with a clearer options object or add a small wrapper such as `runIntegrationGate(tmp)`. If positional arguments must remain, consider defaulting `args = []` and `mode = undefined` through an object parameter to avoid placeholder arrays.
**Suggestion:** **File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Requirement:** R3  
**Issue:** One call changed from `runGate(tmp, ["--skip-guardrail"], "integration")` to `runGate(tmp, [], "integration")`, while other no-extra-argument cases use `runGate(tmp)`. Passing an explicit empty array adds noise and makes the call pattern less consistent.  
**Suggestion:** If `runGate` supports an omitted second parameter when mode is supplied, call it with a clearer options object or add a small wrapper such as `runIntegrationGate(tmp)`. If positional arguments must remain, consider defaulting `args = []` and `mode = undefined` through an object parameter to avoid placeholder arrays.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 1. Avoid Duplicating Guardrail Stub Logic
**Finding key:** loop-a899e5706437035486ef
**Failure mode:** refactor
**File:** tests/helpers/stub-agent.js
**Requirement:** R1
**Issue:** **File:** `tests/helpers/stub-agent.js`  
**Requirement:** R1  
**Issue:** `writeCapturingGateStubAgentScript` duplicates prompt classification and response dispatch behavior that now also exists in `writePromptDispatchStubAgentScript`. This creates two ways to route responses by prompt content.  
**Suggestion:** Implement `writeCapturingGateStubAgentScript` as a thin wrapper around `writePromptDispatchStubAgentScript`, adding capture behavior only for the non-guardrail prompt, or extend the dispatch helper with an optional `captureWhen` predicate/marker. This keeps guardrail routing behavior in one place.
**Suggestion:** **File:** `tests/helpers/stub-agent.js`  
**Requirement:** R1  
**Issue:** `writeCapturingGateStubAgentScript` duplicates prompt classification and response dispatch behavior that now also exists in `writePromptDispatchStubAgentScript`. This creates two ways to route responses by prompt content.  
**Suggestion:** Implement `writeCapturingGateStubAgentScript` as a thin wrapper around `writePromptDispatchStubAgentScript`, adding capture behavior only for the non-guardrail prompt, or extend the dispatch helper with an optional `captureWhen` predicate/marker. This keeps guardrail routing behavior in one place.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 37. 4. Rename Requirement Response Parameter For Schema Clarity
**Finding key:** loop-711ed499939683822b99
**Failure mode:** refactor
**File:** tests/helpers/stub-agent.js
**Requirement:** R4
**Issue:** **File:** `tests/helpers/stub-agent.js`  
**Requirement:** R4  
**Issue:** `requirementResponse` in `writeCapturingGateStubAgentScript` is accurate but slightly ambiguous because the helper routes between requirement and guardrail schemas.  
**Suggestion:** Rename it to `requirementJsonResponse` or `primaryEvaluationResponse` to make it clear the value is emitted only for the non-guardrail evaluation prompt.
**Suggestion:** **File:** `tests/helpers/stub-agent.js`  
**Requirement:** R4  
**Issue:** `requirementResponse` in `writeCapturingGateStubAgentScript` is accurate but slightly ambiguous because the helper routes between requirement and guardrail schemas.  
**Suggestion:** Rename it to `requirementJsonResponse` or `primaryEvaluationResponse` to make it clear the value is emitted only for the non-guardrail evaluation prompt.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 38. 2. Simplify Stub Agent Output Script
**Finding key:** loop-f9743dc81933418dcac1
**Failure mode:** refactor
**File:** tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js`  
**Requirement:** R1  
**Issue:** The stub provider script embeds escaped JSON inside a string, which is noisy and easy to break when edited.  
**Suggestion:** Replace the escaped literal with a clearer script, for example `process.stdout.write(JSON.stringify({ observations: [] }))`, or define the script as a named constant.
**Suggestion:** **File:** `tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js`  
**Requirement:** R1  
**Issue:** The stub provider script embeds escaped JSON inside a string, which is noisy and easy to break when edited.  
**Suggestion:** Replace the escaped literal with a clearer script, for example `process.stdout.write(JSON.stringify({ observations: [] }))`, or define the script as a named constant.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 39. 1. Extract Stub Agent Config Helper
**Finding key:** loop-c3ddb862c0e6e7a73cd4
**Failure mode:** refactor
**File:** tests/unit/specs/commands/gate.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/specs/commands/gate.test.js`  
**Requirement:** R1  
**Issue:** The newly added stub agent configuration is duplicated across touched test files, including the inline `process.execPath` provider and escaped JSON output script.  
**Suggestion:** Add a small local helper or constant such as `stubAgentConfig()` / `STUB_AGENT_CONFIG` and reuse it when writing `.senti/config.json`.
**Suggestion:** **File:** `tests/unit/specs/commands/gate.test.js`  
**Requirement:** R1  
**Issue:** The newly added stub agent configuration is duplicated across touched test files, including the inline `process.execPath` provider and escaped JSON output script.  
**Suggestion:** Add a small local helper or constant such as `stubAgentConfig()` / `STUB_AGENT_CONFIG` and reuse it when writing `.senti/config.json`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 40. 3. Clarify Test Name
**Finding key:** loop-a7e124453ff26dc263c1
**Failure mode:** refactor
**File:** tests/unit/specs/commands/gate.test.js
**Requirement:** R2
**Issue:** **File:** `tests/unit/specs/commands/gate.test.js`  
**Requirement:** R2  
**Issue:** The renamed test title says “required evaluation,” which is less specific than the behavior under test. It no longer references `--skip-guardrail`, but it also obscures that this is about guardrail/agent evaluation fail-closed behavior.  
**Suggestion:** Rename it to something more explicit, such as `phase=spec returns mechanical failures before required guardrail evaluation (R5)`.
**Suggestion:** **File:** `tests/unit/specs/commands/gate.test.js`  
**Requirement:** R2  
**Issue:** The renamed test title says “required evaluation,” which is less specific than the behavior under test. It no longer references `--skip-guardrail`, but it also obscures that this is about guardrail/agent evaluation fail-closed behavior.  
**Suggestion:** Rename it to something more explicit, such as `phase=spec returns mechanical failures before required guardrail evaluation (R5)`.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 41. 1. Rename failure-specific parser
**Finding key:** loop-c152071bf6f5b76b2965
**Failure mode:** refactor
**File:** tests/unit/specs/commands/guardrail.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/specs/commands/guardrail.test.js`  
**Requirement:** R1  
**Issue:** `parseGateResult` does more than parse: it asserts the command failed and that `envelope.ok === false`. The name is too broad and hides the test expectation.  
**Suggestion:** Rename it to something like `parseFailedGateEnvelope(result)` so callers clearly communicate that a non-zero exit and failed envelope are expected.
**Suggestion:** **File:** `tests/unit/specs/commands/guardrail.test.js`  
**Requirement:** R1  
**Issue:** `parseGateResult` does more than parse: it asserts the command failed and that `envelope.ok === false`. The name is too broad and hides the test expectation.  
**Suggestion:** Rename it to something like `parseFailedGateEnvelope(result)` so callers clearly communicate that a non-zero exit and failed envelope are expected.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 42. 2. Table-drive duplicate fail-closed tests
**Finding key:** loop-4d887a3d7ee681c7b5f6
**Failure mode:** refactor
**File:** tests/unit/specs/commands/guardrail.test.js
**Requirement:** R1
**Issue:** **File:** `tests/unit/specs/commands/guardrail.test.js`  
**Requirement:** R1  
**Issue:** The two fail-closed tests repeat the same execution and assertion, differing only in fixture setup and test title.  
**Suggestion:** Convert them to a small table-driven loop, e.g. cases for “no guardrail file” and “configured guardrails”, each asserting `GATE_REQUIRED_AGENT_UNSET`. This keeps the behavioral distinction while reducing duplicated assertion code.
**Suggestion:** **File:** `tests/unit/specs/commands/guardrail.test.js`  
**Requirement:** R1  
**Issue:** The two fail-closed tests repeat the same execution and assertion, differing only in fixture setup and test title.  
**Suggestion:** Convert them to a small table-driven loop, e.g. cases for “no guardrail file” and “configured guardrails”, each asserting `GATE_REQUIRED_AGENT_UNSET`. This keeps the behavioral distinction while reducing duplicated assertion code.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 43. 1. Centralize Guardrail Prompt Marker
**Finding key:** loop-e4dab26e318261aab6ca
**Failure mode:** refactor
**File:** tests/helpers/stub-agent.js
**Requirement:** R2
**Issue:** **File:** `tests/helpers/stub-agent.js`  
**Requirement:** R2  
**Issue:** The guardrail prompt marker string `"## Guardrail Articles"` is referenced across test helper logic and integration test setup, creating an implicit cross-file protocol that can drift if prompt formatting changes.  
**Suggestion:** Export a shared `GUARDRAIL_PROMPT_MARKER` or a helper such as `defaultGuardrailPassResponseCase()` from `tests/helpers/stub-agent.js`, and have the integration tests consume that instead of repeating the marker.
**Suggestion:** **File:** `tests/helpers/stub-agent.js`  
**Requirement:** R2  
**Issue:** The guardrail prompt marker string `"## Guardrail Articles"` is referenced across test helper logic and integration test setup, creating an implicit cross-file protocol that can drift if prompt formatting changes.  
**Suggestion:** Export a shared `GUARDRAIL_PROMPT_MARKER` or a helper such as `defaultGuardrailPassResponseCase()` from `tests/helpers/stub-agent.js`, and have the integration tests consume that instead of repeating the marker.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 44. 2. Consolidate Stub Agent Configuration
**Finding key:** loop-1aa8de19ab8da08f636d
**Failure mode:** refactor
**File:** tests/helpers/stub-agent.js
**Requirement:** R1
**Issue:** **File:** `tests/helpers/stub-agent.js`  
**Requirement:** R1  
**Issue:** Multiple test files introduce inline stub agent config using `process.execPath` and small JSON-emitting scripts. This duplicates provider setup across unit and e2e tests and makes future agent contract changes harder to apply consistently.  
**Suggestion:** Add a shared helper such as `stubAgentConfig(output)` or `writeStubAgentConfig(root, output)` in the test helpers, then reuse it from the touched gate, guardrail, and task-decomp tests.
**Suggestion:** **File:** `tests/helpers/stub-agent.js`  
**Requirement:** R1  
**Issue:** Multiple test files introduce inline stub agent config using `process.execPath` and small JSON-emitting scripts. This duplicates provider setup across unit and e2e tests and makes future agent contract changes harder to apply consistently.  
**Suggestion:** Add a shared helper such as `stubAgentConfig(output)` or `writeStubAgentConfig(root, output)` in the test helpers, then reuse it from the touched gate, guardrail, and task-decomp tests.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 45. 3. Align Review Target Validation Semantics
**Finding key:** loop-408749541bb61f37b7a6
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Target identity validation is split across `run-review.js`, `set-review-evidence.js`, and `review-evidence-store.js`, with slightly different behavior around missing fields, mutation, and `targetStateDigest` matching. That creates an interface inconsistency for what “artifact matches target” means.  
**Suggestion:** Introduce one shared validator for review artifact target fields, including `phase`, `taskId`, `treeSha`, and `targetStateDigest`, and use it from recovery, persistence, and evidence-store validation paths.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Target identity validation is split across `run-review.js`, `set-review-evidence.js`, and `review-evidence-store.js`, with slightly different behavior around missing fields, mutation, and `targetStateDigest` matching. That creates an interface inconsistency for what “artifact matches target” means.  
**Suggestion:** Introduce one shared validator for review artifact target fields, including `phase`, `taskId`, `treeSha`, and `targetStateDigest`, and use it from recovery, persistence, and evidence-store validation paths.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 46. 4. Normalize Target State Digest Access
**Finding key:** loop-7f3f4d949ced8ebf57a0
**Failure mode:** refactor
**File:** src/flow/lib/review-evidence-store.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** Review evidence target fields are exposed inconsistently: existing fields use class accessors, while `targetStateDigest` is accessed through `this.evidence.targetStateDigest`. This naming/access pattern differs across files that now treat the digest as part of the same target identity.  
**Suggestion:** Add a `targetStateDigest` accessor to the evidence wrapper and use that consistently anywhere target identity fields are read or validated.
**Suggestion:** **File:** `src/flow/lib/review-evidence-store.js`  
**Requirement:** R6  
**Issue:** Review evidence target fields are exposed inconsistently: existing fields use class accessors, while `targetStateDigest` is accessed through `this.evidence.targetStateDigest`. This naming/access pattern differs across files that now treat the digest as part of the same target identity.  
**Suggestion:** Add a `targetStateDigest` accessor to the evidence wrapper and use that consistently anywhere target identity fields are read or validated.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 47. 5. Deduplicate Required Evaluation Failure Metadata
**Finding key:** loop-127966b26418b5bff569
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R5
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** Public bypass rejection metadata and required-evaluation failure shapes are now duplicated between CLI argument parsing, command execution, and gate failure construction. This can cause cross-file or cross-path drift in failure codes and messages.  
**Suggestion:** Centralize the failure code/message envelope and route all required-evaluation bypass or fail-closed paths through a shared helper or constants.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R5  
**Issue:** Public bypass rejection metadata and required-evaluation failure shapes are now duplicated between CLI argument parsing, command execution, and gate failure construction. This can cause cross-file or cross-path drift in failure codes and messages.  
**Suggestion:** Centralize the failure code/message envelope and route all required-evaluation bypass or fail-closed paths through a shared helper or constants.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 48. 6. Resolve Spec Source-Of-Truth Duplication
**Finding key:** loop-5b0a63513808c254fc71
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The markdown spec and `spec.json` duplicate much of the same requirement, task, and acceptance-criteria content. This creates two authoritative-looking files that can diverge, especially around retry bounds and status.  
**Suggestion:** Make either `spec.json` or `spec.md` canonical. If both are required, generate one from the other or add an explicit authority note and synchronization rule.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The markdown spec and `spec.json` duplicate much of the same requirement, task, and acceptance-criteria content. This creates two authoritative-looking files that can diverge, especially around retry bounds and status.  
**Suggestion:** Make either `spec.json` or `spec.md` canonical. If both are required, generate one from the other or add an explicit authority note and synchronization rule.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
