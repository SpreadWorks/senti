# Spec #120 Tests

## What was tested

Retro step insertion into the finalize pipeline (Issue #61).

- R1: STEP_MAP includes retro at position 3 (between merge and sync)
- R2: retro step execution, dry-run output, step selection

## Where tests are located

`specs/120-fix-retro-execution-order-in-finalize/tests/120-retro-in-finalize.test.js`

## How to run

```bash
cd <worktree-or-repo-root>
node --test specs/120-fix-retro-execution-order-in-finalize/tests/120-retro-in-finalize.test.js
```

## Expected results

All tests should pass after implementation is complete.
