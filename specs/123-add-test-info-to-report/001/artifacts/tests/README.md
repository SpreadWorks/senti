# Tests for spec #123: Add test info to report

## What was tested
- `generateReport()` correctly extracts test summary from `metrics.test.summary`
- AC1: test counts with total calculation
- AC2: null when no test info
- AC3: Tests section in formatted text
- AC4: section ordering (Metrics < Tests < Sync)
- R3: partial summary handling

## Test location
- `specs/123-add-test-info-to-report/tests/report-tests.test.js`

## How to run
```bash
node --test specs/123-add-test-info-to-report/tests/report-tests.test.js
```

## Expected results
All tests pass after `src/flow/commands/report.js` is updated with test information support.
