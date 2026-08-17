## Overview

Resolve an issue where, within the same dispatcher invocation, the `command body`, `post-hook`, `outbox` finalization, and `runtime-log` saving self-contend on the repository operation lock, causing an already durable command to be treated as `exit 1`.

The short-lived lock contention that previously appeared specific to `finalize-commit` should be treated not as an isolated case, but as a symptom of this general problem.

## Background

Currently, lock-required mutations that should proceed serially within the same process can self-contend depending on the lock holding boundary and reacquisition timing.

As a result, even when the command body and durable side effects have actually succeeded, a lock conflict can occur during subsequent `post-hook` / `outbox` / runtime metadata handling, causing only the final result to be treated as a failure.

## Scope Consolidated in This Issue

- `0e95`: repository lock self-contention in the post-hook path
- `6680`: short-lived lock contention after successful `finalize-commit` and safe retry

## Expected Contract

- Lock-required mutations executed serially within the same process either safely share the lock or reacquire it only after it has been fully released.
- `test-execute`, `finalize-commit`, and `finalize-sync` return `ok: true` / `exit 0` when everything succeeds from the command body through `post-hook` / `outbox` / runtime metadata.
- Contention with a foreign live owner continues to fail closed as before.
- Retries after a durable boundary failure resume from the same outbox entry and do not duplicate commits, docs syncs, or step transitions.
- Diagnostics retain `owner`, `requester`, `operation`, and `lock holding boundary` as typed metadata.

## Main Targets

- `src/lib/dispatcher.js`
- `src/lib/repository-maintenance-lock.js`
- `src/lib/process-owned-lock.js`
- `src/lib/flow-state-atomic-writer.js`
- `src/lib/flow-store.js`
- Lock lifecycle tests for dispatcher / finalization / test-execute

## Acceptance Criteria

1. The `post-hook` in the same invocation does not self-contend.
2. `finalize-commit` is not treated as failed due to a transient lock race after creating the commit.
3. Foreign live PID locks are not acquired, preserving the existing fail-closed contract.
4. Retries after fault injection do not duplicate side effects.
5. Lock contention diagnostics retain owner/requester/operation/boundary in a machine-readable form.

<details>
<summary>ja</summary>

post-hookのrepository lock自己競合をなくす

## 概要

同一 dispatcher invocation 内で、`command body`、`post-hook`、`outbox` 確定、`runtime-log` 保存が repository operation lock と自己競合し、すでに durable な command を `exit 1` として扱ってしまう問題を解消する。

これまで `finalize-commit` 固有に見えていた短命 lock 競合は、個別事象ではなくこの一般問題の症状として扱う。

## 背景

現状は、同一 process 内で直列に進むはずの lock-required mutation が、lock の保持境界と再取得タイミング次第で自己競合する。

その結果、実際には command 本体や durable な副作用が成功していても、後続の `post-hook` / `outbox` / runtime metadata 処理で lock 競合が発生し、最終結果だけが失敗扱いになる。

## この issue で統合する内容

- `0e95`: post-hook 経路の repository lock 自己競合
- `6680`: `finalize-commit` 成功後の短命 lock 競合と安全な retry

## 期待する契約

- 同一 process 内で直列に実行される lock-required mutation は、安全に lock を共有するか、完全解放後にのみ再取得する。
- `test-execute`、`finalize-commit`、`finalize-sync` では、command body から `post-hook` / `outbox` / runtime metadata まで成功した場合に `ok: true` / `exit 0` を返す。
- foreign live owner との競合は従来どおり fail-closed を維持する。
- durable boundary 失敗後の retry は同一 outbox entry から再開し、commit・docs sync・step transition を重複させない。
- diagnostics には `owner`、`requester`、`operation`、`lock holding boundary` を typed metadata として残す。

## 主な対象

- `src/lib/dispatcher.js`
- `src/lib/repository-maintenance-lock.js`
- `src/lib/process-owned-lock.js`
- `src/lib/flow-state-atomic-writer.js`
- `src/lib/flow-store.js`
- dispatcher / finalization / test-execute の lock lifecycle tests

## Acceptance Criteria

1. 同一 invocation の `post-hook` で自己競合しない。
2. `finalize-commit` が commit 作成後の一過性 lock race により失敗扱いにならない。
3. foreign live PID lock は取得せず、既存の fail-closed 契約を維持する。
4. fault injection 後の retry でも副作用を重複させない。
5. lock 競合診断に、owner/requester/operation/boundary が機械可読な形で残る。

</details>