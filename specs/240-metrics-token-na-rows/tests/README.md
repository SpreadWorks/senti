# Spec 240: metrics token N/A rows — Tests

## What was tested

- **R1/R3**: `resolveCurrentContext` が nested ステップ構造で正しい `sddPhase` を返すこと
- **R2/R4**: `normalizeMetrics` / `buildRowsFromMetrics` が counter-only エントリから空行を生成しないこと

## Location

`specs/240-metrics-token-na-rows/tests/metrics-na-rows.test.js`

## How to run

```bash
node --test specs/240-metrics-token-na-rows/tests/metrics-na-rows.test.js
```

## Expected results

All tests pass after implementation of T-1 and T-2.
