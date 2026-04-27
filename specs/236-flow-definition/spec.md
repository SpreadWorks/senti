# Feature Specification: 236-flow-definition

**Feature Branch**: `feature/236-flow-definition`
**Created**: 2026-04-27
**Status**: Draft
**Input**: GitHub Issue #277

## Goal
フロー定義 (FLOW_DEFINITION) を宣言的な一次データとして導入し、step 遷移・retry 上限・時刻記録の責任を definition から駆動する単一箇所に集約する

## Background
フローの「形」が registry.js (pre/post hook)、get-next-action.js (手続的 next-action 導出)、run-finalize.js (STEP_MAP ハードコード) の3箇所に分散している。step 遷移責任も prompt (On start 行) / registry hook / CLI 安全ネットの3者に散在。retry 上限はコード定数 (DEFAULT_GATE_RETRY_MAX=5) / config (flow.retry.max) / prompt literal (gate-draft=10, gate=20 等) で値が不一致。step の開始・終了時刻は未記録。spec 235 でテスト管理が撤去されたが、FLOW_STEPS には stale エントリが残存。

## Scope
- src/flow/definition.js 新設
- context-rules.json の統合と廃止
- step 遷移責任の一元化（registry hook / prompt 指示 / CLI フォールバック撤去）
- gate/approval 副作用の一元化（registry hook → definition 駆動）
- next-action 導出の簡素化（手続的条件分岐 → definition 宣言的導出）
- retry 上限の maxAttempts 集約（コード定数・config・prompt literal 撤去）
- flow.json の nested 構造化
- FLOW_STEPS / PHASE_MAP / gate-step.js マッピングの整理・definition 派生化
- get-check.js PREREQS の definition 導出化
- step 昇格ロジックの階層対応
- leaf の startedAt/finishedAt 自動記録
- integration 4 ステップ撤去
- test step の definition 配置
- show-report の definition 除外（finalize 内部処理に吸収）
- auto-check の definition 対応
- テスト更新・新規作成

## Out of Scope
- finalize の branch 分解（bf86 で後続対応）
- CLI コマンド体系の変更（flow run / flow get 等のインターフェースは維持）
- src/lib/agent.js の MAX_RETRY（インフラリトライ）
- 旧 flow.json の自動マイグレーション（alpha ポリシーにより切り捨て）
- alternate flow（YAGNI）
- get-prompt.js のリファクタ（context-rules.json とは別系統）

## Constraints
- 外部依存なし（Node.js 組み込みモジュールのみ）
- alpha 版ポリシー: 後方互換コードは書かない
- OOP による型表現: definition のノードは専用クラスとして定義する
- src/ にプロジェクト固有情報を含めない
- definition のノード階層の最大深度は 3 に制限する（branch > leaf の2階層 + ルート）。走査関数は深度制限を超えたら例外を投げる
- CLI コマンド体系は変更しない。既存の flow get / flow set / flow run コマンドの exit code 契約は現行のまま維持する（success=0, failure=non-zero）。definition 導入による新規 CLI コマンドの追加はない
- flow set step の引数バリデーション: step ID は definition のノード ID と一致するもののみ受け付ける（内部引数。ユーザー向け引数の追加・変更はない）

## Design Principles
- definition は動作制御だけでなくフローそのものを表現する — implement のような外部待機ノードも保持する
- skill は判断ロジックを持たない — skill は next-action の戻り値をそのまま実行するパススルーに縮退する
- 単一ファイルでフロー全体を把握できる — definition.js を読めばフローの形・順序・属性が分かる

## Overview
### Modules
- src/flow/definition.js (新設) — フロー定義の一次データ。FLOW_DEFINITION / TASK_DEFINITION / 走査・導出ヘルパー関数を export
- src/flow/lib/get-next-action.js — definition の導出関数を呼ぶアダプタに変更
- src/flow/registry.js — step 遷移 hook と gate/approval 副作用 hook を撤去
- src/lib/flow-helpers.js — FLOW_STEPS / PHASE_MAP / TASK_STEPS_PLAN を definition 派生に
- src/lib/flow-store.js — updateStepStatus の昇格ロジックを nested 対応に
- src/flow/lib/gate-step.js — PHASE_TO_STEP を definition 派生に
- src/flow/schemas/context-rules.json — 廃止。全情報を definition.js に統合

### Data Flow
- flow prepare → definition から初期 flow.json (nested 構造) を生成
- flow get next-action → definition から宣言的に次アクションを導出。prompt/schema を definition 属性から参照
- flow set step done → definition 階層を走査して次の pending を昇格。startedAt/finishedAt を自動記録
- flow run gate PASS → definition の副作用属性に従い task 完了・次 task 昇格を実行
- flow set step approval done → definition の副作用属性に従い syncSpecTasksToFlow + auto-upgrade 再評価を実行

### Decisions
- gate PASS 時の副作用（completeTask / promoteNextPending / mergeOverviewSpecs）と approval 完了時の副作用（syncSpecTasksToFlow / auto-upgrade 再評価）は definition 駆動に移す
- context-rules.json を definition に統合し廃止する
- finalize は単一 leaf にする。branch 分解は bf86 で後続対応
- integration 4 ステップは全て撤去する
- test step は definition に含める（approval と implement の間）
- show-report は definition から除外（finalize 内部処理に吸収）
- gate-impl の maxAttempts はコード側 (5) に揃える
- task-level steps のテンプレートも definition に含める
- 旧 flow.json マイグレーションなし（alpha ポリシー適用）

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- context-rules.json を definition と併存させる（definition は構造、context-rules は実行コンテキスト） — 重複が残り2ファイルの整合が必要になるため却下。definition に全情報を集約する方が編集箇所が最小化される
- finalize を同時に branch 分解する — run-finalize.js の内部 STEP_MAP が堅牢に動作しており、分解は独立した大きなリファクタ。definition 導入と同時に行うとリスクが高いため後続 (bf86) に分離
- 旧 flow.json の自動マイグレーションを提供する — alpha 版ポリシーにより後方互換コードは書かない方針。進行中フローがあれば reset してもらう
- integration ステップを skippable ノードとして definition に残す — 直近の全フローで常に skipped であり、使われていないものは削除して必要時に再追加する方針 (YAGNI)
- task-level steps を definition のスコープ外にする — flow-level と task-level で一次データが分裂するため却下。テンプレートは静的であり definition に含めるべき

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1: [must] definition ファイルの新設 — src/flow/definition.js を新設し、FLOW_DEFINITION (flow-level ノード列) と TASK_DEFINITION (task テンプレート) を単一 export する。各ノードは id, label, action, fallbacks, children, requiresApproval, skippable, maxAttempts, instructionsKey, contextKinds, outputSchemaRef の属性を持つ。
- R2: [must] context-rules.json の統合と廃止 — flow get next-action が step の prompt / schema / コンテキスト種別を取得するとき、context-rules.json ではなく definition のノード属性から取得する。src/flow/schemas/context-rules.json は削除する。
- R3: [must] step 遷移責任の一元化 — step が done に遷移したとき、次の pending ノードへの昇格が definition ベースの単一箇所で行われる。registry.js の stepPre() / stepPost() hook、prompt の 'On start: flow set step <id> in_progress' 行、get-next-action.js の promoteFirstPending / promoteNextPending フォールバックは撤去する。
- R4: [must] gate/approval 副作用の一元化 — (a) gate PASS 時: completeTask / promoteNextPending / mergeOverviewSpecs が definition 駆動で実行される。registry.js gate post hook から撤去する。(b) approval done 時: syncSpecTasksToFlow / auto-upgrade 再評価が definition 駆動で実行される。set-step.js のハードコード副作用から撤去する。
- R5: [must] next-action 導出の簡素化 — flow get next-action が呼ばれたとき、definition から宣言的に次のアクションを導出する。get-next-action.js の手続的な resolveTarget / fallback promotion ロジックは definition の導出関数に置換する。
- R6: [must] retry 上限の maxAttempts 集約 — gate/review 実行時に参照される retry 上限が、definition の maxAttempts 属性から取得される。以下を撤去する: (a) config.flow.retry.max, (b) DEFAULT_GATE_RETRY_MAX (run-gate.js), (c) MAX_REVIEW_RETRIES (review.js), (d) prompt 内の retry limit 数値。maxAttempts の値: gate-draft=10, gate=20, gate-impl=5, review=3, implement=3, draft=1。
- R7: [must] flow.json の nested 構造化 — flow prepare 実行時に生成される flow.json が、definition のノード階層に対応する nested 構造で初期化される。旧フラット形式のマイグレーションは行わない（alpha ポリシー）。
- R8: [must] FLOW_STEPS と関連定数の整理 — (a) FLOW_STEPS / TASK_STEPS_PLAN を definition から派生させるか置換する。(b) PHASE_MAP を definition のノード階層から派生させる。(c) gate-step.js の PHASE_TO_STEP を definition から派生させる。(d) integration-write-tests, integration-run-tests, integration-run-all-tests, integration-evaluate を FLOW_STEPS と context-rules.json から撤去する。(e) finalize 以降の使われていない sub-step (push, pr-create, branch-cleanup, pr-merge, docs-update, docs-review, docs-commit) を撤去する。
- R9: [must] 前提条件チェックの definition 導出 — flow get check が呼ばれたとき、前提条件を definition のノード順序から導出する。get-check.js の PREREQS ハードコード ({impl: ['gate', 'test'], finalize: ['implement']}) は撤去する。
- R10: [must] step 昇格の階層対応 — step が done に遷移したとき、definition の階層構造内で次に実行すべき pending ノードが正しく特定・昇格される。branch 内の children が全て done/skipped の場合、branch の次の兄弟ノードに進む。
- R11: [should] leaf の開始・終了時刻の自動記録 — step が active に遷移したとき startedAt を、done/failed/skipped に遷移したとき finishedAt を flow.json に自動記録する。
- R12: [should] test step の definition 配置 — definition 上で test ノードが approval と implement の間に位置する。instructionsKey は plan.test、contextKinds は [spec, guardrail]。
- R13: [should] show-report の definition 除外 — show-report は definition 上の独立ノードとして定義しない。run-finalize.js 内部で処理する。FLOW_STEPS から show-report を撤去する。
- R14: [should] auto-check の definition 対応 — resolve-auto-check-input.js の isSpecApproved / isDraftGateDone がハードコード step ID ではなく definition ベースで step を特定する。
- R15: [should] SKILL.md の簡素化 — step 遷移指示（'flow set step <id> in_progress' の手動呼び出し）と安全ネットフォールバック（NO_IN_PROGRESS_STEP 時の first pending 昇格）の記述を撤去する。skill は flow get next-action の戻り値をそのまま実行するパススルーとする。

## Acceptance Criteria
- step 遷移責任が definition ベースの単一箇所に集約されている（registry hook / prompt 文言 / CLI フォールバックの3者分散が解消）
- retry 上限値が definition の maxAttempts に一元管理され、コード定数・config・prompt literal が撤去されている
- flow get next-action が definition から宣言的にアクションを導出し、context-rules.json を参照しない
- context-rules.json が削除されている
- flow.json が nested 構造で生成され、definition のノード階層と対応している
- 各 leaf の startedAt / finishedAt が遷移時に自動記録される
- integration 4 ステップと finalize 以降の dead sub-step が FLOW_STEPS から撤去されている
- npm test が全て通る
- definition.js の導出ロジックに対する単体テストが存在し通る
- specs/236-flow-definition/tests/ に spec 検証テストが存在し全て通る

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
- **T-1** [pending]: definition.js の新設と FLOW_DEFINITION / TASK_DEFINITION の定義
  - フロー構造・タスクテンプレート・各ノードの属性を宣言的に定義するファイルを新設する。走査・導出ヘルパー関数を実装する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: flow.json の nested 構造化と初期化ロジック変更
  - flow prepare 実行時に生成される flow.json を、definition のノード階層に対応する nested 構造で初期化する。step 昇格ロジックを階層対応にする。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: get-next-action の definition 駆動化と context-rules.json 廃止
  - get-next-action.js を definition の導出関数を呼ぶアダプタに変更し、context-rules.json を廃止する。
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: step 遷移 hook 撤去と definition 駆動の遷移一元化
  - registry.js の pre/post hook、prompt の On start 行、CLI フォールバックを撤去し、step 遷移を definition 駆動の単一箇所に集約する。
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: retry 上限の maxAttempts 集約
  - コード定数・config・prompt literal に分散している retry 上限値を definition の maxAttempts 属性に集約する。
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: FLOW_STEPS / PHASE_MAP / gate-step.js / get-check.js / auto-check の整理
  - FLOW_STEPS と関連定数を definition 派生に整理し、ハードコードマッピングを撤去する。
  - see `tasks/T-6.md` for full spec
