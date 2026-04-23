# Spec 223 Tests

## What is tested
Unit tests for `flow set test-summary` baseline-shape inheritance behavior.

Covered cases (maps to AC-1〜AC-5 and REQ-1〜REQ-5 in spec.json):
- Legacy flag mode `--unit` partial input inherits integration/acceptance from baseline
- `--json` mode `counts` partial input inherits the same fields
- Baseline absent → partial input saved as-is (no inheritance)
- Baseline has exitCode → head does NOT inherit exitCode
- `--mode fallback` → inheritance disabled, only `failed[]` written
- `--baseline` target write → inheritance disabled
- Baseline missing a specific count field → that field stays undefined on head

## Location
Tests are added to the existing formal test file `tests/unit/flow/set-test-summary.test.js` (not `specs/<spec>/tests/`), because a future regression in this code indicates a bug regardless of which spec introduced the feature.

## How to run
```
npm test -- tests/unit/flow/set-test-summary.test.js
```
or
```
node --test tests/unit/flow/set-test-summary.test.js
```

## Expected results
All cases in the new `describe("baseline shape inheritance", ...)` block PASS after implementing the inheritance logic in `src/flow/lib/set-test-summary.js`.
