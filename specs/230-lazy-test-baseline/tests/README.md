# Spec 230: Lazy Test Baseline — Tests

## What was tested

Lazy baseline acquisition for `flow run tests` (head mode):
- REQ-1: Auto-captures baseline when `test.baseline` is not yet recorded
- REQ-2: Skips baseline capture when already recorded
- REQ-4: Continues head test execution when baseline capture fails
- REQ-7: `--baseline` flag continues to work independently

## Where tests are located

`specs/230-lazy-test-baseline/tests/lazy-baseline.test.js`

## How to run

```bash
node --test specs/230-lazy-test-baseline/tests/lazy-baseline.test.js
```

## Expected results

All 4 tests should pass after implementation is complete.
Tests will fail before implementation (test-first approach).
