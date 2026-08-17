# Spec 135: Consolidate Command Execution — Tests

## What was tested
- `runCmd` and `runCmdAsync` are exported from `process.js`
- `runSync` is removed
- `git-state.js` is renamed to `git-helpers.js`
- No `execFileSync` imports outside `process.js` and `agent.js`
- No `tryExec` references remain in `src/`

## Where tests are located
- `specs/135-consolidate-cmd-exec/tests/verify.test.js` — spec verification (not run by npm test)
- `tests/unit/lib/process.test.js` — formal runCmd/runCmdAsync tests (run by npm test)

## How to run
```bash
node --test specs/135-consolidate-cmd-exec/tests/verify.test.js
```

## Expected results
All tests pass after implementation is complete. Tests will fail before implementation.
