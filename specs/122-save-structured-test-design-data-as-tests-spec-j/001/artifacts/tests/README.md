# Tests for Spec #122: Save structured test design data

## What was tested
- `flow set test-summary` command saves counts to flow.json `test.summary`
- Error on no flags
- Overwrite behavior (replace, not merge)
- Existing flow.json fields not affected
- Command appears in `flow set --help`

## Where tests are located
- `tests/unit/flow/set-test-summary.test.js` (formal tests, run by `npm test`)

## How to run
```bash
node --test tests/unit/flow/set-test-summary.test.js
```

## Expected results
All tests fail initially (command not yet implemented). All pass after implementation.
