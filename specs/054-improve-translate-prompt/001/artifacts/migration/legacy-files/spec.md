# Feature Specification: 054-improve-translate-prompt

**Feature Branch**: `feature/054-improve-translate-prompt`
**Created**: 2026-03-15
**Status**: Draft
**Input**: translate コマンドの翻訳プロンプトを改善し、直訳的でない自然な翻訳を生成する

## Goal
`translateDocument()` の system prompt を改善し、対象言語で自然に読める翻訳を生成する。

## Scope
- `src/docs/commands/translate.js` の `translateDocument()` 内の system prompt を改善する
- `documentStyle.tone` を翻訳プロンプトに反映する（tone を引数で受け取る）

## Out of Scope
- `output.mode: "generate"` の実装（言語毎に text を実行するモード）
- 翻訳以外のコマンドの変更
- documentStyle.tone の選択肢追加

## Clarifications (Q&A)
- Q: カタカナ語の扱いは？
  - A: 細かいルールは指定せず、「直訳的なカタカナ語を避け自然な日本語表現を優先する」旨をプロンプトに含める
- Q: 文体はどう制御するか？
  - A: config.json の `documentStyle.tone` を翻訳プロンプトに渡し、polite=です/ます調、formal=である調、casual=口語的にマッピングする
- Q: 改善の効果をどう検証するか？
  - A: 改善前後で同じファイルを翻訳し、品質を比較する

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-15
- Notes:

## Requirements
1. `translateDocument()` が呼ばれたとき、system prompt に以下の翻訳品質指示を含める: 英語の文構造をそのまま置換せず対象言語の自然な文構造に再構成する、直訳的なカタカナ語を避け自然な表現を優先する、冗長な表現（「〜すること」「〜される」の連続）を避ける、対象言語の慣習・文化を考慮する
2. `translateDocument()` が `documentStyle` を受け取ったとき、`tone` に応じた文体指示を system prompt に含める（polite → です/ます調、formal → である調、casual → 口語的）
3. `main()` 内のループで `translateDocument()` を呼ぶとき、config から `documentStyle` を取得して渡す。config に `documentStyle` が存在しない場合は省略し、翻訳プロンプトの文体指示をスキップする

## Acceptance Criteria
- 改善後のプロンプトで翻訳した日本語が、改善前より自然な表現になっている（品質チェックで確認）
- `documentStyle.tone` が翻訳結果の文体に反映される
- 既存テストが壊れない

## Open Questions
- (none)
