## Target
draft-gate

## Problem
Even though the QA entries had been resolved, the draft gate failed because the draft's `approval.approved` remained false.

## Cause
After the draft coverage review passed, the procedure for setting approval metadata before running the gate was not explicitly documented.

## Improvement Direction
Add a check for approval metadata setup to the required sequence before the draft gate. Explicitly update the approval status even when no QA fixes are needed.

## Reason for Adding to the Board
Unnecessary failures and reruns occur immediately before the draft gate, blocking progress in the flow.

<details>
<summary>ja</summary>

[BUG] draft-gate 前の approval 設定手順が不足

## 対象
draft-gate

## 問題
QA entries が解決済みでも、draft の `approval.approved` が false のままだったため draft gate が失敗した。

## 原因
draft coverage review が pass した後に、approval metadata を設定してから gate を実行する手順が明示されていなかった。

## 改善方向
draft gate 前の required sequence に approval metadata の設定確認を追加する。QA 修復が不要な場合でも承認状態を明示的に更新する。

## ボード化する理由
draft gate の直前で不要な失敗と再実行が発生し、flow の進行が止まるため。

</details>