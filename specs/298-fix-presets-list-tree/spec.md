# Feature Specification: 298-fix-presets-list-tree

**Feature Branch**: `feature/298-fix-presets-list-tree`
**Created**: 2026-06-15
**Status**: Draft
**Input**: GitHub Issue #388

## Goal
`senti presets list` が setup 後の project plugin registry を反映し、official-presets を含む preset 継承 tree を表示できるようにする。

## Background
`senti setup` can install official-presets and project-aware resolution can resolve a selected preset such as `nextjs` through `base > webapp > js-webapp > nextjs`. The separate `senti presets list` command still reads the static built-in `PRESETS` constant, which contains only the package's core `base` preset. As a result, setup-installed presets exist and resolve correctly, but the inspection tree appears broken because the command output shows only `base`.

## Scope
- `senti presets list` の preset inventory lookup。
- projectRoot/plugin registry を持つ project での preset tree 表示。
- plugin registry を読めない、または未設定の project での base-only fallback。
- 既存の tree output formatting: root line、branch connector、label、aliases、scan marker、template availability marker、child ordering。
- plugin-backed と base-only の regression tests。

## Out of Scope
- `senti setup` の preset candidate resolution 変更。
- `resolveChain` / `resolveMultiChains` の意味変更。
- `.senti/presets` legacy storage migration。
- official-presets package contents の変更。
- npm publish / dist-tag 操作。

## Constraints
- 外部依存を追加しない。Node.js built-in modules と既存 preset/plugin registry API を使う。
- `src/` に特定 project 固有の情報を入れない。official preset 名は test fixture または installed plugin metadata 由来に限定する。
- `senti presets list` は public CLI inspection command なので、plugin registry を読めない場合も fatal にせず core preset fallback で表示可能にする。
- setup candidate resolution と runtime resolver は既に動作しているため、表示 command の inventory lookup 以外へ変更範囲を広げない。
- migration parity として、既存 output formatting と fallback behavior を behavior-level tests で保持確認する。
- bounded-resource-usage: preset inventory rendering must have explicit upper bounds. The command must reject or truncate before processing more than 512 preset entries, and recursive tree rendering must not exceed depth 16.
- bounded-resource-usage: tree rendering must track visited preset keys so cycles or malformed parent links cannot recurse indefinitely.
- 新しい spec behavior coverage は `specs/298-fix-presets-list-tree/tests/` 配下に置き、各 spec-local test file に `// spec: R<N> ...` header を付ける。

## Design Principles
- preset discovery の source of truth は既存の project-aware preset registry に寄せる。
- rendering contract と inventory lookup を分ける。tree renderer は既存 format を維持し、入力だけを project-aware にする。
- inspection command は設定途上の project でも使えるように、registry failure では base-only fallback を保つ。
- migration parity を public output surface ごとに検証する。plugin preset presence だけでなく、既存 formatting markers も保持確認する。

## Overview
### Modules
- `src/presets-cmd.js`: `senti presets list` entrypoint。現在は static `PRESETS` を読み tree を render する。
- `src/lib/presets.js`: core presets と project plugin registry presets を統合し、projectRoot-aware resolver を提供する。
- `src/lib/plugin-registry.js`: `.senti/plugins/*/plugin.json` から enabled preset contributions を読み込む。
- tests/spec-local: plugin-backed project fixture と base-only fallback fixture で CLI output を検証する。

### Data Flow
- `senti presets list` は実行 project root を解決し、project-aware preset inventory を取得する。
- inventory lookup は core `base` と enabled plugin presets を key で統合し、plugin preset が core preset を補完できるようにする。
- registry load failure または registry absence では core presets だけを使い、existing base-only tree output を表示する。
- tree renderer は existing fields (`key`, `parent`, `label`, `aliases`, `scan`, `dir`) を使い、root line と child connector output を維持する。
- children は既存どおり key の alphabetical order で表示する。
- tree rendering validates bounded processing before output: at most 512 preset entries are processed, recursion depth is capped at 16, and visited keys prevent cycle traversal.

### Decisions
- [VERIFY] `presets list` currently reads static built-in presets only.
- [VERIFY] setup and runtime resolution are already project-aware.
- [VERIFY] fallback should use non-strict registry behavior.
- Migration inventory: retained public behavior includes root line display, tree branch connectors, preset labels, aliases display, scan key display, template availability marker, child alphabetical ordering, base-only output, and missing-base fallback.
- Migration mapping: output rendering remains owned by `presets list`; only the preset inventory provider moves from static `PRESETS` to project-aware registry plus core fallback.
- Fallback decision: registry load failure in `presets list` is not fatal and falls back to core presets.
- Bounded traversal decision: renderer processing is capped by preset count, depth, and visited keys.
- Acceptance target: `nextjs` is the concrete plugin-backed leaf because it proves multi-level parent rendering (`base > webapp > js-webapp > nextjs`).

## Clarifications (Q&A)
- Q: Does this change install official presets during `presets list`?
  - A: No. The command reads already enabled project plugin registry state. It does not fetch, install, or persist plugins.
- Q: Should `presets list` fail if plugin registry cannot be read?
  - A: No. It is an inspection command. It should fall back to core presets and keep existing base-only output.
- Q: Is setup behavior in scope?
  - A: No. setup candidate resolution and official preset installation already work for this issue and are explicitly out of scope.

## Alternatives Considered
- Change setup candidate resolution again — Rejected because Issue #388 reproduces after setup succeeds; setup candidates and runtime resolver already resolve the plugin chain.
- Make `presets list` install or refresh official-presets automatically — Rejected because inspection commands should not mutate plugin state. Installation remains setup/upgrade/plugin ownership.
- Fail when plugin registry cannot be loaded — Rejected because existing base-only command behavior is useful outside configured projects, and non-strict registry fallback already exists.
- Duplicate a separate plugin scan inside `presets-cmd.js` — Rejected because preset registry merging already exists in `src/lib/presets.js`; duplicating it risks divergence.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-15T01:32:16.291Z
- Notes: autoApprove: approved gate-passed spec for issue #388

## Requirements
- R1 [must]: `senti presets list` uses project-aware preset inventory when run from a project root, so enabled plugin presets are included with core presets.
- R2 [must]: A project with installed official-presets displays the multi-level chain containing `base`, `webapp`, `js-webapp`, and `nextjs` in the tree output.
- R3 [must]: When no plugin registry is available, or registry loading fails in non-strict inspection mode, `senti presets list` still displays the existing base-only tree output instead of failing.
- R4 [must]: The command preserves retained public output formatting: root line format, branch connectors, preset labels, aliases, scan markers, template availability marker, child alphabetical ordering, and missing-base fallback behavior.
- R5 [must]: The change does not modify setup candidate resolution, preset chain resolution semantics, plugin installation, or official-presets package contents.
- R6 [must]: `senti presets list` bounds preset inventory and tree traversal by processing at most 512 preset entries, rendering at most depth 16, and preventing cycle traversal with visited preset keys.

## Acceptance Criteria
- R1: In a temporary project with `.senti/plugins/official-presets/plugin.json` enabled through project config, running `node <repo>/src/senti.js presets list` from that project outputs plugin preset nodes in addition to `base`.
- R2: The plugin-backed output contains `base/`, `webapp/`, `js-webapp/`, and `nextjs/`, with `nextjs` nested under `js-webapp` and `js-webapp` nested under `webapp`.
- R3: In a project without enabled plugin presets, `presets list` exits successfully and prints the same base root line format as before.
- R3: If plugin registry loading is unavailable in the inspection command path, output falls back to core presets and still exits successfully.
- R4: Behavior-level assertions verify root line formatting, `├──` / `└──` branch connector formatting, label rendering, aliases rendering, scan marker rendering, template availability marker rendering, and alphabetical child ordering.
- R4: A renderer-level test verifies `(no base preset found)` is still printed when the inventory has no base preset.
- R5: Existing setup candidate tests and resolver tests continue to pass without changes to official-presets package content.
- R6: A renderer or command-level test verifies inventories above 512 entries are rejected or bounded before rendering.
- R6: A renderer-level test verifies cyclic parent links or depth greater than 16 do not recurse indefinitely.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Expose project preset inventory
  - Provide or expose a project-aware preset inventory path that `presets list` can use without duplicating registry merge logic.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Render project preset tree
  - Update `senti presets list` to render project-aware preset inventory while preserving existing tree formatting behavior.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Cover retained output surfaces
  - Add behavior-level regression coverage for the public `presets list` output surfaces retained during the inventory migration.
  - see `tasks/T-3.md` for full spec
