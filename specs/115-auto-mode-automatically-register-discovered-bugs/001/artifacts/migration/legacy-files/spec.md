# Feature Specification: 115-auto-mode-automatically-register-discovered-bugs

**Feature Branch**: `feature/115-auto-mode-automatically-register-discovered-bugs`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Issue #54

## Goal

Clarify when the AI should record issues in redolog during SDD flow execution, so that bugs and errors discovered in auto mode are not silently lost.

## Scope

- Expand `src/templates/partials/redo-recording.md` with explicit trigger conditions and examples.
- Add minimal phase-specific supplementary instructions to each skill template that includes redo-recording:
  - `src/templates/skills/sdd-forge.flow-plan/SKILL.md` (test phase)
  - `src/templates/skills/sdd-forge.flow-impl/SKILL.md` (implement/review phases)
  - `src/templates/skills/sdd-forge.flow-finalize/SKILL.md` (commit/merge/worktree operations)

## Out of Scope

- Renaming redolog (tracked separately: board 2dbb)
- Changing redolog.json format or `sdd-forge flow set redo` command interface
- Adding new commands or files
- Changing flow logic in `src/flow/`

## Clarifications (Q&A)

- Q: Should bugs be recorded in redolog or in spec.md Open Questions?
  - A: redolog. It already exists, persists with the spec, and its partial is included in all skills.
- Q: Should we rename redolog since the name doesn't match expanded usage?
  - A: Out of scope. Tracked as board item 2dbb.
- Q: Which skills need changes?
  - A: All three flow skills (plan, impl, finalize). The shared partial handles most of the content; each skill gets minimal supplementary instructions.
- Q: Should the partial or each skill contain the trigger conditions?
  - A: The partial. Trigger conditions are cross-cutting knowledge. Each skill adds only phase-specific notes.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: User said "あとは任せた" (leave the rest to me) — proceeding autonomously.

## Requirements

Priority: P1 > P2 > P3. P1 is the core fix; P2 improves usability; P3 adds per-skill context.

1. **(P1)** Expand `redo-recording.md` partial with a "When to record" section listing concrete trigger conditions:
   - Test failure caused by production code bug (not test design issue), especially when the fix is out of current spec scope
   - Test adjusted to match current (incorrect) behavior because spec prohibits production code changes
   - Worktree creation/deletion error
   - Merge conflict
   - Commit failure (including hook failures)
   - Workaround applied instead of proper fix
2. **(P2)** Add an "Examples" subsection to the partial showing at least 2 concrete `sdd-forge flow set redo` invocations with realistic values.
3. **(P3)** Add a note in `flow-plan` SKILL.md test phase (step 8): when a test reveals a production code bug that is out of spec scope, record it in redolog before adjusting the test.
4. **(P3)** Add a note in `flow-impl` SKILL.md implement step: when test failures during implementation are caused by pre-existing bugs (not the current changes), record in redolog.
5. **(P3)** Add a note in `flow-finalize` SKILL.md: when worktree, merge, or commit operations fail, record in redolog before applying workaround.
6. No changes to `src/flow/` code, redolog.json format, or CLI commands.

## Acceptance Criteria

- `redo-recording.md` contains a "When to record" section with at least 6 trigger conditions.
- `redo-recording.md` contains an "Examples" subsection with at least 2 concrete command invocations.
- `flow-plan` SKILL.md has a redo-related note in the test phase section.
- `flow-impl` SKILL.md has a redo-related note in the implement section.
- `flow-finalize` SKILL.md has a redo-related note near worktree/merge/commit operations.
- `sdd-forge upgrade` correctly expands the updated partial into generated SKILL.md files.
- No changes to any file under `src/flow/`.

## Open Questions
- (none)
