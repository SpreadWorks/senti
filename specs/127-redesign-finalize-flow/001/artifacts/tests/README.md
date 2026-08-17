# Tests for spec 127: Redesign finalize flow

## What is tested

- **R1**: STEP_MAP has exactly 4 steps (commit, merge, sync, cleanup)
- **R2/R3**: finalize.js does not use runSync for merge/retro/report/cleanup (function calls instead)
- **R4**: cleanup.js has been removed from src/flow/commands/
- **R5**: merge.js has no runIfDirect, exports main(ctx)
- **R6**: report.js is registered in registry.js as flow.run.report

## Location

`specs/127-redesign-finalize-flow/tests/finalize-redesign.test.js`

## How to run

```bash
node --test specs/127-redesign-finalize-flow/tests/finalize-redesign.test.js
```

## Expected results

All tests pass after implementation is complete. Before implementation, tests for R1, R4, R5 (runIfDirect removal), and R6 will fail.
