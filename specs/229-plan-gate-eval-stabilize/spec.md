# Feature Specification: 229-plan-gate-eval-stabilize

**Feature Branch**: `feature/229-plan-gate-eval-stabilize`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #254

## Goal
Gate evaluation AI produces inconsistent FAIL results across runs on the same content. Inject pass history from previous evaluations into the AI prompt to stabilize judgment and reduce unnecessary retries.

## Background
Plan phase gates (gate-draft / gate-spec) produce FAIL on different guardrails across runs. Spec 221 required 12 AI calls (~467 seconds, 254k input tokens). Existing flip override only works on identical content; whack-a-mole occurs when content changes between runs.

## Scope
- Inject previously-passed guardrail IDs into the AI evaluation prompt
- Retrieve pass history from issue-log in the shared gate flow
- Apply to all retry-tracked phases (draft, spec, task-impl, integration)
- Add unit tests for prompt generation with pass history

## Out of Scope
- Changes to applyFlipOverride (retained as-is)
- Changes to issue-log recording format (passedGuardrails already recorded)
- Changes to retry limit / no-progress guard / repeated-fail escalation
- Changes to AI output format (JSON schema)

## Constraints
- All existing tests must pass
- First evaluation (no pass history) must produce identical prompt to current behavior

## Design Principles
- Prompt injection is soft guidance, not a quality bypass — AI retains independent judgment
- Dual defense: mechanical flip override for identical content + prompt injection for changed content

## Overview
### Modules
- src/flow/lib/run-gate.js — prompt builder pass-history parameter, shared gate flow pass-history retrieval

### Data Flow
- runGateFlow → issue-log passedGuardrails retrieval → checkGuardrail → buildGuardrailPromptFromFiltered with pass history injection

### Decisions
- Prompt injection chosen over exclusion to preserve quality check integrity
- Applied to all retry-tracked phases via shared gate flow path
- Existing applyFlipOverride retained as fallback safety net

## Clarifications (Q&A)
- Q: Should pass history be injected into the prompt or should previously-passed guardrails be excluded from evaluation?
  - A: Inject into prompt. Exclusion would bypass quality checks and miss issues when content changes directly affect a previously-passed guardrail.
- Q: Should this apply only to plan phases or all retry-tracked phases?
  - A: All retry-tracked phases. The shared gate flow path makes phase-specific branching unnecessary.
- Q: Should applyFlipOverride be removed since prompt injection covers its use case?
  - A: No. Retained as dual defense. Prompt injection is soft guidance; mechanical override is the deterministic fallback for identical content.

## Alternatives Considered
- Exclude previously-passed guardrails from evaluation entirely — Rejected: bypasses quality checks and may miss real violations introduced by content changes
- Diff-based re-evaluation for plan phase gates — Rejected: plan phase evaluates entire document quality, not just diffs
- Set temperature=0 for AI evaluation — Rejected: not controllable via CLI-based AI invocation

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- REQ-1 [must]: When pass history from a previous gate evaluation exists in the issue-log, the guardrail evaluation prompt shall include a 'Previously Passed Guardrails' section listing the guardrail IDs that passed, instructing the AI to only FAIL those guardrails if new changes specifically introduce a violation.
- REQ-2 [must]: When pass history is available, the prompt builder shall accept and incorporate the list of previously-passed guardrail IDs for all retry-tracked phases (draft, spec, task-impl, integration).
- REQ-3 [must]: When no pass history exists (first evaluation or no issue-log entries), the prompt shall remain unchanged from the current behavior.
- REQ-4 [should]: When the same content is re-evaluated with identical working-tree state, the existing mechanical flip override shall be retained alongside the prompt-based pass history as a fallback safety net.

## Acceptance Criteria
- Gate evaluation prompt contains a 'Previously Passed Guardrails' section when pass history is available
- Gate evaluation prompt does not contain the section when no pass history is available
- All retry-tracked phases (draft, spec, task-impl, integration) receive the pass history prompt injection
- Existing applyFlipOverride behavior is unchanged
- All existing tests pass

## Implementation Targets
- src/flow/lib/run-gate.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [pending]: Pending spec definition
  - Placeholder task until spec.json tasks[] is populated.
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Add pass history parameter to prompt builder
  - Extend the guardrail evaluation prompt builder to accept a list of previously-passed guardrail IDs and inject a 'Previously Passed Guardrails' section into the prompt when the list is non-empty.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Wire pass history retrieval in shared gate flow
  - Retrieve previously-passed guardrail IDs from the issue-log in runGateFlow and pass them through to the prompt builder for all retry-tracked phases.
  - see `tasks/T-2.md` for full spec
