# Feature Specification: 048-fix-flow-status-output

**Feature Branch**: `feature/048-fix-flow-status-output`
**Created**: 2026-03-13
**Status**: Draft
**Input**: flow status の出力形式・アーカイブ機能・スキルファイル整合性の修正

## Goal
SDD フロー管理の不備を修正する。`flow status` コマンドの出力形式・アーカイブ機能・スキルファイルの整合性はすべて flow.json を中心としたフロー管理の構成要素であり、これらの不備が連鎖して「current-spec がない」「ステータスが更新されない」「close 時に spec フォルダへ移動しない」という一連のユーザー体験上の問題を引き起こしている。

## Scope
- `src/flow/commands/status.js` — `displayStatus()` の出力形式変更、`--archive` オプション追加
- `.claude/skills/` のスキルファイル — `src/templates/skills/` の最新版への同期（フロー管理の指示整合性確保）

## Out of Scope
- 旧 spec ファイル内の `current-spec` 参照の修正（歴史的記録）
- flow status の表示内容の追加・変更（形式のみ変更）

## Clarifications (Q&A)
- Q: コンソール出力の形式は？
  - A: 罫線（────）+ インデント付き箇条書き。マークダウンテーブルは使わない
- Q: `--archive` の挙動は？
  - A: flow.json の `spec` フィールドから spec ディレクトリを特定し、そこに flow.json をコピー後、`.sdd-forge/flow.json` を削除
- Q: ローカルスキルの更新方法は？
  - A: `src/templates/skills/` の内容をそのまま `.claude/skills/` にコピー

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-13
- Notes: 実装へ進む

## Requirements
1. `sdd-forge flow status` をオプションなしで実行した場合、`displayStatus()` はマークダウン記法を使わず、罫線とインデントによるプレーンテキスト形式で出力する
2. `sdd-forge flow status --archive` を実行した場合、flow.json の `spec` フィールドから spec ディレクトリを特定し、flow.json をそのディレクトリにコピーした後 `.sdd-forge/flow.json` を削除する
3. `.claude/skills/` 配下のフロー関連スキルファイル（sdd-flow-start, sdd-flow-close, sdd-flow-status）を `src/templates/skills/` の最新版と同一内容にする。これにより `current-spec` 参照の除去とフロー進捗追跡指示の反映が行われる

## Acceptance Criteria
1. `sdd-forge flow status` の出力にマークダウン記法（`##`, `|...|`, `---`）が含まれない
2. `sdd-forge flow status --archive` で flow.json が `specs/NNN-xxx/flow.json` に移動され、`.sdd-forge/flow.json` が削除される
3. `.claude/skills/sdd-flow-start/SKILL.md` に `current-spec` への参照がない
4. 既存テストが通る

## Open Questions
- (none)
