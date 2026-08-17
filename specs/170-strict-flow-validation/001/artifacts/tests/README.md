# Tests: 170-strict-flow-validation

## What was tested and why

flow コマンドの引数バリデーション厳密化（spec R1-R12）の検証テスト。
各コマンドの正常系・異常系・境界値を網羅し、不正入力が適切にリジェクトされることを確認する。

## Test location

- `specs/170-strict-flow-validation/tests/validation.test.js` — spec 検証テスト

## How to run

```bash
node --test specs/170-strict-flow-validation/tests/validation.test.js
```

## Expected results

- 実装前: 大部分のテストが FAIL（バリデーション未実装のため）
- 実装後: 全テスト PASS
