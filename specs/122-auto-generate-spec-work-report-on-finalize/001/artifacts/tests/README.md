# Tests for spec #122: Auto-generate spec work report on finalize

## What was tested
- `generateReport()` function that collects finalize pipeline data and produces structured JSON + formatted text
- AC1-AC3: report output structure (data + text fields, required keys, section headings)
- AC5: graceful handling when retro is skipped/failed
- AC6: sync skipped scenario (PR route)
- Metrics aggregation across phases
- Edge cases: empty redolog, null metrics

## Test location
- `specs/122-auto-generate-spec-work-report-on-finalize/tests/report.test.js` (spec verification test)

## How to run
```bash
node --test specs/122-auto-generate-spec-work-report-on-finalize/tests/report.test.js
```

## Expected results
All tests pass after `src/flow/run/report.js` is implemented with the `generateReport()` function.
