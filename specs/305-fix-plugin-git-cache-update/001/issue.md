## Summary
`Senti plugin update-all` can fail to correctly adopt remote updates when using an existing Git URL source cache, causing installed packages to be incorrectly judged as having "no updates".

In the update handling for an existing cache in `syncGitUrlSource()`, `git fetch --all --tags` is executed, but when `source.ref` is unspecified, it reads `git rev-parse HEAD` without advancing the local checkout. As a result, even if the local branch in the cache is behind `origin/<branch>`, the old `HEAD` remains, and `syncInstalledPlugins(root, { update: true })` treats the stale commit as the "post-update commit".

## Current Problem
- `updated: false` is returned even when the plugin has been updated on the remote side
- The JSON result's `commit` remains old
- Update results become non-deterministic depending on the cache state under `.senti/plugin-sources/`

## Affected Code Path
- `src/plugin.js`: `senti plugin update-all` calls `syncInstalledPlugins(root, { update: true })`
- `src/lib/plugin-registry.js`: in update mode, calls `resolveSource(root, source)` for each enabled package
- `src/lib/plugin-registry.js`: `resolveSource()` passes Git URL sources to `syncGitUrlSource()`
- `src/lib/plugin-registry.js`: `syncGitUrlSource()` runs `git fetch --all --tags` on an existing cache, but when `source.ref` is unspecified, it does not advance the local branch and reads `git rev-parse HEAD` as-is

## Reproduction Example
- cache: `.senti/plugin-sources/senti-workflow-plugin`
- local `main`: `f34a278...`
- `origin/main`: `e371e01...`
- Git state: `main...origin/main [behind 24]`
- command: `senti plugin update-all --json --no-upgrade`
- result:
  - `previousCommit: f34a278...`
  - `commit: f34a278...`
  - `updated: false`

In this case, the remote commit after fetch should be adopted.

## Expected Behavior
For Git source updates, the target revision to adopt should be explicitly resolved after fetch before determining the package commit.

- When `source.ref` is specified, resolve that ref deterministically after fetch and adopt it
- When `source.ref` is unspecified, adopt the remote default branch
- Do not depend on the current tracking branch or the stale `HEAD` of the existing checkout
- Do not use the stale `HEAD` of an existing checkout as the post-update commit as-is

At minimum, the implementation needs one of the following:
- Checkout / fast-forward / reset to the resolved target revision, then adopt the resulting `HEAD`
- Or use the resolved revision's commit directly for install/materialize without depending on local branch state

## Handling Dirty Cache
Git URL source caches under `.senti/plugin-sources/` should be treated as managed areas. If a dirty cache is detected, do not silently adopt a stale `HEAD`; instead, return it to a managed state by force-updating it or deleting the cache and re-cloning.

- On dirty detection, self-heal instead of failing fast
- Force-update with reset / clean where possible
- If reset / clean cannot return it to a managed state, delete the cache and re-clone
- Apply the same policy when the cache is dirty only because of file mode differences

## Acceptance Criteria
- When `senti plugin update-all` is run with a Git URL source cache whose local branch is behind the remote, the remote default branch commit after fetch is adopted as the package commit
- If the installed package commit changes, the JSON result returns the new `commit` and `updated: true`
- Sources without `source.ref` are resolved deterministically to the remote default branch
- Branch / tag / SHA-equivalent behavior when `source.ref` is specified is defined and fixed by tests
- Dirty Git URL caches are returned to a managed state by force-update or by deleting the cache and re-cloning
- A stale `HEAD` is not silently returned as the post-update commit because of a dirty cache
- Regression tests are added for behind-remote caches and the dirty-cache self-heal policy

<details>
<summary>ja</summary>

[BUG] plugin update-all が Git source cache を fetch 後に進めない

## 概要
`Senti plugin update-all` が、既存の Git URL source cache を使うケースで remote 側の更新を正しく採用できず、installed package を「更新なし」と誤判定することがあります。

既存 cache に対する `syncGitUrlSource()` の更新処理では `git fetch --all --tags` は実行されますが、`source.ref` が未指定のときに local checkout を進めないまま `git rev-parse HEAD` を読み取っています。そのため、cache 内の local branch が `origin/<branch>` より behind でも古い `HEAD` が残り、`syncInstalledPlugins(root, { update: true })` が stale な commit を「更新後 commit」として扱ってしまいます。

## 現在の問題
- remote 側では plugin が更新されていても `updated: false` になる
- JSON result の `commit` が古いままになる
- `.senti/plugin-sources/` 配下の cache 状態により、更新結果が非決定的になる

## 影響するコード経路
- `src/plugin.js`: `senti plugin update-all` が `syncInstalledPlugins(root, { update: true })` を呼ぶ
- `src/lib/plugin-registry.js`: update mode では enabled package ごとに `resolveSource(root, source)` を呼ぶ
- `src/lib/plugin-registry.js`: `resolveSource()` が Git URL source を `syncGitUrlSource()` に渡す
- `src/lib/plugin-registry.js`: `syncGitUrlSource()` は既存 cache に `git fetch --all --tags` を実行するが、`source.ref` 未指定時は local branch を進めず、そのまま `git rev-parse HEAD` を読む

## 再現例
- cache: `.senti/plugin-sources/senti-workflow-plugin`
- local `main`: `f34a278...`
- `origin/main`: `e371e01...`
- Git state: `main...origin/main [behind 24]`
- command: `senti plugin update-all --json --no-upgrade`
- result:
  - `previousCommit: f34a278...`
  - `commit: f34a278...`
  - `updated: false`

このケースでは、fetch 後の remote commit が採用されるべきです。

## 期待動作
Git source update では、fetch 後に採用対象 revision を明示的に解決してから package commit を決定します。

- `source.ref` 指定時は、その ref を fetch 後に決定論的に解決して採用する
- `source.ref` 未指定時は、remote default branch を採用する
- current tracking branch や既存 checkout の stale な `HEAD` には依存しない
- 既存 checkout の stale な `HEAD` を、そのまま更新後 commit として使わない

実装としては、少なくとも以下のいずれかが必要です。
- 解決した target revision に対して checkout / fast-forward / reset を行い、その後の `HEAD` を採用する
- あるいは local branch 状態に依存せず、解決済み revision の commit を直接 install/materialize に使う

## dirty cache の扱い
`.senti/plugin-sources/` 配下の Git URL source cache は管理領域として扱います。dirty な cache を検出した場合、stale な `HEAD` を黙って採用せず、強制更新または cache 削除後の再 clone によって管理状態へ戻してから更新します。

- dirty 検出時は fail-fast ではなく self-heal する
- 可能な場合は reset / clean によって強制更新する
- reset / clean で管理状態へ戻せない場合は cache を削除して再 clone する
- file mode 差分のみで dirty な場合も同じ方針で扱う

## 受け入れ条件
- local branch が remote より behind の Git URL source cache で `senti plugin update-all` を実行すると、fetch 後の remote default branch commit が package commit として採用される
- installed package commit が変わる場合、JSON result は新しい `commit` と `updated: true` を返す
- `source.ref` 未指定 source は remote default branch に決定論的に解決される
- `source.ref` 指定時の branch / tag / SHA 相当の挙動が定義され、テストで固定される
- dirty な Git URL cache は強制更新または cache 削除後の再 clone により管理状態へ戻される
- dirty cache が原因で stale な `HEAD` を更新後 commit として黙って返さない
- behind-remote cache の regression test と、dirty-cache self-heal policy の regression test が追加される

</details>