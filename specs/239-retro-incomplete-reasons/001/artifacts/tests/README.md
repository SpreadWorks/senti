# Spec 239: retro-incomplete-reasons Tests

## What is tested
- R1: `generateReport` が retro data に requirements 配列を含めること
- R2: `formatText` が rate < 1.0 のとき partial/not_done 要件の desc と note を表示すること
- R3: 表示形式が既存スタイルと一貫すること

## Location
`specs/239-retro-incomplete-reasons/tests/report-retro-details.test.js`

## How to run
```bash
node --test specs/239-retro-incomplete-reasons/tests/report-retro-details.test.js
```

## Expected results
All tests pass after implementation.
