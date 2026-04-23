# spec 216 tests

## What is tested
- `checkRetryBelowMax` / `checkNoProgressSinceLastFail` append exactly one `issue-log.json` entry when they return an `Envelope.fail` (`ESCALATE_RETRY_EXHAUSTED` / `NO_PROGRESS_SINCE_LAST_FAIL`).
- The appended entry carries envelope-message content in `reason`, the correct `phase`, and the `step` produced by `resolveGateStepId(phase)`.
- `flowState.metrics[phase].gateRetry` is not mutated by either path (the `skipPost=true` budget-non-consumption invariant from spec 213 is preserved).
- No issue-log is touched when the guards return `null` (proceed-normally paths).

## Location
- `tests/unit/flow/gate-envelope-issue-log.test.js` — formal tests (run by `npm test`). These are contract tests for the `check*` helpers; a regression here is always a bug.

## How to run
```
node --test tests/unit/flow/gate-envelope-issue-log.test.js
```
or
```
npm test
```

## Expected results
All four subtests pass once the implementation writes the issue-log entry before returning the Envelope.fail.
