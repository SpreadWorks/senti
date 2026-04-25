## Background

`run-auto-check.js` has two judgment bottlenecks:

1. **hard-gate zero-tolerance**: If any one of specBuildability / ambiguity / verifiability scores 0, it immediately fails. Minor bug fixes tend to score 0 on verifiability and get rejected even when numeric scores are otherwise sufficient.
2. **THRESHOLD=18 (75% of 24 points)**: The primary reason minor fixes struggle to pass. Lowering to 14–15 (approximately 60%) has been proposed.

Both are changes within the same judgment function, so changing only one would break the balance — they are being redesigned together.

## Requirements (draft)

- hard-gate: Consider staging the criterion, e.g. "fail if any 1 item is 0" → "fail if sum of 3 items ≤ 1"
- THRESHOLD: Consider lowering it, or replacing the threshold check itself with another mechanism (such as hard-gate staging)
- Determine thresholds after examining the distribution with real data

## Prerequisites

- Should be measured after the series of fixes from Issue #255 are in place: #1 G_KEYWORDS word-boundary fix, #4 Issue body ingestion, and the 6a1d promotion proposal.

## Related

- Consolidates #2 and #3 from Issue #255
- Absorbs old board item 1ef5 into this item
- Independent from 6a1d (promotion proposal), but affects 6a1d's re-evaluation accuracy

<details>
<summary>ja</summary>

[ENHANCE] auto-check: hard-gate 段階化 + THRESHOLD 再調整 (旧 #2/#3 統合)

## 背景

`run-auto-check.js` には2つの判定ボトルネックがある:

1. **hard-gate zero-tolerance**: specBuildability / ambiguity / verifiability のうち1項目でも 0 で即 fail。軽微バグ修正は verifiability で 0 を取りやすく、数値スコアが届いていても落とされる。
2. **THRESHOLD=18 (24点満点の75%)**: 軽微な修正が届きにくい主因。14-15 (約60%) への引き下げが案として挙がっている。

両者は同一の判定関数内の変更であり、片方だけ変えるとバランスが崩れるため統合して再設計する。

## 要件（たたき台）

- hard-gate: 「いずれか1項目0で fail」→「3項合計 ≤ 1 で fail」等の段階化を検討
- THRESHOLD: 引き下げるか、閾値判定自体を他の仕組み（hard-gate 段階化等）に置き換えるか検討
- 実データで分布を見てから閾値を決める

## 前提

- Issue #255 の一連の修正（#1 G_KEYWORDS word-boundary 化、#4 Issue body 取り込み、6a1d の昇格提案）が入った後に計測すべき。

## 関連

- Issue #255 の #2, #3 を統合
- 旧ボード 1ef5 を本アイテムに吸収
- 6a1d (昇格提案) とは独立だが、6a1d の再評価精度に影響する

</details>