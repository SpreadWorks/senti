# Tests for spec 143: gate-fail-auto-issue-log

## What was tested

- Registry gate entry has post and onError hooks defined

## Test location

- `specs/143-gate-fail-auto-issue-log/tests/gate-hooks.test.js`

## How to run

```bash
node --test specs/143-gate-fail-auto-issue-log/tests/gate-hooks.test.js
```

## Expected results

Test should FAIL before implementation (no onError hook on gate entry), PASS after.
