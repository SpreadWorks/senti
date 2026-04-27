# Spec 236 Tests — Flow Definition

## What is tested

Spec verification tests for the flow definition (FLOW_DEFINITION) introduction.
These verify that the spec requirements (R1, R2, R6, R8, R12) are met.

- R1: `src/flow/definition.js` exists, exports `FLOW_DEFINITION` and `TASK_DEFINITION`, each node has required attributes, helper functions exist
- R2: `context-rules.json` has been removed
- R6: `maxAttempts` values are correct (gate-draft=10, gate=20, gate-impl=5, review=3)
- R8: Stale steps (integration-*, show-report) removed from `FLOW_STEPS`
- R12: `test` node exists in definition between approval and implement

## Location

`specs/236-flow-definition/tests/` (spec verification tests, not run by `npm test`)

## How to run

```bash
node --test specs/236-flow-definition/tests/*.test.js
```

## Expected results

Before implementation: all tests fail (definition.js does not exist).
After implementation: all tests pass.
