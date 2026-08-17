## Summary

In the normal Flow, `finalize-merge` returns a recovery hint telling the user to rebase in the worktree and then retry finalize when it detects a rebase conflict against the base branch.

However, after returning the hint, `finalize:onError` currently updates the failed outbox, subsequent step states, runtime metadata, and `issue-log.json`, making the worktree dirty. As a result, the recovery procedure shown by the CLI cannot be run as-is, and the user cannot start the rebase unless they manually commit the Flow metadata.

## Background

The adjacent areas below have already been resolved by spec `353-finalize-teardown-safety` / Issue #473.

- direct finalize can update verification and integration records at the post-rebase HEAD
- interrupted direct completion can be resumed from a saved transaction
- teardown journal, completion receipt, and cleanup can be completed using main-side durable authority
- after cleanup, loggers and runtime metadata no longer re-reference a deleted worktree

However, the boundary after a normal `finalize-merge` conflict targeted by this issue remains unresolved. Reproducing `finalizeOnError` in isolation leaves at least the following dirty diff after the hint is returned.

```text
 M specs/<spec>/issue-log.json
```

In the actual lifecycle, this is also accompanied by `flow.json` diffs for the failed outbox and subsequent step `skipped` updates. The existing metadata-only commit runs in the next `finalize-merge` pre-hook, so it is too late for the guided sequence of “rebase immediately after receiving the hint.”

## Problem

The normal Flow recovery hint, durable audit trail persistence, and clean Git worktree boundary are not consistent as a single transaction.

- the conflict detection side instructs the user to “rebase, then retry”
- the error lifecycle side dirties the worktree after that instruction
- the retry preprocessing can commit metadata-only dirtiness, but it runs after the rebase

Because of this, users cannot proceed without creating a manual commit outside the CLI guidance. Flow is effectively making the user take responsibility for preserving the consistency of Flow-owned evidence.

## Expected Behavior

- When normal `finalize-merge` returns a conflict, the returned recovery procedure can be executed without additional judgment
- Preserve the conflict reason, runtime log, failed outbox, subsequent step states, and `issue-log.json` durably without losing them
- If an automatic commit is made, limit its scope to only the target spec’s `flow.json` and `issue-log.json`
- If there are dirty files in source, tests, docs, or any other path outside the target spec, do not auto-commit; instead, return the stop reason and executable next action before making additional Git or Flow changes
- On retry after resolving the conflict, restore `finalize-sync` / `finalize-cleanup` to `pending` and complete merge / outbox side effects exactly once
- Do not reimplement the direct finalize / durable teardown handling completed in #473; fix only the normal Flow `finalize-merge` boundary

## Scope

- `src/flow/commands/merge.js`
- `src/flow/lib/run-finalize.js`
- `src/flow/definition.js`
- `src/flow/registry.js`
- `tests/unit/flow/finalize-merge-retry.test.js`
- worktree CLI / E2E conflict tests for normal `finalize-merge`

## Acceptance Criteria

1. Immediately after normal `finalize-merge` detects a rebase conflict, either the worktree is clean, or a single returned CLI-owned recovery command can complete the flow from evidence preservation through the rebase-ready state.
2. The recovery procedure does not require the user to manually commit Flow metadata.
3. Evidence for the conflict reason, runtime log, failed outbox, subsequent step states, and `issue-log.json` remains in the final main-side snapshot after retry.
4. Automatic commits for metadata-only dirtiness are limited to the target spec’s `flow.json` and `issue-log.json` only.
5. If even one out-of-scope dirty file exists, do not auto-commit, start the outbox, or change steps; return the target path and an executable next action.
6. Retry after conflict resolution restores `finalize-sync` / `finalize-cleanup` to `pending` and does not duplicate merge / outbox side effects.
7. An E2E test using an actually conflicting base branch and feature worktree verifies conflict detection, evidence preservation, rebase, retry, and finalize completion.
8. The normal merge path does not create extra metadata commits and does not break the pre-merge handling from spec `263-fix-finalize-merge-dirty` or the direct finalize / cleanup contract from #473.

## Evidence

- Related: Issue #458, spec `337-repair-stale-evidence-ledger`
- Related partial resolution: Issue #473, spec `353-finalize-teardown-safety`
- `src/flow/commands/merge.js` returns a rebase recovery hint after conflict and aborts the rebase itself to restore the worktree
- `finalize:onError` in `src/flow/definition.js` then updates the failed outbox, `issue-log.json`, and subsequent step states
- The metadata-only commit in `src/flow/lib/run-finalize.js` is for the pre-hook before `finalize-merge` starts and does not handle the manual rebase boundary immediately after hint return
- Reproducing `finalizeOnError` with the current code has confirmed that tracked `issue-log.json` becomes dirty
- In cases where a manual Flow metadata commit was created, the rebase and `finalize-merge` retry succeeded

## Out of Scope

- Automatically resolving merge conflict contents
- Automatically committing user changes
- Changing squash / PR strategy
- Skipping rebase and failing open
- Redesigning the direct Flow state machine or completion recovery

<details>
<summary>ja</summary>

通常finalize-merge conflict後のrebase手順を実行可能に保つ

## 概要

通常 Flow の `finalize-merge` は、ベースブランチとの差分で rebase conflict を検出すると、worktree で rebase してから finalize を再試行する recovery hint を返します。

しかし現在は、hint を返した後に `finalize:onError` が failed outbox、後続 step 状態、runtime metadata、`issue-log.json` を更新するため、worktree が dirty になります。結果として、CLI が案内する recovery procedure をそのまま実行できず、ユーザーが Flow metadata を手動で commit しないと rebase を開始できません。

## 背景

spec `353-finalize-teardown-safety` / Issue #473 により、以下の隣接領域は解消済みです。

- direct finalize で rebase 後の HEAD に検証・統合記録を更新できる
- 中断した direct completion を保存済み transaction から再開できる
- teardown journal、completion receipt、cleanup を main 側の durable authority で完了できる
- cleanup 後に削除済み worktree を logger や runtime metadata が再参照しない

一方で、本件が対象とする通常の `finalize-merge` conflict 後の境界は未解消です。`finalizeOnError` を単体で再現すると、hint 返却後に少なくとも次の dirty 差分が残ります。

```text
 M specs/<spec>/issue-log.json
```

実際の lifecycle では、これに failed outbox と後続 step の `skipped` 更新を含む `flow.json` 差分も加わります。既存の metadata-only commit は次回の `finalize-merge` pre-hook で実行されるため、「hint を受け取った直後に rebase する」という案内順序には間に合いません。

## 問題

通常 Flow の recovery hint、監査証跡の永続化、Git worktree の clean 境界が単一 transaction として整合していません。

- conflict 検出側は「rebase してから retry」と案内する
- error lifecycle 側は案内後に worktree を dirty にする
- retry 前処理は metadata-only dirty を commit できるが、rebase より後に実行される

このため、ユーザーは CLI の案内外で手動 commit を作らなければ先へ進めません。Flow が所有する証跡の整合をユーザーに肩代わりさせている状態です。

## 期待する挙動

- 通常の `finalize-merge` が conflict を返した時点で、返された recovery procedure を追加判断なしに実行できる
- conflict reason、runtime log、failed outbox、後続 step 状態、`issue-log.json` を失わず durable に保存する
- 自動 commit する場合は、対象を当該 spec の `flow.json` と `issue-log.json` のみに限定する
- source、tests、docs、その他 spec 外の dirty file がある場合は自動 commit せず、Git や Flow を追加変更する前に停止理由と実行可能な次行動を返す
- conflict 解消後の retry では `finalize-sync` / `finalize-cleanup` を `pending` に戻し、merge / outbox side effect を一度だけ完了する
- #473 で完成した direct finalize / durable teardown 処理は再実装せず、通常 Flow の `finalize-merge` 境界だけを修正する

## 対象

- `src/flow/commands/merge.js`
- `src/flow/lib/run-finalize.js`
- `src/flow/definition.js`
- `src/flow/registry.js`
- `tests/unit/flow/finalize-merge-retry.test.js`
- 通常 `finalize-merge` の worktree CLI / E2E conflict tests

## Acceptance Criteria

1. 通常の `finalize-merge` が rebase conflict を検出した直後、worktree は clean であるか、返された単一の CLI-owned recovery command が証跡保存から rebase 開始可能状態までを完了できる。
2. recovery procedure の実行に、ユーザーによる Flow metadata の手動 commit を要求しない。
3. conflict reason、runtime log、failed outbox、後続 step 状態、`issue-log.json` の evidence が retry 後の main 側 final snapshot に残る。
4. metadata-only dirty の自動 commit 対象は、対象 spec の `flow.json` と `issue-log.json` のみである。
5. 対象外の dirty file が 1 つでもある場合、自動 commit、outbox 開始、step 変更を行わず、対象パスと実行可能な次行動を返す。
6. conflict 解消後の retry は `finalize-sync` / `finalize-cleanup` を `pending` に戻し、merge / outbox side effect を重複させない。
7. 実際に競合するベースブランチと feature worktree を使う E2E テストで、conflict 検出、証跡保存、rebase、retry、finalize 完了までを検証する。
8. 正常な merge 経路では余分な metadata commit を作らず、spec `263-fix-finalize-merge-dirty` の pre-merge 処理および #473 の direct finalize / cleanup 契約を壊さない。

## Evidence

- Related: Issue #458、spec `337-repair-stale-evidence-ledger`
- Related partial resolution: Issue #473、spec `353-finalize-teardown-safety`
- `src/flow/commands/merge.js` は conflict 後に rebase recovery hint を返し、rebase 自体は abort して worktree を復元する
- `src/flow/definition.js` の `finalize:onError` は、その後に failed outbox、`issue-log.json`、後続 step 状態を更新する
- `src/flow/lib/run-finalize.js` の metadata-only commit は `finalize-merge` 開始前の pre-hook 用であり、hint 返却直後の manual rebase boundary は扱わない
- 現行コードで `finalizeOnError` を再現すると、tracked な `issue-log.json` が dirty になることを確認済み
- 手動で Flow metadata commit を作成したケースでは、rebase と `finalize-merge` retry が成功している

## Out of Scope

- merge conflict 内容の自動解決
- ユーザー変更の自動 commit
- squash / PR strategy の変更
- rebase を省略して fail open にすること
- direct Flow の状態機械や completion recovery の再設計

</details>