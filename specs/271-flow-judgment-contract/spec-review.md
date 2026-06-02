# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Override evidence has no capture/persistence path and the no-new-CLI constraint forbids adding one
**Target:** R3, R4, R5 / Constraints (exit-code-contract)
**Issue:** R3/R4 require a structured OverrideCompletionEvidence (userApproval, reason, approvedAt, approvedBy, per-finding disposition, successorOwner, acceptedRisk) and R5 says `flow set step <id> done` may persist done only when the validator returns normal OR override. But the exit-code-contract constraint forbids new user-facing CLI commands and options, the Alternatives section rejects recording override in issue-log free text, and no existing channel carries this structure: set-approval.js writes only spec.user_approval (plan approval, different concern), and set-step.js has no option to receive override evidence. The spec never names where the running flow obtains/persists OverrideCompletionEvidence.
**Required change:** Specify the concrete source the completion validator reads override evidence from in the real flow (e.g., a designated override-evidence artifact file written by the skill/agent, or a flow.json/spec.json field), consistent with the no-new-CLI constraint — or restrict override completion to a validator input not reachable through `flow set step`.
**Why blocking:** Without a named input/persistence path, `flow set step <id> done` on a FAIL artifact can only ever be classified inconsistent, so the override-completion path of R4/R5 (and the acceptance criterion 'FAIL artifact + valid override evidence → validator returns override') is unimplementable for the actual flow and only testable against synthetic fixtures.

### 2. impl-gate is a mandatory contract target but has no persisted verdict artifact and run-gate.js is not a listed converter
**Target:** R2, R6 / Overview > Modules (converter list)
**Issue:** R2 makes impl-gate normal completion require 'pass かつ blockingFindings=0' and R6 requires the impl-gate artifact to expose a contract summary. However, run-gate.js does not persist a standalone impl-gate verdict JSON: the gate verdict (gate.schema.json: verdict pass/fail + nextAction.diagnosis.observations) lives only in the command envelope, gate FAILs append only to issue-log, and impl-gate done is currently validated by assertIntegrationRegressionEvidence (test artifacts), not a gate verdict file. The Overview converter list (test-artifacts.js, run-test-result-review.js, run-final-regression.js, run-review.js) omits run-gate.js, so impl-gate has no named normalization source or artifactPath.
**Required change:** Name the impl-gate contract input source — add run-gate.js to the converter scope and specify the persisted impl-gate verdict artifact (artifactPath) that the validator reads — or remove impl-gate from the FAIL-artifact/contract-normalization targets in R2/R6.
**Why blocking:** The spec's core goal (classify FAIL artifact + done step) cannot be applied to impl-gate without a persisted gate verdict to read at `flow set step impl-gate done` time; with no converter and no artifact source, R2/R6 for impl-gate have no implementation target and 'FAIL artifact + done' for impl-gate is undetectable.


## Non-blocking Improvements

### 1. Task-scope review step id (task-review) not addressed alongside impl-review
**Target:** R2, R5 / Clarifications
**Improvement:** run-review.js resolves the impl review step via activeImplReviewStepId, which returns 'task-review' under a task cursor and 'impl-review' in flow scope. The spec names only 'impl-review' as a target step; it would help to state whether the completion validator and `flow set step` path also cover the task-scope 'task-review' variant.
**Why non-blocking:** The validator can be wired to the same active-review-step resolver, so this is a clarity/coverage note rather than a missing implementation target; flow-scope impl-review remains implementable as written.

### 2. Verdict casing source for the contract is ambiguous between next-action schema and review artifacts
**Target:** R1, R6 / Overview > Data Flow
**Improvement:** next-action/review.schema.json defines verdict as lowercase pass/fail, while run-review.js impl/test review artifacts use uppercase PASS/ADVISORY/FAIL. Stating which value feeds FlowJudgmentContract.verdict (and how ADVISORY maps to permitted normal completion) would prevent normalization ambiguity.
**Why non-blocking:** Both representations exist and the converter can map them deterministically; this is a normalization-detail clarification, not a contradiction that blocks building the converter.
