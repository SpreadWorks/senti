# Spec 227 Tests

## What was tested

- REQ-A2: FlowStore.load rejects empty tasks (strict enforcement)
- REQ-A3: get-next-action assumes non-empty tasks (flat fallback removal)
- REQ-B3: Spec 226 placeholder tests expanded to real tests (in tests/unit/226-task-decomp-wiring/)
- REQ-C1: E2E forest lifecycle via CLI (task sync, next-action, complete-task, finalize transition)

## Test locations

| Requirement | Path | Type |
|---|---|---|
| REQ-A2 | tests/unit/227-post-226-forest-integration/t-a2-strict-load.test.js | formal (npm test) |
| REQ-A3 | tests/unit/227-post-226-forest-integration/t-a3-no-flat-fallback.test.js | formal (npm test) |
| REQ-C1 | tests/e2e/227-forest-e2e.test.js | formal (npm test) |
| REQ-B3 | tests/unit/226-task-decomp-wiring/*.test.js | formal (npm test) |

## How to run

```bash
npm test
```

## Expected results

All tests PASS after implementation is complete. Tests for REQ-A2 will fail until FlowStore.load is strictified.
