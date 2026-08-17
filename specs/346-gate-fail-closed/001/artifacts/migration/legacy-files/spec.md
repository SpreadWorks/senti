# Feature Specification: 346-gate-fail-closed

**Feature Branch**: `feature/346-gate-fail-closed`
**Created**: 2026-07-25
**Status**: Draft
**Input**: GitHub Issue #465

## Goal
Make flow gate prerequisite validation and required evaluations fail-closed.

## Background
Gate code currently has fallback paths that can produce PASS when a required guardrail result is absent, while unresolved presets can emit repeated warnings during evaluation. A finalized flow-level spec review may also be left unregistered when its post-hook loses the repository-operation lock, even though a PASS provider artifact exists. This change preserves valid PASS/FAIL behavior but blocks incomplete prerequisite and evaluation work before any approval transition, and makes that finalized review artifact recoverable without another provider call.

## Scope
- src/flow/lib/run-gate.js
- src/flow/lib/set-review-evidence.js
- gate prerequisite and preset resolution boundaries
- unit and CLI regression coverage

## Out of Scope
- normal semantic decision logic
- foreign or optional policy semantics
- new public evaluation-bypass options

## Constraints
- Use Node.js built-ins only.
- Production CLI paths must not bypass required evaluations.
- Test-only fixtures must be unreachable from production routing.

## Design Principles
- Emit PASS only after every configured prerequisite and required evaluation completes with schema-conforming output.
- Prerequisite, execution, schema, and semantic outcomes retain distinct machine-readable classifications.

## Overview
### Modules
- RunGateCommand validates prerequisites, invokes required evaluations, and persists gate artifacts.
- Preset resolution validates configured chains before semantic context resolution.
- SetReviewEvidenceCommand registers a finalized review artifact for an active flow-level or task-level review target.
- The flow registry advances the next step only when the gate result is PASS after every configured prerequisite and required evaluation completed with schema-conforming output.
- RunGateCommand rejects public required-evaluation bypasses before gate execution.
- FinalizedFlowReviewArtifact validates recovery inputs before canonical review evidence registration.

### Data Flow
- preset and agent configuration -> prerequisite validation -> semantic evaluation -> typed gate outcome -> artifact persistence -> registry transition
- review provider artifact -> canonical evidence registration -> review transition
- Public gate arguments are validated before normal gate dispatch.
- A finalized flow-level PASS provider artifact is validated against phase, null task target, tree, and state digest before canonical registration.

### Decisions
- [VERIFY] Checked draft policy against src/flow/lib/run-gate.js; match: runGateFlow and diff-based gate paths currently convert missing guardrail results to gatePass, so failure normalization must be corrected at this boundary.
- [VERIFY] Existing public PASS artifacts and transition ownership remain with RunGateCommand and registry; only incomplete evaluation outcomes become blocking typed failures.
- [CORRECTION] Test-only evaluation control must not be a public CLI route; production paths always execute configured required evaluations.
- [VERIFY] set-review-evidence accepts canonical ReviewEvidence input with phase and task identity, while spec-review.json is a provider artifact; recovery must transform a flow-level provider PASS artifact before registration.
- [VERIFY] Existing impact: configured agent PASS/FAIL artifacts, preset configuration, gate result artifacts, and registry transitions remain on their current public surfaces; only unavailable required evaluation becomes a blocking typed outcome and repeated missing-preset warnings are removed.
- Required gate test fixtures remain internal; public CLI bypass attempts return typed failures.
- Review recovery reuses an existing finalized artifact and never invokes the provider again.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Normalize unavailable evaluation to PASS or warning — Rejected because it permits approval without required evidence and violates the fail-closed contract.
- Expose a public skip option for required evaluation — Rejected because production CLI behavior must never bypass required guardrails or evaluations.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-07-25T14:50:11.533Z
- Notes: Auto-approved after spec and spec-gate PASS; includes user-authorized flow-level review evidence recovery.

## Requirements
- R1 [must]: Validate the full preset chain once before semantic context resolution. A missing preset returns a typed prerequisite failure before evaluation, emits no repeated warning in the same invocation, and leaves the configured maximum of five semantic gate retries unchanged.
- R2 [must]: For every required agent evaluation, guardrail evaluation, and schema validation, unset configuration, spawn failure, evaluation failure, invalid output, or schema failure produces a blocking non-PASS outcome. No such outcome may mark a gate done or advance approval.
- R3 [must]: Persist mechanically distinguishable failure classification: gate artifacts use artifacts.failureKind and artifacts.failureCode; flow error envelopes use errors[0].code. Semantic findings retain artifacts.evaluations and artifacts.reasons.
- R4 [must]: When configured required agents return schema-conforming PASS or FAIL evaluations, retain their current result semantics, foreign/optional policies, normal gate result/evaluations/reasons artifacts, and PASS registry transitions.
- R5 [must]: Production public CLI routes cannot bypass required evaluations. Any fixture or evaluation substitute used by tests is isolated from production routing.
- R6 [must]: When a finalized flow-level review provider artifact remains after post-hook lock failure, register it as canonical evidence for the current phase, null task target, current tree, and current state fingerprint without invoking the provider again. Reject artifacts whose phase, tree, or target state does not match.

## Acceptance Criteria
- Missing preset returns one typed prerequisite failure before evaluation; semantic retry count is unchanged.
- Unset agent, agent spawn failure, guardrail failure, invalid output, and schema failure each produce a non-PASS outcome and leave approval unreachable.
- Artifacts and envelopes expose the R3 fields needed to distinguish prerequisite, agent, guardrail, schema, and semantic outcomes.
- Configured required agents that return schema-conforming PASS or FAIL evaluations retain existing result, evaluations, reasons, foreign/optional behavior, and PASS post-hook transition.
- Unit tests cover R1-R5; CLI behavior tests verify the missing-preset and public-route contracts; spec-local tests cover every R1-R5 header.
- A flow-level spec review PASS artifact created before a post-hook lock failure can be registered without a provider rerun, while mismatched artifacts are rejected.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Validate gate prerequisites
  - Validate preset chains and required gate inputs before semantic evaluation. Return typed prerequisite failures without incrementing the configured maximum of five semantic gate retries.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Classify required evaluation failures
  - Make required agent, guardrail, and schema evaluation failures blocking and machine-readable.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Protect gate public contracts
  - Preserve the current schema-conforming configured-agent PASS/FAIL result semantics, foreign/optional policies, artifacts, and PASS transition while preventing production evaluation bypass.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Recover flow review evidence
  - Register a finalized flow-level review artifact after post-hook persistence failure without rerunning the provider.
  - see `tasks/T-4.md` for full spec
