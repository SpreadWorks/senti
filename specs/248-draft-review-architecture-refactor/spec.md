# Feature Specification: 248-draft-review-architecture-refactor

**Feature Branch**: `feature/248-draft-review-architecture-refactor`
**Created**: 2026-04-30
**Status**: Draft
**Input**: GitHub Issue #300

## Goal
draft review の構造的問題を修正し、全 review phase で一貫した exit code セマンティクスと prompt 駆動の review loop を実現する

## Background
draft review に5つの構造的問題がある。(1) 選択肢UIが残存（spec 247 で他 review は廃止済み）、(2) 承認が draft ステップ内にあり review 前に来る、(3) review loop がなく issue 検出時に exit して終了、(4) runCmdWithRetry が issue 検出 exit を一時エラーと誤認してリトライ（spec 247 で実際に発生）、(5) エージェント出力のストリーミング JSON が draft-review.md に混入

## Scope
- review-draft.md の選択肢UI廃止
- draft.md の承認ロジック除去と review-draft 後への移動
- review loop の実装（prompt 駆動）
- review.js: 全 review phase (draft/spec/test) で verdict FAIL 時に exit 0 に変更
- run-review.js: parsePhaseReviewOutput の exit 0 対応（verdict=FAIL を正常リターン）
- review ステップの post hook 自動 done 遷移を廃止。prompt instructions で verdict=PASS 時のみ手動 done
- review-spec.md / review-test.md の prompt instructions に verdict 判定と手動 step done を追加
- agent.js: plain text モードでの Claude CLI streaming event JSON フィルタ（allowlist 方式）
- registry.js: plan review コマンドの post hook から自動 done 遷移を除去
- flow skill テンプレート (SKILL.md): review コマンドが step を自動 done しない旨の更新

## Out of Scope
- runCmdWithRetry のロジック変更（exit 0 化により変更不要）
- gate-draft の変更
- draft.json スキーマの変更
- flow エンジンへのループ機構追加
- code / impl phase の review（exit code・post hook とも既存動作を維持）
- set-approval.js の変更（spec.json.user_approval は別概念）
- get-next-action.js の変更（instruction key は既存の plan.review-draft 等を参照し変更不要）

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- alpha 版ポリシー: 後方互換コードは書かない

## Design Principles
- レビュー完了はエラーではない — verdict FAIL でも exit 0
- prompt 駆動 loop — review ステップの繰り返しは prompt instructions が制御する
- post hook 廃止 — review ステップの step status は prompt instructions で手動管理

## Overview
### Modules
- review.js (subprocess): verdict FAIL 時の process.exit(EXIT_ERROR) を除去。exit 0 で verdict を stdout/stderr に出力
- run-review.js (FlowCommand): parsePhaseReviewOutput が verdict=FAIL でも正常リターン。artifacts.verdict で結果を伝達
- review-draft.md (prompt): 選択肢UI廃止、review loop、承認ロジック、verdict 判定と手動 step done
- draft.md (prompt): 承認ロジック除去
- review-spec.md / review-test.md (prompt): verdict 判定と手動 step done を追加
- agent.js: plain text モードで Claude CLI streaming event JSON をフィルタ

### Data Flow
- review.js: exit 0 + stderr verdict=PASS|FAIL → runCmdWithRetry: res.ok=true → parsePhaseReviewOutput: { result:'ok', artifacts:{ verdict } } → RunReviewCommand.execute: 正常リターン → Envelope ok:true → prompt instructions: verdict 分岐

### Decisions
- prompt 駆動 loop を採用。flow エンジンにループ構造がなく、step 分割は engine 拡張が必要でスコープ外
- exit 0 + artifacts.verdict で結果伝達。RunReviewCommand.execute は throw しない
- review ステップの post hook 自動 done を廃止し、prompt instructions で手動管理
- JSON フィルタは agent.js に配置し、Claude CLI streaming event type の allowlist で判定

## Clarifications (Q&A)
- Q: gate-draft は draft.json.approval.approved = true を要求するが、承認を review-draft に移動しても互換性は保たれるか
  - A: 保たれる。review-draft の prompt instructions が PASS + ユーザー承認後に draft.json.approval を直接更新するため、gate-draft が走る時点では approval.approved = true が設定済み
- Q: verdict の大文字/小文字の契約
  - A: review.js subprocess は大文字（PASS/FAIL）を出力。parsePhaseReviewOutput は大文字で artifacts.verdict に格納。review.schema.json の lowercase enum は prompt instructions 向けの出力スキーマであり、内部の artifacts.verdict とは独立。実装時に schema を大文字に統一するか、prompt 境界で変換する
- Q: test review の内部 auto-fix loop はこの spec で変更するか
  - A: 変更しない。test review の runReviewLoop は subprocess 内で完結する既存動作。prompt 駆動 loop とは異なるメカニズムであり、exit 0 化のみ適用する
- Q: code / impl phase の review は変更するか
  - A: exit code セマンティクスのみ変更（R4 で全 phase 統一）。post hook の自動 done 遷移は維持する。impl review は plan review と異なり、proposals 反映後に1回で完了するパターンのため
- Q: maxAttempts の取得元と prompt instructions での扱い
  - A: maxAttempts は definition.js の createPlanReviewNode で定義（現在 3）。prompt instructions は attempt 回数を管理する必要はない — sdd-forge flow run review の呼び出し回数を prompt instructions が自身で数え、maxAttempts 到達時に STOP する。definition.js の maxAttempts は CLI 側のリトライ制御に使用
- Q: JSON フィルタの実装箇所: agent.js vs ClaudeProvider.parse()
  - A: agent.js の plain text 出力処理部分（jsonOutputFlag なし分岐）にフィルタを配置する。ClaudeProvider.parse() は jsonOutputFlag あり時のパーサーであり、plain text モードでは呼ばれない。フィルタは Claude provider 固有の event type allowlist を使用するが、配置場所は agent.js のプレーンテキスト分岐
- Q: exit code 変更は後方互換性を破壊するか
  - A: review.js の exit code は flow run review コマンドの内部 subprocess として使用されるものであり、ユーザーが直接呼び出す CLI インターフェースではない。呼び出し元は run-review.js の runCmdWithRetry のみ。また alpha 版ポリシーにより後方互換コードは書かない方針のため、移行措置は不要

## Alternatives Considered
- step 分割による review loop — flow エンジンにループ機構がないため、engine 拡張が必須となりスコープ超過
- exit code 区別（専用 exit code 追加） — 正常完了をエラーとして表現する設計が不自然
- shouldRetry コールバックを runCmdWithRetry に追加 — exit 0 化で不要。不要な複雑さ
- RunReviewCommand.execute で verdict=FAIL 時に throw — throw すると Envelope.fail → non-zero 相当になり、exit 0 の意図と矛盾する
- review.js 側で JSON フィルタ — 影響範囲は限定的だが、同じ問題が他の agent 呼び出し元で再発する

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-30T13:56:28.062Z
- Notes:

## Requirements
- R1 [must]: review-draft.md から選択肢ブロック（[1] QA レビューを行い不足を検出する [2] しない）と skip 分岐を削除し、常時レビュー実行にする
- R2 [must]: draft.md から承認ロジック（approval.approved = true の設定指示）を除去する
- R3 [must]: review-draft.md に review loop と承認ロジックを追加する。loop: verdict=FAIL → 追加Q&A → draft.json 更新 → 再レビュー。PASS → 承認選択肢提示 → draft.json の approval フィールドを直接更新（sdd-forge flow set approval は使わない）。maxAttempts 到達 → STOP（step は in_progress のまま、ユーザーに制御を返す）。flow.json の autoApprove フィールドが true の場合（ユーザーが auto モードを有効にした状態）は PASS 時に承認選択肢を提示せず自動承認する
- R4 [must]: review.js の runDraftReview, runSpecReview, runTestReview で verdict FAIL 時の process.exit(EXIT_ERROR) を除去し、exit 0 で verdict を stdout/stderr に出力する
- R5 [must]: run-review.js の parsePhaseReviewOutput で res.ok=true かつ verdict=FAIL の場合、throw せず { result:'ok', artifacts:{ verdict:'FAIL', ...count }, next: null } を返す。verdict=PASS 時は従来の next 値を返す。res.ok=false は従来通り throw
- R6 [must]: registry.js の review コマンド post hook から review-draft/review-spec/review-test の自動 done 遷移を除去する。prompt instructions が verdict=PASS 時のみ sdd-forge flow set step <id> done を実行する。impl phase の review post hook は変更しない
- R7 [must]: review-spec.md、review-test.md、および flow skill テンプレート (SKILL.md) の prompt instructions を更新する。review-spec.md / review-test.md に verdict=PASS 時のみ sdd-forge flow set step <id> done を実行する指示を追加する。SKILL.md の C.2 step completion ルール（L134 付近）で `flow run review` を post-hook 自動 done コマンドリストから除去し、plan review phase（review-draft/review-spec/review-test）は prompt instructions が step status を管理する旨の注記を追加する。impl/task phase の review は従来通り post hook 管理。verdict は大文字（PASS/FAIL）を正規形とする
- R8 [must]: agent.js の plain text モードで Claude CLI streaming event JSON lines をフィルタする。除去対象の event type 一覧: message_start, message_delta, message_stop, content_block_start, content_block_delta, content_block_stop。行が JSON.parse 可能で type フィールドが上記リストに含まれる場合のみ除去。コードブロック（``` で囲まれた範囲）内の行はフィルタしない
- R9 [must]: src/templates/skills/sdd-forge.flow/SKILL.md の変更後に sdd-forge upgrade を実行する。upgrade の出力で sdd-forge.flow/SKILL.md が更新されたことを確認する（.claude/ は .gitignore 対象のため diff には現れない）

## Acceptance Criteria
- verdict FAIL 時に review.js subprocess が exit 0 で終了する（draft/spec/test 全 phase）
- verdict FAIL 時に runCmdWithRetry がリトライしない
- verdict FAIL 時に Envelope が ok:true + artifacts.verdict='FAIL' で返る
- verdict PASS 時にのみ review ステップが done に遷移する
- review-draft.md に選択肢ブロックが存在しない
- draft.md に承認ロジックが存在しない
- review-draft.md に review loop と承認ロジックが記述されている
- agent.js が Claude CLI streaming event JSON を除去し、正当な AI 出力を保持する
- npm test が PASS する
- npm run test:agent が PASS する（agent.js 変更のため）

## Implementation Targets
- src/flow/commands/review.js
- src/flow/lib/run-review.js
- src/flow/registry.js
- src/flow/prompts/plan/review-draft.md
- src/flow/prompts/plan/draft.md
- src/flow/prompts/plan/review-spec.md
- src/flow/prompts/plan/review-test.md
- src/lib/agent.js
- src/templates/skills/sdd-forge.flow/SKILL.md

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Remove choice UI from review-draft.md
  - review-draft.md から選択肢ブロックと skip 分岐を削除し、常時レビュー実行にする
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Move approval logic from draft.md to review-draft.md
  - draft.md の承認ロジックを除去し、review-draft.md に review loop 完了後の承認ロジックを追加する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Change review verdict FAIL to exit 0 in all phases
  - review.js の runDraftReview, runSpecReview, runTestReview で verdict FAIL 時に process.exit(EXIT_ERROR) を除去し、exit 0 にする
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Update parsePhaseReviewOutput for exit 0 semantics
  - run-review.js の parsePhaseReviewOutput が res.ok=true + verdict=FAIL で正常リターンするようにする
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Remove post hook auto-done for plan review steps
  - registry.js の plan review コマンド post hook から review-draft/review-spec/review-test の自動 done 遷移を除去し、prompt instructions と flow skill テンプレートを更新する
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Add streaming JSON filter to agent.js
  - agent.js の plain text モードで Claude CLI streaming event JSON lines をフィルタする
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Run sdd-forge upgrade after template changes
  - src/templates/ の prompt テンプレート変更をプロジェクトのスキル・設定に反映する
  - see `tasks/T-7.md` for full spec
