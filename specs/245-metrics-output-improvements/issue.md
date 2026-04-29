## Background

There are multiple improvements to be made to the metrics.json output:

1. **PHASE order does not follow flow execution order**: Relies on Object.entries insertion order, which does not match execution order
2. **No row limit**: The number of rows per phase is unlimited, making it hard to read with large datasets
3. **No summary rows**: Cannot grasp trends at the phase level
4. **Information loss in unmeasured cost rows**: Rows where token-related fields are null (from before agent JSON parsing support) display as N/A, causing other useful fields (callCount, durationMs, etc.) to be buried

## Changes

### 1. Fix PHASE order to flow execution order

Output in the following order (based on VALID_PHASES / FLOW_DEFINITION):

```
draft → spec → gate → test → impl → task-spec → task-impl → integration → lint → review
```

### 2. Limit display to 7 rows per phase

Limit rows per phase to the most recent 7. If more than 7, show an ellipsis notation (e.g., `... and N more`).

### 3. Add summary row at the end of each phase

Display the following aggregates at the end of each phase:

- **avg cost**: Average cost (rows where cost is null are excluded from calculation)
- **avg duration**: Average execution time
- **total calls**: Total agent call count
- **avg tokens (in/out)**: Average input/output token counts
- **cache hit rate**: Ratio of cacheRead / (input + cacheRead) (a measure of cache efficiency)

### 4. Improve display of rows with unmeasured cost

Rows where cost is null should not show N/A; instead, display values for other fields while marking the cost column with `—` + a marker.
This makes it immediately clear that "data exists but cost measurement is incomplete."

## Related

- 5bb4: Improve resolution of measurement infrastructure
- ad4d: Design and validation of agent usage measurement phases

<details>
<summary>ja</summary>

[ENHANCE] metrics 出力の改善（PHASE順序・件数制限・集計行・N/A表示）

## 背景

metrics.json の出力に複数の改善点がある:

1. **PHASE の並び順がフロー実行順でない**: Object.entries の挿入順に依存しており、実行順と一致しない
2. **件数制限がない**: フェーズあたりの行数が無制限で、大量データ時に見づらい
3. **集計行がない**: フェーズ単位の傾向を掴めない
4. **cost 未計測行の情報損失**: token 系フィールドが null の行（agent JSON パース対応以前）が N/A 表示になり、他の有用なフィールド（callCount, durationMs 等）が埋没する

## 対応

### 1. PHASE 順序をフロー実行順に固定

以下の順序で出力する（VALID_PHASES / FLOW_DEFINITION 準拠）:

```
draft → spec → gate → test → impl → task-spec → task-impl → integration → lint → review
```

### 2. フェーズあたり最大7件表示

各フェーズの行は直近7件に制限する。7件超の場合は省略表記（例: `... and N more`）を表示。

### 3. フェーズ末尾に集計行を追加

各フェーズの最後に以下の集計を表示:

- **avg cost**: 平均コスト（cost が null の行は除外して算出）
- **avg duration**: 平均実行時間
- **total calls**: 合計 agent 呼び出し数
- **avg tokens (in/out)**: 平均入力/出力トークン数
- **cache hit rate**: cacheRead / (input + cacheRead) の比率（キャッシュ効率の指標）

### 4. cost 未計測行の表示改善

cost が null の行は N/A ではなく、他フィールドの値を表示しつつ cost 列に `—` + マーカーを付ける。
これにより「データはあるが cost 計測が不完全」であることが一目でわかる。

## 関連

- 5bb4: 計測インフラの解像度向上
- ad4d: agent usage 計測フェーズの設計と検証

</details>