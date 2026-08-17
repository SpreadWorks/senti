# Feature Specification: 099-consolidate-temp-files

**Feature Branch**: `feature/099-consolidate-temp-files`
**Created**: 2026-03-29
**Status**: Draft
**Input**: GitHub Issue #25

## Goal

一時ファイル（enrich 失敗ダンプ）を `.sdd-forge/output/` から `agent.workDir`（デフォルト `.tmp/`）に移動し、`.sdd-forge/output/` を永続的な中間成果物（analysis.json）専用にする。

**Why**: `.sdd-forge/output/` にデバッグ用の一時ファイル（`enrich-fail-batch*.txt`）が混在しており、永続的な成果物と一時ファイルの区別がつきにくい。`agent.workDir` に集約することで役割を明確にする。

## Scope

- `src/docs/commands/enrich.js`: 失敗ダンプの出力先を `sddOutputDir(root)` → `resolveWorkDir(root, config)` に変更
- `resolveWorkDir` の import を追加

## Out of Scope

- config.json への新しい temp 設定の追加（agent.workDir で十分）
- 既存の `enrich-fail-batch*.txt` のクリーンアップ（ユーザーが必要とする可能性がある）
- agent.workDir 自体の仕様変更

## Clarifications (Q&A)

- Q: 新しい temp 設定を config に追加するか？
  - A: 不要。agent.workDir をそのまま使う。
- Q: 既存ファイルのクリーンアップは？
  - A: 行わない。新規分のみ移動先を変更。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-29
- Notes: ドラフト Q&A 完了後に承認

## Requirements

1. **P1**: enrich の AI レスポンスパースが失敗したとき、`src/docs/commands/enrich.js` は失敗ダンプ `enrich-fail-batch{N}.txt` を `sddOutputDir(root)` ではなく `resolveWorkDir(root, config)` に書き込む。ファイル名は変更しない。出力先ディレクトリが存在しなければ `fs.mkdirSync({ recursive: true })` で作成してから書き込む

## Acceptance Criteria

1. enrich の AI レスポンスパース失敗時に `.tmp/enrich-fail-batch{N}.txt` が生成され、`.sdd-forge/output/` には `enrich-fail-batch*.txt` が新たに作成されず、`analysis.json` は従来通り `.sdd-forge/output/` に書かれる

## Open Questions

- (なし)
