# Test Summary

## What was tested
- Added unit tests for finalize preflight in `tests/unit/flow/run-finalize-preflight.test.js`.
- Verified writable `.git` directory case succeeds.
- Verified non-writable `.git` directory case fails with help text and dedicated error code.
- Verified `RunFinalizeCommand.execute()` invokes preflight before running finalize steps.

## Why this test placement
- This behavior is a CLI contract for `flow run finalize`, so it belongs in formal unit tests under `tests/`.
- If this breaks in future, it is always a bug regardless of spec context.

## How to run
```bash
node --test tests/unit/flow/run-finalize-preflight.test.js
```

## Expected results
- All tests pass after implementation.
- Before implementation, the new preflight expectations fail.
