# Tests for spec #111: Detect corrupted JSON in flow-state.js

## What was tested and why
- loadActiveFlows() behavior when .active-flow contains corrupted JSON
- Verify empty array is returned (no crash) and existing behavior preserved

## Where tests are located
- `specs/111-detect-corrupted-json-in-flow-state-js/tests/corrupted-json.test.js`

## How to run
```bash
node --test specs/111-detect-corrupted-json-in-flow-state-js/tests/corrupted-json.test.js
```

## Expected results
- All tests pass both before and after implementation (behavior doesn't change, only logging is added)
