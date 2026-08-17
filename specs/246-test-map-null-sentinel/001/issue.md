## Background

Static retro evaluation mechanically calculates requirement achievement rate from the test mapping table in test-map.json.
Currently, requirements that are inherently test-not-required — such as documentation updates — are recorded in test-map.json with an empty array `[]`. However, an empty array cannot distinguish between "tests not yet written" and "tests not needed", causing them to be treated as `unverified` in retro and lowering the achievement rate.

## Proposal

Allow `null` as a sentinel value in test-map.json.

```json
{
  "R1": ["test1.test.js > R1: ..."],
  "R4": null
}
```

`null` explicitly declares "this requirement does not need verification through tests".

## Changes

1. `src/flow/prompts/plan/test.md` — Add `null` to the test-map.json schema description so the AI can write `null` for test-not-required requirements.
2. `src/flow/lib/req-map.js` — Skip `null` values during iteration after `loadTestMap` (when extracting test files).
3. `src/flow/lib/run-retro.js` `tryStaticEvaluation` — Exclude entries where `testMap[r.id] === null` from the denominator as `status: "n/a"`.

<details>
<summary>ja</summary>

[ENHANCE] test-map.json で null を許容し、テスト不要の要件を retro 分母から除外する

## 背景

static retro 評価は test-map.json のテスト対応表から要件の達成率を機械的に算出する。
現状、ドキュメント更新など本質的にテストが不要な要件も test-map.json に空配列 `[]` で記録されるが、
空配列は「まだテストを書いていない」と「テストが不要」の区別がつかず、retro で `unverified` 扱いになり達成率が下がる。

## 提案

test-map.json の値として `null` を sentinel 値として許容する。

```json
{
  "R1": ["test1.test.js > R1: ..."],
  "R4": null
}
```

`null` は「この要件はテストによる検証が不要」を明示的に宣言する。

## 変更対象

1. `src/flow/prompts/plan/test.md` — test-map.json スキーマ説明に `null` を追加。AI がテスト不要の要件に `null` を書けるようにする
2. `src/flow/lib/req-map.js` — `loadTestMap` 後のイテレーションで `null` 値をスキップ（テストファイル抽出時）
3. `src/flow/lib/run-retro.js` `tryStaticEvaluation` — `testMap[r.id] === null` のエントリを `status: "n/a"` として分母から除外

</details>