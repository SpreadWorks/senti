# Feature Specification: 141-fix-sync-fail-issuelog

**Feature Branch**: `feature/141-fix-sync-fail-issuelog`
**Created**: 2026-04-04
**Status**: Draft
**Input**: GitHub Issue #87

## Goal

finalize の sync ステップの信頼性を改善する: (1) "no changes added to commit" を不要なエラーとして扱わない、(2) worktree モードで post-merge ステップの issue-log が永続化されるようにする。

## Scope

- `src/flow/lib/run-finalize.js` — `commitOrSkip` の regex 拡張、`finalizeOnError` の worktree パス修正

## Out of Scope

- finalize の他のステップ（commit, merge, cleanup）の変更
- `commitOrSkip` の他の利用箇所（commit ステップ）への変更
- sync の docs build ロジック自体の変更

## Clarifications (Q&A)

- Q: `commitOrSkip` の regex 変更は他の呼び出し箇所に影響するか？
  - A: `commitOrSkip` は commit ステップと sync ステップで使用される。commit ステップでは必ず変更があるため "no changes added to commit" は発生しない。sync ステップのみ影響を受ける。

- Q: `finalizeOnError` の mainRoot はどこから取得するか？
  - A: `ctx.mainRoot` は `flow.js` の `resolveCtx()` で設定される。worktree 内では `getMainRepoPath(root)` が返す。非 worktree では `root` と同じ。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-04
- Notes: autoApprove mode

## Requirements

1. When `commitOrSkip` が `git commit` の出力に "no changes added to commit" を含むメッセージを受け取った場合、`{ status: "skipped", message: "nothing to commit" }` を返す（throw しない）。message は既存の "nothing to commit" パターンと同一値で統一する。
2. When worktree モードで `finalizeOnError` が呼ばれた場合、`ctx.mainRoot`（メインリポジトリパス）の spec ディレクトリに issue-log を書き込む。非 worktree モードでは既存の `ctx.root` を使用する。

## Acceptance Criteria

- `commitOrSkip` が "no changes added to commit" を受け取った場合に `{ status: "skipped" }` を返すことをテストで確認
- `commitOrSkip` が "nothing to commit" を受け取った場合に引き続き `{ status: "skipped" }` を返すことをテストで確認（回帰テスト）
- `commitOrSkip` が真のエラーを受け取った場合に throw することをテストで確認（回帰テスト）
- 既存テストが全て PASS すること

## Test Strategy

- `commitOrSkip` のユニットテスト: 各 git 出力パターンの動作確認
- `finalizeOnError` のユニットテスト: worktree/非 worktree で正しいパスに書き込むことを確認（`loadIssueLog`/`saveIssueLog` を直接使用して検証）
- テスト配置: `specs/141-fix-sync-fail-issuelog/tests/`

## Open Questions

None.
