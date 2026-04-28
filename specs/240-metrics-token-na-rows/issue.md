## Current Behavior

`sdd-forge metrics token` output shows a large number of N/A rows. 145 out of 188 rows have all-null token columns.

## Root Cause

1. **Missing agent entries in array-format metrics**: Since spec 208, `kind: "agent"` entries are recorded, but specs prior to 207 only have counter entries (srcRead, docsRead, etc.) with no token/cost data.
2. **Phase rows generated from counter-only entries**: `buildRows` generates a phase row for each entry in the array, but counter entries have no token data, resulting in all-null rows.
3. **agents=0 even in spec 237/238 (latest)**: Even in the latest specs after the flow-definition introduction, agent entries are not being recorded. The recording wiring may be broken.

## Investigation Items

- [ ] Why agent entries are not recorded in spec 237/238 (trace set-metric call path)
- [ ] Address empty rows generated from counter-only entries in `normalizeMetrics` (display filter or aggregation logic improvement)
- [ ] Handling of difficulty-only rows (50 rows): worth displaying, or should they go in a separate report?

## Interim Fixes Applied

- Added `normalizeMetrics()`: aggregates array-format entries into per-phase objects
- Added `phaseLabel()`: converts numeric phase to label
- Added `+` marker for rows with null/0 cost

## Related

- bad2: display improvement for unmeasured cost rows in metrics
- 5bb4: improved resolution of measurement infrastructure

<details>
<summary>ja</summary>

[BUG] metrics token の N/A 行大量発生（配列形式 metrics の agent エントリ欠損）

## 現状

`sdd-forge metrics token` の出力で N/A 行が大量に表示される。188行中 145行が token 系全 null。

## 原因

1. **配列形式 metrics の agent エントリ欠損**: spec 208 以降で `kind: "agent"` エントリが記録されるようになったが、spec 207 以前は counter エントリ（srcRead, docsRead 等）のみ。token/cost データが存在しない。
2. **counter-only の phase 行が生成される**: `buildRows` が配列の各エントリから phase 行を生成するが、counter エントリには token データがないため全 null 行になる。
3. **spec 237/238（最新）でも agents=0**: flow-definition 導入後の最新 spec でも agent エントリが記録されていない。記録の配線が外れている可能性あり。

## 調査項目

- [ ] spec 237/238 で agent エントリが記録されない原因（set-metric の呼び出し経路確認）
- [ ] `normalizeMetrics` で counter-only エントリから空行が生成される問題の対処（表示フィルタ or 集約ロジック改善）
- [ ] difficulty-only 行（50行）の扱い: 表示する価値があるか、別レポートにすべきか

## 暫定対応済み

- `normalizeMetrics()` 追加: 配列形式を phase 別オブジェクトに集約
- `phaseLabel()` 追加: 数字 phase をラベルに変換
- cost null/0 の行に `+` マーカー付与

## 関連

- bad2: metrics の cost 未計測行の表示改善
- 5bb4: 計測インフラの解像度向上

</details>