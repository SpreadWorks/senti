# Feature Specification: 160-check-freshness

**Feature Branch**: `feature/160-check-freshness`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Issue #117

## Goal

`docs/` とソースコードの更新日時を比較し、`sdd-forge build` が必要かどうかを診断する `sdd-forge check freshness` コマンドを実装する。

## Scope

- `src/check/commands/freshness.js` の新規作成
- `src/check.js` の `SCRIPTS` マップへの `freshness` エントリ追加
- `--format text|json` オプションのサポート
- 3つの鮮度状態（`fresh` / `stale` / `never-built`）の判定と出力

## Out of Scope

- `--watch` オプション（継続的な監視）
- scan include/exclude パターンによるファイルフィルタリング（全ファイルを対象とする）
- analysis.json を判定基準として使用すること
- `sdd-forge build` の自動実行

## Clarifications (Q&A)

- Q: 鮮度判定の比較対象は何か？
  - A: ソース側は `SDD_SOURCE_ROOT` 配下の全ファイルの最新 mtime。docs 側は `docs/` 配下の全ファイルの最新 mtime。

- Q: `docs/` が存在しない場合の扱いは？
  - A: `never-built` 状態として報告する（build が一度も実行されていないことを示す）。

- Q: analysis.json の mtime を使うか？
  - A: 使わない。`docs/` ファイルの mtime を直接参照する方が「最後に build が完了した時刻」として正確である。

## Impact on Existing Features

- `src/check.js` の `SCRIPTS` マップに `freshness` エントリを追加する（1行追加のみ、既存エントリへの変更なし）。
- `sdd-forge check --help` の出力に `freshness` が列挙されるようになる（表示上の変化のみ）。
- `src/check/commands/config.js`、`src/check/commands/scan.js` への変更なし。
- その他の既存コマンド・機能への影響なし。

## Alternatives Considered

- **analysis.json の mtime を使用する案**: `sdd-forge scan` の最終実行時刻に過ぎず、`build` 全体の完了を示さないため不採用。
- **scan include パターンで対象ファイルをフィルタリングする案**: 実装が複雑になる割に実用上のメリットが薄いため、MVP では全ファイルを対象とする。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08 (autoApprove)
- Notes: gate PASS 後に自動承認

## Requirements

1. When `sdd-forge check freshness` is run and `docs/` does not exist, the command shall output status `never-built` and exit with code 1. (Rationale: `never-built` means build is needed, same as `stale`. Exit code 1 for both states lets CI pipelines use a single non-zero check to detect "build needed". The JSON `result` field (`"never-built"` vs `"stale"`) allows finer-grained differentiation when needed.)
2. When `sdd-forge check freshness` is run and the newest mtime of any file under `SDD_SOURCE_ROOT` is newer than the newest mtime of any file under `docs/`, the command shall output status `stale` and exit with code 1.
3. When `sdd-forge check freshness` is run and the newest mtime of any file under `docs/` is equal to or newer than the newest mtime of any file under `SDD_SOURCE_ROOT`, the command shall output status `fresh` and exit with code 0.
4. When `--format json` is specified, the command shall output a JSON object `{ ok: boolean, result: "fresh"|"stale"|"never-built", srcNewest: string|null, docsNewest: string|null }` where `srcNewest` and `docsNewest` are ISO 8601 timestamps or null if no files exist.
5. When `--format text` is specified (default), the command shall output a human-readable one-line status message to stdout.
6. The command shall register as `freshness` in `src/check.js`'s `SCRIPTS` map and be accessible as `sdd-forge check freshness`.
7. File traversal shall be bounded: scan at most 10,000 files under `SDD_SOURCE_ROOT` and at most 10,000 files under `docs/`. If the limit is exceeded, the command shall emit a warning and use the newest mtime found within the limit.

## Acceptance Criteria

- `sdd-forge check freshness` runs without error when `docs/` exists and is up to date → exits 0 with `fresh`.
- `sdd-forge check freshness` exits 1 when source is newer than docs → outputs `stale`.
- `sdd-forge check freshness` exits 1 with `never-built` when `docs/` does not exist.
- `sdd-forge check freshness --format json` outputs valid JSON matching the schema above.
- `sdd-forge check freshness --help` prints usage information.
- `sdd-forge check --help` lists `freshness` in the available commands.

## Test Strategy

- **場所**: `specs/160-check-freshness/tests/` （この spec の要件検証専用。`npm test` では実行されない）
- **フレームワーク**: Node.js 組み込み `assert` + `tests/lib/` の既存ヘルパー
- **テスト内容**:
  - `never-built` ケース: `docs/` なしで freshness チェックを実行 → result `never-built`、exit 1
  - `stale` ケース: src ファイルが docs ファイルより新しい状態で実行 → result `stale`、exit 1
  - `fresh` ケース: docs ファイルが src ファイルより新しい or 同時刻 → result `fresh`、exit 0
  - JSON 出力: `--format json` で有効な JSON が返ること

## Open Questions

- [x] `SDD_SOURCE_ROOT` が未設定のケース（`sdd-forge` 経由でなく直接 node で実行した場合）。→ `repoRoot()` にフォールバックする。

