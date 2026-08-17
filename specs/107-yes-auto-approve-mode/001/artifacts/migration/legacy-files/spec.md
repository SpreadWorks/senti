# Feature Specification: 107-yes-auto-approve-mode

**Feature Branch**: `feature/107-yes-auto-approve-mode`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Issue #41

## Goal

SDD フローに autoApprove モードを導入し、AI が選択肢を自動選択して人間の介入なしにフロー全体を走り切れるようにする。Phase 1 として SKILL.md の指示ベースで実現する（コンソールに流れが見える形）。

## Scope

- `src/lib/flow-state.js` — FlowState typedef に `autoApprove: boolean` を追加
- `src/flow/set/auto.js` — `flow set auto on/off` コマンド新規作成
- `src/flow/get/status.js` — 応答に `autoApprove` フィールドを追加
- `src/templates/partials/core-principle.md` — autoApprove 時の動作指示を追加
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` — autoApprove 対応（draft 自問自答、Hard Stops 緩和、リトライ上限）
- `src/templates/skills/sdd-forge.flow-impl/SKILL.md` — autoApprove 対応（Hard Stops 緩和、リトライ上限）
- `src/templates/skills/sdd-forge.flow-finalize/SKILL.md` — autoApprove 対応（Hard Stops 緩和）
- `src/templates/skills/sdd-forge.flow-auto-on/` — 新規 skill テンプレート
- `src/templates/skills/sdd-forge.flow-auto-off/` — 新規 skill テンプレート

## Out of Scope

- Phase 2: コマンド内完結（`flow run plan --auto` 等で AI を介さず実行）
- draft 自問自答の品質ブラッシュアップ
- 承認選択肢への「以降は自動で」オプション追加
- `prepare-spec --yes` フラグ
- `prompt.js` の `recommended` フィールド変更

## Clarifications (Q&A)

- Q: auto mode での選択肢処理はどこで行うか？
  - A: AI 経由。SKILL.md が `flow get status` で `autoApprove` を確認し、true なら選択肢を提示せず id=1 が選ばれたものとして進む。

- Q: draft フェーズはスキップするか？
  - A: スキップしない。auto mode でも必ず自問自答で draft を作成する。AI の判断でブレさせない。

- Q: auto OFF のタイミングは？
  - A: 自動 OFF しない。flow.json に残り続ける。明示的に `/sdd-forge.flow-auto-off` で OFF する。

- Q: prepare-spec --yes は必要か？
  - A: 不要。SKILL.md の指示で prepare-spec 後に `flow set auto on` を実行させる。

- Q: prompt.js の recommended 変更は必要か？
  - A: 不要。auto mode は id=1 固定なので recommended を参照しない。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: Gate PASS 後に承認

## Requirements

**P1（基盤）**:

1. `flow-state.js` の FlowState typedef に `autoApprove` (boolean, optional) を追加する
2. `src/flow/set/auto.js` を新規作成する。`flow set auto on` で `autoApprove: true`、`flow set auto off` で `autoApprove: false` を flow.json に書き込む。flow.json が存在しない場合は `fail()` でエラーを返し非ゼロ終了する。書き込み失敗時も同様に `fail()` で非ゼロ終了する（既存の set コマンドと同じパターン）。`flow set` の既存サブコマンド（step, req, note 等）には影響しない（新規サブコマンドの追加のみ）
3. `flow get status` が呼ばれた時、応答 JSON に `autoApprove` フィールド（`state.autoApprove || false`）を含める。変更対象は `src/flow/get/status.js`。status.js はエラー時に既存の `fail()` パターンで非ゼロ終了する（既存実装と同じ）

**P2（SKILL.md 指示変更）**:

4. `src/templates/partials/core-principle.md` に autoApprove 時の動作指示を追加する。内容: 「各ステップの開始時に `flow get status` を実行し、`autoApprove: true` の場合、選択肢を提示せず id=1 が選ばれたものとして次のステップに進め。進行状況はコンソールに簡潔に表示せよ」。この指示は include 経由で全 SKILL.md（plan/impl/finalize）に適用される
5. `sdd-forge.flow-plan/SKILL.md` の draft フェーズに自問自答モードの指示を追加する。内容: 「autoApprove 時は Issue + docs/ + guardrail を入力にして、要件チェックリスト（Goal & Scope, Impact, Constraints, Edge cases, Test strategy）を自分で埋めて draft.md を作成せよ」
6. 各 SKILL.md（plan/impl/finalize）の Hard Stops に autoApprove 時の緩和ルールを追加する。内容: 「autoApprove: true の場合、"Do not proceed to next step without user confirmation" は適用しない」
7. `sdd-forge.flow-plan/SKILL.md` と `sdd-forge.flow-impl/SKILL.md` にリトライ上限を追加する。gate: 20回、impl テスト修正: 5回、review: 3回。上限到達時はユーザーに判断を返す

**P3（skill テンプレート）**:

8. `src/templates/skills/sdd-forge.flow-auto-on/` を新規作成する。SKILL.md の内容: `flow set auto on` を実行し、`flow get status` で現在のステップを確認して適切な flow skill（plan/impl/finalize）を呼び出す。`flow set auto on` が失敗した場合はエラーメッセージを表示して停止する
9. `src/templates/skills/sdd-forge.flow-auto-off/` を新規作成する。SKILL.md の内容: `flow set auto off` を実行し、autoApprove が無効化されたことを表示する。`flow set auto off` が失敗した場合はエラーメッセージを表示して停止する

## Acceptance Criteria

- `flow set auto on` を実行すると flow.json の `autoApprove` が `true` になる
- `flow set auto off` を実行すると flow.json の `autoApprove` が `false` になる
- `flow set auto on` を flow.json 未存在の状態で実行するとエラーが返る
- `flow get status` の応答に `autoApprove` フィールドが含まれる
- `core-principle.md` に autoApprove 時の動作指示が記述されている
- 各 SKILL.md（plan/impl/finalize）に autoApprove 時の Hard Stops 緩和が記述されている
- `flow-plan/SKILL.md` に draft 自問自答モードの指示が記述されている
- `flow-plan/SKILL.md` と `flow-impl/SKILL.md` にリトライ上限（gate 20, impl test 5, review 3）が記述されている
- `/sdd-forge.flow-auto-on` skill が存在し、auto ON + 適切な flow skill への誘導を行う
- `/sdd-forge.flow-auto-off` skill が存在し、auto OFF を行う
- 既存テストがパスする

## Open Questions

- なし
