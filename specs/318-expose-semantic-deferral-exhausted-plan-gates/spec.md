# Feature Specification: 318-expose-semantic-deferral-exhausted-plan-gates

**Feature Branch**: `feature/318-expose-semantic-deferral-exhausted-plan-gates`
**Created**: 2026-07-12
**Status**: Draft
**Input**: GitHub Issue #432

## Goal
Expose a target-guarded next-action continuation for exhausted draft and spec gates whose durable source is classified as semantic_findings, reusing the existing semantic-deferral transition without resetting or incrementing the 5/5 attempt count and without another provider evaluation.

## Background
Plan gates persist a durable source after semantic failure, and run-gate already converts an exhausted semantic source into deferred flow findings and a completed gate. The dispatcher does not expose that path: exhausted draft/spec next-action is always rendered as unsupported and unrecoverable. The defect is therefore a missing guarded dispatch connection, not missing evaluation, retry, or persistence behavior.

## Scope
- Read-only classification of the canonical durable draft-gate and spec-gate source artifacts during exhausted next-action rendering.
- A recoveryPossible continuation for semantic_findings that executes the existing run-gate semantic-deferral transition with run ID, Issue, and spec guards.
- Persistence of deferred findings, gate completion, unchanged attempt/provider counts, and advancement after the guarded continuation.
- Spec-local unit and CLI end-to-end coverage plus regression verification for existing task and integration retry recovery.

## Out of Scope
- Any mutation of the blocked Issue #414 run or any other flow target.
- A sixth plan-gate provider evaluation or any plan-gate retry, reset, rewind, or manual recovery feature.
- Recovery for tooling, command, schema, coverage, corruption, missing-source, or other non-deferable classifications.
- Changes to task-impl or integration changed-evidence retry recovery, external dependencies, push, publish, or release.

## Constraints
- Use only Node.js built-in modules and existing flow abstractions.
- Keep the semantic-deferral state mutation owned by run-gate and keep next-action eligibility inspection read-only.
- Build the continuation from the selected flow state's runId, issue, and spec values and include all three target guards before execution.
- Do not change the gateRetry metric at exhaustion; the semantic-deferral continuation begins and ends with attempts equal to the configured maximum.
- Keep non-deferable exhausted plan gates on the existing stopped recovery surface with recoveryPossible false and no recovery command.
- For task-impl and integration, preserve changed-fingerprint eligibility, the audited `set retry reset gate <phase> --reason <text> --yes` command, and its one-attempt grant at max minus one.

## Design Principles
- Inspect durable evidence before offering recovery; do not infer semantic eligibility from retry count or issue-log prose.
- Reuse the existing atomic transition for finding persistence and gate completion so next-action does not duplicate mutation behavior.
- Treat target guards as part of the continuation contract, not as optional usage guidance.

## Overview
### Modules
- `src/flow/lib/get-next-action.js`: detects exhausted gate display state, requests durable semantic eligibility, and emits the guarded continuation or the existing stopped view.
- `src/flow/lib/run-gate.js`: owns durable gate-source resolution, structured exhaustion classification, semantic finding persistence, and gate completion.

### Data Flow
- An exhausted draft-gate or spec-gate reaches guarded get-next-action with attempts equal to max; next-action reads the canonical durable source and applies `classifyGateRetryExhaustionSource`.
- For semantic_findings, next-action emits a recoveryPossible command for `senti flow run gate --phase <draft|spec>` containing matching run, Issue, and spec guards; all other classifications retain recoveryPossible false and no command.
- Executing the matching command reaches run-gate's exhaustion check before provider invocation, persists the source findings to flow-findings.json, marks the gate done, and leaves the attempt count unchanged so the next guarded next-action advances.

### Decisions
- [VERIFY] checked the existing durable classifier in run-gate; result=match: semantic findings are the only deferAllowed classification and tooling, failed commands/tests, invalid schema, malformed artifacts, coverage failures, flow corruption, no-progress, and missing findings are blocking.
- [VERIFY] checked the existing exhausted transition in run-gate; result=match: retry exhaustion attempts semantic deferral before creating the retry-exhausted failure envelope and before downstream provider evaluation.
- [VERIFY] checked exhausted next-action rendering; result=match: draft/spec are currently routed through the generic retry recovery view and remain unsupported-plan-gate-phase even when durable semantic evidence exists.
- Impact inventory: the only new public behavior is an eligible guarded continuation on exhausted draft/spec next-action. Task/integration recovery remains changed-fingerprint gated and grants one audited re-evaluation at max minus one; stopped classifications, plan-gate counters, provider calls, target mismatch ordering, and durable artifacts are unchanged.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Reset the exhausted plan-gate counter and grant one more evaluation. — Rejected because Issue #432 forbids a sixth provider evaluation and the durable semantic finding can be deferred without reevaluation.
- Duplicate finding persistence and gate completion inside get-next-action. — Rejected because run-gate already owns the atomic transition; duplicating mutation behavior would create divergent invariants and make read-only action rendering mutate state.
- Treat every exhausted draft/spec source as semantically deferable. — Rejected because tooling, schema, coverage, corruption, missing evidence, and other non-semantic failures require changed evidence or repair and must remain stopped.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-12T19:23:19.307Z
- Notes: Parent preapproved the Issue #432-preserving spec after spec review PASS and spec-gate PASS.

## Requirements
- R1 [must]: When draft-gate or spec-gate attempts equal the configured maximum, guarded get-next-action shall read at most 1 MiB from the phase's canonical durable gate source through the existing `readBoundedSourceArtifact` limit and classify it with `classifyGateRetryExhaustionSource`; inspection shall not write artifacts, metrics, or step state.
- R2 [must]: If and only if R1 returns `deferAllowed: true` with reason `semantic_findings`, get-next-action shall expose `recoveryPossible: true`, `recoveryReason: semantic_findings`, and a continuation that runs the existing gate phase with `--expect-run-id`, `--expect-issue`, and `--expect-spec` values from the selected flow state.
- R3 [must]: Executing the matching continuation at 5/5 shall reuse run-gate's existing semantic-deferral transition, keep the gateRetry count and provider invocation count unchanged, persist each durable semantic finding to flow-findings.json, mark the corresponding gate step done, and allow the next guarded next-action to advance.
- R4 [must]: A mismatch in any continuation run ID, Issue, or spec guard shall return `ACTIVE_FLOW_MISMATCH` before source artifact writes, flow-findings writes, retry metric changes, or gate step mutation; matching guards shall permit the semantic-deferral transition.
- R5 [must]: Tooling failure, failed command, failed test evidence, invalid schema, malformed or corrupt artifact, coverage failure, flow corruption, no-progress guard, missing durable source, missing findings, and every other classifier result except semantic_findings shall retain `recoveryPossible: false`, expose no retry/reset/rewind continuation, and leave gate state unchanged.
- R6 [must]: For task-impl and integration only, exhausted retry recovery shall return `recoveryPossible: true` only when the current evidence fingerprint differs from the latest baseline; its command shall remain `senti flow set retry reset gate <phase> --reason <text> --yes`, append the existing recovery audit, set the counter to max minus one for exactly one re-evaluation, and reject a target mismatch with `ACTIVE_FLOW_MISMATCH` before those writes.

## Acceptance Criteria
- AC1: Exhausted draft and spec fixtures with canonical durable sources classified as semantic_findings each return recoveryPossible true, recoveryReason semantic_findings, and a gate continuation containing the fixture run ID, Issue, and spec guards.
- AC2: Before and after executing an eligible continuation, gateRetry remains 5 and the provider spy invocation count remains unchanged; flow-findings.json contains the durable finding and the gate step is done.
- AC3: A subsequent guarded get-next-action after eligible execution returns the action for the next in-progress step instead of the exhausted gate recovery view.
- AC4: For each of run ID, Issue, and spec, a mismatched guard returns ACTIVE_FLOW_MISMATCH and byte-for-byte preserves the durable source, flow-findings artifact when present, gateRetry metrics, and gate status.
- AC5: Tooling, failed-command, failed-test, invalid-schema, malformed/corrupt, coverage, flow-corruption, no-progress, missing-source, missing-findings, and non-deferable fixtures return recoveryPossible false with no recovery command and no mutation.
- AC6: Exhausted non-semantic next-action does not expose a `set retry`, reset, rewind, manual retry, or sixth gate evaluation command.
- AC7: Existing task-impl and integration retry-recovery contract tests continue to pass without changing their recovery command or eligibility assertions.
- AC8: Spec-local tests under `specs/318-expose-semantic-deferral-exhausted-plan-gates/tests/` include `// spec: R<N>` headers covering R1-R6 and exercise both read-only action generation and the fifth-FAIL to guarded-continuation to gate-completion CLI path.

## Implementation Targets
- src/flow/lib/get-next-action.js
- src/flow/lib/run-gate.js
- specs/318-expose-semantic-deferral-exhausted-plan-gates/tests/plan-gate-semantic-deferral.test.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Expose guarded semantic deferral
  - Connect exhausted draft/spec next-action rendering to read-only durable classification and the existing guarded run-gate semantic-deferral transition while retaining stopped non-semantic gates and changed-fingerprint one-attempt recovery for task-impl and integration.
  - see `tasks/T-1.md` for full spec
