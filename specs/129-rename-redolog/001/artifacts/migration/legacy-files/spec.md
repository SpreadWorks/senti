# Feature Specification: 129-rename-redolog

**Feature Branch**: `feature/129-rename-redolog`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #71

## Goal

redolog を issue-log にリネームし、実際の用途（バグ発見・修正・回避策の記録）に合った名前にする。

## Scope

- CLI コマンド名: `flow set redo` → `flow set issue-log`
- ソースファイル: `src/flow/set/redo.js` → `src/flow/set/issue-log.js`
- 関数名: `loadRedoLog`/`saveRedoLog` → `loadIssueLog`/`saveIssueLog`
- 型名: `RedoLog`/`RedoLogEntry` → `IssueLog`/`IssueLogEntry`
- 出力ファイル: `redolog.json` → `issue-log.json`
- テンプレート: `redo-recording.md` → `issue-log-recording.md`
- SKILL.md 内の redolog 参照をすべて issue-log に更新
- metric カウンター: `redo` → `issueLog`
- レジストリ: `src/flow/registry.js` のコマンド登録名を更新
- 参照元ファイル: `report.js`, `finalize.js` の import/使用箇所を更新
- テスト: `set-redo.test.js` → `set-issue-log.test.js` にリネーム・更新

## Impact on Existing Features

- CLI コマンド `flow set redo` が削除され `flow set issue-log` に置き換わる（破壊的変更）
- 出力ファイル名が `redolog.json` から `issue-log.json` に変わる
- SKILL.md テンプレートが更新されるため、`sdd-forge upgrade` 実行で各プロジェクトに反映される
- `src/flow/set/redo.js` を import している内部モジュール 3 ファイル（`report.js` x2, `finalize.js`）の import パスが変わる
- 上記以外の既存機能（scan, build, docs パイプライン等）への影響はない

## Migration

本プロジェクトは alpha 版であり、CLAUDE.md のプロジェクトルールに「後方互換コードは書かない。旧フォーマット・非推奨パスは保持せず削除する」と定められている。したがって非推奨警告期間やフォールバック動作は設けない。

- `flow set redo` は即座に削除される。旧コマンド実行時はエラーメッセージで新コマンド名を案内する（要件8）
- `sdd-forge upgrade` を実行すれば SKILL.md が自動更新される
- 過去 spec の `redolog.json` は歴史的記録として残す（読み込み対象外）
- 進行中のフローがある場合の移行手順:
  1. spec ディレクトリ内の `redolog.json` を `issue-log.json` にリネーム: `mv specs/<spec>/redolog.json specs/<spec>/issue-log.json`
  2. SKILL.md を更新: `sdd-forge upgrade`
  3. 以降は `sdd-forge flow set issue-log --step <id> --reason "..."` を使用する
- CHANGELOG に破壊的変更として記載する

## Out of Scope

- 過去 spec の既存 `redolog.json` のマイグレーション（そのまま残す）
- 旧ファイル名 `redolog.json` の fallback 読み込み（alpha 版ポリシーにより不要）
- issue-log の機能追加・フォーマット変更
- 後方互換コード

## Clarifications (Q&A)

- Q: 新名称は何にするか？
  - A: issue-log（「問題記録」。バグ・修正・回避策すべてをカバー）
- Q: リネーム範囲は？
  - A: 全レイヤー一括（CLI、ソース、出力ファイル、テンプレート、テスト）
- Q: 既存の redolog.json は？
  - A: そのまま残す。fallback 読み込みは不要（alpha 版ポリシー）
- Q: テスト方針は？
  - A: 既存テストのリネーム・更新のみ。新規テスト追加なし

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Gate PASS 後に承認

## Requirements

**P0（必須 — リネームの本体）**
1. `src/flow/set/redo.js` を `src/flow/set/issue-log.js` にリネームし、内部の関数名・型名をすべて更新する
2. `src/flow/registry.js` のコマンド登録を `set/redo` から `set/issue-log` に変更する
3. `src/flow/commands/report.js`, `src/flow/run/report.js`, `src/flow/run/finalize.js` の import と使用箇所を更新する
4. 新規保存時のファイル名が `issue-log.json` であること

**P1（必須 — 関連する参照の更新）**
5. `src/flow/set/metric.js` の metric カウンター名を `redo` から `issueLog` に変更する
6. `src/templates/partials/redo-recording.md` を `issue-log-recording.md` にリネームし、内容を更新する
7. 3つの SKILL.md テンプレート内の redolog 参照を issue-log に更新する

**P1（必須 — 移行支援）**
8. `flow set redo` を実行した場合、`"redo" has been renamed to "issue-log". Use: sdd-forge flow set issue-log` というエラーメッセージを表示し、終了コード 1 で終了する

**P2（必須 — テスト）**
9. `tests/unit/flow/set-redo.test.js` を `set-issue-log.test.js` にリネームし、テスト内容を更新する

## Acceptance Criteria

- `sdd-forge flow set issue-log --step draft --reason "test"` が正常に動作し、`issue-log.json` を出力する
- `sdd-forge flow set redo` を実行すると、`issue-log` への移行を案内するエラーメッセージが表示される
- 既存テストがすべてパスする
- ソースコード内に `redolog`/`RedoLog`/`loadRedoLog`/`saveRedoLog` の参照が残っていない（過去 spec とコメントを除く）

## Open Questions

- (none)
