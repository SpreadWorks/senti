# Feature Specification: 289-migration-parity-guardrail

**Feature Branch**: `feature/289-migration-parity-guardrail`
**Created**: 2026-06-11
**Status**: Draft
**Input**: GitHub Issue #379

## Goal
Add a generic `migration-parity` guardrail to the base preset so migration-related changes must specify behavior parity before implementation.

## Background
Issue #379 requests a base guardrail for migration-related changes. Existing base guardrails require impact awareness and diff-verifiable requirements, but none explicitly require an inventory, ownership mapping, and behavior-level verification when existing public behavior is moved or replaced. This change adds that missing process rule as generic base preset data.

## Scope
- Add exactly one `migration-parity` entry to `src/presets/base/guardrail.json`.
- Give the entry title `Migration Parity`, phase `["draft", "spec"]`, and category `process`.
- Write guardrail body text that applies to changes that move, split, extract, replace, or externalize existing behavior.
- Include body clauses for existing behavior inventory, affected public surfaces, retained-behavior ownership mapping, retained-behavior acceptance criteria, behavior-level verification, insufficiency of registration/discovery/help/mock-routing-only evidence, and explicit removal impact statements.
- Apply the base guardrail rewrite rubric by including a named violation, diff-verification conditions, and blocking/advisory severity policy in the guardrail body.
- Add spec-local and project regression tests that prove the guardrail metadata, phase filtering, body concepts, generic wording, and representative pre-existing base guardrails.
- Run `senti upgrade` after the base preset source changes.

## Out of Scope
- Do not include workflow plugin-specific background, board item identifiers, or repository-specific migration history in `src/` guardrail text.
- Do not apply `migration-parity` to `task-impl` in this change.
- Do not change guardrail loader, merger, or phase filtering semantics.
- Do not add external dependencies.

## Constraints
- Use only Node.js built-in modules and existing project helpers; no external dependencies.
- Changing `src/presets/base/guardrail.json` requires running `senti upgrade` before finalization.
- Guardrail text under `src/` must be generic package content and must not mention workflow plugin, board item ids, Issue #379, this repository's migration history, or local environment paths.
- The guardrail body must contain at least one named violation, a `Diff-verification conditions` section, and both `Blocking when` and `Advisory when` severity-policy clauses.
- Spec-local tests must live under `specs/289-migration-parity-guardrail/tests/` and include `// spec: R<N>` headers.

## Design Principles
- Represent this as a base process guardrail because it affects how specs are written before migration-like implementation starts.
- Keep the body strict enough for gate/review evaluation but generic enough to apply outside the original workflow plugin migration context.
- Test the guardrail as preset data consumed by the existing guardrail loader; do not add loader code for a data-only rule.

## Overview
### Modules
- `src/presets/base/guardrail.json` is the core base preset guardrail source consumed by `src/lib/guardrail.js`.
- `tests/unit/presets/base/req-diff-verifiability-guardrail.test.js` is an existing base guardrail metadata and phase-filter regression pattern.
- `src/presets/base/guardrail-rewrite-rubric.md` defines the named violation, diff-verification, and severity-policy style expected for broad guardrails.

### Data Flow
- The base preset JSON entry is loaded by the existing guardrail loader and filtered by phase for draft and spec checks.
- Project regression tests read `src/presets/base/guardrail.json` and use `filterByPhase` to verify draft/spec inclusion and task-impl exclusion.
- `senti upgrade` deploys changed preset or skill/config artifacts after the source preset changes.

### Decisions
- [VERIFY] checked base guardrail source; result=match with data-only change.
- [VERIFY] checked guardrail loader; result=match with no loader change needed.
- [VERIFY] checked base guardrail tests; result=match with reusable test pattern.
- Use draft/spec phases only.
- Include rewrite-rubric structure in the body.

## Clarifications (Q&A)
- Q: Should the guardrail apply during implementation?
  - A: No. Issue #379 and draft approval exclude `task-impl`; the rule is for draft/spec parity definition before implementation.
- Q: Does this change require guardrail loader changes?
  - A: No. Existing loader behavior supports a new data entry with valid phase and category metadata.

## Alternatives Considered
- Add the guardrail only to a workflow/plugin preset. — Rejected because Issue #379 identifies the rule as generic migration parity guidance for base, not workflow-specific behavior.
- Use the short proposed body without rewrite-rubric sections. — Rejected because base guardrail updates must follow the guardrail rewrite rubric for named violation, diff-verification conditions, and severity policy.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-11T16:04:05.850Z
- Notes: auto-approved after spec-gate PASS for Issue #379

## Requirements
- R1 [must]: `src/presets/base/guardrail.json` must contain exactly one guardrail with id `migration-parity`, title `Migration Parity`, `meta.phase` equal to `["draft", "spec"]`, and `meta.category` equal to `process`.
- R2 [must]: The `migration-parity` body must state that changes moving, splitting, extracting, replacing, or externalizing existing behavior require migration parity before implementation; it must require existing public behavior inventory, affected public surface listing, retained-behavior owner mapping or explicit removal decision, acceptance criteria for retained behavior, at least one behavior-level verification per retained public surface, and explicit user-visible impact for intentional removals.
- R3 [must]: The `migration-parity` body must state that registration, discovery, help output, or mock routing alone is insufficient evidence, and it must include the literal section labels `Violation:`, `Diff-verification conditions:`, `Blocking when:`, and `Advisory when:`.
- R4 [must]: Tests must verify the new guardrail exists, has draft/spec phase inclusion, has task-impl exclusion, uses category `process`, contains the R2 and R3 body concepts, contains no workflow plugin or board item wording, and preserves representative pre-existing base guardrail ids.
- R5 [must]: After modifying `src/presets/base/guardrail.json`, `senti upgrade` must be executed and its resulting artifact changes or no-change evidence must be present in the flow artifacts.

## Acceptance Criteria
- AC1: `src/presets/base/guardrail.json` contains exactly one `migration-parity` entry with title `Migration Parity`, phase `["draft", "spec"]`, and category `process`.
- AC2: The new body includes the migration trigger verbs `moves`, `splits`, `extracts`, `replaces`, and `externalizes` or their grammatical equivalents.
- AC3: The new body requires inventory, public surface listing, owner/removal mapping, retained-behavior acceptance criteria, behavior-level verification per retained public surface, insufficiency of registration/discovery/help/mock-routing-only evidence, and user-visible removal impact.
- AC4: The new body includes `Violation:`, `Diff-verification conditions:`, `Blocking when:`, and `Advisory when:`.
- AC5: The new body does not include `workflow plugin`, `board item`, `Issue #379`, or `b443`.
- AC6: `filterByPhase(entries, "draft")` and `filterByPhase(entries, "spec")` include `migration-parity`; `filterByPhase(entries, "task-impl")` excludes it.
- AC7: Tests verify representative pre-existing base guardrail ids remain present.
- AC8: `senti upgrade` is run after the preset source edit and the flow contains its upgrade evidence artifact.

## Implementation Targets
- src/presets/base/guardrail.json
- tests/unit/presets/base/
- specs/289-migration-parity-guardrail/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add migration-parity guardrail
  - Add the new base preset guardrail entry with the requested metadata and rubric-structured body.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add guardrail tests
  - Add tests that prove the new guardrail metadata, phase filtering, body concepts, generic wording, and base guardrail regression coverage.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Run preset upgrade
  - Run `senti upgrade` after preset source changes and preserve the resulting evidence for gate verification.
  - see `tasks/T-3.md` for full spec
