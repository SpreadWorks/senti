# Feature Specification: 117-improve-enrich-speed

**Feature Branch**: `feature/117-improve-enrich-speed`
**Created**: 2026-04-01
**Status**: Draft
**Input**: GitHub Issue #58

## Goal
enrich の実行速度を 10 分 → 1-2 分に改善する。Essential 埋め込み（Tool use 廃止）、concurrency 並列化、トークンベースバッチ分割、detail 短縮、keywords 英語統一を組み合わせて実現する。

## Scope
- `src/docs/commands/enrich.js` のバッチ処理・プロンプト生成を全面改善
- `src/docs/lib/minify.js` に `mode: "essential"` オプションを追加
- `src/lib/types.js` の config バリデーションに `agent.batchTokenLimit` を追加

## Out of Scope
- Dependency-weighted compression（被参照回数による適応圧縮）— 本 spec の改善効果を確認後に別 spec で検討
- text コマンドの minify mode 切り替え — 本 spec では minify に mode オプションを追加するのみ。text での利用は別 spec
- enrich 以外のコマンドの速度改善

## Clarifications (Q&A)
- Q: Essential 抽出はどこに実装するか？
  - A: `minify.js` に `mode` オプションを追加。`minify(code, filePath, { mode: "essential" })` で Essential 抽出。デフォルトは現行動作（コメント削除）。text の deep モードでも将来的に共用可能。
- Q: バッチトークン上限の config はどこに置くか？
  - A: `agent.batchTokenLimit`。デフォルト 10,000。AI モデルのコンテキストウィンドウはプロバイダー・モデルにより異なるため設定可能にする。
- Q: 既存の `docs.enrichBatchSize` / `docs.enrichBatchLines` はどうなるか？
  - A: alpha 版ポリシーにより後方互換は不要。トークンベースに置き換え、旧設定は削除する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-01
- Notes: 承認済み

## Requirements
1. [P0] `minify.js` に `mode: "essential"` オプションを追加する。`minify(code, filePath, { mode: "essential" })` が呼ばれた場合、import 文・export 文・return 文・throw 文・主要 API 呼び出し（fs.*, path.*, JSON.*, process.*, child_process）を残し、それ以外の行を削除する。デフォルト（mode なし）は現行動作を維持する
2. [P0] `buildEnrichPrompt()` を変更する。ファイルリスト方式（AI が Tool use でファイルを読む）から、Essential 抽出結果をプロンプトに埋め込む方式に切り替える。各エントリに対して `minify(sourceCode, filePath, { mode: "essential" })` を呼び出し、結果をプロンプトの Target files セクションにコードブロックとして埋め込む
3. [P0] `splitIntoBatches()` をトークンベースに変更する。バッチ分割基準をファイル数固定（現在 20 件）から、Essential 抽出後のトークン数上限（`agent.batchTokenLimit`、デフォルト 10,000）に変更する。トークン数は `Math.ceil(text.length / 4)` で概算する
4. [P0] enrich のバッチループを `mapWithConcurrency(batches, concurrency, worker)` に変更する。`concurrency` は `resolveConcurrency(config)` で取得する（既存設定 `config.concurrency` を利用）
5. [P1] `buildEnrichPrompt()` の detail ルールを `"detail should capture implementation details. Do not omit information."` から `"detail: 3-5 sentences summarizing key implementation patterns and logic."` に変更する
6. [P1] `buildEnrichPrompt()` の keywords 言語指示を変更する。`"keywords may contain terms in any language"` から `"keywords must be in English"` に変更する
7. [P1] `src/lib/types.js` の config バリデーションに `agent.batchTokenLimit`（number、省略可）を追加する。旧設定 `docs.enrichBatchSize` / `docs.enrichBatchLines` について: 本プロジェクトは alpha 版（0.1.0-alpha.N）であり安定版リリース前のため、後方互換コードは不要（CLAUDE.md「alpha 版ポリシー: 後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除する」に基づく）。旧設定は types.js のバリデーションから削除し、enrich.js の参照も削除する

## Guardrail Exemptions
- CLI インターフェースの後方互換性: `docs.enrichBatchSize` / `docs.enrichBatchLines` の削除は alpha 版ポリシー（CLAUDE.md 記載）により移行手順を免除する。alpha 期間中は安定版ユーザーが存在しないため、移行コスト対効果が成立しない

## Impact on Existing Code
- `src/docs/lib/minify.js`: `mode` オプション追加。既存の呼び出し（mode なし）は動作変更なし
- `src/docs/commands/enrich.js`: `buildEnrichPrompt`、`splitIntoBatches`、バッチループの 3 箇所を変更。`collectEntries` でソースコード読み込みを追加
- `src/lib/types.js`: `agent.batchTokenLimit` のバリデーション追加。`docs.enrichBatchSize` / `docs.enrichBatchLines` 削除
- `tests/unit/docs/commands/enrich.test.js`: `splitIntoBatches` のテストがバッチ分割基準変更により影響を受ける
- `tests/unit/docs/lib/minify.test.js`: `mode: "essential"` のテスト追加が必要

## Acceptance Criteria
- `minify(code, filePath, { mode: "essential" })` が import/export/return/throw/主要 API 呼び出しのみを返すこと
- `minify(code, filePath)` の既存動作が変わらないこと
- enrich がバッチを `mapWithConcurrency` で並列実行すること
- バッチ分割がトークン数ベースで行われること（`agent.batchTokenLimit` に従う）
- `buildEnrichPrompt` がソースコードの Essential をプロンプトに埋め込むこと（ファイルリスト方式ではない）
- `npm test` が全件 PASS すること

## Open Questions
- [ ]
