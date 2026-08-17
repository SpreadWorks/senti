## Summary

`senti upgrade` generates the unused project-local template `.senti/templates/<lang>/docs/creating_presets.md` even in projects with a standard configuration. This file is not referenced by the base preset chapters, so preset validation after upgrade emits a `creating_presets.md not listed in chapters` warning.

## Current Behavior / Reproduction

- `deployPresetCopies()` in `src/lib/preset-deploy.js` syncs `guardrail.json` and `guardrail-rewrite-rubric.md` to `.senti/presets/base/`, then calls `upsertText()` for `.senti/templates/<lang>/docs/creating_presets.md` for all languages.
- Running `deployPresetCopies(tmp, { presetKeys: ["base"], languages: ["ja"] })` creates `.senti/templates/ja/docs/creating_presets.md`.
- The chapters in `src/presets/base/preset.json` are `overview.md`, `stack_and_ops.md`, `project_structure.md`, and `development.md`; `creating_presets.md` is not included.
- `validatePresetChain()` warns about project-local `.senti/templates/<lang>/docs/*.md` files that are not included in the effective chapters, so this generated file always becomes noise.

## Expected Behavior

- Running `senti upgrade` in a project with a standard configuration should not newly generate `.senti/templates/<lang>/docs/creating_presets.md`.
- No `creating_presets.md not listed in chapters` warning should appear after `senti upgrade`.
- The base preset managed copies `.senti/presets/base/guardrail.json` and `.senti/presets/base/guardrail-rewrite-rubric.md` should continue to be synced as before.

## Proposed Fix

- Remove the unconditional generation of project-local `creating_presets.md` from `deployPresetCopies()`.
- Limit guardrail rewrite rubric syncing to the base preset managed copy only.
- Clarify in the specification that existing project-local `.senti/templates/*/docs/creating_presets.md` files are user-owned files and are excluded from automatic generation and automatic updates.

## Acceptance Criteria

- Running `senti upgrade` in a new or standard-configuration project does not create `.senti/templates/<lang>/docs/creating_presets.md`.
- After running `senti upgrade`, no new `creating_presets.md not listed in chapters` warning is emitted.
- Syncing of `.senti/presets/base/guardrail.json` and `.senti/presets/base/guardrail-rewrite-rubric.md` is preserved.
- A regression test is added for the generation targets of `deployPresetCopies()`.
- It is made clear in a spec or test that upgrade does not manage existing project-local `creating_presets.md` files.

## Out of Scope

- Improving the content of `creating_presets.md` itself
- Changing the content of `guardrail-rewrite-rubric.md`
- Changing the overall specification of preset chapter validation

<details>
<summary>ja</summary>

senti upgrade が未使用の project-local creating_presets.md を生成する

## 概要

`senti upgrade` が通常構成のプロジェクトでも未使用の project-local template `.senti/templates/<lang>/docs/creating_presets.md` を生成している。base preset の chapters ではこのファイルは参照されないため、upgrade 後の preset validation で `creating_presets.md not listed in chapters` 警告が発生する。

## 現状 / 再現

- `src/lib/preset-deploy.js` の `deployPresetCopies()` は `guardrail.json` と `guardrail-rewrite-rubric.md` を `.senti/presets/base/` に同期した後、全 language に対して `.senti/templates/<lang>/docs/creating_presets.md` を `upsertText()` している。
- `deployPresetCopies(tmp, { presetKeys: ["base"], languages: ["ja"] })` を実行すると `.senti/templates/ja/docs/creating_presets.md` が生成される。
- `src/presets/base/preset.json` の chapters は `overview.md`, `stack_and_ops.md`, `project_structure.md`, `development.md` で、`creating_presets.md` は含まれない。
- `validatePresetChain()` は project-local `.senti/templates/<lang>/docs/*.md` のうち effective chapters に含まれないファイルを警告するため、この生成物が常にノイズになる。

## 期待動作

- 通常構成のプロジェクトで `senti upgrade` を実行しても `.senti/templates/<lang>/docs/creating_presets.md` を新規生成しない。
- `senti upgrade` 後に `creating_presets.md not listed in chapters` 警告が出ない。
- base preset の managed copy である `.senti/presets/base/guardrail.json` と `.senti/presets/base/guardrail-rewrite-rubric.md` は従来どおり同期される。

## 修正方針

- `deployPresetCopies()` から project-local `creating_presets.md` の無条件生成を削除する。
- guardrail rewrite rubric の同期対象を base preset managed copy のみに限定する。
- 既存の project-local `.senti/templates/*/docs/creating_presets.md` は user-owned file として扱い、自動生成・自動更新の対象から外すことを仕様として明確化する。

## 受け入れ条件

- 新規または通常構成のプロジェクトで `senti upgrade` を実行しても `.senti/templates/<lang>/docs/creating_presets.md` が作成されない。
- `senti upgrade` 実行後、`creating_presets.md not listed in chapters` 警告が新規に発生しない。
- `.senti/presets/base/guardrail.json` と `.senti/presets/base/guardrail-rewrite-rubric.md` の同期は維持される。
- `deployPresetCopies()` の生成対象に関する回帰テストが追加されている。
- 既存の project-local `creating_presets.md` を upgrade が管理しないことが spec またはテストで明確になっている。

## スコープ外

- `creating_presets.md` 自体の内容改善
- `guardrail-rewrite-rubric.md` の内容変更
- preset chapter validation 全体の仕様変更

</details>