# Feature Specification: 246-plan-review-overhaul

**Feature Branch**: `feature/246-plan-review-overhaul`
**Created**: 2026-04-30
**Status**: Draft
**Input**: GitHub Issue #296

## Goal
plan phase のレビューステップ（review-draft, review-spec）を改修し、draft review では auto-fix を廃止して追加質問方式に変更、spec review では impl review と同じ propose→validate パターンに統一し AI 呼び出し回数を最悪 10 回から 2 回に削減する

## Background
plan phase のレビューステップに 2 つの問題がある。(1) draft review は QA 不足を AI が自動で回答を捏造して埋めており、interactive QA の目的と矛盾する。(2) spec review は 1 イテレーションで 3 回の AI 呼び出しが直列に走り（detect + validate + fix）、最大 3 イテレーション + verification で最悪 10 回の AI 呼び出し。毎回 spec.md 全文を送るためトークン消費が過大。

## Scope
- `src/flow/commands/review.js` — runDraftReview, buildDraftReviewPrompt, buildDraftFixPrompt, runSpecReview, buildSpecReviewPrompt, buildSpecFixPrompt
- `src/flow/lib/run-review.js` — PHASE_REVIEW_PARSERS, parseDraftReviewOutput
- `src/flow/definition.js` — createPlanReviewNode, review-draft/review-spec ノード定義
- `src/flow/prompts/plan/` — review-draft.md, review-spec.md
- エージェント commandId リネーム: `flow.draft.review` → `flow.draft.review.propose`, `flow.impl.review.draft` → `flow.impl.review.propose`
- `.sdd-forge/config.json` — agent.providers の commandId キー
- skill プロンプト — proposals 出力を消費する instructions

## Out of Scope
- impl review パイプライン本体（propose→final の既存動作。commandId リネームのみ）
- test review パイプライン
- gate 系の処理
- flow definition の impl/finalize 側のノード定義

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- alpha 版ポリシー: 後方互換コードは不要
- 既存の CLI コマンドインターフェース（`sdd-forge flow run review --phase <phase>`）は変更しない

## Design Principles
- draft review: 不足の検出は AI が行うが、回答はユーザーから得る（auto-fix で AI が回答を捏造しない）
- spec review: impl review で実績のある propose→validate 2 ステップパターンに統一
- エージェント命名: 全レビューフェーズで propose/final に統一し、draft との語義衝突を解消

## Overview
### Modules
- review.js — draft review pipeline: runDraftReview を改修。auto-fix を廃止し不足検出レポートのみ出力する方式に変更
- review.js — spec review pipeline: runSpecReview を propose→validate 2 ステップに変更。auto-fix 廃止。入力を spec.json フィールド選択 + markdown 整形 + minify に変更
- run-review.js — output parsers: PHASE_REVIEW_PARSERS と parseDraftReviewOutput をリネーム後の commandId に合わせて更新
- commandId rename: flow.impl.review.draft → flow.impl.review.propose、flow.draft.review → flow.draft.review.propose、flow.spec.review → flow.spec.review.propose

### Data Flow
- draft review: draft.json + request/issue + context → propose agent → 不足検出レポート（draft-review.md）→ skill 側 AI が追加質問 → ユーザー回答 → draft.json 更新
- spec review: spec.json フィールド選択 + minify + context → propose agent → proposals → validate agent → verdicts → spec-review.md → skill 側 AI が反映

### Decisions
- draft review の auto-fix を廃止し、不足検出レポートのみ出力する方式に変更。回答の生成はユーザー（autoApprove 時は AI）が行う
- spec review を propose→validate 2 ステップに統一し、auto-fix を廃止。APPROVED proposals は spec-review.md にレポート出力し、反映は skill 側 AI が行う
- spec review の入力を spec.md 全文から spec.json フィールド選択 + markdown 整形 + minify に変更
- エージェント commandId を draft→propose にリネーム

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- auto-fix を残す — Issue の方針と矛盾。AI がユーザー回答を捏造する問題が解消されない
- spec.json を JSON のまま AI に送る — markdown 整形の方が AI の読解に適している
- REJECTED proposals を再 propose する retry 方式 — propose の入力条件が変わらないため同じ結果になる可能性が高く、トークン浪費
- 既存 commandId を残して alias を追加 — alpha ポリシーに反する

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-30T00:42:13.725Z
- Notes:

## Requirements
- R-01 [must]: draft review（runDraftReview）から auto-fix を廃止する。buildDraftFixPrompt と draft.json 自動書き換えを削除し、不足検出結果のみを draft-review.md に番号付きリストとして出力する
- R-02 [must]: spec review（runSpecReview）を propose→validate 2 ステップに変更する。detect/validate/fix 3 ステップの runReviewLoop 呼び出しを廃止し、propose agent で proposals 生成 → validate agent で APPROVED/REJECTED 判定の 2 回の AI 呼び出しで完結させる
- R-03 [must]: spec review の auto-fix を廃止する。buildSpecFixPrompt と spec.md 自動書き換えを削除し、APPROVED proposals を spec-review.md に番号付きリスト（タイトル、対象セクション名、変更内容）として出力する
- R-04 [must]: spec review の入力を spec.md 全文から spec.json フィールド選択（goal, background, scope, constraints, design_principles, overview, requirements の id+desc+priority）に変更し、markdown 形式に整形した上で minify して propose agent に送る。1 回あたりの入力バイト数が spec.md 全文より小さいこと
- R-05 [must]: エージェント commandId をリネームする: flow.impl.review.draft → flow.impl.review.propose、flow.draft.review → flow.draft.review.propose、flow.spec.review → flow.spec.review.propose。review.js 内の全参照箇所を一括変更する
- R-06 [should]: run-review.js の PHASE_REVIEW_PARSERS と parseDraftReviewOutput をリネーム後の commandId・出力ヘッダーに合わせて更新する。パーサーの regex パターンがリネーム後の stderr 出力と一致すること
- R-07 [should]: .sdd-forge/config.json の agent.providers セクションの commandId キーをリネーム後の値に変更する
- R-08 [should]: review-draft.md が「不足検出レポート出力 → skill 側 AI が追加質問」の流れを記述し、review-spec.md が「propose→validate → APPROVED proposals レポート出力 → skill 側 AI が反映」の流れを記述していること

## Acceptance Criteria
- draft review 実行時に draft.json が自動書き換えされない（auto-fix 廃止）
- spec review の AI 呼び出し回数が propose + validate の 2 回で完結する
- spec review 実行時に spec.md が自動書き換えされない（auto-fix 廃止）
- spec review の 1 回あたり入力トークン量が spec.md 全文より小さい
- 旧 commandId（flow.impl.review.draft, flow.draft.review, flow.spec.review）が src/ 配下に存在しない
- 既存テスト（npm test）が全件 PASS

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Rename review agent commandIds from draft to propose
  - review.js 内の全エージェント commandId を draft→propose にリネームし、commandId の語義衝突を解消する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Update run-review.js parsers for renamed commandIds
  - PHASE_REVIEW_PARSERS と parseDraftReviewOutput をリネーム後の commandId・出力ヘッダーに合わせて更新する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update config.json commandId keys
  - .sdd-forge/config.json の agent.providers セクションの commandId キーをリネーム後の値に変更する
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Rewrite draft review to detection-only mode
  - runDraftReview から auto-fix を廃止し、不足検出レポートのみを出力する方式に変更する
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Rewrite spec review to propose-validate pattern
  - runSpecReview を detect/validate/fix 3 ステップから propose→validate 2 ステップに変更し、auto-fix を廃止する
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Reduce spec review input tokens via field selection and minify
  - spec review の入力を spec.md 全文から spec.json フィールド選択 + markdown 整形 + minify に変更し、入力トークン量を削減する
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Update skill instruction prompts for new review pipelines
  - review-draft.md と review-spec.md の skill instructions プロンプトを新パイプラインに合わせて更新する
  - see `tasks/T-7.md` for full spec
