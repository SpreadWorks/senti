# Spec 116 Tests

## What was tested

flow サブシステムの ctx パターン導入と registry ディスパッチの構造検証。

## Test location

- `tests/unit/flow/ctx-dispatch.test.js` — 正規テスト（`npm test` で実行）

構造的な制約（runIfDirect 不在、execute(ctx) シグネチャ、registry 構造等）は将来壊れたらバグなので正規テストに配置。

## How to run

```bash
node --test tests/unit/flow/ctx-dispatch.test.js
```

## Expected results

修正後: 全テストが PASS。

- registry に helpKey があり desc リテラルがない
- run/get/set の全 .js から runIfDirect が除去されている
- 全コマンドが execute 関数を export している
- review.js が runSync を使っていない
- get.js, set.js, run.js の2層目ディスパッチャーが削除されている
- prepare-spec.js が config null フォールバックしていない
- skill テンプレートに flow run prepare-spec が含まれない
