# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Report context is required before it exists in the normal flow
**Target:** Data Flow / R5 / acceptance-review inputs
**Issue:** The spec says acceptance-review reads report context after retro and before final-regression, but the current normal flow generates report.json from finalize-commit post-hook, after final-regression and after the new acceptance-review position. The separate `senti flow run report` command exists, but it is not a flow leaf and is not run before final-regression by existing behavior.
**Required change:** Specify whether report context is optional when no report.json exists, or add an explicit pre-acceptance report generation/integration step while preserving the existing finalize report behavior.
**Why blocking:** An implementation that follows the current flow cannot reliably provide report context to acceptance-review at that point, so tests cannot assert the required input set without either fabricating an artifact or changing finalize/report timing outside the stated behavior.

### 2. Amendment and decision routes have no concrete flow integration target
**Target:** R10-R12 / T-4 verdict routing
**Issue:** The spec requires amend_required, user_decision_required, and blocked to route through amendment, retry, abort, repair, and risk-acceptance choices, but it does not name the command, step, state field, or reset range that captures those choices and advances or rewinds the existing flow. Existing code has plan-phase spec-triage/spec-repair and `run-reopen-draft`, but no acceptance-review amendment or decision command/path.
**Required change:** Define the exact spec-level routing target for each non-pass verdict, including the command or step that records the selected choice and the flow step/artifact reset semantics needed before reimplementation or continuation.
**Why blocking:** Without a concrete integration point, implementers can choose incompatible state transitions, and tests cannot determine whether amend_and_retry, repair_and_reevaluate, abort, or accept_risk_and_continue were routed correctly.

### 3. Next-action envelope field names conflict with the existing public contract
**Target:** R4 / AC5 / R14
**Issue:** R4 and AC5 describe `senti flow get next-action` as returning `requiresApproval`, while the existing public envelope and tests use `requires_approval` and `output_schema`; the SDD skill also consumes `requires_approval`. R14 simultaneously says the existing next-action envelope shape must be preserved.
**Required change:** State that acceptance-review next-action must preserve the existing snake_case envelope fields, especially `requires_approval` and `output_schema`, and define failurePolicy exposure as an additive field only.
**Why blocking:** Leaving this conflict unresolved can cause an implementation to change the public envelope shape and break the skill's approval boundary, while still appearing to satisfy the acceptance-review-specific wording.

### 4. Acceptance-review completion is not tied to the existing step completion guard
**Target:** R5 / R8-R12 / R14 flow state promotion
**Issue:** Existing `flow set step ... done` validates completion artifacts for review/gate/test-result/final-regression through `src/flow/lib/flow-judgment-contract.js`. The spec defines acceptance-review verdicts and artifacts, but does not require adding acceptance-review to that completion policy or otherwise forbidding manual completion when the artifact is missing, blocked, amend_required, or waiting for a user decision.
**Required change:** Add a requirement that acceptance-review step completion is validated against its artifact and verdict/decision state before it can be marked done or promote final-regression.
**Why blocking:** Without this compatibility path, a user or hook can mark acceptance-review done and advance to final-regression despite blocked mechanical evidence or unresolved amendment/user-decision requirements, bypassing the safety behavior the spec is adding.


## Non-blocking Improvements

### 1. Mention the completion contract module
**Target:** Codebase Context
**Improvement:** Add `src/flow/lib/flow-judgment-contract.js` as a related file because it owns the current artifact-backed step completion validation that acceptance-review will likely need to extend.
**Why non-blocking:** The requirements can still be implemented by discovering the module during implementation, but naming it would reduce integration risk.
