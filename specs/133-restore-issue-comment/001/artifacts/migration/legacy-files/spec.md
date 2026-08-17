# Feature Specification: 133-restore-issue-comment

**Feature Branch**: `feature/133-restore-issue-comment`
**Created**: 2026-04-03
**Status**: Draft
**Input**: Issue #77

## Goal

`ffa6035` (flow-logic-cli-separation) で `src/flow/run/finalize.js` から `src/flow/lib/run-finalize.js` への移行時に欠落した issue コメント投稿ロジックを復元する。

## Scope

1. `src/flow/lib/run-finalize.js` の `executeCommitPost()` に issue コメント投稿処理を追加
2. テストの追加

## Out of Scope

- コメント内容の整形（Markdown 化等）— 旧コードと同じ `report.text` をそのまま投稿
- `commentOnIssue` / `isGhAvailable` 関数自体の変更
- git/gh コマンド実行の共通化（別タスク: ボード 4b9c）

## Clarifications (Q&A)

- Q: issue コメントに投稿する内容は？
  - A: `results.report.text` をそのまま投稿。旧コードと同じ動作を復元する
- Q: 既存機能への影響は？
  - A: 追加のみで既存動作に影響なし。issue 未紐付け・gh 不可・report 未生成の場合はスキップ

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-03
- Notes: gate PASS 後に承認

## Requirements

### R1: issue コメント投稿の復元
- `executeCommitPost()` 内の report 生成後（`results.report = { status: "done", ... }` の後）、retro/report コミット前に以下を実行すること:
  1. `state.issue` が falsy の場合 → `results.issueComment = { status: "skipped", reason: "no linked issue" }` を設定してスキップ
  2. `results.report?.text` が falsy の場合 → `results.issueComment = { status: "skipped", reason: "report text missing" }` を設定してスキップ
  3. `isGhAvailable()` が false の場合 → `results.issueComment = { status: "skipped", reason: "gh unavailable" }` を設定してスキップ
  4. 上記以外 → `commentOnIssue(state.issue, results.report.text, root)` を呼び出し:
     - 成功時（`res.ok === true`）: `results.issueComment = { status: "done", issue: state.issue }`
     - 失敗時（`res.ok === false`）: `results.issueComment = { status: "failed", message: res.error }` を設定し、`console.error` でエラーを出力

### R2: import の追加
- `src/flow/lib/run-finalize.js` に `isGhAvailable` と `commentOnIssue` を `../../lib/git-state.js` から import すること

### R3: テスト
- `executeCommitPost` の issue コメント投稿ロジックのテストを追加すること
- スキップ条件（issue なし、report なし、gh 不可）と成功ケースをカバーすること

## Acceptance Criteria

- [ ] issue が紐付いたフローで finalize 実行時に `results.issueComment.status === "done"` が返る
- [ ] issue が紐付いていないフローでは `results.issueComment.status === "skipped"` が返る
- [ ] gh CLI が利用不可の場合は `results.issueComment.status === "skipped"` が返る
- [ ] report.text が未生成の場合は `results.issueComment.status === "skipped"` が返る
- [ ] 既存の `npm test` が通る

## Open Questions

- [x] 全て解決済み
