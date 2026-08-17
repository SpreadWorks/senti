# Feature Specification: 088-issue-input-for-flow

**Feature Branch**: `feature/088-issue-input-for-flow`
**Created**: 2026-03-23
**Status**: Draft
**Input**: GitHub Issue #17

## Goal

GitHub Issue 番号を SDD フローに紐付け、flow.json に保存できるようにする。スキルが issue 内容を参考情報として活用し、PR 作成時に自動で `fixes #N` を含められるようにする。

## Scope

- `flow-state.js` に `setIssue()` 関数を追加
- `status.js` に `--issue <number>` オプションを追加
- `flow-plan` スキル（SKILL.md）に issue 取得・活用の指示を追加

## Out of Scope

- 既存フローのステップ順序・選択肢・ゲート等の変更
- `spec init` への `--issue` オプション追加
- issue 内容の自動フェッチをプロダクトコードで実装すること
- issue のステータス管理（open/closed の追跡）

## Clarifications (Q&A)

- Q: `--issue` はどのコマンドに追加する？
  - A: `flow status --issue <number>`。既存の setter パターン（--request, --note）に合わせる。
- Q: issue 内容のフェッチはどこで行う？
  - A: スキル側（SKILL.md の指示）で `gh issue view` を使う。プロダクトコードでは番号の保存のみ。
- Q: 既存フローへの影響は？
  - A: なし。issue は情報ソースの一つとして扱い、フロー構造は変更しない。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-23
- Notes: ミニマルな変更。既存フロー構造は変更しない。

## Requirements

優先順位: 1 > 2 > 3（1, 2 は必須、3 はスキル改善）

1. `flow-state.js` に `setIssue(workRoot, number)` を追加する。`mutateFlowState` で `state.issue` に番号を設定する。
2. `status.js` の parseArgs に `--issue` オプションを追加し、`setIssue()` を呼び出す。`sdd-forge flow status --issue 17` で `flow.json` に `"issue": 17` が保存される。非数値が渡された場合はエラーメッセージを表示し非ゼロ終了コードで終了する。アクティブなフローが存在しない場合もエラーメッセージを表示し非ゼロ終了コードで終了する（既存の setter と同じ挙動）。
3. `flow-plan` SKILL.md に以下の指示を追加する: flow 開始時に issue 番号が与えられた場合、`gh issue view <number>` で issue の title と body を取得し、`flow status --issue <number>` で flow.json に保存し、ドラフトフェーズの最初の質問前に issue 内容を表示する。
4. `flow-finalize` SKILL.md は変更不要（`merge.js` が既に `state.issue` → `fixes #N` を出力する）。

## Acceptance Criteria

1. `sdd-forge flow status --issue 17` を実行すると、flow.json の `issue` フィールドに `17` が保存される。
2. `sdd-forge flow status` の表示に issue 番号が含まれる（`Issue: #17`）。
3. `--issue` に非数値を渡すとエラーメッセージが表示され、非ゼロ終了コードで終了する。
4. flow-plan スキルで issue 番号指定時、ドラフトフェーズの最初の質問前に issue の title と body が表示される。
5. PR 作成時に `fixes #17` が PR body に含まれる（既存動作、変更なし）。

## Open Questions

（なし）
