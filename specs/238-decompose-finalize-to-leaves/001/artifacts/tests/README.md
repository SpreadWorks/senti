# Spec 238 Tests

## What is tested

- **238-definition-structure.test.js**: Verifies that FLOW_DEFINITION has finalize decomposed as a branch with 4 leaves (R1, R6, R8, R10). Tests collectLeafIds, derivePhaseMap, buildInitialNestedSteps output.
- **238-registry-commands.test.js**: Verifies that registry.js has individual finalize commands registered and old unified command removed (R3, R4, R5, R10, R16).

## Location

`specs/238-decompose-finalize-to-leaves/tests/`

## How to run

```bash
node --test specs/238-decompose-finalize-to-leaves/tests/*.test.js
```

## Expected results

All tests pass after implementation is complete. Before implementation, tests will fail (test-first).
