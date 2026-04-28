# Feature Specification: 239-retro-incomplete-reasons

**Feature Branch**: `feature/239-retro-incomplete-reasons`
**Created**: 2026-04-28
**Status**: Draft
**Input**: GitHub Issue #281

## Goal
retro rate < 1.0 のとき、レポート Retro セクション末尾に partial/not_done 要件の desc と note を表示し、未達理由を可視化する。

## Background
現在のレポートは retro rate のサマリ（rate%、done/partial/miss の件数）のみ表示する。rate < 1.0 でもどの要件が未達でなぜかが分からず、改善アクションにつながらない。

## Scope
- generateReport で retro の requirements データを data.retro に含める
- formatText の Retro セクションで rate < 1.0 時に未達要件の詳細を表示

## Out of Scope
- retro.json のスキーマ変更
- retro 評価ロジックの変更
- report.json のトップレベルスキーマ変更

## Constraints
- formatText の出力が report text と issue コメントの両方で使われるため、表示ロジックは formatText 内に集約する

## Design Principles
- 既存の report text フォーマットに一貫したスタイルで追記する

## Overview
### Modules
- src/flow/commands/report.js — generateReport と formatText。レポートデータの構築とテキスト整形

### Data Flow
- retro (retroData.requirements[]) → generateReport → data.retro.requirements → formatText でフィルタ・表示

### Decisions
- requirements データは呼び出し元から generateReport に渡す方式を採用。report.js 内で retro.json を直接読む案は fs 依存増加とテスタビリティ低下のため不採用。

## Clarifications (Q&A)
- Q: retro requirements のデータはどの経路で generateReport に届くか？
  - A: finalize 経路: results.retro に summary のみ → requirements も追加で渡す。run-report 経路: retro.json をディスクから読む。

## Alternatives Considered
- generateReport 内で retro.json を直接読む — report.js に fs 依存が増え、テスタビリティが下がるため不採用

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: generateReport が retro data に requirements 配列（各要素: desc, status, note）を含める。呼び出し元（run-finalize.js, run-report.js）が retroResult/retro.json から requirements を渡す。
- R2 [must]: formatText の Retro セクションで rate < 1.0 のとき、partial/not_done の要件ごとに desc と note を 1 エントリずつ表示する。rate = 1.0 のときは追加行を出力しない。
- R3 [should]: 未達要件の表示形式は既存の Issue Log セクションのスタイルと一貫する。各エントリは status ラベル + desc 行、その下に note 行を配置する。

## Acceptance Criteria
- retro rate < 1.0 のレポートで、partial/not_done の要件 desc と note が Retro セクション末尾に表示される
- retro rate = 1.0 のレポートで、Retro セクションに追加行が表示されない（既存出力と同一）
- run-finalize.js 経由のレポート生成で requirements データが正しく渡される
- run-report.js 経由のレポート生成で retro.json から requirements が読み込まれる

## Implementation Targets
- src/flow/commands/report.js
- src/flow/lib/run-finalize.js
- src/flow/lib/run-report.js

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-pending-spec** [pending]: Pending spec definition
  - Placeholder task until spec.json tasks[] is populated.
  - see `tasks/T-pending-spec.md` for full spec

### Round 1
- **T-1** [pending]: Pass retro requirements to generateReport
  - generateReport の入力と data.retro に requirements 配列を含め、呼び出し元（run-finalize.js, run-report.js）が requirements を渡すようにする。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Display incomplete requirements in Retro section
  - formatText の Retro セクションで rate < 1.0 のとき、partial/not_done の要件 desc と note を表示する。
  - see `tasks/T-2.md` for full spec
