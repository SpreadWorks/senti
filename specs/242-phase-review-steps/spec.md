# Feature Specification: 242-phase-review-steps

**Feature Branch**: `feature/242-phase-review-steps`
**Created**: 2026-04-29
**Status**: Draft
**Input**: GitHub Issue #288

## Goal
draft / spec / test の各フェーズに AI review ステップを追加し、gate では検出できない実質的な品質問題を早期に発見・修正する

## Background
現在 review ステップは impl フェーズにのみ存在する。gate は静的ルール判定であり、draft の設問の浅さ、spec の要求漏れ・スコープクリープ、テスト網羅性の不足といった実質的な品質問題の 65% は gate では検出不可能（87件の指摘の分析に基づく）。外部エージェントによる AI review が各フェーズでこれを補完する。

## Scope
- `src/flow/definition.js` — FLOW_DEFINITION の plan フェーズに review-draft, review-spec, review-test ノードを追加
- `src/lib/constants.js` — VALID_REVIEW_PHASES に "draft" を追加
- `src/flow/commands/review.js` — runDraftReview パイプラインを新規実装
- `src/flow/lib/run-review.js` — parseDraftReviewOutput パーサーを追加
- `src/flow/registry.js` — review の post hook を phase 引数に基づく step id に対応させる
- `src/flow/prompts/plan/` — review-draft.md, review-spec.md, review-test.md を追加

## Out of Scope
- impl review の変更（既存のまま）
- トークンコスト最適化（#0003 の範囲）
- task-level review ステップの追加

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- 既存の CLI インターフェース（`sdd-forge flow run review --phase <type>`）を壊さない
- 既存の impl review / task review の動作を変えない

## Design Principles
- review → gate の順に配置する。review が成果物を修正した後に gate が構造的妥当性を最終確認する
- 既存の runReviewLoop 共通基盤を活用し、3つの review（draft/spec/test）が同じインターフェースで動作する
- 各 review ステップは skippable にし、ユーザーがフロー内でスキップを選択できるようにする

## Overview
### Modules
- definition.js — FLOW_DEFINITION に review-draft, review-spec, review-test FlowNode を追加。配置: draft → review-draft → gate-draft, spec → review-spec → gate(spec), test → review-test
- review.js — runDraftReview 関数を追加。draft.json を対象に request/issue と突合し、QA の不足・曖昧点を指摘・修正する
- run-review.js — parseDraftReviewOutput を追加し、phase=draft のサブプロセス出力をパースする
- registry.js — review の post hook で phase 引数に基づいて正しい step id（review-draft / review-spec / review-test / review）を更新する

### Data Flow
- flow get next-action → review-draft/review-spec/review-test ステップを検出
- AI が sdd-forge flow run review --phase draft/spec/test を実行
- run-review.js が review.js をサブプロセスとして起動（--phase 引数付き）
- review.js 内の runDraftReview/runSpecReview/runTestReview がパイプラインを実行
- 結果を run-review.js が parse し、registry の post hook が step status を更新

### Decisions
- review を gate の前に配置する。review は成果物を修正するため、gate の後に置くと re-gate が必要になり非効率。
- #0003（トークン削減）を待たずに先行実装する。review ステップの実装は #0003 と技術的に独立しており、skippable にすることでコスト懸念時はスキップ可能。

## Clarifications (Q&A)
- Q: review ステップの配置順序は gate の前か後か？
  - A: gate の前。review が成果物を修正するため、gate は修正後の成果物を検証する最終チェックポイントとして配置する
- Q: #0003（トークン削減）を前提条件として待つ必要があるか？
  - A: いいえ。技術的に独立しており、skippable にすることでコスト懸念時はスキップ可能

## Alternatives Considered
- gate → review の順（gate の後に review を配置） — review が成果物を修正するため re-gate が必要になり非効率。採用しない
- #0003（トークン削減）完了を待ってから実装 — 技術的依存がなく、skippable で安全弁を確保できるため、先行実装する
- 全フェーズの review を一から再設計 — 既存の runReviewLoop 共通基盤が十分に成熟しているため不要

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-29T08:07:15.816Z
- Notes:

## Requirements
- R1 [must]: FLOW_DEFINITION の plan フェーズに review-draft, review-spec, review-test の FlowNode を追加する。配置順は draft → review-draft → gate-draft, spec → review-spec → gate(spec), test → review-test とする
- R2 [must]: 追加する 3 つの review ノードは skippable: true, maxAttempts: 3 とし、action は "run-review", instructionsKey はそれぞれ "plan.review-draft", "plan.review-spec", "plan.review-test" とする
- R3 [must]: VALID_REVIEW_PHASES に "draft" を追加する
- R4 [must]: review.js に runDraftReview 関数を実装する。対象は draft.json、基準は request/issue、文脈は analysis.json 軽量インデックス。runReviewLoop 共通基盤を使用し、結果は draft-review.md に保存、verdict を stderr に出力する。成功（verdict=PASS）時は exit 0、失敗（verdict=FAIL）時は exit 1（EXIT_ERROR）。既存の runSpecReview / runTestReview と同じ exit code 契約に従う
- R5 [must]: run-review.js に parseDraftReviewOutput 関数を追加し、phase === "draft" のサブプロセス出力をパースする。出力形式は既存の parseSpecReviewOutput と同等（verdict, issueCount, changed）
- R6 [must]: registry.js の review post hook を更新し、--phase 引数に基づいて正しい step id を更新する。phase=draft → review-draft, phase=spec → review-spec, phase=test → review-test, phase なし → review（既存動作を維持）
- R7 [must]: prompts/plan/ に review-draft.md, review-spec.md, review-test.md を追加する。各プロンプトは sdd-forge flow run review --phase <type> の実行手順と結果の扱いを記述する
- R8 [must]: 既存の impl review（phase なし）、task review（phase=task）、spec review（phase=spec）、test review（phase=test）の動作が変わらないこと
- R9 [must]: instructions-coverage テスト（新しい instructionsKey に対応する prompt ファイルが存在すること）がパスすること

## Acceptance Criteria
- sdd-forge flow get status で plan フェーズの steps に review-draft, review-spec, review-test が表示される
- sdd-forge flow run review --phase draft が draft-review.md を生成し verdict を返す
- sdd-forge flow run review --phase spec / --phase test が既存と同じ動作をする
- phase なしの sdd-forge flow run review が既存の impl review と同じ動作をする
- npm test がパスする（instructions-coverage テスト含む）

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
- **T-1** [pending]: Add review step nodes to FLOW_DEFINITION and constants
  - FLOW_DEFINITION の plan フェーズに review-draft, review-spec, review-test FlowNode を追加し、VALID_REVIEW_PHASES に draft を加える
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Implement draft review pipeline in review.js
  - review.js に runDraftReview 関数を実装し、draft.json の QA 品質を request/issue と突合して検証・修正する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Wire review steps into flow dispatcher
  - run-review.js にパーサーを追加し、registry.js の post hook で phase 別 step id を更新する
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Add plan-phase review prompt files
  - prompts/plan/ に review-draft.md, review-spec.md, review-test.md を追加し、instructions-coverage テストをパスさせる
  - see `tasks/T-4.md` for full spec
