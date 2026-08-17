# Feature Specification: 055-parallel-translate

**Feature Branch**: `feature/055-parallel-translate`
**Created**: 2026-03-15
**Status**: Draft
**Input**: User request

## Goal
- translate コマンドのファイル翻訳を並列実行し、多言語・多ファイル時の処理時間を短縮する

## Scope
- `src/docs/commands/translate.js` の逐次ループを `mapWithConcurrency()` による並列処理に置き換える

## Out of Scope
- 翻訳品質の変更
- 新しい CLI オプションの追加（並列度は既存の `config.limits.concurrency` を使用）
- translate 以外のコマンドの変更

## Clarifications (Q&A)
- Q: 並列度はどう決めるか？
  - A: 既存パターン（forge.js, text.js）に従い `resolveConcurrency(config)` を使用（デフォルト5）
- Q: 並列化の粒度は？
  - A: 言語×ファイルの全組み合わせをフラット化して並列処理する（言語ごとの逐次ループは廃止）
- Q: README.md の扱いは？
  - A: 章ファイルと同じバッチに含めてフラット化する

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-15
- Notes: 実装へ進む

## Requirements
1. 言語×ファイル（章ファイル＋README）をフラットなタスクリストに展開する
2. dry-run / force / mtime チェックでフィルタし、翻訳不要なファイルを除外する
3. `mapWithConcurrency()` と `resolveConcurrency(config)` を使って並列翻訳する
4. 各言語の出力ディレクトリ（`docs/<lang>/`）をタスク実行前に作成する
5. エラー時は該当ファイルをログに出力し、他のファイルの翻訳は継続する（現行と同じ）
6. 翻訳結果のカウント（translated / skipped）を現行と同じ形式で出力する

## Acceptance Criteria
1. `sdd-forge docs translate` で章ファイルと README が並列翻訳される
2. `--dry-run` / `--force` / mtime スキップの挙動が現行と同一
3. 既存テストが通る
4. エラー発生時に他ファイルの翻訳が継続する

## Open Questions
- (なし)
