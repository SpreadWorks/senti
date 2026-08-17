# Tests for spec #137: fix-review-exit-code

## What was tested

- `runReviewLoop` (from `src/flow/commands/review.js`): verification detect after last fix
- `parseSpecReviewOutput` / `parseTestReviewOutput` (from `src/flow/lib/run-review.js`): error message quality for edge cases

## Where tests are located

- `specs/137-fix-review-exit-code/tests/review-exit-code.test.js`

## How to run

```bash
node --test specs/137-fix-review-exit-code/tests/review-exit-code.test.js
```

## Expected results

All 12 tests pass. Key scenarios:
- `runReviewLoop` returns PASS when verification detect finds 0 issues after fix
- `runReviewLoop` returns FAIL when all fixes are no-op
- `parse*Output` includes "subprocess error" note when exit 1 + issues/gaps=0
