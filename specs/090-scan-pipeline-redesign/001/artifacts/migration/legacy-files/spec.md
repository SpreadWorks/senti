# Feature Specification: 090-scan-pipeline-redesign

**Feature Branch**: `feature/090-scan-pipeline-redesign`
**Created**: 2026-03-24
**Status**: Draft
**Input**: GitHub Issue #20

## Goal

scan パイプラインを再設計し、差分更新をファイル単位で正しく動作させる。共通層に責務を集約し、プリセット側はパースロジックのみ提供する構造にする。

## Rationale

現在の scan は `scan(files)` でカテゴリ全体をバッチ処理しており、1ファイルの変更でもカテゴリ全体を再スキャンする。また `analysis[cat][cat]` の二重ネスト構造が不統一で、enrichment 保持ロジックが scan.js に散在している。ファイル単位の hash スキップと責務の明確な分離により、これらの問題を解決する。

## Scope

1. AnalysisEntry 基底クラスの導入
2. Scannable mixin の `match/parse` インターフェースへの改修
3. scan.js のファイル単位 hash スキップ処理フロー実装
4. analysis.json 構造の `analysis[cat].entries` への統一
5. 全18プリセットの DataSource 移行（scan/ → data/ 統合）
6. 全後段コマンドの analysis.json 読み替え対応
7. `preserveEnrichment` の廃止
8. `_incrementalMeta` の廃止

## Out of Scope

- upgrade コマンドでのプリセット変更検出による analysis 強制再生成（ボード f314）
- text 差分再生成の改善 — prevChapter 方式の検討（ボード a08a）
- CLI コマンドのオプション変更（scan コマンドの既存オプションは維持）

## Clarifications (Q&A)

- Q: DataSource の resolve メソッド（list, tree, actions 等）はどうするか？
  - A: DataSource にそのまま残す。変更は `analysis[cat].entries` への読み替えのみ。

- Q: Scannable mixin は廃止するか？
  - A: 維持する。resolve 専用 DataSource（StructureSource 等）には scan メソッドが不要なため。

- Q: summarize メソッドはどうするか？
  - A: 廃止。エントリクラスの `static summary` で集計定義を宣言的に記述し、共通層が自動集計する。

- Q: サマリークラスは必要か？
  - A: 不要。共通層がプレーンオブジェクトを生成する。

- Q: scan/ ディレクトリのパーサーはどうするか？
  - A: DataSource の parse メソッドに統合し、scan/ を削除する。

- Q: _incrementalMeta はどうするか？
  - A: 廃止。差分再生成は別 spec で対応。今回は text は全章再生成。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-24
- Notes: CakePHP2 + node-cli で acceptance テスト実施

## Requirements

Requirements are numbered 1–17. Within each priority group, requirements are listed in implementation order (lower number first).

**Priority 1 — 共通層**

1. When `src/docs/lib/analysis-entry.js` is loaded, it shall export an `AnalysisEntry` class with common fields (`file`, `hash`, `lines`, `mtime`) initialized to `null`.
2. When `AnalysisEntry.restore(obj)` is called on any subclass, it shall return an instance of that subclass with all properties from `obj` copied via `Object.assign`.
3. When a subclass defines `static summary` with field-aggregate pairs, `buildSummary(EntryClass, entries)` shall produce a plain object with `total` (entry count) and each declared aggregation (`count` for array length sum, `sum` for numeric sum).
4. When `parse(absPath)` returns an instance whose non-common fields are all `null`, the scan loop shall skip that entry (empty entry detection).

**Priority 2 — scan 処理フロー**

5. When scan processes a file whose `hash` matches the existing entry's `hash`, it shall preserve the existing entry (including enrichment fields) without calling `parse`.
6. When scan processes a file whose `hash` does not match or is new, it shall call the matching DataSource's `parse(absPath)` and set common fields (`file`, `hash`, `lines`, `mtime`) in the common layer.
7. When an existing entry's `file` is not present in the current file list, scan shall remove that entry from the result (deleted file detection).
8. When scan completes, it shall write `analysis.json` with the structure `{ analyzedAt, [category]: { entries: [...], summary: {...} }, ... }`.
9. When `analysis.json` exists but fails to parse, scan shall throw an error and exit with a non-zero exit code (not silently ignore).

**Priority 3 — Scannable mixin**

10. When a DataSource extends `Scannable(DataSource)`, it shall implement `match(relPath)` returning `boolean` and `parse(absPath)` returning an `AnalysisEntry` subclass instance.
11. When the scan loop encounters a DataSource that does not extend `Scannable`, it shall skip that DataSource and not attempt to call `match` or `parse` on it (resolve-only DataSources are excluded from scanning).

**Priority 4 — プリセット移行**

12. When each of the 18 presets' DataSources is loaded, it shall define an entry class extending `AnalysisEntry` with preset-specific fields initialized to `null` and a `static summary` definition.
13. When a preset has files in `scan/`, those parser functions shall be inlined into the DataSource's `parse` method and the `scan/` directory shall be removed.

**Priority 5 — 後段コマンド対応**

14. When enrich reads analysis.json, it shall access entries via `analysis[cat].entries` instead of `analysis[cat][cat]`.
15. When text, data, init, agents, forge, readme, review read analysis.json, they shall access entries via `analysis[cat].entries`.
16. When `preserveEnrichment` is referenced in scan.js, it shall be removed (hash skip preserves enrichment automatically).
17. When `_incrementalMeta` is referenced in any command, it shall be removed. Text shall regenerate all chapters.

## Acceptance Criteria

- `sdd-forge scan` produces `analysis.json` with `analysis[cat].entries` structure for all categories.
- Re-running `sdd-forge scan` on an unchanged project produces identical `analysis.json` (hash skip works).
- Re-running `sdd-forge scan` after modifying one file only re-parses that file.
- Deleted files are removed from `analysis.json` on re-scan.
- `sdd-forge enrich` correctly reads and writes the new structure.
- `sdd-forge data`, `sdd-forge text`, `sdd-forge forge`, `sdd-forge readme` produce correct output with the new structure.
- All existing tests pass (after updating test fixtures to new structure).
- Empty entries (all non-common fields null) are not included in analysis.json.
- `scan/` directories are removed from all presets.
- **Acceptance test (cakephp2)**: CakePHP2 プリセットの実プロジェクトに対して `sdd-forge scan` → `sdd-forge enrich` → `sdd-forge data` を実行し、analysis.json の構造・エントリ数・summary・後段出力が正しいことを確認する。
- **Acceptance test (node-cli)**: node-cli プリセット（sdd-forge 自身）に対して同様のパイプライン実行を行い、動作・品質を確認する。

## Existing Feature Impact

- **analysis.json**: Breaking structure change. Old format is not supported (alpha policy).
- **enrich**: Must read/write `analysis[cat].entries` instead of `analysis[cat][cat]`.
- **text**: `_incrementalMeta` removed. All chapters are regenerated. `getAffectedChapters` removed.
- **data**: Resolver methods must read `analysis[cat].entries`.
- **review**: `ANALYSIS_META_KEYS` updated, coverage check updated.
- **CLI interface**: No changes. `sdd-forge scan` options remain the same.

## CLI Compatibility

No CLI option changes. The `scan` command retains all existing options (`--stdout`, `--dry-run`, etc.). The only breaking change is the internal `analysis.json` structure, which downstream commands are updated to handle.

## Open Questions

(none)
