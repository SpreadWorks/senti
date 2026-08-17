# Feature Specification: 247-review-pipeline-simplification

**Feature Branch**: `feature/247-review-pipeline-simplification`
**Created**: 2026-04-30
**Status**: Draft
**Input**: GitHub Issue #297

## Goal
レビューパイプラインを2軸で簡素化する: (1) review-spec, review-test, impl review の選択肢UIを廃止し常に自動実行、(2) impl review と spec review から外部検証エージェント (flow.impl.review.final) を廃止し propose agent → セッション AI の2段構成にする。

## Background
レビューステップに2つの不要な複雑性がある。(1) review-spec/review-test/impl review で毎回ユーザーに実行可否を選択させる UI があるが、レビューをスキップする合理的理由はほぼなく、autoApprove 時は常に [1] を自動選択するため分岐が無意味。(2) impl review と spec review で propose agent → final agent → セッション AI の3段パイプラインを使っているが、final agent は diff のみで判断するのに対し、セッション AI は全コンテキストを持ちより適切な判断ができる。

## Scope
- `src/flow/prompts/plan/review-spec.md` — 選択肢 UI 削除、常時実行指示に変更
- `src/flow/prompts/plan/review-test.md` — 選択肢 UI 削除、常時実行指示に変更
- `src/flow/prompts/impl/review.md` — 選択肢 UI 削除、propose-only 出力をセッション AI が評価する手順に変更
- `src/flow/prompts/task/review.md` — propose-only 出力をセッション AI が評価する手順に変更
- `src/flow/commands/review.js` — impl review と spec review から final agent 呼び出しを削除。関連する dead code (buildFinalSystemPrompt, buildFinalValidationPrompt, mergeVerdicts) を削除
- `src/flow/definition.js` — review ノードの skippable: true を削除
- `src/flow/lib/run-review.js` — impl review の出力パースから approved/rejected カウントを削除し proposalCount のみにする
- `src/templates/skills/sdd-forge.flow/SKILL.md` — review ステップに関する変更がある場合のみ更新

## Out of Scope
- `src/flow/prompts/plan/review-draft.md` — spec 246 で設問補完機構に変更済み、対象外
- `runDraftReview` (review.js) — draft review パスは変更しない
- `runTestReview` (review.js) — test review パスは final agent を使っていないため変更しない
- `flow.impl.review.propose` agent 設定 — propose agent は維持
- `flow.test.review` / `flow.draft.review.propose` agent 設定 — 変更なし

## Constraints
- alpha 版ポリシー: 後方互換コードは書かない。旧フォーマットの保持・非推奨パスの維持は行わない
- review.js の CLI インターフェース (--phase, --dry-run, --skip-confirm) は変更しない
- flow.impl.review.final の config.json エントリは削除しない (ユーザー設定は壊さない)

## Design Principles
- セッション AI が全コンテキスト (spec, 設計経緯, tradeoff) を持っているため、diff のみで判断する外部 agent より適切な判断ができる
- レビューは常に有益であり、スキップの選択肢は不要な分岐を生むだけ

## Overview
### Modules
- `src/flow/commands/review.js` — レビュー実行エンジン。impl review, spec review, test review, draft review の4パイプラインを持つ。本 spec では impl review と spec review から final agent ステップを削除する
- `src/flow/prompts/` — 各レビューステップのセッション AI 向け指示。選択肢 UI を削除し常時実行に変更する
- `src/flow/definition.js` — flow ノード定義。review ノードの skippable 属性を削除する
- `src/flow/lib/run-review.js` — review.js subprocess のラッパー。出力パースを簡素化する

### Data Flow
- 変更前: propose agent → review.js (proposals) → final agent → review.js (verdicts) → review.md → session AI
- 変更後: propose agent → review.js (proposals) → review.md → session AI (評価 + 適用)

### Decisions
- final agent 廃止: セッション AI は spec・設計・tradeoff の全コンテキストを持ち、diff のみで判断する external agent より適切。AI 呼び出しコスト・時間も削減される
- 選択肢 UI 廃止: autoApprove 時は常に [1] 選択のため分岐が無意味。レビューをスキップする合理的理由はほぼない
- review.md フォーマット変更: verdict フィールドを削除し proposals のみ出力。セッション AI が評価を担う

## Clarifications (Q&A)
- Q: 既存機能への影響は何か？
  - A: (1) ユーザーはレビューステップをスキップできなくなる (review-spec, review-test, impl review)。ただし alpha 版ポリシーにより後方互換は保持しない。(2) review.md と spec-review.md の出力フォーマットが変わる (verdict フィールド削除)。これらのファイルを読むのはセッション AI の prompt のみであり、外部ツールが依存している可能性はない。(3) flow.impl.review.final の agent commandId は config.json に残っても無害だが、コード側から参照されなくなる。(4) run-review.js の返却値から approved/rejected フィールドが削除され proposalCount のみになる

## Alternatives Considered
- 選択肢を残してデフォルトを[1]にする — 不要な分岐が残り autoApprove の special case が解消されないため却下
- final agent を残して propose agent を省く — propose agent こそが改善提案を行う本質的な部分であり、省くべきではない
- 全 review パス (draft, test 含む) から外部 agent を廃止 — draft review と test review は元々 final agent を使っていないため対象外

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: plan/review-spec.md から選択肢 UI を削除し、`sdd-forge flow run review --phase spec` を常に実行する指示に変更する
- R2 [must]: plan/review-test.md から選択肢 UI を削除し、`sdd-forge flow run review --phase test` を常に実行する指示に変更する
- R3 [must]: impl/review.md から選択肢 UI (Option 1/2/3) を削除し、常に review を実行し、セッション AI が proposals を評価・適用する手順に変更する
- R4 [must]: task/review.md をセッション AI が proposals を評価・適用する手順に更新する
- R5 [must]: review.js の impl review パス (runReview 関数のデフォルトパス) から final agent (flow.impl.review.final) の呼び出しを削除し、scope-filtered proposals をそのまま review.md に出力する
- R6 [must]: review.js の spec review パス (runSpecReview) から final agent の呼び出し (validation step) を削除し、proposals をそのまま spec-review.md に出力する
- R7 [must]: review.js から参照されなくなる関数 (buildFinalSystemPrompt, buildFinalValidationPrompt, mergeVerdicts) とそれらの export を削除する
- R8 [must]: definition.js の createPlanReviewNode から skippable: true を削除する
- R9 [should]: run-review.js の impl review パースから approved/rejected カウントを削除し、proposalCount のみ返すように変更する
- R10 [must]: review.js の ensureAgent('flow.impl.review.final') 呼び出しを削除する (impl review の L1477, spec review の L1165)

## Acceptance Criteria
- review-spec, review-test, impl review の prompt に選択肢 UI が存在しない
- review.js で flow.impl.review.final の agent 呼び出しが存在しない
- review.md に verdict (APPROVED/REJECTED) フィールドが含まれない (proposals のみ)
- spec-review.md に verdict フィールドが含まれない
- definition.js の review ノードに skippable: true が設定されていない
- 既存テストが全て PASS する
- buildFinalSystemPrompt, buildFinalValidationPrompt, mergeVerdicts が review.js の export リストに存在しない

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Remove choice UI from review prompts
  - plan/review-spec.md, plan/review-test.md, impl/review.md から選択肢 UI を削除し、常にレビューを自動実行する指示に書き換える。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Remove final agent from impl and spec review
  - review.js の impl review パスと spec review パスから final agent (flow.impl.review.final) の呼び出しを削除し、propose agent の出力を直接返す2段構成にする。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Update review prompts for propose-only output
  - impl/review.md と task/review.md を更新し、セッション AI が propose agent の出力 (verdict なし proposals) を自身で評価・適用する手順を記述する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Remove skippable from review nodes in definition.js
  - definition.js の createPlanReviewNode から skippable: true を削除し、review ステップを常に実行するノードにする。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Update run-review.js output parsing
  - run-review.js の impl review パースから approved/rejected カウントを削除し proposalCount のみ返すように変更する。
  - see `tasks/T-5.md` for full spec
