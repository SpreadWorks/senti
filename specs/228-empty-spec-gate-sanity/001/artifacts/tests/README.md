# Tests for spec 228: empty-spec-gate-sanity

## What was tested

`checkSpecJson()` の静的 sanity check が、空の goal / requirements / acceptance_criteria を正しく検出して issues に追加することを検証する。

## Test location

- `tests/unit/flow/gate-spec-sanity.test.js` — formal test（`npm test` で実行される）
  - `checkSpecJson` は公開 API であり、将来の変更で壊れた場合は常にバグを示すため formal test に配置

## How to run

```bash
node --test tests/unit/flow/gate-spec-sanity.test.js
```

## Expected results

- 空 goal (""、whitespace-only): issues に goal 関連のエラーが含まれる
- 空 requirements ([]): issues に requirements 関連のエラーが含まれる
- 空 acceptance_criteria ([]): issues に acceptance_criteria 関連のエラーが含まれる
- 全フィールド非空: sanity check 由来の issues が含まれない
