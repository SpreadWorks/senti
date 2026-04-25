# Spec 229: Test Runner File Filter — Tests

## What was tested
- R1: `--file <path>` single/multiple file specification, nonexistent file error
- R2: `--pattern <glob>` glob matching, zero-match error
- R3: Positional args as file/directory, recursive `.test.js` collection
- R4: Mutual exclusion between file-spec mode and directory-search mode
- R5: Label summary output preserved in file-spec mode
- AC9: No regression for existing flag-only usage

## Test locations
- `tests/unit/test-runner-flags.test.js` — `validateFlags` unit tests for file-spec exclusivity (formal, run by `npm test`)
- `tests/unit/test-runner-file-filter.test.js` — Integration tests via `spawnSync(node tests/run.js ...)` for end-to-end behavior (formal, run by `npm test`)

## How to run
```bash
npm test
# or individually:
node --test tests/unit/test-runner-flags.test.js
node --test tests/unit/test-runner-file-filter.test.js
```

## Expected results
All tests pass after implementation is complete. Tests are expected to fail before implementation (test-first).
