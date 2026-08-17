# Spec #119 Tests

## What was tested

Hook lifecycle redesign and metric auto-recording (Issue #59).

- R1: `runEntry` pre/post/onError/finally hooks
- R2: Registry hook expansion (all run commands, get.context, set.redo)
- R3: `incrementMetric` shared from `flow-state.js`
- R4: `prepare-spec` --issue/--request arguments
- R2d: `set.redo` post hook auto-increments redo metric

## Where tests are located

`specs/119-fix-missing-docsread-srcread-metrics/tests/119-hook-lifecycle.test.js`

## How to run

```bash
cd <worktree-or-repo-root>
node --test specs/119-fix-missing-docsread-srcread-metrics/tests/119-hook-lifecycle.test.js
```

## Expected results

All 9 tests should pass after implementation is complete.
