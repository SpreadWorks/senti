## Background

In cases like gate-impl, even after fixing the reported issues, the flow stalls because the retry quota is exhausted and re-evaluation cannot proceed. This is less about the quality judgment of review/gate itself, and more about the recovery UX for returning a fixed state back to re-evaluation.

## Problem

- Even when the last reported issue has been fixed, re-evaluation cannot proceed when retries are exhausted
- Simply increasing `maxAttempts` tends to just prolong unnecessary review/gate loops
- Retry reset/override operations are hard to preserve as an audit trail explaining why they were permitted
- There is no distinction in the flow between "repeating the same failure" and "wanting re-evaluation because fixes have been applied"

## Proposed Improvement

- Provide a recovery path that allows explicit reopen/reset/override even after retry exhaustion, when the implementation diff or evidence has changed
- Record the reason, target phase, changed evidence, and permitted re-evaluation count in recovery operations
- Avoid automatic unlimited re-evaluation; in principle, allow only one re-evaluation
- Display "retry exhausted but recovery possible due to fix diff" in next-action/status

## Completion Criteria

- The states of "retry exhausted" and "post-fix re-evaluation" are distinguished in the flow
- Recovery operations are recorded in issue-log/artifacts
- Re-evaluation of a fixed state can proceed without increasing `maxAttempts`
- If the same failure continues, the flow can still stop as before

## Related

- Do not append to the already-Done dc7f; treat this as an unimplemented additional recovery task on this board
- Related to review convergence in cdb2, but this deals with the recovery path after retry exhaustion, not the review content itself

<details>
<summary>ja</summary>

[ENHANCE] retry 枠切れ後の再評価 recovery を分離する

## 背景

gate-impl などで指摘を修正した後でも、retry 枠が尽きているため再評価できず、flow が止まるケースがある。これは review / gate の品質判定そのものというより、修正済み状態を再評価へ戻す recovery UX の問題。

## 問題

- 最後の指摘が修正済みでも、retry exhausted の状態だと再評価に進めない
- maxAttempts を単純に増やすと、無駄な review / gate ループを延命するだけになりやすい
- retry reset / override の操作が、なぜ許可されたのか audit trail として残りにくい
- 「同じ失敗を繰り返している」のか「修正済みなので再評価したい」のかが flow 上で区別されない

## 改善案

- retry exhausted 後でも、実装差分または evidence が変わった場合は明示的に reopen / reset / override できる recovery path を用意する
- recovery 操作では reason、対象 phase、変更された evidence、許可された再評価回数を記録する
- 自動で無限再評価せず、原則 1 回だけ再評価できるようにする
- next-action / status に「retry exhausted だが、修正差分があるため recovery 可能」と表示する

## 完了条件

- retry exhausted と修正後再評価の状態が flow 上で区別される
- recovery 操作が issue-log / artifact に記録される
- maxAttempts を増やさずに、修正済み状態の再評価へ進められる
- 同じ失敗が続いている場合は、従来通り停止できる

## 関連

- Done 済みの dc7f には追記せず、このボードで未実装の追加 recovery 課題として扱う
- cdb2 の review convergence とは関連するが、こちらは review 内容ではなく retry exhausted 後の復旧導線を扱う

</details>