# Feature Specification: 169-fix-flow-set-redo-error

**Feature Branch**: `feature/169-fix-flow-set-redo-error`
**Created**: 2026-04-13
**Status**: Draft
**Input**: GitHub Issue #134

## Goal

`src/flow/registry.js` から不要な `redo` エントリを削除し、`flow set redo` 実行時の `entry.command is not a function` クラッシュを解消する。

## Scope

- `src/flow/registry.js` の `redo` エントリ（L233-236）の削除

## Out of Scope

- `set-metric.js` の `VALID_COUNTERS` にある `"redo"` カウンター名（`flow set metric` 用であり別物）
- `docs/cli_commands.md` の旧 `flow set redo` 記載の修正
- 回帰テストの追加

## Clarifications (Q&A)

- Q: 互換 shim を修正するか、削除するか？
  - A: alpha 版ポリシー「後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除する」に従い削除する。`src/` 内に `flow set redo` を呼び出すコードは存在しない。

- Q: `set-metric.js` の `VALID_COUNTERS` にある `"redo"` は修正が必要か？
  - A: 不要。これは `flow set metric <phase> redo` 用のカウンター名であり、`flow set redo` コマンドとは無関係。

## Alternatives Considered

- **互換 shim の修正**: `execute` を `command` に合わせて修正し RENAMED メッセージを返す案。alpha 版ポリシーに反するため却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: 承認済み

## Requirements

1. **(P1)** `src/flow/registry.js` の `set` グループ内の `redo` エントリを削除する。

## Acceptance Criteria

- `src/flow/registry.js` に `redo` エントリが存在しない
- `flow set redo` 実行時にクラッシュ（`entry.command is not a function`）が発生しない

## Test Strategy

テスト不要と判断。理由:
- 変更はレジストリエントリ（4行）の削除のみであり、ロジックの追加・変更を伴わない
- 削除対象の `redo` エントリは現在クラッシュしており、動作する機能が存在しない
- `flow set redo` を呼び出すコードが `src/` 内に存在しないことを確認済み
- 削除後は未知のサブコマンドとして既存のエラーハンドリングで処理される

検証: 実装後に `node src/sdd-forge.js flow set redo` を実行し、`entry.command is not a function` ではなく適切なエラーが返ることを手動確認する。

## Open Questions

（なし）
