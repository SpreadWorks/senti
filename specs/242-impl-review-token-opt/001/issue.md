## Background

The impl review currently works well in terms of quality. The only issue is token volume. When a massive diff is generated — such as hundreds of files changed in a bulk replacement — the input size can become unmanageable.

## Current Inputs

- Target: diff
- Criteria: spec / task_spec
- Context: testlog

## Problem

Token explosion on large-scale diffs (21+ files, top 7% of changes). Empirical data from #0003 shows that the diff accounts for 91.6% of a large prompt.

## Approaches Under Consideration

### File × Requirement Loop

Instead of a single bulk diff, loop over sets of "file + changes + corresponding requirements". Requires a file-to-requirement mapping as a prerequisite.

- **Advantage**: Independent of diff size; token count per iteration stays constant.
- **Concern**: Cross-file issues (interface mismatches, duplicate introductions, etc.) are invisible when each file is reviewed in isolation.
- **Mitigation**: Aggregate summaries from individual loop results, then run one final cross-check pass.

### Empirical Backing (see #eedb)

- Median is 5 files → loop count is practical.
- 80% of cases involve 9 files or fewer → low cost for the vast majority.
- Large changes with 21+ files benefit the most from the loop approach.

### Combining with Compaction

Not mutually exclusive: combining the loop with lightweight compaction (e.g., summarizing identical-pattern changes) is likely optimal.

## Note

The quality of impl review itself is not a concern. The sole objective is token optimization. Proceed under the constraint that quality must not regress.

<details>
<summary>ja</summary>

[ENHANCE] impl review のトークン最適化（ループ型 diff 分割レビュー）

## 背景

impl review は現状でも品質面では上手く動作している。問題はトークン量のみ。一括置換のような数百ファイルの修正時に diff が巨大化し破綻するケースがある。

## 現状の入力

- 対象物: diff
- 基準: spec / task_spec
- 文脈: testlog

## 課題

大規模 diff（21+ファイル、全体の7%）でトークン爆発。#0003 実測データで diff が大規模プロンプトの 91.6% を占める。

## 検討中のアプローチ

### ファイル×要件ループ型

一括 diff の代わりに「ファイル + 修正内容 + 対応する要件」のセットでループ。要件とファイルのマッピングが前提。

- 利点: diff サイズに依存しない。1回あたりのトークン量が一定
- 懸念: ファイル横断の問題（インターフェース不整合、重複導入等）が個別ループでは見えない
- 対策: 個別ループ結果のサマリを集約し、最後に cross-check パスを1回走らせる

### 実績データによる裏付け（#eedb 参照）

- 中央値5ファイル → ループ回数は現実的
- 80% が9ファイル以下 → 大多数のケースで低コスト
- 21+ファイルの大規模変更こそループの恩恵が大きい

### compaction との組み合わせ

排他ではなく、ループ + 軽量 compaction（同一パターン変更の要約等）の組み合わせが最適。

## 注意

impl review の品質自体は現状で問題なし。トークン最適化のみが目的。品質を下げない前提で進める。

</details>