# Feature Specification: 229-unify-priority-format

**Feature Branch**: `feature/229-unify-priority-format`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #262

## Goal
Unify priority notation across the SDD flow so that draft, spec.md, and spec.json all use the same enum: must, should, nice-to-have.

## Background
The prioritize-requirements guardrail instructs authors to specify their priority order without naming the enum that spec.json accepts. AI agents interpret this as P1/P2/P3 notation, which spec.json schema validation rejects. This mismatch caused schema validation failures (documented in spec 227 issue-log).

## Scope
- Change the prioritize-requirements guardrail body to explicitly name the spec.json priority enum values (must, should, nice-to-have).

## Out of Scope
- Changing the spec.json schema priority enum.
- Modifying existing spec files.
- Changing render, review, or retro logic.

## Constraints
- The guardrail body is plain text evaluated by AI during gate checks. It must be concise and unambiguous.
- Impact on existing features: gate-draft and gate-spec AI evaluation will see updated guardrail text. No impact on spec.json schema, spec render, review, or retro logic.

## Design Principles
- Single source of truth: the spec.json schema defines the canonical priority values; the guardrail references them.

## Overview
### Modules
- src/presets/base/guardrail.json — contains the prioritize-requirements guardrail definition.

### Data Flow
- guardrail.json → gate-draft/gate-spec AI evaluation → draft.md/spec.md authoring → spec.json validation.

### Decisions
- Chose A+C (unify notation + update guardrail wording) over B (auto-normalize) and D (relax schema).

## Clarifications (Q&A)
- Q: Why not auto-normalize P1→must at the spec render/gate stage?
  - A: Alpha policy prohibits backward-compatibility layers. A normalization layer adds complexity for a problem solvable at the source.
- Q: Why not relax the spec.json schema to accept P1/P2/P3?
  - A: Would allow two representations to coexist, causing inconsistency in rendered output and downstream tools.

## Alternatives Considered
- B: Auto-normalize P1→must at spec render/gate — Rejected — adds conversion layer, alpha policy prohibits backward-compatibility code.
- D: Relax spec.json schema to accept P1/P2/P3 — Rejected — two notations coexist, no single source of truth.

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: When requirements exceed three items, the prioritize-requirements guardrail body shall instruct authors to assign each requirement a priority from the spec.json enum: must, should, or nice-to-have.
- R2 [must]: When the prioritize-requirements guardrail body is rendered for AI evaluation, it shall not reference or permit P1/P2/P3 notation as a valid priority format.

## Acceptance Criteria
- npm test passes with no regressions.
- The prioritize-requirements guardrail body in src/presets/base/guardrail.json contains the values must, should, nice-to-have.
- The guardrail body does not reference P1/P2/P3 notation.

## Implementation Targets
- src/presets/base/guardrail.json

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [skipped]: Placeholder task until spec.json tasks[] is populated
  - Placeholder task until spec.json tasks[] is populated.
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Update prioritize-requirements guardrail body
  - Replace the generic priority order instruction with explicit must/should/nice-to-have enum reference in the prioritize-requirements guardrail.
  - see `tasks/T-1.md` for full spec
