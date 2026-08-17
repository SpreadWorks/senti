# Feature Specification: 262-rename-skill-data-dirs

**Feature Branch**: `feature/262-rename-skill-data-dirs`
**Created**: 2026-05-20
**Status**: Draft
**Input**: GitHub Issue #333

## Goal
skill source asset と common DataSource の実体に合わせて `src/` と `experimental/workflow/` のディレクトリ名を整理し、参照する production code、tests、generated skills、project guidance を新しい配置へ追従させる。

## Background
`src/templates/` no longer contains overridable preset templates. It contains bundled skill sources, skill partials, and `rules.json`. Separately, common DataSource modules under `src/docs/data/` are no longer docs-only because skill build paths also use DataSource-backed content such as rules. This mismatch makes package structure and extension points harder to read. Issue #333 requests a pure rename/re-home pass: move these directories to names that match their roles, update all references, and avoid mechanism changes.

## Scope
- [must] `src/templates/skills/` 配下の bundled skill source と `rules.json` を `src/skills/` へ移動する。
- [must] `src/templates/partials/` 配下の shared skill partial を `src/skills/partials/` へ移動する。
- [must] `src/docs/data/` 配下の common DataSource 実装を `src/data/` へ移動する。
- [must] `experimental/workflow/templates/skills/` 配下の experimental workflow skill source を `experimental/workflow/skills/` へ移動する。
- [must] `src/lib/skills.js`、`src/lib/include.js`、`src/upgrade.js`、`src/docs/lib/resolver-factory.js`、DataSource import 参照を新 path と `@skills/` include namespace に更新する。
- [should] tests under `tests/unit/templates/`, `tests/unit/flow/`, `tests/unit/lib/include.test.js`, `tests/unit/presets/preset-scan-integrity.test.js`, `tests/unit/docs/lib/layout-and-nav.test.js`, and `tests/e2e/051-skill-namespace.test.js` を新 path に追従させる。
- [should] `AGENTS.md` と `src/presets/base/templates/*/AGENTS.sdd.md` の literal `src/templates/` guidance を `src/skills/` に変更し、同じ文内の `src/presets/` guidance は維持する。`src/CLAUDE.md` の literal `src/templates/` があれば同じ基準で変更し、preset 内部構造の `templates/` 説明は維持する。
- [should] `sdd-forge upgrade` を実行し、`.agents/skills/sdd-forge.flow/SKILL.md` と `.claude/skills/sdd-forge.flow/SKILL.md` が生成され、生成後の SKILL.md 内に raw `@templates/` include directive が残らないことを確認する。

## Out of Scope
- DataSource / skill build 機構の振る舞い変更。
- skill 本文や partial 本文の責務変更。
- preset template 継承機構の再設計。
- user-facing CLI command または option の追加・削除・意味変更。
- npm publish / npm dist-tag 操作。

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールと既存 project helper だけを使用する。
- alpha 版方針に従い、旧 `src/templates/` / `src/docs/data/` path や `@templates/` include alias の互換 layer は追加しない。
- `src/` 配下に Issue #333 固有の番号、URL、作業者環境 path、project-local absolute path を固定値として入れない。
- `resolveIncludes` の既存 resource bounds である maximum include depth 8 と maximum include count 32 は維持する。
- No user-facing CLI commands or options change. `sdd-forge upgrade` success remains exit code 0; invalid config, invalid preset chain, include expansion failure, or filesystem write failure continue to return non-zero through existing error paths.
- DataSource loader behavior must remain source-compatible after the directory move: common sources are loaded from the new package path before preset-local `data/` directories are layered.
- Generated skill content may change only where path/include directive expansion changes the generated source; raw include directive lines must not appear in generated SKILL.md files.
- Because this is an internal package layout rename, backward-compatible-cli-interface is not triggered for CLI users; the intentionally removed internal alias is covered by the alpha policy constraint above.

## Design Principles
- Use names that describe distributed assets: `src/skills/` for bundled skills and skill partials, `src/data/` for common DataSource implementations.
- Keep path moves mechanical and avoid changing skill text, partial responsibilities, DataSource semantics, or preset template inheritance.
- Prefer one canonical path per concept during alpha; remove old internal aliases instead of carrying compatibility branches.
- Make generated artifacts prove the new path works by running upgrade after template/skill source changes.

## Overview
### Modules
- `src/skills/` becomes the package directory for bundled `sdd-forge.*` skill source directories, `rules.json`, and shared skill partial markdown.
- `src/data/` becomes the package directory for common DataSource modules previously under `src/docs/data/`.
- `experimental/workflow/skills/` becomes the opt-in experimental workflow skill source directory consumed by `sdd-forge upgrade`.
- `src/lib/skills.js` owns skill deployment constants and include resolution context for bundled and project skill sources.
- `src/lib/include.js` owns include namespace resolution and must recognize `@skills/` for skill partials without retaining `@templates/`.
- `src/docs/lib/resolver-factory.js` owns common DataSource loading before preset-local `data/` overlays.

### Data Flow
- `sdd-forge upgrade` reads bundled skills from `src/skills/`, expands `@skills/partials/*.md`, expands skill rules, strips data markers, and writes `.agents/skills/*/SKILL.md` plus `.claude/skills/*/SKILL.md`.
- When experimental workflow is enabled, `sdd-forge upgrade` reads extra skill sources from `experimental/workflow/skills/` and includes them in obsolete-skill cleanup source directories.
- Docs rendering builds resolver maps from `src/data/` first, then overlays preset-local `data/` directories in the existing preset-chain order.
- Tests and docs references resolve paths through the new canonical directories; no test or production reference should require `src/templates/` or `src/docs/data/` after implementation.

### Decisions
- [VERIFY] Bundled skills currently deploy from `src/templates/skills/`.
- [VERIFY] Existing skill partial includes use `@templates/partials/*.md`.
- [VERIFY] Common DataSource loading is tied to the old docs path.
- [VERIFY] Experimental workflow skill deployment uses a templates wrapper.
- [VERIFY] The repo contains no general template files under `src/templates/` outside skills and partials.
- Use `src/skills/partials/` for shared partials.
- Rename the include namespace to `@skills/` and remove `@templates/`.
- Rename `MAIN_SKILLS_TEMPLATES_DIR` to `MAIN_SKILLS_DIR`.

## Clarifications (Q&A)
- Q: Where should the moved skill partials live?
  - A: `src/skills/partials/`. Issue #333 proposed this path, and current partials are only consumed by skill source files.
- Q: Should `@templates/` remain as a compatibility alias?
  - A: No. This is an alpha-period internal layout rename, so old internal aliases are removed rather than preserved.
- Q: Does this change any user-facing CLI command or option?
  - A: No. Existing commands such as `sdd-forge upgrade` keep their arguments and exit-code contracts; only internal source paths and generated content sources change.
- Q: What distinguishes docs guidance updates from preset template references?
  - A: Literal `src/templates/` guidance is changed to `src/skills/`. References to `src/presets/` or preset-internal `templates/` directories remain unchanged because those are still true preset templates.
- Q: What is the success condition for upgrade verification?
  - A: `sdd-forge upgrade` exits 0, writes generated skill files for both `.agents` and `.claude`, and generated SKILL.md files do not contain raw include directives using `@templates/`.

## Alternatives Considered
- Move partials to `src/partials/`. — Rejected because current partials are skill-only shared content; placing them under `src/skills/partials/` keeps the shared content near the skill source root without expanding scope.
- Retain `@templates/` as a compatibility alias. — Rejected under the alpha policy because old internal names should not remain after a canonical rename.
- Leave common DataSource modules under `src/docs/data/` and only rename skill sources. — Rejected because DataSource is now a cross-cutting package concept used beyond docs-only generation.
- Only update production code and leave test names/doc guidance stale. — Rejected because stale test and guidance labels would keep presenting the old structure as canonical.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-20T01:42:59.888Z
- Notes: autoApprove: selected approval option 1 after spec gate PASS for issue #333

## Requirements
- R1 [must]: All files under `src/templates/skills/` and `src/templates/skills/rules.json` must move to `src/skills/` with the same skill directory names and file contents except for required path/include directive updates.
- R2 [must]: All files under `src/templates/partials/` must move to `src/skills/partials/`, and bundled skill source files must reference them through `@skills/partials/*.md`; no `@templates/` include directive may remain under `src/skills/`.
- R3 [must]: All files under `src/docs/data/` must move to `src/data/`, and production/test imports or path constants that target common DataSource modules must resolve the new directory.
- R4 [must]: All files under `experimental/workflow/templates/skills/` must move to `experimental/workflow/skills/`, and experimental workflow deployment must use that new path when workflow experimental mode is enabled.
- R5 [must]: `src/lib/skills.js`, `src/lib/include.js`, `src/upgrade.js`, `src/docs/lib/resolver-factory.js`, and all DataSource import references must use `src/skills/`, `src/skills/partials/`, `src/data/`, `experimental/workflow/skills/`, `@skills/`, and `MAIN_SKILLS_DIR`; no production code path may require `src/templates/skills`, `src/templates/partials`, `src/docs/data`, `experimental/workflow/templates/skills`, `@templates/`, or `MAIN_SKILLS_TEMPLATES_DIR`.
- R6 [should]: Existing unit and e2e tests that mention the moved paths must be updated to the new paths and names, and spec-local tests under `specs/262-rename-skill-data-dirs/tests/` must cover the path contracts for skills, partial includes, DataSource loading, experimental workflow skills, and upgrade output.
- R7 [should]: `AGENTS.md` and `src/presets/base/templates/*/AGENTS.sdd.md` must replace literal `src/templates/` guidance with `src/skills/` while preserving `src/presets/`; `src/CLAUDE.md` must change only literal `src/templates/` references if present and must preserve preset-internal `templates/` explanations.
- R8 [should]: `sdd-forge upgrade` must exit 0 after the rename, generate `.agents/skills/sdd-forge.flow/SKILL.md` and `.claude/skills/sdd-forge.flow/SKILL.md`, and the generated SKILL.md files must contain no raw `@templates/` include directive.

## Acceptance Criteria
- `rg --files src/templates` returns no files because the wrapper directory is removed after migration.
- `rg --files src/skills` lists the previous bundled skill directories, `rules.json`, and `partials/*.md`.
- `rg -n "@templates/|MAIN_SKILLS_TEMPLATES_DIR|src/templates/skills|src/templates/partials|experimental/workflow/templates/skills|src/docs/data" src experimental tests AGENTS.md src/CLAUDE.md` returns no stale production/test/guidance references except preset-internal `templates/` explanations that do not include `src/templates/`.
- `src/lib/include.js` resolves `@skills/partials/<name>` to the new skill partial directory and does not resolve `@templates/` as a compatibility alias.
- `src/docs/lib/resolver-factory.js` loads common DataSource modules from `src/data/` before preset-local `data/` overlays.
- `src/upgrade.js` uses `src/skills/` for bundled skills and `experimental/workflow/skills/` for experimental workflow skills.
- `sdd-forge upgrade` exits 0 and generated `.agents/skills/sdd-forge.flow/SKILL.md` plus `.claude/skills/sdd-forge.flow/SKILL.md` contain no raw `@templates/` directive.
- `node tests/run.js --scope unit`, `node tests/run.js --scope e2e`, and `npm test` exit 0.

## Implementation Targets
- src/skills/
- src/data/
- src/lib/skills.js
- src/lib/include.js
- src/upgrade.js
- src/docs/lib/resolver-factory.js
- experimental/workflow/skills/
- tests/unit/templates/
- tests/unit/flow/
- tests/unit/lib/include.test.js
- tests/unit/presets/preset-scan-integrity.test.js
- tests/unit/docs/lib/layout-and-nav.test.js
- tests/e2e/051-skill-namespace.test.js
- AGENTS.md
- src/presets/base/templates/en/AGENTS.sdd.md
- src/presets/base/templates/ja/AGENTS.sdd.md

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Move skill sources
  - Move bundled and experimental skill source directories to their new canonical locations.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Move DataSources
  - Move common DataSource modules from docs-owned naming to the package-level `src/data/` directory.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update path consumers
  - Update production code that deploys skills, resolves includes, loads DataSources, and discovers experimental workflow skills.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Refresh references
  - Update tests, project guidance, and generated skill artifacts so they describe and consume the new canonical paths.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Add spec coverage
  - Add spec-local tests that prove the new directory contracts and stale-reference removals.
  - see `tasks/T-5.md` for full spec
