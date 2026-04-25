# Feature Specification: 231-show-report-step

**Feature Branch**: `feature/231-show-report-step`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #271

## Goal
finalize 後の Report 表示を flow dispatcher のステップとして追加し、実行有無を flow state から観測可能にする

## Background
finalize 後の Report 表示（sdd-forge flow report show）は skill 指示と envelope hint に依存しており、AI が実行したかを flow state から観測できない。spec 216 finalize 後に Report 脱落が発生し、board 6764 の検討中に観測不能性が別課題として浮上した。

## Scope
- FLOW_STEPS 配列への show-report 追加（docs-commit 直後）
- PHASE_MAP への show-report → sync マッピング
- context-rules.json への flow.show-report エントリ
- prompt ファイル（sync/show-report.md）新規作成
- finalize 内で show-report ステップを done に遷移させる処理
- テスト追加

## Out of Scope
- Report フォーマットの変更
- board 6764 の skill/envelope 配線
- 既存 finalize サブステップのロジック変更

## Constraints
- FLOW_STEPS と context-rules.json のデータ駆動拡張（REQ-11）に従う
- finalize の cleanup でflow.json が削除されるため、show-report の状態遷移は cleanup 前に完了させる

## Design Principles
- データ駆動: 新ステップの追加は JSON エントリと prompt ファイルのみで完結させる
- 観測可能性: flow get status で Report 表示の完了を確認できる

## Overview
### Modules
- flow-helpers.js: FLOW_STEPS 配列と PHASE_MAP に show-report エントリを追加
- context-rules.json: flow.show-report エントリ（action, instructions_key, context_kinds, output_schema_ref, requires_approval）
- sync/show-report.md: show-report ステップの prompt ファイル
- run-finalize.js: cleanup 前に show-report ステップを done に遷移させる

### Data Flow
- finalize commit → report.json 生成 → cleanup 前に show-report を done → cleanup で flow.json 削除
- flow get status → steps 配列に show-report が含まれ、done/pending が表示される

### Decisions
- show-report を sync フェーズに配置。docs-update/docs-review/docs-commit と同じフェーズ。
- show-report は finalize 内で自動完了（pending → done）させ、dispatcher による対話的処理は不要。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- show-report を impl フェーズに配置 — impl ゲートの対象になり、Report 表示という軽量な操作に不要なゲート評価が走るため不適切
- dispatcher に show-report を対話的に処理させる — finalize の cleanup で flow.json が削除されるため、cleanup 後に dispatcher がステップを処理できない
- finalize 後に show-report を配置し flow.json なしで動作させる — flow dispatcher の設計原則（flow.json ベースの状態管理）と矛盾する

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: FLOW_STEPS 配列の docs-commit の直後に show-report を追加する。buildInitialSteps() の返り値に show-report エントリ（status: pending）が含まれる。
- R2 [must]: PHASE_MAP に show-report → sync のマッピングを追加する。derivePhase() が show-report ステップで sync を返す。
- R3 [must]: context-rules.json の flow セクションに show-report エントリを追加する。instructions_key は sync.show-report とし、対応する prompt ファイルを配置する。
- R4 [must]: finalize パイプライン内で cleanup サブステップ実行前に show-report ステップを done に遷移させる。finalize 成功時の flow get status で show-report が done と表示される。
- R5 [must]: show-report 用の prompt ファイル（src/flow/prompts/sync/show-report.md）を新規作成する。内容は sdd-forge flow report show の実行と結果表示の指示。
- R6 [must]: buildInitialSteps のテストに show-report が含まれることの検証を追加する。
- R7 [should]: finalize 成功後の結果エンベロープにおいて show-report ステップの状態が反映されていることのテストを追加する。

## Acceptance Criteria
- buildInitialSteps() を呼ぶと、返り値の steps 配列に { id: 'show-report', status: 'pending' } が含まれる
- PHASE_MAP['show-report'] === 'sync'
- sdd-forge flow get next-action が show-report ステップで action と instructions を正しく返す
- finalize 成功後、show-report が done に遷移している
- instructions-coverage テストが show-report の prompt ファイル存在を自動検証する
- 既存テストが全て pass する

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
- **T-1** [pending]: Add show-report to FLOW_STEPS and PHASE_MAP
  - FLOW_STEPS 配列と PHASE_MAP に show-report ステップを追加し、flow の基礎データ構造を拡張する
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add context-rules entry and prompt file for show-report
  - context-rules.json に flow.show-report エントリを追加し、対応する prompt ファイルを作成する
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Transition show-report to done within finalize pipeline
  - finalize パイプライン内で cleanup 前に show-report ステップを done に遷移させる
  - see `tasks/T-3.md` for full spec
