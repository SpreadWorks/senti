# Feature Specification: 244-fix-update-overview-export

**Feature Branch**: `feature/244-fix-update-overview-export`
**Created**: 2026-04-29
**Status**: Draft
**Input**: GitHub Issue #291

## Goal
src/flow/lib/run-update-overview.js に export default RunUpdateOverviewCommand を追加し、dynamic import 経由の呼び出しを正常化する

## Background
commit c928179a で RunUpdateOverviewCommand クラスを追加した際、export default の記述が漏れた。run-gate.js:73 の dynamic import が { default: RunUpdateOverviewCommand } で destructure するため undefined を受け取り、new RunUpdateOverviewCommand() が TypeError を投げる。try-catch で握りつぶされるため gate-impl は PASS するが、overview 更新が黙��て失敗する。

## Scope
- src/flow/lib/run-update-overview.js に export default 行を追加
- export default の存在を検証するテストを追加

## Out of Scope
- run-gate.js の try-catch によるエラー握りつぶしパターンの修正
- 他ファイルの export パターン変更

## Constraints
- 既存の named export (persistOverviewUpdate, validateOverviewAdditions, RunUpdateOverviewCommand) を維持する
- 他の run-*.js と同一の export default パターン（ファイル末尾に別行で記述）に従う

## Design Principles
-

## Overview
### Modules
- src/flow/lib/run-update-overview.js — FlowCommand サブクラスの定義ファイル。spec.json への overview 追加を永続化する。export default が欠落しており、dynamic import で undefined になる。

### Data Flow
- registry.js:552 の dynamic import → run.js ディスパッチャが .default を取得 → コマンドインスタンス化。run-gate.js:73 も同様に { default: RunUpdateOverviewCommand } で destructure。

### Decisions
- export class を export default class に書き換えるのではなく、ファイル末尾に export default RunUpdateOverviewCommand; を別行で追加する。named export を壊さず、他の全 run-*.js と同一パターンに合わせるため。

## Clarifications (Q&A)
- Q: run-gate.js の try-catch によるサイレント失敗は本 spec で修正しないのか
  - A: try-catch は gate side effect が失敗しても gate 全体を止めない意図的な設計。本 spec は export default 欠落という根本原因を修正するため、修正後はこの try-catch に到達する TypeError は発生しない。try-catch パターン自体の改善は別 concern として別途対応する。

## Alternatives Considered
- export class を export default class に書き換える — named export の RunUpdateOverviewCommand が消えるため、import { RunUpdateOverviewCommand } を使う既存コードが壊れるリスクがある。不採用。
- 呼び出し元を named import に変更する — 他の全 FlowCommand が export default + { default: ... } パターンを使っているため、一貫性を崩す。���採用。

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: src/flow/lib/run-update-overview.js のファイル末尾に export default RunUpdateOverviewCommand; を追加する
- R2 [must]: dynamic import で .default が RunUpdateOverviewCommand クラス（FlowCommand のサブクラス）であることを検証するテストを追加する

## Acceptance Criteria
- import('./src/flow/lib/run-update-overview.js') の .default が RunUpdateOverviewCommand クラスである
- 既存の named export (persistOverviewUpdate, validateOverviewAdditions, RunUpdateOverviewCommand) が引き続き利用可能
- npm test が全件 PASS する

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add export default to run-update-overview.js
  - ファイル末尾に export default RunUpdateOverviewCommand; を追加し、dynamic import 経由の呼び出しを正常化する
  - see `tasks/T-1.md` for full spec
