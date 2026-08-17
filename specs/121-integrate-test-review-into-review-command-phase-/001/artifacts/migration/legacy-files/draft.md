# Draft: Integrate test review into review command (--phase test)

## Issue
GitHub Issue #62

## Goal
テストフェーズ完了後・impl 前に、テストの十分性を AI がレビューするコマンドを追加する。
auto mode でハッピーパスだけのテストで進むリスクを軽減する。

## Decisions

### Q1: 実装方式
既存の `flow run review` に `--phase test` オプションを追加する。独立コマンドにはしない。

### Q2: 内部フロー
1コマンド内で「テスト設計生成 → テストコード照合 → ギャップ報告」を完結させる。
ユーザーの操作は `sdd-forge flow run review --phase test` の1回のみ。

内部フロー:
1. spec.md から Requirements を読む
2. AI がテスト設計（何をテストすべきか）を生成
3. 既存テストコードと照合してギャップを評価
4. ギャップあり → AI がテストを修正 → 再照合（上限3回）
5. ギャップなし or 上限到達 → 結果を返す

### Q3: 差し戻しループ上限
3回。3回で収束しなければユーザーに委ねる。

### Q4: 出力ファイル
`test-review.md` を spec ディレクトリに出力。既存の `review.md`（コードレビュー）と共存。

既存 CLI への影響:
- `sdd-forge flow run review` — 従来通りコードレビュー（変更なし）
- `sdd-forge flow run review --phase test` — 新規テストレビュー
- 後方互換性は完全に維持

### Q5: エージェント設定
`flow.review.test` を新設。未設定時は `flow.review.draft` にフォールバック。

## Requirements Summary
1. `--phase test` オプションの追加
2. テスト設計生成 → 照合 → ギャップ評価の内部パイプライン
3. 差し戻しループ（上限3回）
4. `test-review.md` の出力
5. `flow.review.test` エージェント設定キー
6. 既存コードレビュー機能への影響なし

## Open Questions
なし

---
- [x] User approved this draft
