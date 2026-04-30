Change the summary row to an AVG row aligned with table columns.

Changes:
- Add specs column (number of specs for that day)
- Add cache hit column (read/create/hit within the cache group)
- Change cost precision to toFixed(1)
- Column headers appear only once at the top, not repeated per phase
- Change phase separator to "-- phase ---" format
- AVG row uses the same column layout as data rows; dividers unified to `---`
- Do not change denominator logic (mixed)

Display example:

```
             |       |             | token          | cache                |            |          |
             | specs | difficulty  | in      out    | read   create  hit   | call count | cost     | duration

-- draft ---------------------------------------------------------------------------------------------------
2026-04-29   | 2     | 1.23        | 389572  28355  | 292992 0       43%   | 27         | $0.4     | 12m 44s
2026-04-22   | 1     | —           | 42184   645    | 6912   0       14%   | 2          | — +      | 23.9s

AVG.         | 1.5   | 1.23        | 215878  14500  | 149952 0       41%   | 14.5       | $0.4     | 6m 34s

-- spec ----------------------------------------------------------------------------------------------------
...
```

<details>
<summary>ja</summary>

[ENHANCE] metrics token: AVG行表示への改修

サマリー行をテーブルカラムに揃えたAVG行に変更。

変更点:
- specs列追加（その日のスペック数）
- cache hit列追加（cache グループ内に read/create/hit）
- cost精度を toFixed(1) に変更
- カラムヘッダーはフェーズごとに繰り返さず先頭に一度だけ
- フェーズ区切りを "-- phase ---" 形式に変更
- AVG行はデータ行と同じカラム配置、罫線は --- で統一
- 分母ロジック（混在）は変更しない

表示イメージ:

```
             |       |             | token          | cache                |            |          |
             | specs | difficulty  | in      out    | read   create  hit   | call count | cost     | duration

-- draft ---------------------------------------------------------------------------------------------------
2026-04-29   | 2     | 1.23        | 389572  28355  | 292992 0       43%   | 27         | $0.4     | 12m 44s
2026-04-22   | 1     | —           | 42184   645    | 6912   0       14%   | 2          | — +      | 23.9s

AVG.         | 1.5   | 1.23        | 215878  14500  | 149952 0       41%   | 14.5       | $0.4     | 6m 34s

-- spec ----------------------------------------------------------------------------------------------------
...
```

</details>