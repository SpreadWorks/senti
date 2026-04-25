# Draft: 230-auto-check-gate-threshold

**開発種別:** feature
**目的:** auto-check の判定ロジックを改善し、狭いスコープの bugfix/enhancement が不当に reject されないようにする

## Scope Verification
- In scope:
  - auto-check の合格閾値を引き下げる
  - hard-gate 判定を zero-tolerance から段階化に変更する
  - reject 時の reason メッセージを新ロジックに合わせて更新する
  - 既存ユニットテストの更新
- Out of scope:
  - static gates（キーワードベースのプリフィルタ）の変更
  - AI プロンプトの変更
  - 各カテゴリの重みの変更

## Impact on Existing Features
- 影響ありの既存機能:
  - auto-check の eligible 判定が緩和される。過去 26 件のデータで、閾値未満で reject された 4 件のうち 3 件が新たに eligible になる。hard-gate 段階化により、1 項目が 0 でも他 2 項の合計が 2 以上なら通過する

## Requirements

- R1 (must): When AI スコアリングが完了し合計スコアが算出されたとき、合格判定の閾値は 75% (18/24) ではなく 67% (16/24) とする。根拠: 過去 26 件の AI スコアリングデータで 17 点と 19 点の間にギャップがあり、17 点の狭い bugfix/enhancement が false negative となっている
- R2 (must): When hard-gate 判定を行うとき、3 項目（specBuildability, ambiguity, verifiability）の合計が 1 以下なら fail とする。1 項目が 0 でも他 2 項の合計が 2 以上なら通過する。根拠: 既存データで hard-gate のみで弾かれたケースは全てスコアでも閾値未満であり、zero-tolerance は過度に厳しい
- R3 (must): When hard-gate fail が発生したとき、reason メッセージは段階化ロジックに合わせた内容（合計値と閾値）を出力する
- R4 (should): When 上記変更を行ったとき、既存テストを新しい閾値・判定ロジックに合わせて更新し、境界値（合計 1 で fail、合計 2 で pass、スコア 15 で fail、スコア 16 で pass）を検証する

## Q&A
- Q: #255 関連の前提修正は入っているか？
  - A: 入っている。実データ検証を含むスコープで進める
- Q: 設計アプローチは？
  - A: 案 A（段階化 + 閾値引き下げ）を採用。根拠(既存コードパターン): `composeAutoCheck()` は hard-gate と threshold を独立した判定段階として扱う構造であり、この構造を維持しつつ判定基準のみ変更する。根拠(データ分析): hard-gate 廃止だと ambiguity=0 かつ他が満点のケース（合計 18 点）が通過するリスクがある。段階化なら致命的な曖昧さ（2 項以上が 0）を確実にブロックできる
- Q: テスト戦略は？
  - A: 既存テスト(`tests/unit/flow/run-auto-check.test.js`)の hard-gate / threshold 関連ケースを更新。根拠(既存テストパターン): 現在 `hardGateFailed` と `computeScore` の単体テストが存在し、境界値テストの追加は同じパターンに沿う
- Q: reason メッセージの形式は？
  - A: 人間の可読性は不要。根拠(プロジェクト設計): auto-check の eligible 判定は AI に委ねられており、reason は flow.json への記録用。機械可読な形式で現行踏襲する

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-25
- Notes:
