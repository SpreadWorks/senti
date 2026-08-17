## Summary

The boundary fix for artifact authority and execution checkout in worktree Flow, which was handled in the old Issue #491, was implemented on `fix/491-flow-authority-boundaries`. However, the reference commits `8845e8eb` / `814fad13` were never integrated into `main`, while only the issue was marked complete.

Since then, changes related to Flow target / dispatcher / recovery, including Issues #489-#493, have landed on `main`, and the old branch has diverged significantly from the current `main`. Merging the old branch as-is risks breaking the current target identity authority and recovery boundaries.

This work should not be treated as reopening the old Issue #491, but as **new work to rebuild the authority boundaries using the current `main` as the only base**. The old branch should be referenced only as design and test material; commits must not be mechanically imported or cherry-picked in bulk.

## Problem

On the current `main`, Flow artifacts and execution checkouts are still passed around as raw root strings, leaving a structure where API boundaries can confuse their intended use.

Specifically, the following problems exist.

- Misuse of artifact roots and execution roots cannot be prevented by types.
- Boundary types equivalent to `FlowArtifactStore` / `FlowExecutionCheckout` / `FlowCommandAuthority` do not exist.
- For specs, task specs, file maps, issue logs, review / gate / test evidence, and plugin artifacts, paths still remain where the reference source is inferred per command.
- Different root combinations can be used for fingerprint capture and revalidation.
- In `repair-state-identity.js`, there are conflict points with the `FlowTargetIdentityAuthority` introduced in Issue #493, so correctness cannot be guaranteed by mechanically merging the diff from the old branch.

## Goal

Flow commands should hold **base-side artifact authority** and **execution checkout** as explicit types, structurally guaranteeing the following.

- An execution root cannot be passed to artifact APIs.
- An artifact root cannot be passed to Git / implementation / project test APIs.
- Both worktree Flow and non-worktree Flow operate under the same authority model.

## Scope

### In scope

- Create a new branch from the current `main` and redesign the authority boundaries.
- Introduce dedicated classes around `FlowWorkspace` for artifact store / execution checkout / command authority.
- Audit authority usage across the entire Flow command surface and replace it with typed boundaries.
- Adapt and port the test perspectives from the old branch to the current `main`.

### Out of scope

- Reopening the old Issue #491.
- Unverified merging or bulk cherry-picking from the old branch.
- Restoring worktree-side spec copies as a second authority.
- Relaxing the target guard / step completion guard.

## Implementation direction

- Use `FlowWorkspace` as the base and represent artifact store, execution checkout, and command authority as dedicated classes, enforcing invariants in constructors.
- Centralize Flow artifact reads and writes in `FlowSpecLocation` or the artifact store.
- Git diff, HEAD, index, untracked source, and project tests should use only the execution checkout.
- Confine file-map reconciliation to a dedicated boundary that explicitly combines the base-side file map and execution checkout diff.
- Define the input authority for review / repair fingerprints in one place, and use the same implementation for capture and revalidation.
- Audit the full Flow command surface, including gate, review, set-step, test evidence, finalize, and plugin hooks, as an authority matrix.
- Preserve the contract between the `FlowTargetIdentityAuthority` from Issue #493 and `repair-state-identity.js`.
- Do not cherry-pick commits from the old branch; port only the necessary design and tests after adapting them to the current `main`.

## Acceptance criteria

1. Even in worktree Flow, specs, task specs, file maps, issue logs, plugin artifacts, and Flow evidence are read and written only from the base-side authority.
2. Git diffs, changed source, HEAD / index / untracked state, and project tests target only the execution checkout.
3. Artifact APIs and execution APIs receive dedicated classes, and boundary checks reject mix-ups of raw root strings.
4. File-map reconciliation has a structure that compares the base-side map with the execution checkout diff.
5. Updating only Flow artifacts does not change the implementation target fingerprint; it changes only when implementation code is updated.
6. Fingerprint capture and revalidation use the same typed service.
7. In a test where different specs are placed in `main` and the worktree, only the base-side spec is used as the authority.
8. Authority matrix tests exist for gate / review / set-step / test evidence / plugin artifact / finalize.
9. In non-worktree Flow, both authorities resolve to the same repository while operating through the same API.
10. There are no regressions in the target resolution, dispatcher, recovery, or side-effect-before-failure contracts introduced in Issues #489-#493.
11. No fallback to old worktree-side specs or legacy root inference paths remain.

## Verification

- Port and run the authority-focused tests from the old branch for the current `main`.
- `tests/unit/lib/flow-workspace.test.js`
- `tests/unit/flow/shared-spec-execution-boundary.test.js`
- `tests/unit/lib/plugin-hook-recovery.test.js`
- Focused unit / E2E tests for gate / review / set-step / finalize.
- `node tests/run.js --scope unit`
- `node tests/run.js --scope e2e`
- Static audit for remaining paths that construct Flow artifact paths from raw roots.

## References

- Old Issue #491: https://github.com/SpreadWorks/senti/issues/491
- Old branch: `fix/491-flow-authority-boundaries`
- Reference commits: `8845e8eb`, `814fad13`
- Dependency context: Issues #489-#493

<details>
<summary>ja</summary>

Flow artifact authorityとexecution checkout境界を現main上で再構築する

## Summary

旧Issue #491で扱っていた worktree Flow における artifact authority と execution checkout の境界修正は、`fix/491-flow-authority-boundaries` 上で実装されたものの、参考コミット `8845e8eb` / `814fad13` は `main` に統合されないまま Issue だけが完了扱いになっている。

その後 `main` には Issue #489〜#493 を含む Flow target / dispatcher / recovery 系の変更が入っており、旧ブランチは現行 `main` と大きく乖離している。旧ブランチをそのままマージすると、現行の target identity authority や recovery 境界を壊すリスクがある。

この作業は旧Issue #491 の reopen ではなく、**現行 `main` を唯一のベースとして authority 境界を再構築する新規対応**として扱う。旧ブランチは設計・テストの参考資料としてのみ参照し、コミットの機械的取り込みや一括 cherry-pick は行わない。

## Problem

現行 `main` では、Flow artifact と execution checkout が raw な root 文字列で受け渡されており、API 境界で用途を取り違えられる構造が残っている。

具体的には以下の問題がある。

- artifact root と execution root の誤用を型で防げない。
- `FlowArtifactStore` / `FlowExecutionCheckout` / `FlowCommandAuthority` 相当の境界型が存在しない。
- spec、task spec、file-map、issue-log、review / gate / test evidence、plugin artifact について、参照元を command ごとに推測する経路が残っている。
- fingerprint の capture と revalidation で異なる root 組み合わせを使えてしまう。
- `repair-state-identity.js` では、Issue #493 で導入された `FlowTargetIdentityAuthority` との競合点があり、旧ブランチとの差分を機械的にマージしても正当性を保証できない。

## Goal

Flow command が **base-side artifact authority** と **execution checkout** を明示的な型として保持し、以下を構造的に保証する。

- artifact API に execution root を渡せない
- Git / implementation / project test API に artifact root を渡せない
- worktree Flow と non-worktree Flow の両方で、同一の authority モデルで動作する

## Scope

### In scope

- 現行 `main` から新規ブランチを作成し、authority 境界を再設計する
- `FlowWorkspace` を中心に artifact store / execution checkout / command authority を専用 class として導入する
- Flow command surface 全体の authority 利用箇所を棚卸しし、typed boundary に置き換える
- 旧ブランチのテスト観点を現行 `main` に適合させて移植する

### Out of scope

- 旧Issue #491 の reopen
- 旧ブランチの無検証マージや一括 cherry-pick
- worktree 側 spec copy を第二 authority として復活させること
- target guard / step completion guard の緩和

## Implementation direction

- `FlowWorkspace` を基点に、artifact store・execution checkout・command authority を専用 class で表現し、constructor で invariant を保証する。
- Flow artifact の読み書きは `FlowSpecLocation` または artifact store に集約する。
- Git diff、HEAD、index、untracked source、project test は execution checkout だけを使用する。
- file-map reconciliation は、base-side file map と execution checkout diff を明示的に組み合わせる専用境界に閉じ込める。
- review / repair fingerprint の入力 authority は一か所で定義し、capture と revalidation で同一実装を使用する。
- gate、review、set-step、test evidence、finalize、plugin hook を含む Flow command surface 全体を authority matrix として監査する。
- Issue #493 の `FlowTargetIdentityAuthority` と `repair-state-identity.js` の契約を維持する。
- 旧ブランチのコミットは cherry-pick せず、必要な設計とテストだけを現行 `main` に適合させて移植する。

## Acceptance criteria

1. worktree Flow でも、spec・task spec・file-map・issue-log・plugin artifact・Flow evidence は base-side authority だけから読み書きされる。
2. Git 差分、変更 source、HEAD / index / untracked 状態、project test は execution checkout だけを対象にする。
3. artifact API と execution API は専用 class を受け取り、raw root 文字列の取り違えを境界で拒否する。
4. file-map reconciliation は base-side map と execution checkout diff を比較する構造になっている。
5. Flow artifact だけを更新しても implementation target fingerprint は変化せず、実装コード更新時だけ変化する。
6. fingerprint の capture と revalidation が同一の typed service を使用する。
7. `main` と worktree に異なる spec を配置したテストで、base-side spec だけが authority として使われる。
8. gate / review / set-step / test evidence / plugin artifact / finalize を対象に authority matrix test が存在する。
9. non-worktree Flow では両 authority が同一 repository に解決されつつ、同じ API で動作する。
10. Issue #489〜#493 で導入された target 解決、dispatcher、recovery、side-effect-before-failure 契約に回帰がない。
11. 旧 worktree 側 spec への fallback や legacy root 推測経路が残っていない。

## Verification

- 旧ブランチの authority-focused test を現行 `main` 向けに移植して実行する
- `tests/unit/lib/flow-workspace.test.js`
- `tests/unit/flow/shared-spec-execution-boundary.test.js`
- `tests/unit/lib/plugin-hook-recovery.test.js`
- gate / review / set-step / finalize の focused unit / E2E
- `node tests/run.js --scope unit`
- `node tests/run.js --scope e2e`
- raw root から Flow artifact path を構築する残存経路の静的監査

## References

- 旧Issue #491: https://github.com/SpreadWorks/senti/issues/491
- 旧ブランチ: `fix/491-flow-authority-boundaries`
- 参考コミット: `8845e8eb`, `814fad13`
- 依存文脈: Issue #489〜#493

</details>