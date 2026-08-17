# Draft: 134-fill-skill-guardrail-gaps

**開発種別**: バグ修正（SKILL.md の guardrail/gate/review 呼び出し漏れ）
**目的**: SDD フロー内の guardrail/gate/review 呼び出しの抜けを修正し、全フェーズで一貫した品質チェックが実行されるようにする

## Q&A

- Q1: test 用 guardrail の扱いは？
  - A: SKILL.md に `get guardrail test` の呼び出しを入れる。`get guardrail` コマンドの phase バリデーションに test を追加する。guardrail 記事自体の作成は別タスク

- Q2: `get guardrail` の test phase 対応は？
  - A: phase バリデーションに test を追加。記事がなければ空結果を返す

- Q3: 全体の修正範囲は？
  - A: SKILL.md 3箇所 + コマンド1箇所の最小修正

## 要件まとめ

優先順位順:

1. When: flow-plan スキルの spec 起草ステップが実行される場合、`sdd-forge flow get guardrail spec` を呼び出し、AI が guardrail 原則を参照してから spec を記述する
2. When: flow-plan スキルの test フェーズが実行される場合、`sdd-forge flow get guardrail test` で guardrail を参照し、テスト作成後に `sdd-forge flow run review --phase test` でテスト品質レビューを実行する
3. When: flow-impl スキルの code review が完了した場合、`sdd-forge flow run gate --phase impl` を再実行し、review の自動修正が spec 要件や guardrail を壊していないか再検証する
4. When: `sdd-forge flow get guardrail test` が実行される場合、エラーではなく空結果を返す（phase バリデーションに test を追加）

## 既存機能への影響

- flow-plan SKILL.md: spec 起草ステップと test フェーズに呼び出し追加。既存ステップの動作は変わらない
- flow-impl SKILL.md: code review 後に gate 再検証ステップ追加。既存ステップの動作は変わらない
- get-guardrail.js: phase バリデーションに test を追加。既存の draft/spec/impl/lint は影響なし

## テスト戦略

- 既存テスト全通過の確認
- get-guardrail の test phase が空結果を返すことを spec テストで検証

- [x] User approved this draft
- Confirmed at: 2026-04-03
- Notes: guardrail 記事の作成は別タスク。SKILL.md への組み込みとコマンド対応のみ
