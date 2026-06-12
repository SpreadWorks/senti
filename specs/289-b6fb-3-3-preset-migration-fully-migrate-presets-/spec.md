# Feature Specification: 289-b6fb-3-3-preset-migration-fully-migrate-presets-

**Feature Branch**: `feature/289-b6fb-3-3-preset-migration-fully-migrate-presets-`
**Created**: 2026-06-11
**Status**: Draft
**Input**: GitHub Issue #377

## Goal
base 以外の official preset を main package 内部依存から外し、main repo を builtin base preset と plugin preset loader / resolver / contract tests に限定する。

## Background
The main repo currently contains builtin base preset content, bundled official preset plugin content, resolver fallback logic, direct test discovery for non-base preset tests, and helper imports from preset internals. Issue #377 narrows the main repo responsibility to builtin base plus plugin preset contracts. Existing projects still need a migration path because non-base `type` values, missing plugin packages, and legacy project-local presets otherwise break after removing bundled official content.

## Scope
- main package builtin preset を `base` に限定し、base 以外の official preset 名や directory 構造への runtime / source / test 依存を排除する。
- plugin preset loader / registry / resolver が enabled plugin presets を main repo runtime の正規入力として扱う。
- `senti upgrade` が non-base `type` と incomplete `plugin.packages` を検出し、`plugin.sources[]` から provider と parent chain を補完する。
- `senti upgrade` が既存 project migration plan として official default source 追加、provider plugin install / enable、旧 `.senti/presets/<key>` の local plugin source / package 化を扱う。
- `@presets/<key>/...` include、locale、AGENTS template 参照が resolved preset chain / plugin preset dir から解決できる。
- preset DataSource が使う shared helper を public container API として提供し、plugin preset が main package internal path を import しなくても利用できる。
- main repo tests を plugin preset foundation の contract tests に整理し、non-base official preset 詳細 tests を main repo discovery から外す。
- official preset 名を implementation condition や main repo fixture expectation から排除し、generic fixture 名を使う。
- project-local preset は `.senti/presets/<key>` leaf override として残さず、local plugin source / enabled package 経由の provider として扱う。

## Out of Scope
- general editor completion、alias map generation、IDE link navigation の改善は今回の scope 外。
- npm plugin source type の実装は今回の scope 外。初期実装は git / local source のみ対象。
- workflow plugin の explicit install policy は今回の scope 外。official presets bootstrap とは分ける。
- external `senti-presets` repository 側の preset source / detailed tests / helper harness の実移動は今回の flow の直接完了条件外。
- 実装完了後の docs rebuild/sync は今回の flow の scope 外。必要性は follow-up として扱う。
- 過去 specs、reports、generated docs、user config examples に残る actual preset key の履歴修正は今回の必須 scope 外。

## Constraints
- `src/` は npm package として全ユーザーに配布されるため、特定 project の構造や固有値を含めない。
- 外部依存は禁止。plugin source lookup、manifest validation、include resolution、test runner 変更は Node.js built-in modules だけで実装する。
- alpha 版ポリシーにより、旧 `plugin.repos` / `packages[].repo` 形式の互換拡張は追加しない。既存 migration がある場合も spec では新 schema を正とする。
- shared helper は plugin preset 向け public container API に置き、plugin preset が main package internal path を import する設計にしない。
- `src/skills/`、`src/presets/`、`src/presets/base/templates/` 等を変更した場合は `senti upgrade` を実行して反映差分を確認する。
- CLI command 名は維持する。`backward-compatible-cli-interface` に対して、既存 project migration は `senti upgrade` に集約し、移行不能な状態だけ non-zero failure とする。
- Official default source descriptor: id=`official-presets`, type=`git`, remote=`git@github.com:SpreadWorks/senti-presets.git`. Tests may substitute this source with an explicit local fixture source using the same provider manifest shape; production code must not rely on `src/official-plugins/senti-presets`.
- CLI failure conditions: provider not found、unsupported source type、unsafe local source、unmaterializable plugin package、旧 `.senti/presets/<key>` migration failure は command failure とし、non-zero exit code と検証可能な error message を返す。
- User-facing input validation: git source は HTTPS / SSH URL / `git@github.com:org/repo.git` 形式を許可し、local source path は project-root-relative のみ許可し、absolute path、`..`、symlink、root 外参照を拒否する。
- User-facing `senti upgrade` arguments remain `--dry-run` and `--help`, both boolean flags with no value. Plugin source descriptors are config inputs read at upgrade entry: `sources[].id` must be path-safe single segment, `type` must be `git` or `local`, `remote` is required for git, `path` is required for local, and `ref` is an optional git ref string.
- Bounded resource usage: provider completion checks at most 100 configured sources, at most 100 enabled packages, and at most 16 preset parent-chain entries per selected type. Include expansion keeps existing max include depth 8 and max include count 32. Template/locale/AGENTS chain search uses the same max chain depth 16 and does not scan plugin directories outside enabled registry entries.

## Design Principles
- main package は builtin base と plugin contract を提供し、actual official preset content は enabled plugin package から取得する。
- enabled preset registry を唯一の runtime resolution surface とし、installed plugin directories の broad search を避ける。
- migration は `senti upgrade` に寄せ、通常の docs/build/scan path は補完済み config を前提に単純化する。
- main repo tests は external plugin content の詳細挙動ではなく、loader / resolver / include / helper API の contract を検証する。

## Overview
### Modules
- `src/lib/presets.js` は builtin base と enabled plugin registry から preset chain を構築する resolver boundary。
- `src/lib/plugin-registry.js` は plugin sources / packages、manifest contributions、preset provider entries、DataSource entries を扱う registry boundary。
- `src/upgrade.js` は non-base type provider completion、official default source completion、parent chain install / enable、legacy project-local preset migration を扱う migration entry point。
- `src/lib/include.js` と template / locale / AGENTS deploy path は `@presets/<key>/...` を enabled preset chain から解決する include boundary。
- `src/lib/container.js` は preset DataSource 向け public helper API を登録する surface。`pathMatch.*` はここから取得する。
- `tests/run.js` と preset tests は main repo の base / contract tests に限定され、external plugin detailed tests を自動収集しない。

### Data Flow
- `senti upgrade` reads `.senti/config.json`, completes missing plugin sources/packages for non-base types, installs provider plugins, then validates the selected preset chain.
- docs / scan / build resolve config type through builtin base plus enabled plugin registry; unresolved non-base providers produce explicit errors instead of bundled fallback.
- `@presets/<key>/...` include parses `<key>`, checks enabled preset registry membership, then resolves the path against the matching preset chain directory.
- Plugin DataSources request helpers through `container.get("pathMatch.*")` and related public APIs, avoiding imports from `src/presets` or other main internals.

### Decisions
- [VERIFY] checked draft policy / `src/lib/presets.js` / result=match: current resolver combines `CORE_PRESETS_DIR` and bundled official preset plugin, so removing bundled fallback is required.
- [VERIFY] checked draft policy / `src/lib/include.js` / result=match: current `@presets` include resolution uses one root directory, not enabled preset chain resolution.
- [VERIFY] checked draft policy / `src/lib/container.js` / result=match: current public container still imports `path-match` from `src/presets/lib`.
- [VERIFY] checked draft policy / `src/upgrade.js` / result=match: upgrade already bootstraps official presets for non-base type but depends on official plugin root rather than generic source lookup.
- [VERIFY] checked draft policy / `tests/run.js` / result=match: main test discovery still scans `src/presets` and bundled official preset tests.
- User decision: this flow completes the main repo boundary only; external `senti-presets` repository file migration is not a direct completion condition.
- User decision: bundled official preset copy under `src/official-plugins/senti-presets` is fully deleted from main repo.
- User decision: `.senti/presets/<key>` leaf override is not retained; project-local presets move to local plugin source / enabled package management.
- Review repair: official default provider source is materialized by `official-presets` git source; tests may use local fixture source with equivalent manifest.
- Review repair: manifestless legacy `.senti/presets/<key>` migration preserves old inherited metadata when a matching provider exists; otherwise it migrates as bare preset.
- Review repair: preset include, locale, and AGENTS resolution use deterministic chain precedence: project-local template root first where supported, then config type order, each chain leaf-to-root.
- Impact list: docs/scan/build preset resolution changes for non-base types because an enabled plugin provider is now required; builtin base behavior remains available.
- Impact list: `senti upgrade` now repairs incomplete non-base provider config or fails with explicit error; command name and primary `--dry-run` / `--help` option behavior remain unchanged.
- Impact list: `tests/run.js` no longer discovers detailed external official preset tests; main repo still runs unit/e2e/agent selections for main package behavior.
- Impact list: `.senti/presets/<key>` runtime leaf override is removed; existing content is migrated to local plugin source/package by `senti upgrade`.
- User decision: docs regeneration is out of this flow scope and remains follow-up work.

## Clarifications (Q&A)
- Q: Does this flow include moving files in the external `senti-presets` repository?
  - A: No. The flow completes the main repo boundary: resolver, migration, include, helper API, and contract tests. External repository file movement is a follow-up outside this worktree.
- Q: Does the main repo keep `src/official-plugins/senti-presets` as a compatibility copy?
  - A: No. The bundled official preset copy is deleted from main repo, and provider bootstrap is implemented through source/package lookup.
- Q: Does `.senti/presets/<key>` remain a runtime leaf override?
  - A: No. Existing content is migrated by `senti upgrade` to local plugin source / package management. Explicit `preset.json` is preserved; manifestless directories copy metadata from a matching resolved provider or become bare presets when no provider exists.
- Q: What supplies official presets after bundled deletion?
  - A: `senti upgrade` uses source id `official-presets`, type `git`, remote `git@github.com:SpreadWorks/senti-presets.git` as the default provider source. Tests may substitute a local fixture source with the same manifest shape.
- Q: Which user-facing inputs does `senti upgrade` validate for this migration?
  - A: `--dry-run` and `--help` remain boolean flags with no values. Config-derived plugin source fields are validated at upgrade entry: id path-safe single segment, type git/local, git remote required, local path project-root-relative, and optional ref string.
- Q: What is the precedence for locale and AGENTS preset resolution?
  - A: Use project-local template root first where supported, then config type order, and within each type use the resolved preset chain from leaf to root. Only enabled registry keys are candidates.
- Q: Are docs regenerated in this flow?
  - A: No. Docs regeneration is a follow-up, even though source was newer than docs at flow start.

## Alternatives Considered
- Keep bundled official preset copy as bootstrap fallback — Rejected because it preserves main repo dependency on actual official preset names and directory structure, contradicting Issue #377.
- Keep `.senti/presets/<key>` leaf override — Rejected because it creates a second provider surface outside plugin sources/packages and complicates registry and include contracts.
- Make main test runner discover installed plugin detailed tests — Rejected because main package tests must stay independent of enabled plugin state and external plugin checkouts.
- Implement npm plugin sources now — Rejected because Issue #377 limits initial source support to git and local, with npm as a future extension.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-11T23:56:08.063Z
- Notes: User approved gate-passed spec via choice 1

## Requirements
- R1 [must]: When inspecting the main package after implementation, only `base` may remain as builtin preset content; `src/official-plugins/senti-presets` and non-base official preset content must not be required by runtime source or main repo tests.
- R2 [must]: When resolving preset chains, the resolver must use builtin `base` plus enabled plugin registry entries and must not fall back to bundled official preset plugin content.
- R3 [must]: When `senti upgrade` sees a non-base `type` whose provider package is missing, it must search at most 100 configured `plugin.sources[]`, add official default source `{ id: "official-presets", type: "git", remote: "git@github.com:SpreadWorks/senti-presets.git" }` when needed, install / enable the provider plugin, record reproducibility metadata for git sources, stop parent-chain traversal at depth 16, and return a non-zero error if any non-base provider in the parent chain cannot be found.
- R4 [must]: When a project contains legacy `.senti/presets/<key>` preset content, `senti upgrade` must migrate it to a local plugin source / enabled package or fail with a clear error; directories with `preset.json` keep that manifest, directories without `preset.json` copy parent / scan / chapters from a matching resolved provider when one exists and otherwise become bare presets with parent null, empty scan, and empty chapters; runtime preset resolution must not treat `.senti/presets/<key>` as a leaf override.
- R5 [must]: When resolving `@presets/<key>/...` includes, locale templates, or AGENTS templates, only preset keys present in the enabled preset registry may resolve, and the resolver must search deterministic paths: project-local template root first where that feature exists, then config type order, and for each type its resolved chain from leaf to root with max chain depth 16; include expansion must keep max depth 8 and max include count 32; it must not broadly scan installed plugin `presets/` directories.
- R6 [must]: When plugin preset DataSources need shared helpers currently represented by `pathMatch.*`, they must obtain those helpers through public container APIs, and plugin preset code must not import main package internal preset paths.
- R7 [must]: When running main repo tests, the default, scope, and preset discovery paths must not depend on external plugin checkout state, installed plugin state, `src/official-plugins/senti-presets`, or detailed tests for actual official preset names.
- R8 [must]: When testing plugin preset foundation behavior in main repo, fixtures and expected values must use generic preset names such as `sample-preset` or `child-preset`, not actual official preset names as implementation conditions.
- R9 [must]: When CLI behavior changes affect existing project configs, command names and primary option meanings must remain stable, and the spec-local tests must verify success and failure exit-code conditions for provider completion and migration errors.
- R10 [should]: When generated docs become stale because of this migration, the implementation should leave docs regeneration out of this flow and expose the follow-up need without changing generated docs in this branch.

## Acceptance Criteria
- AC-1: `rg "official-plugins/senti-presets|bundledOfficialPresetPluginRoot|src/official-plugins/senti-presets" src tests` has no runtime or main test dependency after expected deletion/migration exceptions are removed.
- AC-2: A spec-local test with `// spec: R2` verifies that non-base preset resolution succeeds from enabled plugin registry entries and fails without bundled official fallback.
- AC-3: A spec-local test with `// spec: R3` verifies `senti upgrade` provider completion across `plugin.sources[]`, official default source materialization with id/type/remote, parent chain install / enable, source/chain bounds, and provider-not-found failure.
- AC-4: A spec-local test with `// spec: R4` verifies legacy `.senti/presets/<key>` migration to local plugin source / package for explicit manifest, manifestless matching-provider, and manifestless bare-preset cases, and verifies runtime resolution no longer uses leaf override lookup.
- AC-5: A spec-local test with `// spec: R5` verifies `@presets/<key>/...`, locale, and AGENTS resolution use registered enabled preset keys only, apply project-local/template and chain precedence deterministically, enforce include/chain bounds, and reject unregistered plugin preset directories.
- AC-6: A spec-local test with `// spec: R6` verifies `pathMatch.*` helpers are available through the public container API and that plugin fixture DataSources do not import main internal preset paths.
- AC-7: A spec-local or shared regression test with `// spec: R7` verifies `tests/run.js` default/scope/preset discovery does not include external plugin detailed tests or bundled official preset directories.
- AC-8: Main repo fixture and contract tests use generic preset names for plugin foundation behavior; no actual official preset name is required for expected runtime behavior.
- AC-9: CLI migration tests verify non-zero exit codes and explicit errors for unsupported source type, unsafe local path, provider not found, and legacy project-local preset migration failure.
- AC-10: `npm test` passes after implementation; if `src/skills/` or `src/presets/base/templates/` changes, `senti upgrade` is run and resulting managed changes are reviewed.

## Implementation Targets
- src/lib/presets.js
- src/lib/plugin-registry.js
- src/lib/include.js
- src/lib/container.js
- src/lib/official-plugins.js
- src/upgrade.js
- src/lib/preset-deploy.js
- tests/run.js
- tests/helpers/test-runner-search-dirs.js
- tests/unit/presets/
- tests/e2e/
- specs/289-b6fb-3-3-preset-migration-fully-migrate-presets-/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Constrain preset registry
  - Make preset chain resolution depend on builtin base and enabled plugin registry entries only.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Complete provider migration
  - Make `senti upgrade` complete missing provider plugins for non-base types and migrate legacy project-local preset content.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Resolve preset aliases
  - Resolve `@presets/<key>/...`, locale, and AGENTS template references through the enabled preset chain.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Publish preset helpers
  - Expose shared preset helpers through public container APIs instead of internal preset paths.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Prune test discovery
  - Keep main repo test discovery independent of external official preset details.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Remove bundled content
  - Delete main repo official preset copy and non-base builtin preset content after contracts are in place.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Cover migration contracts
  - Add spec-local tests that map every testable requirement to executable or static verification.
  - see `tasks/T-7.md` for full spec
