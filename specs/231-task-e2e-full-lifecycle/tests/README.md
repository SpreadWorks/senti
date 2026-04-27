# Spec 231: Test Documentation

## What was tested
End-to-end lifecycle for task decomposition: flat tasks (2 tasks, parent=null) and parent-child tasks (parent + 2 children). Verifies complete-task promotion, parent auto-completion, and finalize-eligible state.

## Test location
- `tests/e2e/231-task-e2e-full-lifecycle.test.js` (formal test, runs via `npm test`)

## How to run
```bash
npm test -- --file tests/e2e/231-task-e2e-full-lifecycle.test.js
```

## Expected results
2 test suites, 2 tests — all pass.
