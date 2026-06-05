# Feature Specification: 280-issue-359-test-review-completion-override

**Feature Branch**: `feature/280-issue-359-test-review-completion-override`
**Created**: 2026-06-05
**Status**: Draft
**Input**: GitHub Issue #359

## Goal
Clarify the test-review TOOLING_FAILURE recovery procedure so operators can complete the step with structured completion override evidence when they intentionally proceed with accepted risk.

## Background
Issue #359 reports that after repeated test-review parser_error failures, an attempt to mark test-review done failed because completion-overrides.json did not exist. The implementation already supports structured completion override evidence, but the test-review non-normal completion procedure only says to record explicit evidence. It does not state the required override artifact fields, allowed disposition values, or how to keep the related recovery task/audit trail discoverable.

## Scope
- test-review non-normal completion guidance after TOOLING_FAILURE
- completion-overrides.json entries.test-review required fields
- Finding disposition values and accepted_risk usage
- Related task or issue-log evidence recording for accepted-risk recovery
- Next-action prompt source for plan-phase test-review instructions

## Out of Scope
- Changing PASS, ADVISORY, FAIL, or TOOLING_FAILURE verdict routing
- Relaxing completion override validation or changing the override schema
- Changing AI review parser behavior or retry limits
- Adding a new CLI helper for writing completion overrides
- Regenerating the full docs/ tree as a required deliverable

## Constraints
- No external dependencies may be added; implementation and tests must use Node.js built-ins and existing local helpers.
- The existing completion validation contract must remain unchanged: test-review normal completion is limited to PASS and ADVISORY, while non-normal completion requires valid override evidence.
- The procedure text must remain generic and must not include project-specific values under src/.
- Detailed per-step recovery procedure must live in the next-action prompt source, not in the thin dispatcher skill.
- Source is newer than docs in this worktree, so implementation decisions must treat source code as authoritative.

## Design Principles
- Document the existing recovery contract instead of expanding the CLI surface.
- Make the recovery evidence shape copyable and verifiable from the procedure text.
- Keep issue-log as audit context and completion-overrides.json as the structured unlock evidence.
- Preserve current test-review verdict semantics.

## Overview
### Modules
- `src/flow/prompts/plan/test-review.md` owns operator-facing plan-phase test-review instructions.
- `src/flow/lib/flow-judgment-contract.js` owns completion override validation and the required evidence shape.
- `src/flow/lib/run-review.js` records issue-log audit entries when test-review returns TOOLING_FAILURE and emits related recovery text in tooling-failure artifacts.

### Data Flow
- When test-review returns PASS or ADVISORY, the registry hook marks test-review done. When it returns TOOLING_FAILURE, the hook leaves test-review open and records issue-log audit evidence.
- A later attempt to set test-review done loads specs/<id>/completion-overrides.json, reads entries.test-review, validates OverrideCompletionEvidence, and allows completion only when that structured evidence is valid.

### Decisions
- [VERIFY] test-review normal completion is PASS or ADVISORY only.
- [VERIFY] TOOLING_FAILURE records audit evidence but does not complete test-review.
- [VERIFY] completion override evidence already has a strict schema.
- [VERIFY] sdd-forge.flow is a thin dispatcher, so detailed test-review procedure belongs in next-action prompt content.
- Limit this spec to procedure clarity, not CLI automation.
- Require both structured override evidence and an audit/task trail in the procedure.

## Clarifications (Q&A)
- Q: Should this change add a CLI helper to create completion-overrides.json?
  - A: No. Issue #359 targets unclear recovery procedure text. The existing validator already consumes completion-overrides.json, so this spec documents that contract instead of adding behavior.
- Q: Does accepted_risk mean issue-log alone can complete test-review?
  - A: No. issue-log is audit context. completion-overrides.json remains the structured evidence required by completion validation.
- Q: Does this change alter test-review verdict routing?
  - A: No. PASS and ADVISORY remain normal completion, FAIL remains a test-design blocker, and TOOLING_FAILURE remains a tooling recovery path.
- Q: Where should detailed recovery procedure be tested?
  - A: Against src/flow/prompts/plan/test-review.md, the next-action prompt source for the plan/test-review step. The thin dispatcher skill should not duplicate per-step recovery instructions.

## Alternatives Considered
- Add a CLI helper to write completion override evidence — Rejected because the issue asks for reusable recovery procedure clarity, and adding a command would expand the behavioral surface.
- Relax completion validation when issue-log has a tooling_failure entry — Rejected because free-text issue-log is not structured override evidence and would weaken the completion contract.
- Document only the existence of completion-overrides.json — Rejected because the reported failure came from missing operational details: required fields, disposition, and related task recording.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-05T05:39:07.105Z
- Notes: User approved gate-passed spec via option 1.

## Requirements
- R1 [must]: The test-review non-normal completion procedure must state that TOOLING_FAILURE is not a test-quality failure, does not complete test-review by itself, and requires either tooling recovery or structured completion override evidence before proceeding.
- R2 [must]: The procedure must document the completion-overrides.json location and entries.test-review required fields: userApproval=true, reason, approvedAt, approvedBy, and a non-empty findings array.
- R3 [must]: The procedure must document each finding entry field: findingId, disposition, successorOwner, and acceptedRisk; must list the allowed disposition values out_of_scope, transferred_to_successor, accepted_risk, and false_positive; and must define a stable synthetic findingId convention for TOOLING_FAILURE cases with no parsed review finding, such as test-review:tooling_failure:<toolingFailure>.
- R4 [must]: The procedure must state that accepted_risk recovery needs an audit or task trail, using the existing issue-log TOOLING_FAILURE entry or an explicit related task reference, and that free-text issue-log alone is not completion override evidence.
- R5 [should]: Spec-local tests must verify that the updated guidance includes the required override artifact fields, allowed disposition values, accepted_risk audit/task guidance, and the free-text issue-log boundary.

## Acceptance Criteria
- test-review guidance contains a TOOLING_FAILURE recovery subsection or equivalent text that distinguishes tooling failure from test-quality failure.
- The guidance names specs/<id>/completion-overrides.json and entries.test-review as the structured evidence location for test-review override completion.
- The guidance lists userApproval=true, reason, approvedAt, approvedBy, and findings[] as required override fields.
- The guidance lists findingId, disposition, successorOwner, and acceptedRisk as required finding fields.
- The guidance defines a stable synthetic findingId convention for TOOLING_FAILURE artifacts with no parsed review finding, including parser_error cases.
- The guidance lists out_of_scope, transferred_to_successor, accepted_risk, and false_positive as allowed disposition values.
- The guidance states that accepted_risk must be tied to an issue-log entry or related task reference and that free-text issue-log alone does not satisfy completion override validation.
- Spec-local tests under specs/280-issue-359-test-review-completion-override/tests/ include a `// spec: R1 R2 R3 R4 R5` header and fail before the guidance is updated.

## Implementation Targets
- src/flow/prompts/plan/test-review.md
- src/flow/commands/review.js
- specs/280-issue-359-test-review-completion-override/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Clarify recovery guidance
  - Update test-review recovery guidance so operators can write valid completion override evidence and keep an accepted-risk audit trail after TOOLING_FAILURE.
  - see `tasks/T-1.md` for full spec
