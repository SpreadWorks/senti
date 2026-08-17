# Feature Specification: 114-fix-flow-run-review-worktree-mode

**Feature Branch**: `feature/114-fix-flow-run-review-worktree-mode`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #43

## Goal

`flow run review` が worktree モードで "no active flow (flow.json not found)" エラーになるバグを修正する。

## Scope

- `src/flow/run/review.js` — worktree 時の `SDD_WORK_ROOT` override 処理を削除

## Out of Scope

- `flow/commands/review.js` の変更
- 他の `run/*.js` コマンドの変更（worktree override は `run/review.js` のみに存在）

## Clarifications (Q&A)

- Q: なぜ `SDD_WORK_ROOT` をメインリポに設定していたのか？
  - A: コメントに "review needs to find .active-flow in the main repo" とあるが、`.active-flow` は worktree 内に存在するため、この前提が誤り。他の `run/*.js` コマンド（gate, finalize, lint, retro）は同様の override をしていない。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: autoApprove — gate PASS 後に自動承認

## Requirements

優先順位: R1 > R2 > R3（R1 が根本原因の修正、R2 がその検証、R3 は非退行の確認）

1. **R1** (P1): `run/review.js` が worktree 内で実行された場合、子プロセスに渡す環境変数の `SDD_WORK_ROOT` を `process.env` から変更せず、そのまま継承すること。これにより子プロセス `flow/commands/review.js` の `repoRoot()` が worktree パスを返し、worktree 内の `.active-flow` → `flow.json` を正しく参照できる
2. **R2** (P1): worktree モードで `flow run review` を実行した場合、`flow/commands/review.js` が worktree 内の `flow.json` を検出してレビューが実行されること
3. **R3** (P2): メインリポモード（worktree なし）で `flow run review` を実行した場合、`isInsideWorktree()` が false を返すため削除対象のコードブロックは実行されず、`SDD_WORK_ROOT` は `process.env` のまま渡される。`flow/commands/review.js` は `repoRoot()` でメインリポのパスを取得し、`loadFlowState()` でメインリポの `.active-flow` → `flow.json` を読み込んでレビューを実行すること

## Acceptance Criteria

1. worktree 内で `sdd-forge flow run review` を実行してもエラーにならない
2. `run/review.js` に `SDD_WORK_ROOT` override コードが存在しない
3. `isInsideWorktree` と `getMainRepoPath` の import が削除されている

## Open Questions

（なし）
