# Draft: restore-issue-comment

**Issue**: #77 — finalize の issue コメント投稿を復元する
**開発種別**: バグ修正
**目的**: ffa6035 で欠落した issue コメント投稿ロジックを executeCommitPost() に復元する

## Q&A サマリー

### Q1: issue コメントに投稿する内容
- **決定**: `results.report.text` をそのまま投稿（旧コードと同じ動作を復元）

### Q2: 既存機能への影響
- issue が紐付いていないフロー（`state.issue` が null）の場合はスキップ
- gh CLI が利用不可の場合もスキップ
- report.text が未生成の場合もスキップ
- 旧コードと同じ分岐ロジック

## 変更対象
- `src/flow/lib/run-finalize.js` の `executeCommitPost()` — report 生成後（L170 付近）、retro/report コミット前に追加
- `src/lib/git-state.js` の `isGhAvailable`, `commentOnIssue` を import

---

- [x] User approved this draft (2026-04-03)
