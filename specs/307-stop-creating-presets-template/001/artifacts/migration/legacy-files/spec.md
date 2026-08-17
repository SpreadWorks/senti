# Feature Specification: 307-stop-creating-presets-template

**Feature Branch**: `feature/307-stop-creating-presets-template`
**Created**: 2026-06-18
**Status**: Draft
**Input**: GitHub Issue #401

## Goal
Stop `senti upgrade` from generating unused project-local `.senti/templates/<lang>/docs/creating_presets.md` files while preserving base preset managed-copy syncing.

## Background
Issue #401 identifies a mismatch between `deployPresetCopies()` generated outputs and base preset chapters. The helper currently creates a project-local `creating_presets.md` file for every configured language, but the base preset does not include that chapter. Existing validation then warns that the generated file is not listed in chapters. The fix is to remove that generated project-local template side effect while keeping the base preset guardrail managed copies that standard upgrade still needs.

## Scope
- Remove automatic creation or update of `.senti/templates/<lang>/docs/creating_presets.md` from the `deployPresetCopies()` upgrade path.
- Preserve managed-copy syncing from `src/presets/base/guardrail.json` to `.senti/presets/base/guardrail.json`.
- Preserve managed-copy syncing from `src/presets/base/guardrail-rewrite-rubric.md` to `.senti/presets/base/guardrail-rewrite-rubric.md`.
- Restrict guardrail rewrite rubric managed-copy behavior to the base preset copy path.
- Prevent full `senti upgrade` rename migration from modifying existing `.senti/templates/*/docs/creating_presets.md` files.
- Add spec-local regression coverage for `deployPresetCopies()` generation targets and user-owned `creating_presets.md` handling.

## Out of Scope
- Do not change `creating_presets.md` content in `docs/` or any packaged preset documentation.
- Do not change `guardrail-rewrite-rubric.md` content.
- Do not change preset chapter validation semantics.
- Do not add external dependencies.
- Do not publish npm packages or change npm dist-tags.

## Constraints
- Use only Node.js built-in modules and existing project helpers.
- `src/` code must remain generic package code and must not contain project-specific paths or assumptions.
- Existing project-local `.senti/templates/*/docs/creating_presets.md` files are user-owned; upgrade must not overwrite, append to, delete, or otherwise manage them.
- Spec-local tests must live under `specs/307-stop-creating-presets-template/tests/` and include `// spec: R<N>` headers.
- Because this spec is expected to modify `src/lib` and spec-local tests only, `senti upgrade` is not required unless implementation changes `src/skills/`, `src/presets/`, or preset template sources.

## Design Principles
- Fix the generated target set instead of suppressing validation warnings.
- Keep `deployPresetCopies()` as the owner for base preset managed copies.
- Treat project-local documentation templates as user-owned customization points once they exist.

## Overview
### Modules
- `src/lib/preset-deploy.js` owns copying packaged preset artifacts into `.senti/presets/<key>/` and currently also appends rubric guidance into project-local `.senti/templates/<lang>/docs/creating_presets.md`.
- `src/upgrade.js` calls `deployPresetCopies(root, { presetKeys: ["base"], languages })` during non-dry-run upgrade.
- `src/upgrade.js` also runs `RenameMigration` before preset copy deployment; that migration is a second upgrade write path for text files.
- `src/presets/base/preset.json` defines the base chapters as `overview.md`, `stack_and_ops.md`, `project_structure.md`, and `development.md`; `creating_presets.md` is not a base chapter.
- `src/lib/presets.js` validation warns about project-local docs templates that are not included in effective chapters; that behavior stays unchanged.

### Data Flow
- `senti upgrade` resolves configured docs languages, then calls `deployPresetCopies()` for the base preset.
- After this change, `deployPresetCopies()` writes only managed preset copies for the requested base preset artifacts and returns only those written paths.
- Project-local `.senti/templates/<lang>/docs/creating_presets.md` files remain outside both the preset-copy write path and rename-migration text rewrite path, so validation can no longer report that file due to a newly generated or modified upgrade artifact.

### Decisions
- [VERIFY] checked `deployPresetCopies()`; result=match with reported bug.
- [VERIFY] checked base chapters; result=match with validation warning cause.
- [VERIFY] checked upgrade call site; result=match with standard upgrade surface.
- [VERIFY] checked rename migration; result=match with second write path.
- [CORRECTION] remove project-local template generation from the managed-copy helper.
- [VERIFY] migration parity inventory and mapping.

## Clarifications (Q&A)
- Q: Should existing project-local `creating_presets.md` files be deleted by upgrade?
  - A: No. Existing project-local files are user-owned and must remain unchanged.
- Q: Should the validation warning be suppressed instead?
  - A: No. The Issue marks preset chapter validation changes as out of scope; the generated target set must be corrected.
- Q: Is `senti upgrade` required for this implementation?
  - A: Only if implementation changes `src/skills/`, `src/presets/`, or preset template sources. The planned change is in `src/lib/preset-deploy.js` and spec-local tests.

## Alternatives Considered
- Keep generating project-local `creating_presets.md` and suppress the validation warning. — Rejected because it changes preset chapter validation semantics, which Issue #401 lists as out of scope.
- Move `creating_presets.md` into base preset chapters. — Rejected because the Issue does not request a new base documentation chapter and explicitly excludes improving `creating_presets.md` content.
- Continue appending rubric notes to existing project-local `creating_presets.md` files only. — Rejected because Issue #401 requires existing project-local files to be excluded from automatic updates.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-18T16:29:22.398Z
- Notes: auto-approved after spec-gate PASS for Issue #401

## Requirements
- R1 [must]: `deployPresetCopies(workRoot, { presetKeys: ["base"], languages })` must not create, update, or return `.senti/templates/<lang>/docs/creating_presets.md` for any configured language.
- R2 [must]: If `.senti/templates/<lang>/docs/creating_presets.md` already exists before full `senti upgrade` or `deployPresetCopies()` runs, its file contents must remain unchanged after the operation, including when legacy rename tokens are present.
- R3 [must]: `deployPresetCopies(workRoot, { presetKeys: ["base"] })` must continue to create or update `.senti/presets/base/guardrail.json` with content equal to `src/presets/base/guardrail.json`.
- R4 [must]: `deployPresetCopies(workRoot, { presetKeys: ["base"] })` must continue to create or update `.senti/presets/base/guardrail-rewrite-rubric.md` with content equal to `src/presets/base/guardrail-rewrite-rubric.md`.
- R5 [should]: `deployPresetCopies()` must not copy `guardrail-rewrite-rubric.md` for non-base preset keys; the only rubric managed copy path in this change is `.senti/presets/base/guardrail-rewrite-rubric.md`.
- R6 [must]: Regression tests must prove R1 through R5 using spec-local coverage under `specs/307-stop-creating-presets-template/tests/`.

## Acceptance Criteria
- AC1: A fresh temporary project calling `deployPresetCopies(tmp, { presetKeys: ["base"], languages: ["ja", "en"] })` has no `.senti/templates/ja/docs/creating_presets.md` and no `.senti/templates/en/docs/creating_presets.md` after the call.
- AC2: The result array from that call contains `.senti/presets/base/guardrail.json` and `.senti/presets/base/guardrail-rewrite-rubric.md`, and contains no path ending in `templates/<lang>/docs/creating_presets.md`.
- AC3: The generated `.senti/presets/base/guardrail.json` content equals `src/presets/base/guardrail.json`.
- AC4: The generated `.senti/presets/base/guardrail-rewrite-rubric.md` content equals `src/presets/base/guardrail-rewrite-rubric.md`.
- AC5: A pre-existing `.senti/templates/ja/docs/creating_presets.md` file keeps exactly the same content after `deployPresetCopies()` runs.
- AC6: A non-base preset key with a `guardrail-rewrite-rubric.md` fixture or mock source does not produce a `.senti/presets/<non-base>/guardrail-rewrite-rubric.md` managed copy.
- AC7: A pre-existing `.senti/templates/ja/docs/creating_presets.md` file containing a legacy rename token keeps exactly the same content after `RenameMigration` or full upgrade migration runs.
- AC8: No tests or production code change preset chapter validation semantics.

## Implementation Targets
- src/lib/preset-deploy.js
- src/upgrade.js
- specs/307-stop-creating-presets-template/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Update preset copy targets
  - Change `deployPresetCopies()` so it only manages base preset copy outputs needed by upgrade and no longer manages project-local `creating_presets.md` files.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add deploy regression tests
  - Add spec-local tests that verify the exact generated target set and user-owned `creating_presets.md` behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Skip user template migration
  - Change the upgrade rename migration path so existing project-local `creating_presets.md` files are not rewritten during full `senti upgrade`.
  - see `tasks/T-3.md` for full spec
