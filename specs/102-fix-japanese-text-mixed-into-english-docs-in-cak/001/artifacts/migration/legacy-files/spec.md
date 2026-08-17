# Feature Specification: 102-fix-japanese-text-mixed-into-english-docs-in-cak

**Feature Branch**: `feature/102-fix-japanese-text-mixed-into-english-docs-in-cak`
**Created**: 2026-03-30
**Status**: Draft
**Input**: GitHub Issue #27

## Goal

`enrich` コマンドが AI に渡す言語指示を明示化し、`config.docs.defaultLanguage` に従った言語で summary/detail を生成させる。これにより英語ドキュメントへの日本語混入を防ぐ。

## Scope

- `src/docs/commands/enrich.js` の `buildEnrichPrompt()` を修正

## Out of Scope

- DataSource 側の多言語対応（analysis.json は defaultLanguage の 1 言語のみ）
- `{{text}}` ディレクティブの言語制御（既に正しく動作）
- テンプレートの修正（既に正しく en/ja 分離済み）

## Clarifications (Q&A)

- Q: 多言語ドキュメントの場合、enrich は 1 回のみで analysis.json は 1 つだが、非デフォルト言語の `{{data}}` 出力が defaultLanguage になる問題は？
  - A: 既存の動作として許容。`{{data}}` は analysis ベースで defaultLanguage に従う。非デフォルト言語のコンテンツは `{{text}}` が AI 生成する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-30
- Notes: enrich の言語指示修正のみ。シンプルな変更。

## Requirements

全要件は同一優先度（High）。要件 1→2→3 の順に実装する。

1. When `sdd-forge docs enrich` コマンドが実行されたとき、`main()` は `config.docs.defaultLanguage`（未設定時は `"en"`）を取得し、`buildEnrichPrompt()` の `opts.lang` として渡す。
2. When `buildEnrichPrompt(chapters, batch, opts)` が `opts.lang` を受け取ったとき、言語コードを "English", "Japanese" 等のフル名称にマッピングし、既存の言語指示行 `"Write in the project's primary language (match the existing analysis data language)."` を `"Write summary and detail in ${langName}."` に置き換える。
3. When `opts.lang` の言語コードがマッピングテーブルに存在しないとき、コードをそのまま langName として使用する（例: `"fr"` → `"Write summary and detail in fr."`）。

## Acceptance Criteria

- `node tests/acceptance/run.js cakephp2` を実行し、`culturalFit` が PASS になる
- 英語設定のプロジェクトで `enrich` 実行後、analysis.json の summary/detail が英語で記述されている
- 既存テストが通る

## Open Questions

- [x] テンプレートに問題はないか？ → 問題なし（調査済み）
- [x] `{{text}}` に問題はないか？ → 問題なし（`defaultLanguage` を正しく使用）
