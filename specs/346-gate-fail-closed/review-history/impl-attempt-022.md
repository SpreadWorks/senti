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

### 31. 1. Align the Return Contract With the Implementation
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

### 32. 1. Centralize target-state validation across review evidence paths
**Finding key:** loop-5c13b244b0bbb423925e
**Failure mode:** refactor
**File:** src/flow/lib/run-review.js
**Requirement:** R6
**Issue:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Multiple files introduce overlapping target identity validation for `phase`, `taskId`, `treeSha`, and `targetStateDigest`: `run-review.js`, `set-review-evidence.js`, and `review-evidence-store.js`. The summaries show slightly different behavior, including mutation during persistence, strict recovery validation, and asymmetric digest validation. This creates a cross-file interface inconsistency for what “matches target state” means.  
**Suggestion:** Add one shared validation helper, for example `assertReviewArtifactMatchesTarget(artifact, target, options)`, and use it from recovery, persistence, and evidence-store validation. Make null versus missing `targetStateDigest` explicit.
**Suggestion:** **File:** `src/flow/lib/run-review.js`  
**Requirement:** R6  
**Issue:** Multiple files introduce overlapping target identity validation for `phase`, `taskId`, `treeSha`, and `targetStateDigest`: `run-review.js`, `set-review-evidence.js`, and `review-evidence-store.js`. The summaries show slightly different behavior, including mutation during persistence, strict recovery validation, and asymmetric digest validation. This creates a cross-file interface inconsistency for what “matches target state” means.  
**Suggestion:** Add one shared validation helper, for example `assertReviewArtifactMatchesTarget(artifact, target, options)`, and use it from recovery, persistence, and evidence-store validation. Make null versus missing `targetStateDigest` explicit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 33. 2. Deduplicate required-gate failure construction
**Finding key:** loop-0b3b8baff37e3a453cda
**Failure mode:** refactor
**File:** src/flow/lib/run-gate.js
**Requirement:** R2
**Issue:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Required gate failure metadata is constructed in several places and is also asserted through repeated patterns in `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`. This increases the chance that failure code, failure kind, warnings, or CLI rejection behavior drift between implementation and tests.  
**Suggestion:** Route all required-evaluation failures through a single helper such as `requiredEvaluationFailure()`, and expose stable failure codes/messages that tests assert against.
**Suggestion:** **File:** `src/flow/lib/run-gate.js`  
**Requirement:** R2  
**Issue:** Required gate failure metadata is constructed in several places and is also asserted through repeated patterns in `specs/346-gate-fail-closed/tests/gate-fail-closed.test.js`. This increases the chance that failure code, failure kind, warnings, or CLI rejection behavior drift between implementation and tests.  
**Suggestion:** Route all required-evaluation failures through a single helper such as `requiredEvaluationFailure()`, and expose stable failure codes/messages that tests assert against.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 34. 3. Align retry-bound representation between spec files
**Finding key:** loop-ebafbf74e2a4910be6d9
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/issue.md
**Requirement:** R2
**Issue:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R2  
**Issue:** `issue.md` reportedly mentions a semantic retry budget without a concrete bound, while `spec.json` contains prose for “configured maximum of five semantic gate retries.” That creates a cross-file requirement inconsistency: one spec artifact is underspecified while another defines the bound informally.  
**Suggestion:** Make the retry limit explicit in both spec artifacts, ideally with `spec.json` containing a structured value such as `"semantic_gate_retry_limit": 5` and `issue.md` referencing the same named limit.
**Suggestion:** **File:** `specs/346-gate-fail-closed/issue.md`  
**Requirement:** R2  
**Issue:** `issue.md` reportedly mentions a semantic retry budget without a concrete bound, while `spec.json` contains prose for “configured maximum of five semantic gate retries.” That creates a cross-file requirement inconsistency: one spec artifact is underspecified while another defines the bound informally.  
**Suggestion:** Make the retry limit explicit in both spec artifacts, ideally with `spec.json` containing a structured value such as `"semantic_gate_retry_limit": 5` and `issue.md` referencing the same named limit.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 35. 4. Avoid two canonical spec sources
**Finding key:** loop-089b4157f88ee49966a3
**Failure mode:** refactor
**File:** specs/346-gate-fail-closed/spec.md
**Requirement:** R3
**Issue:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The summaries indicate `spec.md` duplicates much of `spec.json`, while `issue.md` also carries contract language. With retry bounds and status already differing across files, the spec set has multiple places for authoritative requirement text to drift.  
**Suggestion:** Declare `spec.json` as canonical and generate or summarize `spec.md` from it, or add an explicit synchronization rule so requirements, acceptance criteria, task status, and retry limits stay aligned.
**Suggestion:** **File:** `specs/346-gate-fail-closed/spec.md`  
**Requirement:** R3  
**Issue:** The summaries indicate `spec.md` duplicates much of `spec.json`, while `issue.md` also carries contract language. With retry bounds and status already differing across files, the spec set has multiple places for authoritative requirement text to drift.  
**Suggestion:** Declare `spec.json` as canonical and generate or summarize `spec.md` from it, or add an explicit synchronization rule so requirements, acceptance criteria, task status, and retry limits stay aligned.
**Disposition:** informational
**Rationale:** Loop review proposal.

### 36. 5. Normalize public CLI option parsing and rejection naming
**Finding key:** loop-23383edbe7260c2d4e64
**Failure mode:** refactor
**File:** src/lib/dispatcher.js
**Requirement:** R5
**Issue:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** `dispatcher.js` adds `--option=value` parsing while `run-gate.js` separately rejects public bypass options and tests repeat rejection cases for both split and equals forms. The parsing and rejection responsibilities are spread across files with inconsistent helper naming.  
**Suggestion:** Centralize equals-option parsing in `dispatcher.js`, and rename `parsePublicGateArguments()` in `run-gate.js` to an assertion-style helper such as `assertPublicGateArgumentsAllowed(argv)` so CLI parsing versus command-specific rejection are clearly separated.
**Suggestion:** **File:** `src/lib/dispatcher.js`  
**Requirement:** R5  
**Issue:** `dispatcher.js` adds `--option=value` parsing while `run-gate.js` separately rejects public bypass options and tests repeat rejection cases for both split and equals forms. The parsing and rejection responsibilities are spread across files with inconsistent helper naming.  
**Suggestion:** Centralize equals-option parsing in `dispatcher.js`, and rename `parsePublicGateArguments()` in `run-gate.js` to an assertion-style helper such as `assertPublicGateArgumentsAllowed(argv)` so CLI parsing versus command-specific rejection are clearly separated.
**Disposition:** informational
**Rationale:** Loop review proposal.


## Excluded Findings

- Missing file: 0
- Out of scope: 0
