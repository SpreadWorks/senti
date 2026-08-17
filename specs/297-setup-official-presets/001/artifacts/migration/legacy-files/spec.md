# Feature Specification: 297-setup-official-presets

**Feature Branch**: `feature/297-setup-official-presets`
**Created**: 2026-06-15
**Status**: Draft
**Input**: GitHub Issue #387

## Goal
`SENTI_OFFICIAL_PRESETS_REPO` が未設定の fresh project でも、`senti setup` の preset 選択で official presets を候補表示できるようにする。

## Background
`senti setup` already has a default official preset remote in the plugin registry, but fresh interactive setup does not use it when building preset candidates. The setup path only includes official presets when `SENTI_OFFICIAL_PRESETS_REPO` points to a local repository. This leaves fresh projects with only `base` as a candidate even though the official source is known. The fix is to reuse official source resolution for setup candidate discovery while preserving existing persistence boundaries.

## Scope
- `senti setup` の interactive preset candidate discovery。
- official preset source resolution の default remote 利用。
- official preset 選択後の `.senti/config.json` source/package persistence。
- base-only 選択時に official plugin state を保存しない挙動。
- setup/official preset 関連の regression tests。

## Out of Scope
- official preset repository の preset 内容変更。
- workflow plugin の board / hook / command behavior 変更。
- setup と無関係な plugin registry redesign。
- npm publish / dist-tag 操作。

## Constraints
- 外部依存を追加しない。Git clone/fetch と manifest 読み取りは Node.js built-in と既存 process helper を使う。
- `src/` に特定 project 固有の情報を入れない。official preset source は汎用の official plugin source として扱う。
- `SENTI_OFFICIAL_PRESETS_REPO` は local verification override として保持し、default remote より優先する。
- `config.local.json` の private plugin source/package を public `.senti/config.json` に漏らさない。
- base-only setup は official plugin source/package state を `.senti/config.json` に保存しない。
- official source 解決に失敗した場合、`base` だけを黙って表示する fallback は禁止する。
- default official source behavior は deterministic にテストできること。テストは `SENTI_OFFICIAL_PRESETS_REPO` を使わずに default source descriptor/root を差し替えられる内部 helper/options を使い、production default source は変更しない。
- 新しい spec behavior coverage は `specs/297-setup-official-presets/` 配下に置き、各 spec-local test file に `*** spec: R<N> ...` header を付ける。
- plugin/preset/setup source を変更した場合は関連テストに加え、必要に応じて `senti upgrade` artifact を作成する。

## Design Principles
- setup と upgrade の official source resolution を同じ source-of-truth に寄せる。
- candidate discovery と persistence を分ける。候補表示に必要な manifest 取得は可能にし、保存は official preset 選択時だけ行う。
- silent fallback ではなく原因付き failure を返し、ユーザーが official presets が出ない理由を判別できるようにする。
- migration parity を public behavior 単位で検証する。候補表示だけでなく base-only persistence、official persistence、chain validation まで確認する。

## Overview
### Modules
- `src/setup.js`: interactive setup wizard。preset candidate display、summary、final type minimization、official package state persistence を呼び出す。
- `src/lib/presets.js`: core presets、installed plugin presets、optional official preset manifest を候補として統合する。
- `src/lib/plugin-registry.js`: plugin source/package install、default official preset source、official package persistence、config/local separation を扱う。
- `src/lib/official-plugins.js`: `SENTI_OFFICIAL_PRESETS_REPO` override を解決する。
- setup/official preset tests: fresh setup candidate discovery、base-only no-persistence、official preset persistence、failure behavior を検証する。

### Data Flow
- setup candidate discovery は core presets と enabled plugin presets を読み込む。
- official preset source は `SENTI_OFFICIAL_PRESETS_REPO` があれば local override を使い、無ければ default official source を materialize して manifest を読む。
- candidate list は summary と final type minimization と candidate-chain validation に同じ candidate set として渡される。
- base-only 選択時は official source/package state を保存せず、setup の通常 config だけを書く。
- official preset 選択時は official source/package state を保存し、最終 config の plugin section に反映してから agent/template/validation 経路で参照できるようにする。
- official source 解決に失敗した場合は原因付き failure を返し、`base` だけの候補表示へ黙って縮退しない。

### Decisions
- [VERIFY] setup candidate display currently depends on env-provided official root.
- [VERIFY] official candidate manifest loading currently expects a filesystem root.
- [VERIFY] plugin registry already owns the default official remote and install behavior.
- [VERIFY] setup persistence currently still depends on env-provided official root.
- Migration inventory: setup must retain core preset display, enabled plugin preset display, env override display, base-only no-persistence, official preset persistence, and preset chain validation.
- Migration mapping: official manifest resolution moves from env-only local-root discovery to a setup discovery helper backed by plugin-registry official source resolution.
- Failure behavior: official source resolution failure is a cause-bearing setup failure, not warning plus silent base-only fallback.
- Network behavior: setup may retrieve the default official source before candidate display when no local override/source is available.
- Testability decision: the setup-safe official source resolver provides deterministic test control for the default source descriptor/root without using `SENTI_OFFICIAL_PRESETS_REPO`.

## Clarifications (Q&A)
- Q: Does this change remove `SENTI_OFFICIAL_PRESETS_REPO`?
  - A: No. The environment variable remains a local override and test fixture path. It only stops being the only way for fresh setup to see official presets.
- Q: Should setup persist official plugin state just because it fetched candidates?
  - A: No. Candidate discovery and persistence are separate. Base-only selection must not save official source/package state.
- Q: What happens when the default official source cannot be reached?
  - A: Setup fails with the source-resolution cause instead of silently showing only `base`.
- Q: Is the official preset repository content in scope?
  - A: No. The spec only changes how setup resolves and persists the official source.

## Alternatives Considered
- Require users to set `SENTI_OFFICIAL_PRESETS_REPO` before running setup — Rejected because Issue #387 is specifically about fresh setup using the default official remote without manual environment setup.
- Keep silent base-only fallback when official source resolution fails — Rejected because it preserves the bug symptom and hides why official presets are unavailable.
- Persist official source/package state during candidate discovery — Rejected because base-only setup must not leave official plugin state. Persistence belongs only after an official preset is selected.
- Duplicate default remote logic in setup.js — Rejected because setup and upgrade already diverged. The default source should be owned by plugin-registry source resolution.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-15T00:27:42.882Z
- Notes: Auto-approved because autoApprove is enabled by the user's prior selection.

## Requirements
- R1 [must]: Fresh setup candidate discovery includes official presets when `SENTI_OFFICIAL_PRESETS_REPO` is unset and the target project has no installed official-presets plugin, by resolving the default official preset source.
- R2 [must]: `SENTI_OFFICIAL_PRESETS_REPO` remains a local override for official preset discovery and takes precedence over the default remote.
- R3 [must]: Base-only setup does not write official-presets source/package state into `.senti/config.json` solely because candidates were discovered.
- R4 [must]: When an official non-base preset is selected, setup writes official-presets source/package state into `.senti/config.json`, installs or materializes the package as needed, and final preset chain validation resolves through that state.
- R5 [must]: Official source resolution failure during setup candidate discovery returns a cause-bearing failure and does not silently fall back to showing only `base`.
- R6 [must]: Setup does not copy private plugin source/package entries from `.senti/config.local.json` into public `.senti/config.json` while preparing official preset state.
- R7 [must]: Existing core preset and enabled plugin preset candidate behavior remains available after the official source discovery change.

## Acceptance Criteria
- R1: In a fresh temporary project with no official-presets plugin and no `SENTI_OFFICIAL_PRESETS_REPO`, setup candidate discovery returns `base` plus official presets from the default official source.
- R2: With `SENTI_OFFICIAL_PRESETS_REPO` pointing at a fixture official preset repository, setup candidate discovery uses that fixture and does not require the default remote.
- R3: A base-only setup path leaves `.senti/config.json` without official-presets source/package entries after candidate discovery.
- R4: Selecting an official preset writes official-presets source/package entries, installs/materializes `.senti/plugins/official-presets/plugin.json`, and validates the selected preset chain.
- R5: If the official default source cannot be resolved or materialized, setup candidate discovery fails with an error containing the official source cause and does not return a base-only candidate list.
- R5: Default-source success and failure tests keep `SENTI_OFFICIAL_PRESETS_REPO` unset and use deterministic test-controlled default source descriptors/roots instead of contacting the production remote.
- R6: When `.senti/config.local.json` contains private plugin sources/packages, selecting an official preset preserves those local entries only in local config and does not copy them into public `.senti/config.json`.
- R7: A project with an installed non-official plugin preset still sees that enabled plugin preset in setup candidates alongside core and official candidates.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Resolve official source for setup
  - Add a setup-safe official source discovery path that can materialize or reuse the default official source before preset candidate rendering.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Wire setup candidates
  - Use the setup-safe official source discovery path in interactive setup candidate rendering, summary, final type minimization, and candidate-chain validation.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Preserve setup persistence boundaries
  - Ensure candidate discovery does not persist official plugin state, while official preset selection saves public official state without leaking local private plugin config.
  - see `tasks/T-3.md` for full spec
