# Feature Specification: 257-phase-aware-reopen-draft

**Feature Branch**: `feature/257-phase-aware-reopen-draft`
**Created**: 2026-05-15
**Status**: Draft
**Input**: GitHub Issue #323

## Goal
Make `sdd-forge flow run reopen-draft --reason "..."` usable before implementation when spec planning needs to return to draft QA, while preserving the existing implementation-phase task-addition behavior.

## Background
Issue #323 identifies a mismatch between the intended SDD workflow and the current `reopen-draft` implementation. The workflow design expects spec planning to return to draft when a missing user decision must be captured as QA. The command currently assumes a mid-implementation task-addition scenario, so a spec-phase flow with no committed tasks fails before it can reset draft. This leaves agents with ad-hoc user confirmation as the only practical path, contradicting the intended draft-return process.

## Scope
- [must] Add phase-aware `reopen-draft` behavior for pre-implementation plan flow states.
- [must] Reset the plan-phase step matrix for pre-spec and post-approval reopen paths.
- [must] Preserve existing spec artifacts and record the reopen reason plus stale-artifact context in issue-log.
- [must] Preserve implementation-phase done task precondition and task append semantics.
- [must] Update spec prompt guidance so missing user judgment returns to draft through `reopen-draft` when available.
- [must] Update generated flow skill guidance and run `sdd-forge upgrade` because `src/templates/skills/sdd-forge.flow/SKILL.md` changes.
- [must] Add regression tests for pre-spec, post-approval, and implementation-phase reset behavior.

## Out of Scope
- Draft review / gate-draft redesign outside the reopen-draft regression path.
- Board cdb2 review / gate convergence improvements.
- GitHub Projects workflow or experimental workflow changes.
- Reordering the global SDD flow definition.
- Changing implementation-phase task append semantics.

## Constraints
- Node.js built-in modules only; no dependency additions.
- Do not delete existing spec artifacts during reopen; record stale context instead.
- When changing `src/templates/skills/sdd-forge.flow/SKILL.md`, run `sdd-forge upgrade` so generated `.agents/skills` and `.claude/skills` content is updated.
- User-facing argument validation for `reopen-draft --reason` remains at the command boundary: optional string, no NUL byte, trimmed length at most 500 characters.
- Exit-code contract: successful reopen returns an ok envelope and process exit 0; invalid reason, missing active flow, and disallowed phase/precondition failures return a fail envelope and non-zero process exit.
- Implementation-phase reopen keeps the existing safety boundary: at least one done task must exist before reopening draft for task additions.

## Design Principles
- Use one command for both draft-return use cases, with phase-aware preconditions rather than a new command.
- Keep plan-phase reset explicit and testable as a matrix of step statuses.
- Treat issue-log as the durable audit trail for why stale planning artifacts exist.
- Make prompt and skill text describe the command behavior that the code actually supports.

## Overview
### Modules
- src/flow/lib/run-reopen-draft.js — implement phase-aware preconditions, plan reset behavior, and reopen issue-log entries.
- src/flow/definition.js / src/lib/flow-helpers.js — existing flow definition and nested-step helpers provide the step IDs and status structure used by the reset matrix.
- src/flow/prompts/plan/spec.md — change spec-writing guidance from ad-hoc user confirmation to draft-return via reopen-draft when a missing draft decision is discovered.
- src/templates/skills/sdd-forge.flow/SKILL.md — document phase-aware reopen-draft behavior in generated agent skill guidance.
- .agents/skills/sdd-forge.flow/SKILL.md and .claude/skills/sdd-forge.flow/SKILL.md — generated outputs refreshed by `sdd-forge upgrade`.
- specs/257-phase-aware-reopen-draft/tests/ — spec-local regression tests for reopen reset matrix and non-regression behavior.

### Data Flow
- User/agent invokes `sdd-forge flow run reopen-draft --reason <text>` → command validates reason → command classifies flow state as pre-implementation plan path or implementation task-addition path.
- Pre-implementation path → draft step becomes in_progress → downstream plan steps become pending → issue-log records reason and stale artifact context → existing spec artifacts remain on disk.
- Implementation path → existing done task precondition remains required → draft step and gate-draft are reopened for task addition → existing task semantics remain unchanged.
- Spec prompt and generated flow skill describe the same phase-aware command behavior so future agents use the supported path.

### Decisions
- [VERIFY] `run-reopen-draft` currently fails before tasks exist and before any task is done.
- [VERIFY] The plan phase includes draft/review/gate/spec/approval/test leaves that must be reset by name.
- [VERIFY] Existing issue-log helper supports durable reopen audit entries with step, reason, trigger, resolution, guardrailCandidate, taskId, and timestamp.
- [VERIFY] The current spec prompt still allows in-place user confirmation, which conflicts with Issue #323's draft-return policy.
- [VERIFY] The flow skill template still describes reopen-draft as mid-implementation task-addition behavior.
- Pre-implementation reopen covers the planning leaves after draft creation and before implementation task execution, including post-approval/test planning leaves.
- Implementation-phase behavior is a non-regression contract and is not weakened by the plan-phase path.

## Clarifications (Q&A)
- Q: Does pre-implementation reopen include post-approval planning leaves?
  - A: Yes. Issue #323 explicitly requires post-approval reset matrix coverage, so approval/test/review-test are reset when draft is reopened before implementation task execution.
- Q: Is stale artifact tracking required to be a new storage field?
  - A: No. The requirement is that stale status is auditable. This spec uses issue-log entries unless implementation discovers an existing stronger artifact mechanism.
- Q: Does the command change public CLI syntax?
  - A: No. The existing `reopen-draft` command and `--reason` option remain the interface; this spec changes phase-aware semantics and documentation.

## Alternatives Considered
- Create a separate `reopen-spec-draft` command — Rejected because the existing user-facing operation is already `reopen-draft`; a second command would duplicate workflow intent and require extra CLI documentation without improving behavior.
- Keep ad-hoc spec-phase Choice Format confirmation — Rejected because Issue #323 states that missing draft decisions should return to draft QA rather than being answered ad-hoc during spec writing.
- Delete stale spec artifacts during pre-implementation reopen — Rejected because Issue #323 explicitly requires existing spec artifacts not to be deleted and stale status to be recorded.
- Remove the implementation-phase done task precondition — Rejected because Issue #323 requires implementation-phase and later reopen behavior to preserve the existing done task precondition and task append semantics.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-14T14:59:28.891Z
- Notes: autoApprove: approved gate-passed spec for Issue #323

## Requirements
- R1 [must]: `sdd-forge flow run reopen-draft --reason "..."` shall accept pre-implementation plan flows that have no done tasks when the active flow is still before implementation task execution. This path shall not return `NO_TASKS` or `NO_DONE_TASK` solely because `flow.json.tasks[]` is empty or has no done task.
- R2 [must]: For pre-spec and post-approval plan reopen paths, the command shall set `draft` to `in_progress` and set `review-draft-questions`, `draft-refine`, `review-draft-coverage`, `gate-draft`, `spec`, `review-spec`, `spec-repair`, `gate`, `approval`, `test`, and `review-test` to `pending`.
- R3 [must]: For pre-implementation plan reopen paths, existing spec artifacts including `spec.json`, `spec.md`, `draft.json`, `issue.md`, review reports, and test design files shall not be deleted by `reopen-draft`. The command shall record in `issue-log.json` that planning artifacts became stale because draft was reopened.
- R4 [must]: For every successful reopen, `issue-log.json` shall include the provided `--reason` text when non-empty, the trigger command context, and a resolution summary that distinguishes pre-implementation draft regression from implementation-phase task addition.
- R5 [must]: For implementation-phase or later reopen paths, the command shall preserve the existing done task precondition: if no done task exists, it shall fail with `NO_DONE_TASK`; if at least one done task exists, it shall reopen draft for task additions without resetting the full plan matrix described in R2.
- R6 [must]: `src/flow/prompts/plan/spec.md` shall instruct agents that when spec writing discovers a missing user decision that belongs in draft QA, they should run `sdd-forge flow run reopen-draft --reason "<reason>"` rather than collecting an ad-hoc spec-phase answer, except for command failure or recovery choices that still require Choice Format handling.
- R7 [must]: `src/templates/skills/sdd-forge.flow/SKILL.md` and generated skill copies shall describe phase-aware `reopen-draft`: pre-implementation plan flows do not require a done task and reset the plan matrix, while implementation-phase task additions still require a done task.
- R8 [must]: Tests shall cover pre-spec, post-approval, and implementation-phase reopen paths. The tests shall assert step status changes, issue-log reason/stale recording, artifact preservation for plan reopen, and implementation-phase non-regression for `NO_DONE_TASK` and successful done-task reopen.

## Acceptance Criteria
- A spec-local test exercising a pre-spec plan flow with no tasks shows `reopen-draft --reason "..."` succeeds, `draft` becomes `in_progress`, all R2 plan steps become `pending`, artifacts remain present, and issue-log contains the reason plus stale planning context.
- A spec-local test exercising a post-approval plan flow shows `approval`, `test`, and `review-test` are reset to `pending` together with the earlier plan review/gate/spec steps.
- A spec-local test exercising an implementation-phase flow with no done task still receives `NO_DONE_TASK`.
- A spec-local test exercising an implementation-phase flow with a done task preserves the prior task-addition behavior and does not apply the full R2 plan reset matrix.
- `src/flow/prompts/plan/spec.md` mentions `sdd-forge flow run reopen-draft --reason "<reason>"` as the route for missing draft decisions discovered during spec writing.
- `src/templates/skills/sdd-forge.flow/SKILL.md` mentions both pre-implementation plan reopen and implementation-phase task-addition reopen preconditions.
- `sdd-forge upgrade` updates generated flow skill files after the template change.
- The command still rejects invalid `--reason` values with a fail envelope and non-zero exit.
- No existing spec artifact is deleted by successful pre-implementation reopen.
- npm test passes.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Implement plan reopen
  - Add the pre-implementation plan reopen path to `reopen-draft` while preserving implementation-phase safety checks.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Update reopen guidance
  - Align spec-writing prompt guidance and generated flow skill text with the phase-aware `reopen-draft` behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover reset matrix
  - Add regression tests that lock down the phase-aware reset matrix and implementation-phase non-regression behavior.
  - see `tasks/T-3.md` for full spec
