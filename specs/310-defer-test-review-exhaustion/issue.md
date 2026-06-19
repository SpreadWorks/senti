## Summary
When `test-review` reaches retry exhaustion for a semantic FAIL, unresolved findings are not being carried over as deferred findings into `flow-findings.json` through a CLI state transition. As a result, `test-review` remains `in_progress`, and the final disposition cannot be delegated to the downstream `acceptance-review`.

The state observed in Issue #286, where `reviewStop: max_attempts_exceeded` occurs and `flow-findings.json` is not generated, is consistent with an implementation timing gap in the current code.

## Background
In the Spec-Driven Development flow, `plan` / `test-review` are expected to record unresolved findings into `flow-findings.json` when semantic FAIL retry exhaustion occurs, treat `test-review` as deferred completion, and let the downstream `acceptance-review` own the final disposition.

## Current Behavior
The confirmed implementation is as follows.

- `checkReviewRetryBelowMax` in `src/flow/lib/run-review.js` can call `tryDeferReviewRetryExhaustion` if it runs before starting the next review after the limit has been reached.
- On the other hand, `updateReviewRetryCounter`, which is the post-hook for the final semantic FAIL, only increments `reviewRetry` and, if needed, leaves a recovery baseline. It does not call `tryDeferReviewRetryExhaustion` within the same execution.
- `get-status` and `get-next-action` only return display information or recovery guidance. They do not create `flow-findings.json` or transition the step to completion.
- `tests/unit/flow/retry-exhaustion-defer.test.js` verifies deferral through the pre-check path, but does not directly verify the acceptance condition that `flow-findings.json` is generated from the final FAIL post-hook.
- The `acceptance-review` side already has an implementation that reads `flow-findings.json`, reflects it into `deferredFindings`, and treats `still_open` as `amend_required` and `blocking` as `blocked`.

## Problem
There is no guarantee that findings are carried over to deferred at the moment a semantic FAIL reaches `maxAttempts`. Therefore, unless an additional review run or manual intervention occurs, the following can happen.

- `flow-findings.json` is not created
- `test-review` remains `in_progress`
- `get status` / `get next-action` cannot advance the mainline
- `acceptance-review` cannot receive deferred findings

## Expected Fix
The primary guarantee should live on the CLI post-hook / state transition side.

1. When a semantic FAIL in `test-review` reaches `maxAttempts`, the post-hook for `flow run review --phase test` automatically creates or updates `flow-findings.json`.
2. Blocking findings from the latest `test-review.json` are recorded as deferred findings.
3. Each entry includes at least `findingId`, `sourceStep: test-review`, `sourceArtifact: test-review.json`, `sourceFindingId`, `retryExhausted: true`, `attempts`, `round`, `completionKind: deferred`, and `finalDisposition: still_open`.
4. Advance the `test-review` step as deferred completion, equivalent to `done`, so the next mainline step can move to `implement`.
5. `acceptance-review` reads `flow-findings.json` and reflects it into `acceptance-review.json.deferredFindings[]`.
6. If deferred findings are unresolved, `acceptance-review` treats them as `user_decision_required` or as an explicit blocker.
7. `TOOLING_FAILURE` and structured coverage failures are excluded from semantic deferral and should continue to require tooling recovery or a structured override as before.
8. `retryRecovery.recoveryPossible: false` / `unchanged-evidence` must not block carryover for semantic exhaustion.
9. Existing manual retry reset behavior is preserved.

## Implementation Approach
- In `updateReviewRetryCounter` or the review post lifecycle, attempt semantic deferral immediately after a result that is neither `PASS` nor `ADVISORY` and where `attemptsBefore + 1 >= maxAttempts`.
- Reuse the existing `tryDeferReviewRetryExhaustion` / `deferExhaustedSemanticFindings`.
- Ensure the incremented `attempts` value is passed correctly at post-hook time, and pay attention to duplicate records and the ordering of metrics appends.
- Do not rely on the `acceptance-review` default for the initial `finalDisposition`; explicitly write `still_open` into each `flow-findings.json` entry.
- `get-next-action` may improve guidance after deferral if needed, but the responsibility for guaranteeing state should remain on the `run review` post-hook side.

## Acceptance Criteria
- For a `test-review` whose semantic FAIL reaches `maxAttempts`, `flow-findings.json` is generated without any additional manual agent work.
- `test-review` does not remain `in_progress`.
- `senti flow get status` shows a state that can proceed to the next step.
- `senti flow get next-action` returns `implement` or a later step.
- The downstream `senti flow run acceptance-review` recognizes the deferred findings.
- `TOOLING_FAILURE` is not treated as deferred.
- Carryover for semantic exhaustion is not blocked even in an `unchanged-evidence` state where retry reset is impossible.

## Related Files
- `src/flow/lib/run-review.js`
- `src/flow/lib/flow-findings.js`
- `src/flow/lib/get-next-action.js`
- `src/flow/lib/get-status.js`
- `src/flow/lib/acceptance-review-artifacts.js`
- `tests/unit/flow/retry-exhaustion-defer.test.js`
- `tests/unit/flow/run-review-advisory.test.js`

<details>
<summary>ja</summary>

test-review の retry exhaustion で findings を CLI 状態遷移として deferred 引き継ぎする

## 概要
`test-review` が semantic FAIL の retry exhaustion に到達した際、未解決 findings を CLI の状態遷移として `flow-findings.json` へ deferred 引き継ぎできていない。結果として `test-review` が `in_progress` のまま残り、後段の `acceptance-review` に最終 disposition を委譲できない。

Issue #286 で観測された `reviewStop: max_attempts_exceeded` かつ `flow-findings.json` 未生成の状態は、現行実装のタイミング不足と整合している。

## 背景
Spec-Driven Development flow の `plan` / `test-review` では、semantic FAIL の retry exhaustion 時に unresolved findings を `flow-findings.json` へ記録し、`test-review` を deferred 完了として扱い、後段の `acceptance-review` が最終 disposition を所有する想定になっている。

## 現状
確認した実装は以下の通り。

- `src/flow/lib/run-review.js` の `checkReviewRetryBelowMax` は、上限到達後に次回 review 実行を始める前であれば `tryDeferReviewRetryExhaustion` を呼べる。
- 一方、最終 semantic FAIL の post-hook である `updateReviewRetryCounter` は `reviewRetry` を increment し、必要に応じて recovery baseline を残すだけで、同一実行内では `tryDeferReviewRetryExhaustion` を呼ばない。
- `get-status` と `get-next-action` は表示や recovery guidance を返すのみで、`flow-findings.json` 作成や step の完了遷移は行わない。
- `tests/unit/flow/retry-exhaustion-defer.test.js` は pre-check 経由の deferral は検証しているが、最終 FAIL post-hook で `flow-findings.json` が生成される受け入れ条件は直接検証していない。
- `acceptance-review` 側には、`flow-findings.json` を読み `deferredFindings` に反映し、`still_open` を `amend_required`、`blocking` を `blocked` として扱う既存実装がある。

## 問題
semantic FAIL が `maxAttempts` に達した瞬間に deferred への引き継ぎが保証されていない。そのため、追加の review 実行や手動介入がない限り以下が起こり得る。

- `flow-findings.json` が作成されない
- `test-review` が `in_progress` のまま残る
- `get status` / `get next-action` が mainline を先へ進められない
- `acceptance-review` が deferred findings を受け取れない

## 期待する修正
primary guarantee は CLI の post-hook / state transition 側に置く。

1. `test-review` の semantic FAIL が `maxAttempts` に達した時点で、`flow run review --phase test` の post-hook が自動で `flow-findings.json` を作成または更新する。
2. 最新の `test-review.json` にある blocking findings を deferred findings として記録する。
3. 各 entry には少なくとも `findingId`, `sourceStep: test-review`, `sourceArtifact: test-review.json`, `sourceFindingId`, `retryExhausted: true`, `attempts`, `round`, `completionKind: deferred`, `finalDisposition: still_open` を含める。
4. `test-review` step を deferred 完了として `done` 相当に進め、次の mainline step を `implement` へ進められるようにする。
5. `acceptance-review` は `flow-findings.json` を読み、`acceptance-review.json.deferredFindings[]` に反映する。
6. deferred findings が unresolved の場合、`acceptance-review` は `user_decision_required` または明示的 blocker として扱う。
7. `TOOLING_FAILURE` や structured coverage failure は semantic deferral の対象外とし、既存通り tooling recovery または structured override を要求する。
8. `retryRecovery.recoveryPossible: false` / `unchanged-evidence` は semantic exhaustion の引き継ぎを阻害しない。
9. 既存の manual retry reset は維持する。

## 実装方針
- `updateReviewRetryCounter` もしくは review post lifecycle で、`PASS` / `ADVISORY` 以外かつ `attemptsBefore + 1 >= maxAttempts` となった直後に semantic deferral を試行する。
- 既存の `tryDeferReviewRetryExhaustion` / `deferExhaustedSemanticFindings` を再利用する。
- post-hook 時点で increment 後の `attempts` を正しく渡せるようにし、重複記録や metrics append の順序に注意する。
- `finalDisposition` の初期値は `acceptance-review` 側の default に依存させず、`flow-findings.json` entry に `still_open` を明示する。
- `get-next-action` は必要に応じて deferral 後の案内を改善してよいが、状態保証の責務は `run review` の post-hook 側に置く。

## 受け入れ条件
- semantic FAIL が `maxAttempts` に達した `test-review` で、追加の agent 手作業なしに `flow-findings.json` が生成される。
- `test-review` が `in_progress` のまま残らない。
- `senti flow get status` で次工程へ進める状態になる。
- `senti flow get next-action` が `implement` 以降を返す。
- 後段の `senti flow run acceptance-review` が deferred findings を認識する。
- `TOOLING_FAILURE` は deferred 扱いにならない。
- retry reset 不可能な `unchanged-evidence` 状態でも semantic exhaustion の引き継ぎは阻害されない。

## 関連ファイル
- `src/flow/lib/run-review.js`
- `src/flow/lib/flow-findings.js`
- `src/flow/lib/get-next-action.js`
- `src/flow/lib/get-status.js`
- `src/flow/lib/acceptance-review-artifacts.js`
- `tests/unit/flow/retry-exhaustion-defer.test.js`
- `tests/unit/flow/run-review-advisory.test.js`

</details>