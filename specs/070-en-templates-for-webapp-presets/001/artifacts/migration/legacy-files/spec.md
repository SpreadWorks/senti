# Feature Specification: 070-en-templates-for-webapp-presets

**Feature Branch**: `feature/070-en-templates-for-webapp-presets`
**Created**: 2026-03-18
**Status**: Draft
**Input**: webapp/laravel/symfony/cakephp2 の en テンプレートを作成する

## Goal

webapp 系プリセット（webapp, laravel, symfony, cakephp2）に英語版章テンプレートを追加し、`languages: ["en"]` 単一指定でも全章が生成されるようにする。

## Scope

- webapp/templates/en/ に 7 ファイル追加: auth_and_session.md, batch_and_shell.md, business_logic.md, controller_routes.md, database_architecture.md, db_tables.md, README.md
- laravel/templates/en/ に 5 ファイル追加: auth_and_session.md, controller_routes.md, db_tables.md, project_structure.md, stack_and_ops.md
- symfony/templates/en/ に 5 ファイル追加: auth_and_session.md, controller_routes.md, db_tables.md, project_structure.md, stack_and_ops.md
- cakephp2/templates/en/ に 6 ファイル追加: auth_and_session.md, controller_routes.md, db_tables.md, development.md, project_structure.md, stack_and_ops.md

## Out of Scope

- 既存の ja テンプレートの修正
- base プリセットのテンプレート変更
- cli/library/node/node-cli プリセットのテンプレート
- guardrail.md（既に en 版が存在）
- テンプレート継承ロジック（src/ コード）の変更

## Clarifications (Q&A)

- Q: 翻訳方針は？
  - A: ja テンプレートの構造を完全に保持し、見出し・プロンプト・ラベルを英語化する。ディレクティブ構文や @block 構文は変更しない。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-18
- Notes: 全 23 ファイルを作成。AI が ja テンプレートを英語化。

## Requirements

1. webapp/templates/en/ に 7 つの英語版テンプレートを作成する
2. laravel/templates/en/ に 5 つの英語版テンプレートを作成する
3. symfony/templates/en/ に 5 つの英語版テンプレートを作成する
4. cakephp2/templates/en/ に 6 つの英語版テンプレートを作成する
5. 全テンプレートで ja 版と同一の `{{data}}` / `{{text}}` / `@block` 構造を保持する
6. `{{data}}` ラベル（テーブルヘッダー）を英語化する
7. `{{text}}` プロンプト指示文を英語化する
8. Markdown 見出し・固定テキストを英語化する

## Acceptance Criteria

- `languages: ["en"]` で init 実行時に webapp 系プリセットの全章が生成される
- 生成された章ファイルの `{{data}}` / `{{text}}` ディレクティブ構造が ja 版と一致する
- en テンプレート内に日本語テキストが残っていない（ディレクティブ構文・コード例を除く）
- 既存テストが全て PASS する

## Open Questions

(none)
