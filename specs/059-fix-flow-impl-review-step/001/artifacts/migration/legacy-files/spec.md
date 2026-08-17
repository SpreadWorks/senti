# Feature Specification: 059-fix-flow-impl-review-step

**Feature Branch**: `feature/059-fix-flow-impl-review-step`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User request

## Goal

flow-impl スキルの review ステップを、`sdd-forge flow review` コマンドを使った AI レビューに改修する。
現状の「diff を表示してユーザーに丸投げ」を廃止し、AI がコードを分析して改善提案を行う流れにする。

## Scope

### flow-impl SKILL.md Step 2 の改修

改修後の流れ：

1. コードレビューを行うか確認
2. `sdd-forge flow review` を実行
3. 結果に応じた分岐：
   - **提案あり**: 提案内容を表示 → 修正するか確認 → AI がコードを修正 → テスト実行 → Step 3 へ
   - **提案なし**: 「レビューの結果、修正の必要はありませんでした」と表示 → 確認なしで Step 3 (finalize) へ

### sdd-forge flow review コマンドの修正

- `--apply` 関連の出力（298-299行目）を削除
- 提案の適用は AI エージェント（スキル側）の責務

### 実装ファイル

| ファイル | 変更内容 |
|---|---|
| `.claude/skills/sdd-forge.flow-impl/SKILL.md` | Step 2 を `sdd-forge flow review` ベースに改修 |
| `src/flow/commands/review.js` | `--apply` 案内出力を削除 |

## Out of Scope

- `sdd-forge flow review --apply` の実装（廃止方針）
- review コマンド自体のロジック変更（提案生成・検証の仕組みはそのまま）

## Clarifications (Q&A)

- Q: NO_PROPOSALS の場合にユーザー確認は必要か？
  - A: 不要。メッセージを表示して finalize に直行する。
- Q: 提案の適用はコマンド化するか？
  - A: しない。`--apply` は廃止し、AI エージェント側で修正する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-15
- Notes: Approved as-is

## Requirements

1. flow-impl SKILL.md の Step 2 が `sdd-forge flow review` を実行する指示になっている
2. 提案ありの場合、AI がコードを修正しテストを実行する流れが記述されている
3. 提案なしの場合、メッセージ表示後に確認なしで finalize へ進む流れが記述されている
4. `sdd-forge flow review` の `--apply` 案内出力が削除されている

## Acceptance Criteria

- [ ] flow-impl SKILL.md Step 2 に `sdd-forge flow review` コマンドの実行指示がある
- [ ] 提案あり時のフロー（表示 → 確認 → 修正 → テスト）が記述されている
- [ ] 提案なし時のフロー（メッセージ表示 → finalize 直行）が記述されている
- [ ] review.js から `--apply` 案内行が削除されている
- [ ] 既存テストが壊れない

## Open Questions

（なし）
