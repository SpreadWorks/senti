# Feature Specification: 113-unify-and-define-exit-code-constants

**Feature Branch**: `feature/113-unify-and-define-exit-code-constants`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #49

## Goal
終了コードの意味を定義し定数として集約する。現在 `forge.js` は `exitCode=2`、`text.js` は `exitCode=1` を使用しているが意味の区別が未定義。`0`（成功）と `1`（エラー）の2値に統一し、定数ファイルから参照する形に変更する。

## Scope
- `src/lib/exit-codes.js` を新規作成し `EXIT_SUCCESS` (0) と `EXIT_ERROR` (1) を定義
- `process.exitCode` / `process.exit()` の呼び出し箇所を定数参照に置換
- `forge.js` の `exitCode=2` を `EXIT_ERROR` (1) に統一

## Out of Scope
- `flow-envelope.js` の `output()` — ok フィールドで 0/1 を自動決定する独自ロジック。定数化の対象外
- `process.exit(0)` の成功パス — 可読性改善として `EXIT_SUCCESS` に置換できるが、本 spec では必須としない
- 終了コードの意味を3値以上に拡張すること

## Clarifications (Q&A)
- Q: forge.js の exitCode=2 はなぜ 1 に統一するのか？
  - A: 呼び出し元（シェル、CI）は 0 か非0 かしか見ない。2 の意味が定義されておらず 1 との区別が有用でない。alpha 版ポリシーでシンプルさを優先。
- Q: flow-envelope.js はなぜ対象外か？
  - A: `output()` が JSON envelope の `ok` フィールドから自動的に exit code を決定する独自ロジック。定数を導入しても利点がない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: autoApprove モード

## Requirements

### R1: exit-codes.js の作成（優先度: 1）
- R2 で各コマンドファイルが終了コード定数を参照するために、`src/lib/exit-codes.js` を新規作成する
- `export const EXIT_SUCCESS = 0;` と `export const EXIT_ERROR = 1;` を定義する

### R2: process.exitCode の呼び出し箇所を定数参照に置換（優先度: 2）
- `process.exitCode = 1` → `process.exitCode = EXIT_ERROR` に置換する
- `process.exitCode = 2`（forge.js）→ `process.exitCode = EXIT_ERROR` に置換する（値を 2 から 1 に変更）
- `process.exit(1)` → `process.exit(EXIT_ERROR)` に置換する
- 対象は `src/` 配下の全 `.js` ファイル（テストファイルは除外）
- `flow-envelope.js` の `process.exit(envelope.ok ? 0 : 1)` は対象外

## Acceptance Criteria
1. `src/lib/exit-codes.js` が存在し `EXIT_SUCCESS` と `EXIT_ERROR` が export されていること
2. `src/` 配下で `process.exitCode = 2` が存在しないこと
3. `process.exit(1)` / `process.exitCode = 1` の呼び出しが `EXIT_ERROR` 定数を参照していること
4. 既存テストがパスすること

## Open Questions
なし
