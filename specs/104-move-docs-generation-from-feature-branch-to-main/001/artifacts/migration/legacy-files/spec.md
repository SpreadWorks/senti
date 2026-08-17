# Feature Specification: 104-move-docs-generation-from-feature-branch-to-main

**Feature Branch**: `feature/104-move-docs-generation-from-feature-branch-to-main`
**Created**: 2026-03-30
**Status**: Draft
**Input**: GitHub Issue #32

## Goal

finalize パイプラインの docs 生成（sync ステップ）をメインブランチ上で実行するように修正する。現状は worktree モードで cleanup 後に sync が実行され、cwd が無効になり docs 生成が失敗する。また、マージ方法の選択を auto 判定に変更し、ユーザーの手動選択を不要にする。

## Scope

1. finalize のステップ順序を変更: sync を cleanup の前に移動
2. sync ステップの cwd をメインブランチのパスに変更
3. PR ルート時の sync 自動スキップとリマインドメッセージ
4. マージ方法の auto 判定をデフォルトにする
5. prompt 定義とスキルテンプレートの更新

## Out of Scope

- flow-sync スキルの新規実装（既存の `flow run sync` コマンドはそのまま）
- GitHub Actions による自動 docs 生成
- merge と squash の選択肢の統合（実質同じ squash merge だが、今回はラベルの整理にとどめる）
- cleanup の動作変更（worktree/ブランチ削除の確認フローは既存動作のまま。finalize スキルがユーザー承認後に実行するため、追加の確認は不要）

## Clarifications (Q&A)

- Q: worktree モードで sync はどこで実行するか？
  - A: `resolveWorktreePaths()` で `mainRepoPath` を取得し、そこで docs build を実行する。merge 完了後なのでメインブランチにマージ済みのコードがある。
- Q: PR ルートで sync はどうするか？
  - A: PR ではまだマージされていないため sync を自動スキップし、リマインドメッセージを出力する。
- Q: マージ方法の選択は廃止するか？
  - A: 「すべて実行」時は auto 判定のみ（選択不要）。「個別選択」時はマージステップで上書き可能。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-30
- Notes: Draft Q&A で全論点を解決済み。

## Requirements

**Priority 1 — ステップ順序と sync の修正**

1. When finalize executes, the step order shall be: commit (3) → merge (4) → sync (5) → cleanup (6) → record (7). The STEP_MAP in finalize.js shall reflect this new numbering.
2. When sync step executes in worktree mode, it shall use `mainRepoPath` (from `resolveWorktreePaths()`) as cwd for `docs.js build`, not the worktree's `root`.
3. When sync step executes in branch mode, it shall use `root` as cwd (current behavior, since merge already checked out the base branch).
4. When merge strategy is `pr`, sync step shall be automatically skipped with status `{ status: "skipped", message: "PR route: run sdd-forge build after PR merge" }`. A skipped sync is a success condition — the finalize command shall exit with code 0.

**Priority 2 — マージ方法の auto 判定**

5. When finalize runs in `all` mode, it shall pass `--auto` to merge.js instead of requiring a merge strategy selection. The auto detection logic in merge.js (`commands.gh=enable` AND `gh` available → PR, else squash) determines the strategy.
6. When finalize runs in `select` mode and includes the merge step, the user may optionally specify `--merge-strategy` to override auto detection.
7. When `--merge-strategy` is not specified in `select` mode, `--auto` shall be used as default.

**Priority 3 — prompt と SKILL.md の更新**

8. When `finalize.steps` prompt is displayed, the step numbers and labels shall reflect the new order: 3=Commit, 4=Merge/PR, 5=Documentation sync, 6=Branch cleanup, 7=Save record.
9. When `finalize.merge-strategy` prompt is displayed, the choices shall be reduced to: [1] squash merge, [2] pull request. The "merge" option (which was identical to squash) shall be removed.
10. When flow-finalize SKILL.md template is updated, it shall reflect: (a) "all" mode no longer asks for merge strategy, (b) step numbers match new order, (c) PR route reminder message for docs sync.

## Acceptance Criteria

1. Running finalize in worktree mode with "all" steps completes sync (docs build) successfully on the main branch before cleanup removes the worktree.
2. Running finalize with PR route skips sync and includes a reminder message in the output.
3. Running finalize in "all" mode does not prompt for merge strategy — it auto-detects.
4. Running finalize in "select" mode with merge step allows optional `--merge-strategy` override.
5. `finalize.steps` prompt shows correct step numbers matching the new order.

## Open Questions

- [x] Should we keep the step numbers (3-7) or renumber to (1-5)? → Keep 3-7 for consistency with existing flow state tracking.
