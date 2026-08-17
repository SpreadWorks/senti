# Draft: 162-improve-choice-format-enforcement

**Development Type:** enhancement
**Goal:** Clarify the flow-plan draft-phase instruction so every user question, including post-change confirmations, must use the Choice Format with no exceptions.

## Context
- Source issue: #119
- Problem: Existing wording (`Use selection-based questions as default`) allows exceptions in reactive confirmations.

## Scope Decisions
- In scope: update `src/templates/skills/sdd-forge.flow-plan/SKILL.md` wording and related tests.
- Out of scope: docs regeneration execution (`sdd-forge build`) in this spec.

## Q&A
- Q1: Should this spec include docs regeneration work because source is newer than docs?
  - A1: No. Limit this spec to wording changes only; docs update is a separate task.
- Q2: Should the same strict rule be expanded to other skills (`flow-impl`, `flow-finalize`)?
  - A2: No. Limit to `flow-plan` and related tests only.
- Q3: What acceptance level is required?
  - A3: (1) MUST wording enforces Choice Format for all user questions including confirmations, and (2) related unit tests verify the wording.

## Requirements Draft
1. The draft-phase communication rule in flow-plan skill template must require Choice Format for every user question without exceptions.
2. The rule must explicitly include confirmation questions after applying user-requested changes.
3. Existing or updated tests must assert the strict wording so regressions are caught.

## Open Questions
- [ ] None

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-08
- Notes: Approved via auto mode (`/sdd-forge.flow-auto-on`, user selected 1).
