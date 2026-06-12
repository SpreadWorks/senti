# Feature Specification: 291-submodule-worktree-cleanup

**Feature Branch**: `feature/291-submodule-worktree-cleanup`
**Created**: 2026-06-12
**Status**: Draft
**Input**: GitHub Issue #381

## Goal
finalize-cleanup の worktree 削除で、初期化済み submodule を含む clean な worktree を安全に削除し、dirty または安全確認不能の worktree は保持して復旧案内を返す。

## Background
Git may reject normal `git worktree remove <path>` when a worktree contains initialized submodules. The current finalize-cleanup teardown treats that failure like any other dirty/remove failure, so cleanup can remain stuck even when the worktree is clean. The fix must distinguish the submodule-specific rejection from ordinary remove failures and must not use `--force` until the worktree and its initialized submodules are confirmed clean.

## Scope
- Spec-Driven Development worktree mode の `senti flow run finalize-cleanup` teardown。
- 通常の `git worktree remove <path>` が submodule 起因で失敗した場合の分類、clean 判定、限定 `--force` retry。
- worktree 本体と initialized submodule の dirty 状態確認。
- submodule cleanup 専用のエラー envelope と復旧案内。
- 既存 cleanup 公開契約の migration parity 検証。

## Out of Scope
- submodule の初期化、同期、更新、再帰 checkout。
- orphan commit guard、squash baseline 判定、auto-rescue、merge 戦略の仕様変更。
- dirty 変更の自動 commit、stash、削除。
- Git 以外の VCS や外部 submodule 管理ツールへの対応。

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールと既存の git 実行ヘルパーを使う。
- 通常の `git worktree remove <path>` を最初に試す既存経路を維持する。
- submodule 起因の失敗と確認できた場合だけ `git worktree remove --force <path>` retry を許可する。
- `--force` retry は worktree 本体と initialized submodule が clean と確認できた場合だけ実行する。
- dirty または状態確認不能の場合、worktree と feature branch を削除しない。
- submodule cleanup halt envelope は `SUBMODULE_WORKTREE_DIRTY`, `SUBMODULE_WORKTREE_STATUS_FAILED`, `SUBMODULE_WORKTREE_FORCE_REMOVE_FAILED` のいずれかを使い、既存 `WORKTREE_REMOVE_FAILED` と区別する。
- branch delete は worktree remove が成功した後にだけ実行する。
- diagnostic に含める dirty/submodule パス一覧は上限を設け、bounded-resource-usage を満たす。
- `src/` に特定プロジェクトや環境固有値を入れない。

## Design Principles
- 既存 teardown transaction の所有範囲を変えず、worktree remove の失敗分類と安全 retry だけを追加する。
- データ消失を避けるため、force は成功が必要な clean submodule worktree に限定する。
- エラー envelope は復旧者が次の操作を判断できる原因、保持対象、復旧案内を含める。

## Overview
### Modules
- `src/flow/lib/run-finalize-cleanup.js`: finalize-cleanup の orphan guard 後に teardown を実行し、worktree remove と branch delete を担当する。
- `src/lib/git-helpers.js`: git コマンド実行の共通 wrapper。追加の git status/remove 呼び出しは既存 logging 経路に乗せる。
- `tests/unit/flow/finalize-cleanup-robustness.test.js`: finalize-cleanup teardown の worktree remove 失敗、権限切替、検証を扱う既存 unit test。
- `specs/291-submodule-worktree-cleanup/tests/`: 新しい submodule cleanup 契約を spec-local test として検証する。

### Data Flow
- cleanup は orphan guard と metadata commit が完了した後、通常 worktree remove を実行する。
- 通常 remove が submodule 起因で失敗した場合だけ、worktree 本体と initialized submodule の status を確認する。
- clean 確認に成功した場合は `git worktree remove --force <path>` を一度だけ retry し、その後 branch delete と teardown validation に進む。
- dirty または状態確認不能の場合は halt envelope を返し、worktree と feature branch を保持する。
- `git worktree remove --force <path>` retry が失敗した場合は halt envelope を返し、branch delete と teardown validation には進まない。

### Decisions
- [VERIFY] `runTeardown` currently owns worktree removal and returns `WORKTREE_REMOVE_FAILED` when normal removal fails.
- [VERIFY] Existing tests already assert dirty worktree removal failure is non-success.
- [VERIFY] Source policy matches draft: cleanup success clears active flow, removes worktree, deletes branch, then validates teardown.
- Migration inventory: non-submodule remove failure remains owned by `WORKTREE_REMOVE_FAILED`; submodule clean failure is owned by safe force retry; submodule dirty/status failure is owned by new halt envelope.
- Submodule halt contract: dirty, status-failed, and force-remove-failed cases use dedicated machine-readable codes and bounded data payloads.
- Why this approach: trying normal remove first preserves existing behavior, while submodule-only force retry fixes the reproducible Git rejection without broad force deletion.

## Clarifications (Q&A)
- Q: What counts as a submodule-related normal remove failure?
  - A: A normal remove failure whose output matches Git's initialized-submodule worktree rejection, such as `working trees containing submodules cannot be moved or removed`, belongs to the submodule cleanup path.
- Q: What diagnostic granularity is required for initialized submodules?
  - A: Diagnostics must identify the worktree root dirty files and top-level initialized submodule paths with bounded dirty file details. Nested submodule recursion is not required for this spec.
- Q: What are the submodule cleanup halt envelope codes?
  - A: `SUBMODULE_WORKTREE_DIRTY` covers confirmed dirty root or submodule state; `SUBMODULE_WORKTREE_STATUS_FAILED` covers inability to prove cleanliness; `SUBMODULE_WORKTREE_FORCE_REMOVE_FAILED` covers a failed clean-confirmed force retry.
- Q: What is preserved from the old behavior?
  - A: Normal success, non-submodule remove failure, orphan guard handling, metadata commit, report handling, active-flow clear, branch delete, and teardown validation are retained.

## Alternatives Considered
- Always call `git worktree remove --force` — Rejected because it can delete dirty or untracked changes and violates the data-safety requirement in Issue #381.
- Leave submodule worktree cleanup as manual recovery only — Rejected because clean initialized-submodule worktrees would continue to get stuck at finalize-cleanup every time.
- Treat every remove failure as submodule-related — Rejected because it would replace the existing `WORKTREE_REMOVE_FAILED` public behavior for unrelated dirty or locked failures.

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-12T15:26:19.450Z
- Notes: Auto-approved because user selected auto mode for Issue #381 and spec-gate passed.

## Requirements
- R1 [must]: When worktree-mode finalize-cleanup removes a worktree, it must first attempt the existing normal `git worktree remove <path>` path before any force retry.
- R2 [must]: When the normal remove failure is submodule-related, finalize-cleanup must inspect dirty state for the worktree root and initialized submodules before deciding whether to force-remove.
- R3 [must]: When the submodule-related failure is confirmed clean, finalize-cleanup must retry `git worktree remove --force <path>` once and continue the existing branch delete and teardown validation path only if that retry succeeds.
- R4 [must]: When the worktree root or any initialized submodule is dirty, finalize-cleanup must keep the worktree and feature branch and return `SUBMODULE_WORKTREE_DIRTY` with bounded dirty path details and recovery guidance.
- R5 [must]: Non-submodule worktree remove failures must retain the existing `WORKTREE_REMOVE_FAILED` behavior and guidance.
- R6 [must]: The change must preserve existing teardown side effects: report attachment, last-finalized pointer, active-flow clear, branch delete, and validateTeardown execution for successful cleanup.
- R7 [must]: When cleanliness cannot be confirmed, finalize-cleanup must keep the worktree and feature branch and return `SUBMODULE_WORKTREE_STATUS_FAILED` with bounded status failure details and recovery guidance.
- R8 [must]: When the clean-confirmed `git worktree remove --force <path>` retry fails, finalize-cleanup must keep the feature branch, report the git failure via `SUBMODULE_WORKTREE_FORCE_REMOVE_FAILED`, and must not run branch deletion.
- R9 [must]: Diagnostics for dirty, status-failed, or force-remove-failed submodule cleanup must be bounded and must not silently discard git errors.

## Acceptance Criteria
- A clean worktree with an initialized submodule that triggers normal remove rejection is removed by a single `git worktree remove --force <path>` retry, and cleanup continues through branch deletion and teardown validation.
- A worktree with dirty root changes is not force-removed; the envelope identifies dirty root state and keeps the worktree and feature branch.
- A worktree with dirty initialized submodule changes is not force-removed; the envelope identifies submodule dirty state and keeps the worktree and feature branch.
- `SUBMODULE_WORKTREE_DIRTY` includes `worktreePath`, `featureBranch`, `dirtyRootFiles`, `dirtySubmodules`, `truncated`, and `recoveryOptions` fields; dirty path arrays are bounded.
- A status inspection failure for the worktree or submodule does not delete the worktree; `SUBMODULE_WORKTREE_STATUS_FAILED` reports that cleanliness could not be confirmed.
- `SUBMODULE_WORKTREE_STATUS_FAILED` includes `worktreePath`, `featureBranch`, `statusFailures`, `truncated`, and `recoveryOptions` fields; captured git stderr/stdout snippets are bounded.
- If the clean-confirmed force retry fails, `SUBMODULE_WORKTREE_FORCE_REMOVE_FAILED` includes `worktreePath`, `featureBranch`, bounded git output, and `recoveryOptions`; branch deletion is not attempted.
- A non-submodule remove failure still returns `WORKTREE_REMOVE_FAILED` with existing-style guidance.
- Existing orphan guard, metadata commit, report attachment, active-flow clear, branch delete, and teardown validation behavior remains covered by behavior-level tests.
- Spec-local tests under `specs/291-submodule-worktree-cleanup/tests/` include `// spec: R<N>` headers for each testable requirement.

## Implementation Targets
- src/flow/lib/run-finalize-cleanup.js
- tests/unit/flow/finalize-cleanup-robustness.test.js
- specs/291-submodule-worktree-cleanup/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Add submodule cleanup guard
  - Add submodule-specific worktree remove handling inside finalize-cleanup teardown while preserving existing non-submodule behavior.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Cover cleanup parity
  - Add spec-local and shared regression coverage for the submodule cleanup behavior and retained public cleanup surfaces.
  - see `tasks/T-2.md` for full spec
