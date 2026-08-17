# Feature Specification: 070-lang-layer-e2e-tests

**Feature Branch**: `feature/070-lang-layer-e2e-tests`
**Created**: 2026-03-18
**Status**: Draft
**Input**: lang層（合成モジュール方式）の e2e テスト追加

## Goal

preset 階層の lang 層（`preset.json` の `lang` フィールド）が scan, init, data の各ステップで正しく合成されることを e2e テストで検証する。

## Scope

- scan e2e テスト: lang 層の DataSource がロードされ、analysis.json に結果が含まれること
- init e2e テスト: lang 層のテンプレートが合成され、章ファイルが正しく生成されること
- data e2e テスト: lang 層の DataSource でディレクティブが解決されること
- 対象 lang 層: node（node-cli で検証）、php（laravel で検証）

## Out of Scope

- enrich, text, readme の lang 層テスト（AI 呼び出しが必要で e2e テストに不向き）
- 新規 fixture の作成（既存 acceptance fixture を再利用）
- 本体コードの変更（テスト追加のみ）

## Clarifications (Q&A)

- Q: テスト粒度は？
  - A: scan, init, data を個別に実行して各ステップで lang 層が効いていることを検証

- Q: どの preset で検証する？
  - A: node-cli（node 層）と laravel（php 層）の両方

- Q: fixture はどうする？
  - A: `tests/acceptance/fixtures/node-cli/` と `tests/acceptance/fixtures/laravel/` を再利用

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-18
- Notes:

## Requirements

1. **scan-node**: `cli/node-cli` type で scan 実行 → analysis.json に node lang 層の `config` DataSource の scan 結果（`extras` 内の `packageDeps`, `packageScripts` 等）が含まれること
2. **scan-php**: `webapp/laravel` type で scan 実行 → analysis.json に php lang 層経由のデータ（`extras` 内の `composerDeps` 等）が含まれること
3. **init-node**: `cli/node-cli` type で init 実行 → lang 層の `stack_and_ops.md` テンプレートが章に含まれること
4. **init-php**: `webapp/laravel` type で init 実行 → webapp + laravel の章テンプレートが生成されること（ja テンプレートへのフォールバック含む）
5. **init-chapters-order**: `resolveChaptersOrder()` が lang 層の chapters を union マージして正しい順序を返すこと
6. **data-node**: `cli/node-cli` type で init + data 実行 → `{{data: config.stack(...)}}` ディレクティブが node lang 層の DataSource で解決されること
7. **data-php**: `webapp/laravel` type で init + data 実行 → `{{data: config.composer(...)}}` ディレクティブが laravel DataSource で解決されること

## Acceptance Criteria

- 全テストが `npm test` で PASS すること
- 既存テストが壊れないこと
- テストファイルは `tests/e2e/docs/commands/` 配下に配置
- fixture は既存の `tests/acceptance/fixtures/` を再利用（新規作成しない）

## Open Questions

(none)
