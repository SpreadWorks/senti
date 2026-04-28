# Feature Specification: 237-definition-driven-gate-ops

**Feature Branch**: `feature/237-definition-driven-gate-ops`
**Created**: 2026-04-27
**Status**: Draft
**Input**: GitHub Issue #279

## Goal
spec 236 retro で partial 判定された R4a と R8c を完了し、definition.js を flow 構造の完全な single source of truth にする。gate PASS 副作用の実行と gate phase マッピングの両方を definition のノード属性から駆動する。

## Background
spec 236 で definition.js を新設し flow 構造の single source of truth とする目標を掲げた。retro で15要件中10件が done、5件が partial と判定された。本 spec は partial 残件のうち R4a（gate PASS 副作用の definition 駆動化）と R8c（PHASE_TO_STEP の definition 派生）の2件を完了する。どちらも definition に属性は宣言済みだが実行側の移行が未達という共通パターン��

## Scope
- [must] registry.js gate post hook から completeTask/promoteNextPending/mergeOverview ロジックを撤去
- [must] definition の sideEffects を参照する gate 副作用実行ロジックの新設
- [must] definition.js の gate ノードに gatePhase 属性を追加
- [must] gate-step.js の PHASE_TO_STEP_ENTRIES を definition 走査から導出に変更
- [should] 既存テストの更新

## Out of Scope
- retro R1 (fallbacks 属性��追加)
- retro R6 (MAX_REVIEW_RETRIES 撤���)
- retro R12 (SKILL.md の手動 step 遷移指示の撤去)
- definition.js のトラバーサルヘルパーの新規追加（既存APIで十分）

## Constraints
- gate-step.js の外部 API シグネチャ (resolveGateStepId, STEP_TO_PHASE, resolveGatePhaseFromState) は変更しない
- registry.js の gate post hook 自体は残す（tryUpdateStepStatus, updateGateRetryCounter, appendIssueLogFromGateResult は gate 固有の registry 責務）
- 外部依存なし（Node.js 組み込みのみ）

## Design Principles
- definition.js が flow 構造の single source of truth
- 宣言的属性から振る舞いを導出するパターン（set-step.js の collectSideEffects() に倣う）

## Overview
### Modules
- src/flow/definition.js — FlowNode に gatePhase 属性を追加。gate 系ノードに phase 配列を宣言。collectGatePhaseEntries() を export
- src/flow/lib/gate-step.js — PHASE_TO_STEP_ENTRIES を collectGatePhaseEntries() からの導出に置換。外部 API (resolveGateStepId, STEP_TO_PHASE, resolveGatePhaseFromState) は不変
- src/flow/lib/run-gate.js — gate PASS 時に definition の sideEffects を読み取り、対応する副作用を実行する関数を追加
- src/flow/registry.js — gate post hook から completeTask/promoteNextPending/mergeOverview の hardcoded ロジックを撤去。sideEffects 実行を run-gate.js に委譲

### Data Flow
- gate 実行 → run-gate.js が result=pass を検出 → deriveNextAction() で sideEffects を取得 → 各副作用を順次実行
- モジュール初期化時 → collectGatePhaseEntries() が FLOW_DEFINITION + TASK_DEFINITION を走査 → [phase, stepId] ペアを返す → gate-step.js が PHASE_TO_STEP / STEP_TO_PHASE を構築

### Decisions
- gate 副作用実行を run-gate.js に配置する。gate 結果の pass/fail 判定が必要であり、step 遷移時の副作用 (set-step.js) とはトリガー条件が異なるため。
- gatePhase を配列型にする。FLOW_DEFINITION gate-impl は task-impl と integration の2つの phase に対応する既存事実があるため。
- collectGatePhaseEntries() を definition.js に追加し、gate-step.js から呼ぶ。definition のトラバーサルは definition.js に集約する既存パターンに従う。

## Clarifications (Q&A)
- Q: 既存機能への影響は？
  - A: 本 spec は内部リファクタのみ。gate-step.js の外部 API (resolveGateStepId, STEP_TO_PHASE, resolveGatePhaseFromState) の戻り値は不変。registry.js gate post hook の step status 更新・gateRetry カウンタ・issue-log 記録は変更なし。副作用ロジックの移動先 (run-gate.js) は registry post hook から呼ばれるため、呼び出しフローの外部観測可能な振る舞いは同一。CLI コマンドのインターフェース変更なし。

## Alternatives Considered
- set-step.js に gate 副作用を統合する — gate PASS 副作用は gate 結果 (pass/fail) と phase を前提条件とし、step の done 遷移とは異なるトリガー条件。責務が混在する。
- action='run-gate' でフィルタし gatePhase を省略する — gate ノードの ID から phase を推測する必要があり、gate→spec の推測が非自明。明示的属性のほうが確実���
- phase ごとに別ノードを定義する（gate-impl を task-impl 用と integration 用に分離） — 同一ステップ ID に対する定義の重複が発生し、definition が冗長になる。

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: FlowNode コンストラクタに gatePhase 属性（文字列配列 or null）を追加する。gate 系ノードには対応する phase の配列を設定する: gate-draft=['draft'], gate=['spec'], gate-impl=['task-impl','integration'] (FLOW), gate-impl=['task-spec'] (TASK)。非 gate ノードは null。
- R2 [must]: definition.js に collectGatePhaseEntries() を export する。FLOW_DEFINITION と TASK_DEFINITION を走査し、gatePhase が非 null のノードから [phase, stepId] ペアの配列を返す。返り値の順序は定義順。
- R3 [must]: gate-step.js の PHASE_TO_STEP_ENTRIES を collectGatePhaseEntries() の戻り値から構築する。hardcoded 配列を削除する。外部 API (resolveGateStepId, STEP_TO_PHASE, resolveGatePhaseFromState) のシグネチャと戻り値は変更しない。
- R4 [must]: run-gate.js に gate PASS 時の副作用実行関数を追加する。gate 結果が pass のとき、deriveNextAction() で取得した sideEffects を読み取り、各副作用（completeTask, promoteNextTask, mergeOverview）を実行する。
- R5 [must]: registry.js の gate post hook から、task-impl PASS 時の completeTask / promoteNextPending / mergeOverview ロジック（現在の L353-377）を撤去する。副作用実行を run-gate.js の関数に委譲する。
- R6 [should]: ���存テスト（gate-step, run-gate, registry 関連）が全てパスする。PHASE_TO_STEP の導出が hardcoded 版と同一結果であることを検証するテストを追加する。

## Acceptance Criteria
- gate-step.js に hardcoded の PHASE_TO_STEP_ENTRIES 配列が存在しない
- registry.js の gate post hook に completeTask / promoteNextPending / mergeOverview のロジックが存在しない
- definition.js の gate 系ノードに gatePhase 属性が宣���されている
- npm test が全件パスする
- resolveGateStepId / STEP_TO_PHASE / resolveGatePhaseFromState の戻り値が変更前と同一

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
- **T-1** [pending]: Add gatePhase attribute and collectGatePhaseEntries to definition.js
  - FlowNode に gatePhase 属性を追加し、gate 系ノードに phase 配列を宣言する。collectGatePhaseEntries() で定義を走査して [phase, stepId] ペアを返す。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Derive PHASE_TO_STEP from definition in gate-step.js
  - gate-step.js の hardcoded PHASE_TO_STEP_ENTRIES を collectGatePhaseEntries() からの導出に置換する。
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Move gate PASS side effects from registry to run-gate
  - registry.js gate post hook の completeTask/promoteNextPending/mergeOverview ロジックを run-gate.js に移動し、definition の sideEffects 属性から駆動する。
  - see `tasks/T-3.md` for full spec
