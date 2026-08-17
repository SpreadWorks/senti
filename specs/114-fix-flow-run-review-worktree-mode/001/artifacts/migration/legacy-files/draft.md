# Draft: Fix flow run review worktree mode

## Issue

GitHub Issue #43: `flow run review` が worktree モードで動作しない。

## Root Cause

`src/flow/run/review.js` L44-46 が worktree 内実行時に `SDD_WORK_ROOT` をメインリポジトリに上書きする。
子プロセス `flow/commands/review.js` は `repoRoot()` → `loadFlowState(root)` で flow.json を探すが、
メインリポに `.active-flow` が存在しないため "no active flow" エラーになる。

## Fix

`src/flow/run/review.js` の worktree 検出＆ `SDD_WORK_ROOT` 上書き処理（L43-46）を削除する。

### 根拠

- 他の `run/*.js` コマンド（gate, finalize, lint, retro）は同様の override をしていない
- `commands/review.js` は `root` パス（= CWD = worktree）をそのまま使えば正しく動作する
- `.active-flow` と `flow.json` は worktree 内に存在する

## Requirements

1. `run/review.js` が worktree 内で実行された場合、`SDD_WORK_ROOT` をメインリポに上書きしないこと
2. worktree モードで `flow run review` が flow.json を検出し、レビューが実行されること
3. メインリポモード（worktree なし）の動作に影響がないこと

## Impact

- worktree なしの flow run review: 影響なし
- flow/commands/review.js: コード変更なし
- 他のコマンド: 影響なし

## Test Strategy

- spec 検証テスト: `run/review.js` が worktree 時に env を上書きしないことを検証
- 既存テストへの影響なし（run/review.js の worktree override は既存テストでカバーされていない）

## Approval

- [x] User approved this draft (autoApprove)
