# Feature Specification: 264-flow-status-canonical-command

**Feature Branch**: `feature/264-flow-status-canonical-command`
**Created**: 2026-05-20
**Status**: Draft
**Input**: GitHub Issue #338

## Goal
Ensure flow status instructions use only `sdd-forge flow get status`, while `sdd-forge flow status` remains unsupported and fails with a clear correction to the canonical command.

## Background
The canonical command for reading flow status is `sdd-forge flow get status`. During operation, the incorrect form `sdd-forge flow status` can be selected from memory or unclear guidance. The desired improvement is not compatibility for the incorrect form; it is to keep instruction sources canonical and make the unsupported input fail with a clear correction.

## Scope
- Audit skill, prompt, docs, help, and test references for the incorrect `sdd-forge flow status` command shape.
- Keep `sdd-forge flow get status` as the only supported status command.
- Make `sdd-forge flow status` fail with non-zero exit and explicit guidance to `sdd-forge flow get status`.
- Add regression coverage for the mistyped command behavior.

## Out of Scope
- Adding a `flow status` alias.
- Changing the behavior or output schema of `sdd-forge flow get status`.
- Introducing backward-compatibility support for other old or mistyped command forms.
- Changing unrelated flow command groups or dispatcher semantics.

## Constraints
- `sdd-forge flow status` must remain an unsupported command and must exit non-zero.
- `sdd-forge flow get status` must remain the only supported status command.
- The CLI entry point must validate the user-facing `flow` command group token before dispatching to grouped commands.
- Do not add backward-compatibility code or aliases for old or mistyped command forms.
- If `src/skills/` or preset templates change, run `sdd-forge upgrade` so generated project skills and settings stay synchronized.

## Design Principles
- Correct the instruction source and error guidance rather than expanding the public CLI surface.
- Keep the mistyped command failure explicit and machine-testable.
- Prefer a narrowly scoped dispatcher hint over broad command-suggestion machinery unless more mistyped forms are in scope.

## Overview
### Modules
- `src/flow.js` dispatches `sdd-forge flow <group>` into supported groups such as `get`, `set`, and `run`; this is the entry point that rejects `flow status`.
- `src/flow/registry.js` defines `get.status` as the registered canonical status command.
- Skills, prompts, docs, and help text are instruction sources that can influence agent or user command selection.

### Data Flow
- User or agent input `sdd-forge flow status` reaches the flow dispatcher as group token `status`; the dispatcher rejects it before command registry execution.
- User or agent input `sdd-forge flow get status` reaches group `get` and key `status`, then dispatches to the existing status command unchanged.

### Decisions
- [VERIFY] The canonical status command is registered as `flow get status`; the unsupported mistyped form is rejected as an unknown flow command group.
- Do not add a `flow status` alias.
- Regression coverage must assert both failure and correction text for the mistyped command.
- Impact on existing features: canonical `sdd-forge flow get status` callers see no behavior change; invalid `sdd-forge flow status` remains invalid and only gains correction text.

## Clarifications (Q&A)
- Q: Should `sdd-forge flow status` be supported as an alias?
  - A: No. It remains unsupported; only the error guidance changes.
- Q: Which user-facing argument is being validated?
  - A: The `flow` group token immediately after `sdd-forge flow`. Type: string argv token. Format: one non-empty CLI token without whitespace. Range: supported groups are `get`, `set`, and `run`, plus supported top-level flow commands such as `prepare` and `resume`; for this spec, `status` is invalid and receives targeted correction guidance.

## Alternatives Considered
- Add `sdd-forge flow status` as an alias for `sdd-forge flow get status`. — Rejected because it creates backward-compatibility support for an unsupported command shape during the alpha period.
- Leave the generic unknown-command error unchanged. — Rejected because the known mistyped input has a single canonical correction and the Issue requires explicit guidance.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-20T08:01:45.228Z
- Notes: autoApprove=true; spec gate passed for Issue #338

## Requirements
- R1 [must]: Any instruction-source line changed by this spec that gives the full flow status command must use `sdd-forge flow get status`, not `sdd-forge flow status`.
- R2 [must]: The CLI must not add or register a `flow status` alias; `sdd-forge flow get status` must continue to dispatch through the existing status command.
- R3 [must]: `sdd-forge flow status` must exit non-zero and write a correction that includes `sdd-forge flow get status`.

## Acceptance Criteria
- `sdd-forge flow get status` behavior and JSON envelope remain unchanged for existing callers.
- `sdd-forge flow status` exits non-zero.
- `sdd-forge flow status` stderr includes the canonical command `sdd-forge flow get status`.
- A spec-local test under `specs/264-flow-status-canonical-command/tests/` covers R2 and R3 with `// spec: R<N>` headers.
- Shared dispatcher coverage, if updated, asserts the same failure-and-guidance behavior.

## Implementation Targets
- src/flow.js
- src/flow/registry.js
- src/skills
- .agents/skills
- docs
- tests/e2e/dispatchers.test.js
- specs/264-flow-status-canonical-command/tests

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Audit status guidance
  - Find instruction-source references to the unsupported `sdd-forge flow status` form and ensure full command guidance uses `sdd-forge flow get status`.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Guide mistyped command
  - Keep `flow status` unsupported while making its error output point to `sdd-forge flow get status`.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover command behavior
  - Add regression tests that pin the unsupported mistyped command and the unchanged canonical command path.
  - see `tasks/T-3.md` for full spec
