# Feature Specification: 296-review-gate-defer

**Feature Branch**: `feature/296-review-gate-defer`
**Created**: 2026-06-14
**Status**: Draft
**Input**: GitHub Issue #386

## Goal
Review, gate, and test-review retry exhaustion must defer unresolved AI semantic findings to acceptance-review instead of stopping the flow for manual retry reset.

## Background
Issue #386 identifies a bug in the current Spec-Driven Development flow: review, gate, and test-review can still stop at retry exhaustion even when the remaining findings are AI semantic findings that should be decided later by acceptance-review. Existing code already has flow-findings.json and acceptance-review infrastructure, but review/gate deferral can be blocked by regex classification over AI finding prose, and prompt instructions still tell the agent to STOP at retry-limit errors. The fix is to make semantic retry exhaustion a normal deferred-completion path while keeping structured mechanical/tooling failures outside the semantic retry budget.

## Scope
- Review retry exhaustion for draft, spec, test, and impl review phases.
- Gate retry exhaustion for draft, spec, task-impl, and integration phases.
- Test-review retry/fix/defer behavior at semantic retry limit.
- flow-findings.json recording and acceptance-review consumption of deferred findings.
- Structured non-semantic prechecks for tooling, schema, command, coverage/header, test evidence, no-progress, and flow-state failures.
- Prompt and regression test updates for retry-limit delegation behavior.

## Out of Scope
- No unrelated flow lifecycle redesign.
- No project-specific logic or paths from the external reference repository.
- No npm release, publish, or dist-tag work.
- No weakening of test-execute, test-result-review, impl-review, impl-gate, acceptance-review, final-regression, or finalize requirements.

## Constraints
- Use only Node.js built-in modules and existing project helpers; add no external dependencies.
- Keep src/ generic; do not embed project-specific paths, repository names, or issue-only environment details.
- Represent meaningful new failure/defer structures with classes or existing domain objects rather than ad hoc type-tag objects.
- Semantic retry exhaustion remains bounded by existing maxAttempts; no unbounded repair/review loop may be introduced.
- Non-semantic tooling/schema/command/test-evidence failures must remain blocking or require existing structured override evidence; they must not be silently deferred.
- If src/flow prompts, src/skills, or preset/template sources change, run senti upgrade according to project rules.

## Design Principles
- Classify failures from structured prechecks and artifact fields before invoking or accounting AI semantic retry budget.
- Treat AI semantic findings as deferable regardless of prose words such as test, missing, invalid, schema, or command.
- Keep flow-findings.json as a bounded reference index; full finding detail stays in the source review/gate artifact.
- Make acceptance-review the final owner of deferred finding disposition before final-regression.
- Preserve existing recovery/override behavior for tooling and mechanical failures while replacing semantic retry-limit stop output.

## Overview
### Modules
- src/flow/lib/run-review.js: enforces review maxAttempts, parses review command output, updates reviewRetry, and already contains a semantic deferral helper path.
- src/flow/lib/run-gate.js: enforces gate retry limits, persists gate source artifacts, and currently classifies retry exhaustion sources.
- src/flow/lib/flow-findings.js: owns flow-findings.json entries, bounded source artifact reads, deferred finding ids, and final disposition mirroring.
- src/flow/lib/flow-judgment-contract.js: validates completion contracts for test-review, impl-review, impl-gate, acceptance-review, and final-regression.
- src/flow/commands/review.js and src/flow/prompts/plan/test-review.md: currently define test-review as one-shot static review and prompt-level STOP recovery.
- src/flow/definition.js and src/flow/registry.js: define review maxAttempts and post-hook transitions that determine repeated test-review invocation behavior.
- src/flow/prompts/impl/acceptance-review.md and acceptance-review artifacts: own final pass/amend/blocked/user-decision routing before final-regression.

### Data Flow
- Before semantic AI retry accounting, each review/gate/test-review path runs deterministic prechecks and preserves structured non-semantic failure data.
- For test-review coverage/header failures, test-coverage.json validation.ok=false and validation.messages are the structured non-semantic signal; generated header blocking findings remain tied to that artifact.
- When semantic retry count reaches maxAttempts and unresolved AI findings remain, the source artifact receives stable finding ids.
- The exhausted source step appends flow-findings.json entries with sourceStep, sourceArtifact, sourceFindingId, retryExhausted=true, attempts, round, completionKind=deferred, and finalDisposition=null.
- The source review/gate/test-review step is marked done after semantic deferral; subsequent flow steps continue without REVIEW_MAX_ATTEMPTS_EXCEEDED or ESCALATE_RETRY_EXHAUSTED user stop.
- Acceptance-review reads flow-findings.json plus source artifacts and normal implementation/test evidence, then records pass, amend_required, blocked, or user_decision_required.
- Test-review repairs are flow-level repairs between separate senti flow run review --phase test invocations; each FAIL invocation consumes reviewRetry and the command does not run an internal auto-fix loop.
- After acceptance-review decides deferred findings, flow-findings.json mirrors finalDisposition before final-regression can proceed.

### Decisions
- [VERIFY] run-review already has a semantic deferral path but blocks it with prose-based classification.
- [VERIFY] run-gate already has a semantic deferral path but can reject AI findings as mechanical_or_mixed_findings.
- [VERIFY] flow-findings.json stores bounded references instead of copied finding details.
- [VERIFY] test-review prompt currently contradicts the target behavior.
- [VERIFY] test-review coverage/header validation has a structured artifact separate from AI findings.
- [VERIFY] acceptance-review is already the final decision point before final-regression.
- Migration parity maps retained behavior by owner: source steps keep bounded retry, flow-findings stores references, acceptance-review owns final disposition, and prechecks own mechanical failures.

## Clarifications (Q&A)
- Q: Do plan-phase deferred semantic findings also go to acceptance-review?
  - A: Yes. Issue #386 defines review/gate retry exhaustion generally. Plan-phase and implementation-phase source steps both write deferred references and continue; acceptance-review owns final disposition before final-regression.
- Q: Can a finding be rejected as mechanical because its prose mentions test, missing, invalid, schema, or command?
  - A: No. Mechanical classification comes from deterministic prechecks or structured artifact fields. Prose words in AI findings are not a mechanical classifier.
- Q: Are tooling/schema/command failures weakened by semantic deferral?
  - A: No. Structured non-semantic failures remain blocking or require existing explicit override evidence and do not consume semantic retry budget.
- Q: Who owns test-review fixes between FAIL attempts?
  - A: The flow/skill repair step owns test changes between separate senti flow run review --phase test invocations. The review command remains a reviewer and does not run an internal auto-fix loop; each semantic FAIL invocation consumes reviewRetry.
- Q: What structured data identifies test-review coverage/header failures?
  - A: test-coverage.json validation.ok=false and validation.messages are the structured signal. If generated header findings are used directly, they need an equivalent structured origin or failureKind so they are not classified from prose.
- Q: What is the migration parity expectation?
  - A: Bounded retry attempts remain; semantic retry-limit stop output is replaced by deferred finding handoff; non-semantic recovery remains blocking/override based; each changed public surface receives behavior-level tests.

## Alternatives Considered
- Keep retry-limit stop and require manual retry reset — Rejected because Issue #386 defines this as the bug. Semantic findings after retry exhaustion must be decided by acceptance-review instead of stopping review/gate/test-review.
- Use regex over AI finding prose to decide mechanical versus semantic findings — Rejected because the referenced failure shows semantic test-review findings can contain words such as test or missing. Structured fields and prechecks provide the reliable boundary.
- Copy full finding details into flow-findings.json — Rejected because flow-findings.js already enforces bounded reference entries and rejects copied detail fields. Source artifacts remain the owner of full finding detail.
- Automatically accept deferred findings as risk — Rejected because acceptance-review must decide pass, amend_required, blocked, or user_decision_required from deferred findings and normal evidence.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-14T14:57:55.853Z
- Notes: autoApprove accepted gate-passed spec for Issue #386

## Requirements
- R1 [must]: Review retry exhaustion for draft, spec, test, and impl review phases records unresolved AI semantic findings in flow-findings.json, marks the source review step done, and returns a successful deferred result instead of REVIEW_MAX_ATTEMPTS_EXCEEDED.
- R2 [must]: Gate retry exhaustion for draft, spec, task-impl, and integration phases records unresolved AI semantic findings in flow-findings.json, marks the source gate step done, and returns a successful deferred result instead of ESCALATE_RETRY_EXHAUSTED.
- R3 [must]: AI finding prose does not determine mechanical status. Words such as test, missing, invalid, schema, command, or tooling in title/body/reason/guardrail text cannot by themselves reject semantic deferral.
- R4 [must]: Structured non-semantic failures are classified before semantic retry accounting and are not deferred as semantic findings. This includes toolingFailure, command non-zero exit, invalid source schema, failed test evidence, no-progress guard, flow-state corruption, malformed artifact failures, and test-review coverage/header failures identified by test-coverage.json validation.ok=false or equivalent structured origin/failureKind fields on generated header findings.
- R5 [must]: Test-review supports bounded flow-level repair between separate senti flow run review --phase test invocations. Each semantic FAIL invocation consumes the existing reviewRetry budget; at retry exhaustion unresolved AI semantic findings delegate to acceptance-review, while TOOLING_FAILURE remains a separate non-semantic failure path.
- R6 [must]: flow-findings.json stores bounded deferred-finding references with findingId, sourceStep, sourceArtifact, sourceFindingId, retryExhausted=true, attempts, round, completionKind=deferred, and finalDisposition=null until acceptance-review mirrors a final disposition.
- R7 [must]: Acceptance-review reads deferred findings from flow-findings.json and source artifacts, includes them in pass/amend_required/blocked/user_decision_required decisions, and mirrors finalDisposition back into flow-findings.json before final-regression proceeds.
- R8 [must]: Prompt instructions for plan/impl review, gate, and test-review describe semantic retry exhaustion delegation to acceptance-review and no longer instruct STOP for deferrable semantic retry-limit cases.
- R9 [must]: Behavior-level regression coverage proves migrated retry-limit parity for review, gate, test-review, acceptance-review deferred input, and structured non-semantic precheck blocking.

## Acceptance Criteria
- R1: With reviewRetry at max and a source review artifact containing AI semantic findings, flow run review returns ok:true result=deferred, writes flow-findings.json, and does not return REVIEW_MAX_ATTEMPTS_EXCEEDED.
- R2: With gateRetry at max and a source gate artifact containing AI semantic findings, flow run gate returns ok:true result=deferred, writes flow-findings.json, and does not return ESCALATE_RETRY_EXHAUSTED.
- R3: A semantic AI finding whose text contains words such as test, missing, invalid, schema, or command is still deferred when no structured mechanical failure field is present.
- R4: Artifacts with toolingFailure, command exitCode != 0, invalid schema status, failed test evidence, no-progress guard, flow-state corruption, or test-coverage.json validation.ok=false remain blocking and do not append semantic deferred findings.
- R5: Test-review FAIL is repaired outside the review command and re-reviewed through separate senti flow run review --phase test invocations; each FAIL consumes reviewRetry, and at the semantic limit it writes deferred findings and completes while TOOLING_FAILURE remains blocked or requires structured override evidence.
- R6: flow-findings.json contains only bounded references and no copied summary/reason/details/body/message text from source findings.
- R7: Acceptance-review evidence includes deferred findings, can route to amend_required/blocked/user_decision_required when findings require it, and updates finalDisposition for accepted findings.
- R8: Prompt text no longer contains instructions to STOP on REVIEW_MAX_ATTEMPTS_EXCEEDED or gate retry limit when the case is semantic and deferrable.
- R9: Spec-local tests under specs/296-review-gate-defer/tests/ cover review deferral, gate deferral, test-review deferral, and mechanical precheck blocking; shared unit/e2e tests are updated where production contracts change.

## Implementation Targets
- src/flow/lib/run-review.js
- src/flow/lib/run-gate.js
- src/flow/lib/flow-findings.js
- src/flow/lib/flow-judgment-contract.js
- src/flow/commands/review.js
- src/flow/prompts/plan/test-review.md
- src/flow/prompts/plan/spec-review.md
- src/flow/prompts/plan/spec-gate.md
- src/flow/prompts/plan/draft-gate.md
- src/flow/prompts/impl/impl-review.md
- src/flow/prompts/impl/impl-gate.md
- src/flow/prompts/impl/acceptance-review.md
- src/flow/definition.js
- src/flow/registry.js
- tests/unit/flow
- tests/e2e/flow
- specs/296-review-gate-defer/tests

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Classify retry exhaustion
  - Introduce or refine a structured classification boundary that separates AI semantic retry exhaustion from non-semantic tooling, schema, command, test evidence, no-progress, and flow-state failures.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Defer review exhaustion
  - Make review retry exhaustion complete through flow-findings.json for semantic findings in draft, spec, test, and impl review phases.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Defer gate exhaustion
  - Make gate retry exhaustion complete through flow-findings.json for semantic findings in draft, spec, task-impl, and integration phases.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update test-review lifecycle
  - Move test-review from one-shot STOP behavior to bounded fix/re-review and semantic deferral at retry exhaustion.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Route acceptance findings
  - Ensure acceptance-review consumes deferred findings, decides their final disposition, and mirrors finalDisposition before final-regression.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Refresh prompts
  - Update prompt instructions so agents delegate semantic retry exhaustion to acceptance-review instead of stopping in review, gate, and test-review prompts.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Add regression coverage
  - Add spec-local and shared regression tests proving review, gate, test-review, acceptance-review, and mechanical precheck retry behavior.
  - see `tasks/T-7.md` for full spec
