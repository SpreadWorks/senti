# Tests for spec 222: clean-stale-preparing-flows

All tests for this spec live in `tests/unit/flow/` (formal tests), because the behaviors they verify are general contracts — a future regression on any of them is always a bug regardless of this spec.

## Test files

- `tests/unit/flow/clean-stale-preparing-flows.test.js` — verifies `PreparingFlowStore.cleanStale()` deletes files older than `PREPARING_TTL_MS` and confirms the TTL value is 1 hour.
- `tests/unit/flow/set-init-cleanup.test.js` — verifies `SetInitCommand.execute()` calls the stale cleanup before emitting the "preparing flow(s) already exist" warning.

## Requirements coverage

| REQ | Test |
|---|---|
| REQ-P1 | `set-init-cleanup.test.js` — deletes stale preparing files... |
| REQ-P2 | `clean-stale-preparing-flows.test.js` — deletes files older than PREPARING_TTL_MS... |
| REQ-P3 | `clean-stale-preparing-flows.test.js` — PREPARING_TTL_MS equals 60 * 60 * 1000 |
| REQ-P4 | `set-init-cleanup.test.js` — warning count reflects only fresh files |
| REQ-P5 | Static diff check (AC-3) — no test; reviewed manually / by `grep` in gate |
| REQ-P6 | `set-init-cleanup.test.js` — emits no warning when no preparing flows exist |

## How to run

```bash
node --test tests/unit/flow/clean-stale-preparing-flows.test.js tests/unit/flow/set-init-cleanup.test.js
```

Or as part of the full suite:

```bash
npm test
```

## Expected results (post-implementation)

All 6 subtests across the two files pass.
