# Tests for spec 200: investigate-test-failures

## What was tested and why

本 spec は既存のテスト失敗 4 件 (issue #191) を修正する。個別の新規テストは作成せず、既存の失敗していたテストが pass する状態に戻すことで verification とする。

## Fixes applied

### `tests/acceptance/lib/pipeline.js` (Command クラス追随)

commands モジュールが Command クラス化された際に未追随だったヘルパーを、Command クラス経由で起動する形式に書き換え。

- `const { main: scanMain } = await import(...)` → `cmd = new DocsScanCommand(); cmd.run(container, { docsCtx, _rawArgs: [] })`
- 各 command が container.get() で config/agent/i18n を読む経路に対応するため、isolated な `Container` インスタンスを fixture tmp 向けに populate する `buildCtx()` に変更
- text step は soft failure 時に `process.exitCode = 1` を設定する仕様のため、runPipeline の try/finally で前値に復元

### `tests/e2e/dispatchers.test.js` (失効シナリオの置換)

- `rejects 'spec' with no args as unknown command` を削除
- 代替: `shows spec subcommand usage when 'spec' has no args` — exit code 非ゼロかつ `Usage: sdd-forge spec` + `render` が出力されることを検証
- 補足: `rejects 'spec' as unknown command (spec dispatcher removed)` のタイトルは現状と乖離していたため `rejects unknown spec subcommand` に修正

## Affected test files

- 修正: `tests/acceptance/lib/pipeline.js`
- 修正: `tests/e2e/dispatchers.test.js`
- 検証対象 (既存): `tests/e2e/acceptance/report.test.js`, `tests/e2e/dispatchers.test.js`

## How to run

```bash
node tests/run.js
```

## Expected results

全て pass:

```
# tests 1939
# pass 1939
# fail 0
```
