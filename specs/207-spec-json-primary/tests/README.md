# spec 207 tests

## What is tested

- **`tests/unit/spec/authorized-test-mods-field.test.js`** — spec.schema.json が `authorized_test_modifications` (optional array) を受け付けることを検証。R1 / R4 (run-gate が schema 経由でこのフィールドを取得する前提) を満たすための schema 契約。
- **`tests/unit/lib/load-spec-json.test.js`** — 新設する共通 load ヘルパー `loadSpecJson(path)` の契約テスト。R1 / R2 / R5 / R8 / R10 を満たすための I/O 集約点。

## Where

`tests/` 配下の formal tests に配置。「将来壊れたら常にバグ」に該当する契約（schema 形状 / 共通ヘルパーの API）だから。

## How to run

```bash
node tests/run.js --unit
# or targeted
node --test tests/unit/spec/authorized-test-mods-field.test.js
node --test tests/unit/lib/load-spec-json.test.js
```

## Expected before impl

全テスト FAIL:
- `authorized_test_modifications` field がまだ schema に存在しない
- `src/lib/spec-json.js` がまだ存在しない

## Expected after impl

全テスト PASS + 既存 `npm test` が回帰なく pass。
