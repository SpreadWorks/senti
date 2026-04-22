# Tests for spec 213 (flow-throw-to-envelope)

## What is tested
Verifies that flow commands in classification C (judgment results), B (user-avoidable),
and D (CLI argument validation) now return `{ ok: false, errors: [{ code, messages }], data }`
envelopes instead of throwing, and that each envelope carries the documented code and hint/data.

### Coverage matrix

| REQ | Code | Test case |
|---|---|---|
| R1a | `AUTO_CHECK_INELIGIBLE` | `flow set auto on` with low AI score |
| R1b | `ESCALATE_RETRY_EXHAUSTED` | `checkRetryBelowMax` direct-call test with mocked retry count at max |
| R1c | `NO_PROGRESS_SINCE_LAST_FAIL` | `checkNoProgressSinceLastFail` direct-call test with matching head/worktree hashes |
| R2a | `RETRO_EXISTS` | `flow run retro` with pre-existing `retro.json` |
| R2b | `NO_CHANGES` | `flow run retro` on branch with empty diff vs base |
| R3  | `INVALID_USAGE` / `INVALID_ARG_VALUE` / `INVALID_PHASE` / `INVALID_STATUS` / `INVALID_JSON` | `flow set step/req/issue/note/request/summary/metric/auto/issue-log` with bad args |
| R4  | (regression) | classification-A throws still propagate as non-zero exit + envelope |

## Location
- `tests/unit/flow/throw-to-envelope-codes.test.js` (formal tests under `tests/`, run by `npm test`).

Breakage of these tests always indicates a regression of the throw→envelope contract,
independent of spec 213 — so they live under `tests/`.

## How to run
```
node --test tests/unit/flow/throw-to-envelope-codes.test.js
```
or full suite:
```
npm test
```

## Expected results
- Initially (before implementation): all assertions FAIL because current code throws
  with generic `ERROR` code from the dispatcher fallback.
- After implementation: all tests PASS, and each envelope has the specific code.

## Notes
- R1b / R1c full integration is deferred because triggering them via CLI requires
  preparing issue-log fixtures with HEAD hashes. Once the functions return result
  objects instead of throwing, unit tests that call the exported function directly
  can be added.
