# Spec 115 Tests

## What was tested

`docs.exclude` パターンによる analysis エントリのフィルタリング。
`filterByDocsExclude` と `filterAnalysisByDocsExclude` 関数の動作を検証。

## Test location

- `tests/unit/docs/lib/analysis-filter.test.js` — 正規テスト（`npm test` で実行）

`filterByDocsExclude` は共有ユーティリティとして公開されるため、正規テストに配置。

## How to run

```bash
node --test tests/unit/docs/lib/analysis-filter.test.js
```

## Expected results

修正後: 全テストが PASS。

- `filterByDocsExclude`: エントリレベルの除外フィルタ
- `filterAnalysisByDocsExclude`: analysis オブジェクト全体のカテゴリ横断フィルタ
- 未設定時のスキップ、元オブジェクト非破壊を検証
