# Feature Specification: 106-auto-generate-pr-description

**Feature Branch**: `feature/106-auto-generate-pr-description`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #37

## Goal
flow-finalize の PR ルートで、spec.md の Goal / Requirements / Scope セクションから PR の title と body を構造的に自動生成する。

## Scope
- `src/flow/commands/merge.js` の `buildPrBody()` を拡張し、spec.md を読んで PR body を生成する
- PR title を spec.md の Goal から生成する（現在は spec ディレクトリ名をそのまま使用）
- spec.md が存在しない場合は現在の動作（request ベース）にフォールバック

## Out of Scope
- squash merge ルートのコミットメッセージ変更（別途対応済み）
- spec.md のフォーマット変更
- finalize スキル（SKILL.md）の変更

## Clarifications (Q&A)
- Q: PR body にどのセクションを含めるか？
  - A: fixes #N（issue あれば）、Goal、Requirements、Scope の順。Out of Scope は含めない。
- Q: PR title のフォーマットは？
  - A: spec.md の Goal セクションの最初の行をそのまま使う。複数行の場合は1行目のみ。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: 承認済み

## Requirements
1. [P0] PR ルート実行時に、`merge.js` が flow.json の `spec` フィールドからファイルパスを解決し、spec.md の Goal / Requirements / Scope セクションをパースする関数を追加する
2. [P0] `buildPrBody()` を拡張し、PR ルート実行時に spec.md のセクション（fixes #N → Goal → Requirements → Scope）から構造化された PR body を生成する
3. [P0] `buildPrTitle()` を新設し、PR ルート実行時に spec.md の Goal の1行目から PR title を生成する。`gh pr create --title` に渡す
4. [P1] spec.md が存在しない、セクションが空、またはパースに失敗した場合は現行動作にフォールバックする。具体的には: title は `state.spec` からディレクトリ名を抽出（現行の `specTitle` 変数）、body は `fixes #N` + `state.request` から生成（現行の `buildPrBody`）

## Impact on Existing Code
- `buildPrBody(state)` のシグネチャを `buildPrBody(state, root)` に変更（root は spec.md の読み込みに必要）
- `gh pr create --title` に渡す値の生成元を `specTitle` 変数から `buildPrTitle()` 関数に変更
- 既存の `gh pr create` 呼び出し構造は維持。引数の値のみが変わる

## Acceptance Criteria
- PR ルートで finalize した際、PR body に Goal / Requirements / Scope が含まれること
- PR title が spec.md の Goal の1行目であること
- issue が設定されていれば `fixes #N` が PR body の先頭に含まれること
- spec.md が存在しない場合、現行動作（request ベース）で動作すること

## Open Questions
- [ ]
