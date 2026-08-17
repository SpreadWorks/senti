# Feature Specification: 276-metric-phase-guidance

**Feature Branch**: `feature/276-metric-phase-guidance`
**Created**: 2026-06-04
**Status**: Draft
**Input**: GitHub Issue #356

## Goal
SDD flow の metric recording 手順が、CLI の受け付ける phase identifier と一致するようにする。

## Background
Issue #356 reports that the SDD flow metric recording procedure can tell users to run `flow set metric plan srcRead`, but the CLI rejects `plan` with `INVALID_PHASE`. The CLI phase contract already includes `draft` for planning/draft work, so the bug is in the guidance rather than in the command validator.

Impact on existing features: this change affects the SDD flow skill guidance and generated skill artifacts only. Existing `flow set metric` validation, metric storage, counters, metrics aggregation, and exit behavior remain unchanged.

## Scope
- `sdd-forge.flow` skill source の metric recording guidance
- `sdd-forge upgrade` によって更新される生成済み skill/settings artifacts
- metric recording guidance と `flow set metric` phase validation contract を検証する spec-local tests

## Out of Scope
- `plan` を `flow set metric` の accepted phase に追加すること
- metric storage shape、metric counters、metrics aggregation の変更
- gate/review/implementation phase identifiers の再設計

## Constraints
- Alpha policy に従い、invalid phase である `plan` の互換 alias は追加しない。
- `src/skills/` の skill source を変更した場合は `sdd-forge upgrade` を実行し、生成済み skill/settings に反映する。
- `flow set metric` の user-facing argument contract は維持する。第1引数の phase は `VALID_PHASES` の値のみを受け付け、`plan` は invalid phase のままとする。

## Design Principles
- Procedure text should name command arguments that the CLI accepts.
- Fix the guidance mismatch at the source of user-facing instructions rather than widening the CLI contract.

## Overview
### Modules
- `src/skills/sdd-forge.flow/SKILL.md` owns the SDD flow skill guidance, including metric recording instructions for direct file reads.
- `src/lib/constants.js` owns `VALID_PHASES`; `src/flow/lib/set-metric.js` validates `flow set metric <phase> <counter>` against that list.
- `sdd-forge upgrade` propagates changed skill source files into generated project skill artifacts.

### Data Flow
- Users read files directly during a flow, consult `sdd-forge.flow` metric guidance, then run `sdd-forge flow set metric <phase> <counter>`; the command validates phase through `VALID_PHASES` before appending flow metrics.

### Decisions
- [VERIFY] Checked metric phase validation: `draft` is accepted and `plan` is not.
- Do not add a `plan` compatibility phase.
- Include generated skill updates in scope after source guidance changes.
- Impact on existing features: only SDD flow metric recording guidance changes; `flow set metric` validation, metric storage, counters, and aggregation behavior remain unchanged.

## Clarifications (Q&A)
- Q: Should this spec add `plan` as a metric phase alias?
  - A: No. The issue is a guidance mismatch, and alpha policy avoids keeping invalid command forms alive.
- Q: Should generated skill artifacts be updated?
  - A: Yes. Skill source changes under `src/skills/` must be followed by `sdd-forge upgrade`.

## Alternatives Considered
- Add `plan` to `VALID_PHASES` as an alias for draft metrics — Rejected because it expands the CLI contract to preserve an invalid procedure example, while the project alpha policy favors correcting the guidance.
- Update only `src/skills/sdd-forge.flow/SKILL.md` — Rejected because generated skill artifacts would remain stale until upgrade, leaving the operational guidance unchanged for users.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-04T12:39:56.001Z
- Notes: User selected option 1 to approve the gate-passed spec.

## Requirements
- R1 [must]: `sdd-forge.flow` metric recording guidance for direct docs/src reads must use only `VALID_PHASES` values as `flow set metric` phase examples; for planning/draft work it must show `draft`, and it must not present status-derived phase names such as `plan` or `finalize` as metric phases.
- R2 [must]: After changing the skill source, generated project skill artifacts must be refreshed so the installed `sdd-forge.flow` guidance contains the corrected metric phase guidance.
- R3 [must]: `flow set metric` CLI phase validation must remain unchanged for this bugfix: `draft` is accepted for metric recording and `plan` remains rejected with `INVALID_PHASE`.

## Acceptance Criteria
- `src/skills/sdd-forge.flow/SKILL.md` no longer tells users to use status-derived phase names such as `plan` or `finalize` as metric phases and shows `draft` for planning/draft metric recording.
- Generated `sdd-forge.flow` skill artifact(s) produced by `sdd-forge upgrade` contain the same corrected guidance.
- A spec-local test verifies that the guidance files do not present `plan` or `finalize` as metric phase examples and do not contain `flow set metric plan docsRead`, `flow set metric plan srcRead`, `flow set metric finalize docsRead`, or `flow set metric finalize srcRead` examples.
- A spec-local test verifies `sdd-forge flow set metric draft srcRead` succeeds in an active flow context while `sdd-forge flow set metric plan srcRead` fails with `INVALID_PHASE`.

## Implementation Targets
- src/skills/sdd-forge.flow/SKILL.md
- .agents/skills/sdd-forge.flow/SKILL.md
- specs/276-metric-phase-guidance/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Correct metric guidance
  - Update SDD flow metric recording guidance so direct file-read examples use an accepted metric phase and no longer suggest `plan`.
  - see `tasks/T-1.md` for full spec
