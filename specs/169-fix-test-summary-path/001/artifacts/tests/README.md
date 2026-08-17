# Tests: 169-fix-test-summary-path

## What was tested

`generateReport()` が `state.test.summary` から test summary を正しく読み取ることを検証する。

## Test location

`specs/169-fix-test-summary-path/tests/report-test-summary.test.js`

## How to run

```bash
node --test specs/169-fix-test-summary-path/tests/report-test-summary.test.js
```

## Expected results

- R1: `state.test.summary` に保存された値が report data に反映される
- R2: report テキストに unit/integration/acceptance/total が正しく表示される
- `state.test.summary` が未設定の場合は `tests: null`
- `state.metrics.test.summary` は test summary として参照されない
