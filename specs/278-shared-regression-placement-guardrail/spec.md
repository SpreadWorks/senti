# Feature Specification: 278-shared-regression-placement-guardrail

**Feature Branch**: `feature/278-shared-regression-placement-guardrail`
**Created**: 2026-06-04
**Status**: Draft
**Input**: GitHub Issue #361

## Goal
When prompt guidance is moved between SDD flow skill or prompt files, the SDD flow implementation procedure shall require checking related shared regression tests for both old-placement removal assertions and new-placement presence assertions.

## Background
Issue #361 records a project regression failure after workflow board prompt guidance moved from finalize-cleanup to post-flow skill guidance while a shared unit test still asserted the old finalize-cleanup placement. The root concern is a procedure gap: prompt guidance movement must include checking shared regression tests that encode placement contracts.

## Scope
- must: Update the SDD flow skill procedure so prompt guidance moves require checking related shared regression tests for old-placement and new-placement assertions.
- must: The procedure shall cover prompt guidance moved between flow skill files and flow prompt files, not only workflow board guidance.
- must: The completion contract shall require both an assertion that moved guidance is absent from the old location and an assertion that required guidance is present in the new location.
- should: The workflow board candidate guidance regression test may be referenced as the concrete example for this assertion pattern.

## Out of Scope
- must: Do not reimplement the Issue #360 workflow board guidance move.
- must: Do not change workflow board candidate guidance behavior.
- must: Do not define or change GitHub Projects or workflow board methodology.

## Constraints
- The change shall not add external dependencies; only Node.js built-in modules may be used.
- If `src/skills/` source files are changed, `sdd-forge upgrade` shall be run so generated agent skills reflect the source change.
- The implementation shall not add project-specific information under `src/`; procedure text must describe generic prompt guidance movement checks.
- Existing valid tests shall not be weakened to pass; any shared regression test edits shall reflect the new placement contract.

## Design Principles
- Place the recurrence-prevention instruction where implementers read SDD flow procedure guidance, because Issue #361 arose during prompt guidance movement work.
- Use diff-verifiable wording: reviewers can confirm the instruction names prompt guidance movement, related shared regression tests, old-placement removal assertions, and new-placement presence assertions.

## Overview
### Modules
- SDD flow skill source (`src/skills/sdd-forge.flow/SKILL.md`) defines agent-facing SDD flow procedure rules that are deployed to generated agent skill directories.
- Workflow board candidate guidance regression test (`tests/unit/workflow-board-candidate-guidance.test.js`) verifies absent-from-finalize-cleanup and present-in-post-flow placement contracts.
- Finalize cleanup prompt (`src/flow/prompts/impl/finalize-cleanup.md`) contains cleanup procedure text and currently does not contain workflow board candidate guidance.

### Data Flow
- Implementer changes prompt guidance placement in a flow skill or flow prompt file.
- Updated SDD flow skill procedure directs the implementer to inspect related shared regression tests for old and new placement contracts.
- Spec-local tests verify the procedure text contains the required contract language; final regression verifies existing shared tests still pass.

### Decisions
- [VERIFY] Checked draft source references: workflow board guidance regression test already asserts both removal from finalize-cleanup and presence in post-flow skill guidance.
- Use SDD flow skill procedure strengthening as the primary fix, based on the user decision in draft-refine q1.
- Require both old-placement removal and new-placement presence checks, based on the user decision in draft-refine q2.
- Scope the instruction to prompt guidance movement in general, based on the user decision in draft-refine q3.

## Clarifications (Q&A)
- Q: Does this spec require changing workflow board guidance behavior?
  - A: No. The spec only changes the SDD flow procedure for prompt guidance movement checks.
- Q: Does this spec require a new CLI command or user-facing argument?
  - A: No. No CLI entry point, argument, or exit-code contract changes are in scope.

## Alternatives Considered
- Add only a new guardrail. — Rejected because the user selected SDD flow skill procedure strengthening as the primary control point, and the failure occurs during prompt guidance movement work.
- Strengthen only the existing workflow board guidance unit test. — Rejected because Issue #361 describes a recurring prompt guidance movement risk, not only the already-fixed workflow board guidance example.
- Generalize to all shared regression contract moves. — Rejected because it exceeds the issue scope; the selected scope is prompt guidance movement in general.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-04T14:41:40.944Z
- Notes: User approved gate-passed spec.

## Requirements
- R1 [must]: When SDD flow procedure text describes implementation work involving prompt guidance moved between flow skill or flow prompt files, it shall require checking related shared regression tests for placement-contract assertions.
- R2 [must]: The procedure text shall explicitly require both old-placement removal assertions and new-placement presence assertions for moved prompt guidance.
- R3 [must]: The procedure text shall apply to prompt guidance movement in general and shall not limit the rule to workflow board guidance only.
- R4 [should]: Spec-local tests shall verify the SDD flow skill source contains the prompt-guidance movement regression-test instruction and the two placement assertion requirements.
- R5 [must]: If the implementation changes `src/skills/`, generated agent skills shall be updated by running `sdd-forge upgrade`.

## Acceptance Criteria
- A reviewer can inspect the diff and find SDD flow skill procedure text that names prompt guidance movement and related shared regression tests.
- A reviewer can inspect the diff and find procedure text requiring both old-placement removal assertions and new-placement presence assertions.
- A reviewer can inspect the diff and confirm the procedure is not limited to workflow board guidance.
- Spec-local tests under `specs/278-shared-regression-placement-guardrail/tests/` verify R1 through R4 with `// spec: R<N>` headers.
- `sdd-forge upgrade` is run if `src/skills/` source files change, and generated skill diffs are included when produced.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add prompt guidance movement procedure
  - Update SDD flow skill procedure text so prompt guidance movement requires checking related shared regression tests for placement contracts.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Verify generated skill deployment
  - Ensure generated agent skill files reflect the SDD flow skill source change when `src/skills/` changes.
  - see `tasks/T-2.md` for full spec
