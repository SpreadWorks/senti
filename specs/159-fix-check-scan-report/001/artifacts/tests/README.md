# Spec Verification Tests: 159-fix-check-scan-report

## What is tested

`sdd-forge check scan` 出力改善の仕様要件を検証するテスト。

- `groupByExtension` ヘルパーの件数降順・アルファベット順ソート
- `computeCoverage` が `includeCoverage` を返さないこと
- `formatText` の出力先頭に DataSource カバレッジ率が含まれること
- `formatText` の出力に `Include Coverage` が含まれないこと
- 拡張子サマリーがファイルリストより前に出力されること
- 解析漏れ 0 件のとき拡張子サマリーセクションが出力されないこと

## Location

`specs/159-fix-check-scan-report/tests/check-scan-report.test.js`

これは spec 検証テストのため `npm test` には含まれない。

## How to run

worktree ルートから:

```bash
node specs/159-fix-check-scan-report/tests/check-scan-report.test.js
```

## Expected results

実装後、全テスト PASS。
`groupByExtension`, `computeCoverage`, `formatText` が `src/check/commands/scan.js` からエクスポートされている必要がある。
