## Summary

Immediately after recording an `acceptance-decision` in a flow on a managed worktree, only that flow's active entry may disappear from `.senti/.active-flow` in the main repository, while the worktree's `flow.json` and run identity remain valid.

When this happens, normal commands such as `flow get next-action` can no longer resolve the target flow, and manual recovery with exact target guards on `flow resume --parked` is required. Because the durable state is healthy but only the shared active-flow registry is missing, there is likely a destructive race in registry mutation or pointer lifecycle during multi-flow execution.

## Impact

- Active flows can no longer be discovered through normal commands
- Users must manually recover after identifying the `runId`, Issue, and spec
- If a mutation for one flow affects another flow's active entry, the isolation guarantee between managed worktrees is broken

## Observed Behavior

The following sequence was observed in the flow for Issue #457.

1. `acceptance-review` detects an unresolved advisory risk
2. `flow set acceptance-decision --choice accept_risk_and_continue` succeeds
3. The next flow command can no longer find the shared active-flow pointer
4. Meanwhile, the worktree, spec-local `flow.json`, `runId`, Issue, and spec identity all remain valid
5. Re-registering with `flow resume --parked` using exact `runId` / Issue / spec guards allows the flow to continue

## Expected Behavior

- After `acceptance-decision` succeeds, the target flow's active registry entry is preserved
- Even when multiple active flows exist, a mutation for one flow does not delete other entries
- Registry revision conflicts or lock failures do not result in partial success; they fail closed with an explicit cause
- On command success, identity consistency between the durable flow state and the active-flow registry is verified
- `flow resume --parked` remains available as a recovery mechanism, but is not required on the normal path

## Reproduction Hints

Another managed-worktree flow was running around the same time, so one or more of the following are suspected:

- Missing active-flow pointer update after `acceptance-decision`
- Read-modify-write race during multi-flow registry mutation
- Incomplete write-back when a revision mismatch or lock failure occurs
- Missing registry consistency validation after lifecycle updates

## Main Investigation Targets

- `src/flow/lib/set-acceptance-decision.js`
- `src/flow/lib/acceptance-review-artifacts.js`
- `src/lib/active-flow-registry.js`
- `src/lib/flow-manager.js`
- `src/flow/lib/flow-context.js`

## Completion Criteria

- With two or more managed-worktree flows registered, recording `acceptance-decision` for one flow preserves all active entries
- A guarded `flow get next-action` after `acceptance-decision` can resolve the same `runId` / Issue / spec
- Injecting registry mutation races, revision mismatches, or lock failures does not lose entries for other flows
- Existing behavior is preserved for single-flow, multi-flow, and `flow resume --parked`
- A regression test is added across the active-flow registry and acceptance-decision lifecycle

## Evidence

`specs/334-stale-test-evidence-recovery/issue-log.json`

- step: `final-regression`
- reason: `The shared active-flow pointer disappeared after acceptance-decision even though the worktree flow state and exact identity remained valid`
- resolution: recovered by running `flow resume --parked` with exact `runId` / Issue / spec guards
- runId: `512698c6-f674-45f6-b688-4a9f6d26869f`

<details>
<summary>ja</summary>

acceptance-decision 後に managed worktree の active-flow pointer が消失する

## 概要

managed worktree 上の flow で `acceptance-decision` を記録した直後、worktree 内の `flow.json` と run identity は正常なまま、main repository の `.senti/.active-flow` から当該 flow の active entry だけが消失することがある。

この状態になると、通常の `flow get next-action` などが対象 flow を解決できなくなり、`flow resume --parked` に exact target guards を付けた手動復旧が必要になる。durable state は健全なのに shared active-flow registry だけが欠落するため、multi-flow 実行時の registry mutation または pointer lifecycle に破壊的競合がある可能性が高い。

## 影響

- 通常コマンド経由で active flow を発見できなくなる
- 利用者が `runId` / Issue / spec を把握したうえで手動 recovery を行う必要がある
- 1 flow の mutation が他 flow の active entry に影響する場合、managed worktree 間の分離保証が崩れる

## 観測した事象

Issue #457 の flow で次の順序を確認した。

1. `acceptance-review` が unresolved advisory risk を検出する
2. `flow set acceptance-decision --choice accept_risk_and_continue` が成功する
3. 次の flow command で shared active-flow pointer が見つからなくなる
4. 一方で、worktree、spec-local `flow.json`、`runId`、Issue、spec identity は有効なまま残る
5. `flow resume --parked` に exact `runId` / Issue / spec guards を指定して再登録すると継続できる

## 期待される動作

- `acceptance-decision` 成功後も、対象 flow の active registry entry は保持される
- 複数の active flow が存在しても、ある flow の mutation が他 entry を削除しない
- registry revision conflict や lock failure は部分成功にせず、原因を明示して fail-closed にする
- command 成功時は durable flow state と active-flow registry の identity 一貫性を検証する
- `flow resume --parked` は recovery 手段として維持しつつ、通常経路の必須操作にはしない

## 再現条件の示唆

同時期に別の managed-worktree flow も稼働していたため、次のいずれか、または組み合わせが疑われる。

- `acceptance-decision` 後の active-flow pointer 更新処理の欠落
- multi-flow registry mutation 時の read-modify-write 競合
- revision mismatch または lock failure 発生時の不完全な書き戻し
- lifecycle 更新後の registry 整合性未検証

## 主な調査対象

- `src/flow/lib/set-acceptance-decision.js`
- `src/flow/lib/acceptance-review-artifacts.js`
- `src/lib/active-flow-registry.js`
- `src/lib/flow-manager.js`
- `src/flow/lib/flow-context.js`

## 完了条件

- 2 つ以上の managed-worktree flow を登録した状態で、一方の `acceptance-decision` を記録しても全 active entry が保持される
- `acceptance-decision` 後の guarded `flow get next-action` が同じ `runId` / Issue / spec を解決できる
- registry mutation 競合、revision mismatch、lock failure を注入しても他 flow の entry が失われない
- single-flow、multi-flow、`flow resume --parked` の既存動作を維持する
- active-flow registry と acceptance-decision lifecycle をまたぐ regression test を追加する

## 証拠

`specs/334-stale-test-evidence-recovery/issue-log.json`

- step: `final-regression`
- reason: `The shared active-flow pointer disappeared after acceptance-decision even though the worktree flow state and exact identity remained valid`
- resolution: exact `runId` / Issue / spec guards を付けて `flow resume --parked` を実行し復旧
- runId: `512698c6-f674-45f6-b688-4a9f6d26869f`

</details>