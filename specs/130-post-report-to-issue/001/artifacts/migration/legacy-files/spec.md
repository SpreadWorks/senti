# Feature Specification: 130-post-report-to-issue

**Feature Branch**: `feature/130-post-report-to-issue`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #72

## Goal
issue 起点の SDD フローが finalize された際、実装レポート（report.text）を元の GitHub issue にコメントとして自動投稿する。

## Scope
- `src/flow/run/finalize.js`: report ステップ完了後に gh issue comment を実行するロジック追加

## Out of Scope
- report.text のフォーマット変更（既存のプレフォーマット済みテキストをそのまま使用）
- gh 未インストール時のフォールバック（インストール案内等）
- PR コメントへの投稿（issue コメントのみ）

## Clarifications (Q&A)
- Q: gh が利用できない場合どうするか？
  - A: スキップする（警告なし）。条件は `state.issue` が存在 AND `isGhAvailable()` が true の場合のみ投稿。
- Q: merge 失敗時もコメントを投稿するか？
  - A: する。report は commit + retro の結果で merge とは独立。report 生成後（merge の前）に投稿する。
- Q: コメントの先頭にヘッダーを付けるか？
  - A: 付けない。report.text をそのまま投稿する。

## User Confirmation
- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-04-02
- Notes: autoApprove mode

## Requirements

要件は1つのみ。

### R1: report 生成後に issue コメントを投稿
finalize.js の report ステップが完了し `report.text` が生成された後、以下の条件をすべて満たす場合に `gh issue comment <number> --body <report.text>` を実行する:
- `state.issue` が存在する（issue 起点のフローである）
- `isGhAvailable()` が true（gh CLI が利用可能）
- `report.text` が空でない

条件を満たさない場合はスキップする（警告・エラーなし）。
`gh issue comment` が失敗した場合、エラーメッセージを stderr に出力した上でスキップする（finalize の成否には影響しない）。finalize 結果の `steps.issueComment` に `{ status: "failed", message: "..." }` を記録する。

### 破壊的変更
なし。既存の finalize パイプラインに付加機能を追加するのみ。

## Acceptance Criteria
- issue 起点のフローで finalize すると、元 issue にレポートコメントが投稿される
- issue 番号がない場合、コメント投稿はスキップされる
- gh が利用できない場合、コメント投稿はスキップされる
- コメント投稿が失敗しても finalize は成功する（エラーは stderr に出力され、results に記録される）
- コメント本文は report.text そのまま（ヘッダー追加なし）

## Open Questions
(none)
