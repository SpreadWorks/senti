# Feature Specification: 105-ai-context-optimization-with-flow-get-context-co

**Feature Branch**: `feature/105-ai-context-optimization-with-flow-get-context-co`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #34

## Goal

`flow get context` コマンドを新設し、AI に渡すプロジェクト情報を必要最小限にフィルタする仕組みを導入する。同時に analysis.json を git 管理対象にし、worktree 間での共有とマージ時の扱いを改善する。

## Scope

1. `flow get context` コマンドの実装（一覧モード + 個別読み取りモード）
2. docsRead/srcRead の自動計測（コマンド内部）
3. analysis.json の出力フォーマット整形（`JSON.stringify(data, null, 2)`）
4. analysis.json の git 管理化（.gitignore 除外 + .gitattributes merge=ours）
5. setup.js の .gitignore 設定見直し
6. スキルテンプレートの更新（metric 指示削除、flow get context / flow run scan 指示追加）

## Out of Scope

- fc44（キーワード検索レイヤー）との連動
- 5513（構造情報の機械的抽出 — imports, used by 等）
- enrich の自動実行
- `flow get context` 内部での scan 実行

## Clarifications (Q&A)

- Q: flow get context 内部で scan を実行するか？
  - A: しない。draft/spec 開始前にスキルで `flow run scan` を明示実行する。flow get context は analysis.json を読むだけで軽量・高速を維持する。
- Q: analysis が古い場合はどうするか？
  - A: scan を事前実行する運用。enrich なしの entry は summary なしで返し、ソース直接参照を示す。enrich の警告は出さない。
- Q: 出力形式は？
  - A: JSON envelope（flow get 統一）+ `--raw` オプションで envelope なしの生コンテンツ。
- Q: analysis.json のコンフリクト時は？
  - A: `.gitattributes` で `merge=ours` を設定。コンフリクト時は自分側を採用し、scan 再実行で最新化する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: Draft Q&A で全論点を解決済み。セッションログ分析に基づく設計。

## Requirements

**Priority 1 — flow get context コマンド**

1. When `flow get context` is called without arguments, it shall read analysis.json and return a list of entries with fields: `file`, `summary`, `methods`, `chapter`, `role`. Fields `hash`, `mtime`, `lines`, `id`, `enrich` shall be excluded.
2. When an entry has no `summary` (not enriched), it shall be included in the list with a marker indicating that source code should be read directly for details.
3. When `flow get context <path>` is called with a file path, it shall return the file content. If the path points to analysis.json, it shall apply the same field filtering as the list mode.
4. When `flow get context` reads a file under `docs/`, it shall increment the `docsRead` counter in flow.json metrics for the current phase.
5. When `flow get context` reads a file not under `docs/` (e.g., `src/`), it shall increment the `srcRead` counter in flow.json metrics for the current phase.
6. When `--raw` flag is specified, output shall be the content only, without JSON envelope.
7. When `--raw` flag is not specified, output shall use the standard JSON envelope (`{ ok, type, key, data }`).

**Priority 2 — analysis.json フォーマットと git 管理**

8. When scan.js writes analysis.json, it shall use `JSON.stringify(data, null, 2)` instead of `JSON.stringify(data)`.
9. When enrich.js writes analysis.json, it shall use `JSON.stringify(data, null, 2)` instead of `JSON.stringify(data)`.
10. When setup.js runs `ensureGitignore()`, it shall add `.sdd-forge/worktree` and `.tmp` to .gitignore, but shall NOT add `.sdd-forge/output/analysis.json` to .gitignore (allowing it to be git-tracked).
11. When setup.js runs, it shall create or update `.gitattributes` to include `.sdd-forge/output/analysis.json merge=ours`.

**Priority 3 — スキルテンプレートの更新**

12. When flow-plan SKILL.md draft phase starts, it shall instruct to run `sdd-forge flow run scan` before starting draft discussion, replacing the existing docs freshness check.
13. When flow-plan SKILL.md spec phase starts, it shall instruct to run `sdd-forge flow get context --raw` to understand the project, replacing the existing "read analysis.json and docs/" instruction.
14. When flow-plan and flow-impl SKILL.md contain docsRead/srcRead metric instructions, those shall be removed (metrics are now handled internally by flow get context).
15. When flow-impl SKILL.md impl phase starts, it shall instruct to run `sdd-forge flow get context --raw` to understand the project before reading the spec.

## Acceptance Criteria

1. `sdd-forge flow get context --raw` returns a filtered list of entries (file, summary, methods, chapter, role) without hash/mtime/lines/id.
2. `sdd-forge flow get context docs/overview.md` increments docsRead in flow.json metrics.
3. `sdd-forge flow get context src/flow/run/finalize.js` increments srcRead in flow.json metrics.
4. analysis.json is formatted with indentation (multi-line, not single-line JSON).
5. After `sdd-forge setup`, `.gitignore` does not exclude `.sdd-forge/output/analysis.json`, and `.gitattributes` contains `merge=ours` for analysis.json.
6. flow-plan and flow-impl SKILL.md no longer contain docsRead/srcRead metric instructions.

## Open Questions

- [x] Should `flow get context` determine the current phase automatically for metric counting? → Yes, read from flow.json's current step status to determine the active phase.
