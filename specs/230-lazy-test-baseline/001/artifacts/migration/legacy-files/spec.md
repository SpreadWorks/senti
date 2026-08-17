# Feature Specification: 230-lazy-test-baseline

**Feature Branch**: `feature/230-lazy-test-baseline`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #269

## Goal
flow run tests（head モード）実行時に baseline が未記録なら自動取得し、prepare 直後の自動 baseline 取得（B.5）を廃止する。テスト実行を選択した場合にのみコストが発生するようにする。

## Background
現状 skill B.5 で flow prepare 直後に必ず baseline テストを実行するが、ユーザーがテスト実行を選択しなかった場合にコストが無駄になる。baseline 取得をテスト実行時まで遅延させることで、テスト不要な flow ではコストをゼロにする。

## Scope
- RunTestsCommand（head モード）に baseline 自動取得ロジックを追加
- SKILL.md の B.5 ステップを廃止
- 新規テスト追加（既存テストは変更しない）

## Out of Scope
- RunGateCommand の baseline 参照ロジック
- SetTestSummaryCommand
- --baseline フラグ（維持する）

## Constraints
- 外部依存なし（Node.js 組み込みのみ）
- baseline 自動取得は best-effort（失敗してもフローを止めない）
- 既存の test.baseline 保存形式を変更しない

## Design Principles
-

## Overview
### Modules
- src/flow/lib/run-tests.js — baseline 自動取得ロジック追加
- src/templates/skills/sdd-forge.flow/SKILL.md — B.5 廃止

### Data Flow
- head モード実行 → test.baseline 確認 → 未記録なら自動取得フローに入る
- baseBranch → detached worktree 作成 → base commit でテスト実行
- テスト結果 → 既存の保存 API で test.baseline に記録

### Decisions
- baseline 取得を prepare 直後から head モードのテスト実行時に遅延させる。テスト不要な flow ではコストゼロになる。
- base commit でのテスト実行には detached worktree を使用する。main リポジトリへの cd や git stash はプロジェクトルールで禁止されている。
- --baseline フラグは手動での baseline 再取得用に残す。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- prepare 直後に自動実行（現状維持） — テスト不要な flow でもコストが発生するため却下
- finalize 後に baseline を保存して次回の flow で再利用 — main HEAD が進むたびにテスト実行が必要で、コスト削減効果が限定的
- git stash で一時退避して base commit のテストを実行 — プロジェクトルールで worktree 内の git stash が禁止されているため却下

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- REQ-1 [must]: flow run tests（--baseline なし）実行時に flow.json の test.baseline が未記録なら、base commit の detached worktree を一時作成してテストを実行し、結果を test.baseline に記録する。
- REQ-2 [must]: flow run tests（--baseline なし）実行時に flow.json の test.baseline が既に記録済みなら、baseline 自動取得をスキップして head テストのみ実行する。
- REQ-3 [must]: baseline 自動取得で作成した detached worktree は、テスト実行後（成功・失敗を問わず）に確実に削除する。
- REQ-4 [must]: baseline 自動取得が失敗した場合（worktree 作成失敗、テストコマンド未定義等）、警告を出力して head テストの実行を続行する。フローを中断しない。
- REQ-5 [should]: baseline 自動取得時も、既存の --baseline モードと同様に agent による要約（summarizeTestLog）を実行する。要約失敗時は summarized: 'skipped' として続行する。
- REQ-6 [must]: SKILL.md の B.5（Capture test baseline）ステップを廃止する。prepare 完了後の自動 baseline テスト実行を行わない。
- REQ-7 [must]: 既存の --baseline フラグの動作は変更しない。--baseline 指定時は従来通り baseline のみを記録する。
- REQ-8 [must]: base commit の特定には flow.json の baseBranch フィールドを使用する。

## Acceptance Criteria
- flow run tests（head モード）を baseline 未記録の状態で実行すると、test.baseline が自動的に記録される
- flow run tests（head モード）を baseline 記録済みの状態で実行すると、baseline 取得をスキップして head テストのみ実行される
- baseline 自動取得後に detached worktree が残っていない
- baseline 自動取得失敗時に head テストが正常に実行される
- SKILL.md に B.5 ステップが含まれていない
- --baseline フラグの既存動作が変わらない

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
- **T-1** [pending]: Add lazy baseline acquisition to RunTestsCommand
  - head モード実行時に test.baseline が未記録なら、base commit の detached worktree でテストを実行して baseline を自動記録する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Remove B.5 from SKILL.md
  - SKILL.md の B.5 ステップ（prepare 直後の自動 baseline テスト実行）を廃止する。
  - see `tasks/T-2.md` for full spec
