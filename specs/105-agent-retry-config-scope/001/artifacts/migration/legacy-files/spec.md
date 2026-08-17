# Feature Specification: 105-agent-retry-config-scope

**Feature Branch**: `feature/105-agent-retry-config-scope`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Issue #36

## Goal

`callAgentAsync` にリトライ機能を組み込み、enrich と text で個別に実装されているリトライロジックを共通化する。

## Scope

- `src/lib/agent.js` の `callAgentAsync` に `options.retryCount` / `options.retryDelayMs` を追加
- `src/docs/commands/enrich.js` の `enrichBatchWithRetry` / `getRetryCount` を削除し、`callAgentAsync` のリトライオプションを使用
- `src/docs/commands/text.js` のハードコードされた1回リトライを削除し、`callAgentAsync` のリトライオプションを使用

## Out of Scope

- forge, translate, agents, init など他の agent 利用コマンドへのリトライ適用
- agent 共通のリトライ基盤化（キューイング、バックオフ戦略等）
- `callAgent`（同期版）へのリトライ追加

## Clarifications (Q&A)

- Q: 既存の enrich 実装で十分ではないか？
  - A: enrich は実装済みだが text にもハードコードリトライがあり、設定値が共有されていない。共通化する。

- Q: `getRetryCount` ヘルパーは必要か？
  - A: 不要。各コマンドが `config.agent?.retryCount || 0` を直接渡す。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: Gate PASS 後に承認

## Requirements

**P1（必須）**:

1. `callAgentAsync` が `options.retryCount`（デフォルト 0）と `options.retryDelayMs`（デフォルト 3000）を受け取る
2. 空レスポンス（trim 後に空文字列）の場合にリトライする
3. agent プロセスが非ゼロ終了コードで終了した場合にリトライする（シグナルによる kill やタイムアウトは除外 — `error.killed === true` または `error.signal` が存在する場合はリトライしない）
4. リトライ間隔は `retryDelayMs` ミリ秒の固定待機
5. 全リトライ失敗後は最後のエラーを throw する
6. `retryCount: 0` の場合はリトライなし（現行動作と同一）

**P2（実装対象）**:

7. enrich は `enrichBatchWithRetry` と `getRetryCount` を削除し、`callAgentAsync` に `retryCount` を渡す
8. text はハードコードされたリトライコードを削除し、`callAgentAsync` に `retryCount` を渡す
9. enrich・text とも `config.agent?.retryCount || 0` で設定値を取得する

## Acceptance Criteria

- `callAgentAsync` に `retryCount: 2` を渡した場合、空レスポンスで最大2回リトライし、3秒間隔で待機する
- `callAgentAsync` に `retryCount: 0` または未指定の場合、リトライせず即座に結果を返す（後方互換）
- enrich コマンドが `config.agent.retryCount` の設定値でリトライ動作する
- text コマンドが `config.agent.retryCount` の設定値でリトライ動作する
- enrich.js から `enrichBatchWithRetry` と `getRetryCount` が削除されている
- text.js からハードコードされたリトライコード（空レスポンス時の3秒待機 + 再呼び出し）が削除されている
- 既存テストがパスする

## Open Questions

- なし
