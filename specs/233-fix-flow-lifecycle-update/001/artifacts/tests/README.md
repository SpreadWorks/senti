# Spec 233: Lifecycle Field Removal — Tests

## What was tested
- R1: `run-prepare-spec.js` no longer writes `lifecycle` field
- R2: `run-finalize.js` transitions finalize step to `done` before cleanup
- R3: `changelog.js` uses `state.finalizedAt` for status (source + e2e)
- R4/R8: `get-status.js` output excludes `lifecycle`
- R5: `run-reopen-draft.js` has no lifecycle guard
- R6: `run-resume.js` output excludes `lifecycle`

## Location
`specs/233-fix-flow-lifecycle-update/tests/verify.test.js`

## How to run
```bash
node --test specs/233-fix-flow-lifecycle-update/tests/verify.test.js
```

## Expected results
All tests should pass after implementation is complete.
Tests for R1–R6 verify source code changes via string inspection and e2e changelog output.
