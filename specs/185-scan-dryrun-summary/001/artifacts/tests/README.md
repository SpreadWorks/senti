# Tests for spec 185: scan --dry-run summary

## Tests added

### `tests/e2e/docs/commands/scan-dryrun-summary.test.js` (formal)

CLI コマンド契約テストとして formal `tests/e2e/` 配下に配置。

| Case | AC | What it verifies |
|---|---|---|
| AC1+AC3 | R1, R3 | `--dry-run` が summary JSON のみ出力（`analyzedAt` 含まず、全値が非負整数）、analysis.json を書き込まない |
| AC2 | R2 | scan DataSource が登録済みかつマッチ 0 件のカテゴリも値 `0` でキーとして含まれる |
| AC4 | R4 | `--stdout` が従来どおり全 analysis JSON を出力（`analyzedAt` + `entries` + `summary`） |
| AC5 | R5 | `--stdout --dry-run` 併用時に `--stdout` 優先 |
| AC9 | R8 | 正常実行時の終了コードが 0 |

## Tests updated

### `tests/e2e/docs/commands/scan.test.js`

ケース「`--dry-run outputs to stdout without writing file`」が旧 `--dry-run` 出力契約（`analyzedAt` 含む全 JSON）を検証していたため、新仕様（summary 形式）に合わせて更新した。

`issue-log.json` に経緯を記録済み。

## How to run

```bash
npm run test:e2e -- --filter scan-dryrun-summary
# or full e2e
npm run test:e2e
```

## Expected results

すべてのケースが PASS すること。
