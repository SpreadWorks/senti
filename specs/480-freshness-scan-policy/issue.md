## Summary

The freshness check in `src/check/commands/freshness.js` currently scans the entire repository root as the source, so generated spec evidence and runtime artifacts also consume the shared `maxFiles=10000` budget. As a result, even when the actual source/docs related to docs generation are small, `senti check freshness` can become `indeterminate` and fall back to manual mtime comparison instead of automated judgment.

## Observed Behavior

At the start of the flow for Issue #459, `senti check freshness` returned `indeterminate`.

Evidence:

- `specs/336-reset-draft-review-artifacts/issue-log.json`
- step: `draft`
- reason: `Automated docs freshness check could not complete because an existing spec artifact exceeded the 10000-file scan limit`
- trigger: `senti check freshness returned indeterminate at specs/322-flow-target-transition-guards/spec-gate-source.json`

## Problem

Because the freshness check includes generated evidence that is not a docs generation target in the source-side scan, a long-running repository can hit the file limit regardless of the size of `src/` or the docs build target. As a result, source/docs freshness cannot be automatically classified as `fresh` or `stale`, reducing flow reliability and automation coverage.

## Cause

`src/check/commands/freshness.js` passes the default `sourceRoot()`, which is the repository root, to `FileTreeWalker`, but does not apply a freshness-specific directory filter or policy. Because of this, `specs/`, `.senti/`, generated evidence, runtime artifacts, and similar files consume the file budget used for freshness evaluation.

## Expected Behavior

Separate the source surface that affects docs builds from the generated/runtime surface during freshness evaluation. At minimum, changes to generated evidence alone should not affect the verdict, and the verdict should change to `fresh` or `stale` only in response to changes in relevant source or docs.

## Improvement Direction

- Introduce a freshness-specific scan policy that separates the source surface affecting docs builds from generated/runtime surfaces.
- Exclude at least `.git/`, runtime/output under `.senti/`, `specs/**/review-history`, `review-evidence`, `tests/.raw`, and similar generated evidence from the source freshness file budget.
- Define exclusions as generic boundaries that can be shared with the docs build/source resolver, rather than hardcoding project-specific paths.
- If scanning the relevant source or docs is itself incomplete, continue to fail closed by returning `indeterminate` as before.
- Preserve structured result details for the scan target, applied exclusion policy, and limit-reached path.

## Targets

- `src/check/commands/freshness.js`
- `src/lib/file-tree-walker.js` minimal generic filter/budget contract as needed
- `tests/unit/check/scan-freshness.test.js`

## Completion Criteria

- Even when generated spec evidence exceeds 10,000 files, `fresh` or `stale` can be determined if the relevant source/docs are within the limit.
- If the relevant source itself exceeds the limit, is unreadable, or reaches the depth limit, the result remains fail-closed as `indeterminate`.
- The freshness verdict does not change based only on whether generated evidence is old or new.
- Updates to `src/` or docs build target source return `stale`; after docs are updated, the result returns `fresh`.
- Product code does not embed project-specific spec IDs or artifact filenames.

## Out of Scope

- Hiding the problem by simply raising the file limit
- Changing the generated contents of the docs build itself
- Changing the storage policy for generated flow artifacts

<details>
<summary>ja</summary>

freshness checkが生成spec証跡でscan上限に達しindeterminateになる

## 概要

`src/check/commands/freshness.js` の freshness check は現在 repository root 全体を source として走査しており、generated spec evidence や runtime artifact まで `maxFiles=10000` の共有 budget を消費している。これにより、docs 生成に実際に関係する source / docs 自体は小規模でも、`senti check freshness` が `indeterminate` になり、自動判定ではなく mtime の手動比較へ退避することがある。

## 発生事象

Issue #459 の flow 開始時に `senti check freshness` が `indeterminate` を返した。

証跡:

- `specs/336-reset-draft-review-artifacts/issue-log.json`
- step: `draft`
- reason: `Automated docs freshness check could not complete because an existing spec artifact exceeded the 10000-file scan limit`
- trigger: `senti check freshness returned indeterminate at specs/322-flow-target-transition-guards/spec-gate-source.json`

## 問題

freshness check が docs 生成対象ではない generated evidence まで source 側の走査対象に含めているため、長期間運用した repository では `src/` や docs build 対象の規模と無関係に file 上限へ到達しうる。結果として source/docs の鮮度を自動で `fresh` / `stale` 判定できず、flow の信頼性と自動化率が下がる。

## 原因

`src/check/commands/freshness.js` は `sourceRoot()` の既定値である repository root を `FileTreeWalker` に渡しているが、freshness 専用の directory filter / policy を適用していない。このため、`specs/`、`.senti/`、生成 evidence、runtime artifact などが freshness 判定用の file budget を消費している。

## 期待する挙動

docs build に影響する source surface と generated / runtime surface を freshness 判定時に分離したい。少なくとも generated evidence の増減や更新だけで verdict が変化せず、relevant source または docs の変更に対してのみ `fresh` / `stale` が変化するべき。

## 改善方針

- freshness 専用の走査 policy を導入し、docs build に影響する source surface と generated/runtime surface を分離する。
- 少なくとも `.git/`、`.senti/` の runtime/output、`specs/**/review-history`、`review-evidence`、`tests/.raw` などの generated evidence は source freshness の file budget から除外する。
- 除外対象は project 固有 path のベタ書きではなく、docs build / source resolver と共有できる汎用的な境界として定義する。
- relevant source または docs の走査自体が不完全な場合は、従来どおり fail closed で `indeterminate` を返す。
- 結果には、走査対象、適用した除外 policy、上限到達 path を構造化して残す。

## 対象

- `src/check/commands/freshness.js`
- `src/lib/file-tree-walker.js`（必要最小限の汎用 filter / budget contract）
- `tests/unit/check/scan-freshness.test.js`

## 完了条件

- generated spec evidence が 10,000 files を超えていても、relevant source / docs が上限内であれば `fresh` または `stale` を確定できる。
- relevant source 自体が上限超過、unreadable、または depth limit 到達の場合は `indeterminate` のまま fail closed する。
- generated evidence の新旧だけでは freshness verdict が変化しない。
- `src/` または docs build 対象 source の更新では `stale`、docs 更新後は `fresh` を返す。
- product code に project 固有の spec id や artifact filename を埋め込まない。

## スコープ外

- file 上限の単純な引き上げで問題を隠す対応
- docs build 自体の生成内容変更
- generated flow artifact の保存方針変更

</details>