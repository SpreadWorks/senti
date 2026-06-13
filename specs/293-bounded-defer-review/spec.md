# Feature Specification: 293-bounded-defer-review

**Feature Branch**: `feature/293-bounded-defer-review`
**Created**: 2026-06-13
**Status**: Draft
**Input**: GitHub Issue #383

## Goal
Allow Spec-Driven Development review/gate steps to defer retry-exhausted AI-derived content/alignment findings into acceptance-review without weakening mechanical blockers or final acceptance review.

## Background
The current flow fixes detector-reported issues through review/gate retries, but AI review and guardrail checks are detectors. Treating every detector failure as a stop condition until it passes can create long loops from false positives, existing issues, mid-process evidence gaps, and repeated findings. Issue #383 chooses a bounded retry-then-defer design: content/alignment findings move forward as structured evidence after maxAttempts, while missing artifacts, failed commands, failed tests, tooling failures, and corrupt state remain blocking. Acceptance-review then re-evaluates the carried findings against the completed output and evidence.

## Scope
- Add retry-then-defer behavior for AI-derived content/alignment findings after configured maxAttempts are exhausted in flow-scope review/gate steps.
- Persist deferred findings in a bounded flow findings artifact that references source review/gate artifacts instead of duplicating full finding text.
- Keep schema invalid, missing required artifact, failed command/test evidence, tooling failure, no-progress rerun guard, and flow state corruption as blocking failures.
- Extend acceptance-review to re-evaluate deferred findings, classify final disposition, and route non-pass results to an allowlisted target step.
- Limit automatic acceptance-review repair rounds to 2 and require a user decision after the limit.
- Retain existing review/gate artifacts, retry metrics, issue-log recording, blocker behavior, and acceptance-review verdict/reset behavior.

## Out of Scope
- No npm publish or npm dist-tag operation.
- No new step status values.
- No use of flow-findings.json as the source of truth for acceptance routing or verdict decisions.
- No historical sampling implementation as a required deliverable; historical trends may remain a retro/report observation.

## Constraints
- No external dependencies; use Node.js built-in modules only.
- Do not add backward-compatibility shims for old artifact formats during alpha.
- Represent meaningful structured values with dedicated classes that enforce invariants in constructors.
- flow-findings.json stores reference metadata only; source review/gate artifacts remain the source of detailed finding text.
- Gate defer requires a durable bounded source artifact for every retry-then-defer gate phase, including draft, spec, task-impl, and integration. If a phase currently returns only an envelope, the implementation must persist a bounded gate result artifact before creating flow finding references.
- acceptance-review.json is the source of truth for acceptance verdict, nextAction, targetStep, and final finding disposition. flow-findings.finalDisposition is nullable and non-authoritative; when present, it is a mirror derived from acceptance-review.json.
- bounded-resource-usage: flow-findings.json stores at most 200 entries, each source reference string is at most 300 characters, each summary/mirror disposition field is at most 1000 characters, each source artifact read is capped at 1 MiB, and any acceptance-review prompt section built from flow findings is capped at 40000 characters.
- migration-parity mapping: review artifacts stay owned by run-review and are retained; gate artifacts stay owned by run-gate, with missing durable gate source artifacts added under run-gate; retry metrics stay owned by flow metrics; issue-log entries stay owned by issue-log post hooks; mechanical blocker stops stay owned by run-gate/test artifact validation; no-progress guard stays owned by run-gate; tooling failure handling stays owned by review/gate command failure handling; acceptance-review verdict/reset behavior stays owned by acceptance-review-artifacts.
- spec-test-coverage: new behavior coverage must be written under specs/293-bounded-defer-review/tests/ with // spec: R<N> headers. Shared tests under tests/unit/ may supplement but do not replace spec-local coverage.

## Design Principles
- Separate detector output from flow progression: AI-derived content/alignment findings are carried forward only after bounded retry, while missing evidence and broken state still stop.
- Keep deferred findings auditable by referencing the source artifact and source finding id.
- Make acceptance-review the final evaluator of deferred content/alignment findings, not a blind consumer of intermediate detector output.
- Preserve existing CLI and artifact surfaces unless the requirement explicitly changes retry exhaustion behavior.

## Overview
### Modules
- Review retry handling currently lives in src/flow/lib/run-review.js and returns REVIEW_MAX_ATTEMPTS_EXCEEDED when flow-scope review attempts reach maxAttempts.
- Gate retry handling currently lives in src/flow/lib/run-gate.js and returns ESCALATE_RETRY_EXHAUSTED for tracked gate phases after maxAttempts are exhausted.
- Flow step policy and lifecycle routing are centralized in src/flow/definition.js through FlowNode maxAttempts, failurePolicy, and post-hook lifecycle actions.
- Acceptance review artifact validation and flow-state mutation live in src/flow/lib/acceptance-review-artifacts.js.

### Data Flow
- A review/gate run writes a durable source artifact and retry metric. If the failure is an AI-derived content/alignment finding and maxAttempts is exhausted, the flow findings artifact records sourceStep, sourceArtifact, sourceFindingId, attempts, and round.
- Mechanical blockers bypass defer and continue to return blocking envelopes. This includes missing artifacts, invalid schemas, command/test failures, tooling failures, no-progress guard failures, and corrupted flow state.
- Acceptance-review reads completed spec, implementation evidence, tests, retro, issue-log, and flow findings. It writes final dispositions and, on non-pass, a validated nextAction and targetStep.
- Deferred completion keeps detector artifacts truthful: FAIL/fail artifacts remain FAIL/fail, and a separate completionKind=deferred flow finding plus completion-contract evidence permits traversal to mark the step done.

### Decisions
- [VERIFY] FlowNode already exposes maxAttempts and failurePolicy; the spec extends policy behavior rather than adding step statuses.
- [VERIFY] Review retry exhaustion currently hard-stops with REVIEW_MAX_ATTEMPTS_EXCEEDED.
- [VERIFY] Gate retry exhaustion currently hard-stops with ESCALATE_RETRY_EXHAUSTED.
- [VERIFY] acceptance-review already persists verdict state and resets downstream steps based on artifact verdict.
- Deferred finding routing uses acceptance-review.json as the source of truth; flow-findings.json is only input history.
- Migration parity retains review/gate artifacts, retry metrics, issue-log recording, mechanical blocker stops, no-progress/tooling blocker behavior, and acceptance-review pass/mechanical reset behavior.
- Migration parity owner mapping is explicit: run-review keeps review artifacts; run-gate keeps/adds gate source artifacts; flow metrics keep retry counters; issue-log hooks keep issue logs; acceptance-review-artifacts keeps verdict/reset behavior.
- All retry-then-defer gate phases need durable finding sources; draft/spec gate envelopes do not provide sourceArtifact/sourceFindingId references.
- Deferred step completion must be accepted by the completion contract without rewriting detector artifacts as pass.
- finalDisposition authority belongs to acceptance-review.json; flow-findings may mirror it only as derived, non-authoritative state.

## Clarifications (Q&A)
- Q: Should AI-derived content/alignment findings be treated differently from mechanical blockers?
  - A: Yes. AI-derived content/alignment findings are deferred only after bounded retry, but mechanical blockers remain blocking.
- Q: Should flow-findings.json decide routing after acceptance-review?
  - A: No. flow-findings.json is input history only; acceptance-review.json decides verdict and routing.
- Q: What durable source should draft/spec gate deferred findings reference when those phases currently return envelopes?
  - A: They must persist a bounded gate source artifact before flow-findings.json references sourceArtifact/sourceFindingId.
- Q: Can deferred completion rewrite FAIL/fail detector artifacts as pass?
  - A: No. Detector artifacts remain truthful; completionKind=deferred plus flow finding evidence satisfies the completion contract.
- Q: Should new step statuses be added for deferred completion?
  - A: No. Deferred completion still uses the existing done traversal state.

## Alternatives Considered
- Keep current-equivalent retry/stop behavior — Rejected because Issue #383 targets reducing long AI-controlled retry loops while preserving evidence and final review.
- Make review/gate strictly one-time only — Rejected because Issue #383 keeps bounded retry as a quality allowance before deferring.
- Ask the user before exceeding retry limits — Rejected because Issue #383 states this breaks continuous Spec-Driven Development execution.
- Defer all failures including mechanical blockers — Rejected because missing evidence, failed commands, invalid schemas, tooling failure, and corrupted flow state cannot be re-evaluated reliably later.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-13T15:30:58.782Z
- Notes: User approved the gate-passed spec and asked to proceed.

## Requirements
- R1 [must]: Introduce a retry-then-defer policy path for AI-derived content/alignment findings after the configured maxAttempts is exhausted without adding any new step status values; deferred completion is represented by artifact evidence and existing done traversal.
- R2 [must]: When flow-scope review retry exhaustion contains only AI-derived content/alignment findings, persist a flow findings entry that references the source review artifact and mark the review step complete according to the existing traversal model.
- R3 [must]: When gate retry exhaustion contains only AI-derived content/alignment findings, persist or reuse a bounded durable gate source artifact for the phase, persist flow finding references, and allow traversal to continue, while schema invalid, missing artifact, failed command/test evidence, tooling failure, no-progress guard, and flow corruption remain blocking.
- R4 [must]: Add a bounded flow-findings artifact model that records findingId, sourceStep, sourceArtifact, sourceFindingId, retryExhausted, attempts, round, completionKind, and nullable non-authoritative finalDisposition without copying full finding detail.
- R5 [must]: Extend acceptance-review so it reads flow findings as input history and writes final classifications fixed, not_needed, false_positive, pre_existing, still_open, or blocking for each carried finding.
- R6 [must]: For non-pass acceptance-review results, validate and persist nextAction and targetStep, where targetStep is limited to spec, test, implement, test-execute, impl-review, or impl-gate.
- R7 [must]: Limit automatic acceptance-review repair rounds to 2; after the second non-pass verdict, stop automatic routing and require a user choice, with risk acceptance disallowed when any mechanical blocker exists.
- R8 [must]: Preserve existing review/gate artifacts, add missing durable gate source artifacts where needed, preserve retry metrics, issue-log recording, no-progress rerun guard behavior, tooling failure behavior, and acceptance-review pass/mechanical reset behavior through the new path.
- R9 [should]: Expose deferred flow findings in flow state or status/report summaries with count, sourceStep list, and artifact path without making those summaries the routing source of truth.

## Acceptance Criteria
- R1/R2: A review retry-exhaustion scenario with only AI-derived content/alignment findings writes flow-findings.json, leaves existing review artifact evidence intact, updates retry metrics, and advances traversal without a user reset prompt.
- R3: A gate retry-exhaustion scenario with only AI-derived content/alignment findings writes or reuses a bounded durable gate source artifact, writes flow-findings.json, and advances, while separate tests prove missing artifacts, invalid schemas, failed test evidence, tooling failure, and no-progress guard still block.
- R4: flow-findings.json validates against the new artifact contract, stores sourceArtifact/sourceFindingId references instead of duplicated detailed finding bodies, and treats finalDisposition as nullable non-authoritative mirror state.
- R1/R8: Completion-contract tests prove retained FAIL/fail detector artifacts plus completionKind=deferred flow finding evidence can mark the step done without rewriting detector artifacts as pass.
- R5/R6: acceptance-review consumes flow findings, writes finalDisposition for each finding, and validates nextAction plus an allowlisted targetStep when verdict is not pass.
- R7: round 1 non-pass acceptance-review automatically resets to the target step, while round 2 non-pass produces user choices; risk acceptance is unavailable when mechanicalBlockers is non-empty.
- R8: Existing review/gate artifacts, retry metrics, issue-log entries, blocker envelopes, and acceptance-review pass/mechanical reset behavior remain covered by behavior-level tests.
- All new behavior tests live under specs/293-bounded-defer-review/tests/ and each test file contains a // spec: R<N> header for the requirement it covers.
- R9: Status or report output includes a bounded summary of deferred flow findings without changing acceptance-review.json as the routing/verdict source.

## Implementation Targets
- src/flow/definition.js
- src/flow/lib/run-review.js
- src/flow/lib/run-gate.js
- src/flow/lib/acceptance-review-artifacts.js
- src/flow/schemas/acceptance-review.schema.json
- src/flow/lib/get-status.js
- src/flow/lib/run-report.js
- specs/293-bounded-defer-review/tests/
- tests/unit/

## Open Questions
- [ ] Historical sampling metrics are optional retro/report observations and are not required for implementation completion.
- [ ] Status/report visibility for flow findings is limited to a bounded summary when full detail is available through source artifacts.

## Tasks
### Round 0
- **T-1** [pending]: Model flow findings
  - Define the flow findings artifact model, validation, and persistence contract for deferred AI-derived content/alignment findings.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Defer review exhaustion
  - Route flow-scope review retry exhaustion with only AI-derived content/alignment findings into flow findings while retaining review artifacts, retry metrics, and issue-log behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Defer gate exhaustion
  - Route gate retry exhaustion with only AI-derived content/alignment findings into flow findings while preserving mechanical blocker failures.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Reevaluate acceptance findings
  - Extend acceptance-review to read flow findings, classify final disposition, and route non-pass results through validated nextAction and targetStep.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Enforce round choices
  - Limit automatic acceptance-review repair rounds and present user-decision behavior at the round limit.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Expose audit summary
  - Expose a bounded summary of deferred flow findings through status or report surfaces without changing routing rules.
  - see `tasks/T-6.md` for full spec
