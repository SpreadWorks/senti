# Tests for #107 test-inventory-and-organization

## What is tested
- 9 test files have been removed from `tests/` (moved to `specs/<spec>/tests/`)
- flow-plan SKILL.md contains test placement classification criteria

## Test location
- `specs/107-test-inventory-and-organization/tests/verify-moves.test.js`

## How to run
```bash
node --test specs/107-test-inventory-and-organization/tests/verify-moves.test.js
```

## Expected results
- All tests should fail initially (files not yet moved, SKILL.md not yet updated)
- After implementation, all tests should pass
