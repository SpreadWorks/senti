# Feature Specification: 230-fix-guardrail-false-positives

**Feature Branch**: `feature/230-fix-guardrail-false-positives`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #267

## Goal
直近12 specのissue-logで繰り返し発生しているガードレール評価の false positive 5件を修正し、不要なリトライコストを削減する

## Background
直近12 specのissue-logを分析した結果、5つのガードレールが構造的に false positive を発生させていることが判明。draft-scope-boundary (23回)、complete-context (22回)、prioritize-requirements (10回)、task-single-responsibility (8回)、exit-code-contract (6回)。これらは毎回リトライを消費し、フロー効率を大幅に低下させている。

## Scope
- ガードレール定義 body テキストの緩和（draft-scope-boundary, complete-context, prioritize-requirements）
- exit-code-contract の phase を task-impl のみに限定
- ゲート評価時の T-pending-spec プレースホルダー除外

## Out of Scope
- ガードレールの追加・削除
- AI プロンプト構築ロジックの変更
- flow lifecycle の不整合修正（issue #268 で別対応）

## Constraints
- 正当な違反の検出力を下げない（false negative を増やさない）
- ガードレール ID の変更なし（既存の issue-log との参照整合性維持）

## Design Principles
-

## Overview
### Modules
- src/presets/base/guardrail.json — 全プリセット共通のガードレール定義
- src/presets/cli/guardrail.json — CLI プリセット固有のガードレール定義
- src/flow/lib/run-gate.js — ゲート評価の実行ロジック

### Data Flow
-

### Decisions
- body テキストの緩和で対処する。ガードレール削除や phase 除外ではなく、判定基準を明確化する方向
- T-pending-spec はゲート評価入力のフィルタリングで対処する。prepare-spec のプレースホルダー生成は維持
- 既存機能への影響: gate-draft の draft-scope-boundary FAIL 率低下、gate-spec の task-single-responsibility/prioritize-requirements FAIL 率低下、gate-impl の exit-code-contract は引き続き評価。既存の PASS 判定には影響なし（body 緩和方向のみ）

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- ガードレールを削除する — 本来の目的（不完全な要件の検出など）は有用なので、削除ではなく body 緩和が適切
- draft-scope-boundary の phase から draft を除外する — draft でも実装設計の記述は防ぎたいので、phase 除外ではなく body 緩和が適切
- prepare-spec で T-pending-spec プレースホルダーを生成しない — flow.json の tasks が空配列だと他の箇所に影響する可能性があり、フィルタリングの方が安全

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- REQ-1 [must]: draft-scope-boundary の body は「ファイルパスや関数名の言及は許容する。アルゴリズム記述や内部設計の詳細（データ構造、制御フロー、API 設計）のみ禁止する」という判定基準を含む文言に変更する。
- REQ-2 [must]: complete-context の body を変更する。変更後の body は (1) trigger condition と expected behavior の両方が記述されていること、(2) when/if/shall 等の特定構文パターンの使用は判定条件に含めないこと、の2点を明記する。
- REQ-3 [must]: run-gate.js が task-single-responsibility を評価する際、flow.json.tasks から id === 'T-pending-spec' のエントリを除外してから AI 評価に渡す。
- REQ-4 [must]: prioritize-requirements の body の 'exceed three items' を 'more than three items' に変更し、3件丁度を含まない表現にする。
- REQ-5 [must]: cli/guardrail.json の exit-code-contract の meta.phase を ['task-impl'] のみに変更する。spec フェーズでの評価を除外する。

## Acceptance Criteria
- draft-scope-boundary の body が、ファイルパス・関数名の言及を許容し、アルゴリズム・設計の記述のみ禁止する表現になっている
- complete-context の body が、意味的な trigger→behavior の対応を評価し、構文形式を強制しない表現になっている
- ゲート評価時に T-pending-spec がタスクリストから除外される
- prioritize-requirements の body が 'more than three' と明確化されている
- exit-code-contract の phase が ['task-impl'] のみである
- 既存テストが全てパスする

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [pending]: Pending spec definition
  - Placeholder task until spec.json tasks[] is populated.
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Relax guardrail body texts in base and cli preset
  - Adjust body text for draft-scope-boundary, complete-context, prioritize-requirements in base/guardrail.json and restrict exit-code-contract phase in cli/guardrail.json
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Filter T-pending-spec from gate evaluation input
  - Exclude placeholder task T-pending-spec from the task list passed to gate evaluation so it does not trigger task-single-responsibility failures
  - see `tasks/T-2.md` for full spec
