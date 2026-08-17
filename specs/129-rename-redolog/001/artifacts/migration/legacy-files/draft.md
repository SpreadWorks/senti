# Draft: rename-redolog

## Issue

GitHub Issue #71: redolog の用途と名前が合っていないのでリネームする

## 背景

redolog は「やり直し記録」という名前だが、実際にはテスト中に発見したバグ・修正・回避策・設計変更など幅広い用途で使われている。spec #115 の議論で名前の違和感が指摘された。

## 決定事項

### 新名称: issue-log

- redolog → issue-log にリネーム
- 「問題記録」として、バグ・修正・回避策すべてをカバーする名前

### リネーム対象（全レイヤー一括）

| Before | After |
|---|---|
| `redo.js` | `issue-log.js` |
| `loadRedoLog()` | `loadIssueLog()` |
| `saveRedoLog()` | `saveIssueLog()` |
| `RedoLog` | `IssueLog` |
| `RedoLogEntry` | `IssueLogEntry` |
| `redolog.json` | `issue-log.json` |
| `redo-recording.md` | `issue-log-recording.md` |
| CLI `flow set redo` | `flow set issue-log` |
| metric カウンター `redo` | `issueLog` |

### 既存ファイルの扱い

- 過去 spec の `redolog.json` はそのまま残す
- `loadIssueLog()` は `issue-log.json` のみ読む（旧ファイル名の fallback なし）
- alpha 版ポリシーにより後方互換コードは書かない

### テスト方針

- 既存テスト `tests/unit/flow/set-redo.test.js` をリネーム・更新
- 新規テスト追加なし

### 影響範囲

- コア実装: `src/flow/set/redo.js`
- 参照元: `src/flow/commands/report.js`, `src/flow/run/report.js`, `src/flow/run/finalize.js`
- テンプレート: `src/templates/partials/redo-recording.md`, 3つの SKILL.md
- テスト: `tests/unit/flow/set-redo.test.js`
- レジストリ: `src/flow/registry.js`（コマンド登録名の変更）
- metric: `src/flow/set/metric.js`（カウンター名の変更）

### 既存機能への影響

- CLI コマンド名が変わる（`flow set redo` → `flow set issue-log`）
- 出力ファイル名が変わる（`redolog.json` → `issue-log.json`）
- SKILL.md テンプレートの記述が更新される（`sdd-forge upgrade` で反映）

## Approval

- [x] User approved this draft (2026-04-02)
