# Feature Specification: 310-defer-test-review-exhaustion

**Feature Branch**: `feature/310-defer-test-review-exhaustion`
**Created**: 2026-06-19
**Status**: Draft
**Input**: GitHub Issue #405

## Goal
When test-review reaches semantic retry exhaustion, carry unresolved findings into flow-findings.json during the same review command lifecycle, complete test-review as deferred, and let downstream acceptance-review own final disposition.

## Background
Issue #405 identifies a timing gap in the test-review retry exhaustion lifecycle. Existing code can defer semantic findings if another review command reaches the pre-check with retry count already at maxAttempts, but the final semantic FAIL post-hook only increments reviewRetry and records recovery state. That leaves flow-findings.json absent, test-review in_progress, and acceptance-review without deferred findings unless an additional run or manual intervention occurs.

## Scope
- Post-hook/state-transition handling for senti flow run review --phase test after semantic FAIL reaches maxAttempts.
- flow-findings.json entries for unresolved blocking findings from the latest test-review.json.
- Deferred completion of test-review using the existing done traversal model.
- Acceptance-review recognition of deferred findings produced by test-review.
- Regression coverage for semantic exhaustion, duplicate prevention, TOOLING_FAILURE exclusion, structured coverage exclusion, unchanged-evidence carryover, status progression, next-action progression, and acceptance-review deferred input.

## Out of Scope
- No redesign of all review/gate retry exhaustion behavior beyond the test-review post-hook guarantee.
- No new step status values.
- No new external dependencies.
- No npm release, publish, or dist-tag operation.
- No unrelated changes to flow phases except where needed to verify status, next-action, or acceptance-review recognition for this bugfix.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- Keep src/ generic; do not embed project-specific paths, repository names, or issue-only environment details.
- Preserve existing manual review retry reset behavior for non-deferred or explicitly reset cases.
- TOOLING_FAILURE and structured test-review coverage/header failures remain non-semantic recovery paths and must not be carried over as semantic deferred findings.
- Semantic retry exhaustion carryover must not be blocked by retryRecovery.recoveryPossible=false or unchanged-evidence state after the final semantic FAIL has reached maxAttempts.
- flow-findings.json remains a bounded reference artifact; source test-review.json remains the owner of detailed finding text.
- spec-test-coverage: new behavior coverage must be written under specs/310-defer-test-review-exhaustion/tests/ with // spec: R<N> headers. Shared tests under tests/ may supplement but do not replace spec-local coverage.

## Design Principles
- Guarantee state at the producer lifecycle boundary: the final semantic FAIL post-hook must perform the carryover instead of relying on a later review pre-check.
- Keep detector artifacts truthful: test-review.json can remain FAIL while deferred completion is represented by flow-findings.json and normal step traversal.
- Separate semantic review failures from tooling and structured coverage failures before deferral.
- Make acceptance-review the final owner of deferred finding disposition.

## Overview
### Modules
- src/flow/lib/run-review.js owns review retry accounting, pre-check exhaustion handling, and the post-hook updateReviewRetryCounter lifecycle helper.
- src/flow/lib/flow-findings.js owns flow-findings.json entries and deferExhaustedSemanticFindings.
- src/flow/lib/acceptance-review-artifacts.js reads flow-findings.json into deferredFindings and derives acceptance verdicts from finalDisposition values.
- src/flow/lib/get-status.js and src/flow/lib/get-next-action.js are verification surfaces for progression after deferred completion.

### Data Flow
- senti flow run review --phase test writes the latest test-review.json and returns a FAIL, ADVISORY, PASS, or TOOLING_FAILURE artifact.
- The review post-hook increments reviewRetry for semantic FAIL. When attemptsBefore + 1 reaches maxAttempts, the same lifecycle creates or updates flow-findings.json from the latest test-review.json and marks test-review done.
- The deferred entries reference test-review as sourceStep, test-review.json as sourceArtifact, and stable sourceFindingId values from the source artifact.
- After deferred completion, get status no longer leaves test-review in_progress and get next-action can move to implement or later steps.
- Acceptance-review builds deferredFindings from flow-findings.json and existing disposition evidence, then derives pass, amend_required, blocked, or user_decision_required according to existing acceptance policy.

### Decisions
- [VERIFY] Pre-check deferral already exists, but it only runs before a later review command starts.
- [VERIFY] The final FAIL post-hook currently increments retry metrics and mutates retry recovery state, but does not call the deferral helper.
- [VERIFY] Existing deferral helper excludes TOOLING_FAILURE and structured test-review coverage failures.
- [VERIFY] flow-findings already writes retry-exhaustion reference entries for source findings.
- [CORRECTION] still_open deferred findings currently map to amend_required, not automatic user_decision_required.
- [VERIFY] acceptance-review already builds deferredFindings from flow-findings.json and defaults missing disposition evidence to still_open.
- Duplicate handling must be stable because the same source finding may be observed by both pre-check and post-hook paths.

## Clarifications (Q&A)
- Q: Does this add a new step status for deferred completion?
  - A: No. Deferred completion uses the existing done traversal model and records completionKind=deferred in flow-findings.json.
- Q: Does still_open mean user_decision_required immediately?
  - A: No. Source verification shows the current acceptance-review policy maps still_open deferred findings to amend_required. user_decision_required is reserved for explicit user-decision state.
- Q: Should TOOLING_FAILURE be deferred if retry count reaches maxAttempts?
  - A: No. TOOLING_FAILURE is not a semantic test-review failure and remains a tooling recovery path.
- Q: Should unchanged-evidence block carryover?
  - A: No. unchanged-evidence can block retry reset, but semantic exhaustion carryover is the terminal retry state transition and must still run.

## Alternatives Considered
- Rely only on checkReviewRetryBelowMax pre-check deferral — Rejected because Issue #405 requires flow-findings.json to be generated when the final semantic FAIL reaches maxAttempts, without a later review invocation.
- Implement carryover in get-status or get-next-action — Rejected because those commands are display/guidance surfaces. The state guarantee belongs to the run review post-hook lifecycle.
- Treat still_open as immediate user_decision_required — Rejected as a source-verifiable correction: current acceptance-review derives amend_required for still_open and user_decision_required only for explicit user-decision state.
- Append a new deferred entry on every carryover attempt — Rejected because duplicate entries would duplicate acceptance-review deferredFindings and make downstream disposition unstable.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-19T05:00:29.979Z
- Notes: autoApprove accepted gate-passed spec for Issue #405

## Requirements
- R1 [must]: When flow-scope test-review returns a semantic FAIL and attemptsBefore + 1 is greater than or equal to maxAttempts, the review post-hook must create or update flow-findings.json during that same command lifecycle.
- R2 [must]: The post-hook deferred entries must be created from unresolved blocking findings in the latest test-review.json and include findingId, sourceStep=test-review, sourceArtifact=test-review.json, sourceFindingId, retryExhausted=true, attempts, round, completionKind=deferred, and finalDisposition=still_open.
- R3 [must]: After semantic deferral in the final FAIL post-hook, test-review must be marked complete through the existing done traversal model so get status does not leave test-review in_progress and get next-action can return implement or a later step.
- R4 [must]: The final FAIL post-hook semantic deferral must reuse the existing semantic deferral helpers or an equivalent shared helper so pre-check and post-hook carryover use the same source artifact, finding id, exclusion, and step-completion behavior.
- R5 [must]: TOOLING_FAILURE and structured test-review coverage/header failures must remain excluded from semantic deferred carryover and continue to require tooling recovery, structured coverage recovery, or existing override behavior.
- R6 [must]: Semantic exhaustion carryover must run even when retryRecovery.recoveryPossible=false or unchanged-evidence would prevent a retry reset, because the carryover is the final retry-exhaustion state transition rather than another retry attempt.
- R7 [must]: The carryover path must not create duplicate deferred entries for the same sourceStep, sourceArtifact, and sourceFindingId when pre-check or repeated invocations encounter an already-carried finding.
- R8 [must]: Acceptance-review must recognize test-review deferred findings from flow-findings.json in deferredFindings; still_open findings may produce amend_required under current policy, blocking findings produce blocked, and explicit user-decision state must produce user_decision_required with nextAction=user_decision and targetStep=implement.
- R9 [should]: Existing manual review retry reset behavior must remain available for review phases and must not be removed or weakened by the post-hook carryover implementation.

## Acceptance Criteria
- R1/R2: A spec-local test simulates a semantic test-review FAIL where attemptsBefore + 1 reaches maxAttempts and proves flow-findings.json is generated in the same run without an additional review invocation.
- R2: The generated flow-findings.json entry for test-review includes sourceStep=test-review, sourceArtifact=test-review.json, sourceFindingId, retryExhausted=true, attempts, round, completionKind=deferred, and finalDisposition=still_open.
- R3: After final-FAIL deferral, test-review is not in_progress in flow state and get next-action can advance to implement or a later step.
- R4/R7: Pre-check deferral and post-hook deferral share the same carryover behavior and do not create duplicate entries for an already-carried source finding.
- R5: TOOLING_FAILURE test-review artifacts do not create semantic deferred findings and keep the existing tooling recovery path.
- R5: Structured test-review coverage/header failure artifacts do not create semantic deferred findings.
- R6: A semantic FAIL in an unchanged-evidence or retryRecovery.recoveryPossible=false state still carries findings to flow-findings.json when maxAttempts is reached.
- R8: acceptance-review artifact generation includes the carried test-review deferred findings in deferredFindings, derives still_open as amend_required under current policy, derives blocking as blocked, and derives explicit user-decision state as user_decision_required with nextAction=user_decision and targetStep=implement.
- R9: Existing retry reset tests or coverage still prove manual review retry reset can clear review retry state when used for supported recovery.

## Implementation Targets
- src/flow/lib/run-review.js
- src/flow/lib/flow-findings.js
- src/flow/lib/acceptance-review-artifacts.js
- src/flow/lib/get-next-action.js
- src/flow/lib/get-status.js
- tests/unit/flow/retry-exhaustion-defer.test.js
- tests/unit/flow/run-review-advisory.test.js
- specs/310-defer-test-review-exhaustion/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Guarantee post-hook deferral
  - Add the missing final-FAIL lifecycle transition so semantic test-review retry exhaustion carries findings to flow-findings.json during updateReviewRetryCounter or an equivalent review post-hook path.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Stabilize finding carryover
  - Ensure deferred test-review entries have the required metadata, finalDisposition=still_open, and stable duplicate behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Preserve exclusions
  - Preserve non-semantic recovery boundaries while allowing semantic exhaustion carryover through unchanged-evidence states.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Verify downstream progression
  - Prove that deferred test-review findings are visible to acceptance-review and that flow progression surfaces move past test-review.
  - see `tasks/T-4.md` for full spec
