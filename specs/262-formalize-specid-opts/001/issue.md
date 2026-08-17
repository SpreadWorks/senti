## Current Assessment (Investigation on 2026-05-20)

Verdict: **Still valid as actionable work**. However, the `updateStepStatus` path that originally led to `POST_HOOK_FAILED` is largely addressed.

This board item is not an emergency fix, but a task to formalize `FlowStore.mutate(mutator, { specId })` as an official API and prevent recurrence of main-repo authority operation failures.

## Already Fixed / Implemented

- `FlowStore.mutate(mutator, opts)` checks `opts.specId` and calls `this.load(specId)`.
  - Reference: `mutate(mutator, opts)` in `src/lib/flow-store.js`
- `FlowStore.updateStepStatus(stepId, status, opts)` accepts `opts` and forwards it to `this.mutate(..., opts)`.
  - Reference: `updateStepStatus` in `src/lib/flow-store.js`
- `flow set step` passes `{ specId: ctx.specId }` to `updateStepStatus` when `ctx.specId` is present.
  - Reference: `src/flow/lib/set-step.js`
- Post hooks after finalize-merge obtain a main-repo `FlowManager` via `forRoot(mainRepoPath)` and update steps passing `{ specId: ctx.specId }`.
  - Reference: `finalize-merge` / `finalize-sync` / `finalize-cleanup` post hooks in `src/flow/registry.js`
- `setMergeOutcome(..., opts)` supports `{ specId }` and is used from the finalize-merge post hook.
  - Reference: `setMergeOutcome` in `src/lib/flow-store.js`

## Still Incomplete / Inconsistent

- `FlowManager.mutate(mutator)` does not accept `opts`, so `mutate(mutator, { specId })` is not exposed as a formal Facade API.
  - Reference: `mutate(mutator)` in `src/lib/flow-manager.js`
- `setRequest(text)` / `setIssue(issue)` do not support `opts`. They are not yet APIs for directly updating a spec not registered in active-flow under main-repo authority.
  - Reference: `setRequest` / `setIssue` in `src/lib/flow-store.js`
- `addNote(text, opts)` / `appendMetric(payload, opts)` / `incrementMetric(phase, counter, opts)` handle `taskId` opts, but the internal `_appendFlowEntry` does not pass `opts` to `this.mutate(...)`, so `specId` has no effect.
  - Reference: `_appendFlowEntry` / `addNote` / `appendMetric` / `incrementMetric` in `src/lib/flow-store.js`
- `FlowManager`'s `setRequest` / `setIssue` do not accept `opts`.
  - Reference: setter group in `src/lib/flow-manager.js`
- Binding `specId` at construction time via `forRoot(root, { specId })` is not implemented. Currently, `{ specId }` must be passed on every call.
  - Reference: `forRoot(root)` in `src/lib/flow-manager.js`
- No unit tests or docs exist that formally guarantee `FlowStore.mutate(..., { specId })` as an official API.

## Where to Look When Implementing

1. `src/lib/flow-manager.js`
   - Change `mutate(mutator, opts)` to delegate to `_store.mutate(mutator, opts)`.
   - Thread `opts` through `setRequest` / `setIssue` and other necessary setters.
2. `src/lib/flow-store.js`
   - Add `setRequest(text, opts)` / `setIssue(issue, opts)`.
   - Use `this.mutate(..., opts)` in `_appendFlowEntry(arrayKey, payload, opts)`.
   - Make the no-op check in `appendMetric` independent of `pathForCurrent()` when `opts.specId` is present.
   - Verify opts propagation in `incrementMetric` / `accumulateAgentMetrics`.
3. CLI Layer
   - `flow set step` is already handled. Decide the actual usage scope of main-repo authority operations before threading specId into `flow set request` / `flow set issue` / `flow set note` / `flow set metric`.
4. Tests
   - Write unit tests to verify that `mutate` / `setRequest` / `setIssue` / `addNote` / `appendMetric` can update a flow.json via `{ specId }` when opened with `forRoot(mainRepoPath)` without being registered in the active-flow registry.
   - Test the difference between ambient no-op and explicit `{ specId }` for `appendMetric`.

## Original Background

Discovered during post-squash of spec 251 (#308): `forRoot(mainRepoPath).updateStepStatus()` failed to resolve flow.json when the spec was not registered in main-repo `.active-flow`, returning `POST_HOOK_FAILED` (`no active flow (flow.json not found)`). The root cause was that `FlowStore.mutate()` calls `_resolveCurrentFlow(flows)` without a specId, making it unable to resolve specs not registered in the main-repo active-flow registry.

In spec 251, `FlowStore.mutate(mutator, { specId })` was added as a temporary fix, and specId was threaded through `updateStepStatus` / `set step` / cleanup body / each finalize post hook. This task formalizes that as an official API.

## Original Proposal

- Document `FlowStore.mutate(mutator, { specId })` as an official API and add unit tests
- Align other setters (`setRequest` / `setIssue` / `addNote` / `appendMetric`, etc.) to support `{ specId }` opts
- Unify the path in CLI layer (e.g., `flow set step`) for threading `ctx.specId` from `resolveFlowContext`
- Consider an option to bind specId to `forRoot(...)` itself, so `FlowManager.load()` / `mutate()` obtained via `forRoot` work without passing specId on every call

## Related

This formalizes the temporary fix applied during spec 251 (#308) implementation. A prerequisite for fully enabling R2 (main-repo authority via forRoot).

<details>
<summary>ja</summary>

[ENHANCE] FlowStore.mutate の specId opts を正式 API 化 (main-repo authority 操作)

## 現状判定（2026-05-20 調査）

判定: **まだやるべき内容として有効**。ただし、元の `POST_HOOK_FAILED` につながった `updateStepStatus` 経路はかなり部分対応済み。

このボード項目は「障害の応急修正」ではなく、`FlowStore.mutate(mutator, { specId })` を正式 API として揃え、main-repo authority 操作を再発防止できる形にするタスクとして残す。

## すでに修正・実装されている範囲

- `FlowStore.mutate(mutator, opts)` は `opts.specId` を見て `this.load(specId)` する実装になっている。
  - 参照: `src/lib/flow-store.js` の `mutate(mutator, opts)`
- `FlowStore.updateStepStatus(stepId, status, opts)` は `opts` を受け取り、`this.mutate(..., opts)` に渡している。
  - 参照: `src/lib/flow-store.js` の `updateStepStatus`
- `flow set step` は `ctx.specId` があれば `{ specId: ctx.specId }` を `updateStepStatus` に渡す。
  - 参照: `src/flow/lib/set-step.js`
- finalize merge 以降の post hook は main repo 側 `FlowManager` を `forRoot(mainRepoPath)` で取得し、`{ specId: ctx.specId }` を渡して step 更新している。
  - 参照: `src/flow/registry.js` の `finalize-merge` / `finalize-sync` / `finalize-cleanup` post hook
- `setMergeOutcome(..., opts)` は `{ specId }` 対応済みで、finalize-merge post hook から使われている。
  - 参照: `src/lib/flow-store.js` の `setMergeOutcome`

## まだ未完了・齟齬が残る範囲

- `FlowManager.mutate(mutator)` が `opts` を受け取らないため、Facade の正式 API としては `mutate(mutator, { specId })` が露出していない。
  - 参照: `src/lib/flow-manager.js` の `mutate(mutator)`
- `setRequest(text)` / `setIssue(issue)` は `opts` 非対応。main repo authority で active-flow 未登録の spec を直接更新する API になっていない。
  - 参照: `src/lib/flow-store.js` の `setRequest` / `setIssue`
- `addNote(text, opts)` / `appendMetric(payload, opts)` / `incrementMetric(phase, counter, opts)` は `taskId` opts は扱うが、内部の `_appendFlowEntry` が `this.mutate(... )` に `opts` を渡していないため `specId` は効かない。
  - 参照: `src/lib/flow-store.js` の `_appendFlowEntry` / `addNote` / `appendMetric` / `incrementMetric`
- `FlowManager` 側の `setRequest` / `setIssue` も `opts` を受け取らない。
  - 参照: `src/lib/flow-manager.js` の setter 群
- `forRoot(root, { specId })` のように `specId` を bind するオプションは未実装。現状は呼び出しごとに `{ specId }` を渡す方式。
  - 参照: `src/lib/flow-manager.js` の `forRoot(root)`
- `FlowStore.mutate(..., { specId })` を正式 API として保証する単体テストや docs 記述は見当たらない。

## 次に実装するなら見る場所

1. `src/lib/flow-manager.js`
   - `mutate(mutator, opts)` にして `_store.mutate(mutator, opts)` へ委譲。
   - `setRequest` / `setIssue` / 必要な setter 群も `opts` を通す。
2. `src/lib/flow-store.js`
   - `setRequest(text, opts)` / `setIssue(issue, opts)` を追加。
   - `_appendFlowEntry(arrayKey, payload, opts)` で `this.mutate(..., opts)` を使う。
   - `appendMetric` の no-op 判定は `opts.specId` がある場合に `pathForCurrent()` へ依存しないようにする必要がある。
   - `incrementMetric` / `accumulateAgentMetrics` の opts 伝播を確認する。
3. CLI レイヤ
   - 現状 `flow set step` は対応済み。他の `flow set request` / `flow set issue` / `flow set note` / `flow set metric` まで specId threading が必要かは、main repo authority 操作の実利用範囲を決めてから揃える。
4. テスト
   - active-flow registry に未登録の main repo flow.json を `forRoot(mainRepoPath)` で開き、`mutate` / `setRequest` / `setIssue` / `addNote` / `appendMetric` が `{ specId }` で更新できることを単体テスト化する。
   - `appendMetric` は ambient no-op と `{ specId }` 明示時の違いをテストする。

## 元の背景

spec 251 (#308) の post-squash で発覚: `forRoot(mainRepoPath).updateStepStatus()` が main repo `.active-flow` 未登録の状態で flow.json を解決できず POST_HOOK_FAILED (`no active flow (flow.json not found)`) を返していた。原因は `FlowStore.mutate()` が specId なしで `_resolveCurrentFlow(flows)` を呼ぶため、main repo の active-flow registry に未登録の spec を解決できないこと。

spec 251 では場当たり的に `FlowStore.mutate(mutator, { specId })` を追加し、`updateStepStatus` / `set step` / cleanup body / 各 finalize post hook で specId を threading したが、これを正式 API として仕様化する。

## 当初の提案

- `FlowStore.mutate(mutator, { specId })` を正式 API としてドキュメント化 + 単体テスト整備
- 他の setter (`setRequest` / `setIssue` / `addNote` / `appendMetric` 等) も `{ specId }` opts 対応に揃える
- `flow set step` 等の CLI レイヤも `resolveFlowContext` から `ctx.specId` を threading する経路を統一
- `forRoot(...)` で取得した FlowManager の `load()` / `mutate()` が specId なしでも動くように、`forRoot` 自身に specId を bind するオプションも検討

## 関連

spec 251 (#308) 実装時の応急処置を恒久化する話。R2 (forRoot 経由 main authority) を完全機能させるための前提条件。

</details>