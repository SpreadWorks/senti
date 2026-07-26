## Overview

Make `prepare transaction` and `lock recovery` failure-atomic so that `branch / local prepare` can be safely retried even if it fails midway. The implementation should proceed based on lock ownership checks using `process identity` and a durable retry journal.

This change explicitly defines the alpha-period lock ownership contract as **Linux-only**. It also treats broken `preparing state` as a fail-closed typed error instead of silently handling it as `missing`. Stale lock recovery is allowed **only when the owner can be proven dead** using the stored boot identity and process-start fingerprint.

## Integrated From

- `4078`: platform contract for process identity and package mapping
- `cdb4`: fail-close handling for corrupt preparing-flow state and stale lock recovery
- `5ded`: failure atomicity and exact retry for branch / local prepare transaction

## Goals

- Align lock ownership and flow-state handling with the platform contract
- Fail safely instead of treating corrupt / truncated state as missing
- Avoid damaging foreign state on prepare failure, and allow only exact retry of the same request
- Do not persist intermediate states that cannot be retried

## Required Contracts

- `package.json` and runtime lock-requiring flow paths declare Linux-only with the same meaning
- Unsupported / unknown process identity results in a typed non-zero failure before mutation, without stealing the lock
- Truncated / corrupt `preparing-flow state` is not converted to `missing`; it fails closed as a typed error
- Stale locks are recovered only when the stored boot identity and process-start fingerprint prove the owner is dead
- Locks owned by a live owner or unknown owner are preserved
- Prepare either fully succeeds or stops after leaving an observable retryable journal
- Existing branches, authority, and foreign flows are not destroyed on failure
- Retry is allowed only as an exact retry of the same request; foreign retries are rejected
- Intermediate state is not mistaken for an active flow

## Main Targets

- `src/lib/process-identity.js`
- `src/lib/process-owned-lock.js`
- `src/lib/preparing-flow-store.js`
- `src/flow/lib/run-prepare-spec.js`
- Focused tests for lock / state writer / prepare transaction
- `package.json`

## Acceptance Criteria

1. On `darwin` / `win32`, lock creation and flow-state mutation fail with a typed non-zero failure before occurring.
2. On Linux, lock ownership can be evaluated while preserving the existing live / stale / PID reuse checks.
3. Corrupt or truncated flow state is not treated as `missing`; it fails closed as a typed failure.
4. Stale locks are safely recovered only when the dead owner can be proven, while locks owned by live / unknown owners are preserved.
5. With fault injection at each prepare persistence boundary, the same request can complete via exact retry.
6. Foreign state, existing branches, and authority are not changed on failure.
7. No unretryable intermediate state is left behind where only part of the branch / authority / flow state remains and is mistakenly treated as active.

<details>
<summary>ja</summary>

prepare transactionとlock recoveryをfailure-atomicにする

## 概要

`prepare transaction` と `lock recovery` を failure-atomic にし、`branch / local prepare` が途中失敗しても安全に再試行できるようにする。実装は `process identity` に基づく lock 所有権判定と、durable な retry journal を前提に進める。

この変更では、alpha 期間の lock ownership 契約を **Linux-only** と明示する。また、壊れた `preparing state` を `missing` 扱いで握りつぶさず、fail-close の typed error として扱う。stale lock の回収は、保存済みの boot identity と process-start fingerprint により **owner が dead と証明できる場合に限る**。

## 統合元

- `4078`: process identity と package の対応 platform 契約
- `cdb4`: corrupt preparing-flow state の fail-close と stale lock 回収
- `5ded`: branch / local prepare transaction の failure atomicity と exact retry

## 目的

- lock 所有権と flow-state の扱いを platform 契約と一致させる
- corrupt / truncated state を欠損扱いせず、安全側に倒す
- prepare 失敗時でも foreign state を壊さず、同一 request の exact retry だけを許可する
- retry 不能な中間状態を永続化しない

## 必要な契約

- `package.json` と runtime の lock-requiring flow path は、同じ意味で Linux-only を宣言する
- unsupported / unknown process identity は mutation 前に typed non-zero failure とし、lock を奪取しない
- truncated / corrupt `preparing-flow state` は `missing` に変換せず、typed error として fail closed にする
- stale lock は、保存済み boot identity と process-start fingerprint により owner の dead が証明できる場合のみ回収する
- live owner または unknown owner の lock は保持する
- prepare は「全成功」または「観測可能な retryable journal を残して停止」のどちらかにする
- failure 時に既存の branch、authority、foreign flow を破壊しない
- retry は同一 request の exact retry のみ許可し、foreign retry は拒否する
- 中間 state を active flow と誤認しない

## 主な対象

- `src/lib/process-identity.js`
- `src/lib/process-owned-lock.js`
- `src/lib/preparing-flow-store.js`
- `src/flow/lib/run-prepare-spec.js`
- lock / state writer / prepare transaction の focused tests
- `package.json`

## Acceptance Criteria

1. `darwin` / `win32` では、lock 作成および flow-state mutation の前に typed non-zero failure となる。
2. Linux では、既存の live / stale / PID reuse 判定を維持したまま lock ownership を評価できる。
3. corrupt または truncated な flow state は `missing` 扱いにならず、typed failure として fail-close する。
4. stale lock は dead owner を証明できる場合にのみ安全に回収され、live / unknown owner の lock は保持される。
5. prepare の各永続化境界で fault injection しても、同一 request は exact retry で完了できる。
6. failure 時にも foreign state、既存 branch、authority は変更されない。
7. branch / authority / flow state の一部だけが残り、それを active と誤認する retry 不能な中間状態を残さない。

</details>