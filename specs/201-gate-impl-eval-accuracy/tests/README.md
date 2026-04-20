# Tests for spec 201 — gate-impl-eval-accuracy

## Test Placement

Per draft Q8 decision, tests for this spec live in the long-term `tests/` tree (API contract tests that must remain green after future refactors). No `specs/<spec>/tests/` content is created.

## Files

### `tests/unit/flow/gate-test-change-check.test.js`
Unit tests for `checkTestChanges(diff, testGlobs)` covering P1-R1 〜 P1-R6:

- non-test file changes are ignored
- multi-line `+` only hunks in test files → PASS (P1-R4)
- hunk with `-` line → FAIL with file/line (P1-R2, P1-R5)
- hunk with `+` only 1 line → FAIL (P1-R3)
- per-hunk classification (mixed file with both append and modify hunks)
- language-agnostic behavior (P1-R6): single-line `it(...)` append is still FAIL

### `tests/unit/flow/gate-retry-counter.test.js`
Unit tests for retry counter plumbing covering P2-R1, P2-R4:

- `VALID_METRIC_COUNTERS` includes `gateRetry`
- `sdd-forge flow set metric <phase> gateRetry` increments counter in flow.json
- counter persists across invocations

## Running

```bash
node tests/run.js tests/unit/flow/gate-test-change-check.test.js
node tests/run.js tests/unit/flow/gate-retry-counter.test.js
```

Or all flow unit tests:

```bash
npm test -- tests/unit/flow
```

## Expected Results

Before implementation: both test files FAIL (symbols `checkTestChanges` and `gateRetry` counter do not exist).
After implementation: all tests PASS.
