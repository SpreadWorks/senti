# Feature Specification: 228-fix-baseline-exit-code

**Feature Branch**: `feature/228-fix-baseline-exit-code`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #253

## Goal
`flow run tests --baseline` の exit code 設計を文書化し、呼び出し側がテスト結果の pass/fail を正しく判断できるようにする。

## Background
`flow run tests --baseline` は内部で `npm test` を起動して baseline を計測する。ラッパーコマンドの exit code は「baseline 書き込みに成功したか」を表し、テスト自体の pass/fail とは独立している（REQ-11 で意図的に設計）。テスト結果は JSON envelope の `data.exitCode` から取得する必要があるが、この設計が文書化されていないため、呼び出し側が exit code = 0 を「テスト green」と誤解するリスクがある。

## Scope
- SDD flow skill テンプレートの baseline 取得手順（B.5）に exit code の意味を明記
- baseline テスト実行モジュールの JSDoc に戻り値フィールドの説明を追加

## Out of Scope
- exit code のミラー（REQ-11 の設計意図を維持し、変更しない）
- 新規テストの追加（コメント/ドキュメント変更のみのため不要）

## Constraints
- コード変更はコメント/ドキュメントのみ。ランタイム動作を変更しない。

## Design Principles
- REQ-11 の「baseline は計測成功を表す」設計を尊重する。

## Overview
### Modules
- `src/flow/lib/run-tests.js`: JSDoc に戻り値の exitCode フィールドの意味を追記
- `src/templates/skills/sdd-forge.flow.md`: B.5 セクションに exit code の解釈ルールを追記

### Data Flow
- 変更なし。既存のデータフローには影響しない。

### Decisions
- exit code ミラー (案A) は不採用。REQ-11 の「baseline 書き込み成否」と「テスト pass/fail」は意味的に異なるシグナルであり、混同すべきでない。

## Clarifications (Q&A)
- Q: exit code をミラーするか、現状維持+文書化か？
  - A: 現状維持+文書化。REQ-11 の意図を維持。唯一の呼び出し元（SDD flow skill）は JSON envelope を解析するため実害なし。
- Q: 文書化のスコープは？
  - A: flow skill テンプレート B.5 + run-tests.js JSDoc。REQ-11 コメントは既に十分。

## Alternatives Considered
- **案A（exit code ミラー）**: subprocess の exit code をそのまま CLI の exit code として返す。不採用理由: 「baseline 取得成功」と「テスト成功」の2つの異なるシグナルを混同させるため。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-24
- Notes: draft 承認済み。docs 種別。

## Requirements
- R1: SDD flow skill テンプレートの B.5 セクションにおいて、`flow run tests --baseline` の CLI exit code は baseline 書き込みの成否を表すこと、テスト結果の pass/fail は `data.exitCode` を参照すべきことを明記する。
- R2: `src/flow/lib/run-tests.js` の JSDoc において、戻り値オブジェクトの `exitCode` フィールドが subprocess（`npm test` 等）の exit code であり、CLI コマンド自体の exit code（baseline モードでは常に 0）とは独立であることを記述する。

## Acceptance Criteria
- AC1: flow skill テンプレートの B.5 セクションに exit code の意味の説明が追記されている。
- AC2: `run-tests.js` の JSDoc に `exitCode` フィールドの説明が含まれている。
- AC3: ランタイム動作に変更がない（既存テストが全て PASS する）。

## Implementation Targets
- `src/templates/skills/sdd-forge.flow.md`
- `src/flow/lib/run-tests.js`

## Open Questions
- なし
