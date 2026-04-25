# Draft: 228-fix-baseline-exit-code

**開発種別:** docs
**目的:** `flow run tests --baseline` の exit code がテスト結果ではなく baseline 書き込み成否を表す設計を文書化し、呼び出し側の誤解を防ぐ。

## Requirements
- R1: SDD flow skill の baseline 取得手順（B.5）において、CLI の exit code は baseline 書き込みの成否を表すものであり、テスト結果の pass/fail は `data.exitCode` を参照すべきことを明記する。
- R2: baseline テスト実行モジュールの JSDoc において、戻り値の `exitCode` フィールドが subprocess の exit code であり、CLI コマンド自体の exit code とは独立であることを記述する。

## Scope Verification
- In scope:
  - R1: flow skill テンプレートの baseline 手順に exit code の意味を追記
  - R2: baseline テスト実行モジュールの JSDoc に戻り値フィールドの説明を追加
- Out of scope:
  - exit code のミラー（REQ-11 の意図を維持、変更しない）
  - 新規テストの追加（コメント/ドキュメント変更のみ）

## Impact on Existing Features
- 影響なし。コード変更はコメント/ドキュメントのみ。

## Q&A
- Q1: exit code をミラーするか、現状維持+文書化か？
  - A: 現状維持+文書化。REQ-11 で意図的に設計されており、唯一の呼び出し元（SDD flow skill）は envelope を解析するため実害なし。
- Q2: 文書化のスコープは？
  - A: skill テンプレート B.5 + run-tests.js JSDoc の両方。run-tests.js の REQ-11 コメントは既に十分。
- Q3: テスト戦略は？
  - A: 既存テストの回帰確認のみ。機能変更なし。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-24
- Notes: Issue #253 の対応方針として B（現状維持+文書化）を選択
