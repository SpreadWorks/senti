## Summary

Officially support guarded plan rewind with a required `reason` from the implementation stage. While preserving the worktree and source changes, atomically rewind the target flow to draft/spec clarification, invalidate existing approval/review/gate/test evidence as stale, and require the normal review/gate/approval and implementation verification to be rerun.

## Problem

Issue #432 is stopped at `impl-gate` retry 4/5. The approved R6 wording conflicts with Out of Scope, Acceptance Criteria, and task text, and the correct remediation is requirement clarification plus renewed plan review/gate/approval.

However, the existing `reopen-draft` assumes a current task, so it returns `NO_DONE_TASK` at `impl-gate`. Direct spec edits, manual step resets, and hand-editing `flow.json` are prohibited, and the pre-implementation reopen reset range cannot safely and consistently rewind implementation state and evidence.

This issue is a prerequisite for making #432 resumable through the official flow, and does not directly modify the run for #432 itself. Semantic gate bypass and retry extension are also not goals.

## Scope

- `src/flow/lib/run-reopen-draft.js`
- Flow definition / state mutation helpers in `FlowStore`
- `next-action` / registry only if needed to expose the official action
- Focused unit / e2e tests

## Requirements

1. Support flow-level plan rewind from pre-finalize stages: `impl-review`, `impl-gate`, `retro`, `acceptance`, and `final-regression`.
2. Require target guards for the run / Issue / spec and a non-empty `reason` when executing rewind.
3. Atomically transition to the correct draft/spec clarification step based on the stage and flow definition.
4. Clear stale user approval, and consistently reset / invalidate downstream state for plan review/gate/test and implementation/test/review/gate/retro/acceptance/final-regression.
5. Restore retry counters and evidence eligibility to a rerunnable state.
6. After the transition completes, exactly one in-progress leaf must exist, and the flow status and `flow get next-action` must indicate the same clarification action.
7. Preserve the existing worktree and source changes.
8. Do not delete prior spec / review / gate / test / implementation artifacts; keep them trackable as stale / invalidated.
9. After clarification, existing approval/evidence must not be reusable, and normal draft/spec review, gate, user approval, and implementation verification must be required again.
10. Do not change the route / behavior of the existing task-level reopen.
11. On guard mismatch, return `ACTIVE_FLOW_MISMATCH` and do not change state, worktree/source, artifacts, or audit log at all.
12. Do not support rewind after `finalize-merge` or baseline completion, force cleanup, or manual `flow.json` edits.
13. Maintain public ownership and store invariants, and do not add new dependencies or compatibility shims.
14. Durably record `reason`, target identity, source stage, destination step, and invalidated approval/evidence in the audit trail.

## Acceptance Criteria

- [ ] Given an `impl-gate` fixture with existing code changes and evidence, official rewind succeeds when matching run / Issue / spec guards and a `reason` are specified.
- [ ] After rewind, the flow atomically returns to the draft/spec clarification step corresponding to the flow definition, and status is consistent with `flow get next-action`.
- [ ] After the transition, there is always exactly one in-progress leaf, with no dual/orphan in-progress state.
- [ ] Prior user approval is cleared, and the flow cannot return to the implementation route until review/gate/approval are completed again after clarification.
- [ ] Downstream states, retry counters, and evidence eligibility are consistently reset / invalidated.
- [ ] Worktree/source changes are preserved byte-for-byte/content-preserving, and prior artifacts remain identifiable as stale / invalidated.
- [ ] The durable audit trail records `reason`, target identity, source stage, destination step, and invalidated approval/evidence.
- [ ] Each run / Issue / spec guard mismatch returns `ACTIVE_FLOW_MISMATCH` before mutation, and flow state, worktree/source, artifacts, and audit trail remain byte-identical.
- [ ] There is no regression in the existing success/failure routes and state transitions for task-level reopen.
- [ ] Coverage for `impl-review`, `impl-gate`, `retro`, `acceptance`, and `final-regression` is verified by unit tests.
- [ ] Rewind after `finalize-merge` or baseline completion is explicitly rejected and does not change state.
- [ ] An e2e test verifies the path: `impl-gate` fixture -> guarded/reasoned rewind -> clarification -> renewed review/gate/approval -> implementation verification required.
- [ ] Rewind does not treat gate failure as deferred/pass, and does not cause semantic gate bypass or additional retries.

## Verification

- Compare the `impl-gate` fixture state / artifacts / worktree snapshots before and after rewind, and separately confirm source preservation and state/evidence invalidation.
- Traverse the flow tree and verify that the in-progress leaf count is 1.
- Assert retry counters, approval markers, evidence eligibility, next-action, and audit record.
- Confirm immutability of durable inputs for the three guard mismatch types and the finalize boundary.
- Run focused regression tests for task-level reopen.

## Out of Scope

- Directly resetting / mutating / recovering the flow for Issue #432
- Bypassing, deferring, or marking semantic gate findings as passed
- Extending plan / implementation gate retry limits
- Rewind after `finalize-merge` / baseline completion
- Force cleanup, worktree/source deletion, or manual `flow.json` edits
- New external dependencies or public compatibility shims

<details>
<summary>ja</summary>

implementation stage から guarded plan rewind をサポートする

## Summary

implementation stage から、`reason` 必須の guarded plan rewind を公式サポートする。worktree と source changes を保持したまま、対象 flow を draft/spec clarification へ原子的に巻き戻し、既存の approval/review/gate/test evidence を stale として無効化して、通常の review/gate/approval と implementation verification を再実行させる。

## Problem

Issue #432 は `impl-gate` retry 4/5 で停止している。approved R6 wording が Out of Scope、Acceptance Criteria、task text と矛盾しており、正しい remediation は requirement clarification と renewed plan review/gate/approval である。

しかし既存の `reopen-draft` は current task 前提のため、`impl-gate` では `NO_DONE_TASK` を返す。direct spec edit、manual step reset、`flow.json` の手編集は禁止されており、pre-implementation 向けの reopen reset range では implementation state と evidence を安全かつ整合的に巻き戻せない。

本 Issue は #432 を正規フローで再開可能にするための prerequisite であり、#432 自体の run を直接変更するものではない。semantic gate bypass や retry extension も目的ではない。

## Scope

- `src/flow/lib/run-reopen-draft.js`
- flow definition / `FlowStore` の state mutation helpers
- official action 公開に必要な場合に限る `next-action` / registry
- focused unit / e2e tests

## Requirements

1. `impl-review`、`impl-gate`、`retro`、`acceptance`、`final-regression` の finalize 前 stage から flow-level plan rewind をサポートする。
2. rewind 実行時は run / Issue / spec の target guards と non-empty `reason` を必須にする。
3. stage と flow definition に基づいて、正しい draft/spec clarification step へ atomic に遷移する。
4. stale な user approval を clear し、plan review/gate/test と implementation/test/review/gate/retro/acceptance/final-regression の downstream state を一貫して reset / invalidate する。
5. retry counters と evidence eligibility を再実行可能な状態に戻す。
6. transition 完了後は in-progress leaf が厳密に 1 つだけ存在し、flow status と `flow get next-action` が同じ clarification action を示す。
7. existing worktree と source changes は保持する。
8. prior spec / review / gate / test / implementation artifacts は削除せず、stale / invalidated として追跡可能にする。
9. clarification 後は既存 approval/evidence を再利用できず、通常の draft/spec review、gate、user approval、implementation verification を再度必須にする。
10. 既存の task-level reopen の route / behavior は変更しない。
11. guard mismatch 時は `ACTIVE_FLOW_MISMATCH` を返し、state、worktree/source、artifacts、audit log を一切変更しない。
12. `finalize-merge` または baseline 完了後の rewind、force cleanup、manual `flow.json` edit はサポートしない。
13. public ownership と store invariants を維持し、新規依存や compatibility shim は追加しない。
14. audit trail に `reason`、target identity、source stage、destination step、invalidated approval/evidence を durable に記録する。

## Acceptance Criteria

- [ ] existing code changes と evidence を持つ `impl-gate` fixture で、matching run / Issue / spec guards と `reason` を指定した official rewind が成功する。
- [ ] rewind 後、flow definition に対応した draft/spec clarification step に atomic に戻り、status と `flow get next-action` が整合する。
- [ ] transition 後の in-progress leaf は常に 1 つで、dual/orphan in-progress state が発生しない。
- [ ] prior user approval は clear され、clarification 後に review/gate/approval を再完了するまで implementation route に戻れない。
- [ ] downstream states、retry counters、evidence eligibility が一貫して reset / invalidated される。
- [ ] worktree/source changes は byte/content-preserving で保持され、prior artifacts は stale / invalidated として識別可能なまま残る。
- [ ] durable audit trail に `reason`、target identity、source stage、destination step、invalidated approval/evidence が記録される。
- [ ] run / Issue / spec の各 guard mismatch は mutation 前に `ACTIVE_FLOW_MISMATCH` を返し、flow state、worktree/source、artifacts、audit trail が byte-identical のまま残る。
- [ ] task-level reopen の既存成功・失敗 route と state transition に回帰がない。
- [ ] `impl-review`、`impl-gate`、`retro`、`acceptance`、`final-regression` の coverage が unit tests で検証される。
- [ ] `finalize-merge` または baseline 完了後の rewind は明示的に拒否され、state を変更しない。
- [ ] e2e test で `impl-gate` fixture -> guarded/reasoned rewind -> clarification -> renewed review/gate/approval -> implementation verification required の経路を検証できる。
- [ ] rewind によって gate failure を deferred/pass 扱いせず、semantic gate bypass や追加 retry を発生させない。

## Verification

- rewind 前後で `impl-gate` fixture の state / artifacts / worktree snapshots を比較し、source preservation と state/evidence invalidation を分離して確認する。
- flow tree を走査し、in-progress leaf count が 1 であることを検証する。
- retry counters、approval markers、evidence eligibility、next-action、audit record を assertion する。
- 3 種類の guard mismatch と finalize boundary で durable inputs の immutability を確認する。
- task-level reopen focused regression tests を実行する。

## Out of Scope

- Issue #432 の flow を直接 reset / mutate / recover すること
- semantic gate finding の bypass、defer、pass 化
- plan / implementation gate retry 上限の拡張
- `finalize-merge` / baseline 完了後の rewind
- force cleanup、worktree/source deletion、manual `flow.json` edits
- 新規外部依存または public compatibility shim

</details>