# Feature Specification: 103-improve-text-diff-regeneration-with-chapter-depe

**Feature Branch**: `feature/103-improve-text-diff-regeneration-with-chapter-depe`
**Created**: 2026-03-30
**Status**: Draft
**Input**: GitHub Issue #31

## Goal

text コマンドの再生成時に、変更されたソースファイルに関連する章だけを再生成する仕組みを導入する。現状は全章を毎回再生成しており、不要な AI コール・時間・コストが発生している。

## Scope

1. analysis.json の各 entry に永続 `id` を付与する仕組み（scan 側）
2. text 実行時にソースファイルの変更を検知し、再生成対象の章を絞り込む仕組み（text 側）

## Out of Scope

- enrich の差分実行（変更 entry だけ enrich する）
- data ディレクティブの差分実行
- リネーム検知（ファイルリネームは「旧 entry 削除 + 新 entry 追加」扱い）
- 新しい CLI コマンドやオプションの追加（既存の `text` コマンドの内部動作を変更するのみ。ただし `--force` 等の全章強制再生成オプションは可）

## Clarifications (Q&A)

- Q: entry_id は人間可読にすべきか？
  - A: 不要。安定して再計算できればよい。
- Q: entry_id は識別フィールドの hash にすべきか、永続 ID にすべきか？
  - A: 永続 ID 方式。hash 方式だとリネーム等で ID が変わり、ドキュメントとの差異が生じる。
- Q: 章依存データはどこに保存するか？
  - A: 保存しない。text 実行時に analysis.json の各 entry の `chapter` フィールドから都度算出する。
- Q: 変更検知はどう行うか？
  - A: text 実行時に analysis.json 内の entry の `hash` と現在のソースファイルの `hash` を比較する。差分制御用 state ファイルは不要。
- Q: entry_id の保存場所は？
  - A: analysis.json の各 entry に `id` フィールドとして保存する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-30
- Notes: Draft Q&A で全論点を解決済み。Open Questions も解決済み。

## Requirements

**Priority 1 — entry_id の採番と永続化（scan 側）**

1. When scan processes entries, it shall assign a unique `id` field to each entry in analysis.json. The ID shall be a short random string (e.g., 8-character hex).
2. When scan finds a matching entry in the previous analysis.json (matched by `category` + `file` for single-entry categories, or `category` + `file` + category-specific subkey for multi-entry categories), it shall preserve the existing `id`.
3. When scan finds an entry that does not match any previous entry, it shall generate a new `id`.
4. When an entry from the previous analysis is not present in the new scan result, it shall be removed (no action needed — it simply won't appear in the new analysis.json).
5. When a file's content hash matches the previous entry's hash (existing skip logic), the preserved entry shall retain its `id` along with all other fields.

**Subkey fields for multi-entry categories:**

| Category | Subkey field | Rationale |
|----------|-------------|-----------|
| `controllers` | `className` | One class per entry |
| `models` / `entities` | `className` | One class per entry |
| `commands` | `className` | One class per entry |
| `routes` | `name` (fallback: `path`) | Route name is unique identifier |
| `tables` / `schema` | `name` | Table name is unique |
| `config` | N/A (use entry index) | Structure varies by preset |
| `views` | `file` | One entry per view file (file alone is sufficient) |
| `components` | `file` | One entry per component file |
| Other single-entry categories | N/A | `category` + `file` is sufficient |

6. When a DataSource's Entry subclass needs a subkey, the subkey field name shall be determined by a convention: if the Entry class has a `className` field, use `className`; if it has a `name` field, use `name`; otherwise, `category` + `file` alone is used.

**Priority 2 — 差分再生成（text 側）**

7. When `text` command runs, it shall compute the current hash of each entry's source file using the same hash function as scan (`crypto.createHash('md5')`).
8. When an entry's stored `hash` differs from the current file hash, that entry shall be marked as changed.
9. When an entry is new (present in analysis.json but has no corresponding source file hash to compare — i.e., first run or new file), it shall be treated as changed.
10. When changed entries are identified, text shall collect their `chapter` fields to determine the set of chapters that need regeneration.
11. When the set of changed chapters is determined, text shall process only those chapter files (strip and regenerate `{{text}}` directives), leaving unchanged chapters intact.
12. When no entries have changed, text shall skip all chapter regeneration and report that no changes were detected.
13. When the user wants to force full regeneration, text shall support a `--force` flag (or equivalent) that bypasses diff detection and regenerates all chapters.

## Acceptance Criteria

1. After `scan`, every entry in analysis.json has a non-null `id` field.
2. Running `scan` twice without source changes produces the same `id` for each entry.
3. Adding a new source file and running `scan` assigns a new `id` to the new entry while preserving existing IDs.
4. Running `text` after modifying one source file regenerates only the chapter(s) that depend on entries from that file, not all chapters.
5. Running `text` with `--force` regenerates all chapters regardless of changes.
6. Running `text` with no source changes skips regeneration and reports accordingly.

## Open Questions

- [x] Should `text --force` be the flag name, or reuse an existing flag like `--reset`? → `--force` を採用。text に `--reset` は存在せず、alpha 版なので後方互換の懸念なし。
- [x] For `config` category entries that don't have a clean unique subkey, should we use entry index or another approach? → `file` をベースとし、同一ファイルに複数 entry がある場合のみ index を付加する。
