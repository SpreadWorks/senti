# Tests for spec #141: fix-sync-fail-issuelog

## What was tested
- `commitOrSkip` regex pattern for "no changes added to commit"
- `finalizeOnError` writing to mainRoot in worktree mode

## Where tests are located
- `specs/141-fix-sync-fail-issuelog/tests/sync-issuelog.test.js`

## How to run
```bash
node --test specs/141-fix-sync-fail-issuelog/tests/sync-issuelog.test.js
```

## Expected results
All tests pass after implementation.
