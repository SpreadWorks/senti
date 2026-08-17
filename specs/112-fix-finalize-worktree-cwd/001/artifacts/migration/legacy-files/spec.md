# Feature Specification: 112-fix-finalize-worktree-cwd

**Feature Branch**: `feature/112-fix-finalize-worktree-cwd`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Issue #48

## Goal

flow-finalize SKILL.md の worktree モード指示を修正し、finalize 実行時の3つの問題（バックグラウンド実行、NO_FLOW エラー、cwd 消失）を解消する。

## Scope

- `src/templates/skills/sdd-forge.flow-finalize/SKILL.md` の Worktree Mode セクションを修正

## Out of Scope

- プロダクトコード（`src/flow/run/finalize.js` 等）の変更
- finalize コマンド自体の cwd 制御改善

## Migration Note

旧指示「メインリポジトリから実行せよ」は誤りであり、NO_FLOW エラーの原因だった。alpha 版ポリシーにより後方互換は不要。`sdd-forge upgrade` で SKILL.md が自動更新される。

## Clarifications (Q&A)

- Q: メインリポジトリから実行すべきか？
  - A: いいえ。現在の指示「MUST: メインリポジトリから実行せよ」がNO_FLOWエラーの原因。worktree 内から実行し、完了後に cd でメインリポジトリに戻る手順に変更する。

## User Confirmation

- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-03-31
- Notes: autoApprove mode

## Requirements

1. (P1) SKILL.md の Worktree Mode セクションから「MUST: Before running `sdd-forge flow run finalize`, change the working directory to the main repository path」の指示を削除する
2. (P1) 代わりに以下の指示を追加する: 「worktree 内から `sdd-forge flow run finalize` を実行する。finalize の cleanup で worktree が削除されシェルの cwd が無効になるため、finalize 完了後に `cd <mainRepoPath>` でメインリポジトリに移動せよ。`mainRepoPath` は `sdd-forge flow get resolve-context` の応答から取得する」
3. (P1) 「MUST: finalize コマンドはフォアグラウンドで実行し、完了を待ってから次のステップに進め。バックグラウンド実行してはならない」の指示を追加する
4. (P2) 変更完了後に `npm test` を実行した場合、全テストが 0 件の failure でパスすること

## Acceptance Criteria

- SKILL.md から「change the working directory to the main repository path」の指示が削除されている
- SKILL.md に worktree 内から実行し、完了後に cd で戻る手順が記述されている
- SKILL.md にフォアグラウンド実行の指示が記述されている
- 既存テストがパスする

## Open Questions

- なし
