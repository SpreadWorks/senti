# Feature Specification: 157-fix-gate-impl-uncommitted

**Feature Branch**: `feature/157-fix-gate-impl-uncommitted`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Issue #111

## Goal

`gate impl` の diff 検出を、コミット済み変更のみから「コミット済み変更 + 未コミット変更（staged + working tree）」を含む全変更に拡張し、sdd-forge の標準フロー（impl でコード変更 → finalize でコミット）において gate impl が正常に動作するようにする。

## Scope

- `src/flow/lib/run-gate.js` の `executeImpl()` メソッド: diff 取得ロジックの修正
- エラーメッセージの更新（変更なし判定の文言）
- `specs/157-fix-gate-impl-uncommitted/tests/` への動作検証テスト追加

## Out of Scope

- gate impl でのテスト実行結果の検証（test-result.json の利用等）— 別 issue として対処する
- CLI インターフェースの変更
- フロー全体のステップ順序変更

## Why This Approach

Option 1（コミット後に gate を実行）ではなく Option 2（gate の diff 検出を改善）を採用する。

Option 1 では review ステップで追加変更が発生した場合に中間コミットが生まれ、`1 spec = 1 commit` というフロー設計原則と矛盾する。Option 2 は gate の実装のみを変更し、フロー全体のステップ順序・設計を保持したまま問題を解決できる。

## Clarifications (Q&A)

- Q: uncommitted 変更の取得に使う git コマンドは何か？
  - A: `git diff baseBranch...HEAD`（コミット済み）と `git diff HEAD`（staged + unstaged の未コミット分）を連結する。両者の結合が空でない場合に「変更あり」とみなす。

## Alternatives Considered

- **Option 1: コミット後に gate を実行** — review ステップ後に追加変更が入ると中間コミットが発生し `1 spec = 1 commit` 設計と矛盾するため不採用。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes: autoApprove mode — gate passed, proceeding automatically.

## Requirements

1. `gate impl` は `git diff baseBranch...HEAD`（コミット済み差分）と `git diff HEAD`（未コミット差分: staged + unstaged）を結合した diff を使用して要件充足チェックを行うこと。
2. 結合 diff が空の場合（コミット済み・未コミットともに変更なし）は `"no changes found (committed or uncommitted) against base branch"` というメッセージで FAIL を返すこと。
3. 修正後も worktree モード（git コマンドが worktree の `cwd` で実行される）が正しく動作すること。

## Acceptance Criteria

- `sdd-forge flow run gate --phase impl` を、変更をコミットせずに（impl ステップ完了後・finalize 前に）実行した場合、コードが変更されていれば FAIL でなく要件チェックの結果を返すこと。
- 変更が一切ない状態（コミット済みも未コミットも空）では `"no changes found (committed or uncommitted) against base branch"` で FAIL となること。
- 既存の gate impl の振る舞い（コミット済み変更に対する要件チェック）は変更されないこと。

## Test Strategy

`specs/157-fix-gate-impl-uncommitted/tests/` に以下のテストを配置する（`npm test` に組み込まない spec 検証テスト）:

- **uncommitted 変更の検出**: git add / commit せずにファイルを変更した状態で `executeImpl()` が空の diff を返さないことを確認
- **combined diff の内容**: コミット済み変更と未コミット変更が両方 diff に含まれることを確認
- **変更なしの FAIL**: クリーンな状態で適切なメッセージで FAIL することを確認

テスト方法: `run-gate.js` の `executeImpl()` を直接テストする単体テストとして実装し、一時的な git リポジトリを `tmp` に作成して検証する。

## Open Questions

なし
