# Spec 232 Tests

## What was tested

- R-1: `DEFAULT_GATE_RETRY_MAX` が 5 に変更されていること
- R-2: `draft-scope-boundary` guardrail body に evidence/why/considered の除外ルールが含まれていること
- R-3: `npm test` が全件パスすること（既存テストの更新含む）

## Location

- `specs/232-draft-retry-guardrail/tests/verify.test.js` — spec 検証テスト

## How to run

```bash
node --test specs/232-draft-retry-guardrail/tests/verify.test.js
```

## Expected results

実装前: R-1 と R-2 のテストが FAIL する（定数が 3 のまま、body に evidence 記述がない）。
実装後: 全テスト PASS。
