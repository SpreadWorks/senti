# Draft: #27 CakePHP2 英語ドキュメントへの日本語混入

## 原因

- `enrich.js` の `buildEnrichPrompt()` が AI に渡す言語指示が曖昧
- 現在: `"Write in the project's primary language (match the existing analysis data language)."`
- AI が PHP ソースコードの日本語コメントを「主要言語」と解釈し、summary/detail を日本語で生成
- `{{data}}` ディレクティブが analysis.json の summary/detail をそのまま出力 → 英語ドキュメントに日本語が混入

## 影響箇所（acceptance テストで確認済み）

- `controller_routes.md` — routing section が日本語
- command list table — purpose column が日本語
- `db_tables.md` — descriptions が日本語
- `project_structure.md` — table content が日本語

## 修正方針

- `buildEnrichPrompt()` に `lang` パラメータを追加
- `config.docs.defaultLanguage` を渡して `"Write summary and detail in English."` のように明示指定

## 確認済み事項

- テンプレート（en/ja）自体は正しく分離されている — 問題なし
- `{{text}}` の system prompt は `cfg.docs.defaultLanguage` を使っており正しい
- 問題は `enrich` → `{{data}}` のパス

- [x] User approved this draft (2026-03-30)
