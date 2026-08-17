# Draft: fix-flow-impl-review-step

## 決定事項

### flow-impl SKILL.md Step 2 (review) の改修

現状の問題：
- diff の統計を表示して「問題はありますか？」とユーザーに丸投げ
- AI がコードの中身を確認していない
- `sdd-forge flow review` コマンドが存在するのに使われていない

改修後の流れ：

1. コードレビューを行うか確認
2. `sdd-forge flow review` を実行（AI が提案生成 → 検証 → review.md に保存）
3. 結果を表示
   - 提案あり → 修正するか確認 → AI がコードを修正 → テスト実行 → Step 3 へ
   - 提案なし（NO_PROPOSALS） → 「レビューの結果、修正の必要はありませんでした」と表示 → 確認なしで Step 3 (finalize) へ

### sdd-forge flow review コマンドの修正

- `--apply` 関連の出力を廃止（298-299行目を削除）
- 提案の適用はコマンドではなく AI エージェント（スキル側）で行う

## Open Questions

（なし）

---

- [x] User approved this draft
- Date: 2026-03-15
