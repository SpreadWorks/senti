# Feature Specification: 231-task-e2e-full-lifecycle

**Feature Branch**: `feature/231-task-e2e-full-lifecycle`
**Created**: 2026-04-25
**Status**: Draft
**Input**: GitHub Issue #270

## Goal
flow prepare から finalize 到達まで CLI 経由のみで全ステップを遷移する通し E2E テストを実装し、task decomposition ライフサイクル全体の回帰検知を可能にする。

## Background
既存 E2E テスト（227-forest-e2e.test.js）は個別遷移を検証しているが、全ステップを一貫して CLI のみで遷移するテストが存在しない。遷移間の副作用の結合不整合を検出するには通しシナリオが必要。

## Scope
- flow prepare → 全 flow ステップ → タスクステップ × N → finalize 到達の通し E2E テスト
- フラット構造タスク（2 タスク、parent: null）の完了・昇格検証
- 親子構造タスク（親 1 + 子 2）の子完了→親自動完了の連鎖検証
- 各ステップ完了後の next-action が正しい step/taskId を返すことの検証

## Out of Scope
- AI 呼び出しの実テスト（gate, review, draft の AI 品質検証）
- worktree モードの E2E テスト
- finalize の実行（merge, cleanup 等は別テストで検証済み）
- 既存テストの修正・リファクタ

## Constraints
- AI を呼ばない。AI 関与ステップは flow set step で done 扱い
- 既存テストを変更しない
- tests/helpers/ の既存ヘルパーを活用する

## Design Principles
- CLI コマンドのみで遷移を検証し、flow.json の直接編集を行わない（CLI インターフェースの結合テスト）
- フラット・親子の両タスク構造をカバーし、spec 226 の森構造の回帰検知を行う

## Overview
### Modules
- `tests/e2e/231-task-e2e-full-lifecycle.test.js` — テストファイル。fixture セットアップ + CLI 逐次呼び出しで通しシナリオを実行

### Data Flow
fixture setup → flow prepare → plan-phase steps (done) → approval (triggers task sync) → task-scope steps × N → complete-task × N → flow-scope finalize 到達

### Decisions
1. AI ステップを flow set step done でスキップする方式を採用。AI スタブは gate/review 内部実装への依存が高く保守コストが大きいため。既存 227 テストが同パターンを採用しており実績がある。
2. フラットと親子の 2 シナリオを別テストケースに分離。各シナリオの独立性を保つため。

## Alternatives Considered
- **stub-agent.js による AI スタブ**: AI スタブはプロンプト生成・パース全体のスタブ化が必要で、gate/review の内部実装に依存するため保守コストが高い。
- **フラット構造のみのテスト**: 親子構造の検証を省くと spec 226 の主要機能（森構造タスク）をカバーできない。

## Impact on Existing Features
- **テストファイル新規追加のみ**: tests/e2e/231-task-e2e-full-lifecycle.test.js を新規作成する
- **既存テストへの変更なし**: 227-forest-e2e.test.js を含む既存テストファイルは一切変更しない
- **プロダクトコードへの変更なし**: src/ 配下のファイルは変更しない
- **テストヘルパーへの変更なし**: tests/helpers/ の既存ヘルパーを読み取り専用で共有利用する

## Requirements
- **R1** [must]: tests/e2e/ に E2E テストファイルを追加し、フラット構造タスク（2 タスク、parent: null）で prepare → approval → タスクステップ全完了 → complete-task → 全タスク完了 → finalize 到達の通しシナリオを CLI のみで遷移すること
- **R2** [must]: 親子構造タスク（親 1 + 子 2）のシナリオで、子タスク完了 → 親タスク自動完了 → finalize 到達の通しを CLI のみで遷移し、currentTaskId が各時点で正しいタスクを指すことをアサートすること
- **R3** [must]: 各ステップ完了後の flow get next-action が返す step と taskId が期待値と一致することをアサートすること
- **R4** [must]: approval done 後に flow.json.tasks[] が spec.json.tasks[] と一致する数だけ生成されていることをアサートすること
- **R5** [should]: complete-task 後に currentTaskId が次の pending タスクに切り替わること（最後のタスクの場合は null）をアサートすること
- **R6** [must]: npm test で既存テストと合わせてパスすること。テスト実行時間は 10 秒以内であること

## Acceptance Criteria
- npm test が全テストパスすること
- フラット構造シナリオが prepare → finalize 到達まで CLI コマンドのみで遷移すること
- 親子構造シナリオが子完了→親自動完了→finalize 到達まで遷移すること
- 既存テストに変更がないこと

## Implementation Targets
- tests/e2e/231-task-e2e-full-lifecycle.test.js (新規)

## Tasks
- **T-1**: Implement flat-task E2E lifecycle test
- **T-2**: Implement parent-child task E2E lifecycle test

## Open Questions
(none)
