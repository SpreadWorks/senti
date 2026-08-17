# Feature Specification: 115-fix-chapters-exclude-true-ignored

**Feature Branch**: `feature/115-fix-chapters-exclude-true-ignored`
**Created**: 2026-03-31
**Status**: Draft
**Input**: GitHub Issue #52

## Goal
config.json の chapters に `exclude: true` を設定した章が init / data / text フェーズで処理されないようにする。

## Scope
- `src/docs/lib/template-merger.js` の `resolveChaptersOrder()` で `exclude: true` の章をフィルタする

## Out of Scope
- `mergeChapters()` の修正（既に exclude を正しく処理している）
- `getChapterFiles()` の修正（`resolveChaptersOrder` を修正すれば自動的に解決）

## Clarifications (Q&A)
- Q: 修正箇所はどこか？
  - A: `resolveChaptersOrder()` の 1 箇所。configChapters をマップする際に `exclude: true` のエントリを除外するフィルタを追加する。この関数が init / data / text / readme / agents / review すべてで使われているため、1 箇所の修正で全フェーズに反映される。
- Q: `mergeChapters` との関係は？
  - A: `mergeChapters` は chapter-resolver.js にあり enrich で使われる。既に exclude を正しく処理している。`resolveChaptersOrder` は template-merger.js にあり init 以降のフェーズで使われる。この 2 つは別の関数。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: autoApprove

## Requirements
1. [P0] `resolveChaptersOrder()` が configChapters を処理する際、`exclude: true` のエントリを結果から除外する。configChapters が object 形式（`{chapter, exclude}` ）の場合にのみフィルタし、旧 string 形式では影響しない

## Impact on Existing Code
- `resolveChaptersOrder()` は init / data / text / readme / agents / review / translate から `getChapterFiles` 経由で間接的に呼ばれる。修正により全フェーズで exclude が反映される
- `mergeChapters()`（chapter-resolver.js）は変更なし

## Acceptance Criteria
- config.json に `{chapter: "development_testing.md", exclude: true}` を設定した場合、`resolveChaptersOrder()` の戻り値に `development_testing.md` が含まれないこと
- `exclude` フィールドがないエントリや `exclude: false` のエントリは従来通り含まれること
- 旧 string 形式の configChapters（`["overview.md", "stack_and_ops.md"]`）で動作が変わらないこと

## Open Questions
- [ ]
