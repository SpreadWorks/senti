# Tests: 228-strict-gate-req-spec

## What was tested

- REQ-1: `spec.schema.json` accepts `tasks[].expected_tests` as an optional string array
- REQ-2/REQ-3: `checkExpectedTests` verifies file existence and returns FAIL with path
- REQ-4: Skips verification when `expected_tests` is undefined/null/empty
- REQ-5: Glob pattern expansion against worktree
- REQ-6: Pure mechanical check (synchronous, no AI invocation)
- REQ-7: Gate failure envelope via `gateFail` (covered by integration with `executeDiffBasedGate`)
- REQ-8: Bounded resource usage (50 entries max, 500 glob matches max)

## Test locations

- `tests/unit/flow/gate-expected-tests.test.js` — `checkExpectedTests` function unit tests (REQ-2 through REQ-8)
- `tests/unit/flow/spec-schema-expected-tests.test.js` — schema validation for `expected_tests` field (REQ-1)

Both files are formal tests under `tests/` and run via `npm test`.

## How to run

```bash
npm test
# or specifically:
node --test tests/unit/flow/gate-expected-tests.test.js tests/unit/flow/spec-schema-expected-tests.test.js
```

## Expected results

All tests pass after T-1 (schema) and T-2 (checkExpectedTests) are implemented.
