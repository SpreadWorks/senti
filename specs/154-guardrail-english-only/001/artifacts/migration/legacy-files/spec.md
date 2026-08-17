# Feature Specification: 154-guardrail-english-only

**Feature Branch**: `feature/154-guardrail-english-only`
**Created**: 2026-04-07
**Status**: Draft
**Input**: Issue #106

## Goal

Guardrail files in `src/presets/` are AI constraints, not user-facing documentation. Unify them to English only by removing the per-language directory structure and updating the loading logic to read a single file per preset.

## Scope

- Move `src/presets/<preset>/templates/en/guardrail.json` → `src/presets/<preset>/guardrail.json` for all presets (17 presets total)
- Delete all `src/presets/<preset>/templates/en/guardrail.json` files
- Delete all `src/presets/<preset>/templates/ja/guardrail.json` files
- Simplify `src/lib/guardrail.js`: remove `readWithFallback()` language-branching logic; read from `<preset-dir>/guardrail.json` directly
- Remove the unused `lang` parameter from the preset chain loader

## Out of Scope

- Modifying guardrail content (language unification only; content from `en/guardrail.json` is used as-is)
- Dynamic translation of guardrails when presenting to users
- Guardrail DSL redesign
- Changes to `templates/en/` or `templates/ja/` for other doc templates
- Changes to `.sdd-forge/guardrail.json` (project-level override; path unchanged)
- `sdd-forge setup` / `sdd-forge upgrade` behavior (guardrail files are not deployed to user projects)

## Clarifications (Q&A)

- Q: Do `setup`/`upgrade` deploy guardrail files to projects?
  - A: No. Checked `src/setup.js` and `src/upgrade.js` — no guardrail references. Guardrail files are internal package assets only.

- Q: Should `templates/en/` and `templates/ja/` directories be removed?
  - A: No. These directories contain doc templates for other chapters. Only `guardrail.json` is removed from them.

- Q: What happens to projects with `lang: "ja"` in their config?
  - A: They will now receive English guardrails. This is the intended behavior — guardrails are AI constraints that AI understands regardless of language.

## Alternatives Considered

- **Keep `templates/en/` and always load English**: Simpler code change, but contradicts the issue's stated target path (`src/presets/<preset>/guardrail.json`) and leaves the directory structure misleading.
- **Add `lang: false` config flag to disable multilingual**: Overkill for an alpha-policy removal; adding a flag for a removed feature is backward-compatible code, which is prohibited.

## Why This Approach

The chosen approach (move to `<preset>/guardrail.json`) achieves a clean separation: AI constraint files live at the preset root, human-readable doc templates stay in `templates/<lang>/`. The loading code becomes a simple `fs.existsSync` + `readFileSync` with no language branching. This reduces maintenance surface and eliminates translation drift.

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-07
- Notes: autoApprove mode; gate passed all 15 checks

## Requirements

1. When `sdd-forge flow get guardrail <phase>` is called, it shall load guardrails from `src/presets/<preset>/guardrail.json` (not from `templates/<lang>/guardrail.json`).
2. When the guardrail loader traverses the preset chain, it shall not perform language-based path construction or fallback.
3. The file `src/presets/<preset>/guardrail.json` shall contain the English content from the former `templates/en/guardrail.json` for every preset.
4. No `templates/en/guardrail.json` or `templates/ja/guardrail.json` files shall remain in `src/presets/`.
5. The `lang` parameter shall be removed from the internal preset chain guardrail loader (it is no longer used for guardrail resolution).
6. All existing callers of `loadMergedGuardrails` (`get-guardrail.js`, `run-gate.js`, `run-lint.js`) shall continue to work without modification.

## Acceptance Criteria

- `sdd-forge flow get guardrail draft` returns non-empty markdown with English titles (e.g., "Single Responsibility") for the current project
- `find src/presets -path '*/templates/*/guardrail.json'` returns no results
- `find src/presets -name 'guardrail.json' -not -path '*/templates/*'` returns one file per preset (17 total)
- `sdd-forge flow run gate --phase draft` passes (regression check)
- `npm test` passes (no regressions in existing tests)

## Test Strategy

Spec verification tests placed in `specs/154-guardrail-english-only/tests/` (not run by `npm test`):
- Test that `flow get guardrail draft` returns English content
- Test that no `templates/*/guardrail.json` files exist
- These tests are spec-specific; they confirm this migration is complete and are kept as history

Regression test: run `npm test` to confirm no existing guardrail-related tests break.

## Open Questions

- (none)
