## Problem
When running `senti setup` in a fresh project, there are cases where only `base` appears in the preset selection candidates, even though the default remote for official presets is defined in code.

## Reproduction Conditions
- The target project does not have the official-presets plugin installed
- `SENTI_OFFICIAL_PRESETS_REPO` is not set
- Run `senti setup` interactively

In this state, the candidate display in `src/setup.js` only looks at the local manifest derived from `SENTI_OFFICIAL_PRESETS_REPO`, so `DEFAULT_OFFICIAL_PRESET_SOURCE` (`git@github.com:SpreadWorks/senti-presets.git`) from `src/lib/plugin-registry.js` is not used.

## Expected Behavior
Even when `SENTI_OFFICIAL_PRESETS_REPO` is not set, setup candidate display should reuse the official default source resolution from `plugin-registry.js` and be able to show official presets as candidates.

## Current Cause
- `upgrade` can use `DEFAULT_OFFICIAL_PRESET_SOURCE` via `ensureOfficialPackage()`
- `setup` pre-prompt candidate discovery uses a manifest-only path: `listSetupPresetCandidates()` + `PluginManifest.fromRoot(officialPresetRoot)`
- `officialPresetRoot` only references `SENTI_OFFICIAL_PRESETS_REPO`
- As a result, official preset source resolution is duplicated between setup and upgrade, and only setup misses the default URL

## Proposed Fix
- Add an official source discovery helper for setup in `plugin-registry.js`
- The helper should temporarily clone/fetch using the default remote so the manifest can be read for candidate display
- When only `base` is selected, do not leave official plugin state in `.senti/config.json`
- Only when a non-base official preset is selected, formally save the source/package state using something equivalent to `ensureSetupOfficialPresetState()`
- Do not leak private plugin source/package data from `config.local.json` into the public config

## Test Points
- Official presets appear as candidates even in a fresh setup with no env var set
- Official source/package is not saved when only `base` is selected
- When an official preset is selected, source/package is saved and preset chain validation passes
- If official source resolution fails, do not silently show only `base`; instead, provide a failure or warning that explains the cause

## Impact Scope
`src/setup.js`, `src/lib/plugin-registry.js`, `src/lib/presets.js`, and setup/official preset related tests.

<details>
<summary>ja</summary>

[BUG] senti setup が default official preset remote を候補表示に使わない

## 問題
fresh project で `senti setup` を実行すると、official presets の default remote がコード上に定義されているにもかかわらず、preset 選択候補に `base` しか出ない場合がある。

## 再現条件
- 対象 project に official-presets plugin が未導入
- `SENTI_OFFICIAL_PRESETS_REPO` が未設定
- `senti setup` を interactive に実行する

この状態では `src/setup.js` の候補表示が `SENTI_OFFICIAL_PRESETS_REPO` 由来のローカル manifest だけを見るため、`src/lib/plugin-registry.js` の `DEFAULT_OFFICIAL_PRESET_SOURCE` (`git@github.com:SpreadWorks/senti-presets.git`) が使われない。

## 期待動作
`SENTI_OFFICIAL_PRESETS_REPO` が未設定でも、setup の候補表示は `plugin-registry.js` の official default source resolution を再利用し、official presets を候補に出せること。

## 現状の原因
- `upgrade` は `ensureOfficialPackage()` 経由で `DEFAULT_OFFICIAL_PRESET_SOURCE` を使える
- `setup` の pre-prompt candidate discovery は `listSetupPresetCandidates()` + `PluginManifest.fromRoot(officialPresetRoot)` の manifest-only 経路
- `officialPresetRoot` は `SENTI_OFFICIAL_PRESETS_REPO` だけを参照する
- そのため setup と upgrade で official preset source resolution が二重化し、setup 側だけ default URL を見落としている

## 修正方針案
- `plugin-registry.js` に setup 用の official source discovery helper を用意する
- helper は default remote を使って一時的に clone/fetch し、候補表示用に manifest を読めるようにする
- base-only 選択時は official plugin state を `.senti/config.json` に残さない
- non-base official preset 選択時だけ `ensureSetupOfficialPresetState()` 相当で正式に source/package state を保存する
- `config.local.json` の private plugin source/package を public config に漏らさない

## テスト観点
- env 未設定の fresh setup でも official presets が候補に出る
- base-only 選択では official source/package が保存されない
- official preset 選択では source/package が保存され、preset chain validation が通る
- official source 解決失敗時に `base` だけを黙って出さず、原因が分かる失敗または警告になる

## 影響範囲
`src/setup.js`, `src/lib/plugin-registry.js`, `src/lib/presets.js`, setup/official preset 関連テスト。

</details>