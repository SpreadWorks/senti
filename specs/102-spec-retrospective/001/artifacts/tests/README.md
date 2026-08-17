# Tests: 102-spec-retrospective

## What was tested and why

- **registry entry**: `retro` が `FLOW_COMMANDS.run.keys` に正しく登録されていること
- **help output**: `--help` でヘルプが表示され、`--force` と `--dry-run` オプションが記載されていること
- **no flow.json**: flow.json が存在しない環境で `NO_FLOW` エラー envelope が返ること
- **existing retro.json**: `retro.json` が既に存在する場合に `--force` なしで `RETRO_EXISTS` エラーが返ること

## Where tests are located

`specs/102-spec-retrospective/tests/retro.test.js`

## How to run

```bash
node --test specs/102-spec-retrospective/tests/retro.test.js
```

## Expected results

- すべてのテストが PASS すること（実装前は FAIL が期待される）
- AI エージェント呼び出しを伴うテストは含めていない（ユニットテストの範囲外）
