## Background

When the definition was introduced in #b15d (spec 236), finalize was treated as a single leaf.
Since the internal STEP_MAP ({1: commit, 2: merge, 3: sync, 4: cleanup}) in run-finalize.js was already working robustly, the decomposition was deferred.

## Details

Decompose finalize into branches in the definition, making commit / push / merge / cleanup / docs-sync independent leaves.
Split run-finalize.js and create individual commands corresponding to each leaf.

Also reconsider the handling of show-report (already excluded from the definition in spec 236).

## Prerequisites

- #b15d (spec 236) must be completed

## Reference

In FLOW_STEPS, `push`, `pr-create`, `branch-cleanup`, `pr-merge`, `docs-update`, `docs-review`, and `docs-commit` are defined after finalize, but no command or hook updates their status (they remain pending indefinitely). Clean up these dead entries during decomposition.

<details>
<summary>ja</summary>

[ENHANCE] finalize を branch に分解し sub-step を独立 leaf 化する

## 背景

#b15d (spec 236) で definition 導入時、finalize は単一 leaf として扱う。
run-finalize.js の内部 STEP_MAP ({1: commit, 2: merge, 3: sync, 4: cleanup}) が既に堅牢に動作しているため、分解は後回しにした。

## 内容

finalize を definition の branch に分解し、commit / push / merge / cleanup / docs-sync を独立 leaf にする。
run-finalize.js を分割し、各 leaf に対応する個別コマンドを作る。

合わせて show-report の扱いも再検討する（spec 236 で definition から除外済み）。

## 前提

- #b15d (spec 236) が完了していること

## 参考

FLOW_STEPS の finalize 以降に `push`, `pr-create`, `branch-cleanup`, `pr-merge`, `docs-update`, `docs-review`, `docs-commit` が定義されているが、どのコマンドも hook もこれらの status を更新しない（永久に pending のまま）。分解時にこれらの死んだエントリも整理する。

</details>