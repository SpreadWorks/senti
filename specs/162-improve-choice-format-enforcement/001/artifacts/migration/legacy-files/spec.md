# Feature Specification: 162-improve-choice-format-enforcement

**Feature Branch**: `feature/162-improve-choice-format-enforcement`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Issue #119

## Goal
Clarify the flow-plan draft-phase instruction so every user-facing question, including confirmation after applying user-requested changes, must use the Choice Format with no exceptions.

## Scope
- Update wording in `src/templates/skills/sdd-forge.flow-plan/SKILL.md` to remove exception-prone phrasing.
- Ensure the wording explicitly covers reactive confirmation questions.
- Update/add tests that validate the strict wording requirement.

## Out of Scope
- Extending the same wording change to `flow-impl` and `flow-finalize`.
- Running `sdd-forge build` and regenerating project docs in this spec.
- Any runtime behavior changes outside the flow-plan skill template content and its tests.

## Clarifications (Q&A)
- Q: Should this spec include docs regeneration work because source is newer than docs?
  - A: No. Keep this spec focused on wording and tests; docs refresh is a separate task.
- Q: Should the strict rule be expanded to other skills now?
  - A: No. Keep this issue scoped to flow-plan only.
- Q: What is the acceptance level?
  - A: Strict MUST wording with explicit confirmation coverage, plus tests to prevent regression.

## Alternatives Considered
- Keep current wording (`as default`) and add examples only.
  - Rejected: still allows interpretation drift and exception behavior.
- Apply strict wording to all flow skills in one change.
  - Rejected: violates single-responsibility scope for this issue.

## Why This Approach
This approach resolves the ambiguity identified in #119 with the smallest targeted change and preserves maintainability by coupling the wording update with regression tests.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes: Approved via auto mode (`/sdd-forge.flow-auto-on`).

## Requirements
1. When defining draft-phase communication rules in flow-plan skill template, the instruction shall require Choice Format for every question to the user with no exceptions.
2. When a question is a confirmation after applying a user-requested change, the same strict Choice Format requirement shall apply.
3. When the skill template wording is validated by tests, the tests shall fail if the strict “no free-form / no exceptions” intent is removed.

## Test Strategy
- Unit test target: flow-plan skill include expansion output.
- Verify that generated/expanded skill text contains strict wording that applies to every user question, including confirmation after user-requested changes.
- Verify that free-form exceptions are explicitly disallowed (equivalent to "No free-form questions. No exceptions.").
- Run via existing unit test command: `npm run test:unit`.

## Acceptance Criteria
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` contains strict wording equivalent to: every user question (including post-change confirmations) must use Choice Format; no free-form questions; no exceptions.
- Relevant unit tests in the repository assert this strict wording behavior and pass after updates.
- No unrelated skill template is modified by this spec.

## Open Questions
None
