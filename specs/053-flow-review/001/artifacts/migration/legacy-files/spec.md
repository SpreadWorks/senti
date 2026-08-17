# Feature Specification: 053-flow-review

**Feature Branch**: `feature/053-flow-review`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User request

## Goal
SDD フローの実装完了後に、コード品質レビューを行う `sdd-forge flow review` コマンドを追加する。
2段階レビュー（draft → final）で提案を生成・検証し、ユーザー承認後に適用する。

## Scope
- `sdd-forge flow review` コマンドの新規作成（`src/flow/commands/review.js`）
- `src/flow.js` ディスパッチャーへの `review` ルート追加
- `FLOW_STEPS` への `review` ステップ追加（`implement` と `finalize` の間）
- `config.json` の `agent.commands` で `flow.review.draft` / `flow.review.final` を個別設定可能にする
- レビュー結果を `specs/NNN-xxx/review.md` に保存

## Out of Scope
- `flow close` スキルへの review 呼び出し組み込み（スキル側は別途対応）
- レビュー観点のカスタマイズ設定（将来拡張）
- 個別提案の承認/却下（一括判断のみ）

## Clarifications (Q&A)
- Q: レビュー対象のファイル特定方法は？
  - A: spec scope から対象ファイルを特定。特定できなければ base ブランチとの diff にフォールバック
- Q: 同じエージェントでレビューする意味はあるか？
  - A: system prompt で異なるレビュー観点を与えれば有効。エージェント設定は config.json に従う
- Q: フェーズ名は？
  - A: `flow.review.draft`（提案生成）/ `flow.review.final`（提案検証）
- Q: 却下された提案の扱いは？
  - A: review.md 上で却下理由を付けてマーク。全提案 + 判定結果が残る

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-14
- Notes: Open Question (apply の command ID) は実装時に判断

## Requirements
1. ユーザーが `sdd-forge flow review` を実行したとき、コード品質レビューフローを開始する
2. レビュー開始時に実施確認プロンプトを表示する（Yes/No → No ならスキップ）
3. draft フェーズ: `flow.review.draft` エージェントで改善提案を生成し review.md に出力する
4. draft フェーズ完了後、final フェーズで `flow.review.final` エージェントが各提案を「コード品質の改善に寄与するか」「既存の振る舞いを壊さないか」の観点で判定し、却下時は理由を付けて review.md を更新する
5. final フェーズ完了後、承認された提案をユーザーに提示し、全承認/全却下の選択を受け付ける
6. ユーザーが承認したとき、`flow.review.draft` エージェントで提案を実装する
7. `sdd-forge flow status` を実行したとき、review ステップが implement と finalize の間に表示される
8. `sdd-forge flow review` を実行したとき、flow.js が `flow/commands/review.js` にルーティングする
9. レビュー対象の特定時、spec scope からファイルを特定し、特定できなければ base ブランチとの diff にフォールバックする
10. エージェント解決時、config.json に `flow.review.draft` や `flow.review.final` が設定されていればそれを使い、なければ親キー `flow.review` → `flow` → default の順にフォールバックする

## Acceptance Criteria
- `sdd-forge flow review` が正常に実行できる
- config.json で `flow.review.draft` と `flow.review.final` に別々のエージェントを設定できる
- review.md にすべての提案と判定結果（承認/却下+理由）が記録される
- ユーザーが「レビューしない」を選択した場合、スキップされる
- `sdd-forge flow status` で review ステップの進捗が表示される

## Open Questions
- [x] apply フェーズのエージェントは `flow.review.draft` と同じものを使う（別 command ID は設けない）
