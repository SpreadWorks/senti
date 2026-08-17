## Target
draft-gate

## Problem
Requirement-like QA entries did not have priorities, causing the draft gate's prioritize-requirements guardrail to fail.

## Cause
The procedure did not explicitly state that draft QA entries must be assigned priority markers: `must`, `should`, or `nice-to-have`.

## Improvement Direction
Make requirement priority mandatory when creating draft QA. Also add a missing-priority check before the gate.

## Reason for Adding to Board
Missing requirement priorities are detected every time at the draft gate, so it is worth preventing this earlier in the procedure.

<details>
<summary>ja</summary>

[BUG] draft-gate 前の requirement priority 設定手順が不足

## 対象
draft-gate

## 問題
requirement-like な QA entries に priority がなく、draft gate の prioritize-requirements guardrail が失敗した。

## 原因
draft QA entries に `must`、`should`、`nice-to-have` の priority marker を付ける手順が明示されていなかった。

## 改善方向
draft QA 作成時点で requirement priority を必須にする。gate 前の確認にも priority 欠落チェックを入れる。

## ボード化する理由
requirements の優先度欠落は draft gate で毎回検出されるため、手順側で先に防ぐ価値がある。

</details>